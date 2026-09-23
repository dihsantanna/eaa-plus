/* Servidor estático mínimo para as páginas-réplica (sem dependências).
 *
 * Rotas /d2l/api/... e /d2l/lms/... respondem a partir de
 * .test-build/site/api.json, um mapa "caminho (com ?query quando importa) →
 * { status, corpo } ou { status, html }" escrito por fixtures-ava.mjs. O que não
 * está no mapa responde 404, como o AVA real faz com o que não existe. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname } from "node:path";

const RAIZ = ".test-build/site";
const PORTA = Number(process.env.PORTA || 8123);

createServer(async (req, res) => {
  /* O Playwright sobe o servidor ANTES do globalSetup gerar as réplicas,
     então a checagem de prontidão precisa de uma rota que sempre existe. */
  if (req.url === "/ok") return res.writeHead(200).end("ok");
  const rota = decodeURIComponent(req.url.split("?")[0]);

  if (rota.startsWith("/d2l/api/") || rota.startsWith("/d2l/lms/")) {
    const api = JSON.parse(await readFile(join(RAIZ, "api.json"), "utf8"));
    const r = req.method !== "GET" ? { status: 405, corpo: null } : api[req.url] || api[rota];
    if (r && r.html !== undefined) {
      res.writeHead(r.status, { "content-type": "text/html; charset=utf-8" });
      return res.end(r.html);
    }
    res.writeHead(r ? r.status : 404, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(r ? r.corpo : { title: "Not Found" }));
  }

  let caminho = normalize(rota).replace(/^(\.\.[/\\])+/, "");
  if (caminho === "/" || caminho === "\\") caminho = "futuro.html";
  else if (!extname(caminho)) caminho += ".html";
  try {
    const corpo = await readFile(join(RAIZ, caminho));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(corpo);
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORTA, "127.0.0.1", () => console.log(`réplicas em http://localhost:${PORTA}`));
