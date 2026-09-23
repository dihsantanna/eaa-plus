/* Estado da página inicial, compartilhado pelos cards e pelo resumo. */

import type { CourseSummary } from "../../ava/types.ts";

export interface CourseEntry {
  summary: CourseSummary;
  name: string;
}

export class HomeState {
  /** Sobe a cada Atualizar: resposta que chega de uma geração antiga é
   *  descartada, e bloco de geração antiga é lido de novo. */
  generation = 0;
  /** Disciplinas com resumo pronto (as que o painel geral soma). */
  readonly ready = new Map<string, CourseEntry>();
  /** Disciplinas que já responderam — com dado ou com erro. */
  readonly resolved = new Set<string>();
  /** Sem atividade ou com erro: não volta a montar o bloco a cada varredura
   *  (evita piscar "Carregando…" e ler de novo). */
  readonly noBlock = new Set<string>();
  /** Quando começou a espera do painel geral (null = nada pendente). */
  loadStart: number | null = null;

  reset(): void {
    this.generation++;
    this.ready.clear();
    this.resolved.clear();
    this.noBlock.clear();
    this.loadStart = null;
  }
}
