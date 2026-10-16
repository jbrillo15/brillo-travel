/* L3 scenarios against the real app (fake data, stubbed API). */
suite('e2e', function () {
  function has(w, re, msg) { ok(re.test(E2E.text(w)), (msg || 'expected ' + re) + '\n---\n' + E2E.text(w).slice(0, 400)); }

  test('first run: setup screen; a bad code is refused in plain words; nothing scrolls sideways', function () {
    return E2E.seed({ setup: false, snapshot: null }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Welcome to Brillo/);
      has(w, /not in Safari/, 'EC-30 hint');
      var ta = w.document.querySelector('textarea[data-action="paste-setup"]');
      ta.value = 'not a code';
      ta.dispatchEvent(new w.Event('input', { bubbles: true }));
      return new Promise(function (r) { setTimeout(r, 80); }).then(function () {
        has(w, /isn't a setup code/);
        eq(ta.value, '', 'the box clears itself');
        E2E.screenChecks(w);
      });
    });
  });

  test('a valid setup code saves, clears the box and drops the "setup needed" banner', function () {
    return E2E.seed({ setup: false, snapshot: null }).then(function () { return E2E.load(); }).then(function (w) {
      var code = btoa(JSON.stringify({ env: 'staging', apiUrl: 'https://script.google.com/macros/s/AKfakeE2E/exec', token: 'e'.repeat(40) }));
      var ta = w.document.querySelector('textarea[data-action="paste-setup"]');
      ta.value = code;
      ta.dispatchEvent(new w.Event('input', { bubbles: true }));
      return new Promise(function (r) { setTimeout(r, 400); }).then(function () {
        ok(!/Welcome to Brillo/.test(E2E.text(w)), 'left the setup screen');
        ok(!/Setup code needed/.test(E2E.text(w)), 'no stale banner');
        ok(!/eeeeeeeeee/.test(w.document.documentElement.outerHTML), 'token never in the page');
      });
    });
  });

  test('AC-T2 / AC-T4: in trip, offline, Nov 20 13:30 JST: Day 2, NOW = midday item, tonight\'s hotel', function () {
    return E2E.seed({ jst: '2026-11-20T13:30', owner: 'Lindsay' }).then(function () { return E2E.load(); }).then(function (w) {
      ok(E2E.renderMs < 1000, 'rendered from storage in ' + Math.round(E2E.renderMs) + ' ms');
      has(w, /Day 2 of 8 · Osaka/);
      has(w, /Good afternoon, Lindsay/);
      var nn = w.document.querySelector('.now-next').innerText;
      ok(/NOW\s+Fake lunch/.test(nn), nn);
      has(w, /Hotel Alpha/);
      has(w, /STAGING/);
      ok(/offline|Not synced|Couldn't sync|Syncing/i.test(w.document.querySelector('[data-sync]').textContent), 'sync pill shows an offline state');
      ok(w.document.querySelector('.app').classList.contains('city-osaka'), 'city color');
      ok(w.document.querySelector('.topbar > .greeting + .dayline'), 'day line sits under the greeting (0.1.4)');
      eq(w.document.querySelector('.topbar .day-badge b').textContent, 'O');
      E2E.screenChecks(w);
    });
  });

  test('AC-T1: phone in Pacific time, Nov 21 08:00 JST shows Nov 21 (Kyoto)', function () {
    return E2E.seed({ jst: '2026-11-21T08:00' }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Day 3 of 8 · Kyoto/);
      has(w, /Fake temple/);
      has(w, /Check out of Hotel Alpha/);
    });
  });

  test('EC-04: reopening the next morning re-derives Today (no stale day); 00:00–02:00 stays on the old day (EC-05)', function () {
    return E2E.seed({ jst: '2026-11-20T23:50' }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Day 2 of 8 · Osaka/);
      Object.defineProperty(w.document, 'visibilityState', { value: 'visible', configurable: true });
      function returnAt(time) {
        var at = w.BT.time.zonedToInstant('2026-11-21', time, 'Asia/Tokyo').getTime();
        w.BT.time.setNow(function () { return at; });     // the phone's clock (and maybe its zone) moved on
        w.document.dispatchEvent(new w.Event('visibilitychange'));
        return new Promise(function (r) { setTimeout(r, 80); });
      }
      return returnAt('00:10').then(function () {
        has(w, /Day 2 of 8 · Osaka/, 'just after midnight is still the old trip day');
        return returnAt('07:30');
      }).then(function () {
        has(w, /Day 3 of 8 · Kyoto/);
        ok(!/Day 2 of 8/.test(E2E.text(w)), 'the old day is gone');
      });
    });
  });

  test('after 6 PM: Route home appears with the last-train note', function () {
    return E2E.seed({ jst: '2026-11-21T19:15' }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Route home/);
      has(w, /Last trains run around midnight/);
      var a = Array.prototype.filter.call(w.document.querySelectorAll('a.btn'), function (x) { return /Route home/.test(x.textContent); })[0];
      ok(/travelmode=transit/.test(a.href) && /destination=/.test(a.href));
    });
  });

  test('AC-T5: Nov 18 travel day shows both flights with zones and the layover', function () {
    return E2E.seed({ pt: '2026-11-18T06:00' }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Travel day/);
      has(w, /Thu Nov 19, 4:55 PM/);
      has(w, /Japan time/);
      has(w, /Layover 2h 50m/);
      ok(w.document.querySelectorAll('.leg').length >= 2);
      E2E.screenChecks(w);
    });
  });

  test('AC-T6: Nov 26 shows the evening flight and the hotel check-out', function () {
    return E2E.seed({ jst: '2026-11-26T09:00' }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Thu Nov 26, 7:15 PM/);
      has(w, /Check out of Hotel Gamma by 10:00 AM/);
    });
  });

  test('AC-T7: after the trip, a summary', function () {
    return E2E.seed({ jst: '2026-11-27T10:00' }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Welcome home/);
      has(w, /Trip summary/);
    });
  });

  test('before the trip: countdown, next pre-trip items, to-book items', function () {
    return E2E.seed({ pt: '2026-10-15T09:00' }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /34\s+days to go/);
      has(w, /Fake task/);
      has(w, /Still to book/);
      eq(w.document.querySelector('.topbar .day-badge').getAttribute('aria-label'), 'Trip starts ' + w.BT.time.fmtDay('2026-11-18'));
      E2E.screenChecks(w);
    });
  });

  test('AC-C1 / AC-C2: the Cards button opens the not-set-up allergy card in one tap, from every screen', function () {
    var screens = ['#/today', '#/trip', '#/day/2026-11-20', '#/item/it_a3', '#/info', '#/settings', '#/lists'];
    return E2E.seed({ jst: '2026-11-20T10:00' }).then(function () { return E2E.load(); }).then(function (w) {
      var chain = Promise.resolve();
      screens.forEach(function (h) {
        chain = chain.then(function () { return E2E.go(w, h); }).then(function () {
          E2E.screenChecks(w);
          var t0 = performance.now();
          return E2E.click(w, '.cards-btn').then(function () {
            var sheet = w.document.getElementById('sheet');
            ok(!sheet.hidden, 'sheet open on ' + h);
            ok(sheet.querySelector('.staff-card.is-unset'), 'not-set-up allergy card on ' + h);
            ok(/not set up yet/.test(sheet.textContent), 'not-set-up label');
            ok(/allergen words from the sheet/.test(sheet.innerText), 'allergen words come from Settings');
            ok(performance.now() - t0 < 500, 'under 500 ms');
            return E2E.click(w, '[data-action="close-sheet"]');
          });
        });
      });
      return chain;
    });
  });

  test('allergen words missing from Settings: the card says so instead of showing nothing', function () {
    var snap = E2E.snapshot(function (raw) { raw.Settings.values.pop(); });
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: snap }).then(function () { return E2E.load(); }).then(function (w) {
      return E2E.click(w, '.cards-btn').then(function () {
        ok(/Label words aren't set/.test(w.document.getElementById('sheet').textContent));
      });
    });
  });

  test('F1: a bad time zone in the sheet still renders Today and the hotel', function () {
    var snap = E2E.snapshot(function (raw) { raw.Transportation.values[2][8] = 'JST'; });
    return E2E.seed({ jst: '2026-11-21T20:00', snapshot: snap }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Day 3 of 8 · Kyoto/);
      has(w, /Hotel Beta/);
      has(w, /Sheet problem/);
      ok(!/Storage problem/.test(E2E.text(w)), 'not mistaken for storage');
    });
  });

  test('allergy badge opens the allergy card', function () {
    return E2E.seed({ jst: '2026-11-20T09:00' }).then(function () { return E2E.load(); }).then(function (w) {
      return E2E.click(w, '.allergy-badge').then(function () {
        ok(w.document.querySelector('#sheet .staff-card.is-unset'));
      });
    });
  });

  test('AC-T3: hotel card shows Japanese name and address at 32 px or more on a light card', function () {
    return E2E.seed({ jst: '2026-11-21T20:00' }).then(function () { return E2E.load(); }).then(function (w) {
      return E2E.click(w, '.hotel [data-card="hotel"]').then(function () {
        var card = w.document.querySelector('#sheet .staff-card');
        ok(/ホテルベータ/.test(card.innerText));
        var addr = card.querySelector('.ja-addr');
        ok(/京都府テスト2-2/.test(addr.textContent));
        ok(parseFloat(w.getComputedStyle(addr).fontSize) >= 32, 'address size ' + w.getComputedStyle(addr).fontSize);
        eq(w.getComputedStyle(card).backgroundColor, 'rgb(251, 248, 241)', 'paper background');
        var tel = card.querySelector('a.tel');
        eq(tel.getAttribute('href'), 'tel:+81750000000', 'dials +81');
      });
    });
  });

  test('booking ref card groups digits in fours', function () {
    return E2E.seed({ jst: '2026-11-21T20:00' }).then(function () { return E2E.load('#/info'); }).then(function (w) {
      return E2E.click(w, '[data-card="ref"][data-kind="hotel"]').then(function () {
        eq(w.document.querySelector('#sheet .ref').textContent, '1111 2222 3333 4444 5');
      });
    });
  });

  test('Trip: 9 days → day detail → item detail with transit Directions and a taxi card', function () {
    return E2E.seed({ jst: '2026-11-20T10:00' }).then(function () { return E2E.load('#/trip'); }).then(function (w) {
      eq(w.document.querySelectorAll('.day-row').length, 9);
      ok(w.document.querySelector('.is-today'), 'today marked');
      return E2E.go(w, '#/day/2026-11-20').then(function () {
        has(w, /Fake market/);
        return E2E.go(w, '#/item/it_a3');
      }).then(function () {
        has(w, /テスト市場/);
        var dir = w.document.querySelector('.item-detail a.btn-primary');
        ok(/dir\/\?api=1&destination=%E3%83%86/.test(dir.href), 'directions to the Japanese name: ' + dir.href);
        return E2E.click(w, '[data-card="taxi"]');
      }).then(function () {
        ok(/ここまで/.test(w.document.querySelector('#sheet').innerText));
        ok(/テスト市場/.test(w.document.querySelector('#sheet').innerText));
      });
    });
  });

  test('sheet error: banner links to Data health, which lists it', function () {
    var snap = E2E.snapshot(function (raw) { raw.Itinerary.values[1][5] = ''; });
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: snap }).then(function () { return E2E.load(); }).then(function (w) {
      has(w, /Sheet problem/);
      return E2E.click(w, '.banner a[href="#/health"]').then(function () {
        has(w, /Data health/);
        has(w, /Row 2 is missing Title/);
        E2E.screenChecks(w);
      });
    });
  });

  test('missing Lindsay data shows as plain text, never NaN or undefined', function () {
    return E2E.seed({ jst: '2026-11-20T10:00' }).then(function () { return E2E.load('#/info'); }).then(function (w) {
      has(w, /Total and cancellation date not in the sheet yet/);
      ok(!/NaN|undefined|null/.test(E2E.text(w)), 'no NaN/undefined/null on Info');
      return E2E.go(w, '#/today').then(function () { ok(!/NaN|undefined|null/.test(E2E.text(w)), 'none on Today'); });
    });
  });

  test('§13: a newer script API shows "App and sheet don\'t match", keeps the plan, and Settings shows the script version', function () {
    var newer = E2E.snapshot();
    newer.ok = true; newer.api = 99;
    E2E.fetchStub = function () {
      return Promise.resolve({ status: 200, text: function () { return Promise.resolve(JSON.stringify(newer)); } });
    };
    return E2E.seed({ jst: '2026-11-20T13:30' }).then(function () { return E2E.load('#/settings'); }).then(function (w) {
      has(w, /script 0\.1\.0/, 'script version from the saved snapshot');
      return E2E.click(w, '[data-action="sync-now"]').then(function () {
        return new Promise(function (r) { setTimeout(r, 300); });
      }).then(function () {
        has(w, /App and sheet don't match/);
        has(w, /newer than this app/);
        eq(w.document.querySelector('[data-sync]').textContent, 'Version mismatch');
        E2E.screenChecks(w);
        return E2E.go(w, '#/today');
      }).then(function () {
        has(w, /Day 2 of 8 · Osaka/, 'saved plan still shows');
        has(w, /App and sheet don't match/, 'banner stays across screens');
        w.BT.api.fetch = function () { return Promise.reject(new TypeError('offline (stub)')); };
        return w.BT.app.state.sync.pull('manual').then(function () { return new Promise(function (r) { setTimeout(r, 80); }); });
      }).then(function () {
        has(w, /App and sheet don't match/, 'going offline doesn\'t clear the mismatch');
      });
    });
  });

  test('a reload keeps the screen (spike L10)', function () {
    return E2E.seed({ jst: '2026-11-20T10:00' }).then(function () { return E2E.load('#/item/it_a3'); }).then(function (w) {
      has(w, /Fake market/);
    });
  });
});
