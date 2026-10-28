/* The trip as the screens see it, derived from the stored snapshot.
   Pure functions: no DOM, no storage. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  var T = BT.time;

  // Known cities: station-mark letter (city initial, DESIGN §6) and name in Japanese.
  var CITIES = { Osaka: { code: 'O', ja: '大阪' }, Kyoto: { code: 'K', ja: '京都' }, Tokyo: { code: 'T', ja: '東京' } };
  var KIND_PICT = { Food: 'p-food', Temple: 'p-temple', Shrine: 'p-shrine', Sight: 'p-camera', Nature: 'p-tree',
    Shopping: 'p-bag', Activity: 'p-ticket', Transit: 'p-train', Hotel: 'p-bed', Other: 'p-other' };

  function settingsWithDefaults(s) {
    s = s || {};
    var c = BT.config;
    return {
      tripName: s.tripName || c.defaults.tripName,
      tripStart: s.tripStart || null, tripEnd: s.tripEnd || null,
      firstSpendDay: s.firstSpendDay || s.tripStart || null,
      tripTz: BT.parse.validTz(s.tripTz) ? s.tripTz : c.tripTz, homeTz: BT.parse.validTz(s.homeTz) ? s.homeTz : c.homeTz,
      travelers: s.travelers && s.travelers.length ? s.travelers : [],
      cities: s.cities && s.cities.length ? s.cities : c.defaults.cities,
      minAppVersion: s.minAppVersion || null,
      insurance: s.insurance || null, emergencyContacts: s.emergencyContacts || null,
      allergenWords: s.allergenWords || null, medicalWords: s.medicalWords || null,
      fxLive: s.fxLive, fxFallback: s.fxFallback,
      dailyBudget: s.dailyBudget, shoppingBudget: s.shoppingBudget, startingCash: s.startingCash,
      largeAmountConfirm: typeof s.largeAmountConfirm === 'number' && s.largeAmountConfirm > 0 ? s.largeAmountConfirm : 20000
    };
  }

  // Local-first (HANDOFF §7): the screens show the snapshot with queued changes on
  // top, marked pending. Rejected ops aren't shown; they wait in Sync issues.
  var OP_TAB = { checklist: 'checklists', expense: 'expenses', idea: 'ideas', itinerary: 'itinerary' };
  function applyOps(data, ops) {
    if (!ops || !ops.length) return data;
    var out = Object.assign({}, data);
    var copied = {};
    function rows(tab) {
      if (!copied[tab]) { out[tab] = (out[tab] || []).map(function (r) { return Object.assign({}, r); }); copied[tab] = true; }
      return out[tab];
    }
    ops.forEach(function (op) {
      if (op.status === 'rejected') return;
      var parts = String(op.type).split('.');
      var tab = OP_TAB[parts[0]];
      if (!tab || (data[tab] === null && parts[1] !== 'add' && parts[1] !== 'upsert')) return;
      var list = rows(tab);
      var row = list.filter(function (r) { return r.id === op.id; })[0];
      var f = op.fields || {};
      if (!row) {
        if (parts[1] !== 'add' && parts[1] !== 'upsert') return;
        row = { id: op.id, done: false, deleted: false };
        list.push(row);
      }
      Object.keys(f).forEach(function (k) { row[k] = f[k]; });
      if (parts[1] === 'delete') row.deleted = true;
      if (tab === 'checklists' && 'done' in f) { row.doneAt = f.done ? op.clientUpdatedAt : ''; if (!f.done) row.doneBy = ''; }
      if (op.status !== 'settled') row.pending = true;   // settled: in the sheet, not in the snapshot yet
    });
    return out;
  }

  function build(snapshot, ops) {
    var d = applyOps((snapshot && snapshot.data) || {}, ops);
    var settings = settingsWithDefaults(d.settings);
    var legs = (d.transportation || []).map(function (l) {
      var o = Object.assign({}, l);
      o.departInstant = T.zonedToInstant(l.departDate, l.departTime || '00:00', l.departTz);
      o.arriveInstant = T.zonedToInstant(l.arriveDate, l.arriveTime || '00:00', l.arriveTz);
      return o;
    }).sort(function (a, b) { return (a.departInstant || 0) - (b.departInstant || 0); });
    var byDate = {};
    (d.itinerary || []).forEach(function (it) { (byDate[it.date] = byDate[it.date] || []).push(it); });
    Object.keys(byDate).forEach(function (k) { byDate[k] = T.sortItems(byDate[k]); });
    return {
      settings: settings,
      itinerary: d.itinerary || [],
      byDate: byDate,
      hotels: (d.hotels || []).slice().sort(function (a, b) { return a.checkIn < b.checkIn ? -1 : 1; }),
      legs: legs,
      checklists: (d.checklists || []).filter(function (c) { return !c.deleted; }),
      expenses: (d.expenses || []).filter(function (e) { return !e.deleted; }),
      phrases: d.phrases || [],
      ideas: (d.ideas || []).filter(function (i) { return !i.deleted && i.nameEn; }),
      issues: (snapshot && snapshot.issues) || [],
      staleTabs: (snapshot && snapshot.staleTabs) || [],
      hasData: !!(snapshot && snapshot.data)
    };
  }

  function tonightHotel(vm, day) { return vm.hotels.filter(function (h) { return h.checkIn <= day && day < h.checkOut; })[0] || null; }
  function checkoutHotel(vm, day) { return vm.hotels.filter(function (h) { return h.checkOut === day; })[0] || null; }
  function cityFor(vm, day) {
    var h = tonightHotel(vm, day);
    if (h) return h.city;
    var it = (vm.byDate[day] || []).filter(function (x) { return x.city && x.city !== 'Travel'; })[0];
    if (it) return it.city;
    var out = checkoutHotel(vm, day);
    return out ? out.city : 'Travel';
  }
  function cityClass(city) { return 'city-' + String(city || 'travel').toLowerCase().replace(/[^a-z]/g, ''); }
  // Known cities get their line color; Travel (or blank) is blue; any other city is neutral.
  function knownCityClass(city) { return CITIES[city] ? cityClass(city) : !city || city === 'Travel' ? 'city-travel' : 'city-other'; }
  function cityCode(city) { return CITIES[city] ? CITIES[city].code : null; }
  function cityJa(city) { return CITIES[city] ? CITIES[city].ja : null; }

  // Legs that depart or arrive on this calendar date in their own zones.
  function legsOn(vm, day) {
    return vm.legs.filter(function (l) { return l.departDate === day || l.arriveDate === day; });
  }
  function tripDays(vm) {
    var s = vm.settings, out = [];
    if (!s.tripStart || !s.tripEnd || !T.isIsoDate(s.tripStart) || !T.isIsoDate(s.tripEnd)) return Object.keys(vm.byDate).sort();
    for (var d = s.tripStart; d <= s.tripEnd; d = T.addDays(d, 1)) out.push(d);
    return out;
  }

  // DESIGN.md §7: Kind drives the pictogram; blank Kind shows p-other, except
  // check-in/out (hotel) items whose icon is known.
  function pict(item) {
    if (item.kind && KIND_PICT[item.kind]) return KIND_PICT[item.kind];
    if (/\bcheck[- ]?(in|out)\b/i.test(item.title || '')) return 'p-bed';
    return 'p-other';
  }
  function legPict(l) { return l.type === 'Flight' ? 'p-plane' : 'p-train'; }

  // The verified allergy card, if one exists (AC-C2: unverified text never shows).
  function allergyCard(vm) {
    return vm.phrases.filter(function (p) {
      return /^allergy$/i.test(p.category || '') && p.card === true && p.verified === true && p.japanese;
    })[0] || null;
  }

  // The Medical section under the allergy card (HANDOFF §8.6): verified Emergency rows
  // marked Card. Same rule as the allergy card: unverified text never shows (AC-C2).
  function medicalCards(vm) {
    return vm.phrases.filter(function (p) {
      return /^emergency$/i.test(p.category || '') && p.card === true && p.verified === true && p.japanese;
    });
  }

  // ---------- ideas (HANDOFF §8.5) ----------
  var IDEA_PICT = { Food: 'p-food', Sight: 'p-camera', Shopping: 'p-bag', 'Café': 'p-cafe', Bar: 'p-lantern', Market: 'p-store', Other: 'p-other' };
  var IDEA_CATS = ['Food', 'Sight', 'Shopping', 'Café', 'Bar', 'Market', 'Other'];
  function ideaPict(i) { return IDEA_PICT[i.category] || 'p-other'; }
  function isOpenIdea(i) { return i.status !== 'Done' && i.status !== 'Skip'; }
  function plannedOn(vm, day) {
    return (vm.ideas || []).filter(function (i) { return i.status === 'Planned' && i.plannedDate === day; });
  }

  // ---------- category colors (DESIGN §2 Categories, 0.6) ----------
  var TONES = {
    idea: { Food: 'food', 'Café': 'food', Bar: 'food', Market: 'food', Sight: 'sights', Shopping: 'shopping', Other: 'basics' },
    expense: { Food: 'food', Transit: 'around', Activities: 'sights', Tickets: 'sights', Shopping: 'shopping', 'Tax refund': 'shopping',
      Lodging: 'stay', Other: 'basics', 'ATM withdrawal': 'basics' },
    phrase: { Basics: 'basics', Restaurant: 'food', Allergy: 'allergy', Directions: 'around', Taxi: 'around', Stores: 'shopping', Hotel: 'stay', Emergency: 'basics' },
    list: { 'Pre-trip': 'basics', Packing: 'stay', 'Departure day': 'around', 'Return packing': 'shopping' },
    envelope: { Shopping: 'shopping', Cash: 'basics', Bookings: 'stay' }
  };
  function tone(kind, key) { return (TONES[kind] && TONES[kind][key]) || null; }

  function groupRef(ref) { return String(ref || '').replace(/\s+/g, '').replace(/(.{4})(?=.)/g, '$1 '); }

  function semverLess(a, b) {
    var pa = String(a || '0').split('.').map(Number), pb = String(b || '0').split('.').map(Number);
    for (var i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0); }
    return false;
  }

  // ---------- checklists (HANDOFF §8.3) ----------
  var LIST_ORDER = ['Pre-trip', 'Packing', 'Departure day', 'Return packing'];
  function bySort(a, b) {
    var sa = typeof a.sort === 'number' ? a.sort : 1e9, sb = typeof b.sort === 'number' ? b.sort : 1e9;
    return sa - sb || (a.row || 1e9) - (b.row || 1e9);
  }
  function isOverdue(c, today) { return !c.done && !!c.due && c.due < today; }
  function lists(vm, today) {
    var by = {};
    vm.checklists.forEach(function (c) { var n = c.list || 'Other'; (by[n] = by[n] || []).push(c); });
    var names = Object.keys(by).sort(function (a, b) {
      var ia = LIST_ORDER.indexOf(a), ib = LIST_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : 1);
    });
    return names.map(function (n) {
      var items = by[n].slice().sort(bySort);
      return { name: n, items: items, done: items.filter(function (c) { return c.done; }).length,
        overdue: items.filter(function (c) { return isOverdue(c, today); }).length };
    });
  }
  function listByName(vm, name, today) { return lists(vm, today).filter(function (l) { return l.name === name; })[0] || null; }
  // Packing by bag (AC-L4). Bag names follow HANDOFF §5; "—" or blank is Unassigned.
  var BAG_ORDER = ['Suitcase', 'Jordan backpack', 'Lindsay backpack'];
  function byBag(items) {
    var g = {};
    items.forEach(function (c) { var b = c.bag && c.bag !== '—' ? c.bag : 'Unassigned'; (g[b] = g[b] || []).push(c); });
    return Object.keys(g).sort(function (a, b) {
      var ia = BAG_ORDER.indexOf(a), ib = BAG_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : 1);
    }).map(function (b) { return { bag: b, items: g[b], done: g[b].filter(function (c) { return c.done; }).length }; });
  }
  function overduePreTrip(vm, today) {
    return vm.checklists.filter(function (c) { return /^pre-trip$/i.test(c.list) && isOverdue(c, today); })
      .sort(function (a, b) { return a.due < b.due ? -1 : 1; });
  }
  function nextSort(items) { return items.reduce(function (m, c) { return Math.max(m, typeof c.sort === 'number' ? c.sort : 0); }, 0) + 10; }

  BT.model = {
    build: build, applyOps: applyOps, lists: lists, listByName: listByName, byBag: byBag, isOverdue: isOverdue,
    overduePreTrip: overduePreTrip, nextSort: nextSort, LIST_ORDER: LIST_ORDER, settingsWithDefaults: settingsWithDefaults,
    tonightHotel: tonightHotel, checkoutHotel: checkoutHotel, cityFor: cityFor,
    cityClass: knownCityClass, cityCode: cityCode, cityJa: cityJa, legsOn: legsOn, tripDays: tripDays,
    pict: pict, legPict: legPict, allergyCard: allergyCard, medicalCards: medicalCards, groupRef: groupRef, semverLess: semverLess,
    ideaPict: ideaPict, isOpenIdea: isOpenIdea, plannedOn: plannedOn, IDEA_CATS: IDEA_CATS, tone: tone
  };
})();
