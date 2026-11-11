import "server-only";
import { sql } from "drizzle-orm";
import { db, t } from "@/db";

/**
 * Fila de jobs sobre o próprio Postgres (sem Redis): INSERT para enfileirar,
 * `FOR UPDATE SKIP LOCKED` para vários workers pegarem jobs sem conflito,
 * backoff exponencial em falhas e dedupe por chave enquanto o job está ativo.
 */
export type JobType =
  | "monitor.check"
  | "monitor.snapshot"
  | "post.publish"
  | "reviews.sync"
  | "review.reply.publish"
  | "alert.test"
  | "ai.pull"
  | "clip.download"
  | "clip.transcribe"
  | "clip.analyze"
  | "clip.render"
  | "security.scan"
  | "ia.tarefa"
  | "video.roteiro"
  | "video.produzir"
  | "video.montar"
  | "aprendizado.resumir";

export async function enqueue(
  type: JobType,
  payload: Record<string, unknown> = {},
  opts: { runAt?: Date; dedupeKey?: string; maxAttempts?: number } = {},
) {
  await db
    .insert(t.jobs)
    .values({
      type,
      payload,
      runAt: opts.runAt ?? new Date(),
      dedupeKey: opts.dedupeKey,
      maxAttempts: opts.maxAttempts ?? 5,
    })
    .onConflictDoNothing({ target: t.jobs.dedupeKey, where: sql`status in ('QUEUED','RUNNING')` });
}

export type ClaimedJob = { id: number; type: JobType; payload: Record<string, unknown>; attempts: number; maxAttempts: number };

/** Pega até `limit` jobs prontos, marcando como RUNNING de forma atômica. */
export async function claimJobs(limit: number): Promise<ClaimedJob[]> {
  const res = await db.execute<{ id: number; type: JobType; payload: Record<string, unknown>; attempts: number; max_attempts: number }>(sql`
    update jobs set status = 'RUNNING', locked_at = now(), attempts = attempts + 1
    where id in (
      select id from jobs
      where status = 'QUEUED' and run_at <= now()
      order by run_at
      limit ${limit}
      for update skip locked
    )
    returning id, type, payload, attempts, max_attempts`);
  return res.rows.map((r) => ({ id: Number(r.id), type: r.type, payload: r.payload, attempts: r.attempts, maxAttempts: r.max_attempts }));
}

export async function completeJob(id: number, durationMs: number) {
  await db.execute(sql`update jobs set status = 'DONE', finished_at = now(), duration_ms = ${durationMs}, last_error = null where id = ${id}`);
}

export async function failJob(job: ClaimedJob, error: unknown) {
  const msg = (error instanceof Error ? error.message : String(error)).slice(0, 2000);
  if (job.attempts >= job.maxAttempts) {
    await db.execute(sql`update jobs set status = 'FAILED', finished_at = now(), last_error = ${msg} where id = ${job.id}`);
    return;
  }
  // Backoff: 30s, 2min, 8min, 32min…
  const delay = 30 * 4 ** (job.attempts - 1);
  await db.execute(
    sql`update jobs set status = 'QUEUED', locked_at = null, last_error = ${msg}, run_at = now() + make_interval(secs => ${delay}) where id = ${job.id}`,
  );
}

/** Jobs presos em RUNNING (worker caiu) voltam para a fila. */
export async function releaseStaleJobs(minutes = 15) {
  await db.execute(
    sql`update jobs set status = 'QUEUED', locked_at = null where status = 'RUNNING' and locked_at <= now() - make_interval(mins => ${minutes})`,
  );
}

/** Limpeza: jobs concluídos com mais de 7 dias. */
export async function pruneJobs() {
  await db.execute(sql`delete from jobs where status = 'DONE' and finished_at < now() - interval '7 days'`);
}
