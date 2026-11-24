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
  var videoNode = null;
  var downloadNode = null;
  var msgNode = null;
  var genCodeBtn = null;
  var copyBtn = null;
  var genVideoBtn = null;

  var ownerId = 'local';
  var current = null;
  var lastVideoUrl = '';

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
          '<div class="partner-promo-code-row">' +
            '<code id="partnerPromoCode" class="partner-promo-code">—</code>' +
            '<button type="button" class="dash-btn dash-btn--ghost" id="partnerPromoGenerate">Новый код</button>' +
            '<button type="button" class="dash-btn dash-btn--ghost" id="partnerPromoCopy">Копировать</button>' +
          '</div>' +
          '<div class="partner-promo-video">' +
            '<video id="partnerPromoVideo" controls hidden></video>' +
            '<button type="button" class="auth-btn auth-btn--primary" id="partnerPromoVideoGenerate">Сгенерировать промо-видео</button>' +
            '<a class="dash-btn dash-btn--ghost" id="partnerPromoVideoDownload" hidden>Скачать .webm</a>' +
          '</div>' +
          '<p class="partner-modal-hint">Видео рисуется с твоим промокодом. Референс можно прислать команде — подгрузим в рендер.</p>' +
        '</div>' +

        '<p id="partnerModalMsg" class="partner-modal-msg" role="status" hidden></p>' +
      '</section>';

    document.body.appendChild(wrap);

    overlay = wrap;
    statusNode = document.getElementById('partnerModalStatus');
    applyBlock = document.getElementById('partnerApplyBlock');
    promoBlock = document.getElementById('partnerPromoBlock');
    applyForm = document.getElementById('partnerApplyForm');
    codeNode = document.getElementById('partnerPromoCode');
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
    if (genCodeBtn) genCodeBtn.addEventListener('click', function () {
      var code = generateCode();
      setMsg('Промокод сгенерирован: ' + code, false);
    });
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var code = String(codeNode ? codeNode.textContent : '').trim();
      if (!code) return;
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
        ownerId = (data && data.account && (data.account.id || data.account.accountId)) || 'local';
      })
      .catch(function () { ownerId = 'local'; });
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
      if (codeNode) codeNode.textContent = code;
    }
    setMsg('', false);
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

  function generateCode() {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = 'PART-';
    for (var i = 0; i < 6; i++) out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));

    var list = read(STORE, []);
    if (!Array.isArray(list)) list = [];
    for (var j = 0; j < list.length; j++) {
      if (list[j] === current || (current && list[j].id === current.id)) {
        list[j].promoCode = out;
        current = list[j];
        break;
      }
    }
    save(list);
    if (codeNode) codeNode.textContent = out;
    return out;
  }

  function drawFrame(ctx, w, h, code, progress) {
    var bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0c0a16');
    bg.addColorStop(1, '#171226');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    var glow = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, 420);
    glow.addColorStop(0, 'rgba(177,140,255,0.35)');
    glow.addColorStop(1, 'rgba(177,140,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '500 60px Inter, system-ui, sans-serif';
    ctx.fillText('AnkaVisual', w / 2, h / 2 - 190);

    ctx.fillStyle = '#b18cff';
    ctx.font = '700 130px Inter, system-ui, sans-serif';
    ctx.fillText(code, w / 2, h / 2 + 30);

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '400 44px Inter, system-ui, sans-serif';
    ctx.fillText('скидка для аудитории партнёра', w / 2, h / 2 + 150);

    var barW = Math.round(w * (0.25 + 0.75 * Math.min(1, progress)));
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(w / 2 - barW / 2, h / 2 + 220, barW, 6);
  }

  function makeVideo(code) {
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
        drawFrame(ctx, canvas.width, canvas.height, code, 0);
        var drawTimer = window.setInterval(function () {
          drawFrame(ctx, canvas.width, canvas.height, code, Math.min(1, (Date.now() - startedAt) / durationMs));
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
    var code = String(codeNode ? codeNode.textContent : '').trim() || 'PART-XXXXXX';
    genVideoBtn.disabled = true;
    setMsg('Генерирую промо-видео…', false);
    makeVideo(code).then(function (result) {
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
