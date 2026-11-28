/* Visit2.ge home page for guests.
   Top: one calm photo, one sentence and one search field (Tablet Hotels' idea): tapping it opens the search as a sheet,
   full screen on a phone, with the town list, a calendar (arrive / leave / nights) and guests with + and −.
   Below: kinds of stay as chips and rows of hotels you swipe through (Airbnb's idea), places to eat, how it works.
   Guests can save hotels with ♥; the list stays in this browser. Search itself is window.V2FIND (site/platform.js). */
(() => {
  const F = window.V2FIND, D = window.V2DEMO, $ = s => document.querySelector(s);
  if (!F || !$('#q')) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LI = () => Math.max(0, ['ka', 'en', 'ru'].indexOf(F.lang));

  const H = {
    menu: ['მენიუ', 'Menu', 'Меню'], mHotels: ['სასტუმროები', 'Places to stay', 'Где остановиться'], mSaved: ['შენახული', 'Saved', 'Сохранённые'],
    mEat: ['რესტორნები', 'Restaurants', 'Рестораны'], mHow: ['როგორ მუშაობს', 'How it works', 'Как это работает'], mAbout: ['Visit2.ge-ის შესახებ', 'About Visit2.ge', 'О Visit2.ge'],
    mPartners: ['პარტნიორებისთვის: სასტუმროებს და ბინებს', 'For partners: hotels and flats', 'Партнёрам: отелям и квартирам'], mRest: ['რესტორნებისთვის', 'For restaurants', 'Ресторанам'],
    mPrivacy: ['კონფიდენციალურობა', 'Privacy', 'Конфиденциальность'], mTerms: ['პირობები', 'Terms', 'Условия'],
    h1: ['იპოვე სასტუმრო საქართველოში და დაჯავშნე პირდაპირ', 'Find a place to stay in Georgia and book it direct', 'Найдите жильё в Грузии и бронируйте напрямую'],
    where: ['სად', 'Where', 'Куда'], when: ['როდის', 'When', 'Когда'], who: ['სტუმრები', 'Guests', 'Гости'], go: ['ძებნა', 'Search', 'Найти'],
    whereQ: ['სად მიდიხართ?', 'Where to?', 'Куда едете?'], whenQ: ['როდის მოდიხართ?', 'When are you coming?', 'Когда приезжаете?'], whoQ: ['ვინ მოდის?', 'Who is coming?', 'Кто едет?'],
    anywhere: ['ყველგან', 'Anywhere', 'Везде'], addDates: ['თარიღები', 'Add dates', 'Даты'], townPh: ['ქალაქი ან კურორტი', 'Town or resort', 'Город или курорт'],
    popular: ['პოპულარული', 'Popular', 'Популярные'], allPlaces: ['ყველა ადგილი', 'All places', 'Все места'],
    arrive: ['ჩამოსვლა', 'Arriving', 'Заезд'], leave: ['წასვლა', 'Leaving', 'Выезд'], nights: ['{n} ღამე', '{n} nights', 'Ночей: {n}'], night1: ['1 ღამე', '1 night', '1 ночь'],
    pickArrive: ['აირჩიე ჩამოსვლის დღე', 'Pick the day you arrive', 'Выберите день заезда'], pickLeave: ['ახლა აირჩიე წასვლის დღე', 'Now pick the day you leave', 'Теперь выберите день выезда'],
    clear: ['გასუფთავება', 'Clear', 'Сбросить'], save: ['შენახვა', 'Save', 'Сохранить'],
    adults: ['უფროსები', 'Adults', 'Взрослые'], adultsAge: ['13 წლიდან', 'Ages 13 or above', 'От 13 лет'], kids: ['ბავშვები', 'Children', 'Дети'], kidsAge: ['2–12 წლის', 'Ages 2–12', 'От 2 до 12 лет'],
    babies: ['ჩვილები', 'Infants', 'Младенцы'], babiesAge: ['2 წლამდე', 'Under 2', 'До 2 лет'], baby1: ['1 ჩვილი', '1 infant', '1 младенец'], babiesN: ['{n} ჩვილი', '{n} infants', 'младенцев: {n}'],
    pets: ['შინაური ცხოველი', 'Pets', 'Домашние животные'], petsSub: ['ვაჩვენებთ სასტუმროებს, სადაც ცხოველი შეიძლება', 'We show places where pets are welcome', 'Покажем места, где можно с животными'],
    pet1: ['ცხოველით', 'with a pet', 'с животным'], petsN: ['{n} ცხოველით', 'with {n} pets', 'с животными: {n}'],
    sortDef: ['დალაგება: რეკომენდებული', 'Sort: recommended', 'Сортировка: рекомендуемые'], sortCheap: ['ფასი: დაბალიდან მაღლისკენ', 'Price: low to high', 'Цена: по возрастанию'],
    sortDear: ['ფასი: მაღლიდან დაბლისკენ', 'Price: high to low', 'Цена: по убыванию'], sortNear: ['მანძილი: {p}-ის ცენტრიდან', 'Distance from {p} centre', 'Расстояние от центра: {p}'],
    sortPoint: ['მანძილი: არჩეული წერტილიდან', 'Distance from the chosen point', 'Расстояние от выбранной точки'], regions: ['რეგიონები', 'Regions', 'Регионы'],
    kmCentre: ['{k} კმ ცენტრიდან', '{k} km from the centre', '{k} км от центра'],
    instant: ['✓ მყისიერი დადასტურება', '✓ Instant confirmation', '✓ Мгновенное подтверждение'],
    cmpAdd: ['შედარება', 'Compare', 'Сравнить'], cmpOn: ['შედარებაშია', 'In comparison', 'В сравнении'], cmpRm: ['ამოღება', 'Remove', 'Убрать'], cmpH: ['შედარება', 'Compare', 'Сравнение'],
    cmpN: ['შედარება ({n})', 'Compare ({n})', 'Сравнить ({n})'], cmpFull: ['შეადარე ერთად მაქსიმუმ 3 სასტუმრო. ჯერ ერთი ამოიღე.', 'Compare up to 3 places. Remove one first.', 'Можно сравнить до 3 мест. Сначала уберите одно.'],
    cmpPrice: ['ფასი', 'Price', 'Цена'], cmpTown: ['ადგილი', 'Place', 'Место'], cmpKinds: ['რა ადგილია', 'Kind of place', 'Что за место'], cmpRooms: ['ნომრები', 'Rooms', 'Номера'],
    cmpCap: ['ერთ ნომერში', 'In one room', 'В одном номере'], cmpCapN: ['{n} სტუმრამდე', 'up to {n} guests', 'до {n} гостей'], cmpRoomsN: ['სულ {n} ნომერი', '{n} rooms in all', 'всего номеров: {n}'],
    cmpAmen: ['რა არის ადგილზე', 'Amenities', 'Удобства'], cmpKids: ['ბავშვის ფასი (2–12)', 'Child price (2–12)', 'Цена за ребёнка (2–12)'],
    kidAdult: ['როგორც უფროსის', 'Same as adults', 'Как за взрослого'], kidFree: ['უფასოა', 'Free', 'Бесплатно'], kidFixed: ['{p} ₾ ღამეში', '{p} ₾ a night', '{p} ₾ за ночь'],
    roomsAll: ['{n}-ვე ნომერი', 'all {n} rooms', 'за {n} номера'],
    rooms: ['ნომრები', 'Rooms', 'Номера'], roomsSub: ['ერთ ჯავშანში, მთელი ჯგუფისთვის', 'In one booking, for the whole group', 'В одной брони, на всю группу'], roomsN: ['{n} ნომერი', '{n} rooms', 'номеров: {n}'],
    onlyFree: ['თავისუფალია მხოლოდ {n} ნომერი', 'Only {n} rooms free', 'Свободно только {n}'],
    guestsN: ['{n} სტუმარი', '{n} guests', 'Гостей: {n}'], guest1: ['1 სტუმარი', '1 guest', '1 гость'], kidsN: ['{n} ბავშვი', '{n} children', 'детей: {n}'], kid1: ['1 ბავშვი', '1 child', '1 ребёнок'],
    all: ['ყველა', 'All', 'Все'], seeAll: ['ყველას ნახვა', 'See all', 'Смотреть все'],
    rowKind: { mountain: ['მთაში', 'In the mountains', 'В горах'], sea: ['ზღვაზე', 'By the sea', 'У моря'], history: ['ისტორიასთან ახლოს', 'Close to history', 'Рядом с историей'], wine: ['ღვინის მხარეში', 'In wine country', 'В винном крае'],
      food: ['სახლის სამზარეულოთი', 'With home cooking', 'С домашней кухней'], nature: ['ბუნებაში', 'In nature', 'На природе'], city: ['ქალაქში', 'In the city', 'В городе'] },
    newH: ['ახალი Visit2.ge-ზე', 'New on Visit2.ge', 'Новые на Visit2.ge'], newSub: ['ახლახან შემოგვიერთდნენ', 'Just joined us', 'Недавно присоединились'],
    saved: ['შენახული', 'Saved', 'Сохранённые'], saveIt: ['შენახვა', 'Save', 'Сохранить'], unsave: ['შენახულიდან ამოღება', 'Remove from saved', 'Убрать из сохранённых'],
    perNight: ['ღამე', 'night', 'ночь'], fromP: ['{p} ₾-დან', 'from {p} ₾', 'от {p} ₾'], totalN: ['{n} ღამე', '{n} nights', 'ночей: {n}'], busy: ['ამ თარიღებზე დაკავებულია', 'Booked on these dates', 'На эти даты занято'],
    skipDates: ['თარიღის გარეშე: ყველა სასტუმრო', 'Without dates: all stays', 'Без дат: все варианты'],
    freeN: ['თავისუფალია: {n}', 'Available: {n}', 'Свободно: {n}'], pickDates: ['აირჩიე თარიღები, რომ ნახო თავისუფალი ნომრები და ფასი', 'Add dates to see free rooms and the price', 'Выберите даты, чтобы увидеть свободные номера и цену'],
    allStays: ['ყველა სასტუმრო', 'All places to stay', 'Всё жильё'], none: ['აქ სასტუმრო ჯერ არ არის. სცადე ახლომდებარე ადგილი.', 'Nothing here yet. Try a place nearby.', 'Здесь пока ничего нет. Попробуйте место рядом.'],
    mapOpen: ['რუკაზე', 'On the map', 'На карте'], mapHint: ['დააჭირე რუკაზე ადგილს, სადაც სასტუმრო გინდა', 'Tap the place on the map where you want to stay', 'Нажмите на карте место, где хотите остановиться'],
    nearMe: ['📍 ჩემთან ახლოს', '📍 Near me', '📍 Рядом со мной'], km: ['{k} კმ', '{k} km', '{k} км'], within: ['{r} კმ-ის რადიუსში', 'Within {r} km', 'В радиусе {r} км'],
    locating: ['ვეძებ შენს ადგილს…', 'Finding you…', 'Определяем место…'], noLoc: ['ადგილი ვერ განისაზღვრა. დააჭირე რუკაზე.', 'Could not get your location. Tap the map instead.', 'Не удалось определить место. Нажмите на карте.'],
    eatH: ['რესტორნები', 'Restaurants', 'Рестораны'], eatSub: ['რესტორნები, კაფეები და ბარები ქალაქის ცენტრში', 'Restaurants, cafés and bars in the town centre', 'Рестораны, кафе и бары в центре'],
    eatNote: ['ადგილები და რუკა: © OpenStreetMap-ის მონაწილეები.', 'Places and map: © OpenStreetMap contributors.', 'Места и карта: © участники OpenStreetMap.'],
    adBadge: ['რეკომენდებული · ნიმუში', 'Recommended · sample', 'Рекомендуем · образец'],
    fromCentre: ['ცენტრიდან {m}', '{m} from the centre', '{m} от центра'],
    aboutH: ['Visit2.ge-ის შესახებ', 'About Visit2.ge', 'О Visit2.ge'],
    aboutP: ['Visit2.ge ქართული პლატფორმაა მცირე სასტუმროებისა და ბინებისთვის. სტუმარი პირდაპირ სასტუმროსთან ჯავშნის, ფასს სასტუმრო თავად აწესებს და საკომისიოს არავინ იხდის.', 'Visit2.ge is a Georgian platform for small hotels and flats. Guests book straight with the hotel, the hotel sets its own price, and nobody pays a commission.', 'Visit2.ge — грузинская платформа для небольших отелей и квартир. Гости бронируют напрямую у отеля, цену устанавливает сам отель, и никто не платит комиссию.'],
  };
  const h = (k, v = {}) => { const x = H[k]; return String(x ? x[LI()] ?? x[0] : k).replace(/\{(\w+)\}/g, (_, n) => v[n] ?? ''); };
  const MONTH = { ka: ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'] };
  const DOW = { ka: ['ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა', 'კვ'], en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] };
  const KIND_ICON = { mountain: '🏔️', sea: '🌊', history: '🏛️', wine: '🍷', food: '🥟', nature: '🌲', city: '🏙️' };
  const KIND_ORDER = ['mountain', 'sea', 'history', 'wine', 'food', 'nature', 'city'];
  const shortTown = c => F.town(c).replace(/\s*\(.*\)\s*$/, '');

  function applyTexts() {
    document.querySelectorAll('[data-h]').forEach(el => { el.textContent = h(el.dataset.h); });
    document.querySelectorAll('[data-hp]').forEach(el => { el.placeholder = h(el.dataset.hp); });
  }

  // ---------- the search state (a hidden form, so the chatbot can fill it too) ----------
  const Q = $('#q');
  const st = () => ({ city: Q.city.value, from: Q.from.value, to: Q.to.value, g: Math.max(1, +Q.g.value || 2), kids: Math.max(0, +Q.kids.value || 0), babies: Math.max(0, +Q.babies.value || 0), pets: Math.max(0, +Q.pets.value || 0), rooms: Math.max(1, +Q.rooms.value || 1) });
  const dated = s => s.from && s.to && s.to > s.from;
  const range = s => {
    if (!dated(s)) return '';
    const a = F.fmt(s.from), b = F.fmt(s.to), [da, ma] = a.split(' '), [db, mb] = b.split(' ');
    return ma === mb ? `${da}–${db} ${mb}` : `${a} – ${b}`;
  };
  const guests = s => [s.g === 1 ? h('guest1') : h('guestsN', { n: s.g }), s.kids ? (s.kids === 1 ? h('kid1') : h('kidsN', { n: s.kids })) : '', s.rooms > 1 ? h('roomsN', { n: s.rooms }) : '', s.babies ? (s.babies === 1 ? h('baby1') : h('babiesN', { n: s.babies })) : '', s.pets ? (s.pets === 1 ? h('pet1') : h('petsN', { n: s.pets })) : ''].filter(Boolean).join(', ');
  function summary() {
    const s = st();
    $('#vWhere').textContent = s.city ? F.town(s.city) : h('whereQ');
    $('#vWhen').textContent = range(s) || h('addDates');
    $('#vWho').textContent = guests(s);
    $('#fWhere').textContent = s.city ? F.town(s.city) : h('anywhere');
    $('#fWhen').textContent = range(s) || h('addDates');
    $('#fWho').textContent = guests(s);
    document.querySelector('.h-pill').classList.toggle('set', !!(s.city || dated(s)));
  }

  // ---------- hero: real hotels from the catalogue, one at a time ----------
  let heroList = [], heroAt = 0, heroHold = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  function pickHero() {
    const all = F.pub().filter(x => !x.hidden && (x.cover || x.img));
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const seen = new Set(), out = [];
    for (const x of all) if (!seen.has(x.city) && out.length < 6) { seen.add(x.city); out.push(x); }
    return out;
  }
  function heroShow(i) {
    if (!heroList.length) return;
    heroAt = (i + heroList.length) % heroList.length;
    const x = heroList[heroAt], src = x.img || `img/h/${x.cover}.jpg`, a = $('#heroA'), b = $('#heroB');
    const front = a.classList.contains('h-next') ? b : a, back = front === a ? b : a;
    const swap = () => { back.classList.remove('h-next'); front.classList.add('h-next'); };
    if (front.getAttribute('src') !== src) { back.onload = swap; back.src = src; if (back.complete && back.naturalWidth) swap(); }
    heroCredit();
  }
  function heroCredit() {
    const x = heroList[heroAt]; if (!x) return;
    const c = $('#heroCredit'); c.textContent = `${F.hname(x)} · ${shortTown(x.city)}`; c.href = F.link(x, {});
  }
  heroList = pickHero(); heroShow(Math.floor(Math.random() * heroList.length));
  setInterval(() => { if (!still.matches && !document.hidden && Date.now() > heroHold && !$('#sheet').open) heroShow(heroAt + 1); }, 7000);
  let sx = null;
  $('.h-hero').addEventListener('touchstart', e => { sx = e.target.closest('.h-pill') ? null : e.touches[0].clientX; }, { passive: true });
  $('.h-hero').addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) { heroHold = Date.now() + 20000; heroShow(heroAt + (dx < 0 ? 1 : -1)); } });

  // ---------- the search sheet ----------
  const sheet = $('#sheet');
  let view = 'main', flow = false, calFrom = '', calTo = '';
  function openSheet(v) {
    flow = v === 'where' || v === 'main';
    if (!sheet.open) sheet.showModal();
    show(v);
  }
  function show(v) {
    view = v;
    sheet.querySelectorAll('[data-view]').forEach(x => { x.hidden = x.dataset.view !== v; });
    $('#sheetH').textContent = { main: h('go'), where: h('whereQ'), when: h('whenQ'), who: h('whoQ') }[v];
    $('#sheetBack').hidden = v === 'main';
    sheet.classList.toggle('wide', v === 'when');
    if (v === 'main') summary();
    if (v === 'where') { $('#townFind').value = ''; drawTowns(); setTimeout(() => matchMedia('(pointer: fine)').matches && $('#townFind').focus(), 50); }
    if (v === 'when') { const s = st(); calFrom = s.from; calTo = s.to; drawCal(); }
    if (v === 'who') { const s = st(); $('#nG').value = s.g; $('#nK').value = s.kids; $('#nB').value = s.babies; $('#nP').value = s.pets; $('#nR').value = s.rooms; }
    sheet.querySelector('.h-sheet-in').scrollTop = 0;
  }
  document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openSheet(b.dataset.open)));
  sheet.addEventListener('click', e => {
    if (e.target === sheet || e.target.closest('[data-close]')) { sheet.close(); return; }
    const g = e.target.closest('[data-go]'); if (g) { flow = false; show(g.dataset.go); }
  });
  $('#sheetBack').addEventListener('click', () => show('main'));
  sheet.addEventListener('close', summary);
  $('#doSearch').addEventListener('click', () => { sheet.close(); showResults(true); });
  // a place without dates: every stay there now, dates can be added later from the results
  $('#calSkip').addEventListener('click', () => { Q.from.value = Q.to.value = ''; sheet.close(); summary(); showResults(true); });

  // where: popular places first, then every place; typing filters
  function drawTowns() {
    const f = $('#townFind').value.trim().toLowerCase(), cur = st().city;
    const ok = c => !f || F.town(c).toLowerCase().includes(f) || c.toLowerCase().includes(f);
    const btn = c => `<button type="button" class="h-town" data-town="${esc(c)}" aria-pressed="${c === cur}">${esc(F.town(c))}</button>`;
    const pop = F.cities().filter(ok), reg = F.regions().filter(ok), rest = F.allTowns().filter(c => ok(c) && !pop.includes(c));
    $('#townList').innerHTML = (f ? '' : `<button type="button" class="h-town" data-town="" aria-pressed="${!cur}">${h('anywhere')}</button>`)
      + (pop.length ? `<h3>${h('popular')}</h3>${pop.map(btn).join('')}` : '') + (reg.length ? `<h3>${h('regions')}</h3>${reg.map(btn).join('')}` : '')
      + (rest.length ? `<h3>${h('allPlaces')}</h3>${rest.map(btn).join('')}` : '');
  }
  $('#townFind').addEventListener('input', drawTowns);
  $('#townList').addEventListener('click', e => {
    const b = e.target.closest('[data-town]'); if (!b) return;
    Q.city.value = b.dataset.town; summary();
    show(flow && !dated(st()) ? 'when' : 'main');
  });

  // when: a calendar of the next twelve months; past days are crossed out
  function drawCal() {
    const L = F.lang, today = F.today();
    $('#dow').innerHTML = DOW[L].map(d => `<span>${d}</span>`).join('');
    let html = '';
    const [y0, m0] = today.split('-').map(Number);
    for (let i = 0; i < 12; i++) {
      const y = y0 + Math.floor((m0 - 1 + i) / 12), m = (m0 - 1 + i) % 12;
      const first = new Date(Date.UTC(y, m, 1)), days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), pad = (first.getUTCDay() + 6) % 7;
      html += `<section class="h-month"><h3>${MONTH[L][m]} ${y}</h3><div class="h-days">${'<span></span>'.repeat(pad)}`;
      for (let d = 1; d <= days; d++) {
        const s = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const cls = [s < today ? 'past' : '', s === calFrom ? 'start' : '', s === calTo ? 'end' : '', calFrom && calTo && s > calFrom && s < calTo ? 'in' : ''].filter(Boolean).join(' ');
        html += s < today ? `<span class="${cls}">${d}</span>` : `<button type="button" class="${cls}" data-day="${s}" aria-pressed="${s === calFrom || s === calTo}">${d}</button>`;
      }
      html += '</div></section>';
    }
    $('#cal').innerHTML = html;
    calHead();
  }
  function calHead() {
    $('#rFrom').textContent = calFrom ? F.fmt(calFrom) : '—';
    $('#rTo').textContent = calTo ? F.fmt(calTo) : '—';
    const n = calFrom && calTo ? F.nights(calFrom, calTo) : 0;
    $('#rNights').textContent = n ? (n === 1 ? h('night1') : h('nights', { n })) : calFrom ? h('pickLeave') : h('pickArrive');
  }
  $('#cal').addEventListener('click', e => {
    const b = e.target.closest('[data-day]'); if (!b) return;
    const d = b.dataset.day;
    if (!calFrom || calTo || d <= calFrom) { calFrom = d; calTo = ''; } else calTo = d;
    $('#cal').querySelectorAll('[data-day]').forEach(x => {
      const s = x.dataset.day;
      x.className = [s === calFrom ? 'start' : '', s === calTo ? 'end' : '', calFrom && calTo && s > calFrom && s < calTo ? 'in' : ''].filter(Boolean).join(' ');
      x.setAttribute('aria-pressed', String(s === calFrom || s === calTo));
    });
    calHead();
  });
  $('#calReset').addEventListener('click', () => { calFrom = calTo = ''; drawCal(); });
  $('#calSave').addEventListener('click', () => {
    if (calFrom && !calTo) calTo = F.addDays(calFrom, 1);
    Q.from.value = calFrom; Q.to.value = calTo; summary();
    show(flow ? 'who' : 'main');
  });

  // who: adults (13+), children (2–12), infants (under 2, they need no bed of their own, so they are not counted for rooms), pets
  $('[data-view="who"]').addEventListener('click', e => {
    const b = e.target.closest('[data-n]'); if (!b) return;
    const n = b.dataset.n, out = { g: $('#nG'), kids: $('#nK'), babies: $('#nB'), pets: $('#nP'), rooms: $('#nR') }[n], min = n === 'g' || n === 'rooms' ? 1 : 0, max = { g: 16, kids: 10, babies: 5, pets: 5, rooms: 10 }[n];
    out.value = Math.min(max, Math.max(min, +out.value + +b.dataset.d));
  });
  $('#whoSave').addEventListener('click', () => { Q.g.value = $('#nG').value; Q.kids.value = $('#nK').value; Q.babies.value = $('#nB').value; Q.pets.value = $('#nP').value; Q.rooms.value = Math.max(1, Math.min(+$('#nR').value, +$('#nG').value + +$('#nK').value)); summary(); renderRows(); show('main'); });

  // ---------- saved hotels (♥), kept in this browser ----------
  const SKEY = 'v2-saved';
  const saved = () => { try { return JSON.parse(localStorage.getItem(SKEY) || '[]'); } catch (e) { return []; } };
  const heart = slug => { const on = saved().includes(slug);
    return `<button type="button" class="h-heart" data-save="${esc(slug)}" aria-pressed="${on}" aria-label="${esc(on ? h('unsave') : h('saveIt'))}"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.5 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.5 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg></button>`; };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-save]'); if (!b) return;
    e.preventDefault();
    const list = saved(), i = list.indexOf(b.dataset.save);
    if (i < 0) list.unshift(b.dataset.save); else list.splice(i, 1);
    try { localStorage.setItem(SKEY, JSON.stringify(list)); } catch (err) { /* private mode */ }
    renderRows();
    document.querySelectorAll(`#resCards [data-save="${CSS.escape(b.dataset.save)}"]`).forEach(x => { const on = i < 0; x.setAttribute('aria-pressed', String(on)); x.setAttribute('aria-label', on ? h('unsave') : h('saveIt')); });
  });

  // with a pet, only places that welcome pets (the owner ticks "pets" among the amenities)
  const petsOk = (x, s) => !s.pets || (x.site?.amenities || []).includes('pets');

  // ---------- one hotel card ----------
  function card(x, o, s) {
    const img = x.img || (x.cover ? `img/h/${x.cover}-s.jpg` : x.site?.hero?.img || '');
    const isDated = dated(s);
    const price = isDated && o.unknown ? `<b>${h('fromP', { p: o.minFrom })}</b> / ${h('perNight')}` : isDated ? (o.best ? `<b>${o.best.total} ₾</b> · ${h('totalN', { n: o.n })}${s.rooms > 1 ? ' · ' + h('roomsAll', { n: s.rooms }) : ''}` : `<span class="h-busy">${o.freeRooms != null && s.rooms > 1 ? h('onlyFree', { n: o.freeRooms }) : h('busy')}</span>`)
      : `<b>${h('fromP', { p: o.minFrom })}</b> / ${h('perNight')}`;
    return `<article class="h-card${isDated && !o.best && !o.unknown ? ' busy' : ''}">
  <a href="${F.link(x, isDated ? { from: s.from, to: s.to, g: s.g + s.kids, rooms: s.rooms, kids: s.kids } : {})}">
    <div class="h-card-ph">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">` : ''}</div>
    <h3>${esc(F.hname(x))}</h3>
    <p class="h-card-m">${esc(shortTown(x.city))}${F.kindsOf(x).length ? ' · ' + esc(F.kindsOf(x).map(F.kindName).join(', ')) : ''}${o.d != null ? ' · ' + h(o.fromCentre ? 'kmCentre' : 'km', { k: o.d < 10 ? o.d.toFixed(1) : Math.round(o.d) }) : ''}</p>
    <p class="h-card-p">${price}</p>${x.instant ? `<p class="h-card-i">${esc(h('instant'))}</p>` : ''}
  </a>${heart(x.slug)}${cmpBtn(x.slug)}</article>`;
  }

  // ---------- kinds (chips) and rows ----------
  let curKind = '';
  function renderChips() {
    const kinds = KIND_ORDER.filter(k => D.KINDS[k] && F.pub().some(x => F.kindsOf(x).includes(k) && !x.hidden));
    $('#chips').innerHTML = [['', '✨', h('all')], ...kinds.map(k => [k, KIND_ICON[k] || '', F.kindName(k)])]
      .map(([k, i, n]) => `<button type="button" class="h-chip" data-kind="${k}" aria-pressed="${k === curKind}"><span aria-hidden="true">${i}</span> ${esc(n)}</button>`).join('');
  }
  $('#chips').addEventListener('click', e => {
    const b = e.target.closest('[data-kind]'); if (!b) return;
    curKind = b.dataset.kind; renderChips(); renderRows();
    if (!$('#results').hidden) showResults(false);
  });
  const row = (id, title, sub, items, more) => `<section class="h-row-sec"${id ? ` id="${id}"` : ''}>
    <div class="h-row-head wrap"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${more ? `<button type="button" class="h-more" ${more} aria-label="${esc(h('seeAll') + ': ' + title)}"><span aria-hidden="true">→</span></button>` : ''}</div>
    <div class="h-row">${items}</div></section>`;
  function renderRows() {
    const s = st(), all = F.find({ g: s.g + s.kids }).filter(r => (!curKind || F.kindsOf(r.h).includes(curKind)) && petsOk(r.h, s));
    const by = new Map(all.map(r => [r.h.slug, r]));
    let html = '';
    const sv = saved().map(x => by.get(x) || F.find({ g: 2 }).find(r => r.h.slug === x)).filter(Boolean);
    if (sv.length) html += row('saved', h('saved'), '', sv.map(r => card(r.h, r.o, {})).join(''), '');
    const fresh = all.filter(r => r.h.real);
    if (!curKind && fresh.length) html += row('', h('newH'), h('newSub'), [...fresh].reverse().map(r => card(r.h, r.o, {})).join(''), '');
    if (!curKind) {
      for (const k of KIND_ORDER) {
        const rs = all.filter(r => F.kindsOf(r.h).includes(k)); if (!rs.length) continue;
        html += row('', H.rowKind[k][LI()], [...new Set(rs.map(r => shortTown(r.h.city)))].join(', '), rs.map(r => card(r.h, r.o, {})).join(''), `data-more-kind="${k}"`);
      }
    } else {
      const towns = [...new Set(all.map(r => r.h.city))].sort((a, b) => all.filter(r => r.h.city === b).length - all.filter(r => r.h.city === a).length);
      for (const c of towns) {
        const rs = all.filter(r => r.h.city === c);
        html += row('', shortTown(c), F.kindName(curKind), rs.map(r => card(r.h, r.o, {})).join(''), `data-more-city="${esc(c)}"`);
      }
    }
    $('#rows').innerHTML = html;
    $('#menuSaved').hidden = !sv.length;
  }
  $('#rows').addEventListener('click', e => {
    const b = e.target.closest('.h-more'); if (!b) return;
    if (b.dataset.moreKind) { curKind = b.dataset.moreKind; Q.city.value = ''; renderChips(); renderRows(); }
    if (b.dataset.moreCity) Q.city.value = b.dataset.moreCity;
    summary(); showResults(true);
  });


  // ---------- compare up to three hotels side by side (kept in this browser) ----------
  const CKEY = 'v2-compare', CMAX = 3;
  const cmpList = () => { try { return JSON.parse(localStorage.getItem(CKEY) || '[]').slice(0, CMAX); } catch (e) { return []; } };
  const cmpSet = l => { try { localStorage.setItem(CKEY, JSON.stringify(l.slice(0, CMAX))); } catch (e) { /* private mode */ } };
  const cmpBtn = slug => { const on = cmpList().includes(slug);
    return `<button type="button" class="h-cmp" data-cmp="${esc(slug)}" aria-pressed="${on}"><span class="h-cmp-box" aria-hidden="true"></span>${esc(h(on ? 'cmpOn' : 'cmpAdd'))}</button>`; };
  const AMEN = { wifi: ['Wi-Fi', 'Wi-Fi', 'Wi-Fi'], parking: ['პარკინგი', 'Parking', 'Парковка'], kitchen: ['სამზარეულო', 'Kitchen', 'Кухня'], breakfast: ['საუზმე', 'Breakfast', 'Завтрак'],
    fireplace: ['ბუხარი', 'Fireplace', 'Камин'], pool: ['აუზი', 'Pool', 'Бассейн'], garden: ['ეზო', 'Garden', 'Сад'], bbq: ['მაყალი', 'BBQ', 'Мангал'], pets: ['ცხოველით', 'Pets allowed', 'С животными'],
    ski: ['საბაგიროსთან', 'Near ski lifts', 'У подъёмника'], balcony: ['აივანი', 'Balcony', 'Балкон'], kids: ['საბავშვო კუთხე', 'Kids corner', 'Детский уголок'], transfer: ['ტრანსფერი', 'Transfer', 'Трансфер'],
    sea: ['ზღვასთან', 'Near the sea', 'У моря'], center: ['ცენტრში', 'City centre', 'В центре'] };
  // the sample hotels' room types are written in Georgian; the same names as on the hotel page (site/site.js TYPE_TR)
  const TYPE_TR = { 'სტანდარტული ორადგილიანი': ['Standard double', 'Стандартный двухместный'], 'საოჯახო, 1 საძინებლით (4+1)': ['Family, 1 bedroom (4+1)', 'Семейный, 1 спальня (4+1)'], 'ლუქსი, 2 საძინებლით': ['Suite, 2 bedrooms', 'Люкс, 2 спальни'] };
  const nameOf = n => { const v = typeof n === 'string' ? n : n ? n[F.lang] || n.ka || n.en || '' : ''; return F.lang !== 'ka' && TYPE_TR[v] ? TYPE_TR[v][F.lang === 'en' ? 0 : 1] : v; };
  function cmpFacts(x) {
    const types = (x.real ? (x.roomTypes || []) : Object.values(x.types || {}).map(t => t.name)).map(nameOf);
    const cap = x.real ? x.cap : Math.max(0, ...Object.values(x.types || {}).flatMap(t => (t.rates || []).map(r => r.guests)));
    const k = x.real ? x.kids : x.site?.kids;
    return { types, cap, rooms: x.real ? x.rooms : (D && D.ROOMS ? D.ROOMS.length : null), amen: x.site?.amenities || x.amenities || [],
      kids: !k || !k.mode || k.mode === 'adult' ? h('kidAdult') : k.mode === 'free' ? h('kidFree') : h('kidFixed', { p: k.price }) };
  }
  function drawCompare() {
    const s = st(), isDated = dated(s), list = cmpList();
    if (isDated) F.loadReal({ from: s.from, to: s.to, g: s.g + s.kids, rooms: s.rooms, kids: s.kids });
    const rows = list.map(slug => F.find({ from: s.from, to: s.to, g: s.g + s.kids, rooms: s.rooms, kids: s.kids }).find(r => r.h.slug === slug) || F.find({ g: 2 }).find(r => r.h.slug === slug)).filter(Boolean);
    const bar = $('#cmpBar');
    bar.hidden = !rows.length;
    $('#cmpN').textContent = h('cmpN', { n: rows.length });
    if (!rows.length) { if ($('#cmp').open) $('#cmp').close(); return; }
    const price = o => isDated ? (o.unknown ? h('fromP', { p: o.minFrom }) + ' / ' + h('perNight') : o.best ? `<b>${o.best.total} ₾</b><small>${h('totalN', { n: o.n })}${s.rooms > 1 ? ' · ' + h('roomsAll', { n: s.rooms }) : ''}</small>` : `<span class="h-busy">${o.freeRooms != null && s.rooms > 1 ? h('onlyFree', { n: o.freeRooms }) : h('busy')}</span>`)
      : `<b>${h('fromP', { p: o.minFrom })}</b><small>${h('perNight')}</small>`;
    const F2 = rows.map(r => ({ r, f: cmpFacts(r.h) }));
    const line = (label, cell) => `<tr><th scope="row">${esc(h(label))}</th>${F2.map(({ r, f }) => `<td>${cell(r, f)}</td>`).join('')}</tr>`;
    $('#cmpBody').innerHTML = `<p class="h-cmp-note">${isDated ? esc(`${range(s)} · ${guests(s)}`) : esc(h('pickDates'))}</p>
      <div class="h-cmp-scroll"><table class="h-cmp-t" style="min-width:${104 + F2.length * 156}px"><thead><tr><th></th>${F2.map(({ r }) => {
        const x = r.h, img = x.img || (x.cover ? `img/h/${x.cover}-s.jpg` : '');
        return `<th scope="col"><a href="${F.link(x, isDated ? { from: s.from, to: s.to, g: s.g + s.kids, rooms: s.rooms, kids: s.kids } : {})}"><span class="h-cmp-ph">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}</span><b>${esc(F.hname(x))}</b></a><button type="button" class="h-cmp-rm" data-cmp="${esc(x.slug)}">${esc(h('cmpRm'))}</button></th>`;
      }).join('')}</tr></thead><tbody>
      ${line('cmpPrice', r => price(r.o))}
      ${line('cmpTown', r => esc(shortTown(r.h.city)))}
      ${line('cmpKinds', r => esc(F.kindsOf(r.h).map(F.kindName).join(', ') || '—'))}
      ${line('cmpRooms', (r, f) => f.types.length ? f.types.map(esc).join('<br>') : '—')}
      ${line('cmpCap', (r, f) => f.cap ? esc(h('cmpCapN', { n: f.cap })) + (f.rooms ? `<small>${esc(h('cmpRoomsN', { n: f.rooms }))}</small>` : '') : '—')}
      ${line('cmpAmen', (r, f) => f.amen.length ? `<ul>${f.amen.map(a => `<li>${esc(AMEN[a] ? AMEN[a][LI()] : a)}</li>`).join('')}</ul>` : '—')}
      ${line('cmpKids', (r, f) => esc(f.kids))}
      </tbody></table></div>`;
  }
  function cmpSync() {
    const l = cmpList();
    document.querySelectorAll('[data-cmp].h-cmp').forEach(b => { const on = l.includes(b.dataset.cmp); b.setAttribute('aria-pressed', String(on)); b.lastChild.textContent = h(on ? 'cmpOn' : 'cmpAdd'); });
    drawCompare();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-cmp]'); if (!b) return;
    e.preventDefault();
    const l = cmpList(), i = l.indexOf(b.dataset.cmp);
    if (i >= 0) l.splice(i, 1);
    else { if (l.length >= CMAX) { $('#cmpFull').hidden = false; setTimeout(() => { $('#cmpFull').hidden = true; }, 3500); return; } l.push(b.dataset.cmp); }
    cmpSet(l); cmpSync();
  });
  $('#cmpOpen').addEventListener('click', () => { drawCompare(); $('#cmp').showModal(); });
  $('#cmpClear').addEventListener('click', () => { cmpSet([]); cmpSync(); });
  $('#cmp').addEventListener('click', e => { if (e.target === e.currentTarget || e.target.closest('[data-close]')) $('#cmp').close(); });
  F.onReal(cmpSync);

  // ---------- results ----------
  let center = null, radius = 5, map = null, layer = null;
  const RADII = [1, 3, 5, 10, 25];
  // sorting: our order, by price either way, or by distance (from the chosen point, or from the chosen town's centre)
  let sortBy = '';
  function drawSort(s) {
    const near = center || F.centreOf(s.city), o = [['', h('sortDef')], ['cheap', h('sortCheap')], ['dear', h('sortDear')]];
    if (near) o.push(['near', center ? h('sortPoint') : h('sortNear', { p: F.town(s.city) })]);
    if (sortBy === 'near' && !near) sortBy = '';
    $('#sortBy').innerHTML = o.map(([v, t]) => `<option value="${v}"${v === sortBy ? ' selected' : ''}>${esc(t)}</option>`).join('');
  }
  $('#sortBy').addEventListener('change', e => { sortBy = e.target.value; showResults(false); });
  function showResults(scroll) {
    if (dated(st())) { const s0 = st(); F.loadReal({ from: s0.from, to: s0.to, g: s0.g + s0.kids, rooms: s0.rooms, kids: s0.kids }); }
    const s0 = st(); drawSort(s0);
    const s = s0, near = !center && sortBy === 'near' ? F.centreOf(s.city) : null;
    const rows = F.find({ city: s.city, from: s.from, to: s.to, g: s.g + s.kids, rooms: s.rooms, kids: s.kids, kind: curKind, center, r: radius, sort: sortBy, near }).filter(r => petsOk(r.h, s));
    $('#results').hidden = false;
    $('#resTitle').textContent = center ? h('within', { r: radius }) : s.city ? F.town(s.city) : curKind ? F.kindName(curKind) : h('allStays');
    $('#resNote').textContent = dated(s) ? `${range(s)} · ${guests(s)} · ${h('freeN', { n: rows.filter(r => r.o.best).length })}` : h('pickDates');
    $('#resCards').innerHTML = rows.map(r => card(r.h, { ...r.o, d: r.d, fromCentre: !!near }, s)).join('') || `<p class="h-empty">${h('none')}</p>`;
    drawMap(rows, s);
    if (scroll) $('#results').scrollIntoView({ behavior: still.matches ? 'auto' : 'smooth' });
  }
  $('#resClear').addEventListener('click', () => {
    Q.city.value = Q.from.value = Q.to.value = ''; Q.g.value = 2; Q.kids.value = 0; Q.babies.value = 0; Q.pets.value = 0; Q.rooms.value = 1; curKind = ''; center = null;
    $('#results').hidden = true; $('#mapBox').hidden = true; $('#mapBtn').setAttribute('aria-expanded', 'false');
    summary(); renderChips(); renderRows();
    $('.h-hero').scrollIntoView({ behavior: still.matches ? 'auto' : 'smooth' });
  });

  // the map: pins with prices; tap a point to search around it
  const loadLeaflet = () => window.L ? Promise.resolve(window.L) : new Promise((ok, bad) => {
    const c = document.createElement('link'); c.rel = 'stylesheet'; c.href = 'vendor/leaflet/leaflet.css'; document.head.append(c);
    const s = document.createElement('script'); s.src = 'vendor/leaflet/leaflet.js'; s.onload = () => ok(window.L); s.onerror = bad; document.head.append(s);
  });
  function renderRadius() { $('#radius').innerHTML = RADII.map(r => `<button type="button" class="h-chip" data-r="${r}" aria-pressed="${r === radius}">${h('km', { k: r })}</button>`).join(''); }
  function drawMap(rows, s) {
    if (!map) return;
    const L = window.L; layer.clearLayers();
    if (center) {
      L.circle([center.lat, center.lng], { radius: radius * 1000, color: '#0E857D', weight: 2, fillColor: '#0E857D', fillOpacity: .1 }).addTo(layer);
      L.circleMarker([center.lat, center.lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#0A3A37', fillOpacity: 1 }).addTo(layer);
    }
    const pins = center ? rows : F.find({ city: s.city, from: s.from, to: s.to, g: s.g + s.kids, rooms: s.rooms, kids: s.kids, kind: curKind });
    const pts = [];
    for (const { h: x, o } of pins) {
      if (!x.lat) continue;
      const price = dated(s) ? (o.best ? o.best.total + ' ₾' : '—') : h('fromP', { p: o.minFrom });
      const icon = L.divIcon({ className: '', html: `<span class="pin${dated(s) && !o.best ? ' no' : ''}">${esc(price)}</span>`, iconSize: null });
      L.marker([x.lat, x.lng], { icon, title: F.hname(x) }).addTo(layer)
        .bindPopup(`<a class="pop" href="${F.link(x, dated(s) ? { from: s.from, to: s.to, g: s.g + s.kids, rooms: s.rooms, kids: s.kids } : {})}"><img src="${esc(x.img || `img/h/${x.cover}-s.jpg`)}" alt=""><b>${esc(F.hname(x))}</b><span>${esc(shortTown(x.city))} · ${esc(price)}</span></a>`);
      pts.push([x.lat, x.lng]);
    }
    if (!center && pts.length) map.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 13 });
  }
  $('#mapBtn').addEventListener('click', () => {
    const box = $('#mapBox'), open = box.hidden; box.hidden = !open; $('#mapBtn').setAttribute('aria-expanded', String(open));
    if (!open) { center = null; showResults(false); return; }
    renderRadius();
    loadLeaflet().then(L => {
      if (!map) {
        map = L.map('map', { scrollWheelZoom: false }).setView([42.1, 43.6], 7);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
        map.attributionControl.setPrefix(false);
        layer = L.layerGroup().addTo(map);
        map.on('click', e => setCenter({ lat: e.latlng.lat, lng: e.latlng.lng }));
      }
      setTimeout(() => { map.invalidateSize(); showResults(false); }, 50);
    });
  });
  function setCenter(c) {
    center = c; showResults(false);
    if (c && map) map.fitBounds(window.L.latLng(c.lat, c.lng).toBounds(radius * 2200));
  }
  $('#radius').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; radius = +b.dataset.r; renderRadius(); if (center) setCenter(center); });
  $('#nearMe').addEventListener('click', () => {
    if (!navigator.geolocation) return;
    $('#mapHint').textContent = h('locating');
    navigator.geolocation.getCurrentPosition(p => { $('#mapHint').textContent = h('mapHint'); setCenter({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { $('#mapHint').textContent = h('noLoc'); }, { timeout: 10000 });
  });

  // ---------- where to eat: the weekly list from OpenStreetMap (data/places.json), by town ----------
  let eatFile = null, eatTown = '';
  const EAT_C = { 'ბაკურიანი': [41.7495, 43.5320], 'თბილისი': [41.6925, 44.8015], 'ბათუმი': [41.6475, 41.6370], 'თელავი': [41.9198, 45.4733], 'გუდაური': [42.4770, 44.4780] };
  const eatKind = k => { const K = window.V2FOOD?.KIND || {}; return (K[k] || K.restaurant || [''])[LI()] || ''; };
  const dist = m => (m < 1000 ? m + ' ' + ['მ', 'm', 'м'][LI()] : (m / 1000).toFixed(1) + ' ' + ['კმ', 'km', 'км'][LI()]);
  async function renderEat() {
    eatFile = eatFile || fetch('data/places.json').then(r => r.json()).catch(() => ({}));
    const towns = (await eatFile).towns || {};
    const list = F.cities().filter(c => towns[c]?.length);
    if (!list.length) { $('#eat').hidden = true; return; }
    $('#eat').hidden = false;
    if (!list.includes(eatTown)) eatTown = list.includes(st().city) ? st().city : list[0];
    $('#eatTowns').innerHTML = list.map(c => `<button type="button" class="h-chip" data-eat="${esc(c)}" aria-pressed="${c === eatTown}">${esc(shortTown(c))}</button>`).join('');
    const ads = (window.V2ADS?.inTown(eatTown) || []).map(x => ({ ...x, m: window.V2ADS.metres({ lat: EAT_C[eatTown]?.[0] ?? x.lat, lng: EAT_C[eatTown]?.[1] ?? x.lng }, x) }));
    $('#eatAds').hidden = !ads.length;
    $('#eatAds').innerHTML = ads.map(x => `<a class="h-eat h-eat-ad" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(x.name.ka + ', ' + shortTown(eatTown))}" target="_blank" rel="noopener">
      <img src="${esc(x.photo)}" alt="" loading="lazy"><span class="h-eat-badge">${h('adBadge')}</span>
      <span class="h-eat-k">${esc(eatKind(x.kind))}</span><b>${esc(x.name[F.lang] || x.name.ka)}</b><span>${esc(x.note[F.lang] || x.note.ka)}</span></a>`).join('');
    $('#eatRow').innerHTML = towns[eatTown].slice(0, 10).map(x => `<a class="h-eat" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((x.name.def || '') + ', ' + F.town(eatTown).replace(/\s*\(.*\)\s*$/, '') + ', Georgia')}" target="_blank" rel="noopener">
      <span class="h-eat-k">${esc(eatKind(x.kind))}</span><b>${esc(x.name[F.lang] || x.name.def)}</b><span>${esc(h('fromCentre', { m: dist(x.m) }))}</span></a>`).join('');
  }
  $('#eatTowns').addEventListener('click', e => { const b = e.target.closest('[data-eat]'); if (!b) return; eatTown = b.dataset.eat; renderEat(); });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); renderEat(); } }, { rootMargin: '600px' });
    io.observe($('#how'));
  } else renderEat();

  // the chatbot hands its search to the page
  window.V2HOME = { show(q) { Q.city.value = q.city || ''; Q.from.value = q.from || ''; Q.to.value = q.to || ''; Q.kids.value = q.kids || 0; Q.g.value = Math.max(1, (q.g || 2) - (q.kids || 0)); Q.babies.value = q.babies || 0; Q.rooms.value = q.rooms || 1; summary(); showResults(true); } };

  function renderAll() { applyTexts(); summary(); heroCredit(); renderChips(); renderRows(); if (!$('#results').hidden) showResults(false); if (!$('#eat').hidden) renderEat(); if (view && sheet.open) show(view); }
  window.V2LANG?.onChange(renderAll);
  // real hotels arrive from the server a moment later: redraw what shows hotels
  F.onReal(() => { renderChips(); renderRows(); if (!$('#results').hidden) showResults(false); if (heroList.every(x => !x.real) && F.pub().some(x => x.real)) { heroList = pickHero(); heroShow(0); } });
  F.loadReal();
  renderAll();
})();
