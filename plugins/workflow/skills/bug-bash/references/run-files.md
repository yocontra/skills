# Bug bash run files

Files that hold issue text, or text derived from it, wrap it in `<dataSource:issues>` … `</dataSource:issues>`.

```
~/.claude/bug-bash/<owner>-<name>/
  ledger.json                  # every issue seen, across runs
  <YYYY-MM-DD>[-n]/
    query.json                 # step 2 query output
    labels.txt                 # repo labels, one per line
    worktrees.before           # step 1 snapshot: `worktree <path>` lines
    branches.before            # step 1 snapshot: local branch names
    created.tsv                # everything the run created, for step 8
    plan.md                    # step 4; updated with PRs in step 7
    actions.tsv                # step 5 input
    questions.tsv              # open questions; removed in step 8
    issues/<n>.md              # diagnosis, repro, task list, E2E matrix (written by the plan agent)
    issues/<n>.comment.md      # issue comment, posted in step 5
```

## ledger.json

One entry per issue number. Each write is recorded right after it lands, so a re-run can skip it.

```json
{
  "123": {
    "lastRun": "2026-10-10",
    "bucket": "fix",
    "result": "Config loader drops a key with an empty value",
    "writes": ["comment:root-cause", "label:fixing", "unlabel:fixing"],
    "pr": "https://github.com/org/repo/pull/456",
    "prState": "merged"
  }
}
```

`writes` keys: `comment:root-cause`, `comment:reply`, `label:<name>`, `label:fixing`, `unlabel:fixing`, `close:<reason>`. A key that is present means "done; never write it again."

## actions.tsv

One line per issue with a `comment` or `close` action. Tab-separated, with a header:

```
number	close	duplicateOf	labels	commentFile
124	not planned			/home/me/.claude/bug-bash/org-repo/2026-10-10/issues/124.comment.md
125	duplicate	123
126			needs-info	/home/me/.claude/bug-bash/org-repo/2026-10-10/issues/126.comment.md
```

Empty columns mean "not set". `labels` is comma-separated and only names labels in `labels.txt`. A `duplicate` row with no `commentFile` gets the one-line comment `Duplicate of #<duplicateOf>.` before the close.

## created.tsv

One line per thing the run created. Tab-separated: kind, value, note.

```
kind	value	note
label	bug-bash: fixing	created by this run
labelled	123	bug-bash: fixing
task	a1b2c3	fixer for unit 123
watcher	d4e5f6	waits for PR 456 to merge
tmp	/tmp/tmp.Xk2p9	PR body files
```

Step 8 reads it top to bottom. A line is never removed; cleanup appends `cleaned` or `kept: <reason>` lines instead.
