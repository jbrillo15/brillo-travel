/* Code.gs against stubbed Apps Script services (HANDOFF §12 L2, stubbed). */
suite('server', function () {
  function pt(d, t) { return BT.time.zonedToInstant(d, t || '00:00', 'America/Los_Angeles'); }
  function tabs(mutate) {
    var raw = FIXTURES.sheet();
    var out = {};
    Object.keys(raw).forEach(function (k) { out[k] = { values: raw[k].values }; });
    out.Hotels.displayOverride = { 1: { 12: '11112222333344445' } };
    if (mutate) mutate(out);
    return out;
  }
  function snap() { return STUB.post({ token: STUB.token(), action: 'snapshot', device: 'test', appVersion: '0.1.0' }); }
  function idCol(tab) { return STUB.sheets[tab].rows.slice(1).map(function (r) { return r[0]; }); }

  test('not JSON → BAD_REQUEST', function () {
    STUB.reset(tabs());
    var r = STUB.post('{oops');
    eq(r.ok, false); eq(r.api, 1); eq(r.code, 'BAD_REQUEST');
  });

  test('EC-26: missing or wrong token → AUTH, and the reply never echoes the token', function () {
    STUB.reset(tabs());
    eq(STUB.post({ action: 'snapshot' }).code, 'AUTH');
    var r = STUB.post({ token: STUB.token() + 'x', action: 'snapshot' });
    eq(r.code, 'AUTH');
    ok(JSON.stringify(r).indexOf(STUB.token()) < 0);
    STUB.reset(tabs(), { ENV: 'staging' });                     // no token configured at all
    eq(STUB.post({ token: '', action: 'snapshot' }).code, 'AUTH');
  });

  test('unknown action and GET → BAD_REQUEST', function () {
    STUB.reset(tabs());
    eq(STUB.post({ token: STUB.token(), action: 'drop tables' }).code, 'BAD_REQUEST');
    eq(JSON.parse(doGet().content).code, 'BAD_REQUEST');
  });

  test('ping echoes Japanese and emoji (EC-15) and reports env', function () {
    STUB.reset(tabs());
    var r = STUB.post({ token: STUB.token(), action: 'ping', echo: '日本語 🍣' });
    eq(r.ok, true); eq(r.env, 'staging'); eq(r.echo, '日本語 🍣');
  });

  test('snapshot: response shape (HANDOFF §6)', function () {
    STUB.reset(tabs());
    var r = snap();
    eq(r.ok, true); eq(r.api, 1); eq(r.serverVersion, '0.1.0'); eq(r.env, 'staging');
    ok(/^[0-9a-f]{16}$/.test(r.rev), 'rev hex');
    ok(!isNaN(Date.parse(r.generatedAt)));
    deepEq(Object.keys(r.data).sort(), ['checklists', 'expenses', 'hotels', 'ideas', 'itinerary', 'phrases', 'settings', 'transportation']);
    ok(Array.isArray(r.issues));
    eq(STUB.lockReleased, 1, 'lock released');
  });

  test('EC-16: rows without IDs get one; blank rows and existing IDs are left alone; one write per tab', function () {
    STUB.reset(tabs(function (t) {
      t.Itinerary.values[2][0] = '';
      t.Itinerary.values[6][0] = '';
      t.Checklists.values[1][0] = '';
    }));
    snap();
    var ids = idCol('Itinerary');
    ok(/^it_[a-z2-9]{6}$/.test(ids[1]), 'new itinerary id: ' + ids[1]);
    ok(/^it_[a-z2-9]{6}$/.test(ids[5]));
    eq(ids[0], 'it_a1', 'existing id untouched');
    eq(ids[4], '', 'blank row stays blank');
    ok(/^ck_/.test(idCol('Checklists')[0]));
    eq(idCol('Checklists')[1], '', 'blank checklist row (FALSE checkbox) gets no ID');
    eq(STUB.writes.length, 3, 'one write per missing ID, nothing else');
    eq(STUB.writes.filter(function (w) { return w.col !== 1 || w.n !== 1; }).length, 0, 'only single ID cells are written');
  });

  test('EC-16: a second snapshot assigns nothing new and returns the same rev', function () {
    STUB.reset(tabs(function (t) { t.Itinerary.values[2][0] = ''; }));
    var a = snap();
    var before = idCol('Itinerary').join();
    STUB.writes = [];
    var b = snap();
    eq(STUB.writes.length, 0);
    eq(idCol('Itinerary').join(), before);
    eq(a.rev, b.rev);
  });

  test('EC-10: IDs move with their rows when rows are sorted', function () {
    STUB.reset(tabs(function (t) { t.Itinerary.values[2][0] = ''; }));
    snap();
    var rows = STUB.sheets.Itinerary.rows;
    var landId = rows[2][0];
    var header = rows.shift(); rows.reverse(); rows.unshift(header);    // Lindsay sorts the tab
    var r = snap();
    var land = r.data.itinerary.filter(function (x) { return x.title === 'Land and train to the hotel'; })[0];
    eq(land.id, landId);
  });

  test('rev changes when the data changes', function () {
    STUB.reset(tabs());
    var a = snap().rev;
    STUB.sheets.Itinerary.rows[1][11] = 'new note';
    ok(snap().rev !== a);
  });

  test('busy lock → LOCK_TIMEOUT, nothing written', function () {
    STUB.reset(tabs(function (t) { t.Itinerary.values[2][0] = ''; }));
    STUB.lockBusy = true;
    var r = snap();
    eq(r.code, 'LOCK_TIMEOUT');
    eq(STUB.writes.length, 0);
  });

  test('Date cells: calendar dates, timestamps and time-only cells', function () {
    STUB.reset(tabs(function (t) {
      t.Itinerary.values[2][1] = pt('2026-11-19');                          // date cell
      t.Itinerary.values[2][2] = new Date(1899, 11, 30, 16, 55);            // time-only cell…
      t.Itinerary.values[2][17] = new Date('2026-10-14T20:15:00Z');         // timestamp
      t.Itinerary.displayOverride = { 2: { 2: '4:55:00 PM' } };             // …read via its display text
    }));
    var r = snap();
    var land = r.data.itinerary.filter(function (x) { return x.id === 'it_a2'; })[0];
    eq(land.date, '2026-11-19');
    eq(land.time, '16:55');
    eq(land.updated, '2026-10-14T20:15:00.000Z');
  });

  test('17-digit confirmation stored as a number comes through as exact text', function () {
    STUB.reset(tabs());
    eq(snap().data.hotels[0].confirmation, '11112222333344445');
  });

  test('V-09: a missing tab is reported; the snapshot still succeeds', function () {
    STUB.reset(tabs(function (t) { delete t.Ideas; }));
    var r = snap();
    eq(r.ok, true);
    eq(r.data.ideas, null);
    ok(r.issues.some(function (i) { return i.id === 'V-09' && i.tab === 'Ideas'; }));
  });

  test('resetStaging: refused in prod, not yet available in staging', function () {
    STUB.reset(tabs(), { API_TOKEN: 'test-token-0123456789-0123456789-abc', ENV: 'prod' });
    eq(STUB.post({ token: STUB.token(), action: 'resetStaging' }).code, 'AUTH');
    STUB.reset(tabs());
    eq(STUB.post({ token: STUB.token(), action: 'resetStaging' }).code, 'BAD_REQUEST');
  });

  test('unexpected failure → INTERNAL JSON, lock released', function () {
    STUB.reset(tabs());
    var real = SpreadsheetApp.getActive;
    SpreadsheetApp.getActive = function () { var ss = real(); ss.getSheetByName = function () { throw new Error('boom'); }; return ss; };
    try {
      var r = snap();
      eq(r.code, 'INTERNAL');
      eq(STUB.lockReleased, 1);
    } finally { SpreadsheetApp.getActive = real; }
  });
});
