import { Suspense } from "react";
import type { Metadata } from "next";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/auth/rbac";
import { beginTotpAction, changePasswordAction, confirmTotpAction, disableTotpAction, signOutEverywhereAction } from "@/app/actions/account";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Field } from "@/components/field";
import { Panel } from "@/components/charts";
import { PageHeader, PageSkeleton } from "@/components/page";
import { Term } from "@/components/term";
import { TotpSetupFlow } from "@/components/totp-setup";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Minha conta" };
const dt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default function Page() {
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <PageHeader title="Minha conta" subtitle="Senha, verificação em duas etapas e aparelhos conectados." />
      <Suspense fallback={<PageSkeleton />}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const me = await requireUser();
  const user = (await db.query.users.findFirst({ where: eq(t.users.id, me.id), columns: { totpEnabled: true, lastLoginAt: true, recoveryCodes: true } }))!;
  return (
    <>
      <div className="rounded-2xl border bg-card p-4 text-sm">
        <p className="font-medium">{me.name}</p>
        <p className="text-muted-foreground">
          {me.email} · {ROLE_LABEL[me.role]}
          {user.lastLoginAt && ` · último acesso ${dt.format(user.lastLoginAt)}`}
        </p>
      </div>

      <Panel
        title={
          <span className="flex items-center gap-2">
            {user.totpEnabled ? <ShieldCheck className="size-5 text-primary" /> : <ShieldAlert className="size-5 text-[var(--star)]" />}
            Verificação em duas etapas (<Term k="2FA" />)
          </span>
        }
      >
        {user.totpEnabled ? (
          <div className="grid gap-3">
            <p className="text-sm">
              Ativa. Além da senha, o login pede o código do app autenticador. Restam <strong>{user.recoveryCodes.length}</strong> códigos de recuperação.
            </p>
            <ActionForm action={disableTotpAction} className="flex flex-wrap items-end gap-2">
              <Field name="code" label="Para desligar, digite um código do app" inputMode="numeric" maxLength={6} className="w-56" />
              <SubmitButton variant="outline" className="h-10">
                Desligar 2FA
              </SubmitButton>
              <FormMessage className="w-full" />
            </ActionForm>
          </div>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">Recomendado para todos, e essencial para os sócios: mesmo que a senha vaze, ninguém entra sem o seu celular.</p>
            <TotpSetupFlow begin={beginTotpAction} confirm={confirmTotpAction} />
          </div>
        )}
      </Panel>

      <Panel title="Trocar senha">
        <ActionForm action={changePasswordAction} resetOnSuccess className="grid gap-3 sm:grid-cols-3 sm:items-start">
          <Field name="current" label="Senha atual" type="password" autoComplete="current-password" />
          <Field name="next" label="Nova senha" type="password" autoComplete="new-password" hint="12+ caracteres, letras e números" />
          <Field name="confirm" label="Repita a nova" type="password" autoComplete="new-password" />
          <FormMessage className="sm:col-span-3" />
          <div className="sm:col-span-3">
            <SubmitButton className="h-10">Trocar senha</SubmitButton>
          </div>
        </ActionForm>
      </Panel>

      <Panel title="Aparelhos conectados">
        <p className="mb-3 text-sm text-muted-foreground">Perdeu o celular ou entrou num computador que não é seu? Desconecte tudo; você precisará entrar de novo aqui também.</p>
        <form action={signOutEverywhereAction}>
          <ConfirmSubmit message="Sair de todos os aparelhos, inclusive este?" className={buttonVariants({ variant: "outline", className: "h-10" })}>
            Sair de todos os aparelhos
          </ConfirmSubmit>
        </form>
      </Panel>
    </>
  );
}
