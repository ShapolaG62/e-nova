"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { canAccessClient, requirePermission } from "@/lib/auth/session";
import { AiError } from "@/lib/ai/client";
import { summarizeReport } from "@/lib/ai/tasks";
import { monthlyReport, monthLabel } from "@/lib/reports";
import type { ActionState } from "@/lib/validation";

export async function generateReportSummaryAction(clientId: string, month: string): Promise<ActionState> {
  const user = await requirePermission("ai:use");
  if (!canAccessClient(user, clientId) || !/^\d{4}-\d{2}$/.test(month)) return { ok: false, message: "Relatório inválido." };
  const client = await db.query.clients.findFirst({ where: eq(t.clients.id, clientId), columns: { tradeName: true } });
  if (!client) return { ok: false, message: "Cliente não encontrado." };
  const report = await monthlyReport(clientId, month);
  try {
    await summarizeReport({
      business: client.tradeName,
      month: monthLabel(month),
      metrics: { mesAtual: report.current, mesAnterior: report.previous },
      clientId,
      userId: user.id,
    });
  } catch (e) {
    return { ok: false, message: e instanceof AiError ? e.userMessage : "Falha ao gerar o resumo." };
  }
  revalidatePath(`/painel/relatorios/${clientId}`);
  return { ok: true, message: "Resumo gerado." };
}
