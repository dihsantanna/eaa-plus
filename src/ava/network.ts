/* Rede do AVA.
 *
 * O ÚNICO arquivo com acesso à rede (check-manifest.mjs cobra). Só GET, só
 * caminhos do próprio AVA (sameOrigin recusa qualquer outro endereço), com a
 * sessão do aluno. Nada é enviado para fora.
 *
 * Também lê as duas páginas HTML do AVA que a API não substitui (Lista de
 * questionários e Atividades com Anexo), com DOMParser — que monta o HTML
 * como documento inerte, sem executar nada.
 */

import type { AssignmentListEntry, ById, ListOrPage, QuizListEntry } from "./types.ts";

export const API = "/d2l/api/le/1.99/";
export const QUIZ_LIST = "/d2l/lms/quizzing/user/quizzes_list.d2l?ou=";
export const ASSIGNMENT_LIST = "/d2l/lms/dropbox/user/folders_list.d2l?ou=";
export const ENROLLMENTS = "/d2l/api/lp/1.63/enrollments/myenrollments/?orgUnitTypeId=3";

/** No máximo tantos pedidos ao mesmo tempo; o resto espera na fila. */
const PARALLEL = 4;

const queue: (() => void)[] = [];
let active = 0;

function sameOrigin(path: string): string {
  /* "/x" resolve no domínio da página; "//x" ou "https:" sairiam dele. */
  if (!/^\/(?!\/)/.test(path)) throw new Error(`caminho fora do AVA: ${path}`);
  return path;
}

function pump(): void {
  while (active < PARALLEL && queue.length) queue.shift()?.();
}

/** GET no próprio AVA, com a sessão do aluno, respeitando a fila. */
function enqueue<T>(path: string, read: (r: Response) => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      active++;
      fetch(sameOrigin(path), { credentials: "same-origin" })
        .then((r) => {
          if (!r.ok) throw new Error(`${path} respondeu ${r.status}`);
          return read(r);
        })
        .then(resolve, reject)
        .finally(() => {
          active--;
          pump();
        });
    });
    pump();
  });
}

/** Resposta JSON da API. */
export const requestJson = <T>(path: string): Promise<T> => enqueue(path, (r) => r.json() as Promise<T>);

/** Página HTML do AVA (para ler com parseQuizList/parseAssignmentList). */
export const requestText = (path: string): Promise<string> => enqueue(path, (r) => r.text());

/** A API ora devolve uma lista, ora { Objects: [...] } (paginado). */
export const toList = <T>(o: ListOrPage<T> | null | undefined): T[] =>
  Array.isArray(o) ? o : (o?.Objects ?? []);

const cleanText = (el: Element): string => (el.textContent ?? "").replace(/\s+/g, " ").trim();

const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html");

/** Página "Atividades com Anexo": tabela com linhas de seção
 *  (tr.d_ggl2, "Av1 - Primeiro Fechamento") e uma linha por tarefa, com o
 *  link ?db={id} e a coluna "Status de Conclusão" ("Não Enviado" /
 *  "1 envio, 2 arquivos" — conferido contra a API em 15 tarefas reais). */
export function parseAssignmentList(html: string): ById<AssignmentListEntry> {
  const byId: ById<AssignmentListEntry> = {};
  let section = "";
  for (const tr of parse(html).querySelectorAll("table tr")) {
    if (tr.classList.contains("d_ggl2")) {
      section = cleanText(tr);
      continue;
    }
    const db = [...tr.querySelectorAll("a[href]")]
      .map((a) => a.getAttribute("href")?.match(/[?&]db=(\d+)/)?.[1])
      .find(Boolean);
    if (!db || tr.children.length < 2) continue;
    byId[db] = { section, submitted: /\d+\s*envio/i.test(cleanText(tr.children[1])) };
  }
  return byId;
}

/** Página "Lista de questionários": uma tabela com uma seção por grupo de
 *  avaliação ("Avaliação 1 (Av1) - Primeiro Fechamento") e, em cada linha,
 *  o link GoToQuiz(id), o status e as tentativas "usadas / permitidas".
 *  É a única fonte de "fiz o questionário": a API de tentativas dá 403. */
export function parseQuizList(html: string): ById<QuizListEntry> {
  const byId: ById<QuizListEntry> = {};
  let section = "";
  for (const tr of parse(html).querySelectorAll("table.d2l-table tr")) {
    const cells = tr.children;
    if (!cells.length) continue;
    if (tr.classList.contains("d_gh")) {
      section = cleanText(cells[0]);
      continue;
    }
    const id = tr.querySelector("[onclick*='GoToQuiz(']")?.getAttribute("onclick")?.match(/GoToQuiz\((\d+)/)?.[1];
    if (!id) continue;
    const used = cleanText(cells[cells.length - 1]).match(/^(\d+)\s*\//)?.[1];
    byId[id] = {
      section,
      used: used ? Number.parseInt(used, 10) : 0,
      /* A tentativa aberta é marcada por um ícone na própria linha. O
         texto "Tentativa em andamento" da coluna de status NÃO serve: é só
         o nome do link de feedback em questionários já corrigidos. */
      inProgress: !!tr.querySelector("img[alt*='em andamento' i]"),
    };
  }
  return byId;
}
