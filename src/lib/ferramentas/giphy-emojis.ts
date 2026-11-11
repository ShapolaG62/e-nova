import "server-only";
import { decrypt, encrypt } from "@/lib/crypto";
import { features } from "@/lib/env";
import { safeFetch } from "@/lib/net-safety";
import { getSetting, setSetting } from "@/lib/settings";
import type { ItemMidia } from "./pixabay";

// ───────── GIPHY: GIFs e figurinhas (chave grátis em developers.giphy.com) ─────────
const CHAVE_GIPHY = "ferramentas.giphy";

export async function chaveGiphy(): Promise<string | null> {
  const v = await getSetting<string | null>(CHAVE_GIPHY, null);
  if (!v) return null;
  try { return decrypt(v); } catch { return null; }
}
export async function salvarChaveGiphy(chave: string | null) {
  if (chave && !features.encryption) throw new Error("O servidor não tem ENCRYPTION_KEY configurada; não dá para guardar a chave com segurança.");
  await setSetting(CHAVE_GIPHY, chave ? encrypt(chave) : null);
}

type GifImg = { url?: string; mp4?: string; webp?: string; width?: string; height?: string };
type Gif = { id: string; title: string; url: string; username?: string; images: Record<string, GifImg | undefined> };

/** Sem termo: os que estão em alta agora. */
export async function buscarGiphy(chave: string, o: { termo: string; tipo: "gifs" | "stickers"; pagina: number }): Promise<{ itens: ItemMidia[]; total: number }> {
  const POR = 30;
  const q = new URLSearchParams({ api_key: chave, limit: String(POR), offset: String((o.pagina - 1) * POR), rating: "g", lang: "pt", bundle: "messaging_non_clips" });
  if (o.termo) q.set("q", o.termo.slice(0, 50));
  const r = await safeFetch(`https://api.giphy.com/v1/${o.tipo}/${o.termo ? "search" : "trending"}?${q}`, { signal: AbortSignal.timeout(20_000) });
  if (r.status === 401 || r.status === 403) throw new Error("O GIPHY recusou a chave. Confira se colou certo.");
  if (r.status === 429) throw new Error("O GIPHY limitou as buscas por agora. Tente em alguns minutos.");
  if (!r.ok) throw new Error(`O GIPHY não respondeu (${r.status}).`);
  const d = (await r.json()) as { data?: Gif[]; pagination?: { total_count?: number } };
  const itens = (d.data ?? []).map((g): ItemMidia => {
    const orig = g.images.original ?? {};
    const mini = g.images.fixed_width ?? g.images.fixed_width_downsampled ?? orig;
    return {
      id: `gf-${g.id}`, titulo: g.title || (o.tipo === "stickers" ? "Figurinha" : "GIF"), tipo: "gif", fonte: "GIPHY",
      miniatura: mini.webp ?? mini.url ?? "", previa: mini.mp4, url: orig.url ?? "", autor: g.username || "GIPHY", pagina: g.url,
      duracao: 0, largura: Number(orig.width ?? 0), altura: Number(orig.height ?? 0),
    };
  });
  return { itens: itens.filter((i) => i.url && i.miniatura), total: d.pagination?.total_count ?? itens.length };
}

// ───────── Emojis animados do Google (Noto Animated Emoji, CC BY 4.0, sem chave) ─────────
type Icone = { name: string; codepoint: string; categories: string[]; tags: string[]; popularity: number };
const g = globalThis as unknown as { __notoEmojis?: { em: number; lista: Icone[] } };

async function listaEmojis(): Promise<Icone[]> {
  if (g.__notoEmojis && Date.now() - g.__notoEmojis.em < 24 * 3600_000) return g.__notoEmojis.lista;
  const r = await safeFetch("https://googlefonts.github.io/noto-emoji-animation/data/api.json", { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error("Não consegui carregar a lista de emojis agora.");
  const d = (await r.json()) as { icons?: Icone[] };
  const lista = (d.icons ?? []).sort((a, b) => b.popularity - a.popularity);
  g.__notoEmojis = { em: Date.now(), lista };
  return lista;
}

export const CATEGORIAS_EMOJI = [
  ["Smileys and emotions", "Carinhas"], ["People", "Pessoas"], ["Animals and nature", "Animais e natureza"], ["Food and drink", "Comida"],
  ["Travel and places", "Lugares"], ["Activities and events", "Atividades"], ["Objects", "Objetos"], ["Symbols", "Símbolos"], ["Flags", "Bandeiras"],
] as const;

// palavras comuns em português → tags em inglês dos emojis
const PT: Record<string, string> = {
  feliz: "smile", sorriso: "smile", rindo: "laugh", risada: "laugh", chorando: "cry", triste: "sad", amor: "heart", coracao: "heart", coração: "heart",
  fogo: "fire", raiva: "angry", bravo: "angry", medo: "scared", susto: "scream", beijo: "kiss", festa: "party", dinheiro: "money", estrela: "star",
  joia: "thumbs", ok: "ok", palmas: "clap", cachorro: "dog", gato: "cat", comida: "food", pizza: "pizza", cafe: "coffee", café: "coffee", bolo: "cake",
  sol: "sun", chuva: "rain", pensando: "thinking", legal: "cool", oculos: "sunglasses", óculos: "sunglasses", foguete: "rocket", alerta: "warning",
  certo: "check", errado: "cross", tchau: "wave", olhos: "eyes", morto: "skull", caveira: "skull", fantasma: "ghost", presente: "gift", musica: "music", música: "music",
};

const charDe = (cp: string) => { try { return String.fromCodePoint(...cp.split("_").map((h) => parseInt(h, 16))); } catch { return ""; } };

export async function buscarEmojis(o: { termo: string; categoria?: string; pagina: number }): Promise<{ itens: ItemMidia[]; total: number }> {
  const lista = await listaEmojis();
  const t = o.termo.trim().toLowerCase();
  const alvo = PT[t] ?? t;
  const filtrados = lista.filter((e) =>
    (!o.categoria || e.categories.includes(o.categoria)) &&
    (!alvo || e.tags.some((x) => x.includes(alvo)) || e.name.includes(alvo) || charDe(e.codepoint) === o.termo.trim()));
  const POR = 60;
  const pag = filtrados.slice((o.pagina - 1) * POR, o.pagina * POR);
  const base = "https://fonts.gstatic.com/s/e/notoemoji/latest";
  return {
    total: filtrados.length,
    itens: pag.map((e) => ({
      id: `em-${e.codepoint}`, titulo: e.tags.map((x) => x.replace(/:/g, "")).join(", "), tipo: "emoji", fonte: "Google Noto", emoji: charDe(e.codepoint),
      miniatura: `${base}/${e.codepoint}/512.webp`, url: `${base}/${e.codepoint}/512.gif`, autor: "Google (CC BY 4.0)",
      pagina: "https://googlefonts.github.io/noto-emoji-animation/", duracao: 0, largura: 512, altura: 512,
    })),
  };
}
