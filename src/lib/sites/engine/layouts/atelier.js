// Atelier — título grande alinhado à esquerda, coluna lateral fina e serviços em lista de linhas.
// Para arquitetura, estética, design e estúdios. Quase sem cartões: a estrutura vem de filetes e espaço.
const layout = {
  id: 'atelier',
  nome: 'Atelier',
  descricao: 'Autoral e espaçoso, títulos grandes e serviços em lista',
  ordem: 11,
  tema: 'claro',
  topo: 'dividido',
  topoSemFoto: 'dividido',
  faixa: false,
  setores: ['estetica', 'salao', 'arquitetura', 'fotografia', 'outro'],
  fontes: { titulo: 'Syne', corpo: 'Manrope', pesoTitulo: 700, eixos: { Syne: 'wght@500;600;700;800' } },
  css: `
.lay-atelier{--raio:2px;--raio-img:0px;--raio-btn:2px;--ls:-.04em;--h1:clamp(2.8rem,7vw,5.6rem);--h2:clamp(2rem,4.4vw,3.4rem);--larg:1240px}
.lay-atelier h1{line-height:.98}
.lay-atelier h1 em,.lay-atelier h2 em{color:inherit;font-style:normal;text-decoration:underline;text-decoration-color:var(--p);text-decoration-thickness:.09em;text-underline-offset:.12em}
.lay-atelier .linha,.lay-atelier .etiqueta{text-transform:none;letter-spacing:0;font-weight:600;font-size:.95rem;color:var(--tx2)}
.lay-atelier .topo-wrap{grid-template-columns:1.25fr .75fr;align-items:end}
.lay-atelier .topo-media img,.lay-atelier .topo-mono{aspect-ratio:3/4;object-fit:cover;clip-path:polygon(0 0,100% 0,100% 100%,18% 100%,0 82%)}
.lay-atelier .topo-mono{background:var(--p)}
.lay-atelier .sec{border-top:1px solid var(--linha)}
.lay-atelier .cab{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:2rem;max-width:none;align-items:end}
.lay-atelier .cab .etiqueta{grid-column:1;grid-row:1;align-self:start}
.lay-atelier .cab h2{grid-column:1/-1}
.lay-atelier .cab .intro{grid-column:2;margin-top:0}
.lay-atelier .grade-serv{display:block}
.lay-atelier .serv{display:grid;grid-template-columns:4rem minmax(0,1fr) minmax(0,1.3fr) auto;gap:1.5rem;align-items:baseline;border:0;border-bottom:1px solid var(--linha);border-radius:0;padding:1.6rem 0;background:none;box-shadow:none}
.lay-atelier .serv h3{font-size:1.45rem}
.lay-atelier .serv-n{color:var(--tx2);font-weight:500}
.lay-atelier .serv:hover h3{color:var(--p)}
.lay-atelier .b-numeros{background:var(--bg);color:var(--tx);border-top:1px solid var(--linha)}
.lay-atelier .num b{font-size:clamp(3rem,7vw,5rem);font-weight:600}
.lay-atelier .num span{color:var(--tx2);opacity:1}
.lay-atelier .dif,.lay-atelier .depo,.lay-atelier .pac{border:0;border-top:2px solid var(--tx);border-radius:0;background:none;box-shadow:none;padding-inline:0}
.lay-atelier .ico{background:none;color:var(--p);border:1px solid var(--linha-forte);border-radius:50%}
.lay-atelier .passo-n{background:none;color:var(--tx);border:1px solid var(--tx)}
.lay-atelier .hist-media img,.lay-atelier .mono-hist{clip-path:polygon(0 0,82% 0,100% 18%,100% 100%,0 100%)}
.lay-atelier .cta-box{background:var(--tx);color:var(--bg);text-align:left}
.lay-atelier .cta-box .btn-p{background:var(--p);color:var(--on-p)}
.lay-atelier .rodape{--rod-bg:var(--bg);color:var(--tx2);border-top:1px solid var(--linha)}
@media (max-width:900px){.lay-atelier .topo-wrap{grid-template-columns:1fr}.lay-atelier .cab{grid-template-columns:1fr}.lay-atelier .cab .intro{grid-column:1}.lay-atelier .serv{grid-template-columns:2.5rem minmax(0,1fr);gap:.4rem 1rem}.lay-atelier .serv p,.lay-atelier .serv .serv-link{grid-column:2}}
`,
};
export default layout;
