/* Feature 3 — painel interno da disciplina.
 *
 * Em qualquer página de uma disciplina (início, conteúdo, atividades, notas,
 * avisos, lista de classe...), uma barra na faixa azul de navegação com a
 * nota da Av1 e os próximos prazos; um clique abre o painel com cada
 * atividade (cor, nome com link, estado).
 *
 * A disciplina é identificada pelo link "Início do Curso" da própria faixa
 * (/d2l/home/{ou}), que existe em todas as rotas.
 */

import { courseData, forget, preview } from "../../ava/course-data.ts";
import type { Feature } from "../../core/registry.ts";
import { place } from "./layout.ts";
import { barHtml, loadingHtml } from "./render.ts";

const BAR_ID = "eaa-course";
const SCAN_MS = 1000;

/** O ou (id da disciplina) pelo link "Início do Curso", ou null. */
function courseOu(nav: Element): string | null {
  for (const a of nav.querySelectorAll("a[href]")) {
    const m = a.getAttribute("href")?.match(/^\/d2l\/home\/(\d+)\/?$/);
    if (m) return m[1];
  }
  return null;
}

function closePanel(box: Element | null): void {
  const button = box?.querySelector(".eaa-d-button");
  const panel = box?.querySelector<HTMLElement>(".eaa-d-panel");
  if (!button || !panel || panel.hidden) return;
  panel.hidden = true;
  button.setAttribute("aria-expanded", "false");
}

function togglePanel(box: Element): void {
  const button = box.querySelector<HTMLButtonElement>(".eaa-d-button");
  const panel = box.querySelector<HTMLElement>(".eaa-d-panel");
  if (!button || !panel || button.disabled) return;
  const open = panel.hidden;
  panel.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
}

/* Eventos delegados no document: o conteúdo da barra é trocado inteiro. */
function listenForPanel(): void {
  document.addEventListener("click", (ev) => {
    const box = document.getElementById(BAR_ID);
    if (!box) return;
    const target = ev.target as Element;
    if (!box.contains(target)) return closePanel(box);
    if (target.closest?.(".eaa-d-button")) togglePanel(box);
  });
  document.addEventListener("keydown", (ev) => {
    const box = document.getElementById(BAR_ID);
    const panel = box?.querySelector<HTMLElement>(".eaa-d-panel");
    if (ev.key === "Escape" && panel && !panel.hidden) {
      closePanel(box);
      box?.querySelector<HTMLElement>(".eaa-d-button")?.focus();
    }
  });
}

export const courseBarFeature: Feature = {
  id: "course-bar",

  init() {
    let nav = document.querySelector("nav.d2l-navigation-s");
    if (!nav) return false;
    const ou = courseOu(nav);
    /* Sem o link "Início do Curso" não é página de disciplina (ou a faixa
       ainda está montando): o registro tenta de novo por 15 s e desiste. */
    if (!ou) return false;

    /* Nesta página o aluno pode enviar algo: a barra lê do servidor e a
       disciplina sai do cache (entrando e saindo). */
    forget(ou);

    let content: string | null = null; /* nada até a prévia dizer quantas colunas */
    let loading = true;

    /** Garante a barra na faixa, com o conteúdo atual, e a posiciona. */
    function ensure(): void {
      let box = document.getElementById(BAR_ID);
      if (!content) return void box?.remove();
      if (!box || !nav!.contains(box)) {
        box?.remove();
        box = document.createElement("div");
        box.id = BAR_ID;
        nav!.appendChild(box);
      }
      if (box.dataset.content !== content) {
        box.dataset.content = content;
        box.innerHTML = content;
      }
      box.setAttribute("aria-busy", String(loading));
      if (!place(nav!, box)) closePanel(box);
    }

    /* A faixa pode ser redesenhada pelo AVA (ex.: navegação interna do
       Conteúdo); a varredura recoloca e realinha. */
    const timer = setInterval(() => {
      const current = document.querySelector("nav.d2l-navigation-s");
      if (current && current !== nav) nav = current;
      ensure();
    }, SCAN_MS);
    window.addEventListener("resize", ensure);

    function stop(): void {
      loading = false;
      content = null;
      ensure();
      clearInterval(timer);
      window.removeEventListener("resize", ensure);
    }

    listenForPanel();
    ensure();

    preview(ou).then(
      (p) => {
        if (!loading) return; /* os dados completos chegaram antes */
        content = loadingHtml(p);
        ensure();
      },
      () => {}
    );

    courseData(ou).then(
      (r) => {
        if (!r.total) return stop();
        loading = false;
        content = barHtml(r);
        ensure();
      },
      (err) => {
        stop();
        console.warn(`[EAA+] barra da disciplina ${ou}:`, err);
      }
    );
    return true;
  },
};
