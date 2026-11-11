"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Assistente público (aberto pela plaquinha). O cliente escolhe a nota e o que
 * gostou; a IA sugere um texto que ele PODE editar. Qualquer nota segue para o
 * Google — não filtramos avaliações negativas (isso viola a política do Google).
 */
export function ReviewAssistant(props: { slug: string; business: string; logoUrl: string | null; tags: string[]; googleUrl: string; aiEnabled: boolean }) {
  const [stars, setStars] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggle = (tag: string) => setPicked((p) => (p.includes(tag) ? p.filter((x) => x !== tag) : p.length < 8 ? [...p, tag] : p));

  async function suggest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/avaliar/${props.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars, tags: picked }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível sugerir agora.");
      setSuggestions(json.suggestions);
      setText(json.suggestions[0] ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível sugerir agora.");
    } finally {
      setLoading(false);
    }
  }

  async function goToGoogle() {
    if (text.trim()) {
      try {
        await navigator.clipboard.writeText(text.trim());
        setCopied(true);
      } catch {
        /* sem permissão de clipboard: segue mesmo assim */
      }
    }
    setTimeout(() => (window.location.href = props.googleUrl), text.trim() ? 700 : 0);
  }

  return (
    <div className="rounded-2xl border bg-background p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        {props.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo externo do cliente
          <img src={props.logoUrl} alt="" className="size-12 rounded-xl border object-contain" />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">{props.business[0]}</div>
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Como foi sua experiência no</p>
          <h1 className="truncate text-lg font-semibold">{props.business}?</h1>
        </div>
      </div>

      <p className="mb-2 text-sm font-medium">Sua nota</p>
      <div className="mb-5 flex gap-1" role="radiogroup" aria-label="Nota de 1 a 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={stars === n}
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            onClick={() => setStars(n)}
            className="rounded-md p-1 transition-transform active:scale-90"
          >
            <Star className={cn("size-9", n <= stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
          </button>
        ))}
      </div>

      {props.aiEnabled && stars > 0 && (
        <>
          <p className="mb-2 text-sm font-medium">O que marcou sua visita? <span className="font-normal text-muted-foreground">(opcional)</span></p>
          <div className="mb-4 flex flex-wrap gap-2">
            {props.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                aria-pressed={picked.includes(tag)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  picked.includes(tag) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {tag}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={suggest}
            disabled={!picked.length || loading}
            className="mb-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 text-sm font-medium text-primary disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {suggestions.length ? "Sugerir outros textos" : "Me ajude a escrever"}
          </button>
        </>
      )}

      {error && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{error}</p>}

      {suggestions.length > 0 && (
        <div className="mb-4 grid gap-2">
          <div className="flex gap-1.5">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setText(s)}
                className={cn("flex-1 rounded-lg border py-1.5 text-xs", text === s ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground")}
              >
                Opção {i + 1}
              </button>
            ))}
          </div>
          <label className="text-xs text-muted-foreground" htmlFor="review-text">
            É só uma sugestão — edite com suas palavras:
          </label>
          <textarea
            id="review-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="w-full rounded-xl border bg-transparent p-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      )}

      <button
        type="button"
        onClick={goToGoogle}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-medium text-primary-foreground disabled:opacity-50"
      >
        {copied ? <Check className="size-5" /> : text.trim() ? <Copy className="size-5" /> : <ExternalLink className="size-5" />}
        {copied ? "Texto copiado! Abrindo o Google…" : text.trim() ? "Copiar texto e avaliar no Google" : "Avaliar no Google"}
      </button>
      {text.trim() && !copied && <p className="mt-2 text-center text-xs text-muted-foreground">No Google, toque no campo de texto e cole.</p>}
    </div>
  );
}
