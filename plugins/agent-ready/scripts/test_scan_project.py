"""Tests for scan-project.py. Run: python3 -m unittest discover plugins/agent-ready/scripts

Each test builds its fixture in a TemporaryDirectory, which removes itself, so
a run leaves nothing behind.
"""

import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name("scan-project.py")


def scan(root):
    out = subprocess.run([sys.executable, "-I", str(SCRIPT), str(root)],
                         check=True, capture_output=True, text=True).stdout
    return json.loads(out)


def write(root, rel, text):
    p = pathlib.Path(root, rel)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)


class ScanProjectTest(unittest.TestCase):
    def test_empty_dir_has_every_key(self):
        with tempfile.TemporaryDirectory() as d:
            r = scan(d)
        for key in ("host", "git", "claude", "claude_md", "manifests", "ci",
                    "containers", "env_files", "evidence", "dev_loop"):
            self.assertIn(key, r)
        self.assertEqual(r["ci"]["providers"], [])
        self.assertFalse(r["git"]["in_repo"])
        self.assertEqual(r["claude"]["mcp_servers"], [])

    def test_settings_permissions_and_mcp_names(self):
        with tempfile.TemporaryDirectory() as d:
            write(d, ".claude/settings.json", json.dumps({
                "enabledPlugins": {"gh@skills": True},
                "permissions": {"allow": ["Bash(gh pr view:*)", "Bash(*)"],
                                "deny": ["Read(.env)"], "defaultMode": "acceptEdits"},
                "hooks": {"PostToolUse": [{"matcher": "Edit", "hooks": []}]},
            }))
            write(d, ".mcp.json", json.dumps({"mcpServers": {
                "sentry": {"env": {"TOKEN": "secret-value"}}}}))
            r = scan(d)
        c = r["claude"]
        self.assertEqual(c["enabled_plugins"], ["gh@skills"])
        self.assertEqual(c["permissions"]["allow"], 2)
        self.assertEqual(c["permissions"]["deny"], 1)
        self.assertEqual(c["permissions"]["broad_allow"], ["Bash(*)"])
        self.assertEqual(c["permissions"]["default_mode"], "acceptEdits")
        self.assertEqual(c["mcp_servers"], ["sentry"])
        self.assertEqual(c["hook_events"], ["PostToolUse"])
        self.assertNotIn("secret-value", json.dumps(r))

    def test_ci_providers_and_env_names_without_values(self):
        with tempfile.TemporaryDirectory() as d:
            write(d, ".github/workflows/ci.yml", "on: push\n")
            write(d, ".gitlab-ci.yml", "test:\n  script: make test\n")
            write(d, "bitbucket-pipelines.yml", "pipelines: {}\n")
            write(d, ".env.example", "DATABASE_URL=postgres://user:hunter2@db/app\n")
            r = scan(d)
        self.assertEqual(r["ci"]["providers"],
                         ["github-actions", "gitlab-ci", "bitbucket-pipelines"])
        self.assertIn("DATABASE_URL", r["env_files"]["env_var_names"])
        self.assertNotIn("hunter2", json.dumps(r))

    def test_gitignore_agent_artifacts(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(scan(d)["gitignore"]["present"])
            write(d, ".gitignore", "node_modules/\n.claude/settings.local.json\n")
            g = scan(d)["gitignore"]
        self.assertTrue(g["present"])
        self.assertTrue(g["local_settings_ignored"])
        self.assertFalse(g["claude_local_md_ignored"])

    def test_scan_is_read_only(self):
        with tempfile.TemporaryDirectory() as d:
            write(d, "Makefile", "test:\n\tpytest\n")
            before = sorted(str(p) for p in pathlib.Path(d).rglob("*"))
            scan(d)
            after = sorted(str(p) for p in pathlib.Path(d).rglob("*"))
        self.assertEqual(before, after)


if __name__ == "__main__":
    unittest.main()
