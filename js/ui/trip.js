/* Trip (HANDOFF §8.2): day list → day detail → item detail. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  BT.ui = BT.ui || {};
  var D = BT.dom, html = D.html, T = BT.time, M = BT.model, L = BT.links, P = BT.ui.parts;

  function dayList(S) {
    var vm = S.vm, s = vm.settings;
    var today = T.tripDate(T.now());
    var days = M.tripDays(vm);
    return {
      city: null,
      header: D.plainHeader('Trip', { sub: s.tripName }),
      body: days.length ? html`<ul class="day-list">${days.map(function (d) {
        var city = M.cityFor(vm, d);
        var n = T.dayNumber(d, s);
        var items = vm.byDate[d] || [];
        var hotel = M.tonightHotel(vm, d);
        return html`<li class="${M.cityClass(city)}${d === today ? ' is-today' : ''}"><a class="day-row" href="#/day/${d}">
          ${D.dayBadge(city, n && n.n)}
          <span class="day-main"><span class="day-date">${T.fmtDay(d)}${d === today ? html` <span class="chip">Today</span>` : ''}</span>
            <span class="day-city">${city}${M.cityJa(city) ? html`<span class="ja-city" lang="ja">${M.cityJa(city)}</span>` : ''}</span>
            <span class="secondary">${items.length ? items[0].title + (items.length > 1 ? ' + ' + (items.length - 1) + ' more' : '') : 'Nothing planned yet'}</span>
            ${hotel ? html`<span class="secondary">${D.icon('p-bed', 'inline-pict')}${hotel.nameEn}</span>` : ''}
          </span><span class="chev" aria-hidden="true">›</span></a></li>`;
      })}</ul>` : html`<p class="empty">No trip dates yet. They come from the Settings tab in the sheet.</p>`
    };
  }

  function dayDetail(S, date) {
    var vm = S.vm, s = vm.settings;
    var city = M.cityFor(vm, date);
    var n = T.dayNumber(date, s);
    var items = vm.byDate[date] || [];
    var isToday = date === T.tripDate(T.now());
    var nn = isToday ? T.nowNext(items, T.tripMinutes(T.now())) : {};
    var hotel = M.tonightHotel(vm, date);
    var out = M.checkoutHotel(vm, date);
    var legs = M.legsOn(vm, date);
    return {
      city: city,
      header: D.plainHeader(T.fmtDay(date), { back: D.backLink('#/trip', 'Trip'), sub: (n && n.n > 0 ? 'Day ' + n.n + ' of ' + n.total + ' · ' : '') + city }),
      body: html`
        ${legs.length ? html`<section><div class="section-title"><h2>Travel</h2></div>${P.legList(legs)}</section>` : ''}
        <section>${P.line(items, { now: nn.now })}</section>
        ${BT.ui.nearby.planned(S, date)}
        ${out && out !== hotel ? html`<p class="banner-quiet">Check out of <b>${out.nameEn}</b>${out.checkOutTime ? ' by ' + T.fmtClock(out.checkOutTime) : ''}.</p>` : ''}
        ${hotel ? P.hotelCard(hotel, { eyebrow: 'Hotel that night' }) : ''}`
    };
  }

  function itemDetail(S, id) {
    var vm = S.vm;
    var it = vm.itinerary.filter(function (x) { return x.id === id; })[0];
    if (!it) return { city: null, header: D.plainHeader('Not found', { back: D.backLink('#/trip', 'Trip') }),
      body: html`<p class="empty">This item isn't in the latest copy of the sheet.</p>` };
    var dir = L.directions(it);
    function row(label, value) { return value ? html`<div class="kv"><span class="eyebrow">${label}</span><span>${value}</span></div>` : ''; }
    return {
      city: it.city,
      header: D.plainHeader(T.fmtDay(it.date), { back: D.backLink('#/day/' + it.date, T.fmtDay(it.date)), sub: P.whenLabel(it) + ' · ' + it.city }),
      body: html`<article class="item-detail">
        <h2 class="item-title">${D.icon(M.pict(it))}<span>${it.title}</span></h2>
        ${it.about ? html`<p class="about about-lead">${it.about}</p>` : ''}
        ${it.allergyRisk ? html`<div>${D.allergyBadge(it.allergyRisk)}</div>` : ''}
        ${it.placeEn || it.placeJa ? html`<div class="kv"><span class="eyebrow">Place</span>${it.placeEn ? html`<span>${it.placeEn}</span>` : ''}${it.placeJa ? html`<span class="ja big-ja" lang="ja">${it.placeJa}</span>` : ''}</div>` : ''}
        ${row('Getting there', it.gettingThere)}
        ${row('Notes', it.notes)}
        ${it.estCost ? row('Cost per person', '¥' + it.estCost.toLocaleString('en-US')) : ''}
        ${row('Booking', it.bookingStatus && it.bookingStatus !== 'Not needed' ? it.bookingStatus : '')}
        <div class="actions">
          ${dir ? html`<a class="btn btn-primary" href="${dir}">${D.icon('i-dir')}Directions</a>` : ''}
          ${it.placeJa ? html`<button class="btn" type="button" data-action="cards" data-card="taxi" data-id="${it.id}">Taxi card</button>` : ''}
          ${it.bookingRef ? html`<button class="btn" type="button" data-action="cards" data-card="ref" data-kind="item" data-id="${it.id}">Booking ref</button>` : ''}
        </div>
        ${it.done ? html`<p class="secondary">Marked done.</p>` : ''}
      </article>`
    };
  }

  BT.ui.trip = { list: dayList, day: dayDetail, item: itemDetail };
})();
