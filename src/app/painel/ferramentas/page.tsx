import { Suspense } from "react";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { PageHeader, PageSkeleton } from "@/components/page";
import { candidatos } from "@/lib/ia-hub/roteador";
import { chavePixabay } from "@/lib/ferramentas/pixabay";
import { ehFerramenta } from "@/lib/ferramentas/catalogo";
import { Ferramentas } from "./ferramentas";

export const metadata: Metadata = { title: "Ferramentas" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function Page(props: Props) {
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader
        title="Ferramentas"
        subtitle="Converter, comprimir, cortar e baixar vídeos, QR Code, conta-gotas, tradutor, câmbio e outras utilidades do dia a dia, tudo num lugar só."
      />
      <Suspense fallback={<PageSkeleton />}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Conteudo({ searchParams }: Props) {
  const me = await requirePermission("ai:use");
  const { f } = await searchParams;
  const [chave, texto] = await Promise.all([chavePixabay().catch(() => null), candidatos("texto").catch(() => [])]);
  return (
    <Ferramentas
      inicial={ehFerramenta(f) ? f : null}
      temChavePixabay={!!chave}
      iaPronta={texto.some((c) => c.temChave)}
      podeConfigurar={can(me.role, "system:view")}
    />
  );
}
