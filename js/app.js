/* App controller: boot, routing, events, sync triggers, update prompt.
   Renders from the stored snapshot first, then syncs (offline-first, D6). */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  var D = BT.dom, html = D.html, T = BT.time;

  var S = {
    env: null, db: null, setup: null, owner: null, snapshot: null, vm: BT.model.build(null),
    status: { state: 'idle' }, sheet: null, update: null, updateNote: null, setupError: null,
    simulate: null, storageError: null, sync: null, incompatible: null
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
      lists: 'lists', budget: 'budget', nearby: 'nearby' }[name] || 'today';
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
      case 'lists': case 'budget': case 'nearby': return BT.ui.placeholders[r.name](S);
      default: return BT.ui.today.render(S);
    }
  }

  // ---------- banners ----------
  function banners() {
    var out = [];
    if (S.dataError) out.push(html`<div class="banner"><div class="msg"><strong>Couldn't read the latest plan</strong><span>Showing what this phone had before. Check Data health or the sheet.</span></div></div>`);
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
    renderSheet();
  }
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
      S.vm = BT.model.build(snap);
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
      sync.onChange(function (st) {
        if (sync !== S.sync) return;            // a sync left over from before an env switch
        var prevRev = S.snapshot && S.snapshot.rev;
        var wasIncompatible = S.incompatible;
        S.status = st;
        // The mismatch banner stays up until the script answers again (synced, or setup
        // needed); offline or a failed sync says nothing about whether it now matches.
        if (st.state === 'incompatible') S.incompatible = st.error && st.error.message || 'The app and the sheet\'s script don\'t match.';
        else if (st.state === 'synced' || st.state === 'setup') S.incompatible = null;
        var bannerChanged = wasIncompatible !== S.incompatible && !typing();   // shows on the next render instead
        if (st.state === 'synced') {
          S.db.get('snapshot', 'current').then(function (snap) {
            if (snap && snap.rev !== prevRev) { applySnapshot(snap); render(); } else if (bannerChanged) render(); else renderSyncOnly();
          });
        } else if (st.state === 'setup' || bannerChanged) render();
        else renderSyncOnly();
      });
      return S.sync.load();
    }).then(function (snap) {
      if (snap) applySnapshot(snap);
      S.status = S.sync.status();
      if (!S.setup) S.status.state = 'setup';
    });
  }

  // ---------- actions ----------
  function savePasted(text) {
    var setup;
    try { setup = BT.api.decodeSetup(text); } catch (e) { S.setupError = e.message; render(); return; }
    S.setupError = null;
    var switching = setup.env !== S.env;
    BT.store.setActiveEnv(setup.env);
    var ready = switching ? (S.db.close(), openDb(setup.env)) : Promise.resolve();
    ready.then(function () { return S.db.put('prefs', 'setup', setup); }).then(function () {
      S.setup = setup;
      S.status = { state: 'idle', lastSyncAt: null, issues: { errors: 0, warnings: 0 } };   // drop the stale "setup needed" banner
      BT.store.requestPersistence();
      if (/^#?\/?(today)?$/.test(location.hash)) render(); else location.hash = '#/today';   // hashchange renders
      S.sync.pull('setup');
    }).catch(function (e) { S.setupError = 'Couldn\'t save the code on this phone: ' + (e && e.message || e); render(); });
  }

  function onClick(ev) {
    var el = ev.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return;
    var a = el.getAttribute('data-action');
    if (a === 'cards') {
      ev.preventDefault();
      S.sheet = { card: el.getAttribute('data-card') || 'allergy', id: el.getAttribute('data-id'), kind: el.getAttribute('data-kind') };
      renderSheet();
      overlay.scrollTop = 0;
    } else if (a === 'close-sheet') {
      S.sheet = null; renderSheet();
    } else if (a === 'sync-now') {
      S.sync.pull('button');
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
      if (document.visibilityState === 'visible') { render(); S.sync.pull('foreground'); }   // EC-04: re-derive "today"
      else S.sync.stopRetry();
    });
    window.addEventListener('online', function () { S.sync.pull('online'); });
    timer = setInterval(function () {
      if (document.visibilityState === 'visible') { S.sync.pull('timer'); }
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
      if (S.sync) { S.sync.pull('open'); startTriggers(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
