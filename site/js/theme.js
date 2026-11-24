/* Тема сайта: светлая (по умолчанию) или тёмная.
 * Подключается в <head> до CSS-отрисовки, чтобы не было вспышки светлой темы.
 * Выбор хранится в localStorage (carvic_theme = "light" | "dark").
 * Кнопки-переключатели: любые элементы с [data-theme-toggle]. */
(function () {
  'use strict';
  var KEY = 'carvic_theme';
  var root = document.documentElement;

  function saved() {
    try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  function apply(theme) {
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    var on = theme === 'dark';
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-checked', on ? 'true' : 'false');
      btns[i].title = on ? 'Включить светлую тему' : 'Включить тёмную тему';
    }
  }

  apply(saved());

  /* Заставка с логотипом: один раз за сеанс браузера, не при «уменьшить движение».
   * Класс ставится до отрисовки — у вернувшихся посетителей заставка не мелькает. */
  // ВЫКЛЮЧЕНО по решению владельца (может вернуться). Чтобы включить: SPLASH_ENABLED = true
  // и раскомментировать блок заставки в index.html (сразу после <body>). Код и стили сохранены:
  // js/splash.js (прорисовка иконки вывески), css — блок «ЗАСТАВКА ПРИ ПЕРВОМ ВХОДЕ».
  var SPLASH_ENABLED = false;
  var SPLASH_KEY = 'carvic_splash_seen';
  var splash = false;
  if (SPLASH_ENABLED) { try { splash = !sessionStorage.getItem(SPLASH_KEY); } catch (e) { splash = false; } }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) splash = false;
  if (splash) {
    root.classList.add('splash-on');
    try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch (e) { /* приватный режим */ }
  }
  function hideSplash() {
    var el = document.getElementById('splash');
    if (!el || el.classList.contains('is-out')) return;
    el.classList.add('is-out');
    setTimeout(function () { root.classList.remove('splash-on'); if (el.parentNode) el.parentNode.removeChild(el); }, 480);
  }
  if (splash) {
    var MIN = 1600, MAX = 3000; // иконка успевает прорисоваться и залиться; дольше 3 с не держим
    var started = (window.performance && performance.now) ? performance.now() : 0;
    window.addEventListener('load', function () {
      var spent = (window.performance && performance.now) ? performance.now() - started : MIN;
      setTimeout(hideSplash, Math.max(0, MIN - spent));
    });
    setTimeout(hideSplash, MAX);
  }

  document.addEventListener('DOMContentLoaded', function () {
    apply(saved());
    if (!splash) { var sp = document.getElementById('splash'); if (sp && sp.parentNode) sp.parentNode.removeChild(sp); }
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-theme-toggle]');
      if (!btn) return;
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (err) { /* приватный режим: тема до перезагрузки */ }
      apply(next);
    });
  });
})();
