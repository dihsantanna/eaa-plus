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
import "./styles/course-bar.css";

import { initCache } from "./ava/cache.ts";
import { registerFeature } from "./core/registry.ts";
import { courseBarFeature } from "./features/course-bar/index.ts";
import { homeFeature } from "./features/home/index.ts";

initCache();
registerFeature(homeFeature);
registerFeature(courseBarFeature);
