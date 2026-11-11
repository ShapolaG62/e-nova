"use client";

import { startTransition, useActionState, useState } from "react";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { EmailState, ScriptState } from "@/app/actions/ai";

type Opt = { id: string; name: string };
const sel = "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm sm:h-9 dark:bg-input/30";

type BaseState = { ok?: boolean; message?: string; errors?: Record<string, string[] | undefined> };

function useForm<S extends BaseState>(action: (prev: S, form: FormData) => Promise<S>) {
  const [state, run, pending] = useActionState<S, FormData>(action, {} as Awaited<S>);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => run(data));
  };
  const err = (n: string) => state.errors?.[n]?.[0] && <p className="text-xs text-destructive">{state.errors[n]![0]}</p>;
  return { state, pending, onSubmit, err };
}

export function CopyText({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {ok ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />} {ok ? "Copiado" : label}
    </button>
  );
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Submit({ pending, disabled }: { pending: boolean; disabled: boolean }) {
  return (
    <Button type="submit" disabled={pending || disabled} className="h-10 sm:h-9">
      {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {pending ? "Gerando… (até 1 min)" : "Gerar com IA"}
    </Button>
  );
}

export function ScriptStudio({ action, clients, aiEnabled }: { action: (p: ScriptState, f: FormData) => Promise<ScriptState>; clients: Opt[]; aiEnabled: boolean }) {
  const { state, pending, onSubmit, err } = useForm(action);
  const r = state.result;
  const full = r
    ? [
        `HOOK: ${r.hook}`,
        ...r.scenes.map((s) => `[${s.seconds}] ${s.visual}\nTela: ${s.onScreenText}\nFala: ${s.voiceover}`),
        `CTA: ${r.cta}`,
        "",
        r.caption,
        r.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" "),
      ].join("\n\n")
    : "";

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
      <form onSubmit={onSubmit} className="grid content-start gap-3 rounded-xl border bg-card p-4">
        <F label="Cliente (opcional)">
          <select name="clientId" className={sel} defaultValue="">
            <option value="">— Agência —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </F>
        <F label="Tema do vídeo">
          <Textarea name="theme" rows={3} placeholder="Ex.: 3 erros ao escolher um corte de cabelo para o verão" />
          {err("theme")}
        </F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Nicho">
            <Input name="niche" placeholder="Barbearia" className="h-10 sm:h-9" />
            {err("niche")}
          </F>
          <F label="Tom de voz">
            <Input name="tone" placeholder="Descontraído" className="h-10 sm:h-9" />
            {err("tone")}
          </F>
          <F label="Plataforma">
            <select name="platform" className={sel} defaultValue="Todas">
              {["Todas", "Reels", "TikTok", "Shorts"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </F>
          <F label="Duração (s)">
            <Input name="durationSec" type="number" defaultValue={30} min={10} max={180} className="h-10 sm:h-9" />
          </F>
        </div>
        <F label="CTA desejada">
          <Input name="cta" placeholder="Agende pelo link da bio" className="h-10 sm:h-9" />
          {err("cta")}
        </F>
        {state.message && !state.ok && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>}
        <Submit pending={pending} disabled={!aiEnabled} />
      </form>

      <div className="min-w-0 rounded-xl border bg-card p-4">
        {!r ? (
          <p className="text-sm text-muted-foreground">O roteiro aparece aqui: Hook + cenas + CTA, legenda e hashtags.</p>
        ) : (
          <div className="grid gap-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{r.title}</h3>
              <CopyText text={full} label="Copiar tudo" />
            </div>
            <div className="rounded-lg bg-primary/10 p-3">
              <p className="text-xs font-semibold text-primary uppercase">Hook</p>
              <p className="text-sm">{r.hook}</p>
            </div>
            <ol className="grid gap-2">
              {r.scenes.map((s, i) => (
                <li key={i} className="rounded-lg border p-3 text-sm">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    {s.seconds} · {s.visual}
                  </p>
                  <p>
                    <span className="font-medium">Tela:</span> {s.onScreenText}
                  </p>
                  <p>
                    <span className="font-medium">Fala:</span> {s.voiceover}
                  </p>
                </li>
              ))}
            </ol>
            <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950">
              <p className="text-xs font-semibold text-emerald-700 uppercase dark:text-emerald-300">CTA</p>
              <p className="text-sm">{r.cta}</p>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Legenda</p>
                <CopyText text={`${r.caption}\n\n${r.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`} />
              </div>
              <p className="text-sm whitespace-pre-line">{r.caption}</p>
              <p className="mt-2 text-sm break-words text-primary">{r.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EmailStudio({ action, clients, aiEnabled }: { action: (p: EmailState, f: FormData) => Promise<EmailState>; clients: Opt[]; aiEnabled: boolean }) {
  const { state, pending, onSubmit, err } = useForm(action);
  const r = state.result;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
      <form onSubmit={onSubmit} className="grid content-start gap-3 rounded-xl border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <F label="Tipo">
            <select name="type" className={sel} defaultValue="COLD_B2B">
              <option value="COLD_B2B">Cold e-mail B2B</option>
              <option value="NEWSLETTER">Newsletter</option>
            </select>
          </F>
          <F label="Tom">
            <Input name="tone" placeholder="Consultivo" className="h-10 sm:h-9" />
            {err("tone")}
          </F>
        </div>
        <F label="Cliente (opcional)">
          <select name="clientId" className={sel} defaultValue="">
            <option value="">— Agência —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </F>
        <F label="Público">
          <Input name="audience" placeholder="Donos de clínicas odontológicas em Campinas" className="h-10 sm:h-9" />
          {err("audience")}
        </F>
        <F label="Oferta / assunto">
          <Textarea name="offer" rows={3} placeholder="Plaquinhas NFC que aumentam avaliações no Google, com relatório mensal" />
          {err("offer")}
        </F>
        <F label="Nome de quem assina">
          <Input name="senderName" placeholder="Gabriel — E-Nova" className="h-10 sm:h-9" />
          {err("senderName")}
        </F>
        {state.message && !state.ok && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.message}</p>}
        <Submit pending={pending} disabled={!aiEnabled} />
      </form>

      <div className="min-w-0 rounded-xl border bg-card p-4">
        {!r ? (
          <p className="text-sm text-muted-foreground">O e-mail aparece aqui, com 3 opções de assunto e follow-ups.</p>
        ) : (
          <div className="grid gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Assuntos</p>
              <ul className="grid gap-1">
                {r.subjectLines.map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm">
                    <span className="min-w-0">{s}</span>
                    <CopyText text={s} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Pré-cabeçalho: {r.preheader}</p>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Corpo</p>
                <CopyText text={r.body} />
              </div>
              <pre className="rounded-lg bg-muted/60 p-3 font-sans text-sm whitespace-pre-wrap">{r.body}</pre>
            </div>
            {r.followUps.map((f, i) => (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Follow-up {i + 1} · após {f.afterDays} dias
                  </p>
                  <CopyText text={`${f.subject}\n\n${f.body}`} />
                </div>
                <pre className="rounded-lg border p-3 font-sans text-sm whitespace-pre-wrap">
                  <strong>{f.subject}</strong>
                  {"\n\n"}
                  {f.body}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
