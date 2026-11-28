/* Villa JIJI admin — გუნდი (only the main admin): staff accounts with their sections, and the activity journal. */
(() => {
  const J = window.JIJI, $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PERMS = { book: 'ჯავშნები', money: 'შემოსავალი', price: 'ფასები, სეზონი და სერვისები', site: 'საიტის მართვა', clean: 'დალაგება' };
  const PHELP = { book: 'დღეს, მოთხოვნები, კალენდარი, სტუმრები, გადახდების მიღება', money: 'შემოსავლების ჩანართი და ანგარიშები', price: 'ფასები, სეზონი, მოკლე ფანჯრების ფასდაკლება', site: 'ტექსტები, ფოტოები, ვიდეო, კონტაქტები, კითხვები', clean: 'რომელი ნომერია დასალაგებელი; სტუმრების სახელები და თანხები არ ჩანს' };
  const VERB = {
    remark: 'შეცვალა ჩვენი შენიშვნა', edit: 'შეცვალა თარიღი ან სტუმრები', confirm: 'დაადასტურა ჯავშანი', decline: 'უარყო მოთხოვნა', add: 'დაამატა ჯავშანი', remove: 'წაშალა ჯავშანი', restore: 'აღადგინა ჯავშანი',
    purge: 'სამუდამოდ წაშალა ჯავშანი', wipe: 'გაასუფთავა ყველა ჯავშანი და ჟურნალი', price: 'შეცვალა ჯავშნის ფასი', pay: 'მიიღო გადახდა', unpay: 'წაშალა გადახდა', move: 'გადაიყვანა სხვა ნომერში',
    guestnote: 'შეცვალა სტუმრის შენიშვნა', rates: 'შეცვალა ფასები', setting: 'შეცვალა პარამეტრი', site: 'შეცვალა საიტი', login: 'შევიდა პანელში', item: 'დაამატა სერვისი', unitem: 'წაშალა სერვისი', services: 'შეცვალა სერვისების სია', checkin: 'მონიშნა შესვლა', checkout: 'მონიშნა გასვლა', hk: 'შეცვალა ნომრის დალაგება', block: 'დახურა ნომერი', unblock: 'გახსნა ნომერი', invoice: 'შეცვალა ინვოისი', cancel: 'გააუქმა ჯავშანი', uncancel: 'აღადგინა გაუქმებული', noshow: 'მონიშნა „არ მოვიდა“', agent: 'შეცვალა სააგენტო', expense: 'დაამატა ხარჯი', unexpense: 'წაშალა ხარჯი', issue: 'ჩაწერა პრობლემა ნომერში', issuedone: 'მონიშნა პრობლემა გასწორებულად', ical: 'შეცვალა კალენდრის კავშირი',
    'user-add': 'დაამატა თანამშრომელი', 'user-edit': 'შეცვალა თანამშრომელი', 'user-pass': 'შეცვალა პაროლი', 'user-del': 'წაშალა თანამშრომელი', help: 'შეცვალა Visit2.ge-ს დახმარების უფლება'
  };
  const when = s => { const d = new Date(s); if (isNaN(d)) return ''; const p = n => String(n).padStart(2, '0'); return JIJI.fmt(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`) + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '') + ', ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
  let data = null, log = [], more = false, msg = '';
  // journal filters
  const F = { who: '', cat: '', from: '', to: '', q: '' };
  const CATS = {
    book: ['ჯავშნები (დადასტურება, უარყოფა, დამატება, ცვლილება)', ['confirm', 'decline', 'add', 'edit', 'move', 'restore']],
    pay: ['გადახდები, ფასი და სერვისები', ['pay', 'unpay', 'price', 'item', 'unitem', 'invoice']],
    stay: ['შესვლა, გასვლა, დალაგება', ['checkin', 'checkout', 'hk', 'block', 'unblock', 'noshow', 'cancel', 'uncancel', 'issue', 'issuedone', 'ical']],
    spend: ['ხარჯები', ['expense', 'unexpense']],
    del: ['წაშლა', ['remove', 'purge']],
    note: ['შენიშვნები', ['remark', 'guestnote']],
    rates: ['ფასები, სეზონი, სერვისები', ['rates', 'setting', 'services']],
    site: ['საიტის მართვა', ['site']],
    team: ['გუნდი', ['user-add', 'user-edit', 'user-pass', 'user-del']],
    login: ['შესვლები', ['login']]
  };
  const iso = (d, plus = 0) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + plus); return x.toISOString(); };
  function logQuery(extra = {}) {
    const q = new URLSearchParams();
    if (F.who) q.set('who', F.who); if (F.cat) q.set('ops', CATS[F.cat][1].join(','));
    if (F.from) q.set('from', iso(F.from)); if (F.to) q.set('to', iso(F.to, 1)); if (F.q) q.set('q', F.q);
    for (const k in extra) q.set(k, extra[k]);
    return q;
  }

  function say(t, bad) { const e = $('toast'); if (!e) return; e.textContent = t; e.classList.toggle('bad', !!bad); e.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => { e.hidden = true; }, bad ? 6000 : 3500); }
  async function call(body) {
    const r = await fetch('api/admin/users', { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    if (r.status === 401) { location.reload(); throw new Error('login'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.ok === false) throw new Error(d.msg || 'შეცდომა');
    data = d; return d;
  }
  async function loadLog(append) {
    const q = logQuery(append && log.length ? { before: log[log.length - 1].id } : {});
    const r = await fetch('api/admin/log?' + q, { cache: 'no-store' });
    const d = await r.json().catch(() => ({ items: [] }));
    log = append ? log.concat(d.items || []) : (d.items || []); more = (d.items || []).length === 100;
  }
  const genPw = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; return Array.from(crypto.getRandomValues(new Uint8Array(8)), x => a[x % a.length]).join(''); };
  const checks = (sel, name) => Object.entries(PERMS).map(([k, v]) => `<label class="chk"><input type="checkbox" name="${name}" value="${k}"${sel.includes(k) ? ' checked' : ''}><span>${v}<br><small class="hint">${PHELP[k]}</small></span></label>`).join('');

  function draw() {
    const p = $('team');
    if (J.mode !== 'api') { p.innerHTML = '<h1>გუნდი</h1><p class="sub">თანამშრომლების დამატება და ჟურნალი მალე.</p>'; return; }
    if (!data) { p.innerHTML = '<p class="sub">იტვირთება…</p>'; return; }
    const users = data.users || [];
    p.innerHTML = `<h1>გუნდი</h1><p class="sub">დაამატეთ თანამშრომლები და აირჩიეთ, რომელი განყოფილება ჰქონდეს თითოეულს. ყველა ცვლილება ჟურნალში ჩაიწერება მისი სახელით.</p>
      ${msg ? `<div class="msg good" style="margin-bottom:16px">${msg}</div>` : ''}
      <div class="card2"><div class="fh"><b>მთავარი ადმინისტრატორი (ყველა უფლებით)</b></div>
        <div class="trow"><input class="cin" id="tOwner" value="${esc(data.owner)}" aria-label="მთავარი ადმინისტრატორის სახელი"><button type="button" class="btn" id="tOwnerSave">სახელის შენახვა</button></div>
        <p class="hint">პაროლი იგივეა, რაც Cloudflare-ში ADMIN_PASSWORD. შესვლისას სახელის ველი შეგიძლიათ ცარიელი დატოვოთ.</p></div>
      <h2>თანამშრომლები</h2>
      ${users.length ? users.map(u => `<div class="card2 tuser${u.active ? '' : ' off'}" data-id="${u.id}">
        <div class="fh"><span><b>${esc(u.name)}</b> ${u.active ? '' : '<span class="pill p-no">გათიშულია</span>'}<br><small class="hint">${u.lastLogin ? 'ბოლოს შევიდა: ' + esc(when(u.lastLogin)) : 'ჯერ არ შესულა'}</small></span>
          <span class="ctl"><button type="button" class="btn sm" data-pw>პაროლის შეცვლა</button><button type="button" class="btn sm" data-act>${u.active ? 'გათიშვა' : 'ჩართვა'}</button><button type="button" class="btn sm nob" data-del>წაშლა</button></span></div>
        <div class="perms">${checks(u.perms, 'p-' + u.id)}</div></div>`).join('') : '<div class="empty">ჯერ არცერთი თანამშრომელი არ არის.</div>'}
      <details class="card2" id="tAddBox"${users.length ? '' : ' open'}><summary><b>+ თანამშრომლის დამატება</b></summary>
        <div class="grid2" style="margin-top:12px"><label class="fld"><b>სახელი</b><input class="cin" id="tName" autocomplete="off" placeholder="მაგ.: ნათია"></label>
        <label class="fld"><b>ელფოსტა</b><input class="cin" id="tEmail" type="email" autocomplete="off" placeholder="მაგ.: natia@gmail.com"></label>
        <label class="fld"><b>პაროლი</b><span class="trow"><input class="cin" id="tPw" autocomplete="new-password" value="${genPw()}"><button type="button" class="btn sm" id="tGen">ახალი</button></span><span class="hint">მინიმუმ 8 სიმბოლო. გადაეცით თანამშრომელს პირადად.</span></label></div>
        <div class="fld" style="margin-top:8px"><b>რა უნდა უჩანდეს</b><div class="perms">${checks(['book'], 'p-new')}</div></div>
        <button type="button" class="btn pri" id="tAdd" style="margin-top:10px">დამატება</button></details>
      <h2>ჟურნალი: ვინ რა გააკეთა</h2>
      <div class="jf">
        <label>ვინ<select class="cin" id="tWho"><option value="">ყველა</option><option value="${data.ownerId}"${F.who === data.ownerId ? ' selected' : ''}>${esc(data.owner)}</option>${users.map(u => `<option value="${u.id}"${F.who === u.id ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label>
        <label>რა<select class="cin" id="tCat"><option value="">ყველაფერი</option>${Object.entries(CATS).map(([k, [n]]) => `<option value="${k}"${F.cat === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>-დან<input class="cin" type="date" id="tFrom" value="${F.from}"></label>
        <label>-მდე<input class="cin" type="date" id="tTo" value="${F.to}"></label>
        <label class="wide">ძებნა (სტუმრის სახელი, ტელეფონი, ნომერი, თანხა)<input class="cin" id="tQ" type="search" value="${esc(F.q)}" placeholder="მაგ.: ნინო ან 540"></label>
      </div>
      <div class="gacts"><button type="button" class="btn sm" data-per="0">დღეს</button><button type="button" class="btn sm" data-per="7">7 დღე</button><button type="button" class="btn sm" data-per="30">30 დღე</button>
        ${F.who || F.cat || F.from || F.to || F.q ? '<button type="button" class="lnk" id="tReset">ფილტრების გასუფთავება</button>' : ''}<button type="button" class="btn sm" id="tCsv" style="margin-left:auto">⬇️ Excel</button></div>
      <p class="hint" style="margin:8px 0 0">${log.length}${more ? '+' : ''} ჩანაწერი</p>
      ${log.length ? `<ul class="jlog">${log.map(x => `<li${x.target && x.target.startsWith('bk:') && J.bookings.some(b => b.id === x.target.slice(3)) ? ` class="go" data-bk="${esc(x.target.slice(3))}" tabindex="0" title="ჯავშნის გახსნა"` : ''}><span class="src">${esc(when(x.at))}</span><div><b>${esc(x.who)}</b> ${VERB[x.op] || esc(x.op)}${x.detail ? `<br><span class="hint">${esc(x.detail)}</span>` : ''}</div></li>`).join('')}</ul>${more ? '<button type="button" class="btn" id="tMore" style="margin-top:10px">მეტის ჩვენება</button>' : ''}` : '<div class="empty">ჩანაწერები ჯერ არ არის.</div>'}
      <h2>სუფთა ფურცლით დაწყება</h2><div class="card2 wipe">${wipeHtml()}</div>`;
  }

  // start over: three steps, the last one asks for the word „წაშლა“
  let W = 0;
  function wipeHtml() {
    const nb = J.bookings.length, np = (J.payments || []).length;
    const keep = '<p class="hint">დარჩება: ნომრები, ფასები, სეზონები, აქციები, საიტის ტექსტები და ფოტოები, გუნდი და პაროლები.</p>';
    if (W === 0) return `<p class="hint">ყველა ჯავშნის, გადახდის, სტუმრების შენიშვნისა და ჟურნალის წაშლა, მაგალითად სატესტო მონაცემების შემდეგ ნამდვილი მუშაობის დასაწყებად.</p>${keep}<button type="button" class="btn" data-wipe="1">წაშლის დაწყება…</button>`;
    const cancel = '<button type="button" class="btn" data-wipe="0">გაუქმება</button>';
    if (W === 1) return `<p><b>1/3.</b> წაიშლება: <b>${nb}</b> ჯავშანი და მოთხოვნა, <b>${np}</b> გადახდა, სტუმრების შენიშვნები და დაბადების დღეები, ჩატბოტის საუბრები და მთელი ჟურნალი.</p>${keep}<div class="trow"><button type="button" class="btn pri" data-wipe="2">გავაგრძელოთ</button>${cancel}</div>`;
    if (W === 2) return `<p><b>2/3.</b> დარწმუნებული ხართ? წაშლილის დაბრუნება ადმინიდან შეუძლებელია.</p><div class="trow"><button type="button" class="btn pri" data-wipe="3">კი, დარწმუნებული ვარ</button>${cancel}</div>`;
    return `<p><b>3/3.</b> დასადასტურებლად ჩაწერეთ სიტყვა <b>წაშლა</b></p><div class="trow"><input class="cin" id="wipeWord" autocomplete="off" aria-label="დამადასტურებელი სიტყვა"><button type="button" class="btn danger" data-wipe="go">საბოლოოდ წაშლა</button>${cancel}</div>`;
  }

  // the filtered journal as a CSV file Excel opens (up to 5000 rows)
  async function csv() {
    const r = await fetch('api/admin/log?' + logQuery({ limit: 5000 }), { cache: 'no-store' });
    const items = (await r.json().catch(() => ({}))).items || [];
    const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['თარიღი', 'ვინ', 'რა', 'დეტალები']].concat(items.map(x => [when(x.at), x.who, VERB[x.op] || x.op, x.detail]));
    const blob = new Blob(['\ufeff' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(J.hotel && J.hotel.slug) || 'hotel'}-jurnali-${J.today()}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function act(fn, ok) {
    try { await fn(); msg = ''; if (ok) say(ok); await loadLog(); draw(); }
    catch (e) { if (e.message !== 'login') say(e.message, true); }
  }
  async function open() {
    if (J.mode !== 'api') return draw();
    draw();
    try { await call(); await loadLog(); } catch (e) { if (e.message !== 'login') say(e.message, true); }
    draw();
  }

  document.addEventListener('adminmode', e => { if (e.detail === 'team') open(); });
  document.addEventListener('click', e => {
    const p = $('team'); if (!p || !p.contains(e.target)) return;
    const card = e.target.closest('.tuser'), id = card?.dataset.id, u = id && data.users.find(x => x.id === id);
    const go = e.target.closest('[data-bk]');
    if (go && window.openBooking) { window.openBooking(go.dataset.bk); return; }
    const per = e.target.closest('[data-per]');
    if (per) { const t = J.today(); F.from = J.addDays(t, -+per.dataset.per); F.to = t; loadLog().then(draw); return; }
    const wb = e.target.closest('[data-wipe]');
    if (wb) {
      const v = wb.dataset.wipe;
      if (v !== 'go') { W = +v; draw(); if (W === 3) setTimeout(() => $('wipeWord')?.focus(), 0); return; }
      const word = ($('wipeWord')?.value || '').trim();
      if (word !== 'წაშლა') { say('ჩაწერეთ ზუსტად: წაშლა', true); return; }
      wb.disabled = true;
      J.wipe(word).then(async out => {
        W = 0;
        if (out.ok) say(`წაიშალა ${out.bookings} ჯავშანი და ${out.payments} გადახდა. ადმინი სუფთაა.`);
        await loadLog(); draw();
      });
      return;
    }
    if (e.target.id === 'tReset') { Object.keys(F).forEach(k => { F[k] = ''; }); loadLog().then(draw); return; }
    if (e.target.id === 'tCsv') { csv(); return; }
    if (e.target.id === 'tGen') $('tPw').value = genPw();
    else if (e.target.id === 'tOwnerSave') act(() => call({ op: 'owner', name: $('tOwner').value }), 'სახელი შეიცვალა. ზემოთ ახალი სახელი გამოჩნდება გვერდის განახლების შემდეგ.');
    else if (e.target.id === 'tAdd') {
      const name = $('tName').value.trim(), email = $('tEmail').value.trim(), password = $('tPw').value, perms = [...p.querySelectorAll('[name="p-new"]:checked')].map(x => x.value);
      act(async () => { await call({ op: 'add', name, email, password, perms }); }).then(() => {
        if (data.users.some(x => x.name === name)) { msg = `✓ დაემატა. გადაეცით თანამშრომელს: გვერდი <b>${esc(location.host)}/admin</b>, ელფოსტა <b>${esc(email)}</b>, პაროლი <b>${esc(password)}</b>. პაროლი მერე აღარსად გამოჩნდება.`; draw(); }
      });
    }
    else if (e.target.id === 'tMore') loadLog(true).then(draw);
    else if (u && e.target.closest('[data-pw]')) {
      const pw = prompt(`ახალი პაროლი: ${u.name} (მინიმუმ 8 სიმბოლო)`, genPw()); if (!pw) return;
      act(() => call({ op: 'password', id, password: pw })).then(() => { msg = `✓ ${esc(u.name)}-ს ახალი პაროლი: <b>${esc(pw)}</b>. ძველი პაროლით შესული მოწყობილობიდან ავტომატურად გავა.`; draw(); });
    }
    else if (u && e.target.closest('[data-act]')) act(() => call({ op: 'update', id, active: !u.active }), u.active ? u.name + ' გაითიშა და პანელიდან გავიდა.' : u.name + ' ჩაირთო.');
    else if (u && e.target.closest('[data-del]')) { if (confirm(`წავშალოთ ${u.name}? ჟურნალში მისი ჩანაწერები დარჩება.`)) act(() => call({ op: 'remove', id }), u.name + ' წაიშალა.'); }
  });
  document.addEventListener('change', e => {
    const p = $('team'); if (!p || !p.contains(e.target)) return;
    const fmap = { tWho: 'who', tCat: 'cat', tFrom: 'from', tTo: 'to', tQ: 'q' };
    if (fmap[e.target.id]) { F[fmap[e.target.id]] = e.target.value.trim(); loadLog().then(draw); return; }
    const card = e.target.closest('.tuser'); if (!card || e.target.type !== 'checkbox') return;
    const perms = [...card.querySelectorAll('input[type=checkbox]:checked')].map(x => x.value);
    act(() => call({ op: 'update', id: card.dataset.id, perms }), 'უფლებები შეინახა. თანამშრომელს 15 წამში შეეცვლება.');
  });
})();
