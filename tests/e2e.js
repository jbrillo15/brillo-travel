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
      (opts.outbox || []).forEach(function (op) { jobs.push(db.put('outbox', op.opId, op)); });
      if (opts.prefs) Object.keys(opts.prefs).forEach(function (k) { jobs.push(db.put('prefs', k, opts.prefs[k])); });
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
        // A test may set E2E.fetchStub to answer instead; it's cleared after each load.
        var stub = E2E.fetchStub || function () { return Promise.reject(new TypeError('offline (stub)')); };
        E2E.fetchStub = null;
        if (w.BT && w.BT.api) w.BT.api.fetch = stub;
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

  // Checklists for the Lists scenarios: four lists, bags, one overdue Pre-trip item.
  E2E.withLists = function (raw) {
    var rows = raw.Checklists.values;
    rows.splice(1, rows.length - 1,
      ['ck_p1', 'Pre-trip', 'Fake booking', 'Both', '—', '2026-10-09', false, '', '', '', 10, '', false],
      ['ck_p2', 'Pre-trip', 'Fake insurance', 'Jordan', '—', '2026-11-10', false, '', '', '', 20, '', false],
      ['ck_k1', 'Packing', 'Fake passport', 'Jordan', 'Jordan backpack', '', true, 'Jordan', '', '', 30, '', false],
      ['ck_k2', 'Packing', 'Fake charger', 'Lindsay', 'Lindsay backpack', '', false, '', '', '', 40, '', false],
      ['ck_k3', 'Packing', 'Fake shoes', 'Both', 'Suitcase', '', false, '', '', '', 50, '', false],
      ['ck_d1', 'Departure day', 'Fake checkout', 'Both', '—', '2026-11-26', false, '', '', '', 60, '', false],
      ['ck_x1', 'Packing', 'Fake deleted', 'Both', 'Suitcase', '', false, '', '', '', 70, '', true]);
  };
  // Expenses for the Budget scenarios (all fake): Nov 19–20 spending, today's lunch, an ATM
  // withdrawal, a tax-free purchase and a pre-trip USD booking. Shopping ¥100,000, cash ¥50,000.
  E2E.withExpenses = function (raw) {
    var set = raw.Settings.values;
    set.forEach(function (r) {
      if (r[0] === 'Shopping budget ¥') r[1] = 100000;
      if (r[0] === 'Starting cash ¥') r[1] = 50000;
    });
    raw.Expenses.values.push(
      ['ex_e1', '2026-11-19T03:00:00Z', '2026-11-19', 35000, 'JPY', 'Daily', 'Food', 'Card', 'Jordan', 'Fake dinner', false, 'n/a', 'jordan-iphone', '', false],
      ['ex_e2', '2026-11-20T03:00:00Z', '2026-11-20', 25000, 'JPY', 'Daily', 'Activities', 'Cash', 'Lindsay', 'Fake museum', false, 'n/a', 'lindsay-iphone', '', false],
      ['ex_e3', '2026-11-21T02:00:00Z', '2026-11-21', 5000, 'JPY', 'Daily', 'Food', 'Cash', 'Jordan', 'Fake lunch', false, 'n/a', 'jordan-iphone', '', false],
      ['ex_e4', '2026-11-21T01:00:00Z', '2026-11-21', 30000, 'JPY', 'Cash movement', 'ATM withdrawal', 'Cash', 'Jordan', '', false, 'n/a', 'jordan-iphone', '', false],
      ['ex_e5', '2026-11-20T05:00:00Z', '2026-11-20', 22000, 'JPY', 'Shopping', 'Shopping', 'Card', 'Lindsay', 'Fake jacket', true, 'Pending', 'lindsay-iphone', '', false],
      ['ex_e6', '2026-10-01T05:00:00Z', '2026-10-01', 120, 'USD', 'Bookings', 'Tickets', 'Card', 'Jordan', 'Fake park tickets', false, 'n/a', 'jordan-iphone', '', false],
      ['ex_e7', '2026-11-20T06:00:00Z', '2026-11-20', 9999, 'JPY', 'Daily', 'Food', 'Card', 'Jordan', 'Fake deleted', false, 'n/a', 'jordan-iphone', '', true]);
  };
  // A fake script that applies mutate ops to its own copy of the fixture sheet, so the
  // next snapshot reflects them (enough of Code.gs's behavior for the UI round trip).
  E2E.fakeScript = function (opts) {
    opts = opts || {};
    var calls = [];
    var applied = [];
    function reply(obj) { return Promise.resolve({ status: 200, text: function () { return Promise.resolve(JSON.stringify(obj)); } }); }
    var fn = function (url, o) {
      var body = JSON.parse(o.body);
      calls.push(body);
      if (body.action === 'mutate') {
        return reply({ ok: true, api: 1, serverVersion: opts.serverVersion || '0.2.0', results: body.ops.map(function (op) {
          var st = opts.status ? opts.status(op) : 'applied';
          if (st === 'applied') applied.push(op);
          return { opId: op.opId, status: st, reason: st === 'rejected' ? 'Not found in the sheet (fake)' : '' };
        }) });
      }
      var snap = E2E.snapshot(function (raw) {
        E2E.withLists(raw);
        if (opts.expenses) E2E.withExpenses(raw);
        var H = raw.Checklists.values[0];
        var X = raw.Expenses.values[0];
        var XMAP = { createdAt: 'Created at', tripDate: 'Trip date', amount: 'Amount', currency: 'Currency', envelope: 'Envelope', category: 'Category',
          method: 'Method', paidBy: 'Paid by', note: 'Note', taxFree: 'Tax-free', refundStatus: 'Refund status' };
        applied.forEach(function (op) {
          if (/^expense\./.test(op.type)) {
            var xr = raw.Expenses.values.filter(function (r) { return r[0] === op.id; })[0];
            if (!xr) { xr = X.map(function () { return ''; }); xr[0] = op.id; xr[X.indexOf('Deleted')] = false; xr[X.indexOf('Device')] = body.device; raw.Expenses.values.push(xr); }
            Object.keys(op.fields).forEach(function (k) { if (XMAP[k]) xr[X.indexOf(XMAP[k])] = op.fields[k]; });
            if (op.type === 'expense.delete') xr[X.indexOf('Deleted')] = true;
            return;
          }
          var row = raw.Checklists.values.filter(function (r) { return r[0] === op.id; })[0];
          if (!row) { row = H.map(function () { return ''; }); row[0] = op.id; row[6] = false; row[12] = false; raw.Checklists.values.push(row); }
          var map = { list: 'List', item: 'Item', owner: 'Owner', bag: 'Bag', due: 'Due', done: 'Done', doneBy: 'Done by', notes: 'Notes', sort: 'Sort' };
          Object.keys(op.fields).forEach(function (k) { if (map[k]) row[H.indexOf(map[k])] = op.fields[k]; });
          if (op.type === 'checklist.delete') row[H.indexOf('Deleted')] = true;
        });
      });
      snap.ok = true; snap.api = 1; snap.serverVersion = opts.serverVersion || '0.2.0'; snap.rev = 'fake-' + calls.length;
      return reply(snap);
    };
    fn.calls = calls;
    fn.actions = function () { return calls.map(function (c) { return c.action; }); };
    return fn;
  };
  E2E.wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms || 80); }); };
  E2E.outbox = function () {
    return BT.store.open('staging').then(function (db) { return db.all('outbox').then(function (all) { db.close(); return all; }); });
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
