import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckCircle2, Circle } from "lucide-react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { env, features } from "@/lib/env";
import { storageMode } from "@/lib/storage";
import { Kpi, Panel } from "@/components/charts";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { listLocalModels, SUPPORTED_MODELS } from "@/lib/ai/ollama";
import { activeAi } from "@/lib/ai/client";
import { pullModelAction, setAiModelAction } from "@/app/actions/system";
import { PageHeader, PageSkeleton } from "@/components/page";

export const metadata: Metadata = { title: "Sistema" };
const dt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" });

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title="Sistema" subtitle="Configuração do servidor e fila de processamento em segundo plano." />
      <Suspense fallback={<PageSkeleton />}>
        <System />
      </Suspense>
    </div>
  );
}

async function System() {
  await requirePermission("system:view");
  const [counts, failures, last] = await Promise.all([
    db.execute<{ status: string; total: number }>(sql`select status, count(*)::int as total from jobs group by status`),
    db.execute<{ id: number; type: string; last_error: string; attempts: number; finished_at: Date | null; run_at: Date }>(sql`
      select id, type, last_error, attempts, finished_at, run_at from jobs
      where last_error is not null order by coalesce(finished_at, run_at) desc limit 15`),
    db.execute<{ finished_at: Date | null; alive: boolean }>(
      sql`select max(finished_at) as finished_at, coalesce(max(finished_at) > now() - interval '10 minutes', false) as alive from jobs`,
    ),
  ]);
  const [local, ai, pulling] = await Promise.all([
    listLocalModels(),
    activeAi(),
    db.execute<{ model: string }>(sql`select payload->>'model' as model from jobs where type = 'ai.pull' and status in ('QUEUED','RUNNING')`),
  ]);
  const installed = new Set(local.models.map((m) => m.name));
  const downloading = new Set(pulling.rows.map((r) => r.model));
  const c = Object.fromEntries(counts.rows.map((r) => [r.status, r.total]));
  const lastRun = last.rows[0]?.finished_at ? new Date(last.rows[0].finished_at) : null;
  const workerAlive = !!last.rows[0]?.alive;

  const checklist: [string, boolean, string][] = [
    ["Banco de dados", true, env.DATABASE_URL.includes("127.0.0.1:5433") ? "Postgres local (PGlite)" : "Postgres remoto"],
    ["Criptografia (ENCRYPTION_KEY)", features.encryption, "necessária para conectar contas e canais de alerta"],
    ["IA", features.ai, ai.provider === "ollama" ? `local: ${ai.model}` : `${ai.nome} (Central de IA)`],
    ["Storage R2/S3", features.s3, storageMode() === "s3" ? "upload direto do navegador" : "usando disco local (.data/uploads)"],
    ["Cache compartilhado (Upstash)", !!env.UPSTASH_REDIS_REST_URL, "sem ele, cache em memória (ok para 1 servidor)"],
    ["Google (Meu Negócio + YouTube)", features.google, "GOOGLE_CLIENT_ID / SECRET"],
    ["Meta (Instagram)", features.meta, "META_APP_ID / SECRET"],
    ["TikTok", features.tiktok, "TIKTOK_CLIENT_KEY / SECRET"],
    ["Webhook de avaliações", !!env.WEBHOOK_SECRET, `${env.APP_URL}/api/webhooks/google-reviews?token=…`],
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Worker" value={<span className={workerAlive ? "text-emerald-600" : "text-amber-600"}>{workerAlive ? "Ativo" : "Sem sinal"}</span>} hint={lastRun ? `último job ${dt.format(lastRun)}` : "nenhum job concluído"} />
        <Kpi label="Na fila" value={c.QUEUED ?? 0} />
        <Kpi label="Rodando" value={c.RUNNING ?? 0} />
        <Kpi label="Falharam (definitivo)" value={<span className={c.FAILED ? "text-red-600" : ""}>{c.FAILED ?? 0}</span>} />
      </div>
      {!workerAlive && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          O worker roda monitores, backups, publicações e sincronizações. Em dev ele sobe junto com <code>npm run dev</code>; em produção rode <code>npm run worker</code> como serviço.
        </p>
      )}
      <Panel
        title="IA local (Ollama)"
        action={
          <span className={local.online ? "text-xs font-medium text-emerald-600" : "text-xs font-medium text-amber-600"}>
            {local.online ? `Online · v${local.version}` : "Offline — abra o Ollama"}
          </span>
        }
      >
        <p className="mb-3 text-sm text-muted-foreground">
          {ai.provider === "ollama"
            ? "A IA roda nesta máquina: sem custo por uso e os dados não saem do servidor. Escolha o modelo usado em respostas, roteiros, e-mails, relatórios e cortes."
            : "AI_PROVIDER=anthropic: a IA está usando a Claude API (paga por uso)."}
        </p>
        <ul className="divide-y">
          {SUPPORTED_MODELS.map((m) => {
            const has = installed.has(m.id);
            const active = ai.provider === "ollama" && ai.model === m.id;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {m.label} <span className="font-normal text-muted-foreground">· {m.vendor}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.note} · {m.sizeGb} GB
                  </p>
                </div>
                {active ? (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">Em uso</span>
                ) : has ? (
                  <form action={setAiModelAction}>
                    <input type="hidden" name="model" value={m.id} />
                    <button className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">Usar este</button>
                  </form>
                ) : downloading.has(m.id) ? (
                  <span className="text-xs text-muted-foreground">Baixando…</span>
                ) : (
                  local.online && (
                    <form action={pullModelAction}>
                      <input type="hidden" name="model" value={m.id} />
                      <ConfirmSubmit message={`Baixar ${m.label} (~${m.sizeGb} GB)?`} className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted">
                        Baixar
                      </ConfirmSubmit>
                    </form>
                  )
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          O Claude não tem versão aberta para rodar localmente. Do Google, o aberto é o Gemma; da OpenAI, o gpt-oss.
        </p>
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Configuração">
          <ul className="grid gap-2.5">
            {checklist.map(([label, ok, hint]) => (
              <li key={label} className="flex items-start gap-2 text-sm">
                {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                <span className="min-w-0">
                  <span className={ok ? "font-medium" : "text-muted-foreground"}>{label}</span>
                  <span className="block text-xs break-words text-muted-foreground">{hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Erros recentes da fila">
          {failures.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum erro. 🎉</p>
          ) : (
            <ul className="divide-y text-sm">
              {failures.rows.map((f) => (
                <li key={f.id} className="py-2">
                  <p className="font-medium">
                    {f.type} <span className="text-xs font-normal text-muted-foreground">· tentativa {f.attempts}</span>
                  </p>
                  <p className="text-xs break-words text-destructive">{f.last_error}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
