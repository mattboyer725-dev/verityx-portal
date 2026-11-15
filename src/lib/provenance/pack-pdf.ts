/**
 * Evidence pack PDF: the same data as the sealed JSON, laid out for a
 * contracting officer. Letter size, standard fonts (no embedded font files).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { MATERIALS, COVERED_COUNTRIES } from "./passport.ts";
import { STATE_LABEL, STATE_ORDER, type EvidencePackBody } from "./portfolio.ts";

const ink = rgb(0.06, 0.06, 0.08);
const mute = rgb(0.42, 0.4, 0.38);
const rule = rgb(0.78, 0.76, 0.72);
const bad = rgb(0.68, 0.16, 0.14);
const ok = rgb(0.13, 0.45, 0.25);
const warn = rgb(0.62, 0.42, 0.08);

const W = 612;
const H = 792;
const M = 48;

/** Standard PDF fonts only cover WinAnsi; anything else would throw. */
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function safe(text: string): string {
  return [...String(text ?? "")]
    .map((c) => {
      const code = c.codePointAt(0) ?? 63;
      if (c === "\n" || c === "\t") return " ";
      if ((code >= 32 && code < 127) || (code >= 160 && code <= 255) || WIN_ANSI_EXTRA.includes(c)) return c;
      return "?";
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const words = safe(text).replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
    // A single unbreakable token wider than the line (a digest): hard-split it.
    while (font.widthOfTextAtSize(cur, size) > max && cur.length > 8) {
      let cut = cur.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(cur.slice(0, cut), size) > max) cut--;
      lines.push(cur.slice(0, cut));
      cur = cur.slice(cut);
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function stateColor(state: string) {
  if (state === "declared-clear") return ok;
  if (state === "covered-country-declared" || state === "revoked") return bad;
  return warn;
}

export async function buildPackPdf(
  pack: EvidencePackBody,
  seal: { digest: string; ledgerHash: string; receiptKid: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(safe(`Evidence pack · ${pack.buyer}${pack.program ? ` · ${pack.program}` : ""}`));
  doc.setProducer("VerityX");
  doc.setCreator("VerityX");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;

  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const need = (h: number) => {
    if (y - h < M + 24) newPage();
  };
  const text = (s: string, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; max?: number; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.f ?? font;
    const x = opts.x ?? M;
    const lines = wrap(s, f, size, opts.max ?? W - x - M);
    for (const l of lines) {
      need(size + 4);
      page.drawText(l, { x, y: y - size, size, font: f, color: opts.color ?? ink });
      y -= size + (opts.gap ?? 4);
    }
  };
  const hr = () => {
    need(10);
    page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 0.5, color: rule });
    y -= 12;
  };

  // Cover
  text("VERITYX · EVIDENCE PACK", { size: 9, f: bold, color: mute });
  y -= 4;
  text(pack.buyer, { size: 22, f: bold });
  text(pack.program ? `Program / contract: ${pack.program}` : "All parts in the portfolio", { size: 12, color: mute });
  text(`Generated ${pack.generatedAt.replace("T", " ").slice(0, 19)} UTC`, { size: 10, color: mute });
  y -= 6;
  hr();

  text("Summary", { size: 13, f: bold });
  const counts = STATE_ORDER.map((s) => `${STATE_LABEL[s]}: ${pack.summary[s]}`).join("   ·   ");
  text(`${pack.summary.total} line items across ${pack.summary.parts} part numbers.`, { size: 10 });
  text(counts, { size: 9, color: mute });
  y -= 6;

  text("Seal", { size: 13, f: bold });
  text("SHA-256 of this pack's canonical JSON:", { size: 9, color: mute });
  text(seal.digest, { size: 8, f: mono });
  text(`Ledger entry: ${seal.ledgerHash || "-"}`, { size: 8, f: mono, color: mute });
  text(`Signed with key ${seal.receiptKid || "-"}. Verify the receipt in the JSON file at /verify; open each passport at /passport/<code>.`, {
    size: 9,
    color: mute,
  });
  y -= 6;
  text(pack.statement, { size: 9, color: mute });
  hr();

  // Items
  text("Parts", { size: 13, f: bold });
  for (const it of pack.items) {
    need(64);
    const head = `${it.partNumber}${it.description ? ` · ${it.description}` : ""}`;
    text(head, { size: 11, f: bold, gap: 2 });
    const meta = [
      it.program && `Program ${it.program}`,
      it.supplier && `Supplier ${it.supplier}`,
      it.passportCode ? `Passport ${it.passportCode}` : "No passport code",
      it.lot && `${MATERIALS[it.lot.material]?.label ?? it.lot.material}, lot ${it.lot.lotRef}, published by ${it.lot.publisher}`,
    ]
      .filter(Boolean)
      .join("  ·  ");
    text(meta, { size: 9, color: mute, gap: 2 });
    text(STATE_LABEL[it.state], { size: 10, f: bold, color: stateColor(it.state), gap: 3 });
    if (it.lot?.status === "revoked" && it.lot.revokedReason) text(`Revoked: ${it.lot.revokedReason}`, { size: 9, color: bad });
    for (const s of it.stages) {
      const where = s.covered
        ? s.sources.map((x) => `${x.country}${COVERED_COUNTRIES[x.country] ? " (covered country)" : ""} - ${x.facility} [${x.code}]`).join("; ")
        : "not declared";
      text(`${s.stage}: ${where}`, {
        size: 9,
        x: M + 12,
        color: s.sources.some((x) => COVERED_COUNTRIES[x.country]) ? bad : s.covered ? ink : warn,
        gap: 2,
      });
    }
    if (it.revokedInputs.length) text(`Revoked input lots: ${it.revokedInputs.join(", ")}`, { size: 9, x: M + 12, color: bad });
    y -= 6;
    hr();
  }

  // Passports index
  if (pack.passports.length) {
    text("Passports in these chains", { size: 13, f: bold });
    for (const p of pack.passports) {
      text(`${p.code}  ${p.status.padEnd(7)}  ${p.publisher}`, { size: 9, f: mono, gap: 1 });
      text(`  sha256 ${p.digest ?? "-"}`, { size: 7, f: mono, color: mute, gap: 4 });
    }
  }

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(safe(`VerityX evidence pack · ${pack.buyer} · page ${i + 1} of ${pages.length} · sha256 ${seal.digest.slice(0, 16)}…`), {
      x: M,
      y: 24,
      size: 7,
      font,
      color: mute,
    });
  });
  return doc.save();
}
