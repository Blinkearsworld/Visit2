// The guests' catalogue on Visit2.ge: real hotels that are open, with what a guest needs to choose one.
// Only public facts leave here: name, town, photo, kind, pin, amenities, the lowest price and, for given dates,
// whether a room is free and what it costs. Bookings themselves (names, phones, dates of others) never do.
import { loadState } from './hotel.js';
import { getContent } from './content.js';
import { findOffer, roomsOffer, kidPrice } from '../lib/availability.js';
import { nights } from '../lib/time.js';

const KINDS = ['mountain', 'sea', 'history', 'wine', 'food', 'nature', 'city'];
const pick = v => (v == null ? '' : typeof v === 'string' ? v : v.ka || v.en || v.ru || '');

// hotels listed: open (trial or active), in their first 6 months or with the catalogue service, with prices and a main photo, so no card looks broken
export async function catalog(db, { siteOf, from = '', to = '', guests = 2, rooms = 1, kids = 0 } = {}) {
  const r = await db.prepare("SELECT * FROM tenants WHERE status IN ('trial', 'active') ORDER BY created").all();
  const dated = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && to > from;
  const out = [], free = new Date(Date.now() - 183 * 864e5).toISOString();
  for (const row of r.results || []) {
    // a place in the catalogue: free for the first 6 months, then the paid "catalog" service (switched in Visit2's admin)
    if (String(row.addons || '').includes('"hidden"')) continue; // still being set up (ops)
    if (!(row.created >= free || row.plan === 'free' || String(row.addons || '').includes('"catalog"'))) continue;
    const t = { id: row.id, slug: row.slug, name: row.name, city: row.city };
    const [{ content }, st] = await Promise.all([getContent(db, t), loadState(db, t)]);
    const s = content.site || {};
    if (!s.hero?.img) continue;
    const prices = Object.values(st.types).flatMap(ty => ty.rates.flatMap(x => Object.values(x.price || {}).map(Number))).filter(v => v > 0);
    if (!prices.length || !st.rooms.length) continue;
    // a hotel with its own domain is linked there (villajiji.com), the others on their Visit2 address
    const own = await db.prepare("SELECT host FROM domains WHERE tenant_id = ? AND kind = 'custom' AND host NOT LIKE 'www.%' ORDER BY host LIMIT 1").bind(t.id).first();
    const site = own ? `https://${own.host}/` : siteOf(t);
    const abs = src => (/^https:\/\//.test(src) ? src : site + String(src).replace(/^\//, ''));
    const h = {
      slug: t.slug, name: t.name, city: t.city || '', url: site, real: true,
      img: abs(s.hero.img), tagline: pick(s.hero?.tagline).slice(0, 160),
      kinds: (Array.isArray(s.kinds) ? s.kinds : [s.kind]).filter(k => KINDS.includes(k)).slice(0, 2),
      lat: s.pin?.lat ?? null, lng: s.pin?.lng ?? null,
      amenities: Array.isArray(s.amenities) ? s.amenities : [],
      minFrom: Math.min(...prices),
      cap: Math.max(0, ...Object.values(st.types).map(ty => ty.cap || 0)),
      roomTypes: Object.values(st.types).map(ty => pick(ty.name)).filter(Boolean).slice(0, 8),
      rooms: st.rooms.length,
      instant: !!(s.instant && s.instant.on),
      kids: s.kids && ['free', 'fixed'].includes(s.kids.mode) ? { mode: s.kids.mode, price: +s.kids.price || 0 } : { mode: 'adult' },
    };
    if (dated) {
      if (rooms > 1) {
        const o = roomsOffer(st, from, to, guests, rooms, kids, s.kids || null);
        h.offer = o.parts ? { total: o.total, type: o.parts.map(x => x.name).join(', '), n: nights(from, to), rooms: o.parts.length } : null;
        if (!o.parts) h.freeRooms = o.free;
      } else {
        const o = findOffer(st, from, to, guests);
        h.offer = o ? { total: kidPrice(st, o.type, from, to, guests, Math.min(kids, guests - 1), s.kids || null), type: o.name, typeId: o.type, n: nights(from, to) } : null;
      }
    }
    out.push(h);
  }
  return out;
}
