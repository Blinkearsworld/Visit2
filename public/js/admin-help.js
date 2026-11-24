/* Admin helper: a scripted bot that takes an owner straight to the right place.
   It understands a few words (Georgian, English, Russian), opens the section and lights up the button.
   No AI, no network: every answer is written here. When it cannot help, it says who to write to. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // go: [mode, tab or sub-tab, element to light up]. Words are matched as parts of what the owner typed.
  const TOPICS = [
    { t: 'ჯავშნის დამატება', a: 'აქ ხელით ამატებ ჯავშანს, მაგალითად ტელეფონით მოსულს. დააჭირე „+ ჯავშანი“.',
      go: ['book', 'cal', '#addBtn'], w: ['დამატ', 'ახალი ჯავშ', 'ჯავშნის შექმნ', 'ხელით', 'add booking', 'new booking', 'добав', 'новая бронь'] },
    { t: 'მოთხოვნის დადასტურება', a: 'აქ ჩანს საიტიდან და ბოტიდან მოსული მოთხოვნები. დაურეკე სტუმარს და დააჭირე „დადასტურება“.',
      go: ['book', 'req', '#p-req'], w: ['მოთხოვნ', 'დადასტურ', 'დავადასტურ', 'უარი', 'request', 'confirm', 'заявк', 'подтверд'] },
    { t: 'ფასის შეცვლა', a: 'აქ ცვლი ფასებს: თითო ნომერს, თითო სეზონს და სტუმრების რაოდენობას. ცვლილება საიტზე მაშინვე ჩანს.',
      go: ['book', 'price', '#prices'], w: ['ფას', 'ღირებულ', 'ლარ', 'price', 'rate', 'цен', 'стоимост'] },
    { t: 'ფასდაკლება', a: 'აქ ქმნი სპეციალურ შეთავაზებას: თარიღები და ფასდაკლება. საიტზე ის „✨ სპეციალური შეთავაზება“ ჩანს.',
      go: ['book', 'price', '#prSave'], w: ['ფასდაკლ', 'აქცი', 'შეთავაზ', 'discount', 'offer', 'deal', 'скидк', 'акци'] },
    { t: 'სეზონი', a: 'აქ ირჩევ, რომელი სეზონით გაიხსნას საიტი: ავტომატურად თარიღებით, ან ხელით ზამთარი/ზაფხული.',
      go: ['book', 'price', '#sMode'], w: ['სეზონ', 'ზამთ', 'ზაფხ', 'season', 'winter', 'summer', 'сезон', 'зим', 'лет'] },
    { t: 'კალენდარი', a: 'კალენდარში ჩანს, რომელი ნომერი რომელ დღეს არის დაკავებული. ცარიელ უჯრაზე დაჭერით ჯავშანს ამატებ.',
      go: ['book', 'cal', '#p-cal'], w: ['კალენდ', 'თავისუფ', 'დაკავებ', 'ნომრების განაწ', 'calendar', 'free room', 'календар', 'свобод'] },
    { t: 'გადახდები', a: 'აქ ჩანს მიღებული თანხა და ვისაც გადასახდელი დარჩა. გადახდას ჯავშნის გახსნით ამატებ.',
      go: ['book', 'money', '#p-money'], w: ['გადახდ', 'შემოსავ', 'ფული', 'თანხ', 'payment', 'paid', 'money', 'оплат', 'деньг', 'доход'] },
    { t: 'სტუმრები', a: 'აქ ჩანს ყველა სტუმარი და რამდენჯერ მოვიდნენ. შენიშვნაც შეგიძლია დაუწერო.',
      go: ['book', 'guests', '#p-guests'], w: ['სტუმრ', 'კლიენტ', 'ისტორი', 'guest', 'client', 'гост', 'клиент'] },
    { t: 'ტექსტი და ფოტოები', a: 'აქ ცვლი საიტის ტექსტებს და ფოტოებს. ბოლოს ქვემოთ დააჭირე „შენახვა“.',
      go: ['site', 'texts', '#s-texts'], w: ['ტექსტ', 'ფოტო', 'სურათ', 'აღწერ', 'text', 'photo', 'picture', 'текст', 'фото'] },
    { t: 'ნომრების აღწერა', a: 'აქ თითო ნომერს უწერ აღწერას და ფოტოებს ამატებ.',
      go: ['site', 'rooms', '#s-rooms'], w: ['ნომრის აღწ', 'ნომრის ფოტ', 'ოთახ', 'room photo', 'room text', 'номер'] },
    { t: 'ტელეფონი და მისამართი', a: 'აქ ცვლი ტელეფონს, WhatsApp-ს და მისამართს.',
      go: ['site', 'contact', '#s-contact'], w: ['ტელეფ', 'ნომერი', 'მისამართ', 'whatsapp', 'phone', 'address', 'телефон', 'адрес'] },
    { t: 'რუკა და რესტორნები', a: 'აქ რუკაზე ნიშნავ სასტუმროს ადგილს, ირჩევ, რომელი რესტორნები ჩანდეს საიტზე, და ამატებ შენს რჩევებს.',
      go: ['site', 'near', '#nearMap'], w: ['რუკ', 'რესტორ', 'კაფე', 'ადგილ', 'map', 'restaurant', 'cafe', 'карт', 'ресторан', 'кафе'] },
    { t: 'ხშირი კითხვები', a: 'აქ წერ კითხვა-პასუხებს, რომლებსაც სტუმრები ხშირად სვამენ. ჩატბოტიც მათ იყენებს.',
      go: ['site', 'faq', '#s-faq'], w: ['კითხვ', 'faq', 'вопрос'] },
    { t: 'თანამშრომლის დამატება', a: 'აქ ამატებ თანამშრომელს და ირჩევ, რისი ნახვა და შეცვლა შეუძლია.',
      go: ['team', '', '#tName'], w: ['თანამშრ', 'გუნდ', 'მენეჯერ', 'staff', 'team', 'сотрудн', 'команд'] },
    { t: 'შაბლონი და ფერი', a: 'შაბლონის და ფერის შეცვლა ადმინში მალე დაემატება. მანამდე მოგვწერე და ჩვენ შევცვლით.',
      go: null, w: ['შაბლონ', 'ფერ', 'დიზაინ', 'template', 'colour', 'color', 'design', 'шаблон', 'цвет', 'дизайн'] },
  ];
  const CONTACT = 'visit2ge@gmail.com';

  function find(q) {
    const s = q.toLowerCase();
    let best = null, score = 0;
    for (const x of TOPICS) {
      const n = x.w.filter(k => s.includes(k)).length;
      if (n > score) { best = x; score = n; }
    }
    return best;
  }

  // open the section and light up the place; returns false if this person cannot open it
  function go(target) {
    const [mode, tab, sel] = target;
    const mb = $(`[data-mode="${mode}"]`);
    if (mb && mb.hidden) return false;
    if (mb) mb.click();
    if (tab) {
      const tb = $(`.tab[data-tab="${tab}"]`) || $(`.stab[data-s="${tab}"]`);
      if (tb && tb.hidden) return false;
      if (tb) tb.click();
    }
    setTimeout(() => {
      const el = $(sel); if (!el) return;
      const box = el.closest('details'); if (box) box.open = true;
      el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      el.classList.add('v2-glow'); setTimeout(() => el.classList.remove('v2-glow'), 3200);
    }, 250);
    return true;
  }

  const css = document.createElement('style');
  css.textContent = `
.v2h-btn{position:fixed;right:max(14px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:60;display:inline-flex;align-items:center;gap:8px;min-height:50px;padding:0 18px;border:0;border-radius:999px;background:#0B7A73;color:#fff;font:700 15px/1 "Noto Sans Georgian",system-ui,sans-serif;box-shadow:0 10px 24px -10px rgba(0,0,0,.5);cursor:pointer}
.v2h{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(76px,calc(env(safe-area-inset-bottom) + 76px));z-index:61;width:min(380px,calc(100vw - 24px));max-height:min(70vh,560px);display:flex;flex-direction:column;background:#fff;border:1px solid #E7DED2;border-radius:18px;box-shadow:0 24px 48px -20px rgba(31,26,23,.45);overflow:hidden}
.v2h[hidden]{display:none}
.v2h-head{display:flex;justify-content:space-between;align-items:center;padding:12px 14px 12px 18px;border-bottom:1px solid #E7DED2;font-weight:700}
.v2h-head button{min-width:44px;min-height:44px;border:0;background:none;font-size:22px;cursor:pointer;color:#645C55}
.v2h-log{flex:1;overflow:auto;padding:14px 16px;display:grid;gap:10px;align-content:start}
.v2h-m{max-width:88%;padding:10px 13px;border-radius:14px;background:#F7F3EC;font-size:15px;line-height:1.45}
.v2h-m.me{justify-self:end;background:#0B7A73;color:#fff}
.v2h-chips{display:flex;flex-wrap:wrap;gap:6px}
.v2h-chips button{min-height:40px;padding:0 12px;border-radius:999px;border:1px solid #E7DED2;background:#fff;font:600 14px/1.2 "Noto Sans Georgian",system-ui,sans-serif;color:#1F1A17;cursor:pointer}
.v2h-chips button:hover{border-color:#0B7A73}
.v2h-form{display:flex;gap:8px;padding:10px;border-top:1px solid #E7DED2}
.v2h-form input{flex:1;min-width:0;min-height:46px;padding:0 14px;border:1px solid #E7DED2;border-radius:999px;font:16px "Noto Sans Georgian",system-ui,sans-serif}
.v2h-form button{min-height:46px;padding:0 16px;border:0;border-radius:999px;background:#0B7A73;color:#fff;font:700 15px "Noto Sans Georgian",system-ui,sans-serif;cursor:pointer}
.v2-glow{outline:3px solid #0E857D!important;outline-offset:4px;border-radius:10px;animation:v2glow 1s ease-in-out 3}
@keyframes v2glow{50%{outline-color:rgba(14,133,125,.25)}}
@media (prefers-reduced-motion:reduce){.v2-glow{animation:none}}
body.site .v2h-btn{bottom:max(96px,calc(env(safe-area-inset-bottom) + 96px))}
body.site .v2h{bottom:max(156px,calc(env(safe-area-inset-bottom) + 156px))}`;
  document.head.appendChild(css);

  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'v2h-btn'; btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span aria-hidden="true">?</span> დახმარება';
  const box = document.createElement('section');
  box.className = 'v2h'; box.hidden = true; box.setAttribute('aria-label', 'დახმარება');
  box.innerHTML = `<div class="v2h-head"><span>რით დაგეხმარო?</span><button type="button" aria-label="დახურვა">×</button></div>
<div class="v2h-log" aria-live="polite"></div>
<form class="v2h-form"><input name="q" autocomplete="off" placeholder="მაგ.: ფასი როგორ შევცვალო?" aria-label="შენი კითხვა"><button type="submit">→</button></form>`;
  document.body.append(btn, box);
  const log = box.querySelector('.v2h-log');

  const say = (html, me) => { const d = document.createElement('div'); d.className = 'v2h-m' + (me ? ' me' : ''); d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; };
  const chips = list => { const d = document.createElement('div'); d.className = 'v2h-chips'; d.innerHTML = list.map(x => `<button type="button" data-t="${esc(x.t)}">${esc(x.t)}</button>`).join(''); log.appendChild(d); log.scrollTop = log.scrollHeight; };
  const start = () => { log.innerHTML = ''; say('აირჩიე თემა ან ჩაწერე შენი სიტყვებით. სწორ ადგილს გაგიხსნი და საჭირო ღილაკს მოგინიშნავ.'); chips(TOPICS.slice(0, 8)); };

  function answer(x) {
    say(esc(x.a));
    if (x.go) {
      if (!go(x.go)) say('ეს განყოფილება შენთვის დახურულია. მფლობელს სთხოვე, „გუნდში“ წვდომა მოგცეს.');
      else if (matchMedia('(max-width: 640px)').matches) setTimeout(() => toggle(false), 900);
    } else say(`მოგვწერე: <a href="mailto:${CONTACT}">${CONTACT}</a>`);
  }
  function ask(q) {
    q = q.trim(); if (!q) return;
    say(esc(q), true);
    const x = find(q);
    if (x) answer(x);
    else { say(`ამ კითხვაზე ზუსტი პასუხი ჯერ არ მაქვს. ქვემოთ აირჩიე ახლო თემა, ან მოგვწერე: <a href="mailto:${CONTACT}">${CONTACT}</a>`); chips(TOPICS); }
  }
  function toggle(open) {
    box.hidden = !open; btn.setAttribute('aria-expanded', String(open));
    if (open) { if (!log.childElementCount) start(); box.querySelector('input').focus(); }
  }
  btn.addEventListener('click', () => toggle(box.hidden));
  box.querySelector('.v2h-head button').addEventListener('click', () => toggle(false));
  box.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const i = e.target.q; ask(i.value); i.value = ''; });
  log.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; const x = TOPICS.find(y => y.t === b.dataset.t); if (x) { say(esc(x.t), true); answer(x); } });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) toggle(false); });
})();
