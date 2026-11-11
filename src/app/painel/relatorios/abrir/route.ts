import { NextResponse, type NextRequest } from "next/server";

/** Converte o formulário (cliente + mês) na URL limpa do relatório. */
export function GET(req: NextRequest) {
  const cliente = req.nextUrl.searchParams.get("cliente") ?? "";
  const mes = req.nextUrl.searchParams.get("mes") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(cliente)) return NextResponse.redirect(new URL("/painel/relatorios", req.url));
  const q = /^\d{4}-\d{2}$/.test(mes) ? `?mes=${mes}` : "";
  return NextResponse.redirect(new URL(`/painel/relatorios/${cliente}${q}`, req.url));
}
