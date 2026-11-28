// A "show" button beside every password field, so a mistyped letter can be seen before signing in or saving.
(() => {
  const css = '.pw-eye{position:relative;display:block}.pw-eye>input{width:100%;padding-right:96px!important}' +
    '.pw-eye>button{position:absolute;right:4px;top:50%;transform:translateY(-50%);min-height:40px;min-width:84px;padding:0 12px;border:0;border-radius:10px;background:transparent;color:#0B7A73;font:600 14px inherit;cursor:pointer}';
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const add = el => {
    if (el.dataset.eye || el.type !== 'password') return;
    el.dataset.eye = '1';
    const w = document.createElement('span'); w.className = 'pw-eye';
    el.parentNode.insertBefore(w, el); w.appendChild(el);
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'ჩვენება'; b.setAttribute('aria-label', 'პაროლის ჩვენება');
    b.addEventListener('click', () => { const show = el.type === 'password'; el.type = show ? 'text' : 'password'; b.textContent = show ? 'დამალვა' : 'ჩვენება'; el.focus(); });
    w.appendChild(b);
  };
  const scan = () => document.querySelectorAll('input[type=password]').forEach(add);
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['type'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
})();
