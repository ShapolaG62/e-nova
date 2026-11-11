import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { createClientAction } from "@/app/actions/clients";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { ClientFields } from "@/components/client-fields";
import { PageHeader } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Novo cliente" };

async function Guard({ children }: { children: React.ReactNode }) {
  await requirePermission("clients:write");
  return children;
}

export default function Page() {
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-5">
      <PageHeader title="Novo cliente" subtitle="Entra em trial de 14 dias. Você muda o status depois." />
      <Suspense>
        <Guard>
          <ActionForm action={createClientAction} className="grid grid-cols-1 gap-5 rounded-xl border bg-card p-4 sm:p-6">
            <ClientFields />
            <FormMessage />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Link href="/painel/clientes" className={buttonVariants({ variant: "outline", className: "h-10 sm:h-9" })}>
                Cancelar
              </Link>
              <SubmitButton className="h-10 sm:h-9">Cadastrar cliente</SubmitButton>
            </div>
          </ActionForm>
        </Guard>
      </Suspense>
    </div>
  );
}
