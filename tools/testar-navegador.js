#!/usr/bin/env node
// testar-navegador.js — abre páginas do Guia Python num Chromium headless (na VPS) e confere o editor.
//
//   timeout 600 node tools/testar-navegador.js pagina.html [outra.html…]
//   timeout 3600 node tools/testar-navegador.js --todas          (todas as .html da raiz)
//   --semjspi     finge um navegador sem JSPI (Safari/Firefox): o input() usa o modo por repetição
//   --fotos DIR   salva um print de página inteira de cada uma em DIR (claro e escuro)
//   -q            mostra só as páginas com problema (e o resumo)
//
// Sobe um servidor HTTP estático próprio em 127.0.0.1 (porta livre escolhida pelo sistema;
// morre junto com o script). Em cada página: erro de JS/console/HTTP = problema; menu montado;
// cada .trypy montada; PySim.caixas[i].testar("inicial") e ("solucao"): missão = o inicial
// NÃO cumpre e a solução cumpre (com o "✔ Missão cumprida!" na tela); caixa livre = roda até o
// fim (exceção vira nota). Um input() sem data-stdin recebe Ctrl+D (fim de entrada).
// Na simulador-teste-interno.html roda também o teste de interface (cliques e teclas de verdade).
// Código de saída: 0 = tudo ok; 1 = alguma página com problema; 2 = uso errado.
"use strict";
const fs = require("fs");
const path = require("path");
const http = require("http");
const os = require("os");

const RAIZ = path.join(__dirname, "..");
const PUP = process.env.PUPPETEER_DIR || path.join(os.homedir(), "rascunho/coord/cdp/node_modules/puppeteer-core");
const CHROMIUM = process.env.CHROMIUM || "/usr/bin/chromium";

const args = process.argv.slice(2);
let fotos = null, quieto = false, semJspi = false;
const paginas = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--todas") fs.readdirSync(RAIZ).filter((f) => /\.html$/.test(f)).sort().forEach((f) => paginas.push(f));
  else if (a === "--fotos") fotos = path.resolve(args[++i] || "fotos");
  else if (a === "-q") quieto = true;
  else if (a === "--semjspi") semJspi = true;
  else if (a.startsWith("-")) { console.error("opção desconhecida: " + a); process.exit(2); }
  else paginas.push(fs.existsSync(path.join(RAIZ, a)) ? a : path.basename(a));
}
if (!paginas.length) {
  console.error("uso: timeout 600 node tools/testar-navegador.js [--semjspi] [--fotos DIR] [-q] pagina.html…|--todas");
  process.exit(2);
}
if (fotos) fs.mkdirSync(fotos, { recursive: true });

/* ------------------------------------------------------ servidor estático */
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".wasm": "application/wasm", ".gz": "application/gzip", ".zip": "application/zip", ".whl": "application/zip",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json",
  ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8", ".csv": "text/plain; charset=utf-8" };
function servidor() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const arq = path.join(RAIZ, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
    if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || !fs.statSync(arq).isFile()) { res.writeHead(404); res.end("404"); return; }
    // como o GitHub Pages: cache curto (o worker novo depois de um Parar reaproveita os arquivos)
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(arq)] || "application/octet-stream", "Cache-Control": "max-age=600" });
    fs.createReadStream(arq).pipe(res);
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv)));
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------------------- roda uma caixa pela API do pysim */
// qual = "inicial" | "solucao"; um input() sem data-stdin recebe Ctrl+D
async function rodarCaixa(pg, i, qual, limite = 20000) {
  await pg.evaluate((i, qual) => { window.__res = window.__res || {}; window.__res[i] = null; PySim.caixas[i].testar(qual).then((r) => { window.__res[i] = r; }); }, i, qual);
  const t0 = Date.now();
  let ctrlD = 0;
  // data-digitar: o que o testador digita quando o programa pede (sem data-stdin)
  const dig = await pg.evaluate((i) => { const b = PySim.caixas[i].box; return b.hasAttribute("data-stdin") || !b.hasAttribute("data-digitar") ? null : PySim.decodificarAttr(b.getAttribute("data-digitar")).replace(/\n$/, "").split("\n"); }, i);
  while (Date.now() - t0 < limite) {
    const st = await pg.evaluate((i) => ({ r: window.__res[i], esp: PySim.caixas[i].esperando() }), i);
    if (st.r) return Object.assign(st.r, { ctrlD });
    if (st.esp) {
      if (dig && dig.length) { const l = dig.shift(); await pg.evaluate((i, l) => PySim.caixas[i].digitar(l), i, l); }
      else { await pg.evaluate((i) => PySim.caixas[i].fimDaEntrada(), i); ctrlD++; }
    }
    await dormir(60);
  }
  await pg.evaluate((i) => PySim.caixas[i].parar(), i);
  return { semResposta: true };
}

/* ------------------------------------------------- o teste de cada página */
async function testarPagina(nav, base, pagina) {
  const pg = await nav.newPage();
  const erros = [], problemas = [], notas = [];
  await pg.setViewport({ width: 1280, height: 900 });
  if (semJspi) await pg.evaluateOnNewDocument(() => { window.PYSIM_SEM_JSPI = true; });
  pg.on("pageerror", (e) => erros.push("JS: " + e.message));
  pg.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) erros.push("console: " + m.text()); });
  pg.on("requestfailed", (r) => { if (!/favicon/.test(r.url())) erros.push("falhou: " + r.url().replace(base, "") + " " + (r.failure() || {}).errorText); });
  pg.on("response", (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) erros.push("HTTP " + r.status() + ": " + r.url().replace(base, "")); });
  pg.on("dialog", (d) => { erros.push("diálogo inesperado: " + d.message()); d.dismiss().catch(() => {}); });
  try {
    await pg.goto(base + pagina, { waitUntil: "load", timeout: 30000 });
    const temEditor = await pg.evaluate(() => !!document.querySelector(".trypy"));
    if (temEditor) await pg.waitForFunction(() => window.PySim && PySim.montado, { timeout: 20000 });
    const info = await pg.evaluate(() => ({
      menu: document.querySelectorAll(".sidebar a").length,
      h1: document.querySelectorAll("h1").length,
      caixas: document.querySelectorAll(".trypy").length,
      montadas: document.querySelectorAll(".trypy[data-montado] .ts.tp").length,
    }));
    if (info.menu < 50) problemas.push("menu com " + info.menu + " links (site.js não montou?)");
    if (info.h1 !== 1) problemas.push(info.h1 + " h1 na página");
    if (info.montadas !== info.caixas) problemas.push("caixas montadas " + info.montadas + "/" + info.caixas);

    const interna = pagina === "simulador-teste-interno.html";
    for (let i = 0; i < info.montadas; i++) {
      const c = await pg.evaluate((i) => { const c = PySim.caixas[i]; return { id: c.box.id || "", meta: c.meta, sol: !!c.box.querySelector("pre.solucao"), semFim: c.box.hasAttribute("data-sem-fim") }; }, i);
      const nome = "caixa " + (i + 1) + (c.id ? " #" + c.id : "");
      if (interna && (c.id === "cx-laco" || c.id === "cx-input" || c.id === "cx-laco-input")) continue; // a interface testa estas
      if (c.semFim) { notas.push(nome + ": data-sem-fim (laço infinito de propósito), não rodada"); continue; }
      const ini = await rodarCaixa(pg, i, "inicial");
      if (ini.semResposta) { problemas.push(nome + ": o inicial não terminou em 20 s"); continue; }
      if (ini.interrompido) { problemas.push(nome + ": o inicial foi interrompido: " + (ini.motivo || "")); continue; }
      if (ini.ctrlD && !(await pg.evaluate((i) => PySim.caixas[i].box.hasAttribute("data-digitar"), i))) notas.push(nome + ": o inicial leu o teclado sem data-stdin (recebeu Ctrl+D " + ini.ctrlD + "×)");
      if (c.meta) {
        if (ini.falhas && !ini.falhas.length) problemas.push(nome + ": o inicial já cumpre a meta");
        if (!c.sol) { problemas.push(nome + ": missão sem solução"); continue; }
        const sol = await rodarCaixa(pg, i, "solucao");
        if (sol.semResposta || sol.interrompido) { problemas.push(nome + ": a solução não terminou (" + (sol.motivo || "sem resposta") + ")"); continue; }
        if (sol.falhas && sol.falhas.length) problemas.push(nome + ": a solução não cumpre " + sol.falhas.join(" ;; ") + " (saída: " + JSON.stringify(String(sol.saida).slice(0, 120)) + ")");
        const ok = await pg.evaluate((i) => { const st = PySim.caixas[i].box.querySelector(".sim-status"); return !!st && st.classList.contains("ok"); }, i);
        if (!ok) problemas.push(nome + ': o aviso "Missão cumprida" não apareceu');
      } else {
        if (ini.excecao) notas.push(nome + " (livre): termina com " + ini.tipo);
        if (c.sol) {
          const sol = await rodarCaixa(pg, i, "solucao");
          if (sol.semResposta || sol.interrompido) problemas.push(nome + ": a solução não terminou");
          else if (sol.excecao) problemas.push(nome + ": a solução termina com " + sol.tipo);
        }
      }
    }

    if (interna) {
      const r = await testeInterface(pg);
      r.problemas.forEach((x) => problemas.push("interface: " + x));
      r.notas.forEach((x) => notas.push(x));
    }
    if (fotos) {
      const nome = pagina.replace(/\.html$/, "");
      await pg.evaluate(() => window.scrollTo(0, 0));
      await pg.screenshot({ path: path.join(fotos, nome + ".png"), fullPage: true });
      await pg.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      await pg.screenshot({ path: path.join(fotos, nome + "-escuro.png"), fullPage: true });
    }
    return { info, erros, problemas, notas };
  } finally { await pg.close(); }
}

/* --------------------------- teste de interface (simulador-teste-interno) */
async function testeInterface(pg) {
  const problemas = [], notas = [];
  const P = (cond, msg) => { if (!cond) problemas.push(msg); };
  const sel = (id, s) => "#" + id + " " + s;
  const esperar = (fn, arg, ms = 15000) => pg.waitForFunction(fn, { timeout: ms }, arg).then(() => true, () => false);
  const texto = (id) => pg.evaluate((id) => { const o = document.querySelector("#" + id + " .sim-out"); return o ? o.innerText : ""; }, id);
  const terminou = (id, ms) => esperar((id) => /\[(código de saída: \d+|programa interrompido)\]/.test((document.querySelector("#" + id + " .sim-out") || {}).textContent || ""), id, ms);
  const campo = (id) => esperar((id) => !!document.querySelector("#" + id + " .ts-campo"), id);
  async function digitar(id, t) {
    P(await campo(id), id + ": o campo de entrada não apareceu");
    await pg.focus(sel(id, ".ts-campo"));
    await pg.keyboard.type(t);
    await pg.keyboard.press("Enter");
  }

  // tudo do zero: recarrega (o teste genérico já usou as caixas) — e o worker vem do cache
  await pg.reload({ waitUntil: "load" });
  await pg.waitForFunction(() => window.PySim && PySim.montado, { timeout: 20000 });

  // 1. Rodar de verdade: carga, saída, escape de < e &
  await pg.click(sel("cx-ola", ".ts-rodar"));
  const viuCarga = await esperar(() => /Carregando o Python \(~\d+ MB|Preparando o Python/.test(document.querySelector("#cx-ola .tc-carga-txt").textContent), null, 5000);
  P(await terminou("cx-ola", 30000), "cx-ola: Rodar não terminou");
  let t = await texto("cx-ola");
  P(/ana@notebook:~\$ python3 main\.py\nOlá, Ana!\n2 < 3 && fim\n\[código de saída: 0\]/.test(t), "cx-ola: saída " + JSON.stringify(t));
  P(await pg.evaluate(() => document.querySelector("#cx-ola .tc-carga").hidden), "cx-ola: a mensagem de carga não sumiu");
  notas.push("carga: " + (viuCarga ? "viu a mensagem de carga" : "não viu a mensagem (já carregado?)"));

  // 2. editar, indentação automática, números de linha, Ctrl+Enter
  const ta = sel("cx-ola", "textarea.ts-code");
  await pg.click(ta);
  await pg.evaluate((s) => document.querySelector(s).select(), ta);
  await pg.keyboard.type("print(1)\nfor i in range(2):\n");
  await pg.keyboard.type("print(i * 10)");
  t = await pg.evaluate((s) => document.querySelector(s).value, ta);
  P(t === "print(1)\nfor i in range(2):\n    print(i * 10)", "cx-ola: indentação automática depois de \":\" — " + JSON.stringify(t));
  const nums = await pg.evaluate(() => document.querySelector("#cx-ola .ts-nums").textContent.trim().split("\n").length);
  P(nums === 3, "cx-ola: números de linha = " + nums + " (esperava 3)");
  await pg.keyboard.down("Control"); await pg.keyboard.press("Enter"); await pg.keyboard.up("Control");
  P(await esperar(() => /1\n0\n10\n\[código/.test(document.querySelector("#cx-ola .sim-out").innerText)), "cx-ola: Ctrl+Enter não rodou: " + JSON.stringify(await texto("cx-ola")));
  // Tab = 4 espaços
  await pg.keyboard.press("Tab");
  t = await pg.evaluate((s) => document.querySelector(s).value, ta);
  P(/print\(i \* 10\) {4}$/.test(t), "cx-ola: Tab não inseriu 4 espaços (" + JSON.stringify(t.slice(-8)) + ")");
  // 3. Restaurar
  await pg.click(sel("cx-ola", ".ts-rest"));
  t = await pg.evaluate((s) => document.querySelector(s).value, ta);
  P(t.startsWith('nome = "Ana"'), "cx-ola: Restaurar não voltou ao original: " + JSON.stringify(t.slice(0, 30)));

  // 4. traceback em vermelho, código de saída 1
  await pg.click(sel("cx-erro", ".ts-rodar"));
  P(await terminou("cx-erro"), "cx-erro: não terminou");
  t = await pg.evaluate(() => {
    const b = document.querySelector("#cx-erro"), e = [...b.querySelectorAll(".sim-err")].map((x) => x.textContent).join("\n");
    const c = b.querySelector(".sim-err"), cod = b.querySelector(".ts-codigo");
    return { e, cor: c ? getComputedStyle(c).color : "", cod: cod ? cod.textContent : "", codErro: cod ? cod.classList.contains("ts-erro") : false, txt: b.querySelector(".sim-out").innerText };
  });
  const rgb = (c) => (c.match(/\d+(\.\d+)?/g) || []).map(Number);
  const [r, g, b] = rgb(t.cor);
  P(/File "\/home\/ana\/main\.py", line 3, in <module>/.test(t.e) && /NameError: name 'nome' is not defined\. Did you mean: 'nomes'\?/.test(t.e), "cx-erro: traceback " + JSON.stringify(t.e));
  P(r > g + 60 && r > b + 60, "cx-erro: o traceback não está vermelho: " + t.cor);
  P(t.cod === "[código de saída: 1]" && t.codErro, "cx-erro: código de saída " + JSON.stringify(t.cod));
  P(/^ana@notebook:~\$ python3 main\.py\nantes do erro\nTraceback/.test(t.txt), "cx-erro: a ordem saída/traceback: " + JSON.stringify(t.txt.slice(0, 80)));

  // 5. input() digitado, missão, Ver solução (cancelar e sim)
  await pg.click(sel("cx-input", ".ts-rodar"));
  await digitar("cx-input", "Bia");
  await digitar("cx-input", "30");
  P(await terminou("cx-input"), "cx-input: não terminou depois de digitar");
  t = await texto("cx-input");
  P(/Qual é o seu nome\? Bia\nQuantos anos você tem\? 30\nOlá, Bia! Você tem 30 anos\.\n\[código de saída: 0\]/.test(t), "cx-input: " + JSON.stringify(t));
  t = await pg.evaluate(() => document.querySelector("#cx-input .sim-status").textContent);
  P(/andamento/.test(t), "cx-input: status depois do inicial: " + t);
  await pg.click(sel("cx-input", ".ts-sol"));
  P(await pg.evaluate(() => !document.querySelector("#cx-input .ts-confirma").hidden), "cx-input: Ver solução não pediu confirmação");
  await pg.click(sel("cx-input", ".ts-nao"));
  t = await pg.evaluate(() => ({ c: document.querySelector("#cx-input .ts-confirma").hidden, v: document.querySelector("#cx-input textarea").value }));
  P(t.c && !/\+ 1/.test(t.v), "cx-input: Cancelar mexeu no código ou não fechou");
  await pg.click(sel("cx-input", ".ts-sol"));
  await pg.click(sel("cx-input", ".ts-sim"));
  P(/\+ 1/.test(await pg.evaluate(() => document.querySelector("#cx-input textarea").value)), "cx-input: Sim, mostrar não pôs a solução");
  await pg.click(sel("cx-input", ".ts-rodar"));
  await digitar("cx-input", "Bia");
  await digitar("cx-input", "30");
  P(await esperar(() => document.querySelector("#cx-input .sim-status").classList.contains("ok")), "cx-input: a solução não cumpriu a missão");

  // 6. data-stdin: campo Entrada, eco, missão
  t = await pg.evaluate(() => { const e = document.querySelector("#cx-stdin .tc-entrada"); return e ? e.value : null; });
  P(t === "Ana\n7\n8", "cx-stdin: o campo Entrada tem " + JSON.stringify(t));
  await pg.click(sel("cx-stdin", ".ts-rodar"));
  P(await terminou("cx-stdin"), "cx-stdin: não terminou");
  t = await pg.evaluate(() => ({ txt: document.querySelector("#cx-stdin .sim-out").innerText, eco: [...document.querySelectorAll("#cx-stdin .sim-digitado")].map((x) => x.textContent).join("|") }));
  P(/Aluna: Ana\nNota 1: 7\nNota 2: 8\nMédia de Ana: 15\.0/.test(t.txt) && t.eco === "Ana|7|8", "cx-stdin: " + JSON.stringify(t));

  // 7. abas: módulo e arquivo de dados; arquivo: na meta
  t = await pg.evaluate(() => [...document.querySelectorAll("#cx-abas .tc-tab")].map((x) => x.textContent));
  P(t.join(",") === "main.py,contas.py,precos.txt", "cx-abas: abas " + t.join(","));
  await pg.click("#cx-abas .tc-tab[data-i='1']");
  t = await pg.evaluate(() => document.querySelector("#cx-abas textarea").value);
  P(/^def somar/.test(t), "cx-abas: a aba contas.py mostra " + JSON.stringify(t.slice(0, 20)));
  await pg.click("#cx-abas .tc-tab[data-i='0']");
  await pg.click(sel("cx-abas", ".ts-rodar"));
  P(await terminou("cx-abas"), "cx-abas: não terminou");
  P(/Total: 33\.6/.test(await texto("cx-abas")), "cx-abas: " + JSON.stringify(await texto("cx-abas")));
  P(await pg.evaluate(() => !document.querySelector("#cx-abas .sim-status").classList.contains("ok")), "cx-abas: o inicial cumpriu a missão (não grava total.txt)");

  // 8. argumentos
  t = await pg.evaluate(() => { const e = document.querySelector("#cx-args .ts-args"); return e ? e.value : null; });
  P(t === "Ana 'Bia Souza'", "cx-args: campo Argumentos " + JSON.stringify(t));
  await pg.click(sel("cx-args", ".ts-rodar"));
  P(await terminou("cx-args"), "cx-args: não terminou");
  t = await texto("cx-args");
  P(/python3 main\.py Ana 'Bia Souza'\n\['main\.py', 'Ana', 'Bia Souza'\]/.test(t), "cx-args: " + JSON.stringify(t));

  // 9. Parar (o botão vira "■ Parar") e a trava de 10 s
  await pg.click(sel("cx-laco", ".ts-rodar"));
  P(await esperar(() => /começando/.test(document.querySelector("#cx-laco .sim-out").textContent)), "cx-laco: não começou");
  P(/Parar/.test(await pg.evaluate(() => document.querySelector("#cx-laco .ts-rodar").textContent)), "cx-laco: o botão não virou Parar");
  await dormir(500);
  let t0 = Date.now();
  await pg.click(sel("cx-laco", ".ts-rodar"));
  P(await terminou("cx-laco", 3000), "cx-laco: Parar não parou em 3 s");
  t = await texto("cx-laco");
  P(/\^C\n\[programa interrompido\]/.test(t), "cx-laco: depois do Parar: " + JSON.stringify(t));
  notas.push("Parar: " + (Date.now() - t0) + " ms");
  t0 = Date.now();
  await pg.click(sel("cx-laco", ".ts-rodar"));
  P(await esperar(() => /rodou mais de 10 segundos/.test(document.querySelector("#cx-laco .sim-out").textContent), null, 25000), "cx-laco: a trava de 10 s não apareceu");
  const ms = Date.now() - t0;
  P(ms > 9000 && ms < 16000, "cx-laco: a trava levou " + ms + " ms");
  notas.push("trava: " + ms + " ms (inclui reiniciar o Python depois do Parar)");
  t = await texto("cx-laco");
  P(/começando…\n\(o editor parou o programa/.test(t), "cx-laco: a saída antes da trava se perdeu: " + JSON.stringify(t));
  // a página continua viva
  await pg.click(sel("cx-ola", ".ts-rodar"));
  P(await terminou("cx-ola", 20000) && /Olá, Ana!/.test(await texto("cx-ola")), "depois da trava, cx-ola não roda mais");

  // 10. o que o navegador não tem
  await pg.click(sel("cx-sistema", ".ts-rodar"));
  P(await terminou("cx-sistema", 20000), "cx-sistema: não terminou");
  t = await texto("cx-sistema");
  P(/3\n2\n1\n42\nemscripten \/home\/ana \/home\/ana\/main\.py \['main\.py'\]\nexecutable: '\/usr\/bin\/python3' 1000\nos\.system: -1\nsubprocess: \[Errno 138\] emscripten does not support processes\.\nthreading: can't start new thread/.test(t), "cx-sistema: " + JSON.stringify(t));

  // 11. SyntaxError não cumpre erro:ZeroDivisionError; a solução cumpre
  await pg.click(sel("cx-sintaxe", ".ts-rodar"));
  P(await terminou("cx-sintaxe"), "cx-sintaxe: não terminou");
  t = await texto("cx-sintaxe");
  P(/File "\/home\/ana\/main\.py", line 1\n    print\("Olá"\n         \^\nSyntaxError: '\(' was never closed/.test(t), "cx-sintaxe: " + JSON.stringify(t));
  t = await pg.evaluate(() => document.querySelector("#cx-sintaxe .sim-status").textContent);
  P(/erro diferente/.test(t), "cx-sintaxe: status " + JSON.stringify(t));

  // 12. input() num laço com except, Ctrl+D (no modo atual: JSPI ou repetição)
  await pg.click(sel("cx-laco-input", ".ts-rodar"));
  await digitar("cx-laco-input", "x");
  await digitar("cx-laco-input", "21");
  P(await campo("cx-laco-input"), "cx-laco-input: o 3º campo não apareceu");
  await pg.focus(sel("cx-laco-input", ".ts-campo"));
  await pg.keyboard.down("Control"); await pg.keyboard.press("d"); await pg.keyboard.up("Control");
  P(await terminou("cx-laco-input"), "cx-laco-input: Ctrl+D não terminou o programa");
  t = await texto("cx-laco-input");
  P(/\(sorteado: \d+ \)\nNúmero: x\nIsso não é um número\.\nNúmero: 21\ndobro: 42\nNúmero: tchau\n\[código de saída: 0\]/.test(t), "cx-laco-input: " + JSON.stringify(t));
  // 13. Rodar outra caixa enquanto uma espera o teclado (o Python é reiniciado e a nova roda)
  await pg.click(sel("cx-input", ".ts-rodar"));
  P(await campo("cx-input"), "cx-input: o campo não apareceu (troca de caixa)");
  await pg.click(sel("cx-ola", ".ts-rodar"));
  P(await terminou("cx-ola", 30000) && /Olá, Ana!/.test(await texto("cx-ola")), "troca de caixa: cx-ola não rodou depois de interromper o cx-input: " + JSON.stringify(await texto("cx-ola")));
  P(/\(outro programa foi iniciado nesta página\)\n\[programa interrompido\]/.test(await texto("cx-input")), "troca de caixa: o cx-input não mostra que foi interrompido");
  await pg.click(sel("cx-input", ".ts-rodar"));
  await digitar("cx-input", "Bia");
  await digitar("cx-input", "30");
  P(await terminou("cx-input") && /Olá, Bia!/.test(await texto("cx-input")), "troca de caixa: o cx-input não voltou a rodar: " + JSON.stringify(await texto("cx-input")));

  t = await pg.evaluate(() => PySim._estado().info);
  notas.push("Python " + t.python + " (Pyodide " + t.pyodide + "), JSPI " + (t.jspi ? "sim" : "não") + (semJspi ? " (--semjspi: modo por repetição)" : ""));
  return { problemas, notas };
}

/* --------------------------------------------------------------- principal */
(async () => {
  let puppeteer;
  try { puppeteer = require(PUP); } catch (e) { console.error("não achei o puppeteer-core em " + PUP); process.exit(2); }
  const srv = await servidor();
  const base = "http://127.0.0.1:" + srv.address().port + "/";
  const nav = await puppeteer.launch({ executablePath: CHROMIUM, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  let ruins = 0;
  try {
    for (const p of paginas) {
      if (!fs.existsSync(path.join(RAIZ, p))) { console.log("✗ " + p + "  página não existe"); ruins++; continue; }
      const t0 = Date.now();
      let r;
      try { r = await testarPagina(nav, base, p); }
      catch (e) { r = { info: {}, erros: [], problemas: ["o teste quebrou: " + e.message], notas: [] }; }
      const ruim = r.erros.length || r.problemas.length;
      if (ruim) ruins++;
      if (ruim || !quieto) {
        const i = r.info;
        console.log((ruim ? "✗ " : "✓ ") + p + "  caixas=" + (i.montadas ?? "?") + "/" + (i.caixas ?? "?") + "  (" + ((Date.now() - t0) / 1000).toFixed(1) + " s)");
        r.erros.concat(r.problemas).forEach((x) => console.log("    " + x));
        if (!quieto) r.notas.forEach((x) => console.log("    · " + x));
      }
    }
  } finally {
    await nav.close();
    srv.close();
  }
  console.log("\n" + paginas.length + " página(s), " + ruins + " com problema" + (semJspi ? " (sem JSPI)" : "") + (fotos ? "; prints em " + fotos : ""));
  process.exitCode = ruins ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; process.exit(1); });
