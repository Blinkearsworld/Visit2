import { describe, it, expect, beforeAll } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { seedSample, loadState, guestBooking } from '../src/db/hotel.js';
import { adminAction } from '../src/db/actions.js';
import { listServices, unitsFor } from '../src/db/services.js';
import { purgeHotel } from '../src/db/retention.js';
import { today, addDays } from '../src/lib/time.js';

const db = () => env.DB;
const post = (host, path, body) => exports.default.fetch(new Request(`https://${host}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const owner = { id: 'o', name: 'Owner', owner: true, perms: [] };
const act = (t, b, u = owner) => adminAction(db(), t, u, b).then(r => r.body);

describe('the hotel\'s own services and charges on a stay', () => {
  let A, B, bf, mini, clean;
  beforeAll(async () => {
    A = await createTenant(db(), { slug: 'svc-a', name: 'Svc A' });
    B = await createTenant(db(), { slug: 'svc-b', name: 'Svc B' });
    await seedSample(db(), A); await seedSample(db(), B);
    const r = await act(A, { op: 'services', list: [
      { name: 'საუზმე', nameEn: 'Breakfast', price: 20, unit: 'guest_night', online: 1 },
      { name: 'მინიბარი: წყალი', price: 3, unit: 'item' },
      { name: 'დამატებითი დალაგება', price: 15, unit: 'stay' },
    ] });
    expect(r.ok).toBe(true);
    [bf, mini, clean] = r.services;
    await act(B, { op: 'services', list: [{ name: 'ტრანსფერი', price: 60, unit: 'stay', online: 1 }] });
  });

  it('each hotel has only its own list; the site sees only the online ones', async () => {
    expect((await listServices(db(), A)).map(s => s.name)).toEqual(['საუზმე', 'მინიბარი: წყალი', 'დამატებითი დალაგება']);
    expect((await listServices(db(), B)).map(s => s.name)).toEqual(['ტრანსფერი']);
    expect((await loadState(db(), A)).services.map(s => s.name)).toEqual(['საუზმე']);
  });

  it('counts units by the kind of price', () => {
    const stay = { from: '2027-01-10', to: '2027-01-13', guests: 2 };
    expect([unitsFor('stay', stay), unitsFor('night', stay), unitsFor('guest', stay), unitsFor('guest_night', stay), unitsFor('item', stay, 4)]).toEqual([1, 3, 2, 6, 4]);
  });

  it('a guest adds breakfast on the site: priced by the hotel, not by the browser; another hotel\'s service is ignored', async () => {
    const from = addDays(today(), 40), to = addDays(today(), 42);
    const B1 = (await listServices(db(), B))[0];
    const r = await (await post('svc-a.visit2.ge', '/api/request', { from, to, guests: 2, name: 'Nino', phone: '+995 555 400 001',
      extras: [{ id: bf.id, qty: 1, price: 1 }, { id: B1.id }, { id: mini.id }] })).json();
    expect(r.ok).toBe(true);
    expect(r.extras).toEqual([{ service: bf.id, name: 'საუზმე', price: 20, qty: 4, amount: 80 }]); // 2 guests × 2 nights; minibar is not offered online
    const g = await guestBooking(db(), A, r.id);
    expect(g.extras).toEqual([{ name: 'საუზმე', qty: 4, amount: 80 }]);
    expect(g.total).toBe(r.total);
    expect(g.total - g.rooms[0].price).toBe(80);
  });

  it('staff charge the minibar and a one-off; another hotel can neither see nor change them', async () => {
    const st = await loadState(db(), A, { full: true });
    const bk = st.bookings[0];
    const a1 = await act(A, { op: 'item', booking: bk.id, service: mini.id, qty: 3 });
    expect(a1.item).toMatchObject({ name: 'მინიბარი: წყალი', price: 3, qty: 3, amount: 9 });
    const a2 = await act(A, { op: 'item', booking: bk.id, name: 'გატეხილი ჭიქა', price: 10 });
    expect(a2.item.amount).toBe(10);
    await act(A, { op: 'item', booking: bk.id, service: clean.id });
    expect((await loadState(db(), A, { full: true })).items.filter(x => x.booking === bk.id).map(x => x.amount)).toEqual([80, 9, 10, 15]);
    // hotel B: the booking and the charge are not there
    expect((await act(B, { op: 'item', booking: bk.id, name: 'x', price: 1 })).ok).toBe(false);
    expect((await act(B, { op: 'unitem', id: a1.item.id })).ok).toBe(false);
    expect((await loadState(db(), B, { full: true })).items).toEqual([]);
    // A removes one charge
    expect((await act(A, { op: 'unitem', id: a2.item.id })).ok).toBe(true);
    expect((await loadState(db(), A, { full: true })).items.filter(x => x.booking === bk.id).length).toBe(3);
  });

  it('staff without the right cannot change the list of services', async () => {
    const staff = { id: 's', name: 'Staff', owner: false, perms: ['book'] };
    expect((await act(A, { op: 'services', list: [] }, staff)).ok).toBe(false);
    expect((await listServices(db(), A)).length).toBe(3);
  });

  it('charges go together with their booking', async () => {
    const st = await loadState(db(), A, { full: true });
    const bk = st.bookings[0];
    await act(A, { op: 'remove', id: bk.id });
    await act(A, { op: 'purge', id: bk.id });
    expect((await db().prepare('SELECT COUNT(*) AS n FROM booking_items WHERE tenant_id = ? AND booking = ?').bind(A.id, bk.id).first()).n).toBe(0);
    await db().prepare("INSERT INTO booking_items (tenant_id, id, booking, name, price, qty, amount, created) VALUES (?, 'orphan1', 'gone', 'x', 1, 1, 1, ?)").bind(A.id, new Date().toISOString()).run();
    await purgeHotel(db(), A);
    expect(await db().prepare('SELECT 1 FROM booking_items WHERE tenant_id = ? AND id = ?').bind(A.id, 'orphan1').first()).toBeNull();
  });
});
