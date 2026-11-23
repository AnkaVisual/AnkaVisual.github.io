/* AnkaVisual — магазин конфигов: каталог, поиск, фильтры, копирование кода. */
(function () {
  'use strict';

  var API = window.ANKA_API_BASE || 'https://ankaguard.ankavisual.workers.dev';
  var grid = document.getElementById('shopGrid');
  var status = document.getElementById('shopStatus');
  var search = document.getElementById('shopSearch');
  var filters = document.getElementById('shopFilters');

  if (!grid) return;

  var activeFilter = 'all';
  var items = [];

  var CATEGORY_LABEL = {
    pvp: 'PvP',
    visual: 'Visual',
    utility: 'Utility',
    hud: 'HUD',
    other: 'Другое'
  };

  var fallback = [
    {
      id: 'pvp-legit',
      name: 'Legit PvP',
      author: 'AnkaVisual',
      price: 0,
      category: 'pvp',
      version: '1.21.11',
      tags: ['pvp', 'legit', 'hud'],
      description: 'Аккуратный конфиг для легит-PvP: чистая подсветка цели, удобный HUD и безопасные настройки.',
      code: 'ANKA-PVP1'
    },
    {
      id: 'visual-clean',
      name: 'Clean Visual',
      author: 'AnkaVisual',
      price: 0,
      category: 'visual',
      version: '1.21.11',
      tags: ['visual', 'clean', 'menu'],
      description: 'Спокойный визуал без лишнего шума. Подходит для скриншотов, стримов и обычной игры.',
      code: 'ANKA-VIS1'
    },
    {
      id: 'utility-base',
      name: 'Utility Base',
      author: 'AnkaVisual',
      price: 0,
      category: 'utility',
      version: '1.21.11',
      tags: ['utility', 'hud', 'base'],
      description: 'Базовый набор утилит и аккуратный интерфейс — удобная отправная точка для своих настроек.',
      code: 'ANKA-UTL1'
    }
  ];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function priceOf(item) {
    var n = Number(item.price || 0);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function fmtPrice(value) {
    return value > 0 ? value + ' ₽' : 'Бесплатно';
  }

  function categoryLabel(item) {
    var key = String(item.category || '').toLowerCase();
    return CATEGORY_LABEL[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Конфиг');
  }

  function card(item, index) {
    var price = priceOf(item);
    var free = price === 0;
    var code = item.code ? String(item.code) : '';
    var tags = (item.tags || []).slice(0, 4).map(function (tag) {
      return '<span class="shop-tag">' + esc(tag) + '</span>';
    }).join('');

    var meta = '<span>' + esc(categoryLabel(item)) + '</span>';
    if (item.version) meta += '<span>' + esc(item.version) + '</span>';
    if (item.updated) meta += '<span>' + esc(item.updated) + '</span>';

    var action;
    if (code) {
      action = '<button class="plan-cta is-copy" type="button" data-copy="' + esc(code) + '">Скопировать код</button>';
    } else if (free) {
      action = '<a class="plan-cta" href="../account/">Получить в аккаунте</a>';
    } else {
      action = '<a class="plan-cta" href="../account/">Купить · ' + esc(fmtPrice(price)) + '</a>';
    }

    return '<article class="shop-card" style="--i:' + index + '">' +
      '<div class="shop-card-top">' +
        '<span class="shop-author">by ' + esc(item.author || 'AnkaVisual') + '</span>' +
        '<span class="shop-state ' + (free ? 'is-free' : 'is-paid') + '">' + esc(fmtPrice(price)) + '</span>' +
      '</div>' +
      '<h3>' + esc(item.name || 'Конфиг') + '</h3>' +
      '<p class="shop-note">' + esc(item.description || 'Конфиг для AnkaVisual.') + '</p>' +
      (tags ? '<div class="shop-tags">' + tags + '</div>' : '') +
      '<div class="shop-meta">' + meta + '</div>' +
      action +
    '</article>';
  }

  function matches(item) {
    var query = (search && search.value ? search.value : '').toLowerCase().trim();
    var category = String(item.category || '').toLowerCase();
    var free = priceOf(item) === 0;

    if (activeFilter === 'free' && !free) return false;
    if (activeFilter !== 'all' && activeFilter !== 'free' && category !== activeFilter) return false;
    if (!query) return true;

    var haystack = [
      item.name, item.author, item.description, item.category, item.version
    ].concat(item.tags || []).join(' ').toLowerCase();

    return haystack.indexOf(query) !== -1;
  }

  function render() {
    var list = items.filter(matches);

    if (!list.length) {
      grid.innerHTML = '<div class="shop-empty"><b>Ничего не найдено</b>' +
        '<span>Попробуй другой запрос или сбрось фильтр.</span></div>';
      status.textContent = 'Найдено конфигов: 0';
      return;
    }

    grid.innerHTML = list.map(card).join('');
    status.textContent = 'Найдено конфигов: ' + list.length;
  }

  function applyList(list) {
    items = Array.isArray(list) && list.length ? list : fallback;
    render();
  }

  function load() {
    status.textContent = 'Загрузка конфигов…';

    fetch(API + '/api/shop/configs', {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        var list = Array.isArray(data)
          ? data
          : (data && (data.items || data.configs || data.data)) || [];
        applyList(list);
      })
      .catch(function () {
        applyList(fallback);
      });
  }

  grid.addEventListener('click', function (event) {
    var button = event.target.closest('[data-copy]');
    if (!button) return;

    var code = button.getAttribute('data-copy') || '';
    if (!code) return;

    var original = button.textContent;

    function done() {
      button.textContent = 'Код скопирован';
      window.setTimeout(function () { button.textContent = original; }, 1500);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, done);
      return;
    }

    var field = document.createElement('textarea');
    field.value = code;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    try { document.execCommand('copy'); } catch (error) { /* ignore */ }
    document.body.removeChild(field);
    done();
  });

  if (search) search.addEventListener('input', render);

  if (filters) {
    filters.addEventListener('click', function (event) {
      var button = event.target.closest('[data-filter]');
      if (!button) return;

      activeFilter = button.getAttribute('data-filter') || 'all';

      Array.prototype.forEach.call(filters.querySelectorAll('.shop-filter'), function (item) {
        var active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      render();
    });
  }

  load();
})();
