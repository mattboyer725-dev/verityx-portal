import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker ? (
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-mute">{kicker}</p>
        ) : null}
        <h1 className="font-display text-3xl font-medium tracking-tight text-paper sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel px-6 py-12 text-center">
      <h2 className="font-display text-2xl text-paper">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-mute">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-[12px] border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad" role="alert">
      {message}
    </p>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-[12px] bg-raised ${className ?? "h-24"}`} />;
}
