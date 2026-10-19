// AIOS client. Reads /api/state, renders the OS, saves edits to /api/overrides.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString();
const ago = (t) => {
  if (!t) return 'never';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 86400 * 30) return Math.floor(s / 86400) + 'd ago';
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
const KIND_LABEL = { doc: 'DOC', page: 'PAGE', code: 'CODE', image: 'IMG', video: 'VIDEO', audio: 'AUDIO', other: 'FILE' };
const ACCENTS = [['#37bdf8', '#0a72b5'], ['#6b8afd', '#3d5bd9'], ['#2dd4bf', '#0d7f72'], ['#a78bfa', '#6d4fd0'], ['#fb923c', '#b5530f'], ['#64748b', '#334155']];
const SPACE_COLORS = ['#2f6fed', '#0f9d8a', '#8a2b2b', '#d9662b', '#c2417a', '#d23b3b', '#6b4fd8', '#3d3d3d', '#a8862a', '#4a8a3a', '#1d1d1f', '#7a7a7a'];

// Extension hooks for public/ext/*.js: EXT.views[name] = { label, wide, count(), render(), after() }, EXT.spaceExtras.push((space) => html)
window.EXT = { views: {}, spaceExtras: [], spaceTop: [] };
let S = null; // server state
let O = { spaces: {}, order: [], appearance: {}, notes: {}, custom: [] }; // overrides
let route = { view: 'home' };
let editing = false;
let seen = new Set(); // activity paths+mtime already shown
let firstLoad = true;

// ---------- data ----------
async function load() {
  const res = await fetch('/api/state');
  const next = await res.json();
  const fresh = [];
  if (!firstLoad) for (const a of next.activity) { const key = a.path + a.mtime; if (!seen.has(key)) fresh.push(a); }
  for (const a of next.activity) seen.add(a.path + a.mtime);
  S = next;
  document.title = S.config.title;
  $('.brand span:last-child').textContent = S.config.title;
  O = { spaces: {}, order: [], appearance: {}, notes: {}, custom: [], ...next.overrides };
  applyAppearance();
  if (firstLoad) { firstLoad = false; route = routeFromHash(); render(); }
  else {
    renderRail(); renderSide(fresh);
    try { EXT.views[route.view]?.refresh?.(); } catch (e) { console.error(e); }
    if (fresh.length) {
      const sp = space(fresh[0].space);
      toast(`${fresh[0].name} changed in ${sp ? sp.name : 'a space'}`);
      $('#live-status').classList.remove('pulse'); void $('#live-status').offsetWidth; $('#live-status').classList.add('pulse');
      if (route.view === 'home' || route.view === 'activity' || (route.view === 'space' && fresh.some((f) => f.space === route.id))) renderMain();
    }
  }
  $('#live-text').textContent = `Live · ${fmt(S.totals.files)} files`;
  if (typeof refreshAgents === 'function') refreshAgents();
}

const saveTimer = {};
function save(partial, quiet) {
  Object.assign(O, partial);
  clearTimeout(saveTimer.t);
  saveTimer.t = setTimeout(async () => {
    await fetch('/api/overrides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(O) });
    if (!quiet) toast('Saved');
  }, 350);
}

function spaces(includeHidden = editing) {
  const list = S.spaces.map((s) => ({ ...s, ...(O.spaces[s.id] || {}) }));
  const order = O.order || [];
  const gi = (x) => { const i = (S.groups || []).findIndex((g) => g.id === x.group); return i < 0 ? 99 : i; };
  list.sort((a, b) => {
    if (gi(a) !== gi(b)) return gi(a) - gi(b);
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || S.spaces.indexOf(S.spaces.find((x) => x.id === a.id)) - S.spaces.indexOf(S.spaces.find((x) => x.id === b.id));
  });
  return includeHidden ? list : list.filter((s) => !s.hidden);
}
const space = (id) => spaces(true).find((s) => s.id === id);
const groupsWithSpaces = (list) => {
  const gs = [...(S.groups || []), { id: 'custom', name: 'Custom' }];
  return gs.map((g) => ({ ...g, items: list.filter((s) => s.group === g.id) })).filter((g) => g.items.length);
};
const idx = (id) => String(spaces(true).findIndex((s) => s.id === id) + 1).padStart(2, '0');
const syncMode = () => document.body.classList.toggle('brain-mode', route.view === 'brain' || route.view === 'agents' || !!EXT.views[route.view]?.wide);

async function act(type, path) {
  const r = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, path }) });
  const j = await r.json();
  toast(j.ok ? { reveal: 'Revealed in Finder', open: 'Opened', terminal: 'Opened in Terminal', code: 'Opened in VS Code' }[type] : (j.error || 'Could not do that'));
}

// ---------- appearance ----------
function applyAppearance() {
  const a = { theme: 'light', accent: '#37bdf8', font: 'system', density: 'comfortable', ...O.appearance };
  const r = document.documentElement;
  r.dataset.theme = a.theme; r.dataset.font = a.font; r.dataset.density = a.density;
  const pair = ACCENTS.find(([c]) => c === a.accent) || ACCENTS[0];
  r.style.setProperty('--blue', pair[0]);
  if (a.theme === 'dark') r.style.removeProperty('--blue-ink'); else r.style.setProperty('--blue-ink', pair[1]);
}
function renderAppearance() {
  const a = { theme: 'light', accent: '#37bdf8', font: 'system', density: 'comfortable', ...O.appearance };
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-ap="${key}" data-v="${v}" aria-pressed="${a[key] === v}">${l}</button>`).join('')}</div>`;
  $('#appearance').innerHTML = `
    <h4>Theme</h4>${seg('theme', [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']])}
    <h4>Accent</h4><div class="swatches">${ACCENTS.map(([c]) => `<button data-ap="accent" data-v="${c}" style="background:${c}" aria-pressed="${a.accent === c}" aria-label="${c}"></button>`).join('')}</div>
    <h4>Type</h4>${seg('font', [['system', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono']])}
    <h4>Density</h4>${seg('density', [['comfortable', 'Comfortable'], ['compact', 'Compact']])}`;
}
$('#appearance').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ap]'); if (!b) return;
  O.appearance = { ...O.appearance, [b.dataset.ap]: b.dataset.v };
  applyAppearance(); renderAppearance(); save({ appearance: O.appearance }, true);
});
$('#toggle-appearance').addEventListener('click', () => {
  const p = $('#appearance'); const open = !p.classList.contains('open');
  if (open) renderAppearance();
  p.classList.toggle('open', open); $('#toggle-appearance').setAttribute('aria-pressed', open);
});

// ---------- rail ----------
// Nav follows the Four Cs: Context, Connections, Capabilities, Cadence.
const TOP_NAV = ['home', 'os'];
const C_OF = { brain: 'Context', activity: 'Context', connections: 'Connections', skills: 'Capabilities', agents: 'Capabilities', routines: 'Cadence' };
const C_ORDER = ['Context', 'Connections', 'Capabilities', 'Cadence'];
const C_ORDER_VIEWS = ['brain', 'activity', 'connections', 'agents', 'skills', 'routines'];
function railNav(nav) {
  const item = ([v, l]) => `<button class="rail-item nav-item" data-go="${v}" aria-current="${route.view === v}"><span>${esc(l)}</span></button>`;
  const top = TOP_NAV.map((v) => nav.find((n) => n[0] === v)).filter(Boolean).map(item).join('');
  const rest = nav.filter((n) => !TOP_NAV.includes(n[0])).sort((a, b) => C_ORDER_VIEWS.indexOf(a[0]) - C_ORDER_VIEWS.indexOf(b[0]));
  return top + C_ORDER.map((c, i) => {
    const items = rest.filter((n) => (C_OF[n[0]] || 'Capabilities') === c);
    return items.length ? `<div class="rail-label c-label"><span><span class="c-num">${i + 1}</span>${c}</span></div>${items.map(item).join('')}` : '';
  }).join('');
}
function renderRail() {
  const now = Date.now();
  const railList = spaces();
  const nav = [['home', 'Home', ''], ['brain', 'Brain', S.links.filter((l) => l.kind !== 'hub').length], ['agents', 'Agents', S.agents?.stats.callsHour || ''], ['activity', 'Activity', S.activity.filter((a) => now - a.mtime < 864e5).length || ''], ['skills', 'Skills', S.skills.length], ...Object.entries(EXT.views).filter(([, x]) => x.label).map(([k, x]) => [k, x.label, (() => { try { return x.count?.() ?? ''; } catch { return ''; } })()])];
  $('#rail').innerHTML = `
    ${railNav(nav)}
    <div class="rail-divider"><span>Spaces</span></div>
    ${groupsWithSpaces(railList).map((g) => `<div class="rail-label"><span>${esc(g.name)}</span></div>
    ${g.items.map((s) => `
      <button class="rail-item space-item ${s.hidden ? 'hidden-space' : ''} ${now - s.last < 864e5 ? 'fresh' : ''}" data-go="space" data-id="${s.id}" data-space="${s.id}" draggable="${editing}" aria-current="${route.view === 'space' && route.id === s.id}" title="${esc(s.name)} · updated ${ago(s.last)}">
        <span class="swatch" style="background:${s.color}"></span><span class="nm">${esc(s.name)}</span>${now - s.last < 864e5 ? '<span class="fresh-dot" aria-label="updated today"></span>' : ''}
      </button>`).join('')}`).join('')}
    ${editing ? `<button class="rail-add" data-go="new">+ New space</button>` : ''}`;
}

// drag to reorder (edit mode)
let dragId = null;
$('#rail').addEventListener('dragstart', (e) => { const b = e.target.closest('[data-space]'); if (!b || !editing) return; dragId = b.dataset.space; e.dataTransfer.effectAllowed = 'move'; });
$('#rail').addEventListener('dragover', (e) => { const b = e.target.closest('[data-space]'); if (!b || !dragId) return; e.preventDefault(); document.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over')); b.classList.add('drag-over'); });
$('#rail').addEventListener('drop', (e) => {
  const b = e.target.closest('[data-space]'); if (!b || !dragId) return; e.preventDefault();
  const ids = spaces(true).map((s) => s.id).filter((id) => id !== dragId);
  ids.splice(ids.indexOf(b.dataset.space), 0, dragId);
  dragId = null; save({ order: ids }); renderRail(); renderMain();
});
$('#rail').addEventListener('dragend', () => { dragId = null; document.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over')); });

// ---------- side ----------
function renderSide(fresh = []) {
  const freshKeys = new Set(fresh.map((f) => f.path + f.mtime));
  const ses = S.sessions;
  $('#side').innerHTML = `
    <div class="block">
      <h3><span>Agents</span><span>Claude Code</span></h3>
      <div class="agent-stats">
        <div class="first"><div class="big-num">${ses.today}</div><div class="mono muted">sessions today</div></div>
        <div><div class="big-num">${ses.week}</div><div class="mono muted">this week</div></div>
      </div>
      ${ses.projects.slice(0, 6).map((p) => `<div class="agent ${Date.now() - p.last < 30 * 60e3 ? 'active' : ''}"><span class="t">${esc(p.label)}</span><span class="m">${ago(p.last)}</span></div>`).join('')}
    </div>
    <div class="block">
      <h3><span>Right now</span><span>${ago(S.scannedAt)}</span></h3>
      ${S.activity.slice(0, 14).map((a) => feedItem(a, freshKeys.has(a.path + a.mtime))).join('')}
    </div>`;
}
const feedItem = (a, isNew) => {
  const sp = space(a.space);
  return `<button class="feed-item ${isNew ? 'new' : ''}" data-file="${esc(a.path)}" data-kind="${a.kind}"><span class="sw" style="background:${sp?.color || '#999'}"></span><span style="min-width:0"><div class="t">${esc(a.name)}</div><div class="m">${esc(sp?.name || '')} · ${ago(a.mtime)}</div></span></button>`;
};

// ---------- main views ----------
function crumbs(parts) { $('#crumbs').innerHTML = parts.map((p, i) => (i === parts.length - 1 ? `<b>${esc(p)}</b>` : `<span>${esc(p)}</span><span>/</span>`)).join(''); }
const bars = (days, color, big) => { const max = Math.max(1, ...days); return `<div class="bars ${big ? 'big' : ''}" style="--c:${color}">${days.map((d) => `<i class="${d ? 'on' : ''}" style="height:${Math.max(6, (d / max) * 100)}%" title="${d} files"></i>`).join('')}</div>`; };

function viewHome() {
  crumbs(['Home']);
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const list = spaces();
  const sc = window.fourcsScores?.() || {};
  const ctx = S.ext?.fourcs?.context || {};
  const buckets = S.ext?.fourcs?.buckets || [];
  const layers = [
    ['Context', 'What it knows', `${list.length} spaces, ${ctx.memories || 0} memories, ${ctx.decisions || 0} decisions`, 'brain'],
    ['Connections', 'What it can reach', `${window.fourcsConnected?.() ?? 0} of ${buckets.length} buckets connected`, 'connections'],
    ['Capabilities', 'What it can do', `${S.skills.length} skills, ${fmt(S.agents?.roster?.total || 0)} subagents`, 'agents'],
    ['Cadence', 'When it acts alone', `${(window.fourcsRoutines?.() || []).length} routines on a schedule`, 'routines'],
  ];
  return `<div class="page home">
    <div class="eyebrow"><span class="tag">${esc(S.config.title)}</span><span>${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span></div>
    <h1>${greet}${S.config.owner ? ', ' + esc(S.config.owner) : ''}.</h1>
    <p class="lede">This is ${S.config.owner ? esc(S.config.owner) + "'s" : 'your'} AI operating system: every project, skill and agent in one place. It runs on four layers, scored <b>${sc.total ?? '...'} out of 100</b> today.</p>
    <div class="actions">
      <button class="btn primary" data-go="os">Take the tour</button>
      ${S.config.agentRuns ? '<button class="btn" data-ask>Ask AIOS</button>' : '<button class="btn" data-go="brain">Open the Brain</button>'}
    </div>
    <div class="layers">${layers.map(([n, what, stat, go], i) => `<button class="layer" data-go="${go}">
      <span class="layer-n mono">${i + 1}</span><b>${n}</b><span class="layer-what">${what}</span><span class="layer-stat">${esc(stat)}</span></button>`).join('')}</div>
    <div class="group-title"><h2>Spaces</h2><span>every project, grouped</span></div>
    ${groupsWithSpaces(list).map((g) => `<div class="space-group"><div class="sg-head"><b>${esc(g.name)}</b><span>${esc(g.note || '')}</span></div>
      <div class="sg-grid">${g.items.map((s) => `<button class="sg-item" data-go="space" data-id="${s.id}">
        <span class="sw" style="background:${s.color}"></span>
        <span class="sg-text"><b>${esc(s.name)}</b><span>${esc(s.tagline)}</span></span>
        <span class="sg-status ${/live|latest|just|today|building|production/i.test(s.status) ? 'on' : ''}">${esc(s.status)}</span></button>`).join('')}</div></div>`).join('')}
  </div>`;
}

function linksFor(id) { return S.links.filter((l) => l.from === id || l.to === id); }
function connectionsBlock(s) {
  const ls = linksFor(s.id).filter((l) => l.kind !== 'hub' || s.id === S.config.hub);
  if (!ls.length) return '';
  return `<div class="section"><div class="section-head"><h2>Connections</h2><button class="mono" data-go="brain" data-id="${s.id}" style="color:var(--accent)">Open in Brain</button></div>
    ${ls.map((l) => { const o = space(l.from === s.id ? l.to : l.from); if (!o) return ''; return `<button class="conn" data-go="space" data-id="${o.id}"><span class="conn-dir mono">${l.from === s.id ? 'to' : 'from'}</span><span><b><span class="sw" style="background:${o.color}"></span>${esc(o.name)}</b><p>${esc(l.kind === 'auto' ? l.evidence.join(' · ') : l.label)}</p></span></button>`; }).join('')}</div>`;
}
const shortPath = (d) => { const dir = d.split('/').slice(0, -1).join('/'); return dir.length > 72 ? '…' + dir.slice(-71) : dir; };
function fileRows(files) {
  if (!files.length) return '<div class="empty">Nothing here yet.</div>';
  return files.map((f) => `<button class="row file-row" data-file="${esc(f.path)}" data-kind="${f.kind}"><span class="k">${KIND_LABEL[f.kind]}</span><span style="min-width:0"><div class="fname">${esc(f.name)}</div><div class="fpath">${esc(shortPath(f.display))}</div></span><span class="when">${ago(f.mtime)}</span></button>`).join('');
}

function viewSpace(id) {
  const s = space(id);
  if (!s) { route = { view: 'home' }; return viewHome(); }
  crumbs(['Spaces', s.name]);
  const sessions = S.sessions.projects.filter((p) => p.space === s.id);
  const mainPath = s.sources.find((x) => !x.missing)?.abs;
  const kinds = Object.entries(s.kinds).sort((a, b) => b[1] - a[1]);
  const skills = s.skills.map((id) => S.skills.find((k) => k.id === id) || { id, name: id, description: '', origin: 'not installed' });
  return `<div class="page" style="--space:${s.color}">
    <div class="eyebrow"><span class="tag"><span class="sw" style="background:${s.color};margin-right:8px;vertical-align:-1px"></span>${esc(groupsWithSpaces(spaces(true)).find((g) => g.id === s.group)?.name || '')}</span><span>${esc(s.status)}</span><span>Updated ${ago(s.last)}</span></div>
    <h1 data-edit="name">${esc(s.name)}</h1>
    <p class="lede" data-edit="tagline">${esc(s.tagline)}</p>
    <div class="edit-strip">
      <span>Color</span>${SPACE_COLORS.map((c) => `<button class="color-dot" data-color="${c}" style="background:${c}" aria-pressed="${s.color === c}"></button>`).join('')}
      <span style="margin-left:10px">Status</span><input class="field" data-status value="${esc(s.status)}" style="width:150px">
      <button class="btn" data-hide>${s.hidden ? 'Show in OS' : 'Hide from OS'}</button>
    </div>
    <div class="actions">
      ${mainPath ? `<button class="btn primary" data-copy='cd "${esc(mainPath)}" && claude'>Copy Claude command</button>
      <button class="btn" data-act="reveal" data-path="${esc(mainPath)}">Open folder</button>` : ''}
      ${s.summary ? `<button class="btn" data-file="${esc(s.summary.abs)}" data-kind="doc">Read ${esc(s.summary.file.split('/').pop())}</button>` : ''}
    </div>
    ${EXT.spaceTop.map((f) => { try { return f(s) || ''; } catch (e) { console.error(e); return ''; } }).join('')}
    <div class="cols space-top">
      <div>
        ${s.summary?.excerpt ? `<div class="section"><div class="section-head"><h2>About</h2><span class="mono">${esc(s.summary.file.split('/').slice(-2).join('/'))}</span></div><p class="about">${esc(s.summary.excerpt)}</p></div>` : ''}
        <div class="section"><div class="section-head"><h2>Activity</h2><span class="mono">14 days · updated ${ago(s.last)}</span></div><div style="padding-top:14px">${bars(s.days, s.color, true)}</div></div>
      </div>
      <div>
        ${connectionsBlock(s)}
        ${skills.length ? `<div class="section"><div class="section-head"><h2>Skills</h2><span class="mono">${skills.length}</span></div>
          ${skills.map((k) => `<button class="skill" ${k.file ? `data-file="${esc(k.file)}" data-kind="doc"` : ''}><b>/${esc(k.id)}</b><p>${esc(k.description || k.origin)}</p></button>`).join('')}</div>` : ''}
      </div>
    </div>
    <div class="space-extras">${EXT.spaceExtras.map((f) => { try { return f(s) || ''; } catch (e) { console.error(e); return ''; } }).join('')}</div>
    <details class="more">
      <summary><span>Files and sources</span><span class="mono">${fmt(s.files)} files in ${s.sources.length} ${s.sources.length === 1 ? 'folder' : 'folders'}, read-only</span></summary>
      <div class="section"><div class="section-head"><h2>Recent work</h2><span class="mono">click to preview</span></div>${fileRows(s.recent)}</div>
      <div class="section"><div class="section-head"><h2>Sources</h2><span class="mono">read-only</span></div>
        ${s.sources.map((x) => `<button class="row src-row" data-act="reveal" data-path="${esc(x.abs)}"><span class="p">${esc(x.path)}${x.folders > 1 ? ` <span class="muted">(${x.folders} folders)</span>` : ''}</span><span class="num">${x.missing ? 'missing' : fmt(x.files) + ' files'}</span><span class="num">${x.kinds.video || 0} video</span><span class="when">${ago(x.last)}</span></button>`).join('')}
      </div>
      ${s.summary?.links?.length ? `<div class="section"><div class="section-head"><h2>Published</h2><span class="mono">${s.summary.links.length}</span></div>${s.summary.links.slice(0, 6).map((l) => `<a class="link-row" href="${esc(l)}" target="_blank" rel="noopener">${esc(l.replace('https://', ''))}</a>`).join('')}</div>` : ''}
    </details>
    ${editing || O.notes?.[s.id] ? `<div class="section"><div class="section-head"><h2>Notes</h2><span class="mono">saved to AIOS only</span></div><textarea class="notes" data-notes="${s.id}" placeholder="What is next for ${esc(s.name)}?">${esc(O.notes?.[s.id] || '')}</textarea></div>` : ''}
  </div>`;
}

function viewActivity() {
  crumbs(['Activity']);
  const filter = route.filter || 'all';
  const items = S.activity.filter((a) => filter === 'all' || a.space === filter);
  return `<div class="page">
    <div class="eyebrow"><span class="tag">Live</span><span>rescans every 10 seconds</span></div>
    <h1>Activity</h1>
    <p class="lede">The last ${S.activity.length} things that changed, across every space.</p>
    <div class="actions">
      <label class="select"><span class="mono">Space</span><select id="activity-filter">
        <option value="all">All spaces</option>
        ${spaces().map((s) => `<option value="${s.id}" ${filter === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
      </select></label>
    </div>
    <div class="section">${fileRows(items.map((a) => ({ ...a, display: (space(a.space)?.name || '') + '  ·  ' + a.display })))}</div>
  </div>`;
}

function viewSkills() {
  crumbs(['Skills']);
  const q = (route.q || '').toLowerCase();
  const groups = {};
  for (const k of S.skills) if (!q || (k.id + k.description).toLowerCase().includes(q)) (groups[k.origin] ||= []).push(k);
  return `<div class="page">
    <div class="eyebrow"><span class="tag">${S.skills.length}</span><span>installed across ${Object.keys(groups).length || 0} locations</span></div>
    <h1>Skills</h1>
    <p class="lede">Every repeatable workflow the OS can run. Click one to read exactly what it does.</p>
    <input class="search" id="skill-q" placeholder="Filter skills" value="${esc(route.q || '')}">
    ${Object.entries(groups).map(([g, ks]) => `<div class="section"><div class="section-head"><h2>${esc(g)}</h2><span class="mono">${ks.length}</span></div><div class="skill-grid">${ks.map((k) => `<button class="skill" data-file="${esc(k.file)}" data-kind="doc"><b>/${esc(k.id)}</b><p>${esc(k.description)}</p></button>`).join('')}</div></div>`).join('') || '<div class="empty">No matches.</div>'}
  </div>`;
}

function viewNew() {
  crumbs(['Spaces', 'New']);
  return `<div class="page">
    <div class="eyebrow"><span class="tag">New</span><span>points at folders, never moves them</span></div>
    <h1>New space</h1>
    <p class="lede">Give it a name and the folders it should watch. AIOS indexes them read-only on the next scan.</p>
    <div class="new-space">
      <input class="field" id="ns-name" placeholder="Name, e.g. Client Work">
      <input class="field" id="ns-tag" placeholder="One line on what it is">
      <input class="field" id="ns-paths" placeholder="Folders, comma separated, e.g. ~/Projects/clients">
      <div><button class="btn primary" id="ns-create">Create space</button></div>
    </div>
  </div>`;
}

function renderMain() {
  const scroll = $('#main').scrollTop;
  const sameView = renderMain.last === JSON.stringify(route);
  const v = { agents: viewAgents, brain: viewBrain, home: viewHome, activity: viewActivity, skills: viewSkills, new: viewNew }[route.view] || EXT.views[route.view]?.render;
  $('#main').innerHTML = v ? v() : viewSpace(route.id);
  $('#main').classList.toggle('still', sameView);
  if (route.view === 'brain' && typeof drawBrain === 'function') drawBrain(!sameView);
  try { EXT.views[route.view]?.after?.(sameView); } catch (e) { console.error(e); }
  if (sameView) $('#main').scrollTop = scroll;
  else reveal($('#main .page'));
  renderMain.last = JSON.stringify(route);
  syncMode();
  if (editing && route.view === 'space') $('#main').querySelectorAll('[data-edit]').forEach((el) => (el.contentEditable = 'true'));
}

// The reveal: words rise 0.3em out of a 6px blur, 40ms apart; the rest of the page follows.
function reveal(page) {
  if (!page) return;
  const h = page.querySelector('h1');
  if (h && !h.isContentEditable && !editing) {
    const words = h.textContent.trim().split(/\s+/);
    h.innerHTML = words.map((w, i) => `<span class="rv" style="animation-delay:${120 + i * 40}ms">${esc(w)}</span>`).join(' ');
  }
  const kids = [...page.children].filter((el) => el.tagName !== 'H1');
  kids.forEach((el, i) => { el.classList.add('rise'); el.style.animationDelay = `${Math.min(60 + i * 60, 600)}ms`; });
}
function render() { syncMode(); renderRail(); renderMain(); renderSide(); }

function go(view, extra = {}) {
  route = { view, ...extra };
  location.hash = view === 'space' ? `space/${extra.id}` : view === 'brain' && extra.id ? `brain/${extra.id}` : view;
  closeDrawer();
  render();
  $('#main').scrollTop = 0;
}

// ---------- events ----------
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-go],[data-file],[data-act],[data-copy],[data-filter],[data-color],[data-hide]');
  if (!t) return;
  if (t.dataset.go) return go(t.dataset.go, t.dataset.id ? { id: t.dataset.id } : {});
  if (t.dataset.file) return openFile(t.dataset.file, t.dataset.kind);
  if (t.dataset.act && t.dataset.path) return act(t.dataset.act, t.dataset.path);
  if (t.dataset.copy) { await navigator.clipboard.writeText(t.dataset.copy); return toast('Copied. Paste in a terminal to start Claude here.'); }
  if (t.dataset.filter) { route.filter = t.dataset.filter; return renderMain(); }
  if (t.dataset.color) { setSpace(route.id, { color: t.dataset.color }); return render(); }
  if (t.hasAttribute('data-hide')) { const s = space(route.id); setSpace(route.id, { hidden: !s.hidden }); return render(); }
});
function setSpace(id, patch) { O.spaces[id] = { ...(O.spaces[id] || {}), ...patch }; save({ spaces: O.spaces }); }

document.addEventListener('focusout', (e) => {
  const el = e.target;
  if (el.dataset?.edit && route.view === 'space') { setSpace(route.id, { [el.dataset.edit]: el.textContent.trim() }); renderRail(); }
});
document.addEventListener('input', (e) => {
  if (e.target.dataset?.notes) { O.notes = { ...O.notes, [e.target.dataset.notes]: e.target.value }; save({ notes: O.notes }, true); }
  if (e.target.id === 'skill-q') { route.q = e.target.value; const pos = e.target.selectionStart; renderMain(); const i = $('#skill-q'); i.focus(); i.setSelectionRange(pos, pos); }
});
document.addEventListener('change', (e) => { if (e.target.hasAttribute?.('data-status')) { setSpace(route.id, { status: e.target.value }); render(); } });
document.addEventListener('keydown', (e) => {
  if (e.target.dataset?.edit && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
});
document.addEventListener('click', async (e) => {
  if (e.target.id !== 'ns-create') return;
  const name = $('#ns-name').value.trim(); const paths = $('#ns-paths').value.split(',').map((p) => p.trim()).filter(Boolean);
  if (!name || !paths.length) return toast('Add a name and at least one folder');
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const custom = [...(O.custom || []).filter((c) => c.id !== id), { id, name, tagline: $('#ns-tag').value.trim() || 'Custom space', color: SPACE_COLORS[(O.custom || []).length % SPACE_COLORS.length], status: 'New', sources: paths, skills: [] }];
  O.custom = custom;
  await fetch('/api/overrides', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(O) });
  toast('Indexing ' + name);
  await fetch('/api/rescan', { method: 'POST' });
  firstLoad = true; await load(); go('space', { id });
});

$('#toggle-edit').addEventListener('click', () => {
  editing = !editing;
  document.body.classList.toggle('editing', editing);
  $('#toggle-edit').setAttribute('aria-pressed', editing);
  $('#toggle-edit').textContent = editing ? 'Done' : 'Edit';
  toast(editing ? 'Edit mode: rename, recolor, drag to reorder' : 'Saved');
  render();
});

// ---------- drawer ----------
let drawerPath = null;
async function openFile(path, kind) {
  drawerPath = path;
  const name = path.split('/').pop();
  $('#drawer-name').textContent = name;
  $('#drawer-path').textContent = path.replace(/^\/Users\/[^/]+/, '~');
  $('#drawer-kind').textContent = KIND_LABEL[kind] || 'FILE';
  const body = $('#drawer-body');
  const raw = '/raw' + path.split('/').map(encodeURIComponent).join('/');
  body.innerHTML = '<div class="empty" style="padding:24px">Loading</div>';
  $('#drawer').classList.add('open');
  $('#drawer').querySelectorAll('.drawer-actions [data-act]').forEach((b) => (b.style.display = ''));
  if (kind === 'page') body.innerHTML = `<iframe src="${raw}" sandbox="allow-scripts allow-popups"></iframe>`;
  else if (kind === 'image') body.innerHTML = `<img src="${raw}" alt="">`;
  else if (kind === 'video') body.innerHTML = `<video src="${raw}" controls autoplay muted playsinline></video>`;
  else if (kind === 'audio') body.innerHTML = `<audio src="${raw}" controls style="margin:24px;width:calc(100% - 48px)"></audio>`;
  else if (/\.pdf$/i.test(path)) body.innerHTML = `<iframe src="${raw}"></iframe>`;
  else {
    const r = await fetch('/api/text?path=' + encodeURIComponent(path));
    const j = await r.json();
    if (j.error) { body.innerHTML = `<div class="empty" style="padding:24px">${esc(j.error)}</div>`; return; }
    if (/\.md$/i.test(path)) body.innerHTML = `<div class="md">${markdown(j.text)}</div>`;
    else if (/\.(zip|psd|aep|prproj|blend|mogrt)$/i.test(path)) body.innerHTML = `<div class="empty" style="padding:24px">Binary project file. Use Open to launch it in its app.</div>`;
    else body.innerHTML = `<pre>${esc(j.text)}${j.truncated ? '\n\n[truncated]' : ''}</pre>`;
  }
}
function closeDrawer() { $('#drawer').classList.remove('open'); setTimeout(() => { if (!$('#drawer').classList.contains('open')) $('#drawer-body').innerHTML = ''; }, 350); }
$('#drawer-close').addEventListener('click', closeDrawer);
$('#drawer').addEventListener('click', (e) => { const b = e.target.closest('.drawer-actions [data-act]'); if (b && drawerPath) { e.stopPropagation(); act(b.dataset.act, drawerPath); } }, true);

// ---------- markdown (small, enough for READMEs and SKILL.md) ----------
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="muted">$1</span>');
}
function markdown(src) {
  const lines = src.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n');
  let out = '', i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out += `<pre><code>${esc(buf.join('\n'))}</code></pre>`; continue; }
    const h = l.match(/^(#{1,4})\s+(.*)/); if (h) { out += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out += '<hr>'; i++; continue; }
    if (/^\|/.test(l)) { const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]); out += '<table>' + rows.filter((r) => !/^\|[\s:|-]+\|$/.test(r)).map((r, ri) => '<tr>' + r.replace(/^\||\|$/g, '').split('|').map((c) => (ri ? `<td>${inline(c.trim())}</td>` : `<th>${inline(c.trim())}</th>`)).join('') + '</tr>').join('') + '</table>'; continue; }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) { const ordered = /^\s*\d+\./.test(l); const buf = []; while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, '')); out += `<${ordered ? 'ol' : 'ul'}>${buf.map((b) => `<li>${inline(b)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`; continue; }
    if (/^>\s?/.test(l)) { const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, '')); out += `<blockquote>${inline(buf.join(' '))}</blockquote>`; continue; }
    if (!l.trim()) { i++; continue; }
    const buf = []; while (i < lines.length && lines[i].trim() && !/^(#|```|\||\s*[-*]\s|\s*\d+\.\s|>)/.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) buf.push(lines[i++]);
    out += `<p>${inline(buf.join(' '))}</p>`;
  }
  return out;
}

// ---------- palette ----------
let palItems = [], palSel = 0;
function openPalette() { $('#palette').classList.add('open'); $('#palette-input').value = ''; renderPalette(''); $('#palette-input').focus(); }
function closePalette() { $('#palette').classList.remove('open'); }
function renderPalette(q) {
  q = q.toLowerCase();
  const cmds = [
    { k: 'GO', t: 'Home', run: () => go('home') },
    { k: 'GO', t: 'Activity', run: () => go('activity') },
    { k: 'GO', t: 'Skills', run: () => go('skills') },
    { k: 'GO', t: 'Brain: how everything connects', run: () => go('brain') },
    { k: 'GO', t: 'Agents: network, roster, live calls', run: () => go('agents') },
    ...(S.config.clickup && S.config.agentRuns ? [{ k: 'AGENT', t: 'Run the ClickUp crew', s: 'three agents, read-only', run: () => startRun('crew') }] : []),
    ...(S.config.agentRuns ? [{ k: 'AGENT', t: 'Ask AIOS', s: 'read-only Claude agent', run: () => openAsk() }] : []),
    { k: 'DO', t: editing ? 'Finish editing' : 'Edit the OS', run: () => $('#toggle-edit').click() },
    { k: 'DO', t: 'Toggle dark mode', run: () => { O.appearance = { ...O.appearance, theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' }; applyAppearance(); save({ appearance: O.appearance }, true); } },
    { k: 'DO', t: 'Rescan everything', run: async () => { toast('Rescanning'); await fetch('/api/rescan', { method: 'POST' }); await load(); render(); toast(`Scanned ${fmt(S.totals.files)} files in ${S.scanMs}ms`); } },
    ...spaces().map((s) => ({ k: 'SPACE', t: s.name, s: s.tagline, run: () => go('space', { id: s.id }) })),
    ...S.skills.map((k) => ({ k: 'SKILL', t: '/' + k.id, s: k.origin, run: () => openFile(k.file, 'doc') })),
    ...S.activity.map((a) => ({ k: KIND_LABEL[a.kind], t: a.name, s: space(a.space)?.name, run: () => openFile(a.path, a.kind) })),
  ];
  if (q.length > 3 && S.config.agentRuns) cmds.unshift({ k: 'ASK', t: `Ask AIOS: "${q}"`, s: 'live agent', run: () => { openAsk(); setTimeout(() => startRun('ask', q), 400); } });
  palItems = (q ? cmds.filter((c) => (c.t + ' ' + (c.s || '')).toLowerCase().includes(q)) : cmds).slice(0, 40);
  palSel = 0; drawPalette();
}
function drawPalette() {
  $('#palette-list').innerHTML = palItems.map((c, i) => `<button class="pal-item" data-pi="${i}" aria-selected="${i === palSel}"><span class="k">${c.k}</span><span>${esc(c.t)}</span><span class="s">${esc(c.s || '')}</span></button>`).join('') || '<div class="empty" style="padding:12px">No matches</div>';
  $('#palette-list [aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
}
$('#palette-input').addEventListener('input', (e) => renderPalette(e.target.value));
$('#palette-list').addEventListener('click', (e) => { const b = e.target.closest('[data-pi]'); if (b) { closePalette(); palItems[b.dataset.pi].run(); } });
$('#palette').addEventListener('click', (e) => { if (e.target.id === 'palette') closePalette(); });
$('#open-palette').addEventListener('click', openPalette);
document.addEventListener('click', (e) => { if (e.target.closest('#home-search')) openPalette(); });
document.addEventListener('change', (e) => { if (e.target.id === 'activity-filter') { route.filter = e.target.value; renderMain(); } });

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#palette').classList.contains('open') ? closePalette() : openPalette(); return; }
  if ($('#palette').classList.contains('open')) {
    if (e.key === 'ArrowDown') { palSel = Math.min(palItems.length - 1, palSel + 1); drawPalette(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { palSel = Math.max(0, palSel - 1); drawPalette(); e.preventDefault(); }
    if (e.key === 'Enter' && palItems[palSel]) { closePalette(); palItems[palSel].run(); }
    if (e.key === 'Escape') closePalette();
    return;
  }
  if (e.key === 'Escape') { closeDrawer(); $('#appearance').classList.remove('open'); $('#toggle-appearance').setAttribute('aria-pressed', 'false'); return; }
  const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[1-9]$/.test(e.key)) { const s = spaces()[Number(e.key) - 1]; if (s) go('space', { id: s.id }); }
  if (e.key === '0') go('home');
  if (e.key === 'e') $('#toggle-edit').click();
});

// ---------- misc ----------
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); }
function tick() { $('#clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
setInterval(tick, 15000); tick();

function routeFromHash() {
  const h = location.hash.slice(1);
  if (h.startsWith('space/')) return { view: 'space', id: h.slice(6) };
  if (h.startsWith('brain/')) return { view: 'brain', id: h.slice(6) };
  if (['activity', 'skills', 'home', 'new', 'brain', 'agents'].includes(h) || EXT.views[h]) return { view: h };
  return { view: 'home' };
}
route = routeFromHash();
window.addEventListener('hashchange', () => {
  const r = routeFromHash();
  if (JSON.stringify({ view: r.view, id: r.id }) !== JSON.stringify({ view: route.view, id: route.id }) && S) { route = r; closeDrawer(); render(); }
});
load();
setInterval(load, 5000);
