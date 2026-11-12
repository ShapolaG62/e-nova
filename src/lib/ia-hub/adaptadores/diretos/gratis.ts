import "server-only";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Adaptador, EntradaIA } from "../../tipos";
import { FalhaProvedor, checarResposta, exigirPrompt, imagemDaEntrada, naoFaz, pedir, pedirJson } from "./comum";

/* eslint-disable @typescript-eslint/no-explicit-any */

// IAs grátis (vindas do MeuStudio). Ficam na Central como reserva sem custo:
// se a IA paga falhar ou acabar o crédito, o roteador cai nelas sozinho.

const PX: Record<string, [number, number]> = { "9:16": [768, 1344], "16:9": [1344, 768], "1:1": [1024, 1024] };
const px = (e: EntradaIA) => PX[e.proporcao ?? "1:1"];

const sistema = (e: EntradaIA) =>
  e.schemaJson
    ? `${e.sistema ?? ""}\n\nResponda SOMENTE com JSON válido que siga este JSON Schema: ${JSON.stringify(e.schemaJson)}\nEscreva em português do Brasil.`
    : (e.sistema ?? "");

/** Lê JSON de IA pequena: tira cercas e texto em volta, vírgula sobrando, e fecha o que ficou aberto se a resposta veio cortada. */
export function jsonDe(s: string) {
  const limpo = s.replace(/^```(json)?|```$/gm, "").trim();
  const tentar = (x: string): { ok: true; v: unknown } | { ok: false } => { try { return { ok: true, v: JSON.parse(x) }; } catch { return { ok: false }; } };
  let r = tentar(limpo);
  if (r.ok) return r.v;
  const ini = limpo.search(/[{[]/);
  const corpo = (ini >= 0 ? limpo.slice(ini) : limpo).replace(/,\s*([}\]])/g, "$1");
  r = tentar(corpo);
  if (r.ok) return r.v;
  const fim = Math.max(corpo.lastIndexOf("}"), corpo.lastIndexOf("]"));
  if (fim > 0) { r = tentar(corpo.slice(0, fim + 1)); if (r.ok) return r.v; }
  // cortada no meio: volta até o último valor completo e fecha chaves/colchetes abertos
  for (let corte = corpo.length; corte > Math.max(1, corpo.length - 4000); corte--) {
    const ch = corpo[corte - 1];
    if (ch !== "}" && ch !== "]" && ch !== '"') continue;
    const parte = corpo.slice(0, corte);
    const pilha: string[] = [];
    let str = false, esc = false;
    for (const c of parte) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { str = !str; continue; }
      if (str) continue;
      if (c === "{") pilha.push("}");
      else if (c === "[") pilha.push("]");
      else if (c === "}" || c === "]") pilha.pop();
    }
    if (str) continue;
    r = tentar(parte.replace(/,\s*$/, "") + pilha.reverse().join(""));
    if (r.ok) return r.v;
  }
  throw new FalhaProvedor("JSON inválido", "formato");
}

/** Chat no formato da OpenAI, com a URL completa (cada serviço grátis tem a sua). */
async function chatCompat(url: string, headers: Record<string, string>, modelo: string, e: EntradaIA, sinal: AbortSignal, quem: string, extra: Record<string, unknown> = {}) {
  const d = await pedirJson(url, {
    method: "POST", sinal, quem, headers,
    json: {
      model: modelo, temperature: e.temperatura ?? 0.8,
      messages: [{ role: "system", content: sistema(e) }, { role: "user", content: e.prompt ?? "" }],
      ...(e.schemaJson ? { response_format: { type: "json_object" } } : {}),
      ...extra,
    },
  });
  const texto = String(d.choices?.[0]?.message?.content ?? "");
  if (!texto.trim()) throw new FalhaProvedor(`${quem}: resposta vazia`, "formato");
  return { texto, json: e.schemaJson ? jsonDe(texto) : undefined, tokens: { entrada: d.usage?.prompt_tokens ?? 0, saida: d.usage?.completion_tokens ?? 0 } };
}

// ───────── Pollinations: texto e imagem sem chave (token opcional tira a fila) ─────────
export const pollinations: Adaptador = async (cap, e, { chave, rota, sinal, progresso }) => {
  const auth: Record<string, string> = chave.apiKey ? { Authorization: `Bearer ${chave.apiKey}` } : {};
  // o modelo padrão "pensa" antes de responder: sem limite alto e esforço baixo, um roteiro grande estoura
  if (cap === "texto") return chatCompat("https://text.pollinations.ai/openai", auth, rota.modelo ?? "openai", e, sinal, "Pollinations", { max_tokens: 12000, reasoning_effort: "low" });
  if (cap === "imagem") {
    const [w, h] = px(e);
    await progresso?.(20, "Desenhando no Pollinations (grátis)…");
    const q = new URLSearchParams({ width: String(w), height: String(h), seed: String(Math.floor(Math.random() * 1e9)), nologo: "true", model: "flux", private: "true" });
    const r = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(exigirPrompt(e, "Pollinations").slice(0, 1800))}?${q}`, { headers: auth, signal: sinal });
    await checarResposta(r, "Pollinations");
    const mime = r.headers.get("content-type")?.split(";")[0] ?? "";
    if (!mime.startsWith("image/")) throw new FalhaProvedor("Pollinations não devolveu imagem", "formato");
    return { arquivos: [{ buffer: Buffer.from(await r.arrayBuffer()), mime, nome: "imagem.jpg" }] };
  }
  throw naoFaz("Pollinations", cap);
};

// ───────── OpenRouter: modelos ":free" com chave grátis ─────────
export const openrouter: Adaptador = async (cap, e, { chave, rota, sinal }) => {
  if (cap !== "texto") throw naoFaz("OpenRouter", cap);
  return chatCompat("https://openrouter.ai/api/v1/chat/completions", { Authorization: `Bearer ${chave.apiKey}`, "X-Title": "E-Nova" },
    rota.modelo ?? "meta-llama/llama-3.3-70b-instruct:free", e, sinal, "OpenRouter");
};

// ───────── Cloudflare Workers AI: texto e imagem (FLUX schnell) no plano grátis ─────────
export const cloudflare: Adaptador = async (cap, e, { chave, rota, sinal, progresso }) => {
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(chave.accountId ?? "")}/ai`;
  const auth = { Authorization: `Bearer ${chave.apiToken}` };
  if (cap === "texto") return chatCompat(`${base}/v1/chat/completions`, auth, rota.modelo ?? "@cf/meta/llama-3.3-70b-instruct-fp8-fast", e, sinal, "Cloudflare");
  if (cap === "imagem") {
    await progresso?.(20, "Desenhando no Cloudflare (grátis)…");
    const d = await pedirJson(`${base}/run/@cf/black-forest-labs/flux-1-schnell`, { method: "POST", sinal, quem: "Cloudflare", headers: auth, json: { prompt: exigirPrompt(e, "Cloudflare").slice(0, 2048), steps: 8 } });
    const b64 = d.result?.image;
    if (!b64) throw new FalhaProvedor("Cloudflare não devolveu imagem", "formato");
    return { arquivos: [{ buffer: Buffer.from(b64, "base64"), mime: "image/jpeg", nome: "imagem.jpg" }] };
  }
  if (cap === "transcricao") {
    const arq = e.arquivo;
    if (!arq) throw new FalhaProvedor("Cloudflare: faltou o áudio", "formato");
    await progresso?.(20, "Transcrevendo no Cloudflare (grátis)…");
    const d = await pedirJson(`${base}/run/@cf/openai/whisper-large-v3-turbo`, { method: "POST", sinal, quem: "Cloudflare Whisper", headers: auth, json: { audio: arq.buffer.toString("base64"), language: (e.idioma ?? "pt").slice(0, 2), task: "transcribe" } });
    const segs = (d.result?.segments ?? []).map((x: any) => ({ inicio: Number(x.start), fim: Number(x.end), texto: String(x.text ?? "").trim() })).filter((x: any) => x.texto);
    return { texto: d.result?.text ?? segs.map((x: any) => x.texto).join(" "), segmentos: segs };
  }
  throw naoFaz("Cloudflare", cap);
};

// ───────── Hugging Face: FLUX schnell com token grátis ─────────
export const huggingface: Adaptador = async (cap, e, { chave, rota, sinal, progresso }) => {
  if (cap !== "imagem") throw naoFaz("Hugging Face", cap);
  const [width, height] = px(e);
  await progresso?.(20, "Desenhando no Hugging Face (grátis)…");
  const r = await pedir(`https://router.huggingface.co/hf-inference/models/${rota.modelo ?? "black-forest-labs/FLUX.1-schnell"}`, {
    method: "POST", sinal, quem: "Hugging Face", headers: { Authorization: `Bearer ${chave.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: exigirPrompt(e, "Hugging Face"), parameters: { width, height } }),
  });
  const mime = r.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  if (!mime.startsWith("image/")) throw new FalhaProvedor("Hugging Face não devolveu imagem", "formato");
  return { arquivos: [{ buffer: Buffer.from(await r.arrayBuffer()), mime, nome: "imagem.jpg" }] };
};

// ───────── Vozes neurais da Microsoft (Edge), grátis e sem chave ─────────
export const VOZES_EDGE = [
  { id: "pt-BR-FranciscaNeural", nome: "Francisca (feminina)" },
  { id: "pt-BR-ThalitaMultilingualNeural", nome: "Thalita (feminina, expressiva)" },
  { id: "pt-BR-AntonioNeural", nome: "Antônio (masculina)" },
];

function partes(texto: string, max = 1800) {
  const out: string[] = [];
  let cur = "";
  for (const s of texto.split(/(?<=[.!?…\n])\s+/)) {
    if ((cur + " " + s).length > max && cur) { out.push(cur); cur = s; } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out.flatMap((c) => (c.length > max ? c.match(new RegExp(`[\\s\\S]{1,${max}}`, "g")) ?? [] : [c]));
}

export const edge: Adaptador = async (cap, e, { sinal, progresso }) => {
  if (cap !== "voz") throw naoFaz("Voz da Microsoft", cap);
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
  const voz = e.voz && /^[a-z]{2}-[A-Z]{2}-\w+Neural$/.test(e.voz) ? e.voz : "pt-BR-FranciscaNeural";
  const opc = (e.dados ?? {}) as { velocidade?: string; tom?: string };
  const dir = await mkdtemp(path.join(tmpdir(), "enova-tts-"));
  try {
    const bufs: Buffer[] = [];
    const ps = partes(exigirPrompt(e, "Voz da Microsoft"));
    for (const [i, p] of ps.entries()) {
      if (sinal.aborted) throw new FalhaProvedor("tempo esgotado", "fora");
      await progresso?.(10 + (80 * i) / ps.length, `Gravando a narração (${i + 1} de ${ps.length})…`);
      // o serviço às vezes fecha a conexão no meio (principalmente com várias vozes ao mesmo tempo): até 5 tentativas, esperando cada vez mais
      for (let tentativa = 1; ; tentativa++) {
        const tts = new MsEdgeTTS();
        try {
          await tts.setMetadata(voz, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
          const { audioFilePath } = await tts.toFile(dir, p, { rate: opc.velocidade ?? "+0%", pitch: opc.tom ?? "+0Hz" });
          bufs.push(await readFile(audioFilePath));
          await rm(audioFilePath, { force: true });
          break;
        } catch (err) {
          if (tentativa >= 5 || sinal.aborted) throw err;
          await new Promise((r) => setTimeout(r, 1500 * tentativa + Math.random() * 1000));
        } finally { tts.close(); }
      }
    }
    const tudo = Buffer.concat(bufs);
    if (tudo.length < 500) throw new FalhaProvedor("o serviço de voz da Microsoft não respondeu", "fora");
    return { arquivos: [{ buffer: tudo, mime: "audio/mpeg", nome: "narracao.mp3" }] };
  } catch (err) {
    if (err instanceof FalhaProvedor) throw err;
    throw new FalhaProvedor(`Voz da Microsoft: ${err instanceof Error ? err.message : String(err)}`, "fora");
  } finally { await rm(dir, { recursive: true, force: true }); }
};

// ───────── Minha voz no computador (Chatterbox Multilingual, MIT) ─────────
export const vozLocal: Adaptador = async (cap, e, { sinal, progresso }) => {
  if (cap !== "voz") throw naoFaz("Voz no computador", cap);
  const { vozDoId, falarLocal } = await import("@/lib/voz");
  const v = await vozDoId(e.voz);
  if (!v) throw new FalhaProvedor("A voz no computador só fala com uma voz da tela Minha voz", "nao-suporta");
  await progresso?.(15, "Carregando a sua voz no computador (a 1ª vez demora)…");
  try {
    const mp3 = await falarLocal(v.amostraChave, exigirPrompt(e, "Voz no computador"), sinal);
    return { arquivos: [{ buffer: mp3, mime: "audio/mpeg", nome: "narracao.mp3" }] };
  } catch (err) {
    throw new FalhaProvedor(`Voz no computador: ${err instanceof Error ? err.message : String(err)}`, "fora");
  }
};

// ───────── Imagem no próprio servidor: tirar fundo (RMBG-1.4) e ampliar ─────────
const g = globalThis as unknown as { __rmbg?: Promise<{ model: any; processor: any; T: any }> };
async function rmbg() {
  g.__rmbg ??= (async () => {
    const T: any = await import("@huggingface/transformers");
    T.env.cacheDir = path.join(process.cwd(), ".data", "models");
    const model = await T.AutoModel.from_pretrained("briaai/RMBG-1.4", { config: { model_type: "custom" }, dtype: "fp32" });
    const processor = await T.AutoProcessor.from_pretrained("briaai/RMBG-1.4", {
      config: {
        do_normalize: true, do_pad: false, do_rescale: true, do_resize: true, image_mean: [0.5, 0.5, 0.5],
        feature_extractor_type: "ImageFeatureExtractor", image_std: [1, 1, 1], resample: 2,
        rescale_factor: 0.00392156862745098, size: { width: 1024, height: 1024 },
      },
    });
    return { model, processor, T };
  })().catch((err) => { g.__rmbg = undefined; throw err; });
  return g.__rmbg;
}

export const imagemLocal: Adaptador = async (cap, e, { sinal, progresso }) => {
  if (cap !== "editar-imagem") throw naoFaz("Imagem local", cap);
  const arq = await imagemDaEntrada(e, sinal);
  if (!arq) throw new FalhaProvedor("envie a imagem", "formato");
  const sharp = (await import("sharp")).default;
  const op = e.operacao ?? "remover-fundo";
  if (op === "ampliar") {
    await progresso?.(30, "Ampliando no servidor…");
    const fator = Number((e.dados as { fator?: number } | undefined)?.fator) === 2 ? 2 : 4;
    const meta = await sharp(arq.buffer).rotate().metadata();
    const lado = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (lado * fator > 8000) throw new FalhaProvedor("imagem grande demais para ampliar aqui", "nao-suporta");
    const out = await sharp(arq.buffer).rotate().resize((meta.width ?? 0) * fator, (meta.height ?? 0) * fator, { kernel: "lanczos3" }).sharpen({ sigma: 1 }).png().toBuffer();
    return { arquivos: [{ buffer: out, mime: "image/png", nome: "ampliada.png" }], meta: { aviso: "Ampliação clássica (sem IA)." } };
  }
  if (op !== "remover-fundo") throw new FalhaProvedor("aqui só tira o fundo e amplia", "nao-suporta");
  await progresso?.(10, "Preparando o removedor de fundo (na 1ª vez baixa o modelo)…");
  const src = await sharp(arq.buffer).rotate().resize(4096, 4096, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const { model, processor, T } = await rmbg();
  await progresso?.(60, "Removendo o fundo…");
  const image = await T.RawImage.fromBlob(new Blob([new Uint8Array(src)], { type: "image/png" }));
  const { pixel_values } = await processor(image);
  const { output } = await model({ input: pixel_values });
  const mask = await T.RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(image.width, image.height);
  const alpha = await sharp(Buffer.from(mask.data), { raw: { width: mask.width, height: mask.height, channels: mask.channels } }).extractChannel(0).raw().toBuffer();
  const rgb = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = await sharp(rgb.data, { raw: { width: rgb.info.width, height: rgb.info.height, channels: 3 } })
    .joinChannel(alpha, { raw: { width: mask.width, height: mask.height, channels: 1 } }).png().toBuffer();
  return { arquivos: [{ buffer: out, mime: "image/png", nome: "sem-fundo.png" }] };
};
