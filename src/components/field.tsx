import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/action-form";
import { cn } from "@/lib/utils";

/** Rótulo + input + erro do campo. Funciona dentro de <ActionForm>. */
export function Field({
  name,
  label,
  hint,
  className,
  children,
  ...input
}: {
  name: string;
  label: string;
  hint?: string;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentProps<"input">, "name">) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      {children ?? <Input id={name} name={name} className="h-10 sm:h-9" {...input} />}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError name={name} />
    </div>
  );
}

export const selectClass =
  "h-10 sm:h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
