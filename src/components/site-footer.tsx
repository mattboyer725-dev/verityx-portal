import { VxWordmark } from "@/components/vx-mark";
import { FOOTER_GROUPS } from "@/lib/nav";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-top">
        <div className="site-footer-brand">
          <VxWordmark name="VerityX" />
          <p>
            Sealed, mine-to-magnet lot passports that anyone can verify, and the portfolio and evidence packs buyers need to
            stand behind them.
          </p>
        </div>
        <div className="site-footer-cols">
          {FOOTER_GROUPS.map((g) => (
            <div key={g.title}>
              <h3>{g.title}</h3>
              <ul>
                {g.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <p className="site-footer-legal">
        Advisory only. Lot passports are their publishers' own declarations; VerityX does not audit facilities or certify
        compliance with any rule. VerityX connects to no ERP, procurement suite or traceability network. Any company named in
        sample data is not a customer and has not endorsed VerityX. © {new Date().getFullYear()} Aequitas Core LLC.
      </p>
    </footer>
  );
}
