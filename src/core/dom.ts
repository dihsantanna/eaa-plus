/* Utilitários de DOM que atravessam shadow DOM.
 *
 * O AVA é feito de web components: os cards da página inicial ficam dentro
 * de 4 shadow roots aninhados. querySelector não atravessa shadow root, e
 * MutationObserver também não enxerga mudanças lá dentro — por isso as
 * features procuram periodicamente com estas funções. */

type Root = Document | Element | ShadowRoot;

/** Todos os elementos que passam no teste, descendo por shadow roots. */
export function findAllDeep(root: Root, test: (el: Element) => boolean, out: Element[] = []): Element[] {
  for (const el of root.querySelectorAll("*")) {
    if (test(el)) out.push(el);
    else if (el.shadowRoot) findAllDeep(el.shadowRoot, test, out);
  }
  return out;
}

/** O primeiro elemento que passa no teste, descendo por shadow roots. */
export function findDeep(root: Root, test: (el: Element) => boolean): Element | null {
  for (const el of root.querySelectorAll("*")) {
    if (test(el)) return el;
    if (el.shadowRoot) {
      const found = findDeep(el.shadowRoot, test);
      if (found) return found;
    }
  }
  return null;
}
