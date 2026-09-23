/* EAA+ · service worker
 *
 * Só existe por causa do cache entre páginas do AVA (src/ava-dados.js):
 * por padrão o chrome.storage.session é invisível para content scripts, e
 * só um contexto da própria extensão pode liberar. Não faz rede, não lê
 * abas, não guarda nada por conta própria.
 *
 * O storage.session fica só na memória (nunca no disco) e o Chrome o apaga
 * ao fechar o navegador, ao atualizar ou ao desativar a extensão.
 */

function liberarParaAsPaginas() {
  chrome.storage.session
    .setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })
    .catch(function () {
      /* sem acesso, ava-dados.js segue sem cache */
    });
}

chrome.runtime.onInstalled.addListener(liberarParaAsPaginas);
chrome.runtime.onStartup.addListener(liberarParaAsPaginas);
liberarParaAsPaginas();
