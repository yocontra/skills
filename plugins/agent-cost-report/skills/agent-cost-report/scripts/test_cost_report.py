"""Tests for cost_report.py. Run `python3 test_cost_report.py` from this directory."""

import io
import json
import os
import sys
import tempfile
import time
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import cost_report  # noqa: E402

PROJ = "-Users-x-Projects-foo"


def asst(mid, ts, cw=0, cr=0, inp=0, out=0, tool=None):
    content = [{"type": "text", "text": "ok"}]
    if tool:
        content.append({"type": "tool_use", "id": "t-" + mid, "name": tool[0], "input": tool[1]})
    usage = {
        "input_tokens": inp,
        "cache_creation_input_tokens": cw,
        "cache_read_input_tokens": cr,
        "output_tokens": out,
    }
    return {"type": "assistant", "timestamp": ts, "message": {"id": mid, "content": content, "usage": usage}}


def tool_result(ts, text, is_error=False):
    return {
        "type": "user",
        "timestamp": ts,
        "message": {"content": [{"type": "tool_result", "tool_use_id": "t", "content": text, "is_error": is_error}]},
    }


def human(ts, text):
    return {"type": "user", "timestamp": ts, "origin": {"kind": "human"}, "message": {"content": text}}


class CostReportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.proj = self.root / PROJ
        self.proj.mkdir()
        # Date filters use local days; pin the zone so the fixtures mean one thing.
        self.old_tz = os.environ.get("TZ")
        os.environ["TZ"] = "UTC"
        time.tzset()

    def tearDown(self):
        self.tmp.cleanup()
        if self.old_tz is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = self.old_tz
        time.tzset()

    def write(self, rel, entries, garbage=True):
        path = self.proj / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        lines = [json.dumps(e) for e in entries]
        if garbage:
            lines.insert(1, "{not json")
        path.write_text("\n".join(lines) + "\n")

    def run_main(self, *args):
        buf = io.StringIO()
        with redirect_stdout(buf):
            cost_report.main(["--root", str(self.root), f"--project={PROJ}", *args])
        return buf.getvalue()

    def run_report(self, *args):
        return json.loads(self.run_main("--json", *args))

    def test_dedupes_by_message_id_and_skips_malformed_lines(self):
        line = asst("m1", "2026-10-01T12:00:00Z", out=1_000_000)
        self.write("s1.jsonl", [line, line, line])
        d = self.run_report()
        self.assertEqual(d["calls"]["main"], 1)
        self.assertAlmostEqual(d["total_usd"], 25.0)

    def test_main_vs_subagent_split_and_session_rollup(self):
        self.write("s1.jsonl", [asst("m1", "2026-10-01T12:00:00Z", inp=1_000_000)])
        self.write("s1/subagents/agent-a.jsonl", [asst("m2", "2026-10-01T12:01:00Z", cr=2_000_000)])
        d = self.run_report()
        self.assertAlmostEqual(d["main_usd"], 5.0)
        self.assertAlmostEqual(d["subagent_usd"], 1.0)
        self.assertEqual(d["top_sessions"][0]["session"], "s1")
        self.assertAlmostEqual(d["top_sessions"][0]["subagent_usd"], 1.0)

    def test_gap_after_sleep_is_sleep_poll(self):
        self.write(
            "s1.jsonl",
            [
                asst("m1", "2026-10-01T12:00:00Z", tool=("Bash", {"command": "sleep 600 && gh pr checks"})),
                tool_result("2026-10-01T12:10:00Z", "done"),
                asst("m2", "2026-10-01T12:10:01Z", cw=1_000_000),
            ],
        )
        d = self.run_report()
        self.assertEqual(d["idle_gap_rewrites"], {"sleep poll": {"usd": 6.25, "count": 1}})

    def test_short_sleep_and_short_gap_are_not_charged(self):
        self.write(
            "s1.jsonl",
            [
                asst("m1", "2026-10-01T12:00:00Z", tool=("Bash", {"command": "sleep 30"})),
                asst("m2", "2026-10-01T12:04:00Z", cw=1_000_000, tool=("Bash", {"command": "sleep 30"})),
                asst("m3", "2026-10-01T12:20:00Z", cw=1_000_000),
            ],
        )
        d = self.run_report()
        self.assertEqual(d["idle_gap_rewrites"], {"other": {"usd": 6.25, "count": 1}})

    def test_gap_with_user_message_is_user_message(self):
        self.write(
            "s1.jsonl",
            [
                asst("m1", "2026-10-01T12:00:00Z", tool=("Bash", {"command": "pytest -q"})),
                tool_result("2026-10-01T12:00:30Z", "1 passed"),
                human("2026-10-01T13:00:00Z", "now fix the other thing"),
                asst("m2", "2026-10-01T13:00:05Z", cw=2_000_000),
            ],
        )
        d = self.run_report()
        self.assertEqual(d["idle_gap_rewrites"], {"user message": {"usd": 12.5, "count": 1}})

    def test_meta_task_notification_after_gap_is_agent_wait(self):
        # Background-task notifications arrive as isMeta user lines; they still mark an agent wait.
        note = {
            "type": "user",
            "timestamp": "2026-10-01T12:30:00Z",
            "isMeta": True,
            "origin": {"kind": "task-notification", "producer": "session-task"},
            "message": {"content": "[SYSTEM NOTIFICATION - NOT USER INPUT]\nTask finished"},
        }
        self.write(
            "s1.jsonl",
            [
                asst("m1", "2026-10-01T12:00:00Z", tool=("Bash", {"command": "sleep 600"})),
                note,
                asst("m2", "2026-10-01T12:30:05Z", cw=1_000_000),
            ],
        )
        d = self.run_report()
        self.assertEqual(d["idle_gap_rewrites"], {"agent wait": {"usd": 6.25, "count": 1}})

    def test_gap_after_test_run_commit_and_agent_wait(self):
        for i, (tool, cause) in enumerate([
            (("Bash", {"command": "scripts/test.sh tests/unit"}), "test run"),
            (("Bash", {"command": "git commit -m fix"}), "git commit"),
            (("Agent", {"prompt": "do it"}), "agent wait"),
        ]):
            self.write(
                f"s{i}.jsonl",
                [
                    asst(f"a{i}", "2026-10-01T12:00:00Z", tool=tool),
                    asst(f"b{i}", "2026-10-01T12:30:00Z", cw=1_000_000),
                ],
            )
        d = self.run_report()
        self.assertEqual(
            d["idle_gap_rewrites"],
            {c: {"usd": 6.25, "count": 1} for c in ("test run", "git commit", "agent wait")},
        )

    def test_hook_text_in_a_successful_result_is_not_counted(self):
        self.write(
            "s1.jsonl",
            [
                asst("m1", "2026-10-01T12:00:00Z"),
                tool_result("2026-10-01T12:00:01Z", "grep hit: PreToolUse:Bash hook error"),
            ],
        )
        d = self.run_report()
        self.assertEqual((d["top_hook_denials"], d["tool_errors_total"]), ([], 0))

    def test_one_hour_cache_writes_use_their_own_rate(self):
        line = asst("m1", "2026-10-01T12:00:00Z", cw=1_000_000)
        line["message"]["usage"]["cache_creation"] = {"ephemeral_1h_input_tokens": 1_000_000}
        self.write("s1.jsonl", [line])
        self.assertAlmostEqual(self.run_report()["total_usd"], 10.0)

    def test_error_normalization_and_counters(self):
        self.write(
            "s1.jsonl",
            [
                asst("m1", "2026-10-01T12:00:00Z"),
                tool_result("2026-10-01T12:00:01Z", "Exit code 2\nfile abc123def456 line 42 failed", True),
                tool_result("2026-10-01T12:00:02Z", "Exit code 2\nfile 0a0b0c0d0e line 7 failed", True),
                tool_result("2026-10-01T12:00:03Z", "PreToolUse:Bash hook error: No git stash (rule 12).", True),
                tool_result("2026-10-01T12:00:04Z", "fine"),
                tool_result("2026-10-01T12:00:05Z", "network unreachable", True),
            ],
        )
        d = self.run_report()
        self.assertEqual(d["top_tool_errors"][0], ["Exit code N: file H line N failed", 2])
        self.assertEqual(d["tool_errors_total"], 4)
        self.assertEqual(d["top_hook_denials"], [["PreToolUse:Bash hook error: No git stash (rule N).", 1]])

    def test_date_filter_is_inclusive(self):
        self.write(
            "s1.jsonl",
            [
                asst("m1", "2026-09-28T12:00:00Z", out=1_000_000),
                asst("m2", "2026-09-30T12:00:00Z", out=1_000_000),
                asst("m3", "2026-10-01T12:00:00Z", out=1_000_000),
                asst("m4", "2026-10-03T12:00:00Z", out=1_000_000),
                tool_result("2026-09-28T12:00:01Z", "boom", True),
            ],
        )
        d = self.run_report("--since", "2026-09-30", "--until", "2026-10-01")
        self.assertEqual(d["calls"]["main"], 2)
        self.assertAlmostEqual(d["total_usd"], 50.0)
        self.assertEqual(d["tool_errors_total"], 0)

    def test_project_resolution_from_repo_path(self):
        self.assertEqual(cost_report.encode_project("/Users/x/Projects/foo.bar"), "-Users-x-Projects-foo-bar")
        self.assertEqual(cost_report.resolve_project(str(self.proj), self.root), self.proj)
        self.assertEqual(cost_report.resolve_project(PROJ, self.root), self.proj)

    def test_default_root_honors_claude_config_dir(self):
        old = os.environ.get("CLAUDE_CONFIG_DIR")
        try:
            os.environ["CLAUDE_CONFIG_DIR"] = "/opt/cc"
            self.assertEqual(cost_report.default_root(), str(Path("/opt/cc/projects")))
            os.environ.pop("CLAUDE_CONFIG_DIR")
            self.assertEqual(cost_report.default_root(), str(Path("~/.claude/projects")))
        finally:
            if old is not None:
                os.environ["CLAUDE_CONFIG_DIR"] = old

    def test_list_projects_ranks_by_size_and_is_bounded(self):
        self.write("s1.jsonl", [asst("m1", "2026-10-01T12:00:00Z")])
        (self.root / "-small").mkdir()
        (self.root / "-small" / "s.jsonl").write_text("{}\n")
        (self.root / "-empty").mkdir()
        buf = io.StringIO()
        with redirect_stdout(buf):
            cost_report.main(["--root", str(self.root), "--list", "--top", "1"])
        lines = buf.getvalue().splitlines()
        self.assertTrue(lines[2].endswith(PROJ))
        self.assertIn("1 more", lines[3])
        self.assertNotIn("-empty", buf.getvalue())

    def test_text_output_stays_compact(self):
        self.write("s1.jsonl", [asst("m1", "2026-10-01T12:00:00Z", out=1000)])
        text = self.run_main()
        self.assertIn("Total $0.03", text)
        self.assertLess(len(text.splitlines()), 60)


if __name__ == "__main__":
    unittest.main()
