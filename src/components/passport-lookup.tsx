import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Search } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { normalizePassportCode } from "@/lib/provenance/passport";

export { normalizePassportCode };
import { cn } from "@/lib/cn";

export function PassportLookup({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const navigate = useNavigate();
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const code = normalizePassportCode(value);
    if (!code) {
      setError("That doesn't look like a passport code. They look like LP-7K2M-9Q4R.");
      return;
    }
    setError(null);
    void navigate({ to: "/passport/$code", params: { code } });
  }

  const tall = size === "lg" ? "h-14 text-base" : "h-12 text-sm";
  return (
    <form onSubmit={submit} className={cn("w-full max-w-xl", className)} noValidate>
      <label htmlFor={id} className="sr-only">
        Lot passport code
      </label>
      <div className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mute" aria-hidden />
          <input
            id={id}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="LP-7K2M-9Q4R"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-err` : undefined}
            className={cn(
              "w-full rounded-full border border-line bg-ink/60 pl-11 pr-4 font-mono tracking-wide text-paper placeholder:text-mute/60 focus:border-gold/60 focus:outline-none",
              tall,
            )}
          />
        </div>
        <button
          type="submit"
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-full bg-gold px-5 font-medium text-plum transition-opacity hover:opacity-90",
            tall,
          )}
        >
          Verify
          <ArrowRight className="size-4" />
        </button>
      </div>
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-2 pl-4 text-sm text-bad">
          {error}
        </p>
      ) : null}
    </form>
  );
}
