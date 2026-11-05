/* AnkaVisual — лендинг: интро заголовка, шапка, появление блоков, FAQ. */
(() => {
  'use strict';

  const root = document.documentElement;
  const title = document.getElementById('heroTitle');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- шапка ---------- */
  const header = document.querySelector('.site-header');
  const onScroll = () => {
    if (header) header.classList.toggle('scrolled', window.scrollY > 12);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- появление при прокрутке ---------- */
  let revealsStarted = false;
  const startReveals = () => {
    if (revealsStarted) return;
    revealsStarted = true;

    const reveals = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      for (const el of reveals) el.classList.add('in');
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    for (const el of reveals) io.observe(el);
  };

  /* ---------- интро: заголовок собирается по буквам ---------- */
  const splitTitle = (el) => {
    let index = 0;
    const words = [];

    const build = (parent) => {
      const frag = document.createDocumentFragment();
      for (const node of Array.from(parent.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          for (const chunk of node.data.split(/(\s+)/)) {
            if (!chunk) continue;
            if (/^\s+$/.test(chunk)) {
              frag.appendChild(document.createTextNode(' '));
              continue;
            }
            const word = document.createElement('span');
            word.className = 'ht-word';
            for (const ch of Array.from(chunk)) {
              const span = document.createElement('span');
              span.className = 'ht-ch';
              span.style.setProperty('--i', index++);
              span.textContent = ch;
              word.appendChild(span);
            }
            frag.appendChild(word);
            words.push(chunk);
          }
        } else if (node.nodeName === 'BR') {
          frag.appendChild(document.createElement('br'));
        }
      }
      return frag;
    };

    const fragment = build(el);
    el.setAttribute('aria-label', words.join(' '));
    el.replaceChildren(fragment);
    return { chars: index, words: words.length };
  };

  let introRunning = false;
  const skipIntro = () => {
    root.classList.add('app-ready');
    root.classList.remove('intro');
    startReveals();
  };

  if (title && !reduced && !window.location.hash) {
    const info = splitTitle(title);
    if (info.words > 1) {
      title.classList.add('ht-ready');

      const begin = () => {
        const mobile = window.innerWidth < 760;
        const step = mobile ? 0.02 : 0.026;
        const start = mobile ? 0.1 : 0.12;
        const last = start + Math.max(0, info.chars - 1) * step;
        const revealAt = (last + 0.55) * 1000;
        const endAt = revealAt + 900;

        window.setTimeout(() => root.classList.add('app-ready'), revealAt);
        window.setTimeout(startReveals, revealAt + 40);
        window.setTimeout(() => root.classList.remove('intro'), endAt);
        window.setTimeout(() => {
          root.classList.add('app-ready');
          root.classList.remove('intro');
          startReveals();
        }, endAt + 3200);
      };

      /* браузер может восстановить прокрутку после загрузки — тогда интро не нужно */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (window.scrollY > 20) { skipIntro(); return; }
        introRunning = true;
        begin();
      }));
    } else {
      skipIntro();
    }
  } else {
    skipIntro();
  }

  /* ---------- FAQ ---------- */
  for (const item of document.querySelectorAll('.faq-item')) {
    const button = item.querySelector('.faq-q');
    if (!button) continue;
    button.addEventListener('click', () => {
      const open = item.classList.toggle('open');
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
