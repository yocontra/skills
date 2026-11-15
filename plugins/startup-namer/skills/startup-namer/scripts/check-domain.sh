#!/usr/bin/env bash
# Check domain availability via RDAP (ICANN's replacement for WHOIS)
# Usage: check-domain.sh <domain>
# Returns: JSON with availability status and registrar info

set -euo pipefail

DOMAIN="${1:?Usage: check-domain.sh <domain>}"

# Normalize domain to lowercase
DOMAIN=$(echo "$DOMAIN" | tr '[:upper:]' '[:lower:]')

check_rdap() {
  local domain="$1"
  local tld="${domain##*.}"

  # RDAP bootstrap: resolve the correct RDAP server for this TLD
  local rdap_base
  rdap_base=$(curl -sf -m 15 "https://data.iana.org/rdap/dns.json" | \
    python3 -c "
import sys, json
data = json.load(sys.stdin)
tld = sys.argv[1]
for entry in data.get('services', []):
    tlds, urls = entry
    if tld in tlds:
        print(urls[0].rstrip('/'))
        sys.exit(0)
print('https://rdap.org')
" "$tld" 2>/dev/null || echo "https://rdap.org")

  local url="${rdap_base}/domain/${domain}"
  local http_code

  # Fetch RDAP response
  http_code=$(curl -s -m 15 -L -o "$RDAP_TMP" -w "%{http_code}" "$url" 2>/dev/null) || http_code="000"

  if [[ "$http_code" == "404" ]]; then
    echo "{\"domain\": \"$domain\", \"available\": \"likely\", \"status\": \"no_rdap_record\", \"registrar\": null, \"expiry\": null}"
  elif [[ "$http_code" == "200" ]]; then
    python3 -c "
import json, sys
domain = sys.argv[1]
try:
    data = json.load(open(sys.argv[2]))
    status = data.get('status', [])
    registrar = None
    for e in data.get('entities', []):
        if 'registrar' in e.get('roles', []):
            vcard = e.get('vcardArray', [None, []])[1]
            for item in vcard:
                if item[0] == 'fn':
                    registrar = item[3]
                    break
    expiry = None
    for ev in data.get('events', []):
        if ev.get('eventAction') == 'expiration':
            expiry = ev.get('eventDate')
    available = 'no'
    if 'inactive' in status or 'pendingDelete' in status:
        available = 'expiring'
    print(json.dumps({
        'domain': domain,
        'available': available,
        'status': ', '.join(status) if status else 'registered',
        'registrar': registrar,
        'expiry': expiry
    }))
except Exception as ex:
    print(json.dumps({'domain': domain, 'available': 'unknown', 'status': str(ex), 'registrar': None, 'expiry': None}))
" "$domain" "$RDAP_TMP" 2>/dev/null
  else
    echo "{\"domain\": \"$domain\", \"available\": \"unknown\", \"status\": \"http_$http_code\", \"registrar\": null, \"expiry\": null}"
  fi
}

RDAP_TMP=$(mktemp)
trap 'rm -f "$RDAP_TMP"' EXIT
check_rdap "$DOMAIN"
