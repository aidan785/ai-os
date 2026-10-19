// Knowledge wiki: writes ./wiki as an Obsidian vault that mirrors the whole OS as cross-linked notes:
// spaces, groups, skills, connections, routines, agent roles and the Four Cs. Open the folder in Obsidian and use Graph view.
// It only ever writes inside ./wiki (or the folder set in "wiki.path").
import fs from 'node:fs';
import path from 'node:path';

export const name = 'wiki';
export const every = 300_000;

const safe = (s) => String(s).replace(/[\\/:*?"<>|#^[\]]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);
const link = (s) => `[[${safe(s)}]]`;
const day = (t) => (t ? new Date(t).toISOString().slice(0, 10) : 'n/a');

export async function scan(ctx) {
  const S = ctx.state();
  const X = ctx.ext ? ctx.ext() : {};
  if (!S.spaces?.length) return null;
  if (ctx.config.wiki?.enabled === false) return null;
  const root = ctx.config.wiki?.path ? ctx.expand(ctx.config.wiki.path) : path.join(ctx.HERE, 'wiki');
  const pages = new Map();
  const put = (dir, title, body, tags = []) => {
    const fm = tags.length ? `---\ntags: [${tags.join(', ')}]\n---\n\n` : '';
    pages.set(path.join(dir, safe(title) + '.md'), `${fm}# ${title}\n\n${String(body).trim()}\n`);
  };
  const spaceName = Object.fromEntries(S.spaces.map((s) => [s.id, s.name]));
  const sp = (id) => link(spaceName[id] || id);

  // ---------- spaces, groups, skills ----------
  for (const s of S.spaces) {
    const ls = (S.links || []).filter((l) => l.kind !== 'hub' && (l.from === s.id || l.to === s.id));
    put('Spaces', s.name, `${s.tagline || ''}

- Group: ${link((S.groups || []).find((g) => g.id === s.group)?.name || 'Spaces')}
- Status: ${s.status || 'n/a'} · ${s.files} files · updated ${day(s.last)}

## Connects to
${ls.map((l) => { const o = l.from === s.id ? l.to : l.from; return `- ${l.from === s.id ? 'feeds' : 'fed by'} ${sp(o)}: ${l.kind === 'auto' ? (l.evidence || []).join(', ') : l.label}`; }).join('\n') || '- nothing yet'}

## Skills
${(s.skills || []).map((k) => `- ${link(k)}`).join('\n') || '- none attached'}

## Sources
${(s.sources || []).map((x) => `- \`${x.path}\`${x.missing ? ' (missing)' : ` (${x.files} files)`}`).join('\n')}

Part of ${link('Context')}`, ['space']);
  }
  for (const g of S.groups || []) put('Spaces', g.name, `Group of spaces.\n\n${S.spaces.filter((s) => s.group === g.id).map((s) => `- ${link(s.name)}`).join('\n')}`, ['group']);
  for (const k of S.skills || []) {
    const used = S.spaces.filter((s) => (s.skills || []).includes(k.id));
    put('Skills', k.id, `${k.description || ''}\n\n- Origin: ${k.origin || 'n/a'}\n- Used by: ${used.map((s) => link(s.name)).join(', ') || 'no space yet'}\n- Part of: ${link('Capabilities')}`, ['skill']);
  }

  // ---------- connections: the seven buckets and every tool ----------
  const buckets = X.fourcs?.buckets || [];
  for (const b of buckets) {
    put('Connections', b.name, `Connection bucket. Answers: "${b.ask || ''}"\n\n${b.tools.map((t) => `- ${link(t.name)} (${t.how}${t.wired ? '' : ', not connected yet'})`).join('\n')}\n\nPart of ${link('Connections')}`, ['bucket']);
    for (const t of b.tools) put('Connections', t.name, `${t.note}\n\n- Bucket: ${link(b.name)}\n- Reached through: ${t.how}\n- Status: ${t.wired ? 'connected' : 'not connected yet'}`, ['tool']);
  }

  // ---------- routines ----------
  for (const r of X.routines || []) put('Routines', r.name, `${r.what}\n\n- Schedule: \`${r.cron}\`\n- Runs: ${r.skill?.startsWith('/') ? link(r.skill.slice(1)) : '`' + (r.skill || 'n/a') + '`'}\n- Space: ${sp(r.space)}\n- Status: ${r.status}\n\nPart of ${link('Cadence')}`, ['routine']);

  // ---------- agents: roles from the Claude Code logs ----------
  const roster = S.agents?.roster;
  for (const r of roster?.roles || []) {
    const conns = Object.keys(r.connectors || {});
    put('Agents', r.role, `${r.count} subagents spawned in this role${r.week ? `, ${r.week} this week` : ''}.\n\n## Recent jobs\n${r.examples.map((x) => `- ${x}`).join('\n')}\n\n## Tools they use\n${conns.map((c) => `- ${link(c)}`).join('\n') || '- files and terminal only'}\n\nPart of ${link('Capabilities')}`, ['agent-role']);
  }
  for (const c of S.agents?.connectors || []) if (!pages.has(path.join('Connections', safe(c.label) + '.md'))) put('Connections', c.label, `Connector agents called ${c.calls} times this week.\n\nPart of ${link('Connections')}`, ['tool']);

  // ---------- context files ----------
  for (const f of X.fourcs?.context?.files || []) put('Context', f.label, `${f.what}\n\n- File: \`${ctx.tildify(f.path)}\`\n- ${f.lines} lines · updated ${day(f.mtime)}\n\nPart of ${link('Context')}`, ['context']);

  // ---------- Four Cs hubs ----------
  put('', 'Context', `What the OS knows.\n\n${(X.fourcs?.context?.files || []).map((f) => `- ${link(f.label)}`).join('\n')}\n- ${X.fourcs?.context?.decisions || 0} decisions, ${X.fourcs?.context?.memories || 0} memories\n\n## Spaces\n${S.spaces.map((s) => `- ${link(s.name)}`).join('\n')}\n\nPart of ${link('Four Cs')}`, ['hub']);
  put('', 'Connections', `What it can reach.\n\n${buckets.map((b) => `- ${link(b.name)}`).join('\n')}\n\nPart of ${link('Four Cs')}`, ['hub']);
  put('', 'Capabilities', `What it can do.\n\n- ${(S.skills || []).length} skills\n- ${roster?.total || 0} subagents spawned\n\n## Agent roles\n${(roster?.roles || []).map((r) => `- ${link(r.role)}`).join('\n')}\n\nPart of ${link('Four Cs')}`, ['hub']);
  put('', 'Cadence', `When it acts alone.\n\n${(X.routines || []).map((r) => `- ${link(r.name)}`).join('\n') || '- no routines yet'}\n\nPart of ${link('Four Cs')}`, ['hub']);
  put('', 'Four Cs', `The AI OS framework: ${link('Context')}, ${link('Connections')}, ${link('Capabilities')}, ${link('Cadence')}.`, ['hub']);

  // ---------- index + log ----------
  const sections = {};
  for (const rel of pages.keys()) { const d = path.dirname(rel) === '.' ? 'Hubs' : path.dirname(rel); (sections[d] ||= []).push(path.basename(rel, '.md')); }
  pages.set('index.md', `# AIOS wiki\n\nGenerated from the live AIOS: ${pages.size + 1} notes. Open this folder in Obsidian and use Graph view.\n\n${Object.entries(sections).map(([d, ns]) => `## ${d} (${ns.length})\n${ns.sort().map((n) => `- [[${n}]]`).join('\n')}`).join('\n\n')}\n`);

  fs.mkdirSync(root, { recursive: true });
  ctx.allow(root);
  let changed = 0;
  for (const [rel, md] of pages) {
    const f = path.join(root, rel);
    if (!f.startsWith(root + path.sep)) continue;
    fs.mkdirSync(path.dirname(f), { recursive: true });
    let prev = null; try { prev = fs.readFileSync(f, 'utf8'); } catch {}
    if (prev !== md) { fs.writeFileSync(f, md); changed++; }
  }
  const logF = path.join(root, 'log.md');
  if (changed) {
    let log = ''; try { log = fs.readFileSync(logF, 'utf8'); } catch {}
    const lines = log.split('\n').filter((l) => l.startsWith('- '));
    lines.unshift(`- ${new Date().toISOString().slice(0, 16).replace('T', ' ')} updated ${changed} of ${pages.size} pages`);
    fs.writeFileSync(logF, '# Ingest log\n\n' + lines.slice(0, 30).join('\n') + '\n');
  }
  return { path: root, pages: pages.size, changed, at: Date.now() };
}
