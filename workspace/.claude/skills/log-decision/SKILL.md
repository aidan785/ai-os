---
name: log-decision
description: Append a decision to decisions/log.md with the date, the decision, why it was made and the context. Use when a decision is made in a session, or when asked to log, record or remember a decision.
---

# Log a decision

`decisions/log.md` is append-only. It is how future sessions know what was already decided and why.

## Steps

1. Confirm the decision in one sentence with me if it isn't already explicit.
2. Append an entry at the bottom of `decisions/log.md` in this format:

```
## YYYY-MM-DD: [Short title]

**Decision:** [What was decided, in one or two sentences.]
**Why:** [The reasoning.]
**Context:** [What prompted it, and anything it replaces.]
```

3. If the decision changes a priority or a project's status, offer to update `context/current-priorities.md` or that project's `README.md`.

## Rules

- Never edit or delete earlier entries. If a decision is reversed, log a new entry that says so.
- Use today's date.
