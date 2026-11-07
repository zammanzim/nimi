// ============================================================
// notice.js — pemberitahuan nempel (kanan atas), versi slim
// dari osistarpanone. Toast hilang sendiri, notice nempel
// sampai di-hide eksplisit.
//   Notice.show("live", "Live!", { type: "green" });
//   Notice.hide("live");
// type: dark | green | red (default dark)
// ============================================================

(function () {
  "use strict";

  var STACK_ID = "notice-stack";
  var _stack = null;

  function stack() {
    if (_stack && document.body.contains(_stack)) return _stack;
    var el = document.getElementById(STACK_ID);
    if (el) { _stack = el; return el; }
    el = document.createElement("div");
    el.id = STACK_ID;
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
    _stack = el;
    return el;
  }

  window.Notice = {
    show: function (id, text, opt) {
      opt = opt || {};
      var wadah = stack();
      var el = wadah.querySelector('[data-notice="' + id + '"]');
      if (!el) {
        el = document.createElement("div");
        el.className = "notice-pill";
        el.dataset.notice = id;
        wadah.appendChild(el);
      }
      el.className = "notice-pill notice-" + (opt.type || "dark");
      el.innerHTML =
        (opt.icon ? '<i class="' + opt.icon + '"></i>' : "") +
        "<span>" + String(text || "") + "</span>";
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { el.classList.add("notice-show"); });
      });
      return true;
    },
    hide: function (id) {
      var el = document.querySelector('#' + STACK_ID + ' [data-notice="' + id + '"]');
      if (!el) return false;
      el.classList.remove("notice-show");
      el.classList.add("notice-hide");
      setTimeout(function () { try { el.remove(); } catch (e) {} }, 250);
      return true;
    },
  };
  window.showNotice = function (id, text, opt) { return Notice.show(id, text, opt); };
  window.hideNotice = function (id) { return Notice.hide(id); };
})();
