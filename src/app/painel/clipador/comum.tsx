import Link from "next/link";
import type { CanalVigiado, VideoVigiado } from "@/db/schema";
import { Repostar } from "./botoes";

// Partes do Clipador usadas na lista, no cadastro e na página de cada perfil.

export const sel = "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-9 dark:bg-input/30";
export const quando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const PLATAFORMA: Record<string, string> = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram" };
const REDES = [["INSTAGRAM", "Instagram (Reels)"], ["TIKTOK", "TikTok"], ["YOUTUBE", "YouTube (Shorts)"]] as const;
export const COR: Record<string, string> = {
  POSTADO: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", POSTANDO: "bg-signal/15 text-foreground", PRONTO: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  BAIXANDO: "bg-signal/15 text-foreground", NOVO: "bg-signal/15 text-foreground", FALHOU: "bg-destructive/15 text-destructive", IGNORADO: "bg-muted text-muted-foreground",
};
export const NOME_STATUS: Record<string, string> = { POSTADO: "Postado", POSTANDO: "Postando", PRONTO: "Para revisar", BAIXANDO: "Processando", NOVO: "Na fila", FALHOU: "Falhou", IGNORADO: "Não repostado" };

export function SeloPlataforma({ p }: { p: string }) {
  return <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium">{PLATAFORMA[p] ?? p}</span>;
}

export function Opcoes({ c }: { c?: CanalVigiado }) {
  return (
    <>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-sm font-medium">Postar em</legend>
        {REDES.map(([v, nome]) => (
          <label key={v} className="flex min-h-9 items-center gap-2.5 text-sm">
            <input type="checkbox" name="destinos" value={v} defaultChecked={c ? c.destinos.includes(v) : true} className="size-4 accent-[var(--primary)]" /> {nome}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Formato dos vídeos</span>
          <select name="tipos" defaultValue={c?.tipos ?? "vertical"} className={sel}>
            <option value="vertical">Só verticais 9:16 (Shorts, Reels, TikTok)</option><option value="horizontal">Só horizontais 16:9</option><option value="ambos">9:16 e 16:9</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">Legenda</span>
          <select name="legenda" defaultValue={c?.legenda ?? "ia"} className={sel}>
            <option value="ia">Nova, escrita pela IA a partir do vídeo</option><option value="original">A mesma do vídeo original</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2"><span className="font-medium">Quando postar</span>
          <select name="aprovacao" defaultValue={c?.aprovacao ?? "automatico"} className={sel}>
            <option value="automatico">Automático, assim que ficar pronto</option><option value="revisar">Deixar pronto para eu revisar em Publicações</option>
          </select>
        </label>
      </div>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="creditar" defaultChecked={c?.creditar ?? true} className="mt-0.5 size-4 accent-[var(--primary)]" />
        <span>Dar crédito ao perfil original na legenda <span className="text-muted-foreground">(recomendado em programas de clipadores)</span></span>
      </label>
    </>
  );
}

export function Video({ v, plataforma }: { v: VideoVigiado; plataforma: string }) {
  const link = v.link ?? (v.ehShort ? `https://youtube.com/shorts/${v.videoId}` : `https://youtube.com/watch?v=${v.videoId}`);
  return (
    <li className="flex gap-3 rounded-xl border p-2">
      <a href={link} target="_blank" rel="noreferrer" className="shrink-0" aria-label={`Abrir o original no ${PLATAFORMA[plataforma] ?? "site"}`}>
        {plataforma === "youtube"
          ? <img src={`https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`} alt="" loading="lazy" className="h-14 w-24 rounded-md bg-muted object-cover" />
          : <span className="grid h-14 w-24 place-items-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">{PLATAFORMA[plataforma]}</span>}
      </a>
      <div className="grid min-w-0 flex-1 content-start gap-1">
        <p className="line-clamp-2 text-sm font-medium">{v.titulo}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-medium ${COR[v.status] ?? ""}`}>{NOME_STATUS[v.status] ?? v.status}</span>
          <span className="text-muted-foreground">{v.ehShort ? "9:16" : "16:9"}{v.publicadoEm ? ` · ${quando.format(v.publicadoEm)}` : ""}</span>
        </div>
        {(v.erro || v.etapa) && <p className={`text-xs ${v.status === "FALHOU" ? "text-destructive" : "text-muted-foreground"}`}>{v.status === "FALHOU" ? v.erro ?? v.etapa : v.etapa}</p>}
        <div className="flex flex-wrap gap-1.5">
          {(v.status === "IGNORADO" || v.status === "FALHOU") && <Repostar id={v.id} texto={v.status === "FALHOU" ? "Tentar de novo" : "Repostar este"} />}
          {v.postId && <Link href="/painel/conteudo" className="inline-flex h-10 items-center rounded-lg border px-3 text-xs font-medium hover:bg-muted sm:h-9">Ver em Publicações</Link>}
        </div>
      </div>
    </li>
  );
}
