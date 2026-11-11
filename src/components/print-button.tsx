"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()} className="h-10 sm:h-9 print:hidden">
      <Printer /> Imprimir / salvar PDF
    </Button>
  );
}
