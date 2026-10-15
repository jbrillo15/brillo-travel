/* Time and dates (HANDOFF §5, §7, D10, EC-01..07).
   Every "today/now" decision is made in the trip time zone through
   Intl.DateTimeFormat, never through Date's local getters. Calendar dates are
   'YYYY-MM-DD' strings; times of day are 'HH:MM' strings or minutes. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  var P = BT.parse;                  // load parse.js first: shared date/time primitives
  var TRIP_TZ = (BT.config && BT.config.tripTz) || 'Asia/Tokyo';
  var DAY_ROLLOVER_MIN = 120;        // 00:00–02:00 belongs to the previous trip day (EC-05)
  var TIMED_NOW_MAX_MIN = 180;       // a timed item is "now" for at most 3 h

  // Slot windows in minutes from midnight (JST). Night runs past midnight.
  var SLOTS = {
    'All day': { order: 0, start: -1, end: 1560 },
    'Early': { order: 1, start: 300, end: 480 },
    'Morning': { order: 2, start: 480, end: 660 },
    'Midday': { order: 3, start: 660, end: 840 },
    'Afternoon': { order: 4, start: 840, end: 1020 },
    'Evening': { order: 5, start: 1020, end: 1140 },
    'Night': { order: 6, start: 1140, end: 1560 }
  };
  var SLOT_NAMES = Object.keys(SLOTS);

  // ---------- clock (staging can simulate it; HANDOFF §7) ----------
  var nowFn = null;
  function now() { return nowFn ? new Date(nowFn()) : new Date(); }
  function setNow(fn) { nowFn = typeof fn === 'function' ? fn : null; }

  // ---------- zone parts ----------
  var fmts = {};
  function partsIn(date, tz) {
    var f = fmts[tz] || (fmts[tz] = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }));
    var o = {};
    f.formatToParts(date).forEach(function (p) { o[p.type] = p.value; });
    return { y: +o.year, m: +o.month, d: +o.day, hh: (+o.hour) % 24, mm: +o.minute, ss: +o.second };
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function dateIn(date, tz) { var p = partsIn(date, tz); return iso(p.y, p.m, p.d); }

  // ---------- calendar-date arithmetic on 'YYYY-MM-DD' ----------
  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var isIsoDate = P.isIsoDate;
  function isoToUtc(s) { var m = ISO_RE.exec(s); return Date.UTC(+m[1], +m[2] - 1, +m[3]); }
  function addDays(s, n) {
    var d = new Date(isoToUtc(s) + n * 86400000);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  function daysBetween(a, b) { return Math.round((isoToUtc(b) - isoToUtc(a)) / 86400000); }

  // The trip day for an instant: JST date, with 00:00–02:00 counted as the night before (EC-05).
  function tripDate(date) { return dateIn(new Date(date.getTime() - DAY_ROLLOVER_MIN * 60000), TRIP_TZ); }
  // Minutes since midnight of the trip day (so 01:30 is 1530).
  function tripMinutes(date) {
    var p = partsIn(date, TRIP_TZ);
    var m = p.hh * 60 + p.mm;
    return m < DAY_ROLLOVER_MIN ? m + 1440 : m;
  }

  // Wall-clock date + time in a zone → the real instant (EC-07: IANA zones, no fixed offsets).
  function zonedToInstant(isoDate, hhmm, tz) {
    var d = ISO_RE.exec(isoDate || '');
    var t = /^(\d{2}):(\d{2})$/.exec(hhmm || '00:00');
    if (!d || !t || !P.validTz(tz)) return null;           // a bad zone never throws (F1)
    var target = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
    var guess = target;
    for (var i = 0; i < 3; i++) {
      var p = partsIn(new Date(guess), tz);
      var asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
      guess = target - (asUtc - guess);
    }
    return new Date(guess);
  }

  // ---------- parsing times (EC-06): shared with the script via parse.js ----------
  var parseTime = P.parseTime;
  function toMinutes(hhmm) { var t = /^(\d{2}):(\d{2})$/.exec(hhmm || ''); return t ? +t[1] * 60 + +t[2] : null; }

  function normSlot(s) { return P.pick(s, SLOT_NAMES); }

  // ---------- itinerary ordering and Now/Next (HANDOFF §5, AC-I1, AC-T4) ----------
  function itemStart(it) {
    var m = toMinutes(it.time);
    if (m !== null) return m < DAY_ROLLOVER_MIN ? m + 1440 : m;
    var s = SLOTS[it.slot];
    return s ? s.start : SLOTS.Night.start;
  }
  function sortItems(items) {
    return items.map(function (it, i) { return { it: it, k: itemStart(it), i: it.row != null ? it.row : i }; })
      .sort(function (a, b) { return a.k - b.k || a.i - b.i; })
      .map(function (x) { return x.it; });
  }
  function nowNext(items, minutes) {
    var list = sortItems(items.filter(function (it) { return it.slot !== 'All day' || it.time; }));
    var spans = list.map(function (it, i) {
      var start = itemStart(it), end;
      if (toMinutes(it.time) !== null) {
        end = start + TIMED_NOW_MAX_MIN;
        for (var j = i + 1; j < list.length; j++) {
          var s = itemStart(list[j]);
          if (s > start) { end = Math.min(end, s); break; }
        }
      } else {
        end = SLOTS[it.slot] ? SLOTS[it.slot].end : start + TIMED_NOW_MAX_MIN;
      }
      return { it: it, start: start, end: end };
    });
    var nowIdx = -1;
    for (var i = 0; i < spans.length; i++) {
      if (!spans[i].it.done && spans[i].start <= minutes && minutes < spans[i].end) { nowIdx = i; break; }
    }
    var next = null;
    for (var k = nowIdx + 1; k < spans.length; k++) {
      if (spans[k].it.done) continue;
      if (nowIdx >= 0 || spans[k].start > minutes) { next = spans[k].it; break; }
    }
    return { now: nowIdx >= 0 ? spans[nowIdx].it : null, next: next };
  }

  // ---------- trip phase (HANDOFF §8.1) ----------
  // settings: { tripStart, tripEnd, firstSpendDay, homeTz, tripTz }
  // legs: Transportation rows with departInstant / arriveInstant / arriveTz.
  function tripPhase(at, settings, legs) {
    var home = dateIn(at, settings.homeTz || 'America/Los_Angeles');
    var tday = tripDate(at);
    if (settings.tripEnd && tday > settings.tripEnd) return 'after';
    var inbound = (legs || []).filter(function (l) {
      return l.arriveTz === (settings.tripTz || TRIP_TZ) && l.arriveInstant;
    }).sort(function (a, b) { return a.arriveInstant - b.arriveInstant; })[0];
    if (inbound && at >= inbound.arriveInstant) return 'in';
    if (!inbound && settings.firstSpendDay && tday >= settings.firstSpendDay) return 'in';
    if (settings.tripStart && home >= settings.tripStart) return 'travel';
    return 'before';
  }
  function dayNumber(tday, settings) {
    var first = settings.firstSpendDay || settings.tripStart;
    if (!first || !settings.tripEnd) return null;
    return { n: daysBetween(first, tday) + 1, total: daysBetween(first, settings.tripEnd) + 1 };
  }

  // ---------- formatting ----------
  var dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
  function fmtDay(isoDate) {
    if (!isIsoDate(isoDate)) return '';
    return dayFmt.format(new Date(isoToUtc(isoDate))).replace(',', '');
  }
  function fmtClock(hhmm) {
    var m = toMinutes(hhmm);
    if (m === null) return '';
    var h = Math.floor(m / 60) % 24, mm = m % 60;
    return ((h % 12) || 12) + ':' + pad(mm) + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  var ZONE_LABELS = { 'Asia/Tokyo': 'Japan', 'America/Los_Angeles': 'Pacific', 'America/Vancouver': 'Pacific' };
  function zoneLabel(tz) { return ZONE_LABELS[tz] || String(tz || '').split('/').pop().replace(/_/g, ' '); }
  // An instant shown as a wall clock in a zone: "Thu Nov 19, 4:55 PM".
  function fmtInstant(date, tz) {
    var p = partsIn(date, tz);
    return fmtDay(iso(p.y, p.m, p.d)) + ', ' + fmtClock(pad(p.hh) + ':' + pad(p.mm));
  }
  function fmtDuration(ms) {
    if (!(ms >= 0)) return '';
    var min = Math.round(ms / 60000), h = Math.floor(min / 60);
    return (h ? h + 'h ' : '') + (min % 60) + 'm';
  }
  function slotAt(minutes) {
    for (var i = 1; i < SLOT_NAMES.length; i++) {
      var s = SLOTS[SLOT_NAMES[i]];
      if (minutes >= s.start && minutes < s.end) return SLOT_NAMES[i];
    }
    return null;
  }

  BT.time = {
    SLOTS: SLOTS, SLOT_NAMES: SLOT_NAMES,
    now: now, setNow: setNow,
    partsIn: partsIn, dateIn: dateIn, isIsoDate: isIsoDate, addDays: addDays, daysBetween: daysBetween,
    tripDate: tripDate, tripMinutes: tripMinutes, zonedToInstant: zonedToInstant,
    parseTime: parseTime, toMinutes: toMinutes, normSlot: normSlot,
    itemStart: itemStart, sortItems: sortItems, nowNext: nowNext,
    tripPhase: tripPhase, dayNumber: dayNumber, slotAt: slotAt,
    fmtDay: fmtDay, fmtClock: fmtClock, fmtInstant: fmtInstant, fmtDuration: fmtDuration, zoneLabel: zoneLabel
  };
})();
