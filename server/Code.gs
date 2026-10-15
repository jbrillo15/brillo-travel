/**
 * Brillo Travel — Apps Script web app bound to the trip sheet (HANDOFF §6).
 *
 * Deploy as two script files: this one (Code.gs) and Parse.gs, which is an
 * exact copy of js/parse.js (the same parsing and V-rules the phone runs).
 *
 * Script Properties: API_TOKEN (32+ random chars), ENV = staging | prod.
 * Phase 1 (read path): ping, snapshot. Writes (mutate) arrive in Phase 2.
 */

var SERVER_VERSION = '0.1.0';
var API = 1;
var READ_TABS = ['Settings', 'Itinerary', 'Hotels', 'Transportation', 'Expenses', 'Ideas', 'Checklists', 'Phrases'];
var ID_PREFIX = { Itinerary: 'it_', Hotels: 'ho_', Transportation: 'tr_', Expenses: 'ex_', Ideas: 'id_', Checklists: 'ck_', Phrases: 'ph_' };
var LOCK_WAIT_MS = 20000;

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e && e.postData && e.postData.contents);
  } catch (err) {
    return json_(fail_('BAD_REQUEST', 'Body is not JSON'));
  }
  if (!body || typeof body !== 'object') return json_(fail_('BAD_REQUEST', 'Body must be a JSON object'));

  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('API_TOKEN');
  if (!token || typeof body.token !== 'string' || !sameString_(body.token, token)) {
    return json_(fail_('AUTH', 'Token missing or wrong'));
  }
  var env = props.getProperty('ENV') || 'unset';

  try {
    switch (body.action) {
      case 'snapshot':
        return json_(snapshot_(env));
      case 'ping':   // kept so the Phase 0 spike page still works against this script
        return json_({ ok: true, api: API, env: env, serverVersion: SERVER_VERSION,
          echo: body.echo === undefined ? null : body.echo, receivedAt: new Date().toISOString() });
      case 'resetStaging':
        if (env !== 'staging') return json_(fail_('AUTH', 'resetStaging is only allowed in staging'));
        return json_(fail_('BAD_REQUEST', 'resetStaging arrives with the Phase 2 live tests'));
      default:
        return json_(fail_('BAD_REQUEST', 'Unknown action'));
    }
  } catch (err) {
    if (err && err.code === 'LOCK_TIMEOUT') return json_(fail_('LOCK_TIMEOUT', 'The sheet is busy. Try again.'));
    return json_(fail_('INTERNAL', String(err && err.message || err)));
  }
}

function doGet() {
  return json_(fail_('BAD_REQUEST', 'Use POST'));
}

function snapshot_(env) {
  var ss = SpreadsheetApp.getActive();
  var tz = ss.getSpreadsheetTimeZone();
  var raw = {};
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
  } catch (e) {
    throw { code: 'LOCK_TIMEOUT' };
  }
  try {
    ensureIds_(ss);
    READ_TABS.forEach(function (name) {
      var sh = ss.getSheetByName(name);
      raw[name] = sh ? readRaw_(sh, tz) : null;
    });
  } finally {
    lock.releaseLock();
  }
  var parsed = BT.parse.snapshot(raw);
  var rev = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, JSON.stringify(parsed.data), Utilities.Charset.UTF_8));
  return { ok: true, api: API, serverVersion: SERVER_VERSION, env: env, rev: rev,
    generatedAt: new Date().toISOString(), data: parsed.data, issues: parsed.issues };
}

// Values with Dates normalized: calendar dates → 'YYYY-MM-DD' (in the sheet's zone),
// timestamps → ISO, and time-only cells → their display text (Apps Script reports them
// as 1899 dates with a historical zone offset, so the clock value can't be trusted).
function readRaw_(sh, tz) {
  var range = sh.getDataRange();
  var values = range.getValues();
  var display = range.getDisplayValues();
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      var v = values[r][c];
      if (Object.prototype.toString.call(v) !== '[object Date]') continue;
      if (v.getFullYear() < 1900) values[r][c] = display[r][c];
      else if (Utilities.formatDate(v, tz, 'HH:mm:ss') === '00:00:00') values[r][c] = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      else values[r][c] = v.toISOString();
    }
  }
  return { values: values, display: display };
}

// Give every non-blank row an ID (HANDOFF §5). Runs under the script lock (EC-16, EC-17).
function ensureIds_(ss) {
  Object.keys(ID_PREFIX).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) return;
    var values = sh.getDataRange().getValues();
    if (values.length < 2) return;
    var col = -1;
    values[0].forEach(function (h, i) { if (col < 0 && String(h).trim().toLowerCase() === 'id') col = i; });
    if (col < 0) return;
    var used = {};
    for (var r = 1; r < values.length; r++) if (values[r][col]) used[String(values[r][col])] = true;
    // Write only the empty ID cells, never the whole column: if someone sorts or
    // inserts rows meanwhile, existing IDs are never overwritten (EC-10, F6).
    for (var k = 1; k < values.length; k++) {
      var row = values[k];
      if (row[col] !== '' && row[col] !== null) continue;
      if (row.every(function (v) { return v === '' || v === null || v === false; })) continue;
      var id;
      do { id = ID_PREFIX[name] + randomId_(6); } while (used[id]);
      used[id] = true;
      var cell = sh.getRange(k + 1, col + 1);
      if (cell.getValue() === '') cell.setValue(id);   // still empty at write time
    }
  });
}

function randomId_(n) {
  var chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  var s = '';
  for (var i = 0; i < n; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function sameString_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function fail_(code, message) {
  return { ok: false, api: API, code: code, message: message };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
