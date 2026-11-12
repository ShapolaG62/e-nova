import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { quadro } from "@/lib/gerador/animacao/desenho";
import type { AnimCena, AnimVideo } from "@/lib/gerador/animacao/tipos";

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
  const a = AMOSTRAS[e];
  if (!a) return new NextResponse(null, { status: 404 });
  let img = cache.get(e);
  if (!img) {
    const svg = quadro({ W: 1080, H: 1920, cena: a.cena, t: 1.1, dur: 3, seed: 7, video: a.video, legenda: { palavras: a.legenda, atual: a.legenda.length - 1 } });
    img = await sharp(Buffer.from(svg)).resize(270, 480).webp({ quality: 78 }).toBuffer();
    cache.set(e, img);
  }
  return new NextResponse(new Uint8Array(img), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600" } });
}
