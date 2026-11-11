import "server-only";
import type { Adaptador } from "../../tipos";
import {
  FalhaProvedor, aguardar, blobDe, checarResposta, exigirPrompt, imagemDaEntrada, naoFaz, pedir, pedirJson, tamanho,
} from "./comum";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ───────── OpenAI: imagens (gpt-image), edição, voz (TTS) ─────────
// Docs: /v1/images/generations, /v1/images/edits, /v1/audio/speech. DALL·E e gpt-image-1 foram desligados;
// a API de vídeo do Sora (/v1/videos) foi encerrada em 24/09/2026.
const OAI = "https://api.openai.com/v1";
const TAM_OAI = { "16:9": "1536x1024", "9:16": "1024x1536", "1:1": "1024x1024" } as const;

export const openai: Adaptador = async (cap, e, ctx) => {
  const { chave, rota, sinal } = ctx;
  const auth = { Authorization: `Bearer ${chave.apiKey}` };
  if (cap === "imagem") {
    const modelo = rota.modelo ?? "gpt-image-2";
    const dalle = modelo.startsWith("dall-e");
    await ctx.progresso?.(20, "Gerando imagem na OpenAI…");
    const d = await pedirJson(`${OAI}/images/generations`, {
      method: "POST", headers: auth, sinal, quem: "OpenAI",
      json: { model: modelo, prompt: exigirPrompt(e, "OpenAI"), n: 1, size: TAM_OAI[e.proporcao ?? "1:1"], ...(dalle ? { response_format: "b64_json" } : { output_format: "png" }) },
    });
    return imagensOpenAI(d);
  }
  if (cap === "editar-imagem") {
    const img = await imagemDaEntrada(e, sinal);
    if (!img) throw new FalhaProvedor("OpenAI: faltou a imagem para editar", "formato");
    const op = e.operacao ?? "remover-fundo";
    if (op === "ampliar") throw new FalhaProvedor("OpenAI não amplia imagens (upscale)", "nao-suporta");
    const fd = new FormData();
    fd.append("model", rota.modelo?.startsWith("gpt-image") ? rota.modelo : "gpt-image-2");
    fd.append("image[]", blobDe(img), img.nome || "imagem.png");
    fd.append("prompt", op === "remover-fundo"
      ? "Remova completamente o fundo, deixando só o objeto principal intacto, com fundo transparente."
      : e.prompt?.trim() || "Apague objetos indesejados, textos e marcas d'água, preenchendo o fundo de forma natural. Mantenha o resto idêntico.");
    if (op === "remover-fundo") fd.append("background", "transparent");
    fd.append("output_format", "png");
    await ctx.progresso?.(20, "Editando imagem na OpenAI…");
    const r = await pedir(`${OAI}/images/edits`, { method: "POST", headers: auth, body: fd, sinal, quem: "OpenAI" });
    return imagensOpenAI(await r.json());
  }
  if (cap === "voz") {
    const texto = exigirPrompt(e, "OpenAI TTS");
    const r = await pedir(`${OAI}/audio/speech`, {
      method: "POST", sinal, quem: "OpenAI TTS", headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: rota.modelo ?? "gpt-4o-mini-tts", voice: e.voz || "marin", input: texto.slice(0, 4096), response_format: "mp3",
        instructions: `Fale em ${e.idioma && !e.idioma.startsWith("pt") ? e.idioma : "português do Brasil"}, com naturalidade.`,
      }),
    });
    return { arquivos: [{ buffer: Buffer.from(await r.arrayBuffer()), mime: "audio/mpeg", nome: "narracao.mp3" }] };
  }
  if (cap === "video") throw new FalhaProvedor("OpenAI encerrou a API de vídeo do Sora (/v1/videos) em 24/09/2026", "nao-suporta");
  throw naoFaz("OpenAI", cap);
};

function imagensOpenAI(d: any) {
  const arquivos = (d.data ?? []).map((x: any) => x.b64_json
    ? { buffer: Buffer.from(x.b64_json, "base64"), mime: "image/png", nome: "imagem.png" }
    : { url: x.url as string, mime: "image/png" });
  if (!arquivos.length) throw new FalhaProvedor("OpenAI: resposta sem imagem", "formato");
  return { arquivos };
}

// ───────── Black Forest Labs (FLUX direto) ─────────
// POST https://api.bfl.ai/v1/{modelo} (x-key) → {id, polling_url}; GET polling_url → status Ready → result.sample (link vale 10 min).
export const bfl: Adaptador = async (cap, e, ctx) => {
  if (cap !== "imagem") throw naoFaz("FLUX (BFL)", cap);
  const { chave, rota, sinal } = ctx;
  const modelo = rota.modelo ?? "flux-pro-1.1";
  const h = { "x-key": chave.apiKey, accept: "application/json" };
  const corpo: Record<string, unknown> = { prompt: exigirPrompt(e, "FLUX"), output_format: "png" };
  if (modelo.includes("kontext")) {
    corpo.aspect_ratio = e.proporcao ?? "1:1";
    const img = await imagemDaEntrada(e, sinal);
    if (img) corpo.input_image = img.buffer.toString("base64");
  } else Object.assign(corpo, tamanho(e.proporcao, 1024, 32));
  const job = await pedirJson(`https://api.bfl.ai/v1/${modelo}`, { method: "POST", headers: h, json: corpo, sinal, quem: "FLUX (BFL)" });
  if (!job.polling_url) throw new FalhaProvedor("FLUX (BFL): resposta sem polling_url", "formato");
  return aguardar(ctx, async () => {
    const s = await pedirJson(job.polling_url, { headers: h, sinal, quem: "FLUX (BFL)" });
    if (s.status === "Ready") return { arquivos: [{ url: s.result.sample as string, mime: "image/png" }] };
    if (["Error", "Failed", "Task not found", "Request Moderated", "Content Moderated", "No Card Generated"].includes(s.status))
      throw new FalhaProvedor(`FLUX (BFL): ${s.status === "Request Moderated" || s.status === "Content Moderated" ? "pedido barrado pela moderação" : s.status}`, "erro");
    return undefined;
  }, { etapa: "Gerando no FLUX (BFL)…" });
};

// ───────── Stability AI (SD 3.5 + edições que substituem o Clipdrop) ─────────
// v2beta multipart; Accept: image/* devolve os bytes. Upscale criativo é assíncrono (não usado: o rápido custa 2 créditos).
const STA = "https://api.stability.ai/v2beta/stable-image";
export const stability: Adaptador = async (cap, e, ctx) => {
  const { chave, rota, sinal } = ctx;
  const h = { authorization: `Bearer ${chave.apiKey}`, accept: "image/*" };
  const enviar = async (caminho: string, fd: FormData, tolerar400 = false) => {
    const r = await fetch(`${STA}/${caminho}`, { method: "POST", headers: h, body: fd, signal: sinal });
    if (tolerar400 && r.status === 400) return null;
    await checarResposta(r, "Stability");
    if (r.headers.get("finish-reason") === "CONTENT_FILTERED") throw new FalhaProvedor("Stability: imagem barrada pelo filtro de conteúdo", "erro");
    const mime = r.headers.get("content-type")?.split(";")[0] || "image/png";
    return { arquivos: [{ buffer: Buffer.from(await r.arrayBuffer()), mime, nome: `imagem.${mime.split("/")[1] ?? "png"}` }] };
  };
  if (cap === "imagem") {
    const fd = new FormData();
    fd.append("prompt", exigirPrompt(e, "Stability"));
    fd.append("model", rota.modelo && rota.modelo.startsWith("sd3") ? rota.modelo : "sd3.5-large");
    fd.append("aspect_ratio", e.proporcao ?? "1:1");
    fd.append("output_format", "png");
    await ctx.progresso?.(20, "Gerando no Stable Diffusion…");
    return (await enviar("generate/sd3", fd))!;
  }
  if (cap === "editar-imagem") {
    const img = await imagemDaEntrada(e, sinal);
    if (!img) throw new FalhaProvedor("Stability: faltou a imagem para editar", "formato");
    const base = () => { const fd = new FormData(); fd.append("image", blobDe(img), img.nome || "imagem.png"); fd.append("output_format", "png"); return fd; };
    const op = e.operacao ?? "remover-fundo";
    await ctx.progresso?.(20, "Editando na Stability…");
    if (op === "remover-fundo") return (await enviar("edit/remove-background", base()))!;
    if (op === "limpar") return (await enviar("edit/erase", base()))!; // sem máscara: apaga as áreas transparentes da imagem
    // ampliar: rápido (4x, até 1 MP); se a imagem for grande demais, usa o conservador (até 4 MP)
    const rapido = await enviar("upscale/fast", base(), true);
    if (rapido) return rapido;
    const fd = base();
    fd.append("prompt", e.prompt?.trim() || "foto nítida, alta resolução, detalhes preservados");
    return (await enviar("upscale/conservative", fd))!;
  }
  throw naoFaz("Stability", cap);
};

// ───────── Adobe Firefly (Firefly Services: OAuth + v3 assíncrono) ─────────
const tokensAdobe = ((globalThis as any).__iaAdobe ??= new Map<string, { token: string; ate: number }>()) as Map<string, { token: string; ate: number }>;
async function tokenAdobe(id: string, segredo: string, sinal: AbortSignal) {
  const c = tokensAdobe.get(id);
  if (c && c.ate > Date.now() + 60_000) return c.token;
  const d = await pedirJson("https://ims-na1.adobelogin.com/ims/token/v3", {
    method: "POST", sinal, quem: "Adobe Firefly", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: segredo, scope: "openid,AdobeID,read_organizations,firefly_enterprise,firefly_api,ff_apis" }).toString(),
  });
  if (!d.access_token) throw new FalhaProvedor("Adobe Firefly: não recebi o token de acesso", "recusado");
  tokensAdobe.set(id, { token: d.access_token, ate: Date.now() + (Number(d.expires_in) || 3600) * 1000 });
  return d.access_token as string;
}
const TAM_ADOBE = { "16:9": { width: 2688, height: 1536 }, "9:16": { width: 1792, height: 2304 }, "1:1": { width: 2048, height: 2048 } } as const;

export const adobe: Adaptador = async (cap, e, ctx) => {
  if (cap !== "imagem") throw naoFaz("Adobe Firefly", cap);
  const { chave, rota, sinal } = ctx;
  if (!chave.clientId || !chave.clientSecret) throw new FalhaProvedor("Adobe Firefly: faltou Client ID ou Client secret", "sem-chave");
  const h: Record<string, string> = { "x-api-key": chave.clientId, Authorization: `Bearer ${await tokenAdobe(chave.clientId, chave.clientSecret, sinal)}` };
  if (rota.modelo?.startsWith("image")) h["x-model-version"] = rota.modelo;
  const job = await pedirJson("https://firefly-api.adobe.io/v3/images/generate-async", {
    method: "POST", headers: h, sinal, quem: "Adobe Firefly",
    json: { prompt: exigirPrompt(e, "Adobe Firefly").slice(0, 1024), numVariations: 1, size: TAM_ADOBE[e.proporcao ?? "1:1"], promptBiasingLocaleCode: "pt-BR" },
  });
  const statusUrl = job.statusUrl ?? `https://firefly-api.adobe.io/v3/status/${job.jobId}`;
  return aguardar(ctx, async () => {
    const s = await pedirJson(statusUrl, { headers: h, sinal, quem: "Adobe Firefly" });
    if (s.status === "succeeded") {
      const urls = (s.result?.outputs ?? []).map((o: any) => o.image?.url).filter(Boolean);
      if (!urls.length) throw new FalhaProvedor("Adobe Firefly: resposta sem imagem", "formato");
      return { arquivos: urls.map((url: string) => ({ url, mime: "image/jpeg" })) };
    }
    if (s.status === "failed" || s.status === "canceled" || s.status === "cancelled") throw new FalhaProvedor(`Adobe Firefly: ${s.error_code ?? s.message ?? "falhou"}`, "erro");
    return undefined;
  }, { etapa: "Gerando no Adobe Firefly…" });
};

// ───────── Recraft ─────────
export const recraft: Adaptador = async (cap, e, { chave, rota, sinal, progresso }) => {
  if (cap !== "imagem") throw naoFaz("Recraft", cap);
  await progresso?.(20, "Gerando no Recraft…");
  const d = await pedirJson("https://external.api.recraft.ai/v1/images/generations", {
    method: "POST", sinal, quem: "Recraft", headers: { Authorization: `Bearer ${chave.apiKey}` },
    json: { prompt: exigirPrompt(e, "Recraft"), model: rota.modelo ?? "recraftv4_1", size: e.proporcao ?? "1:1", n: 1, image_format: "png" },
  });
  const urls = (d.data ?? []).map((x: any) => x.url).filter(Boolean);
  if (!urls.length) throw new FalhaProvedor("Recraft: resposta sem imagem", "formato");
  return { arquivos: urls.map((url: string) => ({ url, mime: "image/png" })) };
};

// ───────── Ideogram (API v2: /v2/image/generate/{modelo}, multipart) ─────────
export const ideogram: Adaptador = async (cap, e, { chave, rota, sinal, progresso }) => {
  if (cap !== "imagem") throw naoFaz("Ideogram", cap);
  const modelo = rota.modelo && !rota.modelo.startsWith("V_") ? rota.modelo : "ideogram-3";
  const fd = new FormData();
  fd.append("prompt", exigirPrompt(e, "Ideogram"));
  fd.append("num_images", "1");
  if (modelo === "ideogram-3") fd.append("aspect_ratio", (e.proporcao ?? "1:1").replace(":", "x"));
  await progresso?.(20, "Gerando no Ideogram…");
  const d = await pedirJson(`https://api.ideogram.ai/v2/image/generate/${modelo}`, { method: "POST", headers: { "Api-Key": chave.apiKey }, body: fd, sinal, quem: "Ideogram" });
  const imgs = (d.data ?? []) as any[];
  const urls = imgs.filter((x) => x.url).map((x) => x.url as string);
  if (!urls.length) throw new FalhaProvedor(imgs.length ? "Ideogram: imagem barrada pela moderação" : "Ideogram: resposta sem imagem", imgs.length ? "erro" : "formato");
  return { arquivos: urls.map((url) => ({ url, mime: "image/png" })) };
};

// ───────── Leonardo.ai (v1 generations + consulta) ─────────
const LEO = "https://cloud.leonardo.ai/api/rest/v1";
export const leonardo: Adaptador = async (cap, e, ctx) => {
  if (cap !== "imagem") throw naoFaz("Leonardo", cap);
  const { chave, rota, sinal } = ctx;
  const h = { authorization: `Bearer ${chave.apiKey}`, accept: "application/json" };
  const job = await pedirJson(`${LEO}/generations`, {
    method: "POST", headers: h, sinal, quem: "Leonardo",
    // modelo padrão: Lucid Origin (receita oficial)
    json: { prompt: exigirPrompt(e, "Leonardo"), modelId: rota.modelo ?? "7b592283-e8a7-4c5a-9ba6-d18c31f258b9", num_images: 1, ...tamanho(e.proporcao, 1024, 8) },
  });
  const id = job.sdGenerationJob?.generationId ?? job.generationId;
  if (!id) throw new FalhaProvedor("Leonardo: resposta sem id da geração", "formato");
  return aguardar(ctx, async () => {
    const s = (await pedirJson(`${LEO}/generations/${id}`, { headers: h, sinal, quem: "Leonardo" })).generations_by_pk;
    if (s?.status === "COMPLETE") return { arquivos: (s.generated_images ?? []).map((g: any) => ({ url: g.url as string, mime: "image/jpeg" })) };
    if (s?.status === "FAILED") throw new FalhaProvedor("Leonardo: a geração falhou", "erro");
    return undefined;
  }, { etapa: "Gerando no Leonardo…" });
};

// ───────── Photoroom (remover fundo: /v1/segment devolve PNG) ─────────
export const photoroom: Adaptador = async (cap, e, { chave, sinal, progresso }) => {
  if (cap !== "editar-imagem") throw naoFaz("Photoroom", cap);
  if ((e.operacao ?? "remover-fundo") !== "remover-fundo") throw new FalhaProvedor("Photoroom aqui só remove fundo", "nao-suporta");
  const img = await imagemDaEntrada(e, sinal);
  if (!img) throw new FalhaProvedor("Photoroom: faltou a imagem", "formato");
  const fd = new FormData();
  fd.append("image_file", blobDe(img), img.nome || "imagem.png");
  await progresso?.(30, "Removendo o fundo no Photoroom…");
  const r = await pedir("https://sdk.photoroom.com/v1/segment", { method: "POST", headers: { "x-api-key": chave.apiKey }, body: fd, sinal, quem: "Photoroom" });
  return { arquivos: [{ buffer: Buffer.from(await r.arrayBuffer()), mime: r.headers.get("content-type")?.split(";")[0] || "image/png", nome: "sem-fundo.png" }] };
};

// ───────── GoAPI (Midjourney) ─────────
// A GoAPI descontinuou a API do Midjourney a pedido do próprio Midjourney (doc "Sunsetting Midjourney").
export const goapi: Adaptador = async () => {
  throw new FalhaProvedor("A GoAPI descontinuou o Midjourney a pedido do Midjourney; não há API oficial. Use outra IA de imagem.", "nao-suporta");
};

