# Decision Log

Append-only. Every meaningful decision gets an entry: the date, the decision, why, and the context. Use the `/log-decision` skill to add one.

## 2026-01-05: Use one workspace for everything

**Decision:** Keep all context, priorities, decisions and skills in this one workspace, with a folder per project under `projects/`.
**Why:** Claude starts every session here, so one place means it always has the full picture.
**Context:** Notes were spread across docs, chats and three tools. Replaces the old "notes" folder, now in `archives/`.

## 2026-01-12: Read-only by default

**Decision:** Claude drafts but never sends, posts, publishes or deletes anything without an explicit yes in chat.
**Why:** Anything that reaches other people or can't be undone should get a human look first.
**Context:** Applies to email, chat, task tools and file deletes. Written into `CLAUDE.md` > Rules.
