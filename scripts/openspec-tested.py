#!/usr/bin/env python3
"""Turn a fork of OpenSpec's `spec-driven` schema into `spec-driven-tested`.

Usage: scripts/openspec-tested.py <schema-dir>

<schema-dir> is the output of `openspec schema fork spec-driven
spec-driven-tested`. This adds the `test-plan` artifact between design and
tasks, makes tasks require it, tells tasks and apply how to use it, writes
its template, and tells every artifact to cite files and commands, never line
numbers or method names. Every edit anchors on upstream text that must occur
exactly once; if an anchor is missing or repeated the script exits non-zero
before writing, so scripts/sync-openspec.sh fails closed when upstream changes
under it.
"""

import sys
from pathlib import Path

CITE = """\
      When you cite code, cite files and commands (a path, a test file, a
      `make` target or CLI invocation). Never cite line numbers or method
      names: both drift as the code changes.
"""

TEST_PLAN_ARTIFACT = (
    """\
  - id: test-plan
    generates: test-plan.md
    description: E2E test matrix mapping each scenario and surface to its verification
    template: test-plan.md
    instruction: |
      Create the E2E test matrix that shows how this change is verified end to end.

      Rows, under `## E2E test matrix`:
      - One row per spec scenario, named `<capability>: <scenario>`.
      - One row per surface the change touches (for example CLI, UI, API,
        platforms or environments), naming what is checked there.

      Columns:
      - **Check**: what the row verifies
      - **Verified by**: the path of an end-to-end or integration test in
        this repo, existing or to be written. Only where automation cannot
        reach the behavior, write `manual: <reason>; <steps>` instead.
      - **Result**: a legend mark

      Legend:
      - ✅ covered by an automated test in this repo and passing
      - 🟡 tested manually and passing
      - ❌ not tested yet

      Start every new row at ❌. If the change sets `skip_specs: true`, list
      only surface rows.

      Reference specs for the scenarios, design for the surfaces.

"""
    + CITE
    + """\
    requires:
      - specs
      - design

"""
)

TASKS_GUIDELINE = """\
      - For every test-plan.md row, add two tasks to the group whose work it
        verifies: one that writes or extends the row's in-repo test (none for
        a manual-only row), and one that runs the row's check by hand on the
        real system. When they are done, set the row's result: ✅ when the
        in-repo test passes, 🟡 when the check passed by hand only.
"""

APPLY_RULES = """\
    A task group is done only when each of its test-plan.md rows is ✅ or 🟡.
    Run each row's manual check on the real system: a skipped check leaves
    its row unverified.
"""

TEST_PLAN_TEMPLATE = """\
# Test Plan

## E2E test matrix

Legend: ✅ automated test in this repo, passing · 🟡 tested manually, passing · ❌ not tested yet

| Check | Verified by | Result |
|---|---|---|
| <!-- capability -->: <!-- scenario --> | <!-- path/to/e2e_test, or manual: reason; steps --> | ❌ |
| <!-- surface, e.g. CLI --> | <!-- path/to/e2e_test, or manual: reason; steps --> | ❌ |
"""

# (anchor, replacement). Each anchor must occur exactly once in schema.yaml.
EDITS = [
    (
        "      This is the foundation - specs, design, and tasks all build on this.\n    requires: []\n",
        "      This is the foundation - specs, design, and tasks all build on this.\n\n" + CITE + "    requires: []\n",
    ),
    (
        "      Specs should be testable - each scenario is a potential test case.\n",
        "      Specs should be testable - each scenario is a potential test case.\n\n" + CITE,
    ),
    (
        '      Good design docs explain the "why" behind technical decisions.\n',
        '      Good design docs explain the "why" behind technical decisions.\n\n' + CITE,
    ),
    (
        "description: Default OpenSpec workflow - proposal → specs → design → tasks\n",
        "description: OpenSpec workflow with an E2E test plan - proposal → specs → design → test-plan → tasks\n",
    ),
    ("  - id: tasks\n", TEST_PLAN_ARTIFACT + "  - id: tasks\n"),
    (
        "        the tests and docs an earlier group owed.\n",
        "        the tests and docs an earlier group owed.\n" + TASKS_GUIDELINE,
    ),
    (
        "      Reference specs for what needs to be built, design for how to build it.\n"
        "    requires:\n"
        "      - specs\n"
        "      - design\n",
        "      Reference specs for what needs to be built, design for how to build it,\n"
        "      and test-plan.md for how to verify it.\n\n"
        + CITE
        + "    requires:\n"
        "      - specs\n"
        "      - design\n"
        "      - test-plan\n",
    ),
    (
        "    Pause if you hit blockers or need clarification.\n",
        "    Pause if you hit blockers or need clarification.\n" + APPLY_RULES,
    ),
]


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__.split("\n\n")[1])
    schema_dir = Path(sys.argv[1])
    schema_path = schema_dir / "schema.yaml"
    template_path = schema_dir / "templates" / "test-plan.md"
    text = schema_path.read_text()
    if "name: spec-driven-tested\n" not in text:
        sys.exit(f"openspec-tested: {schema_path} is not a spec-driven-tested fork")
    if template_path.exists():
        sys.exit(f"openspec-tested: {template_path} already exists; upstream now ships it")
    for anchor, replacement in EDITS:
        count = text.count(anchor)
        if count != 1:
            sys.exit(f"openspec-tested: anchor found {count} times, expected once: {anchor.splitlines()[0].strip()!r}")
        text = text.replace(anchor, replacement)
    schema_path.write_text(text)
    template_path.write_text(TEST_PLAN_TEMPLATE)


if __name__ == "__main__":
    main()
