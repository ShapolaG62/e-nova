import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { fotoPlaces } from "@/lib/sites/service";

/** GET /api/vendas/foto?n=places/…/photos/…&w=400 — foto do Google Maps (a chave fica no servidor). */
export async function GET(req: NextRequest) {
  const u = await getCurrentUser();
  if (!u || !can(u.role, "prospects:read")) return new Response(null, { status: 401 });
  try {
    const buf = await fotoPlaces(req.nextUrl.searchParams.get("n") ?? "", Math.min(1600, Number(req.nextUrl.searchParams.get("w")) || 400));
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" } });
  } catch {
    return new Response(null, { status: 404 });
  }
}
