# gt command reference

Back to [SKILL.md](../SKILL.md). Interactive commands need a terminal; the agent-safe
form is noted where one exists. In an agent shell add the global `--no-interactive`, which
turns prompts, pagers, and editors off.

## Create and amend

```bash
gt create -m "msg"          # new stacked branch from staged changes; name derives from msg
gt create -am "msg"         # stage all changes first
gt create -i -m "msg"       # insert between the current branch and its child
gt modify -a                # amend current branch with all changes, keep message
gt modify -am "new msg"     # amend and reword
gt modify -c -am "msg"      # add a new commit instead of amending
gt absorb --force           # amend staged hunks into the right branches; bare form prompts
gt absorb --dry-run         # show where each hunk would go
gt track --parent <branch>  # track a branch made with plain git; bare form prompts for the parent
```

## Submit

```bash
gt submit                   # current branch + everything below it
gt ss                       # gt submit --stack: include branches above too
gt submit --no-edit         # skip metadata prompts, keep existing title/description
gt submit --cli             # edit PR metadata in the terminal instead of the web (prompts)
gt submit --edit            # re-edit title and description (prompts)
gt submit --edit-description  # re-edit only the description (prompts)
gt submit --draft
gt submit --merge-when-ready
gt submit --reviewers "user1,user2"
gt submit --team-reviewers "team-slug"
gt submit --dry-run         # show what would be submitted
gt submit --view            # open the PR in a browser afterwards
gt submit --always          # push even if nothing changed
```

## Merge

```bash
gt merge --dry-run          # preview
gt merge                    # merge trunk..current through Graphite, bottom up
gt merge --confirm          # ask before merging (terminal only)
```

## Navigate

```bash
gt log                      # stack view; also `gt log short` (gt ls), `gt log long` (gt ll)
gt up / gt down             # child / parent; `gt up 2`, `gt down 3` jump levels
gt top / gt bottom          # tip / base of the stack
gt checkout <branch>        # bare `gt checkout` is an interactive picker
gt trunk                    # print the trunk branch
```

## Manage the stack

```bash
gt sync                     # pull trunk, restack all, prompt before deleting merged branches
gt sync --force             # same, without prompting (agent-safe)
gt restack                  # rebase each branch onto its parent
gt move --onto <branch>     # reparent the current branch; bare `gt move` is interactive
gt fold                     # fold the current branch into its parent
gt split --by-file <pathspec>  # move matching files into a new parent branch (no prompts)
gt split                    # --by-commit / --by-hunk: interactive
gt reorder                  # reorder branches (opens an editor)
gt squash --no-edit         # squash the current branch's commits, keep the message
gt delete <branch>          # local only; children restack onto its parent; prompts if unmerged
gt delete <branch> --close  # also close its PR on GitHub
gt undo --force             # undo the last gt operation; bare form prompts
gt continue / gt abort      # after a restack conflict
```

## Read PR state with gh

Bound every read.

```bash
gh pr view <branch|number> --json number,title,state,url
gh pr checks <branch|number>
gh pr view <number> --json comments --jq '.comments[] | {author: .author.login, body: .body[:200]}'
gh pr list --author @me --limit 20
```

Review threads, and resolving them, are in [review-threads.md](review-threads.md).
