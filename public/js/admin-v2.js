/* Visit2.ge in a hotel's admin: notices from Visit2, the "Visit2 is helping" line, and the owner's help-access switch (in გუნდი). */
(() => {
  const J = window.JIJI, $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hidden = () => { try { return JSON.parse(localStorage.getItem('v2-notice-off') || '[]'); } catch (e) { return []; } };
  // Georgian time (UTC+4), whatever the device's clock says
  const until = ms => { const x = new Date(ms + 4 * 3600e3).toISOString(); return `${J.fmt(x.slice(0, 10))}, ${x.slice(11, 16)}`; };

  function bar() {
    let el = $('v2Bar');
    if (!el) { el = document.createElement('div'); el.id = 'v2Bar'; el.className = 'v2bar'; $('modeBar').before(el); }
    const h = J.hotel || {}, off = hidden(), out = [];
    if (J.me && J.me.support) out.push(`<div class="v2n help" role="status"><span>Visit2.ge-ს გუნდი გეხმარება. რასაც ვცვლით, ჟურნალში ჩანს სახელით „Visit2 · …“.</span></div>`);
    for (const n of h.notices || []) if (!off.includes(n.id)) out.push(`<div class="v2n" role="status"><span>${esc(n.text)}</span><button type="button" class="x" data-off="${esc(n.id)}" aria-label="დამალვა">×</button></div>`);
    el.innerHTML = out.join(''); el.hidden = !out.length;
  }

  function helpCard() {
    const area = $('teamArea'); if (!area) return;
    let el = $('v2Help');
    if (!el) { el = document.createElement('section'); el.id = 'v2Help'; el.className = 'panel v2help'; area.querySelector('main').prepend(el); }
    const me = J.me || {}, h = J.hotel || {};
    if (J.mode !== 'api' || !me.owner || me.support) { el.hidden = true; return; }
    el.hidden = false;
    const on = h.helpUntil && h.helpUntil > Date.now();
    el.innerHTML = `<h2>Visit2.ge-ს დახმარება</h2>
      <p class="sub">თუ რამე გაგიჭირდა, ჩვენს გუნდს შეგიძლია ადმინში შესვლის უფლება მისცე. ჩვენ გავასწორებთ, შენ კი ჟურნალში ნახავ ყველაფერს, რაც შევცვალეთ. ვადა რომ გავა, უფლება თავისით გაუქმდება.</p>
      ${on ? `<p class="v2on">✓ Visit2.ge-ს გუნდს შესვლა შეუძლია ${esc(until(h.helpUntil))}-მდე.</p>` : ''}
      <div class="v2acts">${[[24, '24 საათით'], [72, '3 დღით'], [168, '7 დღით']].map(([n, t]) => `<button type="button" class="btn${on ? '' : ' pri'}" data-help="${n}">${on ? 'გაგრძელება ' : 'დაშვება '}${t}</button>`).join('')}${on ? '<button type="button" class="btn" data-help="0">უფლების გაუქმება</button>' : ''}</div>`;
  }

  // Facebook / Instagram chat: connect the hotel's page with one button (owner only)
  let metaState = null;
  async function metaCard() {
    const area = $('teamArea'); if (!area || J.mode !== 'api') return;
    let el = $('v2Meta');
    if (!el) { el = document.createElement('section'); el.id = 'v2Meta'; el.className = 'panel v2help'; ($('v2Help') || area.querySelector('main').firstChild).after(el); }
    if (!metaState) { try { metaState = await (await fetch('api/admin/meta', { cache: 'no-store' })).json(); } catch (e) { metaState = { ready: false, pages: [], choose: [] }; } }
    const me = J.me || {}, M = metaState, fb = (M.pages || []).find(x => x.channel === 'fb'), ig = (M.pages || []).some(x => x.channel === 'ig');
    const said = { connected: '✓ გვერდი მიუერთდა.', cancelled: 'მიერთება გაუქმდა.', failed: 'ვერ მიუერთდა. სცადე თავიდან.', nopages: 'ამ Facebook-ზე გვერდი ვერ ვიპოვეთ. შედი იმ ანგარიშით, რომელიც გვერდს მართავს.', taken: 'ეს გვერდი სხვა სასტუმროს უკვე მიერთებული აქვს. მოგვწერე და გავარკვევთ.' }[new URLSearchParams(location.search).get('meta')] || '';
    el.innerHTML = `<h2>Facebook და Instagram ჩატი</h2>
      <p class="sub">მიუერთეთ თქვენი Facebook გვერდი და სტუმრები მესენჯერში (და Instagram-ზე, თუ გვერდთან არის მიბმული) იმავე ასისტენტს ნახავენ, რაც საიტზე: ფასები, თავისუფალი ნომრები და ჯავშანი.</p>
      ${said ? `<p class="v2on">${esc(said)}</p>` : ''}
      ${!M.ready ? '<p class="sub"><b>მალე.</b> ამ ღილაკს ჩავრთავთ, როგორც კი Meta შემოწმებას დაასრულებს.</p>'
        : fb ? `<p class="v2on">✓ მიერთებულია: Facebook${ig ? ' და Instagram' : ''}</p>${me.owner && !me.support ? '<div class="v2acts"><button type="button" class="btn" data-meta="off">გამორთვა</button></div>' : ''}`
        : (M.choose || []).length ? `<p>აირჩიეთ გვერდი:</p><div class="v2acts">${M.choose.map(x => `<button type="button" class="btn pri" data-meta="pick" data-id="${esc(x.id)}">${esc(x.name)}${x.ig ? ' + Instagram' : ''}</button>`).join('')}</div>`
        : me.owner && !me.support ? '<div class="v2acts"><button type="button" class="btn pri" data-meta="start">Facebook-ის მიერთება</button></div>' : '<p class="sub">მიერთება მფლობელს შეუძლია.</p>'}`;
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-meta]'); if (!b) return;
    b.disabled = true;
    try {
      const o = await (await fetch('api/admin/meta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: b.dataset.meta, id: b.dataset.id }) })).json();
      if (o.url) { location.href = o.url; return; }
      metaState = null; await metaCard();
    } catch (x) { b.disabled = false; }
  });
  function draw() { if (!J.me) return; bar(); helpCard(); metaCard(); }
  document.addEventListener('click', async e => {
    const off = e.target.closest('[data-off]');
    if (off) { const l = hidden(); l.push(off.dataset.off); try { localStorage.setItem('v2-notice-off', JSON.stringify(l.slice(-30))); } catch (x) { /* private mode */ } bar(); return; }
    const b = e.target.closest('[data-help]'); if (!b) return;
    b.disabled = true;
    try {
      const r = await fetch('api/admin/help', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hours: +b.dataset.help }) });
      const o = await r.json();
      if (o.ok) { J.hotel.helpUntil = o.until || null; helpCard(); }
      else b.disabled = false;
    } catch (x) { b.disabled = false; }
  });
  J.ready.then(draw); J.onChange(draw);
})();
