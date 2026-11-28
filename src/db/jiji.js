// Moves Villa JIJI (villajiji.com) onto Visit2: its rooms, prices, bookings, payments, guest notes, settings and
// photos are copied from the villa's own D1 database, and its site becomes the Lapis template.
// The old database is only read. Running it again before the switch refreshes the copy (bookings made on the
// old site in the meantime come along); once villajiji.com points at Visit2 it refuses, so nothing made here is lost.
import JIJI from '../data/jiji.js';
import { createTenant, tenantBySlug } from './tenants.js';
import { saveContent } from './content.js';
import { setFree, setAddons } from './ops.js';
import { nowIso } from '../lib/time.js';

export const JIJI_SLUG = 'villajiji';
export const JIJI_HOST = 'villajiji.com';
// villa settings Visit2 understands; anything else in the old table is left behind
const SETTINGS = ['seasonMode', 'winterFrom', 'winterTo', 'gapDiscount', 'gapEdits', 'promos'];
// hotel tables a refresh clears and fills again (all filtered by this hotel's tenant_id)
const TABLES = ['types', 'rooms', 'bookings', 'payments', 'guest_notes', 'media'];

// Reads the old database through Cloudflare's D1 API (the two sites are on different Cloudflare accounts).
// account and database are not secret; the token is a read-only Cloudflare Secret (JIJI_D1_TOKEN).
export function d1Reader({ account, database, token }, fetcher = fetch) {
  if (!account || !database || !token) throw new Error('ძველ ბაზასთან კავშირი არ არის მზად: Cloudflare-ში ჩაწერე JIJI_D1_TOKEN.');
  return async sql => {
    const r = await fetcher(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`, {
      method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ sql }),
    });
    const o = await r.json().catch(() => null);
    if (!r.ok || !o?.success) throw new Error('ძველი ბაზა ვერ წავიკითხე (' + r.status + '): ' + (o?.errors?.[0]?.message || 'უცნობი მიზეზი'));
    return o.result?.[0]?.results || [];
  };
}

const hexToBytes = h => { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; };
const s = v => (v == null ? null : String(v));
const n = v => (v == null || v === '' || isNaN(+v) ? null : Math.round(+v));

// read: async (sql) => rows. Returns what was copied, for the ops page and the log.
export async function importJiji(db, read, me = { id: null, name: 'Visit2' }) {
  const q = async (sql, opt = false) => { try { return await read(sql); } catch (e) { if (opt) return []; throw e; } };
  const [types, rooms, bookings, payments, notes, settings, media, content] = await Promise.all([
    q('SELECT id, name, rates, sort FROM types'),
    q('SELECT id, type FROM rooms'),
    q('SELECT * FROM bookings'),
    q('SELECT id, booking, amount, method, date, created FROM payments'),
    q('SELECT k, note, updated FROM guest_notes'),
    q('SELECT k, v FROM settings'),
    q('SELECT id, mime, size, created, hex(data) AS hex FROM media', true),
    q('SELECT v FROM site_content ORDER BY id DESC LIMIT 1', true),
  ]);
  if (!types.length || !rooms.length) throw new Error('ძველ ბაზაში ნომრები ვერ ვიპოვე. გადმოტანა შეჩერდა, არაფერი შეცვლილა.');

  let t = await tenantBySlug(db, JIJI_SLUG), fresh = false;
  if (t) {
    const live = await db.prepare('SELECT 1 FROM domains WHERE tenant_id = ? AND host IN (?, ?)').bind(t.id, JIJI_HOST, 'www.' + JIJI_HOST).first();
    if (live) throw new Error('villajiji.com უკვე Visit2-ზეა გადართული. ხელახლა გადმოტანა აღარ შეიძლება, ახალი ჯავშნები არ დაიკარგოს.');
  } else {
    t = await createTenant(db, { slug: JIJI_SLUG, name: 'Villa JIJI', city: 'ბაკურიანი' });
    fresh = true;
  }
  const id = t.id, st = [];
  TABLES.forEach(tb => st.push(db.prepare(`DELETE FROM ${tb} WHERE tenant_id = ?`).bind(id)));
  types.forEach((r, i) => st.push(db.prepare('INSERT INTO types (tenant_id, id, name, rates, sort) VALUES (?, ?, ?, ?, ?)')
    .bind(id, s(r.id), s(r.name), s(r.rates) || '[]', n(r.sort) ?? i)));
  rooms.forEach((r, i) => st.push(db.prepare('INSERT INTO rooms (tenant_id, id, type, sort) VALUES (?, ?, ?, ?)').bind(id, s(r.id), s(r.type), i)));
  bookings.forEach(b => st.push(db.prepare(`INSERT INTO bookings (tenant_id, id, room, type, date_from, date_to, guests, children, name, phone,
      status, prev_status, source, created, deleted_at, price, note, remark, wish, want_room)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, s(b.id), s(b.room), s(b.type), s(b.date_from), s(b.date_to), n(b.guests), n(b.children) || 0, s(b.name), s(b.phone),
      s(b.status), s(b.prev_status), s(b.source), s(b.created), s(b.deleted_at), n(b.price), s(b.note), s(b.remark), s(b.wish), s(b.want_room))));
  payments.forEach(p => st.push(db.prepare('INSERT INTO payments (tenant_id, id, booking, amount, method, date, created) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, s(p.id), s(p.booking), n(p.amount), s(p.method), s(p.date), s(p.created))));
  notes.forEach(x => st.push(db.prepare('INSERT INTO guest_notes (tenant_id, k, note, updated) VALUES (?, ?, ?, ?)').bind(id, s(x.k), s(x.note), s(x.updated))));
  settings.filter(x => SETTINGS.includes(x.k)).forEach(x => st.push(db.prepare(
    'INSERT INTO settings (tenant_id, k, v) VALUES (?, ?, ?) ON CONFLICT (tenant_id, k) DO UPDATE SET v = excluded.v').bind(id, x.k, s(x.v))));
  media.filter(x => x.hex).forEach(x => st.push(db.prepare('INSERT INTO media (tenant_id, id, mime, size, created, data) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, s(x.id), s(x.mime), n(x.size), s(x.created) || nowIso(), hexToBytes(x.hex))));
  // one transaction: a failure leaves the previous copy as it was
  await db.batch(st);

  // the site: Lapis with Villa JIJI's texts and photos; contacts and questions as the owner last saved them
  let old = {}; try { old = JSON.parse(content[0]?.v || '{}') || {}; } catch (e) { old = {}; }
  const site = { ...JIJI, contact: { ...JIJI.contact, ...(old.contact || {}) }, faq: Array.isArray(old.faq) && old.faq.length ? old.faq : JIJI.faq };
  await saveContent(db, t, site, fresh ? 'გადმოტანა villajiji.com-დან' : 'განახლება villajiji.com-დან');
  if (fresh) { await setFree(db, t, me, true); await setAddons(db, t, me, ['catalog', 'domain', 'pay', 'hidden']); }
  return { slug: JIJI_SLUG, fresh, types: types.length, rooms: rooms.length, bookings: bookings.length, payments: payments.length,
    notes: notes.length, media: media.filter(x => x.hex).length };
}
