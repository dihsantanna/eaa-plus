/* EAA+ · rede do AVA
 *
 * O ÚNICO arquivo com acesso à rede (check-manifest.mjs cobra). Só GET, só
 * caminhos do próprio AVA (sameOrigin recusa qualquer outro endereço), com
 * a sessão do aluno. Nada é enviado para fora.
 *
 * Também lê as duas páginas HTML do AVA que a API não substitui (Lista de
 * questionários e Atividades com Anexo), com DOMParser — que monta o HTML
 * como documento inerte, sem executar nada.
 */

EAAPlus.avaNet = (function () {
  "use strict";

  var API = "/d2l/api/le/1.99/";
  var QUIZ_LIST = "/d2l/lms/quizzing/user/quizzes_list.d2l?ou=";
  var ASSIGNMENT_LIST = "/d2l/lms/dropbox/user/folders_list.d2l?ou=";
  var ENROLLMENTS = "/d2l/api/lp/1.63/enrollments/myenrollments/?orgUnitTypeId=3";
  var PARALLEL = 4;

  /* ---------------------------------------------------------------
   * Pedidos: no máximo PARALLEL ao mesmo tempo, o resto espera na fila
   * ------------------------------------------------------------- */
  var queue = [];
  var active = 0;

  function sameOrigin(path) {
    /* "/x" resolve no domínio da página; "//x" ou "https:" sairiam dele. */
    if (!/^\/(?!\/)/.test(path)) throw new Error("caminho fora do AVA: " + path);
    return path;
  }

  function request(path, asText) {
    return new Promise(function (resolve, reject) {
      queue.push(function () {
        active++;
        fetch(sameOrigin(path), { credentials: "same-origin" })
          .then(function (r) {
            if (!r.ok) throw new Error(path + " respondeu " + r.status);
            return asText ? r.text() : r.json();
          })
          .then(resolve, reject)
          .then(function () {
            active--;
            pump();
          });
      });
      pump();
    });
  }

  function pump() {
    while (active < PARALLEL && queue.length) queue.shift()();
  }

  /* A API ora devolve uma lista, ora { Objects: [...] } (paginado). */
  function toList(o) {
    if (Array.isArray(o)) return o;
    return (o && o.Objects) || [];
  }

  function cleanText(el) {
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  /* ---------------------------------------------------------------
   * Páginas HTML do AVA
   * ------------------------------------------------------------- */

  /* Página "Atividades com Anexo": tabela com linhas de seção
   * (tr.d_ggl2, "Av1 - Primeiro Fechamento") e uma linha por tarefa, com o
   * link ?db={id} e a coluna "Status de Conclusão" ("Não Enviado" /
   * "1 envio, 2 arquivos" — conferido contra a API em 15 tarefas reais). */
  function parseAssignmentList(html) {
    var byId = {};
    var doc = new DOMParser().parseFromString(html, "text/html");
    var section = "";
    var rows = doc.querySelectorAll("table tr");
    for (var i = 0; i < rows.length; i++) {
      var tr = rows[i];
      if (/\bd_ggl2\b/.test(tr.className)) {
        section = cleanText(tr);
        continue;
      }
      var db = null;
      var links = tr.querySelectorAll("a[href]");
      for (var j = 0; j < links.length && !db; j++) db = (links[j].getAttribute("href").match(/[?&]db=(\d+)/) || [])[1];
      if (!db || tr.children.length < 2) continue;
      byId[db] = { section: section, submitted: /\d+\s*envio/i.test(cleanText(tr.children[1])) };
    }
    return byId;
  }

  /* Página "Lista de questionários": uma tabela com uma seção por grupo de
   * avaliação ("Avaliação 1 (Av1) - Primeiro Fechamento") e, em cada linha,
   * o link GoToQuiz(id), o status e as tentativas "usadas / permitidas".
   * É a única fonte de "fiz o questionário": a API de tentativas dá 403. */
  function parseQuizList(html) {
    var byId = {};
    var doc = new DOMParser().parseFromString(html, "text/html");
    var section = "";
    var rows = doc.querySelectorAll("table.d2l-table tr");
    for (var i = 0; i < rows.length; i++) {
      var tr = rows[i];
      var cells = tr.children;
      if (!cells.length) continue;
      if (/\bd_gh\b/.test(tr.className)) {
        section = cleanText(cells[0]);
        continue;
      }
      var link = tr.querySelector("[onclick*='GoToQuiz(']");
      var id = link && (link.getAttribute("onclick").match(/GoToQuiz\((\d+)/) || [])[1];
      if (!id) continue;
      var used = (cleanText(cells[cells.length - 1]).match(/^(\d+)\s*\//) || [])[1];
      byId[id] = {
        section: section,
        used: used ? parseInt(used, 10) : 0,
        /* A tentativa aberta é marcada por um ícone na própria linha. O
           texto "Tentativa em andamento" da coluna de status NÃO serve: é só
           o nome do link de feedback em questionários já corrigidos. */
        inProgress: !!tr.querySelector("img[alt*='em andamento' i]")
      };
    }
    return byId;
  }

  return {
    API: API,
    QUIZ_LIST: QUIZ_LIST,
    ASSIGNMENT_LIST: ASSIGNMENT_LIST,
    ENROLLMENTS: ENROLLMENTS,
    request: request,
    toList: toList,
    parseAssignmentList: parseAssignmentList,
    parseQuizList: parseQuizList
  };
})();
