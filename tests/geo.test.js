/* geo.js, Nearby model and v0.4 parse/model tests: AC-N1, AC-N2 (anchor), EC-62,
   AC-N3 (offline add-to-day at model level), the Medical section rule, About. */
suite('geo', function () {
  var G = BT.geo;
  function vm(mutate) { var raw = FIXTURES.withIdeas(FIXTURES.sheet()); if (mutate) mutate(raw); return BT.model.build(BT.parse.snapshot(raw)); }

  test('AC-N1: distances within 10% of the straight line (fixture coordinates)', function () {
    // Tokyo Station → Osaka Station is about 403 km in a straight line.
    var d = G.distance({ lat: 35.6812, lng: 139.7671 }, { lat: 34.7025, lng: 135.4959 });
    ok(d > 403000 * 0.9 && d < 403000 * 1.1, 'Tokyo–Osaka ' + Math.round(d));
    // 0.001° of latitude is about 111 m anywhere.
    var s = G.distance({ lat: 34.6637, lng: 135.5069 }, { lat: 34.6647, lng: 135.5069 });
    ok(Math.abs(s - 111.2) < 11.1, 'short hop ' + s);
    eq(G.distance({ lat: 34.6637, lng: 135.5069 }, { lat: 34.6637, lng: 135.5069 }), 0);
  });

  test('bad or missing coordinates give no distance, never NaN', function () {
    eq(G.distance({ lat: null, lng: 1 }, { lat: 34, lng: 135 }), null);
    eq(G.distance({ lat: 0, lng: 0 }, { lat: 34, lng: 135 }), null, '0,0 is a blank cell, not the Gulf of Guinea');
    eq(G.distance({ lat: 95, lng: 135 }, { lat: 34, lng: 135 }), null);
  });

  test('walking time at 80 m/min, then meters; kilometers beyond 3 km', function () {
    eq(G.walkMinutes(800), 10);
    eq(G.walkMinutes(20), 1, 'never 0 min');
    deepEq(G.describe(650), { main: '8 min', sub: '650 m walk' });
    deepEq(G.describe(1500), { main: '19 min', sub: '1.5 km walk' });
    deepEq(G.describe(12400), { main: '12.4 km', sub: 'away' });
    eq(G.describe(null), null);
  });

  test('coordinates from Google Maps links', function () {
    deepEq(G.fromMaps('https://www.google.com/maps/place/Fake/@34.6700,135.4950,17z'), { lat: 34.67, lng: 135.495 });
    deepEq(G.fromMaps('https://www.google.com/maps/search/?api=1&query=35.0090,135.7590'), { lat: 35.009, lng: 135.759 });
    deepEq(G.fromMaps('https://www.google.com/maps/search/?api=1&query=35.0090%2C135.7590'), { lat: 35.009, lng: 135.759 });
    eq(G.fromMaps('https://maps.app.goo.gl/abc'), null, 'a short link has no coordinates');
    eq(G.fromMaps('Kyoto Station'), null);
  });

  test('locate: own Maps link, else an idea with the same Japanese name, else one named in the title', function () {
    var v = vm();
    deepEq(G.locate({ title: 'x', maps: 'https://www.google.com/maps/place/x/@34.1,135.2,17z' }, v.ideas), { lat: 34.1, lng: 135.2 });
    deepEq(G.locate({ title: 'Morning stroll', placeJa: 'テスト市場' }, v.ideas), { lat: 34.6637, lng: 135.5069 });
    deepEq(G.locate({ title: 'Fake shrine at dusk' }, v.ideas), { lat: 34.6615, lng: 135.4967 });
    eq(G.locate({ title: 'Lunch' }, v.ideas), null);
  });

  test('AC-N2 anchor: now item, then next items, then the hotel; null when nothing has a map point', function () {
    var v = vm();
    var market = { title: 'Fake market', placeJa: 'テスト市場', placeEn: '' };
    var lunch = { title: 'Fake lunch' };
    eq(G.fallbackAnchor(v, { now: market, next: lunch }).label, 'Fake market');
    eq(G.fallbackAnchor(v, { now: lunch, next: market }).label, 'Fake market', 'next item when now has no map point');
    var hotel = { nameEn: 'Hotel Alpha', maps: 'https://www.google.com/maps/place/x/@34.67,135.495,17z' };
    var h = G.fallbackAnchor(v, { now: lunch, later: [lunch], hotel: hotel });
    eq(h.kind, 'hotel'); eq(h.label, 'Hotel Alpha');
    eq(G.fallbackAnchor(v, { now: lunch, hotel: { nameEn: 'No pin' } }), null);
  });

  test('AC-N1 sort: nearest first; ideas without coordinates last (EC-62)', function () {
    var v = vm();
    var open = v.ideas.filter(BT.model.isOpenIdea);
    var near = G.sortByDistance(open, { lat: 34.6616, lng: 135.4968 });   // beside Fake shrine
    eq(near[0].idea.nameEn, 'Fake shrine');
    eq(near[1].idea.nameEn, 'Fake noodle bar');
    eq(near[near.length - 1].idea.nameEn, 'Fake pin-less bar');
    eq(near[near.length - 1].m, null);
    for (var i = 1; i < near.length - 1; i++) ok(near[i].m >= near[i - 1].m, 'ascending at ' + i);
    ok(G.isFar(open, { lat: 34.05, lng: -118.24 }), 'Los Angeles is far from every idea');
    ok(!G.isFar(open, { lat: 34.6616, lng: 135.4968 }));
  });
});

suite('ideas model', function () {
  var M = BT.model;
  function snap(mutate) { var raw = FIXTURES.withIdeas(FIXTURES.sheet()); if (mutate) mutate(raw); return BT.parse.snapshot(raw); }

  test('deleted ideas are gone; numbers typed as text still give coordinates; Done is not open', function () {
    var v = M.build(snap());
    ok(!v.ideas.some(function (i) { return i.nameEn === 'Fake deleted idea'; }));
    var noodle = v.ideas.filter(function (i) { return i.id === 'id_f3'; })[0];
    eq(noodle.lat, 34.665); eq(noodle.lng, 135.501);
    ok(!M.isOpenIdea(v.ideas.filter(function (i) { return i.id === 'id_f7'; })[0]));
    eq(M.ideaPict({ category: 'Café' }), 'p-cafe');
    eq(M.ideaPict({ category: 'Nonsense' }), 'p-other');
  });

  test('AC-N3 (model): a queued add-to-day shows on that day before the sheet has it', function () {
    var op = { opId: 'op_test01', type: 'idea.update', id: 'id_f2', fields: { status: 'Planned', plannedDate: '2026-11-20' }, status: 'pending' };
    var v = M.build(snap(), [op]);
    var day = M.plannedOn(v, '2026-11-20');
    eq(day.length, 1); eq(day[0].nameEn, 'Fake shrine'); eq(day[0].pending, true);
    eq(M.plannedOn(v, '2026-11-21').length, 0);
  });

  test('a queued new idea appears at once', function () {
    var op = { opId: 'op_test02', type: 'idea.add', id: 'id_newfake1', fields: { nameEn: 'Fake here', category: 'Food', status: 'Idea', lat: 34.6, lng: 135.5 }, status: 'pending' };
    var v = M.build(snap(), [op]);
    var i = v.ideas.filter(function (x) { return x.id === 'id_newfake1'; })[0];
    ok(i && i.pending && M.isOpenIdea(i));
  });
});

suite('v0.4 parse + cards', function () {
  var M = BT.model;
  test('About column: parsed by header, blank when the column is missing', function () {
    var raw = FIXTURES.sheet();
    raw.Itinerary.values[3][FIXTURES.IT_H.indexOf('About')] = 'Fake one-line about';
    var p = BT.parse.snapshot(raw);
    eq(p.data.itinerary.filter(function (x) { return x.id === 'it_a3'; })[0].about, 'Fake one-line about');
    var old = FIXTURES.sheet();
    old.Itinerary.values.forEach(function (r) { r.length = 18; });    // a sheet without the column
    var q = BT.parse.snapshot(old);
    eq(q.data.itinerary[0].about, '');
    eq(q.issues.filter(function (i) { return i.id === 'V-09'; }).length, 0, 'About is optional');
  });

  test('Medical words come from Settings', function () {
    var raw = FIXTURES.sheet();
    raw.Settings.values.push(['Medical words', '[medical words]']);
    eq(M.build(BT.parse.snapshot(raw)).settings.medicalWords, '[medical words]');
    eq(M.build(BT.parse.snapshot(FIXTURES.sheet())).settings.medicalWords, null);
  });

  test('Medical section: only verified Emergency rows marked Card (AC-C2 rule)', function () {
    function v(rows) { var raw = FIXTURES.sheet(); rows.forEach(function (r) { raw.Phrases.values.push(r); }); return M.build(BT.parse.snapshot(raw)); }
    eq(M.medicalCards(v([['ph_m1', 'Emergency', 'fake medical', '偽医療', '', true, true, 'src']])).length, 1);
    eq(M.medicalCards(v([['ph_m1', 'Emergency', 'fake medical', '偽医療', '', true, false, 'src']])).length, 0, 'unverified never shows');
    eq(M.medicalCards(v([['ph_m1', 'Emergency', 'fake medical', '偽医療', '', false, true, 'src']])).length, 0, 'not marked Card');
    eq(M.medicalCards(v([['ph_m1', 'Allergy', 'fake food', '偽食', '', true, true, 'src']])).length, 0, 'food rows belong to the allergy card');
    var both = v([['ph_m1', 'Emergency', 'fake medical', '偽医療', '', true, true, 'src']]);
    eq(M.allergyCard(both), null, 'a medical row never becomes the food allergy card');
  });
});
