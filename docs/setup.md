# Setup: five steps to see your AI OS

Each step works on its own. Do step 1 today and you already have a live view of your projects; add the rest as you go.

Before you start: [Node.js](https://nodejs.org) 20 or newer and [Claude Code](https://claude.com/claude-code). No other installs.

## 1. Point it at your project folders, read-only

```bash
git clone https://github.com/aidan785/ai-os.git
cd ai-os
node server.mjs
```

Open http://localhost:4747. The first run copies `aios.config.example.json` to `aios.config.json` (your copy, which git ignores) and shows the example workspace in `workspace/`.

Now make it yours. The fastest way is to let Claude do it:

```
claude
> Read docs/configuration.md, then look at my folders in ~/Projects (and [any other places you keep work]).
  Rewrite aios.config.json so each real project is a space, grouped the way I work.
  Ask me before adding anything that looks personal or financial to the spaces.
```

Or edit `aios.config.json` by hand. Each project becomes a **space**:

```json
{
  "id": "client-work",
  "group": "projects",
  "name": "Client Work",
  "tagline": "Retainers and one-off builds.",
  "color": "#2f6fed",
  "status": "Active",
  "sources": ["~/Projects/clients", "~/Documents/Contracts/*-2026"],
  "skills": ["proposal-writer"]
}
```

AIOS rescans every 10 seconds. Save a file anywhere in a space and it shows up in the feed.

**Safety:** AIOS never writes to your folders. The `deny` list in the config hides anything matching it (`.env`, tokens, keys, invoices) from every screen and from the file preview. Add your own patterns there before you share your screen.

## 2. Read your Claude Code logs to find every agent

Nothing to set up. Claude Code keeps a log of every session in `~/.claude/projects/`, and the **Agents** view reads them: every session, every subagent it spawned, what role each played, and which tools they called. Open a few Claude Code sessions in your project folders and watch the Live feed fill in.

Sessions are matched to spaces by folder, so a session started inside `~/Projects/clients` shows up on the Client Work space.

## 3. Group everything by the Four Cs

The **Four Cs** view scores your OS out of 100 across Context, Connections, Capabilities and Cadence (see [four-cs.md](four-cs.md)). To fill each one in:

- **Context:** set up the assistant workspace. Copy `workspace/` somewhere permanent (for example `~/Projects/assistant`), fill in the bracketed parts of `CLAUDE.md` and `context/`, and point the `WS` root in the config at it. List the files in `context.files`.
- **Connections:** list the tools you use in the `connections` section, grouped by what they answer. Set `"wired": true` once Claude can reach one. Add a `connector` name and AIOS lights it green when your agents actually used it this week.
- **Capabilities:** add skill folders to `skillDirs`. Every folder with a `SKILL.md` shows up under Skills.
- **Cadence:** see step 4.

## 4. Wire in your tools and put skills on a schedule

**Tools.** Connect the tools Claude uses through MCP: inside Claude Code run `/mcp`, or add connectors on claude.ai, and they become available to every session. Then update `connections` in the config.

**Routines.** A routine is a skill that runs on a schedule. The simplest version is a cron job that runs Claude Code headless and writes a log:

```bash
crontab -e
```

```
30 7 * * 1-5 cd "$HOME/Projects/assistant" && /full/path/to/claude -p "Run the morning-briefing skill" --allowedTools "Read,Grep,Glob,Write" >> logs/morning-briefing.log 2>&1
```

Cron doesn't load your shell's `PATH`, so use the full path that `which claude` prints. Run the command once by hand first to check it works.

Then list it in the config so AIOS can show it:

```json
"routines": [
  { "id": "morning-briefing", "name": "Morning briefing", "cron": "30 7 * * 1-5",
    "space": "assistant", "skill": "/morning-briefing",
    "what": "Reads priorities and open tasks, writes a briefing",
    "log": "WS/logs/morning-briefing.log" }
]
```

AIOS never runs routines. It reads the `cron` expression to show today's timeline and the countdown to the next run, and the time the `log` file last changed to show when it last ran. If the log is older than the last scheduled run, the routine shows as missed.

Cron only fires while your computer is awake. Anything that runs a command on a schedule works the same way (launchd, a small server, a CI schedule): point `log` at a file it updates each run.

**Optional: live agent runs.** Set `agentRuns.enabled` to `true` to get an **Ask AIOS** button: a read-only Claude agent answers questions about your projects, with every step shown live. Turn on the `clickup` section as well (with the tool prefix of your ClickUp MCP server, shown in `/mcp`) to get the **ClickUp crew**: an orchestrator that sends two scouts to read your open tasks and your priorities, then writes a briefing. Both use `claude -p` with Bash, Write and Edit blocked. Each run uses your Claude plan or API credits.

## 5. Mirror it into Obsidian, then apply one design system

**Obsidian.** Every five minutes AIOS writes the whole OS to `wiki/` as linked Markdown notes: spaces, skills, connections, routines, agent roles and the Four Cs. Open `wiki/` as a vault in [Obsidian](https://obsidian.md) and switch to Graph view. Change the folder with `wiki.path`, or turn it off with `"wiki": { "enabled": false }`.

**Design.** The look comes from two files at the root of this repo: `DESIGN.md` (the rules) and `PRODUCT.md` (who it is for). Keep them, or rewrite them for your brand with the prompts in [`design/PROMPTS.md`](../design/PROMPTS.md). The full method is in [`design/README.md`](../design/README.md).

## Sharing your screen

Before you show AIOS to anyone:

1. Add anything private to the `deny` list and reload.
2. Use **Edit** to hide spaces you don't want on screen (they stay in the config).
3. Remember the Agents view shows your session titles and subagent tasks. Check it before you present.
