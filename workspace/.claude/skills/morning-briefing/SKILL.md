---
name: morning-briefing
description: Daily status update. Reads current priorities, open tasks and recent project changes, then writes a short briefing of what needs attention today. Use when asked for a morning briefing, "what's on today", or a daily status check.
---

# Morning briefing

Give me a five-minute read on today.

## Steps

1. Read `context/current-priorities.md` and `context/goals.md`.
2. If a task tool is connected (see `CLAUDE.md` > Tools), list open tasks that are due today, overdue, or due in the next three days. Read-only.
3. If a calendar is connected, list today's events.
4. Check each `projects/*/README.md` for a status line or key date in the next seven days.
5. Write the briefing.

## Output

```
**Today, [weekday date]**

**Needs attention**
- [overdue or due today, with the project it belongs to]

**On the calendar**
- [time] [event]

**Coming up this week**
- [date] [deadline]

**Suggested focus**
[One sentence: the single most important thing to move today, tied to a current priority.]
```

## Rules

- Read-only. Never change a task, event or file.
- If a tool isn't connected, skip that section and say so in one line.
- Keep it under 200 words.

## When it runs on a schedule

If this skill runs from a routine (see the AIOS setup guide), write the briefing to `logs/morning-briefing.md` and append one line with the time to `logs/morning-briefing.log`. AIOS reads the log's timestamp to show when it last ran.
