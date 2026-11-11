"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Link2, Search } from "lucide-react";
import { baixarAction, lerLinkAction } from "@/app/actions/ferramentas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { BotaoAcao, ListaResultados, Painel, Progresso, type ArquivoPronto } from "./comum";

type Opcao = { tipo: "video" | "audio" | "original"; altura?: number; rotulo: string };
type Info = { url: string; titulo: string; autor: string; duracao: number; miniatura: string | null; site: string; opcoes: Opcao[] };

const duracao = (s: number) => (s ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "");

export function Baixador() {
  const [link, setLink] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [opcao, setOpcao] = useState(0);
  const [lendo, setLendo] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [autorizado, setAutorizado] = useState(false);
  const [prontos, setProntos] = useState<ArquivoPronto[]>([]);

  async function ler(e?: React.FormEvent) {
    e?.preventDefault();
    if (!link.trim()) return;
    setLendo(true);
    setInfo(null);
    setProntos([]);
    try {
      const r = await lerLinkAction(link);
      if (!r.ok) return void toast.error(r.message);
      setInfo(r.dados);
      setOpcao(Math.max(0, r.dados.opcoes.findIndex((o) => o.altura === 1080)));
    } finally {
      setLendo(false);
    }
  }

  async function baixar() {
    if (!info) return;
    setBaixando(true);
    try {
      const r = await baixarAction({ url: info.url, opcao: info.opcoes[opcao] });
      if (!r.ok) return void toast.error(r.message);
      setProntos((p) => [r.dados, ...p]);
      toast.success("Download pronto!");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Painel titulo="Baixador" descricao="Baixe vídeos e áudios do YouTube, Instagram, TikTok, Facebook, X, Vimeo e outros. Cole o link e as opções aparecem prontas.">
      <form onSubmit={ler} className="grid gap-2 sm:flex sm:items-end">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Label htmlFor="link-baixar">Link do vídeo</Label>
          <Input id="link-baixar" type="url" inputMode="url" placeholder="https://www.youtube.com/watch?v=…" value={link} onChange={(e) => setLink(e.target.value)} className="h-11 sm:h-9" />
        </div>
        <BotaoAcao type="submit" ocupado={lendo} disabled={!link.trim()} icone={<Search data-icon="inline-start" />}>
          {lendo ? "Lendo…" : "Ver opções"}
        </BotaoAcao>
      </form>

      {info && (
        <div className="grid gap-3 rounded-xl border bg-background p-3 sm:grid-cols-[160px_minmax(0,1fr)]">
          {info.miniatura ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.miniatura} alt="" className="aspect-video w-full rounded-lg object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg bg-muted"><Link2 className="size-6 text-muted-foreground" /></div>
          )}
          <div className="grid min-w-0 content-start gap-1">
            <p className="line-clamp-2 font-medium">{info.titulo}</p>
            <p className="text-xs text-muted-foreground">{[info.site, info.autor, duracao(info.duracao)].filter(Boolean).join(" • ")}</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {info.opcoes.map((o, i) => (
                <button
                  key={o.rotulo}
                  type="button"
                  onClick={() => setOpcao(i)}
                  aria-pressed={opcao === i}
                  className={cn("min-h-11 rounded-lg border px-2 text-sm sm:min-h-9", opcao === i ? "border-signal bg-signal/10 font-medium" : "hover:bg-muted")}
                >
                  {o.rotulo}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {info && (
        <>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={autorizado} onChange={(e) => setAutorizado(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-signal" />
            <span>O conteúdo é meu, do cliente ou tenho autorização para baixar. (Baixar conteúdo de terceiros sem permissão pode violar direitos autorais e os termos dos sites.)</span>
          </label>
          {baixando && <Progresso valor={null} rotulo="Baixando… vídeos longos podem levar alguns minutos." />}
          <div>
            <BotaoAcao ocupado={baixando} disabled={!autorizado} onClick={baixar} icone={<Download data-icon="inline-start" />}>
              {baixando ? "Baixando…" : `Baixar ${info.opcoes[opcao]?.rotulo.toLowerCase() ?? ""}`}
            </BotaoAcao>
          </div>
        </>
      )}
      <ListaResultados arquivos={prontos} />
    </Painel>
  );
}
