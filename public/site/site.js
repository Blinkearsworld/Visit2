/* Visit2 hotel site: one renderer, several templates (themes).
   Data: rooms, prices and availability from JIJI (js/store.js); the hotel's texts, photos, theme and colour from
   /api/content (content.site), edited in admin. Templates differ in CSS (site/themes/*.css) and a few layout flags. */
(() => {
  const J = window.JIJI, I = window.I18N, $ = s => document.querySelector(s);
  const V = (document.currentScript && document.currentScript.src.split('?v=')[1]) || '1';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lang = () => (I ? I.lang : 'ka');
  const caps = s => s;
  const pick = v => (v == null ? '' : typeof v === 'string' ? v : v[lang()] || v.ka || '');

  // ---------- templates ----------
  // Five templates on one design (the Visit2.ge look): they differ in the top of the page and the order of sections.
  // Template ids are colour names; colour and font are the owner's choice (admin → საიტის მართვა → იერსახე).
  const THEMES = {
    opal: { name: 'Opal', accent: '#0E857D' },    // a full photo, words in the middle
    amber: { name: 'Amber', accent: '#B4472F' },  // photo and words side by side
    cobalt: { name: 'Cobalt', accent: '#1F6FA8' }, // a mosaic of photos
    alba: { name: 'Alba', accent: '#1F1A17' },    // rooms and prices first
    jade: { name: 'Jade', accent: '#3F7A4E' },    // the story and the host first
  };
  // Earlier template ids, so saved sites and old links still open the nearest of the five.
  const OLD = { kva: 'opal', ezo: 'jade', kalaki: 'alba', zghva: 'cobalt', ghvino: 'jade', minimali: 'alba', tye: 'opal', butiki: 'cobalt', peradi: 'amber', klasika: 'amber',
    onyx: 'opal', indigo: 'cobalt', ivory: 'amber', lilac: 'jade', umber: 'alba' };
  const themeId = t => OLD[t] || t;
  // colours that work with white text and on a light page
  const ACCENTS = ['#0E857D', '#3F7A4E', '#1F6FA8', '#2F5A8A', '#B4472F', '#C2410C', '#7A2638', '#8A5A2B', '#6B4A8A', '#1F1A17'];

  // ---------- interface words ----------
  const W = {
    about: ['ჩვენ შესახებ', 'About', 'О нас'], rooms: ['ნომრები', 'Rooms', 'Номера'], amen: ['რა გვაქვს', 'Amenities', 'Удобства'],
    gallery: ['ფოტოები', 'Photos', 'Фото'], where: ['სად ვართ', 'Location', 'Где мы'], faq: ['ხშირი კითხვები', 'FAQ', 'Вопросы'],
    food: ['რესტორნები და კაფეები ახლოს', 'Restaurants and cafés nearby', 'Рестораны и кафе рядом'], adSample: ['რეკომენდებული · ნიმუში', 'Recommended · sample', 'Рекомендуем · образец'], recommended: ['რეკომენდებული', 'Recommended', 'Рекомендуем'],
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
    adults: ['უფროსები', 'Adults', 'Взрослые'], adultsAge: ['13 წლიდან', 'Ages 13 or above', 'От 13 лет'], kids: ['ბავშვები', 'Children', 'Дети'], kidsAge: ['2–12 წლის', 'Ages 2–12', 'От 2 до 12 лет'],
    babies: ['ჩვილები', 'Infants', 'Младенцы'], babiesAge: ['2 წლამდე', 'Under 2', 'До 2 лет'], pets: ['შინაური ცხოველი', 'Pets', 'Домашние животные'],
    petsOk: ['ცხოველით შეიძლება', 'Pets are welcome', 'Можно с животными'], petsNo: ['ამ სასტუმროში ცხოველით არ შეიძლება', 'Pets are not allowed here', 'С животными нельзя'],
    dates: ['თარიღები', 'Dates', 'Даты'], guestsW: ['სტუმრები', 'Guests', 'Гости'], addDates: ['აირჩიეთ', 'Add dates', 'Выбрать'],
    whenQ: ['როდის მოდიხართ?', 'When are you coming?', 'Когда приезжаете?'], whoQ: ['ვინ მოდის?', 'Who is coming?', 'Кто едет?'],
    arrive: ['ჩამოსვლა', 'Arriving', 'Заезд'], leave: ['წასვლა', 'Leaving', 'Выезд'], pickArrive: ['აირჩიეთ ჩამოსვლის დღე', 'Pick the day you arrive', 'Выберите день заезда'],
    pickLeave: ['ახლა აირჩიეთ წასვლის დღე', 'Now pick the day you leave', 'Теперь выберите день выезда'], clear: ['გასუფთავება', 'Clear', 'Сбросить'], save: ['შენახვა', 'Save', 'Сохранить'],
    seePrice: ['ფასის ნახვა', 'See prices', 'Узнать цены'], changeDates: ['თარიღების შეცვლა', 'Change dates', 'Изменить даты'], menu: ['მენიუ', 'Menu', 'Меню'],
    guestsN: ['{n} სტუმარი', '{n} guests', 'Гостей: {n}'], kidsN: ['{n} ბავშვი', '{n} children', 'детей: {n}'], babiesN: ['{n} ჩვილი', '{n} infants', 'младенцев: {n}'], petsN: ['ცხოველით', 'with pets', 'с животными'],
    kidsFree: ['ბავშვები 2–12 წლის უფასოდ', 'Children 2–12 stay free', 'Дети 2–12 лет бесплатно'], kidsFixed: ['ბავშვი 2–12 წლის: {p} ₾ ღამე', 'Child 2–12: {p} ₾ a night', 'Ребёнок 2–12 лет: {p} ₾ за ночь'],
    babiesFree: ['ჩვილები 2 წლამდე უფასოდ', 'Infants under 2 stay free', 'Младенцы до 2 лет бесплатно'], photos: ['ფოტოები', 'Photos', 'Фото'],
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
  // a real hotel starts empty (the owner fills it in the admin); sample hotels have their own texts; the offline preview uses DEMO
  const EMPTY = { hero: {}, about: {}, amenities: [], gallery: [], rooms: {}, location: {} };
  const S = () => {
    const d = demoHotel();
    const base = d ? { ...d.site, theme: d.theme, accent: d.accent } : isDemo() ? DEMO : EMPTY;
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
    // the admin's "preview" (unsaved changes) and, in the demo, the owner's own site saved in this browser
    const ls = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
    const KP = window.JC ? window.JC.K_PREVIEW : '';
    if (params.get('preview') === '1' && KP && ls(KP)) { C = ls(KP); return; }
    if (isDemo()) { if (J.hotel && J.hotel.mine) C = ls('v2-content-demo') || {}; return; }
    try { const r = await fetch('api/content', { cache: 'no-store' }); if (r.ok) C = (await r.json()).content || {}; } catch (e) { /* keep defaults */ }
  }

  // ---------- rendering ----------
  const minPrice = k => { const t = J.types[k]; return t && t.rates.length ? Math.min(...t.rates.map(J.fromPrice)) : 0; };
  const roomsOf = k => J.ROOMS.filter(r => r.type === k);
  const typeIds = () => Object.keys(J.types).filter(k => roomsOf(k).length);
  const img = (src, alt = '', cls = '') => src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">` : `<div class="ph ${cls}" aria-hidden="true"></div>`;


  // ---------- template layouts ----------
  // Every template uses the same sections; the top of the page and the order differ.
  const LAYOUT = {
    opal: ['heroFull', 'rooms', 'about', 'amen', 'gallery', 'where', 'food', 'book'],
    amber: ['heroSplit', 'about', 'rooms', 'amen', 'gallery', 'where', 'food', 'book'],
    cobalt: ['heroMosaic', 'rooms', 'amen', 'about', 'gallery', 'where', 'food', 'book'],
    alba: ['heroPlain', 'compare', 'rooms', 'book', 'about', 'amen', 'gallery', 'where', 'food'],
    jade: ['heroStory', 'about', 'amen', 'rooms', 'gallery', 'where', 'food', 'book'],
  };
  const LAYOUT_OF = th => LAYOUT[th] || LAYOUT.opal;
  const PHOTO_TOP = ['heroFull', 'heroStory'];
  const heroWords = (s, h) => `${h.city ? `<p class="hero-city">${esc(h.city)}</p>` : ''}
      <h1 class="hero-name">${esc(h.name || '')}</h1>
      ${pick(s.hero?.tagline) ? `<p class="hero-tag">${esc(pick(s.hero?.tagline))}</p>` : ''}`;
  const BLOCK = {
    heroFull: (s, h) => `<section class="hero hero-full">
    <div class="hero-media">${img(s.hero?.img, h.name)}</div>
    <div class="hero-in">${heroWords(s, h)}${pill()}</div>
  </section>`,
    heroSplit: (s, h) => `<section class="hero hero-split">
    <div class="hero-in">${heroWords(s, h)}${pill()}</div>
    <div class="hero-media">${img(s.hero?.img, h.name)}</div>
  </section>`,
    heroMosaic: (s, h) => { const ph = [s.hero?.img, ...(s.gallery || [])].filter(Boolean).slice(0, 5);
      return `<section class="hero hero-mosaic">
    <div class="hero-in">${heroWords(s, h)}${pill()}</div>
    <div class="mosaic n${ph.length}">${ph.map((p, i) => img(p, i ? '' : h.name)).join('')}</div>
  </section>`; },
    heroPlain: (s, h) => `<section class="hero hero-plain">
    <div class="hero-in">${heroWords(s, h)}${pill()}</div>
    <div class="hero-media">${img(s.hero?.img, h.name)}</div>
  </section>`,
    heroStory: (s, h) => `<section class="hero hero-story">
    <div class="hero-media">${img(s.hero?.img, h.name)}<div class="hero-in">${heroWords(s, h)}</div></div>
    <div class="hero-bar">${pill()}</div>
  </section>`,
    about: s => !pick(s.about?.text) ? '' : `<section class="about" id="about">
    <div class="about-media">${img(s.about?.img)}</div>
    <div class="about-text"><h2>${w('about')}</h2><p>${esc(pick(s.about?.text))}</p></div>
  </section>`,
    amen: s => ((s.amenities || []).length ? `<section class="amen"><h2>${w('amen')}</h2><ul>${s.amenities.map(k => `<li><span aria-hidden="true">${AMEN[k]?.[0] || '•'}</span>${esc(amenText(k))}</li>`).join('')}</ul>${kidsLine()}</section>` : ''),
    rooms: () => `<section class="rooms" id="rooms"><h2>${w('rooms')}</h2><div class="room-list">${typeIds().map(roomCard).join('')}</div></section>`,
    gallery: s => ((s.gallery || []).length ? `<section class="gallery" id="photos"><h2>${w('gallery')}</h2><div class="grid">${s.gallery.map(g => img(g)).join('')}</div></section>` : ''),
    book: () => bookForm(),
    where: (s, h, c, tel) => `<section class="where" id="where">
    <h2>${w('where')}</h2>
    <p>${esc(pick(s.location?.text) || c.addrText || h.city || '')}</p>
    <div class="where-actions">
      ${tel ? `<a class="btn btn-ghost" href="${tel}">${w('call')} ${esc(c.phone)}</a>` : ''}
      ${s.location?.map || c.map ? `<a class="btn btn-ghost" href="${esc(s.location?.map || c.map)}" target="_blank" rel="noopener">${w('map')}</a>` : ''}
    </div>
    ${mapBlock()}
  </section>`,
    food: () => foodSection(),
    compare: () => compareBlock(),
  };
  // what children and infants cost here (the owner sets it: like adults, free, or a price a night)
  const kidsRule = () => S().kids || {};
  function kidsLine() {
    const k = kidsRule(), parts = [];
    if (k.mode === 'free') parts.push(w('kidsFree')); else if (k.mode === 'fixed' && +k.price > 0) parts.push(w('kidsFixed').replace('{p}', +k.price));
    parts.push(w('babiesFree'));
    return `<p class="kids-line">${parts.map(esc).join(' · ')}</p>`;
  }
  // room types side by side with their prices (the Alba template shows this first)
  function compareBlock() {
    return `<section class="compare"><div class="cmp">${typeIds().map(k => { const t = J.types[k]; return `<a class="cmp-row" href="#room-${esc(k)}">
      <span class="cmp-name">${esc(typeName(t.name))}<small>${t.cap} ${w('upTo')}</small></span>
      <b class="cmp-price">${lang() === 'ka' ? `${minPrice(k)} ₾${w('from')}` : `${w('from')} ${minPrice(k)} ₾`}<small> / ${w('perNight')}</small></b>
    </a>`; }).join('')}</div></section>`;
  }

  function render() {
    // a template sample (?sample=1) shows placeholder words instead of a real hotel's name and texts
    const s = sample ? { ...S(), hero: { ...S().hero, tagline: w('sampleTag') }, about: { ...S().about, text: w('sampleAbout') }, location: { ...S().location, text: w('sampleAddr') } } : S();
    const h = sample ? { ...(J.hotel || {}), name: w('sampleName'), city: w('sampleCity') } : (J.hotel || {}), c = contact(), th = theme();
    const root = document.documentElement, lay = LAYOUT_OF(th);
    root.dataset.theme = th;
    root.style.setProperty('--accent', accent());
    root.dataset.font = S().font === 'serif' ? 'serif' : 'sans';
    root.toggleAttribute('data-photo', PHOTO_TOP.includes(lay[0]));
    $('#themeCss').href = `site/themes/${th}.css?v=${V}`;
    document.title = (h.name || '') + (h.city ? ' · ' + h.city : '');
    const tel = c.digits ? `tel:+${c.digits}` : '';
    const wasOpen = !!document.querySelector('.demo[open]');
    const has = id => lay.includes(id) && (id !== 'gallery' || (s.gallery || []).length) && (id !== 'food' || foodList().length);
    $('#app').innerHTML = `
<header class="top" id="topbar">
  <a class="brand" href="#top">${esc(h.name || '')}</a>
  <a class="btn btn-accent top-book" href="#book">${w('bookShort')}</a>
  <button type="button" class="menu-btn" id="menuBtn" aria-haspopup="dialog" aria-controls="menu" aria-label="${w('menu')}"><span class="burger" aria-hidden="true"><i></i><i></i><i></i></span></button>
</header>
<dialog class="menu" id="menu" aria-label="${w('menu')}">
  <div class="menu-in">
    <div class="menu-head"><b>${esc(h.name || '')}</b><button type="button" class="x" data-close aria-label="${w('close')}">×</button></div>
    <div class="menu-langs" role="group" aria-label="Language">${[['ka', 'ქართული'], ['en', 'English'], ['ru', 'Русский']].map(([l, n]) => `<button type="button" data-lang="${l}" aria-pressed="${l === lang()}">${n}</button>`).join('')}</div>
    <nav class="menu-links">
      <a href="#rooms" data-close>${w('rooms')}</a>
      ${has('gallery') ? `<a href="#photos" data-close>${w('gallery')}</a>` : ''}
      ${pick(s.about?.text) ? `<a href="#about" data-close>${w('about')}</a>` : ''}
      <a href="#where" data-close>${w('where')}</a>
      ${has('food') ? `<a href="#food" data-close>${w('food')}</a>` : ''}
      <a href="#book" data-close>${w('book')}</a>
    </nav>
    ${tel ? `<a class="btn btn-ghost menu-call" href="${tel}">${w('call')} ${esc(c.phone)}</a>` : ''}
  </div>
</dialog>
<main id="top">
  ${lay.map(k => (BLOCK[k] ? BLOCK[k](s, h, c, tel) : '')).join('\n  ')}
</main>
<footer class="foot"><span>${esc(h.name || '')}${h.city ? ', ' + esc(h.city) : ''}</span><a href="https://visit2.ge" rel="noopener">Visit2.ge · ${w('directly')}</a></footer>
${sheetHtml()}
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
    // sample paid places (site/ads.js), only on sample hotels; real hotels will get real ones from the server
    const ads = isDemo() && window.V2ADS && p ? window.V2ADS.near(p).map(x => ({ id: x.id, name: x.name[lang()] || x.name.ka, kind: x.kind, note: x.note[lang()] || x.note.ka, photo: x.photo, lat: x.lat, lng: x.lng, m: x.m, sponsored: true, sample: true })) : [];
    own.push(...ads);
    const real = Array.isArray(f.places) ? f.places : PL;
    if (real) return [...own, ...real.filter(x => !hide.has(x.id)).map(x => ({ ...x, name: nameOf(x.name), m: p ? metres(p, x) : x.m }))];
    // invented names only in the offline preview (GitHub Pages, local testing); on visit2.ge only real places
    const F = window.V2FOOD, offline = /github\.io$/.test(location.hostname) || location.protocol === 'file:' || ['8765', '8799'].includes(location.port);
    if (!offline || !isDemo() || !F) return own;
    return [...own, ...F.all((J.hotel || {}).city).map(x => ({ ...x, id: 'demo-' + x.name, demo: true }))];
  }
  const shortList = all => [...all].sort((a, b) => ((b.sponsored || 0) - (a.sponsored || 0)) || ((b.own || 0) - (a.own || 0)) || ((a.m ?? 0) - (b.m ?? 0))).slice(0, 4);

  function foodSection() {
    const all = foodList(); if (!all.length) return '';
    return `<section class="food" id="food">
  <h2>${caps(w('food'))}</h2>
  ${all.some(r => r.photo) ? `<ul class="food-list food-ads">${all.filter(r => r.photo).map(foodItem).join('')}</ul>` : ''}
  <ul class="food-list">${shortList(all.filter(r => !r.photo)).map(foodItem).join('')}</ul>
  ${all.filter(r => !r.photo).length > 4 ? `<button type="button" class="btn btn-line food-more" id="foodMore" aria-haspopup="dialog">${w('foodAll')} (${all.filter(r => !r.photo).length})</button>` : ''}
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
  const foodItem = r => `<li${r.photo ? ' class="ad"' : ''}><button type="button" class="food-item${r.own || r.sponsored ? ' rec' : ''}${r.photo ? ' has-ph' : ''}" data-food="${esc(r.id)}">
    ${r.photo ? `<img src="${esc(r.photo)}" alt="" loading="lazy">` : ''}
    ${r.sponsored ? `<span class="food-badge">${w(r.sample ? 'adSample' : 'recommended')}</span>` : r.own ? `<span class="food-badge">${w('hostTip')}</span>` : ''}
    <b>${esc(r.name)}</b>
    <span class="food-meta">${[kindName(r.kind), r.m != null ? dist(r.m) : '', r.price ? '₾'.repeat(r.price) : ''].filter(Boolean).map(esc).join(' · ')}</span>
  </button></li>`;
  // one place: its card with what OpenStreetMap knows (hours, phone, website) and a map link
  function openPlace(id) {
    const r = foodList().find(x => x.id === id); if (!r) return;
    const city = (J.hotel || {}).city || '', d = $('#placeDlg');
    // a Google Maps search by name and town opens the place's own Google page (reviews, photos, links); free, no Google key
    const where = `${r.name}, ${city.replace(/\s*\(.*\)\s*$/, '')}, Georgia`;
    d.querySelector('.place-body').innerHTML = `${r.photo ? `<img class="place-ph" src="${esc(r.photo)}" alt="">` : ''}${r.sponsored ? `<span class="food-badge">${w(r.sample ? 'adSample' : 'recommended')}</span>` : r.own ? `<span class="food-badge">${w('hostTip')}</span>` : ''}
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
    return `<article class="room" id="room-${esc(k)}" data-type="${esc(k)}">
  <div class="room-media">${ph.length ? `<div class="slides">${ph.map(p => img(p, typeName(t.name))).join('')}</div>${ph.length > 1 ? `
    <button type="button" class="sl-btn sl-prev" data-sl="-1" aria-label="${w('prevPhoto')}" hidden>‹</button><button type="button" class="sl-btn sl-next" data-sl="1" aria-label="${w('nextPhoto')}">›</button>
    <span class="sl-count" aria-hidden="true">1 / ${ph.length}</span>` : ''}` : img('')}</div>
  <div class="room-body">
    <h3>${esc(typeName(t.name))}</h3>
    ${pick(s.text) ? `<p class="room-text">${esc(pick(s.text))}</p>` : ''}
    <p class="room-meta">${t.cap} ${w('upTo')} · ${roomsOf(k).length} ${lang() === 'ka' ? 'ნომერი' : lang() === 'ru' ? 'ном.' : 'rooms'}</p>
    <p class="room-price"><span class="amount">${lang() === 'ka' ? `${minPrice(k)} ₾${w('from')}` : `${w('from')} ${minPrice(k)} ₾`}</span><span class="per"> / ${w('perNight')}</span></p>
    <p class="room-avail" aria-live="polite"></p>
    <button type="button" class="btn btn-line" data-pick="${esc(k)}">${w('choose')}</button>
  </div>
</article>`;
  }

  // the dates and guests field, like the Visit2.ge search: it opens the sheet with a calendar and guests
  function pill() {
    return `<div class="pill" role="group" aria-label="${w('check')}">
    <button type="button" class="seg" data-open="when"><span>${w('dates')}</span><b class="p-when"></b></button>
    <button type="button" class="seg" data-open="who"><span>${w('guestsW')}</span><b class="p-who"></b></button>
    <button type="button" class="btn btn-accent pill-go" data-see>${w('seePrice')}</button>
  </div>`;
  }
  function sheetHtml() {
    const step = (n, t, sub) => `<div class="step"><div><b>${w(t)}</b><small>${w(sub)}</small></div><div class="stepper"><button type="button" data-n="${n}" data-d="-1" aria-label="−">−</button><output data-v="${n}">0</output><button type="button" data-n="${n}" data-d="1" aria-label="+">+</button></div></div>`;
    const petsOk = (S().amenities || []).includes('pets');
    return `<dialog class="sheet" id="sheet" aria-labelledby="sheetH">
  <div class="sheet-in">
    <div class="sheet-head"><span></span><h2 id="sheetH"></h2><button type="button" class="x" data-close aria-label="${w('close')}">×</button></div>
    <div class="view" data-view="when" hidden>
      <div class="range"><div><span>${w('arrive')}</span><b id="rFrom">—</b></div><div><span>${w('leave')}</span><b id="rTo">—</b></div></div>
      <p class="nights" id="rNights"></p>
      <div class="dow" id="dow" aria-hidden="true"></div>
      <div class="cal" id="cal"></div>
      <div class="sheet-foot"><button type="button" class="btn btn-ghost" id="calReset">${w('clear')}</button><button type="button" class="btn btn-accent" id="calSave">${w('save')}</button></div>
    </div>
    <div class="view" data-view="who" hidden>
      ${step('adults', 'adults', 'adultsAge')}${step('kids', 'kids', 'kidsAge')}${step('babies', 'babies', 'babiesAge')}
      <div class="step"><div><b>${w('pets')}</b><small>${w(petsOk ? 'petsOk' : 'petsNo')}</small></div>${petsOk ? `<div class="stepper"><button type="button" data-n="pets" data-d="-1" aria-label="−">−</button><output data-v="pets">0</output><button type="button" data-n="pets" data-d="1" aria-label="+">+</button></div>` : ''}</div>
      <div class="sheet-foot"><button type="button" class="btn btn-accent" id="whoSave">${w('save')}</button></div>
    </div>
  </div>
</dialog>`;
  }
  const MONTHS = { ka: ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'] };
  const DOW = { ka: ['ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა', 'კვ'], en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] };
  let calFrom = '', calTo = '';
  function openSheet(v) {
    const d = $('#sheet'); if (!d.open) d.showModal();
    d.querySelectorAll('[data-view]').forEach(x => { x.hidden = x.dataset.view !== v; });
    $('#sheetH').textContent = w(v === 'when' ? 'whenQ' : 'whoQ');
    if (v === 'when') { calFrom = sel.from; calTo = sel.to; drawCal(); }
    if (v === 'who') ['adults', 'kids', 'babies', 'pets'].forEach(n => { const o = d.querySelector(`[data-v="${n}"]`); if (o) o.value = sel[n]; });
    d.querySelector('.sheet-in').scrollTop = 0;
  }
  function drawCal() {
    const L = lang(), today = J.today(), [y0, m0] = today.split('-').map(Number);
    $('#dow').innerHTML = DOW[L].map(d => `<span>${d}</span>`).join('');
    let html = '';
    for (let i = 0; i < 12; i++) {
      const y = y0 + Math.floor((m0 - 1 + i) / 12), m = (m0 - 1 + i) % 12;
      const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), pad = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
      html += `<section class="month"><h3>${MONTHS[L][m]} ${y}</h3><div class="days">${'<span></span>'.repeat(pad)}`;
      for (let d = 1; d <= days; d++) {
        const ds = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        html += ds < today ? `<span class="past">${d}</span>` : `<button type="button" data-day="${ds}">${d}</button>`;
      }
      html += '</div></section>';
    }
    $('#cal').innerHTML = html; paintCal();
  }
  function paintCal() {
    $('#cal').querySelectorAll('[data-day]').forEach(x => {
      const d = x.dataset.day;
      x.className = [d === calFrom ? 'start' : '', d === calTo ? 'end' : '', calFrom && calTo && d > calFrom && d < calTo ? 'in' : ''].filter(Boolean).join(' ');
      x.setAttribute('aria-pressed', String(d === calFrom || d === calTo));
    });
    $('#rFrom').textContent = calFrom ? J.fmt(calFrom) : '—';
    $('#rTo').textContent = calTo ? J.fmt(calTo) : '—';
    const n = calFrom && calTo ? J.nights(calFrom, calTo) : 0;
    $('#rNights').textContent = n ? `${n} ${w('nights')}` : w(calFrom ? 'pickLeave' : 'pickArrive');
  }
  const guestsText = () => [w('guestsN').replace('{n}', sel.adults + sel.kids), sel.babies ? w('babiesN').replace('{n}', sel.babies) : '', sel.pets ? w('petsN') : ''].filter(Boolean).join(', ');
  function pillText() {
    document.querySelectorAll('.p-when').forEach(el => { el.textContent = sel.from && sel.to ? J.fmtRange(sel.from, sel.to) : w('addDates'); });
    document.querySelectorAll('.p-who').forEach(el => { el.textContent = guestsText(); });
  }
  function bookForm() {
    return `<section class="book" id="book">
  <h2>${caps(w('book'))}</h2>
  <div class="book-sum" id="sum" aria-live="polite">${w('pickDates')}</div>
  <div class="book-pick">${pill()}</div>
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
  const sel = { from: '', to: '', adults: 2, kids: 0, babies: 0, pets: 0, type: '' };
  // dates and guests from the Visit2.ge search (hotel.html?h=…&from=…&to=…&g=…)
  if (/^\d{4}-\d{2}-\d{2}$/.test(params.get('from') || '') && /^\d{4}-\d{2}-\d{2}$/.test(params.get('to') || '') && params.get('to') > params.get('from')) {
    sel.from = params.get('from'); sel.to = params.get('to'); sel.adults = Math.max(1, Math.min(16, +params.get('g') || 2));
  }
  const fmtN = n => `${n} ₾`;
  // beds needed: adults and children (infants share a bed); the price follows the owner's rule for children
  const beds = () => sel.adults + sel.kids;
  const priced = () => sel.adults + (kidsRule().mode === 'free' || kidsRule().mode === 'fixed' ? 0 : sel.kids);
  const quoteOf = (k, from, to) => J.quote(k, from, to, Math.max(1, priced())) + (kidsRule().mode === 'fixed' ? (+kidsRule().price || 0) * sel.kids * J.nights(from, to) : 0);
  function summary() {
    const el = $('#sum'); if (!el) return;
    const { from, to } = sel, g = beds();
    pillText();
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
    el.innerHTML = `<b>${esc(typeName(J.types[type].name))}</b><br>${J.fmtRange(from, to)} · ${n} ${w('nights')} · ${esc(guestsText())}<br><span class="sum-total">${w('estimate')}: ${fmtN(quoteOf(type, from, to))}</span>`;
  }
  function availability() {
    const { from, to } = sel, g = beds(), ok = from && to && to > from;
    document.querySelectorAll('.room').forEach(r => {
      const k = r.dataset.type, out = r.querySelector('.room-avail'); if (!out) return;
      if (!ok) { out.textContent = ''; return; }
      const free = roomsOf(k).filter(x => J.roomFree(x.id, from, to)).length, fits = J.rateFor(k, g);
      out.textContent = !fits ? `${J.types[k].cap} ${w('upTo')}` : free ? `${w('left')}: ${free} · ${w('total')} ${fmtN(quoteOf(k, from, to))}` : w('none');
      out.dataset.state = !fits || !free ? 'no' : 'yes';
    });
  }

  function wire() {
    const sheet = $('#sheet'), menu = $('#menu'), still = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openSheet(b.dataset.open)));
    document.querySelectorAll('[data-see]').forEach(b => b.addEventListener('click', () => { if (!sel.from) openSheet('when'); else $('#rooms').scrollIntoView({ behavior: still }); }));
    sheet.addEventListener('click', e => { if (e.target === sheet || e.target.closest('[data-close]')) sheet.close(); });
    $('#cal').addEventListener('click', e => {
      const b = e.target.closest('[data-day]'); if (!b) return; const d = b.dataset.day;
      if (!calFrom || calTo || d <= calFrom) { calFrom = d; calTo = ''; } else calTo = d;
      paintCal();
    });
    $('#calReset').addEventListener('click', () => { calFrom = calTo = ''; paintCal(); });
    $('#calSave').addEventListener('click', () => {
      if (calFrom && !calTo) calTo = J.addDays(calFrom, 1);
      sel.from = calFrom; sel.to = calTo; summary();
      openSheet('who');
    });
    sheet.querySelector('[data-view="who"]').addEventListener('click', e => {
      const b = e.target.closest('[data-n]'); if (!b) return;
      const n = b.dataset.n, o = sheet.querySelector(`[data-v="${n}"]`), min = n === 'adults' ? 1 : 0, max = { adults: 16, kids: 10, babies: 5, pets: 5 }[n];
      o.value = Math.min(max, Math.max(min, +o.value + +b.dataset.d));
    });
    $('#whoSave').addEventListener('click', () => {
      ['adults', 'kids', 'babies', 'pets'].forEach(n => { const o = sheet.querySelector(`[data-v="${n}"]`); sel[n] = o ? +o.value : 0; });
      sheet.close(); summary();
      if (sel.from) $('#rooms').scrollIntoView({ behavior: still });
    });
    $('#menuBtn').addEventListener('click', () => menu.showModal());
    menu.addEventListener('click', e => { if (e.target === menu || e.target.closest('[data-close]')) menu.close(); });
    const bar = $('#topbar'), onScroll = () => bar.classList.toggle('scrolled', scrollY > 40);
    window.onscroll = onScroll; onScroll();
    document.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { sel.type = b.dataset.pick; summary(); $('#book').scrollIntoView({ behavior: still }); if (!sel.from) openSheet('when'); }));
    $('#sum').addEventListener('click', e => { const b = e.target.closest('[data-next]'); if (!b) return; [sel.from, sel.to] = b.dataset.next.split('|'); summary(); });
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
    const f = e.target, msg = $('#msg'), g = beds();
    const name = f.name.value.trim(), phone = f.phone.value.trim();
    msg.dataset.state = 'bad';
    if (!sel.from || !sel.to || sel.to <= sel.from) { msg.textContent = w('pickDates'); openSheet('when'); return; }
    if (!name || phone.replace(/\D/g, '').length < 9) { msg.textContent = w('needName'); (name ? f.phone : f.name).focus(); return; }
    const btn = f.querySelector('button'); btn.disabled = true;
    const req = J.createRequest({ from: sel.from, to: sel.to, guests: g, children: sel.kids, name, phone, source: 'site', type: sel.offer || sel.type || undefined, wish: [f.wish.value.trim(), sel.babies ? w('babiesN').replace('{n}', sel.babies) : '', sel.pets ? w('petsN') : ''].filter(Boolean).join(' · ') });
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
