// Guard against the worst multi-tenant bug: a query on a hotel table without tenant_id.
// Rules (see CLAUDE.md):
//   1. SQL is written only in src/db/.
//   2. Every SQL string there that names a table with a tenant_id column must also mention tenant_id.
// The table list is read from the migrations, so a new hotel table is covered automatically.
// Run: node scripts/check-sql.mjs (part of npm test).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

// tables that have a tenant_id column, from every migration
const tenantTables = new Set();
for (const f of walk(join(root, 'migrations')).filter(f => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(f, 'utf8');
  for (const m of sql.matchAll(/CREATE TABLE (\w+)\s*\(([\s\S]*?)\n\);/g)) if (/\btenant_id\b/.test(m[2])) tenantTables.add(m[1]);
  for (const m of sql.matchAll(/ALTER TABLE (\w+) ADD COLUMN tenant_id\b/g)) tenantTables.add(m[1]);
}
// Platform tables that are looked up before a tenant is known. Each query on them is reviewed by hand.
const PLATFORM = new Set(['domains', 'memberships', 'meta_pages']);

const SQL_START = /^\s*(SELECT|INSERT|UPDATE|DELETE|REPLACE|WITH)\s+\S/i;
const strings = src => [...src.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map(m => m[2]);
const tablesIn = s => [...s.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+(\w+)/gi)].map(m => m[1]);

const problems = [];
for (const f of walk(join(root, 'src')).filter(f => f.endsWith('.js'))) {
  const rel = relative(root, f);
  for (const s of strings(readFileSync(f, 'utf8'))) {
    if (!SQL_START.test(s)) continue;
    if (!rel.startsWith('src/db/')) { problems.push(`${rel}: SQL outside src/db/: ${s.slice(0, 70)}`); continue; }
    const hit = tablesIn(s).filter(t => tenantTables.has(t) && !PLATFORM.has(t));
    if (hit.length && !/\btenant_id\b/.test(s)) problems.push(`${rel}: no tenant_id in a query on ${hit.join(', ')}: ${s.slice(0, 70)}`);
  }
}

if (problems.length) {
  console.error('SQL check failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`SQL check: ok (${tenantTables.size} tenant tables)`);
