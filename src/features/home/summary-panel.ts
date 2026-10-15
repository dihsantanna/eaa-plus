/* Feature 2 — painel geral, acima dos cards.
 *
 * O próximo fechamento comum às disciplinas visíveis: quantas atividades já
 * foram entregues, em quais disciplinas ainda falta algo (uma linha por
 * disciplina, com a barra dela e o que falta; a linha abre e mostra cada
 * atividade com o estado e o link direto; a partir da 5ª disciplina, atrás de
 * "Ver mais"), a legenda das cores e a hora dos dados, com o botão Atualizar.
 *
 * Onde: DOM normal, logo antes de d2l-my-courses-v2 (CSS em
 * styles/summary-panel.css, vindo do manifest).
 */

import { dayOf, daysUntil, escapeHtml as esc, formatDate, formatTime, plural, timeLeft } from "../../ava/format.ts";
import { byUrgency, rowsShown, tally } from "../../ava/rules.ts";
import type { Activity, Tally } from "../../ava/types.ts";
import { LEGEND, STATE_LABEL, segments } from "../shared/render.ts";
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
  /** as atividades dela neste prazo (a barrinha da linha) */
  items: Activity[];
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
      if (!g.c.pending) continue;
      /* a Av1 e a Av2 de uma disciplina podem vencer no mesmo dia: uma linha só */
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

/** "Técnica Vocal I: Fundamentos" → "Técnica Vocal I" */
function shortName(name: string): string {
  const before = name.split(":")[0].trim();
  return before.length >= 3 ? before : name;
}

const CHEVRON =
  `<svg class="eaa-r-go" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ` +
  `stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;

/** Cada atividade da disciplina neste prazo, na mesma ordem da barrinha (o
 *  3º segmento é a 3ª linha): cor, nome com o link direto e o estado. Nada
 *  novo é lido do AVA — o link já vem com a atividade. */
function activityList(d: PendingCourse): string {
  const items = d.items
    .map((it) => {
      const name = it.link
        ? `<a class="eaa-r-iname" href="${esc(it.link)}">${esc(it.name)}</a>`
        : `<span class="eaa-r-iname">${esc(it.name)}</span>`;
      return `<li class="${it.state}"><i aria-hidden="true"></i>${name}<span class="eaa-r-istate">${STATE_LABEL[it.state!]}</span></li>`;
    })
    .join("");
  return (
    `<div class="eaa-r-acts" id="eaa-r-acts-${d.ou}" hidden>` +
    `<ul aria-label="${esc(`Atividades de ${d.name}`)}">${items}</ul>` +
    `<a class="eaa-r-gocourse" href="/d2l/home/${d.ou}">Abrir a disciplina</a></div>`
  );
}

/** Uma linha por disciplina com algo a fazer: nome, a barra dela neste prazo
 *  e o que falta. A linha é um botão que abre as atividades (activityList).
 *  As que passam do limite levam "eaa-r-extra" e só aparecem com "Ver mais". */
function courseRow(d: PendingCourse, extra: boolean): string {
  const left = d.started ? `⚠ ${plural(d.started, "não enviada", "não enviadas")}` : `${d.pending} a fazer`;
  return (
    `<li${extra ? ` class="eaa-r-extra"` : ""} data-ou="${d.ou}">` +
    `<button type="button" class="eaa-r-course${d.started ? " started" : ""}" aria-expanded="false" aria-controls="eaa-r-acts-${d.ou}" title="${esc(d.name)}">` +
    `<span class="eaa-r-cname">${esc(shortName(d.name))}</span>` +
    segments(d.items, "eaa-r-cseg") +
    `<span class="eaa-r-cleft">${left}</span>${CHEVRON}</button>` +
    activityList(d) +
    `</li>`
  );
}

/** Abre ou fecha a linha de uma disciplina (botão + lista). */
function setRowOpen(li: Element, open: boolean): void {
  li.querySelector(".eaa-r-course")?.setAttribute("aria-expanded", String(open));
  li.querySelector(".eaa-r-acts")?.toggleAttribute("hidden", !open);
}

/** O "Ver mais" não guarda nada: o AVA recarrega a página a cada clique, e
 *  lembrar a escolha pediria storage.local (disco). Aberto ou fechado é uma
 *  classe no próprio #eaa-summary, que sobrevive às reescritas do conteúdo. */
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
    `<ul class="eaa-r-courses" aria-hidden="true">` +
    `<li><span class="eaa-r-course eaa-r-empty"><i style="width:176px"></i></span></li>` +
    `<li><span class="eaa-r-course eaa-r-empty"><i style="width:128px"></i></span></li></ul>` +
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
      const target = ev.target as Element;
      const button = target.closest?.<HTMLButtonElement>(".eaa-r-refresh");
      if (button && !button.disabled) onRefresh();
      const more = target.closest?.(".eaa-r-more");
      if (more) {
        const open = (ev.currentTarget as HTMLElement).classList.toggle("expanded");
        more.setAttribute("aria-expanded", String(open));
      }
      /* linha da disciplina: guarda qual está aberta para a reescrita do
         conteúdo (dado novo) não fechá-la */
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
  if (box.nextSibling !== anchor) anchor.parentNode.insertBefore(box, anchor);
  /* só reescreve se mudou: a varredura roda a cada segundo */
  if (box.dataset.html !== fresh) {
    box.dataset.html = fresh;
    box.innerHTML = fresh;
    box.querySelector(".eaa-r-more")?.setAttribute("aria-expanded", String(box.classList.contains("expanded")));
    for (const li of box.querySelectorAll<HTMLElement>("li[data-ou]")) setRowOpen(li, state.openRows.has(li.dataset.ou!));
  }
}
