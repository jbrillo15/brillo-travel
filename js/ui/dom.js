/* Safe HTML building. Everything from the sheet is escaped; only markup the
   app writes itself goes through html`` literals or raw(). */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};

  function Safe(s) { this.s = s; }
  var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(v) { return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) { return MAP[c]; }); }
  function piece(v) {
    if (v === null || v === undefined || v === false) return '';
    if (v instanceof Safe) return v.s;
    if (Array.isArray(v)) return v.map(piece).join('');
    return esc(v);
  }
  function html(strings) {
    var out = strings[0];
    for (var i = 1; i < arguments.length; i++) out += piece(arguments[i]) + strings[i];
    return new Safe(out);
  }
  function raw(s) { return new Safe(String(s)); }
  function icon(id, cls) { return raw('<svg' + (cls ? ' class="' + esc(cls) + '"' : '') + ' aria-hidden="true"><use href="#' + esc(id) + '"/></svg>'); }
  function str(v) { return piece(v); }

  // Shared pieces used by several screens.
  function cardsButton() {
    return html`<button class="btn cards-btn" type="button" data-action="cards" aria-label="Cards: allergy, hotel, taxi and booking cards">${icon('i-cards')}Cards</button>`;
  }
  function allergyBadge(risk) {
    if (!risk) return '';
    return risk === 'High'
      ? html`<button class="allergy-badge high" type="button" data-action="cards">Allergy · high risk</button>`
      : html`<button class="allergy-badge caution" type="button" data-action="cards">Allergy · ask first</button>`;
  }
  function dayBadge(city, n) {
    var code = BT.model.cityCode(city);
    if (!code || !(n > 0)) return html`<span class="day-badge" role="img" aria-label="Travel day"><span class="glyph" aria-hidden="true">✈</span></span>`;
    var nn = (n < 10 ? '0' : '') + n;
    return html`<span class="day-badge" role="img" aria-label="${'Day ' + n + ', ' + city}"><span aria-hidden="true"><b>${code}</b>${nn}</span></span>`;
  }
  function backLink(href, label) {
    return html`<a class="back" href="${href}"><span aria-hidden="true">‹</span> ${label}</a>`;
  }
  function plainHeader(title, opts) {
    opts = opts || {};
    return html`<header class="topbar">${opts.back || html`<span></span>`}<div class="who"><h1 class="screen-title">${title}</h1>${opts.sub ? html`<div class="dayline">${opts.sub}</div>` : ''}</div>${cardsButton()}</header>`;
  }

  BT.dom = { html: html, raw: raw, esc: esc, icon: icon, str: str, Safe: Safe,
    cardsButton: cardsButton, allergyBadge: allergyBadge, dayBadge: dayBadge, backLink: backLink, plainHeader: plainHeader };
})();
