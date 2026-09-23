/* EAA+ · dados do AVA (compartilhado)
 *
 * Carregado logo depois de src/core.js no bloco do AVA. Não é uma melhoria:
 * é a camada que as melhorias do AVA usam (EAAPlus.ava), para a página
 * inicial e as páginas de disciplina contarem as atividades da mesma forma.
 *
 * De onde vêm os dados: rotas do próprio Brightspace, no mesmo domínio, com a
 * sessão do aluno. Só GET. Nada é gravado nem enviado para fora — os dados
 * ficam na memória da aba enquanto ela está aberta. Este é o ÚNICO arquivo com
 * acesso à rede; verificar-manifest.mjs cobra.
 *
 * Boletim → o que já foi corrigido. Tarefas e questionários → prazos, ligados
 * ao boletim pelo GradeItemId. Para saber se o aluno fez algo que ainda não
 * tem nota: envios da tarefa (mysubmissions), conclusão do tópico de conteúdo
 * (toc + myItems) e a página "Lista de questionários" — a API não conta as
 * tentativas de questionário (403) e na maioria das disciplinas o questionário
 * não é tópico de conteúdo. Essa página é lida com DOMParser, que não executa
 * nada.
 *
 * Regra de aprovação (Manual do Aluno EaD 2026, p. 29):
 *   Av1 (atividades dos módulos, 5,0) + Av2 (presencial, 5,0) >= 6,0 aprova.
 *   Entre 4,0 e 6,0 vai para Av3 (recuperação). Abaixo de 4,0 reprova.
 * Os valores máximos vêm do boletim de cada disciplina, não são fixos aqui.
 */

EAAPlus.ava = (function () {
  "use strict";

  var API = "/d2l/api/le/1.99/";
  var LISTA_QUESTIONARIOS = "/d2l/lms/quizzing/user/quizzes_list.d2l?ou=";
  var APROVA = 6;
  var RECUPERA = 4;
  var PARALELO = 4;
  var MAX_PRAZOS = 4;
  var TZ = "America/Sao_Paulo";

  /* ---------------------------------------------------------------
   * Rede: só GET, só caminhos do próprio AVA
   * ------------------------------------------------------------- */
  var fila = [];
  var ativos = 0;

  function mesmaOrigem(caminho) {
    /* "/x" resolve no domínio da página; "//x" ou "https:" sairiam dele. */
    if (!/^\/(?!\/)/.test(caminho)) throw new Error("caminho fora do AVA: " + caminho);
    return caminho;
  }

  function pegar(caminho, comoTexto) {
    return new Promise(function (ok, falha) {
      fila.push(function () {
        ativos++;
        fetch(mesmaOrigem(caminho), { credentials: "same-origin" })
          .then(function (r) {
            if (!r.ok) throw new Error(caminho + " respondeu " + r.status);
            return comoTexto ? r.text() : r.json();
          })
          .then(ok, falha)
          .then(function () {
            ativos--;
            proximo();
          });
      });
      proximo();
    });
  }

  function proximo() {
    while (ativos < PARALELO && fila.length) fila.shift()();
  }

  function lista(o) {
    if (Array.isArray(o)) return o;
    return (o && o.Objects) || [];
  }

  function vazio() {
    return [];
  }

  function nada() {
    return null;
  }

  /* ---------------------------------------------------------------
   * Datas e números
   * ------------------------------------------------------------- */
  var fmtDia = null;
  var fmtData = null;
  var fmtHora = null;
  try {
    fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
    fmtData = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
    fmtHora = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    fmtDia = null;
  }

  function ts(texto) {
    var t = texto ? Date.parse(texto) : NaN;
    return isNaN(t) ? null : t;
  }

  /* Dia de calendário em Brasília, "2026-09-28". */
  function diaDe(t) {
    if (!fmtDia) return new Date(t).toISOString().slice(0, 10);
    return fmtDia.format(new Date(t));
  }

  function diasAte(alvo) {
    var a = diaDe(Date.now()).split("-");
    var b = diaDe(alvo).split("-");
    return Math.round((Date.UTC(+b[0], b[1] - 1, +b[2]) - Date.UTC(+a[0], a[1] - 1, +a[2])) / 86400000);
  }

  function data(t) {
    return fmtData ? fmtData.format(new Date(t)) : new Date(t).toLocaleDateString();
  }

  function hora(t) {
    return fmtHora ? fmtHora.format(new Date(t)) : "";
  }

  /* "hoje" · "amanhã" · "5 dias" · "encerrado" */
  function falta(t, prefixo) {
    if (t < Date.now()) return "encerrado";
    var d = diasAte(t);
    if (d <= 0) return "hoje";
    if (d === 1) return "amanhã";
    return (prefixo ? "em " : "") + d + " dias";
  }

  function num(n) {
    return (Math.round(n * 10) / 10).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  }

  function plural(n, um, varios) {
    return n + " " + (n === 1 ? um : varios);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function texto(el) {
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  /* ---------------------------------------------------------------
   * Dados de uma disciplina
   * ------------------------------------------------------------- */
  var cache = {};
  var boletins = {};

  /* O boletim é a primeira leitura da fila e já diz o formato da disciplina:
     com "Nota AV1" (curso de Música) a barra terá 2 colunas; sem, 1 só.
     previa() usa a MESMA requisição de dados(), não faz outra. */
  function boletim(ou) {
    if (!boletins[ou]) {
      boletins[ou] = pegar(API + ou + "/grades/").catch(function (erro) {
        delete boletins[ou];
        throw erro;
      });
    }
    return boletins[ou];
  }

  function previa(ou) {
    return boletim(ou).then(function (gi) {
      var comAv = (gi || []).some(function (g) {
        return /^\s*nota\s*av\s*1\b/i.test(g.Name);
      });
      return { comAv: comAv, rotulo: comAv ? "Av1" : "Nota", colunas: comAv ? 2 : 1 };
    });
  }

  function dados(ou) {
    if (!cache[ou]) {
      cache[ou] = baixar(ou).catch(function (erro) {
        delete cache[ou]; /* deixa tentar de novo na próxima vez */
        throw erro;
      });
    }
    return cache[ou];
  }

  function baixar(ou) {
    var base = API + ou + "/";
    return Promise.all([
      boletim(ou),
      pegar(base + "grades/values/myGradeValues/"),
      pegar(base + "dropbox/folders/").then(lista, vazio),
      pegar(base + "quizzes/").then(lista, vazio),
      pegar(base + "content/toc").then(null, nada),
      pegar(base + "content/myItems/").then(lista, vazio),
      pegar(LISTA_QUESTIONARIOS + ou, true).then(lerListaDeQuestionarios, function () {
        return {};
      }),
      /* Nome oficial da disciplina. O atributo text do card não serve: já
         veio "Nome, código, semestre" e depois só "Fechada". */
      pegar("/d2l/api/lp/1.63/enrollments/myenrollments/" + ou).then(function (m) {
        return (m && m.OrgUnit && m.OrgUnit.Name) || "";
      }, function () {
        return "";
      })
    ]).then(function (r) {
      var itens = classificar(ou, r[0], r[1], r[2], r[3], r[4], r[5], r[6]);
      var envios = itens
        .filter(function (it) {
          return it.estado === null && it.tarefa && !it.enviado;
        })
        .map(function (it) {
          return pegar(base + "dropbox/folders/" + it.tarefa + "/submissions/mysubmissions/").then(
            function (e) {
              it.enviado = lista(e).some(function (x) {
                return x.Submissions && x.Submissions.length;
              });
            },
            function () {}
          );
        });
      return Promise.all(envios).then(function () {
        var resumo = resumir(itens, r[1]);
        resumo.nome = r[7];
        return resumo;
      });
    });
  }

  /* Página "Lista de questionários": uma tabela com uma seção por grupo de
   * avaliação ("Avaliação 1 (Av1) - Primeiro Fechamento") e, em cada linha,
   * o link GoToQuiz(id), o status e as tentativas "usadas / permitidas". */
  function lerListaDeQuestionarios(html) {
    var mapa = {};
    var doc = new DOMParser().parseFromString(html, "text/html");
    var secao = "";
    var linhas = doc.querySelectorAll("table.d2l-table tr");
    for (var i = 0; i < linhas.length; i++) {
      var tr = linhas[i];
      var celulas = tr.children;
      if (!celulas.length) continue;
      if (/\bd_gh\b/.test(tr.className)) {
        secao = texto(celulas[0]);
        continue;
      }
      var link = tr.querySelector("[onclick*='GoToQuiz(']");
      var id = link && (link.getAttribute("onclick").match(/GoToQuiz\((\d+)/) || [])[1];
      if (!id) continue;
      var usadas = (texto(celulas[celulas.length - 1]).match(/^(\d+)\s*\//) || [])[1];
      mapa[id] = {
        secao: secao,
        usadas: usadas ? parseInt(usadas, 10) : 0,
        /* A tentativa aberta é marcada por um ícone na própria linha. O
           texto "Tentativa em andamento" da coluna de status NÃO serve: é só
           o nome do link de feedback em questionários já corrigidos. */
        andamento: !!tr.querySelector("img[alt*='em andamento' i]")
      };
    }
    return mapa;
  }

  function topicos(toc) {
    var saida = [];
    (function andar(modulos) {
      (modulos || []).forEach(function (m) {
        (m.Topics || []).forEach(function (t) {
          saida.push(t);
        });
        andar(m.Modules);
      });
    })(toc && toc.Modules);
    return saida;
  }

  /* Av2 e Av3: a nota das atividades fica oculta para o aluno até o
     lançamento, então elas não aparecem no boletim. Reconhece pela seção da
     Lista de questionários ("Avaliação 2 (Av2)") ou pelo nome. */
  function qualAv(secao, nome) {
    var m = (secao || "").match(/\(\s*Av\s*([23])\s*\)|Avalia[çc][ãa]o\s*([23])\b/i);
    if (m) return +(m[1] || m[2]);
    m = (nome || "").match(/\bAv\s*([23])\b/i);
    if (m) return +m[1];
    if (/recupera[çc][ãa]o/i.test((secao || "") + " " + (nome || ""))) return 3;
    return null;
  }

  function linkDaTarefa(ou, id) {
    return "/d2l/lms/dropbox/user/folder_submit_files.d2l?db=" + id + "&grpid=0&isprv=0&bp=0&ou=" + ou;
  }

  function linkDoQuestionario(ou, id) {
    return "/d2l/lms/quizzing/user/quiz_summary.d2l?ou=" + ou + "&qi=" + id + "&cfql=1";
  }

  function classificar(ou, boletim, valores, pastas, questionarios, toc, meusItens, listaQ) {
    var nota = {};
    valores.forEach(function (v) {
      nota[String(v.GradeObjectIdentifier)] = v;
    });

    var concluido = {};
    meusItens.forEach(function (i) {
      if (i.DateCompleted) concluido[i.ItemId] = true;
    });
    var feitoPeloConteudo = {};
    topicos(toc).forEach(function (t) {
      if (t.GradeItemId && concluido[t.TopicId]) feitoPeloConteudo[t.GradeItemId] = true;
    });

    var noBoletim = {};
    var itens = boletim
      .filter(function (g) {
        return g.GradeType === "Numeric" && !g.IsHidden && g.MaxPoints > 0;
      })
      .map(function (g) {
        noBoletim[g.Id] = true;
        var it = novoItem(g.Name, g.MaxPoints, 1);
        it.enviado = !!feitoPeloConteudo[g.Id];

        pastas.forEach(function (p) {
          if (p.GradeItemId !== g.Id || p.IsHidden) return;
          it.tarefa = p.Id;
          it.prazo = ts(p.DueDate) || ts((p.Availability || {}).EndDate);
          it.link = linkDaTarefa(ou, p.Id);
        });
        questionarios.forEach(function (q) {
          if (q.GradeItemId !== g.Id || q.IsActive === false) return;
          it.prazo = ts(q.DueDate) || ts(q.EndDate);
          it.link = linkDoQuestionario(ou, q.QuizId);
          lerTentativas(it, listaQ[String(q.QuizId)]);
        });

        var v = nota[String(g.Id)];
        if (v && v.PointsNumerator !== null && v.PointsNumerator !== undefined) {
          it.pontos = v.PointsNumerator;
          it.estado = "corrigida";
        }
        return it;
      });

    /* Av2/Av3: atividades cuja nota está oculta (fora do boletim visível).
       Entram sem pontos — só prazo, estado e link. */
    questionarios.forEach(function (q) {
      if (q.IsActive === false || noBoletim[q.GradeItemId]) return;
      var l = listaQ[String(q.QuizId)];
      var av = qualAv(l && l.secao, q.Name);
      if (!av) return;
      var it = novoItem(q.Name, 0, av);
      it.prazo = ts(q.DueDate) || ts(q.EndDate);
      it.link = linkDoQuestionario(ou, q.QuizId);
      lerTentativas(it, l);
      itens.push(it);
    });
    pastas.forEach(function (p) {
      if (p.IsHidden || noBoletim[p.GradeItemId]) return;
      var av = qualAv("", p.Name);
      if (!av) return;
      var it = novoItem(p.Name, 0, av);
      it.tarefa = p.Id;
      it.prazo = ts(p.DueDate) || ts((p.Availability || {}).EndDate);
      it.link = linkDaTarefa(ou, p.Id);
      itens.push(it);
    });
    return itens;
  }

  function novoItem(nome, max, av) {
    return {
      nome: nome,
      max: max,
      av: av,
      pontos: null,
      prazo: null,
      tarefa: null,
      link: "",
      secao: "",
      enviado: false,
      andamento: false,
      estado: null
    };
  }

  function lerTentativas(it, l) {
    if (!l) return;
    it.secao = l.secao;
    it.andamento = l.andamento;
    if (l.usadas > 0 && !l.andamento) it.enviado = true;
  }

  function formula(valores, n) {
    var re = new RegExp("^\\s*nota\\s*av\\s*" + n + "\\b", "i");
    for (var i = 0; i < valores.length; i++) {
      if (re.test(valores[i].GradeObjectName)) return valores[i];
    }
    return null;
  }

  /* "Avaliação 1 (Av1) - Último Fechamento", 2º grupo →
     curto "2º Fechamento" (mesma largura em todas as linhas),
     longo "Av1 · Último Fechamento" (nome oficial). */
  function nomesDoPrazo(secao, ordem) {
    var partes = secao.split(/\s[-–]\s/);
    var fim = partes.length > 1 ? partes[partes.length - 1] : "";
    var av = (secao.match(/\((Av\s*\d)\)/i) || [])[1];
    if (!fim) return null;
    return {
      curto: ordem + "º " + fim.split(/\s+/).pop(),
      longo: (av ? av.replace(/\s/g, "") + " · " : "") + fim
    };
  }

  function estadoFinal(it, agora) {
    if (it.estado) return it.estado;
    var vencido = it.prazo && it.prazo < agora;
    if (it.andamento && !vencido) return "iniciada";
    if (it.enviado || it.andamento) return "aguardando";
    if (vencido) return "perdida";
    return "afazer";
  }

  function contar(itens) {
    var c = { itens: itens, corrigida: 0, aguardando: 0, iniciada: 0, perdida: 0, afazer: 0 };
    itens.forEach(function (it) {
      c[it.estado]++;
    });
    c.entregues = c.corrigida + c.aguardando;
    c.pendentes = c.afazer + c.iniciada;
    return c;
  }

  function resumir(itens, valores) {
    var agora = Date.now();
    var f1 = formula(valores, 1);
    var f2 = formula(valores, 2);
    var f3 = formula(valores, 3);
    /* A fórmula vale 0 até a prova ser lançada; 0 não é resultado. */
    var lancada = { 2: !!(f2 && f2.PointsNumerator > 0), 3: !!(f3 && f3.PointsNumerator > 0) };

    itens.forEach(function (it) {
      /* Nota da Av2/Av3 lançada: as atividades dela foram corrigidas. */
      if (it.av > 1 && lancada[it.av]) it.estado = "corrigida";
      it.estado = estadoFinal(it, agora);
    });

    var r = { total: 0, ok: 0, av1: 0, av1Max: 0, av2: null, av3: null, comAv: false, prazos: [] };
    itens.forEach(function (it) {
      r.total += it.max;
      if (it.estado === "corrigida" && it.pontos !== null) r.ok += it.pontos;
    });
    r.av1 = f1 && f1.PointsNumerator !== null ? f1.PointsNumerator : r.ok;

    /* A Av3 é aberta para a turma toda, mas só serve para quem ficou em
       recuperação (Av1 + Av2 entre 4 e 6). Sem isso ela sumiria da vista de
       quem precisa e apareceria como pendência para quem já passou. Fica
       também se o aluno já mexeu nela (iniciou, enviou ou tem nota). */
    var soma = lancada[2] ? r.av1 + f2.PointsNumerator : null;
    var emRecuperacao = !!f1 && soma !== null && soma >= RECUPERA && soma < APROVA;
    itens = itens.filter(function (it) {
      return it.av !== 3 || emRecuperacao || it.estado === "aguardando" || it.estado === "iniciada" || it.estado === "corrigida";
    });

    /* Av1: um grupo por dia de prazo (Brasília) — o curso de Música tem dois
       fechamentos. Av2 e Av3: um grupo cada, com o nome delas. */
    var porDia = {};
    itens.forEach(function (it) {
      var chave = it.av > 1 ? "av" + it.av : it.prazo ? diaDe(it.prazo) : "sem";
      if (!porDia[chave]) porDia[chave] = { dia: chave, av: it.av > 1 ? it.av : 1, prazo: it.prazo, itens: [], secao: "" };
      var g = porDia[chave];
      g.itens.push(it);
      if (it.prazo && it.prazo > g.prazo) g.prazo = it.prazo;
      if (!g.secao && it.secao) g.secao = it.secao;
    });
    var grupos = Object.keys(porDia)
      .map(function (k) {
        return porDia[k];
      })
      .sort(function (a, b) {
        return (a.prazo || Infinity) - (b.prazo || Infinity);
      })
      .slice(0, MAX_PRAZOS);

    var ordem = 0;
    grupos.forEach(function (g) {
      var nomes;
      if (g.av === 2) nomes = { curto: "Av2", longo: "Av2" };
      else if (g.av === 3) nomes = { curto: "Av3", longo: "Av3 · Recuperação" };
      else if (!g.prazo) nomes = { curto: "Sem prazo", longo: "Sem prazo" };
      else nomes = nomesDoPrazo(g.secao, ++ordem);
      g.nomeado = !!nomes;
      var soAv1 = grupos.filter(function (x) {
        return x.av === 1;
      }).length;
      g.curto = nomes ? nomes.curto : soAv1 > 1 ? ordem + "º prazo" : "Prazo";
      g.longo = nomes ? nomes.longo : "Próximo prazo";
      g.c = contar(g.itens);
    });
    r.prazos = grupos;

    /* Disciplinas como Canto Coral e Atividades Extensionistas não têm
       Av1/Av2: é um item só, valendo 10. Ali a regra do manual não se
       aplica, então mostramos só a nota, sem situação. */
    r.comAv = !!f1;
    r.rotulo = r.comAv ? "Av1" : "Nota";
    r.av1Max = f1 && f1.PointsDenominator ? f1.PointsDenominator : r.total;
    if (lancada[2]) r.av2 = f2.PointsNumerator;
    if (lancada[3]) r.av3 = f3.PointsNumerator;
    r.c = contar(itens);
    /* Só a Av1 decide se já dá para dizer quanto falta na Av2. */
    r.c1 = contar(
      itens.filter(function (it) {
        return it.av === 1;
      })
    );
    return r;
  }

  /* ---------------------------------------------------------------
   * Textos e peças de desenho comuns
   * ------------------------------------------------------------- */
  function situacao(r) {
    if (!r.comAv) return null;
    /* O manual não diz como a Av3 entra na média final: só mostra a nota. */
    if (r.av3 !== null) return ["", "Nota da Av3 · " + num(r.av3)];
    if (r.av2 !== null) {
      var soma = r.av1 + r.av2;
      if (soma >= APROVA) return ["aprovado", "Aprovado · " + num(soma)];
      if (soma >= RECUPERA) return ["recuperacao", "Av3 (recuperação) · " + num(soma)];
      return ["reprovado", "Reprovado · " + num(soma)];
    }
    if (r.c1.aguardando || r.c1.pendentes) return null;
    var resta = Math.max(0, APROVA - r.av1);
    if (resta === 0) return ["aprovado", "Av1 já garante os " + num(APROVA)];
    return ["", "Precisa de " + num(resta) + " na Av2"];
  }

  /* O estado que mais pede atenção num prazo. */
  function destaque(c) {
    if (c.iniciada) return ["iniciada", "⚠ " + plural(c.iniciada, "não enviada", "não enviadas")];
    if (c.perdida) return ["perdida", plural(c.perdida, "perdida", "perdidas")];
    if (c.aguardando) return ["aguardando", c.aguardando + " aguardando"];
    if (c.corrigida && c.corrigida === c.itens.length) return ["corrigida", "corrigido"];
    if (c.afazer) return ["", c.afazer + " a fazer"];
    return ["", ""];
  }

  var ROTULO = {
    corrigida: "corrigida",
    aguardando: "aguardando correção",
    iniciada: "iniciada e não enviada",
    perdida: "prazo perdido",
    afazer: "a fazer"
  };

  /* Sempre os cinco estados, na mesma ordem, para o aluno aprender uma vez. */
  var LEGENDA = [
    ["corrigida", "Corrigida"],
    ["aguardando", "Aguardando correção"],
    ["iniciada", "Iniciada, não enviada"],
    ["perdida", "Prazo perdido"],
    ["afazer", "A fazer"]
  ];

  function segmentos(itens, classe) {
    return (
      '<div class="eaa-seg' + (classe ? " " + classe : "") + '" aria-hidden="true">' +
      itens
        .map(function (it) {
          return '<i class="' + it.estado + '"></i>';
        })
        .join("") +
      "</div>"
    );
  }

  function quando(g) {
    return g.prazo ? data(g.prazo) + " · " + falta(g.prazo) : "sem data";
  }

  function urgente(g) {
    return !!(g.prazo && g.prazo >= Date.now() && g.c.pendentes && diasAte(g.prazo) <= 1);
  }

  return {
    dados: dados,
    previa: previa,
    diaDe: diaDe,
    diasAte: diasAte,
    data: data,
    hora: hora,
    falta: falta,
    num: num,
    plural: plural,
    esc: esc,
    contar: contar,
    situacao: situacao,
    destaque: destaque,
    segmentos: segmentos,
    quando: quando,
    urgente: urgente,
    ROTULO: ROTULO,
    LEGENDA: LEGENDA
  };
})();
