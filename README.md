# E-Nova

ERP e hub de automação para agências digitais e comércios locais.

| Módulo | O que faz |
|---|---|
| **1. Plaquinhas NFC/QR** | Rota `/r/[slug]` com cache, status do cliente (ativo/trial/suspenso), telemetria (aparelho, cidade, LGPD) e QR Code em SVG/PNG com logo |
| **2. IA** | Assistente público de avaliação (o cliente marca o que gostou → texto sugerido → Google), respostas a avaliações em 3 variações com sentimento, roteiros de vídeos verticais e e-mails (cold B2B / newsletter) |
| **3. Conteúdo** | Upload de vídeos em lote (R2/S3 ou disco), validação do arquivo pelos bytes iniciais, fluxo RASCUNHO → AGUARDANDO_APROVACAO → AGENDADO → PUBLICADO, publicação em Instagram Reels, TikTok e YouTube Shorts pelas APIs oficiais |
| **4. Sites** | Ping a cada 5/15 min, alerta de SSL com 15/7/2 dias, cópia diária do HTML (backup + detecção de alteração), uptime mensal, alertas por Discord/Telegram/WhatsApp/webhook |
| **5. BI e portal** | Relatório mensal de impacto por cliente (imprimível, resumo por IA), BI dos sócios (MRR em 12 meses, ARR, ticket médio, avulsos, ranking de clientes), portal do cliente com aprovação de posts |
| **CRM + RBAC** | Clientes, contratos recorrentes e avulsos, usuários SUPER_ADMIN / MEMBER / CLIENT |
| **Estoque de plaquinhas** | Modelos com custo/venda/aluguel, entrada em lote com etiqueta (EN-0001…), venda/aluguel/cortesia que já cria contrato (aluguel entra no MRR), devolução, defeito, histórico, gravação da tag NFC pelo Chrome do Android |
| **Cortes virais** | Vídeo longo → transcrição local (Whisper) → trechos de 20–60 s com nota de viralidade (gancho, emoção, valor, ritmo, energia) → vertical 9:16 com legenda → vira publicação |
| **Páginas** | Criador de páginas (link na bio, campanhas) em blocos, com prévia de celular, publicação em /p/endereço, visitas, visitantes únicos, cliques por botão, CTR e origem — sem cookie |
| **IA local** | Ollama com Qwen 2.5, Llama 3.1, Mistral, Gemma 2 (Google) ou gpt-oss (OpenAI) — sem custo por uso; troca de modelo na tela Sistema |
| **Segurança** | 2FA com códigos de recuperação, bloqueio por conta, sessão versionada, auditoria, cabeçalhos (CSP/HSTS…), proteção SSRF e nota A+–F dos sites dos clientes |

> Não existe versão aberta do Claude para rodar localmente. Os modelos abertos do Google e da OpenAI são, respectivamente, o Gemma e o gpt-oss.

## Rodando local

```bash
npm install
npm run dev          # Postgres embutido (5433) + Next (3100) + worker
npm run db:setup     # em outro terminal, 1ª vez: migrações + sócio admin + dados demo
```

Acesse http://localhost:3100. O login do primeiro sócio é o `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` do `.env.local`.

> O Postgres de dev é o [PGlite](https://pglite.dev) servido por socket (`pglite-server`), sem instalar nada. Os dados ficam em `.data/pglite`; vídeos e cópias de páginas, em `.data/uploads`.

| Script | O que faz |
|---|---|
| `npm run dev` | Postgres local + Next + worker em modo dev |
| `npm run worker` | só o worker (em produção, rode como serviço separado) |
| `npm run db:local` | só o Postgres local |
| `npm run db:generate` / `db:migrate` | gerar / aplicar migrações |
| `npm run db:seed [-- --demo]` | primeiro sócio (e dados de exemplo) |
| `npm run typecheck` / `npm run lint` | checagens |

## O que liga cada função (variáveis de ambiente)

Tudo é opcional, menos banco e `AUTH_SECRET`. Sem a variável, a tela correspondente avisa e o resto funciona. A página **Sistema** mostra o que está ligado.

| Variável | Libera |
|---|---|
| `ANTHROPIC_API_KEY` | Toda a IA (modelo em `AI_MODEL`, padrão `claude-opus-5-5`) |
| `ENCRYPTION_KEY` | Conectar contas (tokens OAuth) e canais de alerta — tudo criptografado com AES-256-GCM |
| `S3_*` | Vídeos em Cloudflare R2/S3, com upload direto do navegador por URL pré-assinada |
| `GOOGLE_CLIENT_ID/SECRET` | Google Meu Negócio (avaliações) e YouTube |
| `META_APP_ID/SECRET` | Instagram Reels |
| `TIKTOK_CLIENT_KEY/SECRET` | TikTok |
| `WEBHOOK_SECRET` | Webhook de novas avaliações (Pub/Sub) |
| `UPSTASH_REDIS_*` | Cache compartilhado entre instâncias |

Redirect URIs para cadastrar nos portais: `{APP_URL}/api/integracoes/{google_business|youtube|meta|tiktok}/callback`.

### Aprovações das plataformas (fora do código)

- **Google Business Profile API:** precisa de acesso aprovado pelo Google ao projeto do Cloud.
- **Meta:** o app precisa de revisão para `instagram_content_publish`, e a conta do cliente precisa ser profissional e ligada a uma Página.
- **TikTok:** até a auditoria do app, os posts só saem como privados (`SELF_ONLY`). O `PULL_FROM_URL` exige o domínio do vídeo verificado no portal (use o domínio do R2 ou do `APP_URL`).
- **YouTube:** a cota padrão da Data API comporta cerca de 6 uploads por dia; peça aumento se precisar.
- **WhatsApp Cloud API:** fora da janela de 24h, só entrega mensagem de template aprovado.

## Módulo Vendas (prospecção e criador de sites)

Menu **Vendas**: Prospecção, Funil, Criador de sites, Abordagem e Visuais. Configure em **Gestão → Vendas e IA**.

- **Prospecção:** busca no Google Maps (Places API New) os negócios sem site, com uma nota de oportunidade de 0 a 100. Sem chave, roda em modo demonstração com empresas fictícias. A chave fica criptografada em `app_settings` (`vendas.googleKey`) ou na variável de ambiente `GOOGLE_PLACES_KEY`.
- **Criador de sites:**
  - Assistente de 4 passos; o motor fica em `src/lib/sites/engine` e tem 9 visuais em `engine/layouts`.
  - Editor de blocos.
  - Publicação em `/s/<slug>`. As imagens ficam em `/sm/<id>/<arquivo>`, guardadas no storage com o prefixo `sites/`.
- **IA:** a IA local (Ollama) é a padrão. O Gemini é opcional (`ai.provider` = `gemini` + `ai.geminiKey`). Se o Ollama estiver desligado e houver chave do Gemini, ele assume como reserva.
- **Funil:**
  - Hoje / Leads em kanban e ficha com roteiros e objeções.
  - Ao marcar "Fechado", o lead vira **Cliente** com contrato avulso (criação) e mensalidade, se houver. A mensalidade entra no MRR.
- **Tabelas:** `prospects`, `generated_sites`, `sales_events` (migração `0006_vendas_prospeccao_sites`).

## Produção

1. Postgres gerenciado (Neon/Supabase) → `DATABASE_URL`.
2. `AUTH_SECRET`, `IP_HASH_SALT` e `ENCRYPTION_KEY` fortes e únicos. **Trocar a `ENCRYPTION_KEY` derruba as contas conectadas.**
3. **`APP_URL` = domínio definitivo antes de gravar qualquer tag NFC ou imprimir QR.**
4. R2/S3 para vídeos (o disco local não escala e não serve vários servidores).
5. `npm run db:migrate && npm run build && npm start` + `npm run worker` como segundo processo (PM2, NSSM no Windows, systemd).

## Arquitetura

```
src/
  app/
    r/[slug]/                ← rota pública das plaquinhas (302)
    avaliar/[slug]/          ← assistente público de avaliação (IA)
    api/avaliar/             ← sugestões (rate limit por IP e por plaquinha)
    api/integracoes/         ← OAuth: conectar / callback
    api/midia/               ← upload local e arquivo assinado (Range)
    api/webhooks/            ← notificações do Google
    painel/                  ← todas as telas (RBAC em cada uma)
    actions/                 ← Server Actions (Zod + permissão)
  db/schema.ts               ← Drizzle (todas as tabelas)
  lib/
    ai/                      ← cliente Claude (saída estruturada + fallback) e prompts
    social/                  ← OAuth, Google reviews, publicadores IG/TikTok/YouTube
    monitor.ts, alerts.ts    ← uptime, SSL, cópias, envio de alertas
    jobs.ts, worker.ts       ← fila no Postgres (SKIP LOCKED) + agendador
    reports.ts               ← métricas do relatório mensal
    storage.ts               ← R2/S3 ou disco
scripts/worker.ts            ← processo de background
```

### Fila de jobs

Sem Redis nem BullMQ: a fila é a tabela `jobs`. O worker pega jobs com `FOR UPDATE SKIP LOCKED` (dá para rodar vários workers), repete as falhas com intervalo crescente (30 s, 2 min, 8 min…) e evita duplicatas com `dedupe_key`. A cada 30 s o agendador enfileira:
- monitores vencidos;
- cópia diária das páginas;
- posts agendados que chegaram na hora;
- sincronização horária das avaliações do Google.

### IA

- Toda chamada usa saída estruturada (schema Zod), registra tokens e custo em `ai_generations` e tem fallback no servidor se o modelo recusar.
- Texto de usuário (avaliações, temas) vai delimitado e tratado como dado, não como instrução.
- O assistente público não filtra notas baixas: qualquer nota segue para o Google, como exige a política do Google contra filtrar avaliações.

### Permissões (RBAC)

Em `src/lib/auth/rbac.ts`. Resumo: **sócio** vê tudo (financeiro, BI, usuários, sistema); **equipe** opera clientes, IA, conteúdo e sites; **cliente** vê só o que é dele e aprova os próprios posts. Toda Server Action e página checa no servidor.

### Privacidade (LGPD)

- **IP:** nunca é gravado; guardamos só `sha256(sal + IP)`.
- **Tokens e configurações de alerta:** ficam criptografados no banco.
- **Cópias de páginas:** sempre são baixadas como anexo, nunca renderizadas dentro do painel.
