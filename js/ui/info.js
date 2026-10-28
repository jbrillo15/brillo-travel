/* Info (HANDOFF §8.7). 110 and 119 are Japan's national emergency numbers and
   always show. Every other number comes from Settings → Emergency contacts, one
   per line ("Label: number (note)"), each checked against an official page. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  BT.ui = BT.ui || {};
  var D = BT.dom, html = D.html, T = BT.time, M = BT.model, L = BT.links;

  function telBtn(label, number) {
    var t = L.tel(number);
    return html`<a class="info-row" href="${t ? t.href : '#'}"><span>${label}</span><b class="num">${number}</b></a>`;
  }

  // "Fake hotline (24 h, English): 050-0000-0000 (note)" → { label, number, note }.
  // Digits join only by hyphens (or a bracketed area code), so a note after a space,
  // like "24 hours", never becomes part of the number that's dialed.
  var PHONE_RE = /(\+?(?:\(\d{1,5}\)\s?)?\d[\d-]{5,}\d)/;
  function contacts(text) {
    return String(text || '').split(/\r?\n/).map(function (line) {
      line = line.trim();
      if (!line) return null;
      var m = PHONE_RE.exec(line);
      if (!m) return { text: line };
      return { label: line.slice(0, m.index).replace(/[\s:|–—-]+$/, '') || 'Call', number: m[1].trim(),
        note: line.slice(m.index + m[1].length).replace(/^[\s|,;–—-]+/, '') };
    }).filter(Boolean);
  }
  function contactRow(c) {
    if (!c.number) return html`<p class="secondary">${c.text}</p>`;
    var t = L.tel(c.number);
    return html`<a class="info-row contact" href="${t ? t.href : '#'}"><span>${c.label}${c.note ? html`<small class="secondary">${c.note}</small>` : ''}</span><b class="num">${c.number}</b></a>`;
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
          ${s.emergencyContacts ? html`<div class="info-list">${contacts(s.emergencyContacts).map(contactRow)}</div>`
            : html`<p class="empty">Visitor hotline, embassy and consulate numbers aren't in the sheet yet (Settings → Emergency contacts).</p>`}
          <div class="info-card"><span class="eyebrow">Travel insurance</span>${s.insurance ? html`<span class="pre">${s.insurance}</span>` : html`<span>Not set. Add the policy, number and claims phone to Settings → Insurance in the sheet.</span>`}</div>
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

  BT.ui.info = { render: render, contacts: contacts };
})();
