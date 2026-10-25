/* Today (HANDOFF §8.1): before trip · travel day · in trip · after trip. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  BT.ui = BT.ui || {};
  var D = BT.dom, html = D.html, T = BT.time, M = BT.model, L = BT.links, P = BT.ui.parts;

  function greeting(owner, hour) {
    var part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return owner ? part + ', ' + owner : part;
  }

  function header(badge, line, greet, owner) {
    // Row 1: station mark and actions. Then the greeting (with the phone owner's portrait) and the day line, each full width (DESIGN §6).
    return html`<header class="topbar">${badge}<span></span><div class="top-actions"><a class="btn btn-icon" href="#/info" aria-label="Info and settings">${D.icon('i-info')}</a>${D.cardsButton()}</div><div class="greeting">${D.avatar(owner, 'greet-face')}<span>${greet}</span></div><div class="dayline">${line}</div></header>`;
  }

  // The three of them at the lake, with a line of text over the bottom edge.
  function photoCard(big, small) {
    return html`<figure class="photo-card"><img src="art/couple.jpg" alt="Jordan, Lindsay and Penny" width="960" height="720" decoding="async">
      <figcaption>${big}<div class="photo-line">${small}</div></figcaption></figure>`;
  }

  function nowNextCard(nn) {
    if (!nn.now && !nn.next) return '';
    var target = nn.now || nn.next;
    function row(tag, it, cls) {
      var meta = [P.whenLabel(it)];
      return html`<div class="nn-row${cls}"><span class="nn-tag">${tag}</span><div>
        <a class="nn-title" href="#/item/${encodeURIComponent(it.id || '')}">${D.icon(M.pict(it))}<span>${it.title}</span></a>
        <div class="nn-meta">${meta.join(' · ')}${it.placeJa ? html` · <span class="ja" lang="ja">${it.placeJa}</span>` : ''} ${D.allergyBadge(it.allergyRisk)}</div>
      </div></div>`;
    }
    var dir = L.directions(target);
    return html`<div class="now-next">
      ${nn.now ? row('NOW', nn.now, '') : ''}
      ${nn.next ? row('NEXT', nn.next, ' next') : ''}
      ${dir ? html`<div class="nn-actions"><a class="btn btn-primary" href="${dir}">${D.icon('i-dir')}Directions</a></div>` : ''}
    </div>`;
  }

  function beforeTrip(S, vm, now) {
    var s = vm.settings;
    var home = T.dateIn(now, s.homeTz);
    var days = s.tripStart ? T.daysBetween(home, s.tripStart) : null;
    // Overdue first, then by due date (AC-L3); tick them right here.
    var open = vm.checklists.filter(function (c) { return /^pre-trip$/i.test(c.list) && !c.done; })
      .sort(function (a, b) { return (a.due || '9999') < (b.due || '9999') ? -1 : 1; });
    var pre = { items: open.slice(0, 5), total: open.length };
    var bags = {};
    vm.checklists.filter(function (c) { return /^packing$/i.test(c.list) && !c.deleted; }).forEach(function (c) {
      var b = c.bag && c.bag !== '—' ? c.bag : 'Unassigned';
      bags[b] = bags[b] || { done: 0, total: 0 };
      bags[b].total++; if (c.done) bags[b].done++;
    });
    var toBook = vm.itinerary.filter(function (x) { return x.bookingStatus === 'To book'; });
    var hour = T.partsIn(now, s.homeTz).hh;
    return {
      city: null,
      header: header(D.dayBadge('Travel', 0, s.tripStart ? 'Trip starts ' + T.fmtDay(s.tripStart) : 'Trip not started'), s.tripName, greeting(S.owner, hour), S.owner),
      body: html`
        ${photoCard(html`<div class="display num">${days === null ? '—' : days}</div>`,
          (days === null ? 'Add the trip dates in Settings (sheet)' : days === 1 ? 'day to go' : 'days to go') + (s.tripStart ? ' · leaving ' + T.fmtDay(s.tripStart) : ''))}
        <section><div class="section-title"><h2>Before you go</h2><a class="secondary section-link" href="#/list/Pre-trip">${pre.total ? 'All ' + pre.total : 'Pre-trip'} ›</a></div>
          ${pre.items.length ? html`<ul class="checks check-card">${pre.items.map(function (c) { return BT.ui.lists.row(c, home); })}</ul>` : html`<p class="empty">Nothing left to do before the trip.</p>`}
        </section>
        ${Object.keys(bags).length ? html`<section><div class="section-title"><h2>Packing</h2><a class="secondary section-link" href="#/list/Packing">Open ›</a></div><ul class="plain-list">${Object.keys(bags).map(function (b) {
          return html`<li><span>${b}</span><span class="meta num">${bags[b].done} of ${bags[b].total} packed</span></li>`;
        })}</ul></section>` : ''}
        ${toBook.length ? html`<section><div class="section-title"><h2>Still to book</h2></div><ul class="plain-list">${toBook.map(function (x) {
          return html`<li><a href="#/item/${encodeURIComponent(x.id || '')}">${x.title}</a><span class="meta">${T.fmtDay(x.date)}</span></li>`;
        })}</ul></section>` : ''}`
    };
  }

  function travelDay(S, vm, now) {
    var s = vm.settings;
    var inbound = vm.legs.filter(function (l) { return l.arriveTz === s.tripTz; })[0];
    var legs = vm.legs.filter(function (l) { return !inbound || l.departInstant <= inbound.departInstant; });
    var day = s.tripStart || T.dateIn(now, s.homeTz);
    var items = vm.byDate[day] || [];
    var hour = T.partsIn(now, s.homeTz).hh;
    return {
      city: 'Travel',
      header: header(D.dayBadge('Travel', 0), 'Travel day · ' + T.fmtDay(day), greeting(S.owner, hour), S.owner),
      body: html`
        <section><div class="section-title"><h2>Flights</h2></div>${legs.length ? P.legList(legs) : html`<p class="empty">No flights in the Transportation tab yet.</p>`}</section>
        ${items.length ? html`<section><div class="section-title"><h2>Today</h2></div>${P.line(items)}</section>` : ''}`
    };
  }

  function inTrip(S, vm, now) {
    var s = vm.settings;
    var day = T.tripDate(now);
    var minutes = T.tripMinutes(now);
    var city = M.cityFor(vm, day);
    var n = T.dayNumber(day, s);
    var items = vm.byDate[day] || [];
    var nn = T.nowNext(items, minutes);
    var tonight = M.tonightHotel(vm, day);
    var out = M.checkoutHotel(vm, day);
    var legs = M.legsOn(vm, day);
    var overdue = M.overduePreTrip(vm, day);
    var hour = T.partsIn(now, s.tripTz).hh;
    var line = (n ? 'Day ' + n.n + ' of ' + n.total + ' · ' : '') + city;
    return {
      city: city,
      header: header(D.dayBadge(city, n && n.n), line, greeting(S.owner, hour), S.owner),
      body: html`
        ${nowNextCard(nn)}
        ${overdue.length ? html`<section><div class="section-title"><h2>Overdue from before the trip</h2><a class="secondary section-link" href="#/list/Pre-trip">Pre-trip ›</a></div>
          <ul class="checks check-card">${overdue.map(function (c) { return BT.ui.lists.row(c, day); })}</ul></section>` : ''}
        ${legs.length ? html`<section><div class="section-title"><h2>Travel today</h2></div>${P.legList(legs)}</section>` : ''}
        <section><div class="section-title"><h2>${nn.now || nn.next ? 'Rest of today' : 'Today'}</h2><span class="secondary">${items.length} ${items.length === 1 ? 'stop' : 'stops'}</span></div>
          ${P.line(items, { now: nn.now })}</section>
        ${out && out !== tonight ? html`<p class="banner-quiet">Check out of <b>${out.nameEn}</b>${out.checkOutTime ? ' by ' + T.fmtClock(out.checkOutTime) : ''} today.</p>` : ''}
        ${tonight ? P.hotelCard(tonight, { routeHome: minutes >= 18 * 60 }) : ''}`
    };
  }

  function afterTrip(S, vm) {
    var s = vm.settings;
    var done = vm.itinerary.filter(function (x) { return x.done; }).length;
    return {
      city: null,
      header: header(D.dayBadge('Travel', 0, 'Trip complete'), s.tripName, 'Welcome home' + (S.owner ? ', ' + S.owner : ''), S.owner),
      body: html`${photoCard(html`<div class="photo-title">${s.tripName || 'Trip complete'}</div>`, s.tripStart ? T.fmtDay(s.tripStart) + ' – ' + T.fmtDay(s.tripEnd) : '')}<section class="summary">
        <h2>Trip summary</h2>
        <ul class="plain-list">
          <li><span>Dates</span><span class="meta">${s.tripStart ? T.fmtDay(s.tripStart) + ' – ' + T.fmtDay(s.tripEnd) : ''}</span></li>
          <li><span>Plans marked done</span><span class="meta num">${done} of ${vm.itinerary.length}</span></li>
        </ul>
        <p class="secondary">The expense export arrives with Budget in v0.3.</p>
      </section>`
    };
  }

  function render(S) {
    var vm = S.vm, now = T.now();
    var phase = T.tripPhase(now, vm.settings, vm.legs);
    var r = phase === 'before' ? beforeTrip(S, vm, now) : phase === 'travel' ? travelDay(S, vm, now)
      : phase === 'in' ? inTrip(S, vm, now) : afterTrip(S, vm);
    r.phase = phase;
    return r;
  }

  BT.ui.today = { render: render, greeting: greeting };
})();
