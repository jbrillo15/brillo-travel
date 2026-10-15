/* Links out to the specialist apps (HANDOFF §7 Links out, D9). Results from
   the Phase 0 spike are in docs/spikes.md. Values from the sheet are never
   trusted as URLs unless they're plain http(s). */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};

  function safeHttp(v) { return /^https?:\/\/[^\s]+$/i.test(String(v || '').trim()) ? String(v).trim() : null; }
  function enc(s) { return encodeURIComponent(String(s || '').trim()); }

  // AC-I2: the item's Maps value, else its Japanese place name, else English, else title.
  function placeQuery(x) {
    return (x.maps && !safeHttp(x.maps) ? x.maps : '') || x.placeJa || x.addressJa || x.nameJa || x.placeEn || x.nameEn || x.title || '';
  }
  function directions(x) {
    var saved = safeHttp(x && x.maps);
    if (saved) return saved;                          // a saved Maps link opens as-is
    var q = placeQuery(x || {});
    return q ? 'https://www.google.com/maps/dir/?api=1&destination=' + enc(q) + '&travelmode=transit' : null;
  }
  function search(term) { return 'https://www.google.com/maps/search/?api=1&query=' + enc(term); }
  function translate(text) {
    return 'https://translate.google.com/?sl=en&tl=ja&op=translate' + (text ? '&text=' + enc(text) : '');
  }

  // Japanese numbers dialed from a US phone: +81 and drop the leading 0.
  // 0570 "Navi Dial" numbers often fail from abroad, so they're flagged.
  function tel(phone) {
    var raw = String(phone || '').trim();
    var digits = raw.replace(/[^\d+]/g, '');
    if (!digits) return null;
    var navi = /^0570/.test(digits);
    var e164 = digits.charAt(0) === '+' ? digits : digits.charAt(0) === '0' ? '+81' + digits.slice(1) : digits;
    return { href: 'tel:' + e164, display: raw, navi: navi };
  }

  BT.links = {
    safeHttp: safeHttp, placeQuery: placeQuery, directions: directions, search: search, translate: translate, tel: tel,
    GO: 'https://go.goinc.jp/', GO_STORE: 'https://apps.apple.com/jp/app/id1254341709',
    TDR: 'https://www.tokyodisneyresort.jp/', TDR_STORE: 'https://apps.apple.com/jp/app/id1313147771'
  };
})();
