import "server-only";
import type { Adaptador } from "../tipos";
import { adobe, bfl, goapi, ideogram, leonardo, openai, photoroom, recraft, stability } from "./diretos/imagem";
import { gemini, kling, luma, minimax, runway } from "./diretos/video";
import { colossyan, did, heygen, synthesia, tavus } from "./diretos/avatar";
import { klap, opusclip, submagic, vizard } from "./diretos/cortes";
import { creatomate, plainly, shotstack } from "./diretos/render";
import { assemblyai, cartesia, custom, deepgram, elevenlabs, playht } from "./diretos/audio";
import { cloudflare, edge, huggingface, imagemLocal, openrouter, pollinations } from "./diretos/gratis";

/**
 * Adaptadores "diretos": um por serviço (chave = id da credencial em catalogo.ts).
 * Cada um recebe (capacidade, entrada, ctx) e devolve SaidaIA, lançando FalhaProvedor
 * (com o motivo certo) quando não der — aí o roteador passa para a próxima IA.
 * O código de cada grupo fica em ./diretos/*.ts.
 */
export const DIRETOS: Record<string, Adaptador> = {
  // imagem
  gemini, openai, bfl, stability, adobe, recraft, ideogram, leonardo, photoroom, goapi,
  // vídeo
  runway, luma, minimax, kling,
  // avatares
  heygen, synthesia, tavus, colossyan, did,
  // cortes virais
  opusclip, vizard, klap, submagic,
  // edição programática
  shotstack, creatomate, plainly,
  // transcrição, voz, música, áudio
  assemblyai, deepgram, elevenlabs, cartesia, playht,
  // servidor próprio
  custom,
  // grátis (vindas do MeuStudio)
  pollinations, openrouter, cloudflare, huggingface, edge, "imagem-local": imagemLocal,
};
