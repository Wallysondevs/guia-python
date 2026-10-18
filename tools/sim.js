#!/usr/bin/env node
// sim.js — roda um programa Python como o editor do guia rodaria (o MESMO Pyodide e o
// MESMO motor: assets/py/motor.mjs), e mostra o terminal da caixa e o código de saída.
//
//   timeout 60 node tools/sim.js main.py [util.py dados.txt…] [opções]
//   timeout 60 node tools/sim.js -c 'print("oi")' [opções]
//   timeout 60 node tools/sim.js - [util.py…] [opções] < programa.py   (o programa vem da entrada; vira main.py)
//
// O 1º arquivo é o que roda (python3 main.py); os outros vão para a mesma pasta
// (/home/ana), com o mesmo nome (sem as pastas do caminho).
//   --stdin TEXTO     o data-stdin da caixa ("Ana\n30": \n = Enter). O que o input() lê.
//   --digitar TEXTO   o leitor DIGITANDO no terminal da caixa (sem data-stdin): uma linha por \n
//   --repeticao       com --digitar: força o modo "por repetição" (navegadores sem JSPI)
//   --args "a 'b c'"  o data-args (sys.argv[1:])
//   --goal META       o data-goal: diz se a missão passaria e qual meta falhou
//   --tempo MS        limite (padrão 10000, como o editor)
//   --json            o resultado em JSON (saida, exit, excecao, tipo, traceback…)
// Sem --stdin nem --digitar, o input() recebe "fim de entrada" (EOFError), como
// `python3 main.py < /dev/null`. No editor o leitor digitaria.
"use strict";
const fs = require("fs");
const path = require("path");
const PySim = require("../assets/pysim.js");

const a = process.argv.slice(2);
const arqs = [];
let codigo = null, stdin = null, digitar = null, args = [], goal = null, tempo = 10000, json = false, repeticao = false;
function uso(c) {
  console.error("uso: timeout 60 node tools/sim.js main.py [outros…] [--stdin TEXTO | --digitar TEXTO [--repeticao]] [--args \"a b\"] [--goal META] [--tempo MS] [--json]\n" +
    "     timeout 60 node tools/sim.js -c 'CÓDIGO' […]");
  process.exit(c);
}
for (let i = 0; i < a.length; i++) {
  const x = a[i];
  if (x === "-c") codigo = a[++i];
  else if (x === "--stdin") stdin = a[++i];
  else if (x === "--digitar") digitar = a[++i];
  else if (x === "--args") args = PySim.dividirArgs(a[++i]);
  else if (x === "--goal") goal = a[++i];
  else if (x === "--tempo") tempo = +a[++i];
  else if (x === "--json") json = true;
  else if (x === "--repeticao") repeticao = true;
  else if (x === "-h" || x === "--help") uso(0);
  else if (x.startsWith("--")) { console.error("opção desconhecida: " + x); uso(2); }
  else arqs.push(x);
}
if (codigo === null && !arqs.length) uso(2);
const arquivos = [];
if (codigo !== null) arquivos.push({ nome: "main.py", codigo: codigo.endsWith("\n") ? codigo : codigo + "\n" });
for (const p of arqs) {
  if (p === "-") { arquivos.push({ nome: "main.py", codigo: fs.readFileSync(0, "utf8") }); continue; }
  if (!fs.existsSync(p)) { console.error("não achei " + p); process.exit(2); }
  const c = fs.readFileSync(p, "utf8");
  arquivos.push({ nome: path.basename(p), codigo: /\.py$/i.test(p) || !arquivos.length ? c : PySim.comEnter(c) });
}

(async () => {
  const { abrirMotor } = await import("./motor-node.mjs");
  const m = await abrirMotor({ jspi: !repeticao });
  const req = {
    arquivos, args,
    stdin: stdin !== null ? PySim.textoEntrada(stdin) : null,
    modo: repeticao ? "repeticao" : "auto",
    conferir: goal ? PySim.arquivosDaMeta(goal) : [],
  };
  const linhas = digitar !== null ? PySim.decodificarAttr(digitar).replace(/\n$/, "").split("\n") : null;
  if (!json) process.stdout.write("ana@notebook:~$ " + PySim.linhaComando(arquivos[0].nome, args) + "\n");
  const r = await m.rodar(req, {
    digitar: linhas, tempo,
    aoSaida: json ? null : (t, s) => process.stdout.write(s),
    aoEco: json ? null : (s) => process.stdout.write(s),
  });
  await m.fechar();
  let falhas = null;
  if (goal && !r.interrompido) {
    falhas = PySim.checarMeta(goal, { out: r.saida, excecao: r.excecao, traceback: r.traceback, exit: r.exit, src: arquivos.map((x) => x.codigo.replace(/\n$/, "")).join("\n"), arquivos: r.arquivos });
  }
  if (json) {
    console.log(JSON.stringify({ saida: r.saida, segs: r.segs, eco: r.eco, exit: r.exit, excecao: r.excecao, tipo: r.tipo, traceback: r.traceback, interrompido: r.interrompido, motivo: r.motivo, arquivos: r.arquivos, modo: r.modo, repeticoes: r.repeticoes, ms: r.ms, python: m.info.python, pyodide: m.info.pyodide, falhas }, null, 1));
  } else {
    if (r.saida && !/\n$/.test(r.saida)) process.stdout.write("\n");
    if (r.interrompido) {
      console.log(r.motivo === "tempo" ? "(o editor parou o programa: ele rodou mais de " + tempo / 1000 + " segundos sem terminar — laço infinito?)\n[programa interrompido]"
        : r.motivo === "limite" ? "(o programa escreveu demais: mais de 2 milhões de caracteres; o editor o parou)\n[programa interrompido]"
        : "(o Python falhou: " + String(r.msg || r.motivo).split("\n")[0] + ")\n[programa interrompido]");
    } else console.log("[código de saída: " + r.exit + "]");
    const extra = [];
    if (r.excecao) extra.push("exceção não tratada: " + r.tipo);
    if (r.modo === "repeticao") extra.push(r.repeticoes + " repetições (modo por repetição)");
    if (stdin === null && digitar === null && /\binput\s*\(|sys\.stdin/.test(arquivos.map((x) => x.codigo).join("\n")))
      extra.push("sem --stdin/--digitar o input() recebe fim de entrada; no editor, sem data-stdin, o leitor digita");
    console.log("-- editor: Python " + m.info.python + " (Pyodide " + m.info.pyodide + "), " + r.ms + " ms" + (extra.length ? "; " + extra.join("; ") : ""));
    if (goal) {
      if (falhas === null) console.log("-- meta: não avaliada (o programa foi interrompido)");
      else if (!falhas.length) console.log("-- meta \"" + goal + "\": CUMPRIDA");
      else console.log("-- meta \"" + goal + "\": NÃO cumprida; falharam: " + falhas.join(" ;; ") + (r.eco && r.eco.length ? "  (lembre: o out: não inclui o eco do que foi lido/digitado)" : ""));
    }
  }
  process.exitCode = r.interrompido ? 3 : (falhas && falhas.length ? 1 : 0);
})().catch((e) => { console.error("erro: " + (e.stack || e)); process.exitCode = 2; });
