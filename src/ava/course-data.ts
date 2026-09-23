/* Dados de uma disciplina — o que as telas usam.
 *
 * Junta as três peças e expõe uma interface pequena:
 *   network.ts → busca (único arquivo com rede)
 *   cache.ts   → guarda por 10 min entre páginas
 *   rules.ts   → transforma dados crus em estados, grupos e textos
 *
 * De onde vêm os dados: boletim → o que já foi corrigido. Tarefas e
 * questionários → prazos, ligados ao boletim pelo GradeItemId. Para saber se
 * o aluno fez algo que ainda não tem nota: envios da tarefa, conclusão do
 * tópico de conteúdo (toc + myItems) e a página "Lista de questionários" —
 * a API não conta as tentativas de questionário (403) e na maioria das
 * disciplinas o questionário não é tópico de conteúdo.
 */

import * as cache from "./cache.ts";
import type { StoredEntry } from "./cache.ts";
import {
  API,
  ASSIGNMENT_LIST,
  ENROLLMENTS,
  QUIZ_LIST,
  parseAssignmentList,
  parseQuizList,
  requestJson,
  requestText,
  toList,
} from "./network.ts";
import * as rules from "./rules.ts";
import type {
  CourseSummary,
  DropboxFolder,
  Enrollments,
  GradeObject,
  GradeValue,
  ListOrPage,
  MyItem,
  MySubmission,
  Preview,
  Quiz,
  RawCourse,
  Submissions,
  Toc,
} from "./types.ts";

type Ou = string | number;

/* Memória desta página. Erros também ficam guardados aqui (nunca no cache):
   nada de tentar de novo sozinho — a varredura roda a cada segundo e uma
   disciplina com erro viraria leitura sem fim. Tenta de novo quando o aluno
   recarrega a página ou clica em Atualizar. */
let summaries = new Map<string, Promise<CourseSummary>>();
let gradebooks = new Map<string, Promise<GradeObject[]>>();
let storedByCourse = new Map<string, Promise<StoredEntry<RawCourse> | null>>();
let namesPromise: Promise<Record<string, string>> | null = null;

/** Memoiza uma Promise por chave, dentro do mapa dado. */
function once<T>(map: Map<string, Promise<T>>, key: Ou, make: () => Promise<T>): Promise<T> {
  const k = String(key);
  let p = map.get(k);
  if (!p) {
    p = make();
    map.set(k, p);
  }
  return p;
}

const storedFor = (ou: Ou) => once(storedByCourse, ou, () => cache.read<RawCourse>(String(ou)));

/** Botão Atualizar: esquece a memória desta página e o cache, para a
 *  próxima leitura de cada disciplina ir ao servidor. */
export function restart(): Promise<void> {
  summaries = new Map();
  gradebooks = new Map();
  storedByCourse = new Map();
  namesPromise = null;
  return cache.clear();
}

/** A disciplina desta página sai do cache (ver cache.ts, regra 2). */
export const forget = cache.forget;

/** O boletim é a primeira leitura da fila e já diz o formato da disciplina.
 *  preview() usa a MESMA requisição de courseData(), não faz outra — nem
 *  nenhuma, se a disciplina estiver no cache. */
const gradebook = (ou: Ou) =>
  once(gradebooks, ou, async () => (await storedFor(ou))?.value.gi ?? requestJson<GradeObject[]>(`${API}${ou}/grades/`));

export const preview = async (ou: Ou): Promise<Preview> => rules.preview(await gradebook(ou));

/** Resumo de uma disciplina: do cache, se houver; senão lê e guarda. */
export const courseData = (ou: Ou): Promise<CourseSummary> =>
  once(summaries, ou, async () => {
    const stored = await storedFor(ou);
    if (stored) return assemble(ou, stored.value, stored.readAt);
    const start = Date.now(); /* a idade conta do começo da leitura */
    const { raw, complete } = await download(ou);
    const slim = cache.slim(raw);
    if (complete) cache.store(String(ou), slim, start);
    return assemble(ou, slim, start);
  });

/** Sempre a partir dos dados crus: o relógio de agora decide o que venceu. */
function assemble(ou: Ou, raw: RawCourse, readAt: number): CourseSummary {
  return { ...rules.summarize(rules.classify(ou, raw), raw.values), readAt };
}

/** Poucas leituras, em duas levas. A 1ª é o que toda disciplina precisa:
 *  boletim, notas liberadas, tarefas e questionários. A 2ª só pede o que
 *  AQUELA disciplina exige (rules.plan decide).
 *
 *  Uma leitura que falhou vira lista vazia (a disciplina ainda aparece, com
 *  o que deu para ler), mas aí complete = false e nada vai para o cache. */
async function download(ou: Ou): Promise<{ raw: RawCourse; complete: boolean }> {
  const base = `${API}${ou}/`;
  let complete = true;
  const failed =
    <T>(value: T) =>
    (): T => {
      complete = false;
      return value;
    };

  const [gi, values, folders, quizzes] = await Promise.all([
    gradebook(ou),
    requestJson<GradeValue[]>(`${base}grades/values/myGradeValues/`),
    requestJson<ListOrPage<DropboxFolder>>(`${base}dropbox/folders/`).then(toList, failed<DropboxFolder[]>([])),
    requestJson<ListOrPage<Quiz>>(`${base}quizzes/`).then(toList, failed<Quiz[]>([])),
  ]);
  const p = rules.plan(gi ?? [], values ?? [], folders, quizzes);

  const [quizList, toc, myItems, submissions] = await Promise.all([
    p.hasQuiz ? requestText(QUIZ_LIST + ou).then(parseQuizList, failed({})) : {},
    p.unlinked ? requestJson<Toc>(`${base}content/toc`).catch(failed(null)) : null,
    p.unlinked ? requestJson<ListOrPage<MyItem>>(`${base}content/myItems/`).then(toList, failed<MyItem[]>([])) : [],
    p.toCheck.length ? checkSubmissions(ou, p.toCheck) : { submittedIds: {}, sections: {}, complete: true },
  ]);
  if (!submissions.complete) complete = false;

  return {
    complete,
    raw: {
      gi: gi ?? [],
      values: values ?? [],
      folders,
      quizzes,
      toc,
      myItems,
      quizList,
      submissions: { submittedIds: submissions.submittedIds, sections: submissions.sections },
    },
  };
}

/** Envios das tarefas: a página "Atividades com Anexo" traz o status de
 *  todas numa leitura só. Se a página falhar ou uma tarefa não aparecer
 *  nela, pergunta à API de envios só por aquela. Se essa pergunta falhar, a
 *  resposta sai com complete = false. */
async function checkSubmissions(ou: Ou, folders: DropboxFolder[]): Promise<Submissions & { complete: boolean }> {
  const page = await requestText(`${ASSIGNMENT_LIST}${ou}&isprv=0`).then(parseAssignmentList, () => ({}) as ReturnType<typeof parseAssignmentList>);
  const r: Submissions & { complete: boolean } = { submittedIds: {}, sections: {}, complete: true };

  const missing = folders.filter((p) => {
    const l = page[String(p.Id)];
    if (!l) return true;
    if (l.submitted) r.submittedIds[p.Id] = true;
    if (l.section) r.sections[p.Id] = l.section;
    return false;
  });

  await Promise.all(
    missing.map((p) =>
      requestJson<ListOrPage<MySubmission>>(`${API}${ou}/dropbox/folders/${p.Id}/submissions/mysubmissions/`).then(
        (e) => {
          if (toList(e).some((x) => x.Submissions?.length)) r.submittedIds[p.Id] = true;
        },
        () => {
          r.complete = false;
        }
      )
    )
  );
  return r;
}

/** Nome oficial das disciplinas, numa leitura só. O atributo text do card não
 *  serve: já veio "Nome, código, semestre" e depois só "Fechada". */
function names(): Promise<Record<string, string>> {
  namesPromise ??= (async () => {
    const stored = await cache.read<Record<string, string>>("names");
    if (stored) return stored.value;
    const start = Date.now();
    try {
      const m = await requestJson<Enrollments>(ENROLLMENTS);
      const byId: Record<string, string> = {};
      for (const i of m?.Items ?? []) if (i.OrgUnit) byId[i.OrgUnit.Id] = i.OrgUnit.Name;
      cache.store("names", byId, start);
      return byId;
    } catch {
      return {}; /* sem nomes: as fichas dizem "Disciplina" */
    }
  })();
  return namesPromise;
}

export const courseName = async (ou: Ou): Promise<string> => (await names())[ou] ?? "";
