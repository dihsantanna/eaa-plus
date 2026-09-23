/* Testes do AVA (Brightspace): progresso nos cards de "Minhas Disciplinas"
 * e o resumo do próximo prazo acima deles.
 * Réplica e respostas em fixtures-ava.mjs — dados inventados.
 *
 * Rodar:  npm test
 */

import { test as base, expect } from "./navegador.mjs";

const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    page.pedidos = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/d2l/api/") || u.pathname.startsWith("/d2l/lms/"))
        page.pedidos.push({ metodo: r.method(), caminho: u.pathname + u.search });
    });
    page.abrir = async () => {
      await page.goto(`${baseURL}/d2l/home`);
      await expect(bloco(page, 50001).locator(".eaa-prazo")).toHaveCount(3, { timeout: 8000 });
    };
    await use(page);
  },
});

/* Locators do Playwright atravessam shadow DOM aberto. */
const cartao = (page, ou) => page.locator(`#enrollment-card-${ou}`);
const bloco = (page, ou) => cartao(page, ou).locator(".eaa-prog.real");
const prazo = (page, ou, i) => bloco(page, ou).locator(".eaa-prazo").nth(i);
const segs = (loc) => loc.locator(".eaa-seg i").evaluateAll((is) => is.map((i) => i.className));
const situacao = (page, ou) => bloco(page, ou).locator(".eaa-sit");
const resumo = (page) => page.locator("#eaa-resumo");
const aba = (page, nome) => page.locator(`#abas button[data-painel="${nome}"]`);


test.describe("progresso nas disciplinas", () => {
  test("Av1 dividida nos dois fechamentos, uma linha por prazo", async ({ page }) => {
    await page.abrir();
    const b = bloco(page, 50001);
    await expect(b.locator(".eaa-cab")).toHaveText("Av10,8 / 5,0");

    const p1 = prazo(page, 50001, 0);
    await expect(p1.locator(".eaa-nome")).toHaveText("1º Fechamento");
    await expect(p1.locator(".eaa-quando")).toHaveText(/^\d{2}\/\d{2} · (hoje|amanhã)$/);
    await expect(p1).toHaveClass(/urgente/);
    expect(await segs(p1)).toEqual(["corrigida", "aguardando", "afazer"]);
    await expect(p1.locator(".eaa-leg")).toHaveText("2 de 3 entregues1 aguardando");

    const p2 = prazo(page, 50001, 1);
    await expect(p2.locator(".eaa-nome")).toHaveText("2º Fechamento");
    await expect(p2.locator(".eaa-quando")).toHaveText(/^\d{2}\/\d{2} · 30 dias$/);
    await expect(p2).not.toHaveClass(/urgente/);
    expect(await segs(p2)).toEqual(["iniciada", "afazer"]);
    await expect(p2.locator(".eaa-leg")).toHaveText("0 de 2 entregues⚠ 1 não enviada");

    /* Av2 já criada no AVA, com a nota oculta: entra como linha própria */
    const p3 = prazo(page, 50001, 2);
    await expect(p3.locator(".eaa-nome")).toHaveText("Av2");
    await expect(p3.locator(".eaa-quando")).toHaveText(/^\d{2}\/\d{2} · 60 dias$/);
    expect(await segs(p3)).toEqual(["afazer", "afazer"]);
    /* sem pontos: a Av1 continua 0,8 / 5,0 */
    await expect(b.locator(".eaa-cab")).toHaveText("Av10,8 / 5,0");
  });

  test("entregue sem nota é 'aguardando' por qualquer uma das três fontes", async ({ page }) => {
    await page.abrir();
    const p = prazo(page, 50002, 0);
    /* 201 corrigida · 202 perdida · 203 conteúdo concluído · 204 tarefa enviada · 205 Lista de questionários */
    expect(await segs(p)).toEqual(["corrigida", "perdida", "aguardando", "aguardando", "aguardando"]);
    await expect(p.locator(".eaa-leg")).toHaveText("4 de 5 entregues1 perdida");
    await expect(p.locator(".eaa-quando")).toHaveText(/^\d{2}\/\d{2} · encerrado$/);
    await expect(p).toHaveClass(/encerrado/);
  });

  test("linhas de prazo têm a mesma estrutura em todos os cards", async ({ page }) => {
    await page.abrir();
    await expect(prazo(page, 50009, 0).locator(".eaa-nome")).toHaveText("Prazo");
    await expect(prazo(page, 50008, 0).locator(".eaa-leg")).toHaveText("0 de 1 entregues1 a fazer");
    for (const ou of [50001, 50002, 50008, 50009]) {
      const linhas = bloco(page, ou).locator(".eaa-prazo");
      const n = await linhas.count();
      for (let i = 0; i < n; i++) {
        const l = linhas.nth(i);
        await expect(l.locator(":scope > .eaa-par")).toHaveCount(2);
        await expect(l.locator(":scope > .eaa-seg")).toHaveCount(1);
        await expect(l.locator(".eaa-quando")).toHaveText(/^\d{2}\/\d{2} · /);
      }
    }
    const altura = await bloco(page, 50001).locator(".eaa-seg").evaluateAll((s) => s.map((x) => x.getBoundingClientRect().height));
    expect(new Set(altura).size, "barras com a mesma altura").toBe(1);
  });

  test("situação pela regra do manual: 6 aprova, 4 a 6 vai para Av3", async ({ page }) => {
    await page.abrir();
    await expect(situacao(page, 50003)).toHaveText("Aprovado · 7,0");
    await expect(situacao(page, 50003)).toHaveClass(/aprovado/);
    await expect(situacao(page, 50004)).toHaveText("Av3 (recuperação) · 4,5");
    await expect(situacao(page, 50005)).toHaveText("Precisa de 2,0 na Av2");
  });

  test("disciplina sem Av1/Av2 mostra só a nota, sem a regra do manual", async ({ page }) => {
    await page.abrir();
    const b = bloco(page, 50009);
    await expect(b.locator(".eaa-cab")).toHaveText("Nota8,0 / 10,0");
    await expect(prazo(page, 50009, 0).locator(".eaa-leg")).toHaveText("1 de 1 entreguescorrigido");
    await expect(b.locator(".eaa-sit")).toHaveCount(0);
  });

  test("sem situação enquanto ainda há atividade em aberto", async ({ page }) => {
    await page.abrir();
    await expect(situacao(page, 50001)).toHaveCount(0);
    await expect(situacao(page, 50002)).toHaveCount(0);
  });

  test("API com erro ou disciplina sem atividades: card fica como estava", async ({ page }) => {
    await page.abrir();
    await expect(bloco(page, 50005)).toBeVisible();
    await expect(cartao(page, 50006).locator("d2l-card")).toBeAttached();
    await expect(bloco(page, 50006)).toHaveCount(0);
    await expect(bloco(page, 50007)).toHaveCount(0);
  });

  test("blocos de cards vizinhos terminam na mesma linha, com títulos de alturas diferentes", async ({ page }) => {
    await page.abrir();
    /* 1ª fileira: 50001, 50002 e 50003 (títulos de 1 e 2 linhas) */
    for (const ou of [50002, 50003]) await expect(bloco(page, ou).locator(".eaa-cab")).toBeVisible();
    const pes = [];
    for (const ou of [50001, 50002, 50003]) {
      const b = await bloco(page, ou).boundingBox();
      pes.push(Math.round(b.y + b.height));
    }
    expect(new Set(pes).size, `pés dos blocos: ${pes.join(", ")}`).toBe(1);
    const fantasma = cartao(page, 50001).locator(".eaa-prog.fantasma");
    await expect(fantasma).toHaveAttribute("aria-hidden", "true");
    await expect(fantasma).toHaveCSS("visibility", "hidden");
  });

  test("texto do bloco não herda os 19px do card", async ({ page }) => {
    await page.abrir();
    const tamanho = await bloco(page, 50001).evaluate((el) => getComputedStyle(el).fontSize);
    expect(tamanho).toBe("12px");
  });
});

test.describe("Av2 e Av3", () => {
  test("período da Av2: fechamentos encerrados, Av2 aberta e quanto falta nela", async ({ page }) => {
    await page.abrir();
    const b = bloco(page, 50010);
    await expect(b.locator(".eaa-nome")).toHaveText(["1º Fechamento", "2º Fechamento", "Av2"]);
    await expect(prazo(page, 50010, 0)).toHaveClass(/encerrado/);
    await expect(prazo(page, 50010, 1)).toHaveClass(/encerrado/);
    const av2 = prazo(page, 50010, 2);
    await expect(av2).not.toHaveClass(/encerrado/);
    await expect(av2.locator(".eaa-quando")).toHaveText(/^\d{2}\/\d{2} · 5 dias$/);
    await expect(av2.locator(".eaa-leg")).toHaveText("0 de 1 entregues1 a fazer");
    /* Av1 resolvida: a Av2 pendente não esconde quanto falta nela */
    await expect(situacao(page, 50010)).toHaveText("Precisa de 2,0 na Av2");
  });

  test("recuperação: Av2 lançada vira corrigida e a Av3 aparece com prazo", async ({ page }) => {
    await page.abrir();
    const b = bloco(page, 50011);
    await expect(b.locator(".eaa-nome")).toHaveText(["1º Fechamento", "Av2", "Av3"]);
    await expect(prazo(page, 50011, 1).locator(".eaa-leg")).toHaveText("1 de 1 entreguescorrigido");
    const av3 = prazo(page, 50011, 2);
    await expect(av3.locator(".eaa-quando")).toHaveText(/^\d{2}\/\d{2} · 7 dias$/);
    await expect(av3.locator(".eaa-leg")).toHaveText("0 de 1 entregues1 a fazer");
    await expect(situacao(page, 50011)).toHaveText("Av3 (recuperação) · 4,5");
  });

  test("Av3 aberta para a turma não aparece para quem não está em recuperação", async ({ page }) => {
    await page.abrir();
    /* Av2 sem nota ainda */
    await expect(bloco(page, 50010).locator(".eaa-nome")).toHaveText(["1º Fechamento", "2º Fechamento", "Av2"]);
    /* aprovado */
    await expect(bloco(page, 50003).locator(".eaa-nome")).toHaveText(["Prazo"]);
    /* disciplina sem Av1/Av2 (como Atividades Extensionistas) */
    await expect(bloco(page, 50009).locator(".eaa-nome")).toHaveText(["Prazo"]);
  });

  test("Av3 que o aluno já começou aparece, mesmo sem a recuperação definida", async ({ page }) => {
    await page.abrir();
    const b = bloco(page, 50008);
    await expect(b.locator(".eaa-nome")).toHaveText(["1º Fechamento", "Av3"]);
    await expect(prazo(page, 50008, 1).locator(".eaa-leg")).toHaveText("0 de 1 entregues⚠ 1 não enviada");
  });
});

test.describe("resumo do próximo prazo", () => {
  test("mostra o fechamento mais próximo somando todas as disciplinas visíveis", async ({ page }) => {
    await page.abrir();
    const r = resumo(page);
    await expect(r.locator(".eaa-r-titulo")).toHaveText("Av1 · Primeiro Fechamento");
    await expect(r.locator(".eaa-r-quando")).toHaveText(/^\d{2}\/\d{2} às \d{2}:\d{2} · (hoje|amanhã)$/);
    await expect(r.locator(".eaa-r-quando")).toHaveClass(/urgente/);
    /* 50001: corrigida, aguardando, a fazer · 50008: a fazer */
    await expect(r.locator(".eaa-r-leg")).toHaveText("2 de 4 atividades entreguesfaltam 2");
    expect(await segs(r)).toEqual(["corrigida", "aguardando", "afazer", "afazer"]);
  });

  test("fica carregando até todas as disciplinas responderem, sem números parciais", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/d2l/home`);
    const r = resumo(page);
    /* 50010 responde com 2,5s de atraso */
    await expect(r).toHaveAttribute("aria-busy", "true", { timeout: 8000 });
    await expect(r.locator(".eaa-r-status")).toHaveText(/^carregando \d+ de \d+ disciplinas…$/);
    await expect(r.locator(".eaa-r-leg")).not.toContainText("entregues");
    await expect(r.locator(".eaa-r-ficha:not(.eaa-r-vazia)")).toHaveCount(0);
    await expect(r.locator(".eaa-r-legenda li")).toHaveCount(5);
    const alturaCarregando = await r.evaluate((e) => e.getBoundingClientRect().height);

    await expect(r).toHaveAttribute("aria-busy", "false", { timeout: 8000 });
    await expect(r.locator(".eaa-r-leg")).toHaveText("2 de 4 atividades entreguesfaltam 2");
    const alturaFinal = await r.evaluate((e) => e.getBoundingClientRect().height);
    expect(Math.abs(alturaFinal - alturaCarregando), "sem pulo de altura ao terminar").toBeLessThan(1);
  });

  test("fichas das disciplinas pendentes levam para a disciplina", async ({ page }) => {
    await page.abrir();
    const fichas = resumo(page).locator(".eaa-r-ficha");
    await expect(fichas).toHaveCount(2);
    await expect(fichas.nth(0)).toHaveText("Técnica Vocal I1");
    await expect(fichas.nth(0)).toHaveAttribute("href", "/d2l/home/50001");
    await expect(fichas.nth(1)).toHaveText("Percepção Musical I1");
    const alturas = await fichas.evaluateAll((f) => f.map((x) => x.getBoundingClientRect().height));
    expect(new Set(alturas).size, "fichas com a mesma altura").toBe(1);
  });

  test("legenda com os cinco estados, de borda a borda e espaços iguais", async ({ page }) => {
    await page.abrir();
    const lista = resumo(page).locator(".eaa-r-legenda");
    const itens = lista.locator("li");
    await expect(itens).toHaveText(["Corrigida", "Aguardando correção", "Iniciada, não enviada", "Prazo perdido", "A fazer"]);
    const cores = await itens.locator("i").evaluateAll((is) => is.map((i) => i.className));
    expect(cores).toEqual(["corrigida", "aguardando", "iniciada", "perdida", "afazer"]);

    const caixa = await lista.boundingBox();
    const r = await itens.evaluateAll((li) => li.map((x) => x.getBoundingClientRect()).map((b) => ({ x: b.x, fim: b.x + b.width, y: b.y })));
    expect(new Set(r.map((b) => Math.round(b.y))).size, "uma linha só").toBe(1);
    expect(Math.abs(r[0].x - caixa.x), "encosta à esquerda").toBeLessThan(1);
    expect(Math.abs(r[4].fim - (caixa.x + caixa.width)), "encosta à direita").toBeLessThan(1);
    const vaos = r.slice(1).map((b, i) => b.x - r[i].fim);
    expect(Math.max(...vaos) - Math.min(...vaos), `vãos: ${vaos.map(Math.round).join(", ")}`).toBeLessThan(1);
  });

  test("fica acima dos cards, dentro do widget", async ({ page }) => {
    await page.abrir();
    await expect(resumo(page)).toBeVisible();
    const posicao = await page.evaluate(() => {
      const r = document.getElementById("eaa-resumo");
      return r.nextElementSibling && r.nextElementSibling.tagName.toLowerCase();
    });
    expect(posicao).toBe("d2l-my-courses-v2");
  });
});

test.describe("regras de rede e de página", () => {
  test("só GET, só no próprio AVA, e nada de cards escondidos", async ({ page }) => {
    await page.abrir();
    await expect(bloco(page, 50005)).toBeVisible();
    expect(page.pedidos.length).toBeGreaterThan(0);
    for (const r of page.pedidos) {
      expect(r.metodo).toBe("GET");
      expect(r.caminho).toMatch(
        /^\/d2l\/(api\/le\/1\.99\/\d+\/|api\/lp\/1\.63\/enrollments\/myenrollments\/\d+$|lms\/quizzing\/user\/quizzes_list\.d2l\?ou=\d+$)/
      );
    }
    expect(page.pedidos.some((r) => r.caminho.includes("50099")), "card da aba escondida").toBe(false);
  });

  test("trocar de aba recria os cards e o progresso volta sem pedir de novo", async ({ page }) => {
    await page.abrir();
    await expect(bloco(page, 50005)).toBeVisible();

    await aba(page, "todos").click();
    await expect(situacao(page, 50099)).toHaveText("Aprovado · 10,0");
    const antes = page.pedidos.filter((r) => r.caminho.includes("50001")).length;

    await aba(page, "semestre").click();
    await expect(bloco(page, 50001).locator(".eaa-prazo")).toHaveCount(3);
    expect(page.pedidos.filter((r) => r.caminho.includes("50001")).length, "usou o que já tinha").toBe(antes);
  });

  test("melhorias da página de aulas não entram no AVA", async ({ page }) => {
    await page.abrir();
    await expect(page.locator("#eaa-period-filter")).toHaveCount(0);
    await expect(page.locator("#eaa-next-class")).toHaveCount(0);
  });
});
