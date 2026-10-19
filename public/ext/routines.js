// Routines (Cadence): every scheduled job, today's timeline, last run and a live countdown to the next one.
(() => {
  const R = () => (Array.isArray(S?.ext?.routines) ? S.ext.routines : []);
  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function human(cron) {
    const [m, h, dom, , dw] = cron.split(/\s+/);
    if (m.startsWith('*/')) return `Every ${m.slice(2)} min`;
    if (h === '*') return 'Hourly';
    if (h.startsWith('*/')) return `Every ${h.slice(2)} hours`;
    const t = new Date(2000, 0, 1, +h.split(',')[0], +m.split(',')[0]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (dom !== '*') return `Monthly on day ${dom}, ${t}`;
    if (dw === '*') return `Daily ${t}`;
    if (dw === '1-5') return `Weekdays ${t}`;
    const days = dw.split(',').map((d) => DOW[+d % 7]).filter(Boolean);
    return days.length === 1 ? `${days[0]}s ${t}` : `${days.map((d) => d.slice(0, 3)).join(', ')} ${t}`;
  }
  const until = (t) => {
    if (!t) return 'not scheduled';
    const s = Math.max(0, Math.round((t - Date.now()) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(x).padStart(2, '0')}`;
  };
  const clock = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sod = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const pctOfDay = (t) => ((t - sod()) / 864e5) * 100;
  const spaceName = (id) => space(id)?.name || id || '';
  const statusLabel = { ok: 'Ran on time', stalled: 'Missed its last run', never: 'No run logged yet', scheduled: 'Scheduled' };

  function lanes(rs) {
    const hours = [0, 3, 6, 9, 12, 15, 18, 21, 24];
    return `<div class="mx-lanes">
      <div class="mx-lane head"><span></span><div class="mx-track">${hours.map((h) => `<span class="mx-hour mono" style="left:${(h / 24) * 100}%">${h === 24 ? '' : h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : h - 12 + 'p'}</span>`).join('')}</div></div>
      ${rs.map((r) => `<div class="mx-lane"><span class="mx-lane-name">${esc(r.name)}</span><div class="mx-track">${hours.map((h) => `<i class="mx-grid-line" style="left:${(h / 24) * 100}%"></i>`).join('')}${r.today.map((t) => `<i class="mx-tick ${t <= Date.now() ? (r.status === 'stalled' ? 'missed' : 'done') : 'up'} ${r.today.length > 30 ? 'dense' : ''}" style="left:${pctOfDay(t)}%" title="${esc(r.name)} · ${clock(t)}"></i>`).join('')}</div></div>`).join('')}
      <div class="mx-now" style="--xf:${pctOfDay(Date.now()) / 100}"><span class="mono" data-now-label>${clock(Date.now())}</span></div>
    </div>`;
  }
  function routineRow(r, compactRow) {
    return `<div class="mx-rt ${compactRow ? 'compact' : ''}" data-rt="${esc(r.id)}">
      <div class="mx-rt-main">
        <span class="mx-dot ${r.status}" title="${esc(statusLabel[r.status] || r.status)}"></span>
        <span class="mx-rt-name"><b>${esc(r.name)}</b>${compactRow ? '' : `<span class="muted">${esc(r.what)}</span>`}${r.status === 'stalled' ? `<span class="mx-note">Log not updated since ${esc(ago(r.last))}</span>` : ''}</span>
        ${compactRow ? '' : `<span class="mx-rt-meta mono"><span>${esc(human(r.cron))}</span><span>${esc(r.skill)}</span><span class="mx-rt-space">${esc(spaceName(r.space))}</span></span>`}
        <span class="mx-rt-last mono">${r.last ? `last ran ${ago(r.last)}` : esc(statusLabel[r.status] || '')}</span>
        <span class="mx-rt-next mono"><span class="muted">next</span> <b data-next="${r.next || ''}">${until(r.next)}</b></span>
      </div>
    </div>`;
  }

  function viewRoutines() {
    const rs = R();
    crumbs(['Routines']);
    if (!rs.length) return `<div class="page">
      <div class="eyebrow"><span class="tag">4 · Cadence</span><span>scheduled agents</span></div>
      <h1>Routines</h1>
      <p class="lede">Nothing runs on a schedule yet. Pick one skill you run by hand every day, schedule it, and list it under "routines" in aios.config.json. The setup guide in docs/setup.md shows how.</p>
    </div>`;
    const next = rs.filter((r) => r.next).sort((a, b) => a.next - b.next)[0];
    const ranToday = rs.reduce((a, r) => a + r.today.filter((t) => t <= Date.now()).length, 0);
    const flagged = rs.filter((r) => r.status === 'stalled');
    return `<div class="page">
      <div class="eyebrow"><span class="tag">4 · Cadence</span><span>cron + skill + Claude Code</span></div>
      <h1>Routines</h1>
      <p class="lede"><b>${rs.length}</b> routines keep the OS current. <b>${ranToday}</b> ${ranToday === 1 ? 'run was' : 'runs were'} due so far today.${next ? ` Next up is <b>${esc(next.name)}</b> in <b data-next="${next.next}">${until(next.next)}</b>.` : ''}${flagged.length ? ` ${flagged.length} missed a run.` : ''}</p>
      <div class="section"><div class="section-head"><h2>Today</h2><span class="mono"><i class="mx-key done"></i>due <i class="mx-key up"></i>scheduled <i class="mx-key missed"></i>missed</span></div>${lanes(rs)}</div>
      <div class="section"><div class="section-head"><h2>All routines</h2><span class="mono">last run from each log file · countdown to next</span></div>${rs.map((r) => routineRow(r)).join('')}</div>
    </div>`;
  }
  function routinesExtra(s) {
    const mine = R().filter((r) => r.space === s.id);
    if (!mine.length) return '';
    return `<div class="section"><div class="section-head"><h2>Routines</h2><button class="mono" data-go="routines" style="color:var(--blue-ink)">All routines</button></div>${mine.map((r) => routineRow(r, true)).join('')}</div>`;
  }

  // Live countdowns and the now-marker, without re-rendering.
  setInterval(() => {
    document.querySelectorAll('[data-next]').forEach((el) => { const t = Number(el.dataset.next) || null; el.textContent = until(t); });
    const now = document.querySelector('.mx-now');
    if (now) { now.style.setProperty('--xf', pctOfDay(Date.now()) / 100); const l = now.querySelector('[data-now-label]'); if (l) l.textContent = clock(Date.now()); }
  }, 1000);

  EXT.views.routines = { label: 'Routines', wide: true, count: () => R().length || '', render: viewRoutines };
  EXT.spaceExtras.push(routinesExtra);
})();
