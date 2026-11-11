import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ActionForm, FieldError, FormMessage, SubmitButton } from "@/components/action-form";
import { verifyMfaAction } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default function Page() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl border bg-card p-6">
          <ShieldCheck className="mb-3 size-8 text-primary" />
          <h1 className="text-xl font-bold">Digite o código do app</h1>
          <p className="mb-5 text-sm text-muted-foreground">Abra o Google Authenticator (ou similar) e digite os 6 números do E-Nova. Sem o celular? Use um código de recuperação.</p>
          <ActionForm action={verifyMfaAction} className="grid gap-4">
            <Input name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="000 000" className="num h-14 text-center text-2xl tracking-[0.3em]" maxLength={20} />
            <FieldError name="code" />
            <FormMessage />
            <SubmitButton className="h-11 w-full">Confirmar e entrar</SubmitButton>
          </ActionForm>
          <Link href="/login" className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">
            Voltar ao login
          </Link>
        </div>
      </div>
    </main>
  );
}
