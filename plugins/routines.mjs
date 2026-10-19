// Cadence: the routines that run on a schedule (cron, launchd, Claude Code scheduled tasks, anything).
// You list them in the "routines" section of aios.config.json. AIOS works out when each one runs next from its
// cron expression, and when it last ran from the modification time of its log file. It never runs anything.
import fs from 'node:fs';

export const name = 'routines';
export const every = 30_000;

function parseField(f, min, max) {
  const set = new Set();
  for (const part of f.split(',')) {
    let [range, step] = part.split('/'); step = Number(step || 1);
    let [a, b] = range === '*' ? [min, max] : range.split('-').map(Number);
    if (b === undefined) b = step > 1 ? max : a;
    for (let i = a; i <= b; i += step) set.add(i === 7 && max === 6 ? 0 : i);
  }
  return set;
}

// Times a cron expression fires, walking forward (dir 1) or back (dir -1) from `from`.
export function cronTimes(expr, from, dir, count) {
  const [m, h, dom, mon, dow] = expr.trim().split(/\s+/);
  const M = [...parseField(m, 0, 59)].sort((x, y) => x - y), H = [...parseField(h, 0, 23)].sort((x, y) => x - y);
  const DOM = parseField(dom, 1, 31), MON = parseField(mon, 1, 12), DOW = parseField(dow, 0, 6);
  const out = [];
  const day = new Date(from); day.setHours(0, 0, 0, 0);
  for (let i = 0; i < 400 && out.length < count; i++) {
    const d = new Date(day); d.setDate(day.getDate() + (dir > 0 ? i : -i));
    if (!DOM.has(d.getDate()) || !MON.has(d.getMonth() + 1) || !DOW.has(d.getDay())) continue;
    const slots = [];
    for (const hh of H) for (const mm of M) { const t = new Date(d); t.setHours(hh, mm, 0, 0); slots.push(t.getTime()); }
    if (dir < 0) slots.reverse();
    for (const t of slots) if ((dir > 0 ? t > from : t <= from) && out.length < count) out.push(t);
  }
  return out;
}

export async function scan(ctx) {
  const now = Date.now();
  const sod = new Date(); sod.setHours(0, 0, 0, 0);
  const eod = sod.getTime() + 864e5;
  return (ctx.config.routines || []).map((r) => {
    let today = [], next = null, prev = null;
    try {
      today = cronTimes(r.cron, sod.getTime() - 1, 1, 300).filter((t) => t < eod);
      next = cronTimes(r.cron, now, 1, 1)[0] || null;
      prev = cronTimes(r.cron, now, -1, 1)[0] || null;
    } catch {}
    let last = null;
    if (r.log) { try { last = fs.statSync(ctx.expand(r.log)).mtimeMs; } catch {} }
    // A routine is stalled when its log is older than the last time it should have run (with a 15 minute grace period).
    const status = !r.log ? 'scheduled' : !last ? 'never' : prev && last < prev - 15 * 60e3 ? 'stalled' : 'ok';
    return { id: r.id, name: r.name, cron: r.cron, space: r.space, skill: r.skill || '', what: r.what || '', today, next, last, status };
  });
}
