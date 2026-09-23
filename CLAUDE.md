# EAA+ — contexto do projeto

Extensão do Chrome (Manifest V3) que melhora, para os alunos da Escola de
Adoração e Arte (EAA / FABAT), duas páginas:

- **Aulas Síncronas**: <https://escoladeadoracaoearte.com.br/aulas-sincronas-graduacao-ead/>
- **AVA (Brightspace)**, página inicial: <https://batistas.brightspace.com/d2l/home>
  (desde a v1.1.0; o aluno já está logado, a extensão usa a sessão dele)

O autor é **aluno** da Licenciatura em Música, não funcionário. **Não tem acesso
ao WordPress da escola** — por isso isto é uma extensão e não uma edição do site.
Projeto independente, sem vínculo oficial com a escola.

Converse em **português**, com respostas **curtas e diretas**. Antes de afirmar
algo sobre a página, a loja ou o Chrome, verifique — não chute.

## Comandos

```bash
npm install                        # uma vez
npx playwright install chromium    # uma vez (navegador dos testes)
npm test                           # 33 testes E2E com a extensão carregada de verdade
npm run check                      # sintaxe + regras do manifest + regra do fetch
npm run build                      # dist/eaa-plus-vX.Y.Z.zip + dist/colar-no-elementor.html
```

Rode `npm test` antes de qualquer `npm run build`. O build roda `check` sozinho.

**Nesta máquina** o Chromium do Playwright não abre dentro de `%LOCALAPPDATA%`
(erro "configuração lado a lado incorreta"; causa não achada). Os navegadores
ficam em `C:\Users\diogo\ms-playwright` via variável de usuário
`PLAYWRIGHT_BROWSERS_PATH`. Shell aberto antes do `setx` não enxerga a variável:
passe na linha de comando.

## Estrutura

```
manifest.json                 MV3, sem "permissions"; 2 content_scripts (escola, AVA)
src/core.js                   EAAPlus.add() / EAAPlus.periodos() — SEMPRE o 1º js
src/features/<nome>.js|.css   uma melhoria por arquivo
src/features/ava-progresso.js/.css progresso nos cards + resumo do prazo (único com fetch)
tests/gerar-fixtures.mjs      gera páginas-réplica (datas relativas ao AGORA)
tests/fixtures-ava.mjs        réplica do AVA (shadow DOM) + respostas da API inventadas
tests/servidor.mjs            servidor das réplicas; /d2l/api/* vem de api.json
tests/navegador.mjs           Chromium com a extensão, compartilhado pelas suítes
tests/extensao.spec.mjs       testes da página de aulas
tests/ava.spec.mjs            testes do AVA
tools/build.mjs               zip da loja + bloco para colar no Elementor
tools/verificar-manifest.mjs  trava regras que afetam a revisão da loja
store/                        imagens da listagem (ícone, promo 440×280, marquee)
GUIA-PUBLICACAO.md            passo a passo do painel da Chrome Web Store
```

## Invariantes — não quebrar sem conversar com o usuário

Cada uma destas mudaria o que precisa ser declarado na aba de Privacidade do
painel e/ou atrasaria a revisão do Google. `verificar-manifest.mjs` cobra várias.

- `matches` restrito a **duas** páginas: aulas síncronas da escola e
  `batistas.brightspace.com/d2l/home` (com e sem `?`). Um bloco por site,
  nunca misturados.
- Nenhuma chave `permissions` / `host_permissions`.
- Zero código remoto: nada de script externo, `eval`, CDN.
- `fetch` só para rotas do próprio `batistas.brightspace.com` (caminho
  relativo, passando por `mesmaOrigem()`), só GET, com a sessão do aluno.
  Nenhum dado sai do navegador. HTML lido com `DOMParser` (não executa nada).
  (Decidido com o usuário em 2026-09-23; ampliado de `/d2l/api/` para
  qualquer rota do AVA no mesmo dia.)
- Ler dado da página **conta como "handling"** para a loja, mesmo só local
  (FAQ do User Data Policy, pergunta 3): declarar "Conteúdo do site" na aba
  Privacidade e ter URL de política de privacidade.
- Zero coleta de dados. Se um dia precisar guardar preferência do aluno,
  `chrome.storage.local` exige declarar a permissão `storage` — avise antes.
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
| `/d2l/lms/quizzing/user/quizzes_list.d2l?ou={ou}` (HTML) | única fonte de "fiz o questionário": tabela `table.d2l-table`, cabeçalho `tr.d_gh` = seção ("Avaliação 1 (Av1) - Primeiro Fechamento"), linha com `onclick="GoToQuiz(id, …)"`, última célula "usadas / permitidas" |

- A Av1 do curso de Música fecha em **duas datas** (2026.2: 28/09 e 26/10,
  23:59), iguais em todas as disciplinas. O card agrupa as atividades por dia
  de prazo e o resumo acima dos cards mostra o fechamento mais próximo.
- Na maioria das disciplinas o questionário **não** é tópico de conteúdo (fica
  como link dentro do HTML do módulo), então `toc`/`myItems` não servem para ele.
- "Feedback: Tentativa em andamento" apareceu só em questionários **já
  corrigidos** na checagem de 2026-09-23 — o estado "iniciada, não enviada"
  só vale quando não há nota. Confirmar com um caso real antes de confiar.
- Nome da disciplina: atributo `text` do `d2l-card`
  ("Técnica Vocal I, Mus_EAD_85284_2026_2_275, 2026.2"); o texto visível
  mora em outro shadow root.

- "Nota AV2" vale **0** até a prova ser lançada: 0 não é resultado.
- Canto Coral e Atividades Extensionistas **não têm Av1/Av2**: um item só
  valendo 10. Ali o bloco mostra "Nota" e nenhuma situação.
- Regra de aprovação (Manual do Aluno EaD 2026, p. 29): Av1 5 + Av2 5; ≥ 6
  aprova; 4 a 6 → Av3; < 4 reprova. Calouros até 06/02/2026: 4 + 4 + fóruns 2.
- Ao inspecionar o AVA, não imprima notas, nomes nem tokens — só estrutura.

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
- Versão publicada: **1.0.0**. Em desenvolvimento: **1.1.0** (branch `v1.1.0`). Toda atualização precisa de `version` maior no
  `manifest.json` e do mesmo lado em `package.json`.
- Textos da listagem e das 4 respostas obrigatórias da aba Privacidade estão em
  `GUIA-PUBLICACAO.md`, seção 5. **A justificativa de host é obrigatória** mesmo
  sem a chave `permissions` — o `matches` conta.
- Ampliar `matches` para outra página = nova revisão do Google. A 1.1.0 amplia
  (AVA) e passa a **ler dados do aluno**: precisa de política de privacidade
  publicada e de "Conteúdo do site" marcado na aba Privacidade.
- Extensão **não funciona no celular** (Chrome Android/iOS não roda extensão).
  A saída é a escola colar `dist/colar-no-elementor.html` no widget 7dfc076.

## Ideias em aberto

- **Seletor de disciplinas** (melhoria #3): o aluno marca o que cursa e a
  próxima aula passa a ser a *dele*. Resolve o problema dos cards multi-período.
  Precisa de persistência → decidir entre `localStorage` da página (sem
  permissão nova) e `chrome.storage` (exige declarar `storage`).
- Planilha de auditoria das 125 sessões para o aluno conferir o calendário com
  a coordenação.
