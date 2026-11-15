#!/usr/bin/env python3
"""Tests for plan_coverage.

Run with: python3 plugins/openspec/scripts/test_plan_coverage.py
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from plan_coverage import missing_lines, normalize  # noqa: E402


class NormalizeTest(unittest.TestCase):
    def test_strips_markdown_markers(self) -> None:
        self.assertEqual(normalize("## Rollout plan"), "Rollout plan")
        self.assertEqual(normalize("> quoted note"), "quoted note")
        self.assertEqual(normalize("- bullet item"), "bullet item")
        self.assertEqual(normalize("* star item"), "star item")
        self.assertEqual(normalize("3. third step"), "third step")
        self.assertEqual(normalize("- [x] ticked task"), "ticked task")
        self.assertEqual(normalize("- [ ] open task"), "open task")

    def test_drops_line_anchors_but_keeps_times(self) -> None:
        self.assertEqual(normalize("see src/api.py:42 and web/app.ts:12-30"), "see src/api.py and web/app.ts")
        self.assertEqual(normalize("run at 10:30 UTC"), "run at 10:30 UTC")

    def test_collapses_whitespace(self) -> None:
        self.assertEqual(normalize("  keep   the\tcache  "), "keep the cache")


class MissingLinesTest(unittest.TestCase):
    def test_line_anchor_converted_to_symbol_is_not_a_miss(self) -> None:
        plan = "- Fix the retry bug in src/api.py:42-58\n"
        change = "- [ ] 1.1 Fix the retry bug in src/api.py (`retry_login`)\n"
        self.assertEqual(missing_lines(plan, [change]), [])

    def test_present_line_matches_across_markers_and_spacing(self) -> None:
        plan = "- [x] Drop the legacy path in api.py:42\n"
        change = "## Tasks\n- [ ] Drop the legacy path   in api.py:42\n"
        self.assertEqual(missing_lines(plan, [change]), [])

    def test_short_and_wordless_lines_are_skipped(self) -> None:
        plan = "# A\n\n|---|---|\n- ok\n```\n***\n"
        self.assertEqual(missing_lines(plan, [""]), [])

    def test_really_missing_line_is_reported_with_its_number(self) -> None:
        plan = "# Plan\nRejected: Redis, too costly\n"
        change = "## Design\nWe use the in-process cache.\n"
        self.assertEqual(
            missing_lines(plan, [change]),
            [(1, "# Plan"), (2, "Rejected: Redis, too costly")],
        )

    def test_line_split_across_two_change_lines_is_missing(self) -> None:
        plan = "Keep the cache TTL at five minutes\n"
        change = "Keep the cache\nTTL at five minutes\n"
        self.assertEqual(missing_lines(plan, [change]), [(1, "Keep the cache TTL at five minutes")])

    def test_line_split_across_two_change_files_is_missing(self) -> None:
        plan = "Keep the cache TTL at five minutes\n"
        self.assertEqual(
            missing_lines(plan, ["Keep the cache", "TTL at five minutes"]),
            [(1, "Keep the cache TTL at five minutes")],
        )


class CliTest(unittest.TestCase):
    def test_exit_status_and_output(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "change" / "specs").mkdir(parents=True)
            (root / "change" / "design.md").write_text("Keep the cache TTL at five minutes\n")
            (root / "change" / "specs" / "spec.md").write_text("Nothing else\n")
            plan = root / "plan.md"
            plan.write_text("Keep the cache TTL at five minutes\nRejected: Redis\n")

            run = subprocess.run(
                [sys.executable, str(HERE / "plan_coverage.py"), str(plan), str(root / "change")],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(run.returncode, 1)
            self.assertEqual(run.stdout, f"{plan}:2: Rejected: Redis\n")

            plan.write_text("Keep the cache TTL at five minutes\n")
            run = subprocess.run(
                [sys.executable, str(HERE / "plan_coverage.py"), str(plan), str(root / "change")],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(run.returncode, 0)
            self.assertEqual(run.stdout, "")


if __name__ == "__main__":
    unittest.main()
