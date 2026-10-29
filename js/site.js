/* Safa One — главная: плавный скролл, меню, язык, форма заявки. Сцены разделов — js/scenes.js.
   Фильм в шапке — отдельно, js/film.js. С ним сайт общается двумя событиями:
   safa:lang (сменить язык подписей фильма) и safa:jump (переход по якорю — фильм не запускает автоход). */
(() => {
const root = document.documentElement;
const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
const film = document.querySelector('[data-film]');
const nav = document.getElementById('nav');

/* ---------- плавный скролл: Lenis, как у vibr. film.js берёт его из window.lenis ---------- */
// включённое «уменьшить движение» снимает сглаживание сразу, без перезагрузки; выключенное — возвращает
let lenisRaf = 0;
function setSmooth(){
  if (window.Lenis && !window.lenis && !reduceMq.matches){
    const lenis = window.lenis = new Lenis({ lerp: .075, wheelMultiplier: .85 });
    const loop = t => { lenis.raf(t); lenisRaf = requestAnimationFrame(loop); };
    lenisRaf = requestAnimationFrame(loop);
  } else if (window.lenis && reduceMq.matches){
    cancelAnimationFrame(lenisRaf); window.lenis.destroy(); window.lenis = null;
  }
}
setSmooth(); reduceMq.addEventListener('change', setSmooth);

/* ---------- переходы по якорям ----------
   Путь через фильм не проматываем: 6 экранов кадров пролетели бы за секунду. Прыгаем сразу, рядом с целью — короткий доезд. */
const filmEnd = () => film ? film.offsetTop + film.offsetHeight - innerHeight : 0;
function jumpTo(hash){
  const el = hash === '#top' ? null : document.querySelector(hash);
  if (hash !== '#top' && !el) return false;
  const pad = el ? parseFloat(getComputedStyle(el).paddingTop) || 0 : 0;   // у разделов большой верхний отступ — встаём ближе к содержимому
  const y = el ? Math.max(0, el.getBoundingClientRect().top + scrollY + Math.max(0, pad - 120)) : 0;
  const fe = filmEnd(), cross = (scrollY < fe) !== (y < fe) || y < fe;   // путь задевает фильм
  document.dispatchEvent(new CustomEvent('safa:jump'));
  const L = window.lenis;
  if (cross){
    const pre = y > scrollY ? Math.max(fe + 1, y - 80) : y + 80;
    if (L){ L.scrollTo(y < fe ? y : pre, { immediate: true, force: true }); if (y >= fe) L.scrollTo(y, { duration: .7, force: true }); }
    else scrollTo({ top: y, behavior: 'instant' });
  } else if (L) L.scrollTo(y, { duration: 1.1, force: true });
  else scrollTo({ top: y, behavior: reduceMq.matches ? 'instant' : 'smooth' });
  if (el) el.focus({ preventScroll: true });
  return true;
}
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const hash = a.getAttribute('href');
  if (hash.length < 2) return;
  closeMenus();
  if (jumpTo(hash)) e.preventDefault();
});

/* ---------- меню: над фильмом — тёмное стекло, над светлыми листами — светлое ----------
   Светлое включается, когда карточка фильма уехала из-под полосы меню. */
let navState = null;
const onScroll = () => {
  const y = scrollY, lightFrom = film ? filmEnd() + innerHeight - (nav.offsetTop + nav.offsetHeight) - 16 : 0;
  const st = y >= lightFrom ? 'light' : y > 8 ? 'solid' : 'top';
  if (st === navState) return;
  navState = st;
  nav.classList.toggle('is-solid', st === 'solid'); nav.classList.toggle('is-light', st === 'light');
};
addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll, { passive: true }); onScroll();

/* выпадающее «Продукты» */
const ddBtn = nav.querySelector('.nav__dd > button'), drop = document.getElementById('drop-products');
const setDrop = open => { ddBtn.setAttribute('aria-expanded', open); drop.classList.toggle('is-open', open); };
ddBtn.addEventListener('click', () => setDrop(ddBtn.getAttribute('aria-expanded') !== 'true'));
document.addEventListener('click', e => { if (!e.target.closest('.nav__dd')) setDrop(false); });

/* мобильное меню */
const burger = nav.querySelector('.burger'), mnav = document.getElementById('mnav'), page = document.querySelector('.page');
const setMobile = open => {
  burger.setAttribute('aria-expanded', open); mnav.classList.toggle('is-open', open);
  burger.querySelector('.burger__t').textContent = open ? 'Закрыть' : 'Меню';
  mnav.inert = !open; page.inert = open;                            // под открытым меню Tab не уходит на страницу
  if (window.lenis) open ? window.lenis.stop() : window.lenis.start();
  root.style.overflow = open ? 'hidden' : ''; root.classList.toggle('mnav-open', open);
};
mnav.inert = true;
burger.addEventListener('click', () => {
  const open = burger.getAttribute('aria-expanded') !== 'true';
  setMobile(open); if (open) mnav.querySelector('a').focus({ preventScroll: true });
});
// окно расширили за порог бургера при открытом меню — закрываем, иначе лист и блокировка скролла остаются
matchMedia('(min-width: 1281px)').addEventListener('change', e => { if (e.matches && burger.getAttribute('aria-expanded') === 'true') setMobile(false); });
function closeMenus(){ setDrop(false); if (burger.getAttribute('aria-expanded') === 'true') setMobile(false); }
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (drop.classList.contains('is-open')){ setDrop(false); ddBtn.focus(); }
  if (mnav.classList.contains('is-open')){ setMobile(false); burger.focus(); }
});

/* ---------- язык ----------
   Пока переводятся только подписи фильма; тексты разделов — на русском, узбекские добавим после вычитки.
   Поэтому lang меняем у секции фильма, а не у всей страницы. */
const LANGS = ['ru', 'uz'];
function setLang(l, save){
  if (!LANGS.includes(l)) l = 'ru';
  if (film) film.lang = l;
  document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === l));
  document.dispatchEvent(new CustomEvent('safa:lang', { detail: l }));
  if (save) try { localStorage.setItem('safa-lang', l); } catch (e) {}
}
document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang, true)));
let saved = null; try { saved = localStorage.getItem('safa-lang'); } catch (e) {}
if (saved && saved !== 'ru') setLang(saved, false);

/* ---------- форма заявки ----------
   Отправки пока нет: после проверки полей показываем «Заявка отправлена». Подключить приём — в submit (fetch на свой адрес). */
const form = document.getElementById('lead'), done = document.getElementById('lead-done');
const phone = form.elements.phone, msg = form.elements.message;
// поля стоят прямо во фразе: ширина растёт по набранному тексту, описание задачи переносится и растёт вниз
const ruler = document.createElement('canvas').getContext('2d');
function autosize(el){
  const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize), box = el.closest('.pform__text');
  ruler.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const w = ruler.measureText(el.value || el.placeholder).width + fs * .5;
  el.style.width = `${Math.min(box.clientWidth - fs, Math.max(fs * (el === msg ? 7 : 4), w))}px`;
  if (el === msg){ el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
}
const fields = [...form.querySelectorAll('.pf')];
fields.forEach(el => el.addEventListener('input', () => requestAnimationFrame(() => autosize(el))));   // после маски телефона
const sizeAll = () => fields.forEach(autosize);
addEventListener('resize', sizeAll);
document.fonts ? document.fonts.ready.then(sizeAll) : sizeAll();
// строка услуги ведёт в форму: «Хочу обсудить мобильные приложения.»
document.addEventListener('click', e => {
  const s = e.target.closest('[data-service]');
  if (!s) return;
  if (form.hidden) resetLead();                                       // заявку уже отправили — открываем новую с этой услугой
  if (msg.value && msg.dataset.auto !== msg.value) return;            // своё описание не затираем
  const name = s.dataset.service;
  msg.value = msg.dataset.auto = /^[А-ЯЁ][а-яё]/.test(name) ? name[0].toLowerCase() + name.slice(1) : name;
  autosize(msg);
});
// маска +998 XX XXX XX XX; каретка остаётся у той же цифры, правка в середине номера не уезжает в конец.
// Чужой или слишком длинный номер не переписываем в узбекский — оставляем как есть, проверка покажет формат.
let phonePrev = '';
phone.addEventListener('input', () => {
  const raw = phone.value, pos = phone.selectionStart ?? raw.length;
  const pre = raw.startsWith('+998') ? 4 : 0;                       // наш же префикс «+998» — по позиции, а не по цифрам
  let d = raw.slice(pre).replace(/\D/g, ''), before = raw.slice(pre, Math.max(pre, pos)).replace(/\D/g, '').length;
  if (!pre && d.length === 12 && d.startsWith('998')){ d = d.slice(3); before = Math.max(0, before - 3); }   // вставили номер с кодом страны
  if (d.length === 10 && phonePrev.replace(/\D/g, '').length === 12){  // лишняя цифра в уже полном номере — не принимаем
    phone.value = phonePrev; phone.setSelectionRange(Math.max(0, pos - 1), Math.max(0, pos - 1)); return;
  }
  if (d.length > 9){ phonePrev = phone.value; return; }
  before = Math.min(before, d.length);
  const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  phone.value = phonePrev = d ? '+998 ' + p.join(' ') : (/^\+?$/.test(raw) ? raw : '');
  if (!d || document.activeElement !== phone) return;
  let i = 5, n = 0;                                                  // 5 — длина «+998 »
  while (n < before && i < phone.value.length){ if (/\d/.test(phone.value[i])) n++; i++; }
  phone.setSelectionRange(i, i);
});
const checks = {
  name: el => el.value.trim().length >= 2 || 'Укажите имя',
  phone: el => /^\+998 \d{2} \d{3} \d{2} \d{2}$/.test(el.value.trim()) || 'Номер: +998 XX XXX XX XX',
  consent: el => el.checked || 'Нужно согласие на обработку данных',
};
function validate(name){
  const el = form.elements[name], res = checks[name](el), msg = res === true ? '' : res;
  el.setAttribute('aria-invalid', !!msg);
  document.getElementById('e-' + name).textContent = msg;
  return !msg;
}
Object.keys(checks).forEach(n => form.elements[n].addEventListener(n === 'consent' ? 'change' : 'blur', () => {
  if (form.elements[n].getAttribute('aria-invalid') === 'true' || form.elements[n].value) validate(n);
}));
form.addEventListener('submit', e => {
  e.preventDefault();
  const bad = Object.keys(checks).filter(n => !validate(n));
  if (bad.length){ form.elements[bad[0]].focus(); return; }
  const who = form.elements.name.value.trim().split(/\s+/)[0];
  done.querySelector('.done__text').textContent = `Спасибо, ${who}! Свяжемся с вами по номеру ${phone.value}.`;
  form.hidden = true; done.hidden = false;
  done.querySelector('h3').focus();
});
function resetLead(){
  form.reset(); phonePrev = '';
  Object.keys(checks).forEach(n => { form.elements[n].removeAttribute('aria-invalid'); document.getElementById('e-' + n).textContent = ''; });
  delete msg.dataset.auto; done.hidden = true; form.hidden = false; sizeAll();
}
document.getElementById('lead-again').addEventListener('click', () => { resetLead(); form.elements.name.focus(); });
})();
