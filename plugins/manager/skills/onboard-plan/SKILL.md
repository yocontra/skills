---
name: onboard-plan
effort: medium
description: 30/60/90 onboarding plan for a new hire. Drafts the full ramp plan (role, team, goals, peers, buddy, first week) from the roster, repos, docs and starter issues, marks assumptions, and batches follow-up questions at the end. Produces a Markdown plan to hand the new hire on day one.
user-invocable: true
---

$ARGUMENTS

# Onboarding plan

Help a manager produce a 30/60/90 plan for a new hire: gather what the
team's repos and roster already say, draft the whole plan with stated
defaults, then list the questions only the manager can answer. The
manager hands it over on day one and revisits it over the first 90
days.

Read these first, and load the `humanizer` skill when it is installed; the draft and the
closing questions both go through it:

| Topic | File |
|-------|------|
| Plan structure (First Week, 30 / 60 / 90, Buddy / Mentor, Resources) | [template.md](references/template.md) |
| The six areas: sources, defaults, closing questions | [interrogation.md](references/interrogation.md) |
| House style: concrete, role-aware, not aspirational | [house-style.md](references/house-style.md) |

## Step 1: Resolve the new hire and gather

Take the name (and GitHub login or start date, if given) from
`$ARGUMENTS`. With no name, write "the new hire" and keep going. A new
hire often has no accounts yet: proceed with the name.

Create a run dir for the working draft. Shell state does not persist
between Bash tool calls, so a `trap 'rm -rf "$RUN_DIR"' EXIT` only
protects a single script invocation; the exit checklist removes
`RUN_DIR` explicitly.

```bash
RUN_DIR=$(mktemp -d "${TMPDIR:-/tmp}/onboard-plan.XXXXXX"); echo "$RUN_DIR"
```

Gather everything that can be discovered, so the draft starts from
facts, not blanks. Do this inline; it is a handful of bounded calls,
not a fan-out.

- **Peers and team:** the roster per [team-list.md](../../lib/team-list.md).
- **Team repos:** where roster members merged recently —
  `gh search prs --author "$LOGIN" --merged --merged-at ">=$(date -v-90d +%F 2>/dev/null || date -d '90 days ago' +%F)" --json repository --limit 200 --jq '.[].repository.nameWithOwner' | sort | uniq -c | sort -rn | head -10`.
- **Onboarding docs:** `CONTRIBUTING.md`, `README.md`, and `docs/` in
  those repos (`gh api "repos/$R/contents/docs" --jq '.[].name' | head -30`),
  plus any wiki or folder the user names.
- **Starter work:** `gh search issues --repo "$R" --label "good first issue" --state open --json number,title,url,labels --limit 20`,
  and open issues in the milestone or project board the team is
  working toward.
- **First-week calendar and chat channels:** only if a calendar or chat
  tool is connected; otherwise use the defaults in the First Week area.

## Step 2: Draft the whole plan

Fill all six areas in [interrogation.md](references/interrogation.md)
from the gathered data. Where a source is silent, use the area's
default and say so, or leave a `TODO(manager): ...` marker where only
the manager can know. Apply [house-style.md](references/house-style.md):
every goal is observable, every peer has a reason, every milestone has
a target date. Build the plan per [template.md](references/template.md)
in `$RUN_DIR/draft.md` and run it through `humanizer`.

## Step 3: Assumptions and closing questions

After the plan, add two short lists for the manager (not part of the
plan the new hire receives):

- **Assumptions:** each default used and each fact inferred from data,
  one line each ("Buddy: Sam, the most active reviewer in api-server").
- **Open questions:** the closing batch from interrogation.md, one
  numbered list, most plan-changing first.

When the manager answers, update the affected sections, re-run
`humanizer`, and reprint them. Do not wait for answers before
delivering the draft.

## Step 4: Deliver

Show the plan in chat and copy the plan (without the manager-only
lists) to the clipboard with the first of `pbcopy`, `wl-copy`,
`xclip -selection clipboard` that exists. Save a
file only to a path the user names. The manager shares it with the new
hire in their own doc tool, ideally with edit access so the new hire
can annotate progress; do not publish or share it yourself.

Then print: new hire name and start date (if known), where the plan
went, a reminder to put 30 / 60 / 90 review meetings on the calendar
with the new hire, and last, the Assumptions and Open questions from
Step 3.

## Exit checklist

Keep this current. A text-only turn with items open is a progress
report, not the end: continue, or name the blocker.

- [ ] Plan delivered only where the user asked (chat + clipboard, or the path they named)
- [ ] `rm -rf "$RUN_DIR"` run (after copying out anything the user asked to keep)
- [ ] No draft files left in the repo or cwd (no `.tmp/` drafts); only files this run created were removed
- [ ] No subagent or background job from this run still running (TaskStop any that are)
