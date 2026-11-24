/* AnkaVisual — косметическая защита от «сохранить страницу» и правого клика.
 *
 * ВАЖНО: это не настоящая защита. Любой публичный сайт можно скачать
 * запросом (curl/wget) или клонировать из репозитория. Скрипт лишь
 * отбивает самый простой способ — через меню браузера. В полях ввода
 * правый клик и выделение работают как обычно.
 */
(function () {
  'use strict';

  function isInteractive(node) {
    return !!(node && node.closest
      && node.closest('a, button, input, textarea, select, label, [role="button"], '
        + '[contenteditable=""], [contenteditable="true"]'));
  }

  document.addEventListener('contextmenu', function (event) {
    /* Ссылки и поля не трогаем: «открыть в новой вкладке» и вставка должны работать. */
    if (isInteractive(event.target)) return;
    event.preventDefault();
  }, false);

  document.addEventListener('keydown', function (event) {
    var key = String(event.key || '').toLowerCase();
    var mod = event.ctrlKey || event.metaKey;
    var blocked = key === 'f12'
      || (mod && (key === 's' || key === 'u' || key === 'p'))
      || (mod && event.shiftKey && (key === 'i' || key === 'j' || key === 'c'));
    if (blocked) event.preventDefault();
  }, false);
})();
