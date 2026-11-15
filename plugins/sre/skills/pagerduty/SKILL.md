---
name: pagerduty
effort: low
description: PagerDuty via the `pd` CLI — open and recent incidents, who is on call, acknowledge, resolve, or add notes. Statuses repeat as separate `-s` flags, never comma-joined.
---

$ARGUMENTS

# PagerDuty

Drive PagerDuty with the open-source `pd` CLI (`npm install -g pagerduty-cli`). Every flag below was checked against `pd` 0.1.18; run `pd <topic>:<command> --help` when in doubt (`pd incident:list --help`).

## Discover config before asking

1. `pd auth get` prints the active domain (`<subdomain>.pagerduty.com`) and user. Saved tokens live in `~/.config/pagerduty-cli/config.json`; `pd auth list` shows every saved domain and `pd auth use -a <alias>` switches.
2. No saved auth: `pd login` (browser OAuth) or `pd auth add -t <token>` with a User API token from My Profile → User Settings → API Access. A one-off token goes in `--token "$PAGERDUTY_TOKEN"` without saving.
3. The user's team and services: `pd rest get -e /users/me -P 'include[]=teams' | jq '{id: .user.id, email: .user.email, teams: [.user.teams[].summary]}'`. Scope lists to those teams unless the user asks for the whole account.

Ask only for what these do not answer, such as which service an ambiguous name means.

## Read

```bash
# Open incidents for my team, untruncated
pd incident list -s triggered -s acknowledged -t "<team>" --no-truncate

# Recent incidents for one service, any status, bounded window
pd incident list -s triggered -s acknowledged -s resolved -S "<service>" --since "24 hours ago" --limit 50 --no-truncate

# Assigned to me, as compact JSON
pd incident list -m -j | jq '.[] | {id, incident_number, title, status, urgency, created_at}'

# One incident and its timeline
pd rest get -e /incidents/<ID> | jq '.incident | {id, title, status, urgency, created_at, service: .service.summary, assignees: [.assignments[].assignee.summary]}'
pd incident log -i <ID> --no-truncate
pd incident notes -i <ID>
```

Without `-t`, `-S`, `-m` or `-e`, `incident list` covers every service in the account. `-s` defaults to `open` (triggered + acknowledged).

### Who is on call

```bash
# Me, over a window (the API caps a window at 90 days)
ME=$(pd rest get -e /users/me | jq -r .user.id)
pd rest get -e /oncalls -P "user_ids[]=$ME" -P "since=2026-10-31T00:00:00Z" -P "until=2026-11-02T23:59:59Z" \
  | jq -r '.oncalls[] | "\(.start) \(.end) \(.schedule.summary // "-") L\(.escalation_level)"'

# A schedule or an escalation policy, by name or ID
pd schedule oncall -n "<schedule name>" --since "now" --until "3 days from now"
pd ep oncall -n "<escalation policy>"
pd schedule list -n "<partial>" --limit 20
```

Use `--since`/`--until` for any "this weekend" or "tonight" question so the answer covers the window asked.

## Write

Acknowledging, resolving, reassigning, merging, and adding notes change shared state other responders see, and an ack stops escalation for everyone. When the request identifies the incidents, run the write and report the IDs and titles you changed. Ask only when nothing in the request or context identifies which incidents it means, such as "resolve these" with no list in view. Never run the `-m` bulk forms unless the user names them.

"Resolve all open incidents for <service>" identifies its set, so resolve it in the same turn:

1. Pin the exact service: `pd service list -n "<name>"`, then list with `-X "<exact name>"`. `-S` is a substring match and also catches `<name>-worker`.
2. List: `pd incident list -s triggered -s acknowledged -X "<exact name>" --no-truncate`.
3. Resolve exactly the IDs that list returned: `pd incident resolve -i <ID1> -i <ID2>`. Do not re-query inside the resolve step (a loop over a fresh `pd incident list -p`), because an incident opened since the list would be resolved unseen.
4. Report the resolved IDs and titles, and any that failed.

```bash
pd incident ack -i <ID>                 # repeat -i for more; -z 1h also snoozes
pd incident resolve -i <ID>
pd incident notes -i <ID> -n "Rolled back to v1.4.2; error rate back to baseline."
pd incident reassign -i <ID> -U <user-email>   # or -E "<escalation policy name>"
```

Writes as a user token act as that user. With an account-level token, add `-F <your-login-email>` for the `From` header.

## Raw API

`pd rest get|post|put|delete -e <path> [-P key=value]... [-H Header=value]`. It always prints JSON and has no `-j`. `pd rest fetch` paginates a list endpoint for you and accepts `--limit`:

```bash
pd rest fetch -e /incidents -P "service_ids[]=PXXXXXX" -P "since=2026-10-27T00:00:00Z" --limit 100 \
  | jq '.[] | {id, title, status, created_at}'
```

## Flags

| Flag | Meaning |
|------|---------|
| `-s` | Status, repeat per value: `-s triggered -s acknowledged` |
| `-t` / `-T` | Team name contains / equals |
| `-S` / `-X` | Service name contains / equals |
| `-m` | Assigned to me |
| `-e` / `-E` | Assignee email contains / equals |
| `-n` | Title contains |
| `-u` | Urgency, repeat per value |
| `--since` / `--until` | Window; natural language or ISO 8601 |
| `--limit` | Cap rows |
| `--no-truncate`, `-j`, `--csv`, `-k <field>`, `-p` | Output: full columns, JSON, CSV, extra field, IDs only |

The alphanumeric `id` (`Q1ABCDEF2GHIJK`) is what every command and API path takes; `incident_number` is for display.

## Clean up

This skill reads and edits incidents in place. If you ran `pd incident create` or `pd event alert` to test a route, resolve exactly that incident (by the ID or dedup key you created) before finishing, and say so. Resolve other incidents only when the request identifies them.

## Exit checklist

- [ ] The answer covers the window and team the user asked about
- [ ] Every write touched only the incidents the request identified, and the report lists their IDs
- [ ] Any test incident or event this session created is resolved
