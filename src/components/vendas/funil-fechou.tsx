"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { converterClienteAction } from "@/app/actions/vendas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LeadFunil } from "./funil-tipos";
import { reais } from "./funil-tipos";

/** "Fechou!": transforma o contato em Cliente do ERP com os contratos de criação e mensalidade. */
export function DialogFechou({ lead, aoFechar, aoConvertido }: { lead: LeadFunil | null; aoFechar: () => void; aoConvertido: (clientId: string) => void }) {
  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="sm:max-w-md">{lead && <Formulario key={lead.id} lead={lead} aoFechar={aoFechar} aoConvertido={aoConvertido} />}</DialogContent>
    </Dialog>
  );
}

function Formulario({ lead, aoFechar, aoConvertido }: { lead: LeadFunil; aoFechar: () => void; aoConvertido: (clientId: string) => void }) {
  const router = useRouter();
  const [setup, setSetup] = useState(lead.propostaCents ? reais(lead.propostaCents) : "750,00");
  const [mensal, setMensal] = useState("49,90");
  const [servico, setServico] = useState("Criação de site");
  const [enviando, setEnviando] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        const r = await converterClienteAction(lead.id, { setup, mensal, servico });
        setEnviando(false);
        if (!r.ok) {
          toast.error(r.message);
          return;
        }
        toast.success(`${lead.nome} agora é cliente!`, {
          description: "Contratos criados na ficha do cliente.",
          action: { label: "Ver cliente", onClick: () => router.push(`/painel/clientes/${r.data}`) },
          duration: 8000,
        });
        aoConvertido(r.data);
      }}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <PartyPopper className="size-5 text-star" /> Fechou! Converter em cliente
        </DialogTitle>
        <DialogDescription>
          <b className="text-foreground">{lead.nome}</b> vira cliente do E-Nova, com o contrato da criação e, se houver, a mensalidade.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="fechou-setup">Valor da criação (R$)</Label>
          <Input id="fechou-setup" inputMode="decimal" value={setup} onChange={(e) => setSetup(e.target.value)} className="h-10" placeholder="750,00" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="fechou-mensal">Mensalidade (opcional)</Label>
          <Input id="fechou-mensal" inputMode="decimal" value={mensal} onChange={(e) => setMensal(e.target.value)} className="h-10" placeholder="0,00" />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="fechou-servico">Serviço</Label>
          <Input id="fechou-servico" value={servico} maxLength={120} onChange={(e) => setServico(e.target.value)} className="h-10" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Deixe a mensalidade em branco (ou 0) se não houver manutenção mensal.</p>
      <DialogFooter>
        <Button type="button" variant="outline" className="h-10" onClick={aoFechar} disabled={enviando}>
          Agora não
        </Button>
        <Button type="submit" className="h-10" disabled={enviando}>
          {enviando && <Loader2 className="animate-spin" />} Converter em cliente
        </Button>
      </DialogFooter>
    </form>
  );
}
