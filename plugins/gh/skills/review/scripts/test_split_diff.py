#!/usr/bin/env python3
"""Tests for split_diff.

Run with: python3 scripts/test_split_diff.py
(from plugins/gh/skills/review/)

split_diff cuts a unified diff into one file per path and counts the changed
lines the review workflow scales its fan-out on. These tests cover the path
cases that would otherwise send a verifier to a missing file (deletions,
renames, binary files, untracked files appended with --no-index) and the
counting cases that would skew the size (file headers, removed lines that
themselves start with "--").
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import split_diff  # noqa: E402

MODIFIED = """diff --git a/pkg/app.py b/pkg/app.py
index 1111111..2222222 100644
--- a/pkg/app.py
+++ b/pkg/app.py
@@ -1,3 +1,3 @@
 import os
-x = 1
+x = 2
 y = 3
"""

DELETED = """diff --git a/old.txt b/old.txt
deleted file mode 100644
index 3333333..0000000
--- a/old.txt
+++ /dev/null
@@ -1,2 +0,0 @@
--- a yaml separator
-gone
"""

RENAMED = """diff --git a/a/before.md b/a/after.md
similarity index 100%
rename from a/before.md
rename to a/after.md
"""

BINARY = """diff --git a/img/logo.png b/img/logo.png
index 4444444..5555555 100644
Binary files a/img/logo.png and b/img/logo.png differ
"""

UNTRACKED = """diff --git a/new.py b/new.py
new file mode 100644
index 0000000..6666666
--- /dev/null
+++ b/new.py
@@ -0,0 +1 @@
+print("hi")
"""


class SplitTest(unittest.TestCase):
    def test_paths_and_counts(self):
        files = split_diff.split(MODIFIED + DELETED + RENAMED + BINARY + UNTRACKED)
        self.assertEqual(
            [(path, count) for path, count, _ in files],
            [("pkg/app.py", 2), ("old.txt", 2), ("a/after.md", 0), ("img/logo.png", 0), ("new.py", 1)],
        )

    def test_section_text_is_verbatim(self):
        files = split_diff.split(MODIFIED + UNTRACKED)
        self.assertEqual(files[0][2], MODIFIED)
        self.assertEqual(files[1][2], UNTRACKED)

    def test_empty_diff(self):
        self.assertEqual(split_diff.split(""), [])

    def test_cli_writes_per_file_diffs_and_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            diff = Path(tmp) / "diff.txt"
            diff.write_text(MODIFIED + UNTRACKED)
            out = Path(tmp) / "files"
            result = subprocess.run(
                [sys.executable, str(HERE / "split_diff.py"), str(diff), str(out)],
                capture_output=True, text=True, check=True,
            )
            self.assertEqual(json.loads(result.stdout), {"changedLines": 3, "files": 2, "filesDir": str(out)})
            self.assertEqual((out / "pkg__app.py.diff").read_text(), MODIFIED)
            self.assertEqual(
                (out / "manifest.txt").read_text(),
                f"2\tpkg/app.py\t{out / 'pkg__app.py.diff'}\n1\tnew.py\t{out / 'new.py.diff'}\n",
            )


if __name__ == "__main__":
    unittest.main()
