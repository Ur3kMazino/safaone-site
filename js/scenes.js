/* Safa One — сцены главной под фильмом (ТЗ_главная_v2.md).
   Один движок прогресса на скролле: у каждой сцены p от 0 до 1.
     flow — секция идёт обычным потоком: p = 0, когда верх секции у низа экрана, 1 — когда низ ушёл за верх;
     pin  — внутри секции липкая сцена на экран: p = 0, когда сцена прилипла, 1 — когда отлипает.
   Пины и движение предметов — только от 1024px и при включённой анимации; иначе всё стоит в финальном виде. */
(() => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const out3 = t => 1 - (1 - t) ** 3, out4 = t => 1 - (1 - t) ** 4;
const reduceMq = matchMedia('(prefers-reduced-motion: reduce)'), wideMq = matchMedia('(min-width: 1024px)');
const live = () => wideMq.matches && !reduceMq.matches;

/* ---------- строки заголовков выезжают из-под маски, абзацы проявляются ---------- */
$$('[data-mask]').forEach(m => $$('.ln', m).forEach((l, i) => l.style.setProperty('--k', i)));
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

/* ---------- движок прогресса ---------- */
const scenes = [];
const scene = (el, mode, run, final) => el && scenes.push({ el, mode, run, final, top: 0, h: 0 });
function measure(){
  const y = scrollY;
  scenes.forEach(s => { const r = s.el.getBoundingClientRect(); s.top = r.top + y; s.h = r.height; });
  manTop = man.getBoundingClientRect().top + y;
}
let lastY = scrollY, lastT = performance.now(), vel = 0, wasLive = null, raf = 0, settling = false;
function tick(){
  raf = 0; settling = false;
  const on = live(), y = scrollY, vh = innerHeight, now = performance.now();
  vel = lerp(vel, (y - lastY) / Math.max(8, now - lastT) * 16, .25);  // px за кадр, сглаженная
  lastY = y; lastT = now;
  setDome(reduceMq.matches ? 1 : clamp((vh * .8 - (manTop - y)) / (vh * .5)));
  if (on !== wasLive){ wasLive = on; if (!on) scenes.forEach(s => s.final && s.final()); }
  if (!on) return;
  for (const s of scenes){
    const top = s.top - y;
    if (top > vh * 1.4 || top + s.h < -vh * .4) continue;              // далеко от экрана — не трогаем
    const p = s.mode === 'pin' ? clamp(-top / Math.max(1, s.h - vh)) : clamp((vh - top) / (vh + s.h));
    s.run(p, top, vh, s.h);
  }
  if (Math.abs(vel) > .05 || settling) schedule();                    // доводим «двигают» в покой после остановки
}
const schedule = () => { if (!raf) raf = requestAnimationFrame(tick); };
addEventListener('scroll', schedule, { passive: true });

/* ---------- 1. Манифест: «двигают» плывёт и наклоняется от скорости, «бизнес» доезжает на место ---------- */
const move = $('.man__move'), biz = $('.ln--biz');
let sk = 0;
scene(man, 'flow', p => {
  // дрейф и наклон — только от скорости: в покое перед «двигают» обычный пробел, без дыры
  const goal = clamp(-vel * .22, -6, 6);
  sk = lerp(sk, goal, .12);                                           // наклон догоняет скорость пружиной
  settling = Math.abs(sk - goal) > .02; if (!settling) sk = goal;
  move.style.setProperty('--mx', `${clamp(-vel * 1.4, -28, 28).toFixed(1)}px`);
  move.style.setProperty('--sk', `${sk.toFixed(2)}deg`);
  biz.style.translate = `${(4 * (1 - out4(clamp((p - .1) / .35)))).toFixed(3)}cqw 0`;   // «бизнес» доезжает и встаёт
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
   Задняя половина пути идёт за буквами (z 1 < заголовок 2), передняя — поверх (3). В списке активна строка того, кто спереди */
const ov = $('.s-ov'), ovBodies = $$('.ov__body'), ovRings = $$('.ov__ring'), ovJobs = $$('.ov__jobs li'), stage = $('.ov__stage');
const ovOrbit = $('.ov__orbit'), ovList = $('.ov__jobs'), ovTitle = $('.ov__title'), OV_TILT = -9;
let ovFront = null, orb = null;
function ovGeom(){
  const W = stage.clientWidth, t = OV_TILT * Math.PI / 180, size = ovBodies.map(b => [b.offsetWidth, b.offsetHeight]);
  // крайняя точка тел на пути (с их размером на этом месте, k — общий масштаб тел) по оси f: f(x, y) — координата центра, i — 0 ширина / 1 высота
  const edge = (rx, k, f, i) => {
    let m = -1e9;
    for (let a = 0; a < 360; a += 4){
      const th = a * Math.PI / 180, d = (Math.sin(th) + 1) / 2, c = f(rx * Math.cos(th), rx * .27 * Math.sin(th));
      size.forEach(s => { m = Math.max(m, c + s[i] * k * (.5 + .6 * d) / 2); });
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
  // кольцо — две дуги одной геометрии: задняя за буквами, передняя поверх
  ovRings.forEach(r => r.style.cssText = `left:${(-rx).toFixed(1)}px;top:${(-ry).toFixed(1)}px;width:${(2 * rx).toFixed(1)}px;height:${(2 * ry).toFixed(1)}px;transform:rotate(${OV_TILT}deg)`);
  orb = { rx, ry, t, k, size };
}
function placeOrbit(p){                                               // возвращает, кто спереди
  if (!orb) ovGeom();
  let best = 0, bestD = -1;
  ovBodies.forEach((b, k) => {
    const th = (90 - p * 300 + k * 120) * Math.PI / 180;
    const x = orb.rx * Math.cos(th), y = orb.ry * Math.sin(th), d = (Math.sin(th) + 1) / 2;
    const X = x * Math.cos(orb.t) - y * Math.sin(orb.t), Y = x * Math.sin(orb.t) + y * Math.cos(orb.t);
    const [w, h] = orb.size[k];
    b.style.transform = `translate(${(X - w / 2).toFixed(1)}px,${(Y - h / 2).toFixed(1)}px) scale(${((.5 + .6 * d) * orb.k).toFixed(3)})`;
    b.style.opacity = (.5 + .5 * d).toFixed(3); b.style.zIndex = d > .5 ? 3 : 1;
    b.classList.toggle('is-far', d < .3);
    if (d > bestD){ bestD = d; best = k; }
  });
  return best;
}
const setJob = k => {                                                 // k < 0 — все строки разом: кадр без движения
  if (k === ovFront) return;
  ovJobs.forEach((li, i) => li.classList.toggle('is-on', k < 0 || i === k)); ovFront = k;
};
scene(ov, 'pin', p => setJob(placeOrbit(p)), () => {
  // без пина: от 1024px — та же композиция в покое (машина спереди), на телефоне — кадр из CSS
  orb = null;
  if (wideMq.matches) placeOrbit(0);
  else { [ovOrbit, ...ovBodies, ...ovRings].forEach(el => el.style.cssText = ''); ovBodies.forEach(b => b.classList.remove('is-far')); }
  setJob(-1);
});

/* ---------- 4. Fleet: машина едет на зрителя, макет отстаёт, водитель проходит проверку ---------- */
const fleet = $('.sp--fleet'), car = $('.sp__hero', fleet), fleetMock = $('.sp__mock', fleet);
scene(fleet, 'flow', p => {
  const e = out3(clamp(p / .45));
  car.style.transform = `translate(${((1 - e) * -26).toFixed(2)}%,${((1 - e) * 18).toFixed(2)}%) scale(${(.5 + .5 * e).toFixed(3)})`;
  car.style.opacity = (.15 + .85 * e).toFixed(3);
  fleetMock.style.translate = `0 ${((p - .5) * -70).toFixed(1)}px`;
  fleet.classList.toggle('is-done', p > .55);
}, () => { car.style.cssText = ''; fleetMock.style.translate = ''; fleet.classList.add('is-done'); });

/* ---------- 5. GPS: маршрут прорисовывается поверх букв, в конец падает пин; на карте едет машина ---------- */
const gps = $('.sp--gps'), gpsWrap = $('.sp__mast-wrap', gps), map = $('.map', gps), speed = $('.map__speed', gps);
const gpsSvg = $('.gps__route', gps), gpsEnd = $('.map__end', gps);
$$('.gps__path, .map__route').forEach(path => path.setAttribute('pathLength', 1));
// маршрут над словом начинается в экранной точке конца трека на карте: одна линия от карты сквозь буквы к пину.
// Точки пути — в долях слова (100 × 40, как в разметке), пересчёт в пиксели блока
function gpsRoute(){
  const r = gpsSvg.getBoundingClientRect(), e = gpsEnd.getBoundingClientRect();
  if (!r.width || !e.width) return;
  const sx = (e.left + e.width / 2 - r.left) / r.width * 100, sy = (e.top + e.height / 2 - r.top) / r.height * 40;
  const pt = (x, y) => `${(x / 100 * r.width).toFixed(1)} ${(y / 40 * r.height).toFixed(1)}`;
  // из точки на карте вверх и влево, в чашу «P», и дугой над «S» к пину. Конец — под остриём пина (left 90%, top 20%)
  const d = `M${pt(sx, sy)} C${pt(sx - 6, sy - 16)},${pt(36, 30)},${pt(44, 21)} S${pt(70, 6)},${pt(90, 8)}`;
  gpsSvg.setAttribute('viewBox', `0 0 ${r.width.toFixed(1)} ${r.height.toFixed(1)}`);
  $$('.gps__path', gpsSvg).forEach(path => path.setAttribute('d', d));
  const c = $('.gps__start', gpsSvg), [cx, cy] = pt(sx, sy).split(' ');
  c.setAttribute('cx', cx); c.setAttribute('cy', cy);
}
scene(gps, 'flow', p => {
  const d1 = clamp((p - .12) / .33), d2 = clamp((p - .3) / .3);
  gpsWrap.style.setProperty('--draw', d1.toFixed(3));
  map.style.setProperty('--draw', d2.toFixed(3));
  speed.textContent = Math.round(68 * out3(d2));
  gps.classList.toggle('is-pinned', d1 >= 1);
}, () => { gpsWrap.style.setProperty('--draw', 1); map.style.setProperty('--draw', 1); speed.textContent = 68; gps.classList.add('is-pinned'); });

/* ---------- 6. Pay: телефон поднимается из слова, карта и монеты на разной глубине ---------- */
const pay = $('.sp--pay'), phone = $('.pay__phone', pay), card = $('.pay__card', pay), coins = $('.pay__coins', pay);
scene(pay, 'flow', p => {
  const e = out3(clamp((p - .04) / .36));
  phone.style.translate = `0 ${((1 - e) * 160).toFixed(1)}px`;
  card.style.translate = `0 ${((p - .5) * -90).toFixed(1)}px`;
  coins.style.translate = `0 ${((p - .5) * 70).toFixed(1)}px`;
}, () => [phone, card, coins].forEach(el => el.style.translate = ''));
// баланс досчитывается от нуля, когда телефон в кадре
const bal = $('.ip-balance b', pay);
if (bal && !reduceMq.matches){
  const num = bal.firstChild, final = num.textContent, total = 328400;
  const fmt = v => `${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},00 `;   // разряды узким неразрывным
  num.textContent = fmt(0);
  const balIo = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return;
    balIo.disconnect();
    const t0 = performance.now(), run = t => {
      const q = clamp((t - t0) / 1400);
      num.textContent = q < 1 ? fmt(total * out3(q)) : final;
      if (q < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }, { threshold: 1 });
  balIo.observe(bal);
}

/* ---------- 7. Разработка на заказ: главная строка указателя меняет предмет справа ----------
   От 1024px сцена стоит на экране, и главная строка идёт по прогрессу пина (шесть равных отрезков).
   Без пина (телефон, «уменьшить движение») — строка, ближайшая к середине экрана */
const rows = $$('.svc__row'), svcImgs = $$('.svc__stick img');
let svcK = -1;
function setSvc(k){
  if (k === svcK) return;
  rows.forEach((r, i) => r.classList.toggle('is-on', i === k));
  svcImgs.forEach((img, i) => {
    img.classList.toggle('is-out', i === svcK);
    img.classList.toggle('is-on', i === k);
  });
  svcK = k;
}
const svcIn = new Set();
const svcNear = () => {                                               // среди строк в средней полосе экрана — ближайшая к середине (при скролле вверх тоже)
  let best = null, bestD = Infinity;
  svcIn.forEach(r => { const b = r.getBoundingClientRect(), d = Math.abs(b.top + b.height / 2 - innerHeight / 2); if (d < bestD){ bestD = d; best = r; } });
  if (best) setSvc(+best.dataset.k);
};
const svcIo = new IntersectionObserver(es => {
  es.forEach(en => en.isIntersecting ? svcIn.add(en.target) : svcIn.delete(en.target));
  if (!live()) svcNear();
}, { rootMargin: '-45% 0px -45% 0px' });
rows.forEach(r => {
  svcIo.observe(r);
  const a = r.querySelector('a');
  // в пине строка под курсором не становится главной: она выросла бы и уехала из-под курсора, а под ним оказалась бы соседняя
  a.addEventListener('pointerenter', () => { if (!live()) setSvc(+r.dataset.k); });
  a.addEventListener('focus', () => setSvc(+r.dataset.k));
});
scene($('.svc__track'), 'pin', p => setSvc(Math.min(5, Math.floor(p * 6))), svcNear);
setSvc(0);
// кегль главной строки не больше того, при котором её название встаёт в колонку одной строкой (css: --fit)
const svcRange = document.createRange();
const fitSvc = () => $$('.svc__name').forEach(n => {
  svcRange.selectNodeContents(n);
  const w = svcRange.getBoundingClientRect().width;
  if (w) n.style.setProperty('--fit', `${(parseFloat(getComputedStyle(n).fontSize) * n.clientWidth / w).toFixed(1)}px`);
});

/* ---------- 8. Процесс: одометр 1→4, жемчужина-солнце едет по дуге, на «Запуске» встаёт рассвет ---------- */
const proc = $('.s-proc'), digits = $('.proc__digits'), procWin = $('.proc__win'), steps = $$('.proc__step'), procArc = $('.proc__arc'),
  procPath = $('.proc__fill'), pearl = $('.proc__pearl'), ticks = $$('.proc__tick');
const STOPS = [.06, .35, .65, .94];                                   // где на дуге стоят шаги (доля длины)
let procStep = -1, procLen = 0, digitW = [];
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
scene(proc, 'pin', p => {
  const s = Math.min(3, Math.floor(p * 4)), q = p * 4 - s;
  // половину отрезка стоим на шаге, потом едем к следующему
  const f = s < 3 ? lerp(STOPS[s], STOPS[s + 1], out3(clamp((q - .55) / .45))) : STOPS[3];
  const [x, y] = arcPoint(f);
  procArc.style.setProperty('--px', `${x.toFixed(1)}px`); procArc.style.setProperty('--py', `${y.toFixed(1)}px`);
  procArc.style.setProperty('--fill', f.toFixed(4));
  procArc.style.setProperty('--dawn', clamp((p - .78) / .17).toFixed(3));
  if (s !== procStep){
    procStep = s; digits.style.setProperty('--step', s);
    if (digitW[s]) procWin.style.width = `${digitW[s].toFixed(1)}px`;
    steps.forEach((el, i) => { el.classList.toggle('is-on', i === s); el.classList.toggle('is-past', i < s); });
    ticks.forEach((t, i) => t.classList.toggle('is-on', i <= s));
  }
}, () => { procStep = -1; procWin.style.width = ''; steps.forEach(el => el.classList.remove('is-on', 'is-past')); });

/* ---------- 9. Контакт: чат наклоняется к форме, пока в ней пишут ---------- */
const chat = $('.ct__chat'), lead = $('#lead');
lead.addEventListener('focusin', e => { if (e.target.matches('.pf') && !reduceMq.matches) chat.style.setProperty('--tilt', '-9deg'); });
lead.addEventListener('focusout', () => chat.style.setProperty('--tilt', '0deg'));

/* ---------- 10. Футер: плитка S разворачивается, герои фильма садятся на орбиту вокруг неё ----------
   Эллипс шире плитки и опущен ниже её центра: передние тела проходят под нижней кромкой и не закрывают лицо S, задние идут за буквами слогана */
const foot = $('.s-foot'), fOrbit = $('.foot__orbit'), fBodies = $$('.foot__b'), fRings = $$('.foot__ring'), fTile = $('.foot__tile'), fBg = $('.foot__bg');
let fe = 1, fSpin = 0, fRaf = 0, fSeen = false, fPrev = 0;
function placeFootBodies(){
  const rx = fOrbit.clientWidth * .48 * fe, ry = rx * .28, cy = fTile.offsetHeight * .36, tilt = -8 * Math.PI / 180;
  fRings.forEach(r => r.style.cssText = `width:${(2 * rx).toFixed(1)}px;height:${(2 * ry).toFixed(1)}px;opacity:${fe.toFixed(3)};transform:translate(-50%,-50%) translateY(${cy.toFixed(1)}px) rotate(-8deg)`);
  fBodies.forEach((b, k) => {
    const th = fSpin + k * 2 * Math.PI / 3, d = (Math.sin(th) + 1) / 2;
    const x = rx * Math.cos(th), y = ry * Math.sin(th);
    const X = x * Math.cos(tilt) - y * Math.sin(tilt), Y = x * Math.sin(tilt) + y * Math.cos(tilt) + cy;
    b.style.transform = `translate(-50%,-50%) translate(${X.toFixed(1)}px,${Y.toFixed(1)}px) scale(${((.55 + .5 * d) * (.3 + .7 * fe)).toFixed(3)})`;
    b.style.zIndex = d > .5 ? 3 : 1; b.style.opacity = (.35 + .65 * fe).toFixed(3);
    b.classList.toggle('is-far', d < .3);
  });
}
fTile.style.zIndex = 2;
const footSpin = t => {                                               // круг за 60 с
  fRaf = 0;
  if (!fSeen || !live()) return;
  fSpin += (t - (fPrev || t)) / 60000 * 2 * Math.PI; fPrev = t;
  placeFootBodies();
  fRaf = requestAnimationFrame(footSpin);
};
new IntersectionObserver(es => {
  fSeen = es[0].isIntersecting; fPrev = 0;
  if (fSeen && live() && !fRaf) fRaf = requestAnimationFrame(footSpin);
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
}, () => { fe = 1; fSpin = 1.37; fOrbit.style.setProperty('--fe', 1); fBg.style.translate = ''; placeFootBodies(); });   // в покое: машина спереди под плиткой, пин сзади за «каждом», карта сзади справа

/* ---------- пересчёт геометрии ---------- */
function relayout(){
  fit(); orb = null; procLen = 0;
  gpsRoute();
  if (live()){ pxSvg($('svg', procArc), 1000, 100); ovGeom(); placeTicks(); measureDigits(); fitSvc(); }
  measure(); wasLive = null; schedule();
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
