/* Tiny test harness (HANDOFF §12 L1). Classic script; no dependencies.
   test(name, fn) registers a test (fn may return a promise).
   eq / deepEq / ok / throws assert. run() executes everything, renders the
   results on the page and stores them in window.__TEST_RESULTS__. */
(function () {
  'use strict';
  var tests = [];
  var current = '';

  function fmt(v) {
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }
  function fail(msg) { throw new Error(msg); }

  window.test = function (name, fn) { tests.push({ name: (current ? current + ' › ' : '') + name, fn: fn }); };
  window.suite = function (name, fn) { var prev = current; current = name; fn(); current = prev; };
  window.ok = function (v, msg) { if (!v) fail(msg || 'expected truthy, got ' + fmt(v)); };
  window.eq = function (a, b, msg) {
    if (a !== b) fail((msg ? msg + ': ' : '') + 'expected ' + fmt(b) + ', got ' + fmt(a));
  };
  window.deepEq = function (a, b, msg) {
    if (fmt(a) !== fmt(b)) fail((msg ? msg + ': ' : '') + 'expected ' + fmt(b) + ', got ' + fmt(a));
  };
  window.throws = function (fn, re, msg) {
    try { fn(); } catch (e) {
      if (re && !re.test(String(e && e.message))) fail((msg ? msg + ': ' : '') + 'wrong error: ' + e.message);
      return;
    }
    fail(msg || 'expected an error');
  };

  window.runTests = function () {
    var results = [];
    var chain = Promise.resolve();
    tests.forEach(function (t) {
      chain = chain.then(function () {
        return Promise.resolve().then(t.fn).then(function () {
          results.push({ name: t.name, pass: true });
        }, function (e) {
          results.push({ name: t.name, pass: false, error: e && e.message ? e.message : String(e) });
        });
      });
    });
    return chain.then(function () {
      var failed = results.filter(function (r) { return !r.pass; });
      var summary = { total: results.length, passed: results.length - failed.length, failed: failed.length, failures: failed };
      window.__TEST_RESULTS__ = summary;
      var out = document.getElementById('results');
      if (out) {
        out.textContent = summary.passed + ' / ' + summary.total + ' passed\n\n' +
          results.map(function (r) { return (r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.error ? '\n     ' + r.error : ''); }).join('\n');
        document.body.className = failed.length ? 'has-failures' : 'all-pass';
      }
      return summary;
    });
  };
})();
