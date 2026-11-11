// Aurora — claro e moderno, faixas em gradiente com cantos arredondados (inspirado no template Dentista)
const layout = {
  id: 'aurora',
  nome: 'Aurora',
  descricao: 'Claro e moderno, faixas em gradiente com cantos curvos',
  ordem: 1,
  tema: 'claro',
  topo: 'dividido',
  topoSemFoto: 'dividido',
  faixa: false,
  setores: ['dentista', 'clinica', 'nutricionista', 'escola', 'loja', 'outro'],
  fontes: { titulo: 'Montserrat', corpo: 'Inter', pesoTitulo: 800 },
  css: `
.lay-aurora{--raio:20px;--raio-img:32px;--h1:clamp(2.4rem,5.4vw,4.1rem);--ls:-.025em}
.lay-aurora .b-topo{background:radial-gradient(60% 70% at 100% 0%,var(--p-suave),transparent 70%),radial-gradient(50% 60% at 0% 100%,color-mix(in srgb,var(--s) 12%,transparent),transparent 70%)}
.lay-aurora .topo-media{position:relative}
.lay-aurora .topo-media::before{content:"";position:absolute;inset:8% -6% -6% 8%;border-radius:var(--raio-img);background:linear-gradient(135deg,var(--p),var(--s));opacity:.9;z-index:-1}
.lay-aurora .topo-media img{border-radius:var(--raio-img) var(--raio-img) var(--raio-img) 120px}
.lay-aurora .b-numeros{background:transparent;color:var(--tx);padding-top:0}
.lay-aurora .grade-num{background:var(--card);border:1px solid var(--linha);border-radius:24px;padding:2rem;box-shadow:0 30px 60px -40px rgba(20,30,60,.35)}
.lay-aurora .num b{color:var(--p)}
.lay-aurora .num span{color:var(--tx2);opacity:1}
.lay-aurora .b-servicos{background:linear-gradient(135deg,var(--p),var(--s));color:var(--on-p);border-radius:56px 56px 0 0;margin-top:1rem}
.lay-aurora .b-servicos .etiqueta,.lay-aurora .b-servicos h2 em{color:inherit;opacity:.85}
.lay-aurora .b-servicos .cab{margin-inline:auto;text-align:center}
.lay-aurora .b-servicos .intro{color:inherit;opacity:.85}
.lay-aurora .b-servicos .serv{background:#fff;color:#16181d;border:0;box-shadow:0 20px 40px -24px rgba(0,0,0,.35)}
.lay-aurora .b-servicos .serv p{color:#5b6270}
.lay-aurora .b-servicos .serv-n{width:46px;height:46px;border-radius:14px;display:grid;place-items:center;border:2px solid var(--p);color:var(--p);margin-bottom:.4rem}
.lay-aurora .b-diferenciais{background:var(--bg)}
.lay-aurora .ico{border-radius:50%;background:linear-gradient(135deg,var(--p),var(--s));color:var(--on-p)}
.lay-aurora .passo-n{background:linear-gradient(135deg,var(--p),var(--s))}
.lay-aurora .b-historia{background:var(--bg)}
.lay-aurora .hist-media img,.lay-aurora .mono-hist{border-radius:var(--raio-img) 120px var(--raio-img) var(--raio-img)}
.lay-aurora .b-depoimentos .depo{background:color-mix(in srgb,var(--p) 6%,var(--card));border:0}
.lay-aurora .b-cta{padding:0}
.lay-aurora .cta-box{border-radius:56px 56px 0 0;padding-block:clamp(4rem,9vw,6.5rem)}
.lay-aurora .b-cta .wrap{width:100%}
.lay-aurora .b-faq .faq details[open]{background:linear-gradient(135deg,var(--p),var(--s));color:var(--on-p);border-color:transparent}
.lay-aurora .b-faq .faq details[open] p{color:inherit;opacity:.9}
.lay-aurora .b-faq .faq details[open] summary i{background:rgba(255,255,255,.25);color:inherit}
.lay-aurora .rodape{--rod-bg:color-mix(in srgb,var(--p) 85%,#000)}
.tema-escuro.lay-aurora .b-servicos .serv,.tema-grafite.lay-aurora .b-servicos .serv{background:var(--card);color:var(--tx)}
@media (max-width:900px){.lay-aurora .b-servicos,.lay-aurora .cta-box{border-radius:32px 32px 0 0}.lay-aurora .topo-media::before{inset:6% -3% -3% 6%}}
`,
};
export default layout;
