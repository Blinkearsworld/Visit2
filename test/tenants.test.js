import { describe, it, expect, beforeAll } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import { createTenant, tenantByHost, validSlug, clearTenantCache } from '../src/db/tenants.js';
import { getSettings, setSetting, getSeasons } from '../src/db/settings.js';

const get = (host, path = '/') => exports.default.fetch(new Request(`https://${host}${path}`));

describe('slugs', () => {
  it('accepts simple latin names', () => {
    for (const s of ['jiji', 'villa-jiji', 'hotel2']) expect(validSlug(s)).toBe(true);
  });
  it('refuses reserved, short, odd ones', () => {
    for (const s of ['app', 'www', 'ab', '-jiji', 'jiji-', 'vil--la', 'Villa', 'ვილა', 'a'.repeat(41)]) expect(validSlug(s)).toBe(false);
  });
});

describe('two hotels', () => {
  let A, B;
  beforeAll(async () => {
    clearTenantCache();
    A = await createTenant(env.DB, { slug: 'hotel-a', name: 'სასტუმრო A', city: 'ბაკურიანი' });
    B = await createTenant(env.DB, { slug: 'hotel-b', name: 'სასტუმრო B', city: 'ბორჯომი' });
  });

  it('each subdomain finds its own hotel', async () => {
    expect((await tenantByHost(env.DB, 'hotel-a.visit2.ge')).id).toBe(A.id);
    expect((await tenantByHost(env.DB, 'HOTEL-B.visit2.ge:443')).id).toBe(B.id);
    expect(await tenantByHost(env.DB, 'nobody.visit2.ge')).toBeNull();
  });

  it('serves each hotel its own site, and 404 for an unknown host', async () => {
    const a = await (await get('hotel-a.visit2.ge')).text();
    expect(a).toContain('სასტუმრო A');
    expect(a).not.toContain('სასტუმრო B');
    expect((await get('nobody.visit2.ge')).status).toBe(404);
    expect((await get('hotel-b.localhost')).status).toBe(200);
  });

  it('serves the platform on visit2.ge', async () => {
    const r = await get('visit2.ge');
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('Visit2.ge');
  });

  it('a taken slug fails and leaves nothing behind', async () => {
    await expect(createTenant(env.DB, { slug: 'hotel-a', name: 'სხვა' })).rejects.toThrow();
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM tenants WHERE name = 'სხვა'").first('n');
    expect(n).toBe(0);
  });

  it('settings do not leak between hotels', async () => {
    await setSetting(env.DB, A, 'gapDiscount', '10');
    await setSetting(env.DB, B, 'gapDiscount', '25');
    await setSetting(env.DB, A, 'gapDiscount', '15');
    expect(await getSettings(env.DB, A)).toEqual({ gapDiscount: '15' });
    expect(await getSettings(env.DB, B)).toEqual({ gapDiscount: '25' });
  });

  it('each hotel gets its own copy of the default seasons', async () => {
    const a = await getSeasons(env.DB, A), b = await getSeasons(env.DB, B);
    expect(a.map(s => s.id)).toEqual(['peak', 'winter', 'summer', 'off']);
    expect(b).toEqual(a);
  });

  it('a paused hotel shows the season-opens page', async () => {
    await env.DB.prepare("UPDATE tenants SET status = 'paused' WHERE id = ?").bind(B.id).run();
    clearTenantCache();
    expect(await (await get('hotel-b.visit2.ge')).text()).toContain('სეზონი მალე იხსნება');
  });
});
