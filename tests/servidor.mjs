/* Servidor estático mínimo para as páginas-réplica (sem dependências). */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";

const RAIZ = ".test-build/site";
const PORTA = Number(process.env.PORTA || 8123);

createServer(async (req, res) => {
  /* O Playwright sobe o servidor ANTES do globalSetup gerar as réplicas,
     então a checagem de prontidão precisa de uma rota que sempre existe. */
  if (req.url === "/ok") return res.writeHead(200).end("ok");
  const caminho = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  try {
    const corpo = await readFile(join(RAIZ, caminho === "/" ? "futuro.html" : caminho));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(corpo);
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORTA, "127.0.0.1", () => console.log(`réplicas em http://localhost:${PORTA}`));
