/* EAA+ · melhoria: progresso nas disciplinas
 *
 * Página: AVA Brightspace (batistas.brightspace.com/d2l/home)
 *
 * 1. Em cada card de "Minhas Disciplinas": a nota da Av1 e, para cada prazo
 *    (no curso de Música a Av1 fecha em duas datas: "Primeiro Fechamento" e
 *    "Último Fechamento"), uma barra com um bloco por atividade e o estado
 *    mais importante daquele prazo.
 * 2. Acima dos cards: o próximo prazo comum às disciplinas visíveis, quantas
 *    atividades já foram entregues e em quais disciplinas ainda falta algo.
 *
 * Regra de aprovação (Manual do Aluno EaD 2026, p. 29):
 *   Av1 (atividades dos módulos, 5,0) + Av2 (presencial, 5,0) >= 6,0 aprova.
 *   Entre 4,0 e 6,0 vai para Av3 (recuperação). Abaixo de 4,0 reprova.
 * Os valores máximos vêm do boletim de cada disciplina, não são fixos aqui.
 *
 * De onde vêm os dados: rotas do próprio Brightspace, no mesmo domínio, com a
 * sessão do aluno. Só GET. Nada é gravado nem enviado para fora — os dados
 * ficam na memória da aba enquanto ela está aberta.
 *
 * A API não conta se o aluno fez um questionário (tentativas dão 403), e na
 * maioria das disciplinas o questionário não é tópico de conteúdo. A única
 * fonte é a página "Lista de questionários", que mostra "1 / 1" e
 * "Tentativa em andamento". Ela é lida com DOMParser, que não executa nada.
 *
 * Os cards ficam dentro de 4 camadas de shadow DOM e são recriados quando o
 * aluno troca de aba. Por isso a melhoria procura cards novos a cada segundo
 * em vez de observar mutações, que não atravessam shadow roots. Se algo
 * falhar, o card fica exatamente como era.
 */

EAAPlus.add({
  id: "ava-progresso",

  init: function () {
    var raiz = document.querySelector("d2l-my-courses-v2");
    if (!raiz) return false;

    var API = "/d2l/api/le/1.99/";
    var LISTA_QUESTIONARIOS = "/d2l/lms/quizzing/user/quizzes_list.d2l?ou=";
    var MARCA = "eaa-prog";
    var RESUMO_ID = "eaa-resumo";
    var APROVA = 6;
    var RECUPERA = 4;
    var PARALELO = 4;
    var VARREDURA_MS = 1000;
    var MAX_PRAZOS = 4;
    var TZ = "America/Sao_Paulo";

    /* Grade de 4px. Toda linha é "rótulo | valor" com as mesmas margens. */
    var CSS =
      ".eaa-prog{margin-top:12px;font:400 12px/16px Lato,'Lucida Sans Unicode',sans-serif;color:#494c4e;display:grid;gap:8px}" +
      ".eaa-prog *{box-sizing:border-box;margin:0;padding:0}" +
      ".eaa-par{display:flex;justify-content:space-between;align-items:baseline;gap:8px;min-width:0}" +
      ".eaa-par>:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".eaa-par>:last-child{flex:none;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}" +
      ".eaa-cab{font-weight:700;color:#202122}" +
      ".eaa-cab>:last-child{font-size:13px}" +
      ".eaa-prazo{display:grid;gap:4px}" +
      ".eaa-prazo .eaa-nome{font-weight:700;color:#202122}" +
      ".eaa-prazo.urgente .eaa-quando{color:#cd2026;font-weight:700}" +
      ".eaa-prazo.encerrado{opacity:.72}" +
      ".eaa-seg{display:flex;gap:2px;height:6px}" +
      ".eaa-seg i{flex:1 1 0;border-radius:3px;background:#e3e9f1}" +
      ".eaa-seg .corrigida{background:#46a661}" +
      ".eaa-seg .aguardando{background:#ffba59}" +
      ".eaa-seg .iniciada{background:#e87511}" +
      ".eaa-seg .perdida{background:#cd2026}" +
      ".eaa-leg{color:#6e7477}" +
      ".eaa-tag{font-weight:700}" +
      ".eaa-tag.corrigida{color:#2c7a43}" +
      ".eaa-tag.aguardando{color:#8a5300}" +
      ".eaa-tag.iniciada{color:#b34f00}" +
      ".eaa-tag.perdida{color:#cd2026}" +
      ".eaa-sit{height:24px;line-height:24px;border-radius:4px;text-align:center;font-weight:700;background:#f1f5fb;color:#202122}" +
      ".eaa-sit.aprovado{background:#e8f5ec;color:#2c7a43}" +
      ".eaa-sit.recuperacao{background:#fff4e0;color:#8a5300}" +
      ".eaa-sit.reprovado{background:#fdecec;color:#a3181e}" +
      ".eaa-carregando{color:#6e7477;font-style:italic}" +
      /* Simetria entre cards vizinhos: os títulos têm 1 a 3 linhas, então o
         bloco visível fica preso ao pé do card (o .d2l-card-container é
         position:relative) e uma cópia invisível reserva a altura. */
      ".eaa-prog.fantasma{visibility:hidden}" +
      ".eaa-prog.real{position:absolute;left:16px;right:16px;bottom:24px;margin:0}";

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

    /* ---------------------------------------------------------------
     * Dados de uma disciplina
     *
     * Boletim → o que já foi corrigido. Tarefas e questionários → prazos,
     * ligados ao boletim pelo GradeItemId. Para saber se o aluno fez algo que
     * ainda não tem nota: envios da tarefa (mysubmissions), conclusão do
     * tópico de conteúdo (toc + myItems) e a Lista de questionários.
     * ------------------------------------------------------------- */
    var cache = {};

    function dados(ou) {
      if (!cache[ou]) {
        cache[ou] = baixar(ou).catch(function (erro) {
          delete cache[ou]; /* deixa tentar de novo quando o card voltar */
          throw erro;
        });
      }
      return cache[ou];
    }

    function baixar(ou) {
      var base = API + ou + "/";
      return Promise.all([
        pegar(base + "grades/"),
        pegar(base + "grades/values/myGradeValues/"),
        pegar(base + "dropbox/folders/").then(lista, vazio),
        pegar(base + "quizzes/").then(lista, vazio),
        pegar(base + "content/toc").then(null, nada),
        pegar(base + "content/myItems/").then(lista, vazio),
        pegar(LISTA_QUESTIONARIOS + ou, true).then(lerListaDeQuestionarios, function () {
          return {};
        })
      ]).then(function (r) {
        var itens = classificar(r[0], r[1], r[2], r[3], r[4], r[5], r[6]);
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
          return resumir(itens, r[1]);
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
          andamento: /em andamento/i.test(celulas.length > 2 ? texto(celulas[1]) : "")
        };
      }
      return mapa;
    }

    function texto(el) {
      return (el.textContent || "").replace(/\s+/g, " ").trim();
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

    function classificar(boletim, valores, pastas, questionarios, toc, meusItens, listaQ) {
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

      return boletim
        .filter(function (g) {
          return g.GradeType === "Numeric" && !g.IsHidden && g.MaxPoints > 0;
        })
        .map(function (g) {
          var it = {
            nome: g.Name,
            max: g.MaxPoints,
            pontos: null,
            prazo: null,
            tarefa: null,
            secao: "",
            enviado: !!feitoPeloConteudo[g.Id],
            andamento: false,
            estado: null
          };

          pastas.forEach(function (p) {
            if (p.GradeItemId !== g.Id || p.IsHidden) return;
            it.tarefa = p.Id;
            it.prazo = ts(p.DueDate) || ts((p.Availability || {}).EndDate);
          });
          questionarios.forEach(function (q) {
            if (q.GradeItemId !== g.Id || q.IsActive === false) return;
            it.prazo = ts(q.DueDate) || ts(q.EndDate);
            var l = listaQ[String(q.QuizId)];
            if (l) {
              it.secao = l.secao;
              it.andamento = l.andamento;
              if (l.usadas > 0 && !l.andamento) it.enviado = true;
            }
          });

          var v = nota[String(g.Id)];
          if (v && v.PointsNumerator !== null && v.PointsNumerator !== undefined) {
            it.pontos = v.PointsNumerator;
            it.estado = "corrigida";
          }
          return it;
        });
    }

    function formula(valores, n) {
      var re = new RegExp("^\\s*nota\\s*av\\s*" + n + "\\b", "i");
      for (var i = 0; i < valores.length; i++) {
        if (re.test(valores[i].GradeObjectName)) return valores[i];
      }
      return null;
    }

    /* "Avaliação 1 (Av1) - Último Fechamento", 2º grupo →
       curto "2º Fechamento" (mesma largura em todas as linhas do card),
       longo "Av1 · Último Fechamento" (nome oficial, no resumo). */
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
      itens.forEach(function (it) {
        it.estado = estadoFinal(it, agora);
      });

      var r = { total: 0, ok: 0, av1: 0, av1Max: 0, av2: null, comAv: false, prazos: [] };
      itens.forEach(function (it) {
        r.total += it.max;
        if (it.estado === "corrigida") r.ok += it.pontos;
      });

      /* Um grupo por dia de prazo (Brasília). O curso de Música tem dois. */
      var porDia = {};
      itens.forEach(function (it) {
        var chave = it.prazo ? diaDe(it.prazo) : "sem";
        if (!porDia[chave]) porDia[chave] = { dia: chave, prazo: it.prazo, itens: [], secao: "" };
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

      grupos.forEach(function (g, i) {
        var nomes = nomesDoPrazo(g.secao, i + 1);
        if (!g.prazo) nomes = { curto: "Sem prazo", longo: "Sem prazo" };
        g.curto = nomes ? nomes.curto : grupos.length > 1 ? i + 1 + "º prazo" : "Prazo";
        g.longo = nomes ? nomes.longo : "Próximo prazo";
        g.c = contar(g.itens);
      });
      r.prazos = grupos;

      /* Disciplinas como Canto Coral e Atividades Extensionistas não têm
         Av1/Av2: é um item só, valendo 10. Ali a regra do manual não se
         aplica, então mostramos só a nota, sem situação. */
      var f1 = formula(valores, 1);
      var f2 = formula(valores, 2);
      r.comAv = !!f1;
      r.av1 = f1 && f1.PointsNumerator !== null ? f1.PointsNumerator : r.ok;
      r.av1Max = f1 && f1.PointsDenominator ? f1.PointsDenominator : r.total;
      /* A fórmula da Av2 vale 0 até a prova ser lançada; 0 não é resultado. */
      if (f2 && f2.PointsNumerator > 0) r.av2 = f2.PointsNumerator;
      r.c = contar(itens);
      return r;
    }

    /* ---------------------------------------------------------------
     * Desenho dentro do card
     * ------------------------------------------------------------- */
    function situacao(r) {
      if (!r.comAv) return null;
      if (r.av2 !== null) {
        var soma = r.av1 + r.av2;
        if (soma >= APROVA) return ["aprovado", "Aprovado · " + num(soma)];
        if (soma >= RECUPERA) return ["recuperacao", "Av3 (recuperação) · " + num(soma)];
        return ["reprovado", "Reprovado · " + num(soma)];
      }
      if (r.c.aguardando || r.c.pendentes) return null;
      var resta = Math.max(0, APROVA - r.av1);
      if (resta === 0) return ["aprovado", "Av1 já garante os " + num(APROVA)];
      return ["", "Precisa de " + num(resta) + " na Av2"];
    }

    /* O estado que mais pede atenção naquele prazo, sempre à direita. */
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
      perdida: "perdida",
      afazer: "a fazer"
    };

    function segmentos(itens) {
      return (
        '<div class="eaa-seg" aria-hidden="true">' +
        itens
          .map(function (it) {
            return '<i class="' + it.estado + '"></i>';
          })
          .join("") +
        "</div>"
      );
    }

    function linhaDoPrazo(g) {
      var d = destaque(g.c);
      var quando = g.prazo ? data(g.prazo) + " · " + falta(g.prazo) : "sem data";
      var encerrado = g.prazo && g.prazo < Date.now();
      var urgente = !encerrado && g.prazo && g.c.pendentes && diasAte(g.prazo) <= 1;
      var leitura =
        g.curto + ", " + quando + ": " +
        g.c.itens
          .map(function (it) {
            return it.nome + " " + ROTULO[it.estado];
          })
          .join("; ");
      return (
        '<div class="eaa-prazo' + (encerrado ? " encerrado" : "") + (urgente ? " urgente" : "") +
        '" role="group" aria-label="' + esc(leitura) + '">' +
        '<div class="eaa-par"><span class="eaa-nome">' + esc(g.curto) + '</span><span class="eaa-quando">' + esc(quando) + "</span></div>" +
        segmentos(g.c.itens) +
        '<div class="eaa-par eaa-leg"><span>' + g.c.entregues + " de " + g.c.itens.length + " entregues</span>" +
        '<span class="eaa-tag ' + d[0] + '">' + d[1] + "</span></div>" +
        "</div>"
      );
    }

    function html(r) {
      var rotulo = r.comAv ? "Av1" : "Nota";
      var saida =
        '<div class="eaa-par eaa-cab"><span class="eaa-rot">' + rotulo + "</span>" +
        '<span class="eaa-val">' + num(r.av1) + " / " + num(r.av1Max) + "</span></div>" +
        r.prazos.map(linhaDoPrazo).join("");
      var s = situacao(r);
      if (s) saida += '<div class="eaa-sit ' + s[0] + '">' + s[1] + "</div>";
      return saida;
    }

    function preparar(sombra) {
      if (!sombra.querySelector("style[data-eaa]")) {
        var estilo = document.createElement("style");
        estilo.setAttribute("data-eaa", "");
        estilo.textContent = CSS;
        sombra.appendChild(estilo);
      }
    }

    /* ---------------------------------------------------------------
     * Resumo acima dos cards: o próximo prazo de todas as visíveis
     * ------------------------------------------------------------- */
    var prontos = {}; /* ou → { r, nome } */

    function resumoGeral(visiveis) {
      var agora = Date.now();
      var alvo = null;
      visiveis.forEach(function (ou) {
        var p = prontos[ou];
        if (!p) return;
        p.r.prazos.forEach(function (g) {
          if (g.prazo && g.prazo >= agora && (!alvo || diaDe(g.prazo) < alvo)) alvo = diaDe(g.prazo);
        });
      });
      if (!alvo) return null;

      var res = { prazo: 0, longo: "", itens: [], disciplinas: [], iniciadas: 0 };
      visiveis.forEach(function (ou) {
        var p = prontos[ou];
        if (!p) return;
        p.r.prazos.forEach(function (g) {
          if (!g.prazo || diaDe(g.prazo) !== alvo) return;
          res.prazo = Math.max(res.prazo, g.prazo);
          if (!res.longo && g.secao) res.longo = g.longo;
          res.itens = res.itens.concat(g.c.itens);
          res.iniciadas += g.c.iniciada;
          if (g.c.pendentes) res.disciplinas.push({ ou: ou, nome: p.nome, pendentes: g.c.pendentes, iniciada: g.c.iniciada });
        });
      });
      res.c = contar(res.itens);
      res.longo = res.longo || "Próximo prazo";
      return res;
    }

    function curto(nome) {
      var antes = nome.split(":")[0].trim();
      return antes.length >= 3 ? antes : nome;
    }

    /* Uma legenda só, no resumo (os cards não têm largura para ela). Sempre os
       cinco estados, na mesma ordem, para o aluno aprender uma vez. */
    var LEGENDA = [
      ["corrigida", "Corrigida"],
      ["aguardando", "Aguardando correção"],
      ["iniciada", "Iniciada, não enviada"],
      ["perdida", "Prazo perdido"],
      ["afazer", "A fazer"]
    ];

    function legenda() {
      return (
        '<ul class="eaa-r-legenda" aria-label="Legenda das cores">' +
        LEGENDA.map(function (l) {
          return '<li><i class="' + l[0] + '"></i>' + l[1] + "</li>";
        }).join("") +
        "</ul>"
      );
    }

    function htmlDoResumo(res) {
      var urgente = res.c.pendentes && diasAte(res.prazo) <= 1;
      var tudo = !res.c.pendentes;
      var direita = tudo
        ? '<span class="eaa-r-tag corrigida">✓ tudo entregue</span>'
        : '<span class="eaa-r-tag' + (res.iniciadas ? " iniciada" : "") + '">' +
          (res.iniciadas ? "⚠ " + plural(res.iniciadas, "não enviada", "não enviadas") + " · " : "") +
          "faltam " + res.c.pendentes + "</span>";
      var fichas = res.disciplinas
        .map(function (d) {
          return (
            '<a class="eaa-r-ficha' + (d.iniciada ? " iniciada" : "") + '" href="/d2l/home/' + d.ou + '" title="' + esc(d.nome) + '">' +
            '<span class="eaa-r-fnome">' + esc(curto(d.nome)) + '</span><span class="eaa-r-fnum">' + d.pendentes + "</span></a>"
          );
        })
        .join("");
      return (
        '<div class="eaa-r-par"><span class="eaa-r-titulo">' + esc(res.longo) + "</span>" +
        '<span class="eaa-r-quando' + (urgente ? " urgente" : "") + '">' +
        data(res.prazo) + " às " + hora(res.prazo) + " · " + falta(res.prazo, true) + "</span></div>" +
        segmentos(res.c.itens).replace("eaa-seg", "eaa-seg eaa-r-seg") +
        '<div class="eaa-r-par eaa-r-leg"><span>' + res.c.entregues + " de " + res.c.itens.length +
        " atividades entregues</span>" + direita + "</div>" +
        (fichas ? '<div class="eaa-r-fichas">' + fichas + "</div>" : "") +
        legenda()
      );
    }

    function atualizarResumo(visiveis) {
      var alvo = document.querySelector("d2l-my-courses-v2");
      if (!alvo || !alvo.parentNode) return;
      var caixa = document.getElementById(RESUMO_ID);
      var res = resumoGeral(visiveis);
      if (!res || !res.c.itens.length) {
        if (caixa) caixa.remove();
        return;
      }
      var novo = htmlDoResumo(res);
      if (!caixa) {
        caixa = document.createElement("section");
        caixa.id = RESUMO_ID;
        caixa.setAttribute("aria-label", "Próximo prazo das disciplinas");
      }
      if (caixa.nextSibling !== alvo) alvo.parentNode.insertBefore(caixa, alvo);
      if (caixa.getAttribute("data-html") !== novo) {
        caixa.setAttribute("data-html", novo);
        caixa.innerHTML = novo;
      }
    }

    /* ---------------------------------------------------------------
     * Cards
     * ------------------------------------------------------------- */
    function processar(card, ou) {
      var sombra = card.shadowRoot;
      var cartao = sombra && sombra.querySelector("d2l-card");
      if (!cartao) return;
      var cabecalho = cartao.querySelector(".d2l-enrollment-card-content-flex");
      if (!cabecalho) return; /* ainda montando */
      if (cartao.querySelector("." + MARCA)) return;

      preparar(sombra);
      var fantasma = document.createElement("div");
      fantasma.className = MARCA + " fantasma";
      fantasma.setAttribute("slot", "content");
      fantasma.setAttribute("aria-hidden", "true");
      var bloco = document.createElement("div");
      bloco.className = MARCA + " real";
      bloco.setAttribute("slot", "content");
      var escrever = function (conteudo) {
        fantasma.innerHTML = bloco.innerHTML = conteudo;
      };
      var remover = function () {
        fantasma.remove();
        bloco.remove();
      };
      escrever('<span class="eaa-carregando">Carregando progresso…</span>');
      cartao.appendChild(fantasma);
      cartao.appendChild(bloco);

      /* O nome visível fica em outro shadow root; o atributo text do d2l-card
         traz "Técnica Vocal I, Mus_EAD_85284_2026_2_275, 2026.2". */
      var nome = (cartao.getAttribute("text") || "").replace(/,\s*[^\s,]*_[^,]*(,.*)?$/, "").trim() || "Disciplina";

      dados(ou).then(
        function (r) {
          if (!r.total) return remover();
          prontos[ou] = { r: r, nome: nome };
          escrever(html(r));
        },
        function (erro) {
          remover();
          if (window.console && console.warn) console.warn("[EAA+] progresso da disciplina " + ou + ":", erro);
        }
      );
    }

    function cards(no, saida) {
      var filhos = no.querySelectorAll("*");
      for (var i = 0; i < filhos.length; i++) {
        var el = filhos[i];
        if (el.tagName === "D2L-MY-COURSES-ENROLLMENT-CARD") saida.push(el);
        else if (el.shadowRoot) cards(el.shadowRoot, saida);
      }
      return saida;
    }

    function varrer() {
      var r = document.querySelector("d2l-my-courses-v2");
      if (!r || !r.shadowRoot) return;
      var visiveis = [];
      cards(r.shadowRoot, []).forEach(function (card) {
        var ou = (card.id || "").replace(/^enrollment-card-/, "");
        /* Só os visíveis: as outras abas carregam quando forem abertas. */
        if (!/^\d+$/.test(ou) || !card.getClientRects().length) return;
        visiveis.push(ou);
        processar(card, ou);
      });
      atualizarResumo(visiveis);
    }

    varrer();
    setInterval(varrer, VARREDURA_MS);
    return true;
  }
});
