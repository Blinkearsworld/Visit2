/* The Visit2.ge header and menu, the same on every platform page (home, partners, privacy, terms).
   Logo on the left, a menu button (three lines, understood in any language) on the right; the menu holds the languages and every link.
   On a page that starts with a photo (body[data-photo]) the header is see-through until the page scrolls.
   Load it before site/platform.js, which wires the language buttons ([data-plang]). */
(() => {
  const M = {
    menu: ['მენიუ', 'Menu', 'Меню'], close: ['დახურვა', 'Close', 'Закрыть'],
    mHotels: ['სასტუმროები', 'Places to stay', 'Где остановиться'], mSaved: ['შენახული', 'Saved', 'Сохранённые'],
    mEat: ['რესტორნები', 'Restaurants', 'Рестораны'], mHow: ['როგორ მუშაობს', 'How it works', 'Как это работает'], mAbout: ['Visit2.ge-ის შესახებ', 'About Visit2.ge', 'О Visit2.ge'],
    mPartners: ['პარტნიორებისთვის: სასტუმროებს და ბინებს', 'For partners: hotels and flats', 'Партнёрам: отелям и квартирам'], mRest: ['რესტორნებისთვის', 'For restaurants', 'Ресторанам'],
    mPrivacy: ['კონფიდენციალურობა', 'Privacy', 'Конфиденциальность'], mTerms: ['პირობები', 'Terms', 'Условия'],
  };
  const home = /(^|\/)(index\.html)?$/.test(location.pathname) ? '' : 'index.html';
  const head = document.createElement('header');
  head.className = 'h-top' + (document.body.dataset.photo != null ? '' : ' solid'); head.id = 'top';
  head.innerHTML = `<a class="h-logo" href="index.html"><img src="img/brand/visit2.svg" alt="Visit2.ge" width="62" height="34"></a>
  <button type="button" class="h-menu-btn" id="menuBtn" aria-haspopup="dialog" aria-controls="menu" data-ml="menu" aria-label="Menu"><span class="h-burger" aria-hidden="true"><i></i><i></i><i></i></span></button>`;
  const dlg = document.createElement('dialog');
  dlg.className = 'h-menu'; dlg.id = 'menu'; dlg.setAttribute('aria-labelledby', 'menuH');
  dlg.innerHTML = `<div class="h-menu-in">
    <div class="h-menu-head"><h2 id="menuH" data-m="menu">მენიუ</h2><button type="button" class="h-x" data-close data-ml="close" aria-label="Close">×</button></div>
    <div class="h-langs" role="group" aria-label="Language"><button type="button" data-plang="ka">ქართული</button><button type="button" data-plang="en">English</button><button type="button" data-plang="ru">Русский</button></div>
    <nav class="h-links">
      <a href="${home}#rows" data-m="mHotels" data-close></a>
      <a href="${home}#saved" data-m="mSaved" data-close id="menuSaved" hidden></a>
      <a href="${home}#eat" data-m="mEat" data-close></a>
      <a href="${home}#how" data-m="mHow" data-close></a>
      <a href="${home}#about" data-m="mAbout" data-close></a>
    </nav>
    <nav class="h-links h-links-small">
      <a href="owners.html" data-m="mPartners"></a>
      <a href="owners.html#restaurants" data-m="mRest"></a>
      <a href="privacy.html" data-m="mPrivacy"></a>
      <a href="terms.html" data-m="mTerms"></a>
    </nav></div>`;
  document.body.prepend(head);
  document.body.append(dlg);

  const lang = () => { const l = window.V2LANG?.lang || document.documentElement.lang; return Math.max(0, ['ka', 'en', 'ru'].indexOf(l)); };
  function apply() {
    const i = lang();
    head.querySelectorAll('[data-ml]').forEach(el => el.setAttribute('aria-label', M[el.dataset.ml][i]));
    dlg.querySelectorAll('[data-m]').forEach(el => { el.textContent = M[el.dataset.m][i]; });
    dlg.querySelectorAll('[data-ml]').forEach(el => el.setAttribute('aria-label', M[el.dataset.ml][i]));
    let saved = []; try { saved = JSON.parse(localStorage.getItem('v2-saved') || '[]'); } catch (e) { /* private mode */ }
    dlg.querySelector('#menuSaved').hidden = !saved.length;
  }
  apply();
  addEventListener('DOMContentLoaded', () => { apply(); window.V2LANG?.onChange(apply); });

  head.querySelector('#menuBtn').addEventListener('click', () => { apply(); dlg.showModal(); });
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
  const onScroll = () => head.classList.toggle('scrolled', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
})();
