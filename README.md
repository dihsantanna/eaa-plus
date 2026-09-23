# EAA+ — Melhorias para alunos

Extensão do Chrome que adiciona à página de
[Aulas Síncronas](https://escoladeadoracaoearte.com.br/aulas-sincronas-graduacao-ead/)
da Escola de Adoração e Arte:

- **Filtro por período** — abas Todos / 1º a 4º, fixas no topo ao rolar.
- **Próxima aula** — com link, contagem regressiva, "AO VIVO AGORA" e setas
  para percorrer as seguintes (inclusive aulas no mesmo horário).

Projeto independente de aluno, sem vínculo oficial com a EAA ou a FABAT.
Não coleta dados, não faz requisições de rede, roda só nessa página.

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
