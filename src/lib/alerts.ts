import "server-only";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db, t } from "@/db";
import { decryptJson } from "@/lib/crypto";
import { assertPublicUrl } from "@/lib/net-safety";

export const alertConfigSchemas = {
  DISCORD: z.object({ url: z.url().regex(/^https:\/\/(discord(app)?\.com)\/api\/webhooks\//, "Use a URL de webhook do Discord") }),
  TELEGRAM: z.object({ botToken: z.string().regex(/^\d+:[\w-]{30,}$/, "Token do bot inválido"), chatId: z.string().regex(/^-?\d+$|^@\w+$/, "chat_id inválido") }),
  // WhatsApp Cloud API oficial (Meta). Fora da janela de 24h, só mensagens de template.
  WHATSAPP: z.object({
    phoneNumberId: z.string().regex(/^\d+$/, "Phone number ID numérico"),
    token: z.string().min(20),
    to: z.string().regex(/^\d{10,15}$/, "Número com DDI, só dígitos (ex.: 5511999999999)"),
    templateName: z.string().trim().optional(),
    templateLang: z.string().trim().default("pt_BR"),
  }),
  WEBHOOK: z.object({ url: z.url({ protocol: /^https$/ }) }),
} as const;

export type AlertKind = keyof typeof alertConfigSchemas;
type EventKind = "DOWN" | "RECOVERED" | "SSL_EXPIRING" | "CONTENT_CHANGED" | "TEST" | "SECURITY";

const EMOJI: Record<EventKind, string> = { DOWN: "🔴", RECOVERED: "🟢", SSL_EXPIRING: "🔐", CONTENT_CHANGED: "📝", TEST: "🧪", SECURITY: "🛡️" };

async function deliver(kind: AlertKind, config: unknown, text: string, payload: Record<string, unknown>) {
  const signal = AbortSignal.timeout(10_000);
  const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal });

  let res: Response;
  switch (kind) {
    case "DISCORD": {
      const c = alertConfigSchemas.DISCORD.parse(config);
      res = await post(c.url, { content: text.slice(0, 1900), allowed_mentions: { parse: [] } });
      break;
    }
    case "TELEGRAM": {
      const c = alertConfigSchemas.TELEGRAM.parse(config);
      res = await post(`https://api.telegram.org/bot${c.botToken}/sendMessage`, { chat_id: c.chatId, text, disable_web_page_preview: true });
      break;
    }
    case "WHATSAPP": {
      const c = alertConfigSchemas.WHATSAPP.parse(config);
      const message = c.templateName
        ? { type: "template", template: { name: c.templateName, language: { code: c.templateLang }, components: [{ type: "body", parameters: [{ type: "text", text: text.slice(0, 1000) }] }] } }
        : { type: "text", text: { body: text.slice(0, 4000) } };
      res = await post(
        `https://graph.facebook.com/v21.0/${c.phoneNumberId}/messages`,
        { messaging_product: "whatsapp", to: c.to, ...message },
        { Authorization: `Bearer ${c.token}` },
      );
      break;
    }
    case "WEBHOOK": {
      const c = alertConfigSchemas.WEBHOOK.parse(config);
      await assertPublicUrl(c.url); // webhook genérico: não pode apontar para a rede interna
      res = await post(c.url, { text, ...payload });
      break;
    }
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/**
 * Registra o evento e envia para os canais ativos da agência (clientId null)
 * e do cliente dono do monitor. Falha num canal não impede os outros.
 */
export async function sendAlert(input: { kind: EventKind; message: string; monitorId?: string | null; clientId?: string | null; onlyChannelId?: string }) {
  const where = input.onlyChannelId
    ? eq(t.alertChannels.id, input.onlyChannelId)
    : and(
        eq(t.alertChannels.active, true),
        input.clientId ? or(isNull(t.alertChannels.clientId), eq(t.alertChannels.clientId, input.clientId)) : isNull(t.alertChannels.clientId),
      );
  const channels = await db.select().from(t.alertChannels).where(where);
  const text = `${EMOJI[input.kind]} E-Nova · ${input.message}`;

  const deliveries = await Promise.all(
    channels.map(async (ch) => {
      try {
        await deliver(ch.kind, decryptJson(ch.configEnc), text, { kind: input.kind, monitorId: input.monitorId });
        return { channel: ch.name, ok: true };
      } catch (e) {
        return { channel: ch.name, ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 300) };
      }
    }),
  );

  await db.insert(t.alertEvents).values({ monitorId: input.monitorId ?? null, kind: input.kind, message: input.message, deliveries });
  return deliveries;
}
