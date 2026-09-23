/* Réplica da página inicial do AVA (Brightspace) + respostas da API.
 *
 * A estrutura foi copiada da página real em 2026-09-23:
 *
 *   d2l-my-courses-v2  (DOM normal)
 *     #shadow d2l-my-courses-container-v2
 *       #shadow d2l-tabs > d2l-tab-panel > d2l-my-courses-content-v2
 *         #shadow d2l-my-courses-card-grid-v2
 *           #shadow d2l-my-courses-enrollment-card#enrollment-card-{ou}
 *             #shadow <style> + d2l-card (slots header/content/actions)
 *
 * O que importa reproduzir:
 *  - 4 shadow roots até o card (MutationObserver não atravessa);
 *  - o card monta o conteúdo DEPOIS de entrar na página (Polymer);
 *  - trocar de aba recria os cards do zero;
 *  - o <a> do d2l-card cobre o card inteiro e o conteúdo herda 19px/28px.
 *
 * Os dados são INVENTADOS. Nada aqui veio das notas de ninguém.
 */

import { mkdirSync, writeFileSync } from "node:fs";

const DAY_MS = 86400000;
const iso = (days) => new Date(Date.now() + days * DAY_MS).toISOString();
const LE = "/d2l/api/le/1.99/";

/* Os dois fechamentos da Av1, como no curso de Música: um que vence daqui a
   2 horas (hoje ou amanhã, conforme o relógio) e outro daqui a 30 dias. */
const FIRST_CLOSE = new Date(Date.now() + 2 * 3600000).toISOString();
const LAST_CLOSE = iso(30);
const SEC1 = "Avaliação 1 (Av1) - Primeiro Fechamento";
const SEC2 = "Avaliação 1 (Av1) - Último Fechamento";

const formula = (Id, Name) => ({ Id, Name, GradeType: "Formula", CategoryId: 1, IsHidden: false });
const numeric = (Id, Name, MaxPoints) => ({ Id, Name, GradeType: "Numeric", MaxPoints, CategoryId: 2, IsHidden: false });
const value = (Id, Name, PointsNumerator, PointsDenominator) => ({
  GradeObjectIdentifier: String(Id),
  GradeObjectName: Name,
  GradeObjectType: Name.startsWith("Nota") ? 6 : 1,
  PointsNumerator,
  PointsDenominator,
  DisplayedGrade: "Avaliação 1",
});
const quiz = (QuizId, GradeItemId, end) => ({
  QuizId, GradeItemId, IsActive: true, Name: `Questionário ${QuizId}`, StartDate: null, DueDate: null,
  EndDate: typeof end === "number" ? iso(end) : end,
});
const folder = (Id, GradeItemId, end) => ({
  Id, GradeItemId, IsHidden: false, Name: `Tarefa ${Id}`, DueDate: null,
  Availability: { StartDate: null, EndDate: typeof end === "number" ? iso(end) : end },
});
const av = (n1, n2) => [value(900, "Nota AV1", n1, 5), value(901, "Nota AV2", n2, 5)];
const FORMULAS = [formula(900, "Nota AV1"), formula(901, "Nota AV2")];

/* Uma entrada por disciplina; cada chave vira uma rota.
   listaQ = seções da página "Lista de questionários": [título, [[quizId, tentativas usadas, em andamento?]]] */
export const COURSES = [
  {
    /* O caso típico: Av1 em dois fechamentos. */
    ou: 50001,
    name: "Técnica Vocal I",
    grades: [
      ...FORMULAS,
      numeric(101, "Atividade I.I", 0.84), numeric(102, "Atividade I.II", 0.83), numeric(105, "Atividade I.III", 0.83),
      numeric(103, "Atividade II.I", 1.25), numeric(104, "Atividade II.II", 1.25),
    ],
    values: [...av(0.8, 0), value(101, "Atividade I.I", 0.8, 0.84)],
    quizzes: [
      quiz(8001, 101, FIRST_CLOSE), quiz(8005, 105, FIRST_CLOSE), quiz(8003, 103, LAST_CLOSE), quiz(8004, 104, LAST_CLOSE),
      /* Av2: o item de nota (1099) é oculto para o aluno, como no AVA real */
      { ...quiz(8099, 1099, 60), Name: "📄 Atividade Av2 (Parte 2)" },
    ],
    folders: [folder(7001, 102, FIRST_CLOSE), { ...folder(7099, 1098, 60), Name: "📎Atividade Av2 (Parte 1)" }],
    submissions: { 7001: [{ Status: 1, Submissions: [{ Id: 1 }] }], 7099: [] },
    quizList: [
      /* 8001 corrigido, com o link de feedback enganoso */
      [SEC1, [[8001, 1, "feedback"], [8005, 0]]],
      /* 8003: "1 / 1" igual a um enviado — só o ícone diz que está aberto */
      [SEC2, [[8003, 1, "open"], [8004, 0]]],
      ["Avaliação 2 (Av2)", [[8099, 0]]],
    ],
  },
  {
    /* Prazo único, já vencido: cada jeito de saber que foi entregue. */
    ou: 50002,
    name: "Leitura e Escrita de Partitura I",
    grades: [
      ...FORMULAS,
      numeric(201, "Atividade 1", 1), numeric(202, "Atividade 2", 1), numeric(203, "Atividade 3", 1),
      numeric(204, "Atividade 4", 1), numeric(205, "Atividade 5", 1),
    ],
    values: [...av(0.9, 0), value(201, "Atividade 1", 0.9, 1)],
    /* 203 não é tarefa nem questionário: é um tópico avaliado do conteúdo */
    quizzes: [quiz(8201, 201, -1), quiz(8202, 202, -1), quiz(8205, 205, -1)],
    folders: [folder(7204, 204, -1)],
    submissions: { 7204: [{ Status: 1, Submissions: [{ Id: 1 }] }] },
    /* 7204 não aparece na página de tarefas: a extensão cai para a API de envios */
    notOnPage: [7204],
    /* 203: tópico avaliado concluído — só o conteúdo sabe (e dá o prazo) */
    toc: { Modules: [{ Topics: [{ TopicId: 9203, GradeItemId: 203 }], Modules: [] }] },
    myItems: [{ ItemId: 9203, DateCompleted: iso(-1), DueDate: null, EndDate: iso(-1) }],
    /* 205: só a Lista de questionários sabe (caso real da DMEM) */
    /* 8205 enviado e sem nota, com o link de feedback enganoso: continua "aguardando" */
    quizList: [[SEC1, [[8201, 1], [8202, 0], [8205, 1, "feedback"]]]],
  },
  {
    ou: 50003,
    name: "Louvor e Adoração na Bíblia",
    grades: [...FORMULAS, numeric(301, "Atividade 1", 2.5), numeric(302, "Atividade 2", 2.5)],
    values: [...av(4.0, 3.0), value(301, "Atividade 1", 2.5, 2.5), value(302, "Atividade 2", 1.5, 2.5)],
    quizzes: [quiz(8301, 301, -5), quiz(8302, 302, -5), { ...quiz(8309, 9309, 10), Name: "📄 Avaliação de Recuperação" }],
    /* aprovado: a Av3 da turma não é pendência dele */
    quizList: [["Avaliação 3 (Av3) - Recuperação", [[8309, 0]]]],
  },
  {
    ou: 50004,
    name: "Produção Discursiva: Oralidade e Escrita",
    grades: [...FORMULAS, numeric(401, "Atividade única", 5)],
    values: [...av(2.5, 2.0), value(401, "Atividade única", 2.5, 5)],
    quizzes: [quiz(8401, 401, -5)],
  },
  {
    ou: 50005,
    name: "DMEM: Processos Cognitivos",
    grades: [...FORMULAS, numeric(501, "Atividade única", 5)],
    values: [...av(4.0, 0), value(501, "Atividade única", 4.0, 5)],
    quizzes: [quiz(8501, 501, -5)],
  },
  { ou: 50006, name: "Harmonia I", failStatus: 500 },
  {
    /* Sem Av1/Av2: um item só valendo 10 (caso real de Canto Coral). */
    ou: 50009,
    name: "Canto Coral",
    /* responde devagar: a barra carrega com 1 coluna (sem Av1) */
    delay: 2500,
    grades: [numeric(1901, "Envio de Relatório", 10)],
    values: [value(1901, "Envio de Relatório", 8, 10)],
    folders: [folder(7901, 1901, 60), { ...folder(7909, 9909, 70), Name: "Av3 - Envio de Relatório Final" }],
    submissions: { 7909: [] },
  },
  { ou: 50007, name: "Atividades Extensionistas I", grades: [...FORMULAS], values: av(0, 0) },
  {
    ou: 50008,
    name: "Percepção Musical I",
    grades: [...FORMULAS, numeric(801, "Atividade Relâmpago", 5)],
    values: av(0, 0),
    quizzes: [quiz(8801, 801, FIRST_CLOSE), { ...quiz(8809, 9809, 40), Name: "📄 Avaliação de Recuperação" }],
    /* o aluno abriu a Av3: aparece, mesmo sem a Av2 lançada */
    quizList: [[SEC1, [[8801, 0]]], ["Avaliação 3 (Av3) - Recuperação", [[8809, 1, "open"]]]],
  },
  {
    /* Período da Av2: fechamentos encerrados e corrigidos, Av2 aberta. */
    ou: 50010,
    name: "História da Educação",
    /* responde devagar: o resumo tem que esperar por ela */
    delay: 2500,
    grades: [...FORMULAS, numeric(1101, "Atividade Unidade I", 2.5), numeric(1102, "Atividade Unidade II", 2.5)],
    values: [...av(4.0, 0), value(1101, "Atividade Unidade I", 2.0, 2.5), value(1102, "Atividade Unidade II", 2.0, 2.5)],
    quizzes: [
      quiz(8101, 1101, -40), quiz(8102, 1102, -10), { ...quiz(8110, 9110, 5), Name: "📄 Atividade Av2" },
      { ...quiz(8111, 9111, 12), Name: "📄 Avaliação de Recuperação" },
    ],
    quizList: [[SEC1, [[8101, 1]]], [SEC2, [[8102, 1]]], ["Avaliação 2 (Av2)", [[8110, 0]]], ["Avaliação 3 (Av3) - Recuperação", [[8111, 0]]]],
  },
  {
    /* Recuperação: Av1 2,5 + Av2 2,0 = 4,5 → Av3 aberta. */
    ou: 50011,
    name: "Harmonia II",
    grades: [...FORMULAS, numeric(1201, "Atividade única", 5)],
    values: [...av(2.5, 2.0), value(1201, "Atividade única", 2.5, 5)],
    quizzes: [
      quiz(8601, 1201, -40),
      { ...quiz(8602, 9602, -15), Name: "📄 Atividade Av2" },
      { ...quiz(8603, 9603, 7), Name: "📄 Avaliação de Recuperação" },
    ],
    quizList: [[SEC1, [[8601, 1]]], ["Avaliação 2 (Av2)", [[8602, 1]]], ["Avaliação 3 (Av3) - Recuperação", [[8603, 0]]]],
  },
];

/* Só aparece na aba "Todos": não pode ser consultada antes de ficar visível. */
export const ONLY_IN_ALL = {
  ou: 50099,
  name: "Disciplina de semestre anterior",
  grades: [...FORMULAS, numeric(991, "Atividade 1", 5)],
  values: [...av(5.0, 5.0), value(991, "Atividade 1", 5, 5)],
  quizzes: [quiz(8991, 991, -100)],
};

/* Mesma estrutura da página real (ver CLAUDE.md, "Lista de questionários").
 * [quizId, usadas, estado] — estado "aberta" põe o ícone de tentativa em
 * andamento na linha; "feedback" põe o link de feedback cujo TEXTO é
 * "Tentativa em andamento" (armadilha real: aparece em questionário já
 * corrigido e não quer dizer tentativa aberta). A última linha é a legenda
 * do ícone, como na página real. */
function quizListPage(d) {
  const sections = d.quizList;
  const icon = '<img src="/d2l/img/attempt.svg" alt="Há uma tentativa em andamento" title="Há uma tentativa em andamento">';
  const rows = sections
    .map(
      ([title, qs]) =>
        `<tr class="d_gh"><th scope="col" class="d_hch d_gl">${title}</th><th scope="col" class="d_hch d_gc">Status da avaliação</th><th scope="col" class="d_hch d_gc">Tentativas</th></tr>` +
        qs
          .map(
            ([id, used, state]) =>
              `<tr><td><a href="#" onclick="GoToQuiz(${id}, true);;return false;">📄 Questionário ${id}</a>` +
              `<a href="#" title="Resumo do questionário"></a>${state === "open" ? icon : ""}<br>Disponível até 28 de setembro</td>` +
              `<td class="d_gn">${state === "feedback" ? `<label>Feedback: </label><a class="d2l-link d2l-link-inline" href="#" title="Exibir Feedback">Tentativa em andamento</a>` : "&nbsp;"}</td>` +
              `<td class="d_gn d_gc">${used} / 1</td></tr>`
          )
          .join("")
    )
    .join("");
  const legend = `<tr><td class="d_gr" colspan="5">${icon}<label> Há uma tentativa em andamento</label></td></tr>`;
  /* A página real vem com a faixa da disciplina: a barra também aparece aqui. */
  return coursePage(d, "Lista de questionários", `<table class="d2l-table d2l-grid d_gl" id="z_b">${rows}${legend}</table>`);
}

/* ---------------------------------------------------------------
 * Páginas de disciplina (qualquer rota): mesma faixa de navegação.
 *
 * Copiado da página real em 2026-09-23:
 *   nav.d2l-navigation-s (position:relative)
 *     d2l-labs-navigation
 *       … topo branco com o nome da disciplina (94px)
 *       d2l-labs-navigation-main-footer  ← faixa azul, 62px
 *         #shadow .d2l-labs-navigation-centerer (max 1230px, padding 0 30px)
 *         links no DOM normal, entre eles "Início do Curso" → /d2l/home/{ou}
 *
 * O CSS hostil imita o que o AVA aplica fora da faixa em algumas rotas
 * (botões, títulos e listas com margens próprias): o painel precisa resistir.
 * ------------------------------------------------------------- */
/* Como no AVA real: <html data-global-context> traz o id do aluno logado
   (a extensão usa na chave do cache). */
const CONTEXT = JSON.stringify({ orgUnitId: "6606", orgId: "6606", userId: "1001" });

const HOSTILE_CSS = `button{padding:11px 25px;background:#e3e9f1;border:2px solid #999;font-size:19px}
h3{margin:20px 0;font-size:24px}ul{margin:16px 0;padding-left:40px}li{margin:6px 0}`;

function coursePage(d, title, body, options = {}) {
  const ou = d.ou;
  const links = [
    [`/d2l/home/${ou}`, "Início do Curso"],
    [`/d2l/le/lessons/${ou}/units/1`, "Conteúdo"],
    [null, "Avaliações"],
    [`/d2l/lms/grades/my_grades/main.d2l?ou=${ou}`, "Notas"],
    [`/d2l/lms/news/main.d2l?ou=${ou}`, "Comunicados"],
    [`/d2l/lms/classlist/classlist.d2l?ou=${ou}`, "Lista de classe"],
  ]
    .map(([href, t]) => (href ? `<a href="${href}">${t}</a>` : `<button type="button" class="d2l-nav-dropdown">${t}</button>`))
    .join("");
  return `<!doctype html>
<html lang="pt-BR" data-global-context='${CONTEXT}'><head><meta charset="utf-8"><title>${title} - ${d.name} - Batistas</title>
<style>
body{margin:0;background:#f9fbff;font-family:Lato,sans-serif}
nav.d2l-navigation-s{position:relative;display:block}
.topo{height:94px;background:#fff;display:flex;align-items:center;padding:0 146px;font-size:26px}
d2l-labs-navigation-main-footer a,d2l-labs-navigation-main-footer .d2l-nav-dropdown{color:#fff;font:19px Lato,sans-serif;text-decoration:none;white-space:nowrap;background:none;border:0;padding:0}
.d2l-page-main{max-width:1230px;margin:0 auto;${options.app ? "height:calc(100vh - 156px);overflow:hidden;display:flex" : "padding:24px 0"}}
${HOSTILE_CSS}
</style></head>
<body><div class="d2l-body-main-wrapper">
<header><nav class="d2l-navigation-s"><d2l-labs-navigation>
<div class="topo">${d.name}</div>
<d2l-labs-navigation-main-footer>${links}</d2l-labs-navigation-main-footer>
</d2l-labs-navigation></nav></header>
<div class="d2l-page-main">${body}</div>
</div>
<script>
customElements.define("d2l-labs-navigation-main-footer", class extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: "open" }).innerHTML =
      '<style>:host{display:block;height:62px;background:rgb(0,48,84)}' +
      '.d2l-labs-navigation-centerer{box-sizing:border-box;max-width:1230px;height:100%;margin:0 auto;padding:0 30px;display:flex;align-items:center;gap:20px}</style>' +
      '<div class="d2l-labs-navigation-centerer"><slot></slot></div>';
  }
});
</script>
</body></html>`;
}

/* Página "Atividades com Anexo" (mesma estrutura da real, 2026-09-23):
 * linha de seção tr.d_ggl2 e uma linha por tarefa com ?db={id} e a coluna
 * "Status de Conclusão" ("Não Enviado" ou "1 envio, 1 arquivo"). */
function assignmentsPage(d) {
  const hidden = new Set(d.notOnPage || []);
  const section = (p) => (/\bAv\s*2\b/i.test(p.Name) ? "Avaliação 2 (Av2)" : /\bAv\s*3\b/i.test(p.Name) ? "Avaliação 3 (Av3)" : "Av1 - Primeiro Fechamento");
  let current = null;
  const rows = d.folders
    .filter((p) => !hidden.has(p.Id))
    .map((p) => {
      const hasSubmitted = ((d.submissions || {})[p.Id] || []).some((x) => x.Submissions && x.Submissions.length);
      const s = section(p);
      const headerRow = s !== current ? `<tr class="d_ggl2 d_dbo"><th colspan="4">${(current = s)}</th></tr>` : "";
      return (
        headerRow +
        `<tr><th><a href="/d2l/lms/dropbox/user/folder_submit_files.d2l?db=${p.Id}&grpid=0&isprv=0&bp=0&ou=${d.ou}">${p.Name}</a><br>Disponível até …</th>` +
        `<td>${hasSubmitted ? "1 envio, 1 arquivo" : "Não Enviado"}</td><td>- / 1 -</td><td></td></tr>`
      );
    })
    .join("");
  return coursePage(
    d,
    "Atividades",
    `<table class="d2l-table d2l-grid"><tr class="d_gh"><th>Atividade</th><th>Status de Conclusão</th><th>Pontuação</th><th>Status da avaliação</th></tr>${rows}</table>`
  );
}

function routes() {
  const api = {};
  const ok = (body) => ({ status: 200, body });
  for (const d of [...COURSES, ONLY_IN_ALL]) {
    const b = `${LE}${d.ou}/`;
    if (d.failStatus) {
      api[b + "grades/"] = { status: d.failStatus, body: { title: "erro" } };
      continue;
    }
    api[b + "grades/"] = ok(d.grades);

    api[b + "grades/values/myGradeValues/"] = ok(d.values);
    api[b + "dropbox/folders/"] = ok(d.folders || []);
    /* o atraso fica numa leitura da 1ª leva que não é o boletim: a prévia
       responde rápido e o resto demora, como no AVA real */
    const qz = ok({ Objects: d.quizzes || [], Next: null });
    api[b + "quizzes/"] = d.delay ? { ...qz, delay: d.delay } : qz;
    api[b + "content/myItems/"] = ok({ Objects: d.myItems || [], Next: null });
    if (d.toc) api[b + "content/toc"] = ok(d.toc);
    for (const [id, submissions] of Object.entries(d.submissions || {}))
      api[`${b}dropbox/folders/${id}/submissions/mysubmissions/`] = ok(submissions);
    if (d.folders && d.folders.length)
      api[`/d2l/lms/dropbox/user/folders_list.d2l?ou=${d.ou}&isprv=0`] = { status: 200, html: assignmentsPage(d) };
    /* No AVA real a página existe sempre que há questionário (e um 404 aqui
       conta como leitura incompleta, que não vai para o cache). */
    if (d.quizList || (d.quizzes && d.quizzes.length))
      api[`/d2l/lms/quizzing/user/quizzes_list.d2l?ou=${d.ou}`] = { status: 200, html: quizListPage({ ...d, quizList: d.quizList || [] }) };
  }
  /* nomes de todas as disciplinas numa leitura só */
  api["/d2l/api/lp/1.63/enrollments/myenrollments/?orgUnitTypeId=3"] = ok({
    PagingInfo: { Bookmark: "", HasMoreItems: false },
    Items: [...COURSES, ONLY_IN_ALL].map((d) => ({ OrgUnit: { Id: d.ou, Name: d.name }, Access: {}, PinDate: null })),
  });
  return api;
}

/* Trecho real do <style> do d2l-my-courses-enrollment-card. */
const CARD_STYLE = `:host{display:block;position:relative}d2l-card{height:100%;width:100%}d2l-icon{color:white}.enrollment-content-block{display:block}`;

/* O d2l-card usa adoptedStyleSheets na página real; aqui vai inline. */
const D2L_CARD_STYLE = `
:host{display:block;border:1px solid #cdd5dc;border-radius:6px;background:#fff}
.d2l-card-container{display:flex;flex-direction:column;position:relative;height:100%;box-sizing:border-box;font-family:Lato,sans-serif;font-size:19px;line-height:28px;color:#202122}
a{position:absolute;inset:-1px;z-index:1;display:block}
.d2l-card-header{height:80px;background:#e3e9f1;border-radius:6px 6px 0 0}
.d2l-card-content{padding:24px 16px}`;

function page() {
  const names = Object.fromEntries([...COURSES, ONLY_IN_ALL].map((d) => [d.ou, d.name]));
  const semester = COURSES.map((d) => d.ou);
  const all = [...semester, ONLY_IN_ALL.ou];

  return `<!doctype html>
<html lang="pt-BR" data-global-context='${CONTEXT}'><head><meta charset="utf-8"><title>Página Inicial - Batistas</title>
<script>
/* ?usuario=N simula outro aluno logado no mesmo navegador */
const userFromUrl = new URLSearchParams(location.search).get("user");
if (userFromUrl) document.documentElement.setAttribute("data-global-context",
  JSON.stringify({ ...JSON.parse(document.documentElement.getAttribute("data-global-context")), userId: userFromUrl }));
</script>
<style>body{margin:0;background:#f9fbff;font-family:Lato,sans-serif}.d2l-widget-content-padding{max-width:760px;margin:24px auto}
${HOSTILE_CSS}
#tabs button{font:inherit;padding:6px 12px;margin-right:6px}</style></head>
<body>
<div class="d2l-widget-content-padding"><d2l-my-courses-v2></d2l-my-courses-v2></div>
<script>
const NAMES = ${JSON.stringify(names)};
const PANELS = { semester: ${JSON.stringify(semester)}, all: ${JSON.stringify(all)} };

customElements.define("d2l-card", class extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: "open" }).innerHTML =
      '<style>${D2L_CARD_STYLE.replace(/\n/g, "")}</style>' +
      '<div class="d2l-card-container"><a href="' + this.getAttribute("href") + '"><span class="d2l-offscreen"></span></a>' +
      '<div class="d2l-card-link-container"><div class="d2l-card-header"><slot name="header"></slot></div>' +
      '<div class="d2l-card-badge"><slot name="badge"></slot></div>' +
      '<div class="d2l-card-content"><slot name="content"></slot></div></div>' +
      '<div class="d2l-card-actions"><slot name="actions"></slot></div></div>';
  }
});

customElements.define("d2l-my-courses-enrollment-card", class extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const shadow = this.attachShadow({ mode: "open" });
    const ou = this.id.replace("enrollment-card-", "");
    /* Como o Polymer: o conteúdo chega depois do elemento entrar na página. */
    setTimeout(() => {
      shadow.innerHTML = '<style>${CARD_STYLE}</style>' +
        /* O text do d2l-card já veio "Nome, código, semestre" e depois só
           "Fechada" (AVA real, 2026-09-23): o nome tem que vir da API. */
        '<d2l-card href="/d2l/home/' + ou + '" text="Fechada">' +
        '<div slot="header"></div>' +
        '<div slot="content" class="d2l-enrollment-card-content-flex"><div class="d2l-organization-name"></div>' +
        '<d2l-card-content-meta><div class="d2l-body-small">2026.2</div></d2l-card-content-meta></div>' +
        '<d2l-button-icon slot="actions"></d2l-button-icon></d2l-card>';
      /* Como no AVA real: o nome visível mora em outro shadow root. */
      shadow.querySelector(".d2l-organization-name").attachShadow({ mode: "open" }).textContent = NAMES[ou];
    }, 150);
  }
});

customElements.define("d2l-my-courses-card-grid-v2", class extends HTMLElement {
  set ous(list) {
    const shadow = this.shadowRoot || this.attachShadow({ mode: "open" });
    shadow.innerHTML = '<style>.grade{display:grid;grid-template-columns:repeat(3,230px);gap:18px}.grade>div>d2l-my-courses-enrollment-card{height:100%}</style><div class="grade">' +
      list.map((ou) => '<div><d2l-my-courses-enrollment-card id="enrollment-card-' + ou + '"></d2l-my-courses-enrollment-card></div>').join("") + '</div>';
  }
});

customElements.define("d2l-my-courses-content-v2", class extends HTMLElement {
  render() {
    const shadow = this.shadowRoot || this.attachShadow({ mode: "open" });
    shadow.innerHTML = "<d2l-my-courses-card-grid-v2></d2l-my-courses-card-grid-v2>";
    shadow.firstChild.ous = PANELS[this.getAttribute("panel")];
  }
});

customElements.define("d2l-my-courses-container-v2", class extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML =
      '<div id="tabs"><button data-panel="all">Todos</button><button data-panel="semester">2026.2</button></div>' +
      '<d2l-tabs>' +
      '<d2l-tab-panel id="panel-all" hidden style="display:block"><d2l-my-courses-content-v2 panel="all"></d2l-my-courses-content-v2></d2l-tab-panel>' +
      '<d2l-tab-panel id="panel-semester" style="display:block"><d2l-my-courses-content-v2 panel="semester"></d2l-my-courses-content-v2></d2l-tab-panel>' +
      '</d2l-tabs><style>d2l-tab-panel[hidden]{display:none!important}</style>';
    const open = (name) => {
      shadow.querySelectorAll("d2l-tab-panel").forEach((p) => {
        const isTarget = p.id === "panel-" + name;
        p.hidden = !isTarget;
        /* trocar de aba recria os cards, como na página real */
        if (isTarget) p.querySelector("d2l-my-courses-content-v2").render();
      });
    };
    shadow.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => open(b.dataset.panel)));
    open("semester");
  }
});

/* O widget chega depois do document_idle, como na página real. */
setTimeout(() => {
  customElements.define("d2l-my-courses-v2", class extends HTMLElement {
    connectedCallback() {
      this.attachShadow({ mode: "open" }).innerHTML = "<d2l-my-courses-container-v2></d2l-my-courses-container-v2>";
    }
  });
}, 800);
</script>
</body></html>`;
}

/* Rotas de disciplina com página própria na réplica (a Lista de questionários
   vem do mapa da API, com a mesma faixa). */
function coursePages(root) {
  const write = (path, html) => {
    mkdirSync(path.replace(/[\/][^\/]*$/, ""), { recursive: true });
    writeFileSync(path, html);
  };
  const vocal = COURSES.find((d) => d.ou === 50001);
  const choir = COURSES.find((d) => d.ou === 50009);
  const site = `${root}/site/d2l`;
  write(`${site}/home/50001.html`, coursePage(vocal, "Página Inicial", "<h2>Conteúdo</h2><p>Bem-vindo à disciplina.</p>"));
  /* Conteúdo: app com a altura presa à janela, como o real */
  write(
    `${site}/le/lessons/50001/units/1.html`,
    coursePage(vocal, "Apresentação da Disciplina", '<aside style="width:280px;border-right:1px solid #ccc">Módulos</aside><article style="flex:1;padding:24px">Aula</article>', { app: true })
  );
  write(`${site}/lms/grades/my_grades/main.d2l`, coursePage(vocal, "Notas", "<table><tr><td>Boletim</td></tr></table>"));
  write(`${site}/home/50009.html`, coursePage(choir, "Página Inicial", "<p>Canto Coral</p>"));
  for (const ou of [50010, 50011]) {
    const d = COURSES.find((x) => x.ou === ou);
    write(`${site}/home/${ou}.html`, coursePage(d, "Página Inicial", `<p>${d.name}</p>`));
  }
}

export function generateAva(root) {
  mkdirSync(`${root}/site/d2l`, { recursive: true });
  writeFileSync(`${root}/site/d2l/home.html`, page());
  coursePages(root);
  writeFileSync(`${root}/site/api.json`, JSON.stringify(routes()));
}
