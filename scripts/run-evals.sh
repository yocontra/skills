#!/usr/bin/env bash
#
# run-evals.sh — run `claude plugin eval` for one or more plugins in this repo.
#
# Usage:
#   scripts/run-evals.sh gh                        # one plugin, full suite
#   scripts/run-evals.sh gh --case open-pr-routing --runs 1 --ablation none
#   scripts/run-evals.sh --all --runs 1 --ablation none
#
# Everything after the plugin name (or --all) is passed through to
# `claude plugin eval`. Useful flags: --case <glob>, --tag <tag>, --runs <n>,
# --ablation none, -j <n>, --max-cost-usd <usd>, --json <path>.
#
# Why this wrapper exists
# -----------------------
# It checks the model API before spending anything, runs each plugin from its
# own directory, pins the judge model, and flags runs truncated by a cost cap.
# The eval children get a throwaway HOME, so they need ANTHROPIC_API_KEY (or
# ANTHROPIC_AUTH_TOKEN) in the environment rather than a stored login.

set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGINS_DIR="$REPO_ROOT/plugins"

die() { printf '\033[31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $# -gt 0 ]] || die "usage: scripts/run-evals.sh <plugin>|--all [eval flags...]"

TARGET="$1"; shift

# ------------------------------------------------------- pick the binary ----

CLAUDE_BIN="$(command -v claude || true)"
[[ -n "$CLAUDE_BIN" ]] || die "no 'claude' on PATH"

# --------------------------------------------------------- preflight -------

# A model API outage makes every run exit 1 at turn 1 with $0 spent, which in the
# report is indistinguishable from the plugin regressing on every case. One
# cheap call up front turns that into an obvious infrastructure error. This has
# already burned a full 10-case pass once.
preflight() {
  local base="${ANTHROPIC_BASE_URL:-https://api.anthropic.com}" auth code

  if [[ -n "${ANTHROPIC_AUTH_TOKEN:-}" ]]; then
    auth="authorization: Bearer ${ANTHROPIC_AUTH_TOKEN}"
  elif [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    auth="x-api-key: ${ANTHROPIC_API_KEY}"
  else
    return 0  # No credential to test; let the harness report it.
  fi

  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 \
    -X POST "${base}/v1/messages" \
    -H 'content-type: application/json' -H "$auth" -H 'anthropic-version: 2023-06-01' \
    -d '{"model":"claude-haiku-4-5-20251001","max_tokens":4,"messages":[{"role":"user","content":"hi"}]}' \
    2>/dev/null || echo 000)"
  [[ "$code" == "200" ]] && return 0
  [[ "$code" == "429" ]] && die "model API returned HTTP 429: the rate limit or the account's spend
    limit is exhausted. Wait for it to reset; nothing more was spent."
  die "model API is not answering (HTTP ${code} from ${base}).
    Every run would fail at turn 1 with \$0 spent and look like a total regression.
    Fix the endpoint or credentials and re-run; nothing was spent."
}
preflight

# --------------------------------------------------------------- run --------

run_one() {
  local plugin="$1"; shift
  local dir="$PLUGINS_DIR/$plugin"
  [[ -f "$dir/.claude-plugin/plugin.json" ]] || die "no plugin manifest at $dir/.claude-plugin/plugin.json"
  if [[ ! -d "$dir/evals" ]]; then
    printf '\033[33m[skip]\033[0m %s has no evals/\n' "$plugin"
    return 0
  fi

  # A plugin that declares an MCP server gets a mock stand-in by default, and the
  # stand-in fails to start for an HTTP-transport server whose headers come from
  # an auth helper — which aborts every case with score 0 before the agent runs.
  # `--mocks off` skips the stand-in. The real server does start, but its tools
  # stay gated behind --allow-tools, which we never pass, so the agent under test
  # cannot call it and nothing real is ever touched.
  local mock_args=()
  if [[ -f "$dir/.mcp.json" && ! -d "$dir/evals/mocks" ]]; then
    mock_args=(--mocks off)
    printf '\033[33m[note]\033[0m %s declares an MCP server with no mocks — using --mocks off (tools stay ungranted)\n' "$plugin"
  fi

  # The eval runs from inside the plugin directory, so a relative --json path
  # would resolve against it and silently nest (plugins/gh/plugins/gh/...).
  # Rewrite any relative --json argument to an absolute path first.
  local rewritten=() prev=""
  for arg in "$@"; do
    if [[ "$prev" == "--json" && "$arg" != -* && "$arg" != /* ]]; then
      rewritten+=("$PWD/$arg")
    else
      rewritten+=("$arg")
    fi
    prev="$arg"
  done

  # Pin the judge unless the caller picked one. The default judge alias
  # resolved to Opus 5.5, whose cyber safeguards decline to grade
  # security-topic answers (audit PoC), and each declined call scored as a
  # failed case. Haiku avoids that but misgrades scope
  # rubrics (refine routing went 3/8); Sonnet 5 does neither.
  local judge_args=(--judge-model claude-sonnet-5)
  for arg in ${rewritten[@]+"${rewritten[@]}"}; do
    [[ "$arg" == --judge-model* ]] && judge_args=()
  done

  printf '\n\033[1m=== %s ===\033[0m\n' "$plugin"
  local rc=0
  ( cd "$dir" && "$CLAUDE_BIN" plugin eval . --trust-plugin ${mock_args[@]+"${mock_args[@]}"} ${judge_args[@]+"${judge_args[@]}"} ${rewritten[@]+"${rewritten[@]}"} ) || rc=$?

  # A run that hits --max-cost-usd stops paying for judges and records
  # `skipped: cost ceiling` instead of a verdict. Those cases score low and read
  # exactly like a regression. This already produced a false "sre regressed"
  # report that cost a round of investigation — a truncated run is not a
  # measurement, so say so where nobody can miss it.
  local json="" prev2=""
  for arg in ${rewritten[@]+"${rewritten[@]}"}; do
    [[ "$prev2" == "--json" ]] && json="$arg"
    prev2="$arg"
  done
  if [[ -n "$json" && -f "$json" ]]; then
    node -e '
      const j = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))
      if (!j.partial) process.exit(0)
      console.error(`\n\x1b[31m[PARTIAL]\x1b[0m ${process.argv[2]}: run stopped early (${j.partialReason || "unknown"}).`)
      console.error("    Graders were skipped, so low scores here are truncation, not regression.")
      console.error("    Do not compare these numbers against a baseline. Re-run with a higher --max-cost-usd.")
      process.exit(3)
    ' "$json" "$plugin" || rc=3
  fi
  return "$rc"
}

if [[ "$TARGET" == "--all" ]]; then
  status=0
  for d in "$PLUGINS_DIR"/*/; do
    p="$(basename "$d")"
    [[ -d "$d/evals" ]] || continue
    # Re-check the API before each plugin: a spend limit that runs out
    # mid-sweep otherwise turns every later case into a $0.00 "failure".
    preflight
    run_one "$p" "$@" || status=1
  done
  exit "$status"
else
  run_one "$TARGET" "$@"
fi
