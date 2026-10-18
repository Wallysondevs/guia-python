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

(em construção: o que funciona, o que não funciona — threads, rede, `subprocess`, `os.system`, pip —, diferenças editor × lab, as ferramentas `tools/testar-missoes.js` e `tools/sim.js`.)

## 5. Fidelidade: o laboratório (`~/guia-python-lab/lab`, na VPS)
É a máquina da Ana (usuária `ana`, computador `notebook`, `/home/ana`, pt_BR, Ubuntu 26.04) com o **Python 3.14 de verdade**. Toda saída de terminal mostrada numa aula vem de lá (detalhes em `~/guia-python-lab/COMO-USAR.md`):
- programa em arquivo: crie o `.py` na home da Ana e rode `python3 arquivo.py`;
- modo interativo (`>>>`): `-t` (terminal de verdade) ou `python3 -i`;
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
