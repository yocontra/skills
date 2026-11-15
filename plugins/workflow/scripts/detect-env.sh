#!/usr/bin/env bash
# detect-env.sh — print the facts go-time and bug-bash need about the current repo,
# one key=value per line, so the caller never reads raw config files.
#
#   repo            owner/name on GitHub, or empty when gh cannot see it
#   root            absolute path of the checkout
#   default_branch  from GitHub, else origin/HEAD, else main
#   merge_flag      --merge, --squash or --rebase: the first method the repo allows
#   auto_merge      true or false from GitHub; unknown when gh cannot see the repo
#   ci              github-actions, other (a CI config file exists), or none
#   openspec        yes when openspec/ exists and the openspec CLI is on PATH,
#                   dir-only when the folder exists without the CLI, else no
#   test_cmd        best guess at the full test command; empty when unknown
#   instructions    the repo instruction files that may name a different test command
#
# Usage: detect-env.sh [repo-dir]    (default: the current directory)
set -u
cd "${1:-.}" 2>/dev/null || { echo "error=not a directory: ${1:-.}"; exit 1; }
root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "error=not a git repository"; exit 1; }
cd "$root"
echo "root=$root"

# gh repo view --json has no autoMergeAllowed field (an unknown field fails the whole call),
# so read everything in one GraphQL query; {owner}/{repo} expand from the current clone.
info=$(gh api graphql -F owner='{owner}' -F name='{repo}' -f query='query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) { nameWithOwner defaultBranchRef { name }
    mergeCommitAllowed squashMergeAllowed rebaseMergeAllowed autoMergeAllowed } }' \
  --jq '.data.repository | [.nameWithOwner, .defaultBranchRef.name, (if .mergeCommitAllowed then "--merge" elif .squashMergeAllowed then "--squash" elif .rebaseMergeAllowed then "--rebase" else "" end), (.autoMergeAllowed|tostring)] | @tsv' 2>/dev/null)
IFS=$'\t' read -r repo branch merge auto <<<"$info"
if [ -z "${branch:-}" ]; then
  branch=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
fi
echo "repo=${repo:-}"
echo "default_branch=${branch:-main}"
echo "merge_flag=${merge:---merge}"
echo "auto_merge=${auto:-unknown}"

ci=none
for f in .circleci/config.yml .gitlab-ci.yml .buildkite Jenkinsfile azure-pipelines.yml .travis.yml; do [ -e "$f" ] && ci=other; done
ls .github/workflows/*.y*ml >/dev/null 2>&1 && ci=github-actions
echo "ci=$ci"

if [ -d openspec ]; then
  if command -v openspec >/dev/null 2>&1; then echo "openspec=yes"; else echo "openspec=dir-only"; fi
else echo "openspec=no"; fi

test_cmd=""
if [ -f Makefile ] && grep -qE '^test:' Makefile; then test_cmd="make test"
elif [ -f package.json ] && grep -q '"test"[[:space:]]*:' package.json; then
  if [ -f pnpm-lock.yaml ]; then test_cmd="pnpm test"
  elif [ -f yarn.lock ]; then test_cmd="yarn test"
  elif [ -f bun.lockb ] || [ -f bun.lock ]; then test_cmd="bun test"
  else test_cmd="npm test"; fi
elif [ -f Cargo.toml ]; then test_cmd="cargo test"
elif [ -f go.mod ]; then test_cmd="go test ./..."
elif [ -f pyproject.toml ] || [ -f pytest.ini ] || [ -f setup.cfg ] || [ -f tox.ini ]; then
  if [ -f uv.lock ]; then test_cmd="uv run pytest"; else test_cmd="pytest"; fi
elif [ -f Package.swift ]; then test_cmd="swift test"
elif [ -f build.gradle ] || [ -f build.gradle.kts ]; then test_cmd="./gradlew test"
elif [ -f pom.xml ]; then test_cmd="mvn test"
fi
echo "test_cmd=$test_cmd"

docs=""
for f in CLAUDE.md AGENTS.md CONTRIBUTING.md .github/CONTRIBUTING.md; do [ -f "$f" ] && docs="$docs $f"; done
echo "instructions=${docs# }"
