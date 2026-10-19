# The Four Cs

An AI operating system has four layers. If one is missing, the others can't make up for it.

| | Question | Lives in | AIOS view |
| --- | --- | --- | --- |
| **1. Context** | What does it know about you? | `CLAUDE.md`, `context/`, the decision log, Claude's memory | Brain, Activity |
| **2. Connections** | What data can it reach? | MCP servers, APIs, CLIs, the browser, local folders | Connections |
| **3. Capabilities** | What can it produce? | Skills, subagents | Agents, Skills |
| **4. Cadence** | When does it act on its own? | Scheduled routines | Routines |

## 1. Context

Context is everything Claude reads before you type. Without it, every session starts from zero and you explain yourself again.

- **`CLAUDE.md`**: the master prompt. Short: who you are, the top priority, the rules, where things live.
- **`context/`**: one file each for you, the business, the team, current priorities and goals. `CLAUDE.md` imports them with `@context/...`.
- **`decisions/log.md`**: every meaningful decision with the date and the reason, append-only. It stops future sessions reopening settled questions.
- **Memory**: facts Claude Code saves across sessions on its own.

## 2. Connections

Connections are the tools Claude can read and act in. Group them by what the business needs to know, not by vendor. The example config uses seven buckets:

1. **Revenue:** how is money coming in?
2. **Customers:** what are they asking for?
3. **Calendar:** what is on this week?
4. **Comms:** who is waiting on me?
5. **Tasks:** what is overdue?
6. **Meetings:** what did we decide?
7. **Knowledge:** where is that file?

A bucket counts as covered when at least one tool in it is connected. Each bucket has an `ask`: the question it can answer once it is connected. If you can't name the question, you probably don't need the connection yet.

## 3. Capabilities

Capabilities are what the OS can produce on request.

- **Skills**: a folder with a `SKILL.md` that teaches Claude one repeatable workflow. Build one the second time you explain the same process.
- **Subagents**: Claude hands a focused job to a fresh agent (a scout, a reviewer, a writer) and gets a report back. The Agents view groups every subagent you've spawned by role, read from your Claude Code logs.

## 4. Cadence

Cadence is the OS working without you: a skill on a schedule. Start with one routine you already run by hand every day, such as the morning briefing, and schedule it. See [setup.md](setup.md#4-wire-in-your-tools-and-put-skills-on-a-schedule).

## The score

The Four Cs view scores each layer out of 25, for a total out of 100. It's computed live in `public/ext/fourcs.js`:

| Layer | Points |
| --- | --- |
| Context | 5 for a `CLAUDE.md`, up to 5 for other context files, up to 5 for memories (one per 10), up to 5 for decisions (one per 15), 5 if your priorities file changed this week (3 if older) |
| Connections | the share of buckets with a connected tool. A tool your agents actually used this week counts in full, a connected but unused one counts 85% |
| Capabilities | up to 14 for skills (one per 4), up to 6 for subagents (one per 40), 5 if you used Claude Code this week |
| Cadence | 4 per routine plus 2 per routine that ran on time, up to 25 |

The weights are a starting point. Change them to match what "good" means for you. The "Next to wire up" line suggests the first gap it finds.
