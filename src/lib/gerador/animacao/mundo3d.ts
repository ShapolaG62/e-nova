import "server-only";
import { etiquetasNaTela, legenda, lim, placa, pulo, saida, selo, zonasOcupadas } from "./corte";
import type { ACOES_BONECO, Cena3D, Mundo3D, Peca3D, Prim3D } from "./tipos";

// Motor 3D simples, feito à mão: cada peça é um punhado de formas (caixa, cilindro, cone, esfera,
// pirâmide); cada quadro projeta as faces com perspectiva, pinta com sombra chapada (luz de cima) e
// contorno escuro, e desenha de trás para frente. Sai um SVG por quadro, como no resto da animação.
// Visual: "maquete" de desenho 3D com contorno, bonecos de cabeça redonda e câmera que voa entre planos.

type V = [number, number, number];
type Face = { pts: V[]; cor: string; n: V; camada: number; opac?: number; contorno?: boolean; liso?: boolean };

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a: V, b: V, k: number): V => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const r1 = (v: number) => Math.round(v * 10) / 10;
const CONTORNO = "#1c1b24";
const LUZ = norm([-0.45, 1, 0.55]);

function hexRgb(h: string): V { const m = /^#?([0-9a-f]{6})$/i.exec(h); const x = m ? parseInt(m[1], 16) : 0x888888; return [(x >> 16) & 255, (x >> 8) & 255, x & 255]; }
function sombrear(cor: string, k: number) { const [r, g, b] = hexRgb(cor); const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${c(r)},${c(g)},${c(b)})`; }

// ───────── formas ─────────
type Tf = { pos: V; esc: number; rot: number; sy?: number; sxz?: number };
function aplicar(p: V, tf: Tf): V {
  const a = (tf.rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const x = p[0] * (tf.sxz ?? 1), y = p[1] * (tf.sy ?? 1), z = p[2] * (tf.sxz ?? 1);
  return [tf.pos[0] + (x * c + z * s) * tf.esc, tf.pos[1] + y * tf.esc, tf.pos[2] + (-x * s + z * c) * tf.esc];
}
/** Gira um ponto local da forma (graus no eixo Y e, opcional, no eixo X — rodas, mostradores). */
function girar(p: V, rotY: number, rotX = 0): V {
  let [x, y, z] = p;
  if (rotX) { const a = (rotX * Math.PI) / 180; [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)]; }
  if (rotY) { const a = (rotY * Math.PI) / 180; [x, z] = [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)]; }
  return [x, y, z];
}

type Forma = Prim3D & { rotX?: number; meia?: boolean; lados?: number };
function facesDaForma(f: Forma, tf: Tf, camada: number, falha: boolean): Face[] {
  const [w, h, d] = f.s;
  const loc = (x: number, y: number, z: number): V => {
    // forma com rotX gira em volta do próprio centro (para não sair do lugar)
    const c: V = f.rotX ? [0, h / 2, 0] : [0, 0, 0];
    const g = girar(sub([x, y, z], c), f.rot ?? 0, f.rotX ?? 0);
    return aplicar(add(add(g, c), f.p), tf);
  };
  const cor = falha ? "#e5484d" : f.cor;
  const out: Face[] = [];
  const quad = (a: V, b: V, c: V, e: V) => out.push({ pts: [a, b, c, e], cor, n: norm(cross(sub(b, a), sub(c, a))), camada });
  const poli = (pts: V[]) => { if (pts.length >= 3) out.push({ pts, cor, n: norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]))), camada }); };
  if (f.f === "caixa") {
    const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
    const P = (x: number, y: number, z: number) => loc(x, y, z);
    quad(P(x0, 0, z1), P(x1, 0, z1), P(x1, h, z1), P(x0, h, z1)); // frente
    quad(P(x1, 0, z0), P(x0, 0, z0), P(x0, h, z0), P(x1, h, z0)); // trás
    quad(P(x1, 0, z1), P(x1, 0, z0), P(x1, h, z0), P(x1, h, z1)); // direita
    quad(P(x0, 0, z0), P(x0, 0, z1), P(x0, h, z1), P(x0, h, z0)); // esquerda
    quad(P(x0, h, z1), P(x1, h, z1), P(x1, h, z0), P(x0, h, z0)); // topo
    quad(P(x0, 0, z0), P(x1, 0, z0), P(x1, 0, z1), P(x0, 0, z1)); // base
  } else if (f.f === "cilindro" || f.f === "cone") {
    const n = f.lados ?? 12, rx = w / 2, rz = d / 2;
    const anel = (y: number, k: number) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return loc(Math.cos(a) * rx * k, y, Math.sin(a) * rz * k); });
    const baixo = anel(0, 1), cima = anel(h, f.f === "cone" ? 0.001 : 1);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (f.f === "cone") poli([baixo[j], baixo[i], cima[i]]); else quad(baixo[j], baixo[i], cima[i], cima[j]); }
    poli([...baixo]);
    if (f.f === "cilindro") poli([...cima].reverse());
  } else if (f.f === "piramide") {
    const t = loc(0, h, 0), a = loc(-w / 2, 0, d / 2), b = loc(w / 2, 0, d / 2), c = loc(w / 2, 0, -d / 2), e = loc(-w / 2, 0, -d / 2);
    poli([a, b, t]); poli([b, c, t]); poli([c, e, t]); poli([e, a, t]); poli([e, c, b, a]);
  } else if (f.f === "esfera") {
    const an = 10, ar = f.meia ? 3 : 6;
    const ponto = (i: number, j: number) => {
      const lat = f.meia ? (j / ar) * (Math.PI / 2) : -Math.PI / 2 + (j / ar) * Math.PI, lon = (i / an) * Math.PI * 2;
      return loc(Math.cos(lat) * Math.cos(lon) * (w / 2), (f.meia ? 0 : h / 2) + Math.sin(lat) * (f.meia ? h : h / 2), Math.cos(lat) * Math.sin(lon) * (d / 2));
    };
    for (let j = 0; j < ar; j++) for (let i = 0; i < an; i++) {
      const a = ponto(i, j), b = ponto(i + 1, j), c = ponto(i + 1, j + 1), e = ponto(i, j + 1);
      if (j === ar - 1) poli([a, b, c]); else quad(b, a, e, c);
    }
  }
  if (f.f === "esfera") for (const fc of out) fc.liso = true;
  // normais calculadas pela ordem dos pontos: garante que apontam para fora (centro da forma → face)
  const centro = loc(0, h / 2, 0);
  for (const fc of out) { const m = mul(fc.pts.reduce((s, p) => add(s, p), [0, 0, 0] as V), 1 / fc.pts.length); if (dot(fc.n, sub(m, centro)) < 0) fc.n = mul(fc.n, -1); }
  return out;
}

// ───────── biblioteca de peças ─────────
const B = (p: V, s: V, cor: string, extra: Partial<Forma> = {}): Forma => ({ f: "caixa", p, s, cor, ...extra });
const CIL = (p: V, s: V, cor: string, extra: Partial<Forma> = {}): Forma => ({ f: "cilindro", p, s, cor, ...extra });

function biblioteca(nome: NonNullable<Peca3D["pronta"]>, cor?: string): Forma[] {
  switch (nome) {
    case "casa": return [B([0, 0, 0], [4, 2.6, 3.5], cor ?? "#f1e3c8"), { f: "piramide", p: [0, 2.6, 0], s: [4.6, 1.7, 4.1], cor: "#d0533d" }, B([0, 0, 1.76], [0.9, 1.7, 0.08], "#7a4b2c"), B([-1.3, 1.2, 1.76], [0.8, 0.7, 0.06], "#9fd0f0"), B([1.3, 1.2, 1.76], [0.8, 0.7, 0.06], "#9fd0f0")];
    case "predio": { const f: Forma[] = [B([0, 0, 0], [4, 9, 4], cor ?? "#c9ced6")]; for (let y = 1; y < 8.5; y += 1.6) for (const x of [-1.1, 0, 1.1]) f.push(B([x, y, 2.01], [0.7, 0.9, 0.06], "#7fb3dc")); return f; }
    case "muro": return [B([0, 0, 0], [6, 2, 0.5], cor ?? "#b8573a"), B([0, 2, 0], [6.2, 0.2, 0.7], "#8f3f28")];
    case "cofre": return [B([0, 0, 0], [1.8, 2, 1.6], cor ?? "#7d8a99"), B([0, 0.2, 0.81], [1.4, 1.6, 0.05], "#6a7685"), CIL([0, 0.85, 0.85], [0.6, 0.12, 0.6], "#c9d1da", { rotX: 90 }), B([0.55, 0.85, 0.88], [0.12, 0.5, 0.08], "#c9d1da")];
    case "caixa": return [B([0, 0, 0], [1.3, 1.3, 1.3], cor ?? "#c8915c"), B([0, 1.3, 0], [1.36, 0.12, 1.36], "#a8743f")];
    case "torre": return [B([0, 0, 0], [1.8, 6.5, 1.8], cor ?? "#b07a4e"), B([0, 6.5, 0], [2.2, 0.5, 2.2], "#8a5a35"), B([0, 5.2, 0.91], [1.2, 0.8, 0.05], "#2b2b33")];
    case "cupula": return [{ f: "esfera", p: [0, 0, 0], s: [5, 3, 5], cor: cor ?? "#b9845a", meia: true }];
    case "arvore": return [CIL([0, 0, 0], [0.4, 1.4, 0.4], "#7a5234", { lados: 6 }), { f: "esfera", p: [0, 1.2, 0], s: [2.2, 2.4, 2.2], cor: cor ?? "#5fae4f" }];
    case "poste": return [CIL([0, 0, 0], [0.2, 4.2, 0.2], "#5b6270", { lados: 6 }), B([0.5, 4.1, 0], [1.1, 0.2, 0.4], "#5b6270"), B([0.9, 3.9, 0], [0.4, 0.2, 0.35], "#ffe28a")];
    case "carro": return [B([0, 0.35, 0], [3.6, 0.9, 1.7], cor ?? "#e2483d"), B([-0.2, 1.25, 0], [2, 0.75, 1.5], cor ?? "#e2483d"), B([-0.2, 1.3, 0.76], [1.7, 0.55, 0.04], "#9fd0f0"),
      ...[-1.15, 1.15].flatMap((x) => [0.86, -0.86].map((z) => CIL([x, 0, z], [0.75, 0.3, 0.75], "#24242c", { rotX: 90, lados: 10 })))];
    case "caminhao": return [B([1.9, 0.4, 0], [1.6, 1.9, 2], cor ?? "#f2b33d"), B([-1.2, 0.4, 0], [4.4, 2.4, 2.1], "#e9edf2"), ...[-2.5, -0.6, 2].flatMap((x) => [1.05, -1.05].map((z) => CIL([x, 0, z], [0.85, 0.3, 0.85], "#24242c", { rotX: 90, lados: 10 })))];
    case "cabine": return [B([0, 0, 0], [1.8, 2.5, 1.8], cor ?? "#eef1f4"), B([0, 2.5, 0], [2.6, 0.35, 2.6], "#d84a3a"), B([0, 1.2, 0.91], [1.3, 0.9, 0.05], "#8cc4ea"), B([0.91, 1.2, 0], [0.05, 0.9, 1.2], "#8cc4ea")];
    case "cancela": return [B([0, 0, 0], [0.5, 1.2, 0.5], "#f2c230"), ...Array.from({ length: 6 }, (_, i) => B([0.5 + i * 0.6, 1.0, 0], [0.6, 0.18, 0.18], i % 2 ? "#ffffff" : "#e2483d"))];
    case "estrada": return [B([0, 0, 0], [6, 0.04, 30], cor ?? "#3a3d45"), ...Array.from({ length: 7 }, (_, i) => B([0, 0.05, -13 + i * 4.3], [0.25, 0.02, 2], "#f4f4f4"))];
    case "ponte": return [B([0, 4, 0], [20, 0.7, 4], cor ?? "#c9ced6"), B([0, 4.7, 1.9], [20, 0.5, 0.15], "#9aa3ad"), B([0, 4.7, -1.9], [20, 0.5, 0.15], "#9aa3ad"), ...[-7, 0, 7].map((x) => B([x, 0, 0], [1, 4, 1.4], "#aab2bc"))];
    case "agua": return [B([0, 0, 0], [8, 0.12, 8], cor ?? "#3f8fd6")];
    case "sala-enterrada": { const c = cor ?? "#b9bec6"; return [B([0, -3.2, 0], [6, 0.3, 4], c), B([0, -3.2, -2], [6, 3.2, 0.3], c), B([-3, -3.2, 0], [0.3, 3.2, 4], c), B([3, -3.2, 0], [0.3, 3.2, 4], c)]; }
    case "blocos": { const f: Forma[] = []; for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) f.push(B([-1.05 + x * 1.05, y, 0], [1, 1, 1], cor ?? "#9fd8f7")); return f; }
    case "cerca": return [...[-2.5, -1.25, 0, 1.25, 2.5].map((x) => B([x, 0, 0], [0.15, 1.2, 0.15], cor ?? "#c79b6b")), B([0, 0.4, 0], [5.2, 0.12, 0.08], cor ?? "#c79b6b"), B([0, 0.9, 0], [5.2, 0.12, 0.08], cor ?? "#c79b6b")];
    case "porta": return [B([0, 0, 0], [1.6, 2.6, 0.25], cor ?? "#7d8a99"), B([0, 2.6, 0], [2, 0.3, 0.4], "#5b6270"), CIL([0.45, 1.2, 0.15], [0.35, 0.1, 0.35], "#c9d1da", { rotX: 90 })];
    case "escada": return Array.from({ length: 5 }, (_, i) => B([0, i * 0.4, -i * 0.5], [2, 0.4, 0.5 + 0.0], cor ?? "#b9bec6"));
    case "mesa": return [B([0, 0.9, 0], [2.2, 0.12, 1.2], cor ?? "#a0703f"), ...[[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]].map(([x, z]) => B([x, 0, z], [0.12, 0.9, 0.12], "#7a5234"))];
    case "pessoa": return bonecoFormas("parado", 0, cor ?? "#4a7fd6", "#f2c9a5");
  }
}

// ───────── boneco de cabeça redonda ─────────
type Acao = (typeof ACOES_BONECO)[number];
function bonecoFormas(acao: Acao, t: number, roupa: string, pele: string, bone?: string): Forma[] {
  const balanco = acao === "andando" ? Math.sin(t * 8) * 25 : 0;
  const pulo = acao === "comemorando" ? Math.abs(Math.sin(t * 7)) * 0.35 : 0;
  const f: Forma[] = [
    B([-0.17, pulo, 0], [0.2, 0.75, 0.22], "#3a4a6b", { rotX: balanco }),
    B([0.17, pulo, 0], [0.2, 0.75, 0.22], "#3a4a6b", { rotX: -balanco }),
    CIL([0, 0.72 + pulo, 0], [0.78, 0.85, 0.55], roupa, { lados: 10 }),
    { f: "esfera", p: [0, 1.5 + pulo, 0], s: [0.9, 0.9, 0.85], cor: pele },
    { f: "esfera", p: [-0.17, 1.98 + pulo, 0.38], s: [0.12, 0.14, 0.06], cor: "#1c1b24" },
    { f: "esfera", p: [0.17, 1.98 + pulo, 0.38], s: [0.12, 0.14, 0.06], cor: "#1c1b24" },
  ];
  // braços
  const bracoCima = acao === "comemorando" || acao === "assustado" ? -150 : acao === "apontando" ? -80 : acao === "carregando" ? -170 : acao === "cavando" ? -40 + Math.sin(t * 6) * 30 : balanco * -1;
  f.push(B([-0.48, 0.95 + pulo, 0], [0.16, 0.65, 0.16], roupa, { rotX: acao === "apontando" ? 0 : bracoCima }));
  f.push(B([0.48, 0.95 + pulo, 0], [0.16, 0.65, 0.16], roupa, { rotX: bracoCima }));
  if (bone) f.push(CIL([0, 2.16 + pulo, 0], [0.86, 0.24, 0.82], bone, { lados: 10 }), B([0, 2.17 + pulo, 0.48], [0.6, 0.06, 0.42], bone));
  if (acao === "carregando") f.push(B([0, 2.35 + pulo, 0], [0.9, 0.7, 0.7], "#c8915c"));
  if (acao === "cavando") f.push(B([0.75, 0.1, 0.3], [0.08, 1.5, 0.08], "#7a5234", { rot: 0, rotX: -20 }), B([0.75, 0.05, 0.62], [0.4, 0.06, 0.35], "#9aa3ad"));
  return f;
}

function formasDaPeca(p: Peca3D): Forma[] {
  if (p.pronta) return biblioteca(p.pronta, p.cor);
  return (p.prims ?? []).slice(0, 30).map((x) => ({ ...x }));
}

/** Tamanho aproximado da peça (para câmera, etiquetas e para o boneco ficar ao lado). */
function medidas(p: Peca3D) {
  const fs = formasDaPeca(p);
  let alto = 1, largo = 1, baixo = 0;
  for (const f of fs) { alto = Math.max(alto, f.p[1] + f.s[1]); baixo = Math.min(baixo, f.p[1]); largo = Math.max(largo, Math.abs(f.p[0]) + f.s[0] / 2, Math.abs(f.p[2]) + f.s[2] / 2); }
  const e = lim(p.escala ?? 1, 0.3, 4);
  return { alto: alto * e, largo: largo * e, baixo: baixo * e };
}

// ───────── organização da cena: medidas, boneco e câmera ─────────
const LONGAS = new Set(["estrada", "ponte", "agua"]);
/** Raio da "pegada" da peça no chão (metros) — usado para ninguém encostar em ninguém. */
export function pegada(p: Peca3D) {
  const m = medidas(p);
  return Math.max(0.6, m.largo);
}

type Cam = { olho: V; alvo: V };
const ANGULOS: Record<string, [number, number]> = {
  // [giro em volta (graus), altura (graus acima do chão)]
  geral: [28, 27], perto: [22, 17], lado: [78, 13], cima: [12, 58], baixo: [32, 6], dentro: [16, 14],
};
const direcao = (az: number, el: number): V => { const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180; return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)]; };

/** Onde o boneco fica nesta cena: ao lado da peça de referência, do lado da câmera, sem encostar em nada nem ficar na estrada. */
export function posBoneco3D(m: Mundo3D, cena: Cena3D, visiveis: string[]): V | null {
  const bon = cena.boneco ?? { acao: "parado" as const };
  if (bon.acao === "sem-boneco") return null;
  const pecas = new Map(m.pecas.map((p) => [p.id, p]));
  const vis = visiveis.map((id) => pecas.get(id)).filter((p): p is Peca3D => !!p);
  const ref = (bon.perto && pecas.get(bon.perto)) || (cena.adiciona ?? []).map((id) => pecas.get(id)).find((p) => p && !LONGAS.has(p.pronta ?? "")) || (cena.foco ? pecas.get(cena.foco) : undefined) || vis.find((p) => !LONGAS.has(p.pronta ?? ""));
  const estrada = vis.find((p) => p.pronta === "estrada");
  const meiaEstrada = estrada ? 3 * lim(estrada.escala ?? 1, 0.3, 4) + 0.6 : 0;
  const [az] = ANGULOS[cena.camera ?? (cena.foco ? "perto" : "geral")] ?? ANGULOS.geral;
  const prefer = direcao(az, 0);
  const cx = ref && !ref.enterrada ? ref.x : 0, cz = ref && !ref.enterrada ? ref.z : 2;
  const r0 = ref && !ref.enterrada ? pegada(ref) + 1.0 : 2;
  let melhor: V | null = null, nota = -Infinity;
  for (let anel = 0; anel < 4; anel++) for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2, r = r0 + anel * 1.2;
    const x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r;
    const livre = vis.every((p) => LONGAS.has(p.pronta ?? "") || p.enterrada || Math.hypot(p.x - x, p.z - z) >= pegada(p) + 0.7) && (!estrada || Math.abs(x - estrada.x) >= meiaEstrada);
    if (!livre) continue;
    // de lado para a câmera (não na frente da peça, tampando; nem atrás, escondido), um pouco para o lado dela
    const d = Math.cos(ang) * prefer[0] + Math.sin(ang) * prefer[2];
    const s = 1 - Math.abs(d - 0.25) - anel * 0.35;
    if (s > nota) { nota = s; melhor = [x, 0, z]; }
  }
  return melhor ?? [cx + r0, 0, cz + 1];
}

/** Pontos que precisam caber na tela (cantos das peças + boneco). */
function pontosDe(pecas: Peca3D[], boneco: V | null): V[] {
  const ps: V[] = [];
  for (const p of pecas) {
    const md = medidas(p), r = pegada(p), y0 = p.enterrada ? -3.2 : 0, y1 = p.enterrada ? 0 : md.alto;
    for (const dx of [-r, r]) for (const dz of [-r, r]) for (const y of [y0, y1]) ps.push([p.x + dx, y, p.z + dz]);
  }
  if (boneco) for (const y of [0, 2.5]) ps.push([boneco[0] - 0.5, y, boneco[2]], [boneco[0] + 0.5, y, boneco[2]]);
  return ps;
}

/**
 * Câmera que MEDE: escolhe o ângulo pedido e afasta até tudo o que importa caber na área útil
 * (abaixo do selo, acima da plaquinha/legenda), com folga. Nunca perto demais, nunca cortando o boneco.
 */
function enquadrar(pts: V[], az: number, el: number, W: number, H: number, topo: number, base: number, folga = 1.12): Cam {
  const ctr: V = mul(pts.reduce((s, p) => add(s, p), [0, 0, 0] as V), 1 / Math.max(1, pts.length));
  const alvo: V = [ctr[0], Math.max(0.6, ctr[1]), ctr[2]];
  const d0 = direcao(az, el);
  const focal = (H / 2) / Math.tan((42 * Math.PI) / 360);
  const cabe = (dist: number) => {
    const olho = add(alvo, mul(d0, dist));
    const f = norm(sub(alvo, olho)), dir = norm(cross(f, [0, 1, 0])), cima = cross(dir, f);
    return pts.every((p) => {
      const d = sub(p, olho), z = dot(d, f);
      if (z < 0.5) return false;
      const x = W / 2 + (dot(d, dir) * focal) / z, y = H * 0.42 - (dot(d, cima) * focal) / z;
      return x > W * 0.07 && x < W * 0.93 && y > topo && y < base;
    });
  };
  let lo = 4, hi = 90;
  for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (cabe(m)) hi = m; else lo = m; }
  return { olho: add(alvo, mul(d0, Math.max(9, hi * folga))), alvo };
}

function camera(m: Mundo3D, cena: Cena3D, pecas: Map<string, Peca3D>, visiveis: string[], W: number, H: number): Cam {
  const vis = visiveis.map((id) => pecas.get(id)).filter((p): p is Peca3D => !!p && !LONGAS.has(p.pronta ?? ""));
  const foco = cena.foco ? pecas.get(cena.foco) : undefined;
  const alvoPecas = foco && !LONGAS.has(foco.pronta ?? "") ? [foco] : vis;
  const bon = posBoneco3D(m, cena, visiveis);
  const pts = pontosDe(alvoPecas.length ? alvoPecas : [], bon);
  // foco numa peça longa (estrada) ou nada além do boneco: enquadra um trecho da estrada/maquete em volta
  if (!alvoPecas.length || (foco && LONGAS.has(foco.pronta ?? ""))) for (const x of [-5, 5]) for (const z of [-7, 7]) pts.push([x, 0, z]);
  if (!pts.length) pts.push([-4, 0, -4], [4, 2, 4]);
  const tipo = cena.camera ?? (foco ? "perto" : "geral");
  const [az, el] = foco?.enterrada && tipo !== "cima" ? [10, 18] : ANGULOS[tipo] ?? ANGULOS.geral;
  const topo = cena.selo ? 330 : 170, base = cena.placa ? 1140 : 1360;
  // de perto ainda com folga: a peça e o boneco nunca enchem a tela inteira
  return enquadrar(pts, az, el, W, H, topo, base, foco ? 1.5 : 1.15);
}

// ───────── quadro ─────────
export type Quadro3D = {
  W: number; H: number; t: number; dur: number;
  mundo: Mundo3D; cena: Cena3D; visiveis: string[];
  camAntes?: Cam; ceuAntes?: Cena3D["ceu"];
  legenda?: { palavras: string[]; atual: number };
};
export type { Cam };

export function camDaCena(m: Mundo3D, cena: Cena3D, visiveis: string[], W = 1080, H = 1920): Cam {
  return camera(m, cena, new Map(m.pecas.map((p) => [p.id, p])), visiveis, W, H);
}

const CHAO_COR: Record<Mundo3D["chao"], string> = { grama: "#8cc65f", areia: "#e8cc93", asfalto: "#8a8f98", neve: "#eef3f9", terra: "#bb9064", piso: "#ddd7c9" };
const CEU: Record<string, [string, string]> = { dia: ["#73b6ea", "#d6eef8"], entardecer: ["#9d8fc2", "#f4c79a"], noite: ["#0f1c3c", "#3a4c80"] };

/** Cenário em volta (longe das peças): árvores e arbustos na grama, dunas na areia, montes na neve. */
function cenario(m: Mundo3D): { forma: Forma; pos: V }[] {
  const out: { forma: Forma; pos: V }[] = [];
  let s = m.pecas.length * 97 + 13;
  const r = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const ocupadas = m.pecas.filter((p) => !LONGAS.has(p.pronta ?? "")).map((p) => ({ x: p.x, z: p.z, r: pegada(p) + 2 }));
  const estrada = m.pecas.find((p) => p.pronta === "estrada");
  for (let i = 0; i < 26; i++) {
    const ang = r() * Math.PI * 2, raio = 13 + r() * 16;
    const x = Math.cos(ang) * raio, z = Math.sin(ang) * raio - 4;
    if (ocupadas.some((o) => Math.hypot(o.x - x, o.z - z) < o.r) || (estrada && Math.abs(x - estrada.x) < 4.5)) continue;
    const e = 0.8 + r() * 0.9;
    if (m.chao === "areia") out.push({ forma: { f: "esfera", p: [0, 0, 0], s: [6 * e, 1.6 * e, 4 * e], cor: "#e2c287", meia: true }, pos: [x, 0, z] });
    else if (m.chao === "neve") out.push({ forma: { f: "cone", p: [0, 0, 0], s: [1.6 * e, 3.2 * e, 1.6 * e], cor: "#3f7a55", lados: 7 }, pos: [x, 0, z] });
    else if (m.chao === "grama" || m.chao === "terra") {
      if (r() < 0.6) { out.push({ forma: { f: "cilindro", p: [0, 0, 0], s: [0.35 * e, 1.2 * e, 0.35 * e], cor: "#7a5234", lados: 6 }, pos: [x, 0, z] }, { forma: { f: "esfera", p: [0, 1 * e, 0], s: [2 * e, 2.2 * e, 2 * e], cor: r() < 0.5 ? "#5fae4f" : "#4f9a45" }, pos: [x, 0, z] }); }
      else out.push({ forma: { f: "esfera", p: [0, 0, 0], s: [1.6 * e, 1 * e, 1.4 * e], cor: "#6db457", meia: true }, pos: [x, 0, z] });
    }
  }
  return out;
}

export function quadro3D(q: Quadro3D): string {
  const { W, H, t, mundo, cena } = q;
  const pecas = new Map(mundo.pecas.map((p) => [p.id, p]));
  const alvoCam = camera(mundo, cena, pecas, q.visiveis, W, H);
  const k = saida(t / 1.1);
  const ant = q.camAntes ?? alvoCam;
  let olho = mix(ant.olho, alvoCam.olho, k);
  const alvo = mix(ant.alvo, alvoCam.alvo, k);
  // a câmera nunca para: gira bem devagar em volta do alvo (no máximo uns 8 graus por cena)
  const giro = (Math.min(t, 4) * 2 * Math.PI) / 180, rel = sub(olho, alvo);
  olho = add(alvo, [rel[0] * Math.cos(giro) - rel[2] * Math.sin(giro), rel[1], rel[0] * Math.sin(giro) + rel[2] * Math.cos(giro)]);

  const f = norm(sub(alvo, olho)), dir = norm(cross(f, [0, 1, 0])), cima = cross(dir, f);
  const focal = (H / 2) / Math.tan((42 * Math.PI) / 360);
  const proj = (p: V): [number, number, number] | null => {
    const d = sub(p, olho);
    const z = dot(d, f);
    if (z < 0.15) return null;
    return [W / 2 + (dot(d, dir) * focal) / z, H * 0.42 - (dot(d, cima) * focal) / z, z];
  };

  const faces: Face[] = [];
  // chão liso de uma cor só (sem xadrez); com algo enterrado vira maquete com corte de terra
  const temEnterrada = mundo.pecas.some((p) => p.enterrada || p.pronta === "sala-enterrada");
  const corChao = CHAO_COR[mundo.chao] ?? CHAO_COR.grama;
  const ext = temEnterrada ? 16 : 120, passo = temEnterrada ? 4 : 12;
  for (let x = -ext; x < ext; x += passo) for (let z = -ext; z < ext; z += passo) {
    const lado = Math.min(passo, ext - x), fundo = Math.min(passo, ext - z);
    faces.push({ pts: [[x, 0, z + fundo], [x + lado, 0, z + fundo], [x + lado, 0, z], [x, 0, z]], cor: corChao, n: [0, 1, 0], camada: 0, contorno: false });
  }
  if (temEnterrada) {
    faces.push({ pts: [[-ext, 0, ext], [ext, 0, ext], [ext, -5, ext], [-ext, -5, ext]], cor: "#9a6f47", n: [0, 0, 1], camada: 1 });
    faces.push({ pts: [[ext, 0, ext], [ext, 0, -ext], [ext, -5, -ext], [ext, -5, ext]], cor: "#86603d", n: [1, 0, 0], camada: 1 });
    faces.push({ pts: [[-ext, 0, -ext], [-ext, 0, ext], [-ext, -5, ext], [-ext, -5, -ext]], cor: "#86603d", n: [-1, 0, 0], camada: 1 });
  }
  if (!temEnterrada) for (const c of cenario(mundo)) faces.push(...facesDaForma(c.forma, { pos: c.pos, esc: 1, rot: 0 }, 3, false));

  const novas = new Set(cena.adiciona ?? []);
  for (const id of q.visiveis) {
    const p = pecas.get(id);
    if (!p) continue;
    const entrada = novas.has(id) ? lim((t - 0.15) / 0.7) : 1;
    // peça andando: segue a frente dela (carro na estrada anda ao longo da estrada)
    const passoMov = cena.movendo === id ? (t / Math.max(1, q.dur) - 0.5) * 10 : 0;
    const ang = ((p.rot ?? 0) * Math.PI) / 180, mx = Math.cos(ang) * passoMov, mz = -Math.sin(ang) * passoMov;
    const longa = LONGAS.has(p.pronta ?? "");
    const falha = cena.falha === id && t > 0.3;
    const treme = falha ? Math.sin(t * 40) * (longa ? 0.02 : 0.08) : 0;
    const tf: Tf = { pos: [p.x + mx + treme, p.enterrada && p.pronta !== "sala-enterrada" ? -3 : 0, p.z + mz], esc: lim(p.escala ?? 1, 0.3, 4), rot: p.rot ?? 0, sy: Math.max(0.001, pulo(entrada)), sxz: 0.6 + 0.4 * saida(entrada) };
    const camada = p.enterrada || p.pronta === "sala-enterrada" ? 2 : 3;
    // peça grande (estrada, ponte) não fica vermelha inteira: só treme de leve
    for (const fm of formasDaPeca(p)) faces.push(...facesDaForma(fm, tf, camada, falha && !longa && Math.sin(t * 6) > 0));
    if (camada === 3 && !longa) {
      const r = pegada(p) * 0.9;
      faces.push({ pts: Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return [p.x + mx + Math.cos(a) * r + 0.4, 0.02, p.z + mz + Math.sin(a) * r * 0.8 + 0.3] as V; }), cor: "#000000", n: [0, 1, 0], camada: 0.5, opac: 0.13, contorno: false });
    }
  }
  // boneco no lugar livre calculado para a cena, virado para a câmera
  const bon = cena.boneco ?? { acao: "parado" as Acao };
  const bpos = posBoneco3D(mundo, cena, q.visiveis);
  if (bpos) {
    const rot = (Math.atan2(olho[0] - bpos[0], olho[2] - bpos[2]) * 180) / Math.PI;
    for (const fm of bonecoFormas(bon.acao, t, "#4a7fd6", "#f2c9a5", mundo.corBone ?? "#e04a3a")) faces.push(...facesDaForma(fm, { pos: bpos, esc: 1.15, rot }, 3, false));
    faces.push({ pts: Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return [bpos[0] + Math.cos(a) * 0.6 + 0.3, 0.02, bpos[2] + Math.sin(a) * 0.5 + 0.2] as V; }), cor: "#000000", n: [0, 1, 0], camada: 0.5, opac: 0.15, contorno: false });
  }

  // projeta, descarta faces de costas, ordena de trás para frente (por camada) e pinta
  const desenho: { z: number; camada: number; svg: string }[] = [];
  for (const fc of faces) {
    const centro = mul(fc.pts.reduce((s, p) => add(s, p), [0, 0, 0] as V), 1 / fc.pts.length);
    if (fc.camada >= 2 && dot(fc.n, sub(olho, centro)) <= 0) continue;
    const ps = fc.pts.map(proj);
    if (ps.some((p) => !p)) continue;
    const luz = fc.contorno === false ? 1 : 0.62 + 0.42 * Math.max(0, dot(fc.n, LUZ));
    const z = ps.reduce((s, p) => s + p![2], 0) / ps.length;
    const pts = ps.map((p) => `${r1(p![0])},${r1(p![1])}`).join(" ");
    const cor = fc.opac ? fc.cor : sombrear(fc.cor, luz);
    desenho.push({ z, camada: fc.camada, svg: `<polygon points="${pts}" fill="${cor}"${fc.opac ? ` opacity="${fc.opac}"` : ""}${fc.contorno === false ? "" : fc.liso ? ` stroke="${cor}" stroke-width="1.5" stroke-linejoin="round"` : ` stroke="${CONTORNO}" stroke-width="2.6" stroke-linejoin="round"`}/>` });
  }
  desenho.sort((a, b) => (a.camada === b.camada ? b.z - a.z : a.camada - b.camada));

  const ceu = cena.ceu ?? q.ceuAntes ?? mundo.ceu ?? "dia";
  const [s1, s2] = CEU[ceu] ?? CEU.dia;
  const partes: string[] = [`<defs><linearGradient id="ceu3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#ceu3)"/>`];
  if (ceu === "noite") partes.push(`<circle cx="${W * 0.8}" cy="230" r="50" fill="#eef1ff"/>`);
  else partes.push(`<circle cx="${W * 0.84}" cy="150" r="52" fill="#ffe27a" stroke="#f2b33d" stroke-width="6"/>`, ...[0, 1, 2].map((i) => { const x = ((i * 410 + t * 18) % (W + 300)) - 150, y = 120 + i * 90; return `<g opacity="0.9"><ellipse cx="${r1(x)}" cy="${y}" rx="95" ry="30" fill="#fff"/><ellipse cx="${r1(x + 55)}" cy="${y - 20}" rx="60" ry="30" fill="#fff"/></g>`; }));
  // fundo do chão até o horizonte (tapa qualquer fresta perto da câmera)
  {
    const h = norm([f[0], 0, f[2]]), zh = dot(h, f);
    const yh = zh > 0.01 ? H * 0.42 - (dot(h, cima) * focal) / zh : 0;
    partes.push(`<rect x="0" y="${r1(Math.max(0, yh))}" width="${W}" height="${r1(H - Math.max(0, yh))}" fill="${corChao}"/>`);
  }
  partes.push(desenho.map((d) => d.svg).join(""));

  // etiquetas: ponto 3D no topo da peça → tela, em tamanho legível, sem encostar umas nas outras
  const etqs = (cena.etiquetas ?? []).slice(0, 3).flatMap((e, i) => {
    const p = pecas.get(e.peca);
    if (!p) return [];
    const md = medidas(p);
    const a = proj([p.x, p.enterrada ? -1.5 : md.alto, p.z]);
    return a ? [{ texto: e.texto, cor: e.cor ?? "azul", alvo: [a[0], a[1]] as [number, number], prog: (t - 0.5 - i * 0.3) / 0.5 }] : [];
  });
  partes.push(etiquetasNaTela(etqs, W, zonasOcupadas(W, !!cena.selo, !!cena.placa)));
  if (cena.selo) partes.push(selo(cena.selo, W, (t - 0.35) / 0.45));
  if (cena.placa) partes.push(placa(cena.placa, W, (t - 0.45) / 0.5));
  if (q.legenda) partes.push(legenda(q.legenda.palavras, q.legenda.atual, new Set((cena.destaques ?? []).map((d) => d.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""))), W));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${partes.join("")}</svg>`;
}
