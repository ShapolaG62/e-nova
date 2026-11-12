import "server-only";
import type { CorteCena, CorteVideo, PecaCorte } from "./tipos";

// Mundo em corte ("Como funciona"): um lugar só, visto de lado, com o chão aberto como um corte de
// terreno. A cada passo da explicação uma peça nova cresce (tanque, muro, poço, cúpula…), um boneco
// palito constrói e aponta, etiquetas e selos explicam, e a legenda vem de 1 ou 2 palavras.
// Estilo original: traço preto simples, cores chapadas, boneco de boné colorido.

const Y_CHAO = 820;           // superfície do chão (acima: céu; abaixo: o corte do terreno)
const Y_LEGENDA = 1560; // (igual a ZONA.legendaY)
const n = (v: number) => Math.round(v * 10) / 10;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const lim = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const saida = (x: number) => { const v = lim(x); return 1 - Math.pow(1 - v, 3); };
/** Entra com um pequeno "pulo" (passa de 1 e volta), como peça encaixando. */
export const pulo = (x: number) => { const v = lim(x); const c = 1.70158 * 1.4; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); };
const TINTA = "#2a2420";
const FONTE = "Arial Black, Arial";

function rnd(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

// ───────── céu, horizonte e corte do terreno ─────────
const CEUS = {
  dia: ["#8ec5ea", "#dcefe9"],
  entardecer: ["#b9a3c4", "#f2c9a0"],
  noite: ["#0e1a3a", "#34477a"],
} as const;
const TERRENO: Record<CorteVideo["ambiente"], { chao: string; faixa: string; topo: string; longe: string; perto: string }> = {
  deserto: { chao: "#c99962", faixa: "#b98a55", topo: "#e2bd84", longe: "#e9cc98", perto: "#dcb478" },
  campo: { chao: "#9b6b45", faixa: "#8a5d3b", topo: "#7fb35a", longe: "#a9cf86", perto: "#8fc068" },
  cidade: { chao: "#8a7a6c", faixa: "#7b6c5f", topo: "#9a9a9a", longe: "#b8c1cc", perto: "#9aa5b3" },
  praia: { chao: "#d8b57e", faixa: "#c8a46d", topo: "#efd9a8", longe: "#5fb4d6", perto: "#e8cf98" },
  neve: { chao: "#8d7b6e", faixa: "#7e6d61", topo: "#f4f7fb", longe: "#dfe8f2", perto: "#eef3f8" },
  montanha: { chao: "#93765c", faixa: "#836850", topo: "#8fb06a", longe: "#9fb0c4", perto: "#7f9a6a" },
  floresta: { chao: "#7d5a3c", faixa: "#6e4f34", topo: "#5f9a4c", longe: "#7fae74", perto: "#4f8a44" },
  fabrica: { chao: "#7c7066", faixa: "#6e635a", topo: "#8d8d8d", longe: "#a9b0b8", perto: "#8f979f" },
};

function fundo(v: CorteVideo, ceu: keyof typeof CEUS, W: number, H: number, t: number, seed: number) {
  const tr = TERRENO[v.ambiente] ?? TERRENO.deserto;
  const [c1, c2] = CEUS[ceu];
  const r = rnd(seed);
  const p: string[] = [];
  p.push(`<defs><linearGradient id="ceuC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>`);
  p.push(`<rect width="${W}" height="${Y_CHAO + 4}" fill="url(#ceuC)"/>`);
  if (ceu === "noite") {
    for (let i = 0; i < 60; i++) { const x = r() * W, y = r() * (Y_CHAO - 260); p.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(1.5 + r() * 2.5)}" fill="#fff" opacity="${n(0.35 + 0.5 * Math.abs(Math.sin(t * 2 + i)))}"/>`); }
    p.push(`<circle cx="${W * 0.8}" cy="230" r="48" fill="#eef1ff"/><circle cx="${W * 0.8 + 18}" cy="220" r="42" fill="${c1}" opacity="0.35"/>`);
  } else {
    const sx = W * 0.82, sy = ceu === "entardecer" ? 560 : 230;
    const raios = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2 + t * 0.3; return `<line x1="${n(sx + Math.cos(a) * 70)}" y1="${n(sy + Math.sin(a) * 70)}" x2="${n(sx + Math.cos(a) * 92)}" y2="${n(sy + Math.sin(a) * 92)}" stroke="#f0a43a" stroke-width="6" stroke-linecap="round"/>`; }).join("");
    p.push(`${raios}<circle cx="${sx}" cy="${sy}" r="58" fill="#f6b04a" stroke="#e08a2a" stroke-width="5"/>`);
    // nuvens lentas
    for (let i = 0; i < 3; i++) { const x = ((r() * W + t * 14 * (i + 1)) % (W + 300)) - 150, y = 150 + r() * 260; p.push(`<g opacity="0.85"><ellipse cx="${n(x)}" cy="${n(y)}" rx="80" ry="26" fill="#fff"/><ellipse cx="${n(x + 46)}" cy="${n(y - 16)}" rx="52" ry="26" fill="#fff"/></g>`); }
  }
  // horizonte: duas camadas (longe e perto) conforme o ambiente
  const ondas = (y: number, amp: number, fase: number, cor: string) => {
    const pts: string[] = [`M0 ${Y_CHAO + 4}`];
    for (let x = 0; x <= W; x += 60) pts.push(`L${x} ${n(y + Math.sin(x / 170 + fase) * amp + Math.sin(x / 61 + fase * 2) * amp * 0.25)}`);
    pts.push(`L${W} ${Y_CHAO + 4}Z`);
    return `<path d="${pts.join("")}" fill="${cor}"/>`;
  };
  if (v.ambiente === "cidade" || v.ambiente === "fabrica") {
    const r2 = rnd(seed + 5);
    for (let x = -20; x < W; x += 70 + r2() * 60) { const h = 80 + r2() * 200, w = 60 + r2() * 70; p.push(`<rect x="${n(x)}" y="${n(Y_CHAO - h)}" width="${n(w)}" height="${n(h)}" fill="${tr.longe}" stroke="${TINTA}" stroke-opacity="0.18" stroke-width="3"/>`); }
    if (v.ambiente === "fabrica") p.push(`<rect x="${W * 0.12}" y="${Y_CHAO - 330}" width="44" height="330" fill="${tr.perto}" stroke="${TINTA}" stroke-width="4"/><circle cx="${W * 0.12 + 22 + Math.sin(t) * 6}" cy="${Y_CHAO - 370 - (t * 30) % 80}" r="30" fill="#ccc" opacity="0.6"/>`);
  } else if (v.ambiente === "montanha") {
    p.push(`<path d="M0 ${Y_CHAO} L${W * 0.22} ${Y_CHAO - 330} L${W * 0.45} ${Y_CHAO} Z M${W * 0.35} ${Y_CHAO} L${W * 0.66} ${Y_CHAO - 420} L${W} ${Y_CHAO} Z" fill="${tr.longe}" stroke="${TINTA}" stroke-opacity="0.25" stroke-width="4"/>`);
  } else if (v.ambiente === "praia") {
    p.push(`<rect y="${Y_CHAO - 90}" width="${W}" height="94" fill="${tr.longe}"/><path d="M0 ${Y_CHAO - 90} Q ${W / 4} ${Y_CHAO - 100 + Math.sin(t * 2) * 6} ${W / 2} ${Y_CHAO - 90} T ${W} ${Y_CHAO - 90}" stroke="#fff" stroke-width="5" fill="none" opacity="0.7"/>`);
  } else {
    p.push(ondas(Y_CHAO - 150, 40, 0.6, tr.longe));
    p.push(ondas(Y_CHAO - 70, 28, 2.1, tr.perto));
    if (v.ambiente === "floresta" || v.ambiente === "campo") {
      const r3 = rnd(seed + 9);
      for (let i = 0; i < (v.ambiente === "floresta" ? 9 : 4); i++) { const x = r3() * W, h = 70 + r3() * 90; p.push(`<rect x="${n(x - 6)}" y="${n(Y_CHAO - 60 - h * 0.4)}" width="12" height="${n(h * 0.5)}" fill="#6b4a2f"/><circle cx="${n(x)}" cy="${n(Y_CHAO - 70 - h * 0.45)}" r="${n(h * 0.35)}" fill="${tr.topo}" stroke="${TINTA}" stroke-opacity="0.25" stroke-width="3"/>`); }
    }
  }
  // corte do terreno: faixas, pedrinhas e a borda de cima
  p.push(`<rect x="-${W}" y="${Y_CHAO}" width="${W * 3}" height="${H * 2}" fill="${tr.chao}"/>`);
  for (let i = 0; i < 9; i++) { const y = Y_CHAO + 60 + i * 120 + Math.sin(i * 1.7) * 14; p.push(`<path d="M0 ${n(y)} Q ${W / 3} ${n(y - 18)} ${W * 0.6} ${n(y + 6)} T ${W} ${n(y - 4)}" stroke="${tr.faixa}" stroke-width="10" fill="none" opacity="0.55"/>`); }
  const r4 = rnd(seed + 3);
  for (let i = 0; i < 90; i++) { const x = r4() * W, y = Y_CHAO + 30 + r4() * (H - Y_CHAO - 40); p.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(2 + r4() * 4)}" fill="${tr.faixa}" opacity="0.8"/>`); }
  p.push(`<rect y="${Y_CHAO - 6}" width="${W}" height="18" fill="${tr.topo}"/><line x1="0" y1="${Y_CHAO + 12}" x2="${W}" y2="${Y_CHAO + 12}" stroke="${TINTA}" stroke-width="4" opacity="0.5"/>`);
  return p.join("");
}

// ───────── peças ─────────
type Caixa = { x: number; y: number; w: number; h: number };
export function caixaDaPeca(p: PecaCorte, W: number, todas?: Map<string, PecaCorte>, nivel = 0): Caixa {
  const mae = p.dentro && todas && nivel < 3 ? todas.get(p.dentro) : undefined;
  if (mae && mae.id !== p.id) {
    // dentro de outra peça: centralizada e apoiada no fundo dela
    const m = caixaDaPeca(mae, W, todas, nivel + 1);
    const w = Math.min(lim(p.largura, 0.05, 0.75) * W, m.w * 0.84);
    const h = Math.min(w * lim(p.altura ?? 1, 0.15, 3.5), m.h * 0.92);
    return { x: m.x + (m.w - w) / 2, y: m.y + m.h - h - 12, w, h };
  }
  const w = lim(p.largura, 0.05, 0.75) * W;
  // enterrada nunca passa do fundo da tela (a câmera não mostra além do terreno)
  const h = Math.min(w * lim(p.altura ?? 1, 0.15, 3.5), p.lugar === "subsolo" ? 1920 - Y_CHAO - 150 : 9999);
  const x = lim(p.x, 0.04, 0.96) * W - w / 2;
  const y = p.lugar === "subsolo" ? Y_CHAO + 4 : p.lugar === "ceu" ? 300 - h / 2 : Y_CHAO + 6 - h;
  return { x, y, w, h };
}

function tijolos(b: Caixa, cor: string) {
  const linhas: string[] = [];
  const alt = Math.max(18, b.h / Math.max(3, Math.round(b.h / 34)));
  for (let y = b.y + alt, k = 0; y < b.y + b.h - 2; y += alt, k++) {
    linhas.push(`<line x1="${n(b.x)}" y1="${n(y)}" x2="${n(b.x + b.w)}" y2="${n(y)}"/>`);
    for (let x = b.x + (k % 2 ? alt * 1.1 : alt * 2.2); x < b.x + b.w - 4; x += alt * 2.2) linhas.push(`<line x1="${n(x)}" y1="${n(y)}" x2="${n(x)}" y2="${n(y + alt)}"/>`);
  }
  return `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${cor}" stroke="${TINTA}" stroke-width="5"/><g stroke="${TINTA}" stroke-opacity="0.45" stroke-width="2.5">${linhas.join("")}</g>`;
}

function pecaPronta(p: PecaCorte, b: Caixa, t: number): string {
  const cor = p.cor;
  switch (p.pronta) {
    case "buraco": {
      const m = b.w * 0.06;
      return `<path d="M${n(b.x)} ${n(b.y)} L${n(b.x + b.w)} ${n(b.y)} L${n(b.x + b.w - m)} ${n(b.y + b.h)} L${n(b.x + m)} ${n(b.y + b.h)} Z" fill="${cor ?? "#6e4f35"}" stroke="${TINTA}" stroke-width="6"/><path d="M${n(b.x + 10)} ${n(b.y + 6)} L${n(b.x + b.w - 10)} ${n(b.y + 6)} L${n(b.x + b.w - m - 6)} ${n(b.y + b.h - 8)} L${n(b.x + m + 6)} ${n(b.y + b.h - 8)} Z" fill="#000" opacity="0.18"/>`;
    }
    case "agua": {
      const onda = Math.sin(t * 2.4) * 4;
      return `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="6" fill="${cor ?? "#3f8fd6"}" stroke="${TINTA}" stroke-width="5"/><path d="M${n(b.x + 8)} ${n(b.y + 10 + onda)} Q ${n(b.x + b.w / 4)} ${n(b.y + 2 + onda)} ${n(b.x + b.w / 2)} ${n(b.y + 10 + onda)} T ${n(b.x + b.w - 8)} ${n(b.y + 10 + onda)}" stroke="#bfe3ff" stroke-width="5" fill="none"/>`;
    }
    case "blocos": {
      const lado = Math.max(28, Math.min(b.w / 4, b.h / 2));
      const cols = Math.max(1, Math.floor(b.w / lado)), rows = Math.max(1, Math.floor(b.h / lado));
      const c = cor ?? "#9fd8f7";
      const cubos: string[] = [];
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        const x = b.x + (b.w - cols * lado) / 2 + j * lado, y = b.y + b.h - (i + 1) * lado;
        cubos.push(`<rect x="${n(x + 2)}" y="${n(y + 2)}" width="${n(lado - 4)}" height="${n(lado - 4)}" rx="6" fill="${c}" stroke="${TINTA}" stroke-width="3.5"/><path d="M${n(x + 9)} ${n(y + 12)} l${n(lado * 0.3)} 0" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.8"/>`);
      }
      return cubos.join("");
    }
    case "muro": return tijolos(b, cor ?? "#b8573a");
    case "cupula": {
      const topo = b.y, base = b.y + b.h;
      return `<path d="M${n(b.x)} ${n(base)} Q ${n(b.x + b.w * 0.12)} ${n(topo + b.h * 0.25)} ${n(b.x + b.w / 2)} ${n(topo)} Q ${n(b.x + b.w * 0.88)} ${n(topo + b.h * 0.25)} ${n(b.x + b.w)} ${n(base)} Z" fill="${cor ?? "#a9744a"}" stroke="${TINTA}" stroke-width="6"/>${Array.from({ length: 5 }, (_, i) => { const y = base - (b.h / 6) * (i + 1); const meio = (b.w / 2) * (1 - Math.pow((i + 1) / 6, 1.6)); return `<line x1="${n(b.x + b.w / 2 - meio)}" y1="${n(y)}" x2="${n(b.x + b.w / 2 + meio)}" y2="${n(y)}" stroke="${TINTA}" stroke-opacity="0.35" stroke-width="3"/>`; }).join("")}`;
    }
    case "torre": {
      const fendas = Array.from({ length: 4 }, (_, i) => `<rect x="${n(b.x + b.w * 0.18 + i * b.w * 0.17)}" y="${n(b.y + 14)}" width="${n(b.w * 0.08)}" height="${n(b.h * 0.18)}" fill="${TINTA}" opacity="0.7"/>`).join("");
      return `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${cor ?? "#b07a4e"}" stroke="${TINTA}" stroke-width="5"/>${fendas}`;
    }
    case "caixa": return `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="8" fill="${cor ?? "#8e99a6"}" stroke="${TINTA}" stroke-width="6"/><rect x="${n(b.x + b.w * 0.12)}" y="${n(b.y + b.h * 0.12)}" width="${n(b.w * 0.76)}" height="${n(b.h * 0.76)}" rx="6" fill="none" stroke="${TINTA}" stroke-opacity="0.35" stroke-width="4"/><circle cx="${n(b.x + b.w * 0.5)}" cy="${n(b.y + b.h * 0.5)}" r="${n(Math.min(b.w, b.h) * 0.12)}" fill="#d9dee4" stroke="${TINTA}" stroke-width="4"/>`;
    case "cano": {
      const g = Math.max(18, b.w * 0.14);
      return `<path d="M${n(b.x + g / 2)} ${n(b.y)} L${n(b.x + g / 2)} ${n(b.y + b.h - g / 2)} L${n(b.x + b.w)} ${n(b.y + b.h - g / 2)}" stroke="${TINTA}" stroke-width="${n(g + 10)}" fill="none" stroke-linejoin="round"/><path d="M${n(b.x + g / 2)} ${n(b.y)} L${n(b.x + g / 2)} ${n(b.y + b.h - g / 2)} L${n(b.x + b.w)} ${n(b.y + b.h - g / 2)}" stroke="${cor ?? "#7d8a96"}" stroke-width="${n(g)}" fill="none" stroke-linejoin="round"/>`;
    }
    case "terra-amontoada": return `<path d="M${n(b.x)} ${n(b.y + b.h)} Q ${n(b.x + b.w / 2)} ${n(b.y - b.h * 0.2)} ${n(b.x + b.w)} ${n(b.y + b.h)} Z" fill="${cor ?? "#a07850"}" stroke="${TINTA}" stroke-width="5"/>`;
    case "fogo": {
      const lingua = (dx: number, k: number) => { const a = Math.sin(t * 9 + k) * 8; return `<path d="M${n(b.x + b.w * dx - 26)} ${n(b.y + b.h)} Q ${n(b.x + b.w * dx - 30 + a)} ${n(b.y + b.h * 0.4)} ${n(b.x + b.w * dx + a)} ${n(b.y + b.h * (0.05 + 0.08 * k))} Q ${n(b.x + b.w * dx + 30 + a)} ${n(b.y + b.h * 0.4)} ${n(b.x + b.w * dx + 26)} ${n(b.y + b.h)} Z" fill="${k % 2 ? "#ffd23f" : "#ff7a2f"}" stroke="${TINTA}" stroke-width="3"/>`; };
      return lingua(0.3, 0) + lingua(0.7, 1) + lingua(0.5, 2);
    }
    default: return "";
  }
}

function pecaDesenhada(p: PecaCorte, b: Caixa): string {
  if (p.svg) return `<svg x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" viewBox="0 0 200 200" preserveAspectRatio="xMidYMax meet" overflow="visible">${p.svg}</svg>`;
  // sem desenho: uma caixa com o nome, para o vídeo nunca quebrar
  return `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="10" fill="#e9dcc3" stroke="${TINTA}" stroke-width="5"/><text x="${n(b.x + b.w / 2)}" y="${n(b.y + b.h / 2 + 12)}" font-family="${FONTE}" font-size="${Math.round(Math.min(34, b.w / Math.max(4, p.nome.length) * 1.4))}" fill="${TINTA}" text-anchor="middle">${esc(p.nome.toUpperCase().slice(0, 18))}</text>`;
}

function desenharPeca(p: PecaCorte, W: number, t: number, entrada: number | null, falha: boolean, todas: Map<string, PecaCorte>): string {
  const b = caixaDaPeca(p, W, todas);
  const corpo = p.pronta ? pecaPronta(p, b, t) : pecaDesenhada(p, b);
  // entrando: cresce a partir da base (subsolo: de cima para baixo), com pulo
  let tr = "";
  if (entrada !== null) {
    const s = Math.max(0.001, pulo(entrada));
    const ox = b.x + b.w / 2, oy = p.lugar === "subsolo" ? b.y : p.lugar === "ceu" ? b.y + b.h / 2 : b.y + b.h;
    tr = p.lugar === "ceu" ? `translate(${n(ox)} ${n(oy)}) scale(${n(s * 1000) / 1000}) translate(${n(-ox)} ${n(-oy)})` : `translate(${n(ox)} ${n(oy)}) scale(1 ${n(s * 1000) / 1000}) translate(${n(-ox)} ${n(-oy)})`;
  }
  const tremor = falha ? `translate(${n(Math.sin(t * 40) * 6)} 0)` : "";
  const vermelho = falha ? `<rect x="${n(b.x - 6)}" y="${n(b.y - 6)}" width="${n(b.w + 12)}" height="${n(b.h + 12)}" fill="#ff2a3a" opacity="${n(0.2 + 0.15 * Math.abs(Math.sin(t * 6)))}" rx="10"/>` : "";
  return `<g transform="${tremor} ${tr}">${corpo}${vermelho}</g>`;
}

// ───────── boneco palito (boné colorido) ─────────
function boneco(acao: NonNullable<CorteCena["boneco"]>["acao"], x: number, t: number, cor: string, alvoX: number | null): string {
  if (acao === "sem-boneco") return "";
  const pe = Y_CHAO + 6;
  const pulo = acao === "comemorando" ? Math.abs(Math.sin(t * 7)) * 26 : 0;
  const quadril = pe - 105 - pulo, ombro = quadril - 95, cab = ombro - 42;
  const tremor = acao === "assustado" ? Math.sin(t * 38) * 4 : 0;
  const cx = x + tremor;
  const passo = acao === "andando" ? Math.sin(t * 8) * 28 : acao === "cavando" ? 10 : 8;
  const L = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"/>`;
  const partes: string[] = [];
  partes.push(L(cx, quadril, cx - passo, pe), L(cx, quadril, cx + passo, pe), L(cx, quadril, cx, ombro));
  const lado = alvoX !== null && alvoX < cx ? -1 : 1;
  let extra = "";
  switch (acao) {
    case "apontando": partes.push(L(cx, ombro + 12, cx + lado * 95, ombro - 10), L(cx, ombro + 12, cx - lado * 28, quadril - 10)); break;
    case "cavando": {
      const a = Math.sin(t * 6) * 0.5;
      const mx = cx + 50 + Math.cos(a) * 20, my = ombro + 40 + Math.sin(a) * 30;
      partes.push(L(cx, ombro + 12, mx, my), L(cx, ombro + 12, mx - 14, my + 16));
      extra = `<line x1="${n(mx - 30)}" y1="${n(my - 50)}" x2="${n(mx + 30)}" y2="${n(my + 70)}" stroke="#7a5432" stroke-width="7"/><path d="M${n(mx + 18)} ${n(my + 60)} l26 18 l-12 22 l-26 -18 z" fill="#9aa3ad" stroke="${TINTA}" stroke-width="4"/>`;
      break;
    }
    case "carregando": partes.push(L(cx, ombro + 12, cx - 34, ombro - 50), L(cx, ombro + 12, cx + 34, ombro - 50)); extra = `<rect x="${n(cx - 46)}" y="${n(ombro - 112)}" width="92" height="64" rx="6" fill="#c8915c" stroke="${TINTA}" stroke-width="5"/>`; break;
    case "pensando": partes.push(L(cx, ombro + 12, cx + 24, ombro - 18), L(cx + 24, ombro - 18, cx + 10, cab + 30), L(cx, ombro + 12, cx - 30, quadril - 6)); extra = `<text x="${n(cx + 46)}" y="${n(cab - 50 - Math.abs(Math.sin(t * 3)) * 10)}" font-family="${FONTE}" font-size="54" fill="${TINTA}">?</text>`; break;
    case "comemorando": partes.push(L(cx, ombro + 12, cx - 46, ombro - 70), L(cx, ombro + 12, cx + 46, ombro - 70)); extra = `<path d="M${n(cx + 70)} ${n(cab - 60 - (t * 40) % 60)} c-10 -14 -30 -6 -20 10 l20 18 l20 -18 c10 -16 -10 -24 -20 -10z" fill="#e8455a"/>`; break;
    case "assustado": partes.push(L(cx, ombro + 12, cx - 52, ombro - 46), L(cx, ombro + 12, cx + 52, ombro - 46)); break;
    default: { const bal = acao === "andando" ? Math.sin(t * 8) * 22 : 0; partes.push(L(cx, ombro + 12, cx - 30 + bal, quadril - 6), L(cx, ombro + 12, cx + 30 - bal, quadril - 6)); }
  }
  const olhos = acao === "assustado" ? `<circle cx="${n(cx - 9)}" cy="${n(cab - 2)}" r="6" fill="#fff" stroke="${TINTA}" stroke-width="2"/><circle cx="${n(cx + 9)}" cy="${n(cab - 2)}" r="6" fill="#fff" stroke="${TINTA}" stroke-width="2"/>` : `<circle cx="${n(cx - 8 * lado + 6 * lado)}" cy="${n(cab - 2)}" r="3.5" fill="${TINTA}"/><circle cx="${n(cx + 10 * lado)}" cy="${n(cab - 2)}" r="3.5" fill="${TINTA}"/>`;
  const boca = acao === "comemorando" ? `<path d="M${n(cx - 8)} ${n(cab + 12)} q8 9 16 0" stroke="${TINTA}" stroke-width="3" fill="none"/>` : "";
  return `<g stroke="${TINTA}" stroke-width="8" stroke-linecap="round" fill="none">${partes.join("")}</g>${extra}<circle cx="${n(cx)}" cy="${n(cab)}" r="30" fill="#f3ede4" stroke="${TINTA}" stroke-width="6"/><path d="M${n(cx - 32)} ${n(cab - 6)} Q ${n(cx)} ${n(cab - 54)} ${n(cx + 32)} ${n(cab - 6)} Z" fill="${cor}" stroke="${TINTA}" stroke-width="5"/><line x1="${n(cx + 8 * lado)}" y1="${n(cab - 8)}" x2="${n(cx + 46 * lado)}" y2="${n(cab - 4)}" stroke="${TINTA}" stroke-width="7" stroke-linecap="round"/>${olhos}${boca}`;
}

// ───────── etiquetas, selo, plaquinha, fluxos, legenda ─────────
const COR_PONTO = { azul: "#2f7de1", vermelho: "#e5484d", verde: "#2fa36b", amarelo: "#f2b600" } as const;

// Áreas fixas da tela (1080×1920): selo no alto, plaquinha acima da legenda, legenda embaixo.
// Etiquetas só no meio, sem encostar umas nas outras nem nessas áreas.
export const ZONA = { seloY: 230, placaY: 1290, legendaY: 1560, topoUtil: 320, baseUtil: 1180 };
type Ret = { x: number; y: number; w: number; h: number };
const bate = (a: Ret, b: Ret) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export type EtiquetaTela = { texto: string; cor: keyof typeof COR_PONTO; alvo: [number, number]; prog: number };
/**
 * Etiquetas em coordenadas de TELA (não crescem com o zoom): pílula legível acima do alvo,
 * com linha até ele; se bater em outra etiqueta ou numa área fixa, sobe ou desce até achar lugar.
 */
export function etiquetasNaTela(lista: EtiquetaTela[], W: number, ocupado: Ret[] = []): string {
  const postas: Ret[] = [...ocupado];
  const out: string[] = [];
  for (const e of lista) {
    if (e.prog <= 0) continue;
    const t = e.texto.toUpperCase().slice(0, 22);
    const tam = 30, alt = 62, larg = Math.round(t.length * tam * 0.74 + 78);
    const ax = lim(e.alvo[0], 40, W - 40), ay = lim(e.alvo[1], ZONA.topoUtil, ZONA.baseUtil + 120);
    let r: Ret = { x: lim(ax - larg / 2, 36, W - 36 - larg), y: lim(ay - 130, ZONA.topoUtil, ZONA.baseUtil - alt), w: larg, h: alt };
    for (let k = 1; k < 30 && postas.some((p) => bate(r, p)); k++) {
      const d = Math.ceil(k / 2) * 72 * (k % 2 ? -1 : 1);
      r = { ...r, y: lim(ay - 130 + d, ZONA.topoUtil, ZONA.baseUtil - alt) };
    }
    postas.push({ x: r.x - 10, y: r.y - 10, w: r.w + 20, h: r.h + 20 });
    const s = pulo(e.prog), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const ly = ay > cy ? r.y + r.h : r.y;
    out.push(`<g opacity="${n(lim(e.prog * 3))}" transform="translate(${n(cx)} ${n(cy)}) scale(${n(s * 1000) / 1000}) translate(${n(-cx)} ${n(-cy)})"><line x1="${n(cx)}" y1="${n(ly)}" x2="${n(ax)}" y2="${n(ay)}" stroke="${TINTA}" stroke-width="4" stroke-dasharray="8 7" opacity="0.75"/><circle cx="${n(ax)}" cy="${n(ay)}" r="9" fill="${COR_PONTO[e.cor]}" stroke="${TINTA}" stroke-width="3"/><rect x="${n(r.x + 5)}" y="${n(r.y + 6)}" width="${n(r.w)}" height="${alt}" rx="${alt / 2}" fill="${TINTA}" opacity="0.35"/><rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${alt}" rx="${alt / 2}" fill="#fffdf7" stroke="${TINTA}" stroke-width="4"/><circle cx="${n(r.x + 32)}" cy="${n(cy)}" r="11" fill="${COR_PONTO[e.cor]}"/><text x="${n(r.x + 54)}" y="${n(cy + tam * 0.36)}" font-family="${FONTE}" font-size="${tam}" letter-spacing="1" fill="${TINTA}">${esc(t)}</text></g>`);
  }
  return out.join("");
}

/** Retângulos das áreas fixas que estão em uso nesta cena (para as etiquetas desviarem). */
export function zonasOcupadas(W: number, temSelo: boolean, temPlaca: boolean): Ret[] {
  return [...(temSelo ? [{ x: 0, y: ZONA.seloY - 110, w: W, h: 220 }] : []), ...(temPlaca ? [{ x: 0, y: ZONA.placaY - 130, w: W, h: 260 }] : [])];
}

export function selo(texto: string, W: number, prog: number) {
  if (prog <= 0) return "";
  const t = texto.toUpperCase().slice(0, 18);
  const tam = Math.max(44, Math.min(72, Math.floor((W * 0.74) / (t.length * 0.76))));
  const larg = t.length * tam * 0.76 + 80, alt = tam * 1.55, cx = W / 2, cy = ZONA.seloY;
  const s = pulo(prog);
  return `<g transform="translate(${cx} ${cy}) scale(${n(s * 1000) / 1000}) rotate(-2)"><rect x="${n(-larg / 2 + 7)}" y="${n(-alt / 2 + 9)}" width="${n(larg)}" height="${n(alt)}" rx="22" fill="${TINTA}"/><rect x="${n(-larg / 2)}" y="${n(-alt / 2)}" width="${n(larg)}" height="${n(alt)}" rx="22" fill="#ffd23f" stroke="${TINTA}" stroke-width="6"/><text x="0" y="${n(tam * 0.36)}" font-family="${FONTE}" font-size="${tam}" fill="${TINTA}" text-anchor="middle">${esc(t)}</text></g>`;
}

export function placa(p: NonNullable<CorteCena["placa"]>, W: number, prog: number) {
  if (prog <= 0) return "";
  const titulo = p.titulo.toUpperCase().slice(0, 24);
  const sub = p.sub?.slice(0, 44);
  // o título sempre cabe: a letra encolhe para a placa nunca passar de 86% da largura
  const tam = Math.max(40, Math.min(78, Math.floor((W * 0.74) / (titulo.length * 0.64))));
  const tamSub = 30;
  const larg = Math.min(W * 0.86, Math.max(titulo.length * tam * 0.64, (sub?.length ?? 0) * tamSub * 0.5) + 90);
  const alt = tam * 1.45 + (sub ? tamSub * 1.6 : 0);
  const cy = ZONA.placaY + (1 - saida(prog)) * 120;
  return `<g opacity="${n(lim(prog * 2.5))}" transform="translate(${W / 2} ${n(cy)}) rotate(-2.5)"><rect x="${n(-larg / 2 + 8)}" y="${n(-alt / 2 + 10)}" width="${n(larg)}" height="${n(alt)}" rx="8" fill="#000" opacity="0.25"/><rect x="${n(-larg / 2)}" y="${n(-alt / 2)}" width="${n(larg)}" height="${n(alt)}" rx="8" fill="#fbf6ea" stroke="${TINTA}" stroke-width="5"/><text x="0" y="${n(-alt / 2 + tam * 1.08)}" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${tam}" letter-spacing="2" fill="${TINTA}" text-anchor="middle">${esc(titulo)}</text>${sub ? `<text x="0" y="${n(-alt / 2 + tam * 1.08 + tamSub * 1.35)}" font-family="Georgia, serif" font-style="italic" font-size="${tamSub}" fill="#6b5f52" text-anchor="middle">${esc(sub)}</text>` : ""}</g>`;
}

function fluxo(f: NonNullable<CorteCena["fluxo"]>, b: Caixa, t: number, prog: number) {
  if (prog <= 0) return "";
  const cor = { quente: "#e5484d", frio: "#3d8be0", agua: "#2f7de1", ar: "#7fa7c9", forca: "#f08a24" }[f.tipo];
  const sentido = f.sentido ?? (f.tipo === "quente" || f.tipo === "ar" ? "sobe" : f.tipo === "frio" ? "desce" : "direita");
  const linhas: string[] = [];
  for (let i = 0; i < 4; i++) {
    const fase = (t * 0.9 + i * 0.25) % 1;
    if (sentido === "sobe" || sentido === "desce") {
      const x = b.x + b.w * (0.2 + i * 0.2);
      const y0 = sentido === "sobe" ? b.y + b.h - fase * b.h : b.y + fase * b.h;
      const pts = Array.from({ length: 6 }, (_, k) => `${k ? "L" : "M"}${n(x + Math.sin(k * 1.4 + t * 5 + i) * 10)} ${n(y0 + (sentido === "sobe" ? -1 : 1) * k * 14)}`).join("");
      linhas.push(`<path d="${pts}" stroke="${cor}" stroke-width="7" fill="none" stroke-linecap="round" opacity="${n(Math.sin(fase * Math.PI) * prog)}"/>`);
    } else {
      const y = b.y + b.h * (0.25 + i * 0.17);
      const x0 = sentido === "direita" ? b.x + fase * b.w : b.x + b.w - fase * b.w;
      const d = sentido === "direita" ? 1 : -1;
      linhas.push(`<path d="M${n(x0)} ${n(y)} q${12 * d} -10 ${24 * d} 0 t${24 * d} 0 l${-10 * d} -8 m${10 * d} 8 l${-10 * d} 8" stroke="${cor}" stroke-width="6" fill="none" stroke-linecap="round" opacity="${n(Math.sin(fase * Math.PI) * prog)}"/>`);
    }
  }
  return linhas.join("");
}

export function legenda(palavras: string[], atual: number, destaques: Set<string>, W: number) {
  if (!palavras.length) return "";
  const txt = palavras.map((w, i) => {
    const limpo = w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    return `<tspan fill="${destaques.has(limpo) ? "#ffd23f" : "#ffffff"}" opacity="${i <= atual ? 1 : 0.6}">${esc(w.toUpperCase())}</tspan>`;
  }).join(" ");
  const tam = Math.max(56, Math.min(104, Math.floor((W * 0.86) / (palavras.join(" ").length * 0.72))));
  return `<text x="${W / 2}" y="${Y_LEGENDA}" font-family="${FONTE}" font-size="${tam}" stroke="${TINTA}" stroke-width="12" paint-order="stroke" stroke-linejoin="round" text-anchor="middle">${txt}</text>`;
}

// ───────── quadro ─────────
export type QuadroCorte = {
  W: number; H: number; t: number; dur: number; seed: number;
  video: CorteVideo; cena: CorteCena;
  visiveis: string[];           // peças já construídas (inclui as que entram nesta cena)
  camAntes?: { s: number; tx: number; ty: number }; // câmera da cena anterior (a nova sai de lá)
  ceuAntes?: CorteCena["ceu"];
  legenda?: { palavras: string[]; atual: number };
};

// ───────── câmera e boneco (calculados por cena, iguais em todos os quadros da cena) ─────────
type CamCorte = { s: number; tx: number; ty: number };
const ESC_BONECO = 1.1; // um pouco maior que o desenho base, sem ficar maior que as peças

/** Onde o boneco fica nesta cena: ao lado da peça nova (ou onde o diretor mandou), nunca em cima de uma peça. */
export function posBonecoCorte(video: CorteVideo, cena: CorteCena, visiveis: string[], W: number): number | null {
  const bon = cena.boneco ?? { acao: "parado" as const };
  if (bon.acao === "sem-boneco") return null;
  const pecas = new Map(video.pecas.map((p) => [p.id, p]));
  const vis = visiveis.map((id) => pecas.get(id)).filter((p): p is PecaCorte => !!p);
  const nova = (cena.adiciona ?? []).map((id) => pecas.get(id)).find(Boolean) ?? (cena.foco ? pecas.get(cena.foco) : undefined);
  const alvo = nova ? caixaDaPeca(nova, W, pecas) : null;
  const desejado = bon.x !== undefined ? lim(bon.x, 0.08, 0.92) * W : alvo ? alvo.x + alvo.w + 90 : W * 0.78;
  const ocupado = vis.filter((p) => p.lugar === "chao" && !p.dentro).map((p) => caixaDaPeca(p, W, pecas)).map((b) => [b.x - 75, b.x + b.w + 75] as const);
  for (let d = 0; d < W; d += 16) for (const c of [desejado + d, desejado - d]) if (c > 80 && c < W - 80 && ocupado.every(([a, b]) => c < a || c > b)) return c;
  return lim(desejado, 80, W - 80);
}

/**
 * Câmera que MEDE o que está na tela: enquadra as peças visíveis (ou a peça em foco) e o boneco
 * dentro da área útil (entre o selo e a plaquinha), com folga — nunca perto demais, nunca vazio.
 */
export function camCorte(video: CorteVideo, cena: CorteCena, visiveis: string[], W: number, H: number): CamCorte {
  const pecas = new Map(video.pecas.map((p) => [p.id, p]));
  const foco = cena.foco ? pecas.get(cena.foco) : undefined;
  const lista = (foco ? [foco] : visiveis.map((id) => pecas.get(id)).filter((p): p is PecaCorte => !!p)).map((p) => caixaDaPeca(p, W, pecas));
  const bx = posBonecoCorte(video, cena, visiveis, W);
  if (bx !== null && (!foco || lista.some((b) => Math.abs(bx - (b.x + b.w / 2)) < b.w / 2 + 320))) lista.push({ x: bx - 70, y: Y_CHAO - 300 * ESC_BONECO / 1.35, w: 140, h: 300 });
  if (!lista.length) return { s: 1, tx: 0, ty: 0 };
  // sempre um pedaço do céu e do chão em volta: o mundo nunca fica cortado rente
  const x0 = Math.min(...lista.map((b) => b.x)) - 70, x1 = Math.max(...lista.map((b) => b.x + b.w)) + 70;
  const y0 = Math.min(Y_CHAO - 260, ...lista.map((b) => b.y)) - 60, y1 = Math.max(Y_CHAO + 120, ...lista.map((b) => b.y + b.h)) + 50;
  const topo = cena.selo ? ZONA.topoUtil : 140, base = cena.placa ? ZONA.placaY - 150 : ZONA.legendaY - 140;
  const s = lim(Math.min((W - 80) / (x1 - x0), (base - topo) / (y1 - y0)), 1, foco ? 1.55 : 1.3);
  let tx = W / 2 - ((x0 + x1) / 2) * s, ty = (topo + base) / 2 - ((y0 + y1) / 2) * s;
  tx = lim(tx, W - W * s, 0);
  ty = Math.min(0, ty);
  return { s, tx, ty };
}

export function quadroCorte(q: QuadroCorte): string {
  const { W, H, t, video, cena } = q;
  const pecas = new Map(video.pecas.map((p) => [p.id, p]));
  const novas = new Set(cena.adiciona ?? []);
  const z = camCorte(video, cena, q.visiveis, W, H);
  const a = q.camAntes ?? z;
  const k = saida(t / 0.85);
  const s = a.s + (z.s - a.s) * k, tx = a.tx + (z.tx - a.tx) * k, ty = a.ty + (z.ty - a.ty) * k;
  const camTr = `translate(${n(tx)} ${n(ty)}) scale(${n(s * 1000) / 1000})`;
  const tela = (x: number, y: number): [number, number] => [x * s + tx, y * s + ty];

  const ceu = cena.ceu ?? q.ceuAntes ?? "dia";
  const mundo: string[] = [fundo(video, ceu, W, H, t, q.seed)];
  // peças: as do subsolo primeiro (ficam atrás), depois chão, depois céu
  const ordem = q.visiveis.map((id) => pecas.get(id)).filter((p): p is PecaCorte => !!p)
    .sort((x, y) => ["subsolo", "chao", "ceu"].indexOf(x.lugar) + (x.dentro ? 0.5 : 0) - ["subsolo", "chao", "ceu"].indexOf(y.lugar) - (y.dentro ? 0.5 : 0));
  for (const p of ordem) {
    const entrada = novas.has(p.id) ? lim((t - 0.15) / 0.7) : null;
    mundo.push(desenharPeca(p, W, t, entrada, cena.falha === p.id && t > 0.3, pecas));
  }
  if (cena.fluxo) { const p = pecas.get(cena.fluxo.peca); if (p) mundo.push(fluxo(cena.fluxo, caixaDaPeca(p, W, pecas), t, lim((t - 0.3) / 0.4))); }
  const bon = cena.boneco ?? { acao: "parado" as const };
  const bx = posBonecoCorte(video, cena, q.visiveis, W);
  if (bx !== null) {
    const alvoNova = [...novas].map((id) => pecas.get(id)).find(Boolean);
    const ab = alvoNova ? caixaDaPeca(alvoNova, W, pecas) : null;
    mundo.push(`<g transform="translate(${n(bx)} ${Y_CHAO + 6}) scale(${ESC_BONECO}) translate(${n(-bx)} ${-(Y_CHAO + 6)})">${boneco(bon.acao, bx, t, video.corBone ?? "#e04a3a", ab ? ab.x + ab.w / 2 : null)}</g>`);
  }

  const partes = [`<g transform="${camTr}">${mundo.join("")}</g>`];
  // etiquetas em tamanho de tela (legíveis), desviando do selo, da plaquinha e umas das outras
  const etqs = (cena.etiquetas ?? []).slice(0, 3).flatMap((e, i) => {
    const p = pecas.get(e.peca);
    if (!p) return [];
    const b = caixaDaPeca(p, W, pecas);
    const alvo = tela(b.x + b.w / 2, p.lugar === "subsolo" ? b.y + Math.min(b.h * 0.3, 120) : b.y + 10);
    return [{ texto: e.texto, cor: e.cor ?? "azul", alvo, prog: (t - 0.5 - i * 0.3) / 0.5 } as EtiquetaTela];
  });
  partes.push(etiquetasNaTela(etqs, W, zonasOcupadas(W, !!cena.selo, !!cena.placa)));
  if (cena.selo) partes.push(selo(cena.selo, W, (t - 0.35) / 0.45));
  if (cena.placa) partes.push(placa(cena.placa, W, (t - 0.45) / 0.5));
  if (q.legenda) partes.push(legenda(q.legenda.palavras, q.legenda.atual, new Set((cena.destaques ?? []).map((d) => d.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""))), W));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${partes.join("")}</svg>`;
}

// ───────── SVG desenhado pela IA: só formas simples, sem nada que busque arquivo de fora ─────────
const TAGS_OK = new Set(["g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const ATTR_OK = new Set(["d", "x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "x1", "y1", "x2", "y2", "points", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "fill-opacity", "stroke-opacity", "transform", "fill-rule", "stroke-dasharray"]);

/** Limpa o SVG da IA: só tags de forma e atributos de desenho; descarta o resto. Devolve só o miolo (sem <svg>). */
export function limparSvgPeca(bruto: string): string | null {
  const m = /<svg[^>]*>([\s\S]*?)<\/svg>/i.exec(bruto);
  const miolo = (m ? m[1] : bruto).replace(/<!--[\s\S]*?-->/g, "");
  const out: string[] = [];
  const re = /<\s*(\/)?\s*([a-zA-Z]+)([^>]*?)(\/)?\s*>/g;
  let abertos = 0;
  for (let r = re.exec(miolo); r; r = re.exec(miolo)) {
    const [, fecha, tag0, attrs, auto] = r;
    const tag = tag0.toLowerCase();
    if (!TAGS_OK.has(tag)) continue;
    if (fecha) { if (tag === "g" && abertos > 0) { out.push("</g>"); abertos--; } continue; }
    const limpos: string[] = [];
    for (const a of attrs.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) {
      const nome = a[1].toLowerCase(), valor = a[2];
      if (!ATTR_OK.has(nome) || valor.length > 4000 || /url\s*\(|javascript:|expression|[<>&]/i.test(valor)) continue;
      limpos.push(`${nome}="${valor}"`);
    }
    if (tag === "g" && !auto) { out.push(`<g ${limpos.join(" ")}>`); abertos++; }
    else out.push(`<${tag} ${limpos.join(" ")}/>`);
  }
  while (abertos-- > 0) out.push("</g>");
  const svg = out.join("");
  return svg.length > 40 && svg.length < 24_000 ? svg : null;
}
