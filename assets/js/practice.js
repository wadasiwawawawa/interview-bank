/* 練習模式（CLAUDE.md 第 9 節）
   - 卡片來源：practice.html 用 Liquid 輸出的 .fc（含整張題目卡內文），這裡只保留「快速回答」。
   - 操作：點一下翻面；右滑＝熟了、左滑＝還不熟（下一輪再出現）；鍵盤空白鍵／←／→；三個按鈕。
   - 進度：localStorage（key 見 KEY），讀寫失敗時照常運作，只是不記進度。
   - 不使用任何外部函式庫，滑動用 Pointer Events。 */
(function () {
  'use strict';

  var KEY = 'interview-bank:practice:v1';
  var QUICK_HEADING = '快速回答';
  var SWIPE_RATIO = 0.3;      // 拖超過卡片寬度 30% 就算數
  var FLICK_SPEED = 0.6;      // 或快速甩動（px/ms）
  var TAP_SLOP = 10;          // 移動不到 10px 算點一下

  var root = document.getElementById('practice');
  if (!root) return;

  function $(id) { return document.getElementById(id); }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 儲存 ---------- */
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var d = raw ? JSON.parse(raw) : null;
      if (d && typeof d === 'object') {
        return { mastered: d.mastered || {}, session: d.session || null };
      }
    } catch (e) { /* 讀不到就從頭開始 */ }
    return { mastered: {}, session: null };
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 無法儲存時照常運作 */ }
  }
  var store = load();

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* ---------- 讀取卡片 ---------- */
  var cards = {};
  var allIds = [];
  var missingQuick = 0;

  function extractSection(container, heading) {
    var start = null;
    var kids = container.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].tagName === 'H2' && kids[i].textContent.trim() === heading) { start = kids[i]; break; }
    }
    if (!start) return null;
    var frag = document.createDocumentFragment();
    var n = start.nextElementSibling;
    while (n && n.tagName !== 'H2') {
      var next = n.nextElementSibling;
      frag.appendChild(n);
      n = next;
    }
    return frag.childNodes.length ? frag : null;
  }

  Array.prototype.forEach.call(document.querySelectorAll('#pr-source .fc'), function (el) {
    var ans = el.querySelector('.fc-answer');
    var quick = ans && extractSection(ans, QUICK_HEADING);
    if (!quick) { missingQuick++; return; }
    ans.innerHTML = '';
    ans.appendChild(quick);
    var id = el.getAttribute('data-id');
    cards[id] = {
      el: el,
      category: el.getAttribute('data-category'),
      status: el.getAttribute('data-status'),
      updated: el.getAttribute('data-updated') || ''
    };
    allIds.push(id);
  });

  function isMastered(id) {
    var m = store.mastered[id];
    return !!m && !!cards[id] && m >= cards[id].updated;
  }

  /* ---------- 設定畫面 ---------- */
  var form = $('pr-form');

  function readFilters() {
    function vals(name) {
      return Array.prototype.map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; });
    }
    return { cats: vals('cat'), statuses: vals('status'), scope: (vals('scope')[0] || 'unmastered') };
  }
  function writeFilters(f) {
    if (!f) return;
    Array.prototype.forEach.call(form.querySelectorAll('input'), function (i) {
      if (i.name === 'cat' && f.cats) i.checked = f.cats.indexOf(i.value) !== -1;
      if (i.name === 'status' && f.statuses) i.checked = f.statuses.indexOf(i.value) !== -1;
      if (i.name === 'scope' && f.scope) i.checked = i.value === f.scope;
    });
  }
  function pool(f) {
    return allIds.filter(function (id) {
      var c = cards[id];
      if (f.cats.indexOf(c.category) === -1) return false;
      if (f.statuses.indexOf(c.status) === -1) return false;
      if (f.scope === 'unmastered' && isMastered(id)) return false;
      return true;
    });
  }

  function refreshSetup() {
    var f = readFilters();
    var n = pool(f).length;
    var masteredCount = allIds.filter(isMastered).length;
    $('pr-count').textContent = '符合條件：' + n + ' 張' + (masteredCount ? '（已經熟了 ' + masteredCount + ' 張）' : '');
    $('pr-start').disabled = n === 0;
    var miss = $('pr-missing');
    miss.hidden = missingQuick === 0;
    miss.textContent = '有 ' + missingQuick + ' 題缺少「快速回答」段落，不會出現在練習中。';

    var s = validSession();
    $('pr-resume').hidden = !s;
    if (s) {
      $('pr-resume-text').textContent = '有一次還沒練完的練習：第 ' + s.round + ' 輪，這輪還剩 ' + s.queue.length + ' 張。';
    }
  }

  function validSession() {
    var s = store.session;
    if (!s || !Array.isArray(s.queue) || !Array.isArray(s.next)) return null;
    s.queue = s.queue.filter(function (id) { return cards[id]; });
    s.next = s.next.filter(function (id) { return cards[id]; });
    if (!s.queue.length && !s.next.length) return null;
    return s;
  }

  form.addEventListener('change', refreshSetup);

  /* ---------- 畫面切換 ---------- */
  var screens = ['pr-setup', 'pr-deck', 'pr-summary', 'pr-done'];
  function show(name) {
    screens.forEach(function (id) { $(id).hidden = id !== name; });
    var focusTarget = { 'pr-setup': 'pr-setup-title', 'pr-summary': 'pr-summary-title', 'pr-done': 'pr-done-title' }[name];
    if (focusTarget) $(focusTarget).focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  /* ---------- 練習流程 ---------- */
  var s = null;          // 目前的練習
  var current = null;    // 目前顯示的卡片元素
  var busy = false;      // 卡片滑出動畫中

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function startNew(filters) {
    var ids = pool(filters);
    if (!ids.length) return;
    s = { round: 1, queue: shuffle(ids), next: [], total: ids.length, firstTotal: ids.length, ok: 0, filters: filters };
    store.session = s;
    save();
    show('pr-deck');
    render();
  }

  function resume() {
    s = validSession();
    if (!s) { refreshSetup(); return; }
    if (!s.queue.length) { endRound(); return; }
    show('pr-deck');
    render();
  }

  function render() {
    var stage = $('fc-stage');
    stage.innerHTML = '';
    current = null;
    if (!s.queue.length) { endRound(); return; }
    var id = s.queue[0];
    var el = cards[id].el.cloneNode(true);
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-roledescription', '單字卡');
    setFaces(el, false);
    stage.appendChild(el);
    stage.classList.toggle('has-more', s.queue.length > 1);
    current = el;
    bindDrag(el);
    var done = s.total - s.queue.length;
    $('pr-progress').textContent = '第 ' + s.round + ' 輪・剩 ' + s.queue.length + ' / ' + s.total + ' 張';
    $('pr-bar-fill').style.width = (s.total ? (done / s.total) * 100 : 0) + '%';
    el.focus({ preventScroll: true });
  }

  function setFaces(el, flipped) {
    el.classList.toggle('is-flipped', flipped);
    el.querySelector('.fc-front').setAttribute('aria-hidden', flipped ? 'true' : 'false');
    el.querySelector('.fc-back').setAttribute('aria-hidden', flipped ? 'false' : 'true');
    var more = el.querySelector('.fc-more');
    if (more) more.tabIndex = flipped ? 0 : -1;
  }

  function flip() {
    if (!current || busy) return;
    setFaces(current, !current.classList.contains('is-flipped'));
  }

  function decide(dir) {
    if (!current || busy) return;
    busy = true;
    var el = current;
    var w = window.innerWidth;
    var sign = dir === 'ok' ? 1 : -1;
    el.style.setProperty('--p-ok', dir === 'ok' ? 1 : 0);
    el.style.setProperty('--p-again', dir === 'ok' ? 0 : 1);

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      var id = s.queue.shift();
      if (dir === 'ok') {
        store.mastered[id] = today();
        s.ok++;
      } else {
        delete store.mastered[id];
        s.next.push(id);
      }
      store.session = s;
      save();
      busy = false;
      render();
    }

    if (reduceMotion) { finish(); return; }
    el.classList.remove('is-dragging');
    el.classList.add('is-leaving');
    el.style.transform = 'translateX(' + (sign * w * 1.1) + 'px) rotate(' + (sign * 18) + 'deg)';
    el.addEventListener('transitionend', function (e) { if (e.target === el) finish(); });
    setTimeout(finish, 450);
  }

  function endRound() {
    if (!s.next.length) {
      var rounds = s.round;
      var size = s.firstTotal || s.total;
      store.session = null;
      save();
      $('pr-done-text').textContent = '練了 ' + rounds + ' 輪，這次的 ' + size + ' 張都熟了。';
      show('pr-done');
      return;
    }
    $('pr-summary-title').textContent = '第 ' + s.round + ' 輪結束';
    $('pr-summary-text').textContent = '熟了 ' + s.ok + ' 張，還不熟 ' + s.next.length + ' 張。下一輪只練還不熟的。';
    store.session = s;
    save();
    show('pr-summary');
  }

  function nextRound() {
    s.round++;
    s.queue = shuffle(s.next);
    s.next = [];
    s.total = s.queue.length;
    s.ok = 0;
    store.session = s;
    save();
    show('pr-deck');
    render();
  }

  /* ---------- 拖曳／點擊 ---------- */
  function setDrag(el, x) {
    var w = el.offsetWidth || 1;
    var rot = Math.max(-15, Math.min(15, (x / w) * 20));
    el.style.transform = x ? 'translateX(' + x + 'px) rotate(' + rot + 'deg)' : '';
    var p = Math.min(1, Math.abs(x) / (w * SWIPE_RATIO));
    el.style.setProperty('--p-ok', x > 0 ? p : 0);
    el.style.setProperty('--p-again', x < 0 ? p : 0);
  }

  function bindDrag(el) {
    var pid = null, sx = 0, sy = 0, st = 0, dx = 0, dragging = false, moved = false;

    el.addEventListener('pointerdown', function (e) {
      if (busy || (e.pointerType === 'mouse' && e.button !== 0)) return;
      pid = e.pointerId; sx = e.clientX; sy = e.clientY; st = Date.now();
      dx = 0; dragging = false; moved = false;
    });

    el.addEventListener('pointermove', function (e) {
      if (e.pointerId !== pid) return;
      dx = e.clientX - sx;
      var dy = e.clientY - sy;
      if (!dragging) {
        if (Math.abs(dx) > TAP_SLOP && Math.abs(dx) > Math.abs(dy)) {
          dragging = true; moved = true;
          try { el.setPointerCapture(pid); } catch (err) { /* 舊瀏覽器 */ }
          el.classList.add('is-dragging');
        } else if (Math.abs(dy) > TAP_SLOP) {
          moved = true; pid = null;   // 上下捲動背面，交給瀏覽器
          return;
        } else {
          return;
        }
      }
      setDrag(el, dx);
    });

    el.addEventListener('pointerup', function (e) {
      if (e.pointerId !== pid) return;
      pid = null;
      if (dragging) {
        dragging = false;
        var speed = Math.abs(dx) / Math.max(1, Date.now() - st);
        if (Math.abs(dx) > el.offsetWidth * SWIPE_RATIO || (speed > FLICK_SPEED && Math.abs(dx) > 40)) {
          decide(dx > 0 ? 'ok' : 'again');
        } else {
          el.classList.remove('is-dragging');
          setDrag(el, 0);
        }
        return;
      }
      if (!moved && !e.target.closest('a')) flip();
    });

    el.addEventListener('pointercancel', function (e) {
      if (e.pointerId !== pid) return;
      pid = null;
      if (dragging) { dragging = false; el.classList.remove('is-dragging'); setDrag(el, 0); }
    });

    // 拖曳時不要觸發背面連結
    el.addEventListener('click', function (e) {
      if (moved && e.target.closest('a')) e.preventDefault();
    });
  }

  /* ---------- 按鈕與鍵盤 ---------- */
  $('pr-deck').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'flip') flip(); else decide(act);
  });

  document.addEventListener('keydown', function (e) {
    if ($('pr-deck').hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); decide('ok'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); decide('again'); }
    else if ((e.key === ' ' || e.key === 'Enter') && tag !== 'BUTTON' && tag !== 'A') { e.preventDefault(); flip(); }
  });

  $('pr-start').addEventListener('click', function () { startNew(readFilters()); });
  $('pr-resume-btn').addEventListener('click', resume);
  $('pr-next').addEventListener('click', nextRound);
  $('pr-again-all').addEventListener('click', function () {
    var f = (s && s.filters) || readFilters();
    startNew({ cats: f.cats, statuses: f.statuses, scope: 'all' });
  });

  function backToSetup() {
    if (s && s.filters) writeFilters(s.filters);
    refreshSetup();
    show('pr-setup');
  }
  $('pr-exit').addEventListener('click', backToSetup);
  $('pr-summary-exit').addEventListener('click', backToSetup);
  $('pr-done-exit').addEventListener('click', backToSetup);

  $('pr-reset').addEventListener('click', function () {
    if (!window.confirm('確定要清除所有練習進度嗎？「熟了」的紀錄和還沒練完的練習都會刪除。')) return;
    store = { mastered: {}, session: null };
    s = null;
    save();
    refreshSetup();
  });

  /* ---------- 初始化 ---------- */
  if (store.session && store.session.filters) writeFilters(store.session.filters);
  refreshSetup();
})();
