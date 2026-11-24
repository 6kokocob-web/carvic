/* =====================================================================
 * CARVIC — логика прототипа (vanilla JS, SPA с hash-роутингом)
 * Цены и остатки берутся ТОЛЬКО через слой window.OneC (js/api/onec.js).
 * Каталог/подбор/VIN — демо-данные из js/data.js.
 * ===================================================================== */
(function () {
  'use strict';

  var C = window.COMPANY, PARTS = window.PARTS, CATS = window.CATEGORIES, API = window.OneC;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var view = $('#view');
  var LS_CART = 'carvic_cart', LS_OUTLET = 'carvic_outlet', LS_CP = 'carvic_cp_session', LS_NOTEBOOK = 'carvic_notebook';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return n == null ? '—' : Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽'; }
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function bySku(sku) { return PARTS.filter(function (p) { return p.sku === sku; })[0]; }
  function catName(k) { var c = CATS.filter(function (x) { return x.key === k; })[0]; return c ? c.name : k; }
  function outlet(id) { return C.stores.filter(function (o) { return o.id === id; })[0]; }
  function mapUrl(o) { return o.gisUrl || ''; }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600); }

  /* ------------------------- Состояние ------------------------- */
  var state = {
    make: '', model: '', year: '',
    cats: [], brands: [], page: 1, sort: 'relevance',
    outletId: lsGet(LS_OUTLET, C.stores[0].id),
    onlyStock: lsGet('carvic_only_stock', false) === true,
    cp: null,
    demoUi: false
  };
  if (!outlet(state.outletId)) state.outletId = C.stores[0].id;

  /* ---------------- Кэш цен/остатков (данные из OneC) ---------------- */
  var priceCache = {}, stockCache = {};
  function cpId() { return state.cp ? state.cp.id : null; }
  function ensureData(skus) {
    var needP = skus.filter(function (s) { return !(s in priceCache); });
    var needS = skus.filter(function (s) { return !(s in stockCache); });
    return Promise.all([
      needP.length ? API.getPrices(needP, cpId()).then(function (r) { Object.assign(priceCache, r); }) : null,
      needS.length ? API.getStocks(needS).then(function (r) { Object.assign(stockCache, r); }) : null
    ]);
  }
  function resetPrices() { priceCache = {}; }
  function priceOf(sku) { return priceCache[sku] ? priceCache[sku].price : null; }
  function priceHTML(sku) {
    var p = priceCache[sku];
    if (!p) return '<div class="price loading">…</div>';
    var note = '';
    if (p.source === 'individual') note = '<small><span class="src individual">ваша цена</span></small>';
    else if (p.source === 'base-discount') note = '<small><span class="src individual">−' + p.discountPercent + ' %</span> ' + esc(p.priceTypeName) + '</small>';
    else if (p.priceType !== 'retail') note = '<small><span class="src wholesale">' + esc(p.priceTypeName) + '</span></small>';
    return '<div class="price">' + fmt(p.price) + note + '</div>';
  }
  function stockHTML(sku) {
    var s = stockCache[sku]; if (!s) return '';
    return '<div class="res-stock" title="Остатки по торговым точкам">' + C.stores.map(function (o) {
      var q = s[o.id] || 0;
      return '<span class="' + (q ? 'y' : 'z') + '" title="' + esc(o.title + ', ' + o.address) + '">' + esc(o.short.replace(', пав.', '')) + ': <b>' + (q ? q + ' шт.' : 'нет') + '</b></span>';
    }).join('') + '</div>';
  }
  function totalStock(sku) { var s = stockCache[sku] || {}; return Object.keys(s).reduce(function (a, k) { return a + s[k]; }, 0); }

  /* ------------------------- Корзина ------------------------- */
  // Позиция корзины: { sku, outletId, qty } — outletId = торговая точка списания
  var cart = lsGet(LS_CART, []).filter(function (i) { return bySku(i.sku) && outlet(i.outletId); });
  function saveCart() { lsSet(LS_CART, cart); renderCartCount(); renderDrawer(); }
  function mergeGuestIntoServerCart() {
    if (!cart.length || !window.CarvicAccount) return Promise.resolve();
    return window.CarvicAccount.cart().then(function (quoted) {
      var items = (quoted.lines || []).map(function (l) { return { sku: l.sku, qty: l.qty, outletId: l.outletId, note: l.note || '' }; });
      cart.forEach(function (guest) {
        var same = items.filter(function (item) { return item.sku === guest.sku && item.outletId === guest.outletId; })[0];
        if (same) same.qty = Math.min(99, same.qty + guest.qty);
        else items.push({ sku: guest.sku, qty: guest.qty, outletId: guest.outletId, note: '' });
      });
      return window.CarvicAccount.setCart({ items: items, split: quoted.split, noMerge: quoted.noMerge, mode: 'pickup' });
    }).then(function () { cart = []; saveCart(); });
  }
  function cartCount() {
    if (state.serverQty != null) return state.serverQty;
    return cart.reduce(function (a, i) { return a + i.qty; }, 0);
  }
  function pickOutlet(sku) {
    var s = stockCache[sku] || {};
    if (s[state.outletId] > 0) return state.outletId;
    var o = C.stores.filter(function (x) { return s[x.id] > 0; })[0];
    return o ? o.id : state.outletId;
  }
  function addToCart(sku, outletId, qty) {
    return ensureData([sku]).then(function () {
      outletId = outletId || pickOutlet(sku);
      qty = qty || 1;
      if (state.buyer) {
        return window.CarvicAccount.cart().then(function (quoted) {
          var items = (quoted.lines || []).map(function (l) { return { sku: l.sku, qty: l.qty, outletId: l.outletId, note: l.note || '' }; });
          var it = items.filter(function (i) { return i.sku === sku && i.outletId === outletId; })[0];
          if (it) it.qty = Math.min(99, it.qty + qty); else items.push({ sku: sku, outletId: outletId, qty: qty, note: '' });
          return window.CarvicAccount.setCart({ items: items, split: quoted.split, noMerge: quoted.noMerge, mode: 'pickup' });
        }).then(function () { return refreshBuyerSession(); }).then(function () {
          var c = $('#cartCount'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
          toast('Добавлено в корзину · точка: ' + outlet(outletId).short);
        });
      }
      var it = cart.filter(function (i) { return i.sku === sku && i.outletId === outletId; })[0];
      if (it) it.qty += qty; else cart.push({ sku: sku, outletId: outletId, qty: qty });
      saveCart();
      var c = $('#cartCount'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
      toast('Добавлено в корзину · точка: ' + outlet(outletId).short);
    });
  }
  function setQty(idx, q) { q = Math.max(1, Math.min(999, parseInt(q, 10) || 1)); cart[idx].qty = q; saveCart(); }
  function setItemOutlet(idx, oid) {
    var it = cart[idx]; var same = cart.filter(function (i, j) { return j !== idx && i.sku === it.sku && i.outletId === oid; })[0];
    if (same) { same.qty += it.qty; cart.splice(idx, 1); } else it.outletId = oid;
    saveCart();
  }
  function removeItem(idx) { cart.splice(idx, 1); saveCart(); }
  function cartTotal() { return cart.reduce(function (a, i) { return a + (priceOf(i.sku) || 0) * i.qty; }, 0); }
  function renderCartCount() { $('#cartCount').textContent = cartCount(); }

  function renderDrawer() {
    var body = $('#drawerBody'), foot = $('#drawerFoot');
    if (state.buyer && window.CarvicAccount) {
      body.innerHTML = '<div class="empty">Загрузка корзины…</div>';
      foot.innerHTML = '';
      window.CarvicAccount.cart().then(function (quoted) {
        if (!state.buyer) return;
        if (!quoted.lines.length) {
          body.innerHTML = '<div class="empty">Серверная корзина пуста.<br><br><a class="btn" href="#/catalog">Перейти в каталог</a></div>';
          foot.innerHTML = '';
          return;
        }
        body.innerHTML = quoted.lines.map(function (l) {
          return '<div class="d-item"><div><div class="n">' + esc(l.name) + '</div><div class="m">' + esc(l.brand) + ' · ' + esc(l.article) + '<br>' + esc(l.outletName) + ' · ' + esc(l.term) + (l.note ? '<br>Заметка: ' + esc(l.note) : '') + '</div></div>' +
            '<div class="r"><b>' + esc(window.CarvicAccount.rub({ amount: l.sumMinor, minorUnit: 100 })) + '</b><div class="qty"><button type="button" data-sdq="' + esc(l.sku) + '" data-outlet="' + esc(l.outletId) + '" data-d="-1" aria-label="Меньше">−</button><span>' + l.qty + '</span><button type="button" data-sdq="' + esc(l.sku) + '" data-outlet="' + esc(l.outletId) + '" data-d="1" aria-label="Больше">+</button></div><button class="rm" type="button" data-sdrm="' + esc(l.sku) + '" data-outlet="' + esc(l.outletId) + '" title="Удалить">✕</button></div></div>';
        }).join('');
        foot.innerHTML = '<div class="total-row" style="margin:0 0 12px"><span>Итого (' + quoted.count + ' шт.)</span><span class="total">' + esc(window.CarvicAccount.rub({ amount: quoted.totalMinor, minorUnit: 100 })) + '</span></div>' +
          '<div style="display:flex;gap:8px"><a class="btn btn--ghost" style="flex:1" href="#/cart">Корзина</a><a class="btn" style="flex:1" href="#/checkout">Оформить заказ</a></div>';
        function mutate(items) {
          window.CarvicAccount.setCart({ items: items, split: quoted.split, noMerge: quoted.noMerge, mode: 'pickup' }).then(function () { return refreshBuyerSession(); }).then(function () { renderDrawer(); if (currentRoute().name === 'cart') route(); });
        }
        $$('[data-sdq]', body).forEach(function (b) {
          b.onclick = function () {
            mutate(quoted.lines.map(function (l) {
              var qty = l.qty;
              if (l.sku === b.dataset.sdq && l.outletId === b.dataset.outlet) qty = Math.max(1, Math.min(99, qty + (+b.dataset.d)));
              return { sku: l.sku, qty: qty, outletId: l.outletId, note: l.note || '' };
            }));
          };
        });
        $$('[data-sdrm]', body).forEach(function (b) {
          b.onclick = function () {
            mutate(quoted.lines.filter(function (l) { return !(l.sku === b.dataset.sdrm && l.outletId === b.dataset.outlet); }).map(function (l) {
              return { sku: l.sku, qty: l.qty, outletId: l.outletId, note: l.note || '' };
            }));
          };
        });
      }).catch(function (err) {
        body.innerHTML = '<div class="empty">' + esc(err.message) + '</div>';
      });
      return;
    }
    if (!cart.length) { body.innerHTML = '<div class="empty">Корзина пуста.<br><br><a class="btn" href="#/catalog">Перейти в каталог</a></div>'; foot.innerHTML = ''; return; }
    ensureData(cart.map(function (i) { return i.sku; })).then(function () {
      body.innerHTML = cart.map(function (i, idx) {
        var p = bySku(i.sku);
        return '<div class="d-item"><div class="thumb">' + icon(p.icon) + '</div><div><div class="n">' + esc(p.name) + '</div><div class="m">' + esc(p.brand) + ' · ' + esc(p.article) + '<br>Точка: ' + esc(outlet(i.outletId).short) + '</div></div>' +
          '<div class="r"><b>' + fmt((priceOf(i.sku) || 0) * i.qty) + '</b><div class="qty"><button data-dq="' + idx + '" data-d="-1" aria-label="Меньше">−</button><input value="' + i.qty + '" data-dqi="' + idx + '" aria-label="Количество"><button data-dq="' + idx + '" data-d="1" aria-label="Больше">+</button></div><button class="rm" data-drm="' + idx + '" title="Удалить">✕</button></div></div>';
      }).join('');
      foot.innerHTML = '<div class="total-row" style="margin:0 0 12px"><span>Итого (' + cartCount() + ' шт.)</span><span class="total">' + fmt(cartTotal()) + '</span></div>' +
        '<div style="display:flex;gap:8px"><a class="btn btn--ghost" style="flex:1" href="#/cart">Корзина</a><a class="btn" style="flex:1" href="#/checkout">Оформить заказ</a></div>';
    });
  }
  function openDrawer() { renderDrawer(); document.body.classList.add('drawer-open'); $('#cartDrawer').setAttribute('aria-hidden', 'false'); }
  function closeDrawer() { document.body.classList.remove('drawer-open'); $('#cartDrawer').setAttribute('aria-hidden', 'true'); }

  /* ------------------------- Сайдбар ------------------------- */
  function initSidebar() {
    var mk = $('#selMake');
    Object.keys(window.MAKES).forEach(function (m) { mk.insertAdjacentHTML('beforeend', '<option>' + esc(m) + '</option>'); });
    mk.addEventListener('change', function () { state.make = mk.value; state.model = ''; state.year = ''; syncCarSelects(); onFilters(); });
    $('#selModel').addEventListener('change', function (e) { state.model = e.target.value; state.year = ''; syncCarSelects(); onFilters(); });
    $('#selYear').addEventListener('change', function (e) { state.year = e.target.value; syncCarSelects(); onFilters(); });
    $('#resetCar').addEventListener('click', function () { state.make = state.model = state.year = ''; syncCarSelects(); onFilters(); });

    $('#catChecks').innerHTML = CATS.map(function (c) {
      return '<label><input type="checkbox" value="' + c.key + '"> ' + esc(c.name) + '</label>';
    }).join('');
    $('#brandChecks').innerHTML = window.BRANDS.map(function (b) {
      return '<label><input type="checkbox" value="' + esc(b) + '"> ' + esc(b) + '</label>';
    }).join('');
    $('#catChecks').addEventListener('change', function () { state.cats = $$('#catChecks input:checked').map(function (i) { return i.value; }); onFilters(); });
    $('#brandChecks').addEventListener('change', function () { state.brands = $$('#brandChecks input:checked').map(function (i) { return i.value; }); onFilters(); });

    var so = $('#selOutlet');
    so.innerHTML = C.stores.map(function (o) { return '<option value="' + o.id + '">' + esc(o.short) + '</option>'; }).join('');
    so.value = state.outletId;
    so.addEventListener('change', function () {
      state.outletId = so.value;
      lsSet(LS_OUTLET, so.value);
      if (state.buyer && window.CarvicAccount.setOutlet) window.CarvicAccount.setOutlet({ outletId: so.value }).catch(function () {});
      toast('Точка по умолчанию: ' + outlet(so.value).title + ', ' + outlet(so.value).address);
      if (currentRoute().name === 'catalog' || currentRoute().name === 'search') route();
    });
  }
  function syncCarSelects() {
    var md = $('#selModel'), yr = $('#selYear');
    $('#selMake').value = state.make;
    md.innerHTML = '<option value="">Модель</option>' + (state.make ? window.MAKES[state.make].map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') : '');
    md.disabled = !state.make; md.value = state.model;
    yr.innerHTML = '<option value="">Год</option>' + (state.model ? window.YEARS.map(function (y) { return '<option>' + y + '</option>'; }).join('') : '');
    yr.disabled = !state.model; yr.value = state.year;
    $('#resetCar').hidden = !state.make;
  }
  function syncChecks() {
    $$('#catChecks input').forEach(function (i) { i.checked = state.cats.indexOf(i.value) >= 0; });
    $$('#brandChecks input').forEach(function (i) { i.checked = state.brands.indexOf(i.value) >= 0; });
  }
  function refreshBuyerSession() {
    if (!window.CarvicAccount) return Promise.resolve();
    return window.CarvicAccount.me().then(function (me) {
      state.buyer = me.account;
      state.wholesale = me.wholesale || null;
      state.act = me.act && me.act.active ? me.act : null;
      state.serverQty = me.cartCount || 0;
      if (me.outletId && outlet(me.outletId)) {
        state.outletId = me.outletId;
        lsSet(LS_OUTLET, me.outletId);
        var so = $('#selOutlet');
        if (so) so.value = me.outletId;
      }
      renderBuyer();
      renderCartCount();
    }).catch(function () {
      state.buyer = null;
      state.wholesale = null;
      state.act = null;
      state.serverQty = null;
      renderBuyer();
      renderCartCount();
    });
  }
  /* Иконка входа в шапке: гость — «Войти» (окно входа), после входа — «Профиль» с меню */
  function loggedIn() { return !!(state.buyer || state.wholesale); }
  function closeProfileMenu() {
    var menu = $('#profileMenu'), btn = $('#profileBtn');
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  function renderProfile() {
    var btn = $('#profileBtn'), label = $('#profileLabel'), menu = $('#profileMenu');
    if (!btn) return;
    var on = loggedIn();
    label.textContent = on ? 'Профиль' : 'Войти';
    btn.setAttribute('aria-label', on ? 'Профиль и личный кабинет' : 'Войти в личный кабинет');
    btn.classList.toggle('is-in', on);
    if (on) {
      btn.setAttribute('aria-haspopup', 'menu');
      var name = (state.wholesale && state.wholesale.name) || (state.buyer && state.buyer.name) || '';
      menu.innerHTML = (name ? '<p class="profile-menu__name">' + esc(name) + '</p>' : '') +
        [['#/account', 'Профиль'], ['#/account/orders', 'Мои заказы'], ['#/account/garage', 'Гараж'], ['#/account/balance', 'Баланс'], ['#/notebook', 'Блокнот'], ['#/account/settings', 'Настройки']]
          .map(function (it) { return '<a role="menuitem" href="' + it[0] + '">' + it[1] + '</a>'; }).join('') +
        '<hr><button type="button" role="menuitem" class="profile-menu__out" id="profileLogout">Выйти</button>';
      $('#profileLogout').onclick = function () {
        closeProfileMenu();
        var done = state.act ? window.CarvicAccount.stopAct() : window.CarvicAccount.logout();
        done.then(function () { state.buyer = null; state.wholesale = null; state.act = null; state.serverQty = null; renderBuyer(); renderCartCount(); route(); });
      };
    } else {
      btn.removeAttribute('aria-haspopup');
      closeProfileMenu();
      menu.innerHTML = '';
    }
  }
  function initProfile() {
    var btn = $('#profileBtn'), menu = $('#profileMenu');
    if (!btn) return;
    btn.onclick = function (e) {
      e.stopPropagation();
      if (!loggedIn()) { location.hash = '#/signin'; return; }
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { var first = $('a', menu); if (first) first.focus(); }
    };
    document.addEventListener('click', function (e) { if (!menu.hidden && !e.target.closest('#profileWrap')) closeProfileMenu(); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) closeProfileMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { closeProfileMenu(); btn.focus(); } });
    renderProfile();
  }
  function renderBuyer() {
    renderProfile();
    var b = $('#buyerBox');
    if (!b) return;
    if (state.buyer || state.wholesale) {
      var name = (state.wholesale && state.wholesale.name) || (state.buyer && state.buyer.name) || '';
      var role = state.act ? (state.act.actorName || state.act.actorLogin) : (state.wholesale ? (state.wholesale.priceKindName || 'Опт') : 'Кабинет');
      b.innerHTML = (state.act ? '<span class="demo-badge">служебный просмотр</span> ' : '') + '<b>' + esc(name) + '</b><span class="pt">' + esc(role) + '</span><br><a href="#/account">Профиль и заказы</a><br><a href="#/account/settings">Настройки</a><br><button id="buyerLogout" type="button">' + (state.act ? 'Завершить просмотр' : 'Выйти') + '</button>';
      $('#buyerLogout').onclick = function () {
        var done = state.act ? window.CarvicAccount.stopAct() : window.CarvicAccount.logout();
        done.then(function () { state.buyer = null; state.wholesale = null; state.act = null; state.serverQty = null; renderBuyer(); renderCartCount(); route(); });
      };
      return;
    }
    if (state.cp) {
      b.innerHTML = '<b>' + esc(state.cp.name) + '</b><span class="pt">Тип цены: ' + esc(state.cp.priceTypeName || state.cp.priceType) + '</span><br><button id="cpLogout">Выйти</button>';
      $('#cpLogout').onclick = function () { state.cp = null; localStorage.removeItem(LS_CP); resetPrices(); renderBuyer(); renderDrawer(); route(); toast('Вы вышли. Показаны розничные цены.'); };
    } else {
      b.innerHTML = '<b>Гость</b><span class="pt">Розничные цены</span><br><a href="#/login">Вход для контрагентов</a><br><a href="#/account">Личный кабинет</a>';
    }
  }
  function onFilters() {
    state.page = 1;
    var r = currentRoute();
    if (r.name === 'home' || r.name === 'catalogCat') route();
    else location.hash = '#/';
  }

  /* ------------------------- Фильтрация ------------------------- */
  function filtered(opts) {
    opts = opts || {};
    var cats = opts.cats || state.cats, make = opts.make != null ? opts.make : state.make;
    return PARTS.filter(function (p) {
      if (make && p.compat.indexOf(make) < 0) return false;
      if (cats.length && cats.indexOf(p.cat) < 0) return false;
      if (state.brands.length && state.brands.indexOf(p.brand) < 0) return false;
      return true;
    });
  }
  function sortList(list) {
    var l = list.slice();
    if (state.sort === 'price-asc') l.sort(function (a, b) { return (priceOf(a.sku) || 0) - (priceOf(b.sku) || 0); });
    if (state.sort === 'price-desc') l.sort(function (a, b) { return (priceOf(b.sku) || 0) - (priceOf(a.sku) || 0); });
    if (state.sort === 'stock') l.sort(function (a, b) { return totalStock(b.sku) - totalStock(a.sku); });
    return l;
  }
  function resItem(p) {
    return '<li class="res-item"><div class="thumb">' + icon(p.icon) + '</div>' +
      '<div><div class="res-name"><a href="#/part/' + encodeURIComponent(p.sku) + '">' + esc(p.name) + '</a></div>' +
      '<div class="res-sub">' + esc(p.brand) + ' <span>· арт. ' + esc(p.article) + ' · OEM ' + esc(p.oem) + '</span></div></div>' +
      priceHTML(p.sku) + '<button class="btn" data-add="' + esc(p.sku) + '">В корзину</button>' + stockHTML(p.sku) + '</li>';
  }
  function resultsBlock(list, perPage, title, emptyText) {
    var pages = Math.max(1, Math.ceil(list.length / perPage));
    if (state.page > pages) state.page = pages;
    var slice = sortList(list).slice((state.page - 1) * perPage, state.page * perPage);
    var html = '<div class="res-head"><h2 class="card__title">' + (title || 'Результаты') + ' <small>' + list.length + ' поз.</small></h2>' +
      '<div class="res-tools"><select id="sortSel" aria-label="Сортировка"><option value="relevance">По умолчанию</option><option value="price-asc">Сначала дешевле</option><option value="price-desc">Сначала дороже</option><option value="stock">По наличию</option></select></div></div>';
    if (!list.length) html += '<div class="empty">' + (emptyText || 'Ничего не найдено. Измените фильтры или выберите другой узел на схеме.') + '</div>';
    else html += '<ul class="res-list">' + slice.map(resItem).join('') + '</ul>';
    if (pages > 1) {
      html += '<div class="pager">';
      for (var i = 1; i <= pages; i++) html += '<button data-page="' + i + '" class="' + (i === state.page ? 'on' : '') + '">' + i + '</button>';
      html += '</div>';
    }
    return html;
  }
  function bindResults(root) {
    var s = $('#sortSel', root); if (s) { s.value = state.sort; s.onchange = function () { state.sort = s.value; route(); }; }
    $$('[data-page]', root).forEach(function (b) { b.onclick = function () { state.page = +b.dataset.page; route(); }; });
  }
  function chipsHTML() {
    var ch = [];
    if (state.make) ch.push('<span class="chip chip--car">' + esc([state.make, state.model, state.year].filter(Boolean).join(' ')) + ' <button data-chip="car" aria-label="Сбросить">✕</button></span>');
    state.cats.forEach(function (c) { ch.push('<span class="chip">' + esc(catName(c)) + ' <button data-chip="cat:' + c + '">✕</button></span>'); });
    state.brands.forEach(function (b) { ch.push('<span class="chip">' + esc(b) + ' <button data-chip="brand:' + esc(b) + '">✕</button></span>'); });
    return ch.length ? '<div class="chips">' + ch.join('') + '</div>' : '';
  }
  function bindChips(root) {
    $$('[data-chip]', root).forEach(function (b) {
      b.onclick = function () {
        var v = b.dataset.chip;
        if (v === 'car') { state.make = state.model = state.year = ''; syncCarSelects(); }
        else if (v.indexOf('cat:') === 0) state.cats = state.cats.filter(function (c) { return c !== v.slice(4); });
        else state.brands = state.brands.filter(function (x) { return x !== v.slice(6); });
        syncChecks(); onFilters();
      };
    });
  }

  /* ------------------------- Схема автомобиля (SVG) ------------------------- */
  var HOTSPOTS = [
    { cat: 'electrics', label: 'Электрика', pt: [86, 189], an: [62, 40], top: true },
    { cat: 'engine', label: 'Двигатель', pt: [168, 176], an: [172, 40], top: true },
    { cat: 'filters', label: 'Фильтры', pt: [214, 170], an: [282, 40], top: true },
    { cat: 'body', label: 'Кузов', pt: [400, 107], an: [410, 40], top: true },
    { cat: 'fluids', label: 'Масла', pt: [235, 182], an: [530, 40], top: true, hidden: true },
    { cat: 'cooling', label: 'Охлаждение', pt: [60, 214], an: [42, 304] },
    { cat: 'brakes', label: 'Тормоза', pt: [150, 232], an: [150, 304] },
    { cat: 'transmission', label: 'Трансмиссия', pt: [300, 238], an: [300, 304] },
    { cat: 'suspension', label: 'Подвеска', pt: [470, 176], an: [470, 304] },
    { cat: 'exhaust', label: 'Выхлоп', pt: [566, 240], an: [596, 304] }
  ];
  function spring(x, y1, y2) {
    var pts = [], n = 0;
    for (var y = y1; y <= y2; y += 6) { pts.push((x + (n % 2 ? 9 : -9)) + ',' + y); n++; }
    return '<polyline class="spring" points="' + pts.join(' ') + '"/>';
  }
  function wheel(cx, cy) {
    var holes = '';
    for (var a = 0; a < 5; a++) { var r = a * 2 * Math.PI / 5; holes += '<circle cx="' + (cx + 15 * Math.cos(r)).toFixed(1) + '" cy="' + (cy + 15 * Math.sin(r)).toFixed(1) + '" r="3" fill="#8a8f97"/>'; }
    return '<circle class="tyre" cx="' + cx + '" cy="' + cy + '" r="40"/><circle class="rim" cx="' + cx + '" cy="' + cy + '" r="27"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="21" fill="#b7bcc4" stroke="#1b1c20" stroke-width="1"/>' +
      '<path d="M' + (cx - 14) + ' ' + (cy - 15) + ' a20 20 0 0 1 26 -4 l-4 8 a12 12 0 0 0 -16 3z" fill="var(--c-accent)"/>' + holes +
      '<circle cx="' + cx + '" cy="' + cy + '" r="6" fill="#1b1c20"/>';
  }
  function schemeSVG() {
    var active = state.cats.length === 1 ? state.cats[0] : null;
    var s = '<svg viewBox="0 0 640 330" role="img" aria-label="Интерактивная схема автомобиля: выберите узел">' +
      '<ellipse cx="330" cy="274" rx="290" ry="8" fill="#e9eaee"/>' +
      '<path class="car-line" d="M58 236 L50 214 Q48 196 62 188 L80 182 Q140 170 200 166 L240 160 Q280 128 318 112 Q340 104 380 104 L430 106 Q470 112 510 142 L560 150 Q588 154 590 176 L592 214 Q590 234 574 236 L516 236 A46 46 0 0 0 424 236 L196 236 A46 46 0 0 0 104 236 Z"/>' +
      '<path class="glass" d="M262 160 L316 124 Q330 118 348 118 L350 160 Z"/>' +
      '<path class="glass" d="M362 160 L362 118 L418 118 Q448 124 476 150 L476 160 Z"/>' +
      '<path class="car-thin" d="M200 166 L500 158 M246 166 L248 228 M356 118 L356 232 M466 160 Q462 196 432 210 M200 226 L424 226 M80 182 Q120 192 200 190"/>' +
      '<rect x="302" y="176" width="20" height="4" rx="2" fill="#1b1c20"/><rect x="408" y="174" width="20" height="4" rx="2" fill="#1b1c20"/>' +
      '<path d="M262 158 l-16 -4 l-6 10 l18 4z" fill="#fff" stroke="#1b1c20" stroke-width="1.6"/>' +
      '<path d="M64 190 L106 181 L112 191 L70 199 Z" fill="#f4f6f9" stroke="#1b1c20" stroke-width="1.6"/>' +
      '<path d="M52 214 L72 210 L72 222 L54 224 Z" fill="#2a2c33"/>' +
      '<path d="M566 156 L589 162 L590 177 L564 173 Z" fill="var(--c-accent)" stroke="#1b1c20" stroke-width="1.2"/>' +
      '<path d="M560 236 L600 236" stroke="#1b1c20" stroke-width="3"/>' +
      spring(150, 168, 206) + spring(470, 150, 206) +
      '<path d="M196 238 L424 238" stroke="var(--c-accent)" stroke-width="3" stroke-dasharray="7 5"/>' +
      wheel(150, 236) + wheel(470, 236);
    HOTSPOTS.forEach(function (h) {
      if (h.hidden) return;
      var on = active === h.cat ? ' on' : '';
      var ty = h.top ? h.an[1] - 10 : h.an[1] + 20;
      s += '<g class="hs' + on + '" data-hs="' + h.cat + '" tabindex="0" role="button" aria-label="' + esc(h.label) + '">' +
        '<path class="lead" d="M' + h.pt[0] + ' ' + h.pt[1] + ' L' + h.an[0] + ' ' + h.an[1] + '"/>' +
        '<circle class="pulse" cx="' + h.pt[0] + '" cy="' + h.pt[1] + '" r="8"/>' +
        '<circle class="pt" cx="' + h.pt[0] + '" cy="' + h.pt[1] + '" r="5"/>' +
        '<circle class="dot" cx="' + h.an[0] + '" cy="' + h.an[1] + '" r="6"/>' +
        '<text class="lbl" x="' + h.an[0] + '" y="' + ty + '" text-anchor="middle">' + esc(h.label) + '</text>' +
        '<circle cx="' + h.an[0] + '" cy="' + h.an[1] + '" r="16" fill="transparent"/><circle cx="' + h.pt[0] + '" cy="' + h.pt[1] + '" r="14" fill="transparent"/></g>';
    });
    return s + '</svg>';
  }
  function bindScheme(root) {
    $$('[data-hs]', root).forEach(function (g) {
      var act = function () {
        var c = g.dataset.hs;
        state.cats = (state.cats.length === 1 && state.cats[0] === c) ? [] : [c];
        syncChecks(); state.page = 1; route();
      };
      g.addEventListener('click', act);
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
    });
    $$('[data-sc]', root).forEach(function (b) { b.onclick = function () { state.cats = b.dataset.sc ? [b.dataset.sc] : []; syncChecks(); state.page = 1; route(); }; });
  }

  /* ------------------------- Страницы ------------------------- */
  var pages = {};

  /* Иконки главной: простая линия, цвет — currentColor */
  var HOME_ICONS = {
    brakes: '<circle cx="22" cy="26" r="16"/><circle cx="22" cy="26" r="5"/><circle cx="22" cy="15" r="1.2"/><circle cx="31.5" cy="26" r="1.2"/><circle cx="22" cy="37" r="1.2"/><circle cx="12.5" cy="26" r="1.2"/><path d="M30 8a20 20 0 0 1 12 12l-6 3a14 14 0 0 0-8-8z"/>',
    suspension: '<circle cx="24" cy="6" r="3"/><path d="M24 9v4M14 13h20M14 35h20"/><path d="M16 13l16 4-16 4 16 4-16 4 16 4"/><rect x="20" y="35" width="8" height="8" rx="1"/>',
    engine: '<path d="M8 18h6l3-4h12l3 4h6v18H8z"/><path d="M4 22v10M44 22v10M4 27h4M40 27h4"/><path d="M18 10h12M24 10v4"/><path d="M22 22l-3 6h6l-3 6"/>',
    filters: '<ellipse cx="24" cy="9" rx="12" ry="4"/><path d="M12 9v30c0 2.2 5.4 4 12 4s12-1.8 12-4V9"/><path d="M17 14v24M22 15v25M27 15v25M32 14v24"/>',
    belts: '<circle cx="14" cy="30" r="9"/><circle cx="36" cy="14" r="6"/><circle cx="14" cy="30" r="3"/><circle cx="36" cy="14" r="2"/><path d="M7.6 23.6L31.8 9.7M20.4 36.4L40.2 18.3"/>',
    electrics: '<rect x="6" y="14" width="36" height="26" rx="3"/><path d="M13 14V9h6v5M29 14V9h6v5"/><path d="M13 22h6M16 19v6M29 22h6"/><path d="M25 27l-3 5h4l-3 5"/>',
    cooling: '<rect x="6" y="10" width="36" height="28" rx="2"/><path d="M12 14v20M18 14v20M24 14v20M30 14v20M36 14v20"/><path d="M42 16h3M3 32h3"/>',
    fluids: '<path d="M10 16h20l8 8v18H10z"/><path d="M16 16v-6h8v6"/><path d="M30 6h6v6"/><path d="M24 26c-3 4-4 6-4 8a4 4 0 0 0 8 0c0-2-1-4-4-8z"/>',
    store: '<path d="M8 20l16-12 16 12v20H8z"/><path d="M20 40V28h8v12"/>',
    check: '<path d="M40 12L18 34 8 24"/>',
    swap: '<path d="M14 14h20l-6-6M34 34H14l6 6"/>',
    wrench: '<path d="M29.4 12.6a8 8 0 0 0-10.8 10.8L6 36l6 6 12.6-12.6a8 8 0 0 0 10.8-10.8l-5 5-4.8-1.2-1.2-4.8z"/>'
  };
  function homeIcon(name, size) {
    return '<svg class="hico" width="' + (size || 44) + '" height="' + (size || 44) + '" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (HOME_ICONS[name] || '') + '</svg>';
  }

  function brandLanding() {
    var perks = [
      ['store', '3 магазина в Иркутске', 'Автосити и Прибой'],
      ['check', 'Проверка до оплаты', 'Сверяем по VIN и артикулу'],
      ['swap', 'Оригиналы и аналоги', 'Объясним разницу в цене'],
      ['wrench', 'Для СТО', 'Закупка списком, свои условия']
    ];
    var tiles = [
      ['brakes', 'brakes', 'Тормозная система'],
      ['suspension', 'suspension', 'Подвеска и рулевое'],
      ['engine', 'engine', 'Двигатель'],
      ['filters', 'filters', 'Фильтры и ТО'],
      ['engine', 'belts', 'Ремни и ролики'],
      ['electrics', 'electrics', 'Электрика'],
      ['cooling', 'cooling', 'Охлаждение'],
      ['fluids', 'fluids', 'Масла и жидкости']
    ];
    var posts = [
      ['Тормоза', 'Когда менять тормозные колодки: 6 признаков износа', '#/catalog/brakes'],
      ['Электрика', 'Аккумулятор для сибирской зимы: как выбрать', '#/catalog/electrics'],
      ['Подвеска', 'Стук в подвеске: как найти причину по звуку', '#/catalog/suspension'],
      ['Подбор', 'Как найти запчасть по VIN-коду', '#/inquiry']
    ];
    var stores = C.stores.map(function (o) {
      var m = /,\s*пав\.\s*([^,]+)$/.exec(o.address || '');
      var title = (o.title || '') + (m ? ', пав. ' + m[1] : '');
      var addr = m ? o.address.slice(0, m.index) : (o.address || '');
      return '<article class="store-card" data-store="' + esc(o.id) + '"><h3>' + esc(title) + '</h3><p class="muted">' + esc(addr) + '</p>' +
        (o.hours ? '<p>' + esc(o.hours) + '</p>' : '') +
        (o.gisUrl ? '<a class="store-card__map" href="' + esc(o.gisUrl) + '" target="_blank" rel="noopener">Показать на карте</a>' : '') + '</article>';
    }).join('');
    return '' +
      '<section class="home-hero">' +
        '<div class="home-hero__main">' +
          '<h1>Всё подходит</h1>' +
          '<p class="brand-lead">Подберём деталь по VIN и проверим совместимость до оплаты. Подскажем, что стоит заменить вместе с ней.</p>' +
          '<form class="home-search" id="homeSearch"><label for="homeQuery" class="sr">VIN или номер кузова</label><input id="homeQuery" type="text" placeholder="VIN или номер кузова" maxlength="40" spellcheck="false"><button class="btn btn--dark" type="submit">Подобрать по VIN</button></form>' +
          '<p class="home-hero__note">Ищете по артикулу — введите его в строку поиска вверху. Нет VIN под рукой? Позвоните: <a href="tel:+73952575757">+7 (3952) 57-57-57</a></p>' +
        '</div>' +
        '<div class="home-hero__sto">' +
          '<div><h2>Для автосервисов</h2><p>Пришлите список деталей — подготовим предложение и условия закупки для вашего СТО.</p></div>' +
          '<a class="btn btn--light" href="#/wholesale">Обсудить закупку</a>' +
        '</div>' +
      '</section>' +
      '<section class="home-perks" aria-label="Почему Карвик">' + perks.map(function (row) {
        return '<div class="home-perk">' + homeIcon(row[0], 24) + '<div><b>' + esc(row[1]) + '</b><span>' + esc(row[2]) + '</span></div></div>';
      }).join('') + '</section>' +
      '<section class="home-sec"><div class="home-sec__head"><h2>Каталог</h2><a href="#/catalog">Весь каталог →</a></div>' +
        '<div class="home-tiles">' + tiles.map(function (t) {
          return '<a class="home-tile" href="#/catalog/' + t[0] + '">' + homeIcon(t[1], 44) + '<span>' + esc(t[2]) + '</span></a>';
        }).join('') + '</div></section>' +
      '<section class="home-sec" id="homeStores"><div class="home-sec__head"><h2>Магазины в Иркутске</h2><a href="#/stores">Все магазины →</a></div>' +
        '<div class="home-stores">' + stores + '<article class="store-card store-card--soon"><h3>Ангарск</h3><p class="muted">Скоро открытие</p></article></div></section>' +
      '<section class="home-ask" id="homeAsk">' +
        '<div class="home-ask__text"><h2>Не нашли деталь?</h2><p>Оставьте телефон и напишите, что ищете. Перезвоним с ценой, наличием и сроком.</p></div>' +
        '<form class="home-ask__form" id="homeInquiry">' +
          '<div class="field"><label for="homeName">Имя</label><input id="homeName" maxlength="80" required></div>' +
          '<div class="field"><label for="homePhone">Телефон</label><input id="homePhone" inputmode="tel" maxlength="18" placeholder="+7" required></div>' +
          '<div class="field field--wide"><label for="homePart">Какая деталь нужна</label><input id="homePart" maxlength="2000" placeholder="Например: передние колодки, Toyota Corolla 2014" required></div>' +
          '<div class="field"><label for="homeCode">VIN или артикул</label><input id="homeCode" maxlength="120" spellcheck="false"></div>' +
          '<input id="homeCar" type="hidden" value="">' +
          '<div class="field" style="position:absolute;left:-9999px" aria-hidden="true"><label>Компания<input id="homeCompany" tabindex="-1" autocomplete="off"></label></div>' +
          '<div class="home-ask__foot"><label class="check"><input type="checkbox" id="homeConsent"> Согласен на <a href="#/legal/consent-request">обработку персональных данных</a></label>' +
          '<button class="btn" type="submit">Узнать цену</button></div>' +
        '</form><div id="homeInquiryResult"></div>' +
      '</section>' +
      '<section class="home-sec"><div class="home-sec__head"><h2>Полезное</h2><a href="#/blog">Все статьи →</a></div>' +
        '<div class="home-posts">' + posts.map(function (p) {
          return '<a class="home-post" href="' + p[2] + '"><small>' + esc(p[0]) + '</small><b>' + esc(p[1]) + '</b></a>';
        }).join('') + '</div></section>' +
      (window.CarvicGeo ? '<section class="home-sec" id="homeGeo"><div class="home-sec__head"><h2>География</h2><a href="#/stores">Все магазины →</a></div>' + window.CarvicGeo.html(geoCities()) + '</section>' : '');
  }

  pages.home = function () {
    if (!state.demoUi) {
      return Promise.resolve('<div class="page brand-home" id="homeLive">' + brandLanding() + '</div>');
    }
    var list = filtered();
    return ensureData(list.map(function (p) { return p.sku; })).then(function () {
      var carTxt = state.make ? [state.make, state.model, state.year].filter(Boolean).join(' ') : '';
      var title = state.cats.length || state.make || state.brands.length ? 'Результаты' : 'Результаты <small>(популярное)</small>';
      return '<h1 class="home-title">Подбор запчастей</h1><div class="work">' +
        '<section class="card scheme"><h2 class="card__title">Схема автомобиля ' + (carTxt ? '<small>' + esc(carTxt) + '</small>' : '') + '</h2>' +
        schemeSVG() +
        '<div class="scheme-cats"><button data-sc="" class="' + (!state.cats.length ? 'on' : '') + '">Все узлы</button>' +
        CATS.map(function (c) { return '<button data-sc="' + c.key + '" class="' + (state.cats.length === 1 && state.cats[0] === c.key ? 'on' : '') + '">' + esc(c.name) + '</button>'; }).join('') + '</div>' +
        '<p class="scheme-help">' + (state.make ? 'Нажмите на красную точку, чтобы показать запчасти узла.' : 'Выберите марку, модель и год слева или введите VIN в строке поиска. Нажмите на красную точку, чтобы отфильтровать запчасти по узлу.') + '</p></section>' +
        '<section class="card results">' + chipsHTML() + resultsBlock(list, 6, title) +
        '<p class="demo-note"><span class="demo-badge">демо</span> Каталог, цены и наличие — демонстрационные данные. Цены и остатки получены через слой 1С (mock).</p></section></div>';
    });
  };
  pages.home.after = function (root) {
    bindScheme(root); bindResults(root); bindChips(root);
    if (window.CarvicGeo && $('#homeGeo', root)) window.CarvicGeo.bind(root);
    var search = $('#homeSearch', root);
    if (search) search.onsubmit = function (e) {
      e.preventDefault();
      var raw = $('#homeQuery', root).value.trim();
      var v = raw.replace(/\s/g, '').toUpperCase();
      if (!raw) { $('#homeQuery', root).focus(); return; }
      if (/^[A-HJ-NPR-Z0-9]{17}$/.test(v) && state.demoUi) { location.hash = '#/vin/' + v; return; }
      // VIN или номер кузова → в заявку на подбор: менеджер подберёт и перезвонит
      var code = $('#homeCode', root);
      if (code) {
        code.value = /^[A-HJ-NPR-Z0-9]{17}$/.test(v) ? v : raw;
        var part = $('#homePart', root);
        if (part && !part.value) part.value = 'Подбор по VIN';
        $('#homeAsk', root).scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () { var n = $('#homeName', root); if (n) n.focus({ preventScroll: true }); }, 350);
      }
    };
    var form = $('#homeInquiry', root);
    if (!form || !window.CarvicAccount) return;
    form.onsubmit = function (e) {
      e.preventDefault();
      var code = $('#homeCode', root).value.trim();
      var compact = code.replace(/\s/g, '').toUpperCase();
      var vin = /^[A-HJ-NPR-Z0-9]{17}$/.test(compact) ? compact : '';
      var message = $('#homePart', root).value.trim();
      var car = $('#homeCar', root).value.trim();
      if (car) message += '. Автомобиль: ' + car;
      window.CarvicAccount.sendInquiry({
        kind: 'selection',
        name: $('#homeName', root).value,
        contact: $('#homePhone', root).value,
        message: message,
        article: vin ? '' : code,
        vin: vin,
        company: $('#homeCompany', root).value,
        consentRequest: $('#homeConsent', root).checked
      }).then(function (res) {
        $('#homeInquiryResult', root).innerHTML = '<div class="warn-box">Номер ' + esc(res.id) + '. ' + esc(res.note) + '</div>';
      }).catch(function (err) { toast(err.message); });
    };
  };
  pages.feedProduct = function (id) {
    var call = state.wholesale && window.CarvicAccount
      ? window.CarvicAccount.feedProduct(id)
      : fetch('/api/feed/product?id=' + encodeURIComponent(id), { headers: { Accept: 'application/json' } }).then(function (r) { return r.json().then(function (data) { if (!r.ok) throw new Error(data.message || 'Товар не найден'); return data; }); });
    return call.then(function (data) {
      var product = data.product;
      pages.feedProduct._stock = product.stock || {};
      var pickup = (product.pickup || []).map(function (row) { return '<li>' + esc(row.label) + '</li>'; }).join('');
      var catBits = [];
      if (product.groupParent) catBits.push('<a href="#/catalog?group=' + encodeURIComponent(product.groupParent) + '">' + esc(showCat(product.groupParent)) + '</a>');
      if (product.group) catBits.push('<a href="#/catalog?category=' + encodeURIComponent(product.group) + '">' + esc(showCat(product.group)) + '</a>');
      var anyHere = product.stock && C.stores.some(function (store) { return Number(product.stock[store.id]) > 0; });
      var badge = product.stock ? '<p><span class="status-badge ' + (anyHere ? 'status-badge--ok' : 'status-badge--wait') + '">' + (anyHere ? 'В наличии' : 'Нет в наличии') + '</span></p>' : '';
      return '<div class="page sheet" id="feedProduct"><div class="crumbs"><a href="#/catalog">Каталог</a> / <span>' + esc(product.article || product.name) + '</span></div><article class="sheet-layout"><div class="sheet-ph" aria-hidden="true"></div><div class="sheet-copy"><h1 class="part-title">' + esc(product.name) + '</h1>' +
        '<p class="price sheet-price">' + esc(product.price && product.price.label || 'цена по запросу') + '</p>' +
        '<p class="sku-tag">' + esc(product.article || 'без артикула') + '</p>' + (product.oem ? '<p class="sku-tag">OEM ' + esc(product.oem) + '</p>' : '') +
        badge +
        '<p>Бренд: <b>' + esc(product.brand || 'не указан') + '</b></p>' +
        (catBits.length ? '<p>Категория: ' + catBits.join(' · ') + '</p>' : '') +
        feedStock(product) + (pickup ? '<ul>' + pickup + '</ul>' : '') +
        '<div class="feed-outlets">' + C.stores.map(function (store) {
          var qty = product.stock ? (Number(product.stock[store.id]) || 0) : 0;
          var word = product.stock ? (qty ? (qty + ' шт. в наличии') : outletSupplyWord(product.stock, store.id)) : 'нет данных';
          var picked = pickFeedOutlet(product) === store.id;
          return '<label class="summary-line"><span><input type="radio" name="feedOutlet" value="' + esc(store.id) + '"' + (picked ? ' checked' : '') + '> ' + esc(store.short) + '</span><b class="' + (qty ? 'stock-ok' : 'stock-wait') + '">' + esc(word) + '</b></label>';
        }).join('') + '</div>' +
        '<p class="receipt" id="feedReceipt">' + esc(product.receipt || receiptPhrase(product.stock, pickFeedOutlet(product), 1)) + '</p>' +
        (product.price && product.price.request || (!product.orderable && data.staleWarning)
          ? feedOrderAction(product, Boolean(data.staleWarning))
          : '<div class="feed-buy"><div class="qty"><button type="button" id="feedMinus" aria-label="Меньше">−</button><input id="feedQty" data-feed-qty value="1" inputmode="numeric" aria-label="Количество"><button type="button" id="feedPlus" aria-label="Больше">+</button></div><button class="btn" type="button" data-feed-add="' + esc(product.id) + '" data-outlet="' + esc(pickFeedOutlet(product)) + '">В корзину</button>' + notebookButton(product.id) + '</div>') +
        (product.price && product.price.request || (!product.orderable && data.staleWarning) ? notebookButton(product.id) : '') +
        askLinks(product.article, product.brand) +
        '<p class="muted">' + esc(data.stockStamp || '') + '</p>' +
        (data.staleWarning ? '<div class="warn-box">' + esc(data.staleWarning) + '</div>' : '') + '</div></article></div>';
    }).catch(function (err) { return '<div class="page"><h1>Товар</h1><div class="card">' + esc(err.message) + '</div></div>'; });
  };
  pages.feedProduct.after = function (root) {
    var line = $('#feedReceipt', root);
    var qty = $('#feedQty', root);
    function paint() {
      var radio = $('input[name=feedOutlet]:checked', root);
      var count = Math.max(1, parseInt(qty && qty.value, 10) || 1);
      var outletId = radio ? radio.value : state.outletId;
      if (line) line.textContent = receiptPhrase(pages.feedProduct._stock || {}, outletId, count);
      var btn = $('[data-feed-add]', root);
      if (btn && radio) btn.setAttribute('data-outlet', radio.value);
    }
    $$('input[name=feedOutlet]', root).forEach(function (radio) { radio.onchange = paint; });
    if (qty) {
      var minus = $('#feedMinus', root);
      var plus = $('#feedPlus', root);
      if (minus) minus.onclick = function () { qty.value = Math.max(1, (+qty.value || 1) - 1); paint(); };
      if (plus) plus.onclick = function () { qty.value = (+qty.value || 0) + 1; paint(); };
      qty.oninput = paint;
    }
    bindFeedAdd(root);
    bindNotebook(root);
  };

  function feedStock(product) {
    if (!product.stock) return '<p class="muted">Остатки этой выгрузки ещё не приняты.</p>';
    return '<div class="res-stock">' + C.stores.map(function (store) {
      var qty = product.stock[store.id] || 0;
      var unit = product.unit ? ' ' + product.unit : '';
      return '<span class="' + (qty ? 'y' : 'z') + '">' + esc(store.short.replace(', пав.', '')) + ': <b>' + (qty ? qty + unit : 'нет') + '</b></span>';
    }).join('') + '</div>';
  }
  function stockQuery() {
    return (state.onlyStock ? '&inStock=1' : '') + '&outlet=' + encodeURIComponent(state.outletId || '');
  }
  function feedViewQuery() {
    var params = currentRoute.params || {};
    var sort = params.sort || '';
    var brand = params.brand || '';
    return (sort ? '&sort=' + encodeURIComponent(sort) : '') + (brand ? '&brand=' + encodeURIComponent(brand) : '');
  }
  function stockFilterHtml(brands) {
    var params = currentRoute.params || {};
    var sort = params.sort || 'relevance';
    if (['price-asc', 'price-desc', 'stock', 'name', 'relevance'].indexOf(sort) === -1) sort = 'relevance';
    var brand = params.brand || '';
    var brandOptions = '<option value="">Все бренды</option>' + (brands || []).map(function (row) {
      return '<option value="' + esc(row.name) + '"' + (row.name === brand ? ' selected' : '') + '>' + esc(row.name) + ' (' + row.count + ')</option>';
    }).join('');
    return '<form class="card admin-bar" id="stockFilter"><label class="check"><input type="checkbox" id="onlyStock"' + (state.onlyStock ? ' checked' : '') + '> Только в наличии</label><label class="stock-point">Своя точка <select id="stockPoint">' +
      C.stores.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === state.outletId ? ' selected' : '') + '>' + esc(s.short) + '</option>'; }).join('') +
      '</select></label><label class="stock-point">Сортировка <select id="feedSort">' +
      '<option value="relevance"' + (sort === 'relevance' ? ' selected' : '') + '>Как в выдаче</option>' +
      '<option value="price-asc"' + (sort === 'price-asc' ? ' selected' : '') + '>Цена ↑</option>' +
      '<option value="price-desc"' + (sort === 'price-desc' ? ' selected' : '') + '>Цена ↓</option>' +
      '<option value="stock"' + (sort === 'stock' ? ' selected' : '') + '>Наличие</option>' +
      '<option value="name"' + (sort === 'name' ? ' selected' : '') + '>Название</option>' +
      '</select></label><label class="stock-point">Бренд <select id="feedBrand">' + brandOptions + '</select></label></form>';
  }
  function bindStockFilter(root) {
    var box = $('#onlyStock', root);
    var point = $('#stockPoint', root);
    if (box) box.onchange = function () {
      state.onlyStock = box.checked;
      lsSet('carvic_only_stock', box.checked);
      route();
    };
    if (point) point.onchange = function () {
      state.outletId = point.value;
      lsSet(LS_OUTLET, point.value);
      var side = $('#selOutlet');
      if (side) side.value = point.value;
      if (state.buyer && window.CarvicAccount.setOutlet) window.CarvicAccount.setOutlet({ outletId: point.value }).catch(function () {});
      route();
    };
    var sortSel = $('#feedSort', root);
    var brandSel = $('#feedBrand', root);
    function pushFeedView() {
      var here = currentRoute();
      var params = currentRoute.params || {};
      var sort = sortSel ? sortSel.value : (params.sort || '');
      var brand = brandSel ? brandSel.value : (params.brand || '');
      var bits = [];
      if (here.name === 'search') {
        bits.push('q=' + encodeURIComponent(params.q || ''));
        if (brand) bits.push('brand=' + encodeURIComponent(brand));
        if (sort && sort !== 'relevance') bits.push('sort=' + encodeURIComponent(sort));
        if (params.list === '1') bits.push('list=1');
        if (state.onlyStock) bits.push('inStock=1');
        if (state.outletId) bits.push('outlet=' + encodeURIComponent(state.outletId));
        var searchHash = '#/search?' + bits.join('&');
        if (location.hash !== searchHash) location.hash = searchHash;
        return;
      }
      if (here.name !== 'catalog') return;
      if (params.category) bits.push('category=' + encodeURIComponent(params.category));
      else if (params.group) bits.push('group=' + encodeURIComponent(params.group));
      if (sort && sort !== 'relevance') bits.push('sort=' + encodeURIComponent(sort));
      if (brand) bits.push('brand=' + encodeURIComponent(brand));
      if (state.onlyStock) bits.push('inStock=1');
      if (params.offset) bits.push('offset=' + encodeURIComponent(params.offset));
      if (state.outletId) bits.push('outlet=' + encodeURIComponent(state.outletId));
      var catalogHash = '#/catalog' + (bits.length ? '?' + bits.join('&') : '');
      if (location.hash !== catalogHash) location.hash = catalogHash;
    }
    if (sortSel) sortSel.onchange = pushFeedView;
    if (brandSel) brandSel.onchange = pushFeedView;
  }
  function orderLeadWords() {
    var lead = String(state.orderInLead || '').trim();
    return lead ? ('срок ' + lead) : 'срок уточняется';
  }
  function receiptPhrase(stock, outletId, qty) {
    var order = ['irk-sergeeva-45', 'irk-priboy-77', 'irk-priboy-91a'];
    var names = { 'irk-sergeeva-45': '45', 'irk-priboy-77': '77', 'irk-priboy-91a': '91/а' };
    var count = Math.max(1, parseInt(qty, 10) || 1);
    var here = stock && Number(stock[outletId]) || 0;
    var donors = order.filter(function (id) { return id !== outletId && stock && Number(stock[id]) > 0; });
    var elsewhere = donors.reduce(function (sum, id) { return sum + Number(stock[id]); }, 0);
    var pickup = Math.min(Math.max(here, 0), count);
    var transfer = Math.min(Math.max(elsewhere, 0), Math.max(0, count - pickup));
    var rest = count - pickup - transfer;
    if (pickup === count) return 'Сегодня, пав. ' + (names[outletId] || '');
    if (pickup === 0 && transfer === count) return 'Завтра — перемещение с пав. ' + names[donors[0]];
    if (pickup === 0 && transfer === 0) return 'Под заказ — ' + orderLeadWords();
    var parts = [];
    if (pickup > 0) parts.push(pickup + ' шт. — сегодня, пав. ' + (names[outletId] || ''));
    var left = transfer;
    donors.forEach(function (id) {
      if (left <= 0) return;
      var take = Math.min(left, Number(stock[id]));
      if (take > 0) parts.push(take + ' шт. — перемещение с пав. ' + names[id]);
      left -= take;
    });
    if (rest > 0) parts.push(rest + ' шт. — под заказ — ' + orderLeadWords());
    return parts.join(', ');
  }
  function askLinks(article, brand) {
    var base = 'article=' + encodeURIComponent(article || '') + '&brand=' + encodeURIComponent(brand || '') + '&outlet=' + encodeURIComponent(state.outletId || '');
    return '<p class="ask-row"><a href="#/inquiry?' + base + '&kind=contact">Спросить менеджера</a> <a href="#/inquiry?' + base + '&kind=price">Ошибка в цене или остатке</a> <a href="#/inquiry?' + base + '&kind=analog">Подобрать аналог</a></p>';
  }
  function showCat(name) {
    var text = String(name || '');
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  function pickFeedOutlet(product) {
    var outletId = state.outletId || (C.stores[0] && C.stores[0].id) || '';
    if (!product || !product.stock) return outletId;
    C.stores.forEach(function (store) {
      if (Number(product.stock[store.id]) > 0 && store.id === state.outletId) outletId = store.id;
    });
    if (!(Number(product.stock[outletId]) > 0)) {
      C.stores.forEach(function (store) {
        if (!(Number(product.stock[outletId]) > 0) && Number(product.stock[store.id]) > 0) outletId = store.id;
      });
    }
    return outletId;
  }
  function feedQtyOf(btn) {
    var scope = btn.closest('li, article, .sheet-copy') || btn.parentNode;
    var input = scope && scope.querySelector ? scope.querySelector('[data-feed-qty]') : null;
    if (!input) return 1;
    var n = parseInt(input.value, 10);
    return Number.isInteger(n) && n >= 1 ? n : 1;
  }
  function feedOrderAction(product, expired) {
    var outletId = pickFeedOutlet(product);
    if (product.price && product.price.request) {
      return '<a class="btn btn--ghost" href="' + esc(product.ask || ('#/inquiry?article=' + encodeURIComponent(product.article || ''))) + '">Цена по запросу</a>';
    }
    if (!product.orderable && expired) return '<a class="btn btn--ghost" href="#/contacts">уточнить наличие у менеджера</a>';
    return '<button class="btn" type="button" data-feed-add="' + esc(product.id) + '" data-outlet="' + esc(outletId) + '">В корзину</button>';
  }
  function notebookLocal() {
    var raw = lsGet(LS_NOTEBOOK, []);
    return Array.isArray(raw) ? raw.filter(function (id) { return typeof id === 'string' && /^[A-Za-z0-9-]{8,80}$/.test(id); }) : [];
  }
  function saveNotebookLocal(ids) { lsSet(LS_NOTEBOOK, ids); }
  function notebookButton(id) {
    var on = notebookLocal().indexOf(id) !== -1;
    return '<button type="button" class="btn btn--ghost" data-notebook="' + esc(id) + '"' + (on ? ' data-notebook-on="1"' : '') + '>' + (on ? 'В блокноте' : 'В блокнот') + '</button>';
  }
  function mergeGuestNotebook() {
    if (!state.buyer || !window.CarvicAccount || !window.CarvicAccount.notebook) return Promise.resolve();
    return window.CarvicAccount.notebook().then(function (data) {
      var serverIds = data.ids || [];
      var merged = serverIds.slice();
      notebookLocal().forEach(function (id) { if (merged.indexOf(id) === -1) merged.push(id); });
      saveNotebookLocal(merged);
      if (merged.length === serverIds.length) return data;
      return window.CarvicAccount.saveNotebook(merged).then(function (saved) { saveNotebookLocal(saved.ids || merged); });
    }).catch(function () {});
  }
  function bindNotebook(root) {
    $$('[data-notebook]', root).forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-notebook');
        var ids = notebookLocal();
        var has = ids.indexOf(id) !== -1;
        var next = has ? ids.filter(function (item) { return item !== id; }) : ids.concat([id]);
        function paint() {
          saveNotebookLocal(next);
          btn.textContent = has ? 'В блокнот' : 'В блокноте';
          if (has) btn.removeAttribute('data-notebook-on');
          else btn.setAttribute('data-notebook-on', '1');
          toast(has ? 'Убрано из блокнота' : 'Добавлено в блокнот');
        }
        if (state.buyer && window.CarvicAccount && window.CarvicAccount.saveNotebook) {
          window.CarvicAccount.saveNotebook(next).then(paint).catch(function (err) { toast(err.message); });
        } else paint();
      };
    });
  }
  function bindFeedAdd(root) {
    $$('[data-feed-add]', root).forEach(function (btn) {
      btn.onclick = function () {
        var qty = feedQtyOf(btn);
        var check = state.wholesale && window.CarvicAccount
          ? window.CarvicAccount.feedCheck({ id: btn.dataset.feedAdd, outletId: btn.dataset.outlet, qty: qty })
          : fetch('/api/feed/check', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ id: btn.dataset.feedAdd, outletId: btn.dataset.outlet, qty: qty }) }).then(function (r) { return r.json().then(function (data) { if (!r.ok || data.ok === false) { var err = new Error(data.message || 'В заказ не берётся'); throw err; } return data; }); });
        check
          .then(function (data) {
            if (!state.buyer || !window.CarvicAccount) {
              toast((data.supply === 'order_in' ? 'Под заказ. ' : 'Свободно ' + data.free + '. ') + 'Цена ' + (data.price && data.price.label || '') + '. Войдите, чтобы положить в корзину.');
              return null;
            }
            return window.CarvicAccount.cart().then(function (quoted) {
              var items = (quoted.lines || []).map(function (line) { return { sku: line.sku, qty: line.qty, outletId: line.outletId, note: line.note || '' }; });
              var same = items.filter(function (line) { return line.sku === data.id && line.outletId === data.outletId; })[0];
              if (same) same.qty = Math.min(99, same.qty + (data.qty || 1));
              else items.push({ sku: data.id, qty: data.qty || 1, outletId: data.outletId, note: '' });
              return window.CarvicAccount.setCart({ items: items, split: quoted.split, noMerge: quoted.noMerge, mode: 'pickup' });
            }).then(function () { return refreshBuyerSession(); }).then(function () {
              btn.classList.add('added');
              btn.textContent = '✓ В корзине';
              setTimeout(function () { btn.classList.remove('added'); btn.textContent = 'В корзину'; }, 1400);
              toast(data.supply === 'order_in' ? 'Добавлено под заказ. Срок уточняется, если поставщик его не передал.' : 'Добавлено в корзину');
            });
          })
          .catch(function (err) { toast(err.message || 'В заказ не берётся'); });
      };
    });
  }
  function goodsWord(n) {
    var abs = Math.abs(Number(n) || 0);
    var mod100 = abs % 100;
    var mod10 = abs % 10;
    var word = 'товаров';
    if (mod100 < 11 || mod100 > 14) {
      if (mod10 === 1) word = 'товар';
      else if (mod10 >= 2 && mod10 <= 4) word = 'товара';
    }
    return abs + ' ' + word;
  }
  pages.catalog = function () {
      var params = currentRoute.params || {};
      if (params.inStock === '1') state.onlyStock = true;
      var offset = Math.max(0, Number(params.offset) || 0);
      var category = params.category || '';
      var group = params.group || '';
      var catalogQuery = 'limit=48&offset=' + offset + (category ? '&category=' + encodeURIComponent(category) : (group ? '&group=' + encodeURIComponent(group) : '')) + stockQuery() + feedViewQuery();
      var catalogCall = state.wholesale && window.CarvicAccount
      ? window.CarvicAccount.feedCatalog(catalogQuery)
      : fetch('/api/feed/catalog?' + catalogQuery, { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); });
    return catalogCall.then(function (data) {
      var banner = '';
      if (data.freshness === 'stale') banner = '<div class="warn-box" id="feedFresh">Наличие могло измениться.</div>';
      if (data.freshness === 'expired') banner = '<div class="warn-box" id="feedFresh">Срез старше суток. Кнопка заказа заменена на уточнение у менеджера.</div>';
      var cards = (data.products || []).map(function (product) {
        var action = feedOrderAction(product, data.freshness === 'expired');
        var pickup = (product.pickup || []).map(function (row) { return '<div>' + esc(row.label) + '</div>'; }).join('');
        var moved = (product.transfers || []).map(function (row) { return '<div>' + esc(row.label) + '</div>'; }).join('');
        var receipt = '<p class="receipt">' + esc(product.receipt || receiptPhrase(product.stock, state.outletId)) + '</p>';
        var catLink = product.group ? '<a class="feed-group" href="#/catalog?category=' + encodeURIComponent(product.group) + '">' + esc(showCat(product.group)) + '</a>' : '';
        var anyHere = product.stock && C.stores.some(function (store) { return Number(product.stock[store.id]) > 0; });
        var badge = product.stock ? '<span class="status-badge ' + (anyHere ? 'status-badge--ok' : 'status-badge--wait') + '">' + (anyHere ? 'В наличии' : 'Нет в наличии') + '</span>' : '';
        var article = product.article ? '<span class="sku-tag">' + esc(product.article) + '</span>' : '<span>без артикула</span>';
        return '<article class="feed-card" data-feed-id="' + esc(product.id) + '"><div class="feed-top"><div><h3><a href="#/feed/' + encodeURIComponent(product.id) + '">' + esc(product.name) + '</a></h3><p class="feed-meta">' + article + '<span>' + esc(product.brand || 'бренд не указан') + '</span>' + catLink + '</p>' + badge + '</div><div class="price">' + esc(product.price && product.price.label || 'цена по запросу') + '</div></div>' + receipt + feedStock(product) + '<div class="pickup-notes">' + pickup + moved + '</div>' + askLinks(product.article, product.brand) + '<div class="feed-buy">' + action + notebookButton(product.id) + '</div></article>';
      }).join('');
      var allCats = data.categories || [];
      var topCats = allCats.slice(0, 12);
      var groups = (data.categoryGroups && data.categoryGroups.length ? data.categoryGroups : [{ parent: '', items: allCats }]);
      var active = {};
      if (category) active[category] = 1;
      else if (group) {
        groups.forEach(function (block) {
          if (block.parent === group) (block.items || []).forEach(function (name) { active[name] = 1; });
        });
      }
      function catChip(name) {
        var on = active[name] ? ' on' : '';
        return '<a class="feed-cat' + on + '" href="#/catalog?category=' + encodeURIComponent(name) + '">' + esc(showCat(name)) + '</a>';
      }
      var grouped = groups.map(function (block) {
        var title = block.parent ? '<a class="feed-cat-type' + (group === block.parent ? ' on' : '') + '" href="#/catalog?group=' + encodeURIComponent(block.parent) + '">' + esc(showCat(block.parent)) + '</a>' : '';
        var items = (block.items || []).map(function (name) {
          return '<span class="feed-cat-item" data-cat-name="' + esc(name.toLowerCase()) + '">' + catChip(name) + '</span>';
        }).join('');
        return '<section class="feed-cat-group" data-cat-group>' + title + '<div class="feed-cat-items">' + items + '</div></section>';
      }).join('');
      var cats = allCats.length ? '<div class="feed-cats-wrap" id="feedCategories">' +
        '<details class="feed-cats__more"><summary>Все категории</summary><div class="feed-cats__panel">' +
        '<input id="feedCatFilter" type="search" placeholder="Фильтр по названию" autocomplete="off">' +
        grouped + '</div></details>' +
        '<div class="feed-cats">' +
        topCats.map(catChip).join('') + '</div></div>' : '';
      var pickedName = category || group;
      var picked = pickedName ? '<p class="feed-picked" id="feedPicked"><b>' + esc(showCat(pickedName)) + '</b> — ' + goodsWord(data.total) + ' <a class="feed-clear" href="#/catalog">× Все товары</a></p>' : '';
      var pager = '';
      if (data.total > (data.limit || 48)) {
        var filterQs = (category ? '&category=' + encodeURIComponent(category) : (group ? '&group=' + encodeURIComponent(group) : '')) +
          (params.sort && params.sort !== 'relevance' ? '&sort=' + encodeURIComponent(params.sort) : '') +
          (params.brand ? '&brand=' + encodeURIComponent(params.brand) : '') +
          (state.onlyStock ? '&inStock=1' : '');
        var prev = offset > 0 ? '<a class="btn btn--ghost" href="#/catalog?offset=' + Math.max(0, offset - (data.limit || 48)) + filterQs + '">Назад</a>' : '';
        var next = offset + (data.products || []).length < data.total ? '<a class="btn btn--ghost" href="#/catalog?offset=' + (offset + (data.limit || 48)) + filterQs + '">Дальше</a>' : '';
        pager = '<p class="pager">' + prev + ' ' + next + ' <span class="muted">' + (offset + 1) + '–' + (offset + (data.products || []).length) + ' из ' + data.total + '</span></p>';
      }
      return '<div class="page" id="feedCatalog"><div class="crumbs"><a href="#/">Главная</a> / <span>Каталог</span></div><h1>Каталог <em>запчастей</em></h1>' + stockFilterHtml(data.brands) +
        '<p class="muted" id="feedSlice">' + esc(data.stockStamp || data.snapshotLabel || 'Срез ещё не принят') + '. Это файл выгрузки, не живой обмен с 1С.</p>' +
        (cats || '') +
        picked +
        (data.staleWarning ? '<div class="warn-box" id="feedStale">' + esc(data.staleWarning) + '</div>' : '') + banner +
        (cards || '<div class="card empty">Принятого среза нет.</div>') + pager +
        (state.demoUi ? '<h2>Учебные категории</h2><div class="grid grid-5">' + CATS.map(function (c) {
          var n = PARTS.filter(function (p) { return p.cat === c.key && (!state.make || p.compat.indexOf(state.make) >= 0); }).length;
          return '<a class="cat-tile" href="#/catalog/' + c.key + '">' + icon(c.icon) + '<b>' + esc(c.name) + '</b><span>' + n + ' поз.</span></a>';
        }).join('') + '</div>' : '') + '</div>';
    }).catch(function () {
      return '<div class="page"><h1>Каталог</h1><div class="card">Срез каталога не прочитан.</div></div>';
    });
  };
  pages.catalog.after = function (root) {
    bindStockFilter(root);
    var filter = $('#feedCatFilter', root);
    if (filter) filter.oninput = function () {
      var q = filter.value.trim().toLowerCase();
      $$('[data-cat-group]', root).forEach(function (group) {
        var shown = 0;
        $$('.feed-cat-item', group).forEach(function (item) {
          var hit = !q || String(item.getAttribute('data-cat-name') || '').indexOf(q) !== -1;
          item.hidden = !hit;
          if (hit) shown += 1;
        });
        group.hidden = shown === 0;
      });
    };
    bindFeedAdd(root);
    bindNotebook(root);
  };

  pages.catalogCat = function (key) {
    if (state.cats.length !== 1 || state.cats[0] !== key) { state.cats = [key]; syncChecks(); }
    var list = filtered();
    return ensureData(list.map(function (p) { return p.sku; })).then(function () {
      return '<div class="page"><div class="crumbs"><a href="#/">Главная</a> / <a href="#/catalog">Каталог</a> / <span>' + esc(catName(key)) + '</span></div>' +
        '<h1>' + esc(catName(key)) + '</h1><div class="card">' + chipsHTML() + resultsBlock(list, 10, 'Товары') + '</div></div>';
    });
  };
  pages.catalogCat.after = function (root) { bindResults(root); bindChips(root); };

  /* --- VIN: иллюстративный каталог, не лицензированный декодер --- */
  function demoVinLinks(ids) {
    return (ids || Object.keys(window.DemoCatalog.known)).map(function (id) {
      var v = window.DemoCatalog.known[id];
      var label = v ? id + ' · ' + v.make + ' ' + v.model + (v.catalog ? ' · есть схемы' : '') : id;
      return '<a href="#/vin/' + id + '">' + esc(label) + '</a>';
    }).join('<br>');
  }
  function ownPlaces(sku) {
    var qty = stockCache[sku] || {};
    var rows = window.CarvicSearchRank.outletsInStock(C.stores, qty);
    if (!rows.length) return '<p class="empty">На точках CARVIC этой позиции нет.</p>';
    return '<ul class="res-list"><li class="res-item" data-own-stock="in"><div class="thumb">' + icon(bySku(sku).icon) + '</div>' +
      '<div><div class="res-name">' + esc(bySku(sku).name) + '</div><div class="res-sub">' + esc(bySku(sku).brand) + ' <span>· арт. ' + esc(bySku(sku).article) + '</span></div></div>' +
      priceHTML(sku) + '<button class="btn" data-add="' + esc(sku) + '">В корзину</button>' +
      '<div class="res-stock">' + rows.map(function (o) { return '<span class="y">' + esc(o.name) + ': <b>' + o.qty + ' шт.</b></span>'; }).join('') + '</div></li></ul>';
  }
  function partnerFixtureHtml(lines) {
    if (!lines || !lines.length) return '<p class="muted">В фикстуре каталога для этой позиции нет строк под заказ.</p>';
    return window.RosskoSearch.renderHtml({
      ok: true,
      transport: 'mock',
      mockNotice: 'Фикстура каталога. Живой поиск поставщика не вызывался. Номер DEMO не уходит в API. Это не подтверждение применимости по VIN.',
      hideEmptyCrosses: true,
      currency: { code: null, confirmed: false, returnedBySupplier: false, note: 'Код валюты в фикстуре не задан. Сумму нельзя считать рублём.' },
      needsBrandSelection: false,
      offers: lines.map(function (row) { return { brand: row.brand, partnumber: row.partnumber, name: row.name, lines: row.lines, crosses: [] }; })
    });
  }
  pages.vin = function (arg) {
    if (!state.demoUi) {
      return Promise.resolve('<div class="page" id="vinOff"><h1>Подбор по номеру автомобиля не опубликован</h1><p><a id="askManager" href="#/inquiry">Не нашли деталь? Оставьте заявку — менеджер подберёт</a></p></div>');
    }
    var cat = window.DemoCatalog;
    var view = cat.resolve(arg || '');
    if (view.kind === 'invalid') {
      return Promise.resolve('<div class="page"><h1>Поиск по VIN</h1><div class="card"><p>VIN должен содержать 17 символов (латинские буквы без I, O, Q и цифры).</p><p>Демо-номера:</p><p>' + demoVinLinks() + '</p></div></div>');
    }
    if (view.kind === 'unknown') {
      return Promise.resolve('<div class="page"><h1>VIN не входит в демо-каталог</h1><div class="card"><p>Номер <b class="mono">' + esc(view.vin) + '</b> не сопоставлен с демо-автомобилем. Модель для неизвестного VIN не подбирается.</p><p>Доступные демо-VIN:</p><p>' + demoVinLinks(view.demos) + '</p></div></div>');
    }
    var vehicleBar = '<section class="card vin-card"><div class="icon-car">' + icon('car') + '</div><div><div class="muted" style="color:#9a9ca3;font-size:11px">VIN · демо</div><div class="vin-code">' + esc(view.vin) + '</div></div>' +
      '<dl><div><dt>Марка</dt><dd>' + esc(view.vehicle.make) + '</dd></div><div><dt>Модель</dt><dd>' + esc(view.vehicle.model) + '</dd></div><div><dt>Год</dt><dd>' + esc(view.vehicle.year) + '</dd></div><div><dt>Двигатель</dt><dd>' + esc(view.vehicle.engine) + '</dd></div></dl></section>' +
      '<p class="demo-note" data-vin-demo-note><span class="demo-badge">демо</span> Запись из демо-таблицы CARVIC, не лицензированный VIN-каталог. Схемы ниже — иллюстрации, не заводские чертежи. Применимость по VIN не проверялась.</p>';
    if (view.kind === 'identity') {
      return Promise.resolve('<div class="page" style="max-width:none">' + vehicleBar + '<div class="card"><p>Для этого демо-VIN схемы не подготовлены. Иллюстративный каталог открывается на <a href="#/vin/JTNB11HK103456789">JTNB11HK103456789 · Toyota Camry 2019</a>.</p></div></div>');
    }
    if (view.kind === 'missing') {
      return Promise.resolve('<div class="page" style="max-width:none">' + vehicleBar + '<div class="card"><p>Такого шага в демо-каталоге нет.</p><p><a href="#/vin/' + esc(view.vin) + '">Вернуться к автомобилю</a></p></div></div>');
    }
    var sku = view.part && view.part.sku;
    return ensureData(sku ? [sku] : []).then(function () {
      var crumbs = '<div class="crumbs"><a href="#/">Главная</a> / ' + view.crumbs.map(function (c, i) {
        return i === view.crumbs.length - 1 ? '<span>' + esc(c.label) + '</span>' : '<a href="' + c.href + '">' + esc(c.label) + '</a>';
      }).join(' / ') + '</div>';
      var tree = '<nav class="oem-tree" aria-label="Узлы">' + cat.groups.map(function (g) {
        var gOn = view.group && view.group.id === g.id;
        return '<div class="oem-branch"><a class="oem-group' + (gOn && !view.subgroup ? ' on' : '') + '" href="' + cat.href(view.vin, [g.id]) + '">' + esc(g.name) + '</a><div class="oem-sub">' +
          g.children.map(function (child) {
            var on = view.subgroup && view.subgroup.id === child.id ? ' on' : '';
            return '<a class="' + on + '" href="' + cat.href(view.vin, [g.id, child.id]) + '">' + esc(child.name) + '</a>';
          }).join('') + '</div></div>';
      }).join('') + '</nav>';
      var right = '';
      if (!view.group) {
        right = '<div class="card"><p>Выберите узел слева, например «Двигатель». Справа появятся схемы, в которые можно зайти.</p></div>';
      } else if (!view.diagram) {
        var title = view.subgroup ? view.subgroup.name : view.group.name;
        var gap = (view.subgroup && view.subgroup.unavailable) || (!view.gallery.length ? 'Схема для узла «' + title + '» в демо-каталоге не подготовлена. Другой узел вместо неё не открывается, применимость не подставляется.' : '');
        right = gap
          ? '<section class="card" id="diagramMissing"><h2 class="card__title">' + esc(title) + '</h2><p>' + esc(gap) + '</p></section>'
          : '<section class="card" id="diagramGallery"><h2 class="card__title">' + esc(title) + '</h2><div class="diagram-gallery">' +
            view.gallery.map(function (d) {
              return '<a class="diagram-card" href="' + cat.href(view.vin, [d.group, d.subgroup, d.id]) + '">' + cat.thumbSvg(d.id) + '<b>' + esc(d.title) + '</b><span>' + esc(d.summary) + '</span></a>';
            }).join('') + '</div></section>';
      } else {
        var base = cat.href(view.vin, [view.group.id, view.subgroup.id, view.diagram.id]);
        var back = view.part ? '<p><a href="' + base + '">Назад к схеме</a></p>' : '<p><a href="' + cat.href(view.vin, [view.group.id, view.subgroup.id]) + '">Назад к списку схем</a></p>';
        right = '<section class="card" id="assembly"><div class="diagram-head"><h2 class="card__title">' + esc(view.diagram.title) + '</h2>' + back + '</div>' +
          '<p class="demo-note"><span class="demo-badge">иллюстрация</span> ' + esc(view.diagram.summary) + '</p>' +
          '<div class="diagram-stage">' + cat.diagramSvg(view.diagram.id, view.vin, base, view.part && view.part.pos) +
          '<table class="tbl parts-table"><thead><tr><th>Поз.</th><th>Деталь</th><th>Ориг. номер</th></tr></thead><tbody>' +
          view.diagram.parts.map(function (item) {
            var on = view.part && view.part.pos === item.pos;
            return '<tr' + (on ? ' class="on"' : '') + '><td><a href="' + base + '/' + item.pos + '">' + item.pos + '</a></td><td><a href="' + base + '/' + item.pos + '">' + esc(item.name) + '</a></td><td class="mono">' + esc(item.oem) + '</td></tr>';
          }).join('') + '</tbody></table></div></section>';
        if (view.part) {
          right += '<section class="card" id="partDetail" tabindex="-1"><h2 class="card__title">Поз. ' + view.part.pos + ' · ' + esc(view.part.name) + '</h2>' +
            '<p>Оригинальный номер: <b class="mono">' + esc(view.part.oem) + '</b></p>' +
            '<p class="demo-note"><span class="demo-badge">демо</span> Номер иллюстративный и не для заказа. Он не отправляется поставщику и не означает применимость по VIN.</p>' +
            '<h3>В наличии CARVIC</h3><p class="demo-note" data-carvic-demo-note><span class="demo-badge">демо</span> Остатки и цена — демонстрация слоя 1С, не фактический склад.</p>' +
            (sku ? ownPlaces(sku) : '<p class="empty">На точках CARVIC этой иллюстративной позиции нет.</p>') +
            partnerFixtureHtml(view.part.partner) +
            '<p class="muted">Отдельный поиск артикула, без привязки к этому VIN: <a href="#/search?q=BPR6E">BPR6E</a>.</p></section>';
        }
      }
      return '<div class="page" style="max-width:none">' + crumbs + vehicleBar + '<div class="vin-layout">' + tree + '<div class="vin-main">' + right + '</div></div></div>';
    });
  };
  pages.vin.after = function (root) {
    var detail = $('#partDetail', root);
    if (detail) detail.focus();
  };

  function wholesaleSearchFailure(err, session) {
    var expired = Boolean(err && err.status === 401);
    return {
      failed: true,
      expired: expired,
      staff: Boolean(session && session.act),
      notice: expired ? 'Сессия истекла, войдите снова' : 'Не удалось выполнить поиск, попробуйте ещё раз',
      products: []
    };
  }
  function searchFailureLink(failure) {
    if (!failure || !failure.expired) return '';
    return '<a href="' + (failure.staff ? '#/admin' : '#/account') + '" id="searchLogin">Войти</a>';
  }
  function searchHasOem(feed, remembered) {
    if (feed && feed.hasOem != null) return Boolean(feed.hasOem);
    return Boolean(remembered);
  }

  /* --- Поиск по артикулу / OEM --- */
  function norm(s) { return String(s).toUpperCase().replace(/[\s\-._]/g, ''); }
  function searchArg(arg) {
    if (arg && typeof arg === 'object') return { q: arg.q || '', brand: arg.brand || '', sort: arg.sort || '', list: arg.list || '' };
    return { q: arg || '', brand: '', sort: '', list: '' };
  }
  function ownRow(row, inStock) {
    var part = bySku(row.sku);
    var places = inStock ? row.outlets.map(function (o) {
      return '<span class="y">' + esc(o.name) + ': <b>' + o.qty + ' шт.</b></span>';
    }).join('') : '<span class="z">Нет на точках CARVIC</span>';
    var receipt = receiptPhrase(stockCache[part.sku] || {}, state.outletId);
    return '<li class="res-item" data-own-stock="' + (inStock ? 'in' : 'out') + '"><div class="thumb">' + icon(part.icon) + '</div>' +
      '<div><div class="res-name"><a href="#/part/' + encodeURIComponent(part.sku) + '">' + esc(part.name) + '</a></div>' +
      '<div class="res-sub">' + esc(part.brand) + ' <span>· арт. ' + esc(part.article) + '</span></div>' +
      '<div class="receipt">' + esc(receipt) + '</div>' + askLinks(part.article, part.brand) + '</div>' +
      priceHTML(part.sku) +
      (inStock ? '<button class="btn" data-add="' + esc(part.sku) + '">В корзину</button>' : '<span></span>') +
      '<div class="res-stock">' + places + '</div></li>';
  }
  pages.search = function (arg) {
    var parsed = searchArg(arg);
    if ((currentRoute.params || {}).inStock === '1') state.onlyStock = true;
    var q = String(parsed.q || '').trim();
    var brand = String(parsed.brand || '').trim();
    var nq = norm(q);
    var list = nq.length >= 2 ? PARTS.filter(function (p) {
      return norm(p.article).indexOf(nq) >= 0 || norm(p.oem).indexOf(nq) >= 0 || p.name.toUpperCase().indexOf(q.toUpperCase()) >= 0 || norm(p.brand).indexOf(nq) >= 0;
    }) : [];
    var searchQuery = 'q=' + encodeURIComponent(q) + '&gate=1&brand=' + encodeURIComponent(brand) + stockQuery() + (parsed.sort ? '&sort=' + encodeURIComponent(parsed.sort) : '');
    var wholesaleView = Boolean(state.wholesale) || Boolean(state.act && state.act.segment === 'wholesale');
    var searchCall = wholesaleView && window.CarvicAccount
      ? window.CarvicAccount.feedSearch(searchQuery).catch(function (err) {
        var failure = wholesaleSearchFailure(err, state);
        if (failure.expired) {
          state.buyer = null;
          state.wholesale = null;
          state.act = null;
          state.serverQty = null;
          renderBuyer();
          renderCartCount();
        }
        return failure;
      })
      : fetch('/api/feed/search?' + searchQuery, { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).catch(function () { return { products: [] }; });
    return searchCall.then(function (feed) {
    return ensureData(list.map(function (p) { return p.sku; })).then(function () {
      if (q && !feed.failed && !feed.needsBrand && parsed.list !== '1' && (feed.products || []).length === 1 && feed.products[0].rank === 100) {
        location.replace('#/feed/' + encodeURIComponent(feed.products[0].id));
        return '<div class="page"><p class="muted">Открываем карточку…</p></div>';
      }
      var ex = PARTS.filter(function (p) { return !p.fixture; })[3];
      var ranked = window.CarvicSearchRank.rankOwn(list, stockCache, C.stores);
      var brandPick = feed.needsBrand ? '<div id="brandPick"><p>Сначала выберите производителя.</p>' + (feed.choices || []).map(function (choice) {
        return '<a class="btn btn--ghost" href="#/search?q=' + encodeURIComponent(q) + '&brand=' + encodeURIComponent(choice.brand) + '">' + esc(choice.article) + ' · ' + esc(choice.brand) + ' · ' + esc(choice.name) + '</a> ';
      }).join('') + '</div>' : '';
      var feedRows = feed.needsBrand ? '' : (feed.products || []).map(function (product) {
        var notes = esc(product.receipt || receiptPhrase(product.stock, state.outletId));
        var expired = Boolean(feed.staleWarning);
        var buy = (product.price && product.price.request) || (!product.orderable && expired)
          ? feedOrderAction(product, expired)
          : '<input class="feed-qty" data-feed-qty type="number" min="1" step="1" value="1" inputmode="numeric" aria-label="Количество"><button class="btn" type="button" data-feed-add="' + esc(product.id) + '" data-outlet="' + esc(pickFeedOutlet(product)) + '">В корзину</button>' + notebookButton(product.id);
        return '<li class="feed-hit"><a href="#/feed/' + encodeURIComponent(product.id) + '"><b>' + esc(product.article || '') + '</b> ' + esc(product.name) + '</a> · ' + esc(product.price && product.price.label || 'цена по запросу') + ' · ' + notes + askLinks(product.article, product.brand) + '<div class="feed-buy">' + buy + '</div></li>';
      }).join('');
      var feedHtml = feed.failed
        ? '<section class="card" id="feedSearch"><div class="warn-box" id="searchNotice">' + esc(feed.notice) + (feed.expired ? ' ' + searchFailureLink(feed) : '') + '</div></section>'
        : stockFilterHtml(feed.brands) + '<section class="card" id="feedSearch"><h2 class="card__title">На витрине</h2><p class="muted">' + esc(feed.stockStamp || '') + '</p>' + (feed.staleWarning ? '<div class="warn-box">' + esc(feed.staleWarning) + '</div>' : '') + brandPick + (feedRows ? '<ul class="res-list">' + feedRows + '</ul>' : (q && !feed.needsBrand ? '<div class="card" id="feedEmpty"><h2>Позиции нет в наличии на витрине</h2><p><a class="btn" href="#/inquiry?article=' + encodeURIComponent(q) + '&kind=analog&outlet=' + encodeURIComponent(state.outletId || '') + '">Подобрать аналог — спросить менеджера</a></p><p><a class="btn btn--ghost" href="#/inquiry?article=' + encodeURIComponent(q) + '&kind=selection&outlet=' + encodeURIComponent(state.outletId || '') + '">Оставить заявку на подбор</a></p></div>' : '')) + '</section>';
      var demoNote = state.demoUi ? '<p class="demo-note" data-carvic-demo-note><span class="demo-badge">демо</span> Наличие и цены CARVIC на этой странице — демонстрация слоя 1С, не фактический склад магазина.</p>' : '';
      var inHtml = state.demoUi && ranked.inStock.length ? ('<section class="card" id="ownStock"><h2 class="card__title">В наличии <small>' + ranked.inStock.length + '</small></h2>' +
        (ranked.inStock.length ? '<ul class="res-list">' + ranked.inStock.map(function (row) { return ownRow(row, true); }).join('') + '</ul>' : '<div class="empty">На точках CARVIC этого артикула нет.</div>') +
        '</section>') : '';
      var partner = state.demoUi ? '<section class="card partner-panel" id="partnerPanel" data-partner-state="loading"><h2 class="card__title">Под заказ</h2><p>Загрузка предложений…</p></section>' : '';
      var outHtml = state.demoUi && ranked.outOfStock.length ? '<section class="card" id="ownOut"><h2 class="card__title">Нет на точках CARVIC <small>' + ranked.outOfStock.length + '</small></h2><ul class="res-list">' + ranked.outOfStock.map(function (row) { return ownRow(row, false); }).join('') + '</ul></section>' : '';
      var idle = '<div class="card"><p>Введите артикул. Сначала показываются позиции CARVIC, которые есть на точках, с названием точки. Ниже — предложения под заказ: бренд, срок и цена. Несколько брендов поставщика не смешиваются.</p><p class="muted">Примеры: <a href="#/search?q=333114">333114</a> (своё наличие и под заказ), <a href="#/search?q=BPR6E">BPR6E</a> (несколько брендов), <a href="#/search?q=' + encodeURIComponent(ex.article) + '">' + esc(ex.article) + '</a>.</p></div>';
      var body = feed.failed ? feedHtml : feedHtml + (q ? window.CarvicSearchRank.composeSearchHtml({ demoNote: demoNote, inStock: inHtml, partner: partner, outOfStock: outHtml }) : idle + partner);
      if (!feed.failed && feed.hasOem != null) state.hasOem = Boolean(feed.hasOem);
      var oem = feed.failed ? searchHasOem(feed, state.hasOem) : Boolean(feed.hasOem);
      var searchLabel = feed.hasOem ? 'Артикул или OEM' : 'Артикул или название';
      var titleEm = feed.hasOem ? 'артикулу / OEM' : 'артикулу';
      if (feed.failed) {
        searchLabel = oem ? 'Артикул или OEM' : 'Артикул или название';
        titleEm = oem ? 'артикулу / OEM' : 'артикулу';
      }
      return '<div class="page"><div class="crumbs"><a href="#/">Главная</a> / <span>Поиск по артикулу</span></div><h1>Поиск по <em>' + titleEm + '</em></h1>' +
        '<form class="card admin-bar rossko-form" id="artForm" style="margin-bottom:14px">' +
        '<div class="field" style="flex:1;min-width:220px"><label for="artQ">' + searchLabel + '</label><input id="artQ" value="' + esc(q) + '" placeholder="Например, 333114" autocomplete="off"></div>' +
        '<div class="field" style="flex:1;min-width:160px"><label for="artBrand">Бренд, если известен</label><input id="artBrand" value="' + esc(brand) + '" placeholder="KYB — необязательно" autocomplete="off"></div>' +
        '<button class="btn btn--lg" style="align-self:flex-end">Найти</button></form>' + body + '</div>';
    });
    });
  };
  pages.search.after = function (root, arg) {
    bindStockFilter(root);
    var parsed = searchArg(arg);
    var f = $('#artForm', root);
    if (f) f.onsubmit = function (e) {
      e.preventDefault();
      var qv = $('#artQ', root).value.trim();
      var bv = $('#artBrand', root).value.trim();
      var hash = '#/search?q=' + encodeURIComponent(qv);
      if (bv) hash += '&brand=' + encodeURIComponent(bv);
      var sortNow = $('#feedSort', root);
      if (sortNow && sortNow.value && sortNow.value !== 'relevance') hash += '&sort=' + encodeURIComponent(sortNow.value);
      if (state.onlyStock) hash += '&inStock=1';
      if (location.hash === hash) {
        if (window.RosskoSearch) window.RosskoSearch.mount($('#partnerPanel', root), { text: qv, brand: bv });
        return;
      }
      location.hash = hash;
    };
    var panel = $('#partnerPanel', root);
    if (panel && window.RosskoSearch) window.RosskoSearch.mount(panel, { text: parsed.q, brand: parsed.brand });
    bindFeedAdd(root);
    bindNotebook(root);
  };

  function elsewhereQty(stockMap, outletId) {
    var sum = 0;
    C.stores.forEach(function (o) { if (o.id !== outletId) sum += stockMap[o.id] || 0; });
    return sum;
  }
  function outletSupplyWord(stockMap, outletId) {
    return elsewhereQty(stockMap, outletId) > 0 ? 'перемещение' : 'под заказ';
  }
  function outletShortWarn(stock, qty) {
    return stock > 0 && stock < qty;
  }
  function guestSupplyNote(stockMap, outletId, qty) {
    var here = stockMap[outletId] || 0;
    if (qty <= here) return '';
    var other = elsewhereQty(stockMap, outletId);
    var pickup = Math.min(here, qty);
    var transfer = Math.min(other, Math.max(0, qty - pickup));
    var order = qty - pickup - transfer;
    var parts = [];
    if (pickup) parts.push(pickup + ' шт. — самовывоз');
    if (transfer) parts.push(transfer + ' шт. — перемещение');
    if (order && !pickup && !transfer) parts.push('Под заказ');
    else if (order) parts.push(order + ' шт. — под заказ');
    var warn = outletShortWarn(here, qty) ? '<span class="stock-warn">На точке меньше, чем в заказе</span> ' : '';
    return warn + '<span class="muted">' + parts.join(', ') + '</span>';
  }

  /* --- Карточка товара --- */
  pages.part = function (sku) {
    sku = decodeURIComponent(sku); var p = bySku(sku);
    if (!p) return Promise.resolve('<div class="page"><h1>Товар не найден</h1><a href="#/catalog">В каталог</a></div>');
    return Promise.all([ensureData([sku]), API.explainPrice(sku, cpId())]).then(function (r) {
      var ex = r[1], s = stockCache[sku];
      return '<div class="page sheet"><div class="crumbs"><a href="#/">Главная</a> / <a href="#/catalog/' + p.cat + '">' + esc(catName(p.cat)) + '</a> / <span>' + esc(p.name) + '</span></div><div class="sheet-ph" aria-hidden="true"></div>' +
        '<div class="checkout-grid"><section class="card" style="display:flex;gap:18px;flex-wrap:wrap"><div class="thumb" style="width:160px;height:150px;background:#f6f7f9">' + icon(p.icon).replace('<svg', '<svg style="width:120px;height:120px"') + '</div>' +
        '<div style="flex:1;min-width:220px"><h1 class="part-title">' + esc(p.name) + '</h1>' +
        '<table class="req"><tr><td>Производитель</td><td>' + esc(p.brand) + '</td></tr><tr><td>Артикул</td><td class="sku-tag">' + esc(p.article) + '</td></tr><tr><td>OEM</td><td class="sku-tag">' + esc(p.oem) + '</td></tr><tr><td>Группа</td><td>' + esc(catName(p.cat)) + '</td></tr><tr><td>Применимость</td><td>' + esc(p.compat.join(', ')) + '</td></tr></table>' +
        '<p class="demo-note"><span class="demo-badge">демо</span> Характеристики и применимость — демонстрационные.</p></div></section>' +
        '<section class="card"><div class="price" style="text-align:left;font-size:28px">' + fmt(ex.price) + '</div>' +
        '<div class="muted" style="font-size:12px;margin:2px 0 10px">' + (state.cp ? 'Цена для: ' + esc(state.cp.name) : 'Розничная цена. <a href="#/login">Войдите</a> как контрагент, чтобы увидеть свои цены.') + '</div>' +
        '<h3 style="margin:10px 0 6px;font-size:14px">Наличие по торговым точкам</h3>' +
        '<p class="receipt" id="partReceipt">' + esc(receiptPhrase(s, state.outletId, 1)) + '</p>' +
        C.stores.map(function (o) { var q = s[o.id] || 0; var word = q ? (q + ' шт. в наличии') : outletSupplyWord(s, o.id); return '<label class="summary-line" style="cursor:pointer"><span><input type="radio" name="pOutlet" value="' + o.id + '"' + (o.id === pickOutlet(sku) ? ' checked' : '') + '> ' + esc(o.title) + ', ' + esc(o.address) + '</span><b class="' + (q ? 'stock-ok' : 'stock-wait') + '">' + esc(word) + '</b></label>'; }).join('') +
        askLinks(p.article, p.brand) +
        '<div style="display:flex;gap:10px;align-items:center;margin-top:14px"><div class="qty"><button type="button" id="pMinus">−</button><input id="pQty" value="1" aria-label="Количество"><button type="button" id="pPlus">+</button></div><button class="btn btn--lg" id="pAdd" style="flex:1">В корзину</button></div>' +
        '<section id="analogs" class="partner-panel"><h2 class="card__title">Аналоги</h2><p class="muted" id="analogNote">Загрузка предложений под заказ…</p></section>' +
        '<details style="margin-top:14px"><summary style="cursor:pointer;font-size:12.5px;color:var(--c-muted)">Как рассчитана цена</summary><ol style="font-size:12.5px;padding-left:18px">' + ex.steps.map(function (st) { return '<li>' + esc(st) + '</li>'; }).join('') + '</ol></details></section></div></div>';
    });
  };
  pages.part.after = function (root, sku) {
    sku = decodeURIComponent(sku); var q = $('#pQty', root); if (!q) return;
    function paintPartReceipt() {
      var line = $('#partReceipt', root);
      if (line) line.textContent = receiptPhrase(stockCache[sku] || {}, state.outletId, Math.max(1, parseInt(q.value, 10) || 1));
    }
    $('#pMinus', root).onclick = function () { q.value = Math.max(1, (+q.value || 1) - 1); paintPartReceipt(); };
    $('#pPlus', root).onclick = function () { q.value = (+q.value || 0) + 1; paintPartReceipt(); };
    q.oninput = paintPartReceipt;
    $('#pAdd', root).onclick = function () { var o = $('input[name=pOutlet]:checked', root); addToCart(sku, o ? o.value : null, Math.max(1, parseInt(q.value, 10) || 1)); };
    var box = $('#analogs', root);
    var part = bySku(sku);
    if (!box || !part) return;
    if (/^DEMO([-\s_]|$)/i.test(part.article)) {
      $('#analogNote', box).textContent = 'Для иллюстративного номера поставщик не запрашивается. Это не лицензированный каталог аналогов.';
      return;
    }
    fetch('/api/rossko/search?text=' + encodeURIComponent(part.article), { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (data) {
      var cards = [];
      (data.offers || []).forEach(function (offer) {
        (offer.crosses || []).forEach(function (cross) {
          var line = (cross.lines || [])[0] || {};
          cards.push({ brand: cross.brand, article: cross.partnumber, name: cross.name, days: line.deliveryDays, price: line.price });
        });
      });
      if (!cards.length) { $('#analogNote', box).textContent = 'По этому артикулу сервер не вернул аналогов. Склады поставщика не показываются.'; return; }
      var brands = cards.map(function (c) { return c.brand; }).filter(function (b, i, arr) { return arr.indexOf(b) === i; });
      box.innerHTML = '<h2 class="card__title">Аналоги</h2><p class="muted">Демо-предложения под заказ из фикстуры поиска. Это не живой каталог и не склады поставщика.</p><label class="sel">Бренд <select id="analogBrand"><option value="">Все бренды</option>' + brands.map(function (b) { return '<option>' + esc(b) + '</option>'; }).join('') + '</select></label><div id="analogCards"></div>';
      function paint() {
        var brand = $('#analogBrand', box).value;
        $('#analogCards', box).innerHTML = cards.filter(function (c) { return !brand || c.brand === brand; }).map(function (c) {
          return '<article class="line-card" data-analog-brand="' + esc(c.brand) + '"><b>' + esc(c.brand) + ' ' + esc(c.article) + '</b><div>' + esc(c.name || '') + '</div><div>' + (c.days == null ? 'срок не указан' : esc(String(c.days)) + ' дн.') + '</div><div>' + esc(c.price == null ? '—' : String(c.price)) + '</div></article>';
        }).join('');
      }
      $('#analogBrand', box).onchange = paint;
      paint();
    }).catch(function () { $('#analogNote', box).textContent = 'Нет связи с сервером поиска. Аналоги не загружены, заказ из этого блока не создаётся.'; });
  };

  /* --- Корзина --- */
  function importBox() {
    return '<section class="card" id="cartImport"><h2 class="card__title">Загрузка из файла</h2><p class="muted">CSV с разделителем «;», XLSX или двоичный XLS без макросов: бренд, артикул, количество, комментарий. Книга с макросами отклоняется. Повтор того же нажатия не дублирует строки, новая загрузка файла — новая операция. Заказ не создаётся.</p>' +
      '<label class="sel">Точка самовывоза<select id="importOutlet">' + C.stores.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === state.outletId ? ' selected' : '') + '>' + esc(s.short) + '</option>'; }).join('') + '</select></label>' +
      '<input id="importFile" type="file" accept=".csv,text/csv,.xls,.xlsx">' +
      '<div id="importPreview"></div></section>' +
      '<section class="card" id="pasteList"><h2 class="card__title">Вставить список</h2><p class="muted">Одна позиция в строке: артикул и количество. Разделители: точка с запятой, табуляция или пробел.</p><textarea id="pasteText" rows="5" placeholder="OC90; 2"></textarea><button class="btn" id="pasteBtn" type="button">Разобрать список</button><div id="pasteResult">' + pasteReport + '</div></section>';
  }
  function serverCartHtml(quoted) {
    pages.cart._quoted = quoted;
    if (!quoted.lines.length) return '<div class="page"><h1>Корзина</h1>' + demoBanner('Серверная корзина пуста. Цены считает сервер.') + '<div class="card empty">Корзина пуста. <a href="#/catalog">Перейти в каталог</a></div>' + importBox() + '</div>';
    var total = window.CarvicAccount.rub({ amount: quoted.totalMinor, minorUnit: 100 });
    var groups = (quoted.groups || []).map(function (g) {
      return '<section class="cart-group"><header><b>' + esc(g.outletName) + '</b><span class="muted">самовывоз</span></header>' +
        '<div class="cart-fulfill"><label><input type="radio" name="fulfill-' + esc(g.outletId) + '" checked disabled> Самовывоз · ' + esc(g.outletName) + '</label>' +
        (state.demoUi ? '<label><input type="checkbox" data-split="' + esc(g.outletId) + '"' + (g.split ? ' checked' : '') + '> По частям <span class="muted">(демо, перевозчик не вызывается)</span></label>' +
        '<label><input type="checkbox" data-nomerge="' + esc(g.outletId) + '"' + (g.noMerge ? ' checked' : '') + '> Не объединять <span class="muted">(демо)</span></label>' : '') + '</div>' +
        g.lines.map(function (l) {
          var stockSuffix = l.supply === 'pickup' && l.stock > 0 ? ' · наличие ' + l.stock + ' шт.' : '';
          var shortWarn = outletShortWarn(l.stock, l.qty) ? '<div class="stock-warn">На точке меньше, чем в заказе</div>' : '';
          return '<article class="cart-line"><div><b>' + esc(l.brand) + '</b> <span class="mono">' + esc(l.article) + '</span><div>' + esc(l.name) + '</div>' +
            shortWarn + '<div class="receipt">' + esc(l.receipt || '') + '</div><div class="muted">' + esc(l.term) + stockSuffix + '</div>' +
            '<label class="muted">Заметка <input data-note="' + esc(l.sku) + '" data-outlet="' + esc(l.outletId) + '" value="' + esc(l.note || '') + '" maxlength="200"></label>' +
            '<label class="muted">Перенос <select data-move="' + esc(l.sku) + '" data-from="' + esc(l.outletId) + '" aria-label="Перенести в точку">' + C.stores.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === l.outletId ? ' selected' : '') + '>' + esc(s.short) + '</option>'; }).join('') + '</select></label></div>' +
            '<div class="cart-line__side"><div class="qty"><button type="button" data-sq="' + esc(l.sku) + '" data-outlet="' + esc(l.outletId) + '" data-d="-1">−</button><span>' + l.qty + '</span><button type="button" data-sq="' + esc(l.sku) + '" data-outlet="' + esc(l.outletId) + '" data-d="1">+</button></div>' +
            '<div>' + esc(window.CarvicAccount.rub({ amount: l.unitMinor, minorUnit: 100 })) + '</div><b>' + esc(window.CarvicAccount.rub({ amount: l.sumMinor, minorUnit: 100 })) + '</b>' +
            '<button type="button" class="rm" data-srm="' + esc(l.sku) + '" data-outlet="' + esc(l.outletId) + '">Удалить</button></div></article>';
        }).join('') +
        '<div class="total-row"><span>Итого группы</span><b>' + esc(window.CarvicAccount.rub({ amount: g.totalMinor, minorUnit: 100 })) + '</b></div>' +
        (function () {
          var moved = g.lines.some(function (l) { return l.supply === 'own_transfer'; });
          var ordered = g.lines.some(function (l) { return l.supply === 'order_in'; });
          return (moved ? '<p class="muted">Перемещение с другой точки CARVIC. Ориентир 1 день. Это не заказ у поставщика.</p>' : '') +
            (ordered ? '<p class="muted">Есть позиции под заказ. ' + (state.orderInLead ? ('Срок ' + state.orderInLead + '. ') : 'Срок уточняется. ') + 'Самовывоз, оплата и чек при получении.</p>' : '') +
            '<a class="btn group-order" href="#/checkout?outlet=' + encodeURIComponent(g.outletId) + '">Заказать эту группу</a>';
        })() +
        '<button class="btn btn--ghost clear-group" type="button" data-clear-group="' + esc(g.outletId) + '">Очистить группу</button></section>';
    }).join('');
    return '<div class="page"><div class="crumbs"><a href="#/">Главная</a> / <span>Корзина</span></div><h1>Корзина</h1>' +
      importBox() +
      demoBanner('Группы по точкам выдачи. Получение только самовывозом, оплата и чек при получении.') +
      groups + '<div class="card"><div class="total-row"><span>Итого по серверу</span><span class="total">' + esc(total) + '</span></div></div></div>';
  }
  pages.cart = function () {
    return window.CarvicAccount.cart().then(serverCartHtml).catch(function (err) {
    if (state.buyer) return '<div class="page"><h1>Корзина</h1><div class="card">' + esc(err.message) + ' <a href="#/cart">Повторить</a></div></div>';
    if (!cart.length) return '<div class="page"><h1>Корзина</h1><div class="card empty">Корзина пуста. <a href="#/catalog">Перейти в каталог</a> или <a href="#/account">войдите в кабинет</a>.</div>' + importBox() + '</div>';
    return ensureData(cart.map(function (i) { return i.sku; })).then(function () {
      return '<div class="page"><div class="crumbs"><a href="#/">Главная</a> / <span>Корзина</span></div><h1>Корзина</h1><div class="card"><table class="cart-table"><thead><tr><th></th><th>Товар</th><th>Точка списания (остаток)</th><th>Кол-во</th><th style="text-align:right">Цена</th><th style="text-align:right">Сумма</th><th></th></tr></thead><tbody>' +
        cart.map(function (i, idx) {
          var p = bySku(i.sku), st = stockCache[i.sku] || {};
          return '<tr><td><div class="thumb">' + icon(p.icon) + '</div></td><td><a href="#/part/' + encodeURIComponent(p.sku) + '" style="text-decoration:none;font-weight:600">' + esc(p.name) + '</a><div class="res-sub">' + esc(p.brand) + ' <span>· ' + esc(p.article) + '</span></div></td>' +
            '<td><select data-co="' + idx + '" aria-label="Торговая точка">' + C.stores.map(function (o) { return '<option value="' + o.id + '"' + (o.id === i.outletId ? ' selected' : '') + '>' + esc(o.short) + ' — ' + (st[o.id] || 0) + ' шт.</option>'; }).join('') + '</select>' +
            '<div class="receipt">' + esc(receiptPhrase(st, i.outletId, i.qty)) + '</div>' + guestSupplyNote(st, i.outletId, i.qty) + '</td>' +
            '<td><div class="qty"><button data-cq="' + idx + '" data-d="-1">−</button><input data-cqi="' + idx + '" value="' + i.qty + '" aria-label="Количество"><button data-cq="' + idx + '" data-d="1">+</button></div></td>' +
            '<td style="text-align:right">' + priceHTML(i.sku) + '</td><td style="text-align:right"><b>' + fmt((priceOf(i.sku) || 0) * i.qty) + '</b></td><td><button class="rm" data-crm="' + idx + '" title="Удалить">✕</button></td></tr>';
        }).join('') + '</tbody></table>' +
        '<div class="total-row"><button class="btn btn--ghost" id="clearCart">Очистить корзину</button><div style="display:flex;gap:16px;align-items:center"><span>Итого: <span class="total">' + fmt(cartTotal()) + '</span></span><a class="btn btn--lg" href="#/checkout">Оформить заказ</a></div></div>' +
        '<p class="demo-note">Цены гостевой корзины — слой 1С в браузере. После входа в кабинет итог пересчитывает сервер.</p>' + importBox() + '</div></div>';
    });
    });
  };
  function saveServerCart(mutator) {
    var quoted = pages.cart._quoted;
    if (!quoted) return;
    var items = quoted.lines.map(function (l) { return { sku: l.sku, qty: l.qty, outletId: l.outletId, note: l.note || '' }; });
    items = mutator(items) || items;
    var split = $$('[data-split]').some(function (el) { return el.checked; });
    var noMerge = $$('[data-nomerge]').some(function (el) { return el.checked; });
    window.CarvicAccount.setCart({ items: items, split: split, noMerge: noMerge, mode: 'pickup' }).then(function () {
      return refreshBuyerSession();
    }).then(function () { route(); }).catch(function (err) { toast(err.message); });
  }
  var pasteReport = '';
  function rememberPaste(data) {
    var rejected = (data.rejected || []).map(function (row) { return '<li>' + esc(row.article || '') + ' — ' + esc(row.reason) + '</li>'; }).join('');
    var ready = (data.ready || []).map(function (row) { return '<li>' + esc(row.article) + (row.brand ? ' · ' + esc(row.brand) : '') + ' · ' + esc(row.qty) + ' шт.</li>'; }).join('');
    var body = (rejected ? '<h3>Не добавлено</h3><ul id="pasteRejected">' + rejected + '</ul>' : '') + (ready ? '<h3>Распознано</h3><ul id="pasteReady">' + ready + '</ul>' : '') + (!state.buyer && ready ? '<p class="muted">Позиции из выгрузки добавляются в корзину после входа в кабинет.</p>' : '');
    pasteReport = body ? body + '<p><button type="button" class="btn btn--ghost" id="pasteClose">Закрыть список</button></p>' : '';
  }
  function bindPasteClose(root) {
    var close = $('#pasteClose', root);
    if (!close) return;
    close.onclick = function () { pasteReport = ''; route(); };
  }
  function pasteList(root) {
    bindPasteClose(root);
    var btn = $('#pasteBtn', root);
    if (!btn) return;
    btn.onclick = function () {
      fetch('/api/feed/paste', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ text: $('#pasteText', root).value }) }).then(function (r) { return r.json(); }).then(function (data) {
        rememberPaste(data);
        if (!data.ready || !data.ready.length || !state.buyer) {
          var box = $('#pasteResult', root);
          if (box) box.innerHTML = pasteReport;
          bindPasteClose(root);
          return;
        }
        var quoted = pages.cart._quoted;
        var items = (quoted && quoted.lines || []).map(function (l) { return { sku: l.sku, qty: l.qty, outletId: l.outletId, note: l.note || '' }; });
        data.ready.forEach(function (row) {
          items.push({ sku: row.id, qty: row.qty, outletId: state.outletId, note: '' });
        });
        window.CarvicAccount.setCart({ items: items, mode: 'pickup' }).then(function () { route(); }).catch(function (err) { toast(err.message); });
      }).catch(function () { toast('Список не разобран'); });
    };
  }
  pages.cart.after = function (root) {
    pasteList(root);
    $$('[data-sq]', root).forEach(function (b) {
      b.onclick = function () {
        saveServerCart(function (items) {
          return items.map(function (item) {
            if (item.sku === b.dataset.sq && item.outletId === b.dataset.outlet) item.qty = Math.max(1, Math.min(99, item.qty + (+b.dataset.d)));
            return item;
          });
        });
      };
    });
    $$('[data-srm]', root).forEach(function (b) {
      b.onclick = function () {
        saveServerCart(function (items) { return items.filter(function (item) { return !(item.sku === b.dataset.srm && item.outletId === b.dataset.outlet); }); });
      };
    });
    $$('[data-note]', root).forEach(function (inp) {
      inp.onchange = function () {
        saveServerCart(function (items) {
          return items.map(function (item) {
            if (item.sku === inp.dataset.note && item.outletId === inp.dataset.outlet) item.note = inp.value;
            return item;
          });
        });
      };
    });
    $$('[data-split], [data-nomerge]', root).forEach(function (box) { box.onchange = function () { saveServerCart(function (items) { return items; }); }; });
    $$('[data-move]', root).forEach(function (sel) {
      sel.onchange = function () {
        if (sel.value === sel.dataset.from) return;
        window.CarvicAccount.moveCartLine({ sku: sel.dataset.move, fromOutletId: sel.dataset.from, toOutletId: sel.value }).then(function () {
          return refreshBuyerSession();
        }).then(function () { route(); }).catch(function (err) { toast(err.message); });
      };
    });
    var file = $('#importFile', root);
    if (file) file.onchange = function () {
      pages.cart._importKey = '';
      var picked = file.files && file.files[0];
      var box = $('#importPreview', root);
      if (!picked || !box) return;
      var lower = picked.name.toLowerCase();
      if (picked.size > 1500000) { box.innerHTML = '<p class="warn-box">Файл слишком большой.</p>'; return; }
      var reader = new FileReader();
      var asXlsx = /\.xlsx$/.test(lower);
      var asXls = /\.xls$/.test(lower) && !asXlsx;
      reader.onload = function () {
        var payload = (asXlsx || asXls)
          ? { format: asXls ? 'xls' : 'xlsx', base64: String(reader.result || '').split(',')[1] || '', outletId: $('#importOutlet', root).value, apply: false }
          : { format: 'csv', text: String(reader.result || ''), outletId: $('#importOutlet', root).value, apply: false };
        window.CarvicAccount.importCart(payload).then(function (res) {
          pages.cart._import = payload;
          box.innerHTML = '<ul class="board">' + res.rows.map(function (row) {
            return '<li><b>' + esc(row.brand || '') + ' ' + esc(row.article || '') + '</b><span>' + esc(row.status) + '</span><span>' + esc(row.reason || (row.stock != null ? 'наличие ' + row.stock : '')) + '</span></li>';
          }).join('') + '</ul><button class="btn" type="button" id="importApply">Добавить найденные в корзину</button>';
          var apply = $('#importApply', root);
          if (apply) apply.onclick = function () {
            var saved = pages.cart._import;
            if (!pages.cart._importKey) pages.cart._importKey = 'imp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
            apply.disabled = true;
            window.CarvicAccount.importCart(Object.assign({}, saved, { apply: true }), pages.cart._importKey).then(function (res) {
              if (res.duplicateApply) { toast('Этот файл уже добавлялся. Повтор не увеличил количество.'); return; }
              return refreshBuyerSession();
            }).then(function () { toast('Найденные строки добавлены. Заказ не создан.'); route(); }).catch(function (err) { toast(err.message); });
          };
        }).catch(function (err) { box.innerHTML = '<p class="warn-box">' + esc(err.message) + '</p>'; });
      };
      if (asXlsx || asXls) reader.readAsDataURL(picked); else reader.readAsText(picked);
    };
    $$('[data-clear-group]', root).forEach(function (btn) {
      btn.onclick = function () {
        if (!confirm('Очистить только эту группу?')) return;
        window.CarvicAccount.clearCartGroup(btn.dataset.clearGroup).then(function () { return refreshBuyerSession(); }).then(function () { route(); }).catch(function (err) { toast(err.message); });
      };
    });
    $$('[data-co]', root).forEach(function (s) { s.onchange = function () { setItemOutlet(+s.dataset.co, s.value); route(); }; });
    $$('[data-cq]', root).forEach(function (b) { b.onclick = function () { var i = +b.dataset.cq; setQty(i, cart[i].qty + (+b.dataset.d)); route(); }; });
    $$('[data-cqi]', root).forEach(function (inp) { inp.onchange = function () { setQty(+inp.dataset.cqi, inp.value); route(); }; });
    $$('[data-crm]', root).forEach(function (b) { b.onclick = function () { removeItem(+b.dataset.crm); route(); }; });
    var cl = $('#clearCart', root); if (cl) cl.onclick = function () { if (confirm('Очистить корзину?')) { cart = []; saveCart(); route(); } };
  };

  function reservePlace(lines, stores) {
    var seen = {};
    var places = [];
    (lines || []).forEach(function (line) {
      var store = (stores || []).filter(function (row) { return row.id === line.outletId; })[0];
      var place = store ? ((store.city ? store.city + ', ' : '') + store.address) : (line.outletName || '');
      if (place && !seen[place]) { seen[place] = 1; places.push(place); }
    });
    if (places.length > 1) return 'магазинах ' + places.join('; ');
    if (places.length === 1) return 'магазине ' + places[0];
    return 'выбранной точке выдачи';
  }

  /* --- Оформление: суммы только с сервера. Карта и СБП скрыты, пока флаг онлайн-оплаты выключен. --- */
  pages.checkout = function () {
    var A = window.CarvicAccount;
    return A.status().then(function (st) {
      if (!st.available) return '<div class="page"><h1>Оформление</h1><div class="card"><p>' + esc(st.note) + '</p></div></div>';
      return A.me().then(function (me) {
        state.act = me.act && me.act.active ? me.act : null;
        return Promise.all([A.methods(), A.cart()]).then(function (pair) {
          var methods = pair[0].methods, quoted = pair[1];
          var reservation = pair[0].reservation || {};
          var outlet = (currentRoute().params || {}).outlet || '';
          var lines = quoted.lines.filter(function (l) { return !outlet || l.outletId === outlet; });
          var totalMinor = lines.reduce(function (sum, l) { return sum + l.sumMinor; }, 0);
          if (!lines.length) return '<div class="page"><h1>Оформление</h1><div class="card empty">В этой группе пусто. <a href="#/cart">Вернуться в корзину</a></div></div>';
          var offerWholesale = me.role === 'wholesale' || (me.staffCabinet && me.staffCabinet.segment === 'wholesale');
          var until = offerWholesale ? reservation.wholesaleUntil : reservation.retailUntil;
          state.consentPreK3 = Boolean(st.consentPreK3);
          var offerPages = '<a href="#/delivery" target="_blank" rel="noopener">«Доставка и оплата»</a> и <a href="#/returns" target="_blank" rel="noopener">«Возврат»</a>';
          var offerBlock = state.consentPreK3
            ? ((me.staffCabinet && me.staffCabinet.segment === 'wholesale')
              ? '<p>Заказ оформляется на условиях страниц ' + offerPages + '.</p>'
              : (offerWholesale
                ? '<label class="check"><input type="checkbox" id="acceptOffer"> Подтверждаю, что действую от имени указанной организации (ИП) для предпринимательской деятельности, и согласен(на) с условиями на страницах ' + offerPages + ', в том числе со сроком выборки 3 рабочих дня и автоотменой заказа после него.</label>'
                : '<label class="check"><input type="checkbox" id="acceptOffer"> Я ознакомлен(а) с условиями на страницах ' + offerPages + ', в том числе со сроком резерва 3 календарных дня, и согласен(на) с ними.</label>'))
            : ((me.staffCabinet && me.staffCabinet.segment === 'wholesale')
              ? '<p>Заказ оформляется на <a href="#/legal/oferta-opt" target="_blank" rel="noopener">Условиях поставки</a>.</p>'
              : (offerWholesale
                ? '<label class="check"><input type="checkbox" id="acceptOffer"> Я ознакомлен(а) с <a href="#/legal/oferta-opt" target="_blank" rel="noopener">Условиями поставки</a> и подтверждаю резерв</label>'
                : '<label class="check"><input type="checkbox" id="acceptOffer"> Я ознакомлен(а) с <a href="#/legal/oferta" target="_blank" rel="noopener">условиями оферты</a>, в т. ч. с <a href="#/returns" target="_blank" rel="noopener">порядком возврата</a>, и подтверждаю резерв</label>'));
          var reserveNote = '<p class="muted" id="reserveNote">' + (offerWholesale ? 'Выборка 3 рабочих дня' : 'Товар резервируется') + ' в ' + esc(reservePlace(lines, C.stores)) + (until ? (' до ' + esc(until)) : '') + '. Оплата при получении: перед оплатой вы можете осмотреть товар и отказаться от него. Обработка данных — по <a href="#/legal/privacy">Политике</a></p>';
          return '<div class="page"><div class="crumbs"><a href="#/cart">Корзина</a> / <span>Оформление</span></div><h1>Оформление</h1>' + accountNav() +
            demoBanner('Демо-оформление. В 1С не пишется. Карта и СБП не проводят платёж.') +
            (outlet ? '<p class="muted">Оформляется одна группа. Остальные точки остаются в корзине.</p>' : '') +
            '<div class="checkout-grid"><form class="card form" id="payForm"><p>Покупатель: <b>' + esc(me.account.name) + '</b></p>' +
            (me.act && me.act.active && !(me.staffCabinet && me.staffCabinet.segment === 'wholesale') ? '<div class="warn-box">Служебный просмотр не проводит оплату.</div>' : '') +
            '<div class="pay-list" id="payList">' + methods.map(function (m) {
              return '<label class="' + (m.available ? '' : 'off') + '"><input type="radio" name="pay" value="' + m.id + '"' + (m.available ? '' : ' disabled') + (m.id === 'cash' ? ' checked' : '') + '> <span><b>' + esc(m.title) + '</b>' + (m.available ? '' : ' · недоступно') + '<br><span class="muted">' + esc(m.note) + '</span></span></label>';
            }).join('') + '</div>' + offerBlock + reserveNote +
            '<button class="btn btn--lg" id="paySubmit" type="submit"' + ((me.act && me.act.active && !(me.staffCabinet && me.staffCabinet.segment === 'wholesale')) || (state.consentPreK3 && !(me.staffCabinet && me.staffCabinet.segment === 'wholesale')) ? ' disabled' : '') + '>' + (me.staffCabinet && me.staffCabinet.segment === 'wholesale' ? 'Оформить заказ' : 'Зарезервировать') + '</button></form>' +
            '<aside class="card"><h2 class="card__title">Состав</h2>' + lines.map(function (l) {
              return '<div class="summary-line"><span>' + esc(l.brand) + ' · ' + esc(l.article) + '<br><small>' + esc(l.name) + ' × ' + l.qty + '<br>' + esc(l.term) + ' · ' + esc(l.outletName) + (l.note ? '<br>Заметка: ' + esc(l.note) : '') + '</small></span><b>' + esc(A.rub({ amount: l.sumMinor, minorUnit: 100 })) + '</b></div>';
            }).join('') + '<div class="total-row"><span>Итого</span><span class="total">' + esc(A.rub({ amount: totalMinor, minorUnit: 100 })) + '</span></div></aside></div></div>';
        });
      }).catch(function () {
        return '<div class="page"><h1>Оформление</h1><div class="card">Войдите в <a href="#/account">личный кабинет</a>, чтобы сервер посчитал корзину. Без входа оплата не запускается.</div></div>';
      });
    });
  };
  function placedOrderHtml(order, reservation) {
    var A = window.CarvicAccount;
    var lines = (order.lines || []).map(function (l) {
      return '<div class="summary-line" id="placedLine"><span>' + esc(l.brand) + ' · ' + esc(l.article) + '<br><small>' + esc(l.name) + ' × ' + l.qty + '<br>' + esc(l.term || '') + '</small></span><b>' + esc(A.rub({ amount: l.sumMinor, minorUnit: 100 })) + '</b></div>';
    }).join('');
    var orderIn = (order.lines || []).some(function (l) { return l.supply === 'order_in'; });
    var reserve = orderIn
      ? 'срок уточняется'
      : (order.segment === 'wholesale'
        ? 'Выборка 3 рабочих дня' + (reservation && reservation.wholesaleUntil ? ', до ' + reservation.wholesaleUntil : '')
        : 'Резерв 3 дня' + (reservation && reservation.retailUntil ? ', до ' + reservation.retailUntil : ''));
    return '<div class="page"><div class="card success" id="orderPlaced"><h1>Заказ ' + esc(order.id) + '</h1><p>Оплата: ' + esc(order.payment.methodLabel || order.payment.method) + ' · ' + esc(order.payment.statusLabel || order.payment.status) + '</p>' +
      '<p id="placedOutlet">Точка выдачи: <b>' + esc(order.outletName || '') + '</b>' + (order.outletAddress ? ', ' + esc(order.outletAddress) : '') + (order.outletHours ? '<br>Часы: ' + esc(order.outletHours) : '') + '</p>' +
      '<div id="placedLines">' + lines + '</div>' +
      '<p id="placedTotal">Сумма: <b>' + esc(A.rub(order.total)) + '</b></p>' +
      '<p id="placedReserve">' + esc(reserve) + '</p>' +
      demoBanner('Это демо-заказ. Деньги не принимались, в 1С запись не ушла.') +
      '<a class="btn" href="#/account/orders/' + encodeURIComponent(order.id) + '">Открыть заказ</a></div></div>';
  }
  pages.checkout.after = function (root) {
    var form = $('#payForm', root); if (!form) return;
    var offerBox = $('#acceptOffer', root);
    var payBtn = $('#paySubmit', root);
    if (offerBox && payBtn && state.consentPreK3) {
      offerBox.onchange = function () { payBtn.disabled = !offerBox.checked; };
    }
    form.onsubmit = function (e) {
      e.preventDefault();
      var chosen = $('input[name=pay]:checked', root);
      if (!chosen) { toast('Выберите доступный способ'); return; }
      var offer = $('#acceptOffer', root);
      if (offer && !offer.checked) { toast(state.consentPreK3 ? 'Отметьте ознакомление с условиями.' : 'Отметьте ознакомление с условиями оферты.'); return; }
      var btn = $('#paySubmit', root); btn.disabled = true;
      if (!form.dataset.idem) form.dataset.idem = 'chk-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      var payload = { method: chosen.value, acceptOffer: offer ? true : false };
      var outlet = (currentRoute().params || {}).outlet;
      if (outlet) payload.outletId = outlet;
      window.CarvicAccount.checkout(payload, form.dataset.idem).then(function (res) {
        delete form.dataset.idem;
        refreshBuyerSession();
        view.innerHTML = placedOrderHtml(res.order, res.reservation);
      }).catch(function (err) {
        btn.disabled = false;
        if (err.code !== 'network') delete form.dataset.idem;
        toast(err.message);
      });
    };
  };

  /* --- Вход контрагента (демо) --- */
  pages.login = function () {
    return fetch('/api/auth/status', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (st) {
      state.consentPreK3 = Boolean(st.consentPreK3);
      return '<div class="page" style="max-width:640px" id="optRegPage"><h1>Регистрация оптовика</h1><div class="warn-box">проект, на согласовании. Кабинет не создаётся, пока заявка не проверена. Письмо не отправляется.</div>' +
        '<form class="card form" id="optReg"><div class="field"><label for="optOrg">Организация или ИП</label><input id="optOrg" maxlength="160"></div>' +
        '<div class="field"><label for="optInn">ИНН</label><input id="optInn" inputmode="numeric" maxlength="12"></div>' +
        '<div class="field"><label for="optKpp">КПП</label><input id="optKpp" inputmode="numeric" maxlength="9"></div>' +
        '<div class="field"><label for="optName">Контактное лицо</label><input id="optName" maxlength="80"></div>' +
        '<div class="field"><label for="optPhone">Телефон</label><input id="optPhone" inputmode="numeric" maxlength="18"></div>' +
        '<div class="field"><label for="optMail">E-mail</label><input id="optMail" type="email" maxlength="120"></div>' +
        '<label class="check"><input type="checkbox" id="optTerms"> Я принимаю <a href="#/legal/terms" target="_blank" rel="noopener">Пользовательское соглашение</a></label>' +
        (st.consentPreK3
          ? '<label class="check"><input type="checkbox" id="optOffer"> Подтверждаю полномочия действовать от имени указанной организации (ИП) и согласен(на) с условиями покупок на страницах <a href="#/delivery" target="_blank" rel="noopener">«Доставка и оплата»</a> и <a href="#/returns" target="_blank" rel="noopener">«Возврат»</a>.</label>'
          : '<label class="check"><input type="checkbox" id="optOffer"> Я подтверждаю полномочия действовать от имени указанной организации (ИП) и принимаю <a href="#/legal/oferta-opt" target="_blank" rel="noopener">Условия поставки для оптовых покупателей</a></label>') +
        '<p class="muted">Данные контактного лица обрабатываются для заключения и исполнения договора поставки в соответствии с <a href="#/legal/privacy">Политикой обработки персональных данных</a></p>' +
        '<label class="check"><input type="checkbox" id="optAds"> Хочу получать рекламные сообщения об акциях CARVIC по e-mail. <a href="#/legal/consent-ads" target="_blank" rel="noopener">Согласие на рассылки</a></label>' +
        '<button class="btn" id="optSubmit" type="submit"' + (st.consentPreK3 ? ' disabled' : '') + '>Отправить заявку</button><div id="optResult"></div></form>' +
        '<div id="cpGate"><h2>Вход</h2>' +
        '<div class="warn-box"><b>Единый вход закрыт.</b> ' + esc(st.unifiedLogin === 'unavailable' ? 'SMS-провайдер не подключён. Код из браузера не принимается и не меняет тип цены.' : '') + '</div>' +
        (st.demoAccounts ? '<p class="muted">Кабинет покупателя при включённом учебном флаге сервера открывается отдельно и помечен как демо. Это не боевой вход.</p><p><a class="btn" href="#/account">Учебный кабинет</a></p>' : '') + '</div></div>';
    }).catch(function () {
      return '<div class="page" id="cpGate"><h1>Вход</h1><div class="card">Сервер входа не ответил. Тип цены из браузера не применяется.</div></div>';
    });
  };
  pages.login.after = function (root) {
    var form = $('#optReg', root);
    if (!form) return;
    var optOffer = $('#optOffer', root);
    var optBtn = $('#optSubmit', root);
    if (optOffer && optBtn && state.consentPreK3) {
      optOffer.onchange = function () { optBtn.disabled = !optOffer.checked; };
    }
    form.onsubmit = function (e) {
      e.preventDefault();
      fetch('/api/opt/register', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({
        organization: $('#optOrg', root).value, inn: $('#optInn', root).value, kpp: $('#optKpp', root).value,
        contactName: $('#optName', root).value, phone: $('#optPhone', root).value, email: $('#optMail', root).value,
        acceptTerms: $('#optTerms', root).checked, acceptOpt: $('#optOffer', root).checked, acceptAds: $('#optAds', root).checked
      }) }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); }).then(function (res) {
        $('#optResult', root).innerHTML = res.ok ? '<p class="warn-box">Заявка ' + esc(res.data.id) + ' записана. Кабинет не создан. Письмо не отправлено.</p>' : '<p class="warn-box">' + esc(res.data.message || 'Не принято') + '</p>';
      });
    };
  };
  function setCp(c) {
    if (!c) { state.cp = null; return Promise.resolve(); }
    return API.getPriceTypes().then(function (types) {
      var t = types.filter(function (x) { return x.id === c.priceType; })[0];
      state.cp = Object.assign({}, c, { priceTypeName: t ? t.name : c.priceType });
      lsSet(LS_CP, c.id); resetPrices(); renderBuyer(); renderDrawer();
    });
  }

  /* --- Статические страницы --- */
  function storeCards() {
    return '<div class="grid grid-3 stores" id="storeCards">' + C.stores.map(function (o, i) {
      return '<article class="card store" data-store="' + esc(o.id) + '"><div style="display:flex;gap:10px;align-items:center"><span class="num">' + (i + 1) + '</span><h3>' + esc(o.title) + '</h3></div>' +
        '<div class="row"><span>Адрес</span><span>' + esc(o.city) + ', ' + esc(o.address) + '</span></div>' +
        '<div class="row"><span>Телефон</span><span><a href="tel:' + C.phoneHref + '">' + C.phone + '</a></span></div>' +
        '<div class="row"><span>Часы</span><span>' + esc(o.hours) + ', ' + esc(o.timezone) + '</span></div>' +
        '<p class="muted">Источник часов: отдельная карточка 2ГИС, проверено 8 ноября 2026. ' + esc(C.hoursNote) + '</p>' +
        '<div class="actions"><a class="btn btn--dark" target="_blank" rel="noopener" href="' + esc(mapUrl(o)) + '">Карточка 2ГИС</a><a class="btn btn--ghost" href="tel:' + C.phoneHref + '">Позвонить</a></div></article>';
    }).join('') + '</div>';
  }
  /* География присутствия: открытые города — красные точки, будущие — серые */
  function geoCities() {
    var phone = '<a href="tel:' + C.phoneHref + '">' + C.phone + '</a>';
    function soon(id, name) {
      return { id: id, name: name, status: 'soon', label: name + ': скоро открытие',
        popup: '<p class="geo__pop-title">' + esc(name) + '</p><p class="geo__pop-soon">Скоро открытие</p>' };
    }
    var irk = C.stores.filter(function (o) { return o.city === 'Иркутск'; });
    return [
      { id: 'irkutsk', name: 'Иркутск', status: 'open', label: 'Иркутск: ' + irk.length + ' магазина CARVIC',
        popup: '<p class="geo__pop-title">Иркутск</p><p class="geo__pop-sub">' + irk.length + ' магазина CARVIC</p>' +
          irk.map(function (o) {
            return '<div class="geo__store"><b>' + esc(o.title) + '</b><span>' + esc(o.address) + '</span>' + (o.hours ? '<span class="muted">' + esc(o.hours) + '</span>' : '') +
              (mapUrl(o) ? '<a href="' + esc(mapUrl(o)) + '" target="_blank" rel="noopener">Карточка 2ГИС</a>' : '') + '</div>';
          }).join('') + '<p class="geo__pop-foot">' + phone + '</p>' },
      { id: 'angarsk', name: 'Ангарск', status: 'open', label: 'Ангарск: магазин CARVIC',
        popup: '<p class="geo__pop-title">Ангарск</p><p class="geo__pop-sub">Магазин CARVIC</p><p class="geo__pop-foot">Адрес и часы работы — по телефону ' + phone + '</p>' },
      soon('ulanude', 'Улан-Удэ'), soon('chita', 'Чита'), soon('nizhneudinsk', 'Нижнеудинск'), soon('krasnoyarsk', 'Красноярск'), soon('bratsk', 'Братск')
    ];
  }
  pages.stores = function () {
    var geo = window.CarvicGeo ? '<h2 class="geo__title">География</h2>' + window.CarvicGeo.html(geoCities()) : '';
    return Promise.resolve('<div class="page"><div class="crumbs"><a href="#/">Главная</a> / <span>Торговые точки</span></div><h1>Торговые <em>точки</em></h1><p>Три торговые точки CARVIC в Иркутске. Наличие товара по каждой точке показывается в каталоге и корзине.</p>' + geo + '<h2 class="geo__title">Магазины в Иркутске</h2>' + storeCards() + '</div>');
  };
  pages.stores.after = function (root) { if (window.CarvicGeo) window.CarvicGeo.bind(root); };
  pages.wholesale = function () {
    return Promise.resolve('<div class="page"><div class="crumbs"><a href="#/">Главная</a> / <span>Оптовикам</span></div>' +
      '<div class="hero-strip"><h1>Оптовым <em>покупателям</em></h1><p>Автосервисам, магазинам и корпоративным клиентам — работа по договору с организацией.</p></div>' +
      '<div class="grid grid-3" style="margin-top:14px">' +
      '<div class="card feature"><i>1</i><div><b>Индивидуальный тип цены</b>Каждому контрагенту назначается свой тип цены и, при необходимости, скидки по группам товаров.</div></div>' +
      '<div class="card feature"><i>2</i><div><b>Личный вход</b>После входа в каталоге, корзине и заказе показываются ваши цены.</div></div>' +
      '<div class="card feature"><i>3</i><div><b>Широкий ассортимент</b>Запчасти на китайские, европейские, японские и корейские авто — в наличии и под заказ.</div></div></div>' +
      '<h2>Как начать работу</h2><div class="card"><p>Свяжитесь с отделом оптовых продаж — условия сотрудничества обсуждаются индивидуально.</p><p><b>Отдел оптовых продаж</b><br><b>E-mail:</b> <a href="mailto:' + esc(C.email) + '">' + esc(C.email) + '</a><br><b>Телефон:</b> <a href="tel:' + C.phoneHref + '">' + C.phone + '</a></p>' +
      '<p id="optDocs">' + (state.consentPreK3 ? '' : '<a href="#/legal/oferta-opt">Условия поставки для оптовых покупателей</a> · ') + '<a href="#/legal/terms">Пользовательское соглашение</a> · <a href="#/legal/privacy">Политика обработки персональных данных</a></p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn" href="#/login">Регистрация оптовика</a><a class="btn btn--ghost" href="mailto:' + C.email + '?subject=' + encodeURIComponent('Оптовое сотрудничество с CARVIC') + '">Написать менеджеру</a><a class="btn btn--ghost" href="#/requisites">Реквизиты</a></div></div></div>');
  };
  pages.about = function () {
    return Promise.resolve('<div class="page"><div class="crumbs"><a href="#/">Главная</a> / <span>О компании</span></div>' +
      '<div class="hero-strip"><h1>CARVIC — <em>автозапчасти</em></h1><p>ООО "Карвик" — продажа автозапчастей оптом и в розницу в Иркутске.</p></div>' +
      '<div class="grid grid-4" style="margin-top:14px">' +
      ['Широкий ассортимент', 'Качественные запчасти', 'Честные цены', 'В наличии и под заказ'].map(function (t, i) { return '<div class="card feature"><i>' + (i + 1) + '</i><div><b>' + t + '</b></div></div>'; }).join('') + '</div>' +
      '<div class="card" style="margin-top:14px"><p>Запчасти на китайские, европейские, японские и корейские автомобили. ' + (state.demoUi ? 'Подбор по VIN, по марке и модели, по артикулу и OEM-номеру.' : 'Подбор по артикулу и OEM-номеру. Если номера нет, оставьте заявку менеджеру.') + '</p><p>Три торговые точки в Иркутске: Автосити на Сергеевском и ТЦ «Прибой». <a href="#/stores">Адреса торговых точек</a></p><p><a href="#/about/team">Команда Карвика</a></p></div></div>');
  };
  pages.aboutTeam = function () {
    return Promise.resolve('<div class="page" id="teamPage"><div class="crumbs"><a href="#/">Главная</a> / <a href="#/about">О компании</a> / <span>Команда</span></div><h1>Команда Карвика</h1><div class="card"><p>В магазинах Карвика помогают с подбором детали и проверкой совместимости. Напишите или позвоните по общему номеру, если нужна консультация по заказу.</p><p><a class="btn btn--ghost" href="#/contacts">Контакты</a></p></div></div>');
  };
  pages.blog = function () {
    return Promise.resolve('<div class="page" id="blogPage"><div class="crumbs"><a href="#/">Главная</a> / <span>Блог</span></div><h1>Блог</h1><div class="blog-grid">' +
      '<a class="blog-card" href="#/catalog/brakes"><b>Когда менять тормозные колодки: 6 признаков износа</b> <span class="blog-more">Колодки в каталоге →</span></a>' +
      '<a class="blog-card" href="#/catalog/electrics"><b>Аккумулятор для сибирской зимы: ёмкость, пусковой ток, как выбрать</b> <span class="blog-more">Аккумуляторы в каталоге →</span></a>' +
      '<a class="blog-card" href="#/catalog/suspension"><b>Стук в подвеске: как найти причину по звуку</b> <span class="blog-more">Подвеска в каталоге →</span></a>' +
      '<a class="blog-card" href="#/search"><b>Как найти запчасть по VIN-коду: пошаговая инструкция</b> <span class="blog-more">Подобрать по VIN →</span></a>' +
      '</div></div>');
  };
  pages.contacts = function () {
    return Promise.resolve('<div class="page"><div class="crumbs"><a href="#/">Главная</a> / <span>Контакты</span></div><h1>Контакты</h1>' +
      '<div class="grid grid-3"><div class="card"><h3 style="margin-top:0">Основной телефон</h3><a class="price" style="text-align:left;display:block;text-decoration:none;font-size:22px" href="tel:' + C.phoneHref + '">' + C.phone + '</a><p class="muted" style="margin-bottom:0">Часы трёх точек: ' + esc(C.hours) + '. ' + esc(C.hoursNote) + '</p></div>' +
      '<div class="card"><h3 style="margin-top:0">E-mail</h3><a href="mailto:' + C.email + '">' + C.email + '</a><p class="muted">Сайт: ' + C.domain + '</p></div>' +
      '<div class="card"><h3 style="margin-top:0">Адреса</h3><p style="margin:0 0 6px"><span class="muted">Фактический:</span> ' + esc(C.actualAddress) + '</p><p style="margin:0"><span class="muted">Юридический:</span> ' + esc(C.legalAddress) + '</p></div></div>' +
      (state.privacyEmail ? '<p id="privacyContact">Запросы по персональным данным: <a href="mailto:' + esc(state.privacyEmail) + '">' + esc(state.privacyEmail) + '</a></p>' : '') +
      '<h2>Обратный звонок</h2><div class="card callback-cta"><p>Оставьте имя и телефон — менеджер перезвонит.</p><a class="btn" href="#/callback">Заказать звонок</a></div>' +
      '<h2>Торговые точки</h2>' + storeCards() + '</div>');
  };
  /* Заказать звонок — окно поверх страницы (см. MODAL_ROUTES) */
  pages.callback = function () {
    return Promise.resolve('<div id="callbackPage"><h2 class="modal__title" id="modalTitle">Заказать звонок</h2>' +
      '<p class="modal__lead">Оставьте имя и телефон — менеджер перезвонит.</p>' +
      '<form class="form inq-form" id="callForm">' +
      '<div class="field"><label for="callName">Имя</label><input id="callName" maxlength="80"></div>' +
      '<div class="field"><label for="callPhone">Телефон</label><input id="callPhone" inputmode="tel" maxlength="18" placeholder="+7"></div>' +
      '<div class="field field--wide"><label for="callMsg">Комментарий</label><textarea id="callMsg" maxlength="500" rows="3"></textarea></div>' +
      '<label class="check"><input type="checkbox" id="callConsent"> Я даю <a href="#/legal/consent-request" target="_blank" rel="noopener">согласие на обработку моих персональных данных</a> (имя, телефон, комментарий) для обратного звонка</label>' +
      '<div class="field" style="position:absolute;left:-9999px" aria-hidden="true"><label>Компания<input id="callCompany" tabindex="-1" autocomplete="off"></label></div>' +
      '<button class="btn" type="submit">Жду звонка</button></form><div id="callResult"></div></div>');
  };
  pages.callback.after = function (root) {
    var form = $('#callForm', root);
    if (!form) return;
    form.onsubmit = function (e) {
      e.preventDefault();
      fetch('/api/callback-request', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({
        name: $('#callName', root).value, phone: $('#callPhone', root).value, message: $('#callMsg', root).value,
        company: $('#callCompany', root).value, consentRequest: $('#callConsent', root).checked
      }) }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); }).then(function (res) {
        if (!res.ok) { $('#callResult', root).innerHTML = '<p class="warn-box">' + esc(res.data.message || 'Не принято') + '</p>'; return; }
        form.hidden = true;
        $('#callResult', root).innerHTML = '<div class="inq-done"><span class="inq-done__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><p class="inq-done__title">Заявка принята</p><div class="warn-box">Номер ' + esc(res.data.id) + '. ' + esc(res.data.note) + '</div><button class="btn" type="button" data-modal-close>Закрыть</button></div>';
        var done = $('[data-modal-close]', $('#callResult', root));
        if (done) done.focus();
      }).catch(function () { toast('Нет связи с сервером. Попробуйте ещё раз.'); });
    };
  };
  pages.requisites = function () {
    return Promise.resolve('<div class="page"><div class="crumbs"><a href="#/">Главная</a> / <span>Реквизиты</span></div><h1>Реквизиты</h1><div class="card" style="padding:0;overflow:hidden"><table class="req">' +
      C.requisites.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + ' <button class="copy" data-copy="' + esc(r[1]) + '" title="Копировать">⧉</button></td></tr>'; }).join('') + '</table></div>' +
      '<p class="warn-box" id="kppNote">КПП в исходном документе указан как 30001001 — 8 цифр. Значение не исправлялось и не дополнялось. needsConfirmation.</p>' +
      '<div style="margin-top:12px"><button class="btn btn--ghost" id="copyAll">Скопировать все реквизиты</button></div></div>');
  };
  pages.requisites.after = function (root) {
    function copy(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Скопировано'); }, function () { toast('Не удалось скопировать'); }); }
    $$('[data-copy]', root).forEach(function (b) { b.onclick = function () { copy(b.dataset.copy); }; });
    $('#copyAll', root).onclick = function () { copy(C.requisites.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n')); };
  };
  pages.inquiry = function () {
    var params = currentRoute.params || {};
    var article = params.article ? String(params.article) : '';
    var brand = params.brand ? String(params.brand) : '';
    var point = params.outlet && outlet(params.outlet) ? params.outlet : state.outletId;
    var kind = params.kind || 'contact';
    if (kind !== 'contact' && kind !== 'selection' && kind !== 'price' && kind !== 'analog') kind = 'contact';
    function optKind(value, label) { return '<option value="' + value + '"' + (kind === value ? ' selected' : '') + '>' + label + '</option>'; }
    return Promise.resolve('<div id="inquiryPage"><h2 class="modal__title" id="modalTitle">Обращение и подбор</h2>' +
      '<form class="form inq-form" id="inquiryForm"><div class="field field--wide"><label for="inqKind">Тема</label><select id="inqKind">' + optKind('contact', 'Спросить менеджера') + optKind('price', 'Ошибка в цене или остатке') + optKind('analog', 'Подобрать аналог') + optKind('selection', 'Подбор') + '</select></div>' +
      '<div class="field"><label for="inqArticle">Артикул</label><input id="inqArticle" maxlength="80" value="' + esc(article) + '"></div>' +
      '<div class="field"><label for="inqBrand">Бренд</label><input id="inqBrand" maxlength="80" value="' + esc(brand) + '"></div>' +
      '<div class="field field--wide"><label for="inqOutlet">Точка</label><select id="inqOutlet">' + C.stores.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === point ? ' selected' : '') + '>' + esc(s.short) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="inqName">Имя</label><input id="inqName" maxlength="80"></div>' +
      '<div class="field"><label for="inqContact">Телефон или e-mail</label><input id="inqContact" maxlength="120"></div>' +
      (state.demoUi ? '<div class="field"><label for="inqVin">VIN, если есть</label><input id="inqVin" maxlength="17"></div>' : '') +
      '<div class="field field--wide"><label for="inqMsg">Сообщение</label><textarea id="inqMsg" maxlength="2000" rows="4"></textarea></div>' +
      '<label class="check"><input type="checkbox" id="inqConsent"> Я даю <a href="#/legal/consent-request" target="_blank" rel="noopener">согласие на обработку моих персональных данных</a> (имя, телефон' + (state.demoUi ? ', VIN' : '') + ', вопрос) для ответа на обращение и подбора запчастей</label>' +
      '<p class="muted">Подробнее — в <a href="#/legal/privacy">Политике обработки персональных данных</a></p>' +
      '<div class="field" style="position:absolute;left:-9999px" aria-hidden="true"><label>Компания<input id="inqCompany" tabindex="-1" autocomplete="off"></label></div>' +
      '<button class="btn" type="submit">Записать обращение</button></form><div id="inquiryResult"></div></div>');
  };
  pages.inquiry.after = function (root) {
    var form = $('#inquiryForm', root);
    if (!form) return;
    form.onsubmit = function (e) {
      e.preventDefault();
      window.CarvicAccount.sendInquiry({
        kind: $('#inqKind', root).value,
        article: $('#inqArticle', root).value,
        brand: $('#inqBrand', root).value,
        outletId: $('#inqOutlet', root).value,
        name: $('#inqName', root).value,
        contact: $('#inqContact', root).value,
        vin: $('#inqVin', root) ? $('#inqVin', root).value : '',
        message: $('#inqMsg', root).value,
        company: $('#inqCompany', root).value,
        consentRequest: $('#inqConsent', root).checked
      }).then(function (res) {
        form.hidden = true;
        $('#inquiryResult', root).innerHTML = '<div class="inq-done"><span class="inq-done__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><p class="inq-done__title">Заявка принята</p><div class="warn-box">Номер ' + esc(res.id) + '. ' + esc(res.note) + '</div><button class="btn" type="button" data-modal-close>Закрыть</button></div>';
        var done = $('[data-modal-close]', $('#inquiryResult', root));
        if (done) done.focus();
      }).catch(function (err) { toast(err.message); });
    };
  };
  pages.accountSettings = function () {
    return window.CarvicAccount.settings().then(function (s) {
      return '<div class="page" id="settingsPage"><h1>Настройки</h1>' + accountNav() +
        '<form class="card form" id="settingsForm"><h2 class="card__title">Контакт</h2>' +
        '<div class="field"><label>E-mail</label><input value="' + esc(s.email || '') + '" disabled></div>' +
        '<div class="field"><label>Филиал</label><input value="' + esc(s.branchNote) + '" disabled></div>' +
        '<div class="field"><label>Тип</label><input value="' + esc(s.userType) + '" disabled></div>' +
        '<div class="field"><label>Организация</label><input value="' + esc(s.organizationNote) + '" disabled></div>' +
        '<div class="field"><label>Телефон</label><input value="' + esc(s.phone) + '" disabled></div>' +
        '<p class="muted">' + esc(s.phoneNote) + '</p>' +
        '<div class="field"><label for="setName">Контактное лицо</label><input id="setName" value="' + esc(s.contactName) + '" maxlength="80"></div>' +
        '<h2 class="card__title">Уведомления</h2><p class="muted">Служебные уведомления о заказе и поступлении не требуют согласия на рекламу. Рекламный прайс — только с отдельной отметкой. Все отметки по умолчанию выключены. ' + esc(s.note) + '</p>' +
        '<label><input type="checkbox" id="setOrder"' + (s.notifyOrder ? ' checked' : '') + '> О новых заказах <span class="muted">рассылка не подключена</span></label>' +
        '<label><input type="checkbox" id="setArrival"' + (s.notifyArrival ? ' checked' : '') + '> О поступлениях <span class="muted">рассылка не подключена</span></label>' +
        '<label><input type="checkbox" id="setDaily"' + (s.dailyPrice ? ' checked' : '') + '> Ежедневный прайс <span class="muted">рассылка не подключена</span></label>' +
        '<label class="check"><input type="checkbox" id="setAds"> Я даю <a href="#/legal/consent-ads" target="_blank" rel="noopener">согласие на получение рекламы и обработку моих персональных данных для рассылок</a>. Отписаться можно в любой момент</label>' +
        '<p><button class="btn btn--ghost" type="button" data-withdraw="consent-ads">Отозвать согласие на рекламу</button> <button class="btn btn--ghost" type="button" data-withdraw="consent-garage">Отозвать согласие на гараж</button> <button class="btn btn--ghost" type="button" data-withdraw="consent-request">Отозвать согласие на обращения</button></p>' +
        '<label class="sel">Склады<select id="setScope"><option value="local"' + (s.priceScope === 'local' ? ' selected' : '') + '>Локальный склад</option><option value="all"' + (s.priceScope === 'all' ? ' selected' : '') + '>Все склады</option></select></label>' +
        '<p class="muted" id="priceFileNote">Файла прайса нет, выбор формата и скачивание скрыты.</p>' +
        '<button class="btn" type="submit">Сохранить предпочтения</button></form>' +
        '<p><button class="btn btn--ghost" id="settingsOut" type="button">Выйти</button></p></div>';
    }).catch(function () {
      return '<div class="page" id="settingsPage"><h1>Настройки</h1><div class="card empty">Вход не выполнен. <a href="#/account">Открыть кабинет</a></div></div>';
    });
  };
  pages.accountSettings.after = function (root) {
    var form = $('#settingsForm', root);
    if (form) form.onsubmit = function (e) {
      e.preventDefault();
      window.CarvicAccount.saveSettings({
        contactName: $('#setName', root).value,
        notifyOrder: $('#setOrder', root).checked,
        notifyArrival: $('#setArrival', root).checked,
        dailyPrice: $('#setDaily', root).checked,
        priceScope: $('#setScope', root).value,
        priceFormat: 'xlsx',
        acceptAds: $('#setAds', root).checked
      }).then(function (res) { toast(res.emailSent ? 'Письмо отправлено' : 'Предпочтения записаны. Письма не отправлялись.'); }).catch(function (err) { toast(err.message); });
    };
    $$('[data-withdraw]', root).forEach(function (btn) {
      btn.onclick = function () {
        window.CarvicAccount.withdrawConsent(btn.getAttribute('data-withdraw')).then(function () { toast('Отзыв записан в журнал согласий'); }).catch(function (err) { toast(err.message); });
      };
    });
    var out = $('#settingsOut', root);
    if (!out) return;
    out.onclick = function () {
      window.CarvicAccount.logout().then(function () { state.buyer = null; state.wholesale = null; state.act = null; state.serverQty = null; renderBuyer(); renderCartCount(); location.hash = '#/account'; }).catch(function (err) { toast(err.message); });
    };
  };
  pages.priceList = function () {
    return Promise.resolve('<div class="page" id="pricePage"><h1>Прайс</h1><div class="card" id="priceMissing"><p>Файла прайса пока нет. Выбор формата и скачивание скрыты.</p><p class="muted">Когда файл появится, его можно будет отдать отсюда. Сейчас кнопка скачивания не показывается.</p></div></div>');
  };
  var LEGAL_FILES = {
    oferta: ['/legal/oferta.md', 'Оферта для розничных покупателей', ''],
    'oferta-opt': ['/legal/oferta-opt.md', 'Условия поставки для оптовых покупателей', ''],
    terms: ['/legal/terms.md', 'Пользовательское соглашение', ''],
    privacy: ['/legal/privacy.md', 'Политика обработки персональных данных', ''],
    'consent-request': ['/legal/consents.md', 'Согласие на обращение', 'Согласие № 1'],
    'consent-garage': ['/legal/consents.md', 'Согласие на данные автомобиля', 'Согласие № 2'],
    'consent-ads': ['/legal/consents.md', 'Согласие на рассылки', 'Согласие № 3'],
    'consent-cookies': ['/legal/consents.md', 'Согласие на аналитические cookie', 'Согласие № 4'],
    'consent-review': ['/legal/consents.md', 'Согласие на публикацию отзыва', 'Согласие № 5']
  };
  function legalSlice(text, marker) {
    if (!marker) return text;
    var start = text.indexOf(marker);
    if (start < 0) return text;
    var rest = text.slice(start + marker.length);
    var next = rest.search(/\n# Согласие № /);
    return text.slice(start, next < 0 ? text.length : start + marker.length + next);
  }
  function legalGapBox(report) {
    var fields = report && report.fields || [];
    if (!fields.length) return '';
    return '<div class="warn-box" id="legalGaps"><b>Черновик.</b> ' + esc(report.warning) + '<ul class="legal-gaps">' + fields.map(function (item) {
      return '<li><span class="mono">' + esc(item.file) + ':' + item.line + '</span> [' + esc(item.field) + ']</li>';
    }).join('') + '</ul></div>';
  }
  pages.legalDoc = function (kind) {
    if (state.consentPreK3 && (kind === 'oferta' || kind === 'oferta-opt' || !LEGAL_FILES[kind])) return pages.notfound();
    var spec = LEGAL_FILES[kind] || LEGAL_FILES.oferta;
    return Promise.all([
      fetch(spec[0]).then(function (r) { return r.text(); }),
      fetch('/api/legal/placeholders', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).catch(function () { return { fields: [] }; })
    ]).then(function (pair) {
      return '<div class="page" id="legalDoc"><div class="crumbs"><a href="#/">Главная</a> / <span>' + esc(spec[1]) + '</span></div><h1>' + esc(spec[1]) + '</h1>' +
        '<div class="warn-box">проект, на согласовании</div>' + legalGapBox(pair[1]) + '<article class="card legal-doc">' + esc(legalSlice(pair[0], spec[2])) + '</article></div>';
    });
  };
  function publishedPage(path, id) {
    return fetch(path, { headers: { Accept: 'application/json' } }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok || !data.html) return '<div class="page"><h1>Страница не найдена</h1><a class="btn" href="#/">На главную</a></div>';
        return '<div class="page page-copy" id="' + id + '">' + data.html + '</div>';
      });
    }).catch(function () {
      return '<div class="page"><h1>Страница не найдена</h1><a class="btn" href="#/">На главную</a></div>';
    });
  }
  pages.returns = function () {
    if (state.pageReturns) return publishedPage('/api/pages/returns', 'returnsPage');
    return Promise.resolve('<div class="page" id="returnsPage"><h1>Возврат</h1><div class="warn-box">проект, на согласовании</div>' +
      '<div class="card"><p>Заявка в кабинете не единственный способ. Товар можно вернуть в любом из трёх магазинов CARVIC.</p>' + storeCards() +
      '<p>По покупкам в магазине — на любой из трёх точек CARVIC.</p>' + (state.consentPreK3 ? '' : '<p><a href="#/legal/oferta">Розничная оферта</a> · <a href="#/legal/oferta-opt">Условия для опта</a></p>') + '</div></div>');
  };
  pages.delivery = function () {
    return publishedPage('/api/pages/delivery', 'deliveryPage');
  };
  pages.notfound = function () { return Promise.resolve('<div class="page"><h1>Страница не найдена</h1><a class="btn" href="#/">На главную</a></div>'); };

  /* --- Личный кабинет покупателя (демо, если сервер включил CARVIC_DEMO_ACCOUNTS) --- */
  function accountNav() {
    return (state.act ? '<div class="warn-box" id="actBanner"><b>Служебный просмотр.</b> Сотрудник ' + esc(state.act.actorName || state.act.actorLogin) + '. Это не вход клиента. ' + (state.act.segment === 'wholesale' ? 'Гараж и профиль закрыты.' : 'Оплата, корзина, гараж и профиль закрыты.') + ' <button type="button" id="stopAct">Завершить просмотр</button></div>' : '') +
      '<nav class="account-nav"><a href="#/account">Профиль</a><a href="#/notebook">Блокнот</a><a href="#/account/garage">Гараж</a><a href="#/account/orders">Заказы</a><a href="#/account/wholesale-returns">Возвраты</a><a href="#/account/balance">Баланс</a><a href="#/account/settings">Настройки</a><a href="#/cart">Корзина</a><a href="#/checkout">Оформление</a></nav>';
  }
  function demoBanner(text) {
    if (!state.demoUi) return '';
    if (!state.demoAccounts) return '';
    return '<p class="demo-note" data-account-demo><span class="demo-badge">демо</span> ' + text + '</p>';
  }
  function limitPhrase(days, minor) {
    var head = 'Отсрочка: ' + days + ' дн., ';
    if (!minor) return head + 'предоплата или оплата при получении';
    var rub = minor / 100;
    return head + 'лимит ' + rub.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽';
  }
  function loadFeedProduct(id) {
    var call = state.wholesale && window.CarvicAccount
      ? window.CarvicAccount.feedProduct(id)
      : fetch('/api/feed/product?id=' + encodeURIComponent(id), { headers: { Accept: 'application/json' } }).then(function (r) {
        return r.json().then(function (data) { if (!r.ok) throw new Error(data.message || 'нет'); return data; });
      });
    return call.then(function (data) { return data.product; }).catch(function () { return null; });
  }
  function notebookCard(product, id) {
    if (!product) return '<article class="feed-card"><p>Позиция больше не на витрине.</p><button type="button" class="btn btn--ghost" data-notebook-remove="' + esc(id) + '">Удалить</button></article>';
    var anyHere = product.stock && C.stores.some(function (store) { return Number(product.stock[store.id]) > 0; });
    var badge = product.stock ? '<p><span class="status-badge ' + (anyHere ? 'status-badge--ok' : 'status-badge--wait') + '">' + (anyHere ? 'В наличии' : 'Нет в наличии') + '</span></p>' : '';
    var action = product.price && product.price.request
      ? feedOrderAction(product, false)
      : '<input class="feed-qty" data-feed-qty type="number" min="1" step="1" value="1" inputmode="numeric" aria-label="Количество">' + feedOrderAction(product, false);
    return '<article class="feed-card" data-feed-id="' + esc(product.id) + '"><h3><a href="#/feed/' + encodeURIComponent(product.id) + '">' + esc(product.name) + '</a></h3><p class="sku-tag">' + esc(product.article || 'без артикула') + '</p><p>' + esc(product.brand || '') + '</p><div class="price">' + esc(product.price && product.price.label || 'цена по запросу') + '</div>' + badge + feedStock(product) + '<div class="feed-buy">' + action + '<button type="button" class="btn btn--ghost" data-notebook-remove="' + esc(product.id) + '">Удалить</button></div></article>';
  }
  pages.notebook = function () {
    function draw(ids) {
      saveNotebookLocal(ids);
      if (!ids.length) return Promise.resolve('<div class="page" id="notebookPage"><div class="crumbs"><a href="#/account">Кабинет</a> / <span>Блокнот</span></div><h1>Блокнот</h1><div class="card empty">В блокноте пусто. Кнопка «В блокнот» есть в поиске, каталоге и на карточке.</div></div>');
      return Promise.all(ids.map(loadFeedProduct)).then(function (products) {
        return '<div class="page" id="notebookPage"><div class="crumbs"><a href="#/account">Кабинет</a> / <span>Блокнот</span></div><h1>Блокнот</h1><p class="muted">Цена и остаток берутся с витрины сейчас. В кабинете хранятся только номера позиций.</p>' + products.map(function (product, i) { return notebookCard(product, ids[i]); }).join('') + '</div>';
      });
    }
    if (state.buyer && window.CarvicAccount && window.CarvicAccount.notebook) {
      return window.CarvicAccount.notebook().then(function (data) {
        var merged = (data.ids || []).slice();
        notebookLocal().forEach(function (id) { if (merged.indexOf(id) === -1) merged.push(id); });
        if (merged.length !== (data.ids || []).length) return window.CarvicAccount.saveNotebook(merged).then(function (saved) { return draw(saved.ids || merged); });
        return draw(merged);
      }).catch(function () { return draw(notebookLocal()); });
    }
    return draw(notebookLocal());
  };
  pages.notebook.after = function (root) {
    bindFeedAdd(root);
    $$('[data-notebook-remove]', root).forEach(function (btn) {
      btn.onclick = function () {
        var id = btn.getAttribute('data-notebook-remove');
        var next = notebookLocal().filter(function (item) { return item !== id; });
        function done() { saveNotebookLocal(next); route(); }
        if (state.buyer && window.CarvicAccount && window.CarvicAccount.saveNotebook) window.CarvicAccount.saveNotebook(next).then(done).catch(function (err) { toast(err.message); });
        else done();
      };
    });
  };
  /* Форма входа покупателя: на странице кабинета и в окне «Войти» из шапки.
   * null — вход не подключён на сервере. */
  function loginBlock(st) {
    if (!st.demo && st.smsLogin) {
      return '<form class="card form" id="accForm"><div class="field"><label for="accPhone">Телефон</label><input id="accPhone" inputmode="numeric" autocomplete="username" placeholder="+7 9XX XXX-XX-XX"></div>' +
        '<button class="btn btn--ghost" id="accSend" type="button">Получить код</button>' +
        '<div class="field"><label for="accCode">Код из SMS</label><input id="accCode" inputmode="numeric" autocomplete="one-time-code"></div>' +
        '<button class="btn btn--lg">Войти</button><p class="muted">Если номер подходит, код отправлен.</p></form>';
    }
    if (!st.demo) return null;
    return demoBanner('Учебный вход только при включённом демо-режиме сервера. Это не боевой пароль и не SMS.') +
      '<form class="card form" id="accForm"><div class="field"><label for="accPhone">Телефон</label><input id="accPhone" inputmode="numeric" autocomplete="username" placeholder="+7 9XX XXX-XX-XX"></div>' +
      '<div class="field"><label for="accCode">Код демо-входа</label><input id="accCode" autocomplete="current-password" value="demo"></div>' +
      '<button class="btn btn--lg">Войти</button><p class="muted">Без флага демо-кабинета этот код не принимается.</p></form>';
  }
  function bindLoginForm(root, onDone) {
    var sendCode = $('#accSend', root);
    if (sendCode) sendCode.onclick = function () {
      window.CarvicAccount.requestLoginCode($('#accPhone', root).value).then(function () {
        toast('Если номер подходит, код отправлен.');
      }).catch(function (err) { toast(err.message); });
    };
    var form = $('#accForm', root);
    if (form) form.onsubmit = function (e) {
      e.preventDefault();
      var chosen = $('#accClient', root);
      window.CarvicAccount.login($('#accPhone', root).value, $('#accCode', root).value, chosen ? chosen.value : '').then(function (res) {
        if (res.choose) {
          var box = document.createElement('label');
          box.className = 'sel';
          box.innerHTML = 'Оптовик <select id="accClient">' + res.clients.map(function (item) { return '<option value="' + esc(item.id) + '">' + esc(item.name) + '</option>'; }).join('') + '</select>';
          form.appendChild(box);
          toast('Этим номером пользуются несколько оптовиков. Выберите карточку и войдите ещё раз.');
          return;
        }
        state.buyer = res.account || null;
        state.wholesale = res.wholesale || null;
        renderBuyer();
        return mergeGuestIntoServerCart().then(function () { return mergeGuestNotebook(); }).then(function () { return refreshBuyerSession(); }).then(function () { (onDone || route)(); });
      }).catch(function (err) { toast(err.message); });
    };
  }
  pages.account = function () {
    var A = window.CarvicAccount;
    return A.status().then(function (st) {
      state.demoAccounts = Boolean(st.demoAccounts);
      state.hideLocalDbNote = Boolean(st.hideLocalDbNote);
      if (!st.available) {
        return '<div class="page"><h1>Личный кабинет</h1><div class="card"><p>' + esc(st.note) + '</p><p class="muted">Карта, СБП, баланс и история покупок в этом режиме недоступны. Это не ошибка входа.</p></div></div>';
      }
      return A.me().then(function (me) {
        state.buyer = me.account;
        state.act = me.act && me.act.active ? me.act : null;
        var wholesaleCabinet = me.staffCabinet && me.staffCabinet.segment === 'wholesale';
        return '<div class="page"><div class="crumbs"><a href="#/">Главная</a> / <span>Кабинет</span></div><h1>Личный кабинет</h1>' + accountNav() +
          demoBanner(esc(st.note)) +
          '<div class="account-grid"><section class="card" id="staffProfile"><h2 class="card__title">Профиль</h2>' + (me.staffCabinet
            ? '<p><b>' + esc(me.account.name) + '</b> · ' + esc(me.staffCabinet.segment === 'wholesale' ? 'опт' : 'розница') + '</p><p class="muted">' + esc(me.staffCabinet.note) + '</p><p>' + (me.staffCabinet.terms ? esc(limitPhrase(me.staffCabinet.terms.days, me.staffCabinet.terms.limitMinor)) : 'Отсрочка не задана') + '. Доступный кредит не вычислен. Долг из 1С не прочитан.</p><p><a href="#/account/orders">Заказы</a> · <a href="#/account/balance">Взаиморасчёты</a></p>' +
              (wholesaleCabinet ? '<p id="cabinetDocs">' + (state.consentPreK3 ? '' : '<a href="#/legal/oferta-opt">Условия поставки для оптовых покупателей</a> · ') + '<a href="#/legal/terms">Пользовательское соглашение</a> · <a href="#/legal/privacy">Политика обработки персональных данных</a></p>' : '')
            : (me.wholesale ? '<p id="wholesaleTerms"><b>' + esc(me.wholesale.name) + '</b> · ' + esc(me.wholesale.priceKindName) + '</p><p>' + esc(limitPhrase(me.wholesale.days, me.wholesale.limitMinor)) + '</p><p><a href="#/account/orders">Заказы</a> · <a href="#/account/wholesale-returns">Возвраты</a></p>' : '') + (me.privacyEmail ? '<p id="privacyContact">Запросы по персональным данным: <a href="mailto:' + esc(me.privacyEmail) + '">' + esc(me.privacyEmail) + '</a></p>' : '') + '<form class="card form" id="deleteForm"><h2 class="card__title">Удалить кабинет</h2><p class="muted">Имя, телефон, почта и гараж обезличиваются. Заказы и журнал остаются. Код приходит только если SMS-транспорт подключён.</p><button class="btn btn--ghost" id="deleteAsk" type="button">Прислать код</button><div class="field"><label for="deleteCode">Код</label><input id="deleteCode" inputmode="numeric" autocomplete="one-time-code"></div><button class="btn" id="deleteConfirm" type="button">Удалить кабинет</button><p id="deleteNote"></p></form><form class="form" id="profileForm"><div class="field"><label for="pfName">Имя</label><input id="pfName" value="' + esc(me.account.name) + '" maxlength="80"' + (me.act && me.act.active ? ' disabled' : '') + '></div><div class="field"><label for="pfMail">E-mail</label><input id="pfMail" type="email" value="' + esc(me.account.email || '') + '" maxlength="120"' + (me.act && me.act.active ? ' disabled' : '') + '></div><p class="muted">Телефон входа: ' + esc(me.account.phone) + '. Его нельзя сменить с этой формы. Организация и филиал появятся только из 1С.</p><button class="btn" type="submit"' + (me.act && me.act.active ? ' disabled' : '') + '>Сохранить</button></form>' + (state.hideLocalDbNote ? '' : '<p class="muted">Записи этого кабинета лежат в локальной базе сервера. Это не боевая база и не 1С.</p>')) + '</section>' +
          '<section class="card"><h2 class="card__title">Баланс</h2><p class="price" style="text-align:left;font-size:28px">' + (me.balance ? esc(A.rub(me.balance)) : 'нет данных') + '</p><p class="muted">' + (me.staffCabinet ? 'Источник взаиморасчётов недоступен.' : (state.demoAccounts ? 'Демо-баланс на сервере. Это не деньги на счёте и не взаиморасчёты из 1С.' : 'Взаиморасчёты из 1С не подключены.')) + '</p><a class="btn btn--ghost" href="#/account/balance">История операций</a></section></div>' +
          '<p><button class="btn btn--ghost" id="accLogout" type="button">Выйти</button></p></div>';
      }).catch(function () {
        var block = loginBlock(st);
        if (!block) return '<div class="page"><h1>Вход в кабинет</h1><div class="card"><p>Боевой вход не подключён.</p><p><a href="#/notebook">Блокнот</a></p></div></div>';
        return '<div class="page"><h1>Вход в кабинет</h1>' + block + '<p><a href="#/notebook">Блокнот</a></p></div>';
      });
    }).catch(function () {
      return '<div class="page"><h1>Личный кабинет</h1><div class="card">Сервер кабинета не ответил. Запустите <span class="mono">node server/index.js</span>.</div></div>';
    });
  };
  /* Вход в личный кабинет — окно из иконки в шапке. Один вход для покупателей,
   * автосервисов и оптовиков; регистрация контрагента — отдельной ссылкой. */
  pages.signin = function () {
    var A = window.CarvicAccount;
    var head = '<div id="signinPage"><h2 class="modal__title" id="modalTitle">Вход в личный кабинет</h2>' +
      '<p class="modal__lead">Один вход для покупателей, автосервисов и оптовиков — по номеру телефона.</p>';
    var foot = '<div class="signin-alt"><p>Нет кабинета? <a href="#/register">Зарегистрироваться</a></p>' +
      '<p>Оптовик или автосервис? <a href="#/login">Регистрация контрагента</a></p></div></div>';
    return A.status().then(function (st) {
      state.demoAccounts = Boolean(st.demoAccounts);
      if (!st.available) return head + '<div class="warn-box">' + esc(st.note || 'Личный кабинет временно недоступен.') + '</div>' + foot;
      return A.me().then(function () {
        return head + '<p>Вы уже вошли.</p><a class="btn" href="#/account">Открыть кабинет</a></div>';
      }).catch(function () {
        var block = loginBlock(st);
        return head + (block || '<div class="warn-box">Вход по SMS ещё не подключён. Позвоните нам: <a href="tel:' + C.phoneHref + '">' + C.phone + '</a></div>') + foot;
      });
    }).catch(function () {
      return head + '<div class="warn-box">Сервер кабинета не ответил. Попробуйте позже.</div>' + foot;
    });
  };
  pages.signin.after = function (root) {
    bindLoginForm(root, function () { location.hash = '#/account'; });
  };
  /* Регистрация покупателя — окно (#/register). Отправка: POST /api/account/register.
   * Пока сервер этот адрес не знает (404/405/501), данные уходят менеджеру
   * заявкой через /api/inquiries — чтобы регистрация не терялась. */
  pages.register = function () {
    return Promise.resolve('<div id="registerPage"><h2 class="modal__title" id="modalTitle">Регистрация</h2>' +
      '<p class="modal__lead">Личный кабинет: история заказов, гараж, блокнот и быстрый повтор покупок.</p>' +
      '<form class="form inq-form" id="regForm" novalidate>' +
      '<div class="field"><label for="regFirst">Имя</label><input id="regFirst" maxlength="60" autocomplete="given-name" required></div>' +
      '<div class="field"><label for="regLast">Фамилия</label><input id="regLast" maxlength="60" autocomplete="family-name"></div>' +
      '<div class="field"><label for="regPhone">Телефон</label><input id="regPhone" inputmode="tel" maxlength="18" autocomplete="tel" placeholder="+7" required></div>' +
      '<div class="field"><label for="regEmail">E-mail</label><input id="regEmail" type="email" maxlength="120" autocomplete="email"></div>' +
      '<p class="reg-sub">Автомобиль <span>— необязательно. Сохраним в «Гараж», чтобы подбирать детали под эту машину</span></p>' +
      '<div class="field"><label for="regCar">Марка и модель</label><input id="regCar" maxlength="80" placeholder="Например, Toyota Corolla 2014"></div>' +
      '<div class="field"><label for="regVin">VIN или номер кузова</label><input id="regVin" maxlength="20" autocomplete="off" spellcheck="false" placeholder="17 символов VIN"></div>' +
      '<label class="check" id="regGarageRow" hidden><input type="checkbox" id="regGarage"> Сохранить автомобиль в «Гараже». <a href="#/legal/consent-garage" target="_blank" rel="noopener">Согласие на обработку данных автомобиля</a></label>' +
      '<label class="check"><input type="checkbox" id="regTerms"> Принимаю <a href="#/legal/terms" target="_blank" rel="noopener">Пользовательское соглашение</a></label>' +
      '<label class="check"><input type="checkbox" id="regPd"> Ознакомлен с <a href="#/legal/privacy" target="_blank" rel="noopener">Политикой обработки персональных данных</a> и даю <a href="#/legal/consent-request" target="_blank" rel="noopener">согласие на их обработку</a></label>' +
      '<label class="check"><input type="checkbox" id="regAds"> Согласен получать <a href="#/legal/consent-ads" target="_blank" rel="noopener">информационные и рекламные рассылки</a></label>' +
      '<div class="field" style="position:absolute;left:-9999px" aria-hidden="true"><label>Компания<input id="regCompany" tabindex="-1" autocomplete="off"></label></div>' +
      '<p class="reg-err" id="regErr" role="alert" hidden></p>' +
      '<button class="btn" type="submit">Зарегистрироваться</button></form>' +
      '<div id="regResult"></div>' +
      '<p class="signin-alt" id="regAlt">Уже есть кабинет? <a href="#/signin">Войти</a></p></div>');
  };
  pages.register.after = function (root) {
    var form = $('#regForm', root);
    if (!form) return;
    function fail(text, el) {
      var box = $('#regErr', root);
      box.textContent = text; box.hidden = false;
      if (el) el.focus();
    }
    function done(title, text) {
      form.hidden = true;
      $('#regAlt', root).hidden = true;
      var lead = $('.modal__lead', root);
      if (lead) lead.hidden = true;
      $('#regResult', root).innerHTML = '<div class="inq-done"><span class="inq-done__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><p class="inq-done__title">' + esc(title) + '</p><p class="muted">' + esc(text) + '</p>' +
        '<button class="btn" type="button" data-modal-close>Закрыть</button></div>';
      var btn = $('[data-modal-close]', $('#regResult', root));
      if (btn) btn.focus();
    }
    var carBox = $('#regCar', root), vinBox = $('#regVin', root), garageRow = $('#regGarageRow', root);
    function syncCar() { garageRow.hidden = !(carBox.value.trim() || vinBox.value.trim()); }
    carBox.addEventListener('input', syncCar);
    // исправляет поле — старое сообщение об ошибке убираем
    form.addEventListener('input', function () { $('#regErr', root).hidden = true; });
    form.addEventListener('change', function () { $('#regErr', root).hidden = true; });
    vinBox.addEventListener('input', function () {
      var pos = vinBox.selectionStart;
      vinBox.value = vinBox.value.toUpperCase();
      try { vinBox.setSelectionRange(pos, pos); } catch (err) { /* тип поля без выделения */ }
      syncCar();
    });
    form.onsubmit = function (e) {
      e.preventDefault();
      $('#regErr', root).hidden = true;
      var first = $('#regFirst', root), phone = $('#regPhone', root), email = $('#regEmail', root);
      var digits = phone.value.replace(/\D/g, '');
      if (!first.value.trim()) return fail('Укажите имя.', first);
      if (digits.length < 10 || digits.length > 11) return fail('Укажите телефон: 10 или 11 цифр.', phone);
      if (email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) return fail('Проверьте e-mail.', email);
      var carLabel = carBox.value.trim(), vin = vinBox.value.replace(/\s/g, '').toUpperCase();
      if (vin) {
        if (!/^[A-Z0-9-]{6,20}$/.test(vin)) return fail('VIN или номер кузова: только латинские буквы, цифры и дефис, от 6 до 20 символов.', vinBox);
        if (vin.length === 17 && vin.indexOf('-') < 0 && /[IOQ]/.test(vin)) return fail('В VIN не используются буквы I, O и Q — проверьте, может быть, это цифры 1 и 0.', vinBox);
      }
      if ((carLabel || vin) && !$('#regGarage', root).checked) return fail('Чтобы сохранить автомобиль, отметьте согласие для «Гаража» — или очистите поля автомобиля.', $('#regGarage', root));
      if (!$('#regTerms', root).checked) return fail('Нужно принять Пользовательское соглашение.', $('#regTerms', root));
      if (!$('#regPd', root).checked) return fail('Нужно согласие на обработку персональных данных.', $('#regPd', root));
      var body = {
        firstName: first.value.trim(), lastName: $('#regLast', root).value.trim(), phone: phone.value.trim(), email: email.value.trim(),
        acceptTerms: true, consentRequest: true, acceptAds: $('#regAds', root).checked, company: $('#regCompany', root).value,
        car: (carLabel || vin) ? { label: carLabel, vin: vin, consentGarage: true } : null
      };
      var submit = $('button[type="submit"]', form);
      submit.disabled = true;
      window.CarvicAccount.register(body).then(function (res) {
        done('Готово', (res && res.note) || ('Кабинет создан' + (body.car ? ', автомобиль сохранён в «Гараже»' : '') + '. Войдите по номеру телефона — придёт код в SMS.'));
      }).catch(function (err) {
        if (!(err && (err.status === 404 || err.status === 405 || err.status === 501 || (err.code === 'network' && !err.status)))) {
          submit.disabled = false;
          return fail(err && err.message ? err.message : 'Не удалось отправить. Попробуйте ещё раз.');
        }
        // сервер ещё не умеет регистрировать — передаём менеджеру заявкой
        var name = (body.firstName + ' ' + body.lastName).trim();
        return window.CarvicAccount.sendInquiry({
          kind: 'contact', name: name, contact: body.phone + (body.email ? ', ' + body.email : ''),
          message: 'Заявка на регистрацию в личном кабинете. ' + (body.email ? 'E-mail: ' + body.email + '. ' : '') +
            (body.car ? 'Автомобиль для «Гаража»: ' + (body.car.label || 'без названия') + (body.car.vin ? ', VIN/кузов ' + body.car.vin : '') + ' (согласие на «Гараж» дано). ' : '') +
            'Пользовательское соглашение: принято. Рассылки: ' + (body.acceptAds ? 'согласен' : 'нет') + '.',
          article: '', vin: body.car && body.car.vin.length === 17 ? body.car.vin : '', company: body.company, consentRequest: true
        }).then(function () {
          done('Заявка принята', 'Менеджер создаст кабинет' + (body.car ? ', добавит автомобиль в «Гараж»' : '') + ' и сообщит вам. Потом вход — по номеру телефона и коду из SMS.');
        }).catch(function () {
          submit.disabled = false;
          fail('Не удалось отправить. Позвоните нам: ' + C.phone + '.');
        });
      });
    };
  };
  pages.account.after = function (root) {
    bindLoginForm(root);
    var out = $('#accLogout', root);
    if (out) out.onclick = function () { window.CarvicAccount.logout().then(function () { state.buyer = null; state.wholesale = null; state.serverQty = null; renderBuyer(); renderCartCount(); route(); }); };
    var askDelete = $('#deleteAsk', root);
    if (askDelete) askDelete.onclick = function () {
      window.CarvicAccount.requestDeletion().then(function () {
        $('#deleteNote', root).textContent = 'Если транспорт подключён, код отправлен. В письме и на экране код не показывается.';
      }).catch(function (err) { $('#deleteNote', root).textContent = err.message; });
    };
    var confirmDelete = $('#deleteConfirm', root);
    if (confirmDelete) confirmDelete.onclick = function () {
      window.CarvicAccount.confirmDeletion($('#deleteCode', root).value).then(function () {
        state.buyer = null;
        toast('Кабинет обезличен');
        location.hash = '#/';
      }).catch(function (err) { $('#deleteNote', root).textContent = err.message; });
    };
    var profile = $('#profileForm', root);
    if (profile) profile.onsubmit = function (e) {
      e.preventDefault();
      window.CarvicAccount.saveProfile({ name: $('#pfName', root).value, email: $('#pfMail', root).value }).then(function () { return refreshBuyerSession(); }).then(function () { toast('Профиль сохранён на сервере'); route(); }).catch(function (err) { toast(err.message); });
    };
  };
  function opt(value, current, label) {
    return '<option value="' + esc(value) + '"' + (String(current || 'any') === String(value) ? ' selected' : '') + '>' + esc(label) + '</option>';
  }
  pages.accountGarage = function () {
    return window.CarvicAccount.garage().then(function (data) {
      var rows = (data.vehicles || []).map(function (car) {
        return '<li class="line-card"><b>' + esc(car.label) + '</b><div>' + (state.demoUi ? (car.vin ? 'VIN ' + esc(car.vin) : 'Без VIN') : '') + '</div><button class="btn btn--ghost" type="button" data-drop-car="' + esc(car.id) + '">Удалить</button></li>';
      }).join('');
      return '<div class="page"><h1>Гараж</h1>' + accountNav() + demoBanner(esc(data.note)) +
        '<form class="card form" id="garageForm"><div class="field"><label for="carLabel">Название</label><input id="carLabel" maxlength="80" placeholder="Например, служебный седан"></div>' + (state.demoUi ? '<div class="field"><label for="carVin">VIN, если есть</label><input id="carVin" maxlength="17" autocomplete="off"></div>' : '') +
        '<label class="check"><input type="checkbox" id="garageConsent"> Сохранить автомобиль в «Гараже». <a href="#/legal/consent-garage" target="_blank" rel="noopener">Согласие на обработку данных автомобиля</a></label>' +
        '<button class="btn" type="submit">Сохранить автомобиль</button></form>' +
        '<ul class="line-cards" id="garageList" style="display:flex">' + (rows || '<li class="empty">В гараже пусто. Сохранение не подбирает запчасти.</li>') + '</ul></div>';
    }).catch(function (err) { return '<div class="page"><h1>Гараж</h1><div class="card">' + esc(err.message) + ' <a href="#/account">Войти</a></div></div>'; });
  };
  pages.accountGarage.after = function (root) {
    var form = $('#garageForm', root);
    if (!form) return;
    form.onsubmit = function (e) {
      e.preventDefault();
      var vinBox = $('#carVin', root);
      window.CarvicAccount.addGarage({ label: $('#carLabel', root).value, vin: vinBox ? vinBox.value : '', consentGarage: $('#garageConsent', root).checked }).then(function () { toast('Автомобиль сохранён. OEM по нему не подбирается.'); route(); }).catch(function (err) { toast(err.message); });
    };
    $$('[data-drop-car]', root).forEach(function (btn) {
      btn.onclick = function () { window.CarvicAccount.removeGarage(btn.dataset.dropCar).then(function () { route(); }).catch(function (err) { toast(err.message); }); };
    });
  };
  pages.accountWholesaleReturns = function () {
    return window.CarvicAccount.wholesaleReturns().then(function (data) {
      var rows = (data.requests || []).map(function (row) {
        return '<li><b>' + esc(row.id) + '</b> <span>' + esc(row.statusLabel) + '</span> <span>' + esc(row.reasonLabel) + '</span> <span>заказ ' + esc(row.orderId) + '</span> <span>' + esc(row.outletName || '') + '</span>' +
          (row.decisionReason ? '<span>причина решения: ' + esc(row.decisionReason) + '</span>' : '') + '</li>';
      }).join('');
      return '<div class="page"><h1>Возвраты</h1>' + accountNav() + '<ul class="board" id="myReturns">' + (rows || '<li class="empty">Заявок нет.</li>') + '</ul></div>';
    }).catch(function (err) { return '<div class="page"><h1>Возвраты</h1><div class="card">' + esc(err.message) + '</div></div>'; });
  };
  pages.accountOrders = function () {
    var q = currentRoute();
    var query = (q && q.params) || {};
    return window.CarvicAccount.orders(query).then(function (data) {
      var rows = (data.orders || []).map(function (o) {
        return '<tr><td><a href="#/account/orders/' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a></td><td>' + esc(o.createdAt.slice(0, 10)) + '</td><td>' + esc(o.statusLabel) + '</td><td>' + esc(o.fulfillmentLabel || '—') + '</td><td>' + esc(o.payment.methodLabel) + ' · ' + esc(o.payment.statusLabel) + '</td><td>' + esc(window.CarvicAccount.rub(o.total)) + '</td><td>' + (o.returnable && o.lines.some(function (l) { return l.issued; }) ? '<a href="#/account/orders/' + encodeURIComponent(o.id) + '">Оформить возврат</a>' : '') + '</td></tr>';
      }).join('');
      var cards = (data.orders || []).map(function (o) {
        return '<a class="order-card" href="#/account/orders/' + encodeURIComponent(o.id) + '"><b>' + esc(o.id) + '</b><span>' + esc(o.createdAt.slice(0, 10)) + '</span><span>' + esc(o.statusLabel) + '</span><span>' + esc(o.fulfillmentLabel || '—') + '</span><span>' + esc(o.payment.methodLabel) + ' · ' + esc(o.payment.statusLabel) + '</span><b>' + esc(window.CarvicAccount.rub(o.total)) + '</b></a>';
      }).join('');
      var board = (data.board || []).map(function (row) {
        var target = row.orderId ? '#/account/orders/' + encodeURIComponent(row.orderId) : '#/account/orders';
        return '<li><b>' + esc(row.label) + '</b><span>' + esc(row.when) + '</span><span>' + esc(row.sku || '') + '</span><a href="' + target + '">' + esc(row.orderId || 'К заказам') + '</a></li>';
      }).join('');
      var page = data.page || 1;
      var prev = page > 1 ? '<a class="btn btn--ghost" href="#/account/orders?status=' + encodeURIComponent(query.status || 'any') + '&from=' + encodeURIComponent(query.from || '') + '&to=' + encodeURIComponent(query.to || '') + '&q=' + encodeURIComponent(query.q || '') + '&page=' + (page - 1) + '">Назад</a>' : '';
      var next = page < (data.pages || 1) ? '<a class="btn btn--ghost" href="#/account/orders?status=' + encodeURIComponent(query.status || 'any') + '&from=' + encodeURIComponent(query.from || '') + '&to=' + encodeURIComponent(query.to || '') + '&q=' + encodeURIComponent(query.q || '') + '&page=' + (page + 1) + '">Дальше</a>' : '';
      return '<div class="page"><h1>Заказы</h1>' + accountNav() + demoBanner(esc(data.note)) +
        '<form class="card admin-bar" id="orderFilter"><label>Статус<select name="status">' + opt('any', query.status || 'any', 'Любой статус') + opt('new', query.status, 'Новый') + opt('in_transit', query.status, 'В пути') + opt('ready_issue', query.status, 'Готово к выдаче') + opt('cancelled', query.status, 'Отменён') + '</select></label>' +
        '<label>Период с<input name="from" type="date" value="' + esc(query.from || '') + '"></label><label>Период по<input name="to" type="date" value="' + esc(query.to || '') + '"></label>' +
        '<label>Поиск<input name="q" value="' + esc(query.q || '') + '" placeholder="Артикул, название или метка"></label><button class="btn">Показать</button></form>' +
        '<p class="muted">Заявка на возврат — черновик правила компании, не оферта. 14 дней не закрывают гарантию, недостаток и ошибку комплектации. Деньги в баланс сами не переводятся. Показано ' + (data.orders || []).length + ' из ' + (data.total || 0) + '.</p>' +
        '<section class="card" id="deliveryBoard"><h2 class="card__title">Табло доставок' + (state.demoAccounts ? ' <span class="demo-badge">демо</span>' : '') + '</h2><p class="muted">' + esc(data.boardNote) + '</p><ul class="board">' + (board || '<li>Записей табло нет.</li>') + '</ul></section>' +
        '<div class="order-cards">' + (cards || '<div class="card empty">Заказов нет. История покупок из 1С не загружена.</div>') + '</div>' +
        '<div class="card tbl-wrap desk-table"><table class="tbl"><thead><tr><th>Номер</th><th>Дата</th><th>Статус</th><th>Выдача</th><th>Оплата</th><th>Сумма</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="6">Заказов нет. История покупок из 1С не загружена.</td></tr>') + '</tbody></table></div>' +
        '<div class="pager">' + prev + next + '</div></div>';
    }).catch(function (err) {
      return '<div class="page"><h1>Заказы</h1><div class="card">' + esc(err.message) + ' <a href="#/account">Войти</a></div></div>';
    });
  };
  pages.accountOrders.after = function (root) {
    var form = $('#orderFilter', root); if (!form) return;
    form.onsubmit = function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var hash = '#/account/orders?status=' + encodeURIComponent(data.get('status') || 'any') + '&from=' + encodeURIComponent(data.get('from') || '') + '&to=' + encodeURIComponent(data.get('to') || '') + '&q=' + encodeURIComponent(data.get('q') || '');
      if (location.hash === hash) route(); else location.hash = hash;
    };
  };
  pages.accountOrder = function (id) {
    return window.CarvicAccount.order(id).then(function (o) {
      var lineRow = function (l) {
        return '<tr><td>' + esc(l.brand) + '</td><td class="mono">' + esc(l.article) + '</td><td>' + esc(l.name) + (l.note ? '<div class="muted">Метка: ' + esc(l.note) + '</div>' : '') + '</td><td>' + l.qty + '</td><td>' + esc(window.CarvicAccount.rub({ amount: l.unitMinor, minorUnit: 100 })) + '</td><td>' + esc(l.lineStatusLabel || l.term) + '</td><td>' + esc(window.CarvicAccount.rub({ amount: l.sumMinor, minorUnit: 100 })) + '</td></tr>';
      };
      var lineCard = function (l) {
        return '<article class="line-card"><b>' + esc(l.brand) + ' ' + esc(l.article) + '</b><div>' + esc(l.name) + '</div><div>' + esc(l.outletName || '') + ' · ' + l.qty + ' шт.</div><div>' + esc(l.lineStatusLabel || l.term) + '</div>' + (l.note ? '<div>Метка: ' + esc(l.note) + '</div>' : '') + '<div>Цена ' + esc(window.CarvicAccount.rub({ amount: l.unitMinor, minorUnit: 100 })) + ' · сумма ' + esc(window.CarvicAccount.rub({ amount: l.sumMinor, minorUnit: 100 })) + '</div></article>';
      };
      var issuedLines = (o.lines || []).filter(function (l) { return l.issued; });
      var openLines = o.returnable ? issuedLines.filter(function (l) { return (l.returnableQty || 0) > 0; }) : [];
      var claimedOut = issuedLines.length > 0 && !openLines.length;
      var wholesaleBuyer = Boolean(state.wholesale);
      var showWholesaleForm = wholesaleBuyer && openLines.length > 0;
      var showRetailForm = !wholesaleBuyer && openLines.length > 0;
      var showReturn = showWholesaleForm || showRetailForm;
      var returnFormId = showWholesaleForm ? 'wholesaleReturn' : 'returnForm';
      return '<div class="page"><div class="crumbs"><a href="#/account/orders">Заказы</a> / <span>' + esc(o.id) + '</span></div><h1>Заказ ' + esc(o.id) + '</h1>' + accountNav() +
        demoBanner('Демонстрационный заказ. В 1С не отправлялся. Состояние оплаты из 1С не читается.') +
        '<div class="card" id="orderDetail"><p>Номер: <b>' + esc(o.id) + '</b><br>Дата: <b id="orderDate">' + esc(o.createdAtIrkutsk || '') + '</b><br>Статус: <b>' + esc(o.statusLabel) + '</b><br>Выдача: <b id="orderFulfillment">' + esc(o.fulfillmentLabel || '') + '</b><br>Готовность: <b>' + esc(o.readinessLabel || '') + '</b><br>Точка выдачи: <b id="orderOutlet">' + esc(o.outletName) + '</b>' + (o.outletAddress ? ', ' + esc(o.outletAddress) : '') + (o.outletHours ? '<br>Часы: ' + esc(o.outletHours) : '') + '<br>Оплата: <b>' + esc(o.payment.methodLabel) + ' · ' + esc(o.payment.statusLabel) + '</b></p>' +
        '<h2>История статусов</h2><ul id="orderHistory">' + (o.history || []).map(function (h) { return '<li>' + esc(h.atIrkutsk) + ' — ' + esc(h.label) + '</li>'; }).join('') + '</ul>' +
        '<div class="line-cards">' + o.lines.map(lineCard).join('') + '</div>' +
        '<div class="tbl-wrap desk-table"><table class="tbl"><thead><tr><th>Бренд</th><th>Артикул</th><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Статус позиции</th><th>Сумма</th></tr></thead><tbody>' +
        o.lines.map(lineRow).join('') + '</tbody></table></div><p>Итого: <b>' + esc(window.CarvicAccount.rub(o.total)) + '</b></p>' +
        '<div class="order-actions"><button class="btn" id="reorderBtn" type="button">Повторить по текущим ценам</button>' +
        (o.cancelable ? '<button class="btn btn--ghost" id="cancelBtn" type="button">Отменить</button>' : '') +
        (showReturn ? '<a class="btn" id="jumpReturn" href="#' + returnFormId + '">Оформить возврат</a>' : '') + '</div>' +
        (showWholesaleForm ? '<form class="card form" id="wholesaleReturn"><h2 class="card__title">Оформить возврат</h2><p class="muted">Точка сдачи по умолчанию — точка выдачи заказа: ' + esc(o.outletName) + '. Фото по желанию, до 5 файлов jpg или png, каждый до 10 МБ.</p>' +
        openLines.map(function (l) { return '<label class="check"><input type="checkbox" data-wsku="' + esc(l.sku) + '"> ' + esc(l.name) + ' · доступно ' + l.returnableQty + ' <input data-wqty="' + esc(l.sku) + '" type="number" min="1" max="' + l.returnableQty + '" value="1"></label>'; }).join('') +
        '<label class="sel">Причина<select id="wReason"><option value="defect">Брак</option><option value="unfit">Не подошло</option><option value="selection">Ошибка подбора</option><option value="other">Другое</option></select></label>' +
        '<label>Комментарий<textarea id="wComment" maxlength="1000" rows="3"></textarea></label>' +
        '<label>Фото <input id="wPhotos" type="file" accept="image/jpeg,image/png" multiple></label>' +
        '<button class="btn" type="submit">Оформить возврат</button></form>' : '') +
        (claimedOut ? '<p class="muted" id="returnClosed">Все выданные позиции уже заявлены на возврат</p>' : '') +
        (showRetailForm ? '<form class="card form" id="returnForm"><h2 class="card__title">Заявка на возврат</h2><p>Если в товаре обнаружен недостаток, срок 14 дней не применяется — выберите тип «Недостаток / гарантия». Вернуть товар можно также в любом магазине CARVIC. <a href="#/returns">Условия возврата</a>. По покупкам в магазине — на любой из трёх точек CARVIC.</p>' +
        '<label class="sel">Позиция<select name="sku">' + openLines.map(function (l) { return '<option value="' + esc(l.sku) + '">' + esc(l.brand) + ' ' + esc(l.article) + '</option>'; }).join('') + '</select></label>' +
        '<label class="sel">Основание<select name="basis"><option value="company_window">Не подошло</option><option value="defect">Недостаток</option><option value="warranty">Гарантия</option><option value="wrong_kit">Ошибка комплектации</option></select></label>' +
        '<label>Заявленная дата передачи <input name="handoverDate" type="date"></label><p class="muted">Это заявление покупателя, не подтверждённая учётом дата. Дата создания заказа её не заменяет.</p>' +
        '<label>Количество <input name="qty" type="number" min="1" value="1"></label>' +
        '<button class="btn" type="submit">Отправить заявку</button></form>' : '') + '</div></div>';
    }).catch(function (err) { return '<div class="page"><h1>Заказ</h1><div class="card">' + esc(err.message) + ' <a href="#/account/orders">К списку</a></div></div>'; });
  };
  pages.accountOrder.after = function (root, id) {
    var jump = $('#jumpReturn', root);
    if (jump) jump.onclick = function (e) {
      e.preventDefault();
      var form = $('#returnForm', root) || $('#wholesaleReturn', root);
      if (form) form.scrollIntoView({ block: 'start' });
    };
    var again = $('#reorderBtn', root);
    if (again) again.onclick = function () {
      again.disabled = true;
      window.CarvicAccount.reorder(id).then(function (res) {
        var changed = (res.added || []).filter(function (line) { return line.priceChanged; }).length;
        toast(res.skipped && res.skipped.length ? 'Часть позиций не добавлена: нет наличия' : (changed ? 'В корзине новая цена сервера' : 'Добавлено по текущей цене'));
        location.hash = '#/cart';
      }).catch(function (err) { again.disabled = false; toast(err.message); });
    };
    var wholesale = $('#wholesaleReturn', root);
    if (wholesale) wholesale.onsubmit = function (e) {
      e.preventDefault();
      var lines = $$('[data-wsku]', wholesale).filter(function (box) { return box.checked; }).map(function (box) {
        return { sku: box.dataset.wsku, qty: Number($('[data-wqty="' + box.dataset.wsku + '"]', wholesale).value) };
      });
      var files = Array.prototype.slice.call($('#wPhotos', wholesale).files || []);
      if (files.length > 5) { toast('Не больше 5 фотографий.'); return; }
      if (files.some(function (file) { return file.size > 10 * 1024 * 1024; })) { toast('Каждое фото не больше 10 МБ.'); return; }
      Promise.all(files.map(function (file) {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () { resolve({ name: file.name, mime: file.type, base64: String(reader.result).split(',')[1] || '' }); };
          reader.onerror = function () { reject(new Error('Файл не прочитан')); };
          reader.readAsDataURL(file);
        });
      })).then(function (photos) {
        if (!wholesale.dataset.idem) wholesale.dataset.idem = 'wret-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        return window.CarvicAccount.createWholesaleReturn({
          orderId: id, reason: $('#wReason', wholesale).value, comment: $('#wComment', wholesale).value, lines: lines, photos: photos
        }, wholesale.dataset.idem);
      }).then(function (res) {
        toast(res.request.statusLabel);
        location.hash = '#/account/wholesale-returns';
      }).catch(function (err) { toast(err.message); });
    };
    var ret = $('#returnForm', root);
    if (ret) ret.onsubmit = function (e) {
      e.preventDefault();
      var data = new FormData(ret);
      window.CarvicAccount.createReturn({ orderId: id, sku: data.get('sku'), qty: Number(data.get('qty')), basis: data.get('basis'), segment: 'retail', handoverDate: data.get('handoverDate') || '' }).then(function (res) {
        var note = res.request.status === 'needs_manager'
          ? 'Заявка по добровольному основанию ждёт менеджера. В 1С не передана.'
          : (res.request.status === 'handover_unknown'
            ? 'Дата передачи не указана и не взята из даты заказа. Заявка записана, деньги не переведены.'
            : 'Заявка записана. В 1С не передана, деньги не переведены.');
        toast(note);
        route();
      }).catch(function (err) { toast(err.message); });
    };
    var cancel = $('#cancelBtn', root);
    if (cancel) cancel.onclick = function () {
      cancel.disabled = true;
      window.CarvicAccount.cancel(id).then(function () { route(); }).catch(function (err) { cancel.disabled = false; toast(err.message); });
    };
  };
  pages.accountBalance = function () {
    var query = currentRoute().params || {};
    return window.CarvicAccount.balanceQuery(query).then(function (data) {
      if (data.demo === false) {
        return '<div class="page" id="settlementsClosed"><h1>Взаиморасчёты</h1>' + accountNav() + '<div class="card"><p>' + esc(data.note) + '</p></div></div>';
      }
      return '<div class="page"><h1>Взаиморасчёты</h1>' + accountNav() + demoBanner(esc(data.note)) +
        '<form class="card admin-bar" id="balFilter"><label>Статус<select name="status">' + opt('any', query.status || 'any', 'Любой статус') + opt('paid', query.status, 'Оплачено') + opt('unpaid', query.status, 'Не оплачено') + '</select></label>' +
        '<label>Период с<input type="date" name="from" value="' + esc(query.from || '') + '"></label><label>Период по<input type="date" name="to" value="' + esc(query.to || '') + '"></label>' +
        '<label>Точка<select name="outlet"><option value="">Все точки</option>' + C.stores.map(function (s) { return '<option value="' + esc(s.id) + '"' + (query.outlet === s.id ? ' selected' : '') + '>' + esc(s.short) + '</option>'; }).join('') + '</select></label><button class="btn">Показать</button></form>' +
        '<div class="card"><p class="price" style="text-align:left;font-size:28px">' + esc(window.CarvicAccount.rub(data.balance)) + '</p><p class="muted">Кредитный лимит и кнопка пополнения не подключены. Начало отсчёта демо-журнала: ' + esc(data.periodStart || 'нет записей') + '. Показано ' + data.entries.length + ' из ' + (data.total || data.entries.length) + '.</p>' +
        '<div class="ledger-cards">' + (data.entries.length ? data.entries.map(function (e) {
          return '<article class="line-card"><b>' + esc(e.at.slice(0, 10)) + ' · ' + esc(e.typeLabel) + '</b><div>Оплачено ' + esc(window.CarvicAccount.rub({ amount: e.paidMinor, minorUnit: 100 })) + '</div><div>Отгружено ' + esc(window.CarvicAccount.rub({ amount: e.shippedMinor, minorUnit: 100 })) + '</div><div>' + esc(e.payStatus) + (e.outletName ? ' · ' + esc(e.outletName) : '') + '</div><div>Баланс ' + esc(window.CarvicAccount.rub(e.balanceAfter)) + '</div></article>';
        }).join('') : '<div class="empty">Записей по фильтру нет.</div>') + '</div>' +
        '<div class="tbl-wrap desk-table"><table class="tbl"><thead><tr><th>Дата</th><th>Операция</th><th>Оплачено</th><th>Отгружено</th><th>Статус</th><th>Баланс</th></tr></thead><tbody>' +
        (data.entries.length ? data.entries.map(function (e) { return '<tr><td>' + esc(e.at.slice(0, 10)) + '</td><td>' + esc(e.typeLabel) + '</td><td>' + esc(window.CarvicAccount.rub({ amount: e.paidMinor, minorUnit: 100 })) + '</td><td>' + esc(window.CarvicAccount.rub({ amount: e.shippedMinor, minorUnit: 100 })) + '</td><td>' + esc(e.payStatus) + '</td><td>' + esc(window.CarvicAccount.rub(e.balanceAfter)) + '</td></tr>'; }).join('') : '<tr><td colspan="6">Записей по фильтру нет.</td></tr>') +
        '</tbody></table></div>' +
        (data.hasMore ? '<button class="btn" type="button" id="balMore" data-offset="' + (data.offset + data.entries.length) + '">Загрузить ещё</button>' : '') +
        '</div></div>';
    }).catch(function (err) { return '<div class="page"><h1>Взаиморасчёты</h1><div class="card">' + esc(err.message) + '</div></div>'; });
  };
  function ledgerCard(e) {
    return '<article class="line-card"><b>' + esc(e.at.slice(0, 10)) + ' · ' + esc(e.typeLabel) + '</b><div>Оплачено ' + esc(window.CarvicAccount.rub({ amount: e.paidMinor, minorUnit: 100 })) + '</div><div>Отгружено ' + esc(window.CarvicAccount.rub({ amount: e.shippedMinor, minorUnit: 100 })) + '</div><div>' + esc(e.payStatus) + (e.outletName ? ' · ' + esc(e.outletName) : '') + '</div><div>Баланс ' + esc(window.CarvicAccount.rub(e.balanceAfter)) + '</div></article>';
  }
  function ledgerRow(e) {
    return '<tr><td>' + esc(e.at.slice(0, 10)) + '</td><td>' + esc(e.typeLabel) + '</td><td>' + esc(window.CarvicAccount.rub({ amount: e.paidMinor, minorUnit: 100 })) + '</td><td>' + esc(window.CarvicAccount.rub({ amount: e.shippedMinor, minorUnit: 100 })) + '</td><td>' + esc(e.payStatus) + '</td><td>' + esc(window.CarvicAccount.rub(e.balanceAfter)) + '</td></tr>';
  }
  pages.accountBalance.after = function (root) {
    var form = $('#balFilter', root); if (!form) return;
    form.onsubmit = function (e) {
      e.preventDefault();
      var data = new FormData(form);
      location.hash = '#/account/balance?status=' + encodeURIComponent(data.get('status') || 'any') + '&from=' + encodeURIComponent(data.get('from') || '') + '&to=' + encodeURIComponent(data.get('to') || '') + '&outlet=' + encodeURIComponent(data.get('outlet') || '');
    };
    var more = $('#balMore', root);
    if (!more) return;
    more.onclick = function () {
      var query = currentRoute().params || {};
      query.offset = more.dataset.offset;
      more.disabled = true;
      window.CarvicAccount.balanceQuery(query).then(function (data) {
        var cards = $('.ledger-cards', root);
        var body = $('tbody', root);
        data.entries.forEach(function (e) {
          cards.insertAdjacentHTML('beforeend', ledgerCard(e));
          if (body) body.insertAdjacentHTML('beforeend', ledgerRow(e));
        });
        var shown = cards.querySelectorAll('.line-card').length;
        if (data.hasMore) { more.dataset.offset = String(data.offset + data.entries.length); more.disabled = false; }
        else more.remove();
        var note = $('.card .muted', root);
        if (note) note.textContent = 'Показано ' + shown + ' из ' + data.total + '. Это демо-журнал, не взаиморасчёты 1С.';
      }).catch(function (err) { more.disabled = false; toast(err.message); });
    };
  };

  /* ------------------------- Роутер ------------------------- */
  function currentRoute() {
    var h = location.hash.replace(/^#\/?/, ''), q = '';
    var qi = h.indexOf('?'); if (qi >= 0) { q = h.slice(qi + 1); h = h.slice(0, qi); }
    var parts = h.split('/').filter(Boolean);
    var params = {}; q.split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); });
    var n = parts[0] || 'home';
    currentRoute.params = params;
    if (n === 'catalog' && parts[1]) return { name: 'catalogCat', arg: parts[1] };
    if (n === 'vin') return { name: 'vin', arg: parts.slice(1).join('/') };
    if (n === 'delivery') return { name: 'delivery', arg: null };
    if (n === 'part') return { name: 'part', arg: parts.slice(1).join('/') };
    if (n === 'feed' && parts[1]) return { name: 'feedProduct', arg: decodeURIComponent(parts[1]) };
    if (n === 'search') return { name: 'search', arg: { q: params.q || '', brand: params.brand || '', sort: params.sort || '', list: params.list || '' } };
    if (n === 'legal') return { name: 'legalDoc', arg: parts[1] || 'privacy' };
    if (n === 'returns') return { name: 'returns', arg: null };
    if (n === 'inquiry') return { name: 'inquiry', arg: null };
    if (n === 'price') return { name: 'priceList', arg: null };
    if (n === 'account' && parts[1] === 'garage') return { name: 'accountGarage', arg: null };
    if (n === 'account' && parts[1] === 'settings') return { name: 'accountSettings', arg: null };
    if (n === 'account' && parts[1] === 'wholesale-returns') return { name: 'accountWholesaleReturns', arg: null };
    if (n === 'account' && parts[1] === 'orders' && parts[2]) return { name: 'accountOrder', arg: parts[2] };
    if (n === 'account' && parts[1] === 'orders') return { name: 'accountOrders', arg: null, params: params };
    if (n === 'account' && parts[1] === 'balance') return { name: 'accountBalance', arg: null, params: params };
    if (n === 'notebook') return { name: 'notebook', arg: null };
    if (n === 'account') return { name: 'account', arg: null };
    if (n === 'about' && parts[1] === 'team') return { name: 'aboutTeam', arg: null };
    if (n === 'blog') return { name: 'blog', arg: null };
    if (n === 'admin') return { name: 'admin', arg: parts[1] || 'products' };
    return { name: pages[n] ? n : 'notfound', arg: null };
  }
  /* ---- Всплывающее окно для форм (#/inquiry) ----
   * Адреса #/inquiry?… и #/callback сохраняются: ссылки и «Назад» работают как раньше,
   * но форма открывается поверх текущей страницы, а не вместо неё. */
  var MODAL_ROUTES = { inquiry: true, callback: true, signin: true, register: true };
  var shownHash = null;       // адрес страницы, которая сейчас под окном
  var modalFromApp = false;   // окно открыто переходом внутри сайта (можно вернуться «Назад»)
  var modalOpener = null;
  var modal = null;
  function normHash(h) { h = (h || '').replace(/^#\/?/, ''); return '#/' + h; }
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.hidden = true;
    modal.innerHTML = '<div class="modal__backdrop" data-modal-close></div>' +
      '<div class="modal__box" role="dialog" aria-modal="true" aria-labelledby="modalTitle" tabindex="-1">' +
      '<button type="button" class="modal__close" data-modal-close aria-label="Закрыть">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="modal__body"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-modal-close]')) { requestCloseModal(); return; }
      // переход из окна в другое окно (вход ↔ регистрация) — без новой записи в истории,
      // чтобы крестик и «Назад» возвращали на страницу, а не в предыдущее окно
      var a = e.target.closest('a[href^="#/"]');
      if (!a || a.target === '_blank') return;
      var name = a.getAttribute('href').replace(/^#\/?/, '').split(/[/?]/)[0];
      if (!MODAL_ROUTES[name]) return;
      e.preventDefault();
      history.replaceState(null, '', a.getAttribute('href'));
      route();
    });
    document.addEventListener('keydown', function (e) {
      if (modal.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); requestCloseModal(); return; }
      if (e.key !== 'Tab') return;
      var f = $$('a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled])', modal)
        .filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    return modal;
  }
  function modalOpen() { return !!modal && !modal.hidden; }
  function closeModal() {
    if (!modalOpen()) return;
    modal.hidden = true;
    $('.modal__body', modal).innerHTML = '';
    document.body.classList.toggle('modal-open', false);
    if (modalOpener && document.contains(modalOpener)) modalOpener.focus({ preventScroll: true });
    modalOpener = null;
  }
  function requestCloseModal() {
    if (!modalOpen()) return;
    if (modalFromApp) { history.back(); return; } // hashchange вернёт адрес страницы под окном
    history.replaceState(null, '', shownHash || '#/');
    closeModal();
  }
  function openModalRoute(r, seq) {
    var fn = pages[r.name];
    ensureModal();
    return fn(r.arg).then(function (html) {
      if (seq !== renderSeq) return;
      var body = $('.modal__body', modal);
      body.innerHTML = html;
      if (fn.after) fn.after(body, r.arg);
      if (!modalOpen()) {
        modalOpener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
        modal.hidden = false;
        document.body.classList.toggle('modal-open', true);
      }
      body.scrollTop = 0;
      var first = $('input:not([type="hidden"]):not([tabindex="-1"]), select, textarea', body);
      (first || $('.modal__box', modal)).focus({ preventScroll: true });
      document.body.classList.toggle('sb-open', false);
    });
  }

  // страницы подбора запчастей: на них слева панель каталога (фильтры); на остальных её нет
  var FILTER_ROUTES = { catalog: true, catalogCat: true, search: true, vin: true };
  var renderSeq = 0, lastRouteName = null;
  function route() {
    var r = currentRoute(), seq = ++renderSeq;
    var hash = normHash(location.hash);
    if (MODAL_ROUTES[r.name]) {
      if (shownHash !== null) {
        if (!modalOpen()) modalFromApp = true;
        openModalRoute(r, seq).catch(function (e) { console.error(e); toast(e.message); });
        return;
      }
      // прямой заход по ссылке на форму: под окном — главная
      modalFromApp = false;
      document.body.classList.toggle('is-home', true);
      pages.home().then(function (html) {
        if (seq !== renderSeq) return;
        view.innerHTML = html;
        if (pages.home.after) pages.home.after(view);
        shownHash = '#/'; lastRouteName = 'home';
        return openModalRoute(r, seq);
      }).catch(function (e) { console.error(e); });
      return;
    }
    if (modalOpen()) {
      closeModal();
      if (hash === shownHash) return; // «Назад» из окна: страница под ним уже на месте
    }
    document.body.classList.toggle('is-home', r.name === 'home');
    document.body.classList.toggle('is-sheet', r.name === 'feedProduct' || r.name === 'part');
    document.body.classList.toggle('has-filters', !!FILTER_ROUTES[r.name]);
    var fn = r.name === 'admin' ? window.CarvicAdmin.page : pages[r.name];
    $$('.sb-nav a').forEach(function (a) { var href = a.getAttribute('href').replace(/^#\/?/, '').split('/')[0] || 'home'; a.classList.toggle('on', href === (r.name === 'catalogCat' ? 'catalog' : r.name)); });
    $$('.qi').forEach(function (a) { a.classList.toggle('on', r.name === 'catalogCat' && a.getAttribute('href') === '#/catalog/' + r.arg); });
    if (r.name === 'cart' || r.name === 'checkout' || r.name.indexOf('account') === 0) {
      view.innerHTML = '<div class="page" data-loading><p class="muted">Загрузка…</p></div>';
    }
    fn(r.arg).then(function (html) {
      if (seq !== renderSeq) return;
      var keepScroll = lastRouteName === r.name;
      view.innerHTML = html;
      var after = r.name === 'admin' ? window.CarvicAdmin.after : fn.after;
      if (after) after(view, r.arg);
      var stop = $('#stopAct', view);
      if (stop) stop.onclick = function () {
        window.CarvicAccount.stopAct().then(function () { state.buyer = null; state.act = null; state.serverQty = null; renderBuyer(); renderCartCount(); location.hash = '#/admin/act'; });
      };
      if (!keepScroll) window.scrollTo(0, 0);
      lastRouteName = r.name;
      shownHash = hash;
      document.body.classList.remove('sb-open');
    }).catch(function (e) { console.error(e); view.innerHTML = '<div class="page"><h1>Ошибка</h1><p>' + esc(e.message) + '</p></div>'; });
  }

  /* ------------------------- Глобальные события ------------------------- */
  function bindSuggest(input) {
    if (!input || input.dataset.suggestBound) return;
    input.dataset.suggestBound = '1';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-autocomplete', 'list');
    var box = document.createElement('div');
    box.className = 'suggest';
    box.hidden = true;
    box.setAttribute('role', 'listbox');
    if (input.parentNode) input.parentNode.appendChild(box);
    var items = [];
    var active = -1;
    var timer = 0;
    var seq = 0;
    function closeBox() {
      box.hidden = true;
      box.innerHTML = '';
      items = [];
      active = -1;
      input.setAttribute('aria-expanded', 'false');
    }
    function paint() {
      box.innerHTML = items.map(function (item, i) {
        return '<button type="button" role="option" data-suggest="' + i + '"' + (i === active ? ' class="on" aria-selected="true"' : '') + '><b>' + esc(item.article || '') + '</b> ' + esc(item.brand || '') + '<span>' + esc(item.name || '') + '</span><small>' + (item.inStock ? 'В наличии' : 'Нет в наличии') + '</small></button>';
      }).join('');
      box.hidden = items.length === 0;
      input.setAttribute('aria-expanded', items.length ? 'true' : 'false');
    }
    function openCard(item) {
      if (!item || !item.id) return;
      closeBox();
      location.hash = '#/feed/' + encodeURIComponent(item.id);
    }
    function load() {
      var q = input.value.trim();
      if (q.length < 3) { closeBox(); return; }
      var mine = ++seq;
      fetch('/api/feed/suggest?q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (data) {
        if (mine !== seq) return;
        items = (data && data.items || []).slice(0, 8);
        active = items.length ? 0 : -1;
        paint();
      }).catch(function () { if (mine === seq) closeBox(); });
    }
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(load, 250);
    });
    input.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); e.stopPropagation(); openCard(items[active]); }
      else if (e.key === 'Escape') { e.preventDefault(); closeBox(); }
    });
    box.addEventListener('mousedown', function (e) {
      var btn = e.target.closest('[data-suggest]');
      if (!btn) return;
      e.preventDefault();
      openCard(items[Number(btn.getAttribute('data-suggest'))]);
    });
  }
  function initGlobal() {
    var ticking = false;
    function onScroll() {
      ticking = false;
      if (document.body.classList.contains('modal-open')) return;
      var y = window.scrollY || 0, hidden = document.body.classList.contains('topbar-hidden');
      if (!hidden && y > 48) document.body.classList.toggle('topbar-hidden', true);
      else if (hidden && y < 8) document.body.classList.toggle('topbar-hidden', false);
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
    var note = $('#cookieNote');
    if (note && !localStorage.getItem('carvic_cookie_ok')) { note.hidden = false; document.body.classList.add('cookie-open'); }
    var okBtn = $('#cookieOk');
    if (okBtn) okBtn.onclick = function () { localStorage.setItem('carvic_cookie_ok', '1'); if (note) note.hidden = true; document.body.classList.remove('cookie-open'); };
    $$('.qi').forEach(function (a) { a.innerHTML = icon(a.dataset.icon, { line: true }); });
    var vi = $('#vinInput'), hint = $('#vinHint');
    bindSuggest(vi);
    vi.addEventListener('input', function () {
      var v = vi.value.replace(/\s/g, '').toUpperCase(); hint.classList.remove('err');
      if (!v) { hint.textContent = ''; return; }
      if (state.demoUi && /^[A-HJ-NPR-Z0-9]+$/.test(v) && v.length <= 17) hint.textContent = 'VIN: ' + v.length + ' / 17' + (v.length < 17 ? ' · или поиск по артикулу' : ' · Enter — демо-подбор');
      else hint.textContent = 'Поиск по артикулу';
    });
    $('#vinForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var raw = vi.value.trim(), v = raw.replace(/\s/g, '').toUpperCase();
      if (!v) { hint.textContent = state.demoUi ? 'Введите VIN (17 символов) или артикул' : 'Введите артикул или название'; hint.classList.add('err'); vi.focus(); return; }
      if (/^[A-HJ-NPR-Z0-9]{17}$/.test(v) && state.demoUi) location.hash = '#/vin/' + v;
      else if (state.demoUi && v.length === 17) { hint.textContent = 'В VIN не используются буквы I, O, Q'; hint.classList.add('err'); }
      else location.hash = '#/search?q=' + encodeURIComponent(raw);
    });
    $('#cartBtn').onclick = openDrawer;
    $('#drawerClose').onclick = closeDrawer;
    $('#drawerOverlay').onclick = closeDrawer;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeDrawer(); document.body.classList.remove('sb-open'); } });
    $('#burger').onclick = function () { document.body.classList.toggle('sb-open'); };
    $('#sbOverlay').onclick = function () { document.body.classList.remove('sb-open'); };
    // делегирование: «В корзину» и элементы корзины в панели
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-add]');
      if (b) { addToCart(b.dataset.add).then(function () { b.classList.add('added'); b.textContent = '✓ В корзине'; setTimeout(function () { b.classList.remove('added'); b.textContent = 'В корзину'; }, 1400); }); return; }
      var dq = e.target.closest('[data-dq]');
      if (dq) { var i = +dq.dataset.dq; setQty(i, cart[i].qty + (+dq.dataset.d)); if (currentRoute().name === 'cart') route(); return; }
      var dr = e.target.closest('[data-drm]');
      if (dr) { removeItem(+dr.dataset.drm); if (currentRoute().name === 'cart') route(); return; }
      if (e.target.closest('.drawer a')) closeDrawer();
    });
    document.addEventListener('change', function (e) { var t = e.target.closest('[data-dqi]'); if (t) { setQty(+t.dataset.dqi, t.value); if (currentRoute().name === 'cart') route(); } });
    window.addEventListener('hashchange', route);
    // синхронизация корзины между вкладками
    window.addEventListener('storage', function (e) { if (e.key === LS_CART) { cart = lsGet(LS_CART, []); renderCartCount(); renderDrawer(); } });
    $('#year').textContent = new Date().getFullYear();
  }

  /* Экспорт для модуля админки */
  window.CarvicApp = { esc: esc, fmt: fmt, toast: toast, catName: catName, bySku: bySku, route: route, resetPrices: function () { resetPrices(); renderDrawer(); }, state: state, setCp: setCp };

  /* ------------------------- Старт ------------------------- */
  initSidebar(); syncCarSelects(); initGlobal(); initProfile(); renderCartCount(); renderDrawer();
  state.cp = null;
  fetch('/api/rossko/status', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (st) {
    state.demoUi = Boolean(st && st.demoUi);
    state.demoAccounts = Boolean(st && st.demoAccounts);
    state.hideLocalDbNote = Boolean(st && st.hideLocalDbNote);
    state.orderInLead = st && st.orderInLead || '';
    state.hasOem = Boolean(st && st.hasOem);
    state.pageDelivery = Boolean(st && st.pageDelivery);
    state.pageReturns = Boolean(st && st.pageReturns);
    state.consentPreK3 = Boolean(st && st.consentPreK3);
    state.privacyEmail = st && st.privacyEmail || '';
    if (st && st.publicEmail) {
      C.email = st.publicEmail;
      var mail = $('#publicMail');
      if (mail) {
        mail.setAttribute('href', 'mailto:' + st.publicEmail);
        mail.textContent = st.publicEmail;
      }
    }
    var searchLabel = st && st.hasOem ? 'Артикул или OEM' : 'Артикул или название';
    var car = $('#demoCar');
    var brands = $('#demoBrands');
    var demoCats = $('#demoCats');
    if (car) car.hidden = !state.demoUi;
    if (brands) brands.hidden = !state.demoUi;
    if (demoCats) demoCats.hidden = !state.demoUi;
    var demoList = $('#catChecks');
    var feedNav = $('#feedCatNav');
    if (demoList) demoList.hidden = !state.demoUi;
    if (feedNav) feedNav.hidden = true;
    if (!state.demoUi) {
      fetch('/api/feed/catalog?limit=1', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (data) {
        var groups = data && data.categoryGroups || [];
        var names = data && data.categories || [];
        var links = [];
        groups.forEach(function (group) {
          if (group && group.parent) links.push('<a href="#/catalog?group=' + encodeURIComponent(group.parent) + '">' + esc(showCat(group.parent)) + '</a>');
        });
        if (!links.length) names.forEach(function (name) {
          links.push('<a href="#/catalog?category=' + encodeURIComponent(name) + '">' + esc(showCat(name)) + '</a>');
        });
        if (!links.length || !feedNav || !demoCats) return;
        feedNav.innerHTML = links.join('');
        feedNav.hidden = false;
        demoCats.hidden = false;
      }).catch(function () {});
    }
    var input = $('#vinInput');
    if (input) {
      if (state.demoUi) {
        input.placeholder = 'ВИН или артикул';
        input.setAttribute('aria-label', 'VIN или артикул');
      } else {
        input.placeholder = searchLabel;
        input.setAttribute('aria-label', searchLabel);
      }
    }
    $$('.sb-nav a[href="#/search"]').forEach(function (link) {
      if (!state.demoUi) link.textContent = st && st.hasOem ? 'Поиск по артикулу/OEM' : 'Поиск по артикулу';
    });
    var privacy = $('#privacyEmail');
    if (privacy) {
      if (state.privacyEmail) {
        privacy.hidden = false;
        privacy.innerHTML = 'Запросы по персональным данным: <a href="mailto:' + esc(state.privacyEmail) + '">' + esc(state.privacyEmail) + '</a>';
      } else privacy.hidden = true;
    }
    $$('[data-delivery-link], #deliveryNav').forEach(function (link) {
      if (state.pageDelivery) { link.hidden = false; link.textContent = 'Доставка и оплата'; }
      else { link.hidden = true; link.textContent = ''; }
    });
  }).catch(function () { state.demoUi = false; }).then(function () {
    return refreshBuyerSession();
  }).then(function () { route(); });
})();
