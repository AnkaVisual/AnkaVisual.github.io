/* AnkaGuard — админ-панель. Новая версия: обзор, ключи, аккаунты, лог. */
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };
    var API_BASE = String(window.ANKAGUARD_API_BASE || 'https://ankaguard.ankavisual.workers.dev').replace(/\/$/, '');

    var state = {
        token: 'qorokAnKa67',
        keys: [],
        accounts: [],
        stats: {},
        log: [],
        adminTab: 'overview',
        timer: null,
        busy: false,
        expanded: new Set(),
        expandedAccounts: new Set()
    };

    var VIEWS = {
        overview: $('viewOverview'),
        keys: $('viewKeys'),
        accounts: $('viewAccounts'),
        log: $('viewLog')
    };

    /* ---------- api ---------- */

    async function api(path, options) {
        options = options || {};
        var headers = { 'X-Admin-Token': state.token };
        if (options.body) headers['Content-Type'] = 'application/json';
        var method = options.method || 'GET';
        var attempts = method === 'GET' ? 2 : 1;
        var lastError = null;

        for (var attempt = 1; attempt <= attempts; attempt++) {
            var controller = new AbortController();
            var timer = setTimeout(function () { controller.abort(); }, 20000);
            try {
                var response = await fetch(API_BASE + path, {
                    method: method,
                    headers: headers,
                    body: options.body ? JSON.stringify(options.body) : undefined,
                    cache: 'no-store',
                    signal: controller.signal
                });

                var data = null;
                try { data = await response.json(); } catch (ignored) { /* не json */ }
                clearTimeout(timer);

                if (!response.ok) {
                    var error = new Error((data && data.message) || ('HTTP ' + response.status));
                    error.code = (data && data.error) || ('HTTP_' + response.status);
                    error.status = response.status;
                    throw error;
                }
                return data || {};
            } catch (error) {
                clearTimeout(timer);
                lastError = error;
                var retryable = method === 'GET' && (!error.status || error.status >= 500);
                if (!retryable || attempt === attempts) throw error;
                await new Promise(function (resolve) { setTimeout(resolve, 350 * attempt); });
            }
        }
        throw lastError || new Error('Не удалось выполнить запрос.');
    }

    var loadPromise = null;

    function load(force) {
        if (loadPromise && !force) return loadPromise;
        var token = state.token;
        var promise = (async function () {
            try {
                var keys = await api('/api/admin/keys');
                var stats = await api('/api/admin/stats');
                var log = await api('/api/admin/log');
                var accounts = await api('/api/admin/accounts');
                if (state.token !== token) return;
                state.keys = keys.keys || [];
                state.stats = stats.stats || {};
                state.log = (log.log || []).slice().reverse();
                state.accounts = accounts.accounts || [];
                if (state.adminTab === 'keys') renderRows();
                else if (state.adminTab === 'accounts') renderAccounts();
                else if (state.adminTab === 'log') renderLog();
                renderStats();
                setDotOnline();
            } catch (error) {
                toast(error.message || 'Ошибка загрузки данных.', true);
                if (error && error.status === 401) logout('Требуется admin-token для панели.');
            } finally {
                if (loadPromise === promise) loadPromise = null;
            }
        })();
        loadPromise = promise;
        return promise;
    }

    /* ---------- formatting ---------- */

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
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    }

    function maskKey(key) {
        var parts = String(key).split('-');
        if (parts.length < 5) return key;
        return [parts[0], '••••', '••••', '••••', parts[parts.length - 1]].join('-');
    }

    function statusOf(key) {
        if (key.revoked) return { cls: 'bad', text: 'Отозван' };
        if (key.expiresAt && key.expiresAt * 1000 < Date.now()) return { cls: 'warn', text: 'Истёк' };
        return { cls: 'ok', text: 'Активен' };
    }

    var EVENTS = {
        'key-created': 'Создан ключ',
        'revoke': 'Отозван',
        'restore': 'Восстановлен',
        'extend': 'Продлён',
        'delete': 'Удалён',
        'reset': 'Сброшен',
        'activate': 'Активирован',
        'heartbeat': 'Heartbeat',
        'deactivate': 'Deactivated',
        'admin-keygen': 'Создан ключ (admin)',
        'admin-revoke': 'Отозван (admin)',
        'admin-restore': 'Восстановлен (admin)',
        'admin-extend': 'Продлён (admin)',
        'admin-delete': 'Удалён (admin)',
        'admin-reset': 'Сброшен (admin)',
        'admin-account-prefix': 'Изменён префикс',
        'admin-account-username': 'Переименован Логин',
        'admin-account-account-id': 'Поменяно AnkaVisual ID',
        'admin-account-impersonate': 'Вход в аккаунт',
        'admin-login': 'Вход в панель',
        'admin-account-block': 'Заблокирован',
        'admin-account-unblock': 'Разблокирован',
        'admin-account-logout': 'Выход из панели',
        'admin-account-password': 'Сменён пароль',
        'admin-account-delete': 'Удалён аккаунт'
    };

    /* ---------- stats ---------- */

    function renderStats() {
        var grid = $('statGrid');
        if (!grid) return;
        grid.replaceChildren();

        var s = state.stats || {};
        var items = [
            ['Всего', s.total, ''],
            ['Активные', s.active, 'accent'],
            ['Отозванные', s.revoked, 'danger'],
            ['Истёкшие', s.expired, 'warn'],
            ['Активаций', s.activations, ''],
            ['Устройств', s.devicesSeen, '']
        ];

        items.forEach(function (item) {
            var box = document.createElement('div');
            box.className = 'stat' + (item[2] ? ' ' + item[2] : '');

            var value = document.createElement('div');
            value.className = 'value';
            value.textContent = item[1] == null ? '0' : String(item[1]);

            var label = document.createElement('div');
            label.className = 'label';
            label.textContent = item[0];

            box.append(value, label);
            grid.append(box);
        });

        var statCount = $('statCount');
        if (statCount) statCount.textContent = String(state.keys ? state.keys.length : 0);

        var plans = $('plans');
        if (plans) {
            plans.replaceChildren();
            var byPlan = state.adminTab === 'keys' ? (state.stats.byPlan || {}) : {};
            Object.keys(byPlan).forEach(function (name) {
                var chip = document.createElement('span');
                chip.className = 'chip';
                chip.textContent = name + ': ' + byPlan[name];
                plans.append(chip);
            });
            plans.hidden = state.adminTab !== 'keys' || Object.keys(byPlan).length === 0;
        }
    }

    /* ---------- keys ---------- */

    function visibleKeys() {
        var query = ($('search') && $('search').value ? $('search').value : '').trim().toLowerCase();
        var filter = ($('filter') && $('filter').value) || 'all';

        return state.keys.filter(function (key) {
            var status = statusOf(key);
            if (filter === 'active' && status.text !== 'Активен') return false;
            if (filter === 'revoked' && !key.revoked) return false;
            if (filter === 'expired' && status.text !== 'Истёк') return false;

            if (!query) return true;
            var haystack = (key.key + ' ' + (key.note || '') + ' ' + key.plan).toLowerCase();
            return haystack.indexOf(query) !== -1;
        });
    }

    function renderRows() {
        var body = $('rows');
        if (!body) return;
        body.replaceChildren();

        var list = visibleKeys();
        var countNode = $('count');
        if (countNode) {
            countNode.textContent = list.length === state.keys.length
                ? String(list.length)
                : list.length + ' из ' + state.keys.length;
        }
        var empty = $('empty');
        if (empty) empty.hidden = list.length > 0;

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
        row.title = expanded ? 'Свернуть' : 'Развернуть';

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
        untilCell.textContent = key.expiresAt ? fmtDateOnly(key.expiresAt) : 'Бессрочно';

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

        var left = document.createElement('div');
        var leftTitle = document.createElement('h4');
        leftTitle.textContent = 'Данные ключа';
        var list = document.createElement('dl');
        list.className = 'kv';

        kv(list, 'Ключ', key.key, true);
        kv(list, 'id', key.id);
        kv(list, 'План', key.plan);
        kv(list, 'Примечания', (key.features || []).join(', ') || '—');
        kv(list, 'Создан', fmtDate(key.created));
        kv(list, 'Действует до', key.expiresAt ? fmtDate(key.expiresAt) : 'Бессрочно');
        kv(list, 'Активируется', String(key.maxActivations));
        if (key.revoked) kv(list, 'Причина отзыва', key.revokedReason || '—');

        left.append(leftTitle, list);

        var right = document.createElement('div');
        var rightTitle = document.createElement('h4');
        rightTitle.textContent = 'История активаций';
        right.append(rightTitle);

        var devices = document.createElement('div');
        devices.className = 'devices';
        if (!key.activations || key.activations.length === 0) {
            var none = document.createElement('div');
            none.className = 'muted';
            none.textContent = 'Нет активированных устройств';
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
            bar.append(button('Восстановить', 'small', function () { restoreKey(key); }));
        } else {
            bar.append(button('Отозать', 'danger small', function () { revokeKey(key); }));
        }

        bar.append(button('Сбросить историю', 'ghost small', function () { resetKey(key); }));
        bar.append(button('Удалить', 'danger small', function () { deleteKey(key); }));
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

    /* ---------- accounts ---------- */

    function visibleAccounts() {
        var query = ($('accSearch') && $('accSearch').value ? $('accSearch').value : '').trim().toLowerCase();
        var filter = ($('accFilter') && $('accFilter').value) || 'all';
        var prefixFilter = ($('accPrefixFilter') && $('accPrefixFilter').value) || 'all';

        return state.accounts.filter(function (account) {
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
        if (!body) return;
        body.replaceChildren();

        var list = visibleAccounts();

        var accCount = $('accCount');
        if (accCount) {
            accCount.textContent = list.length === state.accounts.length
                ? state.accounts.length + ' аккаунтов'
                : list.length + ' из ' + state.accounts.length;
        }
        var accEmpty = $('accEmpty');
        if (accEmpty) accEmpty.hidden = list.length > 0;

        list.forEach(function (account) {
            var expanded = state.expandedAccounts.has(account.id);
            var row = document.createElement('tr');
            row.className = 'acc-row';
            row.title = expanded ? 'Свернуть' : 'Развернуть';
            row.addEventListener('click', function (event) {
                if (event.target.closest('button')) return;
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
            badge.textContent = account.blocked ? 'Заблокирован' : 'Активен';
            status.append(badge);

            var actions = document.createElement('td');
            actions.append(button(expanded ? 'Свернуть' : 'Развернуть', 'ghost small', function () {
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
        title.textContent = 'Аккаунт';
        var details = document.createElement('dl');
        details.className = 'kv';
        kv(details, 'Логин', account.username);
        kv(details, 'AnkaVisual ID', account.id, true);
        kv(details, 'Email', account.email || '—');
        kv(details, 'Создан', fmtDate(account.created));
        kv(details, 'Последний вход', fmtDate(account.lastLogin));
        kv(details, 'IP', account.lastIp || '—', true);
        kv(details, 'Сессий', String(account.sessions || 0));
        left.append(title, details);

        var right = document.createElement('div');
        var actionsTitle = document.createElement('h4');
        actionsTitle.textContent = 'Действия';
        var hint = document.createElement('p');
        hint.className = 'muted acc-detail';
        hint.textContent = account.blocked
            ? 'Аккаунт в бане: входы блокируются, выход сессий невозможен.'
            : 'Аккаунт в норме: можно выполнять действия.';

        var actions = document.createElement('div');
        actions.className = 'acc-actions';
        var impersonateButton = button('Войти как', 'small', function () { impersonateAccount(account); });
        if (account.blocked) impersonateButton.disabled = true;
        actions.append(impersonateButton);
        actions.append(button('Переименовать Логин', 'ghost small', function () { renameAccount(account); }));
        actions.append(button('Поменять AnkaVisual ID', 'ghost small', function () { changeAccountId(account); }));
        actions.append(button(
            account.blocked ? 'Разблокировать' : 'Заблокировать',
            account.blocked ? 'ghost small' : 'danger small',
            function () { toggleAccountBlock(account); }
        ));
        actions.append(button('Завершить сессии', 'ghost small', function () { logoutAccountSessions(account); }));
        actions.append(button('Сменить пароль', 'ghost small', function () { resetAccountPassword(account); }));
        actions.append(button('Удалить', 'danger small', function () { deleteAccount(account); }));
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
            toast(error.message || 'Не удалось изменить префикс.', true);
            if (error && error.status === 401) logout('Требуется admin-token для панели.');
        } finally {
            select.disabled = false;
        }
    }

    async function impersonateAccount(account) {
        if (account.blocked) {
            toast('Аккаунт в бане, вход недоступен.', true);
            return;
        }

        var win = window.open('about:blank', '_blank');
        if (!win) {
            toast('Не удалось открыть новое окно для входа.', true);
            return;
        }
        try { win.opener = null; } catch (ignored) { /* ignore */ }

        try {
            var data = await api('/api/admin/accounts', {
                method: 'POST',
                body: { id: account.id, action: 'impersonate' }
            });
            if (!data.url || !/^https?:\/\//.test(data.url)) {
                throw new Error('Не получен URL для входа в аккаунт');
            }
            var target = new URL(data.url);
            target.searchParams.set('_', String(Date.now()));
            win.location.replace(target.toString());
            toast('Вход выполнен в аккаунт ' + account.username);
        } catch (error) {
            try { win.close(); } catch (ignored) { /* ignore */ }
            toast(error.message || 'Не удалось выполнить вход.', true);
            if (error && error.status === 401) logout('Требуется admin-token для панели.');
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
            await load(true);
        } catch (error) {
            toast(error.message || 'Не удалось выполнить действие.', true);
            if (error && error.status === 401) logout('Требуется admin-token для панели.');
        }
    }

    async function renameAccount(account) {
        var values = await ask({
            title: 'Переименовать Логин',
            text: 'Новый ID должен быть длиной от 3 до 24 символов: a-z, 0-9, _ и -',
            fields: [
                {
                    name: 'username',
                    label: 'Новый Логин',
                    value: account.username,
                    placeholder: '3-24 символа: a-z, 0-9, _ и -'
                }
            ],
            ok: 'Переименовать'
        });
        if (!values) return;

        var username = String(values.username || '').trim().toLowerCase();
        if (username === account.username) {
            toast('Логин уже в таком виде');
            return;
        }
        if (!/^[a-z0-9_-]{3,24}$/.test(username)) {
            toast('Логин: 3-24 символа, только a-z, 0-9, _ и -', true);
            return;
        }

        await runAccountAction(account, 'username', { username: username }, 'Логин обновлён');
    }

    async function changeAccountId(account) {
        var values = await ask({
            title: 'Поменять AnkaVisual ID',
            text: 'ID должен быть длиной от 3 до 32 символов. Новый ID нужно подставить вручную: ' + account.id + '.',
            fields: [
                {
                    name: 'accountId',
                    label: 'Новый AnkaVisual ID',
                    value: account.id,
                    placeholder: '3-32 символа: A-Z, a-z, 0-9, _ и -'
                }
            ],
            ok: 'Поменять ID'
        });
        if (!values) return;

        var accountId = String(values.accountId || '').trim();
        if (accountId === account.id) {
            toast('AnkaVisual ID уже в таком виде');
            return;
        }
        if (!/^[A-Za-z0-9_-]{3,32}$/.test(accountId)) {
            toast('ID: 3-32 символа, только A-Z, a-z, 0-9, _ и -', true);
            return;
        }

        await runAccountAction(account, 'account-id', { accountId: accountId }, 'AnkaVisual ID обновлён');
    }

    async function toggleAccountBlock(account) {
        var block = !account.blocked;
        var ok = await ask({
            title: block ? 'Заблокировать аккаунт?' : 'Разблокировать аккаунт?',
            text: block
                ? 'Аккаунт ' + account.username + ' будет недоступен для входа. Сессии не будут завершены автоматически.'
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
            toast('У аккаунта нет сессий', true);
            return;
        }
        var ok = await ask({
            title: 'Завершить сессии?',
            text: 'Все устройства, где был вход от аккаунта ' + account.username + ', будут закрыты.',
            ok: 'Завершить',
            danger: true
        });
        if (!ok) return;
        await runAccountAction(account, 'logout', {}, 'Сессии завершены');
    }

    async function resetAccountPassword(account) {
        var values = await ask({
            title: 'Сменить пароль',
            text: 'Новый пароль должен быть длиной не менее 8 символов. Пароль будет отправлен на email аккаунта.',
            fields: [
                {
                    name: 'password',
                    label: 'Новый пароль',
                    type: 'password',
                    placeholder: 'не менее 8 символов'
                }
            ],
            ok: 'Сменить пароль',
            danger: true
        });
        if (!values) return;
        var password = String(values.password || '');
        if (password.length < 8) {
            toast('Пароль должен быть длиной не менее 8 символов', true);
            return;
        }
        await runAccountAction(account, 'password', { password: password }, 'Пароль обновлён');
    }

    async function deleteAccount(account) {
        var values = await ask({
            title: 'Удалить аккаунт?',
            text: 'Аккаунт ' + account.username + ' и все связанные данные будут безвозвратно удалены. Действие нельзя отменить.',
            ok: 'Удалить',
            danger: true
        });
        if (!values) return;
        await runAccountAction(account, 'delete', {}, 'Аккаунт удалён');
    }

    /* ---------- log ---------- */

    function renderLog() {
        var list = $('log');
        var sideList = $('logSide');
        var logCount = $('logCount');
        var entries = state.log || [];
        var limit = 100;

        [list, sideList].forEach(function (node) {
            if (!node) return;
            node.replaceChildren();
            if (entries.length === 0) {
                var empty = document.createElement('li');
                empty.className = 'muted';
                empty.textContent = 'Нет записей';
                node.append(empty);
                return;
            }
            entries.slice(0, limit).forEach(function (entry) {
                var item = document.createElement('li');

                var when = document.createElement('span');
                when.className = 'when';
                when.textContent = fmtShort(entry.t || entry.createdAt);

                var what = document.createElement('span');
                what.className = 'what';
                what.textContent = (EVENTS[entry.event] || entry.event || '?') + (entry.keyMasked ? ' · ' + entry.keyMasked : '');

                item.append(when, what);

                var extra = [entry.hwid, entry.note].filter(function (value) { return value; }).join(' · ');
                if (extra) {
                    var who = document.createElement('span');
                    who.className = 'who';
                    who.textContent = extra;
                    item.append(who);
                }

                node.append(item);
            });
        });

        if (logCount) logCount.textContent = 'показано ' + Math.min(entries.length, limit);
    }

    /* ---------- toast ---------- */

    var toastTimer = null;

    function toast(message, bad) {
        var element = $('toast');
        if (!element) return;
        element.textContent = message;
        element.className = 'toast' + (bad ? ' bad' : '');
        element.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { element.hidden = true; }, 3200);
    }

    /* ---------- key actions ---------- */

    async function run(action, successMessage) {
        try {
            await action();
            toast(successMessage);
            await load(true);
        } catch (error) {
            toast(error.message || 'Ошибка выполнения действия.', true);
            if (error && error.status === 401) logout('Требуется admin-token для панели.');
        }
    }

    function extendKey(key) {
        ask({
            title: 'Продлить ключ',
            text: key.key,
            ok: 'Продлить',
            fields: [{ name: 'days', label: 'На сколько дней продлить', type: 'number', value: 30, min: 1 }]
        }).then(function (values) {
            if (!values) return;
            run(function () {
                return api('/api/admin/extend', {
                    method: 'POST',
                    body: { key: key.key, days: values.days }
                });
            }, 'Ключ продлён на ' + values.days + ' дней');
        });
    }

    function revokeKey(key) {
        ask({
            title: 'Отозать ключ?',
            text: 'Ключ будет отозван. Активные сессии не будут работать.',
            ok: 'Отозать',
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
            title: 'Восстановить ключ?',
            text: 'Ключ будет восстановлен и снова активен.',
            ok: 'Восстановить'
        }).then(function (values) {
            if (!values) return;
            run(function () {
                return api('/api/admin/restore', {
                    method: 'POST',
                    body: { key: key.key }
                });
            }, 'Ключ восстановлен');
        });
    }

    function resetKey(key) {
        ask({
            title: 'Сбросить историю?',
            text: 'История активаций будет очищена. Это не отзывает сам ключ.',
            ok: 'Сбросить',
            fields: [{
                name: 'history',
                label: 'Очистить историю активаций',
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
            }, 'История сброшена');
        });
    }

    function deleteKey(key) {
        ask({
            title: 'Удалить ключ?',
            text: 'Ключ будет безвозвратно удалён вместе со связанной историей.',
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
            toast(ok ? 'Ключ скопирован' : 'Не удалось скопировать ключ', !ok);
        }

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(function () { toast('Ключ скопирован'); })
                .catch(fallback);
        } else {
            fallback();
        }
    }

    /* ---------- modal ---------- */

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

    /* ---------- tabs / views ---------- */

    function setAdminTab(name) {
        state.adminTab = name;

        Object.keys(VIEWS).forEach(function (key) {
            var node = VIEWS[key];
            if (node) node.hidden = state.adminTab !== key;
        });

        Array.prototype.forEach.call(document.querySelectorAll('[data-admin-tab]'), function (tab) {
            tab.classList.toggle('on', tab.getAttribute('data-admin-tab') === state.adminTab);
        });

        renderStats();
        if (state.adminTab === 'keys') renderRows();
        else if (state.adminTab === 'accounts') renderAccounts();
        else if (state.adminTab === 'log') renderLog();
    }

    function setDotOnline() {
        var dot = $('dot');
        if (dot) {
            dot.className = 'dot online';
            dot.title = 'онлайн';
        }
    }

    function showApp() {
        var login = $('login');
        var app = $('app');
        if (login) login.hidden = true;
        if (app) app.hidden = false;
        var refresh = $('refresh');
        var logout = $('logout');
        if (refresh) refresh.hidden = false;
        if (logout) logout.hidden = false;
        var dot = $('dot');
        if (dot) {
            dot.className = 'dot online';
            dot.title = 'онлайн';
        }
        setAdminTab(state.adminTab);
    }

    function showLogin(message) {
        var login = $('login');
        var app = $('app');
        if (login) login.hidden = false;
        if (app) app.hidden = true;
        var refresh = $('refresh');
        var logout = $('logout');
        if (refresh) refresh.hidden = true;
        if (logout) logout.hidden = true;
        var dot = $('dot');
        if (dot) {
            dot.className = 'dot offline';
            dot.title = 'нет связи';
        }
        var loginError = $('loginError');
        if (loginError) {
            loginError.hidden = !message;
            loginError.textContent = message || '';
        }
        var token = $('token');
        if (token) token.focus();
    }

    function logout(message) {
        state.token = '';
        state.keys = [];
        state.accounts = [];
        state.stats = {};
        state.log = [];
        state.expanded = new Set();
        state.expandedAccounts = new Set();
        state.adminTab = 'overview';
        clearInterval(state.timer);
        state.timer = null;
        try { sessionStorage.removeItem('ag-token'); } catch (ignored) { /* ignore */ }
        showLogin(message);
    }

    function startTimer() {
        clearInterval(state.timer);
        state.timer = setInterval(function () {
            if (document.visibilityState !== 'visible') return;
            if (state.token) load();
        }, 15000);
    }

    async function start(token) {
        state.token = token;
        try {
            await load(true);
            if (state.token !== token) return;
            try { sessionStorage.setItem('ag-token', token); } catch (ignored) { /* ignore */ }
            showApp();
            startTimer();
        } catch (error) {
            state.token = '';
            try { sessionStorage.removeItem('ag-token'); } catch (ignored) { /* ignore */ }
            showLogin(error && error.status === 401
                ? 'Неверный admin-token.'
                : (error && error.status === 429
                    ? 'Слишком много попыток. Подождите немного и попробуйте снова.'
                    : (error && error.message || 'Ошибка входа.')));
        }
    }

    /* ---------- events ---------- */

    $('loginForm').addEventListener('submit', function (event) {
        event.preventDefault();
        var token = ($('token') && $('token').value ? $('token').value : '').trim();
        if (!token) return;
        start(token);
    });

    $('logout').addEventListener('click', function () {
        logout();
    });

    $('refresh').addEventListener('click', function () {
        load(true).catch(function (error) {
            toast(error && error.message || 'Ошибка загрузки данных.', true);
            if (error && error.status === 401) logout('Требуется admin-token для панели.');
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
            plan: ($('cPlan') && $('cPlan').value ? $('cPlan').value : '').trim() || 'pro',
            activations: Number($('cAct').value) || 1,
            note: ($('cNote') && $('cNote').value ? $('cNote').value : '').trim()
        };

        try {
            var result = await api('/api/admin/keys', { method: 'POST', body: body });
            var lines = (result.keys || []).map(function (key) { return key.key; });
            var created = $('created');
            if (created) {
                created.textContent = lines.join('\n');
                created.hidden = lines.length === 0;
            }
            toast('Ключи созданы: ' + lines.length);
            var cNote = $('cNote');
            if (cNote) cNote.value = '';
            await load(true);
        } catch (error) {
            toast(error && error.message || 'Не удалось создать ключи.', true);
            if (error && error.status === 401) logout('Требуется admin-token для панели.');
        }
    });

    var saved = '';
    try { saved = sessionStorage.getItem('ag-token') || ''; } catch (ignored) { /* ignore */ }
    if (saved) start(saved);
    else showLogin('');
})();
