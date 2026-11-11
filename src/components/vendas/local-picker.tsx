"use client";

import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClass } from "@/components/field";
import { cn } from "@/lib/utils";

export type Local = { pais: string; uf: string; cidade: string };
type Paises = Record<string, { nome: string }>;

const CHAVE = "enova:local";

/** Última escolha salva (país/estado/cidade e, opcionalmente, o ramo). */
export function localSalvo(): Partial<Local> & { setor?: string } {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || "{}");
  } catch {
    return {};
  }
}

export function lembrarLocal(v: Partial<Local> & { setor?: string }) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ...localSalvo(), ...v }));
  } catch {
    /* navegador sem armazenamento */
  }
}

const cacheUfs: { v?: { sigla: string; nome: string }[] } = {};
const cacheCidades = new Map<string, string[]>();

/** País / Estado / Cidade. No Brasil usa os estados e municípios do IBGE. */
export function LocalPicker({
  paises,
  value,
  onChange,
  onRestaurado,
  className,
}: {
  paises: Paises;
  value: Local;
  onChange: (v: Local) => void;
  /** Chamado ao montar com a última escolha salva (inclui o ramo, se houver). */
  onRestaurado?: (salvo: Partial<Local> & { setor?: string }) => void;
  className?: string;
}) {
  const id = useId();
  const br = value.pais === "BR";
  const [ufs, setUfs] = useState<{ sigla: string; nome: string }[] | null>(cacheUfs.v ?? null);
  const [ufsFalhou, setUfsFalhou] = useState(false);

  // Recupera a última escolha (uma vez, ao montar)
  useEffect(() => {
    const s = localSalvo();
    if (s.cidade || s.uf || (s.pais && s.pais !== value.pais)) {
      onChange({ pais: s.pais || value.pais || "BR", uf: s.uf ?? "", cidade: s.cidade ?? "" });
    }
    onRestaurado?.(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!br || ufs) return;
    let vivo = true;
    fetch("/api/vendas/ibge")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { sigla: string; nome: string }[]) => {
        cacheUfs.v = d;
        if (vivo) setUfs(d);
      })
      .catch(() => vivo && setUfsFalhou(true));
    return () => {
      vivo = false;
    };
  }, [br, ufs]);

  const ufValida = br && /^[A-Z]{2}$/.test(value.uf);
  // Cidades por UF (o cache do módulo evita buscar de novo ao trocar de tela)
  const [cidadesPorUf, setCidadesPorUf] = useState<Record<string, string[]>>({});
  const cidades = ufValida ? (cidadesPorUf[value.uf] ?? cacheCidades.get(value.uf) ?? []) : [];
  const carregandoCidades = ufValida && !cidadesPorUf[value.uf] && !cacheCidades.has(value.uf);
  useEffect(() => {
    if (!ufValida || cacheCidades.has(value.uf)) return;
    const uf = value.uf;
    let vivo = true;
    fetch(`/api/vendas/ibge?uf=${uf}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: string[]) => d)
      .catch(() => [] as string[])
      .then((d) => {
        cacheCidades.set(uf, d);
        if (vivo) setCidadesPorUf((x) => ({ ...x, [uf]: d }));
      });
    return () => {
      vivo = false;
    };
  }, [ufValida, value.uf]);

  const mudar = (p: Partial<Local>) => {
    const novo = { ...value, ...p };
    onChange(novo);
    lembrarLocal(novo);
  };

  const usarSelectUf = br && !ufsFalhou;

  return (
    <div className={cn("contents", className)}>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-pais`}>País</Label>
        <select id={`${id}-pais`} className={selectClass} value={value.pais} onChange={(e) => mudar({ pais: e.target.value, uf: "", cidade: "" })}>
          {Object.entries(paises).map(([sigla, p]) => (
            <option key={sigla} value={sigla}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-uf`}>Estado</Label>
        {usarSelectUf ? (
          <select id={`${id}-uf`} className={selectClass} value={value.uf} onChange={(e) => mudar({ uf: e.target.value, cidade: "" })}>
            <option value="">{ufs ? "Escolha o estado" : "Carregando…"}</option>
            {ufs?.map((u) => (
              <option key={u.sigla} value={u.sigla}>
                {u.nome}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id={`${id}-uf`}
            className="h-10 sm:h-9"
            value={value.uf}
            placeholder={br ? "UF (ex.: SP)" : "Estado / província"}
            onChange={(e) => mudar({ uf: br ? e.target.value.toUpperCase().slice(0, 2) : e.target.value })}
          />
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-cidade`}>Cidade</Label>
        <Input
          id={`${id}-cidade`}
          className="h-10 sm:h-9"
          list={cidades.length ? `${id}-cidades` : undefined}
          value={value.cidade}
          disabled={usarSelectUf && !value.uf}
          placeholder={usarSelectUf && !value.uf ? "Escolha o estado primeiro" : carregandoCidades ? "Carregando cidades…" : "Digite a cidade"}
          autoComplete="off"
          onChange={(e) => mudar({ cidade: e.target.value })}
        />
        {cidades.length > 0 && (
          <datalist id={`${id}-cidades`}>
            {cidades.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
      </div>
    </div>
  );
}
