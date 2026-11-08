/**
 * Legal facts used by /terms, /privacy and checkout. One place to change.
 * DRAFT until the owner's legal reviewer approves; bump VERSION and
 * EFFECTIVE on every change (a buyer's receipt records the version).
 */
export const LEGAL = {
  entity: "Aequitas Core LLC",
  entityPlace: "Stamford, Connecticut, USA",
  product: "VerityX",
  governingLaw: "the State of Connecticut, USA",
  venue: "the state and federal courts located in Fairfield County, Connecticut",
  version: "2026-11-08",
  effective: "2026-11-08",
  /** Public contact address. Empty until a business inbox exists; pages then point to the request form. */
  supportEmail: (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined)?.trim() || "",
  refundDays: 5,
} as const;

export function contactLine(): string {
  return LEGAL.supportEmail ? LEGAL.supportEmail : "the contact form at /pilot, or by replying to any email from us";
}
