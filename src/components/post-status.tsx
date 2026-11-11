import { cn } from "@/lib/utils";
import type { PostStatus } from "@/db/schema";

export const POST_STATUS: Record<PostStatus, { label: string; cls: string }> = {
  RASCUNHO: { label: "Rascunho", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  AGUARDANDO_APROVACAO: { label: "Aguardando aprovação", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  AGENDADO: { label: "Agendado", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  PUBLICANDO: { label: "Publicando…", cls: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300" },
  PUBLICADO: { label: "Publicado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  FALHOU: { label: "Falhou", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

export function PostStatusBadge({ status }: { status: PostStatus }) {
  const s = POST_STATUS[status];
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", s.cls)}>{s.label}</span>;
}

export const CHANNEL_LABEL = { INSTAGRAM: "Instagram", TIKTOK: "TikTok", YOUTUBE: "YouTube" } as const;
