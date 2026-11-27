/* AnkaVisual — персональное оформление: акцентный цвет и основной шрифт. */
(function () {
  'use strict';

  var KEY = 'ankavisual.theme';
  var DEFAULTS = { accent: '#b18cff', font: 'inter' };
  var FONTS = {
    inter: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    prata: "'Prata', Georgia, serif",
    georgia: "Georgia, 'Times New Roman', serif",
    system: "system-ui, -apple-system, 'Segoe UI', sans-serif"
  };

  function read() {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (ignored) { /* ignore */ }
    return {
      accent: /^#[0-9a-f]{6}$/i.test(String(saved.accent || '')) ? saved.accent : DEFAULTS.accent,
      font: FONTS[saved.font] ? saved.font : DEFAULTS.font
    };
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (ignored) { /* приватный режим */ }
  }

  function rgb(hex) {
    var h = String(hex).replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function lighten(hex, amount) {
    var parts = rgb(hex).map(function (value) {
      return Math.round(value + (255 - value) * amount);
    });
    return '#' + parts.map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  function apply(state) {
    var value = state || read();
    var c = rgb(value.accent);
    var root = document.documentElement;
    root.style.setProperty('--accent', value.accent);
    root.style.setProperty('--acc', value.accent);
    root.style.setProperty('--accent-rgb', c.join(','));
    root.style.setProperty('--accent-3', lighten(value.accent, 0.25));
    root.style.setProperty('--accent-soft', 'rgba(' + c.join(',') + ',0.12)');
    root.style.setProperty('--accent-line', 'rgba(' + c.join(',') + ',0.38)');
    root.style.setProperty('--font-main', FONTS[value.font] || FONTS.inter);
    root.setAttribute('data-theme-font', value.font);
    root.setAttribute('data-theme-accent', value.accent);
  }

  window.AnkaTheme = {
    get: read,
    set: function (patch) {
      var next = Object.assign(read(), patch || {});
      save(next);
      apply(next);
      return next;
    },
    reset: function () {
      save(DEFAULTS);
      apply(DEFAULTS);
      return DEFAULTS;
    },
    fonts: FONTS,
    apply: apply
  };

  apply(read());
})();
