/* EAA+ · melhoria: filtro por período
 *
 * Página: /aulas-sincronas-graduacao-ead/
 * Injeta abas (Todos / 1º a 4º período) abaixo do cabeçalho da lista de aulas,
 * fixadas no topo durante a rolagem. Não coleta, envia nem armazena dados.
 */

EAAPlus.add({
  id: "period-filter",

  init: function () {
    var FILTER_ID = "eaa-period-filter";
    var SENTINEL_ID = "eaa-pf-sentinel";

    /* Menu fixo do tema (Eduma). Se não existir, o offset fica em 0. */
    var SITE_HEADER_SELECTOR = "#masthead, header.site-header, .sticky-header";

    var TABS = [
      { key: "all", label: "Todos" },
      { key: "1", label: "1º Período" },
      { key: "2", label: "2º Período" },
      { key: "3", label: "3º Período" },
      { key: "4", label: "4º Período" }
    ];

    /* O menu do tema entra e sai da tela com animação e reage a rolagem E a
     * movimento do mouse. Em vez de assumir uma altura fixa, medimos a borda
     * inferior real dele e repassamos para o CSS via --pf-top, para a barra de
     * filtro nunca ficar escondida atrás do menu nem sobrar um vão embaixo. */
    function trackSiteHeader(nav) {
      var siteHeader = document.querySelector(SITE_HEADER_SELECTOR);
      if (!siteHeader) return;

      var lastEvent = 0;
      var running = false;
      var currentTop = null;

      function compute() {
        var top = 0;
        var cs = window.getComputedStyle(siteHeader);

        if (
          cs.position === "fixed" &&
          cs.display !== "none" &&
          cs.visibility !== "hidden" &&
          parseFloat(cs.opacity) > 0.05
        ) {
          top = Math.max(
            0,
            Math.round(siteHeader.getBoundingClientRect().bottom)
          );
        }

        if (top !== currentTop) {
          currentTop = top;
          nav.style.setProperty("--pf-top", top + "px");
        }
      }

      /* Acompanha por ~800ms depois do último evento, para seguir a animação
       * do menu até o fim em vez de congelar num valor intermediário. */
      function loop() {
        compute();
        if (performance.now() - lastEvent < 800) {
          requestAnimationFrame(loop);
        } else {
          running = false;
        }
      }

      function kick() {
        lastEvent = performance.now();
        if (!running) {
          running = true;
          requestAnimationFrame(loop);
        }
      }

      window.addEventListener("scroll", kick, { passive: true });
      window.addEventListener("resize", kick, { passive: true });
      siteHeader.addEventListener("transitionend", compute);

      /* O tema alterna classes (ex.: "menu-hidden") fora de eventos de rolagem. */
      new MutationObserver(kick).observe(siteHeader, {
        attributes: true,
        attributeFilter: ["class", "style"]
      });

      compute();
    }

    function build(header, list) {
      var cards = Array.prototype.slice.call(list.querySelectorAll(".card"));
      if (!cards.length) return false;

      cards.forEach(function (card) {
        var tag = card.querySelector(".period-tag");
        card.dataset.periods = EAAPlus.periods(
          tag ? tag.textContent : ""
        ).join(",");
      });

      function countFor(key) {
        if (key === "all") return cards.length;
        return cards.filter(function (card) {
          return card.dataset.periods.split(",").indexOf(key) !== -1;
        }).length;
      }

      var nav = document.createElement("nav");
      nav.id = FILTER_ID;
      nav.setAttribute("aria-label", "Filtrar aulas por período");

      var tabList = document.createElement("div");
      tabList.className = "pf-tabs";
      tabList.setAttribute("role", "tablist");

      TABS.forEach(function (tab, index) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pf-tab";
        btn.setAttribute("role", "tab");
        btn.setAttribute("aria-selected", index === 0 ? "true" : "false");
        btn.dataset.period = tab.key;
        btn.textContent = tab.label;

        var badge = document.createElement("span");
        badge.className = "pf-count";
        badge.textContent = String(countFor(tab.key));
        btn.appendChild(badge);

        tabList.appendChild(btn);
      });

      var empty = document.createElement("p");
      empty.className = "pf-empty";
      empty.textContent = "Nenhuma aula para este período.";

      nav.appendChild(tabList);
      nav.appendChild(empty);

      function select(btn) {
        var key = btn.dataset.period;
        var shown = 0;

        Array.prototype.forEach.call(tabList.children, function (b) {
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });

        cards.forEach(function (card) {
          var visible =
            key === "all" ||
            card.dataset.periods.split(",").indexOf(key) !== -1;
          card.classList.toggle("pf-hidden", !visible);
          if (visible) shown++;
        });

        empty.style.display = shown ? "none" : "block";
      }

      tabList.addEventListener("click", function (event) {
        var btn = event.target.closest(".pf-tab");
        if (btn) select(btn);
      });

      /* Navegação por setas entre as abas (padrão ARIA tablist). */
      tabList.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        var buttons = Array.prototype.slice.call(tabList.children);
        var current = buttons.indexOf(document.activeElement);
        if (current === -1) return;
        event.preventDefault();
        var step = event.key === "ArrowRight" ? 1 : -1;
        var next = buttons[(current + step + buttons.length) % buttons.length];
        next.focus();
        select(next);
      });

      /* Sentinela logo antes da barra: quando ela sai da tela, a barra grudou. */
      var sentinel = document.createElement("div");
      sentinel.id = SENTINEL_ID;

      header.insertAdjacentElement("afterend", nav);
      nav.parentElement.insertBefore(sentinel, nav);

      new IntersectionObserver(
        function (entries) {
          nav.classList.toggle("is-pinned", entries[0].intersectionRatio < 1);
        },
        { threshold: [1] }
      ).observe(sentinel);

      trackSiteHeader(nav);

      return true;
    }

    if (document.getElementById(FILTER_ID)) return true;

    var instructions = document.querySelector(".wrap header .instructions");
    if (!instructions) return false;

    var header = instructions.closest("header");
    if (!header) return false;

    var list = header.parentElement.querySelector("main.list");
    if (!list) return false;

    return build(header, list);
  }
});
