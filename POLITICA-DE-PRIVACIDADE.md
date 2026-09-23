# Política de privacidade — EAA+ Melhorias para alunos

*Última atualização: 23 de setembro de 2026 · vale a partir da versão 1.1.0*

O EAA+ é uma extensão do Chrome feita por um aluno da Escola de Adoração e
Arte (FABAT), sem vínculo oficial com a instituição. Esta página explica,
sem letra miúda, o que a extensão faz com os seus dados.

## Resumo

**Nenhum dado seu sai do seu navegador.** A extensão não tem servidor, não
coleta, não vende e não compartilha nada. O que ela lê do AVA fica guardado
por no máximo 10 minutos, só na memória do navegador, para não pedir tudo de
novo ao AVA a cada página (detalhes abaixo).

## Onde a extensão roda

Somente em duas páginas:

1. `https://escoladeadoracaoearte.com.br/aulas-sincronas-graduacao-ead/`
2. `https://batistas.brightspace.com/d2l/…` (página inicial do AVA e páginas
   das suas disciplinas)

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
contagem de atividades, o próximo prazo, a lista de atividades de cada
disciplina e a situação da disciplina na tela.

Ela também lê o **número interno do usuário logado** que o próprio AVA
coloca na página, só para separar os dados guardados caso outra pessoa entre
com outra conta no mesmo navegador.

## Por quanto tempo os dados ficam guardados

Para não repetir as mesmas consultas ao AVA a cada página, a extensão guarda
o que leu no `chrome.storage.session` do Chrome:

- fica **só na memória** do navegador, nunca no disco, e só a extensão
  enxerga (o site não tem acesso);
- vale por **no máximo 10 minutos**; ao entrar numa disciplina, os dados dela
  são apagados e lidos de novo;
- guarda só o necessário: notas liberadas, prazos e se cada atividade foi
  enviada — sem textos de enunciados;
- tudo é apagado ao **fechar o navegador**, ao trocar de conta no AVA, ao
  clicar em "Atualizar" no resumo ou quando a extensão é atualizada ou
  desativada.

## O que a extensão não faz

- Não envia dados para nenhum servidor — nem da extensão, nem de terceiros.
- Não grava nada no disco: não usa cookies próprios, `localStorage`,
  `chrome.storage.local` nem `chrome.storage.sync`.
- Não lê sua senha, seu nome, sua matrícula, suas mensagens ou seu histórico
  de navegação.
- Não altera nada no AVA: nenhuma entrega, resposta ou configuração.
- Não usa os dados para publicidade, análise de crédito ou qualquer finalidade
  além de mostrar o progresso para você.

## Confira sempre no AVA

A extensão só reorganiza o que o próprio AVA informa; ela não é uma fonte
oficial. Se a escola mudar a forma como o AVA mostra as avaliações, a
extensão pode interpretar algo errado até ser corrigida. **Em caso de
diferença, vale o que está no AVA** — confira prazos, entregas e notas lá
antes de tomar qualquer decisão.

## Permissões

A extensão pede uma única permissão, `storage`, usada só para o
armazenamento temporário descrito acima (o Chrome não mostra aviso na
instalação por ela). O acesso às duas páginas vem apenas da declaração de
onde ela roda (`content_scripts`).

## Contato

Dúvidas ou problemas: <diogosantanna08@gmail.com>
