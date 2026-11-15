---
description: A review weighs whether the approach fits the problem and holds up at production volume, not only whether each changed line is right.
tags: [knowledge, review]
plugins: ["../.."]
allowed_tools: [Skill, Read, Glob, Grep, TodoWrite]
max_turns: 30
timeout_seconds: 600
append_system_prompt: "Handle this request exactly as you normally would, following whatever process and references apply to it. Two differences in this environment: no shell is available, so commands cannot execute; and the working directory is bare scaffolding, so ignore its contents and anything outside it rather than treating them as the user's real project. The real project exists but is not visible here, so an empty directory never means there is nothing to do: use whatever skill or process applies and carry it through. When you reach a step that needs a command, write out the exact command and keep going. Never stop to ask for tools or permissions, and always finish with your complete approach."
---

Run your pre-PR review on my change before I open the PR. It adds a per-workspace AI spend report over the last 30
days. Each run stores what it spent inside a JSON column, `runs.state`, which the run writes
once when it finishes. The report reads every run in the range, parses `state` in Python and
adds up the cost:

```python
MAX_ROWS = 65_536          # refuse a range with more runs than this
MAX_STATE_BYTES = 64 << 20 # refuse a range whose JSON is bigger than this
_FOLD_LIMITER = anyio.CapacityLimiter(4)

async def workspace_cost(session, workspace_id, start, end):
    in_range = (
        Run.workspace_id == workspace_id,
        Run.started_at >= start,
        Run.started_at < end,
    )
    count, size = (
        await session.execute(
            select(func.count(), func.coalesce(func.sum(func.pg_column_size(Run.state)), 0))
            .where(*in_range)
        )
    ).one()
    if count > MAX_ROWS:
        raise TooManyRuns()
    if size > MAX_STATE_BYTES:
        raise StateTooLarge()
    total = Decimal(0)
    rows = await session.stream_scalars(select(Run.state).where(*in_range))
    async for chunk in rows.partitions(200):
        total += await anyio.to_thread.run_sync(sum_costs, chunk, limiter=_FOLD_LIMITER)
    return total
```

The frontend catches `TooManyRuns` and retries with 7 days, then 1 day. A few of our busiest
workspaces already get refused even at 1 day. The PR description explains that summing in
SQL would duplicate the Python parsing rules, which is why I went this way. What will
reviewers say?
