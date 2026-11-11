"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { enqueue } from "@/lib/jobs";
import { setSetting } from "@/lib/settings";

const modelName = z.string().regex(/^[a-z0-9][\w.\-:/]{1,80}$/i, "Nome de modelo inválido");

export async function setAiModelAction(form: FormData) {
  const user = await requirePermission("system:view");
  const model = modelName.safeParse(form.get("model"));
  if (!model.success) return;
  await setSetting("ai.model", model.data);
  await audit(user, "ai.model", { entity: "settings", meta: { model: model.data } });
  revalidatePath("/painel/sistema");
}

export async function pullModelAction(form: FormData) {
  const user = await requirePermission("system:view");
  const model = modelName.safeParse(form.get("model"));
  if (!model.success) return;
  await enqueue("ai.pull", { model: model.data }, { dedupeKey: `pull:${model.data}`, maxAttempts: 1 });
  await audit(user, "ai.pull", { entity: "settings", meta: { model: model.data } });
  revalidatePath("/painel/sistema");
}
