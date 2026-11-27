/* Painel geral do Layout Amplo (anel + disciplinas em 2 colunas). O painel do
 * layout clássico é testado em ava.spec.mjs.
 * Réplica e respostas em ava-fixtures.mjs — dados inventados.
 */

import { test as base, expect } from "./browser.mjs";

const setWide = (background, on) => background.evaluate((v) => chrome.storage.local.set({ eaa_wide_layout: v }), on);

const test = base.extend({
  /* a preferência fica no navegador compartilhado: limpa ao sair */
  page: async ({ page, background }, use) => {
    await setWide(background, true);
    await use(page);
    await background.evaluate(() => chrome.storage.local.clear());
  },
});

const panel = (page) => page.locator("#eaa-summary-wide");
const classic = (page) => page.locator("#eaa-summary");
const rowButton = (page, ou) => panel(page).locator(`li[data-ou='${ou}'] > .eaa-r-course`);
const height = (loc) => loc.evaluate((e) => e.getBoundingClientRect().height);
/* a réplica tem 760px; o Layout Amplo do AVA chega perto de 1340px */
const widen = (page, width = 1340) => page.addStyleTag({ content: `.d2l-widget-content-padding{max-width:${width}px!important}` });
const ready = (page) => expect(panel(page)).toHaveAttribute("aria-busy", "false", { timeout: 15000 });

async function open(page, baseURL, scenario = "", { viewport = 1400, width = 1340 } = {}) {
  await page.setViewportSize({ width: viewport, height: 900 });
  await page.goto(`${baseURL}/d2l/home${scenario && `?scenario=${scenario}`}`);
  await widen(page, width);
  await ready(page);
}

test.describe("painel do Layout Amplo", () => {
  test("só um painel por vez: ligar e desligar o Amplo troca o desenho", async ({ page, baseURL, background }) => {
    await open(page, baseURL);
    await expect(classic(page)).toHaveCount(0);
    await setWide(background, false);
    await expect(classic(page).locator(".eaa-r-seg")).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
    await setWide(background, true);
    await expect(panel(page).locator(".eaa-r-ring")).toBeVisible();
    await expect(classic(page)).toHaveCount(0);
  });

  test("durante o semestre: anel do próximo prazo, contagem e legenda", async ({ page, baseURL }) => {
    await open(page, baseURL);
    const r = panel(page);
    await expect(r.locator(".eaa-r-title")).toHaveText("Av1 · 1º Fechamento");
    await expect(r.locator(".eaa-r-when")).toHaveClass(/urgent/);
    await expect(r.locator(".eaa-r-ring")).toHaveAttribute("aria-label", "2 de 4 atividades entregues");
    await expect(r.locator(".eaa-r-tag")).toHaveText("faltam 2");
    expect(await r.locator(".eaa-r-arc").evaluateAll((a) => a.map((x) => x.classList[1]))).toEqual(["graded", "awaiting", "todo", "todo"]);
    await expect(r.locator(".eaa-r-cname")).toHaveText(["Percepção Musical I", "Técnica Vocal I"]);
    await expect(r.locator(".eaa-r-footer .eaa-r-legend li")).toHaveCount(5);
  });

  test("carregando: sem pulo de altura e contagem dita uma vez só", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseURL}/d2l/home`);
    const r = panel(page);
    await expect(r).toHaveAttribute("aria-busy", "true", { timeout: 8000 });
    await expect(r.locator(".eaa-r-status")).toHaveText(/^\d+ de \d+ disciplinas lidas$/);
    /* o status já diz a contagem: o anel não repete para o leitor de tela */
    await expect(r.locator(".eaa-r-ring")).toHaveAttribute("aria-hidden", "true");
    const loading = await height(r);
    await ready(page);
    expect(Math.abs((await height(r)) - loading), "sem pulo de altura ao terminar").toBeLessThan(1);
  });

  test("carregando: uma linha por disciplina, que ganha o nome quando o AVA responde", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto(`${baseURL}/d2l/home`);
    await widen(page);
    const r = panel(page);
    await expect(r).toHaveAttribute("aria-busy", "true", { timeout: 8000 });
    /* 11 disciplinas na aba: 10 linhas à vista, como no resultado */
    await expect(r.locator(".eaa-r-load:visible")).toHaveCount(10);
    /* as rápidas já têm nome; 50009 e 50010 demoram e ficam como esqueleto */
    await expect(r.locator(".eaa-r-load.done", { hasText: "Técnica Vocal I" })).toBeVisible();
    await expect(r.locator(".eaa-r-load:not(.done)").first()).toBeAttached();
    /* sem cores na tela, sem legenda */
    await expect(r.locator(".eaa-r-legend")).toBeHidden();
    await ready(page);
    await expect(r.locator(".eaa-r-load")).toHaveCount(0);
    await expect(r.locator(".eaa-r-legend")).toBeVisible();
  });

  test("a linha abre as atividades, e abrir outra fecha a anterior", async ({ page, baseURL }) => {
    await open(page, baseURL);
    await rowButton(page, 50001).click();
    await expect(panel(page).locator(".eaa-r-acts:visible .eaa-r-istate")).toHaveText(["corrigida", "aguardando correção", "a fazer"]);
    await rowButton(page, 50008).click();
    await expect(rowButton(page, 50001)).toHaveAttribute("aria-expanded", "false");
    await expect(rowButton(page, 50008)).toHaveAttribute("aria-expanded", "true");
    await expect(panel(page).locator(".eaa-r-acts:visible")).toHaveCount(1);
    /* continua aberta depois da varredura e fecha pelo teclado */
    await page.waitForTimeout(1500);
    await rowButton(page, 50008).focus();
    await page.keyboard.press("Enter");
    await expect(panel(page).locator(".eaa-r-acts:visible")).toHaveCount(0);
  });

  test("botões resistem ao CSS do AVA", async ({ page, baseURL }) => {
    await open(page, baseURL);
    const button = panel(page).locator(".eaa-r-course").first();
    await expect(button).toHaveCSS("padding", "0px 4px");
    await expect(button).toHaveCSS("border-top-width", "0px");
  });

  test("duas colunas na tela larga, uma na estreita", async ({ page, baseURL }) => {
    await open(page, baseURL);
    const columns = () =>
      panel(page)
        .locator(".eaa-r-course")
        .evaluateAll((r) => new Set(r.map((x) => Math.round(x.getBoundingClientRect().x))).size);
    await expect.poll(columns).toBe(2);
    await page.setViewportSize({ width: 700, height: 900 });
    await expect.poll(columns).toBe(1);
  });

  test("bem estreito: o anel vai para cima da lista", async ({ page, baseURL }) => {
    await open(page, baseURL, "", { viewport: 500 });
    const side = await panel(page).locator(".eaa-r-side").boundingBox();
    const body = await panel(page).locator(".eaa-r-body").boundingBox();
    expect(body.y).toBeGreaterThanOrEqual(side.y + side.height);
  });

  test("fim do semestre: um arco por disciplina, todas à vista e painel baixo", async ({ page, baseURL }) => {
    await open(page, baseURL, "closed9");
    const r = panel(page);
    await expect(r.locator(".eaa-r-arc")).toHaveCount(9);
    await expect(r.locator(".eaa-r-ring")).toHaveAttribute("aria-label", "7 de 9 disciplinas garantidas");
    await expect(r.locator(".eaa-r-title")).toContainText("7 disciplinas já garantidas");
    await expect(r.locator(".eaa-r-course:visible")).toHaveCount(9);
    await expect(r.locator(".eaa-r-more:visible")).toHaveCount(0);
    await expect(r.locator(".eaa-r-legend")).toBeHidden();
    expect(await height(r)).toBeLessThanOrEqual(205);
    await expect(r).toHaveCSS("margin-bottom", "10px");
    expect(await r.evaluate((e) => e.scrollWidth - e.clientWidth), "sem rolagem para o lado").toBeLessThanOrEqual(0);
  });

  test("duas colunas apertadas: o nome da disciplina continua legível", async ({ page, baseURL }) => {
    /* painel com cerca de 820px: Amplo em janela de 1024 a 1280px */
    await open(page, baseURL, "closed9", { width: 855 });
    const names = panel(page).locator(".eaa-r-cname");
    await expect.poll(() => names.evaluateAll((n) => Math.min(...n.map((x) => x.getBoundingClientRect().width)))).toBeGreaterThanOrEqual(96);
    const columns = await panel(page)
      .locator(".eaa-r-course")
      .evaluateAll((r) => new Set(r.map((x) => Math.round(x.getBoundingClientRect().x))).size);
    expect(columns, "continua em duas colunas").toBe(2);
    /* ficha cortada: o texto inteiro continua ao passar o mouse */
    const pill = panel(page).locator(".eaa-r-pill").first();
    await expect(pill).toHaveAttribute("title", (await pill.textContent()) ?? "");
  });

  test("lista aberta rola a partir de 6 atividades e mantém a posição", async ({ page, baseURL }) => {
    await open(page, baseURL, "closed9");
    await rowButton(page, 50101).click();
    const list = panel(page).locator("li[data-ou='50101'] .eaa-r-acts ul");
    await expect(list.locator("li")).toHaveCount(6);
    await expect(list).toHaveAttribute("tabindex", "0");
    await expect(panel(page).locator(".eaa-r-legend")).toBeVisible();
    expect(await list.evaluate((e) => e.clientHeight)).toBeLessThanOrEqual(128);
    await list.evaluate((e) => (e.scrollTop = 20));
    /* força a varredura a reescrever o painel */
    await panel(page).evaluate((e) => {
      delete e.dataset.html;
      e.querySelector(".eaa-r-title").textContent = "antigo";
    });
    await expect(panel(page).locator(".eaa-r-title")).not.toHaveText("antigo", { timeout: 4000 });
    expect(await list.evaluate((e) => e.scrollTop)).toBe(20);
    await expect(panel(page).locator("li[data-ou='50101'] .eaa-r-gocourse")).toBeVisible();
    expect(await height(panel(page))).toBeLessThanOrEqual(360);
    /* 1 atividade: sem rolagem nem parada extra no teclado */
    await rowButton(page, 50102).click();
    await expect(panel(page).locator("li[data-ou='50102'] .eaa-r-acts ul")).not.toHaveAttribute("tabindex", "0");
  });

  test("mais de 10 disciplinas: Ver mais, com colunas equilibradas", async ({ page, baseURL }) => {
    await open(page, baseURL, "closed12");
    const visible = panel(page).locator(".eaa-r-course:visible");
    const perColumn = () => panel(page).locator(".eaa-r-col").evaluateAll((c) => c.map((u) => u.children.length));
    await expect(visible).toHaveCount(10);
    await panel(page).locator(".eaa-r-more").click();
    await expect(visible).toHaveCount(12);
    expect(await perColumn()).toEqual([6, 6]);
    /* continua assim quando a varredura reescreve o painel */
    await panel(page).evaluate((e) => delete e.dataset.html);
    await page.waitForTimeout(1500);
    expect(await perColumn()).toEqual([6, 6]);
    await panel(page).locator(".eaa-r-more").click();
    await expect(visible).toHaveCount(10);
    expect((await perColumn())[0]).toBe(5);
  });

  test("uma disciplina só: nenhuma lista vazia", async ({ page, baseURL }) => {
    await open(page, baseURL, "one");
    await expect(panel(page).locator(".eaa-r-col")).toHaveCount(1);
  });

  test("linhas crescem com o texto, sem cortar", async ({ page, baseURL }) => {
    await open(page, baseURL);
    /* como uma fonte mínima maior ou mais espaçamento (WCAG 1.4.12) */
    await page.addStyleTag({ content: "#eaa-summary-wide .eaa-r-cname,#eaa-summary-wide .eaa-r-iname{line-height:40px!important}" });
    const row = panel(page).locator(".eaa-r-course").first();
    await expect.poll(() => height(row)).toBeGreaterThanOrEqual(40);
    await row.click();
    expect(await height(panel(page).locator(".eaa-r-acts:visible li").first())).toBeGreaterThanOrEqual(40);
  });

  test("tudo aprovado: lista escondida até pedir as notas", async ({ page, baseURL }) => {
    await open(page, baseURL, "passed9");
    const visible = panel(page).locator(".eaa-r-course:visible");
    await expect(visible).toHaveCount(0);
    await expect(panel(page).locator(".eaa-r-more")).toContainText("Ver notas das 9 disciplinas");
    await panel(page).locator(".eaa-r-more").click();
    await expect(visible).toHaveCount(9);
  });
});

test.describe("abertura com o Layout Amplo", () => {
  test("a tela de carregamento só sai com o Amplo pronto, sem mostrar o clássico", async ({ page, baseURL }) => {
    /* anota o que havia na página quando a tela de carregamento saiu e se o
       painel clássico chegou a aparecer (o DOM é visível ao script da página) */
    await page.addInitScript(() => {
      window.boot = { seen: false, atRemoval: null, classic: false };
      new MutationObserver(() => {
        if (document.getElementById("eaa-summary")) window.boot.classic = true;
        const on = document.documentElement.classList.contains("eaa-booting");
        if (on) window.boot.seen = true;
        else if (window.boot.seen && !window.boot.atRemoval) {
          const roots = [document];
          let cards = 0;
          for (const root of roots)
            for (const el of root.querySelectorAll("*")) {
              if (el.shadowRoot) roots.push(el.shadowRoot);
              if (el.tagName === "D2L-MY-COURSES-ENROLLMENT-CARD") cards++;
            }
          window.boot.atRemoval = { cards, wide: document.documentElement.classList.contains("eaa-wide") };
        }
      }).observe(document, { attributes: true, childList: true, subtree: true, attributeFilter: ["class"] });
    });
    await page.goto(`${baseURL}/d2l/home?slow=3000`);
    await expect.poll(() => page.evaluate(() => window.boot.atRemoval), { timeout: 10000 }).not.toBeNull();
    const boot = await page.evaluate(() => window.boot);
    expect(boot.atRemoval.cards, "cards na página quando a tela saiu").toBeGreaterThan(0);
    expect(boot.atRemoval.wide).toBe(true);
    expect(boot.classic, "o painel clássico apareceu").toBe(false);
  });
});
