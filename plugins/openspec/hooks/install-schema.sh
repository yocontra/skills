#!/bin/sh
# SessionStart: install or refresh the plugin's spec-driven-tested schema in the
# user schema dir, where `openspec` finds it after a project's own
# openspec/schemas/ and before its built-in schemas. Copies to a temp dir and
# renames it into place. Prints nothing when the installed copy already matches
# or the install succeeds; prints one warning when it cannot write. Always
# exits 0 and never blocks the session.
name=spec-driven-tested
root="${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/..}"
src="$root/schemas/$name"
[ -f "$src/schema.yaml" ] || exit 0
dir="${XDG_DATA_HOME:-$HOME/.local/share}/openspec/schemas"
dest="$dir/$name"

diff -rq "$src" "$dest" >/dev/null 2>&1 && exit 0

tmp="$dest.tmp.$$"
old="$dest.old.$$"
# Remove the temp copy even when the hook is stopped mid-copy (SessionStart
# timeout). After a successful rename $tmp no longer exists, so this is a no-op.
trap 'rm -rf "$tmp" 2>/dev/null' EXIT
trap 'exit 0' HUP INT TERM
if mkdir -p "$dir" 2>/dev/null && cp -R "$src" "$tmp" 2>/dev/null; then
  if [ ! -e "$dest" ] || mv "$dest" "$old" 2>/dev/null; then
    if mv "$tmp" "$dest" 2>/dev/null; then
      rm -rf "$old"
      exit 0
    fi
    [ -e "$old" ] && mv "$old" "$dest" 2>/dev/null
  fi
fi

where="$(printf '%s' "$dir" | sed 's/[\\"]/\\&/g' | tr -d '\000-\037')"
msg="openspec plugin: cannot write the $name schema to $where, so openspec cannot use it. Make that directory writable."
printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$msg" "$msg"
exit 0
