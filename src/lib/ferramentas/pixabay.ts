import "server-only";
import { decrypt, encrypt } from "@/lib/crypto";
import { features } from "@/lib/env";
import { safeFetch } from "@/lib/net-safety";
import { getSetting, setSetting } from "@/lib/settings";

/** Banco de mídia da Pixabay. A chave fica no banco, criptografada (AES-GCM). */
const CHAVE_SETTING = "ferramentas.pixabay";

export async function chavePixabay(): Promise<string | null> {
  const v = await getSetting<string | null>(CHAVE_SETTING, null);
  if (!v) return null;
  try {
    return decrypt(v);
  } catch {
    return null;
  }
}

export async function salvarChavePixabay(chave: string | null) {
  if (chave && !features.encryption) throw new Error("O servidor não tem ENCRYPTION_KEY configurada; não dá para guardar a chave com segurança.");
  await setSetting(CHAVE_SETTING, chave ? encrypt(chave) : null);
}

export type ItemMidia = {
  id: number;
  titulo: string;
  miniatura: string;
  url: string;
  autor: string;
  pagina: string;
  duracao: number;
  tipo: "foto" | "video";
  largura: number;
  altura: number;
};

type HitFoto = { id: number; tags: string; webformatURL: string; largeImageURL: string; user: string; pageURL: string; imageWidth: number; imageHeight: number };
type HitVideo = { id: number; tags: string; user: string; pageURL: string; duration: number; videos: Record<string, { url: string; width: number; height: number; thumbnail?: string } | undefined> };

export async function buscarPixabay(chave: string, termo: string, tipo: "foto" | "video", pagina: number): Promise<{ itens: ItemMidia[]; total: number }> {
  const q = new URLSearchParams({ key: chave, q: termo.slice(0, 100), page: String(pagina), per_page: "24", safesearch: "true", lang: "pt" });
  const url = `https://pixabay.com/api/${tipo === "video" ? "videos/" : ""}?${q}`;
  const r = await safeFetch(url, { signal: AbortSignal.timeout(20_000) });
  if (r.status === 400 || r.status === 401 || r.status === 403) throw new Error("A Pixabay recusou a chave. Confira se colou certo.");
  if (r.status === 429) throw new Error("Muitas buscas seguidas. Espere um minuto.");
  if (!r.ok) throw new Error(`A Pixabay não respondeu (${r.status}).`);
  const d = (await r.json()) as { totalHits?: number; hits?: (HitFoto & HitVideo)[] };
  const itens = (d.hits ?? []).map((x): ItemMidia => {
    if (tipo === "video") {
      const v = x.videos.large?.url ? x.videos.large : x.videos.medium ?? x.videos.small ?? x.videos.tiny;
      return {
        id: x.id, titulo: x.tags, tipo, autor: x.user, pagina: x.pageURL, duracao: x.duration,
        miniatura: x.videos.medium?.thumbnail ?? x.videos.tiny?.thumbnail ?? "", url: v?.url ?? "", largura: v?.width ?? 0, altura: v?.height ?? 0,
      };
    }
    return { id: x.id, titulo: x.tags, tipo, autor: x.user, pagina: x.pageURL, duracao: 0, miniatura: x.webformatURL, url: x.largeImageURL, largura: x.imageWidth, altura: x.imageHeight };
  });
  return { itens: itens.filter((i) => i.url), total: d.totalHits ?? 0 };
}

/** Só aceita baixar dos domínios da própria Pixabay. */
export function urlPixabayValida(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && (u.hostname === "pixabay.com" || u.hostname.endsWith(".pixabay.com"));
  } catch {
    return false;
  }
}
