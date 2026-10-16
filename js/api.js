/* Talking to the Apps Script web app (HANDOFF §6 Transport).
   Every call is a text/plain POST (no CORS preflight) with the token in the
   body, never the URL. Anything that isn't JSON with `ok` and `api` is treated
   as a network failure (captive portals, Google error pages; EC-20). */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};

  function ApiError(kind, message, code) {
    this.kind = kind;          // offline | timeout | portal | auth | lock | server | bad | incompatible
    this.code = code || null;
    this.message = message;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.name = 'ApiError';

  // Overridable in tests.
  var api = {
    fetch: function (u, o) { return window.fetch(u, o); },
    timeoutMs: (BT.config && BT.config.requestTimeoutMs) || 20000,
    ApiError: ApiError
  };

  api.call = function (setup, action, extra) {
    if (!setup || !setup.apiUrl || !setup.token) return Promise.reject(new ApiError('auth', 'Setup code needed'));
    var body = { token: setup.token, action: action, device: setup.device || 'unknown', appVersion: BT.config.version };
    Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });

    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timedOut = false;
    var timer = setTimeout(function () { timedOut = true; if (ctrl) ctrl.abort(); }, api.timeoutMs);

    return Promise.resolve().then(function () {
      return api.fetch(setup.apiUrl, {
        method: 'POST', redirect: 'follow', cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined
      });
    }).then(function (res) {
      return res.text();
    }, function () {
      throw timedOut ? new ApiError('timeout', 'No answer after ' + Math.round(api.timeoutMs / 1000) + ' s')
        : new ApiError('offline', 'No connection');
    }).then(function (txt) {
      if (timedOut) throw new ApiError('timeout', 'No answer in time');
      var j;
      try { j = JSON.parse(txt); } catch (e) { throw new ApiError('portal', 'The network returned a web page instead of the sheet (Wi-Fi sign-in page?)'); }
      if (!j || typeof j.ok !== 'boolean' || !('api' in j)) throw new ApiError('portal', 'Unexpected reply');
      if (!j.ok) {
        var kind = j.code === 'AUTH' ? 'auth' : j.code === 'LOCK_TIMEOUT' ? 'lock' : j.code === 'BAD_REQUEST' ? 'bad' : 'server';
        throw new ApiError(kind, j.message || j.code, j.code);
      }
      return j;
    }).then(function (j) { clearTimeout(timer); return j; }, function (e) {
      clearTimeout(timer);
      throw e instanceof ApiError ? e : new ApiError('offline', String(e && e.message || e));
    });
  };

  // Setup code: base64 of {"env","apiUrl","token"} (HANDOFF §7). Never logged or shown.
  api.decodeSetup = function (raw) {
    var obj;
    try {
      var bin = atob(String(raw || '').replace(/\s+/g, ''));
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      obj = JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      throw new Error('That isn\'t a setup code. Copy the whole code and paste again.');
    }
    if (!obj || (obj.env !== 'staging' && obj.env !== 'prod')) throw new Error('This setup code doesn\'t say staging or prod.');
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(obj.apiUrl || '')) throw new Error('The script address in this code looks wrong.');
    if (typeof obj.token !== 'string' || obj.token.length < 32) throw new Error('The token in this code is missing or too short.');
    return { env: obj.env, apiUrl: obj.apiUrl, token: obj.token };
  };

  BT.api = api;
})();
