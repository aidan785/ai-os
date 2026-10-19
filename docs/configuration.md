# Configuration

Everything AIOS shows comes from `aios.config.json`. It is created from `aios.config.example.json` on first run and git ignores it, so your folders and tools never end up in a commit. Restart the server after editing it (`Ctrl+C`, then `node server.mjs`).

Edits made in the app (renaming, recoloring, hiding or reordering spaces, notes, new spaces, Brain layout, appearance) are saved separately in `data/overrides.json`. Delete that file to reset them.

## Paths

Any path in the config can be:

- `~/Projects/clients`: relative to your home folder
- `./workspace`: relative to this repo
- `WS/projects`: starting with a shortcut from `roots`
- `/Volumes/Drive/Archive`: absolute. External drives rescan every two minutes instead of every ten seconds.

A `*` in the last part matches several folders: `~/Projects/client-*`. A source starting with `!` is excluded: `"!WS/projects"`.

## Top level

| Key | What it does |
| --- | --- |
| `owner` | Your first name, for the greeting on Home. Optional. |
| `title` | The name in the top bar and the browser tab. |
| `hub` | The id of the space at the center of the Brain, usually your assistant workspace. Every space with folders inside the hub links to it. |
| `roots` | Path shortcuts, e.g. `"WS": "~/Projects/assistant"`. |
| `deny` | Regular expressions. Any file or folder whose path matches is hidden everywhere, including previews and agent step descriptions. |
| `skillDirs` | Folders of skills: `[{ "label": "Global", "path": "~/.claude/skills" }]`. Each subfolder with a `SKILL.md` is a skill. |
| `groups` | How spaces are grouped in the rail and on Home: `[{ "id", "name", "note" }]`. |

## spaces

One entry per project.

| Key | What it does |
| --- | --- |
| `id` | Short, unique, lowercase. Used in links and routines. |
| `group` | A group id. |
| `name`, `tagline` | Shown in the rail, on Home and on the space page. |
| `color` | The space's swatch. Used only to identify the space, never as a UI accent. |
| `status` | Free text. Statuses containing live, latest, today, building or production show in blue. |
| `sources` | Folders or files to scan, read-only. |
| `skills` | Skill folder names this space uses. Two spaces sharing a skill get a dashed link in the Brain. |
| `readme` | Optional file for the About text. By default AIOS reads the first `README.md`, `CLAUDE.md` or `ONBOARDING.md` it finds in the sources. |

## links

Connections you write down, drawn as solid lines in the Brain: `{ "from": "newsletter", "to": "content", "label": "Each issue seeds next week's videos" }`. AIOS adds dashed lines on its own when two spaces share a folder or a skill. You can also add and remove links in Edit mode on the Brain.

## context

What the Four Cs view lists under Context.

| Key | What it does |
| --- | --- |
| `files` | `[{ "path", "label", "what" }]`: the files loaded into every session (CLAUDE.md, about me, priorities, voice rules). |
| `decisions` | Path to your decision log. Every `##` heading counts as one decision. |
| `memory` | Optional. Folder of Claude Code memories. By default AIOS looks in the hub folder's project folder under `~/.claude/projects/`. |

## connections

Buckets of tools, grouped by what the business needs to know.

```json
{ "id": "tasks", "name": "Tasks", "ask": "What is overdue?", "tools": [
  { "name": "ClickUp", "how": "MCP", "note": "source of truth for deadlines", "wired": true, "connector": "ClickUp" }
] }
```

- `how`: MCP, API, CLI, Browser or Local. Just a label.
- `wired`: `true` once Claude can reach the tool.
- `connector`: optional. If it matches a connector name in the Agents view (ClickUp, Google Drive, Gmail, Calendar, Slack, Notion, Linear, GitHub, Browser, Web, Figma, Blender, Premiere, ComfyUI, Claude Docs, Artifacts), the tool turns green when your agents called it this week. Add your own matchers to `CONNECTORS` in `agents.mjs`.

## routines

Scheduled jobs. See [setup.md](setup.md#4-wire-in-your-tools-and-put-skills-on-a-schedule).

| Key | What it does |
| --- | --- |
| `id`, `name`, `what` | Identity and a one-line description. |
| `cron` | Standard five-field cron: minute, hour, day of month, month, day of week. |
| `space` | The space it belongs to. It shows on that space's page too. |
| `skill` | Free text, usually the skill it runs. |
| `log` | A file the job updates every run. Its modification time is the last run. Without it, the routine shows as scheduled. |

## wiki

`{ "enabled": true, "path": "./wiki" }`. The Obsidian mirror, rebuilt every five minutes. It only writes inside that folder.

## agentRuns

Off by default. With `"enabled": true`, AIOS shows **Ask AIOS**, which runs `claude -p` in the hub folder with only Read, Grep, Glob, Agent and (if enabled) ClickUp read tools allowed.

| Key | What it does |
| --- | --- |
| `prioritiesFile` | The file the ClickUp crew's workspace scout reads, relative to the hub folder. |
| `model` | Optional model for runs, passed to `claude --model`. |
| `claudePath` | Optional full path to the `claude` command if it isn't on your `PATH`. |

## clickup

Off by default. Needs `agentRuns` on and a ClickUp MCP server connected to Claude Code.

| Key | What it does |
| --- | --- |
| `toolPrefix` | The prefix of your ClickUp tools, e.g. `mcp__clickup__`. Run `/mcp` in Claude Code to see the server name; tools are named `mcp__<server>__<tool>`. |
| `workspaceId`, `listId`, `userId` | Optional. Narrow the crew to one list and one assignee. |

The crew saves the open tasks it finds to `data/clickup.json`, and the Agents view lists them.

## Environment variables

- `PORT`: default `4747`.
- `HOST`: default `127.0.0.1`. AIOS only answers requests from its own page on this machine.
