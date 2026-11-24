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

  document.addEventListener('DOMContentLoaded', function () {
    apply(saved());
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-theme-toggle]');
      if (!btn) return;
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (err) { /* приватный режим: тема до перезагрузки */ }
      apply(next);
    });
  });
})();
