/* Testes de ponta a ponta: carregam a extensão DE VERDADE num Chromium e
 * abrem as páginas-réplica geradas por gerar-fixtures.mjs.
 *
 * Rodar:  npm test
 */

import { test as base, expect, chromium } from "@playwright/test";
import { resolve } from "node:path";

const EXT = resolve(".test-build/ext");

/* Um navegador com a extensão carregada, compartilhado pela suíte. */
const test = base.extend({
  contexto: [
    async ({}, use) => {
      const ctx = await chromium.launchPersistentContext("", {
        headless: false,
        args: [
          "--headless=new",
          `--disable-extensions-except=${EXT}`,
          `--load-extension=${EXT}`,
        ],
        timezoneId: "America/Sao_Paulo",
        viewport: { width: 1100, height: 750 },
      });
      await use(ctx);
      await ctx.close();
    },
    { scope: "worker" },
  ],
  page: async ({ contexto, baseURL }, use) => {
    const page = await contexto.newPage();
    const erros = [];
    page.on("pageerror", (e) => erros.push(String(e)));
    page.abrir = async (nome) => {
      await page.goto(`${baseURL}/${nome}.html`);
      await page.waitForSelector("#eaa-period-filter", { timeout: 8000 });
    };
    await use(page);
    expect(erros, "erros de JavaScript na página").toEqual([]);
    await page.close();
  },
});

const abas = (page) => page.locator("#eaa-period-filter .pf-tab");
const aba = (page, p) => page.locator(`#eaa-period-filter .pf-tab[data-period="${p}"]`);
const card = (page) => page.locator("#eaa-next-class");
const olho = (page) => card(page).locator(".nc-eyebrow");
const titulo = (page) => card(page).locator(".nc-title");
const meta = (page) => card(page).locator(".nc-meta");
const seta = (page, passo) => card(page).locator(`.nc-arrow[data-passo="${passo}"]`);
const visiveis = (page) =>
  page.locator("main.list .card:not(.pf-hidden) .discipline").allTextContents();

/* ================================================================
 * Filtro por período
 * ================================================================ */
test.describe("filtro por período", () => {
  test("cria as 5 abas com a contagem certa", async ({ page }) => {
    await page.abrir("periodos");
    await expect(abas(page)).toHaveText([
      /Todos\s*26/,
      /1º Período\s*3/,
      /2º Período\s*23/,
      /3º Período\s*4/,
      /4º Período\s*4/,
    ]);
  });

  test("entende todos os formatos de etiqueta da página", async ({ page }) => {
    await page.abrir("periodos");
    await aba(page, "4").click();
    expect(await visiveis(page)).toEqual([
      "Canto Coral", // 1º ao 4º
      "Estudo Dirigido", // 4º
      "Projetos Sociais", // 3º e 4º
      "Flauta Doce", // 2º ao 4º
    ]);
    await aba(page, "1").click();
    expect(await visiveis(page)).toEqual([
      "Canto Coral",
      "Tecnologia", // 1º, 2º e 3º
      "Técnica Vocal I",
    ]);
  });

  test("abas centralizadas e botão ativo marcado", async ({ page }) => {
    await page.abrir("periodos");
    await expect(page.locator("#eaa-period-filter .pf-tabs")).toHaveCSS("justify-content", "center");
    await aba(page, "3").click();
    await expect(aba(page, "3")).toHaveAttribute("aria-selected", "true");
    await expect(aba(page, "all")).toHaveAttribute("aria-selected", "false");
  });

  test("gruda no topo ao rolar", async ({ page }) => {
    await page.abrir("periodos");
    await page.mouse.wheel(0, 1500);
    await expect(page.locator("#eaa-period-filter")).toHaveClass(/is-pinned/);
    const topo = await page.locator("#eaa-period-filter").evaluate((e) => e.getBoundingClientRect().top);
    expect(Math.abs(topo)).toBeLessThan(2);
  });

  test("setas do teclado trocam de aba", async ({ page }) => {
    await page.abrir("periodos");
    await aba(page, "all").focus();
    await page.keyboard.press("ArrowRight");
    await expect(aba(page, "1")).toHaveAttribute("aria-selected", "true");
    await expect(aba(page, "1")).toBeFocused();
  });
});

/* ================================================================
 * Próxima aula
 * ================================================================ */
test.describe("próxima aula", () => {
  test("fica logo abaixo das abas", async ({ page }) => {
    await page.abrir("futuro");
    const id = await page.locator("#eaa-period-filter").evaluate((e) => e.nextElementSibling.id);
    expect(id).toBe("eaa-next-class");
  });

  test("mostra a próxima com contagem regressiva e link", async ({ page }) => {
    await page.abrir("futuro");
    await expect(olho(page)).toHaveText("PRÓXIMA AULA · 1º período");
    await expect(titulo(page)).toHaveText("Orquestrando Saberes");
    await expect(meta(page)).toContainText("Profa. Joyce");
    await expect(meta(page)).toHaveText(/em 5\d min/);
    await expect(card(page).locator("a.nc-btn")).toHaveAttribute("href", "https://meet.example.com/teste");
  });

  test("usa a cor da disciplina", async ({ page }) => {
    await page.abrir("futuro");
    await expect(card(page)).toHaveCSS("border-left-color", "rgb(90, 107, 46)");
  });

  test("acompanha a aba selecionada", async ({ page }) => {
    await page.abrir("futuro");
    await aba(page, "4").click();
    await expect(titulo(page)).toHaveText("Estudo Dirigido");
    await expect(olho(page)).toHaveText("PRÓXIMA AULA · 4º período");
  });

  test("AO VIVO AGORA durante a aula", async ({ page }) => {
    await page.abrir("ao-vivo");
    await expect(card(page)).toHaveClass(/is-live/);
    await expect(olho(page)).toHaveText("AO VIVO AGORA");
    await expect(meta(page)).toContainText("termina às");
    await expect(card(page).locator("a.nc-btn")).toHaveText("Entrar agora");
  });

  test("sem link vira 'Link a confirmar', nunca botão morto", async ({ page }) => {
    await page.abrir("sem-link");
    await expect(card(page).locator(".nc-btn.is-disabled")).toHaveText("Link a confirmar");
    await expect(card(page).locator("a.nc-btn")).toHaveCount(0);
  });

  test("fim de semestre mostra estado vazio", async ({ page }) => {
    await page.abrir("passado");
    await expect(card(page)).toHaveClass(/is-empty/);
    await expect(titulo(page)).toHaveText("Nenhuma aula futura por aqui.");
    await aba(page, "2").click();
    await expect(olho(page)).toHaveText("2º PERÍODO");
  });

  test("injeta mesmo quando a página renderiza atrasada", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/tardio.html`);
    await expect(page.locator("#eaa-period-filter")).toHaveCount(0);
    await expect(page.locator("#eaa-period-filter")).toHaveCount(1, { timeout: 8000 });
    await expect(card(page)).toBeVisible();
  });
});

/* ================================================================
 * Setas / aulas no mesmo horário
 * ================================================================ */
test.describe("setas", () => {
  test("percorrem as aulas e marcam o choque de horário", async ({ page }) => {
    await page.abrir("choque");
    const pos = card(page).locator(".nc-pos");

    await expect(pos).toHaveText("1/3");
    await expect(seta(page, -1)).toBeDisabled();

    await seta(page, 1).click();
    await expect(pos).toHaveText("2/3");
    await expect(olho(page)).toHaveText(/^AO MESMO TEMPO/);

    await seta(page, 1).click();
    await expect(pos).toHaveText("3/3");
    await expect(olho(page)).toHaveText(/^EM SEGUIDA/);
    await expect(seta(page, 1)).toBeDisabled();

    await seta(page, -1).click();
    await expect(pos).toHaveText("2/3");
  });

  test("trocar de aba volta para 1/N", async ({ page }) => {
    await page.abrir("choque");
    await seta(page, 1).click();
    await aba(page, "3").click();
    await expect(card(page).locator(".nc-pos")).toHaveText("1/3");
    await expect(seta(page, -1)).toBeDisabled();
  });

  test("somem quando só existe uma aula", async ({ page }) => {
    await page.abrir("choque");
    await aba(page, "1").click();
    await expect(card(page).locator(".nc-nav")).toBeHidden();
  });

  /* Regressão do bug que foi para produção: o CSS do tema inflava o botão
     para 50px e zerava o ícone. Confere tamanho E centralização. */
  test("ícones com tamanho real mesmo com o CSS do tema", async ({ page }) => {
    await page.abrir("choque");
    const tema = await page.evaluate(() => {
      const b = document.body.appendChild(document.createElement("button"));
      const p = getComputedStyle(b).padding;
      b.remove();
      return p;
    });
    expect(tema, "a réplica precisa reproduzir o padding real do tema").toBe("11px 25px");
    for (const passo of [-1, 1]) {
      const b = await seta(page, passo).boundingBox();
      const s = await seta(page, passo).locator("svg").boundingBox();
      expect(Math.round(b.width), "largura do botão").toBe(28);
      expect(Math.round(b.height), "altura do botão").toBe(28);
      expect(Math.round(s.width), "largura do ícone").toBe(16);
      expect(Math.round(s.height), "altura do ícone").toBe(16);
      const dx = s.x + s.width / 2 - (b.x + b.width / 2);
      const dy = s.y + s.height / 2 - (b.y + b.height / 2);
      expect(Math.abs(dx), "ícone centralizado na horizontal").toBeLessThan(1.5);
      expect(Math.abs(dy), "ícone centralizado na vertical").toBeLessThan(1.5);
    }
  });
});
