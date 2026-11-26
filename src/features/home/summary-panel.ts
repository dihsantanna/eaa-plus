/* Feature 2 — painel geral, acima dos cards.
 *
 * Durante o semestre, mostra o próximo fechamento comum às disciplinas
 * visíveis. Quando todos os prazos já encerraram (fim do semestre), muda para
 * o resumo de fechamento: balanço comemorativo ou acolhedor, notas finais e
 * parciais, sinalização de aprovação garantida mesmo parcial e matérias que
 * ainda aguardam correção do professor.
 */

import { dayOf, daysUntil, escapeHtml as esc, formatDate, formatNum, formatTime, plural, timeLeft } from "../../ava/format.ts";
import { byClosingPriority, byUrgency, courseOutcome, rowsShown, tally } from "../../ava/rules.ts";
import type { Activity, CourseOutcome, OutcomeStatus, Tally } from "../../ava/types.ts";
import { LEGEND, STATE_LABEL, segments } from "../shared/render.ts";
import type { CourseEntry, HomeState } from "./state.ts";

const SUMMARY_ID = "eaa-summary";
const MAX_WAIT_MS = 20_000;

interface PendingCourse {
  ou: string;
  name: string;
  pending: number;
  started: number;
  items: Activity[];
}

interface Overall {
  deadline: number;
  longLabel: string;
  items: Activity[];
  courses: PendingCourse[];
  startedCount: number;
  readAt: number | null;
  c: Tally;
}

interface ClosingCourse {
  ou: string;
  name: string;
  outcome: CourseOutcome;
  status: OutcomeStatus;
  awaiting: number;
  items: Activity[];
}

function overallSummary(visible: string[], state: HomeState, now = Date.now()): Overall | null {
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

function shortName(name: string): string {
  const before = name.split(":")[0].trim();
  return before.length >= 3 ? before : name;
}

const CHEVRON =
  `<svg class="eaa-r-go" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ` +
  `stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;

function activityList(ou: string, name: string, itemsList: Activity[]): string {
  const items = itemsList
    .map((it) => {
      const link = it.link
        ? `<a class="eaa-r-iname" href="${esc(it.link)}">${esc(it.name)}</a>`
        : `<span class="eaa-r-iname">${esc(it.name)}</span>`;
      return `<li class="${it.state}"><i aria-hidden="true"></i>${link}<span class="eaa-r-istate">${STATE_LABEL[it.state!]}</span></li>`;
    })
    .join("");
  return (
    `<div class="eaa-r-acts" id="eaa-r-acts-${ou}" hidden>` +
    `<ul aria-label="${esc(`Atividades de ${name}`)}">${items}</ul>` +
    `<a class="eaa-r-gocourse" href="/d2l/home/${ou}">Abrir a disciplina</a></div>`
  );
}

function courseRow(d: PendingCourse, extra: boolean): string {
  const left = d.started ? `⚠ ${plural(d.started, "não enviada", "não enviadas")}` : `${d.pending} a fazer`;
  return (
    `<li${extra ? ` class="eaa-r-extra"` : ""} data-ou="${d.ou}">` +
    `<button type="button" class="eaa-r-course${d.started ? " started" : ""}" aria-expanded="false" aria-controls="eaa-r-acts-${d.ou}" title="${esc(d.name)}">` +
    `<span class="eaa-r-cname">${esc(shortName(d.name))}</span>` +
    segments(d.items, "eaa-r-cseg") +
    `<span class="eaa-r-cleft">${left}</span>${CHEVRON}</button>` +
    activityList(d.ou, d.name, d.items) +
    `</li>`
  );
}

function setRowOpen(li: Element, open: boolean): void {
  li.querySelector(".eaa-r-course")?.setAttribute("aria-expanded", String(open));
  li.querySelector(".eaa-r-acts")?.toggleAttribute("hidden", !open);
}

function courseList(courses: PendingCourse[]): string {
  if (!courses.length) return "";
  const shown = rowsShown(courses.length);
  const hidden = courses.length - shown;
  return (
    `<ul class="eaa-r-courses" aria-label="Disciplinas com atividade a fazer">` +
    courses.map((d, i) => courseRow(d, i >= shown)).join("") +
    `</ul>` +
    (hidden
      ? `<button type="button" class="eaa-r-more" aria-expanded="false">` +
        `<span class="eaa-r-closed">Ver mais ${plural(hidden, "disciplina", "disciplinas")}</span>` +
        `<span class="eaa-r-open">Ver menos</span></button>`
      : "")
  );
}

const legend = (): string =>
  `<ul class="eaa-r-legend" aria-label="Legenda das cores">` +
  LEGEND.map(([state, label]) => `<li><i class="${state}"></i>${label}</li>`).join("") +
  `</ul>`;

const footer = (readAt: number | null, extraLeft = ""): string =>
  `<div class="eaa-r-pair eaa-r-footer"><span>${extraLeft}${readAt ? `Atualizado às ${formatTime(readAt)}` : "&nbsp;"}</span>` +
  `<button type="button" class="eaa-r-refresh" title="Ler de novo notas e entregas de todas as disciplinas"${readAt ? "" : " disabled"}>Atualizar</button></div>`;

function summaryHtml(res: Overall): string {
  const urgent = res.c.pending && daysUntil(res.deadline) <= 1;
  const right = !res.c.pending
    ? `<span class="eaa-r-tag graded">✓ tudo entregue</span>`
    : `<span class="eaa-r-tag${res.startedCount ? " started" : ""}">` +
      (res.startedCount ? `⚠ ${plural(res.startedCount, "não enviada", "não enviadas")} · ` : "") +
      `faltam ${res.c.pending}</span>`;
  return (
    `<div class="eaa-r-pair"><span class="eaa-r-title">${esc(res.longLabel)}</span>` +
    `<span class="eaa-r-when${urgent ? " urgent" : ""}">` +
    `${formatDate(res.deadline)} às ${formatTime(res.deadline)} · ${timeLeft(res.deadline, true)}</span></div>` +
    segments(res.c.items, "eaa-r-seg") +
    `<div class="eaa-r-pair eaa-r-caption"><span>${res.c.delivered} de ${res.c.items.length} atividades entregues</span>${right}</div>` +
    courseList(res.courses) +
    legend() +
    footer(res.readAt)
  );
}

function closingPill(c: ClosingCourse): string {
  const o = c.outcome;
  if (o.status === "approved") return `✓ ${o.label} · ${o.scoreText}`;
  if (o.status === "partial_passed") return `✓ Já passou · ${o.scoreText} parcial`;
  if (o.status === "partial_wait") return `${o.scoreText} parcial · ${c.awaiting ? `${c.awaiting} aguardando` : o.detail.split(" · ").pop()}`;
  if (o.status === "waiting") return `sem nota · ${c.awaiting ? `${c.awaiting} aguardando` : "pendente"}`;
  if (o.status === "recovery") return `${o.label} · ${o.scoreText}`;
  return `Reprovado · ${o.scoreText}`;
}

function closingRow(c: ClosingCourse, extra: boolean): string {
  return (
    `<li${extra ? ` class="eaa-r-extra"` : ""} data-ou="${c.ou}">` +
    `<button type="button" class="eaa-r-course closing" aria-expanded="false" aria-controls="eaa-r-acts-${c.ou}" title="${esc(c.name)}">` +
    `<span class="eaa-r-cname">${esc(shortName(c.name))}</span>` +
    segments(c.items, "eaa-r-cseg") +
    `<span class="eaa-r-pill ${c.status}">${esc(closingPill(c))}</span>${CHEVRON}</button>` +
    activityList(c.ou, c.name, c.items) +
    `</li>`
  );
}

/** Resumo de fim de semestre: quando não existem mais prazos futuros. */
function semesterSummaryHtml(visible: string[], state: HomeState): string | null {
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
  const allItems = courses.flatMap((c) => c.items);
  void allItems;
  const scores = courses.filter((c) => !c.outcome.partial && c.outcome.score !== null).map((c) => c.outcome.score as number);
  const avg = scores.length ? formatNum(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  /* 1 segmento por disciplina: verdes primeiro, depois âmbar, depois vermelho */
  const barRank = { graded: 0, awaiting: 1, missed: 2 } as const;
  const barClass = (c: ClosingCourse): keyof typeof barRank =>
    c.status === "approved" || c.status === "partial_passed" ? "graded" : c.status === "recovery" || c.status === "failed" ? "missed" : "awaiting";
  const courseBar =
    `<div class="eaa-seg eaa-r-seg" aria-hidden="true">` +
    [...courses]
      .sort((a, b) => barRank[barClass(a)] - barRank[barClass(b)])
      .map((c) => `<i class="${barClass(c)}" title="${esc(`${c.name} · ${closingPill(c)}`)}"></i>`)
      .join("") +
    `</div>`;

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
      : "Alguns percalços acontecem — confira o balanço abaixo para planejar os próximos passos.";
    badge = recovery ? `${guaranteed} garantidas · ${recovery} em Av3` : `${guaranteed}/${courses.length} aprovadas`;
  }

  const shown = allPassed ? 0 : rowsShown(courses.length);
  const hidden = courses.length - shown;
  const listHtml =
    `<ul class="eaa-r-courses" aria-label="Balanço das disciplinas">` +
    courses.map((c, i) => closingRow(c, i >= shown)).join("") +
    `</ul>` +
    (hidden
      ? `<button type="button" class="eaa-r-more" aria-expanded="false">` +
        `<span class="eaa-r-closed">${allPassed ? `Ver notas das ${courses.length} disciplinas` : `Ver mais ${plural(hidden, "disciplina", "disciplinas")}`}</span>` +
        `<span class="eaa-r-open">Ocultar lista</span></button>`
      : "");

  return (
    `<div class="eaa-r-banner${comfort ? " comfort" : ""}">` +
    `<div class="eaa-r-btext"><strong>${esc(headline)}</strong><span>${esc(sub)}</span></div>` +
    `<span class="eaa-r-bbadge">${esc(badge)}</span></div>` +
    (allPassed ? `<div class="eaa-r-notes-body">` : "") +
    courseBar +
    listHtml +
    (allPassed ? `</div>` : "") +
    footer(readAt)
  );
}

function loadingHtml(readyCount: number, total: number): string {
  const pct = total ? Math.round((readyCount / total) * 100) : 0;
  return (
    `<div class="eaa-r-pair"><span class="eaa-r-title">Próximo prazo</span>` +
    `<span class="eaa-r-when eaa-r-status" role="status">carregando ${readyCount} de ${total} disciplinas…</span></div>` +
    `<div class="eaa-r-progress" aria-hidden="true"><i style="width:${pct}%"></i></div>` +
    `<div class="eaa-r-pair eaa-r-caption"><span>Lendo notas e entregas no AVA</span><span></span></div>` +
    `<ul class="eaa-r-courses" aria-hidden="true">` +
    `<li><span class="eaa-r-course eaa-r-empty"><i style="width:176px"></i></span></li>` +
    `<li><span class="eaa-r-course eaa-r-empty"><i style="width:128px"></i></span></li></ul>` +
    legend() +
    footer(null)
  );
}

/** Chamado a cada varredura: cria, atualiza ou remove o painel geral. */
export function updateSummaryPanel(visible: string[], state: HomeState, onRefresh: () => void, hidden = false): void {
  const anchor = document.querySelector("d2l-my-courses-v2");
  if (!anchor?.parentNode) return;
  let box = document.getElementById(SUMMARY_ID);
  const hide = () => box?.remove();
  if (hidden || !visible.length) return hide();

  const missing = visible.filter((ou) => !state.resolved.has(ou)).length;
  if (!missing) state.loadStart = null;
  else state.loadStart ??= Date.now();
  const loading = missing > 0 && Date.now() - (state.loadStart ?? 0) < MAX_WAIT_MS;

  let fresh: string | null;
  let closingMode = false;
  if (loading) {
    fresh = loadingHtml(visible.length - missing, visible.length);
  } else {
    const res = overallSummary(visible, state);
    if (res && res.c.items.length) {
      fresh = summaryHtml(res);
    } else {
      fresh = semesterSummaryHtml(visible, state);
      closingMode = true;
    }
    if (!fresh) return hide();
  }

  if (!box) {
    box = document.createElement("section");
    box.id = SUMMARY_ID;
    box.setAttribute("aria-label", closingMode ? "Resumo do semestre" : "Próximo prazo das disciplinas");
    box.addEventListener("click", (ev) => {
      const target = ev.target as Element;
      const button = target.closest?.<HTMLButtonElement>(".eaa-r-refresh");
      if (button && !button.disabled) onRefresh();
      const more = target.closest?.(".eaa-r-more");
      if (more) {
        const open = (ev.currentTarget as HTMLElement).classList.toggle("expanded");
        more.setAttribute("aria-expanded", String(open));
      }
      const row = target.closest?.(".eaa-r-course")?.closest("li[data-ou]");
      if (row) {
        const ou = (row as HTMLElement).dataset.ou!;
        const open = !state.openRows.has(ou);
        if (open) state.openRows.add(ou);
        else state.openRows.delete(ou);
        setRowOpen(row, open);
      }
    });
  }
  box.setAttribute("aria-busy", String(loading));
  box.setAttribute("aria-label", closingMode ? "Resumo do semestre" : "Próximo prazo das disciplinas");
  if (box.nextSibling !== anchor) anchor.parentNode.insertBefore(box, anchor);
  if (box.dataset.html !== fresh) {
    box.dataset.html = fresh;
    box.innerHTML = fresh;
    box.querySelector(".eaa-r-more")?.setAttribute("aria-expanded", String(box.classList.contains("expanded")));
    for (const li of box.querySelectorAll<HTMLElement>("li[data-ou]")) setRowOpen(li, state.openRows.has(li.dataset.ou!));
  }
}
