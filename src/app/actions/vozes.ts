"use server";

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/cache";
import { apagarUpload, arquivoDoUpload } from "@/lib/ferramentas/arquivos";
import { apagarVoz, criarVoz, prepararAmostra, salvarAmostra, TEXTO_CONSENTIMENTO } from "@/lib/voz";
import type { ActionState } from "@/lib/validation";

const novaSchema = z.object({
  nome: z.string().trim().min(2, "Dê um nome para a voz.").max(60),
  enviadoId: z.string().min(4).max(80),
  consentimento: z.literal(true, { message: "Confirme que a voz é sua ou que você tem autorização." }),
});

/** Cria a voz: limpa a amostra, guarda e clona na Cartesia (se houver chave). */
export async function criarVozAction(input: z.input<typeof novaSchema>): Promise<ActionState & { id?: string }> {
  const me = await requirePermission("ai:use");
  const p = novaSchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Dados inválidos." };
  if (!(await rateLimit(`vozes:${me.id}`, 10, 3600))) return { ok: false, message: "Muitas vozes criadas em pouco tempo. Tente mais tarde." };
  const dir = await mkdtemp(path.join(os.tmpdir(), "enova-nova-voz-"));
  try {
    const up = await arquivoDoUpload(me.id, p.data.enviadoId);
    const { wav, duracao } = await prepararAmostra(up.caminho, dir);
    if (duracao < 8) return { ok: false, message: `A gravação ficou com ${Math.round(duracao)} s de fala. Grave pelo menos 10 s (o ideal é 30 a 60 s).` };
    const [v] = await db.insert(t.vozes).values({
      nome: p.data.nome, amostraChave: "pendente", duracao,
      consentimento: { texto: TEXTO_CONSENTIMENTO, aceitoEm: new Date().toISOString(), userId: me.id }, userId: me.id,
    }).returning({ id: t.vozes.id });
    const chave = await salvarAmostra(v.id, wav);
    await db.update(t.vozes).set({ amostraChave: chave }).where(eq(t.vozes.id, v.id));
    await criarVoz(v.id);
    await apagarUpload(me.id, p.data.enviadoId).catch(() => {});
    await audit(me, "vozes.criar", { entity: "voz", entityId: v.id, meta: { consentimento: true, duracao: Math.round(duracao) } });
    revalidatePath("/painel/vozes");
    const criada = await db.query.vozes.findFirst({ where: eq(t.vozes.id, v.id) });
    return {
      ok: criada?.status === "PRONTA", id: v.id,
      message: criada?.status === "PRONTA"
        ? `Voz criada com ${Math.round(duracao)} s de amostra${criada.cartesiaId ? " (Cartesia pronta)" : ""}.`
        : `A voz não ficou pronta: ${criada?.cartesiaErro ?? "sem Cartesia e sem o modelo do computador instalado."}`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Não deu para criar a voz." };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Ouve a voz com um texto curto, pela Cartesia, pelo computador ou pela melhor disponível. */
export async function testarVozAction(id: string, texto: string, motor: "auto" | "cartesia" | "local"): Promise<ActionState & { audio?: string; usado?: string }> {
  const me = await requirePermission("ai:use");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Voz inválida." };
  if (!(await rateLimit(`vozes-teste:${me.id}`, 30, 600))) return { ok: false, message: "Muitos testes seguidos. Espere alguns minutos." };
  const tx = texto.trim().slice(0, 400) || "Olá! Esta é a minha voz criada no E-Nova.";
  const { executar, SemProvedor } = await import("@/lib/ia-hub/roteador");
  const somente = motor === "cartesia" ? ["minha-voz-cartesia"] : motor === "local" ? ["minha-voz-local"] : ["minha-voz-cartesia", "minha-voz-local"];
  try {
    const r = await executar("voz", { prompt: tx, voz: `minha:${id}`, idioma: "pt-BR" }, { userId: me.id, somente, timeoutMs: 5 * 60_000 });
    const a = r.arquivos?.[0];
    if (!a?.buffer) return { ok: false, message: "A IA não devolveu áudio." };
    return { ok: true, audio: `data:${a.mime};base64,${a.buffer.toString("base64")}`, usado: r.usado.item === "minha-voz-cartesia" ? "Cartesia" : "Computador" };
  } catch (e) {
    const msg = e instanceof SemProvedor ? e.tentativas.map((x) => x.erro).filter(Boolean).join(" · ") || e.message : e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg.slice(0, 300) };
  }
}

export async function apagarVozAction(id: string): Promise<ActionState> {
  const me = await requirePermission("ai:use");
  const v = /^[0-9a-f-]{36}$/i.test(id) ? await db.query.vozes.findFirst({ where: eq(t.vozes.id, id) }) : null;
  if (!v) return { ok: false, message: "Voz não encontrada." };
  if (v.userId !== me.id && !can(me.role, "system:view")) return { ok: false, message: "Só quem criou a voz pode apagar." };
  await apagarVoz(id);
  await audit(me, "vozes.apagar", { entity: "voz", entityId: id });
  revalidatePath("/painel/vozes");
  return { ok: true, message: "Voz apagada (também na Cartesia)." };
}

/** Tenta de novo a clonagem na Cartesia (ex.: depois de colar a chave). */
export async function reclonarVozAction(id: string): Promise<ActionState> {
  const me = await requirePermission("ai:use");
  const v = /^[0-9a-f-]{36}$/i.test(id) ? await db.query.vozes.findFirst({ where: eq(t.vozes.id, id) }) : null;
  if (!v || (v.userId !== me.id && !can(me.role, "system:view"))) return { ok: false, message: "Voz não encontrada." };
  await criarVoz(id);
  revalidatePath("/painel/vozes");
  const nova = await db.query.vozes.findFirst({ where: eq(t.vozes.id, id) });
  return nova?.cartesiaId ? { ok: true, message: "Voz clonada na Cartesia." } : { ok: false, message: nova?.cartesiaErro ?? "Não deu certo." };
}
