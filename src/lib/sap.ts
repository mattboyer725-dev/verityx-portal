export type SapItem = {
  PurchaseOrderItem: string;
  Material: string;
  Plant: string;
  OrderQuantity: number;
  NetPriceAmount: number;
  DocumentCurrency: string;
};

export type SapPO = {
  PurchaseOrder: string;
  PurchaseOrderType: "NB";
  CompanyCode: "SG01";
  PurchasingOrganization: "SGRE";
  PurchasingGroup: string;
  Supplier: string;
  DocumentCurrency: string;
  NetAmount: number;
  ReleaseStatus: "OPEN" | "HOLD" | "RELEASE";
  CreationDate: string;
  LastChangeDateTime: string;
  PurchasingDocumentDeletionCode: string;
  ETag: string;
  to_PurchaseOrderItem: SapItem[];
};

export type AribaRfq = {
  eventId: string;
  title: string;
  status: "Open" | "Awarded" | "OnHold";
  commodity: string;
  supplier: string;
  amount: number;
  currency: string;
  po: string;
  createdAt: string;
};

export type SapWriteback = {
  agent: "WRITEBACK";
  protocol: "SAP OData API_PURCHASEORDER_PROCESS_SRV + BAPI_PO_CHANGE";
  po: string;
  id: string;
  action: "HOLD" | "RELEASE";
  recommended: string;
  accepted: boolean;
  ts: string;
  doc: string;
  csrf: string;
  etag: string;
  odata: {
    service: string;
    entity: string;
    method: "PATCH";
    path: string;
    body: Record<string, string>;
  };
  bapi: {
    function: "BAPI_PO_CHANGE";
    PURCHASEORDER: string;
    POHEADER: { HOLD: string; RELEASE: string };
    RETURN: { TYPE: string; ID: string; NUMBER: string; MESSAGE: string }[];
  };
  idoc: { idoctyp: "ORDERS05"; docnum: string; status: "53"; xml: string };
};

const POS = new Map<string, SapPO>();
const RFQS = new Map<string, AribaRfq>();
const LOG: SapWriteback[] = [];

function etagOf(po: string, ts: string) {
  return `W/"${po}-${ts}"`;
}

export function seedSapPo(input: {
  po: string;
  id: string;
  supplier: string;
  title: string;
  plant: string;
  commodity: string;
  amount: number;
  currency: string;
}) {
  const existing = POS.get(input.po);
  if (existing) {
    if (!RFQS.has(input.po)) {
      RFQS.set(input.po, {
        eventId: `RFQ-${input.po.slice(-6)}`,
        title: input.title,
        status: existing.ReleaseStatus === "HOLD" ? "OnHold" : existing.ReleaseStatus === "RELEASE" ? "Awarded" : "Open",
        commodity: input.commodity,
        supplier: input.supplier,
        amount: input.amount,
        currency: input.currency,
        po: input.po,
        createdAt: "2026-08-04T09:12:00Z",
      });
    }
    return existing;
  }
  const now = new Date().toISOString();
  const po: SapPO = {
    PurchaseOrder: input.po,
    PurchaseOrderType: "NB",
    CompanyCode: "SG01",
    PurchasingOrganization: "SGRE",
    PurchasingGroup: "M01",
    Supplier: input.supplier,
    DocumentCurrency: input.currency,
    NetAmount: input.amount,
    ReleaseStatus: "OPEN",
    CreationDate: "2026-08-12",
    LastChangeDateTime: now,
    PurchasingDocumentDeletionCode: "",
    ETag: etagOf(input.po, now),
    to_PurchaseOrderItem: [
      {
        PurchaseOrderItem: "00010",
        Material: input.commodity.slice(0, 18).toUpperCase().replace(/\s+/g, "_"),
        Plant: input.plant.slice(0, 4).toUpperCase(),
        OrderQuantity: 1,
        NetPriceAmount: input.amount,
        DocumentCurrency: input.currency,
      },
    ],
  };
  POS.set(input.po, po);
  RFQS.set(input.po, {
    eventId: `RFQ-${input.po.slice(-6)}`,
    title: input.title,
    status: "Open",
    commodity: input.commodity,
    supplier: input.supplier,
    amount: input.amount,
    currency: input.currency,
    po: input.po,
    createdAt: "2026-08-04T09:12:00Z",
  });
  return po;
}

export function getSapPo(po: string) {
  return POS.get(po) || null;
}

export function getAriba(po: string) {
  return RFQS.get(po) || null;
}

export function listAribaRfqs() {
  return [...RFQS.values()];
}

export function getAribaByEvent(eventId: string) {
  for (const rfq of RFQS.values()) if (rfq.eventId === eventId) return rfq;
  return null;
}

export function patchAribaEvent(eventId: string, status: AribaRfq["status"]) {
  const rfq = getAribaByEvent(eventId);
  if (!rfq) return null;
  if (status === "OnHold") {
    sapWriteback(rfq.po, rfq.po, "HOLD", "HOLD_PO");
    return RFQS.get(rfq.po) || rfq;
  }
  if (status === "Awarded") {
    sapWriteback(rfq.po, rfq.po, "RELEASE", "RELEASE_PO");
    return RFQS.get(rfq.po) || rfq;
  }
  rfq.status = status;
  RFQS.set(rfq.po, rfq);
  return rfq;
}

export function listSapPos() {
  return [...POS.values()];
}

export function sapGetEntity(po: string) {
  const doc = POS.get(po);
  if (!doc) return null;
  return {
    d: {
      __metadata: {
        id: `https://sgre.sap.verityx.net/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder('${po}')`,
        uri: `/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder('${po}')`,
        type: "API_PURCHASEORDER_PROCESS_SRV.A_PurchaseOrderType",
        etag: doc.ETag,
      },
      ...doc,
    },
  };
}

export function sapWriteback(po: string, id: string, action: string, recommended: string): SapWriteback {
  const resolved: "HOLD" | "RELEASE" =
    action === "release" || action === "RELEASE_PO" || action === "RELEASE" ? "RELEASE" : "HOLD";
  const now = new Date().toISOString();
  const tag = etagOf(po, now);
  const doc = POS.get(po);
  if (doc) {
    doc.ReleaseStatus = resolved;
    doc.LastChangeDateTime = now;
    doc.ETag = tag;
    POS.set(po, doc);
  }
  const rfq = RFQS.get(po);
  if (rfq) {
    rfq.status = resolved === "HOLD" ? "OnHold" : "Awarded";
    RFQS.set(po, rfq);
  }
  const docnum = `${Date.now()}`.slice(-16);
  const rec: SapWriteback = {
    agent: "WRITEBACK",
    protocol: "SAP OData API_PURCHASEORDER_PROCESS_SRV + BAPI_PO_CHANGE",
    po,
    id,
    action: resolved,
    recommended,
    accepted: true,
    ts: now,
    doc: `VX-WB-${po.slice(-6)}-${resolved}`,
    csrf: `vx-csrf-${po.slice(-4)}-${Date.now().toString(36)}`,
    etag: tag,
    odata: {
      service: "API_PURCHASEORDER_PROCESS_SRV",
      entity: "A_PurchaseOrder",
      method: "PATCH",
      path: `/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder('${po}')`,
      body: {
        PurchaseOrder: po,
        ReleaseStatus: resolved,
        LastChangeDateTime: now,
      },
    },
    bapi: {
      function: "BAPI_PO_CHANGE",
      PURCHASEORDER: po,
      POHEADER: { HOLD: resolved === "HOLD" ? "X" : "", RELEASE: resolved === "RELEASE" ? "X" : "" },
      RETURN: [{ TYPE: "S", ID: "06", NUMBER: "017", MESSAGE: `${resolved} posted on ${po}` }],
    },
    idoc: {
      idoctyp: "ORDERS05",
      docnum,
      status: "53",
      xml: `<?xml version="1.0" encoding="UTF-8"?><ORDERS05><IDOC BEGIN="1"><EDI_DC40><TABNAM>EDI_DC40</TABNAM><IDOCTYP>ORDERS05</IDOCTYP><MESTYP>ORDERS</MESTYP><DOCNUM>${docnum}</DOCNUM><STATUS>53</STATUS></EDI_DC40><E1EDK01><BELNR>${po}</BELNR><ACTION>${resolved}</ACTION></E1EDK01></IDOC></ORDERS05>`,
    },
  };
  LOG.unshift(rec);
  return rec;
}

export function sapWritebackLog() {
  return LOG.slice(0, 40);
}

export function dumpSapState() {
  return {
    pos: [...POS.values()],
    rfqs: [...RFQS.values()],
    writebacks: LOG.slice(0, 80),
  };
}

export function loadSapState(input: { pos?: SapPO[]; rfqs?: AribaRfq[]; writebacks?: SapWriteback[] }) {
  if (input.pos?.length) {
    POS.clear();
    for (const po of input.pos) POS.set(po.PurchaseOrder, po);
  }
  if (input.rfqs?.length) {
    RFQS.clear();
    for (const rfq of input.rfqs) RFQS.set(rfq.po, rfq);
  }
  if (input.writebacks?.length) {
    LOG.length = 0;
    LOG.push(...input.writebacks);
  }
}

export function __resetSapForTests() {
  POS.clear();
  RFQS.clear();
  LOG.length = 0;
  CSRF.clear();
}

const CSRF = new Map<string, { token: string; exp: number }>();

export function issueCsrf(session = "desk") {
  const token = `vx-csrf-${session}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  CSRF.set(session, { token, exp: Date.now() + 30 * 60_000 });
  return token;
}

export function checkCsrf(token: string | null, session = "desk") {
  if (!token) return false;
  const rec = CSRF.get(session);
  if (!rec) return token.startsWith("vx-csrf-");
  return rec.token === token && rec.exp > Date.now();
}

