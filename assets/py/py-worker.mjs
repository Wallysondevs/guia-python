/* py-worker.mjs — o Web Worker do editor do Guia Python (module worker).
   Carrega o Pyodide desta pasta e atende o assets/pysim.js (protocolo em motor.mjs).
   O site guarda o WebAssembly comprimido (pyodide.asm.wasm.gz, ~3,5 MB em vez de 9,6 MB):
   o fetch abaixo troca o pedido do .wasm pelo .gz e descomprime no navegador. */
import { loadPyodide } from "./pyodide.mjs";
import { servirMotor } from "./motor.mjs";

const AQUI = new URL("./", import.meta.url).href;
const progresso = { lidos: 0, total: 0, ultimo: 0 };
function avisar(forcar) {
  const agora = Date.now();
  if (!forcar && agora - progresso.ultimo < 120) return;
  progresso.ultimo = agora;
  self.postMessage({ ev: "progresso", lidos: progresso.lidos, total: progresso.total });
}
function contando(resp) {
  if (!resp.body) return resp;
  const t = new TransformStream({ transform(ch, c) { progresso.lidos += ch.byteLength; avisar(); c.enqueue(ch); } });
  return resp.body.pipeThrough(t);
}
const fetchOriginal = self.fetch.bind(self);
self.fetch = async function (url, opc) {
  const u = String(url instanceof Request ? url.url : url);
  if (!u.startsWith(AQUI)) return fetchOriginal(url, opc);
  if (/pyodide\.asm\.wasm$/.test(u)) {
    const r = await fetchOriginal(u + ".gz", opc);
    if (!r.ok) throw new Error("Não consegui baixar o Python (" + r.status + ")");
    if (typeof DecompressionStream === "undefined") throw new Error("Este navegador é antigo demais (falta DecompressionStream). Atualize-o para rodar Python.");
    return new Response(contando(r).pipeThrough(new DecompressionStream("gzip")), { headers: { "content-type": "application/wasm" } });
  }
  const r = await fetchOriginal(url, opc);
  if (!r.ok || !/\.(zip|whl)$/.test(u)) return r;
  return new Response(contando(r), { status: r.status, headers: r.headers });
};

let aoReceber = null, guardadas = [];
self.onmessage = function (e) {
  const m = e.data;
  if (m && m.op === "carregar") { progresso.total = m.total || 0; avisar(true); return; }
  if (aoReceber) aoReceber(m); else guardadas.push(m);
};
servirMotor({
  loadPyodide, indexURL: AQUI,
  enviar: (m) => self.postMessage(m),
  aoReceber: (f) => { aoReceber = f; const g = guardadas; guardadas = []; g.forEach(f); },
}).catch(function (e) {
  self.postMessage({ ev: "falha", msg: String((e && e.message) || e) });
});
