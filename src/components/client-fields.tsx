import { Field } from "@/components/field";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/db/schema";
import { formatDocument } from "@/lib/validation";

/** Campos do cadastro de cliente (usados em "novo" e "editar"). */
export function ClientFields({ c }: { c?: Partial<Client> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="tradeName" label="Nome fantasia" defaultValue={c?.tradeName ?? ""} required />
      <Field name="legalName" label="Razão social" defaultValue={c?.legalName ?? ""} required />
      <Field name="document" label="CNPJ ou CPF" inputMode="numeric" defaultValue={c?.document ? formatDocument(c.document) : ""} />
      <Field name="niche" label="Nicho" placeholder="Restaurante, clínica, barbearia…" defaultValue={c?.niche ?? ""} />
      <Field name="contactName" label="Responsável" defaultValue={c?.contactName ?? ""} />
      <Field name="contactPhone" label="WhatsApp" inputMode="tel" placeholder="(11) 99999-9999" defaultValue={c?.contactPhone ?? ""} />
      <Field name="contactEmail" label="E-mail" type="email" defaultValue={c?.contactEmail ?? ""} className="sm:col-span-2" />
      <Field
        name="googlePlaceId"
        label="Google Place ID"
        className="sm:col-span-2"
        placeholder="ChIJ… ou cole o link de avaliação do Google"
        hint="Sem Place ID, a plaquinha mostra a página 'quase pronto' em vez de ir para o Google."
        defaultValue={c?.googlePlaceId ?? ""}
      />
      <Field name="logoUrl" label="Logo (link https, opcional)" className="sm:col-span-2" hint="Usado no centro do QR Code." defaultValue={c?.logoUrl ?? ""} />
      <Field name="notes" label="Observações" className="sm:col-span-2">
        <Textarea id="notes" name="notes" rows={3} defaultValue={c?.notes ?? ""} />
      </Field>
    </div>
  );
}
