/* Tipos dos dados que a extensão lê do AVA e dos que ela produz.
 *
 * Da API da D2L (Valence, le 1.99 / lp 1.63) só entram os campos usados —
 * são também os únicos que o cache guarda (ver slim() em cache.ts).
 */

/* ------------------------------------------------------------------
 * API da D2L
 * ---------------------------------------------------------------- */

/** Item do boletim: `Numeric` = atividade; `Formula` = "Nota AV1"/"Nota AV2". */
export interface GradeObject {
  Id: number;
  Name: string;
  GradeType: string;
  IsHidden?: boolean;
  MaxPoints?: number;
}

/** Nota já liberada ao aluno. Liga ao boletim por GradeObjectIdentifier (string). */
export interface GradeValue {
  GradeObjectIdentifier: string;
  GradeObjectName: string;
  PointsNumerator: number | null;
  PointsDenominator?: number | null;
}

/** Tarefa (pasta de envio). Prazo = DueDate ou Availability.EndDate. */
export interface DropboxFolder {
  Id: number;
  Name: string;
  GradeItemId?: number | null;
  IsHidden?: boolean;
  DueDate?: string | null;
  Availability?: { EndDate?: string | null } | null;
}

/** Questionário. Prazo = DueDate ou EndDate. */
export interface Quiz {
  QuizId: number;
  Name: string;
  GradeItemId?: number | null;
  IsActive?: boolean;
  DueDate?: string | null;
  EndDate?: string | null;
}

export interface TocTopic {
  TopicId: number;
  GradeItemId?: number | null;
  EndDateTime?: string | null;
}

export interface TocModule {
  Topics?: TocTopic[];
  Modules?: TocModule[];
}

/** Sumário do conteúdo da disciplina (módulos e tópicos, em árvore). */
export interface Toc {
  Modules?: TocModule[];
}

/** Estado do aluno num tópico de conteúdo: DateCompleted = feito. */
export interface MyItem {
  ItemId: number;
  DateCompleted?: string | null;
  DueDate?: string | null;
  EndDate?: string | null;
}

/** A API ora devolve uma lista, ora { Objects: [...] } (paginado). */
export type ListOrPage<T> = T[] | { Objects?: T[] };

export interface Enrollments {
  Items?: { OrgUnit?: { Id: number; Name: string } }[];
}

export interface MySubmission {
  Submissions?: unknown[];
}

/* ------------------------------------------------------------------
 * Páginas HTML do AVA (lidas com DOMParser)
 * ---------------------------------------------------------------- */

/** Uma linha da "Lista de questionários". */
export interface QuizListEntry {
  /** seção, ex.: "Avaliação 1 (Av1) - Primeiro Fechamento" */
  section: string;
  /** tentativas usadas ("1 / 1" → 1) */
  used: number;
  /** tentativa aberta (ícone na linha) */
  inProgress: boolean;
}

/** Uma linha da página "Atividades com Anexo". */
export interface AssignmentListEntry {
  section: string;
  submitted: boolean;
}

/** Por id (QuizId ou id da pasta), como string. */
export type ById<T> = Record<string, T>;

export interface Submissions {
  submittedIds: ById<boolean>;
  sections: ById<string>;
}

/* ------------------------------------------------------------------
 * Dados crus de uma disciplina — o que a leitura junta e o cache guarda
 * ---------------------------------------------------------------- */
export interface RawCourse {
  gi: GradeObject[];
  values: GradeValue[];
  folders: DropboxFolder[];
  quizzes: Quiz[];
  toc: Toc | null;
  myItems: MyItem[];
  quizList: ById<QuizListEntry>;
  submissions: Submissions;
}

/* ------------------------------------------------------------------
 * Resultado das regras — o que as telas desenham
 * ---------------------------------------------------------------- */
export type ActivityState = "graded" | "awaiting" | "started" | "missed" | "todo";

export type AvNumber = 1 | 2 | 3;

export interface Activity {
  name: string;
  /** pontos que vale (0 para Av2/Av3, cuja nota é oculta) */
  max: number;
  av: AvNumber;
  points: number | null;
  /** prazo em ms (epoch) */
  deadline: number | null;
  assignment: number | null;
  link: string;
  section: string;
  submitted: boolean;
  inProgress: boolean;
  /** null até summarize() decidir */
  state: ActivityState | null;
}

/** Contagem por estado de um conjunto de atividades. */
export interface Tally extends Record<ActivityState, number> {
  items: Activity[];
  /** corrigidas + aguardando */
  delivered: number;
  /** a fazer + iniciadas */
  pending: number;
}

/** Atividades de um mesmo prazo (um fechamento da Av1, a Av2 ou a Av3). */
export interface DeadlineGroup {
  /** "2026-09-28", "av2", "av3" ou "none" */
  day: string;
  av: AvNumber;
  deadline: number | null;
  items: Activity[];
  section: string;
  /** o nome veio da seção do AVA (e não de um genérico "Prazo") */
  named: boolean;
  /** "1º Fechamento" */
  shortLabel: string;
  /** "Av1 · Primeiro Fechamento" */
  longLabel: string;
  c: Tally;
}

export interface CourseSummary {
  /** soma do que as atividades valem */
  total: number;
  /** soma dos pontos já corrigidos */
  ok: number;
  av1: number;
  av1Max: number;
  av2: number | null;
  av3: number | null;
  /** tem "Nota AV1" (a regra do manual se aplica) */
  hasAv: boolean;
  /** "Av1" ou "Nota" */
  label: string;
  deadlines: DeadlineGroup[];
  c: Tally;
  /** só as atividades da Av1 */
  c1: Tally;
  /** quando os dados foram lidos do AVA (ms) */
  readAt?: number;
}

export interface Preview {
  hasAv: boolean;
  label: string;
  columns: 1 | 2;
}

/** Tom visual de uma mensagem: vira classe CSS. */
export type Tone = "" | "passed" | "recovery" | "failed" | ActivityState;

export interface Message {
  tone: Tone;
  text: string;
}
