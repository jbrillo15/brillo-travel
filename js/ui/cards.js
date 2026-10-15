/* Cards sheet (HANDOFF §8.6, DESIGN §6 #8). The Cards button on every screen
   opens it with the allergy card on top, so it's always one tap away (AC-C1).
   Staff cards are light on purpose and request a screen wake lock. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  BT.ui = BT.ui || {};
  var D = BT.dom, html = D.html, T = BT.time, M = BT.model, L = BT.links;

  // Standard phrases shown on staff cards (approved in design draft 0.3).
  var TAKE_ME_HOTEL = 'このホテルまで<br>お願いします。';
  var TAKE_ME_HERE = 'ここまで<br>お願いします。';

  function allergyCard(vm) {
    var card = M.allergyCard(vm);
    var words = vm.settings.allergenWords;
    var labels = words ? html`<hr><div class="label">Look for these on labels</div><div class="allergen" lang="ja">${words}</div>`
      : html`<hr><p class="hint">Label words aren't set. Add "Allergen words" to the Settings tab in the sheet.</p>`;
    if (!card) {
      return html`<div class="staff-card is-unset" data-card-view="allergy">
        <div class="label">Allergy card · not set up yet</div>
        <div class="title">The allergy card appears here once its professional translation is added to the sheet and marked verified.</div>
        <p class="hint">Until then, show the printed card or the photo of it saved in Favorites in Photos.</p>
        ${labels}
      </div>`;
    }
    return html`<div class="staff-card" data-card-view="allergy">
      <div class="band">FOOD ALLERGY</div>
      <div class="ja-xl" lang="ja">${card.japanese}</div>
      ${card.english ? html`<p class="en">${card.english}</p>` : ''}
      ${labels}
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
    if (sheet.card === 'taxi') focus = vm.itinerary.filter(function (x) { return x.id === sheet.id; })[0];
    var view = sheet.card === 'hotel' && focus ? hotelCard(focus)
      : sheet.card === 'taxi' && focus && focus.placeJa ? taxiCard(focus)
      : sheet.card === 'ref' ? refFor(vm, sheet.kind, sheet.id)
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
      <div class="sheet-top"><h2>Cards</h2><button class="btn" type="button" data-action="close-sheet">Close</button></div>
      ${view || allergyCard(vm)}
      ${menu.length ? html`<div class="card-menu"><span class="eyebrow">Other cards</span>${menu}</div>` : ''}
    </div>`;
  }

  BT.ui.cards = { render: render, allergyCard: allergyCard, hotelCard: hotelCard };
})();
