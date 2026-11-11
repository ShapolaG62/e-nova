"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/cache";
import { setSetting } from "@/lib/settings";
import { googlePlacesKey, registrarTesteGoogle, salvarGooglePlacesKey, salvarVendasConfig } from "@/lib/sites/config";
import { testarChaveGoogle, type ErroGoogle } from "@/lib/sites/google-erros";

type R<T = null> = { ok: true; data: T } | { ok: false; message: string; google?: ErroGoogle };

const chaveSchema = z
  .string()
  .trim()
  .min(20, "A chave parece curta demais. Copie a chave inteira (começa com “AIza”).")
  .max(200)
  .regex(/^[\w-]+$/, "A chave tem caracteres estranhos. Copie de novo, sem espaços.");

function revalidar() {
  revalidatePath("/painel/configuracoes");
  revalidatePath("/painel/prospeccao");
}

/**
 * Testa a chave do Google Maps com uma busca mínima.
 * Sem `chave`, testa a que já está salva e registra o resultado (para o status do painel).
 */
export async function testarGoogleAction(chave?: string): Promise<R<{ final: string }>> {
  const user = await requirePermission("vendas:config");
  if (!(await rateLimit(`gteste:${user.id}`, 15, 600))) return { ok: false, message: "Muitos testes seguidos. Aguarde alguns minutos." };
  let alvo: string;
  if (chave !== undefined) {
    const p = chaveSchema.safeParse(chave);
    if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Chave inválida." };
    alvo = p.data;
  } else {
    const salva = await googlePlacesKey();
    if (!salva) return { ok: false, message: "Nenhuma chave salva. Cole a chave do Google para testar." };
    alvo = salva;
  }
  const r = await testarChaveGoogle(alvo);
  if (chave === undefined) {
    await registrarTesteGoogle(alvo, r);
    revalidar();
  }
  if (!r.ok) return { ok: false, message: r.erro.titulo, google: r.erro };
  return { ok: true, data: { final: alvo.slice(-4) } };
}

/** Testa e salva. Se o teste falhar, só salva com `mesmoAssim` (o status fica "com erro"). */
export async function conectarGoogleAction(chave: string, mesmoAssim = false): Promise<R<{ final: string }>> {
  const user = await requirePermission("vendas:config");
  const p = chaveSchema.safeParse(chave);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Chave inválida." };
  if (!(await rateLimit(`gteste:${user.id}`, 15, 600))) return { ok: false, message: "Muitos testes seguidos. Aguarde alguns minutos." };
  const r = await testarChaveGoogle(p.data);
  if (!r.ok && !mesmoAssim) return { ok: false, message: r.erro.titulo, google: r.erro };
  await salvarGooglePlacesKey(p.data);
  await registrarTesteGoogle(p.data, r);
  await audit(user, "vendas.google.conectar", { meta: { testeOk: r.ok } });
  revalidar();
  if (!r.ok) return { ok: false, message: r.erro.titulo, google: r.erro };
  return { ok: true, data: { final: p.data.slice(-4) } };
}

export async function removerGoogleAction(): Promise<R> {
  const user = await requirePermission("vendas:config");
  await salvarGooglePlacesKey(null);
  await setSetting("vendas.googleTeste", null);
  await audit(user, "vendas.google.remover", {});
  revalidar();
  return { ok: true, data: null };
}

const empresaSchema = z.object({
  seuNome: z.string().trim().max(80),
  suaEmpresa: z.string().trim().max(80),
  metaDiaria: z.coerce.number().int("Use um número inteiro.").min(1, "A meta precisa ser pelo menos 1.").max(500, "No máximo 500 por dia."),
  objetivo: z.string().trim().min(3, "Descreva o objetivo (ex.: agendar uma conversa).").max(120),
});

export async function salvarEmpresaAction(input: z.input<typeof empresaSchema>): Promise<R> {
  const user = await requirePermission("vendas:config");
  const p = empresaSchema.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Dados inválidos." };
  await salvarVendasConfig(p.data);
  await audit(user, "vendas.config", { meta: { secao: "empresa" } });
  revalidatePath("/painel/configuracoes");
  revalidatePath("/painel/abordagem");
  return { ok: true, data: null };
}

export async function salvarUrlSitesAction(url: string): Promise<R> {
  const user = await requirePermission("vendas:config");
  const u = String(url ?? "").trim().replace(/\/+$/, "");
  if (u && !z.url({ protocol: /^https?$/ }).safeParse(u).success) return { ok: false, message: "Endereço inválido. Use o formato https://sites.suaempresa.com.br" };
  if (u.length > 200) return { ok: false, message: "Endereço longo demais." };
  await setSetting("vendas.urlSites", u);
  await audit(user, "vendas.config", { meta: { secao: "urlSites" } });
  revalidatePath("/painel/configuracoes");
  return { ok: true, data: null };
}
