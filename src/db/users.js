// Sign-in, sessions, the hotel's team and the activity log.
// A person (users) signs in with email and password; what they may do at a hotel comes from memberships.
// The owner (role 'owner') can do everything at that hotel; staff have chosen sections (perms).
// Ported from Villa JIJI functions/_lib/users.js, where the owner used one ADMIN_PASSWORD and staff a name.
import { nowIso } from '../lib/time.js';

export const PERMS = {
  book: 'ჯავშნები (დღეს, მოთხოვნები, კალენდარი, სტუმრები, გადახდების მიღება)',
  money: 'შემოსავალი',
  price: 'ფასები, სეზონი და სერვისები',
  site: 'საიტის მართვა',
  clean: 'დალაგება (რომელი ნომერია დასალაგებელი; სტუმრების სახელები და თანხები არ ჩანს)',
};
export const ALL = Object.keys(PERMS);
export const cleanPerms = list => ALL.filter(p => (list || []).includes(p));
export const can = (u, p) => !!u && (u.owner || (u.perms || []).includes(p));
export const normEmail = s => String(s || '').trim().toLowerCase();
export const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 120;

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

// ---------- passwords (PBKDF2, salted) ----------
export async function hashPw(pw, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, key, 256));
}
export const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)));
export function same(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export const pwProblem = pw => (typeof pw === 'string' && pw.length >= 8 ? '' : 'პაროლი მინიმუმ 8 სიმბოლო უნდა იყოს');

// ---------- the person as seen at one hotel ----------
const asMember = (u, m) => ({
  id: u.id, name: u.name, email: u.email, ver: u.ver,
  owner: m.role === 'owner', perms: m.role === 'owner' ? ALL.slice() : cleanPerms(JSON.parse(m.perms || '[]')),
});

async function member(db, t, userId) {
  const r = await db.prepare(
    'SELECT u.id, u.name, u.email, u.ver, m.role, m.perms FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = ? AND m.user_id = ? AND m.active = 1'
  ).bind(t.id, userId).first();
  return r ? asMember(r, r) : null;
}

// email + password → the person at this hotel, or null (wrong password, or no access to this hotel)
export async function checkLogin(db, t, email, password) {
  email = normEmail(email);
  if (!email || typeof password !== 'string' || !password) return null;
  const u = await db.prepare('SELECT id, salt, hash FROM users WHERE email = ?').bind(email).first();
  if (!u || !u.hash || !same(await hashPw(password, u.salt), u.hash)) return null;
  const m = await member(db, t, u.id);
  if (!m) return null;
  await db.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(nowIso(), u.id).run();
  return m;
}

// ---------- session cookie: uid.ver.expiry.signature, one per hotel host ----------
export const COOKIE = 'v2_admin';
const DAYS = 30;
export async function hmac(secret, data) {
  if (!secret) throw new Error('SESSION_SECRET is not set');
  const key = await crypto.subtle.importKey('raw', enc.encode('visit2-session:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
// the tenant id is signed in too, so a cookie from one hotel is worthless at another
export async function makeCookie(secret, t, u, secure = true, path = '/') {
  const exp = Date.now() + DAYS * 864e5, body = `${u.id}.${u.ver || 0}.${exp}`;
  return `${COOKIE}=${body}.${await hmac(secret, t.id + '|' + body)}; Path=${path}; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Strict; Max-Age=${DAYS * 86400}`;
}
export const clearCookie = (path = '/') => `${COOKIE}=; Path=${path}; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export async function sessionUser(db, t, request, secret) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (!m || !secret) return null;
  const parts = m[1].split('.');
  if (parts.length !== 4) return null;
  const [id, ver, exp, sig] = parts;
  if (!(+exp > Date.now()) || !same(sig, await hmac(secret, `${t.id}|${id}.${ver}.${exp}`))) return null;
  const u = (await member(db, t, id)) || (await supportMember(db, t, id));
  if (!u || String(u.ver) !== ver) return null; // removed, switched off or password changed
  return u;
}
// Visit2 staff inside a hotel's admin: only while the hotel's owner allows it (support_access), with full rights,
// under the name "Visit2 · …", so every change shows in the hotel's journal as ours
async function supportMember(db, t, userId) {
  const r = await db.prepare('SELECT u.id, u.name, u.email, u.ver, u.platform, a.until FROM users u JOIN support_access a ON a.tenant_id = ? WHERE u.id = ? AND u.platform = 1')
    .bind(t.id, userId).first();
  if (!r || !(r.until > Date.now())) return null;
  return { id: r.id, name: 'Visit2 · ' + r.name, email: r.email, ver: r.ver, owner: true, perms: ALL.slice(), support: true };
}
// a one-time sign-in link from Visit2's admin, valid for two minutes
export async function supportToken(secret, t, u) {
  const body = `${t.id}.${u.id}.${Date.now() + 120e3}`;
  return `${body}.${await hmac(secret, 'support|' + body)}`;
}
export async function supportSignIn(db, t, secret, token) {
  const [tid, uid, exp, sig] = String(token || '').split('.');
  if (tid !== t.id || !(+exp > Date.now()) || !sig || !same(sig, await hmac(secret, `support|${tid}.${uid}.${exp}`))) return null;
  return supportMember(db, t, uid);
}

// ---------- failed sign-ins: at most 10 per address in 15 minutes ----------
const WINDOW = 15 * 60e3, MAX_FAILS = 10;
export async function tooManyFails(db, ip) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM login_fails WHERE ip = ? AND at > ?').bind(ip, Date.now() - WINDOW).first();
  return (r?.n || 0) >= MAX_FAILS;
}
export const noteFail = (db, ip) => db.batch([
  db.prepare('INSERT INTO login_fails (ip, at) VALUES (?, ?)').bind(ip, Date.now()),
  db.prepare('DELETE FROM login_fails WHERE at < ?').bind(Date.now() - WINDOW),
]);
export const clearFails = (db, ip) => db.prepare('DELETE FROM login_fails WHERE ip = ?').bind(ip).run();

// ---------- people and teams ----------
// Creates the person if the email is new; adds them to the hotel. Used for the owner (pilot setup) and for staff.
export async function addMember(db, t, { email, name, password, role = 'staff', perms = [] }) {
  email = normEmail(email);
  if (!validEmail(email)) throw new Error('ელფოსტა არასწორია');
  name = String(name || '').trim();
  if (name.length < 2 || name.length > 40) throw new Error('სახელი 2–40 ასო უნდა იყოს');
  let u = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  const st = [];
  if (!u) {
    const p = pwProblem(password); if (p) throw new Error(p);
    const salt = newSalt();
    u = { id: 'u' + crypto.randomUUID().replace(/-/g, '').slice(0, 11) };
    st.push(db.prepare('INSERT INTO users (id, email, name, salt, hash, created) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(u.id, email, name, salt, await hashPw(password, salt), nowIso()));
  }
  st.push(db.prepare('INSERT INTO memberships (tenant_id, user_id, role, perms, active, created) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT (tenant_id, user_id) DO UPDATE SET active = 1, role = excluded.role, perms = excluded.perms')
    .bind(t.id, u.id, role === 'owner' ? 'owner' : 'staff', JSON.stringify(cleanPerms(perms)), nowIso()));
  await db.batch(st);
  return u.id;
}

export async function teamList(db, t) {
  const r = await db.prepare(
    'SELECT u.id, u.name, u.email, u.created, u.last_login, m.role, m.perms, m.active FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = ? ORDER BY m.created'
  ).bind(t.id).all();
  return (r.results || []).map(x => ({ id: x.id, name: x.name, email: x.email, owner: x.role === 'owner', perms: x.role === 'owner' ? ALL.slice() : cleanPerms(JSON.parse(x.perms || '[]')),
    active: !!x.active, created: x.created, lastLogin: x.last_login }));
}

// staff changes; the person must belong to this hotel, and owners are not changed here
async function staff(db, t, id) {
  return db.prepare("SELECT u.id, u.name, u.ver, m.perms, m.active FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = ? AND m.user_id = ? AND m.role = 'staff'")
    .bind(t.id, id).first();
}
export async function updateStaff(db, t, id, { name, perms, active }) {
  const s = await staff(db, t, id); if (!s) throw new Error('ასეთი თანამშრომელი არ არის');
  const st = [];
  if (perms || active != null) {
    st.push(db.prepare('UPDATE memberships SET perms = ?, active = ? WHERE tenant_id = ? AND user_id = ?')
      .bind(JSON.stringify(perms ? cleanPerms(perms) : JSON.parse(s.perms || '[]')), active != null ? (active ? 1 : 0) : s.active, t.id, id));
  }
  // a name belongs to the person; switching someone off signs them out at once (ver)
  if (name != null || active === false) {
    const n = name != null ? String(name).trim() : s.name;
    if (n.length < 2 || n.length > 40) throw new Error('სახელი 2–40 ასო უნდა იყოს');
    st.push(db.prepare('UPDATE users SET name = ?, ver = ver + ? WHERE id = ? AND EXISTS (SELECT 1 FROM memberships WHERE tenant_id = ? AND user_id = ?)')
      .bind(n, active === false ? 1 : 0, id, t.id, id));
  }
  if (st.length) await db.batch(st);
  return s;
}
export async function setStaffPassword(db, t, id, password) {
  const s = await staff(db, t, id); if (!s) throw new Error('ასეთი თანამშრომელი არ არის');
  const p = pwProblem(password); if (p) throw new Error(p);
  const salt = newSalt();
  await db.prepare('UPDATE users SET salt = ?, hash = ?, ver = ver + 1 WHERE id = ? AND EXISTS (SELECT 1 FROM memberships WHERE tenant_id = ? AND user_id = ?)')
    .bind(salt, await hashPw(password, salt), id, t.id, id).run();
  return s;
}
export async function removeStaff(db, t, id) {
  const s = await staff(db, t, id); if (!s) throw new Error('ასეთი თანამშრომელი არ არის');
  await db.prepare("DELETE FROM memberships WHERE tenant_id = ? AND user_id = ? AND role = 'staff'").bind(t.id, id).run();
  return s;
}
export async function renameMe(db, t, u, name) {
  name = String(name || '').trim();
  if (name.length < 2 || name.length > 40) throw new Error('სახელი 2–40 ასო უნდა იყოს');
  await db.prepare('UPDATE users SET name = ? WHERE id = ? AND EXISTS (SELECT 1 FROM memberships WHERE tenant_id = ? AND user_id = ?)').bind(name, u.id, t.id, u.id).run();
}

// ---------- activity log ----------
export async function logAct(db, t, u, op, target = '', detail = '', ref = '') {
  try {
    await db.prepare('INSERT INTO actlog (tenant_id, at, uid, who, op, target, detail, ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(t.id, nowIso(), u?.id || '', u?.name || '', op, String(target || ''), String(detail || '').slice(0, 300), String(ref || '')).run();
  } catch (e) { console.log('log failed', e.message); }
}
// entries about bookings, for the booking cards (last 120 days)
export async function bookingLog(db, t) {
  const since = new Date(Date.now() - 120 * 864e5).toISOString();
  const r = await db.prepare("SELECT at, who, op, target, detail, ref FROM actlog WHERE tenant_id = ? AND at > ? AND target LIKE 'bk:%' ORDER BY id").bind(t.id, since).all();
  return r.results || [];
}
// the journal (owner only). Filters as at Villa JIJI.
export async function journal(db, t, q) {
  const where = ['tenant_id = ?'], args = [t.id];
  const ops = (q.get('ops') || '').split(',').map(s => s.trim()).filter(s => /^[a-z-]{2,20}$/.test(s));
  if (q.get('who')) { where.push('uid = ?'); args.push(q.get('who')); }
  if (+q.get('before')) { where.push('id < ?'); args.push(+q.get('before')); }
  if (ops.length) { where.push(`op IN (${ops.map(() => '?').join(',')})`); args.push(...ops); }
  else if (q.get('logins') !== '1') where.push("op != 'login'");
  if (q.get('from')) { where.push('at >= ?'); args.push(q.get('from')); }
  if (q.get('to')) { where.push('at < ?'); args.push(q.get('to')); }
  const text = (q.get('q') || '').trim().slice(0, 40);
  if (text) { where.push('(detail LIKE ? OR who LIKE ?)'); args.push(`%${text}%`, `%${text}%`); }
  const limit = Math.min(5000, Math.max(1, parseInt(q.get('limit')) || 100));
  const r = await db.prepare(`SELECT id, at, uid, who, op, target, detail FROM actlog WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ${limit}`).bind(...args).all();
  return r.results || [];
}
