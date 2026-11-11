/**
 * Erros do Google Maps (Places API New) traduzidos para português, com o passo a passo para resolver.
 * Usado pelo teste de conexão (Configurações / Prospecção) e pela busca de empresas.
 */

export type TipoErroGoogle = "chave-invalida" | "api-desativada" | "faturamento" | "restricao-referer" | "restricao-ip" | "restricao-api" | "cota" | "rede" | "outro";

export type ErroGoogle = {
  tipo: TipoErroGoogle;
  titulo: string;
  explicacao: string;
  passos: string[];
  link?: { href: string; texto: string };
  /** Mensagem original do Google (em inglês), para quem quiser conferir. */
  original?: string;
};

type CorpoErro = { error?: { code?: number; message?: string; status?: string; details?: { reason?: string; metadata?: Record<string, string> }[] } };

const CREDENCIAIS = { href: "https://console.cloud.google.com/apis/credentials", texto: "Abrir Credenciais no Google Cloud" };

export function traduzirErroGoogle(status: number, corpo: unknown): ErroGoogle {
  const err = (corpo as CorpoErro | null)?.error ?? {};
  const msg = String(err.message ?? "");
  const razoes = (err.details ?? []).map((d) => d.reason ?? "").filter(Boolean);
  const tem = (r: string) => razoes.includes(r);
  const projeto = (err.details ?? []).map((d) => d.metadata?.consumer ?? d.metadata?.containerInfo ?? "").find(Boolean)?.replace(/^projects\//, "") || /project (\d+)/i.exec(msg)?.[1] || "";
  const original = msg || `HTTP ${status}`;

  if (tem("API_KEY_INVALID") || /api key not valid|api_key_invalid|invalid api key/i.test(msg)) {
    return {
      tipo: "chave-invalida",
      titulo: "Chave inválida",
      explicacao: "O Google não reconheceu essa chave. Ela pode ter sido copiada pela metade, apagada ou ser de outro serviço.",
      passos: [
        "Abra Google Cloud → APIs e serviços → Credenciais.",
        "Copie a chave inteira (começa com “AIza” e tem 39 caracteres) com o botão de copiar.",
        "Cole aqui de novo e toque em Testar.",
      ],
      link: CREDENCIAIS,
      original,
    };
  }
  if (tem("SERVICE_DISABLED") || /has not been used in project|it is disabled|is not enabled/i.test(msg)) {
    return {
      tipo: "api-desativada",
      titulo: "A Places API (New) não está ativada",
      explicacao: "A chave existe, mas o serviço de busca de empresas ainda não foi ligado no projeto do Google Cloud dela.",
      passos: [
        "Abra o link abaixo (com a mesma conta Google da chave).",
        "Confira se o projeto selecionado no topo é o da chave.",
        "Clique em “Ativar” na Places API (New). Atenção: é a versão “New”.",
        "Espere 1 ou 2 minutos e teste de novo.",
      ],
      link: { href: `https://console.cloud.google.com/apis/library/places.googleapis.com${projeto ? `?project=${encodeURIComponent(projeto)}` : ""}`, texto: "Ativar a Places API (New)" },
      original,
    };
  }
  if (tem("BILLING_DISABLED") || /billing/i.test(msg)) {
    return {
      tipo: "faturamento",
      titulo: "Falta ativar o faturamento",
      explicacao: "O Google exige uma forma de pagamento cadastrada para liberar o Maps, mesmo dentro do uso gratuito mensal.",
      passos: [
        "Abra Google Cloud → Faturamento e vincule uma conta de faturamento ao projeto da chave.",
        "Crie um alerta de orçamento (ex.: R$ 10) para não ter surpresa.",
        "Espere alguns minutos e teste de novo.",
      ],
      link: { href: "https://console.cloud.google.com/billing", texto: "Abrir Faturamento no Google Cloud" },
      original,
    };
  }
  if (tem("API_KEY_HTTP_REFERRER_BLOCKED") || /referer|referrer/i.test(msg)) {
    return {
      tipo: "restricao-referer",
      titulo: "A chave está restrita a sites (referenciadores HTTP)",
      explicacao: "A busca é feita pelo servidor do E-Nova, não pelo navegador. Chaves restritas a “Sites” sempre são bloqueadas nesse caso.",
      passos: [
        "Abra Credenciais e clique na chave.",
        "Em “Restrições de aplicativo”, escolha “Nenhuma” (ou “Endereços IP” com o IP do servidor).",
        "Em “Restrições de API”, deixe só a Places API (New) para manter a chave segura.",
        "Salve, espere 1 ou 2 minutos e teste de novo.",
      ],
      link: CREDENCIAIS,
      original,
    };
  }
  if (tem("API_KEY_IP_ADDRESS_BLOCKED") || /ip address|from this ip/i.test(msg)) {
    return {
      tipo: "restricao-ip",
      titulo: "A chave não aceita o IP deste servidor",
      explicacao: "A chave está restrita a endereços IP e o IP de onde o E-Nova está rodando não está na lista.",
      passos: ["Abra Credenciais e clique na chave.", "Adicione o IP público deste servidor em “Endereços IP”, ou escolha “Nenhuma”.", "Salve e teste de novo."],
      link: CREDENCIAIS,
      original,
    };
  }
  if (tem("API_KEY_SERVICE_BLOCKED") || /are blocked/i.test(msg)) {
    return {
      tipo: "restricao-api",
      titulo: "A chave não tem permissão para a Places API (New)",
      explicacao: "Nas restrições da chave, a Places API (New) não está entre as APIs liberadas.",
      passos: ["Abra Credenciais e clique na chave.", "Em “Restrições de API”, marque “Places API (New)”.", "Salve, espere 1 ou 2 minutos e teste de novo."],
      link: CREDENCIAIS,
      original,
    };
  }
  if (status === 429 || err.status === "RESOURCE_EXHAUSTED" || /quota|rate limit/i.test(msg)) {
    return {
      tipo: "cota",
      titulo: "Limite de uso atingido",
      explicacao: "O projeto passou do limite de buscas permitido (por minuto ou por dia).",
      passos: ["Espere alguns minutos e tente de novo.", "Se acontecer sempre, aumente as cotas em Google Cloud → APIs e serviços → Places API (New) → Cotas."],
      link: { href: "https://console.cloud.google.com/apis/api/places.googleapis.com/quotas", texto: "Ver cotas da Places API" },
      original,
    };
  }
  return {
    tipo: "outro",
    titulo: "O Google recusou a busca",
    explicacao: "Não foi possível identificar o motivo exato. Confira a chave, se a Places API (New) está ativada e se o faturamento está ligado.",
    passos: ["Abra Credenciais no Google Cloud e confira a chave.", "Confirme que a Places API (New) está ativada no mesmo projeto.", "Teste de novo em alguns minutos."],
    link: CREDENCIAIS,
    original,
  };
}

export function erroDeRede(e: unknown): ErroGoogle {
  return {
    tipo: "rede",
    titulo: "Não deu para falar com o Google",
    explicacao: "O servidor do E-Nova não conseguiu acessar a internet ou o Google demorou demais para responder.",
    passos: ["Confira a conexão com a internet deste computador/servidor.", "Tente de novo em alguns instantes."],
    original: e instanceof Error ? e.message : String(e),
  };
}

/** Erro lançado pela busca quando o Google responde com falha (places.js anexa status e corpo). */
export function erroGoogleDe(e: unknown): ErroGoogle | null {
  const x = e as { googleStatus?: number; googleCorpo?: unknown; cause?: unknown } | null;
  if (x && typeof x.googleStatus === "number") return traduzirErroGoogle(x.googleStatus, x.googleCorpo);
  if (e instanceof TypeError && /fetch failed/i.test(e.message)) return erroDeRede(e);
  return null;
}

/** Faz uma busca mínima (1 resultado, só o id) para ver se a chave funciona de verdade. */
export async function testarChaveGoogle(chave: string): Promise<{ ok: true } | { ok: false; erro: ErroGoogle }> {
  let r: Response;
  try {
    r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": chave, "X-Goog-FieldMask": "places.id" },
      body: JSON.stringify({ textQuery: "padaria em São Paulo", pageSize: 1, languageCode: "pt-BR", regionCode: "BR" }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, erro: erroDeRede(e) };
  }
  if (r.ok) return { ok: true };
  const corpo = await r.json().catch(() => null);
  return { ok: false, erro: traduzirErroGoogle(r.status, corpo) };
}
