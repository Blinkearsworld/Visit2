/* Visit2.ge's own chatbot (scripted, no AI), in three languages.
   On the guests' page (<body data-chat="guests">) it finds a hotel by town, dates and guests and answers how booking works.
   On the owners' page (data-chat="owners") it explains prices and how to start, and takes a phone number for a call back. */
(() => {
  const mode = document.body.dataset.chat || 'guests', F = window.V2FIND, LG = window.V2LANG;
  const lang = () => (LG ? LG.lang : 'ka'), L = () => ['ka', 'en', 'ru'].indexOf(lang());
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const M = {
    open: ['კითხვა გაქვს?', 'Questions?', 'Есть вопрос?'], title: ['Visit2.ge ასისტენტი', 'Visit2.ge assistant', 'Ассистент Visit2.ge'], close: ['დახურვა', 'Close', 'Закрыть'],
    send: ['გაგზავნა', 'Send', 'Отправить'], typeHere: ['ჩაწერე აქ', 'Type here', 'Напишите здесь'], back: ['↩ თავიდან', '↩ Start over', '↩ Сначала'],
    // guests
    gHi: ['გამარჯობა! Visit2.ge-ს ასისტენტი ვარ. სასტუმროს მოძებნაში დაგეხმარები. თუ სასტუმრო უკვე იცი, მისი სახელი ჩაწერე.', 'Hi! I am the Visit2.ge assistant. I can help you find a place to stay. If you already know the hotel, type its name.', 'Здравствуйте! Я ассистент Visit2.ge. Помогу найти жильё. Если вы уже знаете отель, напишите его название.'],
    gFind: ['🔎 სასტუმროს პოვნა', '🔎 Find a hotel', '🔎 Найти отель'], gHow: ['როგორ ვჯავშნი?', 'How do I book?', 'Как забронировать?'],
    gPay: ['როგორ ვიხდი?', 'How do I pay?', 'Как оплатить?'], gOwner: ['სასტუმრო მაქვს', 'I own a hotel', 'У меня отель'],
    gWhere: ['სად გინდა დასვენება?', 'Where would you like to stay?', 'Где хотите остановиться?'], gAny: ['სულ ერთია', 'Anywhere', 'Неважно'],
    gNoTown: ['ეს ადგილი ვერ ვიპოვე. აირჩიე ღილაკით ან სხვანაირად ჩაწერე.', 'I could not find that place. Pick a button or try another spelling.', 'Не нашёл такое место. Выберите кнопку или напишите иначе.'],
    gWhere2: ['ან ჩაწერე ქალაქის ან სასტუმროს სახელი', 'or type a town or a hotel name', 'или напишите город или название отеля'],
    gNoTownHotel: ['ასეთი ადგილი ან სასტუმრო ვერ ვიპოვე. აირჩიე ღილაკით ან სხვანაირად ჩაწერე.', 'I could not find that place or hotel. Pick a button or try another spelling.', 'Не нашёл такое место или отель. Выберите кнопку или напишите иначе.'],
    gHotelIs: ['ვიპოვე: {h}, {c}.', 'Found it: {h}, {c}.', 'Нашёл: {h}, {c}.'],
    gWhichHotel: ['რომელი სასტუმრო?', 'Which hotel?', 'Какой отель?'],
    gOpenHotel: ['სასტუმროს გვერდი', 'Hotel page', 'Страница отеля'],
    gHotelBusy: ['{h}: ამ თარიღებზე თავისუფალი ნომერი არ ჩანს. სცადე სხვა თარიღი ან ნახე სასტუმროს გვერდი.', '{h}: no free room on these dates. Try other dates or see the hotel page.', '{h}: на эти даты свободных номеров нет. Попробуйте другие даты или страницу отеля.'],
    gWhen: ['როდის?', 'When?', 'Когда?'], gThisWk: ['ამ შაბათ-კვირას', 'This weekend', 'В эти выходные'], gNextWk: ['შემდეგ შაბათ-კვირას', 'Next weekend', 'В следующие выходные'],
    gOther: ['სხვა თარიღი', 'Other dates', 'Другие даты'], gAskDates: ['აირჩიე შესვლის და გასვლის დღე', 'Pick the arrival and departure day', 'Выберите дни заезда и выезда'],
    gBookIt: ['დაჯავშნა ამ ფასით', 'Book at this price', 'Забронировать по этой цене'], gSeeHotel: ['სასტუმროს ნახვა', 'See the hotel', 'Посмотреть отель'],
    gIn: ['შესვლა', 'Arrival', 'Заезд'], gOut: ['გასვლა', 'Departure', 'Выезд'], gGo: ['გაგრძელება', 'Continue', 'Продолжить'],
    gPickOut: ['ახლა აირჩიე გასვლის დღე', 'Now pick the departure day', 'Теперь выберите день выезда'],
    gBadDates: ['ვერ გავიგე. ჩაწერე ასე: 15.01–18.01', 'I did not get that. Type like: 15.01–18.01', 'Не понял. Напишите так: 15.01–18.01'],
    gWho: ['რამდენი ზრდასრული? (13 წლიდან)', 'How many adults? (13 and over)', 'Сколько взрослых? (от 13 лет)'],
    gKids: ['ბავშვები (2–12 წლის)?', 'Children (2–12)?', 'Дети (2–12 лет)?'], gNoKids: ['ბავშვის გარეშე', 'No children', 'Без детей'],
    gBabies: ['ჩვილები (2 წლამდე)? ისინი უფასოა.', 'Infants (under 2)? They stay free.', 'Младенцы (до 2 лет)? Они бесплатно.'], gNoBabies: ['ჩვილის გარეშე', 'No infants', 'Без младенцев'],
    gRooms: ['რამდენი ნომერი გჭირდებათ?', 'How many rooms do you need?', 'Сколько номеров нужно?'], gRoomsN: ['{n} ნომერი', '{n} rooms', 'номеров: {n}'], gOneRoom: ['1 ნომერი', '1 room', '1 номер'],
    gLooking: ['ვეძებ…', 'Looking…', 'Ищу…'],
    gNoHere: ['{p}-ში ამ თარიღებზე თავისუფალი ვერ ვიპოვე. ახლოს არის:', 'Nothing free in {p} on these dates. Close by:', 'В {p} на эти даты свободного нет. Рядом:'],
    gKm: ['{k} კმ', '{k} km', '{k} км'], gAllRooms: ['{n}-ვე ნომერი', 'all {n} rooms', 'за {n} номера'],
    gFound: ['{d}, {g} სტუმარი. აი, რა არის თავისუფალი:', '{d}, {g} guests. Here is what is free:', '{d}, {g} гост. Вот что свободно:'],
    gNone: ['ამ თარიღებზე თავისუფალი არ ვიპოვე. სცადე სხვა თარიღი ან სხვა ადგილი.', 'Nothing free on these dates. Try other dates or another place.', 'На эти даты ничего нет. Попробуйте другие даты или место.'],
    gAll: ['ყველას ნახვა სიაში', 'See all in the list', 'Все в списке'], gNights: ['ღამე', 'nights', 'ноч.'],
    gHowA: ['აირჩიე სასტუმრო და თარიღები, ჩაწერე სახელი და ტელეფონი და გააგზავნე მოთხოვნა. სასტუმრო დაგირეკავს და ჯავშანს დაგიდასტურებს. ჩვენ შუამავლები არ ვართ: მოთხოვნა პირდაპირ სასტუმროს ეგზავნება.', 'Choose a hotel and dates, enter your name and phone and send a request. The hotel calls you to confirm. We are not a middleman: the request goes straight to the hotel.', 'Выберите отель и даты, укажите имя и телефон и отправьте запрос. Отель перезвонит и подтвердит бронь. Мы не посредники: запрос уходит прямо в отель.'],
    gPayA: ['სასტუმროს პირდაპირ უხდი. Visit2.ge ბარათს არ გთხოვს და ფულს არ იღებს.\n\n✓ მყისიერი ჯავშანი: გადახდისა და გაუქმების პირობები დაჯავშნამდე, ჯავშნის გვერდზე წერია.\n\n✉️ მოთხოვნა: სასტუმრო დაგიკავშირდება, ნომერს დაგიდასტურებს და გეტყვის, როგორ გადაიხდი (ადგილზე, გადარიცხვით თუ წინასწარ).', 'You pay the hotel directly. Visit2.ge never asks for a card or takes money.\n\n✓ Instant booking: payment and cancellation terms are shown on the booking page before you book.\n\n✉️ Request: the hotel contacts you, confirms the room and tells you how to pay (on arrival, by transfer or a deposit).', 'Вы платите отелю напрямую. Visit2.ge не просит карту и не берёт деньги.\n\n✓ Мгновенное бронирование: условия оплаты и отмены указаны на странице бронирования до оформления.\n\n✉️ Запрос: отель свяжется с вами, подтвердит номер и скажет, как платить (на месте, переводом или предоплата).'],
    gOwnerA: ['მშვენიერია! მფლობელების გვერდზე ნახავ შაბლონებს და ფასებს, და საიტს იქვე შექმნი.', 'Great! The owners’ page shows templates and prices, and you can create your site there.', 'Отлично! На странице для владельцев — шаблоны, цены и создание сайта.'],
    gToOwners: ['მფლობელების გვერდი', 'Owners’ page', 'Для владельцев'],
    // owners
    oHi: ['გამარჯობა! მოგიყვები, როგორ მუშაობს Visit2.ge სასტუმროებისთვის. რა გაინტერესებს?', 'Hi! I will tell you how Visit2.ge works for hotels. What would you like to know?', 'Здравствуйте! Расскажу, как Visit2.ge работает для отелей. Что вас интересует?'],
    oPrice: ['რა ღირს?', 'How much?', 'Сколько стоит?'], oGet: ['რას ვიღებ?', 'What do I get?', 'Что я получаю?'], oStart: ['როგორ დავიწყო?', 'How do I start?', 'Как начать?'],
    oBooking: ['Booking-ზეც ვარ', 'I am on Booking too', 'Я есть на Booking'], oMoney: ['სტუმრის ფული', 'Guest payments', 'Оплата гостей'], oCall: ['📞 დამირეკეთ', '📞 Call me', '📞 Позвоните мне'],
    oPriceA: ['სისტემა (საიტი, ადმინი, ჩატბოტი): 50₾ თვეში, პირველი 30 დღე უფასოდ და ბარათის გარეშე. კატალოგში ადგილი: +20₾ თვეში, პირველი 6 თვე უფასოდ. თუ საკუთარი საიტი უკვე გაქვს, მხოლოდ კატალოგი 70₾ თვეში (მალე). რეკლამაც მალე ჩაირთვება: სასტუმრო ძებნაში სიის თავში გამოჩნდება. სეზონური პაუზა: 10₾ თვეში. პროცენტს ჯავშნებიდან არ ვიღებთ.', 'The system (site, admin, chatbot): 50₾ a month, first 30 days free, no card. Catalogue listing: +20₾ a month, first 6 months free. Already have your own website? Catalogue only will be 70₾ a month (soon). Promotion to the top of search is also coming soon. Seasonal pause: 10₾ a month. We take no percentage of bookings.', 'Система (сайт, админка, чат-бот): 50₾ в месяц, первые 30 дней бесплатно, без карты. Каталог: +20₾ в месяц, первые 6 месяцев бесплатно. Если у вас уже есть сайт, только каталог — 70₾ в месяц (скоро). Скоро появится и реклама: отель будет первым в поиске. Сезонная пауза: 10₾ в месяц. Процент с броней не берём.'],
    oGetA: ['შენი საიტი ხუთი შაბლონიდან ერთ-ერთით, სამ ენაზე; ადმინი ჯავშნებით, კალენდარით, ფასებით, გადახდებით და გუნდით; ჩატბოტი, რომელიც სტუმარს თავისუფალ ნომერს და ფასს ეუბნება; და ადგილი Visit2.ge-ს ძებნაში.', 'Your own site from one of five templates, in three languages; an admin with bookings, calendar, prices, payments and team; a chatbot that tells guests what is free and the price; and a place in Visit2.ge search.', 'Свой сайт на одном из пяти шаблонов, на трёх языках; админка с бронями, календарём, ценами, оплатами и командой; чат-бот, который сообщает гостям свободные номера и цену; и место в поиске Visit2.ge.'],
    oStartA: ['აირჩიე შაბლონი და ფერი, ჩაწერე სასტუმროს სახელი და ქალაქი, და საიტი მზადაა. მერე ადმინში ნომრებს, ფასებს და ფოტოებს ჩაამატებ. თუ გინდა, ყველაფერს ჩვენ გავაკეთებთ 300₾-ად.', 'Pick a template and colour, type the hotel name and town, and the site is ready. Then add rooms, prices and photos in the admin. Or we can do it all for 300₾.', 'Выберите шаблон и цвет, укажите название и город, и сайт готов. Затем добавьте номера, цены и фото в админке. Или мы всё сделаем за 300₾.'],
    oBookingA: ['კარგია, Booking-ს არ ვცვლით. Visit2.ge გაძლევს საკუთარ არხს, სადაც საკომისიოს არ იხდი. Booking-ისა და Airbnb-ის კალენდრის სინქრონიზაცია მალე დაემატება, რომ ერთი ნომერი ორჯერ არ გაიყიდოს.', 'Fine, we do not replace Booking. Visit2.ge gives you your own channel with no commission. Calendar sync with Booking and Airbnb is coming, so a room is never sold twice.', 'Хорошо, Booking мы не заменяем. Visit2.ge — ваш собственный канал без комиссии. Синхронизация календаря с Booking и Airbnb скоро появится, чтобы номер не продавался дважды.'],
    oMoneyA: ['სტუმრის ფული ჩვენთან არ გაივლის: სტუმარი პირდაპირ შენ გიხდის. თუ წინასწარ გადახდა გინდა, ადმინში შენს საბანკო ანგარიშს ან BOG/TBC-ის გადახდის ბმულს ჩაწერ.', 'Guest money never passes through us: guests pay you directly. If you want a deposit, put your bank account or a BOG/TBC payment link in the admin.', 'Деньги гостей не проходят через нас: гости платят вам напрямую. Для предоплаты укажите в админке счёт или ссылку оплаты BOG/TBC.'],
    oCallName: ['როგორ მოგმართო?', 'What is your name?', 'Как к вам обращаться?'], oCallPhone: ['ტელეფონის ნომერი?', 'Your phone number?', 'Ваш номер телефона?'],
    oCallBad: ['ნომერი სრულად ჩაწერე, მაგ.: 599 12 34 56', 'Please type the full number, e.g. 599 12 34 56', 'Укажите номер полностью, например 599 12 34 56'],
    oCallDone: ['მადლობა, {n}! დაგირეკავთ სამუშაო საათებში.', 'Thank you, {n}! We will call you in working hours.', 'Спасибо, {n}! Позвоним в рабочее время.'],
    oCreate: ['საიტის შექმნა', 'Create my site', 'Создать сайт'],
  };
  const m = (k, v = {}) => String(M[k][L()] ?? M[k][0]).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');

  // ---------- widget ----------
  const css = `.vc-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:60;display:flex;align-items:center;gap:8px;min-height:52px;padding:0 20px;border:0;border-radius:999px;background:#0E857D;color:#fff;font:700 16px/1 "Noto Sans Georgian",system-ui,sans-serif;box-shadow:0 10px 28px rgba(14,133,125,.35);cursor:pointer}
.vc-fab:hover{background:#0B7A73}@media(max-width:640px){.vc-fab{width:58px;height:58px;min-height:0;padding:0;justify-content:center;font-size:0}.vc-fab::before{content:'💬';font-size:26px}}.vc{position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:61;display:flex;flex-direction:column;width:min(380px,calc(100vw - 24px));height:min(600px,calc(100vh - 32px));background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(31,26,23,.28);font:400 15px/1.5 "Noto Sans Georgian",system-ui,sans-serif;color:#1F1A17;overflow:hidden}
.vc[hidden],.vc-fab[hidden]{display:none}.vc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;background:#0E857D;color:#fff}.vc-head b{font-size:16px}
.vc-x{background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:4px 8px}.vc-log{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#FFF8EE}
.vc-m{max-width:88%;padding:9px 12px;border-radius:14px;background:#fff;box-shadow:0 1px 0 #eadfce;white-space:pre-line}.vc-m.me{align-self:flex-end;background:#0E857D;color:#fff}
.vc-m a{color:#0B7A73;font-weight:700}.vc-hot{display:block;margin-top:8px;padding:10px 12px;border:1px solid #eadfce;border-radius:12px;background:#fff;color:#1F1A17}.vc-hot b{display:block}.vc-hot-p{display:block;margin-top:2px;font-weight:700;color:#0B7A73}.vc-hot-b{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.vc-m .vc-hot-b a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-radius:10px;border:1.5px solid #0E857D;color:#0B7A73;text-decoration:none;font-weight:700;font-size:14px}.vc-m .vc-hot-b a.go{background:#0B7A73;border-color:#0B7A73;color:#fff}
.vc-cal{align-self:stretch;background:#fff;border:1px solid #eadfce;border-radius:14px;padding:10px}.vc-cal-h{display:flex;align-items:center;justify-content:space-between;margin:0 0 6px}.vc-cal-h b{font-size:15px}.vc-cal-h button{width:44px;height:40px;border:0;border-radius:10px;background:#F0F8F6;color:#0B7A73;font-size:20px;cursor:pointer}.vc-cal-h button:disabled{opacity:.3;cursor:default}.vc-cal-g{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center}.vc-cal-g i{font-style:normal;font-size:12px;color:#8a7f76;padding:4px 0}.vc-cal-g button{height:40px;border:0;border-radius:10px;background:none;font:inherit;font-size:15px;color:#1F1A17;cursor:pointer}.vc-cal-g button:disabled{color:#cfc5b8;cursor:default}.vc-cal-g button.mid{background:#E3F2EF}.vc-cal-g button.on{background:#0E857D;color:#fff;font-weight:700}.vc-cal-s{margin:8px 2px;font-size:14px;color:#5f5650;min-height:20px}.vc-cal-go{width:100%;min-height:44px;border:0;border-radius:12px;background:#0B7A73;color:#fff;font:inherit;font-weight:700;cursor:pointer}.vc-cal-go:disabled{opacity:.4;cursor:default}
.vc-opts{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;border-top:1px solid #f0e6d8}.vc-opts button,.vc-opts a{min-height:44px;padding:0 16px;border:1.5px solid #0E857D;border-radius:999px;background:#fff;color:#0B7A73;font-family:inherit;font-size:15px;font-weight:600;line-height:1.2;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.vc-in{display:flex;gap:6px;padding:10px 12px;border-top:1px solid #f0e6d8}.vc-in input{flex:1;min-height:42px;padding:0 12px;border:1px solid #eadfce;border-radius:10px;font-family:inherit;font-size:16px;font-weight:500}.vc-in button{min-height:42px;padding:0 14px;border:0;border-radius:10px;background:#0E857D;color:#fff;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer}`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
  document.body.insertAdjacentHTML('beforeend', `<button type="button" class="vc-fab" id="vcFab"></button>
<section class="vc" id="vc" hidden role="dialog" aria-modal="false"><div class="vc-head"><b id="vcTitle"></b><button type="button" class="vc-x" id="vcX">×</button></div>
<div class="vc-log" id="vcLog" aria-live="polite"></div><div class="vc-opts" id="vcOpts"></div>
<form class="vc-in" id="vcIn"><input id="vcText" autocomplete="off"><button id="vcSend"></button></form></section>`);
  const $ = id => document.getElementById(id), log = $('vcLog'), opts = $('vcOpts');
  let onText = null, started = false;
  const labels = () => {
    $('vcFab').textContent = '💬 ' + m('open'); $('vcFab').setAttribute('aria-label', m('open')); $('vcTitle').textContent = m('title'); $('vcX').setAttribute('aria-label', m('close'));
    $('vcText').placeholder = m('typeHere'); $('vcSend').textContent = m('send'); $('vc').setAttribute('aria-label', m('title'));
  };
  const say = (html, me) => { const d = document.createElement('div'); d.className = 'vc-m' + (me ? ' me' : ''); d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
  // a long answer (hotels found): scroll so its beginning is in view
  const sayTop = html => { const d = say(html); requestAnimationFrame(() => { log.scrollTop += d.getBoundingClientRect().top - log.getBoundingClientRect().top - 8; }); return d; };
  const choose = list => {
    opts.innerHTML = '';
    for (const o of list) {
      const b = document.createElement(o.href ? 'a' : 'button');
      if (o.href) b.href = o.href; else b.type = 'button';
      b.textContent = o.t;
      if (!o.href) b.addEventListener('click', () => { say(esc(o.t), true); onText = null; o.f(); });
      opts.appendChild(b);
    }
  };
  const ask = (q, handler) => { say(esc(q)); onText = handler; $('vcText').focus(); };
  $('vcIn').addEventListener('submit', e => {
    e.preventDefault(); const v = $('vcText').value.trim(); if (!v) return;
    $('vcText').value = ''; say(esc(v), true);
    if (onText) onText(v); else if (mode === 'owners') start(); else typed(v);
  });
  const openChat = () => { $('vc').hidden = false; $('vcFab').hidden = true; if (!started) { started = true; start(); } };
  $('vcFab').addEventListener('click', openChat);
  $('vcX').addEventListener('click', () => { $('vc').hidden = true; $('vcFab').hidden = false; $('vcFab').focus(); });

  // ---------- guests ----------
  // a hotel by (part of) its name, in any of its languages; the server's catalogue is asked once
  const norm = x => String(x || '').toLowerCase().replace(/[„“"'«»]/g, '').replace(/\s+/g, ' ').trim();
  async function hotelsNamed(v) {
    const k = norm(v); if (k.length < 3) return [];
    try { await F.loadReal({}); } catch (e) { /* the samples still answer */ }
    return F.pub().filter(h => !h.hidden && !h.mine && [h.name, ...Object.values(h.nameT || {})].some(n => norm(n).includes(k)));
  }
  function pickHotel(list) {
    if (list.length === 1) return hotelChosen(list[0]);
    say(esc(m('gWhichHotel')));
    choose([...list.slice(0, 6).map(h => ({ t: `${F.hname(h)} · ${F.town(h.city)}`, f: () => hotelChosen(h) })), { t: m('back'), f: start }]);
  }
  function hotelChosen(h) {
    q.hotel = h; q.city = '';
    say(esc(m('gHotelIs', { h: F.hname(h), c: F.town(h.city) })));
    gWhen();
  }
  // typed text: a hotel's name first, then a town
  async function typed(v) {
    const hs = await hotelsNamed(v);
    if (hs.length) { onText = null; return pickHotel(hs); }
    const k = norm(v), hit = F.allTowns().find(c => [c, F.town(c)].some(n => norm(n).startsWith(k) || norm(n).includes(k)));
    if (!hit) { ask(m('gNoTownHotel'), typed); return; }
    say(esc(F.town(hit))); q.city = hit; q.hotel = null; onText = null; gWhen();
  }
  const q = { city: '', from: '', to: '', g: 2, kids: 0, babies: 0, rooms: 1 };
  const weekend = k => { const t0 = F.today(), d = new Date(t0 + 'T00:00:00Z'), add = (6 - d.getUTCDay() + 7) % 7 + 7 * k; const fri = F.addDays(t0, Math.max(0, add - 1)); return [fri, F.addDays(fri, 2)]; };
  function gStart() {
    say(esc(m('gHi')));
    choose([{ t: m('gFind'), f: gWhere }, { t: m('gHow'), f: () => { say(esc(m('gHowA'))); gMore(); } }, { t: m('gPay'), f: () => { say(esc(m('gPayA'))); gMore(); } },
      { t: m('gOwner'), f: () => { say(esc(m('gOwnerA'))); choose([{ t: m('gToOwners'), href: 'owners.html' }, { t: m('back'), f: start }]); } }]);
  }
  const gMore = () => choose([{ t: m('gFind'), f: gWhere }, { t: m('back'), f: start }]);
  function gWhere() {
    say(esc(m('gWhere')) + '<br><small>' + esc(m('gWhere2')) + '</small>');
    choose([...F.cities().slice(0, 10).map(c => ({ t: F.town(c), f: () => { q.city = c; q.hotel = null; gWhen(); } })), { t: m('gAny'), f: () => { q.city = ''; q.hotel = null; gWhen(); } }]);
    q.hotel = null; onText = typed;
  }
  function gWhen() {
    say(esc(m('gWhen')));
    choose([{ t: m('gThisWk'), f: () => { [q.from, q.to] = weekend(0); gWho(); } }, { t: m('gNextWk'), f: () => { [q.from, q.to] = weekend(1); gWho(); } },
      { t: m('gOther'), f: pickDates }]);
  }
  // dates by tapping a calendar (typing 15.01–18.01 still works for those who prefer it)
  const MON = { ka: ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'] };
  const WD = { ka: ['ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა', 'კვ'], en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'], ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] };
  const LK = () => ['ka', 'en', 'ru'][L()] || 'ka';
  function pickDates() {
    say(esc(m('gAskDates')));
    const box = document.createElement('div'); box.className = 'vc-cal'; log.appendChild(box);
    const t0 = F.today(); let ym = t0.slice(0, 7), a = '', b = '';
    const p2 = n => String(n).padStart(2, '0');
    const draw = () => {
      const [y, mo] = ym.split('-').map(Number), first = new Date(Date.UTC(y, mo - 1, 1)), days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const lead = (first.getUTCDay() + 6) % 7, cells = [];
      for (let i = 0; i < lead; i++) cells.push('<span></span>');
      for (let d = 1; d <= days; d++) {
        const ds = `${y}-${p2(mo)}-${p2(d)}`, past = ds < t0, on = ds === a || ds === b, mid = a && b && ds > a && ds < b;
        cells.push(`<button type="button" data-d="${ds}"${past ? ' disabled' : ''} class="${on ? 'on' : mid ? 'mid' : ''}">${d}</button>`);
      }
      const prev = ym > t0.slice(0, 7);
      box.innerHTML = `<div class="vc-cal-h"><button type="button" data-nav="-1" aria-label="‹"${prev ? '' : ' disabled'}>‹</button><b>${MON[LK()][mo - 1]} ${y}</b><button type="button" data-nav="1" aria-label="›">›</button></div>
        <div class="vc-cal-g">${WD[LK()].map(x => `<i>${x}</i>`).join('')}${cells.join('')}</div>
        <p class="vc-cal-s">${a ? `${m('gIn')}: <b>${F.fmt(a)}</b>` : ''}${b ? ` · ${m('gOut')}: <b>${F.fmt(b)}</b>` : a ? ` · ${esc(m('gPickOut'))}` : ''}</p>
        <button type="button" class="vc-cal-go"${a && b ? '' : ' disabled'}>${m('gGo')}</button>`;
      log.scrollTop = log.scrollHeight;
    };
    box.addEventListener('click', e => {
      const x = e.target.closest('button'); if (!x || x.disabled) return;
      if (x.dataset.nav) { const [y, mo] = ym.split('-').map(Number), d = new Date(Date.UTC(y, mo - 1 + +x.dataset.nav, 1)); ym = d.toISOString().slice(0, 7); draw(); return; }
      if (x.dataset.d) { const d = x.dataset.d; if (!a || b || d <= a) { a = d; b = ''; } else b = d; draw(); return; }
      if (x.classList.contains('vc-cal-go') && a && b) { box.remove(); say(esc(`${F.fmt(a)} – ${F.fmt(b)}`), true); q.from = a; q.to = b; onText = null; gWho(); }
    });
    draw();
    choose([{ t: m('back'), f: start }]);
    onText = parseDates;
    $('vcText').blur();
  }
  function parseDates(v) {
    const x = v.match(/(\d{1,2})[./](\d{1,2})\D+(\d{1,2})[./](\d{1,2})/);
    if (!x) { ask(m('gBadDates'), parseDates); return; }
    const t0 = F.today(), y = +t0.slice(0, 4), p = n => String(n).padStart(2, '0');
    let a = `${y}-${p(x[2])}-${p(x[1])}`, b = `${y}-${p(x[4])}-${p(x[3])}`;
    if (a < t0) { a = `${y + 1}-${p(x[2])}-${p(x[1])}`; }
    if (b <= a) b = `${+a.slice(0, 4) + (b.slice(5) <= a.slice(5) ? 1 : 0)}-${p(x[4])}-${p(x[3])}`;
    if (isNaN(new Date(a)) || isNaN(new Date(b)) || b <= a) { ask(m('gBadDates'), parseDates); return; }
    q.from = a; q.to = b; onText = null; gWho();
  }
  // who: adults (13+), children (2–12), infants (free), then rooms when there are three or more people
  let adults = 2;
  function gWho() {
    say(esc(m('gWho')));
    choose([1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ t: String(n), f: () => { adults = n; gKids(); } })));
  }
  function gKids() {
    say(esc(m('gKids')));
    choose([{ t: m('gNoKids'), f: () => { q.kids = 0; gBabies(); } }, ...[1, 2, 3, 4, 5].map(n => ({ t: String(n), f: () => { q.kids = n; gBabies(); } }))]);
  }
  function gBabies() {
    say(esc(m('gBabies')));
    choose([{ t: m('gNoBabies'), f: () => { q.babies = 0; gRooms(); } }, ...[1, 2, 3].map(n => ({ t: String(n), f: () => { q.babies = n; gRooms(); } }))]);
  }
  function gRooms() {
    q.g = adults + q.kids; q.rooms = 1;
    if (q.g < 3) return gShow();
    say(esc(m('gRooms')));
    choose(Array.from({ length: Math.min(4, adults) }, (_, i) => i + 1).map(n => ({ t: n === 1 ? m('gOneRoom') : m('gRoomsN', { n }), f: () => { q.rooms = n; gShow(); } })));
  }
  // one free hotel: book at this price (straight to its booking form, everything chosen) or look the hotel over first
  const hotLink = ({ h, o, d }) => `<div class="vc-hot"><b>${esc(F.hname(h))}</b>${esc(F.town(h.city))}${d != null ? ' · ' + m('gKm', { k: d < 10 ? d.toFixed(1) : Math.round(d) }) : ''}<span class="vc-hot-p">${o.best.total} ₾ · ${o.n} ${m('gNights')}${q.rooms > 1 ? ' · ' + m('gAllRooms', { n: q.rooms }) : ''}</span><span class="vc-hot-b"><a class="go" href="${esc(F.link(h, { ...q, book: 1, type: o.best.typeId || '' }))}">${esc(m('gBookIt'))}</a><a href="${esc(F.link(h, q))}">${esc(m('gSeeHotel'))}</a></span></div>`;
  async function gShow() {
    say(esc(m('gLooking'))); choose([]);
    try { await F.loadReal(q); } catch (e) { /* the samples still answer */ }
    const who = `${F.fmt(q.from)} – ${F.fmt(q.to)}`;
    if (q.hotel) {
      const h = q.hotel, r = F.find({ ...q, city: '' }).find(x => x.h === h || (x.h.slug && x.h.slug === h.slug && x.h.real === h.real));
      log.lastChild?.remove();
      if (r && r.o.best) sayTop(esc(m('gFound', { d: who, g: q.g })) + hotLink(r));
      else say(esc(m('gHotelBusy', { h: F.hname(h) })));
      choose([...(r && r.o.best ? [] : [{ t: m('gOpenHotel'), href: F.link(h, q) }]), { t: m('gOther'), f: gWhen }, { t: m('gFind'), f: gWhere }, { t: m('back'), f: start }]);
      return;
    }
    const rows = F.find(q).filter(r => r.o.best).slice(0, 3);
    log.lastChild?.remove();
    if (!rows.length) {
      // nothing in that town: the nearest free places around its centre
      const c = q.city && F.centreOf(q.city);
      const near = c ? F.find({ ...q, city: '', sort: 'near', near: c }).filter(r => r.o.best && r.d != null && r.d <= 80).slice(0, 3) : [];
      if (near.length) { sayTop(esc(m('gNoHere', { p: F.town(q.city) })) + near.map(hotLink).join('')); choose([{ t: m('gOther'), f: gWhen }, { t: m('gFind'), f: gWhere }, { t: m('back'), f: start }]); return; }
      say(esc(m('gNone'))); choose([{ t: m('gOther'), f: gWhen }, { t: m('gFind'), f: gWhere }, { t: m('back'), f: start }]); return;
    }
    sayTop(esc(m('gFound', { d: who, g: q.g })) + rows.map(hotLink).join(''));
    const f = document.getElementById('search'), home = window.V2HOME;
    choose([...(home ? [{ t: m('gAll'), f: () => home.show(q) }] : f ? [{ t: m('gAll'), f: () => {
      f.city.value = q.city; f.from.value = q.from; f.to.value = q.to; f.g.value = String(q.g);
      f.dispatchEvent(new Event('change')); document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
    } }] : []), { t: m('gOther'), f: gWhen }, { t: m('back'), f: start }]);
  }

  // ---------- owners ----------
  function oStart() {
    say(esc(m('oHi')));
    oMenu();
  }
  const answer = k => () => { say(esc(m(k))); oMenu(); };
  const oMenu = () => choose([{ t: m('oPrice'), f: answer('oPriceA') }, { t: m('oGet'), f: answer('oGetA') }, { t: m('oStart'), f: () => { say(esc(m('oStartA'))); choose([{ t: m('oCreate'), href: '#signup' }, { t: m('oCall'), f: oCall }, { t: m('back'), f: start }]); } },
    { t: m('oBooking'), f: answer('oBookingA') }, { t: m('oMoney'), f: answer('oMoneyA') }, { t: m('oCall'), f: oCall }]);
  function oCall() {
    choose([{ t: m('back'), f: start }]);
    ask(m('oCallName'), name => ask(m('oCallPhone'), function phone(v) {
      if (v.replace(/\D/g, '').length < 9) { ask(m('oCallBad'), phone); return; }
      try { const k = 'v2-leads', all = JSON.parse(localStorage.getItem(k) || '[]'); all.push({ name, phone: v, at: new Date().toISOString() }); localStorage.setItem(k, JSON.stringify(all)); } catch (e) {}
      onText = null; say(esc(m('oCallDone', { n: name }))); oMenu();
    }));
  }

  function start() { log.innerHTML = ''; onText = null; (mode === 'owners' ? oStart : gStart)(); }
  labels();
  if (LG) LG.onChange(() => { labels(); if (started) start(); });
})();
