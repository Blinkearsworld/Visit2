import { describe, it, expect, beforeAll } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { opsSetPassword } from '../src/db/ops.js';
import { addMember } from '../src/db/users.js';
import { today, addDays } from '../src/lib/time.js';

const call = (path, { method = 'GET', body, cookie } = {}) => exports.default.fetch(new Request(`https://visit2.ge${path}`, {
  method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined,
}));
const login = async (email, password) => {
  const r = await call('/api/ops/login', { method: 'POST', body: { email, password } });
  return { status: r.status, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
};

describe("Visit2's own admin", () => {
  let staff;
  beforeAll(async () => {
    const t = await createTenant(env.DB, { slug: 'ops-hotel', name: 'Ops hotel' });
    await env.DB.prepare('UPDATE tenants SET trial_ends = ? WHERE id = ?').bind(addDays(today(), 2), t.id).run();
    await addMember(env.DB, t, { email: 'owner@ops.test', name: 'Owner', password: 'owner-password', role: 'owner' });
    await addMember(env.DB, t, { email: 'boss@visit2.test', name: 'Boss', password: 'boss-password', role: 'staff' });
    await env.DB.prepare("UPDATE users SET platform = 1 WHERE email = 'boss@visit2.test'").run();
    staff = (await login('boss@visit2.test', 'boss-password')).cookie;
  });

  it('lets in only Visit2 staff, not hotel owners', async () => {
    expect((await login('owner@ops.test', 'owner-password')).status).toBe(401);
    expect((await login('boss@visit2.test', 'wrong')).status).toBe(401);
    expect((await call('/api/ops/state')).status).toBe(401);
    expect(staff).toMatch(/^v2_ops=/);
  });

  it('does not open from a hotel address', async () => {
    const r = await call('/api/ops/state', { cookie: staff });
    expect(r.status).toBe(200);
    const h = await exports.default.fetch(new Request('https://ops-hotel.visit2.ge/api/ops/state', { headers: { cookie: staff } }));
    expect(h.status).toBe(404);
  });

  it('shows every hotel and adds a call task when a trial is about to end, once', async () => {
    const a = await (await call('/api/ops/state', { cookie: staff })).json();
    expect(a.hotels.some(h => h.slug === 'ops-hotel' && h.owner === 'owner@ops.test')).toBe(true);
    expect(a.stats.trialEnding).toBeGreaterThanOrEqual(1);
    const calls = x => x.tasks.filter(t => t.hotel === 'ops-hotel' && t.what === 'დაურეკე');
    expect(calls(a).length).toBe(1);
    const b = await (await call('/api/ops/state', { cookie: staff })).json();
    expect(calls(b).length).toBe(1);
  });

  it('saves, finishes and deletes a task', async () => {
    const r = await (await call('/api/ops/task', { method: 'POST', cookie: staff, body: { what: 'ფოტოები ჩაუსვი', who: 'გიორგი', hotel: 'ops-hotel', why: 'ახალი კლიენტი', due: addDays(today(), 1) } })).json();
    expect(r.ok).toBe(true);
    await call('/api/ops/task', { method: 'POST', cookie: staff, body: { id: r.id, what: 'ფოტოები ჩაუსვი', status: 'done' } });
    let s = await (await call('/api/ops/state', { cookie: staff })).json();
    expect(s.tasks.find(t => t.id === r.id).status).toBe('done');
    await call('/api/ops/task-del', { method: 'POST', cookie: staff, body: { id: r.id } });
    s = await (await call('/api/ops/state', { cookie: staff })).json();
    expect(s.tasks.find(t => t.id === r.id)).toBeUndefined();
    expect((await (await call('/api/ops/task', { method: 'POST', cookie: staff, body: { what: '' } })).json()).ok).toBe(false);
  });
});

describe('a hotel\'s own domain', () => {
  it('maps the domain and www to one hotel only', async () => {
    const { createTenant, tenantByHost } = await import('../src/db/tenants.js');
    const { addDomain, removeDomain, hotelDomains } = await import('../src/db/ops.js');
    const { env } = await import('cloudflare:workers');
    const me = { id: 'ops', name: 'Ops' };
    const A = await createTenant(env.DB, { slug: 'dom-a', name: 'Dom A' }), B = await createTenant(env.DB, { slug: 'dom-b', name: 'Dom B' });
    await addDomain(env.DB, A, me, 'https://www.MyHotel.ge/');
    expect((await tenantByHost(env.DB, 'myhotel.ge')).id).toBe(A.id);
    expect((await tenantByHost(env.DB, 'www.myhotel.ge')).id).toBe(A.id);
    await expect(addDomain(env.DB, B, me, 'myhotel.ge')).rejects.toThrow();
    await expect(addDomain(env.DB, B, me, 'x.visit2.ge')).rejects.toThrow();
    expect((await hotelDomains(env.DB, A)).map(x => x.host).sort()).toEqual(['dom-a.visit2.ge', 'myhotel.ge', 'www.myhotel.ge']);
    await removeDomain(env.DB, A, me, 'myhotel.ge');
    expect(await tenantByHost(env.DB, 'myhotel.ge')).toBeNull();
  });
});

describe('a hotel free for good', () => {
  it('has no price, no trial calls, and every service', async () => {
    const { createTenant, tenantById } = await import('../src/db/tenants.js');
    const { setFree, allHotels, hotelDetail } = await import('../src/db/ops.js');
    const { env } = await import('cloudflare:workers');
    const A = await createTenant(env.DB, { slug: 'free-a', name: 'Free A' });
    await setFree(env.DB, A, { id: 'ops', name: 'Ops' }, true);
    const t = await tenantById(env.DB, A.id);
    expect(t).toMatchObject({ plan: 'free', status: 'active' });
    expect((await allHotels(env.DB)).find(h => h.slug === 'free-a')).toMatchObject({ free: true, monthly: 0 });
    expect((await hotelDetail(env.DB, t)).monthly).toBe(0);
    await setFree(env.DB, t, { id: 'ops', name: 'Ops' }, false);
    expect((await tenantById(env.DB, A.id)).plan).toBeNull();
  });
});

describe("first sign-in to Visit2's own admin", () => {
  it('needs the OPS_SETUP code and only the founder or Visit2 staff', async () => {
    await expect(opsSetPassword(env.DB, '', { email: 'visit2ge@gmail.com', code: 'x', password: 'new-password' })).rejects.toThrow(/OPS_SETUP/);
    await expect(opsSetPassword(env.DB, 'long-setup-code-123', { email: 'visit2ge@gmail.com', code: 'wrong', password: 'new-password' })).rejects.toThrow(/არ ემთხვევა/);
    await expect(opsSetPassword(env.DB, 'long-setup-code-123', { email: 'stranger@x.test', code: 'long-setup-code-123', password: 'new-password' })).rejects.toThrow(/უფლება/);
    const u = await opsSetPassword(env.DB, 'long-setup-code-123', { email: 'visit2ge@gmail.com', code: 'long-setup-code-123', password: 'new-password' });
    expect(u.email).toBe('visit2ge@gmail.com');
    const r = await call('/api/ops/login', { method: 'POST', body: { email: 'visit2ge@gmail.com', password: 'new-password' } });
    expect(r.status).toBe(200);
  });
});

describe('an owner for a hotel Visit2 set up', () => {
  it('adds one owner with a new password, then refuses a second', async () => {
    const { setOwner } = await import('../src/db/ops.js');
    const t = await createTenant(env.DB, { slug: 'own-less', name: 'Own Less' });
    const pw = await setOwner(env.DB, t, { id: 'u1', name: 'Visit2' }, 'Owner@Villa.test');
    expect(pw).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
    const m = await env.DB.prepare("SELECT u.email FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = ? AND m.role = 'owner'").bind(t.id).first();
    expect(m.email).toBe('owner@villa.test');
    await expect(setOwner(env.DB, t, { id: 'u1', name: 'Visit2' }, 'x@y.test')).rejects.toThrow(/უკვე/);
  });
});

describe('changing my own password', () => {
  it('needs the current password, then the new one works and the old does not', async () => {
    const { changeMyPassword, checkLogin } = await import('../src/db/users.js');
    const t = await createTenant(env.DB, { slug: 'mypw-a', name: 'A' });
    const other = await createTenant(env.DB, { slug: 'mypw-b', name: 'B' });
    const id = await addMember(env.DB, t, { email: 'me@pw.test', name: 'Me', password: 'old-password', role: 'owner' });
    await expect(changeMyPassword(env.DB, t, { id }, 'wrong', 'new-password')).rejects.toThrow(/არ ემთხვევა/);
    await expect(changeMyPassword(env.DB, other, { id }, 'old-password', 'new-password')).rejects.toThrow(/არ ემთხვევა/);
    await changeMyPassword(env.DB, t, { id }, 'old-password', 'new-password');
    expect(await checkLogin(env.DB, t, 'me@pw.test', 'old-password')).toBeNull();
    expect(await checkLogin(env.DB, t, 'me@pw.test', 'new-password')).toBeTruthy();
  });
});

describe('a copied password with a space or line break at the end', () => {
  it('still signs in', async () => {
    const { checkLogin } = await import('../src/db/users.js');
    const t = await createTenant(env.DB, { slug: 'pw-trim', name: 'T' });
    await addMember(env.DB, t, { email: 'trim@pw.test', name: 'Trim', password: 'abcd-efgh-jkmn', role: 'owner' });
    expect(await checkLogin(env.DB, t, 'trim@pw.test', 'abcd-efgh-jkmn \n')).toBeTruthy();
    expect(await checkLogin(env.DB, t, 'trim@pw.test', 'abcd')).toBeNull();
  });
});

describe('the catalogue links a hotel with its own domain there', () => {
  it('uses the custom domain', async () => {
    const { catalog } = await import('../src/db/catalog.js');
    const { setAddons } = await import('../src/db/ops.js');
    const t = await createTenant(env.DB, { slug: 'own-dom', name: 'Own Domain', city: 'ბაკურიანი' });
    await env.DB.prepare("INSERT INTO domains (host, tenant_id, kind, created) VALUES ('owndomain-test.ge', ?, 'custom', '2026-01-01')").bind(t.id).run();
    await env.DB.prepare("INSERT INTO site_content (tenant_id, v, created) VALUES (?, ?, '2026-01-01')").bind(t.id, JSON.stringify({ site: { hero: { img: 'files/x.jpg' } } })).run();
    await env.DB.prepare("INSERT INTO types (tenant_id, id, name, rates, sort) VALUES (?, 'std', 'S', '[{\"guests\":2,\"price\":{\"peak\":100}}]', 0)").bind(t.id).run();
    await env.DB.prepare("INSERT INTO rooms (tenant_id, id, type, sort) VALUES (?, '1', 'std', 0)").bind(t.id).run();
    let list = await catalog(env.DB, { siteOf: x => `https://${x.slug}.visit2.ge/` });
    const h = list.find(x => x.slug === 'own-dom');
    expect(h.url).toBe('https://owndomain-test.ge/');
    expect(h.img).toBe('https://owndomain-test.ge/files/x.jpg');
    await setAddons(env.DB, t, { id: 'u1', name: 'V' }, ['hidden']);
    list = await catalog(env.DB, { siteOf: x => `https://${x.slug}.visit2.ge/` });
    expect(list.find(x => x.slug === 'own-dom')).toBeUndefined();
  });
});
