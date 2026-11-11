"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { createUploadAction } from "@/app/actions/content";
import type { startClipProjectAction } from "@/app/actions/clips";

/** Envia o vídeo longo (podcast, live, aula) e abre o projeto de cortes. */
export function ClipUploader({
  clients,
  createUpload,
  startProject,
  maxMb,
}: {
  clients: { id: string; name: string }[];
  createUpload: typeof createUploadAction;
  startProject: typeof startClipProjectAction;
  maxMb: number;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState<number | null>(null);

  function put(url: string, f: File, headers: Record<string, string>) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(e.loaded / e.total);
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Falha no envio (HTTP ${xhr.status})`)));
      xhr.onerror = () => reject(new Error("Conexão interrompida"));
      xhr.send(f);
    });
  }

  async function start() {
    if (!file || !clientId) return;
    const mime = file.type || (file.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4");
    setProgress(0);
    try {
      const up = await createUpload({ clientId, filename: file.name, mime: mime as "video/mp4", size: file.size });
      if (!up.ok) throw new Error(up.error);
      await put(up.upload.url, file, up.upload.headers);
      const r = await startProject(up.assetId, title);
      if (!r.ok) throw new Error(r.error);
      toast.success("Vídeo enviado. A transcrição começou.");
      router.push(`/painel/cortes/${r.projectId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio");
      setProgress(null);
    }
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setFile(e.dataTransfer.files[0] ?? null);
        }}
        className="grid place-items-center gap-2 rounded-2xl border-2 border-dashed bg-card px-4 py-8 text-center hover:border-primary/50"
      >
        {file ? <Film className="size-7 text-primary" /> : <Upload className="size-7 text-muted-foreground" />}
        <span className="text-sm">
          {file ? (
            <>
              <strong className="font-semibold">{file.name}</strong> · {(file.size / 1024 / 1024).toFixed(0)} MB
            </>
          ) : (
            <>
              <strong className="font-semibold">Escolha o vídeo longo</strong> <span className="text-muted-foreground">(podcast, live, aula, depoimento)</span>
            </>
          )}
        </span>
        <span className="text-xs text-muted-foreground">.mp4 ou .mov, até {maxMb} MB · horizontal ou vertical</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f && f.size > maxMb * 1024 * 1024) return toast.error(`Maior que ${maxMb} MB`);
          setFile(f);
          if (f && !title) setTitle(f.name.replace(/\.(mp4|mov)$/i, ""));
        }}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-10 rounded-lg border border-input bg-card px-2.5 text-sm" aria-label="Cliente">
          <option value="">Para qual cliente?</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome do projeto" className="h-10" />
      </div>
      <Button onClick={start} disabled={!file || !clientId || progress !== null} className="h-11">
        {progress !== null ? <Loader2 className="animate-spin" /> : <Upload />}
        {progress !== null ? `Enviando ${Math.round(progress * 100)}%` : "Enviar e encontrar os cortes"}
      </Button>
    </div>
  );
}
