"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Image as ImageIcon, Link2, Loader2, MapPin, MessageCircle, MousePointerClick, Plus, Save, Star, Trash2, Type, Video, X } from "lucide-react";
import { toast } from "sonner";
import type { PageBlock } from "@/db/schema";
import { newBlockId, type PageContent } from "@/lib/pages";
import { PageRenderer } from "@/components/page-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/validation";

const KINDS = [
  { type: "hero", label: "Título", icon: Type },
  { type: "text", label: "Texto", icon: Type },
  { type: "button", label: "Botão", icon: MousePointerClick },
  { type: "links", label: "Lista de links", icon: Link2 },
  { type: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { type: "review", label: "Avaliação", icon: Star },
  { type: "image", label: "Imagem", icon: ImageIcon },
  { type: "video", label: "Vídeo", icon: Video },
  { type: "map", label: "Mapa", icon: MapPin },
] as const;

function blank(type: PageBlock["type"], plates: { slug: string }[]): PageBlock {
  const id = newBlockId();
  switch (type) {
    case "hero":
      return { id, type, title: "Título", subtitle: "" };
    case "text":
      return { id, type, body: "" };
    case "button":
      return { id, type, label: "Saiba mais", url: "https://", style: "solid" };
    case "links":
      return { id, type, items: [{ id: newBlockId(), label: "Link", url: "https://" }] };
    case "whatsapp":
      return { id, type, phone: "55", label: "Chamar no WhatsApp" };
    case "review":
      return { id, type, plateSlug: plates[0]?.slug ?? "", label: "Avalie a gente no Google" };
    case "image":
      return { id, type, url: "https://", alt: "" };
    case "video":
      return { id, type, url: "https://www.youtube.com/watch?v=" };
    case "map":
      return { id, type, query: "" };
  }
}

const PALETTES = [
  { accent: "#0b8f8c", background: "#f4f7f6" },
  { accent: "#c2410c", background: "#fff7ed" },
  { accent: "#7c3aed", background: "#f5f3ff" },
  { accent: "#be185d", background: "#fdf2f8" },
  { accent: "#15803d", background: "#f0fdf4" },
  { accent: "#1d4ed8", background: "#eff6ff" },
  { accent: "#111827", background: "#ffffff" },
];

export function PageEditor({
  initial,
  save,
  plates,
}: {
  initial: PageContent;
  save: (content: unknown) => Promise<ActionState>;
  plates: { slug: string; label: string }[];
}) {
  const [content, setContent] = useState<PageContent>(initial);
  const [selected, setSelected] = useState<string | null>(initial.blocks[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<"editar" | "ver">("editar");
  const [pending, start] = useTransition();

  const update = (fn: (c: PageContent) => PageContent) => {
    setContent((c) => fn(c));
    setDirty(true);
  };
  const setBlock = (id: string, patch: Partial<PageBlock>) =>
    update((c) => ({ ...c, blocks: c.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as PageBlock) : b)) }));
  const move = (i: number, dir: -1 | 1) =>
    update((c) => {
      const blocks = [...c.blocks];
      const j = i + dir;
      if (j < 0 || j >= blocks.length) return c;
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...c, blocks };
    });

  function onSave() {
    start(async () => {
      const r = await save(content);
      if (r.ok) {
        toast.success(r.message ?? "Salvo");
        setDirty(false);
      } else toast.error(r.message ?? "Não foi possível salvar");
    });
  }

  const sel = content.blocks.find((b) => b.id === selected);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
      {/* Celular: alterna entre editar e pré-visualizar */}
      <div className="flex gap-1 rounded-xl bg-muted p-1 lg:hidden">
        {(["editar", "ver"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={cn("flex-1 rounded-lg py-2 text-sm", view === v ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
            {v === "editar" ? "Editar" : "Pré-visualizar"}
          </button>
        ))}
      </div>

      <div className={cn("grid content-start gap-4", view === "ver" && "max-lg:hidden")}>
        <div className="grid gap-3 rounded-2xl border bg-card p-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Título da página (aparece na aba e no Google)
            <Input value={content.title} onChange={(e) => update((c) => ({ ...c, title: e.target.value }))} className="h-10" />
          </label>
          <div className="grid gap-1.5">
            <p className="text-sm font-medium">Cores</p>
            <div className="flex flex-wrap gap-2">
              {PALETTES.map((p) => {
                const on = p.accent === content.theme.accent && p.background === content.theme.background;
                return (
                  <button
                    key={p.accent}
                    type="button"
                    aria-label={`Paleta ${p.accent}`}
                    aria-pressed={on}
                    onClick={() => update((c) => ({ ...c, theme: { ...c.theme, ...p } }))}
                    className={cn("size-9 rounded-full ring-offset-2 ring-offset-card", on ? "ring-2 ring-foreground" : "ring-1 ring-border")}
                    style={{ background: `linear-gradient(135deg, ${p.background} 50%, ${p.accent} 50%)` }}
                  />
                );
              })}
            </div>
          </div>
          <div className="flex gap-1 rounded-xl bg-muted p-1">
            {(["moderna", "classica", "arredondada"] as const).map((f) => (
              <button key={f} type="button" onClick={() => update((c) => ({ ...c, theme: { ...c.theme, font: f } }))} className={cn("flex-1 rounded-lg py-1.5 text-sm capitalize", content.theme.font === f ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
                {f === "classica" ? "Clássica" : f}
              </button>
            ))}
          </div>
        </div>

        <ol className="grid gap-2">
          {content.blocks.map((b, i) => {
            const kind = KINDS.find((k) => k.type === b.type)!;
            const Icon = kind.icon;
            const open = b.id === selected;
            return (
              <li key={b.id} className={cn("rounded-2xl border bg-card", open && "border-primary/50 ring-1 ring-primary/20")}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <button type="button" onClick={() => setSelected(open ? null : b.id)} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left">
                    <Icon className="size-4 shrink-0 text-primary" />
                    <span className="text-sm font-medium">{kind.label}</span>
                    <span className="truncate text-xs text-muted-foreground">{summary(b)}</span>
                  </button>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 hover:bg-muted disabled:opacity-30" aria-label="Subir">
                    <ArrowUp className="size-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === content.blocks.length - 1} className="rounded p-1.5 hover:bg-muted disabled:opacity-30" aria-label="Descer">
                    <ArrowDown className="size-4" />
                  </button>
                  <button type="button" onClick={() => update((c) => ({ ...c, blocks: c.blocks.filter((x) => x.id !== b.id) }))} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Remover bloco">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {open && sel && <div className="border-t px-3 py-3">{fields(sel, setBlock, plates)}</div>}
              </li>
            );
          })}
        </ol>

        <div className="rounded-2xl border border-dashed p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <Plus className="size-4" /> Adicionar bloco
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {KINDS.map((k) => (
              <button
                key={k.type}
                type="button"
                onClick={() => {
                  const b = blank(k.type, plates);
                  update((c) => ({ ...c, blocks: [...c.blocks, b] }));
                  setSelected(b.id);
                }}
                className="flex flex-col items-center gap-1 rounded-xl bg-card px-1 py-2.5 text-xs ring-1 ring-border hover:ring-primary/50"
              >
                <k.icon className="size-4 text-primary" /> {k.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={cn("lg:sticky lg:top-6 lg:self-start", view === "editar" && "max-lg:hidden")}>
        <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[2.2rem] border-[10px] border-ink bg-ink shadow-xl">
          <div className="h-[640px] overflow-y-auto rounded-[1.5rem] bg-white">
            <PageRenderer title={content.title} theme={content.theme} blocks={content.blocks} linkFor={(_, url) => url} />
          </div>
        </div>
      </div>

      {/* Barra de salvar fixa (acima das abas no celular) */}
      <div className="fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4 md:bottom-6 md:left-[248px]">
        <Button onClick={onSave} disabled={!dirty || pending} className="h-12 rounded-full px-6 shadow-lg">
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {dirty ? "Salvar alterações" : "Tudo salvo"}
        </Button>
      </div>
    </div>
  );
}

function summary(b: PageBlock): string {
  switch (b.type) {
    case "hero":
      return b.title;
    case "text":
      return b.body.slice(0, 40);
    case "button":
      return b.label;
    case "links":
      return `${b.items.length} links`;
    case "whatsapp":
      return b.phone;
    case "review":
      return `/r/${b.plateSlug}`;
    case "image":
      return b.alt || b.url;
    case "video":
      return b.url;
    case "map":
      return b.query;
  }
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function fields(b: PageBlock, set: (id: string, p: Partial<PageBlock>) => void, plates: { slug: string; label: string }[]) {
  const inp = "h-10 text-sm text-foreground";
  switch (b.type) {
    case "hero":
      return (
        <div className="grid gap-2">
          <F label="Título">
            <Input className={inp} value={b.title} onChange={(e) => set(b.id, { title: e.target.value })} />
          </F>
          <F label="Subtítulo">
            <Input className={inp} value={b.subtitle ?? ""} onChange={(e) => set(b.id, { subtitle: e.target.value })} />
          </F>
          <F label="Foto/logo (link https)">
            <Input className={inp} value={b.imageUrl ?? ""} onChange={(e) => set(b.id, { imageUrl: e.target.value })} placeholder="https://…" />
          </F>
        </div>
      );
    case "text":
      return (
        <F label="Texto">
          <Textarea rows={4} className="text-sm text-foreground" value={b.body} onChange={(e) => set(b.id, { body: e.target.value })} />
        </F>
      );
    case "button":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <F label="Texto do botão">
            <Input className={inp} value={b.label} onChange={(e) => set(b.id, { label: e.target.value })} />
          </F>
          <F label="Link">
            <Input className={inp} value={b.url} onChange={(e) => set(b.id, { url: e.target.value })} />
          </F>
          <F label="Estilo">
            <select className="h-10 rounded-lg border bg-card px-2 text-sm text-foreground" value={b.style ?? "solid"} onChange={(e) => set(b.id, { style: e.target.value as "solid" })}>
              <option value="solid">Preenchido</option>
              <option value="outline">Contorno</option>
            </select>
          </F>
        </div>
      );
    case "links":
      return (
        <div className="grid gap-2">
          {b.items.map((it, i) => (
            <div key={it.id} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
              <Input className={inp} value={it.label} placeholder="Texto" onChange={(e) => set(b.id, { items: b.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <Input className={inp} value={it.url} placeholder="https://" onChange={(e) => set(b.id, { items: b.items.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
              <button type="button" onClick={() => set(b.id, { items: b.items.filter((_, j) => j !== i) })} className="rounded p-2 text-muted-foreground hover:text-destructive" aria-label="Remover link">
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => set(b.id, { items: [...b.items, { id: newBlockId(), label: "Link", url: "https://" }] })} className="justify-self-start text-sm font-medium text-primary">
            + Adicionar link
          </button>
        </div>
      );
    case "whatsapp":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <F label="Número com DDI e DDD">
            <Input className={inp} inputMode="numeric" value={b.phone} onChange={(e) => set(b.id, { phone: e.target.value.replace(/\D/g, "") })} placeholder="5511999999999" />
          </F>
          <F label="Texto do botão">
            <Input className={inp} value={b.label ?? ""} onChange={(e) => set(b.id, { label: e.target.value })} />
          </F>
          <F label="Mensagem pronta (opcional)">
            <Input className={inp} value={b.message ?? ""} onChange={(e) => set(b.id, { message: e.target.value })} />
          </F>
        </div>
      );
    case "review":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <F label="Plaquinha (conta como toque)">
            <select className="h-10 rounded-lg border bg-card px-2 text-sm text-foreground" value={b.plateSlug} onChange={(e) => set(b.id, { plateSlug: e.target.value })}>
              {plates.length === 0 && <option value="">Este cliente não tem plaquinha</option>}
              {plates.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label} (/r/{p.slug})
                </option>
              ))}
            </select>
          </F>
          <F label="Texto do botão">
            <Input className={inp} value={b.label ?? ""} onChange={(e) => set(b.id, { label: e.target.value })} />
          </F>
        </div>
      );
    case "image":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <F label="Link da imagem (https)">
            <Input className={inp} value={b.url} onChange={(e) => set(b.id, { url: e.target.value })} />
          </F>
          <F label="Descrição (acessibilidade)">
            <Input className={inp} value={b.alt} onChange={(e) => set(b.id, { alt: e.target.value })} />
          </F>
        </div>
      );
    case "video":
      return (
        <F label="Link do YouTube ou Vimeo">
          <Input className={inp} value={b.url} onChange={(e) => set(b.id, { url: e.target.value })} />
        </F>
      );
    case "map":
      return (
        <F label="Endereço">
          <Input className={inp} value={b.query} onChange={(e) => set(b.id, { query: e.target.value })} placeholder="Rua, número, cidade" />
        </F>
      );
  }
}
