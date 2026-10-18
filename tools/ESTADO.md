# Estado do simulador do Guia Python (editor `.trypy`)

Atualizado em 18/10/2026 pelo agente do simulador.

## O que está pronto
| Peça | Arquivo | Estado |
|---|---|---|
| Motor | `assets/py/` — Pyodide **314.0.7** (CPython **3.14.2**), só o núcleo, ~7,7 MB no site (~6,1 MB baixados no 1º Rodar). Versões e tamanhos: `assets/py/VERSAO.txt` | pronto |
| Lado Python + protocolo | `assets/py/motor.mjs` (o `_guia_editor.py` embutido: reinício a cada Rodar, `input`, `getpass`, `pdb`, `time.sleep`, `asyncio`, traceback igual ao do lab) — usado pelo navegador **e** pelo Node | pronto |
| Web Worker | `assets/py/py-worker.mjs` (module worker; descomprime o `.wasm.gz`, barra de progresso) | pronto |
| Interface | `assets/pysim.js` + bloco `/* pysim */` no fim do `assets/style.css` (reaproveita as classes `.ts-*`/`.tc-*`) | pronto |
| Ferramentas | `tools/sim.js`, `tools/testar-missoes.js` (`--nativo` via `tools/lab-nativo.js`), `tools/testar-navegador.js`, `tools/motor-node.mjs`, `tools/instalar-pyodide.sh` | prontas |
| Páginas | `index.html`, `simulador.html` (NIVEIS); `simulador-teste-interno.html` (fora da NIVEIS, `noindex`) | prontas |
| Documentação | §4 do `CONTRIBUINDO.md` | pronta |

## Como o editor funciona (resumo; detalhes na §4 do CONTRIBUINDO)
- Um Web Worker por página. O Python carrega no 1º Rodar. Cada Rodar zera a `/home/ana`, `__main__`, os módulos do leitor, `os.environ`, `logging`/`decimal`/`locale`.
- **Parar** e o limite de **10 s** (sem contar teclado e até 60 s de `time.sleep`) encerram o worker (`terminate`) e já carregam outro em segundo plano (~2 s, do cache). Saída máxima: 2 milhões de caracteres. A saída é mandada na hora (nada se perde no Parar).
- `input()` sem `data-stdin`: **JSPI** (Chrome/Edge: o programa fica parado de verdade) ou, sem JSPI, **por repetição** (roda de novo do começo com as linhas já digitadas; `random` com a mesma semente em todas as repetições; `sys.monitoring` impede que um `except:` engula a parada).
- Sem SharedArrayBuffer (o GitHub Pages não manda COOP/COEP), por isso nada de `setInterruptBuffer`.
- Atributos de teste (o editor ignora): `data-digitar="Bia\n30"` (o que os testadores digitam) e `data-sem-fim` (laço infinito de propósito).

## Como rodar (na VPS, em `~/guia-python`, depois de `. ~/.profile`)
```bash
timeout 60  node tools/sim.js main.py [outros.py dados.txt] [--stdin "Ana\n30"] [--digitar "Ana"] [--args "a b"] [--goal "out:…;;semerro"] [--json]
timeout 60  node tools/sim.js - < programa.py
timeout 300 node tools/testar-missoes.js [-q] pagina.html…        # do notebook: ~/guia-python-lab/testar pagina.html
timeout 900 node tools/testar-missoes.js -q --todas
timeout 900 node tools/testar-missoes.js --nativo pagina.html      # + python3 do lab; diferenças em tools/DIFERENCAS.md
timeout 600 node tools/testar-navegador.js [-q] [--semjspi] [--fotos DIR] pagina.html…
timeout 2400 node tools/testar-navegador.js -q --todas             # Chromium headless; servidor próprio em 127.0.0.1, porta livre
```
- `testar-navegador.js` precisa do puppeteer-core de `~/rascunho/coord/cdp/node_modules` (ou `PUPPETEER_DIR`) e do `/usr/bin/chromium` (ou `CHROMIUM`). Na `simulador-teste-interno.html` ele clica de verdade: Rodar, Ctrl+Enter, indentação automática, Tab, Restaurar, abas, Ver solução (cancelar/sim), `input()` digitado, Ctrl+D, campo Entrada, Argumentos, Parar, a trava de 10 s, traceback vermelho, SyntaxError, o que o navegador não tem.
- `--semjspi` testa o modo por repetição (Safari/Firefox sem JSPI).

## Atualizar o Pyodide
`tools/instalar-pyodide.sh NOVA_VERSAO`, depois ajustar `PY_BYTES` em `assets/pysim.js` e o `assets/py/VERSAO.txt`, rodar `testar-missoes.js --todas` e `testar-navegador.js` (interna + `--semjspi`), conferir a §4 e commitar.

## Pendências / ideias
- O editor é o 3.14.2 e o lab o 3.14.4 (o Pyodide estável mais novo, 314.0.7, traz o 3.14.2). Quando sair um Pyodide com 3.14.4+, atualizar.
- `input()` dentro de uma corrotina do `asyncio`: o `run_sync` do Pyodide não volta lá dentro, então o motor troca sozinho para o modo por repetição (conferido com `sim.js --digitar`). O `time.sleep` dentro do asyncio usa o sleep do C (ocupa a CPU enquanto espera).
