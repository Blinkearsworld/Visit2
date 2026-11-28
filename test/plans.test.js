import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { seedSample, loadState, createRequest } from '../src/db/hotel.js';
import { adminAction } from '../src/db/actions.js';
import { roomFree, kidPrice } from '../src/lib/availability.js';
import { planPrice, cancelFee } from '../src/lib/plans.js';
import { today, addDays } from '../src/lib/time.js';

const db = () => env.DB;
const owner = { id: 'o', name: 'Owner', owner: true, perms: [] };
const act = (t, b) => adminAction(db(), t, owner, b).then(r => r.body);
const PLANS = [{ id: 'bb', name: 'საუზმით', add: 20, perGuest: true }, { id: 'nr', name: 'დაუბრუნებელი', pct: 10, refundable: false }];

describe('price plans, cancelling with a fee, settings kept private', () => {
  let A, B;
  beforeAll(async () => {
    A = await createTenant(db(), { slug: 'pl-a', name: 'Plans A' });
    B = await createTenant(db(), { slug: 'pl-b', name: 'Plans B' });
    await seedSample(db(), A); await seedSample(db(), B);
    await act(A, { op: 'setting', k: 'plans', v: JSON.stringify(PLANS) });
    await act(A, { op: 'setting', k: 'cancelRule', v: JSON.stringify({ days: 7, pct: 50 }) });
    await act(A, { op: 'setting', k: 'msgTpl', v: JSON.stringify({ arrive: { ka: 'კოდი 1234' } }) });
  });

  it('prices a plan the same way everywhere', () => {
    expect(planPrice(300, PLANS[0], 2, 3)).toBe(420);
    expect(planPrice(300, PLANS[1], 2, 3)).toBe(270);
    expect(planPrice(300, null, 2, 3)).toBe(300);
  });

  it('the server applies the chosen plan; a plan of another hotel or an unknown one is ignored', async () => {
    const from = addDays(today(), 30), to = addDays(today(), 33), st = await loadState(db(), A);
    const base = kidPrice(st, 'std', from, to, 2, 0, null);
    const r = await createRequest(db(), A, st, { from, to, guests: 2, name: 'N', phone: '599100200', type: 'std', plan: 'bb' });
    expect(r.total).toBe(base + 20 * 2 * 3);
    expect(r.booking.plan).toEqual({ id: 'bb', name: 'საუზმით', refundable: true });
    const rb = await createRequest(db(), B, await loadState(db(), B), { from, to, guests: 2, name: 'N', phone: '599100201', type: 'std', plan: 'bb' });
    expect(rb.total).toBe(kidPrice(await loadState(db(), B), 'std', from, to, 2, 0, null));
  });

  it('message texts and bank details never reach the public site', async () => {
    await act(A, { op: 'setting', k: 'billFrom', v: JSON.stringify({ iban: 'GE00' }) });
    const pub = await loadState(db(), A), adm = await loadState(db(), A, { full: true });
    expect(pub.settings.msgTpl).toBeUndefined(); expect(pub.settings.billFrom).toBeUndefined();
    expect(pub.settings.plans).toBeTruthy();
    expect(adm.settings.msgTpl).toContain('1234');
  });

  it('cancelling frees the room and keeps the fee by the hotel\'s rule; restoring takes the room back', async () => {
    expect(cancelFee({ cancelRule: '{"days":7,"pct":50}' }, { from: '2027-01-20', price: 400 }, '2027-01-01')).toBe(0);
    expect(cancelFee({ cancelRule: '{"days":7,"pct":50}' }, { from: '2027-01-05', price: 400 }, '2027-01-01')).toBe(200);
    expect(cancelFee({}, { from: '2027-01-20', price: 400, plan: { refundable: false } }, '2027-01-01')).toBe(400);
    const from = addDays(today(), 3), to = addDays(today(), 5);
    const a = await act(A, { op: 'add', room: '2', from, to, name: 'C', phone: '599300400', guests: 2, price: 300 });
    expect((await act(B, { op: 'cancel', id: a.id })).ok).toBe(false);
    const c = await act(A, { op: 'cancel', id: a.id });
    expect(c).toMatchObject({ ok: true, fee: 150 });
    let st = await loadState(db(), A, { full: true });
    expect(st.bookings.find(x => x.id === a.id)).toMatchObject({ status: 'cancelled', fee: 150 });
    expect(roomFree(st, '2', from, to)).toBe(true);
    expect((await act(A, { op: 'uncancel', id: a.id })).ok).toBe(true);
    st = await loadState(db(), A, { full: true });
    expect(st.bookings.find(x => x.id === a.id)).toMatchObject({ status: 'confirmed', fee: null });
    // an agreed fee instead of the rule
    expect((await act(A, { op: 'cancel', id: a.id, fee: 0 })).fee).toBe(0);
  });
});
