/* AnkaVisual — страховка интро: если заголовок не успел собраться, показываем страницу. */
(function () {
  var d = document.documentElement;
  d.classList.add('intro');
  setTimeout(function () {
    if (!d.classList.contains('ht-ready')) {
      d.classList.add('app-ready');
      d.classList.remove('intro');
    }
  }, 4000);
})();
