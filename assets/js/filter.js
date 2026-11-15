/* 題目列表頁的題型篩選（CLAUDE.md 8.4）
   篩選狀態寫在網址 hash，例如 /questions/#behavioral。沒有 JS 時，按鈕就是頁內錨點。 */
(function () {
  'use strict';
  var bar = document.querySelector('[data-filter-bar]');
  if (!bar) return;
  var buttons = bar.querySelectorAll('[data-filter]');
  var sections = document.querySelectorAll('[data-cat-section]');
  var codes = Array.prototype.map.call(sections, function (s) { return s.getAttribute('data-cat-section'); });

  function apply() {
    var code = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (codes.indexOf(code) === -1) code = '';
    Array.prototype.forEach.call(buttons, function (b) {
      b.setAttribute('aria-current', b.getAttribute('data-filter') === code ? 'true' : 'false');
    });
    Array.prototype.forEach.call(sections, function (s) {
      s.hidden = code !== '' && s.getAttribute('data-cat-section') !== code;
    });
  }

  bar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (!b) return;
    e.preventDefault();
    var code = b.getAttribute('data-filter');
    var url = location.pathname + location.search + (code ? '#' + code : '');
    history.replaceState(null, '', url);
    apply();
  });
  window.addEventListener('hashchange', apply);
  apply();
})();
