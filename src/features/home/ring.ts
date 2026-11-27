/* Anel de progresso do painel geral do Layout Amplo: um arco por parte (atividade ou
 * disciplina), a contagem no centro. SVG gerado aqui, sem biblioteca; as
 * cores vêm das classes (summary-wide.css). */

import { escapeHtml } from "../../ava/format.ts";

export interface RingPart {
  /** Estado: é a cor do arco. */
  cls: string;
  /** Texto ao passar o mouse; vazio = sem texto. */
  title: string;
}

/** A circunferência vale 360 (pathLength): as medidas são em graus. */
const TURN = 360;
const GAP = 4;
const round = (n: number): number => Math.round(n * 100) / 100;

const circle = (cls: string, length: number, offset: number, inner = ""): string =>
  `<circle class="${cls}" cx="50" cy="50" r="43" pathLength="${TURN}" ` +
  `stroke-dasharray="${round(length)} ${round(TURN - length)}" stroke-dashoffset="${round(-offset) || 0}">${inner}</circle>`;

export function ring(parts: RingPart[], value: string, unit: string, label: string): string {
  const step = TURN / (parts.length || 1);
  const gap = parts.length > 1 ? Math.min(GAP, step / 3) : 0;
  const arcs = parts
    .map((p, i) => {
      const length = step - gap;
      const arc = circle(`eaa-r-arc ${p.cls}`, length, i * step, p.title ? `<title>${escapeHtml(p.title)}</title>` : "");
      /* estados claros: o arco é o contorno, e este miolo mais fino o preenche */
      const light = p.cls === "todo" || p.cls === "awaiting";
      return light ? arc + circle(`eaa-r-core ${p.cls}`, Math.max(length - 1.5, 0), i * step + 0.75) : arc;
    })
    .join("");
  /* sem rótulo, o anel é só enfeite: o texto ao lado já diz o mesmo */
  const a11y = label ? `role="img" aria-label="${escapeHtml(label)}"` : `aria-hidden="true"`;
  return (
    `<svg class="eaa-r-ring" viewBox="0 0 100 100" ${a11y}>` +
    `<g transform="rotate(-90 50 50)">${arcs}</g>` +
    `<text class="eaa-r-value" x="50" y="52">${escapeHtml(value)}</text>` +
    `<text class="eaa-r-unit" x="50" y="68">${escapeHtml(unit)}</text></svg>`
  );
}
