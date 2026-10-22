/**
 * Brillo Travel — Apps Script web app bound to the trip sheet (HANDOFF §6).
 *
 * Deploy as two script files: this one (Code.gs) and Parse.gs, which is an
 * exact copy of js/parse.js (the same parsing and V-rules the phone runs).
 *
 * Script Properties: API_TOKEN (32+ random chars), ENV = staging | prod.
 * Actions: ping, snapshot, mutate (Phase 2 write path), resetStaging (staging only).
 */

var SERVER_VERSION = '0.2.1';
var API = 1;
var READ_TABS = ['Settings', 'Itinerary', 'Hotels', 'Transportation', 'Expenses', 'Ideas', 'Checklists', 'Phrases'];
var ID_PREFIX = { Itinerary: 'it_', Hotels: 'ho_', Transportation: 'tr_', Expenses: 'ex_', Ideas: 'id_', Checklists: 'ck_', Phrases: 'ph_' };
var LOCK_WAIT_MS = 20000;
var MAX_OPS = 100;

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
      case 'mutate':
        return json_(mutate_(body, env));
      case 'resetStaging':
        if (env !== 'staging') return json_(fail_('AUTH', 'resetStaging is only allowed in staging'));
        return json_(resetStaging_());
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
  withLock_(function () {
    ensureIds_(ss);
    READ_TABS.forEach(function (name) {
      var sh = ss.getSheetByName(name);
      raw[name] = sh ? readRaw_(sh, tz) : null;
    });
  });
  var parsed = BT.parse.snapshot(raw);
  var rev = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, JSON.stringify(parsed.data), Utilities.Charset.UTF_8));
  return { ok: true, api: API, serverVersion: SERVER_VERSION, env: env, rev: rev,
    generatedAt: new Date().toISOString(), data: parsed.data, issues: parsed.issues };
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
  } catch (e) {
    throw { code: 'LOCK_TIMEOUT' };
  }
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---------- mutate (HANDOFF §6 Server rules) ----------
// Each op type: which tab it writes, how (upsert / update / delete) and which fields
// a phone may send. Field keys and types come from BT.parse.TABS, so the phone and
// the script share one column map.
var OPS = {
  'checklist.add': { tab: 'checklists', mode: 'upsert', fields: ['list', 'item', 'owner', 'bag', 'due', 'notes', 'sort'] },
  'checklist.update': { tab: 'checklists', mode: 'update', fields: ['item', 'owner', 'bag', 'due', 'notes', 'sort', 'done', 'doneBy'] },
  'checklist.delete': { tab: 'checklists', mode: 'delete', fields: [] },
  'expense.upsert': { tab: 'expenses', mode: 'upsert', fields: ['createdAt', 'tripDate', 'amount', 'currency', 'envelope', 'category', 'method', 'paidBy', 'note', 'taxFree', 'refundStatus'] },
  'expense.delete': { tab: 'expenses', mode: 'delete', fields: [] },
  'idea.add': { tab: 'ideas', mode: 'upsert', fields: ['nameEn', 'nameJa', 'city', 'area', 'category', 'lat', 'lng', 'maps', 'why', 'hours', 'allergyNote', 'source', 'status', 'plannedDate', 'addedBy'] },
  'idea.update': { tab: 'ideas', mode: 'update', fields: ['status', 'plannedDate'] },
  'itinerary.setDone': { tab: 'itinerary', mode: 'update', fields: ['done'], required: ['done'] }
};
// Allowed values where the sheet has a dropdown (HANDOFF §5); blank is always allowed.
var ENUMS = {
  'checklists.owner': ['Jordan', 'Lindsay', 'Both'],
  'checklists.bag': ['Suitcase', 'Jordan backpack', 'Lindsay backpack', '—'],
  'expenses.currency': ['JPY', 'USD'],
  'ideas.city': ['Osaka', 'Kyoto', 'Tokyo', 'Travel'],
  'ideas.category': ['Food', 'Sight', 'Shopping', 'Café', 'Bar', 'Market', 'Other'],
  'ideas.status': ['Idea', 'Planned', 'Done', 'Skip'],
  'ideas.source': ['Curated', 'Jordan', 'Lindsay']
};
var REQUIRED = { checklists: ['list', 'item'], expenses: ['tripDate', 'amount', 'currency', 'envelope', 'category'], ideas: ['nameEn'] };
var TAB_PREFIX = { itinerary: 'it_', checklists: 'ck_', expenses: 'ex_', ideas: 'id_' };
var FINAL_RESULTS = { applied: 1, stale: 1, duplicate: 1 };
var MAX_TEXT = 2000;
var FUTURE_SLACK_MS = 24 * 3600 * 1000;   // a phone clock a day ahead is broken, not "later"

function mutate_(body, env) {
  var ops = body.ops;
  if (!Array.isArray(ops)) return fail_('BAD_REQUEST', 'ops must be an array');
  if (ops.length > MAX_OPS) return fail_('BAD_REQUEST', 'At most ' + MAX_OPS + ' ops per call');
  var device = typeof body.device === 'string' ? body.device.slice(0, 60) : '';
  return withLock_(function () {
    var ss = SpreadsheetApp.getActive();
    var log = openLog_(ss);
    var tables = {};
    var now = new Date();
    var logRows = [];
    var results = ops.map(function (op) {
      var r;
      try { r = applyOp_(ss, tables, log, op, device, now); } catch (e) {
        if (e && e.code === 'LOCK_TIMEOUT') throw e;
        r = { status: 'rejected', reason: 'Server error: ' + String(e && e.message || e) };
      }
      var opId = op && typeof op.opId === 'string' ? op.opId.slice(0, 80) : '';
      r.opId = opId;
      if (opId) {
        log.seen[opId] = r.status;
        // Every logged string is client-supplied: store it as text, never as a formula.
        logRows.push([opId, now.toISOString(), device, op && op.type, op && op.id, r.status, r.reason].map(function (v) {
          return cellValue_('text', v === null || v === undefined ? '' : String(v).slice(0, 200));
        }));
      }
      return r;
    });
    appendRows_(log.sh, logRows, log.values);
    return { ok: true, api: API, serverVersion: SERVER_VERSION, env: env, results: results };
  });
}

function applyOp_(ss, tables, log, op, device, now) {
  if (!op || typeof op !== 'object') return rejected_('Op is not an object');
  if (typeof op.type !== 'string' || typeof op.opId !== 'string' || !/^op_[A-Za-z0-9_-]{6,64}$/.test(op.opId)) return rejected_('Missing or bad opId');
  if (FINAL_RESULTS[log.seen[op.opId]]) return { status: 'duplicate' };
  var spec = OPS[op.type];
  if (!spec) return rejected_('Unknown op type ' + String(op.type).slice(0, 40));
  var prefix = TAB_PREFIX[spec.tab];
  if (typeof op.id !== 'string' || op.id.indexOf(prefix) !== 0 || !/^[a-z]{2}_[A-Za-z0-9]{1,32}$/.test(op.id)) return rejected_('Missing or bad ID');
  var at = Date.parse(op.clientUpdatedAt);
  if (typeof op.clientUpdatedAt !== 'string' || isNaN(at)) return rejected_('Missing or bad clientUpdatedAt');
  if (at > now.getTime() + FUTURE_SLACK_MS) return rejected_('This phone\'s clock is more than a day ahead. Fix the date and time, then retry.');
  var fields = op.fields || {};
  if (typeof fields !== 'object' || Array.isArray(fields)) return rejected_('fields must be an object');

  var t = table_(ss, tables, spec.tab);
  if (!t) return rejected_('The ' + BT.parse.TABS[spec.tab].tab + ' tab is missing or has no ID column');
  var clean = {};
  var keys = Object.keys(fields);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (spec.fields.indexOf(k) < 0) return rejected_('Field ' + k.slice(0, 40) + ' isn\'t allowed for ' + op.type);
    var v = checkValue_(spec.tab, k, t.types[k], fields[k]);
    if (v && v.error) return rejected_(v.error);
    clean[k] = v.value;
  }
  var rowNo = t.rowOf[op.id];
  // Someone may have sorted or inserted rows since this call read the tab (human edits
  // don't take the script lock): confirm the row still holds this ID, else find it again.
  if (rowNo && String(t.sh.getRange(rowNo, t.col.id + 1).getValue()) !== op.id) {
    delete tables[spec.tab];
    t = table_(ss, tables, spec.tab);
    rowNo = t && t.rowOf[op.id];
  }
  if (!t) return rejected_('The ' + BT.parse.TABS[spec.tab].tab + ' tab is missing or has no ID column');
  if (!rowNo && spec.mode !== 'upsert') return rejected_('Not found in the sheet (it may have been deleted there)');
  // Required columns: present on a new row, and never blanked by a later edit.
  var blanked = (REQUIRED[spec.tab] || []).filter(function (k) { return clean[k] === '' || (!rowNo && clean[k] === undefined); });
  if (blanked.length) return rejected_((rowNo ? 'Can\'t clear ' : 'Missing ') + blanked.join(', '));
  var missing = (spec.required || []).filter(function (k) { return clean[k] === undefined || clean[k] === ''; });
  if (missing.length) return rejected_('Missing ' + missing.join(', '));
  var updatedKey = spec.tab === 'itinerary' ? 'updated' : 'updatedAt';
  var iso = new Date(at).toISOString();
  // Every column this op writes must exist. A renamed header would otherwise drop the
  // value while the phone hears "applied" (ship-check 2026-10-21).
  var needs = Object.keys(clean).concat([updatedKey]);
  if (spec.mode === 'delete') needs.push('deleted');
  if (spec.tab === 'checklists' && ('done' in clean || !rowNo)) needs.push('done', 'doneBy', 'doneAt');
  var gone = needs.filter(function (k) { return t.col[k] === undefined; });
  if (gone.length) return rejected_('The ' + BT.parse.TABS[spec.tab].tab + ' tab has no ' + gone.map(function (k) { return '"' + header_(spec.tab, k) + '"'; }).join(', ') +
    ' column. Restore the header in row 1, then retry.');

  if (rowNo) {
    // Last write wins per entity (HANDOFF §6): a newer stored edit beats this op.
    var stored = t.values[rowNo - 1][t.col[updatedKey]];
    var storedAt = stored instanceof Date ? stored.getTime() : Date.parse(stored);
    if (!isNaN(storedAt) && storedAt >= at) {
      return { status: 'stale', serverUpdatedAt: new Date(storedAt).toISOString() };
    }
    if (spec.mode === 'delete') clean.deleted = true;
    if (spec.tab === 'checklists' && 'done' in clean) {
      clean.doneAt = clean.done ? iso : '';
      if (!clean.done) clean.doneBy = '';
    }
    clean[updatedKey] = iso;
    writeCells_(t, rowNo, clean, op.id, function () {
      delete tables[spec.tab];
      var t2 = table_(ss, tables, spec.tab);
      return t2 && t2.rowOf[op.id] ? { t: t2, rowNo: t2.rowOf[op.id] } : null;
    });
  } else {
    if (spec.tab === 'checklists') clean.done = false;
    if (spec.tab === 'expenses') { clean.device = device; if (!clean.createdAt) clean.createdAt = iso; }
    if (t.col.deleted !== undefined) clean.deleted = false;
    clean.id = op.id;
    clean[updatedKey] = iso;
    rowNo = appendObject_(t, clean);
  }
  return { status: 'applied', serverUpdatedAt: iso };
}

function rejected_(reason) { return { status: 'rejected', reason: reason }; }

// The sheet header for a field key, for messages ("Done", "Updated at").
function header_(tab, key) {
  var c = BT.parse.TABS[tab].cols.filter(function (x) { return x[1] === key; })[0];
  return c ? c[0] : key;
}

// Validate one field against its column type; returns { value } or { error }.
function checkValue_(tab, key, type, v) {
  var label = key;
  if (v === null || v === undefined || v === '') return { value: '' };
  switch (type) {
    case 'bool':
      return typeof v === 'boolean' ? { value: v } : { error: label + ' must be true or false' };
    case 'date':
      return typeof v === 'string' && BT.parse.isIsoDate(v) ? { value: v } : { error: label + ' must be a YYYY-MM-DD date' };
    case 'money':
      return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= 0 && v < 1e9 ? { value: v } : { error: label + ' must be a whole number' };
    case 'number':
      return typeof v === 'number' && isFinite(v) ? { value: v } : { error: label + ' must be a number' };
    default:
      if (typeof v !== 'string') return { error: label + ' must be text' };
      if (v.length > MAX_TEXT) return { error: label + ' is too long' };
      var allowed = ENUMS[tab + '.' + key];
      if (allowed && allowed.indexOf(v) < 0) return { error: label + ' must be one of ' + allowed.join(', ') };
      return { value: v };
  }
}

// One tab, read once per mutate call: header → column, ID → row number (1-based).
function table_(ss, tables, key) {
  if (key in tables) return tables[key];
  var schema = BT.parse.TABS[key];
  var sh = ss.getSheetByName(schema.tab);
  if (!sh) return (tables[key] = null);
  var values = sh.getDataRange().getValues();
  var idx = BT.parse.headerIndex(values[0] || []);
  var col = {}, types = {};
  schema.cols.forEach(function (c) {
    var i = idx[BT.parse.norm(c[0])];
    if (i !== undefined) col[c[1]] = i;
    types[c[1]] = c[2] || 'text';
  });
  if (col.id === undefined) return (tables[key] = null);
  var rowOf = {};
  for (var r = 1; r < values.length; r++) {
    var id = values[r][col.id];
    if (id !== '' && id !== null && !rowOf[String(id)]) rowOf[String(id)] = r + 1;
  }
  return (tables[key] = { sh: sh, values: values, col: col, types: types, rowOf: rowOf, width: values[0].length });
}

// Text goes in with a leading apostrophe, the way a person types plain text: the sheet
// stores it as text, never as a formula or an auto-detected date (=, +, -, @, ISO times).
function cellValue_(type, v) {
  if (v === '' || v === null || v === undefined) return '';
  if (type === 'text') return "'" + v;
  return v;   // booleans and numbers as-is; YYYY-MM-DD dates are read as dates, like typing them
}

// Writes only the cells this op changes, one call per run of adjacent columns (a tick is
// two calls, not four). Before each later run the row's ID is checked again, so a person
// sorting the tab mid-write can't split a change across two rows. Cells the op doesn't
// change are never rewritten, so formulas, links and times around them stay untouched
// (ship-check 2026-10-21).
function writeCells_(t, rowNo, obj, id, refind) {
  var cols = Object.keys(obj).filter(function (k) { return t.col[k] !== undefined; })
    .map(function (k) { return { c: t.col[k], k: k }; }).sort(function (a, b) { return a.c - b.c; });
  var runs = [];
  cols.forEach(function (x) {
    var last = runs[runs.length - 1];
    if (last && x.c === last[last.length - 1].c + 1) last.push(x); else runs.push([x]);
  });
  runs.forEach(function (run, i) {
    if (i > 0 && String(t.sh.getRange(rowNo, t.col.id + 1).getValue()) !== id) {
      var found = refind();
      if (!found) throw new Error('The row moved or was deleted while it was being written');
      t = found.t; rowNo = found.rowNo;
    }
    t.sh.getRange(rowNo, run[0].c + 1, 1, run.length).setValues([run.map(function (x) { return cellValue_(t.types[x.k], obj[x.k]); })]);
    run.forEach(function (x) { t.values[rowNo - 1][x.c] = obj[x.k]; });
  });
}

function appendObject_(t, obj) {
  var row = [];
  for (var i = 0; i < t.width; i++) row.push('');
  Object.keys(obj).forEach(function (k) { if (t.col[k] !== undefined) row[t.col[k]] = cellValue_(t.types[k], obj[k]); });
  var rowNo = appendRows_(t.sh, [row], t.values);
  t.rowOf[obj.id] = rowNo;
  return rowNo;
}

// Write rows after the last row with content (FALSE checkboxes don't count). Returns
// the first row number written. Rows are never deleted (HANDOFF §6). `values` is the
// caller's current copy of the tab, so a batch doesn't re-read it for every row.
function appendRows_(sh, rows, values) {
  if (!rows.length) return 0;
  values = values || sh.getDataRange().getValues();
  var last = values.length;
  while (last > 1 && values[last - 1].every(function (v) { return v === '' || v === null || v === false; })) last--;
  var start = last + 1;
  var need = start + rows.length - 1;
  var max = sh.getMaxRows();
  if (need > max) sh.insertRowsAfter(max, need - max + 50);
  sh.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
  for (var i = 0; i < rows.length; i++) values[start - 1 + i] = rows[i].map(function (v) { return typeof v === 'string' && v.charAt(0) === "'" ? v.slice(1) : v; });
  return start;
}

// _SyncLog: opId → last result, for idempotency (HANDOFF §6).
function openLog_(ss) {
  var sh = ss.getSheetByName('_SyncLog');
  if (!sh) throw new Error('The _SyncLog tab is missing');
  var values = sh.getDataRange().getValues();
  var seen = {};
  for (var r = 1; r < values.length; r++) if (values[r][0]) seen[String(values[r][0])] = String(values[r][5] || '');
  return { sh: sh, seen: seen, values: values };
}

// ---------- resetStaging (staging only) ----------
// The live harness (tests/live-staging.html) only creates entities whose IDs have an
// uppercase T after the prefix (ck_T…, ex_T…, id_T…). The script's own IDs are
// lowercase, so this clears exactly the test rows and their log lines, and leaves the
// staging trip data alone. Cells are cleared, not deleted.
var TEST_ID = /^[a-z]{2}_T/;
function resetStaging_() {
  return withLock_(function () {
    var ss = SpreadsheetApp.getActive();
    var cleared = 0;
    [['Checklists', 0], ['Expenses', 0], ['Ideas', 0], ['_SyncLog', 4]].forEach(function (p) {
      var sh = ss.getSheetByName(p[0]);
      if (!sh) return;
      var values = sh.getDataRange().getValues();
      var col = p[1];
      if (p[0] !== '_SyncLog') {
        var idx = BT.parse.headerIndex(values[0] || []);
        col = idx.id;
        if (col === undefined) return;
      }
      for (var r = 1; r < values.length; r++) {
        if (!TEST_ID.test(String(values[r][col] || ''))) continue;
        var blank = values[r].map(function () { return ''; });
        sh.getRange(r + 1, 1, 1, blank.length).setValues([blank]);
        cleared++;
      }
    });
    return { ok: true, api: API, serverVersion: SERVER_VERSION, env: 'staging', cleared: cleared };
  });
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
