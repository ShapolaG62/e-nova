// Brasa — escuro e marcante, títulos condensados em caixa alta, faixa animada (inspirado em Barber 2 / Academia)
const layout = {
  id: 'brasa',
  nome: 'Brasa',
  descricao: 'Escuro e marcante, títulos fortes e faixa animada',
  ordem: 2,
  tema: 'escuro',
  topo: 'fundo',
  topoSemFoto: 'dividido',
  faixa: true,
  setores: ['barbearia', 'academia', 'hamburgueria', 'pizzaria', 'lavajato', 'fotografia'],
  fontes: { titulo: 'Oswald', corpo: 'Inter', pesoTitulo: 700, eixos: { Oswald: 'wght@500;600;700' } },
  css: `
.lay-brasa{--tt:uppercase;--ls:0;--h1:clamp(2.8rem,7.5vw,5.6rem);--h2:clamp(2.1rem,5vw,3.6rem);--raio:6px;--raio-img:6px;--raio-btn:6px;--raio-cta:8px;--faixa-bg:var(--p);--mono-bg:#050505}
.lay-brasa h1{line-height:.98}
.lay-brasa .btn{text-transform:uppercase;letter-spacing:.06em;font-size:.88rem;padding:1.05rem 1.6rem}
.lay-brasa .linha{display:inline-flex;align-items:center;gap:.6rem}
.lay-brasa .linha::before{content:"";width:9px;height:9px;border-radius:50%;background:var(--p);box-shadow:0 0 0 4px var(--p-suave)}
.lay-brasa .topo--fundo .topo-fundo::after{background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.2) 40%,var(--bg) 100%),linear-gradient(90deg,rgba(0,0,0,.85),rgba(0,0,0,.2))}
.lay-brasa .topo-media img{filter:contrast(1.05) saturate(.9)}
.lay-brasa .topo-mono{border-radius:6px}
.lay-brasa .faixa{transform:rotate(-1.4deg) scale(1.02);margin:-.6rem 0 1rem;position:relative;z-index:3;box-shadow:0 12px 30px -12px rgba(0,0,0,.6)}
.lay-brasa .b-numeros{background:var(--bg);color:var(--tx);border-block:1px solid var(--linha)}
.lay-brasa .num b{color:var(--p)}
.lay-brasa .num span{color:var(--tx2);opacity:1;text-transform:uppercase;letter-spacing:.1em;font-size:.78rem}
.lay-brasa .serv{background:var(--bg2);border:1px solid var(--linha);border-top:3px solid var(--p)}
.lay-brasa .serv-n{font-size:2.6rem;line-height:1;opacity:.9}
.lay-brasa .serv h3{text-transform:uppercase;font-family:var(--ft);font-size:1.35rem;letter-spacing:.01em}
.lay-brasa .serv:hover{box-shadow:0 0 0 1px var(--p),0 24px 40px -24px var(--p)}
.lay-brasa .ico{border-radius:4px;background:var(--p);color:var(--on-p)}
.lay-brasa .dif h3,.lay-brasa .passos h3,.lay-brasa .pac h3{text-transform:uppercase;font-family:var(--ft)}
.lay-brasa .passo-n{border-radius:4px;width:58px;height:58px;font-size:1.6rem}
.lay-brasa .hist-media{position:relative}
.lay-brasa .hist-media::after{content:"";position:absolute;inset:18px -18px -18px 18px;border:2px solid var(--p);border-radius:6px;z-index:-1}
.lay-brasa .depo{background:var(--bg2)}
.lay-brasa .depo blockquote{font-size:1.05rem}
.lay-brasa .faq details{border-radius:4px}
.lay-brasa .faq summary{text-transform:uppercase;font-family:var(--ft);letter-spacing:.02em;font-size:1.05rem}
.lay-brasa .cta-box{background:var(--p);color:var(--on-p);text-align:left;justify-items:start;position:relative;overflow:hidden}
.lay-brasa .cta-box::after{content:"";position:absolute;right:-10%;top:-40%;width:55%;aspect-ratio:1;border:40px solid rgba(0,0,0,.12);border-radius:50%}
.lay-brasa .cta-box .btn-p{background:#0b0b0b;color:#fff}
.lay-brasa .rodape{--rod-bg:#050505;border-top:1px solid var(--linha)}
.tema-claro.lay-brasa .faixa,.tema-creme.lay-brasa .faixa{--faixa-bg:#111;--faixa-tx:#fff}
`,
};
export default layout;
