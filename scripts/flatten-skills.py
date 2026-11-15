#!/usr/bin/env python3
"""Install this marketplace's skills into harnesses that do not load Claude Code plugins.

Claude Code installs the plugins natively (`/plugin marketplace add`). Codex, OpenCode,
pi, omp, Cursor and other Agent Skills harnesses read plain skill directories instead, so
this script flattens every `plugins/<plugin>/skills/<skill>/` into one self-contained
directory per skill:

  <out>/plugins/<plugin>/   copy of each plugin with ${CLAUDE_PLUGIN_ROOT} resolved, so the
                            scripts, workflows and prompts the skills call work anywhere
  <out>/skills/<name>/      one skill per directory, named <plugin>-<skill> (or <skill> when it
                            already carries the plugin name, e.g. `gh`, `openspec-propose`),
                            relative paths made absolute and /plugin:skill references renamed

Then it links each skill into the harnesses you name with --link:

  codex     ~/.codex/skills/<name>
  agents    ~/.agents/skills/<name>        (pi, omp, and other Agent Skills readers)
  opencode  ~/.config/opencode/skills/<name>
  claude    ~/.claude/skills/<name>        (only if you prefer flat skills to the plugins)

Re-run after `git pull`. It only removes what a previous run created.

Usage:
  python3 scripts/flatten-skills.py --link codex,agents
  python3 scripts/flatten-skills.py --out ~/.local/share/skills --link opencode
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HOME = Path.home()
DEFAULT_OUT = HOME / ".local" / "share" / "agent-skills"
LINK_DIRS = {
    "codex": HOME / ".codex" / "skills",
    "agents": HOME / ".agents" / "skills",
    "opencode": HOME / ".config" / "opencode" / "skills",
    "claude": HOME / ".claude" / "skills",
}
TEXT_EXT = {".md", ".json", ".py", ".sh", ".js", ".mjs", ".ts", ".txt", ".yaml", ".yml", ".toml"}
COPY_IGNORE = shutil.ignore_patterns(
    "evals", "__tests__", "__pycache__", "node_modules", ".DS_Store", "results", "*.pyc"
)
# Plugin commands whose skill has a different name.
COMMAND_ALIASES = {
    "/openspec:apply": "/openspec-apply-change",
    "/openspec:archive": "/openspec-archive-change",
    "/openspec:explore": "/openspec-explore",
    "/openspec:propose": "/openspec-propose",
    "/openspec:sync": "/openspec-sync-specs",
    "/openspec:update": "/openspec-update-change",
    "/go-time": "/workflow-go-time",
}
REL_RE = re.compile(r"(?<![\w/.])((?:\.\./)+[A-Za-z0-9_.\-/]*)")
PLUGIN_REF_RE = re.compile(
    r"(?<![\w.:/-])(/?)([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)\b|(?<![\w-])/go-time\b"
)


def flat_name(plugin: str, skill: str) -> str:
    if skill == plugin or skill.startswith(plugin + "-"):
        return skill
    return f"{plugin}-{skill}"


def text_files(root: Path):
    for f in root.rglob("*"):
        if f.is_file() and f.suffix in TEXT_EXT:
            yield f


def copy_plugins(plugins_out: Path) -> None:
    if plugins_out.exists():
        shutil.rmtree(plugins_out)
    shutil.copytree(REPO / "plugins", plugins_out, ignore=COPY_IGNORE)
    for plugin_dir in plugins_out.iterdir():
        for f in text_files(plugin_dir):
            text = f.read_text()
            if "${CLAUDE_PLUGIN_ROOT}" in text:
                f.write_text(text.replace("${CLAUDE_PLUGIN_ROOT}", str(plugin_dir)))


def rewrite(text: str, src_file: Path, plugins_out: Path, refs: dict[str, str]) -> str:
    def rel(m: re.Match) -> str:
        token = m.group(1)
        path_part = token.split("#", 1)[0].rstrip(".,;:")
        target = Path(os.path.normpath(src_file.parent / path_part))
        if path_part and target.exists() and plugins_out in target.parents:
            return str(target) + token[len(path_part):]
        return token

    def ref(m: re.Match) -> str:
        if m.group(2) is None:
            return COMMAND_ALIASES["/go-time"]
        slash, key = m.group(1), f"/{m.group(2)}:{m.group(3)}"
        if key in COMMAND_ALIASES:
            return slash + COMMAND_ALIASES[key][1:]
        return slash + refs[key] if key in refs else m.group(0)

    return PLUGIN_REF_RE.sub(ref, REL_RE.sub(rel, text))


def set_frontmatter_name(text: str, name: str) -> str:
    if not text.startswith("---"):
        return text
    end = text.find("\n---", 3)
    head = re.sub(r"(?m)^name:.*$", f"name: {name}", text[:end], count=1)
    return head + text[end:]


def remove(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help=f"output root (default {DEFAULT_OUT})")
    ap.add_argument("--link", default="", help=f"comma-separated: {','.join(LINK_DIRS)}")
    args = ap.parse_args()
    out = args.out.expanduser().resolve()
    links = [x for x in args.link.split(",") if x]
    unknown = set(links) - set(LINK_DIRS)
    if unknown:
        ap.error(f"unknown --link target(s): {', '.join(sorted(unknown))}")

    plugins_out, skills_out = out / "plugins", out / "skills"
    manifest_path = out / "manifest.json"
    old = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

    copy_plugins(plugins_out)
    skills = [
        (sdir, flat_name(sdir.parent.parent.name, sdir.name))
        for sdir in sorted(p.parent for p in plugins_out.glob("*/skills/*/SKILL.md"))
    ]
    names = [n for _, n in skills]
    dupes = sorted({n for n in names if names.count(n) > 1})
    if dupes:
        raise SystemExit(f"name collision after flattening: {dupes}")
    refs = {f"/{s.parent.parent.name}:{s.name}": n for s, n in skills}

    # Clear only what this script made before; other entries in skills/ are left alone.
    skills_out.mkdir(parents=True, exist_ok=True)
    for name in set(old.get("skills", [])) | set(names):
        remove(skills_out / name)
    for sdir, name in skills:
        dest = skills_out / name
        shutil.copytree(sdir, dest)
        for f in text_files(dest):
            text = f.read_text()
            new = rewrite(text, sdir / f.relative_to(dest), plugins_out, refs)
            if f == dest / "SKILL.md":
                new = set_frontmatter_name(new, name)
            if new != text:
                f.write_text(new)

    linked: dict[str, list[str]] = {}
    for target, names_there in (old.get("links") or {}).items():
        base = LINK_DIRS.get(target)
        for name in names_there:
            link = base / name if base else None
            if link and link.is_symlink() and Path(os.readlink(link)).parent == skills_out:
                if target not in links or name not in names:
                    link.unlink()
    for target in links:
        base = LINK_DIRS[target]
        if base.is_symlink() and base.resolve() == skills_out:
            continue  # the whole directory already points here
        base.mkdir(parents=True, exist_ok=True)
        done = []
        for name in names:
            link = base / name
            if link.is_symlink():
                link.unlink()
            elif link.exists():
                print(f"  ! {target}: {link} exists and is not a link; skipped")
                continue
            link.symlink_to(skills_out / name)
            done.append(name)
        linked[target] = done

    manifest_path.write_text(json.dumps({"skills": names, "links": linked}, indent=2) + "\n")
    where = f", linked into {', '.join(links)}" if links else ""
    print(f"flatten-skills: {len(names)} skills -> {skills_out}{where}")


if __name__ == "__main__":
    main()
