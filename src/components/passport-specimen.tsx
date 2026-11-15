/**
 * An example lot passport for the home page. Static and clearly labelled as an example:
 * it shows what a buyer sees, chained from mine to magnet, and seals stage by stage on load.
 */
const CHAIN = [
  { stage: "Mined", country: "AU", where: "Rare-earth mine, Western Australia", print: "3f9a 07c1" },
  { stage: "Separated", country: "MY", where: "Oxide separation plant, Pahang", print: "b21e 9d44" },
  { stage: "Refined", country: "VN", where: "Metal refinery, Hai Phong", print: "6c08 e3b5" },
  { stage: "Melted", country: "US", where: "Alloy strip casting, Texas", print: "d47f 1a02" },
  { stage: "Produced", country: "US", where: "Sintered magnet plant, Indiana", print: "90ae 5f6d" },
] as const;

export function PassportSpecimen() {
  return (
    <figure className="vx-specimen" aria-label="Example lot passport">
      <div className="vx-specimen-head">
        <div>
          <p className="vx-specimen-kind">Example lot passport</p>
          <p className="vx-specimen-code">LP-7K2M-9Q4R</p>
        </div>
        <dl className="vx-specimen-meta">
          <div>
            <dt>Material</dt>
            <dd>NdFeB magnet, N52</dd>
          </div>
          <div>
            <dt>Lot</dt>
            <dd>MAG-N52-4471</dd>
          </div>
          <div>
            <dt>Mass</dt>
            <dd>300 kg</dd>
          </div>
        </dl>
      </div>

      <ol className="vx-chain">
        {CHAIN.map((c, i) => (
          <li key={c.stage} style={{ ["--i" as string]: i }}>
            <span className="vx-chain-node" aria-hidden />
            <div className="vx-chain-body">
              <p className="vx-chain-stage">{c.stage}</p>
              <p className="vx-chain-where">{c.where}</p>
            </div>
            <span className="vx-chain-country" aria-label={`Country ${c.country}`}>
              {c.country}
            </span>
            <span className="vx-chain-print" title="Evidence fingerprint (SHA-256, first 8 hex)">
              {c.print}
            </span>
          </li>
        ))}
      </ol>

      <div className="vx-specimen-foot">
        <span className="vx-seal" aria-hidden>
          <svg viewBox="0 0 40 40">
            <rect x="8" y="8" width="24" height="24" transform="rotate(45 20 20)" />
            <path d="M14 20.5 L18.5 25 L26.5 15" />
          </svg>
        </span>
        <div>
          <p className="vx-specimen-sealed">Sealed, no covered country declared</p>
          <p className="vx-specimen-proof">Ledger entry 1,182, signed by key 230be6f0</p>
        </div>
      </div>
    </figure>
  );
}
