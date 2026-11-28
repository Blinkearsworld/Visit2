// One hotel's rooms, prices and bookings. Every function takes the tenant (t) first; tenant_id is in every query.
// Ported from Villa JIJI functions/_lib/core.js (loadState, createRequest, bumpRev).
import { today, addDays, nights, isDate, nowIso } from '../lib/time.js';
import { getSeasons } from './settings.js';
import { releaseHolds, payAmount, HOLD_MIN } from './pay.js';
import { listServices, pickExtras, addItemsStmts, rowToItem } from './services.js';
import { readPlans, planPrice, planTag, PRIVATE_SETTINGS, stayCheck, findCode } from '../lib/plans.js';
import { deals, rateFor, freeRooms, quote, findOffer, roomsOffer, roomFree, bestRoom, kidPrice, dealTotal, dealNote } from '../lib/availability.js';

export const DEFAULT_SETTINGS = { seasonMode: 'auto', winterFrom: '11-15', winterTo: '03-31', gapDiscount: '10' };
export const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

// ---------- sample rooms and prices for a new hotel (the owner changes them in admin) ----------
const R = (guests, off, summer, winter, peak) => ({ guests, price: { peak, winter, summer, off } });
export const SAMPLE_TYPES = {
  std: { name: 'სტანდარტული ორადგილიანი', rates: [R(1, 90, 120, 150, 200), R(2, 110, 140, 180, 240)] },
  family: { name: 'საოჯახო, 1 საძინებლით (4+1)', rates: [R(2, 150, 200, 240, 320), R(3, 165, 220, 265, 350), R(4, 180, 240, 290, 380), R(5, 195, 260, 310, 410)] },
  suite: { name: 'ლუქსი, 2 საძინებლით', rates: [R(2, 210, 290, 370, 480), R(4, 280, 380, 460, 600), R(6, 340, 460, 550, 710)] },
};
export const SAMPLE_ROOMS = [['1', 'std'], ['2', 'std'], ['3', 'family'], ['4', 'family'], ['5', 'suite']];

export async function seedSample(db, t, types = SAMPLE_TYPES, rooms = SAMPLE_ROOMS) {
  const st = [];
  Object.entries(types).forEach(([id, ty], i) => st.push(
    db.prepare('INSERT INTO types (tenant_id, id, name, rates, sort) VALUES (?, ?, ?, ?, ?)').bind(t.id, id, ty.name, JSON.stringify(ty.rates), i)));
  rooms.forEach(([id, type], i) => st.push(
    db.prepare('INSERT INTO rooms (tenant_id, id, type, sort) VALUES (?, ?, ?, ?)').bind(t.id, id, type, i)));
  Object.entries(DEFAULT_SETTINGS).forEach(([k, v]) => st.push(
    db.prepare('INSERT OR IGNORE INTO settings (tenant_id, k, v) VALUES (?, ?, ?)').bind(t.id, k, v)));
  await db.batch(st);
}

// ---------- state ----------
export const rowToBooking = r => ({ id: r.id, room: r.room, type: r.type, from: r.date_from, to: r.date_to, guests: r.guests,
  name: r.name, phone: r.phone, status: r.status, source: r.source, created: r.created, price: r.price, note: r.note,
  prevStatus: r.prev_status, deletedAt: r.deleted_at, remark: r.remark || '', wish: r.wish || '', wantRoom: r.want_room || '', children: r.children || 0, grp: r.grp || '', instant: r.instant ? 1 : 0,
  payState: r.pay_state || '', payUntil: r.pay_until || '', payAmount: r.pay_amount || 0,
  plan: (() => { try { return r.plan ? JSON.parse(r.plan) : null; } catch (e) { return null; } })(), cancelledAt: r.cancelled_at || '', fee: r.fee ?? null, noShow: r.no_show ? 1 : 0, agent: r.agent || '', code: r.code || '',
  checkedIn: r.checked_in || '', checkedOut: r.checked_out || '', invoice: (() => { try { return r.invoice ? JSON.parse(r.invoice) : null; } catch (e) { return null; } })() });

// Everything needed to answer availability questions. `full` adds guest details (admin only).
export async function loadState(db, t, { full = false } = {}) {
  const id = t.id;
  await releaseHolds(db, t); // unpaid holds past their time free their rooms before anyone looks
  const [types, rooms, settings, seasons, bookings, payments, notes, services, items, blocks, expenses, issues] = await Promise.all([
    db.prepare('SELECT * FROM types WHERE tenant_id = ? ORDER BY sort').bind(id).all(),
    db.prepare('SELECT id, type, hk, hk_at FROM rooms WHERE tenant_id = ? ORDER BY sort, id').bind(id).all(),
    db.prepare('SELECT k, v FROM settings WHERE tenant_id = ?').bind(id).all(),
    getSeasons(db, t),
    full
      ? db.prepare("SELECT * FROM bookings WHERE tenant_id = ? AND (status NOT IN ('declined', 'deleted') OR created > ? OR deleted_at > ?) ORDER BY created DESC")
        .bind(id, addDays(today(), -60), addDays(today(), -90)).all()
      : db.prepare("SELECT id, room, type, date_from, date_to FROM bookings WHERE tenant_id = ? AND status = 'confirmed' AND date_to >= ?").bind(id, today()).all(),
    full ? db.prepare('SELECT id, booking, amount, method, date, created FROM payments WHERE tenant_id = ? ORDER BY date').bind(id).all() : null,
    full ? db.prepare('SELECT k, note, bday FROM guest_notes WHERE tenant_id = ?').bind(id).all() : null,
    listServices(db, t, { online: !full }),
    full ? db.prepare("SELECT * FROM booking_items WHERE tenant_id = ? AND booking IN (SELECT id FROM bookings WHERE tenant_id = ? AND (status NOT IN ('declined', 'deleted') OR created > ? OR deleted_at > ?)) ORDER BY date, created")
      .bind(id, id, addDays(today(), -60), addDays(today(), -90)).all() : null,
    db.prepare('SELECT id, room, date_from, date_to, reason, feed FROM room_blocks WHERE tenant_id = ? AND date_to >= ? ORDER BY date_from').bind(id, addDays(today(), full ? -60 : 0)).all(),
    full ? db.prepare('SELECT id, date, category, amount, method, note, by_name FROM expenses WHERE tenant_id = ? AND date >= ? ORDER BY date DESC').bind(id, addDays(today(), -400)).all() : null,
    full ? db.prepare("SELECT * FROM issues WHERE tenant_id = ? AND (status = 'open' OR done_at > ?) ORDER BY created DESC").bind(id, addDays(today(), -60)).all() : null,
  ]);
  const T = {};
  for (const ty of types.results) {
    let rates = []; try { rates = JSON.parse(ty.rates) || []; } catch (e) { /* bad row: no prices */ }
    rates.sort((a, b) => a.guests - b.guests);
    T[ty.id] = { name: ty.name, rates, cap: rates.length ? rates[rates.length - 1].guests : 0 };
  }
  const S = { ...DEFAULT_SETTINGS };
  for (const s of settings.results) if (full || !PRIVATE_SETTINGS(s.k)) S[s.k] = s.v;
  return {
    seasons,
    types: T,
    rooms: rooms.results.map(r => full ? { id: r.id, type: r.type, hk: r.hk || 'clean', hkAt: r.hk_at || '' } : { id: r.id, type: r.type }),
    settings: S,
    services,
    // rooms closed by the hotel; the reason is the hotel's own note, not shown to guests
    blocks: blocks.results.map(x => ({ id: x.id, room: x.room, from: x.date_from, to: x.date_to, ...(full ? { reason: x.reason || '', feed: x.feed || '' } : {}) })),
    bookings: bookings.results.map(r => full ? rowToBooking(r)
      : { id: r.id, room: r.room, type: r.type, from: r.date_from, to: r.date_to, status: 'confirmed' }),
    ...(full ? {
      payments: payments.results,
      items: items.results.map(rowToItem),
      expenses: expenses.results.map(x => ({ id: x.id, date: x.date, category: x.category, amount: x.amount, method: x.method || '', note: x.note || '', by: x.by_name || '' })),
      issues: issues.results.map(x => ({ id: x.id, room: x.room, text: x.text, status: x.status, by: x.by_name || '', created: x.created, doneAt: x.done_at || '', doneBy: x.done_by || '' })),
      guestNotes: Object.fromEntries(notes.results.filter(r => r.note).map(r => [r.k, r.note])),
      guestBdays: Object.fromEntries(notes.results.filter(r => r.bday).map(r => [r.k, r.bday])),
    } : {}),
  };
}

// A number that changes on every write, so the admin panel can poll cheaply and reload only when something changed.
export const bumpRev = (db, t) => db.prepare("INSERT INTO settings (tenant_id, k, v) VALUES (?, 'rev', ?) ON CONFLICT (tenant_id, k) DO UPDATE SET v = excluded.v")
  .bind(t.id, String(Date.now())).run();

// ---------- booking request from the site or the chatbot ----------
export async function createRequest(db, t, st, { from, to, guests, name, phone, source, type: wanted, gap, deal, wish, children, rooms, instant, kidRule, payRule, extras, plan: planId, code: codeIn }) {
  if (!isDate(from) || !isDate(to) || to <= from || from < today()) throw new Error('bad dates');
  if (nights(from, to) > 30) throw new Error('too long');
  guests = Math.max(1, Math.min(12, parseInt(guests) || 1));
  name = String(name || '').trim().slice(0, 80);
  phone = String(phone || '').trim().slice(0, 30);
  if (!name || phone.replace(/\D/g, '').length < 9) throw new Error('name and phone required');
  wish = String(wish || '').trim().slice(0, 500); // the guest's own special request; staff cannot change it
  // children under 10 are part of `guests` (they take places); kept apart so the hotel sees them
  children = Math.max(0, Math.min(guests - 1, parseInt(children) || 0));
  // several rooms at once (a family or a group): one row per room, tied together by grp
  rooms = Math.max(1, Math.min(10, guests, parseInt(rooms) || 1));
  if (instant && await instantToday(db, t, phone) >= 3) instant = false; // a few a day per phone; more go as requests
  // services the guest added (breakfast, transfer...): priced by the hotel's own list; they go on the first room of the booking
  const ext = await pickExtras(db, t, extras, { from, to, guests });
  // the price plan the guest chose (with breakfast, non-refundable...): only one of the hotel's own
  const plan = planId ? readPlans(st.settings).find(p => p.id === planId) || null : null;
  // the hotel's rules: fewest nights and days with no arrivals
  const sc = stayCheck(st.settings, from, to);
  if (!sc.ok) throw new Error(sc.noIn ? 'no arrivals that day' : `min ${sc.min} nights`);
  // a promo code: the server reads its own private list (the public state does not carry it)
  let code = null;
  if (codeIn) { const raw = await db.prepare("SELECT v FROM settings WHERE tenant_id = ? AND k = 'codes'").bind(t.id).first(); code = findCode({ codes: raw?.v }, codeIn, today()); }
  const codePct = code ? Math.max(0, Math.min(90, +code.pct || 0)) : 0, withCode = v => Math.round(v * (100 - codePct) / 100);
  const extTotal = ext.reduce((a, x) => a + x.amount, 0);
  if (rooms > 1) return createGroup(db, t, st, { from, to, guests, name, phone, source, wish, children, rooms, instant, kidRule, payRule, ext, extTotal, plan, codePct, code });
  // a short offer (gap or promotion): the server takes its price, never the browser's
  const D = deals(st).find(x => (deal ? x.key === deal : gap && x.type === wanted) && x.from === from && x.to === to && rateFor(st, x.type, guests));
  if (D) wanted = D.type;
  const fits = wanted && st.types[wanted] && rateFor(st, wanted, guests) && freeRooms(st, wanted, from, to).length;
  const offer = fits ? { type: wanted, total: quote(st, wanted, from, to, guests) } : findOffer(st, from, to, guests);
  const type = offer ? offer.type : (Object.keys(st.types).find(k => rateFor(st, k, guests)) || Object.keys(st.types)[0]);
  const full = kidPrice(st, type, from, to, guests, children, kidRule); // the same price the guest saw on the site
  const price = withCode(planPrice(D ? dealTotal(st, D, guests) : full, plan, guests, nights(from, to)));
  const note = [D ? dealNote(D) : '', plan ? plan.name : '', code ? `კოდი ${String(code.code).toUpperCase()} −${codePct}%` : ''].filter(Boolean).join(' · ');
  // the same request sent again (a retry after a lost connection) is not stored twice
  const dup = await db.prepare("SELECT * FROM bookings WHERE tenant_id = ? AND phone = ? AND date_from = ? AND date_to = ? AND type = ? AND status = 'pending' AND created > ?")
    .bind(t.id, phone, from, to, type, new Date(Date.now() - 30 * 60e3).toISOString()).first();
  if (dup) return { booking: rowToBooking(dup), total: dup.price + extTotal, typeName: st.types[type]?.name, repeat: true };
  const b = { id: uid(), room: null, type, from, to, guests, name, phone, status: 'pending', source: String(source || 'site').slice(0, 20),
    created: nowIso(), price, note, wish, wantRoom: D ? D.room : '', children, plan: planTag(plan), code: code ? String(code.code).toUpperCase() : '' };
  // instant booking: take a free room now; if someone took the last one a moment ago, it goes as a request
  if (instant && offer) {
    if (payRule) Object.assign(b, holdFor(payAmount(price + extTotal, payRule)));
    const rooms0 = st.rooms.filter(r => r.type === type && roomFree(st, r.id, from, to)).map(r => r.id);
    const first = D && D.room && rooms0.includes(D.room) ? D.room : bestRoom(st, type, from, to);
    for (const room of [first, ...rooms0.filter(x => x !== first)].filter(Boolean)) {
      if (await grabRoom(db, t, { ...b, room })) {
        if (ext.length) await db.batch(addItemsStmts(db, t, b.id, ext, 'site'));
        await bumpRev(db, t);
        return { booking: { ...b, room, status: 'confirmed', instant: 1 }, total: price + extTotal, extras: ext, typeName: st.types[type]?.name, instant: true, pay: b.payAmount || 0 };
      }
    }
  }
  await db.batch([db.prepare('INSERT INTO bookings (tenant_id, id, room, type, date_from, date_to, guests, name, phone, status, source, created, price, note, wish, want_room, children, plan, code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(t.id, b.id, null, b.type, b.from, b.to, b.guests, b.name, b.phone, b.status, b.source, b.created, b.price, b.note, b.wish, b.wantRoom || null, children, b.plan ? JSON.stringify(b.plan) : null, b.code || null),
    ...addItemsStmts(db, t, b.id, ext, 'site')]);
  await bumpRev(db, t);
  return { booking: b, total: price + extTotal, extras: ext, typeName: st.types[type]?.name };
}

async function createGroup(db, t, st, { from, to, guests, name, phone, source, wish, children, rooms, instant, kidRule, payRule, ext = [], extTotal = 0, plan = null, codePct = 0, code = null }) {
  const o = roomsOffer(st, from, to, guests, rooms, children, kidRule);
  if (o.parts && (plan || codePct)) { o.parts.forEach(x => { x.total = Math.round(planPrice(x.total, plan, x.guests, nights(from, to)) * (100 - codePct) / 100); }); o.total = o.parts.reduce((a, x) => a + x.total, 0); }
  const pt = planTag(plan), pnote = [plan ? plan.name : '', code ? `კოდი ${String(code.code).toUpperCase()} −${codePct}%` : ''].filter(Boolean).join(' · ');
  if (!o.parts) throw new Error(`only ${o.free} rooms free`);
  if (instant) {
    // every room of the group taken now, or none (then the group goes as a request)
    const grp = uid(), created = nowIso(), src = String(source || 'site').slice(0, 20), got = [], hold = payRule ? holdFor(payAmount(o.total + extTotal, payRule)) : {};
    for (const x of o.parts) {
      const b = { id: uid(), room: x.room, type: x.type, from, to, guests: x.guests, name, phone, source: src, created, price: x.total, note: pnote, wish, children: x.kids, grp, plan: pt, ...hold };
      if (!(await grabRoom(db, t, b))) break;
      got.push(b.id);
    }
    if (got.length === o.parts.length) {
      if (ext.length) await db.batch(addItemsStmts(db, t, got[0], ext, 'site'));
      await bumpRev(db, t);
      return { booking: { id: grp, grp, rooms: got.length, status: 'confirmed', instant: 1 }, total: o.total + extTotal, extras: ext, typeName: o.parts.map(x => x.name).join(', '), instant: true, pay: hold.payAmount || 0 };
    }
    if (got.length) await db.batch(got.map(id => db.prepare('DELETE FROM bookings WHERE tenant_id = ? AND id = ?').bind(t.id, id)));
  }
  const dup = await db.prepare("SELECT grp FROM bookings WHERE tenant_id = ? AND phone = ? AND date_from = ? AND date_to = ? AND grp IS NOT NULL AND status = 'pending' AND created > ? LIMIT 1")
    .bind(t.id, phone, from, to, new Date(Date.now() - 30 * 60e3).toISOString()).first();
  if (dup) return { booking: { id: dup.grp, grp: dup.grp }, total: o.total + extTotal, typeName: o.parts.map(x => x.name).join(', '), repeat: true };
  const grp = uid(), created = nowIso(), src = String(source || 'site').slice(0, 20);
  const rows = o.parts.map(x => ({ id: uid(), type: x.type, guests: x.guests, price: x.total, children: x.kids }));
  await db.batch([...rows.map(r => db.prepare('INSERT INTO bookings (tenant_id, id, room, type, date_from, date_to, guests, name, phone, status, source, created, price, note, wish, want_room, children, grp, plan) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)')
    .bind(t.id, r.id, r.type, from, to, r.guests, name, phone, 'pending', src, created, r.price, pnote, wish, r.children, grp, pt ? JSON.stringify(pt) : null)),
    ...addItemsStmts(db, t, rows[0].id, ext, 'site')]);
  await bumpRev(db, t);
  return { booking: { id: grp, grp, rooms: rows.length }, total: o.total + extTotal, extras: ext, typeName: o.parts.map(x => x.name).join(', ') };
}

// Puts a confirmed booking into a room only if the room is still free in the database at that moment
// (two guests pressing "book" at once: one gets the room, the other does not).
const holdFor = amount => (amount > 0 ? { payAmount: amount, payUntil: new Date(Date.now() + HOLD_MIN * 60e3).toISOString() } : {});
async function grabRoom(db, t, b) {
  const r = await db.prepare(`INSERT INTO bookings (tenant_id, id, room, type, date_from, date_to, guests, name, phone, status, source, created, price, note, wish, want_room, children, grp, instant, pay_state, pay_until, pay_amount, plan, code)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, NULL, ?, ?, 1, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM bookings WHERE tenant_id = ? AND room = ? AND status = 'confirmed' AND date_from < ? AND date_to > ?)`)
    .bind(t.id, b.id, b.room, b.type, b.from, b.to, b.guests, b.name, b.phone, b.source, b.created, b.price, b.note || '', b.wish || '', b.children || 0, b.grp || null,
      b.payAmount ? 'waiting' : null, b.payUntil || null, b.payAmount || null, b.plan ? JSON.stringify(b.plan) : null, b.code || null,
      t.id, b.room, b.to, b.from).run();
  return (r.meta?.changes || 0) > 0;
}
async function instantToday(db, t, phone) {
  const r = await db.prepare('SELECT COUNT(DISTINCT COALESCE(grp, id)) AS n FROM bookings WHERE tenant_id = ? AND phone = ? AND instant = 1 AND created > ?')
    .bind(t.id, phone, new Date(Date.now() - 864e5).toISOString()).first();
  return r?.n || 0;
}

// What the guest sees behind their booking link: their own booking only, without anyone else's data.
export async function guestBooking(db, t, id) {
  const r = await db.prepare('SELECT id, grp, type, date_from, date_to, guests, children, name, price, status, room, pay_state, pay_until, pay_amount FROM bookings WHERE tenant_id = ? AND (id = ? OR grp = ?) ORDER BY id').bind(t.id, id, id).all();
  const rows = r.results || [];
  if (!rows.length) return null;
  const it = await db.prepare(`SELECT name, qty, amount FROM booking_items WHERE tenant_id = ? AND booking IN (${rows.map(() => '?').join(',')}) ORDER BY date, created`).bind(t.id, ...rows.map(x => x.id)).all();
  const extras = (it.results || []).map(x => ({ name: x.name, qty: x.qty, amount: x.amount })), extTotal = extras.reduce((a, x) => a + x.amount, 0);
  return { id, extras, from: rows[0].date_from, to: rows[0].date_to, name: rows[0].name, status: rows.every(x => x.status === 'confirmed') ? 'confirmed' : rows.every(x => ['declined', 'deleted', 'cancelled'].includes(x.status)) ? 'cancelled' : 'pending',
    rooms: rows.map(x => ({ type: x.type, guests: x.guests, price: x.price })), total: rows.reduce((s, x) => s + (x.price || 0), 0) + extTotal,
    pay: rows[0].pay_state ? { state: rows[0].pay_state, until: rows[0].pay_until, amount: rows[0].pay_amount } : null };
}
