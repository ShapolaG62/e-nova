import "server-only";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import type { Channel } from "@/db/schema";
import { openObjectStream, temporaryUrl } from "@/lib/storage";
import { getAccessToken } from "./oauth";

const GRAPH = "https://graph.facebook.com/v21.0";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Ctx = { clientId: string; title: string; caption: string; asset: { id: string; storageKey: string; mime: string } };
type Result = { externalId: string; externalUrl: string | null };

// ─── Instagram Reels (Meta Graph API: container → processamento → publish) ──
async function publishInstagram(ctx: Ctx): Promise<Result> {
  const { token, integration } = await getAccessToken(ctx.clientId, "META");
  const igUser = integration.externalAccountId;
  if (!igUser) throw new Error("Conta do Instagram não identificada. Reconecte.");
  const videoUrl = await temporaryUrl(ctx.asset.storageKey, ctx.asset.id);

  const create = await fetch(`${GRAPH}/${igUser}/media`, {
    method: "POST",
    body: new URLSearchParams({ media_type: "REELS", video_url: videoUrl, caption: ctx.caption.slice(0, 2200), share_to_feed: "true", access_token: token }),
  }).then((r) => r.json());
  if (!create.id) throw new Error(`Instagram: ${create.error?.message ?? JSON.stringify(create)}`);

  // O Instagram baixa e processa o vídeo de forma assíncrona
  for (let i = 0; i < 60; i++) {
    await sleep(10_000);
    const st = await fetch(`${GRAPH}/${create.id}?fields=status_code,status&access_token=${encodeURIComponent(token)}`).then((r) => r.json());
    if (st.status_code === "FINISHED") break;
    if (st.status_code === "ERROR" || st.status_code === "EXPIRED") throw new Error(`Instagram recusou o vídeo: ${st.status ?? st.status_code}`);
    if (i === 59) throw new Error("Instagram demorou demais para processar o vídeo");
  }

  const pub = await fetch(`${GRAPH}/${igUser}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: create.id, access_token: token }),
  }).then((r) => r.json());
  if (!pub.id) throw new Error(`Instagram publish: ${pub.error?.message ?? JSON.stringify(pub)}`);
  const info = await fetch(`${GRAPH}/${pub.id}?fields=permalink&access_token=${encodeURIComponent(token)}`).then((r) => r.json());
  return { externalId: pub.id, externalUrl: info.permalink ?? null };
}

// ─── TikTok (Content Posting API, Direct Post via PULL_FROM_URL) ──────────
async function publishTikTok(ctx: Ctx): Promise<Result> {
  const { token } = await getAccessToken(ctx.clientId, "TIKTOK");
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" };

  // Privacidade precisa ser uma das opções permitidas para o criador (apps não auditados: só SELF_ONLY)
  const creator = await fetch("https://open.tiktokapis.com/v2/post/publish/creator_info/query/", { method: "POST", headers: auth }).then((r) => r.json());
  const options: string[] = creator.data?.privacy_level_options ?? [];
  const privacy = options.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : options[0];
  if (!privacy) throw new Error(`TikTok: ${creator.error?.message ?? "sem permissão de postagem"}`);

  const init = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      post_info: { title: ctx.caption.slice(0, 2200), privacy_level: privacy, disable_comment: false, disable_duet: false, disable_stitch: false },
      // PULL_FROM_URL exige o domínio do APP_URL/R2 verificado no portal do TikTok
      source_info: { source: "PULL_FROM_URL", video_url: await temporaryUrl(ctx.asset.storageKey, ctx.asset.id) },
    }),
  }).then((r) => r.json());
  const publishId = init.data?.publish_id;
  if (!publishId) throw new Error(`TikTok: ${init.error?.message ?? JSON.stringify(init)}`);

  for (let i = 0; i < 60; i++) {
    await sleep(10_000);
    const st = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ publish_id: publishId }),
    }).then((r) => r.json());
    const s = st.data?.status;
    if (s === "PUBLISH_COMPLETE") {
      const postId = st.data?.publicaly_available_post_id?.[0] ?? st.data?.publicly_available_post_id?.[0];
      return { externalId: String(postId ?? publishId), externalUrl: null };
    }
    if (s === "FAILED") throw new Error(`TikTok falhou: ${st.data?.fail_reason ?? "motivo não informado"}`);
  }
  throw new Error("TikTok demorou demais para concluir a publicação");
}

// ─── YouTube Shorts (Data API v3, upload resumable) ──────────────────────
async function publishYouTube(ctx: Ctx): Promise<Result> {
  const { token } = await getAccessToken(ctx.clientId, "YOUTUBE");
  const { stream, size } = await openObjectStream(ctx.asset.storageKey);
  const hashtags = ctx.caption.match(/#[\p{L}\d_]+/gu)?.slice(0, 15) ?? [];
  const title = (ctx.title.includes("#Shorts") ? ctx.title : `${ctx.title} #Shorts`).slice(0, 100);

  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": ctx.asset.mime,
      "X-Upload-Content-Length": String(size),
    },
    body: JSON.stringify({
      snippet: { title, description: ctx.caption.slice(0, 5000), tags: hashtags.map((h) => h.slice(1)), categoryId: "22" },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    }),
  });
  const location = init.headers.get("location");
  if (!init.ok || !location) throw new Error(`YouTube init HTTP ${init.status}: ${(await init.text()).slice(0, 300)}`);

  const up = await fetch(location, {
    method: "PUT",
    headers: { "Content-Type": ctx.asset.mime, "Content-Length": String(size) },
    body: Readable.toWeb(stream) as ReadableStream,
    // @ts-expect-error -- necessário no Node para enviar corpo em stream
    duplex: "half",
  });
  const video = await up.json().catch(() => ({}));
  if (!up.ok || !video.id) throw new Error(`YouTube upload HTTP ${up.status}: ${JSON.stringify(video).slice(0, 300)}`);
  return { externalId: video.id, externalUrl: `https://youtube.com/shorts/${video.id}` };
}

const PUBLISHERS: Record<Channel, (c: Ctx) => Promise<Result>> = {
  INSTAGRAM: publishInstagram,
  TIKTOK: publishTikTok,
  YOUTUBE: publishYouTube,
};

/**
 * Publica um post em todos os canais pendentes. Cada canal é independente:
 * se o TikTok falhar, Instagram e YouTube seguem. Canais já publicados não repetem.
 */
export async function publishPost(postId: string) {
  const post = await db.query.posts.findFirst({ where: eq(t.posts.id, postId), with: { media: true, targets: true } });
  if (!post) return;
  if (!post.media || post.media.status !== "READY") throw new Error("Post sem vídeo pronto.");
  await db.update(t.posts).set({ status: "PUBLICANDO" }).where(eq(t.posts.id, postId));

  const ctx: Ctx = { clientId: post.clientId, title: post.title, caption: post.caption, asset: post.media };
  const pending = post.targets.filter((tg) => tg.status !== "PUBLISHED");

  await Promise.all(
    pending.map(async (tg) => {
      try {
        const r = await PUBLISHERS[tg.channel](ctx);
        await db
          .update(t.postTargets)
          .set({ status: "PUBLISHED", externalId: r.externalId, externalUrl: r.externalUrl, error: null, publishedAt: new Date(), attempts: tg.attempts + 1 })
          .where(eq(t.postTargets.id, tg.id));
      } catch (e) {
        await db
          .update(t.postTargets)
          .set({ status: "FAILED", error: (e instanceof Error ? e.message : String(e)).slice(0, 1000), attempts: tg.attempts + 1 })
          .where(eq(t.postTargets.id, tg.id));
      }
    }),
  );

  const failed = await db.select({ id: t.postTargets.id }).from(t.postTargets).where(and(eq(t.postTargets.postId, postId), eq(t.postTargets.status, "FAILED")));
  await db
    .update(t.posts)
    .set({ status: failed.length ? "FALHOU" : "PUBLICADO" })
    .where(eq(t.posts.id, postId));
}
