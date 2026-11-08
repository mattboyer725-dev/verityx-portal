/**
 * CONSENSUS agent — sovereign v5 BUG-03 confidence engine, ported.
 *
 *   1. MAD outlier filter (modified Z-score, Iglewicz & Hoaglin 1993, cutoff 3.5)
 *   2. Near-zero mean guard (|mean| < 0.01 → INSUFFICIENT_DATA)
 *   3. CV = stdev / |mean|; sample stdev for N < 30, population for N >= 30
 *   4. confidence = clamp(1 - CV, 0, 1); VERIFIED at >= 0.80
 *
 * Cross-checked against verityx-sovereign backend/app/services/consensus.py.
 * Self-contained so node --test can import it directly.
 */
function median(s: number[]) {
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

function madFilter(values: number[]) {
  if (values.length < 3) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const med = median(sorted);
  const mad = median(sorted.map((v) => Math.abs(v - med)).sort((a, b) => a - b));
  if (mad === 0) return values;
  const f = values.filter((v) => (0.6745 * Math.abs(v - med)) / mad <= 3.5);
  return f.length >= 2 ? f : values;
}

/** Sovereign v5 BUG-03: Bessel-corrected sample stdev for N < 30, population stdev for N >= 30. */
const SMALL_SAMPLE_THRESHOLD = 30;
function stdev(values: number[]) {
  const n = values.length;
  const m = values.reduce((a, b) => a + b, 0) / n;
  const ss = values.reduce((a, b) => a + (b - m) ** 2, 0);
  return Math.sqrt(ss / (n < SMALL_SAMPLE_THRESHOLD ? n - 1 : n));
}

export type Consensus = {
  confidence: number;
  cv: number;
  verdict: "VERIFIED" | "DISPUTED" | "INSUFFICIENT_DATA";
  market: number;
  n: number;
  dropped: number;
  kept: number[];
};

export function consensusAgent(observations: number[]): Consensus {
  if (!observations || observations.length < 2) {
    return { confidence: 0, cv: 0, verdict: "INSUFFICIENT_DATA", market: 0, n: 0, dropped: 0, kept: [] };
  }
  const filtered = madFilter(observations);
  const market = filtered.reduce((a, b) => a + b, 0) / filtered.length;
  if (Math.abs(market) < 0.01) {
    return { confidence: 0, cv: 0, verdict: "INSUFFICIENT_DATA", market: 0, n: 0, dropped: 0, kept: filtered };
  }
  const cv = stdev(filtered) / Math.abs(market);
  const confidence = Math.max(0, Math.min(1, 1 - cv));
  return {
    confidence,
    cv,
    verdict: confidence >= 0.8 ? "VERIFIED" : "DISPUTED",
    market,
    n: filtered.length,
    dropped: observations.length - filtered.length,
    kept: filtered,
  };
}
