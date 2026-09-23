# EAA+ — contexto do projeto

Extensão do Chrome (Manifest V3) que melhora a página de **Aulas Síncronas** da
Escola de Adoração e Arte (EAA / FABAT):
<https://escoladeadoracaoearte.com.br/aulas-sincronas-graduacao-ead/>

O autor é **aluno** da Licenciatura em Música, não funcionário. **Não tem acesso
ao WordPress da escola** — por isso isto é uma extensão e não uma edição do site.
Projeto independente, sem vínculo oficial com a escola.

Converse em **português**, com respostas **curtas e diretas**. Antes de afirmar
algo sobre a página, a loja ou o Chrome, verifique — não chute.

## Comandos

```bash
npm install                        # uma vez
npx playwright install chromium    # uma vez (navegador dos testes)
npm test                           # 17 testes E2E com a extensão carregada de verdade
npm run check                      # sintaxe + regras do manifest
npm run build                      # dist/eaa-plus-vX.Y.Z.zip + dist/colar-no-elementor.html
```

Rode `npm test` antes de qualquer `npm run build`. O build roda `check` sozinho.

## Estrutura

```
manifest.json                 MV3, sem "permissions"; 1 content_script, 1 URL
src/core.js                   EAAPlus.add() / EAAPlus.periodos() — SEMPRE o 1º js
src/features/<nome>.js|.css   uma melhoria por arquivo
tests/gerar-fixtures.mjs      gera páginas-réplica (datas relativas ao AGORA)
tests/extensao.spec.mjs       Playwright com a extensão carregada
tools/build.mjs               zip da loja + bloco para colar no Elementor
tools/verificar-manifest.mjs  trava regras que afetam a revisão da loja
store/                        imagens da listagem (ícone, promo 440×280, marquee)
GUIA-PUBLICACAO.md            passo a passo do painel da Chrome Web Store
```

## Invariantes — não quebrar sem conversar com o usuário

Cada uma destas mudaria o que precisa ser declarado na aba de Privacidade do
painel e/ou atrasaria a revisão do Google. `verificar-manifest.mjs` cobra várias.

- `matches` restrito ao domínio da escola. Hoje é **uma** URL.
- Nenhuma chave `permissions` / `host_permissions`.
- Zero código remoto: nada de `fetch`, script externo, `eval`, CDN.
- Zero coleta de dados. Se um dia precisar guardar preferência do aluno,
  `chrome.storage.local` exige declarar a permissão `storage` — avise antes.
- Toda melhoria nova precisa caber no **propósito único** declarado na loja:
  *"Melhorar a usabilidade da página de aulas síncronas da EAA para os alunos."*
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

Registrar em `manifest.json` (depois de `src/core.js`), escrever o teste em
`tests/extensao.spec.mjs` e, se precisar, uma réplica em `gerar-fixtures.mjs`.
Uma melhoria que lança erro é isolada pelo núcleo (loga `[EAA+] melhoria "x" falhou`).

## Contrato com o DOM da página

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
- Versão publicada: **1.0.0**. Toda atualização precisa de `version` maior no
  `manifest.json` e do mesmo lado em `package.json`.
- Textos da listagem e das 4 respostas obrigatórias da aba Privacidade estão em
  `GUIA-PUBLICACAO.md`, seção 5. **A justificativa de host é obrigatória** mesmo
  sem a chave `permissions` — o `matches` conta.
- Ampliar `matches` para outra página = nova revisão do Google.
- Extensão **não funciona no celular** (Chrome Android/iOS não roda extensão).
  A saída é a escola colar `dist/colar-no-elementor.html` no widget 7dfc076.

## Ideias em aberto

- **Seletor de disciplinas** (melhoria #3): o aluno marca o que cursa e a
  próxima aula passa a ser a *dele*. Resolve o problema dos cards multi-período.
  Precisa de persistência → decidir entre `localStorage` da página (sem
  permissão nova) e `chrome.storage` (exige declarar `storage`).
- Planilha de auditoria das 125 sessões para o aluno conferir o calendário com
  a coordenação.
