#!/usr/bin/env python3
"""Tests for build_payload's rendering and routing logic.

Run with: python3 scripts/test_build_payload.py
(from plugins/gh/skills/review/)

build_payload turns a findings list into a payload ``gh api .../reviews
--input`` accepts. Two behaviors carry real risk and are pinned here:

1. Anchor routing. A finding whose line isn't in the live diff must land in
   the review body, not as an inline comment GitHub 422-rejects.
2. Permalink format. GitHub only renders the code-snippet preview for a bare
   blob URL with a full SHA and an ``#Lstart-Lend`` range. A malformed URL
   degrades silently to a plain link, so nothing at runtime catches it.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import build_payload  # noqa: E402

SHA = "c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe"
REPO = "anthropics/claude-code"


def finding(**kw):
    base = {
        "path": "src/example.py",
        "line": 45,
        "severity": "High",
        "title": "Short title",
        "detail": "Why it matters.",
    }
    base.update(kw)
    return base


class PermalinkTest(unittest.TestCase):
    def test_range_includes_one_line_of_context(self):
        # Commenting on line 45 links L44-L46: GitHub needs at least one line
        # of context on each side to render a snippet rather than a link.
        self.assertEqual(
            build_payload.permalink(REPO, SHA, finding()),
            f"https://github.com/{REPO}/blob/{SHA}/src/example.py#L44-L46",
        )

    def test_start_line_widens_the_range(self):
        url = build_payload.permalink(REPO, SHA, finding(startLine=42, line=45))
        self.assertTrue(url.endswith("#L41-L46"), url)

    def test_line_one_clamps_to_l1(self):
        # line - 1 would be 0, which is not a valid GitHub line anchor.
        url = build_payload.permalink(REPO, SHA, finding(line=1))
        self.assertTrue(url.endswith("#L1-L2"), url)

    def test_no_repo_yields_no_link(self):
        # Keeps the script usable standalone without --repo.
        self.assertIsNone(build_payload.permalink("", SHA, finding()))

    def test_missing_line_falls_back_to_bare_blob_url(self):
        url = build_payload.permalink(REPO, SHA, finding(line=None))
        self.assertEqual(
            url, f"https://github.com/{REPO}/blob/{SHA}/src/example.py"
        )
        self.assertNotIn("#", url)

    def test_enterprise_host_is_honored(self):
        # A hardcoded github.com silently produces 404 links on Enterprise —
        # the link still renders, so nothing at runtime catches it.
        url = build_payload.permalink(
            REPO, SHA, finding(), host="ghe.example.com"
        )
        self.assertTrue(url.startswith("https://ghe.example.com/"), url)
        self.assertNotIn("github.com/", url)

    def test_host_defaults_to_public_github(self):
        self.assertTrue(
            build_payload.permalink(REPO, SHA, finding()).startswith(
                "https://github.com/"
            )
        )


class RenderBodySectionTest(unittest.TestCase):
    def test_permalink_is_on_its_own_line(self):
        # A bare URL renders as a snippet; wrapped in markdown it does not.
        out = build_payload.render_body_section(finding(), REPO, SHA)
        lines = out.split("\n")
        urls = [ln for ln in lines if ln.startswith("https://")]
        self.assertEqual(len(urls), 1)
        self.assertEqual(urls[0], urls[0].strip())

    def test_omits_permalink_without_repo(self):
        out = build_payload.render_body_section(finding())
        self.assertNotIn("https://", out)
        self.assertIn("### [High] Short title", out)

    def test_suggestion_block_follows_the_permalink(self):
        out = build_payload.render_body_section(
            finding(suggestedDiff="x = 1\n"), REPO, SHA
        )
        self.assertLess(out.index("https://"), out.index("```suggestion"))
        # `rstrip` on the diff keeps the fence from gaining a blank line.
        self.assertTrue(out.endswith("```suggestion\nx = 1\n```"))


class RenderInlineBodyTest(unittest.TestCase):
    def test_severity_and_title_lead(self):
        out = build_payload.render_inline_body(finding())
        self.assertEqual(out.split("\n")[0], "**[High]** Short title")

    def test_suggestion_block_appended(self):
        out = build_payload.render_inline_body(finding(suggestedDiff="y = 2"))
        self.assertIn("```suggestion\ny = 2\n```", out)


class TierLabelTest(unittest.TestCase):
    def test_tier_leads_the_severity(self):
        body = build_payload.render_inline_body(finding(tier="Bug"))
        self.assertTrue(body.startswith("**[Bug · High]** Short title"))

    def test_untiered_finding_keeps_the_severity_tag(self):
        body = build_payload.render_inline_body(finding())
        self.assertTrue(body.startswith("**[High]** Short title"))

    def test_body_section_carries_the_tier(self):
        section = build_payload.render_body_section(finding(tier="Quality", severity="Medium"))
        self.assertTrue(section.startswith("### [Quality · Medium] Short title"))


class RenderPolishTest(unittest.TestCase):
    def test_one_checklist_line_per_nit(self):
        out = build_payload.render_polish(
            [
                finding(tier="Nit", severity="Low", title="Tighter name", detail="Rename `x` to `count`."),
                finding(tier="Nit", severity="Low", path="docs/a.md", line=None, title="Drop", detail="Delete it."),
            ]
        )
        self.assertEqual(
            out.splitlines(),
            [
                "### Polish",
                "",
                "- [ ] `src/example.py:45` — **Tighter name**: Rename `x` to `count`.",
                "- [ ] `docs/a.md` — **Drop**: Delete it.",
            ],
        )


class IsAnchoredTest(unittest.TestCase):
    anchors = {"src/example.py": [44, 45, 46]}

    def test_line_in_anchors(self):
        self.assertTrue(build_payload.is_anchored(finding(), self.anchors))

    def test_line_outside_anchors(self):
        self.assertFalse(
            build_payload.is_anchored(finding(line=99), self.anchors)
        )

    def test_unknown_path(self):
        self.assertFalse(
            build_payload.is_anchored(finding(path="other.py"), self.anchors)
        )

    def test_start_line_must_also_be_anchored(self):
        # A range whose start is outside the diff is rejected whole — GitHub
        # 422s on the `start_line`, not just the end.
        self.assertFalse(
            build_payload.is_anchored(
                finding(startLine=10, line=45), self.anchors
            )
        )

    def test_missing_line_is_not_anchored(self):
        self.assertFalse(
            build_payload.is_anchored(finding(line=None), self.anchors)
        )


class DeriveEventTest(unittest.TestCase):
    def test_high_requests_changes(self):
        self.assertEqual(
            build_payload.derive_event([finding(severity="High")]),
            "REQUEST_CHANGES",
        )

    def test_critical_requests_changes(self):
        self.assertEqual(
            build_payload.derive_event([finding(severity="Critical")]),
            "REQUEST_CHANGES",
        )

    def test_medium_and_low_only_comments(self):
        self.assertEqual(
            build_payload.derive_event(
                [finding(severity="Medium"), finding(severity="Low")]
            ),
            "COMMENT",
        )

    def test_one_high_among_many_still_requests_changes(self):
        self.assertEqual(
            build_payload.derive_event(
                [finding(severity="Low"), finding(severity="High")]
            ),
            "REQUEST_CHANGES",
        )


if __name__ == "__main__":
    unittest.main()
