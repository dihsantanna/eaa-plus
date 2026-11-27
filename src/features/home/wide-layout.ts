/* Layout Amplo (teto HD+ · 1440 px) na página inicial (/d2l/home).
 *
 * Mantém o cabeçalho superior do AVA 100% intacto (botão Home, logo da
 * faculdade, cursos, notificações, foto e nome do aluno) e permite alternar
 * de volta para o layout clássico ao clicar no popup da extensão. */

import { findAllDeep } from "../../core/dom.ts";

const MARK_ATTR = "data-eaa-wide";
const GRID_CSS =
  `@media (min-width:1200px){.course-card-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}}` +
  `d2l-my-courses-enrollment-card{--course-image-height:72px!important}`;
const TABS_HIDE_CSS = `.d2l-tabs-layout{display:none!important}`;
/* o AVA põe 24px acima dos cards, para as abas; escondidas, vira só vão */
const PANEL_GAP_CSS = `d2l-tab-panel{margin-top:0!important}`;

function setShadowStyle(host: Element | null, css: string | null): void {
  const root = host?.shadowRoot;
  if (!root) return;
  const existing = root.querySelector<HTMLStyleElement>(`style[${MARK_ATTR}]`);
  if (!css) {
    existing?.remove();
    return;
  }
  if (existing) {
    if (existing.textContent !== css) existing.textContent = css;
    return;
  }
  const style = document.createElement("style");
  style.setAttribute(MARK_ATTR, "");
  style.textContent = css;
  root.appendChild(style);
}

/** Aplica largura e altura direto nos nós dentro dos shadow roots da barra de
 *  navegação (vence adoptedStyleSheets do Lit com certeza). */
function styleNavBand(tag: string, enabled: boolean, containerSel: string, slimHeight: string): void {
  const el = document.querySelector(tag);
  const root = el?.shadowRoot;
  if (!root) return;
  const set = (node: HTMLElement | null, prop: string, value: string): void => {
    if (!node) return;
    if (enabled) node.style.setProperty(prop, value, "important");
    else node.style.removeProperty(prop);
  };
  const centerer = root.querySelector<HTMLElement>(".d2l-labs-navigation-centerer");
  set(centerer, "max-width", "1440px");
  set(centerer, "height", slimHeight);
  set(root.querySelector<HTMLElement>(containerSel), "height", slimHeight);
}

/** Marcador do lugar original do menu de cursos (lado direito do header). */
let courseMenuHome: Comment | null = null;

const COURSE_BTN_CSS =
  `button{display:inline-flex!important;align-items:center!important;gap:5px!important;width:auto!important;padding:0 6px!important}` +
  `button::after{content:"Cursos";font-size:13px;font-weight:600;color:#003054;line-height:1}` +
  `d2l-icon{width:19px!important;height:19px!important}`;

const ICON_BTN_CSS = `d2l-icon{width:19px!important;height:19px!important}`;

/** "Cursos" (quadradinho de 9 pontos) vai para a esquerda, logo depois do logo
 *  da faculdade, como no mockup. O texto "Cursos" entra direto no <button>
 *  dentro do shadowRoot para o clique e o dropdown funcionarem nativamente. */
function moveCourseMenu(enabled: boolean): void {
  const menu = document.querySelector<HTMLElement>(".d2l-navigation-s-course-menu");
  if (!menu) return;
  const btnHost = menu.querySelector("d2l-labs-navigation-dropdown-button-icon");
  setShadowStyle(btnHost, enabled ? COURSE_BTN_CSS : null);

  for (const notif of document.querySelectorAll(".d2l-navigation-s-notifications d2l-labs-navigation-dropdown-button-icon, .d2l-navigation-s-home-icon")) {
    setShadowStyle(notif, enabled ? ICON_BTN_CSS : null);
  }

  const left = document.querySelector<HTMLElement>(".d2l-navigation-s-header-logo-area");
  if (enabled) {
    if (!left || left.contains(menu)) return;
    courseMenuHome = document.createComment("eaa-course-menu");
    menu.parentNode?.insertBefore(courseMenuHome, menu);
    left.appendChild(menu);
  } else if (courseMenuHome?.parentNode) {
    courseMenuHome.parentNode.insertBefore(menu, courseMenuHome);
    courseMenuHome.remove();
    courseMenuHome = null;
  }
}

const tabLabel = (tab: Element): string =>
  (
    tab.getAttribute("text") ||
    (tab as Element & { text?: string }).text ||
    tab.getAttribute("aria-label") ||
    tab.getAttribute("title") ||
    tab.textContent ||
    tab.shadowRoot?.textContent ||
    ""
  ).trim();

/** true quando a aba selecionada é "Espaço Acadêmico" (sem avaliações). */
export function isAcademicSpaceTab(): boolean {
  const root = document.querySelector("d2l-my-courses-v2")?.shadowRoot;
  if (!root) return false;
  const selected = findAllDeep(root, (el) => el.tagName === "D2L-TAB" && el.hasAttribute("selected"))[0];
  return !!selected && /^Espa[çc]o Acad[êe]mico$/i.test(tabLabel(selected));
}

function shouldHideMeta(coursesRoot: ShadowRoot): boolean {
  const selected = findAllDeep(coursesRoot, (el) => el.tagName === "D2L-TAB" && el.hasAttribute("selected"))[0];
  if (!selected) return false;
  const text = tabLabel(selected);
  if (selected.id === "search-my-enrollments" || /^(Todos|Espaço Acadêmico)$/i.test(text)) return false;
  return true;
}

function isEmptyNewsWidget(w: HTMLElement): boolean {
  if (w.querySelector(".d2l-datalist-empty, d2l-empty-state-simple")) return true;
  const text = w.textContent ?? "";
  return /Comunicados/i.test(text) && /Não há nenhum aviso/i.test(text);
}

function tagSideWidgets(enabled: boolean): void {
  const col4 = document.querySelector<HTMLElement>(".homepage-col-4");
  const parent = col4?.parentElement;
  if (!col4 || !parent) return;

  if (!enabled) {
    parent.removeAttribute("data-eaa-collapsed-row");
    for (const w of col4.querySelectorAll(".d2l-widget")) {
      w.removeAttribute("data-eaa-vlibras");
      w.removeAttribute("data-eaa-settings");
      w.removeAttribute("data-eaa-open");
      w.removeAttribute("data-eaa-empty-news");
      const emptyEl = w.querySelector("d2l-empty-state-simple");
      const box = emptyEl?.shadowRoot?.querySelector<HTMLElement>(".state-container");
      if (box) {
        box.style.removeProperty("border");
        box.style.removeProperty("background");
        box.style.removeProperty("padding");
        box.style.removeProperty("margin");
        box.style.removeProperty("min-height");
      }
      const desc = emptyEl?.shadowRoot?.querySelector<HTMLElement>(".d2l-state-description");
      if (desc) {
        desc.style.removeProperty("margin");
        desc.style.removeProperty("font-size");
        desc.style.removeProperty("color");
      }
    }
    return;
  }

  let hasActiveWidget = false;
  for (const w of col4.querySelectorAll<HTMLElement>(":scope > .d2l-widget")) {
    if (w.classList.contains("d2l-custom-widget") && w.querySelector("[vw]")) {
      w.setAttribute("data-eaa-vlibras", "1");
      continue;
    }
    if (w.querySelector(".d2l-my-settings-profile-container")) {
      w.setAttribute("data-eaa-settings", "1");
      continue;
    }
    if (isEmptyNewsWidget(w)) {
      w.setAttribute("data-eaa-empty-news", "1");
      /* estiliza direto no nó dentro do shadowRoot (vence adoptedStyleSheets do Lit) */
      const emptyEl = w.querySelector("d2l-empty-state-simple");
      const box = emptyEl?.shadowRoot?.querySelector<HTMLElement>(".state-container");
      if (box) {
        box.style.setProperty("border", "0", "important");
        box.style.setProperty("background", "transparent", "important");
        box.style.setProperty("padding", "0", "important");
        box.style.setProperty("margin", "0", "important");
        box.style.setProperty("min-height", "0", "important");
      }
      const desc = emptyEl?.shadowRoot?.querySelector<HTMLElement>(".d2l-state-description");
      if (desc) {
        desc.style.setProperty("margin", "0", "important");
        desc.style.setProperty("font-size", "13px", "important");
        desc.style.setProperty("color", "#6e7477", "important");
      }
      continue;
    }
    w.removeAttribute("data-eaa-empty-news");
    hasActiveWidget = true;
  }

  if (!hasActiveWidget) parent.setAttribute("data-eaa-collapsed-row", "1");
  else parent.removeAttribute("data-eaa-collapsed-row");
}

const TABS_BAR_ID = "eaa-tabs";

/** O componente em cujo shadow root o d2l-tabs e os painéis dele moram. */
const tabsHost = (tabs: Element | undefined): Element | null => {
  const root = tabs?.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
};

/** Espelha as abas de d2l-tabs (Todos, Espaço Acadêmico, 2026.2) na mesma
 *  linha do título "Minhas Disciplinas", mantendo o d2l-tabs original intacto
 *  e apenas ocultando a faixa visual dele dentro do shadowRoot. */
function syncCourseTabs(coursesEl: Element, coursesRoot: ShadowRoot, enabled: boolean): void {
  const widgetHeader = coursesEl.closest(".d2l-widget")?.querySelector<HTMLElement>(":scope > .d2l-widget-header");
  const d2lTabs = findAllDeep(coursesRoot, (el) => el.tagName === "D2L-TABS")[0];

  if (!enabled || !widgetHeader || !d2lTabs) {
    document.getElementById(TABS_BAR_ID)?.remove();
    setShadowStyle(d2lTabs ?? null, null);
    setShadowStyle(tabsHost(d2lTabs), null);
    return;
  }

  const realTabs = [...d2lTabs.querySelectorAll<HTMLElement>('d2l-tab[slot="tabs"], d2l-tab')];
  if (!realTabs.length) return;

  setShadowStyle(d2lTabs, TABS_HIDE_CSS);
  setShadowStyle(tabsHost(d2lTabs), PANEL_GAP_CSS);

  let bar = document.getElementById(TABS_BAR_ID);
  if (!bar || !widgetHeader.contains(bar)) {
    bar?.remove();
    bar = document.createElement("div");
    bar.id = TABS_BAR_ID;
    bar.className = "eaa-tabs";
    bar.setAttribute("role", "tablist");
    widgetHeader.appendChild(bar);
  }

  const stateKey = realTabs
    .map((t) => `${tabLabel(t)}:${t.hasAttribute("selected") || t.getAttribute("aria-selected") === "true" ? 1 : 0}`)
    .join("|");
  if (bar.dataset.key === stateKey) return;
  bar.dataset.key = stateKey;
  bar.innerHTML = "";

  realTabs.forEach((tab) => {
    const label = tabLabel(tab);
    const active = tab.hasAttribute("selected") || tab.getAttribute("aria-selected") === "true";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `eaa-tab${active ? " active" : ""}`;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(active));
    btn.textContent = label;
    btn.addEventListener("click", () => {
      tab.click();
      setTimeout(() => syncCourseTabs(coursesEl, coursesRoot, true), 50);
    });
    bar!.appendChild(btn);
  });
}

export function applyWideLayout(enabled: boolean, cards: Element[]): void {
  document.documentElement.classList.toggle("eaa-wide", enabled);
  moveCourseMenu(enabled);
  styleNavBand("d2l-labs-navigation-main-header", enabled, ".d2l-labs-navigation-header-container", "56px");
  styleNavBand("d2l-labs-navigation-main-footer", enabled, ".d2l-labs-navigation-footer-container", "40px");
  tagSideWidgets(enabled);

  const pageMain = document.querySelector<HTMLElement>(".d2l-page-main");
  if (pageMain) {
    if (enabled) pageMain.style.setProperty("max-width", "1440px", "important");
    else pageMain.style.removeProperty("max-width");
  }

  const coursesEl = document.querySelector("d2l-my-courses-v2");
  const root = coursesEl?.shadowRoot;
  if (!root || !coursesEl) return;

  syncCourseTabs(coursesEl, root, enabled);

  for (const grid of findAllDeep(root, (el) => el.tagName === "D2L-MY-COURSES-CARD-GRID-V2")) {
    setShadowStyle(grid, enabled ? GRID_CSS : null);
  }

  const hideMeta = enabled && shouldHideMeta(root);
  for (const card of cards) {
    if (hideMeta) card.setAttribute("data-eaa-hide-meta", "");
    else card.removeAttribute("data-eaa-hide-meta");
  }
}
