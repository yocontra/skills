#!/usr/bin/env bash
# Check USPTO trademark database via TESS (Trademark Electronic Search System)
# Usage: check-trademark.sh <name>
# Returns: JSON with trademark search results

set -euo pipefail

: "${1:?Usage: check-trademark.sh <name>}"

# Search USPTO TSDR API for trademark records
# Uses the free trademark search endpoint
python3 << 'PYEOF'
import json, sys, urllib.request, urllib.parse, re

name = sys.argv[1] if len(sys.argv) > 1 else ""

results = {
    "query": name,
    "trademarks": [],
    "search_method": "USPTO TSDR API",
    "note": "This is a preliminary search. Always consult a trademark attorney for definitive clearance."
}

try:
    # Search via USPTO's TSDR API
    encoded = urllib.parse.quote(name)
    url = f"https://tsdr.uspto.gov/documentretrieval/v2/trademarks?query={encoded}&start=0&rows=20&sort=score+desc"

    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (startup-name-checker)"
    })

    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())

    docs = data.get("response", {}).get("docs", [])

    for doc in docs[:10]:
        mark = {
            "serial_number": doc.get("serialNumber", ""),
            "registration_number": doc.get("registrationNumber", ""),
            "mark_name": doc.get("markIdentification", ""),
            "status": doc.get("status", ""),
            "status_date": doc.get("statusDate", ""),
            "filing_date": doc.get("filingDate", ""),
            "owner": doc.get("ownerName", ""),
            "description": doc.get("goodsAndServicesDescription", ""),
            "international_class": doc.get("internationalClass", []),
            "live": doc.get("status", "").upper() not in ["DEAD", "ABANDONED", "CANCELLED", "EXPIRED"],
        }
        results["trademarks"].append(mark)

    results["total_found"] = data.get("response", {}).get("numFound", 0)

except urllib.error.HTTPError as e:
    results["search_method"] = "USPTO API unavailable, using fallback"
    results["api_error"] = str(e)
except Exception as e:
    results["search_method"] = "search_error"
    results["api_error"] = str(e)

print(json.dumps(results, indent=2, default=str))
PYEOF
