#!/usr/bin/env bash
# pr-watch.sh — block until a PR needs attention, then exit.
#
# Usage: pr-watch.sh <pr-number|pr-url> [--repo owner/name] [--since YYYY-MM-DDTHH:MM:SSZ]
#                    [--interval SEC] [--timeout SEC] [--ignore login,login]
#
# Returns when any of these happens, printing one line per event and a final
# RESULT line:
#   - a check fails or is cancelled                         exit 1
#   - new review feedback arrives after --since              exit 2
#     (inline thread comments, reviews with a body or CHANGES_REQUESTED,
#     top-level PR comments; --ignore logins and bot PR comments
#     ignored)
#   - every check is terminal and none failed               exit 0
#   - the PR is merged or closed                             exit 3
#   - --timeout elapses (default 6900 s, under the 2 h       exit 4
#     background limit) — re-run to keep watching
#   - gh keeps failing (10 polls in a row)                   exit 5
#   - bad arguments                                          exit 64
#
# Run it with run_in_background and wait for the notification; it replaces
# sleep-polling, which lets the prompt cache expire between turns. Polling
# here is a shell loop and costs no model turns.
set -uo pipefail

usage() { sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 64; }
need() { [ -n "${2:-}" ] || { echo "pr-watch: $1 needs a value" >&2; usage; }; }

PR=""
REPO=""
SINCE=""
INTERVAL=45
TIMEOUT=6900
IGNORE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) need "$@"; REPO="$2"; shift 2 ;;
    --since) need "$@"; SINCE="$2"; shift 2 ;;
    --interval) need "$@"; INTERVAL="$2"; shift 2 ;;
    --timeout) need "$@"; TIMEOUT="$2"; shift 2 ;;
    --ignore) need "$@"; IGNORE="$IGNORE,$2"; shift 2 ;;
    -h|--help) usage ;;
    -*) echo "pr-watch: unknown flag $1" >&2; usage ;;
    *)
      [ -z "$PR" ] || usage
      # https://<host>/<owner>/<repo>/pull/<n> carries the repo too
      if [[ "$1" =~ ^https?://[^/]+/([^/]+/[^/]+)/pull/([0-9]+) ]]; then
        URL_REPO="${BASH_REMATCH[1]}"; PR="${BASH_REMATCH[2]}"
      else
        PR="$1"
      fi
      shift ;;
  esac
done
case "$PR" in ''|*[!0-9]*) echo "pr-watch: need a PR number or URL" >&2; usage ;; esac
case "$INTERVAL$TIMEOUT" in *[!0-9]*) echo "pr-watch: --interval/--timeout take seconds" >&2; usage ;; esac
if [ -n "$SINCE" ] && ! [[ "$SINCE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]; then
  echo "pr-watch: --since must be UTC, like 2026-10-03T17:00:00Z" >&2; usage
fi
[ -n "$REPO" ] || REPO="${URL_REPO:-}"

# Run a command with a hard time limit; gh can hang on a stalled TLS handshake.
limit() { local secs="$1"; shift; perl -e 'alarm shift; exec @ARGV or exit 127' "$secs" "$@"; }
say() { echo "$(date +%H:%M:%S) $*"; }

if [ -z "$REPO" ]; then
  REPO="$(limit 60 gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)" \
    || { echo "pr-watch: cannot resolve the repo; pass --repo owner/name" >&2; exit 64; }
fi
OWNER="${REPO%%/*}"
NAME="${REPO#*/}"
[ -n "$SINCE" ] || SINCE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

STATE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pr-watch.XXXXXX")"
trap 'rm -rf "$STATE_DIR"' EXIT
SEEN="$STATE_DIR/seen"      # event keys already printed
: >"$SEEN"

seen() { grep -Fxq "$1" "$SEEN"; }
mark() { echo "$1" >>"$SEEN"; }

# One GraphQL call: PR state, head, and every feedback source.
FEEDBACK_QUERY='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){
  state headRefOid
  reviewThreads(last:100){nodes{isResolved path comments(last:30){nodes{author{login __typename} createdAt url body}}}}
  reviews(last:100){nodes{author{login __typename} state submittedAt url body}}
  comments(last:100){nodes{author{login __typename} createdAt url body}}}}}'

# jq: new feedback after $since as "kind<TAB>login<TAB>url". Reviews and
# thread comments from AI reviewers count, even from bot accounts; top-level
# comments from bot accounts are CI status noise.
FEEDBACK_JQ='
  def login: .author.login // "ghost";
  def ignored: (login as $l | $ignore | index($l)) != null;
  def bot: .author.__typename == "Bot" or (login | endswith("[bot]"));
  .data.repository.pullRequest as $p
  | ( [ $p.reviewThreads.nodes[] | select(.isResolved | not) | .comments.nodes[]
        | select(.createdAt > $since and (ignored | not)) | ["thread", login, .url] ]
    + [ $p.reviews.nodes[]
        | select(.submittedAt != null and .submittedAt > $since and (ignored | not))
        | select(.state == "CHANGES_REQUESTED" or ((.state == "COMMENTED" or .state == "APPROVED") and (.body // "") != ""))
        | ["review:" + (.state | ascii_downcase), login, .url] ]
    + [ $p.reviews.nodes[]
        | select(.submittedAt != null and .submittedAt > $since and .state == "APPROVED" and (.body // "") == "" and (ignored | not))
        | ["approved", login, .url] ]
    + [ $p.comments.nodes[] | select(.createdAt > $since and (ignored or bot | not)) | ["comment", login, .url] ]
    )[] | @tsv'

START="$(date +%s)"
HEAD=""
GH_FAILS=0
NO_CHECK_POLLS=0
say "watching $REPO#$PR (feedback since $SINCE, every ${INTERVAL}s, timeout ${TIMEOUT}s)"

finish() {
  local result="$1" code="$2"
  echo "RESULT: $result — passed=${N_PASS:-0} failed=${N_FAIL:-0} pending=${N_PEND:-0} feedback=${N_FB:-0} elapsed=$(( $(date +%s) - START ))s"
  exit "$code"
}

while :; do
  if [ $(( $(date +%s) - START )) -ge "$TIMEOUT" ]; then finish timeout 4; fi

  FB_JSON="$(limit 60 gh api graphql -f query="$FEEDBACK_QUERY" -f o="$OWNER" -f r="$NAME" -F n="$PR" 2>/dev/null)"
  # gh pr checks exits non-zero for pending/failing checks, so judge it by its
  # output: a JSON array, or "no checks reported" on stderr. Anything else is a
  # failed call, never "no checks".
  CHECKS="$(limit 60 gh pr checks "$PR" --repo "$REPO" --json name,bucket,link 2>"$STATE_DIR/checks.err")"
  if echo "$CHECKS" | jq -e 'type == "array"' >/dev/null 2>&1; then :
  elif grep -qi 'no checks reported' "$STATE_DIR/checks.err"; then CHECKS='[]'
  else CHECKS=""
  fi
  if [ -z "$CHECKS" ] || [ -z "$FB_JSON" ] || ! echo "$FB_JSON" | jq -e '.data.repository.pullRequest' >/dev/null 2>&1; then
    GH_FAILS=$((GH_FAILS + 1))
    [ "$GH_FAILS" -ge 10 ] && { say "error gh failed 10 polls in a row"; finish error 5; }
    sleep "$INTERVAL"; continue
  fi
  GH_FAILS=0

  PR_STATE="$(echo "$FB_JSON" | jq -r '.data.repository.pullRequest.state')"
  NEW_HEAD="$(echo "$FB_JSON" | jq -r '.data.repository.pullRequest.headRefOid')"
  if [ "$PR_STATE" = MERGED ] || [ "$PR_STATE" = CLOSED ]; then
    ended="$(echo "$PR_STATE" | tr 'A-Z' 'a-z')"
    say "pr $ended"; finish "$ended" 3
  fi
  if [ "$NEW_HEAD" != "$HEAD" ]; then
    [ -n "$HEAD" ] && say "head moved to ${NEW_HEAD:0:9}; check states reset"
    HEAD="$NEW_HEAD"
    grep -v '^check ' "$SEEN" >"$SEEN.tmp"; mv "$SEEN.tmp" "$SEEN"
  fi

  # ---- feedback ----
  N_FB=0
  while IFS=$'\t' read -r kind login url; do
    [ -n "$kind" ] || continue
    seen "fb $url" || { mark "fb $url"; say "$kind $login $url"; }
    [ "$kind" = approved ] || N_FB=$((N_FB + 1))
  done < <(echo "$FB_JSON" | jq -r --arg since "$SINCE" --argjson ignore "$(echo "$IGNORE" | jq -R 'split(",")')" "$FEEDBACK_JQ" 2>/dev/null)

  # ---- checks ----
  N_PASS=0; N_FAIL=0; N_PEND=0
  if [ "$CHECKS" != '[]' ]; then
    NO_CHECK_POLLS=0
    while IFS=$'\t' read -r name bucket link; do
      state="$bucket"
      case "$state" in
        pass|skipping) N_PASS=$((N_PASS + 1)); seen "check $name" || { mark "check $name"; say "check-pass $name"; } ;;
        fail|cancel) N_FAIL=$((N_FAIL + 1)); seen "check $name" || { mark "check $name"; say "check-$state $name $link"; } ;;
        *) N_PEND=$((N_PEND + 1)) ;;
      esac
    done < <(echo "$CHECKS" | jq -r '.[] | [.name, .bucket, (.link // "")] | @tsv')
  else
    NO_CHECK_POLLS=$((NO_CHECK_POLLS + 1))
  fi

  if [ "$N_FAIL" -gt 0 ]; then finish failed 1; fi
  if [ "$N_FB" -gt 0 ]; then finish feedback 2; fi
  if [ "$N_PEND" -eq 0 ] && [ "$N_PASS" -gt 0 ]; then finish green 0; fi
  # A PR with no checks at all after ~5 polls is as green as it will get.
  if [ "$NO_CHECK_POLLS" -ge 5 ]; then say "no checks reported"; finish green 0; fi
  sleep "$INTERVAL"
done
