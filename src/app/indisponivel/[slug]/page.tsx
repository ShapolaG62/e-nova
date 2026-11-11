import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Temporariamente indisponível", robots: { index: false } };

const MESSAGES: Record<string, { title: string; body: string }> = {
  suspended: {
    title: "Avaliação temporariamente indisponível",
    body: "Este link de avaliação está em manutenção no momento. Obrigado pelo carinho — tente novamente mais tarde!",
  },
  trial_expired: {
    title: "Avaliação temporariamente indisponível",
    body: "Este link de avaliação está em manutenção no momento. Tente novamente mais tarde.",
  },
  no_destination: {
    title: "Quase pronto!",
    body: "Esta plaquinha ainda está sendo configurada. Em breve você poderá deixar sua avaliação por aqui.",
  },
  nao_encontrada: {
    title: "Plaquinha não encontrada",
    body: "Não encontramos este link. Confira se a plaquinha está correta ou fale com o estabelecimento.",
  },
  erro: {
    title: "Algo deu errado",
    body: "Tivemos uma instabilidade momentânea. Aproxime o celular da plaquinha de novo em alguns segundos.",
  },
};

async function Message({ searchParams }: { searchParams: PageProps<"/indisponivel/[slug]">["searchParams"] }) {
  const { motivo } = await searchParams;
  const m = MESSAGES[typeof motivo === "string" ? motivo : ""] ?? MESSAGES.suspended;
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">{m.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{m.body}</p>
    </>
  );
}

export default function Page(props: PageProps<"/indisponivel/[slug]">) {
  return (
    <main className="marca-enova flex min-h-dvh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-background p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100 text-2xl">
          ⏳
        </div>
        <Suspense fallback={<div className="h-16" />}>
          <Message searchParams={props.searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
