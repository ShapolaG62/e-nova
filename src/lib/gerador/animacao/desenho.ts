import "server-only";
import type { Acao, AnimCena, AnimVideo, Cenario, Objeto, Paleta } from "./tipos";

// Desenha UM quadro da animação como SVG (o render.ts transforma em imagem e junta no vídeo).
// Estilo: cenário plano em camadas, boneco-silhueta com articulações, luz recortada, legenda grande.
// Tudo é função do tempo: o mesmo t sempre gera o mesmo quadro.

type Cores = { ceu1: string; ceu2: string; longe: string; perto: string; chao: string; luz: string; janela: string; boneco: string; borda: string; texto: string; destaque: string };

const PALETA: Record<Paleta, Cores> = {
  noite: { ceu1: "#141a35", ceu2: "#262d55", longe: "#1d2346", perto: "#121630", chao: "#0d1022", luz: "#fff4c2", janela: "#f6c453", boneco: "#0b0d1a", borda: "#3b4380", texto: "#ffffff", destaque: "#ffd23f" },
  terror: { ceu1: "#16090d", ceu2: "#2c1118", longe: "#241016", perto: "#14080b", chao: "#0c0507", luz: "#ffe0c2", janela: "#ff5a3c", boneco: "#070304", borda: "#5c1a26", texto: "#ffffff", destaque: "#ff3b4f" },
  quente: { ceu1: "#f6b26b", ceu2: "#ffe0a8", longe: "#d9895b", perto: "#a8573a", chao: "#6e3a2a", luz: "#fff7d6", janela: "#ffe9a3", boneco: "#2a1712", borda: "#ffffff", texto: "#ffffff", destaque: "#ffd23f" },
  neutro: { ceu1: "#b9c6d6", ceu2: "#e8eef5", longe: "#93a3b8", perto: "#6b7c93", chao: "#3c4859", luz: "#ffffff", janela: "#fff3c4", boneco: "#1d2430", borda: "#ffffff", texto: "#ffffff", destaque: "#ffd23f" },
  neon: { ceu1: "#120a2b", ceu2: "#2a0f4f", longe: "#2b1460", perto: "#170a35", chao: "#0c0620", luz: "#7df9ff", janela: "#ff4fd8", boneco: "#07030f", borda: "#7a3cff", texto: "#ffffff", destaque: "#ff4fd8" },
};

const CHAO = 1180; // linha do chão (a parte de baixo fica para a legenda)
const n = (v: number) => Math.round(v * 10) / 10;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Número pseudoaleatório estável (mesma semente = mesmo cenário em todos os quadros). */
function rnd(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; };
}

// ───────── cenários ─────────
function fundo(c: Cores, cenario: Cenario, W: number, H: number, pan: number, seed: number, objetos: Set<Objeto>, t: number) {
  const r = rnd(seed);
  const p: string[] = [];
  p.push(`<rect width="${W}" height="${H}" fill="url(#ceu)"/>`);
  const interno = ["casa", "corredor", "elevador", "quarto", "loja", "cozinha", "escritorio"].includes(cenario);

  if (!interno) {
    if (objetos.has("lua") || cenario === "rua-noite" || cenario === "floresta") p.push(`<circle cx="${n(W * 0.72 - pan * 0.05)}" cy="330" r="62" fill="${c.luz}" opacity="0.9"/><circle cx="${n(W * 0.72 - pan * 0.05 + 18)}" cy="318" r="56" fill="${c.ceu2}" opacity="0.35"/>`);
    if (cenario === "ceu" || cenario === "rua-noite") for (let i = 0; i < 40; i++) p.push(`<circle cx="${n(r() * W)}" cy="${n(r() * 700)}" r="${n(1 + r() * 2.2)}" fill="#fff" opacity="${n(0.25 + 0.5 * Math.abs(Math.sin(t * 1.5 + i)))}"/>`);
    // casas ao longe (camada lenta) e perto (camada rápida)
    if (cenario === "rua-noite" || objetos.has("casas")) {
      for (const [camada, vel, base, alt] of [[c.longe, 0.25, CHAO - 40, 260], [c.perto, 0.6, CHAO, 330]] as const) {
        const larg = 260;
        const ini = -((pan * vel) % larg) - larg;
        for (let x = ini; x < W + larg; x += larg) {
          const idx = Math.floor((x + pan * vel) / larg);
          const rr = rnd(seed + idx * 97 + (vel > 0.5 ? 7 : 3));
          const h = alt * (0.6 + rr() * 0.5);
          p.push(`<rect x="${n(x)}" y="${n(base - h)}" width="${larg - 18}" height="${n(h)}" fill="${camada}"/>`);
          p.push(`<polygon points="${n(x - 8)},${n(base - h)} ${n(x + (larg - 18) / 2)},${n(base - h - 70)} ${n(x + larg - 10)},${n(base - h)}" fill="${camada}"/>`);
          for (let j = 0; j < 4; j++) if (rr() > 0.55) p.push(`<rect x="${n(x + 30 + (j % 2) * 110)}" y="${n(base - h + 50 + Math.floor(j / 2) * 95)}" width="48" height="58" fill="${c.janela}" opacity="${vel > 0.5 ? 0.85 : 0.5}"/>`);
        }
      }
    }
    if (cenario === "floresta" || objetos.has("arvores")) {
      for (const [camada, vel, esc2] of [[c.longe, 0.3, 0.7], [c.perto, 0.7, 1]] as const) {
        const larg = 190;
        const ini = -((pan * vel) % larg) - larg;
        for (let x = ini; x < W + larg; x += larg) {
          const rr = rnd(seed + Math.floor((x + pan * vel) / larg) * 31 + (vel > 0.5 ? 1 : 2));
          const h = (380 + rr() * 260) * esc2;
          p.push(`<rect x="${n(x + 80)}" y="${n(CHAO - h * 0.35)}" width="26" height="${n(h * 0.35)}" fill="${camada}"/>`);
          p.push(`<polygon points="${n(x + 93)},${n(CHAO - h)} ${n(x + 10)},${n(CHAO - h * 0.3)} ${n(x + 176)},${n(CHAO - h * 0.3)}" fill="${camada}"/>`);
        }
      }
    }
    if (objetos.has("poste") || cenario === "rua-noite") {
      const px = n(((W * 0.25 - pan * 0.9) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2);
      p.push(`<rect x="${px}" y="${CHAO - 520}" width="14" height="520" fill="${c.perto}"/><rect x="${px - 40}" y="${CHAO - 525}" width="70" height="14" rx="6" fill="${c.perto}"/>`);
      if (objetos.has("poste")) p.push(`<polygon points="${px - 30},${CHAO - 505} ${px - 160},${CHAO} ${px + 100},${CHAO}" fill="${c.luz}" opacity="0.10"/>`);
    }
    // cerca baixa
    if (cenario === "rua-noite") {
      const ini = -((pan) % 60) - 60;
      for (let x = ini; x < W + 60; x += 60) p.push(`<rect x="${n(x)}" y="${CHAO - 70}" width="10" height="70" fill="${c.borda}" opacity="0.35"/>`);
      p.push(`<rect x="0" y="${CHAO - 62}" width="${W}" height="8" fill="${c.borda}" opacity="0.3"/>`);
    }
  } else {
    // interiores: parede, rodapé, elementos do ambiente
    p.push(`<rect width="${W}" height="${CHAO}" fill="${c.longe}"/>`);
    p.push(`<rect y="${CHAO - 18}" width="${W}" height="18" fill="${c.perto}"/>`);
    if (cenario === "corredor") {
      p.push(`<polygon points="${W * 0.38},${CHAO - 420} ${W * 0.62},${CHAO - 420} ${W},${CHAO} 0,${CHAO}" fill="${c.chao}" opacity="0.8"/>`);
      p.push(`<rect x="${W * 0.44}" y="${CHAO - 560}" width="${W * 0.12}" height="140" fill="${c.luz}" opacity="0.25"/>`);
      for (let i = 0; i < 3; i++) {
        const y = 140 + i * 120, e = 0.45 + i * 0.25;
        p.push(`<ellipse cx="${W / 2}" cy="${y}" rx="${n(60 * e)}" ry="${n(14 * e)}" fill="${c.luz}" opacity="${n(0.5 + 0.4 * Math.abs(Math.sin(t * 7 + i)) * (objetos.has("luz-ao-longe") ? 1 : 0.2))}"/>`);
        p.push(`<rect x="${n(W * 0.5 - (340 + i * 120))}" y="${n(CHAO - 520 + i * 60)}" width="${n(110 + i * 40)}" height="${n(330 + i * 80)}" fill="${c.perto}"/>`);
        p.push(`<rect x="${n(W * 0.5 + (230 + i * 80))}" y="${n(CHAO - 520 + i * 60)}" width="${n(110 + i * 40)}" height="${n(330 + i * 80)}" fill="${c.perto}"/>`);
      }
    }
    if (cenario === "elevador") {
      p.push(`<rect x="${W * 0.12}" y="180" width="${W * 0.76}" height="${CHAO - 180}" fill="${c.perto}" stroke="${c.borda}" stroke-width="6"/>`);
      p.push(`<rect x="${W * 0.44}" y="230" width="${W * 0.12}" height="70" rx="8" fill="#000"/><text x="${W / 2}" y="285" font-family="Arial Black, Arial" font-size="52" fill="#ff3b3b" text-anchor="middle">13</text>`);
      p.push(`<rect x="${W * 0.8}" y="560" width="70" height="300" rx="10" fill="${c.longe}" stroke="${c.borda}" stroke-width="3"/>`);
      for (let i = 0; i < 6; i++) p.push(`<circle cx="${W * 0.8 + 35}" cy="${600 + i * 45}" r="13" fill="${i === 0 ? "#ff3b3b" : c.borda}" opacity="${i === 0 ? n(0.6 + 0.4 * Math.sin(t * 6)) : 0.6}"/>`);
    }
    if (cenario === "casa" || cenario === "quarto") {
      p.push(`<rect x="${W * 0.12}" y="${CHAO - 760}" width="200" height="190" fill="${c.ceu1}" stroke="${c.borda}" stroke-width="10"/><line x1="${W * 0.12 + 100}" y1="${CHAO - 760}" x2="${W * 0.12 + 100}" y2="${CHAO - 570}" stroke="${c.borda}" stroke-width="8"/><circle cx="${W * 0.12 + 60}" cy="${CHAO - 700}" r="22" fill="${c.luz}" opacity="0.8"/>`);
      if (cenario === "quarto") p.push(`<rect x="${W * 0.55}" y="${CHAO - 170}" width="380" height="130" rx="12" fill="${c.perto}"/><rect x="${W * 0.55}" y="${CHAO - 230}" width="110" height="70" rx="14" fill="${c.borda}" opacity="0.6"/>`);
    }
    if (cenario === "loja" || cenario === "cozinha") {
      for (let i = 0; i < 3; i++) p.push(`<rect x="60" y="${300 + i * 170}" width="${W - 120}" height="16" fill="${c.perto}"/>`);
      const rr = rnd(seed + 5);
      for (let i = 0; i < 18; i++) p.push(`<rect x="${n(80 + (i % 6) * 160 + rr() * 40)}" y="${n(230 + Math.floor(i / 6) * 170)}" width="${n(50 + rr() * 50)}" height="70" rx="8" fill="${[c.janela, c.borda, c.luz][i % 3]}" opacity="0.55"/>`);
      p.push(`<rect x="0" y="${CHAO - 240}" width="${W}" height="240" fill="${c.perto}"/><rect x="0" y="${CHAO - 250}" width="${W}" height="20" fill="${c.borda}" opacity="0.6"/>`);
    }
    if (cenario === "escritorio") {
      p.push(`<rect x="${W * 0.5}" y="${CHAO - 300}" width="400" height="30" fill="${c.perto}"/><rect x="${W * 0.5 + 40}" y="${CHAO - 270}" width="20" height="270" fill="${c.perto}"/><rect x="${W * 0.5 + 340}" y="${CHAO - 270}" width="20" height="270" fill="${c.perto}"/>`);
      p.push(`<rect x="${W * 0.5 + 110}" y="${CHAO - 480}" width="230" height="160" rx="10" fill="#000" stroke="${c.borda}" stroke-width="6"/><rect x="${W * 0.5 + 125}" y="${CHAO - 465}" width="200" height="130" fill="${c.luz}" opacity="${n(0.35 + 0.1 * Math.sin(t * 3))}"/>`);
    }
  }
  if (cenario === "escuro") p.push(`<rect width="${W}" height="${H}" fill="#000" opacity="0.6"/>`);

  // objetos soltos
  if (objetos.has("porta")) p.push(`<rect x="${W * 0.66}" y="${CHAO - 470}" width="230" height="470" fill="${c.perto}" stroke="${c.borda}" stroke-width="8"/><circle cx="${W * 0.66 + 195}" cy="${CHAO - 230}" r="10" fill="${c.luz}"/>${[0, 1].map((i) => `<rect x="${W * 0.66 + 30}" y="${CHAO - 430 + i * 210}" width="170" height="170" fill="none" stroke="${c.borda}" stroke-width="4" opacity="0.6"/>`).join("")}`);
  if (objetos.has("janela") && !interno) p.push(`<rect x="${W * 0.1}" y="${CHAO - 760}" width="200" height="190" fill="${c.janela}" opacity="0.7" stroke="${c.borda}" stroke-width="10"/>`);
  if (objetos.has("bilhete")) p.push(`<g transform="rotate(${n(3 * Math.sin(t))} ${W * 0.4} ${CHAO - 640})"><rect x="${W * 0.4 - 60}" y="${CHAO - 720}" width="120" height="150" fill="#f4e7a1"/>${[0, 1, 2, 3].map((i) => `<rect x="${W * 0.4 - 42}" y="${CHAO - 690 + i * 28}" width="${80 - (i % 2) * 20}" height="8" fill="#8a7a3a"/>`).join("")}</g>`);
  if (objetos.has("carro")) { const cx = n(W * 0.15 - pan * 0.9); p.push(`<rect x="${cx}" y="${CHAO - 150}" width="360" height="110" rx="30" fill="${c.perto}"/><rect x="${cx + 60}" y="${CHAO - 220}" width="220" height="90" rx="30" fill="${c.perto}"/><circle cx="${cx + 80}" cy="${CHAO - 35}" r="38" fill="#000"/><circle cx="${cx + 280}" cy="${CHAO - 35}" r="38" fill="#000"/>`); }
  if (objetos.has("luz-ao-longe") && !interno) p.push(`<circle cx="${W * 0.86}" cy="${CHAO - 260}" r="${n(26 + 6 * Math.sin(t * 2))}" fill="${c.janela}" opacity="0.9"/><circle cx="${W * 0.86}" cy="${CHAO - 260}" r="90" fill="${c.janela}" opacity="0.12"/>`);
  if (objetos.has("vulto")) {
    const vx = W * 0.8, a = n(0.55 + 0.25 * Math.sin(t * 1.3));
    p.push(`<g opacity="${a}"><ellipse cx="${vx}" cy="${CHAO - 330}" rx="34" ry="40" fill="#000"/><path d="M${vx - 55},${CHAO} L${vx - 40},${CHAO - 290} Q${vx},${CHAO - 310} ${vx + 40},${CHAO - 290} L${vx + 55},${CHAO} Z" fill="#000"/><circle cx="${vx - 12}" cy="${CHAO - 335}" r="4" fill="#ff2a2a"/><circle cx="${vx + 12}" cy="${CHAO - 335}" r="4" fill="#ff2a2a"/></g>`);
  }
  if (objetos.has("cachorro")) {
    const dx = W * 0.82, pulo = Math.max(0, Math.sin(t * 9)) * 6;
    p.push(`<g transform="translate(0 ${n(-pulo)})"><ellipse cx="${dx}" cy="${CHAO - 70}" rx="60" ry="30" fill="${c.boneco}"/><circle cx="${dx + 55}" cy="${CHAO - 100}" r="24" fill="${c.boneco}"/><polygon points="${dx + 50},${CHAO - 122} ${dx + 62},${CHAO - 150} ${dx + 70},${CHAO - 118}" fill="${c.boneco}"/>${[-40, -15, 20, 45].map((o) => `<rect x="${dx + o}" y="${CHAO - 50}" width="10" height="50" fill="${c.boneco}"/>`).join("")}</g>`);
    if (Math.sin(t * 4) > 0.6) p.push(`<g transform="translate(${dx + 30} ${CHAO - 190})"><rect x="-38" y="-26" width="76" height="44" rx="20" fill="#fff"/><text y="8" font-family="Arial Black, Arial" font-size="24" text-anchor="middle" fill="#000">AU!</text></g>`);
  }
  // chão
  p.push(`<rect y="${CHAO}" width="${W}" height="${H - CHAO}" fill="url(#chao)"/>`);
  p.push(`<rect y="${CHAO}" width="${W}" height="6" fill="${c.borda}" opacity="0.45"/>`);
  return p.join("");
}

// ───────── personagem (silhueta com articulações) ─────────
type Ponto = [number, number];
const pol = (o: Ponto, ang: number, len: number): Ponto => [o[0] + Math.sin(ang) * len, o[1] + Math.cos(ang) * len];
const rad = (g: number) => (g * Math.PI) / 180;

function boneco(c: Cores, acao: Acao, x: number, t: number, dir: 1 | -1, cor: string, objetos: Set<Objeto>) {
  if (acao === "sem-personagem") return "";
  const s = 1.15; // escala
  const vel = acao === "correndo" ? 9 : acao === "andando" ? 5 : 0;
  const ph = t * vel;
  const resp = Math.sin(t * 2.2) * 3; // respiração
  const agach = acao === "escondido" ? 70 : acao === "sentado" ? 95 : 0;
  const tremer = acao === "assustado" ? Math.sin(t * 40) * 3 : 0;
  const quadril: Ponto = [x + tremer, CHAO - 175 * s + agach - (vel ? Math.abs(Math.sin(ph)) * 10 : 0)];
  const incl = acao === "correndo" ? rad(14) * dir : acao === "escondido" ? rad(-8) * dir : 0;
  const ombro = pol(quadril, Math.PI + incl, 128 * s + resp * 0.3);
  const pescoco = pol(ombro, Math.PI + incl, 22 * s);
  const cab: Ponto = [pescoco[0] + Math.sin(incl) * 30, pescoco[1] - 34 * s];

  // pernas
  const pernas: [number, number][] = [];
  if (vel) { const a = Math.sin(ph) * (acao === "correndo" ? 42 : 26); pernas.push([a, Math.max(0, -Math.cos(ph)) * 50], [-a, Math.max(0, Math.cos(ph)) * 50]); }
  else if (acao === "sentado") pernas.push([75, 90], [65, 95]);
  else if (acao === "escondido") pernas.push([40, 80], [-15, 70]);
  else pernas.push([6, 2], [-6, 2]);
  // braços: [ombro°, cotovelo°]
  let bracos: [number, number][];
  if (vel) {
    const a = Math.sin(ph + Math.PI) * (acao === "correndo" ? 55 : 30);
    // com lanterna, o braço da frente fica apontando para onde ele vai (só balança um pouco)
    bracos = objetos.has("lanterna") ? [[84 + Math.sin(ph) * 6, 0], [-a, 70]] : [[a, 70], [-a, 70]]; // cotovelo dobrado para a frente, como quem corre
  }
  else if (acao === "assustado") bracos = [[150 + Math.sin(t * 30) * 5, 30], [-150, -30]];
  else if (acao === "apontando") bracos = [[95, 0], [-10, -10]];
  else if (acao === "celular") bracos = [[55, 95], [-10, -10]];
  else if (objetos.has("lanterna")) bracos = [[90, 0], [-12, -20]];
  else bracos = [[12 + resp, -8], [-12 - resp, 8]];

  const linhas: string[] = [];
  const seg = (a: Ponto, b: Ponto, w: number) => linhas.push(`<line x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}" stroke="${c.boneco}" stroke-width="${w}" stroke-linecap="round"/>`);
  for (const [coxa, joelho] of pernas) {
    const j = pol(quadril, rad(coxa) * dir, 92 * s);
    const p = pol(j, rad(coxa - joelho) * dir, 88 * s);
    seg(quadril, j, 40); seg(j, p, 34);
    linhas.push(`<ellipse cx="${n(p[0] + 12 * dir)}" cy="${n(p[1] + 4)}" rx="26" ry="11" fill="${c.boneco}"/>`);
  }
  seg(quadril, ombro, 64);
  let mao: Ponto = ombro;
  bracos.forEach(([o, cot], i) => {
    const e = pol(ombro, rad(o) * dir, 72 * s); // 0° = braço caído, 90° = para frente, 150° = erguido
    const m = pol(e, rad(o + cot) * dir, 66 * s);
    seg(ombro, e, 30); seg(e, m, 27);
    if (i === 0) mao = m;
  });
  linhas.push(`<circle cx="${n(cab[0])}" cy="${n(cab[1])}" r="${48 * s}" fill="${c.boneco}"/>`);
  // boné: a cor do personagem (identidade fixa em todas as cenas)
  linhas.push(`<path d="M${n(cab[0] - 50 * s)},${n(cab[1] - 6)} Q${n(cab[0])},${n(cab[1] - 74 * s)} ${n(cab[0] + 50 * s)},${n(cab[1] - 6)} Z" fill="${cor}"/><rect x="${n(dir > 0 ? cab[0] + 20 : cab[0] - 70)}" y="${n(cab[1] - 12)}" width="50" height="12" rx="6" fill="${cor}"/>`);
  linhas.push(`<circle cx="${n(cab[0])}" cy="${n(cab[1])}" r="${48 * s}" fill="none" stroke="${c.borda}" stroke-width="3" opacity="0.5"/>`);

  let extra = "";
  if (objetos.has("lanterna")) {
    const alc = 900, ab = 170 + 20 * Math.sin(t * 1.7);
    const fx = mao[0] + alc * dir;
    extra += `<polygon points="${n(mao[0])},${n(mao[1])} ${n(fx)},${n(mao[1] - ab)} ${n(fx)},${n(mao[1] + ab)}" fill="url(#cone${dir > 0 ? "D" : "E"})"/><circle cx="${n(mao[0])}" cy="${n(mao[1])}" r="12" fill="${c.luz}"/>`;
  }
  if (acao === "celular") extra += `<rect x="${n(mao[0] - 16)}" y="${n(mao[1] - 30)}" width="32" height="54" rx="6" fill="${c.luz}"/><circle cx="${n(cab[0])}" cy="${n(cab[1])}" r="120" fill="${c.luz}" opacity="0.12"/>`;
  return `<g>${linhas.join("")}${extra}</g>`;
}

// ───────── interface (painel, cartões, legenda, escolha) ─────────
function pilula(x: number, y: number, texto: string, cor: string, fundo: string, alinhar: "start" | "end", ponto?: string) {
  const larg = texto.length * 15 + (ponto ? 58 : 36);
  const x0 = alinhar === "start" ? x : x - larg;
  return `<rect x="${x0}" y="${y}" width="${larg}" height="44" rx="22" fill="${fundo}" opacity="0.85"/>${ponto ? `<circle cx="${x0 + 24}" cy="${y + 22}" r="7" fill="${ponto}"/>` : ""}<text x="${x0 + (ponto ? 40 : 18)}" y="${y + 30}" font-family="Arial Black, Arial" font-size="22" letter-spacing="1" fill="${cor}">${esc(texto)}</text>`;
}

function quebrar(texto: string, max: number) {
  const out: string[] = [];
  let l = "";
  for (const w of texto.split(/\s+/)) { if ((l + " " + w).trim().length > max && l) { out.push(l); l = w; } else l = (l + " " + w).trim(); }
  if (l) out.push(l);
  return out;
}

function cartao(c: Cores, k: AnimCena["cartao"], W: number, prog: number) {
  if (!k) return "";
  const e = Math.min(1, prog * 5); // entra rápido
  const sc = n(0.85 + 0.15 * (1 - Math.pow(1 - e, 3)));
  const op = n(e);
  const cx = W / 2, cy = 700;
  const corpo: string[] = [`<rect x="0" y="0" width="${W}" height="1920" fill="#000" opacity="${n(0.45 * e)}"/>`];
  const g = (inner: string) => corpo.push(`<g opacity="${op}" transform="translate(${cx} ${cy}) scale(${sc}) translate(${-cx} ${-cy})">${inner}</g>`);
  if (k.tipo === "numero") {
    g(`<text x="${cx}" y="${cy + 120}" font-family="Arial Black, Arial" font-size="360" fill="#fff" text-anchor="middle">${esc(k.titulo.slice(0, 4))}</text>${k.texto ? `<text x="${cx}" y="${cy + 220}" font-family="Arial Black, Arial" font-size="56" fill="${c.destaque}" text-anchor="middle">${esc(k.texto.slice(0, 24).toUpperCase())}</text>` : ""}`);
  } else if (k.tipo === "titulo") {
    const ls = quebrar(k.titulo.toUpperCase(), 14).slice(0, 3);
    g(ls.map((l, i) => `<text x="${cx}" y="${cy - (ls.length - 1) * 60 + i * 120}" font-family="Arial Black, Arial" font-size="104" fill="${i === ls.length - 1 ? c.destaque : "#fff"}" text-anchor="middle">${esc(l)}</text>`).join("") + (k.texto ? `<text x="${cx}" y="${cy + ls.length * 60 + 40}" font-family="Arial" font-size="40" fill="#ddd" text-anchor="middle">${esc(k.texto.slice(0, 44))}</text>` : ""));
  } else if (k.tipo === "regra") {
    const ls = quebrar((k.texto ?? "").toUpperCase(), 22).slice(0, 4);
    const h = 170 + ls.length * 64;
    g(`<rect x="${cx - 400}" y="${cy - h / 2}" width="800" height="${h}" rx="34" fill="#141a35" stroke="#3b4380" stroke-width="4"/><rect x="${cx - 230}" y="${cy - h / 2 - 46}" width="460" height="92" rx="46" fill="${c.destaque}"/><text x="${cx}" y="${cy - h / 2 + 16}" font-family="Arial Black, Arial" font-size="50" fill="#141a35" text-anchor="middle">${esc(k.titulo.toUpperCase().slice(0, 18))}</text>${ls.map((l, i) => `<text x="${cx}" y="${cy - h / 2 + 130 + i * 64}" font-family="Arial Black, Arial" font-size="48" fill="#fff" text-anchor="middle">${esc(l)}</text>`).join("")}`);
  } else if (k.tipo === "celular") {
    const msgs = quebrar(k.texto ?? "", 20).slice(0, 4);
    g(`<rect x="${cx - 280}" y="${cy - 460}" width="560" height="920" rx="60" fill="#0d0f17" stroke="#2a2f45" stroke-width="10"/><rect x="${cx - 70}" y="${cy - 440}" width="140" height="26" rx="13" fill="#000"/><circle cx="${cx - 200}" cy="${cy - 350}" r="30" fill="#ff3b6b"/><text x="${cx - 200}" y="${cy - 338}" font-family="Arial Black, Arial" font-size="30" fill="#fff" text-anchor="middle">${esc((k.remetente ?? "?").slice(0, 1).toUpperCase())}</text><text x="${cx - 155}" y="${cy - 355}" font-family="Arial Black, Arial" font-size="34" fill="#fff">${esc((k.remetente ?? "Desconhecido").slice(0, 16))}</text><text x="${cx - 155}" y="${cy - 318}" font-family="Arial" font-size="24" fill="#8a90a8">online</text><rect x="${cx - 120}" y="${cy - 270}" width="240" height="40" rx="20" fill="#ff3b6b"/><text x="${cx}" y="${cy - 242}" font-family="Arial Black, Arial" font-size="20" fill="#fff" text-anchor="middle">MENSAGEM NOVA</text><rect x="${cx - 230}" y="${cy - 200}" width="${Math.min(460, 60 + Math.max(...msgs.map((m) => m.length), 4) * 21)}" height="${40 + msgs.length * 50}" rx="26" fill="#262b3d"/>${msgs.map((m, i) => `<text x="${cx - 200}" y="${cy - 150 + i * 50}" font-family="Arial" font-size="38" fill="#fff">${esc(m)}</text>`).join("")}`);
  }
  return corpo.join("");
}

function legenda(c: Cores, palavras: string[], atual: number, destaques: Set<string>, W: number, perigo: boolean) {
  if (!palavras.length) return "";
  const txt = palavras.map((w, i) => {
    const limpo = w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    const cor = destaques.has(limpo) ? (perigo ? "#ff3b4f" : c.destaque) : i <= atual ? "#ffffff" : "#ffffff";
    return `<tspan fill="${cor}" opacity="${i <= atual ? 1 : 0.55}">${esc(w.toUpperCase())}</tspan>`;
  }).join(" ");
  // Arial Black em caixa alta ocupa ~0,72 da altura por letra: encolhe para caber em 88% da largura
  const tam = Math.max(48, Math.min(96, Math.floor((W * 0.88) / (palavras.join(" ").length * 0.72))));
  return `<text x="${W / 2}" y="1335" font-family="Arial Black, Arial" font-size="${tam}" stroke="#000" stroke-width="10" paint-order="stroke" stroke-linejoin="round" text-anchor="middle">${txt}</text>`;
}

function escolha(c: Cores, e: NonNullable<AnimVideo["escolha"]>, W: number, prog: number) {
  const ent = (d: number) => Math.min(1, Math.max(0, (prog - d) * 4));
  const caixa = (y: number, letra: string, texto: string, cor: string, a: number) => {
    const ls = quebrar(texto, 24).slice(0, 2);
    return `<g opacity="${n(a)}" transform="translate(${n((1 - a) * 80)} 0)"><rect x="90" y="${y}" width="${W - 180}" height="${110 + ls.length * 50}" rx="30" fill="#141a35" stroke="${cor}" stroke-width="6"/><rect x="120" y="${y + 28}" width="90" height="90" rx="20" fill="${cor}"/><text x="165" y="${y + 92}" font-family="Arial Black, Arial" font-size="60" fill="#141a35" text-anchor="middle">${letra}</text>${ls.map((l, i) => `<text x="240" y="${y + 70 + i * 50}" font-family="Arial Black, Arial" font-size="40" fill="#fff">${esc(l)}</text>`).join("")}</g>`;
  };
  return `<rect width="${W}" height="1920" fill="#000" opacity="${n(0.55 * ent(0))}"/><text x="${W / 2}" y="420" font-family="Arial Black, Arial" font-size="74" fill="#fff" text-anchor="middle" opacity="${n(ent(0))}">E AGORA?</text>${caixa(520, "A", e.a, c.destaque, ent(0.1))}${caixa(800, "B", e.b, "#ff3b6b", ent(0.25))}<text x="${W / 2}" y="1170" font-family="Arial Black, Arial" font-size="54" fill="${c.destaque}" text-anchor="middle" opacity="${n(ent(0.4))}">COMENTE A OU B</text>`;
}

export type QuadroEntrada = {
  W: number; H: number;
  cena: AnimCena; t: number; dur: number; seed: number;
  video: AnimVideo;
  legenda?: { palavras: string[]; atual: number };
  escolhaProg?: number; // 0..1 quando é a tela final de escolha
};

/** SVG completo de um quadro. */
export function quadro(q: QuadroEntrada): string {
  const { W, H, cena, t, dur } = q;
  const c = PALETA[cena.paleta] ?? PALETA.noite;
  const objetos = new Set(cena.objetos ?? []);
  const dir: 1 | -1 = cena.direcao === "esquerda" ? -1 : 1;
  const correndo = cena.acao === "correndo" ? 520 : cena.acao === "andando" ? 220 : 40;
  const pan = t * correndo * dir; // câmera acompanha o personagem: o cenário anda
  const efeito = cena.efeito ?? "nenhum";
  const perigo = efeito === "perigo";
  const zoom = efeito === "zoom" ? 1 + 0.08 * (t / Math.max(1, dur)) : 1;
  const tremor = efeito === "tremor" || (perigo && t < 0.5) ? [Math.sin(t * 53) * 9, Math.cos(t * 47) * 7] : [0, 0];
  const px = cena.acao === "andando" || cena.acao === "correndo" ? W * (dir > 0 ? 0.38 : 0.62) : W * (objetos.has("porta") ? 0.38 : 0.5);

  const cena1 = fundo(c, cena.cenario, W, H, pan, q.seed, objetos, t) + boneco(c, cena.acao, px, t, dir, q.video.corPersonagem ?? "#e23a3a", objetos);
  const partes: string[] = [];
  partes.push(`<g transform="translate(${n(tremor[0] + (W - W * zoom) / 2)} ${n(tremor[1] + (CHAO - CHAO * zoom) / 2)}) scale(${n(zoom * 1000) / 1000})">${cena1}</g>`);
  if (efeito === "chuva") for (let i = 0; i < 70; i++) { const x = ((i * 137 + t * 900) % (W + 200)) - 100, y = ((i * 263 + t * 1800) % H); partes.push(`<line x1="${n(x)}" y1="${n(y)}" x2="${n(x - 14)}" y2="${n(y + 46)}" stroke="#9fb4ff" stroke-width="3" opacity="0.35"/>`); }
  if (efeito === "luz-piscando") partes.push(`<rect width="${W}" height="${H}" fill="#000" opacity="${Math.sin(t * 23) > 0.3 || Math.sin(t * 7) > 0.85 ? 0.7 : 0.05}"/>`);
  if (perigo) partes.push(`<rect width="${W}" height="${H}" fill="#ff1a2e" opacity="${n(0.16 + 0.12 * Math.abs(Math.sin(t * 3.2)))}"/>`);
  partes.push(`<rect width="${W}" height="${H}" fill="url(#vinheta)"/>`);
  // painel de cima
  if (q.video.episodio) partes.push(pilula(44, 60, q.video.episodio.toUpperCase().slice(0, 28), "#ffffff", "#000000", "start"));
  if (cena.status) partes.push(pilula(W - 44, 60, cena.status.toUpperCase().slice(0, 24), cena.alerta ? "#ff4d5e" : "#ffffff", "#000000", "end", cena.alerta ? "#ff4d5e" : undefined));
  if (cena.cartao) partes.push(cartao(c, cena.cartao, W, t / Math.max(0.5, dur)));
  if (q.escolhaProg !== undefined && q.video.escolha) partes.push(escolha(c, q.video.escolha, W, q.escolhaProg));
  if (q.legenda) partes.push(legenda(c, q.legenda.palavras, q.legenda.atual, new Set((cena.destaques ?? []).map((d) => d.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""))), W, perigo));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>
<linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.ceu1}"/><stop offset="1" stop-color="${c.ceu2}"/></linearGradient>
<linearGradient id="chao" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.chao}"/><stop offset="1" stop-color="#05060c"/></linearGradient>
<linearGradient id="coneD" x1="0" x2="1"><stop offset="0" stop-color="${c.luz}" stop-opacity="0.75"/><stop offset="1" stop-color="${c.luz}" stop-opacity="0"/></linearGradient>
<linearGradient id="coneE" x1="1" x2="0"><stop offset="0" stop-color="${c.luz}" stop-opacity="0.75"/><stop offset="1" stop-color="${c.luz}" stop-opacity="0"/></linearGradient>
<radialGradient id="vinheta" cx="0.5" cy="0.42" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.75"/></radialGradient>
</defs>${partes.join("")}</svg>`;
}
