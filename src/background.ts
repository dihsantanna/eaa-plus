/* Service worker da extensão.
 *
 * Só existe por causa do cache entre páginas do AVA (ava/cache.ts): por
 * padrão o chrome.storage.session é invisível para content scripts, e só um
 * contexto da própria extensão pode liberar. Não faz rede, não lê abas, não
 * guarda nada por conta própria.
 *
 * O storage.session fica só na memória (nunca no disco) e o Chrome o apaga
 * ao fechar o navegador, ao atualizar ou ao desativar a extensão.
 */

function exposeToContentScripts(): void {
  chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" }).catch(() => {
    /* sem acesso, o cache fica desligado e a extensão lê do AVA toda vez */
  });
}

chrome.runtime.onInstalled.addListener(exposeToContentScripts);
chrome.runtime.onStartup.addListener(exposeToContentScripts);
exposeToContentScripts();
