// Horizonte — moderno e enérgico: título em caixa alta enorme por cima da foto, blocos retos e contraste forte.
// Para academia, construção, mecânica, energia solar, turismo, imobiliária. Premium.
const layout = {
  id: 'horizonte',
  nome: 'Horizonte',
  descricao: 'Moderno e forte, título gigante sobre a foto',
  ordem: 3,
  premium: true,
  tema: 'claro',
  topo: 'fundo',
  topoSemFoto: 'dividido',
  faixa: true,
  setores: ['academia', 'construcao', 'mecanica', 'solar', 'turismo', 'imobiliaria', 'outro'],
  fontes: { titulo: 'Archivo', corpo: 'Inter Tight', pesoTitulo: 800, eixos: { 'Archivo': 'wdth,wght@62..125,500..800' } },
  css: `
.lay-horizonte{--raio:6px;--raio-img:6px;--raio-btn:6px;--raio-cta:6px;--ls:-.02em;--tt:uppercase;--h1:clamp(2.8rem,8vw,7.2rem);--fundo-veu:linear-gradient(90deg,rgba(0,0,0,.78) 0%,rgba(0,0,0,.5) 55%,rgba(0,0,0,.25) 100%);--h2:clamp(2.2rem,5.4vw,4.6rem)}
.lay-horizonte h1,.lay-horizonte h2{font-stretch:75%;line-height:.9}
.lay-horizonte h1 em,.lay-horizonte h2 em{font-style:normal;color:var(--p);background:none}
.lay-horizonte .topo--fundo h1 em{color:#fff;text-decoration:underline;text-decoration-color:var(--p);text-decoration-thickness:.08em;text-underline-offset:.1em}
.lay-horizonte .linha,.lay-horizonte .etiqueta{display:inline-block;background:var(--p);color:var(--on-p);padding:.35rem .7rem;font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;font-weight:700;border:0}
.lay-horizonte .topo--fundo .topo-wrap{max-width:var(--larg,1160px);margin-inline:auto;width:100%;padding-inline:20px}
.lay-horizonte .topo--fundo h1{max-width:12ch}
.lay-horizonte .btn{padding:1rem 1.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:.88rem}
.lay-horizonte .btn-p{background:var(--p);color:var(--on-p)}
.lay-horizonte .topo--fundo .btn-g{border:2px solid #fff;background:transparent}
.lay-horizonte .sec{padding-block:clamp(4.5rem,10vw,8rem)}
.lay-horizonte .card,.lay-horizonte .serv,.lay-horizonte .pac{background:var(--card);border:1px solid var(--linha);box-shadow:none}
.lay-horizonte .serv{padding:1.5rem;overflow:hidden}
.lay-horizonte .serv-foto{margin:-1.5rem -1.5rem 1rem;aspect-ratio:4/3;border-radius:0}
.lay-horizonte .serv h3{font-family:var(--ft);font-stretch:75%;text-transform:uppercase;font-size:1.7rem;line-height:1}
.lay-horizonte .serv-n{color:var(--p);font-weight:800}
.lay-horizonte .serv:hover{transform:translateY(-2px)}
.lay-horizonte .b-numeros{background:var(--tx);color:var(--bg)}
.lay-horizonte .num b{font-family:var(--ft);font-stretch:75%;font-size:clamp(3.4rem,8vw,6rem);color:var(--p)}
.lay-horizonte .faixa{background:var(--p);color:var(--on-p);font-family:var(--ft);font-stretch:75%;text-transform:uppercase;font-weight:800;font-size:1.6rem}
.lay-horizonte .ico,.lay-horizonte .passo-n{background:var(--p);color:var(--on-p);border-radius:6px}
.lay-horizonte .cta-box{background:var(--p);color:var(--on-p);text-align:left;justify-items:start}
.lay-horizonte .cta-box .btn-p{background:var(--tx);color:var(--bg)}
.lay-horizonte .rodape{--rod-bg:var(--tx);color:var(--bg)}
`,
};
export default layout;
