/* AnkaVisual Store — витрина, фильтры, демо-покупки. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var STORE_KEY = 'ankavisual.store.purchases';

  var CATEGORIES = [
    { id: 'all', name: 'Все товары' },
    { id: 'back', name: 'Спина', count: 15 },
    { id: 'hats', name: 'Шапки', count: 23 },
    { id: 'wings', name: 'Крылья', count: 8 },
    { id: 'pets', name: 'Питомцы', count: 16 },
    { id: 'aura', name: 'Аура', count: 7 },
    { id: 'body', name: 'Тело', count: 11 },
    { id: 'legs', name: 'Ноги', count: 7 },
    { id: 'tails', name: 'Хвосты', count: 4 },
    { id: 'hands', name: 'Руки', count: 2 },
    { id: 'cape', name: 'Плащи', count: 16 }
  ];

  var ITEMS = [
    { id: 'feathers', name: 'Дымные перья', cat: 'back', rarity: 'legendary', price: 249, tag: 'Новинка' },
    { id: 'reaper', name: 'Жнецы тумана', cat: 'back', rarity: 'epic', price: 149, tag: 'Хит' },
    { id: 'guardian', name: 'Крылья хранителя', cat: 'wings', rarity: 'epic', price: 199, tag: 'Хит' },
    { id: 'octopus', name: 'Осьминог', cat: 'pets', rarity: 'epic', price: 249 },
    { id: 'ghost', name: 'Мини-Гость', cat: 'pets', rarity: 'legendary', price: 149, tag: 'Новинка' },
    { id: 'smurf', name: 'Смурфик', cat: 'hats', rarity: 'legendary', price: 129, tag: 'Новинка' },
    { id: 'penguin', name: 'Пингвинчик', cat: 'pets', rarity: 'legendary', price: 129, tag: 'Новинка' },
    { id: 'axolotl', name: 'Аксо-хоровод', cat: 'pets', rarity: 'legendary', price: 199, tag: 'Новинка' },
    { id: 'fallen', name: 'Крылья падшего ангела', cat: 'wings', rarity: 'legendary', price: 699 },
    { id: 'lanterns', name: 'Зловещие фонари', cat: 'wings', rarity: 'epic', price: 199, tag: 'Новинка' },
    { id: 'eyes', name: 'Демонические глаза', cat: 'aura', rarity: 'mythic', price: 199, tag: 'Новинка' },
    { id: 'souls', name: 'Души', cat: 'aura', rarity: 'epic', price: 199 },
    { id: 'samurai', name: 'Самурай', cat: 'body', rarity: 'epic', price: 129 },
    { id: 'boots', name: 'New Rock', cat: 'legs', rarity: 'epic', price: 149 },
    { id: 'catTail', name: 'Кошачий хвост', cat: 'tails', rarity: 'rare', price: 119 },
    { id: 'paws', name: 'Кошачьи лапки', cat: 'hands', rarity: 'epic', price: 149 },
    { id: 'scarf', name: 'Полярный шарф', cat: 'body', rarity: 'rare', price: 69, tag: 'Недорого' },
    { id: 'glasses', name: 'Крутые очки', cat: 'hats', rarity: 'rare', price: 49, tag: 'Недорого' }
  ];

  var COLLECTION = [
    { id: 'dwing', name: 'Демонические крылья', cat: 'wings', rarity: 'rare', price: 249 },
    { id: 'dscythe', name: 'Демоническая коса', cat: 'back', rarity: 'rare', price: 119 },
    { id: 'd eyes', name: 'Демонический взгляд', cat: 'aura', rarity: 'epic', price: 79 },
    { id: 'dhalo', name: 'Демонический нимб', cat: 'hats', rarity: 'epic', price: 199 }
  ];

  var PARTNERS = [
    { name: 'Swordtick', shop: '7 товаров · от 59 ₽' },
    { name: 'SMYRF', shop: '6 товаров · от 49 ₽' },
    { name: 'Swaga_Funtik', shop: '6 товаров · от 49 ₽' },
    { name: 'Кириллка', shop: '5 товаров · от 59 ₽' }
  ];

  var activeCat = 'all';
  var currentItem = null;
  var currentAction = 'buy';

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (ignored) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (ignored) { /* ignore */ }
  }

  function purchased() { return read(STORE_KEY, []); }
  function isPurchased(id) { return purchased().indexOf(id) !== -1; }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function catName(id) {
    var found = CATEGORIES.filter(function (c) { return c.id === id; })[0];
    return found ? found.name : id;
  }

  function rarityLabel(value) {
    return { legendary: 'Легендарная', mythic: 'Мифическая', epic: 'Эпическая', rare: 'Редкая' }[value] || 'Обычная';
  }

  function toast(text) {
    var node = document.createElement('div');
    node.className = 'store-toast';
    node.textContent = text;
    document.body.appendChild(node);
    window.setTimeout(function () { node.classList.add('show'); }, 30);
    window.setTimeout(function () { node.remove(); }, 2600);
  }

  function itemCard(item) {
    var owned = isPurchased(item.id);
    return '<article class="store-item">' +
      '<div class="si-media"><span class="si-rarity ' + esc(item.rarity) + '">' + esc(rarityLabel(item.rarity)) + '</span>'
      + (item.tag ? '<span class="si-tag">' + esc(item.tag) + '</span>' : '') + '</div>' +
      '<div class="si-body"><div class="si-cat">' + esc(catName(item.cat)) + '</div>' +
      '<div class="si-name">' + esc(item.name) + '</div>' +
      '<div class="si-foot"><span class="si-price">' + item.price + ' ₽</span>' +
      (owned ? '<span class="si-tag">Куплено</span>'
        : '<button class="store-buy" type="button" data-buy="' + esc(item.name) + '" data-price="' + item.price + '" data-item-id="' + esc(item.id) + '">Купить</button>') +
      '</div></div></article>';
  }

  function renderGrid() {
    var grid = $('storeGrid');
    if (!grid) return;
    var query = ($('storeSearch') && $('storeSearch').value || '').toLowerCase().trim();
    var list = ITEMS.filter(function (item) {
      if (activeCat !== 'all' && item.cat !== activeCat) return false;
      if (!query) return true;
      return (item.name + ' ' + catName(item.cat) + ' ' + rarityLabel(item.rarity)).toLowerCase().indexOf(query) !== -1;
    });
    grid.innerHTML = list.length ? list.map(itemCard).join('')
      : '<div class="store-empty">Ничего не найдено — попробуй другой запрос.</div>';
  }

  function renderCats() {
    var root = $('storeCats');
    if (!root) return;
    root.innerHTML = CATEGORIES.map(function (cat) {
      return '<button class="store-cat' + (cat.id === activeCat ? ' is-active' : '') + '" type="button" data-cat="' + cat.id + '">'
        + esc(cat.name) + (cat.count ? '<small>' + cat.count + '</small>' : '') + '</button>';
    }).join('');
  }

  function renderCollection() {
    var grid = $('collectionGrid');
    if (grid) grid.innerHTML = COLLECTION.map(itemCard).join('');
  }

  function renderPartners() {
    var root = $('storePartners');
    if (!root) return;
    root.innerHTML = PARTNERS.map(function (partner) {
      return '<article class="partner-shop"><b>' + esc(partner.name) + '</b><span>' + esc(partner.shop)
        + '</span><a class="store-link" href="../partnership/">Все партнёры →</a></article>';
    }).join('');
  }

  function openCheckout(name, price, action, itemId) {
    currentItem = { name: name, price: price, id: itemId };
    currentAction = action || 'buy';
    var box = $('storeCheckout');
    var itemNode = $('scItem');
    var title = $('scTitle');
    if (!box) return;
    if (title) title.textContent = 'Покупка';
    if (itemNode) itemNode.textContent = esc(name) + ' · ' + price + ' ₽';
    box.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeCheckout() {
    var box = $('storeCheckout');
    if (box) box.hidden = true;
    document.body.style.overflow = '';
  }

  function confirmCheckout() {
    if (currentItem && currentItem.id) {
      var list = purchased();
      if (list.indexOf(currentItem.id) === -1) list.push(currentItem.id);
      write(STORE_KEY, list);
      toast('Куплено: ' + currentItem.name);
    } else {
      toast('Демо-покупка оформлена');
    }
    closeCheckout();
    renderGrid();
    renderCollection();
  }

  document.addEventListener('click', function (event) {
    var buy = event.target.closest('[data-buy]');
    if (buy) {
      openCheckout(buy.getAttribute('data-buy'), Number(buy.getAttribute('data-price')) || 0,
        'buy', buy.getAttribute('data-item-id'));
      return;
    }
    var cat = event.target.closest('[data-cat]');
    if (cat) {
      activeCat = cat.getAttribute('data-cat');
      renderCats();
      renderGrid();
      return;
    }
    if (event.target.closest('[data-sc-close]')) closeCheckout();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeCheckout();
  });

  function init() {
    var search = $('storeSearch');
    if (search) search.addEventListener('input', renderGrid);
    var confirm = $('scConfirm');
    if (confirm) confirm.addEventListener('click', confirmCheckout);
    var year = $('year');
    if (year) year.textContent = String(new Date().getFullYear());
    renderCats();
    renderGrid();
    renderCollection();
    renderPartners();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
