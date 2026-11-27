/* Entrada do content script: roda em toda página /d2l/* do AVA (manifest).
 *
 * O Chrome injeta o content.js (este arquivo, empacotado) e o content.css
 * quando a página termina de carregar (document_idle). Cada feature confere
 * sozinha se está na página certa:
 *   - home        → só /d2l/home: painel em cada card + painel geral
 *   - course-bar  → páginas de disciplina: barra na faixa azul + painel
 */

import "./styles/theme.css";
import "./styles/summary-panel.css";
import "./styles/summary-wide.css";
import "./styles/course-bar.css";
import "./styles/wide-layout.css";

import { initCache } from "./ava/cache.ts";
import { getWideLayout } from "./ava/prefs.ts";
import { registerFeature } from "./core/registry.ts";
import { courseBarFeature } from "./features/course-bar/index.ts";
import { homeFeature } from "./features/home/index.ts";

/* Na página inicial (/d2l/home), se o Layout Amplo (beta) estiver ligado,
   suspende a exibição até aplicar o cabeçalho, a barra única e as abas
   (teto de segurança de 8 s: os cards do AVA demoram a chegar). */
if (/^\/d2l\/home\/?$/.test(location.pathname)) {
  void getWideLayout().then((wide) => {
    if (!wide) return;
    if (document.querySelector("d2l-my-courses-v2")?.shadowRoot) return;
    document.documentElement.classList.add("eaa-booting");
    setTimeout(() => document.documentElement.classList.remove("eaa-booting"), 8000);
  });
}

initCache();
registerFeature(homeFeature);
registerFeature(courseBarFeature);
