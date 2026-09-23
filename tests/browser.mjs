/* Um Chromium com a extensão carregada DE VERDADE, compartilhado pela suíte.
 * Usado por todos os *.spec.mjs. `fundo` é o service worker da extensão
 * (para ler e mexer no chrome.storage.session nos testes do cache). */

import { test as base, expect, chromium } from "@playwright/test";
import { resolve } from "node:path";

const EXT = resolve(".test-build/ext");

export const test = base.extend({
  extensionContext: [
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
  /* Service worker da extensão: dá acesso ao chrome.storage.session. */
  background: async ({ extensionContext }, use) => {
    let sw = extensionContext.serviceWorkers().find((s) => s.url().startsWith("chrome-extension://"));
    if (!sw) sw = await extensionContext.waitForEvent("serviceworker");
    await use(sw);
  },
  page: async ({ extensionContext, background }, use) => {
    /* O cache entre páginas vive enquanto o navegador vive: cada teste começa
       sem nada guardado pelo anterior. */
    await background.evaluate(() => chrome.storage.session.clear());
    const page = await extensionContext.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await use(page);
    expect(errors, "erros de JavaScript na página").toEqual([]);
    await page.close();
  },
});

export { expect };
