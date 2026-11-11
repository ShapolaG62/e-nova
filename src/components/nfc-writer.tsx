"use client";

import { useState, useSyncExternalStore } from "react";

const noop = () => () => {};
import { Loader2, Nfc } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/* Web NFC: existe no Chrome para Android (HTTPS). Tipagem mínima, pois não está no lib.dom. */
type NDEFReaderLike = {
  write: (msg: { records: { recordType: string; data: string }[] }) => Promise<void>;
  scan: () => Promise<void>;
  onreading: ((e: { serialNumber: string }) => void) | null;
};
declare global {
  interface Window {
    NDEFReader?: new () => NDEFReaderLike;
  }
}

/**
 * Grava o link na tag encostando o celular, e opcionalmente lê o número do chip.
 * Funciona no Chrome do Android; nos outros, mostra o link para usar um app gravador.
 */
export function NfcWriter({ url, onUid }: { url: string; onUid?: (uid: string) => Promise<{ ok: boolean; message?: string }> }) {
  const [state, setState] = useState<"idle" | "writing" | "reading">("idle");
  // Detecta só no navegador (no servidor é sempre false) sem quebrar a hidratação
  const supported = useSyncExternalStore(
    noop,
    () => "NDEFReader" in window,
    () => false,
  );

  async function write() {
    if (!window.NDEFReader) return;
    setState("writing");
    try {
      const reader = new window.NDEFReader();
      await reader.write({ records: [{ recordType: "url", data: url }] });
      toast.success("Link gravado na tag. Encoste de novo para testar.");
    } catch (e) {
      toast.error(e instanceof Error && e.name === "NotAllowedError" ? "Permita o uso de NFC no navegador." : "Não deu para gravar. Mantenha o celular encostado até confirmar.");
    } finally {
      setState("idle");
    }
  }

  async function readUid() {
    if (!window.NDEFReader || !onUid) return;
    setState("reading");
    try {
      const reader = new window.NDEFReader();
      await reader.scan();
      reader.onreading = async (e) => {
        reader.onreading = null;
        const r = await onUid(e.serialNumber);
        if (r.ok) toast.success(r.message ?? "Chip registrado.");
        else toast.error(r.message ?? "Falha ao registrar.");
        setState("idle");
      };
    } catch {
      toast.error("Não deu para ler a tag.");
      setState("idle");
    }
  }

  if (!supported) {
    return (
      <p className="rounded-xl bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Para gravar pelo navegador, abra esta tela no <strong>Chrome do Android</strong>. No iPhone ou computador, use um app gravador de NFC (ex.: NFC Tools) com o link acima.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={write} disabled={state !== "idle"} className="h-11 flex-1">
        {state === "writing" ? <Loader2 className="animate-spin" /> : <Nfc />}
        {state === "writing" ? "Encoste a tag no celular…" : "Gravar link na tag"}
      </Button>
      {onUid && (
        <Button type="button" variant="outline" onClick={readUid} disabled={state !== "idle"} className="h-11">
          {state === "reading" ? "Encoste a tag…" : "Ler número do chip"}
        </Button>
      )}
    </div>
  );
}
