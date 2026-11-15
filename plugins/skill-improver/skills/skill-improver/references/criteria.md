# Review criteria

Back to [SKILL.md](../SKILL.md). Defaults mirror a cost-gated marketplace (a CLAUDE.md
"Cost" and "Autonomy" policy plus a `check-cost.mjs` gate). A repo's own rules override
them.

## Why the two budgets differ

- **The description is billed every session**, in every conversation, whether the skill
  fires or not. Treat it as routing metadata: the trigger phrases a user would type, the
  job in a few words, and an arrow to the neighbor skill it is most often confused with.
  Detail, rules, and examples belong in the body. Default budget 350 characters.
- **The body is billed per invocation**, in full, the moment the skill fires. Anything
  inlined is charged to every caller who did not need it. Default budget 500 lines; the
  tail goes to `references/`.

## Frontmatter

| Key | Notes |
|---|---|
| `name` | Required in practice; match the directory name. |
| `description` | A plain (unquoted) value must not contain `: `, and a value that opens with a quote must close it at the end (`"Foo" bar` is invalid); quote the whole value or rephrase. |
| `effort` | Set it explicitly. `low` for lookup, reference, formatting; `medium` as the written-out default; `high` for review, audit, debugging judgment. `xhigh`/`max` need a measured reason. |
| `model`, `context`, `agent`, `background` | Real levers. Forking (`context: fork`) suits skills that read a lot and report a little. |
| `argument-hint`, `user-invocable`, `allowed-tools` | Optional. If `allowed-tools` is present it must cover every tool the body uses and name only real tools. |
| `references` | Not a recognized key. A file listed only here ships and is never loaded. Link it from the body. |

When a skill body has no `$ARGUMENTS`, Claude Code appends what was typed after the
slash command as `ARGUMENTS: <text>`. Place `$ARGUMENTS` explicitly only when the
arguments belong at a specific point in the body.

## Structure

- Decision procedure in the body; lookup tables, endpoint catalogs, long prompt
  templates, and worked examples in `references/<topic>.md`.
- Every reference has a Markdown link from the step that needs it, every link resolves,
  and every shipped `.md` is reachable transitively from SKILL.md.
- Scripts the plugin ships are invoked through `${CLAUDE_PLUGIN_ROOT}`, never an absolute
  home-directory path. Scripts print the derived answer, not raw data to be summarized.
- Cross-references name skills as they exist now (`/plugin:skill`). A stale name sends
  the model looking for something that is not there.

## Autonomy

Skills act, then report.

- No approval gates: "confirm before", "offer to", "keep or edit?", "ask the user
  which...". The skill does the work its task implies and ends with a report.
- Never ask for what can be discovered: rosters from teams or git authors, windows from
  the request or a default, context from git, the issue tracker, and local notes. State
  defaults in an Assumptions list.
- Interview-shaped skills draft the full artifact with `TODO:` markers and batch
  follow-up questions at the end.
- Asking is legitimate in two cases only: the request is ambiguous in a way that would
  produce materially different work, or the action is irreversible and destroys data the
  task did not ask to destroy.
- Refusals and method discipline (root cause before fix, failing test first) are not
  gates; keep them.
- Opt-in `--dry-run` / `--report` flags are fine, never the default.

## Prompt anti-patterns

Frontier models take these literally and bill for them. Rewrite, do not just delete: a
real caveat survives as a plain sentence ("This deletes the folder and cannot be undone").

| Pattern | Problem | Fix |
|---|---|---|
| All-caps emphasis labels followed by a colon or `!` | Buys extra tool calls, no accuracy | Plain prose |
| Thoroughness boosters (telling the model to be as exhaustive as possible) | Reads as "spend more tokens" | State the actual scope |
| Re-check rituals (asking the model to verify its finished work again) | Duplicates work | Name the one concrete check, if any |
| Reasoning scaffolds, scratchpad tags, requests to print the reasoning | Stacks on native thinking; visible-reasoning requests can be declined | Remove; tune `effort:` instead |
| Motivational preamble ("You are an incredibly skilled...") | Wasted tokens | Start with what to do |
| Few-shot examples tuned to an old model's failure modes | Taken literally | Remove or move to references |
| Contradictory rules | Measurably degrades a literal model | Pick one, state the exception once |

## Cost and output

- **Bound every read.** `--limit`, `--json <fields>`, `--jq`, `head`, `--tail`, or a
  script that prints the answer. "Run `gh pr diff` and review it" bills the whole diff.
- **Byte-stable prefix.** No timestamps, run IDs, or shuffled lists in repeated text.
- **Do not block past the cache TTL.** Prefer several short agents over one that blocks
  for ten minutes.
- **Fan-out.** Four or more parallel agents needs a model knob (a flag such as
  `--model sonnet`) and a stated cost tradeoff. Scale the fleet to the input (zero agents
  for a clean case). Never fan out to read files; one agent reading ten files beats ten
  agents reading one. Tell each agent how long its report may be. Give the fan-out a time
  budget.
- **Mark fetched text as data.** Slack, tracker, wiki, or PR text handed to a subagent is
  wrapped as data, never instruction.

## Effectiveness

- An agent following the text could not reasonably do the wrong thing.
- Constraints are explicit: read-only stays read-only, scope limits are stated.
- Output format is specified when a person or another agent consumes it.
- Unhappy paths are covered: empty input, a thousand files, a failing tool, input that
  does not match assumptions.
- Modes are handled: file vs directory, single item vs batch, whatever inputs the
  `argument-hint` promises.
- Loops state their exit condition as a checklist, cap self-continuations on one item at
  two or three, and never finish while a background job is still running.
- Templates interpolated twice escape their variables (`${}` inside a prompt template
  that is itself substituted).

## Evals

In a marketplace that gates on evals, a new or changed skill ships with:

- a task-shaped routing case with a `tool_used: Skill` grader whose `input_match` names
  the skill, paired with a scored `regex` or `llm` grader on the outcome;
- a negative case, phrasing near the skill's territory that must fire nothing
  (`tool_used: Skill`, `min: 0`, `max: 0`);
- knowledge or behavior cases aimed at what the skill supplies that the base model gets
  wrong, not at what any competent model says anyway;
- a `cleanup` case if the skill creates temporary state.

Every `llm` grader carries the sandbox paragraph ahead of its criteria, regexes grade
`last_message` and never `target: trace`, and no case grants `Agent`.

## Versioning

Bump `version` in `plugin.json` for any change to a skill or plugin; clients use it to
detect updates.
