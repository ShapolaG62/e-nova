import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { desc, eq, sql } from "drizzle-orm";
import { db, t } from "@/db";
import type { SecurityFinding } from "@/db/schema";
import { requirePermission } from "@/lib/auth/session";
import { scanNowAction } from "@/app/actions/monitors";
import { Kpi, Panel } from "@/components/charts";
import { GradeBadge, FindingList } from "@/components/security-ui";
import { PageHeader, PageSkeleton } from "@/components/page";
import { Term } from "@/components/term";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Segurança" };
const dt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

const ACTION_LABEL: Record<string, string> = {
  "login.ok": "Entrou",
  "login.fail": "Errou a senha",
  "login.locked": "Tentou com conta bloqueada",
  "login.mfa_fail": "Errou o código 2FA",
  "login.ok_recovery_code": "Entrou com código de recuperação",
  logout: "Saiu",
  "account.password_change": "Trocou a senha",
  "account.signout_all": "Saiu de todos os aparelhos",
  "account.2fa_enable": "Ativou o 2FA",
  "account.2fa_disable": "Desligou o 2FA",
  "client.status": "Mudou status de cliente",
  "user.create": "Criou usuário",
  "user.activate": "Reativou usuário",
  "user.deactivate": "Desativou usuário",
  "integration.connect": "Conectou conta",
  "integration.disconnect": "Desconectou conta",
  "ai.model": "Trocou o modelo de IA",
  "ai.pull": "Baixou modelo de IA",
};

export default function Page(props: PageProps<"/painel/seguranca">) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Segurança" subtitle="Nota de segurança dos sites dos clientes, quem fez o quê no sistema e quem ainda não protegeu a conta." />
      <Suspense fallback={<PageSkeleton />}>
        <Security searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Security({ searchParams }: { searchParams: PageProps<"/painel/seguranca">["searchParams"] }) {
  await requirePermission("system:view");
  const { aba } = await searchParams;
  const tab = aba === "auditoria" ? "auditoria" : aba === "equipe" ? "equipe" : "sites";

  const [sites, [counts]] = await Promise.all([
    db.execute<{ id: string; name: string; url: string; client: string | null; grade: string | null; score: number | null; findings: SecurityFinding[] | null; scanned_at: Date | null }>(sql`
      select m.id, m.name, m.url, c.trade_name as client, s.grade, s.score, s.findings, s.created_at as scanned_at
      from monitors m
      left join clients c on c.id = m.client_id
      left join lateral (select * from security_scans x where x.monitor_id = m.id order by x.created_at desc limit 1) s on true
      order by s.score asc nulls first, m.name`),
    db
      .select({
        no2fa: sql<number>`count(*) filter (where ${t.users.active} and not ${t.users.totpEnabled})::int`,
        admins_no2fa: sql<number>`count(*) filter (where ${t.users.active} and not ${t.users.totpEnabled} and ${t.users.role} = 'SUPER_ADMIN')::int`,
        locked: sql<number>`count(*) filter (where ${t.users.lockedUntil} > now())::int`,
        fails24: sql<number>`(select count(*) from audit_logs where action like 'login.%fail%' and created_at > now() - interval '24 hours')::int`,
      })
      .from(t.users),
  ]);
  const critical = sites.rows.filter((s) => s.findings?.some((f) => f.severity === "critica")).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi featured className="col-span-2" label="Sites com problema crítico" value={critical} hint={critical ? "abra a lista abaixo e corrija primeiro" : "nenhum achado crítico na última varredura"} />
        <Kpi label={<>Sócios sem <Term k="2FA" /></>} value={<span className={counts.admins_no2fa ? "text-destructive" : ""}>{counts.admins_no2fa}</span>} hint={`${counts.no2fa} usuários no total`} />
        <Kpi label="Logins errados (24h)" value={counts.fails24} hint={counts.locked ? `${counts.locked} conta(s) bloqueada(s) agora` : undefined} />
      </div>

      <div className="flex gap-1 rounded-xl bg-muted p-1 sm:w-fit">
        {[
          ["sites", "Sites dos clientes"],
          ["auditoria", "Auditoria"],
          ["equipe", "Equipe"],
        ].map(([k, label]) => (
          <Link key={k} href={`/painel/seguranca?aba=${k}`} className={cn("flex-1 rounded-lg px-3 py-2 text-center text-sm sm:flex-none sm:px-4", tab === k ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}>
            {label}
          </Link>
        ))}
      </div>

      {tab === "sites" && (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Varredura diária e passiva: HTTPS/<Term k="TLS" />, <Term k="HSTS" />, <Term k="CSP" />, cookies, conteúdo misto, WordPress e arquivos sensíveis expostos. Só lê o que é público, como um navegador.
          </p>
          {sites.rows.length === 0 && <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Cadastre sites em “Sites” para começar.</p>}
          {sites.rows.map((s) => (
            <details key={s.id} className="group rounded-2xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                <GradeBadge grade={s.grade} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.client ?? "Agência"} · {s.scanned_at ? `verificado ${dt.format(new Date(s.scanned_at))}` : "ainda não verificado"}
                  </span>
                </span>
                {s.findings && (
                  <span className="text-right text-xs text-muted-foreground">{s.findings.filter((f) => f.severity !== "ok").length} achados</span>
                )}
              </summary>
              <div className="border-t px-4 py-3">
                {s.findings ? <FindingList findings={s.findings} /> : <p className="text-sm text-muted-foreground">Sem varredura ainda.</p>}
                <form action={scanNowAction} className="mt-3">
                  <input type="hidden" name="id" value={s.id} />
                  <button className="text-sm font-medium text-primary hover:underline">Escanear agora</button>
                </form>
              </div>
            </details>
          ))}
        </div>
      )}

      {tab === "auditoria" && <AuditLog />}
      {tab === "equipe" && <Team />}
    </>
  );
}

async function AuditLog() {
  const rows = await db.select().from(t.auditLogs).orderBy(desc(t.auditLogs.createdAt)).limit(150);
  return (
    <Panel title="Últimos 150 eventos">
      <ul className="divide-y text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
            <span className={cn("font-medium", /fail|locked|disable/.test(r.action) && "text-destructive")}>{ACTION_LABEL[r.action] ?? r.action}</span>
            <span className="text-muted-foreground">{r.userLabel ?? "sistema"}</span>
            {Object.keys(r.meta).length > 0 && <span className="min-w-0 truncate text-xs text-muted-foreground">{JSON.stringify(r.meta).slice(0, 90)}</span>}
            <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground">{dt.format(r.createdAt)}</span>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento ainda.</p>}
    </Panel>
  );
}

async function Team() {
  const users = await db
    .select({ id: t.users.id, name: t.users.name, email: t.users.email, role: t.users.role, totp: t.users.totpEnabled, locked: t.users.lockedUntil, last: t.users.lastLoginAt, active: t.users.active })
    .from(t.users)
    .where(eq(t.users.active, true))
    .orderBy(t.users.totpEnabled, t.users.name);
  return (
    <Panel title="Proteção das contas">
      <ul className="divide-y">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-2.5">
            {u.totp ? <ShieldCheck className="size-5 shrink-0 text-primary" /> : <ShieldAlert className="size-5 shrink-0 text-[var(--star)]" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{u.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {u.email} · {u.last ? `último acesso ${dt.format(u.last)}` : "nunca entrou"}
              </span>
            </span>
            <span className="text-xs">{u.totp ? "2FA ativo" : "sem 2FA"}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Cada pessoa ativa o 2FA em “Minha conta”. Sócios sem 2FA são o maior risco do sistema.</p>
    </Panel>
  );
}
