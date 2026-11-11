import { redirect } from "next/navigation";

/** A antiga tela "Vendas e IA" virou parte de Configurações (as chaves de IA ficam na Central de IA). */
export default function Page() {
  redirect("/painel/configuracoes");
}
