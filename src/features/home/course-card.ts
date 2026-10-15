/* Feature 1 — painel em cada card de "Minhas Disciplinas".
 *
 * A nota da Av1 e, para cada prazo (no curso de Música a Av1 fecha em duas
 * datas), uma barra com um bloco por atividade e o estado mais importante
 * daquele prazo; embaixo, a situação pela regra do manual.
 *
 * Onde: dentro do shadow DOM do card (d2l-my-courses-enrollment-card →
 * d2l-card, slot "content"). O CSS do manifest não atravessa shadow DOM,
 * então o estilo vai num <style data-eaa> dentro do próprio card.
 */

import { courseData, courseName } from "../../ava/course-data.ts";
import { escapeHtml as esc, formatDate, formatNum, plural } from "../../ava/format.ts";
import { hasGrade, highlight, isSettled, isUrgent, standing } from "../../ava/rules.ts";
import type { CourseSummary, DeadlineGroup } from "../../ava/types.ts";
import { STATE_LABEL, segments, when } from "../shared/render.ts";
import { CARD_CSS } from "./card-styles.ts";
import type { HomeState } from "./state.ts";

const MARK = "eaa-prog";

/** Prazo encerrado e todo corrigido: uma linha só ("1º Fechamento   ✓ 2
 *  corrigidas"), para o card dar o espaço ao que ainda está aberto. A data
 *  fica só no aria-label: com ela, o nome do prazo não cabia no card. */
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

function cardHtml(r: CourseSummary): string {
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

/** Monta (ou atualiza, depois do Atualizar) o bloco de progresso de um card.
 *  Chamado a cada varredura; não faz nada se o bloco já está em dia. */
export function renderCourseCard(card: Element, ou: string, state: HomeState): void {
  if (state.noBlock.has(ou)) return;
  const shadow = card.shadowRoot;
  const d2lCard = shadow?.querySelector("d2l-card");
  if (!shadow || !d2lCard) return;
  if (!d2lCard.querySelector(".d2l-enrollment-card-content-flex")) return; /* ainda montando */

  let block = d2lCard.querySelector<HTMLElement>(`.${MARK}`);
  if (block && block.dataset.generation === String(state.generation)) return;

  /* Bloco que já existe (Atualizar): fica com o dado antigo até o novo
     chegar, para o card não encolher e crescer de novo. */
  if (!block) {
    ensureStyle(shadow);
    block = createBlock();
    block.innerHTML = `<span class="eaa-loading">Carregando progresso…</span>`;
    d2lCard.append(block);
  }
  const b = block;
  const myGeneration = state.generation;
  b.dataset.generation = String(myGeneration);

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
      b.innerHTML = cardHtml(summary);
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

/** Os blocos de uma mesma fileira começam na mesma altura: os títulos têm 1
 *  a 3 linhas, então o bloco de título curto desce o que falta (--eaa-shift)
 *  e o espaço que sobra fica no pé do card. O título não estica (flex-grow 0,
 *  conferido no AVA), então descer o bloco não muda o que é medido. */
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
  /* mede tudo antes de escrever: escrever no meio mudaria as fileiras de baixo */
  for (const row of rows.values()) {
    const max = Math.max(...row.map((r) => r.end));
    for (const { block, end } of row) {
      const shift = `${Math.round(max - end)}px`;
      if (block.style.getPropertyValue("--eaa-shift") !== shift) block.style.setProperty("--eaa-shift", shift);
    }
  }
}
