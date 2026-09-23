/* Checa as regras que mantêm a listagem da Chrome Web Store simples.
 * Qualquer quebra aqui muda o que precisa ser declarado na aba de
 * Privacidade do painel — por isso falha alto em vez de avisar. */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const m = JSON.parse(readFileSync("manifest.json", "utf8"));
const erros = [];

if (m.manifest_version !== 3) erros.push("manifest_version precisa ser 3");
if (m.name.length > 45) erros.push(`name tem ${m.name.length} caracteres (máx. 45)`);
if (m.description.length > 132)
  erros.push(`description tem ${m.description.length} caracteres (máx. 132)`);

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (pkg.version !== m.version)
  erros.push(`versão diferente: manifest ${m.version}, package.json ${pkg.version}`);

if (m.permissions && m.permissions.length)
  erros.push(`"permissions" não deveria existir: ${JSON.stringify(m.permissions)}`);
if (m.host_permissions && m.host_permissions.length)
  erros.push(`"host_permissions" não deveria existir: ${JSON.stringify(m.host_permissions)}`);

/* Cada site tem o seu bloco. O do AVA fica preso à página inicial. */
const ESCOLA = "https://escoladeadoracaoearte.com.br/";
const AVA = ["https://batistas.brightspace.com/d2l/home", "https://batistas.brightspace.com/d2l/home?*"];
const doAva = (p) => AVA.includes(p);

const arquivosDoAva = new Set();
const arquivosDaEscola = new Set();

for (const cs of m.content_scripts || []) {
  for (const padrao of cs.matches) {
    if (!padrao.startsWith(ESCOLA) && !doAva(padrao))
      erros.push(`match fora dos sites permitidos: ${padrao}`);
    if (padrao.includes("*://*") || padrao === "<all_urls>")
      erros.push(`match amplo demais: ${padrao}`);
  }
  const ehAva = cs.matches.every(doAva);
  if (!ehAva && cs.matches.some(doAva))
    erros.push("não misture a escola e o AVA no mesmo bloco de content_scripts");

  if (cs.js[0] !== "src/core.js")
    erros.push("src/core.js precisa ser o PRIMEIRO arquivo em content_scripts.js");
  for (const f of [...(cs.js || []), ...(cs.css || [])]) {
    if (!existsSync(f)) erros.push(`arquivo listado no manifest não existe: ${f}`);
    (ehAva ? arquivosDoAva : arquivosDaEscola).add(f);
  }
}

/* ---------- código: sintaxe, zero código remoto, fetch só na API do AVA ---------- */
const js = ["src/core.js", ...readdirSync("src/features").filter((f) => f.endsWith(".js")).map((f) => `src/features/${f}`)];

for (const f of js) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
  } catch (e) {
    erros.push(`erro de sintaxe em ${f}:\n${String(e.stderr).trim()}`);
    continue;
  }

  const src = readFileSync(f, "utf8");
  if (/\beval\s*\(|new\s+Function\s*\(|\bimport\s*\(|importScripts|createElement\(\s*["']script/.test(src))
    erros.push(`${f}: código remoto/dinâmico não é permitido (eval, Function, import(), <script>)`);
  if (/XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(src))
    erros.push(`${f}: só fetch é permitido para rede, e só no AVA`);

  const fetches = src.match(/\bfetch\s*\(/g) || [];
  if (!fetches.length) continue;

  /* Regra do fetch (decidida com o usuário em 2026-09-23): qualquer rota do
     próprio AVA, só GET, nunca URL absoluta. Todo fetch passa por
     mesmaOrigem(), que recusa o que não começa com uma barra só. */
  if (!arquivosDoAva.has(f) || arquivosDaEscola.has(f))
    erros.push(`${f}: fetch só é permitido em arquivos que rodam apenas no AVA`);
  if (!src.includes("function mesmaOrigem(caminho)") || !src.includes("if (!/^\\/(?!\\/)/.test(caminho)) throw"))
    erros.push(`${f}: usa fetch mas não tem a guarda mesmaOrigem(caminho) que recusa URL de fora`);
  const guardados = src.match(/\bfetch\s*\(\s*mesmaOrigem\s*\(/g) || [];
  if (guardados.length !== fetches.length)
    erros.push(`${f}: todo fetch precisa ser fetch(mesmaOrigem(...))`);
  if (/:\/\//.test(src.replace(/\/\*[^]*?\*\//g, "")))
    erros.push(`${f}: URL absoluta (://) no código de quem faz fetch`);
  if (/method\s*:|["'](POST|PUT|PATCH|DELETE)["']/.test(src))
    erros.push(`${f}: só leitura (GET)`);
}

for (const tam of ["16", "48", "128"])
  if (!existsSync(m.icons[tam])) erros.push(`ícone ${tam} ausente: ${m.icons[tam]}`);

if (erros.length) {
  console.error("manifest.json com problemas:\n  - " + erros.join("\n  - "));
  process.exit(1);
}
console.log(`manifest.json ok — ${m.name} v${m.version} (${js.length} scripts conferidos)`);
