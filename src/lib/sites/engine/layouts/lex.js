// Lex — sóbrio e de prestígio: serifa clássica, faixas em tinta profunda, filetes finos na cor da marca e muito respiro (inspirado no template Advocacia 02)
const layout = {
  id: 'lex',
  nome: 'Lex',
  descricao: 'Sóbrio e de prestígio, serifa clássica e filetes finos',
  ordem: 8,
  tema: 'creme',
  topo: 'dividido',
  topoSemFoto: 'dividido',
  faixa: false,
  setores: ['advocacia', 'contabilidade', 'seguranca'],
  fontes: {
    titulo: 'Cormorant Garamond',
    corpo: 'Inter',
    pesoTitulo: 600,
    tituloFallback: 'Georgia,serif',
    eixos: { 'Cormorant Garamond': 'ital,wght@0,400;0,500;0,600;0,700;1,500;1,600' },
  },
  css: `
.lay-lex{--ink:color-mix(in srgb,var(--p) 45%,#07090d);--claro-p:color-mix(in srgb,var(--s) 70%,#fff);--metal:color-mix(in srgb,var(--s) 85%,#000);--raio:0px;--raio-img:0px;--raio-btn:0px;--raio-cta:0px;--ls:0;--h1:clamp(2.9rem,6.2vw,5.3rem);--h2:clamp(2.3rem,4.5vw,3.6rem);--em-estilo:italic;--pad:clamp(5rem,10vw,8.5rem);--mono-bg:var(--ink)}
.lay-lex h1,.lay-lex h2{line-height:1.02}
.lay-lex h3{font-size:1.55rem;font-weight:600;line-height:1.15}
.lay-lex .btn{text-transform:uppercase;letter-spacing:.14em;font-size:.78rem;font-weight:600;padding:1.15rem 1.9rem}
.lay-lex .btn-p{box-shadow:none}
.lay-lex .btn-p:hover{transform:none;filter:brightness(1.08)}
.lay-lex .etiqueta,.lay-lex .linha{display:inline-flex;align-items:center;gap:.9rem;font-weight:600;letter-spacing:.22em;font-size:.72rem}
.lay-lex .etiqueta::before,.lay-lex .linha::before{content:"";width:44px;height:1px;background:var(--metal)}
.lay-lex .linha::before{background:currentColor}
.lay-lex .cab .intro{font-size:1.05rem}
/* nav em tinta */
.lay-lex .nav{background:var(--ink);border-bottom:1px solid color-mix(in srgb,var(--claro-p) 22%,transparent);backdrop-filter:none}
.lay-lex .marca{color:#f4f1ea;font-size:1.5rem;letter-spacing:.01em}
.lay-lex .nav-links a{color:rgba(255,255,255,.66);text-transform:uppercase;letter-spacing:.14em;font-size:.74rem}
.lay-lex .nav-links a:hover{color:#fff}
.lay-lex .nav-tog{color:#fff}
.lay-lex .nav .btn-p,.lay-lex .b-topo .btn-p,.lay-lex .cta-box .btn-p{background:var(--claro-p);color:#0d1017}
/* topo */
.lay-lex .b-topo{background:radial-gradient(70% 90% at 85% 30%,color-mix(in srgb,var(--p) 22%,transparent),transparent 70%),var(--ink);color:#f4f1ea}
.lay-lex .b-topo::after{content:"";position:absolute;left:0;right:0;bottom:0;height:6px;background:var(--claro-p)}
.lay-lex .topo-wrap{padding:clamp(4rem,9vw,7.5rem) 0}
.lay-lex .topo-txt .linha{color:var(--claro-p)}
.lay-lex .topo-txt h1{border-left:1px solid var(--claro-p);padding-left:clamp(1.1rem,2.4vw,1.8rem)}
.lay-lex .topo-txt h1 em{color:var(--claro-p)}
.lay-lex .topo-txt .sub,.lay-lex .b-topo .provas{color:rgba(255,255,255,.72)}
.lay-lex .b-topo .btn-g{color:#fff;border-color:rgba(255,255,255,.35)}
.lay-lex .b-topo .btn-g:hover{border-color:var(--claro-p)}
.lay-lex .b-topo .provas{border-top:1px solid rgba(255,255,255,.14);padding-top:1.4rem;gap:.5rem 2rem}
.lay-lex .topo-media,.lay-lex .hist-media{position:relative;isolation:isolate}
.lay-lex .topo-media::before{content:"";position:absolute;inset:-16px 16px 16px -16px;border:1px solid var(--claro-p);opacity:.7;z-index:-1}
.lay-lex .topo-media img{filter:saturate(.85) contrast(1.04)}
.lay-lex .topo-mono,.lay-lex .mono-hist{position:relative;background:radial-gradient(circle at 50% 45%,color-mix(in srgb,var(--p) 32%,#1a2030),var(--ink) 72%);border:1px solid color-mix(in srgb,var(--claro-p) 35%,transparent)}
.lay-lex .topo-mono::before,.lay-lex .mono-hist::before{content:"";position:absolute;inset:16px;border:1px solid color-mix(in srgb,var(--claro-p) 28%,transparent)}
.lay-lex .topo-mono::after,.lay-lex .mono-hist::after{content:"";position:absolute;width:58%;aspect-ratio:1;left:21%;top:50%;transform:translateY(-50%);border-radius:50%;border:1px solid color-mix(in srgb,var(--claro-p) 45%,transparent);outline:1px solid color-mix(in srgb,var(--claro-p) 22%,transparent);outline-offset:10px}
.lay-lex .topo-mono span,.lay-lex .mono-hist span{font-style:italic;font-weight:500;color:var(--claro-p);position:relative;z-index:1}
/* números: faixa na cor da marca */
.lay-lex .b-numeros{--num-bg:var(--s);--num-tx:var(--on-s);padding:clamp(2.8rem,5.5vw,4rem) 0}
.lay-lex .grade-num{gap:0}
.lay-lex .num{padding:.4rem 1rem;border-left:1px solid color-mix(in srgb,currentColor 25%,transparent)}
.lay-lex .num:first-child{border-left:0}
.lay-lex .num b{font-size:clamp(2.6rem,5.5vw,3.8rem);font-weight:600}
.lay-lex .num span{display:block;line-height:1.45;margin-top:.5rem;text-transform:uppercase;letter-spacing:.14em;font-size:.72rem;opacity:.85}
/* cabeçalhos centrados com filete dos dois lados */
.lay-lex .b-servicos .cab,.lay-lex .b-passos .cab,.lay-lex .b-depoimentos .cab,.lay-lex .b-galeria .cab,.lay-lex .b-pacotes .cab{margin-inline:auto;text-align:center}
.lay-lex .b-servicos .etiqueta::after,.lay-lex .b-passos .etiqueta::after,.lay-lex .b-depoimentos .etiqueta::after,.lay-lex .b-galeria .etiqueta::after,.lay-lex .b-pacotes .etiqueta::after{content:"";width:44px;height:1px;background:var(--metal)}
/* serviços */
.lay-lex .grade-serv{gap:1.5rem}
.lay-lex .serv{text-align:center;align-items:center;padding:2.6rem 2rem 2.2rem;position:relative;border-color:var(--linha)}
.lay-lex .serv::before{content:"";position:absolute;left:0;right:0;top:-1px;height:2px;background:var(--metal);transform:scaleX(0);transition:transform .35s}
.lay-lex .serv:hover{transform:none;box-shadow:0 30px 60px -45px rgba(20,15,5,.5)}
.lay-lex .serv:hover::before{transform:scaleX(1)}
.lay-lex .serv-n{font-size:2.4rem;font-style:italic;font-weight:500;line-height:1;display:grid;justify-items:center;gap:.9rem}
.lay-lex .serv-n::after{content:"";width:28px;height:1px;background:var(--metal)}
.lay-lex .serv-foto{margin:-2.6rem -2rem 1rem;border-radius:0;align-self:stretch}
.lay-lex .serv-link{text-transform:uppercase;letter-spacing:.14em;font-size:.72rem;margin-top:.6rem;color:var(--tx)}
.lay-lex .serv-link svg{color:var(--metal)}
/* diferenciais em tinta */
.lay-lex .b-diferenciais{background:var(--ink);color:#f4f1ea}
.lay-lex .b-diferenciais .etiqueta,.lay-lex .b-diferenciais h2 em{color:var(--claro-p)}
.lay-lex .b-diferenciais .intro,.lay-lex .b-diferenciais .dif p{color:rgba(255,255,255,.68)}
.lay-lex .grade-dif{gap:0 4rem}
.lay-lex .dif{padding:1.8rem 0;border-top:1px solid rgba(255,255,255,.12);gap:1.4rem}
.lay-lex .ico{width:52px;height:52px;border-radius:0;background:transparent;border:1px solid var(--claro-p);color:var(--claro-p);transform:rotate(45deg)}
.lay-lex .ico svg{transform:rotate(-45deg)}
/* passos em algarismos romanos */
.lay-lex .passos{gap:2.5rem}
.lay-lex .passos li{counter-increment:p;border-top:1px solid var(--linha-forte);padding-top:1.8rem}
.lay-lex .passos li::before{content:"";position:absolute;top:-1px;left:0;width:56px;height:2px;background:var(--metal)}
.lay-lex .passo-n{font-size:0;width:auto;height:auto;background:none;border-radius:0;display:block;margin-bottom:.6rem}
.lay-lex .passo-n::before{content:counter(p,upper-roman);font-size:3.2rem;font-style:italic;font-weight:500;color:var(--metal);line-height:1}
/* galeria */
.lay-lex .galeria{gap:.6rem}
.lay-lex .galeria img{filter:saturate(.85)}
/* história */
.lay-lex .hist-media::before{content:"";position:absolute;inset:16px -16px -16px 16px;border:1px solid var(--metal);z-index:-1}
.lay-lex .hist-txt h2::after{content:"";display:block;width:56px;height:1px;background:var(--metal);margin-top:1.4rem}
.lay-lex .hist-txt p:first-child::first-letter{font-family:var(--ft);font-size:3.6em;float:left;line-height:.8;padding:.08em .12em 0 0;color:var(--p);font-weight:600}
/* depoimentos: selo de aspas */
.lay-lex .grade-depo{gap:1.6rem;padding-top:26px}
.lay-lex .depo{position:relative;text-align:center;align-items:center;padding:3rem 2rem 2.2rem;border-color:color-mix(in srgb,var(--metal) 45%,var(--linha))}
.lay-lex .depo::before{content:"“";position:absolute;top:-26px;left:50%;transform:translateX(-50%);width:52px;height:52px;border-radius:50%;background:var(--s);color:var(--on-s);font-family:var(--ft);font-size:3rem;line-height:1.15;display:grid;place-items:center;box-shadow:0 0 0 6px var(--bg)}
.lay-lex .depo .estrelas{color:var(--metal)}
.lay-lex .depo blockquote{font-family:var(--ft);font-style:italic;font-size:1.32rem;line-height:1.4}
.lay-lex .depo figcaption{flex-direction:column;gap:.5rem;text-transform:uppercase;letter-spacing:.12em;font-size:.74rem;font-weight:600}
.lay-lex .av{border-radius:50%;background:transparent;border:1px solid var(--p);color:var(--p);font-family:var(--ft);font-size:1rem;letter-spacing:0}
/* faq */
.lay-lex .faq{gap:0;border-top:1px solid var(--linha-forte)}
.lay-lex .faq details{background:none;border:0;border-bottom:1px solid var(--linha-forte);padding:0}
.lay-lex .faq summary{font-family:var(--ft);font-weight:600;font-size:1.35rem;padding:1.4rem 0}
.lay-lex .faq summary i{background:none;border:1px solid var(--metal);color:var(--metal)}
.lay-lex .faq details[open] summary i{background:var(--s);color:var(--on-s);border-color:var(--s)}
/* cta: caixa em tinta com moldura fina */
.lay-lex .cta-box{background:var(--ink);color:#f4f1ea;outline:1px solid color-mix(in srgb,var(--claro-p) 45%,transparent);outline-offset:-16px;padding:clamp(3.5rem,8vw,6rem) clamp(2rem,6vw,4.5rem)}
.lay-lex .cta-box::before{content:"";width:1px;height:48px;background:var(--claro-p);margin-bottom:.4rem}
.lay-lex .cta-box h2 em{color:var(--claro-p);text-decoration:none}
.lay-lex .cta-box p{color:rgba(255,255,255,.72);opacity:1}
/* contato */
.lay-lex .ci>svg{width:46px;height:46px;padding:12px;border:1px solid var(--metal);margin-top:0}
.lay-lex .ci small{letter-spacing:.18em}
.lay-lex .mapa iframe{filter:grayscale(.7) contrast(1.05);border:1px solid var(--linha-forte)}
.lay-lex .rodape{--rod-bg:var(--ink);border-top:1px solid color-mix(in srgb,var(--claro-p) 35%,transparent);letter-spacing:.02em}
.lay-lex .rodape b{font-size:1.15rem}
/* temas escuros: a faixa de tinta precisa se destacar do fundo */
.tema-escuro.lay-lex .b-diferenciais,.tema-grafite.lay-lex .b-diferenciais,.tema-marca.lay-lex .b-diferenciais{background:var(--bg2)}
.tema-escuro.lay-lex .depo::before,.tema-grafite.lay-lex .depo::before,.tema-marca.lay-lex .depo::before{box-shadow:0 0 0 6px var(--bg)}
.tema-escuro.lay-lex .cta-box,.tema-grafite.lay-lex .cta-box,.tema-marca.lay-lex .cta-box{background:var(--card)}
@media (max-width:900px){
  .lay-lex .nav.aberta .nav-links{background:var(--ink);border-color:rgba(255,255,255,.12)}
  .lay-lex .topo-media::before{inset:-10px 10px 10px -10px}
  .lay-lex .hist-media::before{inset:10px -10px -10px 10px}
  .lay-lex .num:nth-child(3){border-left:0}
  .lay-lex .grade-num{row-gap:2rem}
  .lay-lex .grade-depo{row-gap:3.2rem}
}
@media (max-width:600px){
  .lay-lex .grade-dif{grid-template-columns:1fr}
  .lay-lex .cta-box{outline-offset:-10px}
  .lay-lex .btn{letter-spacing:.1em}
  .lay-lex .topo-media::before{inset:-8px 8px 8px -8px}
  .lay-lex .hist-media::before{inset:8px -8px -8px 8px}
}
`,
};
export default layout;
