/* Sync (HANDOFF §7): push the outbox, then pull a snapshot. The app always
   renders from the stored snapshot plus queued ops; the network only refreshes
   it. A tab the sheet reports as unreadable (V-09) keeps its last good copy.
   Failures never clear data, and queued ops are never dropped automatically:
   only an applied, duplicate or stale answer from the script removes one, and
   a rejected op waits in "Sync issues" until a person retries or discards it. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  var BACKOFF_S = [2, 5, 15, 60];
  var ID_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';

  function randomId(n) {
    var out = '', bytes = new Uint8Array(n);
    try { crypto.getRandomValues(bytes); } catch (e) { for (var j = 0; j < n; j++) bytes[j] = Math.floor(Math.random() * 256); }
    for (var i = 0; i < n; i++) out += ID_CHARS.charAt(bytes[i] % ID_CHARS.length);
    return out;
  }
  // Entity IDs made on the phone: the tab's prefix plus 8 lowercase characters, so
  // they never collide with the script's 6-character IDs or the live tests' ck_T… IDs.
  function newId(prefix) { return prefix + randomId(8); }

  function heldMessage() {
    return 'Changes are saved on this phone. They sync once the sheet\'s script is updated to ' + BT.config.minServerForWrites + '.';
  }
  function incompatibleError(api, res) {
    var e = new api.ApiError('incompatible', res.api > BT.config.api
      ? 'The sheet\'s script is newer than this app. Check for an update in Settings; it can take a few minutes to appear. Your saved plan still shows.'
      : 'The sheet\'s script is older than this app. The script needs redeploying. Your saved plan still shows.');
    e.serverVersion = res.serverVersion || null;
    return e;
  }

  function create(ctx) {
    // ctx: { store, getSetup: () => setup|null, api?, now?: () => Date, schedule?: (fn, ms) => handle, cancel?, isVisible? }
    var api = ctx.api || BT.api;
    var now = ctx.now || function () { return new Date(); };
    var schedule = ctx.schedule || function (fn, ms) { return setTimeout(fn, ms); };
    var cancel = ctx.cancel || function (h) { clearTimeout(h); };
    var listeners = [];
    var inFlight = null;
    var again = false;
    var failures = 0;
    var retryHandle = null;
    var kickHandle = null;
    var queue = [];          // the outbox, oldest first (a copy of the IndexedDB store)
    // Ops the script applied since the stored snapshot was fetched. The screens keep
    // drawing them until the next snapshot lands, so a tick never flips back between
    // the push and the pull (or when the pull fails). Saved in meta.
    var settled = [];
    var compat = null;       // { state: 'incompatible' | 'held', message, serverVersion }, persisted in meta
    var seq = 0;
    var status = { state: 'idle', lastSyncAt: null, error: null, issues: { errors: 0, warnings: 0 }, staleTabs: [],
      pending: 0, rejected: 0, held: null };

    function emit() { listeners.forEach(function (fn) { try { fn(status); } catch (e) { /* a bad listener can't stop sync */ } }); }
    function set(patch) { Object.keys(patch).forEach(function (k) { status[k] = patch[k]; }); emit(); }
    function counts() {
      status.rejected = queue.filter(function (o) { return o.status === 'rejected'; }).length;
      status.pending = queue.length - status.rejected;
    }

    function countIssues(issues) {
      var c = { errors: 0, warnings: 0 };
      (issues || []).forEach(function (i) { if (i.severity === 'error') c.errors++; else c.warnings++; });
      return c;
    }

    // The push guard (gate review carry-over): while the app and the script disagree,
    // nothing is sent. The state is saved, so a relaunch doesn't push before the
    // script has answered with a matching snapshot.
    function setCompat(c) {
      compat = c;
      status.held = c && c.state === 'held' ? c.message : null;
      return ctx.store.put('meta', 'compat', c).catch(function () { /* the in-memory guard still holds */ });
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
      var all = ctx.store.all ? ctx.store.all('outbox') : Promise.resolve([]);
      return Promise.all([ctx.store.get('snapshot', 'current'), ctx.store.get('meta', 'lastSyncAt'), ctx.store.get('meta', 'compat'), all,
        ctx.store.get('meta', 'settled')]).then(function (v) {
        var snap = v[0] || null;
        status.lastSyncAt = v[1] || null;
        compat = v[2] || null;
        settled = Array.isArray(v[4]) ? v[4] : [];
        // The saved snapshot already says how old the script is: start held, so the first
        // sync asks the script before pushing (an old script has no mutate at all).
        if (!compat && snap && BT.model.semverLess(snap.serverVersion, BT.config.minServerForWrites)) {
          compat = { state: 'held', message: heldMessage(), serverVersion: snap.serverVersion };
        }
        queue = (v[3] || []).filter(function (o) { return o && o.opId; }).sort(function (a, b) { return a.seq - b.seq; });
        seq = queue.reduce(function (m, o) { return Math.max(m, o.seq || 0); }, 0);
        counts();
        if (snap) { status.issues = countIssues(snap.issues); status.staleTabs = snap.staleTabs || []; status.serverVersion = snap.serverVersion; }
        if (compat && compat.state === 'incompatible') {
          status.state = 'incompatible';
          status.error = { kind: 'incompatible', message: compat.message };
          status.serverVersion = compat.serverVersion || status.serverVersion;
        }
        status.held = compat && compat.state === 'held' ? compat.message : null;
        return snap;
      });
    }

    // ---------- outbox ----------
    function enqueue(type, id, fields) {
      var t = now().getTime();
      var last = queue.length ? Date.parse(queue[queue.length - 1].clientUpdatedAt) : 0;
      if (last >= t) t = last + 1;           // two taps in the same millisecond still order correctly
      var op = { opId: 'op_' + t.toString(36) + randomId(8), seq: ++seq, type: type, id: id, fields: fields || {},
        clientUpdatedAt: new Date(t).toISOString(), status: 'pending' };
      return ctx.store.put('outbox', op.opId, op).then(function () {
        queue.push(op); counts(); emit(); kick();
        return op;
      });
    }
    function kick() {
      if (kickHandle) cancel(kickHandle);
      kickHandle = schedule(function () { kickHandle = null; run('change'); }, BT.config.pushDebounceMs);
    }
    function remove(op) {
      return ctx.store.del('outbox', op.opId).then(function () {
        queue = queue.filter(function (o) { return o.opId !== op.opId; });
      });
    }
    function markRejected(op, reason) {
      // Discarded (or replaced) while this push was in flight: don't bring it back.
      if (!queue.some(function (o) { return o.opId === op.opId; })) return Promise.resolve();
      var copy = Object.assign({}, op, { status: 'rejected', reason: reason || 'The sheet refused this change.', rejectedAt: now().toISOString() });
      return ctx.store.put('outbox', op.opId, copy).then(function () {
        queue = queue.map(function (o) { return o.opId === op.opId ? copy : o; });
      });
    }
    function retry(opId) {
      var op = queue.filter(function (o) { return o.opId === opId; })[0];
      if (!op) return Promise.resolve();
      // A retry is a fresh decision: stamp it now (a phone whose clock was wrong can
      // retry after fixing it), still after every other queued op.
      var t = now().getTime();
      queue.forEach(function (o) { if (o.opId !== opId) t = Math.max(t, Date.parse(o.clientUpdatedAt) + 1); });
      var copy = Object.assign({}, op, { status: 'pending', clientUpdatedAt: new Date(t).toISOString() });
      delete copy.reason; delete copy.rejectedAt;
      return ctx.store.put('outbox', opId, copy).then(function () {
        queue = queue.map(function (o) { return o.opId === opId ? copy : o; });
        counts(); emit(); return run('retry-op');
      });
    }
    function discard(opId) {
      var op = queue.filter(function (o) { return o.opId === opId; })[0];
      if (!op) return Promise.resolve();
      return remove(op).then(function () { counts(); emit(); });
    }
    function wire(op) { return { opId: op.opId, type: op.type, id: op.id, fields: op.fields, clientUpdatedAt: op.clientUpdatedAt }; }

    function canPush() { return !compat && queue.some(function (o) { return o.status === 'pending'; }); }

    // Send pending ops in batches. A batch that settles nothing (no answer for any op)
    // stops the loop; the ops stay queued for the next sync.
    function pushAll(setup) {
      var batch = queue.filter(function (o) { return o.status === 'pending'; }).slice(0, BT.config.maxOpsPerPush);
      if (!batch.length) return Promise.resolve(false);
      return api.call(setup, 'mutate', { ops: batch.map(wire) }).then(function (res) {
        if (res.api !== BT.config.api) throw incompatibleError(api, res);
        var byId = {};
        (Array.isArray(res.results) ? res.results : []).forEach(function (r) { if (r && r.opId) byId[r.opId] = r; });
        var done = 0, kept = [];
        return Promise.all(batch.map(function (op) {
          var r = byId[op.opId];
          if (!r) return null;                                   // no answer: keep it
          if (r.status === 'applied' || r.status === 'duplicate') { done++; kept.push(Object.assign({}, op, { status: 'settled' })); return remove(op); }
          if (r.status === 'stale') { done++; return remove(op); }   // the newer sheet copy wins; the pull shows it
          if (r.status === 'rejected') { done++; return markRejected(op, r.reason); }
          return null;                                           // unknown answer: keep it
        })).then(function () {
          settled = settled.concat(kept);
          return ctx.store.put('meta', 'settled', settled).catch(function () { /* in memory still covers this session */ });
        }).then(function () {
          counts(); emit();
          return done && canPush() ? pushAll(setup).then(function () { return true; }) : true;
        });
      });
    }

    function pullOnce(setup) {
      return ctx.store.get('snapshot', 'current').then(function (prev) {
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
          // reads. Keep the saved plan (read-only), say which side needs updating, and
          // hold the outbox.
          if (res.api !== BT.config.api) throw incompatibleError(api, res);
          var snap = merge(prev, res);
          var at = snap.receivedAt;
          // A script older than the write path reads fine but can't take changes yet.
          var held = BT.model.semverLess(res.serverVersion, BT.config.minServerForWrites)
            ? { state: 'held', message: heldMessage(), serverVersion: res.serverVersion }
            : null;
          return ctx.store.put('snapshot', 'current', snap)
            .then(function () { return ctx.store.put('meta', 'lastSyncAt', at); })
            .then(function () { return setCompat(held); })
            .then(function () { settled = []; return ctx.store.put('meta', 'settled', []).catch(function () {}); })
            .then(function () {
              status.lastSyncAt = at; status.issues = countIssues(snap.issues); status.staleTabs = snap.staleTabs;
              status.serverVersion = snap.serverVersion;
              return snap;
            });
        });
      });
    }

    function run(reason) {
      if (inFlight) { if (reason === 'change' || reason === 'retry-op') again = true; return inFlight; }
      var setup = ctx.getSetup();
      if (!setup) { set({ state: 'setup', error: null }); return Promise.resolve(null); }
      if (retryHandle) { cancel(retryHandle); retryHandle = null; }
      set({ state: 'syncing', reason: reason || 'manual' });
      var pulled = false, pushed = false, snap = null, pushError = null;
      inFlight = Promise.resolve().then(function () {
        if (!compat) return null;
        // After a mismatch (or an old script), ask the script first; push only once it matches.
        return pullOnce(setup).then(function (s) { pulled = true; snap = s; });
      }).then(function () {
        // A failed push still fetches the sheet (HANDOFF §7: keep failed ops, then fetch),
        // so the phone never freezes on an old plan and learns if the script is too old.
        return canPush() ? pushAll(setup).then(function (p) { pushed = p; }, function (e) {
          if (e && (e.kind === 'incompatible' || e.kind === 'auth')) throw e;
          pushError = e;
        }) : null;
      }).then(function () {
        return pulled && !pushed && !pushError ? snap : pullOnce(setup);
      }).then(function (s) {
        // The pull worked but the queued changes didn't go: report that (and retry),
        // unless the pull explained it (a script too old to take changes).
        if (pushError && !compat) throw pushError;
        failures = 0;
        set({ state: 'synced', error: null });
        return s;
      }).catch(function (e) {
        var kind = e && e.kind || 'storage';
        if (kind === 'auth') { set({ state: 'setup', error: e }); return null; }   // EC-26: data stays on the phone
        if (kind === 'incompatible') {                                           // retrying won't help; the usual triggers try again
          return setCompat({ state: 'incompatible', message: e.message, serverVersion: e.serverVersion || null }).then(function () {
            set({ state: 'incompatible', error: e, serverVersion: e.serverVersion });
            return null;
          });
        }
        failures++;
        var delay = BACKOFF_S[Math.min(failures - 1, BACKOFF_S.length - 1)] * 1000;
        set({ state: kind === 'offline' || kind === 'timeout' || kind === 'portal' ? 'offline' : 'problem', error: e, retryInMs: delay });
        if (ctx.isVisible ? ctx.isVisible() : true) retryHandle = schedule(function () { retryHandle = null; run('retry'); }, delay);
        return null;
      }).then(function (r) {
        inFlight = null;
        if (again) { again = false; return run('again').then(function () { return r; }); }
        return r;
      });
      return inFlight;
    }

    return {
      load: load,
      sync: run,
      merge: merge,
      enqueue: enqueue,
      retry: retry,
      discard: discard,
      queue: function () { return queue.slice(); },
      // What the screens draw on top of the snapshot: applied-but-not-yet-pulled ops, then the outbox.
      overlay: function () { return settled.concat(queue); },
      status: function () { return status; },
      onChange: function (fn) { listeners.push(fn); },
      stopRetry: function () { if (retryHandle) { cancel(retryHandle); retryHandle = null; } }
    };
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // Plain-English sync line (HANDOFF §7 "Sync status is always visible").
  function describe(st, nowDate) {
    var pending = st.pending || 0;
    if (st.state === 'setup') return { state: 'problem', text: 'Setup code needed' };
    if (st.state === 'syncing') return { state: 'waiting', text: 'Syncing…' };
    if (st.state === 'incompatible') return { state: 'problem', text: 'Version mismatch' };
    if (st.state === 'offline') return { state: 'offline', text: pending ? 'Offline · ' + plural(pending, 'change', 'changes') + ' saved on this phone' : 'Offline · showing saved copy' };
    if (st.state === 'problem') return { state: 'problem', text: 'Couldn\'t sync · will retry' };
    if (st.rejected) return { state: 'problem', text: plural(st.rejected, 'sync issue', 'sync issues') };
    if (st.held && pending) return { state: 'waiting', text: plural(pending, 'change', 'changes') + ' waiting · script update needed' };
    if (st.issues && st.issues.errors) return { state: 'problem', text: 'Sheet problem' };
    if (pending) return { state: 'waiting', text: plural(pending, 'change', 'changes') + ' waiting' };
    if (!st.lastSyncAt) return { state: 'offline', text: 'Not synced yet' };
    var mins = Math.max(0, Math.round(((nowDate || new Date()) - new Date(st.lastSyncAt)) / 60000));
    return { state: 'synced', text: mins < 1 ? 'Synced just now' : mins < 60 ? 'Synced ' + mins + ' min ago' :
      mins < 1440 ? 'Synced ' + Math.round(mins / 60) + ' h ago' : 'Synced ' + Math.round(mins / 1440) + ' d ago' };
  }

  BT.sync = { create: create, describe: describe, newId: newId, BACKOFF_S: BACKOFF_S };
})();
