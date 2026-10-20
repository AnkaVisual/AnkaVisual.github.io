/* AnkaVisual — вход, регистрация и профиль. */
(function () {
  'use strict';

  var API = String(window.ANKA_API_BASE || '').replace(/\/+$/, '');
  var TOKEN_KEY = 'ankavisual.account.token';
  var token = '';

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
  var mode = 'login';

  function $(id) {
    return document.getElementById(id);
  }

  function setMessage(node, text, bad) {
    if (!node) return;
    node.textContent = text || '';
    node.hidden = !text;
    node.className = 'auth-msg' + (bad ? ' is-bad' : ' is-ok');
  }

  function showGuest() {
    guest.hidden = false;
    profile.hidden = true;
    setup.hidden = true;
  }

  function showProfile(account) {
    guest.hidden = true;
    setup.hidden = true;
    profile.hidden = false;

    var name = account.username || '—';
    $('profileName').textContent = name;
    $('profileEmail').textContent = account.email || 'почта не указана';
    $('profileId').textContent = account.id || '—';
    $('profileCreated').textContent = date(account.created);
    $('profileLastLogin').textContent = account.lastLogin ? date(account.lastLogin) : 'только что';
    $('avatar').textContent = name.charAt(0).toUpperCase();
    var status = $('profileStatus');
    if (status) status.textContent = 'аккаунт';
  }

  function date(unix) {
    if (!unix) return '—';
    var d = new Date(unix * 1000);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }) + ' · ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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
    localStorage.removeItem(TOKEN_KEY);
  }

  function switchMode(nextMode) {
    mode = nextMode === 'register' ? 'register' : 'login';
    var isLogin = mode === 'login';
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;

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
    }).catch(function (error) {
      if (error.status === 401) setMessage(authMsg, 'Неверный логин или пароль', true);
      else setMessage(authMsg, error.message, true);
    }).finally(function () {
      submit.disabled = false;
    });
  });

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
    }).catch(function (error) {
      setMessage(authMsg, error.message, true);
    }).finally(function () {
      submit.disabled = false;
    });
  });

  $('logout').addEventListener('click', function () {
    api('/api/auth/logout', { method: 'POST', body: {} }).catch(function () {}).finally(function () {
      clearSession();
      setMessage(authMsg, 'Вы вышли из аккаунта');
      switchMode('login');
      showGuest();
    });
  });

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
      setMessage(authMsg, 'Пароль изменён. Войди заново.', false);
      switchMode('login');
      showGuest();
    }).catch(function (error) {
      setMessage(profileMsg, error.message, true);
    }).finally(function () {
      submit.disabled = false;
    });
  });

  if (switchModeButton) {
    switchModeButton.addEventListener('click', function () {
      switchMode(mode === 'login' ? 'register' : 'login');
    });
  }

  if (!API) {
    guest.hidden = true;
    profile.hidden = true;
    setup.hidden = false;
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
    if (data.account) showProfile(data.account);
    else throw new Error('Сервер не вернул профиль');
  }).catch(function (error) {
    if (token !== savedToken) return;
    clearSession();
    showGuest();
    if (error.status && error.status !== 401) {
      setMessage(authMsg, error.message, true);
    }
  });
})();
