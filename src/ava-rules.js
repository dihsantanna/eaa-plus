/* EAA+ · regras do AVA (puras)
 *
 * Tudo o que decide O QUE MOSTRAR a partir dos dados crus da API: o estado de
 * cada atividade, os grupos por prazo, a situação pela regra do manual e os
 * textos. Não faz rede, não lê o DOM e não guarda nada — por isso roda também
 * em Node, nos testes unitários (tests/unit/ava-rules.test.mjs).
 *
 * Funções que dependem do relógio aceitam `now` opcional (padrão: agora);
 * os testes passam uma hora fixa.
 *
 * Regra de aprovação (Manual do Aluno EaD 2026, p. 29):
 *   Av1 (atividades dos módulos, 5,0) + Av2 (presencial, 5,0) >= 6,0 aprova.
 *   Entre 4,0 e 6,0 vai para Av3 (recuperação). Abaixo de 4,0 reprova.
 * Os valores máximos vêm do boletim de cada disciplina, não são fixos aqui.
 */

EAAPlus.avaRules = (function () {
  "use strict";

  var PASS_MARK = 6;
  var RECOVERY_MARK = 4;
  var MAX_DEADLINES = 4;
  var TZ = "America/Sao_Paulo";

  /* ---------------------------------------------------------------
   * Datas e números
   * ------------------------------------------------------------- */
  var fmtDay = null;
  var fmtDate = null;
  var fmtTime = null;
  try {
    fmtDay = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
    fmtDate = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
    fmtTime = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    fmtDay = null;
  }

  function ts(value) {
    var t = value ? Date.parse(value) : NaN;
    return isNaN(t) ? null : t;
  }

  /* Dia de calendário em Brasília, "2026-09-28". */
  function dayOf(t) {
    if (!fmtDay) return new Date(t).toISOString().slice(0, 10);
    return fmtDay.format(new Date(t));
  }

  function daysUntil(target, now) {
    var a = dayOf(now === undefined ? Date.now() : now).split("-");
    var b = dayOf(target).split("-");
    return Math.round((Date.UTC(+b[0], b[1] - 1, +b[2]) - Date.UTC(+a[0], a[1] - 1, +a[2])) / 86400000);
  }

  function formatDate(t) {
    return fmtDate ? fmtDate.format(new Date(t)) : new Date(t).toLocaleDateString();
  }

  function formatTime(t) {
    return fmtTime ? fmtTime.format(new Date(t)) : "";
  }

  /* "hoje" · "amanhã" · "5 dias" · "encerrado" */
  function timeLeft(t, prefix, now) {
    if (now === undefined) now = Date.now();
    if (t < now) return "encerrado";
    var d = daysUntil(t, now);
    if (d <= 0) return "hoje";
    if (d === 1) return "amanhã";
    return (prefix ? "em " : "") + d + " dias";
  }

  function formatNum(n) {
    return (Math.round(n * 10) / 10).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
  }

  function plural(n, one, many) {
    return n + " " + (n === 1 ? one : many);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ---------------------------------------------------------------
   * Leitura do boletim
   * ------------------------------------------------------------- */
  function isActivity(g) {
    return g.GradeType === "Numeric" && !g.IsHidden && g.MaxPoints > 0;
  }

  /* O boletim já diz o formato da disciplina: com "Nota AV1" (curso de
     Música) a barra terá 2 colunas; sem, 1 só. */
  function preview(gi) {
    var hasAv = (gi || []).some(function (g) {
      return /^\s*nota\s*av\s*1\b/i.test(g.Name);
    });
    return { hasAv: hasAv, label: hasAv ? "Av1" : "Nota", columns: hasAv ? 2 : 1 };
  }

  /* Poucas leituras: o que a 2ª leva precisa buscar, a partir da 1ª
   * (boletim, notas, tarefas, questionários).
   *   - hasQuiz:  Lista de questionários, só se houver questionário ativo;
   *   - unlinked: sumário do conteúdo + itens concluídos, só se houver
   *     atividade avaliada que não é tarefa nem questionário e está sem nota;
   *   - toCheck:  tarefas cujo envio precisa ser conferido (contam e ainda
   *     não têm nota). */
  function plan(gi, values, folders, quizzes) {
    var numericIds = {};
    gi.forEach(function (g) {
      if (isActivity(g)) numericIds[g.Id] = true;
    });
    var gradedIds = {};
    values.forEach(function (v) {
      if (v.PointsNumerator !== null && v.PointsNumerator !== undefined) gradedIds[String(v.GradeObjectIdentifier)] = true;
    });
    var linked = {};
    folders.concat(quizzes).forEach(function (a) {
      if (a.GradeItemId) linked[a.GradeItemId] = true;
    });
    return {
      hasQuiz: quizzes.some(function (q) {
        return q.IsActive !== false;
      }),
      unlinked: Object.keys(numericIds).some(function (id) {
        return !linked[id] && !gradedIds[id];
      }),
      toCheck: folders.filter(function (p) {
        if (p.IsHidden || gradedIds[String(p.GradeItemId)]) return false;
        return numericIds[p.GradeItemId] || whichAv("", p.Name);
      })
    };
  }

  function topics(toc) {
    var out = [];
    (function walk(modules) {
      (modules || []).forEach(function (m) {
        (m.Topics || []).forEach(function (t) {
          out.push(t);
        });
        walk(m.Modules);
      });
    })(toc && toc.Modules);
    return out;
  }

  /* Av2 e Av3: a nota das atividades fica oculta para o aluno até o
     lançamento, então elas não aparecem no boletim. Reconhece pela seção da
     Lista de questionários ("Avaliação 2 (Av2)") ou pelo nome. */
  function whichAv(section, name) {
    var m = (section || "").match(/\(\s*Av\s*([23])\s*\)|Avalia[çc][ãa]o\s*([23])\b/i);
    if (m) return +(m[1] || m[2]);
    m = (name || "").match(/\bAv\s*([23])\b/i);
    if (m) return +m[1];
    if (/recupera[çc][ãa]o/i.test((section || "") + " " + (name || ""))) return 3;
    return null;
  }

  function assignmentLink(ou, id) {
    return "/d2l/lms/dropbox/user/folder_submit_files.d2l?db=" + id + "&grpid=0&isprv=0&bp=0&ou=" + ou;
  }

  function quizLink(ou, id) {
    return "/d2l/lms/quizzing/user/quiz_summary.d2l?ou=" + ou + "&qi=" + id + "&cfql=1";
  }

  /* ---------------------------------------------------------------
   * Dados crus → atividades
   *
   * `raw` é o que ava-data.js leu (e o cache guarda):
   *   { gi, values, folders, quizzes, toc, myItems, quizList, submissions }
   * ------------------------------------------------------------- */
  function classify(ou, raw) {
    var grade = {};
    raw.values.forEach(function (v) {
      grade[String(v.GradeObjectIdentifier)] = v;
    });

    /* Atividade avaliada que é tópico de conteúdo (e não tarefa/questionário):
       o conteúdo diz se foi concluída e qual o prazo. */
    var myItemById = {};
    raw.myItems.forEach(function (i) {
      myItemById[i.ItemId] = i;
    });
    var byContent = {};
    topics(raw.toc).forEach(function (t) {
      if (!t.GradeItemId) return;
      var i = myItemById[t.TopicId] || {};
      byContent[t.GradeItemId] = {
        done: !!i.DateCompleted,
        deadline: ts(i.DueDate) || ts(i.EndDate) || ts(t.EndDateTime)
      };
    });

    var submissions = raw.submissions;
    var quizList = raw.quizList;
    var inGradebook = {};
    var items = raw.gi.filter(isActivity).map(function (g) {
      inGradebook[g.Id] = true;
      var it = newItem(g.Name, g.MaxPoints, 1);
      var c = byContent[g.Id];
      if (c) {
        it.submitted = c.done;
        it.deadline = c.deadline;
      }

      raw.folders.forEach(function (p) {
        if (p.GradeItemId !== g.Id || p.IsHidden) return;
        it.assignment = p.Id;
        it.deadline = ts(p.DueDate) || ts((p.Availability || {}).EndDate);
        it.link = assignmentLink(ou, p.Id);
        if (submissions.submittedIds[p.Id]) it.submitted = true;
        if (submissions.sections[p.Id]) it.section = submissions.sections[p.Id];
      });
      raw.quizzes.forEach(function (q) {
        if (q.GradeItemId !== g.Id || q.IsActive === false) return;
        it.deadline = ts(q.DueDate) || ts(q.EndDate);
        it.link = quizLink(ou, q.QuizId);
        applyAttempts(it, quizList[String(q.QuizId)]);
      });

      var v = grade[String(g.Id)];
      if (v && v.PointsNumerator !== null && v.PointsNumerator !== undefined) {
        it.points = v.PointsNumerator;
        it.state = "graded";
      }
      return it;
    });

    /* Av2/Av3: atividades cuja nota está oculta (fora do boletim visível).
       Entram sem pontos — só prazo, estado e link. */
    raw.quizzes.forEach(function (q) {
      if (q.IsActive === false || inGradebook[q.GradeItemId]) return;
      var l = quizList[String(q.QuizId)];
      var av = whichAv(l && l.section, q.Name);
      if (!av) return;
      var it = newItem(q.Name, 0, av);
      it.deadline = ts(q.DueDate) || ts(q.EndDate);
      it.link = quizLink(ou, q.QuizId);
      applyAttempts(it, l);
      items.push(it);
    });
    raw.folders.forEach(function (p) {
      if (p.IsHidden || inGradebook[p.GradeItemId]) return;
      var av = whichAv(submissions.sections[p.Id], p.Name);
      if (!av) return;
      var it = newItem(p.Name, 0, av);
      it.assignment = p.Id;
      it.deadline = ts(p.DueDate) || ts((p.Availability || {}).EndDate);
      it.link = assignmentLink(ou, p.Id);
      it.submitted = !!submissions.submittedIds[p.Id];
      it.section = submissions.sections[p.Id] || "";
      items.push(it);
    });
    return items;
  }

  function newItem(name, max, av) {
    return {
      name: name,
      max: max,
      av: av,
      points: null,
      deadline: null,
      assignment: null,
      link: "",
      section: "",
      submitted: false,
      inProgress: false,
      state: null
    };
  }

  function applyAttempts(it, l) {
    if (!l) return;
    it.section = l.section;
    it.inProgress = l.inProgress;
    if (l.used > 0 && !l.inProgress) it.submitted = true;
  }

  function formula(values, n) {
    var re = new RegExp("^\\s*nota\\s*av\\s*" + n + "\\b", "i");
    for (var i = 0; i < values.length; i++) {
      if (re.test(values[i].GradeObjectName)) return values[i];
    }
    return null;
  }

  /* "Avaliação 1 (Av1) - Último Fechamento", 2º grupo →
     curto "2º Fechamento" (mesma largura em todas as linhas),
     longo "Av1 · Último Fechamento" (nome oficial). */
  function deadlineNames(section, order) {
    var parts = section.split(/\s[-–]\s/);
    var end = parts.length > 1 ? parts[parts.length - 1] : "";
    var av = (section.match(/\((Av\s*\d)\)|^\s*(Av\s*\d)\b/i) || []).slice(1).filter(Boolean)[0];
    if (!end) return null;
    return {
      shortLabel: order + "º " + end.split(/\s+/).pop(),
      longLabel: (av ? av.replace(/\s/g, "") + " · " : "") + end
    };
  }

  /* ---------------------------------------------------------------
   * Atividades → estado, grupos e situação
   * ------------------------------------------------------------- */
  function finalState(it, now) {
    if (it.state) return it.state;
    var overdue = it.deadline && it.deadline < now;
    if (it.inProgress && !overdue) return "started";
    if (it.submitted || it.inProgress) return "awaiting";
    if (overdue) return "missed";
    return "todo";
  }

  function tally(items) {
    var c = { items: items, graded: 0, awaiting: 0, started: 0, missed: 0, todo: 0 };
    items.forEach(function (it) {
      c[it.state]++;
    });
    c.delivered = c.graded + c.awaiting;
    c.pending = c.todo + c.started;
    return c;
  }

  function summarize(items, values, now) {
    if (now === undefined) now = Date.now();
    var f1 = formula(values, 1);
    var f2 = formula(values, 2);
    var f3 = formula(values, 3);
    /* A fórmula vale 0 até a prova ser lançada; 0 não é resultado. */
    var released = { 2: !!(f2 && f2.PointsNumerator > 0), 3: !!(f3 && f3.PointsNumerator > 0) };

    items.forEach(function (it) {
      /* Nota da Av2/Av3 lançada: as atividades dela foram corrigidas. */
      if (it.av > 1 && released[it.av]) it.state = "graded";
      it.state = finalState(it, now);
    });

    var r = { total: 0, ok: 0, av1: 0, av1Max: 0, av2: null, av3: null, hasAv: false, deadlines: [] };
    items.forEach(function (it) {
      r.total += it.max;
      if (it.state === "graded" && it.points !== null) r.ok += it.points;
    });
    r.av1 = f1 && f1.PointsNumerator !== null ? f1.PointsNumerator : r.ok;

    /* A Av3 é aberta para a turma toda, mas só serve para quem ficou em
       recuperação (Av1 + Av2 entre 4 e 6). Sem isso ela sumiria da vista de
       quem precisa e apareceria como pendência para quem já passou. Fica
       também se o aluno já mexeu nela (iniciou, enviou ou tem nota). */
    var sum = released[2] ? r.av1 + f2.PointsNumerator : null;
    var inRecovery = !!f1 && sum !== null && sum >= RECOVERY_MARK && sum < PASS_MARK;
    items = items.filter(function (it) {
      return it.av !== 3 || inRecovery || it.state === "awaiting" || it.state === "started" || it.state === "graded";
    });

    /* Av1: um grupo por dia de prazo (Brasília) — o curso de Música tem dois
       fechamentos. Av2 e Av3: um grupo cada, com o nome delas. */
    var byDay = {};
    items.forEach(function (it) {
      var key = it.av > 1 ? "av" + it.av : it.deadline ? dayOf(it.deadline) : "sem";
      if (!byDay[key]) byDay[key] = { day: key, av: it.av > 1 ? it.av : 1, deadline: it.deadline, items: [], section: "" };
      var g = byDay[key];
      g.items.push(it);
      if (it.deadline && it.deadline > g.deadline) g.deadline = it.deadline;
      if (!g.section && it.section) g.section = it.section;
    });
    var groups = Object.keys(byDay)
      .map(function (k) {
        return byDay[k];
      })
      .sort(function (a, b) {
        return (a.deadline || Infinity) - (b.deadline || Infinity);
      })
      .slice(0, MAX_DEADLINES);

    var order = 0;
    groups.forEach(function (g) {
      var names;
      if (g.av === 2) names = { shortLabel: "Av2", longLabel: "Av2" };
      else if (g.av === 3) names = { shortLabel: "Av3", longLabel: "Av3 · Recuperação" };
      else if (!g.deadline) names = { shortLabel: "Sem prazo", longLabel: "Sem prazo" };
      else names = deadlineNames(g.section, ++order);
      g.named = !!names;
      var av1Only = groups.filter(function (x) {
        return x.av === 1;
      }).length;
      g.shortLabel = names ? names.shortLabel : av1Only > 1 ? order + "º prazo" : "Prazo";
      g.longLabel = names ? names.longLabel : "Próximo prazo";
      g.c = tally(g.items);
    });
    r.deadlines = groups;

    /* Disciplinas como Canto Coral e Atividades Extensionistas não têm
       Av1/Av2: é um item só, valendo 10. Ali a regra do manual não se
       aplica, então mostramos só a nota, sem situação. */
    r.hasAv = !!f1;
    r.label = r.hasAv ? "Av1" : "Nota";
    r.av1Max = f1 && f1.PointsDenominator ? f1.PointsDenominator : r.total;
    if (released[2]) r.av2 = f2.PointsNumerator;
    if (released[3]) r.av3 = f3.PointsNumerator;
    r.c = tally(items);
    /* Só a Av1 decide se já dá para dizer quanto falta na Av2. */
    r.c1 = tally(
      items.filter(function (it) {
        return it.av === 1;
      })
    );
    return r;
  }

  /* ---------------------------------------------------------------
   * Textos e peças de desenho comuns
   * ------------------------------------------------------------- */
  function standing(r) {
    if (!r.hasAv) return null;
    /* O manual não diz como a Av3 entra na média final: só mostra a nota. */
    if (r.av3 !== null) return ["", "Nota da Av3 · " + formatNum(r.av3)];
    if (r.av2 !== null) {
      var sum = r.av1 + r.av2;
      if (sum >= PASS_MARK) return ["passed", "Aprovado · " + formatNum(sum)];
      if (sum >= RECOVERY_MARK) return ["recovery", "Av3 (recuperação) · " + formatNum(sum)];
      return ["failed", "Reprovado · " + formatNum(sum)];
    }
    if (r.c1.awaiting || r.c1.pending) return null;
    var needed = Math.max(0, PASS_MARK - r.av1);
    if (needed === 0) return ["passed", "Av1 já garante os " + formatNum(PASS_MARK)];
    return ["", "Precisa de " + formatNum(needed) + " na Av2"];
  }

  /* O estado que mais pede atenção num prazo. */
  function highlight(c) {
    if (c.started) return ["started", "⚠ " + plural(c.started, "não enviada", "não enviadas")];
    if (c.missed) return ["missed", plural(c.missed, "perdida", "perdidas")];
    if (c.awaiting) return ["awaiting", c.awaiting + " aguardando"];
    if (c.graded && c.graded === c.items.length) return ["graded", "corrigido"];
    if (c.todo) return ["", c.todo + " a fazer"];
    return ["", ""];
  }

  var STATE_LABEL = {
    graded: "corrigida",
    awaiting: "aguardando correção",
    started: "iniciada e não enviada",
    missed: "prazo perdido",
    todo: "a fazer"
  };

  /* Sempre os cinco estados, na mesma ordem, para o aluno aprender uma vez. */
  var LEGEND = [
    ["graded", "Corrigida"],
    ["awaiting", "Aguardando correção"],
    ["started", "Iniciada, não enviada"],
    ["missed", "Prazo perdido"],
    ["todo", "A fazer"]
  ];

  function segments(items, cls) {
    return (
      '<div class="eaa-seg' + (cls ? " " + cls : "") + '" aria-hidden="true">' +
      items
        .map(function (it) {
          return '<i class="' + it.state + '"></i>';
        })
        .join("") +
      "</div>"
    );
  }

  function when(g, now) {
    return g.deadline ? formatDate(g.deadline) + " · " + timeLeft(g.deadline, false, now) : "sem data";
  }

  function urgent(g, now) {
    if (now === undefined) now = Date.now();
    return !!(g.deadline && g.deadline >= now && g.c.pending && daysUntil(g.deadline, now) <= 1);
  }

  return {
    PASS_MARK: PASS_MARK,
    RECOVERY_MARK: RECOVERY_MARK,
    ts: ts,
    dayOf: dayOf,
    daysUntil: daysUntil,
    formatDate: formatDate,
    formatTime: formatTime,
    timeLeft: timeLeft,
    formatNum: formatNum,
    plural: plural,
    esc: esc,
    isActivity: isActivity,
    preview: preview,
    plan: plan,
    whichAv: whichAv,
    classify: classify,
    finalState: finalState,
    tally: tally,
    summarize: summarize,
    standing: standing,
    highlight: highlight,
    STATE_LABEL: STATE_LABEL,
    LEGEND: LEGEND,
    segments: segments,
    when: when,
    urgent: urgent
  };
})();
