/* Regras do AVA — puras.
 *
 * Tudo o que decide O QUE MOSTRAR a partir dos dados crus da API: o estado de
 * cada atividade, os grupos por prazo, a situação pela regra do manual. Não
 * faz rede, não lê o DOM e não guarda nada — por isso roda também em Node,
 * nos testes unitários (tests/unit/rules.test.ts).
 *
 * Regra de aprovação (Manual do Aluno EaD 2026, p. 29):
 *   Av1 (atividades dos módulos, 5,0) + Av2 (presencial, 5,0) >= 6,0 aprova.
 *   Entre 4,0 e 6,0 vai para Av3 (recuperação). Abaixo de 4,0 reprova.
 * Os valores máximos vêm do boletim de cada disciplina, não são fixos aqui.
 */

import { dayOf, daysUntil, formatNum, plural, toTimestamp } from "./format.ts";
import type {
  Activity,
  ActivityState,
  AvNumber,
  CourseSummary,
  DeadlineGroup,
  DropboxFolder,
  GradeObject,
  GradeValue,
  Message,
  Preview,
  Quiz,
  QuizListEntry,
  RawCourse,
  Tally,
  Toc,
  TocTopic,
} from "./types.ts";

export const PASS_MARK = 6;
export const RECOVERY_MARK = 4;
const MAX_DEADLINES = 4;

const hasPoints = (v: GradeValue | undefined): v is GradeValue =>
  !!v && v.PointsNumerator !== null && v.PointsNumerator !== undefined;

/* ------------------------------------------------------------------
 * Leitura do boletim
 * ---------------------------------------------------------------- */
export const isActivity = (g: GradeObject): boolean => g.GradeType === "Numeric" && !g.IsHidden && (g.MaxPoints ?? 0) > 0;

/** O boletim já diz o formato da disciplina: com "Nota AV1" (curso de
 *  Música) a barra terá 2 colunas; sem, 1 só. */
export function preview(gi: GradeObject[]): Preview {
  const hasAv = gi.some((g) => /^\s*nota\s*av\s*1\b/i.test(g.Name));
  return { hasAv, label: hasAv ? "Av1" : "Nota", columns: hasAv ? 2 : 1 };
}

export interface ReadPlan {
  /** ler a Lista de questionários (há questionário ativo) */
  hasQuiz: boolean;
  /** ler o conteúdo: há atividade avaliada que não é tarefa nem questionário, sem nota */
  unlinked: boolean;
  /** tarefas cujo envio precisa ser conferido (contam e ainda não têm nota) */
  toCheck: DropboxFolder[];
}

/** Poucas leituras: o que a 2ª leva precisa buscar, a partir da 1ª. */
export function plan(gi: GradeObject[], values: GradeValue[], folders: DropboxFolder[], quizzes: Quiz[]): ReadPlan {
  const numericIds = new Set(gi.filter(isActivity).map((g) => g.Id));
  const gradedIds = new Set(values.filter(hasPoints).map((v) => String(v.GradeObjectIdentifier)));
  const linked = new Set([...folders, ...quizzes].map((a) => a.GradeItemId).filter(Boolean));
  return {
    hasQuiz: quizzes.some((q) => q.IsActive !== false),
    unlinked: [...numericIds].some((id) => !linked.has(id) && !gradedIds.has(String(id))),
    toCheck: folders.filter((p) => {
      if (p.IsHidden || gradedIds.has(String(p.GradeItemId))) return false;
      return (p.GradeItemId != null && numericIds.has(p.GradeItemId)) || whichAv("", p.Name) !== null;
    }),
  };
}

function topics(toc: Toc | null): TocTopic[] {
  const out: TocTopic[] = [];
  const walk = (modules: Toc["Modules"]) =>
    modules?.forEach((m) => {
      out.push(...(m.Topics ?? []));
      walk(m.Modules);
    });
  walk(toc?.Modules);
  return out;
}

/** Av2 e Av3: a nota das atividades fica oculta para o aluno até o
 *  lançamento, então elas não aparecem no boletim. Reconhece pela seção da
 *  Lista de questionários ("Avaliação 2 (Av2)") ou pelo nome. */
export function whichAv(section: string | undefined, name: string | undefined): 2 | 3 | null {
  let m = (section ?? "").match(/\(\s*Av\s*([23])\s*\)|Avalia[çc][ãa]o\s*([23])\b/i);
  if (m) return Number(m[1] || m[2]) as 2 | 3;
  m = (name ?? "").match(/\bAv\s*([23])\b/i);
  if (m) return Number(m[1]) as 2 | 3;
  if (/recupera[çc][ãa]o/i.test(`${section ?? ""} ${name ?? ""}`)) return 3;
  return null;
}

export const assignmentLink = (ou: string | number, id: number): string =>
  `/d2l/lms/dropbox/user/folder_submit_files.d2l?db=${id}&grpid=0&isprv=0&bp=0&ou=${ou}`;

export const quizLink = (ou: string | number, id: number): string =>
  `/d2l/lms/quizzing/user/quiz_summary.d2l?ou=${ou}&qi=${id}&cfql=1`;

const folderDeadline = (p: DropboxFolder) => toTimestamp(p.DueDate) ?? toTimestamp(p.Availability?.EndDate);
const quizDeadline = (q: Quiz) => toTimestamp(q.DueDate) ?? toTimestamp(q.EndDate);

function newItem(name: string, max: number, av: AvNumber): Activity {
  return {
    name,
    max,
    av,
    points: null,
    deadline: null,
    assignment: null,
    link: "",
    section: "",
    submitted: false,
    inProgress: false,
    state: null,
  };
}

function applyAttempts(it: Activity, l: QuizListEntry | undefined): void {
  if (!l) return;
  it.section = l.section;
  it.inProgress = l.inProgress;
  if (l.used > 0 && !l.inProgress) it.submitted = true;
}

/* ------------------------------------------------------------------
 * Dados crus → atividades
 * ---------------------------------------------------------------- */
export function classify(ou: string | number, raw: RawCourse): Activity[] {
  const grade = new Map(raw.values.map((v) => [String(v.GradeObjectIdentifier), v]));
  const { submissions, quizList } = raw;

  /* Atividade avaliada que é tópico de conteúdo (e não tarefa/questionário):
     o conteúdo diz se foi concluída e qual o prazo. */
  const myItemById = new Map(raw.myItems.map((i) => [i.ItemId, i]));
  const byContent = new Map<number, { done: boolean; deadline: number | null }>();
  for (const t of topics(raw.toc)) {
    if (!t.GradeItemId) continue;
    const i = myItemById.get(t.TopicId);
    byContent.set(t.GradeItemId, {
      done: !!i?.DateCompleted,
      deadline: toTimestamp(i?.DueDate) ?? toTimestamp(i?.EndDate) ?? toTimestamp(t.EndDateTime),
    });
  }

  const inGradebook = new Set<number>();
  const items = raw.gi.filter(isActivity).map((g) => {
    inGradebook.add(g.Id);
    const it = newItem(g.Name, g.MaxPoints ?? 0, 1);
    const c = byContent.get(g.Id);
    if (c) {
      it.submitted = c.done;
      it.deadline = c.deadline;
    }

    for (const p of raw.folders) {
      if (p.GradeItemId !== g.Id || p.IsHidden) continue;
      it.assignment = p.Id;
      it.deadline = folderDeadline(p);
      it.link = assignmentLink(ou, p.Id);
      if (submissions.submittedIds[p.Id]) it.submitted = true;
      if (submissions.sections[p.Id]) it.section = submissions.sections[p.Id];
    }
    for (const q of raw.quizzes) {
      if (q.GradeItemId !== g.Id || q.IsActive === false) continue;
      it.deadline = quizDeadline(q);
      it.link = quizLink(ou, q.QuizId);
      applyAttempts(it, quizList[String(q.QuizId)]);
    }

    const v = grade.get(String(g.Id));
    if (hasPoints(v)) {
      it.points = v.PointsNumerator;
      it.state = "graded";
    }
    return it;
  });

  /* Av2/Av3: atividades cuja nota está oculta (fora do boletim visível).
     Entram sem pontos — só prazo, estado e link. */
  for (const q of raw.quizzes) {
    if (q.IsActive === false || (q.GradeItemId != null && inGradebook.has(q.GradeItemId))) continue;
    const l = quizList[String(q.QuizId)];
    const av = whichAv(l?.section, q.Name);
    if (!av) continue;
    const it = newItem(q.Name, 0, av);
    it.deadline = quizDeadline(q);
    it.link = quizLink(ou, q.QuizId);
    applyAttempts(it, l);
    items.push(it);
  }
  for (const p of raw.folders) {
    if (p.IsHidden || (p.GradeItemId != null && inGradebook.has(p.GradeItemId))) continue;
    const av = whichAv(submissions.sections[p.Id], p.Name);
    if (!av) continue;
    const it = newItem(p.Name, 0, av);
    it.assignment = p.Id;
    it.deadline = folderDeadline(p);
    it.link = assignmentLink(ou, p.Id);
    it.submitted = !!submissions.submittedIds[p.Id];
    it.section = submissions.sections[p.Id] ?? "";
    items.push(it);
  }
  return items;
}

function formula(values: GradeValue[], n: number): GradeValue | null {
  const re = new RegExp(`^\\s*nota\\s*av\\s*${n}\\b`, "i");
  return values.find((v) => re.test(v.GradeObjectName)) ?? null;
}

/** "Avaliação 1 (Av1) - Último Fechamento", 2º grupo →
 *  curto "2º Fechamento" (mesma largura em todas as linhas),
 *  longo "Av1 · Último Fechamento" (nome oficial). */
function deadlineNames(section: string, order: number): { shortLabel: string; longLabel: string } | null {
  const parts = section.split(/\s[-–]\s/);
  const end = parts.length > 1 ? parts[parts.length - 1] : "";
  const av = (section.match(/\((Av\s*\d)\)|^\s*(Av\s*\d)\b/i) ?? []).slice(1).find(Boolean);
  if (!end) return null;
  return {
    shortLabel: `${order}º ${end.split(/\s+/).pop()}`,
    longLabel: (av ? `${av.replace(/\s/g, "")} · ` : "") + end,
  };
}

/* ------------------------------------------------------------------
 * Atividades → estado, grupos e situação
 * ---------------------------------------------------------------- */
export function finalState(it: Activity, now: number): ActivityState {
  if (it.state) return it.state;
  const overdue = it.deadline !== null && it.deadline < now;
  if (it.inProgress && !overdue) return "started";
  if (it.submitted || it.inProgress) return "awaiting";
  if (overdue) return "missed";
  return "todo";
}

export function tally(items: Activity[]): Tally {
  const c: Tally = { items, graded: 0, awaiting: 0, started: 0, missed: 0, todo: 0, delivered: 0, pending: 0 };
  for (const it of items) if (it.state) c[it.state]++;
  c.delivered = c.graded + c.awaiting;
  c.pending = c.todo + c.started;
  return c;
}

export function summarize(activities: Activity[], values: GradeValue[], now = Date.now()): CourseSummary {
  const f1 = formula(values, 1);
  const f2 = formula(values, 2);
  const f3 = formula(values, 3);
  /* A fórmula vale 0 até a prova ser lançada; 0 não é resultado. */
  const released: Record<number, boolean> = {
    2: (f2?.PointsNumerator ?? 0) > 0,
    3: (f3?.PointsNumerator ?? 0) > 0,
  };

  for (const it of activities) {
    /* Nota da Av2/Av3 lançada: as atividades dela foram corrigidas. */
    if (it.av > 1 && released[it.av]) it.state = "graded";
    it.state = finalState(it, now);
  }

  const total = activities.reduce((s, it) => s + it.max, 0);
  const ok = activities.reduce((s, it) => s + (it.state === "graded" && it.points !== null ? it.points : 0), 0);
  const av1 = f1 && f1.PointsNumerator !== null ? f1.PointsNumerator : ok;

  /* A Av3 é aberta para a turma toda, mas só serve para quem ficou em
     recuperação (Av1 + Av2 entre 4 e 6). Sem isso ela sumiria da vista de
     quem precisa e apareceria como pendência para quem já passou. Fica
     também se o aluno já mexeu nela (iniciou, enviou ou tem nota). */
  const sum = released[2] ? av1 + (f2?.PointsNumerator ?? 0) : null;
  const inRecovery = !!f1 && sum !== null && sum >= RECOVERY_MARK && sum < PASS_MARK;
  const items = activities.filter(
    (it) => it.av !== 3 || inRecovery || it.state === "awaiting" || it.state === "started" || it.state === "graded"
  );

  /* Av1: um grupo por dia de prazo (Brasília) — o curso de Música tem dois
     fechamentos. Av2 e Av3: um grupo cada, com o nome delas. */
  const byDay = new Map<string, DeadlineGroup>();
  for (const it of items) {
    const key = it.av > 1 ? `av${it.av}` : it.deadline ? dayOf(it.deadline) : "none";
    let g = byDay.get(key);
    if (!g) {
      g = { day: key, av: it.av > 1 ? it.av : 1, deadline: it.deadline, items: [], section: "", named: false, shortLabel: "", longLabel: "", c: tally([]) };
      byDay.set(key, g);
    }
    g.items.push(it);
    if (it.deadline && (g.deadline === null || it.deadline > g.deadline)) g.deadline = it.deadline;
    if (!g.section && it.section) g.section = it.section;
  }
  const groups = [...byDay.values()]
    .sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity))
    .slice(0, MAX_DEADLINES);

  const av1Groups = groups.filter((x) => x.av === 1).length;
  let order = 0;
  for (const g of groups) {
    let names: { shortLabel: string; longLabel: string } | null;
    if (g.av === 2) names = { shortLabel: "Av2", longLabel: "Av2" };
    else if (g.av === 3) names = { shortLabel: "Av3", longLabel: "Av3 · Recuperação" };
    else if (!g.deadline) names = { shortLabel: "Sem prazo", longLabel: "Sem prazo" };
    else names = deadlineNames(g.section, ++order);
    g.named = !!names;
    g.shortLabel = names ? names.shortLabel : av1Groups > 1 ? `${order}º prazo` : "Prazo";
    g.longLabel = names ? names.longLabel : "Próximo prazo";
    g.c = tally(g.items);
  }

  /* Disciplinas como Canto Coral e Atividades Extensionistas não têm
     Av1/Av2: é um item só, valendo 10. Ali a regra do manual não se
     aplica, então mostramos só a nota, sem situação. */
  const hasAv = !!f1;
  return {
    total,
    ok,
    av1,
    av1Max: f1?.PointsDenominator ? f1.PointsDenominator : total,
    av2: released[2] ? (f2?.PointsNumerator ?? null) : null,
    av3: released[3] ? (f3?.PointsNumerator ?? null) : null,
    hasAv,
    label: hasAv ? "Av1" : "Nota",
    deadlines: groups,
    c: tally(items),
    /* Só a Av1 decide se já dá para dizer quanto falta na Av2. */
    c1: tally(items.filter((it) => it.av === 1)),
  };
}

/** Situação pela regra do manual, ou null se ainda não dá para dizer. */
export function standing(r: CourseSummary): Message | null {
  if (!r.hasAv) return null;
  /* O manual não diz como a Av3 entra na média final: só mostra a nota. */
  if (r.av3 !== null) return { tone: "", text: `Nota da Av3 · ${formatNum(r.av3)}` };
  if (r.av2 !== null) {
    const sum = r.av1 + r.av2;
    if (sum >= PASS_MARK) return { tone: "passed", text: `Aprovado · ${formatNum(sum)}` };
    if (sum >= RECOVERY_MARK) return { tone: "recovery", text: `Av3 (recuperação) · ${formatNum(sum)}` };
    return { tone: "failed", text: `Reprovado · ${formatNum(sum)}` };
  }
  if (r.c1.awaiting || r.c1.pending) return null;
  const needed = Math.max(0, PASS_MARK - r.av1);
  if (needed === 0) return { tone: "passed", text: `Av1 já garante os ${formatNum(PASS_MARK)}` };
  return { tone: "", text: `Precisa de ${formatNum(needed)} na Av2` };
}

/** O estado que mais pede atenção num prazo. */
export function highlight(c: Tally): Message {
  if (c.started) return { tone: "started", text: `⚠ ${plural(c.started, "não enviada", "não enviadas")}` };
  if (c.missed) return { tone: "missed", text: plural(c.missed, "perdida", "perdidas") };
  if (c.awaiting) return { tone: "awaiting", text: `${c.awaiting} aguardando` };
  if (c.graded && c.graded === c.items.length) return { tone: "graded", text: "corrigido" };
  if (c.todo) return { tone: "", text: `${c.todo} a fazer` };
  return { tone: "", text: "" };
}

/** Prazo de hoje ou amanhã com algo ainda por fazer. */
export function isUrgent(g: DeadlineGroup, now = Date.now()): boolean {
  return !!(g.deadline && g.deadline >= now && g.c.pending && daysUntil(g.deadline, now) <= 1);
}
