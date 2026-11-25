// One hotel's rooms, prices and bookings. Every function takes the tenant (t) first; tenant_id is in every query.
// Ported from Villa JIJI functions/_lib/core.js (loadState, createRequest, bumpRev).
import { today, addDays, nights, isDate, nowIso } from '../lib/time.js';
import { getSeasons } from './settings.js';
import { deals, rateFor, freeRooms, quote, findOffer, roomsOffer, dealTotal, dealNote } from '../lib/availability.js';

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
  prevStatus: r.prev_status, deletedAt: r.deleted_at, remark: r.remark || '', wish: r.wish || '', wantRoom: r.want_room || '', children: r.children || 0, grp: r.grp || '' });

// Everything needed to answer availability questions. `full` adds guest details (admin only).
export async function loadState(db, t, { full = false } = {}) {
  const id = t.id;
  const [types, rooms, settings, seasons, bookings, payments, notes] = await Promise.all([
    db.prepare('SELECT * FROM types WHERE tenant_id = ? ORDER BY sort').bind(id).all(),
    db.prepare('SELECT id, type FROM rooms WHERE tenant_id = ? ORDER BY sort, id').bind(id).all(),
    db.prepare('SELECT k, v FROM settings WHERE tenant_id = ?').bind(id).all(),
    getSeasons(db, t),
    full
      ? db.prepare("SELECT * FROM bookings WHERE tenant_id = ? AND (status NOT IN ('declined', 'deleted') OR created > ? OR deleted_at > ?) ORDER BY created DESC")
        .bind(id, addDays(today(), -60), addDays(today(), -90)).all()
      : db.prepare("SELECT id, room, type, date_from, date_to FROM bookings WHERE tenant_id = ? AND status = 'confirmed' AND date_to >= ?").bind(id, today()).all(),
    full ? db.prepare('SELECT id, booking, amount, method, date, created FROM payments WHERE tenant_id = ? ORDER BY date').bind(id).all() : null,
    full ? db.prepare('SELECT k, note, bday FROM guest_notes WHERE tenant_id = ?').bind(id).all() : null,
  ]);
  const T = {};
  for (const ty of types.results) {
    let rates = []; try { rates = JSON.parse(ty.rates) || []; } catch (e) { /* bad row: no prices */ }
    rates.sort((a, b) => a.guests - b.guests);
    T[ty.id] = { name: ty.name, rates, cap: rates.length ? rates[rates.length - 1].guests : 0 };
  }
  const S = { ...DEFAULT_SETTINGS };
  for (const s of settings.results) S[s.k] = s.v;
  return {
    seasons,
    types: T,
    rooms: rooms.results.map(r => ({ id: r.id, type: r.type })),
    settings: S,
    bookings: bookings.results.map(r => full ? rowToBooking(r)
      : { id: r.id, room: r.room, type: r.type, from: r.date_from, to: r.date_to, status: 'confirmed' }),
    ...(full ? {
      payments: payments.results,
      guestNotes: Object.fromEntries(notes.results.filter(r => r.note).map(r => [r.k, r.note])),
      guestBdays: Object.fromEntries(notes.results.filter(r => r.bday).map(r => [r.k, r.bday])),
    } : {}),
  };
}

// A number that changes on every write, so the admin panel can poll cheaply and reload only when something changed.
export const bumpRev = (db, t) => db.prepare("INSERT INTO settings (tenant_id, k, v) VALUES (?, 'rev', ?) ON CONFLICT (tenant_id, k) DO UPDATE SET v = excluded.v")
  .bind(t.id, String(Date.now())).run();

// ---------- booking request from the site or the chatbot ----------
export async function createRequest(db, t, st, { from, to, guests, name, phone, source, type: wanted, gap, deal, wish, children, rooms }) {
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
  if (rooms > 1) return createGroup(db, t, st, { from, to, guests, name, phone, source, wish, children, rooms });
  // a short offer (gap or promotion): the server takes its price, never the browser's
  const D = deals(st).find(x => (deal ? x.key === deal : gap && x.type === wanted) && x.from === from && x.to === to && rateFor(st, x.type, guests));
  if (D) wanted = D.type;
  const fits = wanted && st.types[wanted] && rateFor(st, wanted, guests) && freeRooms(st, wanted, from, to).length;
  const offer = fits ? { type: wanted, total: quote(st, wanted, from, to, guests) } : findOffer(st, from, to, guests);
  const type = offer ? offer.type : (Object.keys(st.types).find(k => rateFor(st, k, guests)) || Object.keys(st.types)[0]);
  const full = offer ? offer.total : quote(st, type, from, to, guests);
  const price = D ? dealTotal(st, D, guests) : full;
  const note = D ? dealNote(D) : '';
  // the same request sent again (a retry after a lost connection) is not stored twice
  const dup = await db.prepare("SELECT * FROM bookings WHERE tenant_id = ? AND phone = ? AND date_from = ? AND date_to = ? AND type = ? AND status = 'pending' AND created > ?")
    .bind(t.id, phone, from, to, type, new Date(Date.now() - 30 * 60e3).toISOString()).first();
  if (dup) return { booking: rowToBooking(dup), total: dup.price, typeName: st.types[type]?.name, repeat: true };
  const b = { id: uid(), room: null, type, from, to, guests, name, phone, status: 'pending', source: String(source || 'site').slice(0, 20),
    created: nowIso(), price, note, wish, wantRoom: D ? D.room : '', children };
  await db.prepare('INSERT INTO bookings (tenant_id, id, room, type, date_from, date_to, guests, name, phone, status, source, created, price, note, wish, want_room, children) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(t.id, b.id, null, b.type, b.from, b.to, b.guests, b.name, b.phone, b.status, b.source, b.created, b.price, b.note, b.wish, b.wantRoom || null, children).run();
  await bumpRev(db, t);
  return { booking: b, total: price, typeName: st.types[type]?.name };
}

async function createGroup(db, t, st, { from, to, guests, name, phone, source, wish, children, rooms }) {
  const o = roomsOffer(st, from, to, guests, rooms);
  if (!o.parts) throw new Error(`only ${o.free} rooms free`);
  const dup = await db.prepare("SELECT grp FROM bookings WHERE tenant_id = ? AND phone = ? AND date_from = ? AND date_to = ? AND grp IS NOT NULL AND status = 'pending' AND created > ? LIMIT 1")
    .bind(t.id, phone, from, to, new Date(Date.now() - 30 * 60e3).toISOString()).first();
  if (dup) return { booking: { id: dup.grp, grp: dup.grp }, total: o.total, typeName: o.parts.map(x => x.name).join(', '), repeat: true };
  const grp = uid(), created = nowIso(), src = String(source || 'site').slice(0, 20);
  let kids = children;
  const rows = o.parts.map(x => { const c = Math.min(kids, x.guests - 1); kids -= c; return { id: uid(), type: x.type, guests: x.guests, price: x.total, children: c }; });
  await db.batch(rows.map(r => db.prepare('INSERT INTO bookings (tenant_id, id, room, type, date_from, date_to, guests, name, phone, status, source, created, price, note, wish, want_room, children, grp) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)')
    .bind(t.id, r.id, r.type, from, to, r.guests, name, phone, 'pending', src, created, r.price, '', wish, r.children, grp)));
  await bumpRev(db, t);
  return { booking: { id: grp, grp, rooms: rows.length }, total: o.total, typeName: o.parts.map(x => x.name).join(', ') };
}
