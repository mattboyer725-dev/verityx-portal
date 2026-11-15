/**
 * Navigation — one source for the public nav, footer, workspace sidebar and
 * command menu. Every entry points at a page that exists and does what its
 * label says.
 */
export type SurfaceTo = "/" | "/verify" | "/check" | "/pricing" | "/core" | "/work" | "/admin";

export type SurfaceLink = {
  to: SurfaceTo;
  label: string;
  hint: string;
  keywords: string;
  exact?: boolean;
};

/** Public top navigation. Short, plain words. */
export const SURFACES: SurfaceLink[] = [
  { to: "/", label: "Home", hint: "What VerityX does", keywords: "home start", exact: true },
  { to: "/verify", label: "Verify", hint: "Open a passport or check a receipt", keywords: "verify passport code receipt proof seal" },
  { to: "/check", label: "Price check", hint: "Check one quote against reference prices", keywords: "quote price fair should-cost supplier screen sanctions" },
  { to: "/pricing", label: "Pricing", hint: "Free to verify; supplier and buyer plans", keywords: "price plans supplier team program enterprise" },
];

/** Footer columns. */
export const FOOTER_GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/verify", label: "Verify a passport" },
      { href: "/check", label: "Price check" },
      { href: "/pricing", label: "Pricing" },
      { href: "/pilot", label: "Request a pilot" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/core", label: "Ledger status" },
      { href: "/sources", label: "Sources & licences" },
      { href: "/health/live", label: "Service health" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

export type WorkLink = { to: string; label: string; hint: string; keywords: string; exact?: boolean };
export type WorkGroup = { title: string | null; links: WorkLink[]; ownerOnly?: boolean };

/** Workspace sidebar. Sales and Owner groups are shown only to the platform owner. */
export const WORK_GROUPS: WorkGroup[] = [
  {
    title: null,
    links: [{ to: "/work", label: "Overview", hint: "Alerts, coverage and plan at a glance", keywords: "home dashboard overview", exact: true }],
  },
  {
    title: "Provenance",
    links: [
      { to: "/work/portfolio", label: "Portfolio", hint: "Your parts, their chains, evidence packs", keywords: "portfolio parts bom coverage evidence pack contracting officer dfars alerts" },
      { to: "/work/passports", label: "Passports", hint: "Publish sealed lot passports", keywords: "passport lot provenance dfars magnet mine chain publish seal" },
    ],
  },
  {
    title: "Account",
    links: [
      { to: "/work/billing", label: "Billing", hint: "Plan, usage, invoices", keywords: "billing plan subscription upgrade invoice usage" },
      { to: "/work/audit", label: "Activity", hint: "Everything your team did, in order", keywords: "audit trail log activity" },
      { to: "/work/settings", label: "Team", hint: "Members and roles", keywords: "members role seats settings team" },
    ],
  },
  {
    title: "Sales",
    ownerOnly: true,
    links: [
      { to: "/work/sales", label: "Pipeline", hint: "Prospects, pilots and revenue", keywords: "sales pipeline revenue dashboard", exact: true },
      { to: "/work/prospects", label: "Prospects", hint: "Companies to contact", keywords: "company outreach book prospects" },
      { to: "/work/pilots", label: "Pilots", hint: "Paid price-check pilots", keywords: "pilot payment stripe" },
      { to: "/work/decisions", label: "Decisions", hint: "Human-approved advisory calls", keywords: "advisory hold block decision" },
      { to: "/work/reports", label: "Reports", hint: "Sealed PDF reports", keywords: "evidence packet pdf report" },
      { to: "/work/learning", label: "Learning", hint: "Outcomes after delivery", keywords: "outcome follow-up learning" },
    ],
  },
  {
    title: "Owner",
    ownerOnly: true,
    links: [{ to: "/admin", label: "Command", hint: "Owner console", keywords: "owner seats keys freeze backup command" }],
  },
];

export function workGroupsFor(showOwnerTools: boolean): WorkGroup[] {
  return WORK_GROUPS.filter((g) => !g.ownerOnly || showOwnerTools);
}

/** Flat list of workspace links (command menu). */
export const OS_LINKS: WorkLink[] = WORK_GROUPS.flatMap((g) => g.links);

/** The three ways in, used on the home page and the 404 page. */
export const LOOP: { n: string; label: string; to: SurfaceTo; hint: string }[] = [
  { n: "01", label: "Verify", to: "/verify", hint: "Open a passport" },
  { n: "02", label: "Pricing", to: "/pricing", hint: "Publish or monitor" },
  { n: "03", label: "Workspace", to: "/work", hint: "Your parts and lots" },
];

export const VX_COMMAND_EVENT = "vx:command";

export function openCommandPalette() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VX_COMMAND_EVENT));
}
