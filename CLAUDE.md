# AIOS: guide for Claude

This repo is AIOS, a local, read-only interface over the user's projects, skills, Claude Code agents and routines, plus a template workspace (`workspace/`) for the assistant itself. Node 20+, zero dependencies, no build step.

## Before you change anything

- **UI work:** read `DESIGN.md` and `PRODUCT.md` first, every time. They are the design authority. If a fix reveals a missing rule, add the rule to `DESIGN.md` in the section it belongs to.
- **Config work:** read `docs/configuration.md`. The user's config is `aios.config.json` (gitignored). Only change `aios.config.example.json` when the example itself should change.

## Rules

- AIOS is read-only. Never add code that writes, moves or deletes files in the user's sources. AIOS writes only inside `data/` and the wiki folder.
- Every number on screen must come from disk, logs or the config. If something is a sample, the UI says so.
- Respect the `deny` list everywhere a path or description reaches the UI.
- Live agent runs (`agents.mjs` `runAgent`) must keep Bash, Write and Edit blocked.
- The server binds to `127.0.0.1` and rejects requests from other origins. Keep it that way.
- No dependencies. Use Node's standard library on the server and plain JS in `public/`.

## Run and check

```bash
node server.mjs                 # http://localhost:4747
PORT=4800 node server.mjs       # second copy on another port
```

After a UI change, look at it: screenshot Home, Four Cs, Brain, Agents, Routines and one space at desktop width and at 400px, in light and dark mode. A page that loads without errors can still be wrong.

## Map

| File | What it does |
| --- | --- |
| `server.mjs` | Config, folder scan, skills, sessions, Brain links, HTTP API, plugin loader |
| `agents.mjs` | Reads `~/.claude/projects` logs (sessions, subagents, connectors, roster); `runAgent` for Ask AIOS and the ClickUp crew |
| `plugins/fourcs.mjs` | Context files, memories, decisions, connection buckets |
| `plugins/routines.mjs` | Cron parsing, next and last run per routine |
| `plugins/wiki.mjs` | Writes the Obsidian mirror |
| `public/app.js` | Shell, rail, Home, space pages, Activity, Skills, drawer, search, edit mode |
| `public/brain.js` | The Brain map |
| `public/agents.js` | Agent network, roster, live feed, agent runs |
| `public/ext/*.js` | Four Cs, Connections and Routines views (`EXT.views`) |
| `public/app.css` | Tokens and shared components |
