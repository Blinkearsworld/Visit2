import { describe, it, expect, beforeAll } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { seedSample, loadState } from '../src/db/hotel.js';
import { saveContent } from '../src/db/content.js';
import { saveAccount, getAccount, accountInfo, encKey, findOrder } from '../src/db/pay.js';
import { dry, checkCreds } from '../src/lib/banks.js';
import { today, addDays } from '../src/lib/time.js';

const post = (host, path, body) => exports.default.fetch(new Request(`https://${host}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const get = (host, path) => exports.default.fetch(new Request(`https://${host}${path}`));
const HA = 'pay-a.visit2.ge', HB = 'pay-b.visit2.ge';
const site = { site: { instant: { on: true, pay: { on: true, part: 'deposit', pct: 30 } } } };

describe('prepayment through the hotel\'s bank', () => {
  let A, B;
  beforeAll(async () => {
    A = await createTenant(env.DB, { slug: 'pay-a', name: 'Pay A' });
    B = await createTenant(env.DB, { slug: 'pay-b', name: 'Pay B' });
    await seedSample(env.DB, A); await seedSample(env.DB, B);
    // Visit2 turned the service on for A only; both chose prepayment and both have a bank
    await env.DB.prepare("UPDATE tenants SET addons = '[\"pay\"]' WHERE id = ?").bind(A.id).run();
    A.addons = ['pay'];
    await saveContent(env.DB, A, site); await saveContent(env.DB, B, site);
    await saveAccount(env.DB, A, encKey(env), { bank: 'tbc', id: 'merchant-A-1234', secret: 's-A', apikey: 'k-A' });
    await saveAccount(env.DB, B, encKey(env), { bank: 'bog', id: 'merchant-B-9999', secret: 's-B' });
  });

  it('keeps each hotel\'s bank credentials sealed and apart', async () => {
    const row = await env.DB.prepare('SELECT secret FROM pay_accounts WHERE tenant_id = ?').bind(A.id).first();
    expect(row.secret).not.toContain('s-A');
    expect((await getAccount(env.DB, A, encKey(env))).id).toBe('merchant-A-1234');
    expect((await getAccount(env.DB, B, encKey(env))).id).toBe('merchant-B-9999');
    expect(await accountInfo(env.DB, A)).toMatchObject({ bank: 'tbc', label: '…1234' });
    expect(await checkCreds(env, { bank: 'tbc', id: 'x', secret: 'wrong' })).toBe(false);
  });

  it('holds the room and sends the guest to the bank, only where the service is on', async () => {
    const from = addDays(today(), 30), to = addDays(today(), 32);
    const r = await (await post(HA, '/api/request', { from, to, guests: 2, name: 'Nino', phone: '+995 555 300 001', instant: true })).json();
    expect(r.instant).toBe(true); expect(r.pay).toMatch(/^https:\/\/pay\.test\//);
    expect(r.payAmount).toBe(Math.round(r.total * 0.3));
    const row = await env.DB.prepare('SELECT status, room, pay_state, pay_amount FROM bookings WHERE tenant_id = ? AND id = ?').bind(A.id, r.id).first();
    expect(row).toMatchObject({ status: 'confirmed', pay_state: 'waiting', pay_amount: r.payAmount }); expect(row.room).toBeTruthy();
    // B has a bank but Visit2 never turned the service on: an instant booking without payment
    const rb = await (await post(HB, '/api/request', { from, to, guests: 2, name: 'Nino', phone: '+995 555 300 001', instant: true })).json();
    expect(rb.instant).toBe(true); expect(rb.pay).toBeUndefined();
  });

  it('marks it paid only after asking the bank, and only in its own hotel', async () => {
    const from = addDays(today(), 50), to = addDays(today(), 51);
    const r = await (await post(HA, '/api/request', { from, to, guests: 1, name: 'Gio', phone: '+995 555 300 002', instant: true })).json();
    const oid = r.pay.split('/').pop();
    // a callback sent to the other hotel finds nothing there
    dry.set(oid, { state: 'paid', amount: r.payAmount });
    await post(HB, '/api/pay/cb', { PaymentId: oid });
    expect(await findOrder(env.DB, B, oid)).toBeNull();
    // a callback that only claims payment changes nothing until the bank says so
    dry.set(oid, { state: 'waiting', amount: r.payAmount });
    await post(HA, '/api/pay/cb', { PaymentId: oid });
    expect((await findOrder(env.DB, A, oid)).state).toBe('waiting');
    dry.set(oid, { state: 'paid', amount: r.payAmount });
    await post(HA, '/api/pay/cb', { PaymentId: oid });
    const b = await (await get(HA, `/api/booking?id=${r.id}&k=${r.key}`)).json();
    expect(b.booking.pay.state).toBe('paid'); expect(b.booking.status).toBe('confirmed');
  });

  it('frees the room when the time to pay runs out; a payment after that is marked late', async () => {
    const from = addDays(today(), 70), to = addDays(today(), 71);
    const r = await (await post(HA, '/api/request', { from, to, guests: 1, name: 'Ana', phone: '+995 555 300 003', instant: true })).json();
    await env.DB.prepare("UPDATE bookings SET pay_until = '2000-01-01T00:00:00.000Z' WHERE tenant_id = ? AND id = ?").bind(A.id, r.id).run();
    await loadState(env.DB, A);
    expect(await env.DB.prepare('SELECT status, pay_state FROM bookings WHERE tenant_id = ? AND id = ?').bind(A.id, r.id).first()).toMatchObject({ status: 'declined', pay_state: 'expired' });
    const oid = r.pay.split('/').pop();
    dry.set(oid, { state: 'paid', amount: r.payAmount });
    await post(HA, '/api/pay/cb', { PaymentId: oid });
    expect((await env.DB.prepare('SELECT pay_state FROM bookings WHERE tenant_id = ? AND id = ?').bind(A.id, r.id).first()).pay_state).toBe('late');
    // paying again is refused once the hold is gone
    expect((await post(HA, '/api/pay/again', { id: r.id, k: r.key })).status).toBe(409);
  });

  it('a smaller amount than asked is not a payment', async () => {
    const from = addDays(today(), 90), to = addDays(today(), 92);
    const r = await (await post(HA, '/api/request', { from, to, guests: 2, name: 'Lika', phone: '+995 555 300 004', instant: true })).json();
    const oid = r.pay.split('/').pop();
    dry.set(oid, { state: 'paid', amount: 1 });
    await post(HA, '/api/pay/cb', { PaymentId: oid });
    expect((await env.DB.prepare('SELECT pay_state FROM bookings WHERE tenant_id = ? AND id = ?').bind(A.id, r.id).first()).pay_state).toBe('waiting');
  });
});
