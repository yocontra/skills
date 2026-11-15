# GitHub MCP Server Reference

Companion to `graphql.md`. The official [`github/github-mcp-server`](https://github.com/github/github-mcp-server) exposes GitHub (github.com or GitHub Enterprise) as MCP tools.

**Detect availability:** if tools named `mcp__github__*` are listed in your environment, the server is wired up. If not, install and configure it (next section).

**Why this and not `@modelcontextprotocol/server-github` (npm)?** The npm package hardcodes `https://api.github.com` and is deprecated. The official Go server supports `GITHUB_HOST` for GitHub Enterprise.

## Installation

Two options:

- **Remote server (github.com only):** GitHub hosts it at `https://api.githubcopilot.com/mcp/`. `claude mcp add --transport http github https://api.githubcopilot.com/mcp/ -H "Authorization: Bearer $(gh auth token)"` — run it yourself in a terminal so the token stays out of the agent's context.
- **Local binary:** download a release from <https://github.com/github/github-mcp-server/releases>, `go install github.com/github/github-mcp-server/cmd/github-mcp-server@latest`, or run the Docker image `ghcr.io/github/github-mcp-server`.

The console command is `github-mcp-server stdio`.

## Configuration

| Var | Value | Notes |
|---|---|---|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | your PAT or App installation token | Read on startup; a missing token is a clean error and exit. |
| `GITHUB_HOST` | `https://github.example.com` | GitHub Enterprise only. Must include the `https://` scheme. Unset means github.com. |

Optional flags worth knowing:

| Flag / env | Default | When to use |
|---|---|---|
| `--toolsets` / `GITHUB_TOOLSETS` | `context,repos,issues,pull_requests,users` | Add or restrict tool groups (see *Toolsets* below). |
| `--tools` / `GITHUB_TOOLS` | unset | Enable a specific tool by name (additive with toolsets). |
| `--exclude-tools` | unset | Disable specific tools regardless of toolset. |
| `--read-only` / `GITHUB_READ_ONLY=1` | off | Strip every write-capable tool. Use for read-only audit agents. |
| `--lockdown-mode` / `GITHUB_LOCKDOWN_MODE=1` | off | Restricts public-repo content reads to authors with push access. |
| `--content-window-size` | 5000 | Truncates large file/comment payloads. |
| `--log-file` | unset | Path for server logs. |

### MCP client config

```json
{
  "mcpServers": {
    "github": {
      "command": "github-mcp-server",
      "args": ["stdio"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PAT}"
      }
    }
  }
}
```

Add `"GITHUB_HOST": "https://github.example.com"` to `env` for GitHub Enterprise. `${GITHUB_PAT}` is a placeholder the harness substitutes at startup. Never commit raw tokens.

### Read-only profile

Defensive default for agents that should never write: add `"--read-only"` to `args`. It keeps the read surface but strips every write-capable tool (no `create_pull_request`, no `merge_pull_request`, no `add_issue_comment`, etc.).

## Authentication

Reuse the `gh` login when you have one:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=$(gh auth token)   # never echo it
github-mcp-server stdio
```

For pipelines that want a bot identity, mint a GitHub App installation token (see [auth.md](auth.md#github-app-authentication)) and pass it as `GITHUB_PERSONAL_ACCESS_TOKEN`. It expires after an hour; re-mint before then.

### Token scopes

Minimum scopes for the default toolset:

- `repo` — read repos, PRs, issues, commits
- `read:org` — list org members and teams
- `read:user` — `get_me`

Add `workflow` for the `actions` toolset, `gist` for `gists`, etc. `gh auth refresh -s <scopes>` extends an existing `gh` session.

## Toolsets

The `--toolsets` flag (or `GITHUB_TOOLSETS` env) controls which tool groups load. Default is `context,repos,issues,pull_requests,users`; `copilot` is opt-in.

| Toolset | What it covers |
|---|---|
| `context` | `get_me` and similar identity helpers |
| `repos` | `get_file_contents`, `list_branches`, `list_tags`, `list_commits`, `get_commit`, `create_repository`, `fork_repository`, `create_or_update_file`, `delete_file`, `push_files`, `create_branch`, `search_repositories`, `search_code`, `search_commits` |
| `pull_requests` | `pull_request_read`, `list_pull_requests`, `create_pull_request`, `update_pull_request`, `update_pull_request_branch`, `merge_pull_request`, `pull_request_review_write`, `add_comment_to_pending_review`, `add_reply_to_pull_request_comment`, `request_copilot_review`, `search_pull_requests` |
| `issues` | `issue_read`, `issue_write`, `list_issues`, `list_issue_types`, `add_issue_comment`, `assign_copilot_to_issue`, `sub_issue_write`, `get_label`, `search_issues` |
| `users` | `search_users`, `list_repository_collaborators`, `get_team_members`, `get_teams` |
| `copilot` | `assign_copilot_to_issue`, `request_copilot_review` |
| `actions` | GitHub Actions runs, jobs, logs |
| `code_quality`, `code_security`, `secret_protection`, `security_advisories`, `dependabot` | Advanced Security features (require GitHub Advanced Security) |
| `discussions`, `gists`, `git`, `labels`, `notifications`, `orgs`, `projects`, `stargazers` | Each adds the corresponding endpoint surface |

Special keywords: `all` enables every toolset, `default` enables the default set.

```bash
# Default + actions + git
github-mcp-server stdio --toolsets default,actions,git

# Only the bare minimum
github-mcp-server stdio --toolsets context,repos
```

## Available Tools (default toolset)

### Repos

| Tool | Purpose |
|---|---|
| `mcp__github__get_file_contents` | Read a file or list a directory. `path: "/"` lists the repo root. Returns text content for files, JSON dir listing for dirs, or a `resource_link` for files above the content window. |
| `mcp__github__list_branches` | List branches in a repo. |
| `mcp__github__list_tags` | List git tags. |
| `mcp__github__get_tag` | Resolve a tag to its commit SHA. |
| `mcp__github__list_commits` | Commit history with author / message / SHA. |
| `mcp__github__get_commit` | Single commit detail (files, stats, parents). |
| `mcp__github__create_repository` | Create a new repo (write). |
| `mcp__github__fork_repository` | Fork into your namespace (write). |
| `mcp__github__create_or_update_file` | Single-file commit (write). |
| `mcp__github__delete_file` | Single-file delete (write). |
| `mcp__github__push_files` | Multi-file commit (write). |
| `mcp__github__create_branch` | New branch from a base (write). |
| `mcp__github__search_repositories` | Repo search across the host. |
| `mcp__github__search_code` | Code search across the host. |
| `mcp__github__search_commits` | Commit search by message / author. |
| `mcp__github__list_releases` | List releases for a repo. |
| `mcp__github__get_latest_release` | Resolve `releases/latest`. |
| `mcp__github__get_release_by_tag` | Look up a release by its tag. |

### Pull requests

| Tool | Purpose |
|---|---|
| `mcp__github__pull_request_read` | Get PR detail — bundles meta, diff, files, comments depending on `read_type`. |
| `mcp__github__list_pull_requests` | List PRs filtered by state/head/base/sort. |
| `mcp__github__create_pull_request` | Open a PR (write). |
| `mcp__github__update_pull_request` | Edit title/body/state/base (write). |
| `mcp__github__update_pull_request_branch` | Bring PR head up to date with base (write). |
| `mcp__github__merge_pull_request` | Merge PR with merge method (write). |
| `mcp__github__pull_request_review_write` | Submit a PR review — `event` ∈ `APPROVE`, `REQUEST_CHANGES`, `COMMENT` (write). |
| `mcp__github__add_comment_to_pending_review` | Inline review comment on a specific line (write). |
| `mcp__github__add_reply_to_pull_request_comment` | Reply to an existing review comment thread (write). |
| `mcp__github__request_copilot_review` | Request Copilot review (write; needs Copilot-enabled host). |
| `mcp__github__search_pull_requests` | PR search via `is:pr` query syntax. |

### Issues

| Tool | Purpose |
|---|---|
| `mcp__github__issue_read` | Get issue detail (body + comments). |
| `mcp__github__list_issues` | List issues with state/labels/assignee filters. |
| `mcp__github__list_issue_types` | List custom issue types defined in the repo/org. |
| `mcp__github__issue_write` | Create / update / close issues (write). |
| `mcp__github__add_issue_comment` | Add a comment to an issue (write). |
| `mcp__github__assign_copilot_to_issue` | Assign GitHub Copilot to work the issue (write). |
| `mcp__github__sub_issue_write` | Manage parent/child issue relationships (write). |
| `mcp__github__get_label` | Look up a label's color/description. |
| `mcp__github__search_issues` | Issue search via `is:issue` query syntax. |

### Users / orgs

| Tool | Purpose |
|---|---|
| `mcp__github__get_me` | Authenticated user profile + login. Use to confirm token identity. |
| `mcp__github__search_users` | User search by name / login fragment. |
| `mcp__github__list_repository_collaborators` | Direct collaborators on a repo (excludes inherited team access). |
| `mcp__github__get_teams` | Teams under an org. |
| `mcp__github__get_team_members` | Members of a specific team. |

## Quick Recipes

**Confirm token + host wired up**:
```
get_me() → returns {login, name, email, ...}
```

**Read a file from octo-org/octo-repo**:
```
get_file_contents(owner="octo-org", repo="octo-repo", path="README.md")
```

**List the repo root**:
```
get_file_contents(owner="octo-org", repo="octo-repo", path="/")
```

**Find recent open PRs**:
```
list_pull_requests(owner="octo-org", repo="octo-repo", state="open", perPage=10)
```

**Search code across the host**:
```
search_code(query="GITHUB_HOST language:python org:octo-org")
```

**Read a PR with diff + comments**:
```
pull_request_read(owner="octo-org", repo="octo-repo", pullNumber=1387, read_type="all")
```

**Approve a PR**:
```
pull_request_review_write(owner=..., repo=..., pullNumber=N, event="APPROVE", body="LGTM")
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Error: GITHUB_PERSONAL_ACCESS_TOKEN not set` on stdio start | env not exported into the MCP server process | Verify via `env \| grep -c GITHUB_PERSONAL`; if using a config file, confirm the harness does var substitution. |
| Every call 404s on Enterprise | `GITHUB_HOST` missing or omitting `https://` | Set `GITHUB_HOST=https://<host>`. The bare hostname is **not** accepted. |
| `403 Forbidden` on a tool | Token lacks scope | `gh auth refresh -s repo,read:org,workflow` then re-export. |
| `get_file_contents` returns a `resource_link` instead of text | File exceeds `--content-window-size` (5000 chars default) | Bump `--content-window-size` or fetch via raw URL. |
| Tool not found at runtime | Toolset not enabled | Add the relevant toolset via `--toolsets` (e.g. `--toolsets default,actions`). |
| Claude Code doesn't see `mcp__github__*` tools after install | MCP not registered with the harness | Have the user run `claude mcp add github -e GITHUB_PERSONAL_ACCESS_TOKEN=$(gh auth token) -- github-mcp-server stdio` in their own terminal. |

## Endpoints Not Exposed by the MCP

The MCP covers the most common GitHub API surface. For anything not listed above (raw GraphQL, admin endpoints, audit log, `gh api repos/...` one-offs), drop to the `gh` CLI — it shares the same auth and host. See `graphql.md` in this skill for GraphQL recipes.
