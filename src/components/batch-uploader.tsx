"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Film, Loader2, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { createUploadAction, finalizeUploadAction } from "@/app/actions/content";
import { cn } from "@/lib/utils";

type Item = { file: File; progress: number; status: "fila" | "enviando" | "validando" | "ok" | "erro"; error?: string; postId?: string };

const ACCEPT = ["video/mp4", "video/quicktime"];

/** Envia vários vídeos verticais em sequência, com progresso por arquivo. */
export function BatchUploader({
  clients,
  defaultClientId,
  createUpload,
  finalizeUpload,
  maxMb,
}: {
  clients: { id: string; name: string }[];
  defaultClientId: string | null;
  createUpload: typeof createUploadAction;
  finalizeUpload: typeof finalizeUploadAction;
  maxMb: number;
}) {
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const patch = (i: number, p: Partial<Item>) => setItems((arr) => arr.map((it, j) => (j === i ? { ...it, ...p } : it)));

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: Item[] = Array.from(list).map((file) => {
      const mime = file.type || (file.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : "");
      if (!ACCEPT.includes(mime)) return { file, progress: 0, status: "erro", error: "Formato não suportado (use .mp4 ou .mov)" };
      if (file.size > maxMb * 1024 * 1024) return { file, progress: 0, status: "erro", error: `Maior que ${maxMb} MB` };
      return { file, progress: 0, status: "fila" };
    });
    setItems((arr) => [...arr, ...next]);
  }

  function put(url: string, file: File, headers: Record<string, string>, onProgress: (p: number) => void) {
    // XHR em vez de fetch: dá o progresso do envio
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Falha no envio (HTTP ${xhr.status})`)));
      xhr.onerror = () => reject(new Error("Conexão interrompida"));
      xhr.send(file);
    });
  }

  async function start() {
    if (!clientId) return;
    setBusy(true);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.status !== "fila") continue;
      try {
        patch(i, { status: "enviando" });
        const mime = it.file.type || "video/quicktime";
        const created = await createUpload({ clientId, filename: it.file.name, mime: mime as "video/mp4", size: it.file.size });
        if (!created.ok) throw new Error(created.error);
        await put(created.upload.url, it.file, created.upload.headers, (p) => patch(i, { progress: p }));
        patch(i, { status: "validando", progress: 1 });
        const done = await finalizeUpload(created.assetId);
        if (!done.ok) throw new Error(done.error);
        patch(i, { status: "ok", postId: done.postId });
      } catch (e) {
        patch(i, { status: "erro", error: e instanceof Error ? e.message : "Falha" });
      }
    }
    setBusy(false);
  }

  const pending = items.filter((i) => i.status === "fila").length;

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5 sm:max-w-sm">
        <label className="text-sm font-medium" htmlFor="up-client">
          Cliente
        </label>
        <select id="up-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm sm:h-9">
          <option value="">Escolha…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
        className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground hover:bg-muted/50"
      >
        <Upload className="size-6" />
        <span>
          <span className="font-medium text-foreground">Toque para escolher</span> ou arraste vídeos verticais
        </span>
        <span className="text-xs">.mp4 ou .mov · até {maxMb} MB cada · vários de uma vez</span>
      </button>
      <input ref={input} type="file" accept="video/mp4,video/quicktime,.mp4,.mov" multiple hidden onChange={(e) => addFiles(e.target.files)} />

      {items.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2.5">
              <Film className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{it.file.name}</p>
                {it.status === "erro" ? (
                  <p className="text-xs text-destructive">{it.error}</p>
                ) : (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full bg-primary transition-all", it.status === "ok" && "bg-emerald-500")} style={{ width: `${Math.round(it.progress * 100)}%` }} />
                  </div>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{(it.file.size / 1024 / 1024).toFixed(1)} MB</span>
              {it.status === "ok" ? (
                <Link href={`/painel/conteudo/${it.postId}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Editar post
                </Link>
              ) : it.status === "erro" ? (
                <XCircle className="size-4 text-destructive" />
              ) : it.status !== "fila" ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button onClick={start} disabled={!clientId || !pending || busy} className="h-10 w-full sm:h-9 sm:w-auto">
          {busy ? <Loader2 className="animate-spin" /> : <Upload />}
          {busy ? "Enviando…" : `Enviar ${pending || ""} vídeo${pending === 1 ? "" : "s"}`}
        </Button>
        {!clientId && items.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Escolha o cliente antes de enviar.</p>}
      </div>
    </div>
  );
}
