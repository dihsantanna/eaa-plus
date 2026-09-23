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

const DIA = 86400000;
const iso = (dias) => new Date(Date.now() + dias * DIA).toISOString();
const LE = "/d2l/api/le/1.99/";

/* Os dois fechamentos da Av1, como no curso de Música: um que vence daqui a
   2 horas (hoje ou amanhã, conforme o relógio) e outro daqui a 30 dias. */
const PRIMEIRO = new Date(Date.now() + 2 * 3600000).toISOString();
const ULTIMO = iso(30);
const SEC1 = "Avaliação 1 (Av1) - Primeiro Fechamento";
const SEC2 = "Avaliação 1 (Av1) - Último Fechamento";

const formula = (Id, Name) => ({ Id, Name, GradeType: "Formula", CategoryId: 1, IsHidden: false });
const numerico = (Id, Name, MaxPoints) => ({ Id, Name, GradeType: "Numeric", MaxPoints, CategoryId: 2, IsHidden: false });
const valor = (Id, Name, PointsNumerator, PointsDenominator) => ({
  GradeObjectIdentifier: String(Id),
  GradeObjectName: Name,
  GradeObjectType: Name.startsWith("Nota") ? 6 : 1,
  PointsNumerator,
  PointsDenominator,
  DisplayedGrade: "Avaliação 1",
});
const quiz = (QuizId, GradeItemId, fim) => ({
  QuizId, GradeItemId, IsActive: true, Name: `Questionário ${QuizId}`, StartDate: null, DueDate: null,
  EndDate: typeof fim === "number" ? iso(fim) : fim,
});
const pasta = (Id, GradeItemId, fim) => ({
  Id, GradeItemId, IsHidden: false, Name: `Tarefa ${Id}`, DueDate: null,
  Availability: { StartDate: null, EndDate: typeof fim === "number" ? iso(fim) : fim },
});
const av = (n1, n2) => [valor(900, "Nota AV1", n1, 5), valor(901, "Nota AV2", n2, 5)];
const FORMULAS = [formula(900, "Nota AV1"), formula(901, "Nota AV2")];

/* Uma entrada por disciplina; cada chave vira uma rota.
   listaQ = seções da página "Lista de questionários": [título, [[quizId, tentativas usadas, em andamento?]]] */
export const DISCIPLINAS = [
  {
    /* O caso típico: Av1 em dois fechamentos. */
    ou: 50001,
    nome: "Técnica Vocal I",
    grades: [
      ...FORMULAS,
      numerico(101, "Atividade I.I", 0.84), numerico(102, "Atividade I.II", 0.83), numerico(105, "Atividade I.III", 0.83),
      numerico(103, "Atividade II.I", 1.25), numerico(104, "Atividade II.II", 1.25),
    ],
    valores: [...av(0.8, 0), valor(101, "Atividade I.I", 0.8, 0.84)],
    quizzes: [quiz(8001, 101, PRIMEIRO), quiz(8005, 105, PRIMEIRO), quiz(8003, 103, ULTIMO), quiz(8004, 104, ULTIMO)],
    pastas: [pasta(7001, 102, PRIMEIRO)],
    envios: { 7001: [{ Status: 1, Submissions: [{ Id: 1 }] }] },
    listaQ: [
      /* 8001 corrigido, com o link de feedback enganoso */
      [SEC1, [[8001, 1, "feedback"], [8005, 0]]],
      /* 8003: "1 / 1" igual a um enviado — só o ícone diz que está aberto */
      [SEC2, [[8003, 1, "aberta"], [8004, 0]]],
      ["Avaliação 2 (Av2)", [[8099, 0]]],
    ],
  },
  {
    /* Prazo único, já vencido: cada jeito de saber que foi entregue. */
    ou: 50002,
    nome: "Leitura e Escrita de Partitura I",
    grades: [
      ...FORMULAS,
      numerico(201, "Atividade 1", 1), numerico(202, "Atividade 2", 1), numerico(203, "Atividade 3", 1),
      numerico(204, "Atividade 4", 1), numerico(205, "Atividade 5", 1),
    ],
    valores: [...av(0.9, 0), valor(201, "Atividade 1", 0.9, 1)],
    quizzes: [quiz(8201, 201, -1), quiz(8202, 202, -1), quiz(8203, 203, -1), quiz(8205, 205, -1)],
    pastas: [pasta(7204, 204, -1)],
    envios: { 7204: [{ Status: 1, Submissions: [{ Id: 1 }] }] },
    /* 203: questionário que é tópico de conteúdo e foi concluído */
    toc: { Modules: [{ Topics: [{ TopicId: 9203, GradeItemId: 203 }], Modules: [{ Topics: [{ TopicId: 9202, GradeItemId: 202 }], Modules: [] }] }] },
    meusItens: [{ ItemId: 9203, DateCompleted: iso(-1) }, { ItemId: 9202, DateCompleted: null }],
    /* 205: só a Lista de questionários sabe (caso real da DMEM) */
    /* 8205 enviado e sem nota, com o link de feedback enganoso: continua "aguardando" */
    listaQ: [[SEC1, [[8201, 1], [8202, 0], [8205, 1, "feedback"]]]],
  },
  {
    ou: 50003,
    nome: "Louvor e Adoração na Bíblia",
    grades: [...FORMULAS, numerico(301, "Atividade 1", 2.5), numerico(302, "Atividade 2", 2.5)],
    valores: [...av(4.0, 3.0), valor(301, "Atividade 1", 2.5, 2.5), valor(302, "Atividade 2", 1.5, 2.5)],
    quizzes: [quiz(8301, 301, -5), quiz(8302, 302, -5)],
  },
  {
    ou: 50004,
    nome: "Produção Discursiva: Oralidade e Escrita",
    grades: [...FORMULAS, numerico(401, "Atividade única", 5)],
    valores: [...av(2.5, 2.0), valor(401, "Atividade única", 2.5, 5)],
    quizzes: [quiz(8401, 401, -5)],
  },
  {
    ou: 50005,
    nome: "DMEM: Processos Cognitivos",
    grades: [...FORMULAS, numerico(501, "Atividade única", 5)],
    valores: [...av(4.0, 0), valor(501, "Atividade única", 4.0, 5)],
    quizzes: [quiz(8501, 501, -5)],
  },
  { ou: 50006, nome: "Harmonia I", falha: 500 },
  {
    /* Sem Av1/Av2: um item só valendo 10 (caso real de Canto Coral). */
    ou: 50009,
    nome: "Canto Coral",
    grades: [numerico(1901, "Envio de Relatório", 10)],
    valores: [valor(1901, "Envio de Relatório", 8, 10)],
    pastas: [pasta(7901, 1901, 60)],
  },
  { ou: 50007, nome: "Atividades Extensionistas I", grades: [...FORMULAS], valores: av(0, 0) },
  {
    ou: 50008,
    nome: "Percepção Musical I",
    grades: [...FORMULAS, numerico(801, "Atividade Relâmpago", 5)],
    valores: av(0, 0),
    quizzes: [quiz(8801, 801, PRIMEIRO)],
    listaQ: [[SEC1, [[8801, 0]]]],
  },
];

/* Só aparece na aba "Todos": não pode ser consultada antes de ficar visível. */
export const SO_EM_TODOS = {
  ou: 50099,
  nome: "Disciplina de semestre anterior",
  grades: [...FORMULAS, numerico(991, "Atividade 1", 5)],
  valores: [...av(5.0, 5.0), valor(991, "Atividade 1", 5, 5)],
  quizzes: [quiz(8991, 991, -100)],
};

/* Mesma estrutura da página real (ver CLAUDE.md, "Lista de questionários").
 * [quizId, usadas, estado] — estado "aberta" põe o ícone de tentativa em
 * andamento na linha; "feedback" põe o link de feedback cujo TEXTO é
 * "Tentativa em andamento" (armadilha real: aparece em questionário já
 * corrigido e não quer dizer tentativa aberta). A última linha é a legenda
 * do ícone, como na página real. */
function paginaListaQ(secoes) {
  const icone = '<img src="/d2l/img/attempt.svg" alt="Há uma tentativa em andamento" title="Há uma tentativa em andamento">';
  const linhas = secoes
    .map(
      ([titulo, qs]) =>
        `<tr class="d_gh"><th scope="col" class="d_hch d_gl">${titulo}</th><th scope="col" class="d_hch d_gc">Status da avaliação</th><th scope="col" class="d_hch d_gc">Tentativas</th></tr>` +
        qs
          .map(
            ([id, usadas, estado]) =>
              `<tr><td><a href="#" onclick="GoToQuiz(${id}, true);;return false;">📄 Questionário ${id}</a>` +
              `<a href="#" title="Resumo do questionário"></a>${estado === "aberta" ? icone : ""}<br>Disponível até 28 de setembro</td>` +
              `<td class="d_gn">${estado === "feedback" ? `<label>Feedback: </label><a class="d2l-link d2l-link-inline" href="#" title="Exibir Feedback">Tentativa em andamento</a>` : "&nbsp;"}</td>` +
              `<td class="d_gn d_gc">${usadas} / 1</td></tr>`
          )
          .join("")
    )
    .join("");
  const legenda = `<tr><td class="d_gr" colspan="5">${icone}<label> Há uma tentativa em andamento</label></td></tr>`;
  return `<!doctype html><html><head><title>Lista de questionários</title></head><body><table class="d2l-table d2l-grid d_gl" id="z_b">${linhas}${legenda}</table></body></html>`;
}

function rotas() {
  const api = {};
  const ok = (corpo) => ({ status: 200, corpo });
  for (const d of [...DISCIPLINAS, SO_EM_TODOS]) {
    const b = `${LE}${d.ou}/`;
    if (d.falha) {
      api[b + "grades/"] = { status: d.falha, corpo: { title: "erro" } };
      continue;
    }
    api[b + "grades/"] = ok(d.grades);
    api[b + "grades/values/myGradeValues/"] = ok(d.valores);
    api[b + "dropbox/folders/"] = ok(d.pastas || []);
    api[b + "quizzes/"] = ok({ Objects: d.quizzes || [], Next: null });
    api[b + "content/myItems/"] = ok({ Objects: d.meusItens || [], Next: null });
    if (d.toc) api[b + "content/toc"] = ok(d.toc);
    for (const [id, envios] of Object.entries(d.envios || {}))
      api[`${b}dropbox/folders/${id}/submissions/mysubmissions/`] = ok(envios);
    if (d.listaQ)
      api[`/d2l/lms/quizzing/user/quizzes_list.d2l?ou=${d.ou}`] = { status: 200, html: paginaListaQ(d.listaQ) };
  }
  return api;
}

/* Trecho real do <style> do d2l-my-courses-enrollment-card. */
const ESTILO_CARD = `:host{display:block;position:relative}d2l-card{height:100%;width:100%}d2l-icon{color:white}.enrollment-content-block{display:block}`;

/* O d2l-card usa adoptedStyleSheets na página real; aqui vai inline. */
const ESTILO_D2L_CARD = `
:host{display:block;border:1px solid #cdd5dc;border-radius:6px;background:#fff}
.d2l-card-container{display:flex;flex-direction:column;position:relative;height:100%;box-sizing:border-box;font-family:Lato,sans-serif;font-size:19px;line-height:28px;color:#202122}
a{position:absolute;inset:-1px;z-index:1;display:block}
.d2l-card-header{height:80px;background:#e3e9f1;border-radius:6px 6px 0 0}
.d2l-card-content{padding:24px 16px}`;

function pagina() {
  const nomes = Object.fromEntries([...DISCIPLINAS, SO_EM_TODOS].map((d) => [d.ou, d.nome]));
  const semestre = DISCIPLINAS.map((d) => d.ou);
  const todos = [...semestre, SO_EM_TODOS.ou];

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Página Inicial - Batistas</title>
<style>body{margin:0;background:#f9fbff;font-family:Lato,sans-serif}.d2l-widget-content-padding{max-width:760px;margin:24px auto}
#abas button{font:inherit;padding:6px 12px;margin-right:6px}</style></head>
<body>
<div class="d2l-widget-content-padding"><d2l-my-courses-v2></d2l-my-courses-v2></div>
<script>
const NOMES = ${JSON.stringify(nomes)};
const PAINEIS = { semestre: ${JSON.stringify(semestre)}, todos: ${JSON.stringify(todos)} };

customElements.define("d2l-card", class extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: "open" }).innerHTML =
      '<style>${ESTILO_D2L_CARD.replace(/\n/g, "")}</style>' +
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
    const sombra = this.attachShadow({ mode: "open" });
    const ou = this.id.replace("enrollment-card-", "");
    /* Como o Polymer: o conteúdo chega depois do elemento entrar na página. */
    setTimeout(() => {
      sombra.innerHTML = '<style>${ESTILO_CARD}</style>' +
        '<d2l-card href="/d2l/home/' + ou + '" text="' + NOMES[ou] + ', Mus_EAD_' + ou + '_2026_2_275, 2026.2">' +
        '<div slot="header"></div>' +
        '<div slot="content" class="d2l-enrollment-card-content-flex"><div class="d2l-organization-name"></div>' +
        '<d2l-card-content-meta><div class="d2l-body-small">2026.2</div></d2l-card-content-meta></div>' +
        '<d2l-button-icon slot="actions"></d2l-button-icon></d2l-card>';
      /* Como no AVA real: o nome visível mora em outro shadow root. */
      sombra.querySelector(".d2l-organization-name").attachShadow({ mode: "open" }).textContent = NOMES[ou];
    }, 150);
  }
});

customElements.define("d2l-my-courses-card-grid-v2", class extends HTMLElement {
  set ous(lista) {
    const sombra = this.shadowRoot || this.attachShadow({ mode: "open" });
    sombra.innerHTML = '<style>.grade{display:grid;grid-template-columns:repeat(3,230px);gap:18px}.grade>div>d2l-my-courses-enrollment-card{height:100%}</style><div class="grade">' +
      lista.map((ou) => '<div><d2l-my-courses-enrollment-card id="enrollment-card-' + ou + '"></d2l-my-courses-enrollment-card></div>').join("") + '</div>';
  }
});

customElements.define("d2l-my-courses-content-v2", class extends HTMLElement {
  renderizar() {
    const sombra = this.shadowRoot || this.attachShadow({ mode: "open" });
    sombra.innerHTML = "<d2l-my-courses-card-grid-v2></d2l-my-courses-card-grid-v2>";
    sombra.firstChild.ous = PAINEIS[this.getAttribute("painel")];
  }
});

customElements.define("d2l-my-courses-container-v2", class extends HTMLElement {
  connectedCallback() {
    const sombra = this.attachShadow({ mode: "open" });
    sombra.innerHTML =
      '<div id="abas"><button data-painel="todos">Todos</button><button data-painel="semestre">2026.2</button></div>' +
      '<d2l-tabs>' +
      '<d2l-tab-panel id="panel-todos" hidden style="display:block"><d2l-my-courses-content-v2 painel="todos"></d2l-my-courses-content-v2></d2l-tab-panel>' +
      '<d2l-tab-panel id="panel-semestre" style="display:block"><d2l-my-courses-content-v2 painel="semestre"></d2l-my-courses-content-v2></d2l-tab-panel>' +
      '</d2l-tabs><style>d2l-tab-panel[hidden]{display:none!important}</style>';
    const abrir = (nome) => {
      sombra.querySelectorAll("d2l-tab-panel").forEach((p) => {
        const alvo = p.id === "panel-" + nome;
        p.hidden = !alvo;
        /* trocar de aba recria os cards, como na página real */
        if (alvo) p.querySelector("d2l-my-courses-content-v2").renderizar();
      });
    };
    sombra.querySelectorAll("#abas button").forEach((b) => b.addEventListener("click", () => abrir(b.dataset.painel)));
    abrir("semestre");
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

export function gerarAva(raiz) {
  mkdirSync(`${raiz}/site/d2l`, { recursive: true });
  writeFileSync(`${raiz}/site/d2l/home.html`, pagina());
  writeFileSync(`${raiz}/site/api.json`, JSON.stringify(rotas()));
}
