/* Gera os dois entregáveis em dist/:
 *
 *   eaa-plus-vX.Y.Z.zip       → sobe no painel da Chrome Web Store
 *   colar-no-elementor.html   → bloco <style>+<script> para quem tem acesso
 *                               ao WordPress colar no fim do widget HTML
 *                               da página (atende celular, sem instalar nada)
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import AdmZip from "adm-zip";
import { minify } from "terser";

execSync("npm run check", { stdio: "inherit" });

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
/* Só o bloco da escola vai para o Elementor — o do AVA não roda naquela página. */
const cs = manifest.content_scripts.find((b) =>
  b.matches.every((p) => p.startsWith("https://escoladeadoracaoearte.com.br/"))
);

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");

/* ---------- zip da extensão ---------- */
const zip = new AdmZip();
zip.addLocalFile("manifest.json");
zip.addLocalFolder("src", "src");
zip.addLocalFolder("icons", "icons");
const zipName = `dist/eaa-plus-v${manifest.version}.zip`;
zip.writeZip(zipName);

/* ---------- bloco para o Elementor ---------- */
const js = cs.js.map((f) => readFileSync(f, "utf8")).join("\n");
const css = cs.css.map((f) => readFileSync(f, "utf8")).join("\n");
const jsMin = (await minify(js, { compress: true, mangle: true })).code;
const cssMin = css
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ")
  .replace(/\s*([{}:;,])\s*/g, "$1")
  .trim();

writeFileSync(
  "dist/colar-no-elementor.html",
  `<!-- EAA+ v${manifest.version} — colar no FIM do widget HTML da página de Aulas Síncronas.
     Filtro por período + próxima aula. Não carrega nada externo, não coleta dados.
     Para remover: apagar este bloco inteiro. -->
<style>${cssMin}</style>
<script>${jsMin}</script>
`
);

console.log(`\n✔ ${zipName}`);
console.log("✔ dist/colar-no-elementor.html");
