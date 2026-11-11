"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import type { SiteDoc } from "@/lib/sites/engine";
import { pedirIAAction } from "@/app/actions/vendas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EXEMPLOS_IA, NOMES_BLOCO } from "./editor-schema";

export function PedirIA({
  aberto,
  aoFechar,
  siteId,
  docRef,
  tipo,
  aoAplicar,
}: {
  aberto: { blocoId: string | null } | null;
  aoFechar: () => void;
  siteId: string;
  docRef: React.RefObject<SiteDoc>;
  tipo: string | null;
  aoAplicar: (doc: SiteDoc) => void;
}) {
  const [instrucao, setInstrucao] = useState("");
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState("");
  const blocoId = aberto?.blocoId ?? null;

  const enviar = async () => {
    const txt = instrucao.trim();
    if (!txt) {
      setErro("Escreva o que você quer mudar.");
      return;
    }
    setErro("");
    setPensando(true);
    try {
      const r = await pedirIAAction(siteId, docRef.current, txt, blocoId);
      if (!r.ok) {
        setErro(r.message || "A IA não conseguiu fazer agora. Tente de novo em instantes.");
        return;
      }
      aoAplicar(r.data);
      setInstrucao("");
      aoFechar();
    } catch {
      setErro("A IA não respondeu. Confira a conexão e tente de novo.");
    } finally {
      setPensando(false);
    }
  };

  return (
    <Dialog
      open={!!aberto}
      onOpenChange={(o) => {
        if (!o && !pensando) {
          setErro("");
          aoFechar();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Pedir para a IA
          </DialogTitle>
          <DialogDescription>{tipo ? `Só no bloco "${NOMES_BLOCO[tipo] ?? tipo}"` : "No site inteiro"}</DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          rows={4}
          value={instrucao}
          disabled={pensando}
          onChange={(e) => setInstrucao(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar();
          }}
          placeholder="Ex.: deixe os textos mais curtos e fale de agendamento online"
          className="text-sm"
          maxLength={600}
        />
        <div className="flex flex-wrap gap-1.5">
          {EXEMPLOS_IA.map((x) => (
            <button
              key={x}
              type="button"
              disabled={pensando}
              onClick={() => setInstrucao(x)}
              className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
            >
              {x}
            </button>
          ))}
        </div>
        {erro && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {erro}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" className="h-10" onClick={aoFechar} disabled={pensando}>
            Cancelar
          </Button>
          <Button className="h-10" onClick={enviar} disabled={pensando}>
            {pensando ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {pensando ? "Pensando…" : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
