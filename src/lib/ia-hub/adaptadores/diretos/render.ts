import "server-only";
import type { Adaptador, EntradaIA } from "../../tipos";
import { FalhaProvedor, aguardar, linkPublico, naoFaz, pedirJson } from "./comum";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ───────── Shotstack (Edit API: render de timeline JSON) ─────────
// entrada.dados = edit JSON completo ({timeline, output}) OU montamos uma timeline simples
// com entrada.prompt (texto na tela), entrada.imagemUrl / videoUrl (fundo) e entrada.audioUrl (trilha).
export function timelineShotstack(e: EntradaIA): Record<string, unknown> {
  if (e.dados && typeof e.dados === "object" && "timeline" in e.dados) {
    return { ...e.dados, output: (e.dados as any).output ?? { format: "mp4", resolution: "hd", aspectRatio: e.proporcao ?? "16:9" } };
  }
  const dur = Math.max(1, Math.min(300, e.duracao ?? 10));
  const tracks: any[] = [];
  if (e.prompt?.trim()) {
    tracks.push({ clips: [{
      asset: { type: "text", text: e.prompt.trim().slice(0, 500), width: e.proporcao === "9:16" ? 900 : 1600, height: 400, font: { family: "Montserrat ExtraBold", color: "#ffffff", size: 56 }, alignment: { horizontal: "center", vertical: "center" } },
      start: 0, length: dur, transition: { in: "fade", out: "fade" },
    }] });
  }
  if (e.videoUrl) tracks.push({ clips: [{ asset: { type: "video", src: linkPublico(e.videoUrl, "Shotstack", "o vídeo") }, start: 0, length: dur, fit: "cover" }] });
  else if (e.imagemUrl) tracks.push({ clips: [{ asset: { type: "image", src: linkPublico(e.imagemUrl, "Shotstack", "a imagem") }, start: 0, length: dur, fit: "cover", effect: "zoomIn" }] });
  if (e.audioUrl) tracks.push({ clips: [{ asset: { type: "audio", src: linkPublico(e.audioUrl, "Shotstack", "o áudio"), effect: "fadeOut" }, start: 0, length: dur }] });
  if (!tracks.length) throw new FalhaProvedor("Shotstack: faltou o conteúdo (texto, imagem, vídeo ou edit JSON)", "formato");
  return { timeline: { background: "#000000", tracks }, output: { format: "mp4", resolution: "hd", aspectRatio: e.proporcao ?? "16:9" } };
}

export const shotstack: Adaptador = async (cap, e, ctx) => {
  if (cap !== "edicao-video") throw naoFaz("Shotstack", cap);
  const { chave, sinal } = ctx;
  const amb = (chave.ambiente ?? "").trim().toLowerCase() === "v1" ? "v1" : "stage";
  const base = `https://api.shotstack.io/edit/${amb}`;
  const h = { "x-api-key": chave.apiKey };
  const r = await pedirJson(`${base}/render`, { method: "POST", headers: h, json: timelineShotstack(e), sinal, quem: "Shotstack" });
  const id = r.response?.id;
  if (!id) throw new FalhaProvedor(`Shotstack: ${r.message ?? "render não foi aceito"}`, "formato");
  return aguardar(ctx, async () => {
    const s = (await pedirJson(`${base}/render/${id}?data=false`, { headers: h, sinal, quem: "Shotstack" })).response ?? {};
    if (s.status === "done" && s.url) return { arquivos: [{ url: s.url as string, mime: "video/mp4" }], meta: { ambiente: amb } };
    if (s.status === "failed") throw new FalhaProvedor(`Shotstack: ${s.error ?? "o render falhou"}`, "erro");
    return undefined;
  }, { etapa: amb === "stage" ? "Renderizando no Shotstack (teste, com marca d'água)…" : "Renderizando no Shotstack…" });
};

// ───────── Creatomate (v2/renders) ─────────
// entrada.template = id do template; entrada.dados = modifications. Se entrada.dados tiver "elements", vai como RenderScript.
export const creatomate: Adaptador = async (cap, e, ctx) => {
  if (cap !== "edicao-video") throw naoFaz("Creatomate", cap);
  const { chave, sinal } = ctx;
  const h = { Authorization: `Bearer ${chave.apiKey}` };
  const script = e.dados && "elements" in e.dados;
  if (!e.template && !script) throw new FalhaProvedor("Creatomate: faltou o id do template", "formato");
  const corpo = script ? e.dados : { template_id: e.template, modifications: e.dados ?? {} };
  const r0 = await pedirJson(`https://api.creatomate.com/v2/renders`, { method: "POST", headers: h, json: corpo, sinal, quem: "Creatomate" });
  const r = Array.isArray(r0) ? r0[0] : r0;
  if (!r?.id) throw new FalhaProvedor("Creatomate: resposta sem id do render", "formato");
  return aguardar(ctx, async () => {
    const s = await pedirJson(`https://api.creatomate.com/v2/renders/${r.id}`, { headers: h, sinal, quem: "Creatomate" });
    if (s.status === "succeeded" && s.url) return { arquivos: [{ url: s.url as string, mime: (s.output_format && s.output_format !== "mp4" ? `image/${s.output_format}` : "video/mp4") }] };
    if (s.status === "failed") throw new FalhaProvedor(`Creatomate: ${s.error_message ?? "o render falhou"}`, "erro");
    return undefined;
  }, { etapa: "Renderizando no Creatomate…", minimoMs: 3000 });
};

// ───────── Plainly (api/v2/renders; Basic com a chave como usuário) ─────────
// entrada.template = "projectId/templateId" (ou dados.projectId + template); entrada.dados.parametros (ou o resto de dados) = parâmetros.
export const plainly: Adaptador = async (cap, e, ctx) => {
  if (cap !== "edicao-video") throw naoFaz("Plainly", cap);
  const { chave, sinal } = ctx;
  const h = { Authorization: `Basic ${Buffer.from(`${chave.apiKey}:`).toString("base64")}` };
  const { projectId: pDados, parametros, ...resto } = (e.dados ?? {}) as Record<string, any>;
  const [p1, t1] = (e.template ?? "").includes("/") ? e.template!.split("/") : [pDados, e.template];
  if (!p1 || !t1) throw new FalhaProvedor('Plainly: informe o template como "idDoProjeto/idDoTemplate"', "formato");
  const r = await pedirJson("https://api.plainlyvideos.com/api/v2/renders", {
    method: "POST", headers: h, sinal, quem: "Plainly",
    json: { projectId: p1, templateId: t1, parameters: parametros ?? resto },
  });
  return aguardar(ctx, async () => {
    const s = await pedirJson(`https://api.plainlyvideos.com/api/v2/renders/${r.id}`, { headers: h, sinal, quem: "Plainly" });
    if (s.state === "DONE" && s.output) return { arquivos: [{ url: s.output as string, mime: "video/mp4" }] };
    if (["FAILED", "INVALID", "CANCELLED"].includes(s.state)) throw new FalhaProvedor(`Plainly: render ${s.state === "INVALID" ? "inválido (confira os parâmetros)" : "falhou"}`, "erro");
    return undefined;
  }, { etapa: "Renderizando no Plainly (After Effects)…", minimoMs: 5000 });
};
