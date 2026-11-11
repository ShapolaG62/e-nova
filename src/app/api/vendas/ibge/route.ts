import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

const cache = new Map<string, unknown>();

/** GET /api/vendas/ibge[?uf=SP] — estados ou cidades do IBGE (com cache em memória). */
export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) return new Response(null, { status: 401 });
  const uf = req.nextUrl.searchParams.get("uf");
  if (uf && !/^[A-Z]{2}$/.test(uf)) return Response.json([], { status: 400 });
  const url = uf
    ? `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
    : "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome";
  if (!cache.has(url)) {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return Response.json([], { status: 502 });
    const d = (await r.json()) as { sigla?: string; nome: string }[];
    cache.set(url, uf ? d.map((c) => c.nome) : d.map((e) => ({ sigla: e.sigla, nome: e.nome })));
  }
  return Response.json(cache.get(url), { headers: { "Cache-Control": "private, max-age=86400" } });
}
