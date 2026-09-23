# EAA+ — Melhorias para alunos
### Guia de publicação na Chrome Web Store · versão 1.1.0

> **Atualização 1.1.0 (AVA).** Esta versão passa a rodar também no AVA
> (`batistas.brightspace.com/d2l/*`: página inicial e páginas de disciplina)
> e **lê as notas e entregas do aluno** no próprio Brightspace, com a sessão
> dele, só dentro do navegador. Isso muda quatro coisas no painel — todas já refletidas nas
> seções 4 e 5 abaixo:
>
> 1. o propósito único precisa ser reescrito (5.1);
> 2. a justificativa de host cobre dois sites (5.2);
> 3. a aba de dados deixa de ser "não coleta nada": marcar **Conteúdo do site** (5.4);
> 4. passa a ser **obrigatório** ter uma URL de política de privacidade (5.5).
>
> Fonte do item 3 e 4: FAQ do *User Data Policy*, perguntas 3 e 6 — dado
> processado só no aparelho também precisa ser declarado.
>
> Como amplia o `matches`, a atualização volta para a fila de revisão, e o
> Chrome pede ao usuário que aceite o novo acesso antes de reativar a extensão.

---

## 1. O que está no pacote

`eaa-plus-v1.1.0.zip` — gerado por `npm run build`, pronto para upload:

| Arquivo | Função |
|---|---|
| `manifest.json` | Manifest V3, **uma permissão só: `storage`** (sem aviso na instalação) |
| `src/core.js` | Núcleo: registra as melhorias e isola falhas entre elas |
| `src/fundo.js` | Service worker: só libera o `chrome.storage.session` para o cache do AVA |
| `src/features/filtro-periodos.*` | Melhoria 1 — abas de filtro por período |
| `src/features/proxima-aula.*` | Melhoria 2 — card da próxima aula |
| `src/ava-dados.js` | Leitura das notas e entregas no AVA (único arquivo com acesso à rede) |
| `src/features/ava-progresso.*` | Melhoria 3 — progresso nos cards da página inicial do AVA |
| `src/features/ava-disciplina.*` | Melhoria 4 — barra de progresso nas páginas de cada disciplina |
| `icons/16, 48, 128` | Ícones (o de 128 já com o padding de 16px exigido pela loja) |

**A extensão roda em duas páginas, cada uma com seu próprio bloco:**

```
https://escoladeadoracaoearte.com.br/aulas-sincronas-graduacao-ead/*
https://batistas.brightspace.com/d2l/*         (página inicial + páginas de disciplina)
```

Em qualquer outra página ela não carrega, não observa nada e não existe. Escopo estreito assim é o maior acelerador de revisão que existe — mas atenção: mesmo sem `host_permissions`, o Google trata esse `matches` como permissão de host e **exige justificativa** (seção 5.2). A permissão `storage` também pede a sua (seção 5.2.1).

---

## 2. Antes de subir: teste local (5 min)

1. Descompacte o `.zip` em uma pasta fixa (não deixe em Downloads temporário).
2. Chrome → `chrome://extensions`
3. Ligue **Modo do desenvolvedor** (canto superior direito).
4. **Carregar sem compactação** → selecione a pasta.
5. Abra a página de aulas síncronas.

Você deve ver as abas de período e, logo abaixo, o card da próxima aula.
No AVA (logado), cada card de "Minhas Disciplinas" ganha a barra de progresso.

Teste local **não consome** slot do limite de extensões da conta.

---

## 3. Upload

Dashboard → **Novo item** → **Selecionar arquivo** → escolha o `.zip`.

**Não descompacte antes de subir.** O `manifest.json` precisa estar na raiz do `.zip` — se você recompactar a *pasta*, ele desce um nível e o upload falha com "Manifest file is missing or unreadable".

---

## 4. Aba "Store listing" — textos prontos para colar

**Nome**

```
EAA+ — Melhorias para alunos
```

**Descrição curta / Summary**

```
Melhorias para alunos da EAA/FABAT: filtro e próxima aula nas aulas síncronas e progresso das avaliações no AVA.
```

**Descrição detalhada**

```
PROJETO INDEPENDENTE, CRIADO POR UM ALUNO
Esta extensão foi feita por um aluno da Escola de Adoração e Arte para
ajudar a si mesmo e aos colegas. Não é um produto oficial e não possui
vínculo com a Escola de Adoração e Arte nem com a Faculdade Batista
(FABAT).

O QUE ELA FAZ

A extensão melhora as páginas que o aluno usa todo dia: a de Aulas
Síncronas e o AVA (Brightspace).

NA PÁGINA DE AULAS SÍNCRONAS

1. Filtro por período
   • Abas: Todos, 1º, 2º, 3º e 4º Período
   • Contador de aulas em cada aba
   • A barra fica fixa no topo durante a rolagem, para trocar de
     período sem voltar ao começo da página
   • Disciplinas de mais de um período (ex.: "1º ao 4º período",
     "3º e 4º período") aparecem em todas as abas correspondentes

2. Próxima aula
   • Mostra qual é a próxima aula e o link para entrar nela
   • Muda para "AO VIVO AGORA" quando a aula está acontecendo
   • Setas para percorrer as aulas seguintes, com contador (1/94)
   • Quando duas aulas começam no mesmo horário, a segunda aparece
     marcada como "AO MESMO TEMPO" — nenhuma fica escondida
   • Acompanha a aba de período selecionada
   • Tempo restante atualizado automaticamente
   • Horários calculados no fuso de Brasília, independentemente do
     relógio do computador

Ambas funcionam com navegação por teclado e marcação de acessibilidade.

NO AVA (BRIGHTSPACE)

3. Progresso nas disciplinas
   • Em cada card de "Minhas Disciplinas", uma barra com a Av1: quanto
     já foi corrigido, o que está aguardando correção e o que ficou
     para trás
   • Contagem de atividades corrigidas, aguardando, perdidas e a fazer
   • O próximo prazo de cada disciplina, destacado quando é hoje ou
     amanhã
   • Quando todas as atividades estão resolvidas, quanto falta na Av2
     para chegar a 6,0; depois da Av2, se aprovou ou vai para a Av3
     (regra do Manual do Aluno EaD)
   • Tudo sem precisar entrar em cada disciplina

4. Barra da disciplina
   • Em qualquer página de uma disciplina (conteúdo, atividades,
     notas...), a mesma barra aparece na faixa de navegação dela
   • Um clique abre a lista das atividades de cada fechamento, com o
     estado de cada uma e o link direto para ela

OBSERVAÇÃO
Extensões do Chrome não funcionam no celular. Esta extensão só tem
efeito no computador.

PRIVACIDADE
Nada sai do seu navegador. Na página de aulas, a extensão só lê o que
já está na tela. No AVA, ela consulta as suas notas e entregas no
próprio Brightspace, com a sua sessão, apenas para montar a barra de
progresso. Para não repetir as consultas a cada página, guarda o que
leu por até 10 minutos, só na memória do navegador (some ao fechá-lo).
Não há servidor da extensão e não há coleta.

CONFIRA SEMPRE NO AVA
A extensão só reorganiza o que o AVA informa e não é fonte oficial.
Em caso de diferença, vale o que está no AVA: confira prazos, entregas
e notas lá antes de tomar qualquer decisão.
```

**Categoria:** Educação
**Idioma:** Português (Brasil)

### Imagens

| Item | Situação |
|---|---|
| Ícone 128×128 | ✅ já vai no `.zip` |
| Promo pequeno 440×280 (**obrigatório**) | ✅ `promo-440x280.png` em anexo |
| Screenshot 1280×800 (**mínimo 1**) | ⬜ você precisa capturar |

**Como capturar o screenshot no tamanho exato:**

1. Abra a página com a extensão ativa.
2. `F12` → `Ctrl+Shift+M` (modo dispositivo).
3. No topo, troque *Dimensions* para **Responsive** e digite **1280 × 800**.
4. Menu `⋮` (à direita da barra de dimensões) → **Capture screenshot**.

Enquadre com as abas **e** o card da próxima aula visíveis. Se der para capturar num momento em que uma aula esteja ao vivo, melhor ainda — é o estado mais vendedor.

---

## 5. Aba "Práticas de privacidade" — 4 campos obrigatórios

Esta aba **bloqueia o envio** enquanto os quatro itens abaixo não estiverem preenchidos. É aqui que a maioria trava.

### 5.1 Descrição do único propósito

```
Ajudar o aluno da Escola de Adoração e Arte (FABAT) a acompanhar a
própria vida acadêmica nas páginas da instituição: filtrar as aulas
síncronas por período e destacar a próxima aula, e mostrar no AVA o
progresso e os prazos das avaliações de cada disciplina.
```

> Texto anterior (até a v1.0.0), só para referência: *"Melhorar a
> usabilidade da página de aulas síncronas da Escola de Adoração e Arte
> para os alunos, com um filtro por período letivo e o destaque da próxima
> aula agendada."*

> A política do Google exige propósito **único e estreito**. As duas melhorias
> passam porque servem ao mesmo objetivo — achar sua aula mais rápido naquela
> página. O que derruba é misturar coisas de natureza diferente (gerenciador de
> senhas, bloqueador de anúncios, conversor de arquivos) sob o mesmo item. Cada
> melhoria nova deve caber na frase acima sem precisar reescrevê-la.

### 5.2 Justificativa do uso da permissão do host

```
A extensão atua em apenas duas páginas da instituição:

1. https://escoladeadoracaoearte.com.br/aulas-sincronas-graduacao-ead/
   Lê o calendário de aulas já exibido e insere, no HTML da própria
   página, abas de filtro por período e um card com a próxima aula.

2. https://batistas.brightspace.com/d2l/* (AVA da instituição)
   Na página inicial, insere em cada card de disciplina uma barra de
   progresso das avaliações e, acima dos cards, um resumo do próximo
   prazo. Nas páginas de uma disciplina, mostra a mesma barra na faixa
   de navegação da disciplina, com a lista das atividades. Para
   isso consulta, com a sessão do próprio aluno e apenas por leitura
   (GET), a API e páginas do Brightspace no mesmo domínio: boletim,
   tarefas, questionários, conclusão de conteúdo e a lista de
   questionários da disciplina. Os dados não são enviados a nenhum
   outro lugar.

Os padrões de correspondência estão restritos a esses dois sites. A
extensão não roda em nenhum outro site, não tem servidor próprio e não
transmite dados do usuário para fora do navegador.
```

### 5.2.1 Justificativa da permissão `storage`

```
Usada só com chrome.storage.session (memória, nunca disco) como cache
de curta duração das leituras do AVA: ao voltar à página inicial, a
extensão reaproveita o que leu há menos de 10 minutos em vez de
consultar de novo o servidor da instituição para cada disciplina. Os
dados de uma disciplina são apagados quando o aluno entra nela, e tudo
é apagado ao fechar o navegador. Não usa storage.local nem
storage.sync e nada é enviado para fora do navegador.
```

### 5.3 Uso de código remoto

Não é um campo de texto: é uma escolha. Marque **"Não estou usando código remoto"**.

É a resposta correta — todo o JavaScript e CSS está dentro do `.zip`. A extensão não carrega script externo, não usa `eval`, não busca configuração em servidor nenhum. As chamadas à API do Brightspace trazem **dados** (JSON), nunca código — isso não é código remoto.

### 5.4 Certificação de uso de dados

1. Na pergunta sobre coleta, marque **"Conteúdo do site"** (a extensão lê
   notas, entregas e prazos exibidos/servidos pelo AVA). Não marque as
   outras: ela não lê nome, matrícula, senha, mensagens, histórico nem
   localização. (Ela lê o **número interno do usuário** que o AVA põe na
   página, só como chave local do cache, para não misturar contas no mesmo
   navegador; nunca sai do navegador. Se preferir ser mais conservador,
   marque também "Informações de identificação pessoal".) Se o painel pedir, descreva: *"Notas e prazos das
   avaliações do próprio aluno, lidos do AVA da instituição e usados só
   para exibir o progresso na tela; nada é enviado para fora do navegador."*
2. Marque as **três caixas de certificação** no fim da aba:
   - não vende dados a terceiros;
   - não usa nem transfere dados para fins alheios ao propósito único;
   - não usa nem transfere dados para avaliar crédito ou conceder empréstimos.

As três são verdadeiras neste caso.

### 5.5 Política de privacidade (obrigatória a partir da 1.1.0)

O painel pede uma **URL pública**. O texto vive em
`POLITICA-DE-PRIVACIDADE.md` e vira página com `npm run politica`,
publicada na **Vercel** (projeto `eaa-plus-privacidade`):

```
npm run politica
npx vercel deploy .politica/eaa-plus-privacidade --prod
```

**URL publicada (cole no campo *Privacy policy* da aba):**

```
https://eaa-plus-privacidade.vercel.app/
```

Mudou o texto da política? Rode os dois comandos de novo — a URL continua
a mesma. (Publicada em 23/09/2026, conta Vercel `dihsantanna`.)

> **Depois de preencher, clique em "Salvar rascunho" antes de tentar enviar.**
> O botão "Enviar para análise" só libera quando os quatro itens estão salvos.

---

## 6. Aba "Distribution" — decida a visibilidade

| Opção | Quando faz sentido |
|---|---|
| **Público** | Aparece na busca da loja. Qualquer um instala. |
| **Não listado (unlisted)** | Só instala quem tem o link. **Recomendo esta.** |
| **Privado** | Restrito a um domínio Google Workspace específico. |

Como o público é o aluno da EAA, **"Não listado"** é o mais adequado: você distribui o link no grupo da turma e a extensão não fica exposta na busca pública, onde ninguém de fora teria contexto para ela.

Países: pode deixar só o Brasil.

---

## 7. Enviar e aguardar

**Submit for review.**

Prazo: a documentação do Google diz que a maioria é revisada **em poucos dias, podendo chegar a algumas semanas**. A própria página de revisão registrou (abril/2026) um volume alto de submissões alongando os prazos. Passou de três semanas sem resposta, aí sim vale abrir suporte.

A seu favor na fila: extensão pequena, **uma permissão só (`storage`, sem aviso)**, código não ofuscado, duas páginas bem delimitadas, só leitura.

---

## 8. Sobre o celular

Chrome no Android e no iOS **não roda extensões** — não existe contorno técnico. Seus colegas que consultam a página pelo celular não verão nada disso.

O caminho para resolver isso não é técnico, é institucional: aquela lista de aulas é um bloco de HTML colado dentro de um widget do Elementor (página **31604**, widget **7dfc076**) no WordPress da escola. Quem tem acesso ao painel pode colar o mesmo código lá dentro, e aí **todo aluno passa a ver, em qualquer aparelho, sem instalar nada**.

Com a extensão publicada e funcionando, você tem uma demonstração concreta para levar à coordenação ou ao TI. É um pedido muito mais fácil de aprovar do que uma ideia no abstrato.

---

## 9. Como adicionar uma melhoria nova

Cada melhoria é um arquivo isolado que se registra no núcleo. Se uma quebrar, as outras continuam funcionando.

**a) Crie `src/features/nome-da-melhoria.js`:**

```js
EAAPlus.add({
  id: "nome-da-melhoria",

  init: function () {
    var alvo = document.querySelector(".seletor-da-pagina");

    // Retorne false se o elemento ainda não existe: o núcleo observa o
    // DOM por 15s e chama init() de novo quando a página terminar de
    // renderizar (widgets do Elementor costumam demorar).
    if (!alvo) return false;

    // ... a melhoria em si ...

    return true;
  }
});
```

Utilitário disponível: `EAAPlus.periodos("1º ao 4º período")` devolve `[1,2,3,4]`.

**b) Registre no `manifest.json`,** acrescentando aos arrays `js` e `css` do bloco existente (mesma página) ou criando um novo bloco em `content_scripts` com seu próprio `matches` (outra página).

**c) Suba a versão** (ex.: `1.1.0` → `1.2.0`) e reenvie em **Package** → *Upload new package*.

Ampliar o `matches` para uma página nova **muda as permissões do item**, então a atualização volta para a fila de revisão. É normal.

---

## 10. Pontos frágeis a monitorar

**As classes da página.** Tudo depende de `.wrap header .instructions`, `main.list`, `.card`, `.period-tag`, `.discipline`, `.meta span` e da tabela `tbody tr`. Se alguém editar o widget no Elementor e trocar esses nomes, as melhorias param de aparecer — sem erro visível para o aluno.

**O formato de data e hora.** O card da próxima aula lê `dd/mm/aaaa` e `HH:MM às HH:MM`. Linha fora desse padrão é ignorada em silêncio, e a aula dela não entra na conta. Foi testado nas 125 sessões do semestre 2026.2: zero falhas de leitura.

**O menu do tema.** Para a barra de abas não ficar escondida atrás do menu do site, o código mede a borda inferior do `#masthead` (tema Eduma) durante a rolagem. Se o tema for trocado, a barra continua funcionando, só passa a grudar no topo absoluto da janela.

**O AVA.** O Brightspace é atualizado pela D2L sem aviso. A melhoria depende do id `enrollment-card-{número}` nos cards e das rotas `/d2l/api/le/1.99/...`. Se algo mudar, os cards ficam como eram (sem erro na tela) e o Console mostra `[EAA+] progresso da disciplina ...`.

Para diagnosticar: `F12` → Console. Se uma melhoria quebrar, o núcleo registra `[EAA+] melhoria "id" falhou:` e segue rodando as outras.

---

## Fontes

- [Register your developer account — Chrome for Developers](https://developer.chrome.com/docs/webstore/register)
- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
- [Image guidelines](https://developer.chrome.com/docs/webstore/images)
- [Review process](https://developer.chrome.com/docs/webstore/review-process)
- [User Data Policy — FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) (perguntas 3 e 6)
- Extensões no Android: [Does Chrome for Android Support Extensions?](https://www.quetta.net/blog/does-chrome-android-support-extensions) · [Chrome for Android may get extension support](https://sammyguru.com/google-chrome-for-android-may-get-extension-support-in-the-future/)
