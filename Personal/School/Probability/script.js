/* ============================================================
   Probability Manipulator
   Two probability spaces, a colored grid for each, and a
   Manipulate step that adds or multiplies one outcome from
   each side and paints the answer as the blended color.
   ============================================================ */

(function () {
  'use strict';

  var DEN_MIN = 1;
  var DEN_MAX = 20;

  /* state.A / state.B hold a built space, or null:
     { den, outcomes:[{num, label, color}] }                  */
  var state = { A: null, B: null };

  /* ==========================================================
     Color helpers
     Every outcome color is a pale HSL so the near-black cell
     label keeps a big contrast ratio, and so that mixing two
     of them still lands somewhere light and readable.
     ========================================================== */

  function css(c) {
    return 'hsl(' + c.h.toFixed(1) + ' ' + c.s.toFixed(1) + '% ' + c.l.toFixed(1) + '%)';
  }

  function hslToRgb(c) {
    var h = ((c.h % 360) + 360) % 360 / 360, s = c.s / 100, l = c.l / 100;
    if (s === 0) { var v = l * 255; return { r: v, g: v, b: v }; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    function hue(t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    return { r: hue(h + 1 / 3) * 255, g: hue(h) * 255, b: hue(h - 1 / 3) * 255 };
  }

  function rgbToHsl(rgb) {
    var r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2, d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: s * 100, l: l * 100 };
  }

  /* Mix two cell colors. Complementary pastels average toward
     gray, so the mix is re-saturated a little and pinned to a
     light band — it stays clearly visible next to its parents
     and still carries dark text well.                         */
  function blend(c1, c2) {
    var a = hslToRgb(c1), b = hslToRgb(c2);
    var mix = rgbToHsl({ r: (a.r + b.r) / 2, g: (a.g + b.g) / 2, b: (a.b + b.b) / 2 });
    mix.s = Math.max(mix.s, 48);
    mix.l = Math.min(Math.max(mix.l, 62), 72);
    return mix;
  }

  /* A washed-out version, used for the "only one of the two"
     regions of the multiplication area model.                 */
  function tint(c) {
    return { h: c.h, s: c.s * 0.85, l: 91 };
  }

  /* Two complementary hues for one space. When the other space
     already has colors, this pair is rotated a quarter turn away
     so all four colors on screen stay far apart.              */
  function makeColors(otherHue) {
    var h = (otherHue == null)
      ? Math.random() * 360
      : (otherHue + 90 + (Math.random() * 40 - 20) + 360) % 360;
    var h2 = (h + 180 + (Math.random() * 20 - 10) + 360) % 360;
    return [
      { h: h, s: 80, l: 86 },
      { h: h2, s: 80, l: 86 }
    ];
  }

  /* ==========================================================
     Fraction helpers
     ========================================================== */

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }
  function lcm(a, b) { return a / gcd(a, b) * b; }

  function fracText(n, d) { return n + '/' + d; }

  function simplified(n, d) {
    var g = gcd(n, d);
    return { n: n / g, d: d / g, changed: g !== 1 };
  }

  function asPercent(n, d) {
    var p = (n / d) * 100;
    return (Math.round(p * 100) / 100) + '%';
  }

  /* ==========================================================
     Grid drawing
     Cells are laid out in whichever row/column split comes
     closest to square cells with the fewest leftover slots.
     ========================================================== */

  /* Only exact divisors are considered, so the grid never ends
     with a blank half-row — every square in view is an outcome. */
  function bestCols(n, w, h) {
    if (n <= 1) return 1;
    var best = 1, bestScore = Infinity;
    for (var c = 1; c <= n; c++) {
      if (n % c !== 0) continue;
      var r = n / c;
      var score = Math.abs(Math.log((w / c) / (h / r)));   /* 0 == square cells */
      if (score < bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  /* When a sum runs past one whole there are more squares than
     the denominator. Columns still come from a divisor of the
     denominator, so "one whole" ends on a clean row break and
     the extra squares carry on underneath. */
  function colsForWhole(den, total, w, h) {
    var best = 1, bestScore = Infinity;
    for (var c = 1; c <= den; c++) {
      if (den % c !== 0) continue;
      var r = Math.ceil(total / c);
      var score = Math.abs(Math.log((w / c) / (h / r)));
      if (score < bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  /* cells: [{ color, text, empty, extra }] ; opts.cols forces a width,
     opts.whole shapes the grid around that many squares            */
  function drawGrid(host, cells, opts) {
    opts = opts || {};
    host._cells = cells;
    host._opts = opts;
    host.innerHTML = '';

    var n = cells.length;
    if (!n) return;

    var W = host.clientWidth, H = host.clientHeight;
    if (W < 10 || H < 10) return;

    var cols = opts.cols || (opts.whole ? colsForWhole(opts.whole, n, W, H) : bestCols(n, W, H));
    var rows = Math.ceil(n / cols);

    var gap = 3, pad = 3;
    var cw = (W - pad * 2 - (cols - 1) * gap) / cols;
    var ch = (H - pad * 2 - (rows - 1) * gap) / rows;

    var longest = 1;
    for (var i = 0; i < n; i++) {
      if (cells[i].text) longest = Math.max(longest, cells[i].text.length);
    }

    var fs = Math.min(ch * 0.30, cw / (longest * 0.30), 28);
    var showText = fs >= 11 && cw >= 34 && ch >= 22;
    fs = Math.max(fs, 11);

    var grid = document.createElement('div');
    grid.className = 'grid';
    grid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
    grid.style.gridTemplateRows = 'repeat(' + rows + ', minmax(0, 1fr))';

    cells.forEach(function (c, idx) {
      var el = document.createElement('div');
      el.className = 'cell' + (c.empty ? ' cell-empty' : '') + (c.quiet ? ' is-quiet' : '');
      if (c.extra) el.className += ' is-extra';
      if (c.color) el.style.background = css(c.color);
      el.style.fontSize = fs.toFixed(1) + 'px';
      el.style.animationDelay = Math.min(idx * 6, 320) + 'ms';
      var label = c.text || (c.empty ? 'not this outcome' : '');
      if (label) el.title = label;
      if (showText && c.text) el.textContent = c.text;
      else if (label) el.setAttribute('aria-label', label);
      grid.appendChild(el);
    });

    host.appendChild(grid);
  }

  function redraw(host) {
    if (host && host._cells) drawGrid(host, host._cells, host._opts);
  }

  /* ==========================================================
     Half (probability space) wiring
     ========================================================== */

  var halves = {};

  document.querySelectorAll('.half').forEach(function (section) {
    var side = section.dataset.side;
    var blocks = section.querySelectorAll('.outcome-block');

    var h = {
      side: side,
      section: section,
      form: section.querySelector('.setup'),
      summary: section.querySelector('.summary'),
      legend: section.querySelector('.legend'),
      error: section.querySelector('.form-error'),
      gridArea: section.querySelector('.grid-area'),
      num: [blocks[0].querySelector('.f-num'), blocks[1].querySelector('.f-num')],
      den: [blocks[0].querySelector('.f-den'), blocks[1].querySelector('.f-den')],
      label: [blocks[0].querySelector('.f-label'), blocks[1].querySelector('.f-label')]
    };
    halves[side] = h;

    /* --- the two fractions stay locked together ------------ */

    function syncFromDen(i) {
      var other = 1 - i;
      var d = parseInt(h.den[i].value, 10);
      if (!isFinite(d)) return;
      h.den[other].value = d;
      syncFromNum(i, true);
    }

    function syncFromNum(i, silent) {
      var other = 1 - i;
      var d = parseInt(h.den[i].value, 10);
      var n = parseInt(h.num[i].value, 10);
      if (!isFinite(d) || !isFinite(n)) return;
      if (n > d) { n = d; h.num[i].value = d; }
      if (n < 0) { n = 0; h.num[i].value = 0; }
      h.num[other].value = d - n;
      if (!silent) clearError();
    }

    h.den.forEach(function (input, i) {
      input.addEventListener('input', function () { syncFromDen(i); });
      input.addEventListener('blur', function () {
        var d = parseInt(input.value, 10);
        if (!isFinite(d) || d < DEN_MIN) d = DEN_MIN;
        if (d > DEN_MAX) d = DEN_MAX;
        input.value = d;
        syncFromDen(i);
      });
    });

    h.num.forEach(function (input, i) {
      input.addEventListener('input', function () { syncFromNum(i); });
    });

    /* --- validate & build ---------------------------------- */

    function clearError() {
      h.error.hidden = true;
      h.error.textContent = '';
      section.querySelectorAll('.is-bad').forEach(function (el) { el.classList.remove('is-bad'); });
    }

    function fail(msg, fields) {
      h.error.textContent = msg;
      h.error.hidden = false;
      (fields || []).forEach(function (el) { el.classList.add('is-bad'); });
    }

    h.form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError();

      var d = parseInt(h.den[0].value, 10);
      if (!isFinite(d) || d < DEN_MIN || d > DEN_MAX) {
        return fail('The denominator has to be a whole number from ' + DEN_MIN + ' to ' + DEN_MAX + '.', h.den);
      }

      var n0 = parseInt(h.num[0].value, 10);
      if (!isFinite(n0) || n0 < 0 || n0 > d) {
        return fail('The top number has to be between 0 and ' + d + '.', [h.num[0]]);
      }
      var n1 = d - n0;
      h.den[0].value = h.den[1].value = d;
      h.num[1].value = n1;

      var l0 = h.label[0].value.trim();
      var l1 = h.label[1].value.trim();
      if (!l0 || !l1) {
        return fail('Give both outcomes a name so the squares can be labeled.',
          [!l0 ? h.label[0] : null, !l1 ? h.label[1] : null].filter(Boolean));
      }
      if (l0.toLowerCase() === l1.toLowerCase()) {
        return fail('The two outcomes need different names.', h.label);
      }

      var otherSide = side === 'A' ? 'B' : 'A';
      var otherHue = state[otherSide] ? state[otherSide].outcomes[0].color.h : null;
      var colors = makeColors(otherHue);

      state[side] = {
        den: d,
        outcomes: [
          { num: n0, label: l0, color: colors[0] },
          { num: n1, label: l1, color: colors[1] }
        ]
      };

      paintHalf(side);
      afterBuild();
    });

    section.querySelector('.btn-edit').addEventListener('click', function () {
      h.form.hidden = false;
      h.summary.hidden = true;
      h.num[0].focus();
      h.num[0].select();
    });
  });

  function paintHalf(side) {
    var h = halves[side];
    var sp = state[side];

    document.documentElement.style.setProperty(
      '--' + side.toLowerCase() + '-hue', sp.outcomes[0].color.h.toFixed(1));

    /* legend strip replaces the form */
    h.legend.innerHTML = '';
    sp.outcomes.forEach(function (o) {
      var chip = document.createElement('span');
      chip.className = 'legend-chip';
      chip.style.background = css(o.color);
      chip.innerHTML = '<span class="chip-name"></span><span class="chip-frac"></span>';
      chip.querySelector('.chip-name').textContent = o.label;
      chip.querySelector('.chip-frac').textContent = fracText(o.num, sp.den);
      h.legend.appendChild(chip);
    });

    h.form.hidden = true;
    h.summary.hidden = false;

    /* one square per equally likely result */
    var cells = [];
    sp.outcomes.forEach(function (o) {
      for (var i = 0; i < o.num; i++) cells.push({ color: o.color, text: o.label });
    });
    drawGrid(h.gridArea, cells);
  }

  /* ==========================================================
     Manipulate button
     ========================================================== */

  var maniBtn = document.getElementById('manipulateBtn');
  var maniHint = document.getElementById('manipulateHint');

  function afterBuild() {
    var ready = !!(state.A && state.B);
    maniBtn.disabled = !ready;
    maniBtn.classList.toggle('is-ready', ready);
    maniHint.hidden = ready;
  }

  /* ==========================================================
     Overlays
     ========================================================== */

  var maniOverlay = document.getElementById('maniOverlay');
  var resultOverlay = document.getElementById('resultOverlay');
  var helpOverlay = document.getElementById('helpOverlay');

  function open(overlay) {
    overlay.hidden = false;
    var focusable = overlay.querySelector('select, button:not([data-close])');
    if (focusable) focusable.focus();
  }
  function close(overlay) { overlay.hidden = true; }

  [maniOverlay, resultOverlay, helpOverlay].forEach(function (ov) {
    ov.addEventListener('click', function (e) {
      if (e.target === ov) close(ov);
    });
    ov.querySelectorAll('[data-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { close(ov); });
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!resultOverlay.hidden) close(resultOverlay);
    else if (!maniOverlay.hidden) close(maniOverlay);
    else if (!helpOverlay.hidden) close(helpOverlay);
  });

  document.getElementById('helpBtn').addEventListener('click', function () { open(helpOverlay); });

  document.getElementById('resetBtn').addEventListener('click', function () {
    state.A = null; state.B = null;
    ['A', 'B'].forEach(function (side) {
      var h = halves[side];
      h.form.hidden = false;
      h.summary.hidden = true;
      h.error.hidden = true;
      h.gridArea._cells = null;
      h.gridArea.innerHTML =
        '<div class="grid-empty"><span class="grid-empty-mark" aria-hidden="true">?</span>' +
        '<p>Choose a fraction and two outcome names, then press <strong>Build grid</strong>.</p></div>';
    });
    close(maniOverlay); close(resultOverlay);
    afterBuild();
  });

  /* ==========================================================
     Manipulate dialog
     ========================================================== */

  var pickA = document.getElementById('pickA');
  var pickB = document.getElementById('pickB');
  var pickOpSign = document.getElementById('pickOpSign');
  var previewBox = document.getElementById('maniPreview');
  var opButtons = Array.prototype.slice.call(document.querySelectorAll('.op-btn'));
  var currentOp = 'add';

  function fillPicker(select, side) {
    var sp = state[side];
    select.innerHTML = '';
    sp.outcomes.forEach(function (o, i) {
      var opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = o.label + '  —  ' + fracText(o.num, sp.den);
      select.appendChild(opt);
    });
  }

  maniBtn.addEventListener('click', function () {
    if (maniBtn.disabled) return;
    fillPicker(pickA, 'A');
    fillPicker(pickB, 'B');
    updatePreview();
    open(maniOverlay);
  });

  opButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentOp = btn.dataset.op;
      opButtons.forEach(function (b) { b.classList.toggle('is-on', b === btn); });
      pickOpSign.textContent = currentOp === 'add' ? '+' : '×';
      updatePreview();
    });
  });

  pickA.addEventListener('change', updatePreview);
  pickB.addEventListener('change', updatePreview);

  function selection() {
    var a = state.A.outcomes[parseInt(pickA.value, 10) || 0];
    var b = state.B.outcomes[parseInt(pickB.value, 10) || 0];
    return { a: a, b: b, dA: state.A.den, dB: state.B.den };
  }

  /* The math behind both operations, shared by the preview and
     the full-screen result.                                   */
  function computeResult() {
    var s = selection();
    var sign = currentOp === 'add' ? '+' : '×';
    var out = {
      op: currentOp, sign: sign, a: s.a, b: s.b, dA: s.dA, dB: s.dB,
      mix: blend(s.a.color, s.b.color),
      label: s.a.label + ', ' + s.b.label
    };

    if (currentOp === 'add') {
      out.den = lcm(s.dA, s.dB);
      out.nA = s.a.num * (out.den / s.dA);
      out.nB = s.b.num * (out.den / s.dB);
      out.num = out.nA + out.nB;
      out.overflow = out.num > out.den;
    } else {
      out.den = s.dA * s.dB;
      out.num = s.a.num * s.b.num;
      out.overflow = false;
    }
    out.simple = simplified(out.num, out.den);
    return out;
  }

  function updatePreview() {
    var r = computeResult();
    previewBox.innerHTML = '';

    previewBox.appendChild(term(r.a.label + ' ' + fracText(r.a.num, r.dA), r.a.color));
    previewBox.appendChild(plain(' ' + r.sign + ' ', 'eq-op'));
    previewBox.appendChild(term(r.b.label + ' ' + fracText(r.b.num, r.dB), r.b.color));
    previewBox.appendChild(plain(' = ', 'eq-eq'));
    previewBox.appendChild(term(fracText(r.num, r.den), r.mix));

    var sub = document.createElement('span');
    sub.className = 'prev-sub';
    sub.textContent = r.op === 'add'
      ? (r.dA === r.dB
          ? 'Same denominator already — the squares just join together.'
          : 'Rewritten over a common denominator of ' + r.den + ': ' + fracText(r.nA, r.den) + ' + ' + fracText(r.nB, r.den) + '.')
      : 'Area model: ' + r.dA + ' columns for Space A, ' + r.dB + ' rows for Space B.';
    previewBox.appendChild(sub);
  }

  function term(text, color) {
    var el = document.createElement('span');
    el.className = 'eq-term';
    el.style.background = css(color);
    el.textContent = text;
    return el;
  }
  function plain(text, cls) {
    var el = document.createElement('span');
    if (cls) el.className = cls;
    el.textContent = text;
    return el;
  }

  /* ==========================================================
     Full-screen result
     ========================================================== */

  var resultTitle = document.getElementById('resultTitle');
  var resultWarn = document.getElementById('resultWarn');
  var resultGridArea = document.getElementById('resultGridArea');
  var resultLegend = document.getElementById('resultLegend');

  document.getElementById('computeBtn').addEventListener('click', function () {
    showResult(computeResult());
  });

  document.getElementById('backToMani').addEventListener('click', function () {
    close(resultOverlay);
    open(maniOverlay);
  });

  function showResult(r) {
    /* ---- equation headline ---- */
    resultTitle.innerHTML = '';
    resultTitle.appendChild(term(r.a.label + ' ' + fracText(r.a.num, r.dA), r.a.color));
    resultTitle.appendChild(plain(r.sign, 'eq-op'));
    resultTitle.appendChild(term(r.b.label + ' ' + fracText(r.b.num, r.dB), r.b.color));
    resultTitle.appendChild(plain('=', 'eq-eq'));
    resultTitle.appendChild(term(r.label + ' ' + fracText(r.num, r.den), r.mix));

    var extra = document.createElement('span');
    extra.className = 'eq-simple';
    extra.textContent = (r.simple.changed ? '= ' + fracText(r.simple.n, r.simple.d) + '  ' : '') + '= ' + asPercent(r.num, r.den);
    resultTitle.appendChild(extra);

    /* ---- warning when a sum runs past one whole ---- */
    if (r.overflow) {
      resultWarn.textContent =
        'That sum is more than one whole (' + fracText(r.num, r.den) + '). Two outcomes of the same ' +
        'experiment can never add past 1 — these came from different experiments. The first ' + r.den +
        ' squares are one whole; the gold-outlined ones are the overflow.';
      resultWarn.hidden = false;
    } else {
      resultWarn.hidden = true;
    }

    /* ---- the grid ---- */
    var cells = [];
    var opts = {};

    if (r.op === 'add') {
      var total = Math.max(r.den, r.num);
      opts.whole = r.den;
      for (var i = 0; i < total; i++) {
        if (i < r.num) {
          cells.push({ color: r.mix, text: r.label, extra: i >= r.den });
        } else {
          cells.push({ empty: true, text: '' });
        }
      }
    } else {
      opts.cols = r.dA;
      for (var j = 0; j < r.dB; j++) {
        for (var k = 0; k < r.dA; k++) {
          var inA = k < r.a.num;
          var inB = j < r.b.num;
          if (inA && inB) cells.push({ color: r.mix, text: r.label });
          else if (inA) cells.push({ color: tint(r.a.color), text: r.a.label, quiet: true });
          else if (inB) cells.push({ color: tint(r.b.color), text: r.b.label, quiet: true });
          else cells.push({ empty: true, text: '' });
        }
      }
    }

    /* ---- legend ---- */
    resultLegend.innerHTML = '';
    resultLegend.appendChild(chip(r.a.label + ' ' + fracText(r.a.num, r.dA), r.a.color));
    resultLegend.appendChild(mathSign(r.sign));
    resultLegend.appendChild(chip(r.b.label + ' ' + fracText(r.b.num, r.dB), r.b.color));
    resultLegend.appendChild(mathSign('='));
    resultLegend.appendChild(chip(r.label + ' ' + fracText(r.num, r.den), r.mix));

    open(resultOverlay);
    close(maniOverlay);
    /* draw once the overlay actually has a size */
    requestAnimationFrame(function () { drawGrid(resultGridArea, cells, opts); });
  }

  function chip(text, color) {
    var el = document.createElement('span');
    el.className = 'legend-chip';
    el.style.background = css(color);
    el.textContent = text;
    return el;
  }
  function mathSign(text) {
    var el = document.createElement('span');
    el.className = 'blend-math';
    el.textContent = text;
    return el;
  }

  /* ==========================================================
     Keep every grid sized to its box
     ========================================================== */

  var pending = null;
  function scheduleRedraw() {
    if (pending) return;
    pending = requestAnimationFrame(function () {
      pending = null;
      redraw(halves.A.gridArea);
      redraw(halves.B.gridArea);
      if (!resultOverlay.hidden) redraw(resultGridArea);
    });
  }

  if (window.ResizeObserver) {
    var ro = new ResizeObserver(scheduleRedraw);
    ro.observe(halves.A.gridArea);
    ro.observe(halves.B.gridArea);
    ro.observe(resultGridArea);
  } else {
    window.addEventListener('resize', scheduleRedraw);
  }

  afterBuild();
})();
