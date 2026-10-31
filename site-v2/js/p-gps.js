/* Safa GPS — страница продукта: сцена «Одна поездка» (gpsTrip).
   Экран iPad — порт microcraft/proto/gps-screen/gps.js (PORT.md §4.1) как gpsScreen(root): { set(d2, snap), measure(), CROSS }.
   ≥1280 — липкая сцена 240vh: прогресс p (0…1) от прокрутки. До 1280 — поездка проигрывается один раз за 6 s при 50% видимости.
   reduced-motion — сразу конечное состояние (08:46, «Стоит», 2,8 км, 5 мин).
   Прогресс сцены p → поездка d2: 0….14 машина стоит в геозоне (08:16 «Вышел на линию»), .14….9 едет (плавный разгон и торможение),
   .9…1 стоит на финише. Рельс времени переключается по тем же порогам; 08:42 — ровно в кадре пересечения пунктира. */
(() => {
const SP = window.SafaPages; if (!SP) return;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ---------- экран диспетчера ---------- */
function gpsScreen(root){
  const R1 = {   // копия img/map_tashkent_route.json, ключ r1
    d: 'M230.5 768.8 L242.8 767.0 L250.8 762.9 L322.9 534.9 L386.6 555.4 L604.8 622.5 L620.2 629.1 L629.3 633.9 L640.7 641.5 L715.2 708.2 L767.0 756.4 L776.1 759.2 L782.0 756.3 L821.7 515.0 L824.5 509.3 L828.6 506.0 L834.0 504.3 L842.4 503.2 L858.2 504.2 L869.3 502.3 L880.0 497.0 L889.0 488.0 L894.4 479.6 L899.6 468.5 L904.8 452.2 L906.6 440.6 L908.5 405.0 L910.5 399.7 L914.8 395.3 L1108.0 280.7 L1121.7 312.5',
    end: [1121.7, 312.5], km: 2.93
  };
  const ZONE = { cx: R1.end[0], cy: R1.end[1], r: 105 };
  const TRIP_MIN = 5, T0 = 8 * 60 + 41 + 40 / 60, M0 = 8 * 60 + 41;   // 2,8 км за 5 мин; старт 08:41:40
  /* одно время на всё: минута часов m; «Поездка» = m − 08:41, поэтому часы и счётчик всегда сходятся.
     08:46 и «5 мин» — только когда машина встала (d2 = 1), в пути — не дальше 08:45 */
  const minAt = d => d >= 1 ? M0 + TRIP_MIN : Math.min(M0 + TRIP_MIN - 1, Math.floor(T0 + TRIP_MIN * d + 1e-6));
  const g = n => root.querySelector(`[data-g="${n}"]`);
  const ipad = root, svg = g('svg'), map = g('map'), dev = root.closest('.gp-dev') || root;
  const plan = g('plan'), cas = g('case'), done = g('done'), zone = g('zone'), zoneTag = g('ztag');
  const gStart = g('start'), gDest = g('dest');
  const veh = g('veh'), arrow = g('arrow'), vehPlate = g('vplate');
  const car = g('car'), mini = g('mini');
  const stTxt = g('stTxt'), stKm = g('stKm'), stMin = g('stMin'), miniV = g('miniV'), clk = g('clk');
  const evZone = g('evZone'), toast = g('toast'), segGo = g('segGo'), segStop = g('segStop');
  const reelT = root.querySelector('.gp-spd__d--t'), tapes = root.querySelectorAll('.gp-spd__tape');
  let d2 = 1, evOn = null, toastOn = null, evT = 0;
  const RM = SP.reduce();
  /* до начала движения часы показывают время первой метки рельса («Вышел на линию», 08:16) — как рельс и строка событий */
  const CLK0 = root.closest('.gp-trip')?.querySelector('.gp-mark time')?.getAttribute('datetime') || '08:16';
  const narrow = () => dev.clientWidth < 560;   // как @container gpdev (max-width:559px)

  /* путь: от r1.end к r1.start, последняя точка r1 (двор внутри геозоны) отброшена */
  const ptsAll = R1.d.match(/-?\d+(\.\d+)?/g).map(Number).reduce((a, v, i) => (i % 2 ? a[a.length - 1].push(v) : a.push([v]), a), []);
  const NS = 'http://www.w3.org/2000/svg', tmp = document.createElementNS(NS, 'path');
  tmp.setAttribute('d', R1.d); svg.append(tmp); const Lfull = tmp.getTotalLength(); tmp.remove();
  const pts = ptsAll.slice(0, -1).reverse();
  const dPath = 'M' + pts.map(p => p.join(' ')).join(' L');
  plan.setAttribute('d', dPath); cas.setAttribute('d', dPath); done.setAttribute('d', dPath);
  const L = done.getTotalLength();
  const KM = R1.km * L / Lfull, M_PER_U = R1.km * 1000 / Lfull;
  const S0 = pts[0];
  gStart.setAttribute('cx', S0[0]); gStart.setAttribute('cy', S0[1]);
  zone.setAttribute('cx', ZONE.cx); zone.setAttribute('cy', ZONE.cy); zone.setAttribute('r', ZONE.r);

  /* d2 пересечения границы геозоны и время события — из тех же часов */
  const outAt = len => { const p = done.getPointAtLength(len); return Math.hypot(p.x - ZONE.cx, p.y - ZONE.cy) > ZONE.r; };
  let lo = 0, hi = L; for (let i = 0; i < 30; i++){ const m = (lo + hi) / 2; outAt(m) ? hi = m : lo = m; }
  const CROSS = hi / L, TOAST_FOR = .25;
  const nb = ' ';
  const hhmm = m => { m = Math.floor(m + 1e-6); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  root.querySelectorAll('.js-evt').forEach(e => e.textContent = hhmm(minAt(CROSS)));

  const fmt1 = x => (Math.floor(x * 10 + 1e-6) / 10).toFixed(1).replace('.', ',');
  const cssv = n => getComputedStyle(root.querySelector('.gp-scr')).getPropertyValue(n).trim();

  /* Камера «следить за машиной» — своя композиция страницы (на главной весь маршрут целиком, здесь кадр крупнее и едет за машиной).
     Масштаб постоянный: ~0,9 px экрана на единицу карты (растр @2x остаётся резким на DPR 2). Центр кадра — среднее точек пути
     чуть впереди машины, пока машина в геозоне — кадр держит геозону целиком; машина не ближе полей к краю; растр всегда покрывает экран.
     Кадр — чистая функция d2: таблица CAM на N шагов, между шагами линейно; прокрутка назад даёт тот же кадр. */
  const N = 240;
  let CAM = null, vw = 0, vh = 0;
  function frame(){
    const W = map.clientWidth, H = map.clientHeight, n = narrow();
    if (!W || !H) return false;
    const sCover = Math.max(W / 1600, H / 1000);
    if (RM){
      /* reduced motion: единственный кадр — весь трек вместе с геозоной «Центр», стартом и финишем; камера не движется */
      const xs = pts.map(q => q[0]).concat(ZONE.cx - ZONE.r, ZONE.cx + ZONE.r);
      const ys = pts.map(q => q[1]).concat(ZONE.cy - ZONE.r, ZONE.cy + ZONE.r);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const pad = n ? 26 : 48, topR = n ? 44 : 30;              // сверху статус-бар (на узком — мини-карточка)
      const sR = Math.max(sCover, Math.min((W - 2 * pad) / (x1 - x0), (H - topR - 2 * pad) / (y1 - y0)));
      vw = W / sR; vh = H / sR;
      const c = [clamp((x0 + x1) / 2, vw / 2, 1600 - vw / 2), clamp((y0 + y1) / 2 - topR / sR / 2, vh / 2, 1000 - vh / 2)];
      CAM = Array(N + 1).fill(c);
      return true;
    }
    const s = Math.max(sCover, n ? W / 430 : Math.min(1, Math.max(.6, W / 640)));
    const w = W / s, h = H / s; vw = w; vh = h;
    const top = (n ? 10 : 30) / s;                              // сверху статус-бар
    const mx = (n ? 34 : 56) / s, my = (n ? 30 : 48) / s;      // поле вокруг машины
    const zm = (n ? 8 : 14) / s;                                // поле вокруг геозоны
    const HW = .34 * w;
    const fit = (v, a, b) => a <= b ? clamp(v, a, b) : (a + b) / 2;
    const raw = [];
    for (let i = 0; i <= N; i++){
      const d = i / N, len = d * L;
      let sx = 0, sy = 0;
      for (let j = 0; j <= 16; j++){ const q = done.getPointAtLength(clamp(len - .45 * HW + j / 16 * 1.45 * HW, 0, L)); sx += q.x; sy += q.y; }
      let cx = sx / 17, cy = sy / 17;
      // геозона целиком в кадре до выезда и чуть после, дальше кадр отпускает её плавно
      const hold = d <= CROSS ? 1 : clamp(1 - (d - CROSS) / .1);
      if (hold > 0){
        const zx = fit(cx, ZONE.cx + ZONE.r + zm - w / 2, ZONE.cx - ZONE.r - zm + w / 2);
        const zy = fit(cy, ZONE.cy + ZONE.r + zm - h / 2, ZONE.cy - ZONE.r - zm - top + h / 2);
        cx += (zx - cx) * hold; cy += (zy - cy) * hold;
      }
      raw.push([cx, cy]);
    }
    // сглаживание по времени и ограничения: машина с полями, растр покрывает экран
    const lim = (c, i) => {
      const q = done.getPointAtLength(i / N * L);
      let [cx, cy] = c;
      cx = fit(cx, q.x + mx - w / 2, q.x - mx + w / 2);
      cy = fit(cy, q.y + my - h / 2, q.y - my - top + h / 2);
      return [clamp(cx, w / 2, 1600 - w / 2), clamp(cy, h / 2, 1000 - h / 2)];
    };
    let cam = raw.map(lim);
    for (let pass = 0; pass < 2; pass++){
      cam = cam.map((_, i) => { let ax = 0, ay = 0, c = 0; for (let j = -8; j <= 8; j++){ const k2 = clamp(i + j, 0, N); ax += cam[k2][0]; ay += cam[k2][1]; c++; } return lim([ax / c, ay / c], i); });
    }
    CAM = cam;
    return true;
  }
  function camAt(d){
    const f = clamp(d) * N, i = Math.min(N - 1, Math.floor(f)), t = f - i, a = CAM[i], b = CAM[i + 1];
    const cx = a[0] + (b[0] - a[0]) * t, cy = a[1] + (b[1] - a[1]) * t;
    svg.setAttribute('viewBox', `${(cx - vw / 2).toFixed(2)} ${(cy - vh / 2).toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}`);
  }

  /* масштаб экрана: px на единицу карты; k — во сколько раз экран увеличен (zoom экрана iPad и трансформации появления) */
  let k = 1, s = 1, ready = false;
  const scaleEl = root.querySelector('.gp-scale i'), scaleTx = root.querySelector('.gp-scale span');
  const scrEl = root.querySelector('.gp-scr');
  function measure(){
    // экран шире 800 px — интерфейс растёт целиком (zoom), колонка и карта в тех же долях, что на 1440
    const z = narrow() ? 1 : clamp((ipad.clientWidth - 24) / 800, 1, 1.4);
    if (Math.abs(z - (parseFloat(scrEl.style.zoom) || 1)) > .004) scrEl.style.zoom = z.toFixed(3);
    if (!frame()) return;
    camAt(d2);
    const ctm = svg.getScreenCTM(); if (!ctm) return;
    s = ctm.a;
    k = map.getBoundingClientRect().width / map.clientWidth || 1;
    const u = px => (px * k) / s;                             // CSS-px экрана → единицы карты
    plan.style.strokeWidth = u(+cssv('--w-plan'));
    cas.style.strokeWidth = u(+cssv('--w-case'));
    done.style.strokeWidth = u(+cssv('--w-line'));
    zone.style.strokeWidth = u(+cssv('--w-zone'));
    zone.style.strokeDasharray = cssv('--zone-dash').split(/\s+/).map(v => u(+v)).join(' ');
    const n = narrow();
    gStart.setAttribute('r', u(n ? 3.5 : 4.5));
    gDest.setAttribute('r', u(n ? 4.5 : 6));
    if (scaleEl){
      const m = 100 / M_PER_U * s / k >= 44 ? 100 : 200;     // линейка 100 м, на мелком экране 200 м
      scaleEl.style.width = (m / M_PER_U * s / k).toFixed(1) + 'px';
      scaleTx.textContent = m + nb + 'м';
    }
    ready = true;
  }
  function toScr(x, y){
    const p = svg.createSVGPoint(); p.x = x; p.y = y;
    const q = p.matrixTransform(svg.getScreenCTM()), r = map.getBoundingClientRect();
    return [(q.x - r.left) / k, (q.y - r.top) / k];
  }
  function placeTag(){
    const t = toScr(ZONE.cx, ZONE.cy + ZONE.r);               // подпись зоны — на нижней кромке
    zoneTag.style.left = t[0] + 'px'; zoneTag.style.top = t[1] + 'px';
  }

  /* лента цифр скорости */
  let lastV = -1;
  const noanim = on => {
    if (on){ root.classList.add('gp-noanim'); requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('gp-noanim'))); }
  };
  function setSpeed(v, snap){
    if (v === lastV) return; lastV = v;
    const t = Math.floor(v / 10), un = v % 10;
    if (snap) noanim(true);
    tapes[0].style.transform = `translateY(${-t}em)`;
    tapes[1].style.transform = `translateY(${-un}em)`;
    reelT.classList.toggle('is-off', v < 10);
    miniV.textContent = v;
  }

  /* угол стрелки со сглаживанием */
  let ang = null, angT = 0, raf = 0;
  function spinTo(a, snap){
    angT = a;
    if (ang === null || snap || RM){ ang = a; arrow.style.transform = `rotate(${ang}deg)`; return; }
    if (!raf) raf = requestAnimationFrame(stepAng);
  }
  function stepAng(){
    raf = 0;
    const d = ((angT - ang + 540) % 360) - 180;
    ang += d * .25;
    if (Math.abs(d) < .2) ang = angT; else raf = requestAnimationFrame(stepAng);
    arrow.style.transform = `rotate(${ang}deg)`;
  }

  /* сторона номера: против хвоста (точка пути на len − 40), гистерезис 8 px; у краёв — ограничения */
  let left = false;
  function plateSide(len, x){
    const tp = done.getPointAtLength(Math.max(0, len - 40)), [tx] = toScr(tp.x, tp.y);
    if (tx > x + 8) left = true; else if (tx < x - 8) left = false;
    const pw = vehPlate.offsetWidth + 18, W = map.clientWidth;
    if (x > W * .7 || x + pw > W - 44) left = true;
    if (x - pw < 4) left = false;
    veh.classList.toggle('is-left', left);
  }

  function render(snap){
    if (!ready) return;
    camAt(d2); placeTag();
    const len = d2 * L;
    done.style.strokeDasharray = `${len} ${L + 1}`;
    cas.style.strokeDasharray = `${len} ${L + 1}`;
    const p = done.getPointAtLength(len);
    const a = done.getPointAtLength(Math.max(0, len - 1.5)), b = done.getPointAtLength(Math.min(L, len + 1.5));
    const [x, y] = toScr(p.x, p.y);
    veh.style.transform = `translate(${x}px,${y}px)`;
    plateSide(len, x);
    spinTo(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90, snap);

    const moving = d2 > 0 && d2 < 1;
    const v = moving ? Math.max(4, Math.round(Math.min(1, d2 / .06, (1 - d2) / .06) * (46 + 6 * Math.sin(d2 * Math.PI * 6)))) : 0;   // «В пути» — не 0 км/ч
    setSpeed(v, snap || RM);
    veh.classList.toggle('is-moving', moving && !RM);
    car.classList.toggle('is-stop', !moving);
    mini.classList.toggle('is-stop', !moving);
    stTxt.textContent = moving ? 'В пути' : 'Стоит';
    segGo.textContent = moving ? 3 : 2;
    segStop.textContent = moving ? 1 : 2;
    stKm.textContent = fmt1(KM * d2) + nb + 'км';
    const mm = minAt(d2);
    stMin.textContent = (d2 > 0 ? mm - M0 : 0) + nb + 'мин';
    clk.textContent = d2 > 0 ? hhmm(mm) : CLK0;

    const out1 = d2 >= CROSS;
    if (snap) noanim(true);
    if (out1 !== evOn){
      evOn = out1;
      evZone.classList.toggle('is-on', out1);
      if (out1 && !snap && !RM){ evZone.classList.remove('is-new'); void evZone.offsetWidth; evZone.classList.add('is-new'); clearTimeout(evT); evT = setTimeout(() => evZone.classList.remove('is-new'), 1250); }
      if (!out1) evZone.classList.remove('is-new');
    }
    /* узкий экран: тост живёт, пока d2 < пересечение + .25, потом сворачивается в значок; при reduced motion — сразу значок */
    const tOn = out1 && !RM && !snap && d2 < CROSS + TOAST_FOR;
    if (tOn !== toastOn){
      toastOn = tOn;
      toast.classList.toggle('is-on', tOn);
      toast.classList.toggle('is-gone', out1 && !tOn);
    }
    if (!out1) toast.classList.remove('is-gone');
    mini.classList.toggle('has-ev', out1 && !tOn);
  }
  function set(v, snap){ d2 = clamp(+v); render(snap); }
  return { set, measure, CROSS, get d2(){ return d2; } };
}

/* ---------- сцена «Одна поездка» ---------- */
SP.add('gpsTrip', () => {
  const trip = SP.$('.gp-trip'); if (!trip) return;
  const ipad = SP.$('.gp-ipad', trip), marks = SP.$$('.gp-mark', trip), rail = SP.$('.gp-rail', trip);
  const scr = gpsScreen(ipad);
  const P1 = .14, P3 = .9;
  // поездка с плавным разгоном и торможением: d2 = (1 − cos πq) / 2
  const trip2 = q => (1 - Math.cos(Math.PI * q)) / 2;
  const PX = P1 + (P3 - P1) * Math.acos(1 - 2 * scr.CROSS) / Math.PI;   // p, на котором машина пересекает пунктир
  const TH = [0, P1, PX, P3, 1];

  let lastI = -1;
  function apply(p, snap){
    p = clamp(p);
    const d2 = p <= P1 ? 0 : p >= P3 ? 1 : trip2((p - P1) / (P3 - P1));
    scr.set(d2, snap);
    // текущая метка — по тому же d2, что и событие на экране
    const i = d2 >= 1 ? 3 : d2 >= scr.CROSS ? 2 : d2 > 0 ? 1 : 0;
    marks.forEach((m, j) => {
      m.classList.toggle('is-cur', j === i);
      m.classList.toggle('is-past', j < i);
      if (j === i) m.style.setProperty('--f', clamp((p - TH[i]) / (TH[i + 1] - TH[i])).toFixed(3));
      else m.style.removeProperty('--f');
    });
    // поездка проиграна целиком (до 1280 и при reduced motion): абзацы рельса — обычным текстом, а не «прошедшими»; в липкой сцене не трогаем
    if (rail) rail.classList.toggle('is-done', p >= 1 && !sticky());
    if (i !== lastI){ lastI = i; marks.forEach((m, j) => j === i ? m.setAttribute('aria-current', 'step') : m.removeAttribute('aria-current')); }
  }

  const wide = matchMedia('(min-width: 1280px)');
  const sticky = () => wide.matches && !SP.reduce();
  let played = false, anim = 0, p0 = 0;

  // прогресс липкой сцены
  const progress = () => {
    const r = trip.getBoundingClientRect(), span = r.height - innerHeight;
    return span > 0 ? clamp(-r.top / span) : (r.top < 0 ? 1 : 0);
  };
  let raf = 0;
  const onScroll = () => { if (raf || !sticky()) return; raf = requestAnimationFrame(() => { raf = 0; apply(progress()); }); };

  // проигрывание один раз (до 1280): 6 s, cubic-bezier(.65,0,.35,1)
  const ease = (() => {
    const x1 = .65, y1 = 0, x2 = .35, y2 = 1;
    const A = (a, b) => 1 - 3 * b + 3 * a, B = (a, b) => 3 * b - 6 * a, C = a => 3 * a;
    const f = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
    const df = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
    return x => { let t = x; for (let i = 0; i < 8; i++){ const e = f(t, x1, x2) - x, dd = df(t, x1, x2); if (Math.abs(e) < 1e-5 || !dd) break; t -= e / dd; } return f(clamp(t), y1, y2); };
  })();
  function play(){
    if (played) return; played = true;
    cancelAnimationFrame(anim);
    const dur = 6000, t0 = performance.now();
    const tick = now => {
      if (sticky()) return;
      const q = clamp((now - t0) / dur);
      apply(q < 1 ? q : 1);      // время сцены линейно: стоянка, поездка с разгоном и торможением, стоянка
      if (q < 1) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  }

  const init = () => {
    scr.measure();
    if (SP.reduce()){ apply(1, true); return; }
    if (sticky()) apply(progress(), true);
    else apply(played ? 1 : 0, true);
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(() => {
    init();
    if (SP.reduce()) return;
    addEventListener('scroll', onScroll, { passive: true });   // Lenis крутит настоящий scroll окна — второй подписки (lenis.on) не нужно: с ней сцена отставала на кадр
    // до 1280: один раз при 50% видимости iPad
    const dev = SP.$('.gp-dev', trip);
    if ('IntersectionObserver' in window){
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting && !sticky()){ io.disconnect(); play(); }
      }), { threshold: .5 });
      io.observe(dev);
    } else if (!sticky()) apply(1, true);
  }));

  // размеры: пересчёт кадра карты; смена режима
  let rt = 0;
  const relayout = () => { clearTimeout(rt); rt = setTimeout(() => { scr.measure(); if (sticky()) apply(progress(), true); else scr.set(scr.d2, true); }, 60); };
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(SP.$('.gp-map', trip));
  else addEventListener('resize', relayout);
  wide.addEventListener('change', () => { if (!sticky() && !played){ played = true; apply(1, true); } else relayout(); });
});
})();
