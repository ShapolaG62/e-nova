import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Building2, ChevronRight, Globe, MapPin, Server, ShieldCheck, UserCog, Users, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { env } from "@/lib/env";
import { getSetting } from "@/lib/settings";
import { activeAi } from "@/lib/ai/client";
import { statusGoogle, vendasConfig } from "@/lib/sites/config";
import { PageHeader, PageSkeleton } from "@/components/page";
import { StatusGoogle } from "@/components/google-conexao";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmpresaSecao, GoogleSecao, UrlSitesSecao } from "./secoes";

export const metadata: Metadata = { title: "Configurações" };

export default function Page() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader title="Configurações" subtitle="Conexões, dados da sua empresa e como os sites vão para o ar. Tudo num lugar só." />
      <Suspense fallback={<PageSkeleton />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

function Secao({ id, icone: Icone, titulo, descricao, status, children }: { id: string; icone: LucideIcon; titulo: string; descricao: string; status?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-20 rounded-2xl border bg-card shadow-xs">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Icone className="size-[1.1rem]" />
          </span>
          <div className="min-w-0">
            <h2 id={`${id}-t`} className="text-lg leading-tight font-semibold">
              {titulo}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>
          </div>
        </div>
        {status}
      </header>
      <div className="px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}

const ATALHOS: { href: string; titulo: string; desc: string; icone: LucideIcon; perm?: "system:view" | "users:manage" }[] = [
  { href: "/painel/sistema", titulo: "Sistema", desc: "Servidor, fila de tarefas e IA local", icone: Server, perm: "system:view" },
  { href: "/painel/seguranca", titulo: "Segurança", desc: "Acessos, auditoria e verificação", icone: ShieldCheck, perm: "system:view" },
  { href: "/painel/usuarios", titulo: "Usuários", desc: "Sócios, equipe e clientes", icone: Users, perm: "users:manage" },
  { href: "/painel/conta", titulo: "Minha conta", desc: "Senha e verificação em duas etapas", icone: UserCog },
];

function Atalhos({ itens }: { itens: typeof ATALHOS }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {itens.map((a) => (
        <li key={a.href}>
          <Link href={a.href} className="group flex h-full items-center gap-3 rounded-2xl border bg-card px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-accent/40">
            <a.icone className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{a.titulo}</span>
              <span className="block truncate text-xs text-muted-foreground">{a.desc}</span>
            </span>
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Conteudo() {
  const user = await requireUser();
  const atalhos = ATALHOS.filter((a) => !a.perm || can(user.role, a.perm));

  if (!can(user.role, "system:view")) {
    return (
      <div className="grid max-w-xl gap-3">
        <p className="text-sm text-muted-foreground">As conexões e chaves do sistema são cuidadas pelos sócios. Aqui você ajusta a sua conta.</p>
        <Atalhos itens={atalhos} />
      </div>
    );
  }

  const [google, ia, cfg, urlSites] = await Promise.all([statusGoogle(), activeAi(), vendasConfig(), getSetting<string>("vendas.urlSites", "")]);
  const secoes = [
    ["google", "Prospecção (Google Maps)"],
    ["ia", "Inteligência artificial"],
    ["empresa", "Sua empresa e abordagem"],
    ["sites", "Publicação dos sites"],
    ["atalhos", "Outras configurações"],
  ] as const;

  return (
    <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start xl:gap-10">
      <nav aria-label="Seções" className="hidden lg:sticky lg:top-8 lg:block">
        <ul className="grid gap-0.5 border-l text-sm">
          {secoes.map(([id, nome]) => (
            <li key={id}>
              <a href={`#${id}`} className="-ml-px block border-l-2 border-transparent py-1.5 pl-3.5 text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                {nome}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid max-w-3xl min-w-0 gap-5">
        <Secao
          id="google"
          icone={MapPin}
          titulo="Prospecção (Google Maps)"
          descricao="Chave da Places API para buscar empresas reais na tela de Prospecção."
          status={<StatusGoogle estado={google.estado} quando={google.teste?.quando} />}
        >
          <GoogleSecao
            key={`${google.estado}-${google.final}`}
            estado={google.estado}
            final={google.final}
            erroSalvo={google.teste && !google.teste.ok ? (google.teste.titulo ?? "o Google recusou a chave") : null}
            daVariavel={google.daVariavel}
          />
        </Secao>

        <Secao id="ia" icone={Bot} titulo="Inteligência artificial" descricao="Textos, roteiros, respostas a avaliações e imagens.">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="grid gap-1 text-sm">
              <p className="text-muted-foreground">Quem responde primeiro agora</p>
              <p className="flex flex-wrap items-baseline gap-x-2 font-display text-xl font-semibold">
                {ia.nome}
                {ia.model && <span className="font-mono text-xs font-normal text-muted-foreground">{ia.model}</span>}
              </p>
              <p className="text-muted-foreground">
                {ia.rapida
                  ? "Serviço na nuvem: respostas em poucos segundos. Se falhar, a próxima IA configurada assume sozinha."
                  : "Roda no seu computador: grátis, porém mais lenta. Cadastre uma chave na Central de IA para respostas rápidas."}
              </p>
            </div>
            <Link href="/painel/ia-central" className={cn(buttonVariants(), "h-10 px-4")}>
              <Bot /> Abrir a Central de IA
            </Link>
          </div>
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">Todas as chaves de IA (Gemini, OpenAI e outras) e a ordem de preferência ficam na Central de IA.</p>
        </Secao>

        <Secao id="empresa" icone={Building2} titulo="Sua empresa e abordagem" descricao="Usado nas mensagens de WhatsApp, roteiros de ligação e na meta do Funil.">
          <EmpresaSecao key={JSON.stringify(cfg)} inicial={{ seuNome: cfg.seuNome, suaEmpresa: cfg.suaEmpresa, metaDiaria: cfg.metaDiaria, objetivo: cfg.objetivo }} />
        </Secao>

        <Secao id="sites" icone={Globe} titulo="Publicação dos sites" descricao="O endereço dos sites que você cria e envia para os clientes.">
          <UrlSitesSecao key={urlSites} inicial={urlSites} appUrl={env.APP_URL.replace(/\/+$/, "")} />
        </Secao>

        <section id="atalhos" aria-labelledby="atalhos-t" className="grid scroll-mt-20 gap-3 pt-2">
          <h2 id="atalhos-t" className="text-lg font-semibold">
            Outras configurações
          </h2>
          <Atalhos itens={atalhos} />
        </section>
      </div>
    </div>
  );
}
