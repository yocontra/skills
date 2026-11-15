#!/usr/bin/env python3
"""List source-plan lines that are missing verbatim from an OpenSpec change.

Usage: plan_coverage.py <plan.md> <openspec/changes/<slug>>

A plan line counts as present when its text appears inside a single line of
the change's markdown files, ignoring list markers, checkboxes, heading hashes,
quote markers and whitespace differences. A line anchor such as `api.py:42` or
`api.py:42-58` compares as its path alone, so a plan line whose anchor was
converted to a path and symbol still counts as present. Prints each missing line with its
line number and exits 1 if any are missing, 0 if none are.

Matching is line by line, so restructured headings, lines wrapped
differently and rewritten links always show up as misses. Check each listed line for its
facts, and restore only facts the change does not contain. Never append the
plan's full text, or a large verbatim copy of it, to shorten the list: that
duplicates the plan and undoes the change's structure.
"""

import re
import sys
from collections.abc import Iterable
from pathlib import Path

# `path:NNN` or `path:NNN-MMM`. The path needs a `.` or `/`, so `10:30` stays.
LINE_ANCHOR = re.compile(r"\b([\w-]+(?:[./][\w-]+)+):\d+(?:[-–]\d+)?\b")
MARKER = re.compile(r"^\s*(?:[#>]+|[-*+]\s+\[[ xX]\]|[-*+]|\d+[.)])\s*")
MIN_CHARS = 4
WORD = re.compile(r"[A-Za-z0-9]")


def normalize(line: str) -> str:
    return " ".join(LINE_ANCHOR.sub(r"\1", MARKER.sub("", line)).split())


def missing_lines(plan: str, change_docs: Iterable[str]) -> list[tuple[int, str]]:
    """Return (line number, line) for each plan line absent from `change_docs`."""
    # Newline-joined: normalize() never emits a newline, so a plan line cannot
    # match across the boundary between two change lines or two files.
    corpus = "\n".join(normalize(line) for doc in change_docs for line in doc.splitlines())
    missing = []
    for number, line in enumerate(plan.splitlines(), 1):
        text = normalize(line)
        if len(text) < MIN_CHARS or text.startswith("```") or not WORD.search(text):
            continue
        if text not in corpus:
            missing.append((number, line.strip()))
    return missing


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__.strip().splitlines()[2], file=sys.stderr)
        return 2
    plan = Path(sys.argv[1])
    change = Path(sys.argv[2])
    if not change.is_dir():
        print(f"not a directory: {change}", file=sys.stderr)
        return 2

    docs = [path.read_text(encoding="utf-8") for path in sorted(change.rglob("*.md"))]
    missing = missing_lines(plan.read_text(encoding="utf-8"), docs)
    for number, line in missing:
        print(f"{plan}:{number}: {line}")
    print(f"{len(missing)} missing line(s)", file=sys.stderr)
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
