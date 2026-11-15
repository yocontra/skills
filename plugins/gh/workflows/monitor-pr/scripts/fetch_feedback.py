#!/usr/bin/env python3
"""Fetch all PR feedback for many PRs in parallel.

Background: the monitor-pr sweep workflow reads three feedback sources per PR
(inline review threads via GraphQL, PR-level reviews via REST, issue-style
comments via REST). Each source must be paginated and sorted newest-first
(see plugins/gh/skills/gh/references/graphql.md → "Read PR feedback").
Doing this serially in the discover agent's prompt is slow on busy sweeps —
20 PRs × 3 sources × ≥1 page each is 60+ HTTP calls.

This script fans those calls out across a thread pool and emits one JSON
document the discover agent consumes directly. Sorting, outdated-tagging,
and the unresolved-only filter all happen here so the agent prompt stays
short.

Usage:
  fetch_feedback.py OWNER REPO PR_NUM [PR_NUM ...] > feedback.json
  echo '1234 1235 1239' | fetch_feedback.py OWNER REPO -

Output schema (per PR):
  {
    "number": 1234,
    "threads": [                         # inline review threads, newest-first
      {
        "id": "PRRT_...",
        "isOutdated": false,
        "path": "src/x.py",
        "line": 42,
        "startLine": null,
        "tag": "",                       # "[outdated — verify still applicable]" if isOutdated
        "comments": [
          {"author": "alice", "body": "...", "createdAt": "...", "url": "..."}
        ]
      }
    ],
    "reviews": [                         # PR-level reviews, newest-first
      {"author": "ai-reviewer", "state": "COMMENTED", "body": "...", "submittedAt": "..."}
    ],
    "comments": [                        # issue-style PR comments, newest-first
      {"author": "bob", "body": "...", "createdAt": "...", "url": "..."}
    ]
  }

Top-level output is `{"prs": [<above>, ...]}`. PRs that errored out get a
`"error": "..."` field instead of the three lists; the orchestrator decides
whether to retry.
"""
from __future__ import annotations

import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

MAX_WORKERS = 12

THREADS_QUERY = """
query($owner: String!, $repo: String!, $pr: Int!, $endCursor: String) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      reviewThreads(first: 100, after: $endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          diffSide
          comments(first: 100) {
            nodes {
              id
              body
              author { login }
              createdAt
              url
            }
          }
        }
      }
    }
  }
}
"""


def gh(*args: str) -> str:
    return subprocess.run(
        ["gh", *args], capture_output=True, text=True, check=True
    ).stdout


def load_concatenated(raw: str) -> list:
    """Flatten the output of `gh api --paginate` into a single list.

    REST `--paginate` concatenates one JSON array per page with no separator —
    `[...][...]` — which is not a JSON document. `json.loads` on the whole
    stream raises "Extra data" the moment a PR needs a second page, which is
    exactly the PRs with the most feedback. Decode the values one at a time
    instead, and flatten arrays as we go.
    """
    out: list = []
    decoder = json.JSONDecoder()
    idx = 0
    n = len(raw)
    while idx < n:
        while idx < n and raw[idx].isspace():
            idx += 1
        if idx >= n:
            break
        value, idx = decoder.raw_decode(raw, idx)
        if isinstance(value, list):
            out.extend(value)
        else:
            out.append(value)
    return out


def fetch_threads(owner: str, repo: str, pr: int) -> list[dict]:
    raw = gh(
        "api",
        "graphql",
        "--paginate",
        "-f",
        f"query={THREADS_QUERY}",
        "-f",
        f"owner={owner}",
        "-f",
        f"repo={repo}",
        "-F",
        f"pr={pr}",
    )
    threads: list[dict] = []
    for page in load_concatenated(raw):
        nodes = (
            page.get("data", {})
            .get("repository", {})
            .get("pullRequest", {})
            .get("reviewThreads", {})
            .get("nodes", [])
        )
        threads.extend(nodes)

    out = []
    for t in threads:
        if t.get("isResolved"):
            continue
        comments = [
            {
                "author": (c.get("author") or {}).get("login", ""),
                "body": c.get("body", ""),
                "createdAt": c.get("createdAt", ""),
                "url": c.get("url", ""),
            }
            for c in (t.get("comments") or {}).get("nodes", [])
        ]
        comments.sort(key=lambda c: c["createdAt"])
        out.append(
            {
                "id": t.get("id", ""),
                "isOutdated": bool(t.get("isOutdated")),
                "path": t.get("path") or "",
                "line": t.get("line"),
                "startLine": t.get("startLine"),
                "tag": "[outdated — verify still applicable]"
                if t.get("isOutdated")
                else "",
                "comments": comments,
            }
        )
    out.sort(
        key=lambda t: max((c["createdAt"] for c in t["comments"]), default=""),
        reverse=True,
    )
    return out


def fetch_reviews(owner: str, repo: str, pr: int) -> list[dict]:
    raw = gh(
        "api",
        "--paginate",
        f"repos/{owner}/{repo}/pulls/{pr}/reviews?per_page=100",
    )
    items = load_concatenated(raw)
    out = []
    for r in items:
        body = (r.get("body") or "").strip()
        if r.get("state") == "APPROVED" and not body:
            continue
        out.append(
            {
                "author": (r.get("user") or {}).get("login", ""),
                "state": r.get("state", ""),
                "body": r.get("body") or "",
                "submittedAt": r.get("submitted_at") or "",
            }
        )
    out.sort(key=lambda r: r["submittedAt"], reverse=True)
    return out


def fetch_comments(owner: str, repo: str, pr: int) -> list[dict]:
    raw = gh(
        "api",
        "--paginate",
        # This endpoint ignores sort/direction and returns oldest first; sort below.
        f"repos/{owner}/{repo}/issues/{pr}/comments?per_page=100",
    )
    items = load_concatenated(raw)
    out = [
        {
            "author": (c.get("user") or {}).get("login", ""),
            "body": c.get("body") or "",
            "createdAt": c.get("created_at") or "",
            "url": c.get("html_url") or "",
        }
        for c in items
    ]
    out.sort(key=lambda c: c["createdAt"], reverse=True)
    return out


def fetch_one(owner: str, repo: str, pr: int) -> dict:
    try:
        with ThreadPoolExecutor(max_workers=3) as pool:
            t_fut = pool.submit(fetch_threads, owner, repo, pr)
            r_fut = pool.submit(fetch_reviews, owner, repo, pr)
            c_fut = pool.submit(fetch_comments, owner, repo, pr)
            return {
                "number": pr,
                "threads": t_fut.result(),
                "reviews": r_fut.result(),
                "comments": c_fut.result(),
            }
    except subprocess.CalledProcessError as e:
        return {
            "number": pr,
            "error": (e.stderr or str(e)).strip()[:500],
        }


def parse_prs(args: list[str]) -> list[int]:
    if args == ["-"]:
        return [int(x) for x in sys.stdin.read().split()]
    return [int(x) for x in args]


def main() -> int:
    if len(sys.argv) < 4:
        print(
            f"usage: {sys.argv[0]} OWNER REPO PR_NUM [PR_NUM ...]\n"
            f"   or: ... OWNER REPO -   (PR numbers via stdin)",
            file=sys.stderr,
        )
        return 2
    owner, repo = sys.argv[1], sys.argv[2]
    prs = parse_prs(sys.argv[3:])
    if not prs:
        json.dump({"prs": []}, sys.stdout)
        sys.stdout.write("\n")
        return 0

    results: dict[int, dict] = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futs = {pool.submit(fetch_one, owner, repo, pr): pr for pr in prs}
        for fut in as_completed(futs):
            pr = futs[fut]
            results[pr] = fut.result()

    json.dump(
        {"prs": [results[pr] for pr in prs]},
        sys.stdout,
        indent=2,
        sort_keys=True,
    )
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
