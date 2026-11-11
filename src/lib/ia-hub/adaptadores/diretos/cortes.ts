import "server-only";
import type { Adaptador, EntradaIA, SaidaIA } from "../../tipos";
import { arquivoDaEntrada } from "../index";
import { FalhaProvedor, aguardar, blobDe, linkPublico, naoFaz, pedirJson } from "./comum";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Convenção para cortes: entrada.videoUrl = vídeo longo (link público); entrada.dados.maxClipes = quantos clipes (padrão 5).
const idioma2 = (e: EntradaIA) => (e.idioma ?? "pt-BR").slice(0, 2).toLowerCase();
const maxClipes = (e: EntradaIA) => Math.max(1, Math.min(20, Number(e.dados?.maxClipes) || 5));
const clipes = (lista: { url?: string; titulo?: string; nota?: number }[]): SaidaIA => {
  const ok = lista.filter((c) => c.url);
  if (!ok.length) throw new FalhaProvedor("nenhum clipe foi gerado", "formato");
  return {
    arquivos: ok.map((c, i) => ({ url: c.url!, mime: "video/mp4", nome: `${String(i + 1).padStart(2, "0")}-${(c.titulo ?? "clipe").replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 50)}.mp4` })),
    texto: ok.map((c, i) => `${i + 1}. ${c.titulo ?? "Clipe"}${c.nota !== undefined ? ` (nota ${c.nota})` : ""}`).join("\n"),
  };
};

// ───────── OpusClip (API liberada sob pedido; clip-projects → exportable-clips) ─────────
const OPUS = "https://api.opus.pro/api";
export const opusclip: Adaptador = async (cap, e, ctx) => {
  if (cap !== "cortes") throw naoFaz("OpusClip", cap);
  const { chave, sinal } = ctx;
  const h = { Authorization: `Bearer ${chave.apiKey}` };
  const quem = "OpusClip";
  const p = await pedirJson(`${OPUS}/clip-projects`, {
    method: "POST", headers: h, sinal, quem,
    json: { videoUrl: linkPublico(e.videoUrl, quem, "o vídeo"), importPreference: { sourceLang: idioma2(e) }, ...(e.prompt ? { curationPref: { customPrompt: e.prompt.slice(0, 500) } } : {}) },
  }).catch((err) => {
    if (err instanceof FalhaProvedor && err.motivo === "recusado") throw new FalhaProvedor("OpusClip: a API precisa ser liberada pela OpusClip (planos Pro/Max/Business, pedido ao suporte)", "recusado");
    throw err;
  });
  const id = p.projectId ?? p.id;
  await aguardar(ctx, async () => {
    const s = await pedirJson(`${OPUS}/clip-projects/${id}`, { headers: h, sinal, quem });
    if (s.stage === "COMPLETE") return true;
    if (s.stage === "STALLED" || s.error) throw new FalhaProvedor(`OpusClip: ${typeof s.error === "string" ? s.error : "o projeto travou"}`, "erro");
    return undefined;
  }, { etapa: "Achando os melhores trechos na OpusClip…", minimoMs: 10_000 });
  const todos: any[] = [];
  for (let pag = 1; pag <= 5 && todos.length < maxClipes(e); pag++) {
    const lote = await pedirJson<any[]>(`${OPUS}/exportable-clips?q=findByProjectId&projectId=${encodeURIComponent(id)}&pageNum=${pag}&pageSize=20`, { headers: h, sinal, quem });
    if (!Array.isArray(lote) || !lote.length) break;
    todos.push(...lote);
  }
  return clipes(todos.slice(0, maxClipes(e)).map((c) => ({ url: c.uriForExport, titulo: c.title })));
};

// ───────── Vizard (open-api v1: project/create → project/query) ─────────
const VZ = "https://elb-api.vizard.ai/hvizard-server-front/open-api/v1";
function checarVizard(d: any) {
  const c = Number(d?.code);
  if (!c || c === 1000 || c === 2000) return;
  const msg = `Vizard: erro ${c}${d.errMsg || d.message ? ` (${d.errMsg ?? d.message})` : ""}`;
  throw new FalhaProvedor(msg, c === 4001 ? "recusado" : c === 4003 || c === 4007 ? "limite" : "erro");
}
function tipoVizard(url: string): { videoType: number; ext?: string } {
  const host = new URL(url).hostname;
  if (/youtube\.com|youtu\.be/.test(host)) return { videoType: 2 };
  if (/drive\.google\.com/.test(host)) return { videoType: 3 };
  if (/vimeo\.com/.test(host)) return { videoType: 4 };
  if (/dropbox/.test(host)) return { videoType: 13 };
  const ext = /\.(mp4|3gp|avi|mov)(?:\?|$)/i.exec(url)?.[1]?.toLowerCase() ?? "mp4";
  return { videoType: 1, ext };
}
export const vizard: Adaptador = async (cap, e, ctx) => {
  if (cap !== "cortes") throw naoFaz("Vizard", cap);
  const { chave, sinal } = ctx;
  const h = { VIZARDAI_API_KEY: chave.apiKey };
  const url = linkPublico(e.videoUrl, "Vizard", "o vídeo");
  const p = await pedirJson(`${VZ}/project/create`, {
    method: "POST", headers: h, sinal, quem: "Vizard",
    json: { videoUrl: url, ...tipoVizard(url), lang: idioma2(e), preferLength: [0], ratioOfClip: { "9:16": 1, "1:1": 2, "16:9": 4 }[e.proporcao ?? "9:16"], maxClipNumber: maxClipes(e), subtitleSwitch: 1, headlineSwitch: 1, projectName: "E-Nova" },
  });
  checarVizard(p);
  if (!p.projectId) throw new FalhaProvedor("Vizard: resposta sem id do projeto", "formato");
  const videos = await aguardar(ctx, async () => {
    const s = await pedirJson(`${VZ}/project/query/${p.projectId}`, { headers: h, sinal, quem: "Vizard" });
    checarVizard(s);
    return Number(s.code) === 2000 ? (s.videos ?? []) as any[] : undefined;
  }, { etapa: "Achando os melhores trechos no Vizard…", minimoMs: 15_000 });
  videos.sort((a, b) => Number(b.viralScore ?? 0) - Number(a.viralScore ?? 0));
  return clipes(videos.slice(0, maxClipes(e)).map((v) => ({ url: v.videoUrl, titulo: v.title, nota: Number(v.viralScore) || undefined })));
};

// ───────── Klap (tasks/video-to-shorts → projects → exports) ─────────
const KLAP = "https://api.klap.app/v2";
export const klap: Adaptador = async (cap, e, ctx) => {
  if (cap !== "cortes") throw naoFaz("Klap", cap);
  const { chave, sinal } = ctx;
  const h = { Authorization: `Bearer ${chave.apiKey}` };
  const n = maxClipes(e);
  const vertical = (e.proporcao ?? "9:16") === "9:16";
  const t = await pedirJson(`${KLAP}/tasks/video-to-shorts`, {
    method: "POST", headers: h, sinal, quem: "Klap",
    json: {
      source_video_url: linkPublico(e.videoUrl, "Klap", "o vídeo"), language: idioma2(e), max_clip_count: n, target_clip_count: n,
      editing_options: { captions: true, reframe: true }, dimensions: vertical ? { width: 1080, height: 1920 } : e.proporcao === "1:1" ? { width: 1080, height: 1080 } : { width: 1920, height: 1080 },
    },
  });
  const pasta = await aguardar(ctx, async () => {
    const s = await pedirJson(`${KLAP}/tasks/${t.id}`, { headers: h, sinal, quem: "Klap" });
    if (s.status === "ready") return String(s.output_id);
    if (s.status === "error") throw new FalhaProvedor("Klap: o processamento falhou", "erro");
    return undefined;
  }, { etapa: "Achando os melhores trechos na Klap…", minimoMs: 10_000 });
  const projetos = ((await pedirJson<any[]>(`${KLAP}/projects/${pasta}`, { headers: h, sinal, quem: "Klap" })) ?? [])
    .sort((a, b) => (b.virality_score ?? 0) - (a.virality_score ?? 0)).slice(0, n);
  // cada exportação é cobrada: exporta só os melhores N
  const exps = await Promise.all(projetos.map(async (p) => ({ p, ex: await pedirJson(`${KLAP}/projects/${pasta}/${p.id}/exports`, { method: "POST", headers: h, json: {}, sinal, quem: "Klap" }) })));
  const prontos = new Map<string, string>();
  await aguardar(ctx, async () => {
    for (const { p, ex } of exps) {
      if (prontos.has(p.id)) continue;
      const s = await pedirJson(`${KLAP}/projects/${pasta}/${p.id}/exports/${ex.id}`, { headers: h, sinal, quem: "Klap" });
      if (s.status === "ready" && s.src_url) prontos.set(p.id, s.src_url);
      else if (s.status === "error") prontos.set(p.id, "");
    }
    return prontos.size === exps.length ? true : undefined;
  }, { etapa: "Exportando os clipes na Klap…", inicio: 70 });
  return clipes(projetos.map((p) => ({ url: prontos.get(p.id) || undefined, titulo: p.name, nota: p.virality_score !== undefined ? Math.round(p.virality_score * 100) / 10 : undefined })));
};

// ───────── Submagic (Magic Clips: link do YouTube ou upload do arquivo) ─────────
const SM = "https://api.submagic.co/v1";
export const submagic: Adaptador = async (cap, e, ctx) => {
  if (cap !== "cortes") throw naoFaz("Submagic", cap);
  const { chave, sinal } = ctx;
  const h = { "x-api-key": chave.apiKey };
  const titulo = (e.prompt?.trim() || "Cortes E-Nova").slice(0, 100);
  const youtube = !!e.videoUrl && /^https?:\/\/([\w-]+\.)?(youtube\.com|youtu\.be)\//i.test(e.videoUrl);
  let p: any;
  if (youtube) {
    p = await pedirJson(`${SM}/projects/magic-clips`, { method: "POST", headers: h, sinal, quem: "Submagic", json: { title: titulo, language: idioma2(e), youtubeUrl: e.videoUrl } });
  } else {
    // vídeo que não é do YouTube: envia o arquivo (funciona mesmo com o E-Nova em localhost)
    await ctx.progresso?.(5, "Enviando o vídeo para a Submagic…");
    const arq = await arquivoDaEntrada({ ...e, audioUrl: undefined, imagemUrl: undefined }, sinal);
    const fd = new FormData();
    fd.append("file", blobDe(arq), arq.nome.match(/\.(mp4|mov)$/i) ? arq.nome : "video.mp4");
    fd.append("title", titulo);
    fd.append("language", idioma2(e));
    p = await pedirJson(`${SM}/projects/magic-clips/upload`, { method: "POST", headers: h, body: fd, sinal, quem: "Submagic" });
  }
  const proj = await aguardar(ctx, async () => {
    const s = await pedirJson(`${SM}/projects/${p.id}`, { headers: h, sinal, quem: "Submagic" });
    if (s.status === "completed") return s;
    if (s.status === "failed") throw new FalhaProvedor(`Submagic: ${s.failureReason ?? "falhou"}`, "erro");
    return undefined;
  }, { etapa: "Gerando os cortes na Submagic…", minimoMs: 36_000 }); // limite de 100 consultas/hora
  const lista = ((proj.magicClips ?? []) as any[]).filter((c) => c.status !== "failed")
    .sort((a, b) => (b.viralityScores?.total ?? 0) - (a.viralityScores?.total ?? 0)).slice(0, maxClipes(e));
  return clipes(lista.map((c) => ({ url: c.downloadUrl ?? c.directUrl, titulo: c.title, nota: c.viralityScores?.total })));
};
