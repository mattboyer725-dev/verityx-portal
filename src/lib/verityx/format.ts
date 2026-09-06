export function iso(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return String(value);
}

export function isoOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = iso(value);
  return s || null;
}

export function money(usd: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(usd);
}

export function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatWhenPrecise(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(minutes, 1)}m`;
}

export function slaState(inputsReceivedAt: string | null, slaHours: number) {
  if (!inputsReceivedAt) {
    return {
      label: "Clock starts when required inputs land",
      overdue: false,
      remainingMs: null as number | null,
      deadline: null as string | null,
    };
  }
  const start = new Date(inputsReceivedAt).getTime();
  const deadlineMs = start + slaHours * 3_600_000;
  const remaining = deadlineMs - Date.now();
  const deadline = new Date(deadlineMs).toISOString();
  if (remaining <= 0) {
    return {
      label: `${formatDuration(remaining)} past the ${slaHours}h target`,
      overdue: true,
      remainingMs: remaining,
      deadline,
    };
  }
  return {
    label: `${formatDuration(remaining)} remaining on the ${slaHours}h clock`,
    overdue: false,
    remainingMs: remaining,
    deadline,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** In-app paths the sign-in return is allowed to land on. Default is the hub. */
export type AppReturnPath = "/" | "/work" | "/admin" | "/desk" | "/core";

export function safeAppPath(raw: string | null | undefined): AppReturnPath {
  const v = (raw ?? "").trim();
  if (v === "/work" || v.startsWith("/work/")) return "/work";
  if (v === "/admin" || v.startsWith("/admin/")) return "/admin";
  if (v === "/desk" || v.startsWith("/desk/")) return "/desk";
  if (v === "/core" || v.startsWith("/core/")) return "/core";
  return "/";
}

export function slugify(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "org";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function asBoolean(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}
