/* L3 scenarios for v0.4 (fake data, stubbed API, fake geolocation and speech):
   Nearby AC-N1–N4, the Medical section and phrase kit (AC-C2, AC-C3), Info, About. */
suite('e2e v0.4', function () {
  function has(w, re, msg) { ok(re.test(E2E.text(w)), (msg || 'expected ' + re) + '\n---\n' + E2E.text(w).slice(0, 500)); }
  function ideaSnap(mutate) { return E2E.snapshot(function (raw) { FIXTURES.withIdeas(raw); if (mutate) mutate(raw); }); }
  var BESIDE_SHRINE = { lat: 34.6616, lng: 135.4968 };
  function names(w) { return Array.prototype.map.call(w.document.querySelectorAll('.idea .name'), function (n) { return n.textContent; }); }
  function note(w) { return w.document.querySelector('[data-nearby-note]').textContent; }
  function nearby(w, pos) { E2E.geo(w, pos); return E2E.go(w, '#/nearby').then(function () { return E2E.wait(80); }).then(function () { return w; }); }
  function typeInto(w, sel, text) {
    var el = w.document.querySelector(sel);
    if (!el) throw new Error('no input ' + sel);
    el.focus(); el.value = text;
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
    el.blur();
  }

  test('AC-N1: location allowed → nearest first with walking time; allergy card one tap away', function () {
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: ideaSnap() }).then(function () { return E2E.load(); }).then(function (w) {
      return nearby(w, BESIDE_SHRINE);
    }).then(function (w) {
      var n = names(w);
      eq(n[0], 'Fake shrine'); eq(n[1], 'Fake noodle bar');
      ok(n.indexOf('Fake finished') < 0, 'Done ideas are hidden');
      ok(n.indexOf('Fake deleted idea') < 0, 'deleted ideas never show');
      ok(/from you/.test(note(w)), note(w));
      ok(/\d+ min/.test(w.document.querySelector('.idea .dist').textContent));
      ok(/Fake pin-less bar/.test(w.document.querySelector('.content').innerText), 'EC-62: an idea without coordinates is still listed');
      has(w, /No location/);
      ok(/High: fake seafood stalls/.test(E2E.text(w)), 'allergy note on the food idea');
      ok(/Show the allergy card when you order/.test(E2E.text(w)), 'a food idea without a note still gets the reminder');
      E2E.screenChecks(w);
      var t0 = performance.now();
      return E2E.click(w, '.cards-btn').then(function () {
        ok(w.document.querySelector('#sheet [data-card-view="allergy"]'), 'allergy card from Nearby');
        ok(performance.now() - t0 < 500);
      });
    });
  });

  test('category filter and "Show all by city"', function () {
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: ideaSnap() }).then(function () { return E2E.load(); }).then(function (w) {
      return nearby(w, BESIDE_SHRINE);
    }).then(function (w) {
      return E2E.click(w, '[data-action="nearby-cat"][data-cat="Sight"]').then(function () {
        deepEq(names(w), ['Fake shrine', 'Fake tower']);
        eq(w.document.querySelector('[data-cat="Sight"]').getAttribute('aria-pressed'), 'true');
        return E2E.click(w, '[data-action="nearby-cat"][data-cat="All"]');
      }).then(function () { return E2E.click(w, '[data-action="nearby-all"]'); }).then(function () {
        var heads = Array.prototype.map.call(w.document.querySelectorAll('.content .section-title h2'), function (h) { return h.textContent; });
        ok(heads.indexOf('Osaka') >= 0 && heads.indexOf('Kyoto') > heads.indexOf('Osaka') && heads.indexOf('Tokyo') > heads.indexOf('Kyoto'), heads.join());
        E2E.screenChecks(w);
      });
    });
  });

  test('AC-N2: location denied → sorted from the plan item happening now, with a note', function () {
    return E2E.seed({ jst: '2026-11-20T09:00', snapshot: ideaSnap() }).then(function () { return E2E.load(); }).then(function (w) {
      return nearby(w, null);
    }).then(function (w) {
      ok(/Location is off/.test(note(w)) && /Fake market/.test(note(w)), note(w));
      eq(names(w)[0], 'Fake market');
      ok(w.document.querySelector('[data-action="nearby-locate"]'), 'Use my location offered');
      E2E.screenChecks(w);
    });
  });

  test('AC-N2: timed out with nothing locatable in the plan → tonight\'s hotel', function () {
    var snap = ideaSnap(function (raw) {
      var H = raw.Hotels.values[0];
      raw.Hotels.values[2][H.indexOf('Maps')] = 'https://www.google.com/maps/place/Fake/@35.0085,135.7585,17z';
    });
    return E2E.seed({ jst: '2026-11-21T20:00', snapshot: snap }).then(function () { return E2E.load(); }).then(function (w) {
      return nearby(w, 'timeout');
    }).then(function (w) {
      ok(/didn't come through/.test(note(w)) && /your hotel, Hotel Beta/.test(note(w)), note(w));
      eq(names(w)[0], 'Fake garden cafe');
    });
  });

  test('AC-N2: no location and no map point anywhere → listed by city, still renders', function () {
    return E2E.seed({ jst: '2026-11-24T12:00', snapshot: ideaSnap() }).then(function () { return E2E.load(); }).then(function (w) {
      return nearby(w, null);
    }).then(function (w) {
      ok(/listed by city/.test(note(w)), note(w));
      ok(names(w).length >= 6, 'every open idea listed');
      ok(!w.document.querySelector('[data-action="nearby-all"]'), 'no "nearest first" toggle without an anchor');
      E2E.screenChecks(w);
    });
  });

  test('AC-N3: Add to a day works offline, shows on that day\'s Today and Trip; Done hides it, Put back restores', function () {
    var w;
    return E2E.seed({ jst: '2026-11-21T09:00', snapshot: ideaSnap() }).then(function () { return E2E.load(); }).then(function (win) {
      w = win; return nearby(w, BESIDE_SHRINE);
    }).then(function () {
      return E2E.click(w, '[data-action="idea-plan"][data-id="id_f2"]');
    }).then(function () {
      var form = w.document.querySelector('form[data-action="plan-idea"]');
      ok(form.hasAttribute('data-hold'), 'held against sync redraws');
      var sel = form.elements.namedItem('day');
      eq(sel.value, '2026-11-21', 'defaults to today');
      ok(!Array.prototype.some.call(sel.options, function (o) { return o.value === '2026-11-18'; }), 'no flight day');
      return E2E.click(w, 'form[data-action="plan-idea"] button[type="submit"]');
    }).then(function () { return E2E.wait(150); }).then(function () { return E2E.outbox(); }).then(function (ops) {
      var op = ops.filter(function (o) { return o.type === 'idea.update'; })[0];
      ok(op, 'queued');
      eq(op.id, 'id_f2');
      deepEq(op.fields, { status: 'Planned', plannedDate: '2026-11-21' });
      has(w, /Planned · Sat, Nov 21|Planned · Sat Nov 21/);
      return E2E.go(w, '#/today');
    }).then(function () {
      has(w, /Planned from Nearby/);
      has(w, /Fake shrine/);
      ok(/offline|Not synced|Couldn't sync|waiting|Syncing/i.test(w.document.querySelector('[data-sync]').textContent), 'offline state');
      return E2E.go(w, '#/day/2026-11-21');
    }).then(function () {
      has(w, /Planned from Nearby/);
      return E2E.go(w, '#/nearby');
    }).then(function () {
      return E2E.click(w, '[data-action="idea-status"][data-status="Done"][data-id="id_f3"]');
    }).then(function () { return E2E.wait(120); }).then(function () {
      ok(names(w).indexOf('Fake noodle bar') < 0, 'Done hides it');
      return E2E.click(w, '[data-action="nearby-hidden"]');
    }).then(function () {
      return E2E.click(w, '[data-action="idea-status"][data-status="Idea"][data-id="id_f3"]');
    }).then(function () { return E2E.wait(120); }).then(function () { return E2E.outbox(); }).then(function (ops) {
      var last = ops.filter(function (o) { return o.id === 'id_f3'; }).sort(function (a, b) { return a.seq - b.seq; });
      deepEq(last.map(function (o) { return o.fields.status; }), ['Done', 'Idea']);
    });
  });

  test('AC-N4: quick searches open Google Maps with the term; Sushi shows the allergy reminder first', function () {
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: ideaSnap() }).then(function () { return E2E.load(); }).then(function (w) {
      return nearby(w, BESIDE_SHRINE);
    }).then(function (w) {
      var links = w.document.querySelectorAll('a.quick-btn');
      eq(links.length, 7);
      Array.prototype.forEach.call(links, function (a) { ok(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=./.test(a.href), a.href); });
      ok(Array.prototype.some.call(links, function (a) { return decodeURIComponent(a.href).indexOf('query=ラーメン') > 0; }), 'Ramen');
      ok(Array.prototype.some.call(links, function (a) { return /Coin lockers/.test(a.textContent) && decodeURIComponent(a.href).indexOf('コインロッカー') > 0; }));
      ok(!w.document.querySelector('a.quick-btn.caution'), 'Sushi is not a direct link');
      return E2E.click(w, '[data-action="quick-sushi"]').then(function () {
        var box = w.document.querySelector('.sushi-check');
        ok(/allergy card/i.test(box.textContent));
        ok(box.querySelector('[data-action="cards"]'), 'allergy card button');
        ok(decodeURIComponent(box.querySelector('a').href).indexOf('query=寿司') > 0);
      });
    });
  });

  test('Add an idea: real form fields; "I\'m here" saves coordinates; shown at once; a blank name is refused', function () {
    var w;
    return E2E.seed({ jst: '2026-11-20T10:00', owner: 'Lindsay', snapshot: ideaSnap() }).then(function () { return E2E.load(); }).then(function (win) {
      w = win; return nearby(w, BESIDE_SHRINE);
    }).then(function () { return E2E.click(w, '[data-action="idea-add"]'); }).then(function () {
      ok(w.document.querySelector('form[data-action="add-idea"][data-hold]'));
      return E2E.click(w, 'form[data-action="add-idea"] button[type="submit"]');
    }).then(function () {
      ok(/Type a name/.test(w.document.querySelector('[data-error]').textContent), 'blank name refused');
      typeInto(w, 'form[data-action="add-idea"] input[name="nameEn"]', '  Fake typed idea ');
      typeInto(w, 'form[data-action="add-idea"] input[name="why"]', 'Fake reason');
      w.document.querySelector('form[data-action="add-idea"] input[name="category"][value="Café"]').checked = true;
      w.document.querySelector('form[data-action="add-idea"] input[name="here"]').checked = true;
      return E2E.click(w, 'form[data-action="add-idea"] button[type="submit"]');
    }).then(function () { return E2E.wait(200); }).then(function () { return E2E.outbox(); }).then(function (ops) {
      var op = ops.filter(function (o) { return o.type === 'idea.add'; })[0];
      ok(op && /^id_[a-z2-9]{8}$/.test(op.id), 'phone-made ID');
      eq(op.fields.nameEn, 'Fake typed idea'); eq(op.fields.category, 'Café'); eq(op.fields.why, 'Fake reason');
      eq(op.fields.city, 'Osaka'); eq(op.fields.source, 'Lindsay'); eq(op.fields.addedBy, 'Lindsay'); eq(op.fields.status, 'Idea');
      eq(op.fields.lat, 34.6616); eq(op.fields.lng, 135.4968);
      has(w, /Fake typed idea/);
      has(w, /Waiting to sync/);
      ok(!w.document.querySelector('form[data-action="add-idea"]'), 'form closed');
    });
  });

  test('EC-35: location is asked only on Nearby, and a fix under a minute old is reused', function () {
    var w, fake;
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: ideaSnap() }).then(function () { return E2E.load(); }).then(function (win) {
      w = win; fake = E2E.geo(w, BESIDE_SHRINE);
      var chain = Promise.resolve();
      ['#/trip', '#/day/2026-11-20', '#/lists', '#/budget', '#/info', '#/settings', '#/today'].forEach(function (h) {
        chain = chain.then(function () { return E2E.go(w, h); });
      });
      return chain;
    }).then(function () {
      eq(fake.calls, 0, 'no location request off Nearby');
      return E2E.go(w, '#/nearby');
    }).then(function () { return E2E.wait(80); }).then(function () {
      eq(fake.calls, 1);
      ok(w.document.querySelector('[data-action="nearby-locate"]').textContent.indexOf('Update location') >= 0, 'refresh offered with a good fix');
      return E2E.go(w, '#/today');
    }).then(function () { return E2E.go(w, '#/nearby'); }).then(function () {
      eq(fake.calls, 1, 'fresh fix reused');
      return E2E.click(w, '[data-action="nearby-locate"]');
    }).then(function () { return E2E.wait(60); }).then(function () {
      eq(fake.calls, 2, 'Update location asks again');
    });
  });

  test('typed "Add an idea" text survives a filter tap and Done on another card', function () {
    var w;
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: ideaSnap() }).then(function () { return E2E.load(); }).then(function (win) {
      w = win; return nearby(w, BESIDE_SHRINE);
    }).then(function () { return E2E.click(w, '[data-action="idea-add"]'); }).then(function () {
      typeInto(w, 'form[data-action="add-idea"] input[name="nameEn"]', 'Fake half-typed');
      w.document.querySelector('form[data-action="add-idea"] input[name="category"][value="Bar"]').checked = true;
      return E2E.click(w, '[data-action="nearby-cat"][data-cat="Sight"]');
    }).then(function () {
      eq(w.document.querySelector('form[data-action="add-idea"] input[name="nameEn"]').value, 'Fake half-typed', 'kept after a filter tap');
      return E2E.click(w, '[data-action="idea-status"][data-status="Done"][data-id="id_f2"]');
    }).then(function () { return E2E.wait(150); }).then(function () {
      var f = w.document.querySelector('form[data-action="add-idea"]');
      eq(f.elements.namedItem('nameEn').value, 'Fake half-typed', 'kept after Done elsewhere');
      eq(f.elements.namedItem('category').value, 'Bar', 'category kept');
    });
  });

  test('"I\'m here" with no answer: one save despite a second tap, then saved without a point and says so', function () {
    var w;
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: ideaSnap() }).then(function () { return E2E.load(); }).then(function (win) {
      w = win; w.BT.config.geoGiveUpMs = 300;
      return nearby(w, BESIDE_SHRINE);
    }).then(function () {
      E2E.geo(w, 'never');
      w.BT.ui.nearby.state(w.BT.app.state).posAt = 0;     // force a fresh request
      return E2E.click(w, '[data-action="idea-add"]');
    }).then(function () {
      typeInto(w, 'form[data-action="add-idea"] input[name="nameEn"]', 'Fake no-fix idea');
      w.document.querySelector('form[data-action="add-idea"] input[name="here"]').checked = true;
      var form = w.document.querySelector('form[data-action="add-idea"]');
      form.requestSubmit();
      form.requestSubmit();
      ok(form.hasAttribute('data-busy'), 'busy while locating');
      return E2E.wait(600);
    }).then(function () { return E2E.outbox(); }).then(function (ops) {
      var adds = ops.filter(function (o) { return o.type === 'idea.add'; });
      eq(adds.length, 1, 'one idea, not two');
      ok(!('lat' in adds[0].fields), 'no coordinates');
      ok(/has no map point yet/.test(w.document.querySelector('[data-nearby-notice]').textContent));
      ok(!/Couldn't save that change/.test(E2E.text(w)), 'not shown as a failure');
    });
  });

  // ---------- Cards: Medical section and phrases ----------
  function cardSnap() {
    return E2E.snapshot(function (raw) {
      raw.Settings.values.push(['Medical words', '[medical words]']);
      raw.Phrases.values.push(
        ['ph_c1', 'Allergy', 'fake allergy line', '偽アレルギー文', '', true, true, 'src'],
        ['ph_m1', 'Emergency', 'fake medical line', '偽医療文', '', true, true, 'src'],
        ['ph_m2', 'Emergency', 'fake unverified medical', '未確認医療', '', true, false, 'src'],
        ['ph_b1', 'Basics', 'Fake thanks', '偽ありがとう', 'Nise arigatou', false, true, 'src'],
        ['ph_b2', 'Basics', 'Fake maybe', '偽たぶん', 'Nise tabun', false, false, 'none'],
        ['ph_r1', 'restaurant', 'Fake menu', '偽メニュー', '', false, true, 'src']);
    });
  }
  function fakeSpeech(w, voices) {
    var spoken = [];
    Object.defineProperty(w, 'speechSynthesis', { configurable: true, value: {
      getVoices: function () { return voices; }, cancel: function () {}, speak: function (u) { spoken.push(u); }, addEventListener: function () {}
    } });
    return spoken;
  }

  test('allergy card + Medical section: verified rows only, medical words large', function () {
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: cardSnap() }).then(function () { return E2E.load(); }).then(function (w) {
      return E2E.click(w, '.cards-btn').then(function () {
        var card = w.document.querySelector('#sheet [data-card-view="allergy"]');
        ok(/FOOD ALLERGY/.test(card.innerText) && /偽アレルギー文/.test(card.innerText));
        var med = card.querySelector('[data-card-section="medical"]');
        ok(med, 'Medical section');
        ok(/MEDICAL/.test(med.innerText) && /偽医療文/.test(med.innerText) && /\[medical words\]/.test(med.innerText));
        ok(!/未確認医療/.test(card.innerText), 'AC-C2: unverified medical text never shows');
        ok(parseFloat(w.getComputedStyle(med.querySelector('.medical-word')).fontSize) >= 40, 'medical word at least 40 px');
        ok(parseFloat(w.getComputedStyle(med.querySelector('.ja-l')).fontSize) >= 32, 'medical line at least 32 px');
      });
    });
  });

  test('Medical section shows under the not-set-up card too, and is absent with nothing to show', function () {
    var withWordsOnly = E2E.snapshot(function (raw) { raw.Settings.values.push(['Medical words', '[medical words]']); });
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: withWordsOnly }).then(function () { return E2E.load(); }).then(function (w) {
      return E2E.click(w, '.cards-btn').then(function () {
        var unset = w.document.querySelector('#sheet .staff-card.is-unset');
        ok(unset.querySelector('[data-card-section="medical"]'), 'medical words still shown');
        ok(/isn't marked verified/.test(unset.innerText));
      });
    }).then(function () { return E2E.seed({ jst: '2026-11-20T10:00' }); }).then(function () { return E2E.load(); }).then(function (w) {
      return E2E.click(w, '.cards-btn').then(function () { ok(!w.document.querySelector('[data-card-section="medical"]')); });
    });
  });

  test('AC-C3: no Japanese voice → no Play buttons and no errors; phrases grouped, unverified labelled, full screen on tap', function () {
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: cardSnap() }).then(function () { return E2E.load(); }).then(function (w) {
      fakeSpeech(w, [{ lang: 'en-US', name: 'Fake EN' }]);
      return E2E.click(w, '.cards-btn').then(function () { return E2E.click(w, '[data-card="phrases"]'); }).then(function () {
        var sheet = w.document.getElementById('sheet');
        var groups = Array.prototype.map.call(sheet.querySelectorAll('.phrase-group'), function (g) { return g.getAttribute('data-phrase-group'); });
        deepEq(groups, ['Basics', 'Restaurant', 'Allergy', 'Emergency', 'Taxi'], 'category order, case-insensitive');
        var head = sheet.querySelector('[data-phrase-group="Basics"] .phrase-head');
        ok(/Basics/.test(head.textContent) && /2 phrases/.test(head.textContent), head.textContent);
        eq(w.getComputedStyle(head).position, 'sticky', 'section header stays pinned while its phrases scroll');
        ok(parseFloat(w.getComputedStyle(head).fontSize) >= 24, 'header is big');
        ok(sheet.querySelector('[data-phrase-group="Allergy"]').classList.contains('is-allergy'));
        deepEq(Array.prototype.map.call(sheet.querySelectorAll('[data-action="phrase-jump"]'), function (b) { return b.textContent; }), groups, 'a jump button per section');
        eq(sheet.querySelectorAll('[data-action="say"]').length, 0, 'no Play without a Japanese voice');
        var maybe = Array.prototype.filter.call(sheet.querySelectorAll('.phrase'), function (p) { return /Fake maybe/.test(p.innerText); })[0];
        ok(/Unverified/.test(maybe.innerText), 'unverified chip');
        ok(/Nise tabun/.test(maybe.innerText), 'romaji');
        E2E.screenChecks(w);
        return E2E.click(w, '[data-card="phrase"][data-id="ph_b2"]');
      }).then(function () {
        var card = w.document.querySelector('#sheet [data-card-view="phrase"]');
        ok(/Unverified/.test(card.innerText), 'full-screen card keeps the label');
        eq(card.querySelector('.phrase-cat').textContent, 'Basics', 'full-screen card names its section');
        ok(parseFloat(w.getComputedStyle(card.querySelector('.ja-xl')).fontSize) >= 32);
      });
    });
  });

  test('with a Japanese voice, Play speaks the phrase in ja-JP', function () {
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: cardSnap() }).then(function () { return E2E.load(); }).then(function (w) {
      var spoken = fakeSpeech(w, [{ lang: 'en-US', name: 'Fake EN' }, { lang: 'ja-JP', name: 'Fake JA' }]);
      return E2E.click(w, '.cards-btn').then(function () { return E2E.click(w, '[data-card="phrases"]'); }).then(function () {
        eq(w.document.querySelectorAll('#sheet [data-action="say"]').length, 7, 'Play on every phrase');
        return E2E.click(w, '[data-card="phrase"][data-id="ph_b1"]');
      }).then(function () {
        return E2E.click(w, '#sheet [data-action="say"]');
      }).then(function () {
        eq(spoken.length, 1); eq(spoken[0].lang, 'ja-JP'); eq(spoken[0].text, '偽ありがとう');
      });
    });
  });

  test('taxi card from an idea', function () {
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: ideaSnap() }).then(function () { return E2E.load(); }).then(function (w) {
      return nearby(w, BESIDE_SHRINE).then(function () { return E2E.click(w, '[data-card="taxi"][data-kind="idea"][data-id="id_f2"]'); }).then(function () {
        var t = w.document.querySelector('#sheet [data-card-view="taxi"]').innerText;
        ok(/ここまで/.test(t) && /テスト神社/.test(t) && /Fake shrine/.test(t), t);
      });
    });
  });

  test('0.6 category colors: same category, same color on Nearby, Phrases, Budget and Lists; the rail keeps city color', function () {
    var LIME = 'rgb(166, 214, 90)', VIOLET = 'rgb(185, 139, 255)', PINK = 'rgb(255, 125, 200)', CYAN = 'rgb(56, 201, 232)', TAN = 'rgb(201, 154, 107)', PERI = 'rgb(143, 168, 255)';
    var snap = E2E.snapshot(function (raw) {
      E2E.withLists(raw); E2E.withExpenses(raw); FIXTURES.withIdeas(raw);
      raw.Phrases.values.push(['ph_t1', 'restaurant', 'Fake menu', '偽メニュー', '', false, true, 'src'], ['ph_t2', 'Allergy', 'Fake allergy', '偽アレルギー', '', false, true, 'src'],
        ['ph_t3', 'Stores', 'Fake store', '偽店', '', false, true, 'src'], ['ph_t4', 'Hotel', 'Fake hotel', '偽ホテル', '', false, true, 'src'],
        ['ph_t5', 'Directions', 'Fake way', '偽道', '', false, true, 'src']);
      raw.Ideas.values.push(['id_f9', 'Fake mall', 'テストモール', 'Osaka', 'Namba', 'Shopping', 34.6650, 135.5000, '', 'Fake why', '', '', 'Curated', 'Idea', '', '', '', false]);
      raw.Checklists.values.push(['ck_r1', 'Return packing', 'Fake souvenirs', 'Both', 'Suitcase', '', false, '', '', '', 80, '', false]);
      raw.Expenses.values.push(
        ['ex_t1', '2026-11-21T04:00:00Z', '2026-11-21', 900, 'JPY', 'Daily', 'Transit', 'Suica', 'Jordan', 'Fake train', false, 'n/a', 'jordan-iphone', '', false],
        ['ex_t2', '2026-11-21T04:10:00Z', '2026-11-21', 1500, 'JPY', 'Shopping', 'Tax refund', 'Card', 'Jordan', 'Fake refund', false, 'n/a', 'jordan-iphone', '', false],
        ['ex_t3', '2026-10-02T04:10:00Z', '2026-10-02', 200, 'USD', 'Bookings', 'Lodging', 'Card', 'Jordan', 'Fake hotel deposit', false, 'n/a', 'jordan-iphone', '', false]);
    });
    var w;
    function cs(sel, prop) { var el = w.document.querySelector(sel); if (!el) throw new Error('no ' + sel); return w.getComputedStyle(el)[prop]; }
    return E2E.seed({ jst: '2026-11-21T14:00', owner: 'Jordan', snapshot: snap }).then(function () { return E2E.load(); }).then(function (win) {
      w = win;
      ok(!w.document.querySelector('.stop[data-tone], .line [data-tone]'), 'Today\'s rail has no category color');
      return nearby(w, BESIDE_SHRINE);
    }).then(function () {
      eq(cs('.idea[data-idea="id_f3"]', 'borderLeftColor'), LIME, 'Food idea edge');
      eq(cs('.idea[data-idea="id_f2"] .chip-tone', 'color'), VIOLET, 'Sight chip');
      eq(cs('.idea[data-idea="id_f2"] .pict-tile', 'color'), VIOLET, 'Sight tile symbol');
      eq(cs('.quick-btn[data-tone="around"] svg', 'color'), CYAN, 'lockers / restroom search');
      var atm = Array.prototype.filter.call(w.document.querySelectorAll('.quick-btn'), function (b) { return /ATM/.test(b.textContent); })[0];
      eq(w.getComputedStyle(atm.querySelector('svg')).color, PERI, 'ATM is cash: the same periwinkle as Budget');
      eq(cs('.idea[data-idea="id_f9"]', 'borderLeftColor'), PINK, 'Shopping idea');
      ok(w.document.querySelector('.quick-btn.caution[data-tone="food"]'), 'Sushi is food and keeps its caution edge');
      E2E.screenChecks(w);
      return E2E.click(w, '[data-action="nearby-cat"][data-cat="Food"]');
    }).then(function () {
      eq(cs('[data-action="nearby-cat"][data-cat="Food"]', 'backgroundColor'), LIME, 'pressed filter fills with its color');
      return E2E.click(w, '.cards-btn');
    }).then(function () { return E2E.click(w, '[data-card="phrases"]'); }).then(function () {
      eq(cs('[data-phrase-group="Restaurant"] .phrase-head', 'borderLeftColor'), LIME, 'Restaurant phrases = food (lowercase in the sheet)');
      eq(cs('[data-phrase-group="Allergy"] .phrase-head', 'borderLeftColor'), 'rgb(255, 90, 46)', 'Allergy keeps allergy red');
      eq(cs('[data-phrase-group="Stores"] .phrase-head', 'borderLeftColor'), PINK, 'Stores = shopping');
      eq(cs('[data-phrase-group="Hotel"] .phrase-head', 'borderLeftColor'), TAN, 'Hotel = stay');
      eq(cs('[data-phrase-group="Directions"] .phrase-head', 'borderLeftColor'), CYAN, 'Directions = getting around');
      eq(cs('[data-action="phrase-jump"][data-cat="Taxi"]', 'color'), CYAN, 'Taxi jump button = getting around');
      E2E.screenChecks(w);
      var sheet = w.document.getElementById('sheet');
      sheet.scrollTop = 0;
      return E2E.click(w, '[data-action="phrase-jump"][data-cat="Hotel"]').then(function () { return E2E.wait(700); }).then(function () {
        ok(sheet.scrollTop > 0, 'jump scrolled the sheet');
        var top = sheet.querySelector('[data-phrase-group="Hotel"]').getBoundingClientRect().top - sheet.getBoundingClientRect().top;
        ok(top < 120, 'Hotel section at the top after the jump: ' + Math.round(top));
        return E2E.click(w, '[data-card="phrase"][data-id="ph_t1"]');
      });
    }).then(function () {
      eq(w.document.querySelector('#sheet .phrase-cat').textContent, 'Restaurant', 'full-screen card uses the section name');
      return E2E.click(w, '[data-action="close-sheet"]');
    }).then(function () { return E2E.go(w, '#/budget'); }).then(function () {
      var envs = Array.prototype.map.call(w.document.querySelectorAll('.envelope'), function (e) { return e.getAttribute('data-tone'); });
      deepEq(envs.sort(), ['basics', 'shopping', 'stay'], 'Shopping, Cash, Bookings envelopes');
      eq(cs('.exp-row[data-id="ex_e1"] .pict-tile', 'color'), LIME, 'Food expense tile');
      eq(cs('.exp-row[data-id="ex_t1"] .pict-tile', 'color'), CYAN, 'Transit expense tile');
      eq(cs('.exp-row[data-id="ex_t2"] .pict-tile', 'color'), PINK, 'Tax refund = shopping');
      eq(cs('.exp-row[data-id="ex_t3"] .pict-tile', 'color'), TAN, 'Lodging = stay');
      eq(cs('.exp-row[data-id="ex_e4"] .pict-tile', 'color'), PERI, 'ATM withdrawal = basics');
      eq(cs('.envelope[data-tone="shopping"] .eyebrow', 'color'), PINK);
      ok(!w.document.querySelector('.budget[data-tone]'), 'the daily meter keeps its state colors');
      E2E.screenChecks(w);
      return E2E.go(w, '#/lists');
    }).then(function () {
      var rows = Array.prototype.map.call(w.document.querySelectorAll('.list-row'), function (r) { return r.querySelector('.list-name').textContent + ':' + r.getAttribute('data-tone'); });
      deepEq(rows, ['Pre-trip:basics', 'Packing:stay', 'Departure day:around', 'Return packing:shopping'], rows.join());
      eq(cs('.list-row[data-tone="stay"] .pict-tile', 'color'), TAN);
      eq(cs('.list-row[data-tone="basics"] .pict-tile', 'color'), PERI);
    });
  });

  // ---------- Info and About ----------
  test('Info: numbers from Settings dial +81; 110 and 119 always; insurance says Not set', function () {
    var snap = E2E.snapshot(function (raw) {
      raw.Settings.values.push(['Emergency contacts', 'Fake hotline (24 h, English): 050-0000-0000\nFake embassy: 03-0000-0000 (weekdays)\nFake police line: (03) 0000-0001 24 hours\nFake note without a number']);
    });
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: snap }).then(function () { return E2E.load('#/info'); }).then(function (w) {
      var hrefs = Array.prototype.map.call(w.document.querySelectorAll('a.info-row'), function (a) { return a.getAttribute('href'); });
      ok(hrefs.indexOf('tel:110') >= 0 && hrefs.indexOf('tel:119') >= 0);
      ok(hrefs.indexOf('tel:+815000000000') >= 0, hrefs.join());
      ok(hrefs.indexOf('tel:+81300000000') >= 0, hrefs.join());
      ok(hrefs.indexOf('tel:+81300000001') >= 0, 'a note after the number is never dialed: ' + hrefs.join());
      has(w, /Fake hotline \(24 h, English\)/);
      has(w, /weekdays/);
      has(w, /Fake note without a number/);
      has(w, /Travel insurance\s+Not set/i);
      E2E.screenChecks(w);
    });
  });

  test('Info without contacts: 110/119 still show, and the gap is named', function () {
    return E2E.seed({ jst: '2026-11-20T10:00' }).then(function () { return E2E.load('#/info'); }).then(function (w) {
      has(w, /110/); has(w, /119/);
      has(w, /aren't in the sheet yet/);
    });
  });

  test('About line under the title on Today, the Trip day and the item', function () {
    var snap = E2E.snapshot(function (raw) { raw.Itinerary.values[4][FIXTURES.IT_H.indexOf('About')] = 'Fake about line for lunch'; });
    return E2E.seed({ jst: '2026-11-20T10:00', snapshot: snap }).then(function () { return E2E.load(); }).then(function (w) {
      ok(w.document.querySelector('.about') && /Fake about line for lunch/.test(w.document.querySelector('.content').innerText), 'Today');
      return E2E.go(w, '#/day/2026-11-20').then(function () {
        ok(/Fake about line for lunch/.test(w.document.querySelector('.stop .about').textContent), 'Trip day');
        return E2E.go(w, '#/item/it_a4');
      }).then(function () {
        ok(/Fake about line for lunch/.test(w.document.querySelector('.about-lead').textContent), 'item detail');
        E2E.screenChecks(w);
      });
    });
  });
});
