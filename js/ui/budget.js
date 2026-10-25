/* Budget (HANDOFF §8.4): the daily number, the other envelopes, the expense list,
   the add/edit form and the calculator. The math lives in js/budget.js; every change
   goes through the outbox (app.js), so it shows at once, marked "waiting to sync". */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  BT.ui = BT.ui || {};
  var D = BT.dom, html = D.html, T = BT.time, B = BT.budget;

  var CAT_PICT = { Food: 'p-food', Transit: 'p-train', Activities: 'p-ticket', Shopping: 'p-bag', Lodging: 'p-bed',
    Tickets: 'p-ticket', Other: 'p-other', 'ATM withdrawal': 'p-yen', 'Tax refund': 'p-yen' };
  var STATE_LABEL = { ok: 'On track', close: 'Getting close', over: 'Over' };
  var PEOPLE = ['Jordan', 'Lindsay'];

  // The trip day in Japan (D10): an expense at 1 AM belongs to the night before (EC-05).
  function today() { return T.tripDate(T.now()); }
  function rateFor(S) { return B.rate(S.vm.settings, S.fxCache, S.snapshot && S.snapshot.generatedAt); }
  function summaryFor(S) { return B.summary(S.vm.expenses, S.vm.hotels, S.vm.settings, today(), rateFor(S)); }
  function approxUsd(jpy, r) { var u = B.usdOf(jpy, r); return u === null ? '' : '≈ ' + B.usd(u); }

  function dailyCard(d, r) {
    if (d.budget === null) return html`<section class="budget"><p class="empty">Set "Daily budget ¥ (both)" in the sheet's Settings tab to see what's left each day.</p></section>`;
    if (d.phase === 'after' || d.allowance === null) {
      return html`<section class="budget" data-state="ok">
        <div class="head"><span class="eyebrow">Daily spending · trip total</span></div>
        <div class="left num">${B.yen(d.spentTotal)}<small>of ${B.yen(d.budget)}</small></div>
        <div class="foot"><span>${d.remaining < 0 ? html`<span class="over-text">${B.yen(-d.remaining)} over</span>` : B.yen(d.remaining) + ' unspent'}</span></div>
      </section>`;
    }
    var before = d.phase === 'before';
    return html`<section class="budget" data-state="${d.state}" aria-label="Left today">
      <div class="head"><span class="eyebrow">${before ? 'Each day of the trip' : 'Left today'}</span><span class="status">${STATE_LABEL[d.state]}</span></div>
      <div class="left num" data-left>${B.yen(d.left)}<small>${approxUsd(d.left, r)}</small></div>
      <span class="meter" style="--fill:${d.fill + '%'}" aria-hidden="true"><i></i></span>
      <div class="foot">
        <span class="num">${before ? 'Preview: ' + B.yen(d.budget) + ' over ' + d.spendDays + ' days' : 'Spent ' + B.yen(d.spentToday) + ' of ' + B.yen(d.allowance)}</span>
        <span class="num">Trip left ${B.yen(d.remaining)} · ${d.daysLeft} ${d.daysLeft === 1 ? 'day' : 'days'}</span>
      </div>
    </section>`;
  }

  function envelopeCard(title, pict, main, lines) {
    return html`<section class="envelope">
      <div class="env-top"><span class="pict-tile" aria-hidden="true">${D.icon(pict)}</span><span class="eyebrow">${title}</span></div>
      <div class="env-main num">${main}</div>
      ${lines.filter(Boolean).map(function (l) { return html`<div class="secondary env-line">${l}</div>`; })}
    </section>`;
  }

  function shoppingCard(s) {
    return envelopeCard('Shopping', 'p-bag', B.yen(s.spent), [
      s.budget === null ? 'No Shopping budget in the sheet yet' : s.left < 0 ? html`<span class="over-text">${B.yen(-s.left)} over</span> ${'of ' + B.yen(s.budget)}` : B.yen(s.left) + ' left of ' + B.yen(s.budget),
      s.pendingRefunds ? s.pendingRefunds + ' tax-free ' + (s.pendingRefunds === 1 ? 'purchase' : 'purchases') + ' waiting for a refund' : '',
      s.refunds ? B.yen(s.refunds) + ' refunded' : ''
    ]);
  }

  function cashCard(c) {
    return envelopeCard('Cash on hand', 'p-yen', B.yen(c.onHand), [
      c.startingSet ? 'Started with ' + B.yen(c.starting) : 'No Starting cash in the sheet yet, so this counts from ¥0',
      c.withdrawals ? '+ ' + B.yen(c.withdrawals) + ' from ATMs' : '',
      c.spent ? '− ' + B.yen(c.spent) + ' paid in cash' : ''
    ]);
  }

  function bookingsCard(b, r) {
    return html`<section class="envelope">
      <div class="env-top"><span class="pict-tile" aria-hidden="true">${D.icon('p-ticket')}</span><span class="eyebrow">Bookings · not in daily</span></div>
      <div class="env-main num">${B.yen(b.paidJpy)}<small> paid</small></div>
      ${b.paid.length ? html`<ul class="env-list">${b.paid.map(function (e) {
        return html`<li><a href="${'#/expense/' + encodeURIComponent(e.id)}"><span>${e.note || e.category}</span><span class="num">${B.money(e)}</span></a></li>`;
      })}</ul>` : html`<div class="secondary env-line">Log Lodging or Tickets payments to list them here.</div>`}
      ${b.due.length ? html`<div class="eyebrow due-head">Still to pay</div><ul class="env-list due">${b.due.map(function (h) {
        return html`<li><span><span>${h.name}</span><span class="secondary">At check-in · ${T.fmtDay(h.dueDate)}${h.freeCancelBy ? ' · free cancel by ' + T.fmtDay(h.freeCancelBy) : ''}</span></span>
          <span class="num">${h.currency === 'USD' ? B.usd(h.amount) : B.yen(h.amount)}</span></li>`;
      })}</ul>` : ''}
    </section>`;
  }

  function expenseRow(e) {
    var meta = [e.method, e.paidBy ? html`<span class="who-chip">${D.avatar(e.paidBy, 'chip-face')}${e.paidBy}</span>` : ''];
    if (e.taxFree === true && e.refundStatus === 'Pending') meta.push('Refund pending');
    if (e.pending) meta.push(html`<span class="pending">Waiting to sync</span>`);
    var parts = [];
    meta.filter(Boolean).forEach(function (m, i) { if (i) parts.push(' · '); parts.push(m); });
    var refund = e.category === 'Tax refund', atm = e.envelope === 'Cash movement';
    return html`<li><a class="exp-row" href="${'#/expense/' + encodeURIComponent(e.id)}" data-id="${e.id}">
      <span class="pict-tile" aria-hidden="true">${D.icon(CAT_PICT[e.category] || 'p-other')}</span>
      <span class="exp-main"><span class="exp-title">${e.note || e.category}</span><span class="secondary">${e.note ? e.category + ' · ' : ''}${parts}</span></span>
      <span class="exp-amt num">${refund ? '+' : ''}${B.money(e)}${atm ? html`<small>to cash</small>` : ''}</span>
    </a></li>`;
  }

  function expenseList(expenses) {
    var by = {};
    expenses.forEach(function (e) { var k = e.tripDate || ''; (by[k] = by[k] || []).push(e); });
    var days = Object.keys(by).sort().reverse();
    if (!days.length) return html`<p class="empty">No expenses yet. Tap Add expense to log the first one.</p>`;
    return days.map(function (day) {
      var rows = by[day].slice().sort(function (a, b) { return String(b.createdAt || '') < String(a.createdAt || '') ? -1 : 1; });
      return html`<section class="exp-day"><h3 class="eyebrow">${day ? T.fmtDay(day) : 'No date'}</h3><ul class="exp-list">${rows.map(expenseRow)}</ul></section>`;
    });
  }

  function overview(S) {
    var sm = summaryFor(S), r = sm.rate;
    var rejected = S.status.rejected || 0;
    return {
      city: null,
      header: D.plainHeader('Budget', { sub: 'Shared by both phones' }),
      body: html`
        ${rejected ? html`<a class="info-row issue-row" href="#/sync-issues"><span>${rejected === 1 ? '1 change' : rejected + ' changes'} the sheet didn't accept</span><b>Review</b></a>` : ''}
        ${dailyCard(sm.daily, r)}
        <div class="budget-actions">
          <a class="btn btn-primary" href="#/expense/new">Add expense</a>
          <a class="btn" href="#/calc">${D.icon('p-yen')}Calculator</a>
        </div>
        <div class="envelopes">${shoppingCard(sm.shopping)}${cashCard(sm.cash)}</div>
        ${bookingsCard(sm.bookings, r)}
        <div class="section-title"><h2>Expenses</h2></div>
        ${expenseList(S.vm.expenses.filter(function (e) { return !e.excluded; }))}
        <div class="row-between budget-foot">
          <span class="secondary" data-rate>${B.rateLabel(r)}</span>
          <button class="btn" type="button" data-action="export-csv"${S.vm.expenses.length ? '' : D.raw(' disabled')}>Export CSV</button>
        </div>`
    };
  }

  // ---------- add / edit (the form is never redrawn by a sync; app.js holdRender) ----------
  function radios(name, label, options, current, cls) {
    return html`<fieldset class="${'field choice ' + (cls || '')}"><legend class="eyebrow">${label}</legend><div class="choices">
      ${options.map(function (o) {
        return html`<label class="choice-chip"><input type="radio" name="${name}" value="${o}"${current === o ? D.raw(' checked') : ''}>${CAT_PICT[o] && name === 'category' ? D.icon(CAT_PICT[o]) : ''}<span>${o}</span></label>`;
      })}</div></fieldset>`;
  }
  function selectField(name, label, options, current) {
    return html`<label class="field"><span class="eyebrow">${label}</span><select name="${name}">
      ${options.map(function (o) { return html`<option value="${o}"${current === o ? D.raw(' selected') : ''}>${o}</option>`; })}</select></label>`;
  }
  // What the form shows, as strings, so Save can send only what the person changed.
  function formState(e) {
    return { amount: e.amount ? String(e.amount) : '', currency: e.currency || 'JPY', category: e.category || '', envelope: e.envelope || '',
      method: e.method || '', paidBy: e.paidBy || '', tripDate: e.tripDate || '', note: e.note || '',
      taxFree: e.taxFree === true ? 'TRUE' : 'FALSE', refundStatus: e.refundStatus || 'n/a' };
  }

  function form(S, id) {
    var isNew = id === 'new';
    var e = isNew ? null : S.vm.expenses.filter(function (x) { return x.id === id; })[0];
    if (!isNew && !e) return { city: null, header: D.plainHeader('Not found', { back: D.backLink('#/budget', 'Budget') }),
      body: html`<p class="empty">This expense isn't in the latest copy of the sheet. It may have been deleted.</p>` };
    var v = formState(e || { currency: 'JPY', category: 'Food', envelope: 'Daily', method: 'Card', paidBy: S.owner || '',
      tripDate: today(), amount: S.prefill && S.prefill.amount });
    var shop = v.envelope === 'Shopping' && v.category !== 'Tax refund';
    return {
      city: null,
      header: D.plainHeader(isNew ? 'Add expense' : 'Edit expense', { back: D.backLink('#/budget', 'Budget') }),
      body: html`<form class="settings-group expense-form" data-action="save-expense" data-hold data-id="${isNew ? '' : e.id}" data-orig="${JSON.stringify(isNew ? {} : v)}" novalidate>
          <div class="amount-row">
            <label class="field amount-field"><span class="eyebrow">Amount</span>
              <span class="amount-input"><span class="cur" aria-hidden="true" data-cur>${v.currency === 'USD' ? '$' : '¥'}</span>
              <input name="amount" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="11" value="${v.amount}" placeholder="0" aria-describedby="amount-error"${isNew ? D.raw(' autofocus') : ''}></span></label>
            ${selectField('currency', 'Currency', B.CURRENCIES, v.currency)}
          </div>
          <p class="form-error" id="amount-error" role="alert" data-error hidden></p>
          ${radios('category', 'Category', B.CATEGORIES, v.category, 'cats')}
          ${radios('method', 'Paid with', B.METHODS, v.method, 'seg3')}
          <p class="tip" data-suica-tip${v.method === 'Suica' ? '' : D.raw(' hidden')}>Log Suica top-ups as Transit, not each fare, so nothing is counted twice.</p>
          ${radios('paidBy', 'Paid by', PEOPLE, v.paidBy, 'seg2')}
          <label class="field"><span class="eyebrow">Date (Japan)</span><input name="tripDate" type="date" value="${v.tripDate}" required></label>
          <label class="field"><span class="eyebrow">Note</span><input name="note" type="text" maxlength="200" autocomplete="off" value="${v.note}" placeholder="Optional"></label>
          <div class="tax-free" data-taxfree${shop ? '' : D.raw(' hidden')}>
            <label class="toggle"><input name="taxFree" type="checkbox"${v.taxFree === 'TRUE' ? D.raw(' checked') : ''}><span>Tax-free purchase</span></label>
            <div data-refund${v.taxFree === 'TRUE' && !isNew ? '' : D.raw(' hidden')}>${selectField('refundStatus', 'Refund', B.REFUND, v.refundStatus)}</div>
          </div>
          ${selectField('envelope', 'Envelope', B.ENVELOPES, v.envelope)}
          <button class="btn btn-primary" type="submit">${isNew ? 'Add expense' : 'Save'}</button>
        </form>
        ${e && e.pending ? html`<p class="secondary">Waiting to sync.</p>` : ''}
        ${e && e.device ? html`<p class="secondary">Logged on ${e.device}${e.createdAt ? ' · ' + T.fmtInstant(new Date(e.createdAt), BT.config.tripTz) : ''}.</p>` : ''}
        ${e ? html`<button class="btn btn-quiet delete" type="button" data-action="delete-expense" data-id="${e.id}">Delete expense</button>` : ''}`
    };
  }

  // ---------- calculator ----------
  function calcResult(S, text) {
    var r = rateFor(S), d = B.daily(S.vm.expenses, S.vm.settings, today(), r);
    var y = B.parseAmount(text);
    if (y === null) return html`<span class="secondary">Type a price in yen.</span>`;
    var left = B.leaveAfter(d, y), usd = B.usdOf(y, r);
    return html`<span class="calc-usd num">${usd === null ? 'No exchange rate' : '≈ ' + B.usd(usd)}</span>
      ${left === null ? '' : html`<span class="${'calc-left' + (left < 0 ? ' over-text' : '')}">This would leave <b class="num">${B.yen(left)}</b> for today.</span>`}`;
  }
  function calc(S) {
    var r = rateFor(S);
    return {
      city: null,
      header: D.plainHeader('Calculator', { back: D.backLink('#/budget', 'Budget') }),
      body: html`<section class="settings-group calc" data-hold>
          <label class="field amount-field"><span class="eyebrow">Price</span>
            <span class="amount-input"><span class="cur" aria-hidden="true">¥</span>
            <input name="price" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="11" data-action="calc-input" placeholder="0" autofocus></span></label>
          <div class="calc-out" aria-live="polite" data-calc-out>${calcResult(S, '')}</div>
          <button class="btn btn-primary" type="button" data-action="calc-log">Log it</button>
        </section>
        <p class="secondary">${B.rateLabel(r)}</p>`
    };
  }

  BT.ui.budget = { overview: overview, form: form, calc: calc, calcResult: calcResult, formState: formState,
    rateFor: rateFor, summaryFor: summaryFor, today: today };
})();
