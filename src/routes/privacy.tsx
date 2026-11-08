import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, type LegalSection } from "@/components/legal-page";
import { LEGAL, contactLine } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy notice · VerityX" }] }),
  component: () => <LegalPage title="Privacy notice" sections={SECTIONS} />,
});

const SECTIONS: LegalSection[] = [
  ["Who is responsible", [`${LEGAL.entity}, ${LEGAL.entityPlace}, runs ${LEGAL.product} and decides how the personal data described here is used. Contact: ${contactLine()}.`]],
  ["What we collect", [
    "Pilot requests: your name, work email, company, role, what you are buying, order size and your message.",
    "Accounts (if you create one): name, email, a hashed password, and sign-in session records.",
    "Pilot work: the purchase orders, quotes and supplier names you send us. These are business records; keep personal data out of them where you can.",
    "Payments: handled by Stripe. We receive the payment status and your billing details; we never see or store your card number.",
    "Technical: request logs kept by our hosting provider, and a one-way daily hash of your network address used only to limit abuse of the request form.",
  ]],
  ["Why we use it", ["To answer your request, deliver and bill your pilot, keep the service secure, and meet legal obligations. We do not sell personal data, do not use it for advertising, and do not use it to train AI models."]],
  ["Who processes it for us", [
    "Vercel (website hosting), Supabase (database, United States, us-east-1), Stripe (payments) and, when enabled, Resend (sending our emails to you). Each processes data only on our instructions.",
  ]],
  ["Cookies", ["Only what sign-in needs: a session cookie set when you sign in. No advertising or cross-site tracking cookies."]],
  ["How long we keep it", [
    "Pilot requests: up to 24 months. Pilot work: up to 12 months after delivery unless agreed otherwise. Payment records: as long as tax law requires. Accounts: until you ask us to delete them.",
    "Sealed ledger entries are append-only and are kept; they carry a fingerprint, a short decision summary and an account identifier, not your documents or contact details.",
  ]],
  ["Your choices and rights", ["You can ask to see, correct, export or delete your personal data, or object to how we use it, by contacting us. We answer within 30 days. Depending on where you live (for example the EU, UK or California) you may have further rights, including complaining to a data-protection authority."]],
  ["Security", ["Data is encrypted in transit. The database is not reachable through any public API (row-level security is on for every table), the application connects with a least-privilege account, and secrets live only in our hosting provider’s encrypted settings."]],
  ["Changes", ["If we change this notice in a way that matters, we update the date at the top and, where you have given us an email, tell you."]],
];
