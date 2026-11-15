#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""scan-project.py — deterministic inventory for /agent-ready:uplift.

Reads project files + greps codebase; emits one JSON object on stdout. The
agent's job is to read this output and decide which probes to run in the
verify phase, not to re-explore the same files every session.

Usage: scan-project.py [project-root]
       (defaults to $PWD)

Read-only: it reads files and runs `git` read commands with repo hooks and
fsmonitor disabled. It writes nothing, starts no background process, and never
captures secret values.

Output schema (all keys always present, values vary):

  {
    "project_root": "string (absolute)",
    "host": {"os": "darwin|linux|...", "shell": "string|null (basename of $SHELL)"},
    "git": {"in_repo": bool, "head_branch": "string|null", "remote": "string|null"},
    "claude": {
      "settings_present": bool, "settings_path": "string|null",
      "local_settings_present": bool,
      "enabled_plugins": ["string"], "permissions_allow_count": int,
      "permissions": {"allow": int, "ask": int, "deny": int, "default_mode": "string|null",
                      "broad_allow": ["string (allow rules that grant a whole tool or shell)"]},
      "hook_events": ["string (hook event names configured in project settings)"],
      "mcp_config_present": bool, "mcp_config_path": "string|null",
      "mcp_servers": ["string (server names declared in the project MCP config)"],
      "project_skills": [{"name": "string", "path": "string"}],
      "config_files": ["string (basename of .claude/config/*.yaml)"]
    },
    "claude_md": {
      "present": bool, "path": "string|null", "line_count": int,
      "headings": ["string"], "model_refs": ["string (claude-* ids found in the doc)"]
    },
    "manifests": {
      "python": {"pyproject": bool, "uv_lock": bool, "setup_py": bool, "requirements": bool,
                 "private_index": ["string (host)"]},
      "node":   {"package_json": bool, "package_lock": bool, "pnpm_lock": bool, "yarn_lock": bool,
                 "private_registry": ["string (host)"]},
      "rust":   {"cargo_toml": bool, "cargo_lock": bool},
      "go":     {"go_mod": bool, "go_sum": bool},
      "ruby":   {"gemfile": bool, "gemfile_lock": bool},
      "swift":  {"package_swift": bool, "xcodeproj": bool, "xcconfig_count": int},
      "bazel":  {"module_bazel": bool, "build_bazel_count": int, "workspace": bool}
    },
    "toolchain_versions": {
      ".tool-versions": "string|null", ".python-version": "string|null",
      ".nvmrc": "string|null", "mise.toml": bool, ".ruby-version": "string|null"
    },
    "hooks": {"makefile_targets": ["string"], "prek_toml": bool, "pre_commit_config": bool},
    "test_config": {"tsconfig": bool, "jest": bool, "vitest": bool, "pytest_ini": bool, "tox_ini": bool},
    "lint_config": {"biome": bool, "ruff": bool, "eslint": bool, "prettier": bool, "editorconfig": bool},
    "dev_env": {"devcontainer": bool, "flake_nix": bool, "shell_nix": bool, "vscode_tasks": bool, "zed_tasks": bool},
    "ci": {"github_actions_count": int, "gitlab_ci": bool, "circleci": bool, "jenkinsfile": bool,
           "buildkite": bool, "azure_pipelines": bool, "bitbucket_pipelines": bool,
           "travis": bool, "drone": bool, "providers": ["string"]},
    "kube_helm": {"helm_dir": bool, "values_yaml_count": int, "kustomization": bool, "chart_yaml": bool},
    "deploy_topology": {
      "config_files": ["string (relpath)"], "environments": ["string"],
      "namespaces": ["string"], "clusters": ["string"]
    },
    "containers": {"dockerfile_count": int, "docker_compose": bool, "procfile": bool,
                   "registries": ["string (non-Docker-Hub registry hosts)"]},
    "gitignore": {"present": bool, "local_settings_ignored": bool, "claude_local_md_ignored": bool},
    "env_files": {"envrc": bool, "env_files": ["string"], "env_var_names": ["string"]},
    "test_data": {"fixtures": bool, "golden": bool, "cassettes_count": int, "snapshots_count": int, "dvc_yaml": bool, "lfs_tracked": bool},
    "evidence": {
      "sibling_paths": ["string"], "service_hosts": {"<host>": int}
    },
    "dev_loop": {
      "setup": "string|null", "build": "string|null", "test": "string|null",
      "lint": "string|null", "run": "string|null"
    }
  }

Notes:
- Per-source detection: presence-or-absence; the agent decides what to do.
- Service hosts: count of matching grep lines, not lines themselves (token budget).
  Some entries are bare words (splunk, sentry, datadog); they match substrings, so
  counts are evidence signal, not exact-hostname hits.
- env_var_names: keys from .env files; values NEVER captured.
- Directory globs prune EXCLUDE_DIRS during traversal (never descending into
  them); recursive `**` globs walk the full pruned tree. The evidence grep is a
  single ripgrep pass over the same pruned set.
"""

import fnmatch
import json
import os
import pathlib
import platform
import re
import shutil
import subprocess
import sys

EXCLUDE_DIRS = {".git", "node_modules", ".venv", "venv", "dist", "build",
                "__pycache__", ".next", ".cache", ".pytest_cache", ".ruff_cache",
                "target", ".mypy_cache", ".tox"}

SERVICE_HOSTS = [
    "amazonaws.com", "googleapis.com", "azure.com", "cloudflare.com",
    "vercel.app", "herokuapp.com", "splunk", "sentry", "honeycomb",
    "datadog", "pagerduty", "grafana", "confluence", "atlassian.net",
    "jfrog.io", "ghcr.io", "gcr.io", "pkg.dev", "ecr.", "quay.io",
]

# Package indexes that need no project-specific setup. Any other index a repo
# declares is private: installs fail until the machine can reach and auth to it.
PUBLIC_INDEX_HOSTS = {"pypi.org", "files.pythonhosted.org", "registry.npmjs.org",
                      "registry.yarnpkg.com"}
_URL_HOST_RE = re.compile(r"https?://(?:[^@/\s]+@)?([A-Za-z0-9.-]+)")


def first_line(p):
    try:
        return pathlib.Path(p).read_text().splitlines()[0].strip()
    except (OSError, IndexError, UnicodeDecodeError):
        return None


def safe_read(p):
    """read_text that never raises: '' on missing, unreadable, or non-UTF-8."""
    try:
        return pathlib.Path(p).read_text(errors="ignore")
    except OSError:
        return ""


def glob_count(root, pattern):
    """Count entries matching a glob, pruning EXCLUDE_DIRS during traversal.

    Two shapes are used here: a top-level glob (`requirements*.txt`) and a
    recursive `**/<name>` glob. The walk never descends into EXCLUDE_DIRS, so
    heavy trees (node_modules, .venv, target, .git) are skipped entirely rather
    than walked-then-filtered -- the exclusion bounds traversal, not just the
    count. Non-recursive patterns match root's immediate entries only.
    """
    root = pathlib.Path(root)
    recursive = pattern.startswith("**/")
    name_pat = pattern[3:] if recursive else pattern
    n = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        n += sum(1 for name in filenames + dirnames if fnmatch.fnmatch(name, name_pat))
        if not recursive:  # top-level only: do not descend past root
            dirnames[:] = []
    return n


def git_info(root):
    r = pathlib.Path(root)

    def git(*args):
        try:
            # Harden against untrusted-repo config: uplift may be pointed at
            # a freshly-cloned tree. Disabling fsmonitor/hooks keeps these
            # read-only commands from triggering repo-controlled code paths.
            return subprocess.check_output(
                ["git", "-C", str(r), "-c", "core.fsmonitor=", "-c", "core.hooksPath=/dev/null", *args],
                stderr=subprocess.DEVNULL, timeout=3
            ).decode().strip()
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
            return None

    # rev-parse walks up to the work-tree root, so a scoped subdirectory of a
    # repo is still detected as in_repo (a bare `root/.git` check would miss it).
    if git("rev-parse", "--is-inside-work-tree") != "true":
        return {"in_repo": False, "head_branch": None, "remote": None}
    return {
        "in_repo": True,
        "head_branch": git("rev-parse", "--abbrev-ref", "HEAD"),
        "remote": git("remote", "get-url", "origin"),
    }


# Allow rules that grant a whole tool rather than a scoped command. These are
# worth a warning: an unattended agent with `Bash(*)` can run anything.
_BROAD_RULES = {"Bash", "Bash(*)", "Bash(:*)", "Write", "Edit", "WebFetch", "*"}


def _is_broad_rule(rule):
    return isinstance(rule, str) and (rule in _BROAD_RULES or rule.endswith("(*)"))


def scan_ci(root):
    r = pathlib.Path(root)
    gha = r / ".github/workflows"
    ci = {
        "github_actions_count": len(list(gha.glob("*.y*ml"))) if gha.is_dir() else 0,
        "gitlab_ci": (r / ".gitlab-ci.yml").exists(),
        "circleci": (r / ".circleci/config.yml").exists(),
        "jenkinsfile": (r / "Jenkinsfile").exists(),
        "buildkite": (r / ".buildkite").is_dir(),
        "azure_pipelines": (r / "azure-pipelines.yml").exists(),
        "bitbucket_pipelines": (r / "bitbucket-pipelines.yml").exists(),
        "travis": (r / ".travis.yml").exists(),
        "drone": (r / ".drone.yml").exists(),
    }
    names = {"github_actions_count": "github-actions", "gitlab_ci": "gitlab-ci",
             "circleci": "circleci", "jenkinsfile": "jenkins", "buildkite": "buildkite",
             "azure_pipelines": "azure-pipelines", "bitbucket_pipelines": "bitbucket-pipelines",
             "travis": "travis", "drone": "drone"}
    ci["providers"] = [names[k] for k in names if ci[k]]
    return ci


def scan_claude(root):
    r = pathlib.Path(root)
    settings = r / ".claude/settings.json"
    local_settings = r / ".claude/settings.local.json"
    mcp_top = r / ".mcp.json"
    mcp_dot = r / ".claude/.mcp.json"

    enabled = set()
    hook_events = set()
    perms = {"allow": 0, "ask": 0, "deny": 0, "default_mode": None, "broad_allow": []}
    settings_path = str(settings) if settings.exists() else None
    for f in (settings, local_settings):
        if not f.exists():
            continue
        try:
            d = json.loads(f.read_text())
        except (json.JSONDecodeError, OSError, UnicodeDecodeError):
            continue
        enabled.update((d.get("enabledPlugins") or {}).keys())
        hooks = d.get("hooks")
        if isinstance(hooks, dict):
            hook_events.update(hooks.keys())
        p = d.get("permissions") or {}
        for key in ("allow", "ask", "deny"):
            perms[key] += len(p.get(key) or [])
        perms["broad_allow"] += [r for r in (p.get("allow") or []) if _is_broad_rule(r)]
        perms["default_mode"] = p.get("defaultMode") or perms["default_mode"]
    perms["broad_allow"] = sorted(set(perms["broad_allow"]))

    mcp_path = None
    if mcp_top.exists():
        mcp_path = str(mcp_top)
    elif mcp_dot.exists():
        mcp_path = str(mcp_dot)
    mcp_servers = []
    if mcp_path:
        try:
            # Names only: server entries can carry tokens in env or headers.
            mcp_servers = sorted((json.loads(pathlib.Path(mcp_path).read_text())
                                  .get("mcpServers") or {}).keys())
        except (json.JSONDecodeError, OSError, UnicodeDecodeError, AttributeError):
            pass

    project_skills = []
    skills_dir = r / ".claude/skills"
    if skills_dir.exists():
        for sd in sorted(skills_dir.iterdir()):
            sk = sd / "SKILL.md"
            if sk.exists():
                project_skills.append({"name": sd.name, "path": str(sk)})

    # Per-project service config the component skills key on: `.claude/config/<svc>.yaml`
    # (kubernetes, terraform, ...). The basename is the component name, so this is
    # the strongest deterministic trigger for those Service component probes.
    config_files = []
    config_dir = r / ".claude/config"
    if config_dir.is_dir():
        config_files = sorted(p.name for p in config_dir.iterdir()
                              if p.suffix in (".yaml", ".yml"))

    return {
        "settings_present": settings.exists(),
        "settings_path": settings_path,
        "local_settings_present": local_settings.exists(),
        "enabled_plugins": sorted(enabled),
        "permissions_allow_count": perms["allow"],
        "permissions": perms,
        "hook_events": sorted(hook_events),
        "mcp_config_present": mcp_path is not None,
        "mcp_config_path": mcp_path,
        "mcp_servers": mcp_servers,
        "project_skills": project_skills,
        "config_files": config_files,
    }


def scan_gitignore(root):
    # Coarse string match on the root .gitignore; `git check-ignore` is the probe
    # that confirms it.
    text = safe_read(pathlib.Path(root) / ".gitignore")
    lines = {ln.strip() for ln in text.splitlines()}
    return {
        "present": bool(text),
        "local_settings_ignored": any("settings.local.json" in ln for ln in lines),
        "claude_local_md_ignored": any("CLAUDE.local.md" in ln for ln in lines),
    }


def scan_claude_md(root):
    r = pathlib.Path(root)
    for name in ("CLAUDE.md", "AGENTS.md"):
        p = r / name
        if p.exists():
            try:
                text = p.read_text()
                lines = text.splitlines()
                headings = [ln.strip() for ln in lines if ln.startswith("## ")]
                # Model ids the doc pins the agent to. Anchored on a model
                # family or a version digit right after `claude-` so prose like
                # `claude-code` / `claude-api` (the CLI and this skill's name)
                # is not mistaken for a model id. A retired/renamed id here
                # means the doc won't work with the current model; the verify
                # probe checks these against the claude-api skill's lists.
                model_refs = sorted(set(re.findall(
                    r"claude-(?:opus|sonnet|haiku|fable|mythos|instant|\d)[a-z0-9]*(?:[.\-][a-z0-9]+)*",
                    text)))
                return {"present": True, "path": str(p),
                        "line_count": len(lines), "headings": headings,
                        "model_refs": model_refs[:30]}
            except (OSError, UnicodeDecodeError):
                pass
    return {"present": False, "path": None, "line_count": 0, "headings": [], "model_refs": []}


def _private_hosts(lines):
    """Hosts of non-public index URLs on the given config lines."""
    hosts = set()
    for ln in lines:
        for h in _URL_HOST_RE.findall(ln):
            if h.lower() not in PUBLIC_INDEX_HOSTS:
                hosts.add(h.lower())
    return sorted(hosts)


def scan_python_index(root):
    """Private package indexes the repo declares, for `pip install` readiness.

    Reads `--index-url` / `--extra-index-url` lines in requirements files and
    index URLs in pyproject.toml, uv.toml, and pip.conf. Returns hosts only,
    never credentials. Whether the *machine* can reach and auth to the index
    is left to the verify probe, so this stays project-deterministic.
    """
    r = pathlib.Path(root)
    lines = []
    for req in sorted(r.glob("requirements*.txt")):
        lines += [ln for ln in safe_read(req).splitlines() if ln.strip().startswith("-")]
    for name in ("pyproject.toml", "uv.toml", "pip.conf"):
        lines += [ln for ln in safe_read(r / name).splitlines()
                  if re.search(r"(?i)index|url\s*=|source", ln)]
    return {"private_index": _private_hosts(lines)}


def scan_node_registry(root):
    """Private npm registries declared in the repo's .npmrc / .yarnrc.yml."""
    r = pathlib.Path(root)
    lines = []
    for name in (".npmrc", ".yarnrc.yml", ".yarnrc"):
        lines += [ln for ln in safe_read(r / name).splitlines() if "registry" in ln.lower()]
    return {"private_registry": _private_hosts(lines)}


_FROM_RE = re.compile(r"(?im)^\s*FROM\s+(?:--platform=\S+\s+)?([^\s/]+)/")
_IMAGE_RE = re.compile(r"(?im)^\s*image:\s*[\"']?([^\s/\"']+)/")


def scan_registries(root):
    """Container registry hosts referenced by Dockerfiles and compose files.

    Only the first path segment that looks like a host (has a dot or a port)
    counts, so `python:3.12` and `library/redis` (Docker Hub) are skipped.
    """
    r = pathlib.Path(root)
    hosts = set()
    files = sorted(r.glob("Dockerfile*")) + [r / n for n in
             ("docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml")]
    for f in files:
        text = safe_read(f)
        for h in _FROM_RE.findall(text) + _IMAGE_RE.findall(text):
            if ("." in h or ":" in h) and h.lower() not in ("docker.io", "index.docker.io"):
                hosts.add(h.lower())
    return sorted(hosts)


def scan_manifests(root):
    r = pathlib.Path(root)
    return {
        "python": {
            "pyproject": (r / "pyproject.toml").exists(),
            "uv_lock": (r / "uv.lock").exists(),
            "setup_py": (r / "setup.py").exists(),
            "requirements": glob_count(r, "requirements*.txt") > 0,
            **scan_python_index(root),
        },
        "node": {
            "package_json": (r / "package.json").exists(),
            "package_lock": (r / "package-lock.json").exists(),
            "pnpm_lock": (r / "pnpm-lock.yaml").exists(),
            "yarn_lock": (r / "yarn.lock").exists(),
            **scan_node_registry(root),
        },
        "rust": {
            "cargo_toml": (r / "Cargo.toml").exists(),
            "cargo_lock": (r / "Cargo.lock").exists(),
        },
        "go": {
            "go_mod": (r / "go.mod").exists(),
            "go_sum": (r / "go.sum").exists(),
        },
        "ruby": {
            "gemfile": (r / "Gemfile").exists(),
            "gemfile_lock": (r / "Gemfile.lock").exists(),
        },
        "swift": {
            "package_swift": (r / "Package.swift").exists(),
            "xcodeproj": glob_count(r, "*.xcodeproj") > 0,
            "xcconfig_count": glob_count(r, "**/*.xcconfig"),
        },
        "bazel": {
            "module_bazel": (r / "MODULE.bazel").exists(),
            "build_bazel_count": glob_count(r, "**/BUILD.bazel"),
            "workspace": (r / "WORKSPACE").exists() or (r / "WORKSPACE.bazel").exists(),
        },
    }


def scan_toolchain_versions(root):
    r = pathlib.Path(root)
    return {
        ".tool-versions": first_line(r / ".tool-versions"),
        ".python-version": first_line(r / ".python-version"),
        ".nvmrc": first_line(r / ".nvmrc"),
        "mise.toml": (r / "mise.toml").exists(),
        ".ruby-version": first_line(r / ".ruby-version"),
    }


def scan_makefile_targets(root):
    p = pathlib.Path(root) / "Makefile"
    if not p.exists():
        return []
    targets = []
    try:
        for line in p.read_text().splitlines():
            m = re.match(r"^([a-zA-Z][a-zA-Z0-9_-]*):(?!=)", line)
            if m:
                targets.append(m.group(1))
    except (OSError, UnicodeDecodeError):
        pass
    return sorted(set(targets))


def scan_env_files(root):
    r = pathlib.Path(root)
    files = []
    var_names = set()
    for pattern in [".env", ".env.example", ".env.local", ".env.sample"]:
        p = r / pattern
        if p.exists():
            files.append(pattern)
            try:
                for ln in p.read_text().splitlines():
                    ln = ln.strip()
                    if ln and not ln.startswith("#") and "=" in ln:
                        var_names.add(ln.split("=", 1)[0].strip())
            except (OSError, UnicodeDecodeError):
                pass
    envrc = (r / ".envrc").exists()
    return {
        "envrc": envrc,
        "env_files": files,
        "env_var_names": sorted(var_names),  # NAMES ONLY -- values never captured
    }


def _evidence_cmd(have_rg, with_filename):
    """Base ripgrep/grep command for one evidence pass over the pruned tree."""
    if have_rg:
        cmd = ["rg", "--no-heading", "--no-line-number", "-o"]
        if not with_filename:
            cmd.append("--no-filename")
        for ed in EXCLUDE_DIRS:
            cmd.extend(["--glob", f"!{ed}"])
    else:
        cmd = ["grep", "-r", "-o", "-E"]
        if not with_filename:
            cmd.append("-h")
        for ed in EXCLUDE_DIRS:
            cmd.extend(["--exclude-dir", ed])
    return cmd


def _grep_siblings(root, have_rg):
    """Sibling-repo path references, with in-tree relatives filtered out.

    A `../x` that resolves to a path *inside* the repo is a relative asset
    (CSS `url('../font/..')`) or a kustomize overlay base (`- ../base`), not
    a private sibling checkout. Resolving each match against the file that
    referenced it -- which requires the filename, hence a pass separate from
    the count-only host grep -- distinguishes the two precisely.
    """
    rootp = pathlib.Path(root).resolve()
    cmd = _evidence_cmd(have_rg, with_filename=True)
    # Capture the full `../` chain (`../../foo`), not just the last segment,
    # so a nested file's multi-level ref resolves to the correct level.
    for p in [r"(?:\.\./)+[a-zA-Z][a-zA-Z0-9_-]+", r"~/Projects/[a-zA-Z][a-zA-Z0-9_-]+"]:
        cmd.extend(["-e", p])
    cmd.append(str(rootp))
    try:
        lines = subprocess.run(cmd, capture_output=True, text=True, timeout=60).stdout.splitlines()
    except subprocess.TimeoutExpired:
        print("scan-project: sibling grep timed out at 60s; evidence is incomplete",
              file=sys.stderr)
        return []

    out = set()
    for line in lines:
        if ":" not in line:
            continue
        fpath, tok = line.rsplit(":", 1)
        tok = tok.strip().lstrip("\"'")
        if tok.startswith("~/Projects/"):
            out.add(tok)
        elif tok.startswith("../"):
            try:
                resolved = (pathlib.Path(fpath).resolve().parent / tok).resolve()
            except (OSError, ValueError, RuntimeError):
                continue
            if resolved != rootp and rootp not in resolved.parents:
                out.add(tok)
    return sorted(out)[:30]  # cap to avoid token blowup


def grep_evidence(root):
    """One ripgrep pass over the tree for service-host counts.

    A single `-o` invocation; each printed match is classified in Python. Sibling-repo paths need per-match filenames to filter in-tree
    relatives, so they run as a separate pass (see `_grep_siblings`). Falls
    back to recursive grep only when ripgrep is absent.
    """
    r = pathlib.Path(root)

    patterns = [re.escape(h) for h in SERVICE_HOSTS]

    have_rg = shutil.which("rg") is not None
    if not have_rg:
        # grep -r is markedly slower than ripgrep and risks the 60s timeout on a
        # large tree; warn so a truncated evidence set is not read as "clean".
        print("scan-project: ripgrep (rg) not found; falling back to slower grep -r",
              file=sys.stderr)
    cmd = _evidence_cmd(have_rg, with_filename=False)
    for p in patterns:
        cmd.extend(["-e", p])
    cmd.append(str(r))

    try:
        lines = subprocess.run(cmd, capture_output=True, text=True, timeout=60).stdout.splitlines()
    except subprocess.TimeoutExpired:
        print("scan-project: evidence grep timed out at 60s; evidence counts are incomplete",
              file=sys.stderr)
        lines = []

    host_counts = {h: 0 for h in SERVICE_HOSTS}
    for line in lines:
        tok = line.strip().lstrip("\"'")
        if tok in host_counts:
            host_counts[tok] += 1

    return {
        "sibling_paths": _grep_siblings(root, have_rg),
        "service_hosts": {h: c for h, c in host_counts.items() if c > 0},
    }


def _match_target(targets, candidates):
    """Pick the Makefile target best matching any canonical verb.

    An exact name wins; otherwise a verb at a `-`/`_` word boundary
    (so `app-test` and `setup-dev` match `test`/`setup`, but `latest`
    does not match `test`). Bare substrings are deliberately not matched
    -- they let short verbs like `dev` leak across slots. Among equal-rank
    hits the shortest target name wins as the most canonical (`app-run`
    over `nginx-run-shell`).
    """
    for rank in (
        lambda t, c: t == c,
        lambda t, c: (t.startswith(c + "-") or t.startswith(c + "_")
                      or t.endswith("-" + c) or t.endswith("_" + c)),
    ):
        hits = sorted((t for t in targets for c in candidates if rank(t, c)), key=len)
        if hits:
            return hits[0]
    return None


def derive_dev_loop(root, manifests, makefile_targets):
    """Surface the canonical setup/build/test/lint/run command per ecosystem."""
    r = pathlib.Path(root)
    loop = {"setup": None, "build": None, "test": None, "lint": None, "run": None}

    # Makefile targets win when present. Slots are filled in this order and a
    # matched target is consumed, so `setup-dev` lands in `setup` and never
    # leaks into `run` (which would otherwise match its `-dev` suffix).
    target_map = {"setup": ["setup", "install", "bootstrap", "deps"],
                  "lint": ["lint", "format", "fmt"],
                  "test": ["test", "tests", "check"],
                  "build": ["build", "compile", "image"],
                  "run": ["run", "dev", "serve", "start"]}
    claimed = set()
    for slot, candidates in target_map.items():
        t = _match_target([x for x in makefile_targets if x not in claimed], candidates)
        if t:
            loop[slot] = f"make {t}"
            claimed.add(t)

    # Fill in language-specific defaults when Makefile didn't cover
    pkg = r / "package.json"
    if pkg.exists():
        try:
            d = json.loads(pkg.read_text())
            scripts = d.get("scripts", {})
            loop["setup"] = loop["setup"] or "npm install"
            if not loop["build"] and "build" in scripts:
                loop["build"] = "npm run build"
            if not loop["test"] and "test" in scripts:
                loop["test"] = "npm test"
            if not loop["lint"] and "lint" in scripts:
                loop["lint"] = "npm run lint"
            if not loop["run"] and ("dev" in scripts or "start" in scripts):
                loop["run"] = "npm run " + ("dev" if "dev" in scripts else "start")
        except (json.JSONDecodeError, OSError, UnicodeDecodeError):
            pass

    if manifests["go"]["go_mod"]:
        loop["build"] = loop["build"] or "go build ./..."
        loop["test"] = loop["test"] or "go test ./..."

    if manifests["rust"]["cargo_toml"]:
        loop["build"] = loop["build"] or "cargo build"
        loop["test"] = loop["test"] or "cargo test"

    if manifests["python"]["pyproject"]:
        loop["setup"] = loop["setup"] or ("uv sync" if manifests["python"]["uv_lock"] else "pip install -e .")
        loop["test"] = loop["test"] or "pytest"
        if (r / "ruff.toml").exists() or "[tool.ruff]" in safe_read(r / "pyproject.toml"):
            loop["lint"] = loop["lint"] or "ruff check ."
    elif manifests["python"]["requirements"]:
        loop["setup"] = loop["setup"] or "pip install -r requirements.txt"

    return loop


ENV_TOKENS = {"dev", "develop", "development", "test", "testing", "qa", "uat",
              "stg", "stage", "staging", "preprod", "prod", "production", "sandbox",
              "canary", "nonprod", "perf", "int", "integration"}

# Deploy-config files declare where a service lands per environment. Matched by
# filename (helm values, kustomize, skaffold) or by living under a deploy-ish
# directory. The walk prunes EXCLUDE_DIRS and caps the file set so a large repo
# cannot blow the token/time budget.
DEPLOY_NAME_PATS = ["values*.yaml", "values*.yml", "Chart.yaml", "kustomization.yaml",
                    "kustomization.yml", "skaffold.yaml"]
DEPLOY_DIRS = {"helm", "overlays", "environments", "envs", "deploy", "deployments",
               "manifests", "k8s", "kube", "kubernetes"}
# Leading (?<![\w-]) anchors the key so `mynamespace:` / `securityContext:` are not
# partial-matched. `context` is intentionally excluded -- it is ubiquitous in k8s
# manifests (securityContext, tooling context) and produces garbage clusters.
_NS_RE = re.compile(r"(?<![\w-])(?:namespace|targetNamespace|kubeNamespace)\s*[:=]\s*[\"']?([A-Za-z0-9][\w.-]*)")
_CLUSTER_RE = re.compile(r"(?<![\w-])(?:clusterName|kubeContext|targetCluster|clusterId|cluster)\s*[:=]\s*[\"']?([A-Za-z0-9][\w.-]*)")
# Some pipelines express the deploy target in build-command flags, not structured
# keys: `--base-env stg`, `--publish-envs myservice-prod`. Those flag values ARE the
# environments, so capture them directly regardless of the ENV_TOKENS vocabulary.
_DEPLOY_ENV_FLAG_RE = re.compile(r"--(?:base|publish|run|target|deploy)[-_]?envs?[ =]+([\w.-]+)")
_ENV_WORD_RE = re.compile(r"[A-Za-z]+")


def _env_tokens_in(text):
    """Env tokens appearing as whole alpha-words in a string (case-insensitive)."""
    return {w.lower() for w in _ENV_WORD_RE.findall(text) if w.lower() in ENV_TOKENS}


def scan_deploy_topology(root):
    r = pathlib.Path(root)
    candidates, environments, namespaces, clusters = [], set(), set(), set()

    # Pass 1: walk to collect candidate files and overlay-directory env names.
    for dirpath, dirnames, filenames in os.walk(r):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        rel_parts = set(pathlib.Path(dirpath).relative_to(r).parts)
        in_deploy_dir = bool(rel_parts & DEPLOY_DIRS)
        # An overlay directory named for an environment is topology evidence -- but
        # only under a deploy dir, so `tests/integration` is not mistaken for one.
        if in_deploy_dir:
            environments |= (rel_parts & ENV_TOKENS)
        for name in filenames:
            named = any(fnmatch.fnmatch(name, p) for p in DEPLOY_NAME_PATS)
            yamlish = name.endswith((".yaml", ".yml"))
            if named or (in_deploy_dir and yamlish):
                candidates.append(pathlib.Path(dirpath) / name)

    # Pass 2: sort first so the read set (and thus extracted ns/clusters) is
    # deterministic regardless of os.walk order, then read up to the cap.
    candidates.sort()
    config_files = [str(p.relative_to(r)) for p in candidates]
    for fp in candidates[:60]:  # bound the read set on huge repos
        environments |= _env_tokens_in(fp.name)
        for line in safe_read(fp)[:200_000].splitlines():
            if line.lstrip().startswith("#"):  # skip commented-out values
                continue
            namespaces.update(_NS_RE.findall(line))
            clusters.update(c for c in _CLUSTER_RE.findall(line) if c.lower() not in ENV_TOKENS)
            environments.update(_DEPLOY_ENV_FLAG_RE.findall(line))
    for fp in candidates[60:]:  # past the read cap, still cheap filename signal
        environments |= _env_tokens_in(fp.name)

    return {
        "config_files": sorted(config_files)[:60],
        "environments": sorted(environments),
        "namespaces": sorted(namespaces)[:30],
        "clusters": sorted(clusters)[:30],
    }


def main():
    if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help"):
        print(__doc__.split("Output schema")[0].strip())
        return
    root = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    root = str(pathlib.Path(root).resolve())
    r = pathlib.Path(root)

    if not r.exists():
        print(f"ERROR: {root} does not exist", file=sys.stderr)
        sys.exit(2)

    manifests = scan_manifests(root)
    makefile_targets = scan_makefile_targets(root)

    result = {
        "project_root": root,
        "host": {"os": platform.system().lower(),
                 "shell": os.path.basename(os.environ.get("SHELL", "")) or None},
        "git": git_info(root),
        "claude": scan_claude(root),
        "claude_md": scan_claude_md(root),
        "manifests": manifests,
        "toolchain_versions": scan_toolchain_versions(root),
        "hooks": {
            "makefile_targets": makefile_targets,
            "prek_toml": (r / "prek.toml").exists(),
            "pre_commit_config": (r / ".pre-commit-config.yaml").exists(),
        },
        "test_config": {
            "tsconfig": (r / "tsconfig.json").exists(),
            "jest": glob_count(r, "jest.config.*") > 0,
            "vitest": glob_count(r, "vitest.config.*") > 0,
            "pytest_ini": (r / "pytest.ini").exists(),
            "tox_ini": (r / "tox.ini").exists(),
        },
        "lint_config": {
            "biome": (r / "biome.json").exists(),
            "ruff": (r / "ruff.toml").exists(),
            "eslint": glob_count(r, ".eslintrc*") > 0,
            "prettier": glob_count(r, "prettier.config.*") > 0,
            "editorconfig": (r / ".editorconfig").exists(),
        },
        "dev_env": {
            "devcontainer": (r / "devcontainer.json").exists() or (r / ".devcontainer/devcontainer.json").exists(),
            "flake_nix": (r / "flake.nix").exists(),
            "shell_nix": (r / "shell.nix").exists(),
            "vscode_tasks": (r / ".vscode/tasks.json").exists(),
            "zed_tasks": (r / ".zed/tasks.json").exists(),
        },
        "ci": scan_ci(root),
        "kube_helm": {
            "helm_dir": (r / "helm").is_dir(),
            "values_yaml_count": glob_count(r, "**/values*.yaml"),
            "kustomization": (r / "kustomization.yaml").exists(),
            "chart_yaml": (r / "Chart.yaml").exists(),
        },
        "deploy_topology": scan_deploy_topology(root),
        "containers": {
            "dockerfile_count": glob_count(r, "Dockerfile*"),
            "docker_compose": any(glob_count(r, p) > 0 for p in
                                  ("docker-compose*.yaml", "docker-compose*.yml", "compose.yaml", "compose.yml")),
            "procfile": (r / "Procfile").exists(),
            "registries": scan_registries(root),
        },
        "gitignore": scan_gitignore(root),
        "env_files": scan_env_files(root),
        "test_data": {
            "fixtures": (r / "tests/fixtures").is_dir(),
            "golden": (r / "tests/golden").is_dir(),
            "cassettes_count": glob_count(r, "**/*.cassette.yaml"),
            "snapshots_count": glob_count(r, "**/__snapshots__"),
            "dvc_yaml": (r / "dvc.yaml").exists(),
            "lfs_tracked": "filter=lfs" in safe_read(r / ".gitattributes"),
        },
        "evidence": grep_evidence(root),
    }

    result["dev_loop"] = derive_dev_loop(root, manifests, makefile_targets)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
