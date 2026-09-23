/* EAA+ · melhoria: próxima aula
 *
 * Página: /aulas-sincronas-graduacao-ead/
 * Mostra, logo abaixo das abas de período, qual é a próxima aula e o link dela,
 * com setas para percorrer as seguintes. Acompanha a aba selecionada e se
 * atualiza sozinho a cada 30 segundos.
 *
 * As setas existem por causa de um caso real: no calendário 2026.2 há 5 momentos
 * com duas aulas começando no MESMO horário. Sem elas, a segunda ficaria
 * invisível. Como um controle que só aparece 5 vezes por semestre ninguém
 * descobre, as setas são permanentes e servem também para espiar o que vem
 * depois.
 *
 * Não coleta, envia nem armazena dados.
 */

EAAPlus.add({
  id: "proxima-aula",

  init: function () {
    var CARD_ID = "eaa-next-class";
    var TICK_MS = 30000;
    var TZ = "America/Sao_Paulo";

    var DATA_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    var HORA_RE = /^(\d{1,2}):(\d{2})\s*(?:às|as|-|–)\s*(\d{1,2}):(\d{2})$/i;

    var SETA_ESQ =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
      'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
    var SETA_DIR =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
      'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';

    /* ---------------------------------------------------------------
     * Fuso
     *
     * Os horários da página são de Brasília. Se a gente montasse a data
     * com new Date(...) direto, ela sairia no fuso do aparelho do aluno —
     * quem estivesse com o relógio em outro fuso veria a aula na hora
     * errada. Então convertemos "hora de parede em São Paulo" para o
     * instante real, perguntando ao Intl qual o deslocamento naquela data.
     * ------------------------------------------------------------- */
    var formatador = null;
    try {
      formatador = new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      formatador = null; /* navegador sem suporte: cai no fuso local */
    }

    function paredeEmSaoPaulo(ts) {
      var p = {};
      formatador.formatToParts(new Date(ts)).forEach(function (parte) {
        if (parte.type !== "literal") p[parte.type] = parseInt(parte.value, 10);
      });
      return Date.UTC(
        p.year,
        p.month - 1,
        p.day,
        p.hour === 24 ? 0 : p.hour,
        p.minute
      );
    }

    function dataDeBrasilia(ano, mes, dia, hora, minuto) {
      var alvo = Date.UTC(ano, mes - 1, dia, hora, minuto);
      if (!formatador) return new Date(ano, mes - 1, dia, hora, minuto);

      var ts = alvo;
      for (var i = 0; i < 2; i++) {
        ts = alvo - (paredeEmSaoPaulo(ts) - ts);
      }
      return new Date(ts);
    }

    /* ---------------------------------------------------------------
     * Leitura das sessões
     * ------------------------------------------------------------- */
    function lerSessoes(list) {
      var sessoes = [];

      Array.prototype.forEach.call(
        list.querySelectorAll(".card"),
        function (card) {
          var disciplina = card.querySelector(".discipline");
          if (!disciplina) return;

          var metas = card.querySelectorAll(".meta span");
          var etiqueta = card.querySelector(".period-tag");
          var link = card.querySelector("a.btn-link");

          var periodos = card.dataset.periods
            ? card.dataset.periods.split(",").map(Number)
            : EAAPlus.periodos(etiqueta ? etiqueta.textContent : "");

          var base = {
            nome: disciplina.textContent.trim(),
            professor: metas.length ? metas[0].textContent.trim() : "",
            etiqueta: etiqueta ? etiqueta.textContent.trim() : "",
            periodos: periodos,
            href: link ? link.getAttribute("href") : null,
            cor: (card.getAttribute("style") || "").replace(
              /^[\s\S]*--accent-color:\s*([^;]+)[\s\S]*$/,
              "$1"
            )
          };

          Array.prototype.forEach.call(
            card.querySelectorAll("tbody tr"),
            function (tr) {
              var celulas = tr.children;
              if (celulas.length < 3) return;

              var d = celulas[0].textContent.trim().match(DATA_RE);
              var h = celulas[2].textContent.trim().match(HORA_RE);
              if (!d || !h) return; /* linha fora do padrão: ignora */

              var inicio = dataDeBrasilia(+d[3], +d[2], +d[1], +h[1], +h[2]);
              var fim = dataDeBrasilia(+d[3], +d[2], +d[1], +h[3], +h[4]);
              if (fim < inicio) fim = new Date(fim.getTime() + 86400000);

              sessoes.push({
                /* chave estável: permite reencontrar a mesma sessão depois
                   de um recálculo, para a seta não perder o lugar */
                chave: base.nome + "@" + inicio.getTime(),
                nome: base.nome,
                professor: base.professor,
                etiqueta: base.etiqueta,
                periodos: base.periodos,
                href: base.href,
                cor: base.cor,
                inicio: inicio,
                fim: fim
              });
            }
          );
        }
      );

      sessoes.sort(function (a, b) {
        if (a.inicio - b.inicio !== 0) return a.inicio - b.inicio;
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
      return sessoes;
    }

    /* ---------------------------------------------------------------
     * Texto
     * ------------------------------------------------------------- */
    function mesmoDia(a, b) {
      return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
      );
    }

    function quando(data, agora) {
      var hora = data.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });

      var amanha = new Date(agora.getTime() + 86400000);
      if (mesmoDia(data, agora)) return "Hoje às " + hora;
      if (mesmoDia(data, amanha)) return "Amanhã às " + hora;

      var dia = data.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit"
      });
      return dia.charAt(0).toUpperCase() + dia.slice(1) + " às " + hora;
    }

    function faltam(data, agora) {
      var seg = Math.round((data - agora) / 1000);
      if (seg <= 60) return "começa agora";

      var min = Math.round(seg / 60);
      if (min < 60) return "em " + min + " min";

      var horas = Math.floor(min / 60);
      if (horas < 24) {
        var resto = min % 60;
        return "em " + horas + "h" + (resto ? String(resto).padStart(2, "0") : "");
      }

      var dias = Math.round(horas / 24);
      return dias === 1 ? "em 1 dia" : "em " + dias + " dias";
    }

    /* ---------------------------------------------------------------
     * Montagem
     * ------------------------------------------------------------- */
    function criarCartao() {
      var secao = document.createElement("section");
      secao.id = CARD_ID;
      secao.setAttribute("aria-label", "Próxima aula");

      secao.innerHTML =
        '<div class="nc-inner">' +
        '<div class="nc-body">' +
        '<p class="nc-eyebrow"></p>' +
        '<p class="nc-title"></p>' +
        '<p class="nc-meta"></p>' +
        "</div>" +
        '<div class="nc-side">' +
        '<div class="nc-action"></div>' +
        '<div class="nc-nav">' +
        '<button type="button" class="nc-arrow" data-passo="-1" ' +
        'aria-label="Aula anterior">' +
        SETA_ESQ +
        "</button>" +
        '<span class="nc-pos"></span>' +
        '<button type="button" class="nc-arrow" data-passo="1" ' +
        'aria-label="Próxima aula">' +
        SETA_DIR +
        "</button>" +
        "</div>" +
        "</div>" +
        "</div>";

      return secao;
    }

    function periodoSelecionado() {
      var aba = document.querySelector(
        '#eaa-period-filter .pf-tab[aria-selected="true"]'
      );
      return aba ? aba.dataset.period : "all";
    }

    /* ---------------------------------------------------------------
     * Início
     * ------------------------------------------------------------- */
    if (document.getElementById(CARD_ID)) return true;

    var instructions = document.querySelector(".wrap header .instructions");
    if (!instructions) return false;

    var header = instructions.closest("header");
    if (!header) return false;

    var lista = header.parentElement.querySelector("main.list");
    if (!lista) return false;

    var sessoes = lerSessoes(lista);
    if (!sessoes.length) return false;

    var secao = criarCartao();

    var olho = secao.querySelector(".nc-eyebrow");
    var titulo = secao.querySelector(".nc-title");
    var meta = secao.querySelector(".nc-meta");
    var acao = secao.querySelector(".nc-action");
    var nav = secao.querySelector(".nc-nav");
    var posicao = secao.querySelector(".nc-pos");
    var setaAnterior = secao.querySelector('.nc-arrow[data-passo="-1"]');
    var setaProxima = secao.querySelector('.nc-arrow[data-passo="1"]');

    var indice = 0;
    var chaveAtual = null; /* o que o aluno está olhando, para não perder o lugar */

    function futuras(agora) {
      var periodo = periodoSelecionado();
      return sessoes.filter(function (s) {
        if (s.fim <= agora) return false;
        return periodo === "all" || s.periodos.indexOf(+periodo) !== -1;
      });
    }

    function render(preservarPosicao) {
      var agora = new Date();
      var periodo = periodoSelecionado();
      var proximas = futuras(agora);

      /* Depois de um recálculo, reencontra a sessão que estava na tela.
         Sem isso, uma aula terminando puxaria o card debaixo do aluno. */
      if (preservarPosicao && chaveAtual) {
        var achou = -1;
        for (var i = 0; i < proximas.length; i++) {
          if (proximas[i].chave === chaveAtual) {
            achou = i;
            break;
          }
        }
        indice = achou === -1 ? 0 : achou;
      }

      if (indice > proximas.length - 1) indice = Math.max(0, proximas.length - 1);

      secao.classList.remove("is-live", "is-empty");
      acao.textContent = "";

      if (!proximas.length) {
        chaveAtual = null;
        secao.classList.add("is-empty");
        secao.style.removeProperty("--accent-color");
        nav.hidden = true;
        olho.textContent =
          periodo === "all" ? "AULAS SÍNCRONAS" : periodo + "º PERÍODO";
        titulo.textContent = "Nenhuma aula futura por aqui.";
        meta.textContent =
          periodo === "all"
            ? "O calendário do semestre chegou ao fim."
            : "Nenhuma aula deste período está agendada daqui pra frente.";
        return;
      }

      var aula = proximas[indice];
      chaveAtual = aula.chave;

      if (aula.cor) secao.style.setProperty("--accent-color", aula.cor);

      var aoVivo = aula.inicio <= agora && agora < aula.fim;
      var rotuloPeriodo =
        periodo === "all" ? aula.etiqueta : periodo + "º período";

      /* Uma aula no mesmo horário da anterior é exatamente o caso que as
         setas existem para resolver — vale dizer isso na cara do card. */
      var simultanea =
        indice > 0 &&
        proximas[indice - 1].inicio.getTime() === aula.inicio.getTime();

      if (aoVivo && indice === 0) {
        secao.classList.add("is-live");
        olho.innerHTML =
          '<span class="nc-dot" aria-hidden="true"></span>AO VIVO AGORA';
      } else if (simultanea) {
        olho.textContent = "AO MESMO TEMPO";
        if (rotuloPeriodo) olho.textContent += " · " + rotuloPeriodo;
      } else if (indice > 0) {
        olho.textContent = "EM SEGUIDA";
        if (rotuloPeriodo) olho.textContent += " · " + rotuloPeriodo;
      } else {
        olho.textContent = "PRÓXIMA AULA";
        if (rotuloPeriodo) olho.textContent += " · " + rotuloPeriodo;
      }

      titulo.textContent = aula.nome;

      var partes = [];
      if (aula.professor) partes.push(aula.professor);
      partes.push(quando(aula.inicio, agora));
      if (aoVivo) {
        partes.push(
          "termina às " +
            aula.fim.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit"
            })
        );
      } else {
        partes.push(faltam(aula.inicio, agora));
      }
      meta.textContent = partes.join(" · ");

      if (aula.href) {
        var a = document.createElement("a");
        a.className = "nc-btn";
        a.href = aula.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = aoVivo ? "Entrar agora" : "Entrar na aula";
        acao.appendChild(a);
      } else {
        var aviso = document.createElement("span");
        aviso.className = "nc-btn is-disabled";
        aviso.textContent = "Link a confirmar";
        acao.appendChild(aviso);
      }

      nav.hidden = proximas.length < 2;
      posicao.textContent = indice + 1 + "/" + proximas.length;
      setaAnterior.disabled = indice === 0;
      setaProxima.disabled = indice >= proximas.length - 1;
    }

    nav.addEventListener("click", function (evento) {
      var botao = evento.target.closest(".nc-arrow");
      if (!botao || botao.disabled) return;
      indice += parseInt(botao.dataset.passo, 10);
      if (indice < 0) indice = 0;
      render(false);
    });

    (document.getElementById("eaa-period-filter") || header)
      .insertAdjacentElement("afterend", secao);

    render(false);

    /* Trocar de aba recomeça do início — o aluno mudou de assunto. */
    var abas = document.getElementById("eaa-period-filter");
    if (abas) {
      new MutationObserver(function () {
        indice = 0;
        chaveAtual = null;
        render(false);
      }).observe(abas, {
        attributes: true,
        attributeFilter: ["aria-selected"],
        subtree: true
      });
    }

    /* O tique periódico preserva onde o aluno estava. */
    setInterval(function () {
      render(true);
    }, TICK_MS);

    return true;
  }
});
