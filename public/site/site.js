/* Visit2 hotel site: one renderer, several templates (themes).
   Data: rooms, prices and availability from JIJI (js/store.js); the hotel's texts, photos, theme and colour from
   /api/content (content.site), edited in admin. Templates differ in CSS (site/themes/*.css) and a few layout flags. */
(() => {
  const J = window.JIJI, I = window.I18N, $ = s => document.querySelector(s);
  const V = (document.currentScript && document.currentScript.src.split('?v=')[1]) || '1';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lang = () => (I ? I.lang : 'ka');
  // Georgian capitals (mtavruli): CSS uppercase does not map Georgian, so the Stone template converts the text itself
  const MT = s => String(s ?? '').replace(/[\u10D0-\u10FA\u10FD-\u10FF]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xBC0));
  const caps = s => (theme() === 'kva' ? MT(s) : s);
  const pick = v => (v == null ? '' : typeof v === 'string' ? v : v[lang()] || v.ka || '');

  // ---------- templates ----------
  const THEMES = {
    kva: { name: { ka: 'ქვა', en: 'Stone', ru: 'Камень' }, accent: '#0E857D', note: { ka: 'მთის სახლი: დიდი ფოტო, მკაცრი ხაზები', en: 'Mountain house', ru: 'Горный дом' } },
    ezo: { name: { ka: 'ეზო', en: 'Courtyard', ru: 'Двор' }, accent: '#3F7A4E', note: { ka: 'საოჯახო: თაღოვანი ფოტოები, რბილი ფერები', en: 'Family house', ru: 'Семейный дом' } },
    kalaki: { name: { ka: 'ქალაქი', en: 'City', ru: 'Город' }, accent: '#B4472F', note: { ka: 'ბინები და ქალაქი: სუფთა სია, ფასები თვალწინ', en: 'City apartments', ru: 'Городские квартиры' } },
    zghva: { name: { ka: 'ზღვა', en: 'Sea', ru: 'Море' }, accent: '#1F7FB0' },
    ghvino: { name: { ka: 'ღვინო', en: 'Wine', ru: 'Вино' }, accent: '#7A2638' },
    minimali: { name: { ka: 'მინიმალი', en: 'Minimal', ru: 'Минимал' }, accent: '#1F1A17' },
    tye: { name: { ka: 'ტყე', en: 'Forest', ru: 'Лес' }, accent: '#3E9B5F' },
    butiki: { name: { ka: 'ბუტიკი', en: 'Boutique', ru: 'Бутик' }, accent: '#B08D57' },
    peradi: { name: { ka: 'ფერადი', en: 'Colourful', ru: 'Яркий' }, accent: '#E2563B' },
    klasika: { name: { ka: 'კლასიკა', en: 'Classic', ru: 'Классика' }, accent: '#2F5A8A' },
  };
  const ACCENTS = ['#0E857D', '#3F7A4E', '#1F7FB0', '#2F5A8A', '#B4472F', '#E2563B', '#7A2638', '#8A5A2B', '#6B4A8A', '#1F1A17'];

  // ---------- interface words ----------
  const W = {
    about: ['ჩვენ შესახებ', 'About', 'О нас'], rooms: ['ნომრები', 'Rooms', 'Номера'], amen: ['რა გვაქვს', 'Amenities', 'Удобства'],
    gallery: ['ფოტოები', 'Photos', 'Фото'], where: ['სად ვართ', 'Location', 'Где мы'], faq: ['ხშირი კითხვები', 'FAQ', 'Вопросы'],
    food: ['ახლოს სად ვჭამოთ', 'Where to eat nearby', 'Где поесть рядом'], recommended: ['რეკომენდებული', 'Recommended', 'Рекомендуем'],
    foodAll: ['ყველა ახლომდებარე რესტორანი', 'All places to eat nearby', 'Все заведения рядом'], foodAllH: ['ახლომდებარე რესტორნები, მანძილის მიხედვით', 'Places to eat, nearest first', 'Где поесть: сначала ближайшие'],
    foodKind: ['სამზარეულო', 'Cuisine', 'Кухня'], foodAny: ['ყველა', 'All', 'Все'], close: ['დახურვა', 'Close', 'Закрыть'],
    foodNote: ['სია Visit2.ge-დანაა. „რეკომენდებული“ რესტორნის ფასიანი ადგილია.', 'List from Visit2.ge. “Recommended” is a paid spot.', 'Список от Visit2.ge. «Рекомендуем» — платное размещение.'],
    book: ['დაჯავშნა', 'Book', 'Забронировать'], bookShort: ['ჯავშანი', 'Book', 'Бронь'], checkin: ['შესვლა', 'Check-in', 'Заезд'], checkout: ['გასვლა', 'Check-out', 'Выезд'],
    adults: ['სტუმარი 10 წლიდან', 'Guests 10+', 'Гости от 10 лет'], kids: ['ბავშვი 10 წლამდე', 'Children under 10', 'Дети до 10 лет'],
    name: ['სახელი', 'Name', 'Имя'], phone: ['ტელეფონი', 'Phone', 'Телефон'], wish: ['სპეციალური მოთხოვნა', 'Special request', 'Особые пожелания'],
    optional: ['არასავალდებულო', 'optional', 'необязательно'], send: ['მოთხოვნის გაგზავნა', 'Send request', 'Отправить запрос'],
    check: ['თავისუფალი ნომრები', 'Check availability', 'Свободные номера'], perNight: ['ღამე', 'night', 'ночь'], from: ['-დან', 'from', 'от'],
    upTo: ['სტუმრამდე', 'guests max', 'гостей макс.'], left: ['თავისუფალი', 'available', 'свободно'], none: ['ამ თარიღებზე თავისუფალი არ არის', 'Not available on these dates', 'На эти даты нет мест'],
    pickDates: ['აირჩიეთ თარიღები', 'Choose dates', 'Выберите даты'], nights: ['ღამე', 'nights', 'ночей'], total: ['სულ', 'Total', 'Итого'],
    nearest: ['უახლოესი თავისუფალი', 'Nearest available', 'Ближайшие свободные'], choose: ['ეს ნომერი', 'This room', 'Этот номер'],
    noPay: ['გადახდა ახლა არ არის საჭირო. სასტუმრო დაგიკავშირდებათ და ჯავშანს დაგიდასტურებთ.', 'No payment now. The hotel will call you to confirm.', 'Оплата сейчас не нужна. Отель свяжется с вами для подтверждения.'],
    sent: ['მოთხოვნა გაიგზავნა. სასტუმრო მალე დაგიკავშირდებათ.', 'Request sent. The hotel will contact you soon.', 'Запрос отправлен. Отель скоро свяжется с вами.'],
    needName: ['ჩაწერეთ სახელი და ტელეფონი', 'Enter your name and phone', 'Укажите имя и телефон'], err: ['ვერ გაიგზავნა. სცადეთ ხელახლა ან დაგვირეკეთ.', 'Could not send. Try again or call us.', 'Не удалось отправить. Попробуйте ещё раз или позвоните.'],
    call: ['დარეკვა', 'Call', 'Позвонить'], map: ['რუკაზე ნახვა', 'Open map', 'На карте'], estimate: ['საორიენტაციო ფასი', 'Estimated price', 'Ориентировочная цена'],
    template: ['შაბლონი', 'Template', 'Шаблон'], colour: ['ფერი', 'Colour', 'Цвет'], demo: ['დემო: მონაცემები მხოლოდ ამ ბრაუზერშია', 'Demo: data stays in this browser', 'Демо: данные только в этом браузере'],
    admin: ['ადმინი', 'Admin', 'Админ'], directly: ['პირდაპირ, საკომისიოს გარეშე', 'Book direct, no commission', 'Напрямую, без комиссии'],
  };
  const w = k => (W[k] ? W[k][['ka', 'en', 'ru'].indexOf(lang())] || W[k][0] : k);

  const AMEN = {
    wifi: ['📶', 'Wi-Fi', 'Wi-Fi', 'Wi-Fi'], parking: ['🅿️', 'უფასო პარკინგი', 'Free parking', 'Бесплатная парковка'], kitchen: ['🍳', 'სამზარეულო ნომერში', 'Kitchen in room', 'Кухня в номере'],
    breakfast: ['☕', 'საუზმე', 'Breakfast', 'Завтрак'], fireplace: ['🔥', 'ბუხარი', 'Fireplace', 'Камин'], pool: ['🏊', 'აუზი', 'Pool', 'Бассейн'],
    garden: ['🌳', 'ეზო', 'Garden', 'Сад'], bbq: ['🍖', 'მაყალი', 'BBQ', 'Мангал'], pets: ['🐾', 'შინაური ცხოველით', 'Pets allowed', 'Можно с животными'],
    ski: ['⛷️', 'საბაგიროსთან ახლოს', 'Near ski lifts', 'Рядом с подъёмником'], balcony: ['🌄', 'აივანი', 'Balcony', 'Балкон'], kids: ['🧸', 'საბავშვო კუთხე', 'Kids corner', 'Детский уголок'],
    transfer: ['🚐', 'ტრანსფერი', 'Transfer', 'Трансфер'], sea: ['🌊', 'ზღვასთან ახლოს', 'Near the sea', 'Рядом с морем'], center: ['🏙️', 'ცენტრში', 'City centre', 'В центре'],
  };
  const TYPE_TR = {
    'სტანდარტული ორადგილიანი': ['Standard double', 'Стандартный двухместный'],
    'საოჯახო, 1 საძინებლით (4+1)': ['Family, 1 bedroom (4+1)', 'Семейный, 1 спальня (4+1)'],
    'ლუქსი, 2 საძინებლით': ['Suite, 2 bedrooms', 'Люкс, 2 спальни'],
  };
  const typeName = n => (lang() === 'ka' || !TYPE_TR[n] ? n : TYPE_TR[n][lang() === 'en' ? 0 : 1]);
  const amenText = k => (AMEN[k] ? AMEN[k][1 + ['ka', 'en', 'ru'].indexOf(lang())] || AMEN[k][1] : k);

  // ---------- the demo hotel (GitHub Pages, no server) ----------
  const DEMO = {
    theme: 'kva', accent: '',
    hero: { img: 'img/demo/hero.jpg', tagline: { ka: 'რვა თბილი ნომერი ტყის პირას, საბაგიროდან ხუთ წუთში', en: 'Eight warm rooms at the forest edge, five minutes from the lifts', ru: 'Восемь тёплых номеров у леса, в пяти минутах от подъёмника' } },
    about: { img: 'img/demo/facade.jpg', text: { ka: 'პატარა საოჯახო სასტუმრო, სადაც დილით ტყის სუნი შემოდის და საღამოს ბუხართან ვსხდებით. ყველა ნომერს აქვს სამზარეულო და აივანი, ეზოში ბავშვებისთვის ადგილია, ზამთარში საბაგირომდე ფეხით მიხვალთ.', en: 'A small family hotel where mornings smell of pine and evenings are spent by the fire. Every room has a kitchen and a balcony, the garden has room for kids, and in winter the lifts are a short walk away.', ru: 'Небольшой семейный отель: утром пахнет лесом, вечером собираемся у камина. В каждом номере кухня и балкон, во дворе есть место для детей, зимой до подъёмника можно дойти пешком.' } },
    amenities: ['wifi', 'parking', 'kitchen', 'fireplace', 'garden', 'pool', 'ski', 'pets'],
    gallery: ['img/demo/lounge.jpg', 'img/demo/fire.jpg', 'img/demo/garden.jpg', 'img/demo/pool.jpg', 'img/demo/games.jpg', 'img/demo/pergola.jpg'],
    rooms: {
      std: { photos: ['img/demo/room-std.jpg', 'img/demo/room-std2.jpg'], text: { ka: 'მყუდრო ნომერი ორისთვის, აივნით ტყეზე.', en: 'A cosy room for two with a forest-view balcony.', ru: 'Уютный номер для двоих с балконом на лес.' } },
      family: { photos: ['img/demo/room-family.jpg', 'img/demo/room-family2.jpg'], text: { ka: 'საძინებელი და მისაღები სამზარეულოთი. ოჯახისთვის ხუთამდე სტუმარი.', en: 'Bedroom plus living room with kitchenette. Up to five guests.', ru: 'Спальня и гостиная с кухней. До пяти гостей.' } },
      suite: { photos: ['img/demo/room-suite.jpg', 'img/demo/room-suite2.jpg'], text: { ka: 'ორი საძინებელი, დიდი მისაღები და ორი აივანი. ორი ოჯახისთვის.', en: 'Two bedrooms, a large living room and two balconies.', ru: 'Две спальни, большая гостиная и два балкона.' } },
    },
    location: { text: { ka: 'ტყის ქუჩა 12. ცენტრამდე 10 წუთი ფეხით, საბაგირომდე 400 მ.', en: '12 Forest St. 10 minutes on foot to the centre, 400 m to the lifts.', ru: 'Лесная ул. 12. До центра 10 минут пешком, до подъёмника 400 м.' }, map: 'https://www.google.com/maps/search/?api=1&query=Bakuriani' },
  };

  // ---------- state ----------
  let C = {}; // site content from the server (or DEMO)
  const params = new URLSearchParams(location.search);
  const isDemo = () => !!(J.hotel && J.hotel.demo);
  const slug = () => (J.hotel && J.hotel.slug) || 'demo';
  const demoHotel = () => (isDemo() && window.V2DEMO ? window.V2DEMO.get(slug()) : null);
  const S = () => {
    const d = demoHotel();
    const base = d ? { ...d.site, theme: d.theme, accent: d.accent } : DEMO;
    return { ...base, ...(C.site || {}), ...(isDemo() ? (loadLocal() || {}) : {}) };
  };
  const lookKey = () => 'v2-demo-look-' + slug();
  const loadLocal = () => { try { return JSON.parse(localStorage.getItem(lookKey()) || 'null'); } catch (e) { return null; } };
  const saveLocal = o => { try { localStorage.setItem(lookKey(), JSON.stringify({ ...(loadLocal() || {}), ...o })); } catch (e) {} };
  const theme = () => { const t = params.get('theme') || S().theme; return THEMES[t] ? t : 'kva'; };
  // a template preview (?theme=…) shows the template's own colour; otherwise the hotel's
  const accent = () => (params.get('theme') && THEMES[params.get('theme')] ? THEMES[theme()].accent : S().accent || THEMES[theme()].accent);
  const contact = () => (window.JC ? window.JC.contact() : {});

  async function loadContent() {
    if (isDemo()) return;
    try { const r = await fetch('api/content', { cache: 'no-store' }); if (r.ok) C = (await r.json()).content || {}; } catch (e) { /* keep defaults */ }
  }

  // ---------- rendering ----------
  const minPrice = k => { const t = J.types[k]; return t && t.rates.length ? Math.min(...t.rates.map(J.fromPrice)) : 0; };
  const roomsOf = k => J.ROOMS.filter(r => r.type === k);
  const typeIds = () => Object.keys(J.types).filter(k => roomsOf(k).length);
  const img = (src, alt = '', cls = '') => src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">` : `<div class="ph ${cls}" aria-hidden="true"></div>`;

  function render() {
    const s = S(), h = J.hotel || {}, c = contact(), th = theme();
    document.documentElement.dataset.theme = th;
    document.documentElement.style.setProperty('--accent', accent());
    $('#themeCss').href = `site/themes/${th}.css?v=${V}`;
    document.title = (h.name || '') + (h.city ? ' · ' + h.city : '');
    const tel = c.digits ? `tel:+${c.digits}` : '';
    const wasOpen = !!document.querySelector('.demo[open]');
    $('#app').innerHTML = `
<header class="top">
  <a class="brand" href="#top">${esc(caps(h.name || ''))}</a>
  <nav class="links"><a href="#about">${w('about')}</a><a href="#rooms">${w('rooms')}</a><a href="#where">${w('where')}</a></nav>
  <div class="langs" role="group" aria-label="Language">${['ka', 'en', 'ru'].map(l => `<button type="button" data-lang="${l}" aria-pressed="${l === lang()}">${l.toUpperCase()}</button>`).join('')}</div>
  <a class="btn btn-accent top-book" href="#book"><span class="long">${w('book')}</span><span class="short">${w('bookShort')}</span></a>
</header>
<main id="top">
  <section class="hero">
    <div class="hero-media">${img(s.hero?.img, h.name)}</div>
    <div class="hero-text">
      ${h.city ? `<p class="hero-city">${esc(h.city)}</p>` : ''}
      <h1 class="hero-name">${esc(caps(h.name || ''))}</h1>
      <p class="hero-tag">${esc(pick(s.hero?.tagline))}</p>
    </div>
  </section>
  ${bookBar()}
  <section class="about" id="about">
    <div class="about-media">${img(s.about?.img)}</div>
    <div class="about-text"><h2>${caps(w('about'))}</h2><p>${esc(pick(s.about?.text))}</p></div>
  </section>
  ${(s.amenities || []).length ? `<section class="amen"><h2>${caps(w('amen'))}</h2><ul>${s.amenities.map(k => `<li><span aria-hidden="true">${AMEN[k]?.[0] || '•'}</span>${esc(amenText(k))}</li>`).join('')}</ul></section>` : ''}
  <section class="rooms" id="rooms"><h2>${caps(w('rooms'))}</h2><div class="room-list">${typeIds().map(roomCard).join('')}</div></section>
  ${(s.gallery || []).length ? `<section class="gallery"><h2>${caps(w('gallery'))}</h2><div class="grid">${s.gallery.map(g => img(g)).join('')}</div></section>` : ''}
  ${bookForm()}
  <section class="where" id="where">
    <h2>${caps(w('where'))}</h2>
    <p>${esc(pick(s.location?.text) || c.addrText || h.city || '')}</p>
    <div class="where-actions">
      ${tel ? `<a class="btn btn-ghost" href="${tel}">${w('call')} ${esc(c.phone)}</a>` : ''}
      ${s.location?.map || c.map ? `<a class="btn btn-ghost" href="${esc(s.location?.map || c.map)}" target="_blank" rel="noopener">${w('map')}</a>` : ''}
    </div>
  </section>
  ${foodSection(h)}
</main>
<footer class="foot"><span>${esc(h.name || '')}${h.city ? ', ' + esc(h.city) : ''}</span><a href="https://visit2.ge" rel="noopener">Visit2.ge · ${w('directly')}</a></footer>
${isDemo() ? demoPanel() : ''}`;
    if (wasOpen) { const d = document.querySelector('.demo'); if (d) d.open = true; }
    wire();
  }

  // places to eat nearby, from Visit2.ge (restaurants list themselves free; "recommended" is a paid, labelled spot)
  function foodSection(h) {
    const F = window.V2FOOD; if (!F) return '';
    const all = F.all(h.city); if (!all.length) return '';
    return `<section class="food" id="food">
  <h2>${caps(w('food'))}</h2>
  <ul class="food-list">${F.near(h.city).map(foodItem).join('')}</ul>
  ${all.length > 4 ? `<button type="button" class="btn btn-line food-more" id="foodMore" aria-haspopup="dialog">${w('foodAll')} (${all.length})</button>` : ''}
  <p class="food-note">${w('foodNote')}</p>
</section>
<dialog class="food-dlg" id="foodDlg" aria-labelledby="foodDlgH">
  <div class="food-dlg-head"><h2 id="foodDlgH">${w('foodAllH')}</h2><button type="button" class="food-x" id="foodX" aria-label="${w('close')}">×</button></div>
  <div class="food-filter" role="group" aria-label="${w('foodKind')}"></div>
  <ul class="food-list food-full"></ul>
</dialog>`;
  }
  const dist = m => (m < 1000 ? `${m} ${lang() === 'ka' ? 'მ' : lang() === 'ru' ? 'м' : 'm'}` : `${(m / 1000).toFixed(1)} ${lang() === 'ka' ? 'კმ' : lang() === 'ru' ? 'км' : 'km'}`);
  const kindName = k => { const F = window.V2FOOD; return F.KIND[k][['ka', 'en', 'ru'].indexOf(lang())] || F.KIND[k][0]; };
  const foodItem = r => `<li class="food-item${r.sponsored ? ' rec' : ''}">
    ${r.sponsored ? `<span class="food-badge">${w('recommended')}</span>` : ''}
    <b>${esc(r.name)}</b>
    <span class="food-meta">${esc(kindName(r.kind))} · ${dist(r.m)} · ${'₾'.repeat(r.price)}</span>
  </li>`;
  // the full list: every place nearby, nearest first, with a filter by kind
  function openFood() {
    const F = window.V2FOOD, all = F.all((J.hotel || {}).city), dlg = $('#foodDlg');
    const kinds = [...new Set(all.map(r => r.kind))];
    let cur = '';
    const draw = () => {
      dlg.querySelector('.food-filter').innerHTML = ['', ...kinds].map(k => `<button type="button" data-kind="${k}" aria-pressed="${k === cur}">${k ? esc(kindName(k)) : w('foodAny')}</button>`).join('');
      dlg.querySelector('.food-full').innerHTML = all.filter(r => !cur || r.kind === cur).map(foodItem).join('');
    };
    dlg.querySelector('.food-filter').onclick = e => { const b = e.target.closest('[data-kind]'); if (!b) return; cur = b.dataset.kind; draw(); };
    draw();
    dlg.showModal();
  }

  function roomCard(k) {
    const t = J.types[k], s = S().rooms?.[k] || {}, ph = (s.photos || []).slice(0, 2);
    return `<article class="room" data-type="${esc(k)}">
  <div class="room-media">${ph.length ? ph.map((p, i) => img(p, t.name, i ? 'second' : '')).join('') : img('')}</div>
  <div class="room-body">
    <h3>${esc(caps(typeName(t.name)))}</h3>
    ${pick(s.text) ? `<p class="room-text">${esc(pick(s.text))}</p>` : ''}
    <p class="room-meta">${t.cap} ${w('upTo')} · ${roomsOf(k).length} ${lang() === 'ka' ? 'ნომერი' : lang() === 'ru' ? 'ном.' : 'rooms'}</p>
    <p class="room-price"><span class="amount">${lang() === 'ka' ? `${minPrice(k)} ₾${w('from')}` : `${w('from')} ${minPrice(k)} ₾`}</span><span class="per"> / ${w('perNight')}</span></p>
    <p class="room-avail" aria-live="polite"></p>
    <button type="button" class="btn btn-line" data-pick="${esc(k)}">${w('choose')}</button>
  </div>
</article>`;
  }

  const opts = (from, to, sel) => Array.from({ length: to - from + 1 }, (_, i) => from + i).map(n => `<option value="${n}"${n === sel ? ' selected' : ''}>${n}</option>`).join('');
  function bookBar() {
    return `<form class="bar" id="bar" aria-label="${w('check')}">
  <label><span>${w('checkin')}</span><input type="date" name="from" required></label>
  <label><span>${w('checkout')}</span><input type="date" name="to" required></label>
  <label><span>${w('adults')}</span><select name="adults">${opts(1, 8, 2)}</select></label>
  <label><span>${w('kids')}</span><select name="kids">${opts(0, 6, 0)}</select></label>
  <button class="btn btn-accent" type="submit">${w('check')}</button>
</form>`;
  }
  function bookForm() {
    return `<section class="book" id="book">
  <h2>${caps(w('book'))}</h2>
  <div class="book-sum" id="sum" aria-live="polite">${w('pickDates')}</div>
  <form id="req" novalidate>
    <label><span>${w('name')}</span><input name="name" autocomplete="name" required></label>
    <label><span>${w('phone')}</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required></label>
    <label class="wide"><span>${w('wish')} <small>(${w('optional')})</small></span><textarea name="wish" rows="2" maxlength="500"></textarea></label>
    <button class="btn btn-accent wide" type="submit">${w('send')}</button>
    <p class="note wide">${w('noPay')}</p>
    <p class="msg wide" id="msg" role="status"></p>
  </form>
</section>`;
  }
  function demoPanel() {
    const mine = J.hotel && J.hotel.mine;
    return `<details class="demo"${mine ? '' : ''}>
  <summary>Visit2.ge · ${mine ? (lang() === 'ka' ? 'შენი საიტი' : 'Your site') : (lang() === 'ka' ? 'დემო' : 'Demo')}</summary>
  <p class="demo-head"><a href="index.html">${lang() === 'ka' ? 'ყველა სასტუმრო' : 'All hotels'}</a> · <a href="admin.html?h=${esc(slug())}">${w('admin')} (PIN 1234)</a></p>
  <p class="demo-note">${w('demo')}</p>
  ${mine ? `<div class="demo-row">${Object.entries(THEMES).map(([id, t]) => `<button type="button" data-theme="${id}" aria-pressed="${id === theme()}">${esc(pick(t.name))}</button>`).join('')}</div>
  <div class="demo-row">${ACCENTS.map(a => `<button type="button" class="sw" data-accent="${a}" style="--c:${a}" aria-label="${w('colour')} ${a}" aria-pressed="${a.toLowerCase() === accent().toLowerCase()}"></button>`).join('')}</div>` : ''}
</details>`;
  }

  // ---------- booking ----------
  const sel = { from: '', to: '', adults: 2, kids: 0, type: '' };
  // dates and guests from the Visit2.ge search (hotel.html?h=…&from=…&to=…&g=…)
  if (/^\d{4}-\d{2}-\d{2}$/.test(params.get('from') || '') && /^\d{4}-\d{2}-\d{2}$/.test(params.get('to') || '') && params.get('to') > params.get('from')) {
    sel.from = params.get('from'); sel.to = params.get('to'); sel.adults = Math.max(1, Math.min(8, +params.get('g') || 2));
  }
  const fmtN = n => `${n} ₾`;
  function summary() {
    const el = $('#sum'); if (!el) return;
    const { from, to } = sel, g = sel.adults + sel.kids;
    document.querySelectorAll('.room').forEach(r => { r.classList.toggle('picked', r.dataset.type === sel.type); });
    if (!from || !to || to <= from) { el.innerHTML = w('pickDates'); availability(); return; }
    const n = J.nights(from, to), free = k => roomsOf(k).filter(r => J.roomFree(r.id, from, to)).length;
    let type = sel.type && free(sel.type) && J.rateFor(sel.type, g) ? sel.type : null;
    if (!type) { const o = J.findOffer(from, to, g); type = o ? o.type : null; }
    availability();
    if (!type) {
      const nx = J.nextOffer(from, n, g);
      el.innerHTML = `<b>${w('none')}</b>${nx ? `<br>${w('nearest')}: <button type="button" class="link" data-next="${nx.from}|${nx.to}">${J.fmtRange(nx.from, nx.to)}</button>` : ''}`;
      return;
    }
    sel.offer = type;
    el.innerHTML = `<b>${esc(typeName(J.types[type].name))}</b><br>${J.fmtRange(from, to)} · ${n} ${w('nights')} · ${g} ${lang() === 'ka' ? 'სტუმარი' : lang() === 'ru' ? 'гост.' : 'guests'}<br><span class="sum-total">${w('estimate')}: ${fmtN(J.quote(type, from, to, g))}</span>`;
  }
  function availability() {
    const { from, to } = sel, g = sel.adults + sel.kids, ok = from && to && to > from;
    document.querySelectorAll('.room').forEach(r => {
      const k = r.dataset.type, out = r.querySelector('.room-avail');
      if (!ok) { out.textContent = ''; return; }
      const free = roomsOf(k).filter(x => J.roomFree(x.id, from, to)).length, fits = J.rateFor(k, g);
      out.textContent = !fits ? `${J.types[k].cap} ${w('upTo')}` : free ? `${w('left')}: ${free} · ${w('total')} ${fmtN(J.quote(k, from, to, g))}` : w('none');
      out.dataset.state = !fits || !free ? 'no' : 'yes';
    });
  }

  function wire() {
    const bar = $('#bar'), t0 = J.today();
    bar.from.min = t0; bar.to.min = J.addDays(t0, 1);
    Object.assign(bar.from, { value: sel.from }); Object.assign(bar.to, { value: sel.to });
    bar.adults.value = sel.adults; bar.kids.value = sel.kids;
    const read = () => {
      sel.from = bar.from.value; sel.to = bar.to.value; sel.adults = +bar.adults.value; sel.kids = +bar.kids.value;
      if (sel.from && (!sel.to || sel.to <= sel.from)) { sel.to = J.addDays(sel.from, 2); bar.to.value = sel.to; }
      bar.to.min = sel.from ? J.addDays(sel.from, 1) : J.addDays(t0, 1);
      summary();
    };
    bar.addEventListener('change', read);
    bar.addEventListener('submit', e => { e.preventDefault(); read(); $('#rooms').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
    document.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { sel.type = b.dataset.pick; summary(); $('#book').scrollIntoView({ behavior: 'smooth' }); if (!sel.from) bar.from.focus(); }));
    $('#sum').addEventListener('click', e => { const b = e.target.closest('[data-next]'); if (!b) return; [sel.from, sel.to] = b.dataset.next.split('|'); bar.from.value = sel.from; bar.to.value = sel.to; summary(); });
    $('#req').addEventListener('submit', send);
    if ($('#foodMore')) {
      $('#foodMore').addEventListener('click', openFood);
      $('#foodX').addEventListener('click', () => $('#foodDlg').close());
      $('#foodDlg').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
    }
    document.querySelectorAll('button[data-lang]').forEach(b => b.addEventListener('click', () => { I.set(b.dataset.lang); }));
    document.querySelectorAll('button[data-theme]').forEach(b => b.addEventListener('click', () => { params.delete('theme'); saveLocal({ theme: b.dataset.theme, accent: '' }); render(); }));
    document.querySelectorAll('button[data-accent]').forEach(b => b.addEventListener('click', () => { saveLocal({ accent: b.dataset.accent }); render(); }));
    summary();
  }

  async function send(e) {
    e.preventDefault();
    const f = e.target, msg = $('#msg'), g = sel.adults + sel.kids;
    const name = f.name.value.trim(), phone = f.phone.value.trim();
    msg.dataset.state = 'bad';
    if (!sel.from || !sel.to || sel.to <= sel.from) { msg.textContent = w('pickDates'); $('#bar').from.focus(); return; }
    if (!name || phone.replace(/\D/g, '').length < 9) { msg.textContent = w('needName'); (name ? f.phone : f.name).focus(); return; }
    const btn = f.querySelector('button'); btn.disabled = true;
    const req = J.createRequest({ from: sel.from, to: sel.to, guests: g, children: sel.kids, name, phone, source: 'site', type: sel.offer || sel.type || undefined, wish: f.wish.value });
    const out = await req.saved;
    btn.disabled = false;
    if (out && out.ok) { msg.dataset.state = 'ok'; msg.textContent = w('sent'); f.reset(); }
    else msg.textContent = (out && out.msg) || w('err');
  }

  // ---------- start ----------
  J.ready.then(loadContent).then(() => {
    render();
    if (I) I.onChange(() => render());
    J.onChange(() => summary());
    if (window.JC && window.JC.onChange) window.JC.onChange(() => render());
  });
})();
