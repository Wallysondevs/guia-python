/* =====================================================================
   pysim.js — o "Experimente" do Guia Python, com Python DE VERDADE.
   O CPython 3.14 compilado para WebAssembly (Pyodide, MPL-2.0; CPython: PSF)
   fica em assets/py/ e só é baixado no primeiro clique em "Rodar". Ele roda
   num Web Worker (assets/py/py-worker.mjs + motor.mjs): a página não trava,
   e um laço infinito é parado encerrando o worker ("Parar" ou 10 segundos).

   Monta as caixas  <div class="trypy" data-goal="…" data-stdin="…" data-args="…">
   (contrato: CONTRIBUINDO.md, seções 3 e 4).
   Também roda no Node: tools/testar-missoes.js usa as funções puras daqui.
   ===================================================================== */
(function () {
  "use strict";
  var PY_BYTES = 6100000;    // download na 1ª vez (wasm.gz + stdlib; atualizado por tools/instalar-pyodide.sh)
  var PY_VERSAO = "3.14";
  var TEMPO_MAX = 10000;     // ms rodando sem parar (sem contar a espera pelo teclado nem o time.sleep)
  var FOLGA_SONO = 60000;    // no máximo 60 s de time.sleep não contam no limite
  var MAX_LINHAS = 3000;     // linhas mostradas no terminal (o resto é resumido)
  var PySim = { TEMPO_MAX: TEMPO_MAX };

  /* =====================================================================
     1. Funções puras (navegador e Node)
     ===================================================================== */
  function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  PySim.escHtml = escHtml;

  var ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", copy: "©", reg: "®", trade: "™", hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", bull: "•", middot: "·", deg: "°", times: "×", divide: "÷", euro: "€", pound: "£", cent: "¢", sect: "§", para: "¶", ordf: "ª", ordm: "º", larr: "←", rarr: "→", uarr: "↑", darr: "↓", harr: "↔", rArr: "⇒", check: "✓", aacute: "á", Aacute: "Á", eacute: "é", Eacute: "É", iacute: "í", Iacute: "Í", oacute: "ó", Oacute: "Ó", uacute: "ú", Uacute: "Ú", atilde: "ã", Atilde: "Ã", otilde: "õ", Otilde: "Õ", ccedil: "ç", Ccedil: "Ç", acirc: "â", Acirc: "Â", ecirc: "ê", Ecirc: "Ê", ocirc: "ô", Ocirc: "Ô", agrave: "à", Agrave: "À", uuml: "ü", Uuml: "Ü", ntilde: "ñ", Ntilde: "Ñ", le: "≤", ge: "≥", ne: "≠", shy: "\u00ad", zwj: "\u200d", thinsp: "\u2009", ensp: "\u2002", emsp: "\u2003" };
  function decodificarEntidades(s) {
    return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, function (t, n) {
      if (n.charAt(0) === "#") {
        var c = n.charAt(1).toLowerCase() === "x" ? parseInt(n.slice(2), 16) : parseInt(n.slice(1), 10);
        try { return String.fromCodePoint(c); } catch (e) { return t; }
      }
      return Object.prototype.hasOwnProperty.call(ENTIDADES, n) ? ENTIDADES[n] : t;
    });
  }
  PySim.decodificarEntidades = decodificarEntidades;

  /* Metas (data-goal): separadas por ";;" (CONTRIBUINDO §3). Nada de outros escapes. */
  var META_NOMES = ["out", "outre", "semerro", "erro", "exit", "src", "arquivo"];
  PySim.META_NOMES = META_NOMES;
  function dividirMetas(meta) {
    return String(meta || "").split(";;").map(function (x) { return x.replace(/^\s+/, ""); }).filter(Boolean);
  }
  PySim.dividirMetas = dividirMetas;
  function partesMeta(g) {
    var i = g.indexOf(":");
    return { tipo: (i < 0 ? g : g.slice(0, i)).trim(), val: i < 0 ? "" : g.slice(i + 1), temValor: i >= 0 };
  }
  PySim.partesMeta = partesMeta;

  // "/regex/flags" → RegExp; senão null (é texto)
  function regexDe(v) {
    var m = /^\/([\s\S]*)\/([dgimsuvy]*)$/.exec(v);
    if (!m) return null;
    return new RegExp(m[1], m[2].replace("g", ""));
  }
  PySim.regexDe = regexDe;
  function confere(v, txt) {
    var re = regexDe(v);
    return re ? re.test(txt) : txt.indexOf(v) >= 0;
  }

  /* Problemas de uma meta (para o testador): [] = ok */
  function validarMeta(meta) {
    var probs = [];
    var lista = dividirMetas(meta);
    if (!lista.length) probs.push("data-goal vazio");
    lista.forEach(function (g) {
      var p = partesMeta(g);
      if (META_NOMES.indexOf(p.tipo) < 0) { probs.push("meta desconhecida \"" + p.tipo + "\" em \"" + g + "\" (só " + META_NOMES.join(", ") + ")"); return; }
      if (p.tipo === "semerro") { if (p.temValor) probs.push("\"semerro\" não leva valor: \"" + g + "\""); return; }
      if (!p.val) { probs.push("meta sem valor: \"" + g + "\""); return; }
      try {
        if (p.tipo === "outre") new RegExp(p.val);
        else if (p.tipo === "src") new RegExp(p.val, "m");
        else if (p.tipo === "erro") regexDe(p.val);
      } catch (e) { probs.push("regex inválida em \"" + g + "\": " + e.message); }
      if (p.tipo === "exit" && !/^\s*\d{1,3}\s*$/.test(p.val)) probs.push("exit: precisa de um número: \"" + g + "\"");
      if (p.tipo === "arquivo") {
        var nome = p.val.split("~")[0];
        if (!nome || /^\/|(^|\/)\.\.(\/|$)/.test(nome)) probs.push("arquivo: o nome é relativo à pasta do programa: \"" + g + "\"");
      }
    });
    return probs;
  }
  PySim.validarMeta = validarMeta;

  function arquivosDaMeta(meta) {
    return dividirMetas(meta).map(partesMeta).filter(function (p) { return p.tipo === "arquivo" && p.val; })
      .map(function (p) { return p.val.split("~")[0]; });
  }
  PySim.arquivosDaMeta = arquivosDaMeta;

  /* ctx: { out: saída do PROGRAMA (stdout+stderr na ordem; sem o eco da entrada),
            excecao: bool (exceção não tratada ou SyntaxError), traceback: texto,
            exit: número, src: código do leitor (todas as abas), arquivos: {nome: texto|null} }
     → lista das metas que falharam */
  function checarMeta(meta, ctx) {
    var falhas = [];
    var out = ctx.out === null || ctx.out === undefined ? null : String(ctx.out);
    dividirMetas(meta).forEach(function (g) {
      var p = partesMeta(g), val = p.val, ok = false;
      try {
        switch (p.tipo) {
          case "out": ok = out !== null && out.indexOf(val) >= 0; break;
          case "outre": ok = out !== null && new RegExp(val).test(out); break;
          case "semerro": ok = out !== null && !ctx.excecao; break;
          case "erro": ok = !!ctx.excecao && confere(val, String(ctx.traceback || "")); break;
          case "exit": ok = ctx.exit !== null && ctx.exit !== undefined && String(ctx.exit) === val.trim(); break;
          case "src": ok = new RegExp(val, "m").test(ctx.src || ""); break;
          case "arquivo":
            var i = val.indexOf("~"), nome = i < 0 ? val : val.slice(0, i), txt = i < 0 ? null : val.slice(i + 1);
            var a = ctx.arquivos ? ctx.arquivos[nome] : null;
            ok = a !== null && a !== undefined && (txt === null || String(a).indexOf(txt) >= 0);
            break;
          default: ok = false;
        }
      } catch (e) { ok = false; }
      if (!ok) falhas.push(g);
    });
    return falhas;
  }
  PySim.checarMeta = checarMeta;

  // texto do atributo: "\n" = Enter, "\t" = Tab, "\\" = uma barra
  function decodificarAttr(s) { return String(s).replace(/\\(n|t|\\)/g, function (t, c) { return c === "n" ? "\n" : c === "t" ? "\t" : "\\"; }); }
  PySim.decodificarAttr = decodificarAttr;
  // data-stdin → texto entregue ao programa (termina com Enter, como quem digita)
  function textoEntrada(s) { s = decodificarAttr(s); return s === "" || /\n$/.test(s) ? s : s + "\n"; }
  PySim.textoEntrada = textoEntrada;
  // "a 'b c' \"d\"" → ["a", "b c", "d"] (como o bash separa os argumentos)
  function dividirArgs(s) {
    var r = [], cur = null, i = 0;
    s = String(s || "");
    while (i < s.length) {
      var c = s[i];
      if (/\s/.test(c)) { if (cur !== null) { r.push(cur); cur = null; } i++; continue; }
      if (cur === null) cur = "";
      if (c === "'") { var f = s.indexOf("'", i + 1); if (f < 0) f = s.length; cur += s.slice(i + 1, f); i = f + 1; continue; }
      if (c === '"') { i++; while (i < s.length && s[i] !== '"') { if (s[i] === "\\" && /["\\$`]/.test(s[i + 1] || "")) i++; cur += s[i]; i++; } i++; continue; }
      if (c === "\\" && i + 1 < s.length) { cur += s[i + 1]; i += 2; continue; }
      cur += c; i++;
    }
    if (cur !== null) r.push(cur);
    return r;
  }
  PySim.dividirArgs = dividirArgs;
  function citarArg(x) { return /^[\w@%+=:,.\/-]+$/.test(x) ? x : "'" + String(x).replace(/'/g, "'\\''") + "'"; }
  PySim.citarArg = citarArg;
  function linhaComando(arquivo, args) { return "python3 " + citarArg(arquivo) + (args && args.length ? " " + args.map(citarArg).join(" ") : ""); }
  PySim.linhaComando = linhaComando;

  // conteúdo de uma aba: o <pre> perde o último Enter; arquivos de texto terminam com Enter
  function comEnter(codigo) { return codigo !== "" && codigo.slice(-1) !== "\n" ? codigo + "\n" : codigo; }
  PySim.comEnter = comEnter;

  if (typeof module === "object" && module.exports) { module.exports = PySim; }
  if (typeof document === "undefined") return;
  window.PySim = PySim;

  /* =====================================================================
     2. O Python no Web Worker (um por página, compartilhado pelas caixas)
     ===================================================================== */
  var base = (function () {
    var s = document.querySelectorAll("script[src]");
    for (var i = 0; i < s.length; i++) { var src = s[i].getAttribute("src"); if (/pysim\.js(\?|$)/.test(src)) return src.replace(/pysim\.js.*$/, ""); }
    return "assets/";
  })();
  var worker = null, info = null, carregado = false, pronto = null, ouvintes = {}, seq = 0, aoProgresso = [], jaCarregou = false;
  var dono = null; // parar() da caixa que está rodando um programa

  function mb(bytes) { return String(Math.round(bytes / 1e6)); }
  PySim.tamanhoDownload = function () { return mb(PY_BYTES) + " MB"; };

  function carregarPython(progresso) {
    if (progresso) aoProgresso.push(progresso);
    if (pronto) return pronto;
    pronto = new Promise(function (ok, falha) {
      try { worker = new Worker(base + "py/py-worker.mjs", { type: "module" }); }
      catch (e) { falha(e); return; }
      worker.onmessage = function (e) {
        var m = e.data;
        if (m.ev === "progresso") { aoProgresso.forEach(function (f) { try { f(m.lidos, m.total); } catch (x) {} }); return; }
        if (m.ev === "pronto") { info = m.info; carregado = true; jaCarregou = true; aoProgresso = []; ok(info); return; }
        if (m.ev === "falha" && !m.id) { aoProgresso = []; falha(new Error(m.msg)); return; }
        var f = ouvintes[m.id];
        if (f) f(m);
        else if (m.ev === "falha") console.error("pysim:", m.msg);
      };
      worker.onerror = function (e) {
        var msg = (e && e.message) || "o worker do Python falhou";
        if (!carregado) falha(new Error(msg));
        console.error("pysim:", msg);
      };
      worker.postMessage({ op: "carregar", total: PY_BYTES });
    });
    pronto.catch(function () { pronto = null; carregado = false; if (worker) { worker.terminate(); worker = null; } });
    return pronto;
  }
  function encerrarWorker() {
    if (worker) worker.terminate();
    worker = null; pronto = null; carregado = false;
    var os = ouvintes; ouvintes = {};
    Object.keys(os).forEach(function (k) { try { os[k]({ ev: "morto", id: +k }); } catch (e) {} });
    // já deixa o próximo Python carregando (os arquivos estão no cache do navegador)
    setTimeout(function () { if (!pronto) carregarPython().catch(function () {}); }, 50);
  }
  function enviar(msg, ouvinte) {
    var id = ++seq; msg.id = id;
    if (ouvinte) ouvintes[id] = ouvinte;
    worker.postMessage(msg);
    return id;
  }
  function esquecer(id) { delete ouvintes[id]; }

  /* =====================================================================
     3. Interface
     ===================================================================== */
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html !== undefined && html !== null) e.innerHTML = html;
    return e;
  }
  function lerPre(pre) { return pre.textContent.replace(/^\n/, "").replace(/\n$/, ""); }
  PySim.caixas = [];

  function montar(box) {
    if (box.getAttribute("data-montado")) return;
    box.setAttribute("data-montado", "1");
    var meta = box.getAttribute("data-goal") || "";
    var stdinAttr = box.getAttribute("data-stdin");
    var argsAttr = box.getAttribute("data-args");
    var scripts = Array.prototype.slice.call(box.querySelectorAll("pre.script"));
    var sols = Array.prototype.slice.call(box.querySelectorAll("pre.solucao"));
    var abas = scripts.map(function (p, i) { return { nome: p.getAttribute("data-file") || (i === 0 ? "main.py" : "arquivo" + i + ".txt"), original: lerPre(p), atual: lerPre(p) }; });
    if (!abas.length) abas.push({ nome: "main.py", original: "", atual: "" });
    var solucao = sols.length ? sols.map(function (p, i) { return { nome: p.getAttribute("data-file") || (abas[i] ? abas[i].nome : "main.py"), codigo: lerPre(p) }; }) : null;
    scripts.concat(sols).forEach(function (p) { p.style.display = "none"; });
    var ativa = 0;

    var w = el("div", { "class": "ts tc tp" });
    var argsHtml = argsAttr !== null ? '<label class="ts-args-l">Argumentos: <input class="ts-args" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="(nenhum)" title="O que chega em sys.argv[1:]"></label>' : "";
    var entradaHtml = stdinAttr !== null
      ? '<label class="tc-entrada-l">Entrada: <textarea class="tc-entrada" rows="' + Math.min(4, Math.max(1, textoEntrada(stdinAttr).replace(/\n$/, "").split("\n").length)) + '" spellcheck="false" autocomplete="off" autocapitalize="off" title="O que o input() vai ler, uma linha por Enter"></textarea></label>' : "";
    w.innerHTML =
      '<div class="ts-bar"><span class="tc-tabs"></span><span class="ts-sp"></span>' +
      (solucao ? '<button type="button" class="sim-btn ts-sol">Ver solução</button>' : "") +
      '<button type="button" class="sim-btn ts-rest" title="Volta ao código original">Restaurar</button></div>' +
      '<div class="ts-confirma" hidden><span>Trocar o seu código pela solução?</span> <button type="button" class="sim-btn2 ts-sim">Sim, mostrar</button> <button type="button" class="sim-btn2 secundario ts-nao">Cancelar</button></div>' +
      '<div class="ts-editor"><pre class="ts-nums" aria-hidden="true"></pre><textarea class="ts-code" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" aria-label="Código Python (Ctrl+Enter roda)"></textarea></div>' +
      '<div class="ts-run">' + argsHtml + entradaHtml + '<span class="ts-sp"></span>' +
      '<button type="button" class="ts-rodar" title="Ctrl+Enter">▶ Rodar</button></div>' +
      '<div class="tc-carga" hidden><span class="tc-carga-txt"></span><span class="tc-barra"><i></i></span></div>' +
      '<div class="sim ts-saida" hidden><div class="sim-bar"><span class="sim-dots"><i></i><i></i><i></i></span><span class="sim-title">Terminal — ana@notebook: ~</span></div><div class="sim-screen ts-tela"><div class="sim-out"></div></div></div>';
    box.appendChild(w);
    var status = null;
    if (meta) { status = el("p", { "class": "sim-status", "aria-live": "polite" }, "Missão em andamento…"); box.appendChild(status); }

    var ta = w.querySelector(".ts-code"), nums = w.querySelector(".ts-nums"), btn = w.querySelector(".ts-rodar");
    var carga = w.querySelector(".tc-carga"), cargaTxt = w.querySelector(".tc-carga-txt"), barra = w.querySelector(".tc-barra i");
    var argsIn = w.querySelector(".ts-args"), entradaIn = w.querySelector(".tc-entrada");
    var saidaBox = w.querySelector(".ts-saida"), out = w.querySelector(".sim-out"), tela = w.querySelector(".ts-tela");
    if (argsIn) argsIn.value = argsAttr;
    if (entradaIn) entradaIn.value = textoEntrada(stdinAttr).replace(/\n$/, "");
    ta.value = abas[0].atual;
    var cumprida = false, sessao = null, aoTerminar = [];

    /* ---------- editor ---------- */
    function ajustar() {
      var n = ta.value.split("\n").length, t = "";
      for (var i = 1; i <= n; i++) t += i + "\n";
      nums.textContent = t;
      ta.style.height = "auto";
      ta.style.height = Math.max(ta.scrollHeight, 60) + "px";
    }
    function salvarAba() { abas[ativa].atual = ta.value; }
    function desenharAbas() {
      var cont = w.querySelector(".tc-tabs");
      cont.innerHTML = abas.map(function (a, i) { return '<button type="button" class="tc-tab' + (i === ativa ? " on" : "") + '" data-i="' + i + '" aria-pressed="' + (i === ativa) + '">' + escHtml(a.nome) + "</button>"; }).join("");
      Array.prototype.forEach.call(cont.querySelectorAll(".tc-tab"), function (b) { b.addEventListener("click", function () { trocarAba(+b.getAttribute("data-i")); }); });
    }
    function trocarAba(i) { salvarAba(); ativa = i; ta.value = abas[i].atual; ajustar(); desenharAbas(); }
    desenharAbas();
    function inserir(txt, a, b) {
      if (ta.setRangeText) ta.setRangeText(txt, a, b, "end");
      else { ta.value = ta.value.slice(0, a) + txt + ta.value.slice(b); ta.selectionStart = ta.selectionEnd = a + txt.length; }
      salvarAba(); ajustar();
    }
    ta.addEventListener("input", function () { salvarAba(); ajustar(); });
    ta.addEventListener("keydown", function (e) {
      var a = ta.selectionStart, b = ta.selectionEnd, v = ta.value;
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        var ini = v.lastIndexOf("\n", a - 1) + 1;
        if (e.shiftKey) {
          var tira = /^ {1,4}|^\t/.exec(v.slice(ini));
          if (tira) { ta.value = v.slice(0, ini) + v.slice(ini + tira[0].length); ta.selectionStart = Math.max(ini, a - tira[0].length); ta.selectionEnd = Math.max(ini, b - tira[0].length); salvarAba(); ajustar(); }
        } else if (a !== b && v.slice(a, b).indexOf("\n") >= 0) {
          var bloco = v.slice(ini, b).replace(/^/gm, "    ");
          ta.value = v.slice(0, ini) + bloco + v.slice(b); ta.selectionStart = ini; ta.selectionEnd = ini + bloco.length; salvarAba(); ajustar();
        } else inserir("    ", a, b);
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); rodar(); }
      else if (e.key === "Enter" && !e.shiftKey) {
        // mantém a indentação; depois de ":" (if, for, def…) entra mais 4 espaços
        var ini2 = v.lastIndexOf("\n", a - 1) + 1, antes = v.slice(ini2, a), ind = /^[ \t]*/.exec(antes)[0];
        if (/:\s*(#.*)?$/.test(antes) && !/^\s*#/.test(antes)) ind += "    ";
        if (ind) { e.preventDefault(); inserir("\n" + ind, a, b); }
      } else if (e.key === "Backspace" && a === b && a > 0) {
        // apaga 4 espaços de uma vez quando só há espaços antes do cursor
        var ini3 = v.lastIndexOf("\n", a - 1) + 1, esp = v.slice(ini3, a);
        if (esp.length >= 4 && /^ +$/.test(esp)) { e.preventDefault(); var n4 = esp.length % 4 || 4; ta.value = v.slice(0, a - n4) + v.slice(b); ta.selectionStart = ta.selectionEnd = a - n4; salvarAba(); ajustar(); }
      } else if (e.key === "Escape") { ta.blur(); }
    });
    function restaurar() { abas.forEach(function (a) { a.atual = a.original; }); abas = abas.filter(function (a) { return !a.extra; }); ativa = Math.min(ativa, abas.length - 1); ta.value = abas[ativa].atual; ajustar(); desenharAbas(); }
    w.querySelector(".ts-rest").addEventListener("click", restaurar);
    var conf = w.querySelector(".ts-confirma");
    function aplicarSolucao() {
      solucao.forEach(function (sl) {
        var a = abas.filter(function (x) { return x.nome === sl.nome; })[0];
        if (a) a.atual = sl.codigo; else abas.push({ nome: sl.nome, original: "", atual: sl.codigo, extra: true });
      });
      ta.value = abas[ativa].atual; ajustar(); desenharAbas(); conf.hidden = true;
    }
    if (solucao) {
      w.querySelector(".ts-sol").addEventListener("click", function () { conf.hidden = false; });
      w.querySelector(".ts-sim").addEventListener("click", aplicarSolucao);
      w.querySelector(".ts-nao").addEventListener("click", function () { conf.hidden = true; });
    }
    ajustar();

    function arquivos() {
      salvarAba();
      return abas.map(function (a, i) { return { nome: a.nome, codigo: i === 0 || /\.py$/i.test(a.nome) ? a.atual + (a.atual && a.atual.slice(-1) !== "\n" ? "\n" : "") : comEnter(a.atual) }; });
    }
    function fonte() { return abas.map(function (a) { return a.atual; }).join("\n"); }
    function verificar(ctx) {
      ctx.src = fonte();
      var f = meta ? checarMeta(meta, ctx) : [];
      if (!status || cumprida) return f;
      if (!f.length) { cumprida = true; status.textContent = "✔ Missão cumprida!"; status.className = "sim-status ok"; return f; }
      var tipos = f.map(function (x) { return partesMeta(x).tipo; });
      if (tipos.indexOf("semerro") >= 0 && ctx.excecao) status.textContent = "Missão em andamento… (o programa ainda termina com erro: leia a última linha do traceback)";
      else if (tipos.indexOf("erro") >= 0) status.textContent = "Missão em andamento… (a missão pede um erro" + (ctx.excecao ? " diferente)" : "; o programa ainda roda sem erro)");
      else if (tipos.every(function (t) { return t === "src"; })) status.textContent = "Missão em andamento… (a saída está certa, mas a missão pede outro jeito de escrever: " + f.join(", ").replace(/^src:/, "") + ")";
      else if (tipos.indexOf("arquivo") >= 0 && tipos.every(function (t) { return t === "arquivo" || t === "src"; })) status.textContent = "Missão em andamento… (o arquivo " + arquivosDaMeta(f.join(";;")).join(", ") + " ainda não foi criado com o conteúdo esperado)";
      else if (tipos.every(function (t) { return t === "exit"; })) status.textContent = "Missão em andamento… (o código de saída ainda não é o esperado)";
      else status.textContent = "Missão em andamento… (a saída ainda não é a esperada)";
      return f;
    }

    /* ---------- carregamento do Python (só na primeira vez) ---------- */
    function garantirPython() {
      if (pronto && carregado) return pronto;
      carga.hidden = false;
      var txt0 = jaCarregou ? "Reiniciando o Python…" : "Carregando o Python (~" + mb(PY_BYTES) + " MB, só na primeira vez)…";
      cargaTxt.textContent = txt0;
      barra.style.width = "0%";
      var p = carregarPython(function (lidos, total) {
        var pct = Math.min(100, Math.round(lidos * 100 / (total || PY_BYTES)));
        barra.style.width = pct + "%";
        cargaTxt.textContent = pct >= 100 ? "Preparando o Python…" : txt0 + " " + pct + "%";
      });
      return p.then(function () { carga.hidden = true; }, function (e) {
        carga.hidden = false; barra.style.width = "0%";
        cargaTxt.textContent = "Não consegui carregar o Python: " + ((e && e.message) || e) + " Confira a internet e clique em Rodar de novo.";
        throw e;
      });
    }

    /* ---------- terminal ---------- */
    function linhaCmd(cmd) { out.appendChild(el("div", { "class": "sim-cmd" }, '<span class="c-u">ana@notebook</span>:<span class="c-d">~</span>$ ' + escHtml(cmd))); rolar(); }
    function info(txt, cls) { var d = el("div", { "class": cls || "sim-info" }); d.textContent = txt; out.appendChild(d); rolar(); return d; }
    function rolar() { tela.scrollTop = tela.scrollHeight; }

    // Texto chega em pedaços; segmentos {t: "out"|"err"|"eco", s}
    function Terminal() { this.linha = null; this.segs = []; this.n = 0; this.omitidas = 0; this.cauda = []; }
    Terminal.prototype.escrever = function (t, s) {
      var partes = s.split("\n");
      for (var i = 0; i < partes.length; i++) {
        if (partes[i]) this.seg(t, partes[i]);
        if (i < partes.length - 1) this.fechar();
      }
    };
    Terminal.prototype.seg = function (t, s) {
      var u = this.segs[this.segs.length - 1];
      if (u && u.t === t) u.s += s; else this.segs.push({ t: t, s: s });
      this.desenhar();
    };
    Terminal.prototype.html = function (segs) {
      return segs.map(function (x) {
        if (x.t === "eco") return '<span class="sim-digitado">' + escHtml(x.s) + "</span>";
        return x.t === "err" ? '<span class="sim-err">' + escHtml(x.s) + "</span>" : escHtml(x.s);
      }).join("");
    };
    Terminal.prototype.desenhar = function () {
      if (this.n >= MAX_LINHAS) return;
      if (!this.linha) { this.linha = el("div"); out.appendChild(this.linha); }
      var campo = this.linha.querySelector(".ts-campo");
      this.linha.innerHTML = this.html(this.segs);
      if (campo) this.linha.appendChild(campo);
    };
    Terminal.prototype.fechar = function () {
      if (this.n < MAX_LINHAS) { this.desenhar(); if (this.linha && !this.linha.innerHTML) this.linha.innerHTML = "<br>"; }
      else { this.omitidas++; this.cauda.push(this.segs); if (this.cauda.length > 40) this.cauda.shift(); }
      this.n++; this.linha = null; this.segs = [];
    };
    Terminal.prototype.terminar = function () {
      if (this.segs.length) this.fechar();
      if (this.omitidas) {
        var pulo = this.omitidas - this.cauda.length, self = this;
        if (pulo > 0) info("(… mais " + pulo.toLocaleString("pt-BR") + " linhas — o editor mostra só o começo e o fim …)");
        this.cauda.forEach(function (c) { out.appendChild(el("div", null, self.html(c) || "<br>")); });
      }
    };
    Terminal.prototype.linhaAtual = function () {
      if (!this.linha) { this.linha = el("div"); out.appendChild(this.linha); this.desenhar(); }
      return this.linha;
    };

    function parar(motivo) {
      if (!sessao) return;
      var s = sessao;
      s.motivo = motivo || "^C";
      if (s.rodando) encerrarWorker(); // avisa s.ouvinte com {ev: "morto"}
      else finalizar(s, null, s.motivo);
    }

    function desenharFila(s) {
      if (s.desenho) { clearTimeout(s.desenho); s.desenho = null; }
      if (!s.term || !s.fila.length) return;
      var f = s.fila; s.fila = [];
      f.forEach(function (p) { s.term.escrever(p.t === "err" ? "err" : "out", p.s); });
      rolar();
    }

    function finalizar(s, res, motivo) {
      if (s.fim) return;
      desenharFila(s);
      s.fim = true;
      clearInterval(s.relogio);
      if (s.campo && s.campo.parentNode) s.campo.parentNode.removeChild(s.campo);
      if (s.id) esquecer(s.id);
      if (s.term) {
        if (motivo === "^C") s.term.escrever("eco", "^C");
        s.term.terminar();
      }
      if (motivo && motivo !== "^C") info(motivo, "sim-info");
      var codigo = res ? res.exit : null;
      out.appendChild(el("div", { "class": "ts-codigo" + (codigo ? " ts-erro" : "") }, codigo === null || codigo === undefined ? "[programa interrompido]" : "[código de saída: " + codigo + "]"));
      rolar();
      sessao = null; if (dono === parar) dono = null;
      btn.textContent = "▶ Rodar"; btn.disabled = false;
      var r = { interrompido: !res, motivo: motivo || null, saida: s.texto, exit: codigo, excecao: res ? !!res.excecao : null, tipo: res ? res.tipo || null : null, falhas: null, modo: res ? res.modo : null };
      if (res) r.falhas = verificar({ out: s.texto, excecao: !!res.excecao, traceback: res.traceback || "", exit: res.exit, arquivos: res.arquivos || {} });
      var fs = aoTerminar; aoTerminar = [];
      fs.forEach(function (f) { try { f(r); } catch (e) {} });
    }

    function pedirEntrada(s) {
      if (s.campo || !worker) return;
      var campo = el("input", { "class": "ts-campo", type: "text", spellcheck: "false", autocomplete: "off", autocapitalize: "off", "aria-label": "Digite a resposta para o programa e tecle Enter (Ctrl+D encerra a entrada)" });
      s.term.linhaAtual().appendChild(campo);
      s.campo = campo; s.esperando = true;
      campo.focus({ preventScroll: true });
      rolar();
      function sair() { if (campo.parentNode) campo.parentNode.removeChild(campo); s.campo = null; s.esperando = false; s.desde = Date.now(); }
      campo.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          var v = campo.value;
          sair();
          s.term.escrever("eco", v + "\n");
          if (worker) worker.postMessage({ op: "entrada", texto: v + "\n" });
          rolar();
        } else if (e.ctrlKey && (e.key === "d" || e.key === "D")) {
          e.preventDefault(); sair();
          if (worker) worker.postMessage({ op: "eof" });
        } else if (e.ctrlKey && (e.key === "c" || e.key === "C") && campo.selectionStart === campo.selectionEnd) {
          e.preventDefault(); parar();
        }
      });
    }

    function rodar() {
      if (sessao) { parar(); return; }
      var arqs = arquivos();
      saidaBox.hidden = false;
      out.innerHTML = "";
      var args = argsIn ? dividirArgs(argsIn.value) : [];
      linhaCmd(linhaComando(arqs[0].nome, args));
      var s = sessao = { texto: "", fila: [], desenho: null, gasto: 0, desde: 0, folga: 0, esperando: false, fim: false, rodando: false };
      btn.textContent = "■ Parar"; btn.disabled = false;
      garantirPython().then(function () {
        if (sessao !== s) return;
        if (dono && dono !== parar) dono("(outro programa foi iniciado nesta página)");
        s.rodando = true; dono = parar;
        var stdin = entradaIn ? textoEntrada(entradaIn.value) : null;
        s.term = new Terminal();
        s.desde = Date.now();
        s.relogio = setInterval(function () {
          if (s.esperando || s.fim) return;
          var agora = Date.now(); s.gasto += agora - s.desde; s.desde = agora;
          if (s.gasto - s.folga > TEMPO_MAX) parar("(o editor parou o programa: ele rodou mais de " + TEMPO_MAX / 1000 + " segundos sem terminar — laço infinito?)");
        }, 250);
        s.ouvinte = function (m) {
          if (s.fim) return;
          if (m.ev === "saida") {
            m.partes.forEach(function (p) { s.texto += p.s; var u = s.fila[s.fila.length - 1]; if (u && u.t === p.t) u.s += p.s; else s.fila.push({ t: p.t, s: p.s }); });
            if (!s.desenho) s.desenho = setTimeout(function () { desenharFila(s); }, 30);
          } else if (m.ev === "eco") { desenharFila(s); s.term.escrever("eco", m.texto); rolar(); }
          else if (m.ev === "espera") { desenharFila(s); s.gasto += Date.now() - s.desde; s.desde = Date.now(); pedirEntrada(s); }
          else if (m.ev === "dorme") { s.folga = Math.min(FOLGA_SONO, s.folga + m.ms); }
          else if (m.ev === "limite") { s.motivo = "(o programa escreveu demais: mais de 2 milhões de caracteres; o editor o parou)"; encerrarWorker(); }
          else if (m.ev === "fim") finalizar(s, m.res, null);
          else if (m.ev === "falha") { s.motivo = "(o Python do navegador falhou: " + String(m.msg).split("\n")[0] + ")"; console.error("pysim:", m.msg); encerrarWorker(); }
          else if (m.ev === "morto") finalizar(s, null, s.motivo || "(o Python foi reiniciado)");
        };
        var req = { arquivos: arqs, args: args, stdin: stdin, modo: window.PYSIM_SEM_JSPI ? "repeticao" : "auto", conferir: arquivosDaMeta(meta) };
        s.id = enviar({ op: "executar", req: req }, s.ouvinte);
      }, function () {
        if (sessao !== s) return;
        sessao = null; btn.textContent = "▶ Rodar"; btn.disabled = false;
        var fs = aoTerminar; aoTerminar = [];
        fs.forEach(function (f) { try { f({ interrompido: true, motivo: "falha ao carregar", falhas: null }); } catch (e) {} });
      });
    }
    btn.addEventListener("click", rodar);

    // para o testador no navegador (tools/testar-navegador.js)
    var api = {
      box: box, meta: meta,
      rodar: function () { return new Promise(function (ok) { aoTerminar.push(ok); rodar(); }); },
      testar: function (qual) {
        if (sessao) parar();
        if (qual === "solucao" && solucao) aplicarSolucao(); else restaurar();
        cumprida = false;
        if (status) { status.textContent = "Missão em andamento…"; status.className = "sim-status"; }
        return api.rodar();
      },
      digitar: function (texto) { if (sessao && sessao.campo) { sessao.campo.value = texto; sessao.campo.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); return true; } return false; },
      esperando: function () { return !!(sessao && sessao.esperando); },
      parar: function () { parar(); },
    };
    PySim.caixas.push(api);
  }

  function montarTudo() {
    Array.prototype.forEach.call(document.querySelectorAll(".trypy"), function (b) {
      try { montar(b); } catch (e) { console.error("pysim:", e); }
    });
    PySim.montado = true;
  }
  PySim.montarTudo = montarTudo;
  PySim._estado = function () { return { carregado: carregado, worker: !!worker, info: info }; };
  PySim.carregar = function () { return carregarPython(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarTudo); else montarTudo();
})();
