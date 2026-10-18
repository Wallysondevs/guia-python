/* lab-nativo.js — roda um programa no python3 NATIVO do laboratório (~/guia-python-lab/lab:
   Ubuntu 26.04 + Python 3.14 do Ubuntu) para comparar com o editor (Pyodide).
   Usado por tools/testar-missoes.js --nativo. Um processo por vez, timeout 60; o programa
   roda com timeout 10, sem rede (-N). Pasta pessoal própria e única por execução do
   testador (vários autores rodam ao mesmo tempo), apagada quando o processo termina. */
"use strict";
const { spawnSync } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const LAB = process.env.PYTHON_LAB || path.join(os.homedir(), "guia-python-lab/lab");
const NOME = "tm-" + process.pid + "-" + Math.random().toString(36).slice(2, 8);
const PASTA = path.join(path.dirname(LAB), "homes", NOME);
let usada = false;
process.on("exit", () => { if (usada) { try { fs.rmSync(PASTA, { recursive: true, force: true }); } catch (e) { /* ok */ } } });
for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => process.exit(130));

function b64(s) { return Buffer.from(s, "utf8").toString("base64"); }
function q(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }

function problema() { return fs.existsSync(LAB) ? null : "laboratório não encontrado em " + LAB; }

/** arquivos: [{nome, codigo}] (o 1º roda); opts: {args: [...], stdin: texto}
 *  → { saida (stdout+stderr na ordem), exit, versao } */
function rodar(arquivos, opts) {
  opts = opts || {};
  usada = true;
  const script = [
    "cd /home/ana && rm -rf ./* ./.[!.]* 2>/dev/null; cd /home/ana",
    arquivos.map((a) => 'mkdir -p "$(dirname ' + q(a.nome) + ')" && printf %s ' + q(b64(a.codigo)) + " | base64 -d > " + q(a.nome)).join("\n"),
    "printf %s " + q(b64(opts.stdin || "")) + " | base64 -d > /tmp/entrada.txt",
    "echo @@RODA@@",
    // stdout em linhas (como no terminal): sem isso, o print e o traceback trocariam de ordem
    "PYTHONUNBUFFERED=1 timeout 10 python3 " + q(arquivos[0].nome) + " " + (opts.args || []).map(q).join(" ") + " < /tmp/entrada.txt 2>&1; echo \"@@EXIT@@$?\"",
    "python3 -c 'import sys; print(sys.version.split()[0])'",
  ].join("\n");
  const r = spawnSync("timeout", ["60", LAB, "-n", NOME, "-N", "--", "bash", "-s"], { input: script, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (r.error) throw r.error;
  const s = r.stdout + (r.stderr || "");
  const m = /@@RODA@@\n([\s\S]*?)@@EXIT@@(\d+)\n([^\n]*)/.exec(s);
  if (!m) return { saida: s, exit: null, versao: "?" };
  return { saida: m[1], exit: +m[2], versao: m[3].trim() };
}

// Diferenças conhecidas entre o editor (Pyodide, navegador) e o python3 do Ubuntu
const CONHECIDAS = [
  [/emscripten|Emscripten|wasm32/, "plataforma (sys.platform = emscripten no editor, linux no lab)"],
  [/can't start new thread/, "threads (o editor não cria threads)"],
  [/does not support processes|Function not implemented|\[Errno 138\]|\[Errno 52\]/, "processos (subprocess/os.system/fork não existem no navegador)"],
  [/Host is unreachable|Errno 23|urlopen error|Name or service not known|Temporary failure in name resolution/, "rede (o editor não acessa a internet; o lab do testador roda sem rede)"],
  [/0x[0-9a-f]{6,}/i, "endereços de memória (id(), repr de objetos)"],
  [/\/lib\/python3\.14|\/usr\/lib\/python3\.14|python314\.zip/, "caminhos da biblioteca padrão no traceback"],
];
function classificar(dif, fonte) {
  const r = new Set();
  for (const l of dif) for (const [re, t] of CONHECIDAS) if (re.test(l)) r.add(t);
  if (fonte && /\bimport\s+random|from\s+random\b/.test(fonte) && !/\bseed\s*\(/.test(fonte)) r.add("números sorteados sem seed");
  if (fonte && /\b(datetime|time\.(time|localtime|strftime|ctime|perf_counter|monotonic)|date\.today)\b/.test(fonte)) r.add("data, hora e tempo medido");
  if (fonte && /\bid\s*\(|hash\s*\(/.test(fonte)) r.add("id()/hash() mudam a cada execução");
  if (fonte && /\bset\s*\(|\{[^:}]+\}/.test(fonte) && dif.some((l) => /\{.*\}/.test(l))) r.add("ordem de set de textos (hash aleatório a cada execução)");
  if (fonte && /sys\.(platform|executable|version|path)|platform\.|os\.(uname|cpu_count|getpid|environ|getlogin)/.test(fonte)) r.add("informações do sistema (sys/platform/os)");
  return Array.from(r);
}

// Diferenças linha a linha (LCS simples).  "- " = editor, "+ " = lab
function diferencas(a, b) {
  if (String(a) === String(b)) return [];
  const linhas = (s) => { s = String(s).replace(/\n$/, ""); return s === "" ? [] : s.split("\n").slice(0, 600); };
  const A = linhas(a), B = linhas(b);
  const n = A.length, m = B.length, L = [];
  for (let i = 0; i <= n; i++) L.push(new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const r = []; let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { r.push("+ " + B[j]); j++; }
    else { r.push("- " + A[i]); i++; }
  }
  return r;
}

/** editor: resultado do motor; lab: resultado de rodar() → null (iguais) ou {motivo, esperado:[…], linhas} */
function comparar(editor, lab, fonte) {
  const motivos = [];
  const d = diferencas(editor.saida, lab.saida);
  if (d.length) motivos.push("saída diferente: " + d.slice(0, 4).join(" | ").slice(0, 200));
  if (editor.exit !== lab.exit) motivos.push("código de saída " + editor.exit + " no editor, " + lab.exit + " no lab");
  if (!motivos.length) return null;
  return { motivo: motivos.join("; "), esperado: classificar(d, fonte), linhas: d };
}

module.exports = { rodar, comparar, diferencas, classificar, problema, LAB };
