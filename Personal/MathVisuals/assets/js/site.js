/* =====================================================================
   site.js — behaviour shared by every page
   ---------------------------------------------------------------------
   1. Dark-mode toggle      (button.theme-toggle in the header)
   2. Mobile navigation     (button.nav-toggle, ≤ 960px wide)
   3. Contact form          (form#contact-form on the home page)
   4. Footer year

   Loaded with `defer`, so the DOM is ready when this runs. Everything
   is wrapped in one function so nothing leaks into the global scope
   that the tool scripts share.

   Tools that draw in JavaScript (e.g. the Graphing Explorer) listen for
   the "themechange" event dispatched below and redraw in the new
   colors.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var STORAGE_KEY = 'mv-theme';

  /* ===================================================================
     1. DARK-MODE TOGGLE
     =================================================================== */

  var toggles = document.querySelectorAll('.theme-toggle');

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  /* Keep each toggle's pressed state and accessible label in sync. */
  function syncToggles() {
    var dark = currentTheme() === 'dark';
    toggles.forEach(function (btn) {
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    });
  }

  /* Apply a theme, optionally remember it, and tell the tools. */
  function setTheme(theme, remember) {
    root.setAttribute('data-theme', theme);
    if (remember) {
      try { window.localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* ignore */ }
    }
    syncToggles();
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
  }

  toggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
    });
  });

  /* Follow the operating system live — but only until the visitor has
     made their own choice with the toggle. */
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystemChange = function (e) {
      var saved = null;
      try { saved = window.localStorage.getItem(STORAGE_KEY); } catch (err) { /* ignore */ }
      if (!saved) { setTheme(e.matches ? 'dark' : 'light', false); }
    };
    if (mq.addEventListener) { mq.addEventListener('change', onSystemChange); }
  }

  syncToggles();

  /* ===================================================================
     2. MOBILE NAVIGATION
     =================================================================== */

  var navToggle = document.querySelector('.nav-toggle');
  var navList = document.getElementById('site-nav-list');

  function closeNav() {
    if (!navToggle || !navList) { return; }
    navList.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  }

  if (navToggle && navList) {
    navToggle.addEventListener('click', function () {
      var open = navList.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    /* close after choosing a link, on Escape, or on a click elsewhere */
    navList.addEventListener('click', function (e) {
      if (e.target.closest('a')) { closeNav(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navList.classList.contains('is-open')) {
        closeNav();
        navToggle.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.site-nav')) { closeNav(); }
    });
  }

  /* ===================================================================
     3. CONTACT FORM
     ---------------------------------------------------------------
     Works without JavaScript (a normal POST to contact.php, which
     redirects to thank-you.html). With JavaScript, it validates in
     place, posts with fetch, and shows the result without leaving
     the page.
     =================================================================== */

  var form = document.getElementById('contact-form');

  if (form) {
    var statusBox = document.getElementById('form-status');
    var submitBtn = form.querySelector('[type="submit"]');
    var startedField = form.querySelector('[name="started"]');

    /* Time-trap: bots submit instantly; contact.php rejects anything
       sent less than a few seconds after the page loaded. */
    if (startedField) { startedField.value = String(Date.now()); }

    var showStatus = function (kind, message) {
      statusBox.hidden = false;
      statusBox.className = 'form-status form-status--' + kind;
      statusBox.textContent = message;
      statusBox.focus();
    };

    /* Mark a field invalid and point its error text at it. */
    var setFieldError = function (field, message) {
      var err = document.getElementById(field.id + '-error');
      field.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (err) {
        err.textContent = message || '';
        err.hidden = !message;
      }
    };

    var messageFor = function (field) {
      if (field.validity.valueMissing) { return 'Please fill in this field.'; }
      if (field.validity.typeMismatch) { return 'Please enter a valid email address.'; }
      if (field.validity.tooShort) {
        return 'Please write at least ' + field.minLength + ' characters.';
      }
      return '';
    };

    /* contact.php sends a failed no-JavaScript post back with ?error=1 */
    if (/[?&]error=1\b/.test(window.location.search)) {
      showStatus('error', 'Sorry, your idea could not be sent. Please check the form and try again.');
    }

    /* live re-check once a field has been flagged */
    form.addEventListener('input', function (e) {
      var field = e.target;
      if (field.getAttribute('aria-invalid') === 'true') {
        setFieldError(field, messageFor(field));
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      /* validate every required field, focus the first problem */
      var firstBad = null;
      form.querySelectorAll('[required], [minlength]').forEach(function (field) {
        var msg = messageFor(field);
        setFieldError(field, msg);
        if (msg && !firstBad) { firstBad = field; }
      });
      if (firstBad) {
        firstBad.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.dataset.label = submitBtn.textContent;
      submitBtn.textContent = 'Sending…';

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      })
        .then(function (res) {
          return res.json().catch(function () { return { ok: false }; });
        })
        .then(function (data) {
          if (data && data.ok) {
            form.reset();
            if (startedField) { startedField.value = String(Date.now()); }
            showStatus('success', data.message ||
              'Thank you! Your idea has been sent. I read every suggestion.');
          } else {
            showStatus('error', (data && data.message) ||
              'Sorry, something went wrong. Please try again in a moment.');
          }
        })
        .catch(function () {
          showStatus('error',
            'Sorry, the form could not be sent. Please check your connection and try again.');
        })
        .then(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.label;
        });
    });
  }

  /* ===================================================================
     4. FOOTER YEAR
     =================================================================== */

  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
