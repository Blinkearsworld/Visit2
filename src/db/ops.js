// Visit2's own admin (/ops): every hotel at a glance and a to-do list.
// Only people marked platform = 1 in users may use it. Guests' personal data is not read here.
import { nowIso, addDays, today } from '../lib/time.js';
import { normEmail, hashPw, same, hmac } from './users.js';

export const OPS_COOKIE = 'v2_ops';
const DAYS = 14;

export async function opsLogin(db, email, password) {
  email = normEmail(email);
  if (!email || typeof password !== 'string' || !password) return null;
  const u = await db.prepare('SELECT id, name, email, salt, hash, ver, platform FROM users WHERE email = ?').bind(email).first();
  if (!u || !u.platform || !u.hash || !same(await hashPw(password, u.salt), u.hash)) return null;
  return { id: u.id, name: u.name, email: u.email, ver: u.ver };
}
export async function opsCookie(secret, u, secure = true) {
  const exp = Date.now() + DAYS * 864e5, body = `${u.id}.${u.ver}.${exp}`;
  return `${OPS_COOKIE}=${body}.${await hmac(secret, 'platform|' + body)}; Path=/; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Strict; Max-Age=${DAYS * 86400}`;
}
export const opsClear = () => `${OPS_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export async function opsUser(db, request, secret) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + OPS_COOKIE + '=([^;]+)'));
  if (!m || !secret) return null;
  const [id, ver, exp, sig] = m[1].split('.');
  if (!sig || !(+exp > Date.now()) || !same(sig, await hmac(secret, `platform|${id}.${ver}.${exp}`))) return null;
  const u = await db.prepare('SELECT id, name, email, ver, platform FROM users WHERE id = ?').bind(id).first();
  return u && u.platform && String(u.ver) === ver ? { id: u.id, name: u.name, email: u.email } : null;
}

// every hotel with its owner's email (for calling), newest first
export async function allHotels(db) {
  const r = await db.prepare(`SELECT t.id, t.slug, t.name, t.city, t.status, t.trial_ends, t.created,
      (SELECT u.email FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = t.id AND m.role = 'owner' LIMIT 1) AS owner
    FROM tenants t ORDER BY t.created DESC`).all();
  return (r.results || []).map(x => ({ slug: x.slug, name: x.name, city: x.city, status: x.status, trialEnds: x.trial_ends, created: x.created, owner: x.owner || '' }));
}

// tasks that come from events by themselves; INSERT OR IGNORE on auto_key keeps them single
export async function autoTasks(db, hotels, day = today()) {
  const st = [];
  for (const h of hotels) {
    if (h.status === 'trial' && h.trialEnds && h.trialEnds >= day && h.trialEnds <= addDays(day, 3))
      st.push(['trial:' + h.slug + ':' + h.trialEnds, 'დაურეკე', h.slug, `უფასო პერიოდი მთავრდება ${h.trialEnds}-ს`, h.trialEnds, h.owner]);
    if (h.created && h.created.slice(0, 10) >= addDays(day, -2))
      st.push(['welcome:' + h.slug, 'მიესალმე და დაეხმარე დაწყებაში', h.slug, 'ახალი რეგისტრაცია', addDays(h.created.slice(0, 10), 1), h.owner]);
  }
  if (!st.length) return;
  await db.batch(st.map(([key, what, hotel, why, due, owner]) => db.prepare(
    'INSERT OR IGNORE INTO tasks (id, what, hotel, why, due, how, auto_key, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), what, hotel, why, due, owner ? `ელფოსტა: ${owner}` : '', key, nowIso())));
}

export async function listTasks(db) {
  const r = await db.prepare("SELECT * FROM tasks WHERE status != 'done' OR done_at > ? ORDER BY CASE status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END, CASE WHEN due = '' THEN 1 ELSE 0 END, due, created")
    .bind(addDays(today(), -14)).all();
  return (r.results || []).map(x => ({ id: x.id, what: x.what, who: x.who, hotel: x.hotel, how: x.how, why: x.why, due: x.due, status: x.status, auto: !!x.auto_key, created: x.created, doneAt: x.done_at }));
}

const STATUS = ['todo', 'doing', 'done'];
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
export async function saveTask(db, x) {
  const what = clip(x.what, 120);
  if (!what) throw new Error('ჩაწერე, რა უნდა გაკეთდეს.');
  const status = STATUS.includes(x.status) ? x.status : 'todo';
  const due = /^\d{4}-\d{2}-\d{2}$/.test(x.due || '') ? x.due : '';
  const f = [what, clip(x.who, 40), clip(x.hotel, 40), clip(x.how, 400), clip(x.why, 200), due, status, status === 'done' ? nowIso() : null];
  if (x.id) {
    await db.prepare('UPDATE tasks SET what = ?, who = ?, hotel = ?, how = ?, why = ?, due = ?, status = ?, done_at = ? WHERE id = ?').bind(...f, x.id).run();
    return x.id;
  }
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO tasks (what, who, hotel, how, why, due, status, done_at, id, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(...f, id, nowIso()).run();
  return id;
}
export const deleteTask = (db, id) => db.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
