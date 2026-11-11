import "server-only";
import { z } from "zod";
import { db, t } from "@/db";
import { env } from "@/lib/env";
import { getSetting } from "@/lib/settings";
import { decrypt } from "@/lib/crypto";

export class AiError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
  ) {
    super(message);
  }
}

type Kind = "REVIEW_SUGGESTION" | "REVIEW_REPLY" | "VIDEO_SCRIPT" | "EMAIL" | "REPORT_SUMMARY" | "CLIP_ANALYSIS" | "SITE_COPY" | "SALES_SCRIPT";

/** Chave do Gemini salva antes da Central de IA (continua valendo). */
export async function geminiKey(): Promise<string | null> {
  const enc = await getSetting<string | null>("ai.geminiKey", null);
  if (!enc) return null;
  try { return decrypt(enc); } catch { return null; }
}

/**
 * Qual IA de texto vai responder primeiro agora (pela Central de IA: a melhor com chave).
 * `rapida` = é um serviço na nuvem (a IA local no computador é bem mais lenta).
 */
export async function activeAi(): Promise<{ provider: string; model: string; nome: string; rapida: boolean }> {
  const { candidatos } = await import("@/lib/ia-hub/roteador");
  const c = (await candidatos("texto")).find((x) => x.temChave && !x.emCastigo);
  if (!c || c.rota.via === "ollama") return { provider: "ollama", model: await getSetting("ai.model", env.OLLAMA_MODEL), nome: "IA local", rapida: false };
  return { provider: c.rota.provedor, model: c.rota.modelo ?? "", nome: c.item.nome, rapida: true };
}

/**
 * Uma geração estruturada (validada por Zod) com revezamento automático da Central de IA:
 * a melhor IA de texto configurada responde; se falhar ou devolver fora do formato, a próxima assume.
 * Toda chamada fica registrada em ai_generations.
 */
export async function generate<S extends z.ZodType>(opts: {
  kind: Kind;
  schema: S;
  system: string;
  prompt: string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  log: { clientId?: string | null; userId?: string | null; title?: string; input: Record<string, unknown> };
}): Promise<{ data: z.infer<S>; generationId: string }> {
  const { executar, SemProvedor } = await import("@/lib/ia-hub/roteador");
  const { FalhaProvedor } = await import("@/lib/ia-hub/tipos");
  const base = { kind: opts.kind, clientId: opts.log.clientId ?? null, userId: opts.log.userId ?? null, title: opts.log.title?.slice(0, 200), input: opts.log.input };
  let dados: z.infer<S> | undefined;
  try {
    const r = await executar(
      "texto",
      { sistema: opts.system, prompt: opts.prompt, schemaJson: z.toJSONSchema(opts.schema) as Record<string, unknown> },
      {
        userId: opts.log.userId,
        validar: (s) => {
          const p = opts.schema.safeParse(s.json);
          if (!p.success) throw new FalhaProvedor(`formato: ${p.error.issues[0]?.message ?? "inválido"}`, "formato");
          dados = p.data as z.infer<S>;
        },
      },
    );
    const [row] = await db
      .insert(t.aiGenerations)
      .values({ ...base, output: dados as Record<string, unknown>, model: `${r.usado.provedor}:${r.usado.modelo ?? r.usado.item}`, inputTokens: r.tokens?.entrada ?? 0, outputTokens: r.tokens?.saida ?? 0 })
      .returning({ id: t.aiGenerations.id });
    return { data: dados as z.infer<S>, generationId: row.id };
  } catch (e) {
    const userMessage =
      e instanceof SemProvedor
        ? e.tentativas.length
          ? "Nenhuma IA conseguiu responder agora (todas falharam ou estão sem crédito). Veja a Central de IA."
          : "Nenhuma IA de texto disponível. Ligue a IA local (Ollama) ou cadastre uma chave na Central de IA."
        : "Falha inesperada ao gerar. Tente de novo.";
    await db
      .insert(t.aiGenerations)
      .values({ ...base, model: "central", ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 1000) })
      .catch(() => {});
    throw new AiError(e instanceof Error ? e.message : String(e), userMessage);
  }
}
