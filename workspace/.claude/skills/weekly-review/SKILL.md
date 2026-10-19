---
name: weekly-review
description: End-of-week summary of what shipped, what slipped and what is next, with recommendations for next week. Use when asked for a weekly review, week in review, or end-of-week summary.
---

# Weekly review

Close out the week in one page.

## Steps

1. Read `context/current-priorities.md` to know what was supposed to move.
2. Read `decisions/log.md` for decisions made in the last seven days.
3. Check each `projects/*/` folder for files changed in the last seven days and read each project's `README.md` status.
4. If a task tool is connected, list tasks completed this week and tasks that slipped. Read-only.
5. Write the review.

## Output

```
**Week of [date]**

**Shipped**
- [what got done, by project]

**Slipped**
- [what didn't, and the one-line reason]

**Decided**
- [decisions logged this week]

**Next week**
1. [top priority, tied to current-priorities.md]
2. [second]
3. [third]

**Recommendation**
[One or two sentences: what to stop, start or change.]
```

## Rules

- Read-only.
- If priorities look stale (the "Last updated" date is more than two weeks old), say so at the top.

## When it runs on a schedule

Write the review to `logs/weekly-review.md` and append one line with the time to `logs/weekly-review.log`.
