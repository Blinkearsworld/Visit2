// Prints the SQL that creates a hotel with its owner, default seasons and (optionally) sample rooms and prices.
// For the pilot: we set hotels up by hand before self sign-up exists.
//
//   node scripts/new-hotel.mjs --slug villa-x --name "ვილა X" --city ბაკურიანი --email owner@example.com --password 'long pass' [--sample] > x.sql
//   npx wrangler d1 execute DB --local --file x.sql        (or --remote, once the database exists)
//
// The password is hashed here (PBKDF2, as in src/db/users.js); the SQL file holds only the hash. Do not commit these files.
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { MOUNTAIN_SEASONS, validSlug, ROOT_DOMAIN, TRIAL_DAYS } from '../src/db/tenants.js';
import { SAMPLE_TYPES, SAMPLE_ROOMS, DEFAULT_SETTINGS } from '../src/db/hotel.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const need = k => { if (!args[k] || args[k] === true) { console.error(`--${k} is required`); process.exit(1); } return String(args[k]); };

const slug = need('slug'), name = need('name'), email = need('email').trim().toLowerCase(), password = need('password');
const city = args.city && args.city !== true ? String(args.city) : null;
const ownerName = args.owner && args.owner !== true ? String(args.owner) : 'მფლობელი';
if (!validSlug(slug)) { console.error('bad slug: lower-case latin letters, digits and hyphens, 3–40'); process.exit(1); }
if (password.length < 8) { console.error('password: at least 8 characters'); process.exit(1); }

const q = v => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const now = new Date().toISOString();
const trialEnds = new Date(Date.now() + 4 * 3600e3 + TRIAL_DAYS * 864e5).toISOString().slice(0, 10);
const tid = args.id && args.id !== true ? String(args.id) : randomUUID();
const salt = randomBytes(16).toString('hex');
const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');

const out = [
  `-- hotel ${slug} (${name}); owner ${email}`,
  `INSERT INTO tenants (id, slug, name, city, status, trial_ends, created) VALUES (${q(tid)}, ${q(slug)}, ${q(name)}, ${q(city)}, 'trial', ${q(trialEnds)}, ${q(now)});`,
  `INSERT INTO domains (host, tenant_id, kind, verified, created) VALUES (${q(slug + '.' + ROOT_DOMAIN)}, ${q(tid)}, 'sub', 1, ${q(now)});`,
  ...MOUNTAIN_SEASONS.map((s, i) => `INSERT INTO seasons (tenant_id, id, name, from_md, to_md, sort) VALUES (${q(tid)}, ${q(s.id)}, ${q(s.name)}, ${q(s.from)}, ${q(s.to)}, ${i});`),
  // the person may already exist (owner of another hotel): keep their password then
  `INSERT OR IGNORE INTO users (id, email, name, salt, hash, created) VALUES (${q('u' + randomUUID().replace(/-/g, '').slice(0, 11))}, ${q(email)}, ${q(ownerName)}, ${q(salt)}, ${q(hash)}, ${q(now)});`,
  `INSERT INTO memberships (tenant_id, user_id, role, perms, active, created) SELECT ${q(tid)}, id, 'owner', '[]', 1, ${q(now)} FROM users WHERE email = ${q(email)};`,
  ...Object.entries(DEFAULT_SETTINGS).map(([k, v]) => `INSERT INTO settings (tenant_id, k, v) VALUES (${q(tid)}, ${q(k)}, ${q(v)});`),
];
if (args.sample) {
  Object.entries(SAMPLE_TYPES).forEach(([id, t], i) => out.push(`INSERT INTO types (tenant_id, id, name, rates, sort) VALUES (${q(tid)}, ${q(id)}, ${q(t.name)}, ${q(JSON.stringify(t.rates))}, ${i});`));
  SAMPLE_ROOMS.forEach(([id, type], i) => out.push(`INSERT INTO rooms (tenant_id, id, type, sort) VALUES (${q(tid)}, ${q(id)}, ${q(type)}, ${i});`));
}
console.log(out.join('\n'));
