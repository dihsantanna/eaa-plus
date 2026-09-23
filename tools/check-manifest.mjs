/* Checa as regras que mantêm a listagem da Chrome Web Store simples.
 * Qualquer quebra aqui muda o que precisa ser declarado na aba de
 * Privacidade do painel — por isso falha alto em vez de avisar.
 *
 * Confere o manifest (src/manifest.json) e o código-fonte (src/**\/*.ts).
 * A checagem de tipos é do tsc (npm run check roda os dois).
 */

import { readdirSync, readFileSync } from "node:fs";

const m = JSON.parse(readFileSync("src/manifest.json", "utf8"));
const errors = [];

/* ---------- manifest ---------- */
if (m.manifest_version !== 3) errors.push("manifest_version precisa ser 3");
if (m.name.length > 45) errors.push(`name tem ${m.name.length} caracteres (máx. 45)`);
if (m.description.length > 132) errors.push(`description tem ${m.description.length} caracteres (máx. 132)`);

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (pkg.version !== m.version) errors.push(`versão diferente: manifest ${m.version}, package.json ${pkg.version}`);

/* Única permissão: "storage", para o cache entre páginas do AVA em
   chrome.storage.session. Não gera aviso na instalação. Qualquer outra muda a
   aba Privacidade do painel. */
const ALLOWED_PERMISSIONS = ["storage"];
for (const p of m.permissions ?? [])
  if (!ALLOWED_PERMISSIONS.includes(p)) errors.push(`permissão não combinada: "${p}" (só ${ALLOWED_PERMISSIONS.join(", ")})`);
if (m.host_permissions?.length) errors.push(`"host_permissions" não deveria existir: ${JSON.stringify(m.host_permissions)}`);
if (m.optional_permissions || m.optional_host_permissions) errors.push("permissões opcionais não foram combinadas");

/* Service worker: só libera o storage.session para o content script. */
if (JSON.stringify(m.background) !== JSON.stringify({ service_worker: "background.js" }))
  errors.push(`background deveria ser só { "service_worker": "background.js" }`);

/* Um bloco só, e só nas páginas /d2l/ do Brightspace da escola (página
   inicial + todas as páginas de disciplina). Nada além disso. */
const AVA = "https://batistas.brightspace.com/d2l/*";
const blocks = m.content_scripts ?? [];
if (blocks.length !== 1) errors.push(`content_scripts deveria ter um bloco só (o do AVA); tem ${blocks.length}`);
for (const cs of blocks) {
  if (JSON.stringify(cs.matches) !== JSON.stringify([AVA])) errors.push(`matches deveria ser só ${AVA}: ${JSON.stringify(cs.matches)}`);
  if (JSON.stringify(cs.js) !== '["content.js"]') errors.push(`js deveria ser só content.js (gerado pelo build): ${JSON.stringify(cs.js)}`);
  if (JSON.stringify(cs.css) !== '["content.css"]') errors.push(`css deveria ser só content.css (gerado pelo build): ${JSON.stringify(cs.css)}`);
}

/* ---------- código-fonte ---------- */
/* O único arquivo que pode falar com a rede. */
const NETWORK_FILE = "src/ava/network.ts";

const sources = readdirSync("src", { recursive: true })
  .map((f) => `src/${String(f).replace(/\\/g, "/")}`)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
  .sort();

const withoutComments = (src) => src.replace(/\/\*[^]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

for (const f of sources) {
  const src = readFileSync(f, "utf8");
  const code = withoutComments(src);

  /* já aconteceu: \b de uma regex virar o caractere backspace ao editar */
  const control = src.match(/[\x00-\x08\x0b\x0c\x0e-\x1f]/);
  if (control) errors.push(`${f}: caractere de controle (código ${control[0].charCodeAt(0)}) — provável regex corrompida`);

  if (/\beval\s*\(|new\s+Function\s*\(|\bimport\s*\(|importScripts|createElement\(\s*["'`]script/.test(code))
    errors.push(`${f}: código remoto/dinâmico não é permitido (eval, Function, import(), <script>)`);
  if (/XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(code)) errors.push(`${f}: só fetch é permitido para rede`);

  /* APIs do Chrome: só o storage.session (memória, some ao fechar) e os
     eventos do service worker que o liberam. Nada de storage.local/sync.
     (chrome.storage.StorageArea é só o nome do tipo, para o TypeScript.) */
  const apis = (code.match(/\bchrome\.[\w.?]+/g) ?? [])
    .map((a) => a.replace(/\?/g, ""))
    .filter(
      (a) =>
        !/^chrome\.storage(\.session(\.(get|set|remove|setAccessLevel))?|\.StorageArea)?$|^chrome\.runtime\.on(Installed|Startup)\.addListener$/.test(a)
    );
  if (apis.length) errors.push(`${f}: API do Chrome não combinada: ${[...new Set(apis)].join(", ")}`);

  const fetches = code.match(/\bfetch\s*\(/g) ?? [];
  if (!fetches.length) continue;

  /* Regra do fetch (decidida com o usuário em 2026-09-23): qualquer rota do
     próprio AVA, só GET, nunca URL absoluta. Todo fetch passa por
     sameOrigin(), que recusa o que não começa com uma barra só. */
  if (f !== NETWORK_FILE) {
    errors.push(`${f}: fetch só é permitido em ${NETWORK_FILE}`);
    continue;
  }
  if (!code.includes("function sameOrigin(path: string)") || !code.includes("if (!/^\\/(?!\\/)/.test(path)) throw"))
    errors.push(`${f}: usa fetch mas não tem a guarda sameOrigin(path) que recusa URL de fora`);
  const guarded = code.match(/\bfetch\s*\(\s*sameOrigin\s*\(/g) ?? [];
  if (guarded.length !== fetches.length) errors.push(`${f}: todo fetch precisa ser fetch(sameOrigin(...))`);
  if (/:\/\//.test(code)) errors.push(`${f}: URL absoluta (://) no código de quem faz fetch`);
  if (/method\s*:|["'`](POST|PUT|PATCH|DELETE)["'`]/.test(code)) errors.push(`${f}: só leitura (GET)`);
}

if (errors.length) {
  console.error("manifest/código com problemas:\n  - " + errors.join("\n  - "));
  process.exit(1);
}
console.log(`manifest.json ok — ${m.name} v${m.version} (${sources.length} arquivos .ts conferidos)`);
