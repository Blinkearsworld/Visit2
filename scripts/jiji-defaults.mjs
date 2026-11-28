// One-off: builds src/data/jiji.js, Villa JIJI's site as Visit2 content (template Lapis), from its own repository.
// Run: node scripts/jiji-defaults.mjs <villa repo> <page.json from the extractor>
// Texts get English and Russian from Villa JIJI's dictionary (js/i18n.js); photos point to public/files/jiji/.
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
const [repo, pageJson] = process.argv.slice(2);
const ctx = { window: {}, document: { documentElement: { lang: 'ka', hasAttribute: () => false, setAttribute() {}, getAttribute: () => null }, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} }, location: { search: '', hostname: 'x', protocol: 'https:', port: '' }, navigator: { language: 'ka' }, URLSearchParams, console };
vm.createContext(ctx); vm.runInContext(readFileSync(repo + '/js/i18n.js', 'utf8'), ctx);
const I = ctx.window.I18N;
const T = ka => { ka = String(ka || '').trim(); return ka ? { ka, en: I.tr(ka, 'en') || '', ru: I.tr(ka, 'ru') || '' } : undefined; };
const P = JSON.parse(readFileSync(pageJson, 'utf8'));
const F = p => (p ? 'files/jiji/' + p.replace(/^\//, '') : undefined);
const txt = k => T(P[k]?.ka);
const sv = k => { const v = P[k]; if (!v) return undefined; return v.w || v.s ? { w: T(v.w || v.ka), s: T(v.s || v.ka) } : T(v.ka); };
const im = k => { const v = P[k]; if (!v) return undefined; return v.w || v.s ? { w: F(v.w?.src || v.src), s: F(v.s?.src || v.src) } : F(v.src); };
const alt = k => { const v = P[k]; return v ? (v.w || v.s ? { w: T(v.w?.alt || v.alt), s: T(v.s?.alt || v.alt) } : T(v.alt)) : undefined; };
const list = k => (P[k]?.list || []).map(T);

// rooms: texts, features and photos from js/content.js defaults
const cs = readFileSync(repo + '/js/content.js', 'utf8');
const obj = name => vm.runInNewContext('(' + cs.match(new RegExp(name + ': (\\{[\\s\\S]*?\\}),\\n'))[1] + ')');
const roomPhotos = obj('roomPhotos'), roomFeats = obj('roomFeats'), roomText = vm.runInNewContext('(' + cs.match(/roomText: (\{[\s\S]*?\})\n/)[1] + ')');
const def = vm.runInNewContext('(' + cs.match(/const DEF = (\{[\s\S]*?\n  \});/)[1].replace(/roomPhotos[\s\S]*$/, '}') + ')');
const rooms = {};
for (const k of Object.keys(roomPhotos)) rooms[k] = { text: T(roomText[k]), feats: (roomFeats[k] || []).map(T), photos: roomPhotos[k].map(F) };

const lapis = {
  kick: T('საოჯახო სასტუმრო ბაკურიანში'),
  heroImg: im('hero.img'), heroAlt: alt('hero.img'), heroBtn: txt('hero.button'),
  aboutImg: im('about.img'),
  facts: [1, 2, 3].map(i => ({ n: T(P[`about.f${i}n`].ka), t: txt(`about.f${i}`) })),
  stories: [
    { id: 'newyear', season: 'w', h: txt('newyear.h2'), p: txt('newyear.p'), chips: list('newyear.list'), btn: txt('newyear.button'), note: txt('newyear.p2'), img: F('video/new-year-poster.jpg'), video: F('video/new-year.mp4'), len: '1:08' },
    { id: 'summer', season: 's', h: txt('summer.h2'), p: txt('summer.p'), chips: list('summer.list'), btn: txt('summer.button'), img: F('video/summer-poster.jpg'), video: F('video/summer.mp4'), len: '0:20' },
  ],
  fire: { h: sv('fire.h2'), p: txt('fire.p'), chips: list('fire.list'), img: im('fire.img') },
  strip: P['photos.gallery'].gallery.map(g => ({ img: F(g.src), cap: T(g.cap), season: g.season })),
  spaces: { h: txt('spaces.h2'), p: txt('spaces.p'), items: ['', '2', '3', '4'].map((n, i) => ({ img: im('spaces.img' + n), h: txt(['spaces.h3', 'spaces.h32', 'spaces.h33', 'spaces.h34'][i]), p: txt(['spaces.p2', 'spaces.p3', 'spaces.p4', 'spaces.p5'][i]) })) },
  grounds: { img: im('grounds.img'), h: txt('grounds.h2'), p: sv('grounds.p'), list: { w: list('grounds.list2'), s: list('grounds.list') },
    photos: ['2', '3', '4', '5', '6'].map((n, i) => ({ img: im('grounds.img' + n), cap: sv('grounds.figcaption' + (i ? i + 1 : '')) })) },
  near: { h: txt('near.h2'), p: txt('near.p'), note: txt('near.p8'),
    items: [['near.h3', 'near.p2', 'near.span'], ['near.h32', 'near.p3', 'near.span2'], ['near.h33', 'near.p4', 'near.span3'], ['near.h34', 'near.p5', 'near.span4'], ['near.h35', 'near.p6', 'near.span5'], ['near.h36', 'near.p7', 'near.span6']]
      .map(([h, p, d]) => ({ h: txt(h), p: sv(p), d: T(P[d].ka) })) },
  guides: [['/bakuriani-winter', '❄️ ზამთარი ბაკურიანში'], ['/bakuriani-summer', '☀️ ზაფხული ბაკურიანში'], ['/bakuriani-how-to-get', '🚗 როგორ მოვიდეთ']].map(([href, t]) => ({ href, t: T(t) })),
  rooms: { h: txt('rooms.h2'), p: txt('rooms.p') },
  book: { h: txt('book.h2'), note: txt('book.p') },
};
const content = {
  site: { theme: 'lapis', font: 'serif', accent: '#F3C27A', kinds: ['mountain'],
    hero: { img: F('img/winter/cover-portrait.jpg'), tagline: txt('hero.p') },
    about: { img: F('img/birch.jpg'), text: txt('about.p') },
    pin: { lat: 41.7318533, lng: 43.5301119 },
    amenities: ['wifi', 'parking', 'kitchen', 'fireplace', 'pool', 'garden', 'bbq', 'balcony', 'kids', 'pets', 'ski'],
    rooms, lapis },
  contact: { ...def.contact, addr: T(def.contact.addr) },
  faq: def.faq.map(([q, a]) => ({ q: T(q), a: T(a) })),
};
writeFileSync(new URL('../src/data/jiji.js', import.meta.url), `// Villa JIJI's site as Visit2 content (template Lapis), built by scripts/jiji-defaults.mjs from its repository.\n// The import (src/db/jiji.js) lays what the hotel changed in its old admin over this.\nexport default ${JSON.stringify(content, null, 1)};\n`);
const miss = []; JSON.stringify(content, (k, v) => { if (v && typeof v === 'object' && 'ka' in v && v.ka && (!v.en || !v.ru)) miss.push(v.ka.slice(0, 40)); return v; });
console.log('written; untranslated:', miss.length, miss.slice(0, 12));
