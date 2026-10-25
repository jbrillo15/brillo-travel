/* App controller: boot, routing, events, sync triggers, update prompt.
   Renders from the stored snapshot first, then syncs (offline-first, D6). */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  var D = BT.dom, html = D.html, T = BT.time;

  var S = {
    env: null, db: null, setup: null, owner: null, snapshot: null, vm: BT.model.build(null),
    status: { state: 'idle' }, sheet: null, update: null, updateNote: null, setupError: null,
    simulate: null, storageError: null, sync: null, incompatible: null, packView: 'bag', saveError: null
  };
  BT.app = { state: S };

  // ---------- routing (hash keeps the screen across reloads; spike L10) ----------
  var TABS = [['today', 'Today', 'i-today'], ['trip', 'Trip', 'i-trip'], ['lists', 'Lists', 'i-lists'],
    ['budget', 'Budget', 'i-budget'], ['nearby', 'Nearby', 'i-nearby']];
  function route() {
    var parts = (location.hash || '#/today').replace(/^#\/?/, '').split('/');
    var name = parts[0] || 'today';
    var arg = null;
    try { arg = parts[1] ? decodeURIComponent(parts[1]) : null; } catch (e) { arg = parts[1]; }
    var tab = { today: 'today', info: 'today', settings: 'today', health: 'today', trip: 'trip', day: 'trip', item: 'trip',
      lists: 'lists', list: 'lists', check: 'lists', 'sync-issues': 'lists', budget: 'budget', nearby: 'nearby' }[name] || 'today';
    return { name: name, arg: arg, tab: tab };
  }
  function screenFor(r) {
    if (!S.setup && r.name !== 'settings' && r.name !== 'health') return BT.ui.settings.setup(S);
    switch (r.name) {
      case 'trip': return BT.ui.trip.list(S);
      case 'day': return BT.ui.trip.day(S, r.arg);
      case 'item': return BT.ui.trip.item(S, r.arg);
      case 'info': return BT.ui.info.render(S);
      case 'settings': return BT.ui.settings.render(S);
      case 'health': return BT.ui.settings.health(S);
      case 'lists': return BT.ui.lists.overview(S);
      case 'list': return BT.ui.lists.list(S, r.arg);
      case 'check': return BT.ui.lists.edit(S, r.arg);
      case 'sync-issues': return BT.ui.lists.issues(S);
      case 'budget': case 'nearby': return BT.ui.placeholders[r.name](S);
      default: return BT.ui.today.render(S);
    }
  }

  // ---------- banners ----------
  function banners() {
    var out = [];
    if (S.dataError) out.push(html`<div class="banner"><div class="msg"><strong>Couldn't read the latest plan</strong><span>Showing what this phone had before. Check Data health or the sheet.</span></div></div>`);
    if (S.saveError) out.push(html`<div class="banner"><div class="msg"><strong>Couldn't save that change</strong><span>${S.saveError}</span></div><button class="btn" type="button" data-action="dismiss-save-error">OK</button></div>`);
    if (S.status.held && S.status.pending) out.push(html`<div class="banner"><div class="msg"><strong>Changes waiting</strong><span>${S.status.held}</span></div></div>`);
    if (S.storageError) out.push(html`<div class="banner"><div class="msg"><strong>Storage problem</strong><span>This phone couldn't open the app's storage. Free some space, then close and reopen the app.</span></div></div>`);
    var errs = (S.vm.issues || []).filter(function (i) { return i.severity === 'error'; }).length;
    if (errs) out.push(html`<div class="banner"><div class="msg"><strong>Sheet problem</strong><span>${errs} ${errs === 1 ? 'issue' : 'issues'}${S.vm.staleTabs.length ? '. Showing the last good copy.' : ''}</span></div><a class="btn" href="#/health">Details</a></div>`);
    if (S.update) out.push(html`<div class="banner"><div class="msg"><strong>Update available</strong><span>${S.update.version ? 'Version ' + S.update.version : 'A new version is ready'}</span></div><button class="btn btn-primary" type="button" data-action="apply-update">Update</button></div>`);
    if (S.vm.settings.minAppVersion && BT.model.semverLess(BT.config.version, S.vm.settings.minAppVersion)) {
      out.push(html`<div class="banner"><div class="msg"><strong>This app is out of date</strong><span>The sheet expects version ${S.vm.settings.minAppVersion}. Everything still shows; update when you can.</span></div></div>`);
    }
    if (S.incompatible) out.push(html`<div class="banner"><div class="msg"><strong>App and sheet don't match</strong><span>${S.incompatible}</span></div><a class="btn" href="#/settings">Settings</a></div>`);
    if (S.status.state === 'setup' && S.setup) out.push(html`<div class="banner"><div class="msg"><strong>Setup code needed</strong><span>The sheet didn't accept this phone's code. Your saved plans are still here.</span></div><a class="btn" href="#/settings">Settings</a></div>`);
    return out;
  }

  function syncPill() {
    var st = BT.sync.describe(S.status, T.now());
    return html`<span class="sync" data-state="${st.state}" data-sync>${st.text}</span>`;
  }

  // ---------- render ----------
  var root;
  function render() {
    var r = route();
    var scr;
    try { scr = screenFor(r); } catch (e) {
      scr = { city: null, header: D.plainHeader('Something went wrong'), body: html`<p class="error">${String(e && e.message || e)}</p>` };
    }
    var cityCls = scr.city ? BT.model.cityClass(scr.city) : '';
    var bs = banners();
    root.className = 'app ' + cityCls;
    root.innerHTML = D.str(html`
      ${S.env === 'staging' ? html`<div class="staging-ribbon" aria-label="Staging">STAGING${S.simulate ? ' · SIMULATED TIME' : ''}</div>` : ''}
      ${scr.header}
      <div class="sync-row">${syncPill()}</div>
      ${bs.length ? html`<div class="banners">${bs}</div>` : ''}
      <main class="content" id="main">${scr.body}</main>
      <nav class="tabbar" aria-label="Main">${TABS.map(function (t) {
        return html`<a class="tab" href="#/${t[0]}"${r.tab === t[0] ? D.raw(' aria-current="page"') : ''}>${D.icon(t[2])}${t[1]}</a>`;
      })}</nav>`);
    // Remember what the edit form showed, so Save sends only what the person changed
    // (not the gap between the form and newer data, or a cell the form can't show).
    var ef = root.querySelector('form[data-action="save-check"]');
    if (ef) Array.prototype.forEach.call(ef.elements, function (el) { if (el.name) el.setAttribute('data-orig', el.value); });
    renderSheet();
  }
  BT.app.render = function () { render(); };
  // New data arrived while someone was typing: draw it when they leave the field. The
  // edit form is left alone (its Save diffs against the latest data, not the screen).
  var deferred = false;
  function deferRender() { deferred = true; renderSyncOnly(); }
  function flushDeferred() {
    if (!deferred || typing()) return;
    deferred = false;
    if (route().name !== 'check') render();
  }   // E2E: redraw after setting state directly
  // An open edit form is never redrawn by a sync: unsaved text would vanish (ship-check
  // 2026-10-21). It redraws when the person saves or leaves.
  function holdRender() { return typing() || !!document.querySelector('form[data-action="save-check"]'); }
  function typing() { return !!(document.activeElement && /TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName)); }
  function renderSyncOnly() {
    var st = BT.sync.describe(S.status, T.now());
    Array.prototype.forEach.call(document.querySelectorAll('[data-sync]'), function (el) {
      el.setAttribute('data-state', st.state); el.textContent = st.text;
    });
  }

  // ---------- cards sheet ----------
  var overlay, wakeLock = null;
  function renderSheet() {
    if (!S.sheet) { overlay.hidden = true; overlay.innerHTML = ''; releaseWake(); return; }
    overlay.innerHTML = D.str(BT.ui.cards.render(S, S.sheet));
    overlay.hidden = false;
    if (wakeLock) Array.prototype.forEach.call(overlay.querySelectorAll('[data-wake-hint]'), function (el) { el.hidden = true; });
    requestWake();
  }
  function requestWake() {
    if (wakeLock || !('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function (l) {
      wakeLock = l;
      l.addEventListener('release', function () { wakeLock = null; });
      Array.prototype.forEach.call(overlay.querySelectorAll('[data-wake-hint]'), function (el) { el.hidden = true; });
    }).catch(function () { /* the brightness hint stays visible (EC-37) */ });
  }
  function releaseWake() { if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; } }

  // ---------- data ----------
  // Bad data must never look like a storage problem or blank the app (F1).
  function applySnapshot(snap) {
    try {
      S.vm = BT.model.build(snap, S.sync ? S.sync.overlay() : []);
      S.snapshot = snap;
      S.dataError = null;
    } catch (e) {
      S.dataError = String(e && e.message || e);
    }
  }
  function applySimulation(sim) {
    S.simulate = S.env === 'staging' && sim ? sim : null;
    T.setNow(S.simulate ? function () { return Date.now() + S.simulate.offsetMs; } : null);
  }
  function deviceName() { return S.owner ? S.owner.toLowerCase() + '-iphone' : 'unknown-iphone'; }

  function openDb(env) {
    S.env = env;
    return BT.store.open(env).then(function (db) {
      S.db = db;
      return Promise.all([db.get('prefs', 'setup'), db.get('prefs', 'owner'), db.get('prefs', 'simulate')]);
    }).then(function (v) {
      S.setup = v[0] || null;
      S.owner = v[1] || null;
      applySimulation(v[2] || null);
      if (S.sync) S.sync.stopRetry();
      var sync = S.sync = BT.sync.create({
        store: S.db,
        getSetup: function () { return S.setup ? Object.assign({ device: deviceName() }, S.setup) : null; },
        isVisible: function () { return document.visibilityState === 'visible'; }
      });
      var queueSig = '';
      sync.onChange(function (st) {
        if (sync !== S.sync) return;            // a sync left over from before an env switch
        var prevRev = S.snapshot && S.snapshot.rev;
        // Queued changes are drawn on top of the snapshot; redraw when the outbox changes.
        var sig = sync.queue().map(function (o) { return o.opId + o.status; }).join();
        var queueChanged = sig !== queueSig;
        queueSig = sig;
        var wasIncompatible = S.incompatible;
        S.status = st;
        // The mismatch banner stays up until the script answers again (synced, or setup
        // needed); offline or a failed sync says nothing about whether it now matches.
        if (st.state === 'incompatible') S.incompatible = st.error && st.error.message || 'The app and the sheet\'s script don\'t match.';
        else if (st.state === 'synced' || st.state === 'setup') S.incompatible = null;
        var bannerChanged = wasIncompatible !== S.incompatible && !holdRender();   // shows on the next render instead
        if (st.state === 'synced') {
          S.db.get('snapshot', 'current').then(function (snap) {
            if (snap && (snap.rev !== prevRev || queueChanged)) { applySnapshot(snap); holdRender() ? deferRender() : render(); }
            else if (bannerChanged) render(); else renderSyncOnly();
          });
        } else if (queueChanged) { applySnapshot(S.snapshot); holdRender() ? deferRender() : render(); }
        else if ((st.state === 'setup' && !holdRender()) || bannerChanged) render();
        else renderSyncOnly();
      });
      return Promise.all([S.sync.load(), S.db.get('prefs', 'packView')]);
    }).then(function (v) {
      var snap = v[0];
      if (v[1]) S.packView = v[1];
      if (snap) applySnapshot(snap);
      S.status = S.sync.status();
      // A mismatch saved before the app closed keeps its banner until the script answers.
      if (S.status.state === 'incompatible') S.incompatible = S.status.error && S.status.error.message;
      if (!S.setup) S.status.state = 'setup';
    });
  }

  // ---------- actions ----------
  function savePasted(text) {
    var setup;
    try { setup = BT.api.decodeSetup(text); } catch (e) { S.setupError = e.message; render(); return; }
    // A code only works on its own site: the test app never connects to the real sheet,
    // and the real-trip app never to the test sheet (ship-check 2026-10-21).
    var site = BT.store.envFromPath(location.pathname);
    if (setup.env !== site) {
      S.setupError = site === 'staging'
        ? 'This is the test app (STAGING). That code is for the real trip app. Open the other Brillo icon and paste it there.'
        : 'This is the real trip app. That code is for the test app (STAGING). Ask Jordan for the real trip code.';
      render(); return;
    }
    S.setupError = null;
    var switching = setup.env !== S.env;
    BT.store.setActiveEnv(setup.env);
    var ready = switching ? (S.db.close(), openDb(setup.env)) : Promise.resolve();
    ready.then(function () { return S.db.put('prefs', 'setup', setup); }).then(function () {
      S.setup = setup;
      S.status = { state: 'idle', lastSyncAt: null, issues: { errors: 0, warnings: 0 } };   // drop the stale "setup needed" banner
      BT.store.requestPersistence();
      if (/^#?\/?(today)?$/.test(location.hash)) render(); else location.hash = '#/today';   // hashchange renders
      S.sync.sync('setup');
    }).catch(function (e) { S.setupError = 'Couldn\'t save the code on this phone: ' + (e && e.message || e); render(); });
  }

  // ---------- checklist changes (through the outbox) ----------
  function change(type, id, fields) {
    if (!S.sync) return Promise.resolve(null);
    return S.sync.enqueue(type, id, fields).catch(function (e) {
      S.saveError = 'This phone couldn\'t store it (' + (e && e.message || e) + '). Free some space and try again.';
      render();
      return null;
    });
  }
  function findCheck(id) { return S.vm.checklists.filter(function (c) { return c.id === id; })[0]; }
  function toggleCheck(id, rowEl) {
    var c = findCheck(id);
    if (!c) return;
    var fields = { done: !c.done };
    if (!c.done) fields.doneBy = S.owner || '';
    // Ticking: the ticker's face pops up from the box; the last open item of a list gets the big one.
    var l = c.done ? null : BT.model.listByName(S.vm, c.list, BT.ui.lists.today(S.vm));
    var finishing = l && l.items.length > 1 && l.done === l.items.length - 1;
    change('checklist.update', id, fields).then(function (op) {
      if (!op || c.done) return;
      if (finishing) { BT.ui.cheer.listDone(l.name); return; }
      // Measured after the redraw: a new banner can push the row down.
      var box = document.querySelector('.check[data-id="' + CSS.escape(id) + '"] .box') || (rowEl && rowEl.querySelector('.box'));
      if (box && box.isConnected) BT.ui.cheer.pop(S.owner, box.getBoundingClientRect());
    });
  }
  function addCheck(form) {
    var name = form.getAttribute('data-list');
    // namedItem: on a form's elements list, .item is the built-in item() method, not the field (ship-check 2026-10-21).
    var item = (form.elements.namedItem('item').value || '').trim();
    if (!item) return;
    var l = BT.model.listByName(S.vm, name, BT.ui.lists.today(S.vm));
    var fields = { list: name, item: item, owner: 'Both', sort: BT.model.nextSort(l ? l.items : []) };
    fields.bag = form.elements.bag ? form.elements.bag.value || '—' : '—';
    change('checklist.add', BT.sync.newId('ck_'), fields).then(function (op) {
      if (!op) return;
      render();                                // the outbox redraw skips while the field has focus
      var input = document.querySelector('form[data-action="add-check"] input[name="item"]');
      if (input) input.focus();                // keep adding without reaching for the field again
    });
  }
  function saveCheck(form) {
    var id = form.getAttribute('data-id');
    var c = findCheck(id);
    if (!c) {
      // Deleted on the other phone while this form was open (the form isn't redrawn by a sync).
      S.saveError = 'This item was deleted from the list (on the other phone or in the sheet), so the change wasn\'t saved.';
      location.hash = '#/lists';
      return;
    }
    var fields = {};
    ['item', 'owner', 'bag', 'due', 'notes'].forEach(function (k) {
      var el = form.elements.namedItem(k);
      if (!el) return;
      var v = el.value;
      var orig = el.getAttribute('data-orig');
      if (orig === null) orig = c[k] || '';
      if (k === 'item') { v = v.trim(); orig = orig.trim(); }
      if (k === 'bag') { v = v || '—'; orig = orig || '—'; }
      if (k === 'item' && !v) return;
      if (v !== orig) fields[k] = v;
    });
    var back = '#/list/' + encodeURIComponent(c.list);
    if (!Object.keys(fields).length) { location.hash = back; return; }
    change('checklist.update', id, fields).then(function (op) { if (op) location.hash = back; });
  }

  function onSubmit(ev) {
    var form = ev.target;
    var a = form.getAttribute && form.getAttribute('data-action');
    if (a === 'add-check') { ev.preventDefault(); addCheck(form); }
    else if (a === 'save-check') { ev.preventDefault(); saveCheck(form); }
  }

  function onClick(ev) {
    var el = ev.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return;
    var a = el.getAttribute('data-action');
    if (a === 'nav') return;                      // a plain link inside a tappable row
    if (a === 'toggle-check') {
      ev.preventDefault();
      toggleCheck(el.getAttribute('data-id'), el.closest('.check'));
    } else if (a === 'pack-view') {
      S.packView = el.getAttribute('data-view') === 'all' ? 'all' : 'bag';
      S.db.put('prefs', 'packView', S.packView).catch(function () {});
      render();
    } else if (a === 'delete-check') {
      if (!confirm('Delete this item from the list on both phones? It stays in the sheet, marked Deleted.')) return;
      var list = el.getAttribute('data-list');
      change('checklist.delete', el.getAttribute('data-id'), {}).then(function (op) { if (op) location.hash = '#/list/' + encodeURIComponent(list); });
    } else if (a === 'retry-op') {
      S.sync.retry(el.getAttribute('data-op'));
    } else if (a === 'discard-op') {
      if (!confirm('Discard this change? It never reaches the sheet.')) return;
      S.sync.discard(el.getAttribute('data-op'));
    } else if (a === 'dismiss-save-error') {
      S.saveError = null; render();
    } else if (a === 'cards') {
      ev.preventDefault();
      S.sheet = { card: el.getAttribute('data-card') || 'allergy', id: el.getAttribute('data-id'), kind: el.getAttribute('data-kind') };
      renderSheet();
      overlay.scrollTop = 0;
    } else if (a === 'close-sheet') {
      S.sheet = null; renderSheet();
    } else if (a === 'sync-now') {
      S.sync.sync('button');
    } else if (a === 'apply-update') {
      if (S.update && S.update.worker) { S.updating = true; S.update.worker.postMessage({ type: 'skipWaiting' }); }
    } else if (a === 'check-update') {
      checkForUpdate();
    } else if (a === 'simulate-clear') {
      S.db.del('prefs', 'simulate').then(function () { applySimulation(null); render(); }, render);
    } else if (a === 'reset-local') {
      if (!confirm('Erase everything this app saved on this phone, including the setup code? The sheet is not touched.')) return;
      S.db.close();
      BT.store.deleteDb(S.env).then(function () {
        BT.store.clearActiveEnv();
        location.hash = '#/today'; location.reload();
      });
    }
  }

  function onInput(ev) {
    var el = ev.target;
    var a = el.getAttribute && el.getAttribute('data-action');
    if (a === 'paste-setup') {
      var v = el.value; el.value = '';           // the code never stays on screen
      if (v.trim()) savePasted(v);
    }
  }

  function onChange(ev) {
    var el = ev.target;
    var a = el.getAttribute && el.getAttribute('data-action');
    if (a === 'set-owner') {
      S.owner = el.value || null;
      S.db.put('prefs', 'owner', S.owner).then(render, render);
    } else if (a === 'simulate-set' && el.value) {
      var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(el.value);
      if (!m) return;
      var at = T.zonedToInstant(m[1], m[2], BT.config.tripTz);
      var sim = { offsetMs: at.getTime() - Date.now(), inputValue: m[1] + 'T' + m[2], label: T.fmtDay(m[1]) + ' ' + T.fmtClock(m[2]) };
      S.db.put('prefs', 'simulate', sim).then(function () { applySimulation(sim); render(); });
    }
  }

  // ---------- service worker and updates (never auto-applied; HANDOFF §7) ----------
  var reg = null;
  function watchWorker(w) {
    if (!w) return;
    function ready() {
      if (w.state !== 'installed' || !navigator.serviceWorker.controller) return;
      var ch = new MessageChannel();
      ch.port1.onmessage = function (e) { S.update = { worker: w, version: e.data && e.data.version }; render(); };
      w.postMessage({ type: 'version' }, [ch.port2]);
      S.update = S.update || { worker: w, version: null };
      render();
    }
    if (w.state === 'installed') ready(); else w.addEventListener('statechange', ready);
  }
  function registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then(function (r) {
      reg = r;
      if (r.waiting) watchWorker(r.waiting);
      r.addEventListener('updatefound', function () { watchWorker(r.installing); });
    }).catch(function () { /* the app still works online; offline open needs the worker */ });
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (S.updating) location.reload(); });
  }
  function checkForUpdate() {
    if (!reg) { S.updateNote = 'Updates aren\'t available here.'; render(); return; }
    S.updateNote = 'Checking…'; render();
    reg.update().then(function () {
      S.updateNote = reg.waiting || reg.installing ? 'A new version is downloading. An Update button appears when it\'s ready.' : 'You have the latest version.';
      if (reg.waiting) watchWorker(reg.waiting);
      render();
    }).catch(function () { S.updateNote = 'Couldn\'t check. Are you offline?'; render(); });
  }

  // ---------- sync triggers (HANDOFF §7) ----------
  var timer = null;
  function startTriggers() {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { if (!holdRender()) render(); S.sync.sync('foreground'); }   // EC-04: re-derive "today" (an open edit form keeps its text)
      else S.sync.stopRetry();
    });
    window.addEventListener('online', function () { S.sync.sync('online'); });
    timer = setInterval(function () {
      if (document.visibilityState === 'visible') { S.sync.sync('timer'); }
    }, BT.config.autoSyncMs);
    // Keep Now/Next current; never while someone is typing on the setup screen.
    setInterval(function () {
      if (document.visibilityState === 'visible' && !S.sheet && S.setup && route().name === 'today' &&
          !typing()) render();
    }, 60000);
  }

  // ---------- boot ----------
  function boot() {
    root = document.getElementById('app');
    overlay = document.getElementById('sheet');
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('focusout', function () { setTimeout(flushDeferred, 0); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { S.sheet = null; renderSheet(); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.sheet) { S.sheet = null; renderSheet(); } });
    var enterTimer = null;
    window.addEventListener('hashchange', function () {
      S.sheet = null;
      root.setAttribute('data-enter', '');      // screen entrance plays on route changes only (DESIGN §8)
      render(); window.scrollTo(0, 0);
      clearTimeout(enterTimer);
      enterTimer = setTimeout(function () { root.removeAttribute('data-enter'); }, 400);
    });

    openDb(BT.store.activeEnv()).catch(function (e) {
      S.storageError = e; S.env = BT.store.activeEnv();
    }).then(function () {
      render();
      registerWorker();
      if (S.sync) { S.sync.sync('open'); startTriggers(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
