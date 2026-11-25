/* Visit2 admin — საიტის მართვა: what the hotel's site shows (content.site, read by site/site.js):
   the top of the page, the story, photos, rooms, amenities, look, map and restaurants; plus contacts and FAQ (js/content.js).
   Only the changes are saved: on Cloudflare in D1 (api/admin/content), in the demo in this browser. */
(() => {
  const J = window.JIJI, JC = window.JC, I = window.I18N;
  const $ = id => document.getElementById(id);
  const esc = JC.esc;
  const LANGS = [['ka', 'ქართული'], ['en', 'English'], ['ru', 'Русский']];
  const GEO = /[Ⴀ-ჿ]/;
  const tr = (ka, l) => (l === 'ka' ? ka : (I.tr(ka, l) || ''));
  const tri = ka => ({ ka, en: tr(ka, 'en'), ru: tr(ka, 'ru') });
  const triList = items => ({ ka: items.join('\n'), en: items.map(x => tr(x, 'en') || x).join('\n'), ru: items.map(x => tr(x, 'ru') || x).join('\n') });
  const clone = o => JSON.parse(JSON.stringify(o == null ? {} : o));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const api = () => J.mode === 'api';
  const node = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  let saved = {}, D = {}, versions = [], started = false, busy = 0;

  // ---------- messages ----------
  let toastT = 0;
  function say(msg, bad) {
    const t = $('toast'); if (!t) return;
    t.textContent = msg; t.classList.toggle('bad', !!bad); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, bad ? 6000 : 3500);
  }

  // ---------- draft state ----------
  function setIn(group, k, v, def) {
    D[group] = D[group] || {};
    if (v == null || same(v, def)) delete D[group][k]; else D[group][k] = v;
    if (!Object.keys(D[group]).length) delete D[group];
    dirty();
  }
  const getIn = (group, k, def) => (D[group] && D[group][k] != null ? D[group][k] : def);
  function dirty() {
    const n = !same(D, saved);
    $('sBar').classList.toggle('dirty', n);
    $('sState').textContent = n ? 'შეუნახავი ცვლილებები' : 'ყველაფერი შენახულია';
    $('sSave').disabled = !n || busy > 0; $('sUndo').disabled = !n;
  }

  // ---------- photos: shrink in the browser, then upload ----------
  function pickFiles(multiple) {
    return new Promise(res => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = !!multiple;
      i.onchange = () => res([...i.files]); i.click();
    });
  }
  async function shrink(file, max) {
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { src = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = URL.createObjectURL(file); }); }
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight, s = Math.min(1, max / Math.max(w, h));
    const cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
    cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
    const blob = (t, q) => new Promise(ok => cv.toBlob(ok, t, q));
    let b = await blob('image/webp', 0.82);
    if (!b || b.type !== 'image/webp') b = await blob('image/jpeg', 0.85); // Safari cannot make webp
    return b;
  }
  async function upload(file) {
    const b = await shrink(file, api() ? 1600 : 1000);
    if (api()) {
      const r = await fetch('api/admin/content', { method: 'PUT', headers: { 'content-type': b.type }, body: b });
      if (r.status === 401) { location.reload(); throw new Error('login'); }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || ('upload ' + r.status));
      return d.url;
    }
    return new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); });
  }
  async function uploadMany(files) {
    const out = [];
    busy++; dirty();
    try {
      for (let i = 0; i < files.length; i++) {
        say(files.length > 1 ? `ფოტო იტვირთება… ${i + 1} / ${files.length}` : 'ფოტო იტვირთება…');
        try { out.push(await upload(files[i])); } catch (e) { if (e.message !== 'login') say('ფოტო ვერ აიტვირთა: ' + e.message, true); }
      }
      if (out.length) say(out.length > 1 ? `${out.length} ფოტო აიტვირთა. არ დაგავიწყდეთ შენახვა.` : 'ფოტო აიტვირთა. არ დაგავიწყდეთ შენახვა.');
    } finally { busy--; dirty(); }
    return out;
  }

  // ---------- building blocks ----------
  function langFields(v, opt = {}) {
    const z = opt.z ? ` data-z="${opt.z}"` : '';
    if (opt.one) return `<label class="ln"><span>ყველა ენაზე</span><input data-l="ka"${z} value="${esc(v.ka || '')}"></label>`;
    return `<div class="lns">${LANGS.map(([l, n]) => `<label class="ln"><span>${n}</span>${opt.short
      ? `<input data-l="${l}"${z} value="${esc(v[l] || '')}" lang="${l}">`
      : `<textarea data-l="${l}"${z} rows="${opt.rows || 3}" lang="${l}">${esc(v[l] || '')}</textarea>`}</label>`).join('')}</div>`;
  }
  // warn when Georgian changed but a translation still has the old text
  const stale = (v, def) => v && def && v.ka !== def.ka && ((def.en && v.en === def.en) || (def.ru && v.ru === def.ru));
  const WARN = '<p class="warn" hidden>⚠ ქართული შეიცვალა — განაახლეთ ინგლისური და რუსული ტექსტიც.</p>';

  function imgCard(v, title, onSrc, onAlt) {
    const c = node(`<div class="ic"><img alt="" src="${esc(v.src)}"><div class="icb">${title ? `<i>${title}</i>` : ''}<button type="button" class="btn" data-up>ფოტოს შეცვლა</button>
      <details><summary>ფოტოს აღწერა</summary><p class="hint">ჩანს თუ ფოტო ვერ ჩაიტვირთა, ეხმარება Google-ს და უსინათლოებს.</p>${langFields(v.alt || {}, { short: true })}</details></div></div>`);
    c.querySelector('[data-up]').addEventListener('click', async () => {
      const [f] = await pickFiles(false); if (!f) return;
      const [url] = await uploadMany([f]); if (url) { c.querySelector('img').src = url; onSrc(url); }
    });
    c.querySelector('details').addEventListener('input', e => { const i = e.target.closest('[data-l]'); if (i) onAlt(i.dataset.l, i.value); });
    return c;
  }

  // a list of photos: reorder, remove, add; optional season and caption per photo
  function galleryEditor(get, put, opt = {}) {
    const box = node(`<div class="gal"><div class="imgs"></div><div class="gacts"><button type="button" class="btn" data-add>+ ფოტოების დამატება</button>${opt.reset ? '<button type="button" class="lnk" data-reset>თავდაპირველი ფოტოები</button>' : ''}</div></div>`);
    const grid = box.querySelector('.imgs');
    const draw = () => {
      const items = get();
      if (opt.reset) box.querySelector('[data-reset]').hidden = !opt.changed();
      grid.innerHTML = items.length ? '' : '<p class="hint">ფოტო არ არის.</p>';
      items.forEach((it, i) => {
        const g = node(`<div class="gi"><img alt="" loading="lazy" src="${esc(it.src)}"><div class="ctl">
          <button type="button" data-mv="-1" aria-label="წინ" ${i ? '' : 'disabled'}>←</button><button type="button" data-mv="1" aria-label="უკან" ${i < items.length - 1 ? '' : 'disabled'}>→</button>
          <button type="button" data-rm aria-label="წაშლა" class="rm">✕</button>
          ${opt.season ? `<select data-season aria-label="სეზონი"><option value="">ორივე სეზონი</option><option value="w"${it.season === 'w' ? ' selected' : ''}>❄ ზამთარი</option><option value="s"${it.season === 's' ? ' selected' : ''}>☀ ზაფხული</option></select>` : ''}</div>
          ${opt.caps ? `<details><summary>წარწერა</summary>${langFields(it.cap || {}, { short: true })}</details>` : ''}</div>`);
        g.addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b) return;
          const a = get();
          if (b.dataset.mv) { const j = i + +b.dataset.mv; [a[i], a[j]] = [a[j], a[i]]; put(a); draw(); }
          else if (b.hasAttribute('data-rm')) { if (!confirm('ამოვიღოთ ეს ფოტო?')) return; a.splice(i, 1); put(a); draw(); }
        });
        g.addEventListener('change', e => { if (e.target.matches('[data-season]')) { const a = get(); a[i].season = e.target.value; put(a); } });
        g.addEventListener('input', e => { const t = e.target.closest('[data-l]'); if (!t) return; const a = get(); a[i].cap = a[i].cap || {}; a[i].cap[t.dataset.l] = t.value; a[i].alt = a[i].cap; put(a); });
        grid.append(g);
      });
    };
    box.querySelector('[data-add]').addEventListener('click', async () => {
      const files = await pickFiles(true); if (!files.length) return;
      const urls = await uploadMany(files); if (!urls.length) return;
      const a = get(); urls.forEach(src => a.push(opt.caps ? { src, cap: { ka: '', en: '', ru: '' }, alt: { ka: '', en: '', ru: '' }, season: '' } : { src })); put(a); draw();
    });
    if (opt.reset) box.querySelector('[data-reset]').addEventListener('click', () => { if (confirm('დავაბრუნოთ თავდაპირველი ფოტოები?')) { opt.reset(); draw(); } });
    draw();
    return box;
  }

  // ---------- the hotel's site (content.site) ----------
  // what the site shows until the owner changes it: a sample hotel's own texts in the demo, otherwise nothing
  const base = () => { const h = J.hotel || {}; return (h.demo && window.V2DEMO && window.V2DEMO.get(h.slug)?.site) || {}; };
  const siteGet = k => (D.site && D.site[k] !== undefined ? D.site[k] : base()[k]);
  const sitePut = (k, v) => { D.site = D.site || {}; if (v == null || same(v, base()[k])) delete D.site[k]; else D.site[k] = v; if (!Object.keys(D.site).length) delete D.site; dirty(); };
  const asTri = v => (typeof v === 'string' ? { ka: v, en: '', ru: '' } : { ka: '', en: '', ru: '', ...(v || {}) });
  // one photo with a "change" button
  function onePhoto(title, get, set) {
    const has = get();
    const box = node(`<div class="fld"><div class="fh"><b>${title}</b></div><div class="one-ph">${has ? `<img alt="" src="${esc(has)}">` : '<div class="ph-empty">ფოტო ჯერ არ არის</div>'}<button type="button" class="btn">${has ? 'ფოტოს შეცვლა' : '+ ფოტოს ატვირთვა'}</button></div></div>`);
    box.querySelector('button').addEventListener('click', async () => {
      const [f] = await pickFiles(false); if (!f) return;
      const [url] = await uploadMany([f]); if (!url) return;
      set(url); box.replaceWith(onePhoto(title, get, set));
    });
    return box;
  }
  // a text in three languages
  function triText(title, hint, get, set, opt = {}) {
    const box = node(`<div class="fld"><div class="fh"><b>${title}</b></div>${hint ? `<p class="hint">${hint}</p>` : ''}${langFields(asTri(get()), opt)}</div>`);
    box.addEventListener('input', e => { const i = e.target.closest('[data-l]'); if (!i) return; const v = asTri(get()); v[i.dataset.l] = i.value; set(v); });
    return box;
  }
  function drawTexts() {
    const p = $('s-texts'); p.innerHTML = '<p class="sub">საიტის თავი, თქვენი ამბავი და მისამართი. თითო ტექსტი სამ ენაზეა: ქართული, ინგლისური, რუსული. თუ ინგლისური ან რუსული ცარიელია, საიტზე ქართული ჩანს.</p>';
    const obj = (k, f) => ({ ...(siteGet(k) || {}), ...f });
    const top = node('<div class="card2"><div class="fh"><b>საიტის თავი</b></div></div>');
    top.append(onePhoto('მთავარი ფოტო', () => siteGet('hero')?.img, url => sitePut('hero', obj('hero', { img: url }))),
      triText('ერთი წინადადება სახელის ქვეშ', 'მაგ.: „თბილი ხის სახლი ნაძვნარში, საბაგიროდან ხუთ წუთში“.', () => siteGet('hero')?.tagline, v => sitePut('hero', obj('hero', { tagline: v })), { short: true }));
    const about = node('<div class="card2"><div class="fh"><b>ჩვენ შესახებ</b></div></div>');
    about.append(triText('თქვენი ამბავი', 'რით არის გამორჩეული ადგილი, რა არის ახლოს, რატომ ბრუნდებიან სტუმრები.', () => siteGet('about')?.text, v => sitePut('about', obj('about', { text: v })), { rows: 5 }),
      onePhoto('ფოტო ტექსტის გვერდით', () => siteGet('about')?.img, url => sitePut('about', obj('about', { img: url }))));
    const where = node('<div class="card2"><div class="fh"><b>სად ვართ</b></div></div>');
    where.append(triText('მისამართი და როგორ მოვიდეთ', 'მაგ.: „დიდველის გზა 4, საბაგირომდე 400 მ“. რუკაზე ადგილს „რუკა და რესტორნები“-ში ნიშნავთ.', () => siteGet('location')?.text, v => sitePut('location', obj('location', { text: v })), { rows: 2 }));
    p.append(top, about, where);
  }
  function drawPhotos() {
    const p = $('s-photos'); p.innerHTML = '<p class="sub">ფოტოები საიტის „ფოტოების“ ნაწილში. პირველი ოთხი Cobalt-ის შაბლონის მოზაიკაშიც ჩანს. ისრებით რიგს ცვლით.</p>';
    p.append(galleryEditor(() => (siteGet('gallery') || []).map(src => ({ src })), a => sitePut('gallery', a.map(x => x.src))));
  }
  function drawRooms() {
    const p = $('s-rooms'); p.innerHTML = '<p class="sub">თითო ტიპის ნომრის აღწერა და ფოტოები. ფასები და ტევადობა „ფასებში“ იცვლება.</p>';
    const types = Object.entries(J.types).filter(([k]) => J.ROOMS.some(r => r.type === k));
    if (!types.length) { p.insertAdjacentHTML('beforeend', '<p class="hint">ნომრები ჯერ არ არის. დაამატეთ „ფასებში“.</p>'); return; }
    types.forEach(([k, t]) => {
      const cur = () => (siteGet('rooms') || {})[k] || {};
      const put = (prop, v) => { const all = clone(siteGet('rooms') || {}); all[k] = { ...(all[k] || {}), [prop]: v }; sitePut('rooms', all); };
      const nums = J.ROOMS.filter(r => r.type === k).map(r => r.id).join(', ');
      const d = node(`<div class="card2"><div class="fh"><b>${esc(t.name)} <small class="hint">(${esc(nums)})</small></b></div></div>`);
      d.append(triText('აღწერა', '', () => cur().text, v => put('text', v), { rows: 3 }));
      const pf = node('<div class="fld"><div class="fh"><b>ფოტოები</b></div><p class="hint">პირველი ფოტო ჩანს ბარათზე, დანარჩენს სტუმარი თითით გადაასრიალებს.</p></div>');
      pf.append(galleryEditor(() => (cur().photos || []).map(src => ({ src })), a => put('photos', a.map(x => x.src))));
      d.append(pf); p.append(d);
    });
  }
  const AMEN = [['wifi', 'Wi-Fi'], ['parking', 'უფასო პარკინგი'], ['breakfast', 'საუზმე'], ['kitchen', 'სამზარეულო ნომერში'], ['fireplace', 'ბუხარი'], ['pool', 'აუზი'],
    ['garden', 'ეზო'], ['bbq', 'მაყალი'], ['balcony', 'აივანი'], ['kids', 'საბავშვო კუთხე'], ['pets', 'შინაური ცხოველით შეიძლება'], ['ski', 'საბაგიროსთან ახლოს'],
    ['sea', 'ზღვასთან ახლოს'], ['center', 'ცენტრში'], ['transfer', 'ტრანსფერი']];
  function drawAmen() {
    const p = $('s-amen'), on = new Set(siteGet('amenities') || []);
    p.innerHTML = `<p class="sub">მონიშნეთ, რაც გაქვთ. საიტზე ჩანს „რა გვაქვს“ ნაწილში. თუ „შინაური ცხოველით შეიძლება“ მონიშნულია, სტუმარს ცხოველის მითითება შეუძლია და ძებნაშიც გამოჩნდებით.</p>
      <div class="card2 amen-list">${AMEN.map(([k, n]) => `<label class="chk"><input type="checkbox" data-a="${k}"${on.has(k) ? ' checked' : ''}><span>${n}</span></label>`).join('')}</div>`;
    p.onchange = e => { const i = e.target.closest('[data-a]'); if (!i) return; const set = new Set(siteGet('amenities') || []); if (i.checked) set.add(i.dataset.a); else set.delete(i.dataset.a); sitePut('amenities', AMEN.map(([k]) => k).filter(k => set.has(k))); };
  }

  function drawContact() {
    const p = $('s-contact'), d = JC.DEF.contact, c = D.contact || {};
    const val = k => (c[k] != null ? c[k] : d[k]);
    const inp = (k, label, type = 'text', hint = '') => `<label class="fld"><b>${label}</b><input class="cin" data-k="${k}" type="${type}" value="${esc(val(k))}">${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
    p.innerHTML = `<p class="sub">აქ შეცვლილი ტელეფონი და სამუშაო საათები ავტომატურად შეიცვლება საიტის ყველა ტექსტში და ჩატბოტებში (საიტი, Messenger, Instagram).</p>
      <div class="card2 grid2">
        ${inp('phone', 'ტელეფონი', 'tel', 'მაგ.: +995 596 90 40 60')}
        ${inp('wa', 'WhatsApp ნომერი', 'tel', 'ცარიელი — WhatsApp ღილაკი დაიმალება')}
        ${inp('fb', 'Facebook გვერდის ბმული', 'url', 'ცარიელი — ღილაკი დაიმალება')}
        ${inp('ig', 'Instagram-ის ბმული', 'url', 'ცარიელი — ნაგულისხმევი ბმული')}
        ${inp('tk', 'TikTok-ის ბმული', 'url', 'ცარიელი — ნაგულისხმევი ბმული')}
        ${inp('email', 'ელფოსტა', 'email', 'ცარიელი — არ ჩანს')}
        ${inp('map', 'რუკის ბმული (Google Maps)', 'url')}
        ${inp('from', 'მიღება იწყება', 'time')}
        ${inp('to', 'მიღება მთავრდება', 'time')}
      </div>
      <div class="card2"><div class="fld"><div class="fh"><b>მისამართი</b></div>${langFields(c.addr || tri(d.addr), { short: true })}</div></div>`;
    p.oninput = e => {
      const i = e.target; D.contact = D.contact || {};
      if (i.dataset.k) { const v = i.value.trim(); if (v === d[i.dataset.k]) delete D.contact[i.dataset.k]; else D.contact[i.dataset.k] = v; }
      else if (i.dataset.l) { const a = clone(D.contact.addr || tri(d.addr)); a[i.dataset.l] = i.value; if (same(a, tri(d.addr))) delete D.contact.addr; else D.contact.addr = a; }
      if (!Object.keys(D.contact).length) delete D.contact;
      dirty();
    };
  }

  // ჯავშნის წესი: request (the hotel confirms) or instant (confirmed at once with a room), and the hotel's own rules
  function drawBook() {
    const p = $('s-book'), ins = siteGet('instant') || {}, on = !!ins.on;
    p.innerHTML = `<p class="sub">აირჩიეთ, როგორ ჯავშნიან სტუმრები თქვენს საიტზე და Visit2.ge-ზე.</p>
      <div class="card2 bk-modes" role="radiogroup" aria-label="ჯავშნის წესი">
        <label class="bk-mode"><input type="radio" name="bkMode" value="req"${on ? '' : ' checked'}><div><b>მოთხოვნით</b><span>სტუმარი აგზავნის მოთხოვნას, თქვენ ადასტურებთ ადმინში. სტუმარი პასუხს ელოდება.</span></div></label>
        <label class="bk-mode"><input type="radio" name="bkMode" value="instant"${on ? ' checked' : ''}><div><b>მყისიერი ჯავშანი</b><span>სტუმარი ჯავშნის და ნომერი მაშინვე მისია. თავისუფალ ნომერს სისტემა თავად არჩევს, ჯავშანი კალენდარში დადასტურებული ჩნდება. Visit2.ge-ზე თქვენ ბარათს ნიშანი „✓ მყისიერი დადასტურება“ ექნება.</span></div></label>
      </div>
      <div class="card2" id="bkSureBox"${on ? ' hidden' : ''}><label class="bk-sure"><input type="checkbox" id="bkSure"> <span>ყველა ჯავშანი (Booking, Airbnb, ტელეფონით, ადგილზე) ამ კალენდარში ჩაწერილია. სხვა საიტიდან მოსულ ჯავშანს აქაც მაშინვე ვწერ, რომ ერთი ნომერი ორჯერ არ გაიყიდოს.</span></label></div>
      <div class="card2"><div class="fld"><div class="fh"><b>გაუქმების პირობა</b><span class="hint">სტუმარი ჯავშნამდე ხედავს. მაგ.: „უფასოდ შეიძლება გაუქმება ჩამოსვლამდე 3 დღით ადრე“.</span></div>${langFields(asTri(ins.cancel), { short: true, z: 'cancel' })}</div></div>
      <div class="card2" id="bkPay"${on ? '' : ' hidden'}></div>
      <div class="card2"><div class="fld"><div class="fh"><b>წინასწარი გადახდა (თუ გინდათ)</b><span class="hint">ცარიელი — არ ჩანს. მაგ.: „ჯავშნიდან 24 საათში 30% ჩარიცხეთ: GE00TB0000000000000000“. ფული პირდაპირ თქვენ მოგდით.</span></div>${langFields(asTri(ins.prepay), { short: true, z: 'prepay' })}</div></div>`;
    const put = o => { const v = { ...(siteGet('instant') || {}), ...o }; for (const k of Object.keys(v)) if (v[k] == null || v[k] === false || (typeof v[k] === 'object' && !Object.values(v[k]).some(Boolean))) delete v[k]; sitePut('instant', Object.keys(v).length ? v : null); };
    p.onchange = e => {
      const t = e.target;
      if (t.name === 'bkMode') {
        if (t.value === 'instant' && !$('bkSure').checked) { t.checked = false; p.querySelector('[value=req]').checked = true; $('bkSure').closest('.bk-sure').scrollIntoView({ block: 'center', behavior: 'smooth' }); $('bkSure').focus(); return; }
        put({ on: t.value === 'instant' || null }); $('bkSureBox').hidden = t.value === 'instant'; $('bkPay').hidden = t.value !== 'instant';
      }
      if (t.name === 'payOn' || t.name === 'payPart' || t.name === 'payPct') payPut();
    };
    drawPay();
    p.oninput = e => { const i = e.target; if (!i.dataset.z) return; const v = asTri((siteGet('instant') || {})[i.dataset.z]); v[i.dataset.l] = i.value; put({ [i.dataset.z]: v }); };
  }

  // online prepayment at the hotel's own bank: Visit2 turns the service on, the owner connects the bank here,
  // and chooses whether an instant booking asks for the whole stay or a deposit (kept in site.instant.pay)
  let payInfo = null;
  function payPut() {
    const p = $('s-book'), on = p.querySelector('[name=payOn]')?.checked, part = p.querySelector('[name=payPart]:checked')?.value || 'full';
    const pct = Math.min(100, Math.max(10, parseInt(p.querySelector('[name=payPct]')?.value) || 30));
    const v = { ...(siteGet('instant') || {}) };
    if (on) v.pay = part === 'deposit' ? { on: true, part, pct } : { on: true, part: 'full' }; else delete v.pay;
    sitePut('instant', v);
    const pc = p.querySelector('[name=payPct]'); if (pc) pc.disabled = part !== 'deposit';
  }
  async function drawPay() {
    const box = $('bkPay'); if (!box) return;
    if (!payInfo) { try { payInfo = await (await fetch('api/admin/pay', { cache: 'no-store' })).json(); } catch (e) { payInfo = { addon: false }; } }
    const o = payInfo, me = (window.JIJI && window.JIJI.me) || {}, py = (siteGet('instant') || {}).pay || {};
    const head = `<div class="fh"><b>ონლაინ წინასწარი გადახდა</b><span class="hint">სტუმარი ჯავშნისას თქვენი ბანკის გვერდზე იხდის, ფული პირდაპირ თქვენს ანგარიშზე შედის. ნომერი გადახდამდე 20 წუთით ნარჩუნდება, გადაუხდელი ჯავშანი თავისით უქმდება. ასე ნომრებს ვერავინ დაიკავებს ტყუილად.</span></div>`;
    if (!o.addon) { box.innerHTML = `<div class="fld">${head}<p class="sub" style="margin:8px 0 0">ამ სერვისს Visit2.ge რთავს. თუ გინდათ, მოგვწერეთ და ჩაგირთავთ.</p></div>`; return; }
    if (!o.ready) { box.innerHTML = `<div class="fld">${head}<p class="sub" style="margin:8px 0 0">ბანკის მიერთება მალე ჩაირთვება.</p></div>`; return; }
    const acc = o.account, bankName = acc ? (o.banks || {})[acc.bank] || acc.bank : '';
    const form = `<div class="pay-form" style="display:grid;gap:10px;margin-top:10px">
        <div role="radiogroup" aria-label="ბანკი" style="display:flex;gap:16px;flex-wrap:wrap">${Object.entries(o.banks || {}).map(([k, n], i) => `<label class="chk"><input type="radio" name="payBank" value="${k}"${(acc ? acc.bank === k : !i) ? ' checked' : ''}> ${esc(n)}</label>`).join('')}</div>
        <label class="lbl">Client ID (მერჩანტის ნომერი)<input name="payId" autocomplete="off"></label>
        <label class="lbl">Client Secret<input name="paySecret" type="password" autocomplete="new-password"></label>
        <label class="lbl" data-tbc>API Key (TBC-ის დეველოპერების პორტალიდან)<input name="payKey" type="password" autocomplete="new-password"></label>
        <p class="hint" style="margin:0">ამ მონაცემებს ბანკი გაძლევთ ონლაინ გადახდების (E-Commerce) რეგისტრაციისას. ჩვენ მათ დაშიფრულად ვინახავთ და თქვენ მათ ვეღარ ნახავთ, მხოლოდ შეცვლით.</p>
        <p><button type="button" class="btn" data-pay-save>ბანკის მიერთება</button> <span class="hint" data-pay-msg role="status"></span></p></div>`;
    box.innerHTML = `<div class="fld">${head}
      ${acc ? `<p style="margin:10px 0 0">✓ მიერთებულია: <b>${esc(bankName)}</b> ${esc(acc.label)}${acc.checked ? ` <span class="hint">(შემოწმდა ${esc(acc.checked.slice(0, 10))})</span>` : ''}</p>` : ''}
      ${me.owner ? (acc ? `<details style="margin-top:8px"><summary>მონაცემების შეცვლა</summary>${form}</details><p style="margin:8px 0 0"><button type="button" class="lnk" data-pay-off>ბანკის გათიშვა</button></p>` : form)
        : (acc ? '' : '<p class="sub" style="margin:8px 0 0">ბანკს მფლობელი აერთებს.</p>')}
      ${acc ? `<div style="display:grid;gap:8px;margin-top:14px">
        <label class="chk"><input type="checkbox" name="payOn"${py.on ? ' checked' : ''}> მყისიერი ჯავშნისას გადახდა მოითხოვე</label>
        <label class="chk"><input type="radio" name="payPart" value="full"${py.part !== 'deposit' ? ' checked' : ''}> სრული თანხა</label>
        <label class="chk"><input type="radio" name="payPart" value="deposit"${py.part === 'deposit' ? ' checked' : ''}> ავანსი <input name="payPct" type="number" min="10" max="100" step="5" value="${py.pct || 30}" style="width:80px"${py.part === 'deposit' ? '' : ' disabled'}> %</label>
        <p class="hint" style="margin:0">არ დაგავიწყდეთ შენახვა გვერდის ქვემოთ.</p></div>` : ''}</div>`;
    const sync = () => { const tbc = box.querySelector('[name=payBank]:checked')?.value === 'tbc'; box.querySelectorAll('[data-tbc]').forEach(x => { x.hidden = !tbc; }); };
    box.querySelectorAll('[name=payBank]').forEach(r => r.addEventListener('change', sync)); sync();
    box.querySelector('[data-pay-save]')?.addEventListener('click', async ev => {
      const btn = ev.currentTarget, msg = box.querySelector('[data-pay-msg]'), q = n => box.querySelector(`[name=${n}]`);
      btn.disabled = true; msg.textContent = 'ბანკს ვამოწმებთ…';
      try {
        const r = await (await fetch('api/admin/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'save', bank: box.querySelector('[name=payBank]:checked')?.value, id: q('payId').value, secret: q('paySecret').value, apikey: q('payKey').value }) })).json();
        if (r.ok) { payInfo = null; await drawPay(); return; }
        msg.textContent = r.msg || 'ვერ მიუერთდა. სცადეთ ხელახლა.';
      } catch (e) { msg.textContent = 'კავშირი ვერ დამყარდა. სცადეთ ხელახლა.'; }
      btn.disabled = false;
    });
    box.querySelector('[data-pay-off]')?.addEventListener('click', async () => {
      if (!confirm('ბანკი გაითიშოს? ონლაინ გადახდა აღარ იმუშავებს, სანამ ხელახლა არ მიაერთებთ.')) return;
      await fetch('api/admin/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'off' }) });
      payInfo = null; drawPay();
    });
  }

  const defFaq = () => JC.DEF.faq.map(([q, a]) => ({ q: tri(q), a: tri(a) }));
  function drawFaq() {
    const p = $('s-faq'), list = clone(D.faq || defFaq());
    const put = a => { if (same(a, defFaq())) delete D.faq; else D.faq = a; dirty(); };
    p.innerHTML = `<p class="sub">კითხვები და პასუხები, რომლებსაც ჩატბოტი აჩვენებს საიტზე, Messenger-სა და Instagram-ში. Messenger-ის ღილაკზე კითხვის პირველი 20 ასო ჩანს, ამიტომ კითხვა მოკლედ დაწერეთ.</p><div class="faqs"></div>
      <div class="gacts"><button type="button" class="btn" data-addq>+ კითხვის დამატება</button><button type="button" class="lnk" data-resetq${D.faq ? '' : ' hidden'}>თავდაპირველი კითხვები</button></div>`;
    const wrap = p.querySelector('.faqs');
    list.forEach((x, i) => {
      const c = node(`<div class="card2" data-i="${i}"><div class="fh"><i class="cn">კითხვა ${i + 1}</i><span class="ctl">
        <button type="button" class="btn sm" data-mv="-1" ${i ? '' : 'disabled'} aria-label="ზემოთ">↑</button><button type="button" class="btn sm" data-mv="1" ${i < list.length - 1 ? '' : 'disabled'} aria-label="ქვემოთ">↓</button><button type="button" class="btn sm nob" data-rm aria-label="წაშლა">✕</button></span></div>
        <div class="fld" data-part="q"><b>კითხვა</b>${langFields(x.q, { short: true })}</div><div class="fld" data-part="a"><b>პასუხი</b>${langFields(x.a, { rows: 3 })}</div></div>`);
      c.addEventListener('input', e => { const t = e.target.closest('[data-l]'); if (!t) return; list[i][t.closest('[data-part]').dataset.part][t.dataset.l] = t.value; put(clone(list)); p.querySelector('[data-resetq]').hidden = !D.faq; });
      c.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.mv) { const j = i + +b.dataset.mv; [list[i], list[j]] = [list[j], list[i]]; put(clone(list)); drawFaq(); }
        else if (b.hasAttribute('data-rm')) { if (!confirm('წავშალოთ ეს კითხვა?')) return; list.splice(i, 1); put(clone(list)); drawFaq(); }
      });
      wrap.append(c);
    });
    p.querySelector('[data-addq]').addEventListener('click', () => { list.push({ q: { ka: '', en: '', ru: '' }, a: { ka: '', en: '', ru: '' } }); put(clone(list)); drawFaq(); const l = p.querySelectorAll('.card2'); l[l.length - 1]?.querySelector('input')?.focus(); });
    p.querySelector('[data-resetq]').addEventListener('click', () => { if (confirm('დავაბრუნოთ თავდაპირველი კითხვები?')) { delete D.faq; dirty(); drawFaq(); } });
  }

  // ---------- look: template, colour, font; and what children cost ----------
  const LOOK_T = [['opal', 'Opal', 'სრული ფოტო, სახელი შუაში'], ['amber', 'Amber', 'ფოტო და ტექსტი გვერდიგვერდ'], ['cobalt', 'Cobalt', 'ფოტოების მოზაიკა'],
    ['alba', 'Alba', 'ნომრები და ფასები თავიდანვე'], ['jade', 'Jade', 'ისტორია და მასპინძელი წინ']];
  const LOOK_OLD = { onyx: 'opal', indigo: 'cobalt', ivory: 'amber', lilac: 'jade', umber: 'alba' };
  const LOOK_C = ['#0E857D', '#3F7A4E', '#1F6FA8', '#2F5A8A', '#B4472F', '#C2410C', '#7A2638', '#8A5A2B', '#6B4A8A', '#1F1A17'];
  const LOOK_DEF = { opal: '#0E857D', amber: '#B4472F', cobalt: '#1F6FA8', alba: '#1F1A17', jade: '#3F7A4E' };
  function drawLook() {
    const p = $('s-look'); if (!p) return;
    const st = D.site || {}, th = LOOK_OLD[st.theme] || st.theme || 'opal', col = st.accent || LOOK_DEF[th] || LOOK_C[0], font = st.font === 'serif' ? 'serif' : 'sans', k = st.kids || {};
    p.innerHTML = `<p class="sub">აქ ირჩევთ, როგორ გამოიყურება საიტი. ცვლილება საიტზე „შენახვის“ შემდეგ ჩანს. ნომრები, ფასები და ჯავშნები არ იცვლება.</p>
      <div class="card2"><div class="fh"><b>რა ადგილია</b></div><p class="hint">მონიშნეთ ერთი ან ორი. Visit2.ge-ის მთავარ გვერდზე ამ რიგებში გამოჩნდებით. თუ არცერთი არ ერგება, დატოვეთ ცარიელი: მაინც ჩანხართ ძებნაში და რუკაზე.</p><div class="look-font look-kinds">${[['mountain', '🏔️ მთა'], ['sea', '🌊 ზღვა'], ['history', '🏛️ ისტორია'], ['wine', '🍷 ღვინო'], ['food', '🥟 სამზარეულო'], ['nature', '🌲 ბუნება'], ['city', '🏙️ ქალაქი']].map(([v, n]) => `<label><input type="checkbox" name="lookKind" value="${v}"${(st.kinds || (st.kind ? [st.kind] : [])).includes(v) ? ' checked' : ''}><span>${n}</span></label>`).join('')}</div></div>
      <div class="card2"><div class="fh"><b>შაბლონი</b></div><div class="look-tpl">${LOOK_T.map(([id, n, d]) => `<label class="look-t"><input type="radio" name="lookT" value="${id}"${id === th ? ' checked' : ''}><img src="img/templates/${id}.jpg" alt="" loading="lazy"><b>${n}</b><span>${d}</span></label>`).join('')}</div></div>
      <div class="card2"><div class="fh"><b>ფერი</b></div><p class="hint">ღილაკების და აქცენტების ფერი. ყველა ფერი თეთრ ტექსტთან კარგად იკითხება.</p><div class="look-col">${LOOK_C.map(c => `<label><input type="radio" name="lookC" value="${c}"${c.toLowerCase() === col.toLowerCase() ? ' checked' : ''} aria-label="ფერი ${c}"><span style="--c:${c}"></span></label>`).join('')}</div></div>
      <div class="card2"><div class="fh"><b>სათაურების შრიფტი</b></div><div class="look-font">
        <label><input type="radio" name="lookF" value="sans"${font === 'sans' ? ' checked' : ''}><span style="font-family:'Noto Sans Georgian'">თანამედროვე</span></label>
        <label><input type="radio" name="lookF" value="serif"${font === 'serif' ? ' checked' : ''}><span style="font-family:'Noto Serif Georgian',serif">კლასიკური</span></label></div></div>
      <div class="card2"><div class="fh"><b>ბავშვები 2–12 წლის</b></div><p class="hint">სტუმარი ძებნისას ირჩევს: უფროსები (13 წლიდან), ბავშვები (2–12), ჩვილები (2 წლამდე, ყოველთვის უფასოდ). აქ წერთ, რა ღირს ბავშვი.</p>
        <div class="look-kids">
          <label class="chk"><input type="radio" name="lookK" value=""${!k.mode ? ' checked' : ''}><span>როგორც უფროსი (ფასი სტუმრების რაოდენობით)</span></label>
          <label class="chk"><input type="radio" name="lookK" value="free"${k.mode === 'free' ? ' checked' : ''}><span>უფასოდ</span></label>
          <label class="chk"><input type="radio" name="lookK" value="fixed"${k.mode === 'fixed' ? ' checked' : ''}><span>ფიქსირებული ფასი ღამეში</span></label>
          <label class="fld look-kp"${k.mode === 'fixed' ? '' : ' hidden'}><b>ერთი ბავშვი, ერთი ღამე (₾)</b><input type="number" inputmode="numeric" min="0" step="1" id="lookKP" value="${esc(k.price ?? '')}"></label>
        </div></div>`;
    p.onchange = p.oninput = e => {
      const t = e.target, site = (D.site = D.site || {});
      if (t.name === 'lookKind') {
        let ks = [...p.querySelectorAll('input[name=lookKind]:checked')].map(x => x.value);
        if (ks.length > 2) { t.checked = false; ks = ks.filter(k => k !== t.value); }
        if (ks.length) { site.kinds = ks; site.kind = ks[0]; } else { delete site.kinds; delete site.kind; }
      }
      if (t.name === 'lookT') { site.theme = t.value; if (!site.accent) delete site.accent; }
      if (t.name === 'lookC') site.accent = t.value;
      if (t.name === 'lookF') { if (t.value === 'serif') site.font = 'serif'; else delete site.font; }
      if (t.name === 'lookK') { if (t.value) site.kids = { ...(site.kids || {}), mode: t.value }; else delete site.kids; p.querySelector('.look-kp').hidden = t.value !== 'fixed'; }
      if (t.id === 'lookKP') { site.kids = { ...(site.kids || {}), mode: 'fixed', price: Math.max(0, Math.round(+t.value || 0)) }; }
      dirty();
    };
  }

  // ---------- map and places nearby: the hotel's pin, which restaurants guests see, and the host's own tips ----------
  const KINDS = [['restaurant', 'რესტორანი'], ['georgian', 'ქართული სამზარეულო'], ['cafe', 'კაფე'], ['bakery', 'საცხობი'], ['wine', 'ღვინის ბარი'], ['bar', 'ბარი'], ['fish', 'თევზის რესტორანი'], ['grill', 'მწვადი'], ['pizza', 'პიცერია'], ['fast', 'სწრაფი კვება']];
  const kindKa = k => (KINDS.find(x => x[0] === k) || KINDS[0])[1];
  let nearPlaces = null, nearFor = '', nearMap = null, nearMarker = null, nearMsg = '';
  const site = () => (D.site = D.site || {});
  const food = () => (site().food = site().food || {});
  const tidyFood = () => {
    const f = D.site?.food; if (!f) return;
    if (f.hide && !f.hide.length) delete f.hide;
    if (f.own && !f.own.length) delete f.own;
    if (!f.places) delete f.at;
    if (!Object.keys(f).length) delete D.site.food;
    if (D.site && !Object.keys(D.site).length) delete D.site;
  };
  const loadL = () => window.L ? Promise.resolve(window.L) : new Promise((ok, bad) => {
    const c = document.createElement('link'); c.rel = 'stylesheet'; c.href = 'vendor/leaflet/leaflet.css'; document.head.append(c);
    const s = document.createElement('script'); s.src = 'vendor/leaflet/leaflet.js'; s.onload = () => ok(window.L); s.onerror = bad; document.head.append(s);
  });
  // the places list is asked from OpenStreetMap by this browser and saved with the content, so guests read it from us
  async function fetchNear(force) {
    const p = D.site?.pin; if (!p) { nearPlaces = null; return; }
    const key = (+p.lat).toFixed(4) + ',' + (+p.lng).toFixed(4);
    const saved = D.site?.food?.places;
    if (!force && Array.isArray(saved) && D.site.food.at === key) { nearPlaces = saved; nearFor = key; drawNearList(); return; }
    if (!force && key === nearFor && nearPlaces) return;
    nearFor = key; nearPlaces = null; nearMsg = 'ადგილებს ვეძებთ OpenStreetMap-ზე…'; drawNearList();
    try {
      nearPlaces = await window.V2OSM.places(+p.lat, +p.lng); nearMsg = '';
      const f = food(); f.places = nearPlaces; f.at = key; dirty();
    } catch (e) { nearMsg = 'ადგილების სია ახლა ვერ ჩაიტვირთა. ცოტა ხანში დააჭირეთ „სიის განახლებას“.'; nearFor = ''; }
    drawNearList();
  }
  function setPin(lat, lng) {
    site().pin = { lat: +(+lat).toFixed(6), lng: +(+lng).toFixed(6) };
    if (nearMarker) nearMarker.setLatLng([lat, lng]);
    $('nearPinState').textContent = '✓ ადგილი მონიშნულია. არ დაგავიწყდეთ „შენახვა“.';
    dirty(); fetchNear();
  }
  function drawNear() {
    const p = $('s-near'); if (!p) return;
    const pin = D.site?.pin;
    p.innerHTML = `<p class="sub">რუკაზე მონიშნეთ, სად არის თქვენი სასტუმრო. საიტზე სტუმრები დაინახავენ რუკას და ახლომახლო რესტორნებსა და კაფეებს. სია OpenStreetMap-იდან მოდის, თავად ახლდება.</p>
      <div class="card2">
        <div class="fh"><b>1. სასტუმროს ადგილი</b></div>
        <form class="near-find" id="nearFind"><input id="nearQ" type="search" placeholder="ქალაქი ან მისამართი, მაგ.: ბაკური, დიდველის გზა" aria-label="ქალაქი ან მისამართი"><button class="btn" type="submit">მოძებნა</button></form>
        <div class="near-found" id="nearFound"></div>
        <div class="near-map" id="nearMap"></div>
        <p class="hint" id="nearPinState">${pin ? '✓ ადგილი მონიშნულია. საჭიროების შემთხვევაში რუკაზე დააჭირეთ სწორ ადგილს.' : 'მოძებნეთ ქალაქი, მერე რუკაზე დააჭირეთ ზუსტად თქვენს სახლს.'}</p>
      </div>
      <div class="card2"><div class="fh"><b>2. რომელი ადგილები ჩანდეს საიტზე</b></div><div id="nearList"></div>
        <div class="gacts"><button type="button" class="btn sm" id="nearRefresh">სიის განახლება</button></div></div>
      <div class="card2"><div class="fh"><b>3. თქვენი რჩევები</b></div><p class="hint">საყვარელი ადგილი, რომელიც სიაში არ არის? დაამატეთ. საიტზე პირველი გამოჩნდება, წარწერით „მასპინძელი გირჩევთ“.</p><div id="nearOwn"></div>
        <div class="gacts"><button type="button" class="btn" id="nearAdd">+ რჩევის დამატება</button></div></div>`;
    drawNearList(); drawOwn();
    $('nearRefresh').addEventListener('click', () => fetchNear(true));
    $('nearAdd').addEventListener('click', () => { const f = food(); f.own = f.own || []; f.own.push({ name: { ka: '', en: '', ru: '' }, kind: 'restaurant', note: { ka: '', en: '', ru: '' } }); dirty(); drawOwn(); const l = $('nearOwn').querySelectorAll('.card2'); l[l.length - 1]?.querySelector('input')?.focus(); });
    $('nearFind').addEventListener('submit', async e => {
      e.preventDefault(); const q = $('nearQ').value.trim(); if (!q) return;
      const out = $('nearFound'); out.textContent = 'ვეძებთ…';
      try {
        const d = { found: await window.V2OSM.geocode(q) };
        if (!d.found?.length) { out.textContent = 'ვერ ვიპოვეთ. სცადეთ მხოლოდ ქალაქის სახელი.'; return; }
        out.innerHTML = d.found.map((x, i) => `<button type="button" class="btn sm" data-g="${i}">${esc(x.name)}</button>`).join('');
        out.onclick = ev => { const b = ev.target.closest('[data-g]'); if (!b) return; const x = d.found[+b.dataset.g]; nearMap?.setView([x.lat, x.lng], 16); out.textContent = 'ახლა რუკაზე დააჭირეთ ზუსტად თქვენს სახლს.'; };
      } catch (err) { out.textContent = 'ძებნა ახლა ვერ მოხერხდა. რუკაზე თავად იპოვეთ ადგილი.'; }
    });
    loadL().then(L => {
      const el = $('nearMap'); if (!el) return;
      if (nearMap) { nearMap.remove(); nearMap = null; nearMarker = null; }
      nearMap = L.map(el, { scrollWheelZoom: false }).setView(pin ? [pin.lat, pin.lng] : [42.2, 43.5], pin ? 16 : 7);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(nearMap);
      nearMap.attributionControl.setPrefix(false);
      const icon = L.divIcon({ className: 'near-pin', html: '<span></span>', iconSize: [30, 30], iconAnchor: [15, 30] });
      nearMarker = L.marker(pin ? [pin.lat, pin.lng] : [0, 0], { icon, draggable: true });
      if (pin) nearMarker.addTo(nearMap);
      nearMarker.on('dragend', () => { const ll = nearMarker.getLatLng(); setPin(ll.lat, ll.lng); });
      nearMap.on('click', ev => { if (!nearMap.hasLayer(nearMarker)) nearMarker.addTo(nearMap); setPin(ev.latlng.lat, ev.latlng.lng); });
    }).catch(() => { $('nearMap').innerHTML = '<div class="empty">რუკა ვერ ჩაიტვირთა. შეამოწმეთ ინტერნეტი.</div>'; });
    fetchNear();
  }
  function drawNearList() {
    const el = $('nearList'); if (!el) return;
    if (!D.site?.pin) { el.innerHTML = '<p class="hint">ჯერ რუკაზე მონიშნეთ სასტუმრო.</p>'; return; }
    if (!nearPlaces) { el.innerHTML = `<p class="hint">${esc(nearMsg || 'ადგილებს ვეძებთ…')}</p>`; return; }
    if (!nearPlaces.length) { el.innerHTML = '<p class="hint">6 კმ-ში რესტორანი ან კაფე რუკაზე ვერ ვიპოვეთ. თქვენი რჩევები ქვემოთ დაამატეთ.</p>'; return; }
    const hide = new Set(D.site?.food?.hide || []);
    el.innerHTML = `<p class="hint">მონიშნული ადგილები ჩანს საიტზე. მოხსენით ნიშანი, თუ ადგილს არ ურჩევთ სტუმრებს.</p>${nearPlaces.map(x =>
      `<label class="chk"><input type="checkbox" data-pid="${esc(x.id)}"${hide.has(x.id) ? '' : ' checked'}><span>${esc(x.name.ka || x.name.def)} <span class="hint">· ${esc(kindKa(x.kind))} · ${x.m < 1000 ? x.m + ' მ' : (x.m / 1000).toFixed(1) + ' კმ'}</span></span></label>`).join('')}`;
    el.onchange = e => {
      const i = e.target.closest('[data-pid]'); if (!i) return;
      const f = food(), h = new Set(f.hide || []);
      if (i.checked) h.delete(i.dataset.pid); else h.add(i.dataset.pid);
      f.hide = [...h]; tidyFood(); dirty();
    };
  }
  function drawOwn() {
    const el = $('nearOwn'); if (!el) return;
    const list = D.site?.food?.own || [];
    el.innerHTML = list.map((x, i) => `<div class="card2" data-i="${i}"><div class="fh"><i class="cn">რჩევა ${i + 1}</i><span class="ctl"><button type="button" class="btn sm nob" data-rm aria-label="წაშლა">✕</button></span></div>
      <div class="fld" data-part="name"><b>სახელი</b>${langFields(x.name || {}, { short: true })}</div>
      <label class="fld"><b>რა ადგილია</b><select data-kind>${KINDS.map(([k, n]) => `<option value="${k}"${k === x.kind ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <div class="fld" data-part="note"><b>რას ურჩევთ (არასავალდებულო)</b>${langFields(x.note || {}, { short: true })}</div>
      <div class="grid2 near-links">
        <label class="fld"><b>ბმული Google Maps-ზე</b><input data-f="map" type="url" inputmode="url" placeholder="https://maps.app.goo.gl/…" value="${esc(x.map || '')}"><span class="hint">Google Maps-ში ადგილი გახსენით, „Share“ და ბმული აქ ჩასვით.</span></label>
        <label class="fld"><b>საიტი ან Instagram</b><input data-f="web" type="url" inputmode="url" placeholder="https://" value="${esc(x.web || '')}"></label>
        <label class="fld"><b>ტელეფონი</b><input data-f="phone" type="tel" placeholder="+995 …" value="${esc(x.phone || '')}"></label>
      </div></div>`).join('');
    el.oninput = el.onchange = e => {
      const c = e.target.closest('[data-i]'); if (!c) return; const o = D.site.food.own[+c.dataset.i];
      if (e.target.dataset.kind != null) o.kind = e.target.value;
      else if (e.target.dataset.f) { const v = e.target.value.trim(); if (v) o[e.target.dataset.f] = v; else delete o[e.target.dataset.f]; }
      else if (e.target.dataset.l) { const part = e.target.closest('[data-part]').dataset.part; o[part] = { ...(o[part] || {}), [e.target.dataset.l]: e.target.value }; }
      dirty();
    };
    el.onclick = e => {
      const b = e.target.closest('[data-rm]'); if (!b) return; if (!confirm('წავშალოთ ეს რჩევა?')) return;
      food().own.splice(+b.closest('[data-i]').dataset.i, 1); tidyFood(); dirty(); drawOwn();
    };
  }

  const when = s => { const d = new Date(s); if (isNaN(d)) return ''; const p = n => String(n).padStart(2, '0'); return JIJI.fmt(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`) + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '') + ', ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
  function drawHistory() {
    const p = $('s-hist');
    if (!api()) { p.innerHTML = '<p class="sub">შენახვების ისტორია მალე.</p>'; return; }
    p.innerHTML = `<p class="sub">ბოლო 20 შენახვა. „გახსნა“ ჩატვირთავს იმ ვერსიას, საიტზე კი გამოჩნდება მხოლოდ „შენახვის“ შემდეგ.</p>${versions.length ? `<div class="scroll"><table class="hist"><thead><tr><th>როდის</th><th>შენიშვნა</th><th></th></tr></thead><tbody>${
      versions.map((v, i) => `<tr><td>${esc(when(v.created))}${i === 0 ? ' <span class="pill p-ok">ახლა საიტზე</span>' : ''}</td><td>${esc(v.note || '')}</td><td>${i ? `<button type="button" class="btn sm" data-ver="${v.id}">გახსნა</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ჯერ არაფერი შეგინახავთ.</div>'}`;
    p.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', async () => {
      if (!same(D, saved) && !confirm('შეუნახავი ცვლილებები დაიკარგება. გავაგრძელოთ?')) return;
      const r = await fetch('api/admin/content?ver=' + b.dataset.ver, { cache: 'no-store' });
      if (!r.ok) return say('ვერსია ვერ ჩაიტვირთა.', true);
      D = (await r.json()).content || {}; drawAll(); dirty();
      say('ძველი ვერსია ჩაიტვირთა. საიტზე დასაბრუნებლად დააჭირეთ „შენახვა“.');
    }));
  }

  function drawAll() { drawTexts(); drawPhotos(); drawRooms(); drawAmen(); drawContact(); drawBook(); drawFaq(); drawNear(); drawLook(); drawHistory(); }

  // ---------- save, undo, preview ----------
  async function save() {
    if (busy) return;
    const note = prompt('მოკლე შენიშვნა ამ ცვლილებაზე (არასავალდებულო):', '') ?? null;
    if (note === null) return;
    $('sSave').disabled = true;
    try {
      if (api()) {
        const r = await fetch('api/admin/content', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: D, note }) });
        if (r.status === 401) return location.reload();
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || r.status);
        saved = d.content || clone(D); versions = d.versions || versions; D = clone(saved);
      } else {
        try { localStorage.setItem(JC.K_DEMO, JSON.stringify(D)); } catch (e) { throw new Error('ბრაუზერის მეხსიერება სავსეა (სადემონსტრაციო ვერსიაში ფოტოები აქ ინახება)'); }
        saved = clone(D);
      }
      dirty(); drawHistory();
      say('✓ შენახულია. საიტზე უკვე ჩანს.');
    } catch (e) { say('ვერ შეინახა: ' + (e.message || e) + '. შეამოწმეთ ინტერნეტი და სცადეთ ხელახლა.', true); dirty(); }
  }
  function undo() { if (!confirm('გავაუქმოთ ყველა შეუნახავი ცვლილება?')) return; D = clone(saved); drawAll(); dirty(); }
  function preview() {
    try { localStorage.setItem(JC.K_PREVIEW, JSON.stringify(D)); } catch (e) { return say('წინასწარი ნახვა ვერ მოხერხდა: მეხსიერება სავსეა.', true); }
    const h = J.hotel || {};
    window.open(h.demo ? `hotel.html?h=${encodeURIComponent(h.slug)}&preview=1` : './?preview=1', '_blank');
  }

  // ---------- start ----------
  async function start() {
    if (started) return; started = true;
    $('s-texts').innerHTML = '<p class="sub">იტვირთება…</p>';
    try {
      if (api()) {
        const r = await fetch('api/admin/content', { cache: 'no-store' });
        if (r.status === 401) return location.reload();
        if (!r.ok) throw new Error('content ' + r.status);
        const d = await r.json(); saved = d.content || {}; versions = d.versions || [];
      } else { try { saved = JSON.parse(localStorage.getItem(JC.K_DEMO) || '{}') || {}; } catch (e) { saved = {}; } }
      D = clone(saved);
      drawAll(); dirty();
    } catch (e) {
      started = false;
      $('s-texts').innerHTML = '<div class="empty">ვერ ჩაიტვირთა. შეამოწმეთ ინტერნეტი და <button type="button" class="lnk" id="sRetry">სცადეთ ხელახლა</button>.</div>';
      $('sRetry').addEventListener('click', start);
    }
  }

  const stabs = [...document.querySelectorAll('.stab')];
  stabs.forEach(t => t.addEventListener('click', () => {
    stabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', on); $('s-' + x.dataset.s).hidden = !on; });
    // the map was drawn while its tab was hidden: let it measure itself now
    if (t.dataset.s === 'near' && nearMap) setTimeout(() => { nearMap.invalidateSize(); const p = D.site?.pin; if (p) nearMap.setView([p.lat, p.lng], Math.max(nearMap.getZoom(), 15)); }, 0);
  }));
  $('sSave').addEventListener('click', save);
  $('sUndo').addEventListener('click', undo);
  $('sPrev').addEventListener('click', preview);
  addEventListener('beforeunload', e => { if (started && !same(D, saved)) { e.preventDefault(); e.returnValue = ''; } });

  // top switch: ჯავშნები | საიტის მართვა | გუნდი (buttons the signed-in admin may not use are hidden)
  const modes = [...document.querySelectorAll('[data-mode]')];
  const AREA = { book: 'bookArea', site: 'siteArea', team: 'teamArea' };
  function setMode(m) {
    const ok = modes.filter(b => !b.hidden).map(b => b.dataset.mode);
    if (!ok.includes(m)) m = ok[0] || 'book';
    modes.forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
    for (const k in AREA) if ($(AREA[k])) $(AREA[k]).hidden = k !== m;
    document.body.classList.toggle('site', m === 'site');
    $('modeBar').hidden = ok.length < 2;
    try { sessionStorage.setItem('jiji-admin-mode', m); } catch (e) {}
    if (m === 'site') J.ready.then(start);
    document.dispatchEvent(new CustomEvent('adminmode', { detail: m }));
  }
  modes.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  const saved0 = () => { try { return sessionStorage.getItem('jiji-admin-mode') || 'book'; } catch (e) { return 'book'; } };
  window.adminMode = { set: setMode, refresh: () => setMode(saved0()) };
  setMode(saved0());
})();
