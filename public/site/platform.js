/* Visit2.ge platform pages: the guests' search across hotels and the owners' page with sign-up (demo, browser-only).
   Three languages; the choice is shared with the hotel sites (same storage key as js/i18n.js). */
(() => {
  const D = window.V2DEMO, $ = s => document.querySelector(s);
  // the guest catalogue: published hotels only. The owner's own demo site ("mine") stays private to them.
  const pub = () => D.list().filter(h => !h.mine);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- language ----------
  const LANGS = ['ka', 'en', 'ru'], KEY = 'jiji-lang';
  let lang = (() => {
    const q = new URLSearchParams(location.search).get('lang'); if (LANGS.includes(q)) return q;
    try { const s = localStorage.getItem(KEY); if (LANGS.includes(s)) return s; } catch (e) {}
    const n = (navigator.language || '').slice(0, 2).toLowerCase();
    return n === 'ka' ? 'ka' : ['ru', 'uk', 'be', 'kk', 'hy', 'az'].includes(n) ? 'ru' : n ? 'en' : 'ka';
  })();
  const L = () => LANGS.indexOf(lang);
  const listeners = [];
  window.V2LANG = { get lang() { return lang; }, onChange: f => listeners.push(f) };

  const T = {
    navHotels: ['სასტუმროები', 'Hotels', 'Отели'], partners: ['პარტნიორებისთვის', 'For partners', 'Партнёрам'], partnersTop: ['პარტნიორებს', 'Partners', 'Партнёрам'], navOwners: ['მფლობელებს', 'For owners', 'Владельцам'],
    gH1: ['იპოვე სასტუმრო საქართველოში და დაჯავშნე პირდაპირ', 'Find a place to stay in Georgia and book it direct', 'Найдите жильё в Грузии и бронируйте напрямую'],
    gLead: ['ფასს სასტუმრო თავად აწესებს, შუამავალი არ არის. თავისუფალი ნომრები ნამდვილია: სასტუმროები ჯავშნებს Visit2.ge-ზე მართავენ.', 'Hotels set their own prices, with no middleman. Availability is real: hotels manage their bookings on Visit2.ge.', 'Цены устанавливает сам отель, без посредников. Свободные номера настоящие: отели ведут брони на Visit2.ge.'],
    popular: ['პოპულარული', 'Popular', 'Популярные'], allPlaces: ['ყველა ადგილი ანბანით', 'All places A–Z', 'Все места по алфавиту'],
    city: ['ქალაქი ან კურორტი', 'City or resort', 'Город или курорт'], all: ['ყველა', 'All', 'Все'], in: ['შესვლა', 'Check-in', 'Заезд'], out: ['გასვლა', 'Check-out', 'Выезд'],
    guests: ['სტუმარი', 'Guests', 'Гости'], search: ['ძებნა', 'Search', 'Найти'],
    why1: ['<b>პირდაპირ სასტუმროსთან</b>მოთხოვნა სასტუმროს ეგზავნება და ისინი გირეკავენ დასადასტურებლად.', '<b>Straight to the hotel</b>Your request goes to the hotel, and they call you to confirm.', '<b>Напрямую в отель</b>Запрос уходит в отель, и вам перезвонят для подтверждения.'],
    why2: ['<b>გადახდა სასტუმროში</b>წინასწარ ბარათს არ გთხოვთ. გადახდის პირობებს სასტუმრო გეტყვით.', '<b>Pay at the hotel</b>No card needed upfront. The hotel tells you how to pay.', '<b>Оплата в отеле</b>Карта заранее не нужна. Условия оплаты сообщит отель.'],
    why3: ['<b>ჯავშნის მერე ადგილი გარანტირებულია</b>გიჩვენებთ მხოლოდ იმ ნომრებს, რომლებიც შენს თარიღებზე მართლა თავისუფალია: სასტუმრო კალენდარს აქვე მართავს.', '<b>If you see it, you can book it</b>We only show rooms that are really free on your dates: the hotel runs its calendar right here.', '<b>Видите номер — можно бронировать</b>Мы показываем только номера, которые действительно свободны на ваши даты: отель ведёт календарь здесь.'],
    bandH: ['გაქვს სასტუმრო ან ბინა?', 'Own a hotel or a flat?', 'У вас отель или квартира?'],
    bandP: ['მიიღე საიტი, ჯავშნების ადმინი და ჩატბოტი. ფიქსირებული 50₾ თვეში, პროცენტის გარეშე. პირველი 30 დღე უფასოა.', 'Get a website, a booking admin and a chatbot. A flat 50₾ a month, no commission. The first 30 days are free.', 'Сайт, админка для броней и чат-бот. 50₾ в месяц, без процентов. Первые 30 дней бесплатно.'],
    bandBtn: ['მფლობელებისთვის', 'For owners', 'Владельцам'], demo: ['დემო: მონაცემები მხოლოდ ამ ბრაუზერში ინახება', 'Demo: data stays in this browser', 'Демо: данные только в этом браузере'],
    mapOpen: ['რუკაზე ძებნა', 'Search on the map', 'Поиск на карте'], mapHint: ['დააჭირე რუკაზე ადგილს, სადაც სასტუმრო გინდა', 'Tap the place on the map where you want to stay', 'Нажмите на карте место, где хотите остановиться'],
    mapHint2: ['ადგილის შესაცვლელად რუკაზე სხვაგან დააჭირე', 'Tap elsewhere on the map to move the point', 'Нажмите в другом месте, чтобы сменить точку'],
    nearMe: ['📍 ჩემთან ახლოს', '📍 Near me', '📍 Рядом со мной'], mapClear: ['გასუფთავება', 'Clear', 'Сбросить'], kmU: ['კმ', 'km', 'км'],
    kmAway: ['{k} კმ', '{k} km away', '{k} км'], mapTitle: ['{r} კმ-ის რადიუსში', 'Within {r} km', 'В радиусе {r} км'],
    mapNone: ['ამ რადიუსში სასტუმრო ჯერ არ არის. გაზარდე რადიუსი ან აირჩიე სხვა ადგილი.', 'Nothing within this radius yet. Make it larger or pick another point.', 'В этом радиусе пока ничего нет. Увеличьте радиус или выберите другую точку.'],
    locating: ['ვეძებ შენს ადგილს…', 'Finding you…', 'Определяем место…'], noLoc: ['ადგილი ვერ განისაზღვრა. დააჭირე რუკაზე.', 'Could not get your location. Tap the map instead.', 'Не удалось определить место. Нажмите на карте.'],
    privacy: ['კონფიდენციალურობა', 'Privacy', 'Конфиденциальность'], terms: ['პირობები', 'Terms', 'Условия'],
    fAgree: ['ვეთანხმები <a href="terms.html" target="_blank">მომსახურების პირობებს</a>, მათ შორის სტუმრების მონაცემების დამუშავების შეთანხმებას, და <a href="privacy.html" target="_blank">კონფიდენციალურობის პოლიტიკას</a>', 'I agree to the <a href="terms.html" target="_blank">terms of service</a>, including the guest data processing agreement, and the <a href="privacy.html" target="_blank">privacy policy</a>', 'Я принимаю <a href="terms.html" target="_blank">условия обслуживания</a>, включая соглашение об обработке данных гостей, и <a href="privacy.html" target="_blank">политику конфиденциальности</a>'],
    needAgree: ['გასაგრძელებლად დაეთანხმე პირობებს', 'Please accept the terms to continue', 'Чтобы продолжить, примите условия'],
    destH: ['სად წავიდეთ', 'Where to go', 'Куда поехать'],
    eatH: ['სად ვჭამოთ', 'Where to eat', 'Где поесть'], eatNote: ['ადგილები და რუკა: © OpenStreetMap-ის მონაწილეები.', 'Places and map: © OpenStreetMap contributors.', 'Места и карта: © участники OpenStreetMap.'],
    eatWait: ['ადგილებს ვეძებთ…', 'Finding places…', 'Ищем места…'], eatNone: ['ამ ადგილისთვის სია ახლა ვერ ჩაიტვირთა.', 'The list could not load right now.', 'Список сейчас не загрузился.'],
    eatCenter: ['ცენტრიდან {m}', '{m} from the centre', '{m} от центра'], howH: ['როგორ მუშაობს', 'How it works', 'Как это работает'],
    addDate: ['აირჩიე', 'Add date', 'Выбрать'], nHotels: ['{n} სასტუმრო', '{n} places to stay', 'Мест: {n}'], nHotel1: ['1 სასტუმრო', '1 place to stay', '1 место'],
    hotels: ['სასტუმროები', 'Hotels', 'Отели'], pickDates: ['აირჩიე თარიღები, რომ ნახო თავისუფალი ნომრები და ფასი', 'Choose dates to see free rooms and the price', 'Выберите даты, чтобы увидеть свободные номера и цену'],
    free: ['თავისუფალი', 'available', 'свободно'], nightsW: ['ღამე', 'nights', 'ноч.'], guestsW: ['სტუმარი', 'guests', 'гост.'], perNight: ['ღამე', 'night', 'ночь'],
    fromP: ['{p} ₾-დან', 'from {p} ₾', 'от {p} ₾'], tagFree: ['✓ თავისუფალია ამ თარიღებზე', '✓ Available on these dates', '✓ Свободно на эти даты'],
    tagNo: ['ამ თარიღებზე თავისუფალი არ არის', 'Not available on these dates', 'На эти даты мест нет'], tagReal: ['✓ პირდაპირი ჯავშანი', '✓ Book direct', '✓ Бронь напрямую'],
    promo: ['რეკომენდებული · რეკლამა', 'Featured · ad', 'Рекомендуем · реклама'],
    yours: ['შენი სასტუმრო', 'your hotel', 'ваш отель'], none: ['აქ Visit2.ge-ზე სასტუმრო ან ბინა ჯერ არ არის. სცადე ახლომდებარე ადგილი.', 'No hotels or flats here on Visit2.ge yet. Try a place nearby.', 'Здесь на Visit2.ge пока нет отелей и квартир. Попробуйте место рядом.'],
    oSlogan: ['შენი ვიზიტ2 უკვე გეძებს', 'Your guests are already looking for you', 'Ваши гости уже ищут вас'],
    oH1: ['შენი სასტუმროს საიტი, ჯავშნები და ჩატბოტი ერთ ადგილას', 'Your hotel website, bookings and chatbot in one place', 'Сайт отеля, брони и чат-бот в одном месте'],
    oLead: ['აირჩიე შაბლონი, ჩაწერე სახელი, და საიტი მზადაა.', 'Pick a template, type your name, and your site is ready.', 'Выберите шаблон, впишите название, и сайт готов.'],
    oPrice: ['50₾ თვეში, საკომისიოს გარეშე · პირველი 30 დღე უფასოდ', '50₾ a month, no commission · first 30 days free', '50₾ в месяц, без комиссии · первые 30 дней бесплатно'],
    create: ['საიტის შექმნა', 'Create my site', 'Создать сайт'], seeTpl: ['შაბლონების ნახვა', 'See templates', 'Шаблоны'], getsH: ['რას იღებ', 'What you get', 'Что вы получаете'],
    get1: ['<b>საიტი</b>ათი შაბლონიდან ერთ-ერთი, შენი ფერით, ფოტოებით და ტექსტებით. ქართულად, ინგლისურად და რუსულად.', '<b>Website</b>One of ten templates with your colour, photos and texts. In Georgian, English and Russian.', '<b>Сайт</b>Один из десяти шаблонов с вашим цветом, фото и текстами. На грузинском, английском и русском.'],
    get2: ['<b>ადმინი</b>მოთხოვნები, კალენდარი, ფასები სეზონებით, გადახდები, სტუმრების ისტორია, გუნდი და ჟურნალი.', '<b>Admin</b>Requests, calendar, seasonal prices, payments, guest history, team and activity log.', '<b>Админка</b>Запросы, календарь, сезонные цены, оплаты, история гостей, команда и журнал.'],
    get3: ['<b>ჩატბოტი</b>საიტზე სტუმარს თავისუფალ ნომერს და ფასს წამებში ეუბნება. <span class="soon">Facebook და Instagram მალე</span>', '<b>Chatbot</b>Tells guests on your site what is free and what it costs, in seconds. <span class="soon">Facebook and Instagram soon</span>', '<b>Чат-бот</b>За секунды сообщает гостям, что свободно и сколько стоит. <span class="soon">Facebook и Instagram скоро</span>'],
    get4: ['<b>ადგილი კატალოგში</b>Visit2.ge-ზე სტუმრები ქალაქით და თარიღით გპოულობენ. პირველი 6 თვე უფასოდ, მერე 20₾ თვეში.', '<b>A place in the catalogue</b>Guests find you on Visit2.ge by city and dates. Free for 6 months, then 20₾ a month.', '<b>Место в каталоге</b>Гости находят вас на Visit2.ge по городу и датам. 6 месяцев бесплатно, потом 20₾ в месяц.'],
    tplH: ['ათი შაბლონი', 'Ten templates', 'Десять шаблонов'], tplP: ['ნებისმიერ დროს შეცვლი ადმინში. ჯავშნები და ფასები არ იკარგება.', 'Switch any time in the admin. Bookings and prices stay.', 'Меняйте в любой момент в админке. Брони и цены сохраняются.'],
    sample: ['ნიმუშის ნახვა', 'View sample', 'Посмотреть'], suH: ['შექმენი შენი საიტი', 'Create your site', 'Создайте свой сайт'],
    suP: ['შეავსე სამი ველი და საიტს მაშინვე ნახავ. შაბლონს, ფერს და ტექსტებს მერეც შეცვლი.', 'Fill in three fields and see your site right away. You can change the template, colour and texts later.', 'Заполните три поля и сразу увидите сайт. Шаблон, цвет и тексты можно поменять позже.'],
    fName: ['სასტუმროს სახელი', 'Hotel name', 'Название отеля'], fCity: ['ქალაქი ან სოფელი', 'Town or village', 'Город или село'], fEmail: ['ელფოსტა', 'Email', 'Эл. почта'],
    fPass: ['პაროლი ადმინისთვის', 'Password for the admin', 'Пароль для админки'], needEP: ['ჩაწერე ელფოსტა და პაროლი (მინიმუმ 8 სიმბოლო)', 'Enter an email and a password (at least 8 characters)', 'Введите почту и пароль (минимум 8 символов)'],
    sending: ['იქმნება…', 'Creating…', 'Создаём…'], netErr: ['კავშირი ვერ მოხერხდა. შეამოწმე ინტერნეტი და სცადე თავიდან.', 'Could not connect. Check the internet and try again.', 'Нет связи. Проверьте интернет и попробуйте снова.'],
    loginHint: ['ადმინში შედი შენი ელფოსტით და პაროლით.', 'Sign in to the admin with your email and password.', 'Входите в админку с вашей почтой и паролем.'],
    fTpl: ['შაბლონი', 'Template', 'Шаблон'], fCol: ['ფერი', 'Colour', 'Цвет'], needNC: ['ჩაწერე სასტუმროს სახელი და ქალაქი', 'Enter the hotel name and town', 'Укажите название и город'],
    ready: ['✓ „{n}“-ის საიტი მზადაა', '✓ {n}: your site is ready', '✓ Сайт «{n}» готов'],
    doneP: ['ადმინში ნომრები, ფასები და ტექსტები შეცვალე.', 'Change rooms, prices and texts in the admin.', 'Номера, цены и тексты меняйте в админке.'],
    mySite: ['ჩემი საიტი', 'My site', 'Мой сайт'], admin: ['ადმინი', 'Admin', 'Админка'], pricesH: ['ფასები', 'Prices', 'Цены'],
    pr1: ['საიტი, ადმინი და ჩატბოტი<small>პირველი 30 დღე უფასოდ, ბარათის გარეშე</small>', 'Website, admin and chatbot<small>First 30 days free, no card</small>', 'Сайт, админка и чат-бот<small>Первые 30 дней бесплатно, без карты</small>'],
    pr2: ['ადგილი Visit2.ge-ს კატალოგში<small>პირველი 6 თვე უფასოდ</small>', 'Listing in the Visit2.ge catalogue<small>First 6 months free</small>', 'Место в каталоге Visit2.ge<small>Первые 6 месяцев бесплатно</small>'],
    pr5: ['რეკლამა: წინ წამოწევა<small>ძებნაში სიის თავში, ნიშნით „რეკომენდებული“</small>', 'Promotion: move to the top<small>First in search, marked “Featured”</small>', 'Реклама: поднять наверх<small>Первым в поиске, с пометкой «Рекомендуем»</small>'],
    pr5v: ['მალე', 'soon', 'скоро'],
    pr3: ['სეზონური პაუზა<small>საიტი რჩება და წინასწარ ჯავშნებს იღებს; 1–6 თვე წელიწადში</small>', 'Seasonal pause<small>The site stays up and takes early bookings; 1–6 months a year</small>', 'Сезонная пауза<small>Сайт работает и принимает ранние брони; 1–6 месяцев в год</small>'],
    pr4: ['ჩვენ გავაკეთებთ<small>ფოტოები, ტექსტები, Google-ის პროფილი, Facebook-ისა და Instagram-ის მიერთება მალე</small>', 'We set it up for you<small>Photos, texts, Google profile. Facebook and Instagram connection soon</small>', 'Сделаем за вас<small>Фото, тексты, профиль Google. Подключение Facebook и Instagram скоро</small>'],
    pr1v: ['50₾ / თვე', '50₾ / month', '50₾ / мес.'], pr2v: ['+20₾ / თვე', '+20₾ / month', '+20₾ / мес.'],
    pr6: ['მხოლოდ კატალოგი, სისტემის გარეშე<small>თუ საკუთარი საიტი უკვე გაქვთ</small>', 'Catalogue only, without the system<small>If you already have your own website</small>', 'Только каталог, без системы<small>Если у вас уже есть свой сайт</small>'], pr6v: ['70₾ / თვე<small>მალე</small>', '70₾ / month<small>soon</small>', '70₾ / мес.<small>скоро</small>'], pr3v: ['10₾ / თვე', '10₾ / month', '10₾ / мес.'], pr4v: ['300₾ ერთხელ', '300₾ once', '300₾ разово'],
    rH: ['რესტორნებისთვის', 'For restaurants', 'Для ресторанов'],
    rP: ['რესტორანი Visit2.ge-ზე უფასოდ ჩანს ყველა ახლომდებარე სასტუმროს გვერდზე: სახელი, სამზარეულო და მანძილი. ფასიანია მხოლოდ „რეკომენდებული“: სიის თავში, გამორჩეული ჩარჩოთი.', 'Restaurants appear free on the page of every hotel nearby: name, cuisine and distance. Only “Recommended” is paid: top of the list, highlighted.', 'Ресторан бесплатно показывается на странице каждого отеля рядом: название, кухня и расстояние. Платно только «Рекомендуем»: первым в списке и с выделением.'],
    r1: ['ადგილი ახლომდებარე სასტუმროებში<small>სახელი, სამზარეულო, მანძილი</small>', 'Listed near hotels<small>Name, cuisine, distance</small>', 'Показ рядом с отелями<small>Название, кухня, расстояние</small>'],
    r1v: ['უფასოდ', 'free', 'бесплатно'],
    r2: ['„რეკომენდებული“<small>სიის თავში, ყველა ახლომდებარე სასტუმროს გვერდზე</small>', '“Recommended”<small>Top of the list on every hotel page nearby</small>', '«Рекомендуем»<small>Первым в списке на страницах отелей рядом</small>'],
    r2v: ['მალე', 'soon', 'скоро'],
    findHotels: ['სასტუმროების ძებნა', 'Find hotels', 'Поиск отелей'],
  };
  const t = (k, v = {}) => String((T[k] || [k])[L()] ?? T[k][0]).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
  const MONTHS = { ka: ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'] };
  // town names shown to visitors in their language (the demo towns; owners type their own)
  const PLACES = window.V2PLACES || [];
  const TOWN = Object.fromEntries(PLACES.map(p => [p[0], [p[1], p[2]]]));
  const town = c => (lang === 'ka' || !TOWN[c] ? c : TOWN[c][lang === 'en' ? 0 : 1]);
  // every town in the list plus any town an owner typed, alphabetically in the visitor's language
  const allTowns = () => {
    const own = [...new Set(pub().map(h => h.city).filter(c => !TOWN[c]))];
    return [...PLACES.map(p => p[0]), ...own].sort((a, b) => town(a).localeCompare(town(b), lang));
  };
  // popular places in order of popularity (the order in places.js)
  const popular = () => [...new Set([...PLACES.filter(p => p[3]).map(p => p[0]), ...pub().map(h => h.city)])];
  const hname = h => (lang === 'ka' || !h.nameT ? h.name : h.nameT[lang] || h.name);
  const TYPE = { 'სტანდარტული ორადგილიანი': ['Standard double', 'Стандартный двухместный'], 'საოჯახო, 1 საძინებლით (4+1)': ['Family, 1 bedroom', 'Семейный, 1 спальня'], 'ლუქსი, 2 საძინებლით': ['Suite, 2 bedrooms', 'Люкс, 2 спальни'] };
  const tname = n => (lang === 'ka' || !TYPE[n] ? n : TYPE[n][lang === 'en' ? 0 : 1]);

  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-t]').forEach(el => { const k = el.dataset.t; if (T[k]) el.innerHTML = t(k); });
    document.querySelectorAll('[data-plang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.plang === lang)));
    document.querySelectorAll('article[data-l]').forEach(a => { a.hidden = a.dataset.l !== lang; });
  }
  function setLang(l) {
    if (!LANGS.includes(l)) return; lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    applyLang(); fillTowns(); renderRadius(); render(); listeners.forEach(f => f(l));
  }
  document.querySelectorAll('[data-plang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.plang)));

  // ---------- dates ----------
  const toD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const toS = d => d.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return toS(d); };
  const today = () => toS(new Date(Date.now() + 4 * 3600e3)); // Georgian time
  const nights = (a, b) => Math.round((toD(b) - toD(a)) / 864e5);
  const season = s => { const m = +s.slice(5, 7), d = +s.slice(8); if ((m === 12 && d >= 25) || (m === 1 && d <= 7)) return 'peak'; if (m === 12 || m <= 3) return 'winter'; if (m >= 6 && m <= 8) return 'summer'; return 'off'; };
  const fmt = s => { const d = toD(s); return d.getUTCDate() + ' ' + MONTHS[lang][d.getUTCMonth()]; };

  // ---------- guests: search (also used by the chatbot) ----------
  const booked = h => { try { const st = JSON.parse(localStorage.getItem('v2-demo-' + h.slug) || 'null'); return st ? st.bookings.filter(b => b.status === 'confirmed') : []; } catch (e) { return []; } };
  function offer(h, from, to, g) {
    const rate = ty => (h.types[ty]?.rates || []).find(r => r.guests >= g);
    const minFrom = Math.min(...Object.values(h.types).flatMap(ty => ty.rates.map(r => Math.min(...Object.values(r.price)))));
    if (!from || !to || to <= from) return { minFrom };
    const bs = booked(h);
    let best = null;
    for (const ty of Object.keys(h.types)) {
      const r = rate(ty); if (!r) continue;
      const free = D.ROOMS.filter(x => x.type === ty && !bs.some(b => b.room === x.id && b.from < to && from < b.to));
      if (!free.length) continue;
      let sum = 0; for (let d = from; d < to; d = addDays(d, 1)) sum += r.price[season(d)] || 0;
      if (!best || sum < best.total) best = { total: sum, type: h.types[ty].name };
    }
    return { minFrom, best, n: nights(from, to) };
  }
  // distance in km between two points (haversine)
  const km = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLn = r(b.lng - a.lng);
    return 2 * R * Math.asin(Math.sqrt(Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLn / 2) ** 2)); };
  const find = ({ city = '', from = '', to = '', g = 2, kind = '', center = null, r = 5 }) => {
    const dated = from && to && to > from;
    return pub().filter(h => !h.hidden && (!city || h.city === city) && (!kind || h.kind === kind))
      .map(h => ({ h, o: offer(h, from, to, g), d: center && h.lat ? km(center, h) : null }))
      .filter(x => !center || (x.d != null && x.d <= r))
      .sort((a, b) => (dated ? (!!b.o.best - !!a.o.best) : 0) || (center ? a.d - b.d : 0) || (!!b.h.promo - !!a.h.promo) || (dated ? (a.o.best?.total || 0) - (b.o.best?.total || 0) : 0));
  };
  // this build's stamp (from our own script tag), so a hotel page never comes from an old browser copy
  const BUILD = ((document.querySelector('script[src*="site/platform.js"]') || {}).src || '').split('?v=')[1] || '';
  const link = (h, q) => `hotel.html?h=${encodeURIComponent(h.slug)}${q.from && q.to ? `&from=${q.from}&to=${q.to}&g=${q.g}` : ''}${BUILD ? '&v=' + BUILD : ''}`;
  // header: solid once the page scrolls, so the logo (home) and links stay readable everywhere
  const top = document.querySelector('.p-top');
  if (top) { const on = () => top.classList.toggle('scrolled', scrollY > 30); addEventListener('scroll', on, { passive: true }); on(); }
  window.V2FIND = { find, link, cities: popular, allTowns, town, hname, fmt, today, addDays, t };

  // the town list: popular places first, in order of popularity, then every place alphabetically
  function fillTowns() {
    const f = $('#search'); if (!f) return;
    const cur = f.city.value, opt = c => `<option value="${esc(c)}">${esc(town(c))}</option>`;
    f.city.innerHTML = `<option value="">${esc(t('all'))}</option><optgroup label="${esc(t('popular'))}">${popular().map(opt).join('')}</optgroup><optgroup label="${esc(t('allPlaces'))}">${allTowns().map(opt).join('')}</optgroup>`;
    f.city.value = cur;
  }
  function search() {
    const f = $('#search'); if (!f) return;
    const q = { city: f.city.value, from: f.from.value, to: f.to.value, g: +f.g.value, kind: curKind, center: mapCenter, r: radius }, dated = q.from && q.to && q.to > q.from;
    const rows = find(q);
    $('#resTitle').textContent = q.center ? t('mapTitle', { r: q.r }) : q.city ? `${t('hotels')}: ${town(q.city)}` : q.kind ? kindName(q.kind) : t('hotels');
    $('#resNote').textContent = dated ? `${fmt(q.from)} – ${fmt(q.to)} · ${q.g} ${t('guestsW')} · ${rows.filter(r => r.o.best).length} ${t('free')}` : t('pickDates');
    $('#cards').innerHTML = rows.map(({ h, o, d }) => {
      const img = h.cover ? `img/h/${h.cover}-s.jpg` : h.site?.hero?.img || '';
      const price = dated ? (o.best ? `${o.best.total} ₾ <small>${o.n} ${t('nightsW')}</small>` : '') : `${t('fromP', { p: o.minFrom })} <small>/ ${t('perNight')}</small>`;
      const tag = dated ? (o.best ? `${t('tagFree')} · ${esc(tname(o.best.type))}` : t('tagNo')) : t('tagReal');
      return `<a class="card${h.promo ? ' promo' : ''}" href="${link(h, q)}" data-free="${dated && !o.best ? 'no' : 'yes'}">
  <div class="card-ph">${h.promo ? `<span class="card-promo">${t('promo')}</span>` : ''}${h.kind ? `<span class="card-kind">${esc(kindName(h.kind))}</span>` : ''}
  ${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">` : ''}</div>
  <div class="card-body"><p class="card-city">${esc(town(h.city))}${h.mine ? ' · ' + t('yours') : ''}${d != null ? ' · ' + t('kmAway', { k: d < 10 ? d.toFixed(1) : Math.round(d) }) : ''}</p><h3>${esc(hname(h))}</h3>
  ${price ? `<p class="card-price">${price}</p>` : ''}<p class="card-tag">${tag}</p></div></a>`;
    }).join('') || `<p class="empty">${t(q.center ? 'mapNone' : 'none')}</p>`;
    drawMap(rows, q);
    document.querySelectorAll('#cities button').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.city === q.city)); b.textContent = town(b.dataset.city); });
    renderKinds(); renderDest(); renderHero(); if (typeof renderEat === 'function') renderEat();
  }
  // ---------- map search: tap a point, pick a radius ----------
  let map = null, mapCenter = null, radius = 5, layer = null;
  const RADII = [1, 3, 5, 10, 25];
  function initMap() {
    if (map || !window.L) return;
    map = window.L.map('map', { scrollWheelZoom: false }).setView([42.1, 43.6], 7);
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
    layer = window.L.layerGroup().addTo(map);
    map.on('click', e => setCenter({ lat: e.latlng.lat, lng: e.latlng.lng }));
    search();
  }
  function setCenter(c, zoom = true) {
    mapCenter = c; $('#mapClear').hidden = !c; $('#mapHint').textContent = t(c ? 'mapHint2' : 'mapHint');
    search();
    if (c && zoom && map) map.fitBounds(window.L.latLng(c.lat, c.lng).toBounds(radius * 2200));
  }
  function renderRadius() {
    const el = $('#radius'); if (!el) return;
    el.innerHTML = RADII.map(r => `<button type="button" class="chip" data-r="${r}" aria-pressed="${r === radius}">${r} ${t('kmU')}</button>`).join('');
  }
  function drawMap(rows, q) {
    if (!map) return;
    layer.clearLayers();
    if (q.center) {
      window.L.circle([q.center.lat, q.center.lng], { radius: q.r * 1000, color: '#0E857D', weight: 2, fillColor: '#0E857D', fillOpacity: .1 }).addTo(layer);
      window.L.circleMarker([q.center.lat, q.center.lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#0A3A37', fillOpacity: 1 }).addTo(layer);
    }
    const dated = q.from && q.to && q.to > q.from;
    const shown = q.center ? rows : find({ ...q, center: null });
    for (const { h, o } of shown) {
      if (!h.lat) continue;
      const price = dated ? (o.best ? o.best.total + ' ₾' : '—') : t('fromP', { p: o.minFrom });
      const icon = window.L.divIcon({ className: '', html: `<span class="pin${h.promo ? ' promo' : ''}${dated && !o.best ? ' no' : ''}">${esc(price)}</span>`, iconSize: null });
      window.L.marker([h.lat, h.lng], { icon, title: hname(h) }).addTo(layer)
        .bindPopup(`<a class="pop" href="${link(h, q)}"><img src="img/h/${h.cover}-s.jpg" alt=""><b>${esc(hname(h))}</b><span>${esc(town(h.city))} · ${esc(price)}</span></a>`);
    }
  }

  // kinds of stay (mountains, sea, wine, city, nature), each with a photo
  let curKind = '';
  const KIND_PH = { mountain: 'bakuriani-chalet', sea: 'sea-resort', wine: 'qvevri-pods', city: 'tbilisi-yard', nature: 'barrel-cabins' };
  const kindName = k => (D.KINDS[k] ? D.KINDS[k][L()] : k);
  function renderKinds() {
    const el = $('#kinds'); if (!el) return;
    el.innerHTML = Object.keys(D.KINDS).map(k => `<button type="button" class="kind" data-kind="${k}" aria-pressed="${k === curKind}"><img src="img/h/${KIND_PH[k]}-s.jpg" alt="" loading="lazy">${esc(kindName(k))}</button>`).join('');
  }
  // hero "window": a full-screen photo of one town at a time, with its name in very large letters.
  // It starts on a random town and moves on every few seconds; the dots let a guest pick one.
  let heroTowns = [], heroAt = -1, heroTimer = 0, heroHold = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  // a few real hotels picked at random from the catalogue on every visit (different towns where possible)
  // Later: promoted hotels get these places first, always marked as an ad.
  function heroList() {
    const all = pub().filter(h => !h.hidden && h.cover);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const seen = new Set(), pick = [];
    for (const h of all) if (!seen.has(h.city) && pick.length < 6) { seen.add(h.city); pick.push(h); }
    for (const h of all) if (pick.length < 6 && !pick.includes(h)) pick.push(h);
    return pick;
  }
  function heroShow(i, user) {
    if (!heroTowns.length) return;
    heroAt = (i + heroTowns.length) % heroTowns.length;
    const x = heroTowns[heroAt], img = `img/h/${x.cover}.jpg`;
    const a = $('#heroA'), b = $('#heroB'), front = a.classList.contains('hero-next') ? b : a, back = front === a ? b : a;
    const swap = () => { back.classList.remove('hero-next'); front.classList.add('hero-next'); };
    if (front.getAttribute('src') !== img) { back.onload = swap; back.src = img; if (back.complete && back.naturalWidth) swap(); }
    heroText();
    if (user) heroHold = Date.now() + 20000;
  }
  function heroText() {
    const x = heroTowns[heroAt]; if (!x) return;
    // the town in big letters (without the bracketed part, e.g. "(Kazbegi)"); the hotel itself on the small line
    const nm = town(x.city).replace(/\s*\(.*\)\s*$/, ''), el = $('#townName');
    el.textContent = nm; el.dataset.city = x.city;
    const meta = $('#townMeta'); meta.textContent = (x.kind ? kindName(x.kind) + ' · ' : '') + hname(x); meta.href = link(x, {});
    $('#townDots').innerHTML = heroTowns.map((y, j) => `<button type="button" data-hero="${j}" aria-label="${esc(hname(y))}"${j === heroAt ? ' aria-current="true"' : ''}><i></i></button>`).join('');
    heroFit();
  }
  // shrink the town name until it fits on one line (long names like Stepantsminda)
  function heroFit() {
    const el = $('#townName'); el.style.fontSize = '';
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth + 1 && size > 28) { size -= 4; el.style.fontSize = size + 'px'; }
  }
  function renderHero() {
    if (!$('#town')) return;
    if (!heroTowns.length) {
      heroTowns = heroList();
      heroShow(Math.floor(Math.random() * heroTowns.length));
      clearInterval(heroTimer);
      heroTimer = setInterval(() => { if (!still.matches && !document.hidden && Date.now() > heroHold && !$('#search').contains(document.activeElement)) heroShow(heroAt + 1); }, 6500);
    } else heroText();
  }
  // places to go: towns with hotels, the first one large
  const DEST = ['ბაკურიანი', 'თელავი', 'ბათუმი', 'თბილისი', 'გუდაური'];
  function renderDest() {
    const el = $('#dest'); if (!el) return;
    el.innerHTML = DEST.map(c => { const hs = pub().filter(h => h.city === c && !h.hidden); if (!hs.length) return '';
      return `<button type="button" class="dest-tile" data-dest="${esc(c)}"><img src="img/h/${hs[0].cover}${c === DEST[0] ? '' : '-s'}.jpg" alt="" loading="lazy"><div><b>${esc(town(c))}</b><span>${t(hs.length === 1 ? 'nHotel1' : 'nHotels', { n: hs.length })}</span></div></button>`; }).join('');
  }
  // where to eat: real restaurants and cafés around a town's centre, from OpenStreetMap (asked by this browser,
  // kept a week, loaded only when the section comes near the screen). Later, partner restaurants will be marked here.
  const EAT = { 'ბაკურიანი': [41.7495, 43.5320], 'თბილისი': [41.6925, 44.8015], 'ბათუმი': [41.6475, 41.6370], 'თელავი': [41.9198, 45.4733],
    'სიღნაღი': [41.6200, 45.9220], 'გუდაური': [42.4770, 44.4780], 'ბორჯომი': [41.8390, 43.3890], 'ქუთაისი': [42.2705, 42.7040],
    'მესტია': [43.0450, 42.7300], 'სტეფანწმინდა (ყაზბეგი)': [42.6570, 44.6430] };
  let eatTown = '', eatData = {}, eatSeen = false;
  const eatTowns = () => Object.keys(EAT).filter(c => pub().some(h => h.city === c));
  const eatKind = k => { const K = window.V2FOOD?.KIND || {}; return (K[k] || K.restaurant || [''])[L()] || ''; };
  const eatName = n => n[lang] || n.def;
  const eatDist = m => (m < 1000 ? m + (lang === 'ka' ? ' მ' : lang === 'ru' ? ' м' : ' m') : (m / 1000).toFixed(1) + (lang === 'ka' ? ' კმ' : lang === 'ru' ? ' км' : ' km'));
  function renderEat() {
    if (!$('#eat')) return;
    const towns = eatTowns(); if (!towns.length) { $('#eat').hidden = true; return; }
    const sel = $('#search')?.city.value;
    if (!eatTown || !towns.includes(eatTown)) eatTown = towns.includes(sel) ? sel : towns[0];
    $('#eatTowns').innerHTML = towns.map(c => `<button type="button" data-eat="${esc(c)}" aria-pressed="${c === eatTown}">${esc(town(c).replace(/\s*\(.*\)\s*$/, ''))}</button>`).join('');
    const list = eatData[eatTown];
    $('#eatList').innerHTML = !eatSeen ? '' : list === undefined ? `<li class="eat-msg">${t('eatWait')}</li>` : !list.length ? `<li class="eat-msg">${t('eatNone')}</li>`
      : list.slice(0, 8).map(x => `<li><a class="eat-item" href="https://www.google.com/maps/search/?api=1&query=${x.lat},${x.lng}" target="_blank" rel="noopener"><b>${esc(eatName(x.name))}</b><span>${esc(eatKind(x.kind))} · ${esc(t('eatCenter', { m: eatDist(x.m) }))}</span></a></li>`).join('');
  }
  async function loadEat(c) {
    if (eatData[c] || !window.V2OSM) return;
    const key = 'v2-eat-' + c;
    try { const x = JSON.parse(localStorage.getItem(key) || 'null'); if (x && Date.now() - x.t < 7 * 864e5) { eatData[c] = x.places; renderEat(); return; } } catch (e) { /* ask */ }
    renderEat();
    try { eatData[c] = await window.V2OSM.places(EAT[c][0], EAT[c][1]); } catch (e) { eatData[c] = []; renderEat(); delete eatData[c]; return; }
    if (eatData[c].length) try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), places: eatData[c] })); } catch (e) { /* full */ }
    renderEat();
  }
  if ($('#eat')) {
    renderEat();
    $('#eatTowns').addEventListener('click', e => { const b = e.target.closest('[data-eat]'); if (!b) return; eatTown = b.dataset.eat; renderEat(); if (eatSeen) loadEat(eatTown); });
    const go = () => { if (eatSeen) return; eatSeen = true; renderEat(); loadEat(eatTown); };
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); go(); } }, { rootMargin: '300px' }); io.observe($('#eat')); } else go();
  }
  if ($('#search')) {
    const f = $('#search');
    fillTowns();
    $('#cities').innerHTML = popular().map(c => `<button type="button" data-city="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('');
    f.from.min = today(); f.to.min = addDays(today(), 1);
    f.addEventListener('change', e => {
      if (e.target === f.from && f.from.value && (!f.to.value || f.to.value <= f.from.value)) f.to.value = addDays(f.from.value, 2);
      if (f.from.value) f.to.min = addDays(f.from.value, 1);
      search();
    });
    f.addEventListener('submit', e => { e.preventDefault(); search(); $('#results').scrollIntoView({ behavior: 'smooth' }); });
    $('#cities').addEventListener('click', e => { const b = e.target.closest('[data-city]'); if (!b) return; f.city.value = f.city.value === b.dataset.city ? '' : b.dataset.city; search(); });
    renderRadius();
    $('#mapBtn').addEventListener('click', () => {
      const box = $('#mapBox'), open = box.hidden; box.hidden = !open; $('#mapBtn').setAttribute('aria-expanded', String(open));
      if (open) { initMap(); setTimeout(() => map && map.invalidateSize(), 50); } else setCenter(null, false);
    });
    $('#radius').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; radius = +b.dataset.r; renderRadius(); setCenter(mapCenter); });
    $('#mapClear').addEventListener('click', () => { setCenter(null, false); map && map.setView([42.1, 43.6], 7); });
    $('#nearMe').addEventListener('click', () => {
      if (!navigator.geolocation) return;
      $('#mapHint').textContent = t('locating');
      navigator.geolocation.getCurrentPosition(p => setCenter({ lat: p.coords.latitude, lng: p.coords.longitude }), () => { $('#mapHint').textContent = t('noLoc'); }, { timeout: 10000 });
    });
    $('#kinds').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (!b) return; curKind = curKind === b.dataset.kind ? '' : b.dataset.kind; search(); });
    $('#townDots').addEventListener('click', e => { const b = e.target.closest('[data-hero]'); if (b) heroShow(+b.dataset.hero, true); });
    // swipe the photo left or right on a phone
    let sx = null;
    $('.hero').addEventListener('touchstart', e => { sx = e.target.closest('#search') ? null : e.touches[0].clientX; }, { passive: true });
    $('.hero').addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 50) heroShow(heroAt + (dx < 0 ? 1 : -1), true); });
    // an empty date field shows a hint instead of a blank box (iPhone shows nothing)
    const dateHint = () => f.querySelectorAll('.s-date').forEach(l => { l.dataset.ph = t('addDate'); l.classList.toggle('empty', !l.querySelector('input').value); });
    f.addEventListener('input', dateHint); f.addEventListener('change', dateHint); dateHint();
    addEventListener('resize', () => heroFit());
    document.fonts && document.fonts.ready.then(() => heroFit());
    $('#townName').addEventListener('click', e => { f.city.value = e.currentTarget.dataset.city; curKind = ''; search(); $('#results').scrollIntoView({ behavior: 'smooth' }); });
    $('#dest').addEventListener('click', e => { const b = e.target.closest('[data-dest]'); if (!b) return; f.city.value = b.dataset.dest; curKind = ''; search(); $('#results').scrollIntoView({ behavior: 'smooth' }); });
  }

  // ---------- owners: templates and sign-up ----------
  // Template ids are colour names. "good" says who it suits best; the choice stays with the owner.
  const TPL = [
    ['opal', 'mta', ['Opal', 'Opal', 'Opal'], ['განსაკუთრებით კარგია მთის სახლისთვის', 'Especially good for a mountain house', 'Особенно подходит для горного дома'], ['ზამთრისა და ზაფხულის ფასები ერთი შეხებით.', 'Winter and summer prices one tap apart.', 'Цены зимы и лета в одно касание.']],
    ['onyx', 'kotejebi', ['Onyx', 'Onyx', 'Onyx'], ['განსაკუთრებით კარგია კოტეჯებისთვის', 'Especially good for cottages', 'Особенно подходит для коттеджей'], ['ჯერ თავად ადგილი: რა გაქვს და როგორ გამოიყურება.', 'The place first: what you have and how it looks.', 'Сначала само место: что есть и как выглядит.']],
    ['jade', 'nino', ['Jade', 'Jade', 'Jade'], ['განსაკუთრებით კარგია საოჯახო სასტუმროსთვის', 'Especially good for a family guesthouse', 'Особенно подходит для семейного гостевого дома'], ['მასპინძლის ისტორია და რა შედის ფასში.', 'The host\'s story and what is included.', 'История хозяина и что входит в цену.']],
    ['amber', 'qvevri', ['Amber', 'Amber', 'Amber'], ['განსაკუთრებით კარგია ჰოსტელისთვის და ოჯახებისთვის', 'Especially good for hostels and families', 'Особенно подходит для хостелов и семей'], ['ნომრები და ფასები გვერდიგვერდ, შესადარებლად.', 'Rooms and prices side by side.', 'Номера и цены рядом, для сравнения.']],
    ['indigo', 'alpine', ['Indigo', 'Indigo', 'Indigo'], ['განსაკუთრებით კარგია ბუტიკ სასტუმროსთვის', 'Especially good for a boutique hotel', 'Особенно подходит для бутик-отеля'], ['ნომრების შედარება და დიდი გალერეა.', 'Room comparison and a big gallery.', 'Сравнение номеров и большая галерея.']],
    ['ivory', 'terasa', ['Ivory', 'Ivory', 'Ivory'], ['განსაკუთრებით კარგია ძველი უბნის სახლისთვის', 'Especially good for an old-town house', 'Особенно подходит для дома в старом городе'], ['ისტორია, ნომრები და ფოტოები მშვიდ რიტმში.', 'Story, rooms and photos at a calm pace.', 'История, номера и фото в спокойном ритме.']],
    ['cobalt', 'zghva', ['Cobalt', 'Cobalt', 'Cobalt'], ['განსაკუთრებით კარგია ზღვისპირა სახლისთვის', 'Especially good for a seaside house', 'Особенно подходит для дома у моря'], ['მოკლე ფაქტები და ნომრები თავიდანვე.', 'Quick facts and rooms right away.', 'Короткие факты и номера сразу.']],
    ['lilac', 'alazani', ['Lilac', 'Lilac', 'Lilac'], ['განსაკუთრებით კარგია მარნიანი სასტუმროსთვის', 'Especially good for a guesthouse with a wine cellar', 'Особенно подходит для гостевого дома с марани'], ['ისტორია და ფოტოები წინ, მერე ნომრები.', 'Story and photos first, then rooms.', 'Сначала история и фото, потом номера.']],
    ['umber', 'dzveli', ['Umber', 'Umber', 'Umber'], ['განსაკუთრებით კარგია ბინებისთვის', 'Especially good for apartments', 'Особенно подходит для квартир'], ['მისამართი და რუკა თავიდანვე, მერე ბინები.', 'Address and map first, then the flats.', 'Сначала адрес и карта, потом квартиры.']],
    ['alba', 'gudauri', ['Alba', 'Alba', 'Alba'], ['განსაკუთრებით კარგია დიზაინერული სახლისთვის', 'Especially good for a design house', 'Особенно подходит для дизайнерского дома'], ['მხოლოდ მთავარი: ტექსტი, ნომრები, ჯავშანი.', 'Only what matters: text, rooms, booking.', 'Только главное: текст, номера, бронь.']],
  ];
  const COLORS = ['#0E857D', '#3F7A4E', '#1F7FB0', '#2F5A8A', '#B4472F', '#E2563B', '#7A2638', '#8A5A2B', '#6B4A8A', '#1F1A17'];
  // On Cloudflare the form creates a real hotel on the server; the GitHub preview keeps it in this browser.
  const SERVER = !/github\.io$/.test(location.hostname) && !['8765', '8798', '8799'].includes(location.port);
  const showDone = (h, links) => {
    $('#doneTitle').textContent = t('ready', { n: h.name });
    if (links) { $('#doneSite').href = links.site; $('#doneAdmin').href = links.admin; $('#done').querySelector('[data-t="doneP"]').textContent = t('loginHint'); }
    else { $('#doneSite').href = 'hotel.html?h=my' + (BUILD ? '&v=' + BUILD : ''); $('#doneAdmin').href = 'admin.html?h=my' + (BUILD ? '&v=' + BUILD : ''); }
    $('#done').classList.add('show');
  };
  function renderOwners() {
    if (!$('#ownerForm')) return;
    const cur = $('#ownerForm').theme?.value || 'opal', curC = $('#ownerForm').accent?.value || COLORS[0];
    $('#tplList').innerHTML = TPL.map(([id, demo, nm, good, look]) => `<figure class="tpl-item"><img src="img/templates/${id}.jpg" alt="${esc(nm[L()])}" loading="lazy"><figcaption><b>${esc(nm[L()])}</b><p class="tpl-good">${esc(good[L()])}</p><p>${esc(look[L()])}</p><a href="hotel.html?h=${demo}&theme=${id}&sample=1${BUILD ? '&v=' + BUILD : ''}">${t('sample')}</a></figcaption></figure>`).join('');
    $('#tplChoice').innerHTML = TPL.map(([id, , nm]) => `<label><input type="radio" name="theme" value="${id}"${id === cur ? ' checked' : ''}><span class="opt">${esc(nm[L()])}</span></label>`).join('');
    if ($('#colChoice')) $('#colChoice').innerHTML = COLORS.map(c => `<label><input type="radio" name="accent" value="${c}"${c === curC ? ' checked' : ''} aria-label="${t('fCol')} ${c}"><span class="opt dot" style="--c:${c}"></span></label>`).join('');
    if ($('#pwRow')) $('#pwRow').hidden = !SERVER;
    const mine = !SERVER && D.mine(); if (mine) showDone(mine);
  }
  if ($('#ownerForm')) {
    const dl = document.createElement('datalist'); dl.id = 'towns';
    dl.innerHTML = PLACES.map(p => p[0]).sort((a, b) => a.localeCompare(b, 'ka')).map(c => `<option value="${esc(c)}">`).join('');
    document.body.appendChild(dl); $('#ownerForm').city.setAttribute('list', 'towns');
    $('#ownerForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target, name = f.name.value.trim(), city = f.city.value.trim(), msg = $('#formMsg');
      if (name.length < 2 || city.length < 2) { msg.textContent = t('needNC'); (name.length < 2 ? f.name : f.city).focus(); return; }
      if (!f.agree.checked) { msg.textContent = t('needAgree'); f.agree.focus(); return; }
      if (SERVER) {
        const email = f.email.value.trim(), password = f.password.value;
        if (!email || password.length < 8) { msg.textContent = t('needEP'); (email ? f.password : f.email).focus(); return; }
        const btn = f.querySelector('button[type=submit]'); btn.disabled = true; msg.textContent = t('sending');
        fetch('api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, city, email, password, theme: f.theme.value, agree: true }) })
          .then(r => r.json()).then(o => {
            if (!o.ok) { msg.textContent = o.msg || t('netErr'); if (o.field && f[o.field]) f[o.field].focus(); return; }
            msg.textContent = ''; f.hidden = true; showDone({ name }, o); $('#done').scrollIntoView({ behavior: 'smooth', block: 'center' });
          }).catch(() => { msg.textContent = t('netErr'); }).finally(() => { btn.disabled = false; });
        return;
      }
      const h = D.saveMine({ name, city, theme: f.theme.value, accent: f.accent.value, email: f.email.value.trim() });
      msg.textContent = ''; showDone(h); $('#done').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function render() { search(); renderOwners(); }
  applyLang(); render();
})();
