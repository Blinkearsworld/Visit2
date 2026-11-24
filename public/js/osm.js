/* OpenStreetMap helpers, run in the browser: places to eat near a point (Overpass API) and finding a town (Nominatim).
   Public Overpass servers refuse requests from cloud servers (Cloudflare gets 521/504), so the browser asks them itself.
   The owner's admin saves the list with the hotel's content (site.food.places), so guests of a real hotel read it from
   our server and never contact Overpass; only sample hotels and hotels without a saved list ask from the guest's browser. */
(() => {
  const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  const RADIUS = 1500, MAX = 40; // metres, places

  function kindOf(t) {
    if (t.shop) return 'bakery';
    const c = String(t.cuisine || '').toLowerCase();
    if (t.amenity === 'cafe') return 'cafe';
    if (t.amenity === 'bar' || t.amenity === 'pub') return /wine/.test(c) || /wine|ღვინ/i.test(t.name || '') ? 'wine' : 'bar';
    if (t.amenity === 'fast_food') return /pizza/.test(c) ? 'pizza' : 'fast';
    if (/georgian|khachapuri|khinkali/.test(c)) return 'georgian';
    if (/pizza/.test(c)) return 'pizza';
    if (/fish|seafood/.test(c)) return 'fish';
    if (/barbecue|grill|kebab|shashlik|steak/.test(c)) return 'grill';
    return 'restaurant';
  }
  function metres(a1, o1, a2, o2) {
    const r = Math.PI / 180, da = (a2 - a1) * r, dO = (o2 - o1) * r;
    return Math.round(12742000 * Math.asin(Math.sqrt(Math.sin(da / 2) ** 2 + Math.cos(a1 * r) * Math.cos(a2 * r) * Math.sin(dO / 2) ** 2)));
  }
  const safeUrl = u => (/^https?:\/\//i.test(u) ? u.slice(0, 300) : '');
  // OSM elements → the short list the site shows, nearest first, without duplicates
  function toPlaces(elements, lat, lng) {
    const seen = new Set();
    return elements.map(e => {
      const t = e.tags || {}, p = e.center || e;
      if (p.lat == null || !t.name) return null;
      return {
        id: e.type[0] + e.id,
        name: { def: t.name, ka: t['name:ka'] || '', en: t['name:en'] || '', ru: t['name:ru'] || '' },
        kind: kindOf(t), lat: +(+p.lat).toFixed(6), lng: +(+p.lon).toFixed(6), m: metres(lat, lng, p.lat, p.lon),
        cuisine: String(t.cuisine || '').split(';')[0].trim(),
        phone: t.phone || t['contact:phone'] || '', web: safeUrl(t.website || t['contact:website'] || ''), hours: t.opening_hours || '',
      };
    }).filter(p => p && p.m <= RADIUS && !seen.has(p.name.def + p.kind) && seen.add(p.name.def + p.kind))
      .sort((a, b) => a.m - b.m).slice(0, MAX);
  }
  async function places(lat, lng) {
    const q = `[out:json][timeout:20];(nwr(around:${RADIUS},${lat},${lng})[amenity~"^(restaurant|cafe|bar|pub|fast_food)$"][name];nwr(around:${RADIUS},${lat},${lng})[shop~"^(bakery|pastry)$"][name];);out center tags ${MAX * 3};`;
    for (const s of SERVERS) {
      try {
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 12000);
        const r = await fetch(s, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
        clearTimeout(tm);
        if (r.ok) return toPlaces((await r.json()).elements || [], lat, lng);
      } catch (e) { /* next server */ }
    }
    throw new Error('places unavailable');
  }
  // town or address in Georgia → [{ name, lat, lng }]
  async function geocode(q) {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ge&limit=5&accept-language=ka,en&q=${encodeURIComponent(q)}`);
    if (!r.ok) throw new Error('geocode ' + r.status);
    return (await r.json()).map(x => ({ name: String(x.display_name || '').split(',').slice(0, 3).join(','), lat: +(+x.lat).toFixed(6), lng: +(+x.lon).toFixed(6) }));
  }
  globalThis.V2OSM = { places, geocode, toPlaces, kindOf, metres };
})();
