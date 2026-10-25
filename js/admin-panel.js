/* AnkaGuard admin panel. Без внешних зависимостей и без innerHTML для данных. */
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };

    var state = {
        token: '',
        keys: [],
        accounts: [],
        stats: {},
        log: [],
        expanded: new Set(),
        expandedAccounts: new Set(),
        adminTab: 'keys',
        timer: null,
        busy: false
    };

    /* ── сеть ─────────────────────────────────────────────────────── */

    async function api(path, options) {
        options = options || {};
        var headers = { 'X-Admin-Token': state.token };
        if (options.body) headers['Content-Type'] = 'application/json';

        var response = await fetch(path, {
            method: options.method || 'GET',
            headers: headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
            cache: 'no-store'
        });

        var data = null;
        try { data = await response.json(); } catch (ignored) { /* тело может быть пустым */ }

        if (!response.ok) {
            var error = new Error((data && data.message) || ('HTTP ' + response.status));
            error.code = (data && data.error) || ('HTTP_' + response.status);
            error.status = response.status;
            throw error;
        }
        return data || {};
    }

    async function load() {
        if (state.busy) return;
        state.busy = true;
        try {
            var results = await Promise.all([
                api('/api/admin/keys'),
                api('/api/admin/stats'),
                api('/api/admin/log'),
                api('/api/admin/accounts')
            ]);
            state.keys = results[0].keys || [];
            state.stats = results[1].stats || {};
            state.log = (results[2].log || []).slice().reverse();
            state.accounts = results[3].accounts || [];
            renderStats();
            renderRows();
            renderLog();
            renderAccounts();
            $('dot').className = 'dot online';
            $('dot').title = 'связь есть';
        } finally {
            state.busy = false;
        }
    }

    /* ── форматирование ───────────────────────────────────────────── */

    function fmtDate(seconds) {
        if (!seconds) return '—';
        return new Date(seconds * 1000).toLocaleString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function fmtShort(seconds) {
        if (!seconds) return '—';
        return new Date(seconds * 1000).toLocaleString('ru-RU', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
    }

    function fmtDateOnly(seconds) {
        if (!seconds) return '—';
        return new Date(seconds * 1000).toLocaleDateString('ru-RU', {
            day: '2-digit', month: '2-digit', year: '2-digit'
        });
    }

    function maskKey(key) {
        var parts = String(key).split('-');
        if (parts.length < 5) return key;
        return [parts[0], '••••', '••••', '••••', parts[parts.length - 1]].join('-');
    }

    function statusOf(key) {
        if (key.revoked) return { cls: 'bad', text: 'отозван' };
        if (key.expiresAt && key.expiresAt * 1000 < Date.now()) return { cls: 'warn', text: 'истёк' };
        return { cls: 'ok', text: 'активен' };
    }

    var EVENTS = {
        'key-created': 'выпуск',
        'revoke': 'отзыв',
        'restore': 'восстановление',
        'extend': 'продление',
        'delete': 'удаление',
        'reset': 'сброс привязок',
        'activate': 'активация',
        'heartbeat': 'проверка',
        'deactivate': 'отвязка',
        'admin-keygen': 'выпуск (админка)',
        'admin-revoke': 'отзыв (админка)',
        'admin-restore': 'восстановление (админка)',
        'admin-extend': 'продление (админка)',
        'admin-delete': 'удаление (админка)',
        'admin-reset': 'сброс (админка)',
        'admin-account-prefix': 'префикс аккаунта',
        'admin-account-username': 'смена игрового ID',
        'admin-account-account-id': 'смена AnkaVisual ID',
        'admin-account-impersonate': 'вход в аккаунт (админка)',
        'admin-login': 'вход в аккаунт',
        'admin-account-block': 'блокировка аккаунта',
        'admin-account-unblock': 'разблокировка аккаунта',
        'admin-account-logout': 'завершение сессий',
        'admin-account-password': 'сброс пароля',
        'admin-account-delete': 'удаление аккаунта'
    };

    /* ── отрисовка ────────────────────────────────────────────────── */

    function renderStats() {
        var s = state.stats || {};
        var items;

        if (state.adminTab === 'accounts') {
            var accounts = state.accounts || [];
            var blocked = accounts.filter(function (account) { return account.blocked; }).length;
            var sessions = accounts.reduce(function (sum, account) {
                return sum + (Number(account.sessions) || 0);
            }, 0);
            var admins = accounts.filter(function (account) { return account.prefix === 'admin'; }).length;
            var beta = accounts.filter(function (account) { return account.prefix === 'beta'; }).length;

            items = [
                ['Аккаунтов', accounts.length, ''],
                ['Активных', accounts.length - blocked, 'accent'],
                ['Заблокировано', blocked, 'danger'],
                ['Сессий', sessions, ''],
                ['Админов', admins, 'warn'],
                ['Бета-тестеров', beta, '']
            ];
        } else {
            items = [
                ['Ключей', s.total, ''],
                ['Активных', s.active, 'accent'],
                ['Отозвано', s.revoked, 'danger'],
                ['Истекло', s.expired, 'warn'],
                ['Активаций', s.activations, ''],
                ['Устройств', s.devicesSeen, '']
            ];
        }

        var wrap = $('stats');
        wrap.replaceChildren();
        items.forEach(function (item) {
            var box = document.createElement('div');
            box.className = 'stat ' + item[2];

            var value = document.createElement('div');
            value.className = 'value';
            value.textContent = item[1] == null ? '0' : String(item[1]);

            var label = document.createElement('div');
            label.className = 'label';
            label.textContent = item[0];

            box.append(value, label);
            wrap.append(box);
        });

        var plans = $('plans');
        plans.replaceChildren();
        var byPlan = state.adminTab === 'keys' ? (s.byPlan || {}) : {};
        Object.keys(byPlan).forEach(function (name) {
            var chip = document.createElement('span');
            chip.className = 'chip';
            chip.textContent = name + ': ' + byPlan[name];
            plans.append(chip);
        });
        plans.hidden = state.adminTab !== 'keys' || Object.keys(byPlan).length === 0;
    }

    function visibleKeys() {
        var query = $('search').value.trim().toLowerCase();
        var filter = $('filter').value;

        return state.keys.filter(function (key) {
            var status = statusOf(key);
            if (filter === 'active' && status.text !== 'активен') return false;
            if (filter === 'revoked' && !key.revoked) return false;
            if (filter === 'expired' && status.text !== 'истёк') return false;

            if (!query) return true;
            var haystack = (key.key + ' ' + (key.note || '') + ' ' + key.plan).toLowerCase();
            return haystack.indexOf(query) !== -1;
        });
    }

    function renderRows() {
        var body = $('rows');
        body.replaceChildren();

        var list = visibleKeys();
        $('count').textContent = list.length === state.keys.length
            ? String(list.length)
            : list.length + ' из ' + state.keys.length;
        $('empty').hidden = list.length > 0;

        list.forEach(function (key) {
            body.append(buildRow(key));
            if (state.expanded.has(key.key)) body.append(buildDetails(key));
        });
    }

    function buildRow(key) {
        var expanded = state.expanded.has(key.key);
        var status = statusOf(key);
        var row = document.createElement('tr');
        row.className = 'keyrow';
        row.title = expanded ? 'свернуть' : 'подробности';

        row.addEventListener('click', function (event) {
            if (event.target.closest('button')) return;
            if (expanded) state.expanded.delete(key.key);
            else state.expanded.add(key.key);
            renderRows();
        });

        var keyCell = document.createElement('td');
        keyCell.className = 'mono';
        keyCell.textContent = expanded ? key.key : maskKey(key.key);

        var noteCell = document.createElement('td');
        noteCell.className = 'note note-col';
        noteCell.textContent = key.note || '';
        noteCell.title = key.note || '';

        var planCell = document.createElement('td');
        planCell.className = 'plan-col';
        planCell.textContent = key.plan || '';

        var untilCell = document.createElement('td');
        untilCell.textContent = key.expiresAt ? fmtDateOnly(key.expiresAt) : 'бессрочно';

        var actCell = document.createElement('td');
        actCell.className = 'num act-col';
        actCell.textContent = (key.activations ? key.activations.length : 0) + '/' + key.maxActivations;

        var devCell = document.createElement('td');
        devCell.className = 'num dev-col';
        devCell.textContent = String(key.devicesSeen == null ? 0 : key.devicesSeen);

        var statusCell = document.createElement('td');
        var badge = document.createElement('span');
        badge.className = 'badge ' + status.cls;
        badge.textContent = status.text;
        statusCell.append(badge);

        row.append(keyCell, noteCell, planCell, untilCell, actCell, devCell, statusCell);
        return row;
    }

    function buildDetails(key) {
        var row = document.createElement('tr');
        row.className = 'details';

        var cell = document.createElement('td');
        cell.colSpan = window.matchMedia('(max-width: 620px)').matches ? 3 : 7;

        var grid = document.createElement('div');
        grid.className = 'details-grid';

        /* левая половина: свойства ключа */
        var left = document.createElement('div');
        var leftTitle = document.createElement('h4');
        leftTitle.textContent = 'Ключ';
        var list = document.createElement('dl');
        list.className = 'kv';

        kv(list, 'Полный ключ', key.key, true);
        kv(list, 'id', key.id);
        kv(list, 'План', key.plan);
        kv(list, 'Фичи', (key.features || []).join(', ') || '—');
        kv(list, 'Создан', fmtDate(key.created));
        kv(list, 'Действует до', key.expiresAt ? fmtDate(key.expiresAt) : 'бессрочно');
        kv(list, 'Лимит активаций', String(key.maxActivations));
        if (key.revoked) kv(list, 'Причина отзыва', key.revokedReason || '—');

        left.append(leftTitle, list);

        /* правая половина: устройства */
        var right = document.createElement('div');
        var rightTitle = document.createElement('h4');
        rightTitle.textContent = 'Привязанные устройства';
        right.append(rightTitle);

        var devices = document.createElement('div');
        devices.className = 'devices';
        if (!key.activations || key.activations.length === 0) {
            var none = document.createElement('div');
            none.className = 'muted';
            none.textContent = 'нет активных привязок';
            devices.append(none);
        } else {
            key.activations.forEach(function (device) {
                var line = document.createElement('div');
                var hwid = document.createElement('span');
                hwid.className = 'mono';
                hwid.textContent = device.hwid;

                var meta = document.createElement('span');
                meta.className = 'muted';
                meta.textContent = '  ' + (device.ip || '?')
                    + (device.version ? ' · ' + device.version : '')
                    + ' · ' + fmtShort(device.lastSeen);

                line.append(hwid, meta);
                devices.append(line);
            });
        }
        right.append(devices);

        grid.append(left, right);
        cell.append(grid, buildActions(key));
        row.append(cell);
        return row;
    }

    function kv(list, name, value, mono) {
        var dt = document.createElement('dt');
        dt.textContent = name;
        var dd = document.createElement('dd');
        if (mono) dd.className = 'mono';
        dd.textContent = value == null || value === '' ? '—' : String(value);
        list.append(dt, dd);
    }

    function buildActions(key) {
        var bar = document.createElement('div');
        bar.className = 'actions';

        bar.append(button('Продлить', 'ghost small', function () { extendKey(key); }));
        bar.append(button('Копировать', 'ghost small', function () { copyKey(key.key); }));

        if (key.revoked) {
            bar.append(button('Вернуть', 'small', function () { restoreKey(key); }));
        } else {
            bar.append(button('Отозвать', 'danger small', function () { revokeKey(key); }));
        }

        bar.append(button('Сбросить привязки', 'ghost small', function () { resetKey(key); }));
        bar.append(button('Удалить навсегда', 'danger small', function () { deleteKey(key); }));
        return bar;
    }

    function button(text, cls, onClick) {
        var element = document.createElement('button');
        element.type = 'button';
        element.className = cls;
        element.textContent = text;
        element.addEventListener('click', function (event) {
            event.stopPropagation();
            onClick();
        });
        return element;
    }

    var PREFIX_LABELS = {
        '': 'Без префикса',
        owner: 'Владелец',
        coowner: 'Со-владелец',
        support: 'Поддержка',
        admin: 'Админ',
        beta: 'Бета-тестер'
    };

    var ACCOUNT_PREFIX_OPTIONS = [
        ['', 'Без префикса'],
        ['owner', 'Владелец'],
        ['coowner', 'Со-владелец'],
        ['support', 'Поддержка'],
        ['admin', 'Админ'],
        ['beta', 'Бета-тестер']
    ];

    function visibleAccounts() {
        var query = $('accSearch').value.trim().toLowerCase();
        var filter = $('accFilter').value;
        var prefixFilter = $('accPrefixFilter').value;

        return state.accounts.filter(function (account) {
            if (filter === 'active' && account.blocked) return false;
            if (filter === 'blocked' && !account.blocked) return false;

            var prefix = account.prefix || '';
            if (prefixFilter === 'none' && prefix) return false;
            if (prefixFilter !== 'all' && prefixFilter !== 'none' && prefix !== prefixFilter) {
                return false;
            }

            if (!query) return true;
            var haystack = [
                account.username,
                account.email || '',
                account.id || '',
                account.lastIp || ''
            ].join(' ').toLowerCase();
            return haystack.indexOf(query) !== -1;
        });
    }

    function buildPrefixSelect(account) {
        var select = document.createElement('select');
        select.className = 'acc-prefix';
        select.setAttribute('aria-label', 'Префикс ' + account.username);
        ACCOUNT_PREFIX_OPTIONS.forEach(function (option) {
            var item = document.createElement('option');
            item.value = option[0];
            item.textContent = option[1];
            select.append(item);
        });
        select.value = PREFIX_LABELS[account.prefix] ? account.prefix : '';
        select.addEventListener('click', function (event) {
            event.stopPropagation();
        });
        select.addEventListener('change', function () {
            updatePrefix(account, select);
        });
        return select;
    }

    function toggleAccount(account) {
        if (state.expandedAccounts.has(account.id)) {
            state.expandedAccounts.delete(account.id);
        } else {
            state.expandedAccounts.add(account.id);
        }
        renderAccounts();
    }

    function renderAccounts() {
        var body = $('accRows');
        body.replaceChildren();
        var list = visibleAccounts();

        $('accCount').textContent = list.length === state.accounts.length
            ? state.accounts.length + ' шт.'
            : list.length + ' из ' + state.accounts.length;
        $('accEmpty').hidden = list.length > 0;

        list.forEach(function (account) {
            var expanded = state.expandedAccounts.has(account.id);
            var row = document.createElement('tr');
            row.className = 'acc-row';
            row.title = expanded ? 'Свернуть' : 'Управление аккаунтом';
            row.addEventListener('click', function () {
                toggleAccount(account);
            });

            var name = document.createElement('td');
            var login = document.createElement('span');
            login.className = 'acc-user';
            login.textContent = account.username;
            var id = document.createElement('span');
            id.className = 'acc-id mono';
            id.textContent = 'ID ' + account.id;
            name.append(login, id);

            var mail = document.createElement('td');
            mail.className = 'note acc-mail-col';
            mail.textContent = account.email || '—';

            var prefixCell = document.createElement('td');
            prefixCell.append(buildPrefixSelect(account));

            var created = document.createElement('td');
            created.className = 'acc-created-col';
            created.textContent = fmtDate(account.created);

            var last = document.createElement('td');
            last.textContent = fmtDate(account.lastLogin);

            var sessions = document.createElement('td');
            sessions.className = 'num acc-sessions';
            sessions.textContent = String(account.sessions || 0);

            var status = document.createElement('td');
            var badge = document.createElement('span');
            badge.className = 'badge ' + (account.blocked ? 'bad' : 'ok');
            badge.textContent = account.blocked ? 'заблокирован' : 'активен';
            status.append(badge);

            var actions = document.createElement('td');
            actions.append(button(expanded ? 'Скрыть' : 'Управление', 'ghost small', function () {
                toggleAccount(account);
            }));

            row.append(name, mail, prefixCell, created, last, sessions, status, actions);
            body.append(row);
            if (expanded) body.append(buildAccountDetails(account));
        });
    }

    function buildAccountDetails(account) {
        var row = document.createElement('tr');
        row.className = 'details';

        var cell = document.createElement('td');
        cell.colSpan = 8;

        var grid = document.createElement('div');
        grid.className = 'details-grid';

        var left = document.createElement('div');
        var title = document.createElement('h4');
        title.textContent = 'Данные аккаунта';
        var details = document.createElement('dl');
        details.className = 'kv';
        kv(details, 'Игровой ID', account.username);
        kv(details, 'AnkaVisual ID', account.id, true);
        kv(details, 'Почта', account.email || '—');
        kv(details, 'Создан', fmtDate(account.created));
        kv(details, 'Последний вход', fmtDate(account.lastLogin));
        kv(details, 'Последний IP', account.lastIp || '—', true);
        kv(details, 'Активные сессии', String(account.sessions || 0));
        left.append(title, details);

        var right = document.createElement('div');
        var actionsTitle = document.createElement('h4');
        actionsTitle.textContent = 'Управление';
        var hint = document.createElement('p');
        hint.className = 'muted acc-detail';
        hint.textContent = account.blocked
            ? 'Аккаунт заблокирован: вход и игровые сессии закрыты.'
            : 'Блокировка сразу завершает все сессии аккаунта.';

        var actions = document.createElement('div');
        actions.className = 'acc-actions';
        var impersonateButton = button('Войти на аккаунт', 'small', function () {
            impersonateAccount(account);
        });
        if (account.blocked) impersonateButton.disabled = true;
        actions.append(impersonateButton);
        actions.append(button('Сменить игровой ID', 'ghost small', function () {
            renameAccount(account);
        }));
        actions.append(button('Сменить AnkaVisual ID', 'ghost small', function () {
            changeAccountId(account);
        }));
        actions.append(button(
            account.blocked ? 'Разблокировать' : 'Заблокировать',
            account.blocked ? 'small' : 'danger small',
            function () { toggleAccountBlock(account); }
        ));
        actions.append(button('Завершить сессии', 'ghost small', function () {
            logoutAccountSessions(account);
        }));
        actions.append(button('Сбросить пароль', 'ghost small', function () {
            resetAccountPassword(account);
        }));
        actions.append(button('Удалить аккаунт', 'danger small', function () {
            deleteAccount(account);
        }));
        right.append(actionsTitle, hint, actions);

        grid.append(left, right);
        cell.append(grid);
        row.append(cell);
        return row;
    }

    async function updatePrefix(account, select) {
        var prefix = select.value;
        select.disabled = true;
        try {
            await api('/api/admin/accounts', {
                method: 'POST',
                body: { id: account.id, action: 'prefix', prefix: prefix }
            });
            account.prefix = prefix;
            toast('Префикс обновлён: ' + (PREFIX_LABELS[prefix] || prefix));
            renderAccounts();
        } catch (error) {
            select.value = account.prefix || '';
            toast(error.message || 'не удалось обновить префикс', true);
            if (error.status === 401) logout('Сессия панели истекла.');
        } finally {
            select.disabled = false;
        }
    }

    async function impersonateAccount(account) {
        if (account.blocked) {
            toast('Аккаунт заблокирован', true);
            return;
        }

        var win = window.open('about:blank', '_blank');
        if (!win) {
            toast('Разреши всплывающие окна, чтобы открыть аккаунт', true);
            return;
        }
        try { win.opener = null; } catch (ignored) { /* не критично */ }

        try {
            var data = await api('/api/admin/accounts', {
                method: 'POST',
                body: { id: account.id, action: 'impersonate' }
            });
            if (!data.url || !/^https?:\/\//.test(data.url)) {
                throw new Error('Сервер не вернул ссылку для входа');
            }
            var target = new URL(data.url);
            target.searchParams.set('_', String(Date.now()));
            win.location.replace(target.toString());
            toast('Открываю аккаунт ' + account.username);
        } catch (error) {
            try { win.close(); } catch (ignored) { /* уже закрыто */ }
            toast(error.message || 'Не удалось открыть аккаунт', true);
            if (error.status === 401) logout('Сессия панели истекла.');
        }
    }

    async function runAccountAction(account, action, body, successMessage) {
        try {
            await api('/api/admin/accounts', {
                method: 'POST',
                body: Object.assign({ id: account.id, action: action }, body || {})
            });
            toast(successMessage);
            if (action === 'delete') state.expandedAccounts.delete(account.id);
            if (action === 'account-id' && body && body.accountId) {
                state.expandedAccounts.delete(account.id);
                state.expandedAccounts.add(body.accountId);
            }
            await load();
        } catch (error) {
            toast(error.message || 'Не получилось выполнить действие', true);
            if (error.status === 401) logout('Сессия панели истекла.');
        }
    }

    async function renameAccount(account) {
        var values = await ask({
            title: 'Сменить игровой ID',
            text: 'Новый ID будет использоваться как ник и offline-UUID в Minecraft. '
                + 'Текущий: ' + account.username + '.',
            fields: [
                {
                    name: 'username',
                    label: 'Новый игровой ID',
                    value: account.username,
                    placeholder: '3–24 символа: a-z, 0-9, _ и -'
                }
            ],
            ok: 'Сменить ID'
        });
        if (!values) return;

        var username = String(values.username || '').trim().toLowerCase();
        if (username === account.username) {
            toast('Игровой ID не изменился');
            return;
        }
        if (!/^[a-z0-9_-]{3,24}$/.test(username)) {
            toast('ID: 3–24 символа, только латиница, цифры, _ и -', true);
            return;
        }

        await runAccountAction(account, 'username', { username: username }, 'Игровой ID изменён');
    }

    async function changeAccountId(account) {
        var values = await ask({
            title: 'Сменить AnkaVisual ID',
            text: 'ID виден на сайте и в лаунчере. Игровой ник и UUID при этом не меняются. '
                + 'Текущий: ' + account.id + '.',
            fields: [
                {
                    name: 'accountId',
                    label: 'Новый AnkaVisual ID',
                    value: account.id,
                    placeholder: '3–32 символа: A-Z, a-z, 0-9, _ и -'
                }
            ],
            ok: 'Сменить ID'
        });
        if (!values) return;

        var accountId = String(values.accountId || '').trim();
        if (accountId === account.id) {
            toast('AnkaVisual ID не изменился');
            return;
        }
        if (!/^[A-Za-z0-9_-]{3,32}$/.test(accountId)) {
            toast('ID: 3–32 символа, только латиница, цифры, _ и -', true);
            return;
        }

        await runAccountAction(account, 'account-id', { accountId: accountId }, 'AnkaVisual ID изменён');
    }

    async function toggleAccountBlock(account) {
        var block = !account.blocked;
        var ok = await ask({
            title: block ? 'Заблокировать аккаунт?' : 'Разблокировать аккаунт?',
            text: block
                ? 'Аккаунт ' + account.username + ' не сможет войти, все его сессии будут завершены.'
                : 'Аккаунт ' + account.username + ' снова сможет войти.',
            ok: block ? 'Заблокировать' : 'Разблокировать',
            danger: block
        });
        if (!ok) return;
        await runAccountAction(account, block ? 'block' : 'unblock', {}, block
            ? 'Аккаунт заблокирован'
            : 'Аккаунт разблокирован');
    }

    async function logoutAccountSessions(account) {
        if (!account.sessions) {
            toast('У аккаунта нет активных сессий', true);
            return;
        }
        var ok = await ask({
            title: 'Завершить все сессии?',
            text: 'Все устройства аккаунта ' + account.username + ' будут разлогинены.',
            ok: 'Завершить',
            danger: true
        });
        if (!ok) return;
        await runAccountAction(account, 'logout', {}, 'Сессии завершены');
    }

    async function resetAccountPassword(account) {
        var values = await ask({
            title: 'Сбросить пароль',
            text: 'Новый пароль для ' + account.username + '. Все текущие сессии будут завершены.',
            fields: [
                {
                    name: 'password',
                    label: 'Новый пароль',
                    type: 'password',
                    placeholder: 'минимум 8 символов'
                }
            ],
            ok: 'Сменить пароль',
            danger: true
        });
        if (!values) return;
        var password = String(values.password || '');
        if (password.length < 8) {
            toast('Пароль должен быть не короче 8 символов', true);
            return;
        }
        await runAccountAction(account, 'password', { password: password }, 'Пароль изменён');
    }

    async function deleteAccount(account) {
        var values = await ask({
            title: 'Удалить аккаунт навсегда?',
            text: 'Аккаунт ' + account.username + ' будет удалён вместе с сессиями. Это нельзя отменить.',
            ok: 'Удалить навсегда',
            danger: true
        });
        if (!values) return;
        await runAccountAction(account, 'delete', {}, 'Аккаунт удалён');
    }

    function renderLog() {
        var list = $('log');
        list.replaceChildren();

        if (state.log.length === 0) {
            var empty = document.createElement('li');
            empty.className = 'muted';
            empty.textContent = 'пока пусто';
            list.append(empty);
            return;
        }

        state.log.slice(0, 80).forEach(function (entry) {
            var item = document.createElement('li');

            var when = document.createElement('span');
            when.className = 'when';
            when.textContent = fmtShort(entry.t);

            var what = document.createElement('span');
            what.className = 'what';
            what.textContent = (EVENTS[entry.event] || entry.event || '?')
                + (entry.keyMasked ? ' · ' + entry.keyMasked : '');

            item.append(when, document.createElement('br'), what);

            var extra = [entry.hwid, entry.note].filter(function (v) { return v; }).join(' · ');
            if (extra) {
                var who = document.createElement('span');
                who.className = 'who';
                who.textContent = extra;
                item.append(who);
            }

            list.append(item);
        });
    }

    /* ── действия ─────────────────────────────────────────────────── */

    async function run(action, successMessage) {
        try {
            await action();
            toast(successMessage);
            await load();
        } catch (error) {
            toast(error.message || 'Не получилось', true);
            if (error.status === 401) logout('Токен больше не подходит.');
        }
    }

    function extendKey(key) {
        ask({
            title: 'Продлить ключ',
            text: key.key,
            ok: 'Продлить',
            fields: [{ name: 'days', label: 'На сколько дней', type: 'number', value: 30, min: 1 }]
        }).then(function (values) {
            if (!values) return;
            run(function () {
                return api('/api/admin/extend', {
                    method: 'POST',
                    body: { key: key.key, days: values.days }
                });
            }, 'Продлено на ' + values.days + ' дн.');
        });
    }

    function revokeKey(key) {
        ask({
            title: 'Отозвать ключ',
            text: 'Клиент перестанет пускать на всех машинах. Отзыв сработает и офлайн.',
            ok: 'Отозвать',
            danger: true,
            fields: [{ name: 'reason', label: 'Причина (необязательно)', value: '' }]
        }).then(function (values) {
            if (!values) return;
            run(function () {
                return api('/api/admin/revoke', {
                    method: 'POST',
                    body: { key: key.key, reason: values.reason }
                });
            }, 'Ключ отозван');
        });
    }

    function restoreKey(key) {
        ask({
            title: 'Вернуть ключ',
            text: 'Лицензия снова станет действительной.',
            ok: 'Вернуть'
        }).then(function (values) {
            if (!values) return;
            run(function () {
                return api('/api/admin/restore', {
                    method: 'POST',
                    body: { key: key.key }
                });
            }, 'Ключ снова активен');
        });
    }

    function resetKey(key) {
        ask({
            title: 'Сбросить привязки',
            text: 'Нужно, когда игрок сменил железо. Все устройства отвяжутся.',
            ok: 'Сбросить',
            fields: [{
                name: 'history',
                label: 'Очистить и историю устройств (анти-шаринг отпустит ключ)',
                type: 'checkbox',
                value: false
            }]
        }).then(function (values) {
            if (!values) return;
            run(function () {
                return api('/api/admin/reset', {
                    method: 'POST',
                    body: { key: key.key, clearHistory: !!values.history }
                });
            }, 'Привязки сняты');
        });
    }

    function deleteKey(key) {
        ask({
            title: 'Удалить ключ навсегда',
            text: 'Ключ и все его привязки исчезнут из базы. Это действие нельзя отменить.',
            ok: 'Удалить',
            danger: true
        }).then(function (values) {
            if (!values) return;
            run(function () {
                return api('/api/admin/delete', {
                    method: 'POST',
                    body: { key: key.key }
                });
            }, 'Ключ удалён');
        });
    }

    function copyKey(text) {
        function fallback() {
            var area = document.createElement('textarea');
            area.value = text;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.append(area);
            area.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (ignored) { ok = false; }
            area.remove();
            toast(ok ? 'Ключ скопирован' : 'Браузер не дал скопировать', !ok);
        }

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(function () { toast('Ключ скопирован'); })
                .catch(fallback);
        } else {
            fallback();
        }
    }

    /* ── диалог ───────────────────────────────────────────────────── */

    function ask(options) {
        return new Promise(function (resolve) {
            $('mTitle').textContent = options.title || '';
            $('mText').textContent = options.text || '';
            $('mText').hidden = !options.text;

            var fields = $('mFields');
            fields.replaceChildren();
            var inputs = {};

            (options.fields || []).forEach(function (field) {
                var label = document.createElement('label');
                var input = document.createElement('input');

                if (field.type === 'checkbox') {
                    input.type = 'checkbox';
                    input.checked = !!field.value;
                    label.className = 'check';
                    label.append(input, document.createTextNode(' ' + field.label));
                } else {
                    input.type = field.type || 'text';
                    input.value = field.value == null ? '' : String(field.value);
                    if (field.min != null) input.min = field.min;
                    if (field.placeholder) input.placeholder = field.placeholder;
                    label.append(document.createTextNode(field.label), input);
                }

                fields.append(label);
                inputs[field.name] = input;
            });

            var okButton = $('mOk');
            okButton.textContent = options.ok || 'Применить';
            okButton.className = options.danger ? 'danger' : '';

            $('modal').hidden = false;
            var first = fields.querySelector('input');
            if (first) first.focus();

            function close(value) {
                $('modal').hidden = true;
                okButton.removeEventListener('click', onOk);
                $('mCancel').removeEventListener('click', onCancel);
                document.removeEventListener('keydown', onKey);
                resolve(value);
            }

            function onOk() {
                var values = {};
                Object.keys(inputs).forEach(function (name) {
                    var input = inputs[name];
                    if (input.type === 'checkbox') values[name] = input.checked;
                    else if (input.type === 'number') values[name] = Number(input.value);
                    else values[name] = input.value;
                });
                close(values);
            }

            function onCancel() { close(null); }

            function onKey(event) {
                if (event.key === 'Escape') onCancel();
                if (event.key === 'Enter') { event.preventDefault(); onOk(); }
            }

            okButton.addEventListener('click', onOk);
            $('mCancel').addEventListener('click', onCancel);
            document.addEventListener('keydown', onKey);
        });
    }

    /* ── всплывающие сообщения ────────────────────────────────────── */

    var toastTimer = null;

    function toast(message, bad) {
        var element = $('toast');
        element.textContent = message;
        element.className = 'toast' + (bad ? ' bad' : '');
        element.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { element.hidden = true; }, 3500);
    }

    /* ── вход и выход ─────────────────────────────────────────────── */

    function setAdminTab(name) {
        var cloud = !!(state.stats && state.stats.cloud);
        if (cloud) name = 'accounts';
        state.adminTab = name === 'accounts' ? 'accounts' : 'keys';

        var keysTab = $('tabKeys');
        if (keysTab) keysTab.hidden = cloud;

        Array.prototype.forEach.call(document.querySelectorAll('[data-admin-tab]'), function (tab) {
            tab.classList.toggle('on', tab.getAttribute('data-admin-tab') === state.adminTab);
        });

        $('keysView').hidden = state.adminTab !== 'keys';
        $('accountsView').hidden = state.adminTab !== 'accounts';
        $('plans').hidden = state.adminTab !== 'keys'
            || Object.keys((state.stats && state.stats.byPlan) || {}).length === 0;

        renderStats();
        if (state.adminTab === 'accounts') renderAccounts();
    }

    function showApp() {
        $('login').hidden = true;
        $('app').hidden = false;
        $('refresh').hidden = false;
        $('logout').hidden = false;
        $('dot').className = 'dot online';
        $('dot').title = 'связь есть';
        setAdminTab(state.adminTab);
    }

    function showLogin(message) {
        $('login').hidden = false;
        $('app').hidden = true;
        $('refresh').hidden = true;
        $('logout').hidden = true;
        $('dot').className = 'dot offline';
        $('dot').title = 'нет связи';
        $('loginError').hidden = !message;
        $('loginError').textContent = message || '';
        $('token').focus();
    }

    function logout(message) {
        state.token = '';
        state.keys = [];
        state.accounts = [];
        state.stats = {};
        state.log = [];
        state.expanded.clear();
        state.expandedAccounts.clear();
        state.adminTab = 'keys';
        sessionStorage.removeItem('ag-token');
        clearInterval(state.timer);
        state.timer = null;
        showLogin(message);
    }

    async function start(token) {
        state.token = token;
        $('loginError').hidden = true;
        try {
            await load();
            sessionStorage.setItem('ag-token', token);
            showApp();
            clearInterval(state.timer);
            state.timer = setInterval(async function () {
                if (document.visibilityState !== 'visible' || !state.token) return;
                try {
                    await load();
                } catch (error) {
                    if (error.status === 401) logout('Токен больше не подходит.');
                }
            }, 15000);
        } catch (error) {
            state.token = '';
            sessionStorage.removeItem('ag-token');
            showLogin(error.status === 401
                ? 'Неверный admin-token.'
                : (error.status === 429
                    ? 'Слишком много попыток. Подожди минуту.'
                    : (error.message || 'Сервер не отвечает.')));
        }
    }

    /* ── события страницы ─────────────────────────────────────────── */

    $('loginForm').addEventListener('submit', function (event) {
        event.preventDefault();
        var token = $('token').value.trim();
        if (!token) return;
        start(token);
    });

    $('logout').addEventListener('click', function () { logout(); });

    $('refresh').addEventListener('click', function () {
        load().catch(function (error) {
            toast(error.message || 'Не получилось обновить', true);
            if (error.status === 401) logout('Токен больше не подходит.');
        });
    });

    $('search').addEventListener('input', renderRows);
    $('filter').addEventListener('change', renderRows);

    Array.prototype.forEach.call(document.querySelectorAll('[data-admin-tab]'), function (tab) {
        tab.addEventListener('click', function () {
            setAdminTab(tab.getAttribute('data-admin-tab'));
        });
    });

    $('accSearch').addEventListener('input', renderAccounts);
    $('accFilter').addEventListener('change', renderAccounts);
    $('accPrefixFilter').addEventListener('change', renderAccounts);

    $('createForm').addEventListener('submit', async function (event) {
        event.preventDefault();
        var body = {
            count: Number($('cCount').value) || 1,
            days: Number($('cDays').value) || 0,
            plan: $('cPlan').value.trim() || 'pro',
            activations: Number($('cAct').value) || 1,
            note: $('cNote').value.trim()
        };

        try {
            var result = await api('/api/admin/keys', { method: 'POST', body: body });
            var lines = (result.keys || []).map(function (key) { return key.key; });
            $('created').textContent = lines.join('\n');
            $('created').hidden = lines.length === 0;
            toast('Выпущено ключей: ' + lines.length);
            $('cNote').value = '';
            await load();
        } catch (error) {
            toast(error.message || 'Не получилось выпустить ключи', true);
            if (error.status === 401) logout('Токен больше не подходит.');
        }
    });

    var saved = sessionStorage.getItem('ag-token');
    if (saved) start(saved);
    else showLogin('');
})();
