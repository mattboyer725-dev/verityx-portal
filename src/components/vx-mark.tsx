import { cn } from "@/lib/cn";

/** VerityX mark: a neodymium-violet tile, a V cut like a stamped nameplate, and one foil seal point where the chain closes. */
export function VxMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      className={cn("vx-mark", className)}
      viewBox="0 0 64 64"
      fill="none"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect x="1" y="1" width="62" height="62" rx="5" fill="var(--color-gold, #5440B8)" />
      <path d="M15 16 L32 48 L49 16" stroke="#FFFFFF" strokeWidth="7" strokeLinejoin="miter" strokeLinecap="square" />
      <rect x="27" y="43" width="10" height="10" transform="rotate(45 32 48)" fill="var(--color-seal, #D9A621)" />
    </svg>
  );
}

export function VxWordmark({
  name = "VerityX",
  className,
  markClassName,
}: {
  name?: string;
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("vx-wordmark", className)}>
      <VxMark className={markClassName} title={name} />
      <span className="vx-wordmark-name">{name}</span>
    </span>
  );
}
