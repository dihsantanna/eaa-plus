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
 * (/d2l/home/{id}), que existe em todas as rotas. Dados: src/ava-dados.js.
 */

EAAPlus.add({
  id: "ava-disciplina",

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
    var esc = A.esc;
    var ID = "eaa-disc";
    var VARREDURA_MS = 1000;
    var FOLGA = 16; /* distância mínima dos links do AVA */
    var MAX_COLUNAS = 2;

    var CHEVRON =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M6 9l6 6 6-6"/></svg>';

    function deep(raiz, teste) {
      var achado = null;
      (function andar(no) {
        var filhos = no.querySelectorAll("*");
        for (var i = 0; i < filhos.length && !achado; i++) {
          if (teste(filhos[i])) achado = filhos[i];
          else if (filhos[i].shadowRoot) andar(filhos[i].shadowRoot);
        }
      })(raiz);
      return achado;
    }

    function faixa() {
      var rodape = deep(nav, function (e) {
        return e.tagName === "D2L-LABS-NAVIGATION-MAIN-FOOTER";
      });
      if (!rodape) return null;
      var centro = (rodape.shadowRoot && rodape.shadowRoot.querySelector(".d2l-labs-navigation-centerer")) || rodape;
      return { rodape: rodape, centro: centro };
    }

    /* Colunas: no máximo duas — a próxima em aberto e a seguinte; se todas
       já passaram, as duas últimas. */
    function colunas(r) {
      var com = r.prazos.filter(function (g) {
        return g.prazo;
      });
      if (com.length <= MAX_COLUNAS) return r.prazos.slice(0, MAX_COLUNAS);
      var agora = Date.now();
      var i = 0;
      while (i < com.length && com[i].prazo < agora) i++;
      i = Math.min(i, com.length - MAX_COLUNAS);
      return com.slice(i, i + MAX_COLUNAS);
    }

    function coluna(g) {
      var d = A.destaque(g.c);
      var alerta = g.c.iniciada ? '<span class="eaa-d-alerta" aria-hidden="true">⚠</span>' : "";
      var dias = g.prazo ? A.falta(g.prazo) : "";
      var classe = "eaa-d-col" +
        (g.prazo && g.prazo < Date.now() ? " encerrado" : "") +
        (A.urgente(g) ? " urgente" : "") +
        (g.c.iniciada ? " iniciada" : "");
      return (
        '<span class="' + classe + '">' +
        '<span class="eaa-d-par"><span class="eaa-d-nome">' + esc(g.curto) + "</span>" +
        '<span class="eaa-d-data">' + alerta + (g.prazo ? A.data(g.prazo) : "—") + "</span></span>" +
        A.segmentos(g.c.itens) +
        '<span class="eaa-d-par eaa-d-leg"><span>' + g.c.entregues + " de " + g.c.itens.length + " entregues</span>" +
        '<span class="eaa-d-dias">' + esc(dias) + "</span></span>" +
        '<span class="eaa-d-oculto">' + esc(d[1]) + "</span>" +
        "</span>"
      );
    }

    function leitura(r, cols) {
      return (
        "Progresso das avaliações. " + r.rotulo + ": " + A.num(r.av1) + " de " + A.num(r.av1Max) + ". " +
        cols
          .map(function (g) {
            return g.curto + ", " + A.quando(g) + ": " + g.c.entregues + " de " + g.c.itens.length + " entregues";
          })
          .join(". ") +
        ". Abrir detalhes."
      );
    }

    function painel(r) {
      var s = A.situacao(r);
      return (
        '<div class="eaa-d-pcab"><span>Avaliações da disciplina</span>' +
        '<span class="eaa-d-pnota">' + r.rotulo + " · " + A.num(r.av1) + " / " + A.num(r.av1Max) + "</span></div>" +
        r.prazos
          .map(function (g) {
            return (
              '<section class="eaa-d-grupo">' +
              '<h3 class="eaa-d-gcab"><span>' + esc(g.longo === "Próximo prazo" ? g.curto : g.longo) + "</span>" +
              "<span>" + (g.prazo ? A.data(g.prazo) + " às " + A.hora(g.prazo) + " · " + A.falta(g.prazo, true) : "sem data") + "</span></h3>" +
              "<ul>" +
              g.c.itens
                .map(function (it) {
                  var nome = it.link
                    ? '<a class="eaa-d-inome" href="' + esc(it.link) + '">' + esc(it.nome) + "</a>"
                    : '<span class="eaa-d-inome">' + esc(it.nome) + "</span>";
                  return (
                    '<li class="' + it.estado + '"><i aria-hidden="true"></i>' + nome +
                    '<span class="eaa-d-estado">' + A.ROTULO[it.estado] + "</span></li>"
                  );
                })
                .join("") +
              "</ul></section>"
            );
          })
          .join("") +
        (s ? '<div class="eaa-d-sit ' + s[0] + '">' + s[1] + "</div>" : "")
      );
    }

    function html(r) {
      var cols = colunas(r);
      return (
        '<button type="button" class="eaa-d-botao" aria-expanded="false" aria-controls="eaa-d-painel" aria-label="' +
        esc(leitura(r, cols)) + '">' +
        '<span class="eaa-d-nota"><span class="eaa-d-rot">' + r.rotulo + "</span>" +
        '<span class="eaa-d-val">' + A.num(r.av1) + " / " + A.num(r.av1Max) + "</span></span>" +
        cols.map(coluna).join("") +
        '<span class="eaa-d-seta">' + CHEVRON + "</span>" +
        "</button>" +
        '<div class="eaa-d-painel" id="eaa-d-painel" role="region" aria-label="Avaliações da disciplina" hidden>' +
        painel(r) +
        "</div>"
      );
    }

    /* ---------------------------------------------------------------
     * Posição: dentro da faixa azul, alinhada à borda direita do conteúdo
     * ------------------------------------------------------------- */
    function limiteDosLinks(f, caixa) {
      var direita = 0;
      var itens = f.rodape.querySelectorAll("a, [role=link], button, d2l-labs-navigation-link, d2l-labs-navigation-dropdown-button-custom");
      [].forEach.call(itens, function (e) {
        if (caixa.contains(e)) return;
        var r = e.getBoundingClientRect();
        if (r.width && r.right > direita) direita = r.right;
      });
      return direita;
    }

    function posicionar(caixa) {
      var f = faixa();
      if (!f) return;
      var n = nav.getBoundingClientRect();
      var b = f.rodape.getBoundingClientRect();
      var c = f.centro.getBoundingClientRect();
      var padDir = parseFloat(getComputedStyle(f.centro).paddingRight) || 0;
      caixa.style.top = Math.round(b.top - n.top) + "px";
      caixa.style.height = Math.round(b.height) + "px";
      caixa.style.right = Math.max(0, Math.round(n.right - (c.right - padDir))) + "px";

      /* Primeiro tenta inteira; se encostar nos links, compacta; se ainda
         encostar, some. */
      var limite = limiteDosLinks(f, caixa) + FOLGA;
      caixa.classList.remove("compacto", "sem-espaco");
      if (caixa.getBoundingClientRect().left < limite) caixa.classList.add("compacto");
      if (caixa.getBoundingClientRect().left < limite) {
        caixa.classList.add("sem-espaco");
        fechar(caixa);
      }
    }

    /* ---------------------------------------------------------------
     * Carregando: mesma largura e mesmas colunas do resultado, com blocos
     * neutros no lugar do texto. O botão fica desativado até os dados chegarem.
     * ------------------------------------------------------------- */
    function vazio(largura) {
      return '<span class="eaa-d-vazio" style="width:' + largura + 'px"></span>';
    }

    function htmlCarregando() {
      var col =
        '<span class="eaa-d-col">' +
        '<span class="eaa-d-par"><span class="eaa-d-nome">%NOME%</span>' + vazio(32) + "</span>" +
        '<div class="eaa-seg" aria-hidden="true"><i></i></div>' +
        '<span class="eaa-d-par eaa-d-leg">' + vazio(88) + vazio(32) + "</span>" +
        "</span>";
      return (
        '<button type="button" class="eaa-d-botao" disabled aria-label="Carregando o progresso das avaliações">' +
        '<span class="eaa-d-nota">' + vazio(24) + '<span class="eaa-d-val">' + vazio(56) + "</span></span>" +
        col.replace("%NOME%", "carregando…") +
        col.replace("%NOME%", vazio(80)) +
        '<span class="eaa-d-seta">' + CHEVRON + "</span>" +
        "</button>"
      );
    }

    /* ---------------------------------------------------------------
     * Abrir e fechar o painel (eventos delegados: o conteúdo é trocado)
     * ------------------------------------------------------------- */
    function fechar(caixa) {
      var botao = caixa && caixa.querySelector(".eaa-d-botao");
      var p = caixa && caixa.querySelector(".eaa-d-painel");
      if (!botao || !p || p.hidden) return;
      p.hidden = true;
      botao.setAttribute("aria-expanded", "false");
    }

    function alternar(caixa) {
      var botao = caixa.querySelector(".eaa-d-botao");
      var p = caixa.querySelector(".eaa-d-painel");
      if (!botao || !p || botao.disabled) return;
      var abrir = p.hidden;
      p.hidden = !abrir;
      botao.setAttribute("aria-expanded", String(abrir));
    }

    document.addEventListener("click", function (ev) {
      var caixa = document.getElementById(ID);
      if (!caixa) return;
      if (!caixa.contains(ev.target)) return fechar(caixa);
      if (ev.target.closest && ev.target.closest(".eaa-d-botao")) alternar(caixa);
    });
    document.addEventListener("keydown", function (ev) {
      var caixa = document.getElementById(ID);
      var p = caixa && caixa.querySelector(".eaa-d-painel");
      if (ev.key === "Escape" && p && !p.hidden) {
        fechar(caixa);
        caixa.querySelector(".eaa-d-botao").focus();
      }
    });

    /* ---------------------------------------------------------------
     * Montagem
     * ------------------------------------------------------------- */
    var conteudo = htmlCarregando();
    var carregando = true;
    var relogio = null;

    function garantir() {
      var caixa = document.getElementById(ID);
      if (!conteudo) {
        if (caixa) caixa.remove();
        return;
      }
      if (!caixa || !nav.contains(caixa)) {
        if (caixa) caixa.remove();
        caixa = document.createElement("div");
        caixa.id = ID;
        nav.appendChild(caixa);
      }
      if (caixa.getAttribute("data-conteudo") !== conteudo) {
        caixa.setAttribute("data-conteudo", conteudo);
        caixa.innerHTML = conteudo;
      }
      caixa.setAttribute("aria-busy", carregando ? "true" : "false");
      posicionar(caixa);
    }

    function parar() {
      conteudo = null;
      garantir();
      clearInterval(relogio);
      window.removeEventListener("resize", garantir);
    }

    garantir();
    relogio = setInterval(function () {
      /* a faixa pode ser redesenhada pelo AVA (ex.: navegação interna do
         Conteúdo); a varredura recoloca e realinha */
      var atual = document.querySelector("nav.d2l-navigation-s");
      if (atual && atual !== nav) nav = atual;
      garantir();
    }, VARREDURA_MS);
    window.addEventListener("resize", garantir);

    A.dados(ou).then(
      function (r) {
        if (!r.total) return parar();
        carregando = false;
        conteudo = html(r);
        garantir();
      },
      function (erro) {
        parar();
        if (window.console && console.warn) console.warn("[EAA+] barra da disciplina " + ou + ":", erro);
      }
    );
    return true;
  }
});
