import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { TEXTO_AUTORIZACAO } from "@/lib/clipador/textos";
import { adicionarCanalAction } from "@/app/actions/clipador";
import { ActionForm, FieldError, FormMessage, SubmitButton } from "@/components/action-form";
import { ClientSelect } from "@/components/client-filter";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/page";
import { Opcoes } from "../comum";

export const metadata: Metadata = { title: "Vigiar novo perfil · Clipador" };

export default async function Page() {
  await requirePermission("content:write");
  return (
    <div className="grid max-w-2xl grid-cols-1 gap-6">
      <Link href="/painel/clipador" className="inline-flex h-10 items-center gap-1.5 justify-self-start text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Voltar para a lista
      </Link>
      <PageHeader title="Vigiar novo perfil" subtitle="Depois de salvar, você vai para a página do perfil para colocar a marca d'água e acompanhar os vídeos." />
      <ActionForm action={adicionarCanalAction} className="grid gap-4 rounded-2xl border bg-card p-4">
        <Field name="url" label="Link do perfil" placeholder="youtube.com/@canal, tiktok.com/@perfil ou instagram.com/perfil" hint="YouTube e TikTok funcionam direto. Instagram precisa do Instagram profissional do cliente conectado em Integrações, e o perfil vigiado deve ser profissional ou de criador." />
        <Field name="clientId" label="Postar nas redes de" hint="As contas conectadas desse cliente em Integrações (pode ser você mesmo como cliente).">
          <ClientSelect required allowEmpty emptyLabel="Escolha…" />
        </Field>
        <Opcoes />
        <div className="grid gap-2 rounded-xl border border-signal/40 bg-signal/5 p-3 text-sm">
          <label className="flex items-start gap-2.5">
            <input type="checkbox" name="autorizado" className="mt-0.5 size-4 accent-[var(--primary)]" />
            <span>{TEXTO_AUTORIZACAO}</span>
          </label>
          <FieldError name="autorizado" />
          <Field name="comoAutorizado" label="Como você tem a autorização?" placeholder="Ex.: sou clipador oficial do perfil pelo programa X" />
        </div>
        <FormMessage />
        <SubmitButton className="h-11 w-full sm:h-10">Começar a vigiar</SubmitButton>
        <p className="text-xs text-muted-foreground">Vídeos que já existiam não são repostados automaticamente (dá para repostar um por um na página do perfil).</p>
      </ActionForm>
    </div>
  );
}
