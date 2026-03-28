#!/usr/bin/env bash
# Batch domain availability checker
# Usage: check-domains-batch.sh <name> [tlds...]
# If no TLDs specified, checks: .com .io .co .ai .dev .app .so .sh .xyz
# Returns: JSON array of results

set -euo pipefail

NAME="${1:?Usage: check-domains-batch.sh <name> [tlds...]}"
shift

# Default TLDs to check
if [[ $# -eq 0 ]]; then
  TLDS=("com" "io" "co" "ai" "dev" "app" "so" "sh" "xyz")
else
  TLDS=("$@")
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "["
FIRST=true
for tld in "${TLDS[@]}"; do
  domain="${NAME}.${tld}"
  if [[ "$FIRST" == "true" ]]; then
    FIRST=false
  else
    echo ","
  fi
  "$SCRIPT_DIR/check-domain.sh" "$domain" 2>/dev/null || \
    echo "{\"domain\": \"$domain\", \"available\": \"error\", \"status\": \"check_failed\", \"registrar\": null, \"expiry\": null}"
done
echo "]"
