/* Testes do AVA (Brightspace): progresso nos cards de "Minhas Disciplinas"
 * e o resumo do próximo prazo acima deles.
 * Réplica e respostas em ava-fixtures.mjs — dados inventados.
 *
 * Rodar:  npm test
 */

import { test as base, expect } from "./browser.mjs";

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    page.requests = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/d2l/api/") || u.pathname.startsWith("/d2l/lms/"))
        page.requests.push({ method: r.method(), path: u.pathname + u.search });
    });
    page.open = async () => {
      await page.goto(`${baseURL}/d2l/home`);
      await expect(block(page, 50001).locator(".eaa-deadline")).toHaveCount(3, { timeout: 8000 });
    };
    await use(page);
  },
});

/* Locators do Playwright atravessam shadow DOM aberto. */
const d2lCard = (page, ou) => page.locator(`#enrollment-card-${ou}`);
const block = (page, ou) => d2lCard(page, ou).locator(".eaa-prog.real");
const deadline = (page, ou, i) => block(page, ou).locator(".eaa-deadline").nth(i);
const segs = (loc) => loc.locator(".eaa-seg i").evaluateAll((is) => is.map((i) => i.className));
const standing = (page, ou) => block(page, ou).locator(".eaa-standing");
const summary = (page) => page.locator("#eaa-summary");
const tabButton = (page, name) => page.locator(`#tabs button[data-panel="${name}"]`);


test.describe("progresso nas disciplinas", () => {
  test("Av1 dividida nos dois fechamentos, uma linha por prazo", async ({ page }) => {
    await page.open();
    const b = block(page, 50001);
    await expect(b.locator(".eaa-head")).toHaveText("Av10,8 / 5,0");

    const p1 = deadline(page, 50001, 0);
    await expect(p1.locator(".eaa-name")).toHaveText("1º Fechamento");
    await expect(p1.locator(".eaa-when")).toHaveText(/^\d{2}\/\d{2} · (hoje|amanhã)$/);
    await expect(p1).toHaveClass(/urgent/);
    expect(await segs(p1)).toEqual(["graded", "awaiting", "todo"]);
    await expect(p1.locator(".eaa-caption")).toHaveText("2 de 3 entregues1 aguardando");

    const p2 = deadline(page, 50001, 1);
    await expect(p2.locator(".eaa-name")).toHaveText("2º Fechamento");
    await expect(p2.locator(".eaa-when")).toHaveText(/^\d{2}\/\d{2} · 30 dias$/);
    await expect(p2).not.toHaveClass(/urgent/);
    expect(await segs(p2)).toEqual(["started", "todo"]);
    await expect(p2.locator(".eaa-caption")).toHaveText("0 de 2 entregues⚠ 1 não enviada");

    /* Av2 já criada no AVA, com a nota oculta: entra como linha própria */
    const p3 = deadline(page, 50001, 2);
    await expect(p3.locator(".eaa-name")).toHaveText("Av2");
    await expect(p3.locator(".eaa-when")).toHaveText(/^\d{2}\/\d{2} · 60 dias$/);
    expect(await segs(p3)).toEqual(["todo", "todo"]);
    /* sem pontos: a Av1 continua 0,8 / 5,0 */
    await expect(b.locator(".eaa-head")).toHaveText("Av10,8 / 5,0");
  });

  test("entregue sem nota é 'aguardando' por qualquer uma das três fontes", async ({ page }) => {
    await page.open();
    const p = deadline(page, 50002, 0);
    /* 201 corrigida · 202 perdida · 203 conteúdo concluído · 204 tarefa enviada · 205 Lista de questionários */
    expect(await segs(p)).toEqual(["graded", "missed", "awaiting", "awaiting", "awaiting"]);
    await expect(p.locator(".eaa-caption")).toHaveText("4 de 5 entregues1 perdida");
    await expect(p.locator(".eaa-when")).toHaveText(/^\d{2}\/\d{2} · encerrado$/);
    await expect(p).toHaveClass(/closed/);
  });

  test("linhas de prazo têm a mesma estrutura em todos os cards", async ({ page }) => {
    await page.open();
    await expect(deadline(page, 50009, 0).locator(".eaa-name")).toHaveText("Prazo");
    await expect(deadline(page, 50008, 0).locator(".eaa-caption")).toHaveText("0 de 1 entregues1 a fazer");
    for (const ou of [50001, 50002, 50008, 50009]) {
      const rows = block(page, ou).locator(".eaa-deadline");
      const n = await rows.count();
      for (let i = 0; i < n; i++) {
        const l = rows.nth(i);
        await expect(l.locator(":scope > .eaa-pair")).toHaveCount(2);
        await expect(l.locator(":scope > .eaa-seg")).toHaveCount(1);
        await expect(l.locator(".eaa-when")).toHaveText(/^\d{2}\/\d{2} · /);
      }
    }
    const boxHeight = await block(page, 50001).locator(".eaa-seg").evaluateAll((s) => s.map((x) => x.getBoundingClientRect().height));
    expect(new Set(boxHeight).size, "barras com a mesma altura").toBe(1);
  });

  test("situação pela regra do manual: 6 aprova, 4 a 6 vai para Av3", async ({ page }) => {
    await page.open();
    await expect(standing(page, 50003)).toHaveText("Aprovado · 7,0");
    await expect(standing(page, 50003)).toHaveClass(/passed/);
    await expect(standing(page, 50004)).toHaveText("Av3 (recuperação) · 4,5");
    await expect(standing(page, 50005)).toHaveText("Precisa de 2,0 na Av2");
  });

  test("disciplina sem Av1/Av2 mostra só a nota, sem a regra do manual", async ({ page }) => {
    await page.open();
    const b = block(page, 50009);
    await expect(b.locator(".eaa-head")).toHaveText("Nota8,0 / 10,0");
    await expect(deadline(page, 50009, 0).locator(".eaa-caption")).toHaveText("1 de 1 entreguescorrigido");
    await expect(b.locator(".eaa-standing")).toHaveCount(0);
  });

  test("sem situação enquanto ainda há atividade em aberto", async ({ page }) => {
    await page.open();
    await expect(standing(page, 50001)).toHaveCount(0);
    await expect(standing(page, 50002)).toHaveCount(0);
  });

  test("API com erro ou disciplina sem atividades: card fica como estava", async ({ page }) => {
    await page.open();
    await expect(block(page, 50005)).toBeVisible();
    await expect(d2lCard(page, 50006).locator("d2l-card")).toBeAttached();
    await expect(block(page, 50006)).toHaveCount(0);
    await expect(block(page, 50007)).toHaveCount(0);
  });

  test("blocos de cards vizinhos terminam na mesma linha, com títulos de alturas diferentes", async ({ page }) => {
    await page.open();
    /* 1ª fileira: 50001, 50002 e 50003 (títulos de 1 e 2 linhas) */
    for (const ou of [50002, 50003]) await expect(block(page, ou).locator(".eaa-head")).toBeVisible();
    const footerItems = [];
    for (const ou of [50001, 50002, 50003]) {
      const b = await block(page, ou).boundingBox();
      footerItems.push(Math.round(b.y + b.height));
    }
    expect(new Set(footerItems).size, `pés dos blocos: ${footerItems.join(", ")}`).toBe(1);
    const ghost = d2lCard(page, 50001).locator(".eaa-prog.ghost");
    await expect(ghost).toHaveAttribute("aria-hidden", "true");
    await expect(ghost).toHaveCSS("visibility", "hidden");
  });

  test("texto do bloco não herda os 19px do card", async ({ page }) => {
    await page.open();
    const size = await block(page, 50001).evaluate((el) => getComputedStyle(el).fontSize);
    expect(size).toBe("12px");
  });
});

test.describe("Av2 e Av3", () => {
  test("período da Av2: fechamentos encerrados, Av2 aberta e quanto falta nela", async ({ page }) => {
    await page.open();
    const b = block(page, 50010);
    await expect(b.locator(".eaa-name")).toHaveText(["1º Fechamento", "2º Fechamento", "Av2"]);
    await expect(deadline(page, 50010, 0)).toHaveClass(/closed/);
    await expect(deadline(page, 50010, 1)).toHaveClass(/closed/);
    const av2 = deadline(page, 50010, 2);
    await expect(av2).not.toHaveClass(/closed/);
    await expect(av2.locator(".eaa-when")).toHaveText(/^\d{2}\/\d{2} · 5 dias$/);
    await expect(av2.locator(".eaa-caption")).toHaveText("0 de 1 entregues1 a fazer");
    /* Av1 resolvida: a Av2 pendente não esconde quanto falta nela */
    await expect(standing(page, 50010)).toHaveText("Precisa de 2,0 na Av2");
  });

  test("recuperação: Av2 lançada vira corrigida e a Av3 aparece com prazo", async ({ page }) => {
    await page.open();
    const b = block(page, 50011);
    await expect(b.locator(".eaa-name")).toHaveText(["1º Fechamento", "Av2", "Av3"]);
    await expect(deadline(page, 50011, 1).locator(".eaa-caption")).toHaveText("1 de 1 entreguescorrigido");
    const av3 = deadline(page, 50011, 2);
    await expect(av3.locator(".eaa-when")).toHaveText(/^\d{2}\/\d{2} · 7 dias$/);
    await expect(av3.locator(".eaa-caption")).toHaveText("0 de 1 entregues1 a fazer");
    await expect(standing(page, 50011)).toHaveText("Av3 (recuperação) · 4,5");
  });

  test("Av3 aberta para a turma não aparece para quem não está em recuperação", async ({ page }) => {
    await page.open();
    /* Av2 sem nota ainda */
    await expect(block(page, 50010).locator(".eaa-name")).toHaveText(["1º Fechamento", "2º Fechamento", "Av2"]);
    /* aprovado */
    await expect(block(page, 50003).locator(".eaa-name")).toHaveText(["Prazo"]);
    /* disciplina sem Av1/Av2 (como Atividades Extensionistas) */
    await expect(block(page, 50009).locator(".eaa-name")).toHaveText(["Prazo"]);
  });

  test("Av3 que o aluno já começou aparece, mesmo sem a recuperação definida", async ({ page }) => {
    await page.open();
    const b = block(page, 50008);
    await expect(b.locator(".eaa-name")).toHaveText(["1º Fechamento", "Av3"]);
    await expect(deadline(page, 50008, 1).locator(".eaa-caption")).toHaveText("0 de 1 entregues⚠ 1 não enviada");
  });
});

test.describe("resumo do próximo prazo", () => {
  test("mostra o fechamento mais próximo somando todas as disciplinas visíveis", async ({ page }) => {
    await page.open();
    const r = summary(page);
    await expect(r.locator(".eaa-r-title")).toHaveText("Av1 · Primeiro Fechamento");
    await expect(r.locator(".eaa-r-when")).toHaveText(/^\d{2}\/\d{2} às \d{2}:\d{2} · (hoje|amanhã)$/);
    await expect(r.locator(".eaa-r-when")).toHaveClass(/urgent/);
    /* 50001: corrigida, aguardando, a fazer · 50008: a fazer */
    await expect(r.locator(".eaa-r-caption")).toHaveText("2 de 4 atividades entreguesfaltam 2");
    expect(await segs(r)).toEqual(["graded", "awaiting", "todo", "todo"]);
  });

  test("fica carregando até todas as disciplinas responderem, sem números parciais", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/d2l/home`);
    const r = summary(page);
    /* 50010 responde com 2,5s de atraso */
    await expect(r).toHaveAttribute("aria-busy", "true", { timeout: 8000 });
    await expect(r.locator(".eaa-r-status")).toHaveText(/^carregando \d+ de \d+ disciplinas…$/);
    await expect(r.locator(".eaa-r-caption")).not.toContainText("entregues");
    await expect(r.locator(".eaa-r-chip:not(.eaa-r-empty)")).toHaveCount(0);
    await expect(r.locator(".eaa-r-legend li")).toHaveCount(5);
    const loadingHeight = await r.evaluate((e) => e.getBoundingClientRect().height);

    await expect(r).toHaveAttribute("aria-busy", "false", { timeout: 8000 });
    await expect(r.locator(".eaa-r-caption")).toHaveText("2 de 4 atividades entreguesfaltam 2");
    const finalHeight = await r.evaluate((e) => e.getBoundingClientRect().height);
    expect(Math.abs(finalHeight - loadingHeight), "sem pulo de altura ao terminar").toBeLessThan(1);
  });

  test("fichas das disciplinas pendentes levam para a disciplina", async ({ page }) => {
    await page.open();
    const chips = summary(page).locator(".eaa-r-chip");
    await expect(chips).toHaveCount(2);
    await expect(chips.nth(0)).toHaveText("Técnica Vocal I1");
    await expect(chips.nth(0)).toHaveAttribute("href", "/d2l/home/50001");
    await expect(chips.nth(1)).toHaveText("Percepção Musical I1");
    const heights = await chips.evaluateAll((f) => f.map((x) => x.getBoundingClientRect().height));
    expect(new Set(heights).size, "fichas com a mesma altura").toBe(1);
  });

  test("cores do tema (ava-theme.css) chegam ao resumo e ao shadow DOM dos cards", async ({ page }) => {
    await page.open();
    const GRADED = "rgb(70, 166, 97)"; /* --eaa-graded: #46a661 */
    const AWAITING = "rgb(255, 186, 89)"; /* --eaa-awaiting: #ffba59 */
    await expect(summary(page).locator(".eaa-r-legend i.graded")).toHaveCSS("background-color", GRADED);
    /* 50001: corrigida, aguardando, a fazer — dentro de 4 shadow roots */
    const segments = deadline(page, 50001, 0).locator(".eaa-seg i");
    await expect(segments.nth(0)).toHaveCSS("background-color", GRADED);
    await expect(segments.nth(1)).toHaveCSS("background-color", AWAITING);
  });

  test("legenda com os cinco estados, de borda a borda e espaços iguais", async ({ page }) => {
    await page.open();
    const legendList = summary(page).locator(".eaa-r-legend");
    const items = legendList.locator("li");
    await expect(items).toHaveText(["Corrigida", "Aguardando correção", "Iniciada, não enviada", "Prazo perdido", "A fazer"]);
    const colors = await items.locator("i").evaluateAll((is) => is.map((i) => i.className));
    expect(colors).toEqual(["graded", "awaiting", "started", "missed", "todo"]);

    const box = await legendList.boundingBox();
    const r = await items.evaluateAll((li) => li.map((x) => x.getBoundingClientRect()).map((b) => ({ x: b.x, end: b.x + b.width, y: b.y })));
    expect(new Set(r.map((b) => Math.round(b.y))).size, "uma linha só").toBe(1);
    expect(Math.abs(r[0].x - box.x), "encosta à esquerda").toBeLessThan(1);
    expect(Math.abs(r[4].end - (box.x + box.width)), "encosta à direita").toBeLessThan(1);
    const gaps = r.slice(1).map((b, i) => b.x - r[i].end);
    expect(Math.max(...gaps) - Math.min(...gaps), `vãos: ${gaps.map(Math.round).join(", ")}`).toBeLessThan(1);
  });

  test("fica acima dos cards, dentro do widget", async ({ page }) => {
    await page.open();
    await expect(summary(page)).toBeVisible();
    const position = await page.evaluate(() => {
      const r = document.getElementById("eaa-summary");
      return r.nextElementSibling && r.nextElementSibling.tagName.toLowerCase();
    });
    expect(position).toBe("d2l-my-courses-v2");
  });
});

test.describe("regras de rede e de página", () => {
  test("só GET, só no próprio AVA, e nada de cards escondidos", async ({ page }) => {
    await page.open();
    await expect(block(page, 50005)).toBeVisible();
    expect(page.requests.length).toBeGreaterThan(0);
    for (const r of page.requests) {
      expect(r.method).toBe("GET");
      expect(r.path).toMatch(
        /^\/d2l\/(api\/le\/1\.99\/\d+\/|api\/lp\/1\.63\/enrollments\/myenrollments\/\?orgUnitTypeId=3$|lms\/quizzing\/user\/quizzes_list\.d2l\?ou=\d+$|lms\/dropbox\/user\/folders_list\.d2l\?ou=\d+&isprv=0$)/
      );
    }
    expect(page.requests.some((r) => r.path.includes("50099")), "card da aba escondida").toBe(false);
  });

  test("poucas leituras: só o que cada disciplina precisa", async ({ page }) => {
    await page.open();
    await expect(summary(page)).toHaveAttribute("aria-busy", "false", { timeout: 8000 });
    const source = (snippet) => page.requests.filter((r) => r.path.includes(snippet));
    /* nome: uma leitura para todas */
    expect(source("/enrollments/myenrollments/").length).toBe(1);
    /* sumário do conteúdo: só onde há atividade avaliada fora de tarefa/questionário (50002) */
    expect(source("/content/toc").map((r) => r.path)).toEqual(["/d2l/api/le/1.99/50002/content/toc"]);
    expect(source("/content/myItems/").length).toBe(1);
    /* Lista de questionários: nunca em disciplina sem questionário (50009) */
    expect(source("quizzes_list.d2l?ou=50009").length).toBe(0);
    /* envios: uma página de tarefas por disciplina que tem tarefa sem nota
       (50001, 50002, 50009 — a 7901 já corrigida não conta) */
    expect(source("folders_list.d2l").map((r) => r.path.match(/ou=(\d+)/)[1]).sort()).toEqual(["50001", "50002", "50009"]);
    /* API de envios só para a tarefa que não apareceu na página */
    expect(source("/submissions/mysubmissions/").map((r) => r.path)).toEqual([
      "/d2l/api/le/1.99/50002/dropbox/folders/7204/submissions/mysubmissions/",
    ]);
    /* nenhuma leitura repetida */
    const paths = page.requests.map((r) => r.path);
    const repeated = paths.filter((c, i) => paths.indexOf(c) !== i);
    expect(repeated, "sem repetição").toEqual([]);
  });

  test("trocar de aba recria os cards e o progresso volta sem pedir de novo", async ({ page }) => {
    await page.open();
    await expect(block(page, 50005)).toBeVisible();

    await tabButton(page, "all").click();
    await expect(standing(page, 50099)).toHaveText("Aprovado · 10,0");
    const before = page.requests.filter((r) => r.path.includes("50001")).length;

    await tabButton(page, "semester").click();
    await expect(block(page, 50001).locator(".eaa-deadline")).toHaveCount(3);
    expect(page.requests.filter((r) => r.path.includes("50001")).length, "usou o que já tinha").toBe(before);
  });
});
