// Vitrine — bordas grossas, sombras sólidas deslocadas e botões retos, como etiqueta de loja.
// Para lojas, eventos e negócios jovens. A cor da marca entra chapada, sem degradê.
const layout = {
  id: 'vitrine',
  nome: 'Vitrine',
  descricao: 'Ousado e gráfico, bordas grossas e sombras sólidas',
  ordem: 10,
  tema: 'claro',
  topo: 'dividido',
  topoSemFoto: 'dividido',
  faixa: true,
  setores: ['loja', 'restaurante', 'academia', 'escola', 'outro'],
  fontes: { titulo: 'Bricolage Grotesque', corpo: 'Figtree', pesoTitulo: 800, eixos: { 'Bricolage Grotesque': 'wght@500;700;800' } },
  css: `
.lay-vitrine{--raio:0px;--raio-img:0px;--raio-btn:0px;--raio-cta:0px;--ls:-.035em;--h1:clamp(2.6rem,6.4vw,5rem);--borda:3px solid var(--tx);--sombra:6px 6px 0 var(--tx)}
.lay-vitrine .btn{border:var(--borda);box-shadow:4px 4px 0 var(--tx);transition:transform .12s,box-shadow .12s}
.lay-vitrine .btn:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--tx)}
.lay-vitrine .btn:active{transform:translate(3px,3px);box-shadow:1px 1px 0 var(--tx)}
.lay-vitrine .btn-g{background:var(--bg);color:var(--tx)}
.lay-vitrine .nav{border-bottom:var(--borda)}
.lay-vitrine .b-topo{border-bottom:var(--borda)}
.lay-vitrine .topo-media img,.lay-vitrine .topo-mono{border:var(--borda);box-shadow:10px 10px 0 var(--p)}
.lay-vitrine .topo-mono{background:var(--s)}
.lay-vitrine h1 em{background:var(--p);color:var(--on-p);padding:0 .12em;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.lay-vitrine .linha{display:inline-block;border:2px solid currentColor;padding:.3rem .7rem;letter-spacing:.08em}
.lay-vitrine .faixa{border-bottom:var(--borda);font-size:1.5rem}
.lay-vitrine .serv,.lay-vitrine .dif,.lay-vitrine .depo,.lay-vitrine .pac,.lay-vitrine .card{border:var(--borda);box-shadow:var(--sombra);background:var(--card)}
.lay-vitrine .serv:nth-child(3n+2){background:var(--p);color:var(--on-p)}
.lay-vitrine .serv:nth-child(3n+2) p,.lay-vitrine .serv:nth-child(3n+2) .serv-n,.lay-vitrine .serv:nth-child(3n+2) .serv-link{color:inherit}
.lay-vitrine .serv-n{font-size:1.6rem}
.lay-vitrine .b-numeros{background:var(--s);color:var(--on-s);border-block:var(--borda)}
.lay-vitrine .num{border-left:3px solid currentColor;padding-left:1rem}
.lay-vitrine .ico,.lay-vitrine .passo-n{border-radius:0;border:var(--borda);background:var(--p);color:var(--on-p)}
.lay-vitrine .galeria img,.lay-vitrine .hist-media img,.lay-vitrine .mono-hist{border:var(--borda);box-shadow:var(--sombra)}
.lay-vitrine .faq details{border:var(--borda);padding:0 1rem;margin-bottom:.8rem;box-shadow:4px 4px 0 var(--tx)}
.lay-vitrine .cta-box{border:var(--borda);box-shadow:10px 10px 0 var(--tx)}
.lay-vitrine .mapa,.lay-vitrine .mapa iframe{border:var(--borda)}
.lay-vitrine .rodape{border-top:var(--borda)}
.tema-escuro.lay-vitrine,.tema-grafite.lay-vitrine,.tema-marca.lay-vitrine,.tema-tech.lay-vitrine,.tema-galaxia.lay-vitrine,.tema-oceano.lay-vitrine{--borda:3px solid var(--tx);--sombra:6px 6px 0 var(--p)}
@media (max-width:600px){.lay-vitrine{--sombra:4px 4px 0 var(--tx)}.lay-vitrine .topo-media img,.lay-vitrine .topo-mono{box-shadow:6px 6px 0 var(--p)}.lay-vitrine .cta-box{box-shadow:6px 6px 0 var(--tx)}}
@media (prefers-reduced-motion:reduce){.lay-vitrine .btn{transition:none}}
`,
};
export default layout;
