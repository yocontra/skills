#!/usr/bin/env python3
"""Behavior tests for pr-watch.sh, run by the plugin-script-tests hook.

pr-watch.sh runs against a fake `gh` on PATH.
"""

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
PR_WATCH = HERE / "pr-watch.sh"

FAKE_GH = """#!/bin/sh
echo "$*" >>"$FAKE/gh-calls"
case "$1 $2" in
  "api graphql") cat "$FAKE/graphql.json" ;;
  "pr checks")
    if [ -f "$FAKE/checks.err" ]; then cat "$FAKE/checks.err" >&2; exit 1; fi
    cat "$FAKE/checks.json"; exit 8 ;;
  *) echo "fake gh: unexpected $*" >&2; exit 1 ;;
esac
"""

def pr_payload(state="OPEN", comments=(), reviews=(), threads=()):
    return {
        "data": {
            "repository": {
                "pullRequest": {
                    "state": state,
                    "headRefOid": "abc123def456",
                    "reviewThreads": {"nodes": list(threads)},
                    "reviews": {"nodes": list(reviews)},
                    "comments": {"nodes": list(comments)},
                }
            }
        }
    }


def comment(login, created, body="please fix", typename="User"):
    return {
        "author": {"login": login, "__typename": typename},
        "createdAt": created,
        "url": f"https://example/{login}/{created}",
        "body": body,
    }


def check(name, bucket, link=""):
    return {"name": name, "bucket": bucket, "link": link}


class PrWatchTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name).resolve()
        (self.dir / "gh").write_text(FAKE_GH)
        (self.dir / "gh").chmod(0o755)

    def tearDown(self):
        self.tmp.cleanup()

    def run_watch(self, payload, checks, *extra, target=("42", "--repo", "o/r")):
        (self.dir / "graphql.json").write_text(json.dumps(payload))
        (self.dir / "checks.json").write_text(json.dumps(checks))
        env = dict(
            os.environ,
            PATH=f"{self.dir}:{os.environ['PATH']}",
            FAKE=str(self.dir),
        )
        args = [str(PR_WATCH), *target, "--since", "2026-10-01T00:00:00Z", "--interval", "1"]
        return subprocess.run(args + list(extra), env=env, capture_output=True, text=True, timeout=60)

    def test_green_when_all_checks_pass(self):
        r = self.run_watch(pr_payload(), [check("lint", "pass")])
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("RESULT: green", r.stdout)

    def test_failed_check_exits_1(self):
        checks = [
            check("lint", "pass"),
            check("tests", "fail", "https://ci/1"),
        ]
        r = self.run_watch(pr_payload(), checks)
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn("check-fail tests https://ci/1", r.stdout)

    def test_new_human_feedback_exits_2(self):
        payload = pr_payload(comments=[comment("alice", "2026-10-02T00:00:00Z")])
        r = self.run_watch(payload, [check("tests", "pending", "https://ci/1")])
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertIn("comment alice", r.stdout)

    def test_bot_and_old_comments_are_ignored(self):
        payload = pr_payload(
            comments=[
                comment("status-bot", "2026-10-02T00:00:00Z", ":white_check_mark: build"),
                comment("ci", "2026-10-02T00:00:00Z", typename="Bot"),
                comment("bob", "2026-09-01T00:00:00Z"),
            ],
            reviews=[
                {
                    "author": {"login": "carol", "__typename": "User"},
                    "state": "APPROVED",
                    "submittedAt": "2026-10-02T00:00:00Z",
                    "url": "https://example/approval",
                    "body": "",
                }
            ],
        )
        r = self.run_watch(payload, [check("lint", "pass")], "--ignore", "status-bot")
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("approved carol", r.stdout)

    def test_ai_review_thread_counts_as_feedback(self):
        thread = {
            "isResolved": False,
            "path": "a.py",
            "comments": {"nodes": [comment("ai-reviewer", "2026-10-02T00:00:00Z", "Bug: off by one")]},
        }
        r = self.run_watch(pr_payload(threads=[thread]), [check("lint", "pass")])
        self.assertEqual(r.returncode, 2, r.stdout)

    def test_merged_exits_3(self):
        r = self.run_watch(pr_payload(state="MERGED"), [])
        self.assertEqual(r.returncode, 3, r.stdout)

    def test_cancelled_check_exits_1(self):
        r = self.run_watch(pr_payload(), [check("lint", "pass"), check("tests", "cancel")])
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn("check-cancel tests", r.stdout)

    def test_checks_call_failing_is_never_green(self):
        (self.dir / "checks.err").write_text("HTTP 502: bad gateway\n")
        r = self.run_watch(pr_payload(), [])
        self.assertEqual(r.returncode, 5, r.stdout)
        self.assertNotIn("green", r.stdout)

    def test_pr_with_no_checks_is_green(self):
        (self.dir / "checks.err").write_text("no checks reported on the 'feat' branch\n")
        r = self.run_watch(pr_payload(), [])
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("no checks reported", r.stdout)

    def test_bot_account_review_counts_but_bot_comment_does_not(self):
        bot_comment = comment("ci", "2026-10-02T00:00:00Z", typename="Bot")
        r = self.run_watch(pr_payload(comments=[bot_comment]), [check("lint", "pass")])
        self.assertEqual(r.returncode, 0, r.stdout)
        review = {
            "author": {"login": "ai-review[bot]", "__typename": "Bot"},
            "state": "CHANGES_REQUESTED",
            "submittedAt": "2026-10-02T00:00:00Z",
            "url": "https://example/review",
            "body": "",
        }
        r = self.run_watch(pr_payload(reviews=[review]), [check("lint", "pass")])
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertIn("review:changes_requested ai-review[bot]", r.stdout)

    def test_deleted_author_prints_ghost(self):
        c = comment("x", "2026-10-02T00:00:00Z")
        c["author"] = None
        r = self.run_watch(pr_payload(comments=[c]), [check("lint", "pass")])
        self.assertEqual(r.returncode, 2, r.stdout)
        self.assertIn("comment ghost https://example/x/", r.stdout)

    def test_pr_url_supplies_the_repo(self):
        r = self.run_watch(pr_payload(), [check("lint", "pass")], target=("https://ghe.example/acme/widgets/pull/7",))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn("pr checks 7 --repo acme/widgets", (self.dir / "gh-calls").read_text())

    def test_bad_arguments_exit_64(self):
        for extra in (["--interval"], ["--since", "yesterday"]):
            r = self.run_watch(pr_payload(), [], *extra)
            self.assertEqual(r.returncode, 64, (extra, r.stdout))

    def test_timeout_exits_4(self):
        r = self.run_watch(pr_payload(), [check("slow", "pending")], "--timeout", "2")
        self.assertEqual(r.returncode, 4, r.stdout)
        self.assertIn("RESULT: timeout", r.stdout)


if __name__ == "__main__":
    unittest.main()
