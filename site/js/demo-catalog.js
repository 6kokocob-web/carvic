/* Иллюстративный демо-каталог CARVIC для всех узлов автомобиля.
 * Один и тот же сценарий: VIN → узел → схема → позиция → номер → наличие.
 * Это не лицензированный VIN-каталог и не заводские чертежи.
 * Номера DEMO-* нельзя отправлять в поиск поставщика.
 */
(function (root) {
  'use strict';

  var VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
  var GAP = 'Схема этого узла в демо-каталоге не подготовлена. Другой узел вместо неё не открывается, применимость не подставляется.';

  var KNOWN = {
    'JTNB11HK103456789': { make: 'Toyota', model: 'Camry', year: 2019, engine: '2.5 бензин', body: 'седан', catalog: true },
    'Z94K241CBNR123456': { make: 'Hyundai', model: 'Solaris', year: 2022, engine: '1.6 бензин', body: 'седан', catalog: false },
    'XTAGFK330NY654321': { make: 'Lada', model: 'Vesta', year: 2022, engine: '1.6 бензин', body: 'седан', catalog: false }
  };

  function part(pos, name, oem, x, y, extra) {
    extra = extra || {};
    return {
      pos: pos, name: name, oem: oem, x: x, y: y,
      sku: extra.sku || null,
      partner: extra.partner || []
    };
  }

  function offer(brand, article, days, price) {
    return { brand: brand, partnumber: article, name: 'Фикстура каталога', lines: [{ deliveryDays: days, price: price }] };
  }

  function diagram(id, group, subgroup, title, summary, sketch, parts) {
    return { id: id, group: group, subgroup: subgroup, title: title, summary: summary, sketch: sketch, parts: parts };
  }

  var SK = {
    coil: '<rect x="160" y="78" width="200" height="34" rx="6" fill="none" stroke="#17181c" stroke-width="2"></rect><path d="M190 112 C190 160 120 160 120 200 M260 112 V200 M330 112 C330 160 400 160 400 200" fill="none" stroke="#e10600" stroke-width="2"></path><rect x="96" y="200" width="48" height="64" rx="8" fill="none" stroke="#17181c" stroke-width="2"></rect><rect x="236" y="200" width="48" height="64" rx="8" fill="none" stroke="#17181c" stroke-width="2"></rect><rect x="376" y="200" width="48" height="64" rx="8" fill="none" stroke="#17181c" stroke-width="2"></rect>',
    belt: '<circle cx="150" cy="160" r="48" fill="none" stroke="#17181c" stroke-width="2"></circle><circle cx="340" cy="130" r="30" fill="none" stroke="#17181c" stroke-width="2"></circle><path d="M150 112 C240 50 320 60 340 100 M150 208 C250 240 320 190 340 160" fill="none" stroke="#e10600" stroke-width="3"></path>',
    clutch: '<circle cx="180" cy="160" r="58" fill="none" stroke="#17181c" stroke-width="2"></circle><circle cx="180" cy="160" r="24" fill="none" stroke="#17181c" stroke-width="2"></circle><rect x="280" y="120" width="110" height="80" rx="8" fill="none" stroke="#e10600" stroke-width="2"></rect>',
    shaft: '<rect x="80" y="140" width="280" height="28" rx="8" fill="none" stroke="#17181c" stroke-width="2"></rect><circle cx="400" cy="154" r="36" fill="none" stroke="#e10600" stroke-width="2"></circle>',
    disc: '<circle cx="190" cy="160" r="72" fill="none" stroke="#17181c" stroke-width="8"></circle><circle cx="190" cy="160" r="26" fill="none" stroke="#17181c" stroke-width="2"></circle><rect x="300" y="120" width="100" height="80" rx="6" fill="none" stroke="#e10600" stroke-width="2"></rect>',
    drum: '<circle cx="200" cy="160" r="64" fill="none" stroke="#17181c" stroke-width="6"></circle><path d="M160 160 H240 M200 120 V200" stroke="#e10600" stroke-width="2"></path>',
    shock: '<rect x="230" y="70" width="28" height="150" fill="none" stroke="#17181c" stroke-width="2"></rect><path d="M120 90 H210 M120 200 H210" fill="none" stroke="#e10600" stroke-width="3"></path><circle cx="360" cy="170" r="40" fill="none" stroke="#17181c" stroke-width="2"></circle>',
    rack: '<rect x="90" y="145" width="280" height="22" rx="6" fill="none" stroke="#17181c" stroke-width="2"></rect><circle cx="140" cy="156" r="28" fill="none" stroke="#e10600" stroke-width="2"></circle><path d="M370 156 L430 110" fill="none" stroke="#17181c" stroke-width="2"></path>',
    lamp: '<rect x="80" y="90" width="160" height="120" rx="16" fill="none" stroke="#17181c" stroke-width="2"></rect><circle cx="150" cy="150" r="28" fill="none" stroke="#e10600" stroke-width="2"></circle><rect x="280" y="120" width="140" height="50" rx="6" fill="none" stroke="#17181c" stroke-width="2"></rect>',
    alt: '<circle cx="170" cy="160" r="50" fill="none" stroke="#17181c" stroke-width="2"></circle><rect x="250" y="130" width="120" height="60" rx="6" fill="none" stroke="#e10600" stroke-width="2"></rect>',
    rad: '<rect x="70" y="70" width="130" height="160" fill="none" stroke="#17181c" stroke-width="2"></rect><path d="M200 110 H320 M200 190 H320" fill="none" stroke="#e10600" stroke-width="3"></path><rect x="320" y="90" width="90" height="110" rx="8" fill="none" stroke="#17181c" stroke-width="2"></rect>',
    pump: '<rect x="90" y="120" width="140" height="80" rx="10" fill="none" stroke="#17181c" stroke-width="2"></rect><path d="M230 160 H360" fill="none" stroke="#e10600" stroke-width="3"></path><circle cx="390" cy="160" r="28" fill="none" stroke="#17181c" stroke-width="2"></circle>',
    pipe: '<path d="M80 180 H200 C240 180 240 100 300 100 H430" fill="none" stroke="#17181c" stroke-width="6"></path><circle cx="200" cy="180" r="18" fill="none" stroke="#e10600" stroke-width="2"></circle>',
    glass: '<path d="M90 200 L160 90 H360 L430 200 Z" fill="none" stroke="#17181c" stroke-width="2"></path><rect x="190" y="120" width="120" height="40" fill="none" stroke="#e10600" stroke-width="2"></rect>',
    fan: '<circle cx="180" cy="160" r="60" fill="none" stroke="#17181c" stroke-width="2"></circle><path d="M180 100 V220 M120 160 H240" stroke="#e10600" stroke-width="2"></path><rect x="300" y="120" width="120" height="80" rx="8" fill="none" stroke="#17181c" stroke-width="2"></rect>',
    box: '<rect x="100" y="100" width="150" height="120" rx="8" fill="none" stroke="#17181c" stroke-width="2"></rect><rect x="280" y="120" width="120" height="80" rx="8" fill="none" stroke="#e10600" stroke-width="2"></rect>'
  };

  var DIAGRAMS = {
    'ignition-system': diagram('ignition-system', 'engine', 'ignition', 'Система зажигания', 'Катушка, провода и свечи. Иллюстрация, не чертёж завода.', SK.coil, [
      part(1, 'Катушка зажигания', 'DEMO-OEM-IGN-01', 260, 95, { partner: [offer('Bosch', 'DEMO-CROSS-IGN-01', 3, '4100.00')] }),
      part(2, 'Комплект высоковольтных проводов', 'DEMO-OEM-IGN-02', 190, 150),
      part(3, 'Свеча зажигания', 'DEMO-OEM-IGN-03', 120, 250, {
        sku: 'fx-spark',
        partner: [offer('Denso', 'DEMO-CROSS-DENSO', 2, '390.00'), offer('Bosch', 'DEMO-CROSS-BOSCH', 4, '450.00')]
      }),
      part(4, 'Свеча зажигания, соседний цилиндр', 'DEMO-OEM-IGN-04', 260, 250),
      part(5, 'Болт крепления катушки', 'DEMO-OEM-IGN-05', 400, 250)
    ]),
    'timing-drive': diagram('timing-drive', 'engine', 'timing', 'Привод ГРМ', 'Ремень и ролики. Иллюстрация, не чертёж завода.', SK.belt, [
      part(1, 'Ремень ГРМ', 'DEMO-OEM-TIM-01', 150, 160, { partner: [offer('Gates', 'DEMO-CROSS-TIM-01', 2, '2800.00')] }),
      part(2, 'Ролик натяжителя', 'DEMO-OEM-TIM-02', 340, 130),
      part(3, 'Болт ролика', 'DEMO-OEM-TIM-03', 340, 180)
    ]),
    'clutch-asm': diagram('clutch-asm', 'transmission', 'clutch', 'Сцепление', 'Корзина и диск. Иллюстрация, не чертёж завода.', SK.clutch, [
      part(1, 'Диск сцепления', 'DEMO-OEM-TRN-01', 180, 160, { partner: [offer('Sachs', 'DEMO-CROSS-TRN-01', 3, '6200.00')] }),
      part(2, 'Корзина сцепления', 'DEMO-OEM-TRN-02', 250, 120),
      part(3, 'Выжимной подшипник', 'DEMO-OEM-TRN-03', 335, 160)
    ]),
    'drive-shaft': diagram('drive-shaft', 'transmission', 'drives', 'Привод колеса', 'Вал и шарнир. Иллюстрация, не чертёж завода.', SK.shaft, [
      part(1, 'Приводной вал', 'DEMO-OEM-TRN-11', 200, 154, { partner: [offer('SKF', 'DEMO-CROSS-TRN-11', 5, '7400.00')] }),
      part(2, 'Наружный ШРУС', 'DEMO-OEM-TRN-12', 400, 154),
      part(3, 'Стопорное кольцо', 'DEMO-OEM-TRN-13', 360, 210)
    ]),
    'front-brakes': diagram('front-brakes', 'brakes', 'front-brakes', 'Передний тормозной механизм', 'Диск и колодки. Иллюстрация, не чертёж завода.', SK.disc, [
      part(1, 'Тормозной диск', 'DEMO-OEM-BRK-01', 190, 160),
      part(2, 'Комплект колодок', 'DEMO-OEM-BRK-02', 350, 150, {
        sku: 'fx-brake',
        partner: [offer('Brembo', 'DEMO-CROSS-BRK-02', 1, '2400.00')]
      }),
      part(3, 'Направляющий палец', 'DEMO-OEM-BRK-03', 390, 110)
    ]),
    'rear-brakes': diagram('rear-brakes', 'brakes', 'rear-brakes', 'Задний тормозной механизм', 'Барабан и колодки. Иллюстрация, не чертёж завода.', SK.drum, [
      part(1, 'Тормозной барабан', 'DEMO-OEM-BRK-11', 200, 160, { partner: [offer('TRW', 'DEMO-CROSS-BRK-11', 4, '3100.00')] }),
      part(2, 'Колодки задние', 'DEMO-OEM-BRK-12', 260, 120),
      part(3, 'Пружина колодок', 'DEMO-OEM-BRK-13', 260, 200)
    ]),
    'front-suspension': diagram('front-suspension', 'suspension', 'front-axle', 'Передняя подвеска', 'Стойка и рычаг. Иллюстрация, не чертёж завода.', SK.shock, [
      part(1, 'Амортизаторная стойка', 'DEMO-OEM-SUS-01', 244, 140, { partner: [offer('KYB', 'DEMO-CROSS-SUS-01', 2, '5600.00')] }),
      part(2, 'Опорный подшипник', 'DEMO-OEM-SUS-02', 244, 70),
      part(3, 'Нижний рычаг', 'DEMO-OEM-SUS-03', 160, 200)
    ]),
    'steering-rack': diagram('steering-rack', 'steering', 'rack', 'Рулевой механизм', 'Рейка и наконечник. Иллюстрация, не чертёж завода.', SK.rack, [
      part(1, 'Рулевая рейка', 'DEMO-OEM-STR-01', 220, 156, { partner: [offer('TRW', 'DEMO-CROSS-STR-01', 6, '8900.00')] }),
      part(2, 'Рулевой наконечник', 'DEMO-OEM-STR-02', 140, 110),
      part(3, 'Пыльник рейки', 'DEMO-OEM-STR-03', 400, 120)
    ]),
    'charging': diagram('charging', 'electrics', 'charging', 'Генератор и АКБ', 'Генератор и батарея. Иллюстрация, не чертёж завода.', SK.alt, [
      part(1, 'Генератор', 'DEMO-OEM-ELC-01', 170, 160, { partner: [offer('Bosch', 'DEMO-CROSS-ELC-01', 5, '9200.00')] }),
      part(2, 'Аккумулятор', 'DEMO-OEM-ELC-02', 310, 160),
      part(3, 'Клемма аккумулятора', 'DEMO-OEM-ELC-03', 370, 120)
    ]),
    'headlamp': diagram('headlamp', 'electrics', 'lighting', 'Передняя фара', 'Корпус и лампа. Иллюстрация, не чертёж завода.', SK.lamp, [
      part(1, 'Лампа головного света', 'DEMO-OEM-ELC-11', 150, 150, { partner: [offer('Osram', 'DEMO-CROSS-ELC-11', 1, '700.00')] }),
      part(2, 'Корпус фары', 'DEMO-OEM-ELC-12', 160, 100),
      part(3, 'Корректор фары', 'DEMO-OEM-ELC-13', 350, 145)
    ]),
    'cooling-system': diagram('cooling-system', 'cooling', 'radiator', 'Система охлаждения', 'Радиатор и патрубки. Иллюстрация, не чертёж завода.', SK.rad, [
      part(1, 'Радиатор охлаждения', 'DEMO-OEM-COL-01', 135, 150, { partner: [offer('Denso', 'DEMO-CROSS-COL-01', 4, '6700.00')] }),
      part(2, 'Верхний патрубок', 'DEMO-OEM-COL-02', 250, 110),
      part(3, 'Крышка радиатора', 'DEMO-OEM-COL-03', 365, 90)
    ]),
    'fuel-supply': diagram('fuel-supply', 'fuel', 'supply', 'Подача топлива', 'Насос и магистраль. Иллюстрация, не чертёж завода.', SK.pump, [
      part(1, 'Топливный насос', 'DEMO-OEM-FUL-01', 160, 160, { partner: [offer('Bosch', 'DEMO-CROSS-FUL-01', 3, '5400.00')] }),
      part(2, 'Топливная магистраль', 'DEMO-OEM-FUL-02', 300, 140),
      part(3, 'Регулятор давления', 'DEMO-OEM-FUL-03', 390, 160)
    ]),
    'exhaust-asm': diagram('exhaust-asm', 'exhaust', 'muffler', 'Выпускной тракт', 'Глушитель и прокладка. Иллюстрация, не чертёж завода.', SK.pipe, [
      part(1, 'Глушитель', 'DEMO-OEM-EXH-01', 360, 100, { partner: [offer('Bosal', 'DEMO-CROSS-EXH-01', 5, '4800.00')] }),
      part(2, 'Приёмная труба', 'DEMO-OEM-EXH-02', 160, 180),
      part(3, 'Прокладка приёмной трубы', 'DEMO-OEM-EXH-03', 200, 140)
    ]),
    'front-optics': diagram('front-optics', 'body', 'optics', 'Передняя оптика кузова', 'Фара в кузове. Иллюстрация, не чертёж завода.', SK.glass, [
      part(1, 'Фара в сборе', 'DEMO-OEM-BDY-01', 250, 140, { partner: [offer('Depo', 'DEMO-CROSS-BDY-01', 7, '7600.00')] }),
      part(2, 'Кронштейн фары', 'DEMO-OEM-BDY-02', 160, 160),
      part(3, 'Крыло, точка крепления', 'DEMO-OEM-BDY-03', 400, 180)
    ]),
    'heater': diagram('heater', 'hvac', 'heater', 'Отопитель салона', 'Радиатор печки и вентилятор. Иллюстрация, не чертёж завода.', SK.fan, [
      part(1, 'Радиатор отопителя', 'DEMO-OEM-HVC-01', 360, 160, { partner: [offer('Nissens', 'DEMO-CROSS-HVC-01', 6, '4300.00')] }),
      part(2, 'Вентилятор отопителя', 'DEMO-OEM-HVC-02', 180, 160),
      part(3, 'Резистор вентилятора', 'DEMO-OEM-HVC-03', 240, 100)
    ]),
    'service-filters': diagram('service-filters', 'filters', 'service', 'Фильтры обслуживания', 'Масляный, воздушный и салонный. Иллюстрация, не чертёж завода.', SK.box, [
      part(1, 'Масляный фильтр', 'DEMO-OEM-FLT-01', 170, 160, { partner: [offer('Mann', 'DEMO-CROSS-FLT-01', 1, '650.00')] }),
      part(2, 'Воздушный фильтр', 'DEMO-OEM-FLT-02', 340, 150),
      part(3, 'Салонный фильтр', 'DEMO-OEM-FLT-03', 340, 200)
    ])
  };

  var GROUPS = [
    { id: 'engine', name: 'Двигатель', children: [
      { id: 'ignition', name: 'Зажигание', diagrams: ['ignition-system'] },
      { id: 'timing', name: 'Газораспределение', diagrams: ['timing-drive'] }
    ]},
    { id: 'transmission', name: 'Трансмиссия', children: [
      { id: 'clutch', name: 'Сцепление', diagrams: ['clutch-asm'] },
      { id: 'drives', name: 'Приводы', diagrams: ['drive-shaft'] }
    ]},
    { id: 'brakes', name: 'Тормозная система', children: [
      { id: 'front-brakes', name: 'Передние тормоза', diagrams: ['front-brakes'] },
      { id: 'rear-brakes', name: 'Задние тормоза', diagrams: ['rear-brakes'] }
    ]},
    { id: 'suspension', name: 'Подвеска', children: [
      { id: 'front-axle', name: 'Передняя ось', diagrams: ['front-suspension'] }
    ]},
    { id: 'steering', name: 'Рулевое управление', children: [
      { id: 'rack', name: 'Рулевой механизм', diagrams: ['steering-rack'] }
    ]},
    { id: 'electrics', name: 'Электрика', children: [
      { id: 'charging', name: 'Зарядка', diagrams: ['charging'] },
      { id: 'lighting', name: 'Освещение', diagrams: ['headlamp'] },
      { id: 'assist', name: 'Системы помощи водителю', diagrams: [], unavailable: GAP }
    ]},
    { id: 'cooling', name: 'Охлаждение', children: [
      { id: 'radiator', name: 'Радиатор', diagrams: ['cooling-system'] }
    ]},
    { id: 'fuel', name: 'Топливная система', children: [
      { id: 'supply', name: 'Подача топлива', diagrams: ['fuel-supply'] }
    ]},
    { id: 'exhaust', name: 'Выхлопная система', children: [
      { id: 'muffler', name: 'Глушитель', diagrams: ['exhaust-asm'] }
    ]},
    { id: 'body', name: 'Кузов и оптика', children: [
      { id: 'optics', name: 'Оптика кузова', diagrams: ['front-optics'] }
    ]},
    { id: 'hvac', name: 'Климат', children: [
      { id: 'heater', name: 'Отопитель', diagrams: ['heater'] }
    ]},
    { id: 'filters', name: 'Фильтры и обслуживание', children: [
      { id: 'service', name: 'Комплект обслуживания', diagrams: ['service-filters'] }
    ]}
  ];

  function groupById(id) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) return GROUPS[i];
    return null;
  }

  function subgroupById(group, id) {
    if (!group) return null;
    for (var i = 0; i < group.children.length; i++) if (group.children[i].id === id) return group.children[i];
    return null;
  }

  function diagramsFor(group, subgroup) {
    var ids = [];
    if (subgroup) ids = (subgroup.diagrams || []).slice();
    else if (group) group.children.forEach(function (child) { ids = ids.concat(child.diagrams || []); });
    return ids.map(function (id) { return DIAGRAMS[id]; }).filter(Boolean);
  }

  function href(vin, bits) {
    return '#/vin/' + vin + (bits.length ? '/' + bits.join('/') : '');
  }

  function resolve(path) {
    var bits = String(path || '').split('/').filter(Boolean).map(function (bit) {
      try { return decodeURIComponent(bit); } catch (e) { return bit; }
    });
    var vin = (bits[0] || '').toUpperCase();
    if (!VIN_RE.test(vin)) return { kind: 'invalid', vin: vin, demos: Object.keys(KNOWN) };
    var vehicle = KNOWN[vin] || null;
    if (!vehicle) return { kind: 'unknown', vin: vin, demos: Object.keys(KNOWN) };
    if (!vehicle.catalog) return { kind: 'identity', vin: vin, vehicle: vehicle, demos: ['JTNB11HK103456789'] };
    var group = bits[1] ? groupById(bits[1]) : null;
    if (bits[1] && !group) return { kind: 'missing', vin: vin, vehicle: vehicle, missing: 'group' };
    var subgroup = bits[2] ? subgroupById(group, bits[2]) : null;
    if (bits[2] && !subgroup) return { kind: 'missing', vin: vin, vehicle: vehicle, group: group, missing: 'subgroup' };
    var diagram = bits[3] ? DIAGRAMS[bits[3]] : null;
    if (bits[3] && (!diagram || diagram.group !== group.id || diagram.subgroup !== subgroup.id)) {
      return { kind: 'missing', vin: vin, vehicle: vehicle, group: group, subgroup: subgroup, missing: 'diagram' };
    }
    var partRow = null;
    if (bits[4]) {
      partRow = diagram.parts.filter(function (item) { return String(item.pos) === String(bits[4]); })[0] || null;
      if (!partRow) return { kind: 'missing', vin: vin, vehicle: vehicle, group: group, subgroup: subgroup, diagram: diagram, missing: 'part' };
    }
    var crumbs = [{ href: href(vin, []), label: vehicle.make + ' ' + vehicle.model + ' ' + vehicle.year }];
    if (group) crumbs.push({ href: href(vin, [group.id]), label: group.name });
    if (subgroup) crumbs.push({ href: href(vin, [group.id, subgroup.id]), label: subgroup.name });
    if (diagram) crumbs.push({ href: href(vin, [group.id, subgroup.id, diagram.id]), label: diagram.title });
    if (partRow) crumbs.push({ href: href(vin, [group.id, subgroup.id, diagram.id, String(partRow.pos)]), label: 'Поз. ' + partRow.pos + ' · ' + partRow.name });
    return {
      kind: diagram ? 'diagram' : 'browse',
      vin: vin,
      vehicle: vehicle,
      group: group,
      subgroup: subgroup,
      diagram: diagram,
      part: partRow,
      gallery: diagram ? [] : diagramsFor(group, subgroup),
      unavailable: subgroup && subgroup.unavailable ? subgroup.unavailable : (!diagram && subgroup && !(subgroup.diagrams || []).length ? GAP : ''),
      crumbs: crumbs
    };
  }

  function marker(x, y, n, link, on) {
    return '<a href="' + link + '"><g class="pos' + (on ? ' on' : '') + '">' +
      '<circle cx="' + x + '" cy="' + y + '" r="13"></circle>' +
      '<text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle">' + n + '</text></g></a>';
  }

  function frame(inner) {
    return '<svg class="diagram-svg" viewBox="0 0 520 320" role="img">' +
      '<rect x="1" y="1" width="518" height="318" rx="8" fill="#f7f8fa" stroke="#dfe1e6"></rect>' +
      '<text x="12" y="18" fill="#8a5a00" font-size="11">Иллюстрация CARVIC · не чертёж завода</text>' +
      inner + '</svg>';
  }

  function diagramSvg(id, vin, base, active) {
    var item = DIAGRAMS[id];
    if (!item) return '';
    var marks = item.parts.map(function (row) {
      return marker(row.x, row.y, row.pos, base + '/' + row.pos, String(active) === String(row.pos));
    }).join('');
    return frame((item.sketch || '') + marks);
  }

  function thumbSvg(id) {
    return diagramSvg(id, 'VIN', '#/preview', null).replace(/<a href="[^"]*">/g, '<g>').replace(/<\/a>/g, '</g>');
  }

  function illustrative(value) {
    return /^DEMO([-\s_]|$)/i.test(String(value || '').trim());
  }

  function eachPart(fn) {
    Object.keys(DIAGRAMS).forEach(function (id) {
      DIAGRAMS[id].parts.forEach(function (row) { fn(row, DIAGRAMS[id]); });
    });
  }

  root.DemoCatalog = {
    known: KNOWN,
    groups: GROUPS,
    diagrams: DIAGRAMS,
    resolve: resolve,
    illustrative: illustrative,
    diagramSvg: diagramSvg,
    thumbSvg: thumbSvg,
    href: href,
    eachPart: eachPart
  };
})(typeof window !== 'undefined' ? window : globalThis);
