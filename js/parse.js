/* Sheet parsing and validation (HANDOFF §5). Shared: the phone loads this as a
   classic script, and the Apps Script project runs the same file as Parse.gs,
   so the V-rules can't drift between the two. No DOM, no Intl time zones.

   Input to snapshot(): { <Tab name>: { values: [[...]], display: [[...]] } }
   where values are cell values with dates already turned into 'YYYY-MM-DD'
   and times into 'HH:MM' by the caller, and display are the display strings
   (used for text columns that hold numbers, e.g. 17-digit confirmation #s). */
(function (root) {
  'use strict';
  var BT = root.BT = root.BT || {};

  // ---------- primitives ----------
  var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isIsoDate(s) {
    var m = ISO_RE.exec(s || '');
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  function addDays(s, n) {
    var m = ISO_RE.exec(s);
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) + n * 86400000);
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function blank(v) { return v === null || v === undefined || v === false || String(v).trim() === ''; }
  function text(v) { return blank(v) ? '' : String(v).trim(); }

  // 18:00, 6:45 (24 h), 6pm, 6:45 PM, 6 p.m., 15:00:00. Anything else → null (EC-06, V-05).
  function parseTime(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
    var m = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})? ?(am|pm)?$/.exec(s);   // optional seconds: Sheets shows 3:00:00 PM
    if (!m) return null;
    var h = +m[1], min = m[2] ? +m[2] : 0, ap = m[3];
    if (!m[2] && !ap) return null;
    if (min > 59) return null;
    if (ap) {
      if (h < 1 || h > 12) return null;
      h = (h % 12) + (ap === 'pm' ? 12 : 0);
    } else if (h > 23) return null;
    return pad(h) + ':' + pad(min);
  }
  function parseDate(v) { var s = text(v); return isIsoDate(s) ? s : null; }
  // EC-14: "¥1,000", "1000", "$570", "-" → number or null. NaN → undefined (invalid).
  function parseMoney(v) {
    if (typeof v === 'number') return isFinite(v) ? v : undefined;
    var s = text(v);
    if (!s || /^[-–—]$/.test(s)) return null;
    var c = s.replace(/[¥￥$,\s]|JPY|USD|円/gi, '');
    if (!/^-?\d+(\.\d+)?$/.test(c)) return undefined;
    return +c;
  }
  function parseNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = text(v).replace(/,/g, '');
    return /^-?\d+(\.\d+)?$/.test(s) ? +s : null;
  }
  function parseBool(v) {
    if (v === true || v === false) return v;
    return /^(true|yes|y|1|✓)$/i.test(text(v));
  }
  // An IANA zone the platform knows ("Asia/Tokyo"), not "JST" or "PST" (Intl throws on those).
  function validTz(tz) {
    if (!tz || !/^[A-Za-z_]+\/[A-Za-z_\/+-]+$/.test(tz)) return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; }
  }
  function splitList(v) { return text(v).split(/\s*,\s*/).filter(Boolean); }
  function pick(v, allowed) {
    var s = text(v).toLowerCase();
    for (var i = 0; i < allowed.length; i++) if (allowed[i].toLowerCase() === s) return allowed[i];
    return null;
  }

  var SLOT_NAMES = ['All day', 'Early', 'Morning', 'Midday', 'Afternoon', 'Evening', 'Night'];
  var KINDS = ['Food', 'Temple', 'Shrine', 'Sight', 'Nature', 'Shopping', 'Activity', 'Transit', 'Hotel', 'Other'];

  // ---------- tab schemas (header → key, type) ----------
  // type: text | date | time | money | number | bool | int | list
  var TABS = {
    itinerary: { tab: 'Itinerary', required: ['ID', 'Date', 'Slot', 'City', 'Title'], cols: [
      ['ID', 'id'], ['Date', 'date', 'date'], ['Time', 'time', 'time'], ['Slot', 'slot'], ['City', 'city'],
      ['Title', 'title'], ['Kind', 'kind'], ['Place (EN)', 'placeEn'], ['Place (JA)', 'placeJa'], ['Maps', 'maps'],
      ['Getting there', 'gettingThere'], ['Notes', 'notes'], ['Booking ref', 'bookingRef'],
      ['Est cost ¥ pp', 'estCost', 'money'], ['Allergy risk', 'allergyRisk'], ['Booking status', 'bookingStatus'],
      ['Done', 'done', 'bool'], ['Updated', 'updated']] },
    hotels: { tab: 'Hotels', required: ['ID', 'City', 'Hotel (EN)', 'Check-in date', 'Check-out date'], cols: [
      ['ID', 'id'], ['City', 'city'], ['Hotel (EN)', 'nameEn'], ['Hotel (JA)', 'nameJa'], ['Address (EN)', 'addressEn'],
      ['Address (JA)', 'addressJa'], ['Phone', 'phone'], ['Nearest station & exit', 'station'],
      ['Check-in date', 'checkIn', 'date'], ['Check-out date', 'checkOut', 'date'], ['Check-in time', 'checkInTime', 'time'],
      ['Check-out time', 'checkOutTime', 'time'], ['Confirmation #', 'confirmation'], ['Breakfast', 'breakfast', 'bool'],
      ['Total', 'total', 'money'], ['Currency', 'currency'], ['Payment', 'payment'], ['Free cancel by', 'freeCancelBy', 'date'],
      ['Maps', 'maps'], ['Notes', 'notes']] },
    transportation: { tab: 'Transportation', required: ['ID', 'Type', 'Depart date', 'Depart TZ', 'Arrive date', 'Arrive TZ'], cols: [
      ['ID', 'id'], ['Type', 'type'], ['Depart date', 'departDate', 'date'], ['Depart time', 'departTime', 'time'],
      ['Depart TZ', 'departTz'], ['From', 'from'], ['Arrive date', 'arriveDate', 'date'], ['Arrive time', 'arriveTime', 'time'],
      ['Arrive TZ', 'arriveTz'], ['To', 'to'], ['Number', 'number'], ['Booking #', 'booking'], ['Carrier', 'carrier'],
      ['Seat', 'seat'], ['Notes', 'notes']] },
    expenses: { tab: 'Expenses', required: ['ID', 'Trip date', 'Amount', 'Currency', 'Envelope', 'Category'], cols: [
      ['ID', 'id'], ['Created at', 'createdAt'], ['Trip date', 'tripDate', 'date'], ['Amount', 'amount', 'money'],
      ['Currency', 'currency'], ['Envelope', 'envelope'], ['Category', 'category'], ['Method', 'method'],
      ['Paid by', 'paidBy'], ['Note', 'note'], ['Tax-free', 'taxFree', 'bool'], ['Refund status', 'refundStatus'],
      ['Device', 'device'], ['Updated at', 'updatedAt'], ['Deleted', 'deleted', 'bool']] },
    ideas: { tab: 'Ideas', required: ['ID', 'Name (EN)'], cols: [
      ['ID', 'id'], ['Name (EN)', 'nameEn'], ['Name (JA)', 'nameJa'], ['City', 'city'], ['Area', 'area'],
      ['Category', 'category'], ['Lat', 'lat', 'number'], ['Lng', 'lng', 'number'], ['Maps', 'maps'], ['Why', 'why'],
      ['Hours / notes', 'hours'], ['Allergy note', 'allergyNote'], ['Source', 'source'], ['Status', 'status'],
      ['Planned date', 'plannedDate', 'date'], ['Added by', 'addedBy'], ['Updated at', 'updatedAt'], ['Deleted', 'deleted', 'bool']] },
    checklists: { tab: 'Checklists', required: ['ID', 'List', 'Item'], cols: [
      ['ID', 'id'], ['List', 'list'], ['Item', 'item'], ['Owner', 'owner'], ['Bag', 'bag'], ['Due', 'due', 'date'],
      ['Done', 'done', 'bool'], ['Done by', 'doneBy'], ['Done at', 'doneAt'], ['Notes', 'notes'], ['Sort', 'sort', 'number'],
      ['Updated at', 'updatedAt'], ['Deleted', 'deleted', 'bool']] },
    phrases: { tab: 'Phrases', required: ['ID', 'English', 'Japanese', 'Verified'], cols: [
      ['ID', 'id'], ['Category', 'category'], ['English', 'english'], ['Japanese', 'japanese'], ['Romaji', 'romaji'],
      ['Card', 'card', 'bool'], ['Verified', 'verified', 'bool'], ['Source', 'source']] }
  };
  // Text columns where a number in the cell must be read from its display string.
  var DISPLAY_TEXT = { confirmation: 1, booking: 1, bookingRef: 1, phone: 1, number: 1, id: 1, seat: 1 };

  var SETTINGS = [
    ['Trip name', 'tripName', 'text'], ['Trip start', 'tripStart', 'date'], ['Trip end', 'tripEnd', 'date'],
    ['First spend day', 'firstSpendDay', 'date'], ['Trip time zone', 'tripTz', 'text'], ['Home time zone', 'homeTz', 'text'],
    ['Travelers', 'travelers', 'list'], ['Cities', 'cities', 'list'], ['Daily budget ¥ (both)', 'dailyBudget', 'money'],
    ['Shopping budget ¥', 'shoppingBudget', 'money'], ['Starting cash ¥', 'startingCash', 'money'],
    ['Large amount confirm ¥', 'largeAmountConfirm', 'money'], ['FX rate (live)', 'fxLive', 'number'],
    ['FX rate (fallback)', 'fxFallback', 'number'], ['Min app version', 'minAppVersion', 'text'],
    ['Insurance', 'insurance', 'text'], ['Emergency contacts', 'emergencyContacts', 'text'],
    // Shown on the allergy card as "look for these on labels"; kept in the sheet, not the public code.
    ['Allergen words', 'allergenWords', 'text']
  ];

  // ---------- header mapping (EC-11) ----------
  function norm(h) { return text(h).toLowerCase().replace(/\s+/g, ' '); }
  function headerIndex(row) {
    var idx = {};
    (row || []).forEach(function (h, i) { var k = norm(h); if (k && !(k in idx)) idx[k] = i; });
    return idx;
  }

  function issue(list, id, severity, tab, row, message) {
    list.push({ id: id, severity: severity, tab: tab, row: row, message: message });
  }

  // Generic: rows → typed objects. Blank rows (all cells empty or FALSE) are skipped (EC-12).
  function readTab(schema, raw, issues) {
    if (!raw || !raw.values || !raw.values.length) {
      issue(issues, 'V-09', 'error', schema.tab, 1, 'The "' + schema.tab + '" tab is missing or empty. The app keeps the last good copy.');
      return null;
    }
    var idx = headerIndex(raw.values[0]);
    var missing = schema.required.filter(function (h) { return !(norm(h) in idx); });
    if (missing.length) {
      issue(issues, 'V-09', 'error', schema.tab, 1, 'The "' + schema.tab + '" tab is missing the column' +
        (missing.length > 1 ? 's ' : ' ') + missing.map(function (m) { return '"' + m + '"'; }).join(', ') +
        '. Restore the header in row 1. The app keeps the last good copy.');
      return null;
    }
    var out = [];
    for (var r = 1; r < raw.values.length; r++) {
      var vals = raw.values[r] || [];
      if (vals.every(blank)) continue;
      var disp = raw.display && raw.display[r] || [];
      var o = { row: r + 1 };
      schema.cols.forEach(function (c) {
        var i = idx[norm(c[0])];
        var v = i === undefined ? '' : vals[i];
        var type = c[2] || 'text';
        if (type === 'text' && typeof v === 'number' && DISPLAY_TEXT[c[1]] && disp[i] !== undefined) v = disp[i];
        // Merged cells and formulas arrive as values; a merged cell's non-first cells are blank (EC-13).
        o[c[1]] = type === 'date' ? text(v) : type === 'time' ? text(v) : type === 'bool' ? parseBool(v) :
          type === 'money' ? parseMoney(v) : type === 'number' ? parseNumber(v) : text(v);
      });
      out.push(o);
    }
    return out;
  }

  function readSettings(raw, issues) {
    if (!raw || !raw.values || !raw.values.length) {
      issue(issues, 'V-09', 'error', 'Settings', 1, 'The "Settings" tab is missing or empty. The app keeps the last good copy.');
      return null;
    }
    var idx = headerIndex(raw.values[0]);
    if (!('key' in idx) || !('value' in idx)) {
      issue(issues, 'V-09', 'error', 'Settings', 1, 'The "Settings" tab needs "Key" and "Value" headers in row 1.');
      return null;
    }
    var byKey = {};
    for (var r = 1; r < raw.values.length; r++) {
      var row = raw.values[r] || [];
      var k = norm(row[idx.key]);
      if (k) byKey[k] = row[idx.value];
    }
    var s = {};
    SETTINGS.forEach(function (d) {
      var v = byKey[norm(d[0])];
      s[d[1]] = d[2] === 'date' ? parseDate(v) : d[2] === 'list' ? splitList(v) :
        d[2] === 'money' ? (parseMoney(v) === undefined ? null : parseMoney(v)) :
        d[2] === 'number' ? parseNumber(v) : (text(v) || null);
    });
    ['tripTz', 'homeTz'].forEach(function (k) {
      if (s[k] && !validTz(s[k])) {
        issue(issues, 'V-09', 'error', 'Settings', null, 'Settings: "' + s[k] + '" isn\'t a time zone the app understands. Use a name like Asia/Tokyo. The app uses its default until it\'s fixed.');
        s[k] = null;
      }
    });
    return s;
  }

  // ---------- per-tab shaping + V-rules ----------
  function shapeItinerary(rows, s, issues) {
    if (!rows) return null;
    var cities = s && s.cities && s.cities.length ? s.cities : ['Osaka', 'Kyoto', 'Tokyo', 'Travel'];
    return rows.filter(function (it) {
      var missing = [];
      if (!isIsoDate(it.date)) missing.push('Date');
      var slot = pick(it.slot, SLOT_NAMES);
      if (!slot) missing.push('Slot');
      if (!it.city) missing.push('City');
      if (!it.title) missing.push('Title');
      if (missing.length) {
        issue(issues, 'V-03', 'error', 'Itinerary', it.row, 'Row ' + it.row + ' is missing ' + missing.join(', ') +
          ' (or the value isn\'t one the app understands), so it\'s hidden. Fill it in using the dropdown.');
        return false;
      }
      it.slot = slot;
      it.city = pick(it.city, cities) || it.city;
      it.kind = pick(it.kind, KINDS);
      // Safety: an unrecognized allergy value is shown as Caution rather than dropped.
      var risk = text(it.allergyRisk);
      it.allergyRisk = !risk || /^[-–—]$/.test(risk) ? null : (pick(risk, ['Caution', 'High']) || 'Caution');
      it.bookingStatus = pick(it.bookingStatus, ['Not needed', 'To book', 'Booked']);
      if (it.time) {
        var t = parseTime(it.time);
        if (!t) issue(issues, 'V-05', 'warning', 'Itinerary', it.row, 'Row ' + it.row + ': the time "' + it.time +
          '" isn\'t understood, so the item uses its slot instead. Use 18:00 or 6:00 PM.');
        it.time = t;
      } else it.time = null;
      if (it.estCost === undefined) {
        issue(issues, 'V-06', 'warning', 'Itinerary', it.row, 'Row ' + it.row + ': the cost isn\'t a number. Use ¥1,000 or 1000, or leave it blank.');
        it.estCost = null;
      }
      if (s && s.tripStart && s.tripEnd && (it.date < s.tripStart || it.date > s.tripEnd)) {
        issue(issues, 'V-04', 'warning', 'Itinerary', it.row, 'Row ' + it.row + ' is dated ' + it.date + ', outside the trip dates.');
      }
      return true;
    });
  }

  function shapeHotels(rows, issues) {
    if (!rows) return null;
    return rows.filter(function (h) {
      if (!isIsoDate(h.checkIn) || !isIsoDate(h.checkOut) || h.checkOut <= h.checkIn || !h.nameEn) {
        issue(issues, 'V-01', 'error', 'Hotels', h.row, 'Row ' + h.row + ' needs a hotel name and valid check-in and check-out dates (check-out after check-in).');
        return false;
      }
      h.checkInTime = parseTime(h.checkInTime);
      h.checkOutTime = parseTime(h.checkOutTime);
      if (h.total === undefined) h.total = null;
      h.currency = pick(h.currency, ['JPY', 'USD']);
      h.payment = pick(h.payment, ['Pay at hotel', 'Prepaid', 'Paid']);
      if (!isIsoDate(h.freeCancelBy)) h.freeCancelBy = null;
      if (h.freeCancelBy && h.freeCancelBy >= h.checkIn) {
        issue(issues, 'V-07', 'warning', 'Hotels', h.row, h.nameEn + ': "Free cancel by" should be before check-in.');
      }
      if (!h.addressJa) {
        issue(issues, 'V-12', 'warning', 'Hotels', h.row, h.nameEn + ' has no Japanese address, so the taxi card shows English only. Add "Address (JA)" from the hotel\'s official site.');
      }
      return true;
    });
  }

  function shapeTransportation(rows, issues) {
    if (!rows) return null;
    return rows.filter(function (l) {
      if (!isIsoDate(l.departDate) || !isIsoDate(l.arriveDate) || !l.departTz || !l.arriveTz) {
        issue(issues, 'V-03', 'error', 'Transportation', l.row, 'Row ' + l.row + ' needs depart and arrive dates and time zones.');
        return false;
      }
      ['departTz', 'arriveTz'].forEach(function (k) {
        if (!validTz(l[k])) {
          issue(issues, 'V-03', 'error', 'Transportation', l.row, 'Row ' + l.row + ': "' + l[k] + '" isn\'t a time zone the app understands. Use a name like Asia/Tokyo or America/Los_Angeles. Times on this row show without a zone.');
          l[k] = null;
        }
      });
      l.type = pick(l.type, ['Flight', 'Train', 'Bus', 'Other']) || 'Other';
      l.departTime = parseTime(l.departTime);
      l.arriveTime = parseTime(l.arriveTime);
      return true;
    });
  }

  function shapeExpenses(rows, issues) {
    if (!rows) return null;
    rows.forEach(function (e) {
      var a = e.amount;
      e.excluded = false;
      if (!(typeof a === 'number' && a > 0 && Math.floor(a) === a)) {
        issue(issues, 'V-11', 'error', 'Expenses', e.row, 'Row ' + e.row + ': the amount must be a whole number above zero. It\'s left out of totals.');
        e.excluded = true;
      }
    });
    return rows;
  }

  function shapeSimple(rows) { return rows; }

  // V-01: every night from First spend day to the night before Trip end has exactly one stay.
  // V-02: an itinerary item's city matches that night's hotel (or the previous night's, on a
  //       check-out day). Travel items are exempt.
  function crossChecks(data, s, issues) {
    var hotels = data.hotels, it = data.itinerary;
    function staysOn(d) { return (hotels || []).filter(function (h) { return h.checkIn <= d && d < h.checkOut; }); }
    if (hotels && s && s.firstSpendDay && s.tripEnd) {
      for (var d = s.firstSpendDay; d < s.tripEnd; d = addDays(d, 1)) {
        var n = staysOn(d).length;
        if (n !== 1) issue(issues, 'V-01', 'error', 'Hotels', null, 'The night of ' + d + ' has ' +
          (n ? n + ' hotel stays' : 'no hotel') + '. Each night needs exactly one.');
      }
    }
    if (hotels && it) {
      it.forEach(function (x) {
        if (x.city === 'Travel') return;
        var cities = staysOn(x.date).concat(staysOn(addDays(x.date, -1))).map(function (h) { return h.city; });
        if (cities.length && cities.indexOf(x.city) < 0) {
          issue(issues, 'V-02', 'warning', 'Itinerary', x.row, 'Row ' + x.row + ' says ' + x.city +
            ', but that night\'s hotel is in ' + cities[0] + '.');
        }
      });
    }
    if (it && s && s.tripStart && s.tripEnd) {
      var days = {};
      it.forEach(function (x) { days[x.date] = 1; });
      for (var t = s.tripStart; t <= s.tripEnd; t = addDays(t, 1)) {
        if (!days[t]) issue(issues, 'V-10', 'warning', 'Itinerary', null, t + ' has no itinerary items yet.');
      }
    }
    // V-08: duplicate IDs in any tab.
    Object.keys(TABS).forEach(function (k) {
      var seen = {};
      (data[k] || []).forEach(function (r) {
        if (!r.id) return;
        if (seen[r.id]) issue(issues, 'V-08', 'error', TABS[k].tab, r.row, 'Rows ' + seen[r.id] + ' and ' + r.row +
          ' share the ID ' + r.id + '. Clear the ID in the copied row; the script assigns a new one.');
        else seen[r.id] = r.row;
      });
    });
  }

  function snapshot(rawTabs) {
    var issues = [];
    var settings = readSettings(rawTabs.Settings, issues);
    var data = { settings: settings };
    Object.keys(TABS).forEach(function (k) { data[k] = readTab(TABS[k], rawTabs[TABS[k].tab], issues); });
    data.itinerary = shapeItinerary(data.itinerary, settings, issues);
    data.hotels = shapeHotels(data.hotels, issues);
    data.transportation = shapeTransportation(data.transportation, issues);
    data.expenses = shapeExpenses(data.expenses, issues);
    data.ideas = shapeSimple(data.ideas);
    data.checklists = shapeSimple(data.checklists);
    data.phrases = data.phrases && data.phrases.filter(function (p) { return p.english || p.japanese; });
    crossChecks(data, settings, issues);
    return { data: data, issues: issues };
  }

  BT.parse = {
    TABS: TABS, SLOT_NAMES: SLOT_NAMES, KINDS: KINDS,
    isIsoDate: isIsoDate, addDays: addDays, parseTime: parseTime, parseDate: parseDate, parseMoney: parseMoney,
    parseNumber: parseNumber, parseBool: parseBool, splitList: splitList, pick: pick, validTz: validTz,
    headerIndex: headerIndex, norm: norm, snapshot: snapshot
  };
})(typeof window !== 'undefined' ? window : globalThis);
