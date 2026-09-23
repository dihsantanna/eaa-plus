/* Prepara o ambiente de teste (roda uma vez antes da suíte):
 *
 * 1. Copia a extensão para .test-build/ext trocando o `matches` para localhost.
 * 2. Gera páginas-réplica da página real em .test-build/site.
 * 3. Gera a réplica do AVA e as respostas da API (ver fixtures-ava.mjs).
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
import { gerarAva } from "./fixtures-ava.mjs";

const RAIZ = ".test-build";

export default function gerar() {
  rmSync(RAIZ, { recursive: true, force: true });
  mkdirSync(`${RAIZ}/site`, { recursive: true });

  /* ---------- extensão apontando para localhost ---------- */
  mkdirSync(`${RAIZ}/ext`, { recursive: true });
  cpSync("src", `${RAIZ}/ext/src`, { recursive: true });
  cpSync("icons", `${RAIZ}/ext/icons`, { recursive: true });
  const m = JSON.parse(readFileSync("manifest.json", "utf8"));
  /* Cada bloco continua só na sua página: a escola em tudo menos /d2l/,
     o AVA só na réplica da página inicial. */
  for (const cs of m.content_scripts) {
    if (cs.matches.some((p) => p.includes("brightspace.com"))) {
      cs.matches = ["http://localhost/d2l/home*", "http://127.0.0.1/d2l/home*"];
    } else {
      cs.matches = ["http://localhost/*", "http://127.0.0.1/*"];
      cs.exclude_matches = ["http://localhost/d2l/*", "http://127.0.0.1/d2l/*"];
    }
  }
  writeFileSync(`${RAIZ}/ext/manifest.json`, JSON.stringify(m, null, 2));

  /* ---------- réplica do AVA (Brightspace) ---------- */
  gerarAva(RAIZ);

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
  const diaSemana = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
  });
  const parede = (d) => {
    const p = {};
    for (const x of fmt.formatToParts(d)) p[x.type] = x.value;
    if (p.hour === "24") p.hour = "00";
    return p;
  };

  /** Linha da tabela começando `min` minutos a partir de agora. */
  const linha = (min, duracao = 60) => {
    const ini = new Date(Date.now() + min * 60000);
    const fim = new Date(ini.getTime() + duracao * 60000);
    const a = parede(ini);
    const b = parede(fim);
    const dia = diaSemana.format(ini);
    return [
      `${a.day}/${a.month}/${a.year}`,
      dia.charAt(0).toUpperCase() + dia.slice(1),
      `${a.hour}:${a.minute} às ${b.hour}:${b.minute}`,
    ];
  };

  /* ---------- estrutura igual à da página real ---------- */
  const card = (nome, prof, periodo, cor, linhas, comLink = true) => `
<article class="card" style="--accent-color: ${cor};">
  <div class="card-head">
    <div class="initial">${nome[0]}</div>
    <div class="head-text">
      <p class="discipline">${nome}</p>
      <div class="meta"><span>${prof}</span><span class="period-tag">${periodo}</span><span>${linhas.length} aulas</span></div>
    </div>
    <div class="head-actions">${
      comLink
        ? '<a class="btn-link" href="https://meet.example.com/teste" target="_blank" rel="noopener noreferrer">Entrar na aula</a>'
        : '<span class="btn-link-off">Link a confirmar</span>'
    }</div>
  </div>
  <div class="card-body"><div class="card-body-inner"><table>
    <thead><tr><th>Data</th><th>Dia da semana</th><th>Horário</th></tr></thead>
    <tbody>${linhas
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

  const pagina = (corpo) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Réplica</title><style>${CSS}</style></head>
<body>${corpo}</body></html>`;

  const escrever = (nome, html) => writeFileSync(`${RAIZ}/site/${nome}.html`, html);

  /* Todos os formatos de etiqueta de período que existem na página real. */
  escrever(
    "periodos",
    pagina(wrap([
      card("Canto Coral", "Prof. A", "1º ao 4º período", "#6E1F26", [linha(60 * 24)]),
      card("Estudo Dirigido", "Prof. B", "4º período", "#223A5E", [linha(60 * 25)]),
      card("Projetos Sociais", "Prof. C", "3º e 4º período", "#5B3A6E", [linha(60 * 26)]),
      card("Tecnologia", "Prof. D", "1º, 2º e 3º períodos", "#285C58", [linha(60 * 27)]),
      card("Flauta Doce", "Prof. E", "2º ao 4º período", "#B4892E", [linha(60 * 28)]),
      card("Técnica Vocal I", "Prof. F", "1º período", "#5A6B2E", [linha(60 * 29)]),
      ...Array.from({ length: 20 }, (_, i) =>
        card(`Disciplina ${i + 1}`, "Prof. X", "2º período", "#6E1F26", [linha(60 * (30 + i))])
      ),
    ]))
  );

  escrever(
    "futuro",
    pagina(wrap([
      card("Orquestrando Saberes", "Profa. Joyce", "1º período", "#5A6B2E", [linha(55)]),
      card("Estudo Dirigido", "Prof. Leandro", "4º período", "#223A5E", [linha(180)]),
      card("Ensaio Canto Coral", "Profa. Rosângela", "1º ao 4º período", "#5B3A6E", [linha(300)], false),
    ]))
  );

  escrever(
    "ao-vivo",
    pagina(wrap([
      card("Louvor e Adoração", "Profa. Mariane", "1º período", "#B4892E", [linha(-12)]),
      card("Estudo Dirigido", "Prof. Leandro", "4º período", "#223A5E", [linha(180)]),
    ]))
  );

  escrever(
    "sem-link",
    pagina(wrap([card("Ensaio Canto Coral", "Profa. Rosângela", "1º ao 4º período", "#5B3A6E", [linha(40)], false)]))
  );

  escrever(
    "passado",
    pagina(wrap([card("Canto Coral", "Prof. Samuel", "1º ao 4º período", "#6E1F26", [linha(-60 * 24 * 5)])]))
  );

  /* Duas aulas começando no MESMO minuto: o caso real que motivou as setas.
     A linha é calculada uma vez só para as duas ficarem idênticas mesmo se o
     relógio virar o minuto entre uma chamada e outra. */
  const mesmoHorario = linha(40);
  escrever(
    "choque",
    pagina(wrap([
      card("Projetos Sociais", "Prof. A", "3º e 4º período", "#5B3A6E", [mesmoHorario]),
      card("Tecnologia aplicada à música", "Profa. B", "1º, 2º e 3º períodos", "#223A5E", [mesmoHorario]),
      card("História da Música I", "Prof. C", "3º período", "#285C58", [linha(180)]),
    ]))
  );

  /* Widget do Elementor que renderiza depois do document_idle. */
  const conteudoTardio = JSON.stringify(
    wrap([card("Canto Coral", "Prof. A", "1º ao 4º período", "#6E1F26", [linha(90)])])
  );
  escrever(
    "tardio",
    pagina(
      `<div id="host"></div><script>setTimeout(function(){document.getElementById("host").innerHTML=${conteudoTardio};},2000);</script>`
    )
  );
}
