import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, action }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  // Cabeçalho com a foto da área (public/areas/<área>.jpg, escolhida pelo CSS conforme html[data-area]),
  // nome da área em cima, título em serifa editorial e as ações logo abaixo.
  return (
    <header className="cab-area">
      <div className="cab-area-foto" aria-hidden />
      <div className="cab-area-txt">
        <p className="cab-area-rotulo" aria-hidden />
        <h1 className="cab-area-titulo">{title}</h1>
        {subtitle && <p className="cab-area-sub">{subtitle}</p>}
        {action && <div className="cab-area-acoes">{action}</div>}
      </div>
    </header>
  );
}

/** Estado vazio: diz o que fazer em seguida (ícone opcional + texto + ação). */
export function EmptyState({ icon, title, children, action, className }: { icon?: React.ReactNode; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid justify-items-center gap-2 rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center", className)}>
      {icon && <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground [&_svg]:size-5">{icon}</span>}
      {title && <p className="font-display text-base font-semibold">{title}</p>}
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="grid animate-pulse gap-5" aria-busy="true" aria-label="Carregando">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="h-56 rounded-2xl bg-muted" />
    </div>
  );
}
