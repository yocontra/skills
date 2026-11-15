# Fix Protocol

Address concrete review issues in a single file properly. No hacks, no suppressions, no "good enough" patches that paper over the underlying problem.

## Rules

- **Do NOT run ANY git command.** No `git add`, `git commit`, `git checkout`, `git branch`, `git stash`, `git rebase`, nothing. The launcher owns all git.
- **Stay inside your assigned file.** Other fix agents are working on other files in parallel. If a fix genuinely requires changes outside your file, return that information in your summary instead of editing the other file yourself — the orchestrator will resequence.
- **Fix the root cause.** If a review flagged a missing edge-case handler, add the handler and a test that exercises it. Do not silence the lint, do not catch-and-ignore, do not delete the failing test.
- **Add or update tests for every fix.** A bug fix needs a regression test. A correctness fix needs a test that would have caught the original issue. Run the tests and confirm green before finishing.
- **Preserve behavior the reviewers approved of.** Don't rewrite working code while you're in there.

## Fix discipline

- Read the issue. Read the cited code. Reproduce the problem mentally before typing.
- Make the smallest change that addresses the root cause. Resist the urge to refactor adjacent code.
- After the code change, write or update the test that locks the fix in. The test must fail against the pre-fix code and pass against the fixed code.
- Run the affected test file (and any obvious siblings) and confirm green. If the project has a fast lint or typecheck, run it too.

## When to reject an issue

Not every review finding is real. You may return an issue as unfixed if:

- The cited code does not actually exhibit the described behavior (hallucination). Explain what the code actually does.
- The fix would require editing a file owned by another agent in this round. Describe the cross-file change needed.
- The "issue" is a stylistic preference contradicted by the surrounding codebase conventions. Cite the convention.

Do NOT reject an issue because the fix is annoying, because tests are flaky, or because you disagree with the severity.

## How to verify

- Run the narrowest test command that covers your file (e.g. `pytest path/to/test_foo.py`, `npm test -- foo.test.ts`).
- For a bug fix, confirm the new test fails on the prior code by reasoning about it, or by reverting your edit by hand and re-running; never with git.
- Scratch files go in a `mktemp -d` directory you delete before you report.
- For a correctness fix, walk through the new code path with the inputs from the review finding.

## What you receive

- The file path you own for this fix round.
- `ISSUES` — a JSON list of `{file, detail, severity}` review findings to address. Treat each one as a must-fix unless it falls under the rejection criteria above.

## Output Schema

Return JSON:

```json
{
  "fixed": [
    "Added null-guard in parseHeader and regression test in test_parse.py",
    "Skipped: 'use Map instead of object' — code already uses Map; reviewer misread line 42",
    "Skipped: requires editing src/other.ts which is owned by another agent this round"
  ]
}
```

- `fixed` — a list of short strings, one per issue. Each string says either what you did or why you didn't (with enough detail for the orchestrator to resequence or drop the finding).
- The list length must match the number of input ISSUES — one entry per finding, in order.
