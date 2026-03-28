---
name: startup-namer
description: Generate and validate startup names with domain availability checks, trademark searches, SEO viability analysis, WHOIS lookups for purchasable domains, and domain hacks. Use when the user wants to brainstorm startup names, find available domains for a business, check if a company name is taken, or needs help naming a product or company.
user-invocable: true
argument-hint: "[optional: startup description or name idea]"
allowed-tools: AskUserQuestion, WebSearch, WebFetch, Bash, Read, Write
---

# Startup Namer

Generate, validate, and score startup names across domain availability, trademarks, SEO viability, and brand strength — then present everything in a clean comparison table.

## Overview

This skill generates 20 startup name candidates at a time, validates each across multiple dimensions, and presents a comprehensive table so the user can make an informed decision. If no names resonate, it gathers more feedback and generates another batch.

**Scripts directory:** `scripts/`

## Step 1: Gather Requirements (ALWAYS DO THIS FIRST)

Before generating any names, use `AskUserQuestion` to survey the user. Ask up to 4 questions at a time, then follow up as needed.

### First Survey Round

Ask these questions using AskUserQuestion:

1. **"What does your startup do?"** (header: "Product")
   - Options: "SaaS / Software", "Marketplace / Platform", "AI / ML", "Consumer App"
   - multiSelect: false
   - The user will likely pick "Other" and describe their product — that's ideal.

2. **"What vertical/industry is your startup in?"** (header: "Vertical")
   - Options: "Fintech", "Healthcare", "Developer Tools", "E-commerce"
   - multiSelect: false
   - This is critical for trademark class analysis later.

3. **"What vibe should the name have?"** (header: "Name Vibe")
   - Options: "Techy & Modern (e.g. Vercel, Stripe)", "Friendly & Approachable (e.g. Notion, Slack)", "Bold & Ambitious (e.g. Palantir, Anduril)", "Minimal & Clean (e.g. Arc, Linear)"
   - multiSelect: true — they may want a blend.

4. **"Any constraints or preferences?"** (header: "Constraints")
   - Options: "Must be one word", "Must have .com available", "Open to creative TLDs (.ai, .io, .dev, etc.)", "Open to domain hacks (e.g. del.icio.us)"
   - multiSelect: true

### Second Survey Round (if needed)

Based on initial answers, ask follow-ups:

1. **"Any words, themes, or concepts you want the name to evoke?"** — Let them type freely.
2. **"Any names you like (even if taken) as inspiration?"** — Helps calibrate style.
3. **"What names have you already considered and rejected?"** — Avoids wasted effort.
4. **"Target audience?"** — Options: "Developers", "Enterprise / B2B", "Consumers", "SMBs"

## Step 2: Generate 20 Name Candidates

Using the gathered requirements, generate exactly 20 name candidates. Apply these naming strategies:

### Naming Patterns to Use (mix across all 20)

| Pattern | Description | Examples |
|---------|-------------|----------|
| **Coined Words** | New words that feel natural | Spotify, Twilio, Klaviyo |
| **Portmanteau** | Blend two relevant words | Pinterest (pin+interest), Groupon (group+coupon) |
| **Metaphor** | Abstract concept that evokes the product | Asana (yoga pose = flow), Palantir (seeing stone) |
| **Truncation** | Shortened real words | Tumblr, Flickr, Scribd |
| **Compound** | Two simple words joined | Salesforce, Dropbox, Mailchimp |
| **Domain Hack** | TLD completes the word | del.icio.us, bit.ly, hover.sh |
| **Abstract** | Short, punchy, memorable sounds | Zuul, Klar, Vex, Novu |
| **Mythological/Literary** | References to mythology, science, literature | Palantir, Janus, Hermes |
| **Action Word** | Verb that implies what the product does | Gather, Rally, Loom |
| **Respelled** | Common word with creative spelling | Lyft, Fiverr, Dialpad |

### Name Quality Criteria

Every generated name MUST be:
- **Pronounceable** — Someone should be able to say it after reading it once
- **Spellable** — If you hear it, you should be able to type it correctly
- **Memorable** — Short (ideally 2-3 syllables, max 8 characters preferred)
- **Not offensive** — Check for unfortunate meanings in major languages
- **Distinct** — Not easily confused with major existing brands
- **Relevant** — Should feel appropriate for the vertical/product

### Domain Hack Generation

For domain hacks, identify where a TLD naturally completes a word:
- Words ending in common TLDs: .io, .ai, .co, .do, .so, .to, .is, .it, .me, .us, .sh, .ly, .in, .at, .be, .de
- Examples: `reali.ze` → `real.iz` is bad, `noti.fy` → `noti.fy` is good if .fy existed
- Good domain hacks: `snap.chat` (if .chat TLD), `launch.ai`, `gath.er` (if .er TLD)
- Focus on TLDs that actually exist and are registrable

## Step 3: Validate Each Name (Run in Parallel Where Possible)

For each of the 20 names, run these checks. Use parallel Bash calls to speed things up.

### 3a. Domain Availability

For each name, check the most relevant TLDs. Use the batch script:

```bash
scripts/check-domains-batch.sh "namehere"
```

This checks .com, .io, .co, .ai, .dev, .app, .so, .sh, .xyz by default.

For domain hacks, check the specific hack domain:
```bash
scripts/check-domain.sh "hack.tld"
```

**Interpret results:**
- `"available": "likely"` → Domain is probably available (no RDAP record)
- `"available": "no"` → Domain is registered
- `"available": "expiring"` → Domain may become available soon

### 3b. WHOIS Lookup (For Registered Domains Worth Pursuing)

If a great name has its .com taken but looks potentially purchasable (parked, expired, etc.):

```bash
scripts/whois-lookup.sh "name.com"
```

Look for signals that the domain might be purchasable:
- **Parked/for-sale indicators** — Listed on Sedo, Dan.com, Afternic, etc.
- **Expired or expiring** — Check expiry date
- **Privacy-protected but no real site** — Often squatters
- **Old registration with no active site** — Owner may be willing to sell

### 3c. Trademark Search

For each name, check the USPTO trademark database:

```bash
scripts/check-trademark.sh "namehere"
```

**Interpret results:**
- Check if any LIVE trademarks exist with this exact name
- Note the **international class** (Nice Classification) of each match
- Compare against the user's vertical — a trademark in Class 25 (clothing) doesn't conflict with a Class 42 (software) startup
- Flag as conflict only if there's a live trademark in the same or adjacent class

**Key Nice Classification classes for tech startups:**
| Class | Description |
|-------|-------------|
| 9 | Computer software, apps, electronics |
| 35 | Advertising, business management, SaaS |
| 36 | Financial services, fintech |
| 38 | Telecommunications |
| 41 | Education, entertainment |
| 42 | Software development, cloud computing, SaaS |
| 44 | Medical/health services |
| 45 | Legal, security services |

### 3d. SEO Viability Check

For each name, use **WebSearch** to evaluate the competitive landscape:

1. Search for `"<name>" company` — Are there existing companies with this name?
2. Search for `"<name>" startup` — Any startups using this?
3. Search for `<name> site:crunchbase.com` — On Crunchbase?
4. Search for `<name>` alone — What dominates results?

**Rate SEO viability:**
- **EXCELLENT** — No companies with this exact name. Search returns generic/dictionary results only.
- **GOOD** — Companies exist but in completely unrelated verticals (e.g., a restaurant chain won't compete for "AI startup" keywords).
- **FAIR** — Some overlap. A company exists in a tangentially related space.
- **POOR** — Direct competitor or major brand with same name in same/similar vertical.

**Important:** You don't need to search all 20 names individually. Batch 3-4 names per WebSearch where possible, and skip deep SEO checks for names that already failed domain/trademark checks.

## Step 4: Present Results Table

Present ALL 20 names in a single markdown table with this format:

```
## Startup Name Results

| # | Name | Best Domains | Domain Hacks | TM Status | SEO | Score | Notes |
|---|------|-------------|--------------|-----------|-----|-------|-------|
| 1 | **Luminary** | .io ✅ .dev ✅ | — | ✅ Clear in Class 42 | GOOD | ⭐⭐⭐⭐ | .com taken (parked, ~$5k est.) |
| 2 | **Kova** | .com ✅ .io ✅ .ai ✅ | — | ✅ No conflicts | EXCELLENT | ⭐⭐⭐⭐⭐ | Clean across the board |
| 3 | **Gath.er** | — | gath.er ✅ | ⚠️ Class 9 (unrelated) | GOOD | ⭐⭐⭐⭐ | Domain hack available |
```

### Column Definitions

- **Best Domains**: Show only available TLDs with ✅. Show .com status even if taken (note if purchasable).
- **Domain Hacks**: Show hack format if one exists and is available.
- **TM Status**: ✅ if no conflicts in the user's vertical. ⚠️ if trademark exists but in different class (note which class). ❌ if direct conflict.
- **SEO**: EXCELLENT / GOOD / FAIR / POOR rating.
- **Score**: ⭐ to ⭐⭐⭐⭐⭐ overall rating combining all factors.
- **Notes**: Key callouts — purchasable domains, acquisition estimates, risks, etc.

### Scoring Rubric

| Stars | Criteria |
|-------|----------|
| ⭐⭐⭐⭐⭐ | .com or ideal TLD available, no TM conflicts, EXCELLENT SEO, great name |
| ⭐⭐⭐⭐ | Good TLD available, no TM conflicts in vertical, GOOD SEO |
| ⭐⭐⭐ | Decent TLD available, minor TM concerns, FAIR SEO |
| ⭐⭐ | Limited domains, some TM overlap, FAIR/POOR SEO |
| ⭐ | Major issues — TM conflict, POOR SEO, or no good domains |

### After the Table

1. **Highlight top 3 picks** with a brief explanation of why each is strong.
2. **Note any "hidden gems"** — names where the .com is taken but likely purchasable (parked/for-sale), with WHOIS details and estimated acquisition cost if available.
3. **Flag any names to avoid** — explain trademark or SEO risks.

## Step 5: Iterate If Needed

If the user doesn't love any names:

1. Use `AskUserQuestion` to gather more feedback:
   - "Which names came closest to what you want?" (pick from the list)
   - "What specifically didn't work?" — Options: "Too generic", "Too weird/techy", "Wrong vibe", "Want shorter names"
   - "Any new directions you'd like to explore?"

2. Generate another batch of 20, adjusting strategy based on feedback.
3. Repeat until the user finds names they like.

## Step 6: Deep Dive on Finalists

When the user selects 1-3 finalists, do a deep validation:

1. **Full WHOIS** on all relevant TLDs (not just .com)
2. **Social media handle availability** — Search via WebSearch:
   - Twitter/X: `site:twitter.com/<name>` or `site:x.com/<name>`
   - GitHub: `site:github.com/<name>`
   - Instagram: search `instagram.com/<name>`
3. **Extended trademark search** — Search for similar-sounding marks too
4. **App store check** — WebSearch for `"<name>" app` on App Store / Play Store
5. **International concerns** — WebSearch for the name + major languages to check for unfortunate meanings

Present a detailed finalist report for each.

## Tips and Reminders

- **Speed over perfection**: Not every check needs to succeed. If a domain check times out, note it and move on.
- **Parallel execution**: Run domain checks for multiple names simultaneously using parallel Bash calls.
- **Don't over-search**: If a name fails domain checks badly, skip the SEO deep-dive.
- **Be honest**: If a name is taken or has issues, say so clearly. Don't oversell.
- **Legal disclaimer**: Always note that trademark searches are preliminary and users should consult a trademark attorney before finalizing.
- **Buyer guidance**: For taken domains worth pursuing, include actionable next steps (marketplace links, broker suggestions, estimated price ranges).
