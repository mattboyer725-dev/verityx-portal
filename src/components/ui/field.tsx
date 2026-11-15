import { cloneElement, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Label({
  children,
  className,
  htmlFor,
}: {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 block text-xs font-medium tracking-wide text-mute", className)}>
      {children}
    </label>
  );
}

const control =
  "h-11 w-full rounded-[8px] border border-line bg-ink px-3 text-sm text-paper placeholder:text-mute/80 focus:border-gold/40 focus:outline-none focus:ring-2 focus:ring-gold/20";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "h-28 resize-y py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, className)} {...props}>
      {children}
    </select>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  // Tie the label (and hint) to a single control so screen readers announce them.
  const auto = useId();
  const hintId = `${auto}-hint`;
  let control = children;
  let controlId: string | undefined;
  if (isValidElement(children)) {
    const el = children as ReactElement<{ id?: string; "aria-describedby"?: string }>;
    controlId = el.props.id ?? auto;
    control = cloneElement(el, {
      id: controlId,
      ...(hint ? { "aria-describedby": [el.props["aria-describedby"], hintId].filter(Boolean).join(" ") } : {}),
    });
  }
  return (
    <div>
      <Label htmlFor={controlId}>{label}</Label>
      {control}
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-mute">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
