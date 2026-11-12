import "server-only";
import type { Adaptador, EntradaIA } from "../../tipos";
import { FalhaProvedor, checarResposta, exigirPrompt, imagemDaEntrada, naoFaz, pedirJson } from "./comum";
import { jsonDe } from "./gratis";

/* eslint-disable @typescript-eslint/no-explicit-any */

// FreeLLMAPI: roteador grátis que junta ~34 provedores (Google, Groq, NVIDIA, Cerebras, Mistral, OpenRouter…)
// num endereço no formato da OpenAI. Ele mesmo escolhe o melhor modelo disponível e troca de provedor
// quando um bate o limite. Roda como servidor próprio (porta 3001), fora do E-Nova.
// Modelos virtuais: "auto" (cadeia padrão), "auto:smart" (mais inteligente), "auto:fast" (mais rápido),
// "fusion" (vários modelos respondem e um juiz junta o melhor).

const base = (chave: Record<string, string>) => (chave.url?.trim() || "http://localhost:3001/v1").replace(/\/+$/, "");
const auth = (chave: Record<string, string>) => ({ Authorization: `Bearer ${chave.apiKey}` });
const TAM: Record<string, string> = { "9:16": "1024x1792", "16:9": "1792x1024", "1:1": "1024x1024" };

const sistema = (e: EntradaIA) =>
  e.schemaJson
    ? `${e.sistema ?? ""}\n\nResponda SOMENTE com JSON válido que siga este JSON Schema: ${JSON.stringify(e.schemaJson)}\nEscreva em português do Brasil.`
    : (e.sistema ?? "");

async function arquivoDaResposta(r: Response, nome: string, quem: string) {
  const mime = r.headers.get("content-type")?.split(";")[0] ?? "";
  if (mime.startsWith("application/json")) {
    const d: any = await r.json();
    const item = d.data?.[0] ?? d;
    if (item.b64_json) return { buffer: Buffer.from(item.b64_json, "base64"), mime: item.mime_type ?? "image/png", nome };
    if (item.url) {
      const f = await fetch(item.url);
      await checarResposta(f, quem);
      return { buffer: Buffer.from(await f.arrayBuffer()), mime: f.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream", nome };
    }
    throw new FalhaProvedor(`${quem}: resposta sem arquivo`, "formato");
  }
  return { buffer: Buffer.from(await r.arrayBuffer()), mime, nome };
}

export const freellmapi: Adaptador = async (cap, e, { chave, rota, sinal, progresso }) => {
  if (!chave.apiKey) throw new FalhaProvedor("FreeLLMAPI sem a chave unificada", "sem-chave");
  const url = base(chave);
  const quem = "FreeLLMAPI";

  if (cap === "texto") {
    // com imagem na entrada (ex.: analisar um quadro do vídeo), vai junto como visão
    const img = e.imagemUrl || e.arquivo?.mime.startsWith("image/") ? await imagemDaEntrada(e, sinal) : null;
    const conteudo = img
      ? [{ type: "text", text: e.prompt ?? "" }, { type: "image_url", image_url: { url: `data:${img.mime};base64,${img.buffer.toString("base64")}` } }]
      : (e.prompt ?? "");
    let d: any;
    try {
      d = await pedirJson(`${url}/chat/completions`, {
        method: "POST", sinal, quem, headers: auth(chave),
        json: {
          model: rota.modelo ?? "auto", temperature: e.temperatura ?? 0.7,
          messages: [{ role: "system", content: sistema(e) }, { role: "user", content: conteudo }],
          ...(e.schemaJson ? { response_format: { type: "json_object" } } : {}),
        },
      });
    } catch (err) {
      // servidor da FreeLLMAPI desligado: o roteador do E-Nova passa para a próxima IA
      if (err instanceof TypeError || /ECONNREFUSED|fetch failed/i.test(String(err))) throw new FalhaProvedor("FreeLLMAPI desligada (porta 3001)", "fora");
      throw err;
    }
    const texto = String(d.choices?.[0]?.message?.content ?? "");
    if (!texto.trim()) throw new FalhaProvedor(`${quem}: resposta vazia`, "formato");
    return { texto, json: e.schemaJson ? jsonDe(texto) : undefined, tokens: { entrada: d.usage?.prompt_tokens ?? 0, saida: d.usage?.completion_tokens ?? 0 } };
  }

  if (cap === "imagem") {
    await progresso?.(20, "Criando a imagem pela FreeLLMAPI (grátis)…");
    const r = await fetch(`${url}/images/generations`, {
      method: "POST", signal: sinal, headers: { ...auth(chave), "Content-Type": "application/json" },
      body: JSON.stringify({ model: rota.modelo ?? "auto", prompt: exigirPrompt(e, quem).slice(0, 3800), size: TAM[e.proporcao ?? "1:1"], n: 1, response_format: "b64_json" }),
    });
    await checarResposta(r, quem);
    return { arquivos: [await arquivoDaResposta(r, "imagem.png", quem)] };
  }

  if (cap === "video") {
    await progresso?.(10, "Gerando o clipe pela FreeLLMAPI (pode levar alguns minutos)…");
    const img = await imagemDaEntrada(e, sinal);
    const r = await fetch(`${url}/videos/generations`, {
      method: "POST", signal: sinal, headers: { ...auth(chave), "Content-Type": "application/json" },
      body: JSON.stringify({
        model: rota.modelo ?? "auto", prompt: exigirPrompt(e, quem).slice(0, 2000),
        duration: Math.max(2, Math.min(10, Math.round(e.duracao ?? 5))), aspect_ratio: e.proporcao ?? "9:16",
        // foto para animar: o clipe começa nela
        ...(img ? { image: `data:${img.mime};base64,${img.buffer.toString("base64")}` } : {}),
      }),
    });
    await checarResposta(r, quem);
    const arq = await arquivoDaResposta(r, "clipe.mp4", quem);
    if (!arq.mime.startsWith("video/")) throw new FalhaProvedor(`${quem}: não devolveu vídeo`, "formato");
    return { arquivos: [arq] };
  }

  if (cap === "voz") {
    const r = await fetch(`${url}/audio/speech`, {
      method: "POST", signal: sinal, headers: { ...auth(chave), "Content-Type": "application/json" },
      body: JSON.stringify({ model: rota.modelo ?? "auto", input: exigirPrompt(e, quem).slice(0, 4000), voice: e.voz || "alloy", response_format: "mp3" }),
    });
    await checarResposta(r, quem);
    return { arquivos: [await arquivoDaResposta(r, "narracao.mp3", quem)] };
  }

  throw naoFaz(quem, cap);
};
