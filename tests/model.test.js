/* links.js and model.js tests: AC-I2, tel numbers, tonight's hotel, AC-C2. */
suite('links', function () {
  var L = BT.links;
  test('AC-I2: directions use Maps text, then JA, then EN, then title', function () {
    function q(href) { return decodeURIComponent(/destination=([^&]+)/.exec(href)[1]); }
    eq(q(L.directions({ maps: 'Kyoto Station', placeJa: '京都駅', title: 't' })), 'Kyoto Station');
    eq(q(L.directions({ placeJa: '京都駅', placeEn: 'Kyoto Station', title: 't' })), '京都駅');
    eq(q(L.directions({ placeEn: 'Kyoto Station', title: 't' })), 'Kyoto Station');
    eq(q(L.directions({ title: 'Fake temple' })), 'Fake temple');
    ok(/travelmode=transit/.test(L.directions({ title: 'x' })));
    eq(L.directions({ maps: 'https://maps.app.goo.gl/abc' }), 'https://maps.app.goo.gl/abc', 'saved link as-is');
  });
  test('sheet values never become script URLs', function () {
    eq(L.safeHttp('javascript:alert(1)'), null);
    ok(/destination=javascript/.test(L.directions({ maps: 'javascript:alert(1)' })), 'treated as search text');
  });
  test('tel: Japanese numbers dial as +81; 0570 is flagged', function () {
    deepEq(L.tel('075-000-0000'), { href: 'tel:+81750000000', display: '075-000-0000', navi: false });
    eq(L.tel('0570-000-000').navi, true);
    eq(L.tel('+1 202 555 0100').href, 'tel:+12025550100');
    eq(L.tel(''), null);
  });
  test('Translate uses the website (spike L4)', function () {
    ok(/^https:\/\/translate\.google\.com\/\?sl=en&tl=ja&op=translate&text=Hello/.test(L.translate('Hello')));
  });
});

suite('model', function () {
  var M = BT.model;
  function vm(mutate) { var raw = FIXTURES.sheet(); if (mutate) mutate(raw); return M.build(BT.parse.snapshot(raw)); }

  test('tonight hotel, check-out hotel and day city', function () {
    var v = vm();
    eq(M.tonightHotel(v, '2026-11-21').nameEn, 'Hotel Beta');
    eq(M.checkoutHotel(v, '2026-11-21').nameEn, 'Hotel Alpha');
    eq(M.tonightHotel(v, '2026-11-26'), null, 'no hotel the last night');
    eq(M.cityFor(v, '2026-11-21'), 'Kyoto');
    eq(M.cityFor(v, '2026-11-26'), 'Tokyo', 'last day: check-out city');
    eq(M.cityFor(v, '2026-11-18'), 'Travel');
  });
  test('items per day are ordered (AC-I1)', function () {
    var d = vm().byDate['2026-11-20'].map(function (x) { return x.id; });
    deepEq(d, ['it_a3', 'it_a4']);
  });
  test('legs get real instants and are found by local date (AC-T5)', function () {
    var v = vm();
    var nov18 = M.legsOn(v, '2026-11-18');
    eq(nov18.length, 2);
    eq(BT.time.fmtInstant(nov18[1].arriveInstant, nov18[1].arriveTz), 'Thu Nov 19, 4:55 PM');
    eq(M.legsOn(v, '2026-11-26').length, 1);
  });
  test('trip days span the trip', function () {
    var days = M.tripDays(vm());
    eq(days.length, 9); eq(days[0], '2026-11-18'); eq(days[8], '2026-11-26');
  });
  test('pictograms: Kind, then check-in/out, else other', function () {
    eq(M.pict({ kind: 'Temple' }), 'p-temple');
    eq(M.pict({ title: 'Check in, Hotel Beta' }), 'p-bed');
    eq(M.pict({ title: 'Something' }), 'p-other');
    eq(M.legPict({ type: 'Flight' }), 'p-plane');
  });
  test('AC-C2: only a verified allergy card row counts', function () {
    eq(M.allergyCard(vm()), null);
    var unverified = vm(function (raw) {
      raw.Phrases.values.push(['ph_9', 'Allergy', 'text', '日本語', '', true, false, 'pro']);
    });
    eq(M.allergyCard(unverified), null, 'unverified never shows');
    var verified = vm(function (raw) {
      raw.Phrases.values.push(['ph_9', 'Allergy', 'text', '日本語', '', true, true, 'pro']);
    });
    eq(M.allergyCard(verified).japanese, '日本語');
  });
  test('booking refs group in fours; versions compare', function () {
    eq(M.groupRef('11112222333344445'), '1111 2222 3333 4444 5');
    ok(M.semverLess('0.1.0', '0.2.0'));
    ok(!M.semverLess('0.10.0', '0.9.9'));
    ok(!M.semverLess('0.1.0', '0.1.0'));
  });
  test('empty snapshot builds without crashing (first run)', function () {
    var v = M.build(null);
    eq(v.hasData, false);
    eq(M.tonightHotel(v, '2026-11-21'), null);
    deepEq(M.tripDays(v), []);
  });
  test('missing Lindsay data stays blank, never NaN', function () {
    var h = vm().hotels[0];
    eq(h.total, null); eq(h.currency, null); eq(h.payment, null); eq(h.freeCancelBy, null);
  });
});
