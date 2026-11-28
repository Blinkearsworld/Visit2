// Availability, prices and offers for one hotel. Pure functions over a loaded state (see src/db/hotel.js loadState):
//   st = { seasons: [{id, from, to}], types: {id: {name, rates, cap}}, rooms: [{id, type}], settings: {}, bookings: [...] }
// Ported from Villa JIJI functions/_lib/core.js. The one change: the season of a night comes from the hotel's
// seasons table (st.seasons) instead of fixed Bakuriani dates.
import { today, addDays, nights, isDate } from './time.js';
import { seasonOf as seasonFrom } from './seasons.js';

export const seasonOf = (st, d) => seasonFrom(st.seasons || [], d);

// ---------- availability (works on a loaded state) ----------
const overlaps = (a1, b1, a2, b2) => a1 < b2 && a2 < b1;
// a room is taken by a confirmed booking or closed by the hotel (repairs, own use)
export const roomFree = (st, roomId, from, to, ignoreId) =>
  !st.bookings.some(x => x.status === 'confirmed' && x.room === roomId && x.id !== ignoreId && overlaps(from, to, x.from, x.to))
  && !(st.blocks || []).some(x => x.room === roomId && x.id !== ignoreId && overlaps(from, to, x.from, x.to));
export const freeRooms = (st, type, from, to) => st.rooms.filter(r => r.type === type && roomFree(st, r.id, from, to)).map(r => r.id);
export const rateFor = (st, type, guests) => (st.types[type]?.rates || []).find(r => r.guests >= (guests || 1)) || null;
export function quote(st, type, from, to, guests) {
  const r = rateFor(st, type, guests) || (st.types[type]?.rates || []).slice(-1)[0];
  if (!r) return 0;
  let sum = 0;
  for (let d = from; d < to; d = addDays(d, 1)) sum += r.price[seasonOf(st, d)] || 0;
  return sum;
}
export function findOffer(st, from, to, guests) {
  let best = null;
  for (const t of Object.keys(st.types)) {
    if (!rateFor(st, t, guests)) continue;
    const free = freeRooms(st, t, from, to); if (!free.length) continue;
    const total = quote(st, t, from, to, guests);
    if (!best || total < best.total) best = { type: t, name: st.types[t].name, total, free: free.length };
  }
  return best;
}
// Several rooms at once: guests spread as evenly as possible over n free rooms, each part in the cheapest free room
// that holds it (any type). Returns { total, parts: [{room, type, name, guests, total}], free } or { free } when it cannot.
export function roomsOffer(st, from, to, guests, n, kids = 0, rule = null) {
  const free = st.rooms.filter(r => roomFree(st, r.id, from, to));
  n = Math.max(1, Math.min(n, guests));
  if (free.length < n) return { free: free.length };
  // adults spread evenly over the rooms, then the children: a family keeps grown-ups in every room
  kids = Math.max(0, Math.min(kids, guests - n));
  const even = (x, i) => Math.floor(x / n) + (i < x % n ? 1 : 0);
  const split = Array.from({ length: n }, (_, i) => ({ a: even(guests - kids, i), k: even(kids, n - 1 - i) }));
  const used = new Set(), parts = [];
  for (const { a, k } of split) {
    const g = a + k;
    let best = null;
    for (const r of free) {
      if (used.has(r.id) || !rateFor(st, r.type, g)) continue;
      const total = kidPrice(st, r.type, from, to, g, k, rule);
      if (!best || total < best.total) best = { room: r.id, type: r.type, name: st.types[r.type].name, guests: g, kids: k, total };
    }
    if (!best) return { free: free.length };
    used.add(best.room); parts.push(best);
  }
  return { total: parts.reduce((s, x) => s + x.total, 0), parts, free: free.length };
}
// The price of one room for `guests`, of whom `kids` are 2–12 years old, under the hotel's child rule
// (site content kids: { mode: 'free' | 'fixed', price }); without a rule children pay like adults.
export function kidPrice(st, type, from, to, guests, kids = 0, rule = null) {
  const apart = rule && (rule.mode === 'free' || rule.mode === 'fixed');
  const base = quote(st, type, from, to, Math.max(1, guests - (apart ? kids : 0)));
  return base + (rule && rule.mode === 'fixed' ? (+rule.price || 0) * kids * nights(from, to) : 0);
}
// A group too big for any single room: the cheapest pair of free rooms that holds everyone.
export const fitsOne = (st, guests) => Object.keys(st.types).some(t => rateFor(st, t, guests));
export function groupOffer(st, from, to, guests) {
  const free = st.rooms.filter(r => roomFree(st, r.id, from, to));
  let best = null;
  for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
    const A = free[i], B = free[j];
    for (let a = 1; a < guests; a++) {
      const b = guests - a;
      if (!rateFor(st, A.type, a) || !rateFor(st, B.type, b)) continue;
      const ta = quote(st, A.type, from, to, a), tb = quote(st, B.type, from, to, b);
      if (!best || ta + tb < best.total) best = { total: ta + tb, parts: [
        { from, to, type: A.type, guests: a, name: st.types[A.type].name, total: ta },
        { from, to, type: B.type, guests: b, name: st.types[B.type].name, total: tb }] };
    }
  }
  return best;
}
// Longest run of free nights inside the asked period (when the whole period is not free).
export function partialOffer(st, from, to, guests) {
  let best = null;
  for (const t of Object.keys(st.types)) {
    if (!rateFor(st, t, guests)) continue;
    for (const room of st.rooms.filter(r => r.type === t)) {
      let start = null;
      for (let d = from; ; d = addDays(d, 1)) {
        const free = d < to && roomFree(st, room.id, d, addDays(d, 1));
        if (free && start === null) start = d;
        if (!free && start !== null) {
          const n = nights(start, d), total = quote(st, t, start, d, guests);
          if (!best || n > best.n || (n === best.n && total < best.total)) best = { from: start, to: d, n, type: t, name: st.types[t].name, total };
          start = null;
        }
        if (d >= to) break;
      }
    }
  }
  return best && best.n < nights(from, to) ? best : null;
}
// The whole period with one change of room in the middle.
// the whole stay with room changes: each part as long as possible, so as few moves as possible (at most 3)
export function splitOffer(st, from, to, guests, maxParts = 4) {
  const parts = []; let p = from, total = 0;
  while (p < to) {
    let best = null;
    for (let q = to; q > p; q = addDays(q, -1)) { const o = findOffer(st, p, q, guests); if (o) { best = { from: p, to: q, ...o }; break; } }
    if (!best || parts.length >= maxParts) return null;
    parts.push(best); total += best.total; p = best.to;
  }
  return parts.length > 1 ? { parts, total } : null;
}
// ---------- short gaps (1–3 free nights between bookings) ----------
export const GAP_MAX = 3;
const roomBookings = (st, roomId) => [...st.bookings.filter(x => x.status === 'confirmed'), ...(st.blocks || [])].filter(x => x.room === roomId).sort((a, b) => a.from < b.from ? -1 : 1);
// free runs of 1..GAP_MAX nights that sit between two bookings
export function gaps(st, horizon = 60) {
  const t = today(), end = addDays(t, horizon), out = [];
  for (const room of st.rooms) {
    // only nights that sit between a guest leaving and the next one arriving
    let prev = null;
    for (const b of roomBookings(st, room.id)) {
      if (b.to < t) continue;
      if (prev !== null && b.from > prev) {
        const from = prev > t ? prev : t, n = b.from > from ? nights(from, b.from) : 0;
        if (n >= 1 && n <= GAP_MAX && from <= end) out.push({ room: room.id, type: room.type, from, to: b.from, n });
      }
      if (prev === null || b.to > prev) prev = b.to;
    }
  }
  return out.sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : a.n - b.n);
}
export const gapDiscount = st => Math.max(0, Math.min(50, parseInt(st.settings?.gapDiscount) || 0));

// ---------- short offers: the automatic gaps (with the hotel's edits) and the hotel's own promotions ----------
// settings.gapEdits = { 'room|from|to': { pct } | { price } | { hide: true } }, settings.promos = [{ id, room, from, to, price, label }]
const parseJ = (v, d) => { try { const x = JSON.parse(v); return x == null ? d : x; } catch (e) { return d; } };
export const gapKey = g => `${g.room}|${g.from}|${g.to}`;
// price list for the chat: the season of `day` and the next one that starts within 60 days;
// per room type the lowest and highest night price (it depends on the number of guests)
export function priceTable(st, day = today()) {
  const out = [];
  for (let i = 0, prev = null; i < 60 && out.length < 2; i++) {
    const d = addDays(day, i), s = seasonOf(st, d);
    if (s !== prev) { out.push({ season: s, from: d, now: i === 0 }); prev = s; }
  }
  return out.map(x => ({ ...x, rows: Object.entries(st.types).map(([id, t]) => {
    const p = (t.rates || []).map(r => +r.price?.[x.season] || 0).filter(v => v > 0);
    return p.length ? { id, name: t.name, min: Math.min(...p), max: Math.max(...p) } : null;
  }).filter(Boolean).sort((a, b) => a.min - b.min) }));
}

export function deals(st, horizon = 60) {
  const S = st.settings || {}, edits = parseJ(S.gapEdits, {}), promos = parseJ(S.promos, []), t = today(), def = gapDiscount(st);
  let out = [];
  for (const g of gaps(st, horizon)) {
    const e = edits[gapKey(g)] || {};
    if (e.hide) continue;
    out.push({ key: 'g:' + gapKey(g), kind: 'gap', room: g.room, type: g.type, from: g.from, to: g.to, n: g.n,
      price: +e.price > 0 ? Math.round(+e.price) : null, pct: +e.price > 0 ? 0 : (e.pct != null && e.pct !== '' ? Math.max(0, Math.min(90, +e.pct || 0)) : def) });
  }
  for (const p of Array.isArray(promos) ? promos : []) {
    const room = (st.rooms || []).find(r => r.id === p.room);
    if (!room || !isDate(p.from) || !isDate(p.to) || p.to <= p.from || p.from < t || !(+p.price > 0)) continue;
    if (!roomFree(st, p.room, p.from, p.to)) continue; // booked meanwhile: the promotion is not shown
    out = out.filter(x => !(x.room === p.room && x.from === p.from && x.to === p.to)); // a promotion replaces the gap
    out.push({ key: 'p:' + p.id, kind: 'promo', room: p.room, type: room.type, from: p.from, to: p.to, n: nights(p.from, p.to), price: Math.round(+p.price), pct: 0, label: String(p.label || '').slice(0, 60) });
  }
  return out.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.n - b.n));
}
export const dealTotal = (st, d, guests) => (d.price ? d.price : Math.round(quote(st, d.type, d.from, d.to, guests) * (100 - (d.pct || 0)) / 100));
export const dealNote = d => (d.kind === 'promo' ? 'აქცია' + (d.label ? ' · ' + d.label : '') : d.price ? 'ფანჯარა · სპეც. ფასი' : d.pct ? `ფანჯარა −${d.pct}%` : 'ფანჯარა');

// the room that leaves the fewest short gaps around a stay
export function bestRoom(st, type, from, to) {
  const pen = g => g === null ? 2 : g === 0 ? 0 : g <= GAP_MAX ? 10 : 3;
  let best = null, bestScore = Infinity;
  for (const room of st.rooms.filter(r => r.type === type && roomFree(st, r.id, from, to))) {
    const bs = roomBookings(st, room.id);
    const before = bs.filter(x => x.to <= from).pop(), after = bs.find(x => x.from >= to);
    const score = pen(before ? nights(before.to, from) : null) + pen(after ? nights(to, after.from) : null);
    if (score < bestScore) { best = room.id; bestScore = score; }
  }
  return best;
}
// the same stay a few days later; further than a week is not a useful suggestion
export function nextOffer(st, from, n, guests, days = 7) {
  for (let i = 1; i <= days; i++) {
    const f = addDays(from, i), o = findOffer(st, f, addDays(f, n), guests);
    if (o) return { from: f, to: addDays(f, n), ...o };
  }
  return null;
}
