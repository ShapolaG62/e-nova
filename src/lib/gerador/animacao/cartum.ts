import "server-only";
import type { Acao, AnimCena, Expressao, Personagem } from "./tipos";

// Personagens de desenho (estilo 2D liso, cabeça grande, contorno escuro) e os cenários do "mundo do prédio".
// Tudo desenhado por código: o mesmo personagem sai idêntico em todas as cenas, sem IA de imagem e sem custo.

const CONTORNO = "#2b1f1a";
const n = (v: number) => Math.round(v * 10) / 10;
type P = [number, number];
const pol = (o: P, ang: number, len: number): P => [o[0] + Math.sin(ang) * len, o[1] + Math.cos(ang) * len];
const rad = (g: number) => (g * Math.PI) / 180;

/** Membro com contorno: desenha a linha grossa escura e por cima a cor. */
function membro(pts: P[], larg: number, cor: string, lw: number) {
  const d = "M" + pts.map((p) => `${n(p[0])},${n(p[1])}`).join(" L");
  return `<path d="${d}" fill="none" stroke="${CONTORNO}" stroke-width="${n(larg + lw * 2)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${cor}" stroke-width="${n(larg)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function escurecer(hex: string, f: number) {
  const v = parseInt(hex.slice(1), 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => Math.max(0, Math.min(255, Math.round(x * f))));
  return "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");
}

export type OpcoesPersonagem = {
  x: number; base: number; escala: number; expr: Expressao; acao: Acao; t: number; dir: 1 | -1; close?: boolean; seed: number;
};

/** Cabeça com rosto e cabelo. (hx, hy) = centro, R = raio. */
function cabeca(p: Personagem, hx: number, hy: number, R: number, expr: Expressao, dir: 1 | -1, t: number, seed: number) {
  const lw = Math.max(3, R * 0.055);
  const sk = `stroke="${CONTORNO}" stroke-width="${n(lw)}" stroke-linecap="round" stroke-linejoin="round"`;
  const cab = p.corCabelo, pele = p.pele;
  const tras: string[] = [], frente: string[] = [], rosto: string[] = [];
  const capa = `M${n(hx - R * 1.03)},${n(hy - R * 0.02)} C${n(hx - R * 1.08)},${n(hy - R * 1.3)} ${n(hx + R * 1.08)},${n(hy - R * 1.3)} ${n(hx + R * 1.03)},${n(hy - R * 0.02)} Q${n(hx + R * 0.7)},${n(hy - R * 0.62)} ${n(hx)},${n(hy - R * 0.64)} Q${n(hx - R * 0.7)},${n(hy - R * 0.62)} ${n(hx - R * 1.03)},${n(hy - R * 0.02)} Z`;

  switch (p.cabelo) {
    case "black":
      tras.push(`<circle cx="${n(hx)}" cy="${n(hy - R * 0.3)}" r="${n(R * 1.38)}" fill="${cab}" ${sk}/>`);
      break;
    case "longo":
      tras.push(`<rect x="${n(hx - R * 1.12)}" y="${n(hy - R * 0.9)}" width="${n(R * 2.24)}" height="${n(R * 1.95)}" rx="${n(R * 0.75)}" fill="${cab}" ${sk}/>`);
      frente.push(`<path d="${capa}" fill="${cab}" ${sk}/>`);
      break;
    case "coque":
      tras.push(`<circle cx="${n(hx)}" cy="${n(hy - R * 1.15)}" r="${n(R * 0.42)}" fill="${cab}" ${sk}/>`);
      frente.push(`<path d="${capa}" fill="${cab}" ${sk}/>`);
      break;
    case "cacheado":
      for (let i = 0; i <= 8; i++) {
        const a = rad(-100 + i * 25);
        tras.push(`<circle cx="${n(hx + Math.sin(a) * R * 0.95)}" cy="${n(hy - R * 0.25 - Math.cos(a) * R * 0.85)}" r="${n(R * 0.36)}" fill="${cab}" ${sk}/>`);
      }
      frente.push(`<path d="${capa}" fill="${cab}"/>`);
      break;
    case "franja":
      frente.push(`<path d="M${n(hx - R * 1.03)},${n(hy)} C${n(hx - R * 1.08)},${n(hy - R * 1.3)} ${n(hx + R * 1.08)},${n(hy - R * 1.3)} ${n(hx + R * 1.03)},${n(hy)} L${n(hx + R * 0.8)},${n(hy - R * 0.32)} L${n(hx + R * 0.45)},${n(hy - R * 0.22)} L${n(hx + R * 0.1)},${n(hy - R * 0.36)} L${n(hx - R * 0.3)},${n(hy - R * 0.22)} L${n(hx - R * 0.7)},${n(hy - R * 0.34)} Z" fill="${cab}" ${sk}/>`);
      break;
    case "bone":
      frente.push(`<path d="M${n(hx - R * 1.04)},${n(hy - R * 0.2)} C${n(hx - R * 1.05)},${n(hy - R * 1.3)} ${n(hx + R * 1.05)},${n(hy - R * 1.3)} ${n(hx + R * 1.04)},${n(hy - R * 0.2)} Z" fill="${cab}" ${sk}/><path d="M${n(hx + dir * R * 0.2)},${n(hy - R * 0.22)} Q${n(hx + dir * R * 1.5)},${n(hy - R * 0.3)} ${n(hx + dir * R * 1.45)},${n(hy - R * 0.08)} L${n(hx + dir * R * 0.2)},${n(hy - R * 0.1)} Z" fill="${escurecer(cab, 0.8)}" ${sk}/>`);
      break;
    case "careca":
      frente.push(`<ellipse cx="${n(hx - R * 0.95)}" cy="${n(hy - R * 0.15)}" rx="${n(R * 0.16)}" ry="${n(R * 0.3)}" fill="${cab}"/><ellipse cx="${n(hx + R * 0.95)}" cy="${n(hy - R * 0.15)}" rx="${n(R * 0.16)}" ry="${n(R * 0.3)}" fill="${cab}"/><path d="M${n(hx - R * 0.3)},${n(hy - R * 0.85)} Q${n(hx)},${n(hy - R * 0.95)} ${n(hx + R * 0.25)},${n(hy - R * 0.8)}" fill="none" stroke="#fff" stroke-width="${n(lw)}" opacity="0.35"/>`);
      break;
    default: // curto
      frente.push(`<path d="${capa}" fill="${cab}" ${sk}/>`);
  }

  // orelhas e rosto
  const orelhas = [-1, 1].map((l) => `<circle cx="${n(hx + l * R * 0.98)}" cy="${n(hy + R * 0.12)}" r="${n(R * 0.2)}" fill="${pele}" ${sk}/>`).join("");
  const face = `<ellipse cx="${n(hx)}" cy="${n(hy)}" rx="${n(R)}" ry="${n(R * 1.04)}" fill="${pele}" ${sk}/>`;

  // olhos (olham para onde o personagem está virado; piscam de vez em quando)
  const pisca = ((t + (seed % 7) * 0.37) % 3.4) < 0.13;
  const olhar = dir * R * 0.05;
  const fechadoFeliz = expr === "feliz" || expr === "rindo";
  for (const l of [-1, 1]) {
    const ex = hx + l * R * 0.36 + olhar, ey = hy + R * 0.04;
    if (fechadoFeliz) rosto.push(`<path d="M${n(ex - R * 0.15)},${n(ey + R * 0.05)} Q${n(ex)},${n(ey - R * 0.14)} ${n(ex + R * 0.15)},${n(ey + R * 0.05)}" fill="none" ${sk}/>`);
    else if (expr === "chorando" || pisca) rosto.push(`<path d="M${n(ex - R * 0.15)},${n(ey)} Q${n(ex)},${n(ey + R * 0.1)} ${n(ex + R * 0.15)},${n(ey)}" fill="none" ${sk}/>`);
    else {
      const sur = expr === "surpreso";
      const rx = R * (sur ? 0.2 : 0.16), ry = R * (sur ? 0.25 : 0.2), pr = R * (sur ? 0.07 : 0.1);
      rosto.push(`<ellipse cx="${n(ex)}" cy="${n(ey)}" rx="${n(rx)}" ry="${n(ry)}" fill="#fff" ${sk}/><circle cx="${n(ex + dir * R * 0.04)}" cy="${n(ey + R * 0.02)}" r="${n(pr)}" fill="${CONTORNO}"/><circle cx="${n(ex + dir * R * 0.04 + pr * 0.35)}" cy="${n(ey - pr * 0.3)}" r="${n(pr * 0.35)}" fill="#fff"/>`);
      if (expr === "triste" || expr === "preocupado") rosto.push(`<path d="M${n(ex - rx)},${n(ey - ry * 0.35)} L${n(ex + rx)},${n(ey - ry * 0.35)}" ${sk} opacity="0.5"/>`);
    }
    // sobrancelhas: [ponta de dentro, ponta de fora] (negativo = sobe)
    const sb: Record<Expressao, [number, number]> = {
      neutro: [0, 0], feliz: [-0.05, -0.03], rindo: [-0.07, -0.05], surpreso: [-0.15, -0.13], triste: [-0.12, 0.05],
      preocupado: [-0.11, 0.03], chorando: [-0.13, 0.06], bravo: [0.09, -0.07],
    };
    const [dentro, fora] = sb[expr] ?? [0, 0];
    const by = ey - R * 0.33;
    rosto.push(`<path d="M${n(ex - l * R * 0.06)},${n(by + dentro * R)} L${n(ex + l * R * 0.2)},${n(by + fora * R)}" fill="none" stroke="${escurecer(cab, 0.85)}" stroke-width="${n(lw * 1.6)}" stroke-linecap="round"/>`);
  }
  // nariz
  rosto.push(`<path d="M${n(hx + dir * R * 0.06)},${n(hy + R * 0.16)} q${n(dir * R * 0.08)},${n(R * 0.06)} 0,${n(R * 0.12)}" fill="none" ${sk} opacity="0.7"/>`);
  // bochechas
  if (expr === "feliz" || expr === "rindo" || p.idade === "crianca") rosto.push([-1, 1].map((l) => `<ellipse cx="${n(hx + l * R * 0.58)}" cy="${n(hy + R * 0.32)}" rx="${n(R * 0.14)}" ry="${n(R * 0.08)}" fill="#ff8a8a" opacity="${expr === "feliz" || expr === "rindo" ? 0.55 : 0.3}"/>`).join(""));
  // boca
  const mx = hx + dir * R * 0.05, my = hy + R * 0.47;
  const bocaAberta = `fill="#7a2a2a" ${sk}`;
  const bocas: Record<Expressao, string> = {
    neutro: `<path d="M${n(mx - R * 0.14)},${n(my)} Q${n(mx)},${n(my + R * 0.04)} ${n(mx + R * 0.14)},${n(my)}" fill="none" ${sk}/>`,
    feliz: `<path d="M${n(mx - R * 0.22)},${n(my - R * 0.04)} Q${n(mx)},${n(my + R * 0.22)} ${n(mx + R * 0.22)},${n(my - R * 0.04)}" fill="none" ${sk}/>`,
    rindo: `<path d="M${n(mx - R * 0.26)},${n(my - R * 0.06)} Q${n(mx)},${n(my + R * 0.4)} ${n(mx + R * 0.26)},${n(my - R * 0.06)} Z" ${bocaAberta}/><ellipse cx="${n(mx)}" cy="${n(my + R * 0.15)}" rx="${n(R * 0.1)}" ry="${n(R * 0.05)}" fill="#ff7a8a"/>`,
    triste: `<path d="M${n(mx - R * 0.18)},${n(my + R * 0.08)} Q${n(mx)},${n(my - R * 0.1)} ${n(mx + R * 0.18)},${n(my + R * 0.08)}" fill="none" ${sk}/>`,
    surpreso: `<ellipse cx="${n(mx)}" cy="${n(my + R * 0.03)}" rx="${n(R * 0.1)}" ry="${n(R * 0.14)}" ${bocaAberta}/>`,
    bravo: `<path d="M${n(mx - R * 0.2)},${n(my + R * 0.06)} Q${n(mx)},${n(my - R * 0.05)} ${n(mx + R * 0.2)},${n(my + R * 0.06)}" fill="none" ${sk}/>`,
    preocupado: `<path d="M${n(mx - R * 0.2)},${n(my + R * 0.02)} q${n(R * 0.05)},${n(-R * 0.06)} ${n(R * 0.1)},0 t${n(R * 0.1)},0 t${n(R * 0.1)},0 t${n(R * 0.1)},0" fill="none" ${sk}/>`,
    chorando: `<path d="M${n(mx - R * 0.2)},${n(my + R * 0.12)} Q${n(mx)},${n(my - R * 0.14)} ${n(mx + R * 0.2)},${n(my + R * 0.12)} Z" ${bocaAberta}/>`,
  };
  rosto.push(bocas[expr] ?? bocas.neutro);
  if (p.barba) rosto.push(`<path d="M${n(hx - R * 0.85)},${n(hy + R * 0.3)} Q${n(hx - R * 0.6)},${n(hy + R * 1.12)} ${n(hx)},${n(hy + R * 1.12)} Q${n(hx + R * 0.6)},${n(hy + R * 1.12)} ${n(hx + R * 0.85)},${n(hy + R * 0.3)} Q${n(hx)},${n(hy + R * 0.75)} ${n(hx - R * 0.85)},${n(hy + R * 0.3)} Z" fill="${cab}" opacity="0.9"/>`);
  if (p.oculos) rosto.push([-1, 1].map((l) => `<circle cx="${n(hx + l * R * 0.36 + olhar)}" cy="${n(hy + R * 0.04)}" r="${n(R * 0.24)}" fill="#ffffff" fill-opacity="0.15" ${sk}/>`).join("") + `<path d="M${n(hx - R * 0.12 + olhar)},${n(hy)} L${n(hx + R * 0.12 + olhar)},${n(hy)}" ${sk}/>`);
  // lágrimas e suor
  if (expr === "chorando") for (const l of [-1, 1]) { const q = (t * 1.6 + (l > 0 ? 0.5 : 0)) % 1; rosto.push(`<ellipse cx="${n(hx + l * R * 0.42)}" cy="${n(hy + R * 0.2 + q * R * 0.6)}" rx="${n(R * 0.06)}" ry="${n(R * 0.1)}" fill="#7cc8ff" opacity="${n(1 - q * 0.6)}"/>`); }
  if (expr === "preocupado") rosto.push(`<path d="M${n(hx + R * 0.75)},${n(hy - R * 0.55)} q${n(R * 0.1)},${n(R * 0.18)} 0,${n(R * 0.22)} q${n(-R * 0.1)},${n(-R * 0.04)} 0,${n(-R * 0.22)} Z" fill="#9fd8ff" stroke="${CONTORNO}" stroke-width="${n(lw * 0.6)}"/>`);

  return tras.join("") + orelhas + face + rosto.join("") + frente.join("");
}

/** Personagem inteiro (ou só cabeça e ombros, quando close). */
export function personagem(p: Personagem, o: OpcoesPersonagem): string {
  const crianca = p.idade === "crianca";
  const s = o.escala * (crianca ? 0.76 : 1);
  const lw = Math.max(3, 5.5 * o.escala);
  const sk = `stroke="${CONTORNO}" stroke-width="${n(lw)}" stroke-linejoin="round"`;
  const { acao, t, dir } = o;
  const vel = acao === "correndo" ? 10 : acao === "andando" ? 6 : 0;
  const ph = t * vel;
  const bob = vel ? Math.abs(Math.sin(ph)) * 12 * s : Math.sin(t * 2.2) * 2.5 * s;
  const x = o.x + (acao === "assustado" ? Math.sin(t * 40) * 3 : 0);
  const sentado = acao === "sentado";
  const quadrilY = o.base - (sentado ? 110 : 170) * s - bob;
  // no close a cabeça fica no meio da tela e os ombros saem largos para fora do quadro
  const torsoTop = o.close ? 760 + 102 * o.escala * 0.82 : quadrilY - 170 * s;
  const R = 102 * o.escala * (crianca ? 0.86 : 1);
  const hy = torsoTop - R * 0.78;
  const calca = p.calca ?? "#3d4a6b";
  const sapato = "#3a2f2a";
  const out: string[] = [];

  if (!o.close) {
    // pernas
    for (const l of [-1, 1]) {
      const lx = x + l * 26 * s;
      if (sentado) {
        out.push(membro([[lx, quadrilY], [lx + dir * 95 * s, quadrilY + 6 * s], [lx + dir * 100 * s, o.base - 16 * s]], 42 * s, calca, lw));
        out.push(`<ellipse cx="${n(lx + dir * 112 * s)}" cy="${n(o.base - 12 * s)}" rx="${n(30 * s)}" ry="${n(15 * s)}" fill="${sapato}" ${sk}/>`);
      } else {
        const sw = vel ? Math.sin(ph + (l > 0 ? Math.PI : 0)) * (vel > 8 ? 34 : 22) * s : 0;
        const lift = vel ? Math.max(0, Math.sin(ph + (l > 0 ? Math.PI : 0))) * 16 * s : 0;
        out.push(membro([[lx, quadrilY], [lx + sw, o.base - 18 * s - lift]], 42 * s, calca, lw));
        out.push(`<ellipse cx="${n(lx + sw + dir * 10 * s)}" cy="${n(o.base - 12 * s - lift)}" rx="${n(30 * s)}" ry="${n(15 * s)}" fill="${sapato}" ${sk}/>`);
      }
    }
  }

  // braços: [ombro°, cotovelo°] a partir do braço caído (o 2º braço usa ângulos negativos para abrir para o outro lado)
  let br: [number, number][];
  const acena = (o.expr === "feliz" || o.expr === "rindo") && acao === "parado";
  if (vel) { const a = Math.sin(ph + Math.PI) * (vel > 8 ? 55 : 30); br = [[a, 60], [-a, 60]]; }
  else if (acao === "assustado") br = [[155 + Math.sin(t * 30) * 5, 25], [-155, -25]];
  else if (acao === "apontando") br = [[95, 0], [-12, -8]];
  else if (acao === "celular") br = [[40, 100], [-12, -8]];
  else if (acena) br = [[150 + Math.sin(t * 7) * 18, 25], [-14, -6]];
  else if (o.expr === "triste" || o.expr === "chorando") br = [[6, -4], [-6, 4]];
  else br = [[14 + Math.sin(t * 2.2) * 2, -10], [-14, 10]];
  const ombroY = torsoTop + 32 * s;
  const braco = (i: number) => {
    const [ang, cot] = br[i];
    const lado = i === 0 ? dir : -dir;
    const om: P = [x + lado * 56 * s, ombroY];
    const co = pol(om, rad(ang) * dir, 68 * s); // ângulo positivo gira para o lado em que ele olha
    const mao = pol(co, rad(ang + cot) * dir, 62 * s);
    let r = membro([om, co, mao], 30 * s, p.roupa, lw) + `<circle cx="${n(mao[0])}" cy="${n(mao[1])}" r="${n(17 * s)}" fill="${p.pele}" ${sk}/>`;
    if (i === 0 && acao === "celular") r += `<rect x="${n(mao[0] - 14 * s)}" y="${n(mao[1] - 40 * s)}" width="${n(28 * s)}" height="${n(48 * s)}" rx="${n(6 * s)}" fill="#222" ${sk}/><rect x="${n(mao[0] - 10 * s)}" y="${n(mao[1] - 35 * s)}" width="${n(20 * s)}" height="${n(34 * s)}" fill="#8fd3ff"/>`;
    return r;
  };
  // corpo
  const torsoBase = o.close ? 2000 : quadrilY + 22 * s;
  if (o.close) out.push(`<path d="M${n(x - 175 * s)},${n(torsoBase)} L${n(x - 165 * s)},${n(torsoTop + 90 * s)} Q${n(x - 150 * s)},${n(torsoTop)} ${n(x - 40 * s)},${n(torsoTop)} L${n(x + 40 * s)},${n(torsoTop)} Q${n(x + 150 * s)},${n(torsoTop)} ${n(x + 165 * s)},${n(torsoTop + 90 * s)} L${n(x + 175 * s)},${n(torsoBase)} Z" fill="${p.roupa}" ${sk}/>`);
  else
  out.push(`<path d="M${n(x - 60 * s)},${n(torsoBase)} L${n(x - 64 * s)},${n(torsoTop + 40 * s)} Q${n(x - 62 * s)},${n(torsoTop)} ${n(x - 20 * s)},${n(torsoTop)} L${n(x + 20 * s)},${n(torsoTop)} Q${n(x + 62 * s)},${n(torsoTop)} ${n(x + 64 * s)},${n(torsoTop + 40 * s)} L${n(x + 60 * s)},${n(torsoBase)} Z" fill="${p.roupa}" ${sk}/>`);
  out.push(`<path d="M${n(x - 24 * s)},${n(torsoTop + 2 * s)} Q${n(x)},${n(torsoTop + 30 * s)} ${n(x + 24 * s)},${n(torsoTop + 2 * s)}" fill="${p.pele}" ${sk}/>`);
  if (!o.close) out.push(braco(1), braco(0));
  out.push(cabeca(p, x, hy, R, o.expr, dir, t, o.seed));
  return `<g>${out.join("")}</g>`;
}

// ───────── cenários do mundo do prédio ─────────
export function rnd(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; };
}

/**
 * Fachada do prédio que ocupa a tela. movimento "subindo" faz as janelas descerem (a câmera sobe).
 * Devolve também o retângulo da janela em destaque, onde o personagem aparece.
 */
export function fachada(W: number, H: number, t: number, seed: number, movimento: AnimCena["movimento"], noite: boolean) {
  const p: string[] = [];
  const vel = movimento === "subindo" ? 900 : movimento === "descendo" ? -900 : 25;
  const off = t * vel;
  p.push(`<rect width="${W}" height="${H}" fill="${noite ? "#141a35" : "#9fd3f7"}"/>`);
  p.push(`<rect x="70" y="0" width="${W - 140}" height="${H}" fill="${noite ? "#2a3150" : "#cbb89a"}" stroke="${CONTORNO}" stroke-width="8"/>`);
  const cw = 150, chh = 190, cols = 6;
  const x0 = (W - cols * cw) / 2;
  const linha0 = Math.floor(off / chh) - 1;
  for (let r = linha0; r < linha0 + Math.ceil(H / chh) + 3; r++) {
    const y = r * chh - off + ((H / 2) % chh);
    const yy = H - y; // as linhas de cima são os andares mais altos
    if (yy < -chh || yy > H + chh) continue;
    p.push(`<rect x="70" y="${n(yy + chh - 14)}" width="${W - 140}" height="12" fill="${noite ? "#1d2440" : "#b39d7c"}"/>`);
    for (let c = 0; c < cols; c++) {
      const rr = rnd(seed * 31 + r * 977 + c * 53);
      const acesa = rr() > (noite ? 0.45 : 0.7);
      p.push(`<rect x="${n(x0 + c * cw + 22)}" y="${n(yy + 26)}" width="${cw - 44}" height="${chh - 66}" rx="6" fill="${acesa ? (noite ? "#ffd27a" : "#fff3c4") : noite ? "#0f1428" : "#6f8fa8"}" stroke="${CONTORNO}" stroke-width="5"/>`);
    }
  }
  if (Math.abs(vel) > 100) for (let i = 0; i < 26; i++) {
    const lx = (i * 97 + seed * 13) % W, ly = ((i * 263 + t * Math.abs(vel) * 1.6) % (H + 400)) - 200;
    p.push(`<rect x="${lx}" y="${n(vel > 0 ? ly : H - ly)}" width="4" height="180" fill="#fff" opacity="0.18"/>`);
  }
  return { svg: p.join(""), janela: { x: W / 2 - 230, y: 520, w: 460, h: 560 } };
}

/** Interior simples (pouco dinheiro) ou rico (andar alto, acima das nuvens). */
export function interior(tipo: "apto-simples" | "apto-rico", W: number, H: number, chao: number, t: number) {
  const p: string[] = [];
  const sk = `stroke="${CONTORNO}" stroke-width="6" stroke-linejoin="round"`;
  if (tipo === "apto-simples") {
    p.push(`<rect width="${W}" height="${H}" fill="#e3d3b4"/>`);
    p.push(`<path d="M160,300 l40,60 l-25,40 l50,70 M820,520 l-30,50 l35,40" fill="none" stroke="#a8916b" stroke-width="5"/>`);
    // janela pequena com grade
    p.push(`<rect x="${W - 380}" y="300" width="260" height="230" fill="#8fb6cf" ${sk}/>${[1, 2, 3].map((i) => `<rect x="${W - 380 + i * 65}" y="300" width="8" height="230" fill="#5a5a5a"/>`).join("")}`);
    // lâmpada pendurada balançando
    const a = Math.sin(t * 1.3) * 6;
    p.push(`<g transform="rotate(${n(a)} ${W / 2} 0)"><line x1="${W / 2}" y1="0" x2="${W / 2}" y2="250" stroke="${CONTORNO}" stroke-width="5"/><circle cx="${W / 2}" cy="270" r="26" fill="#fff4c2" ${sk}/><circle cx="${W / 2}" cy="270" r="120" fill="#fff4c2" opacity="0.18"/></g>`);
    p.push(`<rect x="0" y="${chao}" width="${W}" height="${H - chao}" fill="#a4865f"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="0" y="${chao + 40 + i * 90}" width="${W}" height="5" fill="#8a6d49"/>`).join("")}`);
    p.push(`<rect x="60" y="${chao - 60}" width="340" height="70" rx="20" fill="#d7cfe8" ${sk}/><rect x="70" y="${chao - 90}" width="110" height="40" rx="16" fill="#fff" ${sk}/>`);
  } else {
    p.push(`<rect width="${W}" height="${H}" fill="#f4efe6"/>`);
    // janelão com céu e nuvens passando lá embaixo
    p.push(`<defs><linearGradient id="ceuRico" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ec3f0"/><stop offset="1" stop-color="#e3f4ff"/></linearGradient></defs>`);
    p.push(`<rect x="70" y="180" width="${W - 140}" height="${chao - 300}" fill="url(#ceuRico)" ${sk}/>`);
    for (let i = 0; i < 4; i++) { const cx = ((i * 330 + t * 40) % (W + 300)) - 150, cy = 560 + (i % 2) * 160; p.push(`<g opacity="0.95"><ellipse cx="${n(cx)}" cy="${cy}" rx="120" ry="44" fill="#fff"/><ellipse cx="${n(cx + 60)}" cy="${cy - 26}" rx="70" ry="44" fill="#fff"/></g>`); }
    p.push(`<rect x="${W / 2 - 4}" y="180" width="8" height="${chao - 300}" fill="${CONTORNO}"/>`);
    // lustre dourado
    p.push(`<line x1="${W / 2}" y1="0" x2="${W / 2}" y2="110" stroke="#b08a2e" stroke-width="5"/><path d="M${W / 2 - 110},110 L${W / 2 + 110},110 L${W / 2 + 60},160 L${W / 2 - 60},160 Z" fill="#e7c25a" ${sk}/>${[-80, -27, 27, 80].map((d) => `<circle cx="${W / 2 + d}" cy="178" r="12" fill="#fff6c8"/>`).join("")}`);
    p.push(`<rect x="0" y="${chao}" width="${W}" height="${H - chao}" fill="#d9c7a3"/><rect x="0" y="${chao}" width="${W}" height="10" fill="#b8a27a"/>`);
    // sofá e planta
    p.push(`<rect x="${W - 470}" y="${chao - 170}" width="420" height="120" rx="40" fill="#6b4fa0" ${sk}/><rect x="${W - 500}" y="${chao - 80}" width="480" height="90" rx="30" fill="#7d61b4" ${sk}/>`);
    p.push(`<path d="M90,${chao} L110,${chao - 130} L210,${chao - 130} L230,${chao}Z" fill="#c9703f" ${sk}/>${[-40, -10, 20, 50].map((a, i) => `<ellipse cx="${160 + a}" cy="${chao - 220 - (i % 2) * 40}" rx="34" ry="90" fill="#3f9b56" ${sk} transform="rotate(${a} ${160 + a} ${chao - 220})"/>`).join("")}`);
  }
  return p.join("");
}

/** Placar de LED (ex.: o andar onde a pessoa mora), com seta verde (sobe) ou vermelha (desce). */
export function placar(W: number, y: number, texto: string, tendencia: "sobe" | "desce" | "igual", ent: number) {
  const larg = Math.max(300, texto.length * 46 + 150);
  const x0 = (W - larg) / 2;
  const cor = tendencia === "sobe" ? "#33e07a" : tendencia === "desce" ? "#ff4b3e" : "#ff4b3e";
  const seta = tendencia === "sobe" ? `M${x0 + 40},${y + 72} l28,-40 l28,40 Z` : tendencia === "desce" ? `M${x0 + 40},${y + 36} l28,40 l28,-40 Z` : "";
  return `<g opacity="${n(ent)}"><rect x="${x0}" y="${y}" width="${larg}" height="110" rx="18" fill="#111" stroke="#555" stroke-width="6"/>${seta ? `<path d="${seta}" fill="${cor}"/>` : ""}<text x="${x0 + (seta ? 120 : larg / 2)}" y="${y + 80}" font-family="Consolas, Courier New, monospace" font-weight="bold" font-size="72" fill="${cor}" text-anchor="${seta ? "start" : "middle"}">${texto.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text></g>`;
}
