// Pulso — títulos condensados em itálico, faixas inclinadas e números enormes.
// Para academias, esportes, lutas e serviços rápidos. A inclinação aparece só nas faixas de cor.
const layout = {
  id: 'pulso',
  nome: 'Pulso',
  descricao: 'Esportivo e veloz, títulos itálicos e faixas inclinadas',
  ordem: 12,
  tema: 'grafite',
  topo: 'fundo',
  topoSemFoto: 'dividido',
  faixa: true,
  setores: ['academia', 'esporte', 'oficina', 'outro'],
  fontes: { titulo: 'Barlow Condensed', corpo: 'Barlow', pesoTitulo: 800, eixos: { 'Barlow Condensed': 'ital,wght@0,600;0,800;1,700;1,800' } },
  css: `
.lay-pulso{--tt:uppercase;--ls:-.01em;--h1:clamp(3rem,8vw,6.4rem);--h2:clamp(2.2rem,5vw,3.8rem);--raio:4px;--raio-img:4px;--raio-btn:4px}
.lay-pulso h1,.lay-pulso h2{font-style:italic;line-height:.92}
.lay-pulso h1 em,.lay-pulso h2 em{font-style:italic;color:var(--p)}
.lay-pulso .btn{text-transform:uppercase;letter-spacing:.04em;font-style:italic;transform:skewX(-8deg)}
.lay-pulso .btn > *{transform:skewX(8deg)}
.lay-pulso .linha,.lay-pulso .etiqueta{color:var(--p)}
.lay-pulso .faixa{transform:rotate(-2deg) scale(1.04);margin-block:-1rem;position:relative;z-index:2;font-style:italic;font-size:1.6rem}
.lay-pulso .topo-mono{background:linear-gradient(115deg,var(--p) 0 58%,var(--s) 58%)}
.lay-pulso .b-numeros{background:var(--p);color:var(--on-p);clip-path:polygon(0 6%,100% 0,100% 94%,0 100%);padding-block:clamp(4rem,8vw,6rem)}
.lay-pulso .num b{font-size:clamp(3.2rem,8vw,5.6rem);font-style:italic}
.lay-pulso .serv{border:0;border-left:4px solid var(--p);background:var(--card)}
.lay-pulso .serv-n{font-family:var(--ft);font-style:italic;font-size:2.2rem;line-height:1}
.lay-pulso .ico{background:var(--p);color:var(--on-p);transform:skewX(-8deg);border-radius:4px}
.lay-pulso .passo-n{border-radius:4px;transform:skewX(-8deg);font-style:italic}
.lay-pulso .b-cta{clip-path:polygon(0 0,100% 5%,100% 100%,0 100%)}
.lay-pulso .cta-box{background:var(--p);color:var(--on-p)}
.lay-pulso .cta-box .btn-p{background:var(--tx);color:var(--bg)}
.lay-pulso .depo{border-top:4px solid var(--p)}
@media (max-width:600px){.lay-pulso .faixa{transform:rotate(-2deg) scale(1.08)}.lay-pulso .b-numeros{clip-path:polygon(0 3%,100% 0,100% 97%,0 100%)}}
`,
};
export default layout;
