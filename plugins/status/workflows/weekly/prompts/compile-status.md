# Compile: assemble the final weekly status

Compile the final weekly status from the per-author sections and the optional metrics line.

## Format rules

- Markdown limited to a bold initials header per author and `- ` bullets, so it pastes cleanly into a doc, chat, or email.
- Per author: `**[II]**` on its own line, then `- ` bullets.
- No headings, links, URLs, PR numbers, or commit hashes.
- Terse one-line bullets.
- If a metrics line is provided, append it at the bottom: no label, plain comma-separated values.

## Ordering

- Authors by initials A→Z unless an explicit order is provided.
- Within a section: in-progress first, then shipped features, then 🐞 bug fixes.
- Keep the supplied order of bullets within each category.

## Edge cases

- Ambiguous PRs (feature or fix): feature, unless the text clearly says fix, bug, or regression.
- Reverts: 🐞 bug fixes.
- Refactors with behavior change: feature. Pure refactors: drop.
- An author with zero bullets: omit the section; never emit an empty header.
- No metrics line: omit it; no placeholder.

## Example

```
**[AB]**
- Drafting new auth flow for service X
- Shipped retry logic for upload pipeline
- 🐞 Fixed crash on empty payload

**[CD]**
- Shipped CLI rewrite for workspace commands
- 🐞 Reverted bad migration on user table

12 PRs merged, 3 in review, 47 commits
```

## Output

Return `{ "status": "<compiled status>" }`: one string with `\n` line breaks and no leading or trailing blank lines.
