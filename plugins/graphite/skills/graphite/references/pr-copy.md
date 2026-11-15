# PR and commit copy

Back to [SKILL.md](../SKILL.md). Applies to every PR title, description, review reply, and
commit message.

## Titles

- Conventional-commit prefix: `fix:`, `feat:`, `chore:`, `refactor:`, `docs:`, `test:`,
  `perf:`, `ci:`, `build:`, `style:`. A scope is fine: `feat(api):`.
- Lowercase after the prefix unless it is a proper noun.
- Under 60 characters, direct and specific, no trailing period.

Good:

- `fix: password reset email not sending`
- `feat: add dark mode toggle to settings`
- `chore: remove deprecated analytics endpoint`
- `chore: bump react-query to v5`
- `refactor: extract shared auth middleware`
- `feat(api): add rate limiting to public endpoints`

Bad:

- `Fix: Implement robust password reset email sending mechanism` — capitalized, buzzwords
- `feat: Add Dark Mode Toggle Feature To Settings Page Component` — title case, padded
- `Chore: Remove deprecated legacy analytics endpoint` — capitalized prefix
- `remove deprecated analytics endpoint` — no prefix

## Descriptions

- Open with what changed and why. No "This PR...", "This commit...", "In this change...".
- No buzzwords: `leverage`, `utilize`, `streamline`, `robust`, `scalable`.
- Active voice: say who does what.
- Short paragraphs or bullets, written the way you would explain it to a teammate at
  your desk. Include how to test.

Good:

```
password reset emails weren't going out because the smtp config
was falling back to a stale env var after the infra migration.

switched to the new `SMTP_RELAY_URL` and added a health check
that logs a warning if the relay is unreachable on boot.

to test: trigger a password reset on staging, confirm email arrives.
```

Bad — templated headers and filler around the same content:

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

If the repo has a PR template, fill it in; these rules govern the prose inside it.
