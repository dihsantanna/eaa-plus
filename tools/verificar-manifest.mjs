/* Checa as regras que mantêm a listagem da Chrome Web Store simples.
 * Qualquer quebra aqui muda o que precisa ser declarado na aba de
 * Privacidade do painel — por isso falha alto em vez de avisar. */

import { readFileSync, existsSync } from "node:fs";

const m = JSON.parse(readFileSync("manifest.json", "utf8"));
const erros = [];

if (m.manifest_version !== 3) erros.push("manifest_version precisa ser 3");
if (m.name.length > 45) erros.push(`name tem ${m.name.length} caracteres (máx. 45)`);
if (m.description.length > 132)
  erros.push(`description tem ${m.description.length} caracteres (máx. 132)`);

if (m.permissions && m.permissions.length)
  erros.push(`"permissions" não deveria existir: ${JSON.stringify(m.permissions)}`);
if (m.host_permissions && m.host_permissions.length)
  erros.push(`"host_permissions" não deveria existir: ${JSON.stringify(m.host_permissions)}`);

const PERMITIDO = "https://escoladeadoracaoearte.com.br/";
for (const cs of m.content_scripts || []) {
  for (const padrao of cs.matches) {
    if (!padrao.startsWith(PERMITIDO))
      erros.push(`match fora do domínio da escola: ${padrao}`);
    if (padrao.includes("*://*") || padrao === "<all_urls>")
      erros.push(`match amplo demais: ${padrao}`);
  }
  if (cs.js[0] !== "src/core.js")
    erros.push("src/core.js precisa ser o PRIMEIRO arquivo em content_scripts.js");
  for (const f of [...(cs.js || []), ...(cs.css || [])])
    if (!existsSync(f)) erros.push(`arquivo listado no manifest não existe: ${f}`);
}

for (const tam of ["16", "48", "128"])
  if (!existsSync(m.icons[tam])) erros.push(`ícone ${tam} ausente: ${m.icons[tam]}`);

if (erros.length) {
  console.error("manifest.json com problemas:\n  - " + erros.join("\n  - "));
  process.exit(1);
}
console.log(`manifest.json ok — ${m.name} v${m.version}`);
