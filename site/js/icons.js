/* CARVIC — SVG-иконки (линейная графика). Цвета задаются через currentColor и CSS-переменные. */
(function () {
  var A = 'var(--c-accent)';
  var P = {
    /* ---- иконки баннера (белые линии) ---- */
    plug: '<path d="M28 6h8v6h-8z"/><path d="M26 12h12v6H26z"/><path d="M25 18h14l-2 14H27z"/><path d="M27 23h10M27 27h10"/><path d="M29 32h6v10h-6z"/><path d="M28 42h8v6h-8z"/><path d="M32 48v6M32 54h5"/>',
    disc: '<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="9"/><circle cx="32" cy="32" r="3"/><g stroke-width="2.4"><circle cx="20" cy="22" r=".6"/><circle cx="44" cy="22" r=".6"/><circle cx="18" cy="38" r=".6"/><circle cx="46" cy="38" r=".6"/><circle cx="32" cy="15" r=".6"/><circle cx="32" cy="49" r=".6"/><circle cx="24" cy="46" r=".6"/><circle cx="40" cy="46" r=".6"/></g><path d="M43 12c7 3 11 9 12 16l-6 2c-1-5-3-9-8-12z" fill="' + A + '" stroke="' + A + '"/>',
    axle: '<path d="M12 50l8-8M44 18l8-8"/><path d="M18 40l6 6 5-5-6-6z"/><path d="M35 23l6 6 5-5-6-6z"/><path d="M27 37l10-10" stroke-width="4"/><path d="M14 44c-3 3-1 7 2 8s5-3 3-5M48 12c3-1 6 1 5 4"/><path d="M22 34l2-2M38 30l2-2"/>',
    piston: '<path d="M18 10h28v20H18z"/><path d="M18 15h28M18 19h28"/><path d="M24 30l4 6h8l4-6"/><circle cx="32" cy="38" r="3"/><path d="M30 41l-4 13M34 41l4 13"/><circle cx="32" cy="55" r="4"/>',
    /* ---- превью товаров ---- */
    pads: '<path d="M10 22c8-8 36-8 44 0l-4 22c-10-5-26-5-36 0z" fill="#2b2d33"/><path d="M14 26c7-5 29-5 36 0l-3 14c-9-4-21-4-30 0z" fill="#4a4d55"/><circle cx="20" cy="18" r="3" fill="#2b2d33"/><circle cx="44" cy="18" r="3" fill="#2b2d33"/>',
    caliper: '<circle cx="34" cy="34" r="22" fill="#9aa0a8"/><circle cx="34" cy="34" r="8" fill="#2b2d33"/><path d="M14 18c8-10 22-12 30-8l-4 10c-6-2-14 0-18 5z" fill="' + A + '"/>',
    shock: '<path d="M30 6h4v12h-4z" fill="#2b2d33"/><rect x="26" y="18" width="12" height="36" rx="3" fill="#2b2d33"/><path d="M20 22h24M20 28h24M20 34h24M20 40h24M20 46h24" stroke="' + A + '" stroke-width="3.5"/><circle cx="32" cy="58" r="4" fill="none" stroke="#2b2d33" stroke-width="3"/>',
    arm: '<path d="M8 44l22-26 26 12" fill="none" stroke="#2b2d33" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="44" r="5" fill="' + A + '"/><circle cx="56" cy="30" r="5" fill="' + A + '"/><circle cx="30" cy="18" r="4" fill="#9aa0a8"/>',
    link: '<path d="M14 50L50 14" stroke="#2b2d33" stroke-width="6"/><circle cx="14" cy="50" r="7" fill="' + A + '"/><circle cx="50" cy="14" r="7" fill="' + A + '"/>',
    bearing: '<circle cx="32" cy="32" r="24" fill="#9aa0a8"/><circle cx="32" cy="32" r="17" fill="#2b2d33"/><circle cx="32" cy="32" r="10" fill="#eef0f3"/><g fill="#c9ccd1"><circle cx="32" cy="18" r="3"/><circle cx="46" cy="32" r="3"/><circle cx="32" cy="46" r="3"/><circle cx="18" cy="32" r="3"/><circle cx="42" cy="22" r="3"/><circle cx="22" cy="42" r="3"/><circle cx="42" cy="42" r="3"/><circle cx="22" cy="22" r="3"/></g>',
    spring: '<path d="M18 10h28M18 54h28" stroke="#2b2d33" stroke-width="4"/><path d="M20 14l24 6-24 6 24 6-24 6 24 6-24 6" fill="none" stroke="' + A + '" stroke-width="4" stroke-linejoin="round"/>',
    coil: '<rect x="22" y="6" width="20" height="14" rx="3" fill="#2b2d33"/><rect x="27" y="20" width="10" height="30" fill="#4a4d55"/><path d="M29 50h6v8h-6z" fill="' + A + '"/>',
    battery: '<rect x="8" y="18" width="48" height="34" rx="3" fill="#2b2d33"/><rect x="14" y="12" width="8" height="6" fill="#9aa0a8"/><rect x="42" y="12" width="8" height="6" fill="' + A + '"/><path d="M16 30h6M19 27v6M42 30h6" stroke="#fff" stroke-width="2"/>',
    alternator: '<circle cx="32" cy="32" r="22" fill="#9aa0a8"/><circle cx="32" cy="32" r="13" fill="#4a4d55"/><circle cx="32" cy="32" r="6" fill="' + A + '"/><path d="M32 10v8M32 46v8M10 32h8M46 32h8" stroke="#2b2d33" stroke-width="3"/>',
    bulb: '<circle cx="32" cy="24" r="14" fill="#eef0f3" stroke="#2b2d33" stroke-width="3"/><path d="M26 38h12v12H26z" fill="#9aa0a8"/><path d="M28 50h8v6h-8z" fill="#2b2d33"/><path d="M28 24c2-4 6-4 8 0" stroke="' + A + '" stroke-width="2.5" fill="none"/>',
    sensor: '<path d="M10 32h20" stroke="#2b2d33" stroke-width="3"/><rect x="30" y="24" width="18" height="16" rx="3" fill="#2b2d33"/><path d="M48 32h8" stroke="' + A + '" stroke-width="5"/><path d="M4 32c4-8 8 8 12 0" stroke="#4a4d55" stroke-width="2" fill="none"/>',
    belt: '<rect x="8" y="14" width="48" height="36" rx="18" fill="none" stroke="#2b2d33" stroke-width="6"/><path d="M14 28h36" stroke="' + A + '" stroke-width="2" stroke-dasharray="3 3"/>',
    piston: '<path d="M18 10h28v20H18z" fill="#9aa0a8"/><path d="M18 15h28M18 19h28" stroke="#2b2d33" stroke-width="2"/><path d="M28 30l-4 22h16l-4-22z" fill="#4a4d55"/><circle cx="32" cy="52" r="6" fill="' + A + '"/>',
    gasket: '<rect x="6" y="16" width="52" height="32" rx="4" fill="#9aa0a8"/><circle cx="20" cy="32" r="8" fill="#eef0f3"/><circle cx="44" cy="32" r="8" fill="#eef0f3"/><circle cx="32" cy="22" r="2" fill="' + A + '"/><circle cx="32" cy="42" r="2" fill="' + A + '"/>',
    mount: '<rect x="12" y="26" width="40" height="16" rx="3" fill="#2b2d33"/><path d="M24 26V12h16v14" fill="#9aa0a8"/><circle cx="18" cy="48" r="4" fill="' + A + '"/><circle cx="46" cy="48" r="4" fill="' + A + '"/>',
    filter: '<rect x="16" y="14" width="32" height="40" rx="5" fill="#141518"/><ellipse cx="32" cy="14" rx="16" ry="5" fill="#2b2d33"/><text x="32" y="38" font-size="8" font-weight="800" text-anchor="middle" fill="#fff" font-family="Montserrat,Arial" font-style="italic">CAR<tspan fill="' + A + '">VIC</tspan></text>',
    airfilter: '<rect x="8" y="16" width="48" height="32" rx="3" fill="#2b2d33"/><path d="M14 20v24M19 20v24M24 20v24M29 20v24M34 20v24M39 20v24M44 20v24M49 20v24" stroke="#e8e2c9" stroke-width="3"/>',
    clutch: '<circle cx="32" cy="32" r="24" fill="#4a4d55"/><circle cx="32" cy="32" r="16" fill="#9aa0a8"/><circle cx="32" cy="32" r="6" fill="' + A + '"/>',
    radiator: '<rect x="8" y="12" width="48" height="40" rx="3" fill="#2b2d33"/><path d="M14 18v28M19 18v28M24 18v28M29 18v28M34 18v28M39 18v28M44 18v28M49 18v28" stroke="#9aa0a8" stroke-width="2"/><circle cx="50" cy="8" r="4" fill="' + A + '"/>',
    pump: '<circle cx="28" cy="34" r="16" fill="#9aa0a8"/><circle cx="28" cy="34" r="6" fill="#2b2d33"/><path d="M42 26h14v10H44" fill="#4a4d55"/><path d="M28 18v-8" stroke="' + A + '" stroke-width="5"/>',
    thermostat: '<circle cx="32" cy="36" r="16" fill="#9aa0a8"/><path d="M32 10v26" stroke="' + A + '" stroke-width="5"/><circle cx="32" cy="36" r="6" fill="#2b2d33"/>',
    headlight: '<path d="M6 40c4-16 20-24 52-24v26c-20 2-36 4-52-2z" fill="#2b2d33"/><circle cx="40" cy="30" r="8" fill="#eef0f3"/><path d="M12 38c10-4 20-6 30-6" stroke="' + A + '" stroke-width="2"/>',
    mirror: '<path d="M10 18h36c6 0 10 4 10 10v8c0 6-4 10-10 10H22C14 46 10 40 10 32z" fill="#2b2d33"/><path d="M16 24h28c4 0 6 2 6 6v4c0 4-2 6-6 6H22c-4 0-6-3-6-7z" fill="#9aa0a8"/><path d="M10 34H4" stroke="' + A + '" stroke-width="5"/>',
    wiper: '<path d="M8 50L56 14" stroke="#2b2d33" stroke-width="5"/><path d="M14 54L58 22" stroke="#4a4d55" stroke-width="2"/><circle cx="8" cy="50" r="4" fill="' + A + '"/>',
    bumper: '<path d="M4 26c10-6 46-6 56 0v14c-10 6-46 6-56 0z" fill="#2b2d33"/><path d="M20 34h24" stroke="#9aa0a8" stroke-width="4"/><circle cx="10" cy="34" r="3" fill="' + A + '"/><circle cx="54" cy="34" r="3" fill="' + A + '"/>',
    muffler: '<rect x="12" y="22" width="36" height="20" rx="10" fill="#9aa0a8"/><path d="M48 32h12M2 32h10" stroke="#2b2d33" stroke-width="5"/><path d="M20 26v12M28 26v12" stroke="' + A + '" stroke-width="2"/>',
    oil: '<path d="M18 16h20l8 8v30H18z" fill="#141518"/><rect x="22" y="8" width="10" height="8" fill="' + A + '"/><rect x="22" y="30" width="20" height="14" fill="' + A + '"/>',
    car: '<path d="M6 40l4-10 10-4 8-8h14l10 8 6 2 2 12z" fill="#2b2d33"/><circle cx="18" cy="42" r="6" fill="' + A + '"/><circle cx="48" cy="42" r="6" fill="' + A + '"/>',
    radiatorline: ''
  };
  /* Линейные (баннерные) иконки рисуются обводкой; товарные — заливкой */
  var LINE = { plug: 1, disc: 1, axle: 1, piston: 1 };
  window.icon = function (name, opts) {
    opts = opts || {};
    var body = P[name] || P.car;
    if (opts.line && LINE[name]) {
      return '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
    }
    if (name === 'disc' && !opts.line) {
      body = '<circle cx="32" cy="32" r="24" fill="#9aa0a8"/><circle cx="32" cy="32" r="10" fill="#2b2d33"/><g fill="#5d6169"><circle cx="20" cy="22" r="1.6"/><circle cx="44" cy="22" r="1.6"/><circle cx="16" cy="36" r="1.6"/><circle cx="48" cy="36" r="1.6"/><circle cx="32" cy="13" r="1.6"/><circle cx="26" cy="50" r="1.6"/><circle cx="40" cy="50" r="1.6"/></g><path d="M44 10c8 4 12 10 13 18l-8 2c-1-5-4-10-9-12z" fill="' + A + '"/>';
    }
    if (name === 'plug' && !opts.line) {
      body = '<path d="M28 4h8v8h-8z" fill="#9aa0a8"/><path d="M25 12h14l-2 18H27z" fill="#eef0f3" stroke="#2b2d33" stroke-width="2"/><path d="M26 30h12v8H26z" fill="#2b2d33"/><path d="M28 38h8v12h-8z" fill="#9aa0a8"/><path d="M32 50v8h5" stroke="' + A + '" stroke-width="3" fill="none"/>';
    }
    if (name === 'axle' && !opts.line) {
      body = '<path d="M14 50L50 14" stroke="#4a4d55" stroke-width="5"/><path d="M8 44l10 10 8-8-10-10z" fill="#2b2d33"/><path d="M38 18l10 10 8-8-10-10z" fill="#2b2d33"/><circle cx="32" cy="32" r="4" fill="' + A + '"/>';
    }
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' + body + '</svg>';
  };
})();
