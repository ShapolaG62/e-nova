import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { env } from "@/lib/env";
import { enqueue } from "@/lib/jobs";

/**
 * POST /api/webhooks/google-reviews?token=WEBHOOK_SECRET
 * Recebe notificações do Google Business Profile (via Pub/Sub push) sobre
 * avaliações novas/atualizadas e agenda a sincronização daquele local.
 * O processamento é assíncrono: respondemos 204 rápido para o Pub/Sub não reenviar.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const secret = env.WEBHOOK_SECRET ?? "";
  const valid = secret.length > 0 && token.length === secret.length && timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  let data: { location?: string; locationName?: string } = {};
  try {
    data = JSON.parse(Buffer.from(body?.message?.data ?? "", "base64").toString("utf8"));
  } catch {
    return new NextResponse(null, { status: 204 }); // mensagem malformada: descarta sem reenvio
  }
  // A notificação traz "accounts/x/locations/y" (eventualmente com sufixo /reviews/z)
  const location = (data.location ?? data.locationName ?? "").match(/accounts\/\d+\/locations\/\d+/)?.[0];
  if (!location) return new NextResponse(null, { status: 204 });

  const client = await db.query.clients.findFirst({ where: eq(t.clients.googleLocationName, location), columns: { id: true } });
  if (client) await enqueue("reviews.sync", { id: client.id }, { dedupeKey: `reviews:${client.id}:push`, maxAttempts: 3 });
  return new NextResponse(null, { status: 204 });
}
