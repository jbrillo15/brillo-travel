/* parse.js tests: every V-rule, EC-11..14, tab shapes (HANDOFF §12 L1). */
suite('parse', function () {
  var P = BT.parse;
  function run(mutate) { var raw = FIXTURES.sheet(); if (mutate) mutate(raw); return P.snapshot(raw); }
  function ids(list, id) { return list.filter(function (i) { return i.id === id; }); }

  test('clean fixture: no errors, expected counts', function () {
    var r = run();
    deepEq(ids(r.issues, 'V-03').concat(ids(r.issues, 'V-01'), ids(r.issues, 'V-08'), ids(r.issues, 'V-09')), []);
    eq(r.data.itinerary.length, 10, 'blank row skipped');
    eq(r.data.hotels.length, 3);
    eq(r.data.transportation.length, 3);
    eq(r.data.checklists.length, 1, 'trailing blank row with FALSE checkbox skipped');
    eq(r.data.phrases.length, 1);
    eq(r.data.expenses.length, 0);
  });

  test('settings: types, lists, blank money, FX error → null', function () {
    var s = run().data.settings;
    eq(s.tripStart, '2026-11-18');
    deepEq(s.cities, ['Osaka', 'Kyoto', 'Tokyo', 'Travel']);
    eq(s.dailyBudget, 220000);
    eq(s.shoppingBudget, null);
    eq(s.fxLive, null, '#N/A');
    eq(s.fxFallback, 158.3);
  });

  test('itinerary values: time normalized, money parsed, enums canonical', function () {
    var it = run().data.itinerary;
    var a2 = it.filter(function (x) { return x.id === 'it_a2'; })[0];
    eq(a2.time, '16:55');
    eq(a2.estCost, 1000);
    eq(it.filter(function (x) { return x.id === 'it_a5'; })[0].kind, 'Temple', 'case-insensitive');
    eq(it.filter(function (x) { return x.id === 'it_a4'; })[0].bookingStatus, 'To book');
    eq(it.filter(function (x) { return x.id === 'it_a6'; })[0].allergyRisk, 'High');
    eq(it.filter(function (x) { return x.id === 'it_a3'; })[0].placeJa, 'テスト市場');
  });

  test('unknown allergy value is treated as Caution, never dropped', function () {
    var r = run(function (raw) { raw.Itinerary.values[3][14] = 'not sure'; });
    eq(r.data.itinerary.filter(function (x) { return x.id === 'it_a3'; })[0].allergyRisk, 'Caution');
  });

  test('hotels: 17-digit confirmation stored as a number reads from display text', function () {
    var h = run().data.hotels;
    eq(h[0].confirmation, '11112222333344445');
    eq(h[0].breakfast, true);
    eq(h[1].breakfast, false);
    eq(h[1].total, 42000);
    eq(h[1].currency, 'JPY');
    eq(h[1].payment, 'Pay at hotel');
    eq(h[0].total, null, 'blank total stays blank (Lindsay placeholder)');
    eq(h[0].freeCancelBy, null);
    eq(h[0].checkInTime, '15:00');
  });

  test('transportation: times parsed, zones kept', function () {
    var l = run().data.transportation[1];
    eq(l.type, 'Flight');
    eq(l.departTime, '13:30');
    eq(l.arriveDate, '2026-11-19');
    eq(l.arriveTz, 'Asia/Tokyo');
  });

  test('V-01: a missing night and a double-booked night', function () {
    var r = run(function (raw) {
      raw.Hotels.values[2][9] = '2026-11-22';                           // Kyoto checks out a night early
      raw.Hotels.values[3][8] = '2026-11-21';                           // Tokyo overlaps Nov 21–22
    });
    var v = ids(r.issues, 'V-01');
    ok(v.some(function (i) { return /2026-11-21 has 2 hotel stays/.test(i.message); }), 'double');
    ok(v.every(function (i) { return i.severity === 'error'; }));
    var r2 = run(function (raw) { raw.Hotels.values[3][8] = '2026-11-24'; });
    ok(ids(r2.issues, 'V-01').some(function (i) { return /2026-11-23 has no hotel/.test(i.message); }), 'gap');
  });

  test('V-02: item city vs hotel city; check-out day accepts either; Travel exempt', function () {
    var r = run(function (raw) {
      raw.Itinerary.values[3][4] = 'Tokyo';                              // Nov 20 item says Tokyo, hotel is Osaka
    });
    var v = ids(r.issues, 'V-02');
    eq(v.length, 1);
    eq(v[0].severity, 'warning');
    eq(ids(run().issues, 'V-02').length, 0, 'Nov 21 Kyoto item on check-out day is fine');
  });

  test('V-03: missing required field hides the row with an error', function () {
    var r = run(function (raw) { raw.Itinerary.values[1][5] = ''; raw.Itinerary.values[2][3] = 'Brunch'; });
    eq(ids(r.issues, 'V-03').length, 2);
    eq(r.data.itinerary.length, 8);
    ok(/Row 2 is missing Title/.test(ids(r.issues, 'V-03')[0].message));
  });

  test('V-04: date outside the trip', function () {
    var r = run(function (raw) { raw.Itinerary.values[1][1] = '2026-11-30'; });
    eq(ids(r.issues, 'V-04').length, 1);
  });

  test('V-05: unparseable time becomes blank with a warning', function () {
    var r = run(function (raw) { raw.Itinerary.values[2][2] = 'Evening (6pm)'; });
    eq(ids(r.issues, 'V-05').length, 1);
    eq(r.data.itinerary.filter(function (x) { return x.id === 'it_a2'; })[0].time, null);
  });

  test('V-06 / EC-14: cost strings', function () {
    eq(P.parseMoney('¥1,000'), 1000);
    eq(P.parseMoney('1000'), 1000);
    eq(P.parseMoney('$570'), 570);
    eq(P.parseMoney('-'), null);
    eq(P.parseMoney(''), null);
    eq(P.parseMoney('about 1000'), undefined);
    var r = run(function (raw) { raw.Itinerary.values[3][13] = 'cheap'; });
    eq(ids(r.issues, 'V-06').length, 1);
  });

  test('V-07: free-cancel date on or after check-in', function () {
    var r = run(function (raw) { raw.Hotels.values[2][17] = '2026-11-21'; });
    eq(ids(r.issues, 'V-07').length, 1);
  });

  test('V-08: duplicate IDs', function () {
    var r = run(function (raw) { raw.Itinerary.values[2][0] = 'it_a1'; });
    var v = ids(r.issues, 'V-08');
    eq(v.length, 1);
    eq(v[0].severity, 'error');
  });

  test('V-09 / EC-11: renamed required header → tab unavailable; moved columns still found', function () {
    var r = run(function (raw) { raw.Itinerary.values[0][5] = 'Name'; });
    eq(r.data.itinerary, null);
    ok(ids(r.issues, 'V-09').some(function (i) { return /"Title"/.test(i.message); }));
    var moved = run(function (raw) {
      raw.Hotels.values.forEach(function (row) { row.reverse(); });       // every column moved
      raw.Hotels.display.forEach(function (row) { row.reverse(); });
    });
    eq(moved.data.hotels[0].nameJa, 'ホテルアルファ');
    eq(moved.data.hotels[0].confirmation, '11112222333344445');
    var spaced = run(function (raw) { raw.Itinerary.values[0][5] = '  title '; });
    eq(spaced.data.itinerary.length, 10, 'case and spaces ignored');
  });

  test('V-09: missing tab', function () {
    var r = run(function (raw) { delete raw.Phrases; });
    eq(r.data.phrases, null);
    eq(ids(r.issues, 'V-09')[0].tab, 'Phrases');
  });

  test('V-10: a trip day with no items', function () {
    var r = run(function (raw) { raw.Itinerary.values.splice(9, 1); });  // drop the Nov 24 row
    ok(ids(r.issues, 'V-10').some(function (i) { return /2026-11-24/.test(i.message); }));
    eq(ids(run().issues, 'V-10').length, 0);
  });

  test('V-11: expense amount must be a positive whole number; excluded, not dropped', function () {
    var r = run(function (raw) {
      raw.Expenses.values.push(['ex_1', '', '2026-11-20', 1200, 'JPY', 'Daily', 'Food', 'Cash', 'Lindsay', '', false, 'n/a', '', '', false]);
      raw.Expenses.values.push(['ex_2', '', '2026-11-20', 12.5, 'JPY', 'Daily', 'Food', 'Cash', 'Lindsay', '', false, 'n/a', '', '', false]);
      raw.Expenses.display = raw.Expenses.values.map(function (row) { return row.map(String); });
    });
    eq(r.data.expenses.length, 2);
    eq(r.data.expenses[0].excluded, false);
    eq(r.data.expenses[1].excluded, true);
    eq(ids(r.issues, 'V-11').length, 1);
  });

  test('V-12: hotel without a Japanese address', function () {
    var r = run(function (raw) { raw.Hotels.values[1][5] = ''; });
    var v = ids(r.issues, 'V-12');
    eq(v.length, 1);
    eq(v[0].severity, 'warning');
  });

  test('EC-12: notes or totals below the data are reported, not fatal', function () {
    var r = run(function (raw) {
      raw.Itinerary.values.push(['', '', '', '', '', 'Total ¥90,300', '', '', '', '', '', '', '', '', '', '', false, '']);
    });
    eq(r.data.itinerary.length, 10);
    eq(ids(r.issues, 'V-03').length, 1);
  });

  test('F1: a non-IANA zone ("JST") is reported and blanked, never thrown', function () {
    var r = run(function (raw) { raw.Transportation.values[2][8] = 'JST'; raw.Settings.values[6][1] = 'PST'; });
    var leg = r.data.transportation[1];
    eq(leg.arriveTz, null);
    eq(leg.departTz, 'America/Vancouver');
    ok(r.issues.some(function (i) { return i.tab === 'Transportation' && /"JST"/.test(i.message); }));
    eq(r.data.settings.homeTz, null);
    ok(r.issues.some(function (i) { return i.tab === 'Settings' && /"PST"/.test(i.message); }));
    var vm = BT.model.build({ data: r.data, issues: r.issues });       // must not throw
    eq(vm.legs[1].arriveInstant, null);
    eq(vm.settings.homeTz, 'America/Los_Angeles', 'falls back to the default');
  });

  test('EC-15: Japanese text and emoji survive', function () {
    var r = run(function (raw) { raw.Itinerary.values[1][11] = '日本語メモ 🍣'; });
    eq(r.data.itinerary[0].notes, '日本語メモ 🍣');
  });

  test('every issue has id, severity, tab and a plain message', function () {
    var r = run(function (raw) { raw.Hotels.values[1][5] = ''; raw.Itinerary.values[2][2] = 'soon'; });
    ok(r.issues.length >= 2);
    r.issues.forEach(function (i) {
      ok(/^V-\d\d$/.test(i.id) && /^(error|warning)$/.test(i.severity) && i.tab && i.message.length > 10, JSON.stringify(i));
    });
  });
});
