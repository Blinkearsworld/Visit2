import { describe, it, expect, beforeAll } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
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
