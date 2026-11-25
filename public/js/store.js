/* Visit2 hotel site — shared data layer (ported from Villa JIJI).
   Seasons come from the hotel (state.seasons); the fixed Bakuriani rule below is only the demo fallback.
   On Cloudflare (when /api/state answers) data lives in the D1 database via functions/api/*.
   Anywhere else (GitHub Pages demo) it falls back to this browser's localStorage with sample data.
   The availability and price rules are duplicated in functions/_lib/core.js; keep them in step. */
window.JIJI = (() => {
  // browser-only demo: which demo hotel (?h=slug, see site/hotels.js); each keeps its own data in this browser
  const DEMO_H = (window.V2DEMO && window.V2DEMO.get(new URLSearchParams(location.search).get('h') || 'mta')) || null;
  const KEY = 'v2-demo-' + (DEMO_H ? DEMO_H.slug : 'v1');

  // Room types. Each type has price "versions" by number of guests, set by the hotel
  // (not proportional): the smallest version that fits the group is used.
  // Prices are SAMPLE values in GEL per night, by season.
  const R = (guests, off, summer, winter, peak) => ({ guests, price: { peak, winter, summer, off } });
  // Sample rooms for the browser-only demo (GitHub Pages). On the real site rooms and prices come from the server.
  const DEFAULT_TYPES = {
    std: { name: 'სტანდარტული ორადგილიანი', rates: [R(1, 90, 120, 150, 200), R(2, 110, 140, 180, 240)] },
    family: { name: 'საოჯახო, 1 საძინებლით (4+1)', rates: [R(2, 150, 200, 240, 320), R(3, 165, 220, 265, 350), R(4, 180, 240, 290, 380), R(5, 195, 260, 310, 410)] },
    suite: { name: 'ლუქსი, 2 საძინებლით', rates: [R(2, 210, 290, 370, 480), R(4, 280, 380, 460, 600), R(6, 340, 460, 550, 710)] },
  };
  if (DEMO_H && DEMO_H.types) Object.keys(DEFAULT_TYPES).forEach(k => { DEFAULT_TYPES[k] = DEMO_H.types[k] || DEFAULT_TYPES[k]; });
  const ROOMS = [{ id: '1', type: 'std' }, { id: '2', type: 'std' }, { id: '3', type: 'family' }, { id: '4', type: 'family' }, { id: '5', type: 'suite' }];
  const SEASONS = { peak: 'ახალი წელი', winter: 'ზამთარი', summer: 'ზაფხული', off: 'დანარჩენი' };

  // ---------- dates as 'YYYY-MM-DD', math in UTC ----------
  const toD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const toS = d => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return toS(d); };
  const nights = (a, b) => Math.round((toD(b) - toD(a)) / 864e5);
  // "today" is the hotel's date (Georgia, UTC+4), the same on every device and on the server
  const today = () => toS(new Date(Date.now() + 4 * 3600e3));
  // short month names; the public site may switch them to English or Russian (js/i18n.js)
  const MONTHS_BY = {
    ka: ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
  };
  const lng = () => (window.I18N && MONTHS_BY[window.I18N.lang]) ? window.I18N.lang : 'ka';
  const WD = ['კვ', 'ორ', 'სმ', 'ოთ', 'ხთ', 'პრ', 'შბ'];
  const fmt = s => { const d = toD(s); return d.getUTCDate() + ' ' + MONTHS_BY[lng()][d.getUTCMonth()]; };
  const fmtRange = (a, b) => fmt(a) + ' – ' + fmt(b);
  const weekday = s => WD[toD(s).getUTCDay()];

  // the hotel's own seasons (from the server): [{id, name, from: 'MM-DD', to: 'MM-DD'}], first match wins
  let seasonList = null, hotel = DEMO_H ? { name: DEMO_H.name, city: DEMO_H.city, slug: DEMO_H.slug, demo: true, mine: !!DEMO_H.mine, lat: DEMO_H.lat, lng: DEMO_H.lng } : { name: 'შენი სასტუმრო', city: 'ბაკურიანი', slug: 'demo', demo: true };
  const inRange = (md, a, b) => (a <= b ? md >= a && md <= b : md >= a || md <= b);
  const seasonOf = s => {
    if (seasonList && seasonList.length) { const md = s.slice(5); const f = seasonList.find(x => inRange(md, x.from, x.to)); return (f || seasonList[seasonList.length - 1]).id; }
    const d = toD(s), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    if ((m === 12 && day >= 25) || (m === 1 && day <= 7)) return 'peak';
    if (m === 12 || m <= 3) return 'winter';
    if (m >= 6 && m <= 8) return 'summer';
    return 'off';
  };

  // ---------- storage ----------
  let state, mode = 'demo', needPayments = false;
  // who is signed in to the admin (the demo is always the main admin) and who changed which booking
  let me = { id: 'owner', name: 'მფლობელი', owner: true, perms: ['book', 'money', 'price', 'site'] }, actlog = [];
  // Which season the site opens in. 'auto' follows the winter date range (MM-DD, may wrap the year).
  const DEFAULT_SETTINGS = { seasonMode: 'auto', winterFrom: '11-15', winterTo: '03-31', gapDiscount: '10' };
  // capacity of a type = its largest guest version
  function syncCap(k) {
    const t = state.types[k];
    t.rates = (t.rates || []).filter(r => r.guests > 0).sort((a, b) => a.guests - b.guests);
    t.cap = t.rates.length ? t.rates[t.rates.length - 1].guests : 0;
  }
  const uid = () => Math.random().toString(36).slice(2, 9);
  function seed() {
    const t = today();
    const b = (room, from, n, name, phone, guests, status, source) => ({
      id: uid(), room, type: ROOMS.find(r => r.id === room)?.type || 'family', from: addDays(t, from), to: addDays(t, from + n),
      name, phone, guests, status, source, created: new Date().toISOString()
    });
    const pending = (type, from, n, name, phone, guests, source) => ({
      id: uid(), room: null, type, from: addDays(t, from), to: addDays(t, from + n), name, phone, guests, status: 'pending', source, created: new Date().toISOString()
    });
    const types = JSON.parse(JSON.stringify(DEFAULT_TYPES));
    for (const k in types) types[k].cap = types[k].rates[types[k].rates.length - 1].guests;
    return {
      settings: { ...DEFAULT_SETTINGS },
      types,
      bookings: [
        b('5', 1, 3, 'ნინო ბ.', '+995 555 10 20 30', 2, 'confirmed', 'admin'),
        b('1', 2, 4, 'გიორგი მ.', '+995 555 22 33 44', 2, 'confirmed', 'site'),
        b('4', 0, 2, 'Anna K.', '+48 600 100 200', 3, 'confirmed', 'chat'),
        b('2', 5, 5, 'დავით ლ.', '+995 555 77 88 99', 2, 'confirmed', 'admin'),
        b('3', 6, 2, 'Irina S.', '+7 900 123 45 67', 2, 'confirmed', 'chat'),
        b('5', 8, 3, 'თამარ ჯ.', '+995 555 40 50 60', 4, 'confirmed', 'site'),
        pending('family', 3, 3, 'ლევან ქ.', '+995 555 12 12 12', 4, 'chat'),
        pending('std', 9, 2, 'Mark T.', '+44 7700 900123', 2, 'site')
      ],
      payments: [],
      guestNotes: {},
      guestBdays: {}
    };
  }
  function load() {
    try { state = JSON.parse(localStorage.getItem(KEY)); } catch (e) { state = null; }
    if (!state || !state.bookings) { state = seed(); needPayments = true; save(); return; }
    if (!Array.isArray(state.payments)) state.payments = [];
    if (!state.guestNotes) state.guestNotes = {};
    if (!state.guestBdays) state.guestBdays = {};
    for (const k in state.types) syncCap(k);
    state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
    // add room types introduced after this browser first saved its data
    let added = false;
    for (const k in state.types) if (!DEFAULT_TYPES[k]) { delete state.types[k]; added = true; }
    for (const k in DEFAULT_TYPES) if (!state.types[k]) { state.types[k] = JSON.parse(JSON.stringify(DEFAULT_TYPES[k])); syncCap(k); added = true; }
    if (added) save();
  }
  // a few sample payments so the money tab is not empty in the demo
  function demoPayments() {
    const c = state.bookings.filter(b => b.status === 'confirmed'), t = today();
    c.forEach(b => { b.price = quote(b.type, b.from, b.to, b.guests); });
    const pay = (b, part, method, ago) => b && state.payments.push({ id: uid(), booking: b.id, amount: Math.round(b.price * part), method, date: addDays(t, -ago), created: new Date().toISOString() });
    pay(c[0], 1, 'cash', 0); pay(c[1], .3, 'transfer', 3); pay(c[2], 1, 'card', 1); pay(c[3], .5, 'transfer', 6); pay(c[5], .2, 'card', 12);
  }
  function save() { if (mode === 'api') return; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable: demo keeps working in memory */ } }
  function reset() { state = seed(); demoPayments(); save(); }
  load();

  // ---------- availability ----------
  const overlaps = (a1, b1, a2, b2) => a1 < b2 && a2 < b1;
  const confirmed = () => state.bookings.filter(x => x.status === 'confirmed');
  const roomFree = (roomId, from, to, ignoreId) =>
    !confirmed().some(x => x.room === roomId && x.id !== ignoreId && overlaps(from, to, x.from, x.to));
  const freeRoomsOfType = (type, from, to) => ROOMS.filter(r => r.type === type && roomFree(r.id, from, to)).map(r => r.id);

  // the price version used for a group: the smallest one with enough places
  const rateFor = (type, guests) => (state.types[type]?.rates || []).find(r => r.guests >= (guests || 1)) || null;
  function quote(type, from, to, guests) {
    const r = rateFor(type, guests) || (state.types[type].rates || []).slice(-1)[0];
    if (!r) return 0;
    let sum = 0;
    for (let d = from; d < to; d = addDays(d, 1)) sum += r.price[seasonOf(d)];
    return sum;
  }
  // lowest nightly price of a version (any season), for "from" prices
  const fromPrice = r => Math.min(...Object.values(r.price));
  // Cheapest room type that fits the guests and has a free room for the whole stay.
  function findOffer(from, to, guests) {
    let best = null;
    for (const t of Object.keys(state.types)) {
      const r = rateFor(t, guests); if (!r) continue;
      const free = freeRoomsOfType(t, from, to); if (!free.length) continue;
      const total = quote(t, from, to, guests);
      if (!best || total < best.total) best = { type: t, name: state.types[t].name, total, free: free.length, rateGuests: r.guests };
    }
    return best;
  }
  // Several rooms at once (same as src/lib/availability.js roomsOffer): guests spread evenly, each part in the cheapest free room that holds it.
  function roomsOffer(from, to, guests, n) {
    const free = ROOMS.filter(r => roomFree(r.id, from, to));
    n = Math.max(1, Math.min(n, guests));
    if (free.length < n) return { free: free.length };
    const sizes = Array.from({ length: n }, (_, i) => Math.floor(guests / n) + (i < guests % n ? 1 : 0));
    const used = new Set(), parts = [];
    for (const g of sizes) {
      let best = null;
      for (const r of free) {
        if (used.has(r.id) || !rateFor(r.type, g)) continue;
        const total = quote(r.type, from, to, g);
        if (!best || total < best.total) best = { room: r.id, type: r.type, name: state.types[r.type].name, guests: g, total };
      }
      if (!best) return { free: free.length };
      used.add(best.room); parts.push(best);
    }
    return { total: parts.reduce((s, x) => s + x.total, 0), parts, free: free.length };
  }
  // A group too big for any single room: the cheapest pair of free rooms that holds everyone.
  const fitsOne = guests => Object.keys(state.types).some(t => rateFor(t, guests));
  function groupOffer(from, to, guests) {
    const free = ROOMS.filter(r => roomFree(r.id, from, to));
    let best = null;
    for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
      const A = free[i], B = free[j];
      for (let a = 1; a < guests; a++) {
        const b = guests - a;
        if (!rateFor(A.type, a) || !rateFor(B.type, b)) continue;
        const ta = quote(A.type, from, to, a), tb = quote(B.type, from, to, b);
        if (!best || ta + tb < best.total) best = { total: ta + tb, parts: [
          { from, to, type: A.type, guests: a, name: state.types[A.type].name, total: ta },
          { from, to, type: B.type, guests: b, name: state.types[B.type].name, total: tb }] };
      }
    }
    return best;
  }
  // Longest run of free nights inside the asked period (when the whole period is not free).
  function partialOffer(from, to, guests) {
    let best = null;
    for (const t of Object.keys(state.types)) {
      if (!rateFor(t, guests)) continue;
      for (const room of ROOMS.filter(r => r.type === t)) {
        let start = null;
        for (let d = from; ; d = addDays(d, 1)) {
          const free = d < to && roomFree(room.id, d, addDays(d, 1));
          if (free && start === null) start = d;
          if (!free && start !== null) {
            const n = nights(start, d), total = quote(t, start, d, guests);
            if (!best || n > best.n || (n === best.n && total < best.total)) best = { from: start, to: d, n, type: t, name: state.types[t].name, total };
            start = null;
          }
          if (d >= to) break;
        }
      }
    }
    return best && best.n < nights(from, to) ? best : null;
  }
  // The whole period with one change of room in the middle.
  // the whole stay with room changes: each part as long as possible, so as few moves as possible (at most 3)
  function splitOffer(from, to, guests, maxParts = 4) {
    const parts = []; let p = from, total = 0;
    while (p < to) {
      let best = null;
      for (let q = to; q > p; q = addDays(q, -1)) { const o = findOffer(p, q, guests); if (o) { best = { from: p, to: q, ...o }; break; } }
      if (!best || parts.length >= maxParts) return null;
      parts.push(best); total += best.total; p = best.to;
    }
    return parts.length > 1 ? { parts, total } : null;
  }
  // ---------- short gaps (1–3 free nights between bookings) ----------
  const GAP_MAX = 3;
  const roomBookings = roomId => confirmed().filter(x => x.room === roomId).sort((a, b) => a.from < b.from ? -1 : 1);
  // free runs of 1..GAP_MAX nights that sit between two bookings
  function gaps(horizon = 60) {
    const t = today(), end = addDays(t, horizon), out = [];
    for (const room of ROOMS) {
      // only nights that sit between a guest leaving and the next one arriving
      let prev = null;
      for (const b of roomBookings(room.id)) {
        if (b.to < t) continue;
        if (prev !== null && b.from > prev) {
          const from = prev > t ? prev : t, n = b.from > from ? nights(from, b.from) : 0;
          if (n >= 1 && n <= GAP_MAX && from <= end) out.push({ room: room.id, type: room.type, from, to: b.from, n });
        }
        if (prev === null || b.to > prev) prev = b.to;
      }
    }
    return out.sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : a.n - b.n);
  }
  const gapDiscount = () => Math.max(0, Math.min(50, parseInt(state.settings?.gapDiscount) || 0));
  // ---------- short offers: automatic gaps (with the hotel's edits) and the hotel's own promotions ----------
  const parseJ = (v, d) => { try { const x = JSON.parse(v); return x == null ? d : x; } catch (e) { return d; } };
  const gapKey = g => `${g.room}|${g.from}|${g.to}`;
  const gapEdits = () => parseJ(state.settings?.gapEdits, {});
  const promos = () => { const p = parseJ(state.settings?.promos, []); return Array.isArray(p) ? p : []; };
  function deals(horizon = 60) {
    const edits = gapEdits(), t = today(), def = gapDiscount();
    let out = [];
    for (const g of gaps(horizon)) {
      const e = edits[gapKey(g)] || {};
      if (e.hide) continue;
      out.push({ key: 'g:' + gapKey(g), kind: 'gap', room: g.room, type: g.type, from: g.from, to: g.to, n: g.n,
        price: +e.price > 0 ? Math.round(+e.price) : null, pct: +e.price > 0 ? 0 : (e.pct != null && e.pct !== '' ? Math.max(0, Math.min(90, +e.pct || 0)) : def) });
    }
    for (const p of promos()) {
      const room = ROOMS.find(r => r.id === p.room);
      if (!room || !p.from || !p.to || p.to <= p.from || p.from < t || !(+p.price > 0) || !roomFree(p.room, p.from, p.to)) continue;
      out = out.filter(x => !(x.room === p.room && x.from === p.from && x.to === p.to));
      out.push({ key: 'p:' + p.id, kind: 'promo', room: p.room, type: room.type, from: p.from, to: p.to, n: nights(p.from, p.to), price: Math.round(+p.price), pct: 0, label: String(p.label || '').slice(0, 60) });
    }
    return out.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.n - b.n));
  }
  const dealTotal = (d, guests) => (d.price ? d.price : Math.round(quote(d.type, d.from, d.to, guests) * (100 - (d.pct || 0)) / 100));
  const dealNote = d => (d.kind === 'promo' ? 'აქცია' + (d.label ? ' · ' + d.label : '') : d.price ? 'ფანჯარა · სპეც. ფასი' : d.pct ? `ფანჯარა −${d.pct}%` : 'ფანჯარა');
  function setJSON(k, v) { setSetting(k, JSON.stringify(v)); }

  // the room that leaves the fewest short gaps around a stay
  function bestRoom(type, from, to) {
    const pen = g => g === null ? 2 : g === 0 ? 0 : g <= GAP_MAX ? 10 : 3;
    let best = null, bestScore = Infinity;
    for (const room of ROOMS.filter(r => r.type === type && roomFree(r.id, from, to))) {
      const bs = roomBookings(room.id);
      const before = bs.filter(x => x.to <= from).pop(), after = bs.find(x => x.from >= to);
      const score = pen(before ? nights(before.to, from) : null) + pen(after ? nights(to, after.from) : null);
      if (score < bestScore) { best = room.id; bestScore = score; }
    }
    return best;
  }
  // Nearest start date within `days` days with the same length of stay.
  // the same stay a few days later; further than a week is not a useful suggestion
  function nextOffer(from, n, guests, days = 7) {
    for (let i = 1; i <= days; i++) {
      const f = addDays(from, i), o = findOffer(f, addDays(f, n), guests);
      if (o) return { from: f, to: addDays(f, n), ...o };
    }
    return null;
  }

  // ---------- actions ----------
  function createRequest({ from, to, guests, name, phone, source, type, price, note, wish, deal, children, rooms }) {
    rooms = Math.max(1, Math.min(10, guests, parseInt(rooms) || 1));
    if (rooms > 1) {
      // several rooms: one row per room, tied by grp (the server builds the same rows)
      const o = roomsOffer(from, to, guests, rooms);
      if (!o.parts) return { saved: Promise.resolve({ ok: false, free: o.free }) };
      const grp = uid(), created = new Date().toISOString(); let kids = Math.max(0, parseInt(children) || 0);
      const rows = o.parts.map(x => { const c = Math.min(kids, x.guests - 1); kids -= c;
        return { id: uid(), room: null, type: x.type, from, to, guests: x.guests, name, phone, status: 'pending', source, price: x.total, note: '', wish: String(wish || '').trim().slice(0, 500), remark: '', wantRoom: '', children: c, grp, created }; });
      state.bookings.push(...rows); save();
      const req = { id: grp, grp, rows };
      req.saved = mode === 'api'
        ? sendRequest({ from, to, guests, name, phone, source, rooms, wish: rows[0].wish, children }).then(out => {
            if (!out.ok) { state.bookings = state.bookings.filter(x => x.grp !== grp); save(); emit(); }
            return out;
          })
        : Promise.resolve({ ok: true });
      return req;
    }
    // a short offer (deal key): price, note and the offered room come from it (the server recomputes them)
    const D = deal ? deals().find(x => x.key === deal && x.from === from && x.to === to) : null;
    if (D) { type = D.type; price = dealTotal(D, guests); note = dealNote(D); }
    const offer = type ? { type } : findOffer(from, to, guests);
    const t = offer ? offer.type : (Object.keys(state.types).find(k => rateFor(k, guests)) || Object.keys(state.types)[0]);
    const req = { id: uid(), room: null, type: t, from, to, guests, name, phone, status: 'pending', source, price: price ?? null, note: note || '', wish: String(wish || '').trim().slice(0, 500), remark: '', wantRoom: D ? D.room : '', children: Math.max(0, Math.min(guests - 1, parseInt(children) || 0)), created: new Date().toISOString() };
    state.bookings.push(req); save();
    // on the real site the request counts as sent only when the server confirms it; otherwise it is taken back
    req.saved = mode === 'api'
      ? sendRequest({ from, to, guests, name, phone, source, type: t, deal: D ? D.key : undefined, wish: req.wish, children: req.children }).then(out => {
          if (!out.ok) { state.bookings = state.bookings.filter(x => x !== req); save(); emit(); }
          return out;
        })
      : Promise.resolve({ ok: true });
    return req;
  }
  // confirm a request; the admin may pick another room (also of another type) and set the price
  // ch: {from, to, guests} when the dates or guests were changed with the guest (e.g. by phone)
  function confirm(id, roomId, price, ch = {}) {
    const r = state.bookings.find(x => x.id === id); if (!r) return { ok: false, msg: 'ჯავშანი ვერ მოიძებნა' };
    const from = ch.from || r.from, to = ch.to || r.to, guests = Math.max(1, parseInt(ch.guests) || r.guests || 1);
    if (!(to > from)) return { ok: false, msg: 'გასვლის თარიღი შესვლის შემდეგ უნდა იყოს' };
    const room = roomId || bestRoom(r.type, from, to);
    if (!room || !roomFree(room, from, to, r.id)) return { ok: false, msg: roomId ? 'ნომერი ' + roomId + ' ამ თარიღებზე დაკავებულია' : 'ამ თარიღებზე ' + state.types[r.type].name + ' ნომერი თავისუფალი აღარ არის' };
    const type = (ROOMS.find(x => x.id === room) || {}).type || r.type;
    const p = price != null && price !== '' ? Math.max(0, Math.round(+price || 0)) : quote(type, from, to, guests);
    r.room = room; r.type = type; r.status = 'confirmed'; r.price = p; r.from = from; r.to = to; r.guests = guests; r.children = Math.max(0, Math.min(guests - 1, parseInt(ch.children ?? r.children) || 0));
    save(); post('api/admin/action', { op: 'confirm', id, room, price: p, from, to, guests, children: r.children }); return { ok: true, room };
  }
  // the staff's own note on this stay (the guest's request is kept apart, in wish, unchanged)
  function setRemark(id, text) {
    const r = state.bookings.find(x => x.id === id); if (!r) return;
    r.remark = String(text || '').trim().slice(0, 500); save(); post('api/admin/action', { op: 'remark', id, remark: r.remark });
  }
  // change the dates or guests of a confirmed booking (same room; the agreed price stays unless given)
  function editBooking(id, { from, to, guests, price, children }) {
    const r = state.bookings.find(x => x.id === id); if (!r) return { ok: false, msg: 'ჯავშანი ვერ მოიძებნა' };
    from = from || r.from; to = to || r.to; guests = Math.max(1, parseInt(guests) || r.guests || 1);
    if (!(to > from)) return { ok: false, msg: 'გასვლის თარიღი შესვლის შემდეგ უნდა იყოს' };
    if (!roomFree(r.room, from, to, r.id)) return { ok: false, msg: 'ნომერი ' + r.room + ' ამ თარიღებზე დაკავებულია. ჯერ შეცვალეთ ნომერი ან აირჩიეთ სხვა თარიღი.' };
    r.from = from; r.to = to; r.guests = guests; if (price != null && price !== '') r.price = Math.max(0, Math.round(+price || 0));
    r.children = Math.max(0, Math.min(guests - 1, parseInt(children ?? r.children) || 0));
    save(); post('api/admin/action', { op: 'edit', id, from, to, guests, price: r.price, children: r.children }); return { ok: true };
  }
  // move a confirmed booking to another free room; the agreed price stays
  function moveRoom(id, roomId) {
    const r = state.bookings.find(x => x.id === id); if (!r) return { ok: false, msg: 'ჯავშანი ვერ მოიძებნა' };
    if (r.room === roomId) return { ok: true, room: roomId };
    const nr = ROOMS.find(x => x.id === roomId); if (!nr) return { ok: false, msg: 'ასეთი ნომერი არ არის' };
    if (!roomFree(roomId, r.from, r.to, r.id)) return { ok: false, msg: 'ნომერი ' + roomId + ' ამ თარიღებზე დაკავებულია' };
    if (r.price == null) r.price = quote(r.type, r.from, r.to, r.guests);
    r.room = roomId; r.type = nr.type;
    save(); post('api/admin/action', { op: 'move', id, room: roomId }); return { ok: true, room: roomId };
  }
  function decline(id) { const r = state.bookings.find(x => x.id === id); if (r) { r.status = 'declined'; save(); post('api/admin/action', { op: 'decline', id }); } }
  function addManual({ room, from, to, name, phone, guests, price, children }) {
    if (!roomFree(room, from, to)) return { ok: false, msg: 'ნომერი ' + room + ' ამ თარიღებზე დაკავებულია' };
    const type = ROOMS.find(r => r.id === room).type;
    const p = price === '' || price == null ? quote(type, from, to, guests) : Math.max(0, Math.round(+price || 0));
    const kids = Math.max(0, Math.min(guests - 1, parseInt(children) || 0));
    state.bookings.push({ id: uid(), room, type, from, to, name, phone, guests, children: kids, price: p, status: 'confirmed', source: 'admin', created: new Date().toISOString() });
    save(); post('api/admin/action', { op: 'add', room, from, to, name, phone, guests, children: kids, price: p }); return { ok: true };
  }
  const pushRates = type => post('api/admin/action', { op: 'rates', type, rates: state.types[type].rates });
  function setRate(type, i, field, value) {
    const r = state.types[type].rates[i]; if (!r) return;
    const v = Math.max(0, Math.round(+value || 0));
    if (field === 'guests') r.guests = Math.max(1, v); else r.price[field] = v;
    syncCap(type); save(); pushRates(type);
  }
  function addRate(type) {
    const rs = state.types[type].rates, last = rs[rs.length - 1];
    rs.push(last ? { guests: last.guests + 1, price: { ...last.price } } : { guests: 2, price: { peak: 0, winter: 0, summer: 0, off: 0 } });
    syncCap(type); save(); pushRates(type);
  }
  function removeRate(type, i) { state.types[type].rates.splice(i, 1); syncCap(type); save(); pushRates(type); }
  function setSetting(k, v) { state.settings[k] = v; save(); post('api/admin/action', { op: 'setting', k, v }); }
  // price list for the chat (same as core.js priceTable)
  function priceTable(day) {
    day = day || today(); const out = [];
    for (let i = 0, prev = null; i < 60 && out.length < 2; i++) {
      const d = addDays(day, i), s = seasonOf(d);
      if (s !== prev) { out.push({ season: s, from: d, now: i === 0 }); prev = s; }
    }
    return out.map(x => ({ ...x, rows: Object.entries(state.types).map(([id, t]) => {
      const p = (t.rates || []).map(r => +r.price?.[x.season] || 0).filter(v => v > 0);
      return p.length ? { id, name: t.name, min: Math.min(...p), max: Math.max(...p) } : null;
    }).filter(Boolean).sort((a, b) => a.min - b.min) }));
  }
  function siteSeason(day) {
    const st = state.settings || DEFAULT_SETTINGS;
    if (st.seasonMode === 'winter' || st.seasonMode === 'summer') return st.seasonMode;
    const md = (day || today()).slice(5), a = st.winterFrom, b = st.winterTo;
    const inWinter = a <= b ? (md >= a && md <= b) : (md >= a || md <= b);
    return inWinter ? 'winter' : 'summer';
  }
  // deleting moves a booking to the deleted list; it can be restored or removed for good
  function remove(id) {
    const b = state.bookings.find(x => x.id === id); if (!b || b.status === 'deleted') return;
    b.prevStatus = b.status; b.status = 'deleted'; b.deletedAt = new Date().toISOString();
    save(); post('api/admin/action', { op: 'remove', id });
  }
  function restore(id) {
    const b = state.bookings.find(x => x.id === id); if (!b || b.status !== 'deleted') return { ok: false, msg: 'ჯავშანი ვერ მოიძებნა' };
    const back = b.prevStatus || 'pending';
    if (back === 'confirmed' && b.room && !roomFree(b.room, b.from, b.to, b.id)) return { ok: false, msg: 'ნომერი ' + b.room + ' ამ თარიღებზე უკვე დაკავებულია. აღდგენა შეუძლებელია.' };
    b.status = back; delete b.prevStatus; delete b.deletedAt;
    save(); post('api/admin/action', { op: 'restore', id }); return { ok: true, status: back };
  }
  // the main admin starts over (server checks the word and the owner)
  async function wipe(word) {
    const out = await post('api/admin/action', { op: 'wipe', confirm: word });
    return out || { ok: false };
  }
  function purge(id) {
    state.bookings = state.bookings.filter(x => x.id !== id); state.payments = state.payments.filter(x => x.booking !== id);
    save(); post('api/admin/action', { op: 'purge', id });
  }

  // ---------- money: agreed price, payments, what is left ----------
  const METHODS = { card: 'ბარათი', transfer: 'პირადზე ჩარიცხვა', cash: 'ქეში' };
  const priceOf = b => b.price ?? quote(b.type, b.from, b.to, b.guests);
  const paymentsOf = id => state.payments.filter(x => x.booking === id).sort((a, b) => a.date < b.date ? -1 : 1);
  const paidOf = id => paymentsOf(id).reduce((s, x) => s + x.amount, 0);
  function payState(b) {
    const price = priceOf(b), paid = paidOf(b.id), left = Math.max(0, price - paid);
    return { price, paid, left, status: paid <= 0 ? 'none' : left > 0 ? 'part' : 'full' };
  }
  function setPrice(id, price) {
    const b = state.bookings.find(x => x.id === id); if (!b) return;
    b.price = Math.max(0, Math.round(+price || 0)); save(); post('api/admin/action', { op: 'price', id, price: b.price });
  }
  function addPayment({ booking, amount, method, date }) {
    amount = Math.round(+amount || 0);
    if (!state.bookings.some(x => x.id === booking)) return { ok: false, msg: 'ჯავშანი ვერ მოიძებნა' };
    if (!amount) return { ok: false, msg: 'ჩაწერეთ თანხა' };
    if (!METHODS[method]) return { ok: false, msg: 'აირჩიეთ გადახდის ხერხი' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) date = today();
    const p = { id: uid(), booking, amount, method, date, created: new Date().toISOString() };
    state.payments.push(p); save(); post('api/admin/action', { op: 'pay', ...p }); return { ok: true };
  }
  // ---------- guests: bookings grouped by phone number ----------
  const guestKey = phone => String(phone || '').replace(/\D/g, '').slice(-9);
  // stays that touch or overlap (a group in 2 rooms, a stay split over rooms) are one visit
  function visitsOf(list) {
    const v = [];
    for (const b of list.slice().sort((x, y) => x.from < y.from ? -1 : 1)) {
      const last = v[v.length - 1];
      if (last && b.from <= last.to) { last.list.push(b); if (b.to > last.to) last.to = b.to; }
      else v.push({ from: b.from, to: b.to, list: [b] });
    }
    return v;
  }
  function guests() {
    const map = {};
    for (const b of state.bookings) {
      if (b.status === 'deleted') continue;
      const k = guestKey(b.phone); if (k.length < 6) continue;
      const g = map[k] || (map[k] = { k, names: [], phone: b.phone, bookings: [], visits: 0, nights: 0, paid: 0, first: null, last: null, sources: new Set() });
      if (!g.names.includes(b.name)) g.names.push(b.name);
      g.bookings.push(b); g.sources.add(b.source);
      if (b.status === 'confirmed') g.paid += paidOf(b.id);
    }
    // only stays that have already started count as visits
    const t = today();
    for (const g of Object.values(map)) {
      const v = visitsOf(g.bookings.filter(b => b.status === 'confirmed' && b.from <= t));
      g.visits = v.length;
      g.nights = v.reduce((n, x) => n + nights(x.from, x.to), 0);
      g.first = v.length ? v[0].from : null; g.last = v.length ? v[v.length - 1].from : null;
      g.upcoming = visitsOf(g.bookings.filter(b => b.status === 'confirmed' && b.from > t)).length;
    }
    return Object.values(map).map(g => ({ ...g, name: g.names[g.names.length - 1], note: state.guestNotes[g.k] || '', bday: state.guestBdays[g.k] || '', sources: [...g.sources] }));
  }
  // earlier confirmed stays of the guest behind a booking (not counting the booking itself)
  // earlier visits of the guest behind a booking: confirmed stays that end before this one starts
  // (a stay touching or overlapping this one is the same visit)
  const guestBefore = b => {
    const k = guestKey(b.phone); if (k.length < 6) return [];
    const mine = state.bookings.filter(x => x.status === 'confirmed' && guestKey(x.phone) === k && x.id !== b.id);
    const v = visitsOf([...mine, b]), i = v.findIndex(x => x.list.includes(b));
    return v.slice(0, i);
  };
  const guestNote = phone => state.guestNotes[guestKey(phone)] || '';
  function setGuest(phone, { note, bday }) {
    const k = guestKey(phone); if (k.length < 6) return;
    if (note !== undefined) { note = String(note || '').trim().slice(0, 1000); if (note) state.guestNotes[k] = note; else delete state.guestNotes[k]; }
    if (bday !== undefined) { if (/^\d{4}-\d{2}-\d{2}$/.test(bday || '')) state.guestBdays[k] = bday; else delete state.guestBdays[k]; }
    save(); post('api/admin/action', { op: 'guestnote', k, note: state.guestNotes[k] || '', bday: state.guestBdays[k] || '' });
  }
  const setGuestNote = (phone, note) => setGuest(phone, { note });
  // days until the next birthday (0 = today); null if unknown
  function daysToBday(bday) {
    if (!bday) return null;
    const t = today(), y = +t.slice(0, 4), md = bday.slice(5);
    let next = `${y}-${md}`; if (md === '02-29' && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) next = `${y}-02-28`;
    if (next < t) next = `${y + 1}-${md === '02-29' ? '02-28' : md}`;
    return nights(t, next);
  }
  function removePayment(pid) { state.payments = state.payments.filter(x => x.id !== pid); save(); post('api/admin/action', { op: 'unpay', id: pid }); }

  // ---------- server (Cloudflare) ----------
  const isAdmin = /admin(\.html)?$/.test(location.pathname);
  const listeners = [], errorListeners = [];
  const emit = () => listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  function applyServer(data) {
    for (const k in data.types) data.types[k].cap = data.types[k].cap ?? (data.types[k].rates.slice(-1)[0]?.guests || 0);
    state = { types: data.types, settings: data.settings, bookings: data.bookings, payments: data.payments || [], guestNotes: data.guestNotes || {}, guestBdays: data.guestBdays || {} };
    ROOMS.length = 0; data.rooms.forEach(r => ROOMS.push(r));
    if (Array.isArray(data.seasons) && data.seasons.length) {
      seasonList = data.seasons;
      Object.keys(SEASONS).forEach(k => delete SEASONS[k]);
      data.seasons.forEach(x => { SEASONS[x.id] = x.name; });
    }
    if (data.hotel) hotel = data.hotel;
    if (data.me) me = data.me;
    actlog = data.actlog || [];
  }
  async function refresh() {
    const r = await fetch(isAdmin ? 'api/admin/state' : 'api/state', { cache: 'no-store' });
    if (r.status === 401 && isAdmin) { location.reload(); return; }
    if (!r.ok) throw new Error('state ' + r.status);
    applyServer(await r.json()); emit();
  }
  // a guest's request: up to 3 tries with a time limit; the server ignores a repeat of the same request
  async function sendRequest(body) {
    let last = { ok: false, offline: true };
    for (let i = 0; i < 3; i++) {
      if (i) await new Promise(r => setTimeout(r, 1500 * i));
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 12000);
      try {
        const r = await fetch('api/request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
        const out = await r.json().catch(() => ({}));
        clearTimeout(tm);
        if (r.ok && out.ok !== false) { refresh().catch(() => {}); return { ok: true, ...out }; }
        if (r.status >= 400 && r.status < 500) return { ok: false, msg: out.msg || out.error || 'error' }; // a real refusal: no retry
        last = { ok: false, msg: out.msg || out.error };
      } catch (e) { clearTimeout(tm); last = { ok: false, offline: true }; }
    }
    return last;
  }
  async function post(url, body) {
    if (mode !== 'api') return;
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const out = await r.json().catch(() => ({}));
      if (!r.ok || out.ok === false) errorListeners.forEach(f => f(out.msg || out.error || 'შეცდომა სერვერზე'));
      await refresh();
      return out;
    } catch (e) {
      // not saved: show the real data again as soon as the connection is back
      needResync = true; setConn(false);
      errorListeners.forEach(f => f('ინტერნეტი არ არის: ცვლილება ვერ შეინახა. კავშირის აღდგენისას პანელი განახლდება, შემდეგ გაიმეორეთ.'));
    }
  }
  // connection state for the admin panel
  let online = true, needResync = false;
  const connListeners = [];
  function setConn(v) { if (v === online) return; online = v; connListeners.forEach(f => { try { f(v); } catch (e) {} }); }
  async function resync() { try { await refresh(); needResync = false; setConn(true); } catch (e) { setConn(false); } }
  window.addEventListener('offline', () => { if (mode === 'api') setConn(false); });
  window.addEventListener('online', () => { if (mode === 'api') resync(); });
  // Demo data is only for the GitHub preview and local testing. On the real site the server must answer:
  // if it does not, we keep trying and the site says so, instead of showing made-up availability.
  // Visit2.ge's own pages (sample hotels, template previews) have no hotel behind them: show the sample data at once
  const platformPage = (/^(www\.)?visit2\.ge$/.test(location.hostname) || (/\.workers\.dev$/.test(location.hostname) && !/^\/h\//.test(location.pathname)));
  const demoHost = !/^https?:$/.test(location.protocol) || /github\.io$/.test(location.hostname) || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && ['8765', '8799'].includes(location.port)) || platformPage;
  async function loadServer() {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 10000);
    try {
      const r = await fetch(isAdmin ? 'api/admin/state' : 'api/state', { cache: 'no-store', signal: ctl.signal });
      // the real server is there, but the admin is not signed in
      if (isAdmin && r.status === 401) return 'login';
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return null;
      const data = await r.json(); if (!data.types) return null;
      applyServer(data); return 'api';
    } catch (e) { return null; } finally { clearTimeout(tm); }
  }
  function startPolling() {
    // poll a tiny 'rev' every 15 s; download everything only when something changed
    if (isAdmin) setInterval(async () => {
      try {
        const r = await fetch('api/admin/rev', { cache: 'no-store' });
        if (r.status === 401) return location.reload();
        const { rev } = await r.json();
        setConn(true);
        if (needResync || rev !== (state.settings?.rev || '0')) await resync();
      } catch (e) { setConn(false); }
    }, 15000);
  }
  const ready = (async () => {
    if (demoHost) return;
    for (let i = 0; i < 3; i++) {
      const m = await loadServer();
      if (m === 'login') { mode = 'login'; return; }
      if (m === 'api') { mode = 'api'; emit(); startPolling(); return; }
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
    }
    // still no answer: no demo data on the real site; keep trying in the background
    mode = 'offline'; state.bookings = []; state.payments = []; emit();
    const retry = setInterval(async () => {
      const m = await loadServer();
      if (m === 'api') { clearInterval(retry); mode = 'api'; emit(); startPolling(); }
      else if (m === 'login') { clearInterval(retry); location.reload(); }
    }, 10000);
  })();

  // Keep every open tab (site, admin) in sync.
  window.addEventListener('storage', e => { if (mode === 'demo' && e.key === KEY) { load(); listeners.forEach(f => f()); } });
  const onChange = f => listeners.push(f);
  const onError = f => errorListeners.push(f);
  const onConn = f => connListeners.push(f);

  if (needPayments) { demoPayments(); save(); }
  return {
    ROOMS, SEASONS, get hotel() { return hotel; }, priceTable, get settings() { return state.settings; }, setSetting, siteSeason, get types() { return state.types; }, get bookings() { return state.bookings; },
    today, addDays, nights, fmt, fmtRange, weekday, seasonOf, quote, rateFor, fromPrice, findOffer, roomsOffer, nextOffer, partialOffer, splitOffer, groupOffer, fitsOne, gaps, gapDiscount, deals, dealTotal, dealNote, gapKey, gapEdits, promos, setJSON, bestRoom, roomFree,
    get payments() { return state.payments; }, METHODS, priceOf, paymentsOf, paidOf, payState, setPrice, addPayment, removePayment,
    createRequest, confirm, setRemark, editBooking, moveRoom, decline, addManual, restore, purge, wipe, guests, guestBefore, guestNote, setGuestNote, setGuest, daysToBday, guestKey, setRate, addRate, removeRate, remove, reset, onChange, onError, reload: load,
    get me() { return me; }, get actlog() { return actlog; }, can: p => me.owner || (me.perms || []).includes(p),
    ready, get mode() { return mode; }, onConn, get online() { return online; }, resync
  };
})();
