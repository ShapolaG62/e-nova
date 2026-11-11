"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, CircleCheck, ExternalLink, KeyRound, Loader2, PlugZap, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { conectarGoogleAction } from "@/app/actions/configuracoes";
import type { ErroGoogle } from "@/lib/sites/google-erros";
import { cn } from "@/lib/utils";

export type EstadoGoogle = "sem-chave" | "ok" | "erro" | "nao-testada";

const dt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const link = "font-medium text-primary underline underline-offset-2 hover:no-underline";

/** Selo de status: reflete o último teste real da chave, não só "tem chave salva". */
export function StatusGoogle({ estado, quando, className }: { estado: EstadoGoogle; quando?: string | null; className?: string }) {
  const mapa = {
    ok: { texto: "Conectado", cls: "bg-success/12 text-success", dot: "bg-success" },
    erro: { texto: "Com erro", cls: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
    "nao-testada": { texto: "Não testada", cls: "bg-warning/15 text-warning-foreground", dot: "bg-warning" },
    "sem-chave": { texto: "Modo demonstração", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  }[estado];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", mapa.cls, className)}>
      <span className={cn("size-1.5 rounded-full", mapa.dot)} aria-hidden />
      {mapa.texto}
      {quando && estado !== "sem-chave" && <span className="font-normal opacity-75">· testado {dt.format(new Date(quando))}</span>}
    </span>
  );
}

/** Explicação do erro do Google em português, com o que fazer. */
export function ErroGooglePainel({ erro, children, className }: { erro: ErroGoogle; children?: React.ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("grid gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.06] p-4 text-sm", className)}>
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="grid gap-1">
          <p className="font-semibold text-foreground">{erro.titulo}</p>
          <p className="text-muted-foreground">{erro.explicacao}</p>
        </div>
      </div>
      <ol className="ml-6.5 grid list-decimal gap-1 pl-4 text-foreground/90 marker:text-muted-foreground">
        {erro.passos.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      {(erro.link || children) && (
        <div className="ml-6.5 flex flex-wrap items-center gap-2">
          {erro.link && (
            <a href={erro.link.href} target="_blank" rel="noopener noreferrer" className={cn(link, "inline-flex items-center gap-1")}>
              {erro.link.texto} <ExternalLink className="size-3.5" />
            </a>
          )}
          {children}
        </div>
      )}
      {erro.original && (
        <details className="ml-6.5 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Mensagem original do Google</summary>
          <p className="mt-1 font-mono break-words">{erro.original}</p>
        </details>
      )}
    </div>
  );
}

/** Passo a passo para criar a chave (uns 5 minutos). */
export function GuiaChaveGoogle({ aberto = false }: { aberto?: boolean }) {
  return (
    <details open={aberto} className="group rounded-xl border bg-muted/40 px-3.5 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium">
        <span className="inline-flex items-center gap-2">
          <KeyRound className="size-4 text-primary" /> Como conseguir a chave (uns 5 minutos)
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <ol className="mt-3 grid list-decimal gap-2 pl-5 text-muted-foreground marker:font-semibold marker:text-foreground">
        <li>
          Acesse{" "}
          <a className={link} href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">
            console.cloud.google.com
          </a>{" "}
          e entre com sua conta Google.
        </li>
        <li>Crie um projeto (ex.: “E-Nova”).</li>
        <li>
          Ative o{" "}
          <a className={link} href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer">
            faturamento
          </a>
          . O Google dá um uso gratuito todo mês; crie um <b className="text-foreground">alerta de orçamento</b> para não ter surpresa.
        </li>
        <li>
          Ative a{" "}
          <a className={link} href="https://console.cloud.google.com/apis/library/places.googleapis.com" target="_blank" rel="noopener noreferrer">
            Places API (New)
          </a>{" "}
          (precisa ser a versão “New”).
        </li>
        <li>
          Em{" "}
          <a className={link} href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
            Credenciais
          </a>
          , clique em <b className="text-foreground">Criar credenciais → Chave de API</b>.
        </li>
        <li>
          Na chave, em “Restrições de aplicativo”, deixe <b className="text-foreground">Nenhuma</b> (a busca sai do servidor, então restrição por site bloqueia). Em
          “Restrições de API”, marque só a <b className="text-foreground">Places API (New)</b>.
        </li>
        <li>Copie a chave, cole aqui e toque em “Testar e salvar”.</li>
      </ol>
    </details>
  );
}

/** Campo da chave + "Testar e salvar". Só salva se o Google aceitar (ou se a pessoa pedir "Salvar mesmo assim"). */
export function FormChaveGoogle({ onConectado, autoFocus, rotulo = "Chave da API do Google" }: { onConectado?: (final: string) => void; autoFocus?: boolean; rotulo?: string }) {
  const router = useRouter();
  const [chave, setChave] = useState("");
  const [erro, setErro] = useState<ErroGoogle | null>(null);
  const [aviso, setAviso] = useState("");
  const [pendente, start] = useTransition();

  const enviar = (mesmoAssim: boolean) =>
    start(async () => {
      setAviso("");
      if (!mesmoAssim) setErro(null);
      const r = await conectarGoogleAction(chave, mesmoAssim);
      if (r.ok) {
        setErro(null);
        setChave("");
        toast.success("Google Maps conectado");
        router.refresh();
        onConectado?.(r.data.final);
        return;
      }
      if (r.google) {
        setErro(r.google);
        if (mesmoAssim) {
          toast.warning("Chave salva, mas o Google ainda recusa. Corrija e teste de novo.");
          setChave("");
          router.refresh();
        }
      } else setAviso(r.message);
    });

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        enviar(false);
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="chave-google">{rotulo}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="chave-google"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            placeholder="Cole aqui: AIza…"
            autoComplete="off"
            spellCheck={false}
            autoFocus={autoFocus}
            maxLength={200}
            aria-invalid={!!erro || !!aviso || undefined}
            className="h-10 font-mono sm:h-9"
          />
          <Button type="submit" disabled={pendente || chave.trim().length < 5} className="h-10 shrink-0 sm:h-9">
            {pendente ? <Loader2 className="animate-spin" /> : <PlugZap />}
            {pendente ? "Testando com o Google…" : "Testar e salvar"}
          </Button>
        </div>
        {aviso && <p className="text-sm text-destructive">{aviso}</p>}
      </div>
      {erro && (
        <ErroGooglePainel erro={erro}>
          <Button type="button" variant="ghost" size="sm" disabled={pendente || !chave} onClick={() => enviar(true)}>
            Salvar mesmo assim
          </Button>
        </ErroGooglePainel>
      )}
    </form>
  );
}

/** Diálogo "Conectar Google Maps" usado na Prospecção. */
export function ConectarGoogleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [final, setFinal] = useState<string | null>(null);
  const mudar = (v: boolean) => {
    onOpenChange(v);
    if (!v) setFinal(null);
  };
  return (
    <Dialog open={open} onOpenChange={mudar}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <PlugZap className="size-5 text-primary" /> Conectar Google Maps
          </DialogTitle>
          <DialogDescription>Com a chave, a busca traz empresas reais da cidade escolhida, com telefone, nota e fotos.</DialogDescription>
        </DialogHeader>
        <div className="-mx-4 grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-1">
          {final ? (
            <div className="grid justify-items-center gap-3 py-6 text-center" role="status">
              <span className="flex size-12 items-center justify-center rounded-full bg-success/12 text-success">
                <CircleCheck className="size-6" />
              </span>
              <div>
                <p className="font-display text-lg font-semibold">Pronto, conectado!</p>
                <p className="text-sm text-muted-foreground">Chave terminada em {final} testada com sucesso. As próximas buscas já trazem empresas reais.</p>
              </div>
              <Button className="h-10 px-5" onClick={() => mudar(false)}>
                Começar a buscar
              </Button>
            </div>
          ) : (
            <>
              <FormChaveGoogle autoFocus onConectado={setFinal} />
              <GuiaChaveGoogle />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
