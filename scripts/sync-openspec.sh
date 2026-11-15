#!/usr/bin/env bash
# Regenerate plugins/openspec from the OpenSpec CLI (npm @fission-ai/openspec).
#
# Runs `openspec init --tools claude` in a scratch directory at the pinned
# version, builds the plugin's skills and commands in a staging directory, and
# only then replaces the generated files in the plugin. If the CLI output does
# not have the expected layout, or an edit below no longer applies, it fails
# before touching anything.
#
# The pin lives in plugins/openspec/openspec-version, which the plugin's
# SessionStart hook also reads to check the CLI on PATH.
#
# Changes to the upstream text, and nothing else:
#   1. Inside a plugin, commands are namespaced by plugin name, so every
#      `/opsx:` becomes `/openspec:`, and each command's frontmatter `name`
#      becomes its file name.
#   2. EDITS below: the findings scripts/check-cost.mjs raises against the
#      upstream skills and commands, an `effort:` key on every skill (repo
#      rule), description trims and a routing fix, when to archive (in the PR
#      that lands the work, before it merges, never in a follow-up after
#      merge), and archive's confirmation prompt turned into stop-and-report
#      (CLAUDE.md -> Autonomy). Each edit must change its file; when upstream
#      fixes one, the sync fails and the edit should be deleted.
#   3. schemas/spec-driven-tested is `openspec schema fork spec-driven` plus the
#      test-plan artifact that scripts/openspec-tested.py adds. That script
#      fails when its upstream anchors move, and the result must pass
#      `openspec schema validate`.
# The hand-written commands/setup.md and scripts/ are left alone.
#
# To bump: edit openspec-version, run `make sync-openspec`, bump the version
# in plugins/openspec/.claude-plugin/plugin.json and marketplace.json, and re-run
# the plugin's evals.
#
# Usage: scripts/sync-openspec.sh
set -euo pipefail
shopt -s nullglob

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/plugins/openspec"
OPENSPEC_VERSION="$(tr -d '[:space:]' <"$DEST/openspec-version")"
HAND_WRITTEN="setup.md"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# file (relative to the staged plugin) <TAB> sed expression
EDITS=(
  $'skills/openspec-propose/SKILL.md\ts/\\*\\*IMPORTANT\\*\\*: //g'
  $'skills/openspec-explore/SKILL.md\ts/\\*\\*IMPORTANT: /**/'
  $'skills/openspec-explore/SKILL.md\ts/ Think deeply\\.//'
  # Routing: explore fires for "think this through before a proposal or code" even when the prompt never says OpenSpec.
  $'skills/openspec-explore/SKILL.md\t/^description:/s/ in a project that uses OpenSpec\\. Use when the user wants to think through something before or during an OpenSpec change\\./. Use when the user wants to think an idea through, weigh options, or investigate a problem before any proposal or code, or during an OpenSpec change./'
  $'commands/propose.md\ts/\\*\\*IMPORTANT\\*\\*: //g'
  $'commands/explore.md\ts/\\*\\*IMPORTANT: /**/'
  $'commands/explore.md\ts/ Think deeply\\.//'
  # Every SKILL.md sets effort: (repo rule; see CLAUDE.md -> Cost).
  $'skills/openspec-propose/SKILL.md\ts/^license: MIT$/&\\\neffort: medium/'
  $'skills/openspec-explore/SKILL.md\ts/^license: MIT$/&\\\neffort: medium/'
  $'skills/openspec-apply-change/SKILL.md\ts/^license: MIT$/&\\\neffort: medium/'
  $'skills/openspec-update-change/SKILL.md\ts/^license: MIT$/&\\\neffort: medium/'
  $'skills/openspec-sync-specs/SKILL.md\ts/^license: MIT$/&\\\neffort: medium/'
  $'skills/openspec-archive-change/SKILL.md\ts/^license: MIT$/&\\\neffort: medium/'
  $'skills/openspec-update-change/SKILL.md\t/^description:/s/ and keeping them coherent with one another//'
  $'skills/openspec-update-change/SKILL.md\t/^description:/s/, fold new decisions into it, or reconcile its artifacts after an edit/ or fold new decisions into it/'
  # When to archive: in the PR that lands the work, so nothing is left to do after merge.
  $'skills/openspec-archive-change/SKILL.md\t/^description:/s/ after implementation is complete/ once implementation is complete, in the PR that lands it, before merge/'
  $'skills/openspec-archive-change/SKILL.md\ts/^Archive a completed change in the experimental workflow\\.$/& Archive it in the PR that lands the change\'s last spec changes (for a stack, its last PR), before that PR merges, so the archive and the synced main specs merge with the work. Never leave it for a follow-up after merge./'
  $'commands/archive.md\ts/^Archive a completed change in the experimental workflow\\.$/& Archive it in the PR that lands the change\'s last spec changes (for a stack, its last PR), before that PR merges, so the archive and the synced main specs merge with the work. Never leave it for a follow-up after merge./'
  $'skills/openspec-apply-change/SKILL.md\ts/suggest archive$/suggest archiving it in this same PR, before it merges/'
  $'skills/openspec-apply-change/SKILL.md\ts|You can archive this change with `/openspec:archive`\\.|Archive it with `/openspec:archive` in this same PR, before it merges, so the archive lands with the work.|'
  $'commands/apply.md\ts/suggest archive$/suggest archiving it in this same PR, before it merges/'
  $'commands/apply.md\ts|You can archive this change with `/openspec:archive`\\.|Archive it with `/openspec:archive` in this same PR, before it merges, so the archive lands with the work.|'
  # Autonomy (CLAUDE.md): incomplete work is a stop-and-report, not a confirmation prompt.
  $'skills/openspec-archive-change/SKILL.md\ts/^   - Ask the user to confirm they want to proceed$/   - Proceed only if the request says to archive anyway; otherwise stop and report what is incomplete/'
  $'skills/openspec-archive-change/SKILL.md\t/^   - Proceed if user confirms$/d'
  $'commands/archive.md\ts/^   - Prompt user for confirmation to continue$/   - Proceed only if the request says to archive anyway; otherwise stop and report what is incomplete/'
  $'commands/archive.md\t/^   - Proceed if user confirms$/d'
  # Autonomy: invoking update is the request to revise, so it applies edits and reports them.
  $'skills/openspec-update-change/SKILL.md\ts/^     3\. Include the new file in step 5\'s proposed revisions and create it only after the user confirms\.$/     3. Create the new file as part of step 5./'
  $'skills/openspec-update-change/SKILL.md\ts/^     4\. After confirmation, immediately before creation, refresh/     4. Immediately before creation, refresh/'
  $'skills/openspec-update-change/SKILL.md\ts/honor the confirmed path and these guardrails/honor the planned path and these guardrails/'
  $'skills/openspec-update-change/SKILL.md\ts/If any check fails or the confirmed draft is no longer valid, stop and reconcile with the user rather than/If any check fails or the planned draft is no longer valid, stop and report the conflict rather than/'
  $'skills/openspec-update-change/SKILL.md\ts/^5\. \*\*Confirm and apply, one artifact at a time\*\*$/5. **Apply, one artifact at a time**/'
  $'skills/openspec-update-change/SKILL.md\ts/^   - Show each proposed revision and why - including the requested edit drafted in step 4\. Write only after the user confirms\.$/   - Apply each revision, including the requested edit drafted in step 4, and report what changed and why./'
  $'skills/openspec-update-change/SKILL.md\ts/^- Confirm every edit with the user before writing\.$/- Report every edit you made, with its reason./'
  $'commands/update.md\ts/^     3\. Include the new file in step 5\'s proposed revisions and create it only after the user confirms\.$/     3. Create the new file as part of step 5./'
  $'commands/update.md\ts/^     4\. After confirmation, immediately before creation, refresh/     4. Immediately before creation, refresh/'
  $'commands/update.md\ts/honor the confirmed path and these guardrails/honor the planned path and these guardrails/'
  $'commands/update.md\ts/If any check fails or the confirmed draft is no longer valid, stop and reconcile with the user rather than/If any check fails or the planned draft is no longer valid, stop and report the conflict rather than/'
  $'commands/update.md\ts/^5\. \*\*Confirm and apply, one artifact at a time\*\*$/5. **Apply, one artifact at a time**/'
  $'commands/update.md\ts/^   - Show each proposed revision and why - including the requested edit drafted in step 4\. Write only after the user confirms\.$/   - Apply each revision, including the requested edit drafted in step 4, and report what changed and why./'
  $'commands/update.md\ts/^- Confirm every edit with the user before writing\.$/- Report every edit you made, with its reason./'
)

die() { echo "sync-openspec: $*" >&2; exit 1; }

openspec() { OPENSPEC_TELEMETRY=0 XDG_DATA_HOME="$TMP/xdg" npx --yes "@fission-ai/openspec@$OPENSPEC_VERSION" "$@"; }

openspec init --tools claude "$TMP/init" >/dev/null

skills=("$TMP"/init/.claude/skills/*/SKILL.md)
commands=("$TMP"/init/.claude/commands/opsx/*.md)
[ ${#skills[@]} -gt 0 ] || die "no .claude/skills/*/SKILL.md in the openspec init output"
[ ${#commands[@]} -gt 0 ] || die "no .claude/commands/opsx/*.md in the openspec init output"
for f in "${skills[@]}" "${commands[@]}"; do
  [ -s "$f" ] || die "empty file in the openspec init output: ${f#"$TMP/init/"}"
done

STAGE="$TMP/stage"
mkdir -p "$STAGE/skills" "$STAGE/commands"

for src in "${skills[@]}"; do
  name="$(basename "$(dirname "$src")")"
  mkdir -p "$STAGE/skills/$name"
  sed 's#/opsx:#/openspec:#g' "$src" >"$STAGE/skills/$name/SKILL.md"
done

for src in "${commands[@]}"; do
  name="$(basename "$src" .md)"
  [ "$name.md" != "$HAND_WRITTEN" ] || die "upstream now generates commands/$HAND_WRITTEN, which is hand-written here"
  sed -e 's#/opsx:#/openspec:#g' \
      -e "2,/^---\$/s#^name: .*#name: \"$name\"#" \
      "$src" >"$STAGE/commands/$name.md"
done

for edit in "${EDITS[@]}"; do
  file="$STAGE/${edit%%$'\t'*}"
  expr="${edit#*$'\t'}"
  [ -f "$file" ] || die "edit target missing: ${edit%%$'\t'*}"
  before="$(cksum <"$file")"
  sed -i.bak -e "$expr" "$file" && rm "$file.bak"
  [ "$(cksum <"$file")" != "$before" ] || die "edit no longer applies to ${edit%%$'\t'*}: $expr"
done

# Fork from the package copy: XDG_DATA_HOME points at an empty dir, so no
# user-level schema can shadow spec-driven.
TESTED="$TMP/init/openspec/schemas/spec-driven-tested"
(cd "$TMP/init" && openspec schema fork spec-driven spec-driven-tested >/dev/null)
[ -s "$TESTED/schema.yaml" ] || die "openspec schema fork wrote no $TESTED/schema.yaml"
python3 "$ROOT/scripts/openspec-tested.py" "$TESTED" || die "the test-plan addition no longer applies to spec-driven"
(cd "$TMP/init" && openspec schema validate spec-driven-tested >/dev/null) || die "spec-driven-tested fails openspec schema validate"
mkdir -p "$STAGE/schemas"
cp -R "$TESTED" "$STAGE/schemas/spec-driven-tested"

rm -rf "$DEST/skills"
mv "$STAGE/skills" "$DEST/skills"
mkdir -p "$DEST/commands"
find "$DEST/commands" -name '*.md' ! -name "$HAND_WRITTEN" -delete
cp "$STAGE"/commands/*.md "$DEST/commands/"
rm -rf "$DEST/schemas"
mv "$STAGE/schemas" "$DEST/schemas"

echo "openspec $OPENSPEC_VERSION synced -> plugins/openspec"
