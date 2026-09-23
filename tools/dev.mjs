/* Recarga automática para desenvolver no Chrome de verdade.
 *
 *   npm run dev
 *
 * 1. Monta .dev-build/ext: cópia da extensão + um recarregador de
 *    desenvolvimento. Carregue essa pasta UMA vez em chrome://extensions →
 *    Modo do desenvolvedor → Carregar sem compactação.
 * 2. Vigia src/, icons/ e manifest.json. A cada mudança remonta a pasta e
 *    troca a versão servida em http://localhost:8130/versao.
 * 3. O recarregador (service worker) percebe, chama chrome.runtime.reload()
 *    e recarrega as abas do AVA e da página de aulas.
 *
 * O recarregador precisa de "tabs" e de localhost — permissões que existem
 * SÓ nesta cópia. O manifest.json publicado não muda, e o build nunca olha
 * para .dev-build/. Enquanto desenvolve, desative a versão da loja para as
 * duas não rodarem juntas na página de aulas.
 */

import { watch, cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { resolve, join } from "node:path";

const PORTA = 8130;
const SAIDA = ".dev-build/ext";

/* Roda no service worker da cópia de desenvolvimento. */
const RECARREGADOR = `/* EAA+ (dev) — recarrega a extensão quando npm run dev avisa. */
const VERSAO = "http://localhost:${PORTA}/versao";
const PAGINAS = [
  "https://batistas.brightspace.com/d2l/*",
  "https://escoladeadoracaoearte.com.br/aulas-sincronas-graduacao-ead/*"
];
let atual = null;

async function checar() {
  try {
    const v = await (await fetch(VERSAO, { cache: "no-store" })).text();
    if (atual === null) atual = v;
    else if (v !== atual) chrome.runtime.reload();
  } catch (e) {
    /* npm run dev parado: segue com o que tem */
  }
}

/* Depois de recarregar, as abas precisam ser recarregadas para os content
   scripts novos entrarem. */
chrome.runtime.onInstalled.addListener(async (d) => {
  if (d.reason !== "update") return;
  for (const aba of await chrome.tabs.query({ url: PAGINAS })) chrome.tabs.reload(aba.id);
});

/* O service worker dorme depois de ~30s parado; o "pulso" das páginas abertas
   o mantém acordado enquanto você trabalha. */
chrome.runtime.onMessage.addListener((m) => {
  if (m === "eaa-dev-pulso") checar();
});
setInterval(checar, 1000);
checar();
`;

/* Roda junto dos content scripts, só na cópia de desenvolvimento. */
const PULSO = `/* EAA+ (dev) — mantém o recarregador acordado. */
setInterval(function () {
  try { chrome.runtime.sendMessage("eaa-dev-pulso"); } catch (e) {}
}, 1000);
`;

let versao = String(Date.now());

/* Atualiza no lugar, sem apagar a pasta: se o Chrome recarregar no meio e
   não achar o manifest, ele descarta a extensão e é preciso carregar de novo. */
function espelhar(origem, destino) {
  mkdirSync(destino, { recursive: true });
  const nomes = new Set(readdirSync(origem));
  for (const nome of readdirSync(destino)) {
    if (!nomes.has(nome)) rmSync(join(destino, nome), { recursive: true, force: true });
  }
  for (const nome of nomes) {
    const de = join(origem, nome);
    const para = join(destino, nome);
    if (statSync(de).isDirectory()) espelhar(de, para);
    else if (!existsSync(para) || !readFileSync(de).equals(readFileSync(para))) cpSync(de, para);
  }
}

function montar() {
  espelhar("src", `${SAIDA}/src`);
  espelhar("icons", `${SAIDA}/icons`);
  writeFileSync(`${SAIDA}/dev-recarregador.js`, RECARREGADOR);
  writeFileSync(`${SAIDA}/dev-pulso.js`, PULSO);

  const m = JSON.parse(readFileSync("manifest.json", "utf8"));
  m.name = "EAA+ (dev)";
  m.background = { service_worker: "dev-recarregador.js" };
  m.permissions = ["tabs"];
  m.host_permissions = [`http://localhost:${PORTA}/*`];
  for (const cs of m.content_scripts) cs.js.push("dev-pulso.js");
  writeFileSync(`${SAIDA}/manifest.json`, JSON.stringify(m, null, 2));

  versao = String(Date.now());
  console.log(`[${new Date().toLocaleTimeString("pt-BR")}] extensão remontada — o Chrome recarrega em ~1s`);
}

let espera = null;
function mudou(_, arquivo) {
  if (arquivo && /(^|[\\/])\.|~$/.test(arquivo)) return; /* temporários de editor */
  clearTimeout(espera);
  espera = setTimeout(() => {
    try {
      montar();
    } catch (e) {
      console.error("não consegui remontar:", e.message);
    }
  }, 150);
}

montar();
watch("src", { recursive: true }, mudou);
watch("icons", { recursive: true }, mudou);
watch("manifest.json", mudou);

createServer((req, res) => {
  if (req.url === "/versao") {
    res.writeHead(200, { "content-type": "text/plain", "cache-control": "no-store" });
    return res.end(versao);
  }
  res.writeHead(404).end();
}).listen(PORTA, "127.0.0.1", () => {
  console.log(`\nEAA+ dev — vigiando src/. Pasta para carregar no Chrome (uma vez):\n  ${resolve(SAIDA)}\n`);
});
