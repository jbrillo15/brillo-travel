/* Nearby (HANDOFF §8.5, DESIGN §6 #7): ideas sorted by walking distance, a
   category filter, "Show all" by city, quick Google Maps searches and "Add an
   idea". Location is asked only here (EC-35); app.js owns the request and
   keeps the answer in S.nearby. Without a location the list sorts from the
   current or next plan item, else tonight's hotel, and says so (AC-N2). */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  BT.ui = BT.ui || {};
  var D = BT.dom, html = D.html, T = BT.time, M = BT.model, L = BT.links, G = BT.geo;

  var NEAR_COUNT = 15;
  var CITY_ORDER = ['Osaka', 'Kyoto', 'Tokyo'];
  // Search terms in Japanese: Google Maps in Japan finds local places better with them.
  var QUICK = [
    ['Ramen', 'ラーメン', 'p-food'], ['Sushi', '寿司', 'p-sushi', true], ['Café', 'カフェ', 'p-cafe'],
    ['Convenience store', 'コンビニ', 'p-store'], ['ATM', 'ATM', 'p-yen'], ['Pharmacy', '薬局', 'p-pill'],
    ['Coin lockers', 'コインロッカー', 'p-locker'], ['Restroom', 'トイレ', 'p-restroom']
  ];
  var FOOD = { Food: 1, 'Café': 1, Bar: 1, Market: 1 };

  function state(S) {
    S.nearby = S.nearby || { geo: 'idle', pos: null, cat: 'All', all: false, hidden: false, plan: null, adding: false, sushi: false, notice: null };
    return S.nearby;
  }

  // Japan-side "today": the trip date during the trip, else the first spend day.
  function planDays(vm) {
    var s = vm.settings, first = s.firstSpendDay || s.tripStart;
    return M.tripDays(vm).filter(function (d) { return !first || d >= first; });
  }
  function defaultPlanDay(vm) {
    var days = planDays(vm), today = T.tripDate(T.now());
    return days.indexOf(today) >= 0 ? today : days[0] || today;
  }

  // The fallback anchor from today's plan and hotel (AC-N2).
  function anchor(vm) {
    var day = T.tripDate(T.now());
    var items = vm.byDate[day] || [];
    var nn = T.nowNext(items, T.tripMinutes(T.now()));
    var after = nn.next ? items.slice(items.indexOf(nn.next) + 1) : [];
    var hotel = M.tonightHotel(vm, day) || vm.hotels.filter(function (h) { return h.checkIn >= day; })[0] || null;
    return G.fallbackAnchor(vm, { now: nn.now, next: nn.next, later: after.filter(function (x) { return !x.done; }), hotel: hotel });
  }

  // Where the list measures from, and the note that says why.
  function origin(S, vm) {
    var st = state(S);
    var open = vm.ideas.filter(M.isOpenIdea);
    if (st.pos && !G.isFar(open, st.pos)) return { pos: st.pos, note: 'Sorted by walking distance from you.' };
    var a = anchor(vm);
    var why = st.pos ? 'You\'re more than 50 km from every idea'
      : st.geo === 'asking' ? 'Finding your location'
      : st.geo === 'denied' ? 'Location is off for Brillo'
      : st.geo === 'timeout' ? 'Your location didn\'t come through (underground or weak signal)'
      : st.geo === 'unavailable' ? 'This phone can\'t share its location here'
      : 'No location yet';
    if (a) return { pos: a.pos, note: why + ', so this is sorted from ' + (a.kind === 'hotel' ? 'your hotel, ' : '') + a.label + '.', fallback: true };
    return { pos: null, note: why + ', and today\'s plan has no map point, so ideas are listed by city.', fallback: true, none: true };
  }

  function dist(m) {
    var d = G.describe(m);
    return d ? html`<span class="dist"><b class="num">${d.main}</b>${d.sub}</span>` : html`<span class="dist">No location</span>`;
  }

  function allergyLine(i) {
    if (i.allergyNote) return html`<div class="allergy-note"><button class="allergy-badge caution" type="button" data-action="cards">Allergy</button><span>${i.allergyNote}</span></div>`;
    if (FOOD[i.category]) return html`<div class="allergy-note"><button class="allergy-badge caution" type="button" data-action="cards">Allergy</button><span>No allergy note yet. Show the allergy card when you order.</span></div>`;
    return '';
  }

  function destination(i) {
    var at = G.valid(i) ? i.lat + ',' + i.lng : '';
    return { maps: i.maps || (i.nameJa ? '' : at), placeJa: i.nameJa, placeEn: i.nameEn };
  }

  function planForm(S, i) {
    var vm = S.vm, pick = i.plannedDate && planDays(vm).indexOf(i.plannedDate) >= 0 ? i.plannedDate : defaultPlanDay(vm);
    return html`<form class="plan-form" data-action="plan-idea" data-id="${i.id}" data-hold>
      <label class="field"><span class="eyebrow">Add to which day?</span>
        <select name="day" data-orig="${i.plannedDate || ''}">${planDays(vm).map(function (d) {
          return html`<option value="${d}"${d === pick ? D.raw(' selected') : ''}>${T.fmtDay(d) + ' · ' + M.cityFor(vm, d)}</option>`;
        })}</select></label>
      <div class="actions"><button class="btn btn-primary" type="submit">Add to this day</button>
        <button class="btn btn-quiet" type="button" data-action="idea-plan-cancel">Cancel</button></div>
    </form>`;
  }

  // One idea card. e = { idea, m } from G.sortByDistance; opts.compact drops the actions row.
  function ideaCard(S, e, opts) {
    opts = opts || {};
    var i = e.idea, st = state(S);
    var dir = L.directions(destination(i));
    var status = i.status === 'Planned' && i.plannedDate ? 'Planned · ' + T.fmtDay(i.plannedDate)
      : i.status === 'Done' ? 'Done' : i.status === 'Skip' ? 'Skipped' : '';
    return html`<article class="idea${i.pending ? ' is-pending' : ''}" data-idea="${i.id}">
      <div class="top">
        <span class="pict-tile" aria-hidden="true">${D.icon(M.ideaPict(i))}</span>
        <div class="idea-name"><div class="name">${i.nameEn}</div>${i.nameJa ? html`<div class="name-ja" lang="ja">${i.nameJa}</div>` : ''}</div>
        ${opts.noDistance ? '' : dist(e.m)}
      </div>
      <div class="chips">${i.category ? html`<span class="chip">${i.category}</span>` : ''}${i.area ? html`<span class="chip">${i.area}</span>` : ''}${status ? html`<span class="chip chip-strong">${status}</span>` : ''}${i.pending ? html`<span class="chip">Waiting to sync</span>` : ''}</div>
      ${i.why ? html`<p class="why">${i.why}</p>` : ''}
      ${i.hours && !/^location:/i.test(i.hours) ? html`<p class="secondary">${i.hours}</p>` : ''}
      ${allergyLine(i)}
      ${opts.compact ? html`<div class="actions">${dir ? html`<a class="btn btn-primary" href="${dir}">${D.icon('i-dir')}Directions</a>` : ''}
          ${i.nameJa ? html`<button class="btn" type="button" data-action="cards" data-card="taxi" data-kind="idea" data-id="${i.id}">Taxi card</button>` : ''}</div>`
      : st.plan === i.id ? planForm(S, i)
      : M.isOpenIdea(i) ? html`<div class="actions">
          ${dir ? html`<a class="btn btn-primary" href="${dir}">${D.icon('i-dir')}Directions</a>` : ''}
          <button class="btn" type="button" data-action="idea-plan" data-id="${i.id}">${i.status === 'Planned' ? 'Change day' : 'Add to a day'}</button>
          <button class="btn" type="button" data-action="idea-status" data-status="Done" data-id="${i.id}">Done</button>
          <button class="btn" type="button" data-action="idea-status" data-status="Skip" data-id="${i.id}">Skip</button>
          ${i.nameJa ? html`<button class="btn" type="button" data-action="cards" data-card="taxi" data-kind="idea" data-id="${i.id}">Taxi card</button>` : ''}
        </div>`
      : html`<div class="actions"><button class="btn" type="button" data-action="idea-status" data-status="Idea" data-id="${i.id}">Put back</button></div>`}
    </article>`;
  }

  function quickSearches(S) {
    var st = state(S);
    return html`<section><div class="section-title"><h2>Find nearby</h2></div>
      <div class="quick">${QUICK.map(function (q) {
        return q[3]
          ? html`<button class="quick-btn caution" type="button" data-action="quick-sushi">${D.icon(q[2])}<span>${q[0]}</span></button>`
          : html`<a class="quick-btn" href="${L.search(q[1])}">${D.icon(q[2])}<span>${q[0]}</span></a>`;
      })}</div>
      ${st.sushi ? html`<div class="sushi-check" role="alert"><p><b>Check before you order.</b> Show the allergy card at the counter: sushi kitchens share boards, knives and broth.</p>
        <div class="actions"><button class="btn" type="button" data-action="cards">Allergy card</button><a class="btn btn-primary" href="${L.search('寿司')}">Open Google Maps</a></div></div>` : ''}
      <p class="quick-note">Opens Google Maps near you. For food, show the <b>allergy card</b> when you order.</p>
    </section>`;
  }

  function addForm(S) {
    var vm = S.vm, day = T.tripDate(T.now());
    var city = M.cityFor(vm, day);
    var cities = ['Osaka', 'Kyoto', 'Tokyo'];
    if (cities.indexOf(city) < 0) city = '';
    return html`<form class="settings-group add-idea" data-action="add-idea" data-hold novalidate>
      <h2>Add an idea</h2>
      <label class="field"><span class="eyebrow">Name</span><input name="nameEn" type="text" autocomplete="off" maxlength="120" required></label>
      <div class="field choice" role="radiogroup" aria-labelledby="lbl-idea-cat"><span class="eyebrow" id="lbl-idea-cat">Category</span><div class="choices">
        ${M.IDEA_CATS.map(function (c) {
          return html`<label class="choice-chip"><input type="radio" name="category" value="${c}"${c === 'Food' ? D.raw(' checked') : ''}>${D.icon(M.ideaPict({ category: c }))}<span>${c}</span></label>`;
        })}</div></div>
      <label class="field"><span class="eyebrow">City</span><select name="city">
        <option value="">—</option>${cities.map(function (c) { return html`<option value="${c}"${c === city ? D.raw(' selected') : ''}>${c}</option>`; })}
      </select></label>
      <label class="field"><span class="eyebrow">Note (why go)</span><input name="why" type="text" autocomplete="off" maxlength="300"></label>
      <label class="toggle"><input type="checkbox" name="here"> I'm here (save this spot's location)</label>
      <p class="form-error" data-error hidden></p>
      <div class="actions"><button class="btn btn-primary" type="submit">Save idea</button>
        <button class="btn btn-quiet" type="button" data-action="idea-add-cancel">Cancel</button></div>
    </form>`;
  }

  function filterBar(st, cats) {
    if (cats.length < 2) return '';
    return html`<div class="filter-chips" role="group" aria-label="Category">${['All'].concat(cats).map(function (c) {
      return html`<button class="btn filter-chip" type="button" data-action="nearby-cat" data-cat="${c}" aria-pressed="${st.cat === c ? 'true' : 'false'}">${c}</button>`;
    })}</div>`;
  }

  function byCity(S, sorted, measured) {
    var groups = {};
    sorted.forEach(function (e) { var c = e.idea.city || 'Other'; (groups[c] = groups[c] || []).push(e); });
    var names = Object.keys(groups).sort(function (a, b) {
      var ia = CITY_ORDER.indexOf(a), ib = CITY_ORDER.indexOf(b);
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || (a < b ? -1 : 1);
    });
    return names.map(function (c) {
      var list = groups[c];
      if (!measured) list = list.slice().sort(function (a, b) { return (a.idea.area || '') < (b.idea.area || '') ? -1 : (a.idea.area || '') > (b.idea.area || '') ? 1 : a.n - b.n; });
      return html`<section class="${M.cityClass(c)}"><div class="section-title"><h2>${c}</h2><span class="secondary">${list.length}</span></div>
        ${list.map(function (e) { return ideaCard(S, e, { noDistance: !measured }); })}</section>`;
    });
  }

  function render(S) {
    var vm = S.vm, st = state(S);
    var o = origin(S, vm);
    var open = vm.ideas.filter(M.isOpenIdea);
    var hiddenIdeas = vm.ideas.filter(function (i) { return !M.isOpenIdea(i); });
    var cats = M.IDEA_CATS.filter(function (c) { return open.some(function (i) { return i.category === c; }); });
    if (st.cat !== 'All' && cats.indexOf(st.cat) < 0) st.cat = 'All';
    var shown = st.cat === 'All' ? open : open.filter(function (i) { return i.category === st.cat; });
    var sorted = G.sortByDistance(shown, o.pos);
    var located = sorted.filter(function (e) { return e.m !== null; });
    var noLoc = sorted.filter(function (e) { return e.m === null; });
    var all = st.all || o.none;
    var list = all ? byCity(S, sorted, !!o.pos)
      : html`<section class="idea-list">${located.slice(0, NEAR_COUNT).map(function (e) { return ideaCard(S, e); })}</section>
        ${noLoc.length ? html`<section><div class="section-title"><h2>No location</h2><span class="secondary">${noLoc.length}</span></div>${noLoc.map(function (e) { return ideaCard(S, e); })}</section>` : ''}`;
    return {
      city: null,
      header: D.plainHeader('Nearby', { sub: vm.ideas.length ? open.length + ' ideas' : '' }),
      body: html`
        <section class="nearby-head">
          <p class="nearby-note${o.fallback ? ' is-fallback' : ''}" data-nearby-note>${o.note}</p>
          ${st.pos && !o.fallback ? html`<button class="btn btn-quiet" type="button" data-action="nearby-locate">${D.icon('i-nearby')}Update location</button>`
            : html`<button class="btn" type="button" data-action="nearby-locate">${D.icon('i-nearby')}Use my location</button>`}
          ${st.notice ? html`<p class="banner-quiet" role="status" data-nearby-notice>${st.notice}</p>` : ''}
        </section>
        ${quickSearches(S)}
        ${st.adding ? addForm(S) : html`<button class="btn add-idea-btn" type="button" data-action="idea-add">+ Add an idea</button>`}
        ${vm.ideas.length ? html`
          <section><div class="section-title"><h2>Ideas</h2>${o.none ? '' : html`<button class="btn btn-quiet" type="button" data-action="nearby-all">${all ? 'Nearest first' : 'Show all by city'}</button>`}</div>
            ${filterBar(st, cats)}</section>
          ${shown.length ? list : html`<p class="empty">No open ideas in this category.</p>`}
          ${hiddenIdeas.length ? html`<section><button class="btn btn-quiet" type="button" data-action="nearby-hidden">${st.hidden ? 'Hide' : 'Show'} done and skipped (${hiddenIdeas.length})</button>
            ${st.hidden ? G.sortByDistance(hiddenIdeas, o.pos).map(function (e) { return ideaCard(S, e); }) : ''}</section>` : ''}`
        : html`<p class="empty">No ideas in the sheet yet. They come from the Ideas tab.</p>`}`
    };
  }

  // Ideas planned for a day, for Today and the Trip day (AC-N3).
  function planned(S, day) {
    var list = M.plannedOn(S.vm, day);
    if (!list.length) return '';
    return html`<section><div class="section-title"><h2>Planned from Nearby</h2><span class="secondary">${list.length}</span></div>
      ${list.map(function (i) { return ideaCard(S, { idea: i, m: null }, { compact: true, noDistance: true }); })}</section>`;
  }

  BT.ui.nearby = { render: render, planned: planned, state: state, planDays: planDays, anchor: anchor };
})();
