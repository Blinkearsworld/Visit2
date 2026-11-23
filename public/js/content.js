/* the hotel — editable site content: texts, photos, videos, contacts, FAQ and room descriptions.
   The hotel edits them in admin → საიტის მართვა; only the changes are stored (D1 on Cloudflare, this browser in the demo).
   Elements marked data-c="key" in index.html are editable; anything not changed keeps the page's own text. */
(() => {
  const DEMO = /github\.io$/.test(location.hostname) || location.protocol === 'file:' || ['8765', '8799'].includes(location.port);
  const K_CACHE = 'v2-content', K_DEMO = 'v2-content-demo', K_PREVIEW = 'v2-content-preview';
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or off */ } }
  };
  const isPreview = /[?&]preview=1\b/.test(location.search);

  // ---------- defaults (what the site shows until the hotel changes it) ----------
  // Neutral defaults for a new hotel. The owner fills in the real ones in admin → საიტის მართვა.
  const DEF = {
    contact: { phone: '+995 500 00 00 00', wa: '+995 500 00 00 00', fb: '', ig: '', tk: '',
      email: '', map: '', from: '10:00', to: '20:00', addr: '' },
    faq: [
      ['როგორ დავჯავშნო?', 'აირჩიეთ თარიღი და გამოგზავნეთ მოთხოვნა. წინასწარი გადახდა საჭირო არ არის: სასტუმრო დაგიკავშირდებათ და ჯავშანს დაგიდასტურებთ.'],
      ['შესვლის და გასვლის დრო', 'ზუსტ საათებს ჯავშნის დადასტურებისას გეტყვით. მიღება ყოველდღე 10:00–20:00.'],
      ['როგორ გადავიხადო?', 'გადახდის პირობებს სასტუმრო ჯავშნის დადასტურებისას გეტყვით.']
    ],
    roomPhotos: {},
    roomFeats: {},
    roomText: {}
  };

  let C = (isPreview && ls.get(K_PREVIEW)) || ls.get(DEMO ? K_DEMO : K_CACHE) || {};
  const listeners = [];
  const emit = () => listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } });

  async function load() {
    if (isPreview || DEMO) return C;
    try {
      const r = await fetch('api/content', { cache: 'no-store' });
      if (!r.ok) return C;
      const n = (await r.json()).content || {};
      const changed = JSON.stringify(n) !== JSON.stringify(C);
      C = n; ls.set(K_CACHE, n);
      if (changed) emit();
    } catch (e) { /* offline: keep the last copy */ }
    return C;
  }

  // ---------- helpers ----------
  const lang = () => (window.I18N ? window.I18N.lang : 'ka');
  const T = (k, v) => (window.I18N ? window.I18N.t(k, v) : k);
  const has = v => v != null && String(v).trim() !== '';
  // a {ka,en,ru} value in the visitor's language; empty English/Russian falls back to Georgian
  const pick = (o, l = lang()) => (o == null ? '' : typeof o === 'string' ? o : has(o[l]) ? o[l] : (o.ka || ''));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);

  function contact() {
    const c = { ...DEF.contact }, o = C.contact || {};
    // phone, hours and map are required (blank keeps the default); links may be cleared to hide their button
    for (const k in o) {
      if (k === 'addr') { if (has(pick(o.addr))) c.addr = o.addr; }
      else if (['phone', 'from', 'to', 'map'].includes(k)) { if (has(o[k])) c[k] = String(o[k]).trim(); }
      else if (['ig', 'tk'].includes(k) && !has(o[k])) continue; // added later: an old empty value keeps the default
      else c[k] = String(o[k] || '').trim();
    }
    c.digits = String(c.phone).replace(/\D/g, '');
    c.local = String(c.phone).replace(/^\s*\+?995\s*/, '');
    c.waDigits = String(c.wa).replace(/\D/g, '');
    c.addrText = o.addr ? pick(o.addr) : ((window.JIJI && window.JIJI.hotel && window.JIJI.hotel.city) || '');
    return c;
  }

  // texts carry the default phone and hours; swap in the hotel's current ones
  function fix(s) {
    const c = contact(), d = DEF.contact;
    s = String(s);
    if (c.phone !== d.phone) s = s.split(d.phone).join(c.phone).split('500 00 00 00').join(c.local);
    if (c.from !== d.from) s = s.split(d.from).join(c.from);
    if (c.to !== d.to) s = s.split(d.to).join(c.to);
    return s;
  }

  function youtube(u) {
    const m = String(u || '').match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    return m ? m[1] : null;
  }

  // ---------- applying to the page (call after I18N.apply, before the season swap) ----------
  function apply(root = document) {
    const l = lang(), t = C.t || {}, im = C.img || {};
    root.querySelectorAll('[data-c]').forEach(el => {
      const k = el.dataset.c, kind = el.dataset.ct;
      if (kind === 'gallery') return gallery(el, k, l);
      if (el.tagName === 'IMG') {
        const v = im[k]; if (!v) return;
        if (v.w || v.s) { for (const z of ['w', 's']) if (v[z] && v[z].src) el.setAttribute('data-' + z, v[z].src + '|' + (pick(v[z].alt, l) || el.alt)); }
        else if (v.src) { if (el.getAttribute('src') !== v.src) el.src = v.src; const a = pick(v.alt, l); if (a) el.alt = a; }
        return;
      }
      const v = t[k]; if (v == null) return;
      if (kind === 'list') {
        const tag = el.tagName === 'UL' || el.tagName === 'OL' ? 'li' : 'span';
        el.innerHTML = lines(pick(v, l)).map(s => `<${tag}>${esc(s)}</${tag}>`).join('');
      } else if (v.w || v.s) { for (const z of ['w', 's']) if (v[z]) el.setAttribute('data-' + z, pick(v[z], l)); }
      else el.textContent = pick(v, l);
    });
    // contacts
    const c = contact();
    root.querySelectorAll('[data-cc]').forEach(el => {
      const k = el.dataset.cc;
      if (k === 'phone') { el.href = 'tel:+' + c.digits; if (!el.dataset.keep) el.textContent = el.dataset.full ? c.phone : c.local; }
      else if (k === 'wa') { el.href = 'https://wa.me/' + c.waDigits; el.hidden = !c.waDigits; }
      else if (k === 'fb') { el.href = c.fb; el.hidden = !has(c.fb); }
      else if (k === 'ig') { el.href = c.ig; el.hidden = !has(c.ig); }
      else if (k === 'tk') { el.href = c.tk; el.hidden = !has(c.tk); }
      else if (k === 'email') { el.href = 'mailto:' + c.email; el.textContent = c.email; (el.closest('[data-cbox]') || el).hidden = !has(c.email); }
      else if (k === 'addr') { el.href = c.map; el.textContent = c.addrText; }
      else if (k === 'hours') el.textContent = T('ყოველდღე, {a}–{b}', { a: c.from, b: c.to });
    });
    // a YouTube video with no own poster shows YouTube's picture
    root.querySelectorAll('[data-cv]').forEach(el => {
      const id = youtube((C.video || {})[el.dataset.cv]);
      if (!el.__src0) el.__src0 = el.getAttribute('src');
      const own = im[el.dataset.c] && im[el.dataset.c].src;
      if (!own) el.src = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : el.__src0;
    });
    // hidden sections
    const hide = C.hide || {};
    root.querySelectorAll('[data-cs]').forEach(el => { el.toggleAttribute('data-off', !!hide[el.id]); });
  }

  function gallery(el, k, l) {
    const g = (C.gal || {})[k]; if (!g) return;
    el.innerHTML = g.map(it => `<figure${it.season ? ` class="only-${it.season}"` : ''}><img src="${esc(it.src)}" alt="${esc(pick(it.alt, l) || pick(it.cap, l))}" loading="lazy">${has(pick(it.cap, l)) ? `<figcaption>${esc(pick(it.cap, l))}</figcaption>` : ''}</figure>`).join('');
  }

  // room description, features and photos for a room type
  function room(k) {
    const o = (C.rooms || {})[k] || {};
    return {
      text: o.text ? pick(o.text) : T(DEF.roomText[k] || ''),
      feats: o.feats ? lines(pick(o.feats)) : (DEF.roomFeats[k] || []).map(f => T(f)),
      photos: o.photos ? o.photos.slice() : (DEF.roomPhotos[k] || []).slice()
    };
  }

  // FAQ in the visitor's language: [{q, a}]
  function faq() {
    if (Array.isArray(C.faq)) return C.faq.map(x => ({ q: pick(x.q), a: fix(pick(x.a)) })).filter(x => has(x.q) && has(x.a));
    return DEF.faq.map(([q, a]) => ({ q: T(q), a: fix(T(a)) }));
  }

  window.JC = {
    DEF, DEMO, K_DEMO, K_PREVIEW, load, apply, fix, contact, room, faq, youtube, pick, lines, esc,
    get data() { return C; },
    video: k => youtube((C.video || {})[k]),
    onChange: f => listeners.push(f)
  };
  load();
})();
