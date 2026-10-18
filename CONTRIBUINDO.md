# Como escrever uma página do Guia Python

O guia é uma **escola**, estilo W3Schools, para quem **nunca programou**. **Uma aula = um assunto.** O dono do projeto já reclamou de outro guia que juntava vários assuntos numa página. Nunca mostre código "seco":
- explique cada parte (anatomia);
- mostre a **saída real**, colhida no Python de verdade (laboratório);
- mostre o que acontece quando dá errado, com a mensagem **real** do Python (o traceback);
- deixe o leitor praticar no editor do guia, que roda **Python de verdade** no navegador.

Antes de tudo, leia o `RECURSOS.md`: onde trabalhar (VPS) e como.

## 1. Esqueleto do arquivo
Use como modelo a estrutura de `/home/admin/guia-sql/where.html` (cabeçalho, `<main>`, blocos, rodapé, `.exercise`, `.mc`, `dl.anatomy`, `div.cenario`, `div.note`, `table.ref`). Troque:
- `<title>Python TEMA — descrição | Guia Python</title>`;
- `<h1>Python <span class="hl">TEMA</span></h1>`;
- a caixa `.trysql` por **`.trypy`** (seção 3).

Menu, selo e Anterior/Próximo vêm de `assets/site.js` (`NIVEIS`). **Não mude a `NIVEIS`.** Links internos só para páginas que estão nela.

## 2. Ordem de uma aula
1. Intro.
2. "Você vai aprender".
3. A ideia antes do código, com uma comparação do dia a dia (uma receita de bolo, uma caixa com etiqueta, uma lista de compras).
4. Do simples ao completo, uma novidade por vez, com `dl.anatomy` ou uma tabela "parte → o que faz".
5. **A saída real** depois de cada exemplo: `pre.term` com `$ python3 arquivo.py` (ou o `>>>` do modo interativo) e o que o Python respondeu no lab.
6. **Pelo menos dois "Experimente"** (`.trypy`) por aula: um no meio e uma missão no fim.
7. Formas diferentes de fazer a mesma coisa + tabela "qual usar".
8. **Quando dá errado** (`div.cenario`): o código errado e o **traceback real** (colha no lab, nunca de memória), explicado linha por linha em português.
9. Referência (`table.ref`).
10. Exercícios (3 ou mais: `.exercise`, `.mc`).
11. Resumo.

Páginas de **Projetos**: passo a passo (versão 1, 2, 3… do programa, cada uma com um `.trypy`). Páginas de **Referência**: tabelas, com poucos `.trypy` (1 ou 2).

## 3. Componentes

### Código para ler
```html
<pre class="file" data-file="ola.py">nome = "Ana"
print(f"Olá, {nome}!")
</pre>
```
Dentro de `<pre>`, escape `<`, `>` e `&` (`&lt;`, `&gt;`, `&amp;`): `if x &lt; 10:`, `a &amp; b`, `-&gt; int`. O testador confere.

### Terminal (`pre.term`)
- `$ ` = `ana@notebook:~$` (o prompt aparece sozinho);
- `>>> ` e `... ` = o modo interativo do Python (o site destaca como prompt);
- `> ` = continuação do bash;
- `«` = anotação (vira um comentário em cinza à direita).

Toda saída vem do lab. Exemplo:
```html
<pre class="term">$ python3 ola.py
Olá, Ana!
</pre>
```

### Editor "Experimente" (`.trypy`), com Python de verdade
```html
<div class="trypy" data-goal="out:Olá, Ana!">
<p class="try-task"><strong>Missão:</strong> troque "mundo" por "Ana" e clique em Rodar.</p>
<pre class="script" data-file="main.py">print("Olá, mundo!")
</pre>
<pre class="solucao" data-file="main.py">print("Olá, Ana!")
</pre>
</div>
```
- **Rodar** executa o código no **CPython 3.14 real** compilado para WebAssembly (Pyodide), carregado na primeira vez que o leitor clica em Rodar. A caixa mostra a saída, o traceback em vermelho quando dá erro e o código de saída.
- **Vários arquivos** (módulo próprio, `.txt`, `.csv`, `.json`): vários `<pre class="script" data-file="…">` na mesma caixa viram abas; o primeiro é o que roda (`python3 main.py`), os outros ficam na pasta do programa.
- `data-stdin="linha1\nlinha2"`: o que o `input()` vai ler. Sem `data-stdin`, o programa **pede e o leitor digita** no terminal da caixa.
- `data-args="a b"`: o que chega em `sys.argv[1:]`.
- Sem `data-goal`: caixa livre. Com `data-goal`: missão, e o `pre.solucao` é **obrigatório** (um por aba que muda).
- Cada Rodar parte do zero: arquivos e variáveis da execução anterior somem.

### Metas (`data-goal`) — regras fixas, não invente outras
Várias metas se separam com **`;;`** (ex.: `data-goal="out:Total: 30;;semerro"`); **todas** precisam passar.

| Meta | Verdade quando… |
| --- | --- |
| `out:TEXTO` | a saída do programa (stdout e stderr, na ordem, como no terminal) **contém** o texto, exatamente |
| `outre:REGEX` | a saída inteira casa com a regex |
| `semerro` | o programa terminou sem exceção não tratada (e sem `SyntaxError`) |
| `erro:TEXTO` ou `erro:/REGEX/` | o programa terminou com exceção não tratada e o traceback contém o texto (ou casa) — ex.: `erro:ZeroDivisionError` |
| `exit:N` | o código de saída foi N (`sys.exit(N)`; exceção não tratada = 1; normal = 0) |
| `src:REGEX` | o código do leitor (todas as abas) casa com a regex — para exigir um recurso: `src:\bfor\b` |
| `arquivo:NOME` | depois de rodar, o arquivo NOME existe na pasta do programa |
| `arquivo:NOME~TEXTO` | …e contém o texto |

**Regras exatas:**
- Regex é a do JavaScript. `outre:` aplica **sem flags** à saída inteira: `^`/`$` são começo e fim da saída toda; escreva `\n` para as quebras (`outre:^1\n2\n3\n$`). `src:` aplica com a flag `m`. `erro:/…/` aceita flags (`/…/i`).
- Dentro de regex, `|` é alternativa e `\|` é a barra vertical literal. Não há outros escapes no `data-goal` além do HTML (`&quot;`, `&lt;`, `&amp;`).
- `out:`/`outre:` olham só a saída do programa (o que `print` escreveu e o traceback), nunca mensagens do editor.
- O **código inicial não pode cumprir a meta**, e a **solução tem de cumprir** (o testador confere os dois).
- **Prefira metas tolerantes** (`out:` com um trecho que só a resposta certa produz, `semerro`, `src:`) a um `outre:` que só aceita uma escrita exata.
- **A meta não pode depender** do que muda entre execuções ou entre o editor e o lab: números de `random` sem `seed`, data e hora, `id()`, endereços (`0x7f…`), ordem de `set` de textos, tempo de execução, caminhos de pasta.

### Outros blocos
`dl.anatomy`, `div.note/.tip/.warning/.cenario`, `ol.passo`, `div.table-wrap > table.ref`, `.exercise`, `.mc`, `figure`, `<span class="versao">3.14</span>`.

No `.exercise`, `data-answer="a|b"` aceita respostas alternativas (a comparação é **exata**: `True` ≠ `true`). Para uma barra vertical dentro da resposta, escreva `\|`.

## 4. O editor do guia: Python real no navegador (`assets/pysim.js`)
> **Esta seção é mantida pelo agente do simulador.** Antes de escrever uma frase do tipo "no editor…" que não esteja aqui, confira com as ferramentas dele (`tools/sim.js`).

### 4.1 O que é
- **Editor = Python 3.14.2** (CPython de verdade compilado para WebAssembly: **Pyodide 314.0.7**, em `assets/py/`, ~6 MB baixados no 1º Rodar e guardados pelo navegador). **Lab = Python 3.14.4** do Ubuntu 26.04. Mesma série 3.14; as mensagens de erro, o traceback e o comportamento da linguagem são os mesmos. Detalhes em `assets/py/VERSAO.txt`.
- Metas: o `data-goal` é lido **já decodificado** (o `&lt;`/`&quot;` vira `<`/`"`) e só então separado nos `;;` — no editor e no testador. `out:&lt;class 'str'&gt;;;semerro` funciona.
- Roda num Web Worker: a página não trava. Cada **Rodar** parte do zero: `/home/ana` vazia com só os arquivos das abas, `__main__` novo, módulos do leitor esquecidos, `os.environ` e `logging`/`decimal`/`locale` reiniciados.
- O terminal da caixa mostra `ana@notebook:~$ python3 main.py` (+ `data-args`), a saída (stderr/traceback em **vermelho**, cores ANSI desenhadas), e no fim `[código de saída: N]`.

### 4.2 Números fixos (não mudam sem aviso)
| O quê | Valor |
|---|---|
| Tempo máximo rodando | **10 s** (sem contar a espera pelo teclado; até 60 s de `time.sleep` não contam). Passou: `(o editor parou o programa: ele rodou mais de 10 segundos sem terminar — laço infinito?)` e `[programa interrompido]` |
| Botão **■ Parar** (o Rodar vira Parar) e **Ctrl+C** no campo de entrada | encerram na hora: mostra `^C` e `[programa interrompido]`. **Não** há `KeyboardInterrupt`/traceback (no terminal do lab, Ctrl+C mostra o traceback do `KeyboardInterrupt`) e os `finally` não rodam |
| Saída máxima | **2 milhões de caracteres**; o terminal desenha as primeiras **3000 linhas** e as últimas 40 (as metas veem tudo) |
| `sys.getrecursionlimit()` | 1000, igual ao lab: cabem as mesmas chamadas (`[Previous line repeated 996 more times]` nos dois; até 18/10 o editor mostrava 995 — corrigido) |

### 4.3 Entrada (`input()`)
- **Com `data-stdin`**: o `input()` lê dali (uma linha por `\n`); a caixa ganha um campo **Entrada** editável. A linha lida aparece no terminal em branco logo depois do prompt (como se fosse digitada), mas **não entra no `out:`**: a saída do programa é `Qual é o seu nome? Olá, Ana!` — a mesma de `python3 main.py < entrada.txt` no lab. Acabou o texto → `EOFError: EOF when reading a line`.
- **Sem `data-stdin`**: o programa para no `input()` e o leitor **digita no terminal da caixa** (Enter envia; **Ctrl+D** = fim da entrada; Ctrl+C = Parar). Funciona em laços, com `try/except`, `sys.stdin.read()`, `for linha in sys.stdin`, `getpass.getpass()` (campo de senha: nada aparece) e `breakpoint()`/`pdb` (o depurador funciona: `p x`, `n`, `c`).
- Como: no **Chrome/Edge** (e onde houver JSPI) o programa fica de fato parado esperando. Nos navegadores sem JSPI (Safari, Firefox antigos) o editor usa o modo **por repetição**: roda até o `input()`, o leitor digita, e roda **de novo do começo** com as linhas já digitadas, mostrando só o que é novo — parece contínuo. Limites desse modo: o programa repete o trabalho (um programa lento fica lento a cada linha); `random` dá os mesmos números a cada repetição (o editor fixa a semente por Rodar), mas **hora** (`datetime.now()`, `time.time()`) e `os.urandom`/`secrets`/`uuid4` mudam; arquivos são recriados a cada repetição.
- **Missão que lê o teclado**: com `data-stdin` (o mais simples), ou, se o leitor deve **digitar**, com **`data-digitar="Bia\n30"`**: o editor ignora esse atributo (o leitor digita), mas o testador e o `testar-navegador.js` digitam essas linhas quando o programa pede. Sem nenhum dos dois, o testador manda "fim de entrada" e avisa.
- **Laço infinito de propósito** (para mostrar o ■ Parar): ponha **`data-sem-fim`** na `div.trypy`. O testador confere que ele de fato não termina (FALHA se terminar) e o teste no navegador não o roda. Sem o atributo, uma caixa que passa de 10 s é FALHA.

### 4.4 O que funciona e o que não funciona no editor (conferido com `tools/sim.js` e no Chromium)
| Recurso | No editor |
|---|---|
| Arquivos (`open`, `with`, `pathlib`, `csv`, `json`, `os.listdir`, pastas) | ✔ funcionam, na `/home/ana` da caixa (some no próximo Rodar). Abas extras (`data-file="dados.csv"`) já estão lá |
| Módulo próprio (`import contas` com a aba `contas.py`) | ✔ |
| `sqlite3` | ✔ (SQLite **3.39.0** no editor; **3.46.1** no lab) |
| `math`, `random`, `datetime`, `collections`, `itertools`, `re`, `dataclasses`, `enum`, `typing`, `decimal`, `fractions`, `statistics`, `argparse`, `logging`, `unittest`, `doctest`, `string.templatelib` | ✔ |
| `zoneinfo` (`ZoneInfo("America/Sao_Paulo")`) | ✔ (o editor baixa os fusos, 350 kB, quando o código cita `zoneinfo`) |
| `time.sleep` | ✔ espera de verdade e mostra a saída antes de dormir (contagem regressiva funciona) |
| `asyncio` (`asyncio.run`, `gather`, `sleep`, `create_task`, `TaskGroup`, `wait_for`, `Queue`) | ✔ (laço do próprio asyncio); **✘** `asyncio.to_thread`/`run_in_executor` (threads) |
| `breakpoint()` / `pdb` | ✔ (digitando os comandos no terminal da caixa) |
| `getpass.getpass()` | ✔ (prompt no stderr, digitação escondida) |
| `threading.Thread(...).start()`, `concurrent.futures.ThreadPoolExecutor`, `multiprocessing` | **✘** `RuntimeError: can't start new thread` |
| `subprocess.run([...])`, `os.popen` | **✘** `OSError: [Errno 138] emscripten does not support processes.` |
| `os.system("ls")` | **✘** não roda nada e devolve `-1` (no lab roda o comando e devolve `0`) |
| `os.fork()` | **✘** `OSError: [Errno 52] Function not implemented` |
| Rede: `urllib.request.urlopen`, `socket`, `http.client` | **✘** sem rede. No navegador: `https://…` → `RuntimeError: TLS not supported in this environment`; `http://…` → `URLError: <urlopen error timed out>` (depois de esperar). No `tools/sim.js` (Node) a mensagem é outra (`[Errno 23] Host is unreachable`): não ponha a mensagem de rede numa meta |
| `pip`, `venv`, `ensurepip` | **✘** `ModuleNotFoundError: No module named 'pip'` (e `'venv'`): ensine no terminal (lab) |
| `tkinter`, `turtle`, `curses`, `readline`, `dbm`, `pwd`, `grp`, `resource`, `idlelib` | **✘** `ModuleNotFoundError: No module named 'tkinter'` (etc.) |
| `locale.setlocale(locale.LC_ALL, "")` + `locale.currency(...)`, `f"{x:n}"` | **✘** aceita o `setlocale`, mas formata como o locale "C": `ValueError: Currency formatting is not possible using the 'C' locale.` (no lab: `R$ 1.234,50`) |
| O modo interativo `>>>` | **✘** o editor roda arquivos (`python3 main.py`); o `>>>` se mostra com `pre.term` colhido no lab (`-t`) |

### 4.5 Diferenças editor × lab (com o mesmo programa)
| Assunto | Editor | Lab (`python3`) |
|---|---|---|
| `sys.version` | `3.14.2 (main, Sep 14 2026, 03:03:51) [Clang 23.0.0git (…)` | `3.14.4 (main, Aug 20 2026, 10:41:58) [GCC 15.2.0]` |
| `sys.platform`, `os.name`, `platform.system()`, `platform.machine()` | `emscripten posix Emscripten wasm32` | `linux posix Linux x86_64` |
| `os.uname()`, `socket.gethostname()`, `platform.node()` | `Emscripten`, `emscripten` | `Linux`, `notebook` |
| `sys.maxsize` | `2147483647` (32 bits) | `9223372036854775807` |
| `sys.executable` | `/usr/bin/python3` (o editor imita o lab) | `/usr/bin/python3` |
| `os.getcwd()`, `__file__`, `sys.argv`, `HOME`, `getpass.getuser()` | **iguais**: `/home/ana`, `/home/ana/main.py`, `['main.py', …]`, `ana` | iguais |
| Traceback do programa | **igual** (`File "/home/ana/main.py", line 3, in <module>`, as setas `^^^^`, `Did you mean: 'nomes'?`) | igual |
| Traceback que passa pela biblioteca padrão (`json`, `asyncio.run`…) | **igual**: o editor mostra `File "/usr/lib/python3.14/json/decoder.py", line 345, in decode` e esconde os quadros internos dele. Só o `traceback.print_exc()`/`format_exc()` chamado pelo próprio programa mostra o caminho real do editor (`/lib/python314.zip/json/decoder.py`) | `File "/usr/lib/python3.14/json/decoder.py", line 345, in decode` |
| `print("oi", end="")` e depois um erro | `oiTraceback (most recent call last):` (igual ao lab) | igual |
| Hora e fuso (`datetime.now()`, `time.tzname`) | o **relógio e o fuso do leitor** (do navegador) | `America/Sao_Paulo` (`-03`) |
| `os.cpu_count()` | `1` | o número de núcleos |
| Desempenho | ~3 a 4× mais lento (`sum(i*i for i in range(3_000_000))`: 0,64 s × 0,16 s) | — |
| Ordem de `set` de textos, `id()`, `hash()` de texto | mudam (e podem repetir entre Rodar na mesma página) | mudam a cada execução |
| Ctrl+C | Parar: `^C`, sem traceback | traceback do `KeyboardInterrupt`, código 130 |
| `__pycache__` ao importar módulo próprio | não é criado | criado ao lado do módulo |
| `sys.getsizeof(...)` | `16 24 28 16` para `1`, `"abc"`, `[]`, `1.5` (32 bits: cerca de metade) | `28 44 56 24` |
| Endereço no repr de objeto | `<__main__.A object at 0x184ad08>` (curto) | `<__main__.A object at 0x7fbf87390590>` |
| `2.0 ** 10000` | `OverflowError: (68, 'Result not representable')` (errno do Emscripten) | `OverflowError: (34, 'Numerical result out of range')` |
| Cores automáticas (traceback, `doctest`, `unittest`, `pdb`) | nunca (como o `python3` com a saída num arquivo) | coloridas no terminal (`-t`); sem cor com a saída num pipe/arquivo |

Por isso: **meta e texto da aula não podem depender** de nada da tabela acima (§3). Diga "no editor…" só com o que está nesta seção; o resto, mostre no lab.

### 4.6 As ferramentas (na VPS, dentro de `~/guia-python`; Node 24: `. ~/.profile` antes)
- **`tools/sim.js`** — roda um programa **como o editor** (o mesmo Pyodide e o mesmo motor):
  ```
  timeout 60 node tools/sim.js main.py [contas.py precos.txt] [--stdin "Ana\n30"] [--args "a 'b c'"] [--goal "out:Olá;;semerro"]
  timeout 60 node tools/sim.js - < programa.py          (o programa vem da entrada; vira main.py)
  timeout 60 node tools/sim.js -c 'print(1/0)'
  timeout 60 node tools/sim.js main.py --digitar "Ana\n30"   (o leitor digitando, sem data-stdin; --repeticao força o modo por repetição)
  ```
  Mostra o terminal da caixa e `[código de saída: N]`; com `--goal`, diz se a missão passaria e qual meta falhou. `--json` dá tudo em JSON. Sem `--stdin`/`--digitar`, o `input()` recebe fim de entrada.
- **`tools/testar-missoes.js`** (ou, do notebook, `~/guia-python-lab/testar pagina.html`) — confere a página: contrato das caixas, metas, **inicial falha e solução passa**, laço infinito, `<`/`&` sem escape em `pre`, links fora da NIVEIS (aviso), privacidade (FALHA):
  ```
  timeout 300 node tools/testar-missoes.js pagina.html [-q]
  timeout 600 node tools/testar-missoes.js --nativo pagina.html   (+ roda inicial e solução no python3 do lab; diferenças em tools/DIFERENCAS.md)
  ```
- **`tools/testar-navegador.js`** — a página num Chromium de verdade (cliques, Rodar em todas as caixas). Ver `tools/ESTADO.md`.

## 5. Fidelidade: o laboratório (`~/guia-python-lab/lab`, na VPS)
É a máquina da Ana (usuária `ana`, computador `notebook`, `/home/ana`, pt_BR, Ubuntu 26.04) com o **Python 3.14.4 do Ubuntu, de verdade** (sem `python-is-python3`: o comando `python` não existe, só `python3`). Toda saída de terminal mostrada numa aula vem de lá (detalhes em `~/guia-python-lab/COMO-USAR.md`):
- programa em arquivo: crie o `.py` na home da Ana e rode `python3 arquivo.py`;
- modo interativo (`>>>`): `-t` (terminal de verdade), **sempre com `| ~/guia-python-lab/tela`** (o REPL novo redesenha a linha com cores; o `tela` devolve o texto exato da tela). Mande as linhas de um bloco sem os espaços da frente: o REPL novo indenta sozinho (ver COMO-USAR);
- **as mensagens de erro do Python saem em inglês** (`NameError: name 'nome' is not defined. Did you mean: 'nomes'?`): copie como saíram e explique em português;
- **Privacidade:** nada da máquina real nem da VPS; só `/home/ana/…`, `ana@notebook`.

## 6. Versão
O guia ensina o **Python 3.14** (o do Ubuntu 26.04 LTS e o do editor). Novidades da 3.14 (e da 3.15, lançada em outubro de 2026) ficam marcadas com `<span class="versao">3.14</span>` e reunidas em `novidades.html`. Quando algo mudou de versão para versão e o leitor pode ter um Python mais antigo (o Debian 13 traz o 3.13), avise numa `div.note`. Nunca afirme algo de uma versão sem conferir na documentação oficial (docs.python.org) — marque como **ilustrativo** o que não deu para rodar.

## 7. Escrita
- Português do Brasil, frases curtas, "você". O leitor nunca programou.
- Termos em inglês ganham tradução na primeira vez: `print` = "imprimir/mostrar", `if` = "se".
- Exemplos com a vida da Ana: a lista de compras, as notas da turma, o estoque da lojinha, a agenda, a padaria do bairro.
- Boas práticas desde o começo, sempre com o porquê: nomes claros em minúsculas_com_sublinhado, 4 espaços de indentação, `with` para arquivos, `f-strings` para formatar.
- Nomes de variáveis em português e sem acento nos exemplos (`preco`, `quantidade`), explicando uma vez que acentos funcionam mas não são o costume.
