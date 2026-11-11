import "server-only";
import { env } from "@/lib/env";
import { getSetting } from "@/lib/settings";
import { ollamaChat, OllamaOffline } from "@/lib/ai/ollama";
import { checarResposta } from "../roteador";
import { FalhaProvedor, type Adaptador, type Capacidade, type EntradaIA, type Rota, type SaidaIA } from "../tipos";
import { DIRETOS } from "./diretos";
import { LOCAIS } from "./locais";

/* eslint-disable @typescript-eslint/no-explicit-any */

const extrairJson = (s: string) => {
  const limpo = s.replace(/^```(json)?|```$/gm, "").trim();
  try { return JSON.parse(limpo); } catch { const m = limpo.match(/\{[\s\S]*\}|\[[\s\S]*\]/); if (m) return JSON.parse(m[0]); throw new FalhaProvedor("JSON inválido", "formato"); }
};

function sistemaComSchema(e: EntradaIA) {
  return e.schemaJson
    ? `${e.sistema ?? ""}\n\nResponda SOMENTE com JSON válido que siga este JSON Schema: ${JSON.stringify(e.schemaJson)}\nEscreva em português do Brasil.`
    : (e.sistema ?? "");
}

// ───────── API no formato OpenAI (OpenAI, DeepSeek, Groq, Mistral, Qwen, Together…) ─────────
const openaiCompat: Adaptador = async (cap, e, { chave, rota, sinal }) => {
  const base = (rota.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const auth = { Authorization: `Bearer ${chave.apiKey}` };
  if (cap === "texto") {
    const r = await fetch(`${base}/chat/completions`, {
      method: "POST", signal: sinal, headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: rota.modelo,
        temperature: e.temperatura ?? 0.8,
        messages: [{ role: "system", content: sistemaComSchema(e) }, { role: "user", content: e.prompt ?? "" }],
        ...(e.schemaJson ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    await checarResposta(r, rota.provedor);
    const d = (await r.json()) as any;
    const texto = String(d.choices?.[0]?.message?.content ?? "");
    return { texto, json: e.schemaJson ? extrairJson(texto) : undefined, tokens: { entrada: d.usage?.prompt_tokens ?? 0, saida: d.usage?.completion_tokens ?? 0 } };
  }
  if (cap === "transcricao") {
    const arq = await arquivoDaEntrada(e, sinal);
    const fd = new FormData();
    fd.append("file", new Blob([new Uint8Array(arq.buffer)], { type: arq.mime }), arq.nome);
    fd.append("model", rota.modelo ?? "whisper-1");
    fd.append("response_format", "verbose_json");
    if (e.idioma) fd.append("language", e.idioma.slice(0, 2));
    const r = await fetch(`${base}/audio/transcriptions`, { method: "POST", signal: sinal, headers: auth, body: fd });
    await checarResposta(r, rota.provedor);
    const d = (await r.json()) as any;
    return { texto: d.text, segmentos: (d.segments ?? []).map((s: any) => ({ inicio: s.start, fim: s.end, texto: s.text })) };
  }
  throw new FalhaProvedor(`${rota.provedor} não faz ${cap} por esta rota`, "nao-suporta");
};

// ───────── Anthropic (Claude) ─────────
const anthropic: Adaptador = async (cap, e, { chave, rota, sinal }) => {
  if (cap !== "texto") throw new FalhaProvedor("Claude só faz texto aqui", "nao-suporta");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", signal: sinal,
    headers: { "x-api-key": chave.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: rota.modelo ?? env.AI_MODEL, max_tokens: 8000, system: sistemaComSchema(e), messages: [{ role: "user", content: e.prompt ?? "" }] }),
  });
  await checarResposta(r, "anthropic");
  const d = (await r.json()) as any;
  if (d.stop_reason === "refusal") throw new FalhaProvedor("Claude recusou o pedido", "erro");
  const texto = (d.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  return { texto, json: e.schemaJson ? extrairJson(texto) : undefined, tokens: { entrada: d.usage?.input_tokens ?? 0, saida: d.usage?.output_tokens ?? 0 } };
};

// ───────── Google Gemini (texto) ─────────
const gemini: Adaptador = async (cap, e, ctx) => {
  const { chave, rota, sinal } = ctx;
  if (cap !== "texto") return DIRETOS.gemini(cap, e, ctx);
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(rota.modelo ?? "gemini-3.6-flash")}:generateContent`, {
    method: "POST", signal: sinal, headers: { "Content-Type": "application/json", "x-goog-api-key": chave.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sistemaComSchema(e) }] },
      contents: [{ role: "user", parts: [{ text: e.prompt ?? "" }] }],
      generationConfig: {
        temperature: e.temperatura ?? 0.8,
        ...(e.schemaJson ? { responseMimeType: "application/json" } : {}),
        // Gemini 3 "pensa" muito por padrão (40–70 s até para um ok): raciocínio baixo deixa rápido
        ...(/gemini-3/.test(rota.modelo ?? "gemini-3") ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
      },
    }),
  });
  await checarResposta(r, "gemini");
  const d = (await r.json()) as any;
  const texto = (d.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
  return { texto, json: e.schemaJson ? extrairJson(texto) : undefined, tokens: { entrada: d.usageMetadata?.promptTokenCount ?? 0, saida: d.usageMetadata?.candidatesTokenCount ?? 0 } };
};

// ───────── IA local (Ollama) ─────────
const ollama: Adaptador = async (cap, e) => {
  if (cap !== "texto") throw new FalhaProvedor("Ollama só faz texto", "nao-suporta");
  const model = await getSetting("ai.model", env.OLLAMA_MODEL);
  try {
    const r = await ollamaChat({ model, system: sistemaComSchema(e), prompt: e.prompt ?? "", schema: e.schemaJson ?? { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] }, temperature: e.temperatura ?? 0.8 });
    const json = JSON.parse(r.content);
    return { texto: e.schemaJson ? r.content : String(json.texto ?? r.content), json: e.schemaJson ? json : undefined, tokens: { entrada: r.inputTokens, saida: r.outputTokens } };
  } catch (err) {
    if (err instanceof OllamaOffline) throw new FalhaProvedor("IA local desligada", "fora");
    throw err;
  }
};

// ───────── fal.ai (fila assíncrona; roda dezenas de modelos com uma chave) ─────────
const fal: Adaptador = async (cap, e, { chave, rota, sinal, progresso }) => {
  const modelo = ajustarModeloFal(rota.modelo!, e);
  const corpo: Record<string, unknown> = { prompt: e.prompt, ...(rota.opcoes ?? {}) };
  if (e.imagemUrl) corpo.image_url = e.imagemUrl;
  if (e.videoUrl) corpo.video_url = e.videoUrl;
  if (e.audioUrl) corpo.audio_url = e.audioUrl;
  if (e.proporcao) { corpo.aspect_ratio = e.proporcao; corpo.image_size = { "16:9": "landscape_16_9", "9:16": "portrait_16_9", "1:1": "square_hd" }[e.proporcao]; }
  if (e.duracao) corpo.duration = cap === "video" ? String(e.duracao <= 5 ? 5 : 10) : e.duracao;
  const auth = { Authorization: `Key ${chave.apiKey}` };
  const sub = await fetch(`https://queue.fal.run/${modelo}`, { method: "POST", signal: sinal, headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  await checarResposta(sub, "fal.ai");
  const { status_url, response_url } = (await sub.json()) as { status_url: string; response_url: string };
  for (let i = 0; ; i++) {
    await esperar(i < 5 ? 2000 : 5000, sinal);
    const st = await fetch(status_url, { headers: auth, signal: sinal });
    await checarResposta(st, "fal.ai");
    const s = (await st.json()) as { status: string; queue_position?: number };
    await progresso?.(Math.min(95, 10 + i * 3), s.status === "IN_QUEUE" ? `Na fila do fal.ai (${s.queue_position ?? "?"})` : "Gerando no fal.ai…");
    if (s.status === "COMPLETED") break;
  }
  const res = await fetch(response_url, { headers: auth, signal: sinal });
  await checarResposta(res, "fal.ai");
  return saidaDeUrls(await res.json());
};

// fal tem endpoints separados para "imagem → vídeo"
function ajustarModeloFal(m: string, e: EntradaIA) {
  return e.imagemUrl && m.includes("text-to-video") ? m.replace("text-to-video", "image-to-video") : e.imagemUrl && m === "fal-ai/wan-t2v" ? "fal-ai/wan-i2v" : m;
}

// ───────── Replicate (predictions) ─────────
const replicate: Adaptador = async (cap, e, { chave, rota, sinal, progresso }) => {
  const input: Record<string, unknown> = { prompt: e.prompt, ...(rota.opcoes ?? {}) };
  if (e.imagemUrl) input.image = e.imagemUrl;
  if (e.audioUrl) input.audio = e.audioUrl;
  if (e.proporcao) input.aspect_ratio = e.proporcao;
  const auth = { Authorization: `Bearer ${chave.apiKey}` };
  const r = await fetch(`https://api.replicate.com/v1/models/${rota.modelo}/predictions`, { method: "POST", signal: sinal, headers: { ...auth, "Content-Type": "application/json", Prefer: "wait=50" }, body: JSON.stringify({ input }) });
  await checarResposta(r, "replicate");
  let p = (await r.json()) as any;
  for (let i = 0; p.status !== "succeeded"; i++) {
    if (p.status === "failed" || p.status === "canceled") throw new FalhaProvedor(`replicate: ${p.error ?? p.status}`, "erro");
    await esperar(i < 5 ? 2000 : 5000, sinal);
    const st = await fetch(p.urls.get, { headers: auth, signal: sinal });
    await checarResposta(st, "replicate");
    p = await st.json();
    await progresso?.(Math.min(95, 10 + i * 3), "Gerando no Replicate…");
  }
  return saidaDeUrls(p.output);
};

// ───────── utilidades compartilhadas ─────────
export function esperar(ms: number, sinal: AbortSignal) {
  return new Promise<void>((ok, falha) => {
    const t = setTimeout(ok, ms);
    sinal.addEventListener("abort", () => { clearTimeout(t); falha(new FalhaProvedor("tempo esgotado", "fora")); }, { once: true });
  });
}

const MIME: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg" };
export function mimeDaUrl(u: string, padrao = "application/octet-stream") {
  const ext = /\.([a-z0-9]{2,4})(?:\?|$)/i.exec(u)?.[1]?.toLowerCase();
  return (ext && MIME[ext]) || padrao;
}

/** Acha URLs de arquivo em qualquer formato de resposta (fal, Replicate, etc.). */
export function saidaDeUrls(d: unknown): SaidaIA {
  const urls: { url: string; mime?: string }[] = [];
  const visitar = (v: any) => {
    if (!v) return;
    if (typeof v === "string") { if (/^https?:\/\//.test(v)) urls.push({ url: v }); return; }
    if (Array.isArray(v)) { v.forEach(visitar); return; }
    if (typeof v === "object") {
      if (typeof v.url === "string") { urls.push({ url: v.url, mime: v.content_type }); return; }
      for (const k of ["images", "image", "video", "videos", "audio", "audio_file", "output", "file"]) if (k in v) visitar(v[k]);
    }
  };
  visitar(d);
  if (!urls.length) throw new FalhaProvedor("resposta sem arquivo", "formato");
  return { arquivos: urls.map((u) => ({ url: u.url, mime: u.mime ?? mimeDaUrl(u.url) })), meta: { bruto: typeof d === "object" ? undefined : d } };
}

/** Junta o arquivo de entrada (upload ou URL pública) num Buffer para APIs que pedem multipart. */
export async function arquivoDaEntrada(e: EntradaIA, sinal: AbortSignal) {
  if (e.arquivo) return e.arquivo;
  const url = e.audioUrl ?? e.videoUrl ?? e.imagemUrl;
  if (!url) throw new FalhaProvedor("faltou o arquivo de entrada", "formato");
  const r = await fetch(url, { signal: sinal });
  if (!r.ok) throw new FalhaProvedor("não consegui baixar o arquivo de entrada", "erro");
  return { buffer: Buffer.from(await r.arrayBuffer()), mime: r.headers.get("content-type") ?? mimeDaUrl(url), nome: url.split("/").pop()?.split("?")[0] || "arquivo" };
}

const POR_VIA: Record<string, Adaptador> = { "openai-compat": openaiCompat, anthropic, gemini, ollama, fal, replicate };

export function adaptadorPara(rota: Rota): Adaptador | null {
  if (rota.via === "direto") return DIRETOS[rota.provedor] ?? null;
  if (rota.via === "local") return LOCAIS[rota.modelo ?? ""] ?? null;
  return POR_VIA[rota.via] ?? null;
}

export type { Capacidade };
