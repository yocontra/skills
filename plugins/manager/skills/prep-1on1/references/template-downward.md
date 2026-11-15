# Per-report 1:1 doc — canonical template

The shape of the user's own rolling 1:1 doc, one per direct report.
The skill never writes to it: Step 4 reads it for carry-over, and
Step 6 shapes the prep packet so the user can paste it in.

## Title

```
1:1 — <Full Name>
```

The em-dash (`—`, U+2014) is a stable exact-match anchor for search;
hyphens are too common. Don't substitute a hyphen.

## Initial content

A doc set up in this layout starts with this body:

```markdown
# 1:1 — <Full Name>

**Manager:** <Manager Full Name> (<manager email>)
**Report:** <Full Name> (<report email>)
**Started:** <YYYY-MM-DD report's first day on this team, if known; else creation date>

This doc captures the running record of 1:1 meetings between manager and
report. Each meeting adds a dated section. Open action items are tracked
in the table below.

## Open action items

| Item | Owner | Created | Notes |
|------|-------|---------|-------|

<!-- Paste prep-1on1 packets below, newest first. -->
```

Leave the action-items table empty. Don't pre-populate placeholder rows.

## Section per meeting

Each meeting gets a section like this, **above** any prior dated
sections (newest first). The prep packet supplies it:

```markdown
## YYYY-MM-DD

### Topics
- <talking point 1>
- <talking point 2>
- <talking point 3>

### Notes / decisions
<left empty for the manager to fill during the meeting>

### Action items
- [ ] <action item 1> — owner: <report or manager>
- [ ] <action item 2> — owner: <report or manager>

---
```

Rules for the dated section:

- Date is `$TODAY` from the skill's frozen Step 0 calculation.
- Horizontal rule (`---`) separates sections.
- `Notes / decisions` and `Action items` start empty. The prep
  packet supplies `Topics` only — the manager writes the rest during
  the meeting.

## Open action items table

The table at the top of the doc carries the canonical state of open
action items across meetings. Each row:

| Column | Description |
|--------|-------------|
| Item | Short description (matches the original `- [ ]` line, minus the checkbox) |
| Owner | `report` or `manager` |
| Created | Date the item was first added (YYYY-MM-DD) |
| Notes | Status indicator + notes. Empty when fresh; `🟡 stale` if older than 14 days; `closed` once done |

When Step 4 parses the doc, read this table together with the dated
sections:

1. Open `- [ ]` lines in dated sections that are not in the table are
   still open action items.
2. A row whose item is checked (`- [x]`) in some dated section is
   closed, whatever its Notes say.
3. A row whose Created date is more than 14 days before `$TODAY` and
   is not closed is stale.

The manager edits the table by hand; the prep packet reports what it
found and leaves the table alone.

## Why this shape

- **Em-dash in title.** Stable exact-match anchor for search.
  Hyphens are too common to use as a structured marker.
- **Action items in a table at top, not buried in dated sections.** The
  table answers "what's outstanding?" The dated sections answer "what
  did we talk about then?"
- **Topics auto-generated, notes manual.** Auto-generating notes
  pretends the skill was in the meeting. It wasn't.
