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
import { escapeHtml as esc, formatNum } from "../../ava/format.ts";
import { highlight, isUrgent, standing } from "../../ava/rules.ts";
import type { CourseSummary, DeadlineGroup } from "../../ava/types.ts";
import { STATE_LABEL, segments, when } from "../shared/render.ts";
import { CARD_CSS } from "./card-styles.ts";
import type { HomeState } from "./state.ts";

const MARK = "eaa-prog";

function deadlineRow(g: DeadlineGroup): string {
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
    `<span class="eaa-val">${formatNum(r.av1)} / ${formatNum(r.av1Max)}</span></div>` +
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

function createBlock(kind: "ghost" | "real"): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `${MARK} ${kind}`;
  el.setAttribute("slot", "content");
  if (kind === "ghost") el.setAttribute("aria-hidden", "true");
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

  /* Simetria entre cards vizinhos: os títulos têm 1 a 3 linhas, então o
     bloco visível fica preso ao pé do card e uma cópia invisível (ghost)
     reserva a altura. */
  let ghost = d2lCard.querySelector<HTMLElement>(`.${MARK}.ghost`);
  let block = d2lCard.querySelector<HTMLElement>(`.${MARK}.real`);
  if (ghost && block && block.dataset.generation === String(state.generation)) return;

  /* Bloco que já existe (Atualizar): fica com o dado antigo até o novo
     chegar, para o card não encolher e crescer de novo. */
  if (!ghost || !block) {
    ghost?.remove();
    block?.remove();
    ensureStyle(shadow);
    ghost = createBlock("ghost");
    block = createBlock("real");
    ghost.innerHTML = block.innerHTML = `<span class="eaa-loading">Carregando progresso…</span>`;
    d2lCard.append(ghost, block);
  }
  const g = ghost;
  const b = block;
  const myGeneration = state.generation;
  b.dataset.generation = String(myGeneration);

  Promise.all([courseData(ou), courseName(ou)]).then(
    ([summary, name]) => {
      if (myGeneration !== state.generation) return;
      state.resolved.add(ou);
      if (!summary.total) {
        state.noBlock.add(ou);
        g.remove();
        b.remove();
        return;
      }
      state.ready.set(ou, { summary, name: name || "Disciplina" });
      g.innerHTML = b.innerHTML = cardHtml(summary);
    },
    (err) => {
      if (myGeneration !== state.generation) return;
      state.resolved.add(ou);
      state.noBlock.add(ou);
      g.remove();
      b.remove();
      console.warn(`[EAA+] progresso da disciplina ${ou}:`, err);
    }
  );
}
