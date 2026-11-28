import { describe, it, expect, beforeAll } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { seedSample, loadState, createRequest } from '../src/db/hotel.js';
import { adminAction } from '../src/db/actions.js';
import { addFeed, listFeeds, syncFeed, roomIcs } from '../src/db/ical.js';
import { parseIcs } from '../src/lib/ical.js';
import { quote, roomFree } from '../src/lib/availability.js';
import { stayCheck } from '../src/lib/plans.js';
import { today, addDays } from '../src/lib/time.js';

const db = () => env.DB;
const owner = { id: 'o', name: 'Owner', owner: true, perms: [] };
const act = (t, b, u = owner) => adminAction(db(), t, u, b).then(r => r.body);
const get = (host, path) => exports.default.fetch(new Request(`https://${host}${path}`));
const ICS = d => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:abc@booking.com\r\nDTSTART;VALUE=DATE:${d(10)}\r\nDTEND;VALUE=DATE:${d(13)}\r\nSUMMARY:CLOSED - Not available\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:old\r\nDTSTART;VALUE=DATE:${d(-10)}\r\nDTEND;VALUE=DATE:${d(-8)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const ymd = n => addDays(today(), n).replace(/-/g, '');

describe('calendars of other sites, rules of stay and price, codes, agencies, expenses, room problems, no-shows', () => {
  let A, B;
  beforeAll(async () => {
    A = await createTenant(db(), { slug: 'more-a', name: 'More A' });
    B = await createTenant(db(), { slug: 'more-b', name: 'More B' });
    await seedSample(db(), A); await seedSample(db(), B);
  });

  it('imports a Booking.com calendar into one room of one hotel only, and replaces it on the next sync', async () => {
    expect(parseIcs(ICS(ymd))[0]).toMatchObject({ uid: 'abc@booking.com', from: addDays(today(), 10), to: addDays(today(), 13) });
    const id = await addFeed(db(), A, { room: '3', name: 'Booking.com', url: 'https://admin.booking.com/ical/x.ics' });
    const f = (await listFeeds(db(), A)).find(x => x.id === id);
    const r = await syncFeed(db(), A, f, async () => new Response(ICS(ymd)));
    expect(r).toEqual({ ok: true, events: 1 }); // the past stay is left out
    expect(roomFree(await loadState(db(), A), '3', addDays(today(), 10), addDays(today(), 12))).toBe(false);
    expect(roomFree(await loadState(db(), B), '3', addDays(today(), 10), addDays(today(), 12))).toBe(true);
    // a stay cancelled on Booking.com disappears with the next sync
    await syncFeed(db(), A, f, async () => new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n'));
    expect(roomFree(await loadState(db(), A), '3', addDays(today(), 10), addDays(today(), 12))).toBe(true);
    // a broken address keeps the error for the admin and changes nothing
    expect((await syncFeed(db(), A, f, async () => new Response('<html>', { status: 200 }))).ok).toBe(false);
    expect((await listFeeds(db(), A))[0].lastError).toBeTruthy();
    await expect(addFeed(db(), A, { room: '3', url: 'http://x.test/a.ics' })).rejects.toThrow();
  });

  it('gives other sites a room calendar with dates only, behind a secret link', async () => {
    await act(A, { op: 'add', room: '1', from: addDays(today(), 4), to: addDays(today(), 6), name: 'Secret Name', phone: '599000111', guests: 2 });
    const ics = await roomIcs(db(), A, '1');
    expect(ics).toContain('DTSTART;VALUE=DATE:' + ymd(4)); expect(ics).not.toContain('Secret');
    expect((await get('more-a.visit2.ge', '/api/ical/1.ics?k=wrong')).status).toBe(404);
  });

  it('applies weekend, date and long-stay price rules everywhere quote is used', async () => {
    const st = await loadState(db(), A);
    let fri = addDays(today(), 30); while (new Date(fri + 'T00:00:00Z').getUTCDay() !== 5) fri = addDays(fri, 1);
    const base = quote(st, 'std', fri, addDays(fri, 2), 2);
    await act(A, { op: 'setting', k: 'priceRules', v: JSON.stringify({ weekend: { days: [5, 6], pct: 20 }, long: [{ nights: 7, pct: 10 }] }) });
    const st2 = await loadState(db(), A);
    expect(quote(st2, 'std', fri, addDays(fri, 2), 2)).toBe(Math.round(base * 1.2));
    const mon = addDays(fri, 3), long = quote(st2, 'std', mon, addDays(mon, 7), 2), plain = quote({ ...st2, settings: {} }, 'std', mon, addDays(mon, 7), 2);
    expect(long).toBeLessThan(plain);
  });

  it('refuses stays shorter than the rule and arrivals on closed days', async () => {
    const rules = JSON.stringify([{ from: '01-01', to: '12-31', min: 3, noIn: [] }]);
    expect(stayCheck({ stayRules: rules }, '2027-02-01', '2027-02-03')).toMatchObject({ ok: false, min: 3 });
    await act(A, { op: 'setting', k: 'stayRules', v: rules });
    const from = addDays(today(), 50);
    await expect(createRequest(db(), A, await loadState(db(), A), { from, to: addDays(from, 2), guests: 2, name: 'N', phone: '599222333' })).rejects.toThrow(/min 3/);
    await act(A, { op: 'setting', k: 'stayRules', v: '[]' });
  });

  it('a promo code works only on its hotel and stays private', async () => {
    await act(A, { op: 'setting', k: 'codes', v: JSON.stringify([{ code: 'WINTER', pct: 10 }]) });
    expect((await loadState(db(), A)).settings.codes).toBeUndefined();
    expect(await (await get('more-a.visit2.ge', '/api/code?c=winter')).json()).toEqual({ ok: true, code: 'WINTER', pct: 10 });
    expect((await (await get('more-b.visit2.ge', '/api/code?c=winter')).json()).ok).toBe(false);
    const from = addDays(today(), 60), to = addDays(today(), 62), st = await loadState(db(), A);
    const a = await createRequest(db(), A, st, { from, to, guests: 2, name: 'N', phone: '599222334', type: 'std' });
    const c = await createRequest(db(), A, st, { from, to, guests: 2, name: 'N', phone: '599222335', type: 'std', code: 'winter' });
    expect(c.total).toBe(Math.round(a.total * 0.9));
  });

  it('agencies, expenses and room problems belong to one hotel', async () => {
    await act(A, { op: 'setting', k: 'agents', v: JSON.stringify([{ id: 'ag1', name: 'მთის ტური', pct: 10 }]) });
    const bk = (await loadState(db(), A, { full: true })).bookings.find(x => x.status === 'confirmed');
    expect((await act(A, { op: 'agent', id: bk.id, agent: 'ag1' })).name).toBe('მთის ტური');
    expect((await act(B, { op: 'agent', id: bk.id, agent: 'ag1' })).ok).toBe(false);
    const e = await act(A, { op: 'expense', category: 'კომუნალური', amount: 120, method: 'cash' });
    expect(e.ok).toBe(true);
    expect((await loadState(db(), A, { full: true })).expenses.map(x => x.amount)).toEqual([120]);
    expect((await loadState(db(), B, { full: true })).expenses).toEqual([]);
    expect((await act(B, { op: 'unexpense', id: e.id })).ok).toBe(false);
    const cleaner = { id: 'c', name: 'Cleaner', owner: false, perms: ['clean'] };
    const i = await act(A, { op: 'issue', room: '2', text: 'კონდიციონერი არ მუშაობს' }, cleaner);
    expect(i.ok).toBe(true);
    expect((await act(A, { op: 'expense', category: 'x', amount: 1 }, cleaner)).ok).toBe(false);
    expect((await act(B, { op: 'issuedone', id: i.id })).ok).toBe(false);
    expect((await act(A, { op: 'issuedone', id: i.id }, cleaner)).ok).toBe(true);
    expect((await loadState(db(), A, { full: true })).issues[0]).toMatchObject({ status: 'done', doneBy: 'Cleaner', by: 'Cleaner' });
  });

  it('a no-show frees the room with the rule\'s fee', async () => {
    await act(A, { op: 'setting', k: 'cancelRule', v: JSON.stringify({ days: 3, pct: 100 }) });
    const r = await act(A, { op: 'add', room: '4', from: today(), to: addDays(today(), 2), name: 'NS', phone: '599444555', guests: 2, price: 200 });
    expect((await act(B, { op: 'noshow', id: r.id })).ok).toBe(false);
    expect(await act(A, { op: 'noshow', id: r.id })).toEqual({ ok: true, fee: 200 });
    const st = await loadState(db(), A, { full: true });
    expect(st.bookings.find(x => x.id === r.id)).toMatchObject({ status: 'cancelled', noShow: 1, fee: 200 });
    expect(roomFree(st, '4', today(), addDays(today(), 2))).toBe(true);
  });
});
