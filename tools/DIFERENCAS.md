# Diferenças: editor do guia (Pyodide) × python3 do lab

Mantido pelo `tools/testar-missoes.js --nativo`. O editor roda o **CPython do Pyodide**
(versão em `assets/py/VERSAO.txt`) no navegador; o lab (`~/guia-python-lab/lab`) roda o
**python3 do Ubuntu 26.04**. O testador roda o código inicial e a solução de cada caixa nos dois,
com o mesmo stdin e os mesmos argumentos, e compara a saída (stdout + stderr) e o código de saída.

## Diferenças conhecidas (esperadas)
Estão na §4 do `CONTRIBUINDO.md` (o que o editor faz diferente e por quê): `sys.platform`
(`emscripten` × `linux`), `os.system`/`subprocess` (não existem no navegador), threads, rede,
hora/fuso (o do navegador do leitor), `platform.*`, `sys.executable`, desempenho.
Uma diferença que **não** está lá é um achado: avise o agente do simulador.

## Diferenças encontradas
<!-- AUTO: cada página tem a sua seção, reescrita a cada --nativo. Página sem diferença não aparece. -->

<!-- pagina:arquivos.html -->
### arquivos.html (2026-10-18 16:02 UTC)

**caixa 2, código inicial (linha 280)** — saída diferente: + FileNotFoundError: [Errno 2] No such file or directory: 'diario.txt' | - FileNotFoundError: [Errno 44] No such file or directory: 'diario.txt'

```python
with open("diario.txt", "r", encoding="utf-8") as arquivo:
    arquivo.write("Hoje fez sol.\n")
print("Diário salvo.")
```

- editor (código de saída 1):

```
Traceback (most recent call last):
  File "/home/ana/main.py", line 1, in <module>
    with open("diario.txt", "r", encoding="utf-8") as arquivo:
         ~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
FileNotFoundError: [Errno 44] No such file or directory: 'diario.txt'
```
- lab, python3 (código de saída 1):

```
Traceback (most recent call last):
  File "/home/ana/main.py", line 1, in <module>
    with open("diario.txt", "r", encoding="utf-8") as arquivo:
         ~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
FileNotFoundError: [Errno 2] No such file or directory: 'diario.txt'
```

**caixa 3, código inicial (linha 567)** — saída diferente: + FileNotFoundError: [Errno 2] No such file or directory: 'boletim.txt' | - FileNotFoundError: [Errno 44] No such file or directory: 'boletim.txt'

```python
nome = input("Qual arquivo? ")
with open(nome, encoding="utf-8") as arquivo:
    print(arquivo.read())
```

- editor (código de saída 1):

```
Qual arquivo? Traceback (most recent call last):
  File "/home/ana/main.py", line 2, in <module>
    with open(nome, encoding="utf-8") as arquivo:
         ~~~~^^^^^^^^^^^^^^^^^^^^^^^^
FileNotFoundError: [Errno 44] No such file or directory: 'boletim.txt'
```
- lab, python3 (código de saída 1):

```
Qual arquivo? Traceback (most recent call last):
  File "/home/ana/main.py", line 2, in <module>
    with open(nome, encoding="utf-8") as arquivo:
         ~~~~^^^^^^^^^^^^^^^^^^^^^^^^
FileNotFoundError: [Errno 2] No such file or directory: 'boletim.txt'
```
<!-- /pagina:arquivos.html -->

<!-- pagina:dataclasses.html -->
### dataclasses.html (2026-10-18 16:02 UTC)

**caixa 1, código inicial (linha 147)** — saída diferente: + <__main__.Aluno object at 0x7f93fa390590> | - <__main__.Aluno object at 0x1497638> (esperado: endereços de memória (id(), repr de objetos))

```python
class Aluno:
    def __init__(self, nome, nota):
        self.nome = nome
        self.nota = nota


bia = Aluno("Bia", 8.5)
print(bia)
```

- editor (código de saída 0):

```
<__main__.Aluno object at 0x1497638>
```
- lab, python3 (código de saída 0):

```
<__main__.Aluno object at 0x7f93fa390590>
```
<!-- /pagina:dataclasses.html -->

<!-- pagina:datetime.html -->
### datetime.html (2026-10-18 16:02 UTC)

**caixa 1, código inicial (linha 125)** — saída diferente: + Agora: 2026-10-18 13:02:43.733302 | - Agora: 2026-10-18 16:02:43.692000 (esperado: data, hora e tempo medido)

```python
from datetime import date, datetime

print("Hoje:", date.today())
print("Agora:", datetime.now())
```

- editor (código de saída 0):

```
Hoje: 2026-10-18
Agora: 2026-10-18 16:02:43.692000
```
- lab, python3 (código de saída 0):

```
Hoje: 2026-10-18
Agora: 2026-10-18 13:02:43.733302
```
<!-- /pagina:datetime.html -->

<!-- pagina:decoradores.html -->
### decoradores.html (2026-10-18 16:02 UTC)

**caixa 2, código inicial (linha 384)** — saída diferente: + somar_ate levou 0.0377 s | - somar_ate levou 0.0918 s | + somar_ate_rapido levou 0.0102 s | - somar_ate_rapido levou 0.0879 s (esperado: data, hora e tempo medido)

```python
import time
from functools import wraps


def cronometro(funcao):
    @wraps(funcao)
    def embrulho(*args, **kwargs):
        inicio = time.perf_counter()
        resultado = funcao(*args, **kwargs)
        fim = time.perf_counter()
        print(f"{funcao.__name__} levou {fim - inicio:.4f} s")
        return resultado
    return embrulho


@cronometro
def somar_ate(n):
    total = 0
    for i in range(n):
        total += i
    return total


@cronometro
def somar_ate_rapido(n):
    return sum(range(n))


print(somar_ate(1_000_000))
print(somar_ate_rapido(1_000_000))
```

- editor (código de saída 0):

```
somar_ate levou 0.0918 s
499999500000
somar_ate_rapido levou 0.0879 s
499999500000
```
- lab, python3 (código de saída 0):

```
somar_ate levou 0.0377 s
499999500000
somar_ate_rapido levou 0.0102 s
499999500000
```
<!-- /pagina:decoradores.html -->

<!-- pagina:geradores.html -->
### geradores.html (2026-10-18 16:03 UTC)

**caixa 3, código inicial (linha 310)** — saída diferente: + Lista:    8448728 bytes | + Gerador:  208 bytes | - Lista:    4224364 bytes | - Gerador:  104 bytes

```python
import sys

em_lista = [n * n for n in range(1_000_000)]
em_gerador = (n * n for n in range(1_000_000))

print("Lista:   ", sys.getsizeof(em_lista), "bytes")
print("Gerador: ", sys.getsizeof(em_gerador), "bytes")
```

- editor (código de saída 0):

```
Lista:    4224364 bytes
Gerador:  104 bytes
```
- lab, python3 (código de saída 0):

```
Lista:    8448728 bytes
Gerador:  208 bytes
```
<!-- /pagina:geradores.html -->

<!-- pagina:metodos-especiais.html -->
### metodos-especiais.html (2026-10-18 16:03 UTC)

**caixa 1, código inicial (linha 139)** — saída diferente: + <__main__.Produto object at 0x7f3fc4f30590> | - <__main__.Produto object at 0x1907f78> (esperado: endereços de memória (id(), repr de objetos))

```python
class Produto:
    def __init__(self, nome, preco):
        self.nome = nome
        self.preco = preco


leite = Produto("Leite", 5.49)
print(leite)
```

- editor (código de saída 0):

```
<__main__.Produto object at 0x1907f78>
```
- lab, python3 (código de saída 0):

```
<__main__.Produto object at 0x7f3fc4f30590>
```
<!-- /pagina:metodos-especiais.html -->

<!-- pagina:pathlib.html -->
### pathlib.html (2026-10-18 16:03 UTC)

**caixa 2, código inicial (linha 356)** — saída diferente: +   File "/usr/lib/python3.14/pathlib/__init__.py", line 810, in write_text | -   File "/usr/lib/python3.14/pathlib/__init__.py", line 809, in write_text | +   File "/usr/lib/python3.14/pathlib/__init (esperado: caminhos da biblioteca padrão no traceback)

```python
from pathlib import Path

pasta = Path("mercado")
lista = pasta / "lista.txt"

lista.write_text("arroz\nfeijão\n", encoding="utf-8")
print(lista.read_text(encoding="utf-8"))
```

- editor (código de saída 1):

```
Traceback (most recent call last):
  File "/home/ana/main.py", line 6, in <module>
    lista.write_text("arroz\nfeijão\n", encoding="utf-8")
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/lib/python3.14/pathlib/__init__.py", line 809, in write_text
    with self.open(mode='w', encoding=encoding, errors=errors, newline=newline) as f:
         ~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/lib/python3.14/pathlib/__init__.py", line 771, in open
    return io.open(self, mode, buffering, encoding, errors, newline)
           ~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
FileNotFoundError: [Errno 44] No such file or directory: 'mercado/lista.txt'
```
- lab, python3 (código de saída 1):

```
Traceback (most recent call last):
  File "/home/ana/main.py", line 6, in <module>
    lista.write_text("arroz\nfeijão\n", encoding="utf-8")
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/lib/python3.14/pathlib/__init__.py", line 810, in write_text
    with self.open(mode='w', encoding=encoding, errors=errors, newline=newline) as f:
         ~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/lib/python3.14/pathlib/__init__.py", line 772, in open
    return io.open(self, mode, buffering, encoding, errors, newline)
           ~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
FileNotFoundError: [Errno 2] No such file or directory: 'mercado/lista.txt'
```

**caixa 3, código inicial (linha 695)** — saída diferente: +   File "/usr/lib/python3.14/pathlib/__init__.py", line 1012, in mkdir | -   File "/usr/lib/python3.14/pathlib/__init__.py", line 1011, in mkdir | + FileNotFoundError: [Errno 2] No such file or direc (esperado: caminhos da biblioteca padrão no traceback)

```python
from pathlib import Path

pasta = Path("arquivo_morto") / "2026"
pasta.mkdir()
print("Pasta criada:", pasta.name, "é pasta?", pasta.is_dir())
```

- editor (código de saída 1):

```
Traceback (most recent call last):
  File "/home/ana/main.py", line 4, in <module>
    pasta.mkdir()
    ~~~~~~~~~~~^^
  File "/usr/lib/python3.14/pathlib/__init__.py", line 1011, in mkdir
    os.mkdir(self, mode)
    ~~~~~~~~^^^^^^^^^^^^
FileNotFoundError: [Errno 44] No such file or directory: 'arquivo_morto/2026'
```
- lab, python3 (código de saída 1):

```
Traceback (most recent call last):
  File "/home/ana/main.py", line 4, in <module>
    pasta.mkdir()
    ~~~~~~~~~~~^^
  File "/usr/lib/python3.14/pathlib/__init__.py", line 1012, in mkdir
    os.mkdir(self, mode)
    ~~~~~~~~^^^^^^^^^^^^
FileNotFoundError: [Errno 2] No such file or directory: 'arquivo_morto/2026'
```
<!-- /pagina:pathlib.html -->

<!-- pagina:random.html -->
### random.html (2026-10-18 16:03 UTC)

**caixa 1, solução (linha 73)** — saída diferente: + Dado de 20 lados: 1 | - Dado de 20 lados: 15 (esperado: números sorteados sem seed)

```python
import random

print("Dado de 20 lados:", random.randint(1, 20))
```

- editor (código de saída 0):

```
Dado de 20 lados: 15
```
- lab, python3 (código de saída 0):

```
Dado de 20 lados: 1
```
<!-- /pagina:random.html -->

<!-- pagina:simulador-teste-interno.html -->
### simulador-teste-interno.html (2026-10-18 16:04 UTC)

**caixa 8, código inicial (linha 123)** — saída diferente: + linux /home/ana /home/ana/main.py ['main.py'] | - emscripten /home/ana /home/ana/main.py ['main.py'] | + main.py | + os.system: 0 (esperado: plataforma (sys.platform = emscripten no editor, linux no lab); rede (o editor não acessa a internet; o lab do testador roda sem rede); processos (subprocess/os.system/fork não existem no navegador); threads (o editor não cria threads); informações do sistema (sys/platform/os))

```python
import asyncio, os, sys, time

for i in range(3, 0, -1):
    print(i)
    time.sleep(0.2)

async def dobro(n):
    await asyncio.sleep(0.1)
    return n * 2

print(asyncio.run(dobro(21)))
print(sys.platform, os.getcwd(), __file__, sys.argv)
print("executable:", repr(sys.executable), sys.getrecursionlimit())
print("os.system:", os.system("ls"))
try:
    import subprocess
    subprocess.run(["ls"])
except OSError as e:
    print("subprocess:", e)
try:
    import threading
    threading.Thread(target=print).start()
except RuntimeError as e:
    print("threading:", e)
try:
    import urllib.request
    urllib.request.urlopen("https://example.com", timeout=3)
except Exception as e:
    print("rede:", type(e).__name__, e)
try:
    urllib.request.urlopen("http://example.com", timeout=3)
except Exception as e:
    print("rede http:", type(e).__name__, e)
```

- editor (código de saída 0):

```
3
2
1
42
emscripten /home/ana /home/ana/main.py ['main.py']
executable: '/usr/bin/python3' 1000
os.system: -1
subprocess: [Errno 138] emscripten does not support processes.
threading: can't start new thread
rede: URLError <urlopen error [Errno 23] Host is unreachable>
rede http: URLError <urlopen error [Errno 23] Host is unreachable>
```
- lab, python3 (código de saída 0):

```
3
2
1
42
linux /home/ana /home/ana/main.py ['main.py']
executable: '/usr/bin/python3' 1000
main.py
os.system: 0
main.py

rede: URLError <urlopen error [Errno -3] Temporary failure in name resolution>
rede http: URLError <urlopen error [Errno -3] Temporary failure in name resolution>
```

**caixa 10, código inicial (linha 170)** — saída diferente: + Pensei num número (sorteado: 747 ) | - Pensei num número (sorteado: 557 ) (esperado: números sorteados sem seed)

```python
import random
sorteado = random.randint(1, 1000)
print("Pensei num número (sorteado:", sorteado, ")")
while True:
    try:
        n = int(input("Número: "))
    except ValueError:
        print("Isso não é um número.")
        continue
    except EOFError:
        print("tchau")
        break
    print("dobro:", n * 2)
```

- editor (código de saída 0):

```
Pensei num número (sorteado: 557 )
Número: tchau
```
- lab, python3 (código de saída 0):

```
Pensei num número (sorteado: 747 )
Número: tchau
```
<!-- /pagina:simulador-teste-interno.html -->

<!-- pagina:simulador.html -->
### simulador.html (2026-10-18 16:04 UTC)

**caixa 2, código inicial (linha 99)** — saída diferente: + ['diario.txt', 'main.py'] | - ['main.py', 'diario.txt']

```python
import os

if os.path.exists("diario.txt"):
    print("O diário já existia!")
else:
    print("Diário novo.")

with open("diario.txt", "a", encoding="utf-8") as arquivo:
    arquivo.write("Hoje estudei Python.\n")

print(os.listdir("."))
```

- editor (código de saída 0):

```
Diário novo.
['main.py', 'diario.txt']
```
- lab, python3 (código de saída 0):

```
Diário novo.
['diario.txt', 'main.py']
```
<!-- /pagina:simulador.html -->

<!-- pagina:testes.html -->
### testes.html (2026-10-18 16:04 UTC)

**caixa 5, solução (linha 927)** — saída diferente: + Ran 4 tests in 0.000s | - Ran 4 tests in 0.001s

```python
import unittest


def formatar_telefone(numeros):
    """'86999990001' vira '(86) 99999-0001'."""
    numeros = numeros.strip()
    if len(numeros) != 11 or not numeros.isdigit():
        raise ValueError(f"telefone inválido: {numeros!r}")
    return f"({numeros[:2]}) {numeros[2:7]}-{numeros[7:]}"


class TestTelefone(unittest.TestCase):

    def test_formata(self):
        self.assertEqual(formatar_telefone("86999990001"), "(86) 99999-0001")

    def test_com_espacos(self):
        self.assertEqual(formatar_telefone(" 86999990002 "), "(86) 99999-0002")

    def test_curto_demais(self):
        with self.assertRaises(ValueError):
            formatar_telefone("8699999")

    def test_com_letras(self):
        with self.assertRaises(ValueError):
            formatar_telefone("86abc990001")


unittest.main()
```

- editor (código de saída 0):

```
....
----------------------------------------------------------------------
Ran 4 tests in 0.001s

OK
```
- lab, python3 (código de saída 0):

```
....
----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```
<!-- /pagina:testes.html -->
