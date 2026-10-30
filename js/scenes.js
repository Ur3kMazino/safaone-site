/* Safa One — сцены главной под фильмом (ТЗ_главная_v2.md, движение — v3 пакет 5).
   Один движок прогресса на скролле: у каждой сцены p от 0 до 1.
     flow — секция идёт обычным потоком: p = 0, когда верх секции у низа экрана, 1 — когда низ ушёл за верх;
     pin  — внутри секции липкая сцена на экран: p = 0, когда сцена прилипла, 1 — когда отлипает.
   Пины (орбита, услуги, процесс, футер) — от 1024px; потоковые сцены движутся на любой ширине, на телефоне с меньшей амплитудой.
   При «уменьшить движение» всё стоит в финальном виде. */
(() => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
/* ---------- одна физика (5.1): те же кривые, что css-токены --e-*. У фильма свои копии — film.js не трогаем ---------- */
const out3 = t => 1 - (1 - t) ** 3, out4 = t => 1 - (1 - t) ** 4;                // quartOut — въезд (--e-enter)
const inOut3 = t => t < .5 ? 4 * t ** 3 : 1 - (2 - 2 * t) ** 3 / 2;                // easeInOutCubic — перелёт (--e-travel)
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// монотонный кубический сплайн по точкам [[x, v], …] — гладко и без перелётов (как в film.js)
function mono(pts){
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), d = [], m = [];
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
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
// посадка стекла — --e-settle из css: linear() по тем же точкам (перелёт 5% и возврат)
const SETTLE = [[0, 0], [.07, .5], [.15, .86], [.25, 1.03], [.31, 1.05], [.45, 1.01], [.6, .995], [1, 1]];
const settle = t => { t = clamp(t); let i = 1; while (t > SETTLE[i][0]) i++; const [x0, y0] = SETTLE[i - 1], [x1, y1] = SETTLE[i]; return y0 + (y1 - y0) * (t - x0) / (x1 - x0); };
const reduceMq = matchMedia('(prefers-reduced-motion: reduce)'), wideMq = matchMedia('(min-width: 1024px)');
const flowLive = () => !reduceMq.matches;                            // манифест, «Почему мы», Fleet, GPS, Pay, контакт — на любой ширине
const pinLive = () => wideMq.matches && flowLive();                  // орбита, услуги, процесс, футер — от 1024px
const amp = () => Math.min(1, innerWidth / 1024);                    // на телефоне амплитуды сдвигов меньше

/* ---------- строки заголовков выезжают из-под маски, абзацы проявляются ---------- */
$$('[data-mask]').forEach(m => $$('.ln', m).forEach((l, i) => l.style.setProperty('--k', i)));
// мастхеды Fleet / GPS / Pay — по буквам (span.ch, слово уже aria-hidden): маска поднимает буквы с шагом 40 ms, у каждого слова свой жест (5.4)
const masts = $$('.sp__mast');
masts.forEach(m => {
  const w = $('.ln>span', m), t = w && w.firstChild;
  if (!t || t.nodeType !== 3) return;
  const f = document.createDocumentFragment();
  [...t.data].forEach((c, i) => { const s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', i); s.textContent = c; f.append(s); });
  t.replaceWith(f); m.classList.add('is-split');
});
// у букв GPS и Pay общий фон слова: каждая показывает свой кусок (--ww — ширина слова, --x — сдвиг буквы от его начала)
function mastMeasure(){
  masts.forEach(m => {
    const w = $('.ln>span', m);
    m.style.setProperty('--ww', `${w.offsetWidth}px`);
    $$('.ch', w).forEach(c => c.style.setProperty('--x', `${c.offsetLeft - w.offsetLeft}px`));
  });
}
const revealIo = new IntersectionObserver(es => es.forEach(en => {
  if (!en.isIntersecting) return;
  en.target.classList.add('is-in'); revealIo.unobserve(en.target);
}), { rootMargin: '0px 0px -10% 0px', threshold: .15 });
$$('[data-mask], [data-fade]').forEach(el => reduceMq.matches ? el.classList.add('is-in') : revealIo.observe(el));

/* ---------- «бизнес» на 9 колонок, телефон на всю ширину сетки ---------- */
function fit(){
  $$('[data-fit]').forEach(el => {
    const grid = el.closest('.grid'), cs = getComputedStyle(grid);
    const cols = cs.gridTemplateColumns.split(' ').length, gap = parseFloat(cs.columnGap) || 0;
    const inner = grid.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const n = Math.min(+el.dataset.fit, cols), col = (inner - gap * (cols - 1)) / cols;
    const target = n * col + (n - 1) * gap;
    const box = el.matches('a') ? el.firstElementChild : el;          // у ссылки-телефона меряем сам текст
    el.style.whiteSpace = 'nowrap'; el.style.fontSize = '100px';
    el.style.fontSize = `${(100 * target / box.getBoundingClientRect().width).toFixed(2)}px`;
  });
}

/* ---------- SVG-линии в пикселях блока ----------
   Линии нарисованы в условных координатах и растянуты preserveAspectRatio="none". Прорисовка штрихом (pathLength)
   на растянутой линии считается с ошибкой, поэтому пересчитываем координаты под реальный размер блока. */
function pxSvg(svg, vw, vh){
  const r = svg.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const sx = r.width / vw, sy = r.height / vh;
  svg.setAttribute('viewBox', `0 0 ${r.width.toFixed(1)} ${r.height.toFixed(1)}`);
  $$('path', svg).forEach(path => {
    path.dataset.d ??= path.getAttribute('d');
    path.setAttribute('d', path.dataset.d.replace(/(-?\d*\.?\d+)[ ,]+(-?\d*\.?\d+)/g, (m, x, y) => `${(x * sx).toFixed(1)} ${(y * sy).toFixed(1)}`));
  });
  $$('circle', svg).forEach(c => {
    c.dataset.c ??= `${c.getAttribute('cx')} ${c.getAttribute('cy')}`;
    const [x, y] = c.dataset.c.split(' ');
    c.setAttribute('cx', (x * sx).toFixed(1)); c.setAttribute('cy', (y * sy).toFixed(1));
  });
}

/* ---------- купол: верхний край полотна — горизонт планеты из фильма, распрямляется, пока манифест поднимается к середине экрана ----------
   Это форма края, а не движение предметов, поэтому работает на любой ширине; при «уменьшить движение» край сразу прямой */
const canvas = $('.canvas'), man = $('.s-man');
let dome = -1, manTop = 0;
const setDome = v => { v = Math.round(v * 1000) / 1000; if (v !== dome) canvas.style.setProperty('--dome', dome = v); };

/* ---------- движок прогресса ----------
   У сцены свой режим жизни: пины — pinLive, потоковые — flowLive. Выключилась — один раз встаёт в финальный вид (final) */
const scenes = [];
const scene = (el, mode, run, final, live = mode === 'pin' ? pinLive : flowLive) => el && scenes.push({ el, mode, run, final, live, was: null, top: 0, h: 0 });
function measure(){
  const y = scrollY;
  scenes.forEach(s => { const r = s.el.getBoundingClientRect(); s.top = r.top + y; s.h = r.height; });
  manTop = man.getBoundingClientRect().top + y;
}
let lastY = scrollY, lastT = performance.now(), vel = 0, raf = 0, settling = false;
function tick(){
  raf = 0; settling = false;
  const y = scrollY, vh = innerHeight, now = performance.now();
  vel = lerp(vel, (y - lastY) / Math.max(8, now - lastT) * 16, .25);  // px за кадр, сглаженная
  lastY = y; lastT = now;
  setDome(reduceMq.matches ? 1 : clamp((vh * .8 - (manTop - y)) / (vh * .5)));
  stepBodies(vh);                                                     // вес до сцен: GPS пересчитывает маршрут от сдвинутой карты
  for (const s of scenes){
    const on = s.live();
    if (on !== s.was){ s.was = on; if (!on && s.final) s.final(); }
    if (!on) continue;
    const top = s.top - y;
    if (top > vh * 1.4 || top + s.h < -vh * .4) continue;              // далеко от экрана — не трогаем
    const p = s.mode === 'pin' ? clamp(-top / Math.max(1, s.h - vh)) : clamp((vh - top) / (vh + s.h));
    s.run(p, top, vh, s.h);
  }
  if (Math.abs(vel) > .05 || settling) schedule();                    // доводим пружины в покой после остановки
}
const schedule = () => { if (!raf) raf = requestAnimationFrame(tick); };
addEventListener('scroll', schedule, { passive: true });

/* ---------- вес у стекла и макетов (5.9) ----------
   Предмет отстаёт от середины экрана на depth (сглаживание k: макеты .16, стекло .09) и наклоняется пружиной от скорости скролла.
   Пишем --by/--br: css складывает их со своими translate/rotate, transform остаётся сценам. В покое — .is-still (дыхание) */
const bodies = [];
const body = (el, depth, k, o = {}) => el && bodies.push({ el, depth, k, tilt: o.tilt ?? 1, live: o.live || flowLive, cb: o.cb, ty: 0, r: 0, on: false });
function stepBodies(vh){
  const m = amp(), rg = clamp(-vel * .12, -5, 5);
  for (const b of bodies){
    if (!b.live() || !b.el.offsetParent){                             // выключено или скрыто (тела футера ждут монет)
      if (b.on){ b.on = false; b.ty = b.r = 0; b.el.style.removeProperty('--by'); b.el.style.removeProperty('--br'); b.el.classList.remove('is-still'); if (b.cb) b.cb(); }
      continue;
    }
    const rc = b.el.getBoundingClientRect(), cy = rc.top + rc.height / 2 - b.ty;
    if (cy < -vh || cy > vh * 2) continue;
    const gy = clamp(b.depth * (cy - vh / 2) * .08, -60, 60) * m, gr = rg * b.tilt * m, ty0 = b.ty, r0 = b.r;
    b.ty = lerp(b.ty, gy, b.k); b.r = lerp(b.r, gr, b.k);
    const still = Math.abs(b.ty - gy) < .1 && Math.abs(b.r - gr) < .02;
    if (still){ b.ty = gy; b.r = gr; } else settling = true;
    b.on = true;
    b.el.style.setProperty('--by', `${b.ty.toFixed(2)}px`); b.el.style.setProperty('--br', `${b.r.toFixed(3)}deg`);
    b.el.classList.toggle('is-still', still && Math.abs(vel) < .3);
    if (b.cb && (Math.abs(b.ty - ty0) > .05 || Math.abs(b.r - r0) > .005)) b.cb();
  }
}

/* ---------- 1. Манифест: «двигают» плывёт и наклоняется от скорости, «бизнес» доезжает на место ---------- */
const move = $('.man__move'), biz = $('.ln--biz');
let sk = 0;
scene(man, 'flow', p => {
  // дрейф и наклон — только от скорости: в покое перед «двигают» обычный пробел, без дыры. На телефоне амплитуда × m
  const m = amp(), goal = clamp(-vel * .22, -6, 6) * m;
  sk = lerp(sk, goal, .12);                                           // наклон догоняет скорость пружиной
  if (Math.abs(sk - goal) > .02) settling = true; else sk = goal;
  move.style.setProperty('--mx', `${(clamp(-vel * 1.4, -28, 28) * m).toFixed(1)}px`);
  move.style.setProperty('--sk', `${sk.toFixed(2)}deg`);
  biz.style.translate = `${(4 * m * (1 - out4(clamp((p - .1) / .35)))).toFixed(3)}cqw 0`;   // «бизнес» доезжает и встаёт
}, () => { sk = 0; move.style.cssText = ''; biz.style.translate = ''; });

/* ---------- 2. Почему мы: слова заливаются по мере чтения, предметы выпрыгивают ---------- */
const read = $('[data-read]');
(function wrapWords(node){
  [...node.childNodes].forEach(n => {
    if (n.nodeType === 1){ wrapWords(n); return; }
    if (n.nodeType !== 3 || !n.textContent.trim()) return;
    const frag = document.createDocumentFragment();
    n.textContent.split(/([ \t\r\n]+)/).forEach(part => {            // неразрывный пробел слова не делит
      if (!part) return;
      if (/^[ \t\r\n]+$/.test(part)) frag.append(part);
      else { const w = document.createElement('span'); w.className = 'w'; w.textContent = part; frag.append(w); }
    });
    n.replaceWith(frag);
  });
})(read);
const readItems = $$('.w, .ri, .rl', read);
let readK = -1;
const setRead = k => {
  if (k === readK) return;
  readItems.forEach((el, i) => el.classList.toggle('is-on', i < k)); readK = k;
};
scene(read, 'flow', (p, top, vh, h) => setRead(Math.round(clamp((vh * .85 - top) / (h + vh * .45)) * readItems.length)),
  () => setRead(readItems.length));

/* ---------- 3. Три продукта: машина, пин и карта по наклонной орбите сквозь заголовок ----------
   Задняя половина пути идёт за буквами (z 1 < заголовок 2), передняя — поверх (3).
   Орбита идёт с остановками (5.2): каждый продукт стоит впереди, строка списка меняется в начале его остановки; на p = 1 спереди снова машина.
   На подходе тела влетают на свои места, кольцо прорисовывается; в конце пина машина уезжает вниз — во Fleet (5.3) */
const ov = $('.s-ov'), ovBodies = $$('.ov__body'), ovShadows = $$('.ov__sh'), ovRings = $$('.ov__ring'), ovJobs = $$('.ov__jobs li'), stage = $('.ov__stage');
const ovOrbit = $('.ov__orbit'), ovList = $('.ov__jobs'), ovTitle = $('.ov__title'), OV_TILT = -9;
const OV_GAP = [-.04, .04, .06];                                       // тень на полу ниже тела на долю его высоты: машина стоит, пин и карта парят
const OV_S = mono([[0, 0], [.16, 0], [.28, 1 / 3], [.44, 1 / 3], [.56, 2 / 3], [.72, 2 / 3], [.84, 1], [1, 1]]);   // доля оборота
const OV_JOB = p => p >= .84 ? 0 : p >= .56 ? 2 : p >= .28 ? 1 : 0;   // кто стоит впереди с начала своей остановки
const OV_RING = ovRings.map(r => $('path', r).getAttribute('d'));
let ovFront = null, orb = null;
function ovGeom(){
  const W = stage.clientWidth, t = OV_TILT * Math.PI / 180, size = ovBodies.map(b => [b.offsetWidth, b.offsetHeight]);
  // крайняя точка тел на пути (с их размером на этом месте, k — общий масштаб тел) по оси f: f(x, y) — координата центра, i — 0 ширина / 1 высота
  const edge = (rx, k, f, i) => {
    let m = -1e9;
    for (let a = 0; a < 360; a += 4){
      const th = a * Math.PI / 180, d = (Math.sin(th) + 1) / 2, c = f(rx * Math.cos(th), rx * .27 * Math.sin(th));
      size.forEach(s => { m = Math.max(m, c + s[i] * k * (.48 + .62 * d) / 2); });
    }
    return m;
  };
  // rx по ТЗ, но тела справа не уходят за край полотна (на 1280–1440 машина у края обрезалась). .43 — место справа от центра (.ov__orbit left:57%)
  let rx = Math.min(W * .33, innerHeight * .58);
  for (let i = 0, over; i < 3 && (over = edge(rx, 1, (x, y) => x * Math.cos(t) - y * Math.sin(t), 0) - W * .43 + 16) > 0; i++) rx -= over;
  // центр на 49% высоты, но самая низкая точка тел (спереди слева — туда наклон опускает кольцо) остаётся над списком «каждый…».
  // Переднее тело заходит на нижнюю строку заголовка не больше чем на 60% её высоты; на низких экранах (1366×657) для этого тела чуть уменьшаются
  const ry = rx * .27, lh = parseFloat(getComputedStyle(ovTitle).fontSize) * .86, roof = ovTitle.offsetTop + ovTitle.offsetHeight - lh * .6;
  const hMax = Math.max(...size.map(s => s[1]));
  let k = 1, cy = 0;
  for (; k > .6; k -= .02){
    cy = Math.min(stage.clientHeight * .49, ovList.offsetTop - 16 - edge(rx, k, (x, y) => x * Math.sin(t) + y * Math.cos(t), 1));
    if (cy + ry * Math.cos(t) - hMax * k * .55 >= roof) break;
  }
  ovOrbit.style.top = `${cy.toFixed(1)}px`;
  ovShadows.forEach((sh, i) => { const w = size[i][0] * .8; sh.style.width = `${w.toFixed(1)}px`; sh.style.height = `${(w * .15).toFixed(1)}px`; });
  // кольцо — две дуги одной геометрии: задняя за буквами, передняя поверх
  ovRings.forEach(r => r.style.cssText = `left:${(-rx).toFixed(1)}px;top:${(-ry).toFixed(1)}px;width:${(2 * rx).toFixed(1)}px;height:${(2 * ry).toFixed(1)}px;transform:rotate(${OV_TILT}deg)`);
  orb = { rx, ry, t, k, size };
}
// pre — подлёт (0 → 1, пока сцена поднимается от низа экрана к верху): тело k летит с (+45vw, +25vh, ×.3, ±20°, прозрачное), quart-out, задержка .12k;
// кольцо прорисовывается на второй половине подлёта.
// q — склейка с Fleet (p .88 → 1): машина растёт до ×1.6 и уходит вниз на 30vh, пин гаснет вверх, карта — вправо
function placeOrbit(p, pre = 1){
  if (!orb) ovGeom();
  const S = OV_S(p), q = clamp((p - .88) / .12), oq = out3(q), vw = innerWidth, vh = innerHeight;
  ovBodies.forEach((b, k) => {
    const th = (90 - 360 * S + 120 * k) * Math.PI / 180, c = Math.cos(th);
    const x = orb.rx * c, y = orb.ry * Math.sin(th), d = (Math.sin(th) + 1) / 2;
    let X = x * Math.cos(orb.t) - y * Math.sin(orb.t), Y = x * Math.sin(orb.t) + y * Math.cos(orb.t);
    const [w, h] = orb.size[k], e = out4(clamp((pre - .3 - .12 * k) / .46)), f = 1 - e;   // до pre .3 центр орбиты ещё под низом экрана — полёт был бы не виден
    let s = (.48 + .62 * d) * orb.k * (.3 + .7 * e), o = (.55 + .45 * d) * e, rot = -c * 9 + f * (k % 2 ? -20 : 20);   // наклон по ходу движения
    X += f * .45 * vw; Y += f * .25 * vh;
    if (k === 0){ s *= (1.1 + .5 * oq) / 1.1; Y += oq * .3 * vh; }
    else { o *= 1 - q; if (k === 1) Y -= oq * .2 * vh; else X += oq * .2 * vw; }
    const sx = k === 2 ? .55 + .45 * d : 1, z = d > .5 ? 3 : 1, sw = w * .8;   // карта сзади видна ребром
    b.style.transform = `translate(${(X - w / 2).toFixed(1)}px,${(Y - h / 2).toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${(s * sx).toFixed(3)},${s.toFixed(3)})`;
    b.style.opacity = o.toFixed(3); b.style.zIndex = z;
    b.style.setProperty('--far', clamp((.5 - d) / .5).toFixed(2));    // дальняя половина пути бледнеет вместо размытия
    // тень на полу: .8 ширины тела, высота .15 от своей ширины, прозрачность как у тела
    const sh = ovShadows[k];
    sh.style.transform = `translate(${(X - sw / 2).toFixed(1)}px,${(Y + h * s * (.5 + OV_GAP[k]) - sw * .075).toFixed(1)}px) scale(${(s * sx).toFixed(3)},${s.toFixed(3)})`;
    sh.style.opacity = o.toFixed(3); sh.style.zIndex = z;
  });
  ovList.style.opacity = (1 - oq).toFixed(3);                         // машина уходит вниз через список — он гаснет, Fleet повторяет его строку
}
// кольцо прорисовывается одной линией: задняя дуга слева через верх направо, затем передняя справа через низ налево (t 0 → 1)
function ringDraw(t){
  const pt = (u, s) => { const a = Math.PI * clamp(u); return `${(-s * 100 * Math.cos(a)).toFixed(2)} ${(-s * 27 * Math.sin(a)).toFixed(2)}`; };
  $('path', ovRings[0]).setAttribute('d', t >= 1 ? OV_RING[0] : `M-100 0 A100 27 0 0 1 ${pt(t * 2, 1)}`);
  $('path', ovRings[1]).setAttribute('d', t >= 1 ? OV_RING[1] : `M100 0 A100 27 0 0 1 ${pt(t * 2 - 1, -1)}`);
}
const setJob = k => {                                                 // k < 0 — все строки разом: кадр без движения
  if (k === ovFront) return;
  ovJobs.forEach((li, i) => li.classList.toggle('is-on', k < 0 || i === k)); ovFront = k;
};
let ovRingT = -1;
scene(ov, 'pin', (p, top, vh, h) => {
  const pre = clamp(1 - top / vh), rt = inOut3(clamp((pre - .45) / .55));
  placeOrbit(p, pre); setJob(OV_JOB(p));
  if (rt !== ovRingT) ringDraw(ovRingT = rt);
  // на экране всегда одна машина: когда пин кончился и снизу пошёл Fleet, её везёт машина Fleet (с той же точки и того же размера)
  const gone = top + h <= vh + .5 ? 'hidden' : '';
  ovBodies[0].style.visibility = ovShadows[0].style.visibility = gone;
}, () => {
  // без пина: от 1024px — та же композиция в покое, на телефоне — кадр из CSS
  orb = null; ovRingT = -1; ringDraw(1);
  ovBodies[0].style.visibility = ovShadows[0].style.visibility = '';
  if (wideMq.matches){
    // кадр как после склейки: впереди пин, машины в орбите нет — на экране одна машина, во Fleet ниже
    placeOrbit(.36); ovBodies[0].style.visibility = ovShadows[0].style.visibility = 'hidden';
  } else {
    [ovOrbit, ...ovBodies, ...ovRings].forEach(el => el.style.cssText = '');
    // кадр на телефоне: тела стоят по местам из CSS, тени — под ними
    ovBodies.forEach((b, k) => {
      const w = b.offsetWidth, sw = w * .8;
      ovShadows[k].style.cssText = `width:${sw.toFixed(1)}px;height:${(sw * .15).toFixed(1)}px;z-index:${getComputedStyle(b).zIndex};` +
        `transform:translate(${(b.offsetLeft + w * .1).toFixed(1)}px,${(b.offsetTop + b.offsetHeight * (1 + OV_GAP[k]) - sw * .075).toFixed(1)}px)`;
    });
  }
  ovList.style.opacity = ''; setJob(-1);
});

/* ---------- макеты устройств: словарь Fleet, GPS и PAY — аватары, одометр, статус и чип документа (devices-system) ---------- */
const NB = ' ';                                                       // разряды сумм — узкий неразрывный
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
const wait = ms => new Promise(r => setTimeout(r, reduceMq.matches ? 0 : ms));
// аватар: цвет по хешу инициалов (djb2-xor), 4 пары
const avaHash = s => { let h = 5381; for (const c of s) h = (Math.imul(h, 33) ^ c.codePointAt(0)) >>> 0; return h % 4; };
$$('.ava[data-i]').forEach(a => a.dataset.c = avaHash(a.dataset.i));
// одометр: прокручиваются только изменившиеся разряды
function roll(el, to){
  const from = el.textContent.trim(), t = String(to);
  if (from === t) return;
  const up = +t > +from, n = Math.max(from.length, t.length), a = from.padStart(n, ' '), b = t.padStart(n, ' ');
  const lh = parseFloat(getComputedStyle(el).lineHeight) || el.getBoundingClientRect().height;
  el.textContent = '';
  for (let i = 0; i < n; i++){
    if (a[i] === b[i]){ el.append(b[i]); continue; }
    const w = document.createElement('span'), s = document.createElement('span');
    w.className = 'rd'; w.style.height = `${lh}px`; s.className = 'rd__s';
    const cell = c => `<i style="height:${lh}px">${c.trim() || '&nbsp;'}</i>`;
    s.innerHTML = up ? cell(a[i]) + cell(b[i]) : cell(b[i]) + cell(a[i]);
    s.style.transform = up ? 'translateY(0)' : `translateY(${-lh}px)`;
    w.append(s); el.append(w);
    s.getBoundingClientRect();
    s.style.transform = up ? `translateY(${-lh}px)` : 'translateY(0)';
  }
  setTimeout(() => { el.textContent = t; }, reduceMq.matches ? 0 : 520);
}
// текст маской: старая строка уходит вверх, новая приходит снизу, ширина едет по ширине новой
function swapText(t, html){
  const old = t.firstElementChild, nw = document.createElement('span');
  nw.innerHTML = html;
  t.style.width = `${t.getBoundingClientRect().width / (t.currentCSSZoom || 1)}px`;
  old.classList.add('is-out');
  nw.style.transform = 'translateY(100%)'; nw.style.opacity = '0';
  t.append(nw);
  const w = nw.scrollWidth;
  t.getBoundingClientRect();
  t.style.width = `${w}px`;
  old.style.transform = 'translateY(-100%)'; old.style.opacity = '0';
  nw.style.transform = 'translateY(0)'; nw.style.opacity = '1';
  setTimeout(() => { old.remove(); t.style.width = ''; nw.removeAttribute('style'); }, reduceMq.matches ? 0 : 480);
}
function setStatus(st, kind, html){
  st.classList.remove('st--wait', 'st--off'); if (kind) st.classList.add(`st--${kind}`);
  swapText($('.st__t', st), html);
}
// чип документа: фон и цвет за 240 ms, иконка гаснет и возвращается новой, текст меняется маской
async function setDoc(chip, kind, icon, html){
  chip.classList.add('is-swap');
  chip.classList.remove('doc--warn', 'doc--bad'); if (kind !== 'ok') chip.classList.add(`doc--${kind}`);
  if (html) swapText($('.doc__t', chip), html);
  await wait(120);
  $('use', chip).setAttribute('href', `#d-${icon}`);
  chip.classList.remove('is-swap');
  await wait(360);
}

/* ---------- 4. Fleet: машина приезжает из орбиты, колонна букв смыкается под неё; Каримов проходит проверку ----------
   Сюжет один раз, когда окно видно на 60%, на любой ширине; при «уменьшить движение» — сразу конечное состояние (wait → 0, переходы выключены в css) */
const fleet = $('.sp--fleet'), car = $('.sp__hero', fleet), fleetMock = $('.sp__mock', fleet), bw = $('.bw', fleet), fleetChs = $$('.sp__mast .ch', fleet);
// склейка (5.3): машина Fleet стартует ровно там и того же размера, где машина орбиты кончила пин (впереди, ниже на 30vh, ×1.6).
// Меряем обе точки: заданные в ТЗ translate(0,−35%) scale(1.25) ставили её на 120–280px правее и ниже — на экране было две машины
let hand = null;
function handGeom(vh){
  if (!orb) ovGeom();
  const [w] = orb.size[0], st = stage.getBoundingClientRect();
  const cx = st.left + ovOrbit.offsetLeft - orb.ry * Math.sin(orb.t), cy = ovOrbit.offsetTop + orb.ry * Math.cos(orb.t) + .3 * vh;   // сцена в конце пина — у верха экрана
  const tr = car.style.transform; car.style.transform = 'none';
  const r = car.getBoundingClientRect(), top = r.top - fleet.getBoundingClientRect().top;
  car.style.transform = tr;
  const ch = r.height || r.width * orb.size[0][1] / orb.size[0][0];   // картинка ленивая: пока не загрузилась, высота блока 0 — берём пропорции машины орбиты
  hand = { dx: cx - (r.left + r.width / 2), dy: cy - (vh + top + ch / 2), s0: w * 1.6 * orb.k / r.width };
}
$('img', car).addEventListener('load', () => { hand = null; schedule(); });
scene(fleet, 'flow', (p, top, vh) => {
  // колонна смыкается: буква i едет из (i + 1)·2.6cqw, шаг .025·i на p .04–.36 — «t» приходит последней, вместе с машиной
  fleetChs.forEach((c, i) => { c.style.translate = `${((i + 1) * 2.6 * (1 - out4(clamp((p - .04 - .025 * i) / .22)))).toFixed(3)}cqw 0`; });
  if (pinLive()){
    if (!hand) handGeom(vh);
    // перелёт без рывка (скорость в момент передачи — как у страницы), к p .35 на месте; «тормозит»: ×1.03 → 1 на p .30–.40
    const e = inOut3(clamp(p / .35)), s = p < .3 ? lerp(hand.s0, 1.03, inOut3(p / .3)) : lerp(1.03, 1, out3(clamp((p - .3) / .1)));
    car.style.transform = `translate(${(hand.dx * (1 - e)).toFixed(1)}px,${(hand.dy * (1 - e)).toFixed(1)}px) scale(${s.toFixed(4)})`;
    car.style.visibility = top > vh + .5 ? 'hidden' : '';              // до конца пина орбиты машину ещё везёт орбита
  } else {
    // телефон: машина въезжает справа (в орбите её нет)
    const e = out4(clamp((p - .04) / .32));
    car.style.transform = `translateX(${(24 * (1 - e)).toFixed(2)}%) scale(${(.85 + .15 * e).toFixed(4)})`;
    car.style.visibility = '';
  }
}, () => { car.style.cssText = ''; fleetChs.forEach(c => c.style.translate = ''); });
async function playFleet(){
  const row = $('[data-story]', bw);
  await setDoc($('[data-k="docs"]', row), 'ok', 'ok', '4&nbsp;из&nbsp;4');   // 1. «ОСГО на проверке» → «4 из 4»
  await wait(160);
  setStatus($('.st', row), '', 'Активен');                                     // 2. «На проверке» → «Активен», счётчики вкладок
  roll($('[data-roll="act"]', bw), 231);
  roll($('[data-roll="wait"]', bw), 12);
  await wait(500);
  row.classList.add('is-checked');                                             // 3. ячейка двухстрочная: «Проверено 08:15»
}
const fleetIo = new IntersectionObserver(es => {
  if (!es[0].isIntersecting) return;
  fleetIo.disconnect();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(playFleet);
}, { threshold: .6 });
fleetIo.observe(bw);

/* ---------- 5. GPS: маршрут прорисовывается поверх букв, в конец падает пин; на iPad едет машина ----------
   Экран диспетчера (gps-screen): d2 0 → 1 — Каримов выезжает со стоянки в геозоне «Центр» и едет по r1 в обратную сторону.
   Часы, пробег, «Поездка», скорость и время события считаются из одного d2 */
function gpsScreen(root){
  // копия ключа r1 из img/map_tashkent_route.json (координаты растра 1600×1000). Последнюю точку — двор внутри геозоны — отбрасываем: путь начинается на улице, без «крючка»
  const R1 = { km: 2.93, d: 'M230.5 768.8 L242.8 767.0 L250.8 762.9 L322.9 534.9 L386.6 555.4 L604.8 622.5 L620.2 629.1 L629.3 633.9 L640.7 641.5 L715.2 708.2 L767.0 756.4 L776.1 759.2 L782.0 756.3 L821.7 515.0 L824.5 509.3 L828.6 506.0 L834.0 504.3 L842.4 503.2 L858.2 504.2 L869.3 502.3 L880.0 497.0 L889.0 488.0 L894.4 479.6 L899.6 468.5 L904.8 452.2 L906.6 440.6 L908.5 405.0 L910.5 399.7 L914.8 395.3 L1108.0 280.7 L1121.7 312.5' };
  const ZONE = { cx: 1121.7, cy: 312.5, r: 105 };                     // геозона «Центр» вокруг r1.end; R 105 — иначе с полями не помещается в кадр
  const TRIP = 5, T0 = 8 * 60 + 41 + 40 / 60;                         // 2,8 км за 5 мин при 40–52 км/ч; старт 08:41:40
  const g = n => $(`[data-g="${n}"]`, root);
  const scr = $('.gscr', root), svg = $('.gmap__svg', root), map = $('.gmap', root), zoneTag = $('.gzone-tag', root);
  const plan = g('plan'), cas = g('case'), done = g('done'), zone = g('zone'), ping = g('ping'), gStart = g('start'), gDest = g('dest');
  const veh = $('.veh', root), arrow = $('.veh__arrow', root), vehPlate = $('.veh__plate', root), gcar = $('.gcar', root), mini = $('.gmini', root);
  const stTxt = g('stTxt'), stKm = g('stKm'), stMin = g('stMin'), miniV = g('miniV'), clk = g('clk'), segGo = g('segGo'), segStop = g('segStop');
  const evZone = $('.gev__row--zone', root), toast = $('.gtoast', root), reelT = $('.spd__d--t', root), tapes = $$('.spd__tape', root);

  const ptsAll = R1.d.match(/-?\d+(\.\d+)?/g).map(Number).reduce((a, v, i) => (i % 2 ? a[a.length - 1].push(v) : a.push([v]), a), []);
  const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  tmp.setAttribute('d', R1.d);
  const Lfull = tmp.getTotalLength(), pts = ptsAll.slice(0, -1).reverse(), dPath = `M${pts.map(p => p.join(' ')).join(' L')}`;
  [plan, cas, done].forEach(p => p.setAttribute('d', dPath));
  const L = done.getTotalLength(), KM = R1.km * L / Lfull, M_PER_U = R1.km * 1000 / Lfull, S0 = pts[0];
  gStart.setAttribute('cx', S0[0]); gStart.setAttribute('cy', S0[1]); zone.setAttribute('r', ZONE.r); ping.setAttribute('r', ZONE.r);
  // d2 пересечения границы геозоны (бинарный поиск) и время события — из тех же часов: 08:42
  const outAt = len => { const p = done.getPointAtLength(len); return Math.hypot(p.x - ZONE.cx, p.y - ZONE.cy) > ZONE.r; };
  let lo = 0, hi = L;
  for (let i = 0; i < 30; i++){ const m = (lo + hi) / 2; outAt(m) ? hi = m : lo = m; }
  const CROSS = hi / L, TOAST_FOR = .25;
  const hhmm = m => { m = Math.floor(m + 1e-6); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  $$('.js-evt', root).forEach(e => e.textContent = hhmm(T0 + TRIP * CROSS));
  const fmt1 = x => (Math.floor(x * 10 + 1e-6) / 10).toFixed(1).replace('.', ',');
  const narrow = () => root.parentElement.clientWidth < 560;          // телефонный режим — по ширине iPad, как @container в css
  const css = n => getComputedStyle(scr).getPropertyValue(n).trim();

  // кадр карты — от содержимого: весь маршрут и геозона с полями, сверху запас под статус-бар; растр 1600×1000 всегда покрывает экран
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const BB = { rx0: Math.min(...xs), rx1: Math.max(...xs), ry0: Math.min(...ys), ry1: Math.max(...ys),
               zx0: ZONE.cx - ZONE.r, zx1: ZONE.cx + ZONE.r, zy0: ZONE.cy - ZONE.r, zy1: ZONE.cy + ZONE.r };
  function frame(){
    const W = map.clientWidth, H = map.clientHeight, n = narrow();
    if (!W || !H) return;
    const mc = n ? 16 + 9 : 24 + 11, mz = n ? 8 : 12, top = n ? 12 : 22 + 10;   // центр машины и финиша: поле + радиус диска; граница геозоны; статус-бар
    const ex = Math.max(BB.rx1, BB.zx1) - Math.min(BB.rx0, BB.zx0), ey = Math.max(BB.ry1, BB.zy1) - Math.min(BB.ry0, BB.zy0);
    const s = Math.max(Math.min((W - 2 * mc) / ex, (H - 2 * mc) / ey), Math.max(W / 1600, H / 1000)), w = W / s, h = H / s;
    const axis = (a, b, size, max) => clamp((a + b) / 2, 0, max - size);
    const x0 = axis(Math.max(BB.rx1 + mc / s, BB.zx1 + mz / s) - w, Math.min(BB.rx0 - mc / s, BB.zx0 - mz / s), w, 1600);
    const y0 = axis(Math.max(BB.ry1 + mc / s, BB.zy1 + mz / s) - h, Math.min(BB.ry0 - mc / s, BB.zy0 - top / s), h, 1000);
    svg.setAttribute('viewBox', `${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
  }
  // k — zoom рамки (ступени в css): px внутри iPad ≠ px экрана; s — px экрана на единицу карты
  let k = 1, s = 1;
  const toScr = (x, y) => {
    const p = svg.createSVGPoint(); p.x = x; p.y = y;
    const q = p.matrixTransform(svg.getScreenCTM()), r = map.getBoundingClientRect();
    return [(q.x - r.left) / k, (q.y - r.top) / k];
  };
  function measure(){
    frame();
    const ctm = svg.getScreenCTM();
    if (!ctm || !map.clientWidth) return;
    s = ctm.a; k = root.currentCSSZoom || root.getBoundingClientRect().width / root.offsetWidth || 1;
    const u = px => px * k / s, n = narrow();                          // px внутри iPad → единицы карты
    plan.style.strokeWidth = u(+css('--w-plan')); cas.style.strokeWidth = u(+css('--w-case'));
    done.style.strokeWidth = u(+css('--w-line')); zone.style.strokeWidth = u(+css('--w-zone')); ping.style.strokeWidth = u(1.5);
    zone.style.strokeDasharray = css('--zone-dash').split(/\s+/).map(v => u(+v)).join(' ');
    gStart.setAttribute('r', u(n ? 3.5 : 4.5)); gDest.setAttribute('r', u(n ? 4.5 : 6));
    $('.gscale i', root).style.width = `${(200 / M_PER_U * s / k).toFixed(1)}px`;   // линейка «200 м»
    const t = toScr(ZONE.cx, ZONE.cy + ZONE.r);                       // «Центр» — на нижней кромке зоны: сверху идёт линия к слову
    zoneTag.style.left = `${t[0]}px`; zoneTag.style.top = `${t[1]}px`;
  }
  // скорость — барабаны цифр; без анимации, когда кадр ставится сразу (snap)
  let lastV = -1;
  const noAnim = snap => { if (!snap) return; root.classList.add('no-anim'); requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-anim'))); };
  function setSpeed(v){
    if (v === lastV) return; lastV = v;
    tapes[0].style.transform = `translateY(${-Math.floor(v / 10)}em)`;
    tapes[1].style.transform = `translateY(${-(v % 10)}em)`;
    reelT.classList.toggle('is-off', v < 10);
    miniV.textContent = v;
  }
  // угол стрелки сглаживается
  let ang = null, angT = 0, araf = 0;
  const stepAng = () => {
    araf = 0;
    const d = ((angT - ang + 540) % 360) - 180;
    ang += d * .25; if (Math.abs(d) < .2) ang = angT; else araf = requestAnimationFrame(stepAng);
    arrow.style.transform = `rotate(${ang}deg)`;
  };
  const spinTo = (a, snap) => {
    angT = a;
    if (ang === null || snap || reduceMq.matches){ ang = a; arrow.style.transform = `rotate(${ang}deg)`; return; }
    if (!araf) araf = requestAnimationFrame(stepAng);
  };
  // номер на карте — против хвоста пути (точка на len − 40), с гистерезисом 8px; у правого края — слева, у левого — справа
  let left = false;
  function plateSide(len, x){
    const tp = done.getPointAtLength(Math.max(0, len - 40)), [tx] = toScr(tp.x, tp.y);
    if (tx > x + 8) left = true; else if (tx < x - 8) left = false;
    const pw = vehPlate.offsetWidth + 18, W = map.clientWidth;
    if (x > W * .7 || x + pw > W - 44) left = true;
    if (x - pw < 4) left = false;
    veh.classList.toggle('is-left', left);
  }
  let d2 = 1, evOn = null, toastOn = null, evT = 0;
  function set(v, snap){
    d2 = clamp(+v);
    const len = d2 * L, rm = reduceMq.matches;
    noAnim(snap || rm);
    done.style.strokeDasharray = cas.style.strokeDasharray = `${len} ${L + 1}`;
    const p = done.getPointAtLength(len), a = done.getPointAtLength(Math.max(0, len - 1.5)), b = done.getPointAtLength(Math.min(L, len + 1.5));
    const [x, y] = toScr(p.x, p.y);
    veh.style.transform = `translate(${x}px,${y}px)`;
    plateSide(len, x);
    spinTo(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90, snap);
    const moving = d2 > 0 && d2 < 1;
    setSpeed(moving ? Math.round(Math.min(1, d2 / .06, (1 - d2) / .06) * (46 + 6 * Math.sin(d2 * Math.PI * 6))) : 0);   // разгон, 40–52 км/ч, торможение
    veh.classList.toggle('is-moving', moving && !rm);
    gcar.classList.toggle('is-stop', !moving); mini.classList.toggle('is-stop', !moving);
    stTxt.textContent = moving ? 'В пути' : 'Стоит';
    segGo.textContent = moving ? 3 : 2; segStop.textContent = moving ? 1 : 2;
    stKm.textContent = `${fmt1(KM * d2)} км`;
    stMin.textContent = `${Math.floor(TRIP * d2 + 1e-6)} мин`;
    clk.textContent = hhmm(T0 + TRIP * d2);
    // событие въезжает со вспышкой при проезде вперёд, кольцо геозоны в этот момент один раз расходится; при обратной прокрутке уходит
    const out = d2 >= CROSS;
    if (out !== evOn){
      evOn = out; evZone.classList.toggle('is-on', out);
      evZone.classList.remove('is-new'); ping.classList.remove('is-on');
      if (out && !snap && !rm){
        void evZone.offsetWidth; ping.getBoundingClientRect(); evZone.classList.add('is-new'); ping.classList.add('is-on');
        clearTimeout(evT); evT = setTimeout(() => { evZone.classList.remove('is-new'); ping.classList.remove('is-on'); }, 1250);
      }
    }
    // телефон: тост живёт, пока d2 < пересечение + .25, потом сворачивается в значок в мини-карточке; при «уменьшить движение» — сразу значок
    const tOn = out && !rm && d2 < CROSS + TOAST_FOR;
    if (tOn !== toastOn){ toastOn = tOn; toast.classList.toggle('is-on', tOn); toast.classList.toggle('is-gone', out && !tOn); }
    if (!out) toast.classList.remove('is-gone');
    mini.classList.toggle('has-ev', out && !tOn);
  }
  return { set, measure, get d2(){ return d2; }, start: gStart };
}
const gps = $('.sp--gps'), gpsWrap = $('.sp__mast-wrap', gps), gpsMock = $('.sp__mock', gps), gpsMastBl = $('.mast-bl', gps), gpsMast = $('.sp__mast', gps);
const gpsSvg = $('.gps__route', gps), gpsLine = $('.gps__line', gps), gpsTip = $('.gps__tip', gps), gpsUI = gpsScreen($('.ipad', gps));
$$('.gps__path').forEach(path => path.setAttribute('pathLength', 1));
// iPad садится под слово: базовая линия «GPS» заходит на рамку на 80px (с зумом рамки — пропорционально), экран закрыт буквами до y≈68,
// колонка «Машины» начинается ниже (css: padding-top 92px). Считаем по факту: margin в css даёт нахлёст бокса, а не базовой линии; сдвиг веса (--by) не в счёт
function gpsSeat(){
  if (!wideMq.matches){ gpsMock.style.marginTop = ''; return; }
  gpsMock.style.marginTop = '0px';
  const tr = getComputedStyle(gpsMastBl.parentElement).transform;      // слово могло ещё не выехать из-под маски — берём место без сдвига
  const bl = gpsMastBl.getBoundingClientRect().top - (tr && tr !== 'none' ? new DOMMatrix(tr).m42 : 0);
  const by = parseFloat(gpsMock.style.getPropertyValue('--by')) || 0;
  gpsMock.style.marginTop = `${(bl - 80 * ($('.ipad', gpsMock).currentCSSZoom || 1) - gpsMock.getBoundingClientRect().top + by).toFixed(1)}px`;
}
// линия над словом выходит из кольца старта на карте (на 12px выше: машина на стоянке не закрыта) строго вверх, идёт в чашу «P» и дугой над «S»;
// кончается ниже меню — на ней садится пин (5.5). Точки пути — в долях слова (100 × 40, как в разметке), пересчёт в пиксели блока.
// Для краски слова — огибающая x кончика от начала слова: край краски не отступает, пока линия заходит в чашу «P»
let gpsL = 0, gpsWW = 0, gpsEnv = [], gpsD1 = 0;
const GPS_N = 48;
function gpsRoute(){
  const r = gpsSvg.getBoundingClientRect(), e = gpsUI.start.getBoundingClientRect();
  if (!r.width || !e.width) return;
  const sx = (e.left + e.width / 2 - r.left) / r.width * 100, sy = (e.top + e.height / 2 - 12 - r.top) / r.height * 40;
  const pt = (x, y) => `${(x / 100 * r.width).toFixed(1)} ${(y / 40 * r.height).toFixed(1)}`;
  const d = `M${pt(sx, sy)} C${pt(sx, sy - 16)},${pt(36, 30)},${pt(44, 21)} S${pt(78, 12)},${pt(88, 18)}`;
  gpsSvg.setAttribute('viewBox', `0 0 ${r.width.toFixed(1)} ${r.height.toFixed(1)}`);
  $$('.gps__path', gpsSvg).forEach(path => path.setAttribute('d', d));
  const w = $('.ln>span', gpsMast).getBoundingClientRect(), x0 = w.left - r.left;
  gpsWW = w.width; gpsL = gpsLine.getTotalLength(); gpsEnv = [];
  for (let i = 0, mx = -1e9; i <= GPS_N; i++){ mx = Math.max(mx, gpsLine.getPointAtLength(gpsL * i / GPS_N).x - x0); gpsEnv.push(mx); }
  gpsDraw(gpsD1);
}
// d1 — доля нарисованного маршрута: штрих, точка на кончике и краска слова (первые 30% краска догоняет кончик слева, последние 25% докрашивает «S»)
function gpsDraw(d1){
  gpsD1 = d1;
  gpsWrap.style.setProperty('--draw', d1.toFixed(3));
  if (!gpsL) return;
  const q = gpsLine.getPointAtLength(gpsL * d1);
  gpsTip.setAttribute('cx', q.x.toFixed(1)); gpsTip.setAttribute('cy', q.y.toFixed(1)); gpsTip.style.opacity = d1 > 0 ? 1 : 0;
  if (!flowLive()){ gpsMast.style.removeProperty('--tx'); return; }
  const f = d1 * GPS_N, i = Math.min(GPS_N - 1, Math.floor(f)), env = lerp(gpsEnv[i], gpsEnv[i + 1], f - i);
  gpsMast.style.setProperty('--tx', `${lerp(env * sstep(0, .3, d1), gpsWW + 12, sstep(.75, 1, d1)).toFixed(1)}px`);
}
scene(gps, 'flow', p => {
  const d1 = clamp((p - .06) / .30), d2 = clamp((p - .30) / .32);   // пин садится на p .36; на iPad машина едет на p .30–.62
  gpsDraw(d1);
  gpsUI.set(d2);
  gps.classList.toggle('is-pinned', d1 >= 1);
}, () => { gpsDraw(1); gpsUI.set(1, true); gps.classList.add('is-pinned'); });
new ResizeObserver(() => { gpsUI.measure(); gpsUI.set(gpsUI.d2, true); }).observe($('.gmap', gps));

/* ---------- 6. Pay: телефон поднимается из слова, баланс считается, «Вывести» нажимается — карта выезжает из-за телефона, монеты падают ----------
   Слово течёт от розового к кораллу (--pf, 5.4) */
const pay = $('.sp--pay'), payMast = $('.sp__mast', pay), phone = $('.pay__phone', pay), card = $('.pay__card', pay), coins = $('.pay__coins', pay);
const amt = $('.ip-amt', pay), payOut = $('[data-act="out"]', pay), BAL = 328400;
let pressed = false, cardSide = 1;
const paySide = () => { cardSide = card.offsetLeft + card.offsetWidth / 2 < phone.offsetWidth / 2 ? 1 : -1; };   // карта слева — выезжает влево, справа (телефон) — вправо
scene(pay, 'flow', p => {
  const m = amp();
  payMast.style.setProperty('--pf', out3(clamp((p - .04) / .36)).toFixed(3));
  phone.style.translate = `0 ${((1 - out4(clamp((p - .06) / .34))) * 160 * m).toFixed(1)}px`;
  amt.textContent = fmt(BAL * out3(clamp((p - .22) / .18)));          // «Можно вывести» досчитывается к p .40 …
  if (p >= .4 && !pressed){ pressed = true; payOut.classList.add('is-press'); setTimeout(() => payOut.classList.remove('is-press'), 200); }   // … и «Вывести» нажимается
  else if (p < .3) pressed = false;
  const c = out3(clamp((p - .40) / .14));                              // … карта выезжает из-за телефона: сдвиг на 58% к его середине → 0, поворот 0 → −12°
  card.style.transform = `translateX(${(cardSide * 58 * (1 - c)).toFixed(2)}%) rotate(${(-12 * c).toFixed(2)}deg)`;
  coins.style.transform = `translateY(${(-140 * m * (1 - settle(clamp((p - .44) / .12)))).toFixed(1)}px)`;   // монеты падают и садятся (--e-settle)
}, () => { phone.style.translate = ''; card.style.transform = coins.style.transform = ''; payMast.style.removeProperty('--pf'); amt.textContent = fmt(BAL); });

/* ---------- 7. Разработка на заказ: главная строка указателя меняет предмет справа ----------
   От 1024px сцена стоит на экране, и главная строка идёт по прогрессу пина (шесть равных отрезков); предметы сменяет сам скролл (5.8).
   Без пина от 1024 («уменьшить движение») — строка, ближайшая к середине экрана, предмет сменяется прозрачностью.
   На <1024 главную строку выбирает касание: первое раскрывает строку, второе по раскрытой ведёт к форме (aria-expanded) */
const rows = $$('.svc__row'), svcImgs = $$('.svc__stick img'), stick = $('.svc__stick'), svcStage = $('.svc__stage');
const narrowMq = matchMedia('(max-width: 1023.98px)');
let svcK = -1;
function setSvc(k){
  if (k === svcK) return;
  rows.forEach((r, i) => {
    r.classList.toggle('is-on', i === k);
    const a = r.querySelector('a'); narrowMq.matches ? a.setAttribute('aria-expanded', i === k) : a.removeAttribute('aria-expanded');
  });
  svcImgs.forEach((img, i) => img.classList.toggle('is-on', i === k));
  svcK = k; alignStick();
}
// c — дробный индекс предмета: k уходит, k + 1 приходит, смена на дробной части .35–.65 — середина смены совпадает со сменой строки.
// Уходящий гаснет вверх (−28px), чуть мельчает и размывается; входящий — зеркально снизу. Без поворотов и перелёта
let svcC = -1, svcVis = 0;                                            // svcVis — какие предметы сейчас видны (биты): по ним предмет не выходит из своей колонки
function svcMix(c){
  if (c === svcC) return; svcC = c;
  const k = Math.min(4, Math.floor(c)), w = sstep(.35, .65, c - k);
  let vis = 0;
  svcImgs.forEach((img, i) => {
    const t = i === k ? w : i === k + 1 ? w - 1 : 1, a = Math.abs(t);
    if (a < 1) vis |= 1 << i;
    img.style.opacity = (1 - a).toFixed(3);
    img.style.transform = a < 1 ? `translateY(${(-28 * t).toFixed(1)}px) scale(${(1 - .08 * a).toFixed(4)})` : '';
    img.style.setProperty('--b', `${(6 * a).toFixed(2)}px`);
  });
  if (vis !== svcVis){ svcVis = vis; alignStick(); }
}
const svcClear = () => { svcC = -1; svcVis = 0; stick.classList.remove('is-scrub'); svcImgs.forEach(img => { img.style.opacity = img.style.transform = ''; img.style.removeProperty('--b'); }); };
// предмет держится на уровне главной строки: к её центру, но в пределах ±22vh, не выше своей колонки (над ней вводка) и не ниже сцены.
// Тень на полу встаёт под низ текущей картинки (--ih, --iw: у высокой картинки при object-fit:contain видимая ширина меньше рамки)
function alignStick(){
  const img = svcImgs[svcK];
  if (!img) return;
  const ih = img.offsetHeight, iw = img.naturalWidth ? Math.min(img.offsetWidth, ih * img.naturalWidth / img.naturalHeight) : img.offsetWidth;
  stick.style.setProperty('--ih', `${ih}px`); stick.style.setProperty('--iw', `${iw.toFixed(1)}px`);
  if (!pinLive() || !ih){ stick.style.removeProperty('--sy'); return; }
  // сдвиг к строке — --sy (css переводит его за .7s); во время перехода берём текущее значение. Вес стекла (--by) не в счёт
  const now = (parseFloat(getComputedStyle(stick).getPropertyValue('--sy')) || 0) + (parseFloat(stick.style.getPropertyValue('--by')) || 0);
  // пока соседний предмет ещё виден в смене (он может быть выше текущего), границы считаем по самому высокому из видимых
  const hv = Math.max(ih, ...svcImgs.filter((im, i) => svcVis & 1 << i).map(im => im.offsetHeight));
  const sr = stick.getBoundingClientRect(), r = rows[svcK].getBoundingClientRect(), c0 = sr.top - now + sr.height / 2;
  const up = -(sr.height - hv) / 2, down = Math.max(up, svcStage.getBoundingClientRect().bottom - 12 - iw * .1 - (c0 + hv / 2)), lim = innerHeight * .22;
  stick.style.setProperty('--sy', `${clamp(r.top + r.height / 2 - c0, Math.max(up, -lim), Math.min(down, lim)).toFixed(1)}px`);
}
svcImgs.forEach(img => img.addEventListener('load', () => { if (img.classList.contains('is-on')) alignStick(); }));
const svcIn = new Set();
const svcNear = () => {                                               // среди строк в средней полосе экрана — ближайшая к середине (при скролле вверх тоже)
  let best = null, bestD = Infinity;
  svcIn.forEach(r => { const b = r.getBoundingClientRect(), d = Math.abs(b.top + b.height / 2 - innerHeight / 2); if (d < bestD){ bestD = d; best = r; } });
  if (best) setSvc(+best.dataset.k);
};
const svcIo = new IntersectionObserver(es => {
  es.forEach(en => en.isIntersecting ? svcIn.add(en.target) : svcIn.delete(en.target));
  if (!pinLive() && !narrowMq.matches) svcNear();
}, { rootMargin: '-45% 0px -45% 0px' });
rows.forEach(r => {
  svcIo.observe(r);
  const a = r.querySelector('a');
  // в пине строка под курсором не становится главной: она выросла бы и уехала из-под курсора, а под ним оказалась бы соседняя
  a.addEventListener('pointerenter', e => { if (!pinLive() && e.pointerType === 'mouse') setSvc(+r.dataset.k); });   // касание даёт pointerenter до click
  a.addEventListener('focus', () => {
    if (narrowMq.matches && !a.matches(':focus-visible')) return;       // фокус от касания — строку раскрывает click
    setSvc(+r.dataset.k); if (pinLive()) svcMix(+r.dataset.k);
  });
  a.addEventListener('click', e => {                                  // дальше документа клик не идёт: site.js не прыгает к форме и не вписывает услугу
    if (!narrowMq.matches || r.classList.contains('is-on')) return;
    e.preventDefault(); e.stopPropagation(); setSvc(+r.dataset.k);
  });
});
narrowMq.addEventListener('change', () => { const k = svcK; svcK = -1; setSvc(k); });
scene($('.svc__track'), 'pin', p => {
  stick.classList.add('is-scrub');
  setSvc(Math.min(5, Math.floor(p * 6)));
  svcMix(clamp(p * 6 - .5, 0, 5));
}, () => { svcClear(); if (!narrowMq.matches) svcNear(); });
setSvc(0);
// кегль главной строки не больше того, при котором её название встаёт в колонку одной строкой (css: --fit на ссылке строки — от него и --fs номера)
const svcRange = document.createRange();
const fitSvc = () => $$('.svc__name').forEach(n => {
  svcRange.selectNodeContents(n);
  const w = svcRange.getBoundingClientRect().width;
  if (w) n.parentElement.style.setProperty('--fit', `${(parseFloat(getComputedStyle(n).fontSize) * n.clientWidth / w).toFixed(1)}px`);
});

/* ---------- 8. Процесс: одометр 1→4, дуга заполняется по шагам; на «Запуске» горизонт загорается краем и из-за дуги встаёт солнце (5.7) ---------- */
const proc = $('.s-proc'), digits = $('.proc__digits'), procWin = $('.proc__win'), steps = $$('.proc__step'), procArc = $('.proc__arc'),
  procPath = $('.proc__fill'), ticks = $$('.proc__tick'), pearl = $('.proc__pearl'), objs = $$('.proc__obj');
// где на дуге стоят шаги (доля длины): «Анализ» левее ножки большой «1» — предмет шага её не задевает; «Разработка» левее колонки текста
const STOPS = [.02, .30, .52, .80];
let procStep = -1, procLen = 0, digitW = [], objAt = null;
// цифры пропорциональные: окно одометра принимает ширину текущей цифры
const measureDigits = () => {
  const ls = parseFloat(getComputedStyle(procWin).letterSpacing) || 0;   // отрицательная разрядка после последней цифры обрезала бы её край
  digitW = $$('span', digits).map(d => d.getBoundingClientRect().width - ls); procStep = -1;
};
procPath.setAttribute('pathLength', 1);
const arcPoint = f => {                                               // точка дуги в пикселях блока .proc__arc
  if (!procLen) procLen = procPath.getTotalLength();
  const pt = procPath.getPointAtLength(f * procLen);
  return [pt.x, pt.y];
};
function placeTicks(){ ticks.forEach((t, k) => { const [x, y] = arcPoint(STOPS[k]); t.style.left = `${x}px`; t.style.top = `${y}px`; }); }
// раскладка сцены (micro-craft 1.1): базовая линия цифры на 16px выше высшей точки дуги под ней — цифра не уходит под землю;
// верх «4» в «/4» и верх прописных заголовка шага — на линии верха цифры; на низком окне цифра мельчает и не заходит под заголовок (≥40px).
// Высота прописных и цифр Onest — .707em по пикселям: measureText().actualBoundingBoxAscent в Chrome отдаёт .719 для любого глифа (на 490px — 6px ошибки)
const CAP = .707, rul = document.createElement('canvas').getContext('2d');
const baseOf = el => {                                                // от верха строки до базовой линии
  const cs = getComputedStyle(el), fs = parseFloat(cs.fontSize);
  rul.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m = rul.measureText('0'), lh = parseFloat(cs.lineHeight) || m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
  return { fs, base: (lh - m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 + m.fontBoundingBoxAscent };
};
const procNum = $('.proc__num'), procOf = $('.proc__num i'), procStepsEl = $('.proc__steps'), procTitle = $('.proc__title');
function layoutProc(){
  const clear = () => ['--num-bottom', '--of-top', '--steps-top'].forEach((n, i) => [procNum, procOf, procStepsEl][i].style.removeProperty(n));
  if (!pinLive()){ clear(); procNum.style.removeProperty('--num-fs'); return; }
  const place = () => {
    clear();
    const ar = procArc.getBoundingClientRect(), wr = procWin.getBoundingClientRect();
    const right = wr.left + Math.max(wr.width, ...digitW);           // самая широкая цифра: окно меняет ширину по шагу
    let minY = Infinity;                                             // высшая точка дуги над цифрой (±8px)
    for (let i = 0; i <= 400; i++){ const [x, y] = arcPoint(i / 400), X = ar.left + x; if (X >= wr.left - 8 && X <= right + 8) minY = Math.min(minY, y); }
    if (minY === Infinity) return null;
    const big = baseOf($('span', digits)), baseline = wr.top + big.base;
    const mb = parseFloat(getComputedStyle(procNum).marginBottom);
    procNum.style.setProperty('--num-bottom', `${(mb + baseline - (ar.top + minY - 16)).toFixed(1)}px`);
    const capTop = procWin.getBoundingClientRect().top + big.base - big.fs * CAP;
    const sm = baseOf(procOf), or = procOf.getBoundingClientRect();
    procOf.style.setProperty('--of-top', `${(capTop - (or.top + sm.base - sm.fs * CAP)).toFixed(1)}px`);
    const h3 = $('h3', steps[0]), hm = baseOf(h3), sr = procStepsEl.getBoundingClientRect(), mt = parseFloat(getComputedStyle(procStepsEl).marginTop);
    procStepsEl.style.setProperty('--steps-top', `${(mt + capTop - (sr.top + hm.base - hm.fs * CAP)).toFixed(1)}px`);
    return { capTop, baseline: procWin.getBoundingClientRect().top + big.base };
  };
  procNum.style.removeProperty('--num-fs'); measureDigits();
  let r = place();
  const tb = procTitle.getBoundingClientRect().bottom + 40;
  if (r && r.capTop < tb){ procNum.style.setProperty('--num-fs', `${Math.floor((r.baseline - tb) / CAP)}px`); measureDigits(); r = place(); }
  // низкое окно (ноутбук с панелями браузера, ~650px): самый длинный шаг не помещается между верхом цифры и дугой —
  // текст поднимается выше линии цифры, пока до дуги под колонкой не останется 28px, но не выше заголовка раздела
  const ar = procArc.getBoundingClientRect(), sr = procStepsEl.getBoundingClientRect(), maxH = Math.max(...steps.map(el => el.offsetHeight));
  let arcTop = Infinity;
  for (let i = 0; i <= 200; i++){ const [x, y] = arcPoint(i / 200), X = ar.left + x; if (X >= sr.left && X <= sr.right) arcTop = Math.min(arcTop, ar.top + y); }
  const over = sr.top + maxH + 28 - arcTop, room = sr.top - procTitle.getBoundingClientRect().top;
  if (over > 0 && room > 0) procStepsEl.style.setProperty('--steps-top', `${(parseFloat(getComputedStyle(procStepsEl).marginTop) - Math.min(over, room)).toFixed(1)}px`);
}
// точки тиков, размеры предметов (px; в CSS предмет 112, солнце 120) и место над тиком до низа текста (+16px): room — пока шаг текущий
// (текст своего шага), past — когда пройден (самый длинный из следующих). Предмет — до 9,3% ширины дуги, не больше 112: солнце остаётся крупнее.
// Под колонкой текста предмет сначала мельчает (до .75, солнце до 96), потом встаёт ниже — выглядывает из-за горизонта, но на текст не заходит
const fitObjs = () => {
  const ar = procArc.getBoundingClientRect(), sr = procStepsEl.getBoundingClientRect();
  const bottom = steps.map(el => sr.top - ar.top + el.offsetHeight + 16), base = Math.min(112, ar.width * .093);
  return STOPS.map((f, k) => {
    const [x, y] = arcPoint(f), full = k < 3 ? base : 120, free = x + full / 2 < sr.left - ar.left;
    const room = free ? Infinity : y - bottom[k], past = free || k === 3 ? room : y - Math.max(...bottom.slice(k + 1));
    return { x, y, room, past, s: k < 3 ? clamp(room / .9, base * .75, full) : clamp((room - 26) * 2, 96, full) };
  });
};
const liftIn = (want, room, half) => Math.max(-half * .5, Math.min(want, room - half));   // центр над дугой, но верх не выше места
scene(proc, 'pin', (p, top, vh) => {
  const s = Math.min(3, Math.floor(p * 4)), q = p * 4 - s;
  // половину отрезка стоим на шаге, потом едем к следующему
  const f = s < 3 ? lerp(STOPS[s], STOPS[s + 1], out3(clamp((q - .55) / .45))) : STOPS[3];
  procArc.style.setProperty('--fill', f.toFixed(4));
  // рассвет на p .80–.95: край горизонта загорается, солнце (сфера) растёт 48 → 120px и поднимается из-за дуги — низ закрывает белая земля
  const dawn = clamp((p - .80) / .15), r = out3(dawn);
  procArc.style.setProperty('--dawn', dawn.toFixed(3));
  if (!objAt) objAt = fitObjs();
  const sun = objAt[3];
  pearl.style.transform = `translate(${sun.x.toFixed(1)}px,${(sun.y + lerp(70, -liftIn(26, sun.room, sun.s / 2), r)).toFixed(1)}px) scale(${(lerp(.4, 1, r) * sun.s / 120).toFixed(3)})`;
  pearl.style.opacity = dawn > 0 ? 1 : 0;
  // предметы шагов 1–3 встают из-за дуги в точке своего тика (.4 → 1 размера) и заменяют точку. Первый — пока сцена въезжает
  // (top .4vh → 0), остальные — на подходе заполнения (последние 12% пути к тику). Когда начинается следующий шаг, предмет мельчает до .55
  // и глубже садится за горизонт: центр на .42 → .30 размера над дугой
  objs.forEach((o, k) => {
    const up = out3(k ? clamp((p * 4 - k + .12) / .3) : clamp(1 - top / (vh * .4))), down = out3(clamp((p * 4 - k - 1 + .12) / .3));
    const { x, y, s: S, room, past } = objAt[k], sz = lerp(1, .55, down);
    // к середине усадки место считается уже по тексту следующих шагов: он проявляется, когда усадка прошла ~80%
    const avail = room === past ? room : lerp(room, past, clamp(down * 2)), lift = liftIn(lerp(.42, .30, down) * S * sz, avail, .48 * S * sz);
    o.style.transform = `translate(${x.toFixed(1)}px,${(y + lerp(70, -lift, up)).toFixed(1)}px) scale(${(lerp(.4, 1, up) * sz * S / 112).toFixed(3)})`;
    o.style.opacity = up > 0 ? 1 : 0;
    ticks[k].style.setProperty('--up', up.toFixed(3));
  });
  if (s !== procStep){
    procStep = s; digits.style.setProperty('--step', s);
    if (digitW[s]) procWin.style.width = `${digitW[s].toFixed(1)}px`;
    steps.forEach((el, i) => { el.classList.toggle('is-on', i === s); el.classList.toggle('is-past', i < s); });
    ticks.forEach((t, i) => { t.classList.toggle('is-on', i === s); t.classList.toggle('is-past', i < s); });   // пройденный · текущий · будущий
    proc.classList.toggle('is-launch', s === 3);
  }
}, () => { procStep = -1; procWin.style.width = ''; pearl.style.cssText = ''; objs.forEach(o => { o.style.cssText = ''; }); ticks.forEach(t => t.style.removeProperty('--up')); steps.forEach(el => el.classList.remove('is-on', 'is-past')); proc.classList.remove('is-launch'); });

/* ---------- 9. Контакт: номер прокручивается одометром, в конце чат кивает (5.11); чат наклоняется к форме, пока в ней пишут ---------- */
const chat = $('.ct__chat'), lead = $('#lead'), ctPhone = $('.ct__phone'), ctNum = ctPhone.firstElementChild;
lead.addEventListener('focusin', e => { if (e.target.matches('.pf') && !reduceMq.matches) chat.style.setProperty('--tilt', '-9deg'); });
lead.addEventListener('focusout', () => chat.style.setProperty('--tilt', '0deg'));
// на каждую цифру (кроме мелкого кода страны) лента 0–9 и сама цифра; до прокрутки виден 0. Ссылка читается по aria-label, номер — как был
const ctKeep = ctNum.innerHTML;
let odoN = 0, odoT = 0;
function odoBuild(){
  [...ctNum.childNodes].forEach(n => {
    if (n.nodeType !== 3) return;
    const f = document.createDocumentFragment();
    for (const c of n.data){
      if (!/\d/.test(c)){ f.append(c); continue; }
      const o = document.createElement('span');
      o.className = 'odo'; o.innerHTML = `<span class="odo__d">${c}</span><span class="odo__t" style="--i:${odoN++}">${[...'0123456789', c].map(x => `<i>${x}</i>`).join('')}</span>`;
      f.append(o);
    }
    n.replaceWith(f);
  });
  ctPhone.classList.add('is-odo');
}
const odoDone = () => { clearTimeout(odoT); ctNum.innerHTML = ctKeep; ctPhone.classList.remove('is-odo', 'is-roll'); };
function odoRoll(){                                                   // 900 + 40i ms с шагом 35 ms; после последней цифры — номер как был и кивок чата
  ctPhone.classList.add('is-roll');
  odoT = setTimeout(() => {
    odoDone();
    chat.classList.add('is-nod'); setTimeout(() => chat.classList.remove('is-nod'), 760);
  }, 900 + 75 * (odoN - 1) + 80);
}
if (flowLive()){
  odoBuild();
  const odoIo = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return;
    odoIo.disconnect();
    if (!flowLive()) return odoDone();
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(odoRoll));
  }, { threshold: .6 });
  odoIo.observe(ctPhone);
  reduceMq.addEventListener('change', () => { if (reduceMq.matches && ctPhone.classList.contains('is-odo')){ odoIo.disconnect(); odoDone(); } });
}

/* ---------- 10. Футер: плитка S разворачивается, герои фильма садятся на орбиту вокруг неё ----------
   Эллипс шире плитки и опущен ниже её центра: передние тела проходят под нижней кромкой и не закрывают лицо S, задние идут за буквами слогана */
const foot = $('.s-foot'), fOrbit = $('.foot__orbit'), fBodies = $$('.foot__b'), fRings = $$('.foot__ring'), fTile = $('.foot__tile'), fBg = $('.foot__bg');
const fWord = $('.foot__slogan .grad');                                // «действии.»
let fe = 1, fSpin = 0, fRaf = 0, fSeen = false, fPrev = 0, fRx = null;
// радиус орбиты. Пока монет нет (тела скрыты) — как было: .48 ширины. С монетами (ТЗ v3.1, 2.2) тело не заходит на слоган:
// левый край тела ≥ правый край «действии.» + 24px, когда слоган стоит сбоку от орбиты (≥1024); кольцо сжимается вместе с путём тел
function footRx(){
  if (fRx !== null) return fRx;
  let rx = fOrbit.clientWidth * .48;
  if (fBodies[0] && fBodies[0].offsetParent && fWord){
    const o = fOrbit.getBoundingClientRect(), w = fWord.getBoundingClientRect();
    if (w.bottom > o.top && w.right > o.left){
      const lim = (o.left + o.width / 2 - (w.right + 24 + .4 * fBodies[0].offsetWidth)) / .991;   // у края эллипса тело в масштабе .8
      if (lim > 0) rx = Math.min(rx, lim);
    }
  }
  return (fRx = rx);
}
function placeFootBodies(){
  const rx = footRx() * fe, ry = rx * .28, cy = fTile.offsetHeight * .36, tilt = -8 * Math.PI / 180;
  fRings.forEach(r => r.style.cssText = `width:${(2 * rx).toFixed(1)}px;height:${(2 * ry).toFixed(1)}px;opacity:${fe.toFixed(3)};transform:translate(-50%,-50%) translateY(${cy.toFixed(1)}px) rotate(-8deg)`);
  fBodies.forEach((b, k) => {
    const th = fSpin + k * 2 * Math.PI / 3, d = (Math.sin(th) + 1) / 2;
    const x = rx * Math.cos(th), y = ry * Math.sin(th);
    const X = x * Math.cos(tilt) - y * Math.sin(tilt), Y = x * Math.sin(tilt) + y * Math.cos(tilt) + cy;
    b.style.transform = `translate(-50%,-50%) translate(${X.toFixed(1)}px,${Y.toFixed(1)}px) scale(${((.55 + .5 * d) * (.3 + .7 * fe)).toFixed(3)})`;
    b.style.zIndex = d > .5 ? 3 : 1; b.style.opacity = (.35 + .65 * fe).toFixed(3);
    b.style.setProperty('--far', clamp((.5 - d) / .5).toFixed(2));
  });
}
fTile.style.zIndex = 2;
const footSpin = t => {                                               // круг за 60 с
  fRaf = 0;
  if (!fSeen || !pinLive() || !fBodies[0].offsetParent) return;       // тела скрыты (ждут монет) — крутить нечего
  fSpin += (t - (fPrev || t)) / 60000 * 2 * Math.PI; fPrev = t;
  placeFootBodies();
  fRaf = requestAnimationFrame(footSpin);
};
new IntersectionObserver(es => {
  fSeen = es[0].isIntersecting; fPrev = 0;
  if (fSeen && pinLive() && !fRaf) fRaf = requestAnimationFrame(footSpin);
}).observe(foot);
let fScroll = 0;
scene(foot, 'flow', (p, top, vh, h) => {
  const q = clamp((vh - top) / h);                                    // 1 — низ страницы
  fe = out3(clamp((q - .2) / .45));
  fOrbit.style.setProperty('--fe', fe.toFixed(3));
  fBg.style.translate = `0 ${((1 - q) * 60).toFixed(1)}px`;
  fSpin += (q - fScroll) * Math.PI; fScroll = q;                      // скролл подкручивает орбиту
  if (!fRaf) placeFootBodies();
  if (fSeen && !fRaf) fRaf = requestAnimationFrame(footSpin);
}, () => { fe = 1; fSpin = 1.37; fOrbit.style.setProperty('--fe', 1); fBg.style.translate = ''; placeFootBodies(); }, pinLive);   // в покое: машина спереди под плиткой, пин сзади за «каждом», карта сзади справа

/* ---------- вес (5.9): макеты тяжелее и отстают меньше, стекло легче. Карта GPS не наклоняется — к ней привязаны маршрут над словом и машина на карте ---------- */
body(fleetMock, .5, .16, { tilt: .3 });
body(gpsMock, .3, .16, { tilt: 0, cb: gpsRoute });
body(card, .9, .09); body(coins, 1.2, .09); body($('.gps__pin', gps), .3, .09); body(chat, .3, .09);
body(stick, .4, .09, { live: pinLive });
fBodies.forEach(b => body(b, .6, .09, { live: pinLive }));

/* ---------- пересчёт геометрии ---------- */
function relayout(){
  fit(); mastMeasure(); orb = null; hand = null; procLen = 0; objAt = null; fRx = null; paySide();
  gpsSeat(); gpsUI.measure(); gpsUI.set(gpsUI.d2, true); gpsRoute();
  if (pinLive()){ pxSvg($('svg', procArc), 1000, 100); ovGeom(); placeTicks(); measureDigits(); fitSvc(); }
  layoutProc();
  alignStick();
  measure(); scenes.forEach(s => s.was = null); schedule();
}
let rq = 0;
const relayoutSoon = () => { cancelAnimationFrame(rq); rq = requestAnimationFrame(relayout); };
addEventListener('resize', relayoutSoon);
wideMq.addEventListener('change', relayoutSoon); reduceMq.addEventListener('change', relayoutSoon);
new ResizeObserver(() => { measure(); schedule(); }).observe($('.canvas'));
relayout();
document.fonts && document.fonts.ready.then(relayoutSoon);
addEventListener('load', relayoutSoon);
})();
