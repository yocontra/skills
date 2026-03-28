#!/usr/bin/env bash
# Quick SEO viability check - looks for existing companies/brands with the same name
# Usage: seo-check.sh <name>
# Returns: summary of search landscape for the name

set -euo pipefail

: "${1:?Usage: seo-check.sh <name>}"

python3 << 'PYEOF'
import json, sys

name = sys.argv[1] if len(sys.argv) > 1 else ""

# Output a structured search plan for Claude to execute via WebSearch
result = {
    "name": name,
    "search_queries": [
        f'"{name}" company',
        f'"{name}" startup',
        f'"{name}" app',
        f'"{name}" software',
        f"{name} site:crunchbase.com",
        f"{name} site:linkedin.com/company",
    ],
    "evaluation_criteria": {
        "seo_difficulty": "How many established companies share this exact name?",
        "brand_confusion_risk": "Are there well-known brands with similar names in adjacent spaces?",
        "search_uniqueness": "Does searching the name return mostly irrelevant/generic results (good) or specific competitors (bad)?",
        "social_handle_likelihood": "Common words = harder to get @handles"
    },
    "instructions": "Use WebSearch for each query. For each, note: (1) whether a company with this exact name exists, (2) what industry they are in, (3) how prominent they are. Rate SEO viability as: EXCELLENT (no competitors), GOOD (competitors in unrelated verticals), FAIR (some overlap), POOR (direct competitor with same name)."
}

print(json.dumps(result, indent=2))
PYEOF
