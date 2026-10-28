/* Cards sheet (HANDOFF §8.6, DESIGN §6 #8). The Cards button on every screen
   opens it with the allergy card on top, so it's always one tap away (AC-C1).
   Staff cards are light on purpose and request a screen wake lock. The phrase
   kit lives here too: phrases by category, each one full screen on a tap,
   with ja-JP speech only when the phone has a Japanese voice (AC-C3). */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  BT.ui = BT.ui || {};
  var D = BT.dom, html = D.html, T = BT.time, M = BT.model, L = BT.links;

  // Standard phrases shown on staff cards (approved in design draft 0.3).
  var TAKE_ME_HOTEL = 'このホテルまで<br>お願いします。';
  var TAKE_ME_HERE = 'ここまで<br>お願いします。';

  // Medical section (§8.6): verified Emergency rows marked Card, with the sheet's
  // "Medical words" large. Nothing health-specific lives in this public code.
  function medical(vm) {
    var rows = M.medicalCards(vm), words = vm.settings.medicalWords;
    if (!rows.length && !words) return '';
    return html`<hr><div class="medical" data-card-section="medical">
      <div class="band band-medical">MEDICAL</div>
      ${words ? html`<div class="allergen medical-word" lang="ja">${words}</div>` : ''}
      ${rows.map(function (p) { return html`<div class="ja-l" lang="ja">${p.japanese}</div>${p.english ? html`<p class="en">${p.english}</p>` : ''}`; })}
      ${rows.length ? '' : html`<p class="hint">The full medical line isn't marked verified in the sheet yet.</p>`}
    </div>`;
  }

  function allergyCard(vm) {
    var card = M.allergyCard(vm);
    var words = vm.settings.allergenWords;
    var labels = words ? html`<hr><div class="label">Look for these on labels</div><div class="allergen" lang="ja">${words}</div>`
      : html`<hr><p class="hint">Label words aren't set. Add "Allergen words" to the Settings tab in the sheet.</p>`;
    if (!card) {
      return html`<div class="staff-card is-unset" data-card-view="allergy">
        <div class="label">Allergy card · not set up yet</div>
        <div class="title">The allergy card appears here once its wording, from a cited source, is in the sheet and marked verified.</div>
        <p class="hint">Until then, show the printed card or the photo of it saved in Favorites in Photos.</p>
        ${labels}
        ${medical(vm)}
      </div>`;
    }
    return html`<div class="staff-card" data-card-view="allergy">
      <div class="band">FOOD ALLERGY</div>
      <div class="ja-xl" lang="ja">${card.japanese}</div>
      ${card.english ? html`<p class="en">${card.english}</p>` : ''}
      ${labels}
      ${medical(vm)}
      <p class="hint" data-wake-hint>Turn brightness up so staff can read it.</p>
    </div>`;
  }

  // ---------- phrases (§8.6) ----------
  var PHRASE_ORDER = ['Basics', 'Restaurant', 'Allergy', 'Directions', 'Stores', 'Hotel', 'Emergency', 'Taxi'];
  function phraseKey(p) { return p.id || 'row' + p.row; }
  function jaVoice() {
    try {
      if (!('speechSynthesis' in window)) return null;
      return window.speechSynthesis.getVoices().filter(function (v) { return /^ja(-|_|$)/i.test(v.lang); })[0] || null;
    } catch (e) { return null; }
  }
  function sayBtn(p) {
    return jaVoice() ? html`<button class="btn say-btn" type="button" data-action="say" data-id="${phraseKey(p)}" aria-label="${'Play in Japanese: ' + p.english}">▶ Play</button>` : '';
  }
  function say(S, key) {
    var p = S.vm.phrases.filter(function (x) { return phraseKey(x) === key; })[0], v = jaVoice();
    if (!p || !v) return;
    try {
      var u = new SpeechSynthesisUtterance(p.japanese);
      u.lang = 'ja-JP'; u.rate = 0.9;
      try { u.voice = v; } catch (e) { /* lang alone still picks a Japanese voice */ }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* no sound; the text is still on screen */ }
  }
  var UNVERIFIED = 'Unverified: not word for word from a published source.';
  // The section a phrase belongs to, spelled as its header ("restaurant" in the sheet → Restaurant).
  function phraseCat(p) {
    return PHRASE_ORDER.filter(function (k) { return k.toLowerCase() === String(p.category || '').trim().toLowerCase(); })[0] || 'Other';
  }
  function phraseList(vm) {
    var by = {};
    vm.phrases.filter(function (p) { return p.japanese; }).forEach(function (p) {
      var c = phraseCat(p);
      (by[c] = by[c] || []).push(p);
    });
    var cats = PHRASE_ORDER.concat(['Other']).filter(function (c) { return by[c]; });
    if (!cats.length) return html`<p class="empty">No phrases in the sheet yet. They come from the Phrases tab.</p>`;
    // Each category is its own panel with a header that stays pinned while you scroll
    // through it, plus a row of jump buttons, so it's always clear which set a phrase is in.
    return html`<div class="phrase-kit">
      <nav class="phrase-jump" aria-label="Jump to a phrase section">${cats.map(function (c) {
        return html`<button class="btn filter-chip" type="button" data-action="phrase-jump" data-cat="${c}" data-tone="${M.tone('phrase', c) || 'basics'}">${c}</button>`;
      })}</nav>
      ${cats.map(function (c) {
      return html`<section class="${'phrase-group' + (c === 'Allergy' ? ' is-allergy' : '')}" data-phrase-group="${c}" data-tone="${M.tone('phrase', c) || 'basics'}" aria-label="${c + ' phrases'}">
        <h3 class="phrase-head"><span>${c}</span><span class="count">${by[c].length === 1 ? '1 phrase' : by[c].length + ' phrases'}</span></h3>
        <ul class="phrases">${by[c].map(function (p) {
        return html`<li class="phrase"><button class="phrase-open" type="button" data-action="cards" data-card="phrase" data-id="${phraseKey(p)}">
            <span class="ja" lang="ja">${p.japanese}</span>
            <span class="en-line">${p.english}</span>
            ${p.romaji ? html`<span class="romaji">${p.romaji}</span>` : ''}
            ${p.verified ? '' : html`<span class="chip chip-warn">Unverified</span>`}
          </button>${sayBtn(p)}</li>`;
      })}</ul></section>`;
    })}</div>`;
  }
  function phraseCard(p) {
    return html`<div class="staff-card" data-card-view="phrase">
      <div class="label phrase-cat">${phraseCat(p)}</div>
      ${p.verified ? '' : html`<div class="label unverified-label">${UNVERIFIED}</div>`}
      <div class="ja-xl" lang="ja">${p.japanese}</div>
      <p class="phrase-en">${p.english}</p>
      ${p.romaji ? html`<div class="say"><span class="label">Say it</span><p class="en romaji">${p.romaji}</p></div>` : ''}
      ${sayBtn(p)}
      <p class="hint" data-wake-hint>Turn brightness up so staff can read it.</p>
    </div>`;
  }

  function telLine(phone) {
    var t = L.tel(phone);
    if (!t) return '';
    return html`<a class="tel num" href="${t.href}">${t.display}</a>
      ${t.navi ? html`<p class="hint">This is a Navi Dial number. It may not work from a US phone. Ask the front desk.</p>` : ''}`;
  }

  function hotelCard(h) {
    return html`<div class="staff-card" data-card-view="hotel">
      <div class="label">Please take me to this hotel</div>
      <div class="ja-xl" lang="ja">${D.raw(TAKE_ME_HOTEL)}</div>
      <hr>
      ${h.nameJa ? html`<div class="ja-xl" lang="ja">${h.nameJa}</div>` : html`<div class="ja-xl">${h.nameEn}</div>`}
      ${h.addressJa ? html`<div class="ja-addr" lang="ja">${h.addressJa}</div>`
        : html`<div class="ja-addr">${h.addressEn || ''}</div><p class="hint">No Japanese address in the sheet yet, so this shows English.</p>`}
      ${telLine(h.phone)}
      <p class="en">${h.nameEn}</p>
      <p class="hint" data-wake-hint>Turn brightness up so staff can read it.</p>
    </div>`;
  }

  function taxiCard(it) {
    return html`<div class="staff-card" data-card-view="taxi">
      <div class="label">Please take me here</div>
      <div class="ja-xl" lang="ja">${D.raw(TAKE_ME_HERE)}</div>
      <hr>
      <div class="ja-xl" lang="ja">${it.placeJa}</div>
      ${it.addressJa ? html`<div class="ja-addr" lang="ja">${it.addressJa}</div>` : ''}
      ${it.placeEn ? html`<p class="en">${it.placeEn}</p>` : ''}
      <p class="hint" data-wake-hint>Turn brightness up so staff can read it.</p>
    </div>`;
  }

  function refCard(label, ref, hint) {
    return html`<div class="staff-card" data-card-view="ref">
      <div class="label">Booking reference · ${label}</div>
      <div class="ref">${M.groupRef(ref)}</div>
      ${hint ? html`<p class="hint">${hint}</p>` : ''}
    </div>`;
  }

  function refFor(vm, kind, id) {
    if (kind === 'hotel') {
      var h = vm.hotels.filter(function (x) { return x.id === id; })[0];
      return h && h.confirmation ? refCard(h.nameEn, h.confirmation, T.fmtDay(h.checkIn) + ' → ' + T.fmtDay(h.checkOut)) : null;
    }
    if (kind === 'leg') {
      var l = vm.legs.filter(function (x) { return x.id === id; })[0];
      return l && l.booking ? refCard((l.carrier ? l.carrier + ' ' : '') + (l.number || ''), l.booking,
        (l.from || '') + ' → ' + (l.to || '') + ' · ' + T.fmtDay(l.departDate)) : null;
    }
    if (kind === 'item') {
      var it = vm.itinerary.filter(function (x) { return x.id === id; })[0];
      return it && it.bookingRef ? refCard(it.title, it.bookingRef, T.fmtDay(it.date)) : null;
    }
    return null;
  }

  // The sheet: one card in focus, plus the menu of the others.
  function render(S, sheet) {
    var vm = S.vm;
    var focus;
    if (sheet.card === 'hotel') focus = vm.hotels.filter(function (h) { return h.id === sheet.id; })[0];
    if (sheet.card === 'taxi' && sheet.kind === 'idea') {
      var idea = vm.ideas.filter(function (x) { return x.id === sheet.id; })[0];
      focus = idea && { placeJa: idea.nameJa, placeEn: idea.nameEn };
    } else if (sheet.card === 'taxi') focus = vm.itinerary.filter(function (x) { return x.id === sheet.id; })[0];
    if (sheet.card === 'phrase') focus = vm.phrases.filter(function (p) { return phraseKey(p) === sheet.id; })[0];
    var view = sheet.card === 'hotel' && focus ? hotelCard(focus)
      : sheet.card === 'taxi' && focus && focus.placeJa ? taxiCard(focus)
      : sheet.card === 'ref' ? refFor(vm, sheet.kind, sheet.id)
      : sheet.card === 'phrase' && focus ? phraseCard(focus)
      : sheet.card === 'phrases' ? phraseList(vm)
      : null;
    var day = T.tripDate(T.now());
    var tonight = M.tonightHotel(vm, day) || vm.hotels.filter(function (h) { return h.checkIn >= day; })[0];
    var menu = [];
    if (view) menu.push(html`<button class="card-link" type="button" data-action="cards">Allergy card</button>`);
    if (tonight && !(sheet.card === 'hotel' && focus && focus.id === tonight.id)) {
      menu.push(html`<button class="card-link" type="button" data-action="cards" data-card="hotel" data-id="${tonight.id}">${M.tonightHotel(vm, day) ? 'Tonight\'s hotel' : 'Next hotel'} · ${tonight.nameEn}</button>`);
    }
    vm.hotels.forEach(function (h) {
      if (h.confirmation) menu.push(html`<button class="card-link" type="button" data-action="cards" data-card="ref" data-kind="hotel" data-id="${h.id}">Booking ref · ${h.nameEn}</button>`);
    });
    vm.legs.forEach(function (l) {
      if (l.booking) menu.push(html`<button class="card-link" type="button" data-action="cards" data-card="ref" data-kind="leg" data-id="${l.id}">Booking ref · ${(l.number || l.type)} ${T.fmtDay(l.departDate)}</button>`);
    });
    return html`<div class="sheet" role="dialog" aria-modal="true" aria-label="Cards">
      <div class="sheet-top"><h2>${sheet.card === 'phrases' ? 'Phrases' : 'Cards'}</h2>
        <div class="sheet-actions">
          ${sheet.card === 'phrases' ? '' : html`<button class="btn btn-primary phrases-btn" type="button" data-action="cards" data-card="phrases">${D.icon('i-phrase')}${sheet.card === 'phrase' ? 'All phrases' : 'Phrases'}</button>`}
          <button class="btn" type="button" data-action="close-sheet">Close</button>
        </div></div>
      ${view || allergyCard(vm)}
      ${menu.length ? html`<div class="card-menu"><span class="eyebrow">Other cards</span>${menu}</div>` : ''}
    </div>`;
  }

  BT.ui.cards = { render: render, allergyCard: allergyCard, hotelCard: hotelCard, say: say, jaVoice: jaVoice, phraseKey: phraseKey };
})();
