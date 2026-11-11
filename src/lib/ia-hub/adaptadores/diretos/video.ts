import "server-only";
import type { Adaptador, ContextoAdaptador, EntradaIA, SaidaIA } from "../../tipos";
import {
  FalhaProvedor, aguardar, dataUri, exigirPrompt, imagemDaEntrada, jwtHs256, linkPublico, naoFaz, pedir, pedirJson,
} from "./comum";

/* eslint-disable @typescript-eslint/no-explicit-any */

const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

// ───────── Google (Gemini API): imagem e vídeo ─────────
// Imagen (:predict) e Veo (:predictLongRunning) foram desligados na Gemini API (Imagen 4 em 17/08/2026, Veo 3.1 em 22/10/2026).
// Substitutos oficiais: modelos de imagem do Gemini (generateContent com responseModalities IMAGE)
// e o Gemini Omni (Interactions API) para vídeo. Os caminhos antigos continuam aqui caso o modelo seja trocado na tela.
const GEM = "https://generativelanguage.googleapis.com/v1beta";

export const gemini: Adaptador = async (cap, e, ctx) => {
  if (cap === "imagem") return geminiImagem(e, ctx);
  if (cap === "video") return geminiVideo(e, ctx);
  if (cap === "transcricao") return geminiTranscricao(e, ctx);
  throw naoFaz("Google Gemini", cap);
};

/**
 * Transcrição pelo Gemini (áudio direto no pedido). Rápida e boa no português,
 * mas os tempos escorregam em áudio longo: quem chama deve mandar pedaços curtos (~60 s).
 */
async function geminiTranscricao(e: EntradaIA, ctx: ContextoAdaptador): Promise<SaidaIA> {
  const { chave, rota, sinal } = ctx;
  const arq = e.arquivo;
  if (!arq) throw new FalhaProvedor("Gemini: faltou o áudio", "formato");
  if (arq.buffer.length > 18 * 1024 * 1024) throw new FalhaProvedor("Gemini: áudio grande demais para mandar direto (corte em pedaços)", "nao-suporta");
  const modelo = rota.modelo ?? "gemini-3.5-flash";
  await ctx.progresso?.(20, "Transcrevendo no Google…");
  const d = await pedirJson(`${GEM}/models/${encodeURIComponent(modelo)}:generateContent`, {
    method: "POST", headers: { "x-goog-api-key": chave.apiKey }, sinal, quem: "Gemini transcrição",
    json: {
      contents: [{ role: "user", parts: [
        { inlineData: { mimeType: arq.mime || "audio/mpeg", data: arq.buffer.toString("base64") } },
        { text: `Transcreva este áudio em ${e.idioma === "en" ? "inglês" : "português do Brasil"}, palavra por palavra, sem resumir nem corrigir o que foi dito. Responda SOMENTE JSON: {"segmentos":[{"inicio":segundos,"fim":segundos,"texto":"..."}]} com frases curtas (até ~12 palavras) e tempos precisos em segundos desde o início deste áudio. Se não houver fala, devolva {"segmentos":[]}.` },
      ] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0, ...(/gemini-3/.test(modelo) ? { thinkingConfig: { thinkingLevel: "low" } } : {}) },
    },
  });
  const txt: string = (d.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
  const { jsonDe } = await import("./gratis");
  const j = jsonDe(txt) as any;
  const brutos: any[] = Array.isArray(j) ? j : j?.segmentos ?? [];
  const segmentos = brutos
    .map((s) => ({ inicio: Number(s.inicio ?? s.start), fim: Number(s.fim ?? s.end), texto: String(s.texto ?? s.text ?? "").trim() }))
    .filter((s) => Number.isFinite(s.inicio) && Number.isFinite(s.fim) && s.texto)
    .map((s) => ({ ...s, fim: Math.max(s.fim, s.inicio + 0.3) }));
  return { texto: segmentos.map((s) => s.texto).join(" "), segmentos };
}

async function geminiImagem(e: EntradaIA, ctx: ContextoAdaptador): Promise<SaidaIA> {
  const { chave, rota, sinal } = ctx;
  const h = { "x-goog-api-key": chave.apiKey };
  const modelo = rota.modelo ?? "gemini-3.1-flash-image";
  const prompt = exigirPrompt(e, "Gemini");
  await ctx.progresso?.(20, "Gerando imagem no Google…");
  if (modelo.startsWith("imagen")) {
    const d = await pedirJson(`${GEM}/models/${encodeURIComponent(modelo)}:predict`, {
      method: "POST", headers: h, sinal, quem: "Imagen",
      json: { instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: e.proporcao ?? "1:1" } },
    });
    const arquivos = (d.predictions ?? []).filter((p: any) => p.bytesBase64Encoded)
      .map((p: any) => ({ buffer: Buffer.from(p.bytesBase64Encoded, "base64"), mime: p.mimeType ?? "image/png", nome: "imagem.png" }));
    if (!arquivos.length) throw new FalhaProvedor("Imagen: resposta sem imagem (pode ter sido barrada pelo filtro)", "formato");
    return { arquivos };
  }
  const ref = await imagemDaEntrada(e, sinal);
  const d = await pedirJson(`${GEM}/models/${encodeURIComponent(modelo)}:generateContent`, {
    method: "POST", headers: h, sinal, quem: "Gemini imagem",
    json: {
      contents: [{ role: "user", parts: [{ text: prompt }, ...(ref ? [{ inlineData: { mimeType: ref.mime, data: ref.buffer.toString("base64") } }] : [])] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: e.proporcao ?? "1:1" } },
    },
  });
  const arquivos = (d.candidates?.[0]?.content?.parts ?? []).filter((p: any) => p.inlineData?.data)
    .map((p: any) => ({ buffer: Buffer.from(p.inlineData.data, "base64"), mime: p.inlineData.mimeType ?? "image/png", nome: "imagem.png" }));
  if (!arquivos.length) throw new FalhaProvedor(`Gemini: resposta sem imagem${d.candidates?.[0]?.finishReason ? ` (${d.candidates[0].finishReason})` : ""}`, "formato");
  return { arquivos };
}

/** Procura, em qualquer nível da resposta, a parte de vídeo (base64 ou uri). */
function acharVideo(v: any): { data?: string; uri?: string; mime?: string } | null {
  if (!v || typeof v !== "object") return null;
  if (Array.isArray(v)) { for (const x of v) { const r = acharVideo(x); if (r) return r; } return null; }
  const ehVideo = v.type === "video" || String(v.mime_type ?? v.mimeType ?? "").startsWith("video/");
  if (ehVideo && (typeof v.data === "string" || typeof v.uri === "string")) return { data: v.data, uri: v.uri, mime: v.mime_type ?? v.mimeType };
  for (const k of Object.keys(v)) { const r = acharVideo(v[k]); if (r) return r; }
  return null;
}

async function baixarGoogle(uri: string, ctx: ContextoAdaptador) {
  const r = await pedir(uri, { headers: { "x-goog-api-key": ctx.chave.apiKey }, sinal: ctx.sinal, quem: "Google (download)", redirect: "follow" });
  return Buffer.from(await r.arrayBuffer());
}

async function geminiVideo(e: EntradaIA, ctx: ContextoAdaptador): Promise<SaidaIA> {
  const { chave, rota, sinal } = ctx;
  const h = { "x-goog-api-key": chave.apiKey };
  const modelo = rota.modelo ?? "gemini-omni-1.2-flash";
  const prompt = exigirPrompt(e, "Google vídeo");
  const img = await imagemDaEntrada(e, sinal);
  const prop = e.proporcao === "9:16" ? "9:16" : "16:9";

  if (modelo.startsWith("veo")) {
    // caminho antigo do Veo (operação de longa duração)
    const op = await pedirJson(`${GEM}/models/${encodeURIComponent(modelo)}:predictLongRunning`, {
      method: "POST", headers: h, sinal, quem: "Veo",
      json: {
        instances: [{ prompt, ...(img ? { image: { bytesBase64Encoded: img.buffer.toString("base64"), mimeType: img.mime } } : {}) }],
        parameters: { aspectRatio: prop, ...(e.duracao ? { durationSeconds: limitar(e.duracao, 4, 8) } : {}) },
      },
    });
    const uri = await aguardar(ctx, async () => {
      const s = await pedirJson(`${GEM}/${op.name}`, { headers: h, sinal, quem: "Veo" });
      if (s.error) throw new FalhaProvedor(`Veo: ${s.error.message ?? "falhou"}`, "erro");
      if (!s.done) return undefined;
      const u = s.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!u) throw new FalhaProvedor("Veo: vídeo barrado pelo filtro ou resposta sem vídeo", "erro");
      return u as string;
    }, { etapa: "Gerando vídeo no Veo…" });
    return { arquivos: [{ buffer: await baixarGoogle(uri, ctx), mime: "video/mp4", nome: "video.mp4" }] };
  }

  // Gemini Omni (Interactions API): resposta síncrona; com delivery "uri" o arquivo fica na Files API
  await ctx.progresso?.(15, "Gerando vídeo no Google (Gemini Omni)…");
  const d = await pedirJson(`${GEM}/interactions`, {
    method: "POST", headers: h, sinal, quem: "Gemini Omni",
    json: {
      model: modelo,
      input: [{ type: "text", text: prompt }, ...(img ? [{ type: "image", mime_type: img.mime, data: img.buffer.toString("base64") }] : [])],
      response_format: { type: "video", aspect_ratio: prop, resolution: "720p", duration: `${limitar(e.duracao ?? 8, 3, 15)}s`, delivery: "uri" },
    },
  });
  const v = acharVideo(d.steps ?? d.outputs ?? d);
  if (!v) throw new FalhaProvedor("Gemini Omni: resposta sem vídeo (pode ter sido barrado pelo filtro)", "formato");
  if (v.data) return { arquivos: [{ buffer: Buffer.from(v.data, "base64"), mime: v.mime ?? "video/mp4", nome: "video.mp4" }] };
  const idArq = /\/files\/([^:/?]+)/.exec(v.uri!)?.[1];
  if (idArq) {
    await aguardar(ctx, async () => {
      const f = await pedirJson(`${GEM}/files/${idArq}`, { headers: h, sinal, quem: "Gemini Files" });
      if (f.state === "FAILED") throw new FalhaProvedor("Gemini: o arquivo de vídeo falhou", "erro");
      return f.state === "ACTIVE" || !f.state ? true : undefined;
    }, { etapa: "Preparando o vídeo no Google…", inicio: 80 });
  }
  return { arquivos: [{ buffer: await baixarGoogle(v.uri!, ctx), mime: "video/mp4", nome: "video.mp4" }] };
}

// ───────── Runway (API dev: image_to_video / text_to_video + /v1/tasks) ─────────
const RUN = "https://api.dev.runwayml.com/v1";
export const runway: Adaptador = async (cap, e, ctx) => {
  if (cap !== "video") throw naoFaz("Runway", cap);
  const { chave, rota, sinal } = ctx;
  const h = { Authorization: `Bearer ${chave.apiKey}`, "X-Runway-Version": "2024-11-06" };
  const img = await imagemDaEntrada(e, sinal);
  const duration = limitar(e.duracao ?? 5, 2, 10);
  let caminho: string, corpo: Record<string, unknown>;
  if (img) {
    const uri = dataUri(img);
    // data URI até ~5 MB; acima disso só com link público
    const promptImage = uri.length <= 5_000_000 ? uri : linkPublico(e.imagemUrl, "Runway", "a imagem (acima de 3 MB)");
    caminho = "image_to_video";
    corpo = { model: rota.modelo ?? "gen4_turbo", promptImage, ratio: { "16:9": "1280:720", "9:16": "720:1280", "1:1": "960:960" }[e.proporcao ?? "16:9"], duration, ...(e.prompt ? { promptText: e.prompt.slice(0, 1000) } : {}) };
  } else {
    // gen4_turbo só faz imagem→vídeo; texto→vídeo usa o gen4.5
    caminho = "text_to_video";
    corpo = { model: rota.modelo && rota.modelo !== "gen4_turbo" ? rota.modelo : "gen4.5", promptText: exigirPrompt(e, "Runway").slice(0, 1000), ratio: e.proporcao === "9:16" ? "720:1280" : "1280:720", duration };
  }
  const t = await pedirJson(`${RUN}/${caminho}`, { method: "POST", headers: h, json: corpo, sinal, quem: "Runway" });
  return aguardar(ctx, async () => {
    const s = await pedirJson(`${RUN}/tasks/${t.id}`, { headers: h, sinal, quem: "Runway" });
    if (s.status === "SUCCEEDED") return { arquivos: (s.output ?? []).map((url: string) => ({ url, mime: "video/mp4" })) };
    if (s.status === "FAILED" || s.status === "CANCELLED") throw new FalhaProvedor(`Runway: ${s.failure ?? s.status}`, "erro");
    return undefined;
  }, { etapa: "Gerando vídeo no Runway…", minimoMs: 5000 });
};

// ───────── Luma Dream Machine (v1 generations) ─────────
const LUMA = "https://api.lumalabs.ai/dream-machine/v1";
export const luma: Adaptador = async (cap, e, ctx) => {
  if (cap !== "video") throw naoFaz("Luma", cap);
  const { chave, rota, sinal } = ctx;
  const h = { Authorization: `Bearer ${chave.apiKey}`, accept: "application/json" };
  // a Luma só aceita imagem por link (não tem upload)
  if (e.arquivo?.mime.startsWith("image/") && !e.imagemUrl) throw new FalhaProvedor("Luma precisa de um link público para a imagem", "nao-suporta");
  const corpo: Record<string, unknown> = {
    prompt: exigirPrompt(e, "Luma"), model: rota.modelo ?? "ray-2", aspect_ratio: e.proporcao ?? "16:9",
    resolution: "720p", duration: (e.duracao ?? 5) > 6 ? "9s" : "5s",
  };
  if (e.imagemUrl) corpo.keyframes = { frame0: { type: "image", url: linkPublico(e.imagemUrl, "Luma", "a imagem") } };
  const g = await pedirJson(`${LUMA}/generations`, { method: "POST", headers: h, json: corpo, sinal, quem: "Luma" });
  return aguardar(ctx, async () => {
    const s = await pedirJson(`${LUMA}/generations/${g.id}`, { headers: h, sinal, quem: "Luma" });
    if (s.state === "completed" && s.assets?.video) return { arquivos: [{ url: s.assets.video as string, mime: "video/mp4" }] };
    if (s.state === "failed") throw new FalhaProvedor(`Luma: ${s.failure_reason ?? "falhou"}`, "erro");
    return undefined;
  }, { etapa: "Gerando vídeo na Luma…" });
};

// ───────── MiniMax / Hailuo (video_generation → query → files/retrieve) ─────────
const MM = "https://api.minimax.io/v1";
function checarMiniMax(d: any) {
  const c = d?.base_resp?.status_code;
  if (c === undefined || c === 0) return;
  const msg = `MiniMax: ${d.base_resp.status_msg ?? "erro"} (${c})`;
  if (c === 1002 || c === 1008) throw new FalhaProvedor(msg, "limite");
  if (c === 1004 || c === 2049) throw new FalhaProvedor(msg, "recusado");
  throw new FalhaProvedor(msg, "erro");
}
export const minimax: Adaptador = async (cap, e, ctx) => {
  if (cap !== "video") throw naoFaz("MiniMax", cap);
  const { chave, rota, sinal } = ctx;
  const h = { Authorization: `Bearer ${chave.apiKey}` };
  const img = await imagemDaEntrada(e, sinal);
  const job = await pedirJson(`${MM}/video_generation`, {
    method: "POST", headers: h, sinal, quem: "MiniMax",
    json: {
      model: rota.modelo ?? "MiniMax-Hailuo-2.3", prompt: exigirPrompt(e, "MiniMax").slice(0, 2000),
      duration: (e.duracao ?? 6) > 8 ? 10 : 6, resolution: "768P",
      ...(img ? { first_frame_image: dataUri(img) } : {}),
    },
  });
  checarMiniMax(job);
  const fileId = await aguardar(ctx, async () => {
    const s = await pedirJson(`${MM}/query/video_generation?task_id=${encodeURIComponent(job.task_id)}`, { headers: h, sinal, quem: "MiniMax" });
    checarMiniMax(s);
    if (s.status === "Success") return String(s.file_id);
    if (s.status === "Fail") throw new FalhaProvedor("MiniMax: a geração falhou", "erro");
    return undefined;
  }, { etapa: "Gerando vídeo no Hailuo…" });
  const f = await pedirJson(`${MM}/files/retrieve?file_id=${encodeURIComponent(fileId)}`, { headers: h, sinal, quem: "MiniMax" });
  checarMiniMax(f);
  if (!f.file?.download_url) throw new FalhaProvedor("MiniMax: resposta sem link do vídeo", "formato");
  return { arquivos: [{ url: f.file.download_url as string, mime: "video/mp4" }] };
};

// ───────── Kling (API oficial; JWT HS256 com access key + secret key) ─────────
const KLING = "https://api-singapore.klingai.com/v1/videos";
export function tokenKling(accessKey: string, secretKey: string, agora = Math.floor(Date.now() / 1000)) {
  return jwtHs256({ iss: accessKey, exp: agora + 1800, nbf: agora - 5 }, secretKey);
}
function checarKling(d: any) {
  if (d?.code === undefined || d.code === 0) return;
  throw new FalhaProvedor(`Kling: ${d.message ?? "erro"} (${d.code})`, d.code >= 1000 && d.code < 1100 ? "recusado" : (d.code >= 1100 && d.code < 1200) || d.code === 1302 || d.code === 1303 ? "limite" : "erro");
}
export const kling: Adaptador = async (cap, e, ctx) => {
  if (cap !== "video") throw naoFaz("Kling", cap);
  const { chave, rota, sinal } = ctx;
  if (!chave.accessKey || !chave.secretKey) throw new FalhaProvedor("Kling: faltou access key ou secret key", "sem-chave");
  const auth = () => ({ Authorization: `Bearer ${tokenKling(chave.accessKey, chave.secretKey)}` });
  const img = await imagemDaEntrada(e, sinal);
  const tipo = img ? "image2video" : "text2video";
  const corpo: Record<string, unknown> = {
    model_name: rota.modelo ?? "kling-v2-6", prompt: (img ? e.prompt ?? "" : exigirPrompt(e, "Kling")).slice(0, 2500),
    duration: (e.duracao ?? 5) > 7 ? "10" : "5", mode: "std",
  };
  if (img) corpo.image = img.buffer.toString("base64"); // base64 puro, sem o prefixo data:
  else corpo.aspect_ratio = e.proporcao ?? "16:9";
  const job = await pedirJson(`${KLING}/${tipo}`, { method: "POST", headers: auth(), json: corpo, sinal, quem: "Kling" });
  checarKling(job);
  const id = job.data?.task_id;
  return aguardar(ctx, async () => {
    const s = await pedirJson(`${KLING}/${tipo}/${id}`, { headers: auth(), sinal, quem: "Kling" });
    checarKling(s);
    const st = s.data?.task_status;
    if (st === "succeed") return { arquivos: (s.data.task_result?.videos ?? []).map((v: any) => ({ url: v.url as string, mime: "video/mp4" })) };
    if (st === "failed") throw new FalhaProvedor(`Kling: ${s.data?.task_status_msg ?? "falhou"}`, "erro");
    return undefined;
  }, { etapa: "Gerando vídeo no Kling…" });
};
