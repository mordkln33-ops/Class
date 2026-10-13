/* =====================================================================
   theme-init.js — apply light / dark mode BEFORE the page paints
   ---------------------------------------------------------------------
   Loaded in <head> without `defer`, on purpose: it must run before the
   body renders, or a dark-mode visitor would see a white flash. It is
   kept tiny so it costs nothing.

   Order of precedence:
     1. a choice saved by the header toggle (localStorage "mv-theme")
     2. the operating system / browser preference
   The toggle itself is wired up later in site.js.
   ===================================================================== */
(function () {
  'use strict';

  var saved = null;
  try {
    saved = window.localStorage.getItem('mv-theme');
  } catch (e) {
    /* storage blocked (private mode, strict settings) — fall back to OS */
  }

  var prefersDark = window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  var theme = (saved === 'dark' || saved === 'light')
    ? saved
    : (prefersDark ? 'dark' : 'light');

  document.documentElement.setAttribute('data-theme', theme);
})();
