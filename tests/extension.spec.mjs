/* Testes de ponta a ponta: carregam a extensão DE VERDADE num Chromium e
 * abrem as páginas-réplica geradas por generate-fixtures.mjs.
 *
 * Rodar:  npm test
 */

import { test as base, expect } from "./browser.mjs";

/* Nas páginas da escola, esperar a barra de abas antes de cada teste. */
const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    page.open = async (name) => {
      await page.goto(`${baseURL}/${name}.html`);
      await page.waitForSelector("#eaa-period-filter", { timeout: 8000 });
    };
    await use(page);
  },
});

const tabs = (page) => page.locator("#eaa-period-filter .pf-tab");
const tabButton = (page, p) => page.locator(`#eaa-period-filter .pf-tab[data-period="${p}"]`);
const card = (page) => page.locator("#eaa-next-class");
const eye = (page) => card(page).locator(".nc-eyebrow");
const title = (page) => card(page).locator(".nc-title");
const meta = (page) => card(page).locator(".nc-meta");
const arrow = (page, step) => card(page).locator(`.nc-arrow[data-step="${step}"]`);
const visible = (page) =>
  page.locator("main.list .card:not(.pf-hidden) .discipline").allTextContents();

/* ================================================================
 * Filtro por período
 * ================================================================ */
test.describe("filtro por período", () => {
  test("cria as 5 abas com a contagem certa", async ({ page }) => {
    await page.open("periods");
    await expect(tabs(page)).toHaveText([
      /Todos\s*26/,
      /1º Período\s*3/,
      /2º Período\s*23/,
      /3º Período\s*4/,
      /4º Período\s*4/,
    ]);
  });

  test("entende todos os formatos de etiqueta da página", async ({ page }) => {
    await page.open("periods");
    await tabButton(page, "4").click();
    expect(await visible(page)).toEqual([
      "Canto Coral", // 1º ao 4º
      "Estudo Dirigido", // 4º
      "Projetos Sociais", // 3º e 4º
      "Flauta Doce", // 2º ao 4º
    ]);
    await tabButton(page, "1").click();
    expect(await visible(page)).toEqual([
      "Canto Coral",
      "Tecnologia", // 1º, 2º e 3º
      "Técnica Vocal I",
    ]);
  });

  test("abas centralizadas e botão ativo marcado", async ({ page }) => {
    await page.open("periods");
    await expect(page.locator("#eaa-period-filter .pf-tabs")).toHaveCSS("justify-content", "center");
    await tabButton(page, "3").click();
    await expect(tabButton(page, "3")).toHaveAttribute("aria-selected", "true");
    await expect(tabButton(page, "all")).toHaveAttribute("aria-selected", "false");
  });

  test("gruda no topo ao rolar", async ({ page }) => {
    await page.open("periods");
    await page.mouse.wheel(0, 1500);
    await expect(page.locator("#eaa-period-filter")).toHaveClass(/is-pinned/);
    const top = await page.locator("#eaa-period-filter").evaluate((e) => e.getBoundingClientRect().top);
    expect(Math.abs(top)).toBeLessThan(2);
  });

  test("setas do teclado trocam de aba", async ({ page }) => {
    await page.open("periods");
    await tabButton(page, "all").focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabButton(page, "1")).toHaveAttribute("aria-selected", "true");
    await expect(tabButton(page, "1")).toBeFocused();
  });
});

/* ================================================================
 * Próxima aula
 * ================================================================ */
test.describe("próxima aula", () => {
  test("fica logo abaixo das abas", async ({ page }) => {
    await page.open("future");
    const id = await page.locator("#eaa-period-filter").evaluate((e) => e.nextElementSibling.id);
    expect(id).toBe("eaa-next-class");
  });

  test("mostra a próxima com contagem regressiva e link", async ({ page }) => {
    await page.open("future");
    await expect(eye(page)).toHaveText("PRÓXIMA AULA · 1º período");
    await expect(title(page)).toHaveText("Orquestrando Saberes");
    await expect(meta(page)).toContainText("Profa. Joyce");
    await expect(meta(page)).toHaveText(/em 5\d min/);
    await expect(card(page).locator("a.nc-btn")).toHaveAttribute("href", "https://meet.example.com/teste");
  });

  test("usa a cor da disciplina", async ({ page }) => {
    await page.open("future");
    await expect(card(page)).toHaveCSS("border-left-color", "rgb(90, 107, 46)");
  });

  test("acompanha a aba selecionada", async ({ page }) => {
    await page.open("future");
    await tabButton(page, "4").click();
    await expect(title(page)).toHaveText("Estudo Dirigido");
    await expect(eye(page)).toHaveText("PRÓXIMA AULA · 4º período");
  });

  test("AO VIVO AGORA durante a aula", async ({ page }) => {
    await page.open("live");
    await expect(card(page)).toHaveClass(/is-live/);
    await expect(eye(page)).toHaveText("AO VIVO AGORA");
    await expect(meta(page)).toContainText("termina às");
    await expect(card(page).locator("a.nc-btn")).toHaveText("Entrar agora");
  });

  test("sem link vira 'Link a confirmar', nunca botão morto", async ({ page }) => {
    await page.open("no-link");
    await expect(card(page).locator(".nc-btn.is-disabled")).toHaveText("Link a confirmar");
    await expect(card(page).locator("a.nc-btn")).toHaveCount(0);
  });

  test("fim de semestre mostra estado vazio", async ({ page }) => {
    await page.open("past");
    await expect(card(page)).toHaveClass(/is-empty/);
    await expect(title(page)).toHaveText("Nenhuma aula futura por aqui.");
    await tabButton(page, "2").click();
    await expect(eye(page)).toHaveText("2º PERÍODO");
  });

  test("injeta mesmo quando a página renderiza atrasada", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/late.html`);
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
    await page.open("clash");
    const pos = card(page).locator(".nc-pos");

    await expect(pos).toHaveText("1/3");
    await expect(arrow(page, -1)).toBeDisabled();

    await arrow(page, 1).click();
    await expect(pos).toHaveText("2/3");
    await expect(eye(page)).toHaveText(/^AO MESMO TEMPO/);

    await arrow(page, 1).click();
    await expect(pos).toHaveText("3/3");
    await expect(eye(page)).toHaveText(/^EM SEGUIDA/);
    await expect(arrow(page, 1)).toBeDisabled();

    await arrow(page, -1).click();
    await expect(pos).toHaveText("2/3");
  });

  test("trocar de aba volta para 1/N", async ({ page }) => {
    await page.open("clash");
    await arrow(page, 1).click();
    await tabButton(page, "3").click();
    await expect(card(page).locator(".nc-pos")).toHaveText("1/3");
    await expect(arrow(page, -1)).toBeDisabled();
  });

  test("somem quando só existe uma aula", async ({ page }) => {
    await page.open("clash");
    await tabButton(page, "1").click();
    await expect(card(page).locator(".nc-nav")).toBeHidden();
  });

  /* Regressão do bug que foi para produção: o CSS do tema inflava o botão
     para 50px e zerava o ícone. Confere tamanho E centralização. */
  test("ícones com tamanho real mesmo com o CSS do tema", async ({ page }) => {
    await page.open("clash");
    const theme = await page.evaluate(() => {
      const b = document.body.appendChild(document.createElement("button"));
      const p = getComputedStyle(b).padding;
      b.remove();
      return p;
    });
    expect(theme, "a réplica precisa reproduzir o padding real do tema").toBe("11px 25px");
    for (const step of [-1, 1]) {
      const b = await arrow(page, step).boundingBox();
      const s = await arrow(page, step).locator("svg").boundingBox();
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
