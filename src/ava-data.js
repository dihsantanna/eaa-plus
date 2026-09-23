/* EAA+ · dados do AVA (compartilhado)
 *
 * Carregado logo depois de src/core.js no bloco do AVA. Não é uma melhoria:
 * é a camada que as melhorias do AVA usam (EAAPlus.ava), para a página
 * inicial e as páginas de disciplina contarem as atividades da mesma forma.
 *
 * De onde vêm os dados: rotas do próprio Brightspace, no mesmo domínio, com a
 * sessão do aluno. Só GET. Nada é enviado para fora. Este é o ÚNICO arquivo
 * com acesso à rede; check-manifest.mjs cobra.
 *
 * Cache entre páginas (chrome.storage.session: só memória, só a extensão
 * enxerga, some ao fechar o navegador) — ver "Cache entre páginas" abaixo.
 *
 * Boletim → o que já foi corrigido. Tarefas e questionários → prazos, ligados
 * ao boletim pelo GradeItemId. Para saber se o aluno fez algo que ainda não
 * tem nota: envios da tarefa (mysubmissions), conclusão do tópico de conteúdo
 * (toc + myItems) e a página "Lista de questionários" — a API não conta as
 * tentativas de questionário (403) e na maioria das disciplinas o questionário
 * não é tópico de conteúdo. Essa página é lida com DOMParser, que não executa
 * nada.
 *
 * Regra de aprovação (Manual do Aluno EaD 2026, p. 29):
 *   Av1 (atividades dos módulos, 5,0) + Av2 (presencial, 5,0) >= 6,0 aprova.
 *   Entre 4,0 e 6,0 vai para Av3 (recuperação). Abaixo de 4,0 reprova.
 * Os valores máximos vêm do boletim de cada disciplina, não são fixos aqui.
 */

EAAPlus.ava = (function () {
  "use strict";

  var API = "/d2l/api/le/1.99/";
  var QUIZ_LIST = "/d2l/lms/quizzing/user/quizzes_list.d2l?ou=";
  var ASSIGNMENT_LIST = "/d2l/lms/dropbox/user/folders_list.d2l?ou=";
  var PASS_MARK = 6;
  var RECOVERY_MARK = 4;
  var PARALLEL = 4;
  var MAX_DEADLINES = 4;
  var TZ = "America/Sao_Paulo";

  /* ---------------------------------------------------------------
   * Rede: só GET, só caminhos do próprio AVA
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

  function toList(o) {
    if (Array.isArray(o)) return o;
    return (o && o.Objects) || [];
  }

  /* ---------------------------------------------------------------
   * Datas e números
   * ------------------------------------------------------------- */
  var fmtDay = null;
  var fmtDate = null;
  var fmtTime = null;
  try {
    fmtDay = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
    fmtDate = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
    fmtTime = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    fmtDay = null;
  }

  function ts(value) {
    var t = value ? Date.parse(value) : NaN;
    return isNaN(t) ? null : t;
  }

  /* Dia de calendário em Brasília, "2026-09-28". */
  function dayOf(t) {
    if (!fmtDay) return new Date(t).toISOString().slice(0, 10);
    return fmtDay.format(new Date(t));
  }

  function daysUntil(target) {
    var a = dayOf(Date.now()).split("-");
    var b = dayOf(target).split("-");
    return Math.round((Date.UTC(+b[0], b[1] - 1, +b[2]) - Date.UTC(+a[0], a[1] - 1, +a[2])) / 86400000);
  }

  function formatDate(t) {
    return fmtDate ? fmtDate.format(new Date(t)) : new Date(t).toLocaleDateString();
  }

  function formatTime(t) {
    return fmtTime ? fmtTime.format(new Date(t)) : "";
  }

  /* "hoje" · "amanhã" · "5 dias" · "encerrado" */
  function timeLeft(t, prefix) {
    if (t < Date.now()) return "encerrado";
    var d = daysUntil(t);
    if (d <= 0) return "hoje";
    if (d === 1) return "amanhã";
    return (prefix ? "em " : "") + d + " dias";
  }

  function formatNum(n) {
    return (Math.round(n * 10) / 10).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  }

  function plural(n, one, many) {
    return n + " " + (n === 1 ? one : many);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function cleanText(el) {
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  /* ---------------------------------------------------------------
   * Cache entre páginas
   *
   * O AVA responde "no-store" e recarrega a página inteira a cada clique,
   * então sem isto a página inicial relê as 9 disciplinas toda vez que o
   * aluno volta a ela. Regras (combinadas com o aluno em 2026-09-23):
   *   1. Validade de 10 minutos.
   *   2. Página de uma disciplina SEMPRE lê do servidor, e apaga a
   *      disciplina do cache ao entrar e ao sair: o aluno pode ter enviado
   *      algo ali. De volta à página inicial, só ela é lida de novo.
   *   3. Guarda os dados crus (enxutos), nunca o resultado: prazo vencido,
   *      "falta 2 dias" etc. são recalculados na hora, com o relógio atual.
   *   4. Só guarda leitura completa. Qualquer falha = nada guardado.
   *   5. Chave com o id do aluno (data-global-context da página) e o
   *      formato. Sem id, sem cache.
   * Qualquer erro do storage = segue sem cache, como antes.
   * ------------------------------------------------------------- */
  var TTL_MS = 10 * 60 * 1000;
  var FORMAT = 2; /* 2: campos em inglês (format, user, readAt, value) */
  var PREFIX = "ava:";
  var noStore = {};
  var warned = false;

  /* Uma vez por página: sem cache a extensão funciona igual, só lê mais. */
  function cacheUnavailable(err) {
    if (warned || !window.console || !console.warn) return;
    warned = true;
    console.warn("[EAA+] cache entre páginas indisponível:", err);
  }

  /* Toda operação passa por aqui: a área é buscada na hora (o service
     worker pode liberar o acesso depois que esta página carregou) e erro
     síncrono vira promessa rejeitada, como o assíncrono. */
  function noStorage(operation) {
    try {
      var area = chrome.storage && chrome.storage.session;
      if (!area) throw new Error("chrome.storage.session não disponível aqui");
      return Promise.resolve(operation(area)).then(null, function (e) {
        cacheUnavailable(e);
        throw e;
      });
    } catch (e) {
      cacheUnavailable(e);
      return Promise.reject(e);
    }
  }

  function ignore() {}

  function currentUserId() {
    try {
      var c = JSON.parse(document.documentElement.getAttribute("data-global-context") || "{}");
      return c && c.userId ? String(c.userId) : null;
    } catch (e) {
      return null;
    }
  }

  /* Enquanto o Atualizar esvazia o cache, ninguém lê o que está lá. */
  var clearing = Promise.resolve();

  function readStored(key) {
    var me = currentUserId();
    if (!me) return Promise.resolve(null);
    return clearing
      .then(function () {
        return noStorage(function (area) {
          return area.get(PREFIX + key);
        });
      })
      .then(
        function (o) {
          var e = o && o[PREFIX + key];
          if (!e || e.format !== FORMAT) return null;
          /* outro aluno usou este navegador: nada do que está lá serve */
          if (e.user !== me) {
            forgetAll();
            return null;
          }
          var age = Date.now() - e.readAt;
          if (!(age >= 0 && age < TTL_MS)) {
            noStorage(function (area) {
              return area.remove(PREFIX + key);
            }).then(null, ignore);
            return null;
          }
          return e;
        },
        function () {
          return null;
        }
      );
  }

  function store(key, value, readAt) {
    var me = currentUserId();
    if (!me || noStore[key]) return;
    var o = {};
    o[PREFIX + key] = { format: FORMAT, user: me, readAt: readAt, value: value };
    noStorage(function (area) {
      return area.set(o);
    }).then(null, ignore);
  }

  /* Disciplina desta página: não lê nem grava o cache dela, e apaga o que
     houver agora e de novo ao sair (outra aba pode ter guardado no meio). */
  function forget(ou) {
    ou = String(ou);
    noStore[ou] = true;
    noStorage(function (area) {
      return area.remove(PREFIX + ou);
    }).then(null, ignore);
  }

  function forgetAll() {
    return noStorage(function (area) {
      return area.get(null).then(function (everything) {
        var keyList = Object.keys(everything || {}).filter(function (k) {
          return k.indexOf(PREFIX) === 0;
        });
        return keyList.length ? area.remove(keyList) : null;
      });
    }).then(null, ignore);
  }

  /* Pela URL, antes de qualquer leitura: /d2l/home/{ou}, /d2l/le/lessons/{ou}/…
     e as páginas ?ou={ou}. A barra da disciplina confirma pelo link
     "Início do Curso" (esquecer() de novo, se a URL não tiver o id). */
  var pageOu = (location.search.match(/[?&]ou=(\d+)/) ||
    location.pathname.match(/^\/d2l\/(?:home|le\/[a-z]+)\/(\d+)(?:\/|$)/) || [])[1];
  if (pageOu) forget(pageOu);
  window.addEventListener("pagehide", function () {
    Object.keys(noStore).forEach(forget);
  });

  /* Só os campos que classificar()/resumir() usam. O caminho sem cache passa
     pelo MESMO corte, então dado guardado e dado fresco desenham igual — e
     textos longos (instruções, descrições) nunca vão para o cache. */
  function pick(o, fields) {
    var out = {};
    fields.forEach(function (c) {
      if (o && o[c] !== undefined) out[c] = o[c];
    });
    return out;
  }

  function slimToc(m) {
    return {
      Topics: (m.Topics || []).map(function (t) {
        return pick(t, ["TopicId", "GradeItemId", "EndDateTime"]);
      }),
      Modules: (m.Modules || []).map(slimToc)
    };
  }

  function slim(b) {
    return {
      gi: b.gi.map(function (g) {
        return pick(g, ["Id", "Name", "GradeType", "IsHidden", "MaxPoints"]);
      }),
      values: b.values.map(function (v) {
        return pick(v, ["GradeObjectIdentifier", "GradeObjectName", "PointsNumerator", "PointsDenominator"]);
      }),
      folders: b.folders.map(function (p) {
        var r = pick(p, ["Id", "Name", "GradeItemId", "IsHidden", "DueDate"]);
        if (p.Availability) r.Availability = pick(p.Availability, ["EndDate"]);
        return r;
      }),
      quizzes: b.quizzes.map(function (q) {
        return pick(q, ["QuizId", "Name", "GradeItemId", "IsActive", "DueDate", "EndDate"]);
      }),
      toc: b.toc ? { Modules: (b.toc.Modules || []).map(slimToc) } : null,
      myItems: b.myItems.map(function (i) {
        return pick(i, ["ItemId", "DateCompleted", "DueDate", "EndDate"]);
      }),
      quizList: b.quizList,
      submissions: b.submissions
    };
  }

  /* ---------------------------------------------------------------
   * Dados de uma disciplina
   * ------------------------------------------------------------- */
  var cache = {};
  var gradebooks = {};
  var storedByCourse = {};

  /* Botão Atualizar: esquece tudo — memória desta página (inclusive erros)
     e cache — para a próxima leitura de cada disciplina ir ao servidor. */
  function restart() {
    cache = {};
    gradebooks = {};
    storedByCourse = {};
    namesPromise = null;
    clearing = forgetAll();
    return clearing;
  }

  function storedFor(ou) {
    ou = String(ou);
    if (!storedByCourse[ou]) storedByCourse[ou] = noStore[ou] ? Promise.resolve(null) : readStored(ou);
    return storedByCourse[ou];
  }

  /* O boletim é a primeira leitura da fila e já diz o formato da disciplina:
     com "Nota AV1" (curso de Música) a barra terá 2 colunas; sem, 1 só.
     previa() usa a MESMA requisição de dados(), não faz outra — nem nenhuma,
     se a disciplina estiver no cache. */
  /* Erros também ficam guardados (na memória da página, nunca no cache):
     nada de tentar de novo sozinho (a varredura roda a cada segundo — uma
     disciplina com erro viraria leitura sem fim). Tenta de novo quando o
     aluno recarrega a página. */
  function gradebook(ou) {
    if (!gradebooks[ou]) {
      gradebooks[ou] = storedFor(ou).then(function (e) {
        return e ? e.value.gi : request(API + ou + "/grades/");
      });
    }
    return gradebooks[ou];
  }

  function preview(ou) {
    return gradebook(ou).then(function (gi) {
      var hasAv = (gi || []).some(function (g) {
        return /^\s*nota\s*av\s*1\b/i.test(g.Name);
      });
      return { hasAv: hasAv, label: hasAv ? "Av1" : "Nota", columns: hasAv ? 2 : 1 };
    });
  }

  function courseData(ou) {
    if (!cache[ou]) {
      cache[ou] = storedFor(ou).then(function (e) {
        if (e) return assemble(ou, e.value, e.readAt);
        var start = Date.now(); /* a idade conta do começo da leitura */
        return download(ou).then(function (b) {
          var raw = slim(b.raw);
          if (b.complete) store(String(ou), raw, start);
          return assemble(ou, raw, start);
        });
      });
    }
    return cache[ou];
  }

  /* Sempre a partir dos dados crus: o relógio de agora decide o que venceu. */
  function assemble(ou, b, readAt) {
    var items = classify(ou, b.gi, b.values, b.folders, b.quizzes, b.toc, b.myItems, b.quizList, b.submissions);
    var r = summarize(items, b.values);
    r.readAt = readAt;
    return r;
  }

  /* Poucas leituras, em duas levas. A 1ª é o que toda disciplina precisa:
   * boletim, notas liberadas, tarefas e questionários. A 2ª só pede o que
   * AQUELA disciplina exige:
   *   - Lista de questionários: só se houver questionário;
   *   - envios da tarefa: só das que contam e ainda não têm nota;
   *   - sumário do conteúdo + itens concluídos: só se houver atividade
   *     avaliada que não é tarefa nem questionário (não existe hoje no curso
   *     de Música, mas o AVA permite).
   * O nome da disciplina vem de uma leitura só para todas (nomes()).
   *
   * Devolve { bruto, completo }. Uma leitura que falhou vira lista vazia
   * (a disciplina ainda aparece, com o que deu para ler), mas aí completo =
   * false e nada disso vai para o cache. */
  function download(ou) {
    var base = API + ou + "/";
    var complete = true;
    function failed(value) {
      return function () {
        complete = false;
        return value;
      };
    }
    return Promise.all([
      gradebook(ou),
      request(base + "grades/values/myGradeValues/"),
      request(base + "dropbox/folders/").then(toList, failed([])),
      request(base + "quizzes/").then(toList, failed([]))
    ]).then(function (r) {
      var gi = r[0] || [];
      var values = r[1] || [];
      var folders = r[2];
      var quizzes = r[3];

      var numericIds = {};
      gi.forEach(function (g) {
        if (isActivity(g)) numericIds[g.Id] = true;
      });
      var gradedIds = {};
      values.forEach(function (v) {
        if (v.PointsNumerator !== null && v.PointsNumerator !== undefined) gradedIds[String(v.GradeObjectIdentifier)] = true;
      });
      var linked = {};
      folders.concat(quizzes).forEach(function (a) {
        if (a.GradeItemId) linked[a.GradeItemId] = true;
      });

      var hasQuiz = quizzes.some(function (q) {
        return q.IsActive !== false;
      });
      var unlinked = Object.keys(numericIds).some(function (id) {
        return !linked[id] && !gradedIds[id];
      });
      var toCheck = folders.filter(function (p) {
        if (p.IsHidden || gradedIds[String(p.GradeItemId)]) return false;
        return numericIds[p.GradeItemId] || whichAv("", p.Name);
      });

      return Promise.all([
        hasQuiz ? request(QUIZ_LIST + ou, true).then(parseQuizList, failed({})) : {},
        unlinked ? request(base + "content/toc").then(null, failed(null)) : null,
        unlinked ? request(base + "content/myItems/").then(toList, failed([])) : [],
        toCheck.length ? checkSubmissions(ou, toCheck) : { submittedIds: {}, sections: {}, complete: true }
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
   * todas numa leitura só ("Não Enviado" / "1 envio, 2 arquivos" — conferido
   * contra a API em 15 tarefas reais, 100% de acordo). Se a página falhar ou
   * uma tarefa não aparecer nela, pergunta à API de envios só por aquela.
   * Se essa pergunta falhar, a resposta sai com completo = false. */
  function checkSubmissions(ou, folders) {
    return request(ASSIGNMENT_LIST + ou + "&isprv=0", true)
      .then(parseAssignmentList, function () {
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
            return request(API + ou + "/dropbox/folders/" + p.Id + "/submissions/mysubmissions/").then(
              function (e) {
                if (toList(e).some(function (x) {
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

  /* Página "Atividades com Anexo": tabela com linhas de seção
   * (tr.d_ggl2, "Av1 - Primeiro Fechamento") e uma linha por tarefa, com o
   * link ?db={id} e a coluna "Status de Conclusão". */
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

  function isActivity(g) {
    return g.GradeType === "Numeric" && !g.IsHidden && g.MaxPoints > 0;
  }

  /* Nome oficial das disciplinas, numa leitura só. O atributo text do card não
     serve: já veio "Nome, código, semestre" e depois só "Fechada". */
  var namesPromise = null;

  function names() {
    if (!namesPromise) {
      namesPromise = readStored("names").then(function (e) {
        if (e) return e.value;
        var start = Date.now();
        return request("/d2l/api/lp/1.63/enrollments/myenrollments/?orgUnitTypeId=3").then(
          function (m) {
            var byId = {};
            ((m && m.Items) || []).forEach(function (i) {
              if (i.OrgUnit) byId[i.OrgUnit.Id] = i.OrgUnit.Name;
            });
            store("names", byId, start);
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

  /* Página "Lista de questionários": uma tabela com uma seção por grupo de
   * avaliação ("Avaliação 1 (Av1) - Primeiro Fechamento") e, em cada linha,
   * o link GoToQuiz(id), o status e as tentativas "usadas / permitidas". */
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

  function topics(toc) {
    var out = [];
    (function walk(modules) {
      (modules || []).forEach(function (m) {
        (m.Topics || []).forEach(function (t) {
          out.push(t);
        });
        walk(m.Modules);
      });
    })(toc && toc.Modules);
    return out;
  }

  /* Av2 e Av3: a nota das atividades fica oculta para o aluno até o
     lançamento, então elas não aparecem no boletim. Reconhece pela seção da
     Lista de questionários ("Avaliação 2 (Av2)") ou pelo nome. */
  function whichAv(section, name) {
    var m = (section || "").match(/\(\s*Av\s*([23])\s*\)|Avalia[çc][ãa]o\s*([23])\b/i);
    if (m) return +(m[1] || m[2]);
    m = (name || "").match(/\bAv\s*([23])\b/i);
    if (m) return +m[1];
    if (/recupera[çc][ãa]o/i.test((section || "") + " " + (name || ""))) return 3;
    return null;
  }

  function assignmentLink(ou, id) {
    return "/d2l/lms/dropbox/user/folder_submit_files.d2l?db=" + id + "&grpid=0&isprv=0&bp=0&ou=" + ou;
  }

  function quizLink(ou, id) {
    return "/d2l/lms/quizzing/user/quiz_summary.d2l?ou=" + ou + "&qi=" + id + "&cfql=1";
  }

  function classify(ou, gradebook, values, folders, quizzes, toc, myItems, quizList, submissions) {
    var grade = {};
    values.forEach(function (v) {
      grade[String(v.GradeObjectIdentifier)] = v;
    });

    /* Atividade avaliada que é tópico de conteúdo (e não tarefa/questionário):
       o conteúdo diz se foi concluída e qual o prazo. */
    var myItemById = {};
    myItems.forEach(function (i) {
      myItemById[i.ItemId] = i;
    });
    var byContent = {};
    topics(toc).forEach(function (t) {
      if (!t.GradeItemId) return;
      var i = myItemById[t.TopicId] || {};
      byContent[t.GradeItemId] = {
        done: !!i.DateCompleted,
        deadline: ts(i.DueDate) || ts(i.EndDate) || ts(t.EndDateTime)
      };
    });

    var inGradebook = {};
    var items = gradebook
      .filter(isActivity)
      .map(function (g) {
        inGradebook[g.Id] = true;
        var it = newItem(g.Name, g.MaxPoints, 1);
        var c = byContent[g.Id];
        if (c) {
          it.submitted = c.done;
          it.deadline = c.deadline;
        }

        folders.forEach(function (p) {
          if (p.GradeItemId !== g.Id || p.IsHidden) return;
          it.assignment = p.Id;
          it.deadline = ts(p.DueDate) || ts((p.Availability || {}).EndDate);
          it.link = assignmentLink(ou, p.Id);
          if (submissions.submittedIds[p.Id]) it.submitted = true;
          if (submissions.sections[p.Id]) it.section = submissions.sections[p.Id];
        });
        quizzes.forEach(function (q) {
          if (q.GradeItemId !== g.Id || q.IsActive === false) return;
          it.deadline = ts(q.DueDate) || ts(q.EndDate);
          it.link = quizLink(ou, q.QuizId);
          applyAttempts(it, quizList[String(q.QuizId)]);
        });

        var v = grade[String(g.Id)];
        if (v && v.PointsNumerator !== null && v.PointsNumerator !== undefined) {
          it.points = v.PointsNumerator;
          it.state = "graded";
        }
        return it;
      });

    /* Av2/Av3: atividades cuja nota está oculta (fora do boletim visível).
       Entram sem pontos — só prazo, estado e link. */
    quizzes.forEach(function (q) {
      if (q.IsActive === false || inGradebook[q.GradeItemId]) return;
      var l = quizList[String(q.QuizId)];
      var av = whichAv(l && l.section, q.Name);
      if (!av) return;
      var it = newItem(q.Name, 0, av);
      it.deadline = ts(q.DueDate) || ts(q.EndDate);
      it.link = quizLink(ou, q.QuizId);
      applyAttempts(it, l);
      items.push(it);
    });
    folders.forEach(function (p) {
      if (p.IsHidden || inGradebook[p.GradeItemId]) return;
      var av = whichAv(submissions.sections[p.Id], p.Name);
      if (!av) return;
      var it = newItem(p.Name, 0, av);
      it.assignment = p.Id;
      it.deadline = ts(p.DueDate) || ts((p.Availability || {}).EndDate);
      it.link = assignmentLink(ou, p.Id);
      it.submitted = !!submissions.submittedIds[p.Id];
      it.section = submissions.sections[p.Id] || "";
      items.push(it);
    });
    return items;
  }

  function newItem(name, max, av) {
    return {
      name: name,
      max: max,
      av: av,
      points: null,
      deadline: null,
      assignment: null,
      link: "",
      section: "",
      submitted: false,
      inProgress: false,
      state: null
    };
  }

  function applyAttempts(it, l) {
    if (!l) return;
    it.section = l.section;
    it.inProgress = l.inProgress;
    if (l.used > 0 && !l.inProgress) it.submitted = true;
  }

  function formula(values, n) {
    var re = new RegExp("^\\s*nota\\s*av\\s*" + n + "\\b", "i");
    for (var i = 0; i < values.length; i++) {
      if (re.test(values[i].GradeObjectName)) return values[i];
    }
    return null;
  }

  /* "Avaliação 1 (Av1) - Último Fechamento", 2º grupo →
     curto "2º Fechamento" (mesma largura em todas as linhas),
     longo "Av1 · Último Fechamento" (nome oficial). */
  function deadlineNames(section, order) {
    var parts = section.split(/\s[-–]\s/);
    var end = parts.length > 1 ? parts[parts.length - 1] : "";
    var av = (section.match(/\((Av\s*\d)\)|^\s*(Av\s*\d)\b/i) || []).slice(1).filter(Boolean)[0];
    if (!end) return null;
    return {
      shortLabel: order + "º " + end.split(/\s+/).pop(),
      longLabel: (av ? av.replace(/\s/g, "") + " · " : "") + end
    };
  }

  function finalState(it, now) {
    if (it.state) return it.state;
    var overdue = it.deadline && it.deadline < now;
    if (it.inProgress && !overdue) return "started";
    if (it.submitted || it.inProgress) return "awaiting";
    if (overdue) return "missed";
    return "todo";
  }

  function tally(items) {
    var c = { items: items, graded: 0, awaiting: 0, started: 0, missed: 0, todo: 0 };
    items.forEach(function (it) {
      c[it.state]++;
    });
    c.delivered = c.graded + c.awaiting;
    c.pending = c.todo + c.started;
    return c;
  }

  function summarize(items, values) {
    var now = Date.now();
    var f1 = formula(values, 1);
    var f2 = formula(values, 2);
    var f3 = formula(values, 3);
    /* A fórmula vale 0 até a prova ser lançada; 0 não é resultado. */
    var released = { 2: !!(f2 && f2.PointsNumerator > 0), 3: !!(f3 && f3.PointsNumerator > 0) };

    items.forEach(function (it) {
      /* Nota da Av2/Av3 lançada: as atividades dela foram corrigidas. */
      if (it.av > 1 && released[it.av]) it.state = "graded";
      it.state = finalState(it, now);
    });

    var r = { total: 0, ok: 0, av1: 0, av1Max: 0, av2: null, av3: null, hasAv: false, deadlines: [] };
    items.forEach(function (it) {
      r.total += it.max;
      if (it.state === "graded" && it.points !== null) r.ok += it.points;
    });
    r.av1 = f1 && f1.PointsNumerator !== null ? f1.PointsNumerator : r.ok;

    /* A Av3 é aberta para a turma toda, mas só serve para quem ficou em
       recuperação (Av1 + Av2 entre 4 e 6). Sem isso ela sumiria da vista de
       quem precisa e apareceria como pendência para quem já passou. Fica
       também se o aluno já mexeu nela (iniciou, enviou ou tem nota). */
    var sum = released[2] ? r.av1 + f2.PointsNumerator : null;
    var inRecovery = !!f1 && sum !== null && sum >= RECOVERY_MARK && sum < PASS_MARK;
    items = items.filter(function (it) {
      return it.av !== 3 || inRecovery || it.state === "awaiting" || it.state === "started" || it.state === "graded";
    });

    /* Av1: um grupo por dia de prazo (Brasília) — o curso de Música tem dois
       fechamentos. Av2 e Av3: um grupo cada, com o nome delas. */
    var byDay = {};
    items.forEach(function (it) {
      var key = it.av > 1 ? "av" + it.av : it.deadline ? dayOf(it.deadline) : "sem";
      if (!byDay[key]) byDay[key] = { day: key, av: it.av > 1 ? it.av : 1, deadline: it.deadline, items: [], section: "" };
      var g = byDay[key];
      g.items.push(it);
      if (it.deadline && it.deadline > g.deadline) g.deadline = it.deadline;
      if (!g.section && it.section) g.section = it.section;
    });
    var groups = Object.keys(byDay)
      .map(function (k) {
        return byDay[k];
      })
      .sort(function (a, b) {
        return (a.deadline || Infinity) - (b.deadline || Infinity);
      })
      .slice(0, MAX_DEADLINES);

    var order = 0;
    groups.forEach(function (g) {
      var names;
      if (g.av === 2) names = { shortLabel: "Av2", longLabel: "Av2" };
      else if (g.av === 3) names = { shortLabel: "Av3", longLabel: "Av3 · Recuperação" };
      else if (!g.deadline) names = { shortLabel: "Sem prazo", longLabel: "Sem prazo" };
      else names = deadlineNames(g.section, ++order);
      g.named = !!names;
      var av1Only = groups.filter(function (x) {
        return x.av === 1;
      }).length;
      g.shortLabel = names ? names.shortLabel : av1Only > 1 ? order + "º prazo" : "Prazo";
      g.longLabel = names ? names.longLabel : "Próximo prazo";
      g.c = tally(g.items);
    });
    r.deadlines = groups;

    /* Disciplinas como Canto Coral e Atividades Extensionistas não têm
       Av1/Av2: é um item só, valendo 10. Ali a regra do manual não se
       aplica, então mostramos só a nota, sem situação. */
    r.hasAv = !!f1;
    r.label = r.hasAv ? "Av1" : "Nota";
    r.av1Max = f1 && f1.PointsDenominator ? f1.PointsDenominator : r.total;
    if (released[2]) r.av2 = f2.PointsNumerator;
    if (released[3]) r.av3 = f3.PointsNumerator;
    r.c = tally(items);
    /* Só a Av1 decide se já dá para dizer quanto falta na Av2. */
    r.c1 = tally(
      items.filter(function (it) {
        return it.av === 1;
      })
    );
    return r;
  }

  /* ---------------------------------------------------------------
   * Textos e peças de desenho comuns
   * ------------------------------------------------------------- */
  function standing(r) {
    if (!r.hasAv) return null;
    /* O manual não diz como a Av3 entra na média final: só mostra a nota. */
    if (r.av3 !== null) return ["", "Nota da Av3 · " + formatNum(r.av3)];
    if (r.av2 !== null) {
      var sum = r.av1 + r.av2;
      if (sum >= PASS_MARK) return ["passed", "Aprovado · " + formatNum(sum)];
      if (sum >= RECOVERY_MARK) return ["recovery", "Av3 (recuperação) · " + formatNum(sum)];
      return ["failed", "Reprovado · " + formatNum(sum)];
    }
    if (r.c1.awaiting || r.c1.pending) return null;
    var needed = Math.max(0, PASS_MARK - r.av1);
    if (needed === 0) return ["passed", "Av1 já garante os " + formatNum(PASS_MARK)];
    return ["", "Precisa de " + formatNum(needed) + " na Av2"];
  }

  /* O estado que mais pede atenção num prazo. */
  function highlight(c) {
    if (c.started) return ["started", "⚠ " + plural(c.started, "não enviada", "não enviadas")];
    if (c.missed) return ["missed", plural(c.missed, "perdida", "perdidas")];
    if (c.awaiting) return ["awaiting", c.awaiting + " aguardando"];
    if (c.graded && c.graded === c.items.length) return ["graded", "corrigido"];
    if (c.todo) return ["", c.todo + " a fazer"];
    return ["", ""];
  }

  var STATE_LABEL = {
    graded: "corrigida",
    awaiting: "aguardando correção",
    started: "iniciada e não enviada",
    missed: "prazo perdido",
    todo: "a fazer"
  };

  /* Sempre os cinco estados, na mesma ordem, para o aluno aprender uma vez. */
  var LEGEND = [
    ["graded", "Corrigida"],
    ["awaiting", "Aguardando correção"],
    ["started", "Iniciada, não enviada"],
    ["missed", "Prazo perdido"],
    ["todo", "A fazer"]
  ];

  function segments(items, cls) {
    return (
      '<div class="eaa-seg' + (cls ? " " + cls : "") + '" aria-hidden="true">' +
      items
        .map(function (it) {
          return '<i class="' + it.state + '"></i>';
        })
        .join("") +
      "</div>"
    );
  }

  function when(g) {
    return g.deadline ? formatDate(g.deadline) + " · " + timeLeft(g.deadline) : "sem data";
  }

  function urgent(g) {
    return !!(g.deadline && g.deadline >= Date.now() && g.c.pending && daysUntil(g.deadline) <= 1);
  }

  return {
    courseData: courseData,
    preview: preview,
    name: name,
    forget: forget,
    restart: restart,
    dayOf: dayOf,
    daysUntil: daysUntil,
    formatDate: formatDate,
    formatTime: formatTime,
    timeLeft: timeLeft,
    formatNum: formatNum,
    plural: plural,
    esc: esc,
    tally: tally,
    standing: standing,
    highlight: highlight,
    segments: segments,
    when: when,
    urgent: urgent,
    STATE_LABEL: STATE_LABEL,
    LEGEND: LEGEND
  };
})();
