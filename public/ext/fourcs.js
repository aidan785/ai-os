// Four Cs view: Context, Connections, Capabilities, Cadence, scored live from what is on disk and in the agent logs.
(() => {
  const F = () => S.ext?.fourcs;
  const routinesList = () => (Array.isArray(S.ext?.routines) ? S.ext.routines : []);
  const connCalls = (label) => (S.agents?.connectors || []).find((c) => c.label === label)?.calls || 0;
  const toolState = (t) => (t.connector && connCalls(t.connector) ? 'live' : t.wired ? 'wired' : 'gap');

  // Each C is worth 25. The weights are a starting point; tune them to what "good" means for you.
  function scores() {
    const f = F(); if (!f) return null;
    const c = f.context;
    const base = (x) => x.path.split(/[\\/]/).pop().toLowerCase();
    const fresh = c.files.find((x) => /priorit/i.test(x.path));
    const ctx = Math.round(
      (c.files.some((x) => base(x) === 'claude.md') ? 5 : 0) + Math.min(5, c.files.length - 1) + Math.min(5, c.memories / 10) + Math.min(5, c.decisions / 15) +
      (fresh ? (Date.now() - fresh.mtime < 7 * 864e5 ? 5 : 3) : 0));
    const covered = f.buckets.map((b) => { const st = (b.tools || []).map(toolState); return st.includes('live') ? 1 : st.includes('wired') ? 0.85 : 0; });
    const con = f.buckets.length ? Math.round((covered.reduce((a, b) => a + b, 0) / f.buckets.length) * 25) : 0;
    const skills = S.skills.length, subs = S.agents?.roster?.total || 0;
    const cap = Math.round(Math.min(14, skills / 4) + Math.min(6, subs / 40) + (S.sessions?.week ? 5 : 0));
    const rs = routinesList();
    const healthy = rs.filter((r) => r.status === 'ok').length;
    const cad = Math.round(Math.min(25, rs.length * 4 + healthy * 2));
    const gaps = [];
    if (!c.files.some((x) => base(x) === 'claude.md')) gaps.push('Add a CLAUDE.md so every session starts with your context');
    f.buckets.forEach((b) => (b.tools || []).filter((t) => toolState(t) === 'gap').forEach((t) => gaps.push(`Connect ${t.name} to bring ${b.name.toLowerCase()} into the OS`)));
    if (!rs.length) gaps.push('Put one skill on a schedule so it runs without you');
    return { ctx, con, cap, cad, total: ctx + con + cap + cad, gaps, skills, subs, routines: rs.length, healthy };
  }

  const ring = (v, max, color, size = 132) => {
    const r = size / 2 - 9, C = 2 * Math.PI * r;
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-val" style="stroke:${color};--C:${C.toFixed(1)};--off:${(C * (1 - v / max)).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  };

  function connectionsHtml(full) {
    const f = F(); if (!f) return '';
    if (!f.buckets.length) return '<div class="empty">No connections listed yet. Add a "connections" section to aios.config.json.</div>';
    const tile = (t) => { const st = toolState(t); const n = t.connector ? connCalls(t.connector) : 0; return `<div class="cx-tool t-${st}">
      <div class="cx-top"><span class="cx-dot"></span><b>${esc(t.name)}</b><span class="cx-how mono">${esc(t.how || '')}</span></div>
      <span class="cx-note">${esc(t.note || '')}</span>${n ? `<span class="cx-calls mono">${fmt(n)} calls this week</span>` : ''}</div>`; };
    return `<div class="cx">${f.buckets.map((b, i) => `<div class="cx-row">
      <div class="cx-head"><span class="cx-n mono">${String(i + 1).padStart(2, '0')}</span><b>${esc(b.name)}</b>${full && b.ask ? `<span class="cx-ask">&ldquo;${esc(b.ask)}&rdquo;</span>` : ''}</div>
      <div class="cx-tools">${(b.tools || []).map(tile).join('')}</div></div>`).join('')}</div>`;
  }

  function contextHtml() {
    const c = F()?.context; if (!c) return '';
    return `<div class="ctx-files">${c.files.map((x) => `<button class="ctx-file" data-file="${esc(x.path)}" data-kind="doc"><b>${esc(x.label)}</b><span>${esc(x.what)}</span><span class="mono muted">${x.lines} lines · ${ago(x.mtime)}</span></button>`).join('')}
      ${c.decisionsPath ? `<button class="ctx-file" data-file="${esc(c.decisionsPath)}" data-kind="doc"><b>Decision log</b><span>Append-only record of what was decided and why</span><span class="mono muted">${c.decisions} decisions</span></button>` : ''}
      ${S.ext?.wiki ? `<a class="ctx-file wiki" href="obsidian://open?path=${encodeURIComponent(S.ext.wiki.path)}"><b>Knowledge wiki</b><span>Every space, skill, agent and connection as linked notes. Opens in Obsidian.</span><span class="mono muted">${S.ext.wiki.pages} pages · ${ago(S.ext.wiki.at)}</span></a>` : ''}
      <div class="ctx-file still"><b>Memory</b><span>Facts Claude saved across sessions</span><span class="mono muted">${c.memories} memories</span></div></div>`;
  }

  const nextRoutine = () => routinesList().filter((r) => r.next).sort((a, b) => a.next - b.next)[0];

  window.fourcsScores = scores;
  window.fourcsConnected = () => (F()?.buckets || []).filter((b) => (b.tools || []).some((t) => toolState(t) !== 'gap')).length;
  window.fourcsRoutines = routinesList;
  EXT.views.os = {
    label: 'Four Cs',
    wide: true,
    count: () => scores()?.total ?? '',
    render() {
      crumbs(['Four Cs']);
      const sc = scores();
      if (!sc) return '<div class="page"><h1>Four Cs</h1><div class="empty">Reading your OS</div></div>';
      const f = F();
      const C = [
        ['Context', sc.ctx, 'What it knows about you', `${f.context.files.length} context files, ${f.context.memories} memories, ${f.context.decisions} decisions`, 'brain', '#0a72b5'],
        ['Connections', sc.con, 'What data it can reach', `${f.buckets.filter((b) => (b.tools || []).some((t) => toolState(t) !== 'gap')).length} of ${f.buckets.length} buckets connected`, 'connections', '#37bdf8'],
        ['Capabilities', sc.cap, 'What it can produce', `${sc.skills} skills, ${fmt(sc.subs)} subagents spawned`, 'agents', '#2dd4bf'],
        ['Cadence', sc.cad, 'When it acts on its own', `${sc.routines} routines on a schedule`, 'routines', '#a78bfa'],
      ];
      const nx = nextRoutine();
      return `<div class="page fourcs-page">
        <div class="eyebrow"><span class="tag">Your AI OS</span><span>the Four Cs, scored live from disk and agent logs</span></div>
        <h1>Context, Connections, Capabilities, Cadence.</h1>
        <p class="lede">Four layers every AI operating system needs, computed from what this machine actually has. <b>${sc.total} out of 100</b> today.</p>
        <div class="audit">
          <div class="audit-total">${ring(sc.total, 100, 'var(--blue-ink)', 188)}<div class="audit-num"><b data-count="${sc.total}">${sc.total}</b><span class="mono">of 100</span></div></div>
          <div class="audit-cs">${C.map(([n, v, sub, ev, go, col], i) => `<button class="c-card" data-go="${go}" style="--cc:${col}">
            <div class="c-ring">${ring(v, 25, col, 96)}<b>${v}</b></div>
            <div class="c-text"><span class="mono muted">${i + 1} · ${v}/25</span><h3>${n}</h3><p>${sub}</p><span class="c-ev">${esc(ev)}</span></div></button>`).join('')}</div>
        </div>
        ${sc.gaps.length ? `<div class="levelup"><span class="mono">next step</span><b>Next to wire up</b><span>${esc(sc.gaps[0])}</span></div>` : ''}
        <div class="group-title"><h2><span class="c-num">1</span>Context</h2><span>loaded into every session</span></div>
        ${contextHtml()}
        <div class="group-title"><h2><span class="c-num">2</span>Connections</h2><span>the tools it can read, by what the business tracks</span></div>
        ${connectionsHtml()}
        <div class="group-title"><h2><span class="c-num">3</span>Capabilities</h2><span>skills and agents</span></div>
        <div class="c-links">
          <button class="c-link" data-go="skills"><b>${sc.skills}</b><span>skills</span></button>
          <button class="c-link" data-go="agents"><b>${fmt(sc.subs)}</b><span>subagents spawned</span></button>
          <button class="c-link" data-go="agents"><b>${S.sessions?.week || 0}</b><span>Claude Code sessions this week</span></button>
        </div>
        <div class="group-title"><h2><span class="c-num">4</span>Cadence</h2><span>what runs while you sleep</span></div>
        <div class="c-links">
          <button class="c-link" data-go="routines"><b>${sc.routines}</b><span>routines</span></button>
          <button class="c-link" data-go="routines"><b>${sc.healthy}</b><span>ran on time</span></button>
          ${nx ? `<button class="c-link" data-go="routines"><b>${esc(new Date(nx.next).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}</b><span>next: ${esc(nx.name)}</span></button>` : ''}
        </div>
      </div>`;
    },
    after(same) {
      if (same) return;
      const b = $('#main .audit-num b'); if (!b) return;
      const to = +b.dataset.count, t0 = performance.now();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const step = (t) => { const k = Math.min(1, (t - t0) / 1100); b.textContent = Math.round(to * (1 - Math.pow(1 - k, 4))); if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    },
  };

  EXT.views.connections = {
    label: 'Connections',
    wide: true,
    count: () => (F() ? F().buckets.filter((b) => (b.tools || []).some((t) => toolState(t) !== 'gap')).length + '/' + F().buckets.length : ''),
    render() {
      crumbs(['Connections']);
      const live = (S.agents?.connectors || []).reduce((a, c) => a + c.calls, 0);
      return `<div class="page">
        <div class="eyebrow"><span class="tag">2 · Connections</span><span>what data the OS can reach</span></div>
        <h1>Everything it can see and touch.</h1>
        <p class="lede">The things every business tracks, each mapped to the tools this OS can read, with a question it can answer once they are connected. Agents made <b>${fmt(live)} connector calls</b> this week.</p>
        <div class="cx-legend mono"><span class="t-live"><span class="cx-dot"></span>used this week</span><span class="t-wired"><span class="cx-dot"></span>connected</span><span class="t-gap"><span class="cx-dot"></span>not connected yet</span></div>
        ${connectionsHtml(true)}
        ${(S.agents?.connectors || []).length ? `<div class="section"><div class="section-head"><h2>Called by your agents this week</h2><span class="mono">from Claude Code logs</span></div>${S.agents.connectors.map((c) => `<div class="row"><span><span class="sw" style="background:${c.color}"></span> ${esc(c.label)}</span><span></span><span></span><span class="when">${fmt(c.calls)} calls</span></div>`).join('')}</div>` : ''}
      </div>`;
    },
  };
})();
