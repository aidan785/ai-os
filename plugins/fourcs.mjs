// Four Cs: Context, Connections, Capabilities, Cadence.
// Read-only: lists your context files, counts memories and decisions, and maps the connection buckets in the config to real tools.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const name = 'fourcs';
export const every = 60_000;

const lines = async (f) => { try { return (await fsp.readFile(f, 'utf8')).split('\n').length; } catch { return 0; } };
const mtime = async (f) => { try { return (await fsp.stat(f)).mtimeMs; } catch { return 0; } };
const count = async (d, re = /./) => { try { return (await fsp.readdir(d)).filter((f) => re.test(f)).length; } catch { return 0; } };

export async function scan(ctx) {
  const c = ctx.config.context || {};
  const files = [];
  for (const f of c.files || []) {
    const abs = ctx.expand(f.path);
    if (!fs.existsSync(abs) || ctx.isDenied(abs)) continue;
    ctx.allow(abs);
    files.push({ label: f.label || path.basename(abs), what: f.what || '', path: abs, lines: await lines(abs), mtime: await mtime(abs) });
  }
  // Claude Code keeps auto-memory per project, next to that project's session logs.
  const hubRoot = (ctx.roots()[ctx.config.hub] || [])[0];
  const memDir = c.memory ? ctx.expand(c.memory) : hubRoot ? path.join(ctx.HOME, '.claude', 'projects', ctx.encodeProjectDir(hubRoot), 'memory') : null;
  const memories = memDir ? Math.max(0, (await count(memDir, /\.md$/)) - (fs.existsSync(path.join(memDir, 'MEMORY.md')) ? 1 : 0)) : 0;
  let decisions = 0;
  const decisionsPath = c.decisions ? ctx.expand(c.decisions) : null;
  if (decisionsPath) {
    try { decisions = ((await fsp.readFile(decisionsPath, 'utf8')).match(/^#{2,3} /gm) || []).length; ctx.allow(decisionsPath); } catch {}
  }
  return {
    context: { files, decisions, decisionsPath: decisionsPath && fs.existsSync(decisionsPath) ? decisionsPath : null, memories },
    buckets: ctx.config.connections || [],
  };
}
