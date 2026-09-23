# EAA+ — Melhorias para alunos
### Guia de publicação na Chrome Web Store · versão 1.0.0

---

## 1. O que está no pacote

`eaa-plus-v1.0.0.zip` — gerado por `npm run build`, pronto para upload:

| Arquivo | Função |
|---|---|
| `manifest.json` | Manifest V3, **sem nenhuma permissão declarada** |
| `src/core.js` | Núcleo: registra as melhorias e isola falhas entre elas |
| `src/features/filtro-periodos.*` | Melhoria 1 — abas de filtro por período |
| `src/features/proxima-aula.*` | Melhoria 2 — card da próxima aula |
| `icons/16, 48, 128` | Ícones (o de 128 já com o padding de 16px exigido pela loja) |

**A extensão roda hoje em uma única URL:**

```
https://escoladeadoracaoearte.com.br/aulas-sincronas-graduacao-ead/*
```

Em qualquer outra página ela não carrega, não observa nada e não existe. Escopo estreito assim é o maior acelerador de revisão que existe — mas atenção: mesmo sem a chave `permissions`, o Google trata esse `matches` como permissão de host e **exige justificativa** (seção 5.2).

---

## 2. Antes de subir: teste local (5 min)

1. Descompacte o `.zip` em uma pasta fixa (não deixe em Downloads temporário).
2. Chrome → `chrome://extensions`
3. Ligue **Modo do desenvolvedor** (canto superior direito).
4. **Carregar sem compactação** → selecione a pasta.
5. Abra a página de aulas síncronas.

Você deve ver as abas de período e, logo abaixo, o card da próxima aula.

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
Melhorias de usabilidade nas páginas da Escola de Adoração e Arte (FABAT): filtro por período e destaque da próxima aula.
```

**Descrição detalhada**

```
PROJETO INDEPENDENTE, CRIADO POR UM ALUNO
Esta extensão foi feita por um aluno da Escola de Adoração e Arte para
ajudar a si mesmo e aos colegas. Não é um produto oficial e não possui
vínculo com a Escola de Adoração e Arte nem com a Faculdade Batista
(FABAT).

O QUE ELA FAZ

A página de Aulas Síncronas lista todas as disciplinas do semestre de
uma vez só. A extensão acrescenta duas coisas a essa página:

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

OBSERVAÇÃO
Extensões do Chrome não funcionam no celular. Esta extensão só tem
efeito no computador.

PRIVACIDADE
Não coleta, não armazena e não envia nenhum dado. Não faz nenhuma
requisição de rede. Todo o processamento acontece na sua própria
página, no seu navegador.
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
Melhorar a usabilidade da página de aulas síncronas da Escola de
Adoração e Arte para os alunos, com um filtro por período letivo e o
destaque da próxima aula agendada.
```

> A política do Google exige propósito **único e estreito**. As duas melhorias
> passam porque servem ao mesmo objetivo — achar sua aula mais rápido naquela
> página. O que derruba é misturar coisas de natureza diferente (gerenciador de
> senhas, bloqueador de anúncios, conversor de arquivos) sob o mesmo item. Cada
> melhoria nova deve caber na frase acima sem precisar reescrevê-la.

### 5.2 Justificativa do uso da permissão do host

```
A extensão atua exclusivamente na página pública de aulas síncronas da
Escola de Adoração e Arte
(https://escoladeadoracaoearte.com.br/aulas-sincronas-graduacao-ead/).

O acesso a esse host é necessário porque toda a funcionalidade consiste
em ler o calendário de aulas já exibido nessa página e inserir, no
próprio HTML dela, uma barra de abas para filtrar as disciplinas por
período letivo e um card destacando a próxima aula agendada.

O padrão de correspondência está restrito a essa única URL. A extensão
não é executada em nenhum outro site, não lê nem transmite dados do
usuário e não faz requisições de rede.
```

### 5.3 Uso de código remoto

Não é um campo de texto: é uma escolha. Marque **"Não estou usando código remoto"**.

É a resposta correta — todo o JavaScript e CSS está dentro do `.zip`. A extensão não carrega script externo, não usa `eval`, não busca configuração em servidor nenhum.

### 5.4 Certificação de uso de dados

1. Na pergunta sobre coleta, declare que **não coleta nenhum tipo de dado do usuário** (não marque nenhuma categoria).
2. Marque as **três caixas de certificação** no fim da aba:
   - não vende dados a terceiros;
   - não usa nem transfere dados para fins alheios ao propósito único;
   - não usa nem transfere dados para avaliar crédito ou conceder empréstimos.

As três são verdadeiras neste caso.

Não é necessária política de privacidade, porque nada é coletado.

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

A seu favor na fila: extensão nova e pequena, **zero permissões**, código não ofuscado, host único.

---

## 8. Sobre o celular

Chrome no Android e no iOS **não roda extensões** — não existe contorno técnico. Seus colegas que consultam a página pelo celular não verão nada disso.

O caminho para resolver isso não é técnico, é institucional: aquela lista de aulas é um bloco de HTML colado dentro de um widget do Elementor (página **31604**, widget **7dfc076**) no WordPress da escola. Quem tem acesso ao painel pode colar o mesmo código lá dentro, e aí **todo aluno passa a ver, em qualquer aparelho, sem instalar nada**.

Com a extensão publicada e funcionando, você tem uma demonstração concreta para levar à coordenação ou ao TI. É um pedido muito mais fácil de aprovar do que uma ideia no abstrato.

---

## 9. Como adicionar a melhoria #3

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

**c) Suba a versão** (`1.0.0` → `1.1.0`) e reenvie em **Package** → *Upload new package*.

Ampliar o `matches` para uma página nova **muda as permissões do item**, então a atualização volta para a fila de revisão. É normal.

---

## 10. Pontos frágeis a monitorar

**As classes da página.** Tudo depende de `.wrap header .instructions`, `main.list`, `.card`, `.period-tag`, `.discipline`, `.meta span` e da tabela `tbody tr`. Se alguém editar o widget no Elementor e trocar esses nomes, as melhorias param de aparecer — sem erro visível para o aluno.

**O formato de data e hora.** O card da próxima aula lê `dd/mm/aaaa` e `HH:MM às HH:MM`. Linha fora desse padrão é ignorada em silêncio, e a aula dela não entra na conta. Foi testado nas 125 sessões do semestre 2026.2: zero falhas de leitura.

**O menu do tema.** Para a barra de abas não ficar escondida atrás do menu do site, o código mede a borda inferior do `#masthead` (tema Eduma) durante a rolagem. Se o tema for trocado, a barra continua funcionando, só passa a grudar no topo absoluto da janela.

Para diagnosticar: `F12` → Console. Se uma melhoria quebrar, o núcleo registra `[EAA+] melhoria "id" falhou:` e segue rodando as outras.

---

## Fontes

- [Register your developer account — Chrome for Developers](https://developer.chrome.com/docs/webstore/register)
- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
- [Image guidelines](https://developer.chrome.com/docs/webstore/images)
- [Review process](https://developer.chrome.com/docs/webstore/review-process)
- Extensões no Android: [Does Chrome for Android Support Extensions?](https://www.quetta.net/blog/does-chrome-android-support-extensions) · [Chrome for Android may get extension support](https://sammyguru.com/google-chrome-for-android-may-get-extension-support-in-the-future/)
