import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { seedSample, loadState, createRequest } from '../src/db/hotel.js';
import { adminAction } from '../src/db/actions.js';
import { roomFree } from '../src/lib/availability.js';
import { today, addDays } from '../src/lib/time.js';

const db = () => env.DB;
const owner = { id: 'o', name: 'Owner', owner: true, perms: [] };
const act = (t, b, u = owner) => adminAction(db(), t, u, b).then(r => r.body);
const full = t => loadState(db(), t, { full: true });

describe('running the hotel day to day: arrivals, departures, cleaning, closed rooms, invoices', () => {
  let A, B, bk;
  const d0 = addDays(today(), 5), d1 = addDays(today(), 8);
  beforeAll(async () => {
    A = await createTenant(db(), { slug: 'ops-a', name: 'Ops A' });
    B = await createTenant(db(), { slug: 'ops-b', name: 'Ops B' });
    await seedSample(db(), A); await seedSample(db(), B);
    const r = await act(A, { op: 'add', room: '1', from: d0, to: d1, name: 'Nino', phone: '599111222', guests: 2 });
    bk = r.id;
  });

  it('marks arrival and departure; leaving makes the room due for cleaning; another hotel cannot', async () => {
    expect((await act(B, { op: 'checkin', id: bk })).ok).toBe(false);
    expect((await act(A, { op: 'checkin', id: bk })).ok).toBe(true);
    expect((await full(A)).bookings.find(x => x.id === bk).checkedIn).toBeTruthy();
    const out = await act(A, { op: 'checkout', id: bk });
    expect(out.ok).toBe(true); expect(out.left).toBeGreaterThan(0);
    const st = await full(A);
    expect(st.bookings.find(x => x.id === bk).checkedOut).toBeTruthy();
    expect(st.rooms.find(r => r.id === '1').hk).toBe('dirty');
    expect((await full(B)).rooms.find(r => r.id === '1').hk).toBe('clean');
    await act(A, { op: 'checkout', id: bk, undo: true });
    expect((await full(A)).bookings.find(x => x.id === bk).checkedOut).toBe('');
  });

  it('housekeeping staff change only room status, and see no names, phones or money', async () => {
    const hk = { id: 'h', name: 'Housekeeper', owner: false, perms: ['clean'] };
    expect((await act(A, { op: 'hk', room: '1', state: 'clean' }, hk)).ok).toBe(true);
    expect((await full(A)).rooms.find(r => r.id === '1').hk).toBe('clean');
    expect((await act(A, { op: 'checkin', id: bk }, hk)).ok).toBe(false);
    expect((await act(A, { op: 'hk', room: '1', state: 'burnt' })).ok).toBe(false);
  });

  it('a closed room cannot be booked, and only in its own hotel', async () => {
    const from = addDays(today(), 20), to = addDays(today(), 25);
    const r = await act(A, { op: 'block', room: '2', from, to, reason: 'რემონტი' });
    expect(r.ok).toBe(true);
    const pub = await loadState(db(), A);
    expect(pub.blocks).toEqual([{ id: r.id, room: '2', from, to }]); // no reason for the public
    expect(roomFree(pub, '2', from, to)).toBe(false);
    expect(roomFree(await loadState(db(), B), '2', from, to)).toBe(true);
    // booking over a closed room fails; the request goes to the other free room of the type
    expect((await act(A, { op: 'add', room: '2', from, to, name: 'X', phone: '599000000' })).ok).toBe(false);
    const req = await createRequest(db(), A, pub, { from, to, guests: 2, name: 'G', phone: '599333444', type: 'std', instant: true });
    expect(req.booking.room).toBe('1');
    // closing a room that is booked is refused
    expect((await act(A, { op: 'block', room: '1', from, to })).ok).toBe(false);
    expect((await act(B, { op: 'unblock', id: r.id })).ok).toBe(false);
    expect((await act(A, { op: 'unblock', id: r.id })).ok).toBe(true);
    expect((await loadState(db(), A)).blocks).toEqual([]);
  });

  it('numbers invoices per hotel and year, and keeps the number when details change', async () => {
    const i1 = await act(A, { op: 'invoice', id: bk, company: 'შპს მთა', code: '405000111', address: 'თბილისი' });
    const y = today().slice(0, 4);
    expect(i1.invoice.no).toBe(`${y}-0001`);
    const i2 = await act(A, { op: 'invoice', id: bk, company: 'შპს მთა და ზღვა', code: '405000111' });
    expect(i2.invoice.no).toBe(`${y}-0001`);
    const other = await act(A, { op: 'add', room: '3', from: d0, to: d1, name: 'Co', phone: '599555666', guests: 2 });
    expect((await act(A, { op: 'invoice', id: other.id, company: 'შპს ტური' })).invoice.no).toBe(`${y}-0002`);
    // hotel B starts its own numbering, and cannot touch A's booking
    const bB = await act(B, { op: 'add', room: '1', from: d0, to: d1, name: 'Z', phone: '599777888', guests: 1 });
    expect((await act(B, { op: 'invoice', id: bB.id, company: 'შპს ბ' })).invoice.no).toBe(`${y}-0001`);
    expect((await act(B, { op: 'invoice', id: bk, company: 'hack' })).ok).toBe(false);
    expect((await full(A)).bookings.find(x => x.id === bk).invoice.company).toBe('შპს მთა და ზღვა');
  });
});
