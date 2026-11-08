import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { PILOT_SLA_HOURS } from "@/lib/verityx/constants";

export const Route = createFileRoute("/paid")({
  head: () => ({ meta: [{ title: "Payment received · VerityX" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s: Record<string, unknown>): { ref?: string } =>
    typeof s.ref === "string" && /^[A-Za-z0-9_-]{4,64}$/.test(s.ref) ? { ref: s.ref } : {},
  component: PaidPage,
});

const NEXT = [
  ["Receipt", "Stripe emails your receipt and invoice now. Keep it for your accounts payable team."],
  ["Inputs", "If we do not have it yet, we will ask for the purchase order and any quotes through a secure channel — never by public link."],
  ["Clock", `Your ${PILOT_SLA_HOURS}-hour turnaround starts once we have the order and payment, whichever is later.`],
  ["Delivery", "You receive the evidence packet, the advisory decision and its sealed receipt. Verify the receipt yourself at /verify."],
] as const;

function PaidPage() {
  const { ref } = Route.useSearch();
  return (
    <main className="min-h-dvh overflow-x-hidden bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <SiteNav tone="ink" />
      </div>
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-6">
        <p className="text-[11px] uppercase tracking-[0.22em] text-ok">Payment received</p>
        <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">Thank you. Your pilot is booked.</h1>
        {ref ? <p className="mt-3 font-mono text-xs text-mute">Reference {ref.slice(0, 12)}</p> : null}
        <ol className="panel mt-8 grid gap-4 p-6">
          {NEXT.map(([k, v]) => (
            <li key={k} className="grid gap-1 border-t border-line pt-4 text-sm first:border-0 first:pt-0 sm:grid-cols-[7rem_1fr]">
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-gold">{k}</span>
              <span className="leading-relaxed">{v}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-mute">
          Questions? Reply to the email that carried your payment link. <Link className="underline underline-offset-2" to="/terms">Pilot terms</Link>{" "}
          · <Link className="underline underline-offset-2" to="/sources">Sources &amp; licences</Link>
        </p>
      </section>
      <div className="mx-auto max-w-6xl px-6 pb-10">
        <SiteFooter />
      </div>
    </main>
  );
}
