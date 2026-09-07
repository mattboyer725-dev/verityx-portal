import { Link } from "@tanstack/react-router";
import { SURFACES } from "@/lib/nav";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        VerityX Sovereign · advisory · HMAC + Merkle. BLOCK never auto-applies. Vendor tenants named on the field are
        not subscribed.
      </p>
      <nav aria-label="Product">
        {SURFACES.map((s) => (
          <Link key={s.to} to={s.to}>
            {s.label}
          </Link>
        ))}
        <a href="/health/live">Health</a>
        <a href="/api/competition">Field API</a>
      </nav>
    </footer>
  );
}
