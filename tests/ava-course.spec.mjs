/* Testes da barra de progresso nas páginas de uma disciplina do AVA.
 * Réplica e dados em ava-fixtures.mjs (50001 = Técnica Vocal I, inventada):
 *   1º Fechamento: corrigida · aguardando · a fazer
 *   2º Fechamento: iniciada (não enviada) · a fazer
 *
 * Rodar:  npm test
 */

import { test as base, expect } from "./browser.mjs";

const ROUTES = {
  start: "/d2l/home/50001",
  content: "/d2l/le/lessons/50001/units/1",
  quizzes: "/d2l/lms/quizzing/user/quizzes_list.d2l?ou=50001",
  grades: "/d2l/lms/grades/my_grades/main.d2l?ou=50001",
};

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    page.open = async (route, boxWidth = 1400) => {
      await page.setViewportSize({ width: boxWidth, height: 800 });
      await page.goto(baseURL + route);
      await expect(page.locator("#eaa-course")).toHaveAttribute("aria-busy", "false", { timeout: 8000 });
    };
    await use(page);
  },
});

const box = (page) => page.locator("#eaa-course");
const button = (page) => page.locator("#eaa-course .eaa-d-button");
const panel = (page) => page.locator("#eaa-course .eaa-d-panel");
const columns = (page) => page.locator("#eaa-course .eaa-d-col");

/* Retângulos da faixa azul, do centralizador e do último link do AVA. */
const metrics = (page) =>
  page.evaluate(() => {
    const r = (e) => e.getBoundingClientRect();
    const footer = document.querySelector("d2l-labs-navigation-main-footer");
    const center = footer.shadowRoot.querySelector(".d2l-labs-navigation-centerer");
    const pad = parseFloat(getComputedStyle(center).paddingRight);
    const links = [...footer.querySelectorAll("a, button")].map((e) => r(e).right);
    const c = r(document.getElementById("eaa-course"));
    return {
      band: { top: r(footer).top, height: r(footer).height },
      edge: r(center).right - pad,
      linksEnd: Math.max(...links),
      box: { top: c.top, height: c.height, left: c.left, right: c.right },
    };
  });

test.describe("barra da disciplina", () => {
  for (const [name, route] of Object.entries(ROUTES)) {
    test(`aparece na rota ${name}`, async ({ page }) => {
      await page.open(route);
      await expect(box(page).locator(".eaa-d-val")).toHaveText("0,8 / 5,0");
      await expect(columns(page).locator(".eaa-d-name")).toHaveText(["1º Fechamento", "2º Fechamento"]);
      await expect(button(page)).toHaveAttribute("aria-label", /Av1: 0,8 de 5,0/);
    });
  }

  test("mora dentro da faixa azul, alinhada à borda do conteúdo, longe dos links", async ({ page }) => {
    await page.open(ROUTES.start);
    await expect(box(page)).not.toHaveClass(/compact|no-room/);
    const m = await metrics(page);
    expect(Math.round(m.box.top)).toBe(Math.round(m.band.top));
    expect(Math.round(m.box.height)).toBe(Math.round(m.band.height));
    expect(Math.abs(m.box.right - m.edge), "borda direita alinhada").toBeLessThan(1);
    expect(m.box.left - m.linksEnd, "folga até os links do AVA").toBeGreaterThanOrEqual(16);
  });

  test("colunas com a mesma largura, barras com a mesma altura", async ({ page }) => {
    await page.open(ROUTES.start);
    const widths = await columns(page).evaluateAll((c) => c.map((x) => Math.round(x.getBoundingClientRect().width)));
    expect(new Set(widths).size).toBe(1);
    const heights = await box(page).locator(".eaa-seg").evaluateAll((s) => s.map((x) => x.getBoundingClientRect().height));
    expect(new Set(heights).size).toBe(1);
    const segs = await columns(page).evaluateAll((c) => c.map((x) => [...x.querySelectorAll(".eaa-seg i")].map((i) => i.className)));
    expect(segs).toEqual([["graded", "awaiting", "todo"], ["started", "todo"]]);
  });

  test("não iniciada mostra o alerta na coluna do fechamento", async ({ page }) => {
    await page.open(ROUTES.start);
    await expect(columns(page).nth(1)).toHaveClass(/started/);
    await expect(columns(page).nth(1).locator(".eaa-d-alert")).toHaveText("⚠");
    await expect(columns(page).nth(0).locator(".eaa-d-alert")).toHaveCount(0);
  });

  test("janela estreita: compacta sem cobrir os links; estreita demais: some", async ({ page }) => {
    await page.open(ROUTES.start, 1100);
    await expect(box(page)).toHaveClass(/compact/);
    const m = await metrics(page);
    expect(m.box.left - m.linksEnd).toBeGreaterThanOrEqual(16);

    await page.setViewportSize({ width: 820, height: 800 });
    await expect(box(page)).toHaveClass(/no-room/);
    await expect(box(page)).toBeHidden();
  });

  test("não mexe no layout: o Conteúdo continua sem rolagem e a faixa com a mesma altura", async ({ page }) => {
    await page.open(ROUTES.content);
    const r = await page.evaluate(() => ({
      scroll: document.scrollingElement.scrollHeight - innerHeight,
      nav: document.querySelector("nav.d2l-navigation-s").getBoundingClientRect().height,
    }));
    expect(r.scroll).toBeLessThanOrEqual(0);
    expect(r.nav).toBe(156);
  });

  test("painel: abre, lista cada atividade com estado e link, fecha com Esc e clique fora", async ({ page }) => {
    await page.open(ROUTES.start);
    await expect(panel(page)).toBeHidden();
    await button(page).click();
    await expect(button(page)).toHaveAttribute("aria-expanded", "true");
    await expect(panel(page)).toBeVisible();

    const groups = panel(page).locator(".eaa-d-group");
    await expect(groups.locator(".eaa-d-ghead > :first-child")).toHaveText(["Av1 · Primeiro Fechamento", "Av1 · Último Fechamento", "Av2"]);
    await expect(groups.nth(0).locator(".eaa-d-state")).toHaveText(["corrigida", "aguardando correção", "a fazer"]);
    await expect(groups.nth(1).locator(".eaa-d-state")).toHaveText(["iniciada e não enviada", "a fazer"]);
    /* Av2 com os links das duas partes (tarefa e questionário) */
    await expect(groups.nth(2).locator(".eaa-d-iname")).toHaveText(["📄 Atividade Av2 (Parte 2)", "📎Atividade Av2 (Parte 1)"]);
    await expect(groups.nth(2).locator("a").nth(1)).toHaveAttribute("href", /folder_submit_files\.d2l\?db=7099&/);
    await expect(groups.nth(0).locator("a").nth(0)).toHaveAttribute("href", "/d2l/lms/quizzing/user/quiz_summary.d2l?ou=50001&qi=8001&cfql=1");
    await expect(groups.nth(0).locator("a").nth(1)).toHaveAttribute("href", "/d2l/lms/dropbox/user/folder_submit_files.d2l?db=7001&grpid=0&isprv=0&bp=0&ou=50001");

    /* cor do estado não pode ser engolida pela regra do nome */
    await expect(groups.nth(1).locator(".eaa-d-state").first()).toHaveCSS("color", "rgb(179, 79, 0)");

    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
    await expect(button(page)).toBeFocused();

    await button(page).click();
    await page.mouse.click(40, 500);
    await expect(panel(page)).toBeHidden();
    await expect(button(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("resiste ao CSS do AVA: botão, títulos e listas com as medidas próprias", async ({ page }) => {
    await page.open(ROUTES.start);
    await expect(button(page)).toHaveCSS("padding", "0px 8px");
    await expect(button(page)).toHaveCSS("height", "52px");
    await button(page).click();
    await expect(panel(page).locator("h3").first()).toHaveCSS("font-size", "13px");
    await expect(panel(page).locator("ul").first()).toHaveCSS("padding-left", "0px");
  });

  test("disciplina sem Av1/Av2 mostra 'Nota' e um prazo só", async ({ page }) => {
    await page.open("/d2l/home/50009");
    await expect(box(page).locator(".eaa-d-label")).toHaveText("Nota");
    await expect(columns(page)).toHaveCount(1);
    await expect(columns(page).locator(".eaa-d-name")).toHaveText("Prazo");
  });

  test("período da Av2: a barra mostra o último fechamento e a Av2", async ({ page }) => {
    await page.open("/d2l/home/50010");
    await expect(columns(page).locator(".eaa-d-name")).toHaveText(["2º Fechamento", "Av2"]);
    await expect(columns(page).nth(0)).toHaveClass(/closed/);
    await expect(columns(page).nth(1).locator(".eaa-d-days")).toHaveText("5 dias");
    await button(page).click();
    await expect(panel(page).locator(".eaa-d-standing")).toHaveText("Precisa de 2,0 na Av2");
  });

  test("recuperação: a barra mostra Av2 e Av3, e o painel a situação", async ({ page }) => {
    await page.open("/d2l/home/50011");
    await expect(columns(page).locator(".eaa-d-name")).toHaveText(["Av2", "Av3"]);
    await button(page).click();
    await expect(panel(page).locator(".eaa-d-ghead > :first-child")).toHaveText(["Av1 · Primeiro Fechamento", "Av2", "Av3 · Recuperação"]);
    await expect(panel(page).locator(".eaa-d-standing")).toHaveText("Av3 (recuperação) · 4,5");
  });

  test("carregando: aparece na hora, desativada, e o resultado entra sem mudar de lugar", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    /* 50010 responde com 2,5s de atraso na réplica */
    await page.goto(baseURL + "/d2l/home/50010");
    await expect(box(page)).toHaveAttribute("aria-busy", "true", { timeout: 8000 });
    await expect(button(page)).toBeDisabled();
    await expect(columns(page)).toHaveCount(2);
    await expect(columns(page).first().locator(".eaa-d-name")).toHaveText("carregando…");
    await expect(box(page).locator(".eaa-d-val")).not.toContainText(/\d/);
    await button(page).click({ force: true });
    await expect(panel(page)).toHaveCount(0);
    const before = await box(page).evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) };
    });

    await expect(box(page)).toHaveAttribute("aria-busy", "false", { timeout: 8000 });
    await expect(button(page)).toBeEnabled();
    await expect(columns(page).locator(".eaa-d-name")).toHaveText(["2º Fechamento", "Av2"]);
    const after = await box(page).evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) };
    });
    expect(after, "mesma posição e tamanho").toEqual(before);
  });

  test("carregando com um prazo só: 1 coluna e 'Nota' desde o início", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    /* 50009 (sem Av1/Av2) responde com 2,5s de atraso na réplica */
    await page.goto(baseURL + "/d2l/home/50009");
    await expect(box(page)).toHaveAttribute("aria-busy", "true", { timeout: 8000 });
    await expect(columns(page)).toHaveCount(1);
    await expect(box(page).locator(".eaa-d-label")).toHaveText("Nota");
    const before = await box(page).evaluate((e) => Math.round(e.getBoundingClientRect().width));

    await expect(box(page)).toHaveAttribute("aria-busy", "false", { timeout: 8000 });
    await expect(columns(page).locator(".eaa-d-name")).toHaveText(["Prazo"]);
    const after = await box(page).evaluate((e) => Math.round(e.getBoundingClientRect().width));
    expect(after, "mesma largura").toBe(before);
  });

  test("não aparece na página inicial geral", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto(baseURL + "/d2l/home");
    await expect(page.locator("#enrollment-card-50001 .eaa-prog.real")).toBeVisible({ timeout: 8000 });
    await expect(page.locator("#eaa-course")).toHaveCount(0);
  });
});
