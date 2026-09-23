/* Feature 2 — painel geral, acima dos cards.
 *
 * O próximo fechamento comum às disciplinas visíveis: quantas atividades já
 * foram entregues, em quais disciplinas ainda falta algo (fichas com link),
 * a legenda das cores e a hora dos dados, com o botão Atualizar.
 *
 * Onde: DOM normal, logo antes de d2l-my-courses-v2 (CSS em
 * styles/summary-panel.css, vindo do manifest).
 */

import { dayOf, daysUntil, escapeHtml as esc, formatDate, formatTime, plural, timeLeft } from "../../ava/format.ts";
import { tally } from "../../ava/rules.ts";
import type { Activity, Tally } from "../../ava/types.ts";
import { LEGEND, segments } from "../shared/render.ts";
import type { HomeState } from "./state.ts";

const SUMMARY_ID = "eaa-summary";
/** Depois disso mostra o que tiver, em vez de girar para sempre por causa de
 *  uma disciplina que não responde. */
const MAX_WAIT_MS = 20_000;

interface PendingCourse {
  ou: string;
  name: string;
  pending: number;
  started: number;
}

interface Overall {
  deadline: number;
  longLabel: string;
  items: Activity[];
  courses: PendingCourse[];
  startedCount: number;
  /** o dado mais antigo na tela (cache de até 10 min) */
  readAt: number | null;
  c: Tally;
}

/** Junta, de todas as disciplinas visíveis, os grupos do dia do próximo
 *  prazo futuro. null = nenhum prazo pela frente. */
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
      if (g.c.pending) res.courses.push({ ou, name, pending: g.c.pending, started: g.c.started });
    }
  }
  return { ...res, longLabel: res.longLabel || "Próximo prazo", c: tally(res.items) };
}

/** "Técnica Vocal I: Fundamentos" → "Técnica Vocal I" */
function shortName(name: string): string {
  const before = name.split(":")[0].trim();
  return before.length >= 3 ? before : name;
}

/** Uma legenda só, no resumo (os cards não têm largura para ela). */
const legend = (): string =>
  `<ul class="eaa-r-legend" aria-label="Legenda das cores">` +
  LEGEND.map(([state, label]) => `<li><i class="${state}"></i>${label}</li>`).join("") +
  `</ul>`;

/** Os dados podem vir do cache (até 10 min): a idade fica à vista e o aluno
 *  força uma leitura nova com um clique. Mesma linha no carregamento, para a
 *  altura não pular. */
const footer = (readAt: number | null): string =>
  `<div class="eaa-r-pair eaa-r-footer"><span>${readAt ? `Atualizado às ${formatTime(readAt)}` : "&nbsp;"}</span>` +
  `<button type="button" class="eaa-r-refresh" title="Ler de novo notas e entregas de todas as disciplinas"${readAt ? "" : " disabled"}>Atualizar</button></div>`;

function summaryHtml(res: Overall): string {
  const urgent = res.c.pending && daysUntil(res.deadline) <= 1;
  const right = !res.c.pending
    ? `<span class="eaa-r-tag graded">✓ tudo entregue</span>`
    : `<span class="eaa-r-tag${res.startedCount ? " started" : ""}">` +
      (res.startedCount ? `⚠ ${plural(res.startedCount, "não enviada", "não enviadas")} · ` : "") +
      `faltam ${res.c.pending}</span>`;
  const chips = res.courses
    .map(
      (d) =>
        `<a class="eaa-r-chip${d.started ? " started" : ""}" href="/d2l/home/${d.ou}" title="${esc(d.name)}">` +
        `<span class="eaa-r-cname">${esc(shortName(d.name))}</span><span class="eaa-r-cnum">${d.pending}</span></a>`
    )
    .join("");
  return (
    `<div class="eaa-r-pair"><span class="eaa-r-title">${esc(res.longLabel)}</span>` +
    `<span class="eaa-r-when${urgent ? " urgent" : ""}">` +
    `${formatDate(res.deadline)} às ${formatTime(res.deadline)} · ${timeLeft(res.deadline, true)}</span></div>` +
    segments(res.c.items, "eaa-r-seg") +
    `<div class="eaa-r-pair eaa-r-caption"><span>${res.c.delivered} de ${res.c.items.length} atividades entregues</span>${right}</div>` +
    (chips ? `<div class="eaa-r-chips">${chips}</div>` : "") +
    legend() +
    footer(res.readAt)
  );
}

/** Enquanto houver disciplina visível sem resposta, o resumo fica em
 *  carregamento: somar só as que chegaram mostraria números errados
 *  ("faltam 2", depois "faltam 5"). A moldura e as linhas são as mesmas do
 *  resultado, para nada pular quando terminar. */
function loadingHtml(readyCount: number, total: number): string {
  const pct = total ? Math.round((readyCount / total) * 100) : 0;
  return (
    `<div class="eaa-r-pair"><span class="eaa-r-title">Próximo prazo</span>` +
    `<span class="eaa-r-when eaa-r-status" role="status">carregando ${readyCount} de ${total} disciplinas…</span></div>` +
    `<div class="eaa-r-progress" aria-hidden="true"><i style="width:${pct}%"></i></div>` +
    `<div class="eaa-r-pair eaa-r-caption"><span>Lendo notas e entregas no AVA</span><span></span></div>` +
    `<div class="eaa-r-chips" aria-hidden="true">` +
    `<span class="eaa-r-chip eaa-r-empty" style="width:128px"></span>` +
    `<span class="eaa-r-chip eaa-r-empty" style="width:96px"></span>` +
    `<span class="eaa-r-chip eaa-r-empty" style="width:152px"></span></div>` +
    legend() +
    footer(null)
  );
}

/** Chamado a cada varredura: cria, atualiza ou remove o painel geral. */
export function updateSummaryPanel(visible: string[], state: HomeState, onRefresh: () => void): void {
  const anchor = document.querySelector("d2l-my-courses-v2");
  if (!anchor?.parentNode) return;
  let box = document.getElementById(SUMMARY_ID);
  const hide = () => box?.remove();
  if (!visible.length) return hide();

  const missing = visible.filter((ou) => !state.resolved.has(ou)).length;
  if (!missing) state.loadStart = null;
  else state.loadStart ??= Date.now();
  const loading = missing > 0 && Date.now() - (state.loadStart ?? 0) < MAX_WAIT_MS;

  let fresh: string;
  if (loading) {
    fresh = loadingHtml(visible.length - missing, visible.length);
  } else {
    const res = overallSummary(visible, state);
    if (!res || !res.c.items.length) return hide();
    fresh = summaryHtml(res);
  }

  if (!box) {
    box = document.createElement("section");
    box.id = SUMMARY_ID;
    box.setAttribute("aria-label", "Próximo prazo das disciplinas");
    box.addEventListener("click", (ev) => {
      const button = (ev.target as Element).closest?.<HTMLButtonElement>(".eaa-r-refresh");
      if (button && !button.disabled) onRefresh();
    });
  }
  box.setAttribute("aria-busy", String(loading));
  if (box.nextSibling !== anchor) anchor.parentNode.insertBefore(box, anchor);
  /* só reescreve se mudou: a varredura roda a cada segundo */
  if (box.dataset.html !== fresh) {
    box.dataset.html = fresh;
    box.innerHTML = fresh;
  }
}
