---
name: "setup"
description: "Set up this repo for OpenSpec planning and convert its existing plans into OpenSpec changes"
allowed-tools: Bash(openspec:*)
effort: medium
category: "Workflow"
tags: ["workflow", "setup", "migration"]
---

Switch this repo to OpenSpec planning with the smallest footprint, then migrate its existing plans into `openspec/changes/`. Work through the steps in order and keep the exit checklist at the end current as you go.

## 1. CLI

Read the pinned version from `${CLAUDE_PLUGIN_ROOT}/openspec-version` and compare it with `openspec --version`. If `openspec` is missing or at a different version, install the pin with `npm install -g @fission-ai/openspec@<pin>` (the public npm package), check the version again, and say so in the report. If the install fails, stop and give the user that command as the blocker.

## 2. Settings and structure

Write `.claude/settings.json` before anything else. Outside bypass mode the harness may prompt for this write; that prompt is the harness's, so do not ask for it yourself. If the file already has these keys, skip the write. Otherwise merge them in, creating the file if it is missing and keeping every existing key:

```json
{
  "extraKnownMarketplaces": {
    "skills": { "source": { "source": "github", "repo": "yocontra/skills" } }
  },
  "enabledPlugins": { "openspec@skills": true },
  "permissions": { "allow": ["Bash(openspec:*)"] },
  "env": { "OPENSPEC_TELEMETRY": "0" }
}
```

Run `git check-ignore -v .claude/settings.json`. If git ignores the file, tell the user which rule ignores it, and stage that one file with `git add -f .claude/settings.json`: project settings are meant to be shared.

If `openspec/` does not exist yet, run `openspec init --tools none`. Never run `openspec init --tools claude`: it copies skills and commands into the repo, and this plugin exists so that the repo does not carry them. Then:

- Replace `openspec/config.yaml` with the single line `schema: spec-driven-tested`. Keep the file: without it, `openspec new change` writes the full template back. That schema is `spec-driven` plus a `test-plan` artifact, and this plugin's SessionStart hook installs it in the user schema dir.
- If the repo already has changes, also set `schema: spec-driven-tested` in the `.openspec.yaml` of each active change under `openspec/changes/`, but not under `openspec/changes/archive/`, which stays as it shipped. Each change pins its own schema, so `config.yaml` alone does not reach them. Run `openspec status --change <slug>` for each one and confirm that it lists `test-plan`.
- Delete `openspec/specs/.gitkeep` and `openspec/changes/archive/.gitkeep` if init created them. The CLI creates those directories when it needs them.
- Add no new text to CLAUDE.md or the docs.

## 3. Find plans

Look in `.claude/plans/`, `docs/plans/` and `plans/`, and for design, RFC or plan markdown elsewhere. A plan proposes work that is not done yet and has an end state. Convert plans only; leave living docs, which describe the current system and change with it. Keep only the files that `git ls-files` lists. Record untracked and ignored plan files separately, with every place that links to them. Convert the tracked plans without waiting for confirmation, and put both lists in the report.

## 4. Convert

For each tracked plan, run `openspec new change <slug>`, reusing the plan's file name as the slug, and record the slug as created by this run. Then run `openspec instructions <artifact> --change <slug> --json` for proposal, specs, design, test-plan and tasks, and write each artifact.

- This is a migration, not a summary. Keep the plan's wording. Every decision, rationale, rejected alternative, path, measurement, date, snippet, table and caveat goes into the change, mostly into design.md and tasks.md. Put material that fits no section under `## Appendix: <topic>` in design.md.
- Convert every line reference (`path:123`, "lines 12–30") to the file path, plus the command or test file that shows the point where it needs one. Never a line number or method name: both drift. Line counts such as "a 2,834-line file" are measurements and stay.
- Keep the plan's own numbering (§1, §2a, PR-0) in the tasks.md group headings and the design.md headings, for example `## 3. §3 Title`, so references to those numbers still resolve.
- Apart from the test plan below, add nothing the plan does not say: no new tasks, requirements, risks, open questions, rollback plans or verification steps. Where the plan contradicts itself or cites a rule that no longer holds, write a short `Migration note:` and leave the choice to a human.
- Write `test-plan.md` with one row for each spec scenario, plus rows for the surfaces the plan touches. Move any E2E or test matrix the plan already has into it, and keep no copy in design.md. Each row names the end-to-end or integration test in this repo that verifies it, existing or to be written; make a row manual-only only when automation cannot reach it, with the reason and the steps. Every row starts at ❌. In the task group whose work each row verifies, add a task that writes or extends its in-repo test, unless it is manual-only, and a task that runs its check by hand on the real system. Give each existing change that step 2 switched a `test-plan.md` and its tasks the same way; step 5 audits them with the rest.
- Set `skip_specs: true` in the change's `.openspec.yaml` and write no requirements for any plan that changes no behavior in this repo: refactors, tooling, docs, and requests to another team or project.
- The slugs are known up front, because they are the plan file names. Rewrite every link to another plan as `openspec/changes/<slug>/` immediately, whether or not that change exists yet.
- If the plan's work is in progress on another branch, compare the two copies' last commits (`git log -1 --format=%cI <branch> -- <plan.md>`), convert the newer one, and name the copy you chose in the report.
- `openspec validate <slug> --strict` must pass.
- Run `python3 -I "${CLAUDE_PLUGIN_ROOT}/scripts/plan_coverage.py" <plan.md> openspec/changes/<slug> | head -n 200`. It matches line by line, so restructured headings, rewrapped lines and rewritten links always show up as misses. Check each listed line for its facts, and restore only facts the change does not contain. Never append the plan's full text, or any large verbatim copy of it, to shorten the list: that duplicates the plan and undoes the structure.
- Then, before step 5, do a separate verifier pass over each change that removes anything the plan did not say, other than the test plan and its tasks. Step 5 annotations (the status line and the `— done in #<PR>` notes) are not converter additions: never remove them.

For more than a few plans, assign the slugs to subagents before they start, a few plans each, balanced by size. Each subagent edits only its assigned change directories and does not delegate further. When they finish, `git grep` for the old plan paths and fix any link that still uses one.

If the user drops a plan after reading the report, delete that change directory (`rm -rf openspec/changes/<slug>`), but only for a slug this run created. Never delete a change that existed before setup started.

## 5. Audit status against the code

Do not trust the plan's status claims, including its ticks and any prose self-audit such as "§1 done, §2 open". For each task, find the code, test or doc on the current default branch, and the PR that landed it. Search the pull requests of the repo that the default branch's remote points at (`gh repo view --json nameWithOwner`, or the `origin` URL), not a fork, and bound each search (`gh pr list --search <terms> --state all --limit 20 --json number,title,state`). Mark each task with one of these:

- Done: `- [x] <task> — done in #<PR>`
- Partly done: leave it `[ ]` and add `— partly done in #<PR>: <what>; open: <what>`
- Obsolete: `- [x] <task> — obsolete: <reason>`
- Not done: leave it unchanged.

Set each `test-plan.md` row that the audit finds verified on the default branch: ✅ with the test path when that in-repo test exists and passes, 🟡 when only a manual check is on record. Leave the others at ❌.

Clear the tick on any task the plan ticked if the default branch does not contain it. Mark a task with an open PR as `in review: #<PR>`. Look for related work under different names, and check scope carefully: a cap per run is not a cap per day, but it can cover part of a task.

Make the first paragraph of Why in proposal.md `**Status (<date> audit): …**`. Relabel any status the plan gave itself as "Plan's status before the <date> audit (superseded where they differ):".

Archive each change whose tasks are all shipped with `openspec archive <slug> -y`. Then edit the new main specs wherever the shipped behavior differs from the plan.

## 6. Retire the old plans

- Run `git grep -n '<old plan dir>' -- ':!openspec/' | head -n 200` and update every hit to cite the new change. This includes code comments, skills, CLAUDE.md, and config and lint settings that excluded the old plan directory, such as pre-commit and linter excludes, docs-path checkers and their tests, code-review bot settings and `.dockerignore`. If a file is protected and you cannot edit it, stop and give the user the exact edit.
- Remove links to plan files that git does not track.
- Delete the old plan files.
- Run `openspec validate --all --strict`. It must pass.

## 7. Exit checklist

Finish only when every item is checked, or name the blocker for the open ones:

- [ ] CLI at the pinned version; `.claude/settings.json` merged; `openspec/config.yaml` is `schema: spec-driven-tested`.
- [ ] Every tracked plan converted, validated with `--strict`, coverage-checked and verifier-passed.
- [ ] Every task audited; fully shipped changes archived.
- [ ] Old plan paths retired; `openspec validate --all --strict` passes.
- [ ] Cleanup: every subagent this run started has finished or been stopped; no change directory this run created for a dropped plan is left behind; no scratch files this run wrote remain outside `openspec/`. Remove only what this run created.

## 8. Report

List the changes you created and the changes you archived, give the status of each change, and list everything that needs a human decision.
