// Real restaurants and cafés from OpenStreetMap for the sample hotels and the home page's towns → public/data/places.json.
// Run by GitHub Actions (.github/workflows/places.yml) once a week. It does not ask Overpass (public Overpass servers are
// often overloaded: the first run waited 90 minutes for nothing). It reads the whole of Georgia from Geofabrik's daily
// OpenStreetMap file, filtered by osmium to places to eat (one line of GeoJSON each), and measures distances itself.
// Run by hand: node scripts/fetch-places.mjs /tmp/food.geojsonseq
import { readFileSync, writeFileSync } from 'node:fs';
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
const src = process.argv[2];
if (!src) { console.error('usage: node scripts/fetch-places.mjs food.geojsonseq'); process.exit(1); }
// GeoJSON features → elements shaped like Overpass's, with a centre point for buildings and areas
const elements = readFileSync(src, 'utf8').split('\n').map(l => l.replace(/^\x1e/, '').trim()).filter(Boolean).map(l => {
  const f = JSON.parse(l), g = f.geometry || {}, id = String(f.id || '');
  const pts = []; (function walk(c) { if (typeof c[0] === 'number') pts.push(c); else c.forEach(walk); })(g.coordinates || []);
  if (!pts.length) return null;
  const lon = pts.reduce((a, p) => a + p[0], 0) / pts.length, lat = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const type = { n: 'node', w: 'way', r: 'relation', a: 'way' }[id[0]] || 'node';
  return { type, id: id.slice(1) || Math.round(lat * 1e6), lat, lon, tags: f.properties || {} };
}).filter(Boolean);
console.log(elements.length, 'places to eat in Georgia');

function places(lat, lng) {
  const near = toPlaces(elements, lat, lng, 1500);
  if (near.length >= 5) return near;
  const wide = toPlaces(elements, lat, lng, 6000);
  return wide.length > near.length ? wide : near;
}
const out = { at: new Date().toISOString(), hotels: {}, towns: {} };
for (const h of ctx.window.V2DEMO.list().filter(h => !h.hidden && h.lat != null)) { out.hotels[h.slug] = places(h.lat, h.lng); console.log(h.slug, out.hotels[h.slug].length); }
for (const [c, [lat, lng]] of Object.entries(TOWNS)) { out.towns[c] = places(lat, lng).slice(0, 12); console.log(c, out.towns[c].length); }
writeFileSync(root + 'public/data/places.json', JSON.stringify(out));
