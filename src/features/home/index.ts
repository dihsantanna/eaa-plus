/* Página inicial do AVA (/d2l/home): orquestra a feature 1 (painel em cada
 * card) e a feature 2 (painel geral).
 *
 * Os cards ficam dentro de 4 camadas de shadow DOM e são recriados quando o
 * aluno troca de aba. MutationObserver não atravessa shadow root, então a
 * página é varrida a cada segundo: cada card visível ganha (ou mantém) o seu
 * bloco, e o painel geral é atualizado com o que já chegou.
 */

import { restart } from "../../ava/course-data.ts";
import { findAllDeep } from "../../core/dom.ts";
import type { Feature } from "../../core/registry.ts";
import { renderCourseCard } from "./course-card.ts";
import { HomeState } from "./state.ts";
import { updateSummaryPanel } from "./summary-panel.ts";

const SCAN_MS = 1000;
const CARD_TAG = "D2L-MY-COURSES-ENROLLMENT-CARD";

export const homeFeature: Feature = {
  id: "home",

  init() {
    /* O content script roda em todas as páginas /d2l/; esta é só a inicial. */
    if (!/^\/d2l\/home\/?$/.test(location.pathname)) return true;
    if (!document.querySelector("d2l-my-courses-v2")) return false;

    const state = new HomeState();

    function scan(): void {
      const root = document.querySelector("d2l-my-courses-v2")?.shadowRoot;
      if (!root) return;
      const visible: string[] = [];
      for (const card of findAllDeep(root, (el) => el.tagName === CARD_TAG)) {
        const ou = card.id.replace(/^enrollment-card-/, "");
        /* Só os visíveis: as outras abas carregam quando forem abertas. */
        if (!/^\d+$/.test(ou) || !card.getClientRects().length) continue;
        visible.push(ou);
        renderCourseCard(card, ou, state);
      }
      updateSummaryPanel(visible, state, refreshAll);
    }

    /** Botão Atualizar: lê tudo de novo do servidor SEM recarregar a página
     *  (o AVA pediria de novo ~250 arquivos). O painel geral volta ao
     *  carregamento e os cards trocam o conteúdo quando o dado chega. */
    function refreshAll(): void {
      state.reset();
      void restart();
      scan();
    }

    scan();
    setInterval(scan, SCAN_MS);
    return true;
  },
};
