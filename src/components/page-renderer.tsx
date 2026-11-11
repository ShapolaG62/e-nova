import { MapPin, MessageCircle, Star } from "lucide-react";
import type { PageBlock } from "@/db/schema";
import { embedUrl } from "@/lib/pages";

const FONTS = {
  moderna: "var(--font-body), system-ui, sans-serif",
  classica: "Georgia, 'Times New Roman', serif",
  arredondada: "ui-rounded, 'SF Pro Rounded', var(--font-body), sans-serif",
};

/**
 * Renderiza uma página do criador. Usado no preview do editor e na página pública.
 * `linkFor` decide o destino dos botões: no público passa pelo contador de cliques.
 * Tudo é texto estruturado (React escapa) — não existe bloco de HTML livre.
 */
export function PageRenderer({
  title,
  theme,
  blocks,
  linkFor,
}: {
  title: string;
  theme: { accent: string; background: string; font: keyof typeof FONTS };
  blocks: PageBlock[];
  linkFor: (blockId: string, url: string, itemId?: string) => string;
}) {
  const accent = theme.accent;
  return (
    <div style={{ background: theme.background, fontFamily: FONTS[theme.font], color: "#14262a" }} className="min-h-full">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-5 py-8">
        {blocks.length === 0 && <p className="py-16 text-center text-sm opacity-60">{title}: adicione blocos para montar a página.</p>}
        {blocks.map((b) => {
          switch (b.type) {
            case "hero":
              return (
                <header key={b.id} className="grid justify-items-center gap-3 pb-2 text-center">
                  {b.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- imagem externa escolhida pelo cliente
                    <img src={b.imageUrl} alt="" className="size-24 rounded-full object-cover shadow-sm" />
                  )}
                  <h1 className="text-[1.75rem] leading-tight font-bold" style={{ fontFamily: theme.font === "classica" ? FONTS.classica : "var(--font-display)" }}>
                    {b.title}
                  </h1>
                  {b.subtitle && <p className="max-w-xs text-[0.95rem] opacity-75">{b.subtitle}</p>}
                </header>
              );
            case "text":
              return (
                <p key={b.id} className="text-[0.95rem] leading-relaxed whitespace-pre-line">
                  {b.body}
                </p>
              );
            case "button":
              return (
                <a
                  key={b.id}
                  href={linkFor(b.id, b.url)}
                  className="flex min-h-12 items-center justify-center rounded-2xl px-4 text-center font-semibold transition-transform active:scale-[0.98]"
                  style={b.style === "outline" ? { border: `2px solid ${accent}`, color: accent } : { background: accent, color: "#fff" }}
                >
                  {b.label}
                </a>
              );
            case "links":
              return (
                <ul key={b.id} className="grid gap-2.5">
                  {b.items.map((it) => (
                    <li key={it.id}>
                      <a href={linkFor(b.id, it.url, it.id)} className="flex min-h-12 items-center justify-center rounded-2xl bg-white px-4 text-center font-medium shadow-[0_1px_0_rgba(0,0,0,0.06)] ring-1 ring-black/5">
                        {it.label}
                      </a>
                    </li>
                  ))}
                </ul>
              );
            case "image":
              return (
                // eslint-disable-next-line @next/next/no-img-element -- imagem externa escolhida pelo cliente
                <img key={b.id} src={b.url} alt={b.alt} className="w-full rounded-2xl object-cover" loading="lazy" />
              );
            case "video": {
              const src = embedUrl(b.url);
              return src ? (
                <div key={b.id} className="aspect-video overflow-hidden rounded-2xl bg-black">
                  <iframe src={src} title="Vídeo" className="size-full" allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
                </div>
              ) : null;
            }
            case "whatsapp": {
              const url = `https://wa.me/${b.phone}${b.message ? `?text=${encodeURIComponent(b.message)}` : ""}`;
              return (
                <a key={b.id} href={linkFor(b.id, url)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#25d366] px-4 font-semibold text-white">
                  <MessageCircle className="size-5" /> {b.label || "Chamar no WhatsApp"}
                </a>
              );
            }
            case "review":
              return (
                <a
                  key={b.id}
                  href={linkFor(b.id, `/r/${b.plateSlug}`)}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 font-semibold ring-2"
                  style={{ color: "#14262a", ["--tw-ring-color" as string]: "#e9a800" }}
                >
                  <Star className="size-5 fill-[#e9a800] text-[#e9a800]" /> {b.label || "Avalie a gente no Google"}
                </a>
              );
            case "map":
              return (
                <div key={b.id} className="overflow-hidden rounded-2xl ring-1 ring-black/5">
                  <iframe
                    title="Mapa"
                    src={`https://www.google.com/maps?q=${encodeURIComponent(b.query)}&output=embed`}
                    className="aspect-[4/3] w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <p className="flex items-center gap-1.5 bg-white px-3 py-2 text-sm">
                    <MapPin className="size-4" style={{ color: accent }} /> {b.query}
                  </p>
                </div>
              );
          }
        })}
        <p className="pt-6 text-center text-[0.7rem] opacity-40">feito com E-Nova</p>
      </div>
    </div>
  );
}
