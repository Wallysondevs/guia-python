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

<!-- pagina:geradores.html -->
### geradores.html (2026-10-18 15:02 UTC)

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

<!-- pagina:decoradores.html -->
### decoradores.html (2026-10-18 15:02 UTC)

**caixa 2, código inicial (linha 384)** — saída diferente: + somar_ate levou 0.0366 s | - somar_ate levou 0.0990 s | + somar_ate_rapido levou 0.0099 s | - somar_ate_rapido levou 0.0882 s (esperado: data, hora e tempo medido)

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
somar_ate levou 0.0990 s
499999500000
somar_ate_rapido levou 0.0882 s
499999500000
```
- lab, python3 (código de saída 0):

```
somar_ate levou 0.0366 s
499999500000
somar_ate_rapido levou 0.0099 s
499999500000
```
<!-- /pagina:decoradores.html -->

<!-- pagina:testes.html -->
### testes.html (2026-10-18 15:03 UTC)

**caixa 2, solução (linha 393)** — saída diferente: + Ran 3 tests in 0.000s | - Ran 3 tests in 0.001s

```python
import unittest


def parcelas(total, vezes):
    if vezes < 1:
        raise ValueError("o número de parcelas deve ser pelo menos 1")
    return total / vezes


class TestParcelas(unittest.TestCase):

    def test_duas_vezes(self):
        self.assertEqual(parcelas(100, 2), 50)

    def test_tres_vezes(self):
        self.assertEqual(parcelas(90, 3), 30.0)

    def test_zero_vezes(self):
        with self.assertRaises(ValueError):
            parcelas(90, 0)


unittest.main()
```

- editor (código de saída 0):

```
...
----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
```
- lab, python3 (código de saída 0):

```
...
----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

**caixa 3, código inicial (linha 572)** — saída diferente: + ********************************************************************** | - [31m**********************************************************************[0m | + 0 passed and 1 failed. | + ***Test Fail

```python
def etiqueta(nome, preco):
    """Monta o texto da etiqueta de preço.

    >>> etiqueta("café", 18.9)
    'Café - R$ 18.90'
    """
    return f"{nome.upper()} - R$ {preco:.2f}".replace(".", ",")


import doctest
doctest.testmod(verbose=True)
```

- editor (código de saída 0):

```
Trying:
    etiqueta("café", 18.9)
Expecting:
    'Café - R$ 18.90'
**********************************************************************
File "/home/ana/main.py", line 4, in __main__.etiqueta
Failed example:
    etiqueta("café", 18.9)
Expected:
    'Café - R$ 18.90'
Got:
    'CAFÉ - R$ 18,90'
1 item had no tests:
    __main__
[31m**********************************************************************[0m
1 item had failures:
   1 of   1 in __main__.etiqueta
1 test in 2 items.
[32m0 passed[0m and [31m1 failed[0m.
[1;31m***Test Failed*** 1 failure[0m.
```
- lab, python3 (código de saída 0):

```
Trying:
    etiqueta("café", 18.9)
Expecting:
    'Café - R$ 18.90'
**********************************************************************
File "/home/ana/main.py", line 4, in __main__.etiqueta
Failed example:
    etiqueta("café", 18.9)
Expected:
    'Café - R$ 18.90'
Got:
    'CAFÉ - R$ 18,90'
1 item had no tests:
    __main__
**********************************************************************
1 item had failures:
   1 of   1 in __main__.etiqueta
1 test in 2 items.
0 passed and 1 failed.
***Test Failed*** 1 failure.
```

**caixa 3, solução (linha 586)** — saída diferente: + 1 item passed all tests: | +    1 test in __main__.etiqueta | - [32m1 item passed all tests:[0m | -  [32m  1 test in __main__.etiqueta[0m

```python
def etiqueta(nome, preco):
    """Monta o texto da etiqueta de preço.

    >>> etiqueta("café", 18.9)
    'CAFÉ - R$ 18,90'
    """
    return f"{nome.upper()} - R$ {preco:.2f}".replace(".", ",")


import doctest
doctest.testmod(verbose=True)
```

- editor (código de saída 0):

```
Trying:
    etiqueta("café", 18.9)
Expecting:
    'CAFÉ - R$ 18,90'
ok
1 item had no tests:
    __main__
[32m1 item passed all tests:[0m
 [32m  1 test in __main__.etiqueta[0m
1 test in 2 items.
[32m1 passed[0m.
[1;32mTest passed.[0m
```
- lab, python3 (código de saída 0):

```
Trying:
    etiqueta("café", 18.9)
Expecting:
    'CAFÉ - R$ 18,90'
ok
1 item had no tests:
    __main__
1 item passed all tests:
   1 test in __main__.etiqueta
1 test in 2 items.
1 passed.
Test passed.
```

**caixa 4, código inicial (linha 772)** — saída diferente: + Ran 3 tests in 0.001s | - Ran 3 tests in 0.002s

```python
import unittest


def total_do_carrinho(itens):
    """Soma preço × quantidade de cada item do carrinho."""
    total = 0
    for preco, quantidade in itens:
        total = preco * quantidade
    return total


class TestCarrinho(unittest.TestCase):

    def test_vazio(self):
        self.assertEqual(total_do_carrinho([]), 0)

    def test_um_item(self):
        self.assertEqual(total_do_carrinho([(4.50, 2)]), 9.00)

    def test_tres_itens(self):
        self.assertEqual(total_do_carrinho([(4.50, 2), (10.00, 1), (2.00, 3)]), 25.00)


unittest.main()
```

- editor (código de saída 1):

```
F..
======================================================================
FAIL: test_tres_itens (__main__.TestCarrinho.test_tres_itens)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/home/ana/main.py", line 21, in test_tres_itens
    self.assertEqual(total_do_carrinho([(4.50, 2), (10.00, 1), (2.00, 3)]), 25.00)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 6.0 != 25.0

----------------------------------------------------------------------
Ran 3 tests in 0.002s

FAILED (failures=1)
```
- lab, python3 (código de saída 1):

```
F..
======================================================================
FAIL: test_tres_itens (__main__.TestCarrinho.test_tres_itens)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/home/ana/main.py", line 21, in test_tres_itens
    self.assertEqual(total_do_carrinho([(4.50, 2), (10.00, 1), (2.00, 3)]), 25.00)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 6.0 != 25.0

----------------------------------------------------------------------
Ran 3 tests in 0.001s

FAILED (failures=1)
```

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

<!-- pagina:metodos-especiais.html -->
### metodos-especiais.html (2026-10-18 15:15 UTC)

**caixa 1, código inicial (linha 139)** — saída diferente: + <__main__.Produto object at 0x7fb300790590> | - <__main__.Produto object at 0x1901198> (esperado: endereços de memória (id(), repr de objetos))

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
<__main__.Produto object at 0x1901198>
```
- lab, python3 (código de saída 0):

```
<__main__.Produto object at 0x7fb300790590>
```
<!-- /pagina:metodos-especiais.html -->

<!-- pagina:dataclasses.html -->
### dataclasses.html (2026-10-18 15:15 UTC)

**caixa 1, código inicial (linha 147)** — saída diferente: + <__main__.Aluno object at 0x7fc261d90590> | - <__main__.Aluno object at 0x1627ef8> (esperado: endereços de memória (id(), repr de objetos))

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
<__main__.Aluno object at 0x1627ef8>
```
- lab, python3 (código de saída 0):

```
<__main__.Aluno object at 0x7fc261d90590>
```

**caixa 2, código inicial (linha 311)** — saída diferente: +   File "/usr/lib/python3.14/dataclasses.py", line 1442, in dataclass | -   File "/lib/python314.zip/dataclasses.py", line 1442, in dataclass | +   File "/usr/lib/python3.14/dataclasses.py", line 143 (esperado: caminhos da biblioteca padrão no traceback)

```python
from dataclasses import dataclass


@dataclass
class Carrinho:
    dona: str
    itens: list = []


ana = Carrinho("Ana")
bia = Carrinho("Bia")
ana.itens.append("café")
print(ana)
print(bia)
```

- editor (código de saída 1):

```
Traceback (most recent call last):
  File "/home/ana/main.py", line 4, in <module>
    @dataclass
     ^^^^^^^^^
  File "/lib/python314.zip/dataclasses.py", line 1442, in dataclass
    return wrap(cls)
  File "/lib/python314.zip/dataclasses.py", line 1432, in wrap
    return _process_class(cls, init, repr, eq, order, unsafe_hash,
                          frozen, match_args, kw_only, slots,
                          weakref_slot)
  File "/lib/python314.zip/dataclasses.py", line 1066, in _process_class
    cls_fields.append(_get_field(cls, name, type, kw_only))
                      ~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/lib/python314.zip/dataclasses.py", line 917, in _get_field
    raise ValueError(f'mutable default {type(f.default)} for field '
                     f'{f.name} is not allowed: use default_factory')
ValueError: mutable default <class 'list'> for field itens is not allowed: use default_factory
```
- lab, python3 (código de saída 1):

```
Traceback (most recent call last):
  File "/home/ana/main.py", line 4, in <module>
    @dataclass
     ^^^^^^^^^
  File "/usr/lib/python3.14/dataclasses.py", line 1442, in dataclass
    return wrap(cls)
  File "/usr/lib/python3.14/dataclasses.py", line 1432, in wrap
    return _process_class(cls, init, repr, eq, order, unsafe_hash,
                          frozen, match_args, kw_only, slots,
                          weakref_slot)
  File "/usr/lib/python3.14/dataclasses.py", line 1066, in _process_class
    cls_fields.append(_get_field(cls, name, type, kw_only))
                      ~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/lib/python3.14/dataclasses.py", line 917, in _get_field
    raise ValueError(f'mutable default {type(f.default)} for field '
                     f'{f.name} is not allowed: use default_factory')
ValueError: mutable default <class 'list'> for field itens is not allowed: use default_factory
```
<!-- /pagina:dataclasses.html -->

<!-- pagina:arquivos.html -->
### arquivos.html (2026-10-18 15:16 UTC)

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

<!-- pagina:pathlib.html -->
### pathlib.html (2026-10-18 15:16 UTC)

**caixa 2, código inicial (linha 356)** — saída diferente: +   File "/usr/lib/python3.14/pathlib/__init__.py", line 810, in write_text | -   File "/lib/python314.zip/pathlib/__init__.py", line 809, in write_text | +   File "/usr/lib/python3.14/pathlib/__init_ (esperado: caminhos da biblioteca padrão no traceback)

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
  File "/lib/python314.zip/pathlib/__init__.py", line 809, in write_text
    with self.open(mode='w', encoding=encoding, errors=errors, newline=newline) as f:
         ~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/lib/python314.zip/pathlib/__init__.py", line 771, in open
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

**caixa 3, código inicial (linha 695)** — saída diferente: +   File "/usr/lib/python3.14/pathlib/__init__.py", line 1012, in mkdir | -   File "/lib/python314.zip/pathlib/__init__.py", line 1011, in mkdir | + FileNotFoundError: [Errno 2] No such file or direct (esperado: caminhos da biblioteca padrão no traceback)

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
  File "/lib/python314.zip/pathlib/__init__.py", line 1011, in mkdir
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

<!-- pagina:json.html -->
### json.html (2026-10-18 15:17 UTC)

**caixa 2, código inicial (linha 517)** — saída diferente: +   File "/usr/lib/python3.14/json/__init__.py", line 298, in load | -   File "/lib/python314.zip/json/__init__.py", line 298, in load | +   File "/usr/lib/python3.14/json/__init__.py", line 352, in l (esperado: caminhos da biblioteca padrão no traceback)

```python
import json

with open("produto.json", encoding="utf-8") as arquivo:
    produto = json.load(arquivo)

print(produto["nome"], "custa", produto["preco"])
```

- editor (código de saída 1):

```
Traceback (most recent call last):
  File "/home/ana/main.py", line 4, in <module>
    produto = json.load(arquivo)
  File "/lib/python314.zip/json/__init__.py", line 298, in load
    return loads(fp.read(),
        cls=cls, object_hook=object_hook,
        parse_float=parse_float, parse_int=parse_int,
        parse_constant=parse_constant, object_pairs_hook=object_pairs_hook, **kw)
  File "/lib/python314.zip/json/__init__.py", line 352, in loads
    return _default_decoder.decode(s)
           ~~~~~~~~~~~~~~~~~~~~~~~^^^
  File "/lib/python314.zip/json/decoder.py", line 345, in decode
    obj, end = self.raw_decode(s, idx=_w(s, 0).end())
               ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^
  File "/lib/python314.zip/json/decoder.py", line 361, in raw_decode
    obj, end = self.scan_once(s, idx)
               ~~~~~~~~~~~~~~^^^^^^^^
json.decoder.JSONDecodeError: Expecting property name enclosed in double quotes: line 2 column 5 (char 6)
```
- lab, python3 (código de saída 1):

```
Traceback (most recent call last):
  File "/home/ana/main.py", line 4, in <module>
    produto = json.load(arquivo)
  File "/usr/lib/python3.14/json/__init__.py", line 298, in load
    return loads(fp.read(),
        cls=cls, object_hook=object_hook,
        parse_float=parse_float, parse_int=parse_int,
        parse_constant=parse_constant, object_pairs_hook=object_pairs_hook, **kw)
  File "/usr/lib/python3.14/json/__init__.py", line 352, in loads
    return _default_decoder.decode(s)
           ~~~~~~~~~~~~~~~~~~~~~~~^^^
  File "/usr/lib/python3.14/json/decoder.py", line 345, in decode
    obj, end = self.raw_decode(s, idx=_w(s, 0).end())
               ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^
  File "/usr/lib/python3.14/json/decoder.py", line 361, in raw_decode
    obj, end = self.scan_once(s, idx)
               ~~~~~~~~~~~~~~^^^^^^^^
json.decoder.JSONDecodeError: Expecting property name enclosed in double quotes: line 2 column 5 (char 6)
```
<!-- /pagina:json.html -->

<!-- pagina:random.html -->
### random.html (2026-10-18 15:17 UTC)

**caixa 1, código inicial (linha 67)** — saída diferente: + Dado de 6 lados: 1 | - Dado de 6 lados: 5 (esperado: números sorteados sem seed)

```python
import random

print("Dado de 6 lados:", random.randint(1, 6))
```

- editor (código de saída 0):

```
Dado de 6 lados: 5
```
- lab, python3 (código de saída 0):

```
Dado de 6 lados: 1
```

**caixa 1, solução (linha 73)** — saída diferente: + Dado de 20 lados: 2 | - Dado de 20 lados: 13 (esperado: números sorteados sem seed)

```python
import random

print("Dado de 20 lados:", random.randint(1, 20))
```

- editor (código de saída 0):

```
Dado de 20 lados: 13
```
- lab, python3 (código de saída 0):

```
Dado de 20 lados: 2
```
<!-- /pagina:random.html -->
