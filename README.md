# EAA+ — Melhorias para alunos

Extensão do Chrome para alunos da Escola de Adoração e Arte (EAA/FABAT) que
mostra, direto no [AVA](https://batistas.brightspace.com/d2l/home), o
progresso e os prazos das avaliações:

- **Progresso nas disciplinas** — em cada card da página inicial, a Av1
  corrigida, o que aguarda correção, o que ficou para trás, o próximo prazo e
  quanto falta na Av2. Acima dos cards, o próximo fechamento de todas elas.
- **Barra da disciplina** — em qualquer página de uma disciplina, a mesma
  barra na faixa de navegação, com a lista das atividades e o link de cada uma.

Projeto independente de aluno, sem vínculo oficial com a EAA ou a FABAT.
Roda só no AVA. Nada sai do navegador: lê as notas do próprio aluno pela API
do Brightspace (só leitura, com a sessão dele) e guarda por até 10 minutos, só
na memória. Detalhes em [`POLITICA-DE-PRIVACIDADE.md`](POLITICA-DE-PRIVACIDADE.md).

## Desenvolvimento

```bash
npm install
npx playwright install chromium
npm test          # testes unitários das regras + testes com a extensão num Chromium real
npm run dev       # recarga automática no Chrome (carregar .dev-build/ext uma vez)
npm run build     # build/ (extensão montada) + dist/eaa-plus-vX.Y.Z.zip (pacote da loja)
```

Código em TypeScript (`src/`), empacotado e minificado pelo esbuild. Para
instalar localmente, rode `npm run build` e, em `chrome://extensions` → Modo do
desenvolvedor → **Carregar sem compactação**, selecione a pasta `build/`.

Como funciona, passo a passo, e o porquê das decisões: [`ARQUITETURA.md`](ARQUITETURA.md).
Contexto completo para o Claude Code: [`CLAUDE.md`](CLAUDE.md).
Publicação na loja: [`GUIA-PUBLICACAO.md`](GUIA-PUBLICACAO.md).
