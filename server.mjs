// AIOS: a read-only operating system view over your projects, skills and Claude Code agents.
// Zero dependencies. Only writes inside ./data and ./wiki. Run: node server.mjs
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scanAgents, runAgent } from './agents.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4747);
const HOST = process.env.HOST || '127.0.0.1';
const HOME = os.homedir();
const DATA = path.join(HERE, 'data');
const OVERRIDES = path.join(DATA, 'overrides.json');
const PUBLIC = path.join(HERE, 'public');

// Your config is aios.config.json (gitignored). On first run it starts as a copy of the example.
const CONFIG_FILE = path.join(HERE, 'aios.config.json');
if (!fs.existsSync(CONFIG_FILE)) {
  fs.copyFileSync(path.join(HERE, 'aios.config.example.json'), CONFIG_FILE);
  console.log('Created aios.config.json from aios.config.example.json. Edit it to point AIOS at your own folders.');
}
const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
config.roots ||= {}; config.spaces ||= []; config.skillDirs ||= []; config.deny ||= [];

const SKIP_DIRS = new Set(['node_modules', '.git', 'venv', '.venv', '__pycache__', '.next', 'dist', '.cache', 'raw-media', '.turbo', '.vercel']);
const DENY = config.deny.map((d) => new RegExp(d, 'i'));
const MAX_DEPTH = 5;
const MAX_FILES_PER_SOURCE = 20000;

// Paths in the config can start with ~, ./ (this folder) or a root shortcut from "roots" (e.g. WS/projects).
const expand = (p) => {
  if (p.startsWith('~')) return path.join(HOME, p.slice(1));
  if (p === '.' || p.startsWith('./') || p.startsWith('../')) return path.resolve(HERE, p);
  const [head, ...rest] = p.split('/');
  if (config.roots[head]) return path.join(expand(config.roots[head]), ...rest);
  return p;
};
const isDenied = (p) => DENY.some((r) => r.test(p));
const tildify = (p) => (p.startsWith(HOME) ? '~' + p.slice(HOME.length) : p);
const HUB = config.hub || null; // the space at the center of the Brain (usually your assistant workspace)

// ---------- scanning ----------
async function resolveSource(src) {
  const abs = expand(src);
  const base = path.basename(abs);
  if (!base.includes('*')) return fs.existsSync(abs) ? [abs] : [];
  const dir = path.dirname(abs);
  const re = new RegExp('^' + base.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  try {
    return (await fsp.readdir(dir)).filter((n) => re.test(n)).map((n) => path.join(dir, n));
  } catch { return []; }
}

async function walk(root, out, depth = 0, skip = new Set()) {
  if (out.length >= MAX_FILES_PER_SOURCE || skip.has(root)) return;
  let st;
  try { st = await fsp.stat(root); } catch { return; }
  if (st.isFile()) {
    if (!isDenied(root)) out.push({ path: root, size: st.size, mtime: st.mtimeMs });
    return;
  }
  if (depth > MAX_DEPTH) return;
  let entries;
  try { entries = await fsp.readdir(root, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.claude') continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(root, e.name);
    if (isDenied(p)) continue;
    if (skip.has(p)) continue;
    if (e.isDirectory()) await walk(p, out, depth + 1, skip);
    else if (e.isFile()) {
      try {
        const s = await fsp.stat(p);
        out.push({ path: p, size: s.size, mtime: s.mtimeMs });
      } catch {}
    }
    if (out.length >= MAX_FILES_PER_SOURCE) return;
  }
}

// External drives are slow to walk, so they rescan every 2 minutes instead of every 10 seconds.
const walkCache = new Map();
const isExternal = (p) => p.startsWith('/Volumes/') || p.startsWith('/media/') || p.startsWith('/mnt/');
async function cachedWalk(root, skip) {
  const ttl = isExternal(root) ? 120_000 : 0;
  const key = root + '|' + [...skip].join(',');
  const hit = walkCache.get(key);
  if (ttl && hit && Date.now() - hit.at < ttl) return hit.files;
  const files = [];
  await walk(root, files, 0, skip);
  walkCache.set(key, { at: Date.now(), files });
  return files;
}

const KIND = {
  doc: /\.(md|txt|pdf|docx)$/i, page: /\.(html?)$/i, code: /\.(m?js|ts|tsx|jsx|py|sh|json|css)$/i,
  image: /\.(png|jpe?g|gif|webp|svg|avif)$/i, video: /\.(mp4|mov|webm|m4v)$/i, audio: /\.(wav|mp3|m4a|aac)$/i,
};
const kindOf = (p) => Object.keys(KIND).find((k) => KIND[k].test(p)) || 'other';

// The "About" text on a space page: the first real paragraph of its README, CLAUDE.md or ONBOARDING.md.
async function readSummary(dirs, explicit) {
  const candidates = explicit ? [expand(explicit)] : dirs.flatMap((d) => ['README.md', 'CLAUDE.md', 'ONBOARDING.md'].map((n) => path.join(d, n)));
  for (const f of candidates) {
    try {
      const txt = await fsp.readFile(f, 'utf8');
      const links = [...new Set(txt.match(/https:\/\/[^\s)>\]"']+/g) || [])].filter((l) => !isDenied(l));
      const body = txt.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n').filter((l) => !/^#/.test(l)).join('\n').trim();
      const para = body.split(/\n\s*\n/).find((p) => p.trim().length > 40 && !p.startsWith('|') && !p.startsWith('```') && !/^(This file|> )/.test(p.trim())) || '';
      return { file: f, excerpt: para.replace(/\s+/g, ' ').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '').slice(0, 520), links };
    } catch {}
  }
  return null;
}

function parseFrontmatter(txt) {
  const m = txt.match(/^---\n([\s\S]*?)\n---/);
  const fm = {};
  if (!m) return fm;
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v === '>' || v === '|' || v === '>-' || v === '|-') {
      const buf = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) buf.push(lines[++i].trim());
      v = buf.join(' ');
    }
    fm[kv[1]] = v.replace(/^["']|["']$/g, '');
  }
  return fm;
}

async function scanSkills() {
  const skills = [];
  for (const sd of config.skillDirs) {
    const dir = expand(sd.path);
    let names = [];
    try { names = await fsp.readdir(dir); } catch { continue; }
    for (const n of names) {
      if (n.startsWith('.')) continue;
      const f = path.join(dir, n, 'SKILL.md');
      try {
        const txt = await fsp.readFile(f, 'utf8');
        const fm = parseFrontmatter(txt);
        let desc = fm.description || '';
        if (!desc) {
          const firstPara = txt.replace(/^---[\s\S]*?---/, '').split(/\n\s*\n/).find((p) => p.trim() && !p.trim().startsWith('#'));
          desc = (firstPara || '').trim();
        }
        skills.push({ id: n, name: fm.name || n, origin: sd.label, description: desc.replace(/\s+/g, ' ').slice(0, 320), file: f });
      } catch {}
    }
  }
  return skills;
}

// Claude Code stores each project's logs in ~/.claude/projects/<path with every non-alphanumeric character as ->.
export const encodeProjectDir = (p) => p.replace(/[^a-zA-Z0-9]/g, '-');
export const prettyProject = (d) => {
  const home = encodeProjectDir(HOME);
  let label = (d.startsWith(home) ? d.slice(home.length) : d).replace(/^-+/, '').replace(/^Projects-/, '').replace(/-/g, ' ').trim();
  if (/scratch|^private tmp|^tmp/.test(label)) return 'Scratch workspace';
  if (/^Volumes /.test(label)) return 'Drive: ' + label.replace(/^Volumes /, '');
  if (/^Library CloudStorage/.test(label)) return 'Cloud: ' + label.replace(/^.*My Drive /, '');
  return label || 'Home folder';
};

async function scanSessions(spaces) {
  const base = path.join(HOME, '.claude', 'projects');
  let dirs = [];
  try { dirs = await fsp.readdir(base); } catch { return { projects: [], today: 0, week: 0 }; }
  const now = Date.now();
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const projects = [];
  let today = 0, week = 0;
  for (const d of dirs) {
    let files = [];
    try { files = (await fsp.readdir(path.join(base, d))).filter((f) => f.endsWith('.jsonl')); } catch { continue; }
    let last = 0, cToday = 0, cWeek = 0;
    for (const f of files) {
      try {
        const s = await fsp.stat(path.join(base, d, f));
        last = Math.max(last, s.mtimeMs);
        if (s.mtimeMs >= dayStart.getTime()) cToday++;
        if (now - s.mtimeMs < 7 * 864e5) cWeek++;
      } catch {}
    }
    if (!files.length) continue;
    today += cToday; week += cWeek;
    const space = spaces.find((sp) => sp.roots.some((r) => d === encodeProjectDir(r) || d.startsWith(encodeProjectDir(r) + '-')));
    projects.push({ dir: d, label: prettyProject(d), total: files.length, today: cToday, week: cWeek, last, space: space?.id || null });
  }
  projects.sort((a, b) => b.last - a.last);
  return { projects: projects.slice(0, 14), today, week };
}

let STATE = { scannedAt: 0, spaces: [], skills: [], activity: [], sessions: {}, totals: {} };
let scanning = false;

async function scan() {
  if (scanning) return;
  scanning = true;
  const t0 = Date.now();
  try {
    const spaces = [];
    const allFiles = [];
    const claimed = new Set();
    for (const sp of [...config.spaces, ...(readOverrides().custom || [])]) {
      const sources = [];
      const roots = [];
      const seen = new Set();
      const skip = new Set();
      for (const src of sp.sources.filter((x) => x.startsWith('!'))) for (const m of await resolveSource(src.slice(1))) skip.add(m);
      for (const src of sp.sources.filter((x) => !x.startsWith('!'))) {
        const matches = (await resolveSource(src)).filter((m) => !skip.has(m));
        const files = [];
        for (const m of matches) { roots.push(m); files.push(...(await cachedWalk(m, skip))); }
        const uniq = files.filter((f) => !seen.has(f.path) && seen.add(f.path));
        const kinds = {};
        for (const f of uniq) kinds[kindOf(f.path)] = (kinds[kindOf(f.path)] || 0) + 1;
        sources.push({
          spec: src,
          path: tildify(matches.length === 1 ? matches[0] : expand(src)),
          abs: matches.length === 1 ? matches[0] : path.dirname(expand(src)),
          folders: matches.length,
          files: uniq.length,
          kinds,
          last: uniq.reduce((m, f) => Math.max(m, f.mtime), 0),
          missing: matches.length === 0,
        });
        for (const f of uniq) {
          const dup = claimed.has(f.path);
          if (!dup) claimed.add(f.path);
          allFiles.push({ path: f.path, size: f.size, mtime: f.mtime, space: sp.id, dup });
        }
      }
      const spaceFiles = allFiles.filter((f) => f.space === sp.id);
      const recent = [...spaceFiles].sort((a, b) => b.mtime - a.mtime).slice(0, 14)
        .map((f) => ({ path: f.path, display: tildify(f.path), name: path.basename(f.path), mtime: f.mtime, size: f.size, kind: kindOf(f.path) }));
      const kinds = {};
      for (const f of spaceFiles) kinds[kindOf(f.path)] = (kinds[kindOf(f.path)] || 0) + 1;
      // 14-day activity histogram
      const days = Array(14).fill(0);
      const today0 = new Date(); today0.setHours(0, 0, 0, 0);
      for (const f of spaceFiles) {
        const ago = Math.floor((today0.getTime() + 864e5 - f.mtime) / 864e5);
        if (ago >= 0 && ago < 14) days[13 - ago]++;
      }
      const summary = await readSummary(roots.filter((r) => { try { return fs.statSync(r).isDirectory(); } catch { return false; } }), sp.readme);
      spaces.push({
        id: sp.id, group: sp.group || 'custom', name: sp.name, tagline: sp.tagline || '', color: sp.color || '#4a5871', status: sp.status || '', skills: sp.skills || [],
        sources, roots, files: spaceFiles.length, kinds, days, recent,
        last: spaceFiles.reduce((m, f) => Math.max(m, f.mtime), 0),
        summary: summary && { ...summary, file: tildify(summary.file), abs: summary.file },
      });
    }
    const activity = allFiles.filter((f) => !f.dup).sort((a, b) => b.mtime - a.mtime).slice(0, 80)
      .map((f) => ({ path: f.path, display: tildify(f.path), name: path.basename(f.path), mtime: f.mtime, space: f.space, kind: kindOf(f.path) }));
    const skills = await scanSkills();
    const sessions = await scanSessions(spaces);
    const links = buildLinks(spaces);
    ROOTS = Object.fromEntries(spaces.map((s) => [s.id, s.roots]));
    for (const s of spaces) delete s.roots;
    STATE = {
      scannedAt: Date.now(), scanMs: Date.now() - t0, spaces, skills, activity, sessions, links, groups: config.groups || [],
      totals: { files: allFiles.filter((f) => !f.dup).length, spaces: spaces.length, skills: skills.length },
    };
    STATE.agents = AGENTS; STATE.clickup = readClickup();
    ALLOWED = new Set(spaces.flatMap((s) => s.sources.filter((x) => !x.missing).map((x) => x.abs)).concat(skills.map((s) => path.dirname(s.file))));
  } catch (e) {
    console.error('scan failed', e);
  } finally {
    scanning = false;
  }
}

// Connections: curated links from the config and overrides, plus links the scan can prove.
function buildLinks(spaces) {
  const by = Object.fromEntries(spaces.map((s) => [s.id, s]));
  const inside = (child, parents) => parents.some((p) => child === p || child.startsWith(p + path.sep));
  const evidence = (a, b) => {
    const ev = [];
    const nested = b.roots.filter((r) => inside(r, a.roots) && !a.roots.includes(r)).length + a.roots.filter((r) => inside(r, b.roots) && !b.roots.includes(r)).length;
    if (nested) ev.push(`${nested} shared folder${nested > 1 ? 's' : ''}`);
    const shared = a.skills.filter((k) => b.skills.includes(k));
    if (shared.length) ev.push('shares ' + shared.map((k) => '/' + k).join(', '));
    return ev;
  };
  const ov = readOverrides();
  const curated = [...(config.links || []), ...(ov.links || [])].filter((l) => by[l.from] && by[l.to] && !(ov.removedLinks || []).includes(l.from + '>' + l.to));
  const links = curated.map((l) => ({ ...l, kind: 'curated', evidence: evidence(by[l.from], by[l.to]) }));
  const has = (a, b) => links.some((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
  // shared folders and skills that nobody wrote down yet
  for (let i = 0; i < spaces.length; i++) for (let j = i + 1; j < spaces.length; j++) {
    const a = spaces[i], b = spaces[j];
    if (has(a.id, b.id) || a.id === HUB || b.id === HUB) continue;
    const ev = evidence(a, b);
    if (ev.length) links.push({ from: a.id, to: b.id, label: 'Found by scan', kind: 'auto', evidence: ev });
  }
  // the hub tracks every space that keeps files inside it
  const hub = by[HUB];
  if (hub) {
    for (const s of spaces) if (s.id !== HUB && s.roots.some((r) => inside(r, hub.roots)) && !has(HUB, s.id)) links.push({ from: HUB, to: s.id, label: 'Context, priorities and decisions', kind: 'hub', evidence: [] });
  }
  return links;
}

let ROOTS = {};
let AGENTS = null;
const CLICKUP = path.join(DATA, 'clickup.json');
const readClickup = () => { try { return JSON.parse(fs.readFileSync(CLICKUP, 'utf8')); } catch { return null; } };
const spaceForDir = (d) => (STATE.spaces || []).find((sp) => (ROOTS[sp.id] || []).some((r) => d === encodeProjectDir(r) || d.startsWith(encodeProjectDir(r) + '-')))?.id || null;
async function scanAgentsLayer() {
  try { AGENTS = await scanAgents({ spaceForDir, deny: DENY, prettyProject }); STATE.agents = AGENTS; } catch (e) { console.error('agents scan failed', e.message); }
}
let RUN = null;
function runContext() {
  const sp = STATE.spaces.map((s) => `${s.name} [${s.id}] status "${s.status}", ${s.files} files, last change ${new Date(s.last || Date.now()).toISOString().slice(0, 10)}`).join('; ');
  const ln = STATE.links.filter((l) => l.kind === 'curated').map((l) => `${l.from} -> ${l.to}: ${l.label}`).join('; ');
  const ck = readClickup();
  const tasks = ck ? ' Last ClickUp pull: ' + ck.tasks.map((t) => `${t.name} (${t.status}, due ${t.due || 'none'})`).join('; ') : '';
  return { spaceIds: STATE.spaces.map((s) => s.id).join(', '), summary: `Spaces: ${sp}. Connections: ${ln}.${tasks}` };
}
const runCwd = () => (ROOTS[HUB] || [])[0] || HERE;
let ALLOWED = new Set();
const EXTRA_ALLOWED = new Set(); // read-only roots plugins add (the wiki, context files)
function isAllowed(p) {
  const abs = path.resolve(p);
  if (isDenied(abs)) return false;
  for (const root of [...ALLOWED, ...EXTRA_ALLOWED]) if (abs === root || abs.startsWith(root + path.sep)) return true;
  return false;
}

// ---------- overrides (the only file AIOS writes outside the wiki) ----------
function readOverrides() {
  try { return JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')); } catch { return { spaces: {}, order: [], appearance: {}, notes: {}, custom: [] }; }
}
function writeOverrides(o) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(OVERRIDES, JSON.stringify(o, null, 2));
}

// ---------- http ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
};

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 2e6) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });

function serveFile(req, res, abs) {
  let st;
  try { st = fs.statSync(abs); } catch { return send(res, 404, { error: 'not found' }); }
  if (!st.isFile()) return send(res, 400, { error: 'not a file' });
  const type = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  if (st.size === 0) { res.writeHead(200, { 'Content-Type': type, 'Content-Length': 0 }); return res.end(); }
  if (range) {
    const [s, e] = range.replace('bytes=', '').split('-');
    const start = Math.min(Number(s) || 0, st.size - 1), end = Math.min(e ? Number(e) : st.size - 1, st.size - 1);
    if (end < start) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    return fs.createReadStream(abs, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(abs).pipe(res);
}

// Open a file or folder with the operating system (Finder, Explorer, or the Linux file manager).
function openWith(type, target, cb) {
  const plat = process.platform;
  if (plat === 'darwin') {
    const args = { reveal: ['-R', target], open: [target], terminal: ['-a', 'Terminal', target], code: ['-a', 'Visual Studio Code', target] }[type];
    return args ? execFile('open', args, cb) : cb(new Error('unknown action'));
  }
  const dir = fs.statSync(target).isDirectory() ? target : path.dirname(target);
  if (type === 'code') return execFile('code', [target], { shell: plat === 'win32' }, cb);
  if (plat === 'win32') {
    if (type === 'reveal') return execFile('explorer', ['/select,', target], () => cb(null));
    if (type === 'terminal') return execFile('cmd', ['/c', 'start', 'cmd', '/K', `cd /d "${dir}"`], cb);
    return execFile('explorer', [target], () => cb(null));
  }
  if (type === 'terminal') return execFile('x-terminal-emulator', [], { cwd: dir }, cb);
  return execFile('xdg-open', [type === 'reveal' ? dir : target], cb);
}

// Only answer requests made from AIOS itself: blocks other websites and DNS-rebinding tricks from reaching your files.
const LOCAL_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`]);
function trusted(req) {
  if (!LOCAL_HOSTS.has(req.headers.host)) return false;
  const origin = req.headers.origin;
  if (origin && !LOCAL_HOSTS.has(origin.replace(/^https?:\/\//, ''))) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD' && !origin && req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') return false;
  return true;
}

const server = http.createServer(async (req, res) => {
  if (!trusted(req)) return send(res, 403, { error: 'AIOS only answers requests from its own page' });
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  for (const pl of PLUGINS) if (pl.route && (await pl.route(req, res, url, CTX))) return;

  if (p === '/api/state') return send(res, 200, { ...STATE, ext: EXT, overrides: readOverrides(), config: { owner: config.owner || '', title: config.title || 'AIOS', hub: HUB, agentRuns: !!config.agentRuns?.enabled, clickup: !!config.clickup?.enabled } });

  if (p === '/api/relink' && req.method === 'POST') { STATE.links = buildLinks(STATE.spaces.map((s) => ({ ...s, roots: ROOTS[s.id] || [] }))); return send(res, 200, { ok: true }); }

  if (p === '/api/run' && req.method === 'POST') {
    if (!config.agentRuns?.enabled) return send(res, 403, { error: 'Agent runs are off. Set agentRuns.enabled to true in aios.config.json.' });
    const { mode, question } = await readBody(req);
    if (mode === 'crew' && !config.clickup?.enabled) return send(res, 403, { error: 'Set up the clickup section in aios.config.json first.' });
    if (RUN) return send(res, 409, { error: 'An agent run is already going' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    const emit = (ev) => { try { res.write('data: ' + JSON.stringify(ev) + '\n\n'); } catch {} };
    RUN = runAgent({ mode: mode === 'crew' ? 'crew' : 'ask', question: String(question || '').slice(0, 500), context: runContext(), config, cwd: runCwd(), onEvent: (ev) => {
      if (ev.type === 'done' && mode === 'crew') {
        const m = ev.result.match(/```json\s*([\s\S]*?)```/);
        if (m) { try { const tasks = JSON.parse(m[1]); fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(CLICKUP, JSON.stringify({ at: Date.now(), tasks }, null, 2)); STATE.clickup = readClickup(); ev.tasks = tasks.length; } catch {} }
        ev.result = ev.result.replace(/```json[\s\S]*?```/, '').trim();
      }
      emit(ev);
      if (ev.type === 'closed') { RUN = null; res.end(); scanAgentsLayer(); }
    } });
    return;
  }

  if (p === '/api/rescan' && req.method === 'POST') { await scan(); return send(res, 200, { ok: true, scannedAt: STATE.scannedAt }); }

  if (p === '/api/overrides' && req.method === 'POST') {
    const body = await readBody(req);
    writeOverrides({ ...readOverrides(), ...body });
    return send(res, 200, { ok: true });
  }

  if (p === '/api/text') {
    const f = url.searchParams.get('path') || '';
    if (!isAllowed(f)) return send(res, 403, { error: 'outside AIOS sources' });
    try {
      const st = await fsp.stat(f);
      const buf = Buffer.alloc(Math.min(st.size, 400_000));
      const fd = await fsp.open(f, 'r'); await fd.read(buf, 0, buf.length, 0); await fd.close();
      return send(res, 200, { text: buf.toString('utf8'), truncated: st.size > buf.length, size: st.size, mtime: st.mtimeMs });
    } catch { return send(res, 404, { error: 'not found' }); }
  }

  // Raw file serving keeps relative links working, so HTML pages render live in the preview.
  if (p.startsWith('/raw/')) {
    const abs = decodeURIComponent(p.slice(4));
    if (!isAllowed(abs)) return send(res, 403, { error: 'outside AIOS sources' });
    return serveFile(req, res, abs);
  }

  if (p === '/api/action' && req.method === 'POST') {
    const { type, path: target } = await readBody(req);
    if (!target || !isAllowed(target)) return send(res, 403, { error: 'outside AIOS sources' });
    try { openWith(type, target, (err) => send(res, err ? 500 : 200, { ok: !err, error: err?.message })); }
    catch (e) { send(res, 500, { ok: false, error: e.message }); }
    return;
  }

  // static UI
  const rel = p === '/' ? 'index.html' : p.slice(1);
  const abs = path.join(PUBLIC, rel);
  if (!abs.startsWith(PUBLIC + path.sep)) return send(res, 403, 'no');
  return serveFile(req, res, abs);
});

await scan();
await scanAgentsLayer();
// Plugins: plugins/*.mjs export { name, every, scan(ctx), route?(req, res, url, ctx) }. Results land in state.ext[name].
const EXT = {};
const PLUGINS = [];
const CTX = { ext: () => EXT, allow: (p) => EXTRA_ALLOWED.add(path.resolve(p)), HOME, DATA, HERE, expand, isAllowed, isDenied, send, readBody, tildify, encodeProjectDir, config, roots: () => ROOTS, state: () => STATE };
for (const f of fs.existsSync(path.join(HERE, 'plugins')) ? fs.readdirSync(path.join(HERE, 'plugins')).filter((f) => f.endsWith('.mjs')).sort() : []) {
  try {
    const pl = await import(pathToFileURL(path.join(HERE, 'plugins', f)).href);
    PLUGINS.push(pl);
    const run = async () => { try { EXT[pl.name] = await pl.scan(CTX); } catch (e) { console.error(`plugin ${pl.name}:`, e.message); } };
    await run();
    if (pl.every) setInterval(run, pl.every);
  } catch (e) { console.error(`plugin ${f} failed to load:`, e.message); }
}

setInterval(scan, 10_000);
setInterval(scanAgentsLayer, 12_000);
server.listen(PORT, HOST, () => {
  console.log(`AIOS running at http://localhost:${PORT}`);
  console.log(`  ${STATE.totals.spaces} spaces, ${STATE.totals.files} files, ${STATE.totals.skills} skills (scan ${STATE.scanMs}ms)`);
});
