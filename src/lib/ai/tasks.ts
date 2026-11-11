import "server-only";
import { z } from "zod";
import { generate } from "./client";

/* Conteúdo vindo do usuário (avaliações, temas) vai SEMPRE delimitado em tags
   e tratado como dado — nunca como instrução — para resistir a prompt injection. */
const fence = (tag: string, value: string) => `<${tag}>\n${value.replace(new RegExp(`</?${tag}>`, "gi"), "")}\n</${tag}>`;

// ─── 1. Sugestão de avaliação para o consumidor (página pública) ─────────
export const ReviewSuggestionSchema = z.object({
  suggestions: z.array(z.string()).describe("3 versões curtas e diferentes entre si"),
});

export async function suggestReviewText(input: { business: string; niche: string | null; tags: string[]; stars: number; clientId: string }) {
  const system = `Você ajuda clientes reais de um comércio local a escrever, com as próprias palavras, uma avaliação para o Google.
Regras:
- Escreva em português do Brasil, primeira pessoa, tom natural de cliente comum (nada de linguagem publicitária).
- Use SOMENTE as experiências marcadas pelo cliente. Não invente fatos, pratos, nomes de funcionários, preços ou números.
- 1 a 3 frases cada; varie a estrutura entre as versões; no máximo 1 emoji, e só em uma das versões.
- A nota informada define o tom: 5 entusiasmado, 4 positivo com leveza, 3 ou menos equilibrado e honesto.
- Não peça nem mencione descontos, brindes ou incentivos.`;
  const prompt = `${fence("estabelecimento", `${input.business}${input.niche ? ` (${input.niche})` : ""}`)}
${fence("experiencias_marcadas", input.tags.join("\n"))}
Nota dada pelo cliente: ${input.stars} de 5.
Gere 3 sugestões.`;
  return generate({
    kind: "REVIEW_SUGGESTION",
    schema: ReviewSuggestionSchema,
    system,
    prompt,
    effort: "low",
    maxTokens: 2000,
    log: { clientId: input.clientId, title: `Sugestão (${input.stars}★)`, input },
  });
}

// ─── 2. Resposta a avaliações recebidas ──────────────────────────────────
export const ReviewReplySchema = z.object({
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]),
  replies: z.array(z.string()).describe("3 variações de resposta prontas para publicar"),
});

export async function draftReviewReplies(input: {
  business: string;
  niche: string | null;
  brandVoice: string | null;
  authorName: string | null;
  rating: number;
  text: string | null;
  clientId: string;
  userId?: string;
}) {
  const system = `Você é o responsável pelo relacionamento de um comércio local e responde avaliações do Google em nome do estabelecimento.
Classifique o sentimento (POSITIVE, NEUTRAL, NEGATIVE) considerando nota e texto, e escreva 3 respostas diferentes em português do Brasil.
Regras das respostas:
- Cordiais, profissionais e humanas; 2 a 4 frases; trate a pessoa pelo primeiro nome quando houver.
- Positivas: agradeça citando algo específico que a pessoa mencionou; convide a voltar.
- Negativas/neutras: reconheça o ponto sem se justificar demais, peça desculpas quando cabível e ofereça continuar a conversa por um canal privado. Nunca culpe o cliente, nunca discuta, nunca exponha dados pessoais.
- Não ofereça descontos/brindes em troca de alterar a avaliação. Não invente fatos sobre o atendimento.
- As 3 versões devem ser realmente diferentes: uma curta e direta, uma calorosa e pessoal, uma mais formal. Mude abertura, estrutura e fechamento — não repita frases entre elas.`;
  const prompt = `${fence("estabelecimento", `${input.business}${input.niche ? ` (${input.niche})` : ""}`)}
${input.brandVoice ? fence("tom_de_voz_da_marca", input.brandVoice) : ""}
Autor: ${input.authorName ?? "(sem nome)"} · Nota: ${input.rating}/5
${fence("avaliacao", input.text?.trim() || "(avaliação só com nota, sem texto)")}`;
  return generate({
    kind: "REVIEW_REPLY",
    schema: ReviewReplySchema,
    system,
    prompt,
    effort: "low",
    maxTokens: 3000,
    log: { clientId: input.clientId, userId: input.userId, title: `Resposta ${input.rating}★ — ${input.authorName ?? "anônimo"}`, input },
  });
}

// ─── 3. Roteiro de vídeo vertical ────────────────────────────────────────
export const VideoScriptSchema = z.object({
  title: z.string(),
  hook: z.string().describe("Fala dos 3 primeiros segundos"),
  scenes: z.array(
    z.object({
      seconds: z.string().describe("Faixa de tempo, ex.: 0-3s"),
      visual: z.string().describe("O que aparece na tela / enquadramento"),
      onScreenText: z.string(),
      voiceover: z.string(),
    }),
  ),
  cta: z.string(),
  caption: z.string().describe("Legenda pronta para publicar, sem hashtags"),
  hashtags: z.array(z.string()).describe("Hashtags segmentadas, sem #"),
});

export const scriptInputSchema = z.object({
  theme: z.string().trim().min(3).max(500),
  niche: z.string().trim().min(2).max(80),
  tone: z.string().trim().min(2).max(80),
  cta: z.string().trim().min(2).max(200),
  platform: z.enum(["Reels", "TikTok", "Shorts", "Todas"]),
  durationSec: z.coerce.number().int().min(10).max(180),
  clientId: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()),
});

export async function writeVideoScript(input: z.infer<typeof scriptInputSchema> & { business?: string; brandVoice?: string | null; userId: string }) {
  const system = `Você é roteirista de vídeos curtos verticais (Reels, TikTok, Shorts) para pequenos negócios brasileiros.
Estrutura obrigatória: Hook (prende nos 3 primeiros segundos) → Corpo em cenas curtas → CTA claro.
- Português do Brasil, linguagem falada, frases curtas.
- As cenas devem caber na duração pedida e ser gravaveis com celular, sem produção cara.
- Texto na tela: no máximo 6 palavras por cena.
- Hashtags: 8 a 15, misturando nicho, local/bairro (genérico se não informado) e formato; sem # no início.
- Não prometa resultados garantidos nem faça alegações de saúde/financeiras.`;
  const prompt = `${input.business ? fence("marca", input.business) : ""}
${input.brandVoice ? fence("tom_de_voz_da_marca", input.brandVoice) : ""}
${fence("tema", input.theme)}
Nicho: ${input.niche} · Tom: ${input.tone} · Plataforma: ${input.platform} · Duração: ${input.durationSec}s
${fence("cta_desejada", input.cta)}`;
  return generate({
    kind: "VIDEO_SCRIPT",
    schema: VideoScriptSchema,
    system,
    prompt,
    effort: "medium",
    log: { clientId: input.clientId, userId: input.userId, title: input.theme.slice(0, 120), input },
  });
}

// ─── 4. E-mails (cold B2B e newsletter) ──────────────────────────────────
export const EmailSchema = z.object({
  subjectLines: z.array(z.string()).describe("3 opções de assunto"),
  preheader: z.string(),
  body: z.string().describe("Corpo em texto puro, com quebras de linha"),
  followUps: z.array(z.object({ afterDays: z.number().int(), subject: z.string(), body: z.string() })).describe("Só para cold email; vazio em newsletter"),
});

export const emailInputSchema = z.object({
  type: z.enum(["COLD_B2B", "NEWSLETTER"]),
  audience: z.string().trim().min(3).max(300),
  offer: z.string().trim().min(3).max(800),
  tone: z.string().trim().min(2).max(80),
  senderName: z.string().trim().min(2).max(120),
  clientId: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()),
});

export async function writeEmail(input: z.infer<typeof emailInputSchema> & { business?: string; userId: string }) {
  const system = `Você escreve e-mails de marketing em português do Brasil para uma agência digital e seus clientes.
- COLD_B2B: até 120 palavras, personalizado para o público, 1 dor concreta, 1 prova/benefício, 1 pergunta de CTA de baixo atrito (ex.: "faz sentido uma conversa de 15 min?"). Inclua 2 follow-ups curtos (3 e 7 dias). Sem clickbait, sem falsa urgência, sem "Re:" falso.
- NEWSLETTER: 150 a 300 palavras, escaneável (parágrafos curtos, pode usar listas), 1 CTA principal. followUps vazio.
- Assine com o nome do remetente. Inclua no final uma linha para descadastro (LGPD).
- Use técnicas de persuasão éticas (clareza, prova social genérica sem números inventados, reciprocidade). Não invente cases, clientes ou estatísticas.`;
  const prompt = `Tipo: ${input.type} · Tom: ${input.tone} · Remetente: ${input.senderName}
${input.business ? fence("marca", input.business) : ""}
${fence("publico", input.audience)}
${fence("oferta", input.offer)}`;
  return generate({
    kind: "EMAIL",
    schema: EmailSchema,
    system,
    prompt,
    effort: "medium",
    log: { clientId: input.clientId, userId: input.userId, title: `${input.type === "COLD_B2B" ? "Cold" : "Newsletter"} — ${input.audience.slice(0, 80)}`, input },
  });
}

// ─── 5. Resumo executivo do relatório mensal ─────────────────────────────
export const ReportSummarySchema = z.object({
  summary: z.string().describe("Parágrafo de 3 a 5 frases para o dono do negócio"),
  highlights: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

export async function summarizeReport(input: { business: string; month: string; metrics: Record<string, unknown>; clientId: string; userId: string }) {
  const system = `Você escreve o resumo executivo do relatório mensal que uma agência envia ao dono de um comércio local.
Português do Brasil, linguagem simples, sem jargão. Baseie-se APENAS nas métricas fornecidas — não invente números nem causas.
Compare com o mês anterior quando os dados existirem. 2 a 4 destaques e 2 a 3 próximos passos práticos.`;
  const prompt = `${fence("estabelecimento", input.business)}
Mês: ${input.month}
${fence("metricas_json", JSON.stringify(input.metrics, null, 2))}`;
  return generate({
    kind: "REPORT_SUMMARY",
    schema: ReportSummarySchema,
    system,
    prompt,
    effort: "medium",
    log: { clientId: input.clientId, userId: input.userId, title: `Relatório ${input.month}`, input: { month: input.month, metrics: input.metrics } },
  });
}
