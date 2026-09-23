/* Testes da barra de progresso nas páginas de uma disciplina do AVA.
 * Réplica e dados em fixtures-ava.mjs (50001 = Técnica Vocal I, inventada):
 *   1º Fechamento: corrigida · aguardando · a fazer
 *   2º Fechamento: iniciada (não enviada) · a fazer
 *
 * Rodar:  npm test
 */

import { test as base, expect } from "./navegador.mjs";

const ROTAS = {
  inicio: "/d2l/home/50001",
  conteudo: "/d2l/le/lessons/50001/units/1",
  questionarios: "/d2l/lms/quizzing/user/quizzes_list.d2l?ou=50001",
  notas: "/d2l/lms/grades/my_grades/main.d2l?ou=50001",
};

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    page.abrir = async (rota, largura = 1400) => {
      await page.setViewportSize({ width: largura, height: 800 });
      await page.goto(baseURL + rota);
      await expect(page.locator("#eaa-disc")).toHaveAttribute("aria-busy", "false", { timeout: 8000 });
    };
    await use(page);
  },
});

const caixa = (page) => page.locator("#eaa-disc");
const botao = (page) => page.locator("#eaa-disc .eaa-d-botao");
const painel = (page) => page.locator("#eaa-disc .eaa-d-painel");
const colunas = (page) => page.locator("#eaa-disc .eaa-d-col");

/* Retângulos da faixa azul, do centralizador e do último link do AVA. */
const medidas = (page) =>
  page.evaluate(() => {
    const r = (e) => e.getBoundingClientRect();
    const rodape = document.querySelector("d2l-labs-navigation-main-footer");
    const centro = rodape.shadowRoot.querySelector(".d2l-labs-navigation-centerer");
    const pad = parseFloat(getComputedStyle(centro).paddingRight);
    const links = [...rodape.querySelectorAll("a, button")].map((e) => r(e).right);
    const c = r(document.getElementById("eaa-disc"));
    return {
      faixa: { top: r(rodape).top, height: r(rodape).height },
      borda: r(centro).right - pad,
      fimDosLinks: Math.max(...links),
      caixa: { top: c.top, height: c.height, left: c.left, right: c.right },
    };
  });

test.describe("barra da disciplina", () => {
  for (const [nome, rota] of Object.entries(ROTAS)) {
    test(`aparece na rota ${nome}`, async ({ page }) => {
      await page.abrir(rota);
      await expect(caixa(page).locator(".eaa-d-val")).toHaveText("0,8 / 5,0");
      await expect(colunas(page).locator(".eaa-d-nome")).toHaveText(["1º Fechamento", "2º Fechamento"]);
      await expect(botao(page)).toHaveAttribute("aria-label", /Av1: 0,8 de 5,0/);
    });
  }

  test("mora dentro da faixa azul, alinhada à borda do conteúdo, longe dos links", async ({ page }) => {
    await page.abrir(ROTAS.inicio);
    await expect(caixa(page)).not.toHaveClass(/compacto|sem-espaco/);
    const m = await medidas(page);
    expect(Math.round(m.caixa.top)).toBe(Math.round(m.faixa.top));
    expect(Math.round(m.caixa.height)).toBe(Math.round(m.faixa.height));
    expect(Math.abs(m.caixa.right - m.borda), "borda direita alinhada").toBeLessThan(1);
    expect(m.caixa.left - m.fimDosLinks, "folga até os links do AVA").toBeGreaterThanOrEqual(16);
  });

  test("colunas com a mesma largura, barras com a mesma altura", async ({ page }) => {
    await page.abrir(ROTAS.inicio);
    const larguras = await colunas(page).evaluateAll((c) => c.map((x) => Math.round(x.getBoundingClientRect().width)));
    expect(new Set(larguras).size).toBe(1);
    const alturas = await caixa(page).locator(".eaa-seg").evaluateAll((s) => s.map((x) => x.getBoundingClientRect().height));
    expect(new Set(alturas).size).toBe(1);
    const segs = await colunas(page).evaluateAll((c) => c.map((x) => [...x.querySelectorAll(".eaa-seg i")].map((i) => i.className)));
    expect(segs).toEqual([["corrigida", "aguardando", "afazer"], ["iniciada", "afazer"]]);
  });

  test("não iniciada mostra o alerta na coluna do fechamento", async ({ page }) => {
    await page.abrir(ROTAS.inicio);
    await expect(colunas(page).nth(1)).toHaveClass(/iniciada/);
    await expect(colunas(page).nth(1).locator(".eaa-d-alerta")).toHaveText("⚠");
    await expect(colunas(page).nth(0).locator(".eaa-d-alerta")).toHaveCount(0);
  });

  test("janela estreita: compacta sem cobrir os links; estreita demais: some", async ({ page }) => {
    await page.abrir(ROTAS.inicio, 1100);
    await expect(caixa(page)).toHaveClass(/compacto/);
    const m = await medidas(page);
    expect(m.caixa.left - m.fimDosLinks).toBeGreaterThanOrEqual(16);

    await page.setViewportSize({ width: 820, height: 800 });
    await expect(caixa(page)).toHaveClass(/sem-espaco/);
    await expect(caixa(page)).toBeHidden();
  });

  test("não mexe no layout: o Conteúdo continua sem rolagem e a faixa com a mesma altura", async ({ page }) => {
    await page.abrir(ROTAS.conteudo);
    const r = await page.evaluate(() => ({
      rolagem: document.scrollingElement.scrollHeight - innerHeight,
      nav: document.querySelector("nav.d2l-navigation-s").getBoundingClientRect().height,
    }));
    expect(r.rolagem).toBeLessThanOrEqual(0);
    expect(r.nav).toBe(156);
  });

  test("painel: abre, lista cada atividade com estado e link, fecha com Esc e clique fora", async ({ page }) => {
    await page.abrir(ROTAS.inicio);
    await expect(painel(page)).toBeHidden();
    await botao(page).click();
    await expect(botao(page)).toHaveAttribute("aria-expanded", "true");
    await expect(painel(page)).toBeVisible();

    const grupos = painel(page).locator(".eaa-d-grupo");
    await expect(grupos.locator(".eaa-d-gcab > :first-child")).toHaveText(["Av1 · Primeiro Fechamento", "Av1 · Último Fechamento", "Av2"]);
    await expect(grupos.nth(0).locator(".eaa-d-estado")).toHaveText(["corrigida", "aguardando correção", "a fazer"]);
    await expect(grupos.nth(1).locator(".eaa-d-estado")).toHaveText(["iniciada e não enviada", "a fazer"]);
    /* Av2 com os links das duas partes (tarefa e questionário) */
    await expect(grupos.nth(2).locator(".eaa-d-inome")).toHaveText(["📄 Atividade Av2 (Parte 2)", "📎Atividade Av2 (Parte 1)"]);
    await expect(grupos.nth(2).locator("a").nth(1)).toHaveAttribute("href", /folder_submit_files\.d2l\?db=7099&/);
    await expect(grupos.nth(0).locator("a").nth(0)).toHaveAttribute("href", "/d2l/lms/quizzing/user/quiz_summary.d2l?ou=50001&qi=8001&cfql=1");
    await expect(grupos.nth(0).locator("a").nth(1)).toHaveAttribute("href", "/d2l/lms/dropbox/user/folder_submit_files.d2l?db=7001&grpid=0&isprv=0&bp=0&ou=50001");

    /* cor do estado não pode ser engolida pela regra do nome */
    await expect(grupos.nth(1).locator(".eaa-d-estado").first()).toHaveCSS("color", "rgb(179, 79, 0)");

    await page.keyboard.press("Escape");
    await expect(painel(page)).toBeHidden();
    await expect(botao(page)).toBeFocused();

    await botao(page).click();
    await page.mouse.click(40, 500);
    await expect(painel(page)).toBeHidden();
    await expect(botao(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("resiste ao CSS do AVA: botão, títulos e listas com as medidas próprias", async ({ page }) => {
    await page.abrir(ROTAS.inicio);
    await expect(botao(page)).toHaveCSS("padding", "0px 8px");
    await expect(botao(page)).toHaveCSS("height", "52px");
    await botao(page).click();
    await expect(painel(page).locator("h3").first()).toHaveCSS("font-size", "13px");
    await expect(painel(page).locator("ul").first()).toHaveCSS("padding-left", "0px");
  });

  test("disciplina sem Av1/Av2 mostra 'Nota' e um prazo só", async ({ page }) => {
    await page.abrir("/d2l/home/50009");
    await expect(caixa(page).locator(".eaa-d-rot")).toHaveText("Nota");
    await expect(colunas(page)).toHaveCount(1);
    await expect(colunas(page).locator(".eaa-d-nome")).toHaveText("Prazo");
  });

  test("período da Av2: a barra mostra o último fechamento e a Av2", async ({ page }) => {
    await page.abrir("/d2l/home/50010");
    await expect(colunas(page).locator(".eaa-d-nome")).toHaveText(["2º Fechamento", "Av2"]);
    await expect(colunas(page).nth(0)).toHaveClass(/encerrado/);
    await expect(colunas(page).nth(1).locator(".eaa-d-dias")).toHaveText("5 dias");
    await botao(page).click();
    await expect(painel(page).locator(".eaa-d-sit")).toHaveText("Precisa de 2,0 na Av2");
  });

  test("recuperação: a barra mostra Av2 e Av3, e o painel a situação", async ({ page }) => {
    await page.abrir("/d2l/home/50011");
    await expect(colunas(page).locator(".eaa-d-nome")).toHaveText(["Av2", "Av3"]);
    await botao(page).click();
    await expect(painel(page).locator(".eaa-d-gcab > :first-child")).toHaveText(["Av1 · Primeiro Fechamento", "Av2", "Av3 · Recuperação"]);
    await expect(painel(page).locator(".eaa-d-sit")).toHaveText("Av3 (recuperação) · 4,5");
  });

  test("carregando: aparece na hora, desativada, e o resultado entra sem mudar de lugar", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    /* 50010 responde com 2,5s de atraso na réplica */
    await page.goto(baseURL + "/d2l/home/50010");
    await expect(caixa(page)).toHaveAttribute("aria-busy", "true", { timeout: 8000 });
    await expect(botao(page)).toBeDisabled();
    await expect(colunas(page)).toHaveCount(2);
    await expect(colunas(page).first().locator(".eaa-d-nome")).toHaveText("carregando…");
    await expect(caixa(page).locator(".eaa-d-val")).not.toContainText(/\d/);
    await botao(page).click({ force: true });
    await expect(painel(page)).toHaveCount(0);
    const antes = await caixa(page).evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) };
    });

    await expect(caixa(page)).toHaveAttribute("aria-busy", "false", { timeout: 8000 });
    await expect(botao(page)).toBeEnabled();
    await expect(colunas(page).locator(".eaa-d-nome")).toHaveText(["2º Fechamento", "Av2"]);
    const depois = await caixa(page).evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.y) };
    });
    expect(depois, "mesma posição e tamanho").toEqual(antes);
  });

  test("não aparece na página inicial geral", async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.goto(baseURL + "/d2l/home");
    await expect(page.locator("#enrollment-card-50001 .eaa-prog.real")).toBeVisible({ timeout: 8000 });
    await expect(page.locator("#eaa-disc")).toHaveCount(0);
  });
});
