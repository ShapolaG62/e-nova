import "server-only";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { deleteObject, objectSize, readHead } from "@/lib/storage";

/**
 * Confere um upload recém-terminado: tamanho real e assinatura ISO-BMFF ("ftyp"),
 * comum a MP4 e MOV. Marca READY ou apaga o arquivo e marca FAILED.
 */
export async function verifyUploadedVideo(assetId: string) {
  const asset = await db.query.mediaAssets.findFirst({ where: eq(t.mediaAssets.id, assetId) });
  if (!asset || asset.status !== "UPLOADING") return { ok: false as const, error: "Upload não encontrado" };
  const size = await objectSize(asset.storageKey);
  const head = size ? await readHead(asset.storageKey, 12) : Buffer.alloc(0);
  if (!size || head.subarray(4, 8).toString("latin1") !== "ftyp") {
    await db.update(t.mediaAssets).set({ status: "FAILED" }).where(eq(t.mediaAssets.id, assetId));
    await deleteObject(asset.storageKey).catch(() => {});
    return { ok: false as const, error: "O arquivo não é um vídeo MP4/MOV válido" };
  }
  await db.update(t.mediaAssets).set({ status: "READY", sizeBytes: size }).where(eq(t.mediaAssets.id, assetId));
  return { ok: true as const, asset: { ...asset, sizeBytes: size } };
}
