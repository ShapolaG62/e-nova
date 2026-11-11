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

export type TipoMidia = "tudo" | "foto" | "ilustracao" | "vetor" | "video";
export type ItemMidia = {
  id: string;
  titulo: string;
  miniatura: string;
  previa?: string;          // vídeo curto para tocar no navegador (passa pelo proxy do E-Nova)
  url: string;              // arquivo grande para salvar
  autor: string;
  pagina: string;
  duracao: number;
  tipo: "foto" | "video" | "gif" | "emoji";
  largura: number;
  altura: number;
  fonte: "Pixabay" | "GIPHY" | "Google Noto";
  emoji?: string;
};

/** Categorias da Pixabay com nome em português. */
export const CATEGORIAS_PIXABAY = [
  ["backgrounds", "Fundos"], ["business", "Negócios"], ["food", "Comida"], ["people", "Pessoas"], ["nature", "Natureza"],
  ["places", "Lugares"], ["travel", "Viagem"], ["fashion", "Moda"], ["health", "Saúde"], ["education", "Educação"],
  ["computer", "Tecnologia"], ["buildings", "Construções"], ["animals", "Animais"], ["sports", "Esportes"], ["music", "Música"],
  ["feelings", "Sentimentos"], ["industry", "Indústria"], ["transportation", "Transporte"], ["science", "Ciência"], ["religion", "Religião"],
] as const;
export type CategoriaPixabay = (typeof CATEGORIAS_PIXABAY)[number][0];

type HitFoto = { id: number; tags: string; webformatURL: string; largeImageURL: string; user: string; pageURL: string; imageWidth: number; imageHeight: number; type?: string };
type HitVideo = { id: number; tags: string; user: string; pageURL: string; duration: number; videos: Record<string, { url: string; width: number; height: number; thumbnail?: string } | undefined> };

/**
 * Busca (ou navega sem termo: os mais populares/recentes) na Pixabay.
 * tipo "tudo" = todas as imagens; vídeos ficam na aba própria.
 */
export async function buscarPixabay(chave: string, o: { termo: string; tipo: TipoMidia; pagina: number; categoria?: CategoriaPixabay | ""; ordem?: "popular" | "latest"; destaques?: boolean; orientacao?: "vertical" | "horizontal"; porPagina?: number; idioma?: "pt" | "en" }): Promise<{ itens: ItemMidia[]; total: number }> {
  const video = o.tipo === "video";
  const q = new URLSearchParams({ key: chave, q: o.termo.slice(0, 100), page: String(o.pagina), per_page: String(o.porPagina ?? 30), safesearch: "true", lang: o.idioma ?? "pt", order: o.ordem ?? "popular" });
  if (o.orientacao && !video) q.set("orientation", o.orientacao);
  if (!video) q.set("image_type", { tudo: "all", foto: "photo", ilustracao: "illustration", vetor: "vector" }[o.tipo as "tudo" | "foto" | "ilustracao" | "vetor"]);
  if (o.categoria) q.set("category", o.categoria);
  if (o.destaques) q.set("editors_choice", "true");
  const url = `https://pixabay.com/api/${video ? "videos/" : ""}?${q}`;
  const r = await safeFetch(url, { signal: AbortSignal.timeout(20_000) });
  if (r.status === 400 && o.pagina > 1) return { itens: [], total: 0 }; // passou do fim
  if (r.status === 400 || r.status === 401 || r.status === 403) throw new Error("A Pixabay recusou a chave. Confira se colou certo.");
  if (r.status === 429) throw new Error("Muitas buscas seguidas. Espere um minuto.");
  if (!r.ok) throw new Error(`A Pixabay não respondeu (${r.status}).`);
  const d = (await r.json()) as { totalHits?: number; hits?: (HitFoto & HitVideo)[] };
  const itens = (d.hits ?? []).map((x): ItemMidia => {
    if (video) {
      const v = x.videos.large?.url ? x.videos.large : x.videos.medium ?? x.videos.small ?? x.videos.tiny;
      return {
        id: `pv-${x.id}`, titulo: x.tags, tipo: "video", autor: x.user, pagina: x.pageURL, duracao: x.duration, fonte: "Pixabay",
        miniatura: x.videos.medium?.thumbnail ?? x.videos.tiny?.thumbnail ?? "", previa: x.videos.tiny?.url ?? x.videos.small?.url,
        url: v?.url ?? "", largura: v?.width ?? 0, altura: v?.height ?? 0,
      };
    }
    return { id: `pi-${x.id}`, titulo: x.tags, tipo: "foto", autor: x.user, pagina: x.pageURL, duracao: 0, fonte: "Pixabay", miniatura: x.webformatURL, url: x.largeImageURL, largura: x.imageWidth, altura: x.imageHeight };
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

/** Domínios de onde o Banco de mídia pode baixar/mostrar: Pixabay, GIPHY e os emojis animados do Google. */
export function urlMidiaValida(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    if (urlPixabayValida(raw)) return true;
    if (/^(media\d?|i)\.giphy\.com$/.test(u.hostname)) return true;
    return u.hostname === "fonts.gstatic.com" && u.pathname.startsWith("/s/e/notoemoji/");
  } catch {
    return false;
  }
}
