"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Atualiza a página a cada N segundos enquanto algo está processando no worker. */
export function AutoRefresh({ every = 4 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), every * 1000);
    return () => clearInterval(id);
  }, [router, every]);
  return null;
}
