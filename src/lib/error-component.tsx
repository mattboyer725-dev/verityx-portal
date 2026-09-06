import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ink px-6 text-center text-paper">
      <span className="text-warn" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-2xl tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-mute">
        {error.message || "An unexpected error occurred. Try reloading the page."}
      </p>
      <a href="/" className="mt-4 text-sm text-mist hover:text-paper">
        Back to the platform hub →
      </a>
    </main>
  );
}
