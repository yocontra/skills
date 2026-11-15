# House style for onboard-plan

These are the writing rules for the plan. The gathered data and the
defaults in interrogation.md supply content; this file shapes how it
lands in the doc.

## Top-level rule: every milestone is observable

A goal or milestone must be something a third party could verify. "Is
ramped on the codebase" is unobservable. "Has reviewed three PRs and
fixed one bug in the auth service" is observable.

Never write, and rewrite on sight:
- "Feels comfortable with X"
- "Understands the team's domain"
- "Has a good handle on Y"
- "Knows their way around the codebase"
- "Is contributing meaningfully"

Replace with:
- "Has shipped at least 3 commits, including 1 user-visible feature"
- "Has led a team meeting agenda once"
- "Has reviewed 5 PRs from team members"
- "Has filed and resolved their first issue"
- "Can describe the search-indexer data flow on a whiteboard"

The pattern: name a *thing* the person *did* or can *do*.

## Concrete vs vague — the role description

The Role Context section tends to attract vague prose ("we're a team
that builds infrastructure for X"). Push for specifics:

| Vague | Concrete |
|-------|----------|
| "We work on internal tools" | "We own the Foo and Bar services that handle 90% of the company's auth traffic." |
| "This role is about helping us move faster" | "This role is to take ownership of the search-indexer pipeline so I can stop being the single point of failure." |
| "They'll work across the team" | "They'll partner closely with <peer> on the billing-service migration for the first two quarters, then lead the Bar service rebuild." |

If a section reads like it could apply to any role at any company,
it's not concrete enough.

## "Why this person for this hire" rule

For peers, buddies, and mentors, never list a name without a reason.
The new hire skimming the doc on day 1 will follow up only on the
ones with clear motivation.

| Bad | Good |
|-----|------|
| "<peer 1>" | "<peer 1> — your main collaborator on the billing migration. Pair with them on their current PR." |
| "<peer 2>" | "<peer 2> — has worked on every part of the codebase you'll touch in your first month. Best person for 'how does X work?' questions." |
| "<peer 3>" | "<peer 3> — owns the billing-service migration you'll inherit. Pair with them in week 1-2." |

If the manager can't articulate why a particular person should be on
the new hire's meeting list, drop them. The list with reasons is
shorter and more useful than the list without.

## "First task" rule

Every plan names a specific first task by week 1. The task should
be:

- Small enough to ship in 1-3 days.
- Real enough to feel like a contribution (a typo fix is an
  icebreaker, not a first task).
- In the new hire's skill scope (don't hand a senior-only task to
  a mid-level hire).

Examples that work:

- "Migrate the Foo CLI from argparse to click — small refactor,
  touches the codebase, no architectural decisions needed."
- "Triage open P3 issues in the Bar component (~20 tickets). Close
  duplicates, summarize the rest in a short doc."
- "Add a `--dry-run` flag to the deploy script — small scope, real
  user benefit, exposes you to the deploy code path."

Examples that don't work:

- "Get familiar with the codebase" (not a task)
- "We'll find something" (placeholder)
- "Lead the next migration" (too big for week 1)

## Reading list rule

≤ 5 docs in the first-week reading list. Each gets a one-line
"what it gives you." The list is *prioritized*; first item is read
first. If there are more than 5 must-reads, pick the top 5 — the
new hire can ask for more after week 1.

## "Done at end of week 1" rule

3-5 observable signals that week 1 went well. These are baseline,
not stretch. Examples:

- "Has met 1:1 with their buddy and at least 3 team members"
- "Has merged at least one PR, even a doc edit"
- "Has joined the team chat channel and posted at least once"
- "Knows where the on-call schedule lives and has read it"
- "Has set up a 1:1 cadence with the manager"

A manager can check these at end of week 1 and answer yes / no.

## Honesty about pace

If the team is in crisis or heads-down ship mode, say so in Role
Context — gently but clearly. Example:

> "We're heads-down on the Foo migration through next quarter; the team's
> capacity is tight. Your ramp will overlap with our highest-pressure
> period — if you need things from the team and can't get them, flag
> it to me directly."

The new hire will figure it out in week 2 anyway.

## Don't fabricate

If the manager skipped a section, write `<TBD — assign before day 1>`,
not a guessed name. Empty placeholders are honest; fabricated content
breaks trust the moment the new hire pings the named person and gets
"who are you?" back.

## Tone

The doc is read by a nervous new hire on day 1.

- Direct ("here's what I expect"), not corporate ("we look forward
  to partnering with you on your journey")
- Warm but not gushing ("welcome — glad you're here", not "we're SO
  EXCITED to have you join the AMAZING team!")
- Confident about the role ("here's what success looks like"), not
  hedging ("we'll see how things go")

Run all prose through `humanizer`.
