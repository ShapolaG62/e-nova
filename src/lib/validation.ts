import { z } from "zod";

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

function validCpf(d: string) {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

function validCnpj(d: string) {
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = w.reduce((acc, wi, i) => acc + Number(d[i]) * wi, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export function formatDocument(d: string | null) {
  if (!d) return "—";
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return d;
}

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optText = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable());

/** Aceita o Place ID puro ou um link do Google que contenha placeid=… */
const placeId = z.preprocess(
  (v) => {
    if (typeof v !== "string" || !v.trim()) return null;
    const m = /[?&]place_?id=([^&#\s]+)/i.exec(v);
    return m ? decodeURIComponent(m[1]) : v.trim();
  },
  z
    .string()
    .regex(/^[A-Za-z0-9_-]{10,200}$/, "Place ID inválido (ex.: ChIJN1t_tDeuEmsRUsoyG83frY4)")
    .nullable(),
);

export const clientSchema = z.object({
  legalName: z.string().trim().min(2, "Informe a razão social").max(200),
  tradeName: z.string().trim().min(2, "Informe o nome fantasia").max(200),
  document: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? onlyDigits(v) : null),
    z
      .string()
      .refine((d) => validCpf(d) || validCnpj(d), "CPF/CNPJ inválido")
      .nullable(),
  ),
  niche: optText(80),
  contactName: optText(120),
  contactEmail: z.preprocess(emptyToNull, z.email("E-mail inválido").max(200).nullable()),
  contactPhone: z.preprocess((v) => (typeof v === "string" && v.trim() ? onlyDigits(v) : null), z.string().min(10, "Telefone com DDD").max(13).nullable()),
  googlePlaceId: placeId,
  logoUrl: z.preprocess(emptyToNull, z.url({ protocol: /^https$/, error: "Use um link https" }).nullable()),
  notes: optText(2000),
});

export const clientStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED_PAYMENT", "TRIAL"]),
  trialDays: z.coerce.number().int().min(1).max(90).optional(),
});

export const contractSchema = z.object({
  type: z.enum(["RECURRING", "ONE_OFF"]),
  service: z.string().trim().min(2).max(120),
  // "149,90" ou "149.90" → centavos
  amount: z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/\./g, "").replace(",", ".")) : v),
    z.number({ error: "Valor inválido" }).nonnegative().max(1_000_000),
  ),
});

export const SLUG_HINT = "minúsculas, números e hífen (3 a 64)";
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/, `Slug: ${SLUG_HINT}`);

export const plateSchema = z.object({
  label: z.string().trim().min(1, "Dê um nome (ex.: Balcão)").max(120),
  kind: z.enum(["NFC", "QR", "NFC_QR"]),
  slug: z.preprocess(emptyToNull, slugSchema.nullable()),
  destinationOverride: z.preprocess(emptyToNull, z.url({ protocol: /^https$/, error: "Use um link https" }).nullable()),
});

export const userSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.email("E-mail inválido").trim().toLowerCase(),
    password: z.string().min(10, "Senha com pelo menos 10 caracteres").max(200),
    role: z.enum(["SUPER_ADMIN", "MEMBER", "CLIENT"]),
    clientId: z.preprocess(emptyToNull, z.uuid().nullable()),
  })
  .refine((u) => u.role !== "CLIENT" || !!u.clientId, { message: "Usuário cliente precisa de um estabelecimento", path: ["clientId"] });

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export type ActionState = { ok?: boolean; message?: string; errors?: Record<string, string[] | undefined> };

export function zodErrors(err: z.ZodError): ActionState {
  return { ok: false, message: "Confira os campos destacados.", errors: z.flattenError(err).fieldErrors as ActionState["errors"] };
}

export const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
