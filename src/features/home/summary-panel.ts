/* Feature 2 — painel geral, acima dos cards.
 *
 * Durante o semestre, mostra o próximo fechamento comum às disciplinas
 * visíveis. Quando todos os prazos já encerraram (fim do semestre), muda para
 * o resumo de fechamento: balanço comemorativo ou acolhedor, notas finais e
 * parciais, sinalização de aprovação garantida mesmo parcial e matérias que
 * ainda aguardam correção do professor.
 *
 * Aqui estão o desenho do layout clássico e a escolha entre ele e o do Layout
 * Amplo (summary-wide.ts).
 */

import { daysUntil, escapeHtml as esc, formatDate, formatTime, plural, timeLeft } from "../../ava/format.ts";
import { rowsShown } from "../../ava/rules.ts";
import { segments } from "../shared/render.ts";
import type { HomeState } from "./state.ts";
import { CHEVRON, activityList, closingPill, closingSummary, legend, overallSummary, shortName } from "./summary-data.ts";
import type { ClosingCourse, Overall, PendingCourse } from "./summary-data.ts";
import { balanceColumns, setWideRow, wideClosingHtml, wideLoadingHtml, wideSummaryHtml } from "./summary-wide.ts";

const SUMMARY_ID = "eaa-summary";
/** Outro id: o CSS de um desenho não alcança o outro. */
const WIDE_ID = "eaa-summary-wide";
const MAX_WAIT_MS = 20_000;

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
  const data = closingSummary(visible, state, "abaixo");
  if (!data) return null;
  const { courses, headline, sub, badge, comfort, allPassed, readAt } = data;
  const courseBar =
    `<div class="eaa-seg eaa-r-seg" aria-hidden="true">` +
    data.parts.map((p) => `<i class="${p.cls}" title="${esc(p.title)}"></i>`).join("") +
    `</div>`;

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

/** Layout Amplo: uma linha aberta por vez; a lista rolada fica onde estava
 *  quando o painel é reescrito. */
function writeWide(box: HTMLElement, html: string, state: HomeState): void {
  const openList = () => box.querySelector(".eaa-r-acts:not([hidden]) ul");
  const scrolled = openList()?.scrollTop ?? 0;
  box.innerHTML = html;
  balanceColumns(box);
  setWideRow(box, state.openRow);
  const list = openList();
  if (list) list.scrollTop = scrolled;
}

function createBox(wide: boolean, state: HomeState, onRefresh: () => void): HTMLElement {
  const box = document.createElement("section");
  box.id = wide ? WIDE_ID : SUMMARY_ID;
  box.addEventListener("click", (ev) => {
    const target = ev.target as Element;
    const button = target.closest?.<HTMLButtonElement>(".eaa-r-refresh");
    if (button && !button.disabled) onRefresh();
    const more = target.closest?.(".eaa-r-more");
    if (more) {
      const open = box.classList.toggle("expanded");
      more.setAttribute("aria-expanded", String(open));
      if (wide) balanceColumns(box);
    }
    const row = target.closest?.(".eaa-r-course")?.closest<HTMLElement>("li[data-ou]");
    if (row) {
      const ou = row.dataset.ou!;
      if (wide) {
        state.openRow = state.openRow === ou ? null : ou;
        setWideRow(box, state.openRow);
        return;
      }
      const open = !state.openRows.has(ou);
      if (open) state.openRows.add(ou);
      else state.openRows.delete(ou);
      setRowOpen(row, open);
    }
  });
  return box;
}

/** Chamado a cada varredura: cria, atualiza ou remove o painel geral. */
export function updateSummaryPanel(visible: string[], state: HomeState, onRefresh: () => void, hidden = false, wide = false): void {
  const anchor = document.querySelector("d2l-my-courses-v2");
  if (!anchor?.parentNode) return;
  /* trocou o layout: o painel do outro desenho sai */
  document.getElementById(wide ? SUMMARY_ID : WIDE_ID)?.remove();
  let box = document.getElementById(wide ? WIDE_ID : SUMMARY_ID);
  const hide = () => box?.remove();
  if (hidden || !visible.length) return hide();

  const missing = visible.filter((ou) => !state.resolved.has(ou)).length;
  if (!missing) state.loadStart = null;
  else state.loadStart ??= Date.now();
  const loading = missing > 0 && Date.now() - (state.loadStart ?? 0) < MAX_WAIT_MS;

  let fresh: string | null;
  let closingMode = false;
  if (loading) {
    fresh = wide ? wideLoadingHtml(visible, state) : loadingHtml(visible.length - missing, visible.length);
  } else {
    const res = overallSummary(visible, state);
    if (res && res.c.items.length) {
      fresh = (wide ? wideSummaryHtml : summaryHtml)(res);
    } else {
      fresh = (wide ? wideClosingHtml : semesterSummaryHtml)(visible, state);
      closingMode = true;
    }
    if (!fresh) return hide();
  }

  box ??= createBox(wide, state, onRefresh);
  box.classList.toggle("closing", wide && closingMode);
  box.setAttribute("aria-busy", String(loading));
  box.setAttribute("aria-label", closingMode ? "Resumo do semestre" : "Próximo prazo das disciplinas");
  if (box.nextSibling !== anchor) anchor.parentNode.insertBefore(box, anchor);
  if (box.dataset.html !== fresh) {
    box.dataset.html = fresh;
    if (wide) writeWide(box, fresh, state);
    else {
      box.innerHTML = fresh;
      for (const li of box.querySelectorAll<HTMLElement>("li[data-ou]")) setRowOpen(li, state.openRows.has(li.dataset.ou!));
    }
    box.querySelector(".eaa-r-more")?.setAttribute("aria-expanded", String(box.classList.contains("expanded")));
  }
}
