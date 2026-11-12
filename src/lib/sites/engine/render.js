// Renderizador: documento do site (JSON) → HTML completo.
// Os "visuais" (layouts) ficam em ./layouts/*.js e só mudam CSS, fontes e variações de topo.
// Contrato do layout: veja ./layouts/LEIA-ME.md
import { esc, iniciais } from './util.js';
import L0 from './layouts/aurora.js';
import L1 from './layouts/brasa.js';
import L2 from './layouts/chave.js';
import L3 from './layouts/clinica.js';
import L4 from './layouts/lex.js';
import L5 from './layouts/oficio.js';
import L6 from './layouts/patas.js';
import L7 from './layouts/sabor.js';
import L8 from './layouts/serena.js';
import L9 from './layouts/vitrine.js';
import L10 from './layouts/atelier.js';
import L11 from './layouts/pulso.js';
import L12 from './layouts/maison.js';
import L13 from './layouts/noite.js';
import L14 from './layouts/horizonte.js';
import L15 from './layouts/integra.js';
import { FUNDOS_PALETAS, PALETAS, listaPaletas } from './paletas.js';

const LAYOUTS = Object.fromEntries([L0, L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, L11, L12, L13, L14, L15].map((l) => [l.id, l]));
const listaLayouts = () => Object.values(LAYOUTS).sort((a, b) => (a.ordem || 99) - (b.ordem || 99))
  .map(({ id, nome, descricao, tema, setores, fontes }) => ({ id, nome, descricao, escuro: ['escuro', 'grafite', 'marca', 'tech', 'galaxia', 'oceano'].includes(tema), setores: setores || [], fonte: fontes.titulo }));

// ---------- cores ----------
function hexRgb(h) {
  h = String(h || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminancia(h) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = hexRgb(h);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const sobre = (h) => ((luminancia(h) + 0.05) / 0.05 >= 1.05 / (luminancia(h) + 0.05) ? '#0b0b0c' : '#ffffff');
const rgba = (h, a) => `rgba(${hexRgb(h).join(',')},${a})`;

// Temas de fundo (o editor oferece 5)
const TEMAS = {
  claro: { nome: 'Claro', bg: '#ffffff', bg2: '#f5f6f8', tx: '#121417', tx2: '#5b6270', linha: 'rgba(15,20,30,.10)', card: '#ffffff', escuro: false },
  creme: { nome: 'Creme', bg: '#fbf7f1', bg2: '#f3ece1', tx: '#231c15', tx2: '#6e6255', linha: 'rgba(60,40,20,.12)', card: '#fffdf9', escuro: false },
  escuro: { nome: 'Escuro', bg: '#0c0d10', bg2: '#14161b', tx: '#f4f4f5', tx2: '#a1a1aa', linha: 'rgba(255,255,255,.10)', card: '#17191f', escuro: true },
  grafite: { nome: 'Grafite', bg: '#1a1d23', bg2: '#22262e', tx: '#eef0f3', tx2: '#a7aeba', linha: 'rgba(255,255,255,.10)', card: '#262a33', escuro: true },
  marca: { nome: 'Cor da marca', bg: null, bg2: null, tx: '#ffffff', tx2: 'rgba(255,255,255,.75)', linha: 'rgba(255,255,255,.16)', card: null, escuro: true },
  ...FUNDOS_PALETAS,
};
function misturar(h, alvo, t) {
  const a = hexRgb(h), b = hexRgb(alvo);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function temaVars(nomeTema, cores) {
  const t = { ...TEMAS[nomeTema] || TEMAS.claro };
  if (nomeTema === 'marca') {
    t.bg = misturar(cores.primaria, '#000000', 0.72);
    t.bg2 = misturar(cores.primaria, '#000000', 0.62);
    t.card = misturar(cores.primaria, '#000000', 0.52);
  }
  return t;
}

// ---------- ícones ----------
const I = {
  whats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.03c-.25.69-1.44 1.32-1.98 1.37-.5.05-1.13.07-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.78-.36h.56c.18 0 .42-.07.65.5.25.58.83 2.01.9 2.15.07.15.12.32.02.51-.1.19-.14.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.3-.13.59.17.29.74 1.22 1.59 1.98 1.09.97 2.01 1.27 2.3 1.42.29.14.46.12.63-.07.17-.19.73-.85.92-1.15.19-.29.39-.24.65-.14.27.1 1.69.8 1.98.94.29.15.48.22.56.34.07.12.07.69-.18 1.38Z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  relogio: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  tel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"/></svg>',
  estrela: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
  insta: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  seta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};
const estrelas = (n = 5) => `<span class="estrelas" aria-label="${n} estrelas">${I.estrela.repeat(Math.max(1, Math.min(5, Math.round(n))))}</span>`;

// Destaca palavras do título (<em>)
function destacar(txt, palavras) {
  let h = esc(txt);
  for (const p of (palavras || []).filter(Boolean).sort((a, b) => b.length - a.length)) {
    const pe = esc(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    h = h.replace(new RegExp(`(^|[^\\p{L}>])(${pe})(?=$|[^\\p{L}<])`, 'iu'), '$1<em>$2</em>');
  }
  return h;
}
const paragrafos = (t) => String(t || '').split(/\n\s*\n/).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

function linkContato(n) {
  if (n.whatsapp) return { href: `https://wa.me/${n.whatsapp}?text=${encodeURIComponent('Olá! Vim pelo site e gostaria de mais informações.')}`, whats: true };
  const d = String(n.telefone || '').replace(/\D/g, '');
  if (d) return { href: `tel:${d}`, whats: false };
  return { href: '#contato', whats: false };
}

function cabecalho(d, extra = '') {
  return `<div class="cab rv">${d.etiqueta ? `<p class="etiqueta">${esc(d.etiqueta)}</p>` : ''}${d.titulo ? `<h2>${destacar(d.titulo, d.destaques)}</h2>` : ''}${d.intro ? `<p class="intro">${esc(d.intro)}</p>` : ''}${extra}</div>`;
}

// ---------- blocos ----------
function renderBloco(b, ctx) {
  const { doc, L, midia, contato, fotos } = ctx;
  const d = b.dados || {};
  const n = doc.negocio;
  const btnP = (rotulo, cls = '') => `<a class="btn btn-p ${cls}" href="${esc(contato.href)}" target="_blank" rel="noopener">${contato.whats ? I.whats : I.tel}<span>${esc(rotulo || 'Falar no WhatsApp')}</span></a>`;
  const at = `data-bloco="${esc(b.id)}" data-tipo="${b.tipo}"`;

  switch (b.tipo) {
    case 'topo': {
      const capa = fotos.capa;
      const midiaHtml = capa
        ? `<div class="topo-media"><img src="${esc(midia(capa))}" alt="${esc(n.nome)}" fetchpriority="high"></div>`
        : `<div class="topo-media topo-mono" aria-hidden="true"><span>${esc(iniciais(n.nome))}</span></div>`;
      return `<section class="b-topo topo--${capa ? L.topo || 'dividido' : (L.topoSemFoto || 'dividido')}" id="inicio" ${at}>
  ${capa && (L.topo === 'fundo') ? `<div class="topo-fundo" aria-hidden="true"><img src="${esc(midia(capa))}" alt=""></div>` : ''}
  <div class="wrap topo-wrap">
    <div class="topo-txt">
      ${d.linhaCima ? `<p class="linha">${esc(d.linhaCima)}</p>` : ''}
      <h1>${destacar(d.titulo, d.destaques)}</h1>
      ${d.subtitulo ? `<p class="sub">${esc(d.subtitulo)}</p>` : ''}
      <div class="acoes">${btnP(d.botao)}${d.botao2 ? `<a class="btn btn-g" href="#servicos"><span>${esc(d.botao2)}</span>${I.seta}</a>` : ''}</div>
      ${d.provas?.length ? `<ul class="provas">${d.provas.map((p, i) => `<li>${i === 0 && n.nota ? estrelas(n.nota) : ''}${esc(p)}</li>`).join('')}</ul>` : ''}
    </div>
    ${L.topo === 'fundo' && capa ? '' : midiaHtml}
  </div>
</section>${L.faixa ? faixa(doc) : ''}`;
    }
    case 'numeros':
      return `<section class="b-numeros" ${at}><div class="wrap grade-num">${(d.itens || []).map((it) => `<div class="num rv"><b data-contar="${esc(it.valor)}">${esc(it.valor)}</b><span>${esc(it.rotulo)}</span></div>`).join('')}</div></section>`;
    case 'servicos': {
      const itens = d.itens || [];
      return `<section class="b-servicos sec" id="servicos" ${at}><div class="wrap">${cabecalho(d)}
  <div class="grade-serv n${Math.min(itens.length, 4)}" data-n="${itens.length}">${itens.map((it, i) => `<article class="card serv rv">${it.foto ? `<div class="serv-foto"><img src="${esc(midia(it.foto))}" alt="${esc(it.titulo)}" loading="lazy"></div>` : ''}<span class="serv-n">${String(i + 1).padStart(2, '0')}</span><h3>${esc(it.titulo)}</h3><p>${esc(it.texto)}</p><a class="serv-link" href="${esc(contato.href)}" target="_blank" rel="noopener">Saber mais ${I.seta}</a></article>`).join('')}</div>
</div></section>`;
    }
    case 'diferenciais':
      return `<section class="b-diferenciais sec sec-alt" ${at}><div class="wrap dif-wrap">${cabecalho(d)}
  <div class="grade-dif">${(d.itens || []).map((it) => `<div class="dif rv"><i class="ico">${I.check}</i><div><h3>${esc(it.titulo)}</h3><p>${esc(it.texto)}</p></div></div>`).join('')}</div>
</div></section>`;
    case 'passos':
      return `<section class="b-passos sec" ${at}><div class="wrap">${cabecalho(d)}
  <ol class="passos">${(d.itens || []).map((it, i) => `<li class="rv"><span class="passo-n">${i + 1}</span><h3>${esc(it.titulo)}</h3><p>${esc(it.texto)}</p></li>`).join('')}</ol>
</div></section>`;
    case 'pacotes':
      return `<section class="b-pacotes sec sec-alt" ${at}><div class="wrap">${cabecalho(d)}
  <div class="grade-pac">${(d.itens || []).map((it) => `<div class="card pac rv${it.destaque ? ' pac-dest' : ''}">${it.destaque ? '<span class="selo-pac">Mais pedido</span>' : ''}<h3>${esc(it.nome)}</h3><p>${esc(it.descricao || '')}</p><ul>${(it.itens || []).map((x) => `<li>${I.check}${esc(x)}</li>`).join('')}</ul>${btnP('Falar no WhatsApp', 'btn-bloco')}</div>`).join('')}</div>
</div></section>`;
    case 'galeria': {
      const lista = (d.fotos?.length ? d.fotos : fotos.galeria).slice(0, 8);
      if (!lista.length) return ctx.editor ? `<section class="b-galeria sec vazio-ed" ${at}><div class="wrap">${cabecalho(d)}<p class="aviso-ed">Sem fotos ainda — adicione em Fotos.</p></div></section>` : '';
      return `<section class="b-galeria sec" ${at}><div class="wrap">${cabecalho(d)}
  <div class="galeria g${Math.min(lista.length, 6)}">${lista.map((f, i) => `<figure class="rv"><img src="${esc(midia(f))}" alt="${esc(n.nome)} — foto ${i + 1}" loading="lazy"></figure>`).join('')}</div>
</div></section>`;
    }
    case 'historia': {
      const f = d.foto || fotos.historia;
      return `<section class="b-historia sec sec-alt" id="sobre" ${at}><div class="wrap hist-wrap">
  <div class="hist-media rv">${f ? `<img src="${esc(midia(f))}" alt="${esc(n.nome)}" loading="lazy">` : `<div class="mono-hist"><span>${esc(iniciais(n.nome))}</span></div>`}</div>
  <div class="hist-txt">${cabecalho(d)}<div class="rv">${paragrafos(d.texto)}</div></div>
</div></section>`;
    }
    case 'depoimentos':
      return `<section class="b-depoimentos sec" id="depoimentos" ${at}><div class="wrap">${cabecalho(d)}
  <div class="grade-depo">${(d.itens || []).map((it) => `<figure class="card depo rv">${estrelas(it.nota || 5)}<blockquote>“${esc(it.texto)}”</blockquote><figcaption><span class="av">${esc(iniciais(it.nome) || '★')}</span>${esc(it.nome)}</figcaption></figure>`).join('')}</div>
</div></section>`;
    case 'faq':
      return `<section class="b-faq sec sec-alt" ${at}><div class="wrap faq-wrap">${cabecalho(d)}
  <div class="faq">${(d.itens || []).map((it, i) => `<details class="rv"${i === 0 ? ' open' : ''}><summary>${esc(it.pergunta)}<i>${I.mais}</i></summary><p>${esc(it.resposta)}</p></details>`).join('')}</div>
</div></section>`;
    case 'cta':
      return `<section class="b-cta" ${at}><div class="wrap"><div class="cta-box rv"><h2>${destacar(d.titulo, d.destaques)}</h2>${d.texto ? `<p>${esc(d.texto)}</p>` : ''}${btnP(d.botao)}</div></div></section>`;
    case 'contato': {
      const mapa = `https://maps.google.com/maps?q=${encodeURIComponent(n.lat && n.lng ? `${n.lat},${n.lng}` : `${n.nome}, ${n.endereco}`)}&z=16&output=embed`;
      const horas = (n.horarios || []).map((h) => { const i = h.indexOf(':'); return i > 0 ? [h.slice(0, i).replace('-feira', ''), h.slice(i + 1).trim()] : [h, '']; });
      return `<section class="b-contato sec" id="contato" ${at}><div class="wrap">${cabecalho(d)}
  <div class="contato-grade">
    <div class="contato-info rv">
      ${n.endereco ? `<div class="ci">${I.pin}<div><small>Endereço</small><p>${esc(n.endereco)}</p>${n.mapa ? `<a href="${esc(n.mapa)}" target="_blank" rel="noopener">Como chegar ${I.seta}</a>` : ''}</div></div>` : ''}
      ${n.telefone ? `<div class="ci">${contato.whats ? I.whats : I.tel}<div><small>${contato.whats ? 'WhatsApp' : 'Telefone'}</small><p><a href="${esc(contato.href)}" target="_blank" rel="noopener">${esc(n.telefone)}</a></p></div></div>` : ''}
      ${n.instagram ? `<div class="ci">${I.insta}<div><small>Instagram</small><p><a href="https://instagram.com/${esc(n.instagram.replace('@', ''))}" target="_blank" rel="noopener">${esc(n.instagram)}</a></p></div></div>` : ''}
      ${horas.length ? `<div class="ci">${I.relogio}<div><small>Horário</small><dl class="horas">${horas.map(([a, b2]) => `<div><dt>${esc(a.replace(/^\w/, (c) => c.toUpperCase()))}</dt><dd>${esc(b2)}</dd></div>`).join('')}</dl></div></div>` : ''}
      ${btnP(doc.blocos.find((x) => x.tipo === 'topo')?.dados?.botao, 'btn-bloco')}
    </div>
    <div class="mapa rv"><iframe src="${esc(mapa)}" loading="lazy" title="Mapa" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
  </div>
</div></section>`;
    }
    default: return '';
  }
}

function faixa(doc) {
  const serv = doc.blocos.find((b) => b.tipo === 'servicos')?.dados?.itens?.map((i) => i.titulo) || [];
  if (!serv.length) return '';
  const linha = serv.map((s) => `<span>${esc(s)}</span><i>✦</i>`).join('');
  return `<div class="faixa" aria-hidden="true"><div class="faixa-trilho">${linha}${linha}${linha}</div></div>`;
}

// ---------- CSS base (estrutura). Visual fica no layout. ----------
const CSS_BASE = `
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{background:var(--bg);color:var(--tx);font-family:var(--fc);font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden}
main{overflow-x:clip}
img{display:block;max-width:100%}
a{color:inherit}
.wrap{width:min(var(--larg,1160px),100% - 40px);margin-inline:auto}
h1,h2,h3{font-family:var(--ft);font-weight:var(--pt);line-height:1.08;letter-spacing:var(--ls,-.015em);text-transform:var(--tt,none);text-wrap:balance}
h1{font-size:var(--h1,clamp(2.5rem,6vw,4.6rem))}
h2{font-size:var(--h2,clamp(1.9rem,4vw,3rem))}
h3{font-size:1.2rem;line-height:1.25}
h1 em,h2 em{font-style:var(--em-estilo,normal);color:var(--em-cor,var(--p))}
.etiqueta,.linha{font-size:.78rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--etq-cor,var(--p));margin-bottom:1rem}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.6rem;padding:1rem 1.6rem;border-radius:var(--raio-btn,999px);font-weight:700;font-size:1rem;text-decoration:none;transition:transform .18s,box-shadow .18s,background .18s;cursor:pointer;border:0;line-height:1.1}
.btn svg{width:20px;height:20px;flex:none}
.btn-p{background:var(--p);color:var(--on-p);box-shadow:0 10px 28px -12px var(--p)}
.btn-p:hover{transform:translateY(-2px)}
.btn-g{border:1.5px solid var(--linha-forte);color:var(--tx)}
.btn-g:hover{border-color:var(--tx)}
.btn-bloco{width:100%;margin-top:1.4rem}
.estrelas{display:inline-flex;color:#f5b301;gap:1px}.estrelas svg{width:16px;height:16px}
.sec{padding:var(--pad,clamp(4rem,9vw,7rem)) 0}
.sec-alt{background:var(--bg2)}
.cab{max-width:46rem;margin-bottom:clamp(2rem,4vw,3rem)}
.cab .intro{color:var(--tx2);font-size:1.1rem;margin-top:1rem}
.card{background:var(--card);border:1px solid var(--linha);border-radius:var(--raio,16px)}
/* nav */
.nav{position:sticky;top:0;z-index:40;background:var(--nav-bg);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--linha)}
.nav .wrap{display:flex;align-items:center;justify-content:space-between;height:72px;gap:1rem}
.marca{font-family:var(--ft);font-weight:var(--pt);font-size:1.25rem;text-decoration:none;text-transform:var(--tt,none);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%}
.nav-links{display:flex;gap:1.8rem;font-size:.95rem}
.nav-links a{text-decoration:none;color:var(--tx2);transition:color .15s}.nav-links a:hover{color:var(--tx)}
.nav .btn{padding:.7rem 1.2rem;font-size:.9rem}
.nav-tog{display:none;background:none;border:0;color:var(--tx);width:44px;height:44px}
.nav-tog svg{width:26px;height:26px}
/* topo */
.b-topo{position:relative;overflow:hidden}
.topo-wrap{display:grid;grid-template-columns:1.08fr .92fr;gap:clamp(2rem,5vw,4.5rem);align-items:center;padding:clamp(3rem,8vw,6.5rem) 0}
.topo-txt .sub{font-size:1.15rem;color:var(--tx2);margin:1.4rem 0 2.1rem;max-width:34em}
.acoes{display:flex;flex-wrap:wrap;gap:.8rem}
.provas{list-style:none;display:flex;flex-wrap:wrap;gap:.5rem 1.4rem;margin-top:2rem;font-size:.92rem;color:var(--tx2)}
.provas li{display:flex;align-items:center;gap:.45rem}
.topo-media img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--raio-img,24px)}
.topo-mono{aspect-ratio:4/5;border-radius:var(--raio-img,24px);background:radial-gradient(120% 90% at 85% 100%,var(--p) 0,transparent 60%),linear-gradient(160deg,var(--s) -40%,var(--mono-bg,#0f1115) 70%);display:grid;place-items:center;overflow:hidden}
.topo-mono span{font-family:var(--ft);font-weight:var(--pt);font-size:clamp(5rem,13vw,10rem);color:rgba(255,255,255,.92);letter-spacing:-.04em;line-height:1}
.topo--fundo{color:#fff;min-height:min(92vh,860px);display:flex;align-items:center}
.topo--fundo .topo-wrap{grid-template-columns:1fr;max-width:760px;margin-left:max(20px,calc((100% - var(--larg,1160px))/2));position:relative;z-index:2}
.topo--fundo .sub,.topo--fundo .provas{color:rgba(255,255,255,.82)}
.topo--fundo .btn-g{color:#fff;border-color:rgba(255,255,255,.4)}
.topo-fundo{position:absolute;inset:0;z-index:0}
.topo-fundo img{width:100%;height:115%;object-fit:cover}
.topo-fundo::after{content:"";position:absolute;inset:0;background:var(--fundo-veu,linear-gradient(90deg,rgba(0,0,0,.82) 0%,rgba(0,0,0,.55) 55%,rgba(0,0,0,.25) 100%))}
.topo--centro .topo-wrap{grid-template-columns:1fr;text-align:center;justify-items:center}
.topo--centro .acoes,.topo--centro .provas{justify-content:center}
.topo--centro .sub{margin-inline:auto}
.topo--centro .topo-media{width:100%;max-width:900px}
.topo--centro .topo-media img,.topo--centro .topo-mono{aspect-ratio:16/8}
/* faixa */
.faixa{background:var(--faixa-bg,var(--p));color:var(--faixa-tx,var(--on-p));overflow:hidden;padding:1rem 0;white-space:nowrap;font-family:var(--ft);font-weight:var(--pt);text-transform:uppercase;font-size:1.25rem;letter-spacing:.02em}
.faixa-trilho{display:inline-flex;gap:1.6rem;align-items:center;animation:faixa 40s linear infinite}
.faixa i{font-style:normal;opacity:.7}
@keyframes faixa{to{transform:translateX(-33.33%)}}
/* números */
.b-numeros{padding:clamp(2.5rem,5vw,3.5rem) 0;background:var(--num-bg,var(--p));color:var(--num-tx,var(--on-p))}
.grade-num{display:grid;grid-template-columns:repeat(4,1fr);gap:1.5rem;text-align:center}
.num b{display:block;font-family:var(--ft);font-weight:var(--pt);font-size:clamp(2.2rem,5vw,3.2rem);line-height:1}
.num span{font-size:.92rem;opacity:.85}
/* serviços */
.grade-serv{display:grid;grid-template-columns:repeat(3,1fr);gap:1.2rem}
.grade-serv.n2,.grade-serv.n4{grid-template-columns:repeat(2,1fr)}
.serv{padding:1.9rem;display:flex;flex-direction:column;gap:.6rem;transition:transform .2s,box-shadow .2s}
.serv:hover{transform:translateY(-4px);box-shadow:0 22px 40px -28px rgba(0,0,0,.45)}
.serv-foto{margin:-1.9rem -1.9rem .8rem;aspect-ratio:16/10;overflow:hidden;border-radius:var(--raio,16px) var(--raio,16px) 0 0}
.serv-foto img{width:100%;height:100%;object-fit:cover}
.serv-n{font-family:var(--ft);font-weight:var(--pt);color:var(--p);font-size:1rem}
.serv p{color:var(--tx2);font-size:.98rem;flex:1}
.serv-link{font-weight:700;font-size:.9rem;text-decoration:none;color:var(--p);display:inline-flex;align-items:center;gap:.35rem}
.serv-link svg{width:16px;height:16px}
/* diferenciais */
.grade-dif{display:grid;grid-template-columns:repeat(2,1fr);gap:1.6rem 2.4rem}
.dif{display:flex;gap:1rem;align-items:flex-start}
.ico{flex:none;width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--p-suave);color:var(--p)}
.ico svg{width:22px;height:22px}
.dif p{color:var(--tx2);font-size:.98rem;margin-top:.25rem}
/* passos */
.passos{list-style:none;display:grid;grid-template-columns:repeat(3,1fr);gap:1.4rem;counter-reset:p}
.passos li{position:relative;padding-top:.4rem}
.passo-n{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:var(--p);color:var(--on-p);font-family:var(--ft);font-weight:var(--pt);font-size:1.3rem;margin-bottom:1.1rem}
.passos p{color:var(--tx2);margin-top:.35rem}
/* pacotes */
.grade-pac{display:grid;grid-template-columns:repeat(3,1fr);gap:1.2rem;align-items:start}
.pac{padding:2rem;position:relative}
.pac p{color:var(--tx2);margin:.4rem 0 1rem}
.pac ul{list-style:none;display:grid;gap:.55rem}
.pac li{display:flex;gap:.55rem;font-size:.97rem}.pac li svg{width:18px;height:18px;color:var(--p);flex:none;margin-top:.2rem}
.pac-dest{border:2px solid var(--p)}
.selo-pac{position:absolute;top:-12px;left:2rem;background:var(--p);color:var(--on-p);font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:.3rem .7rem;border-radius:999px}
/* galeria */
.galeria{display:grid;grid-template-columns:repeat(3,1fr);gap:.9rem}
.galeria figure{overflow:hidden;border-radius:var(--raio,16px)}
.galeria img{width:100%;height:100%;aspect-ratio:1;object-fit:cover;transition:transform .5s}
.galeria figure:hover img{transform:scale(1.05)}
.galeria.g1{grid-template-columns:1fr}.galeria.g2,.galeria.g4{grid-template-columns:repeat(2,1fr)}
.galeria.g5 figure:first-child,.galeria.g3 figure:first-child{grid-row:span 2}
.galeria.g5 figure:first-child img,.galeria.g3 figure:first-child img{aspect-ratio:auto}
/* história */
.hist-wrap{display:grid;grid-template-columns:.9fr 1.1fr;gap:clamp(2rem,6vw,5rem);align-items:center}
.hist-media img,.mono-hist{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:var(--raio-img,24px)}
.mono-hist{display:grid;place-items:center;background:linear-gradient(150deg,var(--p),var(--s))}
.mono-hist span{font-family:var(--ft);font-weight:var(--pt);font-size:7rem;color:rgba(255,255,255,.9)}
.hist-txt p{color:var(--tx2);font-size:1.08rem;margin-bottom:1rem}
.hist-txt .cab{margin-bottom:1.4rem}
/* depoimentos */
.grade-depo{display:grid;grid-template-columns:repeat(3,1fr);gap:1.2rem}
.depo{padding:1.8rem;display:flex;flex-direction:column;gap:1rem}
.depo blockquote{font-size:1.02rem;flex:1}
.depo figcaption{display:flex;align-items:center;gap:.7rem;font-weight:700;font-size:.95rem}
.av{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--p-suave);color:var(--p);font-size:.85rem}
/* faq */
.faq-wrap{display:grid;grid-template-columns:.8fr 1.2fr;gap:clamp(2rem,5vw,4rem);align-items:start}
.faq{display:grid;gap:.7rem}
.faq details{background:var(--card);border:1px solid var(--linha);border-radius:var(--raio,16px);padding:0 1.4rem}
.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:1rem;align-items:center;padding:1.2rem 0;font-weight:700}
.faq summary::-webkit-details-marker{display:none}
.faq summary i{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--p-suave);color:var(--p);transition:transform .25s}
.faq summary i svg{width:16px;height:16px}
.faq details[open] summary i{transform:rotate(45deg)}
.faq details p{color:var(--tx2);padding-bottom:1.3rem}
/* cta */
.b-cta{padding:clamp(3rem,7vw,5rem) 0}
.cta-box{background:var(--cta-bg,linear-gradient(135deg,var(--p),var(--s)));color:var(--cta-tx,var(--on-p));border-radius:var(--raio-cta,28px);padding:clamp(2.5rem,6vw,4.5rem);text-align:center;display:grid;justify-items:center;gap:1rem}
.cta-box h2 em{color:inherit;text-decoration:underline;text-underline-offset:.15em}
.cta-box p{opacity:.88;font-size:1.12rem;max-width:34em}
.cta-box .btn-p{background:var(--cta-btn,#fff);color:var(--cta-btn-tx,#111);margin-top:.6rem}
/* contato */
.contato-grade{display:grid;grid-template-columns:1fr 1.15fr;gap:clamp(1.5rem,4vw,3rem)}
.contato-info{display:grid;gap:1.5rem;align-content:start}
.ci{display:flex;gap:1rem}
.ci>svg{width:22px;height:22px;flex:none;color:var(--p);margin-top:.15rem}
.ci small{display:block;font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--tx2)}
.ci a{color:var(--p);font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:.3rem}
.ci a svg{width:16px;height:16px}
.horas{display:grid;gap:.15rem;min-width:240px}
.horas div{display:flex;justify-content:space-between;gap:1rem;border-bottom:1px dashed var(--linha);padding:.2rem 0;font-size:.95rem}
.horas dd{color:var(--tx2)}
.mapa iframe{width:100%;height:100%;min-height:400px;border:0;border-radius:var(--raio,16px)}
/* rodapé */
.rodape{background:var(--rod-bg,#0b0c0f);color:rgba(255,255,255,.65);font-size:.9rem;padding:2.2rem 0}
.rodape .wrap{display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem}
.rodape b{color:#fff;font-family:var(--ft);font-weight:var(--pt)}
.rodape a{color:rgba(255,255,255,.85)}
/* flutuante + progresso */
.flutuante{position:fixed;right:18px;bottom:18px;z-index:50;width:60px;height:60px;border-radius:50%;background:#25d366;color:#fff;display:grid;place-items:center;box-shadow:0 12px 30px -8px rgba(0,0,0,.5);transition:transform .2s}
.flutuante:hover{transform:scale(1.08)}.flutuante svg{width:32px;height:32px}
.flutuante::before{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid #25d366;animation:pulso 2.2s infinite}
@keyframes pulso{from{transform:scale(1);opacity:.8}to{transform:scale(1.6);opacity:0}}
.progresso{position:fixed;top:0;left:0;height:3px;width:0;background:var(--p);z-index:60}
/* animação de entrada */
.anim .rv{opacity:0;transform:translateY(26px);transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1)}
.anim .rv.on{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.anim .rv{opacity:1;transform:none}.faixa-trilho{animation:none}}
/* ── visuais premium: foto de ponta a ponta no topo, entrada única, fotos que se revelam, zoom suave ── */
.premium.anim .rv{opacity:1;transform:none;transition:none}
.premium .topo--fundo{background:#16181c;min-height:100svh;align-items:flex-end;padding-bottom:clamp(3rem,9vh,7rem)}
.premium .topo-fundo img{height:100%;transform:scale(1.08);transition:transform 1.8s cubic-bezier(.2,.7,.2,1)}
.premium.pronto .topo-fundo img{transform:scale(1)}
.premium .topo-fundo::after{background:var(--fundo-veu,linear-gradient(0deg,rgba(0,0,0,.8) 0%,rgba(0,0,0,.48) 50%,rgba(0,0,0,.3) 100%))}
.premium .topo-txt>*{opacity:0;transform:translateY(28px);transition:opacity .9s ease,transform 1s cubic-bezier(.2,.7,.2,1)}
.premium.pronto .topo-txt>*{opacity:1;transform:none}
.premium .topo-txt>:nth-child(2){transition-delay:.12s}.premium .topo-txt>:nth-child(3){transition-delay:.24s}.premium .topo-txt>:nth-child(4){transition-delay:.36s}.premium .topo-txt>:nth-child(5){transition-delay:.48s}
.premium .foto-rev{clip-path:inset(0 0 100% 0);transition:clip-path 1.2s cubic-bezier(.7,0,.2,1)}
.premium .foto-rev.on{clip-path:inset(0 0 0 0)}
.premium .galeria img,.premium .serv-foto img,.premium .hist-media img{transition:transform .8s cubic-bezier(.2,.7,.2,1)}
.premium .galeria figure:hover img,.premium .serv:hover .serv-foto img,.premium .hist-media:hover img{transform:scale(1.03)}
.premium .btn{transition:transform .15s,background .2s,box-shadow .2s}
.premium .btn:hover{transform:translateY(-2px)}.premium .btn:active{transform:translateY(1px) scale(.98)}
@media (min-width:900px){.premium .grade-serv{grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}}
/* menu transparente por cima da foto do topo; fica sólido ao rolar */
.premium:has(.topo--fundo) .nav{position:fixed;left:0;right:0;background:transparent;border-color:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;transition:background .3s,border-color .3s}
.premium:has(.topo--fundo):not(.rolou) .nav:not(.aberta) :is(.marca,.nav-links a,.nav-tog){color:#fff}
.premium:has(.topo--fundo):not(.rolou) .nav:not(.aberta) .nav-links a{opacity:.85}
.premium.rolou .nav,.premium .nav.aberta{background:var(--nav-bg);border-color:var(--linha);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
/* galeria em composição: uma foto larga, depois pares e trios */
.premium .galeria{grid-template-columns:repeat(6,1fr);gap:clamp(.5rem,1.2vw,1rem)}
.premium .galeria figure{grid-column:span 2;border-radius:var(--raio-img,0)}
.premium .galeria img{aspect-ratio:4/5}
.premium .galeria figure:nth-child(1){grid-column:1/-1}.premium .galeria figure:nth-child(1) img{aspect-ratio:21/9}
.premium .galeria figure:nth-child(2),.premium .galeria figure:nth-child(3){grid-column:span 3}.premium .galeria figure:nth-child(2) img,.premium .galeria figure:nth-child(3) img{aspect-ratio:4/3}
.premium .galeria figure:nth-child(7),.premium .galeria figure:nth-child(8){grid-column:span 3}.premium .galeria figure:nth-child(7) img,.premium .galeria figure:nth-child(8) img{aspect-ratio:3/2}
.premium .galeria.g2 figure:nth-child(2){grid-column:1/-1}
.premium .galeria.g5 figure:first-child{grid-row:auto}.premium .galeria.g3 figure:first-child{grid-row:auto}
.premium .galeria.g3 figure:first-child img,.premium .galeria.g5 figure:first-child img{aspect-ratio:21/9}
@media (max-width:600px){.premium .galeria{grid-template-columns:repeat(2,1fr)}.premium .galeria figure,.premium .galeria figure:nth-child(n){grid-column:span 1}.premium .galeria figure:nth-child(3n+1){grid-column:1/-1}.premium .galeria figure:nth-child(3n+1) img{aspect-ratio:16/10}.premium .galeria figure img{aspect-ratio:4/5}}
@media (prefers-reduced-motion:reduce){.premium .topo-txt>*,.premium .topo-fundo img{opacity:1;transform:none;transition:none}.premium .foto-rev{clip-path:none}}
/* editor */
.vazio-ed{outline:2px dashed var(--linha)}.aviso-ed{color:var(--tx2)}
.ed [data-bloco]{cursor:pointer;transition:outline-color .15s}
.ed [data-bloco]:hover{outline:2px solid rgba(34,197,94,.6);outline-offset:-2px}
.ed [data-bloco].sel{outline:3px solid #22c55e;outline-offset:-3px}
/* responsivo */
@media (max-width:900px){
  .nav-links,.nav .btn{display:none}.nav-tog{display:grid;place-items:center}
  .nav.aberta .nav-links{display:flex;flex-direction:column;position:absolute;top:72px;left:0;right:0;background:var(--bg);padding:1rem 20px 1.5rem;border-bottom:1px solid var(--linha);gap:1rem}
  .topo-wrap,.hist-wrap,.contato-grade,.faq-wrap{grid-template-columns:1fr}
  .topo-media img,.topo-mono{aspect-ratio:4/3}
  .grade-serv,.grade-serv.n4,.grade-pac,.grade-depo{grid-template-columns:repeat(2,1fr)}
  .grade-num{grid-template-columns:repeat(2,1fr)}
  .passos{grid-template-columns:1fr}
  .galeria,.galeria.g4,.galeria.g5,.galeria.g6{grid-template-columns:repeat(2,1fr)}
}
@media (max-width:600px){
  body{font-size:16px}
  .grade-serv,.grade-serv.n2,.grade-serv.n4,.grade-pac,.grade-depo,.grade-dif{grid-template-columns:1fr}
  .acoes .btn{width:100%}
  .topo--fundo{min-height:auto}
  .mapa iframe{min-height:300px}
}
`;

const JS_PAGINA = `
(function(){
var d=document,b=d.body;
var nav=d.querySelector('.nav');d.querySelector('.nav-tog')&&d.querySelector('.nav-tog').addEventListener('click',function(){nav.classList.toggle('aberta')});
d.querySelectorAll('.nav-links a').forEach(function(a){a.addEventListener('click',function(){nav.classList.remove('aberta')})});
if(b.classList.contains('anim')&&'IntersectionObserver' in window){
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('on');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});
  d.querySelectorAll('.rv').forEach(function(el,i){el.style.transitionDelay=(i%4)*70+'ms';io.observe(el)});
}else d.querySelectorAll('.rv').forEach(function(el){el.classList.add('on')});
if(b.dataset.anim==='1'&&'IntersectionObserver' in window){
  var io2=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;io2.unobserve(e.target);var el=e.target,txt=el.dataset.contar,m=txt.match(/^(\\D*)([\\d.,]+)(.*)$/);if(!m)return;var dec=(m[2].split(',')[1]||'').length,alvo=parseFloat(m[2].replace(/\\./g,'').replace(',','.')),t0=null;function f(t){t0=t0||t;var k=Math.min(1,(t-t0)/1400);k=1-Math.pow(1-k,3);el.textContent=m[1]+(alvo*k).toFixed(dec).replace('.',',')+m[3];if(k<1)requestAnimationFrame(f)}requestAnimationFrame(f)})});
  d.querySelectorAll('b[data-contar]').forEach(function(el){io2.observe(el)});
}
if(b.classList.contains('premium')){
  requestAnimationFrame(function(){requestAnimationFrame(function(){b.classList.add('pronto')})});
  var rolar=function(){b.classList.toggle('rolou',scrollY>40)};rolar();addEventListener('scroll',rolar,{passive:true});
  var fotosRev=d.querySelectorAll('.galeria figure,.hist-media,.serv-foto');
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    var pend=[].slice.call(fotosRev);pend.forEach(function(el){el.classList.add('foto-rev')});
    var checar=function(){pend=pend.filter(function(el){if(el.getBoundingClientRect().top<innerHeight*.88){el.classList.add('on');return false}return true})};
    var agendado=0;addEventListener('scroll',function(){if(!agendado){agendado=1;requestAnimationFrame(function(){agendado=0;checar()})}},{passive:true});addEventListener('resize',checar);setTimeout(checar,60);
  }
}
var pr=d.querySelector('.progresso'),px=b.dataset.parallax==='1'?d.querySelector('.topo-fundo img,.topo-media img'):null;
window.addEventListener('scroll',function(){var h=d.documentElement,y=h.scrollTop;if(pr)pr.style.width=(y/(h.scrollHeight-h.clientHeight)*100)+'%';if(px&&y<1200)px.style.transform='translateY('+(y*.18)+'px)'},{passive:true});
})();`;

const JS_EDITOR = `
(function(){
document.body.classList.add('ed');
document.addEventListener('click',function(e){var a=e.target.closest('a');if(a)e.preventDefault();var s=e.target.closest('[data-bloco]');if(!s)return;document.querySelectorAll('[data-bloco].sel').forEach(function(x){x.classList.remove('sel')});s.classList.add('sel');parent.postMessage({tipo:'bloco',id:s.dataset.bloco},'*')},true);
window.addEventListener('message',function(e){if(e.data&&e.data.tipo==='rolar'){var s=document.querySelector('[data-bloco="'+e.data.id+'"]');if(s){s.scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('[data-bloco].sel').forEach(function(x){x.classList.remove('sel')});s.classList.add('sel')}}});
})();`;

// opts: { midia: (url)=>url, editor: bool, beacon: url, rodapeCredito: string }
function render(doc, opts = {}) {
  const L = LAYOUTS[doc.layout] || LAYOUTS.aurora || Object.values(LAYOUTS)[0];
  const midia = opts.midia || ((u) => u);
  const coresDoc = doc.cores || { primaria: '#4f46e5', secundaria: '#06b6d4' };
  const nomeTema = doc.tema && doc.tema !== 'auto' ? doc.tema : (L.tema || 'claro');
  const T = temaVars(nomeTema, coresDoc);
  // Se a cor principal some no fundo (ex.: preto num tema escuro), usa a secundária como destaque.
  const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const cores = nomeTema !== 'marca' && contraste(coresDoc.primaria, T.bg) < 1.9 && contraste(coresDoc.secundaria, T.bg) > contraste(coresDoc.primaria, T.bg)
    ? { primaria: coresDoc.secundaria, secundaria: coresDoc.primaria } : coresDoc;
  const n = doc.negocio || {};
  const lista = (doc.fotos?.lista || []).filter(Boolean);
  const capa = doc.fotos?.capa || lista[0] || '';
  const resto = lista.filter((f) => f !== capa);
  const fotos = { capa, historia: resto[0] || '', galeria: resto.slice(resto.length > 3 ? 1 : 0) };
  const contato = linkContato(n);
  const anim = doc.animacoes || {};
  const ctx = { doc, L, midia, contato, fotos, editor: !!opts.editor };
  const visiveis = (doc.blocos || []).filter((b) => b.visivel !== false);
  const corpo = visiveis.map((b) => renderBloco(b, ctx)).join('\n');
  const topo = visiveis.find((b) => b.tipo === 'topo')?.dados || {};
  const links = [['servicos', 'Serviços'], ['sobre', 'Sobre'], ['depoimentos', 'Depoimentos'], ['contato', 'Contato']]
    .filter(([id]) => visiveis.some((b) => ({ servicos: 'servicos', sobre: 'historia', depoimentos: 'depoimentos', contato: 'contato' })[id] === b.tipo));
  // a paleta escolhida pode trocar as fontes do visual
  const pal = doc.paleta ? PALETAS.find((p) => p.id === doc.paleta) : null;
  const f = pal ? { ...L.fontes, ...pal.fontes } : L.fontes;
  const fontUrl = `https://fonts.googleapis.com/css2?${[...new Set([f.titulo, f.corpo])].map((fam) => `family=${fam.replace(/ /g, '+')}:${f.eixos?.[fam] || 'wght@400;500;600;700;800'}`).join('&')}&display=swap`;
  const vars = `:root{--p:${cores.primaria};--s:${cores.secundaria};--on-p:${sobre(cores.primaria)};--on-s:${sobre(cores.secundaria)};--p-suave:${rgba(cores.primaria, T.escuro ? 0.18 : 0.1)};
--bg:${T.bg};--bg2:${T.bg2};--tx:${T.tx};--tx2:${T.tx2};--linha:${T.linha};--linha-forte:${T.escuro ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.22)'};--card:${T.card};
--nav-bg:${T.escuro ? rgba(T.bg, 0.82) : 'rgba(255,255,255,.82)'};--ft:'${f.titulo}',${f.tituloFallback || 'system-ui,sans-serif'};--fc:'${f.corpo}',system-ui,sans-serif;--pt:${f.pesoTitulo || 700}}`;
  const titulo = `${n.nome}${n.cidade ? ' — ' + n.cidade : ''}`;
  const descricao = topo.subtitulo || '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<meta property="og:title" content="${esc(n.nome)}">
<meta property="og:description" content="${esc(topo.titulo || descricao)}">
${capa ? `<meta property="og:image" content="${esc(midia(capa))}">` : ''}
<meta name="theme-color" content="${cores.primaria}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontUrl}">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'LocalBusiness', name: n.nome, address: n.endereco, telephone: n.telefone, ...(n.nota ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: n.nota, reviewCount: n.avaliacoes } } : {}) }).replace(/</g, '\\u003c')}</script>
<style>${vars}${CSS_BASE}${L.css}</style>
</head>
<body class="lay-${L.id} tema-${nomeTema}${anim.entrada !== false ? ' anim' : ''}${L.premium ? ' premium' : ''}" data-anim="${anim.contadores !== false ? 1 : 0}" data-parallax="${anim.parallax ? 1 : 0}">
${anim.progresso !== false ? '<div class="progresso"></div>' : ''}
<header class="nav"><div class="wrap">
  <a class="marca" href="#inicio">${esc(n.nome)}</a>
  <nav class="nav-links">${links.map(([id, r]) => `<a href="#${id}">${r}</a>`).join('')}</nav>
  <a class="btn btn-p" href="${esc(contato.href)}" target="_blank" rel="noopener">${contato.whats ? I.whats : I.tel}<span>${contato.whats ? 'WhatsApp' : 'Ligar'}</span></a>
  <button class="nav-tog" aria-label="Menu">${I.menu}</button>
</div></header>
<main>
${corpo}
</main>
<footer class="rodape"><div class="wrap"><span><b>${esc(n.nome)}</b>${n.cidade ? ' · ' + esc(n.cidade) + (n.uf ? ' - ' + esc(n.uf) : '') : ''}</span><span>© ${new Date().getFullYear()} · Todos os direitos reservados${opts.rodapeCredito ? ' · ' + esc(opts.rodapeCredito) : ''}</span></div></footer>
${anim.flutuante !== false && contato.whats ? `<a class="flutuante" href="${esc(contato.href)}" target="_blank" rel="noopener" aria-label="Falar no WhatsApp">${I.whats}</a>` : ''}
<script>${JS_PAGINA}</script>
${opts.editor ? `<script>${JS_EDITOR}</script>` : ''}
${opts.beacon ? `<script>try{navigator.sendBeacon?navigator.sendBeacon(${JSON.stringify(opts.beacon)}):fetch(${JSON.stringify(opts.beacon)},{method:'POST',mode:'no-cors'})}catch(e){}</script>` : ''}
</body>
</html>`;
}

const TEMAS_NOMES = Object.fromEntries(Object.entries(TEMAS).map(([k, v]) => [k, v.nome]));
export { render, listaLayouts, listaPaletas, LAYOUTS, TEMAS_NOMES as TEMAS };
