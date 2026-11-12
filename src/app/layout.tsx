import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Onest, Schibsted_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme";
import "./globals.css";

// Visual "Mesa de edição": títulos e números em Schibsted Grotesk (editorial, com personalidade),
// interface em Onest (lê muito bem em português e em telas pequenas).
const display = Schibsted_Grotesk({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const body = Onest({ variable: "--font-body", subsets: ["latin"] });
// Títulos das páginas (cabeçalho com foto): serifa editorial, com itálico para o destaque.
const editorial = Fraunces({ variable: "--font-editorial", subsets: ["latin"], weight: ["300", "400", "500"], style: ["normal", "italic"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "E-Nova", template: "%s · E-Nova" },
  description: "Plaquinhas de avaliação, conteúdo, sites e relatórios para comércios locais.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#121a2b" },
    { media: "(prefers-color-scheme: dark)", color: "#121a2b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: o next-themes coloca a classe do tema antes do React carregar
    <html lang="pt-BR" suppressHydrationWarning className={`${display.variable} ${editorial.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <ThemeProvider>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
