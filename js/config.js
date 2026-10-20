/*
 * Адрес API AnkaGuard.
 *
 * Локально сайт ходит на этот же компьютер, а с GitHub Pages — на публичный
 * HTTPS-адрес туннеля. Меняется только эта строка.
 */
(function () {
  'use strict';

  var local = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  window.ANKA_API_BASE = local
    ? 'http://127.0.0.1:8724'
    : 'https://a1ff09a2c1fc7e1a-79-174-62-53.serveousercontent.com';
})();
