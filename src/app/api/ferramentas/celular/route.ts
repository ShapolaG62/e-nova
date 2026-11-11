import { rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/cache";
import { mimeDe, PASTA_TMP, salvarUpload } from "@/lib/ferramentas/arquivos";
import { adicionarNaMesa, conferirToken, itemDaMesa, lerMesa, paginaCelular } from "@/lib/ferramentas/celular";
import { openObjectStream } from "@/lib/storage";

/**
 * /api/ferramentas/celular?t=<token> — página e operações da "mesa" de transferência.
 * O token assinado (com validade) é a autorização: o celular não faz login.
 *   GET  ?t                    → página HTML para o celular
 *   GET  ?t&acao=lista         → JSON com os arquivos
 *   GET  ?t&acao=baixar&id     → baixa um arquivo
 *   PUT  ?t&nome&origem        → envia um arquivo (corpo cru)
 */
const ip = (req: NextRequest) => req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

// a página roda fora do painel (celular na rede local, às vezes sem https): CSP própria, sem upgrade-insecure-requests
const CSP_PAGINA = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token = sp.get("t");
  const sessao = conferirToken(token);
  if (!(await rateLimit(`cel:${ip(req)}`, 600, 600))) return NextResponse.json({ erro: "Muitas requisições" }, { status: 429 });
  const acao = sp.get("acao");

  if (!sessao) {
    if (acao) return NextResponse.json({ erro: "Link expirado" }, { status: 410 });
    return new NextResponse("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><body style='font:16px sans-serif;padding:24px'>Este link expirou. Gere um novo QR Code no E-Nova.</body>", {
      status: 410, headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": CSP_PAGINA },
    });
  }

  if (acao === "lista") {
    const itens = await lerMesa(sessao.sessao);
    return NextResponse.json({ itens, exp: sessao.exp }, { headers: { "Cache-Control": "no-store" } });
  }

  if (acao === "baixar") {
    const id = sp.get("id") ?? "";
    if (!/^[a-f0-9]{24}$/.test(id)) return new NextResponse(null, { status: 404 });
    const item = await itemDaMesa(sessao.sessao, id);
    if (!item) return new NextResponse(null, { status: 404 });
    const { stream, size } = await openObjectStream(item.key);
    const ascii = item.nome.replace(/[^\w.\- ()]/g, "_");
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": mimeDe(item.nome),
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(item.nome)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
        ...(size ? { "Content-Length": String(size) } : {}),
      },
    });
  }

  return new NextResponse(paginaCelular(token!, sessao.exp), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": CSP_PAGINA, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function PUT(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sessao = conferirToken(sp.get("t"));
  if (!sessao) return NextResponse.json({ erro: "Link expirado" }, { status: 410 });
  if (!(await rateLimit(`cel-up:${ip(req)}`, 200, 600))) return NextResponse.json({ erro: "Muitos envios seguidos" }, { status: 429 });
  const nome = sp.get("nome")?.slice(0, 200) ?? "";
  if (!nome || !req.body) return NextResponse.json({ erro: "Arquivo vazio" }, { status: 400 });
  const origem = sp.get("origem") === "pc" ? "pc" : "celular";
  // grava primeiro na pasta temporária (com limite de tamanho), depois no storage
  const donoTmp = "00000000-0000-0000-0000-000000000000";
  let up: Awaited<ReturnType<typeof salvarUpload>> | null = null;
  try {
    up = await salvarUpload(donoTmp, nome, req.body);
    const item = await adicionarNaMesa(sessao.sessao, path.join(PASTA_TMP, donoTmp, up.id, up.nome), up.nome, origem);
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Falha no envio" }, { status: 400 });
  } finally {
    if (up) await rm(path.join(PASTA_TMP, donoTmp, up.id), { recursive: true, force: true });
  }
}
