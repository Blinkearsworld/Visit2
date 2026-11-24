// Self sign-up: an owner creates their hotel from the partners' page.
// Creates the hotel (tenant), its owner account, sample rooms and prices, and the chosen template — in that order,
// so a failure part-way leaves at most an empty hotel that nobody can sign in to.
import { createTenant, validSlug } from './tenants.js';
import { addMember, normEmail, validEmail, pwProblem } from './users.js';
import { seedSample, DEFAULT_SETTINGS } from './hotel.js';
import { saveContent } from './content.js';

export const TEMPLATES = ['opal', 'amber', 'cobalt', 'alba', 'jade'];

// Georgian and Russian letters to latin, for the hotel's address (slug.visit2.ge)
const KA = { ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't', ი: 'i', კ: 'k', ლ: 'l', მ: 'm', ნ: 'n', ო: 'o', პ: 'p', ჟ: 'zh', რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'p', ქ: 'k', ღ: 'gh', ყ: 'k', შ: 'sh', ჩ: 'ch', ც: 'ts', ძ: 'dz', წ: 'ts', ჭ: 'ch', ხ: 'kh', ჯ: 'j', ჰ: 'h' };
const RU = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
export function slugify(name) {
  const s = [...String(name || '').toLowerCase()].map(c => KA[c] ?? RU[c] ?? c).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '');
  return s.length >= 3 ? s : `hotel-${s || 'x'}`.slice(0, 32);
}

async function freeSlug(db, base) {
  for (let i = 0; i < 50; i++) {
    const s = i ? `${base.slice(0, 36)}-${i + 1}` : base;
    if (!validSlug(s)) continue;
    const r = await db.prepare('SELECT 1 FROM tenants WHERE slug = ?').bind(s).first();
    if (!r) return s;
  }
  return `${base.slice(0, 30)}-${crypto.randomUUID().slice(0, 6)}`;
}

// returns { ok, tenant } or { ok: false, msg } with a message the owner can act on
export async function signUp(db, { name, city, email, password, ownerName, theme, agree }) {
  name = String(name || '').trim(); city = String(city || '').trim(); email = normEmail(email);
  if (name.length < 2 || name.length > 60) return { ok: false, field: 'name', msg: 'სასტუმროს სახელი 2–60 ასო უნდა იყოს.' };
  if (city.length < 2 || city.length > 40) return { ok: false, field: 'city', msg: 'ჩაწერე ქალაქი ან სოფელი.' };
  if (!validEmail(email)) return { ok: false, field: 'email', msg: 'ჩაწერე ელფოსტა, მაგალითად name@gmail.com.' };
  const pw = pwProblem(password); if (pw) return { ok: false, field: 'password', msg: pw };
  if (agree !== true) return { ok: false, field: 'agree', msg: 'მონიშნე, რომ ეთანხმები პირობებს.' };
  // an address that already has an account signs in instead: nobody can attach a hotel to someone else's email
  if (await db.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first())
    return { ok: false, field: 'email', msg: 'ამ ელფოსტით ანგარიში უკვე არსებობს. შედი ადმინში, ან მოგვწერე და ახალ სასტუმროს დაგიმატებთ.' };

  const t = await createTenant(db, { slug: await freeSlug(db, slugify(name)), name, city });
  await addMember(db, t, { email, name: String(ownerName || '').trim() || 'მფლობელი', password, role: 'owner' });
  await seedSample(db, t);
  await db.batch(Object.entries(DEFAULT_SETTINGS).map(([k, v]) =>
    db.prepare('INSERT INTO settings (tenant_id, k, v) VALUES (?, ?, ?) ON CONFLICT (tenant_id, k) DO NOTHING').bind(t.id, k, v)));
  await saveContent(db, t, { site: { theme: TEMPLATES.includes(theme) ? theme : 'opal' } }, 'რეგისტრაცია');
  return { ok: true, tenant: t };
}

// at most a few new hotels from one address in 15 minutes (sign-in failures share the table and its clean-up)
const HOUR = 15 * 60e3, MAX_PER_HOUR = 5;
export async function signUpsFrom(db, ip) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM login_fails WHERE ip = ? AND at > ?").bind('signup:' + ip, Date.now() - HOUR).first();
  return r?.n || 0;
}
export const noteSignUp = (db, ip) => db.prepare('INSERT INTO login_fails (ip, at) VALUES (?, ?)').bind('signup:' + ip, Date.now()).run();
export const SIGNUP_LIMIT = MAX_PER_HOUR;
