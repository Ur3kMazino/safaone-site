/* Safa PAY — кабинет партнёра: общее поведение трёх страниц.
   Страница определяется по <body data-page="reg|connect|dash">; код страницы — в объекте pages ниже.
   Демо: запросов нет, формы никуда не уходят. Пароль и API-ключ не пишутся ни в хранилище, ни в URL, ни в консоль.
   Наружу отдаётся window.Cab — общие помощники для следующих страниц (см. конец файла). */
(() => {
'use strict';
const d = document, root = d.documentElement, body = d.body;
const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
const NNBSP = ' ', NBSP = ' ';

/* ---------- числа и слова ---------- */
// 1240560000 → «1 240 560 000» (U+202F), 2.13 → «2,13»
function fmt(n, digits = 0){
  const [i, f] = Math.abs(n).toFixed(digits).split('.');
  return (n < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP) + (f ? ',' + f : '');
}
// plural(5, ['вывод','вывода','выводов']) → «выводов»
function plural(n, forms){
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

/* ---------- хранилище: только {park, login}, всё в try/catch ---------- */
const store = {
  get(){ try { const v = JSON.parse(sessionStorage.getItem('cab') || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } },
  set(v){ try { sessionStorage.setItem('cab', JSON.stringify({ park: String(v.park || ''), login: String(v.login || '') })); } catch (e) {} },
};

/* ---------- тост: один на страницу, 3,2 с ---------- */
let toastT = 0;
function toast(msg){
  const t = d.querySelector('.toast');
  if (!t) return;
  clearTimeout(toastT);
  t.textContent = msg; t.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('is-on')));
  toastT = setTimeout(() => { t.classList.remove('is-on'); toastT = setTimeout(() => { t.hidden = true; }, 300); }, 3200);
}

/* ---------- шапка: подложка появляется, когда страница прокручена ---------- */
const head = d.querySelector('.cab-head');
if (head){
  const stick = () => head.classList.toggle('is-stuck', scrollY > 4);
  addEventListener('scroll', stick, { passive: true }); stick();
}

/* ---------- заголовок страницы выезжает маской, мета и лид проявляются ---------- */
requestAnimationFrame(() => requestAnimationFrame(() => d.querySelectorAll('.cab-hero').forEach(h => h.classList.add('is-in'))));

/* ---------- маски ввода: data-mask="phone|inn|account|mfo|date" ----------
   Группы цифр через пробел, лишнее отбрасывается, каретка остаётся у той же цифры.
   Телефон: «+998 …» или «998 …» при вставке срезается до 9 цифр номера. */
const MASKS = { phone: [2, 3, 2, 2], inn: [3, 3, 3], account: [4, 4, 4, 4, 4], mfo: [5], date: [2, 2, 4] };
const MASK_SEP = { date: '.' };   // дата ДД.ММ.ГГГГ — группы через точку, остальные маски через пробел
function applyMask(el, e){
  const groups = MASKS[el.dataset.mask]; if (!groups) return;
  const max = groups.reduce((a, b) => a + b, 0), raw = el.value, pos = el.selectionStart ?? raw.length;
  let dg = raw.replace(/\D/g, ''), before = raw.slice(0, pos).replace(/\D/g, '').length;
  const plus = el.dataset.mask === 'phone' && /^\s*\+/.test(raw);
  if (plus && dg.length <= 3 && '998'.startsWith(dg)){ el._maskPrev = raw; return; }   // набирают «+998» руками — ждём остальные цифры
  if (el.dataset.mask === 'phone' && dg.startsWith('998') && (plus || (dg.length === 12 && dg.length > max))){
    dg = dg.slice(3); before = Math.max(0, before - 3);
  }
  if (dg.length > max){
    const prev = el._maskPrev || '';
    const typed = e && e.inputType && e.inputType.startsWith('insert') && e.inputType !== 'insertFromPaste' && e.inputType !== 'insertFromDrop';
    if (typed && prev.replace(/\D/g, '').length === max){            // лишняя цифра в уже полном значении — не принимаем
      el.value = prev; const p = Math.max(0, pos - 1); el.setSelectionRange(p, p); return;
    }
    dg = dg.slice(0, max);
  }
  before = Math.min(before, dg.length);
  let out = '', i = 0;
  const sep = MASK_SEP[el.dataset.mask] || ' ';
  for (const g of groups){ if (i >= dg.length) break; out += (out ? sep : '') + dg.slice(i, i + g); i += g; }
  el.value = el._maskPrev = out;
  if (d.activeElement === el){
    let k = 0, n = 0;
    while (n < before && k < out.length){ if (/\d/.test(out[k])) n++; k++; }
    el.setSelectionRange(k, k);
  }
}
d.addEventListener('input', e => { if (e.target.matches && e.target.matches('[data-mask]')) applyMask(e.target, e); });

/* ---------- пароль и ключ: «Показать / Скрыть» ----------
   <button class="fld__eye" type="button" data-pw-toggle aria-controls="ID" aria-pressed="false">Показать</button> */
d.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('[data-pw-toggle]');
  if (b && d.activeElement === d.getElementById(b.getAttribute('aria-controls'))) e.preventDefault();   // фокус и каретка остаются в поле
});
d.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-pw-toggle]'); if (!b) return;
  const inp = d.getElementById(b.getAttribute('aria-controls')); if (!inp) return;
  const s = inp.selectionStart, en = inp.selectionEnd, show = inp.type === 'password';
  setSecret(b, inp, show);
  if (d.activeElement === inp && s != null){ try { inp.setSelectionRange(s, en); } catch (err) {} }
});
function setSecret(b, inp, show){
  inp.type = show ? 'text' : 'password';
  b.setAttribute('aria-pressed', String(show));
  b.textContent = show ? 'Скрыть' : 'Показать';
}
function hideSecrets(scope){
  scope.querySelectorAll('[data-pw-toggle]').forEach(b => { const i = d.getElementById(b.getAttribute('aria-controls')); if (i) setSecret(b, i, false); });
}

/* ---------- проверка полей ----------
   Поле: <input data-rule="req|phone|login|pw8|…">, группа: <fieldset data-rule="anyCheck|oneRadio" data-err="…">.
   Сообщение — .fld__msg в той же .fld/.fset: подсказка из data-hint, ошибка подменяет её на том же месте (.is-err).
   Проверка на blur — только у тронутых полей (есть значение или уже ошибка), при вводе ошибка снимается, как только значение верно. */
const rules = {
  req: el => !!el.value.trim() || 'Заполните поле',
  phone: el => { const n = el.value.replace(/\D/g, '').length; return n === 9 || (n ? 'Номер: +998 XX XXX XX XX' : 'Заполните поле'); },
  login: el => !el.value.trim() ? 'Заполните поле' : /\s/.test(el.value) ? 'Логин без пробелов' : true,
  pw8: el => el.value.length >= 8 || 'Не меньше 8 символов',
  anyCheck: fs => [...fs.querySelectorAll('input[type=checkbox]')].some(i => i.checked) || fs.dataset.err || 'Выберите хотя бы один вариант',
  oneRadio: fs => !!fs.querySelector('input[type=radio]:checked') || fs.dataset.err || 'Выберите вариант',
};
const msgOf = el => { const w = el.matches('fieldset') ? el : el.closest('.fld, .fset'); return w && w.querySelector('.fld__msg'); };
function setError(el, msg){
  const m = msgOf(el);
  if (el.matches('fieldset')){
    el.querySelectorAll('input').forEach(i => msg ? i.setAttribute('aria-invalid', 'true') : i.removeAttribute('aria-invalid'));
    const seg = el.querySelector('.seg'); if (seg) seg.classList.toggle('is-invalid', !!msg);
  } else {
    msg ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid');
    const box = el.closest('.fld__box'); if (box) box.classList.toggle('is-invalid', !!msg);
  }
  if (m){ m.classList.toggle('is-err', !!msg); m.textContent = msg || (m.dataset.hint || ''); }
}
const isInvalid = el => el.matches('fieldset') ? !!el.querySelector('[aria-invalid="true"]') : el.getAttribute('aria-invalid') === 'true';
function validate(el){
  const fn = rules[el.dataset.rule]; if (!fn) return true;
  const r = fn(el), msg = r === true ? '' : r;
  setError(el, msg);
  return !msg;
}
function clearErrors(scope){ scope.querySelectorAll('[data-rule]').forEach(el => setError(el, '')); }
function focusField(el){
  const t = el.matches('fieldset') ? el.querySelector('input') : el;
  t.focus({ preventScroll: true });
  t.scrollIntoView({ block: 'center', behavior: reduceMq.matches ? 'auto' : 'smooth' });
}
// подключить форму: проверка, точки на кнопке, затем onValid(form). Возвращает {validate, clear}
function bindForm(form, onValid, wait = 900){
  const list = () => [...form.querySelectorAll('[data-rule]')].filter(el => !el.closest('[hidden]'));
  form.addEventListener('focusout', e => {
    const el = e.target.closest('[data-rule]'); if (!el || el.matches('fieldset')) return;
    if (isInvalid(el) || el.value) validate(el);
  });
  form.addEventListener('input', e => {
    const el = e.target.closest('[data-rule]'); if (el && isInvalid(el)) validate(el);
  });
  form.addEventListener('change', e => {
    const fs = e.target.closest('fieldset[data-rule]'); if (fs && isInvalid(fs)) validate(fs);
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (form.getAttribute('aria-busy') === 'true') return;
    const bad = list().filter(el => !validate(el));
    if (bad.length){ focusField(bad[0]); return; }
    form.setAttribute('aria-busy', 'true');
    setTimeout(() => onValid(form), reduceMq.matches ? Math.min(wait, 300) : wait);
  });
  return { validate: () => list().every(validate), clear: () => clearErrors(form) };
}
// при возврате «назад» из кэша страница не должна остаться в состоянии отправки
addEventListener('pageshow', e => { if (e.persisted) d.querySelectorAll('[aria-busy="true"]').forEach(f => f.removeAttribute('aria-busy')); });

/* ---------- вкладки: role=tablist/tab, стрелки ←/→, Home/End, в Tab-порядке только активная ---------- */
function tabs(list, onSelect){
  const all = () => [...list.querySelectorAll('[role="tab"]')];
  function select(t, focus){
    all().forEach(x => { const on = x === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; });
    if (focus) t.focus();
    onSelect && onSelect(t);
  }
  list.addEventListener('click', e => { const t = e.target.closest('[role="tab"]'); if (t && t.getAttribute('aria-selected') !== 'true') select(t); });
  list.addEventListener('keydown', e => {
    const ts = all(), i = ts.indexOf(d.activeElement); if (i < 0) return;
    const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ts.length - 1 }[e.key];
    if (j === undefined) return;
    e.preventDefault(); select(ts[(j + ts.length) % ts.length], true);
  });
  all().forEach(x => { x.tabIndex = x.getAttribute('aria-selected') === 'true' ? 0 : -1; });
  return { select };
}

/* ---------- страницы ---------- */
const pages = {};

// cabinet.html — регистрация ⇄ вход (#login)
pages.reg = () => {
  const titles = { reg: 'Кабинет партнёра — Safa PAY', login: 'Вход в кабинет — Safa PAY' };
  const h1 = d.getElementById('page-title');
  const regForm = d.getElementById('reg-form'), loginForm = d.getElementById('login-form');
  const forgotBtn = d.getElementById('forgot-btn'), forgot = d.getElementById('forgot');
  const mode = () => (root.dataset.mode === 'login' ? 'login' : 'reg');
  d.title = titles[mode()];

  function setMode(m){
    [regForm, loginForm].forEach(f => {
      f.removeAttribute('aria-busy'); clearErrors(f); hideSecrets(f);
      f.querySelectorAll('[data-secret]').forEach(i => { i.value = ''; });
    });
    forgot.hidden = true; forgotBtn.setAttribute('aria-expanded', 'false');
    if (m === 'login') root.dataset.mode = 'login'; else delete root.dataset.mode;
    d.title = titles[m];
    try { history.replaceState(null, '', m === 'login' ? '#login' : location.pathname + location.search); } catch (e) {}
    if (h1.getBoundingClientRect().top < 0) scrollTo({ top: 0, behavior: reduceMq.matches ? 'auto' : 'smooth' });
    h1.focus({ preventScroll: true });
  }
  d.addEventListener('click', e => {
    const b = e.target.closest('[data-mode-to]'); if (!b) return;
    e.preventDefault(); setMode(b.dataset.modeTo);
  });
  addEventListener('hashchange', () => { const m = location.hash === '#login' ? 'login' : 'reg'; if (m !== mode()) setMode(m); });

  forgotBtn.addEventListener('click', () => {
    const open = forgotBtn.getAttribute('aria-expanded') !== 'true';
    forgotBtn.setAttribute('aria-expanded', String(open)); forgot.hidden = !open;
  });

  bindForm(regForm, f => {
    const park = f.elements.park.value.trim(), login = f.elements.login.value.trim();
    f.elements.password.value = '';                                   // пароль не уходит никуда, в том числе в кэш формы
    store.set({ park, login });
    location.href = f.dataset.next;
  });
  bindForm(loginForm, f => {
    const login = f.elements.login.value.trim(), prev = store.get();
    f.elements.password.value = '';
    store.set({ park: prev && prev.park || '', login });
    location.href = f.dataset.next;
  });
};

// cabinet-dashboard.html — парк и логин из регистрации/входа в шапке и заголовке (цифры кабинета остаются образцом)
pages.dash = () => {
  const s = store.get();
  if (!s) return;
  const ava = d.querySelector('.cab-ava'), name = d.querySelector('.cab-user__name'), t = d.querySelector('#page-title .ln > span');
  if (s.park){
    if (t) t.textContent = s.park;
    d.title = s.park + ' — кабинет Safa PAY';
    // юрлицо и ИНН демо-парка рядом со своим парком не показываем (в хранилище только {park, login})
    d.querySelectorAll('.cab-meta > span:not(.st)').forEach(x => { x.hidden = true; });
    const ini = s.park.split(/\s+/).map(w => (w.match(/[A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ0-9]/) || [''])[0]).join('').slice(0, 2).toUpperCase();
    if (ini && ava) ava.textContent = ini;
  }
  if (s.login && name){ name.textContent = s.login; name.title = s.login; }
};

const run = pages[body.dataset.page];
if (run) run();

/* ---------- общие помощники для страниц подключения и кабинета ---------- */
window.Cab = { fmt, plural, store, toast, rules, validate, setError, clearErrors, bindForm, focusField, applyMask, hideSecrets, tabs, reduceMq, NNBSP, NBSP, pages };
})();

/* ==========================================================================
   cabinet-dashboard.html — кабинет после проверки (data-page="dash").
   Отдельный блок: работает только на дашборде, пользуется window.Cab.
   Данные — <script type="application/json" id="dash-data"> на странице. Запросов нет.
   ========================================================================== */
(() => {
'use strict';
const d = document;
if (d.body.dataset.page !== 'dash' || !window.Cab) return;
const { fmt, plural, toast, tabs, reduceMq } = window.Cab;
const SOM = 'сум', NB = ' ', TS = ' ';
const $ = id => d.getElementById(id);
let data;
try { data = JSON.parse($('dash-data').textContent); } catch (e) { return; }

const live = $('dash-live');
let liveT = 0;
const say = t => { clearTimeout(liveT); live.textContent = ''; liveT = setTimeout(() => { live.textContent = t; }, 80); };
const W_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const M_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const M_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const pad = n => String(n).padStart(2, '0');
const nWd = n => plural(n, ['вывод', 'вывода', 'выводов']);
const el = (tag, cls, txt) => { const e = d.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

/* ---------- кнопки-заглушки демо: тост ---------- */
d.addEventListener('click', e => { const b = e.target.closest('[data-toast]'); if (b) toast(b.dataset.toast); });

/* ---------- период: KPI и график ---------- */
const chart = $('chart'), area = chart.querySelector('.ch__area'), bars = chart.querySelector('.ch__bars');
const gridEl = chart.querySelector('.ch__grid'), yEl = chart.querySelector('.ch__y'), xEl = chart.querySelector('.ch__x');
const tip = $('ch-tip'), title = $('ch-t'), table = $('ch-table'), range = $('wd-range'), kpis = $('kpis'), panel = $('wd-panel');

// точки графика периода: подпись столбца, подсказка, подпись оси X
function points(p){
  return p.v.map((v, i) => {
    const n = p.n[i];
    if (p.kind === 'hour'){
      const part = p.partialLast && i === p.v.length - 1;
      const when = part ? pad(i) + ':00–' + pad(i) + ':30, час идёт' : pad(i) + ':00–' + pad(i + 1) + ':00';
      return { v, n, when, part, row: when };
    }
    const dt = new Date(Date.UTC(p.start[0], p.start[1], p.start[2] + i));
    const day = dt.getUTCDate(), m = dt.getUTCMonth();
    return { v, n, when: W_SHORT[dt.getUTCDay()] + ', ' + day + NB + M_GEN[m], wd: W_SHORT[dt.getUTCDay()], day, m, row: W_SHORT[dt.getUTCDay()] + ', ' + day + ' ' + M_GEN[m] };
  });
}
const mln = v => fmt(v, 1) + NB + 'млн';

function renderKpi(p){
  const k = p.kpi;
  const set = (key, val, unit) => {
    const box = kpis.querySelector('[data-k="' + key + '"]'); box.textContent = '';
    box.append(el('span', '', val)); if (unit) box.append(el('small', '', unit));
  };
  // tail — хвост фразы, который на узких экранах скрыт («к прошлому периоду» → «к прошлому»)
  const sub = (key, txt, up, tail) => { const s = kpis.querySelector('[data-k="' + key + '"]'); s.textContent = txt; if (tail) s.append(el('span', 'w-lg', tail)); s.classList.toggle('delta-up', !!up); };
  set('sum', k.sum, k.sumU + NB + SOM);
  sub('sumS', '↑' + NB + '+' + k.sumD + '% к' + NB + 'прошлому', true, ' периоду');
  set('cnt', fmt(k.cnt));
  sub('cntS', 'у' + NB + fmt(k.drv) + NB + plural(k.drv, ['водителя', 'водителей', 'водителей']));
  set('avg', fmt(k.avg), SOM);
  sub('avgS', '↑' + NB + '+' + k.avgD + '% к' + NB + 'прошлому', true, ' периоду');
  set('drv', fmt(k.drv));
  sub('drvS', 'получали выплаты');
}

let pts = [], cur = 0;
function renderChart(p, grow){
  pts = points(p);
  const slots = p.slots || pts.length, max = p.max, dense = slots > 12;
  let iMax = 0; pts.forEach((t, i) => { if (t.v > pts[iMax].v) iMax = i; });
  chart.style.setProperty('--n', slots);
  // шкала и сетка
  yEl.textContent = ''; gridEl.textContent = '';
  for (let t = 0; t <= max; t += p.step){
    const y = el('span', '', fmt(t)); y.style.bottom = (t / max * 100) + '%'; yEl.append(y);
    if (t > 0){ const g = el('i'); g.style.bottom = (t / max * 100) + '%'; gridEl.append(g); }
  }
  const u = el('span', 'ch__unit', 'млн'); u.style.bottom = '100%'; yEl.append(u);
  // столбцы
  bars.textContent = ''; bars.classList.toggle('ch__bars--dense', dense);
  bars.style.setProperty('--n', slots);
  chart.style.setProperty('--st', dense ? '20ms' : '60ms');
  for (let i = 0; i < slots; i++){
    const t = pts[i];
    if (!t){ bars.append(el('span', 'ch__c ch__c--empty')); continue; }
    const b = el('button', 'ch__c' + (i === iMax ? ' is-max' : '') + (t.part ? ' is-part' : ''));
    b.type = 'button'; b.dataset.i = i; b.tabIndex = -1;
    b.style.setProperty('--v', Math.min(1, t.v / max).toFixed(4));
    b.style.setProperty('--i', i);
    b.setAttribute('aria-label', t.when + ' — ' + mln(t.v) + NB + SOM + ', ' + fmt(t.n) + NB + nWd(t.n));
    b.setAttribute('aria-describedby', 'ch-tip');
    b.append(el('span', 'bar__f'));
    if (i === iMax){ const lv = el('span', 'bar__v', mln(t.v)); lv.setAttribute('aria-hidden', 'true'); b.append(lv); }
    bars.append(b);
  }
  cur = Math.min(cur, pts.length - 1);
  const all = barsList(); if (all[cur]) all[cur].tabIndex = 0;
  // ось X
  xEl.textContent = ''; xEl.style.setProperty('--n', slots);
  xEl.classList.toggle('ch__x--hour', p.kind === 'hour');
  if (p.kind === 'hour'){
    for (let h = 0; h < slots; h += 3){ const s = el('span', h % 6 ? 'ph-hide' : '', pad(h) + ':00'); s.style.gridColumn = String(h + 1); xEl.append(s); }
  } else if (p.ticks){
    p.ticks.forEach((i, j) => { const t = pts[i]; const s = el('span', j === p.ticks.length - 1 ? 'is-end' : (j === p.ticks.length - 2 ? 'ph-hide' : ''), t.day + NB + M_SHORT[t.m]); /* на телефоне предпоследняя подпись налезает на последнюю */ s.style.gridColumn = String(i + 1); xEl.append(s); });
  } else {
    pts.forEach((t, i) => { const s = el('span'); s.append(t.wd); s.append(el('span', 'xl-d', NB + t.day)); s.style.gridColumn = String(i + 1); xEl.append(s); });
  }
  // таблица для скринридера
  table.textContent = '';
  const cap = el('caption', '', p.title + ', ' + p.short); table.append(cap);
  const th = el('thead'), tr = el('tr');
  [p.kind === 'hour' ? 'Час' : 'День', 'Сумма, млн ' + SOM, 'Выводов'].forEach(h => { const c = el('th', '', h); c.scope = 'col'; tr.append(c); });
  th.append(tr); table.append(th);
  const tb = el('tbody');
  pts.forEach(t => { const r = el('tr'); [t.row, fmt(t.v, 1), fmt(t.n)].forEach(v => r.append(el('td', '', v))); tb.append(r); });
  table.append(tb);
  hideTip();
  fitLabel();
  if (grow && !reduceMq.matches){ chart.classList.remove('is-grow'); void chart.offsetWidth; chart.classList.add('is-grow'); }
}
const barsList = () => [...bars.querySelectorAll('button.ch__c')];
// подпись максимума не выходит за край графика: сдвигаем её внутрь на величину выноса
function fitLabel(){
  const lv = bars.querySelector('.bar__v'); if (!lv) return;
  lv.style.removeProperty('--dx');
  const a = area.getBoundingClientRect(), r = lv.getBoundingClientRect();
  const dx = r.right > a.right ? a.right - r.right : (r.left < a.left ? a.left - r.left : 0);
  if (dx) lv.style.setProperty('--dx', Math.round(dx) + 'px');
}
if (d.fonts && d.fonts.ready) d.fonts.ready.then(fitLabel);

// подсказка у столбца: над вершиной, у крайних столбцов прижата к краю графика
let hot = null;
function showTip(b){
  if (hot && hot !== b) hot.classList.remove('is-hot');
  hot = b; b.classList.add('is-hot');
  const t = pts[+b.dataset.i];
  tip.querySelector('b').textContent = mln(t.v) + NB + SOM;
  tip.querySelector('span').textContent = t.when + ' · ' + fmt(t.n) + NB + nWd(t.n);
  tip.hidden = false; chart.classList.add('has-tip');
  const aw = area.clientWidth, ah = area.clientHeight, cr = b.getBoundingClientRect(), ar = area.getBoundingClientRect();
  const cx = cr.left - ar.left + cr.width / 2, tw = tip.offsetWidth;
  const left = Math.round(Math.max(0, Math.min(cx - tw / 2, aw - tw)));
  // над самым высоким столбцом из тех, что попадают под ширину подсказки, — соседние вершины не закрываются
  let maxV = t.v;
  barsList().forEach(c => {
    const r = c.getBoundingClientRect(), l = r.left - ar.left;
    if (l + r.width > left && l < left + tw) maxV = Math.max(maxV, pts[+c.dataset.i].v);
  });
  const top = ah * (1 - Math.min(1, maxV / chartMax)) - 10;
  tip.style.left = left + 'px';
  tip.style.top = Math.round(top) + 'px';
}
function hideTip(){ tip.hidden = true; chart.classList.remove('has-tip'); if (hot){ hot.classList.remove('is-hot'); hot = null; } }
bars.addEventListener('pointerover', e => { const b = e.target.closest('button.ch__c'); if (b) showTip(b); });
// касание: Safari не ставит фокус на кнопку, а pointerleave приходит сразу после отрыва пальца — подсказку прячем только для мыши
bars.addEventListener('pointerleave', e => { if (e.pointerType !== 'mouse') return; const f = d.activeElement; if (f && f.matches && f.matches('button.ch__c') && bars.contains(f)) showTip(f); else hideTip(); });
bars.addEventListener('pointercancel', hideTip);   // палец повёл страницу — это прокрутка, а не выбор столбца
d.addEventListener('pointerdown', e => { if (hot && e.pointerType !== 'mouse' && !bars.contains(e.target)) hideTip(); }, { passive: true });   // касание вне графика закрывает подсказку
bars.addEventListener('focusin', e => { const b = e.target.closest('button.ch__c'); if (b){ cur = barsList().indexOf(b); showTip(b); } });
bars.addEventListener('focusout', e => { if (!bars.contains(e.relatedTarget)) hideTip(); });
bars.addEventListener('keydown', e => {
  const all = barsList(), i = all.indexOf(d.activeElement); if (i < 0) return;
  const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: all.length - 1 }[e.key];
  if (e.key === 'Escape'){ hideTip(); return; }
  if (j === undefined) return;
  e.preventDefault();
  const k = Math.max(0, Math.min(all.length - 1, j));
  all.forEach((b, n) => { b.tabIndex = n === k ? 0 : -1; });
  all[k].focus();
});
addEventListener('resize', () => { fitLabel(); if (hot) showTip(hot); }, { passive: true });

let chartMax = 400, swapT = 0, first = true;
function setPeriod(key){
  const p = data[key]; if (!p) return;
  chartMax = p.max;
  const apply = () => {
    renderKpi(p);
    range.textContent = p.range;
    title.textContent = p.title;
    kpis.classList.remove('is-swap'); range.classList.remove('is-swap'); title.classList.remove('is-swap');
  };
  if (first){ first = false; apply(); renderChart(p, true); return; }
  kpis.classList.add('is-swap'); range.classList.add('is-swap'); title.classList.add('is-swap');
  clearTimeout(swapT);
  swapT = setTimeout(apply, reduceMq.matches ? 0 : 200);
  cur = 0;
  renderChart(p, true);
  say('Период: ' + p.tab + ', ' + p.short);
}
tabs($('wd-tabs'), t => {
  panel.setAttribute('aria-labelledby', t.id);
  setPeriod(t.dataset.p);
});
// старт: 7 дней (вкладка уже выбрана в разметке), график растёт, когда раздел попадает в кадр
const startKey = ($('wd-tabs').querySelector('[aria-selected="true"]') || {}).dataset.p || 'week';
chartMax = data[startKey].max;
if ('IntersectionObserver' in window && !reduceMq.matches){
  renderChart(data[startKey], false); first = false;
  chart.classList.add('is-wait');
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)){ io.disconnect(); chart.classList.remove('is-wait'); chart.classList.add('is-grow'); } }, { threshold: .35 });
  io.observe(chart.querySelector('.ch__box'));
} else { setPeriod(startKey); }

/* ---------- подтверждение активных водителей ---------- */
const S = { stage: 'idle', confirmed: false };
const MAX = 6 * 1024 * 1024;
const up = $('cf-up'), drop = $('cf-drop'), file = $('cf-file'), err = $('cf-err'), doneFile = $('cf-done-file');
const go = $('cf-go'), goT = $('cf-go-t'), goWhy = $('cf-go-why'), goArr = go.querySelector('svg.arr');
const flow = $('cf-flow'), done = $('cf-done'), h2 = $('cf-h'), h2t = $('cf-h-t'), st = $('cf-st'), txt = $('cf-txt'), cancel = $('cf-cancel');
const size = b => b < 1024 * 1024 ? fmt(Math.max(1, Math.round(b / 1024))) + NB + 'КБ' : fmt(b / 1048576, 1) + NB + 'МБ';

function setStage(stage, f){
  S.stage = stage;
  const loaded = stage === 'uploaded';
  up.hidden = loaded; doneFile.hidden = !loaded;
  err.textContent = ''; drop.classList.remove('is-invalid', 'is-over');
  if (loaded){
    // имя в одну строку: длинное обрезается многоточием, расширение остаётся видно; размер — в строке под именем
    const name = f ? f.name : 'voditeli_taksopark1.xlsx', dot = name.lastIndexOf('.');
    const fn = $('cf-fname'); fn.textContent = ''; fn.title = name;
    fn.append(el('span', 'files__base', dot > 0 ? name.slice(0, dot) : name), el('span', 'files__ext', dot > 0 ? name.slice(dot) : ''));
    const tally = 'активных' + NB + '1' + TS + '117, неактивных' + NB + '31';
    $('cf-fmeta').textContent = f
      ? size(f.size) + ' · В' + NB + 'демо файл не' + NB + 'разбирается — итоги условные: ' + tally
      : '1' + TS + '148' + NB + plural(1148, ['строка', 'строки', 'строк']) + ': ' + tally;
  }
  go.disabled = !loaded;
  goT.textContent = loaded ? 'Подтвердить 1' + TS + '117' + NB + 'водителей' : 'Подтвердить водителей';
  goArr.toggleAttribute('hidden', !loaded);
  goWhy.hidden = loaded;
  if (loaded) go.removeAttribute('aria-describedby'); else go.setAttribute('aria-describedby', 'cf-go-why');
}
function badFile(msg){
  err.textContent = msg; drop.classList.add('is-invalid');
}
function takeFile(f){
  if (!f) return;
  if (!/\.xlsx$/i.test(f.name)){ badFile('Нужен файл XLSX'); return; }
  if (f.size > MAX){ badFile('Файл больше 6' + NB + 'МБ'); return; }
  setStage('uploaded', f);
  say('Файл загружен: ' + f.name + '. Можно подтвердить 1 117 водителей.');
  $('cf-replace').focus({ preventScroll: true });
}
$('cf-pick').addEventListener('click', () => { file.value = ''; file.click(); });
file.addEventListener('change', () => takeFile(file.files && file.files[0]));
$('cf-sample').addEventListener('click', () => {
  setStage('uploaded');
  say('Пример загружен: voditeli_taksopark1.xlsx, активных 1 117, неактивных 31.');
  $('cf-replace').focus({ preventScroll: true });
});
$('cf-replace').addEventListener('click', () => { setStage('idle'); $('cf-pick').focus(); });
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('is-over'); }));
['dragleave', 'dragend'].forEach(t => drop.addEventListener(t, e => { if (!drop.contains(e.relatedTarget)) drop.classList.remove('is-over'); }));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('is-over'); takeFile(e.dataTransfer && e.dataTransfer.files[0]); });
// файл, брошенный мимо зоны, не должен открываться в браузере
addEventListener('dragover', e => { if (!drop.contains(e.target)) e.preventDefault(); });
addEventListener('drop', e => { if (!drop.contains(e.target)) e.preventDefault(); });

// воронка и задачи раздела «Водители»
function applyConfirmed(){
  const r = $('fun-conf');
  r.querySelector('.fun__b>i').style.setProperty('--w', (1117 / 1148 * 100).toFixed(2) + '%');
  r.querySelector('.fun__n').textContent = '1' + TS + '117';
  r.setAttribute('aria-label', 'Подтверждены в Safa PAY: 1 117 из 1 148');
  const t1 = $('task-new'); t1.textContent = '';
  t1.append(el('span', 'st st--ok', 'Список подтверждён, новых водителей нет'));
  $('task-app-t').textContent = '205' + NB + plural(205, ['водитель', 'водителя', 'водителей']) + ' без приложения';
  st.className = 'st st--ok'; st.textContent = 'Подтверждено';
  h2t.textContent = 'Список активных водителей';
  // шаг 1 при повторной загрузке: новых нет, неактивных 31
  $('cf-p1-n').textContent = '1' + TS + '148' + NB + 'человек, 31' + NB + 'отмечен неактивным';
  txt.textContent = 'Все активные водители подтверждены. Когда в' + NB + 'Fleet появятся новые водители, покажем их здесь.';
}
go.addEventListener('click', () => {
  if (go.disabled || go.classList.contains('is-busy')) return;
  go.classList.add('is-busy'); go.setAttribute('aria-busy', 'true');
  setTimeout(() => {
    go.classList.remove('is-busy'); go.removeAttribute('aria-busy');
    S.confirmed = true; S.stage = 'confirmed';
    applyConfirmed();
    flow.hidden = true; done.hidden = false; cancel.hidden = false;
    h2.focus({ preventScroll: true });
    const top = h2.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * .6) $('confirm').scrollIntoView({ block: 'start', behavior: reduceMq.matches ? 'auto' : 'smooth' });
    say('Подтверждено 1 117 водителей. Выводы включены.');
  }, reduceMq.matches ? 200 : 700);
});
$('cf-again').addEventListener('click', () => {
  setStage('idle');
  done.hidden = true; flow.hidden = false;
  $('cf-pick').focus();
});
// «Отмена» при повторной загрузке — назад к итогу подтверждения, цифры не меняются
cancel.addEventListener('click', () => {
  setStage('confirmed');
  flow.hidden = true; done.hidden = false;
  $('cf-again').focus();
});

// «Подтвердить ↓» — к разделу, фокус на его заголовок
d.addEventListener('click', e => {
  const a = e.target.closest('[data-to-confirm]'); if (!a) return;
  e.preventDefault();
  $('confirm').scrollIntoView({ block: 'start', behavior: reduceMq.matches ? 'auto' : 'smooth' });
  h2.focus({ preventScroll: true });
});
})();
