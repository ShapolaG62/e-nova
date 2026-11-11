import "server-only";
import type { VideoBrief, VideoCenaRoteiro } from "@/db/schema";
import { safeFetch } from "@/lib/net-safety";
import { buscarPixabay, chavePixabay, urlMidiaValida, type ItemMidia } from "@/lib/ferramentas/pixabay";

// Gerador ↔ Banco de mídia: antes de gastar IA de imagem/vídeo, procura uma foto ou um vídeo pronto
// (Pixabay, uso comercial liberado) que mostre o que a cena diz. Também serve de EXEMPLO para a IA seguir.

export type MidiaAchada = { buffer: Buffer; mime: string; item: Pick<ItemMidia, "url" | "pagina" | "autor" | "tipo"> & { fonte: string } };

const STOP = new Set(["a", "an", "the", "of", "and", "with", "in", "on", "at", "for", "to", "shot", "photo", "image", "picture", "realistic", "cinematic", "vertical", "close", "up", "closeup"]);

/** Palavras de busca: as que o diretor escreveu, ou as primeiras palavras concretas do prompt. */
export function termoDaCena(c: VideoCenaRoteiro): string {
  if (c.visual.busca?.trim()) return c.visual.busca.trim();
  return c.visual.prompt.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).slice(0, 4).join(" ");
}

async function baixar(url: string): Promise<{ buffer: Buffer; mime: string }> {
  if (!urlMidiaValida(url)) throw new Error("Link fora das fontes do Banco de mídia");
  const r = await safeFetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!r.ok) throw new Error(`não consegui baixar a mídia do banco (${r.status})`);
  const mime = r.headers.get("content-type")?.split(";")[0] || (url.endsWith(".mp4") ? "video/mp4" : "image/jpeg");
  return { buffer: Buffer.from(await r.arrayBuffer()), mime };
}

/**
 * Procura no Banco de mídia a melhor foto/vídeo para a cena.
 * usados = urls já usadas em outras cenas (não repete a mesma imagem).
 * Devolve null se não houver chave da Pixabay ou nada servir.
 */
export async function midiaDoBanco(brief: VideoBrief, cena: VideoCenaRoteiro, usados: Set<string>, o: { so?: "foto" | "video" } = {}): Promise<MidiaAchada | null> {
  const chave = await chavePixabay();
  if (!chave) return null;
  const orientacao: "vertical" | "horizontal" | undefined = brief.proporcao === "9:16" ? "vertical" : brief.proporcao === "16:9" ? "horizontal" : undefined;
  const querVideo = (o.so ?? (cena.visual.tipo === "video" ? "video" : "foto")) === "video";
  const termo = termoDaCena(cena);
  if (!termo) return null;
  const tentativas: { tipo: "foto" | "video"; termo: string; orientacao?: "vertical" | "horizontal" }[] = [
    { tipo: querVideo ? "video" : "foto", termo, orientacao },
    ...(querVideo ? [{ tipo: "foto" as const, termo, orientacao }] : []),
    { tipo: "foto", termo: termo.split(" ").slice(0, 2).join(" ") },             // mais curto e sem exigir orientação
  ];
  for (const t of tentativas) {
    const { itens } = await buscarPixabay(chave, { termo: t.termo, tipo: t.tipo, pagina: 1, porPagina: 20, idioma: "en", orientacao: t.orientacao }).catch(() => ({ itens: [] as ItemMidia[] }));
    // escolhe o que mais combina: quantas palavras da busca aparecem nas etiquetas (a Pixabay às vezes devolve coisa vizinha)
    const palavras = t.termo.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const nota = (i: ItemMidia) => {
      const tags = i.titulo.toLowerCase().split(",").map((x) => x.trim());
      const bate = (tag: string) => palavras.some((w) => tag.includes(w.replace(/s$/, "")));
      // assunto principal (1ª e 2ª etiquetas) vale mais que uma etiqueta perdida no fim da lista
      return tags.reduce((n, tag, k) => n + (bate(tag) ? (k === 0 ? 3 : k === 1 ? 2 : 1) : 0), 0);
    };
    const validos = itens.filter((i) => !usados.has(i.url) && (i.tipo !== "video" || i.duracao >= 4) && Math.min(i.largura, i.altura) >= 600);
    const bom = validos.map((i, ordem) => ({ i, n: nota(i) * 10 - ordem })).sort((a, b) => b.n - a.n)[0]?.i;
    // nenhuma etiqueta bate com a palavra principal da busca? tenta a próxima busca (mais curta) antes de aceitar
    if (bom && palavras.length && nota(bom) === 0 && t !== tentativas[tentativas.length - 1]) continue;
    if (!bom) continue;
    usados.add(bom.url);
    const arq = await baixar(bom.url);
    return { ...arq, item: { url: bom.url, pagina: bom.pagina, autor: bom.autor, fonte: bom.fonte, tipo: bom.tipo } };
  }
  return null;
}

/** Mídia escolhida à mão na tela (qualquer fonte do Banco de mídia). */
export async function midiaEscolhida(url: string): Promise<MidiaAchada> {
  const arq = await baixar(url);
  return { ...arq, item: { url, pagina: url, autor: "", fonte: /pixabay/.test(url) ? "Pixabay" : /giphy/.test(url) ? "GIPHY" : "Banco de mídia", tipo: arq.mime.startsWith("video/") ? "video" : "foto" } };
}
