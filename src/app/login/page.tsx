import type { Metadata } from "next";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { Field } from "@/components/field";
import { loginAction } from "@/app/actions/auth";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border bg-background p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Entrar no painel</h1>
          <p className="mb-5 text-sm text-muted-foreground">Agência, equipe e clientes usam o mesmo acesso.</p>
          <ActionForm action={loginAction} className="grid gap-4">
            <Field name="email" label="E-mail ou usuário" type="text" autoComplete="username" autoCapitalize="none" required />
            <Field name="password" label="Senha" type="password" autoComplete="current-password" required />
            <FormMessage />
            <SubmitButton className="h-10 w-full">Entrar</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
