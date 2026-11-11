import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { storageMode, writeLocalStream } from "@/lib/storage";

/** PUT /api/midia/:id/upload — recebe o vídeo em stream (modo disco local). */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/midia/[id]/upload">) {
  if (storageMode() !== "local") return NextResponse.json({ error: "Use a URL pré-assinada" }, { status: 400 });
  const user = await getCurrentUser();
  if (!user || !can(user.role, "content:write")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Inválido" }, { status: 404 });
  const asset = await db.query.mediaAssets.findFirst({ where: eq(t.mediaAssets.id, id) });
  if (!asset || asset.status !== "UPLOADING") return NextResponse.json({ error: "Upload não encontrado" }, { status: 404 });
  if (!req.body) return NextResponse.json({ error: "Arquivo vazio" }, { status: 400 });

  try {
    const written = await writeLocalStream(asset.storageKey, req.body, env.MAX_UPLOAD_MB * 1024 * 1024);
    return NextResponse.json({ ok: true, bytes: written });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no upload" }, { status: 400 });
  }
}
