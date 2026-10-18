#!/usr/bin/env bash
# instalar-pyodide.sh VERSAO — baixa o núcleo do Pyodide (npm) e monta assets/py/.
# Uso (na VPS, dentro de ~/guia-python):  tools/instalar-pyodide.sh 314.0.7
# Depois: confira assets/py/VERSAO.txt, rode tools/testar-missoes.js --todas e commite.
set -euo pipefail
V="${1:?uso: tools/instalar-pyodide.sh VERSAO (ex.: 314.0.7)}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DST="$RAIZ/assets/py"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
echo "baixando pyodide@$V…"
curl -fsSL -o p.tgz "https://registry.npmjs.org/pyodide/-/pyodide-$V.tgz"
tar xzf p.tgz
P="$TMP/package"
mkdir -p "$DST"
cp "$P/pyodide.mjs" "$P/pyodide.asm.mjs" "$P/python_stdlib.zip" "$DST/"
gzip -9 -n -c "$P/pyodide.asm.wasm" > "$DST/pyodide.asm.wasm.gz"
# o lock só com o que o editor carrega sob demanda (tzdata, para o zoneinfo)
TZ_WHL=$(node -e 'const j=require(process.argv[1]);console.log(j.packages.tzdata.file_name)' "$P/pyodide-lock.json")
node -e '
const fs=require("fs"); const j=require(process.argv[1]);
const o={info:j.info, packages:{tzdata:j.packages.tzdata}};
fs.writeFileSync(process.argv[2], JSON.stringify(o));' "$P/pyodide-lock.json" "$DST/pyodide-lock.json"
curl -fsSL -o "$DST/$TZ_WHL" "https://cdn.jsdelivr.net/pyodide/v$V/full/$TZ_WHL"
SHA=$(node -e 'console.log(require(process.argv[1]).packages.tzdata.sha256)' "$P/pyodide-lock.json")
echo "$SHA  $DST/$TZ_WHL" | sha256sum -c --quiet
PYV=$(node -e 'console.log(require(process.argv[1]).info.python)' "$P/pyodide-lock.json")
curl -fsSL -o "$DST/LICENSE-pyodide.txt" "https://raw.githubusercontent.com/pyodide/pyodide/$V/LICENSE"
curl -fsSL -o "$DST/LICENSE-python.txt" "https://raw.githubusercontent.com/python/cpython/v$PYV/LICENSE"
# limpa arquivos de outras versões
for f in "$DST"/*.whl; do [ "$(basename "$f")" = "$TZ_WHL" ] || rm -f "$f"; done
echo "Pyodide $V (CPython $PYV) em $DST"
du -cb "$DST"/pyodide.mjs "$DST"/pyodide.asm.mjs "$DST"/pyodide.asm.wasm.gz "$DST"/python_stdlib.zip "$DST"/pyodide-lock.json "$DST/$TZ_WHL" | tail -1
