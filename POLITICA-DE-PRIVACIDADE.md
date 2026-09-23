# Política de privacidade — EAA+ Melhorias para alunos

*Última atualização: 23 de setembro de 2026 · vale a partir da versão 1.1.0*

O EAA+ é uma extensão do Chrome feita por um aluno da Escola de Adoração e
Arte (FABAT), sem vínculo oficial com a instituição. Esta página explica,
sem letra miúda, o que a extensão faz com os seus dados.

## Resumo

**Nenhum dado seu sai do seu navegador.** A extensão não tem servidor, não
coleta, não armazena, não vende e não compartilha nada.

## Onde a extensão roda

Somente em duas páginas:

1. `https://escoladeadoracaoearte.com.br/aulas-sincronas-graduacao-ead/`
2. `https://batistas.brightspace.com/d2l/home` (página inicial do AVA)

Em qualquer outro site ela não é carregada.

## Que dados ela lê e para quê

**Página de aulas síncronas.** Lê o calendário de aulas que já está na tela
(disciplina, professor, período, datas e horários) para montar o filtro por
período e o destaque da próxima aula.

**AVA (Brightspace).** Para mostrar o progresso em cada disciplina, consulta
páginas e a API do próprio Brightspace (`batistas.brightspace.com`), usando a
sessão em que você já está logado, **somente para leitura**:

- itens e notas liberadas do seu boletim;
- tarefas e questionários (nome, prazo e ligação com o boletim);
- se você já enviou uma tarefa, concluiu um tópico ou fez um questionário
  (página "Lista de questionários" de cada disciplina).

Esses dados são usados **apenas** para desenhar a barra de progresso, a
contagem de atividades, o próximo prazo e a situação da disciplina na tela.

## O que a extensão não faz

- Não envia dados para nenhum servidor — nem da extensão, nem de terceiros.
- Não guarda nada: os dados ficam na memória da aba e somem ao fechá-la ou
  recarregá-la. Não usa cookies próprios, `localStorage` nem `chrome.storage`.
- Não lê sua senha, seu nome, sua matrícula, suas mensagens ou seu histórico
  de navegação.
- Não altera nada no AVA: nenhuma entrega, resposta ou configuração.
- Não usa os dados para publicidade, análise de crédito ou qualquer finalidade
  além de mostrar o progresso para você.

## Permissões

A extensão não pede nenhuma permissão extra do Chrome. O acesso às duas
páginas acima vem apenas da declaração de onde ela roda (`content_scripts`).

## Contato

Dúvidas ou problemas: [PREENCHER — e-mail de contato que você quer tornar público]
