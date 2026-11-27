/* Página inicial do AVA (/d2l/home): orquestra a feature 1 (painel em cada
 * card), a feature 2 (painel geral) e o layout amplo configurável pelo popup. */

import { restart } from "../../ava/course-data.ts";
import { getWideLayout, onWideLayoutChange } from "../../ava/prefs.ts";
import { findAllDeep } from "../../core/dom.ts";
import type { Feature } from "../../core/registry.ts";
import { alignBlocks, renderCourseCard } from "./course-card.ts";
import { HomeState } from "./state.ts";
import { updateSummaryPanel } from "./summary-panel.ts";
import { applyWideLayout, isAcademicSpaceTab } from "./wide-layout.ts";

const SCAN_MS = 1000;
const CARD_TAG = "D2L-MY-COURSES-ENROLLMENT-CARD";

export const homeFeature: Feature = {
  id: "home",

  init() {
    if (!/^\/d2l\/home\/?$/.test(location.pathname)) return true;
    if (!document.querySelector("d2l-my-courses-v2")) return false;

    const state = new HomeState();
    let shown: Element[] = [];
    let wideLayout = false;

    function scan(): void {
      const root = document.querySelector("d2l-my-courses-v2")?.shadowRoot;
      if (!root) return;
      const visible: string[] = [];
      shown = [];
      for (const card of findAllDeep(root, (el) => el.tagName === CARD_TAG)) {
        const ou = card.id.replace(/^enrollment-card-/, "");
        if (!/^\d+$/.test(ou) || !card.getClientRects().length) continue;
        visible.push(ou);
        shown.push(card);
        renderCourseCard(card, ou, state, wideLayout);
      }
      applyWideLayout(wideLayout, shown);
      alignBlocks(shown);
      updateSummaryPanel(visible, state, refreshAll, isAcademicSpaceTab(), wideLayout);
      /* a tela de carregamento do Amplo só sai com os cards já arrumados */
      if (!wideLayout || visible.length) document.documentElement.classList.remove("eaa-booting");
    }

    function refreshAll(): void {
      state.reset();
      void restart();
      scan();
    }

    /* nada é desenhado antes de saber o layout: senão o clássico aparece por
       um instante para quem usa o Amplo */
    void getWideLayout().then((w) => {
      wideLayout = w;
      scan();
      setInterval(scan, SCAN_MS);
    });
    onWideLayoutChange((w) => {
      wideLayout = w;
      scan();
      dispatchEvent(new Event("resize"));
    });

    addEventListener("resize", () => alignBlocks(shown));
    return true;
  },
};
