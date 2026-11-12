// Maison — editorial claro: serifa enorme sobre foto de ponta a ponta, linhas finas, muito respiro.
// Para estética, salão, arquitetura, imobiliária, advocacia, hotelaria. Premium (entrada do topo, fotos que se revelam).
const layout = {
  id: 'maison',
  nome: 'Maison',
  descricao: 'Editorial de revista: foto inteira no topo e serifa grande',
  ordem: 1,
  premium: true,
  tema: 'creme',
  topo: 'fundo',
  topoSemFoto: 'centro',
  faixa: false,
  setores: ['estetica', 'salao', 'imobiliaria', 'advocacia', 'arquitetura', 'outro'],
  fontes: { titulo: 'Fraunces', corpo: 'Hanken Grotesk', pesoTitulo: 400, tituloFallback: 'Georgia,serif', eixos: { 'Fraunces': 'ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;1,9..144,300;1,9..144,400' } },
  css: `
.lay-maison{--raio:0px;--raio-img:0px;--raio-btn:999px;--raio-cta:0px;--ls:-.025em;--h1:clamp(3rem,8.4vw,7.6rem);--h2:clamp(2.2rem,5vw,4.2rem)}
.lay-maison h1,.lay-maison h2{font-weight:300;line-height:.98}
.lay-maison h1 em,.lay-maison h2 em{font-style:italic;color:inherit;font-weight:300;background:none}
.lay-maison .linha,.lay-maison .etiqueta{font-family:var(--fc);font-size:.78rem;letter-spacing:.22em;text-transform:uppercase;font-weight:600;color:inherit;opacity:.8;background:none;padding:0;border:0}
.lay-maison .topo--fundo .topo-wrap{max-width:var(--larg,1160px);margin-inline:auto;width:100%;padding-inline:20px}
.lay-maison .topo--fundo h1{max-width:13ch}
.lay-maison .topo--fundo .sub{max-width:30em;font-size:1.1rem}
.lay-maison .btn{padding:1rem 1.7rem;font-weight:600;letter-spacing:.01em}
.lay-maison .btn-p{background:var(--p);color:var(--on-p)}
.lay-maison .topo--fundo .btn-p{background:#fff;color:#111}
.lay-maison .topo--fundo .btn-g{background:transparent;border:1px solid rgba(255,255,255,.55)}
.lay-maison .cab{border-top:1px solid var(--linha-forte);padding-top:1.4rem}
.lay-maison .sec{padding-block:clamp(5rem,12vw,9rem)}
.lay-maison .card,.lay-maison .serv,.lay-maison .dif,.lay-maison .depo,.lay-maison .pac{border:0;border-radius:0;box-shadow:none;background:none}
.lay-maison .serv{padding:0;gap:.5rem}
.lay-maison .serv:hover{transform:none;box-shadow:none}
.lay-maison .serv-foto{margin:0 0 1.1rem;border-radius:0;aspect-ratio:4/5}
.lay-maison .serv h3{font-family:var(--ft);font-weight:400;font-size:1.6rem}
.lay-maison .serv-n{font-size:.78rem;letter-spacing:.18em;color:var(--tx2)}
.lay-maison .serv-link{font-size:.9rem;text-decoration:underline;text-underline-offset:.3em;text-decoration-thickness:1px}
.lay-maison .grade-serv{gap:clamp(2rem,4vw,3.5rem) clamp(1.2rem,2.6vw,2.4rem)}
.lay-maison .b-numeros{background:var(--bg);color:var(--tx);border-block:1px solid var(--linha-forte)}
.lay-maison .num b{font-family:var(--ft);font-weight:300;font-size:clamp(3rem,7vw,5.4rem)}
.lay-maison .ico{background:none;color:var(--p);border:1px solid var(--linha-forte);border-radius:50%}
.lay-maison .passo-n{background:none;color:var(--tx);border:1px solid var(--tx);font-family:var(--ft)}
.lay-maison .depo{border-top:1px solid var(--linha-forte);padding:1.6rem 0 0}
.lay-maison .depo p{font-family:var(--ft);font-size:1.3rem;line-height:1.4}
.lay-maison .hist-media img{aspect-ratio:3/4}
.lay-maison .cta-box{background:var(--tx);color:var(--bg);text-align:left;justify-items:start}
.lay-maison .cta-box h2{max-width:16ch}
.lay-maison .cta-box .btn-p{background:var(--bg);color:var(--tx)}
@media (min-width:1000px){.lay-maison .grade-serv{grid-template-columns:repeat(4,1fr)}}
.lay-maison .rodape{--rod-bg:var(--bg);color:var(--tx2);border-top:1px solid var(--linha)}
`,
};
export default layout;
