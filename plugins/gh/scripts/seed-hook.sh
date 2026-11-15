#!/bin/bash
# PreToolUse hook: seed a linked worktree once, on the first shell or file tool
# call made in it (hooks.json matches only those tools).
#
# Claude Code creates worktrees itself (isolation: "worktree", --worktree) and
# has no hook that runs after its own creation; a WorktreeCreate hook would
# replace that creation outright. A tool call's hook input carries the cwd of
# the agent making it, which for an isolated agent is its worktree, so the
# first call there runs `worktree.py seed`. Every other call costs a few shell
# builtins: outside a worktree nothing forks, inside a seeded one it is one
# file test. The tool is never blocked: every path exits 0.

# cwd is near the start of the hook JSON (after session_id and transcript_path),
# so read only the head: bash reads a pipe a byte at a time, and a Write's input
# carries a whole file. Drain the rest, or the writer gets EPIPE.
limit=8192
IFS= read -r -d '' -n "$limit" input   # returns 1 at EOF, which is fine
[ ${#input} -ge "$limit" ] && cat >/dev/null

pattern='"cwd"[[:space:]]*:[[:space:]]*"([^"\\]*)"'
[[ $input =~ $pattern ]] || exit 0
cwd=${BASH_REMATCH[1]}

# The worktree root: the path through the last .worktrees/<name> or
# .claude/worktrees/<name> in cwd, whichever is deeper.
top=""
for dir in /.worktrees/ /.claude/worktrees/; do
    case $cwd in *"$dir"?*) ;; *) continue ;; esac
    head=${cwd%"$dir"*}$dir
    rest=${cwd#"$head"}
    candidate=$head${rest%%/*}
    [ ${#candidate} -gt ${#top} ] && top=$candidate
done
[ -n "$top" ] && [ -f "$top/.git" ] || exit 0

# A linked worktree's .git is a file: "gitdir: <path>".
read -r key gitdir < "$top/.git"
[ "$key" = "gitdir:" ] || exit 0
case $gitdir in /*) ;; *) gitdir=$top/$gitdir ;; esac
[ -e "$gitdir/gh-worktree-seeded" ] && exit 0

# worktree.py takes the seeding lock and writes the marker.
/usr/bin/python3 "${BASH_SOURCE[0]%/*}/worktree.py" seed "$top" >&2
exit 0
