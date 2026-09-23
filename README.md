# EAA+ — Melhorias para alunos

Extensão do Chrome para alunos da Escola de Adoração e Arte.

Na página de
[Aulas Síncronas](https://escoladeadoracaoearte.com.br/aulas-sincronas-graduacao-ead/):

- **Filtro por período** — abas Todos / 1º a 4º, fixas no topo ao rolar.
- **Próxima aula** — com link, contagem regressiva, "AO VIVO AGORA" e setas
  para percorrer as seguintes (inclusive aulas no mesmo horário).

Na página inicial do [AVA](https://batistas.brightspace.com/d2l/home):

- **Progresso nas disciplinas** — em cada card, a Av1 corrigida, o que aguarda
  correção, o que ficou para trás, o próximo prazo e quanto falta na Av2.

Projeto independente de aluno, sem vínculo oficial com a EAA ou a FABAT.
Roda só nessas duas páginas. Nada sai do navegador: no AVA, lê as notas do
próprio aluno pela API do Brightspace (só leitura, com a sessão dele) e não
guarda nada. Detalhes em [`POLITICA-DE-PRIVACIDADE.md`](POLITICA-DE-PRIVACIDADE.md).

## Desenvolvimento

```bash
npm install
npx playwright install chromium
npm test          # testes com a extensão carregada num Chromium real
npm run build     # gera dist/ (zip da loja + bloco para o Elementor)
```

Instalar localmente: `chrome://extensions` → Modo do desenvolvedor →
**Carregar sem compactação** → selecionar esta pasta.

Contexto completo para o Claude Code: [`CLAUDE.md`](CLAUDE.md).
Publicação na loja: [`GUIA-PUBLICACAO.md`](GUIA-PUBLICACAO.md).
