import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { enqueue } from "@/lib/jobs";
import { putObject } from "@/lib/storage";
import { safeFetch } from "@/lib/net-safety";
import { executar, SemProvedor } from "./roteador";
import type { Capacidade, EntradaIA } from "./tipos";

const EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/mp4": "m4a", "audio/ogg": "ogg" };

/** Cria uma geração em segundo plano (vídeo, imagem, voz…) e devolve o id para a tela acompanhar. */
export async function criarTarefa(cap: Capacidade, entrada: EntradaIA, o: { titulo?: string; preferir?: string; userId?: string | null; clientId?: string | null } = {}) {
  const { arquivo, ...semArquivo } = entrada;
  const [row] = await db.insert(t.iaTarefas).values({
    capacidade: cap, titulo: o.titulo?.slice(0, 200) ?? null, entrada: semArquivo as Record<string, unknown>,
    preferir: o.preferir ?? null, userId: o.userId ?? null, clientId: o.clientId ?? null,
  }).returning({ id: t.iaTarefas.id });
  if (arquivo) {
    // arquivo enviado pela tela: guarda no storage e passa a referência
    const chave = `ia/${row.id}/entrada-${arquivo.nome.replace(/[^\w.-]/g, "_").slice(-60)}`;
    await putObject(chave, arquivo.buffer, arquivo.mime);
    await db.update(t.iaTarefas).set({ entrada: { ...semArquivo, arquivoChave: chave, arquivoMime: arquivo.mime, arquivoNome: arquivo.nome } }).where(eq(t.iaTarefas.id, row.id));
  }
  await enqueue("ia.tarefa", { id: row.id }, { maxAttempts: 1 });
  return row.id;
}

/** Executado pelo worker. */
export async function rodarTarefa(id: string) {
  const tarefa = await db.query.iaTarefas.findFirst({ where: eq(t.iaTarefas.id, id) });
  if (!tarefa || tarefa.status === "PRONTA") return;
  await db.update(t.iaTarefas).set({ status: "RODANDO", progresso: 2, etapa: "Escolhendo a melhor IA…" }).where(eq(t.iaTarefas.id, id));
  let ultimo = 0;
  const progresso = async (pct: number, etapa?: string) => {
    if (Date.now() - ultimo < 1500 && pct < 100) return;
    ultimo = Date.now();
    await db.update(t.iaTarefas).set({ progresso: Math.round(pct), etapa: etapa?.slice(0, 200) }).where(eq(t.iaTarefas.id, id));
  };
  const entrada = { ...(tarefa.entrada as EntradaIA & { arquivoChave?: string; arquivoMime?: string; arquivoNome?: string }) };
  if (entrada.arquivoChave) {
    const { getObjectBuffer } = await import("@/lib/storage");
    entrada.arquivo = { buffer: await getObjectBuffer(entrada.arquivoChave), mime: entrada.arquivoMime ?? "application/octet-stream", nome: entrada.arquivoNome ?? "arquivo" };
  }
  try {
    const r = await executar(tarefa.capacidade as Capacidade, entrada, { preferir: tarefa.preferir ?? undefined, userId: tarefa.userId, progresso });
    await progresso(97, "Salvando o resultado…");
    const arquivos: { chave: string; mime: string; nome?: string }[] = [];
    for (const [i, a] of (r.arquivos ?? []).entries()) {
      let buf = a.buffer, mime = a.mime;
      if (!buf && a.url) {
        const res = await safeFetch(a.url, { signal: AbortSignal.timeout(120_000) });
        if (!res.ok) continue;
        buf = Buffer.from(await res.arrayBuffer());
        mime = res.headers.get("content-type")?.split(";")[0] || mime;
      }
      if (!buf) continue;
      const chave = `ia/${id}/resultado-${i + 1}.${EXT[mime] ?? "bin"}`;
      await putObject(chave, buf, mime);
      arquivos.push({ chave, mime, nome: a.nome });
    }
    await db.update(t.iaTarefas).set({
      status: "PRONTA", progresso: 100, etapa: `Feito por ${r.usado.item}`,
      resultado: { texto: r.texto, arquivos, usado: r.usado, tentativas: r.tentativas, ...(r.segmentos?.length ? { segmentos: r.segmentos } : {}) } as typeof t.iaTarefas.$inferInsert.resultado,
    }).where(eq(t.iaTarefas.id, id));
  } catch (e) {
    const msg = e instanceof SemProvedor
      ? `${e.message}${e.tentativas.length ? " Tentativas: " + e.tentativas.map((x) => `${x.item} (${x.erro})`).join("; ") : ""}`
      : e instanceof Error ? e.message : String(e);
    await db.update(t.iaTarefas).set({ status: "FALHOU", erro: msg.slice(0, 2000), etapa: "Nenhuma IA conseguiu", resultado: e instanceof SemProvedor ? { tentativas: e.tentativas } : null }).where(eq(t.iaTarefas.id, id));
  }
}
