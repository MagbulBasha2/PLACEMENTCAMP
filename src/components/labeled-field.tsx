import type { ReactNode } from "react";

/**
 * Wraps a form control in a real <label> so the visible text is programmatically
 * associated with the control, without needing to hand-manage ids.
 */
export function LabeledField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium leading-none">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
