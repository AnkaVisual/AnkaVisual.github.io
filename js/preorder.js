/* AnkaVisual — предзаказ платных тарифов.
 * Открывает окно, отправляет заявку в AnkaGuard и показывает результат.
 */
(function () {
  'use strict';

  var API = String(window.ANKA_API_BASE || 'https://ankaguard.ankavisual.workers.dev').replace(/\/+$/, '');
  var modal = document.getElementById('preorderModal');
  var form = document.getElementById('preorderForm');
  if (!modal || !form) return;

  var title = document.getElementById('poTitle');
  var status = document.getElementById('poStatus');
  var submit = form.querySelector('.po-submit');
  var plan = 'plus';
  var lastFocus = null;
  var successTimer = 0;

  function setStatus(text, isError) {
    if (!status) return;
    status.textContent = text || '';
    status.classList.toggle('is-error', !!isError);
  }

  function open(button) {
    clearTimeout(successTimer);
    plan = button.getAttribute('data-preorder') || 'plus';
    var planName = button.getAttribute('data-plan') || 'AnkaVisual Plus';
    if (title) title.textContent = planName;
    form.reset();
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

    var headers = { 'Content-Type': 'application/json' };
    var siteToken = '';
    try { siteToken = localStorage.getItem('ankavisual.account.token') || ''; } catch (ignored) { /* ignore */ }
    if (siteToken) headers.Authorization = 'Bearer ' + siteToken;

    if (submit) submit.disabled = true;
    setStatus('Отправляем…');

    fetch(API + '/api/preorders', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ plan: plan, contact: contact, comment: comment }),
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
      setStatus('Заявка принята. Напишем, когда откроется оплата.');
      if (submit) submit.textContent = 'Заявка отправлена';
      successTimer = window.setTimeout(function () {
        close();
        if (submit) submit.textContent = 'Отправить заявку';
      }, 2600);
    }).catch(function (error) {
      setStatus(error && error.status === 429
        ? 'Слишком много заявок. Попробуй позже.'
        : ((error && error.message) || 'Не удалось отправить заявку. Попробуй ещё раз.'), true);
    }).then(function () {
      if (submit) submit.disabled = false;
    });
  });
})();
