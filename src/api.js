// API of one hotel site. The hotel (t) is already known from the host name; nothing here takes it from the browser.
//   public: GET /api/state, POST /api/request, GET /api/content, GET /media/<id>, POST /api/login, POST /api/logout
//   admin:  /api/admin/state, rev, action, users, log, content  (signed in, member of this hotel)
import { json, readJson } from './lib/http.js';
import { loadState, createRequest, guestBooking } from './db/hotel.js';
import { getContent, listVersions, getVersion, saveContent, putMedia, getMedia, MAX_MEDIA } from './db/content.js';
import { adminAction } from './db/actions.js';
import { getSetting } from './db/settings.js';
import { grantHelp, helpUntil, listNotices } from './db/ops.js';
import { hotelPages, disconnectPages } from './db/meta.js';
import { encKey, accountInfo, getAccount, saveAccount, removeAccount, holdToRequest, addOrder, findOrder, lastOrder, settleOrder, HOLD_MIN } from './db/pay.js';
import { BANKS, checkCreds, createOrder, orderState } from './lib/banks.js';
import { listFeeds, addFeed, removeFeed, syncFeed, roomIcs, notePull, pulls } from './db/ical.js';
import { findCode } from './lib/plans.js';
import { metaStartUrl, pick, pendingPages } from './meta.js';
import {
  checkLogin, makeCookie, supportSignIn, clearCookie, sessionUser, tooManyFails, noteFail, clearFails, logAct, bookingLog, journal,
  can, teamList, addMember, updateStaff, setStaffPassword, removeStaff, renameMe, changeMyPassword, PERMS, hmac,
} from './db/users.js';

const DENIED = { ok: false, msg: 'ამის უფლება არ გაქვთ. მიმართეთ მფლობელს.' };

const bookingKey = async (secret, t, id) => (await hmac(secret, 'booking|' + t.id + '|' + id)).slice(0, 20);
// the address of a room's calendar for Booking.com / Airbnb: secret per hotel and room
const icalKey = async (secret, t, room) => (await hmac(secret, 'ical|' + t.id + '|' + room)).slice(0, 24);

// ---------- prepayment through the hotel's own bank ----------
// on only where Visit2 turned the service on, the owner connected a bank and chose prepayment for instant bookings
async function payReady(env, t, site) {
  if (!(t.plan === 'free' || (t.addons || []).includes('pay')) || !site.instant?.on || !site.instant?.pay?.on) return null;
  return getAccount(env.DB, t, encKey(env));
}
// opens the bank's payment page for a booking that holds its room; the guest comes back to their booking link
async function openPayment(env, t, acc, { id, key, amount, origin, base, lang }) {
  const page = new URL(base, origin); page.searchParams.set('b', id); page.searchParams.set('k', key); page.searchParams.set('paid', '1');
  const o = await createOrder(env, acc, { amount, ref: 'V2-' + id, returnUrl: page.toString(), callbackUrl: new URL(base.replace(/\/?$/, '/') + 'api/pay/cb', origin).toString(),
    lang, minutes: HOLD_MIN, desc: t.name });
  await addOrder(env.DB, t, { id: o.id, booking: id, bank: acc.bank, amount });
  return o.url;
}
// asks the bank about the booking's latest payment page (never trusts what the browser or the callback says)
async function checkPayment(env, t, order) {
  const acc = order && await getAccount(env.DB, t, encKey(env));
  if (!acc) return null;
  try { return await settleOrder(env.DB, t, order, await orderState(env, acc, order.id)); } catch (e) { return null; }
}

export async function hotelApi(request, env, t, { dev = false, base = '/' } = {}) {
  const db = env.DB, url = new URL(request.url), p = url.pathname, m = request.method;
  const secret = env.SESSION_SECRET || (dev ? 'local-dev-only' : null);

  // ---------- public ----------
  if (p === '/api/state' && m === 'GET') return json({ ...(await loadState(db, t)), hotel: { name: t.name, city: t.city, slug: t.slug } });
  if (p === '/api/content' && m === 'GET') {
    const { content, ver } = await getContent(db, t);
    const pay = !!(secret && await payReady(env, t, content?.site || {}));
    return json({ content, ver, pay, payMinutes: HOLD_MIN, hotel: { name: t.name, city: t.city, slug: t.slug } });
  }
  if (p === '/api/request' && m === 'POST') {
    const body = await readJson(request);
    if (!body) return json({ error: 'bad json' }, 400);
    try {
      const st = await loadState(db, t);
      // instant booking (booking form or chat) only if the hotel turned it on: read here, never trusted from the browser
      const site = (await getContent(db, t)).content?.site || {};
      const on = body.instant === true && !!site.instant?.on;
      const acc = on && secret ? await payReady(env, t, site) : null;
      const r = await createRequest(db, t, st, { ...body, instant: on, kidRule: site.kids || null, payRule: acc ? site.instant.pay : null, source: body.source === 'chat' ? 'chat' : 'site' });
      const key = r.instant && secret ? await bookingKey(secret, t, r.booking.id) : '';
      if (r.instant && r.pay) {
        // the room is held for a few minutes while the guest pays at the bank; no payment page → an ordinary request
        try {
          const pay = await openPayment(env, t, acc, { id: r.booking.id, key, amount: r.pay, origin: url.origin, base, lang: body.lang });
          return json({ ok: true, id: r.booking.id, total: r.total, extras: r.extras || [], typeName: r.typeName, instant: true, key, pay, payAmount: r.pay, payMinutes: HOLD_MIN });
        } catch (e) {
          await holdToRequest(db, t, r.booking.id);
          return json({ ok: true, id: r.booking.id, total: r.total, extras: r.extras || [], typeName: r.typeName, instant: false, key: '' });
        }
      }
      return json({ ok: true, id: r.booking.id, total: r.total, extras: r.extras || [], typeName: r.typeName, instant: !!r.instant, key });
    } catch (e) { return json({ ok: false, error: e.message }, 400); }
  }
  // a room's calendar for other booking sites (dates only); ?skip=booking.com leaves out what came from that site
  const ic = p.match(/^\/api\/ical\/([\w-]{1,20})\.ics$/);
  if (ic && m === 'GET') {
    const room = ic[1];
    if (!secret || url.searchParams.get('k') !== await icalKey(secret, t, room)) return new Response('not found', { status: 404 });
    const body = await roomIcs(db, t, room, (url.searchParams.get('skip') || '').toLowerCase().slice(0, 60));
    await notePull(db, t, room, request.headers.get('user-agent') || '').catch(() => {});
    return new Response(body, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } });
  }
  // a promo code typed on the booking form: is it valid, and how much off (the code list itself stays private)
  if (p === '/api/code' && m === 'GET') {
    const st = await loadState(db, t, { full: true });
    const c = findCode(st.settings, url.searchParams.get('c'), url.searchParams.get('from') || '');
    return json(c ? { ok: true, code: String(c.code).toUpperCase(), pct: +c.pct || 0 } : { ok: false });
  }
  // the guest's own booking, behind the link they got when booking (id + key); nothing else is reachable with it
  if (p === '/api/booking' && m === 'GET') {
    const id = url.searchParams.get('id') || '', k = url.searchParams.get('k') || '';
    if (!secret || !/^[\w-]{6,40}$/.test(id) || k !== await bookingKey(secret, t, id)) return json({ ok: false }, 404);
    let b = await guestBooking(db, t, id);
    if (b && b.pay && b.pay.state === 'waiting') { await checkPayment(env, t, await lastOrder(db, t, id)); b = await guestBooking(db, t, id); }
    return b ? json({ ok: true, booking: b }, 200, { 'cache-control': 'no-store' }) : json({ ok: false }, 404);
  }
  // the guest tries to pay again (closed the bank's page, card declined) while the room is still held
  if (p === '/api/pay/again' && m === 'POST') {
    const b = (await readJson(request)) || {}, id = String(b.id || ''), k = String(b.k || '');
    if (!secret || !/^[\w-]{6,40}$/.test(id) || k !== await bookingKey(secret, t, id)) return json({ ok: false }, 404);
    const g = await guestBooking(db, t, id), acc = await getAccount(db, t, encKey(env));
    if (!g || !g.pay || g.pay.state !== 'waiting' || g.pay.until < new Date().toISOString() || !acc) return json({ ok: false, msg: 'expired' }, 409);
    try { return json({ ok: true, pay: await openPayment(env, t, acc, { id, key: k, amount: g.pay.amount, origin: url.origin, base, lang: b.lang }) }); }
    catch (e) { return json({ ok: false, msg: 'bank' }, 502); }
  }
  // the bank tells us a payment ended; we look the order up in this hotel only and ask the bank ourselves
  if (p === '/api/pay/cb' && m === 'POST') {
    const b = (await readJson(request)) || {};
    const oid = String(b.PaymentId || b.paymentId || b.body?.order_id || b.order_id || '').slice(0, 80);
    const order = oid ? await findOrder(db, t, oid) : null;
    if (order) await checkPayment(env, t, order);
    return json({ ok: true });
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
      // site-only staff: room list and prices for the site editor, no guests;
      // housekeeping staff also see which rooms are taken and when guests come and go, without names, phones or money
      const hk = can(u, 'clean');
      Object.assign(st, { bookings: hk ? st.bookings.filter(b => b.status === 'confirmed').map(b => ({ id: b.id, room: b.room, type: b.type, from: b.from, to: b.to, guests: b.guests, status: b.status, checkedIn: b.checkedIn, checkedOut: b.checkedOut, name: '', phone: '' })) : [],
        payments: [], items: [], expenses: [], guestNotes: {}, guestBdays: {} });
      return json({ ...st, me, hotel, actlog: [] });
    }
    if (!can(u, 'money')) st.expenses = []; // what the hotel spends: only with the "income" right
    return json({ ...st, me, hotel, actlog: await bookingLog(db, t) });
  }
  // calendars of Booking.com, Airbnb ... per room, and this hotel's calendar links for them
  if (route === 'ical') {
    if (!can(u, 'book')) return json(DENIED, 403);
    const st = await loadState(db, t);
    if (m === 'GET') {
      const base0 = new URL(base.replace(/\/?$/, '/'), url.origin).toString();
      const links = {};
      for (const r of st.rooms) links[r.id] = secret ? `${base0}api/ical/${encodeURIComponent(r.id)}.ics?k=${await icalKey(secret, t, r.id)}` : '';
      return json({ ok: true, feeds: await listFeeds(db, t), links, pulls: await pulls(db, t) });
    }
    const b = (await readJson(request)) || {};
    try {
      if (b.op === 'add') {
        if (!st.rooms.some(r => r.id === b.room)) return json({ ok: false, msg: 'ნომერი ვერ მოიძებნა' }, 400);
        const id = await addFeed(db, t, b);
        const f = (await listFeeds(db, t)).find(x => x.id === id);
        const r = await syncFeed(db, t, f);
        await logAct(db, t, u, 'ical', 'room:' + b.room, `${f.name} · ნომერი ${b.room}${r.ok ? ` · ${r.events} ჯავშანი` : ' · ' + r.error}`);
        return json({ ok: true, sync: r });
      }
      const f = (await listFeeds(db, t)).find(x => x.id === b.id);
      if (!f) return json({ ok: false, msg: 'ვერ მოიძებნა' }, 404);
      if (b.op === 'remove') { await removeFeed(db, t, f.id); await logAct(db, t, u, 'ical', 'room:' + f.room, `${f.name} · ნომერი ${f.room} · მოიხსნა`); return json({ ok: true }); }
      if (b.op === 'sync') return json({ ok: true, sync: await syncFeed(db, t, f) });
    } catch (e) { return json({ ok: false, msg: e.message }, 400); }
    return json({ ok: false, msg: 'unknown op' }, 400);
  }
  if (route === 'help' && m === 'POST') {
    if (!u.owner || u.support) return json({ ok: false, msg: 'დახმარებას მხოლოდ მფლობელი უშვებს' }, 403);
    const b = (await readJson(request)) || {};
    const until = await grantHelp(db, t, u.name, b.hours);
    await logAct(db, t, u, 'help', 'visit2', until ? `დახმარება დაშვებულია ${b.hours} საათით` : 'დახმარება გაუქმდა');
    return json({ ok: true, until });
  }
  // Facebook / Instagram chat: status, "Connect Facebook", choosing a page, disconnecting (owner only)
  if (route === 'meta') {
    const ready = !!(env.META_APP_ID && env.META_APP_SECRET && encKey(env) && secret);
    if (m === 'GET') {
      const pages = await hotelPages(db, t);
      const choose = ready && u.owner ? (await pendingPages(env, t)).map(x => ({ id: x.id, name: x.name, ig: !!x.ig })) : [];
      return json({ ok: true, ready, pages, choose });
    }
    if (!u.owner || u.support) return json({ ok: false, msg: 'Facebook-ს მხოლოდ მფლობელი აერთებს' }, 403);
    if (!ready) return json({ ok: false, msg: 'Facebook-ის მიერთება მალე ჩაირთვება.' }, 503);
    const b = (await readJson(request)) || {};
    if (b.do === 'start') return json({ ok: true, url: await metaStartUrl(env, t) });
    if (b.do === 'pick') {
      const pg = (await pendingPages(env, t)).find(x => x.id === String(b.id || ''));
      if (!pg) return json({ ok: false, msg: 'სია ძველია. დააჭირე „Facebook-ის მიერთებას“ თავიდან.' }, 400);
      const r = await pick(env, t, pg);
      const ok = /meta=connected/.test(r.headers.get('location') || '');
      if (ok) await logAct(db, t, u, 'meta', 'visit2', 'Facebook გვერდი მიუერთდა: ' + pg.name);
      return json({ ok, msg: ok ? '' : 'ვერ მიუერთდა. სცადე თავიდან.' });
    }
    if (b.do === 'off') { await disconnectPages(db, t); await logAct(db, t, u, 'meta', 'visit2', 'Facebook გვერდი გამოეთიშა'); return json({ ok: true }); }
    return json({ ok: false }, 400);
  }
  // the hotel's bank for prepayment: Visit2 turns the service on; the owner enters the bank's credentials here
  if (route === 'pay') {
    const addon = t.plan === 'free' || (t.addons || []).includes('pay'), ready = !!encKey(env);
    if (m === 'GET') return json({ ok: true, addon, ready, banks: BANKS, account: await accountInfo(db, t) });
    if (!u.owner || u.support) return json({ ok: false, msg: 'ბანკს მხოლოდ მფლობელი აერთებს' }, 403);
    if (!addon) return json({ ok: false, msg: 'ონლაინ გადახდის სერვისს Visit2.ge რთავს. მოგვწერეთ და ჩაგირთავთ.' }, 403);
    if (!ready) return json({ ok: false, msg: 'ბანკის მიერთება მალე ჩაირთვება.' }, 503);
    const b = (await readJson(request)) || {};
    if (b.do === 'off') { await removeAccount(db, t); await logAct(db, t, u, 'pay', 'visit2', 'ბანკი გამოეთიშა'); return json({ ok: true }); }
    if (b.do === 'save') {
      const c = { bank: BANKS[b.bank] ? b.bank : '', id: String(b.id || '').trim().slice(0, 120), secret: String(b.secret || '').trim().slice(0, 300), apikey: String(b.apikey || '').trim().slice(0, 300) };
      if (!c.bank || !c.id || !c.secret || (c.bank === 'tbc' && !c.apikey)) return json({ ok: false, msg: 'შეავსეთ ყველა ველი, როგორც ბანკმა მოგცათ.' }, 400);
      if (!(await checkCreds(env, c))) return json({ ok: false, msg: 'ბანკმა ეს მონაცემები ვერ მიიღო. შეამოწმეთ და სცადეთ ხელახლა.' }, 400);
      await saveAccount(db, t, encKey(env), c);
      await logAct(db, t, u, 'pay', 'visit2', BANKS[c.bank] + ' მიუერთდა');
      return json({ ok: true, account: await accountInfo(db, t) });
    }
    return json({ ok: false }, 400);
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
      case 'mypass': { await changeMyPassword(db, t, me, b.old, b.password); await logAct(db, t, me, 'user-pass', 'user:' + me.id, me.name); return json({ ok: true, out: true }); }
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
