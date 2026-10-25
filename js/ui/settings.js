/* Settings, setup and Data health (HANDOFF §8.8, §7 setup code, V-rules display). */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  BT.ui = BT.ui || {};
  var D = BT.dom, html = D.html, T = BT.time;

  function ownerSelect(S) {
    var names = S.vm.settings.travelers.length ? S.vm.settings.travelers : ['Jordan', 'Lindsay'];
    return html`<label class="field"><span class="eyebrow">Whose phone is this?</span>
      <select data-action="set-owner">
        <option value="">Choose…</option>
        ${names.map(function (n) { return html`<option value="${n}"${S.owner === n ? D.raw(' selected') : ''}>${n}</option>`; })}
      </select></label>`;
  }

  function pasteBox(label) {
    return html`<label class="field"><span class="eyebrow">${label}</span>
      <textarea data-action="paste-setup" rows="3" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        placeholder="Paste the setup code here"></textarea></label>`;
  }

  function setup(S) {
    return {
      city: null,
      header: html`<header class="topbar"><span></span><div class="who"><h1 class="screen-title">Welcome to Brillo</h1></div>${D.cardsButton()}</header>`,
      body: html`<section class="setup">
        <p>To connect this phone to your trip sheet, paste the setup code Jordan sent you.</p>
        <p class="secondary">Paste it here, inside the app you opened from the home screen, not in Safari. The two keep separate storage.</p>
        ${ownerSelect(S)}
        ${pasteBox('Setup code')}
        ${S.setupError ? html`<p class="error" role="alert">${S.setupError}</p>` : ''}
      </section>`
    };
  }

  function health(S) {
    var issues = S.vm.issues || [];
    var errors = issues.filter(function (i) { return i.severity === 'error'; });
    var warns = issues.filter(function (i) { return i.severity !== 'error'; });
    function list(arr) {
      return html`<ul class="issues">${arr.map(function (i) {
        return html`<li><span class="eyebrow">${i.tab}${i.row ? ' · row ' + i.row : ''} · ${i.id}</span><span>${i.message}</span></li>`;
      })}</ul>`;
    }
    return {
      city: null,
      header: D.plainHeader('Data health', { back: D.backLink('#/settings', 'Settings') }),
      body: html`
        ${S.vm.staleTabs.length ? html`<p class="banner-quiet">Showing the last good copy of: ${S.vm.staleTabs.join(', ')}.</p>` : ''}
        <section><div class="section-title"><h2>Problems</h2><span class="secondary">${errors.length}</span></div>
          ${errors.length ? list(errors) : html`<p class="empty">None. The sheet reads cleanly.</p>`}</section>
        <section><div class="section-title"><h2>Warnings</h2><span class="secondary">${warns.length}</span></div>
          ${warns.length ? list(warns) : html`<p class="empty">None.</p>`}</section>
        <p class="secondary">Fix these in the Google Sheet. The app picks up the change at the next sync.</p>`
    };
  }

  // The script's own answer beats the saved copy, which is stale during a mismatch.
  function scriptVersion(S) { return S.status.serverVersion || (S.snapshot && S.snapshot.serverVersion) || null; }

  function settings(S) {
    var st = BT.sync.describe(S.status, T.now());
    var issues = S.vm.issues || [];
    var staging = S.env === 'staging';
    var sim = S.simulate;
    return {
      city: null,
      header: D.plainHeader('Settings', { back: D.backLink('#/info', 'Info') }),
      body: html`
        <section class="settings-group">
          ${ownerSelect(S)}
        </section>
        <section class="settings-group">
          <div class="row-between"><span class="sync" data-state="${st.state}" data-sync>${st.text}</span>
            <button class="btn" type="button" data-action="sync-now">Sync now</button></div>
          <a class="info-row" href="#/health"><span>Data health</span><b>${issues.length ? issues.length + ' to check' : 'All clear'}</b></a>
          ${S.status.rejected ? html`<a class="info-row" href="#/sync-issues"><span>Sync issues</span><b>${S.status.rejected} to review</b></a>` : ''}
        </section>
        <section class="settings-group">
          <div class="row-between"><span>Version <b class="num">${BT.config.version}</b> · ${S.env}${scriptVersion(S) ? html` · script <b class="num">${scriptVersion(S)}</b>` : ''}</span>
            <button class="btn" type="button" data-action="check-update">Check for update</button></div>
          ${S.updateNote ? html`<p class="secondary">${S.updateNote}</p>` : ''}
        </section>
        <section class="settings-group">
          ${pasteBox(S.setup ? 'Replace setup code' : 'Setup code')}
          ${S.setupError ? html`<p class="error" role="alert">${S.setupError}</p>` : ''}
          ${S.setup ? html`<p class="secondary">Connected to ${S.setup.env}. The code is saved on this phone only.</p>` : ''}
        </section>
        ${staging ? html`<section class="settings-group developer">
          <h2>Developer (staging only)</h2>
          <label class="field"><span class="eyebrow">Simulate Japan date and time</span>
            <input type="datetime-local" data-action="simulate-set" value="${sim ? sim.inputValue : ''}"></label>
          ${sim ? html`<p class="secondary">Simulating ${sim.label} (Japan). <button class="btn btn-quiet" type="button" data-action="simulate-clear">Use real time</button></p>` : ''}
          <div class="row-between"><span class="secondary">Outbox: ${S.status.pending || 0} waiting · ${S.status.rejected || 0} refused</span></div>
          <button class="btn" type="button" data-action="reset-local">Reset local data</button>
        </section>` : ''}`
    };
  }

  function placeholder(title, version, what) {
    return function () {
      return { city: null, header: D.plainHeader(title),
        body: html`<section class="placeholder"><p>${what}</p><p class="secondary">Arrives in ${version}.</p></section>` };
    };
  }

  BT.ui.settings = { render: settings, setup: setup, health: health };
  BT.ui.placeholders = {
    nearby: placeholder('Nearby', 'v0.4', 'Ideas near you and quick Google Maps searches.')
  };
})();
