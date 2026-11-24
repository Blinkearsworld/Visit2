import { describe, it, expect, beforeAll } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { seedSample, createRequest, loadState } from '../src/db/hotel.js';
import { saveContent } from '../src/db/content.js';
import { today, addDays } from '../src/lib/time.js';

const get = async q => (await (await exports.default.fetch(new Request('https://visit2.ge/api/catalog' + q))).json()).hotels;

describe('the guests\' catalogue', () => {
  const d1 = addDays(today(), 40), d2 = addDays(today(), 42);
  beforeAll(async () => {
    const A = await createTenant(env.DB, { slug: 'cat-a', name: 'Catalog A', city: 'ბაკურიანი' });
    const B = await createTenant(env.DB, { slug: 'cat-b', name: 'Catalog B', city: 'ბათუმი' });
    const C = await createTenant(env.DB, { slug: 'cat-c', name: 'Closed C', city: 'თბილისი' });
    for (const t of [A, B, C]) await seedSample(env.DB, t);
    await saveContent(env.DB, A, { site: { hero: { img: 'media/a.webp' }, kind: 'mountain' } });
    await saveContent(env.DB, C, { site: { hero: { img: 'media/c.webp' } } });
    await env.DB.prepare("UPDATE tenants SET status = 'closed' WHERE id = ?").bind(C.id).run();
    // A: a guest booked every room for these dates (confirmed)
    const st = await loadState(env.DB, A, { full: true });
    for (const r of st.rooms) await env.DB.prepare("INSERT INTO bookings (tenant_id, id, room, type, date_from, date_to, guests, name, phone, status, created) VALUES (?, ?, ?, ?, ?, ?, 2, 'Secret Guest', '+995555000000', 'confirmed', ?)")
      .bind(A.id, 'b-' + r.id, r.id, r.type, d1, d2, today()).run();
  });
  it('lists open hotels with a photo, with their own address', async () => {
    const h = await get('');
    const a = h.find(x => x.slug === 'cat-a');
    expect(a.url).toBe('https://cat-a.visit2.ge/');
    expect(a.img).toBe('https://cat-a.visit2.ge/media/a.webp');
    expect(a.kinds).toEqual(['mountain']);
    expect(h.some(x => x.slug === 'cat-b')).toBe(false); // no photo yet
    expect(h.some(x => x.slug === 'cat-c')).toBe(false); // closed
  });
  it('says a hotel is full on booked dates and never shows guests', async () => {
    const raw = await (await exports.default.fetch(new Request(`https://visit2.ge/api/catalog?from=${d1}&to=${d2}&g=2`))).text();
    expect(raw).not.toContain('Secret Guest');
    expect(raw).not.toContain('555000000');
    const a = JSON.parse(raw).hotels.find(x => x.slug === 'cat-a');
    expect(a.offer).toBeNull();
    const free = (await get(`?from=${addDays(d2, 5)}&to=${addDays(d2, 7)}&g=2`)).find(x => x.slug === 'cat-a');
    expect(free.offer.total).toBeGreaterThan(0);
  });
});
