/* AnkaVisual — предзаказ платных тарифов.
 * Ползунок срока, расчёт суммы и отправка заявки в AnkaGuard.
 */
(function () {
  'use strict';

  var API = String(window.ANKA_API_BASE || 'https://ankaguard.ankavisual.workers.dev').replace(/\/+$/, '');
  var modal = document.getElementById('preorderModal');
  var form = document.getElementById('preorderForm');
  if (!modal || !form) return;

  /* 30 дней — 99 ₽, максимум ползунка — «навсегда» за 699 ₽. */
  var MIN_DAYS = 30;
  var MAX_DAYS = 365;
  var MIN_PRICE = 99;
  var MAX_PRICE = 699;

  var title = document.getElementById('poTitle');
  var status = document.getElementById('poStatus');
  var submit = form.querySelector('.po-submit');
  var daysRange = document.getElementById('poDays');
  var daysNum = document.getElementById('poDaysNum');
  var termTitle = document.getElementById('poTermTitle');
  var termLabel = document.getElementById('poTermLabel');
  var totalLabel = document.getElementById('poTotal');
  var daysBox = document.querySelector('.po-days');
  var scale = document.querySelector('.po-scale');

  var BETA_PRICE = 199;

  var plan = 'plus';
  var selectedDays = MIN_DAYS;
  var lastFocus = null;
  var successTimer = 0;

  function setStatus(text, isError) {
    if (!status) return;
    status.textContent = text || '';
    status.classList.toggle('is-error', !!isError);
  }

  function pluralDays(n) {
    var mod10 = n % 10;
    var mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'день';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
    return 'дней';
  }

  function priceFor(days) {
    if (days >= MAX_DAYS) return MAX_PRICE;
    var d = Math.max(MIN_DAYS, Math.min(MAX_DAYS, days));
    return Math.round(MIN_PRICE + (d - MIN_DAYS) * (MAX_PRICE - MIN_PRICE) / (MAX_DAYS - MIN_DAYS));
  }

  function render(days, syncNumber) {
    days = Math.round(Number(days));
    if (!isFinite(days)) days = MIN_DAYS;
    days = Math.max(MIN_DAYS, Math.min(MAX_DAYS, days));

    var forever = days >= MAX_DAYS;
    selectedDays = forever ? 0 : days;

    if (daysRange && Number(daysRange.value) !== days) daysRange.value = String(days);
    if (syncNumber && daysNum && Number(daysNum.value) !== days) daysNum.value = String(days);

    if (termLabel) {
      termLabel.textContent = forever ? 'навсегда' : (days + ' ' + pluralDays(days));
    }
    if (totalLabel) {
      totalLabel.textContent = (forever ? MAX_PRICE : priceFor(days)) + ' ₽';
    }
  }

  if (daysRange) {
    daysRange.addEventListener('input', function () {
      render(Number(daysRange.value), true);
    });
  }

  if (daysNum) {
    daysNum.addEventListener('input', function () {
      var value = parseInt(daysNum.value, 10);
      if (isNaN(value)) return;
      render(value, false);
    });
    daysNum.addEventListener('change', function () {
      var value = parseInt(daysNum.value, 10);
      render(isNaN(value) ? MIN_DAYS : value, true);
    });
  }

  render(MIN_DAYS, true);

  function applyPlan(planKey) {
    var isBeta = planKey === 'beta';
    if (termTitle) termTitle.textContent = isBeta ? 'Бета-доступ' : 'Срок подписки';
    if (daysBox) daysBox.hidden = isBeta;
    if (daysRange) daysRange.hidden = isBeta;
    if (scale) scale.hidden = isBeta;
    if (isBeta) {
      selectedDays = 0;
      if (termLabel) termLabel.textContent = 'разово';
      if (totalLabel) totalLabel.textContent = BETA_PRICE + ' ₽';
    } else {
      render(MIN_DAYS, true);
    }
  }

  function open(button) {
    clearTimeout(successTimer);
    plan = button.getAttribute('data-preorder') || 'plus';
    var planName = button.getAttribute('data-plan') || 'AnkaVisual Plus';
    if (title) title.textContent = planName;
    form.reset();
    applyPlan(plan);
    setStatus('');
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Отправить заявку';
    }
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    var field = form.querySelector('[name="contact"]');
    if (field) window.setTimeout(function () { field.focus(); }, 40);
  }

  function close() {
    clearTimeout(successTimer);
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-preorder]');
    if (trigger) {
      event.preventDefault();
      open(trigger);
      return;
    }
    if (event.target.closest('[data-po-close]')) {
      close();
      return;
    }
    if (event.target === modal) close();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !modal.hidden) close();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var data = new FormData(form);
    var contact = String(data.get('contact') || '').trim();
    var comment = String(data.get('comment') || '').trim();

    if (contact.length < 3) {
      setStatus('Укажи почту или @telegram.', true);
      return;
    }

    var chosenTerm = termLabel ? termLabel.textContent : '';
    var chosenTotal = totalLabel ? totalLabel.textContent : '';

    var headers = { 'Content-Type': 'application/json' };
    var siteToken = '';
    try { siteToken = localStorage.getItem('ankavisual.account.token') || ''; } catch (ignored) { /* ignore */ }
    if (siteToken) headers.Authorization = 'Bearer ' + siteToken;

    if (submit) submit.disabled = true;
    setStatus('Отправляем…');

    fetch(API + '/api/preorders', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        plan: plan,
        days: selectedDays,
        contact: contact,
        comment: comment
      }),
      cache: 'no-store'
    }).then(function (response) {
      return response.text().then(function (text) {
        var body = {};
        if (text) {
          try { body = JSON.parse(text); } catch (ignored) { /* not json */ }
        }
        if (!response.ok) {
          var error = new Error(body.message || 'Не удалось отправить заявку');
          error.status = response.status;
          throw error;
        }
        return body;
      });
    }).then(function () {
      form.reset();
      applyPlan(plan);
      setStatus('Заявка принята: ' + chosenTerm + ' · ' + chosenTotal
        + '. Напишем, когда откроется оплата.');
      if (submit) submit.textContent = 'Заявка отправлена';
      successTimer = window.setTimeout(function () {
        close();
        if (submit) submit.textContent = 'Отправить заявку';
      }, 2800);
    }).catch(function (error) {
      setStatus(error && error.status === 429
        ? 'Слишком много заявок. Попробуй позже.'
        : ((error && error.message) || 'Не удалось отправить заявку. Попробуй ещё раз.'), true);
    }).then(function () {
      if (submit) submit.disabled = false;
    });
  });
})();
