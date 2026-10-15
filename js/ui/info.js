/* Info, basic (HANDOFF §8.7). Verified embassy and hotline numbers arrive in
   Phase 3 from Settings; 110 and 119 are Japan's national emergency numbers. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  BT.ui = BT.ui || {};
  var D = BT.dom, html = D.html, T = BT.time, M = BT.model, L = BT.links;

  function telBtn(label, number) {
    var t = L.tel(number);
    return html`<a class="info-row" href="${t ? t.href : '#'}"><span>${label}</span><b class="num">${number}</b></a>`;
  }

  function render(S) {
    var vm = S.vm, s = vm.settings;
    return {
      city: null,
      header: D.plainHeader('Info', { back: D.backLink('#/today', 'Today') }),
      body: html`
        <section><div class="section-title"><h2>Emergency</h2></div>
          <div class="info-list">
            <a class="info-row" href="tel:110"><span>Police</span><b class="num">110</b></a>
            <a class="info-row" href="tel:119"><span>Fire and ambulance</span><b class="num">119</b></a>
          </div>
          ${s.emergencyContacts ? html`<p class="pre">${s.emergencyContacts}</p>` : html`<p class="empty">Embassy, consulate and visitor hotline numbers are added (verified) in v0.4.</p>`}
          ${s.insurance ? html`<div class="kv"><span class="eyebrow">Travel insurance</span><span class="pre">${s.insurance}</span></div>` : ''}
        </section>
        <section><div class="section-title"><h2>Hotels</h2></div>
          ${vm.hotels.map(function (h) {
            return html`<div class="info-card">
              <div class="name">${h.nameEn}</div>${h.nameJa ? html`<div class="ja" lang="ja">${h.nameJa}</div>` : ''}
              <div class="secondary">${T.fmtDay(h.checkIn)} → ${T.fmtDay(h.checkOut)}${h.station ? ' · ' + h.station : ''}</div>
              ${h.addressEn ? html`<div class="secondary">${h.addressEn}</div>` : ''}
              <div class="actions">
                ${h.phone ? telBtn('Call', h.phone) : ''}
                ${h.confirmation ? html`<button class="btn" type="button" data-action="cards" data-card="ref" data-kind="hotel" data-id="${h.id}">Booking ref</button>` : ''}
                <button class="btn" type="button" data-action="cards" data-card="hotel" data-id="${h.id}">Hotel card</button>
              </div>
              ${h.total !== null && h.total !== undefined ? html`<div class="secondary">Total ${h.currency === 'USD' ? '$' : '¥'}${h.total.toLocaleString('en-US')}${h.payment ? ' · ' + h.payment : ''}${h.freeCancelBy ? ' · free cancel by ' + T.fmtDay(h.freeCancelBy) : ''}</div>`
                : html`<div class="secondary">Total and cancellation date not in the sheet yet.</div>`}
            </div>`;
          })}
          ${vm.hotels.length ? '' : html`<p class="empty">No hotels in the sheet yet.</p>`}
        </section>
        <section><div class="section-title"><h2>Flights and trains</h2></div>
          ${vm.legs.map(function (l) {
            return html`<div class="info-card">
              <div class="name">${l.from} → ${l.to}</div>
              <div class="secondary">${l.carrier || ''} ${l.number || ''} · ${l.departInstant ? T.fmtInstant(l.departInstant, l.departTz) + ' (' + T.zoneLabel(l.departTz) + ')' : l.departDate}</div>
              ${l.booking ? html`<div class="actions"><button class="btn" type="button" data-action="cards" data-card="ref" data-kind="leg" data-id="${l.id}">Booking ref</button></div>` : ''}
            </div>`;
          })}
        </section>
        <section><div class="section-title"><h2>Japan tips</h2></div>
          <ul class="tips">
            <li>Cash is still common. Keep some yen and coins.</li>
            <li>Tipping isn't done.</li>
            <li>Tax-free shopping changed Nov 1, 2026: you pay full price, and the tax is refunded after customs checks the goods when you leave.</li>
            <li>Public trash bins are rare. Carry a small bag.</li>
          </ul>
        </section>
        <p><a class="btn" href="#/settings">Settings</a></p>`
    };
  }

  BT.ui.info = { render: render };
})();
