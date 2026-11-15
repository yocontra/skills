#!/usr/bin/env python3
"""Summarize Claude Code token spend for one project from its session transcripts.

Reads ~/.claude/projects/<project>/*.jsonl (main sessions) and
<project>/<session-id>/subagents/*.jsonl (subagents), streaming line by line.
Prints compact tables: totals, main vs subagent split, cache rewrites after
idle gaps (by cause), top tool errors, hook denials, and the most expensive
sessions. The transcript root is $CLAUDE_CONFIG_DIR/projects, else ~/.claude/projects.
Read-only: it writes nothing and leaves no files behind.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path

DEFAULT_RATES = {"in": 5.0, "cache_write": 6.25, "cache_write_1h": 10.0, "cache_read": 0.5, "out": 25.0}
GAP_SECONDS = 300
SLEEP_MIN_SECONDS = 100
CAUSES = ("sleep poll", "test run", "git commit", "agent wait", "user message", "other")

SLEEP_RE = re.compile(r"\bsleep\s+(\d+(?:\.\d+)?)")
TEST_RE = re.compile(
    r"pytest|scripts/test\.sh|\bmake\s+[\w-]*test|\bnpm\s+(?:run\s+)?test|\bnpx\s+(?:vitest|jest|playwright)"
    r"|\b(?:go|cargo|swift|yarn|pnpm)\s+test|\bunittest\b|\bxcodebuild\b.*\btest\b"
)
COMMIT_RE = re.compile(r"\bgit\s+(?:-\S+\s+)*commit\b")
AGENT_TOOLS = {"Agent", "Task", "TaskOutput", "SendMessage"}
AGENT_ORIGINS = {"task-notification", "peer"}
AGENT_TEXT_PREFIXES = ("<task-notification>", "Another Claude session", "[SYSTEM NOTIFICATION")
ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
HEX_RE = re.compile(r"\b(?:0x)?[0-9a-fA-F]{6,}\b")
DIGITS_RE = re.compile(r"\d+")
HOOK_RE = re.compile(r"hook error", re.I)


def default_root() -> str:
    return str(Path(os.environ.get("CLAUDE_CONFIG_DIR") or "~/.claude") / "projects")


def encode_project(path: str) -> str:
    return re.sub(r"[^A-Za-z0-9-]", "-", path)


def resolve_project(arg: str | None, root: Path) -> Path:
    if arg is None:
        arg = os.getcwd()
    candidates = [root / arg, Path(arg).expanduser()]
    if arg.startswith(("/", "~")):
        candidates.append(root / encode_project(str(Path(arg).expanduser().resolve())))
        candidates.append(root / encode_project(str(Path(arg).expanduser())))
    for c in candidates:
        if c.is_dir() and c.resolve().parent == root.resolve():
            return c
    sys.exit(f"cost_report: no transcript dir for {arg!r} under {root}; run with --list to see projects")


def parse_rates(spec: str) -> dict[str, float]:
    rates = dict(DEFAULT_RATES)
    for part in filter(None, spec.split(",")):
        key, _, val = part.partition("=")
        key = key.strip()
        if key not in rates:
            sys.exit(f"cost_report: unknown rate {key!r}; valid: {', '.join(rates)}")
        rates[key] = float(val)
    return rates


def parse_ts(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def first_lines(text: str, n: int) -> list[str]:
    """The first n non-blank lines, without splitting a multi-MB result whole."""
    out: list[str] = []
    start = 0
    while len(out) < n and start < len(text):
        end = text.find("\n", start)
        end = len(text) if end < 0 else end
        line = text[start:end].strip()
        if line:
            out.append(line)
        start = end + 1
    return out


def normalize(text: str) -> str:
    lines = [ANSI_RE.sub("", ln).strip() for ln in first_lines(text, 2)]
    lines = [ln for ln in lines if ln]
    if not lines:
        return "(empty)"
    first = lines[0]
    if re.fullmatch(r"Exit code \d+", first) and len(lines) > 1:
        first = f"{first}: {lines[1]}"
    first = HEX_RE.sub("H", first)
    first = DIGITS_RE.sub("N", first)
    first = re.sub(r"\s+", " ", first)
    return first[:100]


def hook_line(text: str) -> str:
    for ln in ANSI_RE.sub("", text).splitlines():
        if HOOK_RE.search(ln):
            return normalize(ln)
    return normalize(text)


def result_text(block: dict) -> str:
    content = block.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(c.get("text", "") for c in content if isinstance(c, dict))
    return ""


def classify_tool(tool: dict | None) -> str:
    if not tool:
        return "other"
    name = tool.get("name", "")
    inp = tool.get("input") or {}
    if name in AGENT_TOOLS:
        return "agent wait"
    if name == "Bash":
        cmd = str(inp.get("command", ""))
        if any(float(m) >= SLEEP_MIN_SECONDS for m in SLEEP_RE.findall(cmd)):
            return "sleep poll"
        if COMMIT_RE.search(cmd):
            return "git commit"
        if TEST_RE.search(cmd):
            return "test run"
    return "other"


def classify_user_text(entry: dict, text: str) -> str | None:
    """Return 'agent wait', 'user message', or None for non-human meta lines.

    Agent notifications are checked first: Claude Code marks many of them isMeta
    (background-task notifications, messages from peer sessions).
    """
    origin = entry.get("origin") or {}
    kind = origin.get("kind") if isinstance(origin, dict) else None
    if kind in AGENT_ORIGINS or text.lstrip().startswith(AGENT_TEXT_PREFIXES):
        return "agent wait"
    if entry.get("isMeta"):
        return None
    if kind in (None, "human"):
        return "user message"
    return None


class Report:
    def __init__(self, rates: dict[str, float], since: date | None, until: date | None):
        self.rates = rates
        self.since = since
        self.until = until
        self.seen_ids: set[str] = set()
        self.cost = {"main": 0.0, "subagent": 0.0}
        self.tokens = defaultdict(int)
        self.calls = {"main": 0, "subagent": 0}
        self.gap_cost: Counter[str] = Counter()
        self.gap_count: Counter[str] = Counter()
        self.errors: Counter[str] = Counter()
        self.error_total = 0
        self.hooks: Counter[str] = Counter()
        self.sessions: dict[str, dict] = defaultdict(lambda: {"first": None, "main": 0.0, "subagent": 0.0})

    def in_range(self, ts: datetime | None) -> bool:
        if ts is None:
            return False
        day = ts.astimezone().date()
        return (self.since is None or day >= self.since) and (self.until is None or day <= self.until)

    def usage_cost(self, u: dict) -> tuple[float, float]:
        r = self.rates
        cw = u.get("cache_creation_input_tokens") or 0
        split = u.get("cache_creation") or {}
        cw_1h = (split.get("ephemeral_1h_input_tokens") or 0) if isinstance(split, dict) else 0
        write = ((cw - cw_1h) * r["cache_write"] + cw_1h * r["cache_write_1h"]) / 1e6
        total = (
            (u.get("input_tokens") or 0) * r["in"]
            + (u.get("cache_read_input_tokens") or 0) * r["cache_read"]
            + (u.get("output_tokens") or 0) * r["out"]
        ) / 1e6 + write
        for k in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens"):
            self.tokens[k] += u.get(k) or 0
        return total, write

    def scan_file(self, path: Path, session: str, kind: str) -> None:
        if self.since is not None and date.fromtimestamp(path.stat().st_mtime) < self.since:
            return
        prev_call: datetime | None = None
        last_tool: dict | None = None
        between: str | None = None
        sess = self.sessions[session]
        with path.open("r", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                try:
                    entry = json.loads(line)
                except ValueError:
                    continue
                if not isinstance(entry, dict):
                    continue
                etype = entry.get("type")
                ts = parse_ts(entry.get("timestamp"))
                msg = entry.get("message")
                if not isinstance(msg, dict):
                    continue
                content = msg.get("content")
                if etype == "assistant":
                    blocks = content if isinstance(content, list) else []
                    mid = msg.get("id")
                    usage = msg.get("usage")
                    if mid and mid not in self.seen_ids and isinstance(usage, dict) and ts is not None:
                        self.seen_ids.add(mid)
                        if self.in_range(ts):
                            cost, write = self.usage_cost(usage)
                            self.cost[kind] += cost
                            self.calls[kind] += 1
                            sess[kind] += cost
                            if sess["first"] is None or ts < sess["first"]:
                                sess["first"] = ts
                            if prev_call is not None and (ts - prev_call).total_seconds() > GAP_SECONDS:
                                cause = between or classify_tool(last_tool)
                                self.gap_cost[cause] += write
                                self.gap_count[cause] += 1
                        prev_call = ts
                        between = None
                    for b in blocks:
                        if isinstance(b, dict) and b.get("type") == "tool_use":
                            last_tool = b
                elif etype == "user":
                    if isinstance(content, str):
                        content = [{"type": "text", "text": content}]
                    if not isinstance(content, list):
                        continue
                    for b in content:
                        if not isinstance(b, dict):
                            continue
                        if b.get("type") == "text":
                            cause = classify_user_text(entry, b.get("text", ""))
                            if cause and between != "user message":
                                between = cause
                        if b.get("type") != "tool_result" or not self.in_range(ts):
                            continue
                        if not b.get("is_error"):
                            continue
                        text = result_text(b)
                        self.error_total += 1
                        self.errors[normalize(text)] += 1
                        if HOOK_RE.search(text):
                            self.hooks[hook_line(text)] += 1

    def to_dict(self, top: int) -> dict:
        total = self.cost["main"] + self.cost["subagent"]
        sessions = sorted(self.sessions.items(), key=lambda kv: -(kv[1]["main"] + kv[1]["subagent"]))
        return {
            "total_usd": round(total, 2),
            "main_usd": round(self.cost["main"], 2),
            "subagent_usd": round(self.cost["subagent"], 2),
            "calls": self.calls,
            "tokens": dict(self.tokens),
            "rates_usd_per_mtok": self.rates,
            "idle_gap_rewrites": {
                c: {"usd": round(self.gap_cost[c], 2), "count": self.gap_count[c]} for c in CAUSES if self.gap_count[c]
            },
            "tool_errors_total": self.error_total,
            "top_tool_errors": self.errors.most_common(top),
            "hook_denials_total": sum(self.hooks.values()),
            "top_hook_denials": self.hooks.most_common(min(top, 5)),
            "top_sessions": [
                {
                    "session": sid,
                    "first": s["first"].astimezone().isoformat(timespec="minutes") if s["first"] else None,
                    "main_usd": round(s["main"], 2),
                    "subagent_usd": round(s["subagent"], 2),
                }
                for sid, s in sessions[:top]
                if s["main"] + s["subagent"] > 0
            ],
        }


def scan_project(proj: Path, report: Report) -> None:
    for f in sorted(proj.glob("*.jsonl")):
        report.scan_file(f, f.stem, "main")
    for f in sorted(proj.glob("*/subagents/*.jsonl")):
        report.scan_file(f, f.parent.parent.name, "subagent")


def pct(part: float, whole: float) -> str:
    return f"{100 * part / whole:4.0f}%" if whole else "   -"


def render(d: dict, proj: Path, since: date | None, until: date | None) -> str:
    out = []
    span = f"{since or 'start'} .. {until or 'now'}"
    total = d["total_usd"]
    t = d["tokens"]
    out.append(f"Project {proj.name}  ({span})")
    out.append(
        f"Total ${total:,.2f}  calls {sum(d['calls'].values()):,}  tok in {t.get('input_tokens', 0):,} "
        f"cw {t.get('cache_creation_input_tokens', 0):,} cr {t.get('cache_read_input_tokens', 0):,} "
        f"out {t.get('output_tokens', 0):,}"
    )
    out.append(f"  main      ${d['main_usd']:>10,.2f} {pct(d['main_usd'], total)}  calls {d['calls']['main']:,}")
    out.append(
        f"  subagent  ${d['subagent_usd']:>10,.2f} {pct(d['subagent_usd'], total)}  calls {d['calls']['subagent']:,}"
    )
    gaps = d["idle_gap_rewrites"]
    gap_total = sum(g["usd"] for g in gaps.values())
    out.append(f"\nCache rewrites after >{GAP_SECONDS}s idle gap: ${gap_total:,.2f} ({pct(gap_total, total).strip()})")
    for cause, g in sorted(gaps.items(), key=lambda kv: -kv[1]["usd"]):
        out.append(f"  {cause:<13} ${g['usd']:>9,.2f}  x{g['count']}")
    out.append(f"\nTool errors: {d['tool_errors_total']:,}")
    for msg, n in d["top_tool_errors"]:
        out.append(f"  {n:>5}  {msg}")
    out.append(f"\nHook denials: {d['hook_denials_total']:,}")
    for msg, n in d["top_hook_denials"]:
        out.append(f"  {n:>5}  {msg}")
    out.append("\nTop sessions                          first             main $   sub $")
    for s in d["top_sessions"]:
        first = (s["first"] or "")[:16].replace("T", " ")
        out.append(f"  {s['session']:<36} {first:<16} {s['main_usd']:>8,.2f} {s['subagent_usd']:>7,.2f}")
    return "\n".join(out)


def list_projects(root: Path, top: int) -> str:
    """The projects with the most transcript bytes, so the caller can pick --project."""
    rows = []
    for d in root.iterdir() if root.is_dir() else []:
        if not d.is_dir():
            continue
        files = list(d.glob("*.jsonl")) + list(d.glob("*/subagents/*.jsonl"))
        if files:
            latest = max(f.stat().st_mtime for f in files)
            rows.append((sum(f.stat().st_size for f in files), latest, len(files), d.name))
    rows.sort(reverse=True)
    out = [f"Projects under {root} (by transcript size)", "      MB  last used    files  project"]
    for size, latest, n, name in rows[:top]:
        out.append(f"  {size / 1e6:>6.1f}  {date.fromtimestamp(latest)}  {n:>5}  {name}")
    if len(rows) > top:
        out.append(f"  ... {len(rows) - top} more (raise --top)")
    return "\n".join(out)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Claude Code token spend report for one project's transcripts.")
    ap.add_argument("--project", help="dir name under the projects root, its absolute path, or a repo path (default: cwd)")
    ap.add_argument("--since", type=date.fromisoformat, help="YYYY-MM-DD, inclusive (local time)")
    ap.add_argument("--until", type=date.fromisoformat, help="YYYY-MM-DD, inclusive (local time)")
    ap.add_argument(
        "--rates",
        default="",
        help="USD per Mtok, e.g. in=5,cache_write=6.25,cache_write_1h=10,cache_read=0.5,out=25 (Opus list defaults)",
    )
    ap.add_argument("--top", type=int, default=10, help="rows per top-N table (default 10)")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--list", action="store_true", help="list projects by transcript size and exit")
    ap.add_argument("--root", default=default_root(), help="transcript root (default: $CLAUDE_CONFIG_DIR/projects or ~/.claude/projects)")
    args = ap.parse_args(argv)

    root = Path(args.root).expanduser()
    if args.list:
        print(list_projects(root, args.top))
        return 0
    proj = resolve_project(args.project, root)
    report = Report(parse_rates(args.rates), args.since, args.until)
    scan_project(proj, report)
    data = report.to_dict(args.top)
    if args.json:
        print(json.dumps(data, indent=1, default=str))
    else:
        print(render(data, proj, args.since, args.until))
    return 0


if __name__ == "__main__":
    sys.exit(main())
