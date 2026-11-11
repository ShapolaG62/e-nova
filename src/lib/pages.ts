import { z } from "zod";

/** Links permitidos nas páginas: só esquemas seguros (nada de javascript:, data:…). */
export const safeUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^(https:\/\/|mailto:|tel:)/i.test(v) || /^\/(r|p)\//.test(v), "Use um link https://, mailto: ou tel:");

const id = z.string().regex(/^[a-z0-9]{6,20}$/i);
const short = (max: number) => z.string().trim().max(max);

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ id, type: z.literal("hero"), title: short(120).min(1), subtitle: short(240).optional(), imageUrl: safeUrl.optional().or(z.literal("")) }),
  z.object({ id, type: z.literal("text"), body: short(3000) }),
  z.object({ id, type: z.literal("button"), label: short(60).min(1), url: safeUrl, style: z.enum(["solid", "outline"]).optional() }),
  z.object({ id, type: z.literal("links"), items: z.array(z.object({ id, label: short(60).min(1), url: safeUrl })).max(20) }),
  z.object({ id, type: z.literal("image"), url: safeUrl, alt: short(200) }),
  z.object({ id, type: z.literal("video"), url: safeUrl }),
  z.object({ id, type: z.literal("whatsapp"), phone: z.string().regex(/^\d{10,15}$/, "Telefone com DDI e DDD, só números"), message: short(300).optional(), label: short(60).optional() }),
  z.object({ id, type: z.literal("review"), plateSlug: z.string().regex(/^[a-z0-9-]{3,64}$/, "Escolha uma plaquinha"), label: short(60).optional() }),
  z.object({ id, type: z.literal("map"), query: short(200).min(3) }),
]);

export const themeSchema = z.object({
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  background: z.string().regex(/^#[0-9a-f]{6}$/i),
  font: z.enum(["moderna", "classica", "arredondada"]),
});

export const pageContentSchema = z.object({
  title: short(120).min(1, "Dê um título"),
  description: short(300).optional(),
  theme: themeSchema,
  blocks: z.array(blockSchema).max(40, "Máximo de 40 blocos"),
});

export type PageContent = z.infer<typeof pageContentSchema>;

export const DEFAULT_THEME = { accent: "#0b8f8c", background: "#f4f7f6", font: "moderna" as const };

/** YouTube/Vimeo → URL de incorporação (youtube-nocookie para não rastrear o visitante). */
export function embedUrl(url: string): string | null {
  const yt = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = /vimeo\.com\/(\d+)/.exec(url);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export const newBlockId = () => Math.random().toString(36).slice(2, 12).padEnd(8, "0");
