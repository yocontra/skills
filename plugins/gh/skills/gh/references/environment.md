# Detect the environment

Every gh skill reads these facts from the repo instead of assuming them. Run what the
step needs, once, and reuse the values. Each command prints a few lines at most.

## Host

```bash
gh auth status 2>&1 | head -20                        # every host you are logged in to, and the active account
gh repo view --json url -q .url                       # the host this checkout talks to
```

`gh` picks the host from the current repo's remote. Outside a repo it uses `GH_HOST`,
else github.com. On GitHub Enterprise Server pass `--hostname <host>` to `gh auth` and
`gh api` when you are not inside a clone, and `GH_ENTERPRISE_TOKEN` (not `GH_TOKEN`)
carries a token for it. See [auth.md](auth.md).

## Repo, fork, and remotes

```bash
gh repo view --json nameWithOwner,isFork,parent,viewerPermission \
  -q '"\(.nameWithOwner) fork=\(.isFork) parent=\(.parent.owner.login // "")/\(.parent.name // "") perm=\(.viewerPermission)"'
git remote -v | awk '$3 == "(push)"'
```

| Situation | Push to | Open the PR with |
|---|---|---|
| You can push to the repo (`perm` is WRITE, MAINTAIN or ADMIN) | `origin` | `gh pr create` |
| `origin` is your fork, `upstream` is the real repo | `origin` | `gh pr create --repo <upstream owner/name> --head <you>:<branch>` |
| `origin` is the real repo and you cannot push | a fork: `gh repo fork --remote --remote-name fork`, then push there | `gh pr create --repo <owner/name> --head <you>:<branch>` |

Which remote is "upstream" is whatever points at the repo PRs merge into. Name it by
URL, not by the remote's name: some people call their fork `origin`, others `fork`.
`gh repo set-default` decides which repo bare `gh pr` commands target when there are
several; check it with `gh repo set-default --view`.

## Default and base branch

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name          # the repo's default branch
gh pr view --json baseRefName -q .baseRefName 2>/dev/null               # this branch's PR base, if a PR exists
git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null           # offline fallback; `git remote set-head origin --auto` fixes a missing one
```

A PR's base wins over the default branch. Never hard-code `main`. For a fork, diff and
rebase against the upstream remote's copy of the base (`upstream/<base>`), not the fork's,
which is often stale.

## CI

```bash
gh pr checks <pr> --json name,bucket,link -q '.[] | "\(.bucket)\t\(.name)"' | head -50
ls .github/workflows 2>/dev/null | head                                  # GitHub Actions, if any
```

Whatever reports a status check is the CI, Actions or an external system. Read Actions
logs with `gh run view <id> --log-failed | tail -200`; for an external check, follow its
`link`. A repo with no checks at all is valid: `pr-watch.sh` reports it green after a few
polls.

## PR conventions

```bash
ls .github/pull_request_template.md .github/PULL_REQUEST_TEMPLATE.md docs/pull_request_template.md \
   pull_request_template.md .github/PULL_REQUEST_TEMPLATE/ 2>/dev/null
ls CONTRIBUTING.md .github/CONTRIBUTING.md docs/CONTRIBUTING.md 2>/dev/null
gh pr list --state all --limit 10 --json number,isDraft,title,labels \
  -q '.[] | "\(.number) draft=\(.isDraft) \(.title[:60]) [\([.labels[].name] | join(","))]"'
gh label list --limit 100 --json name -q '.[].name'
gh repo view --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed,deleteBranchOnMerge
```

- **Template**: when one exists, the PR body fills its sections in order. Several
  templates in `PULL_REQUEST_TEMPLATE/`: pick the one that matches the change.
- **CONTRIBUTING**: read only the sections on PRs, commits, and tests. It settles
  title format (Conventional Commits, tracker prefix), sign-off (`git commit -s` when
  DCO is required), draft policy, and changelog rules.
- **Draft vs ready**: the user's request first, then CONTRIBUTING, then what most of the
  recent PRs did. Neither says anything: ready.
- **Labels**: only apply a label that `gh label list` shows. Creating labels is the
  maintainers' call, not a skill's.
- **Merge method**: use one the repo allows. `deleteBranchOnMerge=true` means the remote
  branch goes away on merge, so only the local branch is left to clean up.
