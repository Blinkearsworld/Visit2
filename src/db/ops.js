// Visit2's own admin (/ops): every hotel at a glance and a to-do list.
// Only people marked platform = 1 in users may use it. Guests' personal data is not read here.
import { nowIso, addDays, today } from '../lib/time.js';
import { normEmail, hashPw, same, hmac, newSalt } from './users.js';
import { forgetTenants } from './tenants.js';

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

// ---------- managing one hotel: services, payments, status, help access ----------
// Every change here is written to the hotel's own journal (actlog) as "Visit2", so the hotel sees what we did.

export const ADDONS = { catalog: 20, domain: 10 };            // GEL a month on top of the system (50)
export const BASE_PRICE = 50, PAUSE_PRICE = 10;
const STATUSES = ['trial', 'active', 'paused', 'closed'];
const day = v => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);
const note = (db, t, me, op, detail) => db.prepare('INSERT INTO actlog (tenant_id, at, uid, who, op, target, detail, ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  .bind(t.id, nowIso(), me.id, 'Visit2 · ' + me.name, op, 'visit2', String(detail).slice(0, 300), '');

// what one hotel looks like from Visit2's side; no guests' names or phones
export async function hotelDetail(db, t) {
  const since = addDays(today(), -30);
  const [team, req, conf, pays, acc, photo, log] = await Promise.all([
    db.prepare('SELECT u.name, u.email, u.last_login, m.role, m.active FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = ? ORDER BY m.created').bind(t.id).all(),
    db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE tenant_id = ? AND source != 'admin' AND created >= ?").bind(t.id, since).first(),
    db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE tenant_id = ? AND status = 'confirmed' AND created >= ?").bind(t.id, since).first(),
    db.prepare('SELECT id, amount, until, method, note, by_user, created FROM subscriptions WHERE tenant_id = ? ORDER BY created DESC').bind(t.id).all(),
    db.prepare('SELECT until FROM support_access WHERE tenant_id = ?').bind(t.id).first(),
    db.prepare('SELECT v FROM site_content WHERE tenant_id = ? ORDER BY id DESC LIMIT 1').bind(t.id).first(),
    db.prepare("SELECT at, who, op, detail FROM actlog WHERE tenant_id = ? AND target = 'visit2' ORDER BY at DESC LIMIT 20").bind(t.id).all(),
  ]);
  let site = {}; try { site = JSON.parse(photo?.v || '{}').site || {}; } catch (e) { /* none */ }
  const team2 = (team.results || []).map(x => ({ name: x.name, email: x.email, owner: x.role === 'owner', active: !!x.active, lastLogin: x.last_login }));
  return {
    slug: t.slug, name: t.name, city: t.city, status: t.status, trialEnds: t.trialEnds, pausedUntil: t.pausedUntil, paidUntil: t.paidUntil, addons: t.addons, created: t.created,
    monthly: t.status === 'paused' ? PAUSE_PRICE : BASE_PRICE + t.addons.reduce((s, a) => s + (ADDONS[a] || 0), 0),
    team: team2, lastLogin: team2.map(x => x.lastLogin).filter(Boolean).sort().pop() || null,
    requests30: req?.n || 0, confirmed30: conf?.n || 0,
    site: { photo: !!site.hero?.img, about: !!site.about?.text, gallery: (site.gallery || []).length, pin: !!site.pin, theme: site.theme || 'opal' },
    payments: pays.results || [], helpUntil: acc?.until > Date.now() ? acc.until : null, ourLog: log.results || [],
  };
}

export async function setStatus(db, t, me, status, pausedUntil) {
  if (!STATUSES.includes(status)) throw new Error('ასეთი მდგომარეობა არ არის');
  const pu = status === 'paused' ? day(pausedUntil) : null;
  if (status === 'paused' && !pu) throw new Error('ჩაწერე, რა დღემდეა პაუზა');
  await db.batch([db.prepare('UPDATE tenants SET status = ?, paused_until = ? WHERE id = ?').bind(status, pu, t.id),
    note(db, t, me, 'მდგომარეობა', { trial: 'საცდელი', active: 'ჩართული', paused: 'პაუზა ' + pu + '-მდე', closed: 'გამორთული' }[status])]);
  forgetTenants();
}
export async function extendTrial(db, t, me, days) {
  const n = Math.round(+days); if (!(n >= 1 && n <= 180)) throw new Error('დღეები 1-დან 180-მდე');
  const from = t.trialEnds && t.trialEnds > today() ? t.trialEnds : today(), until = addDays(from, n);
  await db.batch([db.prepare("UPDATE tenants SET trial_ends = ?, status = CASE WHEN status = 'closed' THEN status ELSE 'trial' END WHERE id = ?").bind(until, t.id),
    note(db, t, me, 'საცდელი პერიოდი', `გაგრძელდა ${until}-მდე`)]);
  forgetTenants();
  return until;
}
export async function setAddons(db, t, me, list) {
  const a = Object.keys(ADDONS).filter(k => (list || []).includes(k));
  await db.batch([db.prepare('UPDATE tenants SET addons = ? WHERE id = ?').bind(JSON.stringify(a), t.id),
    note(db, t, me, 'სერვისები', a.length ? a.map(k => ({ catalog: 'კატალოგი', domain: 'საკუთარი დომენი' }[k])).join(', ') : 'მხოლოდ სისტემა')]);
  forgetTenants();
}
// a payment entered by hand (bank transfer, cash) moves "paid until" forward and turns the service on
export async function addPayment(db, t, me, { amount, until, method, note: n }) {
  const amt = Math.round(+amount), u = day(until);
  if (!(amt > 0 && amt < 100000)) throw new Error('ჩაწერე თანხა');
  if (!u) throw new Error('ჩაწერე, რა დღემდე ფარავს გადახდა');
  const m = ['bank', 'stripe', 'cash', 'other'].includes(method) ? method : 'bank';
  const paid = t.paidUntil && t.paidUntil > u ? t.paidUntil : u;
  await db.batch([
    db.prepare('INSERT INTO subscriptions (tenant_id, id, amount, until, method, note, by_user, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(t.id, crypto.randomUUID(), amt, u, m, String(n || '').slice(0, 200), me.name, nowIso()),
    db.prepare("UPDATE tenants SET paid_until = ?, status = CASE WHEN status IN ('trial', 'closed') THEN 'active' ELSE status END WHERE id = ?").bind(paid, t.id),
    note(db, t, me, 'გადახდა', `${amt}₾, ${u}-მდე`),
  ]);
  forgetTenants();
}
export async function deletePayment(db, t, me, id) {
  const p = await db.prepare('SELECT amount, until FROM subscriptions WHERE tenant_id = ? AND id = ?').bind(t.id, id).first();
  if (!p) throw new Error('ასეთი გადახდა არ არის');
  await db.prepare('DELETE FROM subscriptions WHERE tenant_id = ? AND id = ?').bind(t.id, id).run();
  const last = await db.prepare('SELECT MAX(until) AS u FROM subscriptions WHERE tenant_id = ?').bind(t.id).first();
  await db.batch([db.prepare('UPDATE tenants SET paid_until = ? WHERE id = ?').bind(last?.u || null, t.id), note(db, t, me, 'გადახდა წაიშალა', `${p.amount}₾, ${p.until}`)]);
  forgetTenants();
}
// a new password for the hotel's owner, shown once to Visit2 to pass on; every device is signed out
export async function resetOwnerPassword(db, t, me) {
  const o = await db.prepare("SELECT u.id FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = ? AND m.role = 'owner' LIMIT 1").bind(t.id).first();
  if (!o) throw new Error('ამ სასტუმროს მფლობელი არ ჰყავს');
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(12));
  const pw = [...r].map(b => abc[b % abc.length]).join('').replace(/(.{4})(?=.)/g, '$1-');
  const salt = newSalt();
  await db.batch([db.prepare('UPDATE users SET salt = ?, hash = ?, ver = ver + 1 WHERE id = ?').bind(salt, await hashPw(pw, salt), o.id),
    note(db, t, me, 'პაროლი', 'მფლობელის პაროლი შეიცვალა')]);
  return pw;
}
// help access: given by the hotel's owner in their admin, for a limited time
export async function helpUntil(db, t) {
  const r = await db.prepare('SELECT until FROM support_access WHERE tenant_id = ?').bind(t.id).first();
  return r && r.until > Date.now() ? r.until : null;
}
export async function grantHelp(db, t, who, hours) {
  const h = [0, 24, 72, 168].includes(+hours) ? +hours : 24;
  if (!h) { await db.prepare('DELETE FROM support_access WHERE tenant_id = ?').bind(t.id).run(); return null; }
  const until = Date.now() + h * 3600e3;
  await db.prepare('INSERT INTO support_access (tenant_id, until, granted_by, granted_at) VALUES (?, ?, ?, ?) ON CONFLICT (tenant_id) DO UPDATE SET until = excluded.until, granted_by = excluded.granted_by, granted_at = excluded.granted_at')
    .bind(t.id, until, who, nowIso()).run();
  return until;
}
// removes a hotel and everything it has; only a switched-off hotel, and only when its slug is typed again
const HOTEL_TABLES = ['settings', 'seasons', 'types', 'rooms', 'bookings', 'payments', 'guest_notes', 'convos', 'site_content', 'media', 'actlog', 'subscriptions', 'support_access', 'meta_pages', 'domains', 'memberships'];
export async function deleteHotel(db, t, confirm) {
  if (t.status !== 'closed') throw new Error('ჯერ სასტუმრო გამორთე, მერე წაშალე');
  if (confirm !== t.slug) throw new Error(`დასადასტურებლად ჩაწერე: ${t.slug}`);
  await db.batch([...HOTEL_TABLES.map(x => db.prepare(`DELETE FROM ${x} WHERE tenant_id = ?`).bind(t.id)), db.prepare('DELETE FROM tenants WHERE id = ?').bind(t.id)]);
  forgetTenants();
}

// ---------- notices to every hotel's admin ----------
export async function listNotices(db, { current = false } = {}) {
  const r = current
    ? await db.prepare('SELECT * FROM notices WHERE date_to >= ? ORDER BY date_from').bind(today()).all()
    : await db.prepare('SELECT * FROM notices ORDER BY date_from DESC LIMIT 30').all();
  return (r.results || []).map(x => ({ id: x.id, text: x.text, from: x.date_from, to: x.date_to }));
}
export async function saveNotice(db, { text, from, to }) {
  const t = String(text || '').trim().slice(0, 600), f = day(from), e = day(to);
  if (!t) throw new Error('ჩაწერე ტექსტი');
  if (!f || !e || e < f) throw new Error('ჩაწერე, რა დღიდან რა დღემდე ჩანდეს');
  await db.prepare('INSERT INTO notices (id, text, date_from, date_to, created) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), t, f, e, nowIso()).run();
}
export const deleteNotice = (db, id) => db.prepare('DELETE FROM notices WHERE id = ?').bind(String(id)).run();
