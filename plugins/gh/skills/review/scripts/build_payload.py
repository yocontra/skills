#!/usr/bin/env python3
"""Assemble the GitHub PR review payload from a findings list.

Why this exists: hand-rolling the JSON payload in a shell heredoc breaks the
moment a finding body contains backticks, code fences, or quotes — which is
constantly. This script takes a structured findings file and emits a payload
that ``gh api .../pulls/$PR/reviews --input`` accepts on the first try.

It also enforces the diff-anchor invariant: any finding whose ``line`` is not
in the live diff (per ``diff_anchors.py``) is automatically routed into the
review **body** as a "Beyond-diff finding" section instead of being submitted
as an inline comment that GitHub will 422-reject.

Inputs:
  findings.json — JSON object: {"findings": [{path, line, startLine?,
                  tier?, severity, title, detail, suggestedDiff?}, ...]}
  anchors.json  — output of diff_anchors.py
  --repo OWNER/REPO — enables GitHub permalinks on body-only findings
  --host HOSTNAME — GitHub host for those permalinks (default github.com;
                  set it for Enterprise or links silently point at public GitHub)
  --event {COMMENT|REQUEST_CHANGES|APPROVE} — review verdict
  --summary TEXT — top-line summary that opens the review body
  --output PATH — write the payload here (defaults to stdout)

Severity drives verdict only when --event is omitted: any High/Critical →
REQUEST_CHANGES, otherwise COMMENT. ``--event`` overrides this.

``tier`` (Bug | Quality | Nit) is optional. Nits never become inline threads:
they go in one "Polish" checklist in the review body, so a fixing agent can
batch them instead of resolving a thread per item.

Each other finding's body is rendered as:
  **[TIER · SEVERITY]** TITLE   (or **[SEVERITY]** TITLE without a tier)
  <blank>
  DETAIL
  <blank, if SUGGESTED_DIFF>
  ```suggestion
  <code>
  ```

Findings missing both ``line`` and an in-diff anchor go in the body. Findings
with ``startLine`` get the multi-line range only when both endpoints are valid.

Body-only findings get a permalink when ``--repo`` is passed, so the reader can
jump to code GitHub won't let us anchor a comment to. The URL must be a bare
line — GitHub only renders the code-snippet preview for an unadorned blob URL
with a full SHA and an ``#Lstart-Lend`` range, and a wrong one degrades silently
to a plain link, so the format is pinned by tests.
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any

# One line of context on each side of the cited range, per GitHub's snippet
# rendering: a bare #L42-L42 single-line fragment renders as a link, not a
# snippet.
CONTEXT_LINES = 1


def permalink(repo: str, commit_id: str, f: dict[str, Any], host: str = "github.com") -> str | None:
    """Build a snippet-rendering GitHub blob URL for a finding, or None."""
    if not repo:
        return None
    base = f"https://{host}/{repo}/blob/{commit_id}/{f['path']}"
    line = f.get("line")
    if not line:
        # No line to anchor to — the blob link at the reviewed SHA still beats
        # a bare path, so keep it, just without a fragment.
        return base
    start = max(1, (f.get("startLine") or line) - CONTEXT_LINES)
    return f"{base}#L{start}-L{line + CONTEXT_LINES}"


def label(f: dict[str, Any]) -> str:
    """The bracketed tag that opens a finding, e.g. ``Bug · High``."""
    return f"{f['tier']} · {f['severity']}" if f.get("tier") else f["severity"]


def render_inline_body(f: dict[str, Any]) -> str:
    parts = [f"**[{label(f)}]** {f['title']}", "", f["detail"]]
    sd = f.get("suggestedDiff")
    if sd:
        parts.extend(["", "```suggestion", sd.rstrip("\n"), "```"])
    return "\n".join(parts)


def render_body_section(
    f: dict[str, Any], repo: str = "", commit_id: str = "", host: str = "github.com"
) -> str:
    loc = f["path"]
    if f.get("line"):
        loc = f"{loc}:{f['line']}"
    parts = [f"### [{label(f)}] {f['title']} — `{loc}`", "", f["detail"]]
    url = permalink(repo, commit_id, f, host)
    if url:
        parts.extend(["", url])
    if f.get("suggestedDiff"):
        parts.extend(["", "```suggestion", f["suggestedDiff"].rstrip("\n"), "```"])
    return "\n".join(parts)


def render_polish(nits: list[dict[str, Any]]) -> str:
    """One checklist for every Nit, one line each, in place of inline threads."""
    lines = ["### Polish", ""]
    for f in nits:
        loc = f"{f['path']}:{f['line']}" if f.get("line") else f["path"]
        lines.append(f"- [ ] `{loc}` — **{f['title']}**: {f['detail']}")
    return "\n".join(lines)


def is_anchored(f: dict[str, Any], anchors: dict[str, list[int]]) -> bool:
    valid = set(anchors.get(f["path"], []))
    line = f.get("line")
    if not line or line not in valid:
        return False
    start = f.get("startLine")
    if start and start not in valid:
        return False
    return True


def derive_event(findings: list[dict[str, Any]]) -> str:
    if any(f["severity"] in ("Critical", "High") for f in findings):
        return "REQUEST_CHANGES"
    return "COMMENT"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--findings", required=True, help="path to findings.json")
    ap.add_argument(
        "--anchors", required=True, help="path to diff_anchors.py output"
    )
    ap.add_argument(
        "--repo",
        default="",
        metavar="OWNER/REPO",
        help="enables GitHub permalinks on findings routed into the review body",
    )
    ap.add_argument(
        "--host",
        default="github.com",
        help="GitHub hostname for permalinks; set this for GitHub Enterprise "
        "(e.g. github.example.com) or the links will point at public github.com",
    )
    ap.add_argument(
        "--event",
        choices=["COMMENT", "REQUEST_CHANGES", "APPROVE"],
        help="review verdict (auto-derived from severities if omitted)",
    )
    ap.add_argument(
        "--summary",
        default="",
        help="top-line summary that opens the review body",
    )
    ap.add_argument("--output", help="write payload here (default: stdout)")
    args = ap.parse_args()

    # A malformed --repo yields links that look fine and 404 — reject it here
    # rather than shipping dead URLs into a review.
    if args.repo and (args.repo.count("/") != 1 or " " in args.repo or args.repo.startswith("/") or args.repo.endswith("/")):
        print(
            f"--repo must be OWNER/REPO, got {args.repo!r}",
            file=sys.stderr,
        )
        return 2

    with open(args.findings) as fp:
        findings = json.load(fp).get("findings", [])
    with open(args.anchors) as fp:
        anchor_doc = json.load(fp)
    anchors = anchor_doc["anchors"]
    commit_id = anchor_doc["commit_id"]

    if not findings:
        print(
            "No findings to post — skip review submission entirely.",
            file=sys.stderr,
        )
        return 1

    inline: list[dict[str, Any]] = []
    body_only: list[dict[str, Any]] = []
    nits: list[dict[str, Any]] = []
    for f in findings:
        if f.get("tier") == "Nit":
            nits.append(f)
        elif is_anchored(f, anchors):
            inline.append(f)
        else:
            body_only.append(f)

    inline_comments = []
    for f in inline:
        comment = {
            "path": f["path"],
            "line": f["line"],
            "side": "RIGHT",
            "body": render_inline_body(f),
        }
        if f.get("startLine") and f["startLine"] != f["line"]:
            comment["start_line"] = f["startLine"]
        inline_comments.append(comment)

    body_parts = []
    if args.summary:
        body_parts.append(args.summary)
    counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
    for f in findings:
        counts[f["severity"]] = counts.get(f["severity"], 0) + 1
    body_parts.append(
        f"\n**{len(findings)} findings** ("
        + ", ".join(
            f"{n} {s.lower()}" for s, n in counts.items() if n
        )
        + ")"
    )
    if body_only:
        body_parts.append(
            "\n---\n\nThe following findings reference code paths outside "
            "the diff hunks (e.g., callers that should also be updated, "
            "existing tests that this change breaks). Posted in the review "
            "body since GitHub only accepts inline comments on lines in "
            "the diff.\n"
        )
        for f in body_only:
            body_parts.append(render_body_section(f, args.repo, commit_id, args.host))
            body_parts.append("")
    if nits:
        body_parts.append("\n---\n\n" + render_polish(nits))

    payload = {
        "commit_id": commit_id,
        "event": args.event or derive_event(findings),
        "body": "\n".join(body_parts).strip(),
        "comments": inline_comments,
    }

    out = json.dumps(payload, indent=2)
    if args.output:
        with open(args.output, "w") as fp:
            fp.write(out)
            fp.write("\n")
    else:
        print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
