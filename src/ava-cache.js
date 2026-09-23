/* EAA+ · cache do AVA entre páginas
 *
 * O AVA responde "no-store" e recarrega a página inteira a cada clique,
 * então sem isto a página inicial relê as 9 disciplinas toda vez que o
 * aluno volta a ela. Regras (combinadas com o aluno em 2026-09-23):
 *   1. Validade de 10 minutos.
 *   2. Página de uma disciplina SEMPRE lê do servidor, e apaga a
 *      disciplina do cache ao entrar e ao sair: o aluno pode ter enviado
 *      algo ali. De volta à página inicial, só ela é lida de novo.
 *   3. Guarda os dados crus (enxutos por slim()), nunca o resultado: prazo
 *      vencido, "falta 2 dias" etc. são recalculados na hora (ava-rules.js).
 *   4. Só guarda leitura completa. Qualquer falha = nada guardado
 *      (ava-data.js decide).
 *   5. Chave com o id do aluno (data-global-context da página) e o
 *      formato. Sem id, sem cache.
 *
 * Onde fica: chrome.storage.session — só memória, só a extensão enxerga,
 * some ao fechar o navegador. Qualquer erro do storage = segue sem cache.
 */

EAAPlus.avaCache = (function () {
  "use strict";

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

  /* Devolve { format, user, readAt, value } ou null (ausente, vencido, de
     outro aluno, formato antigo ou storage indisponível). */
  function read(key) {
    var me = currentUserId();
    if (!me || noStore[key]) return Promise.resolve(null);
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

  /* Botão Atualizar: esvazia tudo; leituras feitas enquanto isso esperam. */
  function clear() {
    clearing = forgetAll();
    return clearing;
  }

  /* Pela URL, antes de qualquer leitura: /d2l/home/{ou}, /d2l/le/lessons/{ou}/…
     e as páginas ?ou={ou}. A barra da disciplina confirma pelo link
     "Início do Curso" (forget() de novo, se a URL não tiver o id). */
  var pageOu = (location.search.match(/[?&]ou=(\d+)/) ||
    location.pathname.match(/^\/d2l\/(?:home|le\/[a-z]+)\/(\d+)(?:\/|$)/) || [])[1];
  if (pageOu) forget(pageOu);
  window.addEventListener("pagehide", function () {
    Object.keys(noStore).forEach(forget);
  });

  /* Só os campos que classify()/summarize() usam. O caminho sem cache passa
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

  return {
    read: read,
    store: store,
    forget: forget,
    clear: clear,
    slim: slim
  };
})();
