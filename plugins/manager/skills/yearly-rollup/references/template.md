# Yearly rollup template

The doc is a stand-alone artifact per year. Title:

```
<Team Name> — <YYYY or window> Rollup
```

If the window hasn't ended:

```
<Team Name> — <YYYY> Year-to-Date Rollup (through <YYYY-MM-DD>)
```

## Doc body

```markdown
# <Team Name> — <YYYY or window> Rollup

**Manager:** <Manager Full Name>
**Window:** <WINDOW_START> to <WINDOW_END> (<status: complete | year-to-date through DATA_END>)
**Team size:** <N current> (<M former members with contributions in the window>)

<One-paragraph mission framing — what the team is responsible for. If
the team has a written plan or charter for the year, summarize from it; else
write fresh from observation. 2-4 sentences.>

## Summary

<One short paragraph. What was the year about? The headline
arc. If there's a single overarching theme, name it here. If the year
had a clear "before and after," call it out.>

## Highlights

<5-9 bullets. Each is a headline-style claim with the impact in bold.
Order: biggest impact first. Quantify wherever possible. Don't list
"shipped X PRs" — that's noise. Each bullet should be a concrete
outcome that was true at year end and wasn't true at year start.>

- For X, we shipped Y. **Impact in bold.**
- ...

## Themes

<4-7 narrative sections, one per theme. Themes emerge from the data;
don't force a count.

Each theme:>

### <Theme name>

<One-paragraph framing of the theme: what was it about, why did it
matter, who drove it.>

<One-paragraph treatment of the work: what got built / changed / dealt
with. Cite specific projects, named PRs, named people. Quantify where
you can. Don't list every commit.>

<One-line outcome: where did the team land at year end on this theme.>

### <Theme 2>

(repeated per theme)

## Per-IC contributions

<One paragraph per current team member. The person's name as the
header; the paragraph describes what they accomplished and what they
learned / grew into. Don't grade — describe. The skill is not a
performance review.

Order alphabetically by first name to avoid implying ranking.>

### <Name>

<2-4 sentences. What they shipped. Themes they led or contributed
to. Notable growth / new responsibilities / new skills demonstrated.
Cite specific work.>

### <Name 2>

(repeated per person)

### Former members (contributions in the window)

<Brief 1-2 sentence bullets per former-member who contributed
during the window. Acknowledges their work without padding.>

- <Name>: <one-line summary>
- <Name>: ...

## By the numbers

| Metric | Count |
|--------|-------|
| Merged PRs | N |
| Issues closed | N |
| Incidents responded to | N |
| New team members | N |
| Departures | N |

<Numbers without context lie. Don't add metrics that don't have
narrative meaning. If "merged PRs" is wildly skewed by one
auto-bumping bot, exclude that bot.>

## Gaps

<What didn't happen this year that should have. Honest, not
self-flagellating. 2-5 bullets. This section is what makes the doc
trustworthy — readers know if the gaps are missing, the headlines
are likely inflated.>

- <Gap 1: brief. Why it didn't happen. What's planned for next year.>
- <Gap 2: ...>

If there are no real gaps, omit this section — but most teams have
some. Saying "we did everything" is a tell.

## Looking ahead (optional)

<If the team has a written plan for next year, link to it.
Otherwise omit. This section is not the place for next-year
planning — it's just a pointer.>
```

## Per-section notes

- **Highlights:** order by impact, biggest first. Don't editorialize.
- **Themes:** themes are the story behind highlights — don't repeat
  the highlight bullets. Cite specific people in prose ("<lead> led
  the search-indexer rewrite, with reviews from <reviewer1> and <reviewer2>").
- **Per-IC:** alphabetical, 2-4 sentences. Don't pad to make people
  equal — different contributions deserve different lengths. Describe,
  don't grade.
- **Numbers:** 4-6 rows max. Each row defensible; see synthesis-rules
  for what counts.
- **Gaps:** include "why it didn't happen" — deprioritized, blocked,
  deferred. Saying "no gaps" is suspicious.

## What the doc is not

- Not a performance review per person. Per-IC contributions
  describe; they don't grade.
- Not a sales pitch for the team. Honest framing > glossy.
- Not a project list. Themes are the spine; projects are evidence
  cited *within* themes.
- Not a roadmap for next year. The looking-ahead section is just a
  pointer.
- Not a debrief on incidents. Those have their own retro packets;
  if an incident shaped a theme (e.g. "hardened on-call after the
  March outage"), it's cited as evidence within that theme.
