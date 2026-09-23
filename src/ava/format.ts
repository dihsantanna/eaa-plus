/* Datas, números e HTML.
 *
 * Os prazos do AVA são de Brasília: tudo aqui usa Intl com
 * America/Sao_Paulo, nunca o fuso do computador do aluno. Funções que
 * dependem do relógio aceitam `now` opcional — os testes passam uma hora fixa.
 */

const TZ = "America/Sao_Paulo";

const fmtDay = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const fmtDate = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
const fmtTime = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** Data da API → ms, ou null se vazia/inválida. */
export function toTimestamp(value: string | null | undefined): number | null {
  const t = value ? Date.parse(value) : NaN;
  return Number.isNaN(t) ? null : t;
}

/** Dia de calendário em Brasília: "2026-09-28". */
export const dayOf = (t: number): string => fmtDay.format(new Date(t));

/** Dias de calendário (Brasília) entre hoje e o alvo. */
export function daysUntil(target: number, now = Date.now()): number {
  const [ay, am, ad] = dayOf(now).split("-").map(Number);
  const [by, bm, bd] = dayOf(target).split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** "28/09" */
export const formatDate = (t: number): string => fmtDate.format(new Date(t));

/** "23:59" */
export const formatTime = (t: number): string => fmtTime.format(new Date(t));

/** "encerrado" · "hoje" · "amanhã" · "5 dias" (ou "em 5 dias", com prefixo) */
export function timeLeft(t: number, prefix = false, now = Date.now()): string {
  if (t < now) return "encerrado";
  const d = daysUntil(t, now);
  if (d <= 0) return "hoje";
  if (d === 1) return "amanhã";
  return `${prefix ? "em " : ""}${d} dias`;
}

/** 0.84 → "0,8" */
export const formatNum = (n: number): string =>
  (Math.round(n * 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** plural(2, "perdida", "perdidas") → "2 perdidas" */
export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Escapa texto para entrar em HTML (conteúdo e atributos). */
export const escapeHtml = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
