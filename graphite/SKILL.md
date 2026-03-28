---
name: graphite
description: Manage stacked PRs with the Graphite CLI (gt). Use when the user wants to create branches, submit PRs, merge, sync, or manage stacks via Graphite. Triggers on "open a PR", "submit PR", "merge this", "stack", "graphite", "gt create", "gt submit", "gt merge", or any PR/branch workflow when Graphite is the configured tool.
user-invocable: true
argument-hint: "[action: create | submit | merge | sync | log | modify | restack]"
allowed-tools: Bash(gt:*), Bash(gh:*), Bash(git:*), Read, Grep, Glob, Agent
---

# Graphite CLI Workflow

Manage stacked PRs entirely through the Graphite CLI (`gt`). This skill handles branch creation, PR submission, merging, syncing, and stack management.

## Critical Rules

1. **ALWAYS use the `gt` CLI** for all branch, PR, and merge operations. Never use `gh` for writes (commenting, merging, closing, editing PRs). `gh` is READ-ONLY — use it only for viewing PR status, checks, or reading comments.

2. **ALWAYS humanize copy.** Every PR title, description, review comment, and commit message you write must sound like a real human wrote it. Follow these rules:
   - No corporate buzzwords ("leverage", "utilize", "streamline", "robust", "scalable")
   - No filler ("This PR...", "This commit...", "In this change...")
   - Start descriptions with what changed and why, not meta-commentary
   - Use conventional commit prefixes for PR titles: `fix:`, `feat:`, `chore:`, `refactor:`, `docs:`, `test:`, `perf:`, `ci:`, `build:`, `style:`
   - After the prefix, use lowercase (unless proper noun): `feat: add dark mode toggle`
   - Keep titles under 60 chars, direct and specific
   - Descriptions: short paragraphs or bullets, not walls of text
   - Write like you're explaining to a teammate at your desk, not writing a press release
   - No trailing periods in titles
   - Avoid passive voice — say who does what

3. **Never use `git merge`, `git rebase`, or `git pull`** when working in a Graphite stack. Use `gt sync`, `gt restack`, and `gt modify` instead.

4. **Always `gt sync` before starting new work** to ensure trunk is up to date.

5. **Ask before destructive operations** — `gt merge`, `gt delete`, force pushes.

## Command Reference

### Creating branches and commits

```bash
# Create a new stacked branch with staged changes
gt create -m "commit message"

# Create with all unstaged changes included
gt create -am "commit message"

# Create with auto-generated branch name (from commit message)
gt create -m "add user avatar upload"
# → creates branch like: add-user-avatar-upload

# Amend current branch with new changes
gt modify -am "updated commit message"

# Amend without changing the message
gt modify -a

# Insert a branch between current and its child
gt create -i -m "extracted shared util"
```

### Submitting PRs (creating/updating)

```bash
# Submit current branch + all downstack branches as PRs
gt submit

# Submit with PR metadata editing in CLI
gt submit --cli

# Submit entire stack (including upstack)
gt ss  # alias for: gt submit --stack

# Submit in draft mode
gt submit --draft

# Submit and mark as merge-when-ready
gt submit --merge-when-ready

# Submit with specific reviewers
gt submit --reviewers "user1,user2"

# Submit with team reviewers
gt submit --team-reviewers "team-slug"

# Dry run — see what would be submitted
gt submit --dry-run

# Submit and open in browser
gt submit --view

# Skip all edit prompts (use existing metadata)
gt submit --no-edit

# Force re-push even if nothing changed
gt submit --always
```

### Merging

```bash
# Merge current branch + all downstack PRs via Graphite
gt merge

# Preview what would be merged
gt merge --dry-run

# Merge with confirmation prompt
gt merge --confirm
```

### Stack navigation

```bash
# View your stack
gt log          # compact view
gt log short    # shorter
gt log long     # full detail

# Navigate
gt up           # move to child branch
gt down         # move to parent branch
gt up 2         # jump up 2 levels
gt down 3       # jump down 3 levels
gt top          # go to tip of stack
gt bottom       # go to base of stack
gt checkout     # interactive branch selector
gt trunk        # show trunk branch name
```

### Stack management

```bash
# Sync trunk + restack all branches + clean merged
gt sync

# Restack current stack (rebase onto parents)
gt restack

# Move current branch onto a different parent
gt move

# Fold branch into its parent
gt fold

# Split current branch into multiple
gt split

# Squash all commits in current branch
gt squash

# Delete a branch (restacks children onto parent)
gt delete

# Undo last Graphite operation
gt undo

# Continue after resolving rebase conflicts
gt continue

# Abort a conflicting rebase
gt abort

# Auto-amend staged hunks to the right commits
gt absorb
```

### Reading PR info (gh is OK for reads)

```bash
# View PR details
gh pr view

# View PR checks/status
gh pr checks

# View PR comments
gh pr view --comments

# List open PRs
gh pr list

# View specific PR
gh pr view 123
```

### Getting PR review feedback (via GraphQL)

Use `gh api graphql` to fetch review threads with full comment bodies, resolution status, and file context. This works for any PR — including PRs in a Graphite stack.

```bash
# Get all review threads and comments for a PR
gh api graphql -F owner='{owner}' -F repo='{repo}' -F number=PR_NUMBER -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviews(last: 20) {
          nodes {
            author { login }
            state
            body
            submittedAt
          }
        }
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            isOutdated
            path
            line
            comments(first: 50) {
              nodes {
                body
                author { login }
                createdAt
              }
            }
          }
        }
      }
    }
  }
'
```

To get feedback across an entire Graphite stack, run the query for each PR. Use `gt log` to see the stack, then `gh pr view` on each branch to get PR numbers.

### Resolving review threads (via GraphQL)

After addressing review feedback, resolve the thread using the `resolveReviewThread` GraphQL mutation. **Never leave a comment saying "resolved" or "done" — just resolve the thread silently.**

**Step 1: Get the thread ID.** Query unresolved threads to find the `id` (a `PRRT_`-prefixed node ID):

```bash
gh api graphql -F owner='{owner}' -F repo='{repo}' -F number=PR_NUMBER -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            path
            line
            comments(first: 1) {
              nodes {
                body
                author { login }
              }
            }
          }
        }
      }
    }
  }
'
```

**Step 2: Resolve the thread** using its node ID:

```bash
gh api graphql -F threadId='PRRT_xxxxxxxxxxxx' -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread {
        id
        isResolved
      }
    }
  }
'
```

To resolve all unresolved threads on a PR at once:

```bash
# Get all unresolved thread IDs, then resolve each one
gh api graphql -F owner='{owner}' -F repo='{repo}' -F number=PR_NUMBER -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes { id isResolved }
        }
      }
    }
  }
' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | .id' \
| while read -r id; do
    gh api graphql -F threadId="$id" -f query='
      mutation($threadId: ID!) {
        resolveReviewThread(input: { threadId: $threadId }) {
          thread { id isResolved }
        }
      }
    '
  done
```

## Workflows

### "Open a PR on Graphite"

This is the sequence for creating and submitting a new PR:

```
1. gt sync                          # sync trunk first
2. gt create -am "commit message"   # create branch with changes
3. gt submit --cli                  # submit and set PR metadata via CLI
```

When writing the PR title and description during `gt submit`:
- Generate a humanized title (lowercase, under 60 chars, specific)
- Generate a humanized description (what changed, why, how to test)
- Pass them via the CLI prompts or use `--no-edit` after setting up

If the user already has changes on a branch:

```
1. gt submit --cli                  # just submit the current stack
```

### "Merge this with Graphite"

Merging follows a specific sequence:

```
1. gt log                           # review the stack state
2. gt submit --no-edit              # ensure latest is pushed
3. gh pr checks                     # verify CI is passing (read-only)
4. gt merge --confirm               # merge via Graphite with confirmation
5. gt sync                          # sync and clean up merged branches
```

Always merge from the **bottom of the stack up**. `gt merge` handles this automatically — it merges all branches from trunk to the current branch. After merging, `gt sync` cleans up.

### "Stack a PR on top of this"

```
1. # make your changes
2. gt create -am "next piece of work"   # stacks on current branch
3. gt ss                                # submit entire stack
```

### "Update a PR with new changes"

```
1. # make changes on the branch
2. gt modify -a                         # amend current branch
3. gt submit --no-edit                  # push update, keep existing metadata
```

Or if you want to update the PR description:

```
1. gt modify -a
2. gt submit --cli --edit               # re-edit metadata
```

### "Respond to review feedback mid-stack"

```
1. gt checkout branch-name              # jump to the branch with feedback
2. # fetch unresolved threads via gh api graphql (see "Getting PR review feedback" above)
3. # make fixes for each piece of feedback
4. gt modify -a                         # amend the branch
5. # resolve each addressed thread via gh api graphql resolveReviewThread (see "Resolving review threads" above)
6. gt restack                           # restack everything above
7. gt ss                                # re-submit the whole stack
```

When resolving threads: do NOT leave comments like "done" or "fixed" — just resolve the thread silently.

### "Get review feedback for a stack"

To collect all unresolved feedback across every PR in a Graphite stack:

```
1. gt log                               # see the full stack
2. # for each branch in the stack:
   gh pr view --json number --jq '.number'   # get the PR number
3. # run the reviewThreads GraphQL query (see above) for each PR number
4. # filter for isResolved: false to see outstanding feedback
```

### "Sync and rebase my stack"

```
1. gt sync                              # pulls trunk, restacks, prompts to delete merged
```

If conflicts arise during sync:

```
1. # resolve conflicts in your editor
2. git add .                            # stage resolved files
3. gt continue                          # continue the restack
```

### "Split a branch into smaller PRs"

```
1. gt split                             # interactive split
2. gt ss                                # submit the new stack
```

### "Reorder branches in my stack"

```
1. gt reorder                           # interactive reorder
2. gt ss                                # re-submit
```

## PR Copy Guidelines

When generating ANY text for PRs, commits, or comments, follow these patterns:

### Good PR titles
- `fix: password reset email not sending`
- `feat: add dark mode toggle to settings`
- `chore: remove deprecated analytics endpoint`
- `chore: bump react-query to v5`
- `refactor: extract shared auth middleware`
- `feat(api): add rate limiting to public endpoints`

### Bad PR titles
- `Fix: Implement robust password reset email sending mechanism`
- `feat: Add Dark Mode Toggle Feature To Settings Page Component`
- `Chore: Remove deprecated legacy analytics endpoint`
- `remove deprecated analytics endpoint` (missing prefix)

### Good PR descriptions
```
password reset emails weren't going out because the smtp config
was falling back to a stale env var after the infra migration.

switched to the new `SMTP_RELAY_URL` and added a health check
that logs a warning if the relay is unreachable on boot.

to test: trigger a password reset on staging, confirm email arrives.
```

### Bad PR descriptions
```
## Summary
This PR fixes an issue where password reset emails were not being
sent to users. The root cause was identified as a misconfiguration
in the SMTP settings.

## Changes
- Updated SMTP configuration to use new environment variable
- Added health check for SMTP relay
- Improved error handling

## Testing
Please test by triggering a password reset on staging.
```

## Tips

- **One logical change per branch.** Keep branches small and focused. This makes review easier and conflicts rarer.
- **`gt ss` is your friend.** After any modification to your stack, re-submit the whole thing.
- **Use `gt log` often.** It's the fastest way to see where you are.
- **Don't mix git and gt.** Once you're in a Graphite stack, stay in gt-land for branch operations.
- **`gt absorb` for fixups.** If you have staged changes that belong in different branches of your stack, `gt absorb` routes them automatically.
