// API of the platform itself (visit2.ge, not a hotel): for now only self sign-up.
//   POST /api/signup  { name, city, email, password, theme, agree } → { ok, slug, site, admin }
import { json, readJson } from './lib/http.js';
import { signUp, signUpsFrom, noteSignUp, SIGNUP_LIMIT } from './db/signup.js';
import { ROOT_DOMAIN } from './db/tenants.js';

export async function platformApi(request, env, { preview = false } = {}) {
  const url = new URL(request.url), p = url.pathname, m = request.method, db = env.DB;
  if (p === '/api/signup' && m === 'POST') {
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    if ((await signUpsFrom(db, ip)) >= SIGNUP_LIMIT) return json({ ok: false, msg: 'ამ მისამართიდან ბევრი საიტი შეიქმნა. სცადე 15 წუთში, ან მოგვწერე.' }, 429);
    const body = await readJson(request);
    if (!body) return json({ ok: false, msg: 'ფორმა ვერ მოვიდა. განაახლე გვერდი და სცადე თავიდან.' }, 400);
    const r = await signUp(db, body);
    if (!r.ok) return json(r, 400);
    await noteSignUp(db, ip);
    // before the real domain works, hotels open under /h/{slug}/ on this same address
    const site = preview ? `${url.origin}/h/${r.tenant.slug}/` : `https://${r.tenant.slug}.${ROOT_DOMAIN}/`;
    return json({ ok: true, slug: r.tenant.slug, site, admin: site + 'admin' });
  }
  return json({ error: 'not found' }, 404);
}
