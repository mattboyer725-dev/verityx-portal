import {
  checkCsrf,
  getSapPo,
  issueCsrf,
  listSapPos,
  sapGetEntity,
  sapWriteback,
  sapWritebackLog,
} from "./sap.ts";

const SERVICE = "/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV";

function headers(extra: Record<string, string> = {}) {
  return {
    "Content-Type": "application/json;charset=utf-8",
    DataServiceVersion: "2.0",
    "sap-processing-info": "ODataV2",
    ...extra,
  };
}

function poKey(path: string) {
  const m = path.match(/A_PurchaseOrder\('([^']+)'\)/);
  return m?.[1] || null;
}

const METADATA = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
  <edmx:DataServices m:DataServiceVersion="2.0" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
    <Schema Namespace="API_PURCHASEORDER_PROCESS_SRV" xmlns="http://schemas.microsoft.com/ado/2008/09/edm">
      <EntityType Name="A_PurchaseOrderType">
        <Key><PropertyRef Name="PurchaseOrder"/></Key>
        <Property Name="PurchaseOrder" Type="Edm.String" Nullable="false"/>
        <Property Name="ReleaseStatus" Type="Edm.String"/>
        <Property Name="NetAmount" Type="Edm.Decimal"/>
        <Property Name="Supplier" Type="Edm.String"/>
        <Property Name="ETag" Type="Edm.String"/>
      </EntityType>
      <EntityContainer Name="API_PURCHASEORDER_PROCESS_SRV_Entities" m:IsDefaultEntityContainer="true">
        <EntitySet Name="A_PurchaseOrder" EntityType="API_PURCHASEORDER_PROCESS_SRV.A_PurchaseOrderType"/>
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

export async function handleSapHttp(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  let path = url.pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/api/sap")) path = path.replace(/^\/api\/sap/, "/sap");
  if (!path.startsWith("/sap/")) return null;

  const method = request.method.toUpperCase();
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token, If-Match, X-Requested-With, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,OPTIONS",
        "Access-Control-Expose-Headers": "x-csrf-token, etag, DataServiceVersion",
      },
    });
  }

  if (path === "/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/$metadata" || path.endsWith("$metadata")) {
    return new Response(METADATA, { headers: { "Content-Type": "application/xml;charset=utf-8" } });
  }

  const csrfFetch = request.headers.get("x-csrf-token")?.toLowerCase() === "fetch";
  if (csrfFetch || path === SERVICE) {
    const token = issueCsrf();
    if (path === SERVICE && method === "GET") {
      return Response.json(
        { d: { EntitySets: ["A_PurchaseOrder"] } },
        { headers: headers({ "x-csrf-token": token, "Access-Control-Expose-Headers": "x-csrf-token" }) },
      );
    }
    if (csrfFetch && method === "GET") {
      return new Response(null, {
        status: 204,
        headers: { "x-csrf-token": token, "Access-Control-Expose-Headers": "x-csrf-token" },
      });
    }
  }

  if (path.endsWith("/A_PurchaseOrder") && method === "GET") {
    const results = listSapPos().map((po) => sapGetEntity(po.PurchaseOrder)?.d);
    return Response.json({ d: { results } }, { headers: headers() });
  }

  const key = poKey(path);
  if (key && method === "GET") {
    const entity = sapGetEntity(key);
    if (!entity) return Response.json({ error: { message: { value: "Purchase order not found" } } }, { status: 404 });
    return Response.json(entity, { headers: headers({ ETag: getSapPo(key)?.ETag || "" }) });
  }

  if (key && (method === "PATCH" || method === "POST" || method === "PUT")) {
    const csrf = request.headers.get("x-csrf-token");
    if (!checkCsrf(csrf)) {
      return Response.json({ error: { message: { value: "CSRF token missing or invalid" } } }, { status: 403 });
    }
    const current = getSapPo(key);
    if (!current) return Response.json({ error: { message: { value: "Purchase order not found" } } }, { status: 404 });
    const ifMatch = request.headers.get("if-match");
    if (ifMatch && ifMatch !== "*" && ifMatch !== current.ETag) {
      return Response.json({ error: { message: { value: "Precondition failed" } } }, { status: 412 });
    }
    let action: "HOLD" | "RELEASE" = "HOLD";
    try {
      const body = (await request.json()) as { ReleaseStatus?: string; action?: string };
      if (body.ReleaseStatus === "RELEASE" || body.action === "RELEASE") action = "RELEASE";
    } catch {
      /* default HOLD */
    }
    const rec = sapWriteback(key, key, action, action === "HOLD" ? "HOLD_PO" : "RELEASE_PO");
    return Response.json(
      { d: sapGetEntity(key)?.d, writeback: rec },
      { headers: headers({ ETag: rec.etag }) },
    );
  }

  if (path.endsWith("/WritebackLog") && method === "GET") {
    return Response.json({ d: { results: sapWritebackLog() } }, { headers: headers() });
  }

  return Response.json({ error: { message: { value: "Not found on SAP analog tenant" } } }, { status: 404 });
}
