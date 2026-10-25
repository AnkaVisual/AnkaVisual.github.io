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
    : 'https://ad7038078615409b-104-28-198-245.serveousercontent.com';
})();
