/* Recarga automática para desenvolver no Chrome de verdade.
 *
 *   npm run dev
 *
 * 1. Monta .dev-build/ext: cópia da extensão + um recarregador de
 *    desenvolvimento. Carregue essa pasta UMA vez em chrome://extensions →
 *    Modo do desenvolvedor → Carregar sem compactação.
 * 2. Vigia src/, icons/ e manifest.json. A cada mudança remonta a pasta e
 *    troca a versão servida em http://localhost:8130/version.
 * 3. O recarregador (service worker) percebe, chama chrome.runtime.reload()
 *    e recarrega as abas do AVA e da página de aulas.
 *
 * O recarregador precisa de "tabs" e de localhost — permissões que existem
 * SÓ nesta cópia (somadas ao "storage" da extensão). O manifest.json publicado não muda, e o build nunca olha
 * para .dev-build/. Enquanto desenvolve, desative a versão da loja para as
 * duas não rodarem juntas na página de aulas.
 */

import { watch, cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve, join } from "node:path";

const PORT = 8130;
const OUT_DIR = ".dev-build/ext";

/* Roda no service worker da cópia de desenvolvimento. */
const RELOADER = `/* EAA+ (dev) — recarrega a extensão quando npm run dev avisa. */
const VERSION_URL = "http://localhost:${PORT}/version";
const PAGES = [
  "https://batistas.brightspace.com/d2l/*",
  "https://escoladeadoracaoearte.com.br/aulas-sincronas-graduacao-ead/*"
];
let current = null;

async function check() {
  try {
    const v = await (await fetch(VERSION_URL, { cache: "no-store" })).text();
    if (current === null) current = v;
    else if (v !== current) chrome.runtime.reload();
  } catch (e) {
    /* npm run dev parado: segue com o que tem */
  }
}

/* Depois de recarregar, as abas precisam ser recarregadas para os content
   scripts novos entrarem. */
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

/* Roda junto dos content scripts, só na cópia de desenvolvimento. */
const PULSE = `/* EAA+ (dev) — mantém o recarregador acordado. */
setInterval(function () {
  try { chrome.runtime.sendMessage("eaa-dev-pulse"); } catch (e) {}
}, 1000);
`;

let version = String(Date.now());

/* Atualiza no lugar, sem apagar a pasta: se o Chrome recarregar no meio e
   não achar o manifest, ele descarta a extensão e é preciso carregar de novo. */
function mirror(source, dest) {
  mkdirSync(dest, { recursive: true });
  const names = new Set(readdirSync(source));
  for (const name of readdirSync(dest)) {
    if (!names.has(name)) rmSync(join(dest, name), { recursive: true, force: true });
  }
  for (const name of names) {
    const srcPath = join(source, name);
    const destPath = join(dest, name);
    if (statSync(srcPath).isDirectory()) mirror(srcPath, destPath);
    else if (!existsSync(destPath) || !readFileSync(srcPath).equals(readFileSync(destPath))) cpSync(srcPath, destPath);
  }
}

function assemble() {
  mirror("src", `${OUT_DIR}/src`);
  mirror("icons", `${OUT_DIR}/icons`);
  writeFileSync(`${OUT_DIR}/dev-pulse.js`, PULSE);

  const m = JSON.parse(readFileSync("manifest.json", "utf8"));
  m.name = "EAA+ (dev)";
  /* Só cabe um service worker: o recarregador carrega o da extensão junto. */
  const backgroundWorker = m.background && m.background.service_worker;
  writeFileSync(
    `${OUT_DIR}/dev-reloader.js`,
    (backgroundWorker ? `importScripts(${JSON.stringify(backgroundWorker)});\n` : "") + RELOADER
  );
  m.background = { service_worker: "dev-reloader.js" };
  m.permissions = [...new Set([...(m.permissions || []), "tabs"])];
  m.host_permissions = [`http://localhost:${PORT}/*`];
  for (const cs of m.content_scripts) cs.js.push("dev-pulse.js");
  writeFileSync(`${OUT_DIR}/manifest.json`, JSON.stringify(m, null, 2));

  version = String(Date.now());
  console.log(`[${new Date().toLocaleTimeString("pt-BR")}] extensão remontada — o Chrome recarrega em ~1s`);
}

let debounce = null;
function changed(_, file) {
  if (file && /(^|[\\/])\.|~$/.test(file)) return; /* temporários de editor */
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    try {
      assemble();
    } catch (e) {
      console.error("não consegui remontar:", e.message);
    }
  }, 150);
}

assemble();
watch("src", { recursive: true }, changed);
watch("icons", { recursive: true }, changed);
watch("manifest.json", changed);

createServer((req, res) => {
  if (req.url === "/version") {
    res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
    return res.end(version);
  }
  res.writeHead(404).end();
}).listen(PORT, "127.0.0.1", () => {
  console.log(`\nEAA+ dev — vigiando src/. Pasta para carregar no Chrome (uma vez):\n  ${resolve(OUT_DIR)}\n`);
});
