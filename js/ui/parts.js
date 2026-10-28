/* Pieces shared by Today and Trip: the day line, the hotel card, flight cards. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  BT.ui = BT.ui || {};
  var D = BT.dom, html = D.html, T = BT.time, M = BT.model, L = BT.links;

  function whenLabel(it) { return it.time ? T.fmtClock(it.time) : it.slot; }

  // The day drawn as a train line (DESIGN §6 #3). opts.now / opts.next mark stations.
  function line(items, opts) {
    opts = opts || {};
    if (!items.length) return html`<p class="empty">Nothing planned yet.</p>`;
    return html`<ol class="line">${items.map(function (it) {
      var cls = 'stop' + (it.done ? ' is-done' : '') + (opts.now && opts.now.id === it.id ? ' is-now' : '');
      var meta = [];
      if (it.estCost) meta.push(html`<span class="num">¥${it.estCost.toLocaleString('en-US')} pp</span>`);
      if (it.bookingStatus === 'To book') meta.push(html`<span>To book</span>`);
      return html`<li class="${cls}">
        <span class="time">${whenLabel(it)}</span><span class="rail"></span>
        <div class="body">
          <a class="title" href="#/item/${encodeURIComponent(it.id || '')}">${D.icon(M.pict(it))}<span>${it.title}</span></a>
          ${it.about ? html`<span class="about">${it.about}</span>` : ''}
          ${it.placeJa ? html`<span class="place-ja ja" lang="ja">${it.placeJa}</span>` : ''}
          ${(meta.length || it.allergyRisk) ? html`<span class="meta">${meta}${D.allergyBadge(it.allergyRisk)}</span>` : ''}
        </div>
      </li>`;
    })}</ol>`;
  }

  function facts(h) {
    return html`<div class="facts">
      ${h.checkInTime ? html`<span>Check-in <b>${T.fmtClock(h.checkInTime)}</b></span>` : ''}
      ${h.checkOutTime ? html`<span>Check-out <b>${T.fmtClock(h.checkOutTime)}</b></span>` : ''}
      <span>Breakfast <b>${h.breakfast ? 'included' : 'not included'}</b></span>
    </div>`;
  }

  // In-app hotel card (DESIGN §6 #4). opts.routeHome adds the after-6-PM button.
  function hotelCard(h, opts) {
    opts = opts || {};
    // The Japanese address beats a saved Maps link here: the link may only be a map pin
    // for Nearby's fallback (v0.4), and Route home must stay transit directions.
    var dest = { placeJa: h.addressJa || h.nameJa, placeEn: h.addressEn || h.nameEn, maps: h.addressJa ? '' : h.maps };
    return html`<div class="hotel">
      <span class="eyebrow">${opts.eyebrow || 'Tonight'}</span>
      <div><div class="name">${h.nameEn}</div>${h.nameJa ? html`<div class="name-ja ja" lang="ja">${h.nameJa}</div>` : ''}</div>
      ${facts(h)}
      ${h.station ? html`<div class="secondary">${h.station}</div>` : ''}
      <div class="actions">
        <button class="btn btn-primary" type="button" data-action="cards" data-card="hotel" data-id="${h.id}">Show in Japanese</button>
        ${opts.routeHome ? html`<a class="btn" href="${L.directions(dest)}">${D.icon('i-dir')}Route home</a>` : ''}
      </div>
      ${opts.routeHome ? html`<p class="hint-dark">Last trains run around midnight. Check the time in Google Maps.</p>` : ''}
    </div>`;
  }

  // Flight or train card with local times labelled by zone (AC-T5, EC-02, EC-03).
  function legCard(l, prev) {
    var layover = prev && prev.arriveInstant && l.departInstant && l.departInstant > prev.arriveInstant
      && l.departInstant - prev.arriveInstant < 24 * 3600000 ? l.departInstant - prev.arriveInstant : null;
    return html`${layover ? html`<p class="layover">Layover ${T.fmtDuration(layover)} in ${prev.to || 'transit'}</p>` : ''}
    <div class="leg">
      <div class="leg-top">${D.icon(M.legPict(l))}<span class="leg-route">${l.from} → ${l.to}</span>${l.number ? html`<span class="chip">${l.number}</span>` : ''}</div>
      <div class="leg-times">
        <div><span class="eyebrow">Departs</span><b>${l.departInstant ? T.fmtInstant(l.departInstant, l.departTz) : l.departDate}</b><span class="secondary">${l.departTz ? T.zoneLabel(l.departTz) + ' time' : 'Time zone missing in the sheet'}</span></div>
        <div><span class="eyebrow">Arrives</span><b>${l.arriveInstant ? T.fmtInstant(l.arriveInstant, l.arriveTz) : l.arriveDate}</b><span class="secondary">${l.arriveTz ? T.zoneLabel(l.arriveTz) + ' time' : 'Time zone missing in the sheet'}</span></div>
      </div>
      ${l.booking ? html`<button class="btn" type="button" data-action="cards" data-card="ref" data-kind="leg" data-id="${l.id}">Show booking ref</button>` : ''}
      ${l.notes ? html`<p class="secondary">${l.notes}</p>` : ''}
    </div>`;
  }
  function legList(legs) {
    return legs.map(function (l, i) { return legCard(l, i ? legs[i - 1] : null); });
  }

  BT.ui.parts = { line: line, hotelCard: hotelCard, legList: legList, whenLabel: whenLabel };
})();
