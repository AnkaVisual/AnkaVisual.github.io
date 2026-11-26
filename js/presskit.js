/* AnkaVisual — партнёрский центр: заявка, редактор логотипа и промо-видео. */
(function () {
  'use strict';

  var API = String(window.ANKA_API_BASE || 'https://ankaguard.ankavisual.workers.dev').replace(/\/+$/, '');
  var STORE = 'ankavisual.partners.applications';
  var TOKEN_KEY = 'ankavisual.account.token';

  var PALETTE = [
    { name: 'Аметист', color: '#b18cff' },
    { name: 'Золото', color: '#ffd166' },
    { name: 'Роза', color: '#ff7eb6' },
    { name: 'Изумруд', color: '#7ef0a4' },
    { name: 'Сапфир', color: '#5aa9ff' },
    { name: 'Рубин', color: '#ff6b6b' }
  ];

  var MARK_PATH = 'M50 22 L25 74 H35 L40 62 H60 L65 74 H75 Z M43.5 54 L50 38 L56.5 54 Z';

  function $(id) { return document.getElementById(id); }

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

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (ignored) { return ''; }
  }

  function setMsg(node, text, bad) {
    if (!node) return;
    node.textContent = text || '';
    node.hidden = !text;
    node.className = 'pk-msg' + (text ? (bad ? ' is-bad' : '') : '');
  }

  function downloadUrl(url, name) {
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ── заявка ─────────────────────────────────────────────────── */

  function submitApplication(event) {
    event.preventDefault();
    var form = $('partnerApplyPageForm');
    var msg = $('pkApplyMsg');
    if (!form) return;

    var data = new FormData(form);
    var link = String(data.get('link') || '').trim();
    var promo = String(data.get('promo') || '').trim().toUpperCase();
    var contact = String(data.get('contact') || '').trim();
    var about = String(data.get('about') || '').trim();

    if (!link || link.indexOf('http') !== 0) { setMsg(msg, 'Укажи ссылку на канал или проект', true); return; }
    if (promo.length < 3) { setMsg(msg, 'Промокод должен быть не короче 3 символов', true); return; }
    if (contact.length < 3) { setMsg(msg, 'Укажи Telegram для связи', true); return; }
    if (about.length < 10) { setMsg(msg, 'Расскажи о себе чуть подробнее', true); return; }
    if (!data.get('program') || !data.get('terms')) { setMsg(msg, 'Подтверди программу и условия выплат', true); return; }

    var ownerId = 'local';
    function save() {
      var list = read(STORE, []);
      if (!Array.isArray(list)) list = [];
      list = list.filter(function (item) { return String((item && (item.authorId || item.owner)) || '') !== ownerId; });
      list.push({
        id: 'partner-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
        authorId: ownerId, name: promo, contact: contact, link: link, about: about,
        desiredPromo: promo, status: 'pending', created: Math.floor(Date.now() / 1000)
      });
      write(STORE, list);
      form.reset();
      setMsg(msg, 'Заявка отправлена. Ответ в течение 48 часов — в личном кабинете.', false);
    }

    if (token()) {
      fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + token() }, cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (data) { ownerId = (data.account && (data.account.id || data.account.accountId)) || 'local'; save(); })
        .catch(save);
    } else {
      save();
    }
  }

  /* ── редактор логотипа ──────────────────────────────────────── */

  var logoState = {
    mode: 'static', composition: 'mark', color: PALETTE[0].color,
    style: 'fill', format: 'png', size: 512
  };

  function logoMarkup(color, style) {
    var accent = style === 'stroke'
      ? 'fill="none" stroke="' + color + '" stroke-width="4"'
      : 'fill="' + color + '" fill-rule="evenodd"';
    var pulse = logoState.mode === 'animation'
      ? '<animate attributeName="opacity" values="1;0.6;1" dur="1.8s" repeatCount="indefinite"/>'
      : '';
    return '<path d="' + MARK_PATH + '" ' + accent + '>' + pulse + '</path>';
  }

  function buildLogoSvg() {
    var color = logoState.color;
    if (logoState.composition === 'mark') {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' + logoState.size + '" height="' + logoState.size + '">'
        + logoMarkup(color, logoState.style) + '</svg>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 100" width="' + (logoState.size * 4.4) + '" height="' + logoState.size + '">'
      + '<g transform="translate(0 0)">' + logoMarkup(color, logoState.style) + '</g>'
      + '<text x="116" y="69" font-family="Inter,Arial,sans-serif" font-size="42" font-weight="600" letter-spacing="-2" fill="' + color + '">AnkaVisual</text>'
      + '</svg>';
  }

  function renderLogo() {
    var node = $('pkLogoPreview');
    if (!node) return;
    node.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(buildLogoSvg());
  }

  function downloadLogo() {
    var svg = buildLogoSvg();
    var name = 'ankavisual-logo' + (logoState.composition === 'mark' ? '' : '-full');
    if (logoState.format === 'svg') {
      downloadUrl(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), name + '.svg');
      return;
    }
    var image = new Image();
    image.onload = function () {
      var ratio = logoState.composition === 'mark' ? 1 : 4.4;
      var canvas = document.createElement('canvas');
      canvas.width = logoState.size * ratio;
      canvas.height = logoState.size;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) {
        if (!blob) return;
        downloadUrl(URL.createObjectURL(blob), name + '.' + logoState.format);
      }, logoState.format === 'jpg' ? 'image/jpeg' : 'image/png');
    };
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ── редактор промо-видео ───────────────────────────────────── */

  var videoState = {
    template: 'payment', promo: 'PART-ABC123', discount: '−9%',
    color: PALETTE[0].color, speed: 1, bg: 'dark', time: 0, playing: false, endPause: 3.5,
    qrLink: window.location.origin + '/partnership/'
  };
  var BLOCK_DURATION = 4.7;
  var TEMPLATE_DESC = {
    payment: 'Карточка цены и поле промокода, курсор · 60 кадров/с',
    plate: 'Скидка, ввод кода, «Применён» · 60 кадров/с',
    strip: 'Полоса внизу кадра, середина свободна · 60 кадров/с',
    coupon: 'Стеклянный купон: код, штамп скидки, корешок отрывается · 60 кадров/с',
    big: 'Код во весь кадр, буквы выезжают одна за другой · 60 кадров/с',
    qr: 'QR-код на партнёрский центр с логотипом AnkaVisual · 30 кадров/с'
  };
  function videoTotal() { return BLOCK_DURATION + videoState.endPause; }
  function videoFrames() { return Math.round(videoTotal() * 60); }
  var playbackTimer = null;
  var lastFrameAt = 0;

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function fitText(ctx, text, size, weight, maxWidth) {
    var s = size;
    ctx.font = (weight || 700) + ' ' + s + 'px Inter, system-ui, sans-serif';
    while (ctx.measureText(text).width > maxWidth && s > 18) {
      s -= 4;
      ctx.font = (weight || 700) + ' ' + s + 'px Inter, system-ui, sans-serif';
    }
    return s;
  }

  function drawBackground(ctx, w, h, p) {
    if (videoState.bg === 'none') { ctx.clearRect(0, 0, w, h); return; }
    if (videoState.bg === 'green') { ctx.fillStyle = '#00b140'; ctx.fillRect(0, 0, w, h); return; }
    var base = ctx.createLinearGradient(0, 0, w, h);
    if (videoState.bg === 'site') {
      base.addColorStop(0, '#050505');
      base.addColorStop(1, '#121014');
    } else {
      base.addColorStop(0, '#0c0a16');
      base.addColorStop(1, '#171226');
    }
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    var glow = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 480);
    glow.addColorStop(0, hexAlpha(videoState.color, 0.18 + 0.08 * Math.sin(p * 6.28)));
    glow.addColorStop(1, hexAlpha(videoState.color, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  function hexAlpha(hex, alpha) {
    var h = String(hex || '#b18cff').replace('#', '');
    var r = parseInt(h.slice(0, 2), 16) || 177;
    var g = parseInt(h.slice(2, 4), 16) || 140;
    var b = parseInt(h.slice(4, 6), 16) || 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + Math.max(0, Math.min(1, alpha)) + ')';
  }

  function typedText(ctx, code, p) {
    var count = Math.max(1, Math.ceil(code.length * Math.min(1, p * 1.4)));
    return code.slice(0, count);
  }

  function drawTemplate(ctx, w, h, p) {
    var c = videoState.color;
    var code = String(videoState.promo || 'PART-ABC123').trim();
    var discount = String(videoState.discount || '−9%').trim();
    var shown = typedText(ctx, code, p);
    var t = videoState.template;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (t === 'payment') {
      rr(ctx, 330, 110, 620, 500, 28);
      ctx.fillStyle = 'rgba(10,10,14,.92)'; ctx.fill();
      ctx.strokeStyle = hexAlpha(c, 0.5); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '600 34px Inter, sans-serif';
      ctx.fillText('AnkaVisual · оплата', 640, 175);
      ctx.fillStyle = '#fff'; fitText(ctx, '600 ₽', 92, 700, 520); ctx.fillText('600 ₽', 640, 275);
      rr(ctx, 400, 350, 480, 110, 18);
      ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill();
      ctx.strokeStyle = hexAlpha(c, 0.7); ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = c; fitText(ctx, shown, 60, 700, 420); ctx.fillText(shown, 640, 405);
      if (Math.sin(p * 12) > 0) { ctx.fillRect(640 + ctx.measureText(shown).width / 2 + 6, 385, 4, 40); }
      ctx.fillStyle = hexAlpha(c, 0.9); ctx.font = '600 30px Inter, sans-serif';
      ctx.fillText(discount + ' по промокоду', 640, 530);
    } else if (t === 'plate') {
      rr(ctx, 170, 255, 940, 210, 26);
      ctx.fillStyle = hexAlpha(c, 0.14); ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '600 30px Inter, sans-serif';
      ctx.fillText('ПРОМОКОД ANKAVISUAL', 640, 310);
      ctx.fillStyle = '#fff'; fitText(ctx, shown, 96, 700, 820); ctx.fillText(shown, 640, 385);
      rr(ctx, 980, 190, 150, 70, 35); ctx.fillStyle = c; ctx.fill();
      ctx.fillStyle = '#0a0a0a'; ctx.font = '700 32px Inter, sans-serif'; ctx.fillText(discount, 1055, 225);
    } else if (t === 'strip') {
      var shift = Math.round((1 - p) * 200);
      ctx.fillStyle = c; ctx.fillRect(-200 + shift, 280, 1680, 160);
      ctx.fillStyle = '#0a0a0a'; fitText(ctx, shown, 84, 800, 1100);
      ctx.fillText(shown + '  ·  ' + discount + '  ·  AnkaVisual', 640, 360);
    } else if (t === 'coupon') {
      rr(ctx, 200, 190, 880, 340, 24); ctx.fillStyle = '#f6f2ff'; ctx.fill();
      ctx.save(); ctx.setLineDash([12, 12]); ctx.strokeStyle = c; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(760, 215); ctx.lineTo(760, 505); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#1b1230'; ctx.font = '700 28px Inter, sans-serif';
      ctx.fillText('ПРОМОКОД', 480, 260);
      fitText(ctx, shown, 78, 800, 500); ctx.fillText(shown, 480, 360);
      ctx.fillStyle = c; ctx.font = '800 96px Inter, sans-serif'; ctx.fillText(discount, 990, 360);
      ctx.fillStyle = '#6a5d86'; ctx.font = '500 20px Inter, sans-serif';
      ctx.fillText('ankavisual.github.io', 640, 550);
    } else if (t === 'terminal') {
      rr(ctx, 170, 130, 940, 460, 18); ctx.fillStyle = '#08090b'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(170, 130, 940, 46);
      ['#ff6b6b', '#ffd166', '#7ef0a4'].forEach(function (col, i) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(196 + i * 24, 153, 6, 0, 6.28); ctx.fill();
      });
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '400 26px monospace';
      ctx.fillText('$ ankavisual --promo', 210, 235);
      ctx.fillStyle = c; ctx.font = '500 30px monospace';
      ctx.fillText('> applying code...', 210, 295);
      ctx.fillStyle = '#fff'; fitText(ctx, shown, 54, 700, 820); ctx.fillText('> ' + shown, 210, 375);
      ctx.fillStyle = c; ctx.font = '400 26px monospace';
      ctx.fillText('> activation OK  (' + discount + ')', 210, 450);
      if (Math.sin(p * 10) > 0) ctx.fillRect(210 + ctx.measureText('> activation OK  (' + discount + ')').width + 6, 432, 12, 30);
      ctx.textAlign = 'center';
    } else if (t === 'big') {
      ctx.fillStyle = c;
      var size = fitText(ctx, shown, 170, 800, 1100);
      ctx.shadowColor = hexAlpha(c, 0.7); ctx.shadowBlur = 40 + 30 * Math.sin(p * 6.28);
      ctx.fillText(shown, 640, 330);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '600 38px Inter, sans-serif';
      ctx.fillText('промокод AnkaVisual · ' + discount, 640, 480);
    } else if (t === 'qr') {
      var cell = 18, n = 17, x0 = 640 - (n * cell) / 2, y0 = 165;
      ctx.fillStyle = '#fff'; ctx.fillRect(x0 - 14, y0 - 14, n * cell + 28, n * cell + 28);
      var seed = 0;
      for (var i = 0; i < code.length; i++) seed = (seed * 31 + code.charCodeAt(i)) >>> 0;
      function finder(ox, oy) {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(x0 + ox * cell, y0 + oy * cell, 7 * cell, 7 * cell);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x0 + (ox + 1) * cell, y0 + (oy + 1) * cell, 5 * cell, 5 * cell);
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(x0 + (ox + 2) * cell, y0 + (oy + 2) * cell, 3 * cell, 3 * cell);
      }
      for (var y = 0; y < n; y++) {
        for (var x = 0; x < n; x++) {
          if ((x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9)) continue;
          var bit = ((seed >>> ((x * 7 + y * 3) % 24)) + x * y) % 3;
          if (bit === 0) {
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(x0 + x * cell, y0 + y * cell, cell - 2, cell - 2);
          }
        }
      }
      finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
      ctx.fillStyle = '#fff'; ctx.font = '700 42px Inter, sans-serif';
      ctx.fillText(shown, 640, 600);
    }
  }

  function drawVideo(time, canvasOverride) {
    var canvas = canvasOverride || $('pkVideoPreview');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var blockProgress = Math.min(1, (time * videoState.speed) / BLOCK_DURATION);
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    drawBackground(ctx, w, h, blockProgress);
    ctx.save();
    ctx.scale(w / 1280, h / 720);
    drawTemplate(ctx, 1280, 720, blockProgress);
    ctx.restore();
    ctx.restore();

    if (canvasOverride) return;
    var label = $('pkTime');
    var total = videoTotal();
    if (label) {
      var secs = Math.floor(time);
      var cs = Math.floor((time - secs) * 100);
      label.textContent = '0:' + String(secs).padStart(2, '0') + '.' + String(cs).padStart(2, '0')
        + ' / 0:' + String(Math.floor(total)).padStart(2, '0') + '.' + String(Math.round((total % 1) * 100)).padStart(2, '0')
        + ' · кадр ' + Math.round((time / total) * videoFrames()) + '/' + videoFrames();
    }
    var scrub = $('pkScrub');
    if (scrub) {
      var max = Math.round(total * 100);
      if (Number(scrub.max) !== max) scrub.max = String(max);
      scrub.value = String(Math.round(time * 100));
    }
  }

  function renderPoster() {
    var poster = $('pkVideoPoster');
    if (poster) drawVideo(BLOCK_DURATION * 0.72, poster);
  }

  function setPlaying(on) {
    videoState.playing = on;
    var btn = $('pkPlay');
    if (btn) btn.textContent = on ? '❚❚' : '▶';
    if (playbackTimer) { clearInterval(playbackTimer); playbackTimer = null; }
    if (!on) return;
    lastFrameAt = Date.now();
    playbackTimer = setInterval(function () {
      var now = Date.now();
      var dt = (now - lastFrameAt) / 1000;
      lastFrameAt = now;
      videoState.time += dt * videoState.speed;
      if (videoState.time >= videoTotal()) videoState.time = 0;
      drawVideo(videoState.time);
    }, 1000 / 30);
  }

  function exportVideo() {
    var canvas = $('pkVideoPreview');
    if (!canvas || typeof MediaRecorder === 'undefined') return;
    var stream = canvas.captureStream(30);
    var mime = 'video/webm';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) mime = 'video/webm;codecs=vp9';
    else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) mime = 'video/webm;codecs=vp8';
    var recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 });
    var chunks = [];
    recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = function () {
      downloadUrl(URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })),
        'ankavisual-promo-' + String(videoState.promo || 'code').replace(/[^a-z0-9_-]/gi, '') + '.webm');
    };
    var totalMs = videoTotal() * 1000;
    var started = Date.now();
    setPlaying(false);
    videoState.time = 0;
    drawVideo(0);
    recorder.start(250);
    var timer = setInterval(function () {
      videoState.time = Math.min(videoTotal(), (Date.now() - started) / 1000);
      drawVideo(videoState.time);
    }, 1000 / 60);
    setTimeout(function () {
      clearInterval(timer);
      if (recorder.state !== 'inactive') recorder.stop();
    }, totalMs);
  }

  function saveFrame() {
    var canvas = $('pkVideoPreview');
    if (!canvas) return;
    downloadUrl(canvas.toDataURL('image/png'), 'ankavisual-promo-frame.png');
  }

  /* ── привязка интерфейса ────────────────────────────────────── */

  function bindLogo() {
    function seg(rootId, attr, key, after) {
      var root = $(rootId);
      if (!root) return;
      root.addEventListener('click', function (event) {
        var button = event.target.closest('[data-' + attr + ']');
        if (!button) return;
        Array.prototype.forEach.call(root.querySelectorAll('.pk-seg'), function (node) { node.classList.toggle('is-active', node === button); });
        logoState[key] = button.getAttribute('data-' + attr);
        if (after) after();
        renderLogo();
      });
    }
    seg('pkLogoMode', 'mode', 'mode');
    seg('pkLogoComposition', 'composition', 'composition');
    seg('pkLogoStyle', 'style', 'style');
    seg('pkLogoFormat', 'format', 'format');
    seg('pkLogoSize', 'size', 'size');

    var colors = $('pkLogoColors');
    if (colors) {
      PALETTE.forEach(function (item) {
        var swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'pk-swatch' + (item.color === logoState.color ? ' is-active' : '');
        swatch.style.background = item.color;
        swatch.title = item.name;
        swatch.setAttribute('aria-label', item.name);
        swatch.addEventListener('click', function () {
          logoState.color = item.color;
          Array.prototype.forEach.call(colors.querySelectorAll('.pk-swatch'), function (node) { node.classList.toggle('is-active', node === swatch); });
          renderLogo();
        });
        colors.appendChild(swatch);
      });
    }
    var download = $('pkLogoDownload');
    if (download) download.addEventListener('click', downloadLogo);
    renderLogo();
  }

  function bindVideo() {
    var colors = $('pkVideoColors');
    if (colors) {
      PALETTE.forEach(function (item) {
        var swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'pk-swatch' + (item.color === videoState.color ? ' is-active' : '');
        swatch.style.background = item.color;
        swatch.title = item.name;
        swatch.setAttribute('aria-label', item.name);
        swatch.addEventListener('click', function () {
          videoState.color = item.color;
          Array.prototype.forEach.call(colors.querySelectorAll('.pk-swatch'), function (node) { node.classList.toggle('is-active', node === swatch); });
          drawVideo(videoState.time);
        });
        colors.appendChild(swatch);
      });
    }

    function seg(rootId, attr, key) {
      var root = $(rootId);
      if (!root) return;
      root.addEventListener('click', function (event) {
        var button = event.target.closest('[data-' + attr + ']');
        if (!button) return;
        Array.prototype.forEach.call(root.querySelectorAll('button'), function (node) { node.classList.toggle('is-active', node === button); });
        videoState[key] = button.getAttribute('data-' + attr);
        if (key === 'template') {
          var desc = $('pkTemplateDesc');
          if (desc) desc.textContent = TEMPLATE_DESC[videoState.template] || '';
          renderPoster();
        }
        drawVideo(videoState.time);
      });
    }
    seg('pkTemplates', 'template', 'template');
    seg('pkSpeed', 'speed', 'speed');
    seg('pkBackground', 'bg', 'bg');

    var promoConfig = $('pkPromoConfig');
    if (promoConfig) promoConfig.addEventListener('click', function (event) {
      var button = event.target.closest('button');
      if (!button) return;
      Array.prototype.forEach.call(promoConfig.querySelectorAll('button'), function (node) { node.classList.toggle('is-active', node === button); });
    });

    var pauseInput = $('pkEndPause');
    function updatePause() {
      if (pauseInput) pauseInput.value = videoState.endPause + ' c';
      var total = videoTotal();
      var scrub = $('pkScrub');
      if (scrub) scrub.max = String(Math.round(total * 100));
      drawVideo(videoState.time);
    }
    var minus = $('pkPauseMinus');
    if (minus) minus.addEventListener('click', function () {
      videoState.endPause = Math.max(0, Math.round((videoState.endPause - 0.5) * 10) / 10);
      updatePause();
    });
    var plus = $('pkPausePlus');
    if (plus) plus.addEventListener('click', function () {
      videoState.endPause = Math.min(8, Math.round((videoState.endPause + 0.5) * 10) / 10);
      updatePause();
    });

    var promo = $('pkPromoInput');
    if (promo) promo.addEventListener('input', function () {
      videoState.promo = promo.value.trim().slice(0, 14);
      renderPoster();
      drawVideo(videoState.time);
    });
    var discount = $('pkDiscountInput');
    if (discount) discount.addEventListener('input', function () {
      videoState.discount = discount.value.trim().slice(0, 8);
      drawVideo(videoState.time);
    });

    var scrub = $('pkScrub');
    if (scrub) scrub.addEventListener('input', function () {
      videoState.time = Number(scrub.value) / 100;
      drawVideo(videoState.time);
    });

    var play = $('pkPlay');
    if (play) play.addEventListener('click', function () { setPlaying(!videoState.playing); });
    var prev = $('pkPrev');
    if (prev) prev.addEventListener('click', function () {
      setPlaying(false);
      videoState.time = Math.max(0, videoState.time - 1 / 60);
      drawVideo(videoState.time);
    });
    var next = $('pkNext');
    if (next) next.addEventListener('click', function () {
      setPlaying(false);
      videoState.time = Math.min(videoTotal(), videoState.time + 1 / 60);
      drawVideo(videoState.time);
    });
    var exportBtn = $('pkExportVideo');
    if (exportBtn) exportBtn.addEventListener('click', exportVideo);
    var frameBtn = $('pkSaveFrame');
    if (frameBtn) frameBtn.addEventListener('click', saveFrame);

    var modal = $('pkVideoModal');
    var openEditor = $('pkOpenVideoEditor');
    if (openEditor && modal) openEditor.addEventListener('click', function () {
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      drawVideo(videoState.time);
    });
    var closeEditor = $('pkvClose');
    if (closeEditor && modal) closeEditor.addEventListener('click', function () {
      modal.hidden = true;
      document.body.style.overflow = '';
      setPlaying(false);
    });

    document.addEventListener('keydown', function (event) {
      if (!modal || modal.hidden) return;
      if (event.target && /INPUT|TEXTAREA/.test(event.target.tagName)) return;
      if (event.key === ' ') { event.preventDefault(); setPlaying(!videoState.playing); }
      else if (event.key === 'Escape') {
        modal.hidden = true;
        document.body.style.overflow = '';
        setPlaying(false);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        var step = event.shiftKey ? 1 : 1 / 60;
        videoState.time = Math.max(0, Math.min(videoTotal(), videoState.time + (event.key === 'ArrowRight' ? step : -step)));
        drawVideo(videoState.time);
      }
    });

    drawVideo(0);
    renderPoster();
    updatePause();
  }

  /* Точная раскладка шаблонов System (легаси-рендер). */
  function drawTemplateLegacy(ctx, w, h, p) {
    var c = videoState.color;
    var code = String(videoState.promo || 'PART-ABC123').trim().slice(0, 14);
    var discount = String(videoState.discount || '−9%').trim();
    var shown = typedText(ctx, code, Math.min(1, p * 1.25));
    var applied = p > 0.58;
    var t = videoState.template;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (t === 'payment') {
      rr(ctx, 320, 96, 640, 528, 30);
      ctx.fillStyle = 'rgba(8,8,12,.94)'; ctx.fill();
      ctx.strokeStyle = hexAlpha(c, 0.45); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '600 30px Inter, system-ui, sans-serif';
      ctx.fillText('AnkaVisual · оплата', 640, 158);
      ctx.fillStyle = '#fff'; ctx.font = '700 96px Inter, system-ui, sans-serif';
      ctx.fillText('600 ₽', 640, 262);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = '500 26px Inter, system-ui, sans-serif';
      ctx.fillText('/ мес · полный доступ', 640, 320);
      rr(ctx, 400, 370, 480, 100, 16);
      ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill();
      ctx.strokeStyle = hexAlpha(c, 0.75); ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = c; fitText(ctx, shown, 56, 700, 420); ctx.fillText(shown, 640, 420);
      if (Math.sin(p * 14) > 0) {
        var tw = ctx.measureText(shown).width;
        ctx.fillRect(640 + tw / 2 + 6, 398, 3, 44);
      }
      ctx.fillStyle = hexAlpha(c, 0.9); ctx.font = '600 26px Inter, system-ui, sans-serif';
      ctx.fillText(discount + ' по промокоду', 640, 525);
      ctx.save(); ctx.translate(770, 520); ctx.rotate(-0.18);
      ctx.fillStyle = '#fff'; ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, 42); ctx.lineTo(10, 32); ctx.lineTo(17, 47);
      ctx.lineTo(24, 43); ctx.lineTo(17, 29); ctx.lineTo(31, 26); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (t === 'plate') {
      rr(ctx, 150, 250, 980, 220, 26);
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill();
      ctx.strokeStyle = hexAlpha(c, 0.7); ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = c; ctx.font = '800 68px Inter, system-ui, sans-serif';
      ctx.fillText(discount, 290, 345);
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '600 24px Inter, system-ui, sans-serif';
      ctx.fillText('скидка по коду', 290, 405);
      rr(ctx, 470, 310, 520, 100, 16);
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
      ctx.strokeStyle = hexAlpha(c, 0.8); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; fitText(ctx, shown, 54, 700, 470); ctx.fillText(shown, 730, 360);
      if (applied) {
        rr(ctx, 760, 195, 220, 66, 33); ctx.fillStyle = c; ctx.fill();
        ctx.fillStyle = '#0a0a0a'; ctx.font = '700 27px Inter, system-ui, sans-serif';
        ctx.fillText('Применён', 870, 228);
      }
    } else if (t === 'strip') {
      ctx.fillStyle = 'rgba(8,8,12,.9)'; ctx.fillRect(0, 540, 1280, 180);
      ctx.fillStyle = c; ctx.fillRect(0, 540, 1280, 6);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '600 24px Inter, system-ui, sans-serif';
      ctx.fillText('AnkaVisual', 60, 630);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff'; fitText(ctx, shown, 66, 700, 700); ctx.fillText(shown, 650, 615);
      ctx.fillStyle = hexAlpha(c, 0.95); ctx.font = '700 32px Inter, system-ui, sans-serif';
      ctx.fillText(discount, 1130, 615);
    } else if (t === 'coupon') {
      var tear = Math.min(1, p * 1.3);
      rr(ctx, 170, 190, 940, 340, 28);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
      ctx.strokeStyle = hexAlpha(c, 0.6); ctx.lineWidth = 2; ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '600 26px Inter, system-ui, sans-serif';
      ctx.fillText('ПРОМОКОД ANKAVISUAL', 220, 250);
      ctx.fillStyle = '#fff'; fitText(ctx, shown, 72, 700, 560); ctx.fillText(shown, 220, 340);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = '500 22px Inter, system-ui, sans-serif';
      ctx.fillText('ankavisual.github.io', 220, 455);
      ctx.save(); ctx.setLineDash([10, 12]); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(880, 205); ctx.lineTo(880, 515); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.translate(tear * 42, 0);
      ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(885, 195, 225, 330);
      ctx.strokeStyle = hexAlpha(c, 0.8); ctx.lineWidth = 4;
      ctx.save(); ctx.translate(998, 360); ctx.rotate(-0.25);
      ctx.strokeRect(-85, -45, 170, 90);
      ctx.fillStyle = c; ctx.font = '800 52px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText(discount, 0, 6);
      ctx.restore(); ctx.restore();
      ctx.textAlign = 'center';
    } else if (t === 'terminal') {
      rr(ctx, 170, 120, 940, 480, 16);
      ctx.fillStyle = '#08090b'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(170, 120, 940, 46);
      ['#ff6b6b', '#ffd166', '#7ef0a4'].forEach(function (col, i) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(198 + i * 24, 143, 6, 0, 6.28); ctx.fill();
      });
      ctx.textAlign = 'left';
      ctx.font = '400 25px monospace';
      ctx.fillStyle = c; ctx.fillText('$ ankavisual promo --apply', 210, 230);
      ctx.fillStyle = '#fff'; ctx.fillText('> код: ' + shown, 210, 300);
      if (applied) {
        ctx.fillStyle = c; ctx.fillText('> скидка ' + discount + ' активирована', 210, 380);
        ctx.fillStyle = '#fff'; ctx.fillText('> доступ открыт', 210, 440);
      }
      if (Math.sin(p * 10) > 0) ctx.fillRect(210 + ctx.measureText('> код: ' + shown).width + 8, 280, 12, 28);
      ctx.textAlign = 'center';
    } else if (t === 'big') {
      var chars = code.split('');
      var size = Math.max(44, Math.min(160, Math.floor(1000 / chars.length * 1.6)));
      ctx.font = '700 ' + size + 'px Inter, system-ui, sans-serif';
      var widths = chars.map(function (ch) { return ctx.measureText(ch).width; });
      var total = widths.reduce(function (a, b) { return a + b; }, 0);
      var x = 640 - total / 2;
      ctx.textAlign = 'left';
      for (var i = 0; i < chars.length; i++) {
        var local = Math.max(0, Math.min(1, (p * chars.length - i) / 0.7));
        ctx.globalAlpha = local;
        ctx.fillStyle = c;
        ctx.shadowColor = hexAlpha(c, 0.7); ctx.shadowBlur = 30;
        ctx.fillText(chars[i], x, 370 + (1 - local) * 140);
        x += widths[i];
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '600 38px Inter, system-ui, sans-serif';
      ctx.fillText('AnkaVisual · ' + discount, 640, 520);
    } else if (t === 'qr') {
      var cell = 17, n = 17, x0 = 640 - (n * cell) / 2, y0 = 150;
      rr(ctx, x0 - 16, y0 - 16, n * cell + 32, n * cell + 32, 18);
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
      var seed = 0;
      for (var s = 0; s < code.length; s++) seed = (seed * 31 + code.charCodeAt(s)) >>> 0;
      function finder(ox, oy) {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(x0 + ox * cell, y0 + oy * cell, 7 * cell, 7 * cell);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x0 + (ox + 1) * cell, y0 + (oy + 1) * cell, 5 * cell, 5 * cell);
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(x0 + (ox + 2) * cell, y0 + (oy + 2) * cell, 3 * cell, 3 * cell);
      }
      for (var yy = 0; yy < n; yy++) {
        for (var xx = 0; xx < n; xx++) {
          if ((xx < 8 && yy < 8) || (xx > n - 9 && yy < 8) || (xx < 8 && yy > n - 9)) continue;
          var bit = ((seed >>> ((xx * 7 + yy * 3) % 24)) + xx * yy) % 3;
          if (bit === 0) {
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(x0 + xx * cell, y0 + yy * cell, cell - 2, cell - 2);
          }
        }
      }
      finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
      var cx = 640, cy = y0 + (n * cell) / 2;
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath(); ctx.arc(cx, cy, 62, 0, 6.28); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath();
      for (var k = 0; k < 10; k++) {
        var ang = -Math.PI / 2 + k * Math.PI / 5;
        var rad = k % 2 ? 20 : 46;
        var px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '700 40px Inter, system-ui, sans-serif';
      ctx.fillText(shown, 640, 500);
      ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '500 22px Inter, system-ui, sans-serif';
      ctx.fillText('ankavisual.github.io', 640, 555);
    }
    ctx.textAlign = 'center';
  }

  /* Финальный рендер: кинематографичные шаблоны с ровной скоростью набора. */
  function drawTemplate(ctx, w, h, p) {
    var c = videoState.color;
    var code = String(videoState.promo || 'PART-ABC123').trim().slice(0, 14) || 'PART-ABC123';
    var discount = String(videoState.discount || '−9%').trim();
    var t = videoState.template;
    var secs = p * BLOCK_DURATION;

    function clamp(v) { return Math.max(0, Math.min(1, v)); }
    function ease(v) { return 1 - Math.pow(1 - clamp(v), 3); }
    function back(v) {
      v = clamp(v);
      return 1 + 2.2 * Math.pow(v - 1, 3) + 1.2 * Math.pow(v - 1, 2);
    }
    function font(size, weight, mono) {
      ctx.font = (weight || 600) + ' ' + size + 'px ' + (mono ? "'JetBrains Mono',ui-monospace,monospace" : 'Inter, system-ui, sans-serif');
    }
    function fit(text, size, weight, maxWidth, mono) {
      var s = size;
      do { font(s, weight, mono); } while (ctx.measureText(text).width > maxWidth && --s > 16);
      return s;
    }
    function glass(x, y, ww, hh, r, alpha) {
      ctx.save();
      rr(ctx, x, y, ww, hh, r);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.035 + (alpha || 0)) + ')';
      ctx.fill();
      ctx.clip();
      var sheen = ctx.createLinearGradient(x, y, x + ww * 0.75, y + hh);
      sheen.addColorStop(0, 'rgba(255,255,255,.13)');
      sheen.addColorStop(0.45, 'rgba(255,255,255,.03)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(x, y, ww, hh);
      ctx.restore();
      var edge = ctx.createLinearGradient(x, y, x + ww, y + hh);
      edge.addColorStop(0, hexAlpha(c, 0.85));
      edge.addColorStop(0.5, hexAlpha(c, 0.25));
      edge.addColorStop(1, 'rgba(255,255,255,.16)');
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      rr(ctx, x, y, ww, hh, r);
      ctx.stroke();
    }
    function mark(x, y, size, color) {
      ctx.save();
      ctx.translate(x - size / 2, y - size / 2);
      ctx.scale(size / 100, size / 100);
      ctx.fillStyle = color;
      ctx.fill(new Path2D(MARK_PATH));
      ctx.restore();
    }
    function caret(x, y, height) {
      if (Math.sin(p * 22) > -0.1) {
        ctx.fillStyle = c;
        ctx.fillRect(x, y - height / 2, 3, height);
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (videoState.bg !== 'green' && videoState.bg !== 'none') {
      var orb = ctx.createRadialGradient(220, 140, 0, 220, 140, 460);
      orb.addColorStop(0, hexAlpha(c, 0.1));
      orb.addColorStop(1, hexAlpha(c, 0));
      ctx.fillStyle = orb; ctx.fillRect(0, 0, 1280, 720);
      var orb2 = ctx.createRadialGradient(1100, 640, 0, 1100, 640, 420);
      orb2.addColorStop(0, hexAlpha(c, 0.07));
      orb2.addColorStop(1, hexAlpha(c, 0));
      ctx.fillStyle = orb2; ctx.fillRect(0, 0, 1280, 720);
      ctx.strokeStyle = 'rgba(255,255,255,.028)';
      ctx.lineWidth = 1;
      for (var gx = 0; gx < 1280; gx += 56) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, 720); ctx.stroke();
      }
      for (var gy = 0; gy < 720; gy += 56) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(1280, gy); ctx.stroke();
      }
      var vignette = ctx.createRadialGradient(640, 360, 220, 640, 360, 780);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,.5)');
      ctx.fillStyle = vignette; ctx.fillRect(0, 0, 1280, 720);
    }

    /* Ровный набор: ~1.6 с на весь код, затем активация. */
    var typeRatio = clamp((secs - 0.18) / 1.6);
    var typeCount = Math.max(1, Math.ceil(code.length * ease(typeRatio)));
    var typed = code.slice(0, typeCount);
    var applied = clamp((secs - 2.05) / 0.5);
    var pop = back(applied);

    if (t === 'payment') {
      var slide = ease(secs / 0.55);
      ctx.save();
      ctx.translate(0, (1 - slide) * 38);
      glass(316, 92, 648, 536, 30, 0.02);
      mark(365, 140, 40, c);
      ctx.textAlign = 'left';
      font(30, 700); ctx.fillStyle = '#fff'; ctx.fillText('AnkaVisual', 410, 141);
      ctx.textAlign = 'center';
      font(19, 700); ctx.fillStyle = hexAlpha(c, 0.95);
      ctx.fillText('ОПЛАТА', 858, 141);
      font(96, 750); ctx.fillStyle = '#fff'; ctx.fillText('600 ₽', 640, 262);
      font(25, 500); ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.fillText('в месяц · все возможности', 640, 320);
      glass(392, 366, 496, 102, 16, 0.01);
      ctx.fillStyle = '#fff'; fit(typed, 56, 700, 440); ctx.fillText(typed, 640, 417);
      caret(640 + ctx.measureText(typed).width / 2 + 9, 417, 46);
      if (applied > 0) {
        ctx.save(); ctx.globalAlpha = applied;
        var pillW = 250 * pop;
        rr(ctx, 640 - pillW / 2, 500, pillW, 58, 29);
        ctx.fillStyle = hexAlpha(c, 0.92); ctx.fill();
        font(26, 700); ctx.fillStyle = '#0a0a0a';
        ctx.fillText('Применён · ' + discount, 640, 529);
        ctx.restore();
      }
      ctx.restore();
      ctx.save(); ctx.translate(770 - (1 - slide) * 20, 495); ctx.rotate(-0.16);
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, 44); ctx.lineTo(11, 33); ctx.lineTo(18, 49);
      ctx.lineTo(25, 45); ctx.lineTo(18, 29); ctx.lineTo(32, 27); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (t === 'plate') {
      var slide2 = ease(secs / 0.5);
      ctx.save(); ctx.translate((1 - slide2) * -50, 0);
      glass(138, 266, 1004, 208, 26, 0.03);
      ctx.fillStyle = c; font(76, 800); ctx.fillText(discount, 300, 352);
      font(23, 600); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillText('скидка по коду', 300, 410);
      glass(470, 310, 530, 104, 16, 0.01);
      ctx.fillStyle = '#fff'; fit(typed, 54, 700, 470); ctx.fillText(typed, 735, 362);
      caret(735 + ctx.measureText(typed).width / 2 + 8, 362, 44);
      if (applied > 0) {
        ctx.save(); ctx.globalAlpha = applied; ctx.translate(870, 215);
        ctx.scale(pop, pop);
        rr(ctx, -112, -32, 224, 64, 32);
        ctx.fillStyle = c; ctx.fill();
        font(27, 700); ctx.fillStyle = '#0a0a0a'; ctx.fillText('Применён', 0, 2);
        ctx.restore();
      }
      ctx.restore();
    } else if (t === 'strip') {
      var rise = ease(secs / 0.6);
      ctx.save(); ctx.translate(0, (1 - rise) * 70);
      var barGrad = ctx.createLinearGradient(0, 540, 1280, 720);
      barGrad.addColorStop(0, 'rgba(10,9,16,.96)');
      barGrad.addColorStop(0.5, 'rgba(20,16,34,.94)');
      barGrad.addColorStop(1, 'rgba(10,9,16,.96)');
      ctx.fillStyle = barGrad; ctx.fillRect(0, 540, 1280, 180);
      ctx.fillStyle = c; ctx.fillRect(0, 540, 1280, 5);
      mark(78, 625, 30, c);
      ctx.textAlign = 'left'; font(24, 650); ctx.fillStyle = 'rgba(255,255,255,.62)';
      ctx.fillText('AnkaVisual', 108, 627);
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
      fit(typed, 66, 700, 690); ctx.fillText(typed, 650, 618);
      caret(650 + ctx.measureText(typed).width / 2 + 8, 618, 52);
      rr(ctx, 1030, 586, 180, 62, 31);
      ctx.fillStyle = hexAlpha(c, 0.18); ctx.fill();
      ctx.strokeStyle = hexAlpha(c, 0.6); ctx.lineWidth = 1.5; ctx.stroke();
      font(30, 700); ctx.fillStyle = c; ctx.fillText(discount, 1120, 617);
      ctx.restore();
    } else if (t === 'coupon') {
      var tear = ease(secs / 1.9);
      ctx.save(); ctx.translate(0, (1 - ease(secs / 0.6)) * 26);
      glass(164, 186, 952, 348, 28, 0.02);
      ctx.save();
      rr(ctx, 164, 186, 952, 348, 28); ctx.clip();
      var glowLine = ctx.createLinearGradient(164, 186, 1116, 534);
      glowLine.addColorStop(0, hexAlpha(c, 0.14));
      glowLine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glowLine; ctx.fillRect(164, 186, 952, 348);
      ctx.restore();
      mark(242, 250, 30, c);
      ctx.textAlign = 'left';
      font(25, 700); ctx.fillStyle = '#fff'; ctx.fillText('AnkaVisual', 268, 250);
      font(20, 600); ctx.fillStyle = hexAlpha(c, 0.9); ctx.fillText('· промокод', 412, 250);
      fit(typed, 76, 750, 560); ctx.fillStyle = '#fff'; ctx.fillText(typed, 216, 342);
      caret(216 + ctx.measureText(typed).width + 8, 342, 60);
      font(22, 500); ctx.fillStyle = 'rgba(255,255,255,.42)';
      ctx.fillText('ankavisual.github.io', 216, 462);
      ctx.save(); ctx.setLineDash([9, 12]);
      ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(890, 205); ctx.lineTo(890, 515); ctx.stroke(); ctx.restore();
      ctx.fillStyle = 'rgba(8,8,12,.9)';
      ctx.beginPath(); ctx.arc(890, 186, 13, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(890, 534, 13, 0, 6.28); ctx.fill();
      ctx.save(); ctx.translate(tear * 46, 0);
      ctx.fillStyle = 'rgba(255,255,255,.055)'; ctx.fillRect(895, 191, 221, 338);
      ctx.save(); ctx.translate(1006, 360); ctx.rotate(-0.26);
      ctx.strokeStyle = hexAlpha(c, 0.95); ctx.lineWidth = 4;
      ctx.strokeRect(-88, -46, 176, 92);
      font(54, 800); ctx.fillStyle = c; ctx.fillText(discount, 0, 4);
      ctx.restore(); ctx.restore();
      ctx.textAlign = 'center';
      ctx.restore();
    } else if (t === 'big') {
      var chars = code.split('');
      var size = Math.max(42, Math.min(148, Math.floor(1020 / chars.length * 1.6)));
      font(size, 780);
      var widths = chars.map(function (ch) { return ctx.measureText(ch).width; });
      var totalW = widths.reduce(function (a, b) { return a + b; }, 0);
      var x = 640 - totalW / 2;
      ctx.textAlign = 'left';
      for (var i = 0; i < chars.length; i++) {
        var local = back((typeRatio * chars.length - i) / 1.1);
        ctx.globalAlpha = clamp(local * 1.4);
        var grad = ctx.createLinearGradient(x, 280, x + widths[i], 450);
        grad.addColorStop(0, c);
        grad.addColorStop(1, '#f2eaff');
        ctx.fillStyle = grad;
        ctx.shadowColor = hexAlpha(c, 0.75); ctx.shadowBlur = 34;
        ctx.fillText(chars[i], x, 360 + (1 - clamp(local)) * 130);
        x += widths[i];
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.textAlign = 'center';
      font(30, 600); ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.fillText('AnkaVisual · ' + discount, 640, 520);
      mark(640, 580, 36, hexAlpha(c, 0.8));
    } else if (t === 'qr') {
      var link = String(videoState.qrLink || '').trim() || (window.location.origin + '/partnership/');
      var qr = null;
      try {
        if (typeof window.qrcode === 'function') {
          qr = window.qrcode(0, 'H');
          qr.addData(link);
          qr.make();
        }
      } catch (err) { qr = null; }

      var n = qr ? qr.getModuleCount() : 21;
      var cell = Math.max(4, Math.floor(300 / n));
      var size = cell * n;
      var x0 = 640 - size / 2, y0 = 140;
      var quiet = Math.ceil(cell * 2);
      rr(ctx, x0 - quiet, y0 - quiet, size + quiet * 2, size + quiet * 2, 18);
      ctx.fillStyle = 'rgba(255,255,255,.97)'; ctx.fill();
      ctx.strokeStyle = hexAlpha(c, 0.45); ctx.lineWidth = 2; ctx.stroke();

      if (qr) {
        ctx.fillStyle = '#0c0a14';
        for (var row = 0; row < n; row++) {
          for (var col = 0; col < n; col++) {
            if (qr.isDark(row, col)) ctx.fillRect(x0 + col * cell, y0 + row * cell, cell, cell);
          }
        }
      }

      var cx = 640, cy = y0 + size / 2;
      var logoSize = Math.min(56, Math.round(size * 0.18));
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 22;
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      ctx.beginPath(); ctx.arc(cx, cy, logoSize * 0.72, 0, 6.28); ctx.fill();
      ctx.restore();
      mark(cx, cy, logoSize, c);
      font(40, 700); ctx.fillStyle = '#fff'; ctx.fillText(typed, 640, 500);
      font(22, 500); ctx.fillStyle = hexAlpha(c, 0.9);
      ctx.fillText(link.replace(/^https?:\/\//, '').slice(0, 48), 640, 552);
    }
    ctx.textAlign = 'center';
  }

  function init() {
    var form = $('partnerApplyPageForm');
    if (form) form.addEventListener('submit', submitApplication);
    bindLogo();
    bindVideo();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
