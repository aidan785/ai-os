# How it is structured

There are two halves: the **workspace** Claude works in, and **AIOS**, the window that shows it. You can use either without the other.

```
ai-os/
├── workspace/                 the assistant workspace (copy it out and make it yours)
│   ├── CLAUDE.md              master prompt, loaded every session
│   ├── context/               me, work, team, current priorities, goals
│   ├── decisions/log.md       append-only decision log
│   ├── projects/<name>/       one folder per workstream, each with a README.md
│   ├── references/            SOPs, examples, style guides
│   ├── templates/             reusable formats
│   ├── archives/              finished or replaced material (never deleted)
│   ├── logs/                  what scheduled routines write
│   └── .claude/
│       ├── rules/             standing rules (voice, formatting)
│       └── skills/<name>/     one SKILL.md per repeatable workflow
│
├── server.mjs                 scans folders and logs, serves the UI (Node, zero dependencies)
├── agents.mjs                 reads ~/.claude/projects: sessions, subagents, tool calls; runs read-only agents
├── plugins/                   fourcs.mjs, routines.mjs, wiki.mjs (each adds data to the UI)
├── public/                    the interface: app.js, brain.js, agents.js, ext/ views, app.css
├── aios.config.example.json   the example config (your copy is aios.config.json)
├── DESIGN.md, PRODUCT.md      the design system and product brief Claude designs from
├── design/                    how the design was made, prompts, blank templates
├── docs/                      setup, configuration, the Four Cs, this file
├── data/                      what AIOS writes: your in-app edits (gitignored)
└── wiki/                      the Obsidian mirror (gitignored)
```

## The workspace

The workspace is a folder Claude Code always starts in. Everything that should be true in every session goes in `CLAUDE.md`; everything Claude needs only sometimes goes in a file it can find.

Some conventions that make it work:

- **One folder per project** under `projects/`, each with a `README.md` that states status and key dates. AIOS uses the first paragraph as the project's About text.
- **Priorities in one file.** `context/current-priorities.md` holds three or four items and a "Last updated" date. When focus shifts, this file changes first.
- **Decisions are append-only.** Never edit an old entry; log a new one that reverses it.
- **Archive, don't delete.** Moving finished work to `archives/` keeps history searchable.
- **Rules are files.** Voice, formatting and safety rules live in `.claude/rules/` so they apply everywhere.
- **Skills grow organically.** Write a skill the second time you explain the same workflow, not before.

If you already have a workspace like this, skip `workspace/` and point the `WS` root in your config at yours.

## How AIOS reads it

AIOS never writes to your folders. Every 10 seconds it:

1. walks each space's `sources` (skipping `node_modules`, `.git`, dot folders other than `.claude`, and anything in `deny`), and records each file's name, size, kind and modified time;
2. reads every `SKILL.md` in `skillDirs`;
3. reads the tail of each Claude Code session log from the past week in `~/.claude/projects/` (tool names and short step descriptions, never file contents);
4. builds the Brain: your written `links`, plus links it can prove from shared folders and shared skills.

Plugins add the rest on their own timers: the Four Cs (every minute), routines (every 30 seconds) and the Obsidian wiki (every five minutes).

The file preview only opens files inside your configured sources and skill folders, and never anything matching `deny`. The server only listens on `127.0.0.1` and refuses requests from other websites.

## Writing a plugin

A plugin is a file in `plugins/` that exports a name, an interval and a `scan` function. Its result lands in `state.ext[name]` in the browser.

```js
// plugins/hello.mjs
export const name = 'hello';
export const every = 60_000; // ms
export async function scan(ctx) {
  // ctx.config, ctx.state(), ctx.expand(path), ctx.isDenied(path), ctx.HOME, ctx.DATA
  return { greeting: 'hi', spaces: ctx.state().spaces.length };
}
```

Show it with a view in `public/ext/hello.js` and add a `<script>` tag to `index.html`:

```js
EXT.views.hello = {
  label: 'Hello',            // adds it to the rail
  render() {
    crumbs(['Hello']);
    return `<div class="page"><h1>Hello</h1><p class="lede">${S.ext.hello.spaces} spaces.</p></div>`;
  },
};
```

Keep plugins read-only. If one must write, write inside `data/` only.
