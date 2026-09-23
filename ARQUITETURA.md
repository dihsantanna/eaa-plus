# EAA+ — como funciona e por quê

Cada fluxo da extensão está desenhado abaixo. Em cada bloco, a **função** em
negrito e o que ela faz; cada moldura é um **arquivo**, com o caminho no
título. Embaixo de cada fluxograma, o **porquê** das decisões.

**Legenda de cores**

```mermaid
flowchart LR
  L0["Núcleo e ferramentas"]
  L1["Feature (tela)"]:::feature
  L2["Dados e regras"]:::data
  L3["Rede"]:::net
  L4["Cache"]:::cache
  L5["AVA / Chrome"]:::ext
  L6{"Decisão"}
  L0 ~~~ L1 ~~~ L2 ~~~ L3 ~~~ L4 ~~~ L5 ~~~ L6
  classDef feature fill:#dbe9ff,stroke:#3b6fb6,color:#10233f
  classDef data fill:#e3f4e1,stroke:#3f8a3a,color:#15311a
  classDef net fill:#ffe9d6,stroke:#c46a1c,color:#3d2107
  classDef cache fill:#efe3fb,stroke:#7b4bb0,color:#2a1540
  classDef ext fill:#eceff3,stroke:#6b7480,color:#1f2429
```

---

## 1. Visão geral

A extensão mostra, no AVA (Brightspace) da EAA/FABAT, o progresso e os prazos
das avaliações em três lugares: o **painel em cada card** e o **painel geral**
na página inicial, e o **painel da disciplina** em qualquer página de uma
disciplina.

```mermaid
flowchart TB
  AVAPAGE["<b>Página /d2l/* do AVA</b><br/>o Chrome injeta content.js e content.css"]:::ext

  subgraph ENTRY["src/content.ts"]
    START["<b>início</b><br/>initCache() + registerFeature() das features"]
  end

  subgraph CORE["src/core/registry.ts"]
    REG["<b>registerFeature()</b><br/>roda init() de cada feature<br/>e tenta de novo até a página ficar pronta"]
  end

  subgraph HOME["src/features/home/"]
    F1["<b>Feature 1 · painel em cada card</b><br/>course-card.ts"]:::feature
    F2["<b>Feature 2 · painel geral</b><br/>summary-panel.ts"]:::feature
  end

  subgraph BAR["src/features/course-bar/"]
    F3["<b>Feature 3 · painel da disciplina</b><br/>index.ts · render.ts · layout.ts"]:::feature
  end

  subgraph AVAD["src/ava/"]
    DATA["<b>courseData(ou)</b> · course-data.ts<br/>entrega o resumo pronto de uma disciplina"]:::data
    RULES["<b>regras</b> · rules.ts<br/>estados, prazos, Av1/Av2/Av3, situação"]:::data
    NET["<b>rede</b> · network.ts<br/>único arquivo com fetch (só GET, só no AVA)"]:::net
    CACHE["<b>cache</b> · cache.ts<br/>chrome.storage.session por 10 min"]:::cache
  end

  API[("API e páginas do AVA<br/>com a sessão do aluno")]:::ext
  BG["<b>background.js</b> · src/background.ts<br/>libera o storage.session ao content script"]:::ext

  AVAPAGE --> START --> REG
  REG --> F1
  REG --> F3
  F1 -- "resumos prontos em state.ready" --> F2
  F1 --> DATA
  F3 --> DATA
  DATA --> CACHE
  DATA --> NET --> API
  DATA --> RULES
  BG -.-> CACHE

  classDef feature fill:#dbe9ff,stroke:#3b6fb6,color:#10233f
  classDef data fill:#e3f4e1,stroke:#3f8a3a,color:#15311a
  classDef net fill:#ffe9d6,stroke:#c46a1c,color:#3d2107
  classDef cache fill:#efe3fb,stroke:#7b4bb0,color:#2a1540
  classDef ext fill:#eceff3,stroke:#6b7480,color:#1f2429
```

**Por quê**

- **Extensão:** o autor é aluno e não tem acesso de administrador ao AVA; a
  extensão roda com a sessão que o aluno já abriu.
- **As features não acessam a rede:** as features 1 e 3 pedem tudo a
  `courseData()`, e a feature 2 reaproveita os resumos da feature 1. Assim, a
  mesma disciplina nunca é lida duas vezes.
- **Um só padrão de endereço (`/d2l/*`):** cada feature confere sozinha se a
  página é dela; a extensão não roda em nenhum outro site.

---

## 2. Carregamento e registro das features

```mermaid
flowchart TD
  A["<b>Chrome</b><br/>página /d2l/* terminou de carregar (document_idle)"]:::ext

  subgraph ENTRY["src/content.ts"]
    B["<b>initCache()</b><br/>tira do cache a disciplina desta página"]:::cache
    C["<b>registerFeature(homeFeature)</b>"]
    D["<b>registerFeature(courseBarFeature)</b>"]
  end

  subgraph REG["src/core/registry.ts"]
    E["<b>attempt(feature)</b><br/>chama init() dentro de try/catch"]
    F{"init() devolveu?"}
    G["<b>pronto</b><br/>feature montada, ou a página não é dela"]
    H["<b>watch()</b><br/>MutationObserver: a cada mudança do DOM,<br/>tenta init() de novo (por até 15 s)"]
    I["<b>erro isolado</b><br/>console: [EAA+] melhoria 'x' falhou<br/>a outra feature segue normal"]
  end

  A --> B --> C --> D
  C --> E
  D --> E
  E --> F
  F -- "true" --> G
  F -- "false" --> H --> E
  F -- "lançou erro" --> I

  classDef cache fill:#efe3fb,stroke:#7b4bb0,color:#2a1540
  classDef ext fill:#eceff3,stroke:#6b7480,color:#1f2429
```

**Por quê**

- **Tentar de novo por até 15 s:** os componentes do AVA aparecem depois do
  carregamento, em tempos variados. Observar o DOM reage assim que eles surgem;
  o limite evita um observador eterno.
- **Erro isolado:** se o AVA mudar e uma feature quebrar, a outra continua e a
  página não é afetada.
- **Um arquivo só, minificado:** content scripts não aceitam `import`, então o
  esbuild junta os módulos. A loja permite minificar, só proíbe ofuscar.
- **Mundo isolado:** o content script vê o DOM, mas não as variáveis do AVA;
  por isso a extensão faz as próprias leituras.

---

## 3. Página inicial: features 1 e 2

```mermaid
flowchart TD
  subgraph IDX["src/features/home/index.ts"]
    A["<b>homeFeature.init()</b><br/>só age em /d2l/home"]
    B{"widget d2l-my-courses-v2<br/>já existe?"}
    C["<b>new HomeState()</b> · state.ts<br/>estado compartilhado pelas features 1 e 2"]
    D["<b>scan()</b> — agora e a cada 1 s<br/>findAllDeep() atravessa 4 shadow roots<br/>e acha os cards visíveis; o ou vem do id do card"]
  end

  subgraph CARD["src/features/home/course-card.ts — Feature 1"]
    E{"<b>renderCourseCard()</b><br/>o card já tem bloco<br/>da geração atual?"}
    F["<b>ensureStyle() + createBlock()</b><br/>CSS dentro do shadow root; bloco ghost<br/>(reserva altura) + bloco real (rodapé)"]
    G["<b>courseData(ou) + courseName(ou)</b><br/>pede o resumo e o nome"]:::data
    H["<b>cardHtml()</b><br/>nota da Av1, uma linha por prazo<br/>e a situação ('Precisa de X na Av2')"]
    I["<b>sem bloco</b><br/>sem atividades ou erro: remove o bloco<br/>e não tenta de novo sozinho"]
    N["<b>nada a fazer</b><br/>o bloco já está em dia"]
  end

  subgraph SUM["src/features/home/summary-panel.ts — Feature 2"]
    J{"<b>updateSummaryPanel()</b><br/>todas as disciplinas<br/>visíveis responderam?"}
    K["<b>loadingHtml()</b><br/>'carregando 4 de 9…' com a mesma altura do resultado"]
    L["<b>overallSummary()</b><br/>acha o dia do próximo prazo entre todas<br/>e junta as atividades desse dia"]
    M["<b>summaryHtml()</b><br/>barra somada, fichas das disciplinas pendentes,<br/>legenda e 'Atualizado às' + Atualizar"]
  end

  A --> B
  B -- "não: devolve false" --> A
  B -- "sim" --> C --> D
  D --> E
  E -- "sim" --> N
  E -- "não" --> F --> G
  G -- "tem atividades" --> H
  G -- "sem atividades ou erro" --> I
  H -- "guarda o resumo em state.ready" --> L
  D -- "depois dos cards" --> J
  J -- "não, e menos de 20 s" --> K
  J -- "sim, ou passaram 20 s" --> L --> M
  D -. "a cada 1 s" .-> D

  classDef data fill:#e3f4e1,stroke:#3f8a3a,color:#15311a
  class A,B,C,D,E,F,H,I,J,K,L,M,N feature
  classDef feature fill:#dbe9ff,stroke:#3b6fb6,color:#10233f
```

**Por quê**

- **Varredura a cada 1 s:** os cards ficam dentro de 4 shadow roots, que o
  `MutationObserver` não atravessa, e o AVA recria os cards ao trocar de aba.
  A varredura só confere; não refaz o que já está em dia.
- **Só cards visíveis:** abas fechadas só carregam quando abertas.
- **CSS no shadow root, cores em variáveis:** o CSS do manifest não atravessa
  shadow DOM, mas variáveis CSS atravessam (`src/styles/theme.css`).
- **Ghost + real:** títulos de 1 a 3 linhas deixariam os cards desalinhados.
- **Sem nova tentativa após erro:** com varredura por segundo, viraria uma
  leitura por segundo no servidor.
- **Nome pela API:** o texto do card mudou para "Fechada" de um dia para o
  outro.
- **Painel geral espera todas:** somar parcialmente mostraria números errados;
  depois de 20 s mostra o que tiver.

---

## 4. O caminho de um dado: `courseData(ou)`

```mermaid
flowchart TD
  subgraph CD["src/ava/course-data.ts"]
    A["<b>courseData(ou)</b><br/>resumo de uma disciplina"]
    B{"<b>once()</b><br/>já pedida nesta página?"}
    C["<b>mesma Promise</b><br/>nenhum pedido novo"]
    D["<b>storedFor(ou)</b><br/>pergunta ao cache (uma vez por página)"]
    E["<b>download(ou)</b> — 1ª leva, 4 pedidos<br/>boletim · notas liberadas · tarefas · questionários"]
    G["<b>2ª leva</b> — só o necessário<br/>Lista de questionários · página de tarefas ·<br/>envios de uma tarefa · conteúdo"]
    H{"leitura completa?"}
    M["<b>assemble()</b><br/>classify() → summarize() com a hora de agora"]
  end

  subgraph CA["src/ava/cache.ts"]
    R["<b>read(ou)</b><br/>vale se tem < 10 min e é do mesmo aluno"]:::cache
    S["<b>slim()</b><br/>mantém só os campos que as regras usam"]:::cache
    T["<b>store()</b><br/>guarda os dados crus"]:::cache
  end

  subgraph NT["src/ava/network.ts"]
    N3["<b>parseQuizList() / parseAssignmentList()</b><br/>lê as páginas HTML com DOMParser (nada executa)"]:::net
    N1["<b>requestJson() / requestText()</b><br/>fila de até 4 pedidos simultâneos"]:::net
    N2["<b>sameOrigin()</b><br/>recusa qualquer endereço fora do AVA"]:::net
  end

  subgraph RU["src/ava/rules.ts"]
    P["<b>plan()</b><br/>decide o que a 2ª leva precisa buscar"]:::data
  end

  O["<b>CourseSummary</b><br/>entregue às features"]:::data

  A --> B
  B -- "sim" --> C
  B -- "não" --> D
  D --> R
  R -- "sim (0 pedidos)" --> M
  R -- "não" --> E --> P --> G
  E --> N1
  G --> N1
  N1 --> N2
  N1 -- "páginas HTML" --> N3
  G --> S --> H
  H -- "sim" --> T --> M
  H -- "não: não guarda" --> M
  M --> O

  classDef data fill:#e3f4e1,stroke:#3f8a3a,color:#15311a
  classDef net fill:#ffe9d6,stroke:#c46a1c,color:#3d2107
  classDef cache fill:#efe3fb,stroke:#7b4bb0,color:#2a1540
  class A,B,C,D,E,G,H,M data
```

**Por quê**

- **Duas levas:** buscar só o necessário reduziu a página inicial de 86 para
  49 pedidos.
- **Páginas HTML:** a API responde 403 quando o aluno pede as próprias
  tentativas de questionário; a "Lista de questionários" é a única fonte. A
  página de tarefas traz o envio de todas numa leitura.
- **Ícone, não texto:** "Tentativa em andamento" também aparece em
  questionário já corrigido (é o link de feedback). A tentativa aberta de
  verdade é o ícone na linha.
- **Rede num só arquivo:** o verificador (`tools/check-manifest.mjs`) impede
  o build se houver `fetch` fora dele, sem `sameOrigin` ou diferente de GET.
- **Fila de 4:** evita rajada de pedidos ao abrir a página inicial.
- **Só guarda leitura completa:** um dado parcial nunca é reaproveitado.

---

## 5. As regras: `src/ava/rules.ts`

Funções puras, sem rede e sem DOM, testadas em `tests/unit/rules.test.ts`.

```mermaid
flowchart TD
  RAW["<b>RawCourse</b><br/>dados crus da disciplina"]:::data

  subgraph RU["src/ava/rules.ts"]
    A["<b>classify()</b><br/>liga boletim, tarefas e questionários pelo GradeItemId;<br/>Av2/Av3 (nota oculta) entram pela seção ou pelo nome, sem pontos"]:::data
    B{"<b>finalState()</b><br/>tem nota?"}
    C{"tentativa aberta<br/>e prazo não venceu?"}
    D{"enviada, ou tentativa<br/>aberta com prazo vencido?"}
    E{"prazo venceu?"}
    S1["corrigida"]
    S2["iniciada"]
    S3["aguardando correção"]
    S4["perdida"]
    S5["a fazer"]
    F["<b>summarize()</b><br/>'Nota AV2' = 0 não é resultado; Av3 só para quem está em recuperação;<br/>Av1 agrupada por dia de prazo (2 fechamentos) + grupos Av2 e Av3"]:::data
    G["<b>standing()</b><br/>Av1 + Av2 ≥ 6 aprova · 4 a 6 → Av3 · < 4 reprova<br/>antes da Av2: 'Precisa de X na Av2'"]:::data
  end

  RAW --> A --> B
  B -- "sim" --> S1
  B -- "não" --> C
  C -- "sim" --> S2
  C -- "não" --> D
  D -- "sim" --> S3
  D -- "não" --> E
  E -- "sim" --> S4
  E -- "não" --> S5
  S1 & S2 & S3 & S4 & S5 --> F --> G

  classDef data fill:#e3f4e1,stroke:#3f8a3a,color:#15311a
  class B,C,D,E data
  style S1 fill:#46a661,color:#fff,stroke:#2c7a43
  style S2 fill:#e87511,color:#fff,stroke:#b34f00
  style S3 fill:#ffba59,color:#3d2107,stroke:#8a5300
  style S4 fill:#cd2026,color:#fff,stroke:#a3181e
  style S5 fill:#e3f9f1,color:#1f2429,stroke:#6b7480
```

**Por quê**

- **Regras separadas do desenho:** é a parte que mais precisa estar certa;
  um teste quebrado aponta a regra exata.
- **Hora como parâmetro:** o relógio não pode ser falsificado no mundo
  isolado, então os testes usam hora fixa.
- **Fuso de Brasília** (`src/ava/format.ts`): o prazo é o mesmo em qualquer
  computador.
- **Regra de aprovação:** Manual do Aluno EaD 2026, p. 29. O manual não diz
  como a Av3 entra na média, então só a nota dela é mostrada.

---

## 6. O cache entre páginas: `src/ava/cache.ts`

```mermaid
flowchart TD
  subgraph CA["src/ava/cache.ts — chrome.storage.session"]
    A["<b>initCache()</b><br/>ao carregar a página: se é página de disciplina,<br/>apaga essa disciplina e agenda apagar de novo no pagehide"]:::cache
    B["<b>read(key)</b><br/>vale se: mesmo aluno + mesmo formato + < 10 min"]:::cache
    C["<b>store(key, value)</b><br/>grava dados crus com o id do aluno e a hora"]:::cache
    D["<b>forget(ou)</b><br/>apaga uma disciplina e não grava mais nela nesta página"]:::cache
    E["<b>clear()</b><br/>apaga tudo (botão Atualizar)"]:::cache
    W["<b>withStorage()</b><br/>todo acesso passa aqui; se falhar,<br/>segue sem cache e avisa uma vez no console"]:::cache
  end

  BG["<b>src/background.ts</b><br/>setAccessLevel: libera o storage.session<br/>para o content script"]:::ext
  CD["<b>src/ava/course-data.ts</b><br/>lê antes de buscar; grava leituras completas"]:::data
  CB["<b>src/features/course-bar/index.ts</b><br/>forget(ou) ao abrir uma disciplina"]:::feature

  BG -.-> W
  A --> D
  CD --> B
  CD --> C
  CB --> D
  B --> W
  C --> W
  D --> W
  E --> W

  classDef feature fill:#dbe9ff,stroke:#3b6fb6,color:#10233f
  classDef data fill:#e3f4e1,stroke:#3f8a3a,color:#15311a
  classDef cache fill:#efe3fb,stroke:#7b4bb0,color:#2a1540
  classDef ext fill:#eceff3,stroke:#6b7480,color:#1f2429
```

**Por quê**

- **Existe porque o AVA responde `no-store`** e recarrega a página a cada
  clique: sem cache, cada volta à página inicial repetiria as 49 leituras. Com
  ele, a volta custa 0 pedidos, ou só a disciplina visitada.
- **`storage.session`:** só memória, isolado da página, some ao fechar o
  navegador. `localStorage` gravaria notas no disco; `sessionStorage` não vale
  entre abas.
- **Dados crus:** "prazo perdido" depende da hora, então é recalculado a cada
  exibição.
- **Apagar a disciplina ao entrar:** o aluno pode enviar algo ali; ao voltar,
  só essa disciplina é relida.

---

## 7. O botão Atualizar

```mermaid
flowchart TD
  A["<b>clique em Atualizar</b><br/>rodapé do painel geral"]:::feature

  subgraph IDX["src/features/home/index.ts"]
    B["<b>refreshAll()</b>"]:::feature
    C["<b>state.reset()</b> · state.ts<br/>sobe a geração e limpa o estado da página"]:::feature
    F["<b>scan()</b><br/>roda na hora: cards pedem de novo,<br/>painel geral volta ao carregamento"]:::feature
  end

  subgraph CD["src/ava/course-data.ts"]
    D["<b>restart()</b><br/>esquece a memória da página"]:::data
  end

  subgraph CA["src/ava/cache.ts"]
    E["<b>clear()</b><br/>esvazia o cache; leituras esperam a limpeza"]:::cache
  end

  G["<b>respostas da geração antiga</b><br/>são descartadas; os cards mantêm<br/>o dado antigo até o novo chegar"]:::feature

  A --> B --> C --> D --> E --> F --> G

  classDef feature fill:#dbe9ff,stroke:#3b6fb6,color:#10233f
  classDef data fill:#e3f4e1,stroke:#3f8a3a,color:#15311a
  classDef cache fill:#efe3fb,stroke:#7b4bb0,color:#2a1540
```

**Por quê:** recarregar a página faria o AVA baixar de novo cerca de 250
arquivos dele. Manter o dado antigo evita que os cards encolham e cresçam.

---

## 8. Página de uma disciplina: feature 3

```mermaid
flowchart TD
  subgraph IDX["src/features/course-bar/index.ts"]
    A["<b>courseBarFeature.init()</b>"]
    B{"<b>courseOu()</b><br/>a faixa azul tem o link<br/>'Início do Curso'?"}
    C["<b>forget(ou)</b><br/>esta página sempre lê do servidor"]:::cache
    D["<b>preview(ou)</b><br/>só o boletim: diz se são 1 ou 2 colunas"]:::data
    E["<b>courseData(ou)</b><br/>o resumo completo"]:::data
    I["<b>ensure()</b> — a cada 1 s e no resize<br/>coloca a barra dentro da faixa e realinha"]
    P["<b>listenForPanel()</b><br/>clique abre/fecha; clique fora e Esc fecham"]
    S["<b>stop()</b><br/>sem atividades ou erro: remove a barra"]
  end

  subgraph RE["src/features/course-bar/render.ts"]
    G["<b>loadingHtml()</b> — enquanto carrega:<br/>já com o número certo de colunas<br/><br/><b>barHtml()</b> — com o resultado:<br/>botão com nota + até 2 prazos (<b>columns()</b>)<br/>painel com cada atividade, estado e link (<b>panel()</b>)"]
  end

  subgraph LA["src/features/course-bar/layout.ts"]
    H{"<b>place()</b><br/>cabe ao lado dos links do AVA?"}
    K["inteira"]
    L["compacta"]
    M["escondida"]
  end

  A --> B
  B -- "não: devolve false" --> A
  B -- "sim" --> C
  C --> D
  C --> E
  D -- "formato" --> G
  E -- "tem atividades" --> G
  G --> I
  E -- "sem atividades ou erro" --> S
  I --> H
  H -- "sim" --> K
  H -- "só compactada" --> L
  H -- "não" --> M
  K --> P
  L --> P

  classDef data fill:#e3f4e1,stroke:#3f8a3a,color:#15311a
  classDef cache fill:#efe3fb,stroke:#7b4bb0,color:#2a1540
  classDef feature fill:#dbe9ff,stroke:#3b6fb6,color:#10233f
  class A,B,I,P,S,G,H,K,L,M feature
```

**Por quê**

- **Link "Início do Curso":** o endereço muda entre as rotas da disciplina,
  mas esse link está na faixa de todas elas.
- **Dentro da faixa, com posição absoluta:** a página de Conteúdo tem altura
  presa à janela; qualquer elemento no fluxo empurra a aula para fora da tela.
- **Compactar ou esconder:** melhor sumir do que cobrir um link do AVA.
- **`preview()` antes:** o carregamento já nasce com a largura final, então
  nada pula quando o resultado chega.

---

## 9. Build e testes

```mermaid
flowchart LR
  SRC["<b>src/</b><br/>TypeScript + CSS + manifest.json"]

  subgraph TOOLS["tools/"]
    CHK["<b>check-manifest.mjs</b><br/>uma permissão, um site, rede só em network.ts,<br/>só GET, sem código dinâmico"]:::net
    BUN["<b>bundle.mjs</b> (esbuild)<br/>gera content.js, content.css, background.js"]
    DEV["<b>dev.mjs</b><br/>watch + código legível + recarga no Chrome"]
    BLD["<b>build.mjs</b><br/>tsc + check → build/ minificado → zip"]
  end

  subgraph TESTS["tests/"]
    UNIT["<b>unit/rules.test.ts</b><br/>31 testes das regras, hora fixa, Node puro"]:::data
    E2E["<b>*.spec.mjs</b> (Playwright)<br/>extensão minificada num Chromium real<br/>contra réplicas do AVA"]:::data
  end

  OUT1["<b>build/</b> + <b>dist/eaa-plus-vX.Y.Z.zip</b><br/>vai para a Chrome Web Store"]:::ext
  OUT2["<b>.dev-build/ext</b><br/>carregada no Chrome para desenvolver"]:::ext

  SRC --> BLD
  BLD --> CHK
  BLD --> BUN --> OUT1
  SRC --> DEV --> BUN
  DEV --> OUT2
  SRC --> UNIT
  BUN --> E2E

  classDef data fill:#e3f4e1,stroke:#3f8a3a,color:#15311a
  classDef net fill:#ffe9d6,stroke:#c46a1c,color:#3d2107
  classDef ext fill:#eceff3,stroke:#6b7480,color:#1f2429
```

**Por quê**

- **TypeScript estrito:** o formato dos dados da API fica documentado e
  checado.
- **E2E contra o pacote minificado:** testa exatamente o que vai para a loja.
- **Réplicas com CSS hostil:** as páginas de teste carregam de propósito o CSS
  do AVA que atrapalha elementos inseridos; uma réplica limpa esconderia bugs
  que já aconteceram.

---

## 10. Limites conhecidos

- **O AVA pode mudar sem aviso.** Se os cards, a faixa de navegação, as rotas
  da API ou as duas páginas HTML mudarem, a extensão para em silêncio: o AVA
  fica como era e um aviso `[EAA+]` aparece no console.
- **Só no computador.** O Chrome para celular não roda extensões.
- **Não é fonte oficial.** Em caso de diferença, vale o que está no AVA.
