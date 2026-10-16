/* Sync, Phase 1 = pull only (HANDOFF §7). The app always renders from the
   stored snapshot; the network only refreshes it. A tab the sheet reports as
   unreadable (V-09) keeps its last good copy. Failures never clear data.
   Push (the outbox) arrives in Phase 2. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  var BACKOFF_S = [2, 5, 15, 60];

  function create(ctx) {
    // ctx: { store, getSetup: () => setup|null, api?, now?: () => Date, schedule?: (fn, ms) => handle, cancel? }
    var api = ctx.api || BT.api;
    var now = ctx.now || function () { return new Date(); };
    var schedule = ctx.schedule || function (fn, ms) { return setTimeout(fn, ms); };
    var cancel = ctx.cancel || function (h) { clearTimeout(h); };
    var listeners = [];
    var inFlight = null;
    var failures = 0;
    var retryHandle = null;
    var status = { state: 'idle', lastSyncAt: null, error: null, issues: { errors: 0, warnings: 0 }, staleTabs: [] };

    function emit() { listeners.forEach(function (fn) { try { fn(status); } catch (e) { /* a bad listener can't stop sync */ } }); }
    function set(patch) { Object.keys(patch).forEach(function (k) { status[k] = patch[k]; }); emit(); }

    function countIssues(issues) {
      var c = { errors: 0, warnings: 0 };
      (issues || []).forEach(function (i) { if (i.severity === 'error') c.errors++; else c.warnings++; });
      return c;
    }

    var TABS = ['settings', 'itinerary', 'hotels', 'transportation', 'expenses', 'ideas', 'checklists', 'phrases'];
    // Start from the last good copy; a tab is replaced only when the new snapshot
    // actually has it. A null or missing tab keeps the old copy (V-09, F2).
    function merge(prev, res) {
      var old = (prev && prev.data) || {};
      var data = {};
      var stale = [];
      TABS.forEach(function (k) {
        var fresh = res.data[k];
        if (fresh !== null && fresh !== undefined) data[k] = fresh;
        else if (old[k]) { data[k] = old[k]; stale.push(k); }
        else data[k] = null;
      });
      return { rev: res.rev, env: res.env, serverVersion: res.serverVersion, generatedAt: res.generatedAt,
        receivedAt: now().toISOString(), data: data, issues: res.issues || [], staleTabs: stale };
    }

    function load() {
      return Promise.all([ctx.store.get('snapshot', 'current'), ctx.store.get('meta', 'lastSyncAt')]).then(function (v) {
        var snap = v[0] || null;
        status.lastSyncAt = v[1] || null;
        if (snap) { status.issues = countIssues(snap.issues); status.staleTabs = snap.staleTabs || []; }
        return snap;
      });
    }

    function pull(reason) {
      if (inFlight) return inFlight;
      var setup = ctx.getSetup();
      if (!setup) { set({ state: 'setup', error: null }); return Promise.resolve(null); }
      if (retryHandle) { cancel(retryHandle); retryHandle = null; }
      set({ state: 'syncing', reason: reason || 'manual' });
      inFlight = ctx.store.get('snapshot', 'current').then(function (prev) {
        return api.call(setup, 'snapshot').then(function (res) {
          // An ok reply without data (an old script version, a wrong deployment) must never
          // replace the stored plan.
          if (!res.data || typeof res.data !== 'object' || Array.isArray(res.data)) {
            throw new api.ApiError('bad', 'The script answered without trip data. Is the right version deployed?');
          }
          if (setup.env && res.env && res.env !== setup.env) {
            throw new api.ApiError('bad', 'The script says it is ' + res.env + ', but this phone is set up for ' + setup.env + '.');
          }
          // §13: a different API number means the reply may not have the shape this app
          // reads. Keep the saved plan (read-only) and say which side needs updating. The
          // Phase 2 push must not run in this state.
          if (res.api !== BT.config.api) {
            var mismatch = new api.ApiError('incompatible', res.api > BT.config.api
              ? 'The sheet\'s script is newer than this app. Check for an update in Settings; it can take a few minutes to appear. Your saved plan still shows.'
              : 'The sheet\'s script is older than this app. The script needs redeploying. Your saved plan still shows.');
            mismatch.serverVersion = res.serverVersion || null;
            throw mismatch;
          }
          var snap = merge(prev, res);
          var at = snap.receivedAt;
          return ctx.store.put('snapshot', 'current', snap)
            .then(function () { return ctx.store.put('meta', 'lastSyncAt', at); })
            .then(function () {
              failures = 0;
              set({ state: 'synced', lastSyncAt: at, error: null, issues: countIssues(snap.issues), staleTabs: snap.staleTabs, serverVersion: snap.serverVersion });
              return snap;
            });
        });
      }).catch(function (e) {
        var kind = e && e.kind || 'storage';
        if (kind === 'auth') { set({ state: 'setup', error: e }); return null; }   // EC-26: data stays on the phone
        if (kind === 'incompatible') { set({ state: 'incompatible', error: e, serverVersion: e.serverVersion }); return null; }   // retrying won't help; the usual triggers try again
        failures++;
        var delay = BACKOFF_S[Math.min(failures - 1, BACKOFF_S.length - 1)] * 1000;
        set({ state: kind === 'offline' || kind === 'timeout' || kind === 'portal' ? 'offline' : 'problem', error: e, retryInMs: delay });
        if (ctx.isVisible ? ctx.isVisible() : true) retryHandle = schedule(function () { retryHandle = null; pull('retry'); }, delay);
        return null;
      }).then(function (r) { inFlight = null; return r; });
      return inFlight;
    }

    return {
      load: load,
      pull: pull,
      merge: merge,
      status: function () { return status; },
      onChange: function (fn) { listeners.push(fn); },
      stopRetry: function () { if (retryHandle) { cancel(retryHandle); retryHandle = null; } }
    };
  }

  // Plain-English sync line (HANDOFF §7 "Sync status is always visible").
  function describe(st, nowDate) {
    if (st.state === 'setup') return { state: 'problem', text: 'Setup code needed' };
    if (st.state === 'syncing') return { state: 'waiting', text: 'Syncing…' };
    if (st.state === 'offline') return { state: 'offline', text: 'Offline · showing saved copy' };
    if (st.state === 'problem') return { state: 'problem', text: 'Couldn\'t sync · will retry' };
    if (st.state === 'incompatible') return { state: 'problem', text: 'Version mismatch' };
    if (st.issues && st.issues.errors) return { state: 'problem', text: 'Sheet problem' };
    if (!st.lastSyncAt) return { state: 'offline', text: 'Not synced yet' };
    var mins = Math.max(0, Math.round(((nowDate || new Date()) - new Date(st.lastSyncAt)) / 60000));
    return { state: 'synced', text: mins < 1 ? 'Synced just now' : mins < 60 ? 'Synced ' + mins + ' min ago' :
      mins < 1440 ? 'Synced ' + Math.round(mins / 60) + ' h ago' : 'Synced ' + Math.round(mins / 1440) + ' d ago' };
  }

  BT.sync = { create: create, describe: describe, BACKOFF_S: BACKOFF_S };
})();
