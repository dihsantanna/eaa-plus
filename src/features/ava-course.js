/* EAA+ · melhoria: barra de progresso da disciplina
 *
 * Páginas: qualquer página de uma disciplina no AVA (início, conteúdo,
 * atividades, tarefas, notas, avisos, lista de classe...). Todas têm a mesma
 * faixa azul de navegação da disciplina (d2l-labs-navigation-main-footer), com
 * espaço livre à direita dos links. A barra mora ali:
 *
 *   Av1        1º Fechamento   28/09   2º Fechamento   26/10    ⌄
 *   2,5 / 5,0  ▮▮▯▯                    ▯▯▯▯
 *              1 de 4 entregues 5 dias 0 de 4 entregues 33 dias
 *
 * Por que na faixa e não numa faixa nova abaixo: a página de Conteúdo é um
 * app com altura calculada pela janela; qualquer coisa inserida no fluxo
 * empurra o rodapé da aula para fora da tela. Na faixa, nada se mexe.
 *
 * Clicar abre um painel com cada atividade (cor, nome, estado, link). Se a
 * janela for estreita demais, a barra fica compacta; se nem assim couber,
 * some — nunca cobre os links do próprio AVA.
 *
 * A disciplina é identificada pelo link "Início do Curso" da própria faixa
 * (/d2l/home/{id}), que existe em todas as rotas. Dados: src/ava-data.js.
 */

EAAPlus.add({
  id: "ava-course",

  init: function () {
    var nav = document.querySelector("nav.d2l-navigation-s");
    if (!nav) return false;
    var ou = null;
    [].some.call(nav.querySelectorAll("a[href]"), function (a) {
      var m = (a.getAttribute("href") || "").match(/^\/d2l\/home\/(\d+)\/?$/);
      if (m) ou = m[1];
      return !!m;
    });
    /* Sem o link "Início do Curso" não é página de disciplina (ou a faixa
       ainda está montando): o núcleo tenta de novo por 15s e desiste. */
    if (!ou) return false;

    var A = EAAPlus.ava;
    /* Nesta página o aluno pode enviar algo: a barra lê do servidor e a
       disciplina sai do cache (entrando e saindo) — ver ava-data.js. */
    A.forget(ou);
    var esc = A.esc;
    var ID = "eaa-course";
    var SCAN_MS = 1000;
    var GAP = 16; /* distância mínima dos links do AVA */
    var MAX_COLUMNS = 2;

    var CHEVRON =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M6 9l6 6 6-6"/></svg>';

    function deep(root, check) {
      var found = null;
      (function walk(node) {
        var kids = node.querySelectorAll("*");
        for (var i = 0; i < kids.length && !found; i++) {
          if (check(kids[i])) found = kids[i];
          else if (kids[i].shadowRoot) walk(kids[i].shadowRoot);
        }
      })(root);
      return found;
    }

    function band() {
      var footer = deep(nav, function (e) {
        return e.tagName === "D2L-LABS-NAVIGATION-MAIN-FOOTER";
      });
      if (!footer) return null;
      var center = (footer.shadowRoot && footer.shadowRoot.querySelector(".d2l-labs-navigation-centerer")) || footer;
      return { footer: footer, center: center };
    }

    /* Colunas: no máximo duas — a próxima em aberto e a seguinte; se todas
       já passaram, as duas últimas. */
    function columns(r) {
      var dated = r.deadlines.filter(function (g) {
        return g.deadline;
      });
      if (dated.length <= MAX_COLUMNS) return r.deadlines.slice(0, MAX_COLUMNS);
      var now = Date.now();
      var i = 0;
      while (i < dated.length && dated[i].deadline < now) i++;
      i = Math.min(i, dated.length - MAX_COLUMNS);
      return dated.slice(i, i + MAX_COLUMNS);
    }

    function column(g) {
      var d = A.highlight(g.c);
      var alert = g.c.started ? '<span class="eaa-d-alert" aria-hidden="true">⚠</span>' : "";
      var days = g.deadline ? A.timeLeft(g.deadline) : "";
      var cls = "eaa-d-col" +
        (g.deadline && g.deadline < Date.now() ? " closed" : "") +
        (A.urgent(g) ? " urgent" : "") +
        (g.c.started ? " started" : "");
      return (
        '<span class="' + cls + '">' +
        '<span class="eaa-d-pair"><span class="eaa-d-name">' + esc(g.shortLabel) + "</span>" +
        '<span class="eaa-d-date">' + alert + (g.deadline ? A.formatDate(g.deadline) : "—") + "</span></span>" +
        A.segments(g.c.items) +
        '<span class="eaa-d-pair eaa-d-caption"><span>' + g.c.delivered + " de " + g.c.items.length + " entregues</span>" +
        '<span class="eaa-d-days">' + esc(days) + "</span></span>" +
        '<span class="eaa-d-hidden">' + esc(d[1]) + "</span>" +
        "</span>"
      );
    }

    function ariaText(r, cols) {
      return (
        "Progresso das avaliações. " + r.label + ": " + A.formatNum(r.av1) + " de " + A.formatNum(r.av1Max) + ". " +
        cols
          .map(function (g) {
            return g.shortLabel + ", " + A.when(g) + ": " + g.c.delivered + " de " + g.c.items.length + " entregues";
          })
          .join(". ") +
        ". Abrir detalhes."
      );
    }

    function panel(r) {
      var s = A.standing(r);
      return (
        '<div class="eaa-d-phead"><span>Avaliações da disciplina</span>' +
        '<span class="eaa-d-pgrade">' + r.label + " · " + A.formatNum(r.av1) + " / " + A.formatNum(r.av1Max) + "</span></div>" +
        r.deadlines
          .map(function (g) {
            return (
              '<section class="eaa-d-group">' +
              '<h3 class="eaa-d-ghead"><span>' + esc(g.longLabel === "Próximo prazo" ? g.shortLabel : g.longLabel) + "</span>" +
              "<span>" + (g.deadline ? A.formatDate(g.deadline) + " às " + A.formatTime(g.deadline) + " · " + A.timeLeft(g.deadline, true) : "sem data") + "</span></h3>" +
              "<ul>" +
              g.c.items
                .map(function (it) {
                  var name = it.link
                    ? '<a class="eaa-d-iname" href="' + esc(it.link) + '">' + esc(it.name) + "</a>"
                    : '<span class="eaa-d-iname">' + esc(it.name) + "</span>";
                  return (
                    '<li class="' + it.state + '"><i aria-hidden="true"></i>' + name +
                    '<span class="eaa-d-state">' + A.STATE_LABEL[it.state] + "</span></li>"
                  );
                })
                .join("") +
              "</ul></section>"
            );
          })
          .join("") +
        (s ? '<div class="eaa-d-standing ' + s[0] + '">' + s[1] + "</div>" : "")
      );
    }

    function html(r) {
      var cols = columns(r);
      return (
        '<button type="button" class="eaa-d-button" aria-expanded="false" aria-controls="eaa-d-panel" aria-label="' +
        esc(ariaText(r, cols)) + '">' +
        '<span class="eaa-d-grade"><span class="eaa-d-label">' + r.label + "</span>" +
        '<span class="eaa-d-val">' + A.formatNum(r.av1) + " / " + A.formatNum(r.av1Max) + "</span></span>" +
        cols.map(column).join("") +
        '<span class="eaa-d-arrow">' + CHEVRON + "</span>" +
        "</button>" +
        '<div class="eaa-d-panel" id="eaa-d-panel" role="region" aria-label="Avaliações da disciplina" hidden>' +
        panel(r) +
        "</div>"
      );
    }

    /* ---------------------------------------------------------------
     * Posição: dentro da faixa azul, alinhada à borda direita do conteúdo
     * ------------------------------------------------------------- */
    function linksLimit(f, box) {
      var rightHtml = 0;
      var items = f.footer.querySelectorAll("a, [role=link], button, d2l-labs-navigation-link, d2l-labs-navigation-dropdown-button-custom");
      [].forEach.call(items, function (e) {
        if (box.contains(e)) return;
        var r = e.getBoundingClientRect();
        if (r.width && r.right > rightHtml) rightHtml = r.right;
      });
      return rightHtml;
    }

    function place(box) {
      var f = band();
      if (!f) return;
      var n = nav.getBoundingClientRect();
      var b = f.footer.getBoundingClientRect();
      var c = f.center.getBoundingClientRect();
      var padRight = parseFloat(getComputedStyle(f.center).paddingRight) || 0;
      box.style.top = Math.round(b.top - n.top) + "px";
      box.style.height = Math.round(b.height) + "px";
      box.style.right = Math.max(0, Math.round(n.right - (c.right - padRight))) + "px";

      /* Primeiro tenta inteira; se encostar nos links, compacta; se ainda
         encostar, some. */
      var limit = linksLimit(f, box) + GAP;
      box.classList.remove("compact", "no-room");
      if (box.getBoundingClientRect().left < limit) box.classList.add("compact");
      if (box.getBoundingClientRect().left < limit) {
        box.classList.add("no-room");
        closePanel(box);
      }
    }

    /* ---------------------------------------------------------------
     * Carregando: mesma largura e mesmas colunas do resultado, com blocos
     * neutros no lugar do texto. O botão fica desativado até os dados chegarem.
     * O número de colunas e o rótulo vêm da prévia (o boletim, primeira
     * leitura da fila): com "Nota AV1" são 2 colunas, sem, 1 — assim o
     * resultado entra sem mudar de largura.
     * ------------------------------------------------------------- */
    function empty(boxWidth) {
      return '<span class="eaa-d-empty" style="width:' + boxWidth + 'px"></span>';
    }

    function loadingHtml(p) {
      var col =
        '<span class="eaa-d-col">' +
        '<span class="eaa-d-pair"><span class="eaa-d-name">%NOME%</span>' + empty(32) + "</span>" +
        '<div class="eaa-seg" aria-hidden="true"><i></i></div>' +
        '<span class="eaa-d-pair eaa-d-caption">' + empty(88) + empty(32) + "</span>" +
        "</span>";
      return (
        '<button type="button" class="eaa-d-button" disabled aria-label="Carregando o progresso das avaliações">' +
        '<span class="eaa-d-grade"><span class="eaa-d-label">' + p.label + '</span><span class="eaa-d-val">' + empty(56) + "</span></span>" +
        col.replace("%NOME%", "carregando…") +
        (p.columns > 1 ? col.replace("%NOME%", empty(80)) : "") +
        '<span class="eaa-d-arrow">' + CHEVRON + "</span>" +
        "</button>"
      );
    }

    /* ---------------------------------------------------------------
     * Abrir e fechar o painel (eventos delegados: o conteúdo é trocado)
     * ------------------------------------------------------------- */
    function closePanel(box) {
      var button = box && box.querySelector(".eaa-d-button");
      var p = box && box.querySelector(".eaa-d-panel");
      if (!button || !p || p.hidden) return;
      p.hidden = true;
      button.setAttribute("aria-expanded", "false");
    }

    function togglePanel(box) {
      var button = box.querySelector(".eaa-d-button");
      var p = box.querySelector(".eaa-d-panel");
      if (!button || !p || button.disabled) return;
      var open = p.hidden;
      p.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
    }

    document.addEventListener("click", function (ev) {
      var box = document.getElementById(ID);
      if (!box) return;
      if (!box.contains(ev.target)) return closePanel(box);
      if (ev.target.closest && ev.target.closest(".eaa-d-button")) togglePanel(box);
    });
    document.addEventListener("keydown", function (ev) {
      var box = document.getElementById(ID);
      var p = box && box.querySelector(".eaa-d-panel");
      if (ev.key === "Escape" && p && !p.hidden) {
        closePanel(box);
        box.querySelector(".eaa-d-button").focus();
      }
    });

    /* ---------------------------------------------------------------
     * Montagem
     * ------------------------------------------------------------- */
    var content = null; /* nada até a prévia dizer quantas colunas */
    var loading = true;
    var timer = null;

    function ensure() {
      var box = document.getElementById(ID);
      if (!content) {
        if (box) box.remove();
        return;
      }
      if (!box || !nav.contains(box)) {
        if (box) box.remove();
        box = document.createElement("div");
        box.id = ID;
        nav.appendChild(box);
      }
      if (box.getAttribute("data-content") !== content) {
        box.setAttribute("data-content", content);
        box.innerHTML = content;
      }
      box.setAttribute("aria-busy", loading ? "true" : "false");
      place(box);
    }

    function stop() {
      loading = false;
      content = null;
      ensure();
      clearInterval(timer);
      window.removeEventListener("resize", ensure);
    }

    ensure();
    timer = setInterval(function () {
      /* a faixa pode ser redesenhada pelo AVA (ex.: navegação interna do
         Conteúdo); a varredura recoloca e realinha */
      var current = document.querySelector("nav.d2l-navigation-s");
      if (current && current !== nav) nav = current;
      ensure();
    }, SCAN_MS);
    window.addEventListener("resize", ensure);

    A.preview(ou).then(
      function (p) {
        if (!loading) return; /* os dados completos chegaram antes */
        content = loadingHtml(p);
        ensure();
      },
      function () {}
    );

    A.courseData(ou).then(
      function (r) {
        if (!r.total) return stop();
        loading = false;
        content = html(r);
        ensure();
      },
      function (err) {
        stop();
        if (window.console && console.warn) console.warn("[EAA+] barra da disciplina " + ou + ":", err);
      }
    );
    return true;
  }
});
