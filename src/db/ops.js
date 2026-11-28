// Visit2's own admin (/ops): every hotel at a glance and a to-do list.
// Only people marked platform = 1 in users may use it. Guests' personal data is not read here.
import { nowIso, addDays, today } from '../lib/time.js';
import { normEmail, hashPw, same, hmac, newSalt, pwProblem, addMember } from './users.js';
import { forgetTenants } from './tenants.js';

export const OPS_COOKIE = 'v2_ops';
const DAYS = 14;

export async function opsLogin(db, email, password) {
  email = normEmail(email);
  if (typeof password === 'string') password = password.trim();
  if (!email || typeof password !== 'string' || !password) return null;
  const u = await db.prepare('SELECT id, name, email, salt, hash, ver, platform FROM users WHERE email = ?').bind(email).first();
  if (!u || !u.platform || !u.hash || !same(await hashPw(password, u.salt), u.hash)) return null;
  return { id: u.id, name: u.name, email: u.email, ver: u.ver };
}
// First sign-in, or a forgotten password: the person proves they can change the Worker's settings by typing
// the code they put in the Cloudflare Secret OPS_SETUP. Only the founder's address or an existing Visit2 person.
export const OPS_OWNER = 'visit2ge@gmail.com';
export async function opsSetPassword(db, setupCode, { email, code, password }) {
  if (!setupCode || String(setupCode).length < 12) throw new Error('Cloudflare-ში ჯერ ჩაწერე OPS_SETUP (მინიმუმ 12 სიმბოლო).');
  if (!same(String(code || ''), String(setupCode))) throw new Error('კოდი არ ემთხვევა OPS_SETUP-ს.');
  email = normEmail(email);
  const p = pwProblem(password); if (p) throw new Error(p);
  const u = await db.prepare('SELECT id, platform FROM users WHERE email = ?').bind(email).first();
  if (!(email === OPS_OWNER || u?.platform)) throw new Error('ამ ელფოსტას Visit2-ის ადმინში შესვლის უფლება არ აქვს.');
  const salt = newSalt(), hash = await hashPw(password, salt);
  if (u) await db.prepare('UPDATE users SET salt = ?, hash = ?, ver = ver + 1, platform = 1 WHERE id = ?').bind(salt, hash, u.id).run();
  else await db.prepare('INSERT INTO users (id, email, name, salt, hash, platform, created) VALUES (?, ?, ?, ?, ?, 1, ?)')
    .bind(crypto.randomUUID(), email, 'Visit2', salt, hash, nowIso()).run();
  return opsLogin(db, email, password);
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
  const r = await db.prepare(`SELECT t.id, t.slug, t.name, t.city, t.status, t.plan, t.trial_ends, t.paused_until, t.paid_until, t.addons, t.closed_at, t.created,
      (SELECT u.email FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = t.id AND m.role = 'owner' LIMIT 1) AS owner
    FROM tenants t ORDER BY t.created DESC`).all();
  return (r.results || []).map(x => {
    let addons = []; try { addons = JSON.parse(x.addons || '[]'); } catch (e) { /* none */ }
    const free = x.plan === 'free';
    return { slug: x.slug, name: x.name, city: x.city, status: x.status, free, trialEnds: x.trial_ends, pausedUntil: x.paused_until, paidUntil: x.paid_until, addons, closedAt: x.closed_at, created: x.created, owner: x.owner || '',
      monthly: free ? 0 : x.status === 'paused' ? PAUSE_PRICE : BASE_PRICE + addons.reduce((s, a) => s + (ADDONS[a] || 0), 0), hidden: addons.includes('hidden') };
  });
}

// tasks that come from events by themselves; INSERT OR IGNORE on auto_key keeps them single
export async function autoTasks(db, hotels, day = today()) {
  const st = [];
  for (const h of hotels) {
    // a hotel we keep free for good: no calls about trials or payments
    if (h.free && h.status !== 'closed') { if (h.created && h.created.slice(0, 10) >= addDays(day, -2)) st.push(['welcome:' + h.slug, 'მიესალმე და დაეხმარე დაწყებაში', h.slug, 'ახალი რეგისტრაცია', addDays(h.created.slice(0, 10), 1), h.owner]); continue; }
    if (h.status === 'trial' && h.trialEnds && h.trialEnds >= day && h.trialEnds <= addDays(day, 3))
      st.push(['trial:' + h.slug + ':' + h.trialEnds, 'დაურეკე', h.slug, `უფასო პერიოდი მთავრდება ${h.trialEnds}-ს`, h.trialEnds, h.owner]);
    // the terms promise: a closed hotel's data is deleted within 90 days of closing
    if (h.status === 'closed' && h.closedAt && h.closedAt.slice(0, 10) <= addDays(day, -75))
      st.push(['purge:' + h.slug, 'სასტუმრო წაშალე', h.slug, `დახურულია ${h.closedAt.slice(0, 10)}-დან. პირობებით 90 დღეში უნდა წაიშალოს (${addDays(h.closedAt.slice(0, 10), 90)}).`, addDays(h.closedAt.slice(0, 10), 85), h.owner]);
    if (h.status === 'active' && h.paidUntil && h.paidUntil < day)
      st.push(['unpaid:' + h.slug + ':' + h.paidUntil, 'გადახდა გადაამოწმე', h.slug, `გადახდილია ${h.paidUntil}-მდე`, day, h.owner]);
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

export const ADDONS = { catalog: 20, domain: 10, pay: 0 };      // pay: prepayment through the hotel's bank (price not set yet)            // GEL a month on top of the system (50)
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
    slug: t.slug, name: t.name, city: t.city, status: t.status, free: t.plan === 'free', trialEnds: t.trialEnds, pausedUntil: t.pausedUntil, paidUntil: t.paidUntil, addons: t.addons, created: t.created,
    monthly: t.plan === 'free' ? 0 : t.status === 'paused' ? PAUSE_PRICE : BASE_PRICE + t.addons.reduce((s, a) => s + (ADDONS[a] || 0), 0),
    team: team2, lastLogin: team2.map(x => x.lastLogin).filter(Boolean).sort().pop() || null,
    requests30: req?.n || 0, confirmed30: conf?.n || 0,
    site: { photo: !!site.hero?.img, about: !!site.about?.text, gallery: (site.gallery || []).length, pin: !!site.pin, theme: site.theme || 'opal' },
    domains: await hotelDomains(db, t),
    payments: pays.results || [], helpUntil: acc?.until > Date.now() ? acc.until : null, ourLog: log.results || [],
  };
}

// the hotel's own domain (example.ge and www.example.ge) shows its site; the address must already point to Visit2 in Cloudflare
const goodHost = h => /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(h) && !/(^|\.)visit2\.ge$/.test(h);
export async function hotelDomains(db, t) {
  const r = await db.prepare('SELECT host, kind FROM domains WHERE tenant_id = ? ORDER BY kind DESC, host').bind(t.id).all();
  return r.results || [];
}
export async function addDomain(db, t, me, host) {
  host = String(host || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  if (!goodHost(host)) throw new Error('ჩაწერე დომენი, მაგალითად: hotel.ge');
  const taken = await db.prepare('SELECT tenant_id FROM domains WHERE host IN (?, ?)').bind(host, 'www.' + host).all();
  if ((taken.results || []).some(x => x.tenant_id !== t.id)) throw new Error('ეს დომენი სხვა სასტუმროზეა მიბმული');
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO domains (host, tenant_id, kind, verified, created) VALUES (?, ?, 'custom', 1, ?)").bind(host, t.id, nowIso()),
    db.prepare("INSERT OR IGNORE INTO domains (host, tenant_id, kind, verified, created) VALUES (?, ?, 'custom', 1, ?)").bind('www.' + host, t.id, nowIso()),
    note(db, t, me, 'დომენი', host + ' და www.' + host + ' მიება საიტს'),
  ]);
  forgetTenants();
}
export async function removeDomain(db, t, me, host) {
  host = String(host || '').trim().toLowerCase().replace(/^www\./, '');
  await db.batch([
    db.prepare("DELETE FROM domains WHERE tenant_id = ? AND kind = 'custom' AND host IN (?, ?)").bind(t.id, host, 'www.' + host),
    note(db, t, me, 'დომენი', host + ' მოიხსნა'),
  ]);
  forgetTenants();
}

// free for good (a partner hotel): every service on, no trial end, no payments; can be taken back
export async function setFree(db, t, me, on) {
  await db.batch([
    db.prepare("UPDATE tenants SET plan = ?, status = CASE WHEN ? = 1 AND status IN ('trial', 'paused') THEN 'active' ELSE status END, paused_until = CASE WHEN ? = 1 THEN NULL ELSE paused_until END WHERE id = ?").bind(on ? 'free' : null, on ? 1 : 0, on ? 1 : 0, t.id),
    note(db, t, me, 'ფასი', on ? 'მუდმივად უფასო: ყველა სერვისი ჩართულია, გადახდა არ სჭირდება' : 'მუდმივად უფასო გაუქმდა'),
  ]);
  forgetTenants();
}

export async function setStatus(db, t, me, status, pausedUntil) {
  if (!STATUSES.includes(status)) throw new Error('ასეთი მდგომარეობა არ არის');
  const pu = status === 'paused' ? day(pausedUntil) : null;
  if (status === 'paused' && !pu) throw new Error('ჩაწერე, რა დღემდეა პაუზა');
  await db.batch([db.prepare("UPDATE tenants SET status = ?, paused_until = ?, closed_at = CASE WHEN ? = 'closed' THEN COALESCE(closed_at, ?) ELSE NULL END WHERE id = ?").bind(status, pu, status, nowIso(), t.id),
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
  // 'hidden' is not a service: a hotel still being set up stays out of the catalogue
  const a = [...Object.keys(ADDONS), 'hidden'].filter(k => (list || []).includes(k));
  await db.batch([db.prepare('UPDATE tenants SET addons = ? WHERE id = ?').bind(JSON.stringify(a), t.id),
    note(db, t, me, 'სერვისები', a.length ? a.map(k => ({ catalog: 'კატალოგი', domain: 'საკუთარი დომენი', pay: 'ონლაინ გადახდა', hidden: 'კატალოგში დამალულია (მზადდება)' }[k])).join(', ') : 'მხოლოდ სისტემა')]);
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
    db.prepare("UPDATE tenants SET paid_until = ?, status = CASE WHEN status IN ('trial', 'closed') THEN 'active' ELSE status END, closed_at = CASE WHEN status = 'closed' THEN NULL ELSE closed_at END WHERE id = ?").bind(paid, t.id),
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
const newPw = () => { const abc = 'abcdefghjkmnpqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(12));
  return [...r].map(b => abc[b % abc.length]).join('').replace(/(.{4})(?=.)/g, '$1-'); };

// an owner for a hotel Visit2 set up itself (Villa JIJI): only when it has none. A new account gets a password
// shown once to pass on; someone who already has a Visit2 account keeps their own password ('').
export async function setOwner(db, t, me, email) {
  const has = await db.prepare("SELECT 1 FROM memberships WHERE tenant_id = ? AND role = 'owner'").bind(t.id).first();
  if (has) throw new Error('ამ სასტუმროს მფლობელი უკვე ჰყავს.');
  const known = await db.prepare('SELECT 1 FROM users WHERE email = ?').bind(normEmail(email)).first();
  const pw = known ? '' : newPw();
  await addMember(db, t, { email, name: t.name, password: pw, role: 'owner' });
  await note(db, t, me, 'მფლობელი', 'მფლობელი მიება: ' + normEmail(email)).run();
  return pw;
}

// a new password for the hotel's owner, shown once to Visit2 to pass on; every device is signed out
export async function resetOwnerPassword(db, t, me) {
  const o = await db.prepare("SELECT u.id FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = ? AND m.role = 'owner' LIMIT 1").bind(t.id).first();
  if (!o) throw new Error('ამ სასტუმროს მფლობელი არ ჰყავს');
  const pw = newPw(), salt = newSalt();
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
// removes a hotel and everything it has, except our payment records (kept for accounting, see retention.js); only a switched-off hotel, and only when its slug is typed again
const HOTEL_TABLES = ['settings', 'seasons', 'types', 'rooms', 'bookings', 'payments', 'guest_notes', 'convos', 'site_content', 'media', 'actlog', 'support_access', 'meta_pages', 'pay_accounts', 'pay_orders', 'services', 'booking_items', 'room_blocks', 'ical_feeds', 'expenses', 'issues', 'domains', 'memberships'];
export async function deleteHotel(db, t, confirm) {
  if (t.status !== 'closed') throw new Error('ჯერ სასტუმრო გამორთე, მერე წაშალე');
  if (confirm !== t.slug) throw new Error(`დასადასტურებლად ჩაწერე: ${t.slug}`);
  await db.batch([...HOTEL_TABLES.map(x => db.prepare(`DELETE FROM ${x} WHERE tenant_id = ?`).bind(t.id)), db.prepare('DELETE FROM tenants WHERE id = ?').bind(t.id)]);
  forgetTenants();
}

// ---------- notices to every hotel's admin ----------
export async function listNotices(db, { current = false } = {}) {
  const r = current
    ? await db.prepare('SELECT * FROM notices WHERE date_from <= ? AND date_to >= ? ORDER BY date_from').bind(today(), today()).all()
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

// ---------- the data-protection thresholds we watch (docs/BRIEF.md, section 4) ----------
// Guests of all hotels together over 2 years; ~110 000 (about 3% of Georgia) is where a data protection officer becomes
// necessary. Counted per hotel (the same phone at two hotels counts twice), so the number is never too low.
export const GUEST_LIMIT = 110000;
export async function guestCount(db) {
  const since = new Date(Date.now() - 730 * 864e5).toISOString();
  const r = await db.prepare("SELECT COUNT(DISTINCT tenant_id || '|' || phone) AS n FROM bookings WHERE created >= ? AND phone != ''").bind(since).first();
  return r?.n || 0;
}
export async function limitTask(db, n) {
  if (n < GUEST_LIMIT * 0.7) return;
  const step = n >= GUEST_LIMIT * 0.9 ? 90 : n >= GUEST_LIMIT * 0.8 ? 80 : 70;
  await db.prepare('INSERT OR IGNORE INTO tasks (id, what, hotel, why, due, how, auto_key, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), 'იურისტს დაუკავშირდი: მონაცემთა დაცვის ოფიცერი', '', `სტუმრები 2 წელში: ${n} (ზღვრის ${step}%)`, today(), `ზღვარი ~${GUEST_LIMIT}. იხ. docs/BRIEF.md, ნაწილი 4.`, 'guests:' + step, nowIso()).run();
}
