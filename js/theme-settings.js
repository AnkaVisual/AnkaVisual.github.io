/* AnkaVisual — настройки оформления в личном кабинете. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  function init() {
    var swatches = $('themeSwatches');
    var color = $('themeColor');
    var colorValue = $('themeColorValue');
    var font = $('themeFont');
    var save = $('themeSave');
    var reset = $('themeReset');
    var msg = $('themeMsg');
    var theme = window.AnkaTheme;

    if (!theme || !swatches || !color || !font) return;

    function message(text) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.hidden = !text;
      msg.className = 'auth-msg' + (text ? ' is-ok' : '');
    }

    function sync() {
      var state = theme.get();
      color.value = state.accent;
      if (colorValue) colorValue.textContent = state.accent;
      font.value = state.font;
      Array.prototype.forEach.call(swatches.querySelectorAll('.theme-swatch'), function (node) {
        node.classList.toggle('is-active', node.getAttribute('data-color') === state.accent);
      });
    }

    function update(patch) {
      theme.set(patch);
      sync();
      message('Настройки применены');
    }

    swatches.addEventListener('click', function (event) {
      var button = event.target.closest('[data-color]');
      if (!button) return;
      update({ accent: button.getAttribute('data-color') });
    });

    color.addEventListener('input', function () { update({ accent: color.value }); });
    font.addEventListener('change', function () { update({ font: font.value }); });

    if (save) save.addEventListener('click', function () {
      theme.set({ accent: color.value, font: font.value });
      sync();
      message('Сохранено');
    });

    if (reset) reset.addEventListener('click', function () {
      theme.reset();
      sync();
      message('Сброшено на значения по умолчанию');
    });

    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
