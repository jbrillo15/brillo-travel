/* store.js, api.js and sync.js (pull) tests: EC-20, EC-24..26, EC-31, V-09 merge. */
suite('core', function () {
  var SETUP = { env: 'staging', apiUrl: 'https://script.google.com/macros/s/AKfakeFAKE/exec', token: 'x'.repeat(40), device: 'test' };

  function memStore() {
    var d = { snapshot: {}, outbox: {}, prefs: {}, meta: {} };
    return {
      d: d,
      get: function (s, k) { return Promise.resolve(d[s][k]); },
      put: function (s, k, v) { d[s][k] = JSON.parse(JSON.stringify(v)); return Promise.resolve(); },
      del: function (s, k) { delete d[s][k]; return Promise.resolve(); }
    };
  }
  function reply(obj, status) {
    return Promise.resolve({ status: status || 200, text: function () { return Promise.resolve(typeof obj === 'string' ? obj : JSON.stringify(obj)); } });
  }
  function withFetch(fn, body) {
    var saved = BT.api.fetch, savedT = BT.api.timeoutMs;
    BT.api.fetch = fn;
    return Promise.resolve().then(body).then(function (v) { BT.api.fetch = saved; BT.api.timeoutMs = savedT; return v; },
      function (e) { BT.api.fetch = saved; BT.api.timeoutMs = savedT; throw e; });
  }
  function goodSnapshot() {
    var p = BT.parse.snapshot(FIXTURES.sheet());
    return { ok: true, api: 1, serverVersion: '0.1.0', env: 'staging', rev: 'r1', generatedAt: '2026-10-15T00:00:00Z', data: p.data, issues: p.issues };
  }

  // ---------- api ----------
  test('api: text/plain POST, redirect follow, token only in the body', function () {
    var seen;
    return withFetch(function (url, opts) { seen = { url: url, opts: opts }; return reply({ ok: true, api: 1 }); }, function () {
      return BT.api.call(SETUP, 'snapshot').then(function () {
        eq(seen.opts.method, 'POST');
        eq(seen.opts.redirect, 'follow');
        eq(seen.opts.headers['Content-Type'], 'text/plain;charset=utf-8');
        ok(seen.url.indexOf(SETUP.token) < 0, 'token not in URL');
        eq(JSON.parse(seen.opts.body).token, SETUP.token);
        eq(JSON.parse(seen.opts.body).action, 'snapshot');
      });
    });
  });

  test('EC-20: captive-portal HTML → portal (treated as offline)', function () {
    return withFetch(function () { return reply('<html>Sign in to Hotel Wi-Fi</html>'); }, function () {
      return BT.api.call(SETUP, 'snapshot').then(function () { throw new Error('should fail'); }, function (e) { eq(e.kind, 'portal'); });
    });
  });

  test('JSON without ok/api → portal', function () {
    return withFetch(function () { return reply({ hello: 1 }); }, function () {
      return BT.api.call(SETUP, 'snapshot').then(function () { throw new Error('should fail'); }, function (e) { eq(e.kind, 'portal'); });
    });
  });

  test('network error → offline', function () {
    return withFetch(function () { return Promise.reject(new TypeError('Load failed')); }, function () {
      return BT.api.call(SETUP, 'snapshot').then(function () { throw new Error('should fail'); }, function (e) { eq(e.kind, 'offline'); });
    });
  });

  test('EC-24: no answer → timeout', function () {
    BT.api.timeoutMs = 30;
    return withFetch(function (u, o) {
      return new Promise(function (res, rej) { o.signal.addEventListener('abort', function () { rej(new Error('aborted')); }); });
    }, function () {
      return BT.api.call(SETUP, 'snapshot').then(function () { throw new Error('should fail'); }, function (e) { eq(e.kind, 'timeout'); });
    });
  });

  test('EC-26 / EC-25: AUTH, LOCK_TIMEOUT and INTERNAL map to kinds', function () {
    var codes = ['AUTH', 'LOCK_TIMEOUT', 'INTERNAL'], kinds = [];
    return withFetch(function () { return reply({ ok: false, api: 1, code: codes[kinds.length] }); }, function () {
      var chain = Promise.resolve();
      codes.forEach(function () {
        chain = chain.then(function () { return BT.api.call(SETUP, 'snapshot').catch(function (e) { kinds.push(e.kind); }); });
      });
      return chain.then(function () { deepEq(kinds, ['auth', 'lock', 'server']); });
    });
  });

  test('no setup → auth error without a network call', function () {
    var called = false;
    return withFetch(function () { called = true; return reply({}); }, function () {
      return BT.api.call(null, 'snapshot').catch(function (e) { eq(e.kind, 'auth'); ok(!called); });
    });
  });

  test('setup code: decode, and reject bad, prod-less, short-token codes', function () {
    function enc(o) { return btoa(String.fromCharCode.apply(null, new TextEncoder().encode(JSON.stringify(o)))); }
    deepEq(BT.api.decodeSetup(enc({ env: 'staging', apiUrl: SETUP.apiUrl, token: SETUP.token })),
      { env: 'staging', apiUrl: SETUP.apiUrl, token: SETUP.token });
    throws(function () { BT.api.decodeSetup('garbage!!'); }, /isn't a setup code/);
    throws(function () { BT.api.decodeSetup(enc({ env: 'dev', apiUrl: SETUP.apiUrl, token: SETUP.token })); }, /staging or prod/);
    throws(function () { BT.api.decodeSetup(enc({ env: 'prod', apiUrl: 'https://evil.example/exec', token: SETUP.token })); }, /address/);
    throws(function () { BT.api.decodeSetup(enc({ env: 'prod', apiUrl: SETUP.apiUrl, token: 'short' })); }, /token/);
  });

  // ---------- sync ----------
  function makeSync(store, opts) {
    var scheduled = [];
    var s = BT.sync.create(Object.assign({
      store: store, getSetup: function () { return SETUP; },
      schedule: function (fn, ms) { scheduled.push(ms); return scheduled.length; }, cancel: function () {}
    }, opts || {}));
    s.scheduled = scheduled;
    return s;
  }

  test('pull stores the snapshot and reports synced', function () {
    var store = memStore();
    return withFetch(function () { return reply(goodSnapshot()); }, function () {
      var s = makeSync(store);
      return s.pull('open').then(function (snap) {
        eq(s.status().state, 'synced');
        eq(store.d.snapshot.current.rev, 'r1');
        eq(store.d.snapshot.current.data.itinerary.length, 10);
        ok(store.d.meta.lastSyncAt);
      });
    });
  });

  test('V-09: an unreadable tab keeps its last good copy', function () {
    var store = memStore();
    var first = goodSnapshot();
    var second = goodSnapshot();
    second.data.itinerary = null;
    second.issues = [{ id: 'V-09', severity: 'error', tab: 'Itinerary', row: 1, message: 'x' }];
    var n = 0;
    return withFetch(function () { return reply(n++ ? second : first); }, function () {
      var s = makeSync(store);
      return s.pull().then(function () { return s.pull(); }).then(function () {
        eq(store.d.snapshot.current.data.itinerary.length, 10, 'kept');
        deepEq(store.d.snapshot.current.staleTabs, ['itinerary']);
        eq(s.status().issues.errors, 1);
        eq(BT.sync.describe(s.status()).text, 'Sheet problem');
      });
    });
  });

  test('F2: an ok reply without data (e.g. the old spike script) never replaces the stored plan', function () {
    var store = memStore();
    store.d.snapshot.current = { rev: 'old', data: { itinerary: [{ id: 'x' }] } };
    return withFetch(function () { return reply({ ok: true, api: 1, env: 'staging', echo: null }); }, function () {
      var s = makeSync(store);
      return s.pull().then(function () {
        eq(store.d.snapshot.current.rev, 'old');
        eq(s.status().state, 'problem');
        ok(/without trip data/.test(s.status().error.message));
      });
    });
  });

  test('F2: a tab missing from the reply keeps its last good copy', function () {
    var store = memStore();
    var first = goodSnapshot(), second = goodSnapshot();
    delete second.data.hotels;
    var n = 0;
    return withFetch(function () { return reply(n++ ? second : first); }, function () {
      var s = makeSync(store);
      return s.pull().then(function () { return s.pull(); }).then(function () {
        eq(store.d.snapshot.current.data.hotels.length, 3);
        deepEq(store.d.snapshot.current.staleTabs, ['hotels']);
      });
    });
  });

  test('a reply from the other env is refused', function () {
    var store = memStore();
    var prodReply = goodSnapshot(); prodReply.env = 'prod';
    return withFetch(function () { return reply(prodReply); }, function () {
      var s = makeSync(store);
      return s.pull().then(function () { eq(store.d.snapshot.current, undefined); eq(s.status().state, 'problem'); });
    });
  });

  test('offline keeps data, shows offline, schedules backoff 2 s → 5 s → 15 s → 60 s cap', function () {
    var store = memStore();
    store.d.snapshot.current = { rev: 'old', data: { itinerary: [1] } };
    return withFetch(function () { return Promise.reject(new TypeError('offline')); }, function () {
      var s = makeSync(store);
      var chain = Promise.resolve();
      for (var i = 0; i < 5; i++) chain = chain.then(function () { return s.pull(); });
      return chain.then(function () {
        eq(s.status().state, 'offline');
        deepEq(s.scheduled, [2000, 5000, 15000, 60000, 60000]);
        eq(store.d.snapshot.current.rev, 'old', 'data untouched');
      });
    });
  });

  test('EC-26: AUTH → setup needed, data stays', function () {
    var store = memStore();
    store.d.snapshot.current = { rev: 'old', data: {} };
    return withFetch(function () { return reply({ ok: false, api: 1, code: 'AUTH' }); }, function () {
      var s = makeSync(store);
      return s.pull().then(function () {
        eq(s.status().state, 'setup');
        eq(store.d.snapshot.current.rev, 'old');
        eq(s.scheduled.length, 0, 'no retry loop on AUTH');
      });
    });
  });

  test('one pull at a time', function () {
    var calls = 0, release;
    return withFetch(function () { calls++; return new Promise(function (r) { release = function () { r(reply(goodSnapshot())); }; }); }, function () {
      var s = makeSync(memStore());
      var a = s.pull(), b = s.pull();
      ok(a === b, 'same promise');
      // fetch starts after an async storage read; wait for it before answering.
      function whenStarted() { return release ? Promise.resolve() : new Promise(function (r) { setTimeout(r, 5); }).then(whenStarted); }
      return whenStarted().then(function () { release(); return a; }).then(function () { eq(calls, 1); });
    });
  });

  test('no setup → status setup, no network', function () {
    var s = makeSync(memStore(), { getSetup: function () { return null; } });
    return s.pull().then(function () { eq(s.status().state, 'setup'); });
  });

  test('sync line wording', function () {
    var at = new Date('2026-11-21T00:00:00Z');
    eq(BT.sync.describe({ state: 'synced', lastSyncAt: '2026-11-20T23:58:00Z', issues: { errors: 0 } }, at).text, 'Synced 2 min ago');
    eq(BT.sync.describe({ state: 'offline' }).state, 'offline');
    eq(BT.sync.describe({ state: 'setup' }).text, 'Setup code needed');
  });

  // ---------- store (real IndexedDB, throwaway database) ----------
  test('EC-31: schema migration creates all stores and keeps outbox data across reopen', function () {
    var name = 'brillo-test-' + Math.random().toString(36).slice(2);
    var opts = { name: name };
    return BT.store.open('test', opts).then(function (db) {
      deepEq(Array.prototype.slice.call(db.raw.objectStoreNames).sort(), ['meta', 'outbox', 'prefs', 'snapshot']);
      return db.put('outbox', 'op_1', { opId: 'op_1' }).then(function () { db.close(); return BT.store.open('test', opts); });
    }).then(function (db) {
      return db.get('outbox', 'op_1').then(function (v) { eq(v.opId, 'op_1'); db.close(); });
    }).then(function () { return BT.store.deleteDb('test', opts); });
  });

  test('every migration step leaves the outbox store in place', function () {
    var made = [];
    var fakeDb = { objectStoreNames: { contains: function (n) { return made.indexOf(n) >= 0; } },
      createObjectStore: function (n) { made.push(n); }, deleteObjectStore: function (n) { throw new Error('deleted ' + n); } };
    for (var v = 1; v <= BT.store.SCHEMA_VERSION; v++) BT.store.MIGRATIONS[v](fakeDb);
    ok(made.indexOf('outbox') >= 0);
  });

  test('env from path: staging and prod repos share an origin', function () {
    eq(BT.store.envFromPath('/brillo-travel-staging/'), 'staging');
    eq(BT.store.envFromPath('/brillo-travel/'), 'prod');
    eq(BT.store.envFromPath('/app/index.html'), 'staging', 'local testing defaults to staging');
    eq(BT.store.dbName('prod'), 'brillo-prod');
  });
});
