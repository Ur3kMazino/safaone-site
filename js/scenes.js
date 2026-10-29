/* Safa One — сцены главной под фильмом (ТЗ_главная_v2.md).
   Один движок прогресса на скролле: у каждой сцены p от 0 до 1.
     flow — секция идёт обычным потоком: p = 0, когда верх секции у низа экрана, 1 — когда низ ушёл за верх;
     pin  — внутри секции липкая сцена на экран: p = 0, когда сцена прилипла, 1 — когда отлипает.
   Пины и движение предметов — только от 1024px и при включённой анимации; иначе всё стоит в финальном виде. */
(() => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const out3 = t => 1 - (1 - t) ** 3;
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

/* ---------- движок прогресса ---------- */
const scenes = [];
const scene = (el, mode, run, final) => el && scenes.push({ el, mode, run, final, top: 0, h: 0 });
function measure(){
  const y = scrollY;
  scenes.forEach(s => { const r = s.el.getBoundingClientRect(); s.top = r.top + y; s.h = r.height; });
}
let lastY = scrollY, lastT = performance.now(), vel = 0, wasLive = null, raf = 0;
function tick(){
  raf = 0;
  const on = live(), y = scrollY, vh = innerHeight, now = performance.now();
  vel = lerp(vel, (y - lastY) / Math.max(8, now - lastT) * 16, .25);  // px за кадр, сглаженная
  lastY = y; lastT = now;
  if (on !== wasLive){ wasLive = on; if (!on) scenes.forEach(s => s.final && s.final()); }
  if (!on) return;
  for (const s of scenes){
    const top = s.top - y;
    if (top > vh * 1.4 || top + s.h < -vh * .4) continue;              // далеко от экрана — не трогаем
    const p = s.mode === 'pin' ? clamp(-top / Math.max(1, s.h - vh)) : clamp((vh - top) / (vh + s.h));
    s.run(p, top, vh, s.h);
  }
  if (Math.abs(vel) > .05) schedule();                                // доводим наклон «двигают» после остановки
}
const schedule = () => { if (!raf) raf = requestAnimationFrame(tick); };
addEventListener('scroll', schedule, { passive: true });

/* ---------- 1. Манифест: дуга горизонта распрямляется, «двигают» плывёт и наклоняется от скорости ---------- */
const man = $('.s-man'), arc = $('.man__arc'), arcLine = $('.man__line'), move = $('.man__move'), biz = $('.ln--biz');
// дуга распрямляется: контрольная точка кривой опускается к линии концов (градиент в userSpaceOnUse — на плоской линии он не пропадает)
const setArc = a => { arc.style.setProperty('--arc', a.toFixed(3)); arcLine.setAttribute('d', `M0 79 Q740 ${lerp(-50, 79, a).toFixed(1)} 1000 79`); };
scene(man, 'flow', (p, top, vh) => {
  setArc(clamp((vh * .8 - top) / (vh * .4)));
  move.style.setProperty('--mx', `${lerp(6, -3, p) * innerWidth / 100}px`);
  move.style.setProperty('--sk', `${clamp(-vel * .35, -9, 9).toFixed(2)}deg`);
  biz.style.translate = `${lerp(-2, 1, p) * innerWidth / 100}px 0`;
}, () => { setArc(1); move.style.cssText = ''; biz.style.translate = ''; });

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

/* ---------- 3. Три продукта: машина, пин и карта по наклонной орбите; подпись у того, кто спереди ---------- */
const ov = $('.s-ov'), ovBodies = $$('.ov__body'), ovCaps = $$('.ov__cap'), ring = $('.ov__ring'), stage = $('.ov__stage');
let ovFront = -1, orb = null;
function ovGeom(){
  const rx = stage.clientWidth * .22, ry = rx * .31;
  ring.style.cssText = `left:${-1.1 * rx}px;top:${-40 / 31 * ry}px;width:${2.2 * rx}px;height:${80 / 31 * ry}px;transform:rotate(-10deg)`;
  orb = { rx, ry, tilt: -10 * Math.PI / 180, size: ovBodies.map(b => [b.offsetWidth, b.offsetHeight]) };
}
scene(ov, 'pin', p => {
  if (!orb) ovGeom();
  let best = 0, bestD = -1;
  ovBodies.forEach((b, k) => {
    const th = (90 - p * 300 + k * 120) * Math.PI / 180;
    const x = orb.rx * Math.cos(th), y = orb.ry * Math.sin(th), d = (Math.sin(th) + 1) / 2;
    const X = x * Math.cos(orb.tilt) - y * Math.sin(orb.tilt), Y = x * Math.sin(orb.tilt) + y * Math.cos(orb.tilt);
    const [w, h] = orb.size[k];
    b.style.transform = `translate(${(X - w / 2).toFixed(1)}px,${(Y - h / 2).toFixed(1)}px) scale(${(.5 + .6 * d).toFixed(3)})`;
    b.style.opacity = (.5 + .5 * d).toFixed(3); b.style.zIndex = Math.round(d * 10);
    b.classList.toggle('is-far', d < .3);
    if (d > bestD){ bestD = d; best = k; }
  });
  if (best !== ovFront){
    ovCaps.forEach((c, k) => { c.classList.toggle('is-gone', k === ovFront); c.classList.toggle('is-on', k === best); });
    ovFront = best;
  }
}, () => { ovFront = -1; ovBodies.forEach(b => b.style.cssText = ''); ovCaps.forEach(c => c.classList.remove('is-on', 'is-gone')); });

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
$$('.gps__path, .map__route').forEach(path => path.setAttribute('pathLength', 1));
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
  const fmt = v => `${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},00 `;
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

/* ---------- 7. Разработка на заказ: активная строка указателя меняет предмет в липкой колонке ---------- */
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
// активна строка, ближайшая к середине экрана, среди тех, что сейчас в средней полосе (при скролле вверх тоже)
const svcIn = new Set();
const svcIo = new IntersectionObserver(es => {
  es.forEach(en => en.isIntersecting ? svcIn.add(en.target) : svcIn.delete(en.target));
  let best = null, bestD = Infinity;
  svcIn.forEach(r => { const b = r.getBoundingClientRect(), d = Math.abs(b.top + b.height / 2 - innerHeight / 2); if (d < bestD){ bestD = d; best = r; } });
  if (best) setSvc(+best.dataset.k);
}, { rootMargin: '-45% 0px -45% 0px' });
rows.forEach(r => {
  svcIo.observe(r);
  const a = r.querySelector('a');
  a.addEventListener('pointerenter', () => setSvc(+r.dataset.k));
  a.addEventListener('focus', () => setSvc(+r.dataset.k));
});
setSvc(0);

/* ---------- 8. Процесс: одометр 1→4, жемчужина-солнце едет по дуге, на «Запуске» встаёт рассвет ---------- */
const proc = $('.s-proc'), digits = $('.proc__digits'), steps = $$('.proc__step'), procArc = $('.proc__arc'),
  procPath = $('.proc__fill'), pearl = $('.proc__pearl'), ticks = $$('.proc__tick');
const STOPS = [.06, .35, .65, .94];                                   // где на дуге стоят шаги (доля длины)
let procStep = -1, procLen = 0;
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
    steps.forEach((el, i) => { el.classList.toggle('is-on', i === s); el.classList.toggle('is-past', i < s); });
    ticks.forEach((t, i) => t.classList.toggle('is-on', i <= s));
  }
}, () => { procStep = -1; steps.forEach(el => el.classList.remove('is-on', 'is-past')); });

/* ---------- 9. Контакт: чат наклоняется к форме, пока в ней пишут ---------- */
const chat = $('.ct__chat'), lead = $('#lead');
lead.addEventListener('focusin', e => { if (e.target.matches('.pf') && !reduceMq.matches) chat.style.setProperty('--tilt', '-9deg'); });
lead.addEventListener('focusout', () => chat.style.setProperty('--tilt', '0deg'));

/* ---------- 10. Футер: плитка S разворачивается, герои фильма садятся на орбиту вокруг неё ---------- */
const foot = $('.s-foot'), fOrbit = $('.foot__orbit'), fBodies = $$('.foot__b'), fBg = $('.foot__bg');
let fe = 1, fSpin = 0, fRaf = 0, fSeen = false, fPrev = 0;
function placeFootBodies(){
  const rx = fOrbit.clientWidth * .5 * fe, ry = rx * .3, tilt = -8 * Math.PI / 180;
  fBodies.forEach((b, k) => {
    const th = fSpin + k * 2 * Math.PI / 3, d = (Math.sin(th) + 1) / 2;
    const x = rx * Math.cos(th), y = ry * Math.sin(th);
    const X = x * Math.cos(tilt) - y * Math.sin(tilt), Y = x * Math.sin(tilt) + y * Math.cos(tilt);
    b.style.transform = `translate(-50%,-50%) translate(${X.toFixed(1)}px,${Y.toFixed(1)}px) scale(${((.55 + .5 * d) * (.3 + .7 * fe)).toFixed(3)})`;
    b.style.zIndex = d > .5 ? 3 : 1; b.style.opacity = (.35 + .65 * fe).toFixed(3);
    b.classList.toggle('is-far', d < .3);
  });
}
const fTile = $('.foot__tile'); fTile.style.zIndex = 2;
const footSpin = t => {                                               // круг за 48 с
  fRaf = 0;
  if (!fSeen || !live()) return;
  fSpin += (t - (fPrev || t)) / 48000 * 2 * Math.PI; fPrev = t;
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
}, () => { fe = 1; fSpin = .6; fOrbit.style.setProperty('--fe', 1); fBg.style.translate = ''; placeFootBodies(); });

/* ---------- пересчёт геометрии ---------- */
function relayout(){
  fit(); orb = null; procLen = 0;
  pxSvg($('.gps__route'), 100, 40);
  if (live()){ pxSvg($('svg', procArc), 1000, 100); ovGeom(); placeTicks(); }
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
