---
name: e-nova-design
description: Regras de visual do E-Nova (painel "Mesa de edição") e do Criador de Sites (visuais, paletas, fundos). Use sempre que for mexer na aparência de qualquer tela do painel E-Nova, criar ou ajustar um visual (layout) ou paleta dos sites gerados, mudar cores, fontes, títulos, cartões ou o menu, ou quando o usuário pedir "melhorar o visual", "mais temas", "novo layout de site", "deixar mais bonito" — mesmo que ele não cite esta skill.
---

# Design do E-Nova

O E-Nova tem duas superfícies visuais, com regras diferentes:

1. **O painel** (as telas da equipe): identidade **"Mesa de edição"**, escolhida pelo usuário em 2026-11-12 (substituiu o antigo visual Brasa — não volte para carvão/dourado/Oswald). Refine, não reinvente.
2. **Os sites gerados pelo Criador de Sites**: cada cliente precisa parecer único; aqui vale ousar.

Sempre: tudo visível em português do Brasil, e toda tela precisa funcionar e ficar bonita em 375px de largura (o usuário confere no celular). O usuário não quer "cara de IA": nada de degradês decorativos, sombras cinzas em todo cartão, rótulos em caixa alta espaçada, palavra solta colorida no título.

## 1. Painel ("Mesa de edição")

- **Cores** (`src/app/globals.css`): escuro é o padrão — tampo azul-tinta `#121A2B`, menu `#0D1422`, superfícies `#182235`, texto cor de papel `#E9EDF3`, ação azul `#4C8DFF`. Claro "papel": fundo `#E9EDF3`, folhas brancas, texto tinta. O menu é tinta nos dois modos.
- **Cor por área** (é informação, não enfeite): Operação azul, Vendas verde, Conteúdo magenta, Gestão âmbar, Conta cinza. O menu marca `html[data-area]` (`useMarcarArea` em `nav-links.tsx`, `areaDoGrupo`) e o CSS expõe `--area` (para o conteúdo) e `--sb-area` (para o menu/logo). Usos: bolinha do grupo e indicador do item ativo no menu, barra ao lado do `h1` (`.marca-area`, já no `PageHeader`), linha do topo no celular, ponto do logo, `.borda-area`/`.num-area` quando um destaque pedir. Não espalhe a cor da área em mais lugares — ela vale porque é rara.
- **Fontes**: **Schibsted Grotesk** (`--font-display`) em `h1/h2/h3` e números (`.num`, algarismos proporcionais — os tabulares deixam "R$ 1.428,70" esburacado); **Onest** (`--font-sans`) no resto. Títulos sempre em letras normais; só o `h1` é grande.
- **Contraste conferido (WCAG AA)**: no claro as cores de área/sucesso são mais fundas (`#137a4c`, `#946000`…) e a borda dos campos é `#8592a8` (claro) / `#66748f` (escuro) para passar 3:1. Ao criar cor nova, calcule o contraste antes.
- As escalas `sky`/`emerald`/`amber` do Tailwind foram redefinidas no `@theme` para puxar o azul/verde/âmbar da Mesa — selos de status antigos ficam coerentes sozinhos. Prefira tokens (`--area-*`, `--success`, `--destructive`) em código novo.
- Mudança de visual vale para o app todo: ajuste tokens e componentes base (`globals.css`, `src/components/ui/*`, `page.tsx`, `logo.tsx`, `nav-links.tsx`) em vez de remendar tela por tela.
- O tema fica salvo em `enova-tema-mesa` (next-themes). Páginas públicas dos clientes ficam claras com a classe `.marca-enova` (não usar `usePathname` no ThemeProvider: quebra o Next 16).
- Cuidado ao editar `globals.css` com script: o bloco `@theme inline` liga as cores às classes do Tailwind; se ele sumir, o build quebra com "Cannot apply unknown utility class border-border".

## 2. Criador de Sites

Arquivos: `src/lib/sites/engine/` (JS puro). O HTML do site é sempre o mesmo; o que muda é:

| Peça | Onde | O que controla |
|---|---|---|
| Visual (layout) | `engine/layouts/<id>.js` | fontes, CSS extra, tipo de topo, fundo padrão |
| Fundo (tema) | `TEMAS` em `engine/render.js` + `FUNDOS_PALETAS` em `engine/paletas.js` | bg, bg2, textos, linhas, cartão |
| Paleta pronta | `PALETAS` em `engine/paletas.js` | 2 cores + fundo + fontes de uma vez (`doc.paleta`) |
| Cores do negócio | `doc.cores` | `--p`, `--s` e derivados |

O contrato completo do layout está em `engine/layouts/LEIA-ME.md` — leia antes de criar um visual.

### Criar um visual novo

1. Planeje antes de escrever CSS (skill frontend-design): para qual tipo de negócio, que sensação, que **uma** coisa memorável ele tem. Confira as fontes dos visuais existentes (`grep -h "fontes:" engine/layouts/*.js`) e não repita par de fontes nem a ideia central de outro visual.
2. Copie a estrutura de um visual curto (ex.: `vitrine.js`), registre em `render.js` (import + lista `LAYOUTS`) e dê `ordem`.
3. Regras que não podem quebrar (os sites vão para clientes reais):
   - Funciona **sem foto nenhuma** (`.topo-mono`, `.mono-hist`) e com **qualquer cor** de marca — nunca fixe a cor de destaque.
   - Breakpoints 900px e 600px; nada pode passar da largura no celular (o `main` já tem `overflow-x:clip`, mas não conte com isso para conteúdo).
   - Sem imagens externas: texturas em CSS ou SVG em data URI.
   - Regras só do visual com prefixo `.lay-<id>`; para fundos escuros use `.tema-escuro.lay-<id>` (e os fundos escuros das paletas: `tema-tech`, `tema-galaxia`, `tema-oceano`).
4. Sugira o visual nos setores que combinam (`engine/setores.js`, lista de visuais logo abaixo do `S('<setor>'`) e no `SETOR_POR_LAYOUT` de `src/lib/sites/amostra.ts`.

### Criar uma paleta nova

Adicione em `engine/paletas.js`: duas cores com contraste bom sobre o fundo, um fundo em `FUNDOS_PALETAS` (marque `escuro: true` se for escuro) e um par de fontes do Google Fonts escolhido para o clima (fontes sem peso 400–800 precisam de `eixos`). As paletas da skill theme-factory foram adaptadas assim; ela também cria paletas novas a partir de uma descrição.

## 3. Conferir o resultado

1. Veja cada visual/paleta novo: `http://localhost:3100/api/vendas/amostra/<visual>?paleta=<id>` (logado) e a tela **Visuais**.
2. Critique com print antes de dar por pronto: cada visual deve ser reconhecível de longe; tire um enfeite se estiver carregado.
3. Rode os testes de tela (skill webapp-testing), com o site ligado na porta 3100:

```bash
uv run --no-project --python 3.11 --with playwright==1.55.0 python tests/web/teste_enova.py
```

Eles conferem as telas principais em 1366px e 375px (abre, tem título, sem rolagem lateral, sem erro de JavaScript), todos os visuais e paletas, e a seção de paletas do editor. Ao criar visual ou paleta, acrescente o id nas listas `VISUAIS`/`PALETAS` do teste. No Windows, se o `uv` reclamar do Python, use `UV_PYTHON_INSTALL_DIR=$HOME/.cache/uv/python`.

4. Depois de mexer em `src/lib` com o servidor ligado, reinicie o preview: o worker não recarrega sozinho e a página pode ficar com a versão antiga (erro de "Hydration").
