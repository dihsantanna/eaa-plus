/* Cache do AVA entre páginas.
 *
 * O AVA responde "no-store" e recarrega a página inteira a cada clique,
 * então sem isto a página inicial relê as 9 disciplinas toda vez que o
 * aluno volta a ela. Regras (combinadas com o aluno em 2026-09-23):
 *   1. Validade de 10 minutos.
 *   2. Página de uma disciplina SEMPRE lê do servidor, e apaga a
 *      disciplina do cache ao entrar e ao sair: o aluno pode ter enviado
 *      algo ali. De volta à página inicial, só ela é lida de novo.
 *   3. Guarda os dados crus (enxutos por slim()), nunca o resultado: prazo
 *      vencido, "falta 2 dias" etc. são recalculados na hora (rules.ts).
 *   4. Só guarda leitura completa (course-data.ts decide).
 *   5. Chave com o id do aluno (data-global-context da página) e o
 *      formato. Sem id, sem cache.
 *
 * Onde fica: chrome.storage.session — só memória, só a extensão enxerga,
 * some ao fechar o navegador. Qualquer erro do storage = segue sem cache.
 */

import type { RawCourse, TocModule } from "./types.ts";

const TTL_MS = 10 * 60 * 1000;
const FORMAT = 2; /* 2: campos em inglês (format, user, readAt, value) */
const PREFIX = "ava:";

export interface StoredEntry<T> {
  format: number;
  user: string;
  /** quando foi lido do AVA (ms) */
  readAt: number;
  value: T;
}

/** Disciplinas desta página: não leem nem gravam no cache. */
const noStore = new Set<string>();
let warned = false;
/** Enquanto o Atualizar esvazia o cache, ninguém lê o que está lá. */
let clearing: Promise<unknown> = Promise.resolve();

/** Uma vez por página: sem cache a extensão funciona igual, só lê mais. */
function cacheUnavailable(err: unknown): void {
  if (warned) return;
  warned = true;
  console.warn("[EAA+] cache entre páginas indisponível:", err);
}

/** Toda operação passa por aqui: a área é buscada na hora (o service worker
 *  pode liberar o acesso depois que esta página carregou) e erro síncrono
 *  vira promessa rejeitada, como o assíncrono. */
async function withStorage<T>(operation: (area: chrome.storage.StorageArea) => Promise<T>): Promise<T> {
  try {
    const area = chrome.storage?.session;
    if (!area) throw new Error("chrome.storage.session não disponível aqui");
    return await operation(area);
  } catch (err) {
    cacheUnavailable(err);
    throw err;
  }
}

const ignore = (): void => {};

function currentUserId(): string | null {
  try {
    const ctx = JSON.parse(document.documentElement.getAttribute("data-global-context") ?? "{}");
    return ctx?.userId ? String(ctx.userId) : null;
  } catch {
    return null;
  }
}

/** Entrada válida, ou null (ausente, vencida, de outro aluno, formato
 *  antigo ou storage indisponível). */
export async function read<T>(key: string): Promise<StoredEntry<T> | null> {
  const me = currentUserId();
  if (!me || noStore.has(key)) return null;
  try {
    await clearing;
    const all = await withStorage((area) => area.get(PREFIX + key));
    const entry = all[PREFIX + key] as StoredEntry<T> | undefined;
    if (!entry || entry.format !== FORMAT) return null;
    /* outro aluno usou este navegador: nada do que está lá serve */
    if (entry.user !== me) {
      void forgetAll();
      return null;
    }
    const age = Date.now() - entry.readAt;
    if (!(age >= 0 && age < TTL_MS)) {
      withStorage((area) => area.remove(PREFIX + key)).catch(ignore);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

export function store<T>(key: string, value: T, readAt: number): void {
  const me = currentUserId();
  if (!me || noStore.has(key)) return;
  const entry: StoredEntry<T> = { format: FORMAT, user: me, readAt, value };
  withStorage((area) => area.set({ [PREFIX + key]: entry })).catch(ignore);
}

/** Disciplina desta página: não lê nem grava o cache dela, e apaga o que
 *  houver agora e de novo ao sair (outra aba pode ter guardado no meio). */
export function forget(ou: string | number): void {
  const key = String(ou);
  noStore.add(key);
  withStorage((area) => area.remove(PREFIX + key)).catch(ignore);
}

function forgetAll(): Promise<void> {
  return withStorage(async (area) => {
    const keys = Object.keys(await area.get(null)).filter((k) => k.startsWith(PREFIX));
    if (keys.length) await area.remove(keys);
  }).catch(ignore);
}

/** Botão Atualizar: esvazia tudo; leituras feitas enquanto isso esperam. */
export function clear(): Promise<void> {
  const done = forgetAll();
  clearing = done;
  return done;
}

/** Chamado uma vez ao carregar: a disciplina da URL (/d2l/home/{ou},
 *  /d2l/le/lessons/{ou}/…, ?ou={ou}) sai do cache agora e ao sair da
 *  página. A barra da disciplina confirma pelo link "Início do Curso". */
export function initCache(): void {
  const pageOu =
    location.search.match(/[?&]ou=(\d+)/)?.[1] ??
    location.pathname.match(/^\/d2l\/(?:home|le\/[a-z]+)\/(\d+)(?:\/|$)/)?.[1];
  if (pageOu) forget(pageOu);
  window.addEventListener("pagehide", () => noStore.forEach(forget));
}

/* ------------------------------------------------------------------
 * Só os campos que classify()/summarize() usam. O caminho sem cache passa
 * pelo MESMO corte, então dado guardado e dado fresco desenham igual — e
 * textos longos (instruções, descrições) nunca vão para o cache.
 * ---------------------------------------------------------------- */
function pick<T extends object, K extends keyof T>(o: T | null | undefined, fields: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const f of fields) if (o && o[f] !== undefined) out[f] = o[f];
  return out;
}

const slimToc = (m: TocModule): TocModule => ({
  Topics: (m.Topics ?? []).map((t) => pick(t, ["TopicId", "GradeItemId", "EndDateTime"])),
  Modules: (m.Modules ?? []).map(slimToc),
});

export function slim(b: RawCourse): RawCourse {
  return {
    gi: b.gi.map((g) => pick(g, ["Id", "Name", "GradeType", "IsHidden", "MaxPoints"])),
    values: b.values.map((v) => pick(v, ["GradeObjectIdentifier", "GradeObjectName", "PointsNumerator", "PointsDenominator"])),
    folders: b.folders.map((p) => ({
      ...pick(p, ["Id", "Name", "GradeItemId", "IsHidden", "DueDate"]),
      ...(p.Availability ? { Availability: pick(p.Availability, ["EndDate"]) } : {}),
    })),
    quizzes: b.quizzes.map((q) => pick(q, ["QuizId", "Name", "GradeItemId", "IsActive", "DueDate", "EndDate"])),
    toc: b.toc ? { Modules: (b.toc.Modules ?? []).map(slimToc) } : null,
    myItems: b.myItems.map((i) => pick(i, ["ItemId", "DateCompleted", "DueDate", "EndDate"])),
    quizList: b.quizList,
    submissions: b.submissions,
  };
}
