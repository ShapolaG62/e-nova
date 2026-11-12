import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { quadro } from "@/lib/gerador/animacao/desenho";
import type { AnimCena, AnimVideo, CorteVideo } from "@/lib/gerador/animacao/tipos";
import { quadroCorte } from "@/lib/gerador/animacao/corte";
import { camDaCena, quadro3D } from "@/lib/gerador/animacao/mundo3d";
import type { Mundo3D } from "@/lib/gerador/animacao/tipos";

// miniatura da maquete 3D (pedágio, peças da biblioteca do motor)
const M3D: Mundo3D = { chao: "grama", corBone: "#e04a3a", pecas: [
  { id: "estrada", nome: "estrada", pronta: "estrada", x: 0, z: 0 },
  { id: "cabine", nome: "cabine", pronta: "cabine", x: -4.2, z: 2 },
  { id: "cancela", nome: "cancela", pronta: "cancela", x: -3.2, z: 3.2 },
  { id: "carro", nome: "carro", pronta: "carro", x: 0, z: 5, rot: 90 },
  { id: "arvore", nome: "árvore", pronta: "arvore", x: 6, z: -3 },
] };

// miniatura do mundo em corte (poço de gelo no deserto, peças prontas do motor)
const CORTE: CorteVideo = { ambiente: "deserto", corBone: "#d8402f", pecas: [
  { id: "muro", nome: "muro", pronta: "muro", lugar: "chao", x: 0.16, largura: 0.07, altura: 4 },
  { id: "poco", nome: "poço", pronta: "buraco", lugar: "subsolo", x: 0.5, largura: 0.44, altura: 1 },
  { id: "gelo", nome: "gelo", pronta: "blocos", lugar: "subsolo", dentro: "poco", x: 0.5, largura: 0.36, altura: 0.36 },
  { id: "cupula", nome: "cúpula", pronta: "cupula", lugar: "chao", x: 0.5, largura: 0.5, altura: 0.85 },
] };

// Miniatura de cada estilo de personagem para os botões da tela (desenhada pelo próprio motor).
const AMOSTRAS: Record<string, { cena: AnimCena; video: AnimVideo; legenda: string[] }> = {
  desenho: {
    video: { traco: "desenho", elenco: [
      { nome: "A", pele: "#c68a5e", cabelo: "cacheado", corCabelo: "#2b1d16", roupa: "#4caf6e", idade: "crianca" },
      { nome: "B", pele: "#f2c9a5", cabelo: "franja", corCabelo: "#d8a13a", roupa: "#e04f5f", idade: "crianca" },
    ] },
    cena: { cenario: "apto-rico", paleta: "dia", acao: "parado", quem: [{ nome: "A", expressao: "feliz" }, { nome: "B", expressao: "surpreso" }], placar: { valor: "900" } },
    legenda: ["NO", "ANDAR", "900"],
  },
  recorte: {
    video: { traco: "recorte", elenco: [
      { nome: "A", pele: "#f2d2b0", cabelo: "bone", corCabelo: "#2e7bd6", roupa: "#e2483d", calca: "#3a4a6b", idade: "crianca" },
      { nome: "B", pele: "#a86b45", cabelo: "black", corCabelo: "#2b1d16", roupa: "#7a4fc4", calca: "#2f3b5c", idade: "crianca" },
    ] },
    cena: { cenario: "cidade-neve", paleta: "inverno", acao: "parado", quem: [{ nome: "A", expressao: "rindo" }, { nome: "B", expressao: "surpreso" }] },
    legenda: ["NA", "CIDADE", "PEQUENA"],
  },
  silhueta: {
    video: { corPersonagem: "#e23a3a", episodio: "EP. 1" },
    cena: { cenario: "rua-noite", paleta: "noite", acao: "parado", objetos: ["lanterna", "poste"], status: "PASSOS ATRÁS", alerta: true },
    legenda: ["VOCÊ", "DECIDE"],
  },
};
const cache = new Map<string, Buffer>();

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "ai:use")) return new NextResponse(null, { status: 404 });
  const e = req.nextUrl.searchParams.get("e") ?? "";
  const a = AMOSTRAS[e] ?? (e === "corte" || e === "3d" ? AMOSTRAS.silhueta : undefined);
  if (!a) return new NextResponse(null, { status: 404 });
  let img = cache.get(e);
  if (!img) {
    const vis3d = ["estrada", "cabine", "cancela", "carro", "arvore"];
    const cena3d = { camera: "geral" as const, boneco: { acao: "apontando" as const, perto: "cabine" }, etiquetas: [{ peca: "cabine", texto: "pedágio", cor: "amarelo" as const }] };
    const svg = e === "3d"
      ? quadro3D({ W: 1080, H: 1920, t: 1.6, dur: 3, mundo: M3D, cena: cena3d, visiveis: vis3d, camAntes: camDaCena(M3D, cena3d, vis3d), legenda: { palavras: ["VOCÊ", "CONSTRUIU"], atual: 1 } })
      : e === "corte"
      ? quadroCorte({ W: 1080, H: 1920, t: 1.6, dur: 3, seed: 11, video: CORTE, visiveis: ["muro", "poco", "gelo", "cupula"], cena: { boneco: { acao: "apontando", x: 0.84 }, selo: "2.000 ANOS", etiquetas: [{ peca: "gelo", texto: "gelo", cor: "azul" }] }, legenda: { palavras: ["POÇO", "DE GELO"], atual: 1 } })
      : quadro({ W: 1080, H: 1920, cena: a.cena, t: 1.1, dur: 3, seed: 7, video: a.video, legenda: { palavras: a.legenda, atual: a.legenda.length - 1 } });
    img = await sharp(Buffer.from(svg)).resize(270, 480).webp({ quality: 78 }).toBuffer();
    cache.set(e, img);
  }
  return new NextResponse(new Uint8Array(img), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600" } });
}
