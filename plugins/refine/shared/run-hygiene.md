# Shared run conventions

Applies to `/refine:code-cleanup`, `/refine:freshen-docs`, and `/refine:simplify`. Each skill's own exit checklist names the items that apply to it.

## Detect the project's commands

Do not assume a toolchain. Before a fix run, look for the project's own test, lint, and build
commands, in this order, and use the first source that defines them:

1. `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING*`, or the README's development section
2. Task runners: `Makefile`, `justfile`, `Taskfile.yml`, `package.json` `scripts`
   (with the lockfile's package manager: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn,
   `bun.lock*` → bun, else npm)
3. Language manifests: `pyproject.toml` / `tox.ini` / `noxfile.py`, `Cargo.toml`, `go.mod`,
   `build.gradle*` / `pom.xml`, `*.csproj`, `mix.exs`, `Gemfile`, `Package.swift`
4. CI config (`.github/workflows/*`, `.gitlab-ci.yml`, `.circleci/`, `Jenkinsfile`, and similar):
   copy the command CI runs rather than guessing one

Prefer the narrowest command that covers the touched files (one package, one test file) over
the full suite. If no command is found, say so in the report and skip that gate. Do not
install a tool to make a gate run.

## Git and non-git targets

- **In a git repo:** resolve the root with `git rev-parse --show-toplevel` and pin it as the
  workflow's `worktree` argument (absolute path). Diff-based scope (`git diff --name-only`,
  `git diff --shortstat`) is available.
- **Outside git:** there is no diff and no worktree. Use the paths the user named, else the
  current directory, and state that assumption in the report. Before any fix-mode edit, copy each file it touches into the run's temp dir so that it
  can be restored, and pass that dir as the workflow's snapshot or backup argument.

Never create a worktree, branch, stash, or commit unless the user asked for one. When the
user did ask for an isolated worktree, record its path and branch name, because the exit
checklist removes them.

## Temp dir

Make one temp dir per run and keep every scratch file in it (snapshots, backups, prose-fallback
handoff files):

```bash
RUN_DIR=$(mktemp -d "${TMPDIR:-/tmp}/refine-<skill>.XXXXXX") && echo "$RUN_DIR"
```

Bash calls do not share a shell, so a `trap 'rm -rf "$RUN_DIR"' EXIT` protects only a script
that runs in one call. Remember the printed path and remove it in the exit checklist. Keep it
only while a revert may still need it, and say so if you do keep it.

## Fix-mode hygiene

A fix run leaves only its intended edits in the working tree.

1. Before launch, record the baseline: `git status --porcelain=v1 --untracked-files=all`,
   `git stash list | wc -l`, `git rev-parse HEAD`, and `git branch --list | wc -l`.
2. After the run, compare against it:
   - A new untracked file is kept only if it is an intended edit (for example a helper that a
     reported fix extracted). Delete any other file: logs, `*.orig`, `*.bak`, editor swap files,
     test scratch.
   - A new stash, commit, or branch is a defect. Report it, and undo it only if the run made it.
   - A file that was already dirty before the run is the user's work. Never reset or check it
     out from git.
3. Run the detected test or lint command over the touched files, and report pass, fail, or
   "no command found".

Clean only what this run created. Files, branches, and worktrees that existed before the run
stay as they are.

## Report location

Print the summary in the reply. Write a report file only to a path the user gave. Never leave a
report, ledger, or JSON dump in the repo.

## Spawning

A teammate (your system prompt names a team lead) or a forked worker cannot spawn agents. Run
every role inline, in order, in this context, with the same prompts, and do not try a spawn
first. When you spawn, never pass `name` to `Agent` (a named spawn makes a teammate). Keep at
most 20 subagents running in the session. On "Concurrent subagent limit reached", do not retry:
start the rest as running agents finish.

Tell every agent the maximum size of its report (the workflow schemas set this for you; in the
prose fallback, add "return at most N findings, one line each" to the prompt).

## Stopping

On finish, abort, or a user interrupt, stop every subagent or workflow run that this skill
started and that is still running: `TaskStop({ task_id })`. A stopped workflow does not clean up
after itself, so run the exit checklist after you stop it.
