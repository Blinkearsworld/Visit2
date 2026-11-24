// API of the platform itself (visit2.ge, not a hotel).
//   POST /api/signup  { name, city, email, password, theme, agree } → { ok, slug, site, admin }
//   GET /api/catalog?from&to&g  real hotels for the guests' search (public facts only)
//   /api/ops/*        Visit2's own admin: login, logout, state (hotels, to-do), task (save), task-del
import { json, readJson } from './lib/http.js';
import { signUp, signUpsFrom, noteSignUp, SIGNUP_LIMIT } from './db/signup.js';
import { ROOT_DOMAIN } from './db/tenants.js';
import { tooManyFails, noteFail, clearFails } from './db/users.js';
import { opsLogin, opsCookie, opsClear, opsUser, allHotels, autoTasks, listTasks, saveTask, deleteTask } from './db/ops.js';
import { today, addDays } from './lib/time.js';
import { catalog } from './db/catalog.js';

export async function platformApi(request, env, { preview = false } = {}) {
  const url = new URL(request.url), p = url.pathname, m = request.method, db = env.DB;
  if (p === '/api/signup' && m === 'POST') {
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    if ((await signUpsFrom(db, ip)) >= SIGNUP_LIMIT) return json({ ok: false, msg: 'ამ მისამართიდან ბევრი საიტი შეიქმნა. სცადე 15 წუთში, ან მოგვწერე.' }, 429);
    const body = await readJson(request);
    if (!body) return json({ ok: false, msg: 'ფორმა ვერ მოვიდა. განაახლე გვერდი და სცადე თავიდან.' }, 400);
    const r = await signUp(db, body);
    if (!r.ok) return json(r, 400);
    await noteSignUp(db, ip);
    // before the real domain works, hotels open under /h/{slug}/ on this same address
    const site = preview ? `${url.origin}/h/${r.tenant.slug}/` : `https://${r.tenant.slug}.${ROOT_DOMAIN}/`;
    return json({ ok: true, slug: r.tenant.slug, site, admin: site + 'admin' });
  }
  if (p === '/api/catalog' && m === 'GET') {
    const q = url.searchParams, from = q.get('from') || '', to = q.get('to') || '', g = Math.max(1, Math.min(20, +q.get('g') || 2));
    // a hotel's address: its own subdomain, or /h/{slug}/ on the preview address
    const siteOf = t => (preview ? `${url.origin}/h/${t.slug}/` : `https://${t.slug}.${ROOT_DOMAIN}/`);
    const hotels = await catalog(db, { siteOf, from, to, guests: g });
    return json({ hotels }, 200, { 'cache-control': 'public, max-age=60' });
  }
  if (p.startsWith('/api/ops/')) return opsApi(request, env, url, preview);
  return json({ error: 'not found' }, 404);
}

async function opsApi(request, env, url, preview) {
  const db = env.DB, p = url.pathname.slice('/api/ops/'.length), m = request.method;
  const secret = env.SESSION_SECRET || (url.hostname === 'localhost' || url.hostname === '127.0.0.1' ? 'local-dev-only' : null);
  if (!secret) return json({ ok: false, msg: 'SESSION_SECRET is not set' }, 500);
  const secure = url.protocol === 'https:';
  if (p === 'login' && m === 'POST') {
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    if (await tooManyFails(db, ip)) return json({ ok: false, msg: 'ბევრი მცდელობა. სცადე 15 წუთში.' }, 429);
    const b = await readJson(request) || {};
    const u = await opsLogin(db, b.email, b.password);
    if (!u) { await noteFail(db, ip); return json({ ok: false, msg: 'ელფოსტა ან პაროლი არ ემთხვევა.' }, 401); }
    await clearFails(db, ip);
    return json({ ok: true }, 200, { 'set-cookie': await opsCookie(secret, u, secure) });
  }
  if (p === 'logout' && m === 'POST') return json({ ok: true }, 200, { 'set-cookie': opsClear() });
  const me = await opsUser(db, request, secret);
  if (!me) return json({ ok: false, login: true }, 401);
  if (p === 'state' && m === 'GET') {
    const hotels = await allHotels(db), d = today();
    await autoTasks(db, hotels, d);
    const site = h => (preview ? `${url.origin}/h/${h.slug}/` : `https://${h.slug}.${ROOT_DOMAIN}/`);
    return json({
      me: { name: me.name, email: me.email },
      stats: {
        hotels: hotels.length,
        newWeek: hotels.filter(h => h.created && h.created.slice(0, 10) >= addDays(d, -7)).length,
        trialEnding: hotels.filter(h => h.status === 'trial' && h.trialEnds && h.trialEnds >= d && h.trialEnds <= addDays(d, 7)).length,
      },
      hotels: hotels.map(h => ({ ...h, site: site(h) })),
      tasks: await listTasks(db),
    });
  }
  if (p === 'task' && m === 'POST') {
    try { return json({ ok: true, id: await saveTask(db, await readJson(request) || {}) }); }
    catch (e) { return json({ ok: false, msg: e.message }, 400); }
  }
  if (p === 'task-del' && m === 'POST') { const b = await readJson(request) || {}; if (b.id) await deleteTask(db, String(b.id)); return json({ ok: true }); }
  return json({ error: 'not found' }, 404);
}
