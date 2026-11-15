# Upward 1:1 prep doc — canonical template

The shape of the user's own **rolling** doc, one per user, that
accumulates prep sections for *all* upward 1:1s (manager, skip-level,
exec, as the org has them). Each section is tagged with the
interlocutor so prep for different people can coexist in the same doc. The skill never writes to
it: Step 4 reads it for carry-over, and Step 6 shapes the prep
packet so the user can paste it in.

## Title

```
Upward 1:1 prep — <Your Name>
```

The em-dash matters (same anchor convention as `1:1 — <Name>` for
downward docs). If the user already keeps a doc under another title,
use theirs.

## Initial content

```markdown
# Upward 1:1 prep — <Your Full Name>

**You:** <Your Full Name> (<your email>)
**Upward chain:** <Manager Name> → <their manager> → ... (as known)

This doc is the running record of prep for 1:1s with people above me
in the org chart. Each prep run adds a dated section, tagged with
which meeting it's for. Structure of each section: Wins headline,
Decisions Needed, Asks, Team, Personal / Growth, FYI.

<!-- Paste prep-1on1 upward packets below. Newest first. -->
```

## Per-meeting section

Each upward prep packet supplies a section like this:

```markdown
## YYYY-MM-DD — meeting with <Interlocutor Full Name>

*Direction: upward:N (manager / skip-level / exec)*

### Wins (headlines only — they already saw the weekly)
- <1-3 short bullets>

### Decisions Needed
- <decision 1>: <my preferred direction>. Need: <input | air cover | sign-off>.
- ...

### Asks
- <ask 1>: from <my manager / their boss / cross-team>. Why now: <reason>.
- ...

### Team
- <person>: <thing to flag>. <Asking for input | flagging awareness | letting them know>.
- ...

### Personal / Growth
- <topic>. <Open question | feedback request | "I'm wrestling with X">.
- ...

### FYI (proactive flags)
- <thing they should hear from me first>.
- ...

---
```

Rules per section:

### Wins

- Up to 3 headline bullets, short enough to say in one breath.
- Pulled from the context pass (`big-shipping`); the user can edit.
- Headlines only. The boss read the weekly.

### Decisions Needed

Each entry:

- Names the decision concretely (not "the X situation").
- States the user's preferred direction. If the user has none, the
  bullet carries `TODO: your call if it were yours alone?` and the
  question goes in the closing batch.
- Tags what they need: `input` (genuine 50/50), `air cover` (have a
  direction, want them to back it), or `sign-off` (need their authority).

### Asks

Each entry:

- Names the ask concretely.
- Says *who* — the manager directly, the manager's boss (escalation),
  or cross-team friction.
- States *why now* — the timing context. "Why now" is what
  distinguishes a real ask from a vague aspiration.

### Team

Each entry:

- Names the person (with discretion — this is a private prep doc).
- States the thing to flag in plain, factual language. Reframe
  judgments as questions ("Asking your read on…").
- Tags the action: `input` (want their read), `flagging awareness`
  (no ask, just a heads-up), `letting them know` (one of the few
  people who should hear this).

### Personal / Growth

- Open question, feedback request, or wrestling-with item.
- Examples: "How would you handle X?", "I'd like your read on my
  delegation lately," "I'm second-guessing my direction on Y."
- Often empty. That's fine.

### FYI

- Something the manager should hear from the user first: incoming
  criticism, external pressure, a managed risk, news.
- Not "things that happened" — those go in the weekly.
- The bar: would they prefer to hear this from me first?

## Why this shape

- **Section order.** Wins (refresher), Decisions (where the meeting
  might change course), Asks (where you want action), Team
  (sensitive, mid-doc), Personal (low-stakes ask of them), FYI
  (drop-the-mic items).
- **Empty sections are valid output.** Don't fabricate to fill them.
- **Action-oriented.** Each bullet should imply what the user wants
  to *happen* in the meeting.
