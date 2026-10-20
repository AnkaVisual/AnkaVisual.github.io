/* AnkaVisual — вход, регистрация и личный кабинет. */
(function () {
  'use strict';

  var API = String(window.ANKA_API_BASE || '').replace(/\/+$/, '');
  var TOKEN_KEY = 'ankavisual.account.token';
  var token = '';
  var accountId = '';
  var mode = 'login';

  var PANELS = {
    overview: ['Обзор', 'Твой профиль AnkaVisual.'],
    profile: ['Профиль', 'Данные аккаунта AnkaVisual.'],
    security: ['Безопасность', 'Пароль и активная сессия.'],
    launcher: ['Лаунчер', 'Скачай клиент и войди в игру.']
  };

  var guest = document.getElementById('guest');
  var profile = document.getElementById('profile');
  var setup = document.getElementById('setup');
  var authMsg = document.getElementById('authMsg');
  var profileMsg = document.getElementById('profileMsg');
  var loginForm = document.getElementById('loginForm');
  var registerForm = document.getElementById('registerForm');
  var passwordForm = document.getElementById('passwordForm');
  var authTitle = document.getElementById('authTitle');
  var authSubtitle = document.getElementById('authSubtitle');
  var switchHint = document.getElementById('switchHint');
  var switchModeButton = document.getElementById('switchMode');
  var dashTitle = document.getElementById('dashTitle');
  var dashSubtitle = document.getElementById('dashSubtitle');
  var panels = profile ? Array.prototype.slice.call(profile.querySelectorAll('[data-panel]')) : [];
  var navButtons = profile ? Array.prototype.slice.call(profile.querySelectorAll('.dash-nav [data-panel-nav]')) : [];
  var panelTriggers = profile ? Array.prototype.slice.call(profile.querySelectorAll('[data-panel-nav]')) : [];

  function setMessage(node, text, bad) {
    if (!node) return;
    node.textContent = text || '';
    node.hidden = !text;
    node.className = 'auth-msg' + (text ? (bad ? ' is-bad' : ' is-ok') : '');
  }

  function showGuest() {
    if (guest) guest.hidden = false;
    if (profile) profile.hidden = true;
    if (setup) setup.hidden = true;
  }

  function showProfile(account) {
    if (guest) guest.hidden = true;
    if (setup) setup.hidden = true;
    if (profile) profile.hidden = false;
    fillAccount(account || {});
    setPanel(currentHashPanel(), false);
  }

  function showSetup() {
    if (guest) guest.hidden = true;
    if (profile) profile.hidden = true;
    if (setup) setup.hidden = false;
  }

  function fillAccount(account) {
    var name = account.username || '—';
    var email = account.email || 'почта не указана';
    var id = account.id || '—';
    var created = date(account.created);
    var lastLogin = account.lastLogin ? date(account.lastLogin) : 'только что';

    accountId = account.id || '';

    if (!profile) return;
    Array.prototype.forEach.call(profile.querySelectorAll('[data-account]'), function (node) {
      var field = node.getAttribute('data-account');
      if (field === 'avatar') node.textContent = name.charAt(0).toUpperCase() || 'A';
      else if (field === 'username') node.textContent = name;
      else if (field === 'email') node.textContent = email;
      else if (field === 'id') node.textContent = id;
      else if (field === 'created') node.textContent = created;
      else if (field === 'lastLogin') node.textContent = lastLogin;
    });
  }

  function date(unix) {
    if (!unix) return '—';
    var d = new Date(unix * 1000);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }) + ' · ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function currentHashPanel() {
    var name = String(location.hash || '').replace(/^#/, '');
    return PANELS[name] ? name : 'overview';
  }

  function setPanel(name, updateHash) {
    if (!PANELS[name]) name = 'overview';

    panels.forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-panel') !== name;
    });
    navButtons.forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-panel-nav') === name);
    });

    if (dashTitle) dashTitle.textContent = PANELS[name][0];
    if (dashSubtitle) dashSubtitle.textContent = PANELS[name][1];

    if (updateHash && history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search + '#' + name);
    }
  }

  function api(path, options) {
    var opts = options || {};
    var url = API + path;
    if (token) {
      url += (url.indexOf('?') >= 0 ? '&' : '?') + 'token=' + encodeURIComponent(token);
    }

    return fetch(url, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store'
    }).then(function (response) {
      return response.text().then(function (text) {
        var data = {};
        if (text) {
          try { data = JSON.parse(text); } catch (ignored) { data = {}; }
        }
        if (!response.ok) {
          var error = new Error(data.message || 'Сервер не принял запрос');
          error.status = response.status;
          error.code = data.error || '';
          throw error;
        }
        return data;
      });
    }, function () {
      var error = new Error('Нет связи с сервером аккаунтов');
      error.status = 0;
      throw error;
    });
  }

  function saveSession(data) {
    token = data.token || '';
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (data.account) showProfile(data.account);
  }

  function clearSession() {
    token = '';
    accountId = '';
    localStorage.removeItem(TOKEN_KEY);
  }

  function switchMode(nextMode) {
    mode = nextMode === 'register' ? 'register' : 'login';
    var isLogin = mode === 'login';
    if (loginForm) loginForm.hidden = !isLogin;
    if (registerForm) registerForm.hidden = isLogin;

    if (authTitle) authTitle.textContent = isLogin ? 'Войти в AnkaVisual' : 'Создать аккаунт';
    if (authSubtitle) authSubtitle.textContent = isLogin
      ? 'Рады снова видеть тебя.'
      : 'Пара полей — и профиль готов.';
    if (switchHint) switchHint.textContent = isLogin ? 'Нет аккаунта?' : 'Уже есть аккаунт?';
    if (switchModeButton) {
      switchModeButton.textContent = isLogin ? 'Регистрация' : 'Войти';
      switchModeButton.setAttribute('data-mode', isLogin ? 'register' : 'login');
    }
    setMessage(authMsg, '');
  }

  function resetHash() {
    if (history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var form = new FormData(loginForm);
      var login = String(form.get('login') || '').trim();
      var password = String(form.get('password') || '');
      if (!login || !password) return;

      var submit = loginForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      setMessage(authMsg, 'Проверяю…');

      api('/api/auth/login', {
        method: 'POST',
        body: { login: login, password: password }
      }).then(function (data) {
        saveSession(data);
        setMessage(authMsg, '');
        loginForm.reset();
        setPanel('overview', true);
      }).catch(function (error) {
        if (error.status === 401) setMessage(authMsg, 'Неверный логин или пароль', true);
        else setMessage(authMsg, error.message, true);
      }).finally(function () {
        submit.disabled = false;
      });
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var form = new FormData(registerForm);
      var username = String(form.get('username') || '').trim();
      var email = String(form.get('email') || '').trim();
      var password = String(form.get('password') || '');
      var password2 = String(form.get('password2') || '');

      if (password !== password2) {
        setMessage(authMsg, 'Пароли не совпадают', true);
        return;
      }

      var submit = registerForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      setMessage(authMsg, 'Создаю аккаунт…');

      api('/api/auth/register', {
        method: 'POST',
        body: { username: username, email: email, password: password }
      }).then(function (data) {
        saveSession(data);
        setMessage(authMsg, '');
        registerForm.reset();
        setPanel('overview', true);
      }).catch(function (error) {
        setMessage(authMsg, error.message, true);
      }).finally(function () {
        submit.disabled = false;
      });
    });
  }

  function logout() {
    api('/api/auth/logout', { method: 'POST', body: {} }).catch(function () {}).finally(function () {
      clearSession();
      setMessage(profileMsg, '');
      switchMode('login');
      setMessage(authMsg, 'Вы вышли из аккаунта');
      resetHash();
      showGuest();
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-logout]'), function (button) {
    button.addEventListener('click', logout);
  });

  if (passwordForm) {
    passwordForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var form = new FormData(passwordForm);
      var currentPassword = String(form.get('currentPassword') || '');
      var newPassword = String(form.get('newPassword') || '');

      var submit = passwordForm.querySelector('button[type="submit"]');
      submit.disabled = true;
      setMessage(profileMsg, 'Меняю пароль…');

      api('/api/auth/password', {
        method: 'POST',
        body: { currentPassword: currentPassword, newPassword: newPassword }
      }).then(function () {
        clearSession();
        passwordForm.reset();
        setMessage(profileMsg, '');
        switchMode('login');
        setMessage(authMsg, 'Пароль изменён. Войди заново.', false);
        resetHash();
        showGuest();
      }).catch(function (error) {
        setMessage(profileMsg, error.message, true);
      }).finally(function () {
        submit.disabled = false;
      });
    });
  }

  if (switchModeButton) {
    switchModeButton.addEventListener('click', function () {
      switchMode(mode === 'login' ? 'register' : 'login');
    });
  }

  panelTriggers.forEach(function (button) {
    button.addEventListener('click', function () {
      var name = button.getAttribute('data-panel-nav');
      setPanel(name, true);
      if (name === 'security') setMessage(profileMsg, '');
    });
  });

  var copyButton = document.querySelector('[data-copy-id]');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      if (!accountId) return;
      var done = function () {
        copyButton.textContent = 'Скопировано';
        setTimeout(function () { copyButton.textContent = 'Копировать'; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(accountId).then(done).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }

      function fallbackCopy() {
        var area = document.createElement('textarea');
        area.value = accountId;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try { document.execCommand('copy'); done(); } catch (ignored) {}
        document.body.removeChild(area);
      }
    });
  }

  window.addEventListener('hashchange', function () {
    if (profile && !profile.hidden) setPanel(currentHashPanel(), false);
  });

  if (!API) {
    showSetup();
    return;
  }

  token = localStorage.getItem(TOKEN_KEY) || '';
  if (!token) {
    switchMode('login');
    showGuest();
    return;
  }

  var savedToken = token;
  api('/api/auth/me').then(function (data) {
    if (token !== savedToken) return;
    if (data.account) {
      showProfile(data.account);
    } else {
      throw new Error('Сервер не вернул профиль');
    }
  }).catch(function (error) {
    if (token !== savedToken) return;
    clearSession();
    switchMode('login');
    showGuest();
    if (error.status && error.status !== 401) {
      setMessage(authMsg, error.message, true);
    }
  });
})();
