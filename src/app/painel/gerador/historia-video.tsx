"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, UserRound, X } from "lucide-react";
import { enviarFotoGeradorAction } from "@/app/actions/gerador";
import { ESTETICAS } from "@/lib/gerador/estetica";
import { cn } from "@/lib/utils";

type Foto = { chave: string; previa: string };

/** Reduz a foto no navegador (até 1600 px, JPG) antes de enviar: sobe rápido até no 4G. */
async function reduzir(arq: File): Promise<string> {
  const bmp = await createImageBitmap(arq);
  const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * escala);
  c.height = Math.round(bmp.height * escala);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.88);
}

function useEnvio() {
  const [enviando, setEnviando] = useState(0);
  const [erro, setErro] = useState("");
  const enviar = async (arqs: File[]): Promise<Foto[]> => {
    setErro("");
    setEnviando((n) => n + arqs.length);
    const out: Foto[] = [];
    for (const a of arqs) {
      try {
        const dataUrl = await reduzir(a);
        const r = await enviarFotoGeradorAction(dataUrl);
        if (r.ok) out.push({ chave: r.chave, previa: dataUrl });
        else setErro(r.message);
      } catch { setErro("Não consegui abrir essa foto. Tente outra."); }
      setEnviando((n) => n - 1);
    }
    return out;
  };
  return { enviando, erro, enviar };
}

// ───────── personagem: descrição + foto de referência ─────────
export function PersonagemCampo() {
  const [foto, setFoto] = useState<Foto | null>(null);
  const { enviando, erro, enviar } = useEnvio();
  const input = useRef<HTMLInputElement>(null);
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Personagem <span className="font-normal text-muted-foreground">(opcional)</span></legend>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => (foto ? setFoto(null) : input.current?.click())}
          className="group relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed bg-muted/40 text-muted-foreground hover:bg-muted"
          aria-label={foto ? "Tirar a foto do personagem" : "Enviar foto do personagem"}
        >
          {enviando ? <Loader2 className="size-5 animate-spin" /> : foto ? (
            <>
              <img src={foto.previa} alt="" className="size-full object-cover" />
              <span className="absolute inset-0 grid place-items-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"><X className="size-5" /></span>
            </>
          ) : <span className="grid justify-items-center gap-1 text-[0.7rem]"><UserRound className="size-5" />Foto</span>}
        </button>
        <textarea
          name="personagem"
          rows={3}
          maxLength={600}
          placeholder="Ex.: Dona Rita, 60 anos, cabelo grisalho preso, avental vermelho, sorriso largo, dona da padaria."
          className="min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm dark:bg-input/30"
        />
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setFoto((await enviar([f]))[0] ?? null); }} />
      <input type="hidden" name="fotoPersonagem" value={foto?.chave ?? ""} />
      <p className="text-xs text-muted-foreground">Com foto, uma IA que enxerga imagens descreve a aparência e o personagem sai igual em todas as cenas.</p>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </fieldset>
  );
}

// ───────── estética do vídeo ─────────
export function EsteticaEscolha() {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Estética <span className="font-normal text-muted-foreground">(no estilo com IA)</span></legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Chip id="" nome="O diretor escolhe" descricao="Combina com a história" cor="transparent" padrao />
        {ESTETICAS.map((e) => <Chip key={e.id} id={e.id} nome={e.nome} descricao={e.descricao} cor={e.cor} />)}
      </div>
    </fieldset>
  );
}

function Chip({ id, nome, descricao, cor, padrao }: { id: string; nome: string; descricao: string; cor: string; padrao?: boolean }) {
  return (
    <label className="grid cursor-pointer gap-0.5 rounded-xl border p-2.5 text-xs transition-colors hover:bg-muted/50 has-[:checked]:border-signal has-[:checked]:bg-signal/5 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
      <input type="radio" name="estetica" value={id} defaultChecked={padrao} className="sr-only" />
      <span className="flex items-center gap-1.5 text-[0.8rem] font-semibold">
        <span className={cn("size-2.5 shrink-0 rounded-full", padrao && "border border-dashed border-muted-foreground")} style={{ background: cor }} aria-hidden />
        {nome}
      </span>
      <span className="leading-snug text-muted-foreground">{descricao}</span>
    </label>
  );
}

// ───────── fotos para animar ─────────
export function FotosAnimar() {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const { enviando, erro, enviar } = useEnvio();
  const input = useRef<HTMLInputElement>(null);
  const mover = (i: number, d: -1 | 1) => setFotos((l) => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Fotos para animar <span className="font-normal text-muted-foreground">(opcional, até 12)</span></legend>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {fotos.map((f, i) => (
          <li key={f.chave} className="relative overflow-hidden rounded-lg border bg-muted">
            <img src={f.previa} alt={`Foto ${i + 1}`} className="aspect-square w-full object-cover" />
            <span className="absolute top-1 left-1 rounded bg-black/65 px-1.5 text-[0.7rem] font-semibold text-white">Cena {i + 1}</span>
            <button type="button" onClick={() => setFotos((l) => l.filter((x) => x.chave !== f.chave))} aria-label={`Tirar a foto ${i + 1}`} className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/65 text-white hover:bg-black/80"><X className="size-4" /></button>
            <div className="absolute inset-x-1 bottom-1 flex justify-between">
              <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Mover para antes" className="grid size-7 place-items-center rounded-full bg-black/65 text-white disabled:opacity-0"><ArrowLeft className="size-4" /></button>
              <button type="button" disabled={i === fotos.length - 1} onClick={() => mover(i, 1)} aria-label="Mover para depois" className="grid size-7 place-items-center rounded-full bg-black/65 text-white disabled:opacity-0"><ArrowRight className="size-4" /></button>
            </div>
          </li>
        ))}
        {fotos.length + enviando < 12 && (
          <li>
            <button type="button" onClick={() => input.current?.click()} className="grid aspect-square w-full place-items-center rounded-lg border border-dashed bg-muted/40 text-xs text-muted-foreground hover:bg-muted">
              {enviando ? <Loader2 className="size-5 animate-spin" /> : <span className="grid justify-items-center gap-1"><ImagePlus className="size-5" />Adicionar</span>}
            </button>
          </li>
        )}
      </ul>
      <input
        ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
        onChange={async (e) => { const arqs = [...(e.target.files ?? [])].slice(0, 12 - fotos.length); e.target.value = ""; const novas = await enviar(arqs); setFotos((l) => [...l, ...novas].slice(0, 12)); }}
      />
      <input type="hidden" name="fotosAnimar" value={JSON.stringify(fotos.map((f) => f.chave))} />
      <p className="text-xs text-muted-foreground">Cada foto vira uma cena, nesta ordem, com movimento de câmera (ou clipe, se houver IA de vídeo). A narração fala do que aparece nelas. Só no estilo com IA.</p>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </fieldset>
  );
}
