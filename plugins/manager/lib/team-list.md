# Team list recipe

Shared recipe for every team-aware skill in this plugin. No directory
service is used: the roster comes from what the user says and what
GitHub can see. Resolve it once per run and keep it in the conversation
(or in the run's `$RUN_DIR/team.json` for agents); there is no persistent
cache.

## Sources, first that works

1. **Names the user gives** ("Dana, Sam, and Priya"). Resolve each to a
   GitHub login with step 4 only when needed.
2. **A GitHub team** the user names, or the `org`/`team` in the skill's
   config:

   ```bash
   gh api "orgs/$ORG/teams/$TEAM/members?per_page=100" --jq '.[].login' | head -100
   gh api "users/$LOGIN" --jq '{login, name, email}'   # one call per login
   ```

3. **Recent authors** of repos the user points at ("whoever works here"),
   or of the current checkout. Take the last 90 days, keep regular
   contributors, and list them in the output so a wrong roster is easy
   to spot:

   ```bash
   git -C "$REPO" log --since=90.days --format='%aN <%aE>' | sort | uniq -c | sort -rn | head -30
   gh api "repos/$OWNER/$NAME/contributors?per_page=30" --jq '.[] | "\(.login) \(.contributions)"'
   ```

4. **Login lookup** for a name with no login:

   ```bash
   gh api "search/users?q=<url-encoded name>" --jq '.items[0:5][].login'
   ```

   Take the best fit (name plus recent activity in the team's repos) and
   name it in the output.

If none of these works, say which roster could not be resolved,
continue with what you have, and ask for the names in the skill's
closing questions.

## Shape

| Field | Notes |
|---|---|
| `name` | Display name |
| `gh_login` | Used for every `gh search` call |
| `email` | Commit email, if known; used for `git log --author` |
| `role` | `report`, `manager`, `skip`, `peer` — only when the user says so |

Drop bots (logins ending in `[bot]`, or accounts the user marks as
service accounts) unless the skill works on bot-owned PRs.

## Edge cases

- `gh api` returns 404 for a team the token cannot see: say so and fall
  back to source 3.
- One person with several commit emails is one person; merge by name or
  GitHub login, and note any merge you are unsure of in the output.
- An empty roster (a new manager with no reports) is a valid answer, not
  an error.
- For a manager's wider team or a skip-level org, use the named team and
  its child teams (`gh api "orgs/$ORG/teams/$TEAM/teams" --jq '.[].slug'`)
  and list the set used. Do not infer reporting lines from commit
  history.
