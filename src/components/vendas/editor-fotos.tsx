"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { enviarImagemAction } from "@/app/actions/vendas";
import { imagemParaDataUrl } from "@/lib/sites/client-utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Ações de servidor aceitam ~1 MB por chamada: se a foto ainda passar disso, reduz mais.
const LIMITE = 900_000;

function reduzir(dataUrl: string, lado: number, qualidade: number): Promise<string> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/jpeg", qualidade));
    };
    img.onerror = () => falha(new Error("Não consegui ler essa imagem."));
    img.src = dataUrl;
  });
}

/** Lê, reduz e envia uma foto do aparelho. Devolve a URL salva no site. */
export async function enviarFoto(siteId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  let dados = await imagemParaDataUrl(file);
  for (const [lado, q] of [[1600, 0.8], [1280, 0.75], [1024, 0.7]] as const) {
    if (dados.length <= LIMITE) break;
    dados = await reduzir(dados, lado, q);
  }
  const r = await enviarImagemAction(siteId, dados);
  if (!r.ok) throw new Error(r.message);
  return r.data;
}

/** Botão "enviar do aparelho" (aceita várias fotos). */
export function BotaoEnviarFotos({
  siteId,
  multiplo = false,
  aoEnviar,
  rotulo = "Enviar do aparelho",
  className,
}: {
  siteId: string;
  multiplo?: boolean;
  aoEnviar: (urls: string[]) => void;
  rotulo?: string;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(0);
  return (
    <>
      <button
        type="button"
        disabled={enviando > 0}
        onClick={() => input.current?.click()}
        className={cn(buttonVariants({ className: "h-10 w-full" }), className)}
      >
        {enviando ? <Loader2 className="animate-spin" /> : <Upload />}
        {enviando ? `Enviando ${enviando > 1 ? `${enviando} fotos` : "foto"}…` : rotulo}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={multiplo}
        hidden
        onChange={async (e) => {
          const arquivos = [...(e.target.files ?? [])];
          e.target.value = "";
          if (!arquivos.length) return;
          setEnviando(arquivos.length);
          const urls: string[] = [];
          for (const f of arquivos) {
            try {
              urls.push(await enviarFoto(siteId, f));
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Não foi possível enviar a foto.");
            }
            setEnviando((n) => n - 1);
          }
          setEnviando(0);
          if (urls.length) aoEnviar(urls);
        }}
      />
    </>
  );
}

/** Janela "Escolher foto": fotos do site + envio do aparelho. */
export function EscolherFoto({
  aberto,
  aoFechar,
  fotos,
  siteId,
  aoEscolher,
  aoEnviarNova,
}: {
  aberto: boolean;
  aoFechar: () => void;
  fotos: string[];
  siteId: string;
  aoEscolher: (url: string) => void;
  aoEnviarNova: (url: string) => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && aoFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Escolher foto</DialogTitle>
          <DialogDescription>Toque numa foto do site ou envie uma nova.</DialogDescription>
        </DialogHeader>
        {fotos.length ? (
          <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {fotos.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => {
                  aoEscolher(u);
                  aoFechar();
                }}
                className="aspect-square overflow-hidden rounded-lg ring-1 ring-border transition hover:ring-2 hover:ring-primary"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        ) : (
          <div className="grid place-items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            <ImageIcon className="size-6" />
            Nenhuma foto no site ainda.
          </div>
        )}
        <BotaoEnviarFotos
          siteId={siteId}
          aoEnviar={(urls) => {
            aoEnviarNova(urls[0]);
            aoFechar();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
