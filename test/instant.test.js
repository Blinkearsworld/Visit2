import { describe, it, expect, beforeAll } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { seedSample, loadState } from '../src/db/hotel.js';
import { saveContent } from '../src/db/content.js';
import { today, addDays } from '../src/lib/time.js';

const post = (host, path, body) => exports.default.fetch(new Request(`https://${host}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const get = (host, path) => exports.default.fetch(new Request(`https://${host}${path}`));
const HA = 'inst-a.visit2.ge', HB = 'inst-b.visit2.ge';

describe('instant booking', () => {
  let A, B;
  const from = addDays(today(), 40), to = addDays(today(), 42);
  beforeAll(async () => {
    A = await createTenant(env.DB, { slug: 'inst-a', name: 'Instant A' });
    B = await createTenant(env.DB, { slug: 'inst-b', name: 'Instant B' });
    await seedSample(env.DB, A); await seedSample(env.DB, B);
    await saveContent(env.DB, A, { site: { instant: { on: true, cancel: 'უფასოდ 3 დღით ადრე' } } });
  });

  it('confirms at once with a room where the hotel turned it on, and only there', async () => {
    const r = await (await post(HA, '/api/request', { from, to, guests: 2, name: 'Nino', phone: '+995 555 000 001', instant: true })).json();
    expect(r.ok).toBe(true); expect(r.instant).toBe(true); expect(r.key).toMatch(/^[0-9a-f]{20}$/);
    const row = await env.DB.prepare('SELECT tenant_id, status, room, instant FROM bookings WHERE id = ?').bind(r.id).first();
    expect(row.tenant_id).toBe(A.id); expect(row.status).toBe('confirmed'); expect(row.room).toBeTruthy(); expect(row.instant).toBe(1);
    // B never turned it on: the browser asking for "instant" changes nothing there
    const rb = await (await post(HB, '/api/request', { from, to, guests: 2, name: 'Nino', phone: '+995 555 000 001', instant: true })).json();
    expect(rb.instant).toBe(false);
    expect((await env.DB.prepare('SELECT status FROM bookings WHERE id = ?').bind(rb.id).first()).status).toBe('pending');
  });

  it('never puts two guests into one room, even when both press at once', async () => {
    const d1 = addDays(today(), 60), d2 = addDays(today(), 61);
    const st = await loadState(env.DB, A);
    const n = st.rooms.length;
    const all = await Promise.all(Array.from({ length: n + 3 }, (_, i) => post(HA, '/api/request', { from: d1, to: d2, guests: 1, name: 'G' + i, phone: '+995 555 10' + String(i).padStart(4, '0'), instant: true }).then(x => x.json())));
    const rows = (await env.DB.prepare("SELECT room FROM bookings WHERE tenant_id = ? AND date_from = ? AND status = 'confirmed'").bind(A.id, d1).all()).results;
    expect(new Set(rows.map(x => x.room)).size).toBe(rows.length);
    expect(rows.length).toBeLessThanOrEqual(n);
    expect(all.filter(x => x.ok && !x.instant).length).toBeGreaterThan(0); // the rest went as requests
  });

  it('shows the booking behind its link only, and not at another hotel', async () => {
    const r = await (await post(HA, '/api/request', { from: addDays(today(), 80), to: addDays(today(), 82), guests: 2, name: 'Link Guest', phone: '+995 555 000 777', instant: true })).json();
    const ok = await (await get(HA, `/api/booking?id=${r.id}&k=${r.key}`)).json();
    expect(ok.ok).toBe(true); expect(ok.booking.status).toBe('confirmed'); expect(ok.booking.name).toBe('Link Guest');
    expect(ok.booking.phone).toBeUndefined();
    expect((await get(HA, `/api/booking?id=${r.id}&k=0000000000aaaaaaaaaa`)).status).toBe(404);
    expect((await get(HB, `/api/booking?id=${r.id}&k=${r.key}`)).status).toBe(404);
  });

  it('several rooms at once: all confirmed together', async () => {
    const r = await (await post(HA, '/api/request', { from: addDays(today(), 90), to: addDays(today(), 91), guests: 4, rooms: 2, name: 'Group', phone: '+995 555 000 888', instant: true })).json();
    expect(r.instant).toBe(true);
    const rows = (await env.DB.prepare('SELECT status, room FROM bookings WHERE tenant_id = ? AND grp = ?').bind(A.id, r.id).all()).results;
    expect(rows.length).toBe(2); expect(rows.every(x => x.status === 'confirmed' && x.room)).toBe(true);
    expect(rows[0].room).not.toBe(rows[1].room);
  });

  it('marks instant hotels in the catalogue', async () => {
    const c = await (await get('visit2.ge', '/api/catalog')).json();
    const a = (c.hotels || []).find(h => h.slug === 'inst-a');
    if (a) expect(a.instant).toBe(true); // listed only when it has a photo
  });
});
