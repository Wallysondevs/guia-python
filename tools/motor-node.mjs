/* motor-node.mjs — o motor do editor (assets/py/motor.mjs) rodando no Node 24.
   Usado por tools/sim.js e tools/testar-missoes.js: o mesmo Pyodide e o mesmo
   código que o navegador usa, num worker_thread (para poder parar um laço infinito).

   import { abrirMotor } from "./motor-node.mjs";
   const m = await abrirMotor();            // { info, rodar(req, opc), fechar() }
   const r = await m.rodar({ arquivos:[{nome:"main.py", codigo:"print(1)"}], stdin:null },
                           { digitar: ["Ana"], tempo: 10000, aoSaida(t, s) {} });
   r = { saida, segs:[{t,s}], exit, excecao, tipo, traceback, arquivos, interrompido, motivo, ms, modo }
*/
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const RAIZ = path.resolve(AQUI, "..");
const PY = path.join(RAIZ, "assets", "py");

/* O site guarda o .wasm comprimido (pyodide.asm.wasm.gz); o Node precisa dele aberto. */
function pastaPyodide() {
  const versao = (fs.readFileSync(path.join(PY, "VERSAO.txt"), "utf8").match(/Pyodide\s+([\w.]+)/) || [, "x"])[1];
  const gz = path.join(PY, "pyodide.asm.wasm.gz");
  const marca = fs.statSync(gz).size + "-" + versao;
  const dir = path.join(os.tmpdir(), "guia-python-pyodide-" + versao);
  const pronto = path.join(dir, ".pronto");
  if (fs.existsSync(pronto) && fs.readFileSync(pronto, "utf8") === marca) return dir;
  fs.mkdirSync(dir, { recursive: true });
  for (const n of fs.readdirSync(PY)) {
    if (n === "pyodide.asm.wasm.gz") continue;
    if (fs.statSync(path.join(PY, n)).isFile()) fs.copyFileSync(path.join(PY, n), path.join(dir, n));
  }
  fs.writeFileSync(path.join(dir, "pyodide.asm.wasm"), zlib.gunzipSync(fs.readFileSync(gz)));
  fs.writeFileSync(pronto, marca);
  return dir;
}

if (!isMainThread && workerData && workerData.guiaMotor) {
  // ---------- dentro do worker ----------
  // Segurança: no Node o os.system do Emscripten rodaria um shell DE VERDADE na VPS.
  // No navegador ele não existe; aqui também não.
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  const cp = req("node:child_process");
  for (const k of ["spawnSync", "execSync", "execFileSync", "spawn", "exec", "execFile", "fork"]) {
    cp[k] = function () { throw new Error("o editor não roda outros programas"); };
  }
  const dir = workerData.dir;
  const { loadPyodide } = await import(pathToFileURL(path.join(dir, "pyodide.mjs")).href);
  const { servirMotor } = await import(pathToFileURL(path.join(PY, "motor.mjs")).href);
  await servirMotor({
    loadPyodide, indexURL: dir + "/", jspi: workerData.jspi, node: true,
    enviar: (m) => parentPort.postMessage(m),
    aoReceber: (f) => parentPort.on("message", f),
  });
}

export async function abrirMotor(opc = {}) {
  const dir = pastaPyodide();
  let w = null, info = null, seq = 0;
  async function iniciar() {
    w = new Worker(fileURLToPath(import.meta.url), { workerData: { guiaMotor: true, dir, jspi: opc.jspi !== false }, stdout: true, stderr: true });
    w.stdout.on("data", () => {}); w.stderr.on("data", (d) => { if (opc.depurar) process.stderr.write(d); });
    info = await new Promise((ok, falha) => {
      const f = (m) => { if (m.ev === "pronto") { w.off("message", f); ok(m.info); } else if (m.ev === "falha") falha(new Error(m.msg)); };
      w.on("message", f);
      w.once("error", falha);
    });
  }
  await iniciar();

  /* opc: { digitar: [linhas] (o leitor digitando; null = sem teclado: fim de entrada),
            tempo: ms (limite, sem contar time.sleep), aoSaida(t, s), aoEspera(), aoEco(texto) } */
  async function rodar(req, o = {}) {
    if (!w) await iniciar();
    const id = ++seq, segs = [], t0 = Date.now();
    const digitar = o.digitar ? o.digitar.slice() : [];
    const limite = o.tempo || 10000;
    let folga = 0, eco = [];
    return await new Promise((ok) => {
      let fim = false;
      const relogio = setInterval(() => {
        if (Date.now() - t0 - folga - esperaMs > limite) terminar({ interrompido: true, motivo: "tempo" });
      }, 100);
      let esperaMs = 0, esperaDesde = 0;
      function terminar(extra) {
        if (fim) return;
        fim = true; clearInterval(relogio);
        const ms = Date.now() - t0;
        const acabar = () => {
          const saida = segs.map((x) => x.s).join("");
          ok(Object.assign({ saida, segs, eco, ms, interrompido: false }, extra));
        };
        if (!extra.interrompido) { w.off("message", ouvir); acabar(); return; }
        // encerra o worker, mas ainda recebe a saída que ele mandou antes de morrer
        const morto = w; w = null;
        morto.terminate().then(() => setTimeout(() => { morto.off("message", ouvir); acabar(); }, 20));
      }
      function ouvir(m) {
        if (fim && m.ev !== "saida") return;
        if (m.id !== id) { if (m.ev === "falha" && !m.id) terminar({ interrompido: true, motivo: "falha", msg: m.msg }); return; }
        if (m.ev === "saida") {
          for (const p of m.partes) {
            const u = segs[segs.length - 1];
            if (u && u.t === p.t) u.s += p.s; else segs.push({ t: p.t, s: p.s });
            if (o.aoSaida) o.aoSaida(p.t, p.s);
          }
        } else if (m.ev === "eco") { eco.push(m.texto); if (o.aoEco) o.aoEco(m.texto); }
        else if (m.ev === "dorme") folga += Math.min(m.ms, 60000);
        else if (m.ev === "espera") {
          if (o.aoEspera) o.aoEspera();
          esperaDesde = Date.now();
          if (o.digitar && digitar.length) { const l = digitar.shift(); const e = (m.senha ? "" : l) + "\n"; eco.push(e); if (o.aoEco) o.aoEco(e); w.postMessage({ op: "entrada", texto: l + "\n" }); }
          else w.postMessage({ op: "eof" });
          esperaMs += Date.now() - esperaDesde;
        } else if (m.ev === "limite") terminar({ interrompido: true, motivo: "limite" });
        else if (m.ev === "fim") terminar(Object.assign({}, m.res));
        else if (m.ev === "falha") terminar({ interrompido: true, motivo: "falha", msg: m.msg });
      }
      w.on("message", ouvir);
      w.postMessage({ op: "executar", id, req });
    });
  }
  return {
    get info() { return info; },
    rodar,
    async fechar() { if (w) { await w.terminate(); w = null; } },
  };
}
