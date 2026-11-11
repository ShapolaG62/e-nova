// Chave — imobiliária e construção: moderno e robusto, foto grande de fundo, cartões estilo anúncio de imóvel (inspirado no template Imobiliária)
const CASA = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2.5 1.5 11h3v10.5h6v-6h3v6h6V11h3z'/%3E%3C/svg%3E")`;
// "fachada": malha de janelas (SVG em mosaico), para quando não há foto
const PREDIO = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='52'%3E%3Crect x='12' y='12' width='20' height='28' rx='1' fill='white' fill-opacity='.09'/%3E%3C/svg%3E")`;
// desenho de casas em traço branco, para os cartões de serviço sem foto
const CASAS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 80' fill='none' stroke='white' stroke-width='1.6' stroke-linejoin='round' stroke-linecap='round'%3E%3Cpath d='M12 70V40l28-24 28 24v30'/%3E%3Cpath d='M33 70V52h14v18'/%3E%3Cpath d='M68 70V26h38v44'/%3E%3Cpath d='M77 35h8v8h-8zM89 35h8v8h-8zM77 50h8v8h-8zM89 50h8v8h-8z'/%3E%3Cpath d='M4 70h112'/%3E%3C/svg%3E")`;

const layout = {
  id: 'chave',
  nome: 'Chave',
  descricao: 'Moderno e robusto, foto grande e cartões de anúncio',
  ordem: 9,
  tema: 'claro',
  topo: 'fundo',
  topoSemFoto: 'dividido',
  faixa: false,
  setores: ['imobiliaria', 'reformas'],
  fontes: { titulo: 'Archivo', corpo: 'Montserrat', pesoTitulo: 800 },
  css: `
.lay-chave{--tinta:#111317;--raio:10px;--raio-img:10px;--raio-btn:6px;--raio-cta:12px;--ls:-.035em;--h1:clamp(2.8rem,7vw,5.8rem);--h2:clamp(2.1rem,4.4vw,3.4rem);--mono-bg:#111317}
.lay-chave h1{line-height:.98}
.lay-chave h3{font-weight:800;letter-spacing:-.02em}
.lay-chave{font-size:16.5px}
.lay-chave .btn{font-weight:700;padding:1.05rem 1.7rem;letter-spacing:.01em}
.lay-chave .btn-p{box-shadow:0 14px 30px -16px var(--p)}
.lay-chave .marca{display:inline-flex;align-items:center;gap:.5rem;letter-spacing:-.03em;font-size:1.35rem}
.lay-chave .marca::before{content:"";flex:none;width:1.15em;height:1.15em;background:var(--p);-webkit-mask:${CASA} center/contain no-repeat;mask:${CASA} center/contain no-repeat}
.lay-chave .nav-links a{font-weight:600;font-size:.9rem}
.lay-chave .etiqueta{display:inline-flex;align-items:center;gap:.6rem;letter-spacing:.14em}
.lay-chave .etiqueta::before{content:"";width:22px;height:3px;background:var(--p)}
.lay-chave .linha{display:inline-block;background:var(--p);color:var(--on-p);padding:.45rem .85rem;border-radius:4px;letter-spacing:.12em;font-size:.72rem}
/* topo com foto de fundo */
.lay-chave .topo--fundo{min-height:min(90vh,820px);align-items:flex-end}
.lay-chave .topo--fundo .topo-wrap{max-width:880px;padding-bottom:clamp(3rem,7vw,5.5rem)}
.lay-chave .topo-fundo::after{background:linear-gradient(0deg,rgba(10,11,14,.92) 0%,rgba(10,11,14,.45) 50%,rgba(10,11,14,.55) 100%),linear-gradient(90deg,rgba(10,11,14,.55),transparent 70%)}
.lay-chave .topo--fundo .sub{font-size:1.2rem}
.lay-chave .topo--fundo h1 em{color:color-mix(in srgb,var(--p) 40%,#fff)}
.lay-chave .topo--fundo .btn-g{background:rgba(255,255,255,.08);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.lay-chave .provas{display:inline-flex;gap:0;padding:0;border-radius:8px;background:var(--card);border:1px solid var(--linha);box-shadow:0 20px 40px -30px rgba(0,0,0,.5);overflow:hidden;color:var(--tx);font-weight:600}
.lay-chave .provas li{padding:.95rem 1.3rem;border-left:1px solid var(--linha)}
.lay-chave .provas li:first-child{border-left:0}
.lay-chave .topo--fundo .provas{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);color:#fff;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.lay-chave .topo--fundo .provas li{border-color:rgba(255,255,255,.18)}
/* topo sem foto: planta baixa ao fundo */
.lay-chave .topo--dividido{background:linear-gradient(90deg,var(--linha) 1px,transparent 1px) 0 0/48px 48px,linear-gradient(0deg,var(--linha) 1px,transparent 1px) 0 0/48px 48px,var(--bg2)}
.lay-chave .topo--dividido::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,var(--bg2) 30%,transparent 75%);pointer-events:none}
.lay-chave .topo--dividido .topo-wrap{position:relative;z-index:1}
.lay-chave .topo-media{position:relative;isolation:isolate}
.lay-chave .topo--dividido .topo-media:not(.topo-mono)::before{content:"";position:absolute;inset:auto auto -18px -18px;width:55%;height:45%;background:var(--p);border-radius:var(--raio-img);z-index:-1}
.lay-chave .topo-mono,.lay-chave .mono-hist{position:relative;place-items:end start;padding:clamp(1.4rem,3vw,2.2rem);background:linear-gradient(0deg,rgba(0,0,0,.55),transparent 55%),${PREDIO},linear-gradient(160deg,color-mix(in srgb,var(--p) 70%,#111317),#111317 85%)}
.lay-chave .topo-mono::after,.lay-chave .mono-hist::after{content:"";position:absolute;top:clamp(1.4rem,3vw,2.2rem);right:clamp(1.4rem,3vw,2.2rem);width:54px;height:54px;background:var(--p);-webkit-mask:${CASA} center/contain no-repeat;mask:${CASA} center/contain no-repeat}
.lay-chave .topo-mono span,.lay-chave .mono-hist span{font-size:clamp(4.5rem,11vw,8rem);line-height:.85;color:#fff;letter-spacing:-.05em}
.lay-chave .mono-hist span{font-family:var(--ft);font-weight:var(--pt)}
/* números: faixa escura, alinhados à esquerda */
.lay-chave .b-numeros{background:var(--tinta);color:#fff;padding:clamp(2.6rem,5vw,3.8rem) 0}
.lay-chave .grade-num{text-align:left;gap:0}
.lay-chave .num{padding:0 1.6rem;border-left:1px solid rgba(255,255,255,.12)}
.lay-chave .num:first-child{border-left:0;padding-left:0}
.lay-chave .num::before{content:"";display:block;width:28px;height:4px;background:var(--p);margin-bottom:1rem}
.lay-chave .num b{font-size:clamp(2.4rem,5vw,3.6rem);letter-spacing:-.04em}
.lay-chave .num span{display:block;margin-top:.4rem;color:rgba(255,255,255,.66);opacity:1;text-transform:uppercase;letter-spacing:.1em;font-size:.72rem;font-weight:600}
/* serviços: cartões de anúncio */
.lay-chave .grade-serv{gap:1.4rem}
.lay-chave .serv{position:relative;overflow:hidden;padding:0 1.6rem 1.5rem;gap:.55rem;box-shadow:0 20px 40px -34px rgba(0,0,0,.5)}
.lay-chave .serv::before{content:"";display:block;margin:0 -1.6rem .9rem;aspect-ratio:16/8;background:${CASAS} center 62%/auto 58% no-repeat,radial-gradient(80% 90% at 80% 0%,rgba(255,255,255,.16),transparent 60%),linear-gradient(150deg,color-mix(in srgb,var(--p) 80%,#fff),color-mix(in srgb,var(--p) 60%,#111317))}
.lay-chave .serv:nth-child(3n+2)::before{background:${CASAS} center 62%/auto 58% no-repeat,radial-gradient(80% 90% at 80% 0%,rgba(255,255,255,.16),transparent 60%),linear-gradient(150deg,color-mix(in srgb,var(--s) 75%,#fff),color-mix(in srgb,var(--s) 55%,#111317))}
.lay-chave .serv:nth-child(3n)::before{background:${CASAS} center 62%/auto 58% no-repeat,radial-gradient(80% 90% at 80% 0%,rgba(255,255,255,.12),transparent 60%),linear-gradient(150deg,#59606c,#1b1e24)}
.lay-chave .serv:has(.serv-foto)::before{display:none}
.lay-chave .serv-foto{margin:0 -1.6rem .9rem;border-radius:0}
.lay-chave .serv-foto img{transition:transform .5s}
.lay-chave .serv:hover .serv-foto img{transform:scale(1.05)}
.lay-chave .serv:hover{transform:translateY(-6px);box-shadow:0 30px 50px -30px rgba(0,0,0,.45)}
.lay-chave .serv-n{position:absolute;top:1rem;left:1rem;background:var(--card);color:var(--tx);font-size:.78rem;padding:.35rem .7rem;border-radius:4px;letter-spacing:.04em;box-shadow:0 6px 16px -8px rgba(0,0,0,.4)}
.lay-chave .serv-n::before{content:"Nº ";color:var(--p)}
.lay-chave .serv h3{font-size:1.32rem}
.lay-chave .serv-link{justify-content:space-between;width:100%;padding-top:1rem;margin-top:.3rem;border-top:1px solid var(--linha);color:var(--tx)}
.lay-chave .serv-link svg{width:30px;height:30px;padding:7px;border-radius:50%;background:var(--p);color:var(--on-p);transition:transform .2s}
.lay-chave .serv:hover .serv-link svg{transform:translateX(4px)}
/* diferenciais: título fixo à esquerda */
.lay-chave .dif-wrap{display:grid;grid-template-columns:.8fr 1.2fr;gap:clamp(2rem,5vw,4.5rem);align-items:start}
.lay-chave .dif-wrap .cab{position:sticky;top:110px}
.lay-chave .grade-dif{gap:1rem}
.lay-chave .dif{background:var(--card);border:1px solid var(--linha);border-radius:var(--raio);padding:1.5rem;flex-direction:column;gap:.9rem}
.lay-chave .ico{width:50px;height:50px;border-radius:8px;background:var(--p);color:var(--on-p)}
/* passos: números vazados */
.lay-chave .passos{gap:1.2rem}
.lay-chave .passos li{background:var(--bg2);border-radius:var(--raio);padding:1.8rem 1.8rem 2rem;overflow:hidden}
.lay-chave .passo-n{width:auto;height:auto;background:none;border-radius:0;display:block;font-size:5rem;line-height:.9;color:transparent;-webkit-text-stroke:2px var(--p);letter-spacing:-.04em;margin-bottom:.9rem}
/* galeria */
.lay-chave .galeria{gap:.6rem}
.lay-chave .galeria figure{border-radius:6px}
/* história */
.lay-chave .hist-media{position:relative;isolation:isolate}
.lay-chave .hist-media::before{content:"";position:absolute;inset:12% 14% -18px -18px;background:var(--p);border-radius:var(--raio-img);z-index:-1}
.lay-chave .hist-txt h2::after{content:"";display:block;width:56px;height:4px;background:var(--p);margin-top:1.1rem}
/* depoimentos */
.lay-chave .depo{background:var(--bg2);border:0;border-bottom:4px solid var(--p);border-radius:var(--raio) var(--raio) 4px 4px}
.lay-chave .depo .estrelas svg{width:18px;height:18px}
.lay-chave .depo blockquote{font-weight:500}
.lay-chave .depo figcaption{padding-top:1rem;border-top:1px solid var(--linha)}
.lay-chave .av{background:var(--tinta);color:#fff;border-radius:8px}
/* faq */
.lay-chave .faq details{border-radius:8px;transition:box-shadow .2s}
.lay-chave .faq details[open]{box-shadow:inset 4px 0 0 var(--p),0 20px 40px -34px rgba(0,0,0,.5)}
.lay-chave .faq summary i{border-radius:6px;background:var(--p);color:var(--on-p)}
/* cta: caixa escura com faixa diagonal */
.lay-chave .cta-box{--cta-bg:var(--tinta);--cta-tx:#fff;position:relative;overflow:hidden;isolation:isolate;text-align:left;justify-items:start;grid-template-columns:1fr auto;column-gap:3rem;align-items:center}
.lay-chave .cta-box::before{content:"";position:absolute;top:0;right:0;bottom:0;width:36%;background:var(--p);clip-path:polygon(28% 0,100% 0,100% 100%,0 100%);z-index:-1}
.lay-chave .cta-box::after{content:"";position:absolute;top:0;right:0;bottom:0;width:36%;background:${PREDIO};clip-path:polygon(28% 0,100% 0,100% 100%,0 100%);opacity:.5;z-index:-1}
.lay-chave .cta-box h2,.lay-chave .cta-box p{grid-column:1;max-width:30em}
.lay-chave .cta-box .btn-p{grid-column:2;grid-row:1/span 2;margin:0;background:#fff;color:#111317;box-shadow:0 18px 40px -16px rgba(0,0,0,.6)}
.lay-chave .cta-box h2 em{color:inherit}
/* contato */
.lay-chave .ci>svg{width:46px;height:46px;padding:12px;border-radius:8px;background:var(--p-suave);margin-top:0}
.lay-chave .mapa iframe{border-radius:var(--raio)}
.lay-chave .rodape{--rod-bg:var(--tinta);border-top:4px solid var(--p)}
/* temas escuros */
.tema-escuro.lay-chave .b-numeros,.tema-grafite.lay-chave .b-numeros,.tema-marca.lay-chave .b-numeros{background:var(--bg2);border-block:1px solid var(--linha)}
.tema-escuro.lay-chave .cta-box,.tema-grafite.lay-chave .cta-box,.tema-marca.lay-chave .cta-box{--cta-bg:var(--card)}
@media (max-width:900px){
  .lay-chave .dif-wrap{grid-template-columns:1fr}
  .lay-chave .dif-wrap .cab{position:static}
  .lay-chave .num:nth-child(3){border-left:0;padding-left:0}
  .lay-chave .grade-num{row-gap:2.2rem}
  .lay-chave .cta-box{grid-template-columns:1fr}
  .lay-chave .cta-box .btn-p{grid-column:1;grid-row:auto;margin-top:.8rem}
  .lay-chave .cta-box::before,.lay-chave .cta-box::after{width:100%;top:auto;height:34%;clip-path:polygon(0 45%,100% 0,100% 100%,0 100%)}
}
@media (max-width:600px){
  .lay-chave .grade-dif{grid-template-columns:1fr}
  .lay-chave .provas{display:flex;flex-direction:column;width:100%}
  .lay-chave .provas li{border-left:0;border-top:1px solid var(--linha);padding:.75rem 1rem}
  .lay-chave .topo--fundo .provas li{border-color:rgba(255,255,255,.18)}
  .lay-chave .provas li:first-child{border-top:0}
  .lay-chave .num{padding:0 1rem}
  .lay-chave .passo-n{font-size:4rem}
  .lay-chave .cta-box .btn-p{width:100%}
}
`,
};
export default layout;
