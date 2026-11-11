"use client";

import { useState } from "react";
import {
  Banknote, ChevronLeft, Crop, Download, IdCard, Images, LayoutGrid, Mail, MessageSquare, Minimize2, MonitorUp, Pipette, QrCode, RefreshCw, Scissors, Smartphone, Languages,
} from "lucide-react";
import { FERRAMENTAS, GRUPOS, type FerramentaId } from "@/lib/ferramentas/catalogo";
import { cn } from "@/lib/utils";
import { Conversor } from "@/components/ferramentas/conversor";
import { Compressor } from "@/components/ferramentas/compressor";
import { CortarVideo } from "@/components/ferramentas/cortar-video";
import { Baixador } from "@/components/ferramentas/baixador";
import { BancoMidia } from "@/components/ferramentas/banco-midia";
import { GravarTela } from "@/components/ferramentas/gravar-tela";
import { GeradorQr } from "@/components/ferramentas/qrcode";
import { ContaGotas } from "@/components/ferramentas/conta-gotas";
import { RecortarImagem } from "@/components/ferramentas/recortar-imagem";
import { ChatIa, Tradutor } from "@/components/ferramentas/ia";
import { Celular } from "@/components/ferramentas/celular";
import { Cambio, DadosTeste, EmailTemporario } from "@/components/ferramentas/extras";

const ICONES: Record<FerramentaId, React.ComponentType<{ className?: string }>> = {
  conversor: RefreshCw,
  compressor: Minimize2,
  "cortar-video": Scissors,
  baixador: Download,
  "banco-midia": Images,
  "gravar-tela": MonitorUp,
  qrcode: QrCode,
  "conta-gotas": Pipette,
  "recortar-imagem": Crop,
  tradutor: Languages,
  "chat-ia": MessageSquare,
  celular: Smartphone,
  cambio: Banknote,
  "email-temporario": Mail,
  "dados-teste": IdCard,
};

export function Ferramentas({ inicial, temChavePixabay, iaPronta, podeConfigurar }: {
  inicial: FerramentaId | null;
  temChavePixabay: boolean;
  iaPronta: boolean;
  podeConfigurar: boolean;
}) {
  const [atual, setAtual] = useState<FerramentaId | null>(inicial);

  function abrir(id: FerramentaId | null) {
    setAtual(id);
    // mantém ?f=<id> no endereço (dá para favoritar ou mandar o link)
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("f", id);
    else url.searchParams.delete("f");
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!atual) {
    return (
      <div className="grid gap-6">
        {GRUPOS.map((g) => (
          <section key={g} className="grid gap-2.5">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{g}</h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {FERRAMENTAS.filter((f) => f.grupo === g).map((f) => {
                const Icone = ICONES[f.id];
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => abrir(f.id)}
                      className="grid h-full w-full content-start gap-2 rounded-2xl border bg-card p-3.5 text-left transition-colors hover:border-signal/60 hover:bg-signal/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-4"
                    >
                      <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Icone className="size-5" /></span>
                      <span className="font-medium leading-tight">{f.nome}</span>
                      <span className="text-xs leading-snug text-muted-foreground">{f.desc}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <nav aria-label="Ferramentas" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max items-center gap-1 rounded-xl bg-muted p-1">
          <li>
            <button
              type="button"
              onClick={() => abrir(null)}
              className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-8"
            >
              <ChevronLeft className="size-4 sm:hidden" />
              <LayoutGrid className="hidden size-4 sm:block" /> Todas
            </button>
          </li>
          {FERRAMENTAS.map((f, i) => {
            const Icone = ICONES[f.id];
            const novoGrupo = i > 0 && FERRAMENTAS[i - 1].grupo !== f.grupo;
            return (
              <li key={f.id} className="flex items-center">
                {(i === 0 || novoGrupo) && <span className="mx-1 h-5 w-px bg-border" aria-hidden />}
                <button
                  type="button"
                  onClick={() => abrir(f.id)}
                  aria-current={atual === f.id ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-8",
                    atual === f.id ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icone className="size-4" />
                  {f.nome}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div key={atual} className="min-w-0">
        {atual === "conversor" && <Conversor />}
        {atual === "compressor" && <Compressor />}
        {atual === "cortar-video" && <CortarVideo />}
        {atual === "baixador" && <Baixador />}
        {atual === "banco-midia" && <BancoMidia temChave={temChavePixabay} podeConfigurar={podeConfigurar} />}
        {atual === "gravar-tela" && <GravarTela />}
        {atual === "qrcode" && <GeradorQr />}
        {atual === "conta-gotas" && <ContaGotas />}
        {atual === "recortar-imagem" && <RecortarImagem />}
        {atual === "tradutor" && <Tradutor iaPronta={iaPronta} podeConfigurar={podeConfigurar} />}
        {atual === "chat-ia" && <ChatIa iaPronta={iaPronta} podeConfigurar={podeConfigurar} />}
        {atual === "celular" && <Celular />}
        {atual === "cambio" && <Cambio />}
        {atual === "email-temporario" && <EmailTemporario />}
        {atual === "dados-teste" && <DadosTeste />}
      </div>
    </div>
  );
}
