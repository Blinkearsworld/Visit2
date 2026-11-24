// Places to eat near a hotel, from OpenStreetMap (Overpass API). Public data, no keys, no cookies.
// GET /api/places?lat=41.75&lng=43.52 → { places: [{ id, name, kind, lat, lng, m, cuisine, phone, web, hours }] }
// Answers are kept in Cloudflare's cache for a week per ~100 m square, so Overpass is asked rarely.
// Nothing about the guest is sent: only the rounded coordinates of the hotel.
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const RADIUS = 1500; // metres
const MAX = 40;
const WEEK = 7 * 86400;

export async function placesApi(request, env, ctx) {
  const url = new URL(request.url);
  const lat = round(url.searchParams.get('lat')), lng = round(url.searchParams.get('lng'));
  // Georgia only: our hotels are there, and it keeps strangers from using this as a free map service
  if (lat == null || lng == null || lat < 41 || lat > 43.7 || lng < 39.8 || lng > 46.9) return json({ error: 'lat and lng in Georgia are needed' }, 400);
  const key = new Request(`https://places.visit2.ge/v1/${lat}/${lng}`);
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const hit = cache && await cache.match(key);
  if (hit) return hit;
  let places;
  try {
    const q = `[out:json][timeout:20];(nwr(around:${RADIUS},${lat},${lng})[amenity~"^(restaurant|cafe|bar|pub|fast_food)$"][name];nwr(around:${RADIUS},${lat},${lng})[shop~"^(bakery|pastry)$"][name];);out center tags ${MAX * 3};`;
    const r = await fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Visit2.ge (visit2ge@gmail.com)' } });
    if (!r.ok) throw new Error('overpass ' + r.status);
    places = toPlaces((await r.json()).elements || [], lat, lng);
  } catch (e) {
    return json({ error: 'places unavailable', places: [] }, 503, 'no-store');
  }
  const res = json({ places }, 200, `public, max-age=${WEEK}`);
  if (cache) ctx?.waitUntil ? ctx.waitUntil(cache.put(key, res.clone())) : await cache.put(key, res.clone());
  return res;
}

// OSM elements → the short list the site shows, nearest first
export function toPlaces(elements, lat, lng) {
  const seen = new Set();
  return elements.map(e => {
    const t = e.tags || {}, p = e.center || e;
    if (p.lat == null || !t.name) return null;
    const m = Math.round(distance(lat, lng, p.lat, p.lon));
    return {
      id: e.type[0] + e.id,
      name: { def: t.name, ka: t['name:ka'] || '', en: t['name:en'] || '', ru: t['name:ru'] || '' },
      kind: kindOf(t), lat: +p.lat.toFixed(6), lng: +p.lon.toFixed(6), m,
      cuisine: String(t.cuisine || '').split(';')[0].trim(),
      phone: t.phone || t['contact:phone'] || '', web: safeUrl(t.website || t['contact:website'] || ''), hours: t.opening_hours || '',
    };
  }).filter(p => p && p.m <= RADIUS && !seen.has(p.name.def + p.kind) && seen.add(p.name.def + p.kind))
    .sort((a, b) => a.m - b.m).slice(0, MAX);
}

export function kindOf(t) {
  if (t.shop) return 'bakery';
  const c = String(t.cuisine || '').toLowerCase();
  if (t.amenity === 'cafe') return 'cafe';
  if (t.amenity === 'bar' || t.amenity === 'pub') return /wine/.test(c) || /wine/i.test(t.name) ? 'wine' : 'bar';
  if (t.amenity === 'fast_food') return /pizza/.test(c) ? 'pizza' : 'fast';
  if (/georgian|khachapuri|khinkali/.test(c)) return 'georgian';
  if (/pizza/.test(c)) return 'pizza';
  if (/fish|seafood/.test(c)) return 'fish';
  if (/barbecue|grill|kebab|shashlik|steak/.test(c)) return 'grill';
  return 'restaurant';
}

const round = v => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null; };
const safeUrl = u => (/^https?:\/\//i.test(u) ? u.slice(0, 300) : '');
function distance(a1, o1, a2, o2) {
  const R = 6371000, r = Math.PI / 180, da = (a2 - a1) * r, dO = (o2 - o1) * r;
  const h = Math.sin(da / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const json = (o, status = 200, cc = 'no-store') => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cc } });

// Address or town → coordinates, for the owner's map in the admin (OpenStreetMap Nominatim, Georgia only).
// GET /api/geocode?q=ბაკურიანი → { found: [{ name, lat, lng }] }
export async function geocodeApi(request, env, ctx) {
  const q = String(new URL(request.url).searchParams.get('q') || '').trim().slice(0, 120);
  if (q.length < 2) return json({ found: [] });
  const key = new Request('https://places.visit2.ge/geo/v1/' + encodeURIComponent(q.toLowerCase()));
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const hit = cache && await cache.match(key);
  if (hit) return hit;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ge&limit=5&accept-language=ka,en&q=${encodeURIComponent(q)}`,
      { headers: { 'user-agent': 'Visit2.ge (visit2ge@gmail.com)' } });
    if (!r.ok) throw new Error('nominatim ' + r.status);
    const found = (await r.json()).map(x => ({ name: String(x.display_name || '').split(',').slice(0, 3).join(','), lat: +(+x.lat).toFixed(6), lng: +(+x.lon).toFixed(6) }));
    const res = json({ found }, 200, 'public, max-age=2592000');
    if (cache) ctx?.waitUntil ? ctx.waitUntil(cache.put(key, res.clone())) : await cache.put(key, res.clone());
    return res;
  } catch (e) { return json({ found: [], error: 'unavailable' }, 503); }
}
