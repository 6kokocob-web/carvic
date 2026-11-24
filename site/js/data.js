/* =====================================================================
 * CARVIC — данные прототипа
 *
 * ВНИМАНИЕ: всё, что ниже раздела COMPANY (каталог, цены, марки/модели,
 * результаты расшифровки VIN, наличие), — ДЕМОНСТРАЦИОННЫЕ ДАННЫЕ (mock).
 * Они нужны только для показа работы интерфейса и подлежат замене
 * реальным каталогом (API поставщиков / собственная учётная система).
 *
 * Реальные данные компании находятся только в объекте COMPANY.
 * ===================================================================== */

/* ---------- Реальные данные компании (предоставлены заказчиком) ---------- */
window.COMPANY = {
  name: 'ООО "Карвик"',
  nameShort: 'ООО «Карвик»',
  brand: 'CARVIC',
  domain: 'carvic.ru',
  email: 'info@carvic.ru', // общая почта; сервер может подменить через CARVIC_PUBLIC_EMAIL — там тоже info@carvic.ru
  // Блок бонусной программы на главной (видят только гости; после регистрации бонусная карта
  // оформляется автоматически — сервер передаёт клиента в 1С). Тексты правятся здесь.
  bonus: {
    title: 'Бонусы за покупки',
    text: 'Введите госномер — найдём ваш автомобиль и оформим бонусную карту.',
    cta: 'Получить бонусы'
  },
  // Мессенджеры и 2ГИС: значки в подвале, на «Контактах» и под картой на главной.
  // Пустая строка — значок на carvic.ru не показывается (на тестовой ссылке виден серым, «ссылка не задана»).
  //   telegram: 'https://t.me/имя_канала_или_бота'    vk: 'https://vk.com/имя_сообщества'
  //   max: 'https://max.ru/…'
  social: {
    telegram: '',
    max: '',
    vk: '',
    gis: 'https://2gis.ru/irkutsk/search/CARVIC' // поиск по сети в 2ГИС: все павильоны сразу
  },
  phone: '+7 (3952) 57-57-57',
  phoneHref: '+73952575757',
  legalAddress: 'Улан-Удэ, ул. Музейная, 1',
  actualAddress: 'Иркутск, ул. Генерала Доватора, 39, пав. 91/а',
  people: [
    { role: 'Генеральный директор', name: 'Серебряков А.В.' },
    { role: 'Исполнительный директор', name: 'Шагинян Рафаэль Камоевич' }
  ],
  requisites: [
    ['Полное наименование', 'Общество с ограниченной ответственностью "Карвик"'],
    ['Сокращённое наименование', 'ООО "Карвик"'],
    ['Юридический адрес', 'Улан-Удэ, ул. Музейная, 1'],
    ['Фактический адрес', 'Иркутск, ул. Генерала Доватора, 39, пав. 91/а'],
    ['ОГРН', '1260300003677'],
    ['ИНН / КПП', '0300040678 / 30001001'],
    ['ОКПО', '62171456'],
    ['Банк', 'АО «ТБанк»'],
    ['БИК', '044525974'],
    ['Расчётный счёт', '40702810110002279330'],
    ['Корр. счёт', '30101810145250000974'],
    ['Рег. номер ПФР', '1404490227'],
    ['Генеральный директор', 'Серебряков А.В.'],
    ['E-mail', 'Shaginyan@carvic.ru'],
    ['Телефон', '+7 (3952) 57-57-57']
  ],
  stores: [
    { id: 'irk-sergeeva-45', short: 'Сергеева, пав. 45', title: 'Автосити на Сергеевском', city: 'Иркутск', address: 'ул. Сергеева, 3/8а, пав. 45', gisUrl: 'https://2gis.ru/irkutsk/firm/70000001118087497', gisStatus: 'confirmed', hours: 'Пн–Сб 09:00–19:00, Вс 10:00–18:00', timezone: 'Asia/Irkutsk', hoursSource: '2gis', hoursVerifiedOn: '2026-11-08' },
    { id: 'irk-priboy-91a', short: 'Прибой, пав. 91/а', title: 'ТЦ «Прибой»', city: 'Иркутск', address: 'ул. Генерала Доватора, 39, пав. 91/а', gisUrl: 'https://2gis.ru/irkutsk/firm/70000001117000637', gisStatus: 'confirmed', hours: 'Пн–Вс 09:00–19:00', timezone: 'Asia/Irkutsk', hoursSource: '2gis', hoursVerifiedOn: '2026-11-08' },
    { id: 'irk-priboy-77', short: 'Прибой, пав. 77', title: 'ТЦ «Прибой»', city: 'Иркутск', address: 'ул. Генерала Доватора, 39, пав. 77', gisUrl: 'https://2gis.ru/irkutsk/firm/70000001118855620', gisStatus: 'confirmed', hours: 'Пн–Вс 09:00–19:00', timezone: 'Asia/Irkutsk', hoursSource: '2gis', hoursVerifiedOn: '2026-11-08' }
  ],
  // Магазины для витрины (карта, главная, «Торговые точки», «Контакты»), но пока НЕ точки складского учёта:
  // остатков, выбора точки в корзине и самовывоза по ним нет. Все магазины будут заведены в 1С как склады
  // (продажи и доставка) — тогда запись переносится в stores выше, с теми же id.
  // soon: true — «Скоро открытие»: показывается с пометкой и не входит в счётчики «N магазинов».
  extraStores: [
    { id: 'ang-avtomir-20', title: 'Автомир', city: 'Ангарск', address: 'ул. Чайковского, 1а, пав. 20', gisUrl: '', hours: 'Пн–Пт 09:00–19:00, Сб 10:00–18:00, Вс 10:00–17:00', timezone: 'Asia/Irkutsk', hoursSource: 'owner' },
    { id: 'ang-avtomir-32', title: 'Автомир', city: 'Ангарск', address: 'ул. Чайковского, 1а, пав. 32', gisUrl: '', hours: 'Пн–Пт 09:00–19:00, Сб 10:00–18:00, Вс 10:00–17:00', timezone: 'Asia/Irkutsk', hoursSource: 'owner' },
    { id: 'irk-avtograd-12', title: 'ТЦ «Автоград»', city: 'Иркутск', address: 'ул. Франк-Каменецкого, 2, пав. 12', gisUrl: '', hours: 'Пн–Вс 10:00–18:00', timezone: 'Asia/Irkutsk', hoursSource: 'owner', soon: true }
  ],
  hours: 'Пн–Сб 09:00–19:00; вс пав. 45 10:00–18:00, остальные точки 09:00–19:00, местное время Иркутска (Asia/Irkutsk)',
  hoursSource: '2gis',
  hoursVerifiedOn: '2026-11-08',
  hoursNote: 'Перерывы и исключения в карточках 2ГИС не указаны. Праздничные часы не обещаются.'
};

/* ======================= DEMO / MOCK DATA ============================ */

/* Марки и модели (демо-справочник для подбора) */
window.MAKES = {
  'Toyota':     ['Camry', 'Corolla', 'RAV4', 'Land Cruiser Prado', 'Prius'],
  'Nissan':     ['Almera', 'Qashqai', 'X-Trail', 'Note', 'Teana'],
  'Honda':      ['Civic', 'CR-V', 'Fit', 'Accord'],
  'Mitsubishi': ['Lancer', 'Outlander', 'Pajero Sport', 'ASX'],
  'Hyundai':    ['Solaris', 'Creta', 'Tucson', 'Elantra'],
  'Kia':        ['Rio', 'Sportage', 'Cerato', 'Sorento'],
  'Haval':      ['Jolion', 'F7', 'H6', 'Dargo'],
  'Chery':      ['Tiggo 4', 'Tiggo 7 Pro', 'Tiggo 8'],
  'Geely':      ['Coolray', 'Atlas', 'Monjaro'],
  'Volkswagen': ['Polo', 'Tiguan', 'Passat', 'Golf'],
  'Lada':       ['Vesta', 'Granta', 'Niva Travel', 'Largus']
};
window.YEARS = (function () { var a = []; for (var y = 2026; y >= 2005; y--) a.push(y); return a; })();

/* Категории каталога. key — используется в хэш-роутинге и на схеме авто */
window.CATEGORIES = [
  { key: 'engine',     name: 'Двигатель',          icon: 'piston' },
  { key: 'brakes',     name: 'Тормозная система',  icon: 'disc' },
  { key: 'suspension', name: 'Подвеска',           icon: 'shock' },
  { key: 'electrics',  name: 'Электрика',          icon: 'plug' },
  { key: 'body',       name: 'Кузов и оптика',     icon: 'mirror' },
  { key: 'filters',    name: 'Фильтры',            icon: 'filter' },
  { key: 'transmission', name: 'Трансмиссия',      icon: 'axle' },
  { key: 'cooling',    name: 'Охлаждение',         icon: 'radiator' },
  { key: 'exhaust',    name: 'Выхлопная система',  icon: 'muffler' },
  { key: 'fluids',     name: 'Масла и жидкости',   icon: 'oil' }
];

/* Производители запчастей (демо-список для фильтра) */
window.BRANDS = ['Bosch', 'Mann-Filter', 'Brembo', 'TRW', 'KYB', 'Sachs', 'NGK', 'Denso',
  'Febi', 'Lemförder', 'Mahle', 'Valeo', 'Gates', 'SKF', 'Castrol', 'Varta', 'Toyota (OEM)', 'Nissan (OEM)', 'Hyundai/Kia (OEM)'];

/* Шаблоны товаров: [категория, название, тип иконки, базовая цена, бренды] */
var PART_TEMPLATES = [
  ['brakes', 'Тормозные колодки передние', 'pads', 1500, ['Brembo', 'TRW', 'Bosch', 'Febi']],
  ['brakes', 'Тормозные колодки задние', 'pads', 1300, ['Brembo', 'TRW', 'Bosch']],
  ['brakes', 'Тормозной диск передний', 'disc', 3500, ['Brembo', 'TRW', 'Bosch']],
  ['brakes', 'Тормозной диск задний', 'disc', 2900, ['Brembo', 'TRW']],
  ['brakes', 'Суппорт тормозной', 'caliper', 7800, ['TRW', 'Bosch', 'Brembo']],
  ['brakes', 'Тормозная жидкость DOT-4, 1 л', 'oil', 650, ['Bosch', 'Castrol', 'TRW']],
  ['suspension', 'Амортизатор передний', 'shock', 4900, ['KYB', 'Sachs']],
  ['suspension', 'Амортизатор задний', 'shock', 4200, ['KYB', 'Sachs']],
  ['suspension', 'Рычаг подвески нижний', 'arm', 3800, ['Lemförder', 'Febi', 'TRW']],
  ['suspension', 'Стойка стабилизатора', 'link', 950, ['Lemförder', 'Febi', 'TRW']],
  ['suspension', 'Ступичный подшипник', 'bearing', 2600, ['SKF', 'Febi']],
  ['suspension', 'Пружина подвески', 'spring', 2700, ['Sachs', 'KYB', 'Lemförder']],
  ['electrics', 'Свеча зажигания', 'plug', 490, ['NGK', 'Denso', 'Bosch']],
  ['electrics', 'Катушка зажигания', 'coil', 3200, ['Bosch', 'Denso', 'NGK']],
  ['electrics', 'Аккумулятор 60 А·ч', 'battery', 7900, ['Bosch', 'Varta']],
  ['electrics', 'Генератор', 'alternator', 15900, ['Bosch', 'Denso', 'Valeo']],
  ['electrics', 'Лампа H7', 'bulb', 450, ['Bosch', 'Valeo']],
  ['electrics', 'Датчик ABS', 'sensor', 1900, ['Bosch', 'Febi', 'Denso']],
  ['engine', 'Ремень ГРМ', 'belt', 2300, ['Gates', 'Bosch', 'SKF']],
  ['engine', 'Комплект ГРМ с помпой', 'belt', 9800, ['Gates', 'SKF']],
  ['engine', 'Поршень STD', 'piston', 4100, ['Mahle']],
  ['engine', 'Прокладка ГБЦ', 'gasket', 1800, ['Febi', 'Mahle']],
  ['engine', 'Масляный насос', 'pump', 5200, ['Toyota (OEM)', 'Nissan (OEM)', 'Hyundai/Kia (OEM)']],
  ['engine', 'Опора двигателя', 'mount', 2900, ['Febi', 'Lemförder']],
  ['filters', 'Масляный фильтр', 'filter', 590, ['Mann-Filter', 'Mahle', 'Bosch', 'Toyota (OEM)', 'Nissan (OEM)', 'Hyundai/Kia (OEM)']],
  ['filters', 'Воздушный фильтр', 'airfilter', 890, ['Mann-Filter', 'Mahle', 'Bosch']],
  ['filters', 'Салонный фильтр', 'airfilter', 790, ['Mann-Filter', 'Mahle', 'Bosch', 'Denso']],
  ['filters', 'Топливный фильтр', 'filter', 1200, ['Mann-Filter', 'Bosch']],
  ['transmission', 'ШРУС наружный', 'axle', 4600, ['SKF', 'Febi']],
  ['transmission', 'Привод в сборе', 'axle', 11900, ['SKF']],
  ['transmission', 'Комплект сцепления', 'clutch', 9900, ['Sachs', 'Valeo']],
  ['cooling', 'Радиатор охлаждения', 'radiator', 8900, ['Denso', 'Valeo', 'Mahle']],
  ['cooling', 'Помпа водяная', 'pump', 3400, ['SKF', 'Gates', 'Febi']],
  ['cooling', 'Термостат', 'thermostat', 1400, ['Mahle', 'Febi']],
  ['cooling', 'Антифриз G12, 5 л', 'oil', 1600, ['Castrol', 'Febi']],
  ['body', 'Фара передняя левая', 'headlight', 12900, ['Valeo', 'Denso']],
  ['body', 'Зеркало боковое правое', 'mirror', 5400, ['Valeo']],
  ['body', 'Щётка стеклоочистителя 600 мм', 'wiper', 690, ['Bosch', 'Valeo', 'Denso']],
  ['body', 'Бампер передний', 'bumper', 9900, ['Febi']],
  ['exhaust', 'Глушитель основной', 'muffler', 6900, ['Bosch', 'Febi']],
  ['exhaust', 'Лямбда-зонд', 'sensor', 4800, ['Bosch', 'Denso', 'NGK']],
  ['exhaust', 'Прокладка приёмной трубы', 'gasket', 350, ['Febi', 'Mahle']],
  ['fluids', 'Моторное масло 5W-30, 4 л', 'oil', 3900, ['Castrol', 'Mahle']],
  ['fluids', 'Масло трансмиссионное ATF, 1 л', 'oil', 1100, ['Castrol', 'Febi']]
];

/* Генерация демо-каталога (детерминированно, без случайности между загрузками) */
/* Mock-таблица базовых цен — читается только mock-реализацией js/api/onec.js */
window.__MOCK_1C_BASE_PRICES = {};

window.PARTS = (function () {
  var parts = [], id = 1;
  var makes = Object.keys(window.MAKES);
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  PART_TEMPLATES.forEach(function (t, ti) {
    var brands = t[4].filter(Boolean).filter(function (b, i, a) { return a.indexOf(b) === i; });
    brands.forEach(function (brand, bi) {
      var h = hash(t[1] + brand);
      // Совместимость: несколько марок на позицию (демо)
      var compat = makes.filter(function (m, mi) { return ((h >>> (mi % 24)) & 3) !== 0; });
      if (!compat.length) compat = makes.slice(0, 3);
      if (brand === 'Toyota (OEM)') compat = ['Toyota'];
      if (brand === 'Nissan (OEM)') compat = ['Nissan'];
      if (brand === 'Hyundai/Kia (OEM)') compat = ['Hyundai', 'Kia'];
      var k = 0.8 + (h % 70) / 100; // разброс цены (демо)
      var price = Math.round(t[3] * k / 10) * 10;
      var art = (brand.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'OEM') + '-' + (100000 + (h % 899999));
      var oem = String(10000 + (h % 89999)) + '-' + String(1000 + ((h >>> 7) % 8999)).slice(0, 4);
      var sku = art; // SKU = артикул; в 1С будет код/артикул номенклатуры
      // Базовая цена кладётся ТОЛЬКО в mock-таблицу слоя 1С (js/api/onec.js), не в карточку товара
      window.__MOCK_1C_BASE_PRICES[sku] = price;
      parts.push({
        id: 'p' + (id++), sku: sku, cat: t[0], name: t[1], icon: t[2], brand: brand,
        article: art, oem: oem, compat: compat
      });
    });
  });
  return parts;
})();

/* Две демо-позиции с артикулом 333114, чтобы поиск показал своё наличие и «Под заказ».
 * Подпись «фикстура»: это не склад магазина. Цены лежат только в таблице слоя 1С. */
(function () {
  var extra = [
    { sku: 'fx-333114', cat: 'suspension', name: 'Стойка амортизационная (фикстура)', icon: 'shock', brand: 'KYB', article: '333114', oem: '48520-33311', compat: ['Toyota'], price: 2450 },
    { sku: 'fx-333114-zero', cat: 'suspension', name: 'Опора стойки (фикстура, без остатка)', icon: 'shock', brand: 'Febi', article: 'FX-018877', oem: '333114', compat: ['Toyota'], price: 890 },
    { sku: 'fx-spark', cat: 'electrics', name: 'Свеча зажигания (фикстура каталога)', icon: 'plug', brand: 'NGK', article: 'DEMO-SPARK-01', oem: 'DEMO-OEM-IGN-03', compat: ['Toyota'], price: 640 },
    { sku: 'fx-brake', cat: 'brakes', name: 'Колодки тормозные (фикстура каталога)', icon: 'pads', brand: 'TRW', article: 'DEMO-BRAKE-01', oem: 'DEMO-OEM-BRK-02', compat: ['Toyota'], price: 2100 }
  ];
  extra.forEach(function (p) {
    window.__MOCK_1C_BASE_PRICES[p.sku] = p.price;
    window.PARTS.unshift({
      id: p.sku, sku: p.sku, cat: p.cat, name: p.name, icon: p.icon, brand: p.brand,
      article: p.article, oem: p.oem, compat: p.compat, fixture: true
    });
  });
})();

/* Демо-VIN, которые гарантированно «расшифровываются» (для тестирования) */
window.DEMO_VINS = {
  'JTNB11HK103456789': { make: 'Toyota', model: 'Camry', year: 2019, engine: '2.5 бензин', body: 'седан' },
  'Z94K241CBNR123456': { make: 'Hyundai', model: 'Solaris', year: 2022, engine: '1.6 бензин', body: 'седан' },
  'XTAGFK330NY654321': { make: 'Lada', model: 'Vesta', year: 2022, engine: '1.6 бензин', body: 'седан' }
};

/* Демо-сопоставление WMI (первые символы VIN) → марка. Не является полноценным декодером. */
window.WMI = {
  'JT': 'Toyota', 'NMT': 'Toyota', 'XW7': 'Toyota', 'JN': 'Nissan', 'Z8N': 'Nissan', 'SJN': 'Nissan',
  'JH': 'Honda', 'SHH': 'Honda', 'JMB': 'Mitsubishi', 'JA': 'Mitsubishi', 'Z8T': 'Mitsubishi',
  'KMH': 'Hyundai', 'Z94': 'Hyundai', 'KNA': 'Kia', 'KNE': 'Kia', 'XWE': 'Kia', 'LGW': 'Haval', 'XZG': 'Haval',
  'LVV': 'Chery', 'LVT': 'Chery', 'L6T': 'Geely', 'Y4K': 'Geely', 'WVW': 'Volkswagen', 'WVG': 'Volkswagen', 'XW8': 'Volkswagen',
  'XTA': 'Lada', 'XTT': 'Lada'
};
/* Код модельного года (10-й символ VIN) */
window.VIN_YEAR = { A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017, J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025, T: 2026,
  '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009 };
