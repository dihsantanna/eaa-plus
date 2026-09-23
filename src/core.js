/* EAA+ — núcleo
 *
 * Registro de melhorias para as páginas da Escola de Adoração e Arte.
 * Cada arquivo em src/features/ chama EAAPlus.add({ ... }) para se registrar.
 *
 * Os content scripts declarados no mesmo bloco do manifest compartilham este
 * escopo isolado, então basta listar o core antes das features no manifest.
 *
 * Contrato de uma melhoria:
 *   {
 *     id:    "filtro-periodos",     // identificador para log
 *     init:  function () { ... }    // retorna false se o DOM ainda não existe
 *   }
 *
 * Se init() retornar false, o núcleo observa o DOM e tenta de novo, porque
 * widgets do Elementor às vezes renderizam depois do document_idle.
 */

var EAAPlus = (function () {
  "use strict";

  var TIMEOUT_MS = 15000;

  var pending = [];
  var observer = null;
  var deadline = 0;

  function log(id, error) {
    /* Uma melhoria quebrada nunca deve derrubar as outras. */
    if (window.console && console.warn) {
      console.warn('[EAA+] melhoria "' + id + '" falhou:', error);
    }
  }

  function attempt(feature) {
    try {
      return feature.init() !== false;
    } catch (error) {
      log(feature.id, error);
      return true; /* não insiste numa melhoria que lança erro */
    }
  }

  function flush() {
    pending = pending.filter(function (feature) {
      return !attempt(feature);
    });

    if (!pending.length && observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function watch() {
    if (observer) return;

    deadline = Date.now() + TIMEOUT_MS;

    observer = new MutationObserver(function () {
      if (Date.now() > deadline) {
        observer.disconnect();
        observer = null;
        return;
      }
      flush();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function add(feature) {
    if (!feature || typeof feature.init !== "function") return;

    if (!attempt(feature)) {
      pending.push(feature);
      watch();
    }
  }

  /* Interpreta uma etiqueta de período vinda da página.
   * Compartilhado pelas melhorias para não duplicar a regra.
   *   "1º período"            -> [1]
   *   "3º e 4º período"       -> [3, 4]
   *   "1º, 2º e 3º períodos"  -> [1, 2, 3]
   *   "1º ao 4º período"      -> [1, 2, 3, 4]
   * Sem etiqueta reconhecível, devolve todos os períodos. */
  function periodos(text) {
    var t = (text || "").toLowerCase();
    var achados = t.match(/\d\s*º/g) || [];
    var nums = achados.map(function (s) {
      return parseInt(s, 10);
    });

    if (!nums.length) return [1, 2, 3, 4];

    if (/\bao\b/.test(t) && nums.length >= 2) {
      var min = Math.min.apply(null, nums);
      var max = Math.max.apply(null, nums);
      var faixa = [];
      for (var i = min; i <= max; i++) faixa.push(i);
      return faixa;
    }

    return nums.filter(function (n, i) {
      return nums.indexOf(n) === i;
    });
  }

  return { add: add, periodos: periodos };
})();
