# Painel de resumo compacto: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** painel geral baixo, com anel de progresso à esquerda e disciplinas em 2 colunas.

**Architecture:** o anel vira uma peça própria que gera SVG. `summary-panel.ts` monta nos três modos (durante o semestre, fechamento, carregando) a mesma moldura: lateral, lista e rodapé. Largura estreita é resolvida só em CSS, por container query.

**Tech Stack:** TypeScript estrito, esbuild, `node:test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-27-compact-summary-design.md`

## Global Constraints

- Código em inglês. Comentários, texto de tela e títulos de teste em português.
- Sem biblioteca, rede, permissão ou armazenamento novos.
- Cores só de `src/styles/theme.css` (`--eaa-*`).
- Todo `<button>` injetado tem padding, margem, borda e fonte explícitos.
- Fechado com 9 disciplinas: cerca de 185 px. Uma aberta: cerca de 330 px.
- Sem commit: o usuário não pediu.

## Review Focus

1. Varredura de 1 s com lista rolada: a posição da rolagem se mantém.
2. Nome longo em 2 colunas: corta com reticências, `title` com o nome inteiro, sem rolagem horizontal.
3. Mais de 10 disciplinas: "Ver mais" mostra o resto. Com 10 ou menos na largura ampla, não há botão.
4. Uma só disciplina ou uma só atividade: o anel é um círculo cheio e a segunda coluna não quebra o desenho.
5. Disciplina aberta que some da lista (outra aba, Atualizar): nenhuma outra abre sozinha.

---

### Task 1: Anel de progresso

**Files:**
- Create: `src/features/home/ring.ts`
- Test: `tests/unit/ring.test.ts` (incluir no script `test:unit` se ele listar arquivos)

**Interfaces:**
- Produces: `interface RingPart { cls: string; title: string }`
- Produces: `ring(parts: RingPart[], value: string, unit: string, label: string): string`

`ring` devolve um `<svg class="eaa-r-ring" role="img" aria-label={label}>`. Cada parte é um `<circle class="eaa-r-arc {cls}" pathLength="360">` com `<title>`. O vão entre arcos é de 4 unidades, e não há vão com uma parte só. `value` e `unit` são os dois textos do centro. Todo texto passa por `escapeHtml`. Arcos `todo` e `awaiting` precisam do contorno de `--eaa-todo-edge` e `--eaa-awaiting-edge` (um segundo círculo, ou dois traços sobrepostos).

- [ ] Escrever os testes: "um arco por parte, na ordem" (classes `graded`, `graded`, `awaiting`), "uma parte só fecha o círculo" (`stroke-dasharray="360 0"`), "escapa título e rótulo" (`<x>` sai como `&lt;x&gt;`).
- [ ] `npm run test:unit`: falha porque o módulo não existe.
- [ ] Implementar `ring`.
- [ ] `npm run test:unit`: passa.

### Task 2: Moldura nova, 2 colunas e uma linha aberta por vez

**Files:**
- Modify: `src/features/home/summary-panel.ts`, `src/features/home/state.ts`, `src/styles/summary-panel.css`, `src/ava/rules.ts`
- Test: `tests/ava.spec.mjs`, `tests/unit/rules.test.ts`, `tests/ava-fixtures.mjs`

**Interfaces:**
- Consumes: `ring` da Task 1.
- Produces: `export const ROWS_WIDE = 10` e `columnSplit(n: number): number` em `rules.ts` (`n <= 10 ? Math.ceil(n / 2) : 5`). `rowsShown` continua valendo na largura estreita.
- Produces: `HomeState.openRow: string | null`, no lugar de `openRows`.

**Estrutura:** `#eaa-summary` contém `.eaa-r-main` (`.eaa-r-side` e `.eaa-r-body`) e `.eaa-r-footer`. A lateral tem o anel, `.eaa-r-title` e `.eaa-r-sub`. O corpo tem `.eaa-r-courses` com duas `<ul class="eaa-r-col">`.

| Modo | Anel (valor / unidade) | Texto da lateral |
|---|---|---|
| durante | `{delivered}/{total}` / `entregues` | título = `longLabel`; `.eaa-r-when` com o texto de hoje; `.eaa-r-tag` com o texto de hoje |
| fechamento | `{guaranteed}/{n}` / `garantidas` (`aprovadas` se `allPassed` ou reprovação sem Av3) | `headline` e `sub` de hoje; `comfort` usa `--eaa-awaiting-text` no título |
| carregando | `{ready}/{total}` / `lidas` | "Próximo prazo" e `.eaa-r-status` com `role="status"` e o texto de hoje |

Saem `.eaa-r-banner`, `.eaa-r-bbadge`, `.eaa-r-caption`, a barra horizontal, `.eaa-r-progress` e as barras `.eaa-r-cseg`. As fichas (`closingPill`) e `.eaa-r-cleft` mantêm os textos.

**Linhas:** índice `< columnSplit(n)` vai para a coluna 1, o resto para a 2. Índice `>= rowsShown(n)` recebe `eaa-r-extra` (some só no estreito). Índice `>= ROWS_WIDE` recebe `eaa-r-over` (some sempre). Os dois voltam com `.expanded`. Com `n <= ROWS_WIDE`, o botão "Ver mais" aparece só no estreito. Com `allPassed`, o corpo começa escondido, com o botão "Ver notas das {n} disciplinas" visível em qualquer largura. O texto do "Ver mais" não leva número, porque a quantidade escondida muda com a largura.

**CSS:** `container-type: inline-size` no `#eaa-summary`. Lateral de 170 px com divisor à direita, colunas `minmax(0, 1fr)`, linhas de 28 px. Em `@container (max-width: 720px)`, a lateral fica no topo (anel ao lado do texto) e há 1 coluna.

**Lista aberta:** `.eaa-r-acts ul` tem `max-height: 128px` (5 itens de 24 px e 4 vãos de 2 px) e `overflow-y: auto`. Com mais de 5 itens, recebe `tabindex="0"`. "Abrir a disciplina" fica fora da `ul`. Antes de reescrever o `innerHTML`, guardar o `scrollTop` da lista aberta e restaurar depois.

**Rodapé:** hora, `.eaa-r-legend` e "Atualizar" na mesma linha, com quebra quando faltar largura. No fechamento, a legenda só aparece com `:has(.eaa-r-course[aria-expanded="true"])`.

- [ ] Unitário "divide as linhas em duas colunas": `columnSplit` de 1, 2, 9, 10 e 14 dá 1, 1, 5, 5 e 5.
- [ ] Ajustar os E2E atuais:
  - `.eaa-r-caption` passa a ser `.eaa-r-ring` com `aria-label` "2 de 4 atividades entregues", mais `.eaa-r-tag` com "faltam 2".
  - `.eaa-r-seg i` passa a ser `.eaa-r-arc`: `graded`, `awaiting`, `todo`, `todo`.
  - As barras de linha são conferidas pelos estados da lista aberta.
  - A legenda mantém os 5 itens e as cores. O teste de borda a borda sai.
  - "Sem pulo de altura ao terminar" continua valendo.
- [ ] E2E novos:
  - "abrir uma disciplina fecha a outra": clicar em 50001 e depois em 50008; só a 50008 fica com `aria-expanded="true"`; clicar nela de novo fecha.
  - "duas colunas na tela larga, uma na estreita": viewport 1400 dá `x` diferentes para as 2 linhas; viewport 700 dá o mesmo `x`.
  - "lista aberta rola a partir de 6 atividades e mantém a posição": `clientHeight <= 128`; `scrollTop = 40` continua após 1500 ms.
  - "fim do semestre: anel por disciplina e painel baixo": cenário na réplica sem prazo futuro, com 9 disciplinas e viewport 1400; 9 `.eaa-r-arc`; altura `<= 210`; nenhum `.eaa-r-more` visível.
  - "mais de 10 disciplinas mostra Ver mais": 10 linhas visíveis antes do clique, todas depois.
- [ ] `npm test`: os novos falham.
- [ ] Implementar.
- [ ] `npm test` e `npm run check`: tudo passa.

### Task 3: Conferência visual e documentação

**Files:**
- Modify: `ARQUITETURA.md` e `CLAUDE.md`, nos trechos que descrevem o painel e a contagem de testes.

- [ ] Capturar a réplica em 1400 px e 700 px, nos modos durante o semestre e fechamento, fechado e aberto. Conferir alturas, cortes de texto, foco visível e contraste.
- [ ] Atualizar os documentos.
- [ ] `npm test`: passa.

Versão, `CHANGELOG.md` e zip ficam fora: são da publicação, que o usuário não pediu.
