/* Testes unitários das regras do AVA (src/ava-rules.js), em Node puro.
 *
 * Rodam em menos de 1 segundo e dizem exatamente qual regra quebrou — os
 * testes E2E (tests/*.spec.mjs) continuam cobrindo o desenho na página.
 *
 * Rodar:  npm run test:unit   (o npm test roda estes e depois os E2E)
 *
 * A hora é fixa (NOW), então nada aqui depende do dia em que o teste roda.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

/* O arquivo é um script de content script (sem import/export): roda no
   mesmo contexto do Node com um EAAPlus vazio, como no navegador. */
globalThis.EAAPlus = {};
vm.runInThisContext(readFileSync("src/ava-rules.js", "utf8"), { filename: "src/ava-rules.js" });
const R = globalThis.EAAPlus.avaRules;

/* ---------- relógio e prazos (horário de Brasília) ---------- */
const at = (s) => Date.parse(s + "-03:00");
const NOW = at("2026-09-23T15:00:00");
const FIRST_CLOSE = "2026-09-28T23:59:00-03:00";
const LAST_CLOSE = "2026-10-26T23:59:00-03:00";
const YESTERDAY = "2026-09-22T23:59:00-03:00";
const SEC1 = "Avaliação 1 (Av1) - Primeiro Fechamento";
const SEC2 = "Avaliação 1 (Av1) - Último Fechamento";

/* ---------- construtores de dados crus, no formato da API ---------- */
const numeric = (Id, Name, MaxPoints) => ({ Id, Name, GradeType: "Numeric", IsHidden: false, MaxPoints });
const formula = (Id, Name) => ({ Id, Name, GradeType: "Formula", IsHidden: false });
const value = (id, name, n, d) => ({ GradeObjectIdentifier: String(id), GradeObjectName: name, PointsNumerator: n, PointsDenominator: d });
const quiz = (QuizId, GradeItemId, EndDate, Name = `Questionário ${QuizId}`) => ({ QuizId, GradeItemId, IsActive: true, Name, DueDate: null, EndDate });
const folder = (Id, GradeItemId, EndDate, Name = `Tarefa ${Id}`) => ({ Id, GradeItemId, IsHidden: false, Name, DueDate: null, Availability: { EndDate } });
const AV_FORMULAS = [formula(900, "Nota AV1"), formula(901, "Nota AV2")];
const av = (n1, n2) => [value(900, "Nota AV1", n1, 5), value(901, "Nota AV2", n2, 5)];

function raw(parts) {
  return {
    gi: [],
    values: [],
    folders: [],
    quizzes: [],
    toc: null,
    myItems: [],
    quizList: {},
    submissions: { submittedIds: {}, sections: {} },
    ...parts,
  };
}

/* classify + summarize, como ava-data.js faz */
const summary = (parts) => {
  const r = raw(parts);
  return R.summarize(R.classify(50001, r), r.values, NOW);
};
const states = (group) => group.items.map((it) => it.state);

/* ------------------------------------------------------------------ */

describe("estado de cada atividade (finalState)", () => {
  const item = (o) => ({ state: null, submitted: false, inProgress: false, deadline: null, ...o });

  test("nota lançada vale mais que tudo", () => {
    assert.equal(R.finalState(item({ state: "graded", deadline: at("2026-09-01T00:00:00") }), NOW), "graded");
  });
  test("enviada e sem nota: aguardando", () => {
    assert.equal(R.finalState(item({ submitted: true, deadline: Date.parse(FIRST_CLOSE) }), NOW), "awaiting");
  });
  test("tentativa aberta dentro do prazo: iniciada", () => {
    assert.equal(R.finalState(item({ inProgress: true, deadline: Date.parse(FIRST_CLOSE) }), NOW), "started");
  });
  test("tentativa aberta depois do prazo: o AVA fecha e envia, então aguardando", () => {
    assert.equal(R.finalState(item({ inProgress: true, deadline: Date.parse(YESTERDAY) }), NOW), "awaiting");
  });
  test("prazo vencido sem envio: perdida", () => {
    assert.equal(R.finalState(item({ deadline: Date.parse(YESTERDAY) }), NOW), "missed");
  });
  test("dentro do prazo e sem envio: a fazer", () => {
    assert.equal(R.finalState(item({ deadline: Date.parse(FIRST_CLOSE) }), NOW), "todo");
  });
});

describe("dados crus → atividades (classify)", () => {
  test("questionário com tentativa usada conta como enviado", () => {
    const r = summary({
      gi: [...AV_FORMULAS, numeric(101, "Atividade", 1)],
      quizzes: [quiz(8001, 101, FIRST_CLOSE)],
      quizList: { 8001: { section: SEC1, used: 1, inProgress: false } },
    });
    assert.deepEqual(states(r.deadlines[0]), ["awaiting"]);
  });

  test("ícone de tentativa aberta vence o '1 / 1' (armadilha real do AVA)", () => {
    const r = summary({
      gi: [...AV_FORMULAS, numeric(101, "Atividade", 1)],
      quizzes: [quiz(8001, 101, FIRST_CLOSE)],
      quizList: { 8001: { section: SEC1, used: 1, inProgress: true } },
    });
    assert.deepEqual(states(r.deadlines[0]), ["started"]);
  });

  test("tarefa enviada (pela página de tarefas) e sem nota: aguardando", () => {
    const r = summary({
      gi: [...AV_FORMULAS, numeric(102, "Tarefa", 1)],
      folders: [folder(7001, 102, FIRST_CLOSE)],
      submissions: { submittedIds: { 7001: true }, sections: { 7001: SEC1 } },
    });
    assert.deepEqual(states(r.deadlines[0]), ["awaiting"]);
  });

  test("nota liberada no boletim: corrigida, com os pontos", () => {
    const r = summary({
      gi: [...AV_FORMULAS, numeric(101, "Atividade", 1)],
      values: [...av(0.8, 0), value(101, "Atividade", 0.8, 1)],
      quizzes: [quiz(8001, 101, FIRST_CLOSE)],
    });
    assert.deepEqual(states(r.deadlines[0]), ["graded"]);
    assert.equal(r.ok, 0.8);
  });

  test("tarefa oculta não entra", () => {
    const r = summary({
      gi: [...AV_FORMULAS, numeric(102, "Tarefa", 1)],
      folders: [{ ...folder(7001, 102, FIRST_CLOSE), IsHidden: true }],
    });
    assert.equal(r.deadlines[0].items[0].assignment, null);
  });

  test("atividade da Av2 fora do boletim entra pela seção da Lista de questionários, sem pontos", () => {
    const r = summary({
      gi: [...AV_FORMULAS],
      quizzes: [quiz(8099, 1099, "2026-11-23T23:59:00-03:00", "Atividade final")],
      quizList: { 8099: { section: "Avaliação 2 (Av2)", used: 0, inProgress: false } },
    });
    assert.equal(r.deadlines.length, 1);
    assert.equal(r.deadlines[0].shortLabel, "Av2");
    assert.equal(r.deadlines[0].items[0].max, 0);
  });
});

describe("grupos por prazo e resumo (summarize)", () => {
  test("Av1 em dois fechamentos: um grupo por dia, com nomes curtos e longos", () => {
    const r = summary({
      gi: [...AV_FORMULAS, numeric(101, "A", 1), numeric(103, "B", 1)],
      quizzes: [quiz(8001, 101, FIRST_CLOSE), quiz(8003, 103, LAST_CLOSE)],
      quizList: {
        8001: { section: SEC1, used: 0, inProgress: false },
        8003: { section: SEC2, used: 0, inProgress: false },
      },
    });
    assert.deepEqual(
      r.deadlines.map((g) => [g.shortLabel, g.longLabel]),
      [["1º Fechamento", "Av1 · Primeiro Fechamento"], ["2º Fechamento", "Av1 · Último Fechamento"]]
    );
  });

  test("'Nota AV2' vale 0 até a prova ser lançada: 0 não é resultado", () => {
    const r = summary({ gi: [...AV_FORMULAS], values: av(3, 0) });
    assert.equal(r.av2, null);
  });

  test("nota da Av2 lançada: as atividades da Av2 viram corrigidas", () => {
    const r = summary({
      gi: [...AV_FORMULAS],
      values: av(3, 2.5),
      quizzes: [quiz(8099, 1099, "2026-11-23T23:59:00-03:00", "Av2 - prova")],
    });
    assert.equal(r.av2, 2.5);
    assert.deepEqual(states(r.deadlines[0]), ["graded"]);
  });

  test("Av3 só aparece para quem está em recuperação (4 ≤ Av1+Av2 < 6)", () => {
    const av3 = { quizzes: [quiz(8309, 9309, "2026-12-10T23:59:00-03:00", "Avaliação de Recuperação")] };
    const aprovado = summary({ gi: [...AV_FORMULAS], values: av(4, 3), ...av3 });
    const recuperacao = summary({ gi: [...AV_FORMULAS], values: av(3, 2), ...av3 });
    assert.equal(aprovado.deadlines.some((g) => g.av === 3), false);
    assert.equal(recuperacao.deadlines.some((g) => g.av === 3), true);
  });

  test("disciplina sem Av1/Av2 (Canto Coral): rótulo 'Nota' e sem situação", () => {
    const r = summary({ gi: [numeric(901, "Nota final", 10)] });
    assert.equal(r.hasAv, false);
    assert.equal(r.label, "Nota");
    assert.equal(R.standing(r), null);
  });
});

describe("situação pela regra do manual (standing)", () => {
  const base = { hasAv: true, av1: 3, av2: null, av3: null, c1: { awaiting: 0, pending: 0 } };

  test("Av1 + Av2 ≥ 6: aprovado", () => {
    assert.deepEqual(R.standing({ ...base, av1: 4, av2: 2 }), ["passed", "Aprovado · 6,0"]);
  });
  test("entre 4 e 6: Av3 (recuperação)", () => {
    assert.deepEqual(R.standing({ ...base, av1: 3, av2: 1.5 }), ["recovery", "Av3 (recuperação) · 4,5"]);
  });
  test("abaixo de 4: reprovado", () => {
    assert.deepEqual(R.standing({ ...base, av1: 2, av2: 1 }), ["failed", "Reprovado · 3,0"]);
  });
  test("nota da Av3 lançada: só mostra a nota (o manual não diz a conta)", () => {
    assert.deepEqual(R.standing({ ...base, av2: 2, av3: 3 }), ["", "Nota da Av3 · 3,0"]);
  });
  test("Av1 ainda com atividade em aberto: sem situação", () => {
    assert.equal(R.standing({ ...base, c1: { awaiting: 1, pending: 0 } }), null);
  });
  test("Av1 resolvida: quanto falta na Av2", () => {
    assert.deepEqual(R.standing({ ...base, av1: 3.2 }), ["", "Precisa de 2,8 na Av2"]);
  });
  test("Av1 sozinha já passa de 6", () => {
    assert.deepEqual(R.standing({ ...base, av1: 6 }), ["passed", "Av1 já garante os 6,0"]);
  });
});

describe("o que buscar na 2ª leva (plan)", () => {
  test("sem questionário: não lê a Lista de questionários", () => {
    assert.equal(R.plan([numeric(101, "A", 1)], [], [folder(7001, 101, FIRST_CLOSE)], []).hasQuiz, false);
  });
  test("confere envio só de tarefa que conta e ainda não tem nota", () => {
    const p = R.plan(
      [numeric(101, "A", 1), numeric(102, "B", 1)],
      [value(101, "A", 1, 1)],
      [folder(7001, 101, FIRST_CLOSE), folder(7002, 102, FIRST_CLOSE)],
      []
    );
    assert.deepEqual(p.toCheck.map((f) => f.Id), [7002]);
  });
  test("atividade avaliada que não é tarefa nem questionário: lê o conteúdo", () => {
    assert.equal(R.plan([numeric(105, "Fórum", 1)], [], [], []).unlinked, true);
  });
});

describe("textos e datas (Brasília)", () => {
  test("tempo restante", () => {
    assert.equal(R.timeLeft(Date.parse(YESTERDAY), false, NOW), "encerrado");
    assert.equal(R.timeLeft(at("2026-09-23T23:59:00"), false, NOW), "hoje");
    assert.equal(R.timeLeft(at("2026-09-24T08:00:00"), false, NOW), "amanhã");
    assert.equal(R.timeLeft(Date.parse(FIRST_CLOSE), true, NOW), "em 5 dias");
  });
  test("dia de calendário é o de Brasília, não o UTC", () => {
    /* 23h em Brasília já é o dia seguinte em UTC */
    assert.equal(R.dayOf(at("2026-09-23T23:00:00")), "2026-09-23");
  });
  test("reconhece Av2/Av3 pela seção ou pelo nome", () => {
    assert.equal(R.whichAv("Avaliação 2 (Av2)", ""), 2);
    assert.equal(R.whichAv("", "Av3 - Envio de Relatório Final"), 3);
    assert.equal(R.whichAv("", "Avaliação de Recuperação"), 3);
    assert.equal(R.whichAv(SEC1, "Questionário"), null);
  });
  test("números no formato brasileiro", () => {
    assert.equal(R.formatNum(0.84), "0,8");
    assert.equal(R.plural(1, "perdida", "perdidas"), "1 perdida");
    assert.equal(R.plural(2, "perdida", "perdidas"), "2 perdidas");
  });
});
