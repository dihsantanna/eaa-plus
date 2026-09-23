/* Servidor estático mínimo para as páginas-réplica (sem dependências).
 *
 * Rotas /d2l/api/... e /d2l/lms/... respondem a partir de
 * .test-build/site/api.json, um mapa "caminho (com ?query quando importa) →
 * { status, corpo } ou { status, html }" escrito por ava-fixtures.mjs. O que não
 * está no mapa responde 404, como o AVA real faz com o que não existe. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize, extname } from "node:path";

const ROOT = ".test-build/site";
const PORT = Number(process.env.PORT || 8123);

createServer(async (req, res) => {
  /* O Playwright sobe o servidor ANTES do globalSetup gerar as réplicas,
     então a checagem de prontidão precisa de uma rota que sempre existe. */
  if (req.url === "/ok") return res.writeHead(200).end("ok");
  const route = decodeURIComponent(req.url.split("?")[0]);

  if (route.startsWith("/d2l/api/") || route.startsWith("/d2l/lms/")) {
    const api = JSON.parse(await readFile(join(ROOT, "api.json"), "utf8"));
    const r = req.method !== "GET" ? { status: 405, body: null } : api[req.url] || api[route];
    /* "atraso" simula uma disciplina que o AVA demora a responder */
    if (r && r.delay) await new Promise((ok) => setTimeout(ok, r.delay));
    if (r && r.html !== undefined) {
      res.writeHead(r.status, { "content-type": "text/html; charset=utf-8" });
      return res.end(r.html);
    }
    /* /d2l/lms/ fora do mapa pode ser uma página de disciplina da réplica */
    if (r || route.startsWith("/d2l/api/")) {
      res.writeHead(r ? r.status : 404, { "content-type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify(r ? r.body : { title: "Not Found" }));
    }
  }

  let path = normalize(route).replace(/^(\.\.[/\\])+/, "");
  if (path === "/" || path === "\\") path = "future.html";
  else if (!extname(path)) path += ".html";
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORT, "127.0.0.1", () => console.log(`réplicas em http://localhost:${PORT}`));
