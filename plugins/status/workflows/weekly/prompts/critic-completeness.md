# Critic: Completeness

Re-walk the gathered data systematically — read the cross-author index (`index.md`) and, when present, the issue file (`issues.md`) whose paths you are given. Your job is to flag gaps in the draft sections.

## What to check

- **Biggest-first check — run this before anything else.** For each author, take their 5 largest merged PRs by the `files=`/`+`/`-` figures in the index. Each one must be traceable to a bullet, either on its own or inside a themed bullet. A top-3-by-scale item with no corresponding bullet is the most serious defect this critic exists to catch — flag it explicitly and name the PR.
- For each author who appears in the git/PR/issue data, count their merged PRs and verify the draft section reflects that volume. Use the analyzer's own budget: 1–5 PRs → 1–4 bullets, 6–15 → 4–7, 16–40 → 7–11, 40+ → 11–16. A section materially under its band is a gap; flag which themes were collapsed or dropped.
- **PR-only authors.** Anyone appearing in the index as a PR author but absent from the draft entirely. An author list built from `git log` misses a contributor whose work landed as a squash commit credited to the merger, so that person has no commits of their own and is silently erased. Flag any missing author by name.
- Flag any **omnibus bullet** that crams multiple distinct fixes into one line (e.g., `Stability sweep — fix A, fix B, fix C, fix D`); each distinct fix should be its own bullet.
- For closed and in-flight issues, confirm attribution was done by cross-referencing the issue number against PR/commit data — flag any issue attributed solely on the basis of its assignee.

## Completeness criteria

A draft is complete when:
- Every author's largest shipped work appears — no top-3-by-scale merged PR is unrepresented.
- Every author with merged PRs has a section, including PR-only authors with no commits.
- Every author's bullet count sits in the band for their merged-PR volume.
- Every distinct subsystem touched is represented at least once per author.
- Every shipped PR (merged in the window) is reflected — either as its own bullet or rolled into a coherent themed bullet.
- Every closed or in-flight issue is attributed to the correct author based on PR/commit linkage, not just its assignee.

## What is missing vs. what is fine

Missing (flag it):
- Author landed 8 PRs across `auth`, `billing`, `ingest`; draft only mentions auth.
- The author's largest PR of the week — 210 files, 36k lines, a subsystem moved onto new infrastructure — has no bullet, while a 40-line test fix does.
- Author merged 60 PRs and the section has 6 bullets.
- `[DK]` authored 3 merged PRs in the index but has no section at all.
- A bullet says "Stability sweep — fixed null deref, retry storm, and OOM in worker"; that's 3 distinct fixes crammed into one line.
- Issue #345 shown under [AB] but the only commits/PRs touching it are by [CD].

Fine (do not flag):
- Trivial commits (typo fixes, lockfile bumps, merge commits) folded into a single bullet or omitted.
- Two related fixes in the same file unified as one bullet (e.g., "Fixed two null derefs in upload handler").
- An author with only 1-2 merged PRs represented by 1 bullet.
- A multi-PR feature represented as a single forward-looking bullet.
- A large PR that is genuinely mechanical (a repo-wide rename, a lockfile regen) left out — scale alone does not earn a bullet.

## Output Schema

Return JSON: `{ "ok": <bool>, "problems": [<string>, ...] }`.

`ok=true` if nothing substantial is missing AND no omnibus bullets AND attribution is sound. Otherwise list the gaps in `problems` — one concrete, actionable item per entry (e.g., `"[AB] missing billing subsystem work — see PRs #421, #427"`).
