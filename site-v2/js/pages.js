/* Safa One — общее поведение внутренних страниц (ТЗ_страницы.md §1.12).
   Модули включаются по разметке (data-* и классы), каждый в своём try/catch: ошибка одного не ломает остальные.
   Страничные сцены (fleetStory, fleetRail, gpsTrip, payPath, docsToc) регистрируются через window.SafaPages.add(name, fn)
   из своего файла js/p-*.js, подключённого ПОСЛЕ pages.js (тоже defer); pages.js запускает их после общих модулей. */
(() => {
const root = document.documentElement;
const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(pointer: fine)');
const run = (name, fn) => { try { fn(); } catch (e) { if (window.console) console.warn('[pages] ' + name, e); } };
const extra = [];
const API = window.SafaPages = {
  reduce: () => reduce.matches, $, $$, add: (name, fn) => extra.push([name, fn]),
  /** наблюдатель «один раз»: cb(el) когда el виден на долю ratio (по умолчанию — порог reveal) */
  once(els, cb, opt = {}){
    els = [].concat(els).filter(Boolean); if (!els.length) return;
    if (!('IntersectionObserver' in window)){ els.forEach(cb); return; }
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting && e.intersectionRatio >= (opt.threshold || 0)){ io.unobserve(e.target); cb(e.target); }
    }), { rootMargin: opt.rootMargin || '0px 0px -12% 0px', threshold: opt.threshold || 0 });
    els.forEach(el => io.observe(el));
  },
  scrollTo(el, opt = {}){
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return false;
    // отступ сверху — scroll-margin-top цели (.pg [id] = 110 px; страница может задать свой), иначе 110
    const L = window.lenis, off = opt.offset ?? -(parseFloat(getComputedStyle(el).scrollMarginTop) || 110);
    if (L) L.scrollTo(el, { offset: off, duration: opt.duration ?? 1.1, force: true });
    else scrollTo({ top: el.getBoundingClientRect().top + scrollY + off, behavior: reduce.matches ? 'instant' : 'smooth' });
    return true;
  },
  fmt: n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')   // разряды U+202F
};

/* ---------- неразрывные пробелы: после коротких предлогов/союзов, перед тире ---------- */
run('typo', () => {
  const SHORT = /(^|[\s(«„"])(в|и|а|с|к|о|у|я|на|по|от|до|из|за|для|не|или|без|при|но|же|ли) /gi;
  const nb = s => s.replace(SHORT, '$1$2 ').replace(SHORT, '$1$2 ').replace(/ (—|–) /g, ' $1 ')
    // названия продуктов не рвём: «Safa Fleet», «приложение Safa», «SAFA ONE»
    .replace(/\b(Safa|SAFA) (Fleet|GPS|PAY|Pay|One|ONE)\b/g, '$1 $2').replace(/(приложени(?:е|я|ю|ем|и)) Safa\b/g, '$1 Safa');
  const c = $('.pg-canvas'); if (!c) return;
  const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode.closest('script,style,svg,[aria-hidden="true"],input,textarea,[data-raw]') ? 2 : 1 });
  for (let n; (n = tw.nextNode());){ const t = nb(n.data); if (t !== n.data) n.data = t; }
});

/* ---------- ленивые картинки (site.css прячет img[loading=lazy] до .is-ok) ---------- */
run('lazy', () => $$('img[loading=lazy]').forEach(img => {
  const ok = () => img.classList.add('is-ok');
  if (img.complete) ok(); else { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', ok, { once: true }); }
}));

/* ---------- меню: всегда светлое, выпадашка, бургер, язык ---------- */
let closeMenus = () => {};
run('nav', () => {
  const nav = $('#nav'); if (!nav) return;
  nav.classList.add('is-light');
  const ddBtn = $('.nav__dd > button', nav), drop = $('#drop-products');
  const setDrop = open => { if (!ddBtn || !drop) return; ddBtn.setAttribute('aria-expanded', open); drop.classList.toggle('is-open', open); };
  if (ddBtn && drop){
    ddBtn.addEventListener('click', () => setDrop(ddBtn.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('click', e => { if (!e.target.closest('.nav__dd')) setDrop(false); });
    // фокус ушёл из выпадашки клавиатурой — закрываем
    $('.nav__dd', nav).addEventListener('focusout', e => { if (!e.currentTarget.contains(e.relatedTarget) && e.relatedTarget) setDrop(false); });
  }
  const burger = $('.burger', nav), mnav = $('#mnav'), page = $('.page');
  const setMobile = open => {
    if (!burger || !mnav) return;
    burger.setAttribute('aria-expanded', open); mnav.classList.toggle('is-open', open);
    const t = $('.burger__t', burger); if (t) t.textContent = open ? 'Закрыть' : 'Меню';
    mnav.inert = !open; if (page) page.inert = open;
    if (window.lenis) open ? window.lenis.stop() : window.lenis.start();
    root.style.overflow = open ? 'hidden' : ''; root.classList.toggle('mnav-open', open);
  };
  if (burger && mnav){
    mnav.inert = true;
    burger.addEventListener('click', () => {
      const open = burger.getAttribute('aria-expanded') !== 'true';
      setMobile(open); if (open){ const a = $('a', mnav); if (a) a.focus({ preventScroll: true }); }
    });
    matchMedia('(min-width: 1366px)').addEventListener('change', e => { if (e.matches && burger.getAttribute('aria-expanded') === 'true') setMobile(false); });
  }
  closeMenus = () => { setDrop(false); if (burger && burger.getAttribute('aria-expanded') === 'true') setMobile(false); };
  addEventListener('pageshow', e => { if (e.persisted) closeMenus(); });   // вернулись «назад» из bfcache — меню не должно остаться открытым (как на главной)
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (drop && drop.classList.contains('is-open')){ setDrop(false); ddBtn.focus(); }
    if (mnav && mnav.classList.contains('is-open')){ setMobile(false); burger.focus(); }
  });
  // RU/UZ: пока меняет только aria-pressed (перевода страниц нет); выбор общий с главной — localStorage 'safa-lang' (js/site.js)
  const setLang = l => $$('[data-lang]').forEach(x => x.setAttribute('aria-pressed', x.dataset.lang === l));
  $$('[data-lang]').forEach(b => b.addEventListener('click', () => {
    setLang(b.dataset.lang);
    try { localStorage.setItem('safa-lang', b.dataset.lang); } catch (e) {}
  }));
  let lang = null; try { lang = localStorage.getItem('safa-lang'); } catch (e) {}
  if (lang === 'ru' || lang === 'uz') setLang(lang);
});

/* ---------- Lenis и якоря ---------- */
run('lenis', () => {
  // как на главной (js/site.js): на касаниях Lenis не создаём — не сглаживает, а touch-слушатели вешает блокирующие;
  // ?lenis=0 — без Lenis для сравнения (помнится во вкладке), ?lenis=1 — вернуть; «уменьшить движение» снимает и возвращает его без перезагрузки
  const off = (() => {
    const q = new URLSearchParams(location.search).get('lenis');
    try { if (q === '0' || q === '1') sessionStorage.setItem('safa-lenis', q); return (q || sessionStorage.getItem('safa-lenis')) === '0'; }
    catch (e) { return q === '0'; }
  })();
  const coarse = matchMedia('(pointer: coarse)');
  let lenisRaf = 0;
  const setSmooth = () => {
    if (window.Lenis && !window.lenis && !reduce.matches && !coarse.matches && !off){
      const lenis = window.lenis = new Lenis({ lerp: .075 });
      const loop = t => { lenis.raf(t); lenisRaf = requestAnimationFrame(loop); };
      lenisRaf = requestAnimationFrame(loop);
    } else if (window.lenis && reduce.matches){
      cancelAnimationFrame(lenisRaf); window.lenis.destroy(); window.lenis = null;
    }
  };
  setSmooth(); reduce.addEventListener('change', setSmooth);
});
run('anchors', () => {
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || url.hash.length < 2) return;
    let el = null; try { el = document.querySelector(decodeURIComponent(url.hash)); } catch (_) {}
    if (!el) return;
    e.preventDefault(); closeMenus();
    API.scrollTo(el);
    history.pushState(null, '', url.hash);
    if (!el.matches('a,button,input,textarea,select,summary,[tabindex]')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });
  // пришли с другой страницы с якорем: доезжаем с поправкой на меню после загрузки шрифтов
  if (location.hash.length > 1){
    let el = null; try { el = document.querySelector(decodeURIComponent(location.hash)); } catch (_) {}
    if (el){
      // форма с ?intent: всегда к #lead
      const go = () => { const y = el.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 110); window.lenis ? window.lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y); };
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(go));
    }
  }
});

/* ---------- появление: маски строк, блоки, предметы ---------- */
run('reveal', () => {
  // номера строк маски: --k по порядку внутри [data-mask]
  $$('[data-mask]').forEach(m => $$('.ln', m).forEach((ln, i) => ln.style.setProperty('--k', i)));
  // шаг 80 ms внутри группы
  $$('[data-rv-group]').forEach(g => $$('[data-rv]', g).forEach((el, i) => el.style.setProperty('--k', i)));
  const all = $$('[data-mask],[data-rv],[data-rv-og],.pg-obj,.pg-steps,.pg-path');
  if (reduce.matches){ all.forEach(el => el.classList.add('is-in')); return; }
  API.once(all, el => el.classList.add('is-in'));
});

/* ---------- вес стекла: параллакс предмета героя ±24 px, тень сжимается при подъёме ---------- */
run('weight', () => {
  const objs = $$('.pg-obj'); if (!objs.length || reduce.matches) return;
  const vis = new Set();
  // gps: при входе в экран пересчитать сразу — иначе после быстрого возврата (якорь, Lenis immediate) остаётся старый подъём −24 px
  const io = new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? vis.add(e.target) : vis.delete(e.target)); req(); });
  objs.forEach(o => io.observe(o));
  let raf = 0;
  const tick = () => {
    raf = 0;
    vis.forEach(o => {
      const r = o.getBoundingClientRect(), c = r.top + r.height / 2, h = innerHeight;
      // центр предмета от центра экрана вверх к верхнему краю: 0 → 1 (подъём до 24 px); ниже центра — стоит на земле
      const lift = Math.max(0, Math.min(1, (h / 2 - c) / (h / 2)));
      o.style.setProperty('--py', (-24 * lift).toFixed(2) + 'px');
      o.style.setProperty('--lift', lift.toFixed(3));
    });
  };
  const req = () => { if (!raf) raf = requestAnimationFrame(tick); };
  addEventListener('scroll', req, { passive: true }); addEventListener('resize', req); req();
});

/* ---------- копирование: [data-copy="текст"]; data-copy-fine — только при точном указателе (на касании ссылка звонит) ---------- */
run('copy', () => {
  const live = document.createElement('p'); live.className = 'sr'; live.setAttribute('aria-live', 'polite'); document.body.append(live);
  $$('[data-copy]').forEach(el => {
    el.addEventListener('click', async e => {
      if (el.hasAttribute('data-copy-fine') && !fine.matches) return;
      e.preventDefault();
      const text = el.dataset.copy, msg = el.dataset.copyTip || 'Скопировано';
      try { await navigator.clipboard.writeText(text); }
      catch (_){ const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.append(t); t.select(); try { document.execCommand('copy'); } catch (__){} t.remove(); }
      let tip = $(':scope > .pg-tip', el);
      if (!tip){ tip = document.createElement('span'); tip.className = 'pg-tip'; tip.setAttribute('aria-hidden', 'true'); el.append(tip); if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; }
      tip.textContent = msg; el.classList.add('is-copied'); live.textContent = msg;
      clearTimeout(el._t); el._t = setTimeout(() => { el.classList.remove('is-copied'); live.textContent = ''; }, 1800);
    });
  });
});

/* ---------- формы: проверка по месту, mailto (или POST при data-endpoint), состояние «Письмо готово.» ---------- */
run('form', () => {
  const toDigits = v => { let d = v.replace(/\D/g, ''); if (d.length > 9 && d.startsWith('998')) d = d.slice(3); return d.slice(0, 9); };
  const group = d => [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
  const caretAfter = (s, n) => { if (n <= 0) return 0; let c = 0; for (let i = 0; i < s.length; i++) if (/\d/.test(s[i]) && ++c === n) return i + 1; return s.length; };
  const RULES = {
    name: el => el.value.trim().length >= 2 || 'Напишите имя',
    fio: el => el.value.trim().length >= 2 || 'Напишите ФИО',
    phone: el => toDigits(el.value).length === 9 || 'Нужно 9 цифр после +998',
    consent: el => el.checked || 'Нужно согласие на обработку данных',
    confirm: el => el.checked || 'Подтвердите, что это ваш аккаунт',
    req: el => el.value.trim().length > 0 || 'Заполните поле'
  };
  $$('form.pg-form').forEach(form => {
    const live = $('[data-live]', form) || (() => { const p = document.createElement('p'); p.className = 'sr'; p.setAttribute('aria-live', 'polite'); form.append(p); return p; })();
    const done = form.dataset.done ? document.getElementById(form.dataset.done) : form.nextElementSibling?.classList.contains('pg-done') ? form.nextElementSibling : null;
    const errOf = el => { const id = (el.getAttribute('aria-describedby') || '').split(' ')[0]; return id ? document.getElementById(id) : null; };

    // телефон: «+998» — префикс, в поле 9 цифр «90 123 45 67»
    $$('.pg-pf__in[type=tel]', form).forEach(phone => {
      const applyTel = (raw, left) => {
        const d = toDigits(raw), all = raw.replace(/\D/g, '');
        if (all.length > 9 && all.startsWith('998')) left = Math.max(0, left - 3);
        phone.value = group(d);
        const p = caretAfter(phone.value, Math.min(left, d.length));
        if (document.activeElement === phone) phone.setSelectionRange(p, p);
      };
      phone.addEventListener('beforeinput', e => {
        const s = phone.selectionStart, v = phone.value; if (s !== phone.selectionEnd) return;
        if (e.inputType === 'deleteContentBackward' && s > 1 && v[s - 1] === ' '){ e.preventDefault(); const nv = v.slice(0, s - 2) + v.slice(s); applyTel(nv, nv.slice(0, s - 2).replace(/\D/g, '').length); }
        else if (e.inputType === 'deleteContentForward' && v[s] === ' '){ e.preventDefault(); applyTel(v.slice(0, s) + v.slice(s + 2), v.slice(0, s).replace(/\D/g, '').length); }
      });
      phone.addEventListener('input', () => applyTel(phone.value, phone.value.slice(0, phone.selectionStart).replace(/\D/g, '').length));
      const pre = phone.parentNode.querySelector('.pg-pf__pre');
      if (pre) pre.addEventListener('mousedown', e => { e.preventDefault(); phone.focus(); const n = phone.value.length; phone.setSelectionRange(n, n); });
      // ширина постоянная — по плейсхолдеру в табличных цифрах
      const sizeTel = () => {
        if (form.classList.contains('pg-form--fields')) return;
        const s = document.createElement('span'); s.textContent = phone.placeholder;
        s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit;letter-spacing:inherit;font-variant-numeric:tabular-nums';
        phone.parentNode.append(s); phone.style.width = `${Math.ceil(s.getBoundingClientRect().width / (s.currentCSSZoom || 1)) + 1}px`; phone.style.minWidth = '0'; s.remove();
      };
      sizeTel(); (document.fonts ? document.fonts.ready : Promise.resolve()).then(sizeTel); addEventListener('resize', sizeTel);
    });

    // выбор role=radio: стрелки и пробел, значение в скрытом input[name]
    $$('[role=radiogroup]', form).forEach(g => {
      const rs = $$('[role=radio]', g), hid = g.dataset.name ? form.elements[g.dataset.name] : null;
      const pick = (r, focus) => { rs.forEach(x => { const on = x === r; x.setAttribute('aria-checked', on); x.tabIndex = on ? 0 : -1; }); if (hid) hid.value = r.dataset.value || r.textContent.trim(); if (focus) r.focus(); };
      rs.forEach((r, i) => {
        r.addEventListener('click', () => pick(r));
        r.addEventListener('keydown', e => {
          const k = e.key; let j = null;
          if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % rs.length;
          if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + rs.length) % rs.length;
          if (k === ' ' || k === 'Enter'){ e.preventDefault(); pick(r); return; }
          if (j !== null){ e.preventDefault(); pick(rs[j], true); }
        });
      });
      pick(rs.find(r => r.getAttribute('aria-checked') === 'true') || rs[0]);
    });

    // автоширина полей фразы без field-sizing
    if (!CSS.supports('field-sizing', 'content')){
      const fit = el => { const s = document.createElement('span'); s.textContent = el.value || el.placeholder; s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit;letter-spacing:inherit'; el.parentNode.append(s); el.style.width = `${Math.ceil(s.getBoundingClientRect().width / (s.currentCSSZoom || 1)) + 2}px`; s.remove(); };
      $$('.pg-form__text input.pg-pf', form).forEach(el => { fit(el); el.addEventListener('input', () => fit(el)); });
      // textarea: в фразе ширина как у поля (дальше перенос), высота — по содержимому; у подписанного поля — только высота
      $$('textarea.pg-pf', form).forEach(el => {
        const grow = () => { if (el.closest('.pg-form__text')) fit(el); el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; };
        grow(); el.addEventListener('input', grow); addEventListener('resize', grow);
        form.addEventListener('reset', () => requestAnimationFrame(grow));
        if (document.fonts) document.fonts.ready.then(grow);
      });
    }

    const fields = () => $$('[data-v]', form);
    const check = el => {
      const r = RULES[el.dataset.v]; if (!r) return true;
      const res = r(el), ok = res === true, err = errOf(el);
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (err) err.textContent = ok ? '' : res;
      const box = el.closest('.pg-check'); if (box) box.classList.toggle('is-err', !ok);
      return ok;
    };
    fields().forEach(el => {
      const ev = el.type === 'checkbox' ? 'change' : 'blur';
      el.addEventListener(ev, () => { if (el.type === 'checkbox' || el.value) check(el); });
      el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') check(el); });
    });

    const lock = on => { $$('input,textarea', form).forEach(el => { if (el.type === 'checkbox' || el.type === 'radio') el.disabled = on; else el.readOnly = on; }); const b = $('[type=submit]', form); if (b) b.setAttribute('aria-disabled', on); };
    const collect = () => {
      const lines = [];
      $$('[data-label]', form).forEach(el => {
        let v = '';
        if (el.matches('[role=radiogroup]')){ const r = $('[aria-checked="true"]', el); v = r ? (r.dataset.value || r.textContent.trim()) : ''; }
        else if (el.matches('fieldset')){ const r = $('input:checked', el); v = r ? r.value : ''; }
        else if (el.type === 'tel') v = el.value ? '+998 ' + el.value : '';
        else v = el.value.trim();
        if (v) lines.push(`${el.dataset.label}: ${v}`);
      });
      return lines;
    };
    const subject = () => {
      const r = $('[role=radio][aria-checked="true"][data-subject]', form);
      const base = (r && r.dataset.subject) || form.dataset.subject || 'Заявка с сайта';
      return form.dataset.subjectExtra ? `${base}: ${form.dataset.subjectExtra}` : base;
    };
    const showDone = () => {
      if (!done) return;
      form.hidden = true; done.hidden = false;
      if (!done.hasAttribute('tabindex')) done.setAttribute('tabindex', '-1');
      done.focus({ preventScroll: true });
      const h = $('h3,h2', done); live.textContent = h ? h.textContent : 'Готово';
      API.scrollTo(done, { offset: -160, duration: .6 });
    };

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (form.getAttribute('aria-busy') === 'true') return;
      const bad = fields().filter(el => !check(el));
      if (bad.length){ live.textContent = `Проверьте поля: ${bad.length}`; bad[0].focus(); return; }
      const lines = collect();
      if (form.dataset.endpoint){
        form.setAttribute('aria-busy', 'true'); lock(true);
        try {
          const r = await fetch(form.dataset.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: subject(), lines }) });
          if (!r.ok) throw new Error(r.status);
          form.removeAttribute('aria-busy'); lock(false); showDone();
        } catch (_){
          form.removeAttribute('aria-busy'); lock(false);
          live.textContent = 'Не удалось отправить. Позвоните +998 50 333 39 00 или напишите на dev@safaone.uz.';
        }
        return;
      }
      // приёмника заявок нет: открываем письмо, на сервер и в адрес страницы ничего не уходит
      const href = `mailto:dev@safaone.uz?subject=${encodeURIComponent(subject())}&body=${encodeURIComponent(lines.join('\n'))}`;
      location.href = href;
      showDone();
    });

    if (done) $$('[data-reset]', done).forEach(b => b.addEventListener('click', () => {
      form.reset(); fields().forEach(el => { el.removeAttribute('aria-invalid'); const er = errOf(el); if (er) er.textContent = ''; const box = el.closest('.pg-check'); if (box) box.classList.remove('is-err'); });
      $$('[role=radiogroup]', form).forEach(g => { const rs = $$('[role=radio]', g); const def = rs.find(r => r.hasAttribute('data-default')) || rs[0]; def.click(); });
      done.hidden = true; form.hidden = false;
      const first = $('input:not([type=hidden]),textarea', form); if (first) first.focus();
    }));
  });
});

/* ---------- intent: ?intent=park|dev&product=…&service=… выбирает вариант во фразе формы ---------- */
const INTENT = { fleet: 1, gps: 1, pay: 1, dev: 1, park: 1 };   // park — старые ссылки: продукт берётся из product, иначе Fleet
const PRODUCT = { fleet: 'Safa Fleet', gps: 'Safa GPS', pay: 'Safa PAY' };
const SERVICE = { mobile: 'мобильные приложения', web: 'веб-сервисы и платформы', backend: 'backend и API', iot: 'IoT и телематика', ai: 'AI и автоматизация', integrations: 'интеграции' };
run('intent', () => {
  const q = new URLSearchParams(location.search);
  const intent = q.get('intent'), product = q.get('product'), service = q.get('service');
  $$('form.pg-form').forEach(f => {
    if (intent && INTENT[intent]){
      const key = intent === 'park' ? (product && PRODUCT[product] ? product : 'fleet') : intent;
      const r = $(`[role=radio][data-intent="${key}"]`, f); if (r) r.click();
    }
    const extra = (product && PRODUCT[product]) || (service && SERVICE[service]) || '';
    if (extra) f.dataset.subjectExtra = extra;
  });
});

/* ---------- aboutRead: маска строк для свободно текущего абзаца [data-ab-read] (about.html) ----------
   Слова оборачиваются в окна .ab-w (клип) с внутренним span; при появлении окнам одной строки ставится общий --k
   (шаг 80 ms), и они выезжают вверх, как .ln у заголовков. Слово с примыкающей пунктуацией — одно окно.
   Короткие <a>/<b> (< 20 знаков) — одно окно целиком: вводная не рвётся по строкам, у ссылки одна точка фокуса.
   Без JS и при prefers-reduced-motion абзац остаётся как есть. */
run('aboutRead', () => {
  const p = $('[data-ab-read]'); if (!p || reduce.matches) return;
  const pieces = [];                                    // [текст, цепочка предков до абзаца]
  const walk = (node, chain) => [...node.childNodes].forEach(k => {
    if (k.nodeType === 3) pieces.push([k.data, chain]);
    else if (k.nodeType !== 1) return;
    else if (/^(A|B)$/.test(k.tagName) && k.textContent.trim().length < 20) pieces.push([k.textContent.replace(/ +/g, ' '), chain.concat(k)]);
    else walk(k, chain.concat(k));
  });
  walk(p, []);
  const out = document.createDocumentFragment();
  let cur = null;                                       // внутренний span открытого окна; null — после пробела
  const put = (t, chain) => {
    if (!cur){ const w = document.createElement('span'); cur = document.createElement('span'); w.className = 'ab-w'; w.append(cur); out.append(w); }
    let node = document.createTextNode(t);
    for (let i = chain.length - 1; i >= 0; i--){ const c = chain[i].cloneNode(false); c.append(node); node = c; }
    cur.append(node);
  };
  pieces.forEach(([data, chain]) => data.split(/( +)/).forEach(t => {
    if (!t) return;
    if (/^ +$/.test(t)){ out.append(t); cur = null; }   // обычный пробел — граница окна; неразрывный слова не делит
    else put(t, chain);
  }));
  p.replaceChildren(out);
  API.once(p, () => {
    let top = null, k = -1;                             // номер строки — по верхней кромке окна
    $$('.ab-w', p).forEach(w => { const t = Math.round(w.offsetTop); if (top === null || Math.abs(t - top) > 4){ top = t; k++; } w.firstChild.style.setProperty('--k', k); });
    requestAnimationFrame(() => p.classList.add('is-in'));
  });
});

/* ---------- страничные модули (js/p-*.js регистрируют через SafaPages.add) ---------- */
const runExtra = () => extra.splice(0).forEach(([n, fn]) => run(n, fn));
// p-*.js подключены defer после pages.js — они выполнятся до DOMContentLoaded
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runExtra); else setTimeout(runExtra);
API.add = (name, fn) => { extra.push([name, fn]); if (document.readyState !== 'loading') setTimeout(runExtra); };
})();
