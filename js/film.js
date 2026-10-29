/* Safa One — скролл-фильм (WebGL2). Подключается на странице с <section class="film" data-film="hero">. */
(() => {   // всё внутри замыкания: на сайте не конфликтует с чужими именами (lerp, C, META…)
/* =========================================================================
   ТЕКСТЫ. В фильме рисуются в сцене (их искажает линза), в DOM — для поиска и скринридеров.
   ========================================================================= */
// Слоган Safa, разложенный по ходу фильма: три такта собирают фразу по частям, под лого — целиком.
// \n — перенос строки; cNt — свои переносы для мобилки (если нужны). Про услуги — ниже на странице, не в фильме.
const I18N = {
  ru: {
    c1: 'Доверие',
    c2: 'в каждом',
    c3: 'действии.',
    c4: 'Доверие\nв каждом действии.',
    skip: 'Пропустить',
    hint: 'Листайте вниз',
  },
  uz: {   // порядок слов узбекский: «Har bir harakatda — ishonch.» (проверить носителем)
    c1: 'Har bir',
    c2: 'harakatda —',
    c3: 'ishonch.',
    c4: 'Har bir harakatda —\nishonch.',
    skip: 'Oʻtkazib yuborish',
    hint: 'Pastga aylantiring',
  },
};

/* =========================================================================
   КОНФИГ ДВИЖКА (как у vibr) И ГЕОМЕТРИЯ ИЗ ПОКАДРОВОГО РАЗБОРА
   Время — в кадрах vibr: F = 1 + P·221. Размеры — в долях высоты кадра H.
   ========================================================================= */
const FILM = {
  dir: 'media/',
  ver: '4',              // версия картинок: поменять после замены файлов в media/, чтобы браузер не взял старые из кэша
  lerp: .86, endAt: .96, expandFrom: .6,   // lerp: инерция (у vibr .78; больше = мягче догоняет скролл)
  // автопроигрывание: один жест скролла — и фильм идёт до конца сам, с постоянной скоростью; false — обычный скролл
  //   seconds — весь фильм от начала до конца; backSpeed — во сколько раз быстрее назад (скролл вверх);
  //   startAt — с какой доли экрана после появления фильма включается; rampIn/rampOut — плавный разгон и торможение, с
  autoplay: { seconds: 13, backSpeed: 3, startAt: .15, rampIn: .35, rampOut: .7 },
  cardMax: 996, cardGutter: 120, cardRatio: 560/996, cardRadius: 15,
  reducedF: 210,
  maxPixels: 3.7e6, maxPixelsMobile: 2.0e6,
};
const META = {   // из media/meta.json: фон «космос» (край планеты — дуга, вершина по центру), солнце восходит ровно за лого
  horizon: .5569, horizonK: .2937, sun: [.5, .552],
  logoTileBox: [36/976, 36/941, 940/976, 905/941],   // рамка плитки в logo_tile.webp / logo_s.webp
  icons: {
    car_front: 640/483, delivery_truck: 640/440, gps_pin: 492/640, route_tracking: 640/625, wireless_signal: 640/523,
    telemetry_dashboard: 640/525, gps_satellite: 640/580, vehicle_diagnostics: 640/613, payment_card: 640/427, digital_wallet: 640/623,
  },
};
// отладка только с ?filmdebug: &f=150 — заморозить кадр, &rw=1536&rh=864 — фиксированный рендер (снимки, запекание)
const QS = new URLSearchParams(location.search), DEBUG = QS.has('filmdebug');
let DEBUG_F = DEBUG ? (q => q === null || q === '' || isNaN(+q) ? null : +q)(QS.get('f')) : null;
const FORCE_RES = DEBUG && QS.get('rw') && QS.get('rh') ? [+QS.get('rw'), +QS.get('rh')] : null;
const DEBUG_LAYOUT = DEBUG ? QS.get('layout') : null;

/* ---------------------- кривые ---------------------- */
const cl = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// монотонный кубический сплайн по точкам [[F, v], ...] — гладко и без перелётов
function mono(pts){
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++){
    if (d[i] === 0){ m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9){ const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2*t3 - 3*t2 + 1) * ys[i] + (t3 - 2*t2 + t) * h * m[i] + (-2*t3 + 3*t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
const enterOff = (t, D, T) => t <= 0 ? D : D * Math.pow(1 - Math.min(t / T, 1), 4);   // выезд снизу, quart-out
const exitOff  = (t, D, T) => t <= 0 ? 0 : -D * Math.pow(Math.min(t / T, 1), 3);      // уезд вверх, cubic-in
const expoPath = u => u <= 0 ? 0 : (1 - Math.pow(2, -6 * u)) / (1 - Math.pow(2, -6));  // путь иконок vibr (без ограничения сверху: вечный дрейф)

const C = {
  // пузырь 1: центр (0.5; 1.005), радиус в H
  b1R: mono([[20.5,0],[21,.003],[23,.013],[25,.030],[27,.060],[29,.105],[31,.170],[33,.250],[35,.37],[37,.55],[39,.76],[41,.97],[43,1.12],[45,1.21],[47,1.27],[49,1.31],[51,1.38],[52,1.5]]),
  b1Glow: mono([[21,.25],[26,.5],[33,.8],[38,1],[39,1.15],[40,1.2],[41,1.1],[42,1],[43,.85],[44,.55],[46,.2],[47,0]]),
  b1Spill: mono([[26,0],[33,.5],[38,1],[40,1.2],[41,.8],[44,.3],[47,0]]),
  b1Twist: mono([[31.5,0],[33,2.5],[35,5.5],[38.9,6.5]]),
  b1K: mono([[39,2.0],[40,1.3],[41,.35],[42,.2],[43,.12],[44,.06],[45,.03],[47,.01],[50,0]]),   // после обёртки быстро распрямляется
  b1Sz: mono([[39,1.10],[40,1.08],[41,1.057],[42,1.046],[43,1.040],[44,1.030],[45,1.018],[46,1.012],[48,1.005],[50,1.003],[56,1]]),
  b1Haze: mono([[39,.22],[40,.2],[41,.17],[42,.1],[43,.07],[44,.05],[46,.03],[50,0]]),
  b1Disp: mono([[39.3,0],[40,.35],[41,.45],[42,.2],[43,.08],[44,0]]),
  defocus: mono([[38.9,0],[39,2],[41,3],[42,2],[43.5,2],[44,1.5],[45,1],[50,1],[52,.5],[66,.5],[70,0]]),  // px при H=864
  // линза 2: центр (0.5; 0.5), ширина формы в H, показатель суперэллипса
  l2Size: mono([[133.5,4.6],[136,3.6],[138,3.0],[140,2.4],[141,2.25],[142,2.08],[143,1.85],[145,1.53],[147,1.22],[149,1.03],[151,.90],[153,.78],[156,.66],[160,.573],[164,.508],[170,.462],[175,.436],[180,.406],[185,.384],[188,.385],[190,.392],[192,.404],[194,.413],[196,.432],[198,.473],[200,.492],[202,.503],[204,.513],[206,.516],[219,.516],[220,.506],[221,.45],[222,.383]]),
  l2N: mono([[148,2],[149,2.24],[150,2.48],[151,2.61],[152,2.85],[153,3.24],[155,3.57],[156,4.0],[158,4.3],[161,4.5]]),
  l2Aspect: mono([[156,1],[164,1.04]]),
  l2M: mono([[133.5,1],[136,1],[138,1.012],[140,1.025],[142,1.045],[143,1.065],[144,1.085],[145,1.10],[146,1.13],[147,1.155]]),
  l2Barrel: mono([[134,0],[140,.04],[142.5,.06],[144,.03],[146,0]]),
  l2Flow: mono([[147.5,0],[150,.35],[156,.8],[162,1]]),
  l2Liq: mono([[151,0],[156,.45],[160,.85],[163,1]]),
  l2Blur: mono([[147.5,0],[151,.0012],[156,.004],[161,.012],[171,.03],[181,.08],[185,.17],[195,.17]]),   // доля стороны; с 0 на стыке режимов
  l2White: mono([[165,0],[175,.45],[185,.8]]),
  l2Pearl: mono([[181,0],[188,.9]]),
  sAlpha: mono([[148,0],[152,.3],[156,.55],[161,.7],[166,.8],[175,.92],[181,1]]),   // S читается раньше, чем тает жидкость
  sPale: mono([[150,.5],[158,.3],[166,.15],[181,0]]),
  rimWhite: mono([[172,0],[185,1]]),
  rimAlpha: mono([[188,1],[196,0]]),
  bR: mono([[147,0],[152,1],[194,.35],[200,0]]),
  bB: mono([[147,0],[152,.6],[172,.55],[186,.15],[189,.2],[192,1],[200,.6],[206,0]]),
  bT: mono([[160,0],[164,1],[194,.75],[200,.4],[206,0]]),
  bL: mono([[174.5,0],[177.5,1],[194,.9],[200,.5],[206,0]]),
  halo: mono([[188,.01],[191,.05],[194,.15],[196,.3],[197,.46],[198,.67],[199,.78],[200,.93],[201,1],[202,1],[203,.97],[204,.9],[205,.88],[206,.84],[207,.83],[210,.81],[212,.73],[214,.56],[216,.28],[218,.14],[219,.07],[220,.04],[221,0]]),
  haloBias: mono([[196,2.2],[201,2.7],[204,1.2],[206,1]]),
  corona: mono([[202.5,0],[204,.25],[206,1],[210,.9],[214,.5],[220,0]]),
  exitBlur: mono([[220,0],[221,1],[222,.3]]),
};

/* ---------------------- раскладки стеклянных предметов ----------------------
   x — доля ширины кадра, y — доля высоты; sz — размер предмета (большая сторона) в долях высоты;
   rot — наклон, °; z — глубина: 0 далеко … 1 близко (дальние мельче, мягче, медленнее «наезжают»).
   Старт считается сам: по лучу от центра подписи через точку x,y — за край кадра. t0 — кадр старта (по умолчанию по кругу).
   Подпись 3 занимает по ширине ~.26–.74 (RU длиннее английского vibr), по высоте ~.42–.62 — туда не ставим. */
const LAYOUTS = {
  // «Орбита»: ровное кольцо вокруг подписи; сверху дальние и мелкие (небо), снизу ближние и крупные (земля)
  orbit: {
    wide: [
      { key: 'gps_satellite',       x: .31, y: .15, sz: .13, rot: -10, z: .25 },
      { key: 'gps_pin',             x: .50, y: .10, sz: .11, rot:   0, z: .15 },
      { key: 'wireless_signal',     x: .69, y: .16, sz: .12, rot:   8, z: .25 },
      { key: 'digital_wallet',      x: .86, y: .32, sz: .16, rot:   7, z: .50 },
      { key: 'route_tracking',      x: .89, y: .70, sz: .17, rot:  -8, z: .70 },
      { key: 'telemetry_dashboard', x: .71, y: .87, sz: .20, rot:   5, z: .90 },
      { key: 'vehicle_diagnostics', x: .50, y: .90, sz: .14, rot:   0, z: .80 },
      { key: 'delivery_truck',      x: .29, y: .86, sz: .22, rot:  -4, z: .95 },
      { key: 'payment_card',        x: .11, y: .70, sz: .19, rot:  10, z: .75 },
      { key: 'car_front',           x: .14, y: .32, sz: .17, rot:  -6, z: .55 },
    ],
    tall: [
      { key: 'gps_satellite',       x: .22, y: .13, sz: .080, rot: -10, z: .25 },
      { key: 'gps_pin',             x: .50, y: .08, sz: .066, rot:   0, z: .15 },
      { key: 'wireless_signal',     x: .79, y: .14, sz: .078, rot:   8, z: .25 },
      { key: 'digital_wallet',      x: .80, y: .30, sz: .100, rot:   7, z: .50 },
      { key: 'route_tracking',      x: .83, y: .71, sz: .105, rot:  -8, z: .70 },
      { key: 'telemetry_dashboard', x: .72, y: .88, sz: .125, rot:   5, z: .90 },
      { key: 'delivery_truck',      x: .27, y: .87, sz: .135, rot:  -4, z: .95 },
      { key: 'payment_card',        x: .17, y: .71, sz: .115, rot:  10, z: .75 },
      { key: 'car_front',           x: .20, y: .30, sz: .105, rot:  -6, z: .55 },
      { key: 'vehicle_diagnostics', x: .50, y: 1.09, sz: .10, rot:   0, z: .80, t0: 140 },   // за кадром: его втянет линза
    ],
  },
  // «Поток»: предметы летят по диагонали из глубины (сверху справа — мелкие) к камере (снизу слева — крупные)
  stream: {
    wide: [
      { key: 'gps_pin',             x: .63, y: .12, sz: .09, rot:   6, z: .05 },
      { key: 'gps_satellite',       x: .78, y: .10, sz: .10, rot: -12, z: .10 },
      { key: 'wireless_signal',     x: .92, y: .22, sz: .11, rot:  10, z: .20 },
      { key: 'route_tracking',      x: .79, y: .30, sz: .12, rot:  -6, z: .30 },
      { key: 'vehicle_diagnostics', x: .90, y: .50, sz: .14, rot:   8, z: .45 },
      { key: 'digital_wallet',      x: .17, y: .22, sz: .13, rot:  -8, z: .35 },
      { key: 'telemetry_dashboard', x: .71, y: .84, sz: .18, rot:   5, z: .70 },
      { key: 'payment_card',        x: .13, y: .58, sz: .19, rot:  12, z: .75 },
      { key: 'car_front',           x: .40, y: .86, sz: .21, rot:  -4, z: .90 },
      { key: 'delivery_truck',      x: .13, y: .88, sz: .26, rot:  -8, z: 1.0 },
    ],
    tall: [
      { key: 'gps_pin',             x: .62, y: .07, sz: .055, rot:   6, z: .05 },
      { key: 'gps_satellite',       x: .86, y: .09, sz: .065, rot: -12, z: .10 },
      { key: 'wireless_signal',     x: .40, y: .14, sz: .070, rot:  10, z: .20 },
      { key: 'route_tracking',      x: .80, y: .24, sz: .080, rot:  -6, z: .30 },
      { key: 'digital_wallet',      x: .20, y: .28, sz: .090, rot:  -8, z: .35 },
      { key: 'telemetry_dashboard', x: .80, y: .72, sz: .110, rot:   5, z: .70 },
      { key: 'payment_card',        x: .22, y: .72, sz: .120, rot:  12, z: .75 },
      { key: 'car_front',           x: .70, y: .88, sz: .130, rot:  -4, z: .90 },
      { key: 'delivery_truck',      x: .24, y: .89, sz: .150, rot:  -8, z: 1.0 },
      { key: 'vehicle_diagnostics', x: 1.10, y: .50, sz: .10, rot:   8, z: .45, t0: 140 },
    ],
  },
  // «Арка»: дуга над подписью (как созвездие), два крупных предмета на переднем плане в нижних углах
  arch: {
    wide: [
      { key: 'payment_card',        x: .12, y: .46, sz: .15, rot:  14, z: .55 },
      { key: 'car_front',           x: .20, y: .25, sz: .14, rot:   8, z: .40 },
      { key: 'gps_pin',             x: .335, y: .13, sz: .11, rot:  4, z: .25 },
      { key: 'gps_satellite',       x: .50, y: .09, sz: .11, rot:   0, z: .20 },
      { key: 'wireless_signal',     x: .665, y: .13, sz: .11, rot: -4, z: .25 },
      { key: 'digital_wallet',      x: .80, y: .25, sz: .14, rot:  -8, z: .40 },
      { key: 'route_tracking',      x: .88, y: .46, sz: .15, rot: -14, z: .55 },
      { key: 'delivery_truck',      x: .12, y: .85, sz: .25, rot:  -6, z: 1.0 },
      { key: 'telemetry_dashboard', x: .88, y: .85, sz: .23, rot:   6, z: .95 },
      { key: 'vehicle_diagnostics', x: .50, y: 1.12, sz: .14, rot:  0, z: .80, t0: 140 },
    ],
    tall: [
      { key: 'payment_card',        x: .14, y: .34, sz: .085, rot:  14, z: .55 },
      { key: 'car_front',           x: .22, y: .19, sz: .085, rot:   8, z: .40 },
      { key: 'gps_pin',             x: .38, y: .10, sz: .065, rot:   4, z: .25 },
      { key: 'gps_satellite',       x: .62, y: .10, sz: .065, rot:  -4, z: .25 },
      { key: 'digital_wallet',      x: .78, y: .19, sz: .085, rot:  -8, z: .40 },
      { key: 'route_tracking',      x: .86, y: .34, sz: .085, rot: -14, z: .55 },
      { key: 'delivery_truck',      x: .24, y: .84, sz: .150, rot:  -6, z: 1.0 },
      { key: 'telemetry_dashboard', x: .76, y: .84, sz: .140, rot:   6, z: .95 },
      { key: 'wireless_signal',     x: -.10, y: .70, sz: .09, rot:  0, z: .60, t0: 140 },
      { key: 'vehicle_diagnostics', x: 1.10, y: .70, sz: .09, rot:  0, z: .60, t0: 140 },
    ],
  },
};
// раскладка по умолчанию; для сравнения: ?filmdebug&layout=stream
const LAYOUT = LAYOUTS[DEBUG_LAYOUT] ? DEBUG_LAYOUT : 'orbit';
// старт за краем кадра по лучу от центра подписи; t0 по умолчанию — по кругу, по часовой от верха слева
function prepLayout(items, tall){
  const A = tall ? 9 / 16 : 16 / 9, C0 = [.5 * A, .52];
  const ang = it => Math.atan2(it.y - C0[1], it.x * A - C0[0]);
  const order = items.filter(it => it.t0 == null).map(ang).sort((a, b) => a - b);
  return items.map(it0 => {
    const it = tall ? { ...it0, sz: it0.sz * 1.2 } : it0;           // на телефоне предметы крупнее: экран маленький
    const X = it.x * A, dx = X - C0[0], dy = it.y - C0[1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
    const m = it.sz * .75; let k = 0;                                   // сколько пройти по лучу, чтобы предмет целиком вышел за край
    if (ux > 1e-3) k = Math.max(k, (A + m - X) / ux); else if (ux < -1e-3) k = Math.max(k, (-m - X) / ux);
    if (uy > 1e-3) k = Math.max(k, (1 + m - it.y) / uy); else if (uy < -1e-3) k = Math.max(k, (-m - it.y) / uy);
    const rank = order.indexOf(ang(it));
    return { ...it, s: [(X + ux * k) / A, it.y + uy * k], e: [it.x, it.y], size: it.sz,
      t0: it.t0 != null ? it.t0 : 98 + 4 * rank / Math.max(1, order.length - 1), side: Math.sign(dx) || 1 };
  });
}
const ICONS_WIDE = prepLayout(LAYOUTS[LAYOUT].wide, false);
const ICONS_TALL = prepLayout(LAYOUTS[LAYOUT].tall, true);

/* ---------------------- ладдер ---------------------- */
(function buildLadder(){
  const track = document.querySelector('.ladder__track');
  if (!track) return;                                                // на странице ладдера может не быть
  const rung = i => { const d = document.createElement('i'); d.className = 'ladder__rung'; d.style.setProperty('--i', i); return d; };
  for (let g = 0; g < 5; g++){
    track.appendChild(rung(g * 5));
    if (g < 4){
      const grp = document.createElement('div'); grp.className = 'ladder__group';
      [-.5, 7.5, 15.5, 23.5].forEach((top, k) => { const r = rung(g * 5 + 1 + k); r.style.top = top + 'px'; grp.appendChild(r); });
      track.appendChild(grp);
    }
  }
  const n = document.createElement('i'); n.className = 'ladder__needle'; track.appendChild(n);
})();

/* =========================================================================
   РАСКЛАДКА: «кадр-дизайн» 16:9 или 9:16, вписанный в холст как object-fit: cover
   ========================================================================= */
function layoutFor(W, H){
  const tall = W / H < 1, A = tall ? 9 / 16 : 16 / 9;
  let w, h;
  if (W / H > A){ w = W; h = W / A; } else { h = H; w = H * A; }
  const x0 = (W - w) / 2, y0 = (H - h) / 2;
  // фон 16:9 покрывает кадр-дизайн по высоте (на мобилке — центральная полоса)
  const pa = 1672 / 941, ph = h, pw = Math.max(w, h * pa);
  return { W, H, tall, x0, y0, w, h, plate: [x0 + (w - pw) / 2, y0 + (h - ph) / 2, pw, ph] };
}
const P2 = (L, u, v) => [L.x0 + u * L.w, L.y0 + v * L.h];   // доли кадра → px

/* =========================================================================
   ТЕКСТ → ТЕКСТУРЫ (Canvas2D). Слова первой фразы и строки остальных — отдельными кусками.
   ========================================================================= */
// c1/c23 — центр блока строк (базовая линия для одной строки), pitch — шаг строк в долях кегля;
// m* — маски vibr; если строк больше или кегль крупнее, маски расширяются так, чтобы не резать текст в покое
// Такты слогана крупнее подписей vibr (короткие слова) и выше на ~6% кадра: над светящимся краем планеты.
// Маски такта 1 (m1b/m1t) стоят на том же расстоянии от строки, что маски тактов 2–3 — все три такта проявляются одинаково.
const TYPE = {
  wide: { fs: .088, fs4: .074, c1: .462, c23: .468, c4: .865, pitch: 1.17, m1b: .531, m1t: .350, m2b: .537, m2t: .356, m3t: .352, m4b: .955 },
  tall: { fs: .062, fs4: .064, c1: .450, c23: .460, c4: .845, pitch: 1.28, m1b: .531, m1t: .349, m2b: .541, m2t: .359, m3t: .355, m4b: .922 },
};
function buildTextPieces(lang, L){
  const T0 = L.tall ? TYPE.tall : TYPE.wide, txt = I18N[lang];
  const T = { ...T0 };                       // маски подгоняются под фактический текст ниже
  const visW = Math.min(L.w, L.W), visB = (L.H - L.y0) / L.h;   // видимая часть кадра-дизайна (cover-кроп)
  const lines = k => (L.tall && txt[k + 't'] ? txt[k + 't'] : txt[k]).split('\n');
  const font = px => `600 ${px}px Onest, "Helvetica Neue", Arial, sans-serif`;   // шрифт сайта
  // sh — мягкая тень: текст стоит над светящимся краем планеты и на рассвете (у vibr контраст там падает до 3:1)
  const mk = (str, px, sh = false) => {
    const c = document.createElement('canvas'), x = c.getContext('2d');
    const pad = Math.ceil(px * (sh ? .7 : .15)), top = sh ? Math.ceil(px * .5) : 0;
    x.font = font(px); const w = Math.ceil(x.measureText(str).width) + 2 * pad;
    c.width = Math.max(2, w); c.height = Math.ceil(px * 1.45) + 2 * top;
    const base = top + Math.round(px * 1.08);
    x.font = font(px); x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
    if (sh){ x.shadowColor = 'rgba(28,8,48,.65)'; x.shadowBlur = px * .45; x.shadowOffsetY = px * .05; x.fillText(str, pad, base); x.shadowColor = 'transparent'; }
    x.fillText(str, pad, base);
    return { canvas: c, w: c.width, h: c.height, base, pad, fsH: px / L.h };
  };
  const pieces = [];
  // кегль по высоте кадра, но самая длинная строка не шире 86% (мобилка) / 80% (широкий) видимой ширины
  const meas0 = document.createElement('canvas').getContext('2d');
  const fit = (ls, base) => {
    meas0.font = font(base); const wmax = Math.max(...ls.map(s => meas0.measureText(s).width));
    const px = Math.round(Math.min(base, base * (L.tall ? .86 : .80) * visW / wmax));
    return isFinite(px) ? Math.max(10, px) : 10;          // свёрнутое окно (0 px) — без NaN
  };
  const l1 = lines('c1'), l2 = lines('c2'), l3 = lines('c3');
  const l4 = L.tall ? txt.c4.split('\n') : [txt.c4.replace('\n', ' ')];
  const fs123 = fit([...l1, ...l2, ...l3], Math.round(T.fs * L.h)), fsH = fs123 / L.h;
  const fs4 = fit(l4, Math.round(T.fs4 * L.h)), fs4H = fs4 / L.h;
  const step = fsH * T.pitch, step4 = fs4H * T.pitch;
  const base = (center, n, i, st) => center + (i - (n - 1) / 2) * st;      // базовые линии блока вокруг центра
  // маски: не ближе к тексту, чем выносные элементы (кириллица: Д, у, р)
  const ASC = .80, DESC = .30;
  const fitMasks = (bys, fh, mT, mB) => [Math.min(mT, bys[0] - ASC * fh - .004), Math.max(mB, bys[bys.length - 1] + DESC * fh + .004)];
  // фраза 1: по словам (на мобилке — в две строки)
  { const px = fs123, meas = document.createElement('canvas').getContext('2d'); meas.font = font(px);
    const space = meas.measureText(' ').width;
    const bys = l1.map((_, li) => base(T.c1, l1.length, li, step));
    [T.m1t, T.m1b] = fitMasks(bys, fsH, T.m1t, T.m1b);
    let idx = 0; const n = l1.join(' ').split(' ').length;
    l1.forEach((line, li) => {
      const words = line.split(' '), widths = words.map(w => meas.measureText(w).width);
      const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
      let x = L.x0 + L.w / 2 - total / 2;
      words.forEach((w, i) => { pieces.push({ cap: 1, idx: idx++, n, x, by: bys[li], ...mk(w, px, true) }); x += widths[i] + space; });
    });
  }
  // фразы 2–3: по строкам
  [[l2, 2], [l3, 3]].forEach(([ls, cap]) => {
    const bys = ls.map((_, i) => base(T.c23, ls.length, i, step));
    const [mT, mB] = fitMasks(bys, fsH, cap === 2 ? T.m2t : T.m3t, T.m2b);
    if (cap === 2) T.m2t = mT; else T.m3t = mT;
    T.m2b = Math.max(T.m2b, mB);
    ls.forEach((line, i) => { const p = mk(line, fs123, true); pieces.push({ cap, idx: i, n: ls.length, x: L.x0 + L.w / 2 - (p.w - 2 * p.pad) / 2, by: bys[i], ...p }); });
  });
  // фраза 4: широкий — одна строка, мобилка — две; не ниже видимого края (iPad в портрете, узкие окна)
  { const n = l4.length, last = Math.min(base(T.c4, n, n - 1, step4), visB - DESC * fs4H - .03);
    const bys = l4.map((_, i) => last - (n - 1 - i) * step4);
    T.m4b = Math.min(T.m4b, visB - .004);
    l4.forEach((line, i) => { const p = mk(line, fs4, true); pieces.push({ cap: 4, idx: i, n, x: L.x0 + L.w / 2 - (p.w - 2 * p.pad) / 2, by: bys[i], ...p }); });
  }
  return { pieces, T };
}
// Три такта слогана («Доверие» / «в каждом» / «действии.») — один ритм: въезд за 9 кадров на одно и то же расстояние,
// одинаковое время на экране и одинаковые паузы между тактами. Третий такт уходит в линзу в f134.5 (привязка к линзе),
// от него с шагом 44.75 кадра отсчитаны первые два.
const BEAT = { in: 9, hold: 26, out: 7, rise: .16, exitRise: .15, t: [10, 54.75, 99.5] };
// смещение (в H) и маска для куска текста в кадре F
function textState(pc, F, T, tall){
  let off = 0, clipT = -1, clipB = 2, a = 1, sy = 1, warp = 0;
  // выезд снизу: строка стартует целиком под маской; уход вверх: целиком за маску (с хвостами Д/у/р — у кириллицы они есть)
  const hide = (clip, minD) => Math.max(minD, clip - pc.by + .80 * pc.fsH + .004);
  const clear = (clip, minD) => Math.max(minD, pc.by + .32 * pc.fsH - clip + .008);
  if (pc.cap === 1){
    const t0 = BEAT.t[0] + pc.idx * 5 / Math.max(1, pc.n - 1), te = BEAT.t[0] + BEAT.in + BEAT.hold;   // несколько слов (UZ) — лесенкой
    off = enterOff(F - t0, hide(T.m1b, BEAT.rise), BEAT.in) + exitOff(F - te, clear(T.m1t, BEAT.exitRise), BEAT.out);
    clipB = T.m1b; clipT = F > te - 2 ? T.m1t : -1;
    if (F < t0 || F > te + BEAT.out + .1) a = 0;
  } else if (pc.cap === 2){
    // общий разброс строк как у vibr (вход 3 кадра, уход 2), сколько бы строк ни было (на мобилке их 3)
    const k = pc.idx / Math.max(1, pc.n - 1), t0 = BEAT.t[1] + 3 * k, te = BEAT.t[1] + BEAT.in + BEAT.hold + 2 * k;
    off = enterOff(F - t0, hide(T.m2b, BEAT.rise), BEAT.in) + exitOff(F - te, clear(T.m2t, BEAT.exitRise), BEAT.out);
    clipB = T.m2b; clipT = F > te - 7 ? T.m2t : -1;
    if (F < t0 || F > te + BEAT.out + .5) a = 0;
  } else if (pc.cap === 3){
    const t0 = BEAT.t[2] + 3 * pc.idx / Math.max(1, pc.n - 1);
    if (pc.idx === 0 && pc.n > 1){ off = enterOff(F - t0, hide(T.m2b, BEAT.rise), BEAT.in) + exitOff(F - 133.5, clear(T.m3t, .065), 6); clipT = F > 125 ? T.m3t : -1; if (F > 139.6) a = 0; }
    else {                                                         // последние строки (или единственная) уходят вверх сквозь край линзы: растягиваются и плывут
      const te = 134.5 + Math.max(0, pc.idx - 1) * .5;
      off = enterOff(F - t0, hide(T.m2b, BEAT.rise), BEAT.in) + exitOff(F - te, .108, 7.5);
      sy = 1 + .28 * sstep(139.5, 142.6, F);
      warp = mono([[139,0],[140,.02],[142.6,.06]])(F);
      if (F > 142.6) a = 0;
    }
    clipB = T.m2b;
    if (F < t0) a = 0;
  } else {
    const t0 = 163 + (tall ? 8 * pc.idx : 0);
    off = tall && pc.idx ? enterOff(F - t0, hide(T.m4b, .10), 5) : enterOff(F - t0, hide(T.m4b, .17), 8);
    clipB = T.m4b;
    if (F < t0) a = 0;
  }
  return { off, clipT, clipB, a, sy, warp };
}

/* =========================================================================
   WebGL2
   ========================================================================= */
const GLSL_COMMON = `
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ return vn(p)*.55 + vn(p*2.03+7.1)*.3 + vn(p*4.1-3.3)*.15; }
vec3 film(float x){ return .5+.5*cos(6.28318*(x+vec3(0.,.33,.67))); }
float sen(vec2 q, float n){ return pow(pow(abs(q.x),n)+pow(abs(q.y),n), 1./n); }
// горизонт — дуга края планеты: y = h + k·(x−.5)²  (в долях фона)
float horY(float x, float h, float k){ float d=x-.5; return h+k*d*d; }
`;
const SH = {
FS_VS: `#version 300 es
const vec2 P[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3));
out vec2 vUv;
void main(){ vec2 p=P[gl_VertexID]; vUv=p*.5+.5; gl_Position=vec4(p,0,1); }`,

QUAD_VS: `#version 300 es
uniform vec2 uRes; uniform vec4 uRect; uniform float uPad, uRot;   // rect: x,y,w,h в px (y вниз); uRot — поворот вокруг центра, рад
out vec2 vUv;
const vec2 Q[4]=vec2[4](vec2(0,0),vec2(1,0),vec2(0,1),vec2(1,1));
void main(){
  vec2 q=Q[gl_VertexID]; vec2 e=(q-.5)*(1.+2.*uPad)+.5;
  vUv=e; vec2 l=(e-.5)*uRect.zw; float c=cos(uRot), s=sin(uRot);
  vec2 p=uRect.xy+.5*uRect.zw+vec2(c*l.x-s*l.y, s*l.x+c*l.y);
  gl_Position=vec4(p.x/uRes.x*2.-1., 1.-p.y/uRes.y*2., 0, 1);
}`,

// спрайт: иконка (2 текстуры — синий/фиолетовый) или текст; маска по Y, мягкость, «плавание»
SPRITE: `#version 300 es
precision highp float;
uniform sampler2D uA, uB; uniform float uMix, uAlpha, uSoft, uWarp, uSeed, uLod; uniform vec2 uClip, uRes; uniform vec4 uRect;
in vec2 vUv; out vec4 o;
${GLSL_COMMON}
vec4 tex(vec2 uv){ if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.) return vec4(0);
  return mix(textureLod(uA,uv,uLod), textureLod(uB,uv,uLod), uMix); }
const vec2 D8[8]=vec2[8](vec2(-.326,-.406),vec2(-.840,-.074),vec2(-.696,.457),vec2(-.203,.621),vec2(.962,-.195),vec2(.473,-.480),vec2(.519,.767),vec2(.185,-.893));
void main(){
  float py=uRect.y+vUv.y*uRect.w;
  if(py<uClip.x||py>uClip.y) discard;
  vec2 uv=vUv;
  // смещение изотропно в пикселях: у длинной строки текста не растягивается по ширине
  if(uWarp>0.){ vec2 asp=vec2(uRect.z/uRect.w,1.); vec2 w=vec2(fbm(uv*asp*3.2+uSeed), fbm(uv*asp*3.2+uSeed+19.7))-.5; uv+=w*uWarp*2./asp; }
  vec4 c;
  if(uSoft<.0008) c=tex(uv);
  else { c=vec4(0); for(int i=0;i<8;i++) c+=tex(uv+D8[i]*uSoft); c/=8.; }
  o=c*uAlpha;
}`,

// содержимое линзы 2 в её квадрате: мир A′+передний план, поток, жидкость, заморозка, перламутр
LIQ: `#version 300 es
precision highp float;
uniform sampler2D uNight, uFg, uLiquid, uPearl;
uniform vec2 uRes; uniform vec4 uPlate, uBox;        // uBox: x,y,w,h квадрата линзы в px
uniform float uN, uAsp, uM, uFlow, uLiq, uWhite, uPearlW, uT, uHor, uHorK;
in vec2 vUv; out vec4 o;
${GLSL_COMMON}
vec3 plateA2(vec2 px){ vec2 uv=clamp((px-uPlate.xy)/uPlate.zw,vec2(.001),vec2(.999));
  vec3 c=texture(uNight,uv).rgb;
  float hy=horY(uv.x,uHor,uHorK), ground=smoothstep(hy-.03,hy+.01,uv.y);
  return c*mix(vec3(1.231,1.186,1.171), vec3(1.175), ground); }
vec3 world(vec2 px){ vec2 fu=vec2(px.x/uRes.x, 1.-px.y/uRes.y); vec4 f=texture(uFg,fu);
  return plateA2(px)*(1.-f.a)+f.rgb; }
void main(){
  vec2 uvb=vec2(vUv.x,1.-vUv.y);           // y вниз внутри квадрата
  vec2 hs=uBox.zw*.5;
  vec2 q=(uvb-.5)*2.;                      // нормировано на рамку формы, как в композе
  vec2 pq=q*hs/hs.y;                       // изотропно, в полувысотах
  // поток: закрутка вокруг центра + турбулентность, растёт к f160
  float r=length(pq);
  float ang=uFlow*(.75*(1.-smoothstep(0.,1.1,r))+.45*sin(uT*.05+r*3.));   // умеренная закрутка: сильная рисует «е» вокруг S
  mat2 R=mat2(cos(ang),-sin(ang),sin(ang),cos(ang));
  vec2 pf=R*pq + uFlow*.18*(vec2(fbm(pq*2.1+uT*.03),fbm(pq*2.1+11.+uT*.03))-.5);
  float rn=sen(q,uN);
  float edge=1.+.55*smoothstep(.86,1.02,rn);           // за краем — затягивание в кайму
  vec2 c=uBox.xy+hs;
  vec2 src=c+pf*hs.y/uM*edge;
  vec3 col=world(src);
  // жидкое стекло (6.webp), тоже течёт
  vec2 qf=pf*hs.y/hs;
  vec2 lq=qf*.5+.5+uFlow*.04*(vec2(fbm(q*3.+uT*.04),fbm(q*3.+5.+uT*.04))-.5);
  vec4 L=texture(uLiquid, clamp(lq,vec2(.002),vec2(.998)));
  col=mix(col, L.rgb/max(L.a,.001), uLiq*L.a);
  // заморозка: обесцвечивание и уход в тёплый белый
  float lum=dot(col,vec3(.2126,.7152,.0722));
  col=mix(col, mix(vec3(lum), vec3(.98,.94,.92), .7), uWhite);
  vec4 Pq=texture(uPearl, q*.5+.5);
  col=mix(col, Pq.rgb/max(Pq.a,.001), uPearlW*Pq.a);
  o=vec4(col,1.);
}`,

// финальный композ
COMP: `#version 300 es
precision highp float;
uniform sampler2D uNight, uDay, uFg, uLiq, uLogoS, uLogoT;
uniform vec2 uRes; uniform vec4 uPlate; uniform float uF, uHor, uHorK, uHpx, uDayMix, uT;
uniform vec4 uB1, uB1b, uB1c, uB1d;      // b1: cx,cy,R,on | glow,spill,twist,mirror | k,Sz,haze,disp | defocus,mode,—,—
uniform vec4 uG;                         // глобальная фаза: on, Sz, defocus, —
uniform vec4 uL2, uL2b, uL2c, uL2d;      // l2: cx,cy,sizeW,sizeH | n,M,barrel,mode | blurLod,sA,sPale,rimWhite | rimA,tileA,halo,corona
uniform vec4 uBack, uSun, uLogoBox;      // подсветка R,B,T,L | солнце x,y px, haloBias | рамка плитки в текстуре
in vec2 vUv; out vec4 o;
${GLSL_COMMON}
vec2 pxOf(){ return vec2(vUv.x, 1.-vUv.y)*uRes; }
vec2 plUV(vec2 px){ return clamp((px-uPlate.xy)/uPlate.zw, vec2(.001), vec2(.999)); }
vec3 night(vec2 px){ return texture(uNight,plUV(px)).rgb; }
// для искажений, которые заглядывают за край фона: зеркалим вместо растягивания крайнего ряда пикселей (полосы-«штрихкод»)
vec3 nightM(vec2 px){ vec2 uv=(px-uPlate.xy)/uPlate.zw; uv=1.-abs(1.-abs(uv)); uv=clamp(uv,vec2(.001),vec2(.999));
  return texture(uNight,uv).rgb; }
float groundAt(vec2 px){ vec2 uv=plUV(px); float hy=horY(uv.x,uHor,uHorK); return smoothstep(hy-.03,hy+.01,uv.y); }
vec3 gradeA2(vec3 c, vec2 px){ return c*mix(vec3(1.231,1.186,1.171), vec3(1.175), groundAt(px)); }
vec3 dayc(vec2 px){ return texture(uDay,plUV(px)).rgb; }
vec4 fg(vec2 px){ return texture(uFg, vec2(px.x/uRes.x, 1.-px.y/uRes.y)); }
vec3 worldOut(vec2 px){ vec4 f=fg(px); return night(px)*(1.-f.a)+f.rgb; }
vec3 worldIn(vec2 px){ vec4 f=fg(px); return gradeA2(night(px),px)*(1.-f.a)+f.rgb; }
const vec2 D8[8]=vec2[8](vec2(-.326,-.406),vec2(-.840,-.074),vec2(-.696,.457),vec2(-.203,.621),vec2(.962,-.195),vec2(.473,-.480),vec2(.519,.767),vec2(.185,-.893));
vec3 worldInBlur(vec2 px, float s){ if(s<.35) return worldIn(px);
  vec3 a=vec3(0); for(int i=0;i<8;i++) a+=worldIn(px+D8[i]*s); return a/8.; }

/* ---------- пузырь 1 ---------- */
vec3 b1Interior(vec2 px, vec2 c, float R){
  vec2 q=(px-c)/R; float r=length(q);
  vec3 plum=vec3(.227,.078,.259), mag=vec3(.604,.29,.627);
  if(uB1d.y<.5){                                  // шар-градиент
    return mix(plum, mag, smoothstep(.25,1.,r));
  }
  vec3 col;
  if(uB1d.y<1.5){                                 // зеркальная сферизация земли
    vec2 off=q*R*(.42+.28*r*r); off.x=mix(off.x, abs(off.x), uB1b.w);
    col=nightM(vec2(c.x, c.y-.62*R)+off)*1.2*vec3(1.06,.97,1.2);
  } else {                                        // вихрь
    vec2 E=c-vec2(0.,.72*R); vec2 d=(px-E)/R; d.y*=2.;
    float rr=length(d);
    float tw=uB1b.z*3.8*(1.-smoothstep(0.,1.,rr));                 // 3–4 витка между «глазом» и краем — эллиптические кольца
    d=mat2(cos(tw),-sin(tw),sin(tw),cos(tw))*d; d.y*=.5;
    vec2 G=vec2(c.x, uPlate.y+uPlate.w*.86);                        // закручиваем фактуру земли, а не гладкое небо
    col=nightM(G+d*R*.55)*1.3;
    col*=.85+.15*cos(rr*6.2832*3.5);                                // кольца
    col*=mix(.5,1.,smoothstep(0.,.2,rr));                           // тёмный глаз
    float band=smoothstep(.72,.80,r)*(1.-smoothstep(.95,.995,r));
    float th=atan(q.y,q.x);
    col+=film(r*3.+th*.5+uF*.05)*band*.12*(.3+.7*abs(cos(th)));
  }
  float lobe=smoothstep(.40,.75,abs(q.x))*smoothstep(-.45,-.05,q.y);
  col=mix(col, plum, lobe*.65);
  col=mix(col, plum*.8, smoothstep(-.06,0.,q.y)*.8);       // тёмная полоса у самого низа
  return col;
}
vec3 b1Portal(vec2 px, vec2 c, float R, float fade){
  vec2 v=px-c; float r=length(v)/R;
  float k=uB1c.x, Sz=uB1c.y;
  // «подушка» r_out = r_in·(1+k·r_in³): решаем обратную задачу Ньютоном (монотонно до самого края)
  float x=r;
  for(int i=0;i<4;i++){ float x3=x*x*x; x-=(x*(1.+k*x3)-r)/(1.+4.*k*x3); }
  vec2 s0=c+normalize(v+1e-4)*x*R/Sz;
  float ca=(k*.012+.002)*R*smoothstep(.55,1.,r)*(1.-smoothstep(40.,41.,uF));   // RGB-расслоение только пока текст обёрнут по ободку
  vec2 dir=normalize(v+1e-4);
  float bl=uB1d.x*uHpx/864.;
  vec3 col=vec3(worldInBlur(s0+dir*ca,bl).r, worldInBlur(s0,bl).g, worldInBlur(s0-dir*ca,bl).b);
  col+=vec3(.43,.42,.75)*uB1c.z*(.15+.85*smoothstep(.55,1.,r));               // лавандовая дымка у края
  float band=smoothstep(.74,.80,r)*(1.-smoothstep(.95,.99,r))*smoothstep(.0,-.25,v.x/R);
  float th=atan(v.y,v.x);
  float streak=vn(vec2(th*90., floor(uF)*3.1))*vn(vec2(th*23.+1.7, r*6.));
  col+=film(streak*1.6+r*2.)*band*uB1c.w*.33*fade*smoothstep(.15,.6,streak);   // радужные радиальные штрихи слева
  return col;
}
// ободок кладётся смешиванием, а не сложением: на светлом содержимом не выгорает в белый
vec3 b1Rim(vec3 col, vec2 px, vec2 c, float R){
  float d=length(px-c)-R;
  float w=.0042*uHpx;
  if(d<0.) col=mix(col, vec3(.60,.29,.63), .55*exp(d/(.012*uHpx)));      // магента внутрь
  else {
    float th=atan(px.y-c.y, px.x-c.x);                          // y вниз: верх = -pi/2
    float left=smoothstep(.2,-.9,cos(th));                      // слева сильнее
    vec3 gc=mix(vec3(.37,.24,.27), vec3(.75,.38,.16), left);    // оранжевое свечение наружу (справа — тусклая слива)
    float a=uB1b.x*exp(-d/(max(.3*R,4.)*.4))*.55;
    col=mix(col, gc, clamp(a,0.,.9))+gc*a*.25;
  }
  return mix(col, vec3(.99,.85,1.), exp(-d*d/(w*w)));        // розово-белая сердцевина
}

/* ---------- линза 2 ---------- */
vec3 l2Inside(vec2 px){
  vec2 c=uL2.xy; vec2 hs=uL2.zw*.5;
  vec2 q=(px-c)/hs; float rn=sen(q,uL2b.x);
  // крупная линза (mode 0): рисуем напрямую в полном разрешении; мелкая (mode 1): из текстуры LIQ
  float M=uL2b.y*(1.+uL2b.z*rn*rn);
  float edge=1.+.55*smoothstep(.86,1.02,rn);       // то же затягивание у стенки, что и в LIQ — стык без скачка
  vec2 v=px-c; vec2 dir=normalize(v+1e-4);
  float ca=(smoothstep(.8,1.,rn)*uL2b.z*80.+smoothstep(.88,1.,rn)*6.)*uHpx/864.;
  vec2 uv=(q*.5+.5);                                // в квадрате LIQ (y вниз)
  vec3 col=vec3(0);
  if(uL2b.w<.5){
    vec2 s=c+v/M*edge;
    col=vec3(worldIn(s+dir*ca).r, worldIn(s).g, worldIn(s-dir*ca).b);
  } else {
    vec2 tuv=vec2(uv.x, 1.-uv.y);
    float lod=uL2c.x, N=float(textureSize(uLiq,0).x);
    if(lod<.5) col=textureLod(uLiq,tuv,0.).rgb;
    else { for(int i=0;i<8;i++) col+=textureLod(uLiq,tuv+D8[i]*exp2(lod)/N*.6,lod).rgb; col/=8.; }
    // радужная кайма по краю (где содержимое касается стенки)
    float e=smoothstep(.88,1.,rn)*(1.-smoothstep(160.,166.,uF));
    if(e>0.){ vec2 rd=normalize(q+1e-4)*.012; col.r=mix(col.r,textureLod(uLiq,tuv+vec2(rd.x,-rd.y),1.).r,e); col.b=mix(col.b,textureLod(uLiq,tuv-vec2(rd.x,-rd.y),1.).b,e); }
  }
  // знак S внутри (полупрозрачный, бледный → насыщенный)
  vec2 luv=mix(uLogoBox.xy, uLogoBox.zw, uv);
  // пока знак бледный — он размыт (стеклянный призрак, а не плоские плашки), к f181 становится резким
  vec4 S=textureLod(uLogoS, luv, uL2c.z*9.);
  vec3 sc=mix(S.rgb/max(S.a,.001), vec3(.93,.85,.97), uL2c.z);
  col=mix(col, mix(sc, col*1.25+vec3(.06,.03,.08), uL2c.z), S.a*uL2c.y);
  return col;
}
// d — экранная дистанция до контура линзы в px (rn и производные считаются в main до ветвлений)
vec3 l2Rim(vec3 col, float d){
  float w=.0035*uHpx, A=uL2d.x;
  vec3 inner=mix(vec3(.52,.25,.59), vec3(.85,.8,.9), uL2c.w);
  if(d<0.) col=mix(col, inner, .45*exp(d/(.016*uHpx))*A);
  else col+=vec3(.9,.45,.7)*.08*exp(-d/(.03*uHpx))*A;
  vec3 core=mix(vec3(.976,.82,.99), vec3(.99,.95,1.), uL2c.w);
  return mix(col, core, exp(-d*d/(w*w))*A);
}
// янтарная подсветка, обходит контур по кругу (справа → сверху → слева → снизу): кладётся поверх неба, а не прибавляется к синему
vec3 backlight(vec3 col, vec2 px, float d){
  if(d<=0.) return col;
  vec2 v=px-uL2.xy; float th=atan(v.y,v.x);           // 0 вправо, +pi/2 вниз
  float cr=max(0.,cos(th)), sb=max(0.,sin(th)), st=max(0.,-sin(th)), cl_=max(0.,-cos(th));
  float w=cr*cr*uBack.x+sb*sb*uBack.y+st*st*uBack.z+cl_*cl_*uBack.w;
  vec3 c=mix(vec3(.94,.79,.43), vec3(.76,.48,.36), smoothstep(0.,.045*uHpx,d));
  c=mix(c, vec3(.99,.9,.62), uDayMix*.6);
  float a=w*exp(-d/(.035*uHpx));
  return mix(col, c, clamp(a,0.,.85));
}
vec3 haloGlow(vec2 px, float d){
  if(d<=0.) return vec3(0);
  vec2 v=px-uL2.xy; float th=atan(v.y,v.x);
  float bias=1.+(uSun.z-1.)*max(0.,-cos(th));          // слева сильнее в начале
  float side=1.-.45*max(0.,sin(th));                     // снизу слабее: под лого стоит подпись
  vec3 c=mix(vec3(1.,.6,.24), vec3(1.,.96,.78), uDayMix);
  float hard=exp(-d/(.012*uHpx)), soft=exp(-d/(.055*uHpx));     // мягкий хвост короче: не заливает подпись под лого
  return c*uL2d.z*.75*bias*side*(hard*.9+soft*.16)/(1.+(uSun.z-1.)*.5);
}
void main(){
  vec2 px=pxOf();
  vec3 col;
  if(uB1.w>.5){
    vec2 c=uB1.xy; float R=uB1.z;
    float r=length(px-c), aa=1.5;
    float m=1.-smoothstep(R-aa,R+aa,r);
    vec3 outC=worldOut(px)+vec3(1.,.5,.15)*uB1b.y*.16*exp(-length(px-(c+vec2(-.9*R,-.25*R)))/(.8*R+1.))*smoothstep(0.,1.,(plUV(px).y-horY(plUV(px).x,uHor,uHorK))/.12);
    vec3 inC = uB1d.y<2.5 ? b1Interior(px,c,R) : b1Portal(px,c,R,1.);
    col=b1Rim(mix(outC,inC,m),px,c,R);
  } else if(uG.x>.5){
    vec2 c=uB1.xy; vec2 s=c+(px-c)/uG.y;
    col=worldInBlur(s, uG.z*uHpx/864.);
  } else if(uB1d.z<.5){
    col=worldOut(px);                                      // до пузыря: исходный фон + текст
  } else {
    vec2 c=uL2.xy; vec2 hs=uL2.zw*.5;
    float rn=sen((px-c)/hs, uL2b.x);
    float aa=fwidth(rn)*1.2;
    float d=(rn-1.)/max(length(vec2(dFdx(rn),dFdy(rn))),1e-5);   // экранная дистанция до контура, px
    float m=1.-smoothstep(1.-aa,1.+aa,rn);
    vec3 outC=mix(night(px), dayc(px), uDayMix);
    // корона солнца за иконкой, справа сильнее
    vec2 sv=px-uSun.xy; float sd=length(sv), sk=sd/(uL2.w*.62);
    outC+=(vec3(1.,.99,.85)*uL2d.w*.9*exp(-sk*sk) + vec3(.99,.83,.7)*uL2d.w*.25*exp(-sd/(.08*uHpx)))*(1.+.4*max(0.,sv.x/(uL2.z*.5)));
    vec3 inC=l2Inside(px);
    col=mix(outC,inC,m);
    col=l2Rim(col,d);
    col=backlight(col,px,d)+haloGlow(px,d);
    // финальная стеклянная плитка S поверх (7.webp); на выходе (f220–222, широкий) — зум-блюр
    if(uL2d.y>.001){
      vec2 uv0=(px-(c-hs))/(2.*hs);
      // производные — до цикла и ветвлений: внутри них мип-уровень не определён (D3D берёт нулевой → лесенка по краям);
      // режем по краю текстуры, а не по рамке плитки — рамка проходит по самому краю стекла, поля текстуры прозрачные
      vec2 t0=mix(uLogoBox.xy, uLogoBox.zw, uv0), gx=dFdx(t0), gy=dFdy(t0);
      // край плитки в картинке вырезан в 1–2 px: альфу берём с мипа на ступень грубее — кромка ~1.5 px без лесенки, рисунок внутри остаётся резким
      vec4 T=vec4(0), Tb=vec4(0); float n=uSun.w>.001 ? 6. : 1.;
      for(int i=0;i<6;i++){ if(float(i)>=n) break;
        vec2 uv=(uv0-.5)/(1.+uSun.w*.07*float(i)/5.)+.5;
        vec2 tc=mix(uLogoBox.xy, uLogoBox.zw, uv);
        if(tc.x>=0.&&tc.y>=0.&&tc.x<=1.&&tc.y<=1.){ T+=textureGrad(uLogoT, tc, gx, gy); Tb+=textureGrad(uLogoT, tc, gx*1.8, gy*1.8); } }
      T/=n; Tb/=n;
      vec3 tcol=mix(Tb.rgb/max(Tb.a,.001), T.rgb/max(T.a,.001), smoothstep(.3,.9,T.a));
      col=mix(col, tcol, Tb.a*uL2d.y);
    }
    if(uF>162.5){ vec4 f=fg(px); col=col*(1.-f.a)+f.rgb; }   // финальная подпись — поверх всего
  }
  col+=(h21(gl_FragCoord.xy)-.5)/255.;                  // статичный дизеринг против полос (кадр в покое не перерисовывается)
  o=vec4(col,1.);
}`,
};

function createRenderer(canvas){
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  gl.getExtension('OES_standard_derivatives');
  function program(vs, fs){
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++){ const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return { p, u };
  }
  const PR = { sprite: program(SH.QUAD_VS, SH.SPRITE), liq: program(SH.FS_VS, SH.LIQ), comp: program(SH.FS_VS, SH.COMP) };

  /* --- текстуры --- */
  const T = {};
  function texFrom(src, mips){
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mips){ gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    return t;
  }
  // пустая прозрачная текстура вместо незагруженной: нулевой вклад вместо чёрного (0,0,0,1)
  const EMPTY = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, EMPTY);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  const tx = o => o ? o.t : EMPTY;
  const load = (name, mips = true) => new Promise(res => {
    const img = new Image(); img.decoding = 'async'; img.src = FILM.dir + name + '.webp?v=' + FILM.ver;
    img.onload = () => { T[name] = { t: texFrom(img, mips), w: img.naturalWidth, h: img.naturalHeight }; res(); };
    img.onerror = () => { console.warn('[film] нет текстуры', name); res(); };
  });
  const list = ['plate_night', 'plate_day', 'liquid', 'pearl', 'logo_s', 'logo_tile'];
  Object.keys(META.icons).forEach(k => list.push('ic_' + k + '_blue', 'ic_' + k + '_purple'));
  let loaded = false;                                  // кадр рисуется только когда загружено всё (иначе пустые места и рывки)
  const ready = Promise.all(list.map(n => load(n, n !== 'plate_day'))).then(() => { loaded = true; });

  /* --- буферы --- */
  function target(w, h, mips){
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, mips ? Math.floor(Math.log2(Math.max(w, h))) + 1 : 1, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  }
  const free = o => { if (o){ gl.deleteTexture(o.t); gl.deleteFramebuffer(o.f); } };
  let W = 0, H = 0, fgT = null, liqT = null, L = null, textGen = 0, text = null, textTex = [], liqDirty = true;
  const MAXT = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  function resize(w, h){
    if (w === W && h === H) return;
    W = canvas.width = w; H = canvas.height = h;
    free(fgT); fgT = target(W, H, false);
    L = layoutFor(W, H); textGen++;
    // текстура жидкости — по размеру линзы в момент перехода (f147.5), чтобы на стыке не было ступеньки резкости
    const N = Math.max(512, Math.min(2048, MAXT, Math.ceil(C.l2Size(147.5) * L.h)));
    if (!liqT || liqT.w !== N){ free(liqT); liqT = target(N, N, true); }
    liqDirty = true;
  }
  function setText(lang){
    textTex.forEach(t => gl.deleteTexture(t)); textTex = [];
    text = buildTextPieces(lang, L);
    text.pieces.forEach(p => { p.tex = texFrom(p.canvas, false); textTex.push(p.tex); });
  }

  /* --- спрайт --- */
  function sprite(texA, texB, mix, rect, opt){
    const pr = PR.sprite; gl.useProgram(pr.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texA); gl.uniform1i(pr.u.uA, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texB || texA); gl.uniform1i(pr.u.uB, 1);
    gl.uniform2f(pr.u.uRes, W, H); gl.uniform4f(pr.u.uRect, rect[0], rect[1], rect[2], rect[3]); gl.uniform1f(pr.u.uPad, opt.pad || 0);
    gl.uniform1f(pr.u.uRot, opt.rot || 0);
    gl.uniform1f(pr.u.uMix, mix); gl.uniform1f(pr.u.uAlpha, opt.alpha ?? 1); gl.uniform1f(pr.u.uSoft, opt.soft || 0);
    gl.uniform1f(pr.u.uWarp, opt.warp || 0); gl.uniform1f(pr.u.uSeed, opt.seed || 0); gl.uniform1f(pr.u.uLod, opt.lod || 0);
    gl.uniform2f(pr.u.uClip, opt.clip ? opt.clip[0] : -1e5, opt.clip ? opt.clip[1] : 1e5);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* --- состояние кадра --- */
  const inflate = mono([[136,1],[137,1.05],[138,1.08],[140,1.14],[142,1.21],[145,1.38],[149,1.6],[156,1.8]]);
  function iconPose(ic, F, Lc, c2, l2r){
    const u = (F - ic.t0) / 34;
    const E = expoPath(u);
    let x = ic.s[0] + (ic.e[0] - ic.s[0]) * E, y = ic.s[1] + (ic.e[1] - ic.s[1]) * E;   // от длинных RU/UZ-строк отводит обход в render()
    const z = ic.z ?? .5, i = ICONS_WIDE.indexOf(ic) + ICONS_TALL.indexOf(ic) + 1;
    // лёгкое парение (от кадра, не от времени: в покое кадр не меняется) и «наезд камеры»: ближние растут сильнее
    const settle = sstep(ic.t0 + 8, ic.t0 + 22, F);
    y += .006 * (.4 + .6 * z) * Math.sin(F * .16 + i * 1.7) * settle;
    let k = 1 + .07 * z * sstep(104, 140, F);
    // перед линзой: ускоряются к центру и «надуваются»
    const pre = sstep(134, 142.5, F);
    x += (.5 - x) * .07 * pre * pre; y += (.55 - y) * .07 * pre * pre;
    k *= inflate(F);
    // сжатие стенкой линзы: позиции едут вместе с радиусом (в нормированных координатах линзы стоят на месте)
    if (F > 142.5){ const g = l2r(F) / l2r(142.5); x = .5 + (x - .5) * g; y = .5 + (y - .5) * g; }
    // наклон: прилетают с доворотом, у линзы выравниваются
    const rot = ((ic.rot || 0) + 22 * (ic.side || 1) * (1 - Math.min(E, 1)) + 3 * Math.sin(F * .11 + i) * settle) * (1 - pre) * Math.PI / 180;
    return { x, y, k, rot, z };
  }
  function state(F){
    const Lc = L, S = { F };
    S.day = sstep(194.6, 206.6, F);
    const c1 = P2(Lc, .5, 1.005);
    S.b1 = F >= 20.5 && F < 52 ? { c: c1, R: C.b1R(F) * Lc.h } : null;
    S.global = F >= 52 && F < 133.5;
    S.c1 = c1;
    const l2r = f => {                                   // ширина линзы в H с поправкой на мобилку
      if (!Lc.tall) return C.l2Size(f);
      if (f >= 185) return .324;
      const k = f < 150 ? 1 : f < 160 ? lerp(1, .89, (f - 150) / 10) : lerp(.89, .844, (f - 160) / 25);
      return C.l2Size(f) * k;
    };
    S.l2r = l2r;
    if (F >= 133.5){
      const size = l2r(F) * Lc.h, asp = C.l2Aspect(F);
      // текстура LIQ включается, когда линза уже меньше кадра (иначе мылит); до этого — прямой рендер
      S.l2 = { c: P2(Lc, .5, .5), sw: size * asp, sh: size, n: C.l2N(F), M: C.l2M(F), barrel: C.l2Barrel(F), liqMode: F >= 147.5 };
    }
    // текст
    S.text = text ? text.pieces.map(p => ({ p, ...textState(p, F, text.T, Lc.tall) })) : [];
    // иконки
    const slots = Lc.tall ? ICONS_TALL : ICONS_WIDE;
    // к f161.5 иконки уже растворены в жидкости; слой переднего плана с f162.5 кладётся поверх всего (финальная подпись)
    S.icons = F < 97 || F > 161.5 ? [] : slots.map((ic, i) => {
      const pose = iconPose(ic, F, Lc, null, l2r);
      return { ic, i, ...pose,
        mix: sstep(131, 145, F),
        // дальние чуть мягче (глубина резкости), у линзы мягчают все
        soft: Math.max((1 - pose.z) * .007, mono([[138,0],[143,.004],[148,.008],[156,.016]])(F)),
        warp: mono([[139,0],[142,.006],[145,.012],[149,.025],[156,.05]])(F) };
    });
    return S;
  }

  /* --- кадр --- */
  let frameNo = 0, ok = false, curLang = null;
  function render(F, time, lang){
    if (!loaded || !T.plate_night || !T.plate_day) return false;
    if (lang !== curLang || (text && text.gen !== textGen)){ curLang = lang; setText(lang); text.gen = textGen; }
    frameNo++;
    const S = state(F), Lc = L;

    // 1) передний план: иконки, потом текст
    gl.bindFramebuffer(gl.FRAMEBUFFER, fgT.f); gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    // иконки держат отступ от строк подписи 3 (RU/UZ шире английского): каждая строка — своя ширина и высота;
    // считается по размеру иконки без «надувания», к f143 обход плавно гаснет (линза уже стягивает иконки)
    const cap3 = text ? text.pieces.filter(p => p.cap === 3).map(p => ({
      half: (p.w - 2 * p.pad) / 2, y0: Lc.y0 + (p.by - .80 * p.fsH) * Lc.h, y1: Lc.y0 + (p.by + .30 * p.fsH) * Lc.h })) : [];
    const avoid = 1 - sstep(139, 143, F);
    [...S.icons].sort((p, q) => p.z - q.z).forEach(ic => {          // дальние рисуются первыми, ближние — поверх
      const a = T['ic_' + ic.ic.key + '_blue'], b = T['ic_' + ic.ic.key + '_purple']; if (!a || !b) return;
      const asp = META.icons[ic.ic.key];
      const big0 = ic.ic.size * Lc.h, big = big0 * ic.k;          // size — большая сторона предмета в долях высоты
      const w = asp >= 1 ? big : big * asp, h = asp >= 1 ? big / asp : big;
      const w0 = asp >= 1 ? big0 : big0 * asp, h0 = asp >= 1 ? big0 / asp : big0;
      let [x, y] = P2(Lc, ic.x, ic.y);
      if (avoid > 0){
        const cx = Lc.x0 + Lc.w / 2, dx = x - cx;
        let need = 0;
        for (const ln of cap3) if (y + h0 / 2 > ln.y0 && y - h0 / 2 < ln.y1) need = Math.max(need, ln.half + .025 * Lc.w + w0 / 2);
        if (Math.abs(dx) < need) x = lerp(x, cx + Math.sign(dx || 1) * need, avoid);
      }
      sprite(a.t, b.t, ic.mix, [x - w / 2, y - h / 2, w, h],
        { soft: ic.soft, warp: ic.warp, seed: ic.i * 7.3 + F * .04, lod: ic.soft > 0 ? Math.min(3, ic.soft * 120) : 0, pad: .06,
          rot: ic.rot, alpha: .88 + .12 * ic.z });
    });
    S.text.forEach(t => {
      if (t.a <= 0) return;
      const p = t.p, baseY = (p.by + t.off) * Lc.h + Lc.y0;      // растяжение — от базовой линии
      const clip = [t.clipT < 0 ? -1e5 : Lc.y0 + t.clipT * Lc.h, Lc.y0 + t.clipB * Lc.h];
      sprite(p.tex, p.tex, 0, [p.x - p.pad, baseY - p.base * t.sy, p.w, p.h * t.sy], { alpha: t.a, clip, warp: t.warp, seed: 3.1 + p.idx });
    });
    gl.disable(gl.BLEND);

    // 2) содержимое линзы 2
    // после f199 плитка закрывает жидкость, но её край виден: если текстура ещё не считалась (прыжок в конец, reduced motion) — считаем на f198.9
    if (S.l2 && S.l2.liqMode && (F < 199 || liqDirty)){
      const Fq = Math.min(F, 198.9), Lq = Fq === F ? S.l2 : state(Fq).l2;
      const pr = PR.liq; gl.useProgram(pr.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, liqT.f); gl.viewport(0, 0, liqT.w, liqT.h);
      const tex = [['uNight', T.plate_night], ['uFg', { t: fgT.t }], ['uLiquid', T.liquid], ['uPearl', T.pearl]];
      tex.forEach(([n, o], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tx(o)); gl.uniform1i(pr.u[n], i); });
      const box = [Lq.c[0] - Lq.sw / 2, Lq.c[1] - Lq.sh / 2, Lq.sw, Lq.sh];
      gl.uniform2f(pr.u.uRes, W, H); gl.uniform4f(pr.u.uPlate, ...Lc.plate); gl.uniform4f(pr.u.uBox, ...box);
      gl.uniform1f(pr.u.uN, Lq.n); gl.uniform1f(pr.u.uAsp, Lq.sw / Lq.sh); gl.uniform1f(pr.u.uM, Lq.M);
      gl.uniform1f(pr.u.uFlow, C.l2Flow(Fq)); gl.uniform1f(pr.u.uLiq, C.l2Liq(Fq)); gl.uniform1f(pr.u.uWhite, C.l2White(Fq));
      gl.uniform1f(pr.u.uPearlW, C.l2Pearl(Fq)); gl.uniform1f(pr.u.uT, Fq); gl.uniform1f(pr.u.uHor, META.horizon); gl.uniform1f(pr.u.uHorK, META.horizonK);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, liqT.t); gl.generateMipmap(gl.TEXTURE_2D);
      liqDirty = false;
    }

    // 3) композ на экран
    const pr = PR.comp; gl.useProgram(pr.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    const tex = [['uNight', T.plate_night], ['uDay', T.plate_day], ['uFg', { t: fgT.t }], ['uLiq', { t: liqT.t }], ['uLogoS', T.logo_s], ['uLogoT', T.logo_tile]];
    tex.forEach(([n, o], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tx(o)); gl.uniform1i(pr.u[n], i); });
    gl.uniform2f(pr.u.uRes, W, H); gl.uniform4f(pr.u.uPlate, ...Lc.plate);
    gl.uniform1f(pr.u.uF, F); gl.uniform1f(pr.u.uHor, META.horizon); gl.uniform1f(pr.u.uHorK, META.horizonK); gl.uniform1f(pr.u.uHpx, Lc.h); gl.uniform1f(pr.u.uDayMix, S.day); gl.uniform1f(pr.u.uT, time);
    const b1 = S.b1;
    gl.uniform4f(pr.u.uB1, S.c1[0], S.c1[1], b1 ? b1.R : 0, b1 ? 1 : 0);
    const mode = F < 25.5 ? 0 : F < 31.5 ? 1 : F < 38.95 ? 2 : 3;
    gl.uniform4f(pr.u.uB1b, C.b1Glow(F), C.b1Spill(F), C.b1Twist(F), 1 - sstep(27.5, 29.5, F));
    gl.uniform4f(pr.u.uB1c, F >= 38.95 ? C.b1K(F) : 0, F >= 38.95 ? C.b1Sz(F) : 1, C.b1Haze(F), C.b1Disp(F));
    gl.uniform4f(pr.u.uB1d, C.defocus(F), mode, S.l2 ? 1 : 0, 0);
    gl.uniform4f(pr.u.uG, S.global ? 1 : 0, C.b1Sz(F), C.defocus(F), 0);
    const l2 = S.l2 || { c: [0, 0], sw: 1, sh: 1, n: 2, M: 1, barrel: 0, liqMode: false };
    gl.uniform4f(pr.u.uL2, l2.c[0], l2.c[1], l2.sw, l2.sh);
    gl.uniform4f(pr.u.uL2b, l2.n, l2.M, l2.barrel, l2.liqMode ? 1 : 0);
    const sig = C.l2Blur(F);
    gl.uniform4f(pr.u.uL2c, Math.log2(1 + sig * liqT.w * 2.2), C.sAlpha(F), C.sPale(F), C.rimWhite(F));   // log2(1+x): с нуля без скачка
    gl.uniform4f(pr.u.uL2d, C.rimAlpha(F), sstep(190.5, 197.5, F), C.halo(F), C.corona(F));
    gl.uniform4f(pr.u.uBack, C.bR(F), C.bB(F), C.bT(F), C.bL(F));
    const sun = P2(Lc, META.sun[0], META.sun[1]);   // солнце на фоне — ровно за лого
    gl.uniform4f(pr.u.uSun, sun[0], sun[1], C.haloBias(F), Lc.tall ? 0 : C.exitBlur(F));
    gl.uniform4f(pr.u.uLogoBox, ...META.logoTileBox);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    ok = true;
    return true;
  }
  return { ready, resize, render, invalidateText(){ textGen++; }, get ok(){ return ok; } };
}

/* =========================================================================
   ДВИЖОК СКРОЛЛА (1:1 с vibr)
   ========================================================================= */
let LANG = 'ru';
function initFilm(track){
  const stage = track.querySelector('.film__stage'), media = track.querySelector('.film__media');
  const poster = track.querySelector('.film__poster'), canvas = track.querySelector('.film__gl');
  const sr = track.querySelector('.film__sr');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const clamp = x => x < 0 ? 0 : x > 1 ? 1 : x;
  // data-film="hero" — фильм в начале страницы: карточка со скруглением с самого начала, стоит на 1-м кадре до первого скролла.
  // data-film (без значения) — фильм посреди страницы, как у vibr: карточка растёт до полного экрана, пока секция въезжает.
  const hero = track.dataset.film === 'hero';
  const fillSR = () => {
    sr.textContent = I18N[LANG].c4.replace('\n', ' ');                         // для поиска и скринридеров — слоган один раз
    track.setAttribute('aria-label', 'Safa — ' + sr.textContent);
    track.querySelectorAll('[data-film-i18n]').forEach(el => { el.textContent = I18N[LANG][el.dataset.filmI18n] || ''; });
  };
  fillSR();

  let renderer = null;
  try { renderer = createRenderer(canvas); } catch (e) { console.warn('[film] WebGL недоступен:', e); }
  // без WebGL: финальный кадр на нужном языке и короткая секция (6 экранов неподвижной картинки не нужны)
  const staticMode = () => { poster.parentElement.querySelectorAll('source').forEach(s => s.remove()); poster.src = FILM.dir + 'poster_' + LANG + '.webp?v=' + FILM.ver; poster.style.opacity = '1'; track.style.setProperty('--screens', '1'); };
  if (!renderer) staticMode();
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); renderer = null; stop(); poster.style.opacity = '1'; });   // stop() снимает и автоход
  canvas.addEventListener('webglcontextrestored', () => {
    try { renderer = createRenderer(canvas); } catch (err) { renderer = null; }
    if (!renderer) return staticMode();
    measure(); renderer.ready.then(() => { drawnF = -1; start(); });
  });

  let vw = 0, vh = 0;
  function measure(){
    vw = stage.clientWidth; vh = stage.clientHeight;
    if (!renderer) return;
    if (FORCE_RES){ renderer.resize(FORCE_RES[0], FORCE_RES[1]); return; }
    // в шапке карточка постоянного размера — рендерим ровно под неё; посреди страницы карточка растёт — под весь экран
    const rw = hero ? media.clientWidth : vw, rh = hero ? media.clientHeight : vh;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), budget = coarse ? FILM.maxPixelsMobile : FILM.maxPixels;
    const k = Math.min(dpr, Math.sqrt(budget / Math.max(1, rw * rh)));
    renderer.resize(Math.max(2, Math.round(rw * k)), Math.max(2, Math.round(rh * k)));
  }
  function setExpand(e){
    if (hero) return;                                               // размер карточки в шапке задаёт CSS (.film--hero)
    const w0 = Math.min(FILM.cardMax, vw - FILM.cardGutter), h0 = w0 * FILM.cardRatio;
    media.style.setProperty('--media-w', `${w0 + (vw - w0) * e}px`);
    media.style.setProperty('--media-h', `${h0 + (vh - h0) * e}px`);
    media.style.setProperty('--media-r', `${FILM.cardRadius * (1 - e)}px`);
  }
  let raf = 0, last = 0, P = -1, drawnF = -1;
  function draw(F, now){
    if (!renderer || Math.abs(F - drawnF) < 1e-3) return;          // кадр не изменился — не перерисовываем
    if (renderer.render(F, now / 1000, LANG)){ drawnF = F; if (poster.style.opacity !== '0') poster.style.opacity = '0'; }
  }
  const easeInOutCubic = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* ---- автопроигрывание: один жест — и страница сама едет через фильм с постоянной скоростью ----
     Скролл двигает сама программа (через Lenis, если он есть), ввод пользователя на это время блокируется.
     Вниз — весь фильм за AP.seconds, вверх — в AP.backSpeed раз быстрее. «Пропустить» / Esc — сразу в конец. */
  const AP = FILM.autoplay, skipBtn = track.querySelector('.film__skip'), root = document.documentElement;
  const SCROLL_KEYS = new Set([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End']);
  let auto = null, lastY = scrollY, cooldown = 0;
  // участок прокрутки, на котором идёт фильм: в шапке — от верха страницы; посреди страницы — с момента, как секция показалась снизу
  const range = () => { const top = track.getBoundingClientRect().top + scrollY; return [hero ? top : top - vh, top + track.offsetHeight - vh]; };
  const setScroll = y => { if (window.lenis) window.lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); };
  // путь со скоростью-трапецией: плавный разгон, ровный ход, плавное торможение
  const trap = (A, t) => {
    const { D, T, a, b } = A, v = D / (T - a / 2 - b / 2);
    if (t < a) return v * t * t / (2 * a);
    if (t < T - b) return v * a / 2 + v * (t - a);
    const tr = T - t; return D - v * tr * tr / (2 * b);
  };
  function startAuto(y0, y1, speed){
    const [ys, ye] = range(), T = AP.seconds * Math.abs(y1 - y0) / Math.max(1, ye - ys) / speed;
    if (T < .25){ setScroll(y1); return; }
    auto = { y0, D: y1 - y0, T, t: 0, a: Math.min(AP.rampIn, T * .25), b: Math.min(AP.rampOut, T * .3) };
    if (window.lenis) window.lenis.stop();
    skipBtn.hidden = false; root.classList.add('is-film-auto');      // сайт прячет меню, пока фильм идёт сам
  }
  function endAuto(){
    if (!auto) return;
    setScroll(auto.y0 + auto.D); auto = null; lastY = scrollY; cooldown = performance.now() + 450;
    if (window.lenis) window.lenis.start();
    skipBtn.hidden = true; root.classList.remove('is-film-auto');
  }
  const skip = () => { if (auto){ endAuto(); P = -1; } };
  skipBtn.addEventListener('click', skip);
  // переход по ссылке-якорю: сайт шлёт safa:jump — автоход не включается, кадр встаёт на место без промотки
  document.addEventListener('safa:jump', () => {
    if (auto){ auto = null; skipBtn.hidden = true; root.classList.remove('is-film-auto'); if (window.lenis) window.lenis.start(); }
    cooldown = performance.now() + 1500; lastY = scrollY; P = -1;
  });
  // пока фильм идёт сам — колесо, свайп и клавиши прокрутки не двигают страницу
  const block = e => {
    if (!auto) return;
    if (e.type === 'keydown'){
      if (e.key === 'Escape'){ skip(); e.preventDefault(); return; }
      if (!SCROLL_KEYS.has(e.key) || (e.target.closest && e.target.closest('button,input,textarea,select'))) return;
    }
    e.preventDefault(); e.stopPropagation();
  };
  ['wheel', 'touchmove', 'keydown'].forEach(t => addEventListener(t, block, { passive: false, capture: true }));
  function autoStep(now, dt){
    if (!AP || !renderer || reduce) return;
    if (auto){
      auto.t += dt / 1000;                                         // по накопленному dt: свёрнутая вкладка не «перепрыгивает» фильм
      if (auto.t >= auto.T) endAuto(); else setScroll(auto.y0 + trap(auto, auto.t));
      lastY = scrollY; return;
    }
    const y = scrollY, dy = y - lastY; lastY = y;
    if (Math.abs(dy) < .5 || now < cooldown) return;
    const [ys, ye] = range();
    if (dy > 0 && y > ys + (hero ? 1 : vh * AP.startAt) && y < ye - 2) startAuto(y, ye, 1);   // шапка: первый же скролл вниз
    else if (dy < 0 && y < ye - vh * AP.startAt && y > ys + 2) startAuto(y, ys, AP.backSpeed);
  }

  function tick(now){
    raf = 0;
    const fixed = DEBUG_F !== null ? DEBUG_F : reduce ? FILM.reducedF : null;
    if (fixed !== null){                                            // статичный кадр: рисуем один раз и выходим из цикла
      setExpand(1); draw(fixed, now);
      if (drawnF !== fixed) raf = requestAnimationFrame(tick);
      return;
    }
    const dt = last ? Math.min(64, now - last) : 1000 / 60; last = now;
    autoStep(now, dt);                                              // сначала двигаем страницу, потом читаем её положение
    const r = track.getBoundingClientRect();
    setExpand(easeInOutCubic(clamp((clamp(1 - r.top / vh) - FILM.expandFrom) / (1 - FILM.expandFrom))));
    // шапка: 1-й кадр, пока страница вверху; посреди страницы — как у vibr (кадры идут, пока секция въезжает)
    const c = hero ? clamp(clamp(-r.top / Math.max(1, r.height - vh)) / FILM.endAt)
                   : clamp(clamp((vh - r.top) / Math.max(1, r.height)) / FILM.endAt);
    if (P < 0) P = c;
    // на ровном автоходе инерция не нужна — скролл и так плавный; при ручном скролле — как у vibr, мягче
    P += (c - P) * (1 - Math.pow(auto ? .55 : FILM.lerp, dt / (1000 / 60)));
    if (Math.abs(c - P) < 5e-4) P = c;
    draw(1 + P * 221, now);
    if (!jsLadder.off) jsLadder.update(r);
    const atStart = P < .004 && !auto;                              // подсказка «Листайте вниз» — только на 1-м кадре
    if (atStart !== track.classList.contains('is-start')) track.classList.toggle('is-start', atStart);
    raf = requestAnimationFrame(tick);
  }
  // P = -1: после возврата в зону (якорь, Home/End) фильм встаёт на место сразу, без промотки всех промежуточных кадров
  const start = () => { if (!raf){ last = 0; P = -1; raf = requestAnimationFrame(tick); } };
  const stop = () => { if (raf){ cancelAnimationFrame(raf); raf = 0; } endAuto(); };
  const jsLadder = (() => {
    const needle = track.querySelector('.ladder__needle'), rungs = [...track.querySelectorAll('.ladder__rung')];
    const off = !needle || CSS.supports('animation-timeline: view()');
    const e = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    return { off, update(r){
      const p = clamp(-r.top / Math.max(1, r.height - vh));
      needle.style.transform = `translateY(${164 * p}px)`;
      for (const el of rungs){ const i = +el.style.getPropertyValue('--i'), l = clamp((p - (i * .05 - .15)) / .3);
        el.style.transform = `scaleX(${l < .5 ? 1 - .55 * e(l * 2) : .45 + .55 * e((l - .5) * 2)})`; }
    }};
  })();
  measure(); setExpand(reduce ? 1 : 0);
  if (reduce) track.style.setProperty('--screens', '1');
  // шрифт: грузим и кириллицу (по умолчанию load() тянет только латиницу), после загрузки текст перезапекается
  const allText = Object.values(I18N).map(t => [t.c1, t.c2, t.c3, t.c4, t.c1t, t.c2t, t.c3t].filter(Boolean).join('')).join('');
  const refreshText = () => { if (renderer){ renderer.invalidateText(); drawnF = -1; start(); } };
  if (renderer) Promise.all([renderer.ready, document.fonts ? document.fonts.load('600 40px Onest', allText).catch(() => {}) : 0]).then(refreshText);
  if (document.fonts) document.fonts.addEventListener('loadingdone', refreshText);
  new IntersectionObserver(([en]) => { if (en.isIntersecting) start(); else stop(); }, { rootMargin: '150% 0px' }).observe(track);
  addEventListener('resize', () => { measure(); drawnF = -1; start(); }, { passive: true });
  return {
    setLang(){ fillSR(); if (!renderer) poster.src = FILM.dir + 'poster_' + LANG + '.webp?v=' + FILM.ver; drawnF = -1; start(); },
    seek(f){ DEBUG_F = f === null ? null : +f; drawnF = -1; start(); },          // safaFilm.seek(150) — кадр vibr
    snapshot(f, type = 'image/jpeg'){ if (!renderer || !renderer.render(+f, performance.now() / 1000, LANG)) return null; drawnF = -1; return canvas.toDataURL(type, .88); },
    bench(f, n = 30){                                                             // safaFilm.bench(40) — мс на кадр
      if (!renderer) return null; const gl = canvas.getContext('webgl2'), px = new Uint8Array(4);
      renderer.render(+f, 0, LANG); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t0 = performance.now();
      for (let i = 0; i < n; i++){ renderer.render(+f + i * 1e-4, i / 60, LANG); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
      drawnF = -1; return +((performance.now() - t0) / n).toFixed(2);
    },
  };
}

/* ---------------------- язык ----------------------
   Язык берётся из <html lang>; сайт меняет его событием: document.dispatchEvent(new CustomEvent('safa:lang', { detail: 'uz' })).
   Если подписи на нужном языке нет — русский. */
const pick = l => I18N[l] ? l : 'ru';
LANG = pick(document.documentElement.lang);
const films = [...document.querySelectorAll('[data-film]')].map(initFilm);
if (DEBUG) window.safaFilm = films[0];
document.addEventListener('safa:lang', e => { LANG = pick(e.detail); films.forEach(f => f.setLang()); });
})();
