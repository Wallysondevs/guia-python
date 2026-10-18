/* =====================================================================
   motor.mjs — o "python3 main.py" do editor do Guia Python.
   Roda o CPython do Pyodide (assets/py/) num Web Worker (navegador) ou
   num worker_thread (Node: tools/motor-node.mjs). Os dois usam ESTE
   arquivo, então o testador roda os programas exatamente como o editor.

   Protocolo (mensagens):
     para o motor:  {op:"executar", id, req} | {op:"entrada", texto} | {op:"eof"}
     do motor:      {ev:"pronto", info} | {ev:"saida", id, partes:[{t:"out"|"err", s}]}
                    {ev:"eco", id, texto}       (linha do data-stdin que o programa leu)
                    {ev:"espera", id}           (o programa quer uma linha do teclado)
                    {ev:"dorme", id, ms}        (time.sleep: o relógio do limite para)
                    {ev:"limite", id}           (saída grande demais: o dono encerra o worker)
                    {ev:"fim", id, res}  |  {ev:"falha", id, msg}
   req = { arquivos:[{nome, codigo}], args:[…], stdin: texto|null,
           modo: "texto"|"jspi"|"repeticao"|"auto", conferir:[nomes], semente }
   res = { exit, excecao: bool, tipo: "ZeroDivisionError"|null, traceback, arquivos:{nome: texto|null},
           modo, repeticoes }
   ===================================================================== */

export const HOME = "/home/ana";
export const LIMITE_SAIDA = 2000000; // caracteres de saída por execução

const AMBIENTE = {
  HOME: HOME, USER: "ana", LOGNAME: "ana", SHELL: "/bin/bash",
  PATH: "/usr/local/bin:/usr/bin:/bin", LANG: "pt_BR.UTF-8", TERM: "xterm-256color", PWD: HOME,
};

/* O lado Python: fica em /lib/guia/_guia_editor.py (fora da pasta do leitor). */
const PY = String.raw`
"""Editor do Guia Python: roda o programa do leitor como "python3 main.py" faria."""
import sys, os, io, builtins, types, traceback, linecache, importlib, shutil, atexit, warnings, gc, time

HOME = "/home/ana"
_ESTE = __file__
_AMBIENTE = {}

class _Pare(BaseException):
    """O editor parou o programa: ele pediu uma linha que o leitor ainda não digitou."""

class _E:
    modo = "texto"; parado = False; senha = False; trocar = False
    linhas = []; pos = 0; eof = True
    pedir = None; avisar = None; eco = None; dorme = None

# ---------- parar de verdade (modo por repetição) ----------
# Um "except:" do leitor pegaria o _Pare; com o sys.monitoring, qualquer linha
# executada (ou exceção tratada) depois da parada levanta _Pare de novo.
_M = sys.monitoring
_FERRAMENTA = None
for _i in (5, 4, 3):
    try:
        _M.use_tool_id(_i, "guia-editor"); _FERRAMENTA = _i; break
    except ValueError:
        pass

def _cb(code, *a):
    if _E.parado and code.co_filename != _ESTE:
        raise _Pare()

def _parar():
    _E.parado = True
    if _FERRAMENTA is not None:
        _M.register_callback(_FERRAMENTA, _M.events.LINE, _cb)
        _M.register_callback(_FERRAMENTA, _M.events.EXCEPTION_HANDLED, _cb)
        _M.set_events(_FERRAMENTA, _M.events.LINE | _M.events.EXCEPTION_HANDLED)

def _desarmar():
    _E.parado = False
    if _FERRAMENTA is not None:
        _M.set_events(_FERRAMENTA, 0)

# ---------- o teclado (sys.stdin) ----------
def _descarregar():
    for f in (sys.stdout, sys.stderr, sys.__stdout__, sys.__stderr__):
        try:
            f.flush()
        except Exception:
            pass

def _esperar_js(promessa):
    """run_sync sem laço do asyncio "rodando" (senão o Pyodide espera pelo laço, que está parado)."""
    from pyodide.ffi import run_sync
    import asyncio.events as ev
    laco = ev._get_running_loop()
    tarefa = None
    if laco is not None:
        import asyncio.tasks as at
        try: tarefa = at._swap_current_task(laco, None)
        except Exception: tarefa = None
    ev._set_running_loop(None)
    try:
        return run_sync(promessa)
    finally:
        ev._set_running_loop(laco)
        if tarefa is not None:
            try: at._swap_current_task(laco, tarefa)
            except Exception: pass

def _proxima_linha():
    """Uma linha (com o \n) ou None no fim da entrada."""
    if _E.parado:
        raise _Pare()
    if _E.modo == "texto":
        if _E.pos < len(_E.linhas):
            _E.pos += 1
            l = _E.linhas[_E.pos - 1]
            if _E.eco is not None:
                _descarregar()
                _E.eco("\n" if _E.senha else l)
            return l
        return None
    if _E.modo == "jspi":
        _descarregar()
        import asyncio.events as ev
        if ev._get_running_loop() is not None:
            # dentro de um laço do asyncio o run_sync do Pyodide não volta: o editor
            # troca para o modo por repetição (o JS roda de novo com o que já foi digitado)
            _E.trocar = True
            _parar()
            raise _Pare()
        r = _esperar_js(_E.pedir(_E.senha))
        r = "" if r is None else str(r)
        return r or None  # "" = fim da entrada (Ctrl+D)
    # repetição: as linhas já digitadas; acabou -> para e pede a próxima
    if _E.pos < len(_E.linhas):
        _E.pos += 1
        return _E.linhas[_E.pos - 1]
    if _E.eof:
        return None
    _descarregar()
    _E.avisar(_E.senha)
    _parar()
    raise _Pare()

class _Entrada(io.TextIOBase):
    encoding = "utf-8"
    errors = "strict"
    newlines = None
    name = "<stdin>"
    mode = "r"
    def __init__(self, tty):
        self._tty = tty; self._buf = ""; self._fim = False
    def readable(self): return True
    def isatty(self): return self._tty
    def fileno(self): raise io.UnsupportedOperation("fileno")
    def _mais(self):
        if self._fim:
            return False
        l = _proxima_linha()
        if l is None:
            self._fim = True
            return False
        self._buf += l
        return True
    def readline(self, size=-1):
        if size is None: size = -1
        size = size.__index__()
        while "\n" not in self._buf and (size < 0 or len(self._buf) < size):
            if not self._mais(): break
        i = self._buf.find("\n")
        i = len(self._buf) if i < 0 else i + 1
        if 0 <= size < i: i = size
        r, self._buf = self._buf[:i], self._buf[i:]
        return r
    def read(self, size=-1):
        if size is None: size = -1
        size = size.__index__()
        while size < 0 or len(self._buf) < size:
            if not self._mais(): break
        if size < 0: size = len(self._buf)
        r, self._buf = self._buf[:size], self._buf[size:]
        return r

# ---------- time.sleep: mostra a saída antes de dormir ----------
# O time.sleep do Pyodide usa o laço do navegador (trava dentro de um asyncio.run);
# o editor dorme com um setTimeout do JavaScript (com JSPI) ou com o sleep do C.
try:
    from pyodide.webloop import _orig_sleep as _dormir_c
except Exception:
    _dormir_c = time.sleep
_dormir_original = time.sleep
def _dormir(segundos, /):
    if segundos < 0:
        raise ValueError("sleep length must be non-negative")
    _descarregar()
    if _E.modo == "repeticao" and _E.pos < len(_E.linhas):
        return  # repetindo um trecho que o leitor já viu: não espera de novo
    espera = None
    if _E.dorme is not None:
        try: espera = _E.dorme(float(segundos))
        except Exception: espera = None
    import asyncio.events as ev
    if espera is not None and ev._get_running_loop() is None:
        # (dentro de um laço do asyncio o run_sync do Pyodide não volta: lá usa o sleep do C)
        from pyodide.ffi import can_run_sync
        if can_run_sync():
            _esperar_js(espera)
            return
    _dormir_c(segundos)
_dormir.__doc__ = _dormir_original.__doc__
time.sleep = _dormir

# ---------- asyncio sem o laço do navegador ----------
# O laço do Pyodide (WebLoop) depende do navegador e o SelectorEventLoop precisa de
# sockets. O editor usa um laço do próprio asyncio (BaseEventLoop) sem arquivos para
# vigiar: espera os temporizadores com time.sleep. asyncio.run, gather, sleep, create_task,
# wait_for, Queue, TaskGroup… funcionam como no Linux; o que precisa de threads não.
def _arrumar_asyncio():
    import asyncio, asyncio.runners, asyncio.base_events, asyncio.events as _ev
    _run = asyncio.runners.run
    if getattr(_run, "_guia", False): return
    class _SemArquivos:
        def select(self, timeout=None):
            if timeout is None:
                raise RuntimeError("o laço do asyncio ficaria esperando para sempre (nenhuma tarefa pode continuar)")
            if timeout > 0:
                _dormir(timeout)
            return []
        def get_map(self): return {}
        def close(self): pass
    class _LacoDoEditor(asyncio.base_events.BaseEventLoop):
        def __init__(self):
            super().__init__()
            self._selector = _SemArquivos()
        def _process_events(self, event_list): pass
        def _write_to_self(self): pass
    _LacoDoEditor.__name__ = _LacoDoEditor.__qualname__ = "_UnixSelectorEventLoop"
    asyncio.SelectorEventLoop = _LacoDoEditor
    def run(main, *, debug=None, loop_factory=None):
        if loop_factory is None:
            loop_factory = _LacoDoEditor
        antes = _ev._get_running_loop()
        _ev._set_running_loop(None)
        try:
            return _run(main, debug=debug, loop_factory=loop_factory)
        finally:
            _ev._set_running_loop(antes)
    run.__doc__ = _run.__doc__; run._guia = True
    asyncio.runners.run = run; asyncio.run = run
    class Runner(asyncio.runners.Runner):
        def __init__(self, *, debug=None, loop_factory=None):
            super().__init__(debug=debug, loop_factory=loop_factory or _LacoDoEditor)
        def run(self, coro, *, context=None):
            antes = _ev._get_running_loop()
            _ev._set_running_loop(None)
            try:
                return super().run(coro, context=context)
            finally:
                _ev._set_running_loop(antes)
    asyncio.runners.Runner = Runner; asyncio.Runner = Runner
    asyncio.new_event_loop = lambda: _LacoDoEditor()

# ---------- estado inicial (o que cada Rodar recupera) ----------
# módulos com estado que o leitor muda (logging.basicConfig, decimal.getcontext()…):
# sempre importados de novo
_SEMPRE_NOVOS = {"logging", "decimal", "_decimal", "_pydecimal", "locale", "_strptime", "calendar"}
_BASE = {}
def _system_do_navegador(command):
    """No navegador não há outros programas: o system() do Emscripten falha e o os.system devolve -1."""
    if not isinstance(command, (str, bytes, os.PathLike)):
        raise TypeError(f"expected str, bytes or os.PathLike object, not {type(command).__name__}")
    return -1

def preparar(ambiente, em_node=False):
    if em_node:
        os.system = _system_do_navegador
    _AMBIENTE.clear(); _AMBIENTE.update(ambiente.to_py() if hasattr(ambiente, "to_py") else ambiente)
    os.makedirs(HOME, exist_ok=True)
    import random, json, re, math, string, collections, functools, itertools, dataclasses, enum, datetime, pathlib, csv
    _arrumar_asyncio()
    # sem cores automáticas (traceback, doctest, unittest, pdb): a saída é a de um
    # python3 com a saída num arquivo/pipe, e as metas out: não tropeçam em \x1b[…m
    try:
        import _colorize
        _colorize.can_colorize = lambda *a, **k: False
    except Exception:
        pass
    import pdb
    _arrumar_pdb()
    import getpass
    getpass.getpass = _getpass
    _BASE["modulos"] = set(sys.modules)
    _BASE["builtins"] = dict(builtins.__dict__)
    _BASE["path"] = [p for p in sys.path if p not in ("", HOME)]
    _BASE["meta_path"] = list(sys.meta_path)
    _BASE["path_hooks"] = list(sys.path_hooks)
    _BASE["warn"] = list(warnings.filters)
    # o navegador daria "/home/ana/this.program" e o Node o caminho do script da VPS:
    # o editor usa o do python3 do Ubuntu (o do lab)
    _BASE["executable"] = "/usr/bin/python3"
    sys._base_executable = "/usr/bin/python3"
    import _locale
    _BASE["locale"] = _locale.setlocale(_locale.LC_ALL)
    return sys.version

def _limpar_pasta(p):
    try:
        for n in os.listdir(p):
            c = os.path.join(p, n)
            if os.path.isdir(c) and not os.path.islink(c): shutil.rmtree(c, ignore_errors=True)
            else:
                try: os.unlink(c)
                except OSError: pass
    except OSError:
        pass

def _reiniciar():
    _desarmar()
    for k in list(sys.modules):
        if k not in _BASE["modulos"] or k.split(".")[0] in _SEMPRE_NOVOS:
            del sys.modules[k]
    builtins.__dict__.clear(); builtins.__dict__.update(_BASE["builtins"])
    sys.path[:] = [HOME] + _BASE["path"]
    sys.meta_path[:] = _BASE["meta_path"]; sys.path_hooks[:] = _BASE["path_hooks"]
    sys.path_importer_cache.clear(); importlib.invalidate_caches()
    linecache.clearcache()
    os.environ.clear(); os.environ.update(_AMBIENTE)
    os.chdir("/")
    shutil.rmtree(HOME, ignore_errors=True); os.makedirs(HOME, exist_ok=True)
    _limpar_pasta("/tmp")
    os.chdir(HOME)
    _DESLOCAMENTO[0] = 0; _set_rec(1000); sys.settrace(None); sys.setprofile(None)
    try: sys.set_int_max_str_digits(4300)
    except Exception: pass
    sys.excepthook = sys.__excepthook__; sys.displayhook = sys.__displayhook__
    sys.breakpointhook = _breakpointhook; sys.unraisablehook = sys.__unraisablehook__
    sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__
    sys.executable = _BASE["executable"]
    sys.getrecursionlimit = getrecursionlimit; sys.setrecursionlimit = setrecursionlimit
    try:
        import _locale
        _locale.setlocale(_locale.LC_ALL, _BASE["locale"])
    except Exception:
        pass
    warnings.filters[:] = _BASE["warn"]
    for nome in ("_filters_mutated_lock_held", "_filters_mutated"):
        f = getattr(warnings, nome, None)
        if f:
            try: f(); break
            except Exception: pass
    atexit._clear()
    gc.collect()

# ---------- limite de recursão igual ao do python3 ----------
# O programa do leitor roda dentro de executar(): um quadro a mais na pilha. O editor soma
# esses quadros ao limite e esconde a soma (sys.getrecursionlimit() continua 1000).
_get_rec, _set_rec = sys.getrecursionlimit, sys.setrecursionlimit
_DESLOCAMENTO = [0]
def getrecursionlimit():
    return _get_rec() - _DESLOCAMENTO[0]
def setrecursionlimit(limit, /):
    if not isinstance(limit, int):
        raise TypeError("'%s' object cannot be interpreted as an integer" % type(limit).__name__)
    if limit < 1:
        raise ValueError("recursion limit must be greater or equal than 1")
    _set_rec(limit + _DESLOCAMENTO[0])
getrecursionlimit.__doc__ = _get_rec.__doc__; setrecursionlimit.__doc__ = _set_rec.__doc__
sys.getrecursionlimit = getrecursionlimit; sys.setrecursionlimit = setrecursionlimit

# ---------- getpass: o navegador não tem /dev/tty ----------
def _getpass(prompt="Password: ", stream=None, *, echo_char=None):
    """Como o getpass do Linux: o prompt vai para o terminal (aqui, stderr) e o que se digita não aparece."""
    _descarregar()
    f = stream or sys.stderr
    f.write(prompt); f.flush()
    _E.senha = True
    try:
        l = sys.stdin.readline()
    finally:
        _E.senha = False
    if not l:
        raise EOFError
    return l[:-1] if l.endswith("\n") else l

# ---------- breakpoint()/pdb: o depurador não entra no código do editor ----------
_PULAR = ["_guia_editor", "asyncio", "asyncio.*", "pyodide", "pyodide.*", "_pyodide", "_pyodide.*"]
def _breakpointhook(*args, **kws):
    import os as _os
    h = _os.environ.get("PYTHONBREAKPOINT")
    if h is not None and h.strip() == "0":
        return None
    import pdb
    p = pdb.Pdb(skip=_PULAR)
    p.set_trace(sys._getframe(1), *args, **kws) if args or kws else p.set_trace(sys._getframe(1))

def _arrumar_pdb():
    """pdb.set_trace()/pdb.Pdb() também pulam o código do editor."""
    import pdb
    if getattr(pdb.Pdb.__init__, "_guia", False): return
    ini = pdb.Pdb.__init__
    def __init__(self, completekey="tab", stdin=None, stdout=None, skip=None, *a, **k):
        skip = list(skip or []) + _PULAR
        ini(self, completekey, stdin, stdout, skip, *a, **k)
    __init__._guia = True
    pdb.Pdb.__init__ = __init__

def _sem_quadros_do_editor(tb):
    while tb is not None and tb.tb_frame.f_code.co_filename == _ESTE:
        tb = tb.tb_next
    return tb

def _filtrar_tb(tb):
    """O traceback sem NENHUM quadro do editor (nem no meio: asyncio.run, time.sleep…)."""
    quadros = []
    while tb is not None:
        if tb.tb_frame.f_code.co_filename != _ESTE:
            quadros.append(tb)
        tb = tb.tb_next
    novo = None
    for t in reversed(quadros):
        novo = types.TracebackType(novo, t.tb_frame, t.tb_lasti, t.tb_lineno)
    return novo

def _limpar_cadeia(e, vistos=None):
    vistos = vistos if vistos is not None else set()
    if e is None or id(e) in vistos: return
    vistos.add(id(e))
    try: e.__traceback__ = _filtrar_tb(e.__traceback__)
    except Exception: pass
    _limpar_cadeia(e.__cause__, vistos); _limpar_cadeia(e.__context__, vistos)
    for sub in getattr(e, "exceptions", None) or ():
        _limpar_cadeia(sub, vistos)

def _mostrar_excecao(e):
    _limpar_cadeia(e)
    tb = e.__traceback__
    try:
        texto = "".join(traceback.format_exception(type(e), e, tb))
    except BaseException:
        texto = type(e).__name__ + "\n"
    # a biblioteca padrão aparece no caminho do Ubuntu (o do lab), não no zip do Pyodide
    texto = texto.replace('File "/lib/python314.zip/', 'File "/usr/lib/python3.14/')
    _descarregar()
    try:
        if sys.excepthook is sys.__excepthook__:
            sys.stderr.write(texto); sys.stderr.flush()
        else:
            sys.excepthook(type(e), e, tb)
    except BaseException:
        sys.__stderr__.write(texto)
    return texto

def _escrever_arquivos(arquivos):
    for nome, codigo in arquivos:
        c = os.path.join(HOME, nome)
        d = os.path.dirname(c)
        if d: os.makedirs(d, exist_ok=True)
        with open(c, "w", encoding="utf-8", newline="") as f:
            f.write(codigo)

def executar(req, pedir=None, avisar=None, eco=None, dorme=None):
    r = req.to_py() if hasattr(req, "to_py") else req
    arquivos = [(a["nome"], a["codigo"]) for a in r["arquivos"]]
    _reiniciar()
    _escrever_arquivos(arquivos)
    _E.modo = r.get("modo") or "texto"
    _E.pedir, _E.avisar, _E.eco, _E.dorme = pedir, avisar, eco, dorme
    _E.pos = 0; _E.trocar = False
    if _E.modo == "texto":
        t = r.get("stdin") or ""
        _E.linhas = t.splitlines(keepends=True); _E.eof = True
    else:
        _E.linhas = list(r.get("linhas") or []); _E.eof = bool(r.get("eof"))
    sys.stdin = _Entrada(tty=_E.modo != "texto")
    principal_nome = arquivos[0][0]
    principal = os.path.join(HOME, principal_nome)
    args = [str(a) for a in (r.get("args") or [])]
    sys.argv = [principal_nome] + args
    sys.orig_argv = ["python3", principal_nome] + args
    if r.get("semente") is not None:
        import random
        random.seed(r["semente"])
    f, n = sys._getframe(), 0
    while f is not None:
        n += 1; f = f.f_back
    _DESLOCAMENTO[0] = n; _set_rec(1000 + n)
    mod = types.ModuleType("__main__")
    mod.__file__ = principal; mod.__cached__ = None; mod.__builtins__ = builtins
    sys.modules["__main__"] = mod
    res = {"exit": 0, "excecao": False, "tipo": None, "traceback": "", "precisa": False, "arquivos": {}}
    import asyncio.events as _ev
    laco_pyodide = _ev._get_running_loop()
    _ev._set_running_loop(None)   # como no python3: nenhum laço rodando no começo
    try:
        try:
            with open(principal, encoding="utf-8") as f:
                fonte = f.read()
            codigo = compile(fonte, principal, "exec", dont_inherit=True)
        except SyntaxError as e:
            e.__traceback__ = None
            res.update(exit=1, excecao=True, tipo=type(e).__name__, traceback=_mostrar_excecao(e))
        else:
            exec(codigo, mod.__dict__)
    except _Pare:
        res["precisa"] = True
    except SystemExit as e:
        c = e.code
        if c is None: res["exit"] = 0
        elif isinstance(c, int): res["exit"] = c & 0xFF
        else:
            try:
                _descarregar(); print(c, file=sys.stderr)
            except BaseException: pass
            res["exit"] = 1
    except BaseException as e:
        if _E.parado:
            res["precisa"] = True
        else:
            res.update(exit=130 if isinstance(e, KeyboardInterrupt) else 1, excecao=True,
                       tipo=type(e).__name__, traceback=_mostrar_excecao(e))
    finally:
        _ev._set_running_loop(laco_pyodide)
        parado = _E.parado
        _desarmar()
        if parado: res["precisa"] = True
    if not res["precisa"]:
        try:
            atexit._run_exitfuncs()
        except BaseException:
            pass
    atexit._clear()
    _descarregar()
    sys.stdout = sys.__stdout__; sys.stderr = sys.__stderr__
    res["trocar"] = _E.trocar
    for nome in (r.get("conferir") or []):
        c = os.path.join(HOME, nome)
        try:
            with open(c, encoding="utf-8", errors="replace") as f:
                res["arquivos"][nome] = f.read()
        except OSError:
            res["arquivos"][nome] = None
    _E.pedir = _E.avisar = _E.eco = _E.dorme = None
    return res
`;

/* ---------------------------------------------------------------------
   servirMotor: monta o Pyodide e atende as mensagens.
   opts = { loadPyodide, indexURL, enviar(msg), aoReceber(fn), jspi?: bool }
   --------------------------------------------------------------------- */
export async function servirMotor(opts) {
  const enviar = opts.enviar;
  let atual = null;           // execução em andamento: { id, … }
  let filaEntrada = [];       // linhas que chegaram antes de serem pedidas (não deve acontecer)
  let esperando = null;       // resolve(texto|null)
  let carregou;
  let fila = new Promise((ok) => { carregou = ok; });
  opts.aoReceber(function (m) {
    if (m.op === "entrada" || m.op === "eof") {
      const v = m.op === "eof" ? null : String(m.texto);
      if (esperando) { const f = esperando; esperando = null; f(v); } else filaEntrada.push(v);
      return;
    }
    if (m.op === "executar") fila = fila.then(() => executar(m)).catch((e) => enviar({ ev: "falha", id: m.id, msg: String((e && e.stack) || e) }));
  });

  const py = await opts.loadPyodide({
    indexURL: opts.indexURL,
    env: Object.assign({}, AMBIENTE),
    stdout: () => {}, stderr: () => {},
    checkAPIVersion: true,
    packages: [],
  });

  // saída: stdout como terminal (com buffer de linha), stderr sem buffer
  const dec = { out: new TextDecoder(), err: new TextDecoder() };
  let pend = [], ultimoEnvio = 0, total = 0, estourou = false;
  function despejar() {
    ultimoEnvio = Date.now();
    if (!pend.length || !atual) { pend = []; return; }
    enviar({ ev: "saida", id: atual.id, partes: pend });
    pend = [];
  }
  function escrever(t, u8) {
    if (!atual) return u8.length;
    const s = dec[t].decode(u8, { stream: true });
    if (!s) return u8.length;
    atual.saida(t, s);
    return u8.length;
  }
  function paraFila(t, s) {
    if (estourou) return;
    total += s.length;
    if (total > LIMITE_SAIDA) {
      estourou = true; despejar();
      enviar({ ev: "limite", id: atual.id });
      return;
    }
    // manda na hora: um laço infinito logo depois pode fazer o dono encerrar o worker,
    // e o que estivesse guardado aqui se perderia (o pysim.js junta os pedaços para desenhar)
    pend.push({ t: t, s: s });
    despejar();
  }
  py.setStdout({ write: (u8) => escrever("out", u8), isatty: true });
  py.setStderr({ write: (u8) => escrever("err", u8), isatty: false });

  py.FS.mkdirTree("/lib/guia");
  py.FS.writeFile("/lib/guia/_guia_editor.py", PY);
  py.runPython("import sys; sys.path.insert(0, '/lib/guia'); import _guia_editor; sys.path.remove('/lib/guia')");
  const ed = py.pyimport("_guia_editor");
  const versao = ed.preparar(py.toPy(AMBIENTE), !!opts.node);
  const executarPy = ed.executar;
  const temJspi = opts.jspi !== false && typeof WebAssembly.Suspending === "function" && typeof executarPy.callPromising === "function";
  let tzdata = false;

  function pedirLinha(senha) {
    despejar();
    enviar({ ev: "espera", id: atual.id, senha: !!senha });
    if (filaEntrada.length) { const v = filaEntrada.shift(); return Promise.resolve(v === null ? "" : v); }
    return new Promise((ok) => { esperando = (v) => ok(v === null ? "" : v); });
  }

  async function umaVez(req, extra) {
    const pedir = extra.pedir || null, avisar = extra.avisar || null;
    const eco = (l) => { despejar(); if (atual && atual.eco) enviar({ ev: "eco", id: atual.id, texto: String(l) }); };
    const dorme = (s) => {
      despejar(); enviar({ ev: "dorme", id: atual.id, ms: Math.round(s * 1000) });
      return temJspi ? new Promise((ok) => setTimeout(ok, Math.min(s * 1000, 2 ** 31 - 1))) : undefined;
    };
    const limpo = {};
    for (const k of Object.keys(req)) if (req[k] !== null && req[k] !== undefined) limpo[k] = req[k];
    const r = py.toPy(limpo);
    try {
      const f = temJspi ? executarPy.callPromising.bind(executarPy) : executarPy;
      const res = await f(r, pedir, avisar, eco, dorme);
      const js = res.toJs({ dict_converter: Object.fromEntries });
      res.destroy();
      return js;
    } finally { r.destroy(); }
  }

  async function executar(m) {
    const req = Object.assign({}, m.req);
    let modo = req.modo || "auto";
    if (req.stdin !== null && req.stdin !== undefined) modo = "texto";
    else if (modo === "auto") modo = temJspi ? "jspi" : "repeticao";
    if (modo === "jspi" && !temJspi) modo = "repeticao";
    if (!tzdata && req.arquivos.some((a) => /\b(zoneinfo|tzdata)\b/.test(a.codigo))) {
      try { await py.loadPackage("tzdata", { messageCallback: () => {}, errorCallback: () => {} }); tzdata = true; } catch (e) { /* sem fuso: o ZoneInfo dá erro */ }
    }
    total = 0; estourou = false; pend = []; ultimoEnvio = Date.now(); filaEntrada = []; esperando = null;
    dec.out = new TextDecoder(); dec.err = new TextDecoder();
    // semente do random fixa por Rodar (sorteada a cada Rodar): se precisar repetir, os números são os mesmos
    const semente = req.semente !== undefined ? req.semente : Math.floor(Math.random() * 2 ** 31);
    let res, repeticoes = 1;
    let lidas = [], mostrado0 = 0;
    if (modo !== "repeticao") {
      atual = { id: m.id, eco: modo === "texto", saida: (t, s) => { mostrado0 += s.length; paraFila(t, s); } };
      const pedido = Object.assign({}, req, { modo: modo, stdin: modo === "texto" ? (req.stdin || "") : null, semente: semente });
      const pedirGuardando = (senha) => pedirLinha(senha).then((l) => { if (l) lidas.push(l); return l; });
      res = await umaVez(pedido, { pedir: modo === "jspi" ? pedirGuardando : null });
    }
    if (modo === "repeticao" || (res && res.trocar)) {
      // "por repetição": roda até pedir uma linha nova; o leitor digita; roda de novo do
      // começo com as linhas já digitadas, mostrando só o que ainda não apareceu.
      const linhas = lidas.slice(); let eof = false, mostrado = mostrado0, senha = false;
      if (res && res.trocar) { modo = "repeticao"; repeticoes = 0; }
      for (;;) {
        let pos = 0, parou = false;
        atual = {
          id: m.id, eco: false,
          saida: function (t, s) {
            if (parou) return;
            const ini = pos; pos += s.length;
            if (pos <= mostrado) return;
            const corte = Math.max(0, mostrado - ini);
            mostrado = pos;
            paraFila(t, s.slice(corte));
          },
        };
        dec.out = new TextDecoder(); dec.err = new TextDecoder();
        const pedido = Object.assign({}, req, { modo: "repeticao", stdin: null, linhas: linhas.slice(), eof: eof, semente: semente });
        res = await umaVez(pedido, { avisar: (s) => { parou = true; senha = !!s; } });
        if (!res.precisa) break;
        const l = await pedirLinha(senha);
        if (!l) eof = true; else linhas.push(l);
        repeticoes++;
      }
    }
    despejar();
    res.modo = modo; res.repeticoes = repeticoes;
    if (estourou) res.limite = true;
    enviar({ ev: "fim", id: m.id, res: res });
    atual = null;
  }

  carregou();
  const info = { pyodide: py.version, python: String(versao).split(" ")[0], versaoCompleta: String(versao), jspi: temJspi };
  enviar({ ev: "pronto", info: info });
  return info;
}
