import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { LEGAL, contactLine } from "@/lib/legal";
import { PILOT_CREDIT_DAYS, PILOT_PRICE_USD, PILOT_SLA_HOURS } from "@/lib/verityx/constants";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms · VerityX" }] }),
  component: () => <LegalPage title="Terms" sections={SECTIONS} />,
});

const usd = `$${PILOT_PRICE_USD.toLocaleString("en-US")}`;

const SECTIONS: LegalSection[] = [
  ["Who we are", [`${LEGAL.product} is provided by ${LEGAL.entity}, ${LEGAL.entityPlace} (“we”, “us”). These terms apply to a ${LEGAL.product} pilot, to plans, to lot passports and evidence packs, and to use of this website. By paying for a pilot, or by using the site, you (“you”, the customer) agree to them. If a signed order form or agreement between us says something different, that document wins.`]],
  ["The pilot", [
    `A pilot covers one purchase order you choose, in one of: permanent magnets, rare-earth oxides or metals, copper conductor, or electrical steel. We deliver an evidence packet and an advisory decision (proceed, review or hold) within ${PILOT_SLA_HOURS} hours of the later of (a) receiving your purchase order and supporting quotes and (b) receiving payment.`,
    "Scope is confirmed in writing before payment. Extra orders, commodities or meetings are outside the pilot unless we agree otherwise in writing.",
  ]],
  ["Fees and payment", [
    `The fee is ${usd} (US dollars), payable in advance through our payment processor, Stripe, by card or bank transfer. Prices exclude taxes; you pay any sales, use, VAT or similar tax that applies, other than taxes on our income.`,
    `Pilot credit: if you sign a paid plan within ${PILOT_CREDIT_DAYS} days of your pilot's delivery, the pilot fee you paid is deducted from your first year's plan fee. The credit applies once per customer and has no cash value.`,
    `Refunds: if we have not started work, you may cancel within ${LEGAL.refundDays} business days of payment for a full refund. If we miss the ${PILOT_SLA_HOURS}-hour delivery time for reasons within our control, you may choose a full refund or delivery as late as it comes. Otherwise fees are non-refundable.`,
  ]],
  ["Plans", [
    "Plans are listed at /pricing: Supplier (publishing lot passports) and Team, Program or Enterprise (monitoring parts and generating evidence packs). Paid plans are billed yearly in advance, by card or US bank transfer through Stripe, or by invoice under an order form. A plan renews each year until you cancel it in Billing; after cancelling it runs to the end of the paid year. Unused allowances do not carry over. Where an order form differs from these terms, the order form wins.",
    "Free use is limited to the allowances shown on /pricing. If a payment fails, the plan keeps working for 14 days after the end of the paid period, then falls back to the free allowances; nothing you have sealed is deleted.",
  ]],
  ["Lot passports", [
    "A lot passport is its publisher's own declaration of where each restricted processing stage of a lot took place, with SHA-256 fingerprints of evidence documents. The publisher is responsible for its accuracy. VerityX records it unchanged, links it to the passports it names, and reports whether the declared chain is complete and whether any stage is declared in a covered country. VerityX does not audit facilities, does not see the evidence documents themselves, and does not certify compliance with DFARS 252.225-7052 or any other rule. A buyer remains responsible for its own representations to its customers and to the government.",
    "A sealed passport is public to anyone who has its code. Drafts are visible only to the publishing organization. A publisher may revoke a sealed passport with a reason; the revocation is recorded on the ledger and shown to every buyer whose chain uses that lot.",
  ]],
  ["Advisory only", [
    "Every output is advisory. It is not legal, tax, investment, audit or compliance advice, not a finding of fraud or sanctions violation, and not a regulator determination. A person on your side makes every purchasing decision; nothing we do changes your systems.",
    "Supplier screens match names against public registers (GLEIF and the UN Security Council Consolidated List). A name match or non-match is a prompt for your own review, not a conclusion about any company or person.",
  ]],
  ["Price data", [
    "Reference prices come from licensed public sources listed at /sources (World Bank, U.S. Geological Survey, European Central Bank), shown with their period. They are averages, not spot or contract prices.",
    "If you give us a price from your own subscription (for example Argus, Fastmarkets or SMM) or a contract price, you confirm you are allowed to use it for this purpose. We use it only to compute your results and do not redistribute it.",
  ]],
  ["Your data", [
    "You keep all rights in the information you send us (“Customer Data”). You grant us a limited right to use it only to deliver your pilot and support it. We keep it confidential, do not sell it, and do not use it to train any model.",
    "We use the service providers listed in the privacy notice to host and process data. We delete Customer Data within 12 months of delivery unless you ask us to delete it sooner or we agree in writing to keep it longer.",
    "Sealed ledger entries are append-only by design: they hold a fingerprint and a short summary of a decision, not your documents. Ask us before a pilot if no summary may be recorded.",
  ]],
  ["Your deliverables", ["You may use the evidence packet and decision for your internal business purposes and share them with your advisers, auditors and counterparties. We keep ownership of the VerityX software, methods and templates."]],
  ["Confidentiality", ["Each of us keeps the other’s non-public information confidential, uses it only for the pilot, and protects it with at least reasonable care. This does not cover information that is public, already known, independently developed, or that must be disclosed by law (with notice where allowed)."]],
  ["Warranties", [
    "We will perform the pilot with reasonable skill and care. Except for that, the service and all outputs are provided “as is”, without other warranties, express or implied, including merchantability, fitness for a particular purpose and accuracy of third-party data, to the extent the law allows.",
  ]],
  ["Liability", [
    `Neither of us is liable for indirect, incidental, special, consequential or punitive damages, or lost profits or revenue. Each party’s total liability arising from a pilot is limited to the fees paid for that pilot (${usd} for a standard pilot), or for a plan, to the plan fees paid in the 12 months before the claim. These limits do not apply to a party’s breach of confidentiality, your payment obligations, or liability that cannot be limited by law.`,
  ]],
  ["Using the site", ["Do not attempt to break, overload, scrape at scale or misuse the site, its public tools or its ledger, or submit content you have no right to submit. We may suspend access that does."]],
  ["General", [
    `These terms are governed by the laws of ${LEGAL.governingLaw}, and disputes go to ${LEGAL.venue}. If part of these terms is unenforceable, the rest still applies. We may update these terms for future pilots; the version in force when you paid applies to your pilot.`,
    `Contact: ${contactLine()}.`,
  ]],
];
