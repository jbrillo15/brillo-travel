/* Distances and the Nearby anchor (HANDOFF §8.5, §12 L1). Pure functions: no
   DOM, no geolocation calls. Coordinates stay on the phone (§7). */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};

  var WALK_M_PER_MIN = 80;
  var EARTH_M = 6371008.8;   // mean Earth radius
  var FAR_M = 50000;         // farther than this from every idea: not in Japan yet

  function rad(d) { return d * Math.PI / 180; }
  function valid(p) {
    return !!p && typeof p.lat === 'number' && typeof p.lng === 'number' && isFinite(p.lat) && isFinite(p.lng) &&
      Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);
  }
  // Great-circle (haversine) distance in meters: the straight line AC-N1 measures against.
  function distance(a, b) {
    if (!valid(a) || !valid(b)) return null;
    var dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function walkMinutes(m) { return m === null || m === undefined ? null : Math.max(1, Math.round(m / WALK_M_PER_MIN)); }

  // { main, sub }: walking minutes then meters up to 3 km; kilometers beyond.
  function describe(m) {
    if (m === null || m === undefined) return null;
    if (m <= 3000) return { main: walkMinutes(m) + ' min', sub: (m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1) + ' km') + ' walk' };
    return { main: (m < 100000 ? (m / 1000).toFixed(1) : Math.round(m / 1000).toLocaleString('en-US')) + ' km', sub: 'away' };
  }

  // Coordinates from a Google Maps link: /@lat,lng, query=lat,lng, q=lat,lng or ll=lat,lng.
  var NUM = '(-?\\d{1,2}(?:\\.\\d+)?)\\s*,\\s*(-?\\d{1,3}(?:\\.\\d+)?)';
  var MAPS_RE = [new RegExp('/@' + NUM), new RegExp('[?&](?:query|q|ll|destination)=' + NUM)];
  function fromMaps(url) {
    var s = String(url || '');
    try { s = decodeURIComponent(s); } catch (e) { /* keep it as typed */ }
    for (var i = 0; i < MAPS_RE.length; i++) {
      var m = MAPS_RE[i].exec(s);
      if (m) { var p = { lat: +m[1], lng: +m[2] }; if (valid(p)) return p; }
    }
    return null;
  }

  function norm(s) { return String(s || '').toLowerCase().replace(/[\s'’"「」・.,()（）-]/g, ''); }
  // An itinerary item or hotel's coordinates: its own Maps link, else a curated idea
  // with the same Japanese name, or whose English name the title or place contains.
  function locate(x, ideas) {
    if (!x) return null;
    var p = fromMaps(x.maps);
    if (p) return p;
    var ja = norm(x.placeJa || x.nameJa), en = norm((x.placeEn || '') + ' ' + (x.title || '') + ' ' + (x.nameEn || ''));
    var hit = (ideas || []).filter(function (i) {
      if (!valid(i)) return false;
      if (ja && norm(i.nameJa) === ja) return true;
      var n = norm(i.nameEn);
      return n.length >= 5 && en.indexOf(n) >= 0;
    })[0];
    return hit ? { lat: hit.lat, lng: hit.lng } : null;
  }

  // The no-location fallback (AC-N2): the item happening now, then the next items
  // of today in order, then tonight's (or the next) hotel. Returns { pos, label } or null.
  function fallbackAnchor(vm, opts) {
    var ideas = vm.ideas || [];
    var list = [];
    if (opts.now) list.push(opts.now);
    if (opts.next) list.push(opts.next);
    (opts.later || []).forEach(function (x) { list.push(x); });
    for (var i = 0; i < list.length; i++) {
      var p = locate(list[i], ideas);
      if (p) return { pos: p, label: list[i].placeEn || list[i].title, kind: 'item' };
    }
    if (opts.hotel) {
      var h = locate(opts.hotel, ideas);
      if (h) return { pos: h, label: opts.hotel.nameEn, kind: 'hotel' };
    }
    return null;
  }

  // Ideas with a distance from pos, nearest first; ideas without coordinates last (EC-62).
  function sortByDistance(ideas, pos) {
    return ideas.map(function (i, n) { return { idea: i, m: pos ? distance(pos, i) : null, n: n }; })
      .sort(function (a, b) {
        if (a.m === null && b.m === null) return a.n - b.n;
        if (a.m === null) return 1;
        if (b.m === null) return -1;
        return a.m - b.m || a.n - b.n;
      });
  }
  function isFar(ideas, pos) {
    var near = sortByDistance(ideas, pos)[0];
    return !!near && near.m !== null && near.m > FAR_M;
  }

  BT.geo = { distance: distance, walkMinutes: walkMinutes, describe: describe, fromMaps: fromMaps, locate: locate,
    fallbackAnchor: fallbackAnchor, sortByDistance: sortByDistance, isFar: isFar, valid: valid, FAR_M: FAR_M };
})();
