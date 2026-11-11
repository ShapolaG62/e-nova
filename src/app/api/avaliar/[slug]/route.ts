import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { rateLimit } from "@/lib/cache";
import { decide, getPlateRoute, SLUG_RE } from "@/lib/nfc/resolve";
import { AiError } from "@/lib/ai/client";
import { suggestReviewText } from "@/lib/ai/tasks";
import { tapContextFromHeaders } from "@/lib/nfc/telemetry";

const body = z.object({
  stars: z.number().int().min(1).max(5),
  tags: z.array(z.string().max(40)).min(1, "Escolha pelo menos uma opção").max(8),
});

/** POST /api/avaliar/:slug — público. Gera 3 sugestões de texto para o consumidor. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/avaliar/[slug]">) {
  const { slug: raw } = await ctx.params;
  const slug = raw.toLowerCase();
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "Plaquinha inválida" }, { status: 404 });

  // Endpoint público que custa dinheiro: limita por IP e por plaquinha
  const ip = tapContextFromHeaders(req.headers).ip ?? "anon";
  if (!(await rateLimit(`avaliar:ip:${ip}`, 5, 60)) || !(await rateLimit(`avaliar:slug:${slug}`, 120, 3600))) {
    return NextResponse.json({ error: "Muitas tentativas. Espere um minutinho." }, { status: 429 });
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });

  const route = await getPlateRoute(slug);
  if (!route || !route.assistant || decide(route).kind !== "redirect") return NextResponse.json({ error: "Indisponível" }, { status: 404 });

  const client = await db.query.clients.findFirst({ where: eq(t.clients.id, route.clientId), columns: { tradeName: true, niche: true, reviewTags: true } });
  if (!client) return NextResponse.json({ error: "Indisponível" }, { status: 404 });

  // Só aceita tags que o estabelecimento oferece (evita usar o endpoint como gerador livre)
  const allowed = new Set((client.reviewTags.length ? client.reviewTags : []).map((s) => s.toLowerCase()));
  const tags = allowed.size ? parsed.data.tags.filter((tg) => allowed.has(tg.toLowerCase())) : parsed.data.tags;
  if (!tags.length) return NextResponse.json({ error: "Escolha pelo menos uma opção" }, { status: 400 });

  try {
    const { data } = await suggestReviewText({ business: client.tradeName, niche: client.niche, tags, stars: parsed.data.stars, clientId: route.clientId });
    return NextResponse.json({ suggestions: data.suggestions.slice(0, 3) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof AiError ? "Não conseguimos sugerir agora — você pode escrever direto no Google." : "Erro inesperado" }, { status: 503 });
  }
}
