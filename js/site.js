/* Safa One — главная: плавный скролл, меню, язык, форма заявки. Сцены разделов — js/scenes.js.
   Фильм в шапке — отдельно, js/film.js. С ним сайт общается двумя событиями:
   safa:lang (сменить язык подписей фильма) и safa:jump (переход по якорю). Фильм в шапке страницу не держит: идёт по времени. */
(() => {
const root = document.documentElement;
const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
const film = document.querySelector('[data-film]');
const nav = document.getElementById('nav');

/* ---------- русский набор: короткие предлоги и союзы не висят в конце строки, тире не начинает строку ----------
   Идёт до scenes.js: тот делит абзац «Почему мы» на слова по обычным пробелам, неразрывный слово не делит */
const SHORT = /(^|[\s(«„"])(в|и|а|с|к|о|у|я|на|по|от|до|из|за|для|не|или|без|при) /gi;
const nb = s => s.replace(SHORT, '$1$2 ').replace(SHORT, '$1$2 ').replace(/ (—|–) /g, ' $1 ');   // дважды: «и в» подряд; текст, вставленный позже, тоже через nb
const canvasEl = document.querySelector('.canvas');
if (canvasEl){
  const tw = document.createTreeWalker(canvasEl, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode.closest('script,style,svg') ? 2 : 1 });
  for (let n; (n = tw.nextNode());){
    const t = nb(n.data);
    if (t !== n.data) n.data = t;
  }
}

/* ---------- ленивые картинки проявляются, когда догрузились (css: img[loading=lazy]) ---------- */
document.querySelectorAll('img[loading=lazy]').forEach(img => {
  const ok = () => img.classList.add('is-ok');
  if (img.complete) ok(); else { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', ok, { once: true }); }
});

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
  const cs = el && getComputedStyle(el), pad = cs ? parseFloat(cs.paddingTop) || 0 : 0;   // у разделов большой верхний отступ — встаём ближе к содержимому
  const y = el ? Math.max(0, el.getBoundingClientRect().top + scrollY + Math.max(0, pad - 120) - (parseFloat(cs.scrollMarginTop) || 0)) : 0;   // без отступа (#why) — scroll-margin, иначе текст под меню
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
// фокус ушёл из выпадашки клавиатурой — закрываем (как на страницах, js/pages.js)
nav.querySelector('.nav__dd').addEventListener('focusout', e => { if (!e.currentTarget.contains(e.relatedTarget) && e.relatedTarget) setDrop(false); });

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
matchMedia('(min-width: 1366px)').addEventListener('change', e => { if (e.matches && burger.getAttribute('aria-expanded') === 'true') setMobile(false); });
function closeMenus(){ setDrop(false); if (burger.getAttribute('aria-expanded') === 'true') setMobile(false); }
addEventListener('pageshow', e => { if (e.persisted) closeMenus(); });   // ушли по ссылке на страницу продукта и вернулись «назад» — меню не должно остаться открытым
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (drop.classList.contains('is-open')){ setDrop(false); ddBtn.focus(); }
  if (mnav.classList.contains('is-open')){ setMobile(false); burger.focus(); }
});

/* текущий раздел: aria-current у пункта меню (подчёркивание стоит постоянно), у продукта — ещё и в выпадашке и мобильном меню.
   Текущий — тот, через который проходит линия на 40% высоты экрана; манифест и футер в меню не входят */
const GROUP = { fleet: 'products', gps: 'products', pay: 'products' };
// продукты ведут на свои страницы (fleet.html…), раздел главной у них в data-sec
const navLinks = [...document.querySelectorAll('.nav a[href^="#"]:not(.nav__logo):not(.nav__cta), .mnav a[href^="#"]:not(.btn), .nav a[data-sec], .mnav a[data-sec]')];
let curSec = null;
function setCurrent(id){
  if (id === curSec) return;
  curSec = id;
  navLinks.forEach(a => (a.dataset.sec ? '#' + a.dataset.sec : a.getAttribute('href')) === '#' + id ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current'));
  id && (GROUP[id] || id) === 'products' ? ddBtn.setAttribute('aria-current', 'true') : ddBtn.removeAttribute('aria-current');   // «Продукты» — кнопка, у неё пункта-якоря нет
}
const secIn = new Set();
const secIo = new IntersectionObserver(es => {
  es.forEach(en => en.isIntersecting ? secIn.add(en.target.id) : secIn.delete(en.target.id));
  setCurrent([...secIn].pop() || null);
}, { rootMargin: '-40% 0px -59% 0px' });
['why', 'products', 'fleet', 'gps', 'pay', 'services', 'process', 'contact'].forEach(id => { const s = document.getElementById(id); if (s) secIo.observe(s); });
// пока форма на экране, кнопка «Обсудить проект» гаснет: она ведёт туда же, где читатель уже стоит
const formWrap = document.querySelector('.ct__formwrap');
if (formWrap) new IntersectionObserver(es => nav.classList.toggle('is-form', es[0].isIntersecting), { rootMargin: '0px 0px -12% 0px' }).observe(formWrap);

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
// номер в табличных цифрах, а canvas их не умеет — меряем строчным span тем же шрифтом
const probe = document.createElement('span');
probe.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;white-space:pre;font-variant-numeric:tabular-nums';
const textW = (el, t) => {
  const cs = getComputedStyle(el);
  probe.style.font = cs.font; probe.style.letterSpacing = cs.letterSpacing; probe.style.fontVariantNumeric = 'tabular-nums';   // шорткат font сбрасывает tnum
  probe.textContent = t;
  el.parentNode.append(probe); const w = probe.getBoundingClientRect().width; probe.remove(); return w;
};
function autosize(el){
  const cs = getComputedStyle(el, el.value ? null : '::placeholder'), fs = parseFloat(cs.fontSize), box = el.closest('.pform__text');
  let w;
  // телефон: ширина маски «+998 90 123 45 67» не меняется ни при фокусе, ни при наборе; растёт только под длинный чужой номер
  if (el === phone) w = Math.ceil(Math.max(textW(el, el.placeholder), el.value ? textW(el, el.value) : 0)) + 1;
  else {
    ruler.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;  // плейсхолдер тоньше набранного — меряем его же начертанием
    ruler.letterSpacing = cs.letterSpacing;
    w = ruler.measureText(el.value || el.placeholder).width + 1;     // поле вплотную к знаку препинания: своих полей у него нет
    if (!el.value) w = Math.max(fs * (el === msg ? 7 : 4), w);       // запас — только у пустого: у короткого имени («Ли») он дал бы щель перед запятой
  }
  el.style.width = `${Math.min(box.clientWidth - fs, w)}px`;
  if (el === msg){ el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
}
const fields = [...form.querySelectorAll('.pf')];
fields.forEach(el => el.addEventListener('input', () => requestAnimationFrame(() => autosize(el))));   // после маски телефона
const sizeAll = () => fields.forEach(autosize);
addEventListener('resize', sizeAll);
document.fonts ? document.fonts.ready.then(sizeAll) : sizeAll();
// кто пишет: «Хочу [подключить парк к Safa] или [заказать разработку]» — радиогруппа прямо во фразе.
// Стрелки переводят выбор (фокус ходит по выбранному, как у обычных радиокнопок), Пробел и Enter — нажатие кнопки
const intents = [...form.querySelectorAll('[role=radio][data-intent]')];
function setIntent(v, focus){
  intents.forEach(b => {
    const on = b.dataset.intent === v;
    b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  form.elements.intent.value = v;
}
intents.forEach((b, i) => {
  b.addEventListener('click', () => setIntent(b.dataset.intent));
  b.addEventListener('keydown', e => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault(); setIntent(intents[(i + d + intents.length) % intents.length].dataset.intent, true);
  });
});
// строка услуги ведёт в форму: «Хочу заказать разработку. Коротко: мобильные приложения.»
document.addEventListener('click', e => {
  const s = e.target.closest('[data-service]');
  if (!s || form.hasAttribute('aria-busy')) return;                   // заявка уходит — её поля не трогаем
  if (form.hidden) resetLead();                                       // заявку уже отправили — открываем новую с этой услугой
  setIntent('dev');
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
// ошибка стоит под своим полем (css: .err:not(:empty)); у согласия квадрат ещё раз покачивается
const consentWrap = form.elements.consent.closest('.check'), liveErrs = document.getElementById('lead-errs');
function validate(name){
  const el = form.elements[name], res = checks[name](el), msg = res === true ? '' : res;
  el.setAttribute('aria-invalid', !!msg);
  document.getElementById('e-' + name).textContent = msg;
  if (name === 'consent'){ consentWrap.classList.remove('is-err'); if (msg){ void consentWrap.offsetWidth; consentWrap.classList.add('is-err'); } }
  return !msg;
}
// на время отправки поля только для чтения, фокус остаётся на кнопке (fieldset disabled снял бы его)
const sendBtn = form.querySelector('[type=submit]');
const lockLead = on => {
  form.querySelectorAll('.pf').forEach(el => el.readOnly = on); form.elements.consent.disabled = on;
  sendBtn.setAttribute('aria-disabled', on);
};
Object.keys(checks).forEach(n => form.elements[n].addEventListener(n === 'consent' ? 'change' : 'blur', () => {
  if (form.elements[n].getAttribute('aria-invalid') === 'true' || form.elements[n].value) validate(n);
}));
// отправка: точки на кнопке → форма сворачивается → «Спасибо» выезжает маской строк. Ответа сервера пока нет — вместо него пауза
let sendT = 0;
form.addEventListener('submit', e => {
  e.preventDefault();
  if (form.hasAttribute('aria-busy')) return;
  const bad = Object.keys(checks).filter(n => !validate(n));
  liveErrs.textContent = bad.map(n => document.getElementById('e-' + n).textContent).join('. ');   // список ошибок — только для читалки
  if (bad.length){ form.elements[bad[0]].focus(); return; }
  const who = form.elements.name.value.trim().split(/\s+/)[0], still = reduceMq.matches;
  done.querySelector('.done__text .ln>span').textContent = nb(`Спасибо, ${who}! Свяжемся с вами по номеру ${phone.value.replace(/ /g, ' ')}.`);
  form.setAttribute('aria-busy', 'true'); lockLead(true); sendBtn.focus({ preventScroll: true });
  const show = () => {
    lockLead(false);
    form.hidden = true; form.removeAttribute('aria-busy'); form.classList.remove('is-gone'); form.style.height = '';
    done.hidden = false; done.querySelector('h3').focus({ preventScroll: true });
    requestAnimationFrame(() => requestAnimationFrame(() => done.classList.add('is-in')));
  };
  sendT = setTimeout(() => {
    if (still) return show();
    form.style.height = `${form.offsetHeight}px`; form.offsetHeight;   // от текущей высоты к нулю
    form.classList.add('is-gone'); form.style.height = '0px';
    sendT = setTimeout(show, 500);
  }, still ? 0 : 900);
});
function resetLead(){
  clearTimeout(sendT); form.reset(); phonePrev = ''; lockLead(false);
  form.removeAttribute('aria-busy'); form.classList.remove('is-gone'); form.style.height = '';
  Object.keys(checks).forEach(n => { form.elements[n].removeAttribute('aria-invalid'); document.getElementById('e-' + n).textContent = ''; });
  consentWrap.classList.remove('is-err'); liveErrs.textContent = '';
  delete msg.dataset.auto; done.classList.remove('is-in'); done.hidden = true; form.hidden = false; setIntent('park'); sizeAll();
}
document.getElementById('lead-again').addEventListener('click', () => { resetLead(); form.elements.name.focus(); });

/* ---------- номер-постер: на компьютере (точный указатель) клик копирует номер, рядом на 1.8 с — «Номер скопирован».
   На телефоне ссылка звонит, как обычная tel:. Не удалось скопировать — тоже обычный переход по tel: ---------- */
const ctPhone = document.querySelector('.ct__phone'), copied = document.querySelector('.ct__copied'), fineMq = matchMedia('(pointer: fine)');
let copiedT = 0;
async function copyText(t){
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {}
  const ta = Object.assign(document.createElement('textarea'), { value: t, readOnly: true });   // без Clipboard API (http, старые браузеры)
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
  ta.remove(); return ok;
}
if (ctPhone && copied) ctPhone.addEventListener('click', e => {
  if (!fineMq.matches || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  copyText(ctPhone.getAttribute('aria-label')).then(ok => {
    if (!ok){ location.href = ctPhone.href; return; }
    clearTimeout(copiedT);
    copied.textContent = 'Номер скопирован'; copied.classList.add('is-on');   // role=status — читалка объявит
    copiedT = setTimeout(() => { copied.classList.remove('is-on'); copiedT = setTimeout(() => copied.textContent = '', 300); }, 1800);
  });
});
})();
