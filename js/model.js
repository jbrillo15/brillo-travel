/* The trip as the screens see it, derived from the stored snapshot.
   Pure functions: no DOM, no storage. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  var T = BT.time;

  var CITY_CODES = { Osaka: 'OSA', Kyoto: 'KYO', Tokyo: 'TYO' };
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
      allergenWords: s.allergenWords || null,
      fxLive: s.fxLive, fxFallback: s.fxFallback
    };
  }

  function build(snapshot) {
    var d = (snapshot && snapshot.data) || {};
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
      checklists: d.checklists || [],
      phrases: d.phrases || [],
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
  function knownCityClass(city) { return CITY_CODES[city] ? cityClass(city) : 'city-travel'; }
  function cityCode(city) { return CITY_CODES[city] || null; }

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

  function groupRef(ref) { return String(ref || '').replace(/\s+/g, '').replace(/(.{4})(?=.)/g, '$1 '); }

  function semverLess(a, b) {
    var pa = String(a || '0').split('.').map(Number), pb = String(b || '0').split('.').map(Number);
    for (var i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0); }
    return false;
  }

  BT.model = {
    build: build, settingsWithDefaults: settingsWithDefaults,
    tonightHotel: tonightHotel, checkoutHotel: checkoutHotel, cityFor: cityFor,
    cityClass: knownCityClass, cityCode: cityCode, legsOn: legsOn, tripDays: tripDays,
    pict: pict, legPict: legPict, allergyCard: allergyCard, groupRef: groupRef, semverLess: semverLess
  };
})();
