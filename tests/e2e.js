/* E2E helpers (HANDOFF §12 L3): seed IndexedDB, load the real app in a
   375 × 812 frame, then inspect its DOM. The API is never reached: the fake
   setup code points at a script that doesn't exist, and fetch is stubbed. */
(function () {
  'use strict';
  var E2E = window.E2E = {};
  var FAKE_SETUP = { env: 'staging', apiUrl: 'https://script.google.com/macros/s/AKfakeE2E/exec', token: 'e'.repeat(40) };

  E2E.clearWorkers = function () {
    var regs = navigator.serviceWorker ? navigator.serviceWorker.getRegistrations() : Promise.resolve([]);
    return regs.then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); })
      .then(function () { return caches.keys(); })
      .then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); });
  };

  E2E.snapshot = function (mutate) {
    var raw = FIXTURES.sheet();
    raw.Settings.values.push(['Allergen words', '[allergen words from the sheet]']);
    if (mutate) mutate(raw);
    var p = BT.parse.snapshot(raw);
    return { rev: 'e2e', env: 'staging', serverVersion: '0.1.0', generatedAt: '2026-10-15T00:00:00Z',
      receivedAt: new Date().toISOString(), data: p.data, issues: p.issues, staleTabs: [] };
  };

  // opts: { setup: bool (default true), owner, jst: 'YYYY-MM-DDTHH:MM' | pt: ..., snapshot, hash }
  function blankFrame() {
    var frame = document.getElementById('app');
    return new Promise(function (resolve) { frame.onload = function () { resolve(); }; frame.src = 'about:blank'; });
  }

  E2E.seed = function (opts) {
    opts = opts || {};
    // The app's pointer is keyed by its own path (/app/), not this page's.
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('brillo.env') === 0) localStorage.removeItem(k); }); } catch (e) { /* ignore */ }
    return blankFrame().then(function () { return BT.store.deleteDb('staging'); }).then(function () { return BT.store.open('staging'); }).then(function (db) {
      var jobs = [];
      if (opts.setup !== false) jobs.push(db.put('prefs', 'setup', FAKE_SETUP));
      if (opts.owner) jobs.push(db.put('prefs', 'owner', opts.owner));
      var when = opts.jst ? [opts.jst, 'Asia/Tokyo'] : opts.pt ? [opts.pt, 'America/Los_Angeles'] : null;
      if (when) {
        var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(when[0]);
        var at = BT.time.zonedToInstant(m[1], m[2], when[1]);
        jobs.push(db.put('prefs', 'simulate', { offsetMs: at.getTime() - Date.now(), inputValue: when[0], label: when[0] }));
      }
      if (opts.snapshot !== null) jobs.push(db.put('snapshot', 'current', opts.snapshot || E2E.snapshot()));
      return Promise.all(jobs).then(function () { db.close(); });
    });
  };

  // Load the app; resolves with the frame's window once the screen has rendered.
  E2E.load = function (hash) {
    var frame = document.getElementById('app');
    var t0 = performance.now();
    return new Promise(function (resolve, reject) {
      frame.onload = function () {
        var w = frame.contentWindow;
        // Stub the network before the first sync can reach it.
        if (w.BT && w.BT.api) w.BT.api.fetch = function () { return Promise.reject(new TypeError('offline (stub)')); };
        var tries = 0;
        (function wait() {
          var main = w.document.getElementById('main');
          if (main) { E2E.renderMs = performance.now() - t0; resolve(w); return; }
          if (++tries > 100) { reject(new Error('app never rendered')); return; }
          setTimeout(wait, 20);
        })();
      };
      frame.src = '../index.html?e2e=' + Date.now() + (hash || '#/today');
    });
  };

  E2E.text = function (w) { return w.document.getElementById('app').innerText; };
  E2E.go = function (w, hash) {
    return new Promise(function (resolve) { w.location.hash = hash; setTimeout(function () { resolve(w); }, 60); });
  };
  E2E.click = function (w, selector) {
    var el = w.document.querySelector(selector);
    if (!el) throw new Error('no element ' + selector);
    el.click();
    return new Promise(function (resolve) { setTimeout(function () { resolve(w); }, 60); });
  };

  // Layout checks for every screen (HANDOFF §12 L3).
  E2E.noHorizontalScroll = function (w) {
    var d = w.document.documentElement;
    if (d.scrollWidth > w.innerWidth) throw new Error('horizontal scroll: ' + d.scrollWidth + ' > ' + w.innerWidth);
  };
  E2E.minFont = function (w, min) {
    var bad = [];
    var walker = w.document.createTreeWalker(w.document.body, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) {
      if (!n.nodeValue.trim()) continue;
      var el = n.parentElement;
      if (!el || el.closest('[hidden]') || el.closest('svg')) continue;
      var size = parseFloat(w.getComputedStyle(el).fontSize);
      if (size < min) bad.push(el.tagName + '.' + el.className + ' ' + size + 'px "' + n.nodeValue.trim().slice(0, 30) + '"');
    }
    if (bad.length) throw new Error('text under ' + min + 'px: ' + bad.slice(0, 3).join('; '));
  };
  E2E.screenChecks = function (w) { E2E.noHorizontalScroll(w); E2E.minFont(w, 13); };
})();
