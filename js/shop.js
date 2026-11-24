/* AnkaVisual — магазин конфигов и ресурспаков: каталог, поиск, фильтры, лайтбокс, копирование. */
(function () {
  'use strict';

  var API = String(window.ANKA_API_BASE || 'https://ankaguard.ankavisual.workers.dev').replace(/\/+$/, '');
  var grid = document.getElementById('shopGrid');
  var status = document.getElementById('shopStatus');
  var search = document.getElementById('shopSearch');
  var filters = document.getElementById('shopFilters');
  var tabsRoot = document.querySelector('[data-shop-tabs]');

  if (!grid) return;

  var activeTab = 'all';
  var activeFilter = 'all';
  var items = [];
  var purchasedIds = {};
  var LOCAL_CONFIGS_KEY = 'ankavisual.shop.local.configs';

  function localConfigs() {
    try {
      var list = JSON.parse(localStorage.getItem(LOCAL_CONFIGS_KEY) || '[]');
      if (!Array.isArray(list)) return [];
      return list.filter(function (item) {
        return item && item.status !== 'draft';
      });
    } catch (ignored) {
      return [];
    }
  }

  var CATEGORY_LABEL = {
    pvp: 'PvP',
    visual: 'Visual',
    utility: 'Utility',
    hud: 'HUD',
    other: 'Другое'
  };

  var KIND_LABEL = {
    config: 'Конфиг',
    resource: 'Ресурспак'
  };

  var fallback = [
    {
      id: 'pvp-legit',
      kind: 'config',
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
      kind: 'config',
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
      kind: 'config',
      name: 'Utility Base',
      author: 'AnkaVisual',
      price: 0,
      category: 'utility',
      version: '1.21.11',
      tags: ['utility', 'hud', 'base'],
      description: 'Базовый набор утилит и аккуратный интерфейс — удобная отправная точка для своих настроек.',
      code: 'ANKA-UTL1'
    },
    {
      id: 'res-anim',
      kind: 'resource',
      name: 'Anim Pack',
      author: 'AnkaVisual',
      price: 0,
      category: 'visual',
      version: '1.21.11',
      tags: ['anim', 'resource', 'packs'],
      description: 'Набор плавных анимаций интерфейса и частиц для клиента AnkaVisual.',
      url: 'https://ankavisual.github.io/AnkaVisual/releases/download/v1.0.0/AnkaResourcePackDemo.zip'
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
    return CATEGORY_LABEL[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Другое');
  }

  function kindOf(item) {
    return String(item.kind || 'config') === 'resource' ? 'resource' : 'config';
  }

  function coverUrl(item) {
    var imageId = String(item.imageId || '');
    if (!imageId) return '';
    if (imageId.indexOf('data:') === 0) return imageId;
    return API + '/api/shop/images/' + imageId;
  }

  function card(item, index) {
    var kind = kindOf(item);
    var price = priceOf(item);
    var free = price === 0;
    var code = item.code ? String(item.code) : '';
    var url = item.url ? String(item.url) : '';
    var name = item.name || 'Конфиг';
    var tags = (item.tags || []).slice(0, 4).map(function (tag) {
      return '<span class="shop-tag">' + esc(tag) + '</span>';
    }).join('');

    var meta = '<span>' + esc(categoryLabel(item)) + '</span>';
    if (item.version) meta += '<span>' + esc(item.version) + '</span>';
    if (item.updated) meta += '<span>' + esc(item.updated) + '</span>';

    var cover;
    if (item.imageId) {
      cover = '<button class="shop-card-media" type="button" data-lightbox="' + esc(item.imageId) + '" aria-label="Открыть фото ' + esc(name) + '">'
        + '<img src="' + esc(coverUrl(item)) + '" alt="' + esc(name) + '" loading="lazy" />'
        + '<span class="shop-state ' + (free ? 'is-free' : 'is-paid') + '">' + esc(fmtPrice(price)) + '</span>'
        + '</button>';
    } else {
      cover = '<div class="shop-card-media is-empty"><span>Фото появится после публикации</span></div>';
    }

    var action;
    var owned = !!purchasedIds[String(item.id || '')];
    if (!free && owned) {
      action = '<span class="plan-cta is-owned">Куплено ✓</span>';
    } else if (!free) {
      action = '<button class="plan-cta" type="button" data-pay-item="' + esc(item.id) + '"'
        + ' data-pay-name="' + esc(name) + '" data-pay-price="' + price + '">'
        + 'Купить · ' + esc(fmtPrice(price)) + ' (демо)</button>';
    } else if (kind === 'resource' && url) {
      action = '<a class="plan-cta" href="' + esc(url) + '" target="_blank" rel="noopener">Скачать ресурспак</a>';
    } else if (code) {
      action = '<button class="plan-cta is-copy" type="button" data-copy="' + esc(code) + '">Скопировать код</button>';
    } else {
      action = '<a class="plan-cta" href="../account/">Получить в аккаунте</a>';
    }

    return '<article class="shop-card" style="--i:' + index + '">' +
      cover +
      '<div class="shop-card-top">' +
        '<span class="shop-author">by ' + esc(item.author || 'AnkaVisual') + '</span>' +
        '<span class="shop-state ' + (free ? 'is-free' : 'is-paid') + '">' + esc(fmtPrice(price)) + '</span>' +
      '</div>' +
      '<h3>' + esc(name) + '</h3>' +
      '<p class="shop-note">' + esc(item.description || 'Конфиг для AnkaVisual.') + '</p>' +
      (tags ? '<div class="shop-tags">' + tags + '</div>' : '') +
      '<div class="shop-meta">' + meta + '</div>' +
      action +
    '</article>';
  }

  function matches(item) {
    if (activeTab === 'config' && kindOf(item) !== 'config') return false;
    if (activeTab === 'resource' && kindOf(item) !== 'resource') return false;

    if (activeFilter === 'free') {
      if (priceOf(item) !== 0) return false;
    } else if (activeFilter !== 'all') {
      var category = String(item.category || '').toLowerCase();
      if (activeFilter !== category) return false;
    }

    var query = (search && search.value ? search.value : '').toLowerCase().trim();
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
      status.textContent = 'Найдено: 0';
      return;
    }

    grid.innerHTML = list.map(card).join('');
    status.textContent = 'Найдено: ' + list.length;
  }

  function applyList(list) {
    var remote = Array.isArray(list) ? list : [];
    var seen = {};
    var merged = [];

    remote.concat(localConfigs()).forEach(function (item) {
      var key = String(item.id || item.code || item.name || '');
      if (!key || seen[key]) return;
      seen[key] = true;
      merged.push(item);
    });

    items = merged.length ? merged : fallback;
    render();
  }

  function load() {
    status.textContent = 'Загрузка каталога…';

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

  var lightbox = document.getElementById('shopLightbox');
  var lightboxImg = document.getElementById('shopLightboxImg');

  function openLightbox(imageId) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = imageId ? (String(imageId).indexOf('data:') === 0 ? imageId : API + '/api/shop/images/' + imageId) : '';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (lightbox) lightbox.hidden = true;
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-lightbox]');
    if (trigger) {
      event.preventDefault();
      openLightbox(trigger.getAttribute('data-lightbox'));
      return;
    }
    var close = event.target.closest('[data-shop-lightbox-close]');
    if (close) {
      closeLightbox();
      return;
    }
    if (event.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && lightbox && !lightbox.hidden) closeLightbox();
  });

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

  function setTab(tab) {
    activeTab = tab || 'all';
    if (tabsRoot) {
      Array.prototype.forEach.call(tabsRoot.querySelectorAll('.shop-tab'), function (button) {
        var active = button.getAttribute('data-shop-tab') === activeTab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
    render();
  }

  if (tabsRoot) {
    tabsRoot.addEventListener('click', function (event) {
      var button = event.target.closest('[data-shop-tab]');
      if (!button) return;
      setTab(button.getAttribute('data-shop-tab'));
    });
  }

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

  function loadPurchases() {
    var siteToken = '';
    try { siteToken = localStorage.getItem('ankavisual.account.token') || ''; } catch (ignored) { /* приватный режим */ }
    if (!siteToken) return;
    fetch(API + '/api/payments/my', {
      headers: { Authorization: 'Bearer ' + siteToken, Accept: 'application/json' },
      cache: 'no-store'
    }).then(function (response) { return response.ok ? response.json() : {}; })
      .then(function (data) {
        (Array.isArray(data.purchases) ? data.purchases : []).forEach(function (purchase) {
          if (purchase && purchase.kind === 'shop_item' && purchase.itemId) {
            purchasedIds[String(purchase.itemId)] = true;
          }
        });
        render();
      })
      .catch(function () { /* покупки необязательны для каталога */ });
  }

  document.addEventListener('ankapay:paid', function (event) {
    var detail = event.detail || {};
    if (detail.itemId) {
      purchasedIds[String(detail.itemId)] = true;
      render();
    }
  });

  load();
  loadPurchases();
})();
