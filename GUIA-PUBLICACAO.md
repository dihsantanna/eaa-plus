# EAA+ — Melhorias para alunos
### Guia de publicação na Chrome Web Store · versão 1.0.0

> **Primeira publicação.** A extensão ainda não está na loja: a versão 1.0.0
> entra como um item novo. Ela roda **só no AVA** (Brightspace) da EAA/FABAT.
>
> Nas próximas versões, cada pacote enviado precisa ter a versão **maior** que
> a publicada (*"Each new version must have a larger version number than the
> previous version"*) — veja a seção 9.

---

## 1. O que está no pacote

`eaa-plus-v1.0.0.zip` — gerado por `npm run build` a partir da pasta `build/`, pronto para upload:

| Arquivo | Função |
|---|---|
| `manifest.json` | Manifest V3, **uma permissão só: `storage`** (sem aviso na instalação) |
| `content.js` | Todo o código que roda no AVA, num arquivo só, minificado (fonte em TypeScript no repositório, `src/`) |
| `content.css` | Estilos: cores, painel geral e barra da disciplina |
| `background.js` | Service worker: só libera o `chrome.storage.session` para o cache |
| `icons/16, 48, 128` | Ícones (o de 128 já com o padding de 16px exigido pela loja) |

**A extensão roda só nas páginas do AVA:**

```
https://batistas.brightspace.com/d2l/*         (página inicial + páginas de disciplina)
```

Em qualquer outro site ela não carrega, não observa nada e não existe. Escopo estreito assim ajuda a revisão — mas atenção: mesmo sem `host_permissions`, o Google trata esse `matches` como permissão de host e **exige justificativa** (seção 5.2). A permissão `storage` também pede a sua (seção 5.2.1).

---

## 2. Antes de subir: teste local (5 min)

1. Descompacte o `.zip` em uma pasta fixa (não deixe em Downloads temporário).
2. Chrome → `chrome://extensions`
3. Ligue **Modo do desenvolvedor** (canto superior direito).
4. **Carregar sem compactação** → selecione a pasta.
5. Abra o AVA (logado).

Na página inicial, cada card de "Minhas Disciplinas" ganha a barra de
progresso, e acima dos cards aparece o resumo do próximo prazo. Dentro de uma
disciplina, a barra aparece na faixa azul de navegação.

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
Progresso das avaliações no AVA da EAA/FABAT: o que já foi corrigido, o que aguarda correção, o que falta e os prazos.
```

**Descrição detalhada**

```
PROJETO INDEPENDENTE, CRIADO POR UM ALUNO
Esta extensão foi feita por um aluno da Escola de Adoração e Arte para
ajudar a si mesmo e aos colegas. Não é um produto oficial e não possui
vínculo com a Escola de Adoração e Arte nem com a Faculdade Batista
(FABAT).

O QUE ELA FAZ

Acompanhar as avaliações no AVA (Brightspace) exige entrar em cada
disciplina e procurar em várias telas. A extensão reúne isso onde o
aluno já está.

1. Progresso nas disciplinas (página inicial do AVA)
   • Em cada card de "Minhas Disciplinas", uma barra com a Av1: quanto
     já foi corrigido, o que está aguardando correção e o que ficou
     para trás
   • Contagem de atividades corrigidas, aguardando, perdidas e a fazer
   • O próximo prazo de cada disciplina, destacado quando é hoje ou
     amanhã
   • Quando todas as atividades estão resolvidas, quanto falta na Av2
     para chegar a 6,0; depois da Av2, se aprovou ou vai para a Av3
     (regra do Manual do Aluno EaD)
   • Acima dos cards, o próximo fechamento de todas as disciplinas e
     quais ainda têm algo pendente

2. Barra da disciplina
   • Em qualquer página de uma disciplina (conteúdo, atividades,
     notas...), a mesma barra aparece na faixa de navegação dela
   • Um clique abre a lista das atividades de cada fechamento, com o
     estado de cada uma e o link direto para ela

OBSERVAÇÃO
Extensões do Chrome não funcionam no celular. Esta extensão só tem
efeito no computador.

PRIVACIDADE
Nada sai do seu navegador. A extensão consulta as suas notas e entregas
no próprio Brightspace, com a sua sessão, apenas para montar a barra de
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
| Promo pequeno 440×280 (**obrigatório**) | ✅ `store/promo-440x280.png` |
| Marquee 1400×560 (opcional) | ✅ `store/marquee-1400x560.png` |
| Screenshot 1280×800 (**mínimo 1**) | ⬜ você precisa capturar |

As imagens de `store/` saem de `python tools/generate-images.py`.

**Como capturar o screenshot no tamanho exato:**

1. Abra a página inicial do AVA com a extensão ativa.
2. `F12` → `Ctrl+Shift+M` (modo dispositivo).
3. No topo, troque *Dimensions* para **Responsive** e digite **1280 × 800**.
4. Menu `⋮` (à direita da barra de dimensões) → **Capture screenshot**.

Enquadre o resumo do próximo prazo e alguns cards. **A captura mostra as suas
notas e o seu nome** — se não quiser publicá-los, cubra-os antes de subir.

---

## 5. Aba "Práticas de privacidade" — campos obrigatórios

Esta aba **bloqueia o envio** enquanto os itens abaixo não estiverem preenchidos. É aqui que a maioria trava.

### 5.1 Descrição do único propósito

```
Ajudar o aluno da Escola de Adoração e Arte (FABAT) a acompanhar, no
AVA da instituição, o progresso e os prazos das avaliações de cada
disciplina.
```

> A política do Google exige propósito **único e estreito**. O que derruba é
> misturar coisas de natureza diferente (gerenciador de senhas, bloqueador de
> anúncios, conversor de arquivos) sob o mesmo item. Cada melhoria nova deve
> caber na frase acima sem precisar reescrevê-la.

### 5.2 Justificativa do uso da permissão do host

```
A extensão atua apenas no AVA da instituição:
https://batistas.brightspace.com/d2l/*

Na página inicial, insere em cada card de disciplina uma barra de
progresso das avaliações e, acima dos cards, um resumo do próximo
prazo. Nas páginas de uma disciplina, mostra a mesma barra na faixa
de navegação da disciplina, com a lista das atividades. Para isso
consulta, com a sessão do próprio aluno e apenas por leitura (GET),
a API e páginas do Brightspace no mesmo domínio: boletim, tarefas,
questionários, conclusão de conteúdo e a lista de questionários da
disciplina.

O padrão de correspondência está restrito a esse site. A extensão não
roda em nenhum outro site, não tem servidor próprio e não transmite
dados do usuário para fora do navegador.
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
   notas, entregas e prazos servidos pelo AVA). Processar dado só no
   aparelho também precisa ser declarado (FAQ do *User Data Policy*,
   perguntas 3 e 6). Não marque as outras: ela não lê nome, matrícula,
   senha, mensagens, histórico nem localização. (Ela lê o **número interno
   do usuário** que o AVA põe na página, só como chave local do cache, para
   não misturar contas no mesmo navegador; nunca sai do navegador. Se
   preferir ser mais conservador, marque também "Informações de
   identificação pessoal".) Se o painel pedir, descreva: *"Notas e prazos
   das avaliações do próprio aluno, lidos do AVA da instituição e usados só
   para exibir o progresso na tela; nada é enviado para fora do navegador."*
2. Marque as **três caixas de certificação** no fim da aba:
   - não vende dados a terceiros;
   - não usa nem transfere dados para fins alheios ao propósito único;
   - não usa nem transfere dados para avaliar crédito ou conceder empréstimos.

As três são verdadeiras neste caso.

### 5.5 Política de privacidade (obrigatória)

O painel pede uma **URL pública**. O texto vive em
`POLITICA-DE-PRIVACIDADE.md` e vira página com `npm run policy`,
publicada na **Vercel** (projeto `eaa-plus-privacidade`, conta `dihsantanna`):

```
npm run policy
npx vercel deploy .policy/eaa-plus-privacidade --prod
```

**URL publicada (cole no campo *Privacy policy* da aba):**

```
https://eaa-plus-privacidade.vercel.app/
```

Mudou o texto da política? Rode os dois comandos de novo — a URL continua
a mesma.

> **Depois de preencher, clique em "Salvar rascunho" antes de tentar enviar.**
> O botão "Enviar para análise" só libera quando todos os itens estão salvos.

---

## 6. Aba "Distribution" — decida a visibilidade

| Opção | Quando faz sentido |
|---|---|
| **Público** | Aparece na busca da loja. Qualquer um instala. |
| **Não listado (unlisted)** | Só instala quem tem o link. **Recomendo esta.** |
| **Privado** | Restrito a um domínio Google Workspace específico. |

Como o público é o aluno da EAA, **"Não listado"** é o mais adequado: você distribui o link para a turma e a extensão não fica exposta na busca pública, onde ninguém de fora teria contexto para ela.

Países: pode deixar só o Brasil.

---

## 7. Enviar e aguardar

**Submit for review.**

Prazo: a documentação do Google diz que a maioria é revisada **em poucos dias, podendo chegar a algumas semanas**. Passou de três semanas sem resposta, aí sim vale abrir suporte.

A seu favor na fila: extensão pequena, **uma permissão só (`storage`, sem aviso)**, código não ofuscado, um site bem delimitado, só leitura.

---

## 8. Sobre o celular

Chrome no Android e no iOS **não roda extensões** — não existe contorno técnico. Quem acessa o AVA pelo celular não verá nada disso.

---

## 9. Como adicionar uma melhoria nova

O código-fonte é TypeScript, em `src/`. Cada feature é uma pasta em
`src/features/` que se registra no núcleo. Se uma quebrar, as outras continuam
funcionando.

**a) Crie `src/features/my-feature/index.ts`:**

```ts
import type { Feature } from "../../core/registry.ts";

export const myFeature: Feature = {
  id: "my-feature",
  init() {
    const target = document.querySelector(".page-selector");
    // Retorne false se o elemento ainda não existe: o núcleo observa o
    // DOM por 15s e chama init() de novo quando a página terminar de
    // renderizar (os componentes do AVA costumam demorar).
    if (!target) return false;
    // ... a feature em si (dados: src/ava/course-data.ts) ...
    return true;
  },
};
```

**b) Registre em `src/content.ts`** com `registerFeature(myFeature)`.

**c) Rode `npm test` e `npm run build`,** suba a versão (ex.: `1.0.0` → `1.1.0`)
no `src/manifest.json` e no `package.json`, e reenvie em **Package** →
*Upload new package*.

Ampliar o `matches` para outro site **muda as permissões do item**: a atualização volta para a fila de revisão e o Chrome pede ao usuário que aceite o novo acesso.

---

## 10. Pontos frágeis a monitorar

**O AVA muda sem aviso.** O Brightspace é atualizado pela D2L. A extensão depende:

- do id `enrollment-card-{número}` nos cards da página inicial;
- da faixa de navegação da disciplina e do link "Início do Curso";
- das rotas `/d2l/api/le/1.99/...`;
- de duas páginas HTML do AVA: a Lista de questionários e a de Atividades com Anexo (`src/ava/network.ts`).

Se algo mudar, os cards ficam como eram (sem erro na tela) e o Console mostra `[EAA+] progresso da disciplina ...`. O `CLAUDE.md` documenta onde cada coisa é lida.

Para diagnosticar: `F12` → Console. Se uma melhoria quebrar, o núcleo registra `[EAA+] melhoria "id" falhou:` e segue rodando as outras.

---

## Fontes

- [Register your developer account — Chrome for Developers](https://developer.chrome.com/docs/webstore/register)
- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)
- [Update your Chrome Web Store item](https://developer.chrome.com/docs/webstore/update) (versão sempre maior que a publicada)
- [Image guidelines](https://developer.chrome.com/docs/webstore/images)
- [Review process](https://developer.chrome.com/docs/webstore/review-process)
- [User Data Policy — FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) (perguntas 3 e 6)
