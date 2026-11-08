/**
 * PILOT REQUEST — a buyer asking for a $2,500 / 72-hour pilot from the public
 * site. Pure validation, shared by the form and the server.
 *
 * Abuse controls: a honeypot field real people never see (filled = a bot,
 * silently accepted and dropped), length caps, no control characters, and a
 * per-address hourly cap enforced in the database by the server.
 */
export const COMMODITIES = ["NdFeB magnets", "NdPr / Dy oxide or metal", "Copper conductor", "Electrical steel", "Other"] as const;
export const PO_BANDS = ["Under $100k", "$100k – $1M", "$1M – $10M", "Over $10M"] as const;

export type PilotRequest = {
  name: string;
  email: string;
  company: string;
  role: string;
  commodity: (typeof COMMODITIES)[number];
  poBand: (typeof PO_BANDS)[number];
  message: string;
};

export type ParsedRequest = { ok: true; value: PilotRequest; bot: boolean } | { ok: false; error: string };

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const hasControl = (s: string) => [...s].some((ch) => {
  const c = ch.charCodeAt(0);
  return c < 0x20 && ch !== "\n" && ch !== "\t";
});

export function parsePilotRequest(raw: unknown): ParsedRequest {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bot = clean(o.website).length > 0; // honeypot
  const field = (k: string, min: number, max: number, label: string) => {
    const v = clean(o[k]);
    if (v.length < min) throw new Error(`${label} is required`);
    if (v.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
    if (hasControl(v)) throw new Error(`${label} contains characters that are not allowed`);
    return v;
  };
  try {
    const email = field("email", 1, 160, "Work email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("Enter a valid work email");
    const commodity = clean(o.commodity) as PilotRequest["commodity"];
    if (!COMMODITIES.includes(commodity)) throw new Error("Choose what you are buying");
    const poBand = clean(o.poBand) as PilotRequest["poBand"];
    if (!PO_BANDS.includes(poBand)) throw new Error("Choose the order size");
    return {
      ok: true,
      bot,
      value: {
        name: field("name", 2, 120, "Name"),
        email,
        company: field("company", 2, 160, "Company"),
        role: field("role", 0, 120, "Role"),
        commodity,
        poBand,
        message: field("message", 0, 2000, "Message"),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid request" };
  }
}

/** The prospect note written into the owner's pipeline. */
export function prospectNote(r: PilotRequest, requestId: string): string {
  return [
    `Pilot request ${requestId} from the website.`,
    `${r.name}${r.role ? `, ${r.role}` : ""} · ${r.email}`,
    `Buying: ${r.commodity} · order size ${r.poBand}`,
    r.message ? `Message: ${r.message}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
}
