import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { APP_NAME } from "./constants";
import { formatWhen, money } from "./format";
import type { Decision, Pilot, Prospect, Report } from "./types";

const ink = rgb(0.043, 0.047, 0.055);
const mute = rgb(0.4, 0.38, 0.36);
const line = rgb(0.75, 0.73, 0.7);
const paper = rgb(0.97, 0.96, 0.93);

function wrap(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, max: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > max && current) {
      lines.push(current);
      current = w;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export async function buildReportPdf(input: {
  report: Report;
  pilot: Pilot;
  prospect: Prospect;
  decision: Decision | null;
}): Promise<Uint8Array> {
  const { report, pilot, prospect, decision } = input;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  let page = doc.addPage([612, 792]);
  let y = 748;
  const left = 54;
  const max = 504;

  const ensure = (need: number) => {
    if (y - need < 54) {
      page = doc.addPage([612, 792]);
      y = 748;
    }
  };

  const rule = () => {
    page.drawLine({
      start: { x: left, y },
      end: { x: left + max, y },
      thickness: 0.6,
      color: line,
    });
    y -= 14;
  };

  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: paper });

  page.drawText(APP_NAME.toUpperCase(), {
    x: left,
    y,
    size: 10,
    font: bold,
    color: ink,
  });
  page.drawText("SUPPLY CHAIN RISK AUDIT  ·  ADVISORY", {
    x: left + 86,
    y,
    size: 9,
    font,
    color: mute,
  });
  y -= 22;
  rule();

  const titleLines = wrap(report.title, bold, 18, max);
  for (const lineText of titleLines) {
    ensure(22);
    page.drawText(lineText, { x: left, y, size: 18, font: bold, color: ink });
    y -= 22;
  }
  y -= 4;
  page.drawText(`Pilot ${money(pilot.priceUsd)}  ·  ${pilot.slaHours}-hour target  ·  ${formatWhen(report.createdAt)}`, {
    x: left,
    y,
    size: 9,
    font,
    color: mute,
  });
  y -= 18;
  rule();

  const facts = [
    [`Company`, prospect.companyName],
    [`Sector / region`, [prospect.sector, prospect.region].filter(Boolean).join(" · ") || "—"],
    [`Payment`, `${pilot.paymentStatus}${pilot.paidVia ? ` via ${pilot.paidVia}` : ""}`],
    [`Decision`, decision ? `${decision.proposedAction} (${decision.status})` : "None on file"],
    [`Rule version`, decision?.ruleVersion ?? "—"],
    [`Sample walkthrough`, prospect.isSample ? "Yes — not live intelligence" : "No"],
  ];
  for (const [k, v] of facts) {
    ensure(16);
    page.drawText(k, { x: left, y, size: 9, font: bold, color: mute });
    page.drawText(String(v).slice(0, 80), { x: left + 120, y, size: 9, font, color: ink });
    y -= 14;
  }
  y -= 6;
  rule();

  const block = (heading: string, body: string, italicize = false) => {
    ensure(28);
    page.drawText(heading, { x: left, y, size: 10, font: bold, color: ink });
    y -= 16;
    const use = italicize ? italic : font;
    for (const ln of wrap(body, use, 10, max)) {
      ensure(14);
      page.drawText(ln, { x: left, y, size: 10, font: use, color: ink });
      y -= 13;
    }
    y -= 8;
  };

  block("Summary", report.summary);
  block("Findings", report.body);

  if (decision) {
    block("Provenance", decision.confidenceRationale);
    ensure(20);
    page.drawText("Evidence", { x: left, y, size: 10, font: bold, color: ink });
    y -= 16;
    for (const ev of decision.evidence) {
      const head = `${ev.title} — ${ev.sourceName} (${ev.observedAt}, ${ev.confidence})`;
      for (const ln of wrap(head, bold, 9, max)) {
        ensure(12);
        page.drawText(ln, { x: left, y, size: 9, font: bold, color: ink });
        y -= 12;
      }
      for (const ln of wrap(ev.excerpt, font, 9, max)) {
        ensure(12);
        page.drawText(ln, { x: left, y, size: 9, font, color: mute });
        y -= 12;
      }
      y -= 6;
    }
    if (decision.approvedByUserId) {
      block(
        "Human approval",
        `BLOCK/position approved at ${formatWhen(decision.approvedAt)}. Note: ${decision.approvalNote || "—"}`,
      );
    }
  }

  block("Disclaimer", report.disclaimer, true);

  ensure(30);
  page.drawText("Verityx  ·  Customer Zero OS  ·  v1.0-soft-prod", {
    x: left,
    y,
    size: 8,
    font: italic,
    color: mute,
  });

  return doc.save();
}

export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
