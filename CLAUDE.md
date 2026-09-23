# EAA+ — contexto do projeto

Extensão do Chrome (Manifest V3) que mostra, para os alunos da Escola de
Adoração e Arte (EAA / FABAT), o progresso e os prazos das avaliações **no AVA
(Brightspace)**: página inicial e **todas as páginas de disciplina**
(`https://batistas.brightspace.com/d2l/*`). O aluno já está logado; a extensão
usa a sessão dele. **O foco é só o AVA.**

O autor é **aluno** da Licenciatura em Música, não funcionário — por isso isto
é uma extensão e não uma mudança no AVA. Projeto independente, sem vínculo
oficial com a escola.

Converse em **português**, com respostas **curtas e diretas**. Antes de afirmar
algo sobre a página, a loja ou o Chrome, verifique — não chute.

**Código em inglês** (variáveis, funções, classes CSS, ids, `data-*`, chaves,
nomes de arquivo, scripts npm). **Comentários, texto de tela, títulos de teste e
mensagens do terminal em português.** Termos do domínio ficam como são: `ou`
(org unit da D2L), `av1`/`av2`/`av3`, `ava`. Convertido em 2026-09-23 a pedido
do usuário.

**TypeScript estrito**, empacotado e minificado pelo esbuild. Nada roda direto
de `src/`: o Chrome carrega a pasta montada (`build/`, `.dev-build/ext`,
`.test-build/ext`), com `content.js`/`content.css`/`background.js`.

**Onde mexer:** regra (o que conta como "perdida", "Precisa de X na Av2"…) →
`src/ava/rules.ts` + teste em `tests/unit/`. Leitura do AVA mudou de formato →
`src/ava/network.ts`. Cor → `src/styles/theme.css`. Desenho de uma tela → a
pasta dela em `src/features/`.

## Comandos

```bash
npm install                        # uma vez
npx playwright install chromium    # uma vez (navegador dos testes)
npm test                           # 31 unitários (regras, <1s) + 49 E2E com a extensão carregada de verdade
npm run test:unit                  # só os unitários das regras (tests/unit/, TypeScript direto no Node)
npm run typecheck                  # tsc estrito (sem gerar arquivos)
npm run dev                        # recarga automática no Chrome (carregar .dev-build/ext uma vez)
npm run check                      # typecheck + regras do manifest + regra do fetch
npm run build                      # check → build/ (extensão montada, minificada) → dist/eaa-plus-vX.Y.Z.zip
npm run policy                     # POLITICA-DE-PRIVACIDADE.md → .policy/eaa-plus-privacidade/index.html
npx vercel deploy .policy/eaa-plus-privacidade --prod   # publica a política (Vercel)
```

Rode `npm test` antes de qualquer `npm run build`. O build roda `check` sozinho.

**Nesta máquina** o Chromium do Playwright não abre dentro de `%LOCALAPPDATA%`
(erro "configuração lado a lado incorreta"; causa não achada). Os navegadores
ficam em `C:\Users\diogo\ms-playwright` via variável de usuário
`PLAYWRIGHT_BROWSERS_PATH`. Shell aberto antes do `setx` não enxerga a variável:
passe na linha de comando.

## Estrutura

```
src/manifest.json              MV3, permissions só ["storage"]; 1 bloco (AVA) → content.js/.css
src/content.ts                 entrada do content script: initCache() + registra as features
src/background.ts              service worker: só libera storage.session ao content script
src/core/registry.ts           registerFeature({ id, init }) — tenta de novo até a página ficar pronta
src/core/dom.ts                findDeep/findAllDeep: busca atravessando shadow DOM
src/ava/types.ts               tipos da API da D2L e do domínio (Activity, DeadlineGroup, CourseSummary…)
src/ava/format.ts              datas (Brasília), números pt-BR, escapeHtml
src/ava/rules.ts               regras PURAS (estados, prazos, Av1/Av2/Av3, situação) — testáveis em Node
src/ava/network.ts             fetch (ÚNICO arquivo com rede) + leitura das páginas HTML do AVA
src/ava/cache.ts               chrome.storage.session (cache entre páginas)
src/ava/course-data.ts         courseData/preview/courseName/restart: junta rede + cache + regras
src/features/home/             página inicial: index.ts (varredura), course-card.ts (feature 1),
                               summary-panel.ts (feature 2), state.ts, card-styles.ts (CSS no shadow)
src/features/course-bar/       feature 3: index.ts, render.ts, layout.ts (posição na faixa azul)
src/features/shared/render.ts  legenda, rótulos dos estados, barra de segmentos
src/styles/                    theme.css (TODAS as cores, --eaa-*), summary-panel.css, course-bar.css
tests/unit/rules.test.ts       unitários das regras (node:test, hora fixa)
tests/generate-fixtures.mjs    monta a extensão MINIFICADA em .test-build/ + gera as réplicas
tests/ava-fixtures.mjs         réplica do AVA (shadow DOM) + respostas da API inventadas
tests/server.mjs               servidor das réplicas; /d2l/api/* vem de api.json
tests/browser.mjs              Chromium com a extensão, compartilhado pelas suítes
tests/ava.spec.mjs             E2E da página inicial
tests/ava-course.spec.mjs      E2E da barra nas páginas de disciplina
tests/ava-cache.spec.mjs       E2E do cache entre páginas (fixture `background` = service worker)
tools/bundle.mjs               esbuild: monta a extensão (usado por build, dev e testes)
tools/build.mjs                zip da loja
tools/dev.mjs                  npm run dev (esbuild watch em .dev-build/ + recarregador)
tools/check-manifest.mjs       trava regras que afetam a revisão da loja
tools/policy.mjs               npm run policy (página da política de privacidade)
tsconfig.json                  só checagem de tipos; "sintaxe apagável" para o Node rodar .ts
store/                         imagens da listagem (promo 440×280, marquee); o gerador
                               tools/generate-images.py fica só local (.gitignore)
GUIA-PUBLICACAO.md             passo a passo do painel da Chrome Web Store
ARQUITETURA.md                 como funciona, passo a passo, e o porquê de cada decisão (para o time técnico)
```

## Invariantes — não quebrar sem conversar com o usuário

Cada uma destas mudaria o que precisa ser declarado na aba de Privacidade do
painel e/ou atrasaria a revisão do Google. `check-manifest.mjs` cobra várias.

- `matches` restrito a `https://batistas.brightspace.com/d2l/*`, num bloco só
  de `content_scripts`. Cada melhoria confere se está na página certa
  (`/d2l/home` exato para os cards; link "Início do Curso" na faixa para a
  barra da disciplina).
- `permissions` só `["storage"]` (2026-09-23, a pedido do usuário, para o
  cache do AVA; não gera aviso na instalação). Nenhuma `host_permissions`.
  APIs do Chrome no código: só `chrome.storage.session` e os eventos
  `runtime.onInstalled/onStartup` do `background.ts` — o verificador cobra.
  Nada de `storage.local`/`sync` (gravaria notas no disco).
- Zero código remoto: nada de script externo, `eval`, CDN. Minificar é
  permitido pela loja (espaços, nomes, juntar arquivos); ofuscar não é.
- `fetch` só para rotas do próprio `batistas.brightspace.com` (caminho
  relativo, passando por `sameOrigin()`, só em `src/ava/network.ts`), só GET,
  com a sessão do aluno.
  Nenhum dado sai do navegador. HTML lido com `DOMParser` (não executa nada).
  (Decidido com o usuário em 2026-09-23; ampliado de `/d2l/api/` para
  qualquer rota do AVA no mesmo dia.)
- Ler dado da página **conta como "handling"** para a loja, mesmo só local
  (FAQ do User Data Policy, pergunta 3): declarar "Conteúdo do site" na aba
  Privacidade e ter URL de política de privacidade.
- Zero coleta de dados. O único armazenamento é o cache do AVA (ver
  "Cache entre páginas"). Guardar preferência do aluno em `storage.local`
  seria gravar no disco e muda a política — avise antes.
- Toda melhoria nova precisa caber no **propósito único** declarado na loja:
  *"Ajudar o aluno da Escola de Adoração e Arte (FABAT) a acompanhar, no AVA
  da instituição, o progresso e os prazos das avaliações de cada disciplina."*
  Coisa de natureza diferente (bloqueador, senhas etc.) = outra extensão.

## Como adicionar uma melhoria

```ts
// src/features/my-feature/index.ts
import type { Feature } from "../../core/registry.ts";

export const myFeature: Feature = {
  id: "my-feature",
  init() {
    const target = document.querySelector(".something");
    if (!target) return false; // o registro observa o DOM por 15s e tenta de novo
    // ... (dados: courseData/preview/courseName de src/ava/course-data.ts)
    return true;
  },
};
```

Registrar em `src/content.ts` (`registerFeature(myFeature)`; CSS novo entra
como `import "./styles/x.css"`), escrever o teste em `tests/ava.spec.mjs` ou
`tests/ava-course.spec.mjs` e, se precisar, ampliar a réplica em
`ava-fixtures.mjs`. Regra nova → `rules.ts` + teste unitário. Imports entre
arquivos .ts levam a extensão `.ts` (o Node precisa, nos unitários).
Uma feature que lança erro é isolada pelo registro (loga `[EAA+] melhoria "x" falhou`).

## Contrato com o AVA (Brightspace) — conferido em 2026-09-23

Cadeia até o card (4 shadow roots — `MutationObserver` não enxerga; por isso a
melhoria varre a cada 1s):
`d2l-my-courses-v2` → `d2l-my-courses-container-v2` → `d2l-tabs > d2l-tab-panel >
d2l-my-courses-content-v2` → `d2l-my-courses-card-grid-v2` →
`d2l-my-courses-enrollment-card#enrollment-card-{orgUnitId}` → `d2l-card`.

| O quê | Onde |
|---|---|
| id da disciplina | `id` do `d2l-my-courses-enrollment-card` |
| onde injetar | filho do `d2l-card` com `slot="content"`, depois de `.d2l-enrollment-card-content-flex` |
| estilo | `<style data-eaa>` dentro do shadow root do enrollment-card (CSS do manifest não atravessa) |

API (`le` 1.99; o servidor aceita 1.0–1.99), tudo GET com a sessão:

| Rota | Para quê |
|---|---|
| `{ou}/grades/` | itens do boletim; `Numeric` = atividades, `Formula` "Nota AV1"/"Nota AV2" |
| `{ou}/grades/values/myGradeValues/` | só itens **já liberados**; liga por `GradeObjectIdentifier` (string) |
| `{ou}/dropbox/folders/` | tarefas: `GradeItemId`, prazo = `DueDate` ou `Availability.EndDate` |
| `{ou}/dropbox/folders/{id}/submissions/mysubmissions/` | enviou sem nota = aguardando |
| `{ou}/quizzes/` | questionários: `GradeItemId`, prazo = `DueDate` ou `EndDate` |
| `{ou}/content/toc` + `{ou}/content/myItems/` | tópico (`GradeItemId`) + `DateCompleted` = feito |
| `{ou}/quizzes/{id}/attempts/` | **403 para aluno** — não usar |
| `/d2l/lms/dropbox/user/folders_list.d2l?ou={ou}&isprv=0` (HTML) | envios de TODAS as tarefas numa leitura: linha de seção `tr.d_ggl2`, link `?db={id}`, 2ª coluna "Não Enviado" / "1 envio, 2 arquivos" (conferido contra a API em 15 tarefas reais) |
| `/d2l/api/lp/1.63/enrollments/myenrollments/?orgUnitTypeId=3` | nomes de todas as disciplinas numa leitura |
| `/d2l/lms/quizzing/user/quizzes_list.d2l?ou={ou}` (HTML) | única fonte de "fiz o questionário": tabela `table.d2l-table`, cabeçalho `tr.d_gh` = seção ("Avaliação 1 (Av1) - Primeiro Fechamento"), linha com `onclick="GoToQuiz(id, …)"`, última célula "usadas / permitidas" |

- **Poucas leituras** (medido em 2026-09-23: página inicial de 86 → 49).
  Toda disciplina: boletim, notas, tarefas, questionários (4). Só se precisar:
  Lista de questionários (se houver questionário), página de tarefas (se houver
  tarefa sem nota), `toc`+`myItems` (se houver atividade avaliada que não é
  tarefa nem questionário), API de envios (só tarefa que não apareceu na
  página). **Erro fica guardado até recarregar** — nunca tentar de novo sozinho:
  a varredura roda a cada segundo e isso já virou 4 leituras/s numa disciplina
  com erro.
- A Av1 do curso de Música fecha em **duas datas** (2026.2: 28/09 e 26/10,
  23:59), iguais em todas as disciplinas. O card agrupa as atividades por dia
  de prazo e o resumo acima dos cards mostra o fechamento mais próximo.
- Na maioria das disciplinas o questionário **não** é tópico de conteúdo (fica
  como link dentro do HTML do módulo), então `toc`/`myItems` não servem para ele.
- **Armadilha:** "Feedback: Tentativa em andamento" na coluna de status é só
  o nome do link de feedback de questionário **já corrigido**. A tentativa
  aberta de verdade é marcada por `<img alt="Há uma tentativa em andamento">`
  na linha do questionário (e aparece "1 / 1", igual a um enviado). A última
  linha da tabela (`td.d_gr`) é a legenda desse ícone. Confirmado com um caso
  real do aluno (Técnica Vocal, 2026-09-23).
- **Nome da disciplina: só pela API** (`/d2l/api/lp/1.63/enrollments/myenrollments/{ou}`
  → `OrgUnit.Name`). O atributo `text` do `d2l-card` já veio "Nome, código,
  semestre" e, no mesmo dia, passou a vir só **"Fechada"** — não usar.
  (`/d2l/api/lp/1.63/courses/{ou}` dá 403 para aluno.)

### Cache entre páginas — decidido e conferido no AVA real em 2026-09-23

O AVA responde `cache-control: no-store` (nem `cache: "force-cache"` reaproveita)
e recarrega a página inteira a cada clique. Sem cache, voltar à página inicial
= 49 leituras de novo. Com cache: 0, ou só a disciplina visitada (5–6).

- `chrome.storage.session` (memória, só a extensão enxerga), chave
  `ava:{ou}` e `ava:names`, validade **10 min**.
- **Página de disciplina sempre lê do servidor** e apaga a disciplina do
  cache ao entrar e no `pagehide` (o aluno pode ter enviado algo ali; o
  questionário pode abrir dentro do Conteúdo sem trocar de URL). O id vem
  da URL (`/d2l/home/{ou}`, `/d2l/le/*/{ou}`, `?ou=`) e do link "Início do Curso".
- Guarda os dados **crus e enxutos** (`slim()` em cache.ts: só os campos que
  `classify`/`summarize` usam; o caminho sem cache passa pelo mesmo corte).
  Prazo vencido etc. é recalculado na hora.
- Só guarda leitura **completa** (`download()` em course-data.ts devolve `complete`).
- Chave com o id do aluno: `html[data-global-context]` → `userId` (DOM
  normal, sem pedido extra). Sem id = sem cache. Id diferente = apaga tudo.
- Resumo mostra "Atualizado às HH:MM" (dado mais antigo) + botão Atualizar:
  esvazia memória e cache (`restart()`) e lê tudo de novo **sem
  recarregar a página** (a pedido do aluno). Resumo volta ao carregamento;
  os blocos dos cards ficam com o dado antigo até o novo chegar (`generation`
  descarta respostas velhas). A leitura do cache espera a limpeza terminar.
- Acesso ao storage sempre por `noStorage()`: área buscada na hora, erro
  síncrono e assíncrono viram "sem cache" + um `console.warn` por página.
- Nos testes, o cache é limpo antes de cada teste (`browser.mjs`).
- `npm run dev`: o manifest de dev tem um service worker só, que faz
  `importScripts("background.js")` antes do recarregador. **Reinicie o
  `npm run dev` depois de mexer em `tools/dev.mjs` ou `tools/bundle.mjs`**
  (o processo antigo continua gerando o manifest velho). Se a extensão de dev
  sumir do AVA depois de mudar a estrutura, recarregue-a à mão em
  `chrome://extensions` (o Chrome a desativa quando uma recarga falha).

### Av2 e Av3 — conferido em 2026-09-23

- As atividades da **Av2 já existem** na maioria das disciplinas (questionário
  e/ou tarefa, às vezes "Parte 1"/"Parte 2", prazos 23/11 ou 01/12). O **item
  de nota delas é oculto** para o aluno: não vem em `{ou}/grades/`. Só a
  fórmula "Nota AV2" é visível (0 até o lançamento).
- A extensão reconhece Av2/Av3 pela seção da Lista de questionários
  ("Avaliação 2 (Av2)", "… (Av3) …") ou pelo nome ("Av2", "Av3",
  "recuperação") e as mostra **sem pontos**, num grupo próprio ("Av2", "Av3").
  Nota da Av2/Av3 lançada → atividades dela viram "corrigida".
- **Av3 é aberta para a turma toda** (ex.: Atividades Extensionistas tem
  "Av3 - Envio de Relatório Final…"). Só aparece para quem está em
  recuperação (Av1 + Av2 lançadas entre 4 e 6) ou para quem já mexeu nela.
- "Precisa de X na Av2" depende só da Av1 estar resolvida.
- O manual **não diz como a Av3 entra na média final**: a extensão só mostra
  "Nota da Av3 · X", sem aprovar/reprovar.
- O manual diz que a Av2 é **presencial**, mas o AVA tem "Atividade Av2"
  online. Pergunta em aberto com o aluno.

- "Nota AV2" vale **0** até a prova ser lançada: 0 não é resultado.
- Canto Coral e Atividades Extensionistas **não têm Av1/Av2**: um item só
  valendo 10. Ali o bloco mostra "Nota" e nenhuma situação.
- Regra de aprovação (Manual do Aluno EaD 2026, p. 29): Av1 5 + Av2 5; ≥ 6
  aprova; 4 a 6 → Av3; < 4 reprova. Calouros até 06/02/2026: 4 + 4 + fóruns 2.
- Ao inspecionar o AVA, não imprima notas, nomes nem tokens — só estrutura.

## Contrato com as páginas de disciplina — conferido em 2026-09-23

Rotas vistas: `/d2l/home/{ou}`, `/d2l/le/lessons/{ou}/…` (Conteúdo),
`/d2l/lms/quizzing/user/quizzes_list.d2l?ou=`, `/d2l/lms/dropbox/…`,
`/d2l/lms/grades/my_grades/main.d2l?ou=`, `/d2l/lms/news/…`,
`/d2l/lms/classlist/…`. Todas têm a mesma faixa:

| O quê | Onde |
|---|---|
| faixa da disciplina | `nav.d2l-navigation-s` (position:relative) → `d2l-labs-navigation` → `d2l-labs-navigation-main-footer` (azul `rgb(0,48,84)`, 62px) |
| alinhamento | `.d2l-labs-navigation-centerer` no shadow do footer (máx. 1230px, padding 0 30px) |
| id da disciplina | link `a[href="/d2l/home/{ou}"]` ("Início do Curso"), DOM normal |
| links do AVA | no DOM normal do footer; terminam ~x=864 com a janela em 1496px |

- **Conteúdo é um app com altura fixa pela janela**: inserir qualquer coisa no
  fluxo empurra a aula para fora da tela (testado: +45px de rolagem). Por isso
  a barra é `position:absolute` DENTRO da faixa, alinhada à direita.
- Links das atividades: tarefa `/d2l/lms/dropbox/user/folder_submit_files.d2l?db={id}&grpid=0&isprv=0&bp=0&ou={ou}`;
  questionário `/d2l/lms/quizzing/user/quiz_summary.d2l?ou={ou}&qi={id}&cfql=1`.

## Armadilhas conhecidas (todas já custaram tempo)

1. **CSS do AVA contra botões injetados.** Algumas rotas do AVA dão padding,
   borda e fonte próprios a todo `<button>`. **Todo `<button>` injetado precisa
   de `padding` explícito** (e margem, borda, fonte). O teste *"resiste ao CSS
   do AVA"* cobre — e só cobre porque a réplica carrega esse CSS hostil.

2. **Réplica limpa esconde bug.** Por causa do item 1, as réplicas de teste
   carregam de propósito o CSS hostil (`HOSTILE_CSS` em `ava-fixtures.mjs`).
   Ao criar réplica nova, mantenha.

3. **Não dá para falsificar o relógio.** Content script roda em mundo isolado;
   sobrescrever `Date` pela página não afeta a extensão. Teste de horário nos
   E2E = gerar datas relativas ao agora (é o que `ava-fixtures.mjs` faz). Nos
   unitários, as regras recebem `now` fixo.

4. **Fuso.** Prazos do AVA são mostrados em Brasília. A conversão usa `Intl`
   com `America/Sao_Paulo`, nunca o fuso do computador do aluno.

5. **O AVA renderiza tarde.** Os componentes aparecem depois do
   `document_idle` — por isso `init` pode retornar `false`, e os cards (dentro
   de shadow DOM) são procurados a cada segundo.

6. **Dois Chromes conectados ao Claude in Chrome.** O logado no AVA é o
   "Browser 1". O outro cai na tela de login.

## Publicação — estado atual

- Chrome Web Store, conta do aluno. **Ainda não publicada**: a versão 1.0.0
  (só AVA) será a primeira, como item novo. `dist/eaa-plus-v1.0.0.zip` pronto;
  falta o aluno subir e preencher o painel (GUIA). Ele só disponibiliza para a
  turma com autorização da instituição (pedido feito à coordenação em
  2026-09-23).
- Visibilidade recomendada: **não listado** (só instala quem tem o link).
- Toda atualização precisa de `version` maior no `manifest.json` e do mesmo
  lado em `package.json`.
- Política de privacidade publicada em <https://eaa-plus-privacidade.vercel.app/>
  (Vercel, conta `dihsantanna`, projeto `eaa-plus-privacidade`; gerada de
  `POLITICA-DE-PRIVACIDADE.md` por `npm run policy`). Contato público:
  diogosantanna08@gmail.com.
- Textos da listagem e das respostas obrigatórias da aba Privacidade estão em
  `GUIA-PUBLICACAO.md`, seção 5. **A justificativa de host é obrigatória** mesmo
  sem `host_permissions` — o `matches` conta. A de `storage` também (5.2.1).
- Ampliar `matches` para outro site = nova revisão do Google e o Chrome pede
  ao usuário que aceite o novo acesso.
- Extensão **não funciona no celular** (Chrome Android/iOS não roda extensão).
