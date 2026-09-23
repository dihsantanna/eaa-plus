/* Recarga automática para desenvolver no Chrome de verdade.
 *
 *   npm run dev
 *
 * 1. Monta .dev-build/ext com o esbuild em modo watch: código legível e com
 *    sourcemap (os erros no console apontam para o .ts), mais um recarregador
 *    de desenvolvimento. Carregue essa pasta UMA vez em chrome://extensions →
 *    Modo do desenvolvedor → Carregar sem compactação.
 * 2. A cada mudança em src/, remonta e troca a versão servida em
 *    http://localhost:8130/version.
 * 3. O recarregador (service worker) percebe, chama chrome.runtime.reload()
 *    e recarrega as abas do AVA.
 *
 * O recarregador precisa de "tabs" e de localhost — permissões que existem
 * SÓ nesta cópia (somadas ao "storage" da extensão). O manifest publicado não
 * muda, e o build nunca olha para .dev-build/. Enquanto desenvolve, desative a
 * versão da loja para as duas não rodarem juntas.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { watchBundle } from "./bundle.mjs";

const PORT = 8130;
const OUT_DIR = ".dev-build/ext";

/* Roda no service worker da cópia de desenvolvimento, junto do background.js
   da extensão (só cabe um service worker). */
const RELOADER = `/* EAA+ (dev) — recarrega a extensão quando npm run dev avisa. */
importScripts("background.js");
const VERSION_URL = "http://localhost:${PORT}/version";
const PAGES = ["https://batistas.brightspace.com/d2l/*"];
let current = null;

async function check() {
  try {
    const v = await (await fetch(VERSION_URL, { cache: "no-store" })).text();
    if (current === null) current = v;
    else if (v !== current) chrome.runtime.reload();
  } catch {
    /* npm run dev parado: segue com o que tem */
  }
}

/* Depois de recarregar, as abas precisam ser recarregadas para o content
   script novo entrar. */
chrome.runtime.onInstalled.addListener(async (d) => {
  if (d.reason !== "update") return;
  for (const tab of await chrome.tabs.query({ url: PAGES })) chrome.tabs.reload(tab.id);
});

/* O service worker dorme depois de ~30s parado; o "pulso" das páginas abertas
   o mantém acordado enquanto você trabalha. */
chrome.runtime.onMessage.addListener((m) => {
  if (m === "eaa-dev-pulse") check();
});
setInterval(check, 1000);
check();
`;

/* Roda junto do content script, só na cópia de desenvolvimento. */
const PULSE = `/* EAA+ (dev) — mantém o recarregador acordado. */
setInterval(() => {
  try { chrome.runtime.sendMessage("eaa-dev-pulse"); } catch {}
}, 1000);
`;

const DEV_FILES = { "dev-reloader.js": RELOADER, "dev-pulse.js": PULSE };

function devManifest(m) {
  m.name = "EAA+ (dev)";
  m.background = { service_worker: "dev-reloader.js" };
  m.permissions = [...new Set([...(m.permissions ?? []), "tabs"])];
  m.host_permissions = [`http://localhost:${PORT}/*`];
  for (const cs of m.content_scripts) cs.js.push("dev-pulse.js");
  return m;
}

/* A pasta NÃO é apagada (se o Chrome recarregar no meio e não achar o
   manifest, ele descarta a extensão): só saem as sobras de versões antigas. */
const KEEP = new Set(["manifest.json", "content.js", "content.css", "background.js", "icons", ...Object.keys(DEV_FILES)]);
mkdirSync(OUT_DIR, { recursive: true });
for (const name of readdirSync(OUT_DIR)) if (!KEEP.has(name)) rmSync(join(OUT_DIR, name), { recursive: true, force: true });
for (const [name, code] of Object.entries(DEV_FILES)) writeFileSync(join(OUT_DIR, name), code);

let version = String(Date.now());

await watchBundle({
  outdir: OUT_DIR,
  transformManifest: devManifest,
  onRebuild(errors) {
    const time = new Date().toLocaleTimeString("pt-BR");
    if (errors.length) return console.error(`[${time}] erro no build — a extensão continua com a versão anterior`);
    version = String(Date.now());
    console.log(`[${time}] extensão remontada — o Chrome recarrega em ~1s`);
  },
});

createServer((req, res) => {
  if (req.url === "/version") {
    res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
    return res.end(version);
  }
  res.writeHead(404).end();
}).listen(PORT, "127.0.0.1", () => {
  console.log(`\nEAA+ dev — vigiando src/. Pasta para carregar no Chrome (uma vez):\n  ${resolve(OUT_DIR)}\n`);
});
