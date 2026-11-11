import "server-only";
import type { Adaptador, EntradaIA, SaidaIA } from "../../tipos";
import { arquivoDaEntrada, mimeDaUrl } from "../index";
import { FalhaProvedor, aguardar, blobDe, exigirPrompt, linkPublico, naoFaz, pedir, pedirJson } from "./comum";

/* eslint-disable @typescript-eslint/no-explicit-any */

const audioMp3 = async (r: Response, nome: string): Promise<SaidaIA> => ({
  arquivos: [{ buffer: Buffer.from(await r.arrayBuffer()), mime: r.headers.get("content-type")?.split(";")[0]?.startsWith("audio/") ? r.headers.get("content-type")!.split(";")[0] : "audio/mpeg", nome }],
});

/** Link público já existente (evita reenviar o arquivo), ou null se for preciso enviar os bytes. */
function linkSeHouver(e: EntradaIA) {
  if (e.arquivo) return null;
  const u = e.audioUrl ?? e.videoUrl;
  if (!u) return null;
  try { return linkPublico(u, "-"); } catch { return null; }
}

// ───────── AssemblyAI (upload → transcript com oradores) ─────────
const AAI = "https://api.assemblyai.com/v2";
export const assemblyai: Adaptador = async (cap, e, ctx) => {
  if (cap !== "transcricao") throw naoFaz("AssemblyAI", cap);
  const { chave, sinal } = ctx;
  const h = { authorization: chave.apiKey };
  let audioUrl = linkSeHouver(e);
  if (!audioUrl) {
    await ctx.progresso?.(5, "Enviando o áudio para a AssemblyAI…");
    const arq = await arquivoDaEntrada(e, sinal);
    audioUrl = (await pedirJson(`${AAI}/upload`, { method: "POST", headers: { ...h, "Content-Type": "application/octet-stream" }, body: new Uint8Array(arq.buffer), sinal, quem: "AssemblyAI" })).upload_url;
  }
  const t = await pedirJson(`${AAI}/transcript`, {
    method: "POST", headers: h, sinal, quem: "AssemblyAI",
    json: { audio_url: audioUrl, speaker_labels: true, language_code: (e.idioma ?? "pt").slice(0, 2).toLowerCase() },
  });
  const d = await aguardar(ctx, async () => {
    const s = await pedirJson(`${AAI}/transcript/${t.id}`, { headers: h, sinal, quem: "AssemblyAI" });
    if (s.status === "completed") return s;
    if (s.status === "error") throw new FalhaProvedor(`AssemblyAI: ${s.error ?? "falhou"}`, "erro");
    return undefined;
  }, { etapa: "Transcrevendo na AssemblyAI…" });
  const falas = (d.utterances ?? []) as any[];
  const segmentos = falas.length
    ? falas.map((u) => ({ inicio: u.start / 1000, fim: u.end / 1000, texto: u.text }))
    : ((d.words ?? []) as any[]).map((w) => ({ inicio: w.start / 1000, fim: w.end / 1000, texto: w.text }));
  const texto = falas.length > 1 && new Set(falas.map((u) => u.speaker)).size > 1
    ? falas.map((u) => `Orador ${u.speaker}: ${u.text}`).join("\n")
    : (d.text ?? "");
  return { texto, segmentos, meta: { oradores: falas.map((u) => u.speaker) } };
};

// ───────── Deepgram (listen pré-gravado, bytes no corpo) ─────────
export const deepgram: Adaptador = async (cap, e, ctx) => {
  if (cap !== "transcricao") throw naoFaz("Deepgram", cap);
  const { chave, rota, sinal } = ctx;
  const q = new URLSearchParams({ model: rota.modelo ?? "nova-3", language: e.idioma ?? "pt-BR", smart_format: "true", punctuate: "true", diarize: "true", utterances: "true" });
  const link = linkSeHouver(e);
  let body: BodyInit, tipo: string;
  if (link) { body = JSON.stringify({ url: link }); tipo = "application/json"; }
  else { const arq = await arquivoDaEntrada(e, sinal); body = new Uint8Array(arq.buffer); tipo = arq.mime || "audio/mpeg"; }
  await ctx.progresso?.(20, "Transcrevendo no Deepgram…");
  const d = await pedirJson(`https://api.deepgram.com/v1/listen?${q}`, { method: "POST", headers: { Authorization: `Token ${chave.apiKey}`, "Content-Type": tipo }, body, sinal, quem: "Deepgram" });
  const alt = d.results?.channels?.[0]?.alternatives?.[0];
  if (!alt) throw new FalhaProvedor("Deepgram: resposta sem transcrição", "formato");
  const falas = (d.results?.utterances ?? []) as any[];
  const segmentos = falas.map((u) => ({ inicio: u.start, fim: u.end, texto: u.transcript }));
  const varios = new Set(falas.map((u) => u.speaker)).size > 1;
  return { texto: varios ? falas.map((u) => `Orador ${u.speaker}: ${u.transcript}`).join("\n") : alt.transcript ?? "", segmentos, meta: { oradores: falas.map((u) => u.speaker) } };
};

// ───────── ElevenLabs (voz, música, isolar voz) ─────────
const EL = "https://api.elevenlabs.io/v1";
export const elevenlabs: Adaptador = async (cap, e, ctx) => {
  const { chave, rota, sinal } = ctx;
  const h = { "xi-api-key": chave.apiKey };
  if (cap === "voz") {
    const modelo = rota.modelo ?? "eleven_multilingual_v2";
    const voz = e.voz || chave.vozPadrao || "JBFqnCBsd6RMkjVDRZzb"; // voz pré-pronta multilíngue (exemplo da documentação)
    // language_code só é aceito pelos modelos v3/v4; o multilingual_v2 detecta o idioma pelo texto
    const lang = /eleven_v[34]/.test(modelo) ? { language_code: (e.idioma ?? "pt").slice(0, 2) } : {};
    await ctx.progresso?.(20, "Gerando a narração na ElevenLabs…");
    const r = await pedir(`${EL}/text-to-speech/${encodeURIComponent(voz)}?output_format=mp3_44100_128`, {
      method: "POST", sinal, quem: "ElevenLabs", headers: { ...h, "Content-Type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text: exigirPrompt(e, "ElevenLabs").slice(0, 10_000), model_id: modelo, ...lang }),
    });
    return audioMp3(r, "narracao.mp3");
  }
  if (cap === "musica") {
    await ctx.progresso?.(20, "Compondo a música na ElevenLabs…");
    const r = await pedir(`${EL}/music`, {
      method: "POST", sinal, quem: "ElevenLabs Music", headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: exigirPrompt(e, "ElevenLabs Music").slice(0, 2000), music_length_ms: Math.max(3000, Math.min(600_000, Math.round((e.duracao ?? 30) * 1000))), model_id: "music_v1" }),
    });
    return audioMp3(r, "musica.mp3");
  }
  if (cap === "limpar-audio") {
    const arq = await arquivoDaEntrada(e, sinal);
    const fd = new FormData();
    fd.append("audio", blobDe(arq), arq.nome || "audio.mp3");
    await ctx.progresso?.(20, "Isolando a voz na ElevenLabs…");
    const r = await pedir(`${EL}/audio-isolation`, { method: "POST", headers: h, body: fd, sinal, quem: "ElevenLabs" });
    return audioMp3(r, "voz-isolada.mp3");
  }
  throw naoFaz("ElevenLabs", cap);
};

// ───────── Cartesia (tts/bytes) ─────────
const CA = "https://api.cartesia.ai";
export const cartesia: Adaptador = async (cap, e, ctx) => {
  if (cap !== "voz") throw naoFaz("Cartesia", cap);
  const { chave, rota, sinal } = ctx;
  const h = { Authorization: `Bearer ${chave.apiKey}`, "Cartesia-Version": "2026-08-14" };
  let voz = e.voz || chave.vozPadrao;
  // "minha:<id>" = voz clonada no E-Nova (tela Minha voz)
  if (voz?.startsWith("minha:")) {
    const { vozDoId } = await import("@/lib/voz");
    const v = await vozDoId(voz);
    if (!v?.cartesiaId) throw new FalhaProvedor("Esta voz ainda não foi clonada na Cartesia", "nao-suporta");
    voz = v.cartesiaId;
  } else if (voz && !/^[0-9a-f-]{36}$/i.test(voz)) voz = chave.vozPadrao; // id de outra plataforma (ex.: Microsoft)
  if (!voz) {
    const d = await pedirJson(`${CA}/voices?language=pt-BR&limit=10`, { headers: h, sinal, quem: "Cartesia" }).catch(() => ({}));
    voz = (d as any).data?.[0]?.id ?? "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4";
  }
  await ctx.progresso?.(20, "Gerando a narração na Cartesia…");
  const r = await pedir(`${CA}/tts/bytes`, {
    method: "POST", sinal, quem: "Cartesia", headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({
      model_id: rota.modelo ?? "sonic-3.6", transcript: exigirPrompt(e, "Cartesia"), voice: { id: voz },
      language: (e.idioma ?? "pt").slice(0, 2), output_format: { container: "mp3", sample_rate: 44100, bit_rate: 128000 },
    }),
  });
  return audioMp3(r, "narracao.mp3");
};

// ───────── PlayHT ─────────
// A PlayHT foi comprada pela Meta em 2025; a API saiu do ar e a plataforma fechou em 31/12/2025.
export const playht: Adaptador = async () => {
  throw new FalhaProvedor("A PlayHT encerrou a API (empresa comprada pela Meta em 2025). Use ElevenLabs, Cartesia ou OpenAI TTS.", "nao-suporta");
};

// ───────── Servidor próprio (Modal / RunPod) ─────────
// POST chave.url com {capacidade, entrada} (arquivo em base64) → {texto?, arquivos?: [{url|base64, mime, nome?}], segmentos?}
export const custom: Adaptador = async (cap, e, ctx) => {
  const { chave, sinal } = ctx;
  if (!chave.url) throw new FalhaProvedor("Servidor próprio: faltou o endereço do endpoint", "sem-chave");
  const { arquivo, ...resto } = e;
  await ctx.progresso?.(10, "Enviando para o seu servidor…");
  const d = await pedirJson(chave.url, {
    method: "POST", sinal, quem: "Servidor próprio",
    headers: chave.apiKey ? { Authorization: `Bearer ${chave.apiKey}` } : {},
    json: { capacidade: cap, entrada: { ...resto, ...(arquivo ? { arquivo: { base64: arquivo.buffer.toString("base64"), mime: arquivo.mime, nome: arquivo.nome } } : {}) } },
  });
  if (d.erro || d.error) throw new FalhaProvedor(`Servidor próprio: ${d.erro ?? d.error}`, d.motivo === "nao-suporta" ? "nao-suporta" : "erro");
  const arquivos = ((d.arquivos ?? []) as any[]).map((a) => a.base64
    ? { buffer: Buffer.from(a.base64, "base64"), mime: a.mime ?? "application/octet-stream", nome: a.nome }
    : { url: String(a.url), mime: a.mime ?? mimeDaUrl(String(a.url)), nome: a.nome }).filter((a) => a.buffer || a.url);
  if (!d.texto && !arquivos.length) throw new FalhaProvedor("Servidor próprio: resposta sem texto nem arquivos", "formato");
  return { texto: d.texto, arquivos: arquivos.length ? arquivos : undefined, segmentos: Array.isArray(d.segmentos) ? d.segmentos : undefined, json: d.json };
};
