# Painel de resumo compacto

> **Atualização, mesmo dia:** o desenho novo vale **só no Layout Amplo**. O
> painel clássico fica como na v1.2.0. Cada um tem arquivo, id e CSS próprios.
> Onde este texto fala em "layout clássico" como tela estreita, leia "Amplo em
> janela estreita". Medidas que ficaram: lateral de 200 px, anel de 88 px, 1
> coluna até 800 px, anel no topo até 520 px. Alturas na réplica (1340 px):
> cerca de 190 px fechado com 9 disciplinas (medido no AVA real, com 10 px até
> os cards). O rodapé passou para baixo da lista, o carregamento mostra uma
> linha por disciplina e a tela de abertura do Amplo foi corrigida.

## Intenção

Baixar a altura do painel geral (cerca de 315 px hoje, no fim do semestre) para
sobrar mais espaço para os cards, aproveitando a largura.

## Objetivos e limites

- Fechado, com 9 disciplinas: cerca de 185 px (estimativa), todas à vista.
- Sem mudança em regras (`rules.ts`: estados, notas, situação, ordem), rede,
  cache ou permissões.
- Sem mudança nos blocos dos cards e na barra da disciplina.
- Não pode virar: texto cortado a ponto de não identificar a disciplina, ou
  informação que só a cor transmite.

## Abordagens

| | Troca | Resultado |
|---|---|---|
| **A: anel + 2 colunas** | barrinhas por linha só ao abrir | **escolhida** |
| B: anel + 1 coluna | desperdiça largura, mantém "Ver mais" | descartada |
| C: sem anel, 3 colunas | mais baixa, mas corta mais os nomes | descartada |

Abrir a linha:

| | Troca | Resultado |
|---|---|---|
| **A1: dentro da coluna, uma por vez** | painel cresce enquanto consulta | **escolhida** |
| A2: detalhe no lugar da lista | altura fixa, mas 2 cliques para trocar | descartada |

## Desenho

**Esquerda (cerca de 170 px), anel e texto:**

- Fim do semestre: um segmento por disciplina (verde, âmbar, vermelho, na ordem
  da barra atual), "7/9 garantidas" no centro. Abaixo, o título e o subtítulo do
  banner atual. O tom acolhedor (`comfort`) vai para a cor do texto. O banner, o
  selo e a barra horizontal saem. Cada segmento mantém o `title` com nome e
  situação. As contagens do selo ("em Av3", "aguardando") continuam no texto.
- Durante o semestre: um segmento por atividade do prazo, entregues/total no
  centro. Abaixo, nome do fechamento, data, tempo restante (vermelho se
  urgente) e "faltam N" ou "tudo entregue", com o aviso de não enviadas.
- Carregando: anel enchendo conforme as disciplinas respondem, com
  "carregando X de Y disciplinas…".

**Direita, lista em 2 colunas:**

- Duas listas independentes, preenchidas de cima para baixo e depois a segunda,
  na ordem atual. Linha: nome, situação (mesmas fichas e textos de hoje), seta.
- Uma única disciplina aberta no painel. Abrir outra fecha a anterior; clicar
  na aberta fecha. O conteúdo aberto é o de hoje. A escolha sobrevive à
  varredura (`state.openRows` vira um valor só).

**Rodapé:** "Atualizado às HH:MM", a legenda (só no modo durante o semestre e
com a linha aberta no fim do semestre) e "Atualizar".

**Largura estreita** (layout clássico): por container query, o anel vai para o
topo, deitado ao lado do texto, e a lista fica em 1 coluna.

## Decisões minhas, para conferir

1. Até 10 disciplinas aparecem todas. Acima disso, 10 e "Ver mais". Em 1
   coluna (estreito), vale a regra atual de 4 linhas.
2. Semestre com tudo aprovado: hoje a lista começa escondida. Mantenho assim,
   para o painel ficar ainda menor, com "Ver notas das N disciplinas".
3. As barrinhas de atividades saem das linhas fechadas e continuam visíveis,
   como lista, ao abrir.
4. O anel é SVG gerado no próprio código, sem biblioteca. Cores de `theme.css`,
   segmentos pendentes com o contorno atual (contraste), e texto alternativo
   com a contagem.
5. Todo `<button>` mantém padding, margem, borda e fonte explícitos.
6. Altura máxima (proposta, a aprovar): a lista de atividades da disciplina
   aberta mostra até 5 itens (cerca de 120 px) e rola por dentro acima disso.
   "Abrir a disciplina" fica fora da rolagem. Com até 10 disciplinas e uma
   aberta, o painel chega a cerca de 330 px (estimativa). A rolagem precisa
   funcionar pelo teclado e não pode voltar ao topo na varredura de 1 s. Com
   "Ver mais" aberto (mais de 10 disciplinas), o painel pode passar disso.

## Testes

Ajustar `tests/ava.spec.mjs` (título, prazo, legenda, segmentos). Cobrir: uma
linha aberta por vez, 2 colunas na largura ampla e 1 na estreita.

## Fica para quem implementa

Medidas exatas, quebra da container query e divisão do código de
`summary-panel.ts` (já com 370 linhas; o anel pode ir para arquivo próprio).
