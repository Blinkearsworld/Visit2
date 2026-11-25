import { describe, it, expect, beforeAll } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { seedSample } from '../src/db/hotel.js';
import { connectPage, getConvo, pageToken } from '../src/db/meta.js';
import { saveContent } from '../src/db/content.js';
import { hmacHex } from '../src/lib/crypto.js';
import { today, addDays } from '../src/lib/time.js';

const hook = async (body, secret = 'test-meta-secret') => {
  const raw = JSON.stringify(body);
  return exports.default.fetch(new Request('https://visit2.ge/api/meta', { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=' + await hmacHex(secret, raw) }, body: raw }));
};
const msg = (page, psid, m) => ({ object: 'page', entry: [{ id: page, messaging: [{ sender: { id: psid }, recipient: { id: page }, message: m }] }] });
const tap = (page, psid, payload) => hook(msg(page, psid, { text: payload, quick_reply: { payload } }));
const say = (page, psid, text) => hook(msg(page, psid, { text }));

describe('Messenger: one Visit2 app, many hotels', () => {
  let A, B;
  beforeAll(async () => {
    A = await createTenant(env.DB, { slug: 'fb-a', name: 'FB A' }); B = await createTenant(env.DB, { slug: 'fb-b', name: 'FB B' });
    await seedSample(env.DB, A); await seedSample(env.DB, B);
    await saveContent(env.DB, A, { site: { instant: { on: true } }, contact: { phone: '+995 555 10 10 10' } });
    await connectPage(env.DB, A, { pageId: 'PAGE_A', token: 'token-of-a' }, env.META_ENC_KEY);
    await connectPage(env.DB, B, { pageId: 'PAGE_B', token: 'token-of-b' }, env.META_ENC_KEY);
  });

  it('keeps page tokens sealed and apart', async () => {
    const row = await env.DB.prepare('SELECT token_enc FROM meta_pages WHERE page_id = ?').bind('PAGE_A').first();
    expect(row.token_enc).not.toContain('token-of-a');
    expect(await pageToken(env.DB, A, 'PAGE_A', env.META_ENC_KEY)).toBe('token-of-a');
    expect(await pageToken(env.DB, B, 'PAGE_A', env.META_ENC_KEY)).toBe(null);
    await expect(connectPage(env.DB, B, { pageId: 'PAGE_A', token: 'x' }, env.META_ENC_KEY)).rejects.toThrow();
  });

  it('refuses unsigned messages and the wrong verify token', async () => {
    expect((await hook(msg('PAGE_A', 'u1', { text: 'hi' }), 'wrong')).status).toBe(401);
    expect((await exports.default.fetch(new Request('https://visit2.ge/api/meta?hub.mode=subscribe&hub.verify_token=no&hub.challenge=1'))).status).toBe(403);
    expect(await (await exports.default.fetch(new Request('https://visit2.ge/api/meta?hub.mode=subscribe&hub.verify_token=test-verify&hub.challenge=42'))).text()).toBe('42');
  });

  it('books from Messenger in the hotel whose page it is, and only there', async () => {
    const d = addDays(today(), 50), dd = d.slice(8) + '.' + d.slice(5, 7);
    await say('PAGE_A', 'guest1', 'გამარჯობა');
    await tap('PAGE_A', 'guest1', 'AVAIL');
    await say('PAGE_A', 'guest1', dd);
    await tap('PAGE_A', 'guest1', 'N_2');
    await tap('PAGE_A', 'guest1', 'A_2');
    await tap('PAGE_A', 'guest1', 'K_0');
    await tap('PAGE_A', 'guest1', 'B_0');
    let c = await getConvo(env.DB, A, 'fb:guest1');
    expect(c.step).toBe('offer');
    await tap('PAGE_A', 'guest1', 'BOOK_I');
    await say('PAGE_A', 'guest1', 'მესენჯერის სტუმარი');
    await say('PAGE_A', 'guest1', '+995 599 31 31 31');
    const row = await env.DB.prepare("SELECT tenant_id, status, instant, source FROM bookings WHERE phone = '+995 599 31 31 31'").first();
    expect(row.tenant_id).toBe(A.id); expect(row.status).toBe('confirmed'); expect(row.instant).toBe(1); expect(row.source).toBe('facebook');
    expect((await getConvo(env.DB, B, 'fb:guest1')).step).toBe('new');
  });

  it('ignores pages that belong to no hotel', async () => {
    expect((await hook(msg('PAGE_X', 'g9', { text: 'hi' }))).status).toBe(200);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM convos WHERE id = 'fb:g9'").first()).toEqual({ n: 0 });
  });

  it('pauses the bot when hotel staff answer in the inbox', async () => {
    await hook({ object: 'page', entry: [{ id: 'PAGE_B', messaging: [{ sender: { id: 'PAGE_B' }, recipient: { id: 'g2' }, message: { is_echo: true, text: 'ჩვენ გიპასუხებთ' } }] }] });
    expect((await getConvo(env.DB, B, 'fb:g2')).handoff).toBeGreaterThan(Date.now());
  });
});
