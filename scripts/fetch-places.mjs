// Fetches real restaurants and cafés from OpenStreetMap for the sample hotels and the home page's towns,
// and writes public/data/places.json. Run by GitHub Actions (.github/workflows/places.yml) once a week:
// public Overpass servers refuse Cloudflare and are often too slow for a guest to wait for, so the list is kept with the site.
// Run by hand: node scripts/fetch-places.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('..', import.meta.url).pathname;
const ctx = { window: {}, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: { search: '' } };
vm.createContext(ctx);
vm.runInContext(readFileSync(root + 'public/site/hotels.js', 'utf8'), ctx);
vm.runInContext(readFileSync(root + 'public/js/osm.js', 'utf8'), ctx);
const { toPlaces } = ctx.V2OSM;
// town centres for the home page's "where to eat" (same list as EAT in public/site/platform.js)
const TOWNS = { 'ბაკურიანი': [41.7495, 43.5320], 'თბილისი': [41.6925, 44.8015], 'ბათუმი': [41.6475, 41.6370], 'თელავი': [41.9198, 45.4733],
  'სიღნაღი': [41.6200, 45.9220], 'გუდაური': [42.4770, 44.4780], 'ბორჯომი': [41.8390, 43.3890], 'ქუთაისი': [42.2705, 42.7040],
  'მესტია': [43.0450, 42.7300], 'სტეფანწმინდა (ყაზბეგი)': [42.6570, 44.6430] };
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ask(lat, lng, radius) {
  const q = `[out:json][timeout:90];(nwr(around:${radius},${lat},${lng})[amenity~"^(restaurant|cafe|bar|pub|fast_food)$"][name];nwr(around:${radius},${lat},${lng})[shop~"^(bakery|pastry)$"][name];);out center tags;`;
  for (let round = 0; round < 4; round++) for (const s of SERVERS) {
    try {
      const r = await fetch(s, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Visit2.ge (visit2ge@gmail.com)' }, signal: AbortSignal.timeout(120000) });
      if (r.ok) return toPlaces((await r.json()).elements || [], lat, lng, radius);
      console.log('  ', new URL(s).hostname, r.status);
    } catch (e) { console.log('  ', new URL(s).hostname, e.message); }
    await sleep(10000);
  }
  return null;
}
async function places(lat, lng) {
  const near = await ask(lat, lng, 1500);
  if (!near || near.length >= 5) return near;
  await sleep(3000);
  const wide = await ask(lat, lng, 6000);
  return wide && wide.length > near.length ? wide : near;
}

// keep what we had for any place that gets no answer this time
const file = root + 'public/data/places.json';
const old = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { hotels: {}, towns: {} };
const out = { at: new Date().toISOString(), hotels: {}, towns: {} };
for (const h of ctx.window.V2DEMO.list().filter(h => !h.hidden && h.lat != null)) {
  const p = await places(h.lat, h.lng); out.hotels[h.slug] = p || old.hotels?.[h.slug] || [];
  console.log(h.slug, p ? p.length : 'no answer, kept old'); await sleep(3000);
}
for (const [c, [lat, lng]] of Object.entries(TOWNS)) {
  const p = await places(lat, lng); out.towns[c] = p ? p.slice(0, 12) : old.towns?.[c] || [];
  console.log(c, p ? p.length : 'no answer, kept old'); await sleep(3000);
}
writeFileSync(file, JSON.stringify(out));
