#!/usr/bin/env bash
# Run Vale prose linting over authored docs and source comments.
#
# Excludes:
#   - Synced/vendored skills and OpenSpec schemas (overwritten by `make sync`,
#     owned upstream)
#   - The humanizer skill (a deliberate catalog of bad-prose examples)
#   - Eval suites (plugins/*/evals/**). A case prompt is written in a real
#     user's voice on purpose — "does this really work" is the phrasing a router
#     has to cope with — and grader rubrics quote fixture text verbatim. Holding
#     either to house prose style would push cases away from natural language,
#     which is the whole point of a routing case. Structure is enforced instead
#     by scripts/check-evals.mjs.
#
# Usage: scripts/vale-lint.sh [extra vale args]   (e.g. --output=line)
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v vale >/dev/null 2>&1; then
  echo "vale not found. Install it (https://vale.sh/docs/install), then run: vale sync" >&2
  exit 127
fi

# Ensure style packages are present (idempotent, network only on first run).
[ -d styles/write-good ] || vale sync

exec vale \
  --glob='!{plugins/openspec/skills/**,plugins/openspec/schemas/**,plugins/openspec/commands/apply.md,plugins/openspec/commands/archive.md,plugins/openspec/commands/explore.md,plugins/openspec/commands/propose.md,plugins/openspec/commands/sync.md,plugins/openspec/commands/update.md,plugins/humanizer/skills/humanizer/**,plugins/*/evals/**}' \
  "$@" \
  plugins README.md scripts shared
