---
name: startup-namer
effort: medium
description: Brainstorm and vet startup, company, product, or app names — 20 candidates per batch, each checked for domain availability, domain hacks, WHOIS on taken domains, USPTO trademark conflicts by Nice class, and SEO competition, ranked in a scored table.
argument-hint: "[startup description or name idea]"
allowed-tools: WebSearch, WebFetch, Bash, Read, Write
---

$ARGUMENTS

# Startup namer

Generate 20 name candidates, validate each one, and deliver a scored comparison table
with top picks. Draft first: infer the brief from the request and context, state the
assumptions, run the whole batch, and put follow-up questions at the end.

Scripts live at `${CLAUDE_PLUGIN_ROOT}/skills/startup-namer/scripts/`. They need `curl`,
`python3`, and `whois`, and no API keys.

## 1. Build the brief

Take what the user said, plus anything in the working directory (README, package
description, pitch notes), and fill in:

| Field | Default when unstated |
|---|---|
| What it does | From the request; this one is required |
| Vertical | Inferred from the product (drives the trademark classes) |
| Audience | Inferred: developers, enterprise/B2B, consumers, or SMBs |
| Vibe | A blend of techy-modern (Vercel, Stripe) and minimal-clean (Arc, Linear) |
| Constraints | One or two words, open to .io/.ai/.dev/.co and domain hacks, .com preferred not required |
| Themes, liked names, rejected names | None |

If the request says nothing about what the startup does, that is the one case that
changes the work materially: ask for a one-line description and stop. Otherwise list
every defaulted field under "Assumptions" in the output and proceed.

## 2. Generate 20 candidates

Mix at least six of the naming patterns (coined, portmanteau, metaphor, truncation,
compound, domain hack, abstract, mythological or literary, action word, respelled) and
include two or three domain hacks when constraints allow. Every name must be
pronounceable after one read, spellable after one hearing, short (two or three
syllables, eight characters or fewer preferred), free of unfortunate meanings in major
languages, distinct from major brands, and fitting for the vertical. Drop any name the
user already rejected. The pattern table with examples and the domain-hack rules are in
[naming-patterns.md](references/naming-patterns.md).

## 3. Validate

Run the domain checks for all names in parallel Bash calls; they are independent.

```bash
S="${CLAUDE_PLUGIN_ROOT}/skills/startup-namer/scripts"
"$S/check-domains-batch.sh" kova                 # .com .io .co .ai .dev .app .so .sh .xyz
"$S/check-domains-batch.sh" kova com ai          # chosen TLDs only
"$S/check-domain.sh" gath.er                     # one domain, for hacks
"$S/whois-lookup.sh" kova.com                    # taken domain worth pursuing
"$S/check-trademark.sh" kova 9,42                # USPTO search; flag classes 9 and 42
"$S/seo-check.sh" kova                           # prints the search plan for one name
```

- **Domains** (RDAP): `likely` means no registration record, `no` means registered,
  `expiring` means inactive or pending delete, `unknown` means the lookup failed. Report
  a failed lookup as unknown and move on.
- **WHOIS**: run it only on a strong name whose .com is taken. Parked or for-sale
  signals (Sedo, Dan.com, Afternic, HugeDomains), a near expiry date, or privacy
  protection with no live site suggest the domain can be bought.
- **Trademark**: pass the vertical's Nice classes. A conflict is a live mark on the exact
  or a confusingly similar name (`live_exact`, or a close `live_similar` sound-alike) in
  the same or an adjacent Nice class to the user's vertical. A mark in an unrelated
  class (clothing, Class 25, against a software startup, Class 42) is a note, not a
  conflict. When the script returns `api_error`, run its `fallback.web_search_queries`
  with WebSearch and mark the result unverified.
- **SEO**: rate with WebSearch, three or four names per query where possible, and skip
  names that already failed on domains or trademarks. Ratings: excellent (no company by
  that name, generic results), good (companies only in unrelated verticals), fair (a
  company in a tangential space), poor (a direct competitor or major brand).

Class table, WHOIS signals, and the SEO query set are in
[validation.md](references/validation.md).

## 4. Deliver

One markdown table with all 20 names, sorted by score:

| # | Name | Best domains | Domain hacks | TM status | SEO | Score | Notes |
|---|---|---|---|---|---|---|---|

Then:

1. **Top 3 picks**, each with a sentence on why it is strong.
2. **Hidden gems**: names whose .com is taken but looks purchasable, with WHOIS details,
   marketplace or broker next steps, and a price range estimate.
3. **Names to avoid**, with the trademark or SEO risk.
4. **Assumptions** from step 1, and any checks that failed or were unverified.
5. A one-line note that trademark searches are preliminary and a trademark attorney
   should clear the final choice.
6. **Questions** in one batch: which names came closest, what did not work (too generic,
   too odd, wrong vibe, too long), and any new directions.

Column meanings, the star rubric, and a sample row are in
[validation.md](references/validation.md#results-table).

## Follow-ups

- **New batch**: when the user gives feedback, generate another 20 that move toward the
  names they liked and away from what they rejected, and validate them the same way.
- **Finalists**: when the user names one to three finalists, run the deep dive — WHOIS on
  every relevant TLD, social handle checks, similar-sounding trademarks, app store
  collisions, and meanings in major languages — and deliver a report per finalist. Steps
  are in [validation.md](references/validation.md#finalist-deep-dive).

Be plain about problems: a taken or conflicted name is reported as such, not oversold.
