/* Phase 0 spike (HANDOFF §14). One page that checks every iPhone capability
   the app depends on and records pass/fail per test in IndexedDB, so results
   survive force-quits. "Copy results" produces a summary with no secrets.
   Classic script, no modules (HANDOFF D5). */
(function () {
  'use strict';

  var VERSION = 'spike-1';
  var DB_NAME = 'brillo-spike';
  var SESSION = Math.random().toString(36).slice(2, 10);
  var LOADED_AT = new Date();
  var ECHO = '日本語テスト 東京・京都・大阪 🍣';
  var state = { results: {}, setup: null, meta: {} };

  // ---------- IndexedDB (one key/value store) ----------
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore('kv'); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbp;
  }
  function kv(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var tx = d.transaction('kv', mode);
        var out = fn(tx.objectStore('kv'));
        tx.oncomplete = function () { resolve(out && out.result); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function get(k) { return kv('readonly', function (s) { return s.get(k); }); }
  function put(k, v) { return kv('readwrite', function (s) { s.put(v, k); }); }
  function del(k) { return kv('readwrite', function (s) { s.delete(k); }); }

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'on') Object.keys(attrs.on).forEach(function (ev) { n.addEventListener(ev, attrs.on[ev]); });
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.style.display = 'block';
    clearTimeout(toast.h); toast.h = setTimeout(function () { t.style.display = 'none'; }, 2500);
  }
  function standalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function mode() { return standalone() ? 'home-screen app' : 'Safari tab'; }
  function stamp(d) {
    return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(d) + ' PT';
  }
  // Results are keyed by test id and by mode, because Safari and the
  // home-screen app have separate storage (EC-30) and both get tested.
  function record(id, status, detail) {
    var r = state.results[id] = state.results[id] || {};
    if (status) r.status = status;
    if (detail !== undefined) r.detail = detail;
    r.mode = mode(); r.at = new Date().toISOString();
    paint(id);
    return put('results', state.results).catch(function () {});
  }

  // ---------- test definitions ----------
  var LINKS = [
    { id: 'L1', name: 'Maps transit directions', url: 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent('清水寺') + '&travelmode=transit' },
    { id: 'L2', name: 'Maps search', url: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('ramen') },
    { id: 'L3', name: 'Maps saved place link', url: 'https://www.google.com/maps/place/Kyoto+Station/' },
    { id: 'L4', name: 'Translate app (googletranslate://)', url: 'googletranslate://?sl=en&tl=ja&text=' + encodeURIComponent('Where is the station?') },
    { id: 'L5', name: 'Translate website', url: 'https://translate.google.com/?sl=en&tl=ja&op=translate&text=' + encodeURIComponent('Where is the station?') },
    { id: 'L6', name: 'GO taxi website (may open the app)', url: 'https://go.goinc.jp/' },
    { id: 'L7', name: 'GO taxi App Store page', url: 'https://apps.apple.com/jp/app/id1254341709' },
    { id: 'L8', name: 'Tokyo Disney Resort website (may open the app)', url: 'https://www.tokyodisneyresort.jp/' },
    { id: 'L9', name: 'Tokyo Disney Resort App Store page', url: 'https://apps.apple.com/jp/app/id1313147771' },
    { id: 'L10', name: 'Phone link (fake number; tap Cancel)', url: 'tel:+12025550100' }
  ];

  var TESTS = [
    { id: 'S1', title: 'Install and standalone',
      how: 'Passes automatically when this page runs as a home-screen app.', run: testStandalone, auto: true },
    { id: 'S2', title: 'Storage survives a force-quit',
      how: 'Counts each open. After a force-quit and reopen, the count should go up and the first-open time should stay.', run: testStorage, auto: true, manual: true },
    { id: 'S3', title: 'Opens offline',
      how: 'Shows whether the offline cache is ready. Mark Pass after the page opens in airplane mode.', run: testOffline, auto: true, manual: true },
    { id: 'S4', title: 'Paste setup code', setup: true,
      how: 'Paste the setup code here. It\'s saved on this phone, and the box clears itself.' },
    { id: 'S5', title: 'Talk to the staging sheet', post: true,
      how: 'Sends Japanese text and an emoji to the staging script and checks they come back intact. Also checks a wrong token is refused.' },
    { id: 'S6', title: 'Links out', links: true,
      how: 'Tap each link, then come back to Brillo Spike (swipe or the "◀ Brillo Spike" corner). The page notes whether it reloaded. Then tap Worked or Didn\'t.' },
    { id: 'S7', title: 'Location', geo: true,
      how: 'Asks for your location once. Tap a second time to see whether iOS asks again.' },
    { id: 'S8', title: 'Japanese speech', speech: true,
      how: 'Plays a short Japanese sentence. Mark whether you heard Japanese.' },
    { id: 'S9', title: 'Keep screen awake', wake: true,
      how: 'Turns on the screen wake lock for 2 minutes. Don\'t touch the phone; mark whether the screen stayed on past your Auto-Lock time.' }
  ];

  // ---------- rendering ----------
  function badge(id) {
    var r = state.results[id];
    var s = r && r.status ? r.status : 'todo';
    return el('span', { 'class': 'status ' + s, id: 'st-' + id, text: s === 'todo' ? 'NOT RUN' : s.toUpperCase() });
  }
  function paint(id) {
    var b = $('st-' + id); if (!b) return;
    var fresh = badge(id); b.className = fresh.className; b.textContent = fresh.textContent;
    var d = $('dt-' + id); var r = state.results[id];
    if (d) d.textContent = r && r.detail ? r.detail + '\n(' + r.mode + ', ' + stamp(new Date(r.at)) + ')' : '';
  }
  function passFail(id) {
    return el('div', { 'class': 'row' }, [
      el('button', { 'class': 'pass', text: 'Worked', on: { click: function () { record(id, 'pass'); } } }),
      el('button', { 'class': 'fail', text: 'Didn\'t', on: { click: function () { record(id, 'fail'); } } })
    ]);
  }
  function render() {
    var root = $('tests');
    TESTS.forEach(function (t) {
      var body = [el('h2', {}, [el('span', { 'class': 'id', text: t.id }), document.createTextNode(t.title), badge(t.id)]),
        el('p', { 'class': 'how', text: t.how })];
      if (t.auto) body.push(el('div', { 'class': 'row' }, [el('button', { text: 'Run again', on: { click: t.run } })]));
      if (t.manual) body.push(passFail(t.id));
      if (t.setup) body.push(setupBox());
      if (t.post) body.push(el('div', { 'class': 'row' }, [el('button', { 'class': 'primary', text: 'Run sheet test', on: { click: testPost } })]));
      if (t.geo) body.push(el('div', { 'class': 'row' }, [el('button', { 'class': 'primary', text: 'Use my location', on: { click: testGeo } })]));
      if (t.speech) body.push(speechBox());
      if (t.wake) body.push(el('div', { 'class': 'row' }, [el('button', { 'class': 'primary', text: 'Keep awake 2 min', on: { click: testWake } })]), passFail(t.id));
      if (t.links) LINKS.forEach(function (l) { body.push(linkItem(l)); });
      body.push(el('p', { 'class': 'detail', id: 'dt-' + t.id }));
      root.appendChild(el('section', { 'class': 'card' }, body));
      paint(t.id);
    });
    LINKS.forEach(function (l) { paint(l.id); });
  }

  // ---------- S1 standalone ----------
  function testStandalone() {
    var s = standalone();
    return record('S1', s ? 'pass' : 'fail', s
      ? 'Running full-screen from the home screen.'
      : 'Running in a Safari tab. Add to Home Screen, then open it from the icon.');
  }

  // ---------- S2 storage ----------
  function testStorage() {
    var info = {};
    return get('opens').then(function (o) {
      o = o || { count: 0, first: new Date().toISOString() };
      o.count += 1; o.last = new Date().toISOString();
      info.opens = o;
      return put('opens', o);
    }).then(function () {
      var sm = navigator.storage;
      if (!sm || !sm.persist) return null;
      return sm.persisted().then(function (already) {
        return already ? true : sm.persist();
      }).then(function (p) { info.persisted = p; return sm.estimate ? sm.estimate() : null; })
        .then(function (est) { info.est = est; });
    }).then(function () {
      var o = info.opens;
      var lines = ['Opens recorded: ' + o.count + ' (first ' + stamp(new Date(o.first)) + ')',
        'Persistent storage granted: ' + (info.persisted === undefined ? 'API missing' : info.persisted)];
      if (info.est && info.est.quota) lines.push('Quota: ' + Math.round(info.est.quota / 1048576) + ' MB, used ' + Math.round((info.est.usage || 0) / 1024) + ' KB');
      var prev = state.results.S2;
      var status = o.count > 1 ? 'pass' : (prev && prev.status) || undefined;
      return record('S2', status, lines.join('\n'));
    }).catch(function (e) { return record('S2', 'fail', 'IndexedDB error: ' + e); });
  }

  // ---------- S3 offline ----------
  function testOffline() {
    if (!('serviceWorker' in navigator)) return record('S3', 'fail', 'No service worker support.');
    return navigator.serviceWorker.ready.then(function () {
      return caches.keys();
    }).then(function (keys) {
      var ctl = !!navigator.serviceWorker.controller;
      var mine = keys.filter(function (k) { return k.indexOf('brillo-spike-') === 0; });
      var prev = state.results.S3;
      return record('S3', prev && prev.status, [
        'Offline cache: ' + (mine.length ? mine.join(', ') : 'none yet'),
        'Page controlled by the service worker: ' + ctl,
        'Network right now: ' + (navigator.onLine ? 'online' : 'OFFLINE')
      ].join('\n'));
    });
  }

  // ---------- S4 setup code ----------
  function decodeSetup(raw) {
    var s = (raw || '').replace(/\s+/g, '');
    var obj;
    try {
      var bin = atob(s);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      obj = JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      throw new Error('That isn\'t a setup code. Copy the whole code and paste again.');
    }
    if (obj.env !== 'staging') throw new Error('The spike only accepts a staging code.');
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(obj.apiUrl || '')) throw new Error('Script address looks wrong.');
    if (typeof obj.token !== 'string' || obj.token.length < 32) throw new Error('Token missing or too short.');
    return obj;
  }
  function setupBox() {
    var owner = el('select', { 'aria-label': 'Whose phone is this?' }, ['', 'Jordan', 'Lindsay'].map(function (n) {
      return el('option', { value: n, text: n || 'Whose phone is this?' });
    }));
    var ios = el('input', { type: 'text', inputmode: 'decimal', placeholder: 'iOS version (Settings → General → About)' });
    var box = el('textarea', { placeholder: 'Paste setup code', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false' });
    box.addEventListener('input', function () {
      var v = box.value; box.value = '';   // never keep the code on screen
      if (!v.trim()) return;
      try {
        var obj = decodeSetup(v);
        state.setup = obj;
        put('setup', obj).then(function () {
          record('S4', 'pass', 'Saved on this phone: env ' + obj.env + ', token ' + obj.token.length + ' characters.');
        });
      } catch (e) {
        record('S4', 'fail', 'Setup code rejected: ' + (e && e.message ? e.message : 'not a valid code'));
      }
    });
    function saveMeta() {
      state.meta.owner = owner.value; state.meta.ios = ios.value.trim();
      put('meta', state.meta).catch(function () {});
    }
    owner.addEventListener('change', saveMeta);
    ios.addEventListener('change', saveMeta);
    owner.value = state.meta.owner || ''; ios.value = state.meta.ios || '';
    return el('div', {}, [owner, el('div', { style: 'height:8px' }), ios, el('div', { style: 'height:8px' }), box,
      el('div', { 'class': 'row' }, [el('button', { text: 'Forget setup code', on: { click: function () {
        state.setup = null; del('setup').then(function () { record('S4', 'fail', 'Setup code removed.'); });
      } } })])]);
  }

  // ---------- S5 POST to Apps Script ----------
  function post(body) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 20000);
    var t0 = performance.now();
    return fetch(state.setup.apiUrl, {
      method: 'POST', redirect: 'follow', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.text(); }).then(function (txt) {
      var j;
      try { j = JSON.parse(txt); } catch (e) { throw new Error('Reply was not JSON (captive portal or Google error page)'); }
      if (!j || typeof j.ok !== 'boolean' || !('api' in j)) throw new Error('Reply was JSON but not from the script');
      return { json: j, ms: Math.round(performance.now() - t0) };
    }, function (e) {
      throw new Error(e && e.name === 'AbortError' ? 'Timed out after 20 s' : 'Network error (offline or blocked)');
    }).finally(function () { clearTimeout(timer); });
  }
  function testPost() {
    if (!state.setup) return record('S5', 'fail', 'Paste the setup code in S4 first.');
    record('S5', undefined, 'Running… (a cold start can take 2–6 s)');
    var lines = [];
    var good = { token: state.setup.token, action: 'ping', device: (state.meta.owner || 'unknown').toLowerCase() + '-iphone', appVersion: VERSION, echo: ECHO };
    return post(good).then(function (a) {
      var j = a.json;
      var echoOk = j.echo === ECHO;
      lines.push('Correct token: ok=' + j.ok + ', env=' + j.env + ', ' + a.ms + ' ms');
      lines.push('Japanese + emoji came back intact: ' + echoOk);
      var bad = { token: state.setup.token + 'x', action: 'ping', echo: 'x' };
      return post(bad).then(function (b) {
        var refused = b.json.ok === false && b.json.code === 'AUTH';
        lines.push('Wrong token refused (AUTH): ' + refused + ', ' + b.ms + ' ms');
        var pass = j.ok === true && j.env === 'staging' && echoOk && refused;
        return record('S5', pass ? 'pass' : 'fail', lines.join('\n'));
      });
    }).catch(function (e) {
      lines.push('Failed: ' + e.message + ' (network: ' + (navigator.onLine ? 'online' : 'offline') + ')');
      return record('S5', 'fail', lines.join('\n'));
    });
  }

  // ---------- S6 links ----------
  function linkItem(l) {
    return el('div', { 'class': 'link-item' }, [
      el('h2', {}, [el('span', { 'class': 'id', text: l.id }), document.createTextNode(l.name), badge(l.id)]),
      el('div', { 'class': 'row' }, [
        el('a', { 'class': 'btn', href: l.url, text: 'Open', on: { click: function () {
          put('pendingLink', { id: l.id, session: SESSION, at: Date.now() }).catch(function () {});
        } } }),
        el('button', { 'class': 'pass', text: 'Worked', on: { click: function () { record(l.id, 'pass'); } } }),
        el('button', { 'class': 'fail', text: 'Didn\'t', on: { click: function () { record(l.id, 'fail'); } } })
      ]),
      el('p', { 'class': 'detail', id: 'dt-' + l.id })
    ]);
  }
  // On return (or a reload) note whether the page kept its state (EC-34).
  function checkReturn() {
    return get('pendingLink').then(function (p) {
      if (!p || Date.now() - p.at > 15 * 60000) return;
      return del('pendingLink').then(function () {
        var same = p.session === SESSION;
        var prev = state.results[p.id];
        return record(p.id, prev && prev.status, same
          ? 'Came back without a reload (state kept).'
          : 'Page RELOADED on return (state lost; IndexedDB still had the note).');
      });
    }).catch(function () {});
  }

  // ---------- S7 geolocation ----------
  function testGeo() {
    if (!navigator.geolocation) return record('S7', 'fail', 'No geolocation API.');
    var t0 = performance.now();
    var prev = (state.results.S7 && state.results.S7.detail) || '';
    var n = ((state.meta.geoTries || 0) + 1);
    state.meta.geoTries = n; put('meta', state.meta).catch(function () {});
    navigator.geolocation.getCurrentPosition(function (pos) {
      record('S7', 'pass', (prev ? prev + '\n' : '') + 'Try ' + n + ': got a fix, accuracy ' + Math.round(pos.coords.accuracy) + ' m, ' +
        Math.round(performance.now() - t0) + ' ms. (Coordinates stay on the phone.)');
    }, function (err) {
      var why = { 1: 'permission denied', 2: 'position unavailable', 3: 'timed out (8 s)' }[err.code] || err.message;
      record('S7', err.code === 1 ? 'fail' : undefined, (prev ? prev + '\n' : '') + 'Try ' + n + ': ' + why + ', ' + Math.round(performance.now() - t0) + ' ms.');
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  }

  // ---------- S8 speech ----------
  function jaVoices() {
    return (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter(function (v) { return /^ja(-|_|$)/i.test(v.lang); });
  }
  function speechBox() {
    var play = el('button', { 'class': 'primary', text: 'Play Japanese', on: { click: function () {
      var vs = jaVoices();
      if (!window.speechSynthesis) return record('S8', 'fail', 'No speechSynthesis API.');
      var u = new SpeechSynthesisUtterance('こんにちは。駅はどこですか。');
      u.lang = 'ja-JP'; if (vs[0]) u.voice = vs[0];
      u.onend = function () { record('S8', undefined, 'Japanese voices: ' + (vs.map(function (v) { return v.name; }).join(', ') || 'none listed') + '\nPlayback finished.'); };
      u.onerror = function (e) { record('S8', 'fail', 'Speech error: ' + e.error); };
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } } });
    return el('div', {}, [el('p', { 'class': 'detail ja', text: 'こんにちは。駅はどこですか。' }),
      el('div', { 'class': 'row' }, [play]), passFail('S8')]);
  }

  // ---------- S9 wake lock ----------
  var wakeSentinel = null;
  function testWake() {
    if (!('wakeLock' in navigator)) return record('S9', 'fail', 'Wake Lock API missing. The app would show "Turn brightness up" instead.');
    navigator.wakeLock.request('screen').then(function (s) {
      wakeSentinel = s;
      record('S9', undefined, 'Wake lock granted at ' + stamp(new Date()) + '. Releasing in 2 minutes.');
      s.addEventListener('release', function () { record('S9', undefined, 'Wake lock released at ' + stamp(new Date()) + '.'); });
      setTimeout(function () { if (wakeSentinel) { wakeSentinel.release(); wakeSentinel = null; } }, 120000);
    }).catch(function (e) { record('S9', 'fail', 'Wake lock refused: ' + e.name + ' ' + e.message); });
  }

  // ---------- results ----------
  function summary() {
    var ua = navigator.userAgent;
    var lines = ['Brillo spike results (' + VERSION + ')',
      'Phone: ' + (state.meta.owner || '?') + ' · iOS ' + (state.meta.ios || '? (typed version missing)') + ' · copied from: ' + mode() + ' · ' + stamp(new Date()),
      'User agent: ' + ua, ''];
    TESTS.forEach(function (t) {
      var ids = t.links ? LINKS.map(function (l) { return l; }) : [t];
      if (t.links) lines.push('S6 Links out');
      ids.forEach(function (x) {
        var r = state.results[x.id] || {};
        lines.push('[' + (r.status || 'not run').toUpperCase() + '] ' + x.id + ' ' + (x.title || x.name) +
          (r.mode ? ' · ' + r.mode : ''));
        if (r.detail) lines.push('    ' + r.detail.replace(/\n/g, '\n    '));
      });
    });
    return lines.join('\n');
  }
  function copyResults() {
    var text = summary();
    var done = function () { $('copy-detail').textContent = 'Copied ' + text.split('\n').length + ' lines.'; toast('Results copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = el('textarea', {}); ta.value = text; document.body.appendChild(ta);
    ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta);
  }

  // ---------- boot ----------
  function boot() {
    Promise.all([get('results'), get('setup'), get('meta')]).then(function (v) {
      state.results = v[0] || {}; state.setup = v[1] || null; state.meta = v[2] || {};
    }).catch(function () {
      $('context').textContent = 'Storage unavailable on this phone.';
    }).then(function () {
      $('context').textContent = 'Version ' + VERSION + ' · running as a ' + mode() + ' · loaded ' + stamp(LOADED_AT);
      render();
      $('copy').addEventListener('click', copyResults);
      $('reset').addEventListener('click', function () {
        if (!confirm('Clear all recorded results on this phone? The setup code stays.')) return;
        state.results = {}; put('results', {}).then(function () { location.reload(); });
      });
      testStandalone();
      testStorage().then(checkReturn);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(testOffline, function (e) {
          record('S3', 'fail', 'Service worker failed to register: ' + e.message);
        });
      } else testOffline();
      if (window.speechSynthesis) speechSynthesis.getVoices();  // warm the voice list
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { checkReturn(); testOffline(); }
    });
    window.addEventListener('online', testOffline);
    window.addEventListener('offline', testOffline);
  }
  boot();
})();
