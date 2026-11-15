#!/usr/bin/env python3
"""Tests for diff_anchors.commentable_lines.

Run with: python3 scripts/test_diff_anchors.py
(from plugins/gh/skills/review/)

commentable_lines walks a unified-diff patch and returns the RIGHT-side line
numbers GitHub accepts for inline review comments. These tests feed
representative patch strings and assert the exact numbers, covering the
boundary cases that would otherwise cause wrong-line comments or 422
rejections: added/context/deleted mixes, multi-hunk counter resets,
count-less hunk headers, "\\ No newline at end of file" markers, and bare
+++/--- file headers.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import diff_anchors  # noqa: E402


class CommentableLinesTest(unittest.TestCase):
    def test_single_hunk_add_context_delete_mix(self):
        # Hunk starts at RIGHT line 10. Context (10), added (11), deleted
        # (no advance), context (12). Deleted lines are LEFT-only.
        patch = "\n".join(
            [
                "@@ -10,3 +10,3 @@ def f():",
                " context_a",
                "+added_line",
                "-removed_line",
                " context_b",
            ]
        )
        self.assertEqual(diff_anchors.commentable_lines(patch), [10, 11, 12])

    def test_leading_file_headers_ignored(self):
        # Bare +++/--- headers must not be counted as add/delete, and must
        # not appear before the hunk sets the counter.
        patch = "\n".join(
            [
                "--- a/file.py",
                "+++ b/file.py",
                "@@ -1,2 +1,2 @@",
                " unchanged",
                "+brand_new",
            ]
        )
        self.assertEqual(diff_anchors.commentable_lines(patch), [1, 2])

    def test_lines_before_any_hunk_are_skipped(self):
        # Content before the first hunk header has no RIGHT-side position.
        patch = "\n".join(
            [
                "diff --git a/x b/x",
                "index abc..def 100644",
                "+not_in_a_hunk",
                "@@ -5,1 +5,2 @@",
                " keep",
                "+new",
            ]
        )
        self.assertEqual(diff_anchors.commentable_lines(patch), [5, 6])

    def test_two_hunks_counter_resets(self):
        # Second hunk starts a fresh RIGHT counter at its own header value.
        patch = "\n".join(
            [
                "@@ -1,2 +1,2 @@",
                " a",
                "+b",
                "@@ -20,2 +20,2 @@",
                " c",
                "+d",
            ]
        )
        self.assertEqual(diff_anchors.commentable_lines(patch), [1, 2, 20, 21])

    def test_count_less_hunk_header(self):
        # New-file hunk: "@@ -0,0 +1 @@" has no count on the RIGHT side.
        patch = "\n".join(
            [
                "@@ -0,0 +1 @@",
                "+only_line",
            ]
        )
        self.assertEqual(diff_anchors.commentable_lines(patch), [1])

    def test_no_newline_marker_ignored(self):
        # "\ No newline at end of file" must not advance the counter.
        patch = "\n".join(
            [
                "@@ -1,1 +1,1 @@",
                "-old",
                "\\ No newline at end of file",
                "+new",
                "\\ No newline at end of file",
            ]
        )
        self.assertEqual(diff_anchors.commentable_lines(patch), [1])

    def test_deleted_lines_do_not_advance_right_counter(self):
        # Two deletions then an add: the add lands on the RIGHT start line.
        patch = "\n".join(
            [
                "@@ -3,2 +3,1 @@",
                "-gone_one",
                "-gone_two",
                "+kept",
            ]
        )
        self.assertEqual(diff_anchors.commentable_lines(patch), [3])

    def test_empty_patch(self):
        self.assertEqual(diff_anchors.commentable_lines(""), [])


if __name__ == "__main__":
    unittest.main()
