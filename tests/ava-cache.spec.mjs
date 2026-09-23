/* Testes do cache entre páginas do AVA (chrome.storage.session).
 *
 * Regras (src/ava-dados.js): 10 minutos; página de disciplina sempre lê do
 * servidor e tira a disciplina do cache; dados crus, recalculados na hora;
 * só leitura completa; chave com o id do aluno.
 *
 * A 50006 da réplica responde erro de propósito: nunca entra no cache e é
 * relida a cada volta à página inicial (como antes do cache).
 *
 * Rodar:  npm test
 */

import { test as base, expect } from "./navegador.mjs";

const VISIVEIS = ["50001", "50002", "50003", "50004", "50005", "50006", "50007", "50008", "50009", "50010", "50011"];
const COM_ERRO = "50006";
const GUARDAVEIS = VISIVEIS.filter((ou) => ou !== COM_ERRO);

const test = base.extend({
  page: async ({ page }, use) => {
    /* leituras de dados (API e páginas lidas pela extensão), não navegação */
    page.pedidos = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (r.resourceType() === "document") return;
      if (u.pathname.startsWith("/d2l/api/") || u.pathname.startsWith("/d2l/lms/")) page.pedidos.push(u.pathname + u.search);
    });
    await use(page);
  },
});

const resumo = (page) => page.locator("#eaa-resumo");
const bloco = (page, ou) => page.locator(`#enrollment-card-${ou} .eaa-prog.real`);

async function inicial(page, baseURL, busca = "") {
  page.pedidos.length = 0;
  await page.goto(`${baseURL}/d2l/home${busca}`);
  await expect(resumo(page)).toHaveAttribute("aria-busy", "false", { timeout: 10000 });
  await expect(bloco(page, 50001).locator(".eaa-cab")).toBeVisible();
}

async function disciplina(page, baseURL, ou) {
  page.pedidos.length = 0;
  await page.goto(`${baseURL}/d2l/home/${ou}`);
  await expect(page.locator("#eaa-disc")).toHaveAttribute("aria-busy", "false", { timeout: 10000 });
}

/* Disciplinas que a página leu (pelo id no caminho); "nomes" = matrículas. */
function lidas(page) {
  return [
    ...new Set(
      page.pedidos.map((c) => (c.includes("/enrollments/myenrollments/") ? "nomes" : (c.match(/\/(\d{5})\/|ou=(\d{5})/) || []).slice(1).find(Boolean)))
    ),
  ].sort();
}

const guardado = (fundo) => fundo.evaluate(() => chrome.storage.session.get(null));

async function esperarCache(fundo, ous = GUARDAVEIS) {
  const esperado = ["ava:nomes", ...ous.map((ou) => "ava:" + ou)].sort();
  await expect.poll(async () => Object.keys(await guardado(fundo)).sort(), { timeout: 8000 }).toEqual(esperado);
}

test.describe("cache entre páginas", () => {
  test("voltar à página inicial não lê de novo e desenha igual", async ({ page, baseURL, fundo }) => {
    await inicial(page, baseURL);
    expect(lidas(page)).toEqual([...VISIVEIS, "nomes"].sort());
    await esperarCache(fundo);
    const resumoAntes = await resumo(page).innerHTML();
    const blocoAntes = await bloco(page, 50001).innerHTML();

    await inicial(page, baseURL);
    expect(lidas(page), "só a disciplina com erro é lida de novo").toEqual([COM_ERRO]);
    expect(await resumo(page).innerHTML()).toBe(resumoAntes);
    expect(await bloco(page, 50001).innerHTML()).toBe(blocoAntes);
  });

  test("rodapé mostra a hora dos dados; botão resiste ao CSS do tema", async ({ page, baseURL }) => {
    await inicial(page, baseURL);
    const rodape = resumo(page).locator(".eaa-r-rodape");
    await expect(rodape.locator("span")).toHaveText(/^Atualizado às \d{2}:\d{2}$/);
    const b = rodape.locator(".eaa-r-atualizar");
    await expect(b).toHaveText("Atualizar");
    await expect(b).toBeEnabled();
    const caixa = await b.boundingBox();
    expect(caixa.height, "o tema dá padding 11px 25px a todo botão").toBe(16);
  });

  test("página da disciplina lê do servidor e só ela sai do cache", async ({ page, baseURL, fundo }) => {
    await inicial(page, baseURL);
    await esperarCache(fundo);

    await disciplina(page, baseURL, 50001);
    expect(lidas(page), "a barra leu do servidor mesmo com cache").toEqual(["50001"]);
    expect(Object.keys(await guardado(fundo))).not.toContain("ava:50001");

    await inicial(page, baseURL);
    expect(lidas(page), "de volta: só a disciplina visitada (e a com erro)").toEqual(["50001", COM_ERRO]);
  });

  test("o que mudou numa disciplina aparece depois de entrar nela", async ({ page, baseURL, fundo }) => {
    await inicial(page, baseURL);
    await esperarCache(fundo);
    const cab = bloco(page, 50001).locator(".eaa-cab");
    await expect(cab).toHaveText("Av10,8 / 5,0");

    /* o professor corrigiu a tarefa 102 e a Av1 subiu para 1,6 */
    const nota = (id, nome, n, d) => ({ GradeObjectIdentifier: String(id), GradeObjectName: nome, PointsNumerator: n, PointsDenominator: d });
    await page.route("**/d2l/api/le/1.99/50001/grades/values/myGradeValues/", (r) =>
      r.fulfill({
        json: [nota(900, "Nota AV1", 1.6, 5), nota(901, "Nota AV2", 0, 5), nota(101, "Atividade I.I", 0.8, 0.84), nota(102, "Atividade I.II", 0.8, 0.83)],
      })
    );

    /* dentro dos 10 min, sem entrar na disciplina: ainda o dado guardado */
    await inicial(page, baseURL);
    await expect(cab).toHaveText("Av10,8 / 5,0");

    await disciplina(page, baseURL, 50001);
    await inicial(page, baseURL);
    await expect(cab).toHaveText("Av11,6 / 5,0");
  });

  test("leitura incompleta não fica guardada", async ({ page, baseURL, fundo }) => {
    const rota = "**/d2l/api/le/1.99/50002/quizzes/";
    await page.route(rota, (r) => r.fulfill({ status: 500, json: { title: "erro" } }));
    await inicial(page, baseURL);
    await esperarCache(fundo, GUARDAVEIS.filter((ou) => ou !== "50002"));
    await page.unroute(rota);

    await inicial(page, baseURL);
    expect(lidas(page)).toEqual(["50002", COM_ERRO]);
  });

  test("outro aluno no mesmo navegador não aproveita nada", async ({ page, baseURL, fundo }) => {
    await inicial(page, baseURL);
    await esperarCache(fundo);

    await inicial(page, baseURL, "?usuario=2002");
    expect(lidas(page)).toEqual([...VISIVEIS, "nomes"].sort());
    await expect
      .poll(async () => Object.values(await guardado(fundo)).map((e) => e.usuario).filter((u) => u !== "2002"), { timeout: 8000 })
      .toEqual([]);
  });

  test("depois de 10 minutos lê tudo de novo", async ({ page, baseURL, fundo }) => {
    await inicial(page, baseURL);
    await esperarCache(fundo);
    await fundo.evaluate(async () => {
      const tudo = await chrome.storage.session.get(null);
      for (const k in tudo) tudo[k].lidoEm -= 10 * 60 * 1000 + 1000;
      await chrome.storage.session.set(tudo);
    });

    await inicial(page, baseURL);
    expect(lidas(page)).toEqual([...VISIVEIS, "nomes"].sort());
  });

  test("com dado guardado, prazo vencido é recalculado na hora", async ({ page, baseURL, fundo }) => {
    await inicial(page, baseURL);
    await esperarCache(fundo);
    await expect(bloco(page, 50001).locator(".eaa-seg i.perdida")).toHaveCount(0);

    /* mesmo dado guardado, mas com os prazos já passados: o relógio de agora
       tem que transformar "a fazer" em "prazo perdido" sem ler nada */
    await fundo.evaluate(async () => {
      const k = "ava:50001";
      const e = (await chrome.storage.session.get(k))[k];
      const ontem = new Date(Date.now() - 86400000).toISOString();
      e.valor.questionarios.forEach((q) => (q.EndDate = ontem));
      e.valor.pastas.forEach((p) => p.Availability && (p.Availability.EndDate = ontem));
      await chrome.storage.session.set({ [k]: e });
    });

    await inicial(page, baseURL);
    expect(lidas(page)).toEqual([COM_ERRO]);
    await expect(bloco(page, 50001).locator(".eaa-seg i.perdida").first()).toBeAttached();
  });

  test("Atualizar lê tudo de novo sem recarregar a página", async ({ page, baseURL, fundo }) => {
    await inicial(page, baseURL);
    await esperarCache(fundo);
    const cab = bloco(page, 50001).locator(".eaa-cab");
    await expect(cab).toHaveText("Av10,8 / 5,0");

    /* o professor lançou nota nesse meio-tempo */
    const nota = (id, nome, n, d) => ({ GradeObjectIdentifier: String(id), GradeObjectName: nome, PointsNumerator: n, PointsDenominator: d });
    await page.route("**/d2l/api/le/1.99/50001/grades/values/myGradeValues/", (r) =>
      r.fulfill({
        json: [nota(900, "Nota AV1", 1.6, 5), nota(901, "Nota AV2", 0, 5), nota(101, "Atividade I.I", 0.8, 0.84), nota(102, "Atividade I.II", 0.8, 0.83)],
      })
    );

    /* marcas que só sobrevivem se a página NÃO recarregar e o bloco do card
       for o mesmo elemento (sem sumir e voltar) */
    await page.evaluate(() => (window.__semRecarregar = true));
    await bloco(page, 50001).evaluate((el) => (el.__mesmo = true));
    let navegou = false;
    page.on("framenavigated", (f) => f === page.mainFrame() && (navegou = true));

    page.pedidos.length = 0;
    await resumo(page).locator(".eaa-r-atualizar").click();
    await expect(resumo(page)).toHaveAttribute("aria-busy", "true");
    await expect(resumo(page)).toHaveAttribute("aria-busy", "false", { timeout: 10000 });

    expect(navegou, "não recarregou").toBe(false);
    expect(await page.evaluate(() => window.__semRecarregar)).toBe(true);
    expect(await bloco(page, 50001).evaluate((el) => el.__mesmo), "bloco reaproveitado").toBe(true);
    expect(lidas(page), "tudo do servidor, nada do cache").toEqual([...VISIVEIS, "nomes"].sort());
    await expect(cab).toHaveText("Av11,6 / 5,0");
    await expect(resumo(page).locator(".eaa-r-atualizar")).toBeEnabled();
  });

  test("guarda só os campos usados, sem textos das atividades", async ({ page, baseURL, fundo }) => {
    await inicial(page, baseURL);
    await esperarCache(fundo);
    const e = (await guardado(fundo))["ava:50001"];
    expect(Object.keys(e).sort()).toEqual(["formato", "lidoEm", "usuario", "valor"]);
    expect(e.usuario).toBe("1001");
    expect(e.valor.questionarios.length).toBeGreaterThan(0);
    for (const q of e.valor.questionarios) expect(Object.keys(q).every((k) => ["QuizId", "Name", "GradeItemId", "IsActive", "DueDate", "EndDate"].includes(k))).toBe(true);
    for (const p of e.valor.pastas) expect(Object.keys(p).every((k) => ["Id", "Name", "GradeItemId", "IsHidden", "DueDate", "Availability"].includes(k))).toBe(true);
  });
});
