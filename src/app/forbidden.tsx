import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">Sem permissão</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Seu perfil não tem acesso a esta área. Se precisar, peça a um dos sócios.</p>
      <Link href="/painel" className="text-sm font-medium underline underline-offset-4">
        Voltar ao painel
      </Link>
    </main>
  );
}
