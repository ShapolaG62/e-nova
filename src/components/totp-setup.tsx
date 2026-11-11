"use client";

import { startTransition, useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TotpSetup } from "@/app/actions/account";

/** Ativação do 2FA: QR → código de confirmação → códigos de recuperação (mostrados uma vez). */
export function TotpSetupFlow({ begin, confirm }: { begin: () => Promise<TotpSetup>; confirm: (p: TotpSetup, f: FormData) => Promise<TotpSetup> }) {
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [loading, setLoading] = useState(false);
  const [state, run, pending] = useActionState<TotpSetup, FormData>(confirm, {});
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  if (state.recovery) {
    return (
      <div className="grid gap-3">
        <p className="text-sm font-medium text-primary">2FA ativado.</p>
        <p className="text-sm">
          Guarde estes <strong>códigos de recuperação</strong> num lugar seguro. Cada um entra uma vez se você perder o celular. Eles não aparecem de novo.
        </p>
        <ul className="num grid grid-cols-2 gap-1.5 rounded-xl bg-muted p-3 text-sm">
          {state.recovery.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(state.recovery!.join("\n"));
            setCopied(true);
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copiados" : "Copiar códigos"}
        </Button>
        <Button onClick={() => router.refresh()}>Já guardei os códigos</Button>
      </div>
    );
  }

  if (!setup?.secret) {
    return (
      <div className="grid gap-2">
        <Button
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            setSetup(await begin());
            setLoading(false);
          }}
          className="h-10 w-full sm:w-auto"
        >
          {loading && <Loader2 className="animate-spin" />} Ativar verificação em duas etapas
        </Button>
        {setup?.message && <p className="text-sm text-destructive">{setup.message}</p>}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => run(fd));
      }}
      className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-5"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado no servidor (data URL) */}
      <img src={setup.qr} alt="QR Code para o app autenticador" className="size-44 rounded-xl border bg-white p-2" />
      <div className="grid gap-3">
        <p className="text-sm">1. No app autenticador, toque em “adicionar” e leia o QR.</p>
        <p className="text-xs break-all text-muted-foreground">
          Sem câmera? Digite a chave: <span className="num font-semibold text-foreground">{setup.secret}</span>
        </p>
        <p className="text-sm">2. Digite o código de 6 números que apareceu:</p>
        <Input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} className="num h-12 max-w-40 text-center text-xl tracking-[0.25em]" />
        {state.errors?.code && <p className="text-xs text-destructive">{state.errors.code[0]}</p>}
        <Button type="submit" disabled={pending} className="h-10 w-full sm:w-auto">
          {pending && <Loader2 className="animate-spin" />} Confirmar e ativar
        </Button>
      </div>
    </form>
  );
}
