/* AnkaVisual — вход, регистрация и личный кабинет. */
(function () {
  'use strict';

  var API = String(window.ANKA_API_BASE || 'https://ankaguard.ankavisual.workers.dev').replace(/\/+$/, '');
  var API_JSON = 'https://ankavisual.github.io/api.json';
  var apiRefreshPromise = null;
  var TOKEN_KEY = 'ankavisual.account.token';
  var BROWSER_KEY = 'ankavisual.browser.code';
  var token = '';
  var accountId = '';
  var mode = 'login';
  var browserCode = '';

  var PANELS = {
    overview: ['Обзор', 'Твой профиль AnkaVisual.'],
    friends: ['Друзья', 'Твой список друзей и заявки.'],
    profile: ['Профиль', 'Данные аккаунта AnkaVisual.'],
    security: ['Безопасность', 'Пароль и активная сессия.'],
    launcher: ['Лаунчер', 'Скачай клиент и войди в игру.']
  };

  var PREFIXES = {
    owner: 'Владелец',
    coowner: 'Со-владелец',
    support: 'Поддержка',
    admin: 'Админ',
    beta: 'Бета-тестер'
  };

  var guest = document.getElementById('guest');
  var profile = document.getElementById('profile');
  var setup = document.getElementById('setup');
  var authMsg = document.getElementById('authMsg');
  var profileMsg = document.getElementById('profileMsg');
  var loginForm = document.getElementById('loginForm');
  var registerForm = document.getElementById('registerForm');
  var passwordForm = document.getElementById('passwordForm');
  var friendForm = document.getElementById('friendForm');
  var friendMsg = document.getElementById('friendMsg');
  var friendList = document.getElementById('friendList');
  var friendRequests = document.getElementById('friendRequests');
  var friendOutgoing = document.getElementById('friendOutgoing');
  var chatOverlay = document.getElementById('friendChat');
  var chatTitle = document.getElementById('friendChatTitle');
  var chatAvatar = document.querySelector('[data-chat-avatar]');
  var chatId = document.querySelector('[data-chat-id]');
  var chatMessages = document.getElementById('friendChatMessages');
  var chatMsg = document.getElementById('friendChatMsg');
  var chatForm = document.getElementById('friendChatForm');
  var authTitle = document.getElementById('authTitle');
  var authSubtitle = document.getElementById('authSubtitle');
  var switchHint = document.getElementById('switchHint');
  var switchModeButton = document.getElementById('switchMode');
  var dashTitle = document.getElementById('dashTitle');
  var dashSubtitle = document.getElementById('dashSubtitle');
  var browserLogin = document.getElementById('browserLogin');
  var browserLoginName = document.getElementById('browserLoginName');
  var browserLoginMsg = document.getElementById('browserLoginMsg');
  var browserApproveButton = document.getElementById('browserLoginApprove');
  var browserCancelButton = document.getElementById('browserLoginCancel');
  var avatarInput = document.getElementById('avatarInput');
  var avatarPick = document.getElementById('avatarPick');
  var avatarRemove = document.getElementById('avatarRemove');
  var avatarMsg = document.getElementById('avatarMsg');
  var avatarPreview = document.getElementById('avatarPreview');
  var accountData = {};
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
    closeFriendChat();
    if (guest) guest.hidden = false;
    if (profile) profile.hidden = true;
    if (setup) setup.hidden = true;
  }

  function showProfile(account) {
    if (guest) guest.hidden = true;
    if (setup) setup.hidden = true;
    if (profile) profile.hidden = false;
    fillAccount(account || {});
    loadFriends();
    setPanel(currentHashPanel(), false);
    if (browserCode) showBrowserLogin(account || {});
  }

  function showSetup() {
    if (guest) guest.hidden = true;
    if (profile) profile.hidden = true;
    if (setup) setup.hidden = false;
  }

  function fillAccount(account) {
    accountData = account || {};
    var name = account.username || '—';
    var email = account.email || 'почта не указана';
    var id = account.id || '—';
    var created = date(account.created);
    var lastLogin = account.lastLogin ? date(account.lastLogin) : 'только что';

    accountId = account.id || '';

    if (!profile) return;
    Array.prototype.forEach.call(profile.querySelectorAll('[data-account]'), function (node) {
      var field = node.getAttribute('data-account');
      if (field === 'avatar') applyAvatar(node, account);
      else if (field === 'username') node.textContent = name;
      else if (field === 'email') node.textContent = email;
      else if (field === 'id') node.textContent = id;
      else if (field === 'created') node.textContent = created;
      else if (field === 'lastLogin') node.textContent = lastLogin;
    });

    var prefix = String(account.prefix || '').toLowerCase();
    var prefixLabel = PREFIXES[prefix] || 'Аккаунт';
    Array.prototype.forEach.call(profile.querySelectorAll('[data-account-prefix]'), function (node) {
      node.textContent = prefixLabel;
      node.classList.remove('is-admin', 'is-beta', 'is-owner', 'is-coowner', 'is-support');
      if (PREFIXES[prefix]) node.classList.add('is-' + prefix);
    });

    renderAvatars();
  }

  function applyAvatar(node, account) {
    if (!node) return;
    var src = account && account.avatar ? String(account.avatar) : '';
    if (src) {
      node.style.backgroundImage = 'url(' + src + ')';
      node.classList.add('has-avatar');
      node.textContent = '';
      return;
    }
    node.style.backgroundImage = '';
    node.classList.remove('has-avatar');
    var name = String((account && account.username) || 'A');
    node.textContent = name.charAt(0).toUpperCase() || 'A';
  }

  function renderAvatars() {
    if (profile) {
      Array.prototype.forEach.call(profile.querySelectorAll('[data-account="avatar"]'), function (node) {
        applyAvatar(node, accountData);
      });
    }
    if (avatarPreview) applyAvatar(avatarPreview, accountData);
    if (avatarRemove) avatarRemove.hidden = !accountData.avatar;
  }

  function setAvatarMessage(text, bad) {
    setMessage(avatarMsg, text, bad);
  }

  function avatarFromFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('не удалось прочитать файл')); };
      reader.onload = function () {
        var image = new Image();
        image.onerror = function () { reject(new Error('не удалось открыть картинку')); };
        image.onload = function () {
          var size = 256;
          var canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('браузер не поддерживает обработку картинок')); return; }

          var side = Math.min(image.width, image.height);
          ctx.drawImage(
            image,
            (image.width - side) / 2, (image.height - side) / 2, side, side,
            0, 0, size, size
          );

          // PNG читается Java ImageIO (мод), поэтому сначала пробуем его.
          // Если файл слишком тяжёлый — сжимаем в JPEG.
          var png = canvas.toDataURL('image/png');
          if (Math.floor(png.length * 3 / 4) <= 90 * 1024) {
            resolve(png);
            return;
          }

          var qualities = [0.9, 0.8, 0.7, 0.6, 0.5];
          var best = '';
          for (var i = 0; i < qualities.length; i++) {
            var candidate = canvas.toDataURL('image/jpeg', qualities[i]);
            best = candidate;
            if (Math.floor(candidate.length * 3 / 4) <= 90 * 1024) break;
          }
          resolve(best);
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function saveAvatar(dataUrl) {
    return api('/api/auth/avatar', {
      method: 'POST',
      body: { avatar: dataUrl }
    }).then(function (data) {
      accountData = data.account || accountData;
      renderAvatars();
      setAvatarMessage(data.message || 'аватар обновлён', false);
      return data;
    });
  }

  if (avatarPick && avatarInput) {
    avatarPick.addEventListener('click', function () { avatarInput.click(); });

    avatarInput.addEventListener('change', function () {
      var file = avatarInput.files && avatarInput.files[0];
      avatarInput.value = '';
      if (!file) return;

      if (!/^image\//.test(file.type)) {
        setAvatarMessage('выбери картинку PNG, JPEG или WebP', true);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setAvatarMessage('файл больше 5 МБ', true);
        return;
      }

      avatarPick.disabled = true;
      setAvatarMessage('Готовлю фото…');
      avatarFromFile(file).then(function (dataUrl) {
        if (Math.floor(dataUrl.length * 3 / 4) > 96 * 1024) {
          throw new Error('фото слишком большое даже после сжатия');
        }
        setAvatarMessage('Сохраняю…');
        return saveAvatar(dataUrl);
      }).catch(function (error) {
        setAvatarMessage(error.message || 'не удалось сохранить аватар', true);
      }).then(function () {
        avatarPick.disabled = false;
      });
    });
  }

  if (avatarRemove) {
    avatarRemove.addEventListener('click', function () {
      avatarRemove.disabled = true;
      setAvatarMessage('Удаляю…');
      saveAvatar('').catch(function (error) {
        setAvatarMessage(error.message || 'не удалось удалить аватар', true);
      }).then(function () {
        avatarRemove.disabled = false;
      });
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

  function adminLoginCode() {
    var hash = String(location.hash || '').replace(/^#/, '');
    var prefix = 'admin-login=';
    return hash.indexOf(prefix) === 0 ? hash.slice(prefix.length) : '';
  }

  /* ── Вход в лаунчер через браузер ─────────────────────────────── */

  function browserLoginCode() {
    var hash = String(location.hash || '').replace(/^#/, '');
    var prefix = 'browser-login=';
    if (hash.indexOf(prefix) === 0) return hash.slice(prefix.length);
    try {
      return sessionStorage.getItem(BROWSER_KEY) || '';
    } catch (ignored) {
      return '';
    }
  }

  function rememberBrowserCode(code) {
    browserCode = code || '';
    try {
      if (browserCode) sessionStorage.setItem(BROWSER_KEY, browserCode);
      else sessionStorage.removeItem(BROWSER_KEY);
    } catch (ignored) { /* приватный режим */ }
  }

  function pageMessage(text, bad) {
    if (profile && !profile.hidden) setMessage(profileMsg, text, bad);
    else setMessage(authMsg, text, bad);
  }

  function hideBrowserLogin() {
    if (browserLogin) browserLogin.hidden = true;
    setMessage(browserLoginMsg, '');
  }

  function clearBrowserLogin() {
    rememberBrowserCode('');
    hideBrowserLogin();
    var hash = String(location.hash || '').replace(/^#/, '');
    if (hash.indexOf('browser-login=') === 0 && history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function showBrowserLogin(account) {
    if (!browserLogin || !browserCode) return;
    browserLogin.hidden = false;
    if (browserLoginName) {
      browserLoginName.textContent = account && account.username ? account.username : '—';
    }
    if (browserApproveButton) {
      browserApproveButton.hidden = false;
      browserApproveButton.disabled = false;
      browserApproveButton.textContent = 'Подтвердить вход';
    }
    if (browserCancelButton) browserCancelButton.textContent = 'Отмена';
    setMessage(browserLoginMsg, '');
  }

  function approveBrowserLogin() {
    if (!browserCode) return;
    if (browserApproveButton) {
      browserApproveButton.disabled = true;
      browserApproveButton.textContent = 'Подтверждаю…';
    }
    setMessage(browserLoginMsg, '');

    api('/api/auth/browser/approve', {
      method: 'POST',
      body: { code: browserCode }
    }).then(function () {
      rememberBrowserCode('');
      if (browserApproveButton) browserApproveButton.hidden = true;
      if (browserCancelButton) browserCancelButton.textContent = 'Закрыть';
      setMessage(browserLoginMsg, 'Готово. Вернись в лаунчер — вход выполнится автоматически.', false);
      var hash = String(location.hash || '').replace(/^#/, '');
      if (hash.indexOf('browser-login=') === 0 && history.replaceState) {
        history.replaceState(null, '', location.pathname + location.search + '#overview');
      }
    }).catch(function (error) {
      if (error.status === 401) {
        clearBrowserLogin();
        clearSession();
        switchMode('login');
        showGuest();
        setMessage(authMsg, 'Сессия истекла, войди заново', true);
        return;
      }
      if (error.status === 410) {
        clearBrowserLogin();
        pageMessage('Код входа истёк — запусти вход в лаунчере заново', true);
        return;
      }
      setMessage(browserLoginMsg, error.message, true);
      if (browserApproveButton) {
        browserApproveButton.disabled = false;
        browserApproveButton.textContent = 'Подтвердить вход';
      }
    });
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
    if (name === 'friends') loadFriends();
    else closeFriendChat();

    if (updateHash && history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search + '#' + name);
    }
  }

  function refreshApiBase() {
    if (apiRefreshPromise) return apiRefreshPromise;

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 3500) : null;

    apiRefreshPromise = fetch(API_JSON + '?t=' + Date.now(), {
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (!response.ok) throw new Error('api.json ' + response.status);
      return response.json();
    }).then(function (data) {
      var next = data && data.api ? String(data.api).replace(/\/+$/, '') : '';
      if (next) {
        API = next;
        window.ANKA_API_BASE = next;
      }
      return API;
    }).catch(function () {
      return API;
    }).then(function (value) {
      if (timer) clearTimeout(timer);
      apiRefreshPromise = null;
      return value;
    });

    return apiRefreshPromise;
  }

  function apiRequest(base, path, options) {
    var opts = options || {};
    var url = base + path;
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
        var contentType = response.headers.get('content-type') || '';
        if (response.ok && text && contentType.indexOf('json') < 0) {
          var tunnelError = new Error('Нет связи с сервером аккаунтов');
          tunnelError.status = 0;
          throw tunnelError;
        }
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

  function api(path, options) {
    var base = API;
    return apiRequest(base, path, options).catch(function (error) {
      if (error.status !== 0 && error.status !== 502 && error.status !== 503 && error.status !== 504) {
        throw error;
      }
      return refreshApiBase().then(function (next) {
        if (!next || next === base) throw error;
        return apiRequest(next, path, options);
      });
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

  /* ── Друзья ───────────────────────────────────────────────────── */

  var friendsLoading = false;
  var friendData = { friends: [], incoming: [], outgoing: [] };
  var chatFriend = null;
  var chatLastId = 0;
  var chatTimer = null;
  var chatLoading = false;

  function prefixLabel(prefix) {
    return PREFIXES[String(prefix || '').toLowerCase()] || 'Аккаунт';
  }

  function friendMessage(text, bad) {
    setMessage(friendMsg, text, bad);
  }

  function setFriendCount(selector, value, hideZero) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (node) {
      node.textContent = String(value);
      if (hideZero) node.hidden = !value;
    });
  }

  function friendRow(item, actions) {
    var row = document.createElement('div');
    row.className = 'friend-row';

    var avatar = document.createElement('div');
    avatar.className = 'friend-avatar';
    applyAvatar(avatar, item);
    avatar.setAttribute('aria-hidden', 'true');

    var copy = document.createElement('div');
    copy.className = 'friend-copy';

    var nameLine = document.createElement('div');
    nameLine.className = 'friend-name-line';

    var name = document.createElement('strong');
    name.className = 'friend-name';
    name.textContent = item.username || item.id || '—';
    nameLine.append(name);

    var prefix = String(item.prefix || '').toLowerCase();
    var badge = document.createElement('span');
    badge.className = 'dcard-badge' + (PREFIXES[prefix] ? ' is-' + prefix : '');
    badge.textContent = prefixLabel(prefix);
    nameLine.append(badge);

    var id = document.createElement('span');
    id.className = 'friend-id mono';
    id.textContent = item.id || '—';

    copy.append(nameLine, id);

    var actionBar = document.createElement('div');
    actionBar.className = 'friend-actions';
    (actions || []).forEach(function (action) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'friend-btn' + (action.primary ? ' is-primary' : '') + (action.danger ? ' is-danger' : '');
      button.textContent = action.label;
      button.addEventListener('click', function () {
        action.onClick(button);
      });
      actionBar.append(button);
    });

    row.append(avatar, copy, actionBar);
    return row;
  }

  function renderFriends(data) {
    friendData = {
      friends: Array.isArray(data.friends) ? data.friends : [],
      incoming: Array.isArray(data.incoming) ? data.incoming : [],
      outgoing: Array.isArray(data.outgoing) ? data.outgoing : []
    };

    setFriendCount('[data-friends-count]', friendData.friends.length, false);
    setFriendCount('[data-friends-incoming]', friendData.incoming.length, false);
    setFriendCount('[data-friends-outgoing]', friendData.outgoing.length, false);
    setFriendCount('[data-friends-nav-count]', friendData.incoming.length || friendData.friends.length, true);

    var incomingEmpty = document.querySelector('[data-friends-incoming-empty]');
    if (incomingEmpty) incomingEmpty.hidden = friendData.incoming.length > 0;

    var friendsEmpty = document.querySelector('[data-friends-empty]');
    if (friendsEmpty) friendsEmpty.hidden = friendData.friends.length > 0;

    if (friendList) {
      friendList.replaceChildren();
      friendData.friends.forEach(function (friend) {
        friendList.append(friendRow(friend, [
          {
            label: 'Чат',
            primary: true,
            onClick: function () { openFriendChat(friend); }
          },
          {
            label: 'Удалить',
            danger: true,
            onClick: function (button) { friendAction('remove', friend.id, button); }
          }
        ]));
      });
    }

    if (chatFriend) {
      var chatStillFriend = friendData.friends.some(function (friend) {
        return friend.id === chatFriend.id;
      });
      if (!chatStillFriend) closeFriendChat();
    }

    if (friendRequests) {
      friendRequests.replaceChildren();
      friendData.incoming.forEach(function (request) {
        friendRequests.append(friendRow(request, [
          {
            label: 'Принять',
            primary: true,
            onClick: function (button) { friendAction('accept', request.id, button); }
          },
          {
            label: 'Отклонить',
            onClick: function (button) { friendAction('decline', request.id, button); }
          }
        ]));
      });
    }

    if (friendOutgoing) {
      friendOutgoing.replaceChildren();
      friendData.outgoing.forEach(function (request) {
        friendOutgoing.append(friendRow(request, [{
          label: 'Отменить',
          onClick: function (button) { friendAction('cancel', request.id, button); }
        }]));
      });
      var outgoingCard = friendOutgoing.closest('[data-friend-outgoing]');
      if (outgoingCard) outgoingCard.hidden = friendData.outgoing.length === 0;
    }
  }

  function friendAction(action, id, button) {
    if (button) button.disabled = true;
    api('/api/friends', {
      method: 'POST',
      body: { action: action, id: id }
    }).then(function (data) {
      friendMessage(data.message || 'Готово', false);
      renderFriends(data);
    }).catch(function (error) {
      if (error.status === 401) {
        clearSession();
        showGuest();
        setMessage(authMsg, 'Сессия истекла, войди заново', true);
        return;
      }
      friendMessage(error.message, true);
      if (button) button.disabled = false;
      if (error.status === 404) loadFriends();
    });
  }

  function loadFriends() {
    if (!token || !profile || profile.hidden || friendsLoading) return;
    friendsLoading = true;
    api('/api/friends').then(function (data) {
      if (token) renderFriends(data);
    }).catch(function (error) {
      if (error.status === 401) {
        clearSession();
        showGuest();
        setMessage(authMsg, 'Сессия истекла, войди заново', true);
      } else {
        friendMessage(error.message, true);
      }
    }).finally(function () {
      friendsLoading = false;
    });
  }

  function chatTime(unix) {
    if (!unix) return '';
    var d = new Date(unix * 1000);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function chatMessage(text, bad) {
    setMessage(chatMsg, text, bad);
  }

  function chatEmpty() {
    if (!chatMessages) return;
    var empty = document.createElement('p');
    empty.className = 'friend-chat-empty';
    empty.textContent = 'Пока нет сообщений. Напиши первым.';
    empty.setAttribute('data-chat-empty', '');
    chatMessages.append(empty);
  }

  function appendChatMessage(message) {
    if (!chatMessages || !message) return;
    var empty = chatMessages.querySelector('[data-chat-empty]');
    if (empty) empty.remove();

    var row = document.createElement('div');
    row.className = 'friend-chat-row' + (message.from === accountId ? ' is-me' : '');

    var bubble = document.createElement('div');
    bubble.className = 'friend-chat-bubble';

    var text = document.createElement('p');
    text.textContent = message.text || '';
    var time = document.createElement('span');
    time.className = 'friend-chat-time';
    time.textContent = chatTime(message.created);

    bubble.append(text, time);
    row.append(bubble);
    chatMessages.append(row);

    if (Number(message.id) > chatLastId) chatLastId = Number(message.id);
  }

  function scrollChat() {
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function loadChat(replace) {
    if (!chatFriend || !token || chatLoading || !chatOverlay || chatOverlay.hidden) return;
    chatLoading = true;
    var friendId = chatFriend.id;
    api('/api/friends/chat?friend=' + encodeURIComponent(friendId) + '&after=' + (replace ? 0 : chatLastId)).then(function (data) {
      if (!chatFriend || chatFriend.id !== friendId) return;
      if (replace) {
        chatMessages.replaceChildren();
        chatLastId = 0;
      }
      var list = Array.isArray(data.messages) ? data.messages : [];
      list.forEach(function (message) {
        if (Number(message.id) > chatLastId) appendChatMessage(message);
      });
      if (replace && !list.length) chatEmpty();
      scrollChat();
    }).catch(function (error) {
      if (!chatFriend || chatFriend.id !== friendId) return;
      if (error.status === 401) {
        closeFriendChat();
        clearSession();
        showGuest();
        setMessage(authMsg, 'Сессия истекла, войди заново', true);
        return;
      }
      if (error.status === 404) {
        closeFriendChat();
        friendMessage('Переписка доступна только друзьям', true);
        loadFriends();
        return;
      }
      chatMessage(error.message, true);
    }).finally(function () {
      chatLoading = false;
    });
  }

  function startChatPolling() {
    stopChatPolling();
    chatTimer = setInterval(function () {
      loadChat(false);
    }, 3000);
  }

  function stopChatPolling() {
    if (chatTimer) {
      clearInterval(chatTimer);
      chatTimer = null;
    }
  }

  function openFriendChat(friend) {
    if (!chatOverlay || !friend) return;
    chatFriend = friend;
    chatLastId = 0;
    chatLoading = false;
    stopChatPolling();

    if (chatTitle) chatTitle.textContent = friend.username || friend.id || 'Чат';
    if (chatAvatar) applyAvatar(chatAvatar, friend);
    if (chatId) chatId.textContent = friend.id || '';
    if (chatMessages) chatMessages.replaceChildren();
    if (chatForm) chatForm.reset();
    chatMessage('', false);

    chatOverlay.hidden = false;
    document.body.classList.add('friend-chat-open');
    loadChat(true);
    startChatPolling();
    var input = chatForm ? chatForm.querySelector('input[name="text"]') : null;
    if (input) input.focus();
  }

  function closeFriendChat() {
    stopChatPolling();
    chatFriend = null;
    chatLastId = 0;
    chatLoading = false;
    if (chatOverlay) chatOverlay.hidden = true;
    if (chatMessages) chatMessages.replaceChildren();
    chatMessage('', false);
    document.body.classList.remove('friend-chat-open');
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

  function resetHash(dropSearch) {
    if (history.replaceState) {
      history.replaceState(null, '', location.pathname + (dropSearch ? '' : location.search));
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

  if (friendForm) {
    friendForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = friendForm.querySelector('input[name="friend"]');
      var query = String(input ? input.value : '').trim();
      if (!query) return;

      var submit = friendForm.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      friendMessage('Отправляю заявку…', false);

      api('/api/friends', {
        method: 'POST',
        body: { action: 'request', query: query }
      }).then(function (data) {
        if (input) input.value = '';
        friendMessage(data.message || 'Заявка отправлена', false);
        renderFriends(data);
      }).catch(function (error) {
        if (error.status === 401) {
          clearSession();
          showGuest();
          setMessage(authMsg, 'Сессия истекла, войди заново', true);
          return;
        }
        friendMessage(error.message, true);
      }).finally(function () {
        if (submit) submit.disabled = false;
      });
    });
  }

  if (chatForm) {
    chatForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!chatFriend || !token) return;

      var input = chatForm.querySelector('input[name="text"]');
      var text = String(input ? input.value : '').trim();
      if (!text) return;

      var friendId = chatFriend.id;
      var submit = chatForm.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      chatMessage('', false);

      api('/api/friends/chat', {
        method: 'POST',
        body: { friend: friendId, text: text }
      }).then(function (data) {
        if (!chatFriend || chatFriend.id !== friendId) return;
        if (input) input.value = '';
        if (data.message) appendChatMessage(data.message);
        scrollChat();
      }).catch(function (error) {
        if (!chatFriend || chatFriend.id !== friendId) return;
        if (error.status === 401) {
          closeFriendChat();
          clearSession();
          showGuest();
          setMessage(authMsg, 'Сессия истекла, войди заново', true);
          return;
        }
        if (error.status === 404) {
          closeFriendChat();
          friendMessage('Переписка доступна только друзьям', true);
          loadFriends();
          return;
        }
        chatMessage(error.message, true);
      }).finally(function () {
        if (submit) submit.disabled = false;
        if (input && chatFriend && chatFriend.id === friendId) input.focus();
      });
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-chat-close]'), function (button) {
    button.addEventListener('click', closeFriendChat);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && chatOverlay && !chatOverlay.hidden) closeFriendChat();
  });

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
      if (name === 'friends') friendMessage('', false);
    });
  });

  if (browserApproveButton) {
    browserApproveButton.addEventListener('click', approveBrowserLogin);
  }
  if (browserCancelButton) {
    browserCancelButton.addEventListener('click', clearBrowserLogin);
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-browser-cancel]'), function (node) {
    node.addEventListener('click', clearBrowserLogin);
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

  function boot() {
    if (!API) {
      showSetup();
      return;
    }

    rememberBrowserCode(browserLoginCode());

    var adminCode = adminLoginCode();
  if (adminCode) {
    rememberBrowserCode('');
    clearSession();
    switchMode('login');
    showGuest();
    setMessage(authMsg, 'Вхожу в аккаунт…');
    resetHash(true);

    api('/api/auth/admin-login', {
      method: 'POST',
      body: { code: adminCode }
    }).then(function (data) {
      saveSession(data);
      setMessage(authMsg, '');
      setPanel('overview', true);
    }).catch(function (error) {
      switchMode('login');
      showGuest();
      setMessage(authMsg, 'Не удалось войти: ' + error.message, true);
    });
    return;
  }

  token = localStorage.getItem(TOKEN_KEY) || '';
  if (!token) {
    switchMode('login');
    showGuest();
    if (browserCode) {
      setMessage(authMsg, 'Лаунчер ждёт вход. Войди в аккаунт, чтобы подтвердить его.');
    }
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
  }

  if (!API) {
    refreshApiBase().then(boot);
  } else {
    boot();
  }
})();
