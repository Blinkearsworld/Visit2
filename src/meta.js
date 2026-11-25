// Facebook Messenger and Instagram Direct for every hotel, through ONE Visit2.ge Meta app.
//   GET  /api/meta            webhook check (META_VERIFY_TOKEN)
//   POST /api/meta            messages; the page id says which hotel; signature checked with META_APP_SECRET
//   GET  /api/meta/callback   back from "Connect Facebook" (Facebook Login): the owner's pages
//   POST /api/meta/delete     Meta's data-deletion request (signed_request)
// The talk is the same script as the site chatbot (no AI): prices, free rooms with adults 13+, children 2–12,
// infants and rooms, then instant booking (where the hotel turned it on) or a request the hotel confirms.
// Secrets (Cloudflare): META_APP_ID, META_APP_SECRET, META_VERIFY_TOKEN, META_ENC_KEY. Optional META_GRAPH_VERSION.
import { json } from './lib/http.js';
import { hmacHex, sameText } from './lib/crypto.js';
import { today, addDays, nights } from './lib/time.js';
import { tenantOfPage, pageToken, getConvo, saveConvo, forgetConvo, connectPage, savePending, takePending } from './db/meta.js';
import { loadState, createRequest } from './db/hotel.js';
import { getContent } from './db/content.js';
import { tenantById, ROOT_DOMAIN } from './db/tenants.js';
import { findOffer, roomsOffer, kidPrice, priceTable } from './lib/availability.js';
import { hmac } from './db/users.js';

const GV = env => env.META_GRAPH_VERSION || 'v21.0';
const BOT_TAG = 'visit2-bot';
const HANDOFF_MS = 12 * 3600e3;
const WANTS_HUMAN = /ადამიან|ოპერატორ|მენეჯერ|human|operator|person|manager|человек|оператор|менеджер/i;
const DELETE_ME = /^(delete my data|წაშალე ჩემი მონაცემები|удалите мои данные|удалить мои данные)[.!]?$/i;
const LANGS = ['ka', 'en', 'ru'];

// ---------- texts (ka / en / ru) ----------
const TX = {
  hi: ['გამარჯობა! {h} მოგესალმებათ.', 'Hello! Welcome to {h}.', 'Здравствуйте! {h} приветствует вас.'],
  help: ['რით დაგეხმაროთ?', 'How can we help?', 'Чем помочь?'],
  mPrices: ['💰 ფასები', '💰 Prices', '💰 Цены'], mFree: ['თავისუფალი ნომრები', 'Free rooms', 'Свободные номера'],
  mWhere: ['სად ვართ', 'Where we are', 'Где мы'], mFaq: ['ხშირი კითხვები', 'Questions', 'Вопросы'],
  mHuman: ['ადამიანთან საუბარი', 'Talk to a person', 'Связаться с человеком'], mLang: ['🌐 English / Русский', '🌐 ქართული / Русский', '🌐 ქართული / English'],
  menu: ['მენიუ', 'Menu', 'Меню'], pickLang: ['აირჩიეთ ენა:', 'Choose a language:', 'Выберите язык:'],
  perNight: ['ფასები ერთ ღამეზე:', 'Prices per night:', 'Цены за ночь:'], priceNote: ['ზუსტ ფასს თარიღების და სტუმრების არჩევის შემდეგ ნახავთ.', 'You see the exact price after choosing dates and guests.', 'Точную цену увидите после выбора дат и гостей.'],
  date: ['შესვლის თარიღი? დაწერეთ ასე: 15.01, ან აირჩიეთ:', 'Arrival date? Type it like 15.01, or choose:', 'Дата заезда? Напишите так: 15.01 или выберите:'],
  thisSat: ['ეს შაბათი {d}', 'This Sat {d}', 'Эта суббота {d}'], nextSat: ['შემდეგი შაბ. {d}', 'Next Sat {d}', 'След. суббота {d}'],
  badDate: ['თარიღი ვერ გავიგე. დაწერეთ ასე: 15.01', 'I could not read the date. Type it like 15.01', 'Не понял дату. Напишите так: 15.01'],
  nightsQ: ['რამდენი ღამე?', 'How many nights?', 'Сколько ночей?'], badNights: ['ჩაწერეთ რიცხვი 1-დან 30-მდე.', 'Type a number from 1 to 30.', 'Напишите число от 1 до 30.'],
  adults: ['რამდენი ზრდასრულია? (13 წლიდან)', 'How many adults? (13 and over)', 'Сколько взрослых? (от 13 лет)'],
  kids: ['რამდენი ბავშვი (2–12 წლის)?', 'How many children (2–12)?', 'Сколько детей (2–12 лет)?'], noKids: ['ბავშვის გარეშე', 'No children', 'Без детей'],
  babies: ['ჩვილები (2 წლამდე)? ისინი უფასოა.', 'Infants (under 2)? They stay free.', 'Младенцы (до 2 лет)? Бесплатно.'], noBabies: ['ჩვილის გარეშე', 'No infants', 'Без младенцев'],
  rooms: ['რამდენი ნომერი გჭირდებათ?', 'How many rooms do you need?', 'Сколько номеров нужно?'], roomsN: ['{n} ნომერი', '{n} rooms', '{n} номера'],
  offer: ['{d} · {n} ღამე · {g} სტუმარი\n{room}\n{p} ₾', '{d} · {n} nights · {g} guests\n{room}\n{p} ₾', '{d} · ночей: {n} · гостей: {g}\n{room}\n{p} ₾'],
  offerN: ['{d} · {n} ღამე · {g} სტუმარი · {k} ნომერი\n{rooms}\nსულ, ყველა ნომერი: {p} ₾', '{d} · {n} nights · {g} guests · {k} rooms\n{rooms}\nTotal for all rooms: {p} ₾', '{d} · ночей: {n} · гостей: {g} · номеров: {k}\n{rooms}\nИтого за все номера: {p} ₾'],
  none: ['ამ თარიღებზე თავისუფალი ნომერი არ გვაქვს. სცადეთ სხვა თარიღი ან დაგვიკავშირდით.', 'Nothing free on these dates. Try other dates or contact us.', 'На эти даты свободного нет. Попробуйте другие даты или свяжитесь с нами.'],
  otherDate: ['სხვა თარიღი', 'Other dates', 'Другие даты'],
  bookNow: ['✓ დაჯავშნა ახლავე', '✓ Book now', '✓ Забронировать'], onSite: ['საიტზე დაჯავშნა', 'Book on the site', 'Бронь на сайте'], request: ['ჯავშნის მოთხოვნა', 'Request booking', 'Запросить бронь'],
  instantRules: ['ჯავშანი დადასტურდება მაშინვე.{c}{p}\nდაჯავშნით ეთანხმებით სასტუმროს წესებს. ბარათი არ გჭირდებათ.', 'Your booking is confirmed at once.{c}{p}\nBy booking you agree to the hotel’s rules. No card needed.', 'Бронь подтверждается сразу.{c}{p}\nБронируя, вы соглашаетесь с правилами отеля. Карта не нужна.'],
  cancel: ['\nგაუქმება: ', '\nCancellation: ', '\nОтмена: '], prepay: ['\nწინასწარი გადახდა: ', '\nPrepayment: ', '\nПредоплата: '],
  reqRules: ['ეს ჯავშნის მოთხოვნაა: ნომერი თქვენი იქნება, როცა სასტუმრო დაგიკავშირდებათ და დაადასტურებს. გადახდა ახლა საჭირო არ არის.', 'This is a booking request: the room is yours once the hotel contacts you and confirms. No payment now.', 'Это запрос: номер ваш, когда отель свяжется и подтвердит. Оплата сейчас не нужна.'],
  name: ['თქვენი სახელი?', 'Your name?', 'Ваше имя?'], phone: ['ტელეფონის ნომერი?', 'Your phone number?', 'Ваш номер телефона?'],
  shortPhone: ['ნომერი სრულად ჩაწერეთ, მაგ.: 599 12 34 56', 'Please write the full number, e.g. 599 12 34 56', 'Напишите номер полностью, например 599 12 34 56'],
  booked: ['✓ დაჯავშნილია! ჯავშანი დადასტურებულია.\n{d} · {room} · {p} ₾\nჯავშნის ნომერი: {no}\nთქვენი ჯავშანი: {link}', '✓ Booked! Your booking is confirmed.\n{d} · {room} · {p} ₾\nBooking number: {no}\nYour booking: {link}', '✓ Забронировано! Бронь подтверждена.\n{d} · {room} · {p} ₾\nНомер брони: {no}\nВаша бронь: {link}'],
  sent: ['✓ მოთხოვნა გაიგზავნა.\n{d} · {room} · {p} ₾\nსასტუმრო დაგიკავშირდებათ ნომერზე {ph}. სანამ არ დაგიდასტურებთ, ნომერი დაკავებული არ არის.', '✓ Request sent.\n{d} · {room} · {p} ₾\nThe hotel will call you at {ph}. The room is held only after they confirm.', '✓ Запрос отправлен.\n{d} · {room} · {p} ₾\nОтель позвонит по номеру {ph}. Номер закреплён только после подтверждения.'],
  fell: ['ეს ნომერი ახლახან დაიჯავშნა, ამიტომ მოთხოვნა გაიგზავნა.', 'That room was just taken, so a request was sent instead.', 'Этот номер только что заняли, поэтому отправлен запрос.'],
  failed: ['ახლა ვერ გაიგზავნა. სცადეთ ცოტა ხანში ან დაგვირეკეთ: {ph}', 'Could not send now. Try a bit later or call: {ph}', 'Не удалось отправить. Попробуйте позже или позвоните: {ph}'],
  human: ['სასტუმროს თანამშრომელი აქვე გიპასუხებთ, დაწერეთ კითხვა.\nან დარეკეთ: {ph}\nბოტთან დასაბრუნებლად დაწერეთ: მენიუ', 'Someone from the hotel will answer here; write your question.\nOr call: {ph}\nTo get back to the bot, write: menu', 'Сотрудник отеля ответит здесь, напишите вопрос.\nИли позвоните: {ph}\nЧтобы вернуться к боту, напишите: меню'],
  noFaq: ['კითხვები ჯერ არ არის. დაგვიკავშირდით.', 'No questions yet. Contact us.', 'Вопросов пока нет. Свяжитесь с нами.'], pickQ: ['აირჩიეთ კითხვა:', 'Choose a question:', 'Выберите вопрос:'],
  noWhere: ['მისამართი მალე დაემატება. დაგვიკავშირდით: {ph}', 'The address is coming soon. Contact us: {ph}', 'Адрес скоро появится. Свяжитесь: {ph}'],
  deleted: ['თქვენი საუბრის მონაცემები წაიშალა. ჯავშნის წასაშლელად დაგვიკავშირდით: {ph}', 'Your conversation data is deleted. To delete a booking, contact us: {ph}', 'Данные переписки удалены. Чтобы удалить бронь, свяжитесь: {ph}'],
  notGot: ['ვერ გავიგე. აირჩიეთ ერთ-ერთი:', 'I did not get that. Choose one:', 'Не понял. Выберите:'],
};
const fill = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));
const MON = { ka: ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'] };
const pickL = (v, l) => (v == null ? '' : typeof v === 'string' ? v : v[l] || v.ka || v.en || '');
const detectLang = s => (/[Ⴀ-ჿ]/.test(s) ? 'ka' : /[а-яё]/i.test(s) ? 'ru' : /[a-z]/i.test(s) ? 'en' : '');
function parseDate(text) {
  const m = String(text).trim().match(/^(\d{1,2})[./\- ](\d{1,2})(?:[./\- ](\d{2,4}))?$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2]; if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  const t = today(); const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : +t.slice(0, 4);
  let s = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (!m[3] && s < t) s = `${y + 1}${s.slice(4)}`;
  const c = new Date(s + 'T00:00:00Z');
  return isNaN(c) || c.getUTCDate() !== d ? null : s;
}
const nextSat = (w = 0) => { const t = today(), wd = new Date(t + 'T00:00:00Z').getUTCDay(); return addDays(t, ((6 - wd + 7) % 7 || 7) + w * 7); };

// ---------- entry ----------
export async function metaApi(request, env, url) {
  const p = url.pathname, m = request.method, db = env.DB;
  if (p === '/api/meta' && m === 'GET') {
    const q = url.searchParams;
    if (q.get('hub.mode') === 'subscribe' && env.META_VERIFY_TOKEN && sameText(q.get('hub.verify_token') || '', env.META_VERIFY_TOKEN)) return new Response(q.get('hub.challenge') || '');
    return new Response('forbidden', { status: 403 });
  }
  if (p === '/api/meta' && m === 'POST') {
    const raw = await request.text(), sig = request.headers.get('x-hub-signature-256') || '';
    if (!env.META_APP_SECRET || !sig.startsWith('sha256=') || !sameText(sig.slice(7), await hmacHex(env.META_APP_SECRET, raw))) return new Response('bad signature', { status: 401 });
    let body; try { body = JSON.parse(raw); } catch (e) { return new Response('bad json', { status: 400 }); }
    const channel = body.object === 'instagram' ? 'ig' : 'fb';
    for (const entry of body.entry || []) {
      // the page (or Instagram account) the message came to decides the hotel; unknown pages are ignored
      const t = await tenantOfPage(db, entry.id);
      if (!t || !['trial', 'active'].includes(t.status)) continue;
      for (const ev of entry.messaging || []) {
        try { await handle(env, t, entry.id, channel, ev); } catch (e) { console.log('meta error', t.slug, e.message); }
      }
    }
    return json({ ok: true });
  }
  if (p === '/api/meta/callback' && m === 'GET') return callback(env, url);
  if (p === '/api/meta/delete' && m === 'POST') {
    // Meta's deletion callback: the conversations are removed by the daily clean-up; here we confirm the request
    const form = await request.formData().catch(() => null), sr = form && form.get('signed_request');
    const [sigPart, payload] = String(sr || '').split('.');
    const want = env.META_APP_SECRET ? await hmacHex(env.META_APP_SECRET, payload || '') : '';
    const got = sigPart ? [...atob(sigPart.replace(/-/g, '+').replace(/_/g, '/'))].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('') : '';
    if (!payload || !want || !sameText(got, want)) return json({ error: 'bad request' }, 400);
    const code = crypto.randomUUID().slice(0, 12);
    return json({ url: `https://${ROOT_DOMAIN}/privacy.html#delete`, confirmation_code: code });
  }
  return json({ error: 'not found' }, 404);
}

// ---------- sending ----------
async function send(env, token, psid, text, replies) {
  const message = { text: String(text).slice(0, 1900), metadata: BOT_TAG };
  if (replies?.length) message.quick_replies = replies.slice(0, 13).map(([title, payload]) => ({ content_type: 'text', title: String(title).slice(0, 20), payload }));
  if (env.META_DRY_RUN) { (env.__sent ||= []).push({ psid, message }); return; }
  try {
    const r = await fetch(`https://graph.facebook.com/${GV(env)}/me/messages?access_token=${encodeURIComponent(token)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recipient: { id: psid }, messaging_type: 'RESPONSE', message }) });
    if (!r.ok) console.log('meta send failed', r.status, await r.text());
  } catch (e) { console.log('meta send failed', e.message); }
}

// ---------- one message ----------
async function handle(env, t, pageId, channel, ev) {
  const db = env.DB, token = env.META_DRY_RUN ? 'dry' : await pageToken(db, t, pageId, env.META_ENC_KEY);
  if (!token) return;
  // a reply typed by hotel staff in the inbox: the bot stays quiet for that guest for 12 hours
  if (ev.message?.is_echo) {
    if (ev.message.metadata === BOT_TAG || !ev.recipient?.id) return;
    const cid = channel + ':' + ev.recipient.id, c0 = await getConvo(db, t, cid);
    c0.handoff = Date.now() + HANDOFF_MS; c0.step = 'menu'; await saveConvo(db, t, cid, c0); return;
  }
  const psid = ev.sender?.id; if (!psid || ev.read || ev.delivery) return;
  const id = channel + ':' + psid, c = await getConvo(db, t, id);
  const { content } = await getContent(db, t), site = content.site || {}, contact = content.contact || {};
  const payload = ev.message?.quick_reply?.payload || ev.postback?.payload || null, text = (ev.message?.text || '').trim();
  if (!c.lang && text) c.lang = detectLang(text) || undefined;
  const L = () => (LANGS.includes(c.lang) ? c.lang : 'ka'), li = () => LANGS.indexOf(L());
  const T = (k, v) => fill(TX[k][li()] ?? TX[k][0], v);
  const PH = contact.phone || '';
  const fmtD = s => { const d = new Date(s + 'T00:00:00Z'); return d.getUTCDate() + ' ' + MON[L()][d.getUTCMonth()]; };
  const range = (a, b) => fmtD(a) + ' – ' + fmtD(b);
  const say = (x, r) => send(env, token, psid, x, r);
  const BACK = () => [T('menu'), 'MENU'];
  const siteUrl = `https://${t.slug}.${ROOT_DOMAIN}/`;
  const instantOn = !!site.instant?.on, kidRule = site.kids && site.kids.mode ? site.kids : null;

  if (DELETE_ME.test(text)) { await forgetConvo(db, t, id); await say(T('deleted', { ph: PH })); return; }
  if (c.handoff && Date.now() < c.handoff && payload !== 'MENU' && !/^(მენიუ|menu|меню)$/i.test(text)) return;
  delete c.handoff;

  const menu = async greet => {
    c.step = 'menu';
    await say((greet ? T('hi', { h: t.name }) + '\n' : '') + T('help'), [[T('mFree'), 'AVAIL'], [T('mPrices'), 'PRICES'], [T('mWhere'), 'LOC'], [T('mFaq'), 'FAQ'], [T('mHuman'), 'CONTACT'], [T('mLang'), 'LANG']]);
  };
  const human = async () => { c.step = 'menu'; c.handoff = Date.now() + HANDOFF_MS; await say(T('human', { ph: PH }), [BACK()]); };
  const askDate = async () => { c.step = 'date'; await say(T('date'), [[T('thisSat', { d: fmtD(nextSat()) }), 'D_' + nextSat()], [T('nextSat', { d: fmtD(nextSat(1)) }), 'D_' + nextSat(1)], BACK()]); };
  const askRooms = async () => {
    c.g = c.adults + (c.kids || 0); c.rooms = 1;
    if (c.g < 3) return offer();
    c.step = 'rooms';
    await say(T('rooms'), Array.from({ length: Math.min(4, c.adults) }, (_, i) => [T('roomsN', { n: i + 1 }), 'R_' + (i + 1)]).concat([BACK()]));
  };
  const offer = async () => {
    const st = await loadState(db, t), from = c.from, to = addDays(from, c.n), g = c.g, kids = c.kids || 0;
    c.to = to;
    const btns = () => (instantOn ? [[T('bookNow'), 'BOOK_I'], [T('onSite'), 'SITE']] : [[T('request'), 'BOOK_R']]).concat([[T('otherDate'), 'AVAIL'], BACK()]);
    if ((c.rooms || 1) > 1) {
      const o = roomsOffer(st, from, to, g, c.rooms, kids, kidRule);
      if (!o.parts) { c.step = 'menu'; return say(T('none'), [[T('otherDate'), 'AVAIL'], [T('mHuman'), 'CONTACT'], BACK()]); }
      c.step = 'offer'; c.pick = { total: o.total, typeName: o.parts.map(x => pickL(x.name, L())).join(' + ') };
      return say(T('offerN', { d: range(from, to), n: c.n, g, k: o.parts.length, p: o.total, rooms: o.parts.map(x => `• ${pickL(x.name, L())} · ${x.guests} · ${x.total} ₾`).join('\n') }), btns());
    }
    const o = findOffer(st, from, to, g);
    if (!o) { c.step = 'menu'; return say(T('none'), [[T('otherDate'), 'AVAIL'], [T('mHuman'), 'CONTACT'], BACK()]); }
    const total = kidPrice(st, o.type, from, to, g, Math.min(kids, g - 1), kidRule);
    c.step = 'offer'; c.pick = { type: o.type, total, typeName: pickL(o.name, L()) };
    return say(T('offer', { d: range(from, to), n: c.n, g, room: c.pick.typeName, p: total }), btns());
  };
  const finish = async phone => {
    const st = await loadState(db, t), babies = c.babies ? `${c.babies} × 0–2` : '';
    let r;
    try {
      r = await createRequest(db, t, st, { from: c.from, to: c.to, guests: c.g, children: c.kids || 0, rooms: c.rooms || 1, name: c.name, phone,
        source: channel === 'ig' ? 'instagram' : 'facebook', type: c.pick?.type, instant: !!c.instant && instantOn, kidRule, wish: babies });
    } catch (e) { c.step = 'menu'; return say(T('failed', { ph: PH }), [BACK()]); }
    const d = range(c.from, c.to), room = c.pick?.typeName || '', p = r.total;
    c.step = 'menu'; const wanted = c.instant; delete c.pick; delete c.instant;
    if (r.instant) {
      const k = env.SESSION_SECRET ? (await hmac(env.SESSION_SECRET, 'booking|' + t.id + '|' + r.booking.id)).slice(0, 20) : '';
      return say(T('booked', { d, room, p, no: String(r.booking.id).slice(-6).toUpperCase(), link: `${siteUrl}?b=${encodeURIComponent(r.booking.id)}&k=${k}` }), [BACK()]);
    }
    return say((wanted ? T('fell') + '\n' : '') + T('sent', { d, room, p, ph: phone }), [BACK()]);
  };

  try {
    if (payload === 'MENU' || (c.step === 'new' && !payload && !WANTS_HUMAN.test(text)) || /^(მენიუ|გამარჯობა|სალამი|hi|hello|menu|start|меню|привет|здравствуйте)[!.]?$/i.test(text)) await menu(c.step === 'new');
    else if (payload === 'LANG') { c.step = 'menu'; await say(T('pickLang'), [['ქართული', 'L_ka'], ['English', 'L_en'], ['Русский', 'L_ru']]); }
    else if (payload?.startsWith('L_') && LANGS.includes(payload.slice(2))) { c.lang = payload.slice(2); await menu(false); }
    else if (payload === 'CONTACT' || (!payload && WANTS_HUMAN.test(text) && !['name', 'phone'].includes(c.step))) await human();
    else if (payload === 'PRICES') {
      const tb = priceTable(await loadState(db, t)).slice(0, 1), rg = r => (r.min === r.max ? r.min + ' ₾' : r.min + '–' + r.max + ' ₾');
      await say(T('perNight') + '\n' + tb.map(x => x.rows.map(r => `• ${pickL(r.name, L())}: ${rg(r)}`).join('\n')).join('\n') + '\n\n' + T('priceNote'), [[T('mFree'), 'AVAIL'], BACK()]);
    }
    else if (payload === 'LOC') {
      const a = pickL(contact.addr, L());
      await say(a ? a + (contact.map ? '\n' + contact.map : '') : T('noWhere', { ph: PH }), [[T('mFree'), 'AVAIL'], BACK()]);
    }
    else if (payload === 'FAQ') {
      const list = (content.faq || []).slice(0, 11);
      await say(list.length ? T('pickQ') : T('noFaq'), list.map((f, i) => [pickL(f.q, L()), 'Q_' + i]).concat([BACK()]));
    }
    else if (payload?.startsWith('Q_')) { const f = (content.faq || [])[+payload.slice(2)]; await say(f ? pickL(f.a, L()) : '—', [[T('mFaq'), 'FAQ'], [T('mFree'), 'AVAIL'], BACK()]); }
    else if (payload === 'AVAIL') await askDate();
    else if (payload?.startsWith('D_') || c.step === 'date') {
      const d = payload?.startsWith('D_') ? payload.slice(2) : parseDate(text);
      if (!d || d < today()) await say(T('badDate'), [BACK()]);
      else { c.from = d; c.step = 'nights'; await say(T('nightsQ'), [1, 2, 3, 4, 5, 6, 7, 10, 14].map(n => [String(n), 'N_' + n]).concat([BACK()])); }
    }
    else if (payload?.startsWith('N_') || (c.step === 'nights' && /^\d{1,2}$/.test(text))) {
      const n = payload?.startsWith('N_') ? +payload.slice(2) : +text;
      if (n < 1 || n > 30) await say(T('badNights'), [BACK()]);
      else { c.n = n; c.step = 'adults'; await say(T('adults'), [1, 2, 3, 4, 5, 6, 7, 8].map(x => [String(x), 'A_' + x]).concat([BACK()])); }
    }
    else if (payload?.startsWith('A_')) { c.adults = +payload.slice(2); c.step = 'kids'; await say(T('kids'), [[T('noKids'), 'K_0'], ...[1, 2, 3, 4, 5].map(x => [String(x), 'K_' + x]), BACK()]); }
    else if (payload?.startsWith('K_') && c.adults) { c.kids = +payload.slice(2) || 0; c.step = 'babies'; await say(T('babies'), [[T('noBabies'), 'B_0'], ...[1, 2, 3].map(x => [String(x), 'B_' + x]), BACK()]); }
    else if (payload?.startsWith('B_') && c.adults) { c.babies = +payload.slice(2) || 0; await askRooms(); }
    else if (payload?.startsWith('R_') && c.adults) { c.rooms = Math.max(1, Math.min(4, +payload.slice(2) || 1)); await offer(); }
    else if (payload === 'SITE' && c.from) {
      await say(`${siteUrl}?from=${c.from}&to=${c.to}&g=${c.g}${(c.rooms || 1) > 1 ? '&rooms=' + c.rooms : ''}#book`, [BACK()]);
    }
    else if ((payload === 'BOOK_I' || payload === 'BOOK_R') && c.pick) {
      c.instant = payload === 'BOOK_I' && instantOn; c.step = 'name';
      const r = site.instant || {}, cn = pickL(r.cancel, L()), pp = pickL(r.prepay, L());
      await say((c.instant ? T('instantRules', { c: cn ? T('cancel') + cn : '', p: pp ? T('prepay') + pp : '' }) : T('reqRules')) + '\n\n' + T('name'));
    }
    else if (c.step === 'name' && text) { c.name = text.slice(0, 80); c.step = 'phone'; await say(T('phone')); }
    else if (c.step === 'phone' && text) {
      if (text.replace(/\D/g, '').length < 9) await say(T('shortPhone'));
      else await finish(text.slice(0, 30));
    }
    else {
      c.misses = (c.misses || 0) + 1;
      if (c.misses >= 2) { c.misses = 0; await human(); }
      else await say(T('notGot'), [[T('mFree'), 'AVAIL'], [T('mPrices'), 'PRICES'], [T('mHuman'), 'CONTACT'], BACK()]);
    }
  } finally {
    await saveConvo(db, t, id, c);
  }
}

// ---------- "Connect Facebook" ----------
// start: the hotel admin sends the owner to Facebook with a signed state (which hotel, valid 15 minutes)
export async function metaStartUrl(env, t) {
  const exp = Date.now() + 15 * 60e3, st = `${t.id}.${exp}`, sig = (await hmac(env.SESSION_SECRET, 'meta|' + st)).slice(0, 32);
  const q = new URLSearchParams({ client_id: env.META_APP_ID, redirect_uri: `https://${ROOT_DOMAIN}/api/meta/callback`, state: `${st}.${sig}`,
    scope: 'pages_show_list,pages_messaging,pages_manage_metadata,instagram_basic,instagram_manage_messages', response_type: 'code' });
  return `https://www.facebook.com/${GV(env)}/dialog/oauth?${q}`;
}
async function stateTenant(env, db, state) {
  const [tid, exp, sig] = String(state || '').split('.');
  if (!tid || !exp || +exp < Date.now() || !env.SESSION_SECRET) return null;
  if (!sameText(sig || '', (await hmac(env.SESSION_SECRET, `meta|${tid}.${exp}`)).slice(0, 32))) return null;
  return tenantById(db, tid);
}
const back = (t, msg) => new Response(null, { status: 303, headers: { location: `https://${t.slug}.${ROOT_DOMAIN}/admin?meta=${encodeURIComponent(msg)}` } });
async function callback(env, url) {
  const db = env.DB, t = await stateTenant(env, db, url.searchParams.get('state'));
  if (!t) return new Response('This link is old. Open your admin and press "Connect Facebook" again.', { status: 400 });
  const code = url.searchParams.get('code');
  if (!code) return back(t, 'cancelled');
  const G = `https://graph.facebook.com/${GV(env)}`;
  const tok = await (await fetch(`${G}/oauth/access_token?${new URLSearchParams({ client_id: env.META_APP_ID, client_secret: env.META_APP_SECRET, redirect_uri: `https://${ROOT_DOMAIN}/api/meta/callback`, code })}`)).json();
  if (!tok.access_token) return back(t, 'failed');
  const acc = await (await fetch(`${G}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=50&access_token=${encodeURIComponent(tok.access_token)}`)).json();
  const pages = (acc.data || []).map(x => ({ id: x.id, name: x.name, token: x.access_token, ig: x.instagram_business_account?.id || '' }));
  if (!pages.length) return back(t, 'nopages');
  if (pages.length === 1) return pick(env, t, pages[0]);
  await savePending(db, t, pages, env.META_ENC_KEY);
  return back(t, 'choose');
}
// one page chosen: subscribe our app to it and keep its token sealed
export async function pick(env, t, page) {
  const r = await fetch(`https://graph.facebook.com/${GV(env)}/${page.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_echoes&access_token=${encodeURIComponent(page.token)}`, { method: 'POST' });
  if (!r.ok) return back(t, 'failed');
  try { await connectPage(env.DB, t, { pageId: page.id, igId: page.ig, token: page.token }, env.META_ENC_KEY); } catch (e) { return back(t, 'taken'); }
  return back(t, 'connected');
}
export async function pendingPages(env, t) { return (await takePending(env.DB, t, env.META_ENC_KEY)) || []; }
