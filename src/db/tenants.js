// Platform-level queries: hotels (tenants) and the host names that serve them.
// These are the only queries that are not scoped to one tenant, because they are how a tenant is found.
import { nowIso, addDays, today } from '../lib/time.js';

export const ROOT_DOMAIN = 'visit2.ge';
export const TRIAL_DAYS = 30;

// slugs become subdomains: lower-case latin letters, digits and single hyphens, 3–40 characters
const SLUG = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$/;
// names we keep for the platform itself
const RESERVED = new Set(['www', 'app', 'api', 'admin', 'mail', 'static', 'cdn', 'help', 'support', 'blog', 'status', 'dev', 'test', 'staging']);
export const validSlug = s => typeof s === 'string' && SLUG.test(s) && !RESERVED.has(s);

export const normHost = h => String(h || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');

const rowToTenant = r => r && ({
  id: r.id, slug: r.slug, name: r.name, city: r.city, status: r.status, plan: r.plan,
  trialEnds: r.trial_ends, pausedUntil: r.paused_until, created: r.created,
});

// ---------- lookup with a short in-memory cache (one Worker instance serves many requests) ----------
const CACHE_MS = 60e3;
const cache = new Map(); // host -> { t, at }
export const clearTenantCache = () => cache.clear();

export async function tenantByHost(db, host) {
  host = normHost(host);
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.t;
  const r = await db.prepare(
    'SELECT t.* FROM domains d JOIN tenants t ON t.id = d.tenant_id WHERE d.host = ?'
  ).bind(host).first();
  const t = rowToTenant(r) || null;
  cache.set(host, { t, at: Date.now() });
  return t;
}

export async function tenantBySlug(db, slug) {
  return rowToTenant(await db.prepare('SELECT * FROM tenants WHERE slug = ?').bind(slug).first()) || null;
}

export async function tenantById(db, id) {
  return rowToTenant(await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(id).first()) || null;
}

// ---------- create ----------
// Mountain-resort seasons, as at Villa JIJI. Lower sort wins where seasons overlap.
export const MOUNTAIN_SEASONS = [
  { id: 'peak', name: 'ახალი წელი', from: '12-25', to: '01-07' },
  { id: 'winter', name: 'ზამთარი', from: '12-01', to: '03-31' },
  { id: 'summer', name: 'ზაფხული', from: '06-01', to: '08-31' },
  { id: 'off', name: 'დანარჩენი', from: '01-01', to: '12-31' },
];

export async function createTenant(db, { slug, name, city = null, seasons = MOUNTAIN_SEASONS }) {
  if (!validSlug(slug)) throw new Error('bad slug');
  if (!name || !String(name).trim()) throw new Error('name required');
  const id = crypto.randomUUID();
  const now = nowIso();
  const st = [
    db.prepare('INSERT INTO tenants (id, slug, name, city, status, trial_ends, created) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, slug, String(name).trim(), city, 'trial', addDays(today(), TRIAL_DAYS), now),
    db.prepare('INSERT INTO domains (host, tenant_id, kind, verified, created) VALUES (?, ?, ?, 1, ?)')
      .bind(`${slug}.${ROOT_DOMAIN}`, id, 'sub', now),
    ...seasons.map((s, i) => db.prepare('INSERT INTO seasons (tenant_id, id, name, from_md, to_md, sort) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, s.id, s.name, s.from, s.to, i)),
  ];
  await db.batch(st); // one transaction: a slug clash leaves nothing behind
  clearTenantCache();
  return tenantById(db, id);
}

// every hotel, for daily maintenance jobs
export async function allTenants(db) {
  const r = await db.prepare('SELECT * FROM tenants').all();
  return (r.results || []).map(rowToTenant);
}
