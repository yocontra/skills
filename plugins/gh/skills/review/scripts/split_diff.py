#!/usr/bin/env python3
"""Split a unified diff into one file per changed path, and size it.

Why this exists: every review agent used to read the whole diff file, so a
large PR paid for the same bytes 12-20 times, often more as agents re-read
pages of it. With the diff split per path, an agent reads only the files its
dimension needs, and a verifier reads only the files its findings cite. The
total changed-line count is what the workflow uses to decide how many agents
the diff is worth.

Each path's diff goes to ``OUT_DIR/<path with "/" replaced by "__">.diff``.
The review workflow rebuilds that name from a finding's path, so the scheme
must stay in step with ``fileDiffPath`` in workflows/review/review.js.
``OUT_DIR/manifest.txt`` lists one changed file per line:
``<changed lines>\\t<path>\\t<per-file diff path>``.

Usage:
  split_diff.py DIFF OUT_DIR

Prints one JSON line: {"changedLines": N, "files": N, "filesDir": OUT_DIR}.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def file_path(header: str, lines: list[str]) -> str:
    """The repo-relative path one ``diff --git`` section changes."""
    for line in lines:
        if line.startswith("+++ b/"):
            return line[len("+++ b/"):]
    for line in lines:
        if line.startswith("--- a/"):
            return line[len("--- a/"):]
    for line in lines:
        if line.startswith("rename to "):
            return line[len("rename to "):]
    # Binary or mode-only change: no ---/+++ lines, only the header.
    return header[len("diff --git a/"):].rsplit(" b/", 1)[-1]


def changed_lines(lines: list[str]) -> int:
    """Count added and removed lines inside hunks, not the ---/+++ headers."""
    count, in_hunk = 0, False
    for line in lines:
        if line.startswith("@@"):
            in_hunk = True
        elif in_hunk and line[:1] in ("+", "-"):
            count += 1
    return count


def split(diff: str) -> list[tuple[str, int, str]]:
    """Return ``(path, changed lines, section text)`` per file, in diff order."""
    sections: list[list[str]] = []
    for line in diff.splitlines(keepends=True):
        if line.startswith("diff --git ") or not sections:
            sections.append([])
        sections[-1].append(line)
    out = []
    for section in sections:
        if not section[0].startswith("diff --git "):
            continue
        body = [line.rstrip("\n") for line in section]
        out.append((file_path(body[0], body[1:]), changed_lines(body[1:]), "".join(section)))
    return out


def diff_name(path: str) -> str:
    return path.replace("/", "__") + ".diff"


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    out_dir = Path(argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    files = split(Path(argv[1]).read_text(errors="replace"))
    manifest = []
    for path, count, text in files:
        target = out_dir / diff_name(path)
        target.write_text(text)
        manifest.append(f"{count}\t{path}\t{target}")
    (out_dir / "manifest.txt").write_text("".join(f"{m}\n" for m in manifest))
    total = sum(count for _, count, _ in files)
    print(json.dumps({"changedLines": total, "files": len(files), "filesDir": str(out_dir)}))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
