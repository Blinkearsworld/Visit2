// Visit2 Worker entry: finds the hotel by host name and hands the request on.
//   {slug}.visit2.ge, a hotel's own domain → that hotel's site
//   visit2.ge, www., app.                  → the platform (catalog, owners' page, admin)
//   {slug}.localhost:8787                  → local development
import { tenantByHost, tenantBySlug, normHost, allTenants } from './db/tenants.js';
import { purgeHotel } from './db/retention.js';
import { page, esc } from './lib/html.js';
import { hotelApi } from './api.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = normHost(url.hostname);
    const platformHosts = String(env.PLATFORM_HOSTS || '').split(',').map(normHost).filter(Boolean);

    // preview address before the real domain exists: https://visit2.<account>.workers.dev/h/{slug}/...
    const pm = url.pathname.match(/^\/h\/([a-z0-9-]+)(\/.*)?$/);
    if (pm && isPreviewHost(env, host)) {
      const t = await tenantBySlug(env.DB, pm[1]);
      if (!t) return notFound();
      if (!pm[2]) return Response.redirect(`${url.origin}/h/${pm[1]}/${url.search}`, 302); // relative links need the slash
      const inner = new URL(url); inner.pathname = pm[2];
      return hotelSite(new Request(inner, request), env, t, { dev: host === 'localhost' || host === '127.0.0.1', base: `/h/${pm[1]}/` });
    }

    let tenant = null;
    const dev = env.DEV_SUFFIX && host.endsWith(env.DEV_SUFFIX) ? host.slice(0, -env.DEV_SUFFIX.length) : null;
    if (dev) tenant = await tenantBySlug(env.DB, dev);
    else if (!platformHosts.includes(host)) tenant = await tenantByHost(env.DB, host);

    if (tenant) return hotelSite(request, env, tenant, { dev: !!dev });
    if (dev || !(platformHosts.includes(host) || isPreviewHost(env, host))) return notFound();
    // the platform: guests' search (index.html) and the owners' page (owners.html), static for now
    return env.ASSETS.fetch(request);
  },
  // daily: remove guests' personal data past its retention time (public/privacy.html)
  async scheduled(event, env, ctx) {
    for (const t of await allTenants(env.DB)) {
      try { await purgeHotel(env.DB, t); } catch (e) { console.log('purge failed', t.slug, e.message); }
    }
  },
};

// ---------- hotel site: the shared template (public/) filled in the browser from this hotel's API ----------
async function hotelSite(request, env, t, opts) {
  if (t.status === 'closed') return notFound();
  const p = new URL(request.url).pathname;
  if (p.startsWith('/api/') || p.startsWith('/media/')) return hotelApi(request, env, t, opts);
  if (t.status === 'paused' && (p === '/' || p === '/index.html'))
    return page(t.name, `<h1>${esc(t.name)}</h1><p>სეზონი მალე იხსნება. დაჯავშნეთ წინასწარ.</p>`, { lang: 'ka', tenant: t.slug });
  // the hotel's own site is the template page; the platform's home page is not served on a hotel's address
  const r = await env.ASSETS.fetch(p === '/' || p === '/index.html' ? new Request(new URL('/hotel', request.url), request) : request);
  // under a preview prefix, keep asset redirects (index.html → /) inside /h/{slug}/
  const loc = r.headers.get('location');
  if (opts.base && opts.base !== '/' && loc && loc.startsWith('/')) {
    const h = new Headers(r.headers); h.set('location', opts.base + loc.slice(1));
    return new Response(r.body, { status: r.status, headers: h });
  }
  return r;
}

function isPreviewHost(env, host) {
  return String(env.PREVIEW_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    .some(p => (p.startsWith('*.') ? host.endsWith(p.slice(1)) : host === p));
}

function notFound() {
  return page('ვერ მოიძებნა', '<h1>ეს სასტუმრო ვერ მოიძებნა</h1><p><a href="https://visit2.ge">Visit2.ge</a></p>', { status: 404, lang: 'ka' });
}
