/* Villa JIJI admin — საიტის მართვა: page texts in three languages, photos, videos, contacts, FAQ and sections.
   Defaults are read from index.html itself (elements marked data-c), so every editable spot shows up here on its own.
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

  let saved = {}, D = {}, secs = [], versions = [], started = false, busy = 0;
  const openSecs = new Set(['hero']);

  // ---------- messages ----------
  let toastT = 0;
  function say(msg, bad) {
    const t = $('toast'); if (!t) return;
    t.textContent = msg; t.classList.toggle('bad', !!bad); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, bad ? 6000 : 3500);
  }

  // ---------- labels for the fields found in index.html ----------
  const SEC = {
    hero: 'მთავარი ეკრანი', about: 'სასტუმროს შესახებ', newyear: 'ახალი წელი (ჩანს ზამთარში)', summer: 'ზაფხული (ჩანს ზაფხულში)',
    fire: 'ბუხრის ოთახი', photos: 'ფოტოების ზოლი', spaces: 'შიდა სივრცეები', grounds: 'ეზო', near: 'რა არის ახლოს',
    rooms: 'ნომრების სექცია (სათაური)', book: 'დაჯავშნა და კონტაქტი'
  };
  function labelOf(el) {
    const tag = el.tagName.toLowerCase(), cl = el.classList, ct = el.dataset.ct;
    if (ct === 'gallery') return 'ფოტოები';
    if (ct === 'list') return cl.contains('chips') ? 'იარლიყები (თითო სტრიქონზე ერთი)' : 'ჩამონათვალი (თითო სტრიქონზე ერთი პუნქტი)';
    if (tag === 'img') return el.hasAttribute('data-w') ? 'ფოტო' : el.dataset.cv ? 'ვიდეოს ყდის ფოტო' : 'ფოტო';
    if (tag === 'b') return 'რიცხვი';
    if (tag === 'span' && cl.contains('len')) return 'ვიდეოს ხანგრძლივობა (ცარიელი — არ გამოჩნდება)';
    if (tag === 'span' && cl.contains('d')) return 'მანძილი';
    if (tag === 'span') return 'წარწერა';
    if (tag === 'button') return 'ღილაკის წარწერა';
    if (tag === 'figcaption') return 'წარწერა ფოტოზე';
    if (tag === 'h1' || tag === 'h2') return 'სათაური';
    if (tag === 'h3') return 'ქვესათაური';
    if (cl.contains('tag')) return 'დევიზი';
    if (cl.contains('lead') || cl.contains('big')) return 'ძირითადი ტექსტი';
    if (cl.contains('small') || cl.contains('note') || cl.contains('rnote')) return 'მცირე შენიშვნა';
    return 'ტექსტი';
  }

  function fieldOf(el, card) {
    const k = el.dataset.c, ct = el.dataset.ct, tag = el.tagName.toLowerCase(), label = labelOf(el);
    if (ct === 'gallery') return { k, card, label, type: 'gallery', def: [...el.querySelectorAll('figure')].map(f => {
      const im = f.querySelector('img'), cap = f.querySelector('figcaption');
      return { src: im.getAttribute('src'), alt: tri(im.getAttribute('alt') || ''), cap: tri(cap ? cap.textContent.trim() : ''), season: f.classList.contains('only-w') ? 'w' : f.classList.contains('only-s') ? 's' : '' };
    }) };
    if (tag === 'img') {
      if (el.hasAttribute('data-w')) {
        const p = v => { const [src, alt] = String(v).split('|'); return { src, alt: tri(alt || '') }; };
        return { k, card, label, type: 'img2', def: { w: p(el.dataset.w), s: p(el.dataset.s) } };
      }
      return { k, card, label, type: 'img', def: { src: el.getAttribute('src'), alt: tri(el.getAttribute('alt') || '') } };
    }
    if (ct === 'list') return { k, card, label, type: 'list', def: triList([...el.children].map(c => c.textContent.trim()).filter(Boolean)) };
    const short = /^(h1|h2|h3|button|span|b|figcaption)$/.test(tag);
    if (el.hasAttribute('data-w')) return { k, card, label, type: 'text2', short, def: { w: tri(el.dataset.w), s: tri(el.dataset.s) } };
    const ka = el.textContent.trim();
    return { k, card, label, type: 'text', short, one: short && !GEO.test(ka), def: tri(ka) };
  }

  async function readPage() {
    const html = await (await fetch('index.html', { cache: 'no-store' })).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const out = [];
    doc.querySelectorAll('main > section').forEach(sec => {
      const fields = [], cards = new Map();
      sec.querySelectorAll('[data-c]').forEach(el => {
        if (el.parentElement.closest('[data-ct="gallery"]')) return;
        const c = el.closest('.sp,.nr,.yard figure,.facts > div');
        if (c && !cards.has(c)) cards.set(c, cards.size + 1);
        fields.push(fieldOf(el, c ? cards.get(c) : 0));
      });
      if (fields.length) out.push({ id: sec.id, name: SEC[sec.id] || sec.getAttribute('aria-label') || sec.id, hideable: sec.hasAttribute('data-cs'), fields });
    });
    return out;
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

  function textField(f, group = 't') {
    const cur = () => getIn(group, f.k, f.def);
    const box = node(`<div class="fld"><div class="fh"><b>${esc(f.label)}</b><button type="button" class="lnk" data-reset hidden>თავდაპირველზე დაბრუნება</button></div></div>`);
    const v = cur(), opt = { short: f.short && f.type !== 'list', one: f.one, rows: f.type === 'list' ? 5 : 3 };
    if (f.type === 'text2') box.insertAdjacentHTML('beforeend', ['w', 's'].map(z => `<div class="sz"><i>${z === 'w' ? '❄ ზამთარში' : '☀ ზაფხულში'}</i>${langFields(v[z] || {}, { ...opt, z })}</div>`).join(''));
    else box.insertAdjacentHTML('beforeend', langFields(v, opt));
    box.insertAdjacentHTML('beforeend', WARN);
    const sync = () => {
      const c = cur();
      box.querySelector('[data-reset]').hidden = same(c, f.def);
      box.querySelector('.warn').hidden = f.type === 'text2' ? !(stale(c.w, f.def.w) || stale(c.s, f.def.s)) : !stale(c, f.def);
    };
    box.addEventListener('input', e => {
      const i = e.target.closest('[data-l]'); if (!i) return;
      const nv = clone(cur());
      if (i.dataset.z) nv[i.dataset.z][i.dataset.l] = i.value; else nv[i.dataset.l] = i.value;
      setIn(group, f.k, nv, f.def); sync();
    });
    box.querySelector('[data-reset]').addEventListener('click', () => { setIn(group, f.k, null, f.def); box.replaceWith(textField(f, group)); });
    sync();
    return box;
  }

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

  function imgField(f) {
    const box = node(`<div class="fld"><div class="fh"><b>${esc(f.label)}</b><button type="button" class="lnk" data-reset hidden>თავდაპირველი ფოტო</button></div><div class="ics"></div></div>`);
    const cur = () => clone(getIn('img', f.k, f.def));
    const sync = () => { box.querySelector('[data-reset]').hidden = same(cur(), f.def); };
    const put = (z, fn) => { const v = cur(); fn(z ? v[z] : v); setIn('img', f.k, v, f.def); sync(); };
    const v = cur(), wrap = box.querySelector('.ics');
    if (f.type === 'img2') ['w', 's'].forEach(z => wrap.append(imgCard(v[z], z === 'w' ? '❄ ზამთარში' : '☀ ზაფხულში', src => put(z, o => { o.src = src; }), (l, t) => put(z, o => { o.alt = o.alt || {}; o.alt[l] = t; }))));
    else wrap.append(imgCard(v, '', src => put(null, o => { o.src = src; }), (l, t) => put(null, o => { o.alt = o.alt || {}; o.alt[l] = t; })));
    box.querySelector('[data-reset]').addEventListener('click', () => { setIn('img', f.k, null, f.def); box.replaceWith(imgField(f)); });
    sync();
    return box;
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

  function galField(f) {
    const box = node(`<div class="fld"><div class="fh"><b>${esc(f.label)}</b></div><p class="hint">ზამთრის ფოტოები ჩანს ზამთარში, ზაფხულისა — ზაფხულში.</p></div>`);
    box.append(galleryEditor(() => clone(getIn('gal', f.k, f.def)), a => setIn('gal', f.k, a, f.def),
      { season: true, caps: true, reset: () => setIn('gal', f.k, null, f.def), changed: () => !!(D.gal && D.gal[f.k]) }));
    return box;
  }

  const fieldEl = f => (f.type === 'img' || f.type === 'img2' ? imgField(f) : f.type === 'gallery' ? galField(f) : textField(f));
  const changedIn = s => s.fields.filter(f => (f.type === 'img' || f.type === 'img2' ? D.img : f.type === 'gallery' ? D.gal : D.t)?.[f.k] != null).length;

  // ---------- panels ----------
  function drawTexts() {
    const p = $('s-texts'); p.innerHTML = '<p class="sub">აირჩიეთ საიტის ნაწილი. თითო ტექსტი სამ ენაზეა: ქართული, ინგლისური, რუსული. შეცვლის შემდეგ დააჭირეთ „შენახვა“.</p>';
    secs.forEach(s => {
      const n = changedIn(s);
      const d = node(`<details class="sx" data-id="${s.id}"${openSecs.has(s.id) ? ' open' : ''}><summary><span>${esc(s.name)}</span>${n ? `<small class="chg">შეცვლილია ${n}</small>` : ''}</summary><div class="in"></div></details>`);
      d.addEventListener('toggle', () => { d.open ? openSecs.add(s.id) : openSecs.delete(s.id); if (d.open && !d.__drawn) fill(); });
      const fill = () => {
        d.__drawn = true;
        const inn = d.querySelector('.in'); let cardBox = null, cardNo = 0;
        s.fields.forEach(f => {
          if (f.card) {
            if (f.card !== cardNo) { cardNo = f.card; cardBox = node(`<div class="card2"><i class="cn">${s.id === 'near' ? 'ადგილი' : s.id === 'grounds' ? 'ფოტო ეზოში' : s.id === 'about' ? 'ციფრი' : 'ბარათი'} ${f.card}</i></div>`); inn.append(cardBox); }
            cardBox.append(fieldEl(f));
          } else { cardNo = 0; inn.append(fieldEl(f)); }
        });
      };
      if (d.open) fill();
      p.append(d);
    });
  }

  function drawRooms() {
    const p = $('s-rooms'); p.innerHTML = '<p class="sub">ნომრების აღწერა, ჩამონათვალი და ფოტოები. ფასები და ტევადობა „ფასები და სეზონი“ ჩანართშია.</p>';
    const types = Object.entries(J.types).filter(([k]) => J.ROOMS.some(r => r.type === k));
    types.forEach(([k, t]) => {
      const def = { text: tri(JC.DEF.roomText[k] || ''), feats: triList(JC.DEF.roomFeats[k] || []), photos: (JC.DEF.roomPhotos[k] || []).slice() };
      const cur = prop => (D.rooms && D.rooms[k] && D.rooms[k][prop] != null ? D.rooms[k][prop] : def[prop]);
      const put = (prop, v) => {
        D.rooms = D.rooms || {}; const o = D.rooms[k] = D.rooms[k] || {};
        if (v == null || same(v, def[prop])) delete o[prop]; else o[prop] = v;
        if (!Object.keys(o).length) delete D.rooms[k];
        if (!Object.keys(D.rooms).length) delete D.rooms;
        dirty();
      };
      const nums = J.ROOMS.filter(r => r.type === k).map(r => r.id).join(', ');
      const d = node(`<details class="sx"><summary><span>${esc(t.name)} <small class="hint">(${esc(nums)})</small></span></summary><div class="in"></div></details>`);
      const inn = d.querySelector('.in');
      const tf = (prop, label, type) => {
        const box = node(`<div class="fld"><div class="fh"><b>${label}</b><button type="button" class="lnk" data-reset hidden>თავდაპირველზე დაბრუნება</button></div>${langFields(cur(prop), { rows: type === 'list' ? 6 : 4 })}${WARN}</div>`);
        const sync = () => { box.querySelector('[data-reset]').hidden = same(cur(prop), def[prop]); box.querySelector('.warn').hidden = !stale(cur(prop), def[prop]); };
        box.addEventListener('input', e => { const i = e.target.closest('[data-l]'); if (!i) return; const v = clone(cur(prop)); v[i.dataset.l] = i.value; put(prop, v); sync(); });
        box.querySelector('[data-reset]').addEventListener('click', () => { put(prop, null); box.replaceWith(tf(prop, label, type)); });
        sync(); return box;
      };
      inn.append(tf('text', 'აღწერა'), tf('feats', 'რა არის ნომერში (თითო სტრიქონზე ერთი)', 'list'));
      const pf = node('<div class="fld"><div class="fh"><b>ფოტოები</b></div><p class="hint">პირველი ფოტო ჩანს ბარათზე, დანარჩენი — გადაფურცვლით.</p></div>');
      pf.append(galleryEditor(() => cur('photos').map(src => ({ src })), a => put('photos', a.map(x => x.src)),
        { reset: () => put('photos', null), changed: () => !!(D.rooms && D.rooms[k] && D.rooms[k].photos) }));
      inn.append(pf);
      p.append(d);
    });
  }

  function drawVideo() {
    const p = $('s-video');
    const row = (k, name) => `<div class="fld"><div class="fh"><b>${name}</b></div><input class="cin" data-v="${k}" inputmode="url" placeholder="https://www.youtube.com/watch?v=…" value="${esc((D.video || {})[k] || '')}"><p class="hint" data-vs="${k}"></p></div>`;
    p.innerHTML = `<p class="sub">ჩასვით YouTube-ის ბმული. ცარიელი ველი — საიტზე დარჩება ახლანდელი ვიდეო. ვიდეოს ხანგრძლივობის წარწერა „ტექსტები და ფოტოები“ ჩანართშია.</p>
      <div class="card2">${row('ny', 'ახალი წლის ვიდეო (ზამთარში ჩანს)')}</div><div class="card2">${row('sum', 'ზაფხულის ვიდეო (ზაფხულში ჩანს)')}</div>`;
    const status = k => {
      const v = (D.video || {})[k] || '', id = JC.youtube(v), s = p.querySelector(`[data-vs="${k}"]`);
      s.innerHTML = !v ? 'გამოიყენება საიტის ახლანდელი ვიდეო.' : id ? `<span class="okt">✓ YouTube ვიდეო ნაპოვნია</span><br><img class="yt" alt="" src="https://i.ytimg.com/vi/${id}/hqdefault.jpg">` : '<span class="bad">ეს ბმული YouTube ვიდეოდ ვერ ვიცანი.</span>';
    };
    p.oninput = e => {
      const i = e.target.closest('[data-v]'); if (!i) return;
      D.video = D.video || {}; const v = i.value.trim();
      if (v) D.video[i.dataset.v] = v; else delete D.video[i.dataset.v];
      if (!Object.keys(D.video).length) delete D.video;
      status(i.dataset.v); dirty();
    };
    status('ny'); status('sum');
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

  function drawSections() {
    const p = $('s-sections'), h = D.hide || {};
    p.innerHTML = `<p class="sub">მონიშნული ნაწილები ჩანს საიტზე. მაგალითად, ახალი წლის ვიდეოს დამალვა შეგიძლიათ, სანამ ახალს დაამატებთ.</p><div class="card2">${
      secs.filter(s => s.hideable).map(s => `<label class="chk"><input type="checkbox" data-h="${s.id}"${h[s.id] ? '' : ' checked'}><span>${esc(s.name)}</span></label>`).join('')}</div>`;
    p.onchange = e => {
      const i = e.target.closest('[data-h]'); if (!i) return;
      D.hide = D.hide || {}; if (i.checked) delete D.hide[i.dataset.h]; else D.hide[i.dataset.h] = true;
      if (!Object.keys(D.hide).length) delete D.hide;
      dirty();
    };
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

  function drawAll() { drawTexts(); drawRooms(); drawVideo(); drawContact(); drawFaq(); drawSections(); drawNear(); drawLook(); drawHistory(); }

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
      dirty(); drawHistory(); drawTexts();
      say('✓ შენახულია. საიტზე უკვე ჩანს.');
    } catch (e) { say('ვერ შეინახა: ' + (e.message || e) + '. შეამოწმეთ ინტერნეტი და სცადეთ ხელახლა.', true); dirty(); }
  }
  function undo() { if (!confirm('გავაუქმოთ ყველა შეუნახავი ცვლილება?')) return; D = clone(saved); drawAll(); dirty(); }
  function preview() {
    try { localStorage.setItem(JC.K_PREVIEW, JSON.stringify(D)); } catch (e) { return say('წინასწარი ნახვა ვერ მოხერხდა: მეხსიერება სავსეა.', true); }
    window.open('index.html?preview=1', '_blank');
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
      secs = await readPage();
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
