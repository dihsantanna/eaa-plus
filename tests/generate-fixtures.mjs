/* Prepara o ambiente de teste (roda uma vez antes da suíte):
 *
 * 1. Copia a extensão para .test-build/ext trocando o `matches` para localhost.
 * 2. Gera páginas-réplica da página real em .test-build/site.
 * 3. Gera a réplica do AVA e as respostas da API (ver ava-fixtures.mjs).
 *
 * Por que gerar na hora: o card de próxima aula depende do relógio. Content
 * scripts rodam num "mundo isolado" do Chrome, então NÃO dá para falsificar o
 * Date pela página. O jeito confiável é escrever as datas relativas ao agora.
 *
 * Por que o CSS hostil: as setas do card já sumiram em produção porque o tema
 * do site tem `button { padding: 11px 25px }` com box-sizing border-box. Uma
 * réplica com CSS limpo nunca pegaria isso. As regras abaixo foram copiadas
 * do tema real (Eduma/Elementor) e NÃO devem ser removidas.
 */

import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { generateAva } from "./ava-fixtures.mjs";

const ROOT = ".test-build";

export default function generate() {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(`${ROOT}/site`, { recursive: true });

  /* ---------- extensão apontando para localhost ---------- */
  mkdirSync(`${ROOT}/ext`, { recursive: true });
  cpSync("src", `${ROOT}/ext/src`, { recursive: true });
  cpSync("icons", `${ROOT}/ext/icons`, { recursive: true });
  const m = JSON.parse(readFileSync("manifest.json", "utf8"));
  /* Cada bloco continua só na sua página: a escola em tudo menos /d2l/,
     o AVA só na réplica da página inicial. */
  for (const cs of m.content_scripts) {
    if (cs.matches.some((p) => p.includes("brightspace.com"))) {
      cs.matches = ["http://localhost/d2l/*", "http://127.0.0.1/d2l/*"];
    } else {
      cs.matches = ["http://localhost/*", "http://127.0.0.1/*"];
      cs.exclude_matches = ["http://localhost/d2l/*", "http://127.0.0.1/d2l/*"];
    }
  }
  writeFileSync(`${ROOT}/ext/manifest.json`, JSON.stringify(m, null, 2));

  /* ---------- réplica do AVA (Brightspace) ---------- */
  generateAva(ROOT);

  /* ---------- datas no fuso de Brasília ---------- */
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const dayName = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  });
  const wall = (d) => {
    const p = {};
    for (const x of fmt.formatToParts(d)) p[x.type] = x.value;
    if (p.hour === "24") p.hour = "00";
    return p;
  };

  /** Linha da tabela começando `min` minutos a partir de agora. */
  const row = (min, duration = 60) => {
    const startAt = new Date(Date.now() + min * 60000);
    const end = new Date(startAt.getTime() + duration * 60000);
    const a = wall(startAt);
    const b = wall(end);
    const day = dayName.format(startAt);
    return [
      `${a.day}/${a.month}/${a.year}`,
      day.charAt(0).toUpperCase() + day.slice(1),
      `${a.hour}:${a.minute} às ${b.hour}:${b.minute}`,
    ];
  };

  /* ---------- estrutura igual à da página real ---------- */
  const card = (name, depth, period, color, rows, withLink = true) => `
<article class="card" style="--accent-color: ${color};">
  <div class="card-head">
    <div class="initial">${name[0]}</div>
    <div class="head-text">
      <p class="discipline">${name}</p>
      <div class="meta"><span>${depth}</span><span class="period-tag">${period}</span><span>${rows.length} aulas</span></div>
    </div>
    <div class="head-actions">${
      withLink
        ? '<a class="btn-link" href="https://meet.example.com/teste" target="_blank" rel="noopener noreferrer">Entrar na aula</a>'
        : '<span class="btn-link-off">Link a confirmar</span>'
    }</div>
  </div>
  <div class="card-body"><div class="card-body-inner"><table>
    <thead><tr><th>Data</th><th>Dia da semana</th><th>Horário</th></tr></thead>
    <tbody>${rows
      .map((l) => `<tr><td>${l[0]}</td><td><span class="day-tag">${l[1]}</span></td><td>${l[2]}</td></tr>`)
      .join("")}</tbody>
  </table></div></div>
</article>`;

  const CSS = `
:root{--parchment:#F4EEDD;--ink:#241E14;--ink-soft:#58503f;--brass:#B4892E;--burgundy:#6E1F26;--line:rgba(36,30,20,.16);--shadow:0 10px 30px rgba(36,30,20,.10)}
body{background:var(--parchment);font-family:sans-serif;margin:0;color:var(--ink)}
.wrap{max-width:920px;margin:0 auto;padding:24px}
.card{background:#FBF8EF;border-radius:14px;border-left:5px solid var(--accent-color);padding:16px;margin-bottom:12px}
.card-body{display:none}
.card-head{display:flex;align-items:center;gap:14px}.head-text{flex:1}
.btn-link{background:var(--accent-color);color:#fff;padding:9px 16px;border-radius:100px;text-decoration:none}

/* ===== regras REAIS do tema do site — não remover (ver cabeçalho) =====
   A ORDEM importa e foi copiada da página real: a última regra que atinge
   <button> é a de 11px 25px, e é ela que vence. Com 25px de cada lado, um
   botão de 28px vira 50px e o ícone some. Se a ordem for invertida, vence a
   de 9px 10px, o bug fica mascarado e o teste de regressão passa à toa. */
*,::after,::before{box-sizing:border-box;padding:0}
input,button,select,textarea{padding:9px 10px}
input[type="submit"],button{padding:11px 25px}
`;

  const wrap = (cards) => `
<div class="wrap">
  <header>
    <div class="seal">Prévia do semestre</div>
    <h1>Aulas Síncronas</h1>
    <p class="instructions">Acesse o link da aula com o <strong>e-mail institucional</strong></p>
  </header>
  <main class="list">${cards.join("")}</main>
  <footer></footer>
</div>`;

  const page = (body) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Réplica</title><style>${CSS}</style></head>
<body>${body}</body></html>`;

  const write = (name, html) => writeFileSync(`${ROOT}/site/${name}.html`, html);

  /* Todos os formatos de etiqueta de período que existem na página real. */
  write(
    "periods",
    page(wrap([
      card("Canto Coral", "Prof. A", "1º ao 4º período", "#6E1F26", [row(60 * 24)]),
      card("Estudo Dirigido", "Prof. B", "4º período", "#223A5E", [row(60 * 25)]),
      card("Projetos Sociais", "Prof. C", "3º e 4º período", "#5B3A6E", [row(60 * 26)]),
      card("Tecnologia", "Prof. D", "1º, 2º e 3º períodos", "#285C58", [row(60 * 27)]),
      card("Flauta Doce", "Prof. E", "2º ao 4º período", "#B4892E", [row(60 * 28)]),
      card("Técnica Vocal I", "Prof. F", "1º período", "#5A6B2E", [row(60 * 29)]),
      ...Array.from({ length: 20 }, (_, i) =>
        card(`Disciplina ${i + 1}`, "Prof. X", "2º período", "#6E1F26", [row(60 * (30 + i))])
      ),
    ]))
  );

  write(
    "future",
    page(wrap([
      card("Orquestrando Saberes", "Profa. Joyce", "1º período", "#5A6B2E", [row(55)]),
      card("Estudo Dirigido", "Prof. Leandro", "4º período", "#223A5E", [row(180)]),
      card("Ensaio Canto Coral", "Profa. Rosângela", "1º ao 4º período", "#5B3A6E", [row(300)], false),
    ]))
  );

  write(
    "live",
    page(wrap([
      card("Louvor e Adoração", "Profa. Mariane", "1º período", "#B4892E", [row(-12)]),
      card("Estudo Dirigido", "Prof. Leandro", "4º período", "#223A5E", [row(180)]),
    ]))
  );

  write(
    "no-link",
    page(wrap([card("Ensaio Canto Coral", "Profa. Rosângela", "1º ao 4º período", "#5B3A6E", [row(40)], false)]))
  );

  write(
    "past",
    page(wrap([card("Canto Coral", "Prof. Samuel", "1º ao 4º período", "#6E1F26", [row(-60 * 24 * 5)])]))
  );

  /* Duas aulas começando no MESMO minuto: o caso real que motivou as setas.
     A linha é calculada uma vez só para as duas ficarem idênticas mesmo se o
     relógio virar o minuto entre uma chamada e outra. */
  const sameTime = row(40);
  write(
    "clash",
    page(wrap([
      card("Projetos Sociais", "Prof. A", "3º e 4º período", "#5B3A6E", [sameTime]),
      card("Tecnologia aplicada à música", "Profa. B", "1º, 2º e 3º períodos", "#223A5E", [sameTime]),
      card("História da Música I", "Prof. C", "3º período", "#285C58", [row(180)]),
    ]))
  );

  /* Widget do Elementor que renderiza depois do document_idle. */
  const lateContent = JSON.stringify(
    wrap([card("Canto Coral", "Prof. A", "1º ao 4º período", "#6E1F26", [row(90)])])
  );
  write(
    "late",
    page(
      `<div id="host"></div><script>setTimeout(function(){document.getElementById("host").innerHTML=${lateContent};},2000);</script>`
    )
  );
}
