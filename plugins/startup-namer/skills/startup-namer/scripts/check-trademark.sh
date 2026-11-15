#!/usr/bin/env bash
# Search USPTO trademarks for a candidate name.
#
# Usage: check-trademark.sh <name> [classes]
#   classes  optional comma-separated Nice classes to flag, e.g. "9,42"
#
# Queries the search service behind USPTO Trademark Search (tmsearch.uspto.gov),
# which replaced TESS in 2023. It is the public site's own JSON backend, not a
# documented API: no key is needed, but USPTO can change or rate-limit it. On any
# failure the output carries `api_error` plus a `fallback` block, and the result
# must be reported as unverified.
#
# Output: JSON with exact and similar (fuzzy, sound-alike) matches, live/dead
# status, classes, owner, goods and services, and a TSDR link per mark.

set -euo pipefail

: "${1:?Usage: check-trademark.sh <name> [classes]}"

python3 -I - "$1" "${2:-}" <<'PYEOF'
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ENDPOINT = "https://tmsearch.uspto.gov/prod-stage-v1-0-0/tmsearch"
name = sys.argv[1].strip()
classes = {f"IC {int(c):03d}" for c in re.findall(r"\d+", sys.argv[2])} if sys.argv[2] else set()
norm = lambda s: re.sub(r"[^a-z0-9]", "", (s or "").lower())

results = {
    "query": name,
    "classes_checked": sorted(classes),
    "search_method": "USPTO Trademark Search (tmsearch.uspto.gov)",
    "note": "Preliminary search only. A trademark attorney gives definitive clearance.",
}

body = {
    "query": {
        "bool": {
            "should": [
                {"match_phrase": {"WM": {"query": name, "boost": 10}}},
                {"match": {"WM": {"query": name, "fuzziness": "AUTO", "boost": 1}}},
            ],
            "minimum_should_match": 1,
        }
    },
    "size": 50,
    "from": 0,
    "track_total_hits": True,
    "_source": [
        "id", "registrationId", "wordmark", "alive", "statusDescription", "internationalClass",
        "ownerName", "goodsAndServices", "filedDate", "registrationDate", "markType",
    ],
}

try:
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json",
                 "User-Agent": "startup-namer"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read())
    hits = data["hits"]["hits"]

    marks = []
    for h in hits:
        s = h.get("source", {})
        mark_classes = [c for c in s.get("internationalClass") or [] if not c.startswith("(")]
        goods = " | ".join(s.get("goodsAndServices") or [])
        marks.append({
            "wordmark": s.get("wordmark") or "",
            "exact": norm(s.get("wordmark")) == norm(name),
            "live": bool(s.get("alive")),
            "status": s.get("statusDescription") or "",
            "classes": mark_classes,
            "same_class": bool(classes & set(mark_classes)) if classes else None,
            "owner": (s.get("ownerName") or [""])[0],
            "goods_and_services": goods[:300] + ("…" if len(goods) > 300 else ""),
            "serial_number": s.get("id") or "",
            "registration_number": s.get("registrationId") or "",
            "filed": (s.get("filedDate") or "")[:10],
            "tsdr_url": f"https://tsdr.uspto.gov/#caseNumber={s.get('id')}&caseType=SERIAL_NO&searchType=statusSearch",
        })

    live = [m for m in marks if m["live"]]
    results["fuzzy_matches_total"] = data["hits"].get("totalValue", len(marks))
    results["live_exact"] = [m for m in live if m["exact"]]
    results["live_similar"] = [m for m in live if not m["exact"]][:15]
    results["dead_count"] = len(marks) - len(live)
    if classes:
        results["live_same_class"] = [m["wordmark"] + " (" + ", ".join(m["classes"]) + ")"
                                      for m in live if m["same_class"]]
except (urllib.error.URLError, KeyError, ValueError, TimeoutError) as e:
    results["search_method"] = "USPTO Trademark Search unavailable"
    results["api_error"] = f"{type(e).__name__}: {e}"
    results["fallback"] = {
        "manual_search": "https://tmsearch.uspto.gov/search/search-results?query=" + urllib.parse.quote(name),
        "web_search_queries": [f'"{name}" trademark USPTO', f'"{name}" trademark registration'],
        "note": "Automated lookup failed. Run the web searches and mark the trademark result unverified.",
    }

print(json.dumps(results, indent=2))
PYEOF
