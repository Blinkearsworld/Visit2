// API of one hotel site. The hotel (t) is already known from the host name; nothing here takes it from the browser.
//   public: GET /api/state, POST /api/request, GET /api/content, GET /media/<id>, POST /api/login, POST /api/logout
//   admin:  /api/admin/state, rev, action, users, log, content  (signed in, member of this hotel)
import { json, readJson } from './lib/http.js';
import { loadState, createRequest } from './db/hotel.js';
import { getContent, listVersions, getVersion, saveContent, putMedia, getMedia, MAX_MEDIA } from './db/content.js';
import { adminAction } from './db/actions.js';
import { getSetting } from './db/settings.js';
import { grantHelp, helpUntil, listNotices } from './db/ops.js';
import {
  checkLogin, makeCookie, supportSignIn, clearCookie, sessionUser, tooManyFails, noteFail, clearFails, logAct, bookingLog, journal,
  can, teamList, addMember, updateStaff, setStaffPassword, removeStaff, renameMe, PERMS,
} from './db/users.js';

const DENIED = { ok: false, msg: 'ამის უფლება არ გაქვთ. მიმართეთ მფლობელს.' };

export async function hotelApi(request, env, t, { dev = false, base = '/' } = {}) {
  const db = env.DB, url = new URL(request.url), p = url.pathname, m = request.method;
  const secret = env.SESSION_SECRET || (dev ? 'local-dev-only' : null);

  // ---------- public ----------
  if (p === '/api/state' && m === 'GET') return json({ ...(await loadState(db, t)), hotel: { name: t.name, city: t.city, slug: t.slug } });
  if (p === '/api/content' && m === 'GET') {
    const { content, ver } = await getContent(db, t);
    return json({ content, ver, hotel: { name: t.name, city: t.city, slug: t.slug } });
  }
  if (p === '/api/request' && m === 'POST') {
    const body = await readJson(request);
    if (!body) return json({ error: 'bad json' }, 400);
    try {
      const st = await loadState(db, t);
      const r = await createRequest(db, t, st, { ...body, source: body.source === 'chat' ? 'chat' : 'site' });
      return json({ ok: true, id: r.booking.id, total: r.total, typeName: r.typeName });
    } catch (e) { return json({ ok: false, error: e.message }, 400); }
  }
  if (p.startsWith('/media/') && (m === 'GET' || m === 'HEAD')) {
    const id = p.slice(7);
    if (!/^[\w-]+\.(webp|jpg|png|gif)$/.test(id)) return new Response('not found', { status: 404 });
    const r = await getMedia(db, t, id);
    if (!r || !r.data) return new Response('not found', { status: 404 });
    return new Response(m === 'HEAD' ? null : (r.data instanceof ArrayBuffer ? r.data : new Uint8Array(r.data)), {
      headers: { 'content-type': r.mime, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' },
    });
  }
  if (p === '/api/login' && m === 'POST') {
    if (!secret) return json({ ok: false, msg: 'სესიის გასაღები ჯერ არ არის დაყენებული (SESSION_SECRET).' }, 503);
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    if (await tooManyFails(db, ip)) return json({ ok: false, msg: 'ბევრი არასწორი ცდა. სცადეთ 15 წუთში.' }, 429);
    const body = (await readJson(request)) || {};
    const u = await checkLogin(db, t, body.email ?? body.name, body.password);
    if (!u) { await noteFail(db, ip); return json({ ok: false, msg: 'არასწორი ელფოსტა ან პაროლი' }, 401); }
    await clearFails(db, ip);
    await logAct(db, t, u, 'login');
    return json({ ok: true, name: u.name }, 200, { 'set-cookie': await makeCookie(secret, t, u, url.protocol === 'https:', base) });
  }
  if (p === '/api/logout' && m === 'POST') return json({ ok: true }, 200, { 'set-cookie': clearCookie(base) });
  // Visit2's admin opens this hotel's admin (the owner allowed help): a two-minute link → the admin cookie
  if (p === '/api/support-enter' && m === 'GET') {
    const u = secret ? await supportSignIn(db, t, secret, url.searchParams.get('k')) : null;
    if (!u) return new Response('ბმულს ვადა გაუვიდა ან დახმარება დაშვებული არ არის.', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    await logAct(db, t, u, 'login', 'visit2', 'Visit2 შევიდა დახმარებისთვის');
    return new Response(null, { status: 303, headers: { location: base.replace(/\/?$/, '/') + 'admin', 'set-cookie': await makeCookie(secret, t, u, url.protocol === 'https:', base) } });
  }

  // ---------- admin ----------
  if (!p.startsWith('/api/admin/')) return json({ error: 'not found' }, 404);
  const u = await sessionUser(db, t, request, secret).catch(() => null);
  if (!u) return json({ error: 'not signed in' }, 401);
  const route = p.slice('/api/admin/'.length);

  if (route === 'state' && m === 'GET') {
    const st = await loadState(db, t, { full: true });
    const me = { id: u.id, name: u.name, email: u.email, owner: u.owner, perms: u.perms, support: !!u.support };
    const hotel = { name: t.name, city: t.city, slug: t.slug, status: t.status, trialEnds: t.trialEnds, helpUntil: await helpUntil(db, t), notices: await listNotices(db, { current: true }) };
    if (!can(u, 'book') && !can(u, 'money')) {
      // site-only staff: room list and prices for the site editor, no guests
      Object.assign(st, { bookings: [], payments: [], guestNotes: {}, guestBdays: {} });
      return json({ ...st, me, hotel, actlog: [] });
    }
    return json({ ...st, me, hotel, actlog: await bookingLog(db, t) });
  }
  if (route === 'help' && m === 'POST') {
    if (!u.owner || u.support) return json({ ok: false, msg: 'დახმარებას მხოლოდ მფლობელი უშვებს' }, 403);
    const b = (await readJson(request)) || {};
    const until = await grantHelp(db, t, u.name, b.hours);
    await logAct(db, t, u, 'help', 'visit2', until ? `დახმარება დაშვებულია ${b.hours} საათით` : 'დახმარება გაუქმდა');
    return json({ ok: true, until });
  }
  if (route === 'rev' && m === 'GET') return json({ rev: (await getSetting(db, t, 'rev')) || '0' });
  if (route === 'action' && m === 'POST') {
    const b = await readJson(request);
    if (!b) return json({ ok: false, msg: 'bad json' }, 400);
    const r = await adminAction(db, t, u, b);
    return json(r.body, r.status);
  }
  if (route === 'log' && m === 'GET') {
    if (!u.owner) return json({ ok: false, msg: 'მხოლოდ მფლობელს შეუძლია' }, 403);
    return json({ ok: true, items: await journal(db, t, url.searchParams) });
  }
  if (route === 'users') return team(request, db, t, u);
  if (route === 'content') return content(request, db, t, u);
  return json({ error: 'not found' }, 404);
}

// ---------- admin → გუნდი (owner only) ----------
async function team(request, db, t, me) {
  if (!me.owner) return json({ ok: false, msg: 'მხოლოდ მფლობელს შეუძლია' }, 403);
  const list = async () => {
    const all = await teamList(db, t);
    return json({ ok: true, owner: all.find(x => x.id === me.id)?.name || me.name, ownerId: me.id, users: all.filter(x => !x.owner), perms: PERMS });
  };
  if (request.method === 'GET') return list();
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const b = (await readJson(request)) || {};
  try {
    switch (b.op) {
      case 'add': {
        const id = await addMember(db, t, { email: b.email, name: b.name, password: b.password, perms: b.perms });
        await logAct(db, t, me, 'user-add', 'user:' + id, `${String(b.name).trim()} · ${String(b.email).trim()}`);
        break;
      }
      case 'update': {
        const s = await updateStaff(db, t, b.id, { name: b.name, perms: b.perms, active: b.active });
        const what = b.active != null ? (b.active ? 'ჩართო' : 'გათიშა') : b.perms ? 'უფლებები: ' + (b.perms.join(', ') || 'არაფერი') : 'სახელი: ' + b.name;
        await logAct(db, t, me, 'user-edit', 'user:' + b.id, `${b.name || s.name} · ${what}`);
        break;
      }
      case 'password': { const s = await setStaffPassword(db, t, b.id, b.password); await logAct(db, t, me, 'user-pass', 'user:' + b.id, s.name); break; }
      case 'remove': { const s = await removeStaff(db, t, b.id); await logAct(db, t, me, 'user-del', 'user:' + b.id, s.name); break; }
      case 'owner': { await renameMe(db, t, me, b.name); await logAct(db, t, { ...me, name: String(b.name).trim() }, 'user-edit', 'user:' + me.id, 'სახელი: ' + String(b.name).trim()); break; }
      default: return json({ ok: false, msg: 'unknown op' }, 400);
    }
  } catch (e) { return json({ ok: false, msg: e.message }, 400); }
  return list();
}

// ---------- admin → საიტის მართვა ----------
async function content(request, db, t, u) {
  if (!can(u, 'site')) return json(DENIED, 403);
  const m = request.method;
  if (m === 'GET') {
    const ver = new URL(request.url).searchParams.get('ver');
    if (ver) { const c = await getVersion(db, t, +ver); return c ? json({ content: c }) : json({ error: 'not found' }, 404); }
    return json({ ...(await getContent(db, t)), versions: await listVersions(db, t) });
  }
  if (m === 'POST') {
    const body = await readJson(request);
    if (!body || typeof body.content !== 'object' || Array.isArray(body.content)) return json({ error: 'no content' }, 400);
    try {
      const cur = await saveContent(db, t, body.content, body.note || '');
      await logAct(db, t, u, 'site', 'site:' + cur.ver, body.note || '');
      return json({ ok: true, ...cur, versions: await listVersions(db, t) });
    } catch (e) { return json({ error: String(e.message || e) }, 400); }
  }
  if (m === 'PUT') {
    const mime = (request.headers.get('content-type') || '').split(';')[0].trim();
    if ((+request.headers.get('content-length') || 0) > MAX_MEDIA) return json({ error: 'photo too large' }, 413);
    const r = await putMedia(db, t, await request.arrayBuffer(), mime);
    return r.error ? json({ error: r.error }, r.status) : json(r);
  }
  return json({ error: 'method' }, 405);
}
