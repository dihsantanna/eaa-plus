/* Gera o pacote para a Chrome Web Store:
 *
 *   build/                   → a extensão montada (dá para "Carregar sem compactação")
 *   dist/eaa-plus-vX.Y.Z.zip → sobe no painel da loja
 *
 * Antes, roda o npm run check (tipos + regras da loja): um pacote que quebra
 * as regras nem chega a ser gerado. O código sai minificado (permitido pela
 * loja; ofuscar não é).
 */

import AdmZip from "adm-zip";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { bundle } from "./bundle.mjs";

execSync("npm run check", { stdio: "inherit" });

const OUT = "build";
await bundle({ outdir: OUT, minify: true });

/* Salvaguarda final no que vai de fato para a loja. */
for (const f of ["content.js", "background.js"]) {
  const code = readFileSync(`${OUT}/${f}`, "utf8");
  if (/\beval\(|new Function\(|importScripts\(/.test(code)) throw new Error(`${OUT}/${f}: código dinâmico no pacote`);
}

const { version } = JSON.parse(readFileSync(`${OUT}/manifest.json`, "utf8"));
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
const zip = new AdmZip();
zip.addLocalFolder(OUT);
const zipName = `dist/eaa-plus-v${version}.zip`;
zip.writeZip(zipName);

console.log(`\n✔ ${OUT}/ (extensão montada)\n✔ ${zipName}`);
