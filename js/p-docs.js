/* Safa One — документы (privacy, terms, data-deletion): модуль docsToc (ТЗ_страницы.md §2.8).
   ≥1024: рельс открыт и липкий, текущий раздел подсвечен в содержании.
   ≤1023: рельс — свёрнутый details «Содержание и документы»; после выбора раздела сворачивается. */
(() => {
const S = window.SafaPages; if (!S) return;
S.add('docsToc', () => {
  const nav = document.querySelector('[data-dc-nav]'); if (!nav) return;
  const mq = matchMedia('(max-width: 1023px)');
  const sync = () => { nav.open = !mq.matches; };
  sync(); mq.addEventListener('change', sync);
  // на широком экране блок всегда открыт
  nav.addEventListener('toggle', () => { if (!mq.matches && !nav.open) nav.open = true; });

  const links = [...nav.querySelectorAll('.dc-toc a[href^="#"]')];
  // телефон: свернуть до прокрутки — pages.js (anchors) посчитает позицию уже по новой раскладке
  links.forEach(a => a.addEventListener('click', () => {
    if (!mq.matches) return;
    nav.classList.add('is-jump'); nav.open = false;            // без анимации высоты: позиция цели считается сразу верно
    setTimeout(() => nav.classList.remove('is-jump'), 400);
  }));

  const secs = links.map(a => document.getElementById(a.getAttribute('href').slice(1)));
  const body = nav.querySelector('.dc-nav__body');
  let cur = -2, raf = 0;
  const set = i => {
    if (i === cur) return; cur = i;
    links.forEach((a, j) => {
      const on = j === i;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
    // активный пункт не уходит из видимой части рельса (длинное содержание на низком экране)
    const a = links[i];
    if (a && body && !mq.matches && body.scrollHeight > body.clientHeight){
      const r = a.getBoundingClientRect(), b = body.getBoundingClientRect();
      if (r.bottom > b.bottom - 8 || r.top < b.top + 8) body.scrollTop += r.top - b.top - b.height / 2;
    }
  };
  const tick = () => {
    raf = 0;
    // мерим по H2 раздела; линия на 40% высоты экрана, но не глубже 360 px: раздел активен, как только его заголовок в верхней части экрана
    const line = Math.min(innerHeight * 0.4, 360); let i = 0;
    secs.forEach((s, j) => { const h = s && (s.querySelector('.dc-h2') || s); if (h && h.getBoundingClientRect().top - line <= 0) i = j; });
    // дочитали до конца — последний раздел, даже если он короткий
    const de = document.documentElement, last = secs[secs.length - 1];
    if (last && innerHeight + scrollY >= de.scrollHeight - 2 && last.getBoundingClientRect().top < innerHeight) i = secs.length - 1;
    set(i);
  };
  // рельс длиннее экрана: маска снизу, пока не докрутили
  const more = () => { if (!body) return; body.classList.toggle('is-more', !mq.matches && body.scrollTop + body.clientHeight < body.scrollHeight - 4); };
  if (body){ body.addEventListener('scroll', more, { passive: true }); addEventListener('resize', more); }
  const req = () => { if (!raf) raf = requestAnimationFrame(() => { tick(); more(); }); };
  addEventListener('scroll', req, { passive: true }); addEventListener('resize', req);
  tick(); more();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(more);
});
})();
