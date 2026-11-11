# Visuais (layouts) dos sites

Cada arquivo `.js` desta pasta é um visual. O HTML é sempre o mesmo, montado por `../index.js`, e o visual só muda:

- as fontes
- o CSS
- o tipo de topo
- o tema padrão

Como o HTML não muda, dá para trocar de visual sem perder textos, fotos ou cores.

```js
module.exports = {
  id: 'aurora',                // único, minúsculo
  nome: 'Aurora',              // aparece no editor
  descricao: 'Claro, moderno, gradiente suave',
  ordem: 1,
  tema: 'claro',               // tema padrão: claro | creme | escuro | grafite | marca
  topo: 'dividido',            // com foto de capa: dividido | fundo | centro
  topoSemFoto: 'dividido',     // sem foto de capa: dividido | centro
  faixa: false,                // true = faixa animada com os serviços logo abaixo do topo
  setores: ['dentista'],       // só informativo
  fontes: {
    titulo: 'Montserrat',
    corpo: 'Inter',
    pesoTitulo: 800,
    tituloFallback: 'system-ui,sans-serif',
    eixos: { 'Anton': 'wght@400' } // opcional, para fontes que não têm 400..800
  },
  css: `...`,                  // CSS extra, aplicado depois do CSS base
};
```

## Variáveis disponíveis

| Grupo | Variáveis |
|---|---|
| Cores do negócio | `--p`, `--s` (primária e secundária); `--on-p`, `--on-s` (texto legível sobre elas); `--p-suave` |
| Tema | `--bg`, `--bg2` (fundo alternado), `--tx`, `--tx2` (texto suave), `--linha`, `--linha-forte`, `--card`, `--nav-bg` |
| Fontes | `--ft`, `--fc`, `--pt` (peso do título) |

Você pode sobrescrever estas variáveis com valores padrão do base: `--h1`, `--h2`, `--ls`, `--tt` (text-transform dos títulos), `--raio`, `--raio-img`, `--raio-btn`, `--raio-cta`, `--pad`, `--larg`, `--em-cor`, `--em-estilo`, `--etq-cor`, `--num-bg`, `--num-tx`, `--cta-bg`, `--cta-tx`, `--cta-btn`, `--cta-btn-tx`, `--rod-bg`, `--faixa-bg`, `--faixa-tx`, `--fundo-veu`, `--mono-bg`.

Para escrever regras só deste visual, use o prefixo `.lay-<id>`. O body também recebe a classe `tema-<nome>`.

## Classes principais (veja `index.js`)

- **Navegação:** `.nav`, `.marca`, `.nav-links`
- **Topo:** `.b-topo.topo--dividido|fundo|centro`, `.topo-wrap`, `.topo-txt`, `.linha`, `h1 em`, `.sub`, `.acoes`, `.btn-p`, `.btn-g`, `.provas`, `.topo-media`, `.topo-mono`, `.topo-fundo`, `.faixa`
- **Blocos:** `.b-numeros .num`, `.b-servicos .serv`, `.b-diferenciais .dif .ico`, `.b-passos .passos li .passo-n`, `.b-pacotes .pac`, `.b-galeria .galeria`, `.b-historia .hist-wrap`, `.b-depoimentos .depo`, `.b-faq details`, `.b-cta .cta-box`, `.b-contato .ci .mapa`, `.rodape`
- **Comuns:** `.sec`, `.sec-alt`, `.cab`, `.etiqueta`, `.intro`, `.card`

## Regras

1. O site precisa funcionar sem foto nenhuma (aí entram `.topo-mono` e `.mono-hist`) e com qualquer cor da marca: nunca fixe a cor de destaque.
2. Respeite o celular: os breakpoints do base são 900px e 600px.
3. Não use imagens externas. Texturas e formas devem ser feitas com CSS ou SVG inline em data URI.
