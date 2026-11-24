// The guests' catalogue on Visit2.ge: real hotels that are open, with what a guest needs to choose one.
// Only public facts leave here: name, town, photo, kind, pin, amenities, the lowest price and, for given dates,
// whether a room is free and what it costs. Bookings themselves (names, phones, dates of others) never do.
import { loadState } from './hotel.js';
import { getContent } from './content.js';
import { findOffer } from '../lib/availability.js';
import { nights } from '../lib/time.js';

const KINDS = ['mountain', 'sea', 'wine', 'city', 'nature'];
const pick = v => (v == null ? '' : typeof v === 'string' ? v : v.ka || v.en || v.ru || '');

// hotels listed: open (trial or active), with prices and a main photo, so no card looks broken
export async function catalog(db, { siteOf, from = '', to = '', guests = 2 } = {}) {
  const r = await db.prepare("SELECT * FROM tenants WHERE status IN ('trial', 'active') ORDER BY created").all();
  const dated = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && to > from;
  const out = [];
  for (const row of r.results || []) {
    const t = { id: row.id, slug: row.slug, name: row.name, city: row.city };
    const [{ content }, st] = await Promise.all([getContent(db, t), loadState(db, t)]);
    const s = content.site || {};
    if (!s.hero?.img) continue;
    const prices = Object.values(st.types).flatMap(ty => ty.rates.flatMap(x => Object.values(x.price || {}).map(Number))).filter(v => v > 0);
    if (!prices.length || !st.rooms.length) continue;
    const site = siteOf(t);
    const abs = src => (/^https:\/\//.test(src) ? src : site + String(src).replace(/^\//, ''));
    const h = {
      slug: t.slug, name: t.name, city: t.city || '', url: site, real: true,
      img: abs(s.hero.img), tagline: pick(s.hero?.tagline).slice(0, 160),
      kind: KINDS.includes(s.kind) ? s.kind : '',
      lat: s.pin?.lat ?? null, lng: s.pin?.lng ?? null,
      amenities: Array.isArray(s.amenities) ? s.amenities : [],
      minFrom: Math.min(...prices),
      cap: Math.max(0, ...Object.values(st.types).map(ty => ty.cap || 0)),
    };
    if (dated) {
      const o = findOffer(st, from, to, guests);
      h.offer = o ? { total: o.total, type: o.name, n: nights(from, to) } : null;
    }
    out.push(h);
  }
  return out;
}
