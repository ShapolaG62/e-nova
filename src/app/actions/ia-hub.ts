"use server";

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { rateLimit } from "@/lib/cache";
import { audit } from "@/lib/audit";
import { AiError, generate } from "@/lib/ai/client";
import { CAPACIDADES, FalhaProvedor, type Capacidade, type EntradaIA } from "@/lib/ia-hub/tipos";
import { CATALOGO, credencial } from "@/lib/ia-hub/catalogo";
import { chavesLista, salvarChaves, salvarPreferencias, type PreferenciasIA } from "@/lib/ia-hub/config";
import { checarResposta, limparSaude } from "@/lib/ia-hub/roteador";
import { criarTarefa } from "@/lib/ia-hub/tarefas";
import type { ActionState } from "@/lib/validation";

const CAP_IDS = CAPACIDADES.map((c) => c.id) as [Capacidade, ...Capacidade[]];
const capSchema = z.enum(CAP_IDS);
const MASCARA = /^••/;

/** Limpa o "castigo" de todos os itens que usam esta credencial (chave nova = nova chance). */
function liberarCredencial(provedor: string) {
  for (const item of CATALOGO) for (const r of item.rotas) if (r.provedor === provedor) limparSaude(`${item.id}:${r.via}:${provedor}`);
}

// ───────── Chaves ─────────
/**
 * Salva ou remove UMA chave do serviço. indice = posição na lista (o que passar do fim adiciona uma chave nova).
 * Sem índice, mexe na primeira (compatível com a tela antiga).
 */
export async function salvarChavesAction(provedor: string, campos: Record<string, string> | null, indice?: number): Promise<ActionState> {
  const me = await requirePermission("system:view");
  const cred = credencial(provedor);
  if (!cred) return { ok: false, message: "Credencial desconhecida." };
  if (indice !== undefined && (!Number.isInteger(indice) || indice < 0 || indice > 20)) return { ok: false, message: "Posição inválida." };
  const existentes = await chavesLista(provedor);
  if (campos) {
    const atuais = existentes[indice ?? 0] ?? {};
    const final: Record<string, string> = {};
    for (const campo of cred.campos) {
      const v = String(campos[campo.id] ?? "").trim().slice(0, 2000);
      // valor mascarado ("••••1234") = manter o que já está salvo
      final[campo.id] = MASCARA.test(v) ? (atuais[campo.id] ?? "") : v;
    }
    const obrigatorios = cred.campos.filter((c) => c.segredo);
    if (obrigatorios.length && obrigatorios.some((c) => !final[c.id])) return { ok: false, message: `Preencha ${obrigatorios.map((c) => c.rotulo).join(" e ")}.` };
    // a mesma chave duas vezes não ajuda no revezamento
    const segredo = cred.campos.find((c) => c.segredo)?.id;
    if (segredo && existentes.some((e, i) => i !== (indice ?? 0) && e[segredo] === final[segredo])) return { ok: false, message: "Essa chave já está cadastrada." };
    try { await salvarChaves(provedor, final, indice); } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "Não deu para salvar." }; }
  } else {
    await salvarChaves(provedor, null, indice);
  }
  liberarCredencial(provedor);
  await audit(me, campos ? "iahub.chave.salvar" : "iahub.chave.remover", { entity: "iahub", entityId: provedor });
  revalidatePath("/painel/ia-central");
  const n = indice !== undefined ? ` ${indice + 1}` : "";
  return { ok: true, message: campos ? `Chave${n} de ${cred.nome} salva.` : `Chave${n} de ${cred.nome} removida.` };
}

/** Validações baratas (sem gastar crédito) para credenciais que não fazem texto. */
const VALIDACOES: Record<string, (c: Record<string, string>, sinal: AbortSignal) => Promise<Response>> = {
  replicate: (c, s) => fetch("https://api.replicate.com/v1/account", { headers: { Authorization: `Bearer ${c.apiKey}` }, signal: s }),
  elevenlabs: (c, s) => fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": c.apiKey ?? "" }, signal: s }),
  deepgram: (c, s) => fetch("https://api.deepgram.com/v1/projects", { headers: { Authorization: `Token ${c.apiKey}` }, signal: s }),
  assemblyai: (c, s) => fetch("https://api.assemblyai.com/v2/transcript?limit=1", { headers: { Authorization: c.apiKey ?? "" }, signal: s }),
  heygen: (c, s) => fetch("https://api.heygen.com/v2/user/remaining_quota", { headers: { "X-Api-Key": c.apiKey ?? "" }, signal: s }),
  stability: (c, s) => fetch("https://api.stability.ai/v1/user/account", { headers: { Authorization: `Bearer ${c.apiKey}` }, signal: s }),
  luma: (c, s) => fetch("https://api.lumalabs.ai/dream-machine/v1/generations?limit=1", { headers: { Authorization: `Bearer ${c.apiKey}` }, signal: s }),
  did: (c, s) => fetch("https://api.d-id.com/credits", { headers: { Authorization: `Basic ${c.apiKey}` }, signal: s }),
  cartesia: (c, s) => fetch("https://api.cartesia.ai/voices", { headers: { "X-API-Key": c.apiKey ?? "", "Cartesia-Version": "2024-06-10" }, signal: s }),
};

export async function testarCredencialAction(provedor: string, indice = 0): Promise<ActionState> {
  const me = await requirePermission("system:view");
  if (!(await rateLimit(`iahub:teste:${me.id}`, 10, 60))) return { ok: false, message: "Muitos testes seguidos. Aguarde 1 minuto." };
  const cred = credencial(provedor);
  if (!cred) return { ok: false, message: "Credencial desconhecida." };
  const chave = (await chavesLista(provedor))[indice];
  if (!chave) return { ok: false, message: "Nenhuma chave salva para testar." };

  // Credencial que faz texto: uma pergunta minúscula direto no adaptador (não entra no histórico nem dá "castigo").
  const alvo = CATALOGO.flatMap((item) => item.capacidades.texto && (item.status ?? "api") === "api" ? item.rotas.filter((r) => r.provedor === provedor).map((rota) => ({ item, rota })) : [])[0];
  const sinal = AbortSignal.timeout(provedor === "ollama" ? 90_000 : 30_000);
  const t0 = Date.now();
  try {
    if (alvo) {
      const { adaptadorPara } = await import("@/lib/ia-hub/adaptadores");
      const ad = adaptadorPara(alvo.rota);
      if (!ad) return { ok: true, message: "Chave salva — será testada no primeiro uso." };
      const r = await ad("texto", { prompt: "Responda apenas com a palavra: ok", temperatura: 0 }, { chave, rota: alvo.rota, item: alvo.item, sinal });
      liberarCredencial(provedor);
      return { ok: true, message: `Funcionou: ${alvo.item.nome} respondeu em ${((Date.now() - t0) / 1000).toFixed(1)} s${r.texto ? ` (“${r.texto.trim().slice(0, 40)}”)` : ""}.` };
    }
    const validar = VALIDACOES[provedor];
    if (!validar) return { ok: true, message: "Chave salva — será testada no primeiro uso." };
    const r = await validar(chave, sinal);
    await checarResposta(r, cred.nome);
    liberarCredencial(provedor);
    return { ok: true, message: `Chave de ${cred.nome} aceita.` };
  } catch (e) {
    const msg = e instanceof FalhaProvedor ? e.message : sinal.aborted ? "não respondeu a tempo" : e instanceof Error ? e.message : String(e);
    // tira o JSON cru da resposta e mostra só a mensagem do serviço
    const doServico = /"message"\s*:\s*"([^"]{3,200})"/.exec(msg)?.[1];
    const base = msg.replace(/\s*[{[][\s\S]*$/, "").replace(/^[\w.-]+:\s*/, "").trim();
    return { ok: false, message: `Não funcionou: ${base || "erro"}${doServico ? ` — ${doServico}` : ""}`.replace(/\s+/g, " ").slice(0, 300) };
  }
}

// ───────── Preferências (ordem, modo, desligados, modelos) ─────────
const prefSchema = z.object({
  modo: z.enum(["qualidade", "economia"]),
  ordem: z.record(z.string(), z.array(z.string().max(40)).max(80)),
  desligados: z.array(z.string().max(40)).max(200),
  modelos: z.record(z.string(), z.string().max(200)),
});

export async function salvarPreferenciasAction(p: PreferenciasIA): Promise<ActionState> {
  const me = await requirePermission("system:view");
  const parsed = prefSchema.safeParse(p);
  if (!parsed.success) return { ok: false, message: "Preferências inválidas." };
  const ids = new Set(CATALOGO.map((i) => i.id));
  const limpo: PreferenciasIA = {
    modo: parsed.data.modo,
    ordem: Object.fromEntries(Object.entries(parsed.data.ordem).filter(([k]) => CAP_IDS.includes(k as Capacidade)).map(([k, v]) => [k, v.filter((id) => ids.has(id))])),
    desligados: parsed.data.desligados.filter((id) => ids.has(id)),
    modelos: Object.fromEntries(Object.entries(parsed.data.modelos).filter(([k, v]) => ids.has(k) && v.trim()).map(([k, v]) => [k, v.trim()])),
  };
  await salvarPreferencias(limpo);
  await audit(me, "iahub.preferencias", { entity: "iahub", meta: { modo: limpo.modo } });
  revalidatePath("/painel/ia-central");
  return { ok: true };
}

export async function limparSaudeAction(prefixo?: string): Promise<ActionState> {
  await requirePermission("system:view");
  limparSaude(prefixo || undefined);
  revalidatePath("/painel/ia-central");
  return { ok: true, message: "Pronto: vai tentar de novo na próxima vez." };
}

// ───────── Tarefas (Estúdio de mídia) ─────────
const url = z.string().trim().url("Endereço inválido").max(2000).refine((u) => /^https?:\/\//i.test(u), "Use um link http(s)").optional().or(z.literal("").transform(() => undefined));
const entradaSchema = z.object({
  prompt: z.string().trim().max(8000).optional(),
  sistema: z.string().trim().max(4000).optional(),
  imagemUrl: url,
  videoUrl: url,
  audioUrl: url,
  proporcao: z.enum(["16:9", "9:16", "1:1"]).optional(),
  duracao: z.coerce.number().min(1).max(600).optional(),
  voz: z.string().trim().max(120).optional(),
  idioma: z.string().trim().max(10).optional(),
  operacao: z.enum(["remover-fundo", "ampliar", "limpar"]).optional(),
  template: z.string().trim().max(200).optional(),
  dados: z.record(z.string(), z.unknown()).optional(),
  // arquivo enviado pela tela (data URL ou base64)
  arquivoBase64: z.string().max(12_000_000).optional(),
  arquivoNome: z.string().max(200).optional(),
  arquivoMime: z.string().max(100).optional(),
});
export type EntradaTarefa = z.input<typeof entradaSchema>;

const MAX_ARQUIVO = 6 * 1024 * 1024;
const MIME_OK = /^(audio|video|image)\/[\w.+-]+$/;

export async function criarTarefaAction(cap: Capacidade, entrada: EntradaTarefa, titulo?: string, preferir?: string): Promise<ActionState & { id?: string }> {
  const me = await requirePermission("ai:use");
  if (!(await rateLimit(`iahub:tarefa:${me.id}`, 15, 60))) return { ok: false, message: "Muitos pedidos seguidos. Aguarde 1 minuto." };
  const c = capSchema.safeParse(cap);
  if (!c.success) return { ok: false, message: "Função inválida." };
  const parsed = entradaSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Confira os campos." };
  if (preferir && !CATALOGO.some((i) => i.id === preferir && i.capacidades[c.data])) return { ok: false, message: "IA escolhida não faz essa função." };

  const { arquivoBase64, arquivoNome, arquivoMime, ...resto } = parsed.data;
  const e: EntradaIA = Object.fromEntries(Object.entries(resto).filter(([, v]) => v !== undefined && v !== "")) as EntradaIA;
  if (arquivoBase64) {
    const m = /^data:([^;,]+)?(?:;base64)?,([\s\S]*)$/.exec(arquivoBase64);
    const mime = (m?.[1] || arquivoMime || "").toLowerCase();
    if (!MIME_OK.test(mime)) return { ok: false, message: "Envie um arquivo de áudio, vídeo ou imagem." };
    const buffer = Buffer.from(m ? m[2] : arquivoBase64, "base64");
    if (!buffer.length) return { ok: false, message: "Arquivo vazio." };
    if (buffer.length > MAX_ARQUIVO) return { ok: false, message: "Arquivo grande demais (máx. 5,5 MB). Use um link." };
    e.arquivo = { buffer, mime, nome: (arquivoNome || "arquivo").replace(/[^\w.\- ]/g, "_").slice(-80) };
  }

  const precisa: Partial<Record<Capacidade, () => boolean>> = {
    imagem: () => !!e.prompt, video: () => !!e.prompt || !!e.imagemUrl || !!e.arquivo, voz: () => !!e.prompt, musica: () => !!e.prompt,
    avatar: () => !!e.prompt, transcricao: () => !!e.arquivo || !!e.audioUrl || !!e.videoUrl, "limpar-audio": () => !!e.arquivo || !!e.audioUrl,
    "editar-imagem": () => !!e.arquivo || !!e.imagemUrl, "edicao-video": () => !!e.template || !!e.dados, texto: () => !!e.prompt,
  };
  if (precisa[c.data] && !precisa[c.data]!()) return { ok: false, message: "Falta o principal: descreva o que quer ou envie o arquivo." };

  const id = await criarTarefa(c.data, e, { titulo: titulo?.trim() || e.prompt?.slice(0, 120) || e.arquivo?.nome, preferir: preferir || undefined, userId: me.id });
  revalidatePath("/painel/estudio");
  return { ok: true, id };
}

function serializar(r: typeof t.iaTarefas.$inferSelect) {
  const entrada = { ...r.entrada } as Record<string, unknown>;
  delete entrada.arquivoChave;
  return {
    id: r.id, capacidade: r.capacidade as Capacidade, titulo: r.titulo, status: r.status, progresso: r.progresso, etapa: r.etapa, erro: r.erro, preferir: r.preferir,
    entrada,
    resultado: r.resultado as null | {
      texto?: string; arquivos?: { chave: string; mime: string; nome?: string }[]; usado?: { item?: string; provedor?: string; via?: string; modelo?: string; ms?: number };
      tentativas?: { item: string; via: string; provedor: string; ok: boolean; ms: number; erro?: string }[]; segmentos?: { inicio: number; fim: number; texto: string }[];
    },
    criadoEm: r.createdAt.toISOString(),
  };
}
export type TarefaView = ReturnType<typeof serializar>;

export async function statusTarefaAction(id: string): Promise<TarefaView | null> {
  await requirePermission("ai:use");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await db.select().from(t.iaTarefas).where(eq(t.iaTarefas.id, id)).limit(1);
  return r ? serializar(r) : null;
}

export async function listarTarefasAction(limit = 20, cap?: Capacidade): Promise<TarefaView[]> {
  await requirePermission("ai:use");
  const c = cap ? capSchema.safeParse(cap) : null;
  const rows = await db.select().from(t.iaTarefas).where(c?.success ? eq(t.iaTarefas.capacidade, c.data) : undefined).orderBy(desc(t.iaTarefas.createdAt)).limit(Math.min(Math.max(1, limit), 100));
  return rows.map(serializar);
}

export async function excluirTarefaAction(id: string): Promise<ActionState> {
  const me = await requirePermission("ai:use");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false };
  const [r] = await db.select().from(t.iaTarefas).where(eq(t.iaTarefas.id, id)).limit(1);
  if (!r) return { ok: true };
  if (r.userId !== me.id && !can(me.role, "system:view")) return { ok: false, message: "Só quem criou pode excluir." };
  const { deleteObject } = await import("@/lib/storage");
  const chaves = [...(r.resultado?.arquivos ?? []).map((a) => a.chave), ...(typeof r.entrada.arquivoChave === "string" ? [r.entrada.arquivoChave] : [])];
  await Promise.all(chaves.map((k) => deleteObject(k).catch(() => {})));
  await db.delete(t.iaTarefas).where(eq(t.iaTarefas.id, id));
  revalidatePath("/painel/estudio");
  return { ok: true, message: "Excluído." };
}

// ───────── Equipe de agentes (gerente → redator → revisor → redator) ─────────
const PlanoSchema = z.object({
  resumo: z.string().describe("O objetivo em uma frase"),
  publico: z.string().describe("Para quem é o texto"),
  tom: z.string().describe("Tom de voz"),
  passos: z.array(z.string()).min(2).max(8).describe("Roteiro do que o redator deve escrever, em ordem"),
  criterios: z.array(z.string()).min(1).max(6).describe("Como o revisor vai julgar"),
});
const RascunhoSchema = z.object({ titulo: z.string(), texto: z.string().describe("O texto completo, pronto para usar") });
const CriticaSchema = z.object({
  nota: z.number().min(0).max(10),
  pontosFortes: z.array(z.string()).max(6),
  problemas: z.array(z.string()).max(8),
  sugestoes: z.array(z.string()).max(8),
});
const FinalSchema = z.object({ titulo: z.string(), texto: z.string(), mudancas: z.array(z.string()).max(8).describe("O que mudou depois da revisão") });

export type Plano = z.infer<typeof PlanoSchema>;
export type Rascunho = z.infer<typeof RascunhoSchema>;
export type Critica = z.infer<typeof CriticaSchema>;
export type VersaoFinal = z.infer<typeof FinalSchema>;
export type PapelAgente = "gerente" | "redator" | "revisor" | "final";
export type EtapaAgente =
  | { papel: "gerente"; ms: number; dados: Plano }
  | { papel: "redator"; ms: number; dados: Rascunho }
  | { papel: "revisor"; ms: number; dados: Critica }
  | { papel: "final"; ms: number; dados: VersaoFinal };

const equipeSchema = z.object({ objetivo: z.string().trim().min(5, "Descreva o objetivo").max(2000), contexto: z.string().trim().max(6000).optional() });
type Anteriores = { plano?: Plano; rascunho?: Rascunho; critica?: Critica };

async function rodarPapel(papel: PapelAgente, base: z.infer<typeof equipeSchema>, ant: Anteriores, userId: string): Promise<EtapaAgente> {
  const ctx = `Objetivo: ${base.objetivo}${base.contexto ? `\n\nContexto do negócio:\n${base.contexto}` : ""}`;
  const log = { userId, title: `Equipe de agentes — ${papel}`, input: { papel, objetivo: base.objetivo } };
  const t0 = Date.now();
  if (papel === "gerente") {
    const { data } = await generate({ kind: "SITE_COPY", schema: PlanoSchema, log,
      system: "Você é o gerente de uma pequena equipe de conteúdo de uma agência brasileira. Planeje o trabalho do redator de forma objetiva. Escreva em português do Brasil.",
      prompt: `${ctx}\n\nMonte o plano: resumo, público, tom, passos do texto e critérios de qualidade.` });
    return { papel, ms: Date.now() - t0, dados: data };
  }
  if (papel === "redator") {
    if (!ant.plano) throw new Error("falta o plano");
    const { data } = await generate({ kind: "SITE_COPY", schema: RascunhoSchema, log,
      system: "Você é o redator da equipe. Siga o plano do gerente e entregue o texto completo, claro e persuasivo, em português do Brasil.",
      prompt: `${ctx}\n\nPlano do gerente:\n${JSON.stringify(ant.plano, null, 2)}\n\nEscreva o texto.` });
    return { papel, ms: Date.now() - t0, dados: data };
  }
  if (papel === "revisor") {
    if (!ant.plano || !ant.rascunho) throw new Error("falta o rascunho");
    const { data } = await generate({ kind: "SITE_COPY", schema: CriticaSchema, log,
      system: "Você é o revisor exigente da equipe. Avalie o texto pelos critérios do gerente. Seja específico e construtivo. Português do Brasil.",
      prompt: `${ctx}\n\nCritérios: ${ant.plano.criterios.join("; ")}\n\nTexto do redator:\n# ${ant.rascunho.titulo}\n${ant.rascunho.texto}\n\nDê nota de 0 a 10, pontos fortes, problemas e sugestões.` });
    return { papel, ms: Date.now() - t0, dados: data };
  }
  if (!ant.rascunho || !ant.critica) throw new Error("falta a revisão");
  const { data } = await generate({ kind: "SITE_COPY", schema: FinalSchema, log,
    system: "Você é o redator da equipe. Reescreva o texto aplicando a revisão. Mantenha o que estava bom. Português do Brasil.",
    prompt: `${ctx}\n\nSeu rascunho:\n# ${ant.rascunho.titulo}\n${ant.rascunho.texto}\n\nRevisão (nota ${ant.critica.nota}):\nProblemas: ${ant.critica.problemas.join("; ") || "nenhum"}\nSugestões: ${ant.critica.sugestoes.join("; ") || "nenhuma"}\n\nEntregue a versão final e liste as mudanças.` });
  return { papel: "final", ms: Date.now() - t0, dados: data };
}

/** Uma etapa por vez — a tela chama em sequência para mostrar o andamento. */
export async function equipeEtapaAction(papel: PapelAgente, entrada: { objetivo: string; contexto?: string }, anteriores: Anteriores = {}): Promise<ActionState & { etapa?: EtapaAgente }> {
  const me = await requirePermission("ai:use");
  if (papel === "gerente" && !(await rateLimit(`iahub:equipe:${me.id}`, 6, 60))) return { ok: false, message: "Muitas equipes seguidas. Aguarde 1 minuto." };
  if (!["gerente", "redator", "revisor", "final"].includes(papel)) return { ok: false, message: "Etapa inválida." };
  const base = equipeSchema.safeParse(entrada);
  if (!base.success) return { ok: false, message: base.error.issues[0]?.message };
  try {
    return { ok: true, etapa: await rodarPapel(papel, base.data, anteriores, me.id) };
  } catch (e) {
    return { ok: false, message: e instanceof AiError ? e.userMessage : "Falha inesperada. Tente de novo." };
  }
}

/** Equipe completa numa chamada só (gerente planeja → redator escreve → revisor critica → redator revisa). */
export async function equipeAgentesAction(entrada: { objetivo: string; contexto?: string }): Promise<ActionState & { etapas?: EtapaAgente[] }> {
  const me = await requirePermission("ai:use");
  if (!(await rateLimit(`iahub:equipe:${me.id}`, 6, 60))) return { ok: false, message: "Muitas equipes seguidas. Aguarde 1 minuto." };
  const base = equipeSchema.safeParse(entrada);
  if (!base.success) return { ok: false, message: base.error.issues[0]?.message };
  const etapas: EtapaAgente[] = [];
  const ant: Anteriores = {};
  try {
    for (const papel of ["gerente", "redator", "revisor", "final"] as const) {
      const e = await rodarPapel(papel, base.data, ant, me.id);
      etapas.push(e);
      if (e.papel === "gerente") ant.plano = e.dados;
      if (e.papel === "redator") ant.rascunho = e.dados;
      if (e.papel === "revisor") ant.critica = e.dados;
    }
    return { ok: true, etapas };
  } catch (e) {
    return { ok: false, etapas, message: e instanceof AiError ? e.userMessage : "Falha inesperada. Tente de novo." };
  }
}
