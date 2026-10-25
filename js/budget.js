/* Budget math (HANDOFF §8.4). Pure functions: no DOM, no storage. Every total is in
   whole yen; a USD amount is converted once, per expense, at the current rate. A
   "Tax refund" entry counts as negative spending in its envelope. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  var T = BT.time;

  var CATEGORIES = ['Food', 'Transit', 'Activities', 'Shopping', 'Lodging', 'Tickets', 'Other', 'ATM withdrawal', 'Tax refund'];
  var ENVELOPES = ['Daily', 'Shopping', 'Bookings', 'Cash movement'];
  var METHODS = ['Card', 'Cash', 'Suica'];
  var CURRENCIES = ['JPY', 'USD'];
  var REFUND = ['n/a', 'Pending', 'Received'];
  var ENVELOPE_OF = { Food: 'Daily', Transit: 'Daily', Activities: 'Daily', Other: 'Daily', Shopping: 'Shopping',
    'Tax refund': 'Shopping', Lodging: 'Bookings', Tickets: 'Bookings', 'ATM withdrawal': 'Cash movement' };
  var MAX_AMOUNT = 1e9;              // the script refuses anything larger
  var CLOSE_SHARE = 0.25;            // DESIGN §10.1: "getting close" below 25% of today's allowance

  function envelopeFor(category) { return ENVELOPE_OF[category] || 'Daily'; }
  function isWhole(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

  // The keypad's text → a whole positive amount, or null. Commas, ¥, $ and spaces are ignored.
  function parseAmount(s) {
    var t = String(s === null || s === undefined ? '' : s).replace(/[\s,¥$￥]/g, '');
    if (!/^\d{1,9}$/.test(t)) return null;
    var n = +t;
    return n > 0 && n < MAX_AMOUNT ? n : null;
  }

  // ---------- exchange rate (EC-57, AC-B6) ----------
  function goodRate(r) { return typeof r === 'number' && isFinite(r) && r >= 50 && r <= 500; }
  // live: Settings' GOOGLEFINANCE value, dated by the snapshot. cached: the phone's last
  // good live rate. fallback: the sheet's fixed rate. Returns { rate, source, date }.
  function rate(settings, cached, snapshotAt) {
    var s = settings || {};
    var at = snapshotAt ? new Date(snapshotAt) : null;
    if (goodRate(s.fxLive)) return { rate: s.fxLive, source: 'live', date: at && !isNaN(at.getTime()) ? T.tripDate(at) : null };
    if (cached && goodRate(cached.rate)) return { rate: cached.rate, source: 'cached', date: cached.date || null };
    if (goodRate(s.fxFallback)) return { rate: s.fxFallback, source: 'fallback', date: null };
    return { rate: null, source: 'none', date: null };
  }
  function rateLabel(r) {
    if (!r || !r.rate) return 'No exchange rate in the sheet';
    var v = '¥' + (Math.round(r.rate * 10) / 10) + ' = $1';
    if (r.source === 'live') return v + (r.date ? ' · live, ' + T.fmtDay(r.date) : ' · live');
    if (r.source === 'cached') return v + ' · rate from ' + (r.date ? T.fmtDay(r.date) : 'an earlier sync');
    return v + ' · fallback rate from the sheet';
  }

  // One expense in yen (whole), or null when it can't be counted.
  function jpyOf(e, r) {
    if (!e || !isWhole(e.amount) || e.amount <= 0) return null;
    if (e.currency === 'USD') return r && r.rate ? Math.round(e.amount * r.rate) : null;
    return e.amount;
  }
  function signed(e, r) {
    var y = jpyOf(e, r);
    return y === null ? null : e.category === 'Tax refund' ? -y : y;
  }
  function usdOf(jpy, r) { return r && r.rate && isWhole(jpy) ? Math.round(jpy / r.rate) : null; }

  // Rows that count toward totals: not deleted, not flagged by V-11, with a usable amount.
  function counted(expenses) {
    return (expenses || []).filter(function (e) { return e && !e.deleted && !e.excluded && isWhole(e.amount) && e.amount > 0; });
  }

  function sum(list, r) {
    return list.reduce(function (t, e) { var y = signed(e, r); return y === null ? t : t + y; }, 0);
  }

  // ---------- the daily number (AC-B1, EC-56, EC-58) ----------
  function daily(expenses, settings, today, r) {
    var s = settings || {};
    var first = s.firstSpendDay, end = s.tripEnd, budget = isWhole(s.dailyBudget) ? s.dailyBudget : null;
    var list = counted(expenses).filter(function (e) { return e.envelope === 'Daily'; });
    var spentTotal = sum(list, r);
    var spentToday = sum(list.filter(function (e) { return e.tripDate === today; }), r);
    var spentBefore = sum(list.filter(function (e) { return e.tripDate && e.tripDate < today; }), r);
    var out = { budget: budget, spentTotal: spentTotal, spentToday: spentToday, spentBefore: spentBefore,
      spendDays: null, daysLeft: null, allowance: null, left: null, remaining: budget === null ? null : budget - spentTotal,
      phase: 'unknown', state: 'ok', fill: 0 };
    if (!T.isIsoDate(first) || !T.isIsoDate(end) || end < first) return out;
    out.spendDays = T.daysBetween(first, end) + 1;
    if (budget === null) return out;
    if (today < first) {
      out.phase = 'before';
      out.daysLeft = out.spendDays;
      out.allowance = Math.round(budget / out.spendDays);        // preview
    } else if (today > end) {
      out.phase = 'after';
      out.daysLeft = 0;
      return out;                                                // totals only
    } else {
      out.phase = 'during';
      out.daysLeft = T.daysBetween(today, end) + 1;              // including today
      out.allowance = Math.round((budget - spentBefore) / out.daysLeft);
    }
    out.left = out.allowance - spentToday;
    out.state = out.left < 0 ? 'over' : out.allowance <= 0 || out.left < out.allowance * CLOSE_SHARE ? 'close' : 'ok';
    out.fill = out.allowance > 0 ? Math.max(0, Math.min(100, Math.round(spentToday / out.allowance * 100))) : 100;
    return out;
  }

  // ---------- shopping, cash, bookings ----------
  function shopping(expenses, settings, r) {
    var s = settings || {};
    var list = counted(expenses).filter(function (e) { return e.envelope === 'Shopping'; });
    var refunds = -sum(list.filter(function (e) { return e.category === 'Tax refund'; }), r);
    var spent = sum(list, r);
    var budget = isWhole(s.shoppingBudget) ? s.shoppingBudget : null;
    var pending = list.filter(function (e) { return e.taxFree === true && e.category !== 'Tax refund' && e.refundStatus === 'Pending'; });
    return { budget: budget, spent: spent, refunds: refunds, left: budget === null ? null : budget - spent,
      pendingRefunds: pending.length, pendingJpy: sum(pending, r) };
  }

  // AC-B2: Starting cash + ATM withdrawals − Cash-method spending (all envelopes). A cash tax
  // refund puts yen back in the wallet. ATM withdrawals never count as spending.
  function cash(expenses, settings, r) {
    var s = settings || {};
    var list = counted(expenses);
    var withdrawals = sum(list.filter(function (e) { return e.envelope === 'Cash movement'; }), r);
    var cashSpent = sum(list.filter(function (e) { return e.envelope !== 'Cash movement' && e.method === 'Cash'; }), r);
    var starting = isWhole(s.startingCash) ? s.startingCash : null;
    return { starting: starting, withdrawals: withdrawals, spent: cashSpent,
      onHand: (starting || 0) + withdrawals - cashSpent, startingSet: starting !== null };
  }

  // Paid: Bookings-envelope expenses. Due: hotel stays marked "Pay at hotel" with a Total,
  // until their check-in day has passed (the Hotels tab is filled in by hand; O-1).
  function bookings(expenses, hotels, today, r) {
    var paid = counted(expenses).filter(function (e) { return e.envelope === 'Bookings'; })
      .sort(function (a, b) { return a.tripDate < b.tripDate ? -1 : a.tripDate > b.tripDate ? 1 : 0; });
    var due = (hotels || []).filter(function (h) {
      return h && /^pay at hotel$/i.test(String(h.payment || '').trim()) && isWhole(h.total) && h.total > 0 &&
        T.isIsoDate(h.checkIn) && h.checkIn >= today;
    }).map(function (h) {
      var e = { amount: h.total, currency: h.currency === 'USD' ? 'USD' : 'JPY' };
      return { id: h.id, name: h.nameEn, amount: h.total, currency: e.currency, jpy: jpyOf(e, r), dueDate: h.checkIn, freeCancelBy: h.freeCancelBy || null };
    }).sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; });
    function total(xs) { return xs.reduce(function (t, x) { return x.jpy === null ? t : t + x.jpy; }, 0); }
    return { paid: paid, paidJpy: sum(paid, r), due: due, dueJpy: total(due) };
  }

  function summary(expenses, hotels, settings, today, r) {
    return { daily: daily(expenses, settings, today, r), shopping: shopping(expenses, settings, r),
      cash: cash(expenses, settings, r), bookings: bookings(expenses, hotels, today, r), rate: r };
  }

  // Calculator: what's left today after a purchase (null outside the trip's spend days).
  function leaveAfter(d, priceJpy) { return d && d.left !== null && isWhole(priceJpy) ? d.left - priceJpy : null; }

  // ---------- CSV export (AC-B7) ----------
  var CSV_COLS = ['Trip date', 'Category', 'Envelope', 'Amount', 'Currency', 'JPY', 'USD', 'Method', 'Paid by', 'Note',
    'Tax-free', 'Refund status', 'Rate (¥ per $1)', 'ID'];
  function cell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-\d+(\.\d+)?$/.test(s)) s = "'" + s;                     // a spreadsheet never runs a note as a formula
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csv(expenses, r) {
    var rows = (expenses || []).filter(function (e) { return e && !e.deleted; }).slice().sort(function (a, b) {
      return String(a.tripDate || '') < String(b.tripDate || '') ? -1 : String(a.tripDate || '') > String(b.tripDate || '') ? 1
        : String(a.createdAt || '') < String(b.createdAt || '') ? -1 : 1;
    });
    var lines = [CSV_COLS.map(cell).join(',')];
    rows.forEach(function (e) {
      var y = e.excluded ? null : signed(e, r);                    // a tax refund is negative, so the column sums to net spending
      var usd = y === null || !r || !r.rate ? '' : e.currency === 'USD' ? (y < 0 ? -e.amount : e.amount).toFixed(2) : (y / r.rate).toFixed(2);
      lines.push([e.tripDate, e.category, e.envelope, e.amount, e.currency || 'JPY', y === null ? '' : y, usd, e.method, e.paidBy,
        e.note, e.taxFree === true ? 'TRUE' : e.taxFree === false ? 'FALSE' : '', e.refundStatus, r && r.rate ? r.rate : '', e.id].map(cell).join(','));
    });
    return '﻿' + lines.join('\r\n') + '\r\n';                 // BOM: Excel and Numbers read the Japanese notes as UTF-8
  }

  // ---------- display ----------
  function yen(n) {
    if (!isWhole(n)) return '—';
    return (n < 0 ? '−' : '') + '¥' + Math.abs(n).toLocaleString('en-US');   // a true minus sign (DESIGN §6 #5)
  }
  function usd(n) {
    if (!isWhole(n)) return '—';
    return (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US');
  }
  function money(e) { return e && e.currency === 'USD' ? usd(e.amount) : yen(e && e.amount); }

  BT.budget = {
    CATEGORIES: CATEGORIES, ENVELOPES: ENVELOPES, METHODS: METHODS, CURRENCIES: CURRENCIES, REFUND: REFUND,
    envelopeFor: envelopeFor, parseAmount: parseAmount, rate: rate, rateLabel: rateLabel, goodRate: goodRate,
    jpyOf: jpyOf, usdOf: usdOf, counted: counted, daily: daily, shopping: shopping, cash: cash, bookings: bookings,
    summary: summary, leaveAfter: leaveAfter, csv: csv, yen: yen, usd: usd, money: money
  };
})();
