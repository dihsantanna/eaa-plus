/* EAA+ · dados do AVA (compartilhado)
 *
 * A camada que as melhorias do AVA usam (EAAPlus.ava), para a página inicial
 * e as páginas de disciplina contarem as atividades da mesma forma. Não é uma
 * melhoria: só junta as três peças abaixo e expõe uma interface pequena.
 *
 *   ava-network.js  → busca (único arquivo com rede)
 *   ava-cache.js    → guarda por 10 min entre páginas
 *   ava-rules.js    → transforma dados crus em estados, grupos e textos
 *
 * De onde vêm os dados: boletim → o que já foi corrigido. Tarefas e
 * questionários → prazos, ligados ao boletim pelo GradeItemId. Para saber se
 * o aluno fez algo que ainda não tem nota: envios da tarefa, conclusão do
 * tópico de conteúdo (toc + myItems) e a página "Lista de questionários" —
 * a API não conta as tentativas de questionário (403) e na maioria das
 * disciplinas o questionário não é tópico de conteúdo.
 */

EAAPlus.ava = (function () {
  "use strict";

  var net = EAAPlus.avaNet;
  var cache = EAAPlus.avaCache;
  var rules = EAAPlus.avaRules;

  /* Memória desta página. Erros também ficam guardados aqui (nunca no
     cache): nada de tentar de novo sozinho — a varredura roda a cada
     segundo e uma disciplina com erro viraria leitura sem fim. Tenta de
     novo quando o aluno recarrega a página ou clica em Atualizar. */
  var summaries = {};
  var gradebooks = {};
  var storedByCourse = {};
  var namesPromise = null;

  /* Botão Atualizar: esquece a memória desta página e o cache, para a
     próxima leitura de cada disciplina ir ao servidor. */
  function restart() {
    summaries = {};
    gradebooks = {};
    storedByCourse = {};
    namesPromise = null;
    return cache.clear();
  }

  function storedFor(ou) {
    ou = String(ou);
    if (!storedByCourse[ou]) storedByCourse[ou] = cache.read(ou);
    return storedByCourse[ou];
  }

  /* O boletim é a primeira leitura da fila e já diz o formato da disciplina.
     preview() usa a MESMA requisição de courseData(), não faz outra — nem
     nenhuma, se a disciplina estiver no cache. */
  function gradebook(ou) {
    if (!gradebooks[ou]) {
      gradebooks[ou] = storedFor(ou).then(function (e) {
        return e ? e.value.gi : net.request(net.API + ou + "/grades/");
      });
    }
    return gradebooks[ou];
  }

  function preview(ou) {
    return gradebook(ou).then(rules.preview);
  }

  /* Resumo de uma disciplina: do cache, se houver; senão lê e guarda. */
  function courseData(ou) {
    if (!summaries[ou]) {
      summaries[ou] = storedFor(ou).then(function (e) {
        if (e) return assemble(ou, e.value, e.readAt);
        var start = Date.now(); /* a idade conta do começo da leitura */
        return download(ou).then(function (b) {
          var raw = cache.slim(b.raw);
          if (b.complete) cache.store(String(ou), raw, start);
          return assemble(ou, raw, start);
        });
      });
    }
    return summaries[ou];
  }

  /* Sempre a partir dos dados crus: o relógio de agora decide o que venceu. */
  function assemble(ou, raw, readAt) {
    var r = rules.summarize(rules.classify(ou, raw), raw.values);
    r.readAt = readAt;
    return r;
  }

  /* Poucas leituras, em duas levas. A 1ª é o que toda disciplina precisa:
   * boletim, notas liberadas, tarefas e questionários. A 2ª só pede o que
   * AQUELA disciplina exige (rules.plan decide). O nome da disciplina vem de
   * uma leitura só para todas (names()).
   *
   * Devolve { raw, complete }. Uma leitura que falhou vira lista vazia
   * (a disciplina ainda aparece, com o que deu para ler), mas aí complete =
   * false e nada disso vai para o cache. */
  function download(ou) {
    var base = net.API + ou + "/";
    var complete = true;
    function failed(value) {
      return function () {
        complete = false;
        return value;
      };
    }
    return Promise.all([
      gradebook(ou),
      net.request(base + "grades/values/myGradeValues/"),
      net.request(base + "dropbox/folders/").then(net.toList, failed([])),
      net.request(base + "quizzes/").then(net.toList, failed([]))
    ]).then(function (r) {
      var gi = r[0] || [];
      var values = r[1] || [];
      var folders = r[2];
      var quizzes = r[3];
      var p = rules.plan(gi, values, folders, quizzes);

      return Promise.all([
        p.hasQuiz ? net.request(net.QUIZ_LIST + ou, true).then(net.parseQuizList, failed({})) : {},
        p.unlinked ? net.request(base + "content/toc").then(null, failed(null)) : null,
        p.unlinked ? net.request(base + "content/myItems/").then(net.toList, failed([])) : [],
        p.toCheck.length ? checkSubmissions(ou, p.toCheck) : { submittedIds: {}, sections: {}, complete: true }
      ]).then(function (s) {
        if (!s[3].complete) complete = false;
        return {
          complete: complete,
          raw: {
            gi: gi,
            values: values,
            folders: folders,
            quizzes: quizzes,
            toc: s[1],
            myItems: s[2],
            quizList: s[0],
            submissions: { submittedIds: s[3].submittedIds, sections: s[3].sections }
          }
        };
      });
    });
  }

  /* Envios das tarefas: a página "Atividades com Anexo" traz o status de
   * todas numa leitura só. Se a página falhar ou uma tarefa não aparecer
   * nela, pergunta à API de envios só por aquela. Se essa pergunta falhar,
   * a resposta sai com complete = false. */
  function checkSubmissions(ou, folders) {
    return net
      .request(net.ASSIGNMENT_LIST + ou + "&isprv=0", true)
      .then(net.parseAssignmentList, function () {
        return {};
      })
      .then(function (page) {
        var r = { submittedIds: {}, sections: {}, complete: true };
        var missing = folders.filter(function (p) {
          var l = page[String(p.Id)];
          if (!l) return true;
          if (l.submitted) r.submittedIds[p.Id] = true;
          if (l.section) r.sections[p.Id] = l.section;
          return false;
        });
        return Promise.all(
          missing.map(function (p) {
            return net.request(net.API + ou + "/dropbox/folders/" + p.Id + "/submissions/mysubmissions/").then(
              function (e) {
                if (net.toList(e).some(function (x) {
                  return x.Submissions && x.Submissions.length;
                })) r.submittedIds[p.Id] = true;
              },
              function () {
                r.complete = false;
              }
            );
          })
        ).then(function () {
          return r;
        });
      });
  }

  /* Nome oficial das disciplinas, numa leitura só. O atributo text do card não
     serve: já veio "Nome, código, semestre" e depois só "Fechada". */
  function names() {
    if (!namesPromise) {
      namesPromise = cache.read("names").then(function (e) {
        if (e) return e.value;
        var start = Date.now();
        return net.request(net.ENROLLMENTS).then(
          function (m) {
            var byId = {};
            ((m && m.Items) || []).forEach(function (i) {
              if (i.OrgUnit) byId[i.OrgUnit.Id] = i.OrgUnit.Name;
            });
            cache.store("names", byId, start);
            return byId;
          },
          function () {
            return {}; /* sem nomes: as fichas dizem "Disciplina" */
          }
        );
      });
    }
    return namesPromise;
  }

  function name(ou) {
    return names().then(function (byId) {
      return byId[ou] || "";
    });
  }

  /* Interface usada pelas melhorias (ava-progress.js, ava-course.js): dados
     e, por conveniência, as funções de texto e desenho das regras. */
  return {
    courseData: courseData,
    preview: preview,
    name: name,
    forget: cache.forget,
    restart: restart,
    dayOf: rules.dayOf,
    daysUntil: rules.daysUntil,
    formatDate: rules.formatDate,
    formatTime: rules.formatTime,
    timeLeft: rules.timeLeft,
    formatNum: rules.formatNum,
    plural: rules.plural,
    esc: rules.esc,
    tally: rules.tally,
    standing: rules.standing,
    highlight: rules.highlight,
    segments: rules.segments,
    when: rules.when,
    urgent: rules.urgent,
    STATE_LABEL: rules.STATE_LABEL,
    LEGEND: rules.LEGEND
  };
})();
