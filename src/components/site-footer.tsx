import { Link } from "@tanstack/react-router";
import { SURFACES } from "@/lib/nav";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        VerityX · advisory only · signed, verifiable receipts. BLOCK never auto-applies. VerityX connects to no ERP,
        procurement suite or traceability network; any company named in sample data is not a customer and has not
        endorsed it.
      </p>
      <nav aria-label="Product">
        {SURFACES.map((s) => (
          <Link key={s.to} to={s.to}>
            {s.label}
          </Link>
        ))}
        <a href="/pilot">Start a pilot</a>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/sources">Sources &amp; licences</a>
        <a href="/health/live">Health</a>
      </nav>
    </footer>
  );
}
