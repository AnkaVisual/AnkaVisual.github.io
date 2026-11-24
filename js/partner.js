/* AnkaVisual — партнёрство: окно управления промокодом и промо-видео.
 * Подключается на страницах с главным меню. Кнопка: [data-partner-open].
 */
(function () {
  'use strict';

  var API = String(window.ANKA_API_BASE || 'https://ankaguard.ankavisual.workers.dev').replace(/\/+$/, '');
  var STORE = 'ankavisual.partners.applications';
  var TOKEN_KEY = 'ankavisual.account.token';

  var overlay = null;
  var statusNode = null;
  var applyBlock = null;
  var promoBlock = null;
  var applyForm = null;
  var codeNode = null;
  var saveCodeBtn = null;
  var templatesRoot = null;
  var previewCanvas = null;
  var videoNode = null;
  var downloadNode = null;
  var msgNode = null;
  var genCodeBtn = null;
  var copyBtn = null;
  var genVideoBtn = null;
  var selectedTemplate = 'code';

  var ownerId = 'local';
  var current = null;
  var lastVideoUrl = '';
  var myPrefix = '';
  var reviewList = null;
  var reviewBlock = null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (ignored) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (ignored) { /* приватный режим */ }
  }

  function setMsg(text, bad) {
    if (!msgNode) return;
    msgNode.textContent = text || '';
    msgNode.hidden = !text;
    msgNode.className = 'partner-modal-msg' + (text ? (bad ? ' is-bad' : ' is-ok') : '');
  }

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (ignored) { return ''; }
  }

  function build() {
    if (document.getElementById('partnerModal')) return;

    var wrap = document.createElement('div');
    wrap.className = 'partner-modal';
    wrap.id = 'partnerModal';
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="partner-modal-backdrop" data-partner-close></div>' +
      '<section class="partner-modal-card" role="dialog" aria-modal="true" aria-labelledby="partnerModalTitle">' +
        '<button type="button" class="partner-modal-close" data-partner-close aria-label="Закрыть">×</button>' +
        '<span class="partner-modal-kicker">AnkaVisual Partners</span>' +
        '<h2 id="partnerModalTitle">Партнёрство</h2>' +
        '<p class="partner-modal-lede">Промокод и промо-видео с твоим кодом — в одном окне.</p>' +
        '<div class="partner-modal-status" id="partnerModalStatus">Статус: загрузка…</div>' +

        '<div id="partnerReviewBlock" hidden>' +
          '<h3 class="partner-modal-h3">Заявки на партнёрство</h3>' +
          '<p class="partner-modal-hint">Одобряй или отклоняй заявки — решение сразу видно партнёру.</p>' +
          '<div id="partnerReviewList" class="partner-review-list"></div>' +
        '</div>' +

        '<div id="partnerApplyBlock">' +
          '<h3 class="partner-modal-h3">Стать партнёром</h3>' +
          '<p class="partner-modal-hint">Заявка рассматривается владельцем проекта.</p>' +
          '<form id="partnerApplyForm" class="partner-modal-form">' +
            '<label class="auth-field"><span class="partner-modal-label">Имя или проект</span>' +
              '<input name="name" type="text" class="auth-input" placeholder="Как к тебе обращаться" maxlength="60" required></label>' +
            '<label class="auth-field"><span class="partner-modal-label">Контакт</span>' +
              '<input name="contact" type="text" class="auth-input" placeholder="Discord, Telegram или почта" maxlength="80" required></label>' +
            '<label class="auth-field"><span class="partner-modal-label">Ссылка на проект</span>' +
              '<input name="link" type="url" class="auth-input" placeholder="https://" maxlength="200"></label>' +
            '<label class="auth-field"><span class="partner-modal-label">О проекте</span>' +
              '<textarea name="about" class="auth-input auth-textarea" rows="3" placeholder="Чем занимаешься и как хочешь сотрудничать" maxlength="600" required></textarea></label>' +
            '<button class="auth-btn auth-btn--primary" type="submit">Отправить заявку</button>' +
          '</form>' +
        '</div>' +

        '<div id="partnerPromoBlock" hidden>' +
          '<h3 class="partner-modal-h3">Промо-инструменты</h3>' +
          '<label class="auth-field">' +
            '<span class="partner-modal-label">Свой промокод — он будет в видео</span>' +
            '<div class="partner-promo-code-row">' +
              '<input id="partnerPromoInput" type="text" class="partner-promo-input" maxlength="24" placeholder="Например, PART-ABC123" autocomplete="off">' +
              '<button type="button" class="dash-btn dash-btn--ghost" id="partnerPromoGenerate">Случайный</button>' +
              '<button type="button" class="dash-btn dash-btn--ghost" id="partnerPromoCopy">Копировать</button>' +
              '<button type="button" class="dash-btn dash-btn--ghost" id="partnerPromoSave">Сохранить</button>' +
            '</div>' +
          '</label>' +
          '<p class="partner-modal-hint">Впиши любой код — именно он появится в кадре. Не забудь сохранить.</p>' +

          '<div class="partner-editor">' +
            '<h3 class="partner-modal-h3">Редактор видео</h3>' +
            '<p class="partner-modal-hint">Выбери шаблон и посмотри предпросмотр.</p>' +
            '<div class="partner-editor-templates" id="partnerTemplates">' +
              '<button type="button" class="partner-template is-active" data-template="code"><b>Промокод</b><span>большой код на фоне</span></button>' +
              '<button type="button" class="partner-template" data-template="download"><b>Как скачать</b><span>3 шага и код в конце</span></button>' +
              '<button type="button" class="partner-template" data-template="sale"><b>Скидка</b><span>акцент на выгоде и код</span></button>' +
            '</div>' +
            '<canvas id="partnerPreview" class="partner-preview" width="640" height="360" aria-label="Предпросмотр промо-видео"></canvas>' +
          '</div>' +

          '<div class="partner-promo-video">' +
            '<video id="partnerPromoVideo" controls hidden></video>' +
            '<button type="button" class="auth-btn auth-btn--primary" id="partnerPromoVideoGenerate">Сгенерировать промо-видео</button>' +
            '<a class="dash-btn dash-btn--ghost" id="partnerPromoVideoDownload" hidden>Скачать .webm</a>' +
          '</div>' +
          '<p class="partner-modal-hint">Если есть референс — пришли его команде, и мы добавим новый шаблон в редактор.</p>' +
        '</div>' +

        '<p id="partnerModalMsg" class="partner-modal-msg" role="status" hidden></p>' +
      '</section>';

    document.body.appendChild(wrap);

    overlay = wrap;
    statusNode = document.getElementById('partnerModalStatus');
    reviewBlock = document.getElementById('partnerReviewBlock');
    reviewList = document.getElementById('partnerReviewList');
    applyBlock = document.getElementById('partnerApplyBlock');
    promoBlock = document.getElementById('partnerPromoBlock');
    applyForm = document.getElementById('partnerApplyForm');
    codeNode = document.getElementById('partnerPromoInput');
    saveCodeBtn = document.getElementById('partnerPromoSave');
    templatesRoot = document.getElementById('partnerTemplates');
    previewCanvas = document.getElementById('partnerPreview');
    videoNode = document.getElementById('partnerPromoVideo');
    downloadNode = document.getElementById('partnerPromoVideoDownload');
    msgNode = document.getElementById('partnerModalMsg');
    genCodeBtn = document.getElementById('partnerPromoGenerate');
    copyBtn = document.getElementById('partnerPromoCopy');
    genVideoBtn = document.getElementById('partnerPromoVideoGenerate');

    wrap.addEventListener('click', function (event) {
      if (event.target.closest('[data-partner-close]')) close();
    });

    if (applyForm) applyForm.addEventListener('submit', submitApplication);
    if (reviewList) reviewList.addEventListener('click', function (event) {
      var button = event.target.closest('[data-decide]');
      if (!button) return;
      decide(button.getAttribute('data-decide'), button.getAttribute('data-app-id'));
    });
    if (genCodeBtn) genCodeBtn.addEventListener('click', function () {
      var code = generateCode();
      setMsg('Промокод сгенерирован: ' + code, false);
      renderPreview();
    });
    if (saveCodeBtn) saveCodeBtn.addEventListener('click', savePromoCode);
    if (codeNode) {
      codeNode.addEventListener('input', renderPreview);
      codeNode.addEventListener('change', savePromoCode);
    }
    if (templatesRoot) templatesRoot.addEventListener('click', function (event) {
      var button = event.target.closest('[data-template]');
      if (!button) return;
      setTemplate(button.getAttribute('data-template'));
    });
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var code = String(codeNode ? codeNode.value : '').trim();
      if (!code) { setMsg('Сначала введи промокод', true); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(function () { setMsg('Промокод скопирован', false); }).catch(function () { setMsg('Промокод: ' + code, false); });
      } else {
        setMsg('Промокод: ' + code, false);
      }
    });
    if (genVideoBtn) genVideoBtn.addEventListener('click', startVideo);
  }

  function refreshIdentity() {
    var t = token();
    if (!t) { ownerId = 'local'; return Promise.resolve(); }
    return fetch(API + '/api/auth/me', {
      headers: { Authorization: 'Bearer ' + t, Accept: 'application/json' },
      cache: 'no-store'
    }).then(function (response) { return response.ok ? response.json() : {}; })
      .then(function (data) {
        var account = data && data.account;
        ownerId = (account && (account.id || account.accountId)) || 'local';
        myPrefix = String((account && account.prefix) || '').toLowerCase();
      })
      .catch(function () { ownerId = 'local'; myPrefix = ''; });
  }

  function load() {
    var list = read(STORE, []);
    var mine = (Array.isArray(list) ? list : []).filter(function (item) {
      return String((item && (item.authorId || item.owner)) || '') === ownerId;
    }).sort(function (a, b) { return Number(b.created || 0) - Number(a.created || 0); });

    current = mine[0] || null;
    var status = current ? String(current.status || 'pending') : 'none';
    var label = { none: 'Заявка не подана', pending: 'На рассмотрении', approved: 'Партнёр', rejected: 'Отклонена' }[status] || status;

    if (statusNode) {
      statusNode.textContent = 'Статус: ' + label;
      statusNode.setAttribute('data-state', status);
    }
    if (applyBlock) applyBlock.hidden = status === 'approved';
    if (promoBlock) promoBlock.hidden = status !== 'approved';

    if (status === 'approved') {
      var code = String((current && current.promoCode) || '').trim();
      if (!code) code = generateCode();
      if (codeNode) codeNode.value = code;
      selectedTemplate = String((current && current.promoTemplate) || 'code');
      if (templatesRoot) {
        Array.prototype.forEach.call(templatesRoot.querySelectorAll('[data-template]'), function (button) {
          button.classList.toggle('is-active', button.getAttribute('data-template') === selectedTemplate);
        });
      }
      renderPreview();
    }
    setMsg('', false);
    renderReview();
  }

  function isOwner() {
    return ['owner', 'coowner', 'admin'].indexOf(myPrefix) !== -1;
  }

  function renderReview() {
    if (!reviewBlock) return;
    reviewBlock.hidden = !isOwner();
    if (!isOwner() || !reviewList) return;

    var list = read(STORE, []);
    if (!Array.isArray(list)) list = [];
    reviewList.replaceChildren();

    if (!list.length) {
      var empty = document.createElement('p');
      empty.className = 'partner-modal-hint';
      empty.textContent = 'Новых заявок нет.';
      reviewList.appendChild(empty);
      return;
    }

    list.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'partner-review-row';

      var info = document.createElement('div');
      info.className = 'partner-review-info';
      var name = document.createElement('strong');
      name.textContent = item.name || 'Партнёр';
      var meta = document.createElement('span');
      meta.textContent = [item.contact, item.link].filter(Boolean).join(' · ');
      var about = document.createElement('p');
      about.textContent = item.about || '';
      var state = document.createElement('span');
      state.className = 'partner-review-state';
      state.setAttribute('data-state', String(item.status || 'pending'));
      state.textContent = { pending: 'На рассмотрении', approved: 'Одобрена', rejected: 'Отклонена' }[String(item.status || 'pending')] || item.status;
      info.append(name, meta, about, state);

      var actions = document.createElement('div');
      actions.className = 'partner-review-actions';
      var approve = document.createElement('button');
      approve.type = 'button';
      approve.className = 'dash-btn dash-btn--ghost';
      approve.textContent = 'Одобрить';
      approve.setAttribute('data-decide', 'approved');
      approve.setAttribute('data-app-id', String(item.id || ''));
      var reject = document.createElement('button');
      reject.type = 'button';
      reject.className = 'dash-btn dash-btn--ghost';
      reject.textContent = 'Отклонить';
      reject.setAttribute('data-decide', 'rejected');
      reject.setAttribute('data-app-id', String(item.id || ''));
      actions.append(approve, reject);

      row.append(info, actions);
      reviewList.appendChild(row);
    });
  }

  function decide(decision, id) {
    if (!id || !decision) return;
    var list = read(STORE, []);
    if (!Array.isArray(list)) return;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id || '') === String(id)) {
        list[i].status = decision;
        break;
      }
    }
    save(list);
    renderReview();
    load();
    setMsg(decision === 'approved' ? 'Заявка одобрена' : 'Заявка отклонена', false);
  }

  function save(list) {
    write(STORE, list);
  }

  function submitApplication(event) {
    event.preventDefault();
    if (!applyForm) return;

    var form = new FormData(applyForm);
    var name = String(form.get('name') || '').trim();
    var contact = String(form.get('contact') || '').trim();
    var about = String(form.get('about') || '').trim();

    if (name.length < 2) { setMsg('Укажи имя или название проекта', true); return; }
    if (contact.length < 3) { setMsg('Нужен контакт для связи', true); return; }
    if (about.length < 10) { setMsg('Расскажи о проекте чуть подробнее', true); return; }

    var application = {
      id: 'partner-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      authorId: ownerId,
      name: name,
      contact: contact,
      link: String(form.get('link') || '').trim(),
      about: about,
      status: 'pending',
      created: Math.floor(Date.now() / 1000)
    };

    var list = read(STORE, []);
    if (!Array.isArray(list)) list = [];
    list = list.filter(function (item) { return String((item && (item.authorId || item.owner)) || '') !== ownerId; });
    list.push(application);
    save(list);

    applyForm.reset();
    load();
    setMsg('Заявка отправлена. Статус можно посмотреть здесь же.', false);
  }

  function promoField() {
    return String(codeNode ? codeNode.value : '').trim().slice(0, 24);
  }

  function savePromoCode() {
    var code = promoField();
    if (!code) { setMsg('Введи промокод', true); return; }
    if (codeNode) codeNode.value = code;
    var list = read(STORE, []);
    if (!Array.isArray(list)) list = [];
    for (var i = 0; i < list.length; i++) {
      if (current && String(list[i].id || '') === String(current.id)) {
        list[i].promoCode = code;
        current = list[i];
        break;
      }
    }
    save(list);
    renderPreview();
    setMsg('Промокод сохранён: ' + code, false);
  }

  function generateCode() {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = 'PART-';
    for (var i = 0; i < 6; i++) out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    var list = read(STORE, []);
    if (!Array.isArray(list)) list = [];
    for (var j = 0; j < list.length; j++) {
      if (current && String(list[j].id || '') === String(current.id)) {
        list[j].promoCode = out;
        current = list[j];
        break;
      }
    }
    save(list);
    if (codeNode) codeNode.value = out;
    return out;
  }

  function setTemplate(name) {
    selectedTemplate = name || 'code';
    if (templatesRoot) {
      Array.prototype.forEach.call(templatesRoot.querySelectorAll('[data-template]'), function (button) {
        button.classList.toggle('is-active', button.getAttribute('data-template') === selectedTemplate);
      });
    }
    var list = read(STORE, []);
    if (!Array.isArray(list)) list = [];
    for (var i = 0; i < list.length; i++) {
      if (current && String(list[i].id || '') === String(current.id)) {
        list[i].promoTemplate = selectedTemplate;
        current = list[i];
        break;
      }
    }
    save(list);
    renderPreview();
  }

  function drawFrame(ctx, w, h, code, progress, template) {
    ctx.save();
    ctx.scale(w / 1280, h / 720);

    var bg = ctx.createLinearGradient(0, 0, 1280, 720);
    bg.addColorStop(0, '#0c0a16');
    bg.addColorStop(1, '#171226');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1280, 720);

    var glow = ctx.createRadialGradient(640, 360, 40, 640, 360, 420);
    glow.addColorStop(0, 'rgba(177,140,255,0.35)');
    glow.addColorStop(1, 'rgba(177,140,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1280, 720);

    ctx.textAlign = 'center';

    if (template === 'download') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '600 76px Inter, system-ui, sans-serif';
      ctx.fillText('Как скачать AnkaVisual', 640, 150);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = '400 50px Inter, system-ui, sans-serif';
      ctx.fillText('1. Скачай AnkaLauncher', 640, 250);
      ctx.fillText('2. Войди в аккаунт', 640, 320);
      ctx.fillText('3. Введи промокод', 640, 390);
      ctx.fillStyle = '#b18cff';
      ctx.font = '700 110px Inter, system-ui, sans-serif';
      ctx.fillText(code, 640, 520);
    } else if (template === 'sale') {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '500 58px Inter, system-ui, sans-serif';
      ctx.fillText('Скидка для твоей аудитории', 640, 210);
      ctx.fillStyle = 'rgba(177,140,255,0.18)';
      ctx.fillRect(240, 280, 800, 190);
      ctx.fillStyle = '#fff';
      ctx.font = '700 118px Inter, system-ui, sans-serif';
      ctx.fillText(code, 640, 405);
      ctx.fillStyle = '#b18cff';
      ctx.font = '600 46px Inter, system-ui, sans-serif';
      ctx.fillText('AnkaVisual · Partner', 640, 545);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '500 60px Inter, system-ui, sans-serif';
      ctx.fillText('AnkaVisual', 640, 170);
      ctx.fillStyle = '#b18cff';
      ctx.font = '700 130px Inter, system-ui, sans-serif';
      ctx.fillText(code, 640, 390);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '400 44px Inter, system-ui, sans-serif';
      ctx.fillText('скидка для аудитории партнёра', 640, 510);
    }

    var barW = Math.round(1280 * (0.25 + 0.75 * Math.min(1, progress)));
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(640 - barW / 2, 660, barW, 6);
    ctx.restore();
  }

  function renderPreview() {
    if (!previewCanvas) return;
    var ctx = previewCanvas.getContext('2d');
    if (!ctx) return;
    drawFrame(ctx, previewCanvas.width, previewCanvas.height, promoField() || 'PART-XXXXXX', 1, selectedTemplate);
  }

  function makeVideo(code, template) {
    return new Promise(function (resolve, reject) {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        var ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('браузер не поддерживает генерацию видео')); return; }
        var stream = canvas.captureStream(30);
        var mime = 'video/webm';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) mime = 'video/webm;codecs=vp9';
          else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) mime = 'video/webm;codecs=vp8';
        }
        var recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
        var chunks = [];
        recorder.ondataavailable = function (event) { if (event.data && event.data.size) chunks.push(event.data); };
        recorder.onstop = function () {
          var blob = new Blob(chunks, { type: 'video/webm' });
          resolve({ blob: blob, url: URL.createObjectURL(blob) });
        };
        recorder.start(250);
        var durationMs = 6000;
        var startedAt = Date.now();
        drawFrame(ctx, canvas.width, canvas.height, code, 0, template);
        var drawTimer = window.setInterval(function () {
          drawFrame(ctx, canvas.width, canvas.height, code, Math.min(1, (Date.now() - startedAt) / durationMs), template);
        }, 1000 / 30);
        window.setTimeout(function () {
          window.clearInterval(drawTimer);
          if (recorder.state !== 'inactive') recorder.stop();
        }, durationMs);
      } catch (error) { reject(error); }
    });
  }

  function startVideo() {
    if (!genVideoBtn) return;
    var code = promoField();
    if (!code) { setMsg('Введи промокод для видео', true); return; }
    genVideoBtn.disabled = true;
    setMsg('Генерирую промо-видео…', false);
    makeVideo(code, selectedTemplate).then(function (result) {
      if (lastVideoUrl) URL.revokeObjectURL(lastVideoUrl);
      lastVideoUrl = result.url;
      if (videoNode) { videoNode.src = result.url; videoNode.hidden = false; }
      if (downloadNode) {
        downloadNode.href = result.url;
        downloadNode.download = 'promo-' + code + '.webm';
        downloadNode.hidden = false;
      }
      setMsg('Промо-видео готово', false);
    }).catch(function (error) {
      setMsg((error && error.message) || 'не удалось сгенерировать видео', true);
    }).then(function () { genVideoBtn.disabled = false; });
  }

  function open() {
    build();
    if (!overlay) return;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    refreshIdentity().then(load);
  }

  function close() {
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-partner-open]');
    if (trigger) {
      event.preventDefault();
      open();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && overlay && !overlay.hidden) close();
  });
})();
