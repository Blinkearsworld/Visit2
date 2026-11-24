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
    gHi: ['გამარჯობა! Visit2.ge-ს ასისტენტი ვარ. სასტუმროს მოძებნაში დაგეხმარები.', 'Hi! I am the Visit2.ge assistant. I can help you find a place to stay.', 'Здравствуйте! Я ассистент Visit2.ge. Помогу найти жильё.'],
    gFind: ['🔎 სასტუმროს პოვნა', '🔎 Find a hotel', '🔎 Найти отель'], gHow: ['როგორ ვჯავშნი?', 'How do I book?', 'Как забронировать?'],
    gPay: ['როგორ ვიხდი?', 'How do I pay?', 'Как оплатить?'], gOwner: ['სასტუმრო მაქვს', 'I own a hotel', 'У меня отель'],
    gWhere: ['სად გინდა დასვენება?', 'Where would you like to stay?', 'Где хотите остановиться?'], gAny: ['სულ ერთია', 'Anywhere', 'Неважно'],
    gNoTown: ['ეს ადგილი ვერ ვიპოვე. აირჩიე ღილაკით ან სხვანაირად ჩაწერე.', 'I could not find that place. Pick a button or try another spelling.', 'Не нашёл такое место. Выберите кнопку или напишите иначе.'],
    gWhere2: ['ან ჩაწერე ქალაქის სახელი', 'or type a town', 'или напишите город'],
    gWhen: ['როდის?', 'When?', 'Когда?'], gThisWk: ['ამ შაბათ-კვირას', 'This weekend', 'В эти выходные'], gNextWk: ['შემდეგ შაბათ-კვირას', 'Next weekend', 'В следующие выходные'],
    gOther: ['სხვა თარიღი', 'Other dates', 'Другие даты'], gAskDates: ['ჩაწერე თარიღები ასე: 15.01–18.01', 'Type the dates like this: 15.01–18.01', 'Напишите даты так: 15.01–18.01'],
    gBadDates: ['ვერ გავიგე. ჩაწერე ასე: 15.01–18.01', 'I did not get that. Type like: 15.01–18.01', 'Не понял. Напишите так: 15.01–18.01'],
    gWho: ['რამდენი სტუმარი იქნებით?', 'How many guests?', 'Сколько гостей?'],
    gFound: ['{d}, {g} სტუმარი. აი, რა არის თავისუფალი:', '{d}, {g} guests. Here is what is free:', '{d}, {g} гост. Вот что свободно:'],
    gNone: ['ამ თარიღებზე თავისუფალი არ ვიპოვე. სცადე სხვა თარიღი ან სხვა ადგილი.', 'Nothing free on these dates. Try other dates or another place.', 'На эти даты ничего нет. Попробуйте другие даты или место.'],
    gAll: ['ყველას ნახვა სიაში', 'See all in the list', 'Все в списке'], gNights: ['ღამე', 'nights', 'ноч.'],
    gHowA: ['აირჩიე სასტუმრო და თარიღები, ჩაწერე სახელი და ტელეფონი და გააგზავნე მოთხოვნა. სასტუმრო დაგირეკავს და ჯავშანს დაგიდასტურებს. ჩვენ შუამავლები არ ვართ: მოთხოვნა პირდაპირ სასტუმროს ეგზავნება.', 'Choose a hotel and dates, enter your name and phone and send a request. The hotel calls you to confirm. We are not a middleman: the request goes straight to the hotel.', 'Выберите отель и даты, укажите имя и телефон и отправьте запрос. Отель перезвонит и подтвердит бронь. Мы не посредники: запрос уходит прямо в отель.'],
    gPayA: ['წინასწარ ბარათს არ გთხოვთ და ფულს ჩვენ არ ვიღებთ. გადახდის პირობებს (ადგილზე, გადარიცხვით ან წინასწარ) სასტუმრო გეტყვის ზარისას.', 'We never take a card or money. The hotel tells you how to pay (on arrival, by transfer or a deposit) when they call.', 'Мы не берём карту и деньги. Условия оплаты (на месте, переводом или предоплата) сообщит отель по телефону.'],
    gOwnerA: ['მშვენიერია! მფლობელების გვერდზე ნახავ შაბლონებს და ფასებს, და საიტს იქვე შექმნი.', 'Great! The owners’ page shows templates and prices, and you can create your site there.', 'Отлично! На странице для владельцев — шаблоны, цены и создание сайта.'],
    gToOwners: ['მფლობელების გვერდი', 'Owners’ page', 'Для владельцев'],
    // owners
    oHi: ['გამარჯობა! მოგიყვები, როგორ მუშაობს Visit2.ge სასტუმროებისთვის. რა გაინტერესებს?', 'Hi! I will tell you how Visit2.ge works for hotels. What would you like to know?', 'Здравствуйте! Расскажу, как Visit2.ge работает для отелей. Что вас интересует?'],
    oPrice: ['რა ღირს?', 'How much?', 'Сколько стоит?'], oGet: ['რას ვიღებ?', 'What do I get?', 'Что я получаю?'], oStart: ['როგორ დავიწყო?', 'How do I start?', 'Как начать?'],
    oBooking: ['Booking-ზეც ვარ', 'I am on Booking too', 'Я есть на Booking'], oMoney: ['სტუმრის ფული', 'Guest payments', 'Оплата гостей'], oCall: ['📞 დამირეკეთ', '📞 Call me', '📞 Позвоните мне'],
    oPriceA: ['სისტემა (საიტი, ადმინი, ჩატბოტი): 50₾ თვეში, პირველი 30 დღე უფასოდ და ბარათის გარეშე. კატალოგში ადგილი: +20₾ თვეში, პირველი 6 თვე უფასოდ. თუ საკუთარი საიტი უკვე გაქვს, მხოლოდ კატალოგი 70₾ თვეში. მეტი ჩვენებისთვის რეკლამას ჩართავ: სასტუმრო ძებნაში სიის თავში გამოჩნდება. სეზონური პაუზა: 10₾ თვეში. პროცენტს ჯავშნებიდან არ ვიღებთ.', 'The system (site, admin, chatbot): 50₾ a month, first 30 days free, no card. Catalogue listing: +20₾ a month, first 6 months free. Already have your own website? Catalogue only is 70₾ a month. For more views you can promote your hotel to the top of search. Seasonal pause: 10₾ a month. We take no percentage of bookings.', 'Система (сайт, админка, чат-бот): 50₾ в месяц, первые 30 дней бесплатно, без карты. Каталог: +20₾ в месяц, первые 6 месяцев бесплатно. Если у вас уже есть сайт, только каталог — 70₾ в месяц. Для большего охвата можно включить рекламу: отель будет первым в поиске. Сезонная пауза: 10₾ в месяц. Процент с броней не берём.'],
    oGetA: ['შენი საიტი ათი შაბლონიდან ერთ-ერთით, სამ ენაზე; ადმინი ჯავშნებით, კალენდარით, ფასებით, გადახდებით და გუნდით; ჩატბოტი, რომელიც სტუმარს თავისუფალ ნომერს და ფასს ეუბნება; და ადგილი Visit2.ge-ს ძებნაში.', 'Your own site from one of ten templates, in three languages; an admin with bookings, calendar, prices, payments and team; a chatbot that tells guests what is free and the price; and a place in Visit2.ge search.', 'Свой сайт на одном из десяти шаблонов, на трёх языках; админка с бронями, календарём, ценами, оплатами и командой; чат-бот, который сообщает гостям свободные номера и цену; и место в поиске Visit2.ge.'],
    oStartA: ['აირჩიე შაბლონი და ფერი, ჩაწერე სასტუმროს სახელი და ქალაქი, და საიტი მზადაა. მერე ადმინში ნომრებს, ფასებს და ფოტოებს ჩაამატებ. თუ გინდა, ყველაფერს ჩვენ გავაკეთებთ 300₾-ად.', 'Pick a template and colour, type the hotel name and town, and the site is ready. Then add rooms, prices and photos in the admin. Or we can do it all for 300₾.', 'Выберите шаблон и цвет, укажите название и город, и сайт готов. Затем добавьте номера, цены и фото в админке. Или мы всё сделаем за 300₾.'],
    oBookingA: ['კარგია, Booking-ს არ ვცვლით. Visit2.ge გაძლევს საკუთარ არხს, სადაც საკომისიოს არ იხდი. Booking-ისა და Airbnb-ის კალენდრის სინქრონიზაცია მალე დაემატება, რომ ერთი ნომერი ორჯერ არ გაიყიდოს.', 'Fine, we do not replace Booking. Visit2.ge gives you your own channel with no commission. Calendar sync with Booking and Airbnb is coming, so a room is never sold twice.', 'Хорошо, Booking мы не заменяем. Visit2.ge — ваш собственный канал без комиссии. Синхронизация календаря с Booking и Airbnb скоро появится, чтобы номер не продавался дважды.'],
    oMoneyA: ['სტუმრის ფული ჩვენთან არ გაივლის: სტუმარი პირდაპირ შენ გიხდის. თუ წინასწარ გადახდა გინდა, ადმინში შენს საბანკო ანგარიშს ან BOG/TBC-ის გადახდის ბმულს ჩაწერ.', 'Guest money never passes through us: guests pay you directly. If you want a deposit, put your bank account or a BOG/TBC payment link in the admin.', 'Деньги гостей не проходят через нас: гости платят вам напрямую. Для предоплаты укажите в админке счёт или ссылку оплаты BOG/TBC.'],
    oCallName: ['როგორ მოგმართო?', 'What is your name?', 'Как к вам обращаться?'], oCallPhone: ['ტელეფონის ნომერი?', 'Your phone number?', 'Ваш номер телефона?'],
    oCallBad: ['ნომერი სრულად ჩაწერე, მაგ.: 599 12 34 56', 'Please type the full number, e.g. 599 12 34 56', 'Укажите номер полностью, например 599 12 34 56'],
    oCallDone: ['მადლობა, {n}! დაგირეკავთ სამუშაო საათებში. (დემო: ნომერი ამ ბრაუზერში შეინახა.)', 'Thank you, {n}! We will call you in working hours. (Demo: the number is kept in this browser.)', 'Спасибо, {n}! Позвоним в рабочее время. (Демо: номер сохранён в этом браузере.)'],
    oCreate: ['საიტის შექმნა', 'Create my site', 'Создать сайт'],
  };
  const m = (k, v = {}) => String(M[k][L()] ?? M[k][0]).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');

  // ---------- widget ----------
  const css = `.vc-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:60;display:flex;align-items:center;gap:8px;min-height:52px;padding:0 20px;border:0;border-radius:999px;background:#0E857D;color:#fff;font:700 16px/1 "Noto Sans Georgian",system-ui,sans-serif;box-shadow:0 10px 28px rgba(14,133,125,.35);cursor:pointer}
.vc-fab:hover{background:#0B7A73}@media(max-width:640px){.vc-fab{width:58px;height:58px;min-height:0;padding:0;justify-content:center;font-size:0}.vc-fab::before{content:'💬';font-size:26px}}.vc{position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:61;display:flex;flex-direction:column;width:min(380px,calc(100vw - 24px));height:min(600px,calc(100vh - 32px));background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(31,26,23,.28);font:400 15px/1.5 "Noto Sans Georgian",system-ui,sans-serif;color:#1F1A17;overflow:hidden}
.vc[hidden],.vc-fab[hidden]{display:none}.vc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;background:#0E857D;color:#fff}.vc-head b{font-size:16px}
.vc-x{background:none;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:4px 8px}.vc-log{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#FFF8EE}
.vc-m{max-width:88%;padding:9px 12px;border-radius:14px;background:#fff;box-shadow:0 1px 0 #eadfce;white-space:pre-line}.vc-m.me{align-self:flex-end;background:#0E857D;color:#fff}
.vc-m a{color:#0B7A73;font-weight:700}.vc-hot{display:block;margin-top:6px;padding:8px 10px;border:1px solid #eadfce;border-radius:10px;text-decoration:none;color:#1F1A17}.vc-hot b{display:block}
.vc-opts{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;border-top:1px solid #f0e6d8}.vc-opts button,.vc-opts a{min-height:38px;padding:0 12px;border:1px solid #0E857D;border-radius:999px;background:#fff;color:#0B7A73;font:600 14px/1 inherit;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
.vc-in{display:flex;gap:6px;padding:10px 12px;border-top:1px solid #f0e6d8}.vc-in input{flex:1;min-height:42px;padding:0 12px;border:1px solid #eadfce;border-radius:10px;font:500 16px/1 inherit}.vc-in button{min-height:42px;padding:0 14px;border:0;border-radius:10px;background:#0E857D;color:#fff;font:700 14px/1 inherit;cursor:pointer}`;
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
  const say = (html, me) => { const d = document.createElement('div'); d.className = 'vc-m' + (me ? ' me' : ''); d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; };
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
    if (onText) onText(v); else start();
  });
  const openChat = () => { $('vc').hidden = false; $('vcFab').hidden = true; if (!started) { started = true; start(); } };
  $('vcFab').addEventListener('click', openChat);
  $('vcX').addEventListener('click', () => { $('vc').hidden = true; $('vcFab').hidden = false; $('vcFab').focus(); });

  // ---------- guests ----------
  const q = { city: '', from: '', to: '', g: 2 };
  const weekend = k => { const t0 = F.today(), d = new Date(t0 + 'T00:00:00Z'), add = (6 - d.getUTCDay() + 7) % 7 + 7 * k; const fri = F.addDays(t0, Math.max(0, add - 1)); return [fri, F.addDays(fri, 2)]; };
  function gStart() {
    say(esc(m('gHi')));
    choose([{ t: m('gFind'), f: gWhere }, { t: m('gHow'), f: () => { say(esc(m('gHowA'))); gMore(); } }, { t: m('gPay'), f: () => { say(esc(m('gPayA'))); gMore(); } },
      { t: m('gOwner'), f: () => { say(esc(m('gOwnerA'))); choose([{ t: m('gToOwners'), href: 'owners.html' }, { t: m('back'), f: start }]); } }]);
  }
  const gMore = () => choose([{ t: m('gFind'), f: gWhere }, { t: m('back'), f: start }]);
  function gWhere() {
    say(esc(m('gWhere')) + '<br><small>' + esc(m('gWhere2')) + '</small>');
    choose([...F.cities().slice(0, 10).map(c => ({ t: F.town(c), f: () => { q.city = c; gWhen(); } })), { t: m('gAny'), f: () => { q.city = ''; gWhen(); } }]);
    onText = v => {
      const k = v.trim().toLowerCase(), hit = F.allTowns().find(c => [c, F.town(c)].some(n => n.toLowerCase().startsWith(k) || n.toLowerCase().includes(k)));
      if (!hit) { ask(m('gNoTown'), onText); return; }
      say(esc(F.town(hit))); q.city = hit; onText = null; gWhen();
    };
  }
  function gWhen() {
    say(esc(m('gWhen')));
    choose([{ t: m('gThisWk'), f: () => { [q.from, q.to] = weekend(0); gWho(); } }, { t: m('gNextWk'), f: () => { [q.from, q.to] = weekend(1); gWho(); } },
      { t: m('gOther'), f: () => { choose([{ t: m('back'), f: start }]); ask(m('gAskDates'), parseDates); } }]);
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
  function gWho() {
    say(esc(m('gWho')));
    choose([1, 2, 3, 4, 5, 6].map(n => ({ t: String(n), f: () => { q.g = n; gShow(); } })));
  }
  function gShow() {
    const rows = F.find(q).filter(r => r.o.best).slice(0, 3);
    if (!rows.length) { say(esc(m('gNone'))); choose([{ t: m('gOther'), f: gWhen }, { t: m('gFind'), f: gWhere }, { t: m('back'), f: start }]); return; }
    say(esc(m('gFound', { d: `${F.fmt(q.from)} – ${F.fmt(q.to)}`, g: q.g })) + rows.map(({ h, o }) =>
      `<a class="vc-hot" href="${F.link(h, q)}"><b>${esc(F.hname(h))}</b>${esc(F.town(h.city))} · ${o.best.total} ₾ · ${o.n} ${m('gNights')}</a>`).join(''));
    const f = document.getElementById('search');
    choose([...(f ? [{ t: m('gAll'), f: () => {
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
