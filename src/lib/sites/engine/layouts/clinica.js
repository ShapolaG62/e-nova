// Clínica — institucional, claro e acolhedor: títulos serifados, cartões suaves com ícones, faixas profundas na cor da marca (inspirado nos templates Institucional / Dentista)
const PONTOS = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18'%3E%3Ccircle cx='3' cy='3' r='1.7'/%3E%3C/svg%3E")`;

const layout = {
  id: 'clinica',
  nome: 'Clínica',
  descricao: 'Institucional e acolhedor, títulos serifados e cartões suaves',
  ordem: 3,
  tema: 'claro',
  topo: 'dividido',
  topoSemFoto: 'dividido',
  faixa: false,
  setores: ['clinica', 'fisioterapia', 'estetica', 'psicologia', 'veterinario'],
  fontes: {
    titulo: 'DM Serif Display',
    corpo: 'DM Sans',
    pesoTitulo: 400,
    tituloFallback: 'Georgia,serif',
    eixos: { 'DM Serif Display': 'ital@0;1' },
  },
  css: `
.lay-clinica{--deep:color-mix(in srgb,var(--p) 45%,#0b1226);--deep2:color-mix(in srgb,var(--p) 62%,#0b1226);--raio:20px;--raio-img:28px;--ls:-.01em;--h1:clamp(2.5rem,5.2vw,4.2rem);--h2:clamp(2rem,3.8vw,3rem);--em-estilo:italic;--mono-bg:var(--deep)}
.lay-clinica h3{font-family:var(--fc);font-weight:700;letter-spacing:-.01em}
.lay-clinica .nav{background:var(--nav-bg);box-shadow:0 1px 0 var(--linha)}
.lay-clinica .marca{font-size:1.4rem}
.lay-clinica .btn{font-weight:600;letter-spacing:.01em}
.lay-clinica .btn-p{box-shadow:0 14px 30px -14px var(--p)}
.lay-clinica .etiqueta,.lay-clinica .linha{display:inline-flex;align-items:center;gap:.55rem;letter-spacing:.12em;font-size:.74rem;background:var(--p-suave);color:var(--deep);padding:.45rem .85rem;border-radius:999px}
.lay-clinica .etiqueta::before,.lay-clinica .linha::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--p)}
/* topo */
.lay-clinica .b-topo{background:linear-gradient(180deg,color-mix(in srgb,var(--p) 7%,var(--bg)) 0%,var(--bg) 100%)}
.lay-clinica .b-topo::before{content:"";position:absolute;width:46vw;max-width:640px;aspect-ratio:1;right:-12vw;top:-18vw;border-radius:50%;background:radial-gradient(circle,var(--p-suave),transparent 68%);pointer-events:none}
.lay-clinica .topo-txt h1{border-left:4px solid var(--p);padding-left:clamp(1rem,2vw,1.5rem);margin-left:-2px}
.lay-clinica .topo-txt .sub{margin-top:1.6rem}
.lay-clinica .provas li{background:var(--card);border:1px solid var(--linha);padding:.45rem .9rem;border-radius:999px;box-shadow:0 8px 20px -16px rgba(10,20,50,.35)}
.lay-clinica .provas{gap:.6rem}
.lay-clinica .topo-media{position:relative;isolation:isolate}
.lay-clinica .topo-media::before{content:"";position:absolute;width:42%;aspect-ratio:1;right:-5%;top:-5%;background:var(--p);opacity:.35;-webkit-mask:${PONTOS};mask:${PONTOS};z-index:-1}
.lay-clinica .topo-media::after{content:"";position:absolute;width:38%;aspect-ratio:1;left:-7%;bottom:-6%;border-radius:50%;background:var(--p-suave);z-index:-1}
.lay-clinica .topo-media img{box-shadow:0 40px 70px -40px rgba(10,20,50,.45)}
.lay-clinica .topo-mono{background:radial-gradient(90% 70% at 80% 10%,color-mix(in srgb,var(--s) 35%,transparent),transparent 60%),linear-gradient(160deg,var(--deep2),var(--deep));position:relative}
.lay-clinica .topo-mono span{font-style:italic;font-weight:400;position:relative;z-index:1}
.lay-clinica .topo-mono::before,.lay-clinica .mono-hist::before{content:"";position:absolute;width:62%;aspect-ratio:1;border-radius:50%;border:1px solid rgba(255,255,255,.28);box-shadow:0 0 0 22px rgba(255,255,255,.05),0 0 0 23px rgba(255,255,255,.14)}
/* números: faixa profunda com cartões brancos */
.lay-clinica .b-numeros{background:linear-gradient(120deg,var(--deep),var(--deep2));color:#fff;padding:clamp(3rem,6vw,4.5rem) 0}
.lay-clinica .grade-num{gap:1.1rem}
.lay-clinica .num{background:#fff;color:#16203a;border-radius:18px;padding:1.6rem 1.2rem;box-shadow:0 24px 40px -28px rgba(0,0,0,.6);display:grid;justify-items:center;gap:.45rem}
.lay-clinica .num::before{content:"";width:34px;height:3px;border-radius:3px;background:var(--p);margin-bottom:.35rem}
.lay-clinica .num b{font-size:clamp(2rem,4vw,2.8rem);color:var(--deep)}
.lay-clinica .num span{color:#5b6270;opacity:1;font-size:.9rem;line-height:1.35}
/* serviços: cartões suaves com ícone */
.lay-clinica .b-servicos .cab,.lay-clinica .b-diferenciais .cab,.lay-clinica .b-depoimentos .cab,.lay-clinica .b-passos .cab,.lay-clinica .b-galeria .cab{margin-inline:auto;text-align:center}
.lay-clinica .serv{border:1px solid var(--linha);box-shadow:0 18px 40px -34px rgba(10,20,50,.5);padding:2rem}
.lay-clinica .serv:hover{border-color:color-mix(in srgb,var(--p) 45%,transparent);box-shadow:0 30px 50px -34px color-mix(in srgb,var(--p) 70%,#000)}
.lay-clinica .serv-n{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;background:var(--p-suave);color:var(--deep);font-size:1.1rem;font-style:italic;margin-bottom:.5rem;position:relative}
.lay-clinica .serv-n::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:1px dashed color-mix(in srgb,var(--p) 40%,transparent)}
.lay-clinica .serv-foto{margin:-2rem -2rem .8rem}
.lay-clinica .serv-foto+.serv-n{margin-top:-2.9rem;background:var(--card);box-shadow:0 8px 18px -8px rgba(0,0,0,.3);margin-left:.1rem}
.lay-clinica .serv h3{font-size:1.18rem}
.lay-clinica .serv-link{margin-top:.4rem;padding-top:1rem;border-top:1px solid var(--linha);width:100%}
/* diferenciais: grade de ícones centralizada */
.lay-clinica .grade-dif{grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.4rem}
.lay-clinica .dif{flex-direction:column;align-items:center;text-align:center;background:var(--card);border-radius:var(--raio);padding:2rem 1.5rem;border:1px solid var(--linha)}
.lay-clinica .ico{width:64px;height:64px;border-radius:50%;background:linear-gradient(150deg,var(--deep2),var(--deep));color:#fff;box-shadow:0 0 0 7px var(--p-suave);margin-bottom:.6rem}
.lay-clinica .ico svg{width:26px;height:26px}
/* passos: linha do tempo */
.lay-clinica .passos{gap:2rem}
.lay-clinica .passos li{text-align:center;display:grid;justify-items:center}
.lay-clinica .passos li:not(:last-child)::after{content:"";position:absolute;top:calc(.4rem + 31px);left:calc(50% + 46px);width:calc(100% - 92px + 2rem);height:2px;background:repeating-linear-gradient(90deg,color-mix(in srgb,var(--p) 50%,transparent) 0 8px,transparent 8px 14px)}
.lay-clinica .passo-n{width:62px;height:62px;background:var(--card);color:var(--deep);border:2px solid var(--p);font-style:italic;font-size:1.5rem;box-shadow:0 0 0 8px var(--p-suave)}
.lay-clinica .passos p{max-width:22rem}
/* galeria */
.lay-clinica .galeria figure{border-radius:20px}
/* história: faixa profunda */
.lay-clinica .b-historia{background:linear-gradient(120deg,var(--deep),var(--deep2));color:#fff}
.lay-clinica .b-historia .etiqueta{background:rgba(255,255,255,.12);color:#fff}
.lay-clinica .b-historia .etiqueta::before{background:#fff}
.lay-clinica .b-historia h2 em{color:color-mix(in srgb,var(--p) 35%,#fff)}
.lay-clinica .b-historia .hist-txt p{color:rgba(255,255,255,.84)}
.lay-clinica .b-historia h2::after{content:"";display:block;width:56px;height:3px;border-radius:3px;background:color-mix(in srgb,var(--p) 50%,#fff);margin-top:1.1rem}
.lay-clinica .hist-media{position:relative;isolation:isolate}
.lay-clinica .hist-media::after{content:"";position:absolute;width:40%;aspect-ratio:1;left:-6%;bottom:-6%;background:#fff;opacity:.25;-webkit-mask:${PONTOS};mask:${PONTOS};z-index:-1}
.lay-clinica .mono-hist{position:relative;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18)}
.lay-clinica .mono-hist span{font-style:italic;font-weight:400;position:relative}
/* depoimentos */
.lay-clinica .depo{position:relative;padding:2.2rem 1.9rem 1.8rem;border:1px solid var(--linha);box-shadow:0 18px 40px -34px rgba(10,20,50,.5)}
.lay-clinica .depo::before{content:"“";position:absolute;right:1.4rem;top:.2rem;font-family:var(--ft);font-size:5.5rem;line-height:1;color:var(--p);opacity:.22}
.lay-clinica .depo blockquote{font-family:var(--ft);font-size:1.18rem;line-height:1.45}
.lay-clinica .depo figcaption{padding-top:1rem;border-top:1px solid var(--linha)}
.lay-clinica .av{background:linear-gradient(150deg,var(--deep2),var(--deep));color:#fff}
/* faq: lista centralizada com linhas */
.lay-clinica .faq-wrap{grid-template-columns:1fr;max-width:820px}
.lay-clinica .b-faq .cab{text-align:center;margin-inline:auto}
.lay-clinica .faq{gap:0;background:var(--card);border-radius:24px;padding:.6rem clamp(1.2rem,3vw,2.2rem);border:1px solid var(--linha);box-shadow:0 24px 50px -40px rgba(10,20,50,.45)}
.lay-clinica .faq details{background:none;border:0;border-bottom:1px solid var(--linha);border-radius:0;padding:0}
.lay-clinica .faq details:last-child{border-bottom:0}
.lay-clinica .faq summary{font-weight:600;padding:1.35rem 0}
.lay-clinica .faq details[open] summary{color:var(--deep)}
.lay-clinica .faq details[open] summary i{background:var(--p);color:var(--on-p)}
/* cta: cartão claro com pontos */
.lay-clinica .cta-box{--cta-bg:linear-gradient(120deg,color-mix(in srgb,var(--p) 10%,var(--card)),color-mix(in srgb,var(--s) 8%,var(--card)));--cta-tx:var(--tx);--cta-btn:var(--p);--cta-btn-tx:var(--on-p);border:1px solid color-mix(in srgb,var(--p) 22%,transparent);position:relative;overflow:hidden;isolation:isolate}
.lay-clinica .cta-box::before{content:"";position:absolute;width:220px;aspect-ratio:1;left:-40px;top:-40px;background:var(--p);opacity:.25;-webkit-mask:${PONTOS};mask:${PONTOS};z-index:-1}
.lay-clinica .cta-box::after{content:"";position:absolute;width:300px;aspect-ratio:1;right:-90px;bottom:-130px;border-radius:50%;border:40px solid var(--p-suave);z-index:-1}
.lay-clinica .cta-box h2 em{color:var(--p);text-decoration:none}
.lay-clinica .cta-box p{color:var(--tx2);opacity:1}
.lay-clinica .cta-box .btn-p{box-shadow:0 14px 30px -14px var(--p)}
/* contato */
.lay-clinica .ci>svg{width:44px;height:44px;padding:11px;border-radius:50%;background:var(--p-suave);margin-top:0}
.lay-clinica .mapa iframe{border-radius:24px;box-shadow:0 30px 60px -40px rgba(10,20,50,.5)}
.lay-clinica .rodape{--rod-bg:var(--deep);border-top:4px solid var(--p)}
/* temas escuros */
.tema-escuro.lay-clinica .num,.tema-grafite.lay-clinica .num,.tema-marca.lay-clinica .num{background:var(--card);color:var(--tx)}
.tema-escuro.lay-clinica .num b,.tema-grafite.lay-clinica .num b,.tema-marca.lay-clinica .num b,.tema-escuro.lay-clinica .etiqueta,.tema-grafite.lay-clinica .etiqueta,.tema-marca.lay-clinica .etiqueta,.tema-escuro.lay-clinica .linha,.tema-grafite.lay-clinica .linha,.tema-marca.lay-clinica .linha,.tema-escuro.lay-clinica .serv-n,.tema-grafite.lay-clinica .serv-n,.tema-marca.lay-clinica .serv-n,.tema-escuro.lay-clinica .passo-n,.tema-grafite.lay-clinica .passo-n,.tema-marca.lay-clinica .passo-n,.tema-escuro.lay-clinica .faq details[open] summary,.tema-grafite.lay-clinica .faq details[open] summary,.tema-marca.lay-clinica .faq details[open] summary{color:color-mix(in srgb,var(--p) 40%,#fff)}
.tema-escuro.lay-clinica .num span,.tema-grafite.lay-clinica .num span,.tema-marca.lay-clinica .num span{color:var(--tx2)}
@media (max-width:900px){
  .lay-clinica .passos li:not(:last-child)::after{display:none}
  .lay-clinica .passos li{text-align:left;justify-items:start}
  .lay-clinica .topo-media::before{right:0;top:-3%}
  .lay-clinica .topo-media::after{left:-3%}
}
@media (max-width:600px){
  .lay-clinica .grade-num{grid-template-columns:repeat(2,1fr);gap:.7rem}
  .lay-clinica .num{padding:1.2rem .7rem}
  .lay-clinica .faq{border-radius:18px}
  .lay-clinica .b-topo::before{width:90vw;right:-40vw;top:-30vw}
}
`,
};
export default layout;
