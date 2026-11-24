/* «Ваш комплект, сэр!» — официант оживает от прокрутки.
 *
 * На широком экране с мышью баннер закрепляется под шапкой, а прокрутка колесом
 * «прокручивает» ролик кадр за кадром: клош поднимается, идёт пар, пар рассеивается.
 * Прокрутка назад — всё в обратную сторону. Кадры — img/promos/butler-seq/f001…f067.webp.
 * Поверх: лёгкий параллакс за курсором и красный отсвет под мышью.
 *
 * Не включается: на телефонах/планшетах (там играет обычное видео), при «уменьшить движение»,
 * если слайда с официантом нет. Выключить совсем: CARVIC_BUTLER_SCROLL = false ниже.
 */
(function () {
  'use strict';
  var CARVIC_BUTLER_SCROLL = true;
  var FRAMES = 67, PATH = 'img/promos/butler-seq/f', SCROLL = 760; // сколько пикселей прокрутки занимает ролик

  function pad(n) { return (n < 10 ? '00' : n < 100 ? '0' : '') + n; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function bind(root) {
    if (!CARVIC_BUTLER_SCROLL) return;
    var mq = window.matchMedia('(min-width: 1021px) and (hover: hover) and (pointer: fine)');
    if (!mq.matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var box = root.querySelector('.promo--deals');
    var slide = box && box.querySelector('.deal-slide--photo');
    var holder = slide && slide.querySelector('.deal-video');
    if (!holder || box.classList.contains('is-scrub')) return;

    // каркас: «рельс» прокрутки, баннер прилипает внутри него
    var pin = document.createElement('div');
    pin.className = 'deal-pin';
    box.parentNode.insertBefore(pin, box);
    pin.appendChild(box);
    box.classList.add('is-scrub');
    var v = holder.querySelector('video'); if (v) { v.pause(); v.removeAttribute('autoplay'); }

    var stage = document.createElement('div'); stage.className = 'deal-scrub';
    var canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
    stage.appendChild(canvas); holder.appendChild(stage);
    var glow = document.createElement('div'); glow.className = 'deal-glow'; slide.appendChild(glow);
    var hint = document.createElement('div'); hint.className = 'deal-hint'; hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML = '<span class="deal-hint__mouse"><i></i></span><span>Прокрутите — сэр подаст комплект</span>';
    slide.appendChild(hint);
    var body = slide.querySelector('.promo__body');
    var ctx = canvas.getContext('2d');

    // кадры: сначала первый и последний, затем остальные по порядку
    var imgs = new Array(FRAMES), ready = new Array(FRAMES);
    function load(i) {
      if (imgs[i]) return;
      var im = new Image(); im.decoding = 'async';
      im.onload = function () { ready[i] = true; if (i === shown || shown < 0) draw(i); };
      im.src = PATH + pad(i + 1) + '.webp'; imgs[i] = im;
    }
    load(0); load(FRAMES - 1);
    var k = 1;
    (function more() { for (var n = 0; n < 6 && k < FRAMES - 1; n++) load(k++); if (k < FRAMES - 1) setTimeout(more, 60); })();

    var dpr = Math.min(window.devicePixelRatio || 1, 2), cw = 0, ch = 0;
    function size() {
      var r = holder.getBoundingClientRect();
      cw = Math.round(r.width * dpr); ch = Math.round(r.height * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; shown = -1; }
      pin.style.height = (active() ? box.offsetHeight + SCROLL : box.offsetHeight) + 'px';
    }
    var shown = -1;
    function nearest(i) { for (var d = 0; d < FRAMES; d++) { if (ready[i - d]) return i - d; if (ready[i + d]) return i + d; } return -1; }
    function draw(i) {
      var j = nearest(i); if (j < 0 || !cw) return;
      var im = imgs[j], s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
      var w = im.naturalWidth * s, h = im.naturalHeight * s;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
      shown = j;
    }
    function active() { return slide.getAttribute('aria-hidden') !== 'true'; }

    // плавность: кадр и параллакс догоняют цель с инерцией
    var target = 0, cur = 0, mx = 0, my = 0, tx = 0, ty = 0, raf = 0;
    function hdr() { return parseFloat(getComputedStyle(document.body).getPropertyValue('--hdr')) || 72; }
    function measure() {
      var top = pin.getBoundingClientRect().top - (hdr() + 16);
      target = active() ? clamp(-top / SCROLL, 0, 1) : 0;
      kick();
    }
    function kick() { if (!raf) raf = requestAnimationFrame(tick); }
    function tick() {
      raf = 0;
      if (!document.body.contains(pin)) return cleanup();
      cur += (target - cur) * 0.14;
      tx += (mx - tx) * 0.08; ty += (my - ty) * 0.08;
      if (Math.abs(target - cur) < 0.0005) cur = target;
      var f = Math.round(cur * (FRAMES - 1));
      if (f !== shown) draw(f);
      stage.style.transform = 'translate3d(' + (tx * -14).toFixed(2) + 'px,' + (ty * -8).toFixed(2) + 'px,0) scale(' + (1.03 + cur * 0.05).toFixed(4) + ')';
      if (body) body.style.transform = 'translate3d(' + (tx * 6).toFixed(2) + 'px,' + (ty * 4).toFixed(2) + 'px,0)';
      hint.style.opacity = clamp(1 - cur * 6, 0, 1).toFixed(3);
      slide.style.setProperty('--p', cur.toFixed(4));
      if (cur !== target || Math.abs(mx - tx) > 0.001 || Math.abs(my - ty) > 0.001) kick();
    }
    function onScroll() { measure(); }
    function onMove(e) {
      var r = slide.getBoundingClientRect();
      mx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1);
      my = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
      glow.style.setProperty('--gx', (e.clientX - r.left) + 'px');
      glow.style.setProperty('--gy', (e.clientY - r.top) + 'px');
      slide.classList.add('is-lit');
      kick();
    }
    function onLeave() { mx = 0; my = 0; slide.classList.remove('is-lit'); kick(); }
    function onResize() { size(); draw(Math.round(cur * (FRAMES - 1))); measure(); }
    var mo = new MutationObserver(function () { size(); measure(); });
    mo.observe(slide, { attributes: true, attributeFilter: ['aria-hidden'] });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    slide.addEventListener('pointermove', onMove);
    slide.addEventListener('pointerleave', onLeave);
    function cleanup() {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      mo.disconnect();
    }
    size(); measure();
  }

  window.CarvicButler = { bind: bind };
})();
