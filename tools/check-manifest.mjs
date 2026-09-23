/* Checa as regras que mantêm a listagem da Chrome Web Store simples.
 * Qualquer quebra aqui muda o que precisa ser declarado na aba de
 * Privacidade do painel — por isso falha alto em vez de avisar. */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const m = JSON.parse(readFileSync("manifest.json", "utf8"));
const errors = [];

if (m.manifest_version !== 3) errors.push("manifest_version precisa ser 3");
if (m.name.length > 45) errors.push(`name tem ${m.name.length} caracteres (máx. 45)`);
if (m.description.length > 132)
  errors.push(`description tem ${m.description.length} caracteres (máx. 132)`);

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (pkg.version !== m.version)
  errors.push(`versão diferente: manifest ${m.version}, package.json ${pkg.version}`);

/* Única permissão: "storage", para o cache entre páginas do AVA em
   chrome.storage.session (decidido com o usuário em 2026-09-23). Não gera
   aviso na instalação. Qualquer outra muda a aba Privacidade do painel. */
const ALLOWED = ["storage"];
for (const p of m.permissions || [])
  if (!ALLOWED.includes(p)) errors.push(`permissão não combinada: "${p}" (só ${ALLOWED.join(", ")})`);
if (m.host_permissions && m.host_permissions.length)
  errors.push(`"host_permissions" não deveria existir: ${JSON.stringify(m.host_permissions)}`);
if (m.optional_permissions || m.optional_host_permissions)
  errors.push("permissões opcionais não foram combinadas");

/* Service worker: só libera o storage.session para os content scripts. */
const BACKGROUND = "src/background.js";
if (m.background && (m.background.service_worker !== BACKGROUND || Object.keys(m.background).length !== 1))
  errors.push(`background deveria ser só { "service_worker": "${BACKGROUND}" }`);

/* Cada site tem o seu bloco. O do AVA cobre as páginas /d2l/ do Brightspace da
   escola (página inicial + todas as páginas de disciplina) e nada além. */
const SCHOOL = "https://escoladeadoracaoearte.com.br/";
const AVA = ["https://batistas.brightspace.com/d2l/*"];
const isAvaPattern = (p) => AVA.includes(p);

const avaFiles = new Set();
const schoolFiles = new Set();

for (const cs of m.content_scripts || []) {
  for (const pattern of cs.matches) {
    if (!pattern.startsWith(SCHOOL) && !isAvaPattern(pattern))
      errors.push(`match fora dos sites permitidos: ${pattern}`);
    if (pattern.includes("*://*") || pattern === "<all_urls>")
      errors.push(`match amplo demais: ${pattern}`);
  }
  const isAva = cs.matches.every(isAvaPattern);
  if (!isAva && cs.matches.some(isAvaPattern))
    errors.push("não misture a escola e o AVA no mesmo bloco de content_scripts");

  if (cs.js[0] !== "src/core.js")
    errors.push("src/core.js precisa ser o PRIMEIRO arquivo em content_scripts.js");
  for (const f of [...(cs.js || []), ...(cs.css || [])]) {
    if (!existsSync(f)) errors.push(`arquivo listado no manifest não existe: ${f}`);
    (isAva ? avaFiles : schoolFiles).add(f);
  }
}

/* ---------- código: sintaxe, zero código remoto, fetch só no AVA ---------- */
const js = readdirSync("src", { recursive: true })
  .map((f) => "src/" + String(f).replace(/\\/g, "/"))
  .filter((f) => f.endsWith(".js"))
  .sort();
const backgroundFile = m.background ? m.background.service_worker : null;
for (const f of js)
  if (!avaFiles.has(f) && !schoolFiles.has(f) && f !== backgroundFile)
    errors.push(`${f} existe em src/ mas não está em nenhum bloco do manifest`);

for (const f of js) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
  } catch (e) {
    errors.push(`erro de sintaxe em ${f}:\n${String(e.stderr).trim()}`);
    continue;
  }

  const src = readFileSync(f, "utf8");
  /* já aconteceu: \b de uma regex virar o caractere backspace ao editar */
  const control = src.match(/[\x00-\x08\x0b\x0c\x0e-\x1f]/);
  if (control)
    errors.push(`${f}: caractere de controle (código ${control[0].charCodeAt(0)}) — provável regex corrompida`);
  if (/\beval\s*\(|new\s+Function\s*\(|\bimport\s*\(|importScripts|createElement\(\s*["']script/.test(src))
    errors.push(`${f}: código remoto/dinâmico não é permitido (eval, Function, import(), <script>)`);
  if (/XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(src))
    errors.push(`${f}: só fetch é permitido para rede, e só no AVA`);
  /* APIs do Chrome: só o storage.session (memória, some ao fechar) e os
     eventos do service worker que o liberam. Nada de storage.local/sync. */
  const apis = (src.replace(/\/\*[^]*?\*\//g, "").match(/\bchrome\.[\w.]+/g) || []).filter(
    (a) => !/^chrome\.storage(\.session(\.(get|set|remove|setAccessLevel))?)?$|^chrome\.runtime\.on(Installed|Startup)\.addListener$/.test(a)
  );
  if (apis.length) errors.push(`${f}: API do Chrome não combinada: ${[...new Set(apis)].join(", ")}`);

  const fetches = src.match(/\bfetch\s*\(/g) || [];
  if (!fetches.length) continue;

  /* Regra do fetch (decidida com o usuário em 2026-09-23): qualquer rota do
     próprio AVA, só GET, nunca URL absoluta. Todo fetch passa por
     sameOrigin(), que recusa o que não começa com uma barra só. */
  if (!avaFiles.has(f) || schoolFiles.has(f))
    errors.push(`${f}: fetch só é permitido em arquivos que rodam apenas no AVA`);
  if (!src.includes("function sameOrigin(path)") || !src.includes("if (!/^\\/(?!\\/)/.test(path)) throw"))
    errors.push(`${f}: usa fetch mas não tem a guarda sameOrigin(path) que recusa URL de fora`);
  const guardedFetches = src.match(/\bfetch\s*\(\s*sameOrigin\s*\(/g) || [];
  if (guardedFetches.length !== fetches.length)
    errors.push(`${f}: todo fetch precisa ser fetch(sameOrigin(...))`);
  if (/:\/\//.test(src.replace(/\/\*[^]*?\*\//g, "")))
    errors.push(`${f}: URL absoluta (://) no código de quem faz fetch`);
  if (/method\s*:|["'](POST|PUT|PATCH|DELETE)["']/.test(src))
    errors.push(`${f}: só leitura (GET)`);
}

for (const size of ["16", "48", "128"])
  if (!existsSync(m.icons[size])) errors.push(`ícone ${size} ausente: ${m.icons[size]}`);

if (errors.length) {
  console.error("manifest.json com problemas:\n  - " + errors.join("\n  - "));
  process.exit(1);
}
console.log(`manifest.json ok — ${m.name} v${m.version} (${js.length} scripts conferidos)`);
