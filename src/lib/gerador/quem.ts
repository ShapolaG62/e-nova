import "server-only";
import { candidatos } from "@/lib/ia-hub/roteador";
import type { Capacidade } from "@/lib/ia-hub/tipos";

export type QuemFaz = { cap: Capacidade; nome: string; rotulo: string; ia: string | null; gratis: boolean };

const ROTULO: Partial<Record<Capacidade, string>> = { texto: "Roteiro", imagem: "Imagens", video: "Clipes de vídeo", voz: "Narração", musica: "Trilha" };

/** Qual IA a Central vai usar primeiro em cada etapa (para mostrar antes de gastar). */
export async function quemFaz(caps: Capacidade[] = ["texto", "imagem", "video", "voz", "musica"]): Promise<QuemFaz[]> {
  return Promise.all(caps.map(async (cap) => {
    const lista = (await candidatos(cap)).filter((c) => c.temChave);
    const primeiro = lista.find((c) => !c.emCastigo) ?? lista[0];
    return { cap, nome: cap, rotulo: ROTULO[cap] ?? cap, ia: primeiro?.item.nome ?? null, gratis: primeiro ? primeiro.item.custo === 0 : false };
  }));
}
