# Validation details

Scripts are in `${CLAUDE_PLUGIN_ROOT}/skills/startup-namer/scripts/`. Each prints JSON.

| Script | Does |
|---|---|
| `check-domain.sh <domain>` | RDAP lookup via the IANA bootstrap file, falling back to rdap.org. Returns `available` (`likely`, `no`, `expiring`, `unknown`), status, registrar, expiry. |
| `check-domains-batch.sh <name> [tlds...]` | Runs `check-domain.sh` over .com .io .co .ai .dev .app .so .sh .xyz, or the TLDs given. Returns a JSON array. |
| `whois-lookup.sh <domain>` | Parses `whois` for registrar, dates, registrant, nameservers, status, privacy, and parked or for-sale signals, and adds an `acquisition_notes` line. |
| `check-trademark.sh <name> [classes]` | Searches USPTO Trademark Search (the tmsearch.uspto.gov backend, no key) for exact and fuzzy sound-alike marks. Returns `live_exact`, `live_similar` (top 15), `dead_count`, and with classes such as `9,42` a `live_same_class` list; each mark has status, classes, owner, goods and services, and a TSDR link. `fuzzy_matches_total` counts every loose match and is not a conflict count. On failure it returns `api_error` plus a `fallback` block with a manual search link and web search queries. |
| `seo-check.sh <name>` | Prints the SEO search plan for WebSearch: the queries and how to rate them. It does no searching itself. |

## Nice classes that matter for tech startups

| Class | Covers |
|---|---|
| 9 | Computer software, apps, electronics |
| 35 | Advertising, business management, SaaS |
| 36 | Financial services, fintech |
| 38 | Telecommunications |
| 41 | Education, entertainment |
| 42 | Software development, cloud computing, SaaS |
| 44 | Medical and health services |
| 45 | Legal and security services |

Treat only live marks (status not dead, abandoned, cancelled, or expired) in the same or
an adjacent class as conflicts.

## WHOIS purchase signals

- Parked or for-sale: nameservers or text mentioning Sedo, Dan.com, Afternic,
  HugeDomains, ParkingCrew, Undeveloped, Squadhelp, GoDaddy Auctions, "buy this domain".
- Expired or expiring soon.
- Privacy-protected with no real site behind it, often a squatter.
- Old registration with no active site; the owner may sell.

For a purchasable domain, give next steps: the marketplace listing if one exists, a
broker (Sedo, Afternic, GoDaddy Domain Broker) otherwise, and a price range.

## SEO queries

Per name, or batched three or four names per query:

1. `"<name>" company`
2. `"<name>" startup`
3. `"<name>" app` and `"<name>" software`
4. `<name> site:crunchbase.com` and `<name> site:linkedin.com/company`
5. `<name>` alone, to see what dominates

For each, note whether a company by that exact name exists, its industry, and how
prominent it is. Common dictionary words also make social handles harder to get.

## Results table

```
## Startup name results

| # | Name | Best domains | Domain hacks | TM status | SEO | Score | Notes |
|---|------|--------------|--------------|-----------|-----|-------|-------|
| 1 | **Kova** | .com ✅ .io ✅ .ai ✅ | — | ✅ No conflicts | Excellent | ⭐⭐⭐⭐⭐ | Clean across the board |
| 2 | **Luminary** | .io ✅ .dev ✅ | — | ✅ Clear in Class 42 | Good | ⭐⭐⭐⭐ | .com taken (parked, ~$5k est.) |
| 3 | **Gath.er** | — | gath.er ✅ | ⚠️ Class 9 (unrelated) | Good | ⭐⭐⭐⭐ | Domain hack available |
```

- **Best domains**: available TLDs with ✅. Always show .com status, even when taken,
  and say if it looks purchasable.
- **Domain hacks**: the hack, if one exists and is available.
- **TM status**: ✅ no conflict in the user's vertical; ⚠️ a mark exists in a different
  class (name the class) or the check is unverified; ❌ a direct conflict.
- **SEO**: excellent, good, fair, or poor.
- **Score**: one to five stars, per the rubric below.
- **Notes**: purchasable domains and estimates, risks, failed checks.

### Star rubric

| Stars | Criteria |
|---|---|
| ⭐⭐⭐⭐⭐ | .com or ideal TLD available, no trademark conflict, excellent SEO, strong name |
| ⭐⭐⭐⭐ | Good TLD available, no conflict in the vertical, good SEO |
| ⭐⭐⭐ | Decent TLD available, minor trademark concerns, fair SEO |
| ⭐⭐ | Limited domains, some trademark overlap, fair or poor SEO |
| ⭐ | Major issue: trademark conflict, poor SEO, or no usable domain |

## Finalist deep dive

For each of the one to three finalists the user picks:

1. **WHOIS on every relevant TLD**, not just .com.
2. **Social handles** via WebSearch: `site:x.com/<name>` (and `site:twitter.com/<name>`),
   `site:github.com/<name>`, `instagram.com/<name>`.
3. **Extended trademark search** for similar-sounding and similarly spelled marks.
4. **App stores**: WebSearch `"<name>" app` on the App Store and Google Play.
5. **International meanings**: WebSearch the name with major languages for unfortunate
   meanings.

Deliver a short report per finalist covering each item, the remaining risks, and the
recommended domain to register or buy.
