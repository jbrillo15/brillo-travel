/* HANDOFF §13: js/config.js, sw.js and CHANGELOG.md agree on the version. */
suite('release', function () {
  test('version matches in config.js, sw.js and the top CHANGELOG entry', function () {
    return Promise.all([fetch('../sw.js').then(function (r) { return r.text(); }), fetch('../CHANGELOG.md').then(function (r) { return r.text(); })])
      .then(function (t) {
        var sw = /var VERSION = '([^']+)'/.exec(t[0]);
        var log = /^## (\d+\.\d+\.\d+)/m.exec(t[1]);
        ok(sw, 'sw.js VERSION'); ok(log, 'CHANGELOG has a version heading');
        eq(sw[1], BT.config.version, 'sw.js');
        eq(log[1], BT.config.version, 'CHANGELOG.md');
        ok(/var CACHE = PREFIX \+ VERSION/.test(t[0]), 'cache name uses the env prefix and version');
      });
  });
  test('every shell file the service worker precaches is loaded by index.html (or is a static asset)', function () {
    return Promise.all([fetch('../sw.js').then(function (r) { return r.text(); }), fetch('../index.html').then(function (r) { return r.text(); })])
      .then(function (t) {
        var shell = /var SHELL = \[([\s\S]*?)\];/.exec(t[0])[1].match(/'\.\/[^']*'/g).map(function (s) { return s.slice(3, -1); });
        var scripts = (t[1].match(/src="(js\/[^"]+)"/g) || []).map(function (s) { return s.slice(5, -1); });
        scripts.forEach(function (s) { ok(shell.indexOf(s) >= 0, 'sw.js precaches ' + s); });
      });
  });
});
