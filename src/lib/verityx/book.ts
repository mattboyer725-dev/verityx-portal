import type { ProspectStage } from "./types";

export type BookEntry = {
  key: string;
  companyName: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  sector: string;
  region: string;
  stage: ProspectStage;
  notes: string;
};

/** VerityX's own commercial book — magnetics, wind OEM, rare earth, EU DPP / CBAM. Not sample intelligence. */
export const VERITYX_BOOK: BookEntry[] = [
  {
    key: "sgre",
    companyName: "Siemens Gamesa Renewable Energy",
    contactName: "Elena Hartmann",
    contactRole: "Magnetics desk · supply chain",
    contactEmail: "",
    sector: "Wind OEM · NdFeB",
    region: "EU / ES",
    stage: "qualified",
    notes:
      "Customer Zero. 72-hour magnet provenance + CBAM / dual-use screen on declared NdFeB lots. Fill Elena's working email, contact, then open the $2,500 pilot.",
  },
  {
    key: "vestas",
    companyName: "Vestas Wind Systems",
    contactName: "Head of Direct Procurement",
    contactRole: "Direct procurement · generators",
    contactEmail: "",
    sector: "Wind OEM",
    region: "DK / EU",
    stage: "lead",
    notes: "Generator magnet custody and mill-certificate gaps on EU-destined turbines. Advisory pilot, not a regulator finding.",
  },
  {
    key: "ge-vernova",
    companyName: "GE Vernova",
    contactName: "Wind supply chain lead",
    contactRole: "Supply chain · onshore / offshore",
    contactEmail: "",
    sector: "Wind OEM",
    region: "US / EU",
    stage: "lead",
    notes: "Onshore generator magnet lot traceability and sanctions screen on declared tier-1. 72-hour advisory.",
  },
  {
    key: "nordex",
    companyName: "Nordex SE",
    contactName: "Purchasing — drivetrain",
    contactRole: "Purchasing",
    contactEmail: "",
    sector: "Wind OEM",
    region: "DE / EU",
    stage: "lead",
    notes: "Drivetrain magnet and fastener documentation pack. EU DPP-ready evidence file.",
  },
  {
    key: "goldwind",
    companyName: "Goldwind",
    contactName: "International supply director",
    contactRole: "International supply",
    contactEmail: "",
    sector: "Wind OEM",
    region: "CN / EU export",
    stage: "lead",
    notes: "EU-export dual-use and sanctions screen on declared magnet suppliers. Advisory only.",
  },
  {
    key: "proterial",
    companyName: "Proterial (Hitachi Metals)",
    contactName: "NdFeB commercial lead",
    contactRole: "Commercial · sintered NdFeB",
    contactEmail: "",
    sector: "Magnet producer",
    region: "JP",
    stage: "lead",
    notes: "Declared heat-to-mill certificate chain for sintered NdFeB lots sold into EU wind.",
  },
  {
    key: "vac",
    companyName: "VACUUMSCHMELZE (VAC)",
    contactName: "Automotive & energy sales",
    contactRole: "Sales · energy",
    contactEmail: "",
    sector: "Magnet producer",
    region: "DE / EU",
    stage: "qualified",
    notes: "EU producer. Provenance packet + CBAM data gaps on export lots. Natural first paid pilot outside SGRE.",
  },
  {
    key: "arnold",
    companyName: "Arnold Magnetic Technologies",
    contactName: "Aerospace & energy sales",
    contactRole: "Sales",
    contactEmail: "",
    sector: "Magnet producer",
    region: "US",
    stage: "lead",
    notes: "US magnetics house. Custody chain for energy-sector lots and OFAC screen on declared feed.",
  },
  {
    key: "mp-materials",
    companyName: "MP Materials",
    contactName: "Downstream magnetics BD",
    contactRole: "Business development",
    contactEmail: "",
    sector: "Rare earth · mine-to-magnet",
    region: "US",
    stage: "lead",
    notes: "Mine-to-magnet custody for NdPr destined to EU wind OEMs. Documentation-gap pilot.",
  },
  {
    key: "lynas",
    companyName: "Lynas Rare Earths",
    contactName: "Separated product sales",
    contactRole: "Sales · separated RE",
    contactEmail: "",
    sector: "Rare earth",
    region: "AU / MY",
    stage: "lead",
    notes: "Separated NdPr lot provenance into EU magnet makers. Dual-use and origin screen.",
  },
  {
    key: "neo",
    companyName: "Neo Performance Materials",
    contactName: "Magnequench commercial",
    contactRole: "Commercial · Magnequench",
    contactEmail: "",
    sector: "Magnet materials",
    region: "CA / EE / EU",
    stage: "lead",
    notes: "Magnequench powder and magnet lot evidence for EU DPP. 72-hour advisory.",
  },
  {
    key: "niron",
    companyName: "Niron Magnetics",
    contactName: "OEM partnerships",
    contactRole: "OEM partnerships",
    contactEmail: "",
    sector: "Iron-nitride magnets",
    region: "US",
    stage: "lead",
    notes: "Alternative-chemistry magnet claims vs NdFeB. Documentation and origin packet for OEM trials.",
  },
  {
    key: "bmw",
    companyName: "BMW Group",
    contactName: "Purchasing — e-drive",
    contactRole: "Purchasing · e-drive",
    contactEmail: "",
    sector: "Automotive OEM",
    region: "DE / EU",
    stage: "lead",
    notes: "E-drive magnet provenance and CBAM data on declared tier-1. Advisory, not a finding.",
  },
  {
    key: "orsted",
    companyName: "Ørsted",
    contactName: "Offshore wind procurement",
    contactRole: "Procurement · offshore",
    contactEmail: "",
    sector: "Wind developer",
    region: "DK / EU",
    stage: "lead",
    notes: "Offshore turbine magnet custody through the OEM. Developer-side DPP evidence file.",
  },
  {
    key: "equinor",
    companyName: "Equinor",
    contactName: "Floating wind supply chain",
    contactRole: "Supply chain · floating wind",
    contactEmail: "",
    sector: "Wind developer",
    region: "NO / EU",
    stage: "lead",
    notes: "Floating wind magnet and converter supply screen. 72-hour advisory packet.",
  },
  {
    key: "iberdrola",
    companyName: "Iberdrola",
    contactName: "Renewables procurement",
    contactRole: "Procurement · renewables",
    contactEmail: "",
    sector: "Wind developer",
    region: "ES / EU",
    stage: "lead",
    notes: "Iberian wind OEM magnet custody. CBAM + sanctions screen on declared lots.",
  },
];

export function outreachCopy(input: {
  companyName: string;
  contactName: string;
  senderName?: string;
}) {
  const greeting = input.contactName.trim() || "there";
  const sender = input.senderName?.trim() || "Matt Boyer";
  const company = input.companyName.trim() || "your team";
  const subject = `VerityX 72-hour magnetics provenance pilot — ${company}`;
  const body = `Hello ${greeting},

I run VerityX. We file a 72-hour, evidence-backed magnetics and supply-chain provenance pilot for wind, rare-earth, and e-drive teams — mill certificates, origin, CBAM data gaps, and sanctions screening on declared lots.

It is advisory. It is not a regulator finding, a fraud accusation, or live intelligence beyond the sources you provide.

Price is $2,500. Clock starts when the required inputs land.

If ${company} wants one lot taken through the desk this month, reply with a working email and the scope (which lots, which corridor). I will open the file and send the intake.

Matt Boyer
VerityX Sovereign
${sender !== "Matt Boyer" ? sender : "mattboyer725@gmail.com"}`.trim();
  return { subject, body };
}

export function prospectReady(p: {
  companyName: string;
  contactName: string;
  contactEmail: string;
  notes: string;
  outreachCount: number;
}) {
  const company = Boolean(p.companyName.trim());
  const contact = Boolean(p.contactName.trim());
  const email = Boolean(p.contactEmail.trim());
  const notes = Boolean(p.notes.trim());
  const contacted = p.outreachCount > 0;
  return {
    company,
    contact,
    email,
    notes,
    contacted,
    finishable: company && contact && email && notes,
    readyToPilot: company && contact && email && notes && contacted,
  };
}
