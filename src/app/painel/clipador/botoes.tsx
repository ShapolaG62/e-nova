"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Repeat2, Trash2 } from "lucide-react";
import { excluirCanalAction, repostarAction, verificarAgoraAction } from "@/app/actions/clipador";
import type { ActionState } from "@/lib/validation";

function useAcao() {
  const [pendente, iniciar] = useTransition();
  const rodar = (f: () => Promise<ActionState>) => iniciar(async () => {
    const r = await f();
    if (r.ok) toast.success(r.message ?? "Feito"); else toast.error(r.message ?? "Não deu certo");
  });
  return { pendente, rodar };
}

const btn = "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium hover:bg-muted disabled:opacity-60 sm:h-9";

export function VerificarAgora({ id }: { id: string }) {
  const { pendente, rodar } = useAcao();
  return <button type="button" disabled={pendente} onClick={() => rodar(() => verificarAgoraAction(id))} className={btn}><RefreshCw className="size-3.5" aria-hidden /> Verificar agora</button>;
}

export function Repostar({ id, texto = "Repostar" }: { id: string; texto?: string }) {
  const { pendente, rodar } = useAcao();
  return <button type="button" disabled={pendente} onClick={() => rodar(() => repostarAction(id))} className={btn}><Repeat2 className="size-3.5" aria-hidden /> {pendente ? "Enviando…" : texto}</button>;
}

export function ExcluirCanal({ id, nome, voltar }: { id: string; nome: string; voltar?: boolean }) {
  const { pendente, rodar } = useAcao();
  const router = useRouter();
  return (
    <button type="button" disabled={pendente} className={`${btn} text-destructive`}
      onClick={() => {
        if (!confirm(`Parar de vigiar ${nome}? Os posts já criados continuam em Publicações.`)) return;
        rodar(async () => { const r = await excluirCanalAction(id); if (r.ok && voltar) router.push("/painel/clipador"); return r; });
      }}>
      <Trash2 className="size-3.5" aria-hidden /> Remover
    </button>
  );
}
