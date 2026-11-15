---
name: sentry
effort: low
description: Sentry error tracking (sentry.io or self-hosted) — find the grouped issue for a production exception, read its stacktrace and user count, and resolve, unresolve, or mute it via sentry-cli and the Sentry API.
---

$ARGUMENTS

# Sentry

Work Sentry issues with `sentry-cli` (lists and bulk status changes) and the Sentry REST API (event detail, stacktraces, counts). Flags below match `sentry-cli` 3.x; check `sentry-cli <cmd> --help` on an older install.

## Discover config before asking

`sentry-cli` merges, in order: CLI flags, environment (`SENTRY_URL`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`), the nearest `.sentryclirc` walking up from the working directory, `~/.sentryclirc`, and a `sentry.properties` file. Read the merged result instead of guessing:

```bash
command -v sentry-cli || echo "install: brew install getsentry/tools/sentry-cli  (or curl -sL https://sentry.io/get-cli/ | sh)"
sentry-cli info --config-status-json | jq '{url: .config.url, org: .config.org, project: .config.project, auth: .auth.type}'
```

Also look in the repo for the SDK's DSN (`SENTRY_DSN`, `Sentry.init`, `sentry_sdk.init`): its host names the instance and its trailing number is the project ID. Set `SENTRY_URL` from `info` (default `https://sentry.io`; EU-region orgs use `https://de.sentry.io` for API calls; self-hosted is the instance root).

`sentry-cli` ignores a configured URL when the token comes from a different source (it warns), so keep URL and token together: both in one `.sentryclirc`, or both in the environment.

Ask the user only for what is still missing. With no token, they create one at `<SENTRY_URL>/settings/account/api/auth-tokens/` with `project:read`, `event:read`, `event:write` (to resolve), and `org:read`, then `export SENTRY_AUTH_TOKEN=...` or run `sentry-cli login`. Do not write the token into a file in the repo.

Environment names vary (`production`, `prod`, `live`). List what the project actually uses before filtering:

```bash
curl -sS -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "$SENTRY_URL/api/0/projects/$SENTRY_ORG/$SENTRY_PROJECT/environments/" | jq -r '.[].name'
```

Default to the production environment unless the user names another.

## Find issues

`--max-rows` caps output; without it `issues list` fetches up to five pages (500 issues).

```bash
sentry-cli issues list --query "is:unresolved environment:production" --max-rows 25
sentry-cli issues list --query "is:unresolved environment:production NullPointerException" --max-rows 10
sentry-cli issues list --query "is:unresolved environment:production error.type:TimeoutError transaction:/checkout" --max-rows 10
sentry-cli issues list --query "is:unresolved firstSeen:-24h" --max-rows 25
```

Search syntax: https://docs.sentry.io/concepts/search/. Add `-o <org> -p <project>` when the config does not set them.

## Read an issue

The numeric issue ID from the list is what the API takes. Bound every response with `jq`:

```bash
H="Authorization: Bearer $SENTRY_AUTH_TOKEN"
API="$SENTRY_URL/api/0/organizations/$SENTRY_ORG"

# Totals: events, affected users, first/last seen, status
curl -sS -H "$H" "$API/issues/<issue-id>/" \
  | jq '{shortId, title, culprit, count, userCount, firstSeen, lastSeen, status, permalink}'

# Latest event: exception type, message, top 8 in-app frames
curl -sS -H "$H" "$API/issues/<issue-id>/events/latest/" \
  | jq '{eventID, dateCreated, release: .release.version, tags: [.tags[] | select(.key|test("environment|release|server_name")) | "\(.key)=\(.value)"],
         exception: [.entries[] | select(.type=="exception") | .data.values[] | {type, value,
           frames: [.stacktrace.frames | map(select(.inApp)) | .[-8:][] | "\(.filename):\(.lineNo) \(.function)"]}]}'

# Tag breakdown, e.g. which releases or hosts
curl -sS -H "$H" "$API/issues/<issue-id>/tags/release/" | jq '.topValues[:5][] | {value, count}'
```

`sentry-cli events list --max-rows 10 -U -T` lists recent project events with users and tags.

Web link: the `permalink` field above. On sentry.io it has the form `https://<org>.sentry.io/issues/<issue-id>/`.

## Change status

Resolving, muting, or reopening changes what every teammate sees and can silence alerts. When the request identifies the issues, change them and report each short ID, title, and new status. Ask only when nothing in context identifies which issues are meant.

```bash
sentry-cli issues resolve -i <issue-id>
sentry-cli issues unresolve -i <issue-id>
sentry-cli issues mute -i <issue-id>
```

`resolve --status unresolved` or `--all` changes every matching issue in the project at once, with no bulk undo. Run those only when the user asks for the bulk change by name, and report the count `issues list` returned for the same filter.

To resolve in the next release instead of now:

```bash
curl -sS -X PUT -H "$H" -H 'Content-Type: application/json' \
  "$API/issues/<issue-id>/" -d '{"status": "resolvedInNextRelease"}' | jq '{status, statusDetails}'
```

## Clean up

Write any response you need to keep between commands into a temp directory created with `D=$(mktemp -d); trap 'rm -rf "$D"' EXIT`, not into the repo. If you sent a test event (`sentry-cli send-event`) to check a DSN or alert rule, resolve the issue it created, by its ID, before finishing.

## Exit checklist

- [ ] Every list and API call was bounded (`--max-rows`, `jq` field selection)
- [ ] Every status change touched only the issues the request identified, and the report lists them
- [ ] Temp files removed; test events this session sent are resolved
