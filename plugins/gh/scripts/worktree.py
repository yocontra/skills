#!/usr/bin/env python3
"""Seed and prune git worktrees so each one costs little disk.

A fresh worktree normally pays full price: every tracked file is written out
again and every install is rebuilt from nothing. On APFS a clone
(clonefile(2)) shares blocks with its source until one side writes, so `seed`
clones what the main checkout already has instead of copying it:

  * tracked files of 64 KiB or more whose bytes match the main checkout's copy
    (a model file, a fixture, a vendored binary);
  * every gitignored node_modules/ whose lockfile (package-lock.json or
    pnpm-lock.yaml) is byte-identical to the main checkout's, and which npm's
    or pnpm's own install record shows is a finished install of exactly that
    lockfile, so it needs no `npm ci` (which would delete it).

Left alone on purpose: .venv/ (`uv sync` already clones from the one shared uv
cache, and a cloned venv carries the main checkout's paths in its shebangs and
editable installs) and .mypy_cache/ (measured: mypy rewrote the whole cloned
cache, so it saved nothing and ran slower). Off macOS, or across volumes,
nothing is cloned.

Subcommands:
  add [git worktree add args]  `git worktree add ...`, then seed the new worktree.
  seed <worktree>              seed an existing linked worktree.
  remove <worktree> [--delete-branch]
                               remove one clean worktree you made, prune its
                               metadata, and with --delete-branch delete its
                               branch if it is merged into origin's default branch.
  prune [--apply] [--verbose] [--delete-branches]
                               remove worktrees whose work has landed; with
                               --delete-branches also delete their merged branches.

seed-hook.sh, the plugin's PreToolUse hook, runs `seed` once per worktree on
the first shell or file tool call made inside it, which covers worktrees Claude Code creates
itself (`isolation: "worktree"`, `--worktree`).
"""

from __future__ import annotations

import collections
import ctypes
import errno
import filecmp
import json
import os
import stat
import subprocess
import sys
import time
from pathlib import Path

MIN_CLONE_BYTES = 64 << 10
# Lockfiles a node_modules/ can belong to. Only npm and pnpm leave a record in
# node_modules/ of the lockfile they installed (see install_matches), so a
# yarn or bun tree is never cloned.
LOCKFILES = ("package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb")
# In the worktree's git dir: the marker once it is seeded (seed-hook.sh checks
# it), the lock while it is being seeded.
SEEDED_MARKER = "gh-worktree-seeded"
SEEDING_LOCK = "gh-worktree-seeding"
PRUNE_DIRS = (".worktrees", ".claude/worktrees")


def log(msg: str) -> None:
    print(f"worktree: {msg}", file=sys.stderr)


def git(*args: str, cwd: Path | str, check: bool = True) -> str:
    proc = subprocess.run(["git", *args], cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if check and proc.returncode != 0:
        raise SystemExit(f"worktree: git {' '.join(args)} failed in {cwd}:\n{proc.stderr.strip()}")
    return proc.stdout


def worktrees(repo: Path | str) -> list[dict[str, str]]:
    """`git worktree list --porcelain` as one dict per worktree; the first is the main one."""
    out = []
    for block in git("worktree", "list", "--porcelain", cwd=repo).split("\n\n"):
        entry = {}
        for line in block.splitlines():
            key, _, value = line.partition(" ")
            entry[key] = value
        if "worktree" in entry:
            out.append(entry)
    return out


def main_checkout(repo: Path | str) -> Path | None:
    """The main working tree of the repo, even from a linked worktree; None for a bare repo."""
    first = worktrees(repo)[0]
    return None if "bare" in first else Path(first["worktree"])


def inside(path: Path, root: Path) -> bool:
    """Whether path, with every symlink resolved, is still under root."""
    return path.resolve().is_relative_to(root.resolve())


# --- cloning -----------------------------------------------------------------


class Cloner:
    """clonefile(2) on macOS. Stops for good the first time the volume cannot clone."""

    def __init__(self) -> None:
        self.reason = ""
        self._fn = None
        if sys.platform != "darwin":
            self.reason = "not macOS, so no clonefile(2)"
            return
        fn = ctypes.CDLL("libc.dylib", use_errno=True).clonefile
        fn.argtypes = (ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint32)
        fn.restype = ctypes.c_int
        self._fn = fn

    def clone(self, src: Path, dst: Path) -> bool:
        """Clone src (a file or a directory tree) to dst, which must not exist."""
        if self._fn is None or self.reason:
            return False
        if self._fn(os.fsencode(src), os.fsencode(dst), 0) == 0:
            return True
        err = ctypes.get_errno()
        if err in (errno.ENOTSUP, errno.EXDEV, errno.ENOSYS):
            self.reason = f"cannot clone {src} to {dst}: {os.strerror(err)}"
            return False
        raise OSError(err, f"clonefile {src} -> {dst}: {os.strerror(err)}")


def staging_for(dst: Path) -> Path:
    return dst.with_name(f".{dst.name}.clone-{os.getpid()}")


def file_id(st: os.stat_result) -> tuple[int, int, int, int]:
    """What changes when anything writes or replaces a file."""
    return (st.st_ino, st.st_size, st.st_mtime_ns, st.st_ctime_ns)


def remove_tree(p: Path) -> None:
    if p.is_dir() and not p.is_symlink():
        subprocess.run(["rm", "-rf", str(p)], check=True)
    elif p.exists() or p.is_symlink():
        p.unlink()


# --- seeding -----------------------------------------------------------------


def index_blobs(repo: Path) -> dict[str, tuple[str, str]]:
    """path -> (mode, blob) for every regular file in repo's index."""
    out: dict[str, tuple[str, str]] = {}
    for entry in git("ls-files", "-s", "-z", cwd=repo).split("\0"):
        if not entry:
            continue
        meta, path = entry.split("\t", 1)
        mode, blob, _stage = meta.split(" ")
        if mode in ("100644", "100755"):
            out[path] = (mode, blob)
    return out


def seed_tracked(cloner: Cloner, main: Path, wt: Path) -> tuple[int, int]:
    main_index = index_blobs(main)
    count = size = 0
    for path, entry in index_blobs(wt).items():
        if main_index.get(path) != entry:
            continue
        src, dst = main / path, wt / path
        try:
            st = dst.lstat()
            src_st = src.lstat()
        except FileNotFoundError:
            continue  # outside a sparse checkout, or deleted in the main checkout
        # The mode too: the clone takes the main copy's, and an uncommitted chmod
        # there would show up as a change in the worktree.
        if (
            st.st_size < MIN_CLONE_BYTES
            or (src_st.st_size, src_st.st_mode) != (st.st_size, st.st_mode)
            or not stat.S_ISREG(src_st.st_mode)
        ):
            continue
        staging = staging_for(dst)
        if not cloner.clone(src, staging):
            break
        # Same blob in both indexes, but the main checkout's copy may carry
        # uncommitted edits, or change while this runs. Compare the clone, a
        # point-in-time snapshot of one file, and keep it only if it is
        # byte-identical, and only if nothing wrote the worktree copy meanwhile
        # (another agent, a git checkout): its identity must still be the one
        # read before the compare.
        try:
            if filecmp.cmp(staging, dst, shallow=False) and file_id(dst.lstat()) == file_id(st):
                os.replace(staging, dst)
                count += 1
                size += st.st_size
        finally:
            if staging.exists():
                staging.unlink()
    if count:
        # The clones are new files to git; refresh the index so `git status` stays cheap.
        git("update-index", "-q", "--refresh", cwd=wt, check=False)
    return count, size


def ignored_node_modules(main: Path) -> list[Path]:
    """Every gitignored node_modules/ in the main checkout. Git collapses ignored
    directories, so this never walks into one, nor into nested worktrees."""
    out = git("ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--directory", cwd=main)
    rels = (Path(p.rstrip("/")) for p in out.split("\0") if p)
    return [r for r in rels if r.name == "node_modules"]


def lockfile_for(root: Path, rel_dir: Path) -> Path | None:
    """The nearest lockfile at or above that directory (a workspace member uses the root's)."""
    for d in (rel_dir, *rel_dir.parents):
        for name in LOCKFILES:
            if (root / d / name).is_file():
                return d / name
    return None


def install_record(repo: Path, lock: Path) -> Path:
    """The record npm or pnpm writes into repo's node_modules/ next to lock at the end of an install."""
    name = ".pnpm/lock.yaml" if lock.name == "pnpm-lock.yaml" else ".package-lock.json"
    return repo / lock.parent / "node_modules" / name


def install_matches(repo: Path, lock: Path) -> bool:
    """Whether repo's node_modules/ next to lock is a finished install of exactly that lockfile.

    Lockfile bytes alone cannot say: a `git pull` moves the lockfile and leaves
    node_modules/ as the last install made it, and an install still running
    has not finished. Both npm and pnpm write their own record at the end of an
    install, so compare against that. npm: every package in
    node_modules/.package-lock.json carries the lockfile's exact entry, and
    every lockfile package is there unless optional (npm skips other
    platforms' optional builds). pnpm: node_modules/.pnpm/lock.yaml is the
    lockfile it installed. yarn and bun keep no such record, so never match."""
    record = install_record(repo, lock)
    if lock.name == "pnpm-lock.yaml":
        return record.is_file() and filecmp.cmp(record, repo / lock, shallow=False)
    if lock.name != "package-lock.json":
        return False
    try:
        pinned = json.loads((repo / lock).read_text()).get("packages", {})
        hidden = json.loads(record.read_text()).get("packages", {})
    except (OSError, ValueError):
        return False
    if any(key and pinned.get(key) != entry for key, entry in hidden.items()):
        return False
    return all(not key or key in hidden or entry.get("optional") for key, entry in pinned.items())


def seed_node_modules(cloner: Cloner, main: Path, wt: Path) -> list[str]:
    seeded = []
    for rel in ignored_node_modules(main):
        src, dst = main / rel, wt / rel
        if src.is_symlink() or not src.is_dir() or dst.exists() or dst.is_symlink():
            continue
        # A committed symlink in the worktree must not carry the clone outside it.
        if not dst.parent.is_dir() or not inside(dst.parent, wt):
            continue
        lock = lockfile_for(wt, rel.parent)
        if lock is None or not (main / lock).is_file() or not inside(wt / lock, wt):
            continue
        if not filecmp.cmp(main / lock, wt / lock, shallow=False) or not install_matches(main, lock):
            continue
        # clonefile(2) copies a directory one entry at a time, so the clone is
        # not a snapshot: an install that starts in the main checkout meanwhile
        # can leave it half old, half new. Any install adds or removes entries
        # at the top of node_modules/ and rewrites its record, so drop the clone
        # if either changed while it was taken.
        watched = install_watch(main, lock, rel)
        before = [file_id(p.lstat()) for p in watched]
        staging = staging_for(dst)
        if not cloner.clone(src, staging):
            break
        try:
            if [file_id(p.lstat()) for p in watched] != before:
                remove_tree(staging)
                continue
            os.replace(staging, dst)
        except OSError:
            remove_tree(staging)
            raise
        seeded.append(str(rel))
    return seeded


def install_watch(main: Path, lock: Path, rel: Path) -> list[Path]:
    """The paths an install in the main checkout changes: the node_modules/ being
    cloned, the install root's node_modules/, and the record install_matches reads."""
    return list(dict.fromkeys([main / rel, main / lock.parent / "node_modules", install_record(main, lock)]))


def seed(wt: Path) -> None:
    """Clone what the main checkout has into the linked worktree wt, once.

    The worktree's git dir records it: a marker once seeded (seed-hook.sh
    checks it on every tool call), and a lock while seeding, so concurrent
    callers do not seed the same worktree twice. Seeding only saves disk, so a
    clone that fails is reported and the worktree stays usable."""
    wt = Path(git("rev-parse", "--show-toplevel", cwd=wt).strip())
    main = main_checkout(wt)
    if main is None or main == wt:
        log(f"{wt} is not a linked worktree with a main checkout; nothing to seed")
        return
    gitdir = Path(git("rev-parse", "--path-format=absolute", "--git-dir", cwd=wt).strip())
    if (gitdir / SEEDED_MARKER).exists():
        return
    lock = gitdir / SEEDING_LOCK
    try:
        lock.mkdir()
    except FileExistsError:
        log(f"{wt} is being seeded by another process")
        return
    try:
        seed_unlocked(main, wt)
    finally:
        # Marked even when seeding failed, so a broken seed is not retried on every call.
        (gitdir / SEEDED_MARKER).touch()
        lock.rmdir()


def seed_unlocked(main: Path, wt: Path) -> None:
    cloner = Cloner()
    started = time.monotonic()
    parts = []
    try:
        count, size = seed_tracked(cloner, main, wt)
        parts.append(f"{count} tracked files ({size >> 20} MB)")
    except OSError as e:
        log(f"tracked files: seeding stopped: {e}")
    try:
        modules = seed_node_modules(cloner, main, wt)
        parts += modules or ["no node_modules (none installed from a matching lockfile)"]
        if modules:
            log("cloned node_modules already match the lockfile: skip `npm ci`, which deletes them")
    except OSError as e:
        log(f"node_modules: seeding stopped: {e}")
    if cloner.reason:
        log(f"seeding stopped: {cloner.reason}")
    log(f"cloned from {main} in {time.monotonic() - started:.1f}s: {', '.join(parts)}")
    uv_cache = os.environ.get("UV_CACHE_DIR", "")
    if uv_cache and inside(Path(uv_cache), wt):
        log(f"UV_CACHE_DIR={uv_cache} is inside the worktree, so its venv shares nothing; unset it")


def add(argv: list[str]) -> int:
    """`git worktree add` with the arguments as given, then seed the worktree it created.

    That is the new worktree whose path is one of the arguments; other agents
    may create worktrees at the same moment, and those are not ours to seed."""
    before = {w["worktree"] for w in worktrees(os.getcwd())}
    proc = subprocess.run(["git", "worktree", "add", *argv])
    if proc.returncode != 0:
        return proc.returncode
    named = {os.path.realpath(a) for a in argv if not a.startswith("-")}
    for w in worktrees(os.getcwd()):
        if w["worktree"] not in before and os.path.realpath(w["worktree"]) in named:
            seed(Path(w["worktree"]))
    return 0


# --- pruning -----------------------------------------------------------------


class ProcessCwds:
    """Working directories of every process on the host, read once, on first use."""

    def __init__(self) -> None:
        self._cwds: list[str] | None = None

    def runs_in(self, p: Path) -> bool:
        if self._cwds is None:
            try:
                proc = subprocess.run(["lsof", "-b", "-nP", "-d", "cwd", "-Fn"], stdout=subprocess.PIPE, text=True)
            except FileNotFoundError:
                raise SystemExit("worktree: prune needs lsof to tell which worktrees are in use") from None
            self._cwds = [line[1:] for line in proc.stdout.splitlines() if line.startswith("n")]
            # `lsof` always lists at least its own cwd; nothing means it could not look.
            if not self._cwds:
                raise SystemExit("worktree: lsof listed no processes, so prune cannot tell which worktrees are in use")
        return any(c == str(p) or c.startswith(f"{p}/") for c in self._cwds)


def index_age(p: Path) -> float:
    """Seconds since the worktree's index last changed; 0 when it has none yet
    (a `--no-checkout` worktree), which reads as just used."""
    index = Path(git("rev-parse", "--path-format=absolute", "--git-path", "index", cwd=p).strip())
    try:
        return time.time() - index.stat().st_mtime
    except FileNotFoundError:
        return 0.0


def landed(p: Path, target: str) -> bool:
    """HEAD is in the default branch, or the branch's upstream was deleted (a
    squash- or rebase-merged PR whose branch was removed after merge)."""
    if subprocess.run(["git", "merge-base", "--is-ancestor", "HEAD", target], cwd=p).returncode == 0:
        return True
    branch = git("symbolic-ref", "-q", "HEAD", cwd=p, check=False).strip()
    if not branch:
        return False
    return git("for-each-ref", "--format=%(upstream:track)", branch, cwd=p).strip() == "[gone]"


def default_target(root: Path) -> str:
    """origin's default branch as a ref name, such as origin/main."""
    target = git("symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD", cwd=root, check=False).strip()
    if not target:
        raise SystemExit("worktree: origin/HEAD is not set; run `git remote set-head origin --auto`")
    return target


def is_dirty(p: Path) -> bool:
    """Uncommitted changes, untracked files included. A failed status counts as dirty.
    --no-optional-locks: a plain `git status` can rewrite the index and reset its age."""
    status = subprocess.run(
        ["git", "--no-optional-locks", "status", "--porcelain"], cwd=p, stdout=subprocess.PIPE, text=True
    )
    return status.returncode != 0 or bool(status.stdout.strip())


def delete_merged_branch(root: Path, branch: str, target: str) -> str:
    """Delete a local branch only when its tip is already in target and no
    worktree has it checked out, so no commit can be lost. Returns what happened."""
    short = branch.removeprefix("refs/heads/")
    if any(w.get("branch") == f"refs/heads/{short}" for w in worktrees(root)):
        return f"kept branch {short} (checked out in another worktree)"
    if subprocess.run(["git", "merge-base", "--is-ancestor", f"refs/heads/{short}", target], cwd=root).returncode:
        return f"kept branch {short} (not merged into {target})"
    # -D because -d judges against the current HEAD, not target; ancestry was checked above.
    git("branch", "-D", short, cwd=root)
    return f"deleted branch {short}"


def remove(path: str, delete_branch: bool) -> int:
    """Undo `add` for one worktree: refuse when it has uncommitted work, else
    `git worktree remove` (no --force), `git worktree prune`, and optionally
    delete its branch when merged. Never touches the main checkout."""
    root = main_checkout(os.getcwd())
    if root is None:
        raise SystemExit("worktree: remove needs a repo with a main checkout")
    wt = Path(path).resolve()
    entry = next((w for w in worktrees(root)[1:] if Path(w["worktree"]).resolve() == wt), None)
    if entry is None:
        raise SystemExit(f"worktree: {wt} is not a linked worktree of {root}")
    if "locked" in entry:
        raise SystemExit(f"worktree: {wt} is locked; unlock it first if it is yours")
    if Path(os.getcwd()).resolve().is_relative_to(wt):
        raise SystemExit(f"worktree: run remove from outside {wt}")
    if wt.is_dir() and is_dirty(wt):
        print(f"kept    {wt} (uncommitted changes; commit or discard them first)", file=sys.stderr)
        return 1
    branch = entry.get("branch", "")
    if wt.is_dir() and subprocess.run(["git", "worktree", "remove", str(wt)], cwd=root).returncode:
        return 1
    git("worktree", "prune", cwd=root)
    print(f"removed {wt}")
    if delete_branch and branch:
        print(delete_merged_branch(root, branch, default_target(root)))
    return 0


def prune(apply: bool, verbose: bool, delete_branches: bool = False) -> int:
    """Remove worktrees under .worktrees/ and .claude/worktrees/ whose work has landed.

    Kept: the current worktree, locked ones, ones whose work has not landed
    (see landed()), ones whose index changed in the last WORKTREE_PRUNE_MIN_AGE
    seconds (default 7200, so a fresh worktree that has not diverged yet
    survives), dirty ones (untracked files count), ones a process runs in, and
    ones holding a kept worktree. Removal is `git worktree remove` without
    --force. Branches are kept unless delete_branches, and then only a branch
    whose tip is in the default branch (see delete_merged_branch). Dry run unless apply. Prints the worktrees it
    removes and a count of kept ones per reason; --verbose lists every kept one.
    """
    here = Path(git("rev-parse", "--show-toplevel", cwd=os.getcwd()).strip())
    root = main_checkout(here)
    if root is None:
        raise SystemExit("worktree: prune needs a repo with a main checkout")
    target = default_target(root)
    min_age = int(os.environ.get("WORKTREE_PRUNE_MIN_AGE", "7200"))
    cwds = ProcessCwds()

    entries = [
        (Path(w["worktree"]), "locked" in w, w.get("branch", ""))
        for w in worktrees(root)[1:]
        if any(Path(w["worktree"]).is_relative_to(root / d) for d in PRUNE_DIRS)
    ]
    entries.sort(key=lambda e: -len(str(e[0])))  # nested worktrees first

    kept: list[Path] = []
    reasons: collections.Counter[str] = collections.Counter()
    removed = failed = 0
    removed_branches: list[str] = []
    for p, locked, branch in entries:
        reason = ""
        if p == here:
            reason = "current worktree"
        elif locked:
            reason = "locked"
        elif not p.is_dir():
            reason = "missing (git worktree prune clears it)"
        elif not landed(p, target):
            reason = f"work not in {target}"
        elif index_age(p) < min_age:
            reason = f"used in the last {min_age // 60} min"
        else:
            if is_dirty(p):
                reason = "uncommitted changes"
            elif cwds.runs_in(p):
                reason = "a process runs in it"
            else:
                reason = next((f"holds kept worktree {k}" for k in kept if k.is_relative_to(p)), "")
        if reason:
            kept.append(p)
            reasons["holds a kept worktree" if reason.startswith("holds") else reason] += 1
            if verbose:
                print(f"keep    {p} ({reason})")
        elif not apply:
            print(f"remove  {p}")
            removed += 1
        elif subprocess.run(["git", "worktree", "remove", str(p)], cwd=root).returncode == 0:
            print(f"removed {p}")
            removed += 1
            if branch:
                removed_branches.append(branch)
        else:
            print(f"FAILED  {p}", file=sys.stderr)
            kept.append(p)
            failed += 1
    summary = ", ".join(f"{n} {r}" for r, n in reasons.most_common())
    if apply:
        git("worktree", "prune", cwd=root)
        if delete_branches:
            for branch in removed_branches:
                print(delete_merged_branch(root, branch, target))
        print(f"{removed} removed, {failed} failed, {len(kept) - failed} kept ({summary or 'none'})")
    else:
        print(f"{removed} would be removed, {len(kept)} kept ({summary or 'none'}). Re-run with --apply to remove.")
    return 1 if failed else 0


def cli(argv: list[str]) -> int:
    cmd, rest = (argv[0], argv[1:]) if argv else ("", [])
    if cmd == "add" and rest:
        return add(rest)
    if cmd == "seed" and len(rest) == 1:
        seed(Path(rest[0]))
        return 0
    if cmd == "remove":
        paths = [a for a in rest if a != "--delete-branch"]
        if len(paths) == 1 and not paths[0].startswith("-"):
            return remove(paths[0], "--delete-branch" in rest)
    if cmd == "prune" and set(rest) <= {"--apply", "--verbose", "--delete-branches"}:
        return prune(apply="--apply" in rest, verbose="--verbose" in rest, delete_branches="--delete-branches" in rest)
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(cli(sys.argv[1:]))
