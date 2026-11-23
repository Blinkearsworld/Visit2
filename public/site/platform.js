/* Visit2.ge platform pages: the guests' search across hotels and the owners' sign-up (demo, browser-only). */
(() => {
  const D = window.V2DEMO, $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const toS = d => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return toS(d); };
  const today = () => toS(new Date(Date.now() + 4 * 3600e3)); // Georgian time
  const nights = (a, b) => Math.round((toD(b) - toD(a)) / 864e5);
  const season = s => { const m = +s.slice(5, 7), d = +s.slice(8); if ((m === 12 && d >= 25) || (m === 1 && d <= 7)) return 'peak'; if (m === 12 || m <= 3) return 'winter'; if (m >= 6 && m <= 8) return 'summer'; return 'off'; };
  const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
  const fmt = s => { const d = toD(s); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]; };

  // ---------- guests: search ----------
  const booked = h => { try { const st = JSON.parse(localStorage.getItem('v2-demo-' + h.slug) || 'null'); return st ? st.bookings.filter(b => b.status === 'confirmed') : []; } catch (e) { return []; } };
  function offer(h, from, to, g) {
    const rate = t => (h.types[t]?.rates || []).find(r => r.guests >= g);
    const minFrom = Math.min(...Object.values(h.types).flatMap(t => t.rates.map(r => Math.min(...Object.values(r.price)))));
    if (!from || !to || to <= from) return { minFrom };
    const bs = booked(h);
    let best = null;
    for (const t of Object.keys(h.types)) {
      const r = rate(t); if (!r) continue;
      const free = D.ROOMS.filter(x => x.type === t && !bs.some(b => b.room === x.id && b.from < to && from < b.to));
      if (!free.length) continue;
      let sum = 0; for (let d = from; d < to; d = addDays(d, 1)) sum += r.price[season(d)] || 0;
      if (!best || sum < best.total) best = { total: sum, type: h.types[t].name };
    }
    return { minFrom, best, n: nights(from, to) };
  }
  function search() {
    const f = $('#search'), city = f.city.value, from = f.from.value, to = f.to.value, g = +f.g.value;
    const list = D.list().filter(h => !city || h.city === city);
    const dated = from && to && to > from;
    const rows = list.map(h => ({ h, o: offer(h, from, to, g) })).sort((a, b) => (dated ? (!!b.o.best - !!a.o.best) || ((a.o.best?.total || 0) - (b.o.best?.total || 0)) : 0));
    $('#resTitle').textContent = city ? `სასტუმროები: ${city}` : 'სასტუმროები';
    $('#resNote').textContent = dated ? `${fmt(from)} – ${fmt(to)} · ${g} სტუმარი · ${rows.filter(r => r.o.best).length} თავისუფალი` : 'აირჩიე თარიღები, რომ ნახო თავისუფალი ნომრები და ფასი';
    const q = dated ? `&from=${from}&to=${to}&g=${g}` : '';
    $('#cards').innerHTML = rows.map(({ h, o }) => {
      const img = h.site?.hero?.img || '';
      const price = dated ? (o.best ? `${o.best.total} ₾ <small>${o.n} ღამე · ${esc(o.best.type)}</small>` : '') : `${o.minFrom} ₾-დან <small>/ ღამე</small>`;
      const tag = dated ? (o.best ? '✓ თავისუფალია ამ თარიღებზე' : 'ამ თარიღებზე თავისუფალი არ არის') : '✓ ნამდვილი თავისუფალი ნომრები';
      return `<a class="card" href="hotel.html?h=${encodeURIComponent(h.slug)}${q}" data-free="${dated && !o.best ? 'no' : 'yes'}">
  ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}
  <div class="card-body"><p class="card-city">${esc(h.city)}${h.mine ? ' · შენი სასტუმრო' : ''}</p><h3>${esc(h.name)}</h3>
  ${price ? `<p class="card-price">${price}</p>` : ''}<p class="card-tag">${tag}</p></div></a>`;
    }).join('') || '<p>ამ ქალაქში სასტუმრო ჯერ არ არის.</p>';
    document.querySelectorAll('#cities button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.city === city)));
  }
  if ($('#search')) {
    const f = $('#search'), cities = [...new Set(D.list().map(h => h.city))];
    f.city.insertAdjacentHTML('beforeend', cities.map(c => `<option>${esc(c)}</option>`).join(''));
    $('#cities').innerHTML = cities.map(c => `<button type="button" data-city="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('');
    f.from.min = today(); f.to.min = addDays(today(), 1);
    f.addEventListener('change', e => {
      if (e.target === f.from && f.from.value && (!f.to.value || f.to.value <= f.from.value)) f.to.value = addDays(f.from.value, 2);
      if (f.from.value) f.to.min = addDays(f.from.value, 1);
      search();
    });
    f.addEventListener('submit', e => { e.preventDefault(); search(); $('#results').scrollIntoView({ behavior: 'smooth' }); });
    $('#cities').addEventListener('click', e => { const b = e.target.closest('[data-city]'); if (!b) return; f.city.value = f.city.value === b.dataset.city ? '' : b.dataset.city; search(); });
    search();
  }

  // ---------- owners: templates and sign-up ----------
  const TPL = [
    { id: 'kva', name: 'ქვა', note: 'მთის სახლისთვის: ფოტო მთელ ეკრანზე და სახელი დიდი მთავრულით.', demo: 'mta' },
    { id: 'ezo', name: 'ეზო', note: 'საოჯახო სასტუმროსთვის: თაღოვანი ფოტოები, რბილი ფერები.', demo: 'nino' },
    { id: 'kalaki', name: 'ქალაქი', note: 'ბინებისთვის: სუფთა სია, ფასები თვალწინ.', demo: 'dzveli' },
  ];
  const COLORS = ['#0E857D', '#3F7A4E', '#2F5A8A', '#B4472F', '#8A5A2B', '#6B4A8A', '#1F1A17'];
  if ($('#ownerForm')) {
    $('#tplList').innerHTML = TPL.map(t => `<figure class="tpl-item"><img src="img/templates/${t.id}.jpg" alt="შაბლონი ${t.name}" loading="lazy"><figcaption><b>${t.name}</b><p>${t.note}</p><a href="hotel.html?h=${t.demo}">ნიმუშის ნახვა</a></figcaption></figure>`).join('');
    $('#tplChoice').innerHTML = TPL.map((t, i) => `<label><input type="radio" name="theme" value="${t.id}"${i ? '' : ' checked'}><span class="opt">${t.name}</span></label>`).join('');
    $('#colChoice').innerHTML = COLORS.map((c, i) => `<label><input type="radio" name="accent" value="${c}"${i ? '' : ' checked'} aria-label="ფერი ${c}"><span class="opt dot" style="--c:${c}"></span></label>`).join('');
    const showDone = h => {
      $('#doneTitle').textContent = `✓ „${h.name}“-ის საიტი მზადაა`;
      $('#doneSite').href = 'hotel.html?h=my'; $('#doneAdmin').href = 'admin.html?h=my';
      $('#done').classList.add('show');
    };
    const mine = D.mine(); if (mine) showDone(mine);
    $('#ownerForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target, name = f.name.value.trim(), city = f.city.value.trim(), msg = $('#formMsg');
      if (name.length < 2 || city.length < 2) { msg.textContent = 'ჩაწერე სასტუმროს სახელი და ქალაქი'; (name.length < 2 ? f.name : f.city).focus(); return; }
      const h = D.saveMine({ name, city, theme: f.theme.value, accent: f.accent.value, email: f.email.value.trim() });
      msg.textContent = ''; showDone(h); $('#done').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
})();
