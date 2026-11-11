import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db, t } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { quadro } from "@/lib/gerador/animacao/desenho";

/** GET /api/gerador/:id/previa?c=<cena> — um quadro desenhado da cena (modo animação), para o editor de roteiro. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/gerador/[id]/previa">) {
  const { id } = await ctx.params;
  const cenaId = req.nextUrl.searchParams.get("c") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^c\d{1,3}$/.test(cenaId)) return new NextResponse(null, { status: 404 });
  const user = await getCurrentUser();
  if (!user || !can(user.role, "ai:use")) return new NextResponse(null, { status: 404 });
  const [p] = await db.select({ userId: t.videoProjetos.userId, roteiro: t.videoProjetos.roteiro }).from(t.videoProjetos).where(eq(t.videoProjetos.id, id)).limit(1);
  if (!p || (p.userId !== user.id && !can(user.role, "system:view"))) return new NextResponse(null, { status: 404 });
  const i = p.roteiro?.cenas.findIndex((c) => c.id === cenaId) ?? -1;
  const cena = i >= 0 ? p.roteiro!.cenas[i] : null;
  if (!cena) return new NextResponse(null, { status: 404 });
  const ultima = i === p.roteiro!.cenas.length - 1;
  const palavras = cena.narracao.split(/\s+/).filter(Boolean).slice(0, 3);
  const svg = quadro({
    W: 1080, H: 1920, cena: cena.anim ?? { cenario: "rua-noite", paleta: "noite", acao: "parado" }, t: 1.2, dur: 3, seed: 1000 + i * 17,
    video: p.roteiro!.anim ?? {}, legenda: { palavras, atual: palavras.length - 1 },
    escolhaProg: ultima && p.roteiro!.anim?.escolha ? 1 : undefined,
  });
  const png = await sharp(Buffer.from(svg)).resize(360, 640).webp({ quality: 80 }).toBuffer();
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=60" } });
}
