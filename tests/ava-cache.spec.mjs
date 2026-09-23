/* Testes do cache entre páginas do AVA (chrome.storage.session).
 *
 * Regras (src/ava-data.js): 10 minutos; página de disciplina sempre lê do
 * servidor e tira a disciplina do cache; dados crus, recalculados na hora;
 * só leitura completa; chave com o id do aluno.
 *
 * A 50006 da réplica responde erro de propósito: nunca entra no cache e é
 * relida a cada volta à página inicial (como antes do cache).
 *
 * Rodar:  npm test
 */

import { test as base, expect } from "./browser.mjs";

const VISIBLE = ["50001", "50002", "50003", "50004", "50005", "50006", "50007", "50008", "50009", "50010", "50011"];
const FAILING = "50006";
const CACHEABLE = VISIBLE.filter((ou) => ou !== FAILING);

const test = base.extend({
  page: async ({ page }, use) => {
    /* leituras de dados (API e páginas lidas pela extensão), não navegação */
    page.requests = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (r.resourceType() === "document") return;
      if (u.pathname.startsWith("/d2l/api/") || u.pathname.startsWith("/d2l/lms/")) page.requests.push(u.pathname + u.search);
    });
    await use(page);
  },
});

const summary = (page) => page.locator("#eaa-summary");
const block = (page, ou) => page.locator(`#enrollment-card-${ou} .eaa-prog.real`);

async function openHome(page, baseURL, query = "") {
  page.requests.length = 0;
  await page.goto(`${baseURL}/d2l/home${query}`);
  await expect(summary(page)).toHaveAttribute("aria-busy", "false", { timeout: 10000 });
  await expect(block(page, 50001).locator(".eaa-head")).toBeVisible();
}

async function course(page, baseURL, ou) {
  page.requests.length = 0;
  await page.goto(`${baseURL}/d2l/home/${ou}`);
  await expect(page.locator("#eaa-course")).toHaveAttribute("aria-busy", "false", { timeout: 10000 });
}

/* Disciplinas que a página leu (pelo id no caminho); "names" = matrículas. */
function coursesRead(page) {
  return [
    ...new Set(
      page.requests.map((c) => (c.includes("/enrollments/myenrollments/") ? "names" : (c.match(/\/(\d{5})\/|ou=(\d{5})/) || []).slice(1).find(Boolean)))
    ),
  ].sort();
}

const stored = (background) => background.evaluate(() => chrome.storage.session.get(null));

async function waitForCache(background, ous = CACHEABLE) {
  const expected = ["ava:names", ...ous.map((ou) => "ava:" + ou)].sort();
  await expect.poll(async () => Object.keys(await stored(background)).sort(), { timeout: 8000 }).toEqual(expected);
}

test.describe("cache entre páginas", () => {
  test("voltar à página inicial não lê de novo e desenha igual", async ({ page, baseURL, background }) => {
    await openHome(page, baseURL);
    expect(coursesRead(page)).toEqual([...VISIBLE, "names"].sort());
    await waitForCache(background);
    const summaryBefore = await summary(page).innerHTML();
    const blockBefore = await block(page, 50001).innerHTML();

    await openHome(page, baseURL);
    expect(coursesRead(page), "só a disciplina com erro é lida de novo").toEqual([FAILING]);
    expect(await summary(page).innerHTML()).toBe(summaryBefore);
    expect(await block(page, 50001).innerHTML()).toBe(blockBefore);
  });

  test("rodapé mostra a hora dos dados; botão resiste ao CSS do tema", async ({ page, baseURL }) => {
    await openHome(page, baseURL);
    const footer = summary(page).locator(".eaa-r-footer");
    await expect(footer.locator("span")).toHaveText(/^Atualizado às \d{2}:\d{2}$/);
    const b = footer.locator(".eaa-r-refresh");
    await expect(b).toHaveText("Atualizar");
    await expect(b).toBeEnabled();
    const box = await b.boundingBox();
    expect(box.height, "o tema dá padding 11px 25px a todo botão").toBe(16);
  });

  test("página da disciplina lê do servidor e só ela sai do cache", async ({ page, baseURL, background }) => {
    await openHome(page, baseURL);
    await waitForCache(background);

    await course(page, baseURL, 50001);
    expect(coursesRead(page), "a barra leu do servidor mesmo com cache").toEqual(["50001"]);
    expect(Object.keys(await stored(background))).not.toContain("ava:50001");

    await openHome(page, baseURL);
    expect(coursesRead(page), "de volta: só a disciplina visitada (e a com erro)").toEqual(["50001", FAILING]);
  });

  test("o que mudou numa disciplina aparece depois de entrar nela", async ({ page, baseURL, background }) => {
    await openHome(page, baseURL);
    await waitForCache(background);
    const headerRow = block(page, 50001).locator(".eaa-head");
    await expect(headerRow).toHaveText("Av10,8 / 5,0");

    /* o professor corrigiu a tarefa 102 e a Av1 subiu para 1,6 */
    const grade = (id, name, n, d) => ({ GradeObjectIdentifier: String(id), GradeObjectName: name, PointsNumerator: n, PointsDenominator: d });
    await page.route("**/d2l/api/le/1.99/50001/grades/values/myGradeValues/", (r) =>
      r.fulfill({
        json: [grade(900, "Nota AV1", 1.6, 5), grade(901, "Nota AV2", 0, 5), grade(101, "Atividade I.I", 0.8, 0.84), grade(102, "Atividade I.II", 0.8, 0.83)],
      })
    );

    /* dentro dos 10 min, sem entrar na disciplina: ainda o dado guardado */
    await openHome(page, baseURL);
    await expect(headerRow).toHaveText("Av10,8 / 5,0");

    await course(page, baseURL, 50001);
    await openHome(page, baseURL);
    await expect(headerRow).toHaveText("Av11,6 / 5,0");
  });

  test("leitura incompleta não fica guardada", async ({ page, baseURL, background }) => {
    const quizRoute = "**/d2l/api/le/1.99/50002/quizzes/";
    await page.route(quizRoute, (r) => r.fulfill({ status: 500, json: { title: "erro" } }));
    await openHome(page, baseURL);
    await waitForCache(background, CACHEABLE.filter((ou) => ou !== "50002"));
    await page.unroute(quizRoute);

    await openHome(page, baseURL);
    expect(coursesRead(page)).toEqual(["50002", FAILING]);
  });

  test("outro aluno no mesmo navegador não aproveita nada", async ({ page, baseURL, background }) => {
    await openHome(page, baseURL);
    await waitForCache(background);

    await openHome(page, baseURL, "?user=2002");
    expect(coursesRead(page)).toEqual([...VISIBLE, "names"].sort());
    await expect
      .poll(async () => Object.values(await stored(background)).map((e) => e.user).filter((u) => u !== "2002"), { timeout: 8000 })
      .toEqual([]);
  });

  test("depois de 10 minutos lê tudo de novo", async ({ page, baseURL, background }) => {
    await openHome(page, baseURL);
    await waitForCache(background);
    await background.evaluate(async () => {
      const everything = await chrome.storage.session.get(null);
      for (const k in everything) everything[k].readAt -= 10 * 60 * 1000 + 1000;
      await chrome.storage.session.set(everything);
    });

    await openHome(page, baseURL);
    expect(coursesRead(page)).toEqual([...VISIBLE, "names"].sort());
  });

  test("com dado guardado, prazo vencido é recalculado na hora", async ({ page, baseURL, background }) => {
    await openHome(page, baseURL);
    await waitForCache(background);
    await expect(block(page, 50001).locator(".eaa-seg i.missed")).toHaveCount(0);

    /* mesmo dado guardado, mas com os prazos já passados: o relógio de agora
       tem que transformar "a fazer" em "prazo perdido" sem ler nada */
    await background.evaluate(async () => {
      const k = "ava:50001";
      const e = (await chrome.storage.session.get(k))[k];
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      e.value.quizzes.forEach((q) => (q.EndDate = yesterday));
      e.value.folders.forEach((p) => p.Availability && (p.Availability.EndDate = yesterday));
      await chrome.storage.session.set({ [k]: e });
    });

    await openHome(page, baseURL);
    expect(coursesRead(page)).toEqual([FAILING]);
    await expect(block(page, 50001).locator(".eaa-seg i.missed").first()).toBeAttached();
  });

  test("Atualizar lê tudo de novo sem recarregar a página", async ({ page, baseURL, background }) => {
    await openHome(page, baseURL);
    await waitForCache(background);
    const headerRow = block(page, 50001).locator(".eaa-head");
    await expect(headerRow).toHaveText("Av10,8 / 5,0");

    /* o professor lançou nota nesse meio-tempo */
    const grade = (id, name, n, d) => ({ GradeObjectIdentifier: String(id), GradeObjectName: name, PointsNumerator: n, PointsDenominator: d });
    await page.route("**/d2l/api/le/1.99/50001/grades/values/myGradeValues/", (r) =>
      r.fulfill({
        json: [grade(900, "Nota AV1", 1.6, 5), grade(901, "Nota AV2", 0, 5), grade(101, "Atividade I.I", 0.8, 0.84), grade(102, "Atividade I.II", 0.8, 0.83)],
      })
    );

    /* marcas que só sobrevivem se a página NÃO recarregar e o bloco do card
       for o mesmo elemento (sem sumir e voltar) */
    await page.evaluate(() => (window.__notReloaded = true));
    await block(page, 50001).evaluate((el) => (el.__same = true));
    let navigated = false;
    page.on("framenavigated", (f) => f === page.mainFrame() && (navigated = true));

    page.requests.length = 0;
    await summary(page).locator(".eaa-r-refresh").click();
    await expect(summary(page)).toHaveAttribute("aria-busy", "true");
    await expect(summary(page)).toHaveAttribute("aria-busy", "false", { timeout: 10000 });

    expect(navigated, "não recarregou").toBe(false);
    expect(await page.evaluate(() => window.__notReloaded)).toBe(true);
    expect(await block(page, 50001).evaluate((el) => el.__same), "bloco reaproveitado").toBe(true);
    expect(coursesRead(page), "tudo do servidor, nada do cache").toEqual([...VISIBLE, "names"].sort());
    await expect(headerRow).toHaveText("Av11,6 / 5,0");
    await expect(summary(page).locator(".eaa-r-refresh")).toBeEnabled();
  });

  test("guarda só os campos usados, sem textos das atividades", async ({ page, baseURL, background }) => {
    await openHome(page, baseURL);
    await waitForCache(background);
    const e = (await stored(background))["ava:50001"];
    expect(Object.keys(e).sort()).toEqual(["format", "readAt", "user", "value"]);
    expect(e.user).toBe("1001");
    expect(e.value.quizzes.length).toBeGreaterThan(0);
    for (const q of e.value.quizzes) expect(Object.keys(q).every((k) => ["QuizId", "Name", "GradeItemId", "IsActive", "DueDate", "EndDate"].includes(k))).toBe(true);
    for (const p of e.value.folders) expect(Object.keys(p).every((k) => ["Id", "Name", "GradeItemId", "IsHidden", "DueDate", "Availability"].includes(k))).toBe(true);
  });
});
