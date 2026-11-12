import "server-only";
import { z } from "zod";
import { executar } from "@/lib/ia-hub/roteador";
import { FalhaProvedor } from "@/lib/ia-hub/tipos";

// "Olhos" da corrente de IAs: uma IA que enxerga imagens (via FreeLLMAPI, grátis) descreve as fotos
// enviadas e confere se cada imagem gerada mostra o personagem certo.
// Só IAs que recebem a imagem de verdade entram aqui — outra IA "descreveria" sem ver.
const COM_VISAO = ["freellmapi-texto"];

const dataUrl = (buffer: Buffer, mime: string) => `data:${mime};base64,${buffer.toString("base64")}`;

/** Descreve uma foto em inglês (para virar prompt) — null se nenhuma IA com visão estiver disponível. */
export async function descreverFoto(buffer: Buffer, mime: string, foco: "personagem" | "cena", userId?: string | null): Promise<string | null> {
  const pedido = foco === "personagem"
    ? "Describe the main person in this photo for an illustrator, in ONE English sentence: apparent age, gender presentation, skin tone, hair (color, length, style), facial hair, glasses, clothing and colors. No names, no guesses about identity."
    : "Describe this photo in ONE short English sentence for a video storyboard: main subject, action, place, light and colors. No text you can read in the image.";
  try {
    const r = await executar("texto", { prompt: pedido, imagemUrl: dataUrl(buffer, mime), temperatura: 0.2 }, {
      userId, somente: COM_VISAO, timeoutMs: 90_000,
      validar: (s) => { if (!s.texto || s.texto.trim().length < 15) throw new FalhaProvedor("descrição vazia", "formato"); },
    });
    return r.texto!.replace(/^(here is|based on)[^:]*:\s*/i, "").replace(/\s+/g, " ").trim().slice(0, 400);
  } catch { return null; }
}

const Veredito = z.object({ ok: z.boolean(), motivo: z.string().max(200).optional() });

/**
 * Confere se a imagem gerada mostra o personagem combinado. Na dúvida (sem IA com visão, resposta estranha),
 * aprova: a conferência serve para pegar o erro grosseiro (outra pessoa, outro estilo), não para travar o vídeo.
 */
export async function conferirPersonagem(buffer: Buffer, mime: string, personagem: string, userId?: string | null): Promise<{ ok: boolean; motivo?: string }> {
  try {
    let v: z.infer<typeof Veredito> = { ok: true };
    await executar("texto", {
      prompt: `Character sheet: ${personagem}\nDoes this image clearly show THIS character (same hair, skin, age and clothing), with a natural face and hands, and no written text? Answer as JSON {"ok": true|false, "motivo": "short reason in Portuguese"}.`,
      imagemUrl: dataUrl(buffer, mime), temperatura: 0,
      schemaJson: z.toJSONSchema(Veredito) as Record<string, unknown>,
    }, {
      userId, somente: COM_VISAO, timeoutMs: 60_000,
      validar: (s) => { const p = Veredito.safeParse(s.json); if (!p.success) throw new FalhaProvedor("veredito fora do formato", "formato"); v = p.data; },
    });
    return v;
  } catch { return { ok: true }; }
}
