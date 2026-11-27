/* Dados e peças comuns aos dois desenhos do painel geral: o clássico
 * (summary-panel.ts) e o do Layout Amplo (summary-wide.ts). */

import { dayOf, escapeHtml as esc, formatNum, plural } from "../../ava/format.ts";
import { byClosingPriority, byUrgency, courseOutcome, tally } from "../../ava/rules.ts";
import type { Activity, CourseOutcome, OutcomeStatus, Tally } from "../../ava/types.ts";
import { LEGEND, STATE_LABEL } from "../shared/render.ts";
import type { CourseEntry, HomeState } from "./state.ts";

export interface PendingCourse {
  ou: string;
  name: string;
  pending: number;
  started: number;
  items: Activity[];
}

export interface Overall {
  deadline: number;
  longLabel: string;
  items: Activity[];
  courses: PendingCourse[];
  startedCount: number;
  readAt: number | null;
  c: Tally;
}

export interface ClosingCourse {
  ou: string;
  name: string;
  outcome: CourseOutcome;
  status: OutcomeStatus;
  awaiting: number;
  items: Activity[];
}

export interface Closing {
  courses: ClosingCourse[];
  /** Uma parte por disciplina, na ordem do progresso. */
  parts: { cls: "graded" | "awaiting" | "missed"; title: string }[];
  headline: string;
  sub: string;
  badge: string;
  comfort: boolean;
  allPassed: boolean;
  approved: number;
  guaranteed: number;
  recovery: number;
  readAt: number | null;
}

export function overallSummary(visible: string[], state: HomeState, now = Date.now()): Overall | null {
  let target: string | null = null;
  for (const ou of visible) {
    for (const g of state.ready.get(ou)?.summary.deadlines ?? []) {
      if (g.deadline && g.deadline >= now && (!target || dayOf(g.deadline) < target)) target = dayOf(g.deadline);
    }
  }
  if (!target) return null;

  const res: Omit<Overall, "c"> = { deadline: 0, longLabel: "", items: [], courses: [], startedCount: 0, readAt: null };
  for (const ou of visible) {
    const entry = state.ready.get(ou);
    if (!entry) continue;
    const { summary, name } = entry;
    if (summary.readAt && (!res.readAt || summary.readAt < res.readAt)) res.readAt = summary.readAt;
    for (const g of summary.deadlines) {
      if (!g.deadline || dayOf(g.deadline) !== target) continue;
      res.deadline = Math.max(res.deadline, g.deadline);
      if (!res.longLabel && g.named) res.longLabel = g.longLabel;
      res.items.push(...g.c.items);
      res.startedCount += g.c.started;
      if (!g.c.pending) continue;
      const same = res.courses.find((d) => d.ou === ou);
      if (same) {
        same.pending += g.c.pending;
        same.started += g.c.started;
        same.items.push(...g.c.items);
      } else {
        res.courses.push({ ou, name, pending: g.c.pending, started: g.c.started, items: [...g.c.items] });
      }
    }
  }
  res.courses.sort(byUrgency);
  return { ...res, longLabel: res.longLabel || "Próximo prazo", c: tally(res.items) };
}

export function shortName(name: string): string {
  const before = name.split(":")[0].trim();
  return before.length >= 3 ? before : name;
}

export const CHEVRON =
  `<svg class="eaa-r-go" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ` +
  `stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;

const stateLabel = (it: Activity): string => STATE_LABEL[it.state!];

/** `listAttrs` vai na <ul> (o painel do Amplo a torna focável quando rola) e
 *  `stateText` é o texto à direita de cada atividade. */
export function activityList(ou: string, name: string, itemsList: Activity[], listAttrs = "", stateText = stateLabel): string {
  const items = itemsList
    .map((it) => {
      const link = it.link
        ? `<a class="eaa-r-iname" href="${esc(it.link)}">${esc(it.name)}</a>`
        : `<span class="eaa-r-iname">${esc(it.name)}</span>`;
      return `<li class="${it.state}"><i aria-hidden="true"></i>${link}<span class="eaa-r-istate">${stateText(it)}</span></li>`;
    })
    .join("");
  return (
    `<div class="eaa-r-acts" id="eaa-r-acts-${ou}" hidden>` +
    `<ul aria-label="${esc(`Atividades de ${name}`)}"${listAttrs}>${items}</ul>` +
    `<a class="eaa-r-gocourse" href="/d2l/home/${ou}">Abrir a disciplina</a></div>`
  );
}

export const legend = (): string =>
  `<ul class="eaa-r-legend" aria-label="Legenda das cores">` +
  LEGEND.map(([state, label]) => `<li><i class="${state}"></i>${label}</li>`).join("") +
  `</ul>`;

export function closingPill(c: ClosingCourse): string {
  const o = c.outcome;
  if (o.status === "approved") return `✓ ${o.label} · ${o.scoreText}`;
  if (o.status === "partial_passed") return `✓ Já passou · ${o.scoreText} parcial`;
  if (o.status === "partial_wait") return `${o.scoreText} parcial · ${c.awaiting ? `${c.awaiting} aguardando` : o.detail.split(" · ").pop()}`;
  if (o.status === "waiting") return `sem nota · ${c.awaiting ? `${c.awaiting} aguardando` : "pendente"}`;
  if (o.status === "recovery") return `${o.label} · ${o.scoreText}`;
  return `Reprovado · ${o.scoreText}`;
}

/** Resumo de fim de semestre (quando não há mais prazos futuros): contagens
 *  e textos. `balance` diz onde está o balanço em relação ao texto, que muda
 *  conforme o desenho. */
export function closingSummary(visible: string[], state: HomeState, balance: string): Closing | null {
  const entries: { ou: string; entry: CourseEntry }[] = [];
  let readAt: number | null = null;
  for (const ou of visible) {
    const entry = state.ready.get(ou);
    if (!entry) continue;
    entries.push({ ou, entry });
    if (entry.summary.readAt && (!readAt || entry.summary.readAt < readAt)) readAt = entry.summary.readAt;
  }
  if (!entries.length) return null;

  const courses: ClosingCourse[] = entries.map(({ ou, entry }) => {
    const outcome = courseOutcome(entry.summary);
    return {
      ou,
      name: entry.name,
      outcome,
      status: outcome.status,
      awaiting: entry.summary.c.awaiting,
      items: entry.summary.c.items,
    };
  });
  courses.sort(byClosingPriority);

  const approved = courses.filter((c) => c.status === "approved").length;
  const partialPassed = courses.filter((c) => c.status === "partial_passed").length;
  const guaranteed = approved + partialPassed;
  const awaitingCourses = courses.filter((c) => c.awaiting > 0).length;
  const awaitingItems = courses.reduce((s, c) => s + c.awaiting, 0);
  const recovery = courses.filter((c) => c.status === "recovery").length;
  const failed = courses.filter((c) => c.status === "failed").length;
  const scores = courses.filter((c) => !c.outcome.partial && c.outcome.score !== null).map((c) => c.outcome.score as number);
  const avg = scores.length ? formatNum(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  /* ordem do progresso: verdes primeiro, depois âmbar, depois vermelho */
  const barRank = { graded: 0, awaiting: 1, missed: 2 } as const;
  const barClass = (c: ClosingCourse): keyof typeof barRank =>
    c.status === "approved" || c.status === "partial_passed" ? "graded" : c.status === "recovery" || c.status === "failed" ? "missed" : "awaiting";
  const parts = [...courses]
    .sort((a, b) => barRank[barClass(a)] - barRank[barClass(b)])
    .map((c) => ({ cls: barClass(c), title: `${c.name} · ${closingPill(c)}` }));

  const allPassed = recovery === 0 && failed === 0 && awaitingCourses === 0 && guaranteed === courses.length;
  let comfort = false;
  let headline: string;
  let sub: string;
  let badge: string;

  if (allPassed) {
    headline = "Semestre concluído com sucesso!";
    sub = `${plural(approved, "disciplina aprovada", "disciplinas aprovadas")}${avg ? ` · média geral ${avg}` : ""}. Bom descanso até o próximo período!`;
    badge = `${approved}/${courses.length} aprovadas`;
  } else if (recovery === 0 && failed === 0) {
    headline = guaranteed
      ? `Parabéns pelo semestre! ${plural(guaranteed, "disciplina já garantida", "disciplinas já garantidas")}.`
      : "Semestre encerrado — aguardando correções";
    const parts: string[] = [];
    if (partialPassed) parts.push(`${partialPassed} já ${partialPassed === 1 ? "passou" : "passaram"} com nota parcial`);
    if (awaitingItems) parts.push(`${plural(awaitingItems, "atividade aguarda", "atividades aguardam")} correção do professor`);
    sub = parts.join(" · ") || "Todas as atividades entregues foram contabilizadas.";
    badge = awaitingCourses ? `${guaranteed} garantidas · ${awaitingCourses} aguardando` : `${guaranteed}/${courses.length} garantidas`;
  } else {
    comfort = true;
    headline = recovery
      ? `Quase lá! ${plural(guaranteed, "garantida", "garantidas")} e ${plural(recovery, "em Av3", "em Av3")}.`
      : `Semestre encerrado · ${plural(guaranteed, "aprovada", "aprovadas")}.`;
    sub = recovery
      ? "Não desanime — aproveite a Av3 para fechar o semestre positivo."
      : `Alguns percalços acontecem — confira o balanço ${balance} para planejar os próximos passos.`;
    badge = recovery ? `${guaranteed} garantidas · ${recovery} em Av3` : `${guaranteed}/${courses.length} aprovadas`;
  }

  return { courses, parts, headline, sub, badge, comfort, allPassed, approved, guaranteed, recovery, readAt };
}
