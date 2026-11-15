# Weekly status formatting reference

## Output format

Markdown that pastes cleanly into a doc, chat, or email: a bold initials header per author and `- ` bullets. Nothing else — no headings, no links, no URLs, no PR numbers, no commit hashes.

## Structure

```
**[XX]**
- bullet
- bullet

**[YY]**
- bullet

metrics line (plain comma-separated, no label)
```

- Each author gets `**[XX]**` on its own line.
- Bullets start with `- `.
- No section headers ("Completed", "Planning").
- Metrics as a plain line at the bottom, no label, only when a metrics command produced one.

## Bullet prefixes

- Bug fixes: 🐞 — `- 🐞 Fixed auth bug where...`
- Features and other items: no prefix — `- New email automation templates`
- In-progress items: natural language — `- Working on X with Y`

## Ordering within each author

1. In-progress items (open PRs, in-flight issues, additional_context)
2. Features and improvements
3. Bug fixes (🐞) — always last

## Bullet style

<!-- vale Skills.Wordiness = NO -->
One short line per bullet. No full sentences, no subordinate clauses; strip "so that", "which means", "in order to" tails. A dash explanation is fine if it stays under 10 words.
<!-- vale Skills.Wordiness = YES -->

| Bad | Good |
|-----|------|
| MCP server environment variables were silently dropped because the GraphQL API returned them as a list but the runner expected a dict — fixed the serialization mismatch | MCP server env vars silently dropped (serialization mismatch) — fixed |
| Reconciler was hanging indefinitely, leaving executions stuck in submitted status — added cycle timeouts and fixed a crash hitting large workspaces | Reconciler hanging indefinitely fixed — cycle timeouts, crash fix for large workspaces |
| Replaced lucide-react with a new icon set across the entire frontend so the app uses one consistent icon system everywhere | Replaced lucide-react with a single icon set across the frontend |

## Include

- Features and major fixes that shipped
- In-progress work the user provides
- Improvements with user-facing impact

## Exclude

- Chores, refactors with no user-facing impact
- Version bumps, dependency upgrades, release announcements
- Self-inflicted regression fixes (broke and fixed inside the window)
- Internal plumbing: token forwarding between services, env-var pinning, image-build tweaks, internal config corrections
- Test-only changes, doc formatting
- Meetings

When in doubt, drop. Scale the bullet count to shipped volume (bands in [analyze-author.md](../../../workflows/weekly/prompts/analyze-author.md)): a light week is 1–4 bullets, a 40-plus-PR week 11–16. Never pad to fill a band, and never compress a heavy week into a light one.

Every bullet states impact, not the diff. If a reader cannot tell why the change was made, it is not finished.

## Example

```
**[JS]**
- Working on step-level runtime hardening with Sam, ready to merge
- New email automation templates (Check Inbox, Send Message - requested by Support)
- Accessibility pass across the frontend — size classes, aria labels, button titles
- 🐞 Fixed auth bug where every API request after a secrets-client call returned 401

**[AC]**
- On-device model inference for analysis steps, with a redesigned model selector
- Query steps can run saved queries by ID instead of inline parameters
- Assistant falls back to a second model provider for users without access to the first
- 🐞 Fixed MCP subprocesses not inheriting the uv environment

**[BM]**
- Working with a partner team on the go-live plan
- CLI refreshes expired SSO tokens during long operations like logs --follow
- 🐞 OIDC auth failures show the actual error instead of "no jwt in response"

292 workspaces (118 ran something in 30d), 363 published workflows, 350 active users (30d)
```
