// Serena — elegante e delicado para beleza e bem-estar: serifa refinada, imagens em arco, linhas finas e tons pastel da marca
const layout = {
  id: 'serena',
  nome: 'Serena',
  descricao: 'Elegante e delicado, serifa refinada e imagens em arco',
  ordem: 4,
  tema: 'creme',
  topo: 'dividido',
  topoSemFoto: 'dividido',
  faixa: false,
  setores: ['salao', 'estetica', 'unhas', 'psicologia', 'pilates', 'cafeteria', 'fotografia'],
  fontes: {
    titulo: 'Cormorant Garamond',
    corpo: 'Jost',
    pesoTitulo: 500,
    tituloFallback: 'Georgia,serif',
    eixos: { 'Cormorant Garamond': 'ital,wght@0,400;0,500;0,600;1,400;1,500', Jost: 'wght@300;400;500;600' },
  },
  css: `
.lay-serena{--tinta:color-mix(in srgb,var(--p) 11%,var(--bg));--tinta2:color-mix(in srgb,var(--p) 22%,var(--bg));--p-escuro:color-mix(in srgb,var(--p) 78%,var(--tx));
  --h1:clamp(2.9rem,6.4vw,5.4rem);--h2:clamp(2.2rem,4.6vw,3.6rem);--ls:-.01em;--raio:4px;--raio-img:999px 999px 6px 6px;--raio-btn:999px;--raio-cta:0;
  --em-estilo:italic;--em-cor:var(--p-escuro);--etq-cor:var(--p-escuro);--pad:clamp(4rem,8.5vw,6.8rem);--rod-bg:color-mix(in srgb,var(--p) 14%,#1c1815);font-weight:300}
.lay-serena h1{line-height:1;font-weight:500}
.lay-serena h2{line-height:1.05}
.lay-serena h3{font-family:var(--ft);font-weight:600;font-size:1.55rem;letter-spacing:0}
.lay-serena h1 em,.lay-serena h2 em{font-weight:400}
.lay-serena .etiqueta,.lay-serena .linha{font-weight:500;letter-spacing:.32em;font-size:.72rem;display:inline-flex;align-items:center;gap:.9rem}
.lay-serena .etiqueta::before,.lay-serena .linha::before{content:"";width:42px;height:1px;background:currentColor;opacity:.7}
.lay-serena .cab .intro,.lay-serena .topo-txt .sub{font-weight:300}
/* botões delicados */
.lay-serena .btn{font-weight:500;font-size:.8rem;letter-spacing:.18em;text-transform:uppercase;padding:1.1rem 1.9rem}
.lay-serena .btn svg{width:18px;height:18px}
.lay-serena .btn-p{box-shadow:0 14px 30px -18px var(--p)}
.lay-serena .btn-g{border:1px solid var(--linha-forte)}
.lay-serena .nav{border-bottom:1px solid var(--linha)}
.lay-serena .marca{font-style:italic;font-weight:500;font-size:1.6rem;letter-spacing:0}
.lay-serena .nav-links a{font-size:.78rem;letter-spacing:.2em;text-transform:uppercase}
.lay-serena .nav .btn{padding:.75rem 1.2rem;font-size:.72rem}
/* topo */
.lay-serena .b-topo{background:linear-gradient(180deg,var(--bg) 0,var(--tinta) 100%)}
.lay-serena .b-topo::before{content:"";position:absolute;width:min(44vw,560px);aspect-ratio:1;right:-8vw;top:-14vw;border-radius:50%;border:1px solid color-mix(in srgb,var(--p) 30%,transparent)}
.lay-serena .topo-wrap{grid-template-columns:1.1fr .9fr;padding-block:clamp(3.5rem,9vw,7.5rem)}
.lay-serena .topo-txt .sub{font-size:1.15rem;margin:1.6rem 0 2.4rem}
.lay-serena .topo-media{position:relative;max-width:470px;justify-self:end;width:100%;z-index:1}
.lay-serena .topo-media::before{content:"";position:absolute;inset:-16px;border:1px solid color-mix(in srgb,var(--p) 55%,transparent);border-radius:999px 999px 10px 10px;z-index:-1}
.lay-serena .topo-media::after{content:"";position:absolute;left:-34px;bottom:12%;width:68px;height:68px;border-radius:50%;background:var(--tinta2);box-shadow:0 0 0 10px var(--bg)}
.lay-serena .topo-media img,.lay-serena .topo-mono{aspect-ratio:3/4}
.lay-serena .topo-mono{overflow:visible;background:radial-gradient(70% 60% at 30% 20%,color-mix(in srgb,var(--s) 35%,var(--bg)),transparent 70%),linear-gradient(170deg,var(--tinta) 0%,var(--tinta2) 55%,color-mix(in srgb,var(--p) 45%,var(--bg)) 100%)}
.lay-serena .topo-mono span{font-style:italic;font-weight:400;color:var(--p-escuro);font-size:clamp(5rem,11vw,8.5rem);letter-spacing:0}
.lay-serena .provas{gap:.6rem 1.8rem;font-size:.86rem;letter-spacing:.04em}
.lay-serena .provas li+li::before{content:"";width:5px;height:5px;border-radius:50%;background:var(--p);opacity:.6;margin-right:.3rem}
/* números */
.lay-serena .b-numeros{background:var(--bg);color:var(--tx);padding:0}
.lay-serena .grade-num{gap:0;border-block:1px solid var(--linha);padding:2.4rem 0}
.lay-serena .num+.num{border-left:1px solid var(--linha)}
.lay-serena .num b{font-style:italic;font-weight:500;color:var(--p-escuro);font-size:clamp(2.4rem,5vw,3.4rem)}
.lay-serena .num span{color:var(--tx2);opacity:1;font-size:.72rem;letter-spacing:.22em;text-transform:uppercase}
/* serviços */
.lay-serena .b-servicos .cab,.lay-serena .b-depoimentos .cab,.lay-serena .b-passos .cab,.lay-serena .b-galeria .cab{margin-inline:auto;text-align:center}
.lay-serena .b-servicos .cab .etiqueta::after,.lay-serena .b-depoimentos .cab .etiqueta::after,.lay-serena .b-passos .cab .etiqueta::after,.lay-serena .b-galeria .cab .etiqueta::after{content:"";width:42px;height:1px;background:currentColor;opacity:.7}
.lay-serena .grade-serv{gap:2.6rem 2rem}
.lay-serena .serv{background:transparent;border:0;padding:0;text-align:center;align-items:center;gap:.7rem}
.lay-serena .serv:hover{transform:none;box-shadow:none}
.lay-serena .serv-foto{margin:0 0 1rem;width:100%;aspect-ratio:4/5;border-radius:999px 999px 4px 4px}
.lay-serena .serv-foto img{transition:transform .8s}
.lay-serena .serv:hover .serv-foto img{transform:scale(1.04)}
.lay-serena .serv:not(:has(.serv-foto)){background:var(--tinta);padding:3.4rem 1.6rem 2.2rem;border-radius:160px 160px 6px 6px;border:1px solid color-mix(in srgb,var(--p) 18%,transparent)}
@media (min-width:901px){
  .lay-serena .grade-serv.n4:has(>.serv:nth-child(5)){grid-template-columns:repeat(3,1fr)}
  .lay-serena .grade-serv.n4:has(>.serv:nth-child(7)){grid-template-columns:repeat(4,1fr);gap:2.2rem 1.4rem}
}
.lay-serena .serv-n{font-style:italic;font-weight:400;font-size:1.25rem;color:var(--p-escuro);display:flex;align-items:center;gap:.7rem}
.lay-serena .serv-n::before,.lay-serena .serv-n::after{content:"";width:18px;height:1px;background:currentColor;opacity:.6}
.lay-serena .serv p{max-width:26em}
.lay-serena .serv-link{color:var(--tx);font-weight:500;font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;border-bottom:1px solid var(--p);padding-bottom:.25rem}
/* diferenciais */
.lay-serena .b-diferenciais{background:var(--tinta)}
.lay-serena .grade-dif{gap:0 3rem}
.lay-serena .dif{padding:1.6rem 0;border-top:1px solid color-mix(in srgb,var(--p) 25%,var(--linha))}
.lay-serena .ico{width:46px;height:46px;border-radius:50%;background:transparent;border:1px solid var(--p);color:var(--p-escuro)}
.lay-serena .ico svg{width:18px;height:18px}
/* passos */
.lay-serena .passos{gap:2.4rem;text-align:center}
.lay-serena .passos li{display:flex;flex-direction:column;align-items:center}
.lay-serena .passo-n{width:auto;height:auto;background:none;color:var(--p-escuro);font-style:italic;font-weight:400;font-size:3.6rem;line-height:1;margin-bottom:.6rem;border-radius:0}
.lay-serena .passos p{max-width:24em}
/* pacotes */
.lay-serena .pac{border-radius:200px 200px 6px 6px;padding:3.4rem 2rem 2rem;text-align:center}
.lay-serena .pac ul{text-align:left}
.lay-serena .pac-dest{border:1px solid var(--p);background:var(--tinta)}
.lay-serena .selo-pac{left:50%;transform:translateX(-50%);font-weight:500;letter-spacing:.18em}
/* galeria */
.lay-serena .galeria{gap:1.1rem}
.lay-serena .galeria figure{border-radius:4px}
.lay-serena .galeria figure:nth-child(3n+1){border-radius:999px 999px 4px 4px}
/* história */
.lay-serena .b-historia{background:var(--bg)}
.lay-serena .hist-media{position:relative;max-width:460px}
.lay-serena .hist-media::after{content:"";position:absolute;inset:auto -22px -22px auto;width:62%;height:62%;background:var(--tinta2);border-radius:6px;z-index:-1}
.lay-serena .hist-media{z-index:0}
.lay-serena .hist-media img,.lay-serena .mono-hist{border-radius:999px 999px 6px 6px;aspect-ratio:3/4}
.lay-serena .mono-hist{background:linear-gradient(200deg,var(--tinta) 0%,var(--tinta2) 60%,color-mix(in srgb,var(--s) 40%,var(--bg)) 100%)}
.lay-serena .mono-hist span{font-style:italic;font-weight:400;color:var(--p-escuro)}
.lay-serena .hist-txt p{font-weight:300}
/* depoimentos */
.lay-serena .grade-depo{gap:2rem}
.lay-serena .depo{background:transparent;border:0;border-top:1px solid var(--linha-forte);border-radius:0;padding:2rem .4rem 0;text-align:center;align-items:center}
.lay-serena .depo::before{content:"\\201C";font-family:var(--ft);font-style:italic;font-size:5rem;line-height:.5;color:var(--p);margin-top:.6rem;opacity:.75}
.lay-serena .depo blockquote{font-family:var(--ft);font-style:italic;font-size:1.32rem;line-height:1.45}
.lay-serena .depo figcaption{flex-direction:column;gap:.5rem;font-weight:500;font-size:.78rem;letter-spacing:.2em;text-transform:uppercase}
.lay-serena .av{background:var(--tinta2);color:var(--p-escuro);font-weight:500;letter-spacing:0}
.lay-serena .estrelas{color:var(--p)}
/* faq */
.lay-serena .faq{gap:0}
.lay-serena .faq details{background:transparent;border:0;border-bottom:1px solid var(--linha-forte);border-radius:0;padding:0}
.lay-serena .faq summary{font-family:var(--ft);font-weight:600;font-size:1.3rem;padding:1.4rem 0}
.lay-serena .faq summary i{background:transparent;border:1px solid var(--p);color:var(--p-escuro)}
.lay-serena .faq details p{font-weight:300}
/* cta */
.lay-serena .b-cta{padding:0;background:var(--tinta)}
.lay-serena .b-cta .wrap{width:100%}
.lay-serena .cta-box{--cta-bg:var(--tinta);--cta-tx:var(--tx);position:relative;overflow:hidden;padding-block:clamp(4.5rem,10vw,8rem)}
.lay-serena .cta-box::before,.lay-serena .cta-box::after{content:"";position:absolute;width:clamp(180px,26vw,340px);aspect-ratio:3/4;border:1px solid color-mix(in srgb,var(--p) 40%,transparent);border-radius:999px 999px 0 0;bottom:-2px}
.lay-serena .cta-box::before{left:4%}
.lay-serena .cta-box::after{right:4%}
.lay-serena .cta-box h2{max-width:16em;position:relative;z-index:1}
.lay-serena .cta-box h2 em{color:var(--p-escuro);text-decoration:none}
.lay-serena .cta-box p{color:var(--tx2);opacity:1;font-weight:300;position:relative;z-index:1}
.lay-serena .cta-box .btn-p{--cta-btn:var(--p);--cta-btn-tx:var(--on-p);position:relative;z-index:1}
/* contato */
.lay-serena .ci>svg{color:var(--p-escuro)}
.lay-serena .ci a{color:var(--p-escuro)}
.lay-serena .mapa iframe{border-radius:240px 240px 6px 6px;min-height:460px;filter:saturate(.6) sepia(.12)}
.lay-serena .rodape{color:rgba(255,255,255,.62);letter-spacing:.03em}
.lay-serena .rodape b{font-style:italic;font-size:1.25rem;font-weight:500}
/* temas escuros */
.tema-escuro.lay-serena,.tema-grafite.lay-serena,.tema-marca.lay-serena{--p-escuro:color-mix(in srgb,var(--p) 70%,#fff);--tinta:color-mix(in srgb,var(--p) 9%,var(--bg));--tinta2:color-mix(in srgb,var(--p) 20%,var(--bg))}
/* responsivo */
@media (max-width:900px){
  .lay-serena .topo-wrap{grid-template-columns:1fr}
  .lay-serena .topo-media{justify-self:center;max-width:420px;margin-top:1rem}
  .lay-serena .topo-media img,.lay-serena .topo-mono{aspect-ratio:3/4}
  .lay-serena .topo-media::after{left:-14px}
  .lay-serena .b-topo::before{width:70vw;right:-30vw;top:-20vw}
  .lay-serena .grade-num{padding:1.6rem 0;row-gap:1.6rem}
  .lay-serena .num:nth-child(3){border-left:0}
  .lay-serena .hist-media{max-width:420px;margin-inline:auto;width:100%}
  .lay-serena .mapa iframe{border-radius:6px;min-height:340px}
  .lay-serena .grade-dif{grid-template-columns:1fr}
}
@media (max-width:600px){
  .lay-serena .topo-media{max-width:300px}
  .lay-serena .topo-media::before{inset:-10px}
  .lay-serena .topo-media::after{width:46px;height:46px;left:-8px}
  .lay-serena .hist-media{max-width:320px}
  .lay-serena .hist-media::after{inset:auto -12px -12px auto}
  .lay-serena .cta-box::before,.lay-serena .cta-box::after{opacity:.5}
  .lay-serena .btn{letter-spacing:.12em}
  .lay-serena .num span{letter-spacing:.12em;font-size:.68rem;display:block;line-height:1.4;margin-top:.3rem}
  .lay-serena .serv:not(:has(.serv-foto)){border-radius:120px 120px 6px 6px;padding-top:3rem}
  .lay-serena .serv-foto{max-width:320px;margin-inline:auto}
  .lay-serena .etiqueta,.lay-serena .linha{letter-spacing:.24em}
}
`,
};
export default layout;
