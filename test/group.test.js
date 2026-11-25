import { describe, it, expect, beforeAll } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { seedSample, loadState } from '../src/db/hotel.js';
import { roomsOffer } from '../src/lib/availability.js';
import { today, addDays } from '../src/lib/time.js';

const post = (host, path, body) => exports.default.fetch(new Request(`https://${host}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));

describe('several rooms in one request', () => {
  let A, B;
  const from = addDays(today(), 20), to = addDays(today(), 23);
  beforeAll(async () => {
    A = await createTenant(env.DB, { slug: 'grp-a', name: 'Group A' });
    B = await createTenant(env.DB, { slug: 'grp-b', name: 'Group B' });
    await seedSample(env.DB, A); await seedSample(env.DB, B);
  });

  it('spreads the guests over the rooms and prices every room', async () => {
    const st = await loadState(env.DB, A);
    const o = roomsOffer(st, from, to, 7, 3);
    expect(o.parts.length).toBe(3);
    expect(o.parts.map(p => p.guests)).toEqual([3, 2, 2]);
    expect(new Set(o.parts.map(p => p.room)).size).toBe(3);
    expect(o.total).toBe(o.parts.reduce((s, p) => s + p.total, 0));
    expect(roomsOffer(st, from, to, 9, 9).parts).toBeUndefined();
    expect(roomsOffer(st, from, to, 9, 9).free).toBe(st.rooms.length);
  });

  it('stores one request with a row per room, only in that hotel', async () => {
    const r = await (await post('grp-a.visit2.ge', '/api/request', { from, to, guests: 6, children: 2, rooms: 3, name: 'Group Guest', phone: '+995 555 111 222' })).json();
    expect(r.ok).toBe(true);
    const rows = (await env.DB.prepare('SELECT tenant_id, grp, guests, children, price, status FROM bookings WHERE phone = ?').bind('+995 555 111 222').all()).results;
    expect(rows.length).toBe(3);
    expect(rows.every(x => x.tenant_id === A.id && x.grp === r.id && x.status === 'pending' && x.price > 0)).toBe(true);
    expect(rows.reduce((s, x) => s + x.guests, 0)).toBe(6);
    expect(rows.reduce((s, x) => s + x.children, 0)).toBe(2);
    // sent again (a lost connection): not stored twice
    await post('grp-a.visit2.ge', '/api/request', { from, to, guests: 6, rooms: 3, name: 'Group Guest', phone: '+995 555 111 222' });
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM bookings WHERE phone = ?').bind('+995 555 111 222').first()).n).toBe(3);
    const stB = await loadState(env.DB, B, { full: true });
    expect(stB.bookings.some(b => b.grp === r.id)).toBe(false);
  });

  it('says no when there are not that many free rooms', async () => {
    const r = await (await post('grp-b.visit2.ge', '/api/request', { from, to, guests: 10, rooms: 10, name: 'Big Group', phone: '+995 555 333 444' })).json();
    expect(r.ok).toBe(false);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM bookings WHERE phone = ?').bind('+995 555 333 444').first()).n).toBe(0);
  });
});
