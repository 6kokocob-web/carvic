/* Кабинет покупателя. Сессия в HttpOnly-cookie, CSRF — в заголовке. Цены считает сервер. */
(function (root) {
  'use strict';

  var csrf = '';

  function call(method, url, body, key) {
    var headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (key) headers['Idempotency-Key'] = key;
    if (method !== 'GET' && method !== 'HEAD' && csrf) headers['X-CSRF-Token'] = csrf;
    return fetch(url, {
      method: method,
      credentials: 'same-origin',
      headers: headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok || data.ok === false) {
          var err = new Error((data && data.message) || 'Ошибка');
          err.status = r.status;
          err.code = data && data.error;
          throw err;
        }
        if (data && data.csrfToken) csrf = data.csrfToken;
        return data;
      }, function () {
        var err = new Error('Сервер кабинета недоступен');
        err.code = 'network';
        throw err;
      });
    }).catch(function (err) {
      if (err && (err.status || err.code)) throw err;
      var net = new Error('Нет связи с сервером. Повторите действие: тот же ключ не создаёт второй заказ.');
      net.code = 'network';
      throw net;
    });
  }

  function rub(m) {
    if (!m || typeof m.amount !== 'number') return '—';
    var value = m.amount / (m.minorUnit || 100);
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
  }

  root.CarvicAccount = {
    status: function () { return call('GET', '/api/account/status'); },
    login: function (phone, code, clientId) { return call('POST', '/api/account/login', { phone: phone, code: code, clientId: clientId || '' }); },
    requestLoginCode: function (phone) { return call('POST', '/api/account/login/sms', { phone: phone }); },
    feedCatalog: function (query) { return call('GET', '/api/account/feed/catalog' + (query ? '?' + query : '')); },
    feedSearch: function (query) { return call('GET', '/api/account/feed/search?' + query); },
    feedProduct: function (id) { return call('GET', '/api/account/feed/product?id=' + encodeURIComponent(id)); },
    withdrawConsent: function (docId) { return call('POST', '/api/account/consents/withdraw', { docId: docId }); },
    requestDeletion: function () { return call('POST', '/api/account/delete', {}); },
    confirmDeletion: function (code) { return call('POST', '/api/account/delete/confirm', { code: code }); },
    feedCheck: function (body) { return call('POST', '/api/account/feed/check', body); },
    notebook: function () { return call('GET', '/api/account/notebook'); },
    saveNotebook: function (ids) { return call('PUT', '/api/account/notebook', { ids: ids }); },
    logout: function () {
      return call('POST', '/api/account/logout', {}).then(function (data) { csrf = ''; return data; });
    },
    me: function () { return call('GET', '/api/account/me'); },
    balance: function () { return call('GET', '/api/account/balance'); },
    methods: function () { return call('GET', '/api/account/methods'); },
    cart: function () { return call('GET', '/api/account/cart'); },
    setCart: function (body) { return call('PUT', '/api/account/cart', body); },
    moveCartLine: function (body) { return call('PUT', '/api/account/cart', Object.assign({ action: 'move' }, body)); },
    clearCartGroup: function (outletId) { return call('PUT', '/api/account/cart', { action: 'clearGroup', outletId: outletId }); },
    importCart: function (body, key) { return call('POST', '/api/account/cart/import', body, key); },
    saveProfile: function (body) { return call('POST', '/api/account/profile', body); },
    settings: function () { return call('GET', '/api/account/settings'); },
    saveSettings: function (body) { return call('POST', '/api/account/settings', body); },
    garage: function () { return call('GET', '/api/account/garage'); },
    addGarage: function (body) { return call('POST', '/api/account/garage', body); },
    removeGarage: function (id) { return call('DELETE', '/api/account/garage/' + encodeURIComponent(id)); },
    orders: function (query) {
      var q = new URLSearchParams(query || {}).toString();
      return call('GET', '/api/account/orders' + (q ? '?' + q : ''));
    },
    balanceQuery: function (query) {
      var q = new URLSearchParams(query || {}).toString();
      return call('GET', '/api/account/balance' + (q ? '?' + q : ''));
    },
    order: function (id) { return call('GET', '/api/account/orders/' + encodeURIComponent(id)); },
    reorder: function (id) { return call('POST', '/api/account/orders/' + encodeURIComponent(id) + '/reorder', {}); },
    cancel: function (id) { return call('POST', '/api/account/orders/' + encodeURIComponent(id) + '/cancel', {}); },
    createReturn: function (body) { return call('POST', '/api/account/returns', body); },
    createWholesaleReturn: function (body, key) { return call('POST', '/api/account/wholesale-returns', body, key); },
    wholesaleReturns: function () { return call('GET', '/api/account/wholesale-returns'); },
    stopAct: function () { return call('POST', '/api/account/act/stop', {}).then(function (data) { csrf = ''; return data; }); },
    sendInquiry: function (body) { return call('POST', '/api/inquiries', body); },
    setOutlet: function (body) { return call('POST', '/api/account/outlet', body); },
    registerOpt: function (body) { return call('POST', '/api/opt/register', body); },
    checkout: function (payload, key) { return call('POST', '/api/account/checkout', payload, key); },
    rub: rub
  };
})(typeof window !== 'undefined' ? window : globalThis);
