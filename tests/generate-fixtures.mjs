/* Prepara o ambiente de teste (roda uma vez antes da suíte):
 *
 * 1. Monta a extensão em .test-build/ext — minificada, igual à da loja —
 *    trocando o `matches` para localhost.
 * 2. Gera a réplica do AVA e as respostas da API (ver ava-fixtures.mjs), com
 *    datas relativas ao agora: content scripts rodam num "mundo isolado" do
 *    Chrome, então NÃO dá para falsificar o Date pela página.
 */

import { mkdirSync, rmSync } from "node:fs";
import { bundle } from "../tools/bundle.mjs";
import { generateAva } from "./ava-fixtures.mjs";

const ROOT = ".test-build";

export default async function generate() {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(`${ROOT}/site`, { recursive: true });

  await bundle({
    outdir: `${ROOT}/ext`,
    transformManifest: (m) => {
      for (const cs of m.content_scripts) cs.matches = ["http://localhost/d2l/*", "http://127.0.0.1/d2l/*"];
      return m;
    },
  });

  generateAva(ROOT);
}
