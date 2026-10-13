(() => {
  'use strict';

  const X_MAX = 30;
  const Y_MAX = 20;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const $ = (id) => document.getElementById(id);

  const svg = $('graph');
  const scene = $('scene');
  const hoverLayer = $('hoverLayer');
  const wrap = $('graphWrap');
  const toastEl = $('toast');

  const inputs = {
    yLabel: $('yLabel'),
    yUnits: $('yUnits'),
    xLabel: $('xLabel'),
    xUnits: $('xUnits'),
  };
  const coordsInput = $('coords');
  const coordsMsg = $('coordsMsg');
  const equationRow = $('equationRow');
  const equationEl = $('equation');

  const menu = $('pointMenu');
  const menuCoords = $('pointMenuCoords');

  const rocPanel = $('rocPanel');
  const rocHeader = $('rocHeader');
  const rocInstr = $('rocInstr');
  const rocP1 = $('rocP1');
  const rocP2 = $('rocP2');
  const rocResult = $('rocResult');

  const state = {
    points: [],            // {x, y}, always sorted by x, x values unique
    mode: 'none',          // 'fit' | 'connect' | 'none'
    roc: { open: false, p1: null, p2: null },
    menuPoint: null,
    coordsHasError: false,
  };

  let geom = null;         // layout of the plot area, set by render()
  let positionedPanel = false;

  /* ---------- helpers ---------- */

  function el(tag, attrs, parent, text) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    if (text != null) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }

  const round2 = (n) => {
    const r = Math.round(n * 100) / 100;
    return Object.is(r, -0) ? 0 : r;
  };

  // Plain number, safe to put back into the coordinates field.
  const num = (n) => String(round2(n));

  // Number for display, with a real minus sign.
  const mathNum = (n) => num(n).replace('-', '−');

  const pointText = (p) => `(${mathNum(p.x)}, ${mathNum(p.y)})`;

  const labelText = (k) => inputs[k].value.trim();

  function singular(word) {
    if (/ies$/i.test(word)) return word.slice(0, -3) + 'y';
    if (/[^s]s$/i.test(word)) return word.slice(0, -1);
    return word;
  }

  function rateUnits(rate) {
    let yU = labelText('yUnits');
    if (Math.abs(round2(rate)) === 1) yU = singular(yU);
    const xU = labelText('xUnits');
    if (yU && xU) return `${yU} per ${singular(xU)}`;
    if (yU) return yU;
    if (xU) return `per ${singular(xU)}`;
    return '';
  }

  const findPoint = (x) => state.points.find((p) => p.x === x) || null;
  const samePoint = (a, b) => a && b && a.x === b.x && a.y === b.y;

  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3200);
  }

  /* ---------- math ---------- */

  function bestFit() {
    const pts = state.points;
    const n = pts.length;
    if (n < 2) return null;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (const p of pts) {
      sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x;
    }
    const denom = n * sxx - sx * sx;
    if (denom === 0) return null;
    const m = (n * sxy - sx * sy) / denom;
    const b = (sy - m * sx) / n;
    return { m, b };
  }

  /* ---------- rendering ---------- */

  function render() {
    const W = wrap.clientWidth;
    const H = wrap.clientHeight;
    if (!W || !H) return;

    const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const tickFs = fs * 0.85;
    const labelFs = fs * 1.1;
    const ml = tickFs * 2 + labelFs * 2;
    const mb = tickFs * 1.7 + labelFs * 1.9;
    const mt = fs * 0.9;
    const mr = fs * 1.3;
    const pw = W - ml - mr;
    const ph = H - mt - mb;

    const sx = (x) => ml + (x / X_MAX) * pw;
    const sy = (y) => mt + ph - (y / Y_MAX) * ph;
    geom = { ml, mt, pw, ph, fs, sx, sy };

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    scene.replaceChildren();

    const defs = el('defs', {}, scene);
    const clip = el('clipPath', { id: 'plotClip' }, defs);
    el('rect', { x: ml, y: mt, width: pw, height: ph }, clip);

    // Grid
    const grid = el('g', {}, scene);
    for (let x = 1; x <= X_MAX; x++) {
      el('line', {
        class: x % 5 === 0 ? 'grid-major' : 'grid-minor',
        x1: sx(x), y1: sy(0), x2: sx(x), y2: sy(Y_MAX),
      }, grid);
    }
    for (let y = 1; y <= Y_MAX; y++) {
      el('line', {
        class: y % 5 === 0 ? 'grid-major' : 'grid-minor',
        x1: sx(0), y1: sy(y), x2: sx(X_MAX), y2: sy(y),
      }, grid);
    }

    // Axes
    el('line', { class: 'axis', x1: sx(0), y1: sy(0), x2: sx(X_MAX), y2: sy(0) }, scene);
    el('line', { class: 'axis', x1: sx(0), y1: sy(0), x2: sx(0), y2: sy(Y_MAX) }, scene);

    // Tick numbers — skip some when the screen is too small to fit them all
    const xStep = [1, 2, 5, 10].find((s) => s * (pw / X_MAX) >= tickFs * 1.9) || 10;
    const yStep = [1, 2, 5, 10].find((s) => s * (ph / Y_MAX) >= tickFs * 1.25) || 10;
    for (let x = 0; x <= X_MAX; x += xStep) {
      el('text', {
        class: 'tick-label', x: sx(x), y: sy(0) + tickFs * 0.45,
        'font-size': tickFs, 'text-anchor': 'middle', 'dominant-baseline': 'hanging',
      }, scene, x);
    }
    for (let y = yStep; y <= Y_MAX; y += yStep) {
      el('text', {
        class: 'tick-label', x: sx(0) - tickFs * 0.5, y: sy(y),
        'font-size': tickFs, 'text-anchor': 'end', 'dominant-baseline': 'central',
      }, scene, y);
    }

    // Axis labels
    drawAxisLabel('x', ml + pw / 2, mt + ph + tickFs * 1.7 + labelFs * 1.15, labelFs, 0);
    drawAxisLabel('y', labelFs * 0.85, mt + ph / 2, labelFs, -90);

    // Connect the dots / line of best fit
    const fit = state.mode === 'fit' ? bestFit() : null;
    const series = el('g', { 'clip-path': 'url(#plotClip)' }, scene);
    if (state.mode === 'connect' && state.points.length > 1) {
      el('polyline', {
        class: 'series-connect',
        points: state.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' '),
      }, series);
    }
    if (fit) {
      el('line', {
        class: 'series-fit',
        x1: sx(0), y1: sy(fit.b), x2: sx(X_MAX), y2: sy(fit.m * X_MAX + fit.b),
      }, series);
    }

    drawRocOverlay();
    drawIntercepts(fit);

    // Points (drawn last so they stay clickable)
    for (const p of state.points) {
      const g = el('g', { class: 'pt', 'data-x': p.x }, scene);
      el('title', {}, g, pointText(p));
      el('circle', { class: 'pt-dot', cx: sx(p.x), cy: sy(p.y), r: fs * 0.42 }, g);
      el('circle', { class: 'pt-hit', cx: sx(p.x), cy: sy(p.y), r: Math.max(fs * 0.95, 18) }, g);
    }
  }

  function drawAxisLabel(axis, x, y, size, rotate) {
    const label = labelText(axis === 'x' ? 'xLabel' : 'yLabel');
    const units = labelText(axis === 'x' ? 'xUnits' : 'yUnits');
    let text = label || axis;
    if (units) text += ` (${units})`;
    el('text', {
      class: 'axis-label' + (label || units ? '' : ' placeholder'),
      x, y,
      'font-size': size,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      transform: rotate ? `rotate(${rotate} ${x} ${y})` : '',
    }, scene, text);
  }

  function drawRocOverlay() {
    const { p1, p2, open } = state.roc;
    if (!open) return;
    const { sx, sy, fs } = geom;
    const g = el('g', { 'pointer-events': 'none' }, scene);

    if (p1 && p2) {
      const cx = sx(p2.x);
      const cy = sy(p1.y);
      const run = p2.x - p1.x;
      const rise = p2.y - p1.y;
      el('line', { class: 'roc-leg', x1: sx(p1.x), y1: cy, x2: cx, y2: cy }, g);
      el('line', { class: 'roc-leg', x1: cx, y1: cy, x2: cx, y2: sy(p2.y) }, g);

      // Dashed line joining the two points, on a white casing so it stays
      // visible even when it lies right on top of the best-fit / connect line
      const seg = { x1: sx(p1.x), y1: sy(p1.y), x2: cx, y2: sy(p2.y) };
      el('line', { class: 'roc-connect-casing', ...seg }, g);
      el('line', { class: 'roc-connect', ...seg }, g);

      const legFs = fs * 0.85;
      // Run label sits on the side of the horizontal leg away from the triangle
      const runBelow = rise >= 0;
      el('text', {
        class: 'roc-leg-label halo', 'font-size': legFs,
        x: (sx(p1.x) + cx) / 2, y: cy + (runBelow ? legFs * 1.1 : -legFs * 0.6),
        'text-anchor': 'middle', 'dominant-baseline': runBelow ? 'hanging' : 'auto',
      }, g, `run = ${mathNum(run)}`);
      // Rise label sits on the side of the vertical leg away from the triangle
      const riseRight = run > 0;
      el('text', {
        class: 'roc-leg-label halo', 'font-size': legFs,
        x: cx + (riseRight ? legFs * 0.6 : -legFs * 0.6), y: (cy + sy(p2.y)) / 2,
        'text-anchor': riseRight ? 'start' : 'end', 'dominant-baseline': 'central',
      }, g, `rise = ${mathNum(rise)}`);
    }

    [p1, p2].forEach((p, i) => {
      if (!p) return;
      el('circle', { class: 'roc-ring', cx: sx(p.x), cy: sy(p.y), r: fs * 0.8 }, g);
      el('text', {
        class: 'roc-num halo', 'font-size': fs * 0.85,
        x: sx(p.x) - fs * 0.85, y: sy(p.y) - fs * 0.85,
        'text-anchor': 'end',
      }, g, i + 1);
    });
  }

  function drawIntercepts(fit) {
    const { sx, sy, fs } = geom;
    const userZero = findPoint(0);
    const fitOnGraph = fit && fit.b >= 0 && fit.b <= Y_MAX;

    const labels = [];
    if (fitOnGraph) labels.push({ y: fit.b, marker: true });
    if (userZero && !(fitOnGraph && Math.abs(userZero.y - fit.b) < 0.005)) {
      labels.push({ y: userZero.y, marker: false });
    }

    // Two labels close together: stack one above the other
    let places = labels.map(() => 'center');
    if (labels.length === 2 && Math.abs(labels[0].y - labels[1].y) < 3) {
      places = labels[0].y >= labels[1].y ? ['above', 'below'] : ['below', 'above'];
    }

    labels.forEach((lab, i) => {
      const px = sx(0);
      const py = sy(lab.y);
      if (lab.marker) {
        const r = fs * 0.5;
        el('rect', {
          class: 'intercept-marker',
          x: px - r, y: py - r, width: r * 2, height: r * 2,
          transform: `rotate(45 ${px} ${py})`,
        }, scene);
      } else {
        el('circle', { class: 'intercept-ring', cx: px, cy: py, r: fs * 0.75 }, scene);
      }
      drawInterceptLabel(px, py, places[i]);
    });
  }

  function drawInterceptLabel(px, py, place) {
    const { fs, mt, ph } = geom;
    const units = labelText('xUnits');
    const pad = fs * 0.35;
    const gap = fs * 0.35;
    const lx = px + fs * 1.2;

    const leader = el('line', { class: 'intercept-leader' }, scene);
    const g = el('g', { class: 'intercept-label' }, scene);
    const box = el('rect', { class: 'intercept-box', rx: 6 }, g);
    const text = el('text', { class: 'intercept-text', x: 0, y: 0, 'font-size': fs * 0.9 }, g);
    el('tspan', { x: 0, 'font-weight': 700 }, text, 'y intercept');
    el('tspan', { x: 0, dy: '1.2em' }, text, units ? `0 ${units}` : '0');

    const bb = text.getBBox();
    const w = bb.width + pad * 2;
    const h = bb.height + pad * 2;
    box.setAttribute('x', bb.x - pad);
    box.setAttribute('y', bb.y - pad);
    box.setAttribute('width', w);
    box.setAttribute('height', h);

    let top = place === 'above' ? py - h - gap
      : place === 'below' ? py + gap
      : py - h / 2;
    top = Math.max(mt, Math.min(mt + ph - h, top));
    g.setAttribute('transform', `translate(${lx - (bb.x - pad)} ${top - (bb.y - pad)})`);

    leader.setAttribute('x1', px);
    leader.setAttribute('y1', py);
    leader.setAttribute('x2', lx);
    leader.setAttribute('y2', top + h / 2);
  }

  function renderEquation() {
    if (state.mode !== 'fit') {
      equationRow.hidden = true;
      return;
    }
    equationRow.hidden = false;
    const fit = bestFit();
    if (!fit) {
      equationEl.className = 'equation empty';
      equationEl.textContent = 'Add at least 2 points to see the line of best fit.';
      return;
    }
    equationEl.className = 'equation';

    const m = round2(fit.m);
    const b = round2(fit.b);
    let rhs;
    if (m === 0) rhs = mathNum(b);
    else {
      const slope = m === 1 ? '' : m === -1 ? '−' : mathNum(m);
      rhs = `${slope}<i>x</i>`;
      if (b > 0) rhs += ` + ${mathNum(b)}`;
      else if (b < 0) rhs += ` − ${mathNum(-b)}`;
    }

    let html = `<span class="eq-label">Line of best fit:</span>`
      + `<span class="math"><i>y</i> = ${rhs}</span>`;
    if (fit.b < 0 || fit.b > Y_MAX) {
      html += `<span class="note">The y intercept (${mathNum(b)}) is off the visible graph.</span>`;
    }
    equationEl.innerHTML = html;
  }

  function renderRoc() {
    const { open, p1, p2 } = state.roc;
    rocPanel.hidden = !open;
    if (!open) return;

    rocP1.textContent = p1 ? pointText(p1) : '—';
    rocP2.textContent = p2 ? pointText(p2) : '—';

    if (state.points.length < 2 && !p1) {
      rocInstr.textContent = 'Add at least 2 points to the graph, then select a point.';
    } else if (!p1) {
      rocInstr.textContent = 'Select a point on the graph.';
    } else if (!p2) {
      rocInstr.textContent = 'Now choose another point.';
    } else {
      rocInstr.textContent = 'Select any point to start again.';
    }

    rocResult.replaceChildren();
    rocResult.hidden = !(p1 && p2);
    if (!(p1 && p2)) return;

    const rise = p2.y - p1.y;
    const run = p2.x - p1.x;
    const rate = rise / run;

    const h2 = document.createElement('h2');
    h2.textContent = 'Rate of change';
    rocResult.appendChild(h2);

    rocResult.appendChild(calcLine('', 'change in y', 'change in x'));
    rocResult.appendChild(calcLine('=',
      `${mathNum(p2.y)} − ${mathNum(p1.y)}`,
      `${mathNum(p2.x)} − ${mathNum(p1.x)}`));
    rocResult.appendChild(calcLine('=', mathNum(rise), mathNum(run)));

    const answer = document.createElement('p');
    answer.className = 'roc-answer';
    answer.textContent = `= ${mathNum(rate)} `;
    const units = rateUnits(rate);
    if (units) {
      const u = document.createElement('span');
      u.className = 'units';
      u.textContent = units;
      answer.appendChild(u);
    }
    rocResult.appendChild(answer);
  }

  function calcLine(prefix, top, bottom) {
    const line = document.createElement('div');
    line.className = 'calc-line';
    if (prefix) line.append(prefix);
    const frac = document.createElement('span');
    frac.className = 'frac';
    const t = document.createElement('span');
    const b = document.createElement('span');
    t.textContent = top;
    b.textContent = bottom;
    frac.append(t, b);
    line.appendChild(frac);
    return line;
  }

  function update() {
    // Drop rate-of-change selections whose points no longer exist
    const roc = state.roc;
    if (roc.p1 && !samePoint(findPoint(roc.p1.x), roc.p1)) { roc.p1 = null; roc.p2 = null; }
    if (roc.p2 && !samePoint(findPoint(roc.p2.x), roc.p2)) { roc.p2 = null; }
    render();
    renderEquation();
    renderRoc();
  }

  /* ---------- points & coordinates field ---------- */

  function syncCoordsField() {
    coordsInput.value = state.points.map((p) => `(${num(p.x)}, ${num(p.y)})`).join(', ');
    setCoordsError('');
  }

  function setCoordsError(msg) {
    state.coordsHasError = !!msg;
    coordsMsg.textContent = msg;
    coordsInput.classList.toggle('has-error', !!msg);
  }

  function addPoint(x, y) {
    if (findPoint(x)) {
      toast(`There is already a point at x = ${x}. Each x value can only be used once.`);
      return;
    }
    state.points.push({ x, y });
    state.points.sort((a, b) => a.x - b.x);
    syncCoordsField();
    update();
  }

  function deletePoint(p) {
    state.points = state.points.filter((q) => q.x !== p.x);
    syncCoordsField();
    update();
  }

  function parseCoords(text) {
    const re = /\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)/g;
    const pts = [];
    const errors = [];
    const seen = new Set();
    for (const m of text.matchAll(re)) {
      const x = Number(m[1]);
      const y = Number(m[2]);
      if (x < 0 || x > X_MAX || y < 0 || y > Y_MAX) {
        errors.push(`(${m[1]}, ${m[2]}) is off the graph. x must be 0–${X_MAX} and y must be 0–${Y_MAX}.`);
        continue;
      }
      if (seen.has(x)) {
        errors.push(`x = ${m[1]} is used more than once. Each x value can only be used once.`);
        continue;
      }
      seen.add(x);
      pts.push({ x, y });
    }
    pts.sort((a, b) => a.x - b.x);
    return { pts, errors };
  }

  coordsInput.addEventListener('input', () => {
    const { pts, errors } = parseCoords(coordsInput.value);
    state.points = pts;
    setCoordsError(errors[0] || '');
    closeMenu();
    update();
  });

  coordsInput.addEventListener('blur', () => {
    if (!state.coordsHasError) syncCoordsField();
  });

  coordsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') coordsInput.blur();
  });

  /* ---------- graph interaction ---------- */

  function toData(e) {
    if (!geom) return null;
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const x = ((px - geom.ml) / geom.pw) * X_MAX;
    const y = ((geom.mt + geom.ph - py) / geom.ph) * Y_MAX;
    if (x < -0.5 || x > X_MAX + 0.5 || y < -0.5 || y > Y_MAX + 0.5) return null;
    return {
      x: Math.min(X_MAX, Math.max(0, Math.round(x))),
      y: Math.min(Y_MAX, Math.max(0, Math.round(y))),
    };
  }

  svg.addEventListener('click', (e) => {
    const g = e.target.closest('[data-x]');
    if (g) {
      const p = findPoint(Number(g.dataset.x));
      if (p) onPointClick(p);
      return;
    }
    if (!menu.hidden) { closeMenu(); return; }
    const d = toData(e);
    if (d) addPoint(d.x, d.y);
  });

  svg.addEventListener('pointermove', (e) => {
    hoverLayer.replaceChildren();
    if (e.pointerType === 'touch' || e.target.closest('[data-x]') || !menu.hidden) return;
    const d = toData(e);
    if (!d) return;
    const { sx, sy, fs } = geom;
    const blocked = !!findPoint(d.x);
    const cls = blocked ? ' blocked' : '';
    el('circle', { class: 'ghost-dot' + cls, cx: sx(d.x), cy: sy(d.y), r: fs * 0.42 }, hoverLayer);
    const nearRight = d.x > X_MAX - 4;
    const nearTop = d.y > Y_MAX - 2;
    el('text', {
      class: 'ghost-text halo' + cls, 'font-size': fs * 0.85,
      x: sx(d.x) + (nearRight ? -fs * 0.7 : fs * 0.7),
      y: sy(d.y) + (nearTop ? fs * 1.1 : -fs * 0.6),
      'text-anchor': nearRight ? 'end' : 'start',
    }, hoverLayer, blocked ? `x = ${d.x} is taken` : `(${d.x}, ${d.y})`);
  });

  svg.addEventListener('pointerleave', () => hoverLayer.replaceChildren());

  function onPointClick(p) {
    if (state.roc.open) {
      rocSelect(p);
      return;
    }
    openMenu(p);
  }

  /* ---------- point menu ---------- */

  function openMenu(p) {
    state.menuPoint = p;
    hoverLayer.replaceChildren();
    menuCoords.textContent = pointText(p);
    menu.hidden = false;
    const { sx, sy, fs } = geom;
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let left = sx(p.x) + fs * 1.2;
    if (left + mw > wrap.clientWidth - 8) left = sx(p.x) - fs * 1.2 - mw;
    let top = sy(p.y) - mh / 2;
    top = Math.max(8, Math.min(wrap.clientHeight - mh - 8, top));
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${top}px`;
    $('menuRoc').focus();
  }

  function closeMenu() {
    menu.hidden = true;
    state.menuPoint = null;
  }

  $('menuDelete').addEventListener('click', () => {
    const p = state.menuPoint;
    closeMenu();
    if (p) deletePoint(p);
  });

  $('menuRoc').addEventListener('click', () => {
    const p = state.menuPoint;
    closeMenu();
    openRoc(p);
  });

  $('menuCancel').addEventListener('click', closeMenu);

  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !svg.contains(e.target)) closeMenu();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!menu.hidden) closeMenu();
      else if (state.roc.open) closeRoc();
    }
  });

  /* ---------- rate of change tool ---------- */

  function openRoc(p1) {
    state.roc.open = true;
    state.roc.p1 = p1 || null;
    state.roc.p2 = null;
    closeMenu();
    rocPanel.hidden = false;
    if (!positionedPanel) {
      const w = rocPanel.offsetWidth;
      rocPanel.style.left = `${Math.max(8, window.innerWidth - w - 32)}px`;
      rocPanel.style.top = `${wrap.getBoundingClientRect().top + 16}px`;
      positionedPanel = true;
    }
    keepPanelOnScreen();
    update();
  }

  function closeRoc() {
    state.roc = { open: false, p1: null, p2: null };
    update();
  }

  function rocSelect(p) {
    const roc = state.roc;
    if (!roc.p1 || roc.p2) {
      roc.p1 = p;
      roc.p2 = null;
    } else if (samePoint(roc.p1, p)) {
      toast('Choose a different point for Point 2.');
      return;
    } else {
      roc.p2 = p;
    }
    update();
  }

  $('rocBtn').addEventListener('click', () => openRoc(null));
  $('rocClose').addEventListener('click', closeRoc);

  // Dragging the panel by its header
  let drag = null;
  rocHeader.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = rocPanel.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    rocHeader.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  rocHeader.addEventListener('pointermove', (e) => {
    if (!drag) return;
    movePanel(e.clientX - drag.dx, e.clientY - drag.dy);
  });
  const endDrag = () => { drag = null; };
  rocHeader.addEventListener('pointerup', endDrag);
  rocHeader.addEventListener('pointercancel', endDrag);

  function movePanel(left, top) {
    const maxLeft = window.innerWidth - rocPanel.offsetWidth;
    const maxTop = window.innerHeight - rocHeader.offsetHeight;
    rocPanel.style.left = `${Math.max(0, Math.min(maxLeft, left))}px`;
    rocPanel.style.top = `${Math.max(0, Math.min(maxTop, top))}px`;
  }

  function keepPanelOnScreen() {
    if (rocPanel.hidden) return;
    movePanel(parseFloat(rocPanel.style.left) || 0, parseFloat(rocPanel.style.top) || 0);
  }

  /* ---------- other controls ---------- */

  Object.values(inputs).forEach((input) => input.addEventListener('input', update));

  document.querySelectorAll('input[name="mode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        state.mode = radio.value;
        update();
      }
    });
  });

  $('clearBtn').addEventListener('click', () => {
    state.points = [];
    state.roc.p1 = null;
    state.roc.p2 = null;
    closeMenu();
    syncCoordsField();
    update();
  });

  new ResizeObserver(() => {
    closeMenu();
    render();
  }).observe(wrap);

  window.addEventListener('resize', keepPanelOnScreen);

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);

  state.mode = document.querySelector('input[name="mode"]:checked').value;
  update();
})();
