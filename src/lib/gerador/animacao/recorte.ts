import "server-only";
import type { Expressao, Personagem } from "./tipos";
import type { OpcoesPersonagem } from "./cartum";

// Estilo "recorte de papel": personagens e cenários planos, como papel cortado e colado.
// Cabeça larga, olhos grandes encostados, corpo curto de casaco, luvas, movimento "picotado" (poucas poses por segundo).
// Personagens são sempre os do elenco do vídeo — nunca cópias de personagens de desenhos existentes.

const LINHA = "#1d1a1a";
const n = (v: number) => Math.round(v * 10) / 10;
const rad = (g: number) => (g * Math.PI) / 180;

function clarear(hex: string, f: number) {
  const v = parseInt(hex.slice(1), 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => Math.max(0, Math.min(255, Math.round(f > 1 ? x + (255 - x) * (f - 1) : x * f))));
  return "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");
}

function rosto(hx: number, hy: number, k: number, expr: Expressao, dir: 1 | -1, t: number, seed: number) {
  const sk = `stroke="${LINHA}" stroke-width="${n(Math.max(2.5, 3.2 * k))}" stroke-linecap="round" stroke-linejoin="round"`;
  const out: string[] = [];
  const pisca = ((t + (seed % 5) * 0.41) % 3.6) < 0.14;
  const feliz = expr === "feliz" || expr === "rindo";
  for (const l of [-1, 1]) {
    const ex = hx + l * 31 * k, ey = hy - 8 * k;
    const ry = expr === "surpreso" ? 46 : expr === "bravo" ? 30 : 40;
    if (pisca || expr === "chorando") out.push(`<ellipse cx="${n(ex)}" cy="${n(ey)}" rx="${n(34 * k)}" ry="${n(ry * k)}" fill="#fff" ${sk}/><path d="M${n(ex - 24 * k)},${n(ey + 4 * k)} Q${n(ex)},${n(ey + 14 * k)} ${n(ex + 24 * k)},${n(ey + 4 * k)}" fill="none" ${sk}/>`);
    else {
      out.push(`<ellipse cx="${n(ex)}" cy="${n(ey)}" rx="${n(34 * k)}" ry="${n(ry * k)}" fill="#fff" ${sk}/>`);
      // pálpebra de cima: cansado/triste/bravo
      if (expr === "triste" || expr === "preocupado") out.push(`<path d="M${n(ex - 33 * k)},${n(ey - 14 * k)} L${n(ex + 33 * k)},${n(ey - 14 * k)} L${n(ex + 33 * k)},${n(ey - ry * k)} L${n(ex - 33 * k)},${n(ey - ry * k)} Z" fill="#d9c2a5" opacity="0.6"/>`);
      const pupila = feliz ? 7 : 6.5;
      out.push(`<circle cx="${n(ex + dir * 8 * k - l * 3 * k)}" cy="${n(ey + 4 * k)}" r="${n(pupila * k)}" fill="${LINHA}"/>`);
    }
    // sobrancelha só nas emoções fortes
    if (expr === "bravo") out.push(`<path d="M${n(ex - l * 4 * k)},${n(ey - 30 * k)} L${n(ex + l * 30 * k)},${n(ey - 46 * k)}" stroke="${LINHA}" stroke-linecap="round" fill="none" stroke-width="${n(6 * k)}"/>`);
    if (expr === "triste" || expr === "preocupado" || expr === "chorando") out.push(`<path d="M${n(ex - l * 4 * k)},${n(ey - 50 * k)} L${n(ex + l * 28 * k)},${n(ey - 40 * k)}" stroke="${LINHA}" stroke-linecap="round" fill="none" stroke-width="${n(5 * k)}"/>`);
    if (expr === "surpreso") out.push(`<path d="M${n(ex - 18 * k)},${n(ey - 58 * k)} Q${n(ex)},${n(ey - 66 * k)} ${n(ex + 18 * k)},${n(ey - 58 * k)}" fill="none" stroke="${LINHA}" stroke-linecap="round" stroke-width="${n(5 * k)}"/>`);
  }
  const mx = hx + dir * 6 * k, my = hy + 48 * k;
  const boca: Record<Expressao, string> = {
    neutro: `<path d="M${n(mx - 14 * k)},${n(my)} L${n(mx + 14 * k)},${n(my)}" ${sk}/>`,
    feliz: `<path d="M${n(mx - 22 * k)},${n(my - 4 * k)} Q${n(mx)},${n(my + 14 * k)} ${n(mx + 22 * k)},${n(my - 4 * k)}" fill="none" ${sk}/>`,
    rindo: `<path d="M${n(mx - 28 * k)},${n(my - 6 * k)} Q${n(mx)},${n(my + 34 * k)} ${n(mx + 28 * k)},${n(my - 6 * k)} Z" fill="#5a1d1d" ${sk}/><path d="M${n(mx - 22 * k)},${n(my - 3 * k)} L${n(mx + 22 * k)},${n(my - 3 * k)}" stroke="#fff" stroke-width="${n(6 * k)}"/>`,
    triste: `<path d="M${n(mx - 18 * k)},${n(my + 6 * k)} Q${n(mx)},${n(my - 8 * k)} ${n(mx + 18 * k)},${n(my + 6 * k)}" fill="none" ${sk}/>`,
    surpreso: `<ellipse cx="${n(mx)}" cy="${n(my + 4 * k)}" rx="${n(10 * k)}" ry="${n(14 * k)}" fill="#5a1d1d" ${sk}/>`,
    bravo: `<path d="M${n(mx - 24 * k)},${n(my + 2 * k)} L${n(mx + 24 * k)},${n(my - 2 * k)} L${n(mx + 20 * k)},${n(my + 10 * k)} L${n(mx - 20 * k)},${n(my + 12 * k)} Z" fill="#fff" ${sk}/>`,
    preocupado: `<path d="M${n(mx - 20 * k)},${n(my + 2 * k)} q${n(5 * k)},${n(-6 * k)} ${n(10 * k)},0 t${n(10 * k)},0 t${n(10 * k)},0 t${n(10 * k)},0" fill="none" ${sk}/>`,
    chorando: `<path d="M${n(mx - 22 * k)},${n(my + 12 * k)} Q${n(mx)},${n(my - 14 * k)} ${n(mx + 22 * k)},${n(my + 12 * k)} Z" fill="#5a1d1d" ${sk}/>`,
  };
  out.push(boca[expr] ?? boca.neutro);
  if (expr === "chorando") for (const l of [-1, 1]) { const q = (t * 1.5 + (l > 0 ? 0.5 : 0)) % 1; out.push(`<ellipse cx="${n(hx + l * 40 * k)}" cy="${n(hy + 30 * k + q * 50 * k)}" rx="${n(6 * k)}" ry="${n(10 * k)}" fill="#7cc8ff" opacity="${n(1 - q * 0.6)}"/>`); }
  if (expr === "preocupado") out.push(`<path d="M${n(hx + 92 * k)},${n(hy - 50 * k)} q${n(9 * k)},${n(16 * k)} 0,${n(20 * k)} q${n(-9 * k)},${n(-4 * k)} 0,${n(-20 * k)} Z" fill="#9fd8ff" stroke="${LINHA}" stroke-width="2"/>`);
  return out.join("");
}

/** Cabelo/gorro por cima da cabeça larga (centro hx, hy; raios 118k × 100k). */
function topo(p: Personagem, hx: number, hy: number, k: number, dir: 1 | -1) {
  const sk = `stroke="${LINHA}" stroke-width="${n(Math.max(2.5, 3.2 * k))}" stroke-linejoin="round"`;
  const c = p.corCabelo;
  const tras: string[] = [], frente: string[] = [];
  const domo = (ate: number) => `M${n(hx - 118 * k)},${n(hy - ate * k)} C${n(hx - 120 * k)},${n(hy - 135 * k)} ${n(hx + 120 * k)},${n(hy - 135 * k)} ${n(hx + 118 * k)},${n(hy - ate * k)} Z`;
  switch (p.cabelo) {
    case "bone": // gorro de lã com pompom e barra dobrada
      frente.push(`<path d="${domo(40)}" fill="${c}" ${sk}/><rect x="${n(hx - 122 * k)}" y="${n(hy - 62 * k)}" width="${n(244 * k)}" height="${n(30 * k)}" rx="${n(10 * k)}" fill="${clarear(c, 1.35)}" ${sk}/><circle cx="${n(hx + dir * 6 * k)}" cy="${n(hy - 134 * k)}" r="${n(24 * k)}" fill="${clarear(c, 1.35)}" ${sk}/>`);
      break;
    case "black":
      tras.push(`<ellipse cx="${n(hx)}" cy="${n(hy - 60 * k)}" rx="${n(150 * k)}" ry="${n(110 * k)}" fill="${c}" ${sk}/>`);
      break;
    case "longo":
      tras.push(`<rect x="${n(hx - 128 * k)}" y="${n(hy - 90 * k)}" width="${n(256 * k)}" height="${n(200 * k)}" rx="${n(40 * k)}" fill="${c}" ${sk}/>`);
      frente.push(`<path d="${domo(30)}" fill="${c}" ${sk}/>`);
      break;
    case "coque":
      tras.push(`<circle cx="${n(hx)}" cy="${n(hy - 130 * k)}" r="${n(36 * k)}" fill="${c}" ${sk}/>`);
      frente.push(`<path d="${domo(36)}" fill="${c}" ${sk}/>`);
      break;
    case "cacheado":
      for (let i = 0; i < 7; i++) frente.push(`<circle cx="${n(hx - 96 * k + i * 32 * k)}" cy="${n(hy - 86 * k - Math.sin((i / 6) * Math.PI) * 26 * k)}" r="${n(30 * k)}" fill="${c}" ${sk}/>`);
      break;
    case "franja":
      frente.push(`<path d="M${n(hx - 118 * k)},${n(hy - 30 * k)} C${n(hx - 120 * k)},${n(hy - 135 * k)} ${n(hx + 120 * k)},${n(hy - 135 * k)} ${n(hx + 118 * k)},${n(hy - 30 * k)} L${n(hx + 80 * k)},${n(hy - 62 * k)} L${n(hx + 40 * k)},${n(hy - 50 * k)} L${n(hx)},${n(hy - 64 * k)} L${n(hx - 40 * k)},${n(hy - 50 * k)} L${n(hx - 80 * k)},${n(hy - 62 * k)} Z" fill="${c}" ${sk}/>`);
      break;
    case "careca":
      frente.push(`<path d="M${n(hx - 116 * k)},${n(hy - 20 * k)} q${n(-6 * k)},${n(-30 * k)} ${n(10 * k)},${n(-44 * k)} M${n(hx + 116 * k)},${n(hy - 20 * k)} q${n(6 * k)},${n(-30 * k)} ${n(-10 * k)},${n(-44 * k)}" stroke="${c}" stroke-width="${n(14 * k)}" fill="none" stroke-linecap="round"/>`);
      break;
    default: // curto: cabelo liso com franja serrilhada
      frente.push(`<path d="M${n(hx - 118 * k)},${n(hy - 40 * k)} C${n(hx - 120 * k)},${n(hy - 135 * k)} ${n(hx + 120 * k)},${n(hy - 135 * k)} ${n(hx + 118 * k)},${n(hy - 40 * k)} L${n(hx + 90 * k)},${n(hy - 70 * k)} L${n(hx + 60 * k)},${n(hy - 58 * k)} L${n(hx + 30 * k)},${n(hy - 74 * k)} L${n(hx)},${n(hy - 60 * k)} L${n(hx - 30 * k)},${n(hy - 74 * k)} L${n(hx - 60 * k)},${n(hy - 58 * k)} L${n(hx - 90 * k)},${n(hy - 70 * k)} Z" fill="${c}" ${sk}/>`);
  }
  return { tras: tras.join(""), frente: frente.join("") };
}

export function personagemRecorte(p: Personagem, o: OpcoesPersonagem): string {
  const k0 = o.escala * 1.2 * (p.idade === "crianca" ? 0.95 : 1); // recorte: personagens maiores na tela
  const alto = p.idade === "crianca" ? 1 : 1.35; // adultos têm corpo mais comprido
  const k = k0;
  const tq = Math.floor(o.t * 8) / 8; // animação "picotada", como recorte
  const { acao, dir } = o;
  const andando = acao === "andando" || acao === "correndo";
  const pulo = andando ? (Math.floor(tq * (acao === "correndo" ? 16 : 8)) % 2) * 10 * k : 0;
  const x = o.x + (acao === "assustado" ? (Math.floor(o.t * 24) % 2 ? 3 : -3) : 0);
  const base = o.base - pulo;
  const sk = `stroke="${LINHA}" stroke-width="${n(Math.max(2.5, 3.2 * k))}" stroke-linejoin="round" stroke-linecap="round"`;
  const sentado = acao === "sentado";
  const corpoH = 150 * k * alto;
  const corpoBase = base - (sentado ? 30 : 52) * k;
  const corpoTop = o.close ? 820 + 70 * k : corpoBase - corpoH; // no close o rosto fica no meio da tela
  const hy = corpoTop - 70 * k;
  const out: string[] = [];
  const casaco = p.roupa, luva = p.calca ?? clarear(p.roupa, 0.6), calca = p.calca ?? "#3a4a6b";

  if (!o.close) {
    out.push(`<ellipse cx="${n(x)}" cy="${n(o.base)}" rx="${n(95 * k)}" ry="${n(14 * k)}" fill="#000" opacity="0.18"/>`);
    // pernas curtinhas e pés pretos (no sentado, para a frente)
    if (sentado) out.push(`<rect x="${n(x - 50 * k)}" y="${n(corpoBase - 10 * k)}" width="${n(100 * k)}" height="${n(36 * k)}" fill="${calca}" ${sk}/><ellipse cx="${n(x + dir * 60 * k)}" cy="${n(base - 8 * k)}" rx="${n(34 * k)}" ry="${n(14 * k)}" fill="${LINHA}"/>`);
    else {
      const passo = andando ? (Math.floor(tq * 8) % 2 ? 8 : -8) * k : 0;
      out.push(`<rect x="${n(x - 52 * k)}" y="${n(corpoBase - 6 * k)}" width="${n(104 * k)}" height="${n(base - corpoBase - 4 * k)}" fill="${calca}" ${sk}/><path d="M${n(x)},${n(corpoBase + 6 * k)} L${n(x)},${n(base - 14 * k)}" ${sk}/>`);
      for (const l of [-1, 1]) out.push(`<ellipse cx="${n(x + l * 30 * k + dir * 8 * k + l * passo)}" cy="${n(base - 8 * k)}" rx="${n(36 * k)}" ry="${n(14 * k)}" fill="${LINHA}"/>`);
    }
  }
  // corpo: casaco em trapézio com costura e botões
  const cb = o.close ? 2000 : corpoBase;
  const meia = o.close ? 170 * k : 78 * k, meiaTopo = o.close ? 130 * k : 62 * k;
  out.push(`<path d="M${n(x - meia)},${n(cb)} L${n(x - meiaTopo)},${n(corpoTop + 20 * k)} Q${n(x - meiaTopo)},${n(corpoTop)} ${n(x - meiaTopo + 24 * k)},${n(corpoTop)} L${n(x + meiaTopo - 24 * k)},${n(corpoTop)} Q${n(x + meiaTopo)},${n(corpoTop)} ${n(x + meiaTopo)},${n(corpoTop + 20 * k)} L${n(x + meia)},${n(cb)} Z" fill="${casaco}" ${sk}/>`);
  out.push(`<path d="M${n(x)},${n(corpoTop + 10 * k)} L${n(x)},${n(Math.min(cb, corpoBase))}" ${sk}/>${[0.3, 0.55, 0.8].map((f) => `<circle cx="${n(x + 12 * k)}" cy="${n(corpoTop + corpoH * f)}" r="${n(5 * k)}" fill="${LINHA}"/>`).join("")}`);

  // braços curtos com luva (poses trocam em poucos quadros por segundo)
  if (!o.close) {
    const acena = (o.expr === "feliz" || o.expr === "rindo") && acao === "parado";
    const balanco = andando ? (Math.floor(tq * 8) % 2 ? 18 : -18) : 0;
    for (const l of [-1, 1]) {
      let ang = 18 + balanco * l; // 0 = para baixo; positivo abre para fora
      if (acao === "assustado") ang = 150;
      else if (acao === "apontando" && l === dir) ang = 90;
      else if (acao === "celular" && l === dir) ang = 60;
      else if (acena && l === dir) ang = 140 + (Math.floor(o.t * 6) % 2 ? 12 : -12);
      const ox = x + l * (meiaTopo - 6 * k), oy = corpoTop + 26 * k;
      const comp = 80 * k;
      const mx = ox + Math.sin(rad(ang)) * comp * l, my = oy + Math.cos(rad(ang)) * comp;
      out.push(`<path d="M${n(ox)},${n(oy)} L${n(mx)},${n(my)}" stroke="${LINHA}" stroke-width="${n(30 * k)}" stroke-linecap="round"/><path d="M${n(ox)},${n(oy)} L${n(mx)},${n(my)}" stroke="${casaco}" stroke-width="${n(23 * k)}" stroke-linecap="round"/><circle cx="${n(mx)}" cy="${n(my)}" r="${n(18 * k)}" fill="${luva}" ${sk}/>`);
      if (acao === "celular" && l === dir) out.push(`<rect x="${n(mx - 12 * k)}" y="${n(my - 44 * k)}" width="${n(24 * k)}" height="${n(40 * k)}" rx="${n(4 * k)}" fill="#222" ${sk}/>`);
    }
  }
  // cabeça larga
  const { tras, frente } = topo(p, x, hy, k, dir);
  out.push(tras);
  out.push(`<ellipse cx="${n(x)}" cy="${n(hy)}" rx="${n(118 * k)}" ry="${n(100 * k)}" fill="${p.pele}" ${sk}/>`);
  if (p.barba) out.push(`<path d="M${n(x - 100 * k)},${n(hy + 20 * k)} Q${n(x)},${n(hy + 140 * k)} ${n(x + 100 * k)},${n(hy + 20 * k)} Q${n(x)},${n(hy + 70 * k)} ${n(x - 100 * k)},${n(hy + 20 * k)} Z" fill="${p.corCabelo}"/>`);
  out.push(rosto(x, hy, k, o.expr, dir, o.t, o.seed));
  if (p.oculos) out.push([-1, 1].map((l) => `<circle cx="${n(x + l * 31 * k)}" cy="${n(hy - 8 * k)}" r="${n(40 * k)}" fill="none" stroke="${LINHA}" stroke-width="${n(5 * k)}"/>`).join(""));
  out.push(frente);
  return `<g>${out.join("")}</g>`;
}

// ───────── cenários de recorte ─────────
export const CENARIOS_RECORTE = ["cidade-neve", "sala-tv", "sala-aula"] as const;

export function fundoRecorte(cenario: string, W: number, H: number, chao: number, t: number, pan: number) {
  const sk = `stroke="${LINHA}" stroke-width="4" stroke-linejoin="round"`;
  const p: string[] = [];
  if (cenario === "cidade-neve") {
    p.push(`<rect width="${W}" height="${H}" fill="#8ec9ec"/>`);
    // montanhas com neve (camada lenta)
    const m = (cx: number, alt: number, larg: number, cor: string) => `<path d="M${n(cx - larg)},${chao - 180} L${n(cx)},${n(chao - 180 - alt)} L${n(cx + larg)},${chao - 180} Z" fill="${cor}" ${sk}/><path d="M${n(cx - larg * 0.32)},${n(chao - 180 - alt * 0.68)} L${n(cx)},${n(chao - 180 - alt)} L${n(cx + larg * 0.32)},${n(chao - 180 - alt * 0.68)} L${n(cx + larg * 0.16)},${n(chao - 180 - alt * 0.6)} L${n(cx)},${n(chao - 180 - alt * 0.7)} L${n(cx - larg * 0.16)},${n(chao - 180 - alt * 0.6)} Z" fill="#ffffff"/>`;
    const o1 = -((pan * 0.15) % 900);
    for (let i = -1; i < 3; i++) p.push(m(o1 + i * 900 + 300, 620, 480, "#6d7f9c"), m(o1 + i * 900 + 760, 480, 380, "#5b6d8a"));
    // pinheiros e casinhas (camada do meio)
    const o2 = -((pan * 0.5) % 520);
    for (let i = -1; i < 4; i++) {
      const bx = o2 + i * 520;
      p.push(`<path d="M${n(bx + 60)},${chao - 140} l60,-200 l60,200 Z M${n(bx + 75)},${chao - 220} l45,-150 l45,150 Z" fill="#2f6b45" ${sk}/><rect x="${n(bx + 112)}" y="${chao - 140}" width="16" height="40" fill="#5a3b22"/>`);
      p.push(`<rect x="${n(bx + 240)}" y="${chao - 300}" width="200" height="190" fill="${i % 2 ? "#c9874f" : "#a9603b"}" ${sk}/><path d="M${n(bx + 225)},${chao - 300} L${n(bx + 340)},${chao - 400} L${n(bx + 455)},${chao - 300} Z" fill="#7a3324" ${sk}/><path d="M${n(bx + 235)},${chao - 304} L${n(bx + 340)},${chao - 392} L${n(bx + 445)},${chao - 304}" fill="none" stroke="#fff" stroke-width="12"/><rect x="${n(bx + 270)}" y="${chao - 260}" width="50" height="50" fill="#ffe9a3" ${sk}/><rect x="${n(bx + 360)}" y="${chao - 210}" width="50" height="100" fill="#5a3b22" ${sk}/>`);
    }
    // chão de neve e rua
    p.push(`<rect x="0" y="${chao - 110}" width="${W}" height="${H}" fill="#f4f8ff"/><path d="M0,${chao - 110} Q${W / 2},${chao - 140} ${W},${chao - 110}" fill="#f4f8ff" ${sk}/><rect x="0" y="${chao + 30}" width="${W}" height="120" fill="#9aa3ad"/>`);
    const o3 = -((pan * 1) % 160);
    for (let x = o3; x < W; x += 160) p.push(`<rect x="${n(x)}" y="${chao + 84}" width="80" height="12" fill="#ffd23f"/>`);
    // neve caindo
    for (let i = 0; i < 40; i++) { const sx = (i * 137) % W, sy = ((i * 211 + t * 120) % (H + 40)) - 20; p.push(`<circle cx="${n(sx + Math.sin(t + i) * 10)}" cy="${n(sy)}" r="${3 + (i % 3)}" fill="#fff" opacity="0.9"/>`); }
  } else if (cenario === "sala-tv") {
    p.push(`<rect width="${W}" height="${H}" fill="#e7c98f"/>`);
    for (let x = 0; x < W; x += 70) p.push(`<rect x="${x}" y="0" width="22" height="${chao}" fill="#dcb977"/>`);
    p.push(`<rect x="${W - 380}" y="250" width="280" height="260" fill="#a8d6f2" ${sk}/><rect x="${W - 246}" y="250" width="12" height="260" fill="${LINHA}"/>${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${W - 360 + ((i * 47 + t * 30) % 240)}" cy="${270 + ((i * 83 + t * 60) % 220)}" r="5" fill="#fff"/>`).join("")}`);
    p.push(`<rect x="0" y="${chao}" width="${W}" height="${H - chao}" fill="#7a4e2f"/><rect x="60" y="${chao - 10}" width="${W - 120}" height="40" rx="10" fill="#b03a3a" opacity="0.7"/>`);
    // sofá ao fundo e TV de lado
    p.push(`<rect x="${W / 2 - 300}" y="${chao - 230}" width="600" height="150" rx="30" fill="#8a5a2f" ${sk}/><rect x="${W / 2 - 330}" y="${chao - 120}" width="660" height="110" rx="26" fill="#9c6a3a" ${sk}/>`);
    p.push(`<rect x="40" y="${chao - 180}" width="190" height="180" fill="#5a3b22" ${sk}/><rect x="50" y="${chao - 330}" width="170" height="140" rx="12" fill="#333" ${sk}/><rect x="64" y="${chao - 316}" width="142" height="112" fill="${Math.floor(t * 6) % 2 ? "#7fd0ff" : "#9fe0ff"}"/>`);
  } else {
    // sala de aula
    p.push(`<rect width="${W}" height="${H}" fill="#d8e3c8"/>`);
    p.push(`<rect x="90" y="220" width="${W - 180}" height="360" fill="#2f5a3a" stroke="#7a4e2f" stroke-width="16"/><path d="M160,320 l200,0 M160,380 l320,0 M160,440 l150,0 M620,330 q60,-60 120,0 t120,0" fill="none" stroke="#f4f4f4" stroke-width="6" opacity="0.8"/>`);
    p.push(`<circle cx="${W - 150}" cy="140" r="56" fill="#fff" ${sk}/><path d="M${W - 150},140 L${W - 150},104 M${W - 150},140 L${n(W - 150 + Math.sin(t) * 26)},${n(140 - Math.cos(t) * 26)}" ${sk}/>`);
    p.push(`<rect x="0" y="${chao}" width="${W}" height="${H - chao}" fill="#b38b5d"/>`);
    p.push(`<rect x="${W - 360}" y="${chao - 200}" width="300" height="40" fill="#8a5a2f" ${sk}/><rect x="${W - 340}" y="${chao - 160}" width="24" height="160" fill="#8a5a2f"/><rect x="${W - 104}" y="${chao - 160}" width="24" height="160" fill="#8a5a2f"/><circle cx="${W - 300}" cy="${chao - 222}" r="22" fill="#d6423b" ${sk}/>`);
  }
  return p.join("");
}
