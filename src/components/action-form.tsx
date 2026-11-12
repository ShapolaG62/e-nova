"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useSyncExternalStore, startTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/validation";

type Ctx = { state: ActionState; pending: boolean; ready: boolean };
const FormCtx = createContext<Ctx>({ state: {}, pending: false, ready: false });
const noopSubscribe = () => () => {};

/**
 * Form ligado a uma Server Action com useActionState.
 * Usa onSubmit + startTransition em vez de `action=` para o React NÃO limpar
 * os campos quando a validação falha (o usuário não perde o que digitou).
 */
export function ActionForm({
  action,
  children,
  className,
  id,
  resetOnSuccess = false,
}: {
  id?: string;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  // Até hidratar, o botão fica desabilitado: evita envio nativo (que mandaria
  // os campos — inclusive senha — sem passar pela Server Action).
  const ready = useSyncExternalStore(
    noopSubscribe,
    () => true, // cliente hidratado
    () => false, // HTML do servidor
  );

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
    // Confirmação visível em qualquer lugar da tela (o formulário pode estar fora da vista)
    if (state.ok && state.message) toast.success(state.message);
  }, [state, resetOnSuccess]);

  return (
    <FormCtx.Provider value={{ state, pending, ready }}>
      <form
        ref={ref}
        id={id}
        method="post"
        noValidate
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => formAction(data));
        }}
      >
        {children}
      </form>
    </FormCtx.Provider>
  );
}

export function FieldError({ name }: { name: string }) {
  const { state } = useContext(FormCtx);
  const msg = state.errors?.[name]?.[0];
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive">{msg}</p>;
}

export function FormMessage({ className }: { className?: string }) {
  const { state } = useContext(FormCtx);
  // Sucesso vira toast; aqui fica só o erro, perto de onde a pessoa está olhando
  if (!state.message || state.ok) return null;
  return (
    <p
      role="status"
      className={cn(
        "rounded-md px-3 py-2 text-sm",
        state.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-destructive/10 text-destructive",
        className,
      )}
    >
      {state.message}
    </p>
  );
}

export function SubmitButton({ children, className, variant }: { children: React.ReactNode; className?: string; variant?: "default" | "outline" | "secondary" | "destructive" }) {
  const { pending, ready } = useContext(FormCtx);
  return (
    <Button type="submit" disabled={pending || !ready} className={className} variant={variant}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}
