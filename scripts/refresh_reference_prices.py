#!/usr/bin/env python3
"""
Refresh src/data/reference-prices.json from licensed public sources only.

  Copper, aluminium   World Bank Commodity Price Data ("The Pink Sheet"),
                      monthly averages. Licence: CC BY 4.0.
  NdPr oxide, Dy oxide U.S. Geological Survey, Mineral Commodity Summaries
                      (annual average). U.S. Government work, public domain.

Runs in CI (.github/workflows/reference-prices.yml) on a monthly schedule and
on demand. Needs: python3, openpyxl, pdftotext (poppler-utils).

Never invents a value. A series it cannot parse keeps its previous points and
is reported; if nothing parses, the script exits non-zero and commits nothing.
"""
from __future__ import annotations

import datetime as dt
import io
import json
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "reference-prices.json"
UA = "verityx-reference-prices/1.0 (+https://verityx-portal.vercel.app/sources)"

WB_PAGE = "https://www.worldbank.org/en/research/commodity-markets"
USGS_YEAR = dt.date.today().year if dt.date.today().month >= 3 else dt.date.today().year - 1
USGS_LIGHT = f"https://pubs.usgs.gov/periodicals/mcs{USGS_YEAR}/mcs{USGS_YEAR}-rare-earths.pdf"
USGS_HEAVY = f"https://pubs.usgs.gov/periodicals/mcs{USGS_YEAR}/mcs{USGS_YEAR}-rare-earths-heavy.pdf"

WB_SOURCE = {
    "name": "World Bank Commodity Price Data (The Pink Sheet)",
    "url": WB_PAGE,
    "license": "CC BY 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "Source: World Bank Commodity Price Data (The Pink Sheet), CC BY 4.0. Monthly averages, nominal USD.",
}


def usgs_source(url: str) -> dict:
    return {
        "name": f"U.S. Geological Survey, Mineral Commodity Summaries {USGS_YEAR}",
        "url": url,
        "license": "Public domain (U.S. Government work)",
        "licenseUrl": "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
        "attribution": f"Source: U.S. Geological Survey, Mineral Commodity Summaries {USGS_YEAR}. Annual average; latest year is a USGS estimate.",
    }


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


# ---------------------------------------------------------------- World Bank
def wb_monthly_url() -> str:
    html = get(WB_PAGE).decode("utf-8", "replace")
    m = re.search(r'https?://[^"\']+CMO-Historical-Data-Monthly\.xlsx', html)
    if not m:
        raise RuntimeError("monthly workbook link not found on the World Bank page")
    return m.group(0)


def wb_series(xlsx: bytes) -> dict[str, list[dict]]:
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(xlsx), read_only=True, data_only=True)
    ws = wb["Monthly Prices"]
    rows = list(ws.iter_rows(values_only=True))
    header_i = next(i for i, r in enumerate(rows) if r and any(isinstance(c, str) and c.strip().lower() == "copper" for c in r))
    header = [(c or "").strip().lower() if isinstance(c, str) else "" for c in rows[header_i]]
    cols = {"copper": header.index("copper"), "aluminium": header.index("aluminum")}
    out: dict[str, list[dict]] = {k: [] for k in cols}
    for r in rows[header_i + 1 :]:
        if not r or not isinstance(r[0], str):
            continue
        m = re.fullmatch(r"(\d{4})M(\d{2})", r[0].strip())
        if not m:
            continue
        period = f"{m.group(1)}-{m.group(2)}"
        for k, ci in cols.items():
            v = r[ci]
            if isinstance(v, (int, float)) and v > 0:
                out[k].append({"period": period, "value": round(float(v), 2)})
    for k in out:
        out[k] = out[k][-36:]
        if len(out[k]) < 12:
            raise RuntimeError(f"World Bank {k}: only {len(out[k])} monthly points parsed")
    return out


# ---------------------------------------------------------------------- USGS
def pdf_text(pdf: bytes) -> str:
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(pdf)
        f.flush()
        return subprocess.run(["pdftotext", "-layout", f.name, "-"], check=True, capture_output=True, text=True).stdout


def usgs_row(text: str, label_re: str) -> list[dict]:
    """Parse '<label> 92 124 75 55 69' against the table's year header."""
    years_m = re.search(r"Salient Statistics.*?((?:20\d\d\s+){4}20\d\de?)", text, re.S)
    if not years_m:
        raise RuntimeError("USGS year header not found")
    years = re.findall(r"20\d\de?", years_m.group(1))
    m = re.search(label_re + r"[^\n]*?((?:\s+[\d,]+(?:\.\d+)?){%d})\s*$" % len(years), text, re.M | re.I)
    if not m:
        raise RuntimeError(f"USGS row not found: {label_re}")
    vals = [float(v.replace(",", "")) for v in m.group(1).split()]
    return [
        {"period": y.rstrip("e"), "value": v, **({"estimated": True} if y.endswith("e") else {})}
        for y, v in zip(years, vals)
    ]


def main() -> int:
    prev = json.loads(OUT.read_text()) if OUT.exists() else {"series": {}}
    series = dict(prev.get("series", {}))
    errors: list[str] = []
    updated = 0

    try:
        url = wb_monthly_url()
        wbs = wb_series(get(url))
        src = {**WB_SOURCE, "dataUrl": url}
        series["copper"] = {"label": "Copper", "unit": "USD/t", "frequency": "monthly", "points": wbs["copper"], "source": src}
        series["aluminium"] = {"label": "Aluminium", "unit": "USD/t", "frequency": "monthly", "points": wbs["aluminium"], "source": src}
        updated += 2
    except Exception as e:  # noqa: BLE001
        errors.append(f"world bank: {e}")

    try:
        light = pdf_text(get(USGS_LIGHT))
        series["ndprOxide"] = {
            "label": "NdPr oxide, 99% min",
            "unit": "USD/kg",
            "frequency": "annual",
            "points": usgs_row(light, r"Neodymium-praseodymium \(NdPr\) oxide"),
            "source": usgs_source(USGS_LIGHT),
        }
        updated += 1
    except Exception as e:  # noqa: BLE001
        errors.append(f"usgs light: {e}")

    try:
        heavy = pdf_text(get(USGS_HEAVY))
        series["dyOxide"] = {
            "label": "Dysprosium oxide, 99.5% min",
            "unit": "USD/kg",
            "frequency": "annual",
            "points": usgs_row(heavy, r"Dysprosium oxide"),
            "source": usgs_source(USGS_HEAVY),
        }
        updated += 1
    except Exception as e:  # noqa: BLE001
        errors.append(f"usgs heavy: {e}")

    for e in errors:
        print(f"[reference-prices] {e}", file=sys.stderr)
    if updated == 0:
        return 1

    doc = {
        "generatedAt": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "note": "Reference prices from licensed public sources. Monthly and annual averages, not spot quotes.",
        "series": series,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=2, sort_keys=True) + "\n")
    for k, s in series.items():
        last = s["points"][-1]
        print(f"[reference-prices] {k}: {last['period']} = {last['value']} {s['unit']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
