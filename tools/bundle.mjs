/* Monta a extensão pronta para carregar no Chrome, a partir de src/:
 *
 *   <outdir>/manifest.json   (src/manifest.json, opcionalmente transformado)
 *   <outdir>/content.js      (src/content.ts + tudo que ele importa, num arquivo só)
 *   <outdir>/content.css     (os CSS importados em content.ts)
 *   <outdir>/background.js   (src/background.ts)
 *   <outdir>/icons/
 *
 * Usado pelo build da loja (minificado), pelo npm run dev (legível, com
 * sourcemap) e pelos testes E2E (minificado, como o que vai para a loja).
 *
 * Minificar é permitido pela Chrome Web Store (remover espaços e
 * comentários, encurtar nomes, juntar arquivos); ofuscar não é.
 */

import * as esbuild from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

/** Chrome que a extensão suporta: o esbuild só reescreve o que for mais novo. */
const TARGET = "chrome120";

function options({ outdir, minify, sourcemap }) {
  return {
    entryPoints: { content: "src/content.ts", background: "src/background.ts" },
    outdir,
    bundle: true,
    format: "iife",
    target: TARGET,
    minify,
    sourcemap: sourcemap ? "inline" : false,
    legalComments: "none",
    charset: "utf8",
    logLevel: "warning",
  };
}

/** Copia o manifest (e os ícones) para a pasta montada. */
function writeStatic(outdir, transformManifest) {
  const manifest = JSON.parse(readFileSync("src/manifest.json", "utf8"));
  writeFileSync(`${outdir}/manifest.json`, JSON.stringify(transformManifest(manifest), null, 2));
  cpSync("icons", `${outdir}/icons`, { recursive: true });
}

/** Monta uma vez. */
export async function bundle({ outdir, minify = true, sourcemap = false, clean = true, transformManifest = (m) => m }) {
  if (clean) rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  await esbuild.build(options({ outdir, minify, sourcemap }));
  writeStatic(outdir, transformManifest);
}

/** Monta e continua vigiando src/ e icons/: a cada mudança, remonta e chama
 *  onRebuild(erros). */
export async function watchBundle({ outdir, transformManifest = (m) => m, onRebuild = () => {} }) {
  mkdirSync(outdir, { recursive: true });
  const ctx = await esbuild.context({
    ...options({ outdir, minify: false, sourcemap: true }),
    plugins: [
      {
        name: "eaa-static",
        setup(build) {
          build.onEnd((result) => {
            if (!result.errors.length) writeStatic(outdir, transformManifest);
            onRebuild(result.errors);
          });
        },
      },
    ],
  });
  await ctx.watch();
  return ctx;
}
