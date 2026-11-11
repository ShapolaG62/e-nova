import "server-only";
import type { Adaptador, EntradaIA } from "../../tipos";
import { FalhaProvedor, aguardar, blobDe, exigirPrompt, imagemDaEntrada, naoFaz, pedirJson } from "./comum";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Convenção para avatares: entrada.prompt = roteiro falado; entrada.voz = id da voz;
// entrada.dados.avatar = id do avatar/réplica/ator (se faltar, usamos um avatar público do próprio serviço).
const avatarDe = (e: EntradaIA) => (typeof e.dados?.avatar === "string" && e.dados.avatar) || undefined;
const roteiro = (e: EntradaIA, quem: string) => exigirPrompt(e, quem);
const lista = (d: any): any[] => (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : Array.isArray(d?.items) ? d.items : Array.isArray(d?.results) ? d.results : []);

// ───────── HeyGen (API v3; a v2 foi desligada em 31/10/2026) ─────────
const HG = "https://api.heygen.com";
export const heygen: Adaptador = async (cap, e, ctx) => {
  if (cap !== "avatar") throw naoFaz("HeyGen", cap);
  const { chave, sinal } = ctx;
  const h = { "x-api-key": chave.apiKey, accept: "application/json" };
  const texto = roteiro(e, "HeyGen");
  let avatarId = avatarDe(e), vozId = e.voz;
  let vozDoAvatar: string | undefined;
  if (!avatarId) {
    const looks = lista(await pedirJson(`${HG}/v3/avatars/looks?ownership=public&limit=20`, { headers: h, sinal, quem: "HeyGen" }));
    if (!looks.length) throw new FalhaProvedor("HeyGen: nenhum avatar público disponível; informe o id do avatar", "formato");
    const escolhido = looks.find((l) => l.preferred_orientation === (e.proporcao === "9:16" ? "vertical" : "horizontal")) ?? looks[0];
    avatarId = escolhido.id;
    vozDoAvatar = escolhido.default_voice_id;
  }
  if (!vozId) {
    const vozes = lista(await pedirJson(`${HG}/v3/models/audio/voices?type=public&language=pt&limit=100`, { headers: h, sinal, quem: "HeyGen" }).catch(() => ({})));
    vozId = vozes[0]?.voice_id ?? vozDoAvatar; // sem voz: o HeyGen usa a voz padrão do avatar
  }
  const v = await pedirJson(`${HG}/v3/videos`, {
    method: "POST", headers: h, sinal, quem: "HeyGen",
    json: { type: "avatar", avatar_id: avatarId, script: texto, ...(vozId ? { voice_id: vozId } : {}), resolution: "720p", aspect_ratio: e.proporcao ?? "16:9", title: texto.slice(0, 60) },
  });
  const id = v.data?.video_id;
  if (!id) throw new FalhaProvedor("HeyGen: resposta sem id do vídeo", "formato");
  return aguardar(ctx, async () => {
    const s = (await pedirJson(`${HG}/v3/videos/${id}`, { headers: h, sinal, quem: "HeyGen" })).data ?? {};
    if (s.status === "completed" && s.video_url) return { arquivos: [{ url: s.video_url as string, mime: "video/mp4" }] };
    if (s.status === "failed") throw new FalhaProvedor(`HeyGen: ${s.failure_message ?? s.failure_code ?? "falhou"}`, "erro");
    return undefined;
  }, { etapa: "Gravando o avatar no HeyGen…" });
};

// ───────── Synthesia (v2/videos) ─────────
export const synthesia: Adaptador = async (cap, e, ctx) => {
  if (cap !== "avatar") throw naoFaz("Synthesia", cap);
  const { chave, sinal } = ctx;
  const h = { Authorization: chave.apiKey, accept: "application/json" };
  const texto = roteiro(e, "Synthesia");
  const v = await pedirJson("https://api.synthesia.io/v2/videos", {
    method: "POST", headers: h, sinal, quem: "Synthesia",
    json: {
      test: e.dados?.teste === true, title: texto.slice(0, 60), visibility: "private", aspectRatio: e.proporcao ?? "16:9",
      input: [{ scriptText: texto, avatar: avatarDe(e) ?? "anna_costume1_cameraA", background: (e.dados?.fundo as string) ?? "off_white" }],
    },
  });
  return aguardar(ctx, async () => {
    const s = await pedirJson(`https://api.synthesia.io/v2/videos/${v.id}`, { headers: h, sinal, quem: "Synthesia" });
    if (s.status === "complete" && s.download) return { arquivos: [{ url: s.download as string, mime: "video/mp4" }] };
    if (["error", "rejected", "deleted"].includes(s.status)) throw new FalhaProvedor(`Synthesia: vídeo ${s.status === "rejected" ? "recusado pela moderação" : s.status}`, "erro");
    return undefined;
  }, { etapa: "Gravando o avatar na Synthesia…", minimoMs: 5000 });
};

// ───────── Tavus (v2/videos; réplicas agora se chamam "faces") ─────────
const TV = "https://tavusapi.com/v2";
export const tavus: Adaptador = async (cap, e, ctx) => {
  if (cap !== "avatar") throw naoFaz("Tavus", cap);
  const { chave, sinal } = ctx;
  const h = { "x-api-key": chave.apiKey };
  const texto = roteiro(e, "Tavus");
  let replica = avatarDe(e);
  if (!replica) {
    const faces = lista(await pedirJson(`${TV}/faces?face_type=system&limit=20`, { headers: h, sinal, quem: "Tavus" }));
    replica = (faces.find((f) => f.status === "completed") ?? faces[0])?.face_id;
    if (!replica) throw new FalhaProvedor("Tavus: nenhuma réplica disponível; informe o id da réplica", "formato");
  }
  const v = await pedirJson(`${TV}/videos`, { method: "POST", headers: h, sinal, quem: "Tavus", json: { replica_id: replica, script: texto, video_name: texto.slice(0, 60) } });
  return aguardar(ctx, async () => {
    const s = await pedirJson(`${TV}/videos/${v.video_id}`, { headers: h, sinal, quem: "Tavus" });
    if (s.status === "ready") {
      const url = s.download_url ?? s.stream_url ?? s.hosted_url;
      if (url) return { arquivos: [{ url: url as string, mime: "video/mp4" }] };
    }
    if (s.status === "error" || s.status === "deleted") throw new FalhaProvedor(`Tavus: ${s.status_details ?? s.status}`, "erro");
    return undefined;
  }, { etapa: "Gravando a réplica no Tavus…" });
};

// ───────── Colossyan (video-generation-jobs → generated-videos) ─────────
const CO = "https://app.colossyan.com/api/v1";
const TELA = { "16:9": { width: 1920, height: 1080 }, "9:16": { width: 1080, height: 1920 }, "1:1": { width: 1080, height: 1080 } } as const;
export const colossyan: Adaptador = async (cap, e, ctx) => {
  if (cap !== "avatar") throw naoFaz("Colossyan", cap);
  const { chave, sinal } = ctx;
  const h = { Authorization: `Bearer ${chave.apiKey}` };
  const texto = roteiro(e, "Colossyan");
  let ator = avatarDe(e), voz = e.voz;
  if (!ator) {
    const atores = lista(await pedirJson(`${CO}/assets/actors`, { headers: h, sinal, quem: "Colossyan" }));
    if (!atores.length) throw new FalhaProvedor("Colossyan: nenhum ator disponível; informe o nome do ator", "formato");
    ator = atores[0].name;
    const dv = atores[0].default_voice;
    voz ??= typeof dv === "string" ? dv : dv?.name ?? dv?.id;
  }
  const tela = TELA[e.proporcao ?? "16:9"];
  const lado = Math.min(tela.width, tela.height);
  const job = await pedirJson(`${CO}/video-generation-jobs`, {
    method: "POST", headers: h, sinal, quem: "Colossyan",
    json: {
      videoCreative: {
        settings: { name: texto.slice(0, 60), videoSize: tela },
        scenes: [{ tracks: [{ type: "actor", position: { x: Math.round((tela.width - lado) / 2), y: tela.height - lado }, size: { width: lado, height: lado }, actor: ator, text: texto, speakerId: voz ?? "pt-BR-FranciscaNeural" }] }],
      },
    },
  });
  const videoId = await aguardar(ctx, async () => {
    const s = await pedirJson(`${CO}/video-generation-jobs/${job.id}`, { headers: h, sinal, quem: "Colossyan" });
    if (s.status === "finished") return String(s.videoId ?? job.videoId);
    if (s.status === "failed" || s.status === "deleted") throw new FalhaProvedor("Colossyan: a geração falhou", "erro");
    return undefined;
  }, { etapa: "Gravando o avatar na Colossyan…" });
  const vid = await pedirJson(`${CO}/generated-videos/${videoId}`, { headers: h, sinal, quem: "Colossyan" });
  if (!vid.publicUrl) throw new FalhaProvedor("Colossyan: resposta sem link do vídeo", "formato");
  return { arquivos: [{ url: vid.publicUrl as string, mime: "video/mp4" }] };
};

// ───────── D-ID (talks: foto falante) ─────────
const DID = "https://api.d-id.com";
export const did: Adaptador = async (cap, e, ctx) => {
  if (cap !== "avatar") throw naoFaz("D-ID", cap);
  const { chave, sinal } = ctx;
  const h = { Authorization: `Basic ${chave.apiKey}`, accept: "application/json" };
  const texto = roteiro(e, "D-ID");
  // a foto é enviada para o próprio D-ID (funciona mesmo com o E-Nova em localhost); sem foto, o D-ID usa a imagem padrão
  let sourceUrl: string | undefined;
  const img = await imagemDaEntrada(e, sinal);
  if (img) {
    const fd = new FormData();
    fd.append("image", blobDe(img), img.nome?.match(/\.(png|jpe?g)$/i) ? img.nome : `foto.${img.mime.includes("png") ? "png" : "jpg"}`);
    sourceUrl = (await pedirJson(`${DID}/images`, { method: "POST", headers: h, body: fd, sinal, quem: "D-ID" })).url;
  }
  const t = await pedirJson(`${DID}/talks`, {
    method: "POST", headers: h, sinal, quem: "D-ID",
    json: {
      ...(sourceUrl ? { source_url: sourceUrl } : {}),
      script: { type: "text", input: texto, provider: { type: "microsoft", voice_id: e.voz || "pt-BR-FranciscaNeural" } },
      config: { result_format: "mp4" },
    },
  });
  return aguardar(ctx, async () => {
    const s = await pedirJson(`${DID}/talks/${t.id}`, { headers: h, sinal, quem: "D-ID" });
    if (s.status === "done" && s.result_url) return { arquivos: [{ url: s.result_url as string, mime: "video/mp4" }] };
    if (s.status === "error" || s.status === "rejected") throw new FalhaProvedor(`D-ID: ${s.error?.description ?? s.status}`, "erro");
    return undefined;
  }, { etapa: "Animando a foto no D-ID…" });
};
