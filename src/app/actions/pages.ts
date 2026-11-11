"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { DEFAULT_THEME, newBlockId, pageContentSchema } from "@/lib/pages";
import { slugify, zodErrors, type ActionState } from "@/lib/validation";

const createSchema = z.object({
  title: z.string().trim().min(2, "Dê um título").max(120),
  slug: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : undefined), z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/, "Endereço: letras minúsculas, números e hífen").optional()),
  clientId: z.preprocess((v) => (v ? v : null), z.uuid().nullable()),
});

export async function createPageAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requirePermission("pages:write");
  const p = createSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return zodErrors(p.error);
  const slug = p.data.slug ?? `${slugify(p.data.title)}-${Math.random().toString(36).slice(2, 6)}`;
  const exists = await db.query.sitePages.findFirst({ where: eq(t.sitePages.slug, slug), columns: { id: true } });
  if (exists) return { ok: false, errors: { slug: ["Esse endereço já está em uso"] } };

  // Começa com um modelo útil (link na bio): título, botões e avaliação
  const [page] = await db
    .insert(t.sitePages)
    .values({
      clientId: p.data.clientId,
      slug,
      title: p.data.title,
      theme: DEFAULT_THEME,
      blocks: [
        { id: newBlockId(), type: "hero", title: p.data.title, subtitle: "Escreva aqui uma frase sobre o negócio" },
        { id: newBlockId(), type: "whatsapp", phone: "5511999999999", label: "Fale com a gente" },
        { id: newBlockId(), type: "links", items: [{ id: newBlockId(), label: "Instagram", url: "https://instagram.com/" }] },
      ],
    })
    .returning({ id: t.sitePages.id });
  await audit(user, "pages.create", { entity: "site_page", entityId: page.id, meta: { slug } });
  redirect(`/painel/paginas/${page.id}`);
}

/** Salva o conteúdo vindo do editor (JSON validado bloco a bloco). */
export async function savePageAction(pageId: string, content: unknown): Promise<ActionState> {
  await requirePermission("pages:write");
  const p = pageContentSchema.safeParse(content);
  if (!p.success) {
    const issue = p.error.issues[0];
    return { ok: false, message: `Confira o bloco ${typeof issue?.path[1] === "number" ? issue.path[1] + 1 : ""}: ${issue?.message ?? "dados inválidos"}` };
  }
  await db.update(t.sitePages).set({ title: p.data.title, description: p.data.description ?? null, theme: p.data.theme, blocks: p.data.blocks }).where(eq(t.sitePages.id, pageId));
  revalidatePath(`/painel/paginas/${pageId}`);
  return { ok: true, message: "Página salva." };
}

export async function setPageStatusAction(form: FormData) {
  const user = await requirePermission("pages:write");
  const id = String(form.get("id"));
  const publish = form.get("publish") === "true";
  await db
    .update(t.sitePages)
    .set({ status: publish ? "PUBLICADA" : "RASCUNHO", ...(publish ? { publishedAt: new Date() } : {}) })
    .where(eq(t.sitePages.id, id));
  await audit(user, publish ? "pages.publish" : "pages.unpublish", { entity: "site_page", entityId: id });
  revalidatePath(`/painel/paginas/${id}`);
  revalidatePath("/painel/paginas");
}

export async function deletePageAction(form: FormData) {
  const user = await requirePermission("pages:write");
  const id = String(form.get("id"));
  await db.delete(t.sitePages).where(eq(t.sitePages.id, id));
  await audit(user, "pages.delete", { entity: "site_page", entityId: id });
  revalidatePath("/painel/paginas");
  redirect("/painel/paginas");
}
