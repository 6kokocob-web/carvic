/* Браузерный клиент предложений «Под заказ».
 * Ходит только на свой сервер. Ключей поставщика здесь нет.
 * Эти цены не пишутся в window.OneC и не попадают в корзину.
 */
(function (root) {
  'use strict';

  var mountSeq = 0;
  var BANNED = /rossko|росско|склад поставщика|код номенклатуры|fix-[a-z0-9]|hst\d|nsin\d|ул\.\s/i;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function looksLikeVin(s) {
    return /^[A-HJ-NPR-Z0-9]{17}$/.test(String(s || '').replace(/\s/g, '').toUpperCase());
  }

  function illustrativeId(s) {
    return /^DEMO([-\s_]|$)/i.test(String(s || '').trim());
  }

  function days(n) {
    if (n == null || n === '') return 'срок не указан';
    return String(n) + ' дн.';
  }

  function priceHtml(amount, currency) {
    if (amount == null || amount === '') return '—';
    var suffix = '';
    if (!currency || !currency.code || !currency.confirmed) suffix = '';
    else suffix = ' ' + esc(currency.code);
    return '<b>' + esc(amount) + '</b>' + suffix;
  }

  function row(part, line, currency, relation) {
    var kind = relation === 'cross' ? '<span class="src">аналог</span> ' : '';
    return '<div class="partner-row" data-relation="' + relation + '"' + (relation === 'cross' ? ' data-partner-crosses' : '') + '>'
      + '<div class="partner-id"><span class="brand">' + esc(part.brand) + '</span> '
      + kind + '<span class="mono">' + esc(part.partnumber) + '</span>'
      + (part.name ? '<div class="muted">' + esc(part.name) + '</div>' : '')
      + '</div>'
      + '<div class="when">' + esc(line ? days(line.deliveryDays) : days(null)) + '</div>'
      + '<div class="price">' + priceHtml(line && line.price, currency) + '</div>'
      + '<div><span class="src order">Под заказ</span></div>'
      + '</div>';
  }

  function rowsFor(part, currency, relation) {
    var lines = part.lines && part.lines.length ? part.lines : [null];
    return lines.map(function (line) { return row(part, line, currency, relation); }).join('');
  }

  function choiceList(data) {
    var html = '<ul class="partner-brands">';
    (data.brandChoices || []).forEach(function (choice) {
      var href = '#/search?q=' + encodeURIComponent(data.queried.text) + '&brand=' + encodeURIComponent(choice.brand);
      html += '<li><a class="btn btn--ghost" href="' + href + '">' + esc(choice.brand) + '</a> '
        + '<span class="mono">' + esc((choice.partnumbers || []).join(', ')) + '</span> '
        + '<span class="muted">' + esc((choice.names || []).join(' · ')) + '</span></li>';
    });
    return html + '</ul>';
  }

  function renderHtml(data) {
    if (!data || data.ok === false) {
      return '<h2 class="card__title">Под заказ</h2>'
        + '<div class="warn-box">' + esc((data && data.message) || 'Не удалось получить предложения под заказ.') + '</div>';
    }
    var html = '<h2 class="card__title">Под заказ</h2>';
    var banner = data.mockNotice || data.liveNotice;
    if (banner) {
      html += '<p class="demo-note partner-banner"><span class="demo-badge">' + (data.transport === 'mock' ? 'тест' : 'live') + '</span> ' + esc(banner) + '</p>';
    }
    if (data.currency && data.currency.note) html += '<p class="muted" data-currency-note>' + esc(data.currency.note) + '</p>';
    (data.warnings || []).forEach(function (warning) { html += '<p class="warn-box">' + esc(warning) + '</p>'; });

    if (data.needsBrandSelection) {
      html += '<p><b>Выберите бренд.</b> Без бренда цены разных производителей не смешиваются.</p>';
      html += choiceList(data);
      html += '<p class="muted">Сроки и цены скрыты, пока бренд не выбран.</p>';
      return html;
    }

    if (data.queried && data.queried.brand) {
      html += '<p class="muted"><a href="#/search?q=' + encodeURIComponent(data.queried.text) + '">Сбросить бренд</a></p>';
    }

    if (!data.offers || !data.offers.length) {
      html += '<div class="empty">Предложений под заказ нет.</div>';
      if (data.brandChoices && data.brandChoices.length) html += choiceList(data);
      return html;
    }

    html += '<div class="partner-list">';
    data.offers.forEach(function (part) {
      html += rowsFor(part, data.currency, 'original');
      (part.crosses || []).forEach(function (cross) { html += rowsFor(cross, data.currency, 'cross'); });
    });
    html += '</div>';
    var anyCross = data.offers.some(function (part) { return part.crosses && part.crosses.length; });
    if (!anyCross && !data.hideEmptyCrosses) html += '<p class="muted">Аналогов в этом ответе нет.</p>';
    return html;
  }

  function mount(el, query) {
    var seq = ++mountSeq;
    var text = query && query.text ? String(query.text).trim() : '';
    var brand = query && query.brand ? String(query.brand).trim() : '';
    function paint(state, html) {
      if (!el || seq !== mountSeq) return;
      el.setAttribute('data-partner-state', state);
      el.innerHTML = html;
    }
    if (!text) {
      paint('idle', '<h2 class="card__title">Под заказ</h2>'
        + '<p>Введите артикул. Строка из 17 символов — это демо-VIN, в поиск под заказ она не уходит.</p>'
        + '<p class="muted">Проверочные артикулы: <a href="#/search?q=333114">333114</a>, <a href="#/search?q=BPR6E">BPR6E</a> (несколько брендов), <a href="#/search?q=290074">290074</a>.</p>');
      return;
    }
    if (illustrativeId(text) || illustrativeId(brand)) {
      paint('error', '<h2 class="card__title">Под заказ</h2>'
        + '<div class="warn-box">Иллюстративный номер демо-каталога поставщику не отправляется. Это не поиск применимости по VIN.</div>');
      return;
    }
    if (looksLikeVin(text)) {
      var vin = text.replace(/\s/g, '').toUpperCase();
      paint('error', '<h2 class="card__title">Под заказ</h2>'
        + '<div class="warn-box"><b>VIN в поиск под заказ не отправляется.</b> <a href="#/vin/' + encodeURIComponent(vin) + '">Открыть демо-расшифровку VIN</a>.</div>');
      return;
    }
    paint('loading', '<h2 class="card__title">Под заказ</h2><p>Загрузка предложений…</p>');
    var url = '/api/rossko/search?text=' + encodeURIComponent(text) + (brand ? '&brand=' + encodeURIComponent(brand) : '');
    fetch(url, { headers: { Accept: 'application/json' } }).then(function (r) {
      return r.json().then(function (body) { return { body: body }; }, function () { return { body: null }; });
    }).then(function (res) {
      if (!res.body || res.body.ok === false) {
        paint('error', renderHtml({ ok: false, message: (res.body && res.body.message) || 'Не удалось получить предложения под заказ.' }));
        return;
      }
      var state = res.body.needsBrandSelection ? 'choose-brand' : ((res.body.offers && res.body.offers.length) ? 'ready' : 'empty');
      paint(state, renderHtml(res.body));
    }).catch(function () {
      paint('error', renderHtml({ ok: false, message: 'Сервер CARVIC недоступен. Откройте сайт через node server/index.js.' }));
    });
  }

  root.RosskoSearch = { renderHtml: renderHtml, mount: mount, looksLikeVin: looksLikeVin, illustrativeId: illustrativeId, esc: esc, banned: BANNED };
})(typeof window !== 'undefined' ? window : globalThis);
