/* Gera a página pública da política de privacidade a partir de
 * POLITICA-DE-PRIVACIDADE.md (fonte única do texto).
 *
 *   npm run politica   → .politica/eaa-plus-privacidade/index.html
 *
 * Publicada na Vercel (projeto eaa-plus-privacidade). Para atualizar:
 *   npm run politica && npx vercel deploy .politica/eaa-plus-privacidade --prod
 * A pasta guarda o .vercel/ do projeto, por isso só o index.html é reescrito.
 *
 * Converte só o Markdown que a política usa: # e ##, parágrafos, listas
 * "- " e "1. " (com linhas de continuação), **negrito**, *itálico*, `código`
 * e <e-mail>/<https://…>. Nada externo: sem script, sem fonte da web.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SAIDA = ".politica/eaa-plus-privacidade";
const md = readFileSync("POLITICA-DE-PRIVACIDADE.md", "utf8").replace(/\r\n/g, "\n");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(texto) {
  const codigos = [];
  let s = esc(texto).replace(/`([^`]+)`/g, (_, c) => `\u0000${codigos.push(c) - 1}\u0000`);
  s = s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/&lt;([^\s&@]+@[^\s&]+)&gt;/g, '<a href="mailto:$1">$1</a>')
    .replace(/&lt;(https:\/\/[^\s&]+)&gt;/g, '<a href="$1">$1</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codigos[i]}</code>`);
}

function lista(linhas, ordenada) {
  const marca = ordenada ? /^\d+\.\s+/ : /^-\s+/;
  const itens = [];
  for (const l of linhas) {
    if (marca.test(l)) itens.push(l.replace(marca, ""));
    else itens[itens.length - 1] += " " + l.trim();
  }
  const tag = ordenada ? "ol" : "ul";
  return `<${tag}>${itens.map((i) => `<li>${inline(i)}</li>`).join("")}</${tag}>`;
}

let titulo = "Política de privacidade";
const corpo = md
  .split(/\n\s*\n/)
  .map((b) => b.trim())
  .filter(Boolean)
  .map((bloco) => {
    const linhas = bloco.split("\n");
    if (bloco.startsWith("# ")) {
      titulo = bloco.slice(2).trim();
      return `<h1>${inline(titulo)}</h1>`;
    }
    if (bloco.startsWith("## ")) return `<h2>${inline(bloco.slice(3).trim())}</h2>`;
    if (/^-\s/.test(linhas[0])) return lista(linhas, false);
    if (/^\d+\.\s/.test(linhas[0])) return lista(linhas, true);
    return `<p>${inline(linhas.map((l) => l.trim()).join(" "))}</p>`;
  })
  .join("\n");

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(titulo)}</title>
<meta name="description" content="O que a extensão EAA+ faz com os dados do aluno: nada sai do navegador.">
<style>
:root{--fundo:#fbfaf7;--texto:#23201c;--suave:#5f5a52;--linha:#e4dfd6;--destaque:#7a1f2b;--codigo:#f1ede5}
@media (prefers-color-scheme:dark){:root{--fundo:#171513;--texto:#ece7df;--suave:#aaa296;--linha:#34302b;--destaque:#e59aa4;--codigo:#25221e}}
*{box-sizing:border-box}
body{margin:0;background:var(--fundo);color:var(--texto);font:17px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:680px;margin:0 auto;padding:48px 20px 64px}
h1{font-size:30px;line-height:1.2;margin:0 0 8px;letter-spacing:-.01em}
h1+p{color:var(--suave);font-size:15px;margin-top:0}
h2{font-size:20px;line-height:1.3;margin:40px 0 8px;padding-top:24px;border-top:1px solid var(--linha)}
p,ul,ol{margin:0 0 16px}
ul,ol{padding-left:24px}
li{margin:0 0 8px}
strong{font-weight:650}
code{font:14px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace;background:var(--codigo);padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}
a{color:var(--destaque)}
footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--linha);color:var(--suave);font-size:14px}
</style>
</head>
<body>
<main>
${corpo}
<footer>EAA+ é um projeto independente de um aluno, sem vínculo oficial com a Escola de Adoração e Arte nem com a FABAT.</footer>
</main>
</body>
</html>
`;

mkdirSync(SAIDA, { recursive: true });
writeFileSync(`${SAIDA}/index.html`, html);
console.log(`✔ ${SAIDA}/index.html (${titulo})`);
