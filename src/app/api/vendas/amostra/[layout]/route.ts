import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { renderSite, montarDocumento, listaPaletas, setor as pegarSetor } from "@/lib/sites/engine";
import { NEGOCIO_AMOSTRA, FOTOS_AMOSTRA, SETOR_POR_LAYOUT } from "@/lib/sites/amostra";

// Pasta fixa das fotos das prévias (o endereço /sm/ exige um id no formato uuid).
const PASTA = "00000000-0000-4000-8000-00000000a405";
const locais = new Map<string, Promise<string | null>>();
/** Baixa a foto para o servidor uma vez (links da Pixabay expiram e às vezes bloqueiam). */
function local(f: Foto) {
  if (!locais.has(f.id)) locais.set(f.id, import("@/lib/sites/service").then((m) => m.baixarImagemUrl(f.url, PASTA)).catch(() => null));
  return locais.get(f.id)!;
}

// Fotos de verdade do ramo (Pixabay) para a prévia; guardadas 1 hora na memória.
type Foto = { id: string; url: string };
const cache = new Map<string, { em: number; fotos: Foto[] }>();
async function fotosReais(termo: string): Promise<Foto[]> {
  const c = cache.get(termo);
  if (c && Date.now() - c.em < 3_600_000) return c.fotos;
  try {
    const { chavePixabay, buscarPixabay } = await import("@/lib/ferramentas/pixabay");
    const chave = await chavePixabay();
    if (!chave) return [];
    const { itens } = await buscarPixabay(chave, { termo, tipo: "foto", pagina: 1, porPagina: 30, orientacao: "horizontal", idioma: "pt" });
    const fotos = itens.filter((i) => i.url && i.largura >= 1200).map((i) => ({ id: i.id, url: i.url })).slice(0, 18);
    cache.set(termo, { em: Date.now(), fotos });
    return fotos;
  } catch { return []; }
}

/** GET /api/vendas/amostra/:layout[?paleta=id] — prévia de um visual com um negócio de exemplo (e, se pedir, com uma paleta pronta). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/vendas/amostra/[layout]">) {
  if (!(await getCurrentUser())) return new Response(null, { status: 401 });
  const { layout } = await ctx.params;
  const setor = SETOR_POR_LAYOUT[layout] ?? "outro";
  const reais = await fotosReais(pegarSetor(setor).busca || setor);
  const baixadas = (await Promise.all(reais.slice(0, 10).map(local))).filter((x): x is string => !!x);
  const fotos = baixadas.length >= 6 ? baixadas : FOTOS_AMOSTRA;
  const doc = montarDocumento(NEGOCIO_AMOSTRA, { setor, layout, fotos });
  // uma foto por serviço, buscada pelo nome do serviço (como no site de verdade)
  const busca = pegarSetor(setor).busca || setor;
  const serv = doc.blocos.find((b) => b.tipo === "servicos");
  const itens = ((serv?.dados.itens ?? []) as { titulo: string; foto?: string }[]).slice(0, 8);
  const usadas = new Set(reais.slice(0, 10).map((x) => x.id));
  // primeiro só o nome do serviço (mais certeiro); se vier pouco, junta o ramo
  const achadas = await Promise.all(itens.map(async (it) => { const a = await fotosReais(it.titulo); return a.length >= 3 ? a : [...a, ...(await fotosReais(`${it.titulo} ${busca}`))]; }));
  const escolhidas = itens.map((_, i) => { const f = achadas[i].find((x) => !usadas.has(x.id)); if (f) usadas.add(f.id); return f; });
  const locaisServ = await Promise.all(escolhidas.map((f) => (f ? local(f) : null)));
  itens.forEach((it, i) => { if (locaisServ[i]) it.foto = locaisServ[i]!; });
  const p = listaPaletas().find((x) => x.id === req.nextUrl.searchParams.get("paleta"));
  if (p) {
    doc.paleta = p.id;
    doc.cores = { primaria: p.cores[0], secundaria: p.cores[1] };
    doc.tema = p.fundo.id;
  }
  return new Response(renderSite(doc), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=600" } });
}
