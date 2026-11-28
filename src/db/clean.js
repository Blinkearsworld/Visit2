// What a hotel may save as its site content, checked on the server before it is stored.
// The admin builds this JSON; anything else (unknown keys, odd links, very long texts) is dropped here,
// so a hotel's page never carries script links or junk, whatever is sent to the API.
const LANGS = ['ka', 'en', 'ru'];
const THEMES = ['opal', 'amber', 'cobalt', 'alba', 'jade', 'lapis'];
const OLD_THEME = { onyx: 'opal', indigo: 'cobalt', ivory: 'amber', lilac: 'jade', umber: 'alba' }; // earlier templates, retired
const AMEN = ['wifi', 'parking', 'breakfast', 'kitchen', 'fireplace', 'pool', 'garden', 'bbq', 'balcony', 'kids', 'pets', 'ski', 'sea', 'center', 'transfer'];
const KINDS = ['restaurant', 'georgian', 'cafe', 'bakery', 'wine', 'bar', 'fish', 'grill', 'pizza', 'fast'];

const str = (v, max = 400) => (typeof v === 'string' ? v.slice(0, max) : '');
const tri = (v, max = 2000) => {
  if (typeof v === 'string') return { ka: str(v, max) };
  if (!v || typeof v !== 'object') return undefined;
  const o = {}; for (const l of LANGS) if (typeof v[l] === 'string') o[l] = v[l].slice(0, max);
  return Object.keys(o).length ? o : undefined;
};
// photos: our own uploads (media/…), the template images (img/…), or https
const img = v => (typeof v === 'string' && (/^media\/[\w.-]{1,60}$/.test(v) || /^(img|files)\/[\w./-]{1,120}\.(jpe?g|webp|png)$/.test(v) && !v.includes('..') || /^https:\/\/[^\s"'<>]{1,300}$/.test(v)) ? v : undefined);
// a video: a file kept with the site (files/…mp4) or a YouTube link
const video = v => (typeof v === 'string' && ((/^files\/[\w./-]{1,120}\.mp4$/.test(v) && !v.includes('..')) || /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s"'<>]{1,200}$/.test(v)) ? v : undefined);
const url = v => (typeof v === 'string' && /^https?:\/\/[^\s"'<>]{1,300}$/.test(v) ? v : undefined);
const gmap = v => (typeof v === 'string' && /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.)[^\s"'<>]{0,300}$/.test(v) ? v : undefined);
const num = (v, lo, hi) => (Number.isFinite(+v) && +v >= lo && +v <= hi ? +v : undefined);
const prune = o => { for (const k of Object.keys(o)) if (o[k] === undefined || (typeof o[k] === 'object' && o[k] !== null && !Array.isArray(o[k]) && !Object.keys(o[k]).length)) delete o[k]; return o; };
const list = (v, max, f) => (Array.isArray(v) ? v.slice(0, max).map(f).filter(x => x !== undefined) : undefined);

// the Lapis template: texts and photos may differ by season (winter / summer)
const sv = (v, max) => (v && typeof v === 'object' && ('w' in v || 's' in v) ? prune({ w: tri(v.w, max), s: tri(v.s, max) }) : tri(v, max));
const sim = v => (v && typeof v === 'object' ? prune({ w: img(v.w), s: img(v.s) }) : img(v));
const season = v => (v === 'w' || v === 's' ? v : undefined);
const href = v => (typeof v === 'string' && (/^\/[\w-]{1,60}$/.test(v) || url(v)) ? v : undefined);
function cleanLapis(l) {
  if (!l || typeof l !== 'object') return undefined;
  const obj = (v, f) => (v && typeof v === 'object' ? prune(f(v)) : undefined);
  return prune({
    kick: tri(l.kick, 120), heroImg: sim(l.heroImg), heroBtn: tri(l.heroBtn, 60), aboutImg: sim(l.aboutImg),
    facts: list(l.facts, 4, x => obj(x, y => ({ n: tri(y.n, 20), t: tri(y.t, 40) }))),
    stories: list(l.stories, 6, x => obj(x, y => ({ id: /^[\w-]{1,20}$/.test(y.id || '') ? y.id : undefined, season: season(y.season), h: tri(y.h, 120), p: tri(y.p, 800), chips: list(y.chips, 8, c => tri(c, 60)), btn: tri(y.btn, 60), note: tri(y.note, 200), img: img(y.img), video: video(y.video), len: str(y.len, 8) || undefined, off: y.off === true || undefined }))),
    fire: obj(l.fire, y => ({ h: sv(y.h, 120), p: tri(y.p, 800), chips: list(y.chips, 8, c => tri(c, 60)), img: sim(y.img), off: y.off === true || undefined })),
    strip: list(l.strip, 30, x => obj(x, y => ({ img: img(y.img), cap: tri(y.cap, 80), season: season(y.season) }))),
    spaces: obj(l.spaces, y => ({ h: tri(y.h, 120), p: tri(y.p, 600), items: list(y.items, 8, x => obj(x, z => ({ img: img(z.img), h: tri(z.h, 80), p: tri(z.p, 200) }))), off: y.off === true || undefined })),
    grounds: obj(l.grounds, y => ({ img: sim(y.img), h: tri(y.h, 120), p: sv(y.p, 800), list: obj(y.list, z => ({ w: list(z.w, 10, c => tri(c, 140)), s: list(z.s, 10, c => tri(c, 140)) })),
      photos: list(y.photos, 8, x => obj(x, z => ({ img: sim(z.img), cap: sv(z.cap, 80) }))), off: y.off === true || undefined })),
    near: obj(l.near, y => ({ h: tri(y.h, 120), p: tri(y.p, 600), note: tri(y.note, 300), items: list(y.items, 12, x => obj(x, z => ({ h: tri(z.h, 80), p: sv(z.p, 200), d: tri(z.d, 20) }))), off: y.off === true || undefined })),
    guides: list(l.guides, 6, x => obj(x, y => ({ href: href(y.href), t: tri(y.t, 60) }))),
    rooms: obj(l.rooms, y => ({ h: tri(y.h, 120), p: tri(y.p, 400) })),
    book: obj(l.book, y => ({ h: tri(y.h, 160), note: tri(y.note, 300) })),
  });
}

function cleanSite(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return undefined;
  const o = {};
  const th = OLD_THEME[s.theme] || s.theme;
  if (THEMES.includes(th)) o.theme = th;
  if (typeof s.accent === 'string' && /^#[0-9a-f]{6}$/i.test(s.accent)) o.accent = s.accent;
  if (s.font === 'serif') o.font = 'serif';
  // up to two kinds of stay (kind = the first, kept for older readers)
  const KS = ['mountain', 'sea', 'history', 'wine', 'food', 'nature', 'city'];
  const ks = [...new Set([...(Array.isArray(s.kinds) ? s.kinds : []), s.kind].filter(k => KS.includes(k)))].slice(0, 2);
  if (ks.length) { o.kinds = ks; o.kind = ks[0]; }
  if (s.hero) o.hero = prune({ img: img(s.hero.img), tagline: tri(s.hero.tagline, 200) });
  if (s.about) o.about = prune({ img: img(s.about.img), text: tri(s.about.text, 3000) });
  if (s.location) o.location = prune({ text: tri(s.location.text, 500), map: url(s.location.map) });
  if (s.gallery) o.gallery = list(s.gallery, 40, img);
  if (s.amenities) o.amenities = list(s.amenities, 20, a => (AMEN.includes(a) ? a : undefined));
  if (s.rooms && typeof s.rooms === 'object') {
    o.rooms = {};
    for (const k of Object.keys(s.rooms).slice(0, 30)) {
      if (!/^[\w-]{1,40}$/.test(k)) continue;
      const r = s.rooms[k] || {};
      o.rooms[k] = prune({ text: tri(r.text, 1500), photos: list(r.photos, 20, img), feats: list(r.feats, 12, x => tri(x, 120)) });
    }
    prune(o.rooms);
  }
  // instant booking: on/off, the hotel's own rules the guest agrees to before booking
  if (s.instant && typeof s.instant === 'object') {
    const py = s.instant.pay && typeof s.instant.pay === 'object' && s.instant.pay.on === true
      ? { on: true, part: s.instant.pay.part === 'deposit' ? 'deposit' : 'full', pct: s.instant.pay.part === 'deposit' ? num(s.instant.pay.pct, 10, 100) || 30 : undefined } : undefined;
    o.instant = prune({ on: s.instant.on === true ? true : undefined, cancel: tri(s.instant.cancel, 500), prepay: tri(s.instant.prepay, 500), pay: py ? prune(py) : undefined });
  }
  if (s.lapis) o.lapis = cleanLapis(s.lapis);
  if (s.kids && ['free', 'fixed'].includes(s.kids.mode)) o.kids = prune({ mode: s.kids.mode, price: s.kids.mode === 'fixed' ? num(s.kids.price, 0, 10000) : undefined });
  if (s.pin) { const lat = num(s.pin.lat, -90, 90), lng = num(s.pin.lng, -180, 180); if (lat != null && lng != null) o.pin = { lat, lng }; }
  if (s.food && typeof s.food === 'object') {
    const f = s.food;
    o.food = prune({
      hide: list(f.hide, 200, x => (typeof x === 'string' && /^[nwr]\d{1,15}$/.test(x) ? x : undefined)),
      own: list(f.own, 20, x => (x && typeof x === 'object' ? prune({ name: tri(x.name, 80), kind: KINDS.includes(x.kind) ? x.kind : 'restaurant', note: tri(x.note, 300), map: gmap(x.map), web: url(x.web), phone: str(x.phone, 30).replace(/[^\d+ ()-]/g, '') || undefined }) : undefined)),
      places: list(f.places, 60, x => (x && typeof x === 'object' && /^[nwr]\d{1,15}$/.test(x.id) ? prune({
        id: x.id, name: prune({ def: str(x.name?.def, 120), ka: str(x.name?.ka, 120) || undefined, en: str(x.name?.en, 120) || undefined, ru: str(x.name?.ru, 120) || undefined }),
        kind: KINDS.includes(x.kind) ? x.kind : 'restaurant', lat: num(x.lat, -90, 90), lng: num(x.lng, -180, 180), m: num(x.m, 0, 100000),
        cuisine: str(x.cuisine, 40) || undefined, phone: str(x.phone, 30) || undefined, web: url(x.web), hours: str(x.hours, 120) || undefined }) : undefined)),
      at: typeof f.at === 'string' && /^-?\d{1,3}\.\d{1,6},-?\d{1,3}\.\d{1,6}$/.test(f.at) ? f.at : undefined,
    });
  }
  return prune(o);
}

function cleanContact(c) {
  if (!c || typeof c !== 'object') return undefined;
  const o = {};
  for (const k of ['phone', 'wa']) if (typeof c[k] === 'string') o[k] = c[k].slice(0, 30).replace(/[^\d+ ()-]/g, '');
  for (const k of ['fb', 'ig', 'tk', 'map']) if (typeof c[k] === 'string') o[k] = c[k] === '' ? '' : url(c[k]);
  if (typeof c.email === 'string') o.email = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,120}$/.test(c.email) || c.email === '' ? c.email : undefined;
  for (const k of ['from', 'to']) if (typeof c[k] === 'string' && /^\d{2}:\d{2}$/.test(c[k])) o[k] = c[k];
  if (c.addr) o.addr = tri(c.addr, 200);
  return prune(o);
}

// → the content as it will be stored: site, contact and FAQ only
export function cleanContent(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return {};
  return prune({
    site: cleanSite(c.site),
    contact: cleanContact(c.contact),
    faq: list(c.faq, 30, x => (x && typeof x === 'object' ? prune({ q: tri(x.q, 200), a: tri(x.a, 1500) }) : undefined)),
  });
}
