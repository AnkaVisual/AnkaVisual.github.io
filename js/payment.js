/* AnkaVisual — демо-оплата Plus, Беты и товаров магазина.
 * Триггеры: [data-pay="plus|beta"], [data-pay-item] с data-pay-name / data-pay-price.
 */
(function () {
  'use strict';

  var API = String(window.ANKA_API_BASE || 'https://ankaguard.ankavisual.workers.dev').replace(/\/+$/, '');
  var TOKEN_KEY = 'ankavisual.account.token';
  var MIN_DAYS = 30, MAX_DAYS = 365, MIN_PRICE = 119, MAX_PRICE = 699;

  var overlay = null;
  var titleNode = null;
  var termBox = null;
  var itemBox = null;
  var itemNameNode = null;
  var itemPriceNode = null;
  var daysRange = null;
  var daysNum = null;
  var termLabel = null;
  var totalLabel = null;
  var contactInput = null;
  var msgNode = null;
  var actionsNode = null;
  var successNode = null;
  var successText = null;

  var kind = 'plus';
  var itemId = '';
  var itemPrice = 0;
  var itemName = '';
  var selectedDays = MIN_DAYS;
  var lastFocus = null;

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (ignored) { return ''; }
  }

  function headers(withJson) {
    var h = { Accept: 'application/json' };
    if (withJson) h['Content-Type'] = 'application/json';
    if (token()) h.Authorization = 'Bearer ' + token();
    return h;
  }

  function setMsg(text, bad) {
    if (!msgNode) return;
    msgNode.textContent = text || '';
    msgNode.hidden = !text;
    msgNode.className = 'pay-msg' + (text ? (bad ? ' is-bad' : ' is-ok') : '');
  }

  function pluralDays(n) {
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'день';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
    return 'дней';
  }

  function priceFor(days) {
    if (days >= MAX_DAYS) return MAX_PRICE;
    var d = Math.max(MIN_DAYS, Math.min(MAX_DAYS, days));
    return Math.round(MIN_PRICE + (d - MIN_DAYS) * (MAX_PRICE - MIN_PRICE) / (MAX_DAYS - MIN_DAYS));
  }

  function renderDays(value, syncNumber) {
    var days = Math.round(Number(value));
    if (!isFinite(days)) days = MIN_DAYS;
    days = Math.max(MIN_DAYS, Math.min(MAX_DAYS, days));
    selectedDays = days >= MAX_DAYS ? 0 : days;
    if (daysRange && Number(daysRange.value) !== days) daysRange.value = String(days);
    if (syncNumber && daysNum && Number(daysNum.value) !== days) daysNum.value = String(days);
    if (termLabel) termLabel.textContent = days >= MAX_DAYS ? 'навсегда' : (days + ' ' + pluralDays(days));
    if (totalLabel) totalLabel.textContent = (days >= MAX_DAYS ? MAX_PRICE : priceFor(days)) + ' ₽';
  }

  function build() {
    if (document.getElementById('payModal')) return;

    var wrap = document.createElement('div');
    wrap.className = 'pay-modal';
    wrap.id = 'payModal';
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="pay-modal-backdrop" data-pay-close></div>' +
      '<section class="pay-modal-card" role="dialog" aria-modal="true" aria-labelledby="payModalTitle">' +
        '<button type="button" class="pay-modal-close" data-pay-close aria-label="Закрыть">×</button>' +
        '<span class="pay-modal-kicker">Оплата <b class="pay-soon">скоро</b></span>' +
        '<h2 id="payModalTitle">Оплата</h2>' +
        '<p class="pay-modal-lede">Способы оплаты появятся скоро. Сейчас можно оформить заказ — он сохранится, а доступ откроется, когда подключим приём платежей.</p>' +

        '<div class="pay-term" id="payTermBox" hidden>' +
          '<div class="pay-term-head"><span>Срок подписки</span>' +
            '<label class="pay-days"><input id="payDaysNum" type="number" min="30" max="365" step="1" value="30"><span>дн.</span></label>' +
          '</div>' +
          '<input id="payDays" class="pay-range" type="range" min="30" max="365" step="1" value="30">' +
          '<div class="pay-scale"><span>30 дней · 119 ₽</span><span>навсегда · 699 ₽</span></div>' +
          '<div class="pay-total"><span id="payTermLabel">30 дней</span><b id="payTotal">119 ₽</b></div>' +
        '</div>' +

        '<div class="pay-item" id="payItemBox" hidden>' +
          '<span>Товар магазина</span><b id="payItemName">—</b><strong id="payItemPrice">—</strong>' +
        '</div>' +

        '<label class="auth-field">' +
          '<span class="pay-label">Почта или @telegram</span>' +
          '<input id="payContact" type="text" class="pay-input" maxlength="120" placeholder="you@example.com" autocomplete="email">' +
        '</label>' +
        '<p id="payMsg" class="pay-msg" role="status" hidden></p>' +
        '<div id="payActions">' +
          '<button type="button" class="pay-submit" id="paySubmit">Оформить заказ</button>' +
        '</div>' +
        '<div id="paySuccess" class="pay-success" hidden>' +
          '<b>Заказ оформлен</b>' +
          '<p id="paySuccessText"></p>' +
          '<button type="button" class="pay-submit" data-pay-close>Готово</button>' +
        '</div>' +
      '</section>';

    document.body.appendChild(wrap);
    overlay = wrap;
    titleNode = document.getElementById('payModalTitle');
    termBox = document.getElementById('payTermBox');
    itemBox = document.getElementById('payItemBox');
    itemNameNode = document.getElementById('payItemName');
    itemPriceNode = document.getElementById('payItemPrice');
    daysRange = document.getElementById('payDays');
    daysNum = document.getElementById('payDaysNum');
    termLabel = document.getElementById('payTermLabel');
    totalLabel = document.getElementById('payTotal');
    contactInput = document.getElementById('payContact');
    msgNode = document.getElementById('payMsg');
    actionsNode = document.getElementById('payActions');
    successNode = document.getElementById('paySuccess');
    successText = document.getElementById('paySuccessText');

    wrap.addEventListener('click', function (event) {
      if (event.target.closest('[data-pay-close]')) close();
    });
    if (daysRange) daysRange.addEventListener('input', function () { renderDays(daysRange.value, true); });
    if (daysNum) {
      daysNum.addEventListener('input', function () {
        var n = parseInt(daysNum.value, 10);
        if (!isNaN(n)) renderDays(n, false);
      });
      daysNum.addEventListener('change', function () {
        var n = parseInt(daysNum.value, 10);
        renderDays(isNaN(n) ? MIN_DAYS : n, true);
      });
    }
    var submit = document.getElementById('paySubmit');
    if (submit) submit.addEventListener('click', submitPayment);

    renderDays(MIN_DAYS, true);
  }

  function prefillContact() {
    if (!contactInput || !token()) return;
    fetch(API + '/api/auth/me', { headers: headers(false), cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (data) {
        var account = data && data.account;
        if (account && contactInput && !contactInput.value) {
          contactInput.value = account.email || account.username || '';
        }
      })
      .catch(function () { /* оставлем ввод пустым */ });
  }

  function open(options) {
    build();
    if (!overlay) return;
    lastFocus = document.activeElement;
    kind = options.kind || 'plus';
    itemId = options.itemId || '';
    itemPrice = Number(options.price) || 0;
    itemName = options.name || 'Товар магазина';

    if (titleNode) {
      titleNode.textContent = kind === 'plus' ? 'AnkaVisual Plus'
        : kind === 'beta' ? 'Бета-Версия'
        : itemName;
    }
    if (termBox) termBox.hidden = kind !== 'plus';
    if (itemBox) itemBox.hidden = kind !== 'shop_item';
    if (itemNameNode) itemNameNode.textContent = itemName;
    if (itemPriceNode) itemPriceNode.textContent = itemPrice + ' ₽';
    if (termBox && kind === 'plus') renderDays(MIN_DAYS, true);

    if (actionsNode) actionsNode.hidden = false;
    if (successNode) successNode.hidden = true;
    setMsg('', false);
    prefillContact();

    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    if (contactInput) window.setTimeout(function () { contactInput.focus(); }, 40);
  }

  function close() {
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function submitPayment() {
    if (!contactInput) return;
    var contact = String(contactInput.value || '').trim();
    if (!token() && contact.length < 3) { setMsg('Укажи почту или @telegram', true); return; }

    var body = { kind: kind };
    if (kind === 'plus') body.days = selectedDays;
    if (kind === 'shop_item') body.itemId = itemId;
    if (contact) body.contact = contact;

    var submit = document.getElementById('paySubmit');
    if (submit) submit.disabled = true;
    setMsg('Создаю заказ…', false);

    fetch(API + '/api/payments/create', {
      method: 'POST', headers: headers(true), body: JSON.stringify(body), cache: 'no-store'
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) throw new Error(data.message || 'не удалось создать заказ');
        return data.order;
      });
    }).then(function (order) {
      setMsg('Оформляю заказ…', false);
      return fetch(API + '/api/payments/confirm', {
        method: 'POST', headers: headers(true),
        body: JSON.stringify({ orderId: order.id, contact: contact }),
        cache: 'no-store'
      }).then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data.message || 'не удалось подтвердить оплату');
          return { order: order, result: data };
        });
      });
    }).then(function (data) {
      if (actionsNode) actionsNode.hidden = true;
      if (successNode) successNode.hidden = false;
      if (successText) {
        var label = kind === 'plus'
          ? (selectedDays === 0 ? 'AnkaVisual Plus · навсегда' : 'AnkaVisual Plus · ' + selectedDays + ' дн.')
          : kind === 'beta' ? 'Бета-Версия' : itemName;
        successText.textContent = label + ' · заказ ' + data.order.id + ' · ' + data.order.amount + ' ₽';
      }
      setMsg('', false);
      document.dispatchEvent(new CustomEvent('ankapay:paid', {
        detail: { kind: kind, itemId: itemId, order: data.order, purchase: data.result.purchase }
      }));
      loadMyPayments();
    }).catch(function (error) {
      setMsg((error && error.message) || 'оплата не удалась', true);
    }).then(function () {
      if (submit) submit.disabled = false;
    });
  }

  function fmtDate(unix) {
    var n = Number(unix) || 0;
    if (!n) return '—';
    return new Date(n * 1000).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function loadMyPayments() {
    var ordersNode = document.getElementById('payOrdersList');
    var purchasesNode = document.getElementById('payPurchasesList');
    if (!ordersNode || !token()) return;

    fetch(API + '/api/payments/my', { headers: headers(false), cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (data) {
        var orders = Array.isArray(data.orders) ? data.orders : [];
        var purchases = Array.isArray(data.purchases) ? data.purchases : [];
        ordersNode.textContent = '';
        orders.forEach(function (order) {
          var row = document.createElement('div');
          row.className = 'pay-row';
          row.innerHTML = '<b></b><span></span>';
          row.querySelector('b').textContent = order.amount + ' ₽ · ' + order.kind;
          row.querySelector('span').textContent = fmtDate(order.created) + ' · ' + order.status + ' · ' + order.id;
          ordersNode.appendChild(row);
        });
        if (!orders.length) ordersNode.textContent = 'Пока нет заказов.';

        if (purchasesNode) {
          purchasesNode.textContent = '';
          purchases.forEach(function (purchase) {
            var row = document.createElement('div');
            row.className = 'pay-row';
            row.innerHTML = '<b></b><span></span>';
            var name = purchase.kind === 'plus' ? 'AnkaVisual Plus'
              : purchase.kind === 'beta' ? 'Бета-Версия' : purchase.itemId;
            row.querySelector('b').textContent = name;
            row.querySelector('span').textContent = purchase.expires
              ? 'до ' + fmtDate(purchase.expires)
              : (purchase.kind === 'plus' ? 'навсегда' : 'разово');
            purchasesNode.appendChild(row);
          });
          if (!purchases.length) purchasesNode.textContent = 'Пока нет покупок.';
        }
      })
      .catch(function () { /* панель покупок необязательна */ });
  }

  document.addEventListener('click', function (event) {
    var payButton = event.target.closest('[data-pay]');
    if (payButton) {
      event.preventDefault();
      var key = payButton.getAttribute('data-pay');
      if (key === 'beta') open({ kind: 'beta' });
      else open({ kind: 'plus' });
      return;
    }
    var itemButton = event.target.closest('[data-pay-item]');
    if (itemButton) {
      event.preventDefault();
      open({
        kind: 'shop_item',
        itemId: itemButton.getAttribute('data-pay-item'),
        name: itemButton.getAttribute('data-pay-name') || 'Товар магазина',
        price: Number(itemButton.getAttribute('data-pay-price')) || 0
      });
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && overlay && !overlay.hidden) close();
  });

  if (document.getElementById('payOrdersList')) loadMyPayments();
})();
