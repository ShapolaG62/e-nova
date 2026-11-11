"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { adicionarLicao, apagarLicao, registrar, resumir, zerarAjustes, type Area } from "@/lib/aprendizado";
import type { ActionState } from "@/lib/validation";

const area = z.enum(["cortes", "videos"]);
const alvo = z.string().uuid();

/** 👍 / 👎 da equipe num corte ou num vídeo gerado. */
export async function avaliarAction(a: Area, alvoId: string, nota: 1 | -1, motivo?: string): Promise<ActionState> {
  const me = await requirePermission("ai:use");
  if (!area.safeParse(a).success || !alvo.safeParse(alvoId).success || (nota !== 1 && nota !== -1)) return { ok: false, message: "Avaliação inválida." };
  await registrar(a, alvoId, nota === 1 ? "curtiu" : "nao-curtiu", { userId: me.id, dados: motivo ? { motivo: motivo.slice(0, 300) } : {} });
  revalidatePath(a === "cortes" ? "/painel/cortes" : "/painel/gerador", "layout");
  return { ok: true, message: nota === 1 ? "Anotado: a ferramenta vai buscar mais desse jeito." : "Anotado: a ferramenta vai evitar isso." };
}

export async function apagarLicaoAction(a: Area, id: string): Promise<ActionState> {
  const me = await requirePermission("system:view");
  if (!area.safeParse(a).success) return { ok: false };
  await apagarLicao(a, id.slice(0, 20));
  await audit(me, "aprendizado.licao.apagar", { entity: "aprendizado", entityId: a });
  revalidatePath("/painel/aprendizado");
  return { ok: true, message: "Lição apagada. A IA não vai recriá-la." };
}

export async function adicionarLicaoAction(a: Area, texto: string): Promise<ActionState> {
  const me = await requirePermission("system:view");
  const tx = texto.trim();
  if (!area.safeParse(a).success || tx.length < 8 || tx.length > 220) return { ok: false, message: "Escreva a lição em uma frase (8 a 220 caracteres)." };
  await adicionarLicao(a, tx);
  await audit(me, "aprendizado.licao.adicionar", { entity: "aprendizado", entityId: a });
  revalidatePath("/painel/aprendizado");
  return { ok: true, message: "Lição adicionada. Vale a partir do próximo corte/vídeo." };
}

export async function reaprenderAction(a: Area): Promise<ActionState> {
  await requirePermission("system:view");
  if (!area.safeParse(a).success) return { ok: false };
  await resumir(a);
  revalidatePath("/painel/aprendizado");
  return { ok: true, message: "Lições atualizadas com os sinais mais recentes." };
}

export async function zerarAjustesAction(a: Area): Promise<ActionState> {
  const me = await requirePermission("system:view");
  if (!area.safeParse(a).success) return { ok: false };
  await zerarAjustes(a);
  await audit(me, "aprendizado.zerar", { entity: "aprendizado", entityId: a });
  revalidatePath("/painel/aprendizado");
  return { ok: true, message: "Ajustes numéricos voltaram ao padrão." };
}
