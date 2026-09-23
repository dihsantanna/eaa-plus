# EAA+ — contexto do projeto

Extensão do Chrome (Manifest V3) que melhora, para os alunos da Escola de
Adoração e Arte (EAA / FABAT), duas páginas:

- **Aulas Síncronas**: <https://escoladeadoracaoearte.com.br/aulas-sincronas-graduacao-ead/>
- **AVA (Brightspace)**: página inicial e **todas as páginas de disciplina**
  (`https://batistas.brightspace.com/d2l/*`, desde a v1.1.0; o aluno já está
  logado, a extensão usa a sessão dele)

O autor é **aluno** da Licenciatura em Música, não funcionário. **Não tem acesso
ao WordPress da escola** — por isso isto é uma extensão e não uma edição do site.
Projeto independente, sem vínculo oficial com a escola.

Converse em **português**, com respostas **curtas e diretas**. Antes de afirmar
algo sobre a página, a loja ou o Chrome, verifique — não chute.

## Comandos

```bash
npm install                        # uma vez
npx playwright install chromium    # uma vez (navegador dos testes)
npm test                           # 66 testes E2E com a extensão carregada de verdade
npm run dev                        # recarga automática no Chrome (carregar .dev-build/ext uma vez)
npm run check                      # sintaxe + regras do manifest + regra do fetch
npm run build                      # dist/eaa-plus-vX.Y.Z.zip + dist/colar-no-elementor.html
npm run politica                   # POLITICA-DE-PRIVACIDADE.md → .politica/eaa-plus-privacidade/index.html
npx vercel deploy .politica/eaa-plus-privacidade --prod   # publica a política (Vercel)
```

Rode `npm test` antes de qualquer `npm run build`. O build roda `check` sozinho.

**Nesta máquina** o Chromium do Playwright não abre dentro de `%LOCALAPPDATA%`
(erro "configuração lado a lado incorreta"; causa não achada). Os navegadores
ficam em `C:\Users\diogo\ms-playwright` via variável de usuário
`PLAYWRIGHT_BROWSERS_PATH`. Shell aberto antes do `setx` não enxerga a variável:
passe na linha de comando.

## Estrutura

```
manifest.json                 MV3, permissions só ["storage"]; 2 content_scripts (escola, AVA)
src/core.js                   EAAPlus.add() / EAAPlus.periodos() — SEMPRE o 1º js
src/fundo.js                  service worker: só libera storage.session aos content scripts
src/ava-dados.js              EAAPlus.ava: dados, regras e cache do AVA (ÚNICO arquivo com fetch)
src/features/<nome>.js|.css   uma melhoria por arquivo
src/features/ava-progresso.*  página inicial do AVA: progresso nos cards + resumo do prazo
src/features/ava-disciplina.* páginas de disciplina: barra na faixa azul + painel
tests/gerar-fixtures.mjs      gera páginas-réplica (datas relativas ao AGORA)
tests/fixtures-ava.mjs        réplica do AVA (shadow DOM) + respostas da API inventadas
tests/servidor.mjs            servidor das réplicas; /d2l/api/* vem de api.json
tests/navegador.mjs           Chromium com a extensão, compartilhado pelas suítes
tests/extensao.spec.mjs       testes da página de aulas
tests/ava.spec.mjs            testes do AVA (página inicial)
tests/ava-disciplina.spec.mjs testes da barra nas páginas de disciplina
tests/ava-cache.spec.mjs      testes do cache entre páginas (fixture `fundo` = service worker)
tools/dev.mjs                 npm run dev (cópia em .dev-build/ com recarregador)
tools/build.mjs               zip da loja + bloco para colar no Elementor
tools/verificar-manifest.mjs  trava regras que afetam a revisão da loja
store/                        imagens da listagem (ícone, promo 440×280, marquee)
GUIA-PUBLICACAO.md            passo a passo do painel da Chrome Web Store
```

## Invariantes — não quebrar sem conversar com o usuário

Cada uma destas mudaria o que precisa ser declarado na aba de Privacidade do
painel e/ou atrasaria a revisão do Google. `verificar-manifest.mjs` cobra várias.

- `matches` restrito a dois lugares: a página de aulas síncronas da escola e
  `https://batistas.brightspace.com/d2l/*` (ampliado de `/d2l/home` em
  2026-09-23, a pedido do usuário, para a barra das páginas de disciplina).
  Um bloco por site, nunca misturados. Cada melhoria do AVA confere se está
  na página certa (`/d2l/home` exato para os cards; link "Início do Curso"
  na faixa para a barra da disciplina).
- `permissions` só `["storage"]` (2026-09-23, a pedido do usuário, para o
  cache do AVA; não gera aviso na instalação). Nenhuma `host_permissions`.
  APIs do Chrome no código: só `chrome.storage.session` e os eventos
  `runtime.onInstalled/onStartup` do `fundo.js` — o verificador cobra.
  Nada de `storage.local`/`sync` (gravaria notas no disco).
- Zero código remoto: nada de script externo, `eval`, CDN.
- `fetch` só para rotas do próprio `batistas.brightspace.com` (caminho
  relativo, passando por `mesmaOrigem()`), só GET, com a sessão do aluno.
  Nenhum dado sai do navegador. HTML lido com `DOMParser` (não executa nada).
  (Decidido com o usuário em 2026-09-23; ampliado de `/d2l/api/` para
  qualquer rota do AVA no mesmo dia.)
- Ler dado da página **conta como "handling"** para a loja, mesmo só local
  (FAQ do User Data Policy, pergunta 3): declarar "Conteúdo do site" na aba
  Privacidade e ter URL de política de privacidade.
- Zero coleta de dados. O único armazenamento é o cache do AVA (ver
  "Cache entre páginas"). Guardar preferência do aluno em `storage.local`
  seria gravar no disco e muda a política — avise antes.
- Toda melhoria nova precisa caber no **propósito único** declarado na loja.
  Até a v1.0.0: *"Melhorar a usabilidade da página de aulas síncronas da EAA
  para os alunos."* A partir da v1.1.0 precisa ser reescrito para cobrir o AVA
  (texto proposto em `GUIA-PUBLICACAO.md`).
  Coisa de natureza diferente (bloqueador, senhas etc.) = outra extensão.

## Como adicionar uma melhoria

```js
EAAPlus.add({
  id: "nome-da-melhoria",
  init: function () {
    var alvo = document.querySelector(".algo");
    if (!alvo) return false; // núcleo observa o DOM por 15s e tenta de novo
    // ...
    return true;
  }
});
```

Registrar em `manifest.json` (depois de `src/core.js`, no bloco do site
certo), escrever o teste em `tests/extensao.spec.mjs` ou `tests/ava.spec.mjs` e,
se precisar, uma réplica em `gerar-fixtures.mjs` / `fixtures-ava.mjs`.
Uma melhoria que lança erro é isolada pelo núcleo (loga `[EAA+] melhoria "x" falhou`).

## Contrato com o DOM da página de aulas

A página é um bloco de HTML colado num **widget HTML do Elementor**
(página WordPress **31604**, widget **7dfc076**). Seletores usados:

| Seletor | O que é |
|---|---|
| `.wrap header .instructions` | âncora; as abas entram depois do `header` |
| `main.list > .card` | um card por disciplina (19 no semestre 2026.2) |
| `.card[style*="--accent-color"]` | cor da disciplina (o card de próxima aula herda) |
| `.discipline` | nome |
| `.meta span` (1º) | professor |
| `.period-tag` | período: `"1º período"`, `"3º e 4º período"`, `"1º, 2º e 3º períodos"`, `"1º ao 4º período"` |
| `a.btn-link` | link da aula; sem ele = "Link a confirmar" |
| `tbody tr` → 3 `td` | `dd/mm/aaaa` · dia da semana · `HH:MM às HH:MM` |
| `#masthead` | menu fixo do tema Eduma (aparece/some com transform + classe `menu-hidden`) |

Tokens do site reaproveitados no CSS: `--burgundy`, `--ink`, `--ink-soft`,
`--line`, `--parchment`, `--shadow` (sempre com fallback).

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
  `ava:{ou}` e `ava:nomes`, validade **10 min**.
- **Página de disciplina sempre lê do servidor** e apaga a disciplina do
  cache ao entrar e no `pagehide` (o aluno pode ter enviado algo ali; o
  questionário pode abrir dentro do Conteúdo sem trocar de URL). O id vem
  da URL (`/d2l/home/{ou}`, `/d2l/le/*/{ou}`, `?ou=`) e do link "Início do Curso".
- Guarda os dados **crus e enxutos** (`enxugar()`: só os campos que
  `classificar`/`resumir` usam; o caminho sem cache passa pelo mesmo corte).
  Prazo vencido etc. é recalculado na hora.
- Só guarda leitura **completa** (`baixar()` devolve `completo`).
- Chave com o id do aluno: `html[data-global-context]` → `userId` (DOM
  normal, sem pedido extra). Sem id = sem cache. Id diferente = apaga tudo.
- Resumo mostra "Atualizado às HH:MM" (dado mais antigo) + botão Atualizar:
  esvazia memória e cache (`A.recomecar()`) e lê tudo de novo **sem
  recarregar a página** (a pedido do aluno). Resumo volta ao carregamento;
  os blocos dos cards ficam com o dado antigo até o novo chegar (`geracao`
  descarta respostas velhas). A leitura do cache espera a limpeza terminar.
- Acesso ao storage sempre por `noStorage()`: área buscada na hora, erro
  síncrono e assíncrono viram "sem cache" + um `console.warn` por página.
- Nos testes, o cache é limpo antes de cada teste (`navegador.mjs`).
- `npm run dev`: o manifest de dev tem um service worker só, que faz
  `importScripts("src/fundo.js")` antes do recarregador. **Reinicie o
  `npm run dev` depois de mexer em `tools/dev.mjs`** (o processo antigo
  continua gerando o manifest velho).

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

1. **CSS do tema contra botões injetados.** O tema aplica
   `button { padding: 11px 25px }` com `box-sizing: border-box`. Um botão de
   28px vira 50px e o ícone some. **Todo `<button>` injetado precisa de
   `padding: 0` explícito.** Isso chegou a produção. O teste
   *"ícones com tamanho real mesmo com o CSS do tema"* cobre — e só cobre porque
   a réplica tem as regras do tema **na mesma ordem** do site real. Não reordene.

2. **Réplica limpa esconde bug.** Por causa do item 1, as réplicas de teste
   carregam de propósito o CSS hostil do tema. Ao criar réplica nova, mantenha.

3. **Não dá para falsificar o relógio.** Content script roda em mundo isolado;
   sobrescrever `Date` pela página não afeta a extensão. Teste de horário =
   gerar datas relativas ao agora (é o que `gerar-fixtures.mjs` faz).

4. **Fuso.** Horários da página são de Brasília. A conversão usa
   `Intl` com `America/Sao_Paulo`, nunca o fuso do computador do aluno.

5. **Menu do site.** O `#masthead` entra e sai com animação e reage também a
   movimento do mouse, não só rolagem. A barra de abas acompanha via `rAF` por
   800ms depois de cada evento + `MutationObserver` na classe. Sem isso ela
   fica atrás do menu ou com um vão.

6. **Widget renderiza tarde.** Às vezes o conteúdo aparece depois do
   `document_idle` — por isso `init` pode retornar `false`.

7. **Link do Meet vem com token na URL.** Ao inspecionar a página, não imprima
   `href` completos.

8. **Dois Chromes conectados ao Claude in Chrome.** O logado no AVA é o
   "Browser 1". O outro cai na tela de login.

## Peculiaridades dos dados da página (semestre 2026.2)

- 125 sessões, 0 falhas de leitura na última checagem.
- **Não existe período por sessão**, só por disciplina. 7 dos 19 cards são
  multi-período (40 sessões), e cada sessão deles aparece em todas as abas da faixa.
- **5 choques de horário exato** ainda por vir (motivo das setas `‹ 1/N ›`).
  Nenhuma sobreposição parcial.
- Suspeita de dado errado no calendário publicado: *Orquestrando Saberes*,
  24/08/2026 19h e 20h — o aluno afirma que não houve aula. A extensão só
  espelha a página; erro de dado é da fonte.
- A página se chama "PRÉVIA DO SEMESTRE" — pode mudar sem aviso.

## Publicação — estado atual

- Chrome Web Store, conta do aluno, item `lmhfgcgecilhocmpfflgkocpgepcijpo`.
- Visibilidade: **não listado** (só instala quem tem o link).
- Versão publicada: **1.0.0**. **1.1.0** na `main` (PR #1 mesclado em
  2026-09-23; `dist/eaa-plus-v1.1.0.zip` gerado), aguardando o aluno subir
  o pacote e a revisão da loja. Toda atualização precisa de `version` maior no
  `manifest.json` e do mesmo lado em `package.json`.
- Política de privacidade publicada em <https://eaa-plus-privacidade.vercel.app/>
  (Vercel, conta `dihsantanna`, projeto `eaa-plus-privacidade`; gerada de
  `POLITICA-DE-PRIVACIDADE.md` por `npm run politica`). Contato público:
  diogosantanna08@gmail.com.
- Textos da listagem e das 4 respostas obrigatórias da aba Privacidade estão em
  `GUIA-PUBLICACAO.md`, seção 5. **A justificativa de host é obrigatória** mesmo
  sem a chave `permissions` — o `matches` conta.
- Ampliar `matches` para outra página = nova revisão do Google. A 1.1.0 amplia
  (AVA, `/d2l/*`), passa a **ler dados do aluno** e declara `storage`:
  precisa de política de privacidade publicada, de "Conteúdo do site" marcado
  na aba Privacidade e da justificativa de `storage` (GUIA, seção 5.2.1).
- Extensão **não funciona no celular** (Chrome Android/iOS não roda extensão).
  A saída é a escola colar `dist/colar-no-elementor.html` no widget 7dfc076.

## Ideias em aberto

- **Seletor de disciplinas** (melhoria #3): o aluno marca o que cursa e a
  próxima aula passa a ser a *dele*. Resolve o problema dos cards multi-período.
  Precisa de persistência → decidir entre `localStorage` da página (sem
  permissão nova) e `chrome.storage` (exige declarar `storage`).
- Planilha de auditoria das 125 sessões para o aluno conferir o calendário com
  a coordenação.
