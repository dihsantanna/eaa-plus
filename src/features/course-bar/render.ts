/* Desenho da barra da disciplina e do painel que ela abre.
 *
 *   Av1        1º Fechamento   28/09   2º Fechamento   26/10    ⌄
 *   2,5 / 5,0  ▮▮▯▯                    ▯▯▯▯
 *              1 de 4 entregues 5 dias 0 de 4 entregues 33 dias
 */

import { escapeHtml as esc, formatDate, formatNum, formatTime, timeLeft } from "../../ava/format.ts";
import { highlight, isUrgent, standing } from "../../ava/rules.ts";
import type { CourseSummary, DeadlineGroup, Preview } from "../../ava/types.ts";
import { STATE_LABEL, segments, when } from "../shared/render.ts";

const MAX_COLUMNS = 2;

const CHEVRON =
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ` +
  `stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<path d="M6 9l6 6 6-6"/></svg>`;

/** No máximo duas colunas: a próxima em aberto e a seguinte; se todas já
 *  passaram, as duas últimas. */
function columns(r: CourseSummary, now = Date.now()): DeadlineGroup[] {
  const dated = r.deadlines.filter((g) => g.deadline);
  if (dated.length <= MAX_COLUMNS) return r.deadlines.slice(0, MAX_COLUMNS);
  let i = dated.findIndex((g) => (g.deadline as number) >= now);
  if (i < 0) i = dated.length;
  i = Math.min(i, dated.length - MAX_COLUMNS);
  return dated.slice(i, i + MAX_COLUMNS);
}

function column(g: DeadlineGroup): string {
  const h = highlight(g.c);
  const alert = g.c.started ? `<span class="eaa-d-alert" aria-hidden="true">⚠</span>` : "";
  const days = g.deadline ? timeLeft(g.deadline) : "";
  const cls =
    "eaa-d-col" +
    (g.deadline && g.deadline < Date.now() ? " closed" : "") +
    (isUrgent(g) ? " urgent" : "") +
    (g.c.started ? " started" : "");
  return (
    `<span class="${cls}">` +
    `<span class="eaa-d-pair"><span class="eaa-d-name">${esc(g.shortLabel)}</span>` +
    `<span class="eaa-d-date">${alert}${g.deadline ? formatDate(g.deadline) : "—"}</span></span>` +
    segments(g.c.items) +
    `<span class="eaa-d-pair eaa-d-caption"><span>${g.c.delivered} de ${g.c.items.length} entregues</span>` +
    `<span class="eaa-d-days">${esc(days)}</span></span>` +
    `<span class="eaa-d-hidden">${esc(h.text)}</span>` +
    `</span>`
  );
}

const ariaText = (r: CourseSummary, cols: DeadlineGroup[]): string =>
  `Progresso das avaliações. ${r.label}: ${formatNum(r.av1)} de ${formatNum(r.av1Max)}. ` +
  cols.map((g) => `${g.shortLabel}, ${when(g)}: ${g.c.delivered} de ${g.c.items.length} entregues`).join(". ") +
  ". Abrir detalhes.";

/** O painel: cada prazo com suas atividades (cor, nome com link, estado). */
function panel(r: CourseSummary): string {
  const s = standing(r);
  const groups = r.deadlines
    .map((g) => {
      const title = g.longLabel === "Próximo prazo" ? g.shortLabel : g.longLabel;
      const date = g.deadline
        ? `${formatDate(g.deadline)} às ${formatTime(g.deadline)} · ${timeLeft(g.deadline, true)}`
        : "sem data";
      const items = g.c.items
        .map((it) => {
          const name = it.link
            ? `<a class="eaa-d-iname" href="${esc(it.link)}">${esc(it.name)}</a>`
            : `<span class="eaa-d-iname">${esc(it.name)}</span>`;
          return `<li class="${it.state}"><i aria-hidden="true"></i>${name}<span class="eaa-d-state">${STATE_LABEL[it.state!]}</span></li>`;
        })
        .join("");
      return `<section class="eaa-d-group"><h3 class="eaa-d-ghead"><span>${esc(title)}</span><span>${date}</span></h3><ul>${items}</ul></section>`;
    })
    .join("");
  return (
    `<div class="eaa-d-phead"><span>Avaliações da disciplina</span>` +
    `<span class="eaa-d-pgrade">${r.label} · ${formatNum(r.av1)} / ${formatNum(r.av1Max)}</span></div>` +
    groups +
    (s ? `<div class="eaa-d-standing ${s.tone}">${s.text}</div>` : "")
  );
}

/** Barra pronta: botão (nota + colunas) e o painel, fechado. */
export function barHtml(r: CourseSummary): string {
  const cols = columns(r);
  return (
    `<button type="button" class="eaa-d-button" aria-expanded="false" aria-controls="eaa-d-panel" aria-label="${esc(ariaText(r, cols))}">` +
    `<span class="eaa-d-grade"><span class="eaa-d-label">${r.label}</span>` +
    `<span class="eaa-d-val">${formatNum(r.av1)} / ${formatNum(r.av1Max)}</span></span>` +
    cols.map(column).join("") +
    `<span class="eaa-d-arrow">${CHEVRON}</span>` +
    `</button>` +
    `<div class="eaa-d-panel" id="eaa-d-panel" role="region" aria-label="Avaliações da disciplina" hidden>${panel(r)}</div>`
  );
}

const empty = (width: number): string => `<span class="eaa-d-empty" style="width:${width}px"></span>`;

/** Carregando: mesma largura e mesmas colunas do resultado, com blocos
 *  neutros no lugar do texto e o botão desativado. O número de colunas e o
 *  rótulo vêm da prévia (o boletim, primeira leitura da fila): com "Nota AV1"
 *  são 2 colunas, sem, 1 — assim o resultado entra sem mudar de largura. */
export function loadingHtml(p: Preview): string {
  const col = (name: string) =>
    `<span class="eaa-d-col">` +
    `<span class="eaa-d-pair"><span class="eaa-d-name">${name}</span>${empty(32)}</span>` +
    `<div class="eaa-seg" aria-hidden="true"><i></i></div>` +
    `<span class="eaa-d-pair eaa-d-caption">${empty(88)}${empty(32)}</span>` +
    `</span>`;
  return (
    `<button type="button" class="eaa-d-button" disabled aria-label="Carregando o progresso das avaliações">` +
    `<span class="eaa-d-grade"><span class="eaa-d-label">${p.label}</span><span class="eaa-d-val">${empty(56)}</span></span>` +
    col("carregando…") +
    (p.columns > 1 ? col(empty(80)) : "") +
    `<span class="eaa-d-arrow">${CHEVRON}</span>` +
    `</button>`
  );
}
