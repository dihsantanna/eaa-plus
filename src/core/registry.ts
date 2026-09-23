/* Registro das features.
 *
 * Cada feature tem um `id` (para log) e um `init()` que devolve false se a
 * página ainda não está pronta. Nesse caso o registro observa o DOM e tenta de
 * novo a cada mudança, por até 15 s — os componentes do AVA costumam
 * aparecer depois do document_idle.
 *
 * Uma feature que lança erro é isolada: vira um aviso no console e as outras
 * seguem funcionando.
 */

export interface Feature {
  id: string;
  /** true = pronto (ou nada a fazer nesta página); false = tente de novo. */
  init(): boolean;
}

const TIMEOUT_MS = 15_000;

let pending: Feature[] = [];
let observer: MutationObserver | null = null;

/** Roda init() isolando erros. true = não precisa tentar de novo. */
function attempt(feature: Feature): boolean {
  try {
    return feature.init() !== false;
  } catch (err) {
    console.warn(`[EAA+] melhoria "${feature.id}" falhou:`, err);
    return true; /* não insiste numa feature que lança erro */
  }
}

function stopWatching(): void {
  observer?.disconnect();
  observer = null;
}

function watch(): void {
  if (observer) return;
  const deadline = Date.now() + TIMEOUT_MS;
  observer = new MutationObserver(() => {
    if (Date.now() > deadline) return stopWatching();
    pending = pending.filter((f) => !attempt(f));
    if (!pending.length) stopWatching();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

export function registerFeature(feature: Feature): void {
  if (attempt(feature)) return;
  pending.push(feature);
  watch();
}
