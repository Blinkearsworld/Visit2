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
  const caps = s => (theme() === 'opal' ? MT(s) : s);
  const pick = v => (v == null ? '' : typeof v === 'string' ? v : v[lang()] || v.ka || '');

  // ---------- templates ----------
  // Template ids are colour names; the colour is only the default, owners can change it.
  const THEMES = {
    opal: { name: 'Opal', accent: '#0E857D' },
    onyx: { name: 'Onyx', accent: '#3E9B5F' },
    jade: { name: 'Jade', accent: '#3F7A4E' },
    amber: { name: 'Amber', accent: '#C2410C' },
    indigo: { name: 'Indigo', accent: '#B08D57' },
    ivory: { name: 'Ivory', accent: '#2F5A8A' },
    cobalt: { name: 'Cobalt', accent: '#1F6FA8' },
    lilac: { name: 'Lilac', accent: '#7B3E72' },
    umber: { name: 'Umber', accent: '#9A4A2C' },
    alba: { name: 'Alba', accent: '#1F1A17' },
  };
  // Old template ids, kept so saved demo sites and old links still work.
  const OLD = { kva: 'opal', ezo: 'jade', kalaki: 'umber', zghva: 'cobalt', ghvino: 'lilac', minimali: 'alba', tye: 'onyx', butiki: 'indigo', peradi: 'amber', klasika: 'ivory' };
  const themeId = t => OLD[t] || t;
  const ACCENTS = ['#0E857D', '#3F7A4E', '#1F7FB0', '#2F5A8A', '#B4472F', '#E2563B', '#7A2638', '#8A5A2B', '#6B4A8A', '#1F1A17'];

  // ---------- interface words ----------
  const W = {
    about: ['ჩვენ შესახებ', 'About', 'О нас'], rooms: ['ნომრები', 'Rooms', 'Номера'], amen: ['რა გვაქვს', 'Amenities', 'Удобства'],
    gallery: ['ფოტოები', 'Photos', 'Фото'], where: ['სად ვართ', 'Location', 'Где мы'], faq: ['ხშირი კითხვები', 'FAQ', 'Вопросы'],
    food: ['რესტორნები და კაფეები ახლოს', 'Restaurants and cafés nearby', 'Рестораны и кафе рядом'], recommended: ['რეკომენდებული', 'Recommended', 'Рекомендуем'],
    foodAll: ['ყველა რესტორანი და კაფე ახლოს', 'All restaurants and cafés nearby', 'Все рестораны и кафе рядом'], foodAllH: ['რესტორნები და კაფეები, ჯერ უახლოესი', 'Restaurants and cafés, nearest first', 'Рестораны и кафе, сначала ближайшие'],
    foodMap: ['რუკაზე ნახვა', 'Open map', 'На карте'], foodWalk: ['ფეხით ~{n} წთ', '~{n} min walk', '~{n} мин пешком'], foodHours: ['ღიაა 10:00–23:00', 'Open 10:00–23:00', 'Открыто 10:00–23:00'],
    foodDemo: ['დემო: ნამდვილ საიტზე აქ იქნება რესტორნის ტელეფონი, მისამართი, მენიუ და ფოტოები.', 'Demo: the real site shows the phone, address, menu and photos here.', 'Демо: на настоящем сайте здесь будут телефон, адрес, меню и фото.'],
    foodAllPlaces: ['ყველა რესტორანი და კაფე', 'All restaurants and cafés', 'Все рестораны и кафе'],
    foodKind: ['სამზარეულო', 'Cuisine', 'Кухня'], foodAny: ['ყველა', 'All', 'Все'], close: ['დახურვა', 'Close', 'Закрыть'],
    foodOsm: ['რუკა და ადგილები: © OpenStreetMap-ის მონაწილეები.', 'Map and places: © OpenStreetMap contributors.', 'Карта и места: © участники OpenStreetMap.'],
    prevPhoto: ['წინა ფოტო', 'Previous photo', 'Предыдущее фото'], nextPhoto: ['შემდეგი ფოტო', 'Next photo', 'Следующее фото'],
    hostTip: ['მასპინძელი გირჩევთ', 'Host’s tip', 'Совет хозяина'], mapLabel: ['რუკა: სასტუმრო და ახლომახლო ადგილები', 'Map: the hotel and places nearby', 'Карта: отель и места рядом'],
    foodNote: ['სია Visit2.ge-დანაა. „რეკომენდებული“ რესტორნის ფასიანი ადგილია.', 'List from Visit2.ge. “Recommended” is a paid spot.', 'Список от Visit2.ge. «Рекомендуем» — платное размещение.'],
    sampleName: ['შენი სასტუმრო', 'Your Hotel', 'Ваш отель'], sampleCity: ['ქალაქი', 'Town', 'Город'],
    sampleTag: ['აქ ერთი წინადადება შენს სასტუმროზე', 'One sentence about your place', 'Одно предложение о вашем отеле'],
    sampleAbout: ['აქ იქნება შენი სასტუმროს აღწერა: რით არის გამორჩეული, რა არის ახლოს და რატომ ბრუნდებიან სტუმრები. ტექსტს და ფოტოებს ადმინში შეცვლი.', 'Your description goes here: what makes your place special, what is nearby and why guests come back. Change texts and photos in the admin.', 'Здесь будет описание: чем особенно ваше место, что рядом и почему гости возвращаются. Тексты и фото меняются в админке.'],
    sampleAddr: ['შენი მისამართი', 'Your address', 'Ваш адрес'],
    book: ['დაჯავშნა', 'Book', 'Забронировать'], bookShort: ['ჯავშანი', 'Book', 'Бронь'], checkin: ['შესვლა', 'Check-in', 'Заезд'], checkout: ['გასვლა', 'Check-out', 'Выезд'],
    adults: ['სტუმარი 10 წლიდან', 'Guests 10+', 'Гости от 10 лет'], kids: ['ბავშვი 10 წლამდე', 'Children under 10', 'Дети до 10 лет'],
    name: ['სახელი', 'Name', 'Имя'], phone: ['ტელეფონი', 'Phone', 'Телефон'], wish: ['სპეციალური მოთხოვნა', 'Special request', 'Особые пожелания'],
    optional: ['არასავალდებულო', 'optional', 'необязательно'], send: ['მოთხოვნის გაგზავნა', 'Send request', 'Отправить запрос'],
    check: ['თავისუფალი ნომრები', 'Check availability', 'Свободные номера'], perNight: ['ღამე', 'night', 'ночь'], from: ['-დან', 'from', 'от'],
    upTo: ['სტუმრამდე', 'guests max', 'гостей макс.'], left: ['თავისუფალი', 'available', 'свободно'], none: ['ამ თარიღებზე თავისუფალი არ არის', 'Not available on these dates', 'На эти даты нет мест'],
    pickDates: ['აირჩიეთ თარიღები', 'Choose dates', 'Выберите даты'], nights: ['ღამე', 'nights', 'ночей'], total: ['სულ', 'Total', 'Итого'],
    nearest: ['უახლოესი თავისუფალი', 'Nearest available', 'Ближайшие свободные'], choose: ['ეს ნომერი', 'This room', 'Этот номер'],
    consent: ['მოთხოვნის გაგზავნით თქვენი სახელი და ტელეფონი გადაეცემა სასტუმროს ჯავშნის დასადასტურებლად. <a href="privacy.html" target="_blank">კონფიდენციალურობა</a>', 'By sending a request, your name and phone go to the hotel to confirm the booking. <a href="privacy.html" target="_blank">Privacy</a>', 'Отправляя запрос, вы передаёте имя и телефон отелю для подтверждения брони. <a href="privacy.html" target="_blank">Конфиденциальность</a>'],
    noPay: ['გადახდა ახლა არ არის საჭირო. სასტუმრო დაგიკავშირდებათ და ჯავშანს დაგიდასტურებთ.', 'No payment now. The hotel will call you to confirm.', 'Оплата сейчас не нужна. Отель свяжется с вами для подтверждения.'],
    sent: ['მოთხოვნა გაიგზავნა. სასტუმრო მალე დაგიკავშირდებათ.', 'Request sent. The hotel will contact you soon.', 'Запрос отправлен. Отель скоро свяжется с вами.'],
    needName: ['ჩაწერეთ სახელი და ტელეფონი', 'Enter your name and phone', 'Укажите имя и телефон'], err: ['ვერ გაიგზავნა. სცადეთ ხელახლა ან დაგვირეკეთ.', 'Could not send. Try again or call us.', 'Не удалось отправить. Попробуйте ещё раз или позвоните.'],
    call: ['დარეკვა', 'Call', 'Позвонить'], map: ['რუკაზე ნახვა', 'Open map', 'На карте'], estimate: ['საორიენტაციო ფასი', 'Estimated price', 'Ориентировочная цена'],
    seasonsH: ['ფასები სეზონების მიხედვით', 'Prices by season', 'Цены по сезонам'],
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
    theme: 'opal', accent: '',
    hero: { img: 'img/demo/hero.jpg', tagline: { ka: 'რვა თბილი ნომერი ტყის პირას, საბაგიროდან ხუთ წუთში', en: 'Eight warm rooms at the forest edge, five minutes from the lifts', ru: 'Восемь тёплых номеров у леса, в пяти минутах от подъёмника' } },
    about: { img: 'img/demo/facade.jpg', text: { ka: 'პატარა საოჯახო სასტუმრო, სადაც დილით ტყის სუნი შემოდის და საღამოს ბუხართან ვსხდებით. ყველა ნომერს აქვს სამზარეულო და აივანი, ეზოში ბავშვებისთვის ადგილია, ზამთარში საბაგირომდე ფეხით მიხვალთ.', en: 'A small family hotel where mornings smell of pine and evenings are spent by the fire. Every room has a kitchen and a balcony, the garden has room for kids, and in winter the lifts are a short walk away.', ru: 'Небольшой семейный отель: утром пахнет лесом, вечером собираемся у камина. В каждом номере кухня и балкон, во дворе есть место для детей, зимой до подъёмника можно дойти пешком.' } },
    amenities: ['wifi', 'parking', 'kitchen', 'fireplace', 'garden', 'pool', 'ski', 'pets'],
    gallery: ['img/demo/lounge.jpg', 'img/demo/fire.jpg', 'img/demo/garden.jpg', 'img/demo/pool.jpg', 'img/demo/games.jpg', 'img/demo/pergola.jpg'],
    rooms: {
      std: { photos: ['img/rooms/lake-double.jpg', 'img/rooms/lake-double2.jpg'], text: { ka: 'მყუდრო ნომერი ორისთვის, აივნით ტყეზე.', en: 'A cosy room for two with a forest-view balcony.', ru: 'Уютный номер для двоих с балконом на лес.' } },
      family: { photos: ['img/rooms/lake-twin.jpg', 'img/rooms/lake-twin2.jpg'], text: { ka: 'საძინებელი და მისაღები სამზარეულოთი. ოჯახისთვის ხუთამდე სტუმარი.', en: 'Bedroom plus living room with kitchenette. Up to five guests.', ru: 'Спальня и гостиная с кухней. До пяти гостей.' } },
      suite: { photos: ['img/rooms/lake-suite.jpg'], text: { ka: 'ორი საძინებელი, დიდი მისაღები და ორი აივანი. ორი ოჯახისთვის.', en: 'Two bedrooms, a large living room and two balconies.', ru: 'Две спальни, большая гостиная и два балкона.' } },
    },
    location: { text: { ka: 'ტყის ქუჩა 12. ცენტრამდე 10 წუთი ფეხით, საბაგირომდე 400 მ.', en: '12 Forest St. 10 minutes on foot to the centre, 400 m to the lifts.', ru: 'Лесная ул. 12. До центра 10 минут пешком, до подъёмника 400 м.' }, map: 'https://www.google.com/maps/search/?api=1&query=Bakuriani' },
  };

  // ---------- state ----------
  let C = {}; // site content from the server (or DEMO)
  const params = new URLSearchParams(location.search);
  const sample = params.get('sample') === '1';
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
  const theme = () => { const t = themeId(params.get('theme') || S().theme); return THEMES[t] ? t : 'opal'; };
  // a template preview (?theme=…) shows the template's own colour; otherwise the hotel's
  const accent = () => (params.get('theme') && THEMES[themeId(params.get('theme'))] ? THEMES[theme()].accent : S().accent || THEMES[theme()].accent);
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


  // ---------- template layouts ----------
  // Each template has its own order of sections and some blocks only it uses. Colour and font stay the owner's choice.
  const LAYOUT = {
    opal: ['hero', 'bookBar', 'seasons', 'about', 'amen', 'rooms', 'gallery', 'book', 'where', 'food'],   // seasonal: winter/summer prices up front
    cobalt: ['hero', 'bookBar', 'facts', 'rooms', 'gallery', 'about', 'amen', 'book', 'where', 'food'],   // seaside: quick facts, rooms early
    umber: ['hero', 'facts', 'where', 'rooms', 'book', 'about', 'amen', 'gallery', 'food'],                // apartments: address and map first
    lilac: ['hero', 'about', 'gallery', 'rooms', 'amen', 'book', 'where', 'food'],                         // wine: story and photos
    jade: ['hero', 'about', 'amen', 'rooms', 'gallery', 'book', 'where', 'food'],                          // family: the host and what is included
    indigo: ['hero', 'bookBar', 'compare', 'gallery', 'about', 'amen', 'book', 'where', 'food'],           // boutique: room comparison
    amber: ['hero', 'bookBar', 'compare', 'amen', 'about', 'gallery', 'book', 'where', 'food'],            // hostel: prices side by side
    onyx: ['hero', 'amen', 'about', 'gallery', 'rooms', 'book', 'where', 'food'],                          // cottage: the place first
    ivory: ['hero', 'about', 'rooms', 'gallery', 'amen', 'book', 'where', 'food'],                         // old-town house
    alba: ['hero', 'about', 'rooms', 'book', 'where', 'food'],                                             // minimal: only what matters
  };
  const LAYOUT_OF = th => LAYOUT[th] || LAYOUT.opal;
  const BLOCK = {
    hero: (s, h) => `<section class="hero">
    <div class="hero-media">${img(s.hero?.img, h.name)}</div>
    <div class="hero-text">
      ${h.city ? `<p class="hero-city">${esc(h.city)}</p>` : ''}
      <h1 class="hero-name">${esc(caps(h.name || ''))}</h1>
      <p class="hero-tag">${esc(pick(s.hero?.tagline))}</p>
    </div>
  </section>`,
    bookBar: () => bookBar(),
    about: s => `<section class="about" id="about">
    <div class="about-media">${img(s.about?.img)}</div>
    <div class="about-text"><h2>${caps(w('about'))}</h2><p>${esc(pick(s.about?.text))}</p></div>
  </section>`,
    amen: s => ((s.amenities || []).length ? `<section class="amen"><h2>${caps(w('amen'))}</h2><ul>${s.amenities.map(k => `<li><span aria-hidden="true">${AMEN[k]?.[0] || '•'}</span>${esc(amenText(k))}</li>`).join('')}</ul></section>` : ''),
    rooms: () => `<section class="rooms" id="rooms"><h2>${caps(w('rooms'))}</h2><div class="room-list">${typeIds().map(roomCard).join('')}</div></section>`,
    gallery: s => ((s.gallery || []).length ? `<section class="gallery"><h2>${caps(w('gallery'))}</h2><div class="grid">${s.gallery.map(g => img(g)).join('')}</div></section>` : ''),
    // the date bar is the only date picker: layouts without it near the top get it right above the request form
    book: () => (LAYOUT_OF(theme()).includes('bookBar') ? '' : bookBar()) + bookForm(),
    where: (s, h, c, tel) => `<section class="where" id="where">
    <h2>${caps(w('where'))}</h2>
    <p>${esc(pick(s.location?.text) || c.addrText || h.city || '')}</p>
    <div class="where-actions">
      ${tel ? `<a class="btn btn-ghost" href="${tel}">${w('call')} ${esc(c.phone)}</a>` : ''}
      ${s.location?.map || c.map ? `<a class="btn btn-ghost" href="${esc(s.location?.map || c.map)}" target="_blank" rel="noopener">${w('map')}</a>` : ''}
    </div>
    ${mapBlock()}
  </section>`,
    food: () => foodSection(),
    seasons: () => seasonsBlock(),
    facts: () => factsBlock(),
    compare: () => compareBlock(),
  };
  // prices by season, one season at a time (switch on top), for the cheapest version of each room type
  let seasonShown = '';
  function seasonsBlock() {
    const ids = Object.keys(J.SEASONS), now = J.siteSeason ? J.siteSeason() : '';
    if (!ids.length) return '';
    if (!ids.includes(seasonShown)) seasonShown = ids.includes(now) ? now : ids[0];
    const price = k => { const r = J.types[k].rates; const p = r.map(x => x.price?.[seasonShown]).filter(v => v > 0); return p.length ? Math.min(...p) : null; };
    return `<section class="seasons" id="seasons"><h2>${caps(w('seasonsH'))}</h2>
    <div class="season-tabs" role="group" aria-label="${esc(w('seasonsH'))}">${ids.map(id => `<button type="button" data-season="${esc(id)}" aria-pressed="${id === seasonShown}">${esc(J.SEASONS[id])}</button>`).join('')}</div>
    <ul class="season-list">${typeIds().map(k => { const p = price(k); return `<li><span>${esc(typeName(J.types[k].name))}</span><b>${p ? (lang() === 'ka' ? `${p} ₾${w('from')}` : `${w('from')} ${p} ₾`) : '—'}</b></li>`; }).join('')}</ul>
  </section>`;
  }
  // a strip of plain numbers: rooms, guests, price from
  function factsBlock() {
    const ks = typeIds(); if (!ks.length) return '';
    const rooms = ks.reduce((n, k) => n + roomsOf(k).length, 0), cap = Math.max(...ks.map(k => J.types[k].cap || 0)), from = Math.min(...ks.map(minPrice));
    return `<section class="facts"><ul>
    <li><b>${rooms}</b><span>${lang() === 'ka' ? 'ნომერი' : lang() === 'ru' ? 'номеров' : 'rooms'}</span></li>
    <li><b>${cap}</b><span>${w('upTo')}</span></li>
    <li><b>${from} ₾</b><span>${w('from').trim() || 'from'} / ${w('perNight')}</span></li>
  </ul></section>`;
  }
  // room types side by side; rows are .room so availability and "choose" work as with cards
  function compareBlock() {
    return `<section class="rooms compare" id="rooms"><h2>${caps(w('rooms'))}</h2>
    <div class="cmp">${typeIds().map(k => { const t = J.types[k]; return `<article class="room cmp-row" data-type="${esc(k)}">
      <h3>${esc(typeName(t.name))}</h3>
      <p class="cmp-cap">${t.cap} ${w('upTo')}</p>
      <p class="cmp-price">${lang() === 'ka' ? `${minPrice(k)} ₾${w('from')}` : `${w('from')} ${minPrice(k)} ₾`} <span>/ ${w('perNight')}</span></p>
      <p class="room-avail" aria-live="polite"></p>
      <button type="button" class="btn btn-line" data-pick="${esc(k)}">${w('choose')}</button>
    </article>`; }).join('')}</div>
  </section>`;
  }

  function render() {
    // a template sample (?sample=1) shows placeholder words instead of a real hotel's name and texts
    const s = sample ? { ...S(), hero: { ...S().hero, tagline: w('sampleTag') }, about: { ...S().about, text: w('sampleAbout') }, location: { ...S().location, text: w('sampleAddr') } } : S();
    const h = sample ? { ...(J.hotel || {}), name: w('sampleName'), city: w('sampleCity') } : (J.hotel || {}), c = contact(), th = theme();
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
  ${LAYOUT_OF(th).map(k => (BLOCK[k] ? BLOCK[k](s, h, c, tel) : '')).join('\n  ')}
</main>
<footer class="foot"><span>${esc(h.name || '')}${h.city ? ', ' + esc(h.city) : ''}</span><a href="https://visit2.ge" rel="noopener">Visit2.ge · ${w('directly')}</a></footer>
${isDemo() && !sample && J.hotel && J.hotel.mine ? demoPanel() : ''}${isDemo() ? backLink() : ''}`;
    if (wasOpen) { const d = document.querySelector('.demo'); if (d) d.open = true; }
    wire();
  }

  // ---------- places to eat nearby ----------
  // Real places come from OpenStreetMap (js/osm.js), around the hotel's pin.
  // The owner may hide a place and add their own tips, which come first ("the host recommends").
  // Only where there is no server (the static preview) the invented demo list in food.js is shown.
  let PL = null, plFor = '';               // places from the server for the current pin
  const pin = () => {
    const p = S().pin, h = J.hotel || {};
    if (p && Number.isFinite(+p.lat) && Number.isFinite(+p.lng)) return { lat: +p.lat, lng: +p.lng };
    return Number.isFinite(+h.lat) && h.lat != null ? { lat: +h.lat, lng: +h.lng } : null;
  };
  const metres = (a, b) => {
    const r = Math.PI / 180, da = (b.lat - a.lat) * r, dl = (b.lng - a.lng) * r;
    return Math.round(12742000 * Math.asin(Math.sqrt(Math.sin(da / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dl / 2) ** 2)));
  };
  // OpenStreetMap opening hours ("Mo-Su 10:00-23:00") in the guest's language
  const hoursText = h => {
    const L = { ka: ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი', 'ყოველდღე', 'დღე-ღამე'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Daily', 'Open 24 hours'], ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс', 'Ежедневно', 'Круглосуточно'] }[lang()] || [];
    if (h.trim() === '24/7') return L[8];
    return h.replace(/\bMo-Su\b/g, L[7]).replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, d => L[['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].indexOf(d)]).replace(/;\s*/g, '; ').replace(/\boff\b/g, '—');
  };
  const nameOf = n => (typeof n === 'string' ? n : (n[lang()] || n.def || n.ka || ''));
  // the owner's saved list comes with the content; sample hotels ask OpenStreetMap from the browser (kept a week here)
  async function loadPlaces() {
    const p = pin(); if (!p || sample || Array.isArray(S().food?.places) || !window.V2OSM) return;
    const key = 'v2-places2-' + p.lat.toFixed(4) + ',' + p.lng.toFixed(4); if (plFor === key) return; plFor = key;
    // sample hotels: the list saved with the site every week (data/places.json), no waiting for OpenStreetMap
    if (isDemo()) try {
      const d = await (await fetch('data/places.json')).json(), list = d.hotels?.[slug()];
      if (list?.length) { PL = list; render(); return; }
    } catch (e) { /* ask OpenStreetMap below */ }
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < 7 * 864e5) { PL = c.places; render(); return; } } catch (e) { /* ask again */ }
    try { PL = await window.V2OSM.places(p.lat, p.lng); } catch (e) { return; }
    if (PL.length) try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), places: PL })); } catch (e) { /* full */ }
    render();
  }
  // the list shown: host's tips, then real places (minus hidden), nearest first
  function foodList() {
    const f = S().food || {}, hide = new Set(f.hide || []), p = pin();
    const own = (f.own || []).filter(x => pick(x.name)).map((x, i) => ({ id: 'own' + i, name: pick(x.name), kind: x.kind || 'restaurant', note: pick(x.note), own: true, m: null,
      phone: x.phone || '', web: /^https?:\/\//i.test(x.web || '') ? x.web : '', mapUrl: /^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.)/i.test(x.map || '') ? x.map : '' }));
    const real = Array.isArray(f.places) ? f.places : PL;
    if (real) return [...own, ...real.filter(x => !hide.has(x.id)).map(x => ({ ...x, name: nameOf(x.name), m: p ? metres(p, x) : x.m }))];
    // invented names only in the offline preview (GitHub Pages, local testing); on visit2.ge only real places
    const F = window.V2FOOD, offline = /github\.io$/.test(location.hostname) || location.protocol === 'file:' || ['8765', '8799'].includes(location.port);
    if (!offline || !isDemo() || !F) return own;
    return [...own, ...F.all((J.hotel || {}).city).map(x => ({ ...x, id: 'demo-' + x.name, demo: true }))];
  }
  const shortList = all => [...all].sort((a, b) => (b.own - a.own) || ((b.sponsored || 0) - (a.sponsored || 0)) || ((a.m ?? 0) - (b.m ?? 0))).slice(0, 4);

  function foodSection() {
    const all = foodList(); if (!all.length) return '';
    return `<section class="food" id="food">
  <h2>${caps(w('food'))}</h2>
  <ul class="food-list">${shortList(all).map(foodItem).join('')}</ul>
  ${all.length > 4 ? `<button type="button" class="btn btn-line food-more" id="foodMore" aria-haspopup="dialog">${w('foodAll')} (${all.length})</button>` : ''}
  <p class="food-note">${Array.isArray(S().food?.places) || PL ? w('foodOsm') : w('foodNote')}</p>
</section>
<dialog class="food-dlg place-dlg" id="placeDlg" aria-labelledby="placeH">
  <div class="food-dlg-head"><span></span><button type="button" class="food-x" data-close aria-label="${w('close')}">×</button></div>
  <div class="place-body"></div>
</dialog>
<dialog class="food-dlg" id="foodDlg" aria-labelledby="foodDlgH">
  <div class="food-dlg-head"><h2 id="foodDlgH">${w('foodAllH')}</h2><button type="button" class="food-x" id="foodX" aria-label="${w('close')}">×</button></div>
  <div class="food-filter" role="group" aria-label="${w('foodKind')}"></div>
  <ul class="food-list food-full"></ul>
</dialog>`;
  }
  const dist = m => (m < 1000 ? `${m} ${lang() === 'ka' ? 'მ' : lang() === 'ru' ? 'м' : 'm'}` : `${(m / 1000).toFixed(1)} ${lang() === 'ka' ? 'კმ' : lang() === 'ru' ? 'км' : 'km'}`);
  const kindName = k => { const K = window.V2FOOD?.KIND || {}; const n = K[k] || K.restaurant || ['']; return n[['ka', 'en', 'ru'].indexOf(lang())] || n[0]; };
  const foodItem = r => `<li><button type="button" class="food-item${r.own || r.sponsored ? ' rec' : ''}" data-food="${esc(r.id)}">
    ${r.own ? `<span class="food-badge">${w('hostTip')}</span>` : r.sponsored ? `<span class="food-badge">${w('recommended')}</span>` : ''}
    <b>${esc(r.name)}</b>
    <span class="food-meta">${[kindName(r.kind), r.m != null ? dist(r.m) : '', r.price ? '₾'.repeat(r.price) : ''].filter(Boolean).map(esc).join(' · ')}</span>
  </button></li>`;
  // one place: its card with what OpenStreetMap knows (hours, phone, website) and a map link
  function openPlace(id) {
    const r = foodList().find(x => x.id === id); if (!r) return;
    const city = (J.hotel || {}).city || '', d = $('#placeDlg');
    const where = r.lat != null ? `${r.lat},${r.lng}` : `${r.name} ${city}`;
    d.querySelector('.place-body').innerHTML = `${r.own ? `<span class="food-badge">${w('hostTip')}</span>` : r.sponsored ? `<span class="food-badge">${w('recommended')}</span>` : ''}
      <h2 id="placeH">${esc(r.name)}</h2>
      <p class="food-meta">${esc([kindName(r.kind), r.cuisine && !/georgian/i.test(r.cuisine) ? r.cuisine : '', r.price ? '₾'.repeat(r.price) : ''].filter(Boolean).join(' · '))}</p>
      ${r.note ? `<p>${esc(r.note)}</p>` : ''}
      <ul class="place-facts">
        ${r.m != null ? `<li>📍 ${dist(r.m)} · ${w('foodWalk').replace('{n}', Math.max(1, Math.round(r.m / 80)))}</li>` : ''}
        ${r.hours ? `<li>🕙 ${esc(hoursText(r.hours))}</li>` : r.demo ? `<li>🕙 ${w('foodHours')}</li>` : ''}
        ${r.phone ? `<li>📞 <a href="tel:${esc(r.phone.replace(/[^\d+]/g, ''))}">${esc(r.phone)}</a></li>` : ''}
        ${r.web ? `<li>🌐 <a href="${esc(r.web)}" target="_blank" rel="noopener nofollow">${esc(r.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 40))}</a></li>` : ''}
      </ul>
      <a class="btn btn-accent" href="${esc(r.mapUrl || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(where))}" target="_blank" rel="noopener">${w('foodMap')}</a>`;
    if ($('#foodDlg').open) $('#foodDlg').close();
    d.showModal();
  }
  // the full list: every place nearby, nearest first, with a filter by kind
  function openFood() {
    const all = foodList(), dlg = $('#foodDlg');
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

  // ---------- the map (OpenStreetMap through Leaflet, loaded only when the map comes near the screen) ----------
  let leaflet = null;
  const loadLeaflet = () => leaflet || (leaflet = new Promise((ok, bad) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'vendor/leaflet/leaflet.css'; document.head.append(css);
    const s = document.createElement('script'); s.src = 'vendor/leaflet/leaflet.js'; s.onload = () => ok(window.L); s.onerror = bad; document.head.append(s);
  }));
  const mapBlock = () => (pin() && !sample ? `<div class="v2map" id="v2map" role="region" aria-label="${esc(w('mapLabel'))}"></div>` : '');
  function drawMap() {
    const el = $('#v2map'), p = pin(); if (!el || !p) return;
    const go = () => loadLeaflet().then(L => {
      if (!el.isConnected) return;
      const touch = matchMedia('(pointer: coarse)').matches;
      const m = L.map(el, { scrollWheelZoom: false, dragging: !touch, tap: false, zoomControl: true, attributionControl: true }).setView([p.lat, p.lng], 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(m);
      m.attributionControl.setPrefix(false);
      const home = L.divIcon({ className: 'v2pin', html: '<span></span>', iconSize: [30, 30], iconAnchor: [15, 30] });
      L.marker([p.lat, p.lng], { icon: home, title: (J.hotel || {}).name || '', keyboard: false }).addTo(m);
      const near = foodList().filter(x => x.lat != null).slice(0, 25);
      near.forEach(x => L.circleMarker([x.lat, x.lng], { radius: 7, weight: 2, color: '#fff', fillColor: accent(), fillOpacity: 1 })
        .addTo(m).bindTooltip(esc(x.name)).on('click', () => openPlace(x.id)));
      if (near.length) m.fitBounds(L.latLngBounds([[p.lat, p.lng], ...near.slice(0, 8).map(x => [x.lat, x.lng])]).pad(0.15), { maxZoom: 16 });
    }).catch(() => { el.hidden = true; });
    if (!('IntersectionObserver' in window)) return go();
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: '400px' });
    io.observe(el);
  }
  function roomCard(k) {
    const t = J.types[k], s = S().rooms?.[k] || {}, ph = (s.photos || []).slice(0, 8);
    // one whole photo at a time; more photos are swiped (or clicked through with the arrows)
    return `<article class="room" data-type="${esc(k)}">
  <div class="room-media">${ph.length ? `<div class="slides">${ph.map(p => img(p, typeName(t.name))).join('')}</div>${ph.length > 1 ? `
    <button type="button" class="sl-btn sl-prev" data-sl="-1" aria-label="${w('prevPhoto')}" hidden>‹</button><button type="button" class="sl-btn sl-next" data-sl="1" aria-label="${w('nextPhoto')}">›</button>
    <span class="sl-count" aria-hidden="true">1 / ${ph.length}</span>` : ''}` : img('')}</div>
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
    <p class="note wide">${w('consent')}</p>
    <p class="msg wide" id="msg" role="status"></p>
  </form>
</section>`;
  }
  // one clear button back to Visit2.ge: a template sample goes back to the templates, a hotel to the hotel list
  function backLink() {
    const to = sample ? `owners.html?v=${V}#templates` : `index.html?v=${V}`;
    const txt = sample ? { ka: 'შაბლონებზე დაბრუნება', en: 'Back to templates', ru: 'Назад к шаблонам' } : { ka: 'ყველა სასტუმრო', en: 'All places to stay', ru: 'Все места' };
    return `<a class="v2-back" href="${to}"><span aria-hidden="true">←</span> ${esc(txt[lang()] || txt.en)}</a>`;
  }
  function demoPanel() {
    const mine = J.hotel && J.hotel.mine;
    return `<details class="demo"${mine ? '' : ''}>
  <summary>Visit2.ge · ${lang() === 'ka' ? 'შენი საიტი' : lang() === 'ru' ? 'Ваш сайт' : 'Your site'}</summary>
  <p class="demo-head"><a href="admin.html?h=${esc(slug())}">${w('admin')}</a></p>
  ${mine ? `<div class="demo-row">${Object.entries(THEMES).map(([id, t]) => `<button type="button" data-theme="${id}" aria-pressed="${id === theme()}">${esc(t.name)}</button>`).join('')}</div>
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
    document.querySelectorAll('#food, #foodDlg').forEach(el => el.addEventListener('click', e => { const b = e.target.closest('[data-food]'); if (b) openPlace(b.dataset.food); }));
    if ($('#placeDlg')) {
      $('#placeDlg').querySelector('[data-close]').addEventListener('click', () => $('#placeDlg').close());
      $('#placeDlg').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
    }
    if ($('#foodMore')) {
      $('#foodMore').addEventListener('click', openFood);
      $('#foodX').addEventListener('click', () => $('#foodDlg').close());
      $('#foodDlg').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
    }
    document.querySelectorAll('button[data-season]').forEach(b => b.addEventListener('click', () => { seasonShown = b.dataset.season; render(); }));
    document.querySelectorAll('button[data-lang]').forEach(b => b.addEventListener('click', () => { I.set(b.dataset.lang); }));
    document.querySelectorAll('button[data-theme]').forEach(b => b.addEventListener('click', () => { params.delete('theme'); saveLocal({ theme: b.dataset.theme, accent: '' }); render(); }));
    document.querySelectorAll('button[data-accent]').forEach(b => b.addEventListener('click', () => { saveLocal({ accent: b.dataset.accent }); render(); }));
    document.querySelectorAll('.room-media').forEach(m => {
      const sl = m.querySelector('.slides'); if (!sl || sl.children.length < 2) return;
      const n = sl.children.length, cnt = m.querySelector('.sl-count'), prev = m.querySelector('.sl-prev'), next = m.querySelector('.sl-next');
      const at = () => Math.round(sl.scrollLeft / sl.clientWidth);
      sl.addEventListener('scroll', () => { const i = at(); cnt.textContent = `${i + 1} / ${n}`; prev.hidden = i === 0; next.hidden = i === n - 1; }, { passive: true });
      m.addEventListener('click', e => { const b = e.target.closest('[data-sl]'); if (b) sl.scrollTo({ left: (at() + +b.dataset.sl) * sl.clientWidth, behavior: 'smooth' }); });
    });
    summary();
    drawMap();
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
    loadPlaces();
    if (window.JC && window.JC.onChange) window.JC.onChange(() => render());
  });
})();
