#!/bin/sh
# SessionStart: warn when the openspec CLI is missing or not the pinned version.
# Prints one line with the install command and always exits 0. It never installs
# anything and never blocks the session. The pin is ../openspec-version.
root="${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/..}"
pin="$(tr -d '[:space:]' <"$root/openspec-version" 2>/dev/null)"
[ -n "$pin" ] || exit 0

have="$(OPENSPEC_TELEMETRY=0 openspec --version 2>/dev/null | head -n 1 | tr -cd '0-9A-Za-z.+-')"
[ "$have" = "$pin" ] && exit 0

fix="npm install -g @fission-ai/openspec@$pin"
if [ -z "$have" ]; then
  msg="openspec plugin: the openspec CLI is not on PATH. Install it: $fix"
else
  msg="openspec plugin: openspec CLI is $have, the plugin needs $pin. Run: $fix"
fi
printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$msg" "$msg"
exit 0
