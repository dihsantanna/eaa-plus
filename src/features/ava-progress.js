/* EAA+ · melhoria: progresso nas disciplinas (página inicial do AVA)
 *
 * Página: batistas.brightspace.com/d2l/home
 *
 * 1. Em cada card de "Minhas Disciplinas": a nota da Av1 e, para cada prazo
 *    (no curso de Música a Av1 fecha em duas datas: "Primeiro Fechamento" e
 *    "Último Fechamento"), uma barra com um bloco por atividade e o estado
 *    mais importante daquele prazo.
 * 2. Acima dos cards: o próximo prazo comum às disciplinas visíveis, quantas
 *    atividades já foram entregues e em quais disciplinas ainda falta algo.
 *
 * Os dados e as regras vêm de src/ava-data.js (EAAPlus.ava).
 *
 * Os cards ficam dentro de 4 camadas de shadow DOM e são recriados quando o
 * aluno troca de aba. Por isso a melhoria procura cards novos a cada segundo
 * em vez de observar mutações, que não atravessam shadow roots. Se algo
 * falhar, o card fica exatamente como era.
 */

EAAPlus.add({
  id: "ava-progress",

  init: function () {
    /* O bloco do AVA roda em todas as páginas /d2l/; esta é só a inicial. */
    if (!/^\/d2l\/home\/?$/.test(location.pathname)) return true;
    var root = document.querySelector("d2l-my-courses-v2");
    if (!root) return false;

    var A = EAAPlus.ava;
    var esc = A.esc;
    var MARK = "eaa-prog";
    var SUMMARY_ID = "eaa-summary";
    var SCAN_MS = 1000;

    /* Grade de 4px. Toda linha é "rótulo | valor" com as mesmas margens. */
    var CSS =
      ".eaa-prog{margin-top:12px;font:400 12px/16px Lato,'Lucida Sans Unicode',sans-serif;color:var(--eaa-text);display:grid;gap:8px}" +
      ".eaa-prog *{box-sizing:border-box;margin:0;padding:0}" +
      ".eaa-pair{display:flex;justify-content:space-between;align-items:baseline;gap:8px;min-width:0}" +
      ".eaa-pair>:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".eaa-pair>:last-child{flex:none;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}" +
      ".eaa-head{font-weight:700;color:var(--eaa-ink)}" +
      ".eaa-head>:last-child{font-size:13px}" +
      ".eaa-deadline{display:grid;gap:4px}" +
      ".eaa-deadline .eaa-name{font-weight:700;color:var(--eaa-ink)}" +
      ".eaa-deadline.urgent .eaa-when{color:var(--eaa-missed);font-weight:700}" +
      ".eaa-deadline.closed{opacity:.72}" +
      ".eaa-seg{display:flex;gap:2px;height:6px}" +
      ".eaa-seg i{flex:1 1 0;border-radius:3px;background:var(--eaa-track)}" +
      ".eaa-seg .graded{background:var(--eaa-graded)}" +
      ".eaa-seg .awaiting{background:var(--eaa-awaiting)}" +
      ".eaa-seg .started{background:var(--eaa-started)}" +
      ".eaa-seg .missed{background:var(--eaa-missed)}" +
      ".eaa-caption{color:var(--eaa-muted)}" +
      ".eaa-tag{font-weight:700}" +
      ".eaa-tag.graded{color:var(--eaa-graded-text)}" +
      ".eaa-tag.awaiting{color:var(--eaa-awaiting-text)}" +
      ".eaa-tag.started{color:var(--eaa-started-text)}" +
      ".eaa-tag.missed{color:var(--eaa-missed)}" +
      ".eaa-standing{height:24px;line-height:24px;border-radius:4px;text-align:center;font-weight:700;background:var(--eaa-neutral-bg);color:var(--eaa-ink)}" +
      ".eaa-standing.passed{background:var(--eaa-passed-bg);color:var(--eaa-graded-text)}" +
      ".eaa-standing.recovery{background:var(--eaa-recovery-bg);color:var(--eaa-awaiting-text)}" +
      ".eaa-standing.failed{background:var(--eaa-failed-bg);color:var(--eaa-failed-text)}" +
      ".eaa-loading{color:var(--eaa-muted);font-style:italic}" +
      /* Simetria entre cards vizinhos: os títulos têm 1 a 3 linhas, então o
         bloco visível fica preso ao pé do card (o .d2l-card-container é
         position:relative) e uma cópia invisível reserva a altura. */
      ".eaa-prog.ghost{visibility:hidden}" +
      ".eaa-prog.real{position:absolute;left:16px;right:16px;bottom:24px;margin:0}";

    /* ---------------------------------------------------------------
     * Desenho dentro do card
     * ------------------------------------------------------------- */
    function deadlineRow(g) {
      var d = A.highlight(g.c);
      var when = A.when(g);
      var closed = g.deadline && g.deadline < Date.now();
      var ariaText =
        g.shortLabel + ", " + when + ": " +
        g.c.items
          .map(function (it) {
            return it.name + " " + A.STATE_LABEL[it.state];
          })
          .join("; ");
      return (
        '<div class="eaa-deadline' + (closed ? " closed" : "") + (A.urgent(g) ? " urgent" : "") +
        '" role="group" aria-label="' + esc(ariaText) + '">' +
        '<div class="eaa-pair"><span class="eaa-name">' + esc(g.shortLabel) + '</span><span class="eaa-when">' + esc(when) + "</span></div>" +
        A.segments(g.c.items) +
        '<div class="eaa-pair eaa-caption"><span>' + g.c.delivered + " de " + g.c.items.length + " entregues</span>" +
        '<span class="eaa-tag ' + d[0] + '">' + d[1] + "</span></div>" +
        "</div>"
      );
    }

    function html(r) {
      var out =
        '<div class="eaa-pair eaa-head"><span class="eaa-label">' + r.label + "</span>" +
        '<span class="eaa-val">' + A.formatNum(r.av1) + " / " + A.formatNum(r.av1Max) + "</span></div>" +
        r.deadlines.map(deadlineRow).join("");
      var s = A.standing(r);
      if (s) out += '<div class="eaa-standing ' + s[0] + '">' + s[1] + "</div>";
      return out;
    }

    function prepare(shadow) {
      if (!shadow.querySelector("style[data-eaa]")) {
        var styleEl = document.createElement("style");
        styleEl.setAttribute("data-eaa", "");
        styleEl.textContent = CSS;
        shadow.appendChild(styleEl);
      }
    }

    /* ---------------------------------------------------------------
     * Resumo acima dos cards: o próximo prazo de todas as visíveis
     * ------------------------------------------------------------- */
    var ready = {}; /* ou → { r, nome } */

    function overallSummary(visible) {
      var now = Date.now();
      var target = null;
      visible.forEach(function (ou) {
        var p = ready[ou];
        if (!p) return;
        p.r.deadlines.forEach(function (g) {
          if (g.deadline && g.deadline >= now && (!target || A.dayOf(g.deadline) < target)) target = A.dayOf(g.deadline);
        });
      });
      if (!target) return null;

      var res = { deadline: 0, longLabel: "", items: [], courses: [], startedCount: 0, readAt: null };
      visible.forEach(function (ou) {
        var p = ready[ou];
        if (!p) return;
        /* o dado mais antigo na tela (cache de até 10 min) */
        if (p.r.readAt && (!res.readAt || p.r.readAt < res.readAt)) res.readAt = p.r.readAt;
        p.r.deadlines.forEach(function (g) {
          if (!g.deadline || A.dayOf(g.deadline) !== target) return;
          res.deadline = Math.max(res.deadline, g.deadline);
          if (!res.longLabel && g.named) res.longLabel = g.longLabel;
          res.items = res.items.concat(g.c.items);
          res.startedCount += g.c.started;
          if (g.c.pending) res.courses.push({ ou: ou, name: p.name, pending: g.c.pending, started: g.c.started });
        });
      });
      res.c = A.tally(res.items);
      res.longLabel = res.longLabel || "Próximo prazo";
      return res;
    }

    function shortLabel(name) {
      var before = name.split(":")[0].trim();
      return before.length >= 3 ? before : name;
    }

    /* Uma legenda só, no resumo (os cards não têm largura para ela). */
    function legend() {
      return (
        '<ul class="eaa-r-legend" aria-label="Legenda das cores">' +
        A.LEGEND.map(function (l) {
          return '<li><i class="' + l[0] + '"></i>' + l[1] + "</li>";
        }).join("") +
        "</ul>"
      );
    }

    /* Os dados podem vir do cache (até 10 min): a idade fica à vista e o
       aluno força uma leitura nova com um clique. Mesma linha no
       carregamento, para a altura não pular. */
    function footer(readAt) {
      return (
        '<div class="eaa-r-pair eaa-r-footer"><span>' + (readAt ? "Atualizado às " + A.formatTime(readAt) : "&nbsp;") + "</span>" +
        '<button type="button" class="eaa-r-refresh" title="Ler de novo notas e entregas de todas as disciplinas"' +
        (readAt ? "" : " disabled") + ">Atualizar</button></div>"
      );
    }

    function summaryHtml(res) {
      var urgent = res.c.pending && A.daysUntil(res.deadline) <= 1;
      var everything = !res.c.pending;
      var rightHtml = everything
        ? '<span class="eaa-r-tag graded">✓ tudo entregue</span>'
        : '<span class="eaa-r-tag' + (res.startedCount ? " started" : "") + '">' +
          (res.startedCount ? "⚠ " + A.plural(res.startedCount, "não enviada", "não enviadas") + " · " : "") +
          "faltam " + res.c.pending + "</span>";
      var chips = res.courses
        .map(function (d) {
          return (
            '<a class="eaa-r-chip' + (d.started ? " started" : "") + '" href="/d2l/home/' + d.ou + '" title="' + esc(d.name) + '">' +
            '<span class="eaa-r-cname">' + esc(shortLabel(d.name)) + '</span><span class="eaa-r-cnum">' + d.pending + "</span></a>"
          );
        })
        .join("");
      return (
        '<div class="eaa-r-pair"><span class="eaa-r-title">' + esc(res.longLabel) + "</span>" +
        '<span class="eaa-r-when' + (urgent ? " urgent" : "") + '">' +
        A.formatDate(res.deadline) + " às " + A.formatTime(res.deadline) + " · " + A.timeLeft(res.deadline, true) + "</span></div>" +
        A.segments(res.c.items, "eaa-r-seg") +
        '<div class="eaa-r-pair eaa-r-caption"><span>' + res.c.delivered + " de " + res.c.items.length +
        " atividades entregues</span>" + rightHtml + "</div>" +
        (chips ? '<div class="eaa-r-chips">' + chips + "</div>" : "") +
        legend() +
        footer(res.readAt)
      );
    }

    /* Enquanto houver disciplina visível sem resposta, o resumo fica em
       carregamento: somar só as que chegaram mostraria números errados
       ("faltam 2", depois "faltam 5"). A moldura e as linhas são as mesmas do
       resultado, para nada pular quando terminar. Erro também conta como
       resposta; e depois de ESPERA_MAX mostra o que tiver, em vez de girar
       para sempre por causa de uma disciplina que não responde. */
    var resolved = {};
    var loadStart = null;
    var MAX_WAIT_MS = 20000;

    function loadingHtml(readyCount, total) {
      var pct = total ? Math.round((readyCount / total) * 100) : 0;
      return (
        '<div class="eaa-r-pair"><span class="eaa-r-title">Próximo prazo</span>' +
        '<span class="eaa-r-when eaa-r-status" role="status">carregando ' + readyCount + " de " + total + " disciplinas…</span></div>" +
        '<div class="eaa-r-progress" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
        '<div class="eaa-r-pair eaa-r-caption"><span>Lendo notas e entregas no AVA</span><span></span></div>' +
        '<div class="eaa-r-chips" aria-hidden="true">' +
        '<span class="eaa-r-chip eaa-r-empty" style="width:128px"></span>' +
        '<span class="eaa-r-chip eaa-r-empty" style="width:96px"></span>' +
        '<span class="eaa-r-chip eaa-r-empty" style="width:152px"></span></div>' +
        legend() +
        footer(null)
      );
    }

    function updateSummary(visible) {
      var target = document.querySelector("d2l-my-courses-v2");
      if (!target || !target.parentNode) return;
      var box = document.getElementById(SUMMARY_ID);
      var hide = function () {
        if (box) box.remove();
      };
      if (!visible.length) return hide();

      var missing = visible.filter(function (ou) {
        return !resolved[ou];
      }).length;
      if (!missing) loadStart = null;
      else if (loadStart === null) loadStart = Date.now();
      var loading = missing > 0 && Date.now() - loadStart < MAX_WAIT_MS;

      var fresh;
      if (loading) {
        fresh = loadingHtml(visible.length - missing, visible.length);
      } else {
        var res = overallSummary(visible);
        if (!res || !res.c.items.length) return hide();
        fresh = summaryHtml(res);
      }

      if (!box) {
        box = document.createElement("section");
        box.id = SUMMARY_ID;
        box.setAttribute("aria-label", "Próximo prazo das disciplinas");
        box.addEventListener("click", function (ev) {
          var b = ev.target.closest && ev.target.closest(".eaa-r-refresh");
          if (b && !b.disabled) refreshAll();
        });
      }
      box.setAttribute("aria-busy", loading ? "true" : "false");
      if (box.nextSibling !== target) target.parentNode.insertBefore(box, target);
      if (box.getAttribute("data-html") !== fresh) {
        box.setAttribute("data-html", fresh);
        box.innerHTML = fresh;
      }
    }

    /* ---------------------------------------------------------------
     * Cards
     * ------------------------------------------------------------- */
    /* Disciplina sem atividades ou com erro: não volta a montar o bloco a
       cada varredura (evita piscar "Carregando…" e ler de novo). */
    var noBlock = {};
    /* Sobe a cada Atualizar: bloco de geração antiga é lido de novo, e
       resposta que chega de uma geração antiga é descartada. */
    var generation = 0;

    function process(card, ou) {
      if (noBlock[ou]) return;
      var shadow = card.shadowRoot;
      var d2lCard = shadow && shadow.querySelector("d2l-card");
      if (!d2lCard) return;
      var header = d2lCard.querySelector(".d2l-enrollment-card-content-flex");
      if (!header) return; /* ainda montando */

      var ghost = d2lCard.querySelector("." + MARK + ".ghost");
      var block = d2lCard.querySelector("." + MARK + ".real");
      if (ghost && block && block.getAttribute("data-generation") === String(generation)) return;
      var write = function (content) {
        ghost.innerHTML = block.innerHTML = content;
      };
      var removeBlocks = function () {
        ghost.remove();
        block.remove();
      };

      /* Bloco que já existe (Atualizar): fica com o dado antigo até o novo
         chegar, para o card não encolher e crescer de novo. */
      if (!ghost || !block) {
        if (ghost) ghost.remove();
        if (block) block.remove();
        prepare(shadow);
        ghost = document.createElement("div");
        ghost.className = MARK + " ghost";
        ghost.setAttribute("slot", "content");
        ghost.setAttribute("aria-hidden", "true");
        block = document.createElement("div");
        block.className = MARK + " real";
        block.setAttribute("slot", "content");
        write('<span class="eaa-loading">Carregando progresso…</span>');
        d2lCard.appendChild(ghost);
        d2lCard.appendChild(block);
      }
      var myGeneration = generation;
      block.setAttribute("data-generation", String(myGeneration));

      /* nome: uma leitura só para todas as disciplinas (EAAPlus.ava.nome) */
      Promise.all([A.courseData(ou), A.name(ou)]).then(
        function (pair) {
          if (myGeneration !== generation) return;
          var r = pair[0];
          resolved[ou] = true;
          if (!r.total) {
            noBlock[ou] = true;
            return removeBlocks();
          }
          ready[ou] = { r: r, name: pair[1] || "Disciplina" };
          write(html(r));
        },
        function (err) {
          if (myGeneration !== generation) return;
          resolved[ou] = true;
          noBlock[ou] = true;
          removeBlocks();
          if (window.console && console.warn) console.warn("[EAA+] progresso da disciplina " + ou + ":", err);
        }
      );
    }

    /* Botão Atualizar: lê tudo de novo do servidor SEM recarregar a página
       (o AVA pediria de novo ~250 arquivos). O resumo volta ao carregamento
       — mesma altura — e os cards trocam o conteúdo quando o dado chega. */
    function refreshAll() {
      generation++;
      ready = {};
      resolved = {};
      noBlock = {};
      loadStart = null;
      A.restart();
      scan();
    }

    function cards(node, out) {
      var kids = node.querySelectorAll("*");
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        if (el.tagName === "D2L-MY-COURSES-ENROLLMENT-CARD") out.push(el);
        else if (el.shadowRoot) cards(el.shadowRoot, out);
      }
      return out;
    }

    function scan() {
      var r = document.querySelector("d2l-my-courses-v2");
      if (!r || !r.shadowRoot) return;
      var visible = [];
      cards(r.shadowRoot, []).forEach(function (card) {
        var ou = (card.id || "").replace(/^enrollment-card-/, "");
        /* Só os visíveis: as outras abas carregam quando forem abertas. */
        if (!/^\d+$/.test(ou) || !card.getClientRects().length) return;
        visible.push(ou);
        process(card, ou);
      });
      updateSummary(visible);
    }

    scan();
    setInterval(scan, SCAN_MS);
    return true;
  }
});
