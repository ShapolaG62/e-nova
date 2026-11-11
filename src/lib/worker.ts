import "server-only";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { db, t } from "@/db";
import { claimJobs, completeJob, enqueue, failJob, pruneJobs, releaseStaleJobs, type ClaimedJob, type JobType } from "@/lib/jobs";
import { runMonitorCheck, runSnapshot } from "@/lib/monitor";
import { publishPost } from "@/lib/social/publish";
import { publishGoogleReply, syncGoogleReviews } from "@/lib/social/google-reviews";
import { sendAlert } from "@/lib/alerts";
import { env } from "@/lib/env";

const id = (p: Record<string, unknown>) => String(p.id);

const HANDLERS: Record<JobType, (p: Record<string, unknown>) => Promise<unknown>> = {
  "monitor.check": (p) => runMonitorCheck(id(p)),
  "monitor.snapshot": (p) => runSnapshot(id(p)),
  "post.publish": (p) => publishPost(id(p)),
  "reviews.sync": (p) => syncGoogleReviews(id(p)),
  "review.reply.publish": (p) => publishGoogleReply(id(p)),
  "alert.test": (p) => sendAlert({ kind: "TEST", message: "Teste de alerta — se você recebeu, está tudo certo.", onlyChannelId: id(p) }),
  "ai.pull": async (p) => {
    // Baixa o modelo no Ollama (pode levar vários minutos)
    const res = await fetch(`${env.OLLAMA_URL}/api/pull`, {
      method: "POST",
      body: JSON.stringify({ model: String(p.model), stream: false }),
      signal: AbortSignal.timeout(2 * 3600_000),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) throw new Error(`Falha ao baixar ${p.model}: ${j.error ?? res.status}`);
  },
  "clip.download": (p) => import("@/lib/clips/pipeline").then((m) => m.downloadProject(id(p))),
  "clip.transcribe": (p) => import("@/lib/clips/pipeline").then((m) => m.transcribeProject(id(p))),
  "clip.analyze": (p) => import("@/lib/clips/pipeline").then((m) => m.analyzeProject(id(p))),
  "clip.render": (p) => import("@/lib/clips/pipeline").then((m) => m.renderClip(id(p))),
  "ia.tarefa": (p) => import("@/lib/ia-hub/tarefas").then((m) => m.rodarTarefa(id(p))),
  "video.roteiro": (p) => import("@/lib/gerador/motor").then((m) => m.roteirizar(id(p))),
  "video.produzir": (p) => import("@/lib/gerador/motor").then((m) => m.produzir(id(p), { refazer: Array.isArray(p.refazer) ? p.refazer.map(String) : undefined })),
  "video.montar": (p) => import("@/lib/gerador/motor").then((m) => m.montar(id(p))),
  "aprendizado.resumir": (p) => import("@/lib/aprendizado").then((m) => m.resumir(p.area === "videos" ? "videos" : "cortes")),
  "security.scan": (p) => import("@/lib/security-scan").then((m) => m.runSecurityScan(id(p))),
};

/** Enfileira o que está "na hora". Idempotente graças ao dedupeKey. */
export async function schedule() {
  // Monitores vencidos (nunca verificados ou intervalo passou)
  const dueMonitors = await db
    .select({ id: t.monitors.id })
    .from(t.monitors)
    .where(
      and(
        eq(t.monitors.active, true),
        sql`(${t.monitors.lastCheckedAt} is null or ${t.monitors.lastCheckedAt} <= now() - make_interval(mins => ${t.monitors.intervalMinutes}))`,
      ),
    );
  for (const m of dueMonitors) await enqueue("monitor.check", { id: m.id }, { dedupeKey: `monitor:${m.id}`, maxAttempts: 1 });

  // Backup diário da página (1x a cada 24h por monitor)
  const dueSnapshots = await db.execute<{ id: string }>(sql`
    select m.id from monitors m
    where m.active and not exists (
      select 1 from site_snapshots s where s.monitor_id = m.id and s.created_at > now() - interval '24 hours'
    ) and not exists ( -- já tentou hoje (mesmo que tenha falhado): não repete
      select 1 from jobs j where j.dedupe_key = 'snapshot:' || m.id and j.created_at > now() - interval '24 hours'
    )`);
  for (const r of dueSnapshots.rows) await enqueue("monitor.snapshot", { id: r.id }, { dedupeKey: `snapshot:${r.id}`, maxAttempts: 3 });

  // Varredura de segurança diária de cada site
  const dueScans = await db.execute<{ id: string }>(sql`
    select m.id from monitors m
    where m.active and not exists (
      select 1 from security_scans s where s.monitor_id = m.id and s.created_at > now() - interval '24 hours'
    ) and not exists (
      select 1 from jobs j where j.dedupe_key = 'scan:' || m.id and j.created_at > now() - interval '24 hours'
    )`);
  for (const r of dueScans.rows) await enqueue("security.scan", { id: r.id }, { dedupeKey: `scan:${r.id}`, maxAttempts: 2 });

  // Posts agendados que chegaram na hora
  const duePosts = await db
    .select({ id: t.posts.id })
    .from(t.posts)
    .where(and(eq(t.posts.status, "AGENDADO"), isNotNull(t.posts.scheduledAt), lte(t.posts.scheduledAt, new Date())));
  for (const p of duePosts) await enqueue("post.publish", { id: p.id }, { dedupeKey: `post:${p.id}`, maxAttempts: 1 });

  // Avaliações do Google: sincroniza a cada hora (o webhook antecipa quando chega notificação)
  const hour = new Date().toISOString().slice(0, 13);
  const googleClients = await db
    .select({ id: t.clients.id })
    .from(t.clients)
    .innerJoin(t.integrations, and(eq(t.integrations.clientId, t.clients.id), eq(t.integrations.provider, "GOOGLE_BUSINESS")))
    .where(isNotNull(t.clients.googleLocationName));
  for (const c of googleClients) await enqueue("reviews.sync", { id: c.id }, { dedupeKey: `reviews:${c.id}:${hour}`, maxAttempts: 3 });
}

async function run(job: ClaimedJob) {
  const start = performance.now();
  try {
    const handler = HANDLERS[job.type];
    if (!handler) throw new Error(`Tipo de job desconhecido: ${job.type}`);
    await handler(job.payload);
    await completeJob(job.id, performance.now() - start);
  } catch (e) {
    console.error(`[worker] job ${job.id} ${job.type} falhou:`, e instanceof Error ? e.message : e);
    await failJob(job, e);
  }
}

/** Laço principal: agenda a cada 30s e processa com concorrência limitada. */
export async function startWorker({ concurrency = 4, signal }: { concurrency?: number; signal?: AbortSignal } = {}) {
  let lastSchedule = 0;
  let lastMaintenance = 0;
  const running = new Set<Promise<void>>();
  console.log(`[worker] iniciado (concorrência ${concurrency})`);
  // Worker único (dev/VPS): o que estava RUNNING é de um processo que morreu — volta para a fila
  if (process.env.WORKER_SINGLE === "1") await releaseStaleJobs(0);

  while (!signal?.aborted) {
    try {
      if (Date.now() - lastSchedule > 30_000) {
        await schedule();
        lastSchedule = Date.now();
      }
      if (Date.now() - lastMaintenance > 10 * 60_000) {
        await releaseStaleJobs();
        await pruneJobs();
        lastMaintenance = Date.now();
      }
      const free = concurrency - running.size;
      if (free > 0) {
        for (const job of await claimJobs(free)) {
          const p = run(job).finally(() => running.delete(p));
          running.add(p);
        }
      }
    } catch (e) {
      console.error("[worker] erro no laço:", e);
    }
    await new Promise((r) => setTimeout(r, running.size >= concurrency ? 500 : 2000));
  }
  await Promise.allSettled(running);
  console.log("[worker] encerrado");
}
