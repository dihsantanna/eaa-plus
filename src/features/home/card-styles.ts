/* CSS do bloco dentro de cada card. Vai num <style> dentro do shadow DOM do
 * card (o CSS do manifest não atravessa shadow root). As cores são as
 * variáveis do tema (styles/theme.css), que são herdadas através do shadow
 * DOM. Grade de 4px; toda linha é "rótulo | valor" com as mesmas margens.
 * O bloco fica logo abaixo do título, separado por um divisor; --eaa-shift
 * (alignBlocks) desce os de título curto até a altura dos vizinhos. */

export const CARD_CSS = `
.eaa-prog{margin-top:calc(12px + var(--eaa-shift,0px));padding-top:12px;border-top:1px solid var(--eaa-track);font:400 12px/16px Lato,'Lucida Sans Unicode',sans-serif;color:var(--eaa-text);display:grid;gap:8px}
.eaa-prog *{box-sizing:border-box;margin:0;padding:0}
.eaa-pair{display:flex;justify-content:space-between;align-items:baseline;gap:8px;min-width:0}
.eaa-pair>:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.eaa-pair>:last-child{flex:none;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.eaa-head{font-weight:700;color:var(--eaa-ink)}
.eaa-head>:last-child{font-size:13px}
.eaa-head>.none{font-size:12px;font-weight:400;color:var(--eaa-muted)}
.eaa-deadline{display:grid;gap:4px}
.eaa-deadline .eaa-name{font-weight:700;color:var(--eaa-ink)}
.eaa-deadline.urgent .eaa-when{color:var(--eaa-missed);font-weight:700}
.eaa-deadline.settled .eaa-name{font-weight:400;color:var(--eaa-text)}
.eaa-seg{display:flex;gap:2px;height:6px}
.eaa-seg i{position:relative;flex:1 1 0;border-radius:3px;background:var(--eaa-track)}
.eaa-seg i::after{content:"";position:absolute;inset:-5px -1px}
.eaa-seg .graded{background:var(--eaa-graded)}
.eaa-seg .awaiting{background:var(--eaa-awaiting);box-shadow:inset 0 0 0 1px var(--eaa-awaiting-edge)}
.eaa-seg .todo{box-shadow:inset 0 0 0 1px var(--eaa-todo-edge)}
.eaa-seg .started{background:var(--eaa-started)}
.eaa-seg .missed{background:var(--eaa-missed)}
.eaa-caption{color:var(--eaa-muted)}
.eaa-tag{font-weight:700}
.eaa-tag.graded{color:var(--eaa-graded-text)}
.eaa-tag.awaiting{color:var(--eaa-awaiting-text)}
.eaa-tag.started{color:var(--eaa-started-text)}
.eaa-tag.missed{color:var(--eaa-missed)}
.eaa-standing{height:24px;line-height:24px;border-radius:4px;text-align:center;font-weight:700;background:var(--eaa-neutral-bg);color:var(--eaa-ink)}
.eaa-standing.passed{background:var(--eaa-passed-bg);color:var(--eaa-graded-text)}
.eaa-standing.recovery{background:var(--eaa-recovery-bg);color:var(--eaa-awaiting-text)}
.eaa-standing.failed{background:var(--eaa-failed-bg);color:var(--eaa-failed-text)}
.eaa-loading{color:var(--eaa-muted);font-style:italic}
`;
