import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { seedSample, loadState, createRequest } from '../src/db/hotel.js';
import { quote, findOffer, freeRooms, gaps, deals } from '../src/lib/availability.js';
import { today, addDays } from '../src/lib/time.js';

const db = () => env.DB;
const confirm = (t, room, type, from, to) => db().prepare(
  "INSERT INTO bookings (tenant_id, id, room, type, date_from, date_to, guests, name, phone, status, created) VALUES (?, ?, ?, ?, ?, ?, 2, 'x', '599000000', 'confirmed', ?)"
).bind(t.id, crypto.randomUUID(), room, type, from, to, new Date().toISOString()).run();

describe('rooms, prices and bookings of two hotels', () => {
  let A, B;
  const d0 = addDays(today(), 20);
  beforeAll(async () => {
    A = await createTenant(db(), { slug: 'mountain-a', name: 'მთის სასტუმრო' });
    // a seaside hotel: its own seasons, same sample room types (prices keyed by its season ids)
    B = await createTenant(db(), { slug: 'sea-b', name: 'ზღვის სასტუმრო', seasons: [{ id: 'off', name: 'წელიწადი', from: '01-01', to: '12-31' }] });
    await seedSample(db(), A);
    await seedSample(db(), B);
  });

  it('each hotel sees only its own rooms', async () => {
    const a = await loadState(db(), A), b = await loadState(db(), B);
    expect(a.rooms.length).toBe(5);
    expect(b.rooms.length).toBe(5);
    expect(a.seasons.length).toBe(4);
    expect(b.seasons.map(s => s.id)).toEqual(['off']);
  });

  it('prices follow each hotel\'s seasons', async () => {
    const a = await loadState(db(), A), b = await loadState(db(), B);
    // 26–28 Dec: peak at the mountain hotel (240/night for 2 in std), plain "off" at the sea (110/night)
    expect(quote(a, 'std', '2027-12-26', '2027-12-28', 2)).toBe(480);
    expect(quote(b, 'std', '2027-12-26', '2027-12-28', 2)).toBe(220);
    // mid-July at the mountain hotel: summer
    expect(quote(a, 'std', '2027-07-10', '2027-07-11', 2)).toBe(140);
  });

  it('a booking at one hotel does not take a room at the other', async () => {
    await confirm(A, '1', 'std', d0, addDays(d0, 3));
    await confirm(A, '2', 'std', d0, addDays(d0, 3));
    const a = await loadState(db(), A), b = await loadState(db(), B);
    expect(freeRooms(a, 'std', d0, addDays(d0, 2))).toEqual([]);
    expect(freeRooms(b, 'std', d0, addDays(d0, 2))).toEqual(['1', '2']);
    // A has no free std, so the cheapest free room that fits 2 is a family room
    expect(findOffer(a, d0, addDays(d0, 2), 2).type).toBe('family');
    expect(findOffer(b, d0, addDays(d0, 2), 2).type).toBe('std');
  });

  it('a guest request lands only at its hotel, and a retry is not stored twice', async () => {
    const a = await loadState(db(), A);
    const req = { from: addDays(d0, 5), to: addDays(d0, 7), guests: 2, name: 'ნინო', phone: '+995 599 11 22 33' };
    const r1 = await createRequest(db(), A, a, req);
    const r2 = await createRequest(db(), A, a, req);
    expect(r1.booking.status).toBe('pending');
    expect(r2.repeat).toBe(true);
    expect(r2.booking.id).toBe(r1.booking.id);
    const fullA = await loadState(db(), A, { full: true }), fullB = await loadState(db(), B, { full: true });
    expect(fullA.bookings.filter(x => x.name === 'ნინო').length).toBe(1);
    expect(fullB.bookings.filter(x => x.name === 'ნინო').length).toBe(0);
  });

  it('refuses past dates and missing phone', async () => {
    const a = await loadState(db(), A);
    await expect(createRequest(db(), A, a, { from: addDays(today(), -1), to: today(), guests: 2, name: 'x', phone: '599112233' })).rejects.toThrow('bad dates');
    await expect(createRequest(db(), A, a, { from: d0, to: addDays(d0, 1), guests: 2, name: 'x', phone: '12' })).rejects.toThrow('name and phone');
  });

  it('finds a short gap between two bookings and offers it with the discount', async () => {
    const g0 = addDays(today(), 40);
    await confirm(A, '5', 'suite', g0, addDays(g0, 2));
    await confirm(A, '5', 'suite', addDays(g0, 4), addDays(g0, 6));
    const a = await loadState(db(), A);
    const g = gaps(a).find(x => x.room === '5');
    expect([g.from, g.to, g.n]).toEqual([addDays(g0, 2), addDays(g0, 4), 2]);
    expect(deals(a).find(x => x.room === '5').pct).toBe(10);
    expect(gaps(await loadState(db(), B)).length).toBe(0);
  });
});
