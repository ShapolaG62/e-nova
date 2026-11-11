import "server-only";
import { env } from "@/lib/env";

/**
 * Cliente mínimo da API local do Ollama (http://127.0.0.1:11434).
 * Roda modelos abertos na própria máquina: Qwen 2.5, Llama 3.1, Mistral,
 * Gemma 2 (Google), gpt-oss (OpenAI)… Sem custo por uso e sem enviar dados para fora.
 */
export const SUPPORTED_MODELS = [
  { id: "qwen2.5:7b", label: "Qwen 2.5 7B", vendor: "Alibaba", note: "Melhor português e JSON nesta faixa", sizeGb: 4.7 },
  { id: "llama3.1:8b", label: "Llama 3.1 8B", vendor: "Meta", note: "Bom geral, um pouco mais lento", sizeGb: 4.9 },
  { id: "mistral:7b", label: "Mistral 7B", vendor: "Mistral AI", note: "Rápido, textos curtos", sizeGb: 4.1 },
  { id: "gemma2:9b", label: "Gemma 2 9B", vendor: "Google", note: "Modelo aberto do Google", sizeGb: 5.4 },
  { id: "qwen2.5:3b", label: "Qwen 2.5 3B", vendor: "Alibaba", note: "Leve: cabe inteiro em GPU de 4 GB", sizeGb: 1.9 },
  { id: "gpt-oss:20b", label: "gpt-oss 20B", vendor: "OpenAI", note: "Modelo aberto da OpenAI — precisa ~16 GB livres", sizeGb: 13 },
] as const;

export type OllamaModel = { name: string; size: number; details?: { parameter_size?: string; quantization_level?: string } };

export async function listLocalModels(): Promise<{ online: boolean; models: OllamaModel[]; version?: string }> {
  try {
    const [tags, ver] = await Promise.all([
      fetch(`${env.OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2500), cache: "no-store" }).then((r) => r.json()),
      fetch(`${env.OLLAMA_URL}/api/version`, { signal: AbortSignal.timeout(2500), cache: "no-store" }).then((r) => r.json()),
    ]);
    return { online: true, models: tags.models ?? [], version: ver.version };
  } catch {
    return { online: false, models: [] };
  }
}

export class OllamaOffline extends Error {}

const ctxFor = (chars: number) => Math.min(8192, Math.max(2048, Math.ceil((chars / 3 + 1500) / 512) * 512));

export async function ollamaChat(opts: {
  model: string;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  temperature?: number;
  timeoutMs?: number;
}) {
  let res: Response;
  try {
    res = await fetch(`${env.OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 300_000),
      body: JSON.stringify({
        model: opts.model,
        stream: false,
        keep_alive: "30m", // mantém o modelo carregado entre pedidos
        format: opts.schema, // saída estruturada: o Ollama força o JSON a seguir o schema
        // Contexto do tamanho do pedido (≈3 caracteres por token + folga para a resposta):
        // em GPU de 4 GB, contexto fixo grande estoura a memória à toa.
        options: { temperature: opts.temperature ?? 0.5, num_ctx: ctxFor(opts.system.length + opts.prompt.length) },
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.prompt },
        ],
      }),
    });
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    if (err.name === "TimeoutError") throw new Error("A IA local demorou demais (modelo grande para esta máquina?)");
    if (err.cause?.code === "ECONNREFUSED") throw new OllamaOffline("Ollama não está rodando");
    throw e;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(json.error ?? `HTTP ${res.status}`);
    if (/not found/i.test(msg)) throw new Error(`Modelo ${opts.model} não está baixado no Ollama (ollama pull ${opts.model})`);
    if (/alloc|out of memory|terminated/i.test(msg)) throw new Error("A IA local ficou sem memória. Feche programas pesados ou use um modelo menor (Qwen 2.5 3B) em Sistema.");
    throw new Error(`Ollama: ${msg}`);
  }
  return {
    content: String(json.message?.content ?? ""),
    inputTokens: Number(json.prompt_eval_count ?? 0),
    outputTokens: Number(json.eval_count ?? 0),
    seconds: Number(json.total_duration ?? 0) / 1e9,
  };
}
