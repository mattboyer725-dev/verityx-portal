import { cn } from "@/lib/cn";

/** VerityX seal: a gold V held inside circle, hexagon, and hexagram. */
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
      <circle cx="32" cy="32" r="31.2" fill="var(--color-plum, #120C1A)" />
      <circle
        cx="32"
        cy="32"
        r="28.6"
        stroke="var(--color-violet, #6E5A8A)"
        strokeWidth="0.9"
        opacity="0.9"
      />
      <polygon
        points="32.00,6.00 54.52,19.00 54.52,45.00 32.00,58.00 9.48,45.00 9.48,19.00"
        stroke="var(--color-gold, #C9B07A)"
        strokeWidth="0.7"
        opacity="0.55"
      />
      <polygon
        points="32.00,12.00 49.32,42.00 14.68,42.00"
        stroke="var(--color-violet, #6E5A8A)"
        strokeWidth="0.7"
        opacity="0.7"
      />
      <circle cx="32" cy="32" r="9.2" stroke="var(--color-gold, #C9B07A)" strokeWidth="0.6" opacity="0.4" />
      <path
        d="M49.32 22 L32 52 L14.68 22"
        stroke="var(--color-gold, #C9B07A)"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="6" r="1.05" fill="var(--color-gold, #C9B07A)" opacity="0.8" />
      <circle cx="54.52" cy="19" r="1.05" fill="var(--color-gold, #C9B07A)" opacity="0.55" />
      <circle cx="54.52" cy="45" r="1.05" fill="var(--color-gold, #C9B07A)" opacity="0.55" />
      <circle cx="32" cy="58" r="1.05" fill="var(--color-gold, #C9B07A)" opacity="0.8" />
      <circle cx="9.48" cy="45" r="1.05" fill="var(--color-gold, #C9B07A)" opacity="0.55" />
      <circle cx="9.48" cy="19" r="1.05" fill="var(--color-gold, #C9B07A)" opacity="0.55" />
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
