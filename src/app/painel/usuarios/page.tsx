import { Suspense } from "react";
import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requirePermission } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/auth/rbac";
import { createUserAction, toggleUserAction } from "@/app/actions/users";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { Field, selectClass } from "@/components/field";
import { Panel } from "@/components/charts";
import { PageHeader, PageSkeleton } from "@/components/page";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Usuários" };

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title="Usuários" subtitle="Sócios, equipe e acessos de clientes." />
      <Suspense fallback={<PageSkeleton />}>
        <Users />
      </Suspense>
    </div>
  );
}

async function Users() {
  const me = await requirePermission("users:manage");
  const [users, clients] = await Promise.all([
    db
      .select({
        id: t.users.id,
        name: t.users.name,
        email: t.users.email,
        role: t.users.role,
        active: t.users.active,
        client: t.clients.tradeName,
      })
      .from(t.users)
      .leftJoin(t.clients, eq(t.clients.id, t.users.clientId))
      .orderBy(asc(t.users.role), asc(t.users.name)),
    db.select({ id: t.clients.id, name: t.clients.tradeName }).from(t.clients).orderBy(asc(t.clients.tradeName)),
  ]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
      <ul className="divide-y self-start overflow-hidden rounded-xl border bg-card">
        {users.map((u) => (
          <li key={u.id} className={cn("flex items-center gap-3 px-4 py-3", !u.active && "opacity-60")}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {u.name} {u.id === me.id && <span className="text-xs text-muted-foreground">(você)</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {u.email}
                {u.client && ` · ${u.client}`}
              </p>
            </div>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs whitespace-nowrap">{ROLE_LABEL[u.role]}</span>
            {u.id !== me.id && (
              <form action={toggleUserAction}>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="active" value={String(!u.active)} />
                <button className="text-xs text-muted-foreground underline-offset-2 hover:underline">{u.active ? "Desativar" : "Reativar"}</button>
              </form>
            )}
          </li>
        ))}
      </ul>

      <Panel title="Novo usuário" className="self-start">
        <ActionForm action={createUserAction} resetOnSuccess className="grid gap-3">
          <Field name="name" label="Nome" required />
          <Field name="email" label="E-mail" type="email" autoComplete="off" required />
          <Field name="password" label="Senha inicial" type="password" autoComplete="new-password" hint="Mínimo de 10 caracteres." required />
          <Field name="role" label="Perfil">
            <select id="role" name="role" defaultValue="MEMBER" className={selectClass}>
              <option value="MEMBER">Equipe</option>
              <option value="CLIENT">Cliente (dono do estabelecimento)</option>
              <option value="SUPER_ADMIN">Sócio (acesso total)</option>
            </select>
          </Field>
          <Field name="clientId" label="Estabelecimento (só para perfil Cliente)">
            <select id="clientId" name="clientId" defaultValue="" className={selectClass}>
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <FormMessage />
          <SubmitButton className="h-10 sm:h-9">Criar usuário</SubmitButton>
        </ActionForm>
      </Panel>
    </div>
  );
}
