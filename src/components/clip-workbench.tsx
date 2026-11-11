"use client";

import { useRef, useState } from "react";
import { Download, Loader2, Play, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoreBars, ScoreRing } from "@/components/score-ring";
import { cn } from "@/lib/utils";
import { Avaliar } from "@/components/avaliar";

type ClipView = {
  id: string;
  start: number;
  end: number;
  title: string;
  hook: string | null;
  reason: string | null;
  viralScore: number;
  scores: { gancho: number; emocao: number; valor: number; ritmo: number; energia: number };
  hashtags: string[];
  captions: boolean;
  status: "SUGERIDO" | "RENDERIZANDO" | "PRONTO" | "FALHOU";
  outputUrl: string | null;
  error: string | null;
  nota?: 1 | -1;
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * Bancada de cortes: o vídeo original fica fixo no topo e cada card toca o
 * próprio trecho nele. Ajuste início/fim e gere o vertical 9:16 com legenda.
 */
export function ClipWorkbench({
  sourceUrl,
  clips,
  transcript,
  renderAction,
  toPostAction,
  canPost,
}: {
  sourceUrl: string;
  clips: ClipView[];
  transcript: { start: number; end: number; text: string }[];
  renderAction: (clipId: string, form: FormData) => Promise<void>;
  toPostAction: (form: FormData) => Promise<void>;
  canPost: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const stopAt = useRef<number | null>(null);

  function playRange(id: string, start: number, end: number) {
    const v = video.current;
    if (!v) return;
    stopAt.current = end;
    v.currentTime = start;
    void v.play();
    setPlaying(id);
    v.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="grid content-start gap-4 lg:sticky lg:top-6 lg:self-start">
        <video
          ref={video}
          src={sourceUrl}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-2xl bg-black"
          onTimeUpdate={(e) => {
            const tm = e.currentTarget.currentTime;
            setNow(tm);
            if (stopAt.current !== null && tm >= stopAt.current) {
              e.currentTarget.pause();
              stopAt.current = null;
              setPlaying(null);
            }
          }}
        />
        <details className="rounded-2xl border bg-card p-4 open:pb-2">
          <summary className="cursor-pointer font-display font-semibold">Transcrição</summary>
          <ol className="mt-3 max-h-80 space-y-1.5 overflow-y-auto pr-1 text-sm">
            {transcript.map((s, i) => {
              const active = now >= s.start && now < s.end;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      if (video.current) {
                        stopAt.current = null;
                        video.current.currentTime = s.start;
                        void video.current.play();
                      }
                    }}
                    className={cn("w-full rounded-md px-2 py-1 text-left hover:bg-muted", active && "bg-accent")}
                  >
                    <span className="num mr-2 text-xs text-primary">{mmss(s.start)}</span>
                    {s.text}
                  </button>
                </li>
              );
            })}
          </ol>
        </details>
      </div>

      <ol className="grid content-start gap-4">
        {clips.map((c, i) => (
          <li key={c.id} className={cn("rounded-2xl border bg-card p-4", i === 0 && "border-primary/40 ring-1 ring-primary/20")}>
            <div className="flex gap-4">
              <ScoreRing score={c.viralScore} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {i === 0 ? "Maior chance de viralizar · " : ""}
                  {mmss(c.start)}–{mmss(c.end)} · {Math.round(c.end - c.start)} s
                </p>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="mt-0.5 text-lg leading-snug font-semibold">{c.title}</h3>
                  <Avaliar area="cortes" alvoId={c.id} inicial={c.nota} compacto />
                </div>
                {c.hook && (
                  <p className="mt-1 text-sm">
                    <Sparkles className="mr-1 inline size-3.5 text-[var(--star)]" />
                    {c.hook}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_200px]">
              <div className="grid content-start gap-2">
                {c.reason && <p className="text-sm text-muted-foreground">{c.reason}</p>}
                {c.hashtags.length > 0 && <p className="text-sm break-words text-primary">{c.hashtags.map((h) => `#${h}`).join(" ")}</p>}
              </div>
              <ScoreBars scores={c.scores} />
            </div>

            {c.status === "PRONTO" && c.outputUrl && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl bg-muted/60 p-3 sm:flex-row sm:items-start">
                <video src={c.outputUrl} controls playsInline preload="metadata" className="mx-auto aspect-[9/16] w-40 rounded-lg bg-black" />
                <div className="flex flex-1 flex-col gap-2">
                  <p className="text-sm font-medium">Vertical 9:16 pronto</p>
                  <a href={c.outputUrl} download className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-sm hover:bg-muted">
                    <Download className="size-4" /> Baixar MP4
                  </a>
                  {canPost && (
                    <form action={toPostAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button type="submit" className="h-10 w-full">
                        <Send /> Criar publicação
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            )}
            {c.status === "FALHOU" && c.error && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{c.error}</p>}

            <form action={renderAction.bind(null, c.id)} className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" className="h-10" onClick={() => playRange(c.id, c.start, c.end)}>
                <Play /> {playing === c.id ? "Tocando…" : "Assistir trecho"}
              </Button>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Início (s)
                <input name="start" type="number" step="any" min="0" defaultValue={c.start.toFixed(1)} className="h-10 w-20 rounded-lg border bg-card px-2 text-sm text-foreground" />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Fim (s)
                <input name="end" type="number" step="any" min="0" defaultValue={c.end.toFixed(1)} className="h-10 w-20 rounded-lg border bg-card px-2 text-sm text-foreground" />
              </label>
              <label className="flex h-10 items-center gap-2 text-sm">
                <input type="checkbox" name="captions" defaultChecked={c.captions} className="size-4 accent-[var(--primary)]" /> Legenda
              </label>
              <Button type="submit" disabled={c.status === "RENDERIZANDO"} className="h-10 flex-1 sm:flex-none">
                {c.status === "RENDERIZANDO" ? <Loader2 className="animate-spin" /> : null}
                {c.status === "RENDERIZANDO" ? "Gerando vertical…" : c.status === "PRONTO" ? "Gerar de novo" : "Gerar vertical 9:16"}
              </Button>
            </form>
          </li>
        ))}
      </ol>
    </div>
  );
}
