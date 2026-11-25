/* the hotel — scripted chatbot (no AI). Reads availability and prices from JIJI (store.js).
   The same script/flow is what Instagram and Facebook bots will follow later. */
(() => {
  const J = window.JIJI;
  // texts are Georgian keys; js/i18n.js gives EN/RU (falls back to Georgian)
  const T0 = (k, v) => (window.I18N ? window.I18N.t(k, v) : String(k).replace(/\{(\w+)\}/g, (m, x) => (v && x in v ? v[x] : m)));
  // phone and hours in texts follow admin → საიტის მართვა → კონტაქტები
  const T = (k, v) => (window.JC ? window.JC.fix(T0(k, v)) : T0(k, v));
  const C = () => (window.JC ? window.JC.contact() : { phone: '+995 500 00 00 00', waDigits: '995500000000', map: '', addrText: '', from: '10:00', to: '20:00' });
  const RN = n => T(n || '');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = {
    chat: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    send: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>'
  };

  // ---------- DOM ----------
  const fab = document.createElement('button');
  fab.className = 'jc-fab'; fab.type = 'button'; fab.innerHTML = icon.chat + '<span></span>';
  const box = document.createElement('section');
  box.className = 'jc'; box.hidden = true; 
  box.innerHTML = `
    <div class="jc-head"><div><b class="jc-hn"></b><small></small></div>
      <button class="jc-x" type="button">${icon.x}</button></div>
    <div class="jc-log" role="log" aria-live="polite"></div>
    <div class="jc-opts"></div>
    <form class="jc-in" hidden><input id="jc-input"><button type="submit">${icon.send}</button></form>`;
  document.body.append(fab, box);
  const log = box.querySelector('.jc-log'), opts = box.querySelector('.jc-opts');
  const form = box.querySelector('.jc-in'), input = form.querySelector('input');
  function labels() {
    fab.querySelector('span').textContent = T('თავისუფალი ნომრები');
    box.setAttribute('aria-label', T('ჩატი'));
    box.querySelector('.jc-hn').textContent = (window.JIJI && window.JIJI.hotel && window.JIJI.hotel.name) || '';
    box.querySelector('.jc-head small').textContent = T('ავტომატური ასისტენტი');
    box.querySelector('.jc-x').setAttribute('aria-label', T('ჩატის დახურვა'));
    input.setAttribute('aria-label', T('პასუხი'));
    form.querySelector('button').setAttribute('aria-label', T('გაგზავნა'));
  }
  labels();

  let started = false, mode = 'menu', misses = 0, ctx = {}, queue = Promise.resolve();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  const scroll = () => { log.scrollTop = log.scrollHeight; };

  // Bot messages are queued so they appear one after another with a short "typing" pause.
  function bot(html, cls = '') {
    queue = queue.then(async () => {
      const t = document.createElement('div'); t.className = 'jc-typing'; t.textContent = T('წერს…');
      log.append(t); scroll(); await wait(420); t.remove();
      const m = document.createElement('div'); m.className = 'jc-m bot ' + cls; m.innerHTML = html;
      log.append(m); scroll();
    });
    return queue;
  }
  function me(text) { const m = document.createElement('div'); m.className = 'jc-m me'; m.textContent = text; log.append(m); scroll(); }
  function options(list) {
    opts.innerHTML = '';
    queue = queue.then(() => {
      list.forEach(o => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = o.t; if (o.sub) b.className = 'sub';
        b.addEventListener('click', () => { me(o.t); opts.innerHTML = ''; setInput(null); o.f(); });
        opts.append(b);
      });
      scroll();
    });
  }
  function setInput(type, ph = '') {
    mode = type ? mode : 'menu';
    // hide now and again after queued messages, so a pending 'show' cannot bring the box back
    if (!type) { form.hidden = true; input.value = ''; queue = queue.then(() => { form.hidden = true; input.value = ''; }); return; }
    queue = queue.then(() => {
      form.hidden = false; input.type = type; input.value = ''; input.placeholder = ph;
      input.min = type === 'date' ? J.today() : '';
      input.inputMode = type === 'tel' ? 'tel' : '';
      input.focus({ preventScroll: true });
    });
  }
  const nav = () => [{ t: T('მენიუ'), f: menu, sub: true }];

  // ---------- flow ----------
  function start() {
    bot(T('გამარჯობა! სასტუმროში მოგესალმებით.\nთავისუფალ ნომრებს და ფასს წამებში გეტყვით.'));
    menu();
  }
  // price ranges per room type: this season, and the next one if it starts soon
  function prices() {
    const tb = J.priceTable().slice(0, 1);
    const range = r => r.min === r.max ? r.min + ' ₾' : r.min + '–' + r.max + ' ₾';
    bot(`<b>${T('ფასები ერთ ღამეზე')}</b>\n` + tb.map(x => '\n' + x.rows.map(r => `• ${esc(RN(r.name))}: ${range(r)}`).join('\n')).join('\n') + `\n\n${T('ფასი დამოკიდებულია სტუმრების რაოდენობაზე. ზუსტ ფასს თარიღების არჩევის შემდეგ ნახავთ.')}`);
    options([{ t: T('თავისუფალი ნომრები და ფასი'), f: askDate }, ...nav()]);
  }
  function menu() {
    mode = 'menu'; ctx = {};
    bot(T('რით დაგეხმაროთ?'));
    options([
      { t: T('💰 მიმდინარე ფასები'), f: prices },
      { t: T('თავისუფალი ნომრები და ფასი'), f: askDate },
      ...(J.gaps().length ? [{ t: T('✨ სპეციალური შეთავაზებები'), f: deals }] : []),
      { t: T('სად ვართ'), f: location },
      { t: T('ხშირი კითხვები'), f: faq },
      { t: T('სასტუმროსთან დაკავშირება'), f: contact }
    ]);
  }
  // ---------- inline calendar: tap check-in, then check-out ----------
  const MONTHS_KA = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
  const months = () => (window.I18N ? window.I18N.months() : MONTHS_KA);
  const week = () => (window.I18N ? window.I18N.week() : ['ორ', 'სმ', 'ოთ', 'ხთ', 'პრ', 'შბ', 'კვ']);
  // availability from confirmed bookings only (a request does not hold a room)
  const freeN = d => J.ROOMS.filter(r => J.roomFree(r.id, d, J.addDays(d, 1))).length;
  function lastOut(a) { // latest departure when arriving on a: one room free every night
    let best = a;
    for (const r of J.ROOMS) {
      if (!J.roomFree(r.id, a, J.addDays(a, 1))) continue;
      let d = J.addDays(a, 1), k = 1;
      while (k < 30 && J.roomFree(r.id, d, J.addDays(d, 1))) { d = J.addDays(d, 1); k++; }
      if (d > best) best = d;
    }
    return best;
  }
  // a month calendar in `wrap`: full nights are crossed out, after the arrival day only reachable departures stay open
  function calendar(wrap, { from = null, to = null, onPick, scrollBox = null, button } = {}) {
    const t = J.today(); let a = from, b = to;
    let y = +(a || t).slice(0, 4), m = +(a || t).slice(5, 7) - 1;
    const pad = n => String(n).padStart(2, '0');
    function draw(initial) {
      const keep = scrollBox ? scrollBox.scrollTop : 0;
      const MONTHS_FULL = months();
      const first = new Date(Date.UTC(y, m, 1)), lead = (first.getUTCDay() + 6) % 7, dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const atStart = y === +t.slice(0, 4) && m === +t.slice(5, 7) - 1;
      const live = J.mode !== 'offline', limit = a && !b && live ? lastOut(a) : null;
      let cells = '';
      for (let i = 0; i < lead; i++) cells += '<span></span>';
      for (let d = 1; d <= dim; d++) {
        const s = `${y}-${pad(m + 1)}-${pad(d)}`, past = s < t, n = past || !live ? -1 : freeN(s);
        let off = past;
        if (!past && live) off = a && !b ? (s > a ? s > limit : s < a && n === 0) : n === 0;
        if (s === a || s === b) off = false; // chosen days can always be tapped to clear them
        const cls = [s === a ? 'a' : '', s === b ? 'b' : '', a && b && s > a && s < b ? 'in' : '', s === t ? 'td' : '', n === 0 && !(a && !b && s > a && s <= limit) ? 'full' : ''].join(' ');
        cells += `<button type="button" data-d="${s}" class="${cls}" ${off ? 'disabled' : ''} aria-label="${d} ${MONTHS_FULL[m]}${n === 0 ? ', ' + T('დაკავებულია') : ''}">${d}</button>`;
      }
      const n = a && b ? J.nights(a, b) : 0;
      const status = !a ? T('შესვლის დღე') : !b ? (limit && limit > a ? T('ახლა გასვლის დღე') + ' · ' + T('შეიძლება {d}-მდე', { d: J.fmt(limit) }) : T('ახლა გასვლის დღე')) : T('{d} · {n} ღამე', { d: J.fmtRange(a, b), n });
      wrap.innerHTML = `<div class="jc-cal-h"><button type="button" data-nav="-1" aria-label="${T('წინა თვე')}" ${atStart ? 'disabled' : ''}>‹</button><b>${MONTHS_FULL[m]} ${y}</b><button type="button" data-nav="1" aria-label="${T('შემდეგი თვე')}">›</button></div>
        <div class="jc-cal-w">${week().map(w => `<span>${w}</span>`).join('')}</div>
        <div class="jc-cal-g">${cells}</div>
        ${live ? `<div class="jc-cal-l"><span><i class="l-ok"></i>${T('თავისუფალია')}</span><span><i class="l-full"></i>${T('დაკავებულია')}</span></div>` : ''}
        <div class="jc-cal-s">${status}</div>
        <div class="jc-cal-nav"><button type="button" data-nav="-1" ${atStart ? 'disabled' : ''}>‹ ${MONTHS_FULL[(m + 11) % 12]}</button><button type="button" data-nav="1">${MONTHS_FULL[(m + 1) % 12]} ›</button></div>
        <button type="button" class="jc-cal-ok" ${n ? '' : 'disabled'}>${button || T('გაგრძელება')}</button>`;
      if (scrollBox) {
        // keep the calendar where the guest is looking; only the first render scrolls it into view
        scrollBox.scrollTop = initial ? Math.max(0, wrap.offsetTop - 8) : keep;
        if (!initial && scrollBox.scrollTop > wrap.offsetTop) scrollBox.scrollTop = wrap.offsetTop - 8;
      }
    }
    wrap.addEventListener('click', e => {
      const nav = e.target.closest('[data-nav]'), day = e.target.closest('[data-d]'), go = e.target.closest('.jc-cal-ok');
      if (nav) { m += +nav.dataset.nav; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } draw(); if (scrollBox) scrollBox.scrollTop = Math.max(0, wrap.offsetTop - 8); return; }
      if (day) {
        const s = day.dataset.d;
        // tapping a chosen day again clears it
        if (s === b) b = null; else if (s === a) { a = null; b = null; }
        else if (!a || b || s < a) { a = s; b = null; } else b = s;
        draw(); return;
      }
      if (go && a && b) onPick(a, b);
    });
    draw(true);
    return { redraw: () => draw() };
  }

  function askDate() {
    if (J.mode === 'offline') return offline();
    bot(T('აირჩიეთ შესვლისა და გასვლის დღეები კალენდარში.'));
    queue = queue.then(() => {
      const wrap = document.createElement('div'); wrap.className = 'jc-m bot jc-cal';
      log.append(wrap);
      calendar(wrap, { scrollBox: log, onPick: (a, b) => {
        wrap.querySelectorAll('button').forEach(x => x.disabled = true); wrap.classList.add('done');
        me(T('{d} · {n} ღამე', { d: J.fmtRange(a, b), n: J.nights(a, b) })); opts.innerHTML = '';
        ctx.from = a; ctx.n = J.nights(a, b); askGuests();
      } });
    });
    options(nav());
  }
  // adults first, then children under 10 (they take places too; the hotel sees them apart)
  function askGuests() {
    bot(T('რამდენი ზრდასრულია? (13 წლიდან)'));
    options([
      ...[1, 2, 3, 4, 5, 6, 7].map(n => ({ t: String(n), f: () => askKids(n, 7, g => askBabies(() => check(g))) })),
      { t: T('8 ან მეტი'), f: group }, ...nav()
    ]);
  }
  function askKids(adults, max, then) {
    ctx.adults = adults;
    if (adults >= max) { ctx.kids = 0; return then(adults); }
    bot(T('და რამდენი ბავშვი (2–12 წლის)?'));
    options([
      { t: T('ბავშვის გარეშე'), f: () => { ctx.kids = 0; then(adults); } },
      ...Array.from({ length: max - adults }, (_, i) => i + 1).map(k => ({ t: String(k), f: () => { ctx.kids = k; then(adults + k); } })), ...nav()
    ]);
  }
  // infants under 2 stay free; the hotel sees them in the booking
  function askBabies(then) {
    bot(T('ჩვილები (2 წლამდე)? ისინი უფასოა.'));
    options([{ t: T('ჩვილის გარეშე'), f: () => { ctx.babies = 0; then(); } },
      ...[1, 2, 3].map(k => ({ t: String(k), f: () => { ctx.babies = k; then(); } })), ...nav()]);
  }
  // the price with the hotel's child rule (free / fixed for 2–12), the same the server stores
  const priced = (type, from, to, g) => (J.kidPrice ? J.kidPrice(type, from, to, g, ctx.kids || 0, (window.V2_RULES || {}).kids || null) : J.quote(type, from, to, g));
  function offerHtml(from, to, n, g, o) {
    return `${T('{d} · {n} ღამე · {g} სტუმარი', { d: J.fmtRange(from, to), n, g })}\n${T('თავისუფალია: {room} ნომერი', { room: esc(RN(o.name)) })}<strong>${o.total} ₾</strong>${T('სანიმუშო ფასი')}`;
  }
  function check(g) {
    if (J.mode === 'offline') return offline();
    ctx.g = g; ctx.to = J.addDays(ctx.from, ctx.n);
    const hit = J.deals().find(x => x.from === ctx.from && x.to === ctx.to && J.rateFor(x.type, g) && (x.price || x.pct));
    if (hit) { ctx.gap = hit; gapGuests(g); return; }
    const o0 = J.findOffer(ctx.from, ctx.to, g), o = o0 && { ...o0, total: priced(o0.type, ctx.from, ctx.to, g) };
    if (o) {
      ctx.offer = o;
      bot(offerHtml(ctx.from, ctx.to, ctx.n, g, o), 'offer');
      options([...bookOpts(), { t: T('სხვა თარიღი'), f: askDate }, ...nav()]);
      return;
    }
    // Too many people for one room: offer two rooms together.
    if (!J.fitsOne(g)) {
      const grp = J.groupOffer(ctx.from, ctx.to, g);
      if (!grp) {
        bot(T('{g} სტუმრისთვის ამ თარიღებზე ორი თავისუფალი ნომერი არ გვაქვს. დაგვიკავშირდით და გამოსავალს ერთად მოვძებნით.', { g }));
        options([{ t: T('სასტუმროსთან დაკავშირება'), f: contact }, { t: T('სხვა თარიღი'), f: askDate }, ...nav()]);
        return;
      }
      const [x, y] = grp.parts;
      bot(`<b>${T('{g} სტუმარი ერთ ნომერში არ ეტევა. შეგვიძლია შემოგთავაზოთ ორი ნომერი:', { g })}</b>
${esc(RN(x.name))} · ${T('{n} სტუმარი', { n: x.guests })}
${esc(RN(y.name))} · ${T('{n} სტუმარი', { n: y.guests })}<strong>${grp.total} ₾</strong>${T('სანიმუშო ფასი')}`, 'offer');
      options([{ t: T('ჯავშნის მოთხოვნა'), f: () => { ctx.split = grp.parts; ctx.offer = { name: RN(x.name) + ' + ' + RN(y.name), total: grp.total }; askName(); } }, { t: T('სხვა თარიღი'), f: askDate }, ...nav()]);
      return;
    }
    // Not all nights are free: suggest what is possible instead of a plain "no".
    const part = J.partialOffer(ctx.from, ctx.to, g);
    const split = J.splitOffer(ctx.from, ctx.to, g);
    const nx = J.nextOffer(ctx.from, ctx.n, g);
    if (!part && !split && !nx) {
      bot(T('ამ პერიოდში ადგილი აღარ გვაქვს. დაგვიკავშირდით და იქნებ მაინც მოგიძებნოთ გამოსავალი.'));
      options([{ t: T('სასტუმროსთან დაკავშირება'), f: contact }, { t: T('სხვა თარიღი'), f: askDate }, ...nav()]);
      return;
    }
    bot(T('{d} ({n} ღამე) {g} სტუმრისთვის მთლიანად თავისუფალი არ გვაქვს, მაგრამ შეგვიძლია შემოგთავაზოთ:', { d: J.fmtRange(ctx.from, ctx.to), n: ctx.n, g }));
    const opts = [];
    if (split) {
      bot(`<b>${T('მთელი {n} ღამე, ნომრის გამოცვლით', { n: ctx.n })}</b>
${split.parts.map(x => `${J.fmtRange(x.from, x.to)} · ${esc(RN(x.name))} · ${T('{n} ღამე', { n: J.nights(x.from, x.to) })}`).join('\n')}<strong>${split.total} ₾</strong>${T('სანიმუშო ფასი')}`, 'offer');
      opts.push({ t: T('მთელი {n} ღამე', { n: ctx.n }), f: () => { ctx.split = split.parts; ctx.offer = { name: split.parts.map(x => RN(x.name)).join(' → '), total: split.total }; askName(); } });
    }
    if (part) {
      bot(`<b>${T('{n} ღამიდან {k} ღამე თავისუფალია', { n: ctx.n, k: part.n })}</b>
${J.fmtRange(part.from, part.to)} · ${esc(RN(part.name))}<strong>${part.total} ₾</strong>${T('სანიმუშო ფასი')}`, 'offer');
      opts.push({ t: T('{k} ღამე: {d}', { k: part.n, d: J.fmtRange(part.from, part.to) }), f: () => { ctx.from = part.from; ctx.to = part.to; ctx.offer = part; delete ctx.split; askName(); } });
    }
    if (nx) {
      bot(`<b>${T('სრული {n} ღამე სხვა თარიღებში', { n: ctx.n })}</b>
${J.fmtRange(nx.from, nx.to)} · ${esc(RN(nx.name))}<strong>${nx.total} ₾</strong>${T('სანიმუშო ფასი')}`, 'offer');
      opts.push({ t: `${J.fmtRange(nx.from, nx.to)}`, f: () => { ctx.from = nx.from; ctx.to = nx.to; ctx.offer = nx; delete ctx.split; askName(); } });
    }
    options([...opts, { t: T('სხვა თარიღი'), f: askDate, sub: true }, { t: T('დაკავშირება'), f: contact, sub: true }]);
  }
  // ---------- short free windows between bookings, with the gap discount ----------
  const maxGuests = type => Math.max(0, ...(J.types[type]?.rates || []).map(r => r.guests));
  // short offers: one per type, dates and price (several equal rooms show once)
  function uniqGaps() {
    const seen = new Set();
    return J.deals().filter(g => { const k = [g.type, g.from, g.to, g.price, g.pct, g.kind].join('|'); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
  }
  const dealTag = g => (g.kind === 'promo' ? '🎁 ' + T('აქცია') + (g.label ? ' · ' + esc(g.label) : '') : g.price ? T('სპეციალური ფასი') : g.pct ? `−${g.pct}%` : '');
  function deals() {
    if (J.mode === 'offline') return offline();
    const list = uniqGaps();
    if (!list.length) { bot(T('ამჟამად სპეციალური შეთავაზება არ გვაქვს. ნახეთ თავისუფალი თარიღები კალენდარში.')); options([{ t: T('თავისუფალი ნომრები'), f: askDate }, ...nav()]); return; }
    bot(`<b>${T('✨ სპეციალური შეთავაზებები')}</b>\n${T('შერჩეული თარიღები სპეციალურ ფასად. ადგილები შეზღუდულია.')}`);
    list.forEach(g => bot(`<b>${T('{d} · {n} ღამე', { d: J.fmtRange(g.from, g.to), n: g.n })}</b>${dealTag(g) ? ` · ${dealTag(g)}` : ''}\n${T('{room} · {g} სტუმრამდე', { room: esc(RN(J.types[g.type].name)), g: maxGuests(g.type) })}<strong>${g.price ? `${g.price} ₾` : T('{p} ₾-დან', { p: J.dealTotal(g, 1) })}</strong>${T('სანიმუშო ფასი')}`, 'offer'));
    options([...list.map(g => ({ t: `${J.fmtRange(g.from, g.to)} · ${RN(J.types[g.type].name)}`, f: () => pickGap(g) })), ...nav()]);
  }
  function pickGap(g) {
    ctx.gap = g; ctx.from = g.from; ctx.to = g.to; ctx.n = g.n;
    bot(T('რამდენი ზრდასრულია? (13 წლიდან)'));
    const cap = Math.min(maxGuests(g.type), 7);
    options([...Array.from({ length: cap }, (_, i) => i + 1).map(n => ({ t: String(n), f: () => askKids(n, cap, gapGuests) })), ...nav()]);
  }
  function gapGuests(n) {
    const g = ctx.gap; ctx.g = n;
    const total = J.dealTotal(g, n), name = RN(J.types[g.type].name), full = J.quote(g.type, g.from, g.to, n);
    ctx.offer = { type: g.type, name, total, note: J.dealNote(g), deal: g.key };
    bot(`${T('{d} · {n} ღამე · {g} სტუმარი', { d: J.fmtRange(g.from, g.to), n: g.n, g: n })}\n${esc(name)}<strong>${total} ₾</strong>${total < full ? T('ჩვეულებრივ {p} ₾ · ', { p: full }) : ''}${T('სანიმუშო ფასი')}`, 'offer');
    options([...bookOpts(), { t: T('სხვა შეთავაზება'), f: deals }, ...nav()]);
  }
  // the booking server did not answer: never guess availability
  function offline() {
    bot(T('ახლა თავისუფალი ნომრების შემოწმება ვერ ხერხდება. სცადეთ ცოტა ხანში ან დაგვირეკეთ: {ph}', { ph: C().phone }));
    options([{ t: T('სასტუმროსთან დაკავშირება'), f: contact }, ...nav()]);
  }
  function group() {
    bot(T('8 და მეტი სტუმრისთვის რამდენიმე ნომერს გავაერთიანებთ. ამას სასტუმრო პირადად შეგითანხმებთ.'));
    contact(true);
  }
  // how the guest books: where the hotel turned instant booking on — book right here or on the booking form;
  // elsewhere a request the hotel confirms
  const INST = () => !!window.V2_INSTANT;
  // the guest's booking link: this page with its own query (such as ?h=) kept, plus b and k
  function bookLink(id, key) {
    const u = new URL(window.location.href); u.hash = '';
    u.searchParams.set('b', id); u.searchParams.set('k', key);
    return u.toString();
  }
  function bookOpts() {
    if (!INST()) return [{ t: T('ჯავშნის მოთხოვნა'), f: askName }];
    return [{ t: T('✓ დაჯავშნა ახლავე'), f: () => { ctx.instant = true; askName(); } },
      { t: T('ჯავშნის გვერდზე გადასვლა'), f: toPage, sub: true }];
  }
  function toPage() {
    if (typeof window.V2_GOBOOK === 'function') { box.hidden = true; fab.hidden = false; window.V2_GOBOOK(ctx.from, ctx.to, ctx.g, ctx.kids || 0); return; }
    window.location.hash = 'book';
  }
  function askName() {
    if (ctx.instant && !ctx.split) {
      const r = window.V2_RULES || {};
      bot(`<b>${T('ჯავშანი დადასტურდება მაშინვე, ნომერი თქვენი იქნება.')}</b>${r.cancel ? `\n${T('გაუქმება')}: ${esc(r.cancel)}` : ''}${r.prepay ? `\n${T('წინასწარი გადახდა')}: ${esc(r.prepay)}` : ''}\n${window.V2_PAY ? T('დაჯავშნით ეთანხმებით სასტუმროს წესებს. ნომერი {m} წუთით დაგიკავდებათ, სანამ სასტუმროს ბანკის გვერდზე გადაიხდით ({part}). ფული პირდაპირ სასტუმროს ანგარიშზე შედის.', { m: window.V2_PAY.min, part: window.V2_PAY.part }) : T('დაჯავშნით ეთანხმებით სასტუმროს წესებს. ბარათი არ გჭირდებათ.')}`);
      bot(T('თქვენი სახელი?')); mode = 'name'; setInput('text', T('სახელი')); options(nav()); return;
    }
    ctx.instant = false;
    bot(T('ეს ჯავშნის მოთხოვნაა: ნომერი თქვენთვის დაიჯავშნება მას შემდეგ, რაც სასტუმრო დაგიკავშირდებათ და დაადასტურებს. გადახდა საჭირო არ არის.')); bot(T('თქვენი სახელი?')); mode = 'name'; setInput('text', T('სახელი')); options(nav()); }
  function askPhone() { bot(T('ტელეფონის ნომერი, რომ დაგიკავშირდეთ?')); mode = 'phone'; setInput('tel', '+995 5…'); options(nav()); }
  // send the request; it counts as sent only when the server confirms it (with automatic retries)
  async function finish(retry) {
    const job = retry || {
      parts: kidsOver((ctx.split || [{ from: ctx.from, to: ctx.to, type: ctx.offer.type }]).map(p => ({ ...p })), ctx.kids || 0, ctx.g),
      deal: !ctx.split && ctx.offer.note && ctx.offer.deal ? ctx.offer.deal : null,
      g: ctx.g, name: ctx.name, phone: ctx.phone, offerName: ctx.offer.name, total: ctx.offer.total, instant: !!ctx.instant && !ctx.split, babies: ctx.babies || 0
    };
    ctx.instant = false;
    delete ctx.split; delete ctx.gap;
    mode = 'menu'; setInput(null); opts.innerHTML = '';
    if (navigator.onLine === false) return sendFailed(job, true);
    bot(T('იგზავნება…'));
    const todo = job.parts.filter(p => !p.sent);
    const res = await Promise.all(todo.map(p => J.createRequest({ from: p.from, to: p.to, guests: p.guests || job.g, children: p.kids || 0, name: job.name, phone: job.phone, source: 'chat', type: p.type, instant: job.instant, kidRule: (window.V2_RULES || {}).kids || null, wish: job.babies ? T('{n} ჩვილი (2 წლამდე)', { n: job.babies }) : '', ...(job.deal ? { deal: job.deal } : {}) }).saved));
    res.forEach((r, i) => { if (r && r.ok) todo[i].sent = true; });
    if (job.parts.some(p => !p.sent)) return sendFailed(job, res.some(r => r && r.offline), (res.find(r => r && !r.ok && r.msg) || {}).msg);
    const r = { from: job.parts[0].from, to: job.parts[job.parts.length - 1].to };
    const done = res[0] || {};
    if (job.instant && done.instant && done.pay) {
      // the room is held; the guest pays on the hotel's bank page, then comes back to their booking link
      bot(`<b>${T('✓ ნომერი თქვენთვის დაკავებულია {m} წუთით.', { m: done.payMinutes || 20 })}</b>\n${J.fmtRange(r.from, r.to)} · ${esc(RN(done.typeName || job.offerName))}\n${T('ახლა გადასახდელია')}: <b>${done.payAmount} ₾</b>\n\n${T('ჯავშანი დადასტურდება გადახდისთანავე.')}\n<a class="jc-pay" href="${esc(done.pay)}">${T('გადახდა ბანკის გვერდზე')}</a>`);
      options(nav()); return;
    }
    if (job.instant && done.instant && done.key) {
      const link = bookLink(done.id, done.key);
      bot(`<b>${T('✓ დაჯავშნილია! ჯავშანი დადასტურებულია.')}</b>\n${J.fmtRange(r.from, r.to)} · ${esc(RN(done.typeName || job.offerName))} · ${done.total || job.total} ₾\n${T('ჯავშნის ნომერი')}: <b>${esc(String(done.id).slice(-6).toUpperCase())}</b>${(window.V2_RULES || {}).prepay ? `\n${T('წინასწარი გადახდა')}: ${esc(window.V2_RULES.prepay)}` : ''}${(window.V2_RULES || {}).cancel ? `\n${T('გაუქმება')}: ${esc(window.V2_RULES.cancel)}` : ''}\n\n${T('შეინახეთ ბმული: მასზე ნებისმიერ დროს ნახავთ თქვენს ჯავშანს.')}\n<a href="${esc(link)}">${T('ჩემი ჯავშანი')}</a>`);
      options(nav()); return;
    }
    if (job.instant) bot(T('ეს ნომერი ახლახან დაიჯავშნა, ამიტომ მოთხოვნა გაიგზავნა. სასტუმრო მალე დაგიკავშირდებათ.'));
    bot(`<b>${T('✓ მოთხოვნა გაიგზავნა. ეს ჯერ არ არის დადასტურებული ჯავშანი.')}</b>\n${J.fmtRange(r.from, r.to)} · ${esc(RN(job.offerName))} · ${job.total} ₾\n\n${T('ჯავშნის დასასრულებლად სასტუმრო დაგიკავშირდებათ ნომერზე {ph}. სანამ არ დაგიდასტურებთ, ნომერი თქვენთვის დაკავებული არ არის.', { ph: esc(job.phone) })}`);
    options(nav());
  }
  // children go with the stay: the same in every part of a room change, split over rooms in a group
  function kidsOver(parts, kids, g) {
    const sameStay = parts.every(p => !p.guests);
    let left = kids;
    parts.forEach(p => { const room = p.guests || g; p.kids = sameStay ? Math.min(kids, room - 1) : Math.min(left, room - 1); if (!sameStay) left -= p.kids; });
    return parts;
  }
  const SEND_ERR = {'bad dates':'თარიღი არასწორია ან უკვე გავიდა. აირჩიეთ სხვა თარიღი.','too long':'ერთ მოთხოვნაში მაქსიმუმ 30 ღამეა.','name and phone required':'შეამოწმეთ სახელი და ტელეფონის ნომერი.'};
  function sendFailed(job, offline, msg) {
    const why = !offline && msg ? (SEND_ERR[msg] ? T(SEND_ERR[msg]) + '\n' : `<small>(${esc(String(msg).slice(0, 160))})</small>\n`) : '';
    bot(`<b>${T('❌ მოთხოვნა ვერ გაიგზავნა.')}</b>\n${why}${offline ? T('ინტერნეტთან კავშირი არ არის. შეამოწმეთ კავშირი და სცადეთ ხელახლა, თქვენი მონაცემები შენახულია.') : T('სცადეთ ხელახლა ან დაგვირეკეთ: {ph}', { ph: esc(C().phone) })}`);
    options([{ t: T('ხელახლა გაგზავნა'), f: () => finish(job) }, { t: T('დაკავშირება'), f: contact, sub: true }, ...nav()]);
  }
  function location() {
    bot(`${esc(C().addrText)}\n${T('კოხტას საბაგირო 300 მეტრშია, დიდველის საბაგირო 2,9 კმ-ში. მაღაზიები და აფთიაქი ფეხით მისასვლელზეა.')}\n<a href="${esc(C().map)}" target="_blank" rel="noopener">${T('რუკაზე ნახვა')}</a>`);
    options([{ t: T('თავისუფალი ნომრები'), f: askDate }, ...nav()]);
  }
  function faq() {
    bot(T('აირჩიეთ კითხვა:'));
    options((window.JC ? window.JC.faq() : []).map(({ q, a }) => ({ t: q, f: () => { bot(esc(a)); options([{ t: T('სხვა კითხვა'), f: faq }, { t: T('თავისუფალი ნომრები'), f: askDate }, ...nav()]); } })).concat(nav()));
  }
  function contact(silent) {
    if (silent !== true) bot(T('სასტუმროს ადმინისტრაცია გიპასუხებთ.'));
    const c = C();
    bot(`${T('ტელეფონი: {ph}\nყოველდღე 10:00–20:00', { ph: c.phone })}\n<a href="https://wa.me/${c.waDigits}" target="_blank" rel="noopener">${T('WhatsApp-ზე მიწერა')}</a>`);
    options(nav());
  }

  // ---------- typed input ----------
  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = input.value.trim(); if (!v) return;
    input.value = '';
    if (mode === 'name') { me(v); ctx.name = v; askPhone(); return; }
    if (mode === 'phone') {
      me(v);
      if (v.replace(/\D/g, '').length < 9) { bot(T('ნომერი მოკლეა, გთხოვთ სრულად ჩაწეროთ.')); setInput('tel', '+995 5…'); return; }
      ctx.phone = v; finish(); return;
    }
    me(v); misses++;
    if (misses >= 2) { misses = 0; bot(T('ვერ გავიგე. სასტუმროსთან დაგაკავშირებთ.')); contact(true); }
    else { bot(T('ვერ გავიგე. აირჩიეთ ერთ-ერთი ღილაკი.')); menu(); }
  });
  // In menu mode a typed message is allowed too (counts as a miss), so keep the input visible there.
  const openChat = () => {
    box.hidden = false; fab.hidden = true;
    if (!started) { started = true; start(); }
  };
  fab.addEventListener('click', openChat);
  J.ready?.then(labels); // the hotel's own name once its data has loaded
  box.querySelector('.jc-x').addEventListener('click', () => { box.hidden = true; fab.hidden = false; fab.focus(); });
  // a new language starts the conversation again in that language
  window.I18N?.onChange(() => {
    labels();
    if (!started) return;
    queue = Promise.resolve(); log.innerHTML = ''; opts.innerHTML = ''; setInput(null); mode = 'menu'; ctx = {};
    start();
  });
  window.JIJIChat = { open: openChat, calendar };
})();
