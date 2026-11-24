/* Порядок строк поиска: сначала своё наличие, затем блок «Под заказ», затем свои позиции без остатка. */
(function (root) {
  'use strict';

  function outletsInStock(stores, qtyByOutlet) {
    var qty = qtyByOutlet || {};
    return (stores || []).filter(function (store) { return (qty[store.id] || 0) > 0; }).map(function (store) {
      return { id: store.id, name: store.short || store.name || store.id, qty: qty[store.id] };
    });
  }

  function rankOwn(parts, qtyBySku, stores) {
    var inStock = [];
    var outOfStock = [];
    (parts || []).forEach(function (part) {
      var qty = (qtyBySku && qtyBySku[part.sku]) || {};
      var outlets = outletsInStock(stores, qty);
      var total = outlets.reduce(function (sum, outlet) { return sum + outlet.qty; }, 0);
      var row = {
        sku: part.sku,
        brand: part.brand,
        article: part.article,
        name: part.name,
        outlets: outlets,
        total: total
      };
      if (total > 0) inStock.push(row);
      else outOfStock.push(row);
    });
    inStock.sort(function (a, b) {
      if (b.total !== a.total) return b.total - a.total;
      return String(a.brand || '').localeCompare(String(b.brand || ''), 'ru');
    });
    return { inStock: inStock, outOfStock: outOfStock };
  }

  function composeSearchHtml(blocks) {
    blocks = blocks || {};
    return [blocks.demoNote, blocks.inStock, blocks.partner, blocks.outOfStock].filter(Boolean).join('');
  }

  root.CarvicSearchRank = {
    outletsInStock: outletsInStock,
    rankOwn: rankOwn,
    composeSearchHtml: composeSearchHtml
  };
})(typeof window !== 'undefined' ? window : globalThis);
