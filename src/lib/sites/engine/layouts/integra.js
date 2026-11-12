// Integra — clínica de saúde, sóbrio e editorial (modelo "Clínica Integra" enviado pelo usuário):
// fundo claro quente, títulos em serifa com o destaque em itálico cinza, foto ao lado do título,
// especialidades em lista com linhas finas e seta, botões retos na cor da marca, rodapé claro.
const layout = {
  id: 'integra',
  nome: 'Integra',
  descricao: 'Clínica sóbria e editorial: serifa, lista de especialidades com linhas finas',
  ordem: 4,
  premium: true,
  tema: 'claro',
  topo: 'dividido',
  topoSemFoto: 'dividido',
  faixa: false,
  setores: ['clinica', 'dentista', 'fisioterapia', 'psicologia', 'nutricionista', 'veterinario', 'estetica'],
  fontes: { titulo: 'Newsreader', corpo: 'DM Sans', pesoTitulo: 400, tituloFallback: 'Georgia,serif', eixos: { 'Newsreader': 'ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400', 'DM Sans': 'wght@400;500;600;700' } },
  css: `
.lay-integra.tema-claro{--bg:#faf9f6;--bg2:#f3f2ed;--card:#ffffff}
.lay-integra{--raio:0px;--raio-img:0px;--raio-btn:2px;--raio-cta:0px;--ls:-.02em;
  --h1:clamp(2.6rem,5.6vw,4.4rem);--h2:clamp(2rem,3.6vw,2.8rem);--em-estilo:italic;--em-cor:var(--tx2);--etq-cor:var(--tx2)}
.lay-integra h1,.lay-integra h2{font-weight:400;line-height:1.06}
.lay-integra h3{font-weight:400}
.lay-integra .linha,.lay-integra .etiqueta{font-family:var(--fc);font-size:.72rem;letter-spacing:.14em;font-weight:700}
.lay-integra .nav{background:color-mix(in srgb,var(--bg) 88%,transparent);border-bottom:0}
.lay-integra .nav .wrap{height:84px}
.lay-integra .marca{font-family:var(--fc);font-weight:700;letter-spacing:-.02em}
.lay-integra .btn{border-radius:var(--raio-btn);padding:1rem 1.45rem;font-weight:600;font-size:.95rem;box-shadow:none}
.lay-integra .btn-p{background:var(--p);color:var(--on-p)}
.lay-integra .btn-p:hover{box-shadow:0 10px 24px -14px var(--p)}
.lay-integra .btn-g{background:transparent;color:var(--tx);border:1px solid var(--linha-forte)}
.lay-integra .b-topo{padding-block:clamp(2.5rem,6vw,4.5rem) clamp(3rem,7vw,5.5rem)}
.lay-integra .topo-wrap{grid-template-columns:1fr 1.08fr;gap:clamp(2rem,6vw,5.5rem);align-items:center}
.lay-integra .topo-txt .sub{font-size:1.08rem;line-height:1.75;max-width:30em}
.lay-integra .topo-media img{aspect-ratio:10/9;border-radius:0}
.lay-integra .topo-mono{border-radius:0;background:var(--bg2)}
.lay-integra .provas{color:var(--tx2);font-size:.85rem}
.lay-integra .sec{padding-block:clamp(4rem,9vw,6.5rem)}
.lay-integra .sec-alt{background:var(--bg)}
.lay-integra .cab{max-width:none}
/* especialidades: lista em duas colunas, linha fina embaixo, seta à direita */
.lay-integra .grade-serv,.lay-integra.premium .grade-serv{grid-template-columns:repeat(2,minmax(0,1fr));gap:0 clamp(2rem,5vw,4rem)}
.lay-integra .serv{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"t l" "p p";gap:.55rem 1rem;padding:1.7rem 0 1.9rem;border:0;border-bottom:1px solid var(--linha);border-radius:0;background:none;box-shadow:none}
.lay-integra .serv:hover{transform:none;box-shadow:none}
.lay-integra .serv-foto,.lay-integra .serv-n{display:none}
.lay-integra .serv h3{grid-area:t;font-size:clamp(1.45rem,2.2vw,1.75rem);line-height:1.15;transition:color .2s}
.lay-integra .serv p{grid-area:p;font-size:.95rem}
.lay-integra .serv-link{grid-area:l;align-self:center;font-size:0;color:var(--tx);transition:transform .2s}
.lay-integra .serv-link svg{width:18px;height:18px}
.lay-integra .serv:hover h3{color:var(--p)}
.lay-integra .serv:hover .serv-link{transform:translateX(4px)}
.lay-integra .b-numeros{background:var(--bg);color:var(--tx);border-block:1px solid var(--linha)}
.lay-integra .num b{font-family:var(--ft);font-weight:400;color:var(--p)}
.lay-integra .num span{color:var(--tx2);opacity:1}
.lay-integra .dif,.lay-integra .depo,.lay-integra .pac{border:0;border-top:1px solid var(--linha-forte);border-radius:0;background:none;box-shadow:none;padding:1.5rem 0 0}
.lay-integra .ico{background:none;color:var(--p);border:1px solid var(--linha-forte);border-radius:50%}
.lay-integra .passo-n{background:none;color:var(--p);border:1px solid var(--p);font-family:var(--ft);border-radius:50%}
.lay-integra .depo p{font-family:var(--ft);font-size:1.2rem;line-height:1.5}
.lay-integra .hist-media img{aspect-ratio:4/5;border-radius:0}
.lay-integra .galeria figure{border-radius:0}
.lay-integra details{border-color:var(--linha)}
.lay-integra .cta-box{background:var(--p);color:var(--on-p);border-radius:0;text-align:left;justify-items:start}
.lay-integra .cta-box .btn-p{background:var(--bg);color:var(--tx)}
.lay-integra .rodape{--rod-bg:var(--bg);color:var(--tx2);border-top:1px solid var(--linha)}
.lay-integra .rodape b{color:var(--tx)}
.lay-integra .rodape a{color:var(--tx)}
@media (max-width:900px){
  .lay-integra .topo-wrap{grid-template-columns:1fr}
  .lay-integra .b-topo{padding-top:1.25rem}
  .lay-integra .topo-media{order:-1}
  .lay-integra .topo-media img{aspect-ratio:4/3}
}
@media (max-width:600px){
  .lay-integra .grade-serv,.lay-integra.premium .grade-serv{grid-template-columns:1fr}
}
`,
};
export default layout;
