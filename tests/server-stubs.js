/* In-memory stand-ins for the Apps Script services Code.gs uses
   (HANDOFF §12 L2, stubbed). Each test calls STUB.reset(tabs, props). */
(function () {
  'use strict';
  var STUB = window.STUB = { writes: [], lockBusy: false, lockReleased: 0 };

  function fmtDate(d, tz, pattern) {
    var p = BT.time.partsIn(d, tz);
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return pattern.replace('yyyy', p.y).replace('MM', pad(p.m)).replace('dd', pad(p.d))
      .replace('HH', pad(p.hh)).replace('mm', pad(p.mm)).replace('ss', pad(p.ss));
  }

  function Sheet(name, rows, display) {
    this.name = name;
    this.rows = rows;                              // live 2D values
    this.display = display || null;                // optional display override
  }
  Sheet.prototype.getDataRange = function () {
    var sh = this;
    return {
      getValues: function () { return sh.rows.map(function (r) { return r.slice(); }); },
      getDisplayValues: function () {
        return sh.rows.map(function (r, i) {
          return r.map(function (v, j) {
            if (sh.display && sh.display[i] && sh.display[i][j] !== undefined) return sh.display[i][j];
            return v === null || v === undefined ? '' : String(v);
          });
        });
      }
    };
  };
  Sheet.prototype.getRange = function (row, col, nRows, nCols) {
    var sh = this;
    return {
      setValues: function (vals) {
        STUB.writes.push({ tab: sh.name, row: row, col: col, n: vals.length });
        for (var i = 0; i < (nRows || 1); i++) for (var j = 0; j < (nCols || 1); j++) sh.rows[row - 1 + i][col - 1 + j] = vals[i][j];
      },
      setValue: function (v) { this.setValues([[v]]); },
      getValue: function () { return sh.rows[row - 1][col - 1]; }
    };
  };

  STUB.reset = function (tabs, props) {
    STUB.writes = [];
    STUB.lockBusy = false;
    STUB.lockReleased = 0;
    STUB.sheets = {};
    Object.keys(tabs).forEach(function (name) {
      var t = tabs[name];
      STUB.sheets[name] = new Sheet(name, t.values.map(function (r) { return r.slice(); }), t.displayOverride);
    });
    STUB.props = props || { API_TOKEN: 'test-token-0123456789-0123456789-abc', ENV: 'staging' };
  };

  window.SpreadsheetApp = {
    getActive: function () {
      return {
        getSpreadsheetTimeZone: function () { return 'America/Los_Angeles'; },
        getSheetByName: function (n) { return STUB.sheets[n] || null; }
      };
    }
  };
  window.LockService = {
    getScriptLock: function () {
      return {
        waitLock: function () { if (STUB.lockBusy) throw new Error('Lock timeout'); },
        releaseLock: function () { STUB.lockReleased++; }
      };
    }
  };
  window.PropertiesService = {
    getScriptProperties: function () { return { getProperty: function (k) { return STUB.props[k] || null; } }; }
  };
  window.ContentService = {
    MimeType: { JSON: 'application/json' },
    createTextOutput: function (s) {
      return { content: s, setMimeType: function (m) { this.mime = m; return this; } };
    }
  };
  window.Utilities = {
    DigestAlgorithm: { SHA_1: 'SHA_1' },
    Charset: { UTF_8: 'UTF_8' },
    formatDate: fmtDate,
    // Not SHA-1; a stable stand-in that changes when the input changes.
    computeDigest: function (alg, s) {
      var h = [0, 0, 0, 0, 0, 0, 0, 0];
      for (var i = 0; i < s.length; i++) h[i % 8] = (h[i % 8] * 31 + s.charCodeAt(i)) & 0xff;
      return h.map(function (b) { return b > 127 ? b - 256 : b; });
    }
  };

  // Call doPost like the web app would and parse the JSON reply.
  STUB.post = function (body) {
    var out = window.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } });
    if (out.mime !== 'application/json') throw new Error('reply is not JSON');
    return JSON.parse(out.content);
  };
  STUB.token = function () { return STUB.props.API_TOKEN; };
})();
