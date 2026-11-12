import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getObjectBuffer } from "@/lib/storage";

/** GET /api/clipador/marca/:canalId — a imagem da marca d'água do canal (para o preview de arrastar). */
export async function GET(_: Request, ctx: RouteContext<"/api/clipador/marca/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !can(user.role, "content:write") || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const [c] = await db.select({ marca: t.canaisVigiados.marca }).from(t.canaisVigiados).where(eq(t.canaisVigiados.id, id)).limit(1);
  if (!c?.marca.chave) return new NextResponse(null, { status: 404 });
  const png = await getObjectBuffer(c.marca.chave);
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" } });
}
