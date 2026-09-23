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
  id: "next-class",

  init: function () {
    var CARD_ID = "eaa-next-class";
    var TICK_MS = 30000;
    var TZ = "America/Sao_Paulo";

    var DATA_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    var TIME_RE = /^(\d{1,2}):(\d{2})\s*(?:às|as|-|–)\s*(\d{1,2}):(\d{2})$/i;

    var ARROW_LEFT =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
      'stroke="currentColor" stroke-width="2.4" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
    var ARROW_RIGHT =
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
    var formatter = null;
    try {
      formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      formatter = null; /* navegador sem suporte: cai no fuso local */
    }

    function wallInSaoPaulo(ts) {
      var p = {};
      formatter.formatToParts(new Date(ts)).forEach(function (part) {
        if (part.type !== "literal") p[part.type] = parseInt(part.value, 10);
      });
      return Date.UTC(
        p.year,
        p.month - 1,
        p.day,
        p.hour === 24 ? 0 : p.hour,
        p.minute
      );
    }

    function brasiliaDate(year, mon, day, hour, minute) {
      var target = Date.UTC(year, mon - 1, day, hour, minute);
      if (!formatter) return new Date(year, mon - 1, day, hour, minute);

      var ts = target;
      for (var i = 0; i < 2; i++) {
        ts = target - (wallInSaoPaulo(ts) - ts);
      }
      return new Date(ts);
    }

    /* ---------------------------------------------------------------
     * Leitura das sessões
     * ------------------------------------------------------------- */
    function readSessions(list) {
      var sessions = [];

      Array.prototype.forEach.call(
        list.querySelectorAll(".card"),
        function (card) {
          var course = card.querySelector(".discipline");
          if (!course) return;

          var metaItems = card.querySelectorAll(".meta span");
          var periodTag = card.querySelector(".period-tag");
          var link = card.querySelector("a.btn-link");

          var periods = card.dataset.periods
            ? card.dataset.periods.split(",").map(Number)
            : EAAPlus.periods(periodTag ? periodTag.textContent : "");

          var base = {
            name: course.textContent.trim(),
            professor: metaItems.length ? metaItems[0].textContent.trim() : "",
            periodTag: periodTag ? periodTag.textContent.trim() : "",
            periods: periods,
            href: link ? link.getAttribute("href") : null,
            color: (card.getAttribute("style") || "").replace(
              /^[\s\S]*--accent-color:\s*([^;]+)[\s\S]*$/,
              "$1"
            )
          };

          Array.prototype.forEach.call(
            card.querySelectorAll("tbody tr"),
            function (tr) {
              var cells = tr.children;
              if (cells.length < 3) return;

              var d = cells[0].textContent.trim().match(DATA_RE);
              var h = cells[2].textContent.trim().match(TIME_RE);
              if (!d || !h) return; /* linha fora do padrão: ignora */

              var start = brasiliaDate(+d[3], +d[2], +d[1], +h[1], +h[2]);
              var end = brasiliaDate(+d[3], +d[2], +d[1], +h[3], +h[4]);
              if (end < start) end = new Date(end.getTime() + 86400000);

              sessions.push({
                /* chave estável: permite reencontrar a mesma sessão depois
                   de um recálculo, para a seta não perder o lugar */
                key: base.name + "@" + start.getTime(),
                name: base.name,
                professor: base.professor,
                periodTag: base.periodTag,
                periods: base.periods,
                href: base.href,
                color: base.color,
                start: start,
                end: end
              });
            }
          );
        }
      );

      sessions.sort(function (a, b) {
        if (a.start - b.start !== 0) return a.start - b.start;
        return a.name.localeCompare(b.name, "pt-BR");
      });
      return sessions;
    }

    /* ---------------------------------------------------------------
     * Texto
     * ------------------------------------------------------------- */
    function sameDay(a, b) {
      return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
      );
    }

    function when(date, now) {
      var time = date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });

      var tomorrow = new Date(now.getTime() + 86400000);
      if (sameDay(date, now)) return "Hoje às " + time;
      if (sameDay(date, tomorrow)) return "Amanhã às " + time;

      var day = date.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit"
      });
      return day.charAt(0).toUpperCase() + day.slice(1) + " às " + time;
    }

    function countdown(date, now) {
      var seg = Math.round((date - now) / 1000);
      if (seg <= 60) return "começa agora";

      var min = Math.round(seg / 60);
      if (min < 60) return "em " + min + " min";

      var hours = Math.floor(min / 60);
      if (hours < 24) {
        var rest = min % 60;
        return "em " + hours + "h" + (rest ? String(rest).padStart(2, "0") : "");
      }

      var days = Math.round(hours / 24);
      return days === 1 ? "em 1 dia" : "em " + days + " dias";
    }

    /* ---------------------------------------------------------------
     * Montagem
     * ------------------------------------------------------------- */
    function createCard() {
      var section = document.createElement("section");
      section.id = CARD_ID;
      section.setAttribute("aria-label", "Próxima aula");

      section.innerHTML =
        '<div class="nc-inner">' +
        '<div class="nc-body">' +
        '<p class="nc-eyebrow"></p>' +
        '<p class="nc-title"></p>' +
        '<p class="nc-meta"></p>' +
        "</div>" +
        '<div class="nc-side">' +
        '<div class="nc-action"></div>' +
        '<div class="nc-nav">' +
        '<button type="button" class="nc-arrow" data-step="-1" ' +
        'aria-label="Aula anterior">' +
        ARROW_LEFT +
        "</button>" +
        '<span class="nc-pos"></span>' +
        '<button type="button" class="nc-arrow" data-step="1" ' +
        'aria-label="Próxima aula">' +
        ARROW_RIGHT +
        "</button>" +
        "</div>" +
        "</div>" +
        "</div>";

      return section;
    }

    function selectedPeriod() {
      var tabButton = document.querySelector(
        '#eaa-period-filter .pf-tab[aria-selected="true"]'
      );
      return tabButton ? tabButton.dataset.period : "all";
    }

    /* ---------------------------------------------------------------
     * Início
     * ------------------------------------------------------------- */
    if (document.getElementById(CARD_ID)) return true;

    var instructions = document.querySelector(".wrap header .instructions");
    if (!instructions) return false;

    var header = instructions.closest("header");
    if (!header) return false;

    var toList = header.parentElement.querySelector("main.list");
    if (!toList) return false;

    var sessions = readSessions(toList);
    if (!sessions.length) return false;

    var section = createCard();

    var eye = section.querySelector(".nc-eyebrow");
    var title = section.querySelector(".nc-title");
    var meta = section.querySelector(".nc-meta");
    var action = section.querySelector(".nc-action");
    var nav = section.querySelector(".nc-nav");
    var position = section.querySelector(".nc-pos");
    var prevArrow = section.querySelector('.nc-arrow[data-step="-1"]');
    var nextArrow = section.querySelector('.nc-arrow[data-step="1"]');

    var idx = 0;
    var currentKey = null; /* o que o aluno está olhando, para não perder o lugar */

    function upcoming(now) {
      var period = selectedPeriod();
      return sessions.filter(function (s) {
        if (s.end <= now) return false;
        return period === "all" || s.periods.indexOf(+period) !== -1;
      });
    }

    function render(keepPosition) {
      var now = new Date();
      var period = selectedPeriod();
      var nextOnes = upcoming(now);

      /* Depois de um recálculo, reencontra a sessão que estava na tela.
         Sem isso, uma aula terminando puxaria o card debaixo do aluno. */
      if (keepPosition && currentKey) {
        var hit = -1;
        for (var i = 0; i < nextOnes.length; i++) {
          if (nextOnes[i].key === currentKey) {
            hit = i;
            break;
          }
        }
        idx = hit === -1 ? 0 : hit;
      }

      if (idx > nextOnes.length - 1) idx = Math.max(0, nextOnes.length - 1);

      section.classList.remove("is-live", "is-empty");
      action.textContent = "";

      if (!nextOnes.length) {
        currentKey = null;
        section.classList.add("is-empty");
        section.style.removeProperty("--accent-color");
        nav.hidden = true;
        eye.textContent =
          period === "all" ? "AULAS SÍNCRONAS" : period + "º PERÍODO";
        title.textContent = "Nenhuma aula futura por aqui.";
        meta.textContent =
          period === "all"
            ? "O calendário do semestre chegou ao fim."
            : "Nenhuma aula deste período está agendada daqui pra frente.";
        return;
      }

      var lesson = nextOnes[idx];
      currentKey = lesson.key;

      if (lesson.color) section.style.setProperty("--accent-color", lesson.color);

      var live = lesson.start <= now && now < lesson.end;
      var periodLabel =
        period === "all" ? lesson.periodTag : period + "º período";

      /* Uma aula no mesmo horário da anterior é exatamente o caso que as
         setas existem para resolver — vale dizer isso na cara do card. */
      var simultaneous =
        idx > 0 &&
        nextOnes[idx - 1].start.getTime() === lesson.start.getTime();

      if (live && idx === 0) {
        section.classList.add("is-live");
        eye.innerHTML =
          '<span class="nc-dot" aria-hidden="true"></span>AO VIVO AGORA';
      } else if (simultaneous) {
        eye.textContent = "AO MESMO TEMPO";
        if (periodLabel) eye.textContent += " · " + periodLabel;
      } else if (idx > 0) {
        eye.textContent = "EM SEGUIDA";
        if (periodLabel) eye.textContent += " · " + periodLabel;
      } else {
        eye.textContent = "PRÓXIMA AULA";
        if (periodLabel) eye.textContent += " · " + periodLabel;
      }

      title.textContent = lesson.name;

      var parts = [];
      if (lesson.professor) parts.push(lesson.professor);
      parts.push(when(lesson.start, now));
      if (live) {
        parts.push(
          "termina às " +
            lesson.end.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit"
            })
        );
      } else {
        parts.push(countdown(lesson.start, now));
      }
      meta.textContent = parts.join(" · ");

      if (lesson.href) {
        var a = document.createElement("a");
        a.className = "nc-btn";
        a.href = lesson.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = live ? "Entrar agora" : "Entrar na aula";
        action.appendChild(a);
      } else {
        var warning = document.createElement("span");
        warning.className = "nc-btn is-disabled";
        warning.textContent = "Link a confirmar";
        action.appendChild(warning);
      }

      nav.hidden = nextOnes.length < 2;
      position.textContent = idx + 1 + "/" + nextOnes.length;
      prevArrow.disabled = idx === 0;
      nextArrow.disabled = idx >= nextOnes.length - 1;
    }

    nav.addEventListener("click", function (event) {
      var button = event.target.closest(".nc-arrow");
      if (!button || button.disabled) return;
      idx += parseInt(button.dataset.step, 10);
      if (idx < 0) idx = 0;
      render(false);
    });

    (document.getElementById("eaa-period-filter") || header)
      .insertAdjacentElement("afterend", section);

    render(false);

    /* Trocar de aba recomeça do início — o aluno mudou de assunto. */
    var tabs = document.getElementById("eaa-period-filter");
    if (tabs) {
      new MutationObserver(function () {
        idx = 0;
        currentKey = null;
        render(false);
      }).observe(tabs, {
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
