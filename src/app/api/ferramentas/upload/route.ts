import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { rateLimit } from "@/lib/cache";
import { salvarUpload } from "@/lib/ferramentas/arquivos";

/**
 * PUT /api/ferramentas/upload?nome=arquivo.mp4 — recebe um arquivo em stream (corpo cru)
 * e devolve um id temporário que as ações das Ferramentas usam. Exige "ai:use".
 */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "ai:use")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  if (!(await rateLimit(`ferr-up:${user.id}`, 120, 600))) return NextResponse.json({ erro: "Muitos envios seguidos. Espere alguns minutos." }, { status: 429 });
  const nome = req.nextUrl.searchParams.get("nome")?.slice(0, 200) ?? "";
  if (!nome) return NextResponse.json({ erro: "Nome do arquivo faltando" }, { status: 400 });
  if (!req.body) return NextResponse.json({ erro: "Arquivo vazio" }, { status: 400 });
  try {
    const r = await salvarUpload(user.id, nome, req.body);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Falha no envio" }, { status: 400 });
  }
}
