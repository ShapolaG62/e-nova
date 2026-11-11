// Patas — alegre e acolhedor: tudo arredondado, formas orgânicas (blobs), ondas,
// estampa de patinhas e selos tipo adesivo (inspirado no template Pet Shop)
const svg = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
const PATA = `<g id='p'><ellipse cx='0' cy='6' rx='10' ry='8.5'/><ellipse cx='-11.5' cy='-6' rx='4.2' ry='5.4'/><ellipse cx='-4.2' cy='-13' rx='4.2' ry='5.4'/><ellipse cx='4.2' cy='-13' rx='4.2' ry='5.4'/><ellipse cx='11.5' cy='-6' rx='4.2' ry='5.4'/></g>`;
const ESTAMPA = svg(`<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'><defs>${PATA}</defs><use href='#p' transform='translate(42 48) rotate(-22)'/><use href='#p' transform='translate(132 128) rotate(16) scale(.78)'/><circle cx='140' cy='38' r='5'/><circle cx='40' cy='140' r='3.5'/><circle cx='92' cy='92' r='2.5'/></svg>`);
const ICONE_PATA = svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='-17 -20 34 36'><defs>${PATA}</defs><use href='#p'/></svg>`);
const ONDA = svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 60' preserveAspectRatio='none'><path d='M0 32C120 6 240 6 360 30s240 26 360 2 240-26 360-2 240 26 360 2v28H0Z'/></svg>`);

const layout = {
  id: 'patas',
  nome: 'Patas',
  descricao: 'Alegre e acolhedor, formas arredondadas, ondas e selos',
  ordem: 7,
  tema: 'creme',
  topo: 'dividido',
  topoSemFoto: 'dividido',
  faixa: false,
  setores: ['petshop', 'veterinario', 'escola', 'acai'],
  fontes: {
    titulo: 'Fredoka',
    corpo: 'Nunito',
    pesoTitulo: 600,
    tituloFallback: "'Baloo 2','Trebuchet MS',system-ui,sans-serif",
    eixos: { Fredoka: 'wght@500;600;700', Nunito: 'wght@400;600;700;800' },
  },
  css: `
.lay-patas{--raio:28px;--raio-img:40px;--raio-btn:999px;--raio-cta:48px;--ls:-.01em;--h1:clamp(2.6rem,6vw,4.5rem);--h2:clamp(2rem,4.2vw,3.1rem);
  --tint:color-mix(in srgb,var(--p) 11%,var(--bg));--tint-s:color-mix(in srgb,var(--s) 13%,var(--bg));
  --blob:62% 38% 54% 46% / 52% 44% 56% 48%;--blob2:42% 58% 38% 62% / 55% 40% 60% 45%;--mola:cubic-bezier(.34,1.56,.64,1);--onda-h:clamp(28px,4.5vw,64px)}
.lay-patas h1{line-height:1.04}
.lay-patas h3{font-family:var(--ft);font-weight:600;font-size:1.32rem;letter-spacing:0}
.lay-patas .etiqueta{display:inline-flex;align-items:center;gap:.5rem;background:var(--p-suave);padding:.45rem 1rem .45rem .8rem;border-radius:999px;letter-spacing:.1em;font-weight:800}
.lay-patas .etiqueta::before{content:"";width:15px;height:15px;background:currentColor;-webkit-mask:${ICONE_PATA} center/contain no-repeat;mask:${ICONE_PATA} center/contain no-repeat;transform:rotate(-15deg)}
.lay-patas .btn{font-family:var(--ft);font-weight:600;font-size:1.08rem;letter-spacing:.01em;padding:1rem 1.7rem;transition:transform .35s var(--mola),box-shadow .2s,background .2s}
.lay-patas .btn-p{box-shadow:0 6px 0 color-mix(in srgb,var(--p) 68%,#000)}
.lay-patas .btn-p:hover{transform:translateY(-3px);box-shadow:0 9px 0 color-mix(in srgb,var(--p) 68%,#000)}
.lay-patas .btn-p:active{transform:translateY(4px);box-shadow:0 2px 0 color-mix(in srgb,var(--p) 68%,#000)}
.lay-patas .btn-g{background:var(--card);border:2px solid var(--linha);box-shadow:0 6px 0 var(--linha)}
.lay-patas .btn-g:hover{transform:translateY(-3px);border-color:var(--p);color:var(--p)}
/* nav */
.lay-patas .marca{display:inline-flex;align-items:center;gap:.5rem;font-size:1.4rem;font-weight:700}
.lay-patas .marca::before{content:"";flex:none;width:22px;height:22px;background:var(--p);-webkit-mask:${ICONE_PATA} center/contain no-repeat;mask:${ICONE_PATA} center/contain no-repeat;transform:rotate(-15deg)}
.lay-patas .nav-links a{font-weight:700}
/* topo: fundo tingido + estampa de patinhas + onda */
.lay-patas .b-topo{background:var(--tint);padding-bottom:var(--onda-h)}
.lay-patas .b-topo::before{content:"";position:absolute;inset:0;background:var(--p);opacity:.07;-webkit-mask:${ESTAMPA} 0 0/180px 180px repeat;mask:${ESTAMPA} 0 0/180px 180px repeat;pointer-events:none}
.lay-patas .b-topo::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:var(--onda-h);background:var(--bg);-webkit-mask:${ONDA} center/100% 100% no-repeat;mask:${ONDA} center/100% 100% no-repeat}
.lay-patas .topo-wrap{position:relative;z-index:1}
.lay-patas .linha{display:inline-flex;align-items:center;gap:.5rem;background:var(--p);color:var(--on-p);padding:.55rem 1.1rem;border-radius:999px;transform:rotate(-2.5deg);box-shadow:0 0 0 4px var(--card),0 10px 20px -10px rgba(0,0,0,.35);letter-spacing:.08em;font-weight:800;margin-bottom:1.6rem}
.lay-patas h1 em{text-decoration:underline wavy var(--s);text-decoration-thickness:.07em;text-underline-offset:.2em;text-decoration-skip-ink:none}
.lay-patas .provas{gap:.6rem}
.lay-patas .provas li{background:var(--card);color:var(--tx);font-weight:700;padding:.5rem 1rem;border-radius:999px;box-shadow:0 6px 16px -10px rgba(0,0,0,.3)}
.lay-patas .topo-media{position:relative;isolation:isolate}
.lay-patas .topo-media::before{content:"";position:absolute;inset:4% -5% -4% 6%;border-radius:var(--blob2);background:var(--s);opacity:.9;z-index:-1;transform:rotate(-7deg)}
.lay-patas .topo-media::after{content:"\\2665";position:absolute;left:-8px;bottom:12%;width:84px;height:84px;display:grid;place-items:center;border-radius:50%;background:var(--p);color:var(--on-p);font-size:2.2rem;line-height:1;box-shadow:0 0 0 6px var(--card),0 16px 30px -12px rgba(0,0,0,.4);transform:rotate(-12deg);animation:patas-flutua 4s ease-in-out infinite}
.lay-patas .topo-media img{border-radius:var(--blob);border:8px solid var(--card);box-shadow:0 30px 60px -30px rgba(0,0,0,.45)}
.lay-patas .topo-mono{overflow:visible;isolation:auto;border-radius:var(--blob);border:8px solid var(--card);box-shadow:0 30px 60px -30px rgba(0,0,0,.45);background:radial-gradient(55% 50% at 28% 22%,rgba(255,255,255,.3),transparent 70%),linear-gradient(145deg,color-mix(in srgb,var(--p) 72%,#fff),var(--p) 75%)}
.lay-patas .topo-mono span{color:var(--on-p);font-weight:700;text-shadow:0 8px 0 rgba(0,0,0,.12);position:relative}
@keyframes patas-flutua{50%{transform:rotate(-6deg) translateY(-10px)}}
/* números: bolhas */
.lay-patas .b-numeros{background:transparent;color:var(--tx);padding-top:clamp(1rem,3vw,2rem)}
.lay-patas .grade-num{gap:1rem}
.lay-patas .num{background:var(--tint);border-radius:30px;padding:1.6rem 1rem;transition:transform .45s var(--mola)}
.lay-patas .num:nth-child(even){background:var(--tint-s);border-radius:var(--blob2)}
.lay-patas .num:nth-child(odd){border-radius:var(--blob)}
.lay-patas .num:hover{transform:rotate(-3deg) scale(1.04)}
.lay-patas .num b{color:var(--p);font-weight:700}
.lay-patas .num span{color:var(--tx2);opacity:1;font-weight:700}
/* serviços */
.lay-patas .grade-serv{gap:1.4rem}
.lay-patas .serv{border:2px solid var(--linha);padding:1.8rem;transition:transform .45s var(--mola),box-shadow .3s,border-color .3s}
.lay-patas .serv:hover{transform:translateY(-8px) rotate(-1deg);border-color:color-mix(in srgb,var(--p) 40%,transparent);box-shadow:0 14px 0 -6px color-mix(in srgb,var(--p) 28%,transparent),0 28px 40px -26px rgba(0,0,0,.35)}
.lay-patas .serv:nth-child(even):hover{transform:translateY(-8px) rotate(1deg)}
.lay-patas .serv-n{display:grid;place-items:center;width:54px;height:54px;border-radius:var(--blob);background:var(--p);color:var(--on-p);font-size:1.15rem;transform:rotate(-8deg);margin-bottom:.4rem;box-shadow:0 0 0 4px var(--card);position:relative;transition:transform .45s var(--mola)}
.lay-patas .serv:nth-child(even) .serv-n{background:var(--s);color:var(--on-s);border-radius:var(--blob2);transform:rotate(7deg)}
.lay-patas .serv:hover .serv-n{transform:rotate(0) scale(1.12)}
.lay-patas .serv-foto{margin:-.8rem -.8rem .2rem;border-radius:20px}
.lay-patas .serv:has(.serv-foto) .serv-n{margin-top:-2.3rem}
.lay-patas .serv-link{align-self:flex-start;background:var(--p-suave);padding:.55rem 1rem;border-radius:999px;margin-top:.4rem;transition:background .2s,color .2s}
.lay-patas .serv-link:hover{background:var(--p);color:var(--on-p)}
/* diferenciais: faixa com ondas em cima e embaixo */
.lay-patas .b-diferenciais{background:var(--tint);position:relative;margin-block:var(--onda-h)}
.lay-patas .b-diferenciais::before,.lay-patas .b-diferenciais::after{content:"";position:absolute;left:0;right:0;height:var(--onda-h);background:var(--tint);-webkit-mask:${ONDA} center/100% 100% no-repeat;mask:${ONDA} center/100% 100% no-repeat;pointer-events:none}
.lay-patas .b-diferenciais::before{bottom:calc(100% - 1px)}
.lay-patas .b-diferenciais::after{top:calc(100% - 1px);transform:scale(-1,-1)}
.lay-patas .grade-dif{gap:1.1rem}
.lay-patas .dif{background:var(--card);border-radius:24px;padding:1.4rem;box-shadow:0 12px 30px -24px rgba(0,0,0,.4)}
.lay-patas .ico{width:54px;height:54px;border-radius:var(--blob);background:var(--p);color:var(--on-p);transition:transform .45s var(--mola)}
.lay-patas .dif:nth-child(even) .ico{background:var(--s);color:var(--on-s);border-radius:var(--blob2)}
.lay-patas .dif:hover .ico{transform:rotate(-12deg) scale(1.12)}
/* passos */
.lay-patas .passos li{text-align:center;display:flex;flex-direction:column;align-items:center}
.lay-patas .passos li:not(:last-child)::after{content:"";position:absolute;top:calc(.4rem + 34px);left:calc(50% + 50px);right:calc(-50% + 50px);border-top:3px dashed color-mix(in srgb,var(--p) 40%,transparent)}
.lay-patas .passo-n{width:68px;height:68px;border-radius:var(--blob);font-size:1.7rem;box-shadow:0 0 0 6px var(--p-suave);transition:transform .45s var(--mola)}
.lay-patas .passos li:nth-child(even) .passo-n{background:var(--s);color:var(--on-s);border-radius:var(--blob2);box-shadow:0 0 0 6px color-mix(in srgb,var(--s) 18%,transparent)}
.lay-patas .passos li:hover .passo-n{transform:rotate(-10deg) scale(1.08)}
.lay-patas .passos p{max-width:22em}
/* pacotes */
.lay-patas .pac{border:2px solid var(--linha);border-radius:32px}
.lay-patas .pac-dest{background:var(--tint);border:3px solid var(--p)}
.lay-patas .selo-pac{transform:rotate(-4deg);font-family:var(--ft);font-weight:600;letter-spacing:.04em;font-size:.8rem;padding:.4rem 1rem;box-shadow:0 0 0 3px var(--card)}
.lay-patas .pac li svg{width:22px;height:22px;padding:3px;border-radius:50%;background:var(--p-suave);margin-top:.05rem}
/* galeria: fotos tipo adesivo */
.lay-patas .galeria{gap:1.1rem}
.lay-patas .galeria figure{border:6px solid var(--card);border-radius:28px;box-shadow:0 18px 34px -22px rgba(0,0,0,.45);transform:rotate(-1.4deg);transition:transform .45s var(--mola)}
.lay-patas .galeria figure:nth-child(even){transform:rotate(1.4deg)}
.lay-patas .galeria figure:hover{transform:rotate(0) scale(1.03);z-index:1}
.lay-patas .galeria figure:hover img{transform:none}
/* história */
.lay-patas .hist-media{position:relative;isolation:isolate}
.lay-patas .hist-media::before{content:"";position:absolute;inset:-4% 6% 8% -5%;border-radius:var(--blob2);background:var(--p);opacity:.16;z-index:-1;transform:rotate(8deg)}
.lay-patas .hist-media img,.lay-patas .mono-hist{border-radius:var(--blob2);border:8px solid var(--card)}
.lay-patas .mono-hist{position:relative;background:radial-gradient(60% 50% at 30% 20%,rgba(255,255,255,.3),transparent 70%),linear-gradient(150deg,color-mix(in srgb,var(--p) 70%,#fff),var(--p))}
.lay-patas .mono-hist::before{content:"";position:absolute;inset:0;border-radius:inherit;background:#fff;opacity:.14;-webkit-mask:${ESTAMPA} 0 0/150px 150px repeat;mask:${ESTAMPA} 0 0/150px 150px repeat}
.lay-patas .mono-hist span{position:relative;color:var(--on-p);font-weight:700;text-shadow:0 8px 0 rgba(0,0,0,.12)}
/* depoimentos */
.lay-patas .depo{border:2px dashed color-mix(in srgb,var(--p) 35%,transparent);transition:transform .45s var(--mola)}
.lay-patas .depo:nth-child(3n+1){transform:rotate(-1deg)}
.lay-patas .depo:nth-child(3n+2){transform:rotate(1deg) translateY(10px)}
.lay-patas .depo:hover{transform:rotate(0) translateY(-4px)}
.lay-patas .av{background:var(--s);color:var(--on-s);font-family:var(--ft);border-radius:var(--blob)}
/* faq */
.lay-patas .faq details{border:2px solid var(--linha);border-radius:24px;transition:background .2s,border-color .2s}
.lay-patas .faq details[open]{background:var(--tint);border-color:color-mix(in srgb,var(--p) 40%,transparent)}
.lay-patas .faq summary{font-family:var(--ft);font-weight:600;font-size:1.12rem}
.lay-patas .faq summary i{width:34px;height:34px;background:var(--p);color:var(--on-p);transition:transform .4s var(--mola)}
/* cta */
.lay-patas .cta-box{position:relative;overflow:hidden;isolation:isolate;background:radial-gradient(50% 90% at 100% 0%,rgba(255,255,255,.22),transparent 70%),radial-gradient(40% 70% at 0% 100%,rgba(0,0,0,.14),transparent 70%),var(--p)}
.lay-patas .cta-box::before{content:"";position:absolute;inset:0;background:currentColor;opacity:.1;z-index:-1;-webkit-mask:${ESTAMPA} 0 0/170px 170px repeat;mask:${ESTAMPA} 0 0/170px 170px repeat}
.lay-patas .cta-box h2 em{text-decoration:underline wavy;text-decoration-thickness:.06em;text-underline-offset:.2em;text-decoration-skip-ink:none}
.lay-patas .cta-box .btn-p{box-shadow:0 6px 0 rgba(0,0,0,.2)}
.lay-patas .cta-box .btn-p:hover{box-shadow:0 9px 0 rgba(0,0,0,.2)}
/* contato */
.lay-patas .ci>svg{width:46px;height:46px;padding:11px;border-radius:var(--blob);background:var(--p-suave);margin-top:0}
.lay-patas .mapa iframe{border:6px solid var(--card);box-shadow:0 20px 40px -26px rgba(0,0,0,.4)}
/* rodapé com onda */
.lay-patas .rodape{--rod-bg:color-mix(in srgb,var(--p) 32%,#121212);position:relative;margin-top:var(--onda-h);padding-top:1.4rem}
.lay-patas .rodape::before{content:"";position:absolute;left:0;right:0;bottom:calc(100% - 1px);height:var(--onda-h);background:var(--rod-bg);-webkit-mask:${ONDA} center/100% 100% no-repeat;mask:${ONDA} center/100% 100% no-repeat}
.tema-escuro.lay-patas,.tema-grafite.lay-patas,.tema-marca.lay-patas{--em-cor:color-mix(in srgb,var(--p) 55%,#fff);--etq-cor:color-mix(in srgb,var(--p) 55%,#fff)}
.tema-escuro.lay-patas .num b,.tema-grafite.lay-patas .num b,.tema-marca.lay-patas .num b,.tema-escuro.lay-patas .serv-link,.tema-grafite.lay-patas .serv-link,.tema-marca.lay-patas .serv-link{color:var(--em-cor)}
@media (prefers-reduced-motion:reduce){.lay-patas .topo-media::after{animation:none}}
@media (max-width:900px){
  .lay-patas .topo-media{margin:0 10px 0 4px}
  .lay-patas .topo-media::after{width:68px;height:68px;font-size:1.8rem;left:-4px}
  .lay-patas .passos li:not(:last-child)::after{display:none}
  .lay-patas .depo:nth-child(3n+2){transform:rotate(1deg)}
}
@media (max-width:600px){
  .lay-patas{--raio-cta:32px}
  .lay-patas .grade-num{gap:.7rem}
  .lay-patas .num{padding:1.3rem .6rem}
  .lay-patas .depo:nth-child(n){transform:none}
}
`,
};
export default layout;
