/* Little celebrations when something gets ticked. They sit outside #app, so a
   re-render never cuts them short. Decoration only: aria-hidden, and with
   Reduce Motion the per-item pop is skipped and the list-done card just shows. */
(function () {
  'use strict';
  var BT = window.BT = window.BT || {};
  BT.ui = BT.ui || {};
  var D = BT.dom, html = D.html;

  function calm() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function mount(markup, ms) {
    var el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = D.str(markup);
    document.body.appendChild(el.firstElementChild);
    var node = document.body.lastElementChild;
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, ms);
    return node;
  }

  // The ticker's face hops up from the checkbox. rect: the box's getBoundingClientRect().
  function pop(who, rect) {
    if (calm() || !rect) return;
    var node = mount(html`<div class="cheer-pop">${D.avatar(who, 'pop-face')}</div>`, 1100);
    node.style.left = Math.round(rect.left + rect.width / 2) + 'px';
    node.style.top = Math.round(rect.top) + 'px';
  }

  // A whole list finished: all three of them, center screen.
  function listDone(name) {
    var old = document.querySelector('.cheer-done');
    if (old) old.parentNode.removeChild(old);
    mount(html`<div class="cheer-done${calm() ? ' calm' : ''}"><div class="cheer-card">
      <div class="cheer-faces">${D.avatar('jordan', 'done-face')}${D.avatar('penny', 'done-face')}${D.avatar('lindsay', 'done-face')}</div>
      <div class="cheer-title">${name} done!</div></div></div>`, 2200);
  }

  BT.ui.cheer = { pop: pop, listDone: listDone };
})();
