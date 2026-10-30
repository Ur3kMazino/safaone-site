/* Safa Fleet — поведение страницы (ТЗ_страницы.md §2.1): аватары, сюжет Каримова в окне (fleetStory), рельс модулей (fleetRail).
   Порт ds.js из devices-system (PORT.md §4): avaHash/paintAvas, roll, swapText, setStatus, setDoc. Регистрируется через SafaPages.add. */
(() => {
const P = window.SafaPages; if (!P) return;
const { $, $$ } = P;
const RM = () => P.reduce();
const wait = ms => new Promise(r => setTimeout(r, RM() ? 0 : ms));

/* ---------- аватар: цвет по хешу инициалов (djb2-xor), 4 пары ---------- */
const avaHash = s => { let h = 5381; for (const c of s) h = (Math.imul(h, 33) ^ c.codePointAt(0)) >>> 0; return h % 4; };
P.add('fleetAvas', () => $$('.pg-ava[data-i]').forEach(a => { a.dataset.c = avaHash(a.dataset.i); }));

/* ---------- одометр: меняются только изменившиеся разряды ---------- */
function roll(el, to){
  const from = el.textContent.trim(), t = String(to);
  if (from === t) return;
  if (RM()){ el.textContent = t; return; }
  const up = +t > +from, n = Math.max(from.length, t.length);
  const a = from.padStart(n, ' '), b = t.padStart(n, ' ');
  const lh = parseFloat(getComputedStyle(el).lineHeight) || el.getBoundingClientRect().height;
  el.textContent = '';
  for (let i = 0; i < n; i++){
    if (a[i] === b[i]){ el.append(b[i]); continue; }
    const w = document.createElement('span'); w.className = 'fl-rd'; w.style.height = lh + 'px';
    const s = document.createElement('span'); s.className = 'fl-rd__s';
    s.innerHTML = up ? `<i style="height:${lh}px">${a[i].trim() || '&nbsp;'}</i><i style="height:${lh}px">${b[i]}</i>`
                     : `<i style="height:${lh}px">${b[i]}</i><i style="height:${lh}px">${a[i].trim() || '&nbsp;'}</i>`;
    s.style.transform = up ? 'translateY(0)' : `translateY(${-lh}px)`;
    w.append(s); el.append(w);
    s.getBoundingClientRect();
    s.style.transform = up ? `translateY(${-lh}px)` : 'translateY(0)';
  }
  setTimeout(() => { el.textContent = t; }, 520);
}

/* ---------- текст маской: старая строка уходит вверх, новая приходит снизу, ширина едет ---------- */
function swapText(t, html){
  if (RM()){ t.innerHTML = `<span>${html}</span>`; return; }
  const old = t.firstElementChild;
  const nw = document.createElement('span'); nw.innerHTML = html;
  t.style.width = old.scrollWidth + 'px';   // scrollWidth — в тех же CSS-пикселях, что и width (окно под zoom)
  old.classList.add('is-out');
  nw.style.transform = 'translateY(100%)'; nw.style.opacity = '0';
  t.append(nw);
  const w = nw.scrollWidth;
  t.getBoundingClientRect();
  t.style.width = w + 'px';
  old.style.transform = 'translateY(-100%)'; old.style.opacity = '0';
  nw.style.transform = 'translateY(0)'; nw.style.opacity = '1';
  setTimeout(() => { old.remove(); t.style.width = ''; nw.removeAttribute('style'); }, 480);
}
function setStatus(st, kind, html){
  st.classList.remove('fl-st--wait', 'fl-st--off'); if (kind) st.classList.add('fl-st--' + kind);
  swapText($('.fl-sw', st), html);
}
async function setDoc(chip, kind, icon, html){
  chip.classList.add('is-swap');
  chip.classList.remove('pg-doc--warn', 'pg-doc--bad'); if (kind !== 'ok') chip.classList.add('pg-doc--' + kind);
  if (html) swapText($('.fl-sw', chip), html);
  await wait(120);
  $('use', chip).setAttribute('href', '#d-' + icon);
  chip.classList.remove('is-swap');
  await wait(360);
}

/* ---------- сюжет (экран «Автомобили»): ОСГО у 01 K 784 MA принято → «На линии», 230→231 и 13→12 → «Проверено 08:15». Один раз при 60% видимости ---------- */
P.add('fleetStory', () => {
  const win = $('#fl-win'); if (!win) return;
  const row = $('#fl-karimov', win);
  let done = false;
  const play = async () => {
    if (done) return; done = true;
    await setDoc($('[data-k="docs"]', row), 'ok', 'ok', '4&nbsp;из&nbsp;4');   // 0 ms … 480
    await wait(160);                                                           // +640
    setStatus($('.fl-st', row), '', 'На&nbsp;линии');
    roll($('[data-roll="act"]', win), 231);
    roll($('[data-roll="wait"]', win), 12);
    await wait(500);                                                           // +1140
    row.classList.add('is-checked');
  };
  if (RM()){ play(); return; }
  if (!('IntersectionObserver' in window)){ play(); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting && e.intersectionRatio >= .6){ io.disconnect(); setTimeout(play, 280); }
  }), { threshold: [0, .6, 1] });
  io.observe(win);
});

/* ---------- рельс модулей: подсветка текущего, клик ведёт к блоку ----------
   Текущий модуль считается по положению блоков на каждом кадре прокрутки (rAF), а не по смене пересечений:
   после прыжка (Home, «Модули» из героя) подсветка не залипает на старом блоке. */
P.add('fleetRail', () => {
  const rail = $('.fl-rail'); if (!rail) return;
  const col = rail.closest('.fl-railcol');
  const links = $$('a[href^="#m-"]', rail);
  const blocks = links.map(a => document.getElementById(a.hash.slice(1))).filter(Boolean);
  if (!blocks.length) return;
  const narrow = matchMedia('(max-width: 1023px)');
  let cur = '';
  const set = id => {
    if (id === cur) return; cur = id;
    links.forEach(a => {
      const on = a.hash === '#' + id;
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      // строка вкладок на узком экране: текущая вкладка — в зоне видимости; первая — строка в начало
      if (on && narrow.matches){
        const beh = RM() ? 'instant' : 'smooth';
        if (id === blocks[0].id){ rail.scrollTo({ left: 0, behavior: beh }); return; }
        const l = a.offsetLeft - parseFloat(getComputedStyle(rail).paddingLeft), r = l + a.offsetWidth;
        if (l < rail.scrollLeft || r > rail.scrollLeft + rail.clientWidth * .85 - 8) rail.scrollTo({ left: Math.max(0, l - 8), behavior: beh });
      }
    });
  };
  const pick = () => {
    const line = innerHeight * .4;
    let b = blocks[0];
    for (const x of blocks) if (x.getBoundingClientRect().top <= line) b = x;
    set(b.id);
    // строка вкладок прилипла под меню — закрываем зону над ней (CSS .fl-railcol.is-stuck::before)
    if (col){
      let stuck = false;
      if (narrow.matches){
        const top = parseFloat(getComputedStyle(col).top) || 0, r = col.getBoundingClientRect();
        const sec = col.parentElement.getBoundingClientRect();
        stuck = r.top <= top + 1 && sec.bottom > r.bottom + 8;
      }
      col.classList.toggle('is-stuck', stuck);
    }
  };
  let raf = 0;
  const req = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; pick(); }); };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  pick();
  // строка вкладок (≤767) прокручена влево — CSS гасит и левый край ряда
  const edge = () => rail.classList.toggle('is-scrolled', rail.scrollLeft > 2);
  rail.addEventListener('scroll', edge, { passive: true });
  edge();
  rail.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#m-"]'); if (!a) return;
    const el = document.getElementById(a.hash.slice(1)); if (!el) return;
    e.preventDefault();
    const nav = $('#nav');
    const off = narrow.matches ? -((nav ? nav.getBoundingClientRect().bottom : 100) + rail.offsetHeight + 28) : -110;
    // блок ещё может стоять со сдвигом проявления (translate 16px) — целимся в его место без сдвига
    const ty = parseFloat(String(getComputedStyle(el).translate || '').split(' ')[1]) || 0;
    const y = el.getBoundingClientRect().top + scrollY - ty + off;
    el.classList.add('is-in');
    if (window.lenis) window.lenis.scrollTo(y, { duration: 1.1, force: true });
    else scrollTo({ top: y, behavior: RM() ? 'instant' : 'smooth' });
    history.replaceState(null, '', a.hash);
  });
});
})();
