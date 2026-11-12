import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { executar } from "@/lib/ia-hub/roteador";
import { getObjectBuffer, objectSize, putObject } from "@/lib/storage";
import { FRASE_PREVIA, vozDaBiblioteca } from "@/lib/gerador/vozes";

/** GET /api/gerador/voz-previa?v=bib:<id> — uma frase de exemplo na voz da biblioteca (gerada uma vez e guardada). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "ai:use")) return new NextResponse(null, { status: 404 });
  const v = vozDaBiblioteca(req.nextUrl.searchParams.get("v"));
  if (!v) return new NextResponse(null, { status: 404 });
  const chave = `gerador/vozes-previa/${v.id}.mp3`;
  let mp3: Buffer;
  if (await objectSize(chave)) mp3 = await getObjectBuffer(chave);
  else {
    try {
      const r = await executar("voz", { prompt: FRASE_PREVIA, voz: v.voz, idioma: "pt-BR", dados: { velocidade: v.velocidade, tom: v.tom } }, { userId: user.id, somente: ["edge-tts"], timeoutMs: 40_000 });
      const a = r.arquivos?.[0];
      if (!a?.buffer) throw new Error("sem áudio");
      mp3 = Buffer.from(a.buffer);
      await putObject(chave, mp3, "audio/mpeg");
    } catch (e) {
      console.error("[voz-previa]", v.id, e instanceof Error ? e.message : e);
      return NextResponse.json({ erro: "A voz não respondeu agora. Tente de novo em instantes." }, { status: 503 });
    }
  }
  return new NextResponse(new Uint8Array(mp3), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
}
