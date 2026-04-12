#!/usr/bin/env bash
# WHOIS lookup for registered domains - find owner info for potential purchase
# Usage: whois-lookup.sh <domain>
# Returns: JSON with owner details, registrar, expiry, and nameservers

set -euo pipefail

DOMAIN="${1:?Usage: whois-lookup.sh <domain>}"
DOMAIN=$(echo "$DOMAIN" | tr '[:upper:]' '[:lower:]')

# Run whois and parse key fields
WHOIS_RAW=$(whois "$DOMAIN" 2>/dev/null || echo "WHOIS lookup failed")

python3 -c "
import re, json, sys

raw = '''$WHOIS_RAW'''
if not raw or 'WHOIS lookup failed' in raw:
    raw = sys.stdin.read() if not raw else raw

def extract(pattern, text, default=None):
    m = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
    return m.group(1).strip() if m else default

# Check for parked/for-sale indicators
parked_indicators = ['parkingcrew', 'sedoparking', 'hugedomains', 'afternic',
                     'dan.com', 'sedo.com', 'godaddy auctions', 'for sale',
                     'buy this domain', 'undeveloped.com', 'squadhelp']
parked = any(ind in raw.lower() for ind in parked_indicators)

# Parse common WHOIS fields
result = {
    'domain': '$DOMAIN',
    'registrar': extract(r'Registrar:\s*(.+)', raw) or extract(r'Sponsoring Registrar:\s*(.+)', raw),
    'creation_date': extract(r'Creat(?:ion|ed)\s*Date:\s*(.+)', raw) or extract(r'Registration Date:\s*(.+)', raw),
    'expiry_date': extract(r'(?:Registry\s*)?Expir(?:y|ation)\s*Date:\s*(.+)', raw) or extract(r'Registrar Registration Expiration Date:\s*(.+)', raw),
    'updated_date': extract(r'Updated?\s*Date:\s*(.+)', raw),
    'registrant_org': extract(r'Registrant\s*Organi[sz]ation:\s*(.+)', raw),
    'registrant_name': extract(r'Registrant\s*Name:\s*(.+)', raw),
    'registrant_email': extract(r'Registrant\s*Email:\s*(.+)', raw),
    'registrant_country': extract(r'Registrant\s*Country:\s*(.+)', raw),
    'nameservers': list(set(re.findall(r'Name\s*Server:\s*(\S+)', raw, re.IGNORECASE))),
    'status': list(set(re.findall(r'(?:Domain\s*)?Status:\s*(\S+)', raw, re.IGNORECASE))),
    'privacy_protected': any(x in raw.lower() for x in ['privacy', 'redacted', 'contact privacy', 'whoisguard', 'domains by proxy']),
    'likely_parked_or_for_sale': parked,
}

# Determine acquisition difficulty
if parked:
    result['acquisition_notes'] = 'Domain appears parked or listed for sale. Likely purchasable via marketplace.'
elif result['privacy_protected']:
    result['acquisition_notes'] = 'WHOIS privacy enabled. Contact registrar or use domain broker service.'
elif result['registrant_org']:
    result['acquisition_notes'] = f\"Registered to {result['registrant_org']}. May require direct outreach.\"
else:
    result['acquisition_notes'] = 'Standard registration. Try contacting owner directly or use a broker.'

print(json.dumps(result, indent=2, default=str))
" <<< "$WHOIS_RAW"
