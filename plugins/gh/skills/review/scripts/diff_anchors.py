#!/usr/bin/env python3
"""Build the GitHub diff-anchor map for a PR — the source of truth for which
lines accept inline review comments.

Why this exists: GitHub rejects review comments whose `line` falls outside the
diff hunks with a 422 ``"Pull request review thread line must be part of the
diff"``. The hunks reflect the *current* PR HEAD on GitHub, which may have
moved since you cloned. Computing line validity from your local clone's diff
will silently drift if the PR was rebased or amended mid-run.

This script asks GitHub directly via ``GET /repos/{O}/{R}/pulls/{N}/files``,
parses each file's ``patch`` field, and emits one JSON object mapping
``path -> sorted list of valid RIGHT-side line numbers``. Validity = the line
appears in some hunk as added (``+``) or context (`` ``). Removed lines
(``-``) are LEFT-side only.

Usage:
  diff_anchors.py OWNER REPO PR_NUM > $REVIEW_DIR/diff-anchors.json

The output is consumed by build_payload.py and by the launcher's anchor
validation step in Phase 5.5 of the review skill.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys

HUNK_HEADER = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


def commentable_lines(patch: str) -> list[int]:
    """Walk a patch string; return RIGHT-side line numbers that accept comments."""
    lines: list[int] = []
    cur: int | None = None
    for raw in patch.split("\n"):
        m = HUNK_HEADER.match(raw)
        if m:
            cur = int(m.group(1))
            continue
        if cur is None:
            continue
        if raw.startswith("+") and not raw.startswith("+++"):
            lines.append(cur)
            cur += 1
        elif raw.startswith(" "):
            lines.append(cur)
            cur += 1
        elif raw.startswith("-") and not raw.startswith("---"):
            # Removed line — LEFT side only, doesn't advance RIGHT counter
            pass
        elif raw.startswith("\\"):
            # "\ No newline at end of file" — ignore
            pass
        else:
            # Defensive: treat unknown markers as context to keep the counter sane
            cur += 1
    return lines


def fetch_files(owner: str, repo: str, pr: int) -> list[dict]:
    # --paginate concatenates all pages into a single call's output.
    result = subprocess.run(
        [
            "gh",
            "api",
            f"repos/{owner}/{repo}/pulls/{pr}/files",
            "--paginate",
            "-q",
            ".[] | {filename: .filename, patch: .patch, status: .status}",
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    out: list[dict] = []
    for line in result.stdout.splitlines():
        if line.strip():
            out.append(json.loads(line))
    return out


def main() -> int:
    if len(sys.argv) != 4:
        print(f"usage: {sys.argv[0]} OWNER REPO PR_NUM", file=sys.stderr)
        return 2
    owner, repo, pr_str = sys.argv[1:]
    pr = int(pr_str)

    files = fetch_files(owner, repo, pr)
    anchors: dict[str, list[int]] = {}
    for f in files:
        patch = f.get("patch") or ""
        if not patch:
            # Binary or rename-only — no commentable lines on RIGHT
            anchors[f["filename"]] = []
            continue
        anchors[f["filename"]] = commentable_lines(patch)

    head_sha = subprocess.run(
        [
            "gh",
            "api",
            f"repos/{owner}/{repo}/pulls/{pr}",
            "-q",
            ".head.sha",
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()

    json.dump(
        {"commit_id": head_sha, "anchors": anchors},
        sys.stdout,
        indent=2,
        sort_keys=True,
    )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
