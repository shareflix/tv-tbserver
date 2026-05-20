(function () {
  'use strict';

  var keyNames = [
    'MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop',
    'MediaRewind', 'MediaFastForward', 'ColorF0Red', 'ColorF1Green',
    'ColorF2Yellow', 'ColorF3Blue'
  ];

  function registerKeys() {
    try {
      if (!window.tizen || !tizen.tvinputdevice) return;
      keyNames.forEach(function (key) {
        try { tizen.tvinputdevice.registerKey(key); } catch (e) {}
      });
    } catch (e) {}
  }

  function focusables() {
    return Array.prototype.slice.call(document.querySelectorAll(
      'button, [tabindex], input, select, .card, .menu-btn, .view-all-btn, .live-control-btn, .vod-control-btn'
    )).filter(function (el) {
      var r = el.getBoundingClientRect();
      var st = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
    });
  }

  function ensureFocus() {
    var active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) {
      var els = focusables();
      if (els.length) els[0].focus();
    }
  }

  function moveFocus(dx, dy) {
    var els = focusables();
    if (!els.length) return;
    var current = document.activeElement;
    if (!current || els.indexOf(current) < 0) {
      els[0].focus();
      return;
    }
    var cr = current.getBoundingClientRect();
    var cx = cr.left + cr.width / 2;
    var cy = cr.top + cr.height / 2;
    var best = null;
    var bestScore = Infinity;

    els.forEach(function (el) {
      if (el === current) return;
      var r = el.getBoundingClientRect();
      var x = r.left + r.width / 2;
      var y = r.top + r.height / 2;
      var vx = x - cx;
      var vy = y - cy;
      if (dx < 0 && vx >= -5) return;
      if (dx > 0 && vx <= 5) return;
      if (dy < 0 && vy >= -5) return;
      if (dy > 0 && vy <= 5) return;
      var primary = dx !== 0 ? Math.abs(vx) : Math.abs(vy);
      var secondary = dx !== 0 ? Math.abs(vy) : Math.abs(vx);
      var score = primary * 1.2 + secondary * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) {
      best.focus();
      try { best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    }
  }

  function video() { return document.getElementById('player'); }

  function togglePlay() {
    var v = video();
    if (!v) return;
    if (v.paused) v.play().catch(function(){}); else v.pause();
  }

  function backAction() {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen();
      return;
    }
    try {
      if (typeof stopPlayback === 'function' && document.body.classList.contains('is-playing')) {
        stopPlayback();
        return;
      }
    } catch (e) {}
    try {
      if (typeof showHome === 'function') { showHome(); return; }
    } catch (e) {}
    try { window.history.back(); } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    registerKeys();
    setTimeout(ensureFocus, 700);
  });

  document.addEventListener('keydown', function (e) {
    var code = e.keyCode;
    if (code === 37) { e.preventDefault(); moveFocus(-1, 0); }
    else if (code === 38) { e.preventDefault(); moveFocus(0, -1); }
    else if (code === 39) { e.preventDefault(); moveFocus(1, 0); }
    else if (code === 40) { e.preventDefault(); moveFocus(0, 1); }
    else if (code === 13) {
      e.preventDefault();
      var a = document.activeElement;
      if (a && typeof a.click === 'function') a.click();
    }
    else if (code === 10009 || code === 461) { e.preventDefault(); backAction(); }
    else if (code === 415 || code === 19 || code === 10252) { e.preventDefault(); togglePlay(); }
    else if (code === 413) { e.preventDefault(); try { if (typeof stopPlayback === 'function') stopPlayback(); } catch (err) {} }
    else if (code === 417) { var v1 = video(); if (v1 && isFinite(v1.duration)) v1.currentTime = Math.min(v1.duration - 1, v1.currentTime + 10); }
    else if (code === 412) { var v2 = video(); if (v2 && isFinite(v2.duration)) v2.currentTime = Math.max(0, v2.currentTime - 10); }
  }, true);
})();
