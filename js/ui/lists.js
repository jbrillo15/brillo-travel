/* Lists (HANDOFF §8.3): overview → list → item edit, plus Sync issues.
   Every change goes through the outbox (app.js), so it shows at once, marked
   "waiting to sync", and reaches the sheet on the next push. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  BT.ui = BT.ui || {};
  var D = BT.dom, html = D.html, T = BT.time, M = BT.model;

  var LIST_PICT = { 'Pre-trip': 'i-lists', Packing: 'p-suitcase', 'Departure day': 'p-plane', 'Return packing': 'p-backpack' };
  var BAG_PICT = { Suitcase: 'p-suitcase', 'Jordan backpack': 'p-backpack', 'Lindsay backpack': 'p-backpack' };
  var OWNERS = ['Jordan', 'Lindsay', 'Both'];
  var BAGS = ['Suitcase', 'Jordan backpack', 'Lindsay backpack'];

  // Before the trip, "overdue" is judged on the home calendar; from departure on, Japan's.
  function today(vm) {
    var now = T.now(), s = vm.settings;
    var home = T.dateIn(now, s.homeTz);
    return s.tripStart && home < s.tripStart ? home : T.tripDate(now);
  }
  function listHref(name) { return '#/list/' + encodeURIComponent(name); }
  function meter(done, total) {
    var pct = total ? Math.round(done / total * 100) : 0;
    return html`<span class="meter" style="--fill:${pct + '%'}; --state: var(--ok)" aria-hidden="true"><i></i></span>`;
  }

  function overview(S) {
    var vm = S.vm, day = today(vm);
    var ls = M.lists(vm, day);
    var rejected = S.status.rejected || 0;
    return {
      city: null,
      header: D.plainHeader('Lists', { sub: 'Shared by both phones' }),
      body: html`
        ${rejected ? html`<a class="info-row issue-row" href="#/sync-issues"><span>${rejected === 1 ? '1 change' : rejected + ' changes'} the sheet didn't accept</span><b>Review</b></a>` : ''}
        ${ls.length ? html`<ul class="day-list list-index">${ls.map(function (l) {
          var total = l.items.length;
          return html`<li><a class="day-row list-row" href="${listHref(l.name)}">
            <span class="pict-tile" aria-hidden="true">${D.icon(LIST_PICT[l.name] || 'i-lists')}</span>
            <span class="day-main"><span class="list-name">${l.name}</span>
              <span class="secondary num">${l.done} of ${total} done${l.overdue ? html` · <span class="overdue">${l.overdue} overdue</span>` : ''}</span>
              ${meter(l.done, total)}</span>
            <span class="chev" aria-hidden="true">›</span></a></li>`;
        })}</ul>` : html`<p class="empty">No checklists in the sheet yet. Rows in the Checklists tab show up here.</p>`}`
    };
  }

  function row(c, day) {
    var meta = [];
    // Done rows show who ticked it; open rows show whose job it is.
    if (c.done && c.doneBy) meta.push(html`<span class="who-chip">${D.avatar(c.doneBy, 'chip-face')}Done by ${c.doneBy}</span>`);
    else if (c.owner) meta.push(html`<span class="who-chip">${D.avatar(c.owner, 'chip-face')}${c.owner}</span>`);
    if (c.due) meta.push(M.isOverdue(c, day) ? html`<span class="overdue">Overdue · ${T.fmtDay(c.due)}</span>` : 'Due ' + T.fmtDay(c.due));
    if (c.pending) meta.push(html`<span class="pending">Waiting to sync</span>`);
    var parts = [];
    meta.forEach(function (m, i) { if (i) parts.push(' · '); parts.push(m); });
    return html`<li class="check${c.done ? ' is-done' : ''}" data-action="toggle-check" data-id="${c.id}">
      <button class="box" type="button" aria-pressed="${c.done ? 'true' : 'false'}" aria-label="${c.item}" data-action="toggle-check" data-id="${c.id}"><span></span></button>
      <div><div class="label">${c.item}</div>${parts.length ? html`<div class="meta">${parts}</div>` : ''}${c.notes ? html`<div class="meta note">${c.notes}</div>` : ''}</div>
      <a class="btn btn-icon btn-quiet check-edit" href="#/check/${encodeURIComponent(c.id)}" data-action="nav" aria-label="${'Edit ' + c.item}"><span aria-hidden="true">›</span></a>
    </li>`;
  }

  function addForm(name) {
    var packing = /^packing$/i.test(name);
    return html`<form class="add-item settings-group" data-action="add-check" data-list="${name}">
      <label class="field"><span class="eyebrow">Add to ${name}</span>
        <input name="item" type="text" autocomplete="off" maxlength="200" placeholder="New item" required></label>
      ${packing ? html`<label class="field"><span class="eyebrow">Bag</span><select name="bag">
        <option value="—">No bag yet</option>${BAGS.map(function (b) { return html`<option value="${b}">${b}</option>`; })}</select></label>` : ''}
      <button class="btn btn-primary" type="submit">Add item</button>
    </form>`;
  }

  function list(S, name) {
    var vm = S.vm, day = today(vm);
    var l = M.listByName(vm, name, day);
    if (!l) return { city: null, header: D.plainHeader('Not found', { back: D.backLink('#/lists', 'Lists') }),
      body: html`<p class="empty">This list isn't in the latest copy of the sheet.</p>${addForm(name)}` };
    var packing = /^packing$/i.test(l.name);
    var view = packing && S.packView !== 'all' ? 'bag' : 'all';
    var body;
    if (view === 'bag') {
      body = M.byBag(l.items).map(function (g) {
        return html`<section class="bag-group">
          <div class="bag-head"><h3>${D.icon(BAG_PICT[g.bag] || 'p-other')}${g.bag}</h3><span class="secondary num">${g.done} of ${g.items.length} packed</span></div>
          <ul class="checks check-card">${g.items.map(function (c) { return row(c, day); })}</ul></section>`;
      });
    } else {
      body = html`<ul class="checks check-card">${l.items.map(function (c) { return row(c, day); })}</ul>`;
    }
    return {
      city: null,
      header: D.plainHeader(l.name, { back: D.backLink('#/lists', 'Lists'), sub: l.done + ' of ' + l.items.length + ' done' }),
      body: html`
        ${packing ? html`<div class="segmented" role="group" aria-label="Show packing">
          <button class="btn" type="button" data-action="pack-view" data-view="bag" aria-pressed="${view === 'bag' ? 'true' : 'false'}">By bag</button>
          <button class="btn" type="button" data-action="pack-view" data-view="all" aria-pressed="${view === 'all' ? 'true' : 'false'}">All items</button>
        </div>` : ''}
        ${body}
        ${addForm(l.name)}`
    };
  }

  function select(name, label, options, current, blankLabel) {
    return html`<label class="field"><span class="eyebrow">${label}</span><select name="${name}">
      <option value="">${blankLabel}</option>
      ${options.map(function (o) { return html`<option value="${o}"${current === o ? D.raw(' selected') : ''}>${o}</option>`; })}
    </select></label>`;
  }

  function edit(S, id) {
    var c = S.vm.checklists.filter(function (x) { return x.id === id; })[0];
    if (!c) return { city: null, header: D.plainHeader('Not found', { back: D.backLink('#/lists', 'Lists') }),
      body: html`<p class="empty">This item isn't in the latest copy of the sheet. It may have been deleted.</p>` };
    var showBag = /^packing$/i.test(c.list) || (c.bag && c.bag !== '—');
    return {
      city: null,
      header: D.plainHeader('Edit item', { back: D.backLink(listHref(c.list), c.list) }),
      body: html`<form class="settings-group edit-item" data-action="save-check" data-hold data-id="${c.id}">
          <label class="field"><span class="eyebrow">Item</span>
            <input name="item" type="text" maxlength="200" value="${c.item}" required></label>
          ${select('owner', 'Owner', OWNERS, c.owner, 'Nobody yet')}
          ${showBag ? select('bag', 'Bag', BAGS, c.bag === '—' ? '' : c.bag, 'No bag yet') : ''}
          <label class="field"><span class="eyebrow">Due</span><input name="due" type="date" value="${c.due || ''}"></label>
          <label class="field"><span class="eyebrow">Notes</span><textarea name="notes" rows="3" maxlength="1000">${c.notes || ''}</textarea></label>
          <button class="btn btn-primary" type="submit">Save</button>
        </form>
        ${c.done ? html`<p class="secondary">Done${c.doneBy ? ' by ' + c.doneBy : ''}${c.doneAt ? ' · ' + T.fmtInstant(new Date(c.doneAt), S.vm.settings.homeTz) : ''}.</p>` : ''}
        ${c.pending ? html`<p class="secondary">Waiting to sync.</p>` : ''}
        <button class="btn btn-quiet delete" type="button" data-action="delete-check" data-id="${c.id}" data-list="${c.list}">Delete item</button>`
    };
  }

  // What a queued op does, in words (Sync issues).
  function describeOp(op, vm) {
    var f = op.fields || {};
    if (/^expense\./.test(op.type)) {
      var e = (vm.expenses || []).filter(function (x) { return x.id === op.id; })[0] || {};
      var what = (f.note || e.note || f.category || e.category || 'expense') + (f.amount || e.amount ? ' (' + BT.budget.money(Object.assign({}, e, f)) + ')' : '');
      return op.type === 'expense.delete' ? 'Delete “' + what + '”' : f.createdAt ? 'Add “' + what + '”' : 'Edit “' + what + '”';
    }
    var c = vm.checklists.filter(function (x) { return x.id === op.id; })[0];
    var name = f.item || (c && c.item) || 'an item';
    switch (op.type) {
      case 'checklist.add': return 'Add “' + name + '” to ' + (f.list || 'a list');
      case 'checklist.update': return 'done' in f ? (f.done ? 'Tick “' : 'Untick “') + name + '”' : 'Edit “' + name + '”';
      case 'checklist.delete': return 'Delete “' + name + '”';
      default: return op.type;
    }
  }

  function issues(S) {
    var ops = S.sync ? S.sync.queue().filter(function (o) { return o.status === 'rejected'; }) : [];
    return {
      city: null,
      header: D.plainHeader('Sync issues', { back: D.backLink('#/lists', 'Lists') }),
      body: html`
        <p class="secondary">The sheet refused these changes. They stay on this phone until you retry or discard them.</p>
        ${ops.length ? html`<ul class="issues">${ops.map(function (op) {
          return html`<li><span>${describeOp(op, S.vm)}</span><span class="secondary">${op.reason || ''}</span>
            <div class="actions"><button class="btn" type="button" data-action="retry-op" data-op="${op.opId}">Retry</button>
            <button class="btn btn-quiet" type="button" data-action="discard-op" data-op="${op.opId}">Discard</button></div></li>`;
        })}</ul>` : html`<p class="empty">No sync issues.</p>`}`
    };
  }

  BT.ui.lists = { overview: overview, list: list, edit: edit, issues: issues, today: today, row: row, describeOp: describeOp };
})();
