// Visit2 Worker entry: finds the hotel by host name and hands the request on.
//   {slug}.visit2.ge, a hotel's own domain → that hotel's site
//   visit2.ge, www., app.                  → the platform (catalog, owners' page, admin)
//   {slug}.localhost:8787                  → local development
import { tenantByHost, tenantBySlug, normHost } from './db/tenants.js';
import { page, esc } from './lib/html.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = normHost(url.hostname);
    const platformHosts = String(env.PLATFORM_HOSTS || '').split(',').map(normHost).filter(Boolean);

    let tenant = null;
    const dev = env.DEV_SUFFIX && host.endsWith(env.DEV_SUFFIX) ? host.slice(0, -env.DEV_SUFFIX.length) : null;
    if (dev) tenant = await tenantBySlug(env.DB, dev);
    else if (!platformHosts.includes(host)) tenant = await tenantByHost(env.DB, host);

    if (tenant) return hotelSite(request, env, tenant);
    if (dev || !platformHosts.includes(host)) return notFound();
    return platform(request, env);
  },
};

// ---------- hotel site (stage 3 replaces this placeholder) ----------
async function hotelSite(request, env, t) {
  if (t.status === 'closed') return notFound();
  const body = t.status === 'paused'
    ? `<h1>${esc(t.name)}</h1><p>სეზონი მალე იხსნება. დაჯავშნეთ წინასწარ.</p>`
    : `<h1>${esc(t.name)}</h1>${t.city ? `<p>${esc(t.city)}</p>` : ''}`;
  return page(t.name, body, { lang: 'ka', tenant: t.slug });
}

// ---------- platform (catalog and owners' page come later) ----------
async function platform(request, env) {
  return page('Visit2.ge', '<h1>Visit2.ge</h1><p>სასტუმროს სისტემა საკომისიოს გარეშე.</p>', { lang: 'ka' });
}

function notFound() {
  return page('ვერ მოიძებნა', '<h1>ეს სასტუმრო ვერ მოიძებნა</h1><p><a href="https://visit2.ge">Visit2.ge</a></p>', { status: 404, lang: 'ka' });
}
