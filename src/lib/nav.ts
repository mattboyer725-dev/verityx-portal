export type SurfaceTo = "/" | "/check" | "/verify" | "/pricing" | "/core" | "/work" | "/admin";

export type SurfaceLink = {
  to: SurfaceTo;
  label: string;
  hint: string;
  keywords: string;
  exact?: boolean;
};

/** One product. Every chrome — top nav, OS rail, command menu — reads this. */
export const SURFACES: SurfaceLink[] = [
  { to: "/", label: "Hub", hint: "Platform home", keywords: "home start sovereign", exact: true },
  { to: "/check", label: "Check", hint: "Check any quote", keywords: "quote price fair should-cost supplier screen sanctions" },
  { to: "/verify", label: "Verify", hint: "Verify a seal receipt", keywords: "verify receipt proof signature audit ed25519" },
  { to: "/pricing", label: "Pricing", hint: "Pilot and annual plans", keywords: "price plans desk program enterprise" },
  { to: "/core", label: "Core", hint: "HMAC + Merkle doctor", keywords: "ledger merkle hmac continuity local-core" },
  { to: "/work", label: "OS", hint: "Customer Zero workspace", keywords: "pilot prospect report decision audit" },
  { to: "/admin", label: "Command", hint: "Owner console", keywords: "owner seats keys freeze backup" },
];

/** One numbered loop. Hub, Core, and the palette all read this. */
export const LOOP: { n: string; label: string; to: SurfaceTo; hint: string }[] = [
  { n: "01", label: "Check", to: "/check", hint: "A quote" },
  { n: "02", label: "Verify", to: "/verify", hint: "A receipt" },
  { n: "03", label: "OS", to: "/work", hint: "Pilots" },
  { n: "04", label: "Core", to: "/core", hint: "Proof" },
  { n: "05", label: "Command", to: "/admin", hint: "Owner" },
];

export const OS_LINKS: { to: string; label: string; hint: string; keywords: string; exact?: boolean }[] = [
  { to: "/work", label: "Workspace", hint: "File of record", keywords: "dashboard command", exact: true },
  { to: "/work/prospects", label: "Prospects", hint: "VerityX book", keywords: "company outreach book" },
  { to: "/work/pilots", label: "Pilots", hint: "$5,000 / 72-hour loop", keywords: "payment stripe desk packet" },
  { to: "/work/passports", label: "Passports", hint: "Lot provenance, sealed", keywords: "passport lot provenance dfars magnet mine chain" },
  { to: "/work/decisions", label: "Decisions", hint: "Human-approved BLOCK", keywords: "advisory hold monitor" },
  { to: "/work/reports", label: "Reports", hint: "Sealed PDF", keywords: "evidence packet pdf" },
  { to: "/work/learning", label: "Learning", hint: "Closed-loop outcomes", keywords: "outcome follow-up" },
  { to: "/work/audit", label: "Audit", hint: "Tenant append-only log", keywords: "trail" },
  { to: "/work/settings", label: "Settings", hint: "Seats and organisation", keywords: "members role" },
];

export const VX_COMMAND_EVENT = "vx:command";

export function openCommandPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VX_COMMAND_EVENT));
}
