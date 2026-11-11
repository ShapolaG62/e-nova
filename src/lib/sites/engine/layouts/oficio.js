// Ofício — industrial e confiável: faixas escuras tingidas pela marca, cortes diagonais,
// títulos condensados e serviços numerados (inspirado nos templates Prestação de Serviços / Segurança)
const svg = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

const layout = {
  id: 'oficio',
  nome: 'Ofício',
  descricao: 'Industrial e confiável, cortes diagonais e serviços numerados',
  ordem: 5,
  tema: 'claro',
  topo: 'dividido',
  topoSemFoto: 'dividido',
  faixa: false,
  setores: ['mecanica', 'autoeletrica', 'eletricista', 'encanador', 'reformas', 'arcondicionado', 'seguranca', 'lavajato'],
  fontes: {
    titulo: 'Barlow Condensed',
    corpo: 'Barlow',
    pesoTitulo: 800,
    tituloFallback: "'Arial Narrow',system-ui,sans-serif",
    eixos: { 'Barlow Condensed': 'wght@500;600;700;800', Barlow: 'wght@400;500;600;700' },
  },
  css: `
.lay-oficio{--raio:0px;--raio-img:0px;--raio-btn:3px;--raio-cta:0px;--ls:-.005em;--h1:clamp(2.9rem,6.6vw,5.4rem);--h2:clamp(2.2rem,4.6vw,3.6rem);
  --banda:color-mix(in srgb,var(--p) 30%,#0a0c10);--acc:color-mix(in srgb,var(--p) 52%,#fff);
  --grade:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px) 0 0/56px 56px,linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px) 0 0/56px 56px;
  --listras:repeating-linear-gradient(-45deg,var(--acc) 0 12px,transparent 12px 24px);
  --corte:polygon(0 0,calc(100% - 26px) 0,100% 26px,100% 100%,26px 100%,0 calc(100% - 26px))}
.lay-oficio h1{line-height:.95}
.lay-oficio h3{font-family:var(--ft);font-weight:700;text-transform:uppercase;letter-spacing:.01em;font-size:1.4rem}
.lay-oficio .etiqueta{display:inline-flex;align-items:center;gap:.7rem;letter-spacing:.2em}
.lay-oficio .etiqueta::before{content:"";width:30px;height:4px;background:var(--p)}
.lay-oficio .btn{font-family:var(--ft);text-transform:uppercase;letter-spacing:.05em;font-size:1.08rem;font-weight:700;padding:1.05rem 1.7rem}
.lay-oficio .btn-p{box-shadow:0 12px 26px -14px var(--p)}
.lay-oficio .btn-p:hover{transform:translateY(-2px);box-shadow:0 18px 30px -14px var(--p)}
.lay-oficio .btn-p svg{transition:transform .2s}.lay-oficio .btn-g svg{transition:transform .2s}.lay-oficio .btn-g:hover svg{transform:translateX(4px)}
/* nav */
.lay-oficio .nav{border-bottom:0;box-shadow:inset 0 -3px 0 var(--p)}
.lay-oficio .marca{text-transform:uppercase;font-size:1.55rem;letter-spacing:.02em}
.lay-oficio .nav-links a{font-weight:600;text-transform:uppercase;letter-spacing:.08em;font-size:.82rem}
/* faixas escuras (topo, diferenciais, cta, pacote destaque) */
.lay-oficio .b-topo,.lay-oficio .b-diferenciais,.lay-oficio .cta-box,.lay-oficio .pac-dest{--tx:#fff;--tx2:rgba(255,255,255,.74);--linha:rgba(255,255,255,.12);--linha-forte:rgba(255,255,255,.4);--card:rgba(255,255,255,.05);--em-cor:var(--acc);--etq-cor:#fff;color:var(--tx);background:var(--grade),var(--banda)}
/* topo */
.lay-oficio .b-topo{background:var(--grade),radial-gradient(70% 90% at 90% 10%,color-mix(in srgb,var(--p) 28%,transparent),transparent 70%),var(--banda);clip-path:polygon(0 0,100% 0,100% calc(100% - 6vw),0 100%);padding-bottom:6vw}
.lay-oficio .topo-wrap{padding-bottom:clamp(4rem,8vw,6.5rem)}
.lay-oficio .linha{display:inline-flex;align-items:center;gap:.6rem;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);padding:.5rem .9rem .5rem .8rem;color:#fff;font-size:.74rem;margin-bottom:1.4rem}
.lay-oficio .linha::before{content:"";width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,.7);animation:oficio-pulso 1.8s infinite}
@keyframes oficio-pulso{70%{box-shadow:0 0 0 9px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
.lay-oficio .topo-txt h1{border-left:6px solid var(--acc);padding-left:clamp(1rem,2vw,1.6rem);margin-left:calc(-1 * clamp(1rem,2vw,1.6rem) - 6px)}
.lay-oficio .b-topo .btn-p,.lay-oficio .cta-box .btn-p,.lay-oficio .pac-dest .btn-p{background:var(--btn-forte,var(--p));color:var(--btn-forte-tx,var(--on-p));box-shadow:0 16px 30px -12px rgba(0,0,0,.7)}
.lay-oficio .b-topo .btn-p:hover,.lay-oficio .cta-box .btn-p:hover{box-shadow:0 0 0 4px rgba(255,255,255,.14),0 18px 34px -12px rgba(0,0,0,.7)}
@supports (color:oklch(from red l c h)){.lay-oficio{--banda:oklch(from var(--p) .25 min(c,.07) h);--acc:oklch(from var(--p) max(l,.8) min(c,.16) h);--btn-forte:oklch(from var(--p) max(l,.74) c h);--btn-forte-tx:#0b0d11}}
.lay-oficio .b-topo .btn-g{background:rgba(255,255,255,.06)}
.lay-oficio .b-topo .btn-g:hover{border-color:#fff}
.lay-oficio .provas{color:rgba(255,255,255,.82);font-weight:600}
.lay-oficio .provas li:not(:first-child)::before{content:"";width:16px;height:16px;flex:none;background:var(--acc);-webkit-mask:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='m5 12.5 4.5 4.5L19 7.5' fill='none' stroke='black' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/></svg>`)} center/contain no-repeat;mask:${svg(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='m5 12.5 4.5 4.5L19 7.5' fill='none' stroke='black' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/></svg>`)} center/contain no-repeat}
.lay-oficio .topo-media{position:relative;isolation:isolate}
.lay-oficio .topo-media::before{content:"";position:absolute;left:-22px;bottom:-22px;width:46%;height:34%;background:var(--listras);z-index:-1;opacity:.85}
.lay-oficio .topo-media::after{content:"";position:absolute;right:-14px;top:-14px;width:38%;height:38%;border-top:5px solid var(--acc);border-right:5px solid var(--acc);z-index:1;pointer-events:none}
.lay-oficio .topo-media img{clip-path:var(--corte);aspect-ratio:4/4.6}
.lay-oficio .topo-mono{aspect-ratio:4/4.6;clip-path:var(--corte);background:repeating-linear-gradient(-45deg,rgba(255,255,255,.035) 0 2px,transparent 2px 16px),radial-gradient(90% 70% at 100% 100%,color-mix(in srgb,var(--p) 70%,transparent),transparent 70%),#0d0f13;position:relative;overflow:visible}
.lay-oficio .topo-mono span{color:transparent;-webkit-text-stroke:3px rgba(255,255,255,.9);font-size:clamp(6rem,15vw,12rem);letter-spacing:.02em}
.lay-oficio .topo-mono::before{z-index:1;left:0;bottom:0;width:100%;height:18px;opacity:1}
/* números (flutuando sobre o corte diagonal) */
.lay-oficio .b-numeros{background:transparent;color:var(--tx);padding:0;position:relative;z-index:3;margin-top:calc(-1 * clamp(3.5rem,7vw,5.5rem))}
.lay-oficio .grade-num{background:var(--card);border:1px solid var(--linha);border-top:5px solid var(--p);box-shadow:0 34px 60px -34px rgba(0,0,0,.45);gap:0}
.lay-oficio .num{padding:1.7rem 1rem 1.5rem;border-left:1px solid var(--linha)}
.lay-oficio .num:first-child{border-left:0}
.lay-oficio .num b{color:var(--tx);font-size:clamp(2.6rem,5vw,3.6rem)}
.lay-oficio .num b::after{content:"";display:block;width:28px;height:4px;background:var(--p);margin:.55rem auto .5rem}
.lay-oficio .num span{color:var(--tx2);opacity:1;text-transform:uppercase;letter-spacing:.1em;font-size:.76rem;font-weight:700;line-height:1.4;display:block}
/* serviços: blocos numerados */
.lay-oficio .grade-serv{gap:1.4rem}
.lay-oficio .serv{position:relative;overflow:hidden;padding:2rem 1.8rem 1.6rem;box-shadow:0 1px 0 var(--linha)}
.lay-oficio .serv::after{content:"";position:absolute;left:0;bottom:0;height:4px;width:100%;background:var(--p);transform:scaleX(0);transform-origin:left;transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.lay-oficio .serv:hover::after{transform:scaleX(1)}
.lay-oficio .serv:hover{box-shadow:0 26px 44px -28px rgba(0,0,0,.5)}
.lay-oficio .serv-n{align-self:flex-start;display:grid;place-items:center;width:58px;height:58px;background:var(--p);color:var(--on-p);font-size:1.55rem;clip-path:polygon(0 0,100% 0,100% 70%,70% 100%,0 100%);margin-bottom:.5rem;position:relative;z-index:1}
.lay-oficio .serv-foto{margin:-2rem -1.8rem .9rem;border-radius:0;aspect-ratio:16/9}
.lay-oficio .serv:has(.serv-foto) .serv-n{margin-top:-3rem}
.lay-oficio .serv-foto img{transition:transform .5s}.lay-oficio .serv:hover .serv-foto img{transform:scale(1.05)}
.lay-oficio .serv-link{font-family:var(--ft);text-transform:uppercase;letter-spacing:.08em;font-size:.95rem;border-top:1px solid var(--linha);padding-top:1rem;margin-top:.5rem;width:100%;justify-content:space-between}
.lay-oficio .serv-link svg{transition:transform .2s}.lay-oficio .serv:hover .serv-link svg{transform:translateX(4px)}
/* diferenciais: faixa diagonal escura */
.lay-oficio .b-diferenciais{clip-path:polygon(0 4vw,100% 0,100% calc(100% - 4vw),0 100%);padding-block:calc(var(--pad,clamp(4rem,9vw,7rem)) + 4vw)}
.lay-oficio .b-diferenciais .etiqueta::before{background:var(--acc)}
.lay-oficio .grade-dif{gap:1rem}
.lay-oficio .dif{padding:1.5rem;border:1px solid var(--linha);background:rgba(255,255,255,.03);transition:background .2s,border-color .2s}
.lay-oficio .dif:hover{background:rgba(255,255,255,.07);border-color:var(--acc)}
.lay-oficio .ico{border-radius:0;width:50px;height:50px;background:transparent;border:2px solid var(--acc);color:var(--acc)}
/* passos */
.lay-oficio .passos{gap:0;counter-reset:none}
.lay-oficio .passos li{padding:0 1.6rem 0 0;border-top:3px solid var(--linha);padding-top:0}
.lay-oficio .passos li::before{content:"";position:absolute;top:-3px;left:0;width:64px;height:3px;background:var(--p)}
.lay-oficio .passo-n{border-radius:0;background:none;color:var(--p);width:auto;height:auto;font-size:4.2rem;line-height:1;margin:1rem 0 .6rem;display:block;color:transparent;-webkit-text-stroke:2px var(--p)}
.lay-oficio .passo-n::before{content:"0"}
/* pacotes */
.lay-oficio .pac{border-top:4px solid var(--linha-forte)}
.lay-oficio .pac-dest{border:0;border-top:4px solid var(--acc);transform:translateY(-10px);box-shadow:0 30px 50px -30px rgba(0,0,0,.6)}
.lay-oficio .pac-dest li svg{color:var(--acc)}
.lay-oficio .selo-pac{border-radius:0;left:auto;right:1.4rem;top:-16px;font-family:var(--ft);font-size:.85rem;letter-spacing:.1em;padding:.35rem .8rem;box-shadow:0 0 0 2px rgba(255,255,255,.25)}
/* galeria */
.lay-oficio .galeria{gap:6px}
.lay-oficio .galeria figure{border-radius:0;position:relative}
.lay-oficio .galeria figure::after{content:"";position:absolute;inset:auto 0 0 0;height:4px;background:var(--p);transform:scaleX(0);transform-origin:left;transition:transform .35s}
.lay-oficio .galeria figure:hover::after{transform:scaleX(1)}
/* história */
.lay-oficio .hist-media{position:relative;isolation:isolate}
.lay-oficio .hist-media::before{content:"";position:absolute;right:-20px;bottom:-20px;width:55%;height:40%;background:repeating-linear-gradient(-45deg,var(--p) 0 12px,transparent 12px 24px);opacity:.55;z-index:-1}
.lay-oficio .hist-media img,.lay-oficio .mono-hist{clip-path:var(--corte)}
.lay-oficio .mono-hist{background:var(--grade),radial-gradient(80% 70% at 0% 100%,color-mix(in srgb,var(--p) 55%,transparent),transparent 70%),var(--banda)}
.lay-oficio .mono-hist span{color:transparent;-webkit-text-stroke:3px rgba(255,255,255,.85);font-size:clamp(6rem,12vw,9rem)}
/* depoimentos */
.lay-oficio .depo{position:relative;border-left:5px solid var(--p);padding:2rem 1.8rem}
.lay-oficio .depo::after{content:"\\201D";position:absolute;right:1.2rem;top:-.4rem;font-family:Georgia,serif;font-size:6.5rem;line-height:1;color:var(--p);opacity:.16}
.lay-oficio .depo figcaption{font-family:var(--ft);text-transform:uppercase;letter-spacing:.05em;font-size:1.05rem}
.lay-oficio .av{border-radius:0;background:var(--p);color:var(--on-p);font-family:var(--fc)}
/* faq */
.lay-oficio .faq details{border-left:4px solid var(--linha-forte);transition:border-color .2s}
.lay-oficio .faq details[open]{border-left-color:var(--p)}
.lay-oficio .faq summary{font-family:var(--ft);text-transform:uppercase;font-size:1.18rem;letter-spacing:.02em}
.lay-oficio .faq summary i{border-radius:0;background:var(--p);color:var(--on-p)}
/* cta */
.lay-oficio .cta-box{position:relative;text-align:left;justify-items:start;clip-path:polygon(0 0,calc(100% - 48px) 0,100% 48px,100% 100%,48px 100%,0 calc(100% - 48px));padding-top:calc(clamp(2.5rem,6vw,4.5rem) + 14px)}
.lay-oficio .cta-box::before{content:"";position:absolute;left:0;top:0;width:100%;height:14px;background:var(--listras)}
.lay-oficio .cta-box::after{content:"";position:absolute;right:-4%;top:0;bottom:0;width:38%;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--p) 55%,transparent));clip-path:polygon(35% 0,100% 0,100% 100%,0 100%);pointer-events:none}
.lay-oficio .cta-box>*{position:relative;z-index:1}
.lay-oficio .cta-box h2 em{text-decoration:none;color:var(--acc)}
.lay-oficio .cta-box p{max-width:40em}

/* contato */
.lay-oficio .ci>svg{width:46px;height:46px;padding:11px;background:var(--p-suave);margin-top:0}
.lay-oficio .ci small{margin-bottom:.15rem}
.lay-oficio .mapa{border-top:5px solid var(--p)}
.lay-oficio .mapa iframe{border-radius:0;display:block}
/* rodapé */
.lay-oficio .rodape{--rod-bg:#0b0d11;border-top:5px solid var(--p)}
.lay-oficio .rodape b{text-transform:uppercase;letter-spacing:.04em;font-size:1.1rem}
/* temas escuros */
.tema-escuro.lay-oficio,.tema-grafite.lay-oficio,.tema-marca.lay-oficio{--em-cor:var(--acc);--etq-cor:var(--acc)}
.tema-escuro.lay-oficio .serv-link,.tema-grafite.lay-oficio .serv-link,.tema-marca.lay-oficio .serv-link{color:var(--acc)}
.tema-escuro.lay-oficio .grade-num,.tema-grafite.lay-oficio .grade-num,.tema-marca.lay-oficio .grade-num{background:var(--bg2)}
@media (max-width:900px){
  .lay-oficio .topo-media{margin:0 14px 10px}
  .lay-oficio .topo-txt h1{margin-left:0}
  .lay-oficio .topo-media img,.lay-oficio .topo-mono{aspect-ratio:4/3}
  .lay-oficio .num:nth-child(3){border-left:0}
  .lay-oficio .num:nth-child(n+3){border-top:1px solid var(--linha)}
  .lay-oficio .passos{gap:2rem}
  .lay-oficio .pac-dest{transform:none}
}
@media (max-width:600px){
  .lay-oficio .cta-box{clip-path:polygon(0 0,calc(100% - 28px) 0,100% 28px,100% 100%,28px 100%,0 calc(100% - 28px))}
  .lay-oficio .grade-serv{gap:1rem}
}
`,
};
export default layout;
