/* Feature 1 — painel em cada card de "Minhas Disciplinas" (Estilo C).
 *
 * Mostra a síntese editorial (status + detalhe à esquerda, nota grande à
 * direita, sinalizando nota parcial e aprovação garantida mesmo parcial) e,
 * quando a disciplina ainda tem prazos em aberto ou pendências, as barras de
 * progresso por fechamento. Quando já está fechada e aprovada, oculta os
 * prazos antigos para manter o card limpo.
 */

import { courseData, courseName } from "../../ava/course-data.ts";
import { escapeHtml as esc, formatDate, formatNum, plural } from "../../ava/format.ts";
import { courseOutcome, hasGrade, highlight, isCleanResolved, isSettled, isUrgent, standing } from "../../ava/rules.ts";
import type { CourseSummary, DeadlineGroup } from "../../ava/types.ts";
import { STATE_LABEL, segments, when } from "../shared/render.ts";
import { CARD_CSS } from "./card-styles.ts";
import type { HomeState } from "./state.ts";

const MARK = "eaa-prog";

function settledRow(g: DeadlineGroup): string {
  const date = formatDate(g.deadline as number);
  const done = plural(g.c.graded, "corrigida", "corrigidas");
  return (
    `<div class="eaa-deadline closed settled" role="group" aria-label="${esc(`${g.shortLabel}, encerrado em ${date}: ${done}`)}">` +
    `<div class="eaa-pair"><span class="eaa-name">${esc(g.shortLabel)}</span>` +
    `<span class="eaa-tag graded">✓ ${done}</span></div>` +
    `</div>`
  );
}

function deadlineRow(g: DeadlineGroup): string {
  if (isSettled(g)) return settledRow(g);
  const h = highlight(g.c);
  const w = when(g);
  const closed = g.deadline !== null && g.deadline < Date.now();
  const ariaText = `${g.shortLabel}, ${w}: ` + g.c.items.map((it) => `${it.name} ${STATE_LABEL[it.state!]}`).join("; ");
  return (
    `<div class="eaa-deadline${closed ? " closed" : ""}${isUrgent(g) ? " urgent" : ""}" role="group" aria-label="${esc(ariaText)}">` +
    `<div class="eaa-pair"><span class="eaa-name">${esc(g.shortLabel)}</span><span class="eaa-when">${esc(w)}</span></div>` +
    segments(g.c.items) +
    `<div class="eaa-pair eaa-caption"><span>${g.c.delivered} de ${g.c.items.length} entregues</span>` +
    `<span class="eaa-tag ${h.tone}">${h.text}</span></div>` +
    `</div>`
  );
}

function classicCardHtml(r: CourseSummary): string {
  const s = standing(r);
  return (
    `<div class="eaa-pair eaa-head"><span class="eaa-label">${r.label}</span>` +
    (hasGrade(r)
      ? `<span class="eaa-val">${formatNum(r.av1)} / ${formatNum(r.av1Max)}</span></div>`
      : `<span class="eaa-val none">sem nota ainda</span></div>`) +
    r.deadlines.map(deadlineRow).join("") +
    (s ? `<div class="eaa-standing ${s.tone}">${s.text}</div>` : "")
  );
}

function editorialCardHtml(r: CourseSummary): string {
  const o = courseOutcome(r);
  const clean = isCleanResolved(r);
  const editorial =
    `<div class="eaa-ed ${o.status}">` +
    `<div class="eaa-ed-left">` +
    `<span class="eaa-ed-tag">${esc(o.label)}</span>` +
    `<span class="eaa-ed-sub" title="${esc(o.detail)}">${esc(o.detail)}</span>` +
    `</div>` +
    `<div class="eaa-ed-right">` +
    `<span class="eaa-ed-num">${esc(o.scoreText)}</span>` +
    (o.partial ? `<span class="eaa-ed-part">parcial</span>` : "") +
    `</div>` +
    `</div>`;
  if (clean) return editorial;
  const allClosed = r.deadlines.every((g) => g.deadline !== null && g.deadline < Date.now());
  if (allClosed && !r.c.pending && !r.c.missed) return editorial;
  return editorial + r.deadlines.map(deadlineRow).join("");
}

const cardHtml = (r: CourseSummary, wide: boolean): string => (wide ? editorialCardHtml(r) : classicCardHtml(r));

function ensureStyle(shadow: ShadowRoot): void {
  if (shadow.querySelector("style[data-eaa]")) return;
  const style = document.createElement("style");
  style.setAttribute("data-eaa", "");
  style.textContent = CARD_CSS;
  shadow.appendChild(style);
}

function createBlock(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = MARK;
  el.setAttribute("slot", "content");
  return el;
}

/** Monta (ou atualiza) o bloco de progresso de um card. */
export function renderCourseCard(card: Element, ou: string, state: HomeState, wide: boolean): void {
  if (state.noBlock.has(ou)) return;
  const shadow = card.shadowRoot;
  const d2lCard = shadow?.querySelector("d2l-card");
  if (!shadow || !d2lCard) return;
  if (!d2lCard.querySelector(".d2l-enrollment-card-content-flex")) return;

  let block = d2lCard.querySelector<HTMLElement>(`.${MARK}`);
  if (block && block.dataset.generation === String(state.generation) && block.dataset.wide === String(wide)) return;

  if (!block) {
    ensureStyle(shadow);
    block = createBlock();
    block.innerHTML = `<span class="eaa-loading">Carregando progresso…</span>`;
    d2lCard.append(block);
  }
  const b = block;
  const myGeneration = state.generation;
  b.dataset.generation = String(myGeneration);
  b.dataset.wide = String(wide);

  const cached = state.ready.get(ou);
  if (cached) {
    b.innerHTML = cardHtml(cached.summary, wide);
    return;
  }

  Promise.all([courseData(ou), courseName(ou)]).then(
    ([summary, name]) => {
      if (myGeneration !== state.generation) return;
      state.resolved.add(ou);
      if (!summary.total) {
        state.noBlock.add(ou);
        b.remove();
        return;
      }
      state.ready.set(ou, { summary, name: name || "Disciplina" });
      b.innerHTML = cardHtml(summary, b.dataset.wide === "true");
    },
    (err) => {
      if (myGeneration !== state.generation) return;
      state.resolved.add(ou);
      state.noBlock.add(ou);
      b.remove();
      console.warn(`[EAA+] progresso da disciplina ${ou}:`, err);
    }
  );
}

/** Os blocos de uma mesma fileira começam na mesma altura. */
export function alignBlocks(cards: Element[]): void {
  const rows = new Map<number, { block: HTMLElement; end: number }[]>();
  for (const card of cards) {
    const d2lCard = card.shadowRoot?.querySelector("d2l-card");
    const block = d2lCard?.querySelector<HTMLElement>(`.${MARK}`);
    const title = d2lCard?.querySelector(".d2l-enrollment-card-content-flex");
    if (!block || !title) continue;
    const top = card.getBoundingClientRect().top;
    const row = Math.round(top);
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row)!.push({ block, end: title.getBoundingClientRect().bottom - top });
  }
  for (const row of rows.values()) {
    const max = Math.max(...row.map((r) => r.end));
    for (const { block, end } of row) {
      const shift = `${Math.round(max - end)}px`;
      if (block.style.getPropertyValue("--eaa-shift") !== shift) block.style.setProperty("--eaa-shift", shift);
    }
  }
}
