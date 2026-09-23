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
 * Os dados e as regras vêm de src/ava-dados.js (EAAPlus.ava).
 *
 * Os cards ficam dentro de 4 camadas de shadow DOM e são recriados quando o
 * aluno troca de aba. Por isso a melhoria procura cards novos a cada segundo
 * em vez de observar mutações, que não atravessam shadow roots. Se algo
 * falhar, o card fica exatamente como era.
 */

EAAPlus.add({
  id: "ava-progresso",

  init: function () {
    /* O bloco do AVA roda em todas as páginas /d2l/; esta é só a inicial. */
    if (!/^\/d2l\/home\/?$/.test(location.pathname)) return true;
    var raiz = document.querySelector("d2l-my-courses-v2");
    if (!raiz) return false;

    var A = EAAPlus.ava;
    var esc = A.esc;
    var MARCA = "eaa-prog";
    var RESUMO_ID = "eaa-resumo";
    var VARREDURA_MS = 1000;

    /* Grade de 4px. Toda linha é "rótulo | valor" com as mesmas margens. */
    var CSS =
      ".eaa-prog{margin-top:12px;font:400 12px/16px Lato,'Lucida Sans Unicode',sans-serif;color:#494c4e;display:grid;gap:8px}" +
      ".eaa-prog *{box-sizing:border-box;margin:0;padding:0}" +
      ".eaa-par{display:flex;justify-content:space-between;align-items:baseline;gap:8px;min-width:0}" +
      ".eaa-par>:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".eaa-par>:last-child{flex:none;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}" +
      ".eaa-cab{font-weight:700;color:#202122}" +
      ".eaa-cab>:last-child{font-size:13px}" +
      ".eaa-prazo{display:grid;gap:4px}" +
      ".eaa-prazo .eaa-nome{font-weight:700;color:#202122}" +
      ".eaa-prazo.urgente .eaa-quando{color:#cd2026;font-weight:700}" +
      ".eaa-prazo.encerrado{opacity:.72}" +
      ".eaa-seg{display:flex;gap:2px;height:6px}" +
      ".eaa-seg i{flex:1 1 0;border-radius:3px;background:#e3e9f1}" +
      ".eaa-seg .corrigida{background:#46a661}" +
      ".eaa-seg .aguardando{background:#ffba59}" +
      ".eaa-seg .iniciada{background:#e87511}" +
      ".eaa-seg .perdida{background:#cd2026}" +
      ".eaa-leg{color:#6e7477}" +
      ".eaa-tag{font-weight:700}" +
      ".eaa-tag.corrigida{color:#2c7a43}" +
      ".eaa-tag.aguardando{color:#8a5300}" +
      ".eaa-tag.iniciada{color:#b34f00}" +
      ".eaa-tag.perdida{color:#cd2026}" +
      ".eaa-sit{height:24px;line-height:24px;border-radius:4px;text-align:center;font-weight:700;background:#f1f5fb;color:#202122}" +
      ".eaa-sit.aprovado{background:#e8f5ec;color:#2c7a43}" +
      ".eaa-sit.recuperacao{background:#fff4e0;color:#8a5300}" +
      ".eaa-sit.reprovado{background:#fdecec;color:#a3181e}" +
      ".eaa-carregando{color:#6e7477;font-style:italic}" +
      /* Simetria entre cards vizinhos: os títulos têm 1 a 3 linhas, então o
         bloco visível fica preso ao pé do card (o .d2l-card-container é
         position:relative) e uma cópia invisível reserva a altura. */
      ".eaa-prog.fantasma{visibility:hidden}" +
      ".eaa-prog.real{position:absolute;left:16px;right:16px;bottom:24px;margin:0}";

    /* ---------------------------------------------------------------
     * Desenho dentro do card
     * ------------------------------------------------------------- */
    function linhaDoPrazo(g) {
      var d = A.destaque(g.c);
      var quando = A.quando(g);
      var encerrado = g.prazo && g.prazo < Date.now();
      var leitura =
        g.curto + ", " + quando + ": " +
        g.c.itens
          .map(function (it) {
            return it.nome + " " + A.ROTULO[it.estado];
          })
          .join("; ");
      return (
        '<div class="eaa-prazo' + (encerrado ? " encerrado" : "") + (A.urgente(g) ? " urgente" : "") +
        '" role="group" aria-label="' + esc(leitura) + '">' +
        '<div class="eaa-par"><span class="eaa-nome">' + esc(g.curto) + '</span><span class="eaa-quando">' + esc(quando) + "</span></div>" +
        A.segmentos(g.c.itens) +
        '<div class="eaa-par eaa-leg"><span>' + g.c.entregues + " de " + g.c.itens.length + " entregues</span>" +
        '<span class="eaa-tag ' + d[0] + '">' + d[1] + "</span></div>" +
        "</div>"
      );
    }

    function html(r) {
      var saida =
        '<div class="eaa-par eaa-cab"><span class="eaa-rot">' + r.rotulo + "</span>" +
        '<span class="eaa-val">' + A.num(r.av1) + " / " + A.num(r.av1Max) + "</span></div>" +
        r.prazos.map(linhaDoPrazo).join("");
      var s = A.situacao(r);
      if (s) saida += '<div class="eaa-sit ' + s[0] + '">' + s[1] + "</div>";
      return saida;
    }

    function preparar(sombra) {
      if (!sombra.querySelector("style[data-eaa]")) {
        var estilo = document.createElement("style");
        estilo.setAttribute("data-eaa", "");
        estilo.textContent = CSS;
        sombra.appendChild(estilo);
      }
    }

    /* ---------------------------------------------------------------
     * Resumo acima dos cards: o próximo prazo de todas as visíveis
     * ------------------------------------------------------------- */
    var prontos = {}; /* ou → { r, nome } */

    function resumoGeral(visiveis) {
      var agora = Date.now();
      var alvo = null;
      visiveis.forEach(function (ou) {
        var p = prontos[ou];
        if (!p) return;
        p.r.prazos.forEach(function (g) {
          if (g.prazo && g.prazo >= agora && (!alvo || A.diaDe(g.prazo) < alvo)) alvo = A.diaDe(g.prazo);
        });
      });
      if (!alvo) return null;

      var res = { prazo: 0, longo: "", itens: [], disciplinas: [], iniciadas: 0 };
      visiveis.forEach(function (ou) {
        var p = prontos[ou];
        if (!p) return;
        p.r.prazos.forEach(function (g) {
          if (!g.prazo || A.diaDe(g.prazo) !== alvo) return;
          res.prazo = Math.max(res.prazo, g.prazo);
          if (!res.longo && g.nomeado) res.longo = g.longo;
          res.itens = res.itens.concat(g.c.itens);
          res.iniciadas += g.c.iniciada;
          if (g.c.pendentes) res.disciplinas.push({ ou: ou, nome: p.nome, pendentes: g.c.pendentes, iniciada: g.c.iniciada });
        });
      });
      res.c = A.contar(res.itens);
      res.longo = res.longo || "Próximo prazo";
      return res;
    }

    function curto(nome) {
      var antes = nome.split(":")[0].trim();
      return antes.length >= 3 ? antes : nome;
    }

    /* Uma legenda só, no resumo (os cards não têm largura para ela). */
    function legenda() {
      return (
        '<ul class="eaa-r-legenda" aria-label="Legenda das cores">' +
        A.LEGENDA.map(function (l) {
          return '<li><i class="' + l[0] + '"></i>' + l[1] + "</li>";
        }).join("") +
        "</ul>"
      );
    }

    function htmlDoResumo(res) {
      var urgente = res.c.pendentes && A.diasAte(res.prazo) <= 1;
      var tudo = !res.c.pendentes;
      var direita = tudo
        ? '<span class="eaa-r-tag corrigida">✓ tudo entregue</span>'
        : '<span class="eaa-r-tag' + (res.iniciadas ? " iniciada" : "") + '">' +
          (res.iniciadas ? "⚠ " + A.plural(res.iniciadas, "não enviada", "não enviadas") + " · " : "") +
          "faltam " + res.c.pendentes + "</span>";
      var fichas = res.disciplinas
        .map(function (d) {
          return (
            '<a class="eaa-r-ficha' + (d.iniciada ? " iniciada" : "") + '" href="/d2l/home/' + d.ou + '" title="' + esc(d.nome) + '">' +
            '<span class="eaa-r-fnome">' + esc(curto(d.nome)) + '</span><span class="eaa-r-fnum">' + d.pendentes + "</span></a>"
          );
        })
        .join("");
      return (
        '<div class="eaa-r-par"><span class="eaa-r-titulo">' + esc(res.longo) + "</span>" +
        '<span class="eaa-r-quando' + (urgente ? " urgente" : "") + '">' +
        A.data(res.prazo) + " às " + A.hora(res.prazo) + " · " + A.falta(res.prazo, true) + "</span></div>" +
        A.segmentos(res.c.itens, "eaa-r-seg") +
        '<div class="eaa-r-par eaa-r-leg"><span>' + res.c.entregues + " de " + res.c.itens.length +
        " atividades entregues</span>" + direita + "</div>" +
        (fichas ? '<div class="eaa-r-fichas">' + fichas + "</div>" : "") +
        legenda()
      );
    }

    /* Enquanto houver disciplina visível sem resposta, o resumo fica em
       carregamento: somar só as que chegaram mostraria números errados
       ("faltam 2", depois "faltam 5"). A moldura e as linhas são as mesmas do
       resultado, para nada pular quando terminar. Erro também conta como
       resposta; e depois de ESPERA_MAX mostra o que tiver, em vez de girar
       para sempre por causa de uma disciplina que não responde. */
    var resolvidos = {};
    var inicioDaCarga = null;
    var ESPERA_MAX = 20000;

    function htmlCarregando(prontas, total) {
      var pct = total ? Math.round((prontas / total) * 100) : 0;
      return (
        '<div class="eaa-r-par"><span class="eaa-r-titulo">Próximo prazo</span>' +
        '<span class="eaa-r-quando eaa-r-status" role="status">carregando ' + prontas + " de " + total + " disciplinas…</span></div>" +
        '<div class="eaa-r-progresso" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
        '<div class="eaa-r-par eaa-r-leg"><span>Lendo notas e entregas no AVA</span><span></span></div>' +
        '<div class="eaa-r-fichas" aria-hidden="true">' +
        '<span class="eaa-r-ficha eaa-r-vazia" style="width:128px"></span>' +
        '<span class="eaa-r-ficha eaa-r-vazia" style="width:96px"></span>' +
        '<span class="eaa-r-ficha eaa-r-vazia" style="width:152px"></span></div>' +
        legenda()
      );
    }

    function atualizarResumo(visiveis) {
      var alvo = document.querySelector("d2l-my-courses-v2");
      if (!alvo || !alvo.parentNode) return;
      var caixa = document.getElementById(RESUMO_ID);
      var sumir = function () {
        if (caixa) caixa.remove();
      };
      if (!visiveis.length) return sumir();

      var faltam = visiveis.filter(function (ou) {
        return !resolvidos[ou];
      }).length;
      if (!faltam) inicioDaCarga = null;
      else if (inicioDaCarga === null) inicioDaCarga = Date.now();
      var carregando = faltam > 0 && Date.now() - inicioDaCarga < ESPERA_MAX;

      var novo;
      if (carregando) {
        novo = htmlCarregando(visiveis.length - faltam, visiveis.length);
      } else {
        var res = resumoGeral(visiveis);
        if (!res || !res.c.itens.length) return sumir();
        novo = htmlDoResumo(res);
      }

      if (!caixa) {
        caixa = document.createElement("section");
        caixa.id = RESUMO_ID;
        caixa.setAttribute("aria-label", "Próximo prazo das disciplinas");
      }
      caixa.setAttribute("aria-busy", carregando ? "true" : "false");
      if (caixa.nextSibling !== alvo) alvo.parentNode.insertBefore(caixa, alvo);
      if (caixa.getAttribute("data-html") !== novo) {
        caixa.setAttribute("data-html", novo);
        caixa.innerHTML = novo;
      }
    }

    /* ---------------------------------------------------------------
     * Cards
     * ------------------------------------------------------------- */
    function processar(card, ou) {
      var sombra = card.shadowRoot;
      var cartao = sombra && sombra.querySelector("d2l-card");
      if (!cartao) return;
      var cabecalho = cartao.querySelector(".d2l-enrollment-card-content-flex");
      if (!cabecalho) return; /* ainda montando */
      if (cartao.querySelector("." + MARCA)) return;

      preparar(sombra);
      var fantasma = document.createElement("div");
      fantasma.className = MARCA + " fantasma";
      fantasma.setAttribute("slot", "content");
      fantasma.setAttribute("aria-hidden", "true");
      var bloco = document.createElement("div");
      bloco.className = MARCA + " real";
      bloco.setAttribute("slot", "content");
      var escrever = function (conteudo) {
        fantasma.innerHTML = bloco.innerHTML = conteudo;
      };
      var remover = function () {
        fantasma.remove();
        bloco.remove();
      };
      escrever('<span class="eaa-carregando">Carregando progresso…</span>');
      cartao.appendChild(fantasma);
      cartao.appendChild(bloco);

      A.dados(ou).then(
        function (r) {
          resolvidos[ou] = true;
          if (!r.total) return remover();
          prontos[ou] = { r: r, nome: r.nome || "Disciplina" };
          escrever(html(r));
        },
        function (erro) {
          resolvidos[ou] = true;
          remover();
          if (window.console && console.warn) console.warn("[EAA+] progresso da disciplina " + ou + ":", erro);
        }
      );
    }

    function cards(no, saida) {
      var filhos = no.querySelectorAll("*");
      for (var i = 0; i < filhos.length; i++) {
        var el = filhos[i];
        if (el.tagName === "D2L-MY-COURSES-ENROLLMENT-CARD") saida.push(el);
        else if (el.shadowRoot) cards(el.shadowRoot, saida);
      }
      return saida;
    }

    function varrer() {
      var r = document.querySelector("d2l-my-courses-v2");
      if (!r || !r.shadowRoot) return;
      var visiveis = [];
      cards(r.shadowRoot, []).forEach(function (card) {
        var ou = (card.id || "").replace(/^enrollment-card-/, "");
        /* Só os visíveis: as outras abas carregam quando forem abertas. */
        if (!/^\d+$/.test(ou) || !card.getClientRects().length) return;
        visiveis.push(ou);
        processar(card, ou);
      });
      atualizarResumo(visiveis);
    }

    varrer();
    setInterval(varrer, VARREDURA_MS);
    return true;
  }
});
