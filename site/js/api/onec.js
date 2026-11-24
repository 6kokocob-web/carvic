/* =====================================================================
 * CARVIC — слой данных «1С» (js/api/onec.js)
 *
 * Единая точка доступа UI к остаткам, ценам, контрагентам и заказам.
 * UI НЕ берёт цены/остатки ниоткуда, кроме window.OneC.
 *
 * МОДЕЛЬ ЦЕН
 *   • Цена НЕ зависит от торговой точки: изменение цены действует сразу во всех точках.
 *     outletId участвует только в остатках и в списании позиций заказа.
 *   • Несколько базовых типов цен (вид цен в 1С): 'retail' (Розница), 'opt1' (Опт 1),
 *     'opt2' (Опт 2)… — список редактируется в админке (демо).
 *   • У каждого контрагента назначен свой тип цены (counterparty.priceType).
 *     Гость (без входа) — всегда 'retail'.
 *   • Скидки контрагента по группам товаров: { counterpartyId, productGroup, discountPercent }.
 *   • Индивидуальная цена контрагента на конкретный SKU.
 *
 * ПОРЯДОК РАСЧЁТА getPrice(sku, counterpartyId):
 *   1) индивидуальная цена контрагента по товару (если задана) — без доп. скидок;
 *   2) иначе базовая цена по типу цены контрагента
 *      минус скидка % по группе товара (если задана), округление до 1 ₽.
 *
 * ИНТЕРФЕЙС (все методы асинхронные → Promise)
 *   getOutlets()                                   → торговые точки
 *   getStock(outletId, sku) / getStockAll(sku) / getStocks(skus[])
 *   getPrice(sku, counterpartyId?)                 → { sku, price, source, priceType, base, discountPercent, group, steps[] }
 *        source: 'individual' | 'base' | 'base-discount'
 *   getPrices(skus[], counterpartyId?)             → { sku: <результат getPrice> }
 *   explainPrice(sku, counterpartyId?)             → то же, с пошаговым расчётом (steps)
 *   getPriceTypes() / savePriceType({ id?, name, defaultPercent })
 *   getBasePrice(sku, priceTypeId) / getBasePrices(skus[])
 *   setBasePrice({ sku, priceTypeId, value })      → базовая цена типа (для всех точек)
 *   setPrice({ sku, counterpartyId, value })       → индивидуальная цена контрагента
 *   removePrice({ sku, counterpartyId })
 *   getIndividualPrices(counterpartyId?)
 *   setGroupDiscount({ counterpartyId, productGroup, discountPercent })  (0 → удалить)
 *   getGroupDiscounts(counterpartyId?)
 *   getCounterparties() / getCounterparty(id)
 *   saveCounterparty({ id?, name, inn, priceType, code })  → в т.ч. привязка типа цены
 *   loginCounterparty(id, code)                    → демо-вход покупателя-контрагента
 *   createOrder({ outletId, items:[{sku, qty, outletId}], customer, counterpartyId })
 *   getPriceLog()                                  → журнал «отправлено в 1С» (mock)
 *
 * ТЕКУЩАЯ РЕАЛИЗАЦИЯ — MOCK (ДЕМО): всё хранится в localStorage браузера,
 * «отправка в 1С» только пишется в консоль и журнал. Контрагенты — вымышленные.
 *
 * ЦЕЛЕВАЯ СИСТЕМА: 1С:УНФ («Управление нашей фирмой») в облаке.
 * Способ обмена УТОЧНЯЕТСЯ: стандартный REST-интерфейс OData УНФ
 * (/odata/standard.odata/…) и/или HTTP-сервисы УНФ (собственное расширение).
 * Рекомендуется вызывать 1С не из браузера, а через backend-прокси на carvic.ru
 * (учётные данные 1С не попадают на клиент, кэш цен/остатков, авторизация).
 *
 * СООТВЕТСТВИЕ СУЩНОСТЯМ УНФ (имена объектов OData — уточнить по публикации):
 *   Товар / SKU (part.sku)  → Справочник «Номенклатура» (Catalog_Номенклатура: Артикул, Ref_Key);
 *                             группа товара (productGroup) → группа/категория номенклатуры
 *   Торговая точка (outletId) → «Структурные единицы» / склады УНФ (Catalog_СтруктурныеЕдиницы)
 *   Остатки (getStock*)      → регистр накопления «Запасы» по структурной единице
 *                             (AccumulationRegister_Запасы/Balance) за вычетом резервов
 *   Типы цен (getPriceTypes) → Справочник «Типы цен» (Catalog_ВидыЦен)
 *   Базовые цены             → регистр сведений «Цены номенклатуры» (InformationRegister_ЦеныНоменклатуры)
 *                             + документ «Установка цен номенклатуры» при изменении
 *   Контрагенты              → Справочник «Контрагенты» (Catalog_Контрагенты); тип цены контрагента —
 *                             из договора/соглашения контрагента (вид цен по умолчанию)
 *   Скидки по группам        → «Скидки (наценки)» / автоматические скидки УНФ с условием по
 *                             контрагенту и группе номенклатуры (механизм уточняется)
 *   Индивидуальные цены      → цены контрагента (отдельный тип цен на контрагента или
 *                             регистр цен контрагентов) — способ хранения уточняется
 *   createOrder              → документ «Заказ покупателя» (Document_ЗаказПокупателя):
 *                             Контрагент, СтруктурнаяЕдиница (точка выдачи), ВидЦен,
 *                             табличная часть «Запасы» (Номенклатура, Количество, Цена,
 *                             структурная единица резерва = item.outletId)
 *
 * Пример маршрутов backend-прокси (сигнатуры методов ниже при переходе НЕ меняются):
 *   GET  /api/1c/stock?sku=…                       → Запасы по структурным единицам
 *   POST /api/1c/prices        { skus, counterpartyId }
 *   GET  /api/1c/price-types                       → Типы цен
 *   POST /api/1c/prices/base   { sku, priceTypeId, value } → «Установка цен номенклатуры»
 *   POST /api/1c/prices/individual { sku, counterpartyId, value }
 *   POST /api/1c/discounts     { counterpartyId, productGroup, discountPercent }
 *   GET  /api/1c/counterparties                    → Контрагенты
 *   POST /api/1c/orders        { outletId, items, customer, counterpartyId } → Заказ покупателя
 * Правило синхронизации: 1С — мастер цен. Сайт сохраняет цены только через 1С
 * и показывает их после успешного ответа, поэтому в 1С и на сайте цены совпадают.
 * ===================================================================== */
(function () {
  'use strict';

  var MOCK_LATENCY_MS = 100; // имитация сетевой задержки
  var LS = {
    types: 'carvic_1c_mock_price_types',
    base: 'carvic_1c_mock_base_prices',        // { 'sku|typeId': value }
    ind: 'carvic_1c_mock_individual_prices',   // { 'sku|cpId': value }
    disc: 'carvic_1c_mock_group_discounts',    // { 'cpId|group': percent }
    cp: 'carvic_1c_mock_counterparties',
    log: 'carvic_1c_mock_log'
  };

  function delay(v) { return new Promise(function (r) { setTimeout(function () { r(v); }, MOCK_LATENCY_MS); }); }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function outlets() { return (window.COMPANY && window.COMPANY.stores) || []; }
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } }
  function log(action, data) {
    var e = { at: new Date().toISOString(), action: action, data: data, status: 'отправлено в 1С (mock)' };
    var l = lsGet(LS.log, []); l.unshift(e); lsSet(LS.log, l.slice(0, 300));
    if (window.console) console.info('[OneC mock] отправлено в 1С: ' + action, data);
    return e;
  }
  function rub(v) { return Math.round(v); }

  /* ---------- MOCK: виды цен. defaultPercent — ДЕМО-правило «−N % от розницы» для SKU без своей цены ---------- */
  var DEFAULT_TYPES = [
    { id: 'retail', name: 'Розница', defaultPercent: 0 },
    { id: 'opt1', name: 'Опт 1', defaultPercent: 8 },
    { id: 'opt2', name: 'Опт 2', defaultPercent: 12 }
  ];
  function types() { return lsGet(LS.types, null) || DEFAULT_TYPES.slice(); }
  function typeById(id) { return types().filter(function (t) { return t.id === id; })[0] || null; }
  function checkType(id) { if (!typeById(id)) throw new Error('Неизвестный тип цены: ' + id); }

  /* ---------- MOCK: контрагенты (ВЫМЫШЛЕННЫЕ демо-записи) ---------- */
  var DEFAULT_CPS = [
    { id: 'cp-demo-1', name: 'ООО «Демо Автосервис» (пример)', inn: 'демо', priceType: 'opt1', code: 'demo' },
    { id: 'cp-demo-2', name: 'ИП Демо Пётр (пример)', inn: 'демо', priceType: 'opt2', code: 'demo' },
    { id: 'cp-demo-3', name: 'Демо розничный клиент (пример)', inn: '—', priceType: 'retail', code: 'demo' }
  ];
  function cps() { return lsGet(LS.cp, null) || DEFAULT_CPS.slice(); }
  function cpById(id) { return cps().filter(function (c) { return c.id === id; })[0] || null; }

  /* ---------- MOCK: группа товара по SKU (в 1С — «Номенклатурная группа») ---------- */
  var groupMap = null;
  function groupOf(sku) {
    if (!groupMap) { groupMap = {}; (window.PARTS || []).forEach(function (p) { groupMap[p.sku] = p.cat; }); }
    return groupMap[sku] || null;
  }
  function groupName(g) { var c = (window.CATEGORIES || []).filter(function (x) { return x.key === g; })[0]; return c ? c.name : g; }

  /* Фикстура для совместного экрана поиска. Это не инвентаризация CARVIC. */
  var FIXTURE_QTY = {
    'fx-333114': { 'irk-sergeeva-45': 6, 'irk-priboy-91a': 4, 'irk-priboy-77': 0 },
    'fx-333114-zero': { 'irk-sergeeva-45': 0, 'irk-priboy-91a': 0, 'irk-priboy-77': 0 },
    'fx-spark': { 'irk-sergeeva-45': 8, 'irk-priboy-91a': 3, 'irk-priboy-77': 0 },
    'fx-brake': { 'irk-sergeeva-45': 2, 'irk-priboy-91a': 0, 'irk-priboy-77': 5 }
  };
  /* ---------- MOCK: остатки (детерминированные, 0–12 шт.) ---------- */
  function mockQty(outletId, sku) {
    var demo = window.CarvicApp && window.CarvicApp.state && window.CarvicApp.state.demoUi;
    if (!demo) return 0;
    var fixed = FIXTURE_QTY[sku];
    if (fixed && Object.prototype.hasOwnProperty.call(fixed, outletId)) return fixed[outletId];
    var known = (window.PARTS || []).some(function (part) { return part.sku === sku; });
    if (!known) return 0;
    var h = hash(outletId + '|' + sku);
    return (h % 4 === 0) ? 0 : (h % 13);
  }

  /* ---------- Базовая цена по типу ---------- */
  function basePrice(sku, typeId) {
    var ov = lsGet(LS.base, {});
    if (ov[sku + '|' + typeId] != null) return ov[sku + '|' + typeId];
    var b = (window.__MOCK_1C_BASE_PRICES || {})[sku];
    if (b == null) return null;
    if (typeId === 'retail') { if (ov[sku + '|retail'] != null) return ov[sku + '|retail']; return b; }
    var t = typeById(typeId) || { defaultPercent: 0 };
    var retail = ov[sku + '|retail'] != null ? ov[sku + '|retail'] : b;
    return Math.round(retail * (1 - (t.defaultPercent || 0) / 100) / 10) * 10;
  }

  /* ---------- Расчёт цены: индивидуальная → базовая по типу − скидка группы ---------- */
  function resolvePrice(sku, counterpartyId) {
    var cp = counterpartyId ? cpById(counterpartyId) : null;
    var typeId = cp && typeById(cp.priceType) ? cp.priceType : 'retail';
    var t = typeById(typeId) || { id: 'retail', name: 'Розница' };
    var group = groupOf(sku);
    var steps = [];
    var r = { sku: sku, counterpartyId: cp ? cp.id : null, priceType: typeId, priceTypeName: t.name, group: group, groupName: groupName(group), currency: 'RUB' };
    if (cp) {
      var ind = lsGet(LS.ind, {})[sku + '|' + cp.id];
      if (ind != null) {
        steps.push('Индивидуальная цена контрагента по товару: ' + ind + ' ₽ (скидки по группе не применяются)');
        r.price = ind; r.source = 'individual'; r.base = basePrice(sku, typeId); r.discountPercent = 0; r.steps = steps;
        return r;
      }
      steps.push('Индивидуальной цены по товару нет');
    } else {
      steps.push('Покупатель не авторизован — тип цены «Розница»');
    }
    var base = basePrice(sku, typeId);
    steps.push('Базовая цена по типу «' + t.name + '»: ' + base + ' ₽');
    var d = cp ? (lsGet(LS.disc, {})[cp.id + '|' + group] || 0) : 0;
    if (d) {
      var p = rub(base * (1 - d / 100));
      steps.push('Скидка по группе «' + groupName(group) + '»: −' + d + ' % → ' + p + ' ₽');
      r.price = p; r.source = 'base-discount';
    } else {
      if (cp) steps.push('Скидки по группе «' + groupName(group) + '» нет');
      r.price = base; r.source = 'base';
    }
    r.base = base; r.discountPercent = d; r.steps = steps;
    return r;
  }
  function validValue(v) { v = Number(v); return isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null; }

  var OneC = {
    mode: 'mock',

    /* ----- Торговые точки и остатки ----- */
    getOutlets: function () { return delay(outlets().slice()); },
    getStock: function (outletId, sku) { return delay({ outletId: outletId, sku: sku, qty: mockQty(outletId, sku) }); },
    getStockAll: function (sku) {
      return delay(outlets().map(function (o) { return { outletId: o.id, sku: sku, qty: mockQty(o.id, sku) }; }));
    },
    getStocks: function (skus) {
      var res = {};
      (skus || []).forEach(function (s) { res[s] = {}; outlets().forEach(function (o) { res[s][o.id] = mockQty(o.id, s); }); });
      return delay(res);
    },

    /* ----- Цены (не зависят от точки) ----- */
    getPrice: function (sku) { return this.getPrices([sku]).then(function (map) { return map[sku]; }); },
    explainPrice: function (sku) { return this.getPrice(sku); },
    getPrices: function (skus) {
      return fetch('/api/catalog/state', { headers: { Accept: 'application/json' }, credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('Сервер цен недоступен. Цена из браузера не подставляется.');
        return r.json();
      }).then(function (data) {
        var res = {};
        (skus || []).forEach(function (s) {
          var row = data.prices && data.prices[s];
          res[s] = {
            sku: s,
            price: row ? row.retail : null,
            source: row ? row.source : 'missing',
            priceType: 'retail',
            priceTypeName: 'Розница',
            steps: ['Цена пришла с сервера. Браузер её не назначает. Это не запись 1С.']
          };
        });
        return res;
      });
    },

    /* ----- Виды цен ----- */
    getPriceTypes: function () {
      return fetch('/api/catalog/state', { headers: { Accept: 'application/json' }, credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('Сервер цен недоступен.');
        return r.json();
      }).then(function (data) { return data.types || []; });
    },
    savePriceType: function () { return Promise.reject(new Error('Тип цены не записывается в браузер.')); },
    getBasePrice: function (sku, typeId) { checkType(typeId); return delay(basePrice(sku, typeId)); },
    getBasePrices: function (skus) {
      return fetch('/api/catalog/state', { headers: { Accept: 'application/json' }, credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('Сервер цен недоступен.');
        return r.json();
      }).then(function (data) {
        var res = {};
        (skus || []).forEach(function (s) { res[s] = (data.base && data.base[s]) || {}; });
        return res;
      });
    },
    setBasePrice: function () { return Promise.reject(new Error('Цена не записывается в браузер.')); },

    /* ----- Индивидуальные цены ----- */
    setPrice: function () { return Promise.reject(new Error('Цена не записывается в браузер.')); },
    removePrice: function () { return Promise.reject(new Error('Цена не записывается в браузер.')); },
    getIndividualPrices: function (counterpartyId) {
      return fetch('/api/catalog/state', { headers: { Accept: 'application/json' }, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
        return (data.individual || []).filter(function (row) { return !counterpartyId || row.counterparty_id === counterpartyId; }).map(function (row) {
          return { sku: row.sku, counterpartyId: row.counterparty_id, value: row.rub };
        });
      });
    },

    /* ----- Скидки по группам товаров ----- */
    setGroupDiscount: function () { return Promise.reject(new Error('Скидка не записывается в браузер.')); },
    getGroupDiscounts: function (counterpartyId) {
      return fetch('/api/catalog/state', { headers: { Accept: 'application/json' }, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (data) {
        return (data.discounts || []).filter(function (row) { return !counterpartyId || row.counterparty_id === counterpartyId; }).map(function (row) {
          return { counterpartyId: row.counterparty_id, productGroup: row.product_group, discountPercent: row.percent };
        });
      });
    },

    /* ----- Контрагенты ----- */
    getCounterparties: function () {
      return fetch('/api/catalog/state', { headers: { Accept: 'application/json' }, credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('Сервер цен недоступен.');
        return r.json();
      }).then(function (data) { return data.counterparties || []; });
    },
    getCounterparty: function (id) {
      return this.getCounterparties().then(function (list) { return list.filter(function (c) { return c.id === id; })[0] || null; });
    },
    saveCounterparty: function () { return Promise.reject(new Error('Контрагент не записывается в браузер.')); },
    loginCounterparty: function () {
      return Promise.reject(new Error('Вход контрагента закрыт: SMS-провайдер не подключён. Код из браузера не принимается.'));
    },

    /* ----- Заказ ----- */
    createOrder: function (order) {
      if (!order.outletId) return Promise.reject(new Error('Не выбрана торговая точка'));
      if (!order.items || !order.items.length) return Promise.reject(new Error('Корзина пуста'));
      var cp = order.counterpartyId ? cpById(order.counterpartyId) : null;
      var total = 0;
      var items = order.items.map(function (it) {
        var r = resolvePrice(it.sku, cp && cp.id);
        var oid = it.outletId || order.outletId;
        total += (r.price || 0) * it.qty;
        return { sku: it.sku, qty: it.qty, outletId: oid, price: r.price, priceSource: r.source, discountPercent: r.discountPercent, sum: (r.price || 0) * it.qty };
      });
      var result = {
        orderId: 'DEMO-' + Date.now().toString().slice(-6), status: 'accepted (mock)',
        outletId: order.outletId, counterpartyId: cp ? cp.id : null,
        priceType: cp ? cp.priceType : 'retail', customerType: order.customerType || null,
        customer: order.customer, items: items, total: total, createdAt: new Date().toISOString()
      };
      log('createOrder', result);
      return delay(result);
    },

    getPriceLog: function () { return delay(lsGet(LS.log, [])); },

    /* Только для демо: сброс всех mock-данных 1С */
    resetMock: function () { return Promise.reject(new Error('Сброс цен выполняется только на сервере администратора.')); }
  };

  window.OneC = OneC;
})();
