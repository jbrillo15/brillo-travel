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
  // Station mark. label overrides the plane's accessible name (before and after the trip).
  // A city the app doesn't know gets its initial in a neutral ring (city-other).
  function dayBadge(city, n, label) {
    var code = BT.model.cityCode(city) || (city && city !== 'Travel' ? String(city).charAt(0).toUpperCase() : null);
    if (!code || !(n > 0)) return html`<span class="day-badge" role="img" aria-label="${label || 'Travel day'}"><span class="glyph" aria-hidden="true">✈</span></span>`;
    var nn = (n < 10 ? '0' : '') + n;
    return html`<span class="day-badge" role="img" aria-label="${'Day ' + n + ', ' + city}"><span aria-hidden="true"><b>${code}</b>${nn}</span></span>`;
  }
  // Cartoon portraits (art/). "Both" or an unknown name gets the pair, overlapped.
  var FACES = { jordan: 'Jordan', lindsay: 'Lindsay', penny: 'Penny' };
  function face(key, cls) {
    return html`<img class="${'avatar' + (cls ? ' ' + cls : '')}" src="${'art/' + key + '.jpg'}" alt="" width="96" height="96" decoding="async">`;
  }
  function avatar(who, cls) {
    var key = String(who || '').toLowerCase();
    if (FACES[key]) return face(key, cls);
    return html`<span class="${'avatar-pair' + (cls ? ' ' + cls : '')}">${face('jordan')}${face('lindsay')}</span>`;
  }
  function backLink(href, label) {
    return html`<a class="back" href="${href}"><span aria-hidden="true">‹</span> ${label}</a>`;
  }
  function plainHeader(title, opts) {
    opts = opts || {};
    return html`<header class="topbar">${opts.back || html`<span></span>`}<div class="who"><h1 class="screen-title">${title}</h1>${opts.sub ? html`<div class="dayline">${opts.sub}</div>` : ''}</div>${cardsButton()}</header>`;
  }

  BT.dom = { html: html, raw: raw, esc: esc, icon: icon, str: str, Safe: Safe,
    cardsButton: cardsButton, allergyBadge: allergyBadge, dayBadge: dayBadge, avatar: avatar, backLink: backLink, plainHeader: plainHeader };
})();
