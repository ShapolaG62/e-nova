import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, action }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pb-1">
      <div className="min-w-0">
        <h1 className="text-[1.7rem] leading-[1.1] font-bold sm:text-[2.1rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[65ch] text-[0.95rem] leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
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
