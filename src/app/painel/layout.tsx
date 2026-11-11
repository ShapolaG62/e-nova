import { Suspense } from "react";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { asc } from "drizzle-orm";
import { db, t } from "@/db";
import { requireUser, type SessionUser } from "@/lib/auth/session";
import { can, ROLE_LABEL } from "@/lib/auth/rbac";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { CommandMenu, MobileTabBar, SideNav, SideNavPinned, type NavItem } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme";

function navFor(user: SessionUser): NavItem[] {
  const r = user.role;
  const items: NavItem[] = [{ href: "/painel", label: "Início", icon: "home", group: "Operação", tab: true }];
  const push = (ok: boolean, it: NavItem) => ok && items.push(it);

  push(can(r, "clients:read"), { href: "/painel/clientes", label: "Clientes", icon: "store", group: "Operação", tab: true });
  push(can(r, "inventory:manage"), { href: "/painel/estoque", label: "Plaquinhas", icon: "package", group: "Operação" });
  push(r === "CLIENT" && !!user.clientId, { href: `/painel/clientes/${user.clientId}`, label: "Plaquinhas", icon: "nfc", group: "Operação", tab: true });
  push(can(r, "reviews:read"), { href: "/painel/avaliacoes", label: "Avaliações", icon: "star", group: "Operação", tab: true });
  push(can(r, "monitors:read"), { href: "/painel/monitoramento", label: "Sites", icon: "activity", group: "Operação" });

  push(can(r, "prospects:read"), { href: "/painel/prospeccao", label: "Prospecção", icon: "target", group: "Vendas", tab: true });
  push(can(r, "prospects:read"), { href: "/painel/funil", label: "Funil", icon: "kanban", group: "Vendas" });
  push(can(r, "sites:write"), { href: "/painel/sites", label: "Criador de sites", icon: "globe", group: "Vendas" });
  push(can(r, "prospects:read"), { href: "/painel/abordagem", label: "Abordagem", icon: "message", group: "Vendas" });
  push(can(r, "sites:write"), { href: "/painel/visuais", label: "Visuais", icon: "palette", group: "Vendas" });

  push(can(r, "ai:use"), { href: "/painel/gerador", label: "Gerador de vídeos", icon: "video", group: "Conteúdo" });
  push(can(r, "clips:use"), { href: "/painel/cortes", label: "Cortes virais", icon: "scissors", group: "Conteúdo", tab: true });
  push(can(r, "content:read"), { href: "/painel/conteudo", label: "Publicações", icon: "video", group: "Conteúdo", tab: r === "CLIENT" });
  push(can(r, "pages:read"), { href: "/painel/paginas", label: "Páginas", icon: "page", group: "Conteúdo" });
  push(can(r, "ai:use"), { href: "/painel/ia", label: "Estúdio IA", icon: "sparkles", group: "Conteúdo" });
  push(can(r, "ai:use"), { href: "/painel/estudio", label: "Estúdio de mídia", icon: "wand", group: "Conteúdo" });
  push(can(r, "ai:use"), { href: "/painel/vozes", label: "Minha voz", icon: "mic", group: "Conteúdo" });
  push(can(r, "ai:use"), { href: "/painel/ferramentas", label: "Ferramentas", icon: "package", group: "Conteúdo" });

  push(can(r, "reports:read"), { href: "/painel/relatorios", label: "Relatórios", icon: "report", group: "Gestão" });
  push(can(r, "bi:view"), { href: "/painel/bi", label: "BI", icon: "chart", group: "Gestão" });
  push(can(r, "system:view"), { href: "/painel/ia-central", label: "Central de IA", icon: "bot", group: "Gestão" });
  push(can(r, "ai:use"), { href: "/painel/aprendizado", label: "Aprendizado", icon: "brain", group: "Gestão" });
  push(can(r, "users:manage"), { href: "/painel/usuarios", label: "Usuários", icon: "users", group: "Gestão" });
  push(can(r, "system:view"), { href: "/painel/sistema", label: "Sistema", icon: "cog", group: "Gestão" });
  push(can(r, "system:view"), { href: "/painel/seguranca", label: "Segurança", icon: "shield", group: "Gestão" });
  items.push({ href: "/painel/glossario", label: "Glossário", icon: "book", group: "Gestão" });
  // Fixos no rodapé da barra lateral (e no "Mais" do celular)
  items.push({ href: "/painel/configuracoes", label: "Configurações", icon: "cog", group: "Conta", pinned: true });
  items.push({ href: "/painel/conta", label: "Minha conta", icon: "account", group: "Conta", pinned: true });
  return items;
}

async function Shell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = navFor(user);
  const clients = can(user.role, "clients:read")
    ? await db.select({ id: t.clients.id, name: t.clients.tradeName }).from(t.clients).orderBy(asc(t.clients.tradeName))
    : [];

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)] print:block">
      {/* Desktop: barra lateral escura */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex print:hidden">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Link href="/painel" aria-label="Início" className="rounded-md">
            <Logo inverted />
          </Link>
        </div>
        <div className="px-3 pb-3">
          <CommandMenu items={items} clients={clients} />
        </div>
        <SideNav items={items} />
        <SideNavPinned items={items} />
        <div className="flex items-center gap-3 border-t border-sidebar-border px-4 py-3">
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/15 font-display text-sm font-semibold text-sidebar-primary">
            {user.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{user.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">{ROLE_LABEL[user.role]}</p>
          </div>
          <ThemeToggle className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          <form action={logoutAction}>
            <button
              className="rounded-lg p-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </aside>

      {/* Celular: barra do topo enxuta + abas embaixo */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur-md md:hidden print:hidden">
        <Link href="/painel" aria-label="Início">
          <Logo />
        </Link>
        <div className="flex items-center gap-0.5">
          <CommandMenu items={items} clients={clients} />
          <ThemeToggle className="text-foreground hover:bg-muted" />
          <Link href="/painel/configuracoes" aria-label="Configurações" className="rounded-lg p-2 text-foreground hover:bg-muted">
            <Settings className="size-4" />
          </Link>
        </div>
      </header>

      <main className="pb-tabbar min-w-0 px-4 py-5 md:px-8 md:py-8 lg:px-10 lg:py-9 print:p-0">
        <div className="mx-auto w-full max-w-[90rem]">{children}</div>
      </main>
      <MobileTabBar items={items} />
    </div>
  );
}

export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
          <div className="hidden bg-sidebar md:block" />
          <div className="p-6">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      }
    >
      <Shell>{children}</Shell>
    </Suspense>
  );
}
