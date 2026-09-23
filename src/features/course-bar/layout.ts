/* Posição da barra: dentro da faixa azul da disciplina, alinhada à borda
 * direita do conteúdo.
 *
 * Por que na faixa e não numa faixa nova abaixo: a página de Conteúdo é um
 * app com altura calculada pela janela; qualquer coisa inserida no fluxo
 * empurra o rodapé da aula para fora da tela. Na faixa (position:absolute),
 * nada se mexe. Se encostar nos links do AVA, a barra fica compacta; se nem
 * assim couber, some — nunca cobre o menu do próprio AVA.
 */

import { findDeep } from "../../core/dom.ts";

/** Distância mínima dos links do AVA. */
const GAP = 16;

interface Band {
  /** d2l-labs-navigation-main-footer: a faixa azul */
  footer: Element;
  /** .d2l-labs-navigation-centerer (no shadow): define a borda do conteúdo */
  center: Element;
}

export function findBand(nav: Element): Band | null {
  const footer = findDeep(nav, (e) => e.tagName === "D2L-LABS-NAVIGATION-MAIN-FOOTER");
  if (!footer) return null;
  const center = footer.shadowRoot?.querySelector(".d2l-labs-navigation-centerer") ?? footer;
  return { footer, center };
}

/** Onde terminam os links do AVA na faixa (borda direita, em px). */
function linksEnd(band: Band, box: Element): number {
  const items = band.footer.querySelectorAll(
    "a, [role=link], button, d2l-labs-navigation-link, d2l-labs-navigation-dropdown-button-custom"
  );
  let right = 0;
  for (const e of items) {
    if (box.contains(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.width && r.right > right) right = r.right;
  }
  return right;
}

/** Posiciona a barra e escolhe o modo: inteira, compacta ("compact") ou
 *  escondida ("no-room"). Devolve false quando não coube. */
export function place(nav: Element, box: HTMLElement): boolean {
  const band = findBand(nav);
  if (!band) return true;
  const n = nav.getBoundingClientRect();
  const b = band.footer.getBoundingClientRect();
  const c = band.center.getBoundingClientRect();
  const padRight = Number.parseFloat(getComputedStyle(band.center).paddingRight) || 0;
  box.style.top = `${Math.round(b.top - n.top)}px`;
  box.style.height = `${Math.round(b.height)}px`;
  box.style.right = `${Math.max(0, Math.round(n.right - (c.right - padRight)))}px`;

  const limit = linksEnd(band, box) + GAP;
  box.classList.remove("compact", "no-room");
  if (box.getBoundingClientRect().left < limit) box.classList.add("compact");
  if (box.getBoundingClientRect().left < limit) {
    box.classList.add("no-room");
    return false;
  }
  return true;
}
