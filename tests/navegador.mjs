/* Um Chromium com a extensão carregada DE VERDADE, compartilhado pela suíte.
 * Usado por todos os *.spec.mjs. */

import { test as base, expect, chromium } from "@playwright/test";
import { resolve } from "node:path";

const EXT = resolve(".test-build/ext");

export const test = base.extend({
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
  page: async ({ contexto }, use) => {
    const page = await contexto.newPage();
    const erros = [];
    page.on("pageerror", (e) => erros.push(String(e)));
    await use(page);
    expect(erros, "erros de JavaScript na página").toEqual([]);
    await page.close();
  },
});

export { expect };
