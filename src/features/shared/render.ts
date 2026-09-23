/* Peças de desenho usadas pelas três telas (cards, resumo e barra da
 * disciplina): nomes dos estados, legenda, barra de segmentos e prazo. */

import { formatDate, timeLeft } from "../../ava/format.ts";
import type { Activity, ActivityState, DeadlineGroup } from "../../ava/types.ts";

/** Nome de cada estado, como aparece ao lado da atividade. */
export const STATE_LABEL: Record<ActivityState, string> = {
  graded: "corrigida",
  awaiting: "aguardando correção",
  started: "iniciada e não enviada",
  missed: "prazo perdido",
  todo: "a fazer",
};

/** Sempre os cinco estados, na mesma ordem, para o aluno aprender uma vez. */
export const LEGEND: [ActivityState, string][] = [
  ["graded", "Corrigida"],
  ["awaiting", "Aguardando correção"],
  ["started", "Iniciada, não enviada"],
  ["missed", "Prazo perdido"],
  ["todo", "A fazer"],
];

/** Um segmento colorido por atividade (a cor vem da classe = estado). */
export const segments = (items: Activity[], cls = ""): string =>
  `<div class="eaa-seg${cls ? ` ${cls}` : ""}" aria-hidden="true">` +
  items.map((it) => `<i class="${it.state}"></i>`).join("") +
  `</div>`;

/** "28/09 · 5 dias" */
export const when = (g: DeadlineGroup, now = Date.now()): string =>
  g.deadline ? `${formatDate(g.deadline)} · ${timeLeft(g.deadline, false, now)}` : "sem data";
