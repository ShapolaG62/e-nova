"use client";

import { useState } from "react";
import { ArrowLeft, ArrowDown, ArrowUp, Check, ImageIcon, Link2, Loader2, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { SiteDoc } from "@/lib/sites/engine";
import { imagemPorUrlAction } from "@/app/actions/vendas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ANIMACOES, DESCRICAO_NOVO, NOMES_BLOCO, SCHEMA, TIPOS_NOVOS, palavrasDoTitulo, type Campo } from "./editor-schema";
import { BotaoEnviarFotos, EscolherFoto } from "./editor-fotos";
import { BotaoIA, Dica, Mini, Rotulo } from "./editor-pecas";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Mudar = (fn: (d: SiteDoc) => void, forcar?: boolean) => void;

export function CabecalhoPainel({ titulo, sub, aoVoltar }: { titulo: string; sub?: string; aoVoltar: () => void }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Button variant="outline" size="icon-lg" className="size-9" onClick={aoVoltar} aria-label="Voltar">
        <ArrowLeft />
      </Button>
      <div className="min-w-0">
        <h2 className="truncate text-base leading-tight font-bold">{titulo}</h2>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ───────────────────────── Campos ─────────────────────────

function Rot({ texto, children, className }: { texto: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("grid gap-1.5 text-[0.8rem] font-medium text-foreground/80", className)}>
      {texto}
      {children}
    </label>
  );
}

const linhasDe = (txt: string) => txt.split("\n").map((x) => x.trim()).filter(Boolean);

/** Textarea "uma por linha": guarda o texto local para não engolir linhas vazias enquanto digita. */
function CampoLinhas({ valor, aoMudar, linhas = 3, placeholder }: { valor: string[]; aoMudar: (v: string[]) => void; linhas?: number; placeholder?: string }) {
  const [txt, setTxt] = useState(() => (valor ?? []).join("\n"));
  const externo = JSON.stringify(valor ?? []);
  const [visto, setVisto] = useState(externo);
  if (visto !== externo) {
    // Desfazer/IA mudaram o valor por fora: atualiza o texto
    setVisto(externo);
    if (JSON.stringify(linhasDe(txt)) !== externo) setTxt((JSON.parse(externo) as string[]).join("\n"));
  }
  return (
    <Textarea
      rows={linhas}
      value={txt}
      placeholder={placeholder}
      className="text-sm"
      onChange={(e) => {
        setTxt(e.target.value);
        aoMudar(linhasDe(e.target.value));
      }}
    />
  );
}

function Estrelas({ valor, aoMudar }: { valor: number; aoMudar: (n: number) => void }) {
  const n = Math.max(1, Math.min(5, Number(valor) || 5));
  return (
    <div className="flex gap-0.5" role="radiogroup" aria-label="Estrelas">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={i === n} aria-label={`${i} estrela${i > 1 ? "s" : ""}`} onClick={() => aoMudar(i)} className="p-0.5">
          <Star className={cn("size-6 transition", i <= n ? "fill-star text-star" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  );
}

function CampoFoto({ valor, aoEscolher, aoTirar }: { valor: string; aoEscolher: () => void; aoTirar: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {valor ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={valor} alt="" className="size-14 rounded-lg object-cover ring-1 ring-border" />
      ) : (
        <span className="grid size-14 place-items-center rounded-lg border border-dashed text-muted-foreground">
          <ImageIcon className="size-5" />
        </span>
      )}
      <Button variant="outline" className="h-9" onClick={aoEscolher}>
        <ImageIcon /> Escolher
      </Button>
      {valor && (
        <Button variant="destructive" className="h-9" onClick={aoTirar}>
          Remover
        </Button>
      )}
    </div>
  );
}

// ───────────────────────── Bloco ─────────────────────────

export function PainelBloco({
  siteId,
  doc,
  blocoId,
  mudar,
  aoVoltar,
  aoPedirIA,
}: {
  siteId: string;
  doc: SiteDoc;
  blocoId: string;
  mudar: Mudar;
  aoVoltar: () => void;
  aoPedirIA: () => void;
}) {
  const [escolhendo, setEscolhendo] = useState<string | null>(null);
  const b = doc.blocos.find((x) => x.id === blocoId);
  if (!b) return <CabecalhoPainel titulo="Esta seção foi removida" aoVoltar={aoVoltar} />;
  const sc = SCHEMA[b.tipo] ?? {};
  const d = b.dados as Record<string, any>;

  /** Grava um valor no caminho ("titulo", "itens.2.texto" ou "@capa"). */
  const definir = (caminho: string, valor: unknown, forcar = true) =>
    mudar((doc) => {
      if (caminho === "@capa") {
        doc.fotos.capa = String(valor ?? "");
        return;
      }
      const bl = doc.blocos.find((x) => x.id === blocoId);
      if (!bl) return;
      const partes = caminho.split(".");
      let alvo: any = bl.dados;
      for (const p of partes.slice(0, -1)) alvo = alvo[p];
      alvo[partes.at(-1)!] = valor;
      if (partes[0] === "itens") delete bl.dados.itens[+partes[1]].exemplo;
    }, forcar);

  const ler = (caminho: string): any => {
    if (caminho === "@capa") return doc.fotos.capa || doc.fotos.lista[0] || "";
    return caminho.split(".").reduce<any>((o, p) => o?.[p], d);
  };

  const campo = ([, rot, tipo]: Campo, caminho: string) => {
    const v = ler(caminho);
    switch (tipo) {
      case "texto":
        return (
          <Rot key={caminho} texto={rot}>
            <Input className="h-10 text-sm" value={v ?? ""} onChange={(e) => definir(caminho, e.target.value, false)} />
          </Rot>
        );
      case "area":
        return (
          <Rot key={caminho} texto={rot}>
            <Textarea rows={3} className="text-sm" value={v ?? ""} onChange={(e) => definir(caminho, e.target.value, false)} />
          </Rot>
        );
      case "linhas":
        return (
          <Rot key={caminho} texto={rot}>
            <CampoLinhas valor={Array.isArray(v) ? v : []} aoMudar={(l) => definir(caminho, l, false)} />
          </Rot>
        );
      case "sim":
        return (
          <label key={caminho} className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
            {rot}
            <Switch checked={!!v} onCheckedChange={(c) => definir(caminho, c)} />
          </label>
        );
      case "numero":
        return (
          <div key={caminho} className="grid grid-cols-1 gap-1 text-[0.8rem] font-medium text-foreground/80">
            {rot}
            <Estrelas valor={v ?? 5} aoMudar={(n) => definir(caminho, n)} />
          </div>
        );
      case "foto":
        return (
          <div key={caminho} className="grid grid-cols-1 gap-1.5 text-[0.8rem] font-medium text-foreground/80">
            {rot}
            <CampoFoto valor={v ?? ""} aoEscolher={() => setEscolhendo(caminho)} aoTirar={() => definir(caminho, "")} />
          </div>
        );
      case "destaques": {
        const palavras = palavrasDoTitulo(d.titulo);
        const atuais: string[] = Array.isArray(d.destaques) ? d.destaques : [];
        const tem = (w: string) => atuais.some((x) => x.toLowerCase() === w.toLowerCase());
        return (
          <div key={caminho} className="grid grid-cols-1 gap-1.5 text-[0.8rem] font-medium text-foreground/80">
            {rot}
            <div className="flex flex-wrap gap-1.5">
              {palavras.length ? (
                palavras.map((w) => (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={tem(w)}
                    onClick={() =>
                      mudar((doc) => {
                        const bl = doc.blocos.find((x) => x.id === blocoId)!;
                        const l: string[] = bl.dados.destaques ?? [];
                        bl.dados.destaques = l.some((x) => x.toLowerCase() === w.toLowerCase()) ? l.filter((x) => x.toLowerCase() !== w.toLowerCase()) : [...l, w];
                      })
                    }
                    className={cn(
                      "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition",
                      tem(w) ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:border-primary/50",
                    )}
                  >
                    {tem(w) && <Check className="size-3" />}
                    {w}
                  </button>
                ))
              ) : (
                <span className="text-xs font-normal text-muted-foreground">Escreva o título primeiro</span>
              )}
            </div>
            <span className="text-xs font-normal text-muted-foreground">Toque nas palavras que devem aparecer na cor de destaque.</span>
          </div>
        );
      }
      case "fotos": {
        const lista = doc.fotos.lista;
        const marcadas: string[] = Array.isArray(d.fotos) ? d.fotos : [];
        return (
          <div key={caminho} className="grid grid-cols-1 gap-1.5 text-[0.8rem] font-medium text-foreground/80">
            {rot}
            <span className="text-xs font-normal text-muted-foreground">Sem seleção = usa as fotos do site automaticamente.</span>
            {lista.length ? (
              <div className="grid grid-cols-3 gap-2">
                {lista.map((f) => {
                  const on = marcadas.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        mudar((doc) => {
                          const bl = doc.blocos.find((x) => x.id === blocoId)!;
                          const atual: string[] = bl.dados.fotos ?? [];
                          bl.dados.fotos = on ? atual.filter((x) => x !== f) : doc.fotos.lista.filter((x) => x === f || atual.includes(x));
                        })
                      }
                      className={cn("relative aspect-square overflow-hidden rounded-lg ring-1 ring-border transition", on && "ring-3 ring-primary")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f} alt="" className="size-full object-cover" />
                      {on && (
                        <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="text-xs font-normal text-muted-foreground">Adicione fotos em Site inteiro → Fotos.</span>
            )}
          </div>
        );
      }
    }
  };

  const itens: any[] = Array.isArray(d.itens) ? d.itens : [];

  return (
    <div className="grid grid-cols-1 gap-4">
      <CabecalhoPainel titulo={NOMES_BLOCO[b.tipo] ?? b.tipo} sub={b.visivel === false ? "Este bloco está oculto" : undefined} aoVoltar={aoVoltar} />
      <BotaoIA titulo="Pedir para a IA" texto="Reescrever só este bloco." onClick={aoPedirIA} />

      {(sc.campos ?? []).map((c) => campo(c, c[0]))}
      {sc.foto === "capa" && campo(["capa", "Foto de capa", "foto"], "@capa")}

      {sc.itens && (
        <section className="grid grid-cols-1 gap-2.5">
          <div className="flex items-center justify-between gap-2 pt-2">
            <Rotulo>
              {sc.itens.titulo}s ({itens.length})
            </Rotulo>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                mudar((doc) => {
                  const bl = doc.blocos.find((x) => x.id === blocoId)!;
                  bl.dados.itens = [...(bl.dados.itens ?? []), structuredClone(sc.itens!.novo)];
                })
              }
            >
              <Plus /> Adicionar
            </Button>
          </div>
          {itens.map((item, i) => {
            const mover = (dir: -1 | 1) =>
              mudar((doc) => {
                const l = doc.blocos.find((x) => x.id === blocoId)!.dados.itens;
                const j = i + dir;
                if (j < 0 || j >= l.length) return;
                [l[i], l[j]] = [l[j], l[i]];
              });
            return (
              <div key={i} className="grid grid-cols-1 gap-3 rounded-xl border bg-background p-3">
                <div className="flex items-center gap-1">
                  <b className="flex-1 text-sm">
                    {sc.itens!.titulo} {i + 1}
                    {item?.exemplo && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[0.7rem] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">exemplo</span>
                    )}
                  </b>
                  <Mini rotulo="Subir" onClick={() => mover(-1)} disabled={i === 0}>
                    <ArrowUp />
                  </Mini>
                  <Mini rotulo="Descer" onClick={() => mover(1)} disabled={i === itens.length - 1}>
                    <ArrowDown />
                  </Mini>
                  <Mini
                    rotulo="Remover"
                    perigo
                    onClick={() =>
                      mudar((doc) => {
                        doc.blocos.find((x) => x.id === blocoId)!.dados.itens.splice(i, 1);
                      })
                    }
                  >
                    <Trash2 />
                  </Mini>
                </div>
                {item?.exemplo && <p className="-mt-1 text-xs text-muted-foreground">Texto de exemplo: troque por um real (o selo some ao editar).</p>}
                {sc.itens!.campos.map((c) => campo(c, `itens.${i}.${c[0]}`))}
              </div>
            );
          })}
        </section>
      )}

      <EscolherFoto
        aberto={!!escolhendo}
        aoFechar={() => setEscolhendo(null)}
        fotos={doc.fotos.lista}
        siteId={siteId}
        aoEscolher={(u) => escolhendo && definir(escolhendo, u)}
        aoEnviarNova={(u) => {
          const caminho = escolhendo;
          mudar((doc) => {
            doc.fotos.lista.push(u);
          });
          if (caminho) definir(caminho, u);
        }}
      />
    </div>
  );
}

// ───────────────────────── Adicionar seção ─────────────────────────

export function PainelAdicionar({ aoVoltar, aoInserir }: { aoVoltar: () => void; aoInserir: (tipo: string) => Promise<void> }) {
  const [inserindo, setInserindo] = useState<string | null>(null);
  return (
    <div>
      <CabecalhoPainel titulo="Adicionar seção" sub="Ela entra depois do bloco selecionado (ou antes do contato)." aoVoltar={aoVoltar} />
      <div className="grid grid-cols-1 gap-2">
        {TIPOS_NOVOS.map((t) => (
          <button
            key={t}
            type="button"
            disabled={!!inserindo}
            onClick={async () => {
              setInserindo(t);
              try {
                await aoInserir(t);
              } finally {
                setInserindo(null);
              }
            }}
            className="flex items-center gap-3 rounded-xl border bg-background p-3 text-left transition hover:border-primary/50 disabled:opacity-60"
          >
            <span className="grid min-w-0 flex-1">
              <b className="text-sm">{NOMES_BLOCO[t]}</b>
              <small className="text-xs text-muted-foreground">{DESCRICAO_NOVO[t]}</small>
            </span>
            <span className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground">
              {inserindo === t ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Inserir
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── Negócio ─────────────────────────

const CAMPOS_NEGOCIO: [string, string, string?][] = [
  ["nome", "Nome do negócio"],
  ["telefone", "Telefone (como aparece)", "tel"],
  ["whatsapp", "WhatsApp (só números, com 55)", "numeric"],
  ["endereco", "Endereço"],
  ["bairro", "Bairro"],
  ["cidade", "Cidade"],
  ["uf", "UF"],
  ["instagram", "Instagram (@perfil)"],
];

export function PainelNegocio({ doc, mudar, aoVoltar }: { doc: SiteDoc; mudar: Mudar; aoVoltar: () => void }) {
  const n = doc.negocio as Record<string, any>;
  return (
    <div>
      <CabecalhoPainel titulo="Negócio" sub="Dados que aparecem no site inteiro" aoVoltar={aoVoltar} />
      <div className="grid grid-cols-2 gap-3">
        {CAMPOS_NEGOCIO.map(([k, r, modo]) => (
          <Rot key={k} texto={r} className={k === "uf" || k === "bairro" ? "" : k === "cidade" ? "" : "col-span-2"}>
            <Input
              className="h-10 text-sm"
              inputMode={modo as React.HTMLAttributes<HTMLInputElement>["inputMode"]}
              value={n[k] ?? ""}
              maxLength={k === "uf" ? 40 : undefined}
              onChange={(e) =>
                mudar((d) => {
                  d.negocio[k] = k === "whatsapp" ? e.target.value.replace(/\D/g, "") : e.target.value;
                }, false)
              }
            />
          </Rot>
        ))}
        <Rot texto='Horários (um por linha, ex.: "segunda-feira: 08:00–18:00")' className="col-span-2">
          <CampoLinhas
            linhas={7}
            valor={Array.isArray(n.horarios) ? n.horarios : []}
            aoMudar={(l) =>
              mudar((d) => {
                d.negocio.horarios = l;
              }, false)
            }
          />
        </Rot>
      </div>
    </div>
  );
}

// ───────────────────────── Fotos ─────────────────────────

export function PainelFotos({ siteId, doc, mudar, aoVoltar }: { siteId: string; doc: SiteDoc; mudar: Mudar; aoVoltar: () => void }) {
  const [url, setUrl] = useState("");
  const [baixando, setBaixando] = useState(false);
  const f = doc.fotos;
  const capa = f.capa || f.lista[0];
  return (
    <div className="grid grid-cols-1 gap-4">
      <CabecalhoPainel titulo="Fotos" sub="A primeira (ou a marcada) é a capa" aoVoltar={aoVoltar} />
      {f.lista.length ? (
        <div className="grid grid-cols-2 gap-2">
          {f.lista.map((u, i) => (
            <div key={u + i} className={cn("group relative aspect-[4/3] overflow-hidden rounded-xl ring-1 ring-border", u === capa && "ring-3 ring-primary")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="size-full object-cover" />
              {u === capa && (
                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-semibold text-primary-foreground">
                  <Star className="size-3 fill-current" /> Capa
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 pt-6">
                {u !== capa && (
                  <button
                    type="button"
                    onClick={() =>
                      mudar((d) => {
                        d.fotos.capa = u;
                      })
                    }
                    className="flex-1 rounded-md bg-white/90 px-1.5 py-1 text-[0.7rem] font-medium text-black hover:bg-white"
                  >
                    Usar na capa
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Remover foto"
                  onClick={() =>
                    mudar((d) => {
                      const tirada = d.fotos.lista.splice(i, 1)[0];
                      if (d.fotos.capa === tirada) d.fotos.capa = "";
                    })
                  }
                  className="ml-auto grid size-6 place-items-center rounded-md bg-white/90 text-black hover:bg-red-500 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Dica>Sem fotos: o site usa as cores e as iniciais do negócio.</Dica>
      )}
      <BotaoEnviarFotos
        siteId={siteId}
        multiplo
        rotulo="Enviar fotos do aparelho"
        aoEnviar={(urls) => {
          mudar((d) => {
            d.fotos.lista.push(...urls);
          });
          toast.success(urls.length > 1 ? `${urls.length} fotos adicionadas` : "Foto adicionada");
        }}
      />
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!url.trim()) return;
          setBaixando(true);
          const r = await imagemPorUrlAction(siteId, url.trim());
          setBaixando(false);
          if (!r.ok) {
            toast.error(r.message);
            return;
          }
          mudar((d) => {
            d.fotos.lista.push(r.data);
          });
          setUrl("");
          toast.success("Foto adicionada");
        }}
      >
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ou cole o endereço da imagem" className="h-10 pl-8 text-sm" inputMode="url" />
        </div>
        <Button type="submit" variant="outline" className="h-10" disabled={baixando || !url.trim()}>
          {baixando ? <Loader2 className="animate-spin" /> : null} Usar
        </Button>
      </form>
    </div>
  );
}

// ───────────────────────── Cores ─────────────────────────

export function PainelCores({ doc, mudar, coresSetor, aoVoltar }: { doc: SiteDoc; mudar: Mudar; coresSetor: [string, string][]; aoVoltar: () => void }) {
  const c = doc.cores;
  return (
    <div className="grid grid-cols-1 gap-4">
      <CabecalhoPainel titulo="Cores" sub="A principal aparece em botões, destaques e faixas" aoVoltar={aoVoltar} />
      <div className="grid grid-cols-2 gap-2">
        {(["primaria", "secundaria"] as const).map((k) => (
          <label key={k} className="flex cursor-pointer items-center gap-2.5 rounded-xl border bg-background p-2.5 hover:border-primary/50">
            <input
              type="color"
              value={c[k]}
              onChange={(e) =>
                mudar((d) => {
                  d.cores[k] = e.target.value;
                }, false)
              }
              className="size-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
            />
            <span className="grid text-sm">
              <b>{k === "primaria" ? "Principal" : "Secundária"}</b>
              <code className="text-xs text-muted-foreground">{c[k]}</code>
            </span>
          </label>
        ))}
      </div>
      <div className="h-3 rounded-full" style={{ background: `linear-gradient(90deg, ${c.primaria}, ${c.secundaria})` }} />
      {coresSetor.length > 0 && (
        <section className="grid grid-cols-1 gap-2">
          <Rotulo>Sugestões do ramo</Rotulo>
          <div className="flex flex-wrap gap-1.5">
            {coresSetor.map(([nome, hex]) => (
              <button
                key={hex}
                type="button"
                onClick={() =>
                  mudar((d) => {
                    d.cores.primaria = hex.toLowerCase();
                  })
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-full border bg-background px-2.5 text-xs font-medium hover:border-primary/50"
              >
                <span className="size-3.5 rounded ring-1 ring-black/10" style={{ background: hex }} />
                {nome}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ───────────────────────── Animações ─────────────────────────

export function PainelAnimacoes({ doc, mudar, aoVoltar }: { doc: SiteDoc; mudar: Mudar; aoVoltar: () => void }) {
  const a = doc.animacoes;
  return (
    <div>
      <CabecalhoPainel titulo="Animações" sub="Efeitos leves, que não pesam no celular" aoVoltar={aoVoltar} />
      <div className="grid grid-cols-1 gap-2">
        {ANIMACOES.map(([k, r, padrao]) => (
          <label key={k} className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-3 text-sm">
            {r}
            <Switch
              checked={a[k] ?? padrao}
              onCheckedChange={(v) =>
                mudar((d) => {
                  d.animacoes[k] = v;
                })
              }
            />
          </label>
        ))}
      </div>
    </div>
  );
}
