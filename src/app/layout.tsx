import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Oswald } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme";
import "./globals.css";

// Visual Brasa: títulos e números em Oswald (condensada), interface em Inter (legível em telas pequenas).
const display = Oswald({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });
const body = Inter({ variable: "--font-body", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "E-Nova", template: "%s · E-Nova" },
  description: "Plaquinhas de avaliação, conteúdo, sites e relatórios para comércios locais.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0c0c0d" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: o next-themes coloca a classe do tema antes do React carregar
    <html lang="pt-BR" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <ThemeProvider>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
