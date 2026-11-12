// Catálogo de todas as IAs da Central, com a nota de qualidade por função
// (a ordem "melhor primeiro" vem daqui) e as rotas para chegar a cada uma.
// Ids de modelo podem ser trocados na tela da Central sem mexer no código.
import type { Credencial, ItemCatalogo } from "./tipos";

const OAI = "https://api.openai.com/v1";

export const CREDENCIAIS: Credencial[] = [
  { id: "openai", nome: "OpenAI", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://platform.openai.com/api-keys" },
  { id: "anthropic", nome: "Anthropic (Claude)", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://console.anthropic.com/settings/keys" },
  { id: "gemini", nome: "Google Gemini / Imagen / Veo", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://aistudio.google.com/apikey", observacao: "Chave grátis com limite diário para o Gemini; Imagen e Veo são pagos." },
  { id: "deepseek", nome: "DeepSeek", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://platform.deepseek.com/api_keys" },
  { id: "mistral", nome: "Mistral AI", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://console.mistral.ai/api-keys" },
  { id: "qwen", nome: "Alibaba Cloud (Qwen / Wan)", campos: [{ id: "apiKey", rotulo: "API key (DashScope)", segredo: true }], ondePegar: "https://bailian.console.alibabacloud.com/?apiKey=1" },
  { id: "groq", nome: "Groq", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://console.groq.com/keys", observacao: "Plano grátis: Whisper (transcrição em segundos), gpt-oss-120b e Qwen 3.8 muito rápidos." },
  { id: "together", nome: "Together AI", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://api.together.ai/settings/api-keys" },
  { id: "fal", nome: "fal.ai", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://fal.ai/dashboard/keys", observacao: "Uma chave roda FLUX, Kling, Luma, Hailuo, Pika, Wan, CogVideoX, Veo, Recraft, Ideogram e mais." },
  { id: "replicate", nome: "Replicate", campos: [{ id: "apiKey", rotulo: "API token", segredo: true }], ondePegar: "https://replicate.com/account/api-tokens", observacao: "Milhares de modelos abertos por um token." },
  { id: "ollama", nome: "IA local (Ollama)", campos: [], ondePegar: "https://ollama.com", observacao: "Roda no seu computador; sempre fica por último como reserva grátis." },
  { id: "bfl", nome: "Black Forest Labs (FLUX)", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://api.bfl.ai" },
  { id: "stability", nome: "Stability AI (SD / Clipdrop)", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://platform.stability.ai/account/keys" },
  { id: "adobe", nome: "Adobe Firefly", campos: [{ id: "clientId", rotulo: "Client ID" }, { id: "clientSecret", rotulo: "Client secret", segredo: true }], ondePegar: "https://developer.adobe.com/firefly-services/" },
  { id: "recraft", nome: "Recraft", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://www.recraft.ai/profile/api" },
  { id: "ideogram", nome: "Ideogram", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://ideogram.ai/manage-api" },
  { id: "leonardo", nome: "Leonardo.ai", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://app.leonardo.ai/api-access" },
  { id: "photoroom", nome: "Photoroom", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://app.photoroom.com/api-dashboard" },
  { id: "goapi", nome: "GoAPI (Midjourney não oficial)", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://goapi.ai", observacao: "O Midjourney não tem API oficial. Este é um intermediário de terceiros: use por sua conta e risco." },
  { id: "runway", nome: "Runway", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://dev.runwayml.com" },
  { id: "luma", nome: "Luma AI", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://lumalabs.ai/dream-machine/api/keys" },
  { id: "minimax", nome: "MiniMax (Hailuo)", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://www.minimax.io/platform" },
  { id: "kling", nome: "Kling AI", campos: [{ id: "accessKey", rotulo: "Access key" }, { id: "secretKey", rotulo: "Secret key", segredo: true }], ondePegar: "https://klingai.com/global/dev" },
  { id: "heygen", nome: "HeyGen", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://app.heygen.com/settings?nav=API" },
  { id: "synthesia", nome: "Synthesia", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://app.synthesia.io/#/account" },
  { id: "did", nome: "D-ID", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://studio.d-id.com/account-settings" },
  { id: "tavus", nome: "Tavus", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://platform.tavus.io/api-keys" },
  { id: "colossyan", nome: "Colossyan", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://app.colossyan.com/settings/api" },
  { id: "opusclip", nome: "OpusClip", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://www.opus.pro/api", observacao: "API liberada sob pedido (planos Business)." },
  { id: "vizard", nome: "Vizard", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://vizard.ai/workspace?setting=api" },
  { id: "klap", nome: "Klap", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://klap.app/developers" },
  { id: "submagic", nome: "Submagic", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://app.submagic.co/api" },
  { id: "shotstack", nome: "Shotstack", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }, { id: "ambiente", rotulo: "Ambiente (stage ou v1)", dica: "stage = testes grátis com marca d'água" }], ondePegar: "https://dashboard.shotstack.io" },
  { id: "creatomate", nome: "Creatomate", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://creatomate.com/docs/api/introduction" },
  { id: "plainly", nome: "Plainly", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://app.plainlyvideos.com/dashboard/user/settings/api" },
  { id: "deepgram", nome: "Deepgram", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://console.deepgram.com" },
  { id: "assemblyai", nome: "AssemblyAI", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://www.assemblyai.com/app/api-keys" },
  { id: "elevenlabs", nome: "ElevenLabs", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }, { id: "vozPadrao", rotulo: "ID da voz padrão (opcional)" }], ondePegar: "https://elevenlabs.io/app/settings/api-keys" },
  { id: "cartesia", nome: "Cartesia", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }, { id: "vozPadrao", rotulo: "ID da voz padrão" }], ondePegar: "https://play.cartesia.ai/keys" },
  { id: "playht", nome: "PlayHT", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }, { id: "userId", rotulo: "User ID" }], ondePegar: "https://play.ht/studio/api-access" },
  // ───────── grátis (vindas do MeuStudio) ─────────
  { id: "pollinations", nome: "Pollinations (grátis, sem chave)", campos: [{ id: "apiKey", rotulo: "Token (opcional)", segredo: true, dica: "Sem token funciona, mas com fila. O token grátis tira a fila." }], ondePegar: "https://auth.pollinations.ai", observacao: "Texto e imagem sem custo. Já vem ligado." },
  { id: "openrouter", nome: "OpenRouter (modelos grátis)", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://openrouter.ai/keys", observacao: "Chave grátis; usa os modelos marcados como :free (limite diário)." },
  { id: "cloudflare", nome: "Cloudflare Workers AI", campos: [{ id: "accountId", rotulo: "Account ID" }, { id: "apiToken", rotulo: "API token", segredo: true }], ondePegar: "https://dash.cloudflare.com/profile/api-tokens", observacao: "Plano grátis diário: texto (Llama) e imagem (FLUX schnell)." },
  { id: "huggingface", nome: "Hugging Face", campos: [{ id: "apiKey", rotulo: "Token", segredo: true }], ondePegar: "https://huggingface.co/settings/tokens", observacao: "Token grátis: imagens com FLUX schnell (cota mensal)." },
  { id: "voz-local", nome: "Minha voz no computador (grátis)", campos: [], ondePegar: "https://github.com/resemble-ai/chatterbox", observacao: "Modelo aberto Chatterbox (licença MIT) rodando na sua máquina, de preferência com placa NVIDIA. Usa as vozes da tela Minha voz." },
  { id: "edge", nome: "Vozes da Microsoft (grátis)", campos: [], ondePegar: "https://speech.microsoft.com", observacao: "Vozes neurais em português, sem chave. Já vem ligado." },
  { id: "imagem-local", nome: "Imagem no servidor (grátis)", campos: [], ondePegar: "https://huggingface.co/briaai/RMBG-1.4", observacao: "Tira fundo (RMBG-1.4) e amplia no próprio servidor. Na 1ª vez baixa o modelo (~180 MB)." },
  // ───────── grátis com chave (catálogo do Free Claude Code) ─────────
  { id: "nvidia", nome: "NVIDIA NIM", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://build.nvidia.com/settings/api-keys", observacao: "Chave grátis; Nemotron, Llama, DeepSeek e Qwen hospedados pela NVIDIA." },
  { id: "cerebras", nome: "Cerebras", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://cloud.cerebras.ai/", observacao: "Plano grátis muito rápido (gpt-oss-120b, Llama)." },
  { id: "sambanova", nome: "SambaNova", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://cloud.sambanova.ai/apis", observacao: "Plano grátis (Llama 3.3 70B)." },
  { id: "chutes", nome: "Chutes", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://chutes.ai/", observacao: "Modelos abertos (Qwen, DeepSeek) com cota grátis." },
  { id: "llm7", nome: "LLM7.io", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://dash.llm7.io/", observacao: "Roteador com modelos grátis." },
  { id: "zenmux", nome: "ZenMux", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://zenmux.ai/", observacao: "Tem modelos marcados como free (DeepSeek V4 Flash)." },
  { id: "tokenrouter", nome: "TokenRouter", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://www.tokenrouter.com/", observacao: "Tem modelos free (Kimi K3)." },
  { id: "orcarouter", nome: "OrcaRouter", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://www.orcarouter.ai/", observacao: "Tem modelos free (DeepSeek V4 Flash)." },
  { id: "xkiro", nome: "xKiro", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://xkiro.com/", observacao: "Tem modelos free (Qwen 3.7 Flash)." },
  { id: "siliconflow", nome: "SiliconFlow", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://cloud.siliconflow.com/account/ak", observacao: "Modelos Qwen com cota grátis." },
  { id: "nebius", nome: "Nebius Token Factory", campos: [{ id: "apiKey", rotulo: "API key", segredo: true }], ondePegar: "https://tokenfactory.nebius.com/project/api-keys", observacao: "Créditos grátis ao criar a conta." },
  { id: "custom", nome: "Servidor GPU próprio (Modal / RunPod)", campos: [{ id: "url", rotulo: "Endereço do endpoint" }, { id: "apiKey", rotulo: "Token", segredo: true }], ondePegar: "https://modal.com", observacao: "Recebe POST com {capacidade, entrada} e devolve {texto|arquivos}. Use para scripts próprios de Python/FFmpeg." },
];

const oc = (provedor: string, baseUrl: string, modelo: string) => ({ via: "openai-compat" as const, provedor, baseUrl, modelo });
const fal = (modelo: string, opcoes?: Record<string, unknown>) => ({ via: "fal" as const, provedor: "fal", modelo, opcoes });
const rep = (modelo: string) => ({ via: "replicate" as const, provedor: "replicate", modelo });
const dir = (provedor: string, modelo?: string, opcoes?: Record<string, unknown>) => ({ via: "direto" as const, provedor, modelo, opcoes });

export const CATALOGO: ItemCatalogo[] = [
  // ───────── Texto / agentes ─────────
  { id: "claude", nome: "Claude (Sonnet / Haiku)", empresa: "Anthropic", capacidades: { texto: 10 }, custo: 2, rotas: [{ via: "anthropic", provedor: "anthropic", modelo: "claude-sonnet-5-5" }], site: "https://www.anthropic.com/api" },
  { id: "gpt", nome: "GPT-4o / GPT-4o mini", empresa: "OpenAI", capacidades: { texto: 9 }, custo: 2, rotas: [oc("openai", OAI, "gpt-4o"), oc("openai", OAI, "gpt-4o-mini")], site: "https://platform.openai.com" },
  { id: "gemini", nome: "Gemini Pro / Flash", empresa: "Google", capacidades: { texto: 9 }, custo: 1, rotas: [{ via: "gemini", provedor: "gemini", modelo: "gemini-3.6-flash" }, { via: "gemini", provedor: "gemini", modelo: "gemini-3.5-flash" }, { via: "gemini", provedor: "gemini", modelo: "gemini-3.8-flash" }], site: "https://ai.google.dev", nota: "3.6 Flash primeiro (rápido); 3.5 e 3.8 de reserva na mesma chave." },
  { id: "deepseek", nome: "DeepSeek V3 / R1", empresa: "DeepSeek", capacidades: { texto: 8 }, custo: 1, rotas: [oc("deepseek", "https://api.deepseek.com/v1", "deepseek-chat"), oc("together", "https://api.together.xyz/v1", "deepseek-ai/DeepSeek-V3")] },
  { id: "mistral", nome: "Mistral Large / Pixtral", empresa: "Mistral AI", capacidades: { texto: 7 }, custo: 1, rotas: [oc("mistral", "https://api.mistral.ai/v1", "mistral-large-latest")] },
  { id: "qwen", nome: "Qwen 2.5", empresa: "Alibaba Cloud", capacidades: { texto: 7 }, custo: 1, rotas: [oc("qwen", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", "qwen-plus"), oc("together", "https://api.together.xyz/v1", "Qwen/Qwen2.5-72B-Instruct-Turbo")] },
  { id: "llama", nome: "Llama 3.1 / 3.3", empresa: "Meta (open source)", capacidades: { texto: 7 }, custo: 1, rotas: [oc("together", "https://api.together.xyz/v1", "meta-llama/Llama-3.3-70B-Instruct-Turbo")], nota: "A Groq tirou o Llama 3.3 do catálogo; ela agora aparece como “Groq (gpt-oss / Qwen)”." },
  { id: "groq-texto", nome: "Groq (gpt-oss-120b / Qwen 3.8, ultrarrápido)", empresa: "Groq", capacidades: { texto: 8 }, custo: 0, rotas: [oc("groq", "https://api.groq.com/openai/v1", "openai/gpt-oss-120b"), oc("groq", "https://api.groq.com/openai/v1", "qwen/qwen3.8-27b")], nota: "Plano grátis com limite por minuto e por dia." },
  { id: "local", nome: "IA local (Qwen / Llama / Mistral no seu PC)", empresa: "Ollama", capacidades: { texto: 4 }, custo: 0, rotas: [{ via: "ollama", provedor: "ollama" }], nota: "Sempre disponível como reserva, sem custo." },
  { id: "crewai", nome: "CrewAI", empresa: "Framework", capacidades: { texto: 1 }, custo: 0, rotas: [], status: "framework", nota: "Biblioteca em Python. O E-Nova tem a Equipe de agentes nativa (gerente → redator → revisor), que faz o mesmo papel usando as IAs de texto acima." },
  { id: "langgraph", nome: "LangChain / LangGraph", empresa: "Framework", capacidades: { texto: 1 }, custo: 0, rotas: [], status: "framework", nota: "Framework de fluxos. Substituído pelo roteador e pela Equipe de agentes nativos." },
  { id: "autogpt", nome: "AutoGPT / TaskingAI", empresa: "Framework", capacidades: { texto: 1 }, custo: 0, rotas: [], status: "framework", nota: "Agentes autônomos. Use a Equipe de agentes do Estúdio." },

  // ───────── Imagem ─────────
  { id: "flux", nome: "FLUX.1 pro / dev / schnell", empresa: "Black Forest Labs", capacidades: { imagem: 10 }, custo: 1, rotas: [fal("fal-ai/flux-pro/v1.1"), dir("bfl", "flux-pro-1.1"), rep("black-forest-labs/flux-1.1-pro"), fal("fal-ai/flux/schnell")] },
  { id: "imagen", nome: "Google Imagen / Gemini Image", empresa: "Google", capacidades: { imagem: 9 }, custo: 2, rotas: [dir("gemini", "gemini-3.1-flash-image"), fal("fal-ai/imagen4/preview")] },
  { id: "gpt-image", nome: "DALL·E 3 / GPT Image", empresa: "OpenAI", capacidades: { imagem: 9, "editar-imagem": 6 }, custo: 2, rotas: [dir("openai", "gpt-image-2")] },
  { id: "midjourney", nome: "Midjourney", empresa: "Midjourney", capacidades: { imagem: 9 }, custo: 2, rotas: [], status: "sem-api", nota: "Sem API oficial. O intermediário GoAPI encerrou o Midjourney a pedido da empresa." },
  { id: "ideogram", nome: "Ideogram (texto dentro da imagem)", empresa: "Ideogram", capacidades: { imagem: 8 }, custo: 1, rotas: [dir("ideogram", "ideogram-3"), fal("fal-ai/ideogram/v2")] },
  { id: "recraft", nome: "Recraft (vetor e design)", empresa: "Recraft", capacidades: { imagem: 8 }, custo: 1, rotas: [dir("recraft", "recraftv4_1"), fal("fal-ai/recraft-v3")] },
  { id: "firefly", nome: "Adobe Firefly", empresa: "Adobe", capacidades: { imagem: 8 }, custo: 2, rotas: [dir("adobe", "image3")] },
  { id: "sd", nome: "Stable Diffusion XL / 3.5", empresa: "Stability AI", capacidades: { imagem: 7 }, custo: 1, rotas: [dir("stability", "sd3.5-large"), fal("fal-ai/stable-diffusion-v35-large"), rep("stability-ai/stable-diffusion-3.5-large")] },
  { id: "leonardo", nome: "Leonardo.ai", empresa: "Leonardo", capacidades: { imagem: 7 }, custo: 1, rotas: [dir("leonardo")] },
  { id: "photoroom", nome: "Photoroom (fundo e estúdio de produto)", empresa: "Photoroom", capacidades: { "editar-imagem": 9 }, custo: 1, rotas: [dir("photoroom")] },
  { id: "clipdrop", nome: "Clipdrop (upscale, remover objetos)", empresa: "Stability AI", capacidades: { "editar-imagem": 8 }, custo: 1, rotas: [dir("stability", "clipdrop"), fal("fal-ai/birefnet")] },

  // ───────── Vídeo ─────────
  { id: "veo", nome: "Google Veo / Gemini Omni (vídeo)", empresa: "Google", capacidades: { video: 10 }, custo: 3, rotas: [dir("gemini", "gemini-omni-1.2-flash"), fal("fal-ai/veo3")] },
  { id: "sora", nome: "OpenAI Sora", empresa: "OpenAI", capacidades: { video: 10 }, custo: 3, rotas: [], status: "sem-api", nota: "A OpenAI encerrou a API do Sora em setembro de 2026." },
  { id: "kling", nome: "Kling AI", empresa: "Kuaishou", capacidades: { video: 9 }, custo: 2, rotas: [fal("fal-ai/kling-video/v2.1/master/text-to-video"), dir("kling", "kling-v2-6"), rep("kwaivgi/kling-v2.1")] },
  { id: "runway", nome: "Runway Gen-3 Alpha / Gen-4", empresa: "RunwayML", capacidades: { video: 9 }, custo: 2, rotas: [dir("runway", "gen4_turbo")] },
  { id: "hailuo", nome: "Minimax Hailuo", empresa: "MiniMax", capacidades: { video: 8 }, custo: 2, rotas: [fal("fal-ai/minimax/hailuo-02/standard/text-to-video"), dir("minimax", "MiniMax-Hailuo-2.3")] },
  { id: "luma", nome: "Luma Dream Machine (Ray)", empresa: "Luma AI", capacidades: { video: 8 }, custo: 2, rotas: [dir("luma", "ray-2"), fal("fal-ai/luma-dream-machine/ray-2")] },
  { id: "pika", nome: "Pika", empresa: "Pika Labs", capacidades: { video: 7 }, custo: 2, rotas: [fal("fal-ai/pika/v2.2/text-to-video")] },
  { id: "wan", nome: "Wan 2.1", empresa: "Alibaba (open source)", capacidades: { video: 7 }, custo: 1, rotas: [fal("fal-ai/wan-t2v"), rep("wavespeedai/wan-2.1-t2v-480p")] },
  { id: "cogvideox", nome: "CogVideoX", empresa: "Zhipu AI (open source)", capacidades: { video: 5 }, custo: 1, rotas: [fal("fal-ai/cogvideox-5b")] },
  { id: "animatediff", nome: "AnimateDiff", empresa: "Open source", capacidades: { video: 4 }, custo: 1, rotas: [fal("fal-ai/fast-animatediff/text-to-video")] },

  // ───────── Avatares ─────────
  { id: "heygen", nome: "HeyGen (avatares e dublagem)", empresa: "HeyGen", capacidades: { avatar: 10 }, custo: 3, rotas: [dir("heygen")] },
  { id: "synthesia", nome: "Synthesia", empresa: "Synthesia", capacidades: { avatar: 9 }, custo: 3, rotas: [dir("synthesia")] },
  { id: "tavus", nome: "Tavus (réplica digital)", empresa: "Tavus", capacidades: { avatar: 8 }, custo: 3, rotas: [dir("tavus")] },
  { id: "colossyan", nome: "Colossyan", empresa: "Colossyan", capacidades: { avatar: 7 }, custo: 3, rotas: [dir("colossyan")] },
  { id: "did", nome: "D-ID (foto falante)", empresa: "D-ID", capacidades: { avatar: 7 }, custo: 2, rotas: [dir("did")] },

  // ───────── Cortes virais ─────────
  { id: "opusclip", nome: "Opus Clip", empresa: "OpusClip", capacidades: { cortes: 10 }, custo: 3, rotas: [dir("opusclip")] },
  { id: "vizard", nome: "Vizard AI", empresa: "Vizard", capacidades: { cortes: 9 }, custo: 2, rotas: [dir("vizard")] },
  { id: "klap", nome: "Klap", empresa: "Klap", capacidades: { cortes: 8 }, custo: 2, rotas: [dir("klap")] },
  { id: "submagic", nome: "Submagic (legendas com efeitos)", empresa: "Submagic", capacidades: { cortes: 7 }, custo: 2, rotas: [dir("submagic")] },
  { id: "motor-local", nome: "Motor de cortes do E-Nova", empresa: "E-Nova (local)", capacidades: { cortes: 5 }, custo: 0, rotas: [{ via: "local", provedor: "ollama", modelo: "cortes" }], nota: "O motor que já existe em Cortes virais (Whisper + IA + FFmpeg). Reserva grátis." },
  { id: "2short", nome: "2short.ai", empresa: "2short", capacidades: { cortes: 8 }, custo: 2, rotas: [], status: "sem-api", nota: "Não oferece API pública." },
  { id: "munch", nome: "Munch", empresa: "GetMunch", capacidades: { cortes: 8 }, custo: 2, rotas: [], status: "sem-api", nota: "Sem API pública no momento." },
  { id: "captions", nome: "Captions AI", empresa: "Captions", capacidades: { cortes: 7 }, custo: 2, rotas: [], status: "sem-api", nota: "API só para parceiros; sem acesso aberto." },

  // ───────── Edição programática ─────────
  { id: "shotstack", nome: "Shotstack", empresa: "Shotstack", capacidades: { "edicao-video": 9 }, custo: 2, rotas: [dir("shotstack")] },
  { id: "creatomate", nome: "Creatomate", empresa: "Creatomate", capacidades: { "edicao-video": 9 }, custo: 2, rotas: [dir("creatomate")] },
  { id: "plainly", nome: "Plainly (After Effects na nuvem)", empresa: "Plainly", capacidades: { "edicao-video": 8 }, custo: 3, rotas: [dir("plainly")] },

  // ───────── Transcrição ─────────
  { id: "whisper-groq", nome: "Whisper (Groq, ultrarrápido)", empresa: "Groq", capacidades: { transcricao: 9 }, custo: 0, rotas: [oc("groq", "https://api.groq.com/openai/v1", "whisper-large-v3"), oc("groq", "https://api.groq.com/openai/v1", "whisper-large-v3-turbo")], nota: "Grátis com limite; nos Cortes cada pedaço de 60 s leva ~1–2 s." },
  { id: "assemblyai", nome: "AssemblyAI (oradores e capítulos)", empresa: "AssemblyAI", capacidades: { transcricao: 9 }, custo: 1, rotas: [dir("assemblyai")] },
  { id: "deepgram", nome: "Deepgram Nova", empresa: "Deepgram", capacidades: { transcricao: 9 }, custo: 1, rotas: [dir("deepgram", "nova-3")] },
  { id: "gemini-transcricao", nome: "Gemini (transcrição rápida)", empresa: "Google", capacidades: { transcricao: 8 }, custo: 1, rotas: [dir("gemini", "gemini-3.5-flash"), dir("gemini", "gemini-3.6-flash")], nota: "Usa a mesma chave do Gemini. Ótimo no português; nos Cortes vai em pedaços de 60 s para os tempos não escorregarem." },
  { id: "whisper-openai", nome: "Whisper (OpenAI)", empresa: "OpenAI", capacidades: { transcricao: 8 }, custo: 1, rotas: [oc("openai", OAI, "whisper-1")] },
  { id: "whisper-local", nome: "Whisper local", empresa: "E-Nova (local)", capacidades: { transcricao: 5 }, custo: 0, rotas: [{ via: "local", provedor: "ollama", modelo: "whisper" }], nota: "Já usado nos Cortes virais. Reserva grátis." },

  // ───────── Voz ─────────
  { id: "elevenlabs", nome: "ElevenLabs (voz, clonagem e efeitos)", empresa: "ElevenLabs", capacidades: { voz: 10, musica: 7, "limpar-audio": 8 }, custo: 2, rotas: [dir("elevenlabs", "eleven_multilingual_v2")] },
  { id: "cartesia", nome: "Cartesia Sonic", empresa: "Cartesia", capacidades: { voz: 9 }, custo: 1, rotas: [dir("cartesia", "sonic-3.6")] },
  { id: "playht", nome: "PlayHT", empresa: "PlayHT", capacidades: { voz: 8 }, custo: 1, rotas: [], status: "sem-api", nota: "A API foi encerrada em 2025 (empresa comprada pela Meta)." },
  { id: "openai-tts", nome: "OpenAI TTS", empresa: "OpenAI", capacidades: { voz: 7 }, custo: 1, rotas: [dir("openai", "gpt-4o-mini-tts")] },

  // ───────── Música ─────────
  { id: "suno", nome: "Suno AI", empresa: "Suno", capacidades: { musica: 10 }, custo: 2, rotas: [], status: "sem-api", nota: "Não tem API oficial." },
  { id: "udio", nome: "Udio", empresa: "Udio", capacidades: { musica: 9 }, custo: 2, rotas: [], status: "sem-api", nota: "Não tem API oficial." },
  { id: "minimax-music", nome: "MiniMax Music", empresa: "MiniMax", capacidades: { musica: 7 }, custo: 1, rotas: [fal("fal-ai/minimax-music")] },
  { id: "stable-audio", nome: "Stable Audio", empresa: "Stability AI", capacidades: { musica: 6 }, custo: 1, rotas: [fal("fal-ai/stable-audio")] },

  // ───────── Limpar áudio ─────────
  { id: "adobe-podcast", nome: "Adobe Podcast Enhance", empresa: "Adobe", capacidades: { "limpar-audio": 10 }, custo: 1, rotas: [], status: "sem-api", nota: "Sem API pública. Use o isolador de voz da ElevenLabs ou o filtro local." },
  { id: "ffmpeg-denoise", nome: "Filtro de ruído local (FFmpeg)", empresa: "E-Nova (local)", capacidades: { "limpar-audio": 4 }, custo: 0, rotas: [{ via: "local", provedor: "ollama", modelo: "denoise" }] },

  // ───────── Grátis com chave (do catálogo do Free Claude Code) ─────────
  { id: "nvidia-nim", nome: "NVIDIA NIM (Nemotron / Llama grátis)", empresa: "NVIDIA", capacidades: { texto: 8 }, custo: 0, rotas: [oc("nvidia", "https://integrate.api.nvidia.com/v1", "nvidia/nemotron-3-ultra-550b-a55b"), oc("nvidia", "https://integrate.api.nvidia.com/v1", "meta/llama-3.3-70b-instruct")] },
  { id: "cerebras", nome: "Cerebras (gpt-oss-120b, ultrarrápido)", empresa: "Cerebras", capacidades: { texto: 7 }, custo: 0, rotas: [oc("cerebras", "https://api.cerebras.ai/v1", "gpt-oss-120b")] },
  { id: "sambanova", nome: "SambaNova (Llama 3.3 70B)", empresa: "SambaNova", capacidades: { texto: 7 }, custo: 0, rotas: [oc("sambanova", "https://api.sambanova.ai/v1", "Meta-Llama-3.3-70B-Instruct")] },
  { id: "zenmux-free", nome: "ZenMux (DeepSeek V4 Flash grátis)", empresa: "ZenMux", capacidades: { texto: 7 }, custo: 0, rotas: [oc("zenmux", "https://zenmux.ai/api/v1", "deepseek/deepseek-v4-flash-free")] },
  { id: "orcarouter-free", nome: "OrcaRouter (DeepSeek V4 Flash grátis)", empresa: "OrcaRouter", capacidades: { texto: 7 }, custo: 0, rotas: [oc("orcarouter", "https://api.orcarouter.ai/v1", "deepseek/deepseek-v4-flash-free")] },
  { id: "tokenrouter-free", nome: "TokenRouter (Kimi K3 grátis)", empresa: "TokenRouter", capacidades: { texto: 7 }, custo: 0, rotas: [oc("tokenrouter", "https://api.tokenrouter.com/v1", "moonshotai/kimi-k3-free")] },
  { id: "chutes", nome: "Chutes (Qwen3 32B)", empresa: "Chutes", capacidades: { texto: 6 }, custo: 0, rotas: [oc("chutes", "https://llm.chutes.ai/v1", "Qwen/Qwen3-32B-TEE")] },
  { id: "xkiro-free", nome: "xKiro (Qwen 3.7 Flash grátis)", empresa: "xKiro", capacidades: { texto: 6 }, custo: 0, rotas: [oc("xkiro", "https://api.xkiro.com/v1", "qwen/qwen3.7-flash:free")] },
  { id: "siliconflow", nome: "SiliconFlow (Qwen3 32B)", empresa: "SiliconFlow", capacidades: { texto: 6 }, custo: 0, rotas: [oc("siliconflow", "https://api.siliconflow.com/v1", "Qwen/Qwen3-32B")] },
  { id: "nebius", nome: "Nebius (Qwen3 30B)", empresa: "Nebius", capacidades: { texto: 6 }, custo: 0, rotas: [oc("nebius", "https://api.tokenfactory.nebius.com/v1", "Qwen/Qwen3-30B-A3B")] },
  { id: "llm7", nome: "LLM7.io (modelos grátis)", empresa: "LLM7", capacidades: { texto: 5 }, custo: 0, rotas: [oc("llm7", "https://api.llm7.io/v1", "default")] },

  // ───────── Grátis (reservas sem custo, vindas do MeuStudio) ─────────
  { id: "pollinations-texto", nome: "Pollinations (texto grátis)", empresa: "Pollinations", capacidades: { texto: 5 }, custo: 0, rotas: [dir("pollinations", "openai"), dir("pollinations", "openai")], nota: "Sem chave. Entra quando as IAs com chave falham (2 tentativas)." },
  { id: "openrouter-free", nome: "OpenRouter (Llama / DeepSeek grátis)", empresa: "OpenRouter", capacidades: { texto: 6 }, custo: 0, rotas: [dir("openrouter", "meta-llama/llama-3.3-70b-instruct:free"), dir("openrouter", "deepseek/deepseek-chat-v3-0324:free")] },
  { id: "cloudflare-ai", nome: "Cloudflare Workers AI (Llama e FLUX grátis)", empresa: "Cloudflare", capacidades: { texto: 5, imagem: 5, transcricao: 7 }, custo: 0, rotas: [dir("cloudflare")] },
  { id: "pollinations-imagem", nome: "Pollinations (imagem grátis, FLUX)", empresa: "Pollinations", capacidades: { imagem: 5 }, custo: 0, rotas: [dir("pollinations")], nota: "Sem chave. Reserva grátis de imagens." },
  { id: "hf-flux", nome: "Hugging Face (FLUX schnell grátis)", empresa: "Hugging Face", capacidades: { imagem: 5 }, custo: 0, rotas: [dir("huggingface", "black-forest-labs/FLUX.1-schnell")] },
  { id: "edge-tts", nome: "Vozes neurais da Microsoft (grátis)", empresa: "Microsoft", capacidades: { voz: 6 }, custo: 0, rotas: [dir("edge")], nota: "Francisca, Thalita e Antônio em português, mais sotaques de Portugal e estrangeiros. Sem chave." },
  // vozes clonadas (tela Minha voz): só entram quando a voz escolhida é "minha:<id>"
  { id: "minha-voz-cartesia", nome: "Minha voz (Cartesia)", empresa: "Cartesia", capacidades: { voz: 2 }, custo: 1, rotas: [dir("cartesia", "sonic-3.6")], nota: "Voz clonada na tela Minha voz." },
  { id: "minha-voz-local", nome: "Minha voz (no computador)", empresa: "Chatterbox (local)", capacidades: { voz: 1 }, custo: 0, rotas: [dir("voz-local")], nota: "Reserva grátis da voz clonada; precisa do modelo instalado em tools/voz-local." },
  { id: "imagem-local", nome: "Tirar fundo e ampliar no servidor", empresa: "E-Nova (local)", capacidades: { "editar-imagem": 5 }, custo: 0, rotas: [dir("imagem-local")], nota: "RMBG-1.4 para fundo; ampliação clássica 2x/4x." },

  // ───────── Infraestrutura ─────────
  { id: "custom-gpu", nome: "Modal / RunPod (servidor GPU próprio)", empresa: "Seu servidor", capacidades: { video: 3, imagem: 3, transcricao: 3, "limpar-audio": 3 }, custo: 1, rotas: [dir("custom")], nota: "Endpoint próprio para scripts customizados." },
];

export const credencial = (id: string) => CREDENCIAIS.find((c) => c.id === id);
export const itemCatalogo = (id: string) => CATALOGO.find((i) => i.id === id);
