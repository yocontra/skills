# Standup formatting reference

## Slack formatting

| Element | Correct | Wrong |
|---------|---------|-------|
| Bold | `*bold*` | `**bold**` |
| Bullets | `•` | `-` |
| Links | `[text](url)` | `<url\|text>` |
| Section headers | `*Last:*` / `*Today:*` | `**Last:**` |

## Item types

Link every PR and issue with the `url` field from the gathered JSON; never build a URL by hand. When the window spans more than one repo, write the reference as `repo#123` (short repo name) so readers can tell them apart; with one repo, `#123` is enough.

| Item type | Format |
|-----------|--------|
| Merged PR | `• Merged: [Title - #123](pr-url)` |
| Open PR (ready) | `• Open PR: [Title - #456](pr-url)` |
| Open PR (draft) | `• Draft PR: [Title - #456](pr-url)` |
| Grouped work item | `• Description of what was accomplished` |
| Closed issue | `• Closed: [#ID - Title](issue-url) (via #PR)` |
| Open issue | `• Issue: [#ID - Title](issue-url)` |
| Meeting | `• Meeting: Title (Xam, Xmins) w/ {team}` |

PR reviews are not tracked — review counts stopped meaning anything (high volume, many bot PRs). No "reviews completed" or "reviews needed" lines.

A `Closed:` issue needs both (a) the issue closed as completed inside the standup window, and (b) an identifiable PR that closed it; the PR number goes after `via`. With no PR, omit the issue (see [gather-issues-calendar.md](../../../workflows/standup/prompts/gather-issues-calendar.md)).

## Meetings

- Include start time and duration.
- Infer the team from title, description, or attendees, using the team names the user gave.
- For 1:1s, use the other person's first name: `w/ Dave`.
- If team or person cannot be determined, omit `w/`.
- Skip meetings unrelated to the user's work: keep project, team, and direct-collaborator meetings.
- Skip cancelled meetings (title starts with `Canceled:` / `Cancelled:`, or status `CANCELLED`).
- Skip meetings the user accepted as tentative, when the calendar tool exposes the user's own response.

## Ordering

PRs are listed on the day they were opened or merged, not the day they happen to still be open. A PR opened yesterday and still open belongs in *Last*. *Today* lists only PRs opened or merged since 9am today.

### Last (yesterday 9am → today 9am local; Friday 9am on Monday)

1. Merged PRs — `mergedAt` in the window
2. Open / draft PRs — `createdAt` in the window, not yet merged
3. Grouped work items — direct commits and pushes not captured by a PR
4. Closed issues — closed in the window with an identifiable PR
5. Meetings

### Today (9am local → now)

1. Merged PRs — `mergedAt` today
2. Open / draft PRs — `createdAt` today
3. Pushed-but-not-shipped work — review feedback addressed, fixes pushed to existing PRs
4. Open issues — top 3–4 by priority
5. Meetings

Never list a PR in both sections. Opened yesterday and merged today: once, as `Merged:` in *Today*. Opened yesterday and still open: once, as `Open PR:` in *Last*.

## Example

```
*Last:*
• Merged: [Textual TUI for CLI screens with shared design system - studio#579](https://github.com/acme/studio/pull/579)
• Merged: [Centralize form components around FormField - studio#576](https://github.com/acme/studio/pull/576)
• Open PR: [input_schema and step compatibility checks - studio#572](https://github.com/acme/studio/pull/572)
• Open PR: [Pin runner image digest in deploy config - infra#88](https://github.com/acme/infra/pull/88)
• Replaced untyped API fields with typed scalars for better validation
• Fixed execution rows not appearing instantly after hitting run
• Closed: [studio#561 - Studio broken with s.access?.mcps?.map is not a function](https://github.com/acme/studio/issues/561) (via studio#576)
• Meeting: Team All-Hands (3pm, 1hr)

*Today:*
• Draft PR: [AgentEndpoint resource for chat completions - studio#578](https://github.com/acme/studio/pull/578)
• Pushed review-feedback fixes on the input_schema PR
• Issue: [studio#566 - Add steps.* namespace and static template validation](https://github.com/acme/studio/issues/566)
• Meeting: Cross-Team Sync (9am, 30mins) w/ Partner Team
• Meeting: Eng Leads Sync (10:05am, 55mins) w/ Partner Team
```

studio#572 and infra#88 were opened in the lookback window and are still open, so they sit in *Last*. studio#578 was opened today, so it sits in *Today*. Two repos appear, so every reference carries its repo name.
