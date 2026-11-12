"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  ChevronDown,
  Clapperboard,
  FileText,
  Globe,
  KeyRound,
  Home,
  LayoutTemplate,
  Menu,
  MessageSquareText,
  Mic,
  Nfc,
  Package,
  Palette,
  Repeat2,
  Scissors,
  Search,
  SquareKanban,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Target,
  UserCog,
  Users,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const ICONS = {
  home: Home,
  store: Store,
  nfc: Nfc,
  users: Users,
  star: Star,
  sparkles: Sparkles,
  video: Clapperboard,
  scissors: Scissors,
  repost: Repeat2,
  activity: Activity,
  report: FileText,
  chart: BarChart3,
  cog: Settings,
  package: Package,
  page: LayoutTemplate,
  book: BookOpen,
  shield: ShieldCheck,
  account: UserCog,
  target: Target,
  kanban: SquareKanban,
  globe: Globe,
  message: MessageSquareText,
  mic: Mic,
  palette: Palette,
  key: KeyRound,
  bot: Bot,
  brain: Brain,
  wand: Wand2,
};

/** pinned = fica fixo no rodapé da barra lateral (ex.: Configurações), fora dos grupos. */
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; group: string; tab?: boolean; pinned?: boolean };

// Grupos recolhidos da barra lateral, lembrados no navegador
const CHAVE_FECHADOS = "enova:nav-fechados";
const ouvintes = new Set<() => void>();
function lerFechados() {
  try {
    return localStorage.getItem(CHAVE_FECHADOS) ?? "";
  } catch {
    return "";
  }
}
function assinarFechados(cb: () => void) {
  ouvintes.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    ouvintes.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function gravarFechados(v: string) {
  try {
    localStorage.setItem(CHAVE_FECHADOS, v);
  } catch {
    /* sem armazenamento */
  }
  ouvintes.forEach((f) => f());
}

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/painel" ? path === href : path === href || path.startsWith(href + "/"));
}

function SideLink({ it, active }: { it: NavItem; active: boolean }) {
  const Icon = ICONS[it.icon];
  return (
    <Link
      href={it.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/link relative flex items-center gap-2.5 rounded-lg px-3 py-[0.45rem] text-[0.875rem] transition-colors",
        active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      {active && <span className="absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r-full bg-sidebar-primary" aria-hidden />}
      <Icon className={cn("size-4 shrink-0 transition-colors", active ? "text-sidebar-primary" : "opacity-70 group-hover/link:opacity-100")} />
      <span className="truncate">{it.label}</span>
    </Link>
  );
}

/** Barra lateral (desktop): grupos por área de trabalho, recolhíveis. O grupo da tela atual fica sempre aberto. */
export function SideNav({ items }: { items: NavItem[] }) {
  const isActive = useActive();
  const lista = items.filter((i) => !i.pinned);
  const groups = [...new Set(lista.map((i) => i.group))];
  const raw = useSyncExternalStore(assinarFechados, lerFechados, () => "");
  const fechados = new Set(raw.split("|").filter(Boolean));
  const alternar = (g: string) => {
    const n = new Set(fechados);
    if (n.has(g)) n.delete(g);
    else n.add(g);
    gravarFechados([...n].join("|"));
  };
  return (
    <nav aria-label="Áreas do painel" className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-4 [scrollbar-width:thin]">
      {groups.map((g) => {
        const doGrupo = lista.filter((i) => i.group === g);
        const temAtivo = doGrupo.some((i) => isActive(i.href));
        const aberto = temAtivo || !fechados.has(g);
        const id = `grupo-${g.normalize("NFD").replace(/W/g, "").toLowerCase()}`;
        return (
          <div key={g}>
            <button
              type="button"
              onClick={() => alternar(g)}
              disabled={temAtivo}
              aria-expanded={aberto}
              aria-controls={id}
              className="group/g flex w-full items-center justify-between rounded-md px-3 py-1 text-[0.68rem] font-semibold tracking-[0.14em] uppercase text-sidebar-foreground/45 transition-colors hover:text-sidebar-foreground/80 disabled:cursor-default disabled:hover:text-sidebar-foreground/45"
            >
              {g}
              {!temAtivo && <ChevronDown className={cn("size-3.5 transition-transform", !aberto && "-rotate-90")} aria-hidden />}
            </button>
            {aberto && (
              <ul id={id} className="mt-0.5 grid gap-px">
                {doGrupo.map((it) => (
                  <li key={it.href}>
                    <SideLink it={it} active={isActive(it.href)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Itens fixos no rodapé da barra lateral (Configurações, Minha conta). */
export function SideNavPinned({ items }: { items: NavItem[] }) {
  const isActive = useActive();
  const fixos = items.filter((i) => i.pinned);
  if (!fixos.length) return null;
  return (
    <ul className="grid gap-px border-t border-sidebar-border px-3 py-2.5">
      {fixos.map((it) => (
        <li key={it.href}>
          <SideLink it={it} active={isActive(it.href)} />
        </li>
      ))}
    </ul>
  );
}

/** Abas inferiores (celular): 4 atalhos + "Mais" abrindo a gaveta com o resto. */
export function MobileTabBar({ items }: { items: NavItem[] }) {
  const isActive = useActive();
  const [open, setOpen] = useState(false);
  const tabs = items.filter((i) => i.tab).slice(0, 4);
  const pathname = usePathname();
  // Fecha a gaveta ao navegar (ajuste de estado durante a renderização, sem efeito)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
        aria-label="Navegação principal"
      >
        <ul className="grid grid-cols-5">
          {tabs.map((it) => {
            const Icon = ICONS[it.icon];
            const active = isActive(it.href);
            return (
              <li key={it.href}>
                <Link href={it.href} aria-current={active ? "page" : undefined} className="flex flex-col items-center gap-1 px-1 pt-2.5 pb-2">
                  <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-accent")}>
                    <Icon className={cn("size-[1.15rem]", active ? "text-primary" : "text-muted-foreground")} />
                  </span>
                  <span className={cn("max-w-full truncate text-[0.68rem]", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{it.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setOpen(true)} className="flex w-full flex-col items-center gap-1 px-1 pt-2.5 pb-2">
              <span className="flex h-7 w-12 items-center justify-center rounded-full">
                <Menu className="size-[1.15rem] text-muted-foreground" />
              </span>
              <span className="text-[0.68rem] text-muted-foreground">Mais</span>
            </button>
          </li>
        </ul>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl px-2 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetTitle className="px-4 pt-1 font-display text-lg">Todas as áreas</SheetTitle>
          <div className="overflow-y-auto">
            {[...new Set(items.map((i) => i.group))].map((g) => (
              <div key={g} className="px-2 pb-3">
                <p className="px-2 pb-1 text-xs text-muted-foreground">{g}</p>
                <ul className="grid grid-cols-3 gap-1.5">
                  {items
                    .filter((i) => i.group === g)
                    .map((it) => {
                      const Icon = ICONS[it.icon];
                      const active = isActive(it.href);
                      return (
                        <li key={it.href}>
                          <Link
                            href={it.href}
                            className={cn(
                              "flex h-full flex-col items-center gap-1.5 rounded-xl border px-1 py-3 text-center text-xs",
                              active ? "border-primary bg-accent font-medium" : "bg-card",
                            )}
                          >
                            <Icon className={cn("size-5", active ? "text-primary" : "text-foreground/80")} />
                            {it.label}
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Busca rápida (Ctrl+K / ⌘K): pula para qualquer tela ou cliente. */
export function CommandMenu({ items, clients }: { items: NavItem[]; clients: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-3 py-2 text-left text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground max-md:w-auto max-md:border-transparent max-md:bg-transparent max-md:p-2 max-md:text-foreground max-md:hover:bg-muted"
        aria-label="Buscar"
      >
        <Search className="size-4" />
        <span className="flex-1 max-md:hidden">Buscar…</span>
        <kbd className="rounded border border-sidebar-border px-1.5 font-sans text-[0.7rem] max-md:hidden">Ctrl K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Buscar" description="Telas e clientes">
        <CommandInput placeholder="Ir para tela ou cliente…" />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          <CommandGroup heading="Telas">
            {items.map((it) => {
              const Icon = ICONS[it.icon];
              return (
                <CommandItem key={it.href} value={`tela ${it.label}`} onSelect={() => go(it.href)}>
                  <Icon /> {it.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
          {clients.length > 0 && (
            <CommandGroup heading="Clientes">
              {clients.map((c) => (
                <CommandItem key={c.id} value={`cliente ${c.name}`} onSelect={() => go(`/painel/clientes/${c.id}`)}>
                  <Store /> {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
