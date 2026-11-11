import { eq } from "drizzle-orm";
import { CheckCircle2, Link2 } from "lucide-react";
import { db, t } from "@/db";
import type { Client } from "@/db/schema";
import { disconnectIntegrationAction, updateAssistantAction } from "@/app/actions/ai";
import { ActionForm, FormMessage, SubmitButton } from "@/components/action-form";
import { Field } from "@/components/field";
import { Panel } from "@/components/charts";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button";
import { PROVIDERS, type Provider } from "@/lib/social/oauth";
import { features } from "@/lib/env";

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

/** Assistente de avaliação + conexões OAuth do cliente. */
export async function ClientAutomation({ client }: { client: Client }) {
  const integrations = await db.select().from(t.integrations).where(eq(t.integrations.clientId, client.id));
  const byProvider = new Map(integrations.map((i) => [i.provider, i]));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Panel title="Assistente de avaliação (IA)">
        <ActionForm action={updateAssistantAction.bind(null, client.id)} className="grid gap-3">
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="reviewAssistant" defaultChecked={client.reviewAssistant} className="mt-0.5 size-4 accent-[var(--primary)]" />
            <span>
              <span className="font-medium">Ativar nas plaquinhas</span>
              <span className="block text-xs text-muted-foreground">
                O cliente escolhe nota e o que gostou, a IA sugere um texto editável e ele segue para o Google. Qualquer nota vai para o Google (sem filtrar negativas, conforme a política do Google).
              </span>
            </span>
          </label>
          <Field name="reviewTags" label="Opções que o cliente pode marcar" hint="Uma por linha (até 16). Vazio = opções genéricas.">
            <Textarea id="reviewTags" name="reviewTags" rows={4} defaultValue={client.reviewTags.join("\n")} placeholder={"Atendimento ágil\nAmbiente aconchegante\nCorte impecável"} />
          </Field>
          <Field name="brandVoice" label="Tom de voz da marca" hint="Usado nas respostas a avaliações e nos roteiros.">
            <Textarea id="brandVoice" name="brandVoice" rows={2} defaultValue={client.brandVoice ?? ""} placeholder="Próximo e bem-humorado, trata por 'você', sem gírias pesadas" />
          </Field>
          <Field
            name="googleLocationName"
            label="Local no Google Business Profile"
            placeholder="accounts/123/locations/456"
            defaultValue={client.googleLocationName ?? ""}
            hint="Necessário para sincronizar e responder avaliações pela API."
          />
          <FormMessage />
          <div>
            <SubmitButton className="h-10 w-full sm:h-9 sm:w-auto">Salvar</SubmitButton>
          </div>
        </ActionForm>
      </Panel>

      <Panel title="Contas conectadas">
        {!features.encryption && (
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Defina <code>ENCRYPTION_KEY</code> no servidor para poder conectar contas (os tokens ficam criptografados).
          </p>
        )}
        <ul className="divide-y">
          {(Object.keys(PROVIDERS) as Provider[]).map((p) => {
            const cfg = PROVIDERS[p];
            const integ = byProvider.get(p);
            const enabled = cfg.enabled() && features.encryption;
            return (
              <li key={p} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    {integ && <CheckCircle2 className="size-4 text-emerald-600" />}
                    {cfg.label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {integ
                      ? `${integ.accountLabel ?? "Conta conectada"}${integ.expiresAt ? ` · token até ${dateFmt.format(integ.expiresAt)}` : ""}`
                      : enabled
                        ? "Não conectado"
                        : "App da plataforma não configurado no servidor"}
                  </p>
                  {integ?.lastError && <p className="text-xs text-destructive">{integ.lastError}</p>}
                </div>
                {integ ? (
                  <form action={disconnectIntegrationAction}>
                    <input type="hidden" name="clientId" value={client.id} />
                    <input type="hidden" name="provider" value={p} />
                    <button className="text-xs text-muted-foreground underline-offset-2 hover:underline">Desconectar</button>
                  </form>
                ) : null}
                {enabled && (
                  <a href={`/api/integracoes/${p.toLowerCase()}/conectar?cliente=${client.id}`} className={buttonVariants({ variant: integ ? "ghost" : "outline", size: "sm" })}>
                    <Link2 /> {integ ? "Reconectar" : "Conectar"}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          A conexão é feita pelo login oficial de cada plataforma, com o dono da conta. Nunca pedimos ou guardamos senhas.
        </p>
      </Panel>
    </div>
  );
}
