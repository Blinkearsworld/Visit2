import { describe, it, expect, beforeAll } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { seedSample } from '../src/db/hotel.js';
import { addMember } from '../src/db/users.js';
import { purgeHotel, purgePlatform } from '../src/db/retention.js';
import { tenantBySlug } from '../src/db/tenants.js';

const call = (host, path, { method = 'GET', body, cookie } = {}) => exports.default.fetch(new Request(`https://${host}${path}`, {
  method, redirect: 'manual', headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined,
}));
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
const ops = (p, body, cookie) => call('visit2.ge', '/api/ops/' + p, { method: body ? 'POST' : 'GET', body, cookie });

describe('Visit2 managing hotels, and entering an admin only when let in', () => {
  let staff, oa, ob;
  const HA = 'sup-a.visit2.ge', HB = 'sup-b.visit2.ge';
  beforeAll(async () => {
    const A = await createTenant(env.DB, { slug: 'sup-a', name: 'Sup A' });
    const B = await createTenant(env.DB, { slug: 'sup-b', name: 'Sup B' });
    const Z = await createTenant(env.DB, { slug: 'sup-home', name: 'Visit2 home' });
    await seedSample(env.DB, A); await seedSample(env.DB, B);
    await addMember(env.DB, A, { email: 'a@sup.test', name: 'Owner A', password: 'password-a', role: 'owner' });
    await addMember(env.DB, B, { email: 'b@sup.test', name: 'Owner B', password: 'password-b', role: 'owner' });
    await addMember(env.DB, Z, { email: 'gio@visit2.test', name: 'Gio', password: 'gio-password', role: 'owner' });
    await env.DB.prepare("UPDATE users SET platform = 1 WHERE email = 'gio@visit2.test'").run();
    staff = cookieOf(await ops('login', { email: 'gio@visit2.test', password: 'gio-password' }));
    oa = cookieOf(await call(HA, '/api/login', { method: 'POST', body: { email: 'a@sup.test', password: 'password-a' } }));
    ob = cookieOf(await call(HB, '/api/login', { method: 'POST', body: { email: 'b@sup.test', password: 'password-b' } }));
  });

  it('cannot enter a hotel admin until its owner allows it', async () => {
    const r = await (await ops('hotel-action', { slug: 'sup-a', do: 'enter' }, staff)).json();
    expect(r.ok).toBe(false);
    // the staff cookie alone opens nothing in the hotel's admin
    expect((await call(HA, '/api/admin/state', { cookie: staff })).status).toBe(401);
  });

  it("lets in for the owner's time, into that hotel only, and the owner can take it back", async () => {
    expect((await (await call(HA, '/api/admin/help', { method: 'POST', body: { hours: 24 }, cookie: oa })).json()).ok).toBe(true);
    const e = await (await ops('hotel-action', { slug: 'sup-a', do: 'enter' }, staff)).json();
    expect(e.ok).toBe(true);
    const u = new URL(e.url);
    expect(u.host).toBe(HA);
    // the same key at another hotel opens nothing
    const other = await call(HB, u.pathname + u.search);
    expect(cookieOf(other)).not.toMatch(/^v2_admin=./);
    expect((await call(HB, '/api/admin/state', { cookie: cookieOf(other) })).status).toBe(401);
    // B never allowed help
    expect((await (await ops('hotel-action', { slug: 'sup-b', do: 'enter' }, staff)).json()).ok).toBe(false);

    const go = await call(HA, u.pathname + u.search);
    expect(go.status).toBe(303);
    const sc = cookieOf(go);
    const st = await (await call(HA, '/api/admin/state', { cookie: sc })).json();
    expect(st.me.support).toBe(true);
    expect(st.hotel.slug).toBe('sup-a');
    expect((await call(HB, '/api/admin/state', { cookie: sc })).status).toBe(401);
    // a helper cannot give itself more time
    expect((await call(HA, '/api/admin/help', { method: 'POST', body: { hours: 168 }, cookie: sc })).status).toBe(403);

    await call(HA, '/api/admin/help', { method: 'POST', body: { hours: 0 }, cookie: oa });
    expect((await call(HA, '/api/admin/state', { cookie: sc })).status).toBe(401);
    expect((await (await ops('hotel-action', { slug: 'sup-a', do: 'enter' }, staff)).json()).ok).toBe(false);
  });

  it('keeps payments, services and status to the hotel they were made for', async () => {
    expect((await (await ops('hotel-action', { slug: 'sup-a', do: 'pay', amount: 50, until: '2027-01-24', method: 'bank' }, staff)).json()).ok).toBe(true);
    await ops('hotel-action', { slug: 'sup-a', do: 'addons', addons: ['catalog', 'nonsense'] }, staff);
    const a = (await (await ops('hotel?slug=sup-a', null, staff)).json()).hotel;
    const b = (await (await ops('hotel?slug=sup-b', null, staff)).json()).hotel;
    expect(a.payments.length).toBe(1); expect(a.paidUntil).toBe('2027-01-24'); expect(a.status).toBe('active');
    expect(a.addons).toEqual(['catalog']); expect(a.monthly).toBe(70);
    expect(b.payments.length).toBe(0); expect(b.paidUntil).toBe(null); expect(b.addons).toEqual([]);
    // a payment of A cannot be removed through B
    expect((await (await ops('hotel-action', { slug: 'sup-b', do: 'pay-del', id: a.payments[0].id }, staff)).json()).ok).toBe(false);
    expect((await (await ops('hotel?slug=sup-a', null, staff)).json()).hotel.payments.length).toBe(1);
    // the hotel sees what we did, in its own journal
    expect(a.ourLog.some(l => l.op === 'გადახდა')).toBe(true);
    expect((await (await ops('hotel?slug=sup-b', null, staff)).json()).hotel.ourLog.length).toBe(0);
  });

  it('resets only the owner password of that hotel, and a hotel is deleted only when closed and named', async () => {
    const p = (await (await ops('hotel-action', { slug: 'sup-b', do: 'password' }, staff)).json()).password;
    expect(p).toMatch(/^\w{4}-\w{4}-\w{4}$/);
    expect((await call(HB, '/api/admin/state', { cookie: ob })).status).toBe(401);
    expect(cookieOf(await call(HB, '/api/login', { method: 'POST', body: { email: 'b@sup.test', password: p } }))).toMatch(/^v2_admin=./);
    expect((await call(HA, '/api/admin/state', { cookie: oa })).status).toBe(200);

    expect((await (await ops('hotel-action', { slug: 'sup-b', do: 'delete', confirm: 'sup-b' }, staff)).json()).ok).toBe(false);
    await ops('hotel-action', { slug: 'sup-b', do: 'status', status: 'closed' }, staff);
    expect((await (await ops('hotel-action', { slug: 'sup-b', do: 'delete', confirm: 'sup-a' }, staff)).json()).ok).toBe(false);
    expect((await (await ops('hotel-action', { slug: 'sup-b', do: 'delete', confirm: 'sup-b' }, staff)).json()).ok).toBe(true);
    expect((await ops('hotel?slug=sup-b', null, staff)).status).toBe(404);
    expect((await (await ops('hotel?slug=sup-a', null, staff)).json()).hotel.payments.length).toBe(1);
  });

  it('remembers when a hotel was closed and keeps our payment records for accounting', async () => {
    await ops('hotel-action', { slug: 'sup-a', do: 'status', status: 'closed' }, staff);
    let a = await tenantBySlug(env.DB, 'sup-a');
    const row = await env.DB.prepare('SELECT closed_at FROM tenants WHERE id = ?').bind(a.id).first();
    expect(row.closed_at).toBeTruthy();
    await ops('hotel-action', { slug: 'sup-a', do: 'status', status: 'active' }, staff);
    expect((await env.DB.prepare('SELECT closed_at FROM tenants WHERE id = ?').bind(a.id).first()).closed_at).toBe(null);
    // an expired help access is removed by the daily clean-up; payments stay
    await env.DB.prepare('INSERT OR REPLACE INTO support_access (tenant_id, until, granted_by, granted_at) VALUES (?, ?, ?, ?)').bind(a.id, Date.now() - 1000, 'x', 'x').run();
    await purgeHotel(env.DB, a); await purgePlatform(env.DB);
    expect(await env.DB.prepare('SELECT * FROM support_access WHERE tenant_id = ?').bind(a.id).first()).toBe(null);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE tenant_id = ?').bind(a.id).first()).n).toBe(1);
  });

  it('counts guests of all hotels against the data-protection threshold', async () => {
    const st = await (await ops('state', null, staff)).json();
    expect(st.limits.guestLimit).toBe(110000);
    expect(st.limits.guests).toBeGreaterThanOrEqual(0);
    expect(st.limits.server).toBe('EU');
  });

  it('shows notices in every admin only on their days, and only staff can write them', async () => {
    const d = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
    await ops('notice', { text: 'ხვალ განახლება', from: d, to: d }, staff);
    await ops('notice', { text: 'მომავალში', from: '2099-01-01', to: '2099-01-02' }, staff);
    const st = await (await call(HA, '/api/admin/state', { cookie: oa })).json();
    expect(st.hotel.notices.map(n => n.text)).toEqual(['ხვალ განახლება']);
    expect((await call('visit2.ge', '/api/ops/notice', { method: 'POST', body: { text: 'x', from: d, to: d }, cookie: oa })).status).toBe(401);
  });
});
