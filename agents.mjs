// Agents layer: the agent network from Claude Code logs, plus live read-only agent runs.
// Reads ~/.claude/projects only. Agent runs are read-only (no write tools allowed).
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const HOME = os.homedir();
const LOGS = path.join(HOME, '.claude', 'projects');
const TAIL = 768 * 1024;
const WEEK = 7 * 864e5;

// ---------- connectors ----------
const CONNECTORS = [
  ['ClickUp', /clickup/i, '#7b68ee'],
  ['Google Drive', /google_drive|search_files|read_file_content|get_file_metadata|file_permissions|download_file_content|copy_file|create_file|update_file|list_recent_files/i, '#1fa463'],
  ['Gmail', /gmail|search_threads|get_thread|create_draft|send_message$/i, '#d93025'],
  ['Calendar', /calendar/i, '#4285f4'],
  ['Claude Docs', /claude_docs|^(guide|batch|update)$/i, '#c96442'],
  ['Browser', /playwright|chrome|browser/i, '#0a72b5'],
  ['Premiere', /premiere/i, '#9999ff'],
  ['Blender', /blender/i, '#ea7600'],
  ['Figma', /figma/i, '#a259ff'],
  ['Slack', /slack/i, '#4a154b'],
  ['Notion', /notion/i, '#37352f'],
  ['Linear', /linear/i, '#5e6ad2'],
  ['GitHub', /github/i, '#24292f'],
  ['ComfyUI', /comfy/i, '#5b7a99'],
  ['Web', /^(WebSearch|WebFetch)$/, '#0ea5e9'],
  ['Artifacts', /^Artifact/, '#c96442'],
];
function connectorOf(name) {
  const short = name.startsWith('mcp__') ? name.split('__').slice(1).join('__') : name;
  const leaf = name.split('__').pop();
  for (const [label, re, color] of CONNECTORS) if (re.test(short) || re.test(leaf)) return { label, color };
  return null;
}
const FILE_TOOLS = new Set(['Read', 'Write', 'Edit', 'NotebookEdit']);
function detailOf(name, input = {}, deny) {
  let d = '';
  if (name === 'Bash') d = input.description || '';
  else if (FILE_TOOLS.has(name)) d = path.basename(input.file_path || '');
  else if (name === 'Agent') d = input.description || '';
  else if (name === 'SendMessage') d = 'to ' + (input.to || 'agent');
  else if (name === 'Skill') d = '/' + (input.skill || '');
  else if (name === 'Grep' || name === 'Glob') d = '';
  else if (/clickup/i.test(name)) d = name.split('__').pop().replace(/^clickup_/, '').replace(/_/g, ' ');
  else if (name.startsWith('mcp__')) d = name.split('__').pop().replace(/_/g, ' ');
  d = String(d).replace(/\s+/g, ' ').slice(0, 90);
  return deny.some((r) => r.test(d)) ? '' : d;
}
const toolLabel = (name) => {
  if (!name.startsWith('mcp__')) return name;
  const c = connectorOf(name);
  return c ? c.label : name.split('__')[1].replace(/^claude_ai_|^plugin_/, '').replace(/_/g, ' ');
};

// ---------- log reading with a per-file cache ----------
const fileCache = new Map();
async function readEvents(file, deny) {
  let st;
  try { st = await fsp.stat(file); } catch { return null; }
  const hit = fileCache.get(file);
  if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) return hit.data;
  const fd = await fsp.open(file, 'r');
  const len = Math.min(st.size, TAIL);
  const buf = Buffer.alloc(len);
  await fd.read(buf, 0, len, st.size - len); await fd.close();
  const lines = buf.toString('utf8').split('\n');
  if (st.size > len) lines.shift();
  const events = [];
  let title = '', cwd = '';
  for (const line of lines) {
    if (!line) continue;
    if (line.includes('"ai-title"')) { try { title = JSON.parse(line).aiTitle || JSON.parse(line).title || title; } catch {} }
    if (!line.includes('"tool_use"')) continue;
    let j; try { j = JSON.parse(line); } catch { continue; }
    cwd = j.cwd || cwd;
    const t = Date.parse(j.timestamp || '') || st.mtimeMs;
    for (const c of j.message?.content || []) {
      if (c?.type !== 'tool_use') continue;
      events.push({ t, name: c.name, detail: detailOf(c.name, c.input, deny), sub: c.name === 'Agent' ? (c.input?.description || '') : null });
    }
  }
  const data = { events, title, cwd, mtime: st.mtimeMs };
  fileCache.set(file, { mtime: st.mtimeMs, size: st.size, data });
  return data;
}


// Subagent roles, matched in order on the task description the manager agent gave each subagent.
const ROLES = [
  ['Reviewers', /review|critic|critique|\bqa\b|check|verify|judge/i, '#a78bfa'],
  ['Auditors', /^audit|audit /i, '#f59e0b'],
  ['Testers', /^test|benchmark|\btry /i, '#f97316'],
  ['Scouts', /scout|research|find|search|explore|investigat|analy|scan|pull|survey|look|map |gather|collect/i, '#2dd4bf'],
  ['Designers', /design|style\b|logo|palette|packaging/i, '#ec4899'],
  ['Builders', /\bc\+\+|game|engine| agent$|blender|geometry|scene/i, '#0a72b5'],
  ['Editors', /edit|cut|render|caption|clip|trim|video|intro|outro|cold open|transcri|motion|sting|lower third|animat/i, '#37bdf8'],
  ['Designers', /design|style|logo|mark |mark$|concept|packaging|palette|thumbnail|brand|layout|poster|card/i, '#ec4899'],
  ['Writers', /write|draft|copy|script|summar|doc|readme|outline|brief/i, '#10b981'],
  ['Fixers', /fix|rename|update|patch|repair|migrat|clean|refactor|port /i, '#64748b'],
  ['Builders', /build|create|make|implement|scaffold|set up|setup|wire|add /i, '#0a72b5'],
];
export const roleOf = (desc) => ROLES.find(([, re]) => re.test(desc)) || ['Specialists', null, '#94a3b8'];

// Every subagent ever spawned (meta.json only, cheap), grouped by role and by the manager session that spawned it.
const rosterCache = new Map();
async function scanRoster(deny, prettyProject) {
  const roles = {}; const managers = []; let total = 0;
  let dirs = []; try { dirs = await fsp.readdir(LOGS); } catch { return null; }
  for (const d of dirs) {
    let entries = []; try { entries = await fsp.readdir(path.join(LOGS, d), { withFileTypes: true }); } catch { continue; }
    for (const e of entries.filter((x) => x.isDirectory())) {
      const subDir = path.join(LOGS, d, e.name, 'subagents');
      let metas = []; try { metas = (await fsp.readdir(subDir)).filter((x) => x.endsWith('.meta.json')); } catch { continue; }
      if (!metas.length) continue;
      const m = { id: e.name, project: prettyProject(d), title: null, last: 0, total: 0, roles: {} };
      for (const mf of metas) {
        const f = path.join(subDir, mf);
        let st; try { st = await fsp.stat(f); } catch { continue; }
        let meta = rosterCache.get(f);
        if (!meta || meta.mtime !== st.mtimeMs) { try { meta = { ...JSON.parse(await fsp.readFile(f, 'utf8')), mtime: st.mtimeMs }; } catch { meta = { mtime: st.mtimeMs }; } rosterCache.set(f, meta); }
        let desc = String(meta.description || 'Subagent').slice(0, 70);
        if (deny.some((r) => r.test(desc))) desc = 'Subagent';
        const [role, , color] = roleOf(desc);
        const r = (roles[role] ||= { role, color, count: 0, week: 0, last: 0, examples: [] });
        r.count++; if (Date.now() - st.mtimeMs < WEEK) r.week++;
        if (st.mtimeMs > r.last) r.last = st.mtimeMs;
        r.examples.push({ d: desc, t: st.mtimeMs });
        m.roles[role] = (m.roles[role] || 0) + 1; m.total++; m.last = Math.max(m.last, st.mtimeMs); total++;
      }
      const parent = path.join(LOGS, d, e.name + '.jsonl');
      if (fs.existsSync(parent)) { const pd = await readEvents(parent, deny); m.title = pd?.title || null; }
      managers.push(m);
    }
  }
  for (const r of Object.values(roles)) { r.examples.sort((a, b) => b.t - a.t); r.examples = [...new Set(r.examples.map((x) => x.d))].slice(0, 4); }
  managers.sort((a, b) => b.last - a.last);
  return { total, managers: managers.slice(0, 30), managerCount: managers.length, roles: Object.values(roles).sort((a, b) => b.count - a.count) };
}

export async function scanAgents({ spaceForDir, deny, prettyProject }) {
  const now = Date.now();
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  let dirs = [];
  try { dirs = await fsp.readdir(LOGS); } catch { return null; }
  const sessions = [];
  const stream = [];
  const connectors = {};
  const tools = {};
  let callsToday = 0, callsHour = 0, messages = 0, subagentsToday = 0, subagentsWeek = 0;

  for (const d of dirs) {
    let entries = [];
    try { entries = await fsp.readdir(path.join(LOGS, d)); } catch { continue; }
    for (const f of entries.filter((x) => x.endsWith('.jsonl'))) {
      const file = path.join(LOGS, d, f);
      let st; try { st = await fsp.stat(file); } catch { continue; }
      if (now - st.mtimeMs > WEEK) continue;
      const data = await readEvents(file, deny);
      if (!data) continue;
      const id = f.replace('.jsonl', '');
      const project = prettyProject(d);
      const s = { id, project, space: spaceForDir(d), title: data.title, last: data.mtime, calls: data.events.length, connectors: {}, subagents: [] };
      const tally = (ev, owner, ownerLabel, isSub) => {
        const c = connectorOf(ev.name);
        if (c) { owner.connectors[c.label] = (owner.connectors[c.label] || 0) + 1; connectors[c.label] = connectors[c.label] || { label: c.label, color: c.color, calls: 0 }; connectors[c.label].calls++; }
        if (ev.t >= day0.getTime()) { callsToday++; tools[toolLabel(ev.name)] = (tools[toolLabel(ev.name)] || 0) + 1; }
        if (now - ev.t < 3600e3) callsHour++;
        if (ev.name === 'SendMessage') messages++;
        if (now - ev.t < 6 * 3600e3) stream.push({ t: ev.t, tool: toolLabel(ev.name), connector: c?.label || null, color: c?.color || null, detail: ev.detail, project, agent: ownerLabel, sub: isSub });
      };
      for (const ev of data.events) tally(ev, s, data.title || project, false);
      // subagents this session spawned
      const subDir = path.join(LOGS, d, id, 'subagents');
      let subs = [];
      try { subs = (await fsp.readdir(subDir)).filter((x) => x.endsWith('.jsonl')); } catch {}
      for (const sf of subs) {
        const sfile = path.join(subDir, sf);
        let sst; try { sst = await fsp.stat(sfile); } catch { continue; }
        if (now - sst.mtimeMs > WEEK) continue;
        let meta = {};
        try { meta = JSON.parse(await fsp.readFile(sfile.replace('.jsonl', '.meta.json'), 'utf8')); } catch {}
        const sd = await readEvents(sfile, deny);
        const desc = String(meta.description || 'Subagent').slice(0, 70);
        const sub = { id: sf.replace('.jsonl', ''), description: deny.some((r) => r.test(desc)) ? 'Subagent' : desc, type: meta.agentType || 'general-purpose', last: sst.mtimeMs, calls: sd?.events.length || 0, connectors: {} };
        for (const ev of sd?.events || []) tally(ev, sub, desc, true);
        s.subagents.push(sub);
        subagentsWeek++;
        if (sst.mtimeMs >= day0.getTime()) subagentsToday++;
      }
      if (s.calls || s.subagents.length) sessions.push(s);
    }
  }
  sessions.sort((a, b) => b.last - a.last);
  stream.sort((a, b) => b.t - a.t);
  const roster = await scanRoster(deny, prettyProject);
  // role -> connectors, from this week's subagents
  if (roster) for (const s of sessions) for (const sub of s.subagents) {
    const r = roster.roles.find((x) => x.role === roleOf(sub.description)[0]); if (!r) continue;
    r.connectors ||= {}; for (const [c, n] of Object.entries(sub.connectors)) r.connectors[c] = (r.connectors[c] || 0) + n;
    r.calls = (r.calls || 0) + sub.calls; r.connCalls = (r.connCalls || 0) + Object.values(sub.connectors).reduce((a, b) => a + b, 0);
  }
  return {
    roster,
    sessions: sessions.slice(0, 40),
    connectors: Object.values(connectors).sort((a, b) => b.calls - a.calls),
    tools: Object.entries(tools).sort((a, b) => b[1] - a[1]).slice(0, 10),
    stream: stream.slice(0, 120),
    stats: { callsToday, callsHour, messages, subagentsToday, subagentsWeek, sessionsWeek: sessions.length },
  };
}

// ---------- live agent runs (read-only) ----------
// Both runs use `claude -p` with write tools blocked. ClickUp tools are only allowed when the clickup section of the config is on.
const CLICKUP_READ_TOOLS = ['clickup_filter_tasks', 'clickup_get_task', 'clickup_search', 'clickup_get_list', 'clickup_get_task_comments', 'clickup_get_workspace_hierarchy'];
const SAFETY = 'You are running inside AIOS, a read-only dashboard. Never create, edit, move or delete anything in any tool. Never open .env, token, credential, invoice or personal files. Write plain text with no markdown headings, no emojis and no em dashes.';

export function runAgent({ mode, question, context, config, cwd, onEvent }) {
  const cu = config.clickup?.enabled ? config.clickup : null;
  const clickupTools = cu ? CLICKUP_READ_TOOLS.map((t) => (cu.toolPrefix || 'mcp__clickup__') + t) : [];
  const owner = config.owner || 'the user';
  let prompt;
  if (mode === 'crew') {
    prompt = `You are the AIOS briefing crew orchestrator. Work as a team:
1. In ONE message, spawn two subagents in parallel with the Agent tool:
   - description "ClickUp scout": use ClickUp read-only tools to list open tasks${cu.listId ? ` in list ${cu.listId}` : ''}${cu.workspaceId ? ` (workspace ${cu.workspaceId})` : ''}${cu.userId ? ` assigned to user ${cu.userId}` : ` assigned to ${owner}`}, with status, due date and url.
   - description "Workspace scout": read ${config.agentRuns?.prioritiesFile || 'context/current-priorities.md'} in the current folder and report the 3 most pressing items with dates.
2. Combine their reports into a briefing of at most 90 words for ${owner}, then a fenced json block with an array of {"name","status","due","url","space"} for every open ClickUp task, where due is YYYY-MM-DD or null and space is the best matching id from this list: ${context.spaceIds}.
AIOS state for reference: ${context.summary}`;
  } else {
    prompt = `Answer this question about ${owner}'s work in at most 120 words: ${question}
Use the AIOS state below first; read files${cu ? ' or query ClickUp (read-only)' : ''} only if needed.
AIOS state: ${context.summary}`;
  }
  const tools = ['Agent', 'ToolSearch', 'Read', 'Grep', 'Glob', ...clickupTools];
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--allowedTools', ...tools, '--disallowedTools', 'Bash', 'Write', 'Edit', 'NotebookEdit', '--append-system-prompt', SAFETY];
  if (config.agentRuns?.model) args.push('--model', config.agentRuns.model);
  const child = spawn(config.agentRuns?.claudePath || 'claude', args, { cwd, env: process.env, shell: process.platform === 'win32' });
  const names = {}; // tool_use id of an Agent call -> subagent name
  let buf = '';
  const t0 = Date.now();
  let done = false;
  onEvent({ type: 'start', mode });
  child.on('error', (e) => { if (!done) { done = true; onEvent({ type: 'done', ok: false, result: e.code === 'ENOENT' ? 'Could not find the claude command. Install Claude Code, or set agentRuns.claudePath in aios.config.json.' : e.message, ms: Date.now() - t0, cost: 0 }); } });
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      let j; try { j = JSON.parse(line); } catch { continue; }
      const who = j.parent_tool_use_id ? (names[j.parent_tool_use_id] || 'Subagent') : 'Orchestrator';
      if (j.type === 'stream_event' && !j.parent_tool_use_id) {
        const d = j.event?.delta;
        if (d?.type === 'text_delta') onEvent({ type: 'text', delta: d.text });
      } else if (j.type === 'assistant') {
        for (const c of j.message?.content || []) {
          if (c.type !== 'tool_use') continue;
          if (c.name === 'Agent') { names[c.id] = c.input?.description || 'Subagent'; onEvent({ type: 'spawn', agent: who, child: names[c.id] }); }
          else if (c.name !== 'ToolSearch') onEvent({ type: 'step', agent: who, tool: toolLabel(c.name), detail: detailOf(c.name, c.input, []) || (c.input?.pattern || c.input?.query || '') });
        }
      } else if (j.type === 'user' && j.parent_tool_use_id == null) {
        for (const c of j.message?.content || []) if (c.type === 'tool_result' && names[c.tool_use_id]) onEvent({ type: 'report', agent: names[c.tool_use_id] });
      } else if (j.type === 'result') {
        done = true;
        onEvent({ type: 'done', ok: j.subtype === 'success', result: j.result || '', ms: Date.now() - t0, cost: j.total_cost_usd || 0 });
      }
    }
  });
  child.stderr.on('data', () => {});
  child.on('close', (code) => {
    if (!done) { done = true; onEvent({ type: 'done', ok: false, result: 'The agent stopped before it finished. Run `claude` once in a terminal to check you are signed in.', ms: Date.now() - t0, cost: 0 }); }
    onEvent({ type: 'closed', code });
  });
  return child;
}
