#!/usr/bin/env python3
"""Behavior tests for worktree.py and seed-hook.sh, run by the plugin-script-tests hook.

Each test builds a scratch origin, a main checkout and its worktrees under a
temp dir. On macOS that dir is on APFS, so "is a clone" is checked directly: a
clone's first block sits at the same physical offset as its source's. The
clone assertions run on macOS only; everything else runs everywhere.
"""

import fcntl
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "worktree.py"
HOOK = HERE / "seed-hook.sh"
F_LOG2PHYS = 49
BIG = b"m" * (200 << 10)
DARWIN = sys.platform == "darwin"
# For tests that assert something was cloned: off macOS seeding clones nothing.
needs_clones = unittest.skipUnless(DARWIN, "needs APFS clonefile(2)")
# No hooks or aliases from the developer's own git config.
# Drop inherited GIT_* variables: a git hook exports GIT_INDEX_FILE, GIT_DIR and friends,
# which would point every git call in the scratch repos at the caller's repository.
GIT_ENV = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
GIT_ENV.update({
    "GIT_CONFIG_GLOBAL": "/dev/null",
    "GIT_CONFIG_NOSYSTEM": "1",
    # CI runners have no git identity, and the global config is disabled above.
    "GIT_AUTHOR_NAME": "test", "GIT_AUTHOR_EMAIL": "test@example.com",
    "GIT_COMMITTER_NAME": "test", "GIT_COMMITTER_EMAIL": "test@example.com",
})
for var in ("UV_CACHE_DIR", "WORKTREE_PRUNE_MIN_AGE"):
    GIT_ENV.pop(var, None)
NPM_LOCK = json.dumps(
    {"lockfileVersion": 3, "packages": {"": {"name": "app"}, "node_modules/pkg": {"version": "1.0.0"}}}
)
PNPM_LOCK = "lockfileVersion: '9.0'\npackages:\n  pkg@1.0.0: {}\n"


def npm_record(version):
    """node_modules/.package-lock.json as npm writes it after installing pkg@version."""
    return json.dumps({"lockfileVersion": 3, "packages": {"node_modules/pkg": {"version": version}}})


def physoff(p: Path) -> int:
    with open(p, "rb") as f:
        buf = fcntl.fcntl(f.fileno(), F_LOG2PHYS, b"\0" * 20)
    return struct.unpack("=Iqq", buf)[2]


def run(*args, cwd, env=None, stdin=None, check=True):
    proc = subprocess.run(
        list(args), cwd=cwd, env=env or GIT_ENV, input=stdin, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    if check and proc.returncode != 0:
        raise AssertionError(f"{args} failed ({proc.returncode}):\n{proc.stdout}\n{proc.stderr}")
    return proc


def git(*args, cwd):
    return run("git", *args, cwd=cwd).stdout.strip()


def commit_all(repo, msg):
    git("add", "-A", cwd=repo)
    git("commit", "-q", "-m", msg, cwd=repo)


class WorktreeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp()).resolve()
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.env = dict(GIT_ENV)
        seed = self.tmp / "seed"
        seed.mkdir()
        git("init", "-q", "-b", "main", cwd=seed)
        files = {
            "model.bin": BIG,
            "small.txt": b"small\n",
            "web/package-lock.json": NPM_LOCK.encode(),
            "pn/pnpm-lock.yaml": PNPM_LOCK.encode(),
            "ws/package-lock.json": NPM_LOCK.encode(),
            "ws/packages/a/package.json": b"{}\n",
            "yarn/yarn.lock": b"# yarn lockfile v1\n",
            "other/big.bin": BIG + b"o",
            ".gitignore": b"node_modules/\n.worktrees/\n.claude/worktrees/\n",
        }
        for rel, data in files.items():
            (seed / rel).parent.mkdir(parents=True, exist_ok=True)
            (seed / rel).write_bytes(data)
        commit_all(seed, "init")
        self.origin = self.tmp / "origin.git"
        git("clone", "-q", "--bare", str(seed), str(self.origin), cwd=self.tmp)
        self.main = self.clone("main")
        # Each tree carries the record its package manager writes when an install finishes.
        self.install(self.main / "web/node_modules", {".package-lock.json": npm_record("1.0.0")})
        self.install(self.main / "pn/node_modules", {".pnpm/lock.yaml": PNPM_LOCK})
        self.install(self.main / "ws/node_modules", {".package-lock.json": npm_record("1.0.0")})
        self.install(self.main / "ws/packages/a/node_modules", {})
        self.install(self.main / "yarn/node_modules", {".yarn-integrity": "{}\n"})

    def clone(self, name):
        repo = self.tmp / name
        git("clone", "-q", str(self.origin), str(repo), cwd=self.tmp)
        for config in (("user.email", "t@example.com"), ("user.name", "t")):
            git("config", *config, cwd=repo)
        return repo

    def install(self, nm, records):
        (nm / "pkg").mkdir(parents=True)
        (nm / "pkg/index.js").write_bytes(BIG)
        (nm / ".bin").mkdir()
        (nm / ".bin/tool").symlink_to("../pkg/index.js")
        for rel, text in records.items():
            (nm / rel).parent.mkdir(parents=True, exist_ok=True)
            (nm / rel).write_text(text)

    def script(self, *args, cwd=None, check=True):
        return run(sys.executable, str(SCRIPT), *args, cwd=cwd or self.main, env=self.env, check=check)

    def add(self, name, *extra):
        wt = self.main / ".worktrees" / name
        self.script("add", str(wt), "-b", name, *extra)
        return wt

    def assertClone(self, a, b):
        self.assertEqual(Path(a).read_bytes(), Path(b).read_bytes())
        if DARWIN:
            self.assertEqual(physoff(a), physoff(b), f"{a} is not a clone of {b}")

    def assertNotClone(self, a, b):
        if DARWIN:
            self.assertNotEqual(physoff(a), physoff(b), f"{a} is a clone of {b}")

    # --- seeding ---------------------------------------------------------------

    @needs_clones
    def test_add_clones_matching_tracked_files_and_node_modules(self):
        wt = self.add("a")
        self.assertClone(wt / "model.bin", self.main / "model.bin")
        for d in ("web", "pn", "ws", "ws/packages/a"):
            self.assertClone(wt / d / "node_modules/pkg/index.js", self.main / d / "node_modules/pkg/index.js")
            self.assertEqual(os.readlink(wt / d / "node_modules/.bin/tool"), "../pkg/index.js")
        self.assertEqual(git("status", "--porcelain", cwd=wt), "")

    @needs_clones
    def test_clones_are_independent_of_the_main_checkout(self):
        wt = self.add("a")
        (wt / "model.bin").write_bytes(b"changed")
        (wt / "web/node_modules/pkg/index.js").write_bytes(b"changed")
        self.assertEqual((self.main / "model.bin").read_bytes(), BIG)
        self.assertEqual((self.main / "web/node_modules/pkg/index.js").read_bytes(), BIG)

    def test_edited_main_copy_is_not_shared(self):
        (self.main / "model.bin").write_bytes(b"x" * len(BIG))
        wt = self.add("a")
        self.assertEqual((wt / "model.bin").read_bytes(), BIG)
        self.assertNotClone(wt / "model.bin", self.main / "model.bin")
        self.assertEqual(git("status", "--porcelain", cwd=wt), "")

    def test_uncommitted_chmod_in_main_does_not_reach_the_worktree(self):
        (self.main / "model.bin").chmod(0o755)
        wt = self.add("a")
        self.assertEqual((wt / "model.bin").stat().st_mode & 0o777, 0o644)
        self.assertEqual(git("status", "--porcelain", cwd=wt), "")

    @needs_clones
    def test_add_seeds_only_the_worktree_it_created(self):
        other = self.main / ".claude/worktrees/other"
        # A worktree another agent creates while add runs: git is wrapped to add it too.
        wrapper = self.tmp / "bin/git"
        wrapper.parent.mkdir()
        real_git = shutil.which("git")
        wrapper.write_text(
            f'#!/bin/sh\nif [ "$1 $2" = "worktree add" ] && [ ! -e "{other}" ]; then\n'
            f'  "{real_git}" worktree add -q -b other "{other}" >/dev/null\nfi\nexec "{real_git}" "$@"\n'
        )
        wrapper.chmod(0o755)
        self.env["PATH"] = f"{wrapper.parent}:{self.env['PATH']}"
        wt = self.add("mine")
        self.assertTrue((wt / "web/node_modules").exists())
        self.assertTrue(other.exists())
        self.assertFalse((other / "web/node_modules").exists())

    def test_seed_runs_once_per_worktree(self):
        wt = self.add("a")
        subprocess.run(["rm", "-rf", str(wt / "web/node_modules")], check=True)
        self.script("seed", str(wt))
        self.assertFalse((wt / "web/node_modules").exists())

    @needs_clones
    def test_lockfile_mismatch_leaves_node_modules_out(self):
        (self.main / "web/package-lock.json").write_text('{"lockfileVersion": 3, "x": 1}\n')
        wt = self.add("a")
        self.assertFalse((wt / "web/node_modules").exists())
        self.assertTrue((wt / "pn/node_modules").exists())

    def test_install_without_a_record_is_not_cloned(self):
        (self.main / "pn/node_modules/.pnpm/lock.yaml").unlink()
        (self.main / "ws/node_modules/.package-lock.json").unlink()
        wt = self.add("a")
        self.assertFalse((wt / "pn/node_modules").exists())
        self.assertFalse((wt / "ws/node_modules").exists())
        # A workspace member is judged by the install at its lockfile's root.
        self.assertFalse((wt / "ws/packages/a/node_modules").exists())

    def test_install_of_an_older_lockfile_is_not_cloned(self):
        # The lockfile moved (a pull) and nobody reinstalled: the record pins an older version.
        (self.main / "web/node_modules/.package-lock.json").write_text(npm_record("0.9.0"))
        (self.main / "pn/node_modules/.pnpm/lock.yaml").write_text("lockfileVersion: '8.0'\n")
        wt = self.add("a")
        self.assertFalse((wt / "web/node_modules").exists())
        self.assertFalse((wt / "pn/node_modules").exists())

    @needs_clones
    def test_rewritten_lockfile_with_the_same_bytes_still_clones(self):
        # A branch switch rewrites the lockfile without changing it.
        lock = self.main / "web/package-lock.json"
        lock.write_bytes(lock.read_bytes())
        wt = self.add("a")
        self.assertTrue((wt / "web/node_modules/pkg/index.js").exists())

    def test_yarn_install_is_never_cloned(self):
        wt = self.add("a")
        self.assertFalse((wt / "yarn/node_modules").exists())

    def test_committed_symlink_does_not_carry_a_clone_outside_the_worktree(self):
        outside = self.tmp / "outside"
        outside.mkdir()
        (outside / "package-lock.json").write_bytes((self.main / "web/package-lock.json").read_bytes())
        other = self.clone("other")
        git("rm", "-q", "-r", "web", cwd=other)
        (other / "web").symlink_to(outside)
        commit_all(other, "web is a symlink")
        git("push", "-q", "origin", "HEAD:linked", cwd=other)
        git("fetch", "-q", "origin", cwd=self.main)
        self.script("add", str(self.main / ".worktrees/a"), "-b", "a", "origin/linked")
        self.assertFalse((outside / "node_modules").exists())

    def test_add_with_options_before_the_path_seeds_the_new_worktree(self):
        wt = self.main / ".worktrees/opts"
        self.script("add", "--lock", "--reason", "busy", "-b", "opts", str(wt), "origin/main")
        self.assertClone(wt / "model.bin", self.main / "model.bin")
        listing = git("worktree", "list", "--porcelain", cwd=self.main)
        self.assertIn(f"worktree {wt}\nHEAD", listing)
        self.assertIn("locked busy", listing)

    @needs_clones
    def test_seed_an_existing_plain_worktree_and_warn_on_a_local_uv_cache(self):
        wt = self.main / ".worktrees/plain"
        git("worktree", "add", "-q", "-b", "plain", str(wt), cwd=self.main)
        self.assertFalse((wt / "web/node_modules").exists())
        self.env["UV_CACHE_DIR"] = str(wt / ".uv-cache")
        err = self.script("seed", str(wt)).stderr
        self.assertClone(wt / "web/node_modules/pkg/index.js", self.main / "web/node_modules/pkg/index.js")
        self.assertIn("UV_CACHE_DIR", err)
        self.assertTrue(Path(git("rev-parse", "--path-format=absolute", "--git-dir", cwd=wt), "gh-worktree-seeded").exists())

    def test_seed_on_the_main_checkout_changes_nothing(self):
        err = self.script("seed", str(self.main)).stderr
        self.assertIn("nothing to seed", err)
        self.assertEqual(git("status", "--porcelain", cwd=self.main), "")

    # --- hook ------------------------------------------------------------------

    def hook(self, cwd):
        return run("/bin/bash", str(HOOK), cwd=self.main, env=self.env, stdin=json.dumps({"cwd": str(cwd), "tool_name": "Bash"}))

    def claude_worktree(self, name):
        """A worktree made the way Claude Code makes one: plain git, no seeding."""
        wt = self.main / ".claude/worktrees" / name
        git("worktree", "add", "-q", "--no-track", "-B", f"worktree-{name}", str(wt), "origin/main", cwd=self.main)
        return wt

    @needs_clones
    def test_hook_seeds_a_claude_worktree_once_on_its_first_tool_call(self):
        wt = self.claude_worktree("bold-oak")
        (wt / "sub").mkdir()
        self.assertEqual(self.hook(wt / "sub").returncode, 0)
        self.assertClone(wt / "web/node_modules/pkg/index.js", self.main / "web/node_modules/pkg/index.js")
        # A later call does not seed again: a node_modules removed by the agent stays removed.
        subprocess.run(["rm", "-rf", str(wt / "web/node_modules")], check=True)
        self.hook(wt)
        self.assertFalse((wt / "web/node_modules").exists())

    def test_hook_ignores_the_main_checkout_and_unrelated_dirs(self):
        for cwd in (self.main, self.tmp, self.main / ".worktrees"):
            proc = self.hook(cwd)
            self.assertEqual((proc.returncode, proc.stdout, proc.stderr), (0, "", ""))
        self.assertEqual(git("status", "--porcelain", cwd=self.main), "")

    def test_hook_skips_a_worktree_seeded_by_add(self):
        wt = self.add("a")
        subprocess.run(["rm", "-rf", str(wt / "pn/node_modules")], check=True)
        self.assertEqual(self.hook(wt).stderr, "")
        self.assertFalse((wt / "pn/node_modules").exists())

    def test_hook_tolerates_input_without_cwd(self):
        proc = run("/bin/bash", str(HOOK), cwd=self.main, env=self.env, stdin="{}")
        self.assertEqual(proc.returncode, 0)

    def test_hook_matcher_covers_every_shell_and_file_tool(self):
        # Narrowed from every tool: messaging, task and MCP calls never read the
        # worktree, but each of these can be the first call that does.
        hooks = json.loads((HERE.parent / "hooks/hooks.json").read_text())
        matcher = hooks["hooks"]["PreToolUse"][0]["matcher"]
        shell_and_file = ("Bash", "Read", "Edit", "Write", "MultiEdit", "NotebookEdit", "Glob", "Grep", "LSP",
                          "mcp__plugin_context-mode_context-mode__ctx_execute",
                          "mcp__plugin_context-mode_context-mode__ctx_batch_execute")
        for tool in shell_and_file:
            self.assertRegex(tool, f"^(?:{matcher})$")
        for tool in ("SendMessage", "TaskUpdate", "Agent", "mcp__slack__search"):
            self.assertNotRegex(tool, f"^(?:{matcher})$")

    @needs_clones
    def test_hook_reads_a_large_tool_input_quickly_and_whole(self):
        wt = self.claude_worktree("big-input")
        payload = json.dumps({"session_id": "s", "cwd": str(wt), "tool_input": {"content": "x" * (2 << 20)}})
        writer = subprocess.Popen(
            ["/bin/bash", str(HOOK)], stdin=subprocess.PIPE, stderr=subprocess.DEVNULL, env=self.env, cwd=self.main
        )
        writer.communicate(payload.encode(), timeout=60)  # raises BrokenPipeError if the hook stopped reading
        self.assertEqual(writer.returncode, 0)
        self.assertTrue((wt / "web/node_modules").exists())

    # --- prune -----------------------------------------------------------------

    def prune(self, *args, cwd=None):
        return self.script("prune", *args, cwd=cwd, check=False)

    def test_prune_removes_only_landed_idle_clean_worktrees(self):
        landed = self.add("landed")
        dirty = self.add("dirty")
        (dirty / "new.txt").write_text("wip\n")
        ahead = self.add("ahead")
        git("commit", "-q", "--allow-empty", "-m", "unpushed", cwd=ahead)
        locked = self.add("locked")
        git("worktree", "lock", str(locked), cwd=self.main)
        self.env["WORKTREE_PRUNE_MIN_AGE"] = "0"
        dry = self.prune("--verbose")
        self.assertIn(f"remove  {landed}\n", dry.stdout)
        self.assertTrue(landed.exists())
        out = self.prune("--apply", "--verbose")
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertIn(f"removed {landed}\n", out.stdout)
        self.assertIn(f"keep    {dirty} (uncommitted changes)\n", out.stdout)
        self.assertIn(f"keep    {ahead} (work not in origin/main)\n", out.stdout)
        self.assertIn(f"keep    {locked} (locked)\n", out.stdout)
        self.assertFalse(landed.exists())
        self.assertTrue(dirty.exists() and ahead.exists())
        self.assertEqual(git("branch", "--list", "landed", cwd=self.main), "landed")

    def test_prune_output_is_bounded_without_verbose(self):
        for name in ("k1", "k2"):
            self.add(name)
        out = self.prune().stdout
        self.assertEqual(out.splitlines(), ["0 would be removed, 2 kept (2 used in the last 120 min). Re-run with --apply to remove."])

    def test_prune_keeps_a_worktree_a_process_runs_in(self):
        wt = self.add("busy")
        proc = subprocess.Popen(["sleep", "60"], cwd=wt / "web")
        self.addCleanup(proc.wait)
        self.addCleanup(proc.kill)
        self.env["WORKTREE_PRUNE_MIN_AGE"] = "0"
        out = self.prune("--apply", "--verbose").stdout
        self.assertIn(f"keep    {wt} (a process runs in it)\n", out)

    def test_prune_removes_a_squash_merged_branch_whose_upstream_is_gone(self):
        wt = self.add("squashed")
        git("commit", "-q", "--allow-empty", "-m", "work", cwd=wt)
        git("push", "-q", "-u", "origin", "squashed", cwd=wt)
        git("push", "-q", "origin", "--delete", "squashed", cwd=self.main)
        git("fetch", "-q", "--prune", cwd=self.main)
        self.env["WORKTREE_PRUNE_MIN_AGE"] = "0"
        out = self.prune("--apply").stdout
        self.assertIn(f"removed {wt}\n", out)

    def test_prune_keeps_the_holder_of_a_kept_nested_worktree(self):
        outer = self.add("outer")
        inner = outer / ".worktrees/inner"
        git("worktree", "add", "-q", "-b", "inner", str(inner), cwd=self.main)
        (inner / "wip.txt").write_text("wip\n")
        self.env["WORKTREE_PRUNE_MIN_AGE"] = "0"
        out = self.prune("--apply", "--verbose").stdout
        self.assertIn(f"keep    {outer} (holds kept worktree {inner})\n", out)

    def test_prune_keeps_a_worktree_with_no_index_yet(self):
        wt = self.main / ".worktrees/bare"
        git("worktree", "add", "-q", "--no-checkout", "-b", "bare", str(wt), cwd=self.main)
        out = self.prune("--apply", "--verbose")
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertIn(f"keep    {wt} (used in the last 120 min)\n", out.stdout)

    def test_prune_keeps_the_current_worktree(self):
        wt = self.add("here")
        self.env["WORKTREE_PRUNE_MIN_AGE"] = "0"
        out = self.prune("--apply", "--verbose", cwd=wt).stdout
        self.assertIn(f"keep    {wt} (current worktree)\n", out)

    def test_prune_delete_branches_deletes_only_merged_ones(self):
        landed = self.add("landed")
        squashed = self.add("squashed")
        git("commit", "-q", "--allow-empty", "-m", "work", cwd=squashed)
        git("push", "-q", "-u", "origin", "squashed", cwd=squashed)
        git("push", "-q", "origin", "--delete", "squashed", cwd=self.main)
        git("fetch", "-q", "--prune", cwd=self.main)
        self.env["WORKTREE_PRUNE_MIN_AGE"] = "0"
        out = self.prune("--apply", "--delete-branches").stdout
        self.assertIn(f"removed {landed}\n", out)
        self.assertIn("deleted branch landed\n", out)
        self.assertIn("kept branch squashed (not merged into origin/main)\n", out)
        self.assertEqual(git("branch", "--list", "landed", cwd=self.main), "")
        self.assertEqual(git("branch", "--list", "squashed", cwd=self.main), "squashed")

    # --- remove ----------------------------------------------------------------

    def test_remove_deletes_a_clean_worktree_and_its_merged_branch(self):
        wt = self.add("done")
        out = self.script("remove", str(wt), "--delete-branch")
        self.assertIn(f"removed {wt}\n", out.stdout)
        self.assertIn("deleted branch done\n", out.stdout)
        self.assertFalse(wt.exists())
        self.assertNotIn(str(wt), git("worktree", "list", cwd=self.main))
        self.assertEqual(git("branch", "--list", "done", cwd=self.main), "")

    def test_remove_keeps_uncommitted_work(self):
        wt = self.add("wip")
        (wt / "new.txt").write_text("wip\n")
        out = self.script("remove", str(wt), "--delete-branch", check=False)
        self.assertEqual(out.returncode, 1)
        self.assertIn("uncommitted changes", out.stderr)
        self.assertTrue((wt / "new.txt").exists())
        self.assertEqual(git("branch", "--list", "--format=%(refname:short)", "wip", cwd=self.main), "wip")

    def test_remove_keeps_an_unmerged_branch(self):
        wt = self.add("ahead")
        git("commit", "-q", "--allow-empty", "-m", "unpushed", cwd=wt)
        out = self.script("remove", str(wt), "--delete-branch")
        self.assertFalse(wt.exists())
        self.assertIn("kept branch ahead (not merged into origin/main)\n", out.stdout)
        self.assertEqual(git("branch", "--list", "ahead", cwd=self.main), "ahead")

    def test_remove_without_flag_keeps_the_branch(self):
        wt = self.add("keep")
        self.script("remove", str(wt))
        self.assertFalse(wt.exists())
        self.assertEqual(git("branch", "--list", "keep", cwd=self.main), "keep")

    def test_remove_refuses_the_main_checkout_and_locked_worktrees(self):
        out = self.script("remove", str(self.main), check=False)
        self.assertNotEqual(out.returncode, 0)
        self.assertTrue(self.main.exists())
        wt = self.add("locked")
        git("worktree", "lock", str(wt), cwd=self.main)
        out = self.script("remove", str(wt), check=False)
        self.assertNotEqual(out.returncode, 0)
        self.assertTrue(wt.exists())


if __name__ == "__main__":
    unittest.main()
