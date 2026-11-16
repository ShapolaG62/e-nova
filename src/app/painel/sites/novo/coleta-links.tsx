"use client";

import { useState } from "react";
import { AtSign, CheckCircle2, Globe, Loader2, MapPin, MessageCircle, Sparkles, TriangleAlert } from "lucide-react";
import { coletarLinksAction } from "@/app/actions/vendas";
import type { Coleta } from "@/lib/sites/coleta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CAMPOS = [
  { id: "instagram", rotulo: "Instagram", Icone: AtSign, dica: "instagram.com/perfil ou @perfil" },
  { id: "whatsapp", rotulo: "WhatsApp", Icone: MessageCircle, dica: "wa.me/5511999999999 ou o número" },
  { id: "maps", rotulo: "Google Maps", Icone: MapPin, dica: "link de Compartilhar do lugar" },
  { id: "site", rotulo: "Site (se tiver)", Icone: Globe, dica: "opcional" },
] as const;

/**
 * "Preencher pelos links": o vendedor cola o Instagram, o WhatsApp e o Maps do negócio e o E-Nova visita
 * cada um, colhendo nome, contatos, endereço, fotos, cores da marca e o ramo. Depois é só conferir.
 */
export function ColetaLinks({ onPronto }: { onPronto: (c: Coleta) => void }) {
  const [v, setV] = useState({ instagram: "", whatsapp: "", maps: "", site: "" });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [res, setRes] = useState<Coleta | null>(null);

  const buscar = async () => {
    setErro(""); setRes(null); setCarregando(true);
    const r = await coletarLinksAction(v);
    setCarregando(false);
    if (!r.ok) return setErro(r.message);
    setRes(r.data);
    onPronto(r.data);
  };

  const algum = Object.values(v).some((x) => x.trim());
  return (
    <section aria-labelledby="coleta-titulo" className="grid gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <div>
        <h3 id="coleta-titulo" className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-primary" /> Preencher pelos links</h3>
        <p className="mt-1 text-sm text-muted-foreground">Cole os links do negócio. O E-Nova visita cada um e traz nome, contatos, endereço, fotos, cores da marca e o ramo. Você confere tudo antes de seguir.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {CAMPOS.map(({ id, rotulo, Icone, dica }) => (
          <div key={id} className="grid gap-1.5">
            <Label htmlFor={`lk-${id}`} className="flex items-center gap-1.5"><Icone className="size-3.5 text-muted-foreground" /> {rotulo}</Label>
            <Input id={`lk-${id}`} value={v[id]} onChange={(e) => setV({ ...v, [id]: e.target.value })} placeholder={dica} className="h-10 sm:h-9" inputMode="url" autoComplete="off" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={buscar} disabled={!algum || carregando} className="h-10 w-full sm:w-auto">
          {carregando ? <Loader2 className="animate-spin" /> : <Sparkles />} {carregando ? "Visitando os links…" : "Buscar dados"}
        </Button>
        {carregando && <span className="text-xs text-muted-foreground">Leva uns segundos: abre cada link e uma IA lê o perfil.</span>}
      </div>
      {erro && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      {res && (
        <div className="grid gap-3 rounded-lg bg-muted/40 p-3">
          <ul className="grid gap-1.5 text-sm">
            {res.achados.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                {a.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />}
                <span className={a.ok ? "" : "text-muted-foreground"}>{a.texto}</span>
              </li>
            ))}
          </ul>
          {(res.fotos.length > 0 || res.cores.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {res.cores.map((c) => <span key={c.hex} title={`${c.nome} ${c.hex}`} className="size-7 rounded-full border-2 border-card shadow-sm ring-1 ring-border" style={{ background: c.hex }} />)}
              {res.fotos.slice(0, 8).map((f) => <img key={f} src={f} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-12 rounded-md object-cover ring-1 ring-border" />)}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Os campos abaixo já foram preenchidos. Confira e clique em “Usar este negócio”.</p>
        </div>
      )}
    </section>
  );
}
