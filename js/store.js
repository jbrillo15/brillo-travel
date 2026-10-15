/* On-phone storage (HANDOFF §7). One IndexedDB database per env,
   'brillo-<env>', because staging and prod share the jbrillo15.github.io
   origin. Stores: snapshot, outbox, prefs, meta. Every access is wrapped so a
   storage failure surfaces as a rejected promise the UI turns into a banner. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};

  var SCHEMA_VERSION = 1;
  // Each migration upgrades from the previous version. A migration must never
  // drop or clear the outbox (EC-31).
  var MIGRATIONS = {
    1: function (db) {
      ['snapshot', 'outbox', 'prefs', 'meta'].forEach(function (name) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      });
    }
  };

  function dbName(env) { return 'brillo-' + env; }

  function open(env, opts) {
    opts = opts || {};
    var idb = opts.indexedDB || window.indexedDB;
    var name = opts.name || dbName(env);
    return new Promise(function (resolve, reject) {
      var req;
      try { req = idb.open(name, SCHEMA_VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function (ev) {
        for (var v = (ev.oldVersion || 0) + 1; v <= SCHEMA_VERSION; v++) MIGRATIONS[v](req.result, req.transaction);
      };
      req.onsuccess = function () {
        // Let another tab (or a reset) delete or upgrade the database instead of hanging.
        req.result.onversionchange = function () { req.result.close(); };
        resolve(wrap(req.result, name));
      };
      req.onerror = function () { reject(req.error || new Error('IndexedDB open failed')); };
      req.onblocked = function () { reject(new Error('IndexedDB is blocked by another tab')); };
    });
  }

  function wrap(db, name) {
    function tx(storeName, mode, fn) {
      return new Promise(function (resolve, reject) {
        var t, out;
        try {
          t = db.transaction(storeName, mode);
          out = fn(t.objectStore(storeName));
        } catch (e) { reject(e); return; }
        t.oncomplete = function () { resolve(out && 'result' in out ? out.result : undefined); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('Transaction aborted')); };
      });
    }
    return {
      name: name,
      get: function (s, k) { return tx(s, 'readonly', function (o) { return o.get(k); }); },
      put: function (s, k, v) { return tx(s, 'readwrite', function (o) { o.put(v, k); }); },
      del: function (s, k) { return tx(s, 'readwrite', function (o) { o.delete(k); }); },
      keys: function (s) { return tx(s, 'readonly', function (o) { return o.getAllKeys(); }); },
      clear: function (s) { return tx(s, 'readwrite', function (o) { o.clear(); }); },
      close: function () { db.close(); },
      raw: db
    };
  }

  function deleteDb(env, opts) {
    var idb = (opts && opts.indexedDB) || window.indexedDB;
    var name = (opts && opts.name) || dbName(env);
    return new Promise(function (resolve, reject) {
      var req = idb.deleteDatabase(name);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { resolve(); };
    });
  }

  // Which env this phone uses. The pointer lives in localStorage (tiny, synchronous);
  // without one, the env follows the site path.
  // Keyed by site path: staging and prod share one origin, so one site's choice
  // must not flip the other (F9).
  var POINTER = 'brillo.env:' + window.location.pathname.replace(/[^\/]*$/, '');
  function envFromPath(path) {
    return /\/brillo-travel\//.test(path || '') && !/staging/.test(path) ? 'prod' : 'staging';
  }
  function activeEnv() {
    try {
      var v = window.localStorage.getItem(POINTER);
      if (v === 'staging' || v === 'prod') return v;
    } catch (e) { /* storage blocked: fall through */ }
    return envFromPath(window.location.pathname);
  }
  function setActiveEnv(env) {
    try { window.localStorage.setItem(POINTER, env); } catch (e) { /* the path default still works */ }
  }

  function clearActiveEnv() {
    try { window.localStorage.removeItem(POINTER); } catch (e) { /* nothing to clear */ }
  }

  function requestPersistence() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        return navigator.storage.persisted().then(function (p) { return p || navigator.storage.persist(); })
          .catch(function () { return false; });
      }
    } catch (e) { /* ignore */ }
    return Promise.resolve(false);
  }

  BT.store = {
    SCHEMA_VERSION: SCHEMA_VERSION, MIGRATIONS: MIGRATIONS,
    open: open, deleteDb: deleteDb, dbName: dbName,
    activeEnv: activeEnv, setActiveEnv: setActiveEnv, clearActiveEnv: clearActiveEnv, envFromPath: envFromPath,
    requestPersistence: requestPersistence
  };
})();
