"use client";

import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tema claro/escuro (classe .dark no <html>, salvo no navegador). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // escuro Brasa é o padrão da equipe; as páginas públicas dos clientes ficam claras via .marca-enova (globals.css)
  return (
    <NextThemes attribute="class" defaultTheme="dark" enableSystem={false} storageKey="enova-tema-brasa" disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}

/**
 * Botão de alternar tema. Os dois ícones são renderizados e o CSS escolhe qual mostrar,
 * assim o HTML do servidor bate com o do navegador.
 */
export function ThemeToggle({ className, comTexto }: { className?: string; comTexto?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn("inline-flex items-center gap-2 rounded-lg p-2 text-sm transition-colors", className)}
      aria-label="Alternar tema claro ou escuro"
      title="Alternar tema claro ou escuro"
    >
      <Sun className="hidden size-4 dark:block" aria-hidden />
      <Moon className="size-4 dark:hidden" aria-hidden />
      {comTexto && (
        <>
          <span className="dark:hidden">Tema escuro</span>
          <span className="hidden dark:inline">Tema claro</span>
        </>
      )}
    </button>
  );
}
