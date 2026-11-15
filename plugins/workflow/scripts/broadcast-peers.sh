#!/usr/bin/env bash
# broadcast-peers.sh — one line per live local Claude Code session:
#   name | status | repo | AI title | last user prompt | recent PRs
# Reads ~/.claude/sessions/*.json and each session's transcript. Never contacts the peer.
# Prints nothing when no other session is running; one line when jq is missing.
set -uo pipefail
shopt -s nullglob

command -v jq >/dev/null 2>&1 || { echo "broadcast-peers: jq is not installed; peer summaries are unavailable (ListAgents still works)"; exit 0; }

for f in "$HOME"/.claude/sessions/*.json; do
  pid=$(jq -r '.pid // empty' "$f" 2>/dev/null) || continue
  [[ -n $pid ]] && kill -0 "$pid" 2>/dev/null || continue
  IFS=$'\t' read -r name status cwd sid < <(jq -r '[.name // "-", .status // "-", .cwd // "", .sessionId // ""] | @tsv' "$f" 2>/dev/null) || continue
  # A worktree's folder name is not the project: use the main checkout's name when git knows it.
  common=$(git -C "$cwd" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) && repo=$(basename "$(dirname "$common")") || repo=${cwd##*/}
  t="$HOME/.claude/projects/${cwd//[^a-zA-Z0-9]/-}/$sid.jsonl"   # Claude Code maps every non-alphanumeric to -
  title="-"; prompt="-"; prs="-"
  if [[ -f $t ]]; then
    title=$(jq -r 'select(.type=="ai-title") | .aiTitle' "$t" 2>/dev/null | tail -1)
    # Skip prompts that are peer messages; we want what the user last asked.
    prompt=$(jq -r 'select(.type=="last-prompt" and (.lastPrompt | type=="string") and (.lastPrompt | startswith("Another Claude session") | not)) | .lastPrompt | gsub("\\s+"; " ")' "$t" 2>/dev/null | tail -1 | cut -c1-120)
    prs=$(jq -r 'select(.type=="pr-link") | "\(.prRepository | split("/")[1])#\(.prNumber)"' "$t" 2>/dev/null | awk '!seen[$0]++' | tail -3 | paste -sd, -)
  fi
  printf '%s | %s | %s | %s | %s | %s\n' "$name" "$status" "${repo:--}" "${title:--}" "${prompt:--}" "${prs:--}"
done
