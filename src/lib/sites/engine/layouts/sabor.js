// Sabor — quente e apetitoso para comida: serifa macia, serviços como cardápio, selos carimbados e CTA em cor forte
const XADREZ = 'repeating-linear-gradient(0deg,color-mix(in srgb,var(--p) 55%,transparent) 0 22px,transparent 22px 44px),repeating-linear-gradient(90deg,color-mix(in srgb,var(--p) 55%,transparent) 0 22px,transparent 22px 44px)';
const ESTRELA = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 1l2.6 4.7L20 4l-1.7 5.4L23 12l-4.7 2.6L20 20l-5.4-1.7L12 23l-2.6-4.7L4 20l1.7-5.4L1 12l4.7-2.6L4 4l5.4 1.7z'/%3E%3C/svg%3E")`;
const layout = {
  id: 'sabor',
  nome: 'Sabor',
  descricao: 'Quente e editorial, serviços em formato de cardápio',
  ordem: 6,
  tema: 'creme',
  topo: 'dividido',
  topoSemFoto: 'dividido',
  faixa: true,
  setores: ['restaurante', 'pizzaria', 'hamburgueria', 'padaria', 'cafeteria', 'acai', 'loja'],
  fontes: {
    titulo: 'Fraunces',
    corpo: 'Inter',
    pesoTitulo: 700,
    tituloFallback: 'Georgia,serif',
    eixos: { Fraunces: 'ital,opsz,wght@0,9..144,400..900;1,9..144,400..900' },
  },
  css: `
.lay-sabor{--h1:clamp(2.7rem,6.6vw,5.3rem);--h2:clamp(2rem,4.4vw,3.3rem);--ls:-.02em;--raio:14px;--raio-img:22px;--raio-btn:12px;--raio-cta:22px;
  --em-estilo:italic;--tinta:color-mix(in srgb,var(--p) 9%,var(--bg));--p-tx:color-mix(in srgb,var(--p) 82%,var(--tx));--escuro:color-mix(in srgb,var(--p) 18%,#1b130e);
  --rod-bg:var(--escuro);--faixa-bg:var(--escuro);--faixa-tx:#fff5e8;--mono-bg:var(--escuro);--em-cor:var(--p-tx);--etq-cor:var(--p-tx)}
.lay-sabor h1,.lay-sabor h2{font-variation-settings:"opsz" 144;word-spacing:.06em}
.lay-sabor h1{line-height:.98;letter-spacing:-.03em;word-spacing:.06em}
.lay-sabor h1 em,.lay-sabor h2 em{font-weight:500}
.lay-sabor h3{font-family:var(--ft);font-weight:650;font-size:1.3rem;letter-spacing:-.01em}
.lay-sabor .etiqueta,.lay-sabor .linha{font-family:var(--ft);font-style:italic;font-weight:500;text-transform:none;letter-spacing:0;font-size:1.15rem;display:inline-flex;align-items:center;gap:.6rem}
.lay-sabor .etiqueta::before,.lay-sabor .linha::before{content:"";width:22px;height:22px;flex:none;background:currentColor;-webkit-mask:${ESTRELA} center/contain no-repeat;mask:${ESTRELA} center/contain no-repeat}
/* botões */
.lay-sabor .btn{font-weight:700;padding:1.05rem 1.6rem}
.lay-sabor .btn-p{box-shadow:0 5px 0 0 color-mix(in srgb,var(--p) 60%,#000);transition:transform .15s,box-shadow .15s}
.lay-sabor .btn-p:hover{transform:translateY(2px);box-shadow:0 3px 0 0 color-mix(in srgb,var(--p) 60%,#000)}
.lay-sabor .btn-g{border:2px solid var(--tx);font-weight:700}
.lay-sabor .btn-g:hover{background:var(--tx);color:var(--bg)}
.lay-sabor .marca{font-size:1.45rem;letter-spacing:-.02em}
.lay-sabor .nav-links a{font-weight:500}
/* topo */
.lay-sabor .b-topo{background:radial-gradient(circle at 1px 1px,color-mix(in srgb,var(--tx) 10%,transparent) 1px,transparent 1.5px) 0 0/18px 18px,var(--bg)}
.lay-sabor .topo-wrap{grid-template-columns:1fr 1fr;padding-block:clamp(3rem,7vw,5.5rem)}
.lay-sabor .topo-txt .sub{font-size:1.18rem}
.lay-sabor .topo-media{position:relative}
.lay-sabor .topo-media img{aspect-ratio:1/1;border-radius:50%;box-shadow:0 0 0 12px var(--bg),0 0 0 14px color-mix(in srgb,var(--p) 40%,transparent),0 40px 70px -30px rgba(40,20,0,.45)}
.lay-sabor .topo-media::after{content:"Feito com\\A carinho";white-space:pre;position:absolute;right:2%;top:4%;width:118px;height:118px;border-radius:50%;display:grid;place-items:center;text-align:center;background:var(--p);color:var(--on-p);font-family:var(--ft);font-style:italic;font-weight:600;font-size:1.05rem;line-height:1.1;transform:rotate(-12deg);box-shadow:0 0 0 5px var(--bg),0 0 0 6px var(--p),0 18px 30px -12px rgba(0,0,0,.35);outline:1.5px dashed color-mix(in srgb,var(--on-p) 55%,transparent);outline-offset:-10px;z-index:2}
.lay-sabor .topo-mono{aspect-ratio:1/1;border-radius:50%;overflow:visible;background:radial-gradient(circle,var(--bg) 0 34%,transparent 34.5%),${XADREZ},color-mix(in srgb,var(--p) 12%,var(--bg));box-shadow:0 0 0 12px var(--bg),0 0 0 14px color-mix(in srgb,var(--p) 40%,transparent),0 40px 70px -30px rgba(40,20,0,.45)}
.lay-sabor .topo-mono span{color:var(--p-tx);font-style:italic;font-size:clamp(3.5rem,8vw,6rem);letter-spacing:-.03em;position:relative}
.lay-sabor .provas li:first-child{background:var(--card);border:1px solid var(--linha);padding:.35rem .8rem;border-radius:999px;color:var(--tx);font-weight:600}
/* faixa */
.lay-sabor .faixa{font-style:italic;text-transform:none;font-size:1.35rem;font-weight:600;padding:1.1rem 0;border-block:3px double color-mix(in srgb,var(--p) 70%,transparent)}
.lay-sabor .faixa i{color:var(--p);opacity:1}
/* números */
.lay-sabor .b-numeros{background:var(--bg);color:var(--tx);padding-block:clamp(2.5rem,5vw,3.5rem) 0}
.lay-sabor .grade-num{gap:1rem}
.lay-sabor .num{border:2px dashed color-mix(in srgb,var(--p) 45%,transparent);border-radius:16px;padding:1.3rem .6rem;background:var(--tinta)}
.lay-sabor .num b{color:var(--p-tx);font-style:italic}
.lay-sabor .num span{color:var(--tx2);opacity:1;font-weight:500}
/* serviços = cardápio */
.lay-sabor .b-servicos .cab{margin-inline:auto;text-align:center}
.lay-sabor .grade-serv,.lay-sabor .grade-serv.n2,.lay-sabor .grade-serv.n4{grid-template-columns:repeat(2,1fr);gap:0 3.5rem;background:var(--card);border:1px solid var(--linha);border-radius:24px;padding:clamp(1.5rem,4vw,3rem) clamp(1.2rem,4vw,3.5rem);box-shadow:0 30px 60px -45px rgba(60,30,0,.4);position:relative}
.lay-sabor .grade-serv::before{content:"";position:absolute;inset:10px;border:1px solid var(--linha);border-radius:18px;pointer-events:none}
.lay-sabor .serv{background:none;border:0;border-radius:0;padding:1.3rem 0;display:grid;grid-template-columns:auto 1fr auto;grid-template-areas:"f t n" "f p p" "f l l";column-gap:1rem;row-gap:.25rem;align-items:baseline;border-bottom:1px dashed var(--linha-forte)}
.lay-sabor .serv:not(:has(.serv-foto)){grid-template-columns:1fr auto;grid-template-areas:"t n" "p p" "l l"}
.lay-sabor .serv:hover{transform:none;box-shadow:none}
.lay-sabor .serv:hover h3{color:var(--p-tx)}
.lay-sabor .serv-foto{grid-area:f;margin:0;width:78px;height:78px;aspect-ratio:auto;border-radius:50%;align-self:start;box-shadow:0 0 0 3px var(--card),0 0 0 4px var(--linha-forte)}
.lay-sabor .serv h3{grid-area:t;display:flex;align-items:baseline;gap:.6rem;font-size:1.25rem;transition:color .15s}
.lay-sabor .serv h3::after{content:"";flex:1;min-width:1.5rem;border-bottom:2px dotted color-mix(in srgb,var(--tx) 35%,transparent);transform:translateY(-.25em)}
.lay-sabor .serv-n{grid-area:n;font-style:italic;font-size:1.05rem;color:var(--p-tx)}
.lay-sabor .serv p{grid-area:p;font-size:.95rem;margin:0}
.lay-sabor .serv-link{grid-area:l;font-size:.82rem;margin-top:.3rem}
/* diferenciais */
.lay-sabor .b-diferenciais{background:var(--tinta)}
.lay-sabor .dif{background:var(--card);border-radius:16px;padding:1.4rem;border:1px solid var(--linha)}
.lay-sabor .ico{border-radius:50%;background:var(--p);color:var(--on-p);width:48px;height:48px;box-shadow:0 0 0 4px var(--card),0 0 0 5px color-mix(in srgb,var(--p) 50%,transparent)}
/* passos */
.lay-sabor .passos{gap:1.6rem}
.lay-sabor .passos li{background:var(--card);border:1px solid var(--linha);border-radius:18px;padding:1.8rem}
.lay-sabor .passo-n{background:none;color:var(--p-tx);border:2px dashed var(--p);font-style:italic;font-size:1.5rem;width:58px;height:58px}
/* pacotes */
.lay-sabor .pac-dest{border:2px solid var(--p);box-shadow:0 30px 50px -30px var(--p)}
.lay-sabor .selo-pac{border-radius:6px;transform:rotate(-3deg)}
/* galeria */
.lay-sabor .galeria figure{border-radius:16px;background:var(--card);padding:8px;border:1px solid var(--linha);box-shadow:0 18px 30px -24px rgba(60,30,0,.5)}
.lay-sabor .galeria img{border-radius:10px}
.lay-sabor .galeria figure:nth-child(odd){transform:rotate(-1deg)}
.lay-sabor .galeria figure:nth-child(even){transform:rotate(1deg)}
/* história */
.lay-sabor .b-historia{background:var(--bg)}
.lay-sabor .hist-media{position:relative}
.lay-sabor .hist-media img,.lay-sabor .mono-hist{border-radius:22px}
.lay-sabor .hist-media::after{content:"";position:absolute;right:-22px;top:-22px;width:96px;height:96px;background:var(--p);-webkit-mask:${ESTRELA} center/contain no-repeat;mask:${ESTRELA} center/contain no-repeat;transform:rotate(12deg)}
.lay-sabor .mono-hist{background:${XADREZ},color-mix(in srgb,var(--p) 12%,var(--bg));position:relative}
.lay-sabor .mono-hist span{color:var(--p-tx);font-style:italic;font-size:4.2rem;width:58%;aspect-ratio:1;border-radius:50%;background:var(--bg);display:grid;place-items:center;box-shadow:0 0 0 10px color-mix(in srgb,var(--bg) 70%,transparent),0 30px 50px -20px rgba(0,0,0,.35)}
/* depoimentos */
.lay-sabor .depo{background:var(--card);border-radius:4px 22px 22px 22px;position:relative}
.lay-sabor .depo::before{content:"\\201C";position:absolute;right:18px;top:-6px;font-family:var(--ft);font-size:5rem;font-weight:800;line-height:1;color:var(--p);opacity:.25}
.lay-sabor .depo blockquote{font-family:var(--ft);font-size:1.1rem;font-weight:400;line-height:1.45}
.lay-sabor .av{background:var(--p);color:var(--on-p)}
/* faq */
.lay-sabor .faq details{border-radius:14px}
.lay-sabor .faq details[open]{border-color:color-mix(in srgb,var(--p) 50%,transparent)}
.lay-sabor .faq summary{font-family:var(--ft);font-weight:600;font-size:1.08rem}
.lay-sabor .faq summary i{background:var(--p);color:var(--on-p)}
/* cta */
.lay-sabor .cta-box{--cta-bg:var(--p);--cta-tx:var(--on-p);position:relative;padding-block:clamp(3.5rem,7vw,5.5rem);
  -webkit-mask:radial-gradient(circle 11px at 50% 0,#0000 98%,#000) 50% 0/30px 51% repeat-x,radial-gradient(circle 11px at 50% 100%,#0000 98%,#000) 50% 100%/30px 51% repeat-x;
  mask:radial-gradient(circle 11px at 50% 0,#0000 98%,#000) 50% 0/30px 51% repeat-x,radial-gradient(circle 11px at 50% 100%,#0000 98%,#000) 50% 100%/30px 51% repeat-x;border-radius:0}
.lay-sabor .cta-box::before{content:"";position:absolute;inset:26px;border:2px dashed color-mix(in srgb,var(--on-p) 35%,transparent);border-radius:14px;pointer-events:none}
.lay-sabor .cta-box h2{font-size:clamp(2.2rem,5vw,3.8rem);max-width:15em}
.lay-sabor .cta-box h2 em{text-decoration:none;font-style:italic}
.lay-sabor .cta-box .btn-p{--cta-btn:var(--escuro);--cta-btn-tx:#fff5e8;box-shadow:0 5px 0 0 rgba(0,0,0,.35);font-size:1.08rem;padding:1.15rem 1.9rem;position:relative}
/* contato */
.lay-sabor .ci>svg{width:44px;height:44px;padding:11px;border-radius:50%;background:var(--tinta);color:var(--p-tx);margin-top:0}
.lay-sabor .ci a{color:var(--p-tx)}
.lay-sabor .mapa iframe{border-radius:22px;border:8px solid var(--card);box-shadow:0 0 0 1px var(--linha),0 30px 50px -35px rgba(60,30,0,.5)}
.lay-sabor .rodape{color:rgba(255,245,232,.65)}
.lay-sabor .rodape b{color:#fff5e8}
/* temas escuros */
.tema-escuro.lay-sabor,.tema-grafite.lay-sabor,.tema-marca.lay-sabor{--p-tx:color-mix(in srgb,var(--p) 70%,#fff);--escuro:#0a0806}
.tema-escuro.lay-sabor .topo-media img,.tema-grafite.lay-sabor .topo-media img,.tema-marca.lay-sabor .topo-media img{box-shadow:0 0 0 12px var(--bg),0 0 0 14px color-mix(in srgb,var(--p) 50%,transparent)}
/* responsivo */
@media (max-width:900px){
  .lay-sabor .topo-wrap{grid-template-columns:1fr}
  .lay-sabor .topo-media{max-width:440px;width:100%;justify-self:center;margin-top:1rem}
  .lay-sabor .topo-media img,.lay-sabor .topo-mono{aspect-ratio:1/1}
  .lay-sabor .grade-serv,.lay-sabor .grade-serv.n2,.lay-sabor .grade-serv.n4{grid-template-columns:1fr}
  .lay-sabor .hist-media{max-width:480px}
}
@media (max-width:600px){
  .lay-sabor .topo-media{max-width:300px}
  .lay-sabor .topo-media::after{width:92px;height:92px;font-size:.88rem;right:0;top:-2%}
  .lay-sabor .grade-serv::before{inset:6px}
  .lay-sabor .serv-foto{width:58px;height:58px}
  .lay-sabor .serv h3{font-size:1.1rem}
  .lay-sabor .num{padding:1rem .4rem}
  .lay-sabor .cta-box::before{inset:18px}
  .lay-sabor .cta-box{padding-inline:2.2rem}
  .lay-sabor .hist-media::after{width:64px;height:64px;right:-8px;top:-14px}
  .lay-sabor .galeria figure{padding:5px}
}
`,
};
export default layout;
