import { describe, it, expect, beforeAll } from 'vitest';
import { env, exports } from 'cloudflare:workers';
import { createTenant } from '../src/db/tenants.js';
import { legacyPath } from '../src/lib/legacy.js';

const get = (host, path) => exports.default.fetch(new Request(`https://${host}${path}`, { redirect: 'manual' }));

describe("a moved hotel's old addresses", () => {
  beforeAll(async () => {
    await createTenant(env.DB, { slug: 'villajiji', name: 'Villa JIJI' });
    await createTenant(env.DB, { slug: 'legacy-other', name: 'Other' });
  });

  it('maps only that hotel, only known addresses', () => {
    expect(legacyPath('villajiji', '/bakuriani-winter')).toBe('/files/jiji/pages/bakuriani-winter');
    expect(legacyPath('villajiji', '/img/winter/snow-gate.jpg')).toBe('/files/jiji/img/winter/snow-gate.jpg');
    expect(legacyPath('villajiji', '/img/../../hotel.html')).toBeNull();
    expect(legacyPath('villajiji', '/rooms')).toBeNull();
    expect(legacyPath('legacy-other', '/bakuriani-winter')).toBeNull();
  });

  it("serves Villa JIJI's guide at the old address, and not on another hotel's site", async () => {
    const r = await get('villajiji.visit2.ge', '/bakuriani-winter');
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('ზამთარი ბაკურიანში');
    const o = await get('legacy-other.visit2.ge', '/bakuriani-winter');
    expect(await o.text()).not.toContain('ზამთარი ბაკურიანში');
  });

  it('sends the old admin address to the new admin', async () => {
    const r = await get('villajiji.visit2.ge', '/admin.html');
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('https://villajiji.visit2.ge/admin');
  });
});
