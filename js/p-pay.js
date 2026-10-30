/* Safa PAY — сцена страницы (ТЗ_страницы.md §2.3): payPhone (баланс в iPhone).
   Регистрируются в pages.js через SafaPages.add; в reduced-motion сразу конечное состояние. */
(() => {
const P = window.SafaPages; if (!P) return;

/* линия «Путь денег» — общий .pg-path, его включает модуль reveal в pages.js */

/* iPhone: «Можно вывести» считается от 0 до 328 400 за 1200 ms, затем короткое нажатие «Вывести» */
P.add('payPhone', () => {
  const ph = P.$('[data-pay-phone]'); if (!ph) return;
  const amt = P.$('.py-ip-amt', ph), btn = P.$('[data-act="out"]', ph);
  if (!amt) return;
  const to = +amt.dataset.to || 0;
  if (P.reduce()) { amt.textContent = P.fmt(to); return; }
  amt.textContent = P.fmt(0);
  const out = t => 1 - Math.pow(1 - t, 3);
  P.once(ph, () => {
    const t0 = performance.now(), D = 1200;
    const step = now => {
      const k = Math.min(1, (now - t0) / D);
      amt.textContent = P.fmt(to * out(k));
      if (k < 1) requestAnimationFrame(step);
      else if (btn) { btn.classList.add('is-press'); setTimeout(() => btn.classList.remove('is-press'), 200); }
    };
    requestAnimationFrame(step);
  }, { threshold: .4, rootMargin: '0px' });
});
})();
