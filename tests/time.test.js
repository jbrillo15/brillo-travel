/* time.js tests: EC-01..07, slot windows, Now/Next (HANDOFF §12 L1). */
suite('time', function () {
  var T = BT.time;
  var S = { tripStart: '2026-11-18', tripEnd: '2026-11-26', firstSpendDay: '2026-11-19',
    homeTz: 'America/Los_Angeles', tripTz: 'Asia/Tokyo' };
  function jst(d, t) { return T.zonedToInstant(d, t, 'Asia/Tokyo'); }
  function pt(d, t) { return T.zonedToInstant(d, t, 'America/Los_Angeles'); }
  // Fake legs with the real edge cases (date-line crossing, "earlier" landing); times are made up.
  var legs = [
    { departInstant: pt('2026-11-18', '06:05'), arriveInstant: T.zonedToInstant('2026-11-18', '10:40', 'America/Vancouver'), arriveTz: 'America/Vancouver' },
    { departInstant: T.zonedToInstant('2026-11-18', '13:30', 'America/Vancouver'), arriveInstant: jst('2026-11-19', '16:55'), arriveTz: 'Asia/Tokyo' },
    { departInstant: jst('2026-11-26', '19:15'), arriveInstant: pt('2026-11-26', '12:25'), arriveTz: 'America/Los_Angeles' }
  ];

  test('EC-01 / AC-T1: trip date is JST regardless of the phone zone', function () {
    // 08:00 JST Nov 21 is 15:00 PT Nov 20; the trip day must still be Nov 21.
    var at = jst('2026-11-21', '08:00');
    eq(T.dateIn(at, 'America/Los_Angeles'), '2026-11-20', 'Pacific date');
    eq(T.tripDate(at), '2026-11-21');
  });

  test('EC-05: 00:00–02:00 belongs to the previous trip day', function () {
    eq(T.tripDate(jst('2026-11-22', '01:30')), '2026-11-21');
    eq(T.tripMinutes(jst('2026-11-22', '01:30')), 1530);
    eq(T.tripDate(jst('2026-11-22', '02:00')), '2026-11-22');
  });

  test('EC-02: leg 2 lands the next calendar day in Japan', function () {
    eq(T.fmtInstant(legs[1].arriveInstant, 'Asia/Tokyo'), 'Thu Nov 19, 4:55 PM');
    eq(T.zoneLabel('Asia/Tokyo'), 'Japan');
    eq(T.fmtInstant(legs[1].departInstant, 'America/Vancouver'), 'Wed Nov 18, 1:30 PM');
  });

  test('EC-03: return lands "before" it departs on the clock, but duration is positive', function () {
    var ms = legs[2].arriveInstant - legs[2].departInstant;
    ok(ms > 0, 'positive duration');
    eq(T.fmtDuration(ms), '10h 10m');
    eq(T.fmtInstant(legs[2].arriveInstant, 'America/Los_Angeles'), 'Thu Nov 26, 12:25 PM');
  });

  test('EC-07: US DST ended Nov 1, 2026 (PST = UTC-8)', function () {
    eq(pt('2026-11-18', '06:05').toISOString(), '2026-11-18T14:05:00.000Z');
    eq(pt('2026-10-14', '06:05').toISOString(), '2026-10-14T13:05:00.000Z', 'PDT before the change');
    eq(jst('2026-11-19', '16:55').toISOString(), '2026-11-19T07:55:00.000Z');
  });

  test('layover length on Nov 18 (AC-T5)', function () {
    eq(T.fmtDuration(legs[1].departInstant - legs[0].arriveInstant), '2h 50m');
  });

  test('EC-06: time formats', function () {
    eq(T.parseTime('18:00'), '18:00');
    eq(T.parseTime('6:45'), '06:45');
    eq(T.parseTime('6pm'), '18:00');
    eq(T.parseTime('6:45 PM'), '18:45');
    eq(T.parseTime('6 p.m.'), '18:00');
    eq(T.parseTime('12am'), '00:00');
    eq(T.parseTime('12:30 pm'), '12:30');
    eq(T.parseTime('3:00:00 PM'), '15:00', 'Sheets time display');
    eq(T.parseTime('15:00:00'), '15:00');
    eq(T.parseTime('Evening (6pm)'), null);
    eq(T.parseTime('6'), null);
    eq(T.parseTime('25:00'), null);
    eq(T.parseTime('13pm'), null);
    eq(T.parseTime(''), null);
    eq(T.parseTime(null), null);
  });

  test('slot names normalize; unknown → null', function () {
    eq(T.normSlot(' midday '), 'Midday');
    eq(T.normSlot('ALL DAY'), 'All day');
    eq(T.normSlot('brunch'), null);
  });

  test('slot windows', function () {
    eq(T.slotAt(5 * 60), 'Early');
    eq(T.slotAt(13 * 60 + 30), 'Midday');
    eq(T.slotAt(18 * 60 + 59), 'Evening');
    eq(T.slotAt(19 * 60), 'Night');
    eq(T.slotAt(25 * 60), 'Night', '01:00 next day');
    eq(T.slotAt(4 * 60), null);
  });

  test('AC-I1: order by time, then slot, All day first, ties keep sheet order', function () {
    var items = [
      { id: 'a', slot: 'Evening', row: 2 },
      { id: 'b', slot: 'Morning', time: '09:30', row: 3 },
      { id: 'c', slot: 'All day', row: 4 },
      { id: 'd', slot: 'Morning', row: 5 },
      { id: 'e', slot: 'Night', time: '00:30', row: 6 },
      { id: 'f', slot: 'Morning', row: 7 }
    ];
    deepEq(T.sortItems(items).map(function (i) { return i.id; }), ['c', 'd', 'f', 'b', 'a', 'e']);
  });

  test('AC-T4: 13:30 with untimed Midday and Afternoon items', function () {
    var items = [
      { id: 'm', slot: 'Morning', row: 1 },
      { id: 'md', slot: 'Midday', row: 2 },
      { id: 'af1', slot: 'Afternoon', row: 3 },
      { id: 'af2', slot: 'Afternoon', row: 4 }
    ];
    var r = T.nowNext(items, 13 * 60 + 30);
    eq(r.now && r.now.id, 'md');
    eq(r.next && r.next.id, 'af1');
  });

  test('timed item is "now" until the next item starts, max 3 h', function () {
    var items = [
      { id: 'lunch', slot: 'Midday', time: '12:00', row: 1 },
      { id: 'temple', slot: 'Afternoon', time: '14:00', row: 2 },
      { id: 'dinner', slot: 'Evening', time: '18:30', row: 3 }
    ];
    eq(T.nowNext(items, 13 * 60).now.id, 'lunch');
    eq(T.nowNext(items, 16 * 60 + 59).now.id, 'temple', 'within 3 h');
    eq(T.nowNext(items, 17 * 60 + 1).now, null, 'after 3 h, nothing is now');
    eq(T.nowNext(items, 17 * 60 + 1).next.id, 'dinner');
  });

  test('done items are skipped for Now and Next', function () {
    var items = [
      { id: 'a', slot: 'Midday', row: 1, done: true },
      { id: 'b', slot: 'Midday', row: 2 },
      { id: 'c', slot: 'Afternoon', row: 3, done: true },
      { id: 'd', slot: 'Evening', row: 4 }
    ];
    var r = T.nowNext(items, 12 * 60);
    eq(r.now.id, 'b');
    eq(r.next.id, 'd');
  });

  test('before the first item: no Now, Next is the first item', function () {
    var r = T.nowNext([{ id: 'x', slot: 'Morning', row: 1 }], 6 * 60);
    eq(r.now, null);
    eq(r.next.id, 'x');
  });

  test('trip phases', function () {
    eq(T.tripPhase(pt('2026-11-17', '20:00'), S, legs), 'before');
    eq(T.tripPhase(pt('2026-11-18', '06:00'), S, legs), 'travel', 'Nov 18 morning in LA');
    eq(T.tripPhase(jst('2026-11-19', '16:30'), S, legs), 'travel', 'in the air');
    eq(T.tripPhase(jst('2026-11-19', '16:55'), S, legs), 'in', 'landed');
    eq(T.tripPhase(jst('2026-11-26', '19:00'), S, legs), 'in', 'last day');
    eq(T.tripPhase(jst('2026-11-27', '06:10'), S, legs), 'after');
    eq(T.tripPhase(jst('2026-11-19', '09:00'), S, []), 'in', 'no legs: falls back to First spend day');
  });

  test('day N of 8', function () {
    deepEq(T.dayNumber('2026-11-21', S), { n: 3, total: 8 });
  });

  test('EC-04: re-deriving after a zone switch gives the same trip day', function () {
    // The same instant always maps to one trip date; nothing reads the phone zone.
    var at = jst('2026-11-20', '07:59');
    eq(T.tripDate(at), T.tripDate(new Date(at.getTime())));
    eq(T.tripDate(at), '2026-11-20');
  });

  test('EC-04: sweeping LA → landing → trip end in 15-min steps, every trip day appears once, in order', function () {
    var t = pt('2026-11-17', '00:00').getTime(), end = jst('2026-11-27', '12:00').getTime();
    var seen = [], last = null;
    for (; t <= end; t += 15 * 60000) {
      var d = T.tripDate(new Date(t));
      if (d === last) continue;
      if (last) eq(T.daysBetween(last, d), 1, 'no skipped or repeated day after ' + last);
      seen.push(d); last = d;
    }
    ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26']
      .forEach(function (d) { ok(seen.indexOf(d) >= 0, d + ' appears'); });
  });

  test('EC-04: no app file reads the phone\'s own zone (local Date getters)', function () {
    var bad = /\.(getHours|getMinutes|getDate|getDay|getMonth|getFullYear|getTimezoneOffset)\(|toLocale(Date|Time)String\((?![^)]*timeZone)|new Date\(\s*\d+\s*,|new Date\(\s*'\d{4}-\d{2}-\d{2}T[^'Z+]*'\s*\)/;   // number toLocaleString is fine; local-time constructors aren't
    return fetch('../index.html', { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (htmlText) {
      var srcs = [];
      htmlText.replace(/<script[^>]+src="([^"]+\.js)"/g, function (m, s) { srcs.push(s); });
      ok(srcs.length >= 10, 'found the app scripts: ' + srcs.length);
      return Promise.all(srcs.map(function (s) {
        return fetch('../' + s, { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (src) {
          src.split('\n').forEach(function (line, i) {
            if (bad.test(line.replace(/\/\/.*$/, ''))) throw new Error(s + ':' + (i + 1) + ' reads the phone zone: ' + line.trim().slice(0, 80));
          });
        });
      }));
    });
  });

  test('formatting', function () {
    eq(T.fmtDay('2026-11-21'), 'Sat Nov 21');
    eq(T.fmtDay('not a date'), '');
    eq(T.fmtClock('13:05'), '1:05 PM');
    eq(T.fmtClock('00:15'), '12:15 AM');
    eq(T.addDays('2026-11-30', 1), '2026-12-01');
    eq(T.daysBetween('2026-11-19', '2026-11-26'), 7);
    ok(T.isIsoDate('2026-02-28') && !T.isIsoDate('2026-02-30'));
  });

  test('simulated clock (staging Developer setting)', function () {
    var fixed = jst('2026-11-21', '08:00').getTime();
    T.setNow(function () { return fixed; });
    eq(T.tripDate(T.now()), '2026-11-21');
    T.setNow(null);
    ok(Math.abs(T.now() - Date.now()) < 1000);
  });
});
