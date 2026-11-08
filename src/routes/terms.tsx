import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { LEGAL, contactLine } from "@/lib/legal";
import { PILOT_PRICE_USD, PILOT_SLA_HOURS } from "@/lib/verityx/constants";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Pilot terms · VerityX" }] }),
  component: () => <LegalPage title="Pilot terms" sections={SECTIONS} />,
});

const usd = `$${PILOT_PRICE_USD.toLocaleString("en-US")}`;

const SECTIONS: LegalSection[] = [
  ["Who we are", [`${LEGAL.product} is provided by ${LEGAL.entity}, ${LEGAL.entityPlace} (“we”, “us”). These terms apply to a ${LEGAL.product} pilot and to use of this website. By paying for a pilot, or by using the site, you (“you”, the customer) agree to them. If a signed order form or agreement between us says something different, that document wins.`]],
  ["The pilot", [
    `A pilot covers one purchase order you choose, in one of: permanent magnets, rare-earth oxides or metals, copper conductor, or electrical steel. We deliver an evidence packet and an advisory decision (proceed, review or hold) within ${PILOT_SLA_HOURS} hours of the later of (a) receiving your purchase order and supporting quotes and (b) receiving payment.`,
    "Scope is confirmed in writing before payment. Extra orders, commodities or meetings are outside the pilot unless we agree otherwise in writing.",
  ]],
  ["Fees and payment", [
    `The fee is ${usd} (US dollars), payable in advance through our payment processor, Stripe, by card or bank transfer. Prices exclude taxes; you pay any sales, use, VAT or similar tax that applies, other than taxes on our income.`,
    `Refunds: if we have not started work, you may cancel within ${LEGAL.refundDays} business days of payment for a full refund. If we miss the ${PILOT_SLA_HOURS}-hour delivery time for reasons within our control, you may choose a full refund or delivery as late as it comes. Otherwise fees are non-refundable.`,
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
    `Neither of us is liable for indirect, incidental, special, consequential or punitive damages, or lost profits or revenue. Each party’s total liability arising from a pilot is limited to the fees paid for that pilot (${usd} for a standard pilot). These limits do not apply to a party’s breach of confidentiality, your payment obligations, or liability that cannot be limited by law.`,
  ]],
  ["Using the site", ["Do not attempt to break, overload, scrape at scale or misuse the site, its public tools or its ledger, or submit content you have no right to submit. We may suspend access that does."]],
  ["General", [
    `These terms are governed by the laws of ${LEGAL.governingLaw}, and disputes go to ${LEGAL.venue}. If part of these terms is unenforceable, the rest still applies. We may update these terms for future pilots; the version in force when you paid applies to your pilot.`,
    `Contact: ${contactLine()}.`,
  ]],
];
