// The hotel's own services and the charges on a booking. Every function takes the tenant (t) first.
import { nights as nightsOf, nowIso, isDate, today } from '../lib/time.js';

export const UNITS = ['stay', 'night', 'guest', 'guest_night', 'item'];
const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);
const rowToService = r => ({ id: r.id, name: r.name, nameEn: r.name_en || '', nameRu: r.name_ru || '', price: r.price, unit: r.unit, online: r.online ? 1 : 0, active: r.active ? 1 : 0 });
export const rowToItem = r => ({ id: r.id, booking: r.booking, service: r.service || '', name: r.name, price: r.price, qty: r.qty, amount: r.amount, date: r.date || '', source: r.source || '' });

// all services (admin) or only those guests can add when booking (site)
export async function listServices(db, t, { online = false } = {}) {
  const r = await db.prepare(`SELECT * FROM services WHERE tenant_id = ?${online ? ' AND online = 1 AND active = 1' : ''} ORDER BY sort, name`).bind(t.id).all();
  return (r.results || []).map(rowToService);
}

// the whole list is saved at once from the admin editor; removed services disappear, past charges keep their name and price
export async function saveServices(db, t, list) {
  if (!Array.isArray(list)) throw new Error('bad list');
  const clean = list.slice(0, 100).map((s, i) => ({
    id: /^[\w-]{4,20}$/.test(s.id || '') ? s.id : uid(),
    name: String(s.name || '').trim().slice(0, 60), nameEn: String(s.nameEn || '').trim().slice(0, 60), nameRu: String(s.nameRu || '').trim().slice(0, 60),
    price: Math.max(0, Math.min(100000, Math.round(+s.price || 0))), unit: UNITS.includes(s.unit) ? s.unit : 'item',
    online: s.online ? 1 : 0, active: s.active === 0 || s.active === false ? 0 : 1, sort: i,
  })).filter(s => s.name);
  await db.batch([
    db.prepare('DELETE FROM services WHERE tenant_id = ?').bind(t.id),
    ...clean.map(s => db.prepare('INSERT INTO services (tenant_id, id, name, name_en, name_ru, price, unit, online, active, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(t.id, s.id, s.name, s.nameEn || null, s.nameRu || null, s.price, s.unit, s.online, s.active, s.sort)),
  ]);
  return clean;
}

// how many units a service counts for a stay: once, every night, every guest, every guest every night, or the pieces/hours asked
export function unitsFor(unit, { from, to, guests }, qty) {
  const n = Math.max(1, nightsOf(from, to) || 1), g = Math.max(1, guests || 1);
  if (unit === 'stay') return 1;
  if (unit === 'night') return n;
  if (unit === 'guest') return g;
  if (unit === 'guest_night') return n * g;
  return Math.max(1, Math.min(99, parseInt(qty) || 1));
}

// services the guest chose on the booking form: only the hotel's online services, priced here (never by the browser)
export async function pickExtras(db, t, extras, stay) {
  if (!Array.isArray(extras) || !extras.length) return [];
  const all = await listServices(db, t, { online: true });
  const out = [];
  for (const e of extras.slice(0, 20)) {
    const s = all.find(x => x.id === e?.id);
    if (!s || out.some(o => o.service === s.id)) continue;
    const qty = unitsFor(s.unit, stay, e.qty);
    out.push({ service: s.id, name: s.name, price: s.price, qty, amount: s.price * qty });
  }
  return out;
}

export const addItemsStmts = (db, t, booking, items, source) => items.map(x => db.prepare(
  'INSERT INTO booking_items (tenant_id, id, booking, service, name, price, qty, amount, date, source, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .bind(t.id, uid(), booking, x.service || null, x.name, x.price, x.qty, x.amount, x.date || null, source, nowIso()));

// a charge added by staff: a service from the list (its price unless changed) or a one-off with its own name and price
export async function addItem(db, t, booking, { service, name, price, qty, date }) {
  let s = null;
  if (service) {
    s = await db.prepare('SELECT * FROM services WHERE tenant_id = ? AND id = ?').bind(t.id, service).first();
    if (!s) throw new Error('სერვისი ვერ მოიძებნა');
  }
  const nm = String(name || s?.name || '').trim().slice(0, 60);
  if (!nm) throw new Error('ჩაწერეთ სერვისის სახელი');
  const pr = price != null && price !== '' ? Math.max(0, Math.min(100000, Math.round(+price || 0))) : s ? s.price : 0;
  const q = Math.max(1, Math.min(999, parseInt(qty) || 1));
  const it = { id: uid(), booking, service: s ? s.id : null, name: nm, price: pr, qty: q, amount: pr * q, date: isDate(date) ? date : today(), source: 'admin' };
  await db.prepare('INSERT INTO booking_items (tenant_id, id, booking, service, name, price, qty, amount, date, source, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(t.id, it.id, booking, it.service, it.name, it.price, it.qty, it.amount, it.date, it.source, nowIso()).run();
  return it;
}

export const getItem = (db, t, id) => db.prepare('SELECT * FROM booking_items WHERE tenant_id = ? AND id = ?').bind(t.id, id).first();
export const removeItem = (db, t, id) => db.prepare('DELETE FROM booking_items WHERE tenant_id = ? AND id = ?').bind(t.id, id).run();
export async function itemsOf(db, t, ids) {
  if (!ids.length) return [];
  const r = await db.prepare(`SELECT * FROM booking_items WHERE tenant_id = ? AND booking IN (${ids.map(() => '?').join(',')}) ORDER BY date, created`).bind(t.id, ...ids).all();
  return (r.results || []).map(rowToItem);
}
