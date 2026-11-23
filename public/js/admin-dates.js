/* Villa JIJI admin — choosing dates with availability in view.
   pickDates({from, to, guests, ignoreId, room}) opens a month calendar where every day shows how many rooms are free
   that night (or whether the given room is free). Full days cannot be chosen, and after picking the arrival day,
   departure days beyond the first night with no free room are closed. Resolves to {from, to} or null. */
(() => {
  const J = window.JIJI, $ = id => document.getElementById(id);
  const WD = ['ორ', 'სმ', 'ოთ', 'ხთ', 'პრ', 'შბ', 'კვ'];
  const MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const dlg = document.createElement('dialog');
  dlg.id = 'dpick'; dlg.className = 'dpick';
  dlg.innerHTML = `<div class="dp-in">
    <div class="dp-head"><button type="button" class="dp-nav" data-m="-1" aria-label="წინა თვე">‹</button><b id="dpTitle"></b><button type="button" class="dp-nav" data-m="1" aria-label="შემდეგი თვე">›</button></div>
    <p class="dp-hint" id="dpHint"></p>
    <div class="dp-grid" id="dpGrid"></div>
    <div class="dp-leg"><span><i class="lg ok"></i>თავისუფალია</span><span><i class="lg few"></i>ცოტაა</span><span><i class="lg full"></i>სავსეა</span></div>
    <div class="dp-sum" id="dpSum"></div>
    <div class="dp-act"><button type="button" class="btn" id="dpCancel">გაუქმება</button><button type="button" class="btn pri" id="dpOk" disabled>არჩევა</button></div>
  </div>`;
  document.body.append(dlg);

  let o = null, view = '', a = '', b = '', done = null;
  const rooms = () => J.ROOMS.filter(r => (o.room ? r.id === o.room : (J.types[r.type]?.cap || 99) >= (o.guests || 1)));
  const freeNight = (r, d) => J.roomFree(r.id, d, J.addDays(d, 1), o.ignoreId);
  const freeCount = d => rooms().filter(r => freeNight(r, d)).length;
  // last possible departure day when arriving on s: one room must be free every night
  function maxEnd(s) {
    let best = s;
    for (const r of rooms()) {
      if (!freeNight(r, s)) continue;
      let d = J.addDays(s, 1), n = 1;
      while (n < 60 && freeNight(r, d)) { d = J.addDays(d, 1); n++; }
      if (d > best) best = d;
    }
    return best;
  }
  const freeRoomsFor = (s, e) => rooms().filter(r => J.roomFree(r.id, s, e, o.ignoreId)).map(r => r.id);

  function draw() {
    const y = +view.slice(0, 4), m = +view.slice(5, 7) - 1;
    $('dpTitle').textContent = MONTHS[m] + ' ' + y;
    const first = new Date(Date.UTC(y, m, 1)), len = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const lead = (first.getUTCDay() + 6) % 7, t = J.today(), total = rooms().length;
    const limit = a && !b ? maxEnd(a) : null;
    let h = WD.map(w => `<span class="dp-wd">${w}</span>`).join('') + '<span></span>'.repeat(lead);
    for (let i = 1; i <= len; i++) {
      const d = `${view.slice(0, 8)}${String(i).padStart(2, '0')}`, n = d < t ? 0 : freeCount(d);
      let cls = d < t ? 'past' : n === 0 ? 'full' : n <= Math.max(1, Math.ceil(total / 4)) ? 'few' : 'ok', dis;
      if (d < t) dis = true;
      // choosing the departure: up to the first night with no room; an earlier day starts over as the arrival
      else if (a && !b) dis = d > a ? d > limit : d === a ? false : n === 0;
      else dis = n === 0;
      if (d === a || d === b) dis = false; // chosen days can always be tapped to clear them
      const sel = d === a || d === b, inr = a && b && d > a && d < b;
      h += `<button type="button" class="dp-d ${cls}${sel ? ' sel' : ''}${inr ? ' in' : ''}" data-d="${d}"${dis ? ' disabled' : ''}><b>${i}</b><small>${d < t ? '' : o.room ? (n ? '✓' : '✕') : n}</small></button>`;
    }
    $('dpGrid').innerHTML = h;
    $('dpHint').textContent = a && b ? 'თარიღი არჩეულია. თავიდან ასარჩევად დააჭირეთ სხვა დღეს.' : !a ? (o.room ? `ნომერი ${o.room}: ✓ თავისუფალია, ✕ დაკავებულია. აირჩიეთ შესვლის დღე.` : `ციფრი = რამდენი ნომერია თავისუფალი იმ ღამეს (${o.guests || 1} სტუმარზე). აირჩიეთ შესვლის დღე.`)
      : `აირჩიეთ გასვლის დღე. შეიძლება ${J.fmt(limit)}-მდე.`;
    if (a && b) {
      const fr = freeRoomsFor(a, b);
      $('dpSum').innerHTML = `<b>${J.fmtRange(a, b)}</b> · ${J.nights(a, b)} ღამე<br>${fr.length ? `თავისუფალი ნომრები: ${fr.map(esc).join(', ')}` : '<span class="bad">მთელ პერიოდზე ერთი ნომერი თავისუფალი არ არის</span>'}`;
      $('dpOk').disabled = !fr.length;
    } else { $('dpSum').innerHTML = a ? `შესვლა: <b>${J.fmt(a)}</b>` : ''; $('dpOk').disabled = true; }
  }

  dlg.addEventListener('click', e => {
    const nav = e.target.closest('[data-m]');
    if (nav) { const y = +view.slice(0, 4), m = +view.slice(5, 7) - 1 + +nav.dataset.m, dt = new Date(Date.UTC(y, m, 1)); view = dt.toISOString().slice(0, 10); draw(); return; }
    const d = e.target.closest('[data-d]')?.dataset.d;
    if (d) {
      if (d === b) b = ''; else if (d === a) { a = ''; b = ''; } // tapping a chosen day again clears it
      else if (!a || b || d < a) { a = d; b = ''; } else b = d;
      draw(); return;
    }
    if (e.target.id === 'dpCancel') { dlg.close(); done && done(null); done = null; }
    if (e.target.id === 'dpOk' && a && b) { dlg.close(); done && done({ from: a, to: b }); done = null; }
  });
  dlg.addEventListener('cancel', () => { done && done(null); done = null; });

  window.pickDates = opts => new Promise(res => {
    o = opts || {}; a = o.from || ''; b = o.to || ''; done = res;
    view = (a && a >= J.today() ? a : J.today()).slice(0, 8) + '01';
    draw();
    dlg.setAttribute('tabindex', '-1'); dlg.showModal(); dlg.focus({ preventScroll: true });
  });
})();
