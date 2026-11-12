// Noite — escuro e sofisticado: foto de ponta a ponta, serifa fina, detalhes na cor da marca.
// Para barbearia, restaurante, bar, tatuagem, eventos, hotel. Premium.
const layout = {
  id: 'noite',
  nome: 'Noite',
  descricao: 'Escuro e sofisticado, foto inteira e serifa elegante',
  ordem: 2,
  premium: true,
  tema: 'escuro',
  topo: 'fundo',
  topoSemFoto: 'centro',
  faixa: false,
  setores: ['barbearia', 'restaurante', 'bar', 'tatuagem', 'eventos', 'outro'],
  fontes: { titulo: 'Cormorant Garamond', corpo: 'Manrope', pesoTitulo: 500, tituloFallback: 'Georgia,serif', eixos: { 'Cormorant Garamond': 'ital,wght@0,400;0,500;0,600;1,400;1,500' } },
  css: `
.lay-noite{--raio:2px;--raio-img:2px;--raio-btn:2px;--raio-cta:2px;--ls:-.01em;--h1:clamp(3.2rem,9vw,8rem);--h2:clamp(2.4rem,5.4vw,4.4rem)}
.lay-noite h1,.lay-noite h2{line-height:.95}
.lay-noite h1 em,.lay-noite h2 em{font-style:italic;color:var(--p);background:none}
.lay-noite .topo--fundo h1 em{color:#fff}
.lay-noite .linha,.lay-noite .etiqueta{font-size:.76rem;letter-spacing:.3em;text-transform:uppercase;color:var(--p);background:none;padding:0;font-weight:600;border:0}
.lay-noite .topo--fundo .linha{color:#fff;opacity:.85}
.lay-noite .topo--fundo .topo-wrap{max-width:var(--larg,1160px);margin-inline:auto;width:100%;padding-inline:20px;text-align:center;justify-items:center}
.lay-noite .topo--fundo .topo-txt{display:grid;justify-items:center}
.lay-noite .topo--fundo .acoes,.lay-noite .topo--fundo .provas{justify-content:center}
.lay-noite .topo--fundo .sub{margin-inline:auto}
.lay-noite .btn{padding:1rem 1.8rem;text-transform:uppercase;letter-spacing:.14em;font-size:.82rem;font-weight:700}
.lay-noite .btn-p{background:var(--p);color:var(--on-p)}
.lay-noite .btn-g{border:1px solid rgba(255,255,255,.35);background:transparent}
.lay-noite .btn-p:hover{box-shadow:0 10px 30px -10px var(--p)}
.lay-noite .cab{text-align:center;justify-items:center;margin-inline:auto}
.lay-noite .cab .intro{margin-inline:auto}
.lay-noite .sec{padding-block:clamp(5rem,12vw,9rem)}
.lay-noite .card,.lay-noite .serv,.lay-noite .dif,.lay-noite .pac{background:var(--card);border:1px solid var(--linha);box-shadow:none}
.lay-noite .serv{padding:1.6rem}
.lay-noite .serv-foto{margin:-1.6rem -1.6rem 1rem;aspect-ratio:1;border-radius:0}
.lay-noite .serv h3{font-family:var(--ft);font-size:1.8rem;font-weight:500}
.lay-noite .serv-n{color:var(--p);letter-spacing:.2em;font-size:.75rem}
.lay-noite .serv:hover{border-color:var(--p)}
.lay-noite .b-numeros{background:var(--bg2);color:var(--tx);border-block:1px solid var(--linha)}
.lay-noite .num b{font-family:var(--ft);font-weight:500;font-size:clamp(3rem,7vw,5rem);color:var(--p)}
.lay-noite .ico{background:none;color:var(--p);border:1px solid var(--p);border-radius:50%}
.lay-noite .passo-n{background:none;color:var(--p);border:1px solid var(--p);font-family:var(--ft)}
.lay-noite .depo{background:none;border:0;border-left:1px solid var(--p);padding:.4rem 0 .4rem 1.4rem;box-shadow:none}
.lay-noite .depo p{font-family:var(--ft);font-style:italic;font-size:1.35rem}
.lay-noite .cta-box{background:var(--bg2);border:1px solid var(--linha);color:var(--tx)}
.lay-noite .rodape{--rod-bg:var(--bg2);color:var(--tx2)}
`,
};
export default layout;
