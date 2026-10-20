/* AnkaVisual — лендинг. Появление секций при прокрутке. */
(function () {
  'use strict';

  var items = document.querySelectorAll('.rise');
  if (!items.length) return;

  // без IntersectionObserver просто показываем всё
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

  items.forEach(function (el) { io.observe(el); });
})();
