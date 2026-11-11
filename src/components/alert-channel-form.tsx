"use client";

import { useState } from "react";
import { ActionForm, FieldError, FormMessage, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/validation";

const FIELDS = {
  DISCORD: [{ name: "url", label: "URL do webhook do Discord", placeholder: "https://discord.com/api/webhooks/…" }],
  TELEGRAM: [
    { name: "botToken", label: "Token do bot (@BotFather)", placeholder: "123456:ABC…" },
    { name: "chatId", label: "chat_id do grupo ou pessoa", placeholder: "-1001234567890" },
  ],
  WHATSAPP: [
    { name: "phoneNumberId", label: "Phone number ID (WhatsApp Cloud API)", placeholder: "1234567890" },
    { name: "token", label: "Token de acesso permanente", placeholder: "EAAG…" },
    { name: "to", label: "Enviar para (com DDI)", placeholder: "5511999999999" },
    { name: "templateName", label: "Template aprovado (recomendado)", placeholder: "alerta_site" },
  ],
  WEBHOOK: [{ name: "url", label: "URL (https) que recebe JSON", placeholder: "https://…" }],
} as const;

export function AlertChannelForm({ action, clients }: { action: (p: ActionState, f: FormData) => Promise<ActionState>; clients: { id: string; name: string }[] }) {
  const [kind, setKind] = useState<keyof typeof FIELDS>("DISCORD");
  const sel = "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm sm:h-9 dark:bg-input/30";
  return (
    <ActionForm action={action} resetOnSuccess className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="kind">Tipo</Label>
        <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as keyof typeof FIELDS)} className={sel}>
          <option value="DISCORD">Discord</option>
          <option value="TELEGRAM">Telegram</option>
          <option value="WHATSAPP">WhatsApp (Cloud API oficial)</option>
          <option value="WEBHOOK">Webhook genérico</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" placeholder="Plantão da agência" className="h-10 sm:h-9" />
        <FieldError name="name" />
      </div>
      {FIELDS[kind].map((f) => (
        <div key={`${kind}-${f.name}`} className="grid gap-1.5">
          <Label htmlFor={f.name}>{f.label}</Label>
          <Input id={f.name} name={f.name} placeholder={f.placeholder} autoComplete="off" className="h-10 sm:h-9" />
          <FieldError name={f.name} />
        </div>
      ))}
      {kind === "WHATSAPP" && (
        <p className="text-xs text-muted-foreground">
          Fora da janela de 24h a Meta só entrega mensagens de template. Crie um template com uma variável no corpo ({"{{1}}"}) e informe o nome acima.
        </p>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="clientId">Quem recebe</Label>
        <select id="clientId" name="clientId" defaultValue="" className={sel}>
          <option value="">Agência (todos os sites)</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              Só sites de {c.name}
            </option>
          ))}
        </select>
      </div>
      <FormMessage />
      <SubmitButton className="h-10 sm:h-9">Adicionar e testar</SubmitButton>
    </ActionForm>
  );
}
