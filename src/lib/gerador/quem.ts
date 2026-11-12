import "server-only";
import { candidatos } from "@/lib/ia-hub/roteador";
import type { Capacidade } from "@/lib/ia-hub/tipos";

export type QuemFaz = { cap: Capacidade | "revisao" | "olhos"; nome: string; rotulo: string; ia: string | null; gratis: boolean; depois: string[] };

const ROTULO: Partial<Record<Capacidade, string>> = { texto: "Roteiro", imagem: "Imagens", video: "Clipes de vídeo", voz: "Narração", musica: "Trilha" };
const curto = (n: string) => n.replace(/\s*\(.*\)$/, "");

/**
 * A corrente de IAs, na ordem em que o trabalho passa: quem faz primeiro cada etapa e quem assume se ela falhar.
 * Inclui a revisora do roteiro (a 2ª IA de texto) e os "olhos" (IA que enxerga as fotos e confere o personagem).
 */
export async function quemFaz(caps: Capacidade[] = ["texto", "imagem", "video", "voz", "musica"]): Promise<QuemFaz[]> {
  const linhas = await Promise.all(caps.map(async (cap) => {
    const lista = (await candidatos(cap)).filter((c) => c.temChave);
    const ordem = [...lista.filter((c) => !c.emCastigo), ...lista.filter((c) => c.emCastigo)];
    const nomes = [...new Set(ordem.map((c) => curto(c.item.nome)))];
    const primeiro = ordem[0];
    return { cap, nome: cap, rotulo: ROTULO[cap] ?? cap, ia: primeiro ? curto(primeiro.item.nome) : null, gratis: primeiro ? primeiro.item.custo === 0 : false, depois: nomes.slice(1, 4), _ordem: ordem };
  }));
  const out: QuemFaz[] = [];
  for (const l of linhas) {
    const { _ordem, ...linha } = l;
    out.push(linha);
    if (l.cap === "texto") {
      // a revisora é a primeira IA de texto que NÃO escreveu o roteiro
      const outra = _ordem.find((c) => c.item.id !== _ordem[0]?.item.id);
      out.push({ cap: "revisao", nome: "revisao", rotulo: "Revisão do roteiro", ia: outra ? curto(outra.item.nome) : null, gratis: outra ? outra.item.custo === 0 : false, depois: [] });
      const olhos = _ordem.find((c) => c.item.id === "freellmapi-texto");
      out.push({ cap: "olhos", nome: "olhos", rotulo: "Olhos (lê as fotos, confere o personagem)", ia: olhos ? curto(olhos.item.nome) : null, gratis: true, depois: [] });
    }
  }
  return out;
}
