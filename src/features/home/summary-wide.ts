/* Painel geral do Layout Amplo: baixo, para sobrar tela para os cards. Anel de
 * progresso e texto à esquerda, disciplinas em 2 colunas à direita, uma aberta
 * por vez. Estilo em styles/summary-wide.css; o clássico é summary-panel.ts. */

import { daysUntil, escapeHtml as esc, formatDate, formatTime, plural, timeLeft } from "../../ava/format.ts";
import { ROWS_WIDE, columnSplit, rowsShown } from "../../ava/rules.ts";
import { STATE_LABEL } from "../shared/render.ts";
import { ring } from "./ring.ts";
import type { HomeState } from "./state.ts";
import { CHEVRON, activityList, closingPill, closingSummary, legend, shortName } from "./summary-data.ts";
import type { ClosingCourse, Overall, PendingCourse } from "./summary-data.ts";

/** Atividades à vista na linha aberta; acima disso a lista rola. */
const ACTS_SHOWN = 5;

/** `extra` some quando o painel é estreito e `over` sempre, até o "Ver mais". */
const rowClass = (i: number, n: number): string => {
  const cls = [i >= rowsShown(n) ? "eaa-r-extra" : "", i >= ROWS_WIDE ? "eaa-r-over" : ""].filter(Boolean).join(" ");
  return cls ? ` class="${cls}"` : "";
};

/** Linha de uma disciplina: nome | situação | seta, e as atividades dela.
 *  Com rolagem, a lista precisa receber o foco para rolar pelo teclado. */
const row = (c: { ou: string; name: string; items: PendingCourse["items"] }, cls: string, buttonCls: string, status: string): string =>
  `<li${cls} data-ou="${c.ou}">` +
  `<button type="button" class="eaa-r-course${buttonCls}" aria-expanded="false" aria-controls="eaa-r-acts-${c.ou}" title="${esc(c.name)}">` +
  `<span class="eaa-r-cname">${esc(shortName(c.name))}</span>${status}${CHEVRON}</button>` +
  activityList(c.ou, c.name, c.items, c.items.length > ACTS_SHOWN ? ` tabindex="0"` : "") +
  `</li>`;

const courseRow = (d: PendingCourse, cls: string): string => {
  const left = d.started ? `⚠ ${plural(d.started, "não enviada", "não enviadas")}` : `${d.pending} a fazer`;
  return row(d, cls, d.started ? " started" : "", `<span class="eaa-r-cleft">${left}</span>`);
};

const closingRow = (c: ClosingCourse, cls: string): string => {
  const pill = esc(closingPill(c));
  return row(c, cls, " closing", `<span class="eaa-r-pill ${c.status}" title="${pill}">${pill}</span>`);
};

export function setWideRow(box: Element, openOu: string | null): void {
  for (const li of box.querySelectorAll<HTMLElement>("li[data-ou]")) {
    const open = li.dataset.ou === openOu;
    li.querySelector(".eaa-r-course")?.setAttribute("aria-expanded", String(open));
    li.querySelector(".eaa-r-acts")?.toggleAttribute("hidden", !open);
  }
}

/** Divide as linhas à vista entre as colunas; muda com o "Ver mais". */
export function balanceColumns(box: Element): void {
  const [first, second] = box.querySelectorAll(".eaa-r-col");
  if (!first || !second) return;
  const rows = [...box.querySelectorAll("li[data-ou]")];
  const split = columnSplit(rows.length, box.classList.contains("expanded"));
  first.append(...rows.slice(0, split));
  second.append(...rows.slice(split));
}

/** Duas listas independentes: abrir uma linha não mexe na outra coluna. Com
 *  uma linha só, não há segunda lista (o leitor de tela anunciaria vazia). */
function columns(rows: string[], label: string): string {
  const split = columnSplit(rows.length);
  return (
    `<div class="eaa-r-courses" role="group" aria-label="${label}">` +
    [rows.slice(0, split), rows.slice(split)]
      .filter((c) => c.length)
      .map((c) => `<ul class="eaa-r-col">${c.join("")}</ul>`)
      .join("") +
    `</div>`
  );
}

const moreButton = (closed: string, open: string, cls = ""): string =>
  `<button type="button" class="eaa-r-more${cls}" aria-expanded="false">` +
  `<span class="eaa-r-closed">${closed}</span><span class="eaa-r-open">${open}</span></button>`;

/** "Ver mais" só onde há linha escondida; sem número, que muda com a largura. */
const hiddenRowsButton = (n: number): string =>
  n > rowsShown(n) ? moreButton("Ver mais disciplinas", "Ver menos", n > ROWS_WIDE ? "" : " narrow-only") : "";

const footer = (readAt: number | null): string =>
  `<div class="eaa-r-footer"><span>${readAt ? `Atualizado às ${formatTime(readAt)}` : "&nbsp;"}</span>` +
  legend() +
  `<button type="button" class="eaa-r-refresh" title="Ler de novo notas e entregas de todas as disciplinas"${readAt ? "" : " disabled"}>Atualizar</button></div>`;

/** Moldura dos três modos: anel e texto à esquerda; à direita a lista e, sob
 *  ela, o rodapé (ao lado do anel, para não gastar uma faixa inteira). */
const frame = (circle: string, text: string, body: string, readAt: number | null, sideClass = ""): string =>
  `<div class="eaa-r-main"><div class="eaa-r-side${sideClass}">${circle}<div class="eaa-r-stext">${text}</div></div>` +
  `<div class="eaa-r-body">${body}</div>` +
  footer(readAt) +
  `</div>`;

export function wideSummaryHtml(res: Overall): string {
  const urgent = res.c.pending && daysUntil(res.deadline) <= 1;
  const tag = !res.c.pending
    ? `<span class="eaa-r-tag graded">✓ tudo entregue</span>`
    : `<span class="eaa-r-tag${res.startedCount ? " started" : ""}">` +
      (res.startedCount ? `⚠ ${plural(res.startedCount, "não enviada", "não enviadas")} · ` : "") +
      `faltam ${res.c.pending}</span>`;
  const rows = res.courses.map((d, i) => courseRow(d, rowClass(i, res.courses.length)));
  return frame(
    ring(
      res.c.items.map((it) => ({ cls: it.state!, title: `${it.name} · ${STATE_LABEL[it.state!]}` })),
      `${res.c.delivered}/${res.c.items.length}`,
      "entregues",
      `${res.c.delivered} de ${res.c.items.length} atividades entregues`
    ),
    `<span class="eaa-r-title">${esc(res.longLabel)}</span>` +
      `<span class="eaa-r-when${urgent ? " urgent" : ""}">` +
      `${formatDate(res.deadline)} às ${formatTime(res.deadline)} · ${timeLeft(res.deadline, true)}</span>` +
      tag,
    rows.length ? columns(rows, "Disciplinas com atividade a fazer") + hiddenRowsButton(rows.length) : "",
    res.readAt
  );
}

export function wideClosingHtml(visible: string[], state: HomeState): string | null {
  const data = closingSummary(visible, state, "de cada disciplina");
  if (!data) return null;
  const { courses, headline, sub, comfort, allPassed, guaranteed, recovery } = data;

  /* tudo aprovado: a lista começa escondida, para o painel ficar menor */
  const rows = courses.map((c, i) => closingRow(c, allPassed ? "" : rowClass(i, courses.length)));
  const list = columns(rows, "Balanço das disciplinas");
  const body = allPassed
    ? `<div class="eaa-r-notes-body">${list}</div>` + moreButton(`Ver notas das ${courses.length} disciplinas`, "Ocultar lista")
    : list + hiddenRowsButton(courses.length);

  const unit = allPassed || (comfort && !recovery) ? "aprovadas" : "garantidas";
  return frame(
    ring(data.parts, `${guaranteed}/${courses.length}`, unit, `${guaranteed} de ${courses.length} disciplinas ${unit}`),
    `<strong class="eaa-r-title">${esc(headline)}</strong><span class="eaa-r-sub">${esc(sub)}</span>`,
    body,
    data.readAt,
    comfort ? " comfort" : ""
  );
}

/** Larguras variadas para o esqueleto não parecer uma grade. */
const BONE_WIDTHS = [172, 214, 128, 190, 150];

/** Linha do carregamento, no lugar onde a da disciplina vai ficar: esqueleto
 *  até o AVA responder, depois o nome com um visto. */
function loadingRow(ou: string, i: number, n: number, state: HomeState): string {
  const cls = ["eaa-r-load", i >= rowsShown(n) ? "eaa-r-extra" : "", i >= ROWS_WIDE ? "eaa-r-over" : ""];
  const done = state.resolved.has(ou);
  if (done) cls.push("done");
  const name = state.ready.get(ou)?.name;
  const content = done
    ? `<span class="eaa-r-cname">${name ? esc(shortName(name)) : "Disciplina sem avaliações"}</span><span class="eaa-r-check">✓</span>`
    : `<i class="eaa-r-bone" style="width:${BONE_WIDTHS[i % BONE_WIDTHS.length]}px"></i><i class="eaa-r-bone pill"></i>`;
  return `<li class="${cls.filter(Boolean).join(" ")}"><span class="eaa-r-course">${content}</span></li>`;
}

export function wideLoadingHtml(visible: string[], state: HomeState): string {
  const total = visible.length;
  const readyCount = visible.filter((ou) => state.resolved.has(ou)).length;
  const parts = Array.from({ length: total }, (_, i) => ({ cls: i < readyCount ? "loaded" : "waiting", title: "" }));
  const rows = visible.map((ou, i) => loadingRow(ou, i, total, state));
  return frame(
    /* sem rótulo: o status ao lado já diz a contagem ao leitor de tela */
    ring(parts, `${readyCount}/${total}`, "lidas", ""),
    `<span class="eaa-r-title">Lendo o AVA</span>` +
      `<span class="eaa-r-status" role="status">${readyCount} de ${total} disciplinas lidas</span>`,
    /* o leitor de tela fica só com o status */
    `<div aria-hidden="true">${columns(rows, "Carregando")}</div>`,
    null
  );
}
