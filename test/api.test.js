import { describe, it, expect, beforeAll } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { seedSample } from '../src/db/hotel.js';
import { addMember } from '../src/db/users.js';
import { today, addDays } from '../src/lib/time.js';

const call = (host, path, { method = 'GET', body, cookie } = {}) => exports.default.fetch(new Request(`https://${host}${path}`, {
  method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined,
}));
const login = async (host, email, password) => {
  const r = await call(host, '/api/login', { method: 'POST', body: { email, password } });
  return { status: r.status, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
};

describe('admin API of two hotels', () => {
  let A, B, ca, cb;
  const HA = 'api-a.visit2.ge', HB = 'api-b.visit2.ge', d0 = addDays(today(), 15);
  beforeAll(async () => {
    A = await createTenant(env.DB, { slug: 'api-a', name: 'API A' });
    B = await createTenant(env.DB, { slug: 'api-b', name: 'API B' });
    await seedSample(env.DB, A); await seedSample(env.DB, B);
    await addMember(env.DB, A, { email: 'Owner.A@example.com', name: 'მფლობელი A', password: 'password-a', role: 'owner' });
    await addMember(env.DB, B, { email: 'owner.b@example.com', name: 'მფლობელი B', password: 'password-b', role: 'owner' });
    ca = (await login(HA, 'owner.a@example.com', 'password-a')).cookie;
    cb = (await login(HB, 'owner.b@example.com', 'password-b')).cookie;
  });

  it('signs in only at the owner\'s own hotel', async () => {
    expect(ca).toMatch(/^v2_admin=/);
    expect((await login(HB, 'owner.a@example.com', 'password-a')).status).toBe(401);
    expect((await login(HA, 'owner.a@example.com', 'wrong-pass')).status).toBe(401);
  });

  it('a cookie from one hotel does not open another', async () => {
    expect((await call(HA, '/api/admin/state', { cookie: ca })).status).toBe(200);
    expect((await call(HB, '/api/admin/state', { cookie: ca })).status).toBe(401);
    expect((await call(HA, '/api/admin/state')).status).toBe(401);
  });

  it('a guest request reaches only its hotel, and the owner confirms it', async () => {
    const r = await call(HA, '/api/request', { method: 'POST', body: { from: d0, to: addDays(d0, 2), guests: 2, name: 'სტუმარი', phone: '599 12 34 56' } });
    const { id } = await r.json();
    const stA = await (await call(HA, '/api/admin/state', { cookie: ca })).json();
    const stB = await (await call(HB, '/api/admin/state', { cookie: cb })).json();
    expect(stA.bookings.map(b => b.id)).toContain(id);
    expect(stB.bookings.length).toBe(0);
    // B's owner cannot act on A's booking
    const bad = await (await call(HB, '/api/admin/action', { method: 'POST', cookie: cb, body: { op: 'confirm', id } })).json();
    expect(bad.ok).toBe(false);
    const ok = await (await call(HA, '/api/admin/action', { method: 'POST', cookie: ca, body: { op: 'confirm', id } })).json();
    expect(ok.ok).toBe(true);
    expect(ok.room).toBeTruthy();
    const pub = await (await call(HA, '/api/state')).json();
    expect(pub.bookings.find(b => b.id === id)).toBeTruthy();
    expect(pub.bookings[0].name).toBeUndefined(); // no guest names in public data
  });

  it('team: the owner adds staff with limited rights', async () => {
    const r = await (await call(HA, '/api/admin/users', { method: 'POST', cookie: ca, body: { op: 'add', name: 'ნათია', email: 'natia@example.com', password: 'natia-pass-1', perms: ['site'] } })).json();
    expect(r.ok).toBe(true);
    expect(r.users.map(u => u.email)).toContain('natia@example.com');
    const cs = (await login(HA, 'natia@example.com', 'natia-pass-1')).cookie;
    const st = await (await call(HA, '/api/admin/state', { cookie: cs })).json();
    expect(st.bookings).toEqual([]); // site-only staff see no guests
    const no = await call(HA, '/api/admin/action', { method: 'POST', cookie: cs, body: { op: 'setting', k: 'gapDiscount', v: '20' } });
    expect(no.status).toBe(403);
    expect((await call(HA, '/api/admin/users', { cookie: cs })).status).toBe(403);
  });

  it('site texts and photos belong to one hotel', async () => {
    await call(HA, '/api/admin/content', { method: 'POST', cookie: ca, body: { content: { 'hero.p': 'A-ს ტექსტი' } } });
    const a = await (await call(HA, '/api/content')).json(), b = await (await call(HB, '/api/content')).json();
    expect(a.content['hero.p']).toBe('A-ს ტექსტი');
    expect(b.content).toEqual({});
    const up = await exports.default.fetch(new Request(`https://${HA}/api/admin/content`, { method: 'PUT', headers: { cookie: ca, 'content-type': 'image/png' }, body: new Uint8Array([137, 80, 78, 71]) }));
    const { url } = await up.json();
    expect((await call(HA, '/' + url)).status).toBe(200);
    expect((await call(HB, '/' + url)).status).toBe(404);
  });
});
