# Guia Python

Site: https://wallysondevs.github.io/guia-python/

Curso de Python 3.14 em português, do zero ao avançado, feito para quem **nunca programou**. Funciona como uma escola: uma aula para cada assunto, organizadas em **3 níveis + projetos + referência** (143 páginas). Vai de `print`, variáveis, `if` e `for` até listas, dicionários, funções, arquivos e classes.

Cada aula explica o código parte por parte (anatomia), mostra a saída real, o que acontece quando dá errado (com a mensagem verdadeira do Python), formas diferentes de fazer e exercícios no fim. Todas as saídas e mensagens de erro foram conferidas no **Python 3.14.4** do Ubuntu 26.04 (`python3 arquivo.py`).

Para praticar, as páginas trazem o editor **Experimente** (`.trypy`), que roda **Python de verdade** no seu navegador:

- Edite o código, clique em **Rodar** e veja o terminal com `python3 main.py`, a saída, o traceback em vermelho e o código de saída.
- O programa pode pedir uma entrada (`input()`) e você digita ali mesmo, no terminal da caixa.
- Nas **missões**, a caixa confere se o seu programa chegou ao resultado pedido.

O editor usa `assets/pysim.js` com o **CPython 3.14.2 compilado para WebAssembly** (Pyodide 314.0.7), da mesma série 3.14 usada nas aulas. Ele fica hospedado no próprio site (`assets/py/`), só é baixado no primeiro clique em **Rodar** (cerca de 6 MB) e roda num Web Worker: a página não trava, e o botão **Parar** (ou o limite de 10 segundos) encerra um laço infinito.

Site 100% estático (HTML + CSS + JS, sem build e sem dependências externas): funciona no GitHub Pages. Para usar o editor no seu computador, sirva a raiz do site com um servidor local em vez de abrir o arquivo direto.

## Estrutura

```
index.html                 página inicial
<tema>.html                uma aula por tema
assets/style.css           visual
assets/site.js             níveis/menu (lista NIVEIS), Anterior/Próximo, anatomia, exercícios
assets/pysim.js            o editor "Experimente" (caixas .trypy)
assets/py/                 o Python do editor (Pyodide) e o Web Worker; versões em assets/py/VERSAO.txt
tools/sim.js               roda um programa Python como o editor rodaria
tools/testar-missoes.js    testa as missões de cada página
tools/testar-navegador.js  abre as páginas num Chromium sem janela e confere o editor
tools/motor-node.mjs       o mesmo motor do editor rodando no Node
tools/lab-nativo.js        roda no Python do laboratório (usado pelo --nativo)
tools/instalar-pyodide.sh  baixa o Pyodide e monta a pasta assets/py/
tools/DIFERENCAS.md        diferenças entre o editor e o Python do laboratório
CONTRIBUINDO.md            como escrever uma aula
.nojekyll                  faz o GitHub Pages servir os arquivos como estão
```

## Testes

```bash
node tools/testar-missoes.js --todas         # todas as páginas
node tools/testar-missoes.js pagina.html     # só estas páginas (-q mostra só os problemas)
node tools/testar-missoes.js --nativo pagina.html   # compara também com o Python do laboratório
node tools/testar-navegador.js --todas       # abre as páginas num Chromium sem janela (precisa do puppeteer-core)
node tools/sim.js main.py                    # roda um programa como o editor
```

## Publicar no GitHub Pages

Envie a pasta para um repositório e ative **Settings → Pages → Deploy from a branch → main / (root)**.

## Adicionar uma aula

Leia `CONTRIBUINDO.md` e inclua a página na lista `NIVEIS` de `assets/site.js`.
