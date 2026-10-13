/* =========================================================
   Bell Curve Simulator
   ========================================================= */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const SVGNS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs = {}, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Up to `d` decimals, trailing zeros dropped, thousands separators.
  function fmt(v, d = 2) {
    if (!isFinite(v)) return '—';
    const r = Math.round(v * 10 ** d) / 10 ** d;
    return (Object.is(r, -0) ? 0 : r).toLocaleString(undefined, { maximumFractionDigits: d });
  }

  // z-score with an explicit sign: +1.25 / −0.50
  function fmtZ(z) {
    const r = Math.round(z * 100) / 100;
    return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(2);
  }

  // Share → "68.27%" (always 2 decimals so 68 – 95 – 99.7 line up)
  function fmtPct(p) { return `${(p * 100).toFixed(2)}%`; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // 1, 2 or 5 × a power of ten, close to `raw`
  function niceStep(raw) {
    const p = 10 ** Math.floor(Math.log10(raw));
    const f = raw / p;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  }

  const X_TICKS = 20;
  const Y_TICKS = 10;
  const MAX_EXACT_BINS = 81; // more possible values than this → group into bins
  const BIN_COUNT = 60;

  // ---------------- Elements ----------------
  const chart = $('#chart');
  const wrap = $('#chartWrap');
  const tooltip = $('#tooltip');
  const emptyState = $('#emptyState');
  const skipBtn = $('#skipBtn');
  const againBtn = $('#againBtn');

  // ---------------- State ----------------
  let sim = null;      // the current simulation (config + values + binning)
  let stats = null;    // statistics, once every dot is on the graph
  let selRange = null; // Range Finder selection { a, b } in data units (±Infinity = no limit)
  let inSel = null;    // per dot: 1 if it is inside the selection
  let shown = 0;       // how many dots are on screen
  let animId = null;
  let lastConfig = null;
  let L = null;        // pixel layout for the current chart size
  let layers = null;   // SVG groups

  // =========================================================
  //  Statistics
  // =========================================================
  function computeStats(vals) {
    const n = vals.length;
    if (!n) return null;
    let sum = 0;
    for (const v of vals) sum += v;
    const mean = sum / n;
    let ss = 0;
    for (const v of vals) ss += (v - mean) ** 2;
    const variance = ss / n;
    const sd = Math.sqrt(variance);
    const sorted = vals.slice().sort((a, b) => a - b);
    const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

    const freq = new Map();
    let best = 0;
    for (const v of sorted) {
      const k = Math.round(v * 1e6) / 1e6;
      const c = (freq.get(k) || 0) + 1;
      freq.set(k, c);
      if (c > best) best = c;
    }
    const modes = best > 1 ? [...freq].filter(([, c]) => c === best).map(([k]) => k) : [];
    const within = [1, 2, 3].map(z => {
      let c = 0;
      for (const v of vals) if (Math.abs(v - mean) <= z * sd + 1e-9) c++;
      return c / n;
    });
    return { n, sum, mean, ss, variance, sd, sorted, median, min: sorted[0], max: sorted[n - 1], modes, modeCount: best, within };
  }

  function normalPdf(x, mean, sd) {
    const z = (x - mean) / sd;
    return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
  }

  // Share of a bell curve below z (Abramowitz & Stegun erf, error < 2e-7)
  function normalCdf(z) {
    if (z === Infinity) return 1;
    if (z === -Infinity) return 0;
    const x = Math.abs(z) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * x);
    const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return 0.5 * (1 + (z < 0 ? -erf : erf));
  }

  // z below which a share p of a bell curve lies (Acklam's approximation)
  function normalInv(p) {
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const tail = q => (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    if (p < 0.02425) return tail(Math.sqrt(-2 * Math.log(p)));
    if (p > 1 - 0.02425) return -tail(Math.sqrt(-2 * Math.log(1 - p)));
    const q = p - 0.5, r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  // =========================================================
  //  Building simulations
  // =========================================================
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Mean = middle of the range, SD = range ÷ 6 (so the range covers ±3 SD).
  function bellParams(lo, hi) { return { mean: (lo + hi) / 2, sd: (hi - lo) / 6 }; }

  function buildSim(cfg) {
    const s = { cfg };
    if (cfg.type === 'single') {
      const { n, runs, p, groupLabel, percent, pText } = cfg;
      s.values = new Array(runs);
      for (let r = 0; r < runs; r++) {
        let c = 0;
        for (let t = 0; t < n; t++) if (Math.random() < p) c++;
        s.values[r] = percent ? (c / n) * 100 : c;
      }
      s.xMin = 0;
      s.xMax = percent ? 100 : n;
      s.step = percent ? 100 / n : 1;
      s.intTicks = true;
      s.title = percent ? `Percent ${groupLabel} (out of ${fmt(n, 0)})` : `Number of ${groupLabel} (out of ${fmt(n, 0)})`;
      s.subtitle = `${fmt(runs, 0)} runs · ${fmt(n, 0)} tries per run · P(${groupLabel}) = ${pText}`;
      s.xLabel = percent ? `Percent ${groupLabel} in one run` : `Number of ${groupLabel} in one run`;
      s.yLabel = 'Number of runs';
      s.unitName = 'one run';
      s.countNoun = 'runs';
      s.suffix = percent ? '%' : '';
      s.unit = '';
      s.withUnit = v => fmt(v) + s.suffix;
      s.tip = i => `${fmt(s.values[i])}${s.suffix} ${groupLabel}`;
    } else {
      // A perfect bell curve: each dot sits at an evenly spaced percentile of the
      // normal curve, rescaled so the mean and SD come out exactly as asked.
      const { title, lo, hi, unit, n, counted } = cfg;
      const { mean, sd } = bellParams(lo, hi);
      const z = Array.from({ length: n }, (_, i) => normalInv((i + 0.5) / n));
      const zsd = Math.sqrt(z.reduce((a, v) => a + v * v, 0) / n);
      s.values = shuffle(z.map(v => mean + (sd * v) / zsd));
      s.xMin = mean - 4 * sd;
      s.xMax = mean + 4 * sd;
      s.binWidth = sd / 5;          // 5 columns per SD, so SD lines fall on column edges
      s.niceTicks = true;
      s.title = title;
      s.subtitle = `A perfect bell curve of ${fmt(n, 0)} ${counted} · mean ${fmt(mean)} ${unit} · SD ${fmt(sd)} ${unit}`;
      s.xLabel = `${title} (${unit})`;
      s.yLabel = `Number of ${counted}`;
      s.unitName = `one of the ${counted}`;
      s.countNoun = counted;
      s.suffix = '';
      s.unit = unit;
      s.withUnit = v => `${fmt(v)} ${unit}`;
      s.tip = i => `${fmt(s.values[i])} ${unit}`;
    }
    setupBins(s);
    return s;
  }

  // Decide the columns dots stack into, then pre-compute every dot's spot.
  function setupBins(s) {
    const span = s.xMax - s.xMin;
    if (s.step && Math.round(span / s.step) + 1 <= MAX_EXACT_BINS) {
      s.perValue = true;
      s.binCount = Math.round(span / s.step) + 1;
      s.binWidth = s.step;
      s.binIndex = v => Math.round((v - s.xMin) / s.step);
      s.binCenter = b => s.xMin + b * s.step;
    } else {
      s.perValue = false;
      s.binCount = s.binWidth ? Math.round(span / s.binWidth) : BIN_COUNT;
      s.binWidth = span / s.binCount;
      s.binIndex = v => Math.min(s.binCount - 1, Math.max(0, Math.floor((v - s.xMin) / s.binWidth)));
      s.binCenter = b => s.xMin + (b + 0.5) * s.binWidth;
    }
    const counts = new Array(s.binCount).fill(0);
    s.grid = Array.from({ length: s.binCount }, () => []);
    s.pos = s.values.map((v, i) => {
      const b = s.binIndex(v);
      const lvl = counts[b]++;
      s.grid[b].push(i);
      return { b, lvl };
    });
    const tallest = Math.max(...counts);
    s.yMax = Math.max(10, Math.ceil(tallest / 10) * 10);
  }

  // =========================================================
  //  Drawing
  // =========================================================
  function computeLayout() {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 20;
    const m = { l: rem * 4.2, r: rem * 1.2, t: rem * 2.9, b: rem * 3.6 };
    const pw = Math.max(50, w - m.l - m.r);
    const ph = Math.max(50, h - m.t - m.b);
    const pad = sim.perValue ? sim.binWidth / 2 : 0;
    const d0 = sim.xMin - pad;
    const d1 = sim.xMax + pad;
    const x = v => m.l + ((v - d0) / (d1 - d0)) * pw;
    const xInv = px => d0 + ((px - m.l) / pw) * (d1 - d0);
    const countPx = ph / sim.yMax;
    const y = c => m.t + ph - c * countPx;
    const binPx = (pw * sim.binWidth) / (d1 - d0);
    const r = Math.max(1.2, Math.min(16, (Math.min(binPx, countPx) / 2) * 0.88));
    return { w, h, m, pw, ph, rem, x, xInv, y, countPx, binPx, r, d0, d1 };
  }

  function xTicks() {
    const span = sim.xMax - sim.xMin;
    const out = [];
    if (sim.niceTicks) {
      const step = niceStep(span / 14);
      for (let v = Math.ceil(sim.xMin / step) * step; v <= sim.xMax + step * 1e-6; v += step) out.push(Math.round(v / step) * step);
      return { values: out, decimals: Math.max(0, -Math.floor(Math.log10(step) + 1e-9)) };
    }
    const roundInts = sim.intTicks && span >= X_TICKS - 1;
    for (let k = 0; k < X_TICKS; k++) {
      let v = sim.xMin + (span * k) / (X_TICKS - 1);
      if (roundInts) v = Math.round(v);
      out.push(v);
    }
    return { values: out, decimals: roundInts ? 0 : span >= 19 ? 0 : span >= 2 ? 1 : 2 };
  }

  function drawStatic() {
    chart.innerHTML = '';
    if (!sim) return;
    L = computeLayout();
    const { m, pw, ph, x, y, w, h, rem } = L;
    chart.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const defs = svgEl('defs', {}, chart);
    const clip = svgEl('clipPath', { id: 'plotClip' }, defs);
    svgEl('rect', { x: m.l, y: m.t - 2, width: pw, height: ph + 2 }, clip);

    layers = {
      grid: svgEl('g', {}, chart),
      band: svgEl('g', { 'clip-path': 'url(#plotClip)' }, chart),
      sel: svgEl('g', { 'clip-path': 'url(#plotClip)' }, chart),
      dots: svgEl('g', {}, chart),
      curve: svgEl('g', { 'clip-path': 'url(#plotClip)' }, chart),
      lines: svgEl('g', {}, chart),
      selTop: svgEl('g', {}, chart),
      axes: svgEl('g', {}, chart),
      hover: svgEl('g', {}, chart),
    };
    inSel = new Uint8Array(sim.values.length);

    // Y grid + labels (0 … yMax in 10 equal steps)
    for (let k = 0; k <= Y_TICKS; k++) {
      const c = (sim.yMax * k) / Y_TICKS;
      const py = y(c);
      if (k > 0) svgEl('line', { class: 'grid-line', x1: m.l, x2: m.l + pw, y1: py, y2: py }, layers.grid);
      svgEl('line', { class: 'tick-mark', x1: m.l - 7, x2: m.l, y1: py, y2: py }, layers.axes);
      const t = svgEl('text', { class: 'tick-label', x: m.l - 11, y: py, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, layers.axes);
      t.textContent = fmt(c, 1);
    }

    // X ticks (20 numbers from lowest to highest possible)
    const { values: tickValues, decimals } = xTicks();
    for (const v of tickValues) {
      const px = x(v);
      svgEl('line', { class: 'tick-mark', x1: px, x2: px, y1: m.t + ph, y2: m.t + ph + 7 }, layers.axes);
      const t = svgEl('text', { class: 'tick-label', x: px, y: m.t + ph + 9 + rem * 0.8, 'text-anchor': 'middle' }, layers.axes);
      t.textContent = fmt(v, decimals);
    }

    // Axes
    svgEl('line', { class: 'axis-line', x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph }, layers.axes);
    svgEl('line', { class: 'axis-line', x1: m.l, x2: m.l, y1: m.t, y2: m.t + ph }, layers.axes);

    const xt = svgEl('text', { class: 'axis-title', x: m.l + pw / 2, y: h - rem * 0.5, 'text-anchor': 'middle' }, layers.axes);
    xt.textContent = sim.xLabel;
    const yt = svgEl('text', {
      class: 'axis-title', 'text-anchor': 'middle',
      transform: `translate(${rem * 0.95}, ${m.t + ph / 2}) rotate(-90)`,
    }, layers.axes);
    yt.textContent = sim.yLabel;

    for (let i = 0; i < shown; i++) addDot(i, false);
  }

  function addDot(i, animate) {
    const { b, lvl } = sim.pos[i];
    const c = svgEl('circle', {
      cx: L.x(sim.binCenter(b)),
      cy: L.y(lvl + 0.5),
      r: L.r,
      class: 'dot' + (L.r < 3.5 ? ' small' : '') + (animate ? ' pop' : ''),
    }, layers.dots);
    return c;
  }

  function drawOverlay(st) {
    layers.band.innerHTML = '';
    layers.curve.innerHTML = '';
    layers.lines.innerHTML = '';
    if (!st) return;
    const { m, ph, x, y, rem } = L;
    const top = m.t;
    const base = m.t + ph;

    // ±1 SD band
    if (st.sd > 0) {
      const x1 = x(st.mean - st.sd);
      const x2 = x(st.mean + st.sd);
      svgEl('rect', { class: 'sd-band', x: x1, y: top, width: Math.max(0, x2 - x1), height: ph }, layers.band);
    }

    // Faint markers at 1, 2 and 3 SD on each side of the mean
    if (st.sd > 0 && x(st.mean + st.sd) - x(st.mean) >= 4) {
      const roomForLabels = x(st.mean + st.sd) - x(st.mean) >= rem * 2.6;
      for (const z of [-3, -2, -1, 1, 2, 3]) {
        const v = st.mean + z * st.sd;
        const px = x(v);
        if (px < m.l || px > m.l + L.pw) continue;
        svgEl('line', { class: 'sd-line', x1: px, x2: px, y1: top, y2: base }, layers.band);
        if (roomForLabels) {
          const t = svgEl('text', { class: 'sd-label', x: px, y: top + rem * 0.75, 'text-anchor': 'middle' }, layers.band);
          t.textContent = `${z > 0 ? '+' : '−'}${Math.abs(z)} SD`;
          const tv = svgEl('text', { class: 'sd-label sd-val', x: px, y: top + rem * 1.4, 'text-anchor': 'middle' }, layers.band);
          tv.textContent = fmt(v) + sim.suffix;
        }
      }
    }

    // Bell curve: expected dots per column = N × column width × normal density
    if (st.sd > 0 && st.n > 1) {
      const pts = [];
      const steps = 260;
      for (let k = 0; k <= steps; k++) {
        const v = L.d0 + ((L.d1 - L.d0) * k) / steps;
        const cnt = st.n * sim.binWidth * normalPdf(v, st.mean, st.sd);
        pts.push(`${x(v).toFixed(1)},${Math.max(top - 4, y(cnt)).toFixed(1)}`);
      }
      svgEl('polyline', { class: 'curve', points: pts.join(' ') }, layers.curve);
    }

    // Mean + median lines with direct labels
    const plotRight = m.l + L.pw;
    const label = (px, py, text, cls) => {
      const anchor = px > plotRight - rem * 4 ? 'end' : px < m.l + rem * 4 ? 'start' : 'middle';
      const t = svgEl('text', { class: `line-label ${cls}`, x: px, y: py, 'text-anchor': anchor }, layers.lines);
      t.textContent = text;
    };
    const xm = x(st.mean);
    const xmed = x(st.median);
    svgEl('line', { class: 'mean-line', x1: xm, x2: xm, y1: top - rem * 1.0, y2: base }, layers.lines);
    svgEl('line', { class: 'median-line', x1: xmed, x2: xmed, y1: top - rem * 0.1, y2: base }, layers.lines);
    label(xm, top - rem * 1.3, `Mean ${fmt(st.mean)}${sim.suffix}`, 'mean');
    label(xmed, top - rem * 0.25, `Median ${fmt(st.median)}${sim.suffix}`, 'median');
  }

  function updateNumbers(st) {
    const sfx = sim ? sim.suffix : '';
    const set = (id, v) => { $(id).textContent = v; };
    if (!st) {
      ['#stMean', '#stMedian', '#stSD', '#stMOE', '#stRange', '#stMinMax', '#cardMean', '#cardMedian'].forEach(id => set(id, '—'));
      $$('.how-btn').forEach(b => { b.disabled = true; });
      return;
    }
    set('#stMean', fmt(st.mean) + sfx);
    set('#stMedian', fmt(st.median) + sfx);
    set('#stSD', fmt(st.sd) + sfx);
    // Each dot in Single is already a sample result, so its spread (SD) is the standard error.
    // In Bell Curve each dot is one individual, so the margin of error is for their mean: SD ÷ √N.
    const se = sim.cfg.type === 'bell' ? st.sd / Math.sqrt(st.n) : st.sd;
    set('#stMOE', '± ' + fmt(2 * se) + sfx);
    set('#stRange', fmt(st.max - st.min) + sfx);
    set('#stMinMax', `${fmt(st.min)} / ${fmt(st.max)}`);
    set('#cardMean', fmt(st.mean) + sfx);
    set('#cardMedian', fmt(st.median) + sfx);
    $$('.how-btn').forEach(b => { b.disabled = false; });
  }

  function isDone() { return !!sim && shown > 0 && shown === sim.values.length; }

  // Statistics (sidebar, cards, and graph overlays) only appear once every dot is on the graph.
  function refresh(reveal = false) {
    stats = isDone() ? computeStats(sim.values) : null;
    if (layers) {
      drawOverlay(stats);
      drawSelection();
      if (reveal) [layers.band, layers.curve, layers.lines].forEach(g => g.classList.add('reveal'));
    }
    updateNumbers(stats);
    updateRangeCard();
    return stats;
  }

  // =========================================================
  //  Range Finder: select any range and see what share is inside
  // =========================================================
  const rgFrom = $('#rgFrom');
  const rgTo = $('#rgTo');
  const quickBtns = $$('.quick-btn');
  let selFrame = null;

  // Where the selection's edges are drawn. When results are whole steps (Single tab),
  // each value owns a column one step wide, so the edges sit on the outside of the
  // end columns — then the shaded area matches the dots that are counted.
  function drawnRange() {
    const h = sim.perValue ? sim.step / 2 : 0;
    return { a: selRange.a - h, b: selRange.b + h };
  }

  function bellShare(st) {
    const { a, b } = drawnRange();
    if (st.sd === 0) return st.mean >= a && st.mean <= b ? 1 : 0;
    return Math.max(0, normalCdf((b - st.mean) / st.sd) - normalCdf((a - st.mean) / st.sd));
  }

  function setSel(a, b, fromInputs = false) {
    let swapped = false;
    if (a > b) { [a, b] = [b, a]; swapped = true; }
    selRange = { a, b };
    if (!fromInputs) syncInputs();
    scheduleSel();
    return swapped;
  }

  function clearSel() {
    selRange = null;
    syncInputs();
    scheduleSel();
  }

  function syncInputs() {
    const show = v => (isFinite(v) ? String(Math.round(v * 100) / 100) : '');
    rgFrom.value = selRange ? show(selRange.a) : '';
    rgTo.value = selRange ? show(selRange.b) : '';
  }

  function scheduleSel() {
    if (selFrame) return;
    selFrame = requestAnimationFrame(() => {
      selFrame = null;
      drawSelection();
      updateRangeCard();
    });
  }

  // A label with a rounded background, kept inside the plot area.
  function pill(parent, px, py, text, cls, anchor = 'middle') {
    const g = svgEl('g', { class: `pill ${cls}` }, parent);
    const r = svgEl('rect', { rx: 7 }, g);
    const t = svgEl('text', { x: px, y: py, 'text-anchor': anchor, 'dominant-baseline': 'central' }, g);
    t.textContent = text;
    const bb = t.getBBox();
    const padX = 7, padY = 3;
    r.setAttribute('x', bb.x - padX);
    r.setAttribute('y', bb.y - padY);
    r.setAttribute('width', bb.width + padX * 2);
    r.setAttribute('height', bb.height + padY * 2);
    const left = bb.x - padX, right = bb.x + bb.width + padX;
    const dx = left < L.m.l ? L.m.l - left : right > L.m.l + L.pw ? L.m.l + L.pw - right : 0;
    if (dx) g.setAttribute('transform', `translate(${dx},0)`);
    return g;
  }

  function drawSelection() {
    if (!layers) return;
    layers.sel.innerHTML = '';
    layers.selTop.innerHTML = '';
    const st = stats;
    const active = !!(st && selRange);
    layers.dots.classList.toggle('has-sel', active);

    // Light up the dots inside the range
    const dots = layers.dots.children;
    for (let i = 0; i < shown; i++) {
      const v = sim.values[i];
      const inside = active && v >= selRange.a - 1e-9 && v <= selRange.b + 1e-9 ? 1 : 0;
      if (inSel[i] !== inside) {
        inSel[i] = inside;
        dots[i].classList.toggle('in', !!inside);
      }
    }
    if (!active) return;

    const { m, pw, ph, x, y, rem } = L;
    const top = m.t, base = m.t + ph;
    const dr = drawnRange();
    const lo = Math.max(L.d0, dr.a);
    const hi = Math.min(L.d1, dr.b);
    if (hi < lo) return;
    const x1 = x(lo), x2 = x(hi);

    svgEl('rect', { class: 'sel-col', x: x1, y: top, width: Math.max(0, x2 - x1), height: ph }, layers.sel);

    // Shade the area under the bell curve
    if (st.sd > 0 && st.n > 1) {
      const pts = [`${x1.toFixed(1)},${base}`];
      const steps = Math.max(2, Math.ceil(((x2 - x1) / pw) * 260));
      for (let k = 0; k <= steps; k++) {
        const v = lo + ((hi - lo) * k) / steps;
        const cnt = st.n * sim.binWidth * normalPdf(v, st.mean, st.sd);
        pts.push(`${x(v).toFixed(1)},${Math.max(top - 4, y(cnt)).toFixed(1)}`);
      }
      pts.push(`${x2.toFixed(1)},${base}`);
      svgEl('polygon', { class: 'sel-area', points: pts.join(' ') }, layers.sel);
    }

    // Edges with a grip and their value + z-score
    const edgeY = top + rem * 2.5;
    [[selRange.a, dr.a, x1, 'end', -8], [selRange.b, dr.b, x2, 'start', 8]].forEach(([v, dv, px, anchor, off]) => {
      if (!isFinite(v) || dv < L.d0 - 1e-9 || dv > L.d1 + 1e-9) return;
      svgEl('line', { class: 'sel-edge', x1: px, x2: px, y1: top, y2: base }, layers.selTop);
      svgEl('rect', { class: 'sel-grip', x: px - 5, y: top + ph / 2 - rem * 0.8, width: 10, height: rem * 1.6, rx: 5 }, layers.selTop);
      const z = st.sd > 0 ? `  (${fmtZ((v - st.mean) / st.sd)} SD)` : '';
      pill(layers.selTop, px + off, edgeY, `${fmt(v)}${sim.suffix}${z}`, 'edge', anchor);
    });

    const p = bellShare(st);
    pill(layers.selTop, (x1 + x2) / 2, top + rem * 4.1, fmtPct(p), 'big');
  }

  function describeRange(a, b) {
    const u = sim.withUnit;
    if (!isFinite(a) && !isFinite(b)) return 'everything';
    if (!isFinite(a)) return `below ${u(b)}`;
    if (!isFinite(b)) return `above ${u(a)}`;
    return `between ${u(a)} and ${u(b)}`;
  }

  function updateRangeCard() {
    const st = stats;
    const hint = $('#rgHint');
    const res = $('#rgResults');
    rgFrom.disabled = rgTo.disabled = !st;
    quickBtns.forEach(b => { b.disabled = !st || (b.dataset.sd !== 'clear' && st.sd === 0); });
    $('#rgUnit').textContent = sim ? (sim.unit || (sim.suffix === '%' ? '%' : '')) : '';

    if (!st || !selRange) {
      res.hidden = true;
      hint.hidden = false;
      hint.textContent = !sim
        ? 'Run a simulation, then drag across the graph to select any range.'
        : !st
          ? 'The Range Finder turns on when all the dots are on the graph.'
          : 'Drag across the graph to select any range, type numbers above, or pick a quick range. Drag to the edge of the graph to include everything above or below.';
      return;
    }
    hint.hidden = true;
    res.hidden = false;

    const { a, b } = selRange;
    const n = st.n;
    const noun = esc(sim.countNoun);
    const p = bellShare(st);
    let dotsIn = 0;
    for (const v of sim.values) if (v >= a - 1e-9 && v <= b + 1e-9) dotsIn++;

    $('#rgPct').textContent = fmtPct(p);
    $('#rgWhat').textContent = `of the bell curve is ${describeRange(a, b)}`;
    $('#rgCount').innerHTML =
      `<b>≈ ${fmt(Math.round(p * n), 0)} ${noun}</b> ` +
      `<span class="rg-work">(${fmtPct(p)} × ${fmt(n, 0)} = ${fmt(p * n, 1)})</span>`;
    $('#rgDots').innerHTML =
      `Dots on the graph in this range: <b>${fmt(dotsIn, 0)}</b> of ${fmt(n, 0)} (${fmt((dotsIn / n) * 100, 1)}%)`;

    if (st.sd > 0) {
      const row = (label, v) => isFinite(v)
        ? `<tr><th>${label}</th><td>(${fmt(v)} − ${fmt(st.mean)}) ÷ ${fmt(st.sd)} = <b>${fmtZ((v - st.mean) / st.sd)}</b></td></tr>`
        : `<tr><th>${label}</th><td>no limit</td></tr>`;
      $('#rgZ').innerHTML =
        `<p class="rg-z-head">z-score (SDs from the mean) = (value − mean) ÷ SD</p>
         <table>${row('From', a)}${row('To', b)}</table>`;
    } else {
      $('#rgZ').innerHTML = '';
    }
  }

  function readInputs() {
    const f = rgFrom.value.trim();
    const t = rgTo.value.trim();
    if (f === '' && t === '') { selRange = null; scheduleSel(); return; }
    const a = f === '' ? -Infinity : Number(f);
    const b = t === '' ? Infinity : Number(t);
    if (Number.isNaN(a) || Number.isNaN(b)) return;
    setSel(a, b, true);
  }
  rgFrom.addEventListener('input', readInputs);
  rgTo.addEventListener('input', readInputs);

  quickBtns.forEach(btn => btn.addEventListener('click', () => {
    if (!stats) return;
    if (btn.dataset.sd === 'clear') return clearSel();
    const k = Number(btn.dataset.sd);
    setSel(stats.mean - k * stats.sd, stats.mean + k * stats.sd);
  }));

  // =========================================================
  //  Running a simulation (dots appear one by one)
  // =========================================================
  function startSimulation(cfg) {
    stopAnimation();
    lastConfig = cfg;
    sim = buildSim(cfg);
    shown = 0;
    selRange = null;
    syncInputs();

    $('#graphTitle').textContent = sim.title;
    $('#graphSubtitle').textContent = sim.subtitle;
    $('#lgUnit').textContent = sim.unitName;
    emptyState.hidden = true;
    hideTooltip();

    drawStatic();
    refresh();

    const total = sim.values.length;
    const duration = Math.min(10000, Math.max(1800, total * 35));
    const start = performance.now();
    skipBtn.hidden = false;
    againBtn.hidden = true;

    const frame = now => {
      const target = Math.min(total, Math.ceil(((now - start) / duration) * total));
      while (shown < target) addDot(shown++, true);
      if (shown < total) animId = requestAnimationFrame(frame);
      else finishAnimation();
    };
    animId = requestAnimationFrame(frame);
  }

  function stopAnimation() {
    if (animId) cancelAnimationFrame(animId);
    animId = null;
  }

  function finishAnimation() {
    stopAnimation();
    if (!sim) return;
    while (shown < sim.values.length) addDot(shown++, false);
    refresh(true);
    skipBtn.hidden = true;
    againBtn.hidden = false;
  }

  skipBtn.addEventListener('click', finishAnimation);
  againBtn.addEventListener('click', () => { if (lastConfig) startSimulation(lastConfig); });

  new ResizeObserver(() => {
    if (!sim) return;
    hideTooltip();
    drawStatic();
    refresh();
  }).observe(wrap);

  // =========================================================
  //  Hover: find the dot under the pointer from its column + level
  // =========================================================
  let hoverRing = null;

  function hideTooltip() {
    tooltip.hidden = true;
    if (hoverRing) { hoverRing.remove(); hoverRing = null; }
  }

  // ---------------- Dragging a range ----------------
  let drag = null; // { mode: 'new' | 'a' | 'b', startPx, anchor, moved }

  function localPoint(e) {
    const rect = chart.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  }

  // Pixel → value, rounded to a sensible step. Past the plot edge = no limit.
  function pxToValue(px) {
    if (px <= L.m.l) return -Infinity;
    if (px >= L.m.l + L.pw) return Infinity;
    const step = sim.perValue ? sim.step : niceStep((L.d1 - L.d0) / 400);
    return Math.round(L.xInv(px) / step) * step;
  }

  function edgeAt(px) {
    if (!selRange) return null;
    const near = v => {
      const ex = isFinite(v) ? L.x(v) : v < 0 ? L.m.l : L.m.l + L.pw;
      return Math.abs(ex - px) <= 10;
    };
    const dr = drawnRange();
    if (near(dr.a)) return 'a';
    if (near(dr.b)) return 'b';
    return null;
  }

  chart.addEventListener('pointerdown', e => {
    if (!stats || !L || e.button !== 0) return;
    const { px, py } = localPoint(e);
    const { m, pw, ph } = L;
    if (px < m.l - 10 || px > m.l + pw + 10 || py < m.t - 10 || py > m.t + ph + 10) return;
    const edge = edgeAt(px);
    drag = { mode: edge || 'new', startPx: px, anchor: edge ? null : pxToValue(px), moved: false };
    try { chart.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    hideTooltip();
    e.preventDefault();
  });

  function endDrag() { drag = null; }
  chart.addEventListener('pointerup', endDrag);
  chart.addEventListener('pointercancel', endDrag);

  chart.addEventListener('pointermove', e => {
    if (drag) {
      const { px } = localPoint(e);
      if (drag.mode === 'new') {
        if (!drag.moved && Math.abs(px - drag.startPx) < 5) return;
        drag.moved = true;
        setSel(drag.anchor, pxToValue(px));
      } else {
        const v = pxToValue(px);
        const swapped = drag.mode === 'a' ? setSel(v, selRange.b) : setSel(selRange.a, v);
        if (swapped) drag.mode = drag.mode === 'a' ? 'b' : 'a';
      }
      return;
    }
    if (!sim || !L || !shown) return hideTooltip();
    const { px, py } = localPoint(e);
    const { m, pw, ph } = L;
    const inPlot = px >= m.l && px <= m.l + pw && py >= m.t - 10 && py <= m.t + ph;
    chart.style.cursor = !stats || !inPlot ? '' : edgeAt(px) ? 'ew-resize' : 'crosshair';
    if (px < m.l || px > m.l + pw || py < m.t - L.r || py > m.t + ph) return hideTooltip();

    const v = L.xInv(px);
    let b = sim.perValue ? Math.round((v - sim.xMin) / sim.step) : Math.floor((v - sim.xMin) / sim.binWidth);
    b = Math.max(0, Math.min(sim.binCount - 1, b));
    // ignore if pointer is far from the column center
    if (Math.abs(L.x(sim.binCenter(b)) - px) > Math.max(L.r + 4, L.binPx / 2)) return hideTooltip();
    const lvl = Math.floor((m.t + ph - py) / L.countPx);
    const col = sim.grid[b];
    let idx = col[Math.max(0, lvl)];
    if (idx === undefined || idx >= shown) {
      // forgive pointer slightly above the top dot of the column
      const topIdx = col.filter(i => i < shown).length - 1;
      if (topIdx < 0 || lvl - topIdx > 1) return hideTooltip();
      idx = col[topIdx];
    }

    const pos = sim.pos[idx];
    const cx = L.x(sim.binCenter(pos.b));
    const cy = L.y(pos.lvl + 0.5);
    if (!hoverRing) hoverRing = svgEl('circle', { class: 'hover-ring' }, layers.hover);
    hoverRing.setAttribute('cx', cx);
    hoverRing.setAttribute('cy', cy);
    hoverRing.setAttribute('r', Math.max(L.r + 3, 7));

    tooltip.textContent = sim.tip(idx);
    if (stats && stats.sd > 0) {
      const small = document.createElement('small');
      small.textContent = `${fmtZ((sim.values[idx] - stats.mean) / stats.sd)} SD from the mean`;
      tooltip.appendChild(small);
    }
    tooltip.hidden = false;
    const tw = tooltip.offsetWidth;
    const left = Math.max(tw / 2 + 4, Math.min(wrap.clientWidth - tw / 2 - 4, cx));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${cy - Math.max(L.r, 6)}px`;
  });
  chart.addEventListener('pointerleave', hideTooltip);

  // =========================================================
  //  Modals
  // =========================================================
  let openModalEl = null;
  let returnFocus = null;

  function openModal(el) {
    returnFocus = document.activeElement;
    el.hidden = false;
    openModalEl = el;
    const first = el.querySelector('.tab-panel:not([hidden]) input, .close-btn');
    if (first) first.focus();
  }
  function closeModal(el) {
    el.hidden = true;
    openModalEl = null;
    if (returnFocus) returnFocus.focus();
  }

  $$('.modal-backdrop').forEach(bd => {
    bd.addEventListener('mousedown', e => { if (e.target === bd) closeModal(bd); });
    bd.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(bd)));
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openModalEl) closeModal(openModalEl);
  });

  const simModal = $('#simModal');
  $('#openSimBtn').addEventListener('click', () => openModal(simModal));

  // Tabs
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => {
        const on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on);
      });
      $$('.tab-panel').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
    });
  });

  // =========================================================
  //  Single tab: groups with shared-denominator fractions
  // =========================================================
  const groupsEl = $('#groups');
  const probStatus = $('#probStatus');

  function addGroupRow(name = '', num = '', checked = false) {
    const existingDen = groupsEl.querySelector('.g-den');
    const row = document.createElement('div');
    row.className = 'group-row';
    row.innerHTML = `
      <label class="g-check" title="Show this group on the graph">
        <input type="checkbox" class="g-show"><span class="sr-only">Show this group on the graph</span>
      </label>
      <input type="text" class="g-name" maxlength="30">
      <div class="fraction">
        <input type="number" class="g-num" min="0" step="1" inputmode="numeric" aria-label="Numerator">
        <span class="frac-bar" aria-hidden="true"></span>
        <input type="number" class="g-den" min="1" step="1" inputmode="numeric" aria-label="Denominator">
      </div>
      <button type="button" class="g-remove" aria-label="Remove group">✕</button>`;
    $('.g-name', row).value = name;
    $('.g-num', row).value = num;
    $('.g-den', row).value = existingDen ? existingDen.value : '';
    $('.g-show', row).checked = checked;
    row.classList.toggle('checked', checked);
    groupsEl.appendChild(row);
    renumberGroups();
    return row;
  }

  function renumberGroups() {
    const rows = $$('.group-row', groupsEl);
    rows.forEach((row, i) => {
      $('.g-name', row).placeholder = `Group ${i + 1} name`;
      $('.g-name', row).setAttribute('aria-label', `Group ${i + 1} name`);
      $('.g-num', row).setAttribute('aria-label', `Group ${i + 1} probability numerator`);
      $('.g-den', row).setAttribute('aria-label', `Group ${i + 1} probability denominator`);
      $('.g-remove', row).disabled = rows.length <= 2;
    });
    updateProbStatus();
  }

  function updateProbStatus() {
    const nums = $$('.g-num', groupsEl).map(i => i.value.trim());
    const den = ($('.g-den', groupsEl) || {}).value || '';
    if (!den || nums.some(n => n === '')) {
      probStatus.className = 'prob-status';
      probStatus.textContent = 'Fill in every fraction. They must add up to 1.';
      return false;
    }
    const sum = nums.reduce((a, n) => a + Number(n), 0);
    const ok = Number(den) > 0 && sum === Number(den);
    probStatus.className = 'prob-status ' + (ok ? 'ok' : 'bad');
    probStatus.textContent = ok
      ? `Total: ${sum}/${den} = 1 ✓`
      : `Total: ${sum}/${den} — must add up to 1 (${den}/${den})`;
    return ok;
  }

  groupsEl.addEventListener('input', e => {
    const t = e.target;
    if (t.classList.contains('g-den')) {
      // one shared denominator: changing one changes them all
      $$('.g-den', groupsEl).forEach(d => { if (d !== t) d.value = t.value; });
    }
    if (t.classList.contains('g-show')) t.closest('.group-row').classList.toggle('checked', t.checked);
    t.classList.remove('invalid');
    updateProbStatus();
  });
  groupsEl.addEventListener('change', e => {
    if (e.target.classList.contains('g-show')) e.target.closest('.group-row').classList.toggle('checked', e.target.checked);
  });
  groupsEl.addEventListener('click', e => {
    const btn = e.target.closest('.g-remove');
    if (!btn || btn.disabled) return;
    btn.closest('.group-row').remove();
    renumberGroups();
  });

  $('#addGroupBtn').addEventListener('click', () => {
    const row = addGroupRow();
    $('.g-name', row).focus();
  });

  // Defaults: a fair coin
  addGroupRow('Heads', '1', true);
  addGroupRow('Tails', '1', false);
  $$('.g-den', groupsEl).forEach(d => { d.value = '2'; });
  updateProbStatus();

  // ---------------- Validation helpers ----------------
  function mark(input, bad) { input.classList.toggle('invalid', bad); return bad; }
  const isInt = s => s.trim() !== '' && Number.isInteger(Number(s));
  const isNum = s => s.trim() !== '' && isFinite(Number(s));
  function intField(input, min, max) {
    const v = input.value;
    return mark(input, !(isInt(v) && Number(v) >= min && Number(v) <= max));
  }
  function textField(input) { input.value = input.value.trim(); return mark(input, input.value === ''); }

  $$('.tab-panel input').forEach(i => i.addEventListener('input', () => i.classList.remove('invalid')));

  function joinNames(names) {
    if (names.length <= 1) return names[0] || '';
    return names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1];
  }

  // ---------------- Submit: Single ----------------
  $('#formSingle').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.currentTarget;
    const err = $('.form-error', form);
    const errors = [];
    const rows = $$('.group-row', groupsEl);

    let missing = false;
    rows.forEach(row => {
      if (textField($('.g-name', row))) missing = true;
      if (mark($('.g-num', row), !(isInt($('.g-num', row).value) && Number($('.g-num', row).value) >= 0))) missing = true;
      if (mark($('.g-den', row), !(isInt($('.g-den', row).value) && Number($('.g-den', row).value) >= 1))) missing = true;
    });
    if (intField($('#sSample'), 1, 10000)) errors.push('Sample size must be a whole number from 1 to 10,000.');
    if (intField($('#sRuns'), 1, 5000)) errors.push('Number of runs must be a whole number from 1 to 5,000.');
    if (missing) errors.unshift('Fill in every group name and fraction.');
    else if (!updateProbStatus()) errors.unshift('The probabilities must add up to exactly 1.');

    const checked = rows.filter(r => $('.g-show', r).checked);
    if (!checked.length) errors.push('Check the box next to the group the graph should show.');

    const names = rows.map(r => $('.g-name', r).value.toLowerCase());
    if (!missing && new Set(names).size !== names.length) errors.push('Each group needs a different name.');

    if (errors.length) { err.textContent = errors[0]; return; }
    err.textContent = '';

    const den = Number($('.g-den', groupsEl).value);
    const num = checked.reduce((a, r) => a + Number($('.g-num', r).value), 0);
    closeModal(simModal);
    startSimulation({
      type: 'single',
      n: Number($('#sSample').value),
      runs: Number($('#sRuns').value),
      p: num / den,
      pText: `${num}/${den}`,
      groupLabel: joinNames(checked.map(r => $('.g-name', r).value)),
      percent: form.elements.sDisplay.value === 'percent',
    });
  });

  // ---------------- Bell Curve tab ----------------
  const bellPreview = $('#bellPreview');

  function updateBellPreview() {
    const lo = Number($('#bLow').value);
    const hi = Number($('#bHigh').value);
    const unit = esc($('#bUnit').value.trim());
    if (!isNum($('#bLow').value) || !isNum($('#bHigh').value) || hi <= lo) {
      bellPreview.innerHTML = '';
      return;
    }
    const { mean, sd } = bellParams(lo, hi);
    const band = (k, pct) => `<li><b>${pct}</b> between ${fmt(mean - k * sd)} and ${fmt(mean + k * sd)} <small>(±${k} SD)</small></li>`;
    bellPreview.innerHTML = `
      <p>Mean = <b>${fmt(mean)} ${unit}</b> <small>(the middle)</small> &nbsp;·&nbsp; 1 SD = <b>${fmt(sd)} ${unit}</b> <small>(${fmt(hi - lo)} ÷ 6)</small></p>
      <ul>${band(1, '68%')}${band(2, '95%')}${band(3, '99.7%')}</ul>`;
  }
  ['#bLow', '#bHigh', '#bUnit'].forEach(id => $(id).addEventListener('input', updateBellPreview));
  updateBellPreview();

  // ---------------- Submit: Bell Curve ----------------
  $('#formBell').addEventListener('submit', e => {
    e.preventDefault();
    const err = $('.form-error', e.currentTarget);
    const errors = [];
    const lo = $('#bLow'), hi = $('#bHigh');
    const blank = [textField($('#bTitle')), textField($('#bUnit')), textField($('#bCounted')),
      mark(lo, !isNum(lo.value)), mark(hi, !isNum(hi.value))].some(Boolean);
    if (blank) errors.push('Fill in every field.');
    else if (Number(hi.value) <= Number(lo.value)) { mark(hi, true); errors.push('The highest number must be bigger than the lowest number.'); }
    if (intField($('#bSample'), 2, 10000)) errors.push('Sample size must be a whole number from 2 to 10,000.');
    if (errors.length) { err.textContent = errors[0]; return; }
    err.textContent = '';
    closeModal(simModal);
    startSimulation({
      type: 'bell',
      title: $('#bTitle').value,
      unit: $('#bUnit').value,
      counted: $('#bCounted').value,
      lo: Number(lo.value),
      hi: Number(hi.value),
      n: Number($('#bSample').value),
    });
  });

  // =========================================================
  //  "How?" explanations, built from the actual data
  // =========================================================
  const explainModal = $('#explainModal');

  function chipList(values, { highlight = new Set(), positions = null, sfx = '' } = {}) {
    return values.map((v, k) => {
      if (v === null) return '<span class="op">…</span>';
      const pos = positions ? `<small>#${fmt(positions[k], 0)}</small>` : '';
      return `<span class="chip${highlight.has(k) ? ' hl' : ''}">${fmt(v)}${sfx}${pos}</span>`;
    }).join(' ');
  }

  function explainMean(st, vals, sfx) {
    const n = st.n;
    let shownVals;
    if (n <= 14) shownVals = vals.slice();
    else shownVals = [...vals.slice(0, 10), null, ...vals.slice(-2)];
    const parts = shownVals.map(v => (v === null ? '<span class="op">…</span>' : `<span class="chip">${fmt(v)}${sfx}</span>`));
    return `
      <p class="lead">The mean is the <strong>fair share</strong>: if every result were made equal, this is what each would be.</p>
      <ol class="steps">
        <li><span class="step-title">Add up all ${fmt(n, 0)} results</span>
          <div class="chips">${parts.join(' <span class="op">+</span> ')}</div>
          <div class="eq">Sum = <b>${fmt(st.sum)}</b></div></li>
        <li><span class="step-title">Divide the sum by how many results there are</span>
          <div class="eq">${fmt(st.sum)} ÷ ${fmt(n, 0)} = <b>${fmt(st.mean, 3)}${sfx}</b></div></li>
      </ol>
      <p class="rule-box">On the graph, the mean is the solid dark line — the balance point of all the dots.</p>`;
  }

  function explainMedian(st, sfx) {
    const n = st.n;
    const s = st.sorted;
    const odd = n % 2 === 1;
    const midLo = odd ? (n - 1) / 2 : n / 2 - 1;  // 0-based
    const midHi = odd ? midLo : n / 2;
    const from = Math.max(0, midLo - 4);
    const to = Math.min(n - 1, midHi + 4);
    const vals = [], positions = [], hl = new Set();
    if (from > 0) { vals.push(s[0]); positions.push(1); if (from > 1) { vals.push(null); positions.push(0); } }
    for (let i = from; i <= to; i++) {
      if (i === midLo || i === midHi) hl.add(vals.length);
      vals.push(s[i]); positions.push(i + 1);
    }
    if (to < n - 1) { if (to < n - 2) { vals.push(null); positions.push(0); } vals.push(s[n - 1]); positions.push(n); }

    const step3 = odd
      ? `<li><span class="step-title">There is an odd number of results, so one result is in the middle: position #${fmt(midLo + 1, 0)}</span>
          <div class="eq">Median = <b>${fmt(st.median, 3)}${sfx}</b></div></li>`
      : `<li><span class="step-title">There is an even number of results, so two share the middle: positions #${fmt(midLo + 1, 0)} and #${fmt(midHi + 1, 0)}. Take their average.</span>
          <div class="eq">(${fmt(s[midLo])} + ${fmt(s[midHi])}) ÷ 2 = <b>${fmt(st.median, 3)}${sfx}</b></div></li>`;

    const diff = st.mean - st.median;
    const shape = st.sd === 0 || Math.abs(diff) < st.sd * 0.1
      ? 'The mean and median are very close, so the dots are fairly <strong>balanced</strong> (symmetric) — just like a bell curve.'
      : diff > 0
        ? 'The mean is bigger than the median, so a few high results are pulling the mean to the right (the data <strong>leans right</strong>).'
        : 'The mean is smaller than the median, so a few low results are pulling the mean to the left (the data <strong>leans left</strong>).';

    return `
      <p class="lead">The median is the <strong>middle</strong> result once everything is lined up in order.</p>
      <ol class="steps">
        <li><span class="step-title">Line up all ${fmt(n, 0)} results from smallest to largest</span>
          <div class="chips">${chipList(vals, { highlight: hl, positions, sfx })}</div></li>
        <li><span class="step-title">Find the middle position</span>
          <div class="eq">(${fmt(n, 0)} + 1) ÷ 2 = position <b>#${fmt((n + 1) / 2, 1)}</b></div></li>
        ${step3}
      </ol>
      <p class="rule-box">${shape}</p>`;
  }

  function explainSD(st, vals, sfx) {
    const n = st.n;
    const rows = vals.slice(0, Math.min(n, 6)).map(v => {
      const d = v - st.mean;
      return `<tr><td>${fmt(v)}${sfx}</td><td>${fmt(v)} − ${fmt(st.mean)} = ${fmt(d)}</td><td>${fmt(d * d)}</td></tr>`;
    }).join('');
    const more = n > 6 ? `<tr class="more"><td colspan="3">… and ${fmt(n - 6, 0)} more rows</td></tr>` : '';
    const pct = v => `${fmt(v * 100, 1)}%`;
    return `
      <p class="lead">The standard deviation is about how far a typical result is from the mean.</p>
      <ol class="steps">
        <li><span class="step-title">Find the mean</span>
          <div class="eq">Mean = <b>${fmt(st.mean, 3)}${sfx}</b></div></li>
        <li><span class="step-title">For every result, find its distance from the mean, then square it (multiply it by itself) so negatives don't cancel out positives</span>
          <div class="table-scroll"><table class="calc-table">
            <thead><tr><th>Result</th><th>Distance from mean</th><th>Distance squared</th></tr></thead>
            <tbody>${rows}${more}</tbody>
          </table></div></li>
        <li><span class="step-title">Add up all ${fmt(n, 0)} squared distances</span>
          <div class="eq">Total = <b>${fmt(st.ss)}</b></div></li>
        <li><span class="step-title">Divide by how many results there are. This is called the <em>variance</em>.</span>
          <div class="eq">${fmt(st.ss)} ÷ ${fmt(n, 0)} = <b>${fmt(st.variance, 3)}</b></div></li>
        <li><span class="step-title">Take the square root to get back to the original units</span>
          <div class="eq">√${fmt(st.variance, 3)} = <b>${fmt(st.sd, 3)}${sfx}</b></div></li>
      </ol>
      <div class="rule-box">
        <h3>The bell curve rule (68 – 95 – 99.7)</h3>
        <table>
          <thead><tr><th>Distance from the mean</th><th>Perfect bell curve</th><th>This simulation</th></tr></thead>
          <tbody>
            <tr><td>Within 1 SD (${fmt(st.mean - st.sd)} to ${fmt(st.mean + st.sd)})</td><td>about 68%</td><td><strong>${pct(st.within[0])}</strong></td></tr>
            <tr><td>Within 2 SD (${fmt(st.mean - 2 * st.sd)} to ${fmt(st.mean + 2 * st.sd)})</td><td>about 95%</td><td><strong>${pct(st.within[1])}</strong></td></tr>
            <tr><td>Within 3 SD (${fmt(st.mean - 3 * st.sd)} to ${fmt(st.mean + 3 * st.sd)})</td><td>about 99.7%</td><td><strong>${pct(st.within[2])}</strong></td></tr>
          </tbody>
        </table>
      </div>`;
  }

  $$('.how-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!isDone()) return;
      const vals = sim.values.slice(0, shown);
      const st = computeStats(vals);
      const kind = btn.dataset.explain;
      const titles = { mean: 'How the Mean was found', median: 'How the Median was found', sd: 'How the Standard Deviation was found' };
      $('#explainTitle').textContent = titles[kind];
      $('#explainBody').innerHTML =
        kind === 'mean' ? explainMean(st, vals, sim.suffix) :
        kind === 'median' ? explainMedian(st, sim.suffix) :
        explainSD(st, vals, sim.suffix);
      openModal(explainModal);
    });
  });

  updateRangeCard();
})();
