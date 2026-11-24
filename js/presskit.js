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
    template: 'payment', promo: 'PART-ABC123', discount: '−8%',
    color: PALETTE[0].color, speed: 1, bg: 'dark', time: 0, playing: false
  };
  var DURATION = 6;
  var FRAMES = 180;
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
    var discount = String(videoState.discount || '−8%').trim();
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

  function drawVideo(time) {
    var canvas = $('pkVideoPreview');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    drawBackground(ctx, w, h, Math.min(1, time / DURATION));
    ctx.save();
    ctx.scale(w / 1280, h / 720);
    drawTemplate(ctx, 1280, 720, Math.min(1, (time * videoState.speed) / DURATION));
    ctx.restore();
    ctx.restore();
    var label = $('pkTime');
    if (label) {
      var secs = Math.floor(time);
      var cs = Math.floor((time - secs) * 100);
      label.textContent = '0:' + String(secs).padStart(2, '0') + '.' + String(cs).padStart(2, '0')
        + ' / 0:06.00 · кадр ' + Math.round((time / DURATION) * FRAMES) + '/' + FRAMES;
    }
  }

  function setPlaying(on) {
    videoState.playing = on;
    var btn = $('pkPlay');
    if (btn) btn.textContent = on ? '❚❚ Пауза' : '▶ Воспроизвести';
    if (playbackTimer) { clearInterval(playbackTimer); playbackTimer = null; }
    if (!on) return;
    lastFrameAt = Date.now();
    playbackTimer = setInterval(function () {
      var now = Date.now();
      var dt = (now - lastFrameAt) / 1000;
      lastFrameAt = now;
      videoState.time += dt * videoState.speed;
      if (videoState.time >= DURATION) videoState.time = 0;
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
    var totalMs = (DURATION / videoState.speed) * 1000;
    var started = Date.now();
    setPlaying(false);
    videoState.time = 0;
    drawVideo(0);
    recorder.start(250);
    var timer = setInterval(function () {
      videoState.time = Math.min(DURATION, ((Date.now() - started) / 1000) * videoState.speed);
      drawVideo(videoState.time);
    }, 1000 / 30);
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
        Array.prototype.forEach.call(root.querySelectorAll('.pk-seg'), function (node) { node.classList.toggle('is-active', node === button); });
        videoState[key] = button.getAttribute('data-' + attr);
        drawVideo(videoState.time);
      });
    }
    seg('pkTemplates', 'template', 'template');
    seg('pkSpeed', 'speed', 'speed');
    seg('pkBackground', 'bg', 'bg');

    var promo = $('pkPromoInput');
    if (promo) promo.addEventListener('input', function () {
      videoState.promo = promo.value.trim().slice(0, 14);
      drawVideo(videoState.time);
    });
    var discount = $('pkDiscountInput');
    if (discount) discount.addEventListener('input', function () {
      videoState.discount = discount.value.trim().slice(0, 8);
      drawVideo(videoState.time);
    });

    var play = $('pkPlay');
    if (play) play.addEventListener('click', function () { setPlaying(!videoState.playing); });
    var prev = $('pkPrev');
    if (prev) prev.addEventListener('click', function () {
      setPlaying(false);
      videoState.time = Math.max(0, videoState.time - 1 / 30);
      drawVideo(videoState.time);
    });
    var next = $('pkNext');
    if (next) next.addEventListener('click', function () {
      setPlaying(false);
      videoState.time = Math.min(DURATION, videoState.time + 1 / 30);
      drawVideo(videoState.time);
    });
    var exportBtn = $('pkExportVideo');
    if (exportBtn) exportBtn.addEventListener('click', exportVideo);
    var frameBtn = $('pkSaveFrame');
    if (frameBtn) frameBtn.addEventListener('click', saveFrame);

    document.addEventListener('keydown', function (event) {
      if (event.target && /INPUT|TEXTAREA/.test(event.target.tagName)) return;
      if (event.key === ' ') { event.preventDefault(); setPlaying(!videoState.playing); }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        var step = event.shiftKey ? 1 : 1 / 30;
        videoState.time = Math.max(0, Math.min(DURATION, videoState.time + (event.key === 'ArrowRight' ? step : -step)));
        drawVideo(videoState.time);
      }
    });

    drawVideo(0);
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
