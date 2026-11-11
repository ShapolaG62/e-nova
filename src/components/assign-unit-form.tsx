"use client";

import { useState } from "react";
import { ActionForm, FieldError, FormMessage, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/validation";

type Deal = "VENDA" | "ALUGUEL" | "CORTESIA";
const sel = "h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm sm:h-9";
const fmt = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export function AssignUnitForm({
  action,
  clients,
  plates,
  prices,
}: {
  action: (p: ActionState, f: FormData) => Promise<ActionState>;
  clients: { id: string; name: string }[];
  plates: { id: string; clientId: string; label: string; slug: string }[];
  prices: { sale: number; rent: number };
}) {
  const [deal, setDeal] = useState<Deal>("ALUGUEL");
  const [clientId, setClientId] = useState("");
  const [price, setPrice] = useState(fmt(prices.rent));
  const own = plates.filter((p) => p.clientId === clientId);

  const pick = (d: Deal) => {
    setDeal(d);
    setPrice(d === "VENDA" ? fmt(prices.sale) : d === "ALUGUEL" ? fmt(prices.rent) : "0");
  };

  return (
    <ActionForm action={action} className="grid gap-4">
      <input type="hidden" name="deal" value={deal} />
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Tipo de negócio">
        {(["ALUGUEL", "VENDA", "CORTESIA"] as Deal[]).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={deal === d}
            onClick={() => pick(d)}
            className={cn("rounded-lg py-2 text-sm", deal === d ? "bg-card font-semibold shadow-sm" : "text-muted-foreground")}
          >
            {d === "ALUGUEL" ? "Aluguel" : d === "VENDA" ? "Venda" : "Cortesia"}
          </button>
        ))}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="clientId">Cliente</Label>
        <select id="clientId" name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} className={sel}>
          <option value="">Escolha…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <FieldError name="clientId" />
      </div>

      {deal !== "CORTESIA" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="price">{deal === "ALUGUEL" ? "Valor por mês (R$)" : "Valor da venda (R$)"}</Label>
            <Input id="price" name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="h-10 sm:h-9" />
            <FieldError name="price" />
          </div>
          {deal === "ALUGUEL" && (
            <div className="grid gap-1.5">
              <Label htmlFor="months">Prazo (meses)</Label>
              <Input id="months" name="months" type="number" min={1} max={60} placeholder="sem prazo" className="h-10 sm:h-9" />
            </div>
          )}
        </div>
      )}
      {deal === "CORTESIA" && <input type="hidden" name="price" value="0" />}

      <div className="grid gap-1.5">
        <Label htmlFor="plateId">Link gravado na plaquinha</Label>
        <select id="plateId" name="plateId" defaultValue="" className={sel} disabled={!clientId}>
          <option value="">Criar um link novo</option>
          {own.map((p) => (
            <option key={p.id} value={p.id}>
              Usar {p.label} (/r/{p.slug})
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="label">Onde fica (para o link novo)</Label>
        <Input id="label" name="label" placeholder="Balcão, Mesa 4, Caixa…" className="h-10 sm:h-9" />
      </div>

      <FormMessage />
      <SubmitButton className="h-11">{deal === "ALUGUEL" ? "Alugar plaquinha" : deal === "VENDA" ? "Registrar venda" : "Ceder como cortesia"}</SubmitButton>
      <p className="text-xs text-muted-foreground">
        {deal === "ALUGUEL" ? "Cria um contrato mensal (entra no MRR)." : deal === "VENDA" ? "Cria um contrato avulso com o valor da venda." : "Não gera cobrança."}
      </p>
    </ActionForm>
  );
}
