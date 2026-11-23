(function () {
  'use strict';
  var API = window.ANKA_API_BASE || 'https://ankaguard.ankavisual.workers.dev';
  var grid = document.getElementById('shopGrid');
  var status = document.getElementById('shopStatus');
  var search = document.getElementById('shopSearch');
  var filters = document.getElementById('shopFilters');
  var activeFilter = 'all';
  var items = [];

  var fallback = [
    { id:'pvp-legit', name:'Legit PvP', author:'AnkaVisual', price:0, category:'pvp', tags:['pvp','legit','1.21'], description:'Аккуратный конфиг для легит PvP: визуал, удобный HUD и безопасные настройки.', code:'ANKA-PVP1' },
    { id:'visual-clean', name:'Clean Visual', author:'AnkaVisual', price:0, category:'visual', tags:['visual','clean'], description:'Чистый визуал без лишнего шума. Подходит для скриншотов и обычной игры.', code:'ANKA-VIS1' },
    { id:'utility-base', name:'Utility Base', author:'AnkaVisual', price:0, category:'utility', tags:['utility','hud'], description:'Базовый конфиг с полезными утилитами и аккуратным интерфейсом.', code:'ANKA-UTL1' }
  ];

  function esc(s) { return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function fmtPrice(p) { p = Number(p||0); return p > 0 ? p + ' ₽' : 'Бесплатно'; }

  function card(item) {
    var free = Number(item.price||0) <= 0;
    var tags = (item.tags||[]).slice(0,4).map(function(t){ return '<span class="shop-tag">'+esc(t)+'</span>'; }).join('');
    var code = item.code ? String(item.code) : '';
    var action = code
      ? '<button class="shop-btn primary" data-copy="'+esc(code)+'">Скопировать код</button>'
      : '<a class="shop-btn primary" href="../account/">Получить</a>';
    return '<article class="shop-card" data-category="'+esc(item.category||'all')+'" data-free="'+(free?'1':'0')+'">'+
      '<div class="shop-card-top"><h3>'+esc(item.name||'Config')+'</h3><span class="shop-badge '+(free?'is-free':'')+'">'+esc(fmtPrice(item.price))+'</span></div>'+
      '<div class="shop-meta"><span>by '+esc(item.author||'community')+'</span>'+ (item.updated?'<span>'+esc(item.updated)+'</span>':'') +'</div>'+
      '<p class="shop-desc">'+esc(item.description||'Конфиг для AnkaVisual.')+'</p>'+
      '<div class="shop-tags">'+tags+'</div>'+
      '<div class="shop-actions">'+action+(item.url?'<a class="shop-btn" href="'+esc(item.url)+'" target="_blank" rel="noopener">Подробнее</a>':'')+'</div>'+
    '</article>';
  }

  function matches(item) {
    var q = (search.value||'').toLowerCase().trim();
    var cat = (item.category||'').toLowerCase();
    var free = Number(item.price||0) <= 0;
    if (activeFilter === 'free' && !free) return false;
    if (activeFilter !== 'all' && activeFilter !== 'free' && cat !== activeFilter) return false;
    if (!q) return true;
    var hay = [item.name,item.author,item.description,cat].concat(item.tags||[]).join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function render() {
    var list = items.filter(matches);
    grid.innerHTML = list.map(card).join('');
    status.textContent = list.length ? ('Показано конфигов: ' + list.length) : 'Ничего не найдено. Попробуй другой фильтр или запрос.';
  }

  function load() {
    status.textContent = 'Загрузка конфигов...';
    fetch(API + '/api/shop/configs', { headers: { 'Accept': 'application/json' }, cache: 'no-store' })
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(data){
        var list = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : (Array.isArray(data.configs) ? data.configs : []));
        items = list.length ? list : fallback;
        status.textContent = list.length ? '' : 'Показаны базовые конфиги. Подключение магазина к серверу появится после включения API.';
        render();
      })
      .catch(function(){
        items = fallback;
        status.textContent = 'Показаны базовые конфиги. Подключение магазина к серверу появится после включения API.';
        render();
      });
  }

  grid.addEventListener('click', function(e){
    var btn = e.target.closest('[data-copy]');
    if (!btn) return;
    var code = btn.getAttribute('data-copy') || '';
    if (!code) return;
    function done(){ var old=btn.textContent; btn.textContent='Скопировано'; setTimeout(function(){ btn.textContent=old; }, 1400); }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(code).then(done).catch(done); }
    else { var t=document.createElement('textarea'); t.value=code; document.body.appendChild(t); t.select(); try{document.execCommand('copy');}catch(_){} document.body.removeChild(t); done(); }
  });

  search.addEventListener('input', render);
  filters.addEventListener('click', function(e){
    var b = e.target.closest('[data-filter]'); if(!b) return;
    activeFilter = b.getAttribute('data-filter') || 'all';
    filters.querySelectorAll('.shop-filter').forEach(function(x){ x.classList.toggle('is-active', x===b); });
    render();
  });

  load();
})();
