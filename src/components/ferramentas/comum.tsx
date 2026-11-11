"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, FileIcon, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tamanhoLegivel } from "@/lib/ferramentas/catalogo";

export type ArquivoPronto = { nome: string; tamanho: number; url: string; mime: string };
export type Enviado = { id: string; nome: string; tamanho: number };

/** Classe padrão dos botões principais: grandes no celular, compactos no computador. */
export const botaoGrande = "h-11 w-full text-[0.95rem] sm:h-9 sm:w-auto sm:text-sm";

/** Envia um arquivo em stream para /api/ferramentas/upload (com progresso). */
export function enviarArquivo(arquivo: File, onProgresso?: (fracao: number) => void, destino?: string): Promise<Enviado> {
  return new Promise((ok, falha) => {
    const x = new XMLHttpRequest();
    x.open("PUT", destino ?? `/api/ferramentas/upload?nome=${encodeURIComponent(arquivo.name)}`);
    x.setRequestHeader("Content-Type", "application/octet-stream");
    x.upload.onprogress = (e) => e.lengthComputable && onProgresso?.(e.loaded / e.total);
    x.onload = () => {
      let corpo: { erro?: string } & Partial<Enviado> = {};
      try {
        corpo = JSON.parse(x.responseText);
      } catch {
        /* resposta vazia */
      }
      if (x.status >= 200 && x.status < 300) ok(corpo as Enviado);
      else falha(new Error(corpo.erro ?? `Falha no envio (${x.status})`));
    };
    x.onerror = () => falha(new Error("Sem conexão com o servidor."));
    x.send(arquivo);
  });
}

/** Envia vários arquivos em sequência e mostra o progresso total. */
export function useEnvio() {
  const [progresso, setProgresso] = useState<number | null>(null);
  async function enviar(arquivos: File[]) {
    const total = arquivos.reduce((t, a) => t + a.size, 0) || 1;
    let feito = 0;
    const ids: string[] = [];
    setProgresso(0);
    try {
      for (const a of arquivos) {
        const r = await enviarArquivo(a, (f) => setProgresso((feito + f * a.size) / total));
        feito += a.size;
        ids.push(r.id);
      }
      return ids;
    } finally {
      setProgresso(null);
    }
  }
  return { enviar, progresso };
}

export function Painel({ titulo, descricao, children, className, acao }: { titulo: string; descricao?: React.ReactNode; children: React.ReactNode; className?: string; acao?: React.ReactNode }) {
  return (
    <section className={cn("grid min-w-0 gap-4 rounded-2xl border bg-card p-4 sm:p-5", className)}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}

export function SeletorArquivos({ aceita, multiplo = false, arquivos, onChange, rotulo, dica }: {
  aceita?: string;
  multiplo?: boolean;
  arquivos: File[];
  onChange: (a: File[]) => void;
  rotulo?: string;
  dica?: string;
}) {
  const [arrastando, setArrastando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const somar = (novos: FileList | null) => {
    if (!novos?.length) return;
    const lista = [...novos];
    onChange(multiplo ? [...arquivos, ...lista].slice(0, 20) : lista.slice(0, 1));
  };
  return (
    <div className="grid gap-2">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          somar(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center text-sm transition-colors hover:bg-muted/60 focus-within:ring-3 focus-within:ring-ring/50",
          arrastando && "border-signal bg-signal/5",
        )}
      >
        <Upload className="size-6 text-muted-foreground" aria-hidden />
        <span className="font-medium">{rotulo ?? (multiplo ? "Toque para escolher arquivos" : "Toque para escolher um arquivo")}</span>
        <span className="text-xs text-muted-foreground">{dica ?? "ou arraste para cá"}</span>
        <input
          ref={input}
          type="file"
          accept={aceita}
          multiple={multiplo}
          className="sr-only"
          onChange={(e) => {
            somar(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {arquivos.length > 0 && (
        <ul className="grid gap-1.5">
          {arquivos.map((a, i) => (
            <li key={`${a.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{tamanhoLegivel(a.size)}</span>
              <button
                type="button"
                onClick={() => onChange(arquivos.filter((_, j) => j !== i))}
                className="-mr-1 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label={`Tirar ${a.name}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Progresso({ valor, rotulo }: { valor: number | null; rotulo: string }) {
  return (
    <div className="grid gap-1.5" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin text-signal" aria-hidden />
        <span>{rotulo}</span>
        {valor !== null && <span className="ml-auto tabular-nums text-muted-foreground">{Math.round(valor * 100)}%</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full bg-signal transition-[width]", valor === null && "w-1/3 animate-pulse")} style={valor !== null ? { width: `${Math.max(3, valor * 100)}%` } : undefined} />
      </div>
    </div>
  );
}

export function ListaResultados({ arquivos, extra }: { arquivos: ArquivoPronto[]; extra?: (a: ArquivoPronto, i: number) => React.ReactNode }) {
  if (!arquivos.length) return null;
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Pronto! {arquivos.length > 1 ? `${arquivos.length} arquivos` : "Seu arquivo"} (o link vale 24 horas):</p>
      <ul className="grid gap-2">
        {arquivos.map((a, i) => (
          <li key={a.url} className="grid gap-2 rounded-xl border bg-background p-3 sm:flex sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.nome}</p>
              <p className="text-xs text-muted-foreground">
                {tamanhoLegivel(a.tamanho)}
                {extra?.(a, i)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <a href={a.url} target="_blank" rel="noopener" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-muted sm:h-8">
                <ExternalLink className="size-4" aria-hidden /> Abrir
              </a>
              <a href={`${a.url}&dl=1`} download={a.nome} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80 sm:h-8">
                <Download className="size-4" aria-hidden /> Baixar
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Segmentado<T extends string>({ opcoes, valor, onChange, rotulo, colunas }: {
  opcoes: { v: T; rotulo: string; dica?: string }[];
  valor: T;
  onChange: (v: T) => void;
  rotulo: string;
  colunas?: number;
}) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{rotulo}</legend>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${colunas ?? Math.min(opcoes.length, 3)}, minmax(0, 1fr))` }}>
        {opcoes.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            aria-pressed={valor === o.v}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-9",
              valor === o.v ? "border-signal bg-signal/10 font-medium" : "hover:bg-muted",
            )}
          >
            <span>{o.rotulo}</span>
            {o.dica && <span className="text-[0.7rem] leading-tight text-muted-foreground">{o.dica}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export async function copiar(texto: string, aviso = "Copiado!") {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(aviso);
  } catch {
    toast.error("Não deu para copiar. Selecione e copie à mão.");
  }
}

export function BotaoAcao({ ocupado, children, icone, className, ...props }: React.ComponentProps<typeof Button> & { ocupado?: boolean; icone?: React.ReactNode }) {
  return (
    <Button size="lg" className={cn(botaoGrande, className)} disabled={ocupado || props.disabled} {...props}>
      {ocupado ? <Loader2 data-icon="inline-start" className="animate-spin" /> : icone}
      {children}
    </Button>
  );
}

// ───────── preferências salvas no navegador (sem quebrar a hidratação) ─────────
const ouvintes = new Set<() => void>();
function lerArmazenado(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function inscrever(cb: () => void) {
  ouvintes.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    ouvintes.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Valor guardado no localStorage deste navegador (null no servidor ou se o navegador bloquear). */
export function useArmazenado(chave: string): [string | null, (v: string | null) => void] {
  const valor = useSyncExternalStore(inscrever, () => lerArmazenado(chave), () => null);
  const salvar = useCallback((v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(chave);
      else localStorage.setItem(chave, v);
    } catch {
      /* navegador sem armazenamento */
    }
    ouvintes.forEach((f) => f());
  }, [chave]);
  return [valor, salvar];
}
