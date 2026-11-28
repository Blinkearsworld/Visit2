import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:workers';
import { createTenant, tenantBySlug } from '../src/db/tenants.js';
import { importJiji, d1Reader, JIJI_SLUG } from '../src/db/jiji.js';
import { loadState } from '../src/db/hotel.js';
import { getContent } from '../src/db/content.js';
import { addDomain } from '../src/db/ops.js';

// a stand-in for the villa's old database: answers the importer's queries by table name
const OLD = {
  types: [{ id: 'family', name: 'საოჯახო', rates: '[{"guests":2,"price":{"peak":320,"winter":240,"summer":200,"off":150}}]', sort: 0 },
    { id: 'lux', name: 'ლუქსი', rates: '[{"guests":2,"price":{"peak":480,"winter":370,"summer":290,"off":210}}]', sort: 1 }],
  rooms: [{ id: '1', type: 'family' }, { id: '2', type: 'lux' }],
  bookings: [{ id: 'b1', room: '1', type: 'family', date_from: '2026-12-30', date_to: '2027-01-02', guests: 3, name: 'ნინო', phone: '+995599000001', status: 'confirmed', source: 'site', created: '2026-11-01T10:00:00Z', price: 960, note: '' }],
  payments: [{ id: 'p1', booking: 'b1', amount: 300, method: 'bank', date: '2026-11-02', created: '2026-11-02T10:00:00Z' }],
  guest_notes: [{ k: '995599000001', note: 'ბავშვის საწოლი', updated: '2026-11-01' }],
  settings: [{ k: 'winterFrom', v: '12-01' }, { k: 'owner_name', v: 'x' }, { k: 'metaToken', v: 'secret' }],
  media: [{ id: 'm1', mime: 'image/jpeg', size: 3, created: '2026-01-01T00:00:00Z', hex: 'ffd8ff' }],
  site_content: [{ v: JSON.stringify({ contact: { phone: '+995 596 90 40 60' } }) }],
};
const read = async sql => OLD[sql.match(/FROM (\w+)/)[1]].map(r => ({ ...r }));

describe('Villa JIJI moves onto Visit2', () => {
  let other, otherBefore;
  beforeAll(async () => {
    other = await createTenant(env.DB, { slug: 'jiji-neighbour', name: 'Neighbour' });
    await env.DB.prepare("INSERT INTO rooms (tenant_id, id, type, sort) VALUES (?, '1', 'std', 0)").bind(other.id).run();
    await env.DB.prepare("INSERT INTO bookings (tenant_id, id, room, type, date_from, date_to, guests, name, status) VALUES (?, 'b1', '1', 'std', '2026-12-30', '2027-01-02', 2, 'Other guest', 'confirmed')").bind(other.id).run();
    otherBefore = await loadState(env.DB, other, { full: true });
  });

  it('copies rooms, prices, bookings, payments, notes, allowed settings and photos into a hidden, free hotel', async () => {
    const r = await importJiji(env.DB, read);
    expect(r).toMatchObject({ slug: JIJI_SLUG, fresh: true, types: 2, rooms: 2, bookings: 1, payments: 1, notes: 1, media: 1 });
    const t = await tenantBySlug(env.DB, JIJI_SLUG);
    expect(t.plan).toBe('free');
    const row = await env.DB.prepare('SELECT addons FROM tenants WHERE id = ?').bind(t.id).first();
    expect(JSON.parse(row.addons)).toContain('hidden');
    const st = await loadState(env.DB, t, { full: true });
    expect(st.rooms.map(x => x.id)).toEqual(['1', '2']);
    expect(st.bookings[0]).toMatchObject({ id: 'b1', name: 'ნინო', price: 960, children: 0 });
    expect(st.settings.winterFrom).toBe('12-01');
    expect(st.settings.metaToken).toBeUndefined();
    const c = (await getContent(env.DB, t)).content;
    expect(c.site.theme).toBe('lapis');
    expect(c.contact.phone).toBe('+995 596 90 40 60');
  });

  it('refreshes the copy when run again, without doubling anything', async () => {
    OLD.bookings.push({ id: 'b2', room: '2', type: 'lux', date_from: '2027-02-01', date_to: '2027-02-03', guests: 2, name: 'გიორგი', status: 'new' });
    const r = await importJiji(env.DB, read);
    expect(r).toMatchObject({ fresh: false, bookings: 2 });
    const t = await tenantBySlug(env.DB, JIJI_SLUG);
    expect((await loadState(env.DB, t, { full: true })).bookings.length).toBe(2);
  });

  it("never touches another hotel's data", async () => {
    const now = await loadState(env.DB, other, { full: true });
    expect(now.bookings).toEqual(otherBefore.bookings);
    expect(now.rooms).toEqual(otherBefore.rooms);
  });

  it('refuses once villajiji.com points at Visit2, so new bookings are kept', async () => {
    const t = await tenantBySlug(env.DB, JIJI_SLUG);
    await addDomain(env.DB, t, { id: 'u1', name: 'test' }, 'villajiji.com');
    await expect(importJiji(env.DB, read)).rejects.toThrow(/გადართული/);
  });

  it('stops before changing anything when the old database has no rooms', async () => {
    await expect(importJiji(env.DB, async () => [])).rejects.toThrow(/ნომრები ვერ ვიპოვე/);
  });

  it('asks for the token before reading', () => {
    expect(() => d1Reader({ account: 'a', database: 'd', token: '' })).toThrow(/JIJI_D1_TOKEN/);
  });

  it('reads the old database through the Cloudflare API with the token', async () => {
    let seen;
    const fake = async (url, o) => { seen = { url, o }; return new Response(JSON.stringify({ success: true, result: [{ results: [{ id: 'x' }] }] })); };
    const q = d1Reader({ account: 'acc', database: 'db1', token: 'tok' }, fake);
    expect(await q('SELECT id FROM rooms')).toEqual([{ id: 'x' }]);
    expect(seen.url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/d1/database/db1/query');
    expect(seen.o.headers.authorization).toBe('Bearer tok');
  });
});
