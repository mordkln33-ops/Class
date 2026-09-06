/* ============================================================
   Graphing Explorer — Algebra 1
   Interactive coordinate plane, point plotting, line building,
   slope-intercept equations and tables of values.
   ============================================================ */
'use strict';

/* ------------------------------------------------------------
   1. Constants & coordinate conversion
   ------------------------------------------------------------ */

const MIN = -10;              // smallest x / y shown
const MAX = 10;               // largest x / y shown
const UNIT = 30;              // svg units per 1 graph unit
const PAD = 44;               // room around the plot for numbers
const SIZE = (MAX - MIN) * UNIT + PAD * 2;
const OX = PAD + (0 - MIN) * UNIT;   // svg x of the origin
const OY = PAD + (MAX - 0) * UNIT;   // svg y of the origin
const NS = 'http://www.w3.org/2000/svg';
const CARD_GAP = 14;          // must match --card-gap in styles.css
const HOVER_TOL = 12;         // px (svg units) tolerance for hovering a line

const COLORS = [
  '#2563eb', '#e11d48', '#0d9488', '#d97706',
  '#7c3aed', '#0891b2', '#65a30d', '#c026d3'
];

const toPx = x => OX + x * UNIT;          // graph x -> svg x
const toPy = y => OY - y * UNIT;          // graph y -> svg y
const toUx = p => (p - OX) / UNIT;        // svg x -> graph x
const toUy = p => (OY - p) / UNIT;        // svg y -> graph y
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------
   2. Application state
   ------------------------------------------------------------ */

/** points: { id, x, y, lineId }  — lineId is null when the point is "free" */
let points = [];
/** lines: { id, name, color, kind:'points'|'equation', p1, p2, vertical, m, b, xVal } */
let lines = [];

let nextPointId = 1;
let nextLineId = 1;
let colorCursor = 0;

let selectedPointId = null;   // point showing its Delete button
let justLandedId = null;      // point that just finished the plotting animation
let travel = null;            // active "walk to the point" animation
let drag = null;              // active drag session
let hover = null;             // { lineId, x, y }
let page = 0;                 // carousel page
let suppressNextClick = false;// stops a drag/point-click from also plotting a point
const declinedPairs = new Set();

/* ------------------------------------------------------------
   3. DOM references
   ------------------------------------------------------------ */

const svg           = document.getElementById('graph');
const overlay       = document.getElementById('overlay');
const cardsViewport = document.getElementById('cardsViewport');
const cardsTrack    = document.getElementById('cardsTrack');
const carouselNav   = document.getElementById('carouselNav');
const pageDots      = document.getElementById('pageDots');
const prevPageBtn   = document.getElementById('prevPage');
const nextPageBtn   = document.getElementById('nextPage');
const linesEmpty    = document.getElementById('linesEmpty');
const pointsField   = document.getElementById('pointsField');
const pointsCount   = document.getElementById('pointsCount');
const eqForm        = document.getElementById('eqForm');
const eqInput       = document.getElementById('eqInput');
const eqError       = document.getElementById('eqError');
const ptForm        = document.getElementById('ptForm');
const ptInput       = document.getElementById('ptInput');
const ptError       = document.getElementById('ptError');
const ptBtn         = document.getElementById('ptBtn');
const modalRoot     = document.getElementById('modalRoot');

let linesLayer, hoverLayer, pointsLayer, animLayer;   // svg groups
let actionLayer, tipLayer;                 // html overlay layers
let actionKey = '';                        // what the action layer currently shows

/* ------------------------------------------------------------
   4. Number formatting helpers
   ------------------------------------------------------------ */

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }

/** Turn a number into the friendliest string: 3, -1/2, 2.25 ... */
function niceNumber(v) {
  if (!isFinite(v)) return '?';
  if (Math.abs(v) < 1e-9) return '0';
  if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  for (let d = 2; d <= 32; d++) {
    const n = Math.round(a * d);
    if (Math.abs(n / d - a) < 1e-9) {
      const g = gcd(n, d);
      return sign + (n / g) + '/' + (d / g);
    }
  }
  return (Math.round(v * 100) / 100).toString();
}

/** "y = 2x + 1", "y = -x", "y = 3", "x = -4" */
function formatEquation(line) {
  if (line.vertical) return 'x = ' + niceNumber(line.xVal);
  const m = line.m, b = line.b;
  let slopePart;
  if (Math.abs(m) < 1e-9) slopePart = '';
  else if (Math.abs(m - 1) < 1e-9) slopePart = 'x';
  else if (Math.abs(m + 1) < 1e-9) slopePart = '-x';
  else slopePart = niceNumber(m) + 'x';

  let intPart;
  if (Math.abs(b) < 1e-9) intPart = slopePart === '' ? '0' : '';
  else if (slopePart === '') intPart = niceNumber(b);
  else intPart = (b > 0 ? ' + ' : ' − ') + niceNumber(Math.abs(b));

  return 'y = ' + slopePart + intPart;
}

const pairKey = (a, b) => {
  const k1 = a.x + ',' + a.y, k2 = b.x + ',' + b.y;
  return k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
};

/* ------------------------------------------------------------
   5. Build the static graph (grid, axes, numbers)
   ------------------------------------------------------------ */

function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
}

function buildGraph() {
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.innerHTML = '';

  const defs = svgEl('defs', {}, svg);

  // clip so lines stop exactly at the edge of the plot
  const clip = svgEl('clipPath', { id: 'plotClip' }, defs);
  svgEl('rect', {
    x: toPx(MIN), y: toPy(MAX),
    width: (MAX - MIN) * UNIT, height: (MAX - MIN) * UNIT
  }, clip);

  const marker = svgEl('marker', {
    id: 'arrowHead', viewBox: '0 0 10 10', refX: 9, refY: 5,
    markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse'
  }, defs);
  svgEl('path', { d: 'M0,0 L10,5 L0,10 Z', fill: '#334155' }, marker);

  // --- grid ---
  const grid = svgEl('g', {}, svg);
  for (let i = MIN; i <= MAX; i++) {
    const cls = 'grid-line' + (i % 5 === 0 ? ' five' : '');
    svgEl('line', { class: cls, x1: toPx(i), y1: toPy(MAX), x2: toPx(i), y2: toPy(MIN) }, grid);
    svgEl('line', { class: cls, x1: toPx(MIN), y1: toPy(i), x2: toPx(MAX), y2: toPy(i) }, grid);
  }
  svgEl('rect', {
    class: 'plot-frame', x: toPx(MIN), y: toPy(MAX),
    width: (MAX - MIN) * UNIT, height: (MAX - MIN) * UNIT
  }, svg);

  // --- axes with arrows on both ends ---
  const axes = svgEl('g', {}, svg);
  svgEl('line', {
    class: 'axis', x1: toPx(MIN) - 16, y1: toPy(0), x2: toPx(MAX) + 16, y2: toPy(0),
    'marker-start': 'url(#arrowHead)', 'marker-end': 'url(#arrowHead)'
  }, axes);
  svgEl('line', {
    class: 'axis', x1: toPx(0), y1: toPy(MAX) + 16, x2: toPx(0), y2: toPy(MIN) - 16,
    'marker-start': 'url(#arrowHead)', 'marker-end': 'url(#arrowHead)'
  }, axes);

  // --- axis numbers ---
  const nums = svgEl('g', {}, svg);
  for (let i = MIN; i <= MAX; i++) {
    if (i === 0) continue;
    const xt = svgEl('text', {
      class: 'axis-num', x: toPx(i), y: toPy(0) + 15, 'text-anchor': 'middle'
    }, nums);
    xt.textContent = i;
    const yt = svgEl('text', {
      class: 'axis-num', x: toPx(0) - 8, y: toPy(i) + 4, 'text-anchor': 'end'
    }, nums);
    yt.textContent = i;
  }
  const zero = svgEl('text', {
    class: 'axis-num', x: toPx(0) - 8, y: toPy(0) + 15, 'text-anchor': 'end'
  }, nums);
  zero.textContent = '0';

  const xName = svgEl('text', { class: 'axis-name', x: toPx(MAX) + 22, y: toPy(0) + 5 }, nums);
  xName.textContent = 'x';
  const yName = svgEl('text', { class: 'axis-name', x: toPx(0) + 9, y: toPy(MAX) - 16 }, nums);
  yName.textContent = 'y';

  // --- dynamic layers (order matters: lines under points) ---
  linesLayer  = svgEl('g', { 'clip-path': 'url(#plotClip)' }, svg);
  hoverLayer  = svgEl('g', { 'clip-path': 'url(#plotClip)' }, svg);
  pointsLayer = svgEl('g', {}, svg);
  animLayer   = svgEl('g', { 'pointer-events': 'none' }, svg);  // always on top
}

/* ------------------------------------------------------------
   6. Line maths
   ------------------------------------------------------------ */

/** Recalculate slope / intercept for a line that is defined by two points. */
function recomputeLine(line) {
  if (line.kind !== 'points') return;
  const a = points.find(p => p.id === line.p1);
  const b = points.find(p => p.id === line.p2);
  if (!a || !b) return;
  if (a.x === b.x) {
    line.vertical = true;
    line.xVal = a.x;
    line.m = Infinity;
    line.b = NaN;
  } else {
    line.vertical = false;
    line.m = (b.y - a.y) / (b.x - a.x);
    line.b = a.y - line.m * a.x;
  }
}

function yAt(line, x) { return line.m * x + line.b; }

/** True when no part of the line falls inside the visible window. */
function isOffGrid(line) {
  if (line.vertical) return Math.abs(line.xVal) > MAX;
  const a = yAt(line, MIN), b = yAt(line, MAX);
  return (a > MAX && b > MAX) || (a < MIN && b < MIN);
}

/** Distance in svg units from an svg point to an (infinite) line. */
function distanceToLine(line, sx, sy) {
  if (line.vertical) return Math.abs(sx - toPx(line.xVal));
  const x1 = toPx(MIN), y1 = toPy(yAt(line, MIN));
  const x2 = toPx(MAX), y2 = toPy(yAt(line, MAX));
  const dx = x2 - x1, dy = y2 - y1;
  return Math.abs(dy * sx - dx * sy + x2 * y1 - y2 * x1) / Math.hypot(dx, dy);
}

/* ------------------------------------------------------------
   7. Rendering — graph
   ------------------------------------------------------------ */

function renderGraph() {
  renderLinesOnGraph();
  renderPointsOnGraph();
  renderOverlay();
}

function renderLinesOnGraph() {
  linesLayer.innerHTML = '';
  lines.forEach(line => {
    let x1, y1, x2, y2;
    if (line.vertical) {
      x1 = x2 = toPx(line.xVal);
      y1 = toPy(MAX + 2); y2 = toPy(MIN - 2);
    } else {
      x1 = toPx(MIN - 3); y1 = toPy(yAt(line, MIN - 3));
      x2 = toPx(MAX + 3); y2 = toPy(yAt(line, MAX + 3));
    }
    svgEl('line', { class: 'line-path', x1, y1, x2, y2, stroke: line.color }, linesLayer);

    // small name tag placed where the line is comfortably inside the plot
    const spot = tagSpot(line);
    if (spot) {
      const t = svgEl('text', {
        class: 'line-tag', x: toPx(spot.x), y: toPy(spot.y) - 9,
        fill: line.color, 'text-anchor': spot.anchor
      }, linesLayer);
      t.textContent = line.name;
    }
  });
}

function tagSpot(line) {
  if (line.vertical) {
    return Math.abs(line.xVal) <= MAX ? { x: line.xVal, y: MAX - 0.6, anchor: 'middle' } : null;
  }
  for (let x = MAX - 0.6; x >= MIN; x -= 0.5) {
    const y = yAt(line, x);
    if (y <= MAX - 0.5 && y >= MIN + 0.3) {
      return { x, y, anchor: x > MAX - 1.5 ? 'end' : 'middle' };
    }
  }
  return null;
}

function renderPointsOnGraph() {
  pointsLayer.innerHTML = '';
  points.forEach(p => {
    const line = lines.find(l => l.id === p.lineId);
    const color = line ? line.color : '#0f172a';
    const cls = 'point' + (p.id === selectedPointId ? ' selected' : '')
      + (drag && drag.id === p.id ? ' dragging' : '')
      + (p.id === justLandedId ? ' just-landed' : '');

    const g = svgEl('g', { class: cls, 'data-id': p.id }, pointsLayer);
    svgEl('circle', { class: 'point-ring', cx: toPx(p.x), cy: toPy(p.y), r: 13, stroke: color }, g);
    // transparent disc so the whole area around the dot is grabbable
    svgEl('circle', { class: 'point-hit', cx: toPx(p.x), cy: toPy(p.y), r: 13 }, g);
    svgEl('circle', { class: 'point-dot', cx: toPx(p.x), cy: toPy(p.y), r: 7, fill: color }, g);

    // Label placement: keep it off the axes / edges so nothing is hidden.
    const right = p.x <= MAX - 3;
    const up = p.y <= MAX - 1;
    const label = svgEl('text', {
      class: 'point-label',
      x: toPx(p.x) + (right ? 13 : -13),
      y: toPy(p.y) + (up ? -12 : 22),
      'text-anchor': right ? 'start' : 'end',
      fill: color
    }, g);
    label.textContent = `(${p.x}, ${p.y})`;

    g.addEventListener('pointerdown', onPointPointerDown);
  });
}

/* ------------------------------------------------------------
   8. Rendering — HTML overlay (delete button + hover read-out)
   ------------------------------------------------------------ */

function svgToOverlay(sx, sy) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const pt = svg.createSVGPoint();
  pt.x = sx; pt.y = sy;
  const scr = pt.matrixTransform(ctm);
  const box = overlay.getBoundingClientRect();
  return { x: scr.x - box.left, y: scr.y - box.top };
}

function initOverlay() {
  overlay.innerHTML = '';
  actionLayer = document.createElement('div');
  actionLayer.className = 'overlay-layer';
  tipLayer = document.createElement('div');
  tipLayer.className = 'overlay-layer tips';
  overlay.append(actionLayer, tipLayer);
}

/**
 * The delete button is only rebuilt when the selection actually changes, so it
 * does not flicker while the mouse moves around the graph.
 */
function renderOverlay(force) {
  const sel = points.find(p => p.id === selectedPointId);
  const showAction = sel && !drag;
  const key = showAction ? `${sel.id}:${sel.x},${sel.y}` : '';

  if (key !== actionKey || force) {
    actionKey = key;
    actionLayer.innerHTML = '';
    if (showAction) {
      const pos = svgToOverlay(toPx(sel.x), toPy(sel.y) - 16);
      const btn = document.createElement('button');
      btn.className = 'point-action';
      btn.type = 'button';
      btn.innerHTML = '<span aria-hidden="true">🗑</span> Delete point';
      btn.style.left = pos.x + 'px';
      btn.style.top = pos.y + 'px';
      // The button lives outside the <svg>, so its click never reaches the graph.
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        deletePoint(sel.id);
      });
      actionLayer.appendChild(btn);
    }
  }

  // Hover read-out beside the cursor
  tipLayer.innerHTML = '';
  if (hover) {
    const line = lines.find(l => l.id === hover.lineId);
    if (line) {
      const tip = document.createElement('div');
      tip.className = 'hover-tip' + (hover.cursorX > overlay.clientWidth - 150 ? ' flip' : '');
      tip.style.left = hover.cursorX + 'px';
      tip.style.top = hover.cursorY + 'px';
      tip.style.background = line.color;
      tip.innerHTML = `<span class="tip-name">${line.name}</span>(${niceNumber(hover.x)}, ${niceNumber(hover.y)})`;
      tipLayer.appendChild(tip);
    }
  }
}

function renderHoverMarker() {
  hoverLayer.innerHTML = '';
  if (!hover) return;
  const line = lines.find(l => l.id === hover.lineId);
  if (!line) return;
  const cx = toPx(hover.x), cy = toPy(hover.y);
  svgEl('line', {
    class: 'hover-guide', x1: cx, y1: cy, x2: cx, y2: toPy(0), stroke: line.color
  }, hoverLayer);
  svgEl('line', {
    class: 'hover-guide', x1: cx, y1: cy, x2: toPx(0), y2: cy, stroke: line.color
  }, hoverLayer);
  svgEl('circle', { class: 'hover-dot', cx, cy, r: 6, stroke: line.color }, hoverLayer);
}

/* ------------------------------------------------------------
   9. Rendering — equation cards, tables, carousel
   ------------------------------------------------------------ */

const cardsPerPage = () => (lines.length <= 1 ? 1 : 2);
const pageCount = () => Math.max(1, Math.ceil(lines.length / 2));

function renderCards() {
  const has = lines.length > 0;
  linesEmpty.hidden = has;
  cardsViewport.hidden = !has;
  carouselNav.hidden = lines.length <= 2;

  cardsTrack.innerHTML = '';
  cardsTrack.classList.toggle('single', lines.length === 1);

  lines.forEach(line => cardsTrack.appendChild(buildCard(line)));

  page = clamp(page, 0, pageCount() - 1);
  renderDots();
  applyPageOffset();
}

function buildCard(line) {
  const card = document.createElement('article');
  card.className = 'line-card';
  card.dataset.lineId = line.id;
  card.style.setProperty('--card-color', line.color);

  // header
  const head = document.createElement('div');
  head.className = 'card-head';
  const name = document.createElement('span');
  name.className = 'card-name';
  name.textContent = line.name + (line.kind === 'equation' ? ' · typed in' : ' · from points');
  const close = document.createElement('button');
  close.className = 'card-close';
  close.type = 'button';
  close.title = 'Remove this line';
  close.setAttribute('aria-label', 'Remove ' + line.name);
  close.textContent = '×';
  close.addEventListener('click', () => deleteLine(line.id));
  head.append(name, close);

  // equation
  const eq = document.createElement('div');
  eq.className = 'card-eq';
  eq.textContent = formatEquation(line);

  // slope / intercept facts
  const facts = document.createElement('div');
  facts.className = 'card-facts';
  if (line.vertical) {
    facts.innerHTML = `<span class="fact">slope: <b>undefined</b></span>
                       <span class="fact">no y-intercept</span>`;
  } else {
    facts.innerHTML = `<span class="fact">slope m = <b>${niceNumber(line.m)}</b></span>
                       <span class="fact">y-intercept b = <b>${niceNumber(line.b)}</b></span>`;
  }

  card.append(head, eq, facts);

  if (line.vertical) {
    const note = document.createElement('p');
    note.className = 'card-note';
    note.textContent = 'A vertical line has no slope-intercept form — every point has the same x-value.';
    card.appendChild(note);
  }

  card.appendChild(buildTable(line));
  return card;
}

function buildTable(line) {
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const table = document.createElement('table');
  table.className = 'vt';
  table.innerHTML = '<thead><tr><th>x</th><th>y</th></tr></thead>';
  const body = document.createElement('tbody');

  for (let i = MIN; i <= MAX; i++) {
    const x = line.vertical ? line.xVal : i;
    const y = line.vertical ? i : yAt(line, i);
    const tr = document.createElement('tr');
    tr.dataset.step = i;
    if (Math.abs(y) > MAX + 1e-9 || Math.abs(x) > MAX + 1e-9) tr.classList.add('off');
    tr.innerHTML = `<td>${niceNumber(x)}</td><td>${niceNumber(y)}</td>`;
    body.appendChild(tr);
  }
  table.appendChild(body);
  wrap.appendChild(table);
  return wrap;
}

function renderDots() {
  pageDots.innerHTML = '';
  for (let i = 0; i < pageCount(); i++) {
    const d = document.createElement('button');
    d.className = 'dot' + (i === page ? ' active' : '');
    d.type = 'button';
    d.setAttribute('aria-label', 'Go to page ' + (i + 1));
    d.addEventListener('click', () => setPage(i));
    pageDots.appendChild(d);
  }
  prevPageBtn.disabled = page === 0;
  nextPageBtn.disabled = page >= pageCount() - 1;
}

function applyPageOffset() {
  const w = cardsViewport.clientWidth;
  cardsTrack.style.transform = `translateX(${-page * (w + CARD_GAP)}px)`;
}

function setPage(p) {
  page = clamp(p, 0, pageCount() - 1);
  renderDots();
  applyPageOffset();
}

/** Make sure a given line's card is on the visible carousel page. */
function ensureCardVisible(lineId) {
  const idx = lines.findIndex(l => l.id === lineId);
  if (idx < 0) return;
  const target = Math.floor(idx / cardsPerPage());
  if (target !== page) setPage(target);
}

/* ------------------------------------------------------------
   10. Rendering — points field (bottom left)
   ------------------------------------------------------------ */

function renderPointsField() {
  pointsField.innerHTML = '';
  pointsCount.textContent = points.length + (points.length === 1 ? ' point' : ' points');

  if (points.length === 0) {
    const p = document.createElement('p');
    p.className = 'points-empty';
    p.innerHTML = 'No points yet. Click any corner where two grid lines cross to plot your first ordered pair <strong>(x, y)</strong>. Every point you plot will be listed here.';
    pointsField.appendChild(p);
    return;
  }

  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  sorted.forEach(p => {
    const line = lines.find(l => l.id === p.lineId);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'pt-chip' + (p.id === selectedPointId ? ' is-selected' : '');
    chip.style.setProperty('--chip-color', line ? line.color : '#0f172a');
    chip.innerHTML = `<span class="pt-dot"></span>(${p.x}, ${p.y})` +
      (line ? `<span class="pt-tag">${line.name}</span>` : '');
    chip.addEventListener('click', () => openPointActions(p.id));
    pointsField.appendChild(chip);
  });
}

/* ------------------------------------------------------------
   11. Master update
   ------------------------------------------------------------ */

function update() {
  lines.forEach(recomputeLine);
  renderGraph();
  renderHoverMarker();
  renderCards();
  renderPointsField();
}

/* ------------------------------------------------------------
   12. Modal helper
   ------------------------------------------------------------ */

function isModalOpen() { return modalRoot.classList.contains('open'); }

function closeModal() {
  modalRoot.classList.remove('open');
  modalRoot.setAttribute('aria-hidden', 'true');
  modalRoot.innerHTML = '';
}

/**
 * openModal({ title, html, actions:[{label, cls, onClick, close}], onOpen })
 */
function openModal(cfg) {
  modalRoot.innerHTML = '';
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const box = document.createElement('div');
  box.className = 'modal';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');

  const h = document.createElement('h2');
  h.className = 'modal-title';
  h.textContent = cfg.title;

  const body = document.createElement('div');
  body.className = 'modal-body';
  body.innerHTML = cfg.html || '';

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  (cfg.actions || []).forEach(a => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + (a.cls || 'btn-quiet');
    b.textContent = a.label;
    b.addEventListener('click', () => {
      const keepOpen = a.onClick && a.onClick(box) === false;
      if (!keepOpen && a.close !== false) closeModal();
    });
    actions.appendChild(b);
  });

  box.append(h, body, actions);
  backdrop.appendChild(box);
  backdrop.addEventListener('mousedown', ev => { if (ev.target === backdrop) closeModal(); });
  modalRoot.appendChild(backdrop);
  modalRoot.classList.add('open');
  modalRoot.setAttribute('aria-hidden', 'false');

  if (cfg.onOpen) cfg.onOpen(box);
  const focusTarget = box.querySelector('input') || actions.querySelector('.btn');
  if (focusTarget) focusTarget.focus();
}

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && isModalOpen()) closeModal();
});

/* ------------------------------------------------------------
   13. Points: create, edit, delete, drag
   ------------------------------------------------------------ */

const pointAt = (x, y) => points.find(p => p.x === x && p.y === y);

function addPoint(x, y) {
  if (pointAt(x, y)) return null;
  const p = { id: nextPointId++, x, y, lineId: null };
  points.push(p);
  selectedPointId = null;
  update();
  maybeOfferLine();
  return p;
}

function deletePoint(id) {
  const p = points.find(pt => pt.id === id);
  if (!p) return;
  // Removing a point that defines a line removes that line too.
  if (p.lineId) removeLineRecord(p.lineId, id);
  points = points.filter(pt => pt.id !== id);
  if (selectedPointId === id) selectedPointId = null;
  if (hover) { hover = null; clearTableHighlight(); }
  update();
  maybeOfferLine();
}

function movePoint(id, x, y) {
  const p = points.find(pt => pt.id === id);
  if (!p) return false;
  const blocker = pointAt(x, y);
  if (blocker && blocker.id !== id) return false;
  p.x = x; p.y = y;
  return true;
}

function openPointActions(id) {
  const p = points.find(pt => pt.id === id);
  if (!p) return;
  selectedPointId = id;
  update();
  const line = lines.find(l => l.id === p.lineId);
  openModal({
    title: `Point (${p.x}, ${p.y})`,
    html: `<p>What would you like to do with the ordered pair <span class="coords">(${p.x}, ${p.y})</span>?</p>`
      + (line ? `<p style="margin-top:8px">Heads up: this point builds <strong>${line.name}</strong>. Deleting it removes that line and its table.</p>` : ''),
    actions: [
      { label: 'Cancel', cls: 'btn-quiet' },
      { label: 'Edit coordinates', cls: 'btn-primary', onClick: () => openEditPoint(id) },
      { label: 'Delete point', cls: 'btn-solid-danger', onClick: () => deletePoint(id) }
    ]
  });
}

function openEditPoint(id) {
  const p = points.find(pt => pt.id === id);
  if (!p) return;
  openModal({
    title: 'Edit the point',
    html: `<p>Whole numbers from ${MIN} to ${MAX} only.</p>
      <div class="edit-grid">
        <div class="edit-field"><label for="editX">x-value</label>
          <input id="editX" type="number" step="1" min="${MIN}" max="${MAX}" value="${p.x}"></div>
        <div class="edit-field"><label for="editY">y-value</label>
          <input id="editY" type="number" step="1" min="${MIN}" max="${MAX}" value="${p.y}"></div>
      </div>
      <p class="modal-error" id="editErr"></p>`,
    actions: [
      { label: 'Cancel', cls: 'btn-quiet' },
      {
        label: 'Save point', cls: 'btn-primary', onClick: box => {
          const err = box.querySelector('#editErr');
          const nx = Number(box.querySelector('#editX').value);
          const ny = Number(box.querySelector('#editY').value);
          if (!Number.isInteger(nx) || !Number.isInteger(ny)) {
            err.textContent = 'Please use whole numbers only.'; return false;
          }
          if (nx < MIN || nx > MAX || ny < MIN || ny > MAX) {
            err.textContent = `Both values must be between ${MIN} and ${MAX}.`; return false;
          }
          if (!movePoint(id, nx, ny)) {
            err.textContent = 'There is already a point there. Pick another spot.'; return false;
          }
          selectedPointId = null;
          update();
          maybeOfferLine();
        }
      }
    ]
  });
}

/* ---- dragging ---- */

function eventToGraph(ev) {
  const ctm = svg.getScreenCTM();
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX; pt.y = ev.clientY;
  const loc = pt.matrixTransform(ctm.inverse());
  return { x: toUx(loc.x), y: toUy(loc.y), sx: loc.x, sy: loc.y };
}

function onPointPointerDown(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  const id = Number(ev.currentTarget.dataset.id);
  const p = points.find(pt => pt.id === id);
  if (!p) return;
  drag = {
    id,
    startX: ev.clientX, startY: ev.clientY,
    originX: p.x, originY: p.y,
    moved: false
  };
  hover = null;
  clearTableHighlight();
  renderHoverMarker();
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
}

function onDragMove(ev) {
  if (!drag) return;
  const dist = Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY);
  if (dist > 4) drag.moved = true;

  const g = eventToGraph(ev);
  const nx = clamp(Math.round(g.x), MIN, MAX);
  const ny = clamp(Math.round(g.y), MIN, MAX);
  const p = points.find(pt => pt.id === drag.id);
  if (!p || (p.x === nx && p.y === ny)) return;

  // snap to the nearest corner; ignore corners already taken
  if (movePoint(drag.id, nx, ny)) {
    lines.forEach(recomputeLine);
    renderGraph();
    renderCards();          // equation + table follow the point live
    renderPointsField();
  }
}

function onDragEnd() {
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  if (!drag) return;
  const wasMoved = drag.moved;
  const id = drag.id;
  drag = null;
  suppressNextClick = true;                  // the click that follows must not plot a point
  setTimeout(() => { suppressNextClick = false; }, 0);

  if (wasMoved) {
    // A dragged point never shows the delete button.
    selectedPointId = null;
  } else {
    selectedPointId = (selectedPointId === id) ? null : id;
  }
  update();
  if (wasMoved) maybeOfferLine();
}

/* ------------------------------------------------------------
   14. Graph pointer events: click to plot, hover to read a line
   ------------------------------------------------------------ */

svg.addEventListener('click', ev => {
  if (suppressNextClick) { suppressNextClick = false; return; }
  if (ev.target.closest && ev.target.closest('.point')) return;  // the point handles itself
  if (isModalOpen() || travel) return;

  const g = eventToGraph(ev);
  const x = Math.round(g.x), y = Math.round(g.y);
  if (x < MIN || x > MAX || y < MIN || y > MAX) return;

  // Clicking the corner an existing point sits on selects it instead of stacking.
  const existing = pointAt(x, y);
  if (existing) {
    selectedPointId = (selectedPointId === existing.id) ? null : existing.id;
    update();
    return;
  }
  selectedPointId = null;
  addPoint(x, y);
});

svg.addEventListener('pointermove', ev => {
  if (drag || travel) return;
  const g = eventToGraph(ev);

  let best = null;
  lines.forEach(line => {
    const d = distanceToLine(line, g.sx, g.sy);
    if (d <= HOVER_TOL && (!best || d < best.d)) best = { line, d };
  });

  if (!best || g.x < MIN - 0.5 || g.x > MAX + 0.5 || g.y < MIN - 0.5 || g.y > MAX + 0.5) {
    if (hover) { hover = null; clearTableHighlight(); renderHoverMarker(); renderOverlay(); }
    return;
  }

  const line = best.line;
  let hx, hy, step;
  if (line.vertical) {
    // step along whole-number y-values instead
    hy = clamp(Math.round(g.y), MIN, MAX);
    hx = line.xVal;
    step = hy;
  } else {
    hx = clamp(Math.round(g.x), MIN, MAX);
    hy = yAt(line, hx);
    step = hx;
  }
  if (Math.abs(hy) > MAX + 1e-9 || Math.abs(hx) > MAX + 1e-9) {
    if (hover) { hover = null; clearTableHighlight(); renderHoverMarker(); renderOverlay(); }
    return;
  }

  const box = overlay.getBoundingClientRect();
  const changedLine = !hover || hover.lineId !== line.id;
  const changedStep = !hover || hover.step !== step;

  hover = {
    lineId: line.id, x: hx, y: hy, step,
    cursorX: ev.clientX - box.left,
    cursorY: ev.clientY - box.top
  };

  if (changedLine) ensureCardVisible(line.id);
  if (changedLine || changedStep) { highlightTableRow(line.id, step); renderHoverMarker(); }
  renderOverlay();
});

svg.addEventListener('pointerleave', () => {
  if (drag) return;
  if (hover) { hover = null; clearTableHighlight(); renderHoverMarker(); renderOverlay(); }
});

function clearTableHighlight() {
  cardsTrack.querySelectorAll('tr.hl').forEach(tr => tr.classList.remove('hl'));
}

function highlightTableRow(lineId, step) {
  clearTableHighlight();
  const card = cardsTrack.querySelector(`.line-card[data-line-id="${lineId}"]`);
  if (!card) return;
  const row = card.querySelector(`tr[data-step="${step}"]`);
  if (!row) return;
  row.classList.add('hl');

  // scroll only the table body, never the page or the carousel
  const wrap = row.closest('.table-wrap');
  if (!wrap) return;
  const head = row.closest('table').querySelector('th');
  const headH = head ? head.offsetHeight : 24;   // the sticky header covers the top
  const top = row.offsetTop, h = row.offsetHeight;
  if (top - headH < wrap.scrollTop) wrap.scrollTop = Math.max(0, top - headH - 2);
  else if (top + h > wrap.scrollTop + wrap.clientHeight) {
    wrap.scrollTop = top + h - wrap.clientHeight + 2;
  }
}

/* ------------------------------------------------------------
   15. Lines: offer, create, delete
   ------------------------------------------------------------ */

const freePoints = () => points.filter(p => p.lineId === null);

/** Whenever exactly two points are not yet part of a line, ask about drawing one. */
function maybeOfferLine() {
  if (isModalOpen() || drag) return;
  const free = freePoints();
  if (free.length !== 2) return;
  const key = pairKey(free[0], free[1]);
  if (declinedPairs.has(key)) return;

  const [a, b] = free;
  const vertical = a.x === b.x;
  const preview = vertical
    ? 'x = ' + niceNumber(a.x)
    : formatEquation({ vertical: false, m: (b.y - a.y) / (b.x - a.x), b: a.y - ((b.y - a.y) / (b.x - a.x)) * a.x });

  openModal({
    title: 'Draw a line?',
    html: `<p>You have two free points: <span class="coords">(${a.x}, ${a.y})</span> and
           <span class="coords">(${b.x}, ${b.y})</span>.</p>
           <p style="margin-top:8px">Two points determine exactly one line. Want to connect them and see its equation?</p>
           <p style="margin-top:8px">Preview: <span class="coords">${preview}</span></p>`,
    actions: [
      {
        label: 'No thanks', cls: 'btn-quiet', onClick: () => {
          declinedPairs.add(key);
        }
      },
      {
        label: 'Yes, draw the line', cls: 'btn-primary', onClick: () => {
          createLineFromPoints(a.id, b.id);
        }
      }
    ]
  });
}

function nextColor() {
  const c = COLORS[colorCursor % COLORS.length];
  colorCursor++;
  return c;
}

function createLineFromPoints(id1, id2) {
  const a = points.find(p => p.id === id1);
  const b = points.find(p => p.id === id2);
  if (!a || !b) return;
  const line = {
    id: nextLineId, name: 'Line ' + nextLineId, color: nextColor(),
    kind: 'points', p1: id1, p2: id2,
    vertical: false, m: 0, b: 0, xVal: 0
  };
  nextLineId++;
  recomputeLine(line);
  a.lineId = line.id;
  b.lineId = line.id;
  lines.push(line);
  selectedPointId = null;
  update();
  setPage(pageCount() - 1);
}

function createLineFromEquation(parsed) {
  const line = {
    id: nextLineId, name: 'Line ' + nextLineId, color: nextColor(),
    kind: 'equation', p1: null, p2: null,
    vertical: !!parsed.vertical,
    m: parsed.m, b: parsed.b, xVal: parsed.xVal
  };
  nextLineId++;
  lines.push(line);
  update();
  setPage(pageCount() - 1);
  return line;
}

/** Remove a line. `skipPointId` is a point being deleted anyway. */
function removeLineRecord(lineId, skipPointId) {
  const line = lines.find(l => l.id === lineId);
  if (!line) return;
  const survivors = points.filter(p => p.lineId === lineId && p.id !== skipPointId);
  survivors.forEach(p => { p.lineId = null; });
  // Don't immediately re-ask about the very pair the user just took apart.
  if (survivors.length === 2) declinedPairs.add(pairKey(survivors[0], survivors[1]));
  lines = lines.filter(l => l.id !== lineId);
  if (hover && hover.lineId === lineId) { hover = null; clearTableHighlight(); }
}

function deleteLine(lineId) {
  const line = lines.find(l => l.id === lineId);
  if (!line) return;
  const attached = points.filter(p => p.lineId === lineId);
  openModal({
    title: 'Remove ' + line.name + '?',
    html: `<p>This removes <span class="coords">${formatEquation(line)}</span> from the graph, along with its table.</p>`
      + (attached.length ? `<p style="margin-top:8px">Its two points stay on the graph so you can reuse them.</p>` : ''),
    actions: [
      { label: 'Keep it', cls: 'btn-quiet' },
      {
        label: 'Remove line', cls: 'btn-solid-danger', onClick: () => {
          removeLineRecord(lineId, null);
          update();
        }
      }
    ]
  });
}

/* ------------------------------------------------------------
   16. Equation parsing (bottom right input)
   ------------------------------------------------------------ */

function parseNumber(token) {
  if (/^[+-]?\d*\.?\d+$/.test(token)) return parseFloat(token);
  const frac = token.match(/^([+-]?\d*\.?\d+)\/(\d*\.?\d+)$/);
  if (frac) {
    const d = parseFloat(frac[2]);
    if (d === 0) return null;
    return parseFloat(frac[1]) / d;
  }
  return null;
}

/**
 * Accepts: y = 2x + 1 | y=-x+4 | y = 1/2x - 3 | y = 5 | 3x-2 | x = -4
 * Returns { m, b } or { vertical:true, xVal } or { error }
 */
function parseEquation(raw) {
  let s = (raw || '').toLowerCase()
    .replace(/−/g, '-')      // unicode minus
    .replace(/[·×*]/g, '')
    .replace(/\s+/g, '');

  if (!s) return { error: 'Type an equation first, for example y = 2x + 1.' };

  if (/^x=/.test(s)) {
    const v = parseNumber(s.slice(2));
    if (v === null) return { error: 'I could not read that x-value. Try something like x = 3.' };
    if (v < MIN || v > MAX) return { error: `That vertical line is off the grid (keep x between ${MIN} and ${MAX}).` };
    return { vertical: true, xVal: v, m: Infinity, b: NaN };
  }

  if (/^y=/.test(s)) s = s.slice(2);
  else if (s.includes('=')) return { error: 'Start with "y =" (slope-intercept form) or "x =" for a vertical line.' };

  if (s === '') return { error: 'What does y equal? Try y = 2x + 1.' };
  if (/[^0-9x+\-./]/.test(s)) return { error: 'Use only numbers, x, +, -, / and a decimal point.' };

  const terms = s.replace(/-/g, '+-').split('+').filter(t => t !== '');
  if (!terms.length) return { error: 'I could not read that equation. Try y = 2x + 1.' };

  let m = 0, b = 0;
  for (const t of terms) {
    if (t.includes('x')) {
      const parts = t.split('x');
      if (parts.length !== 2) return { error: 'Only one x per term, like 2x or 1/2x.' };
      let coef = parts[0];
      let after = parts[1];                  // supports "x/2"
      if (coef === '' || coef === '+') coef = '1';
      else if (coef === '-') coef = '-1';
      else if (coef.endsWith('/')) return { error: 'I could not read the slope. Try 1/2x.' };
      let value = parseNumber(coef);
      if (value === null) return { error: `I could not read the term "${t}".` };
      if (after !== '') {
        const div = after.startsWith('/') ? parseNumber(after.slice(1)) : null;
        if (div === null || div === 0) return { error: `I could not read the term "${t}".` };
        value /= div;
      }
      m += value;
    } else {
      const value = parseNumber(t);
      if (value === null) return { error: `I could not read the number "${t}".` };
      b += value;
    }
  }
  if (!isFinite(m) || !isFinite(b)) return { error: 'That equation does not make a straight line.' };
  return { vertical: false, m, b, xVal: 0 };
}

/**
 * Show (or clear) a form's message.
 * kind: 'ok' | 'busy' | undefined (error)
 */
function setStatus(el, text, kind) {
  el.textContent = text || '';
  el.className = 'eq-error' + (text && kind ? ' ' + kind : '');
}

eqForm.addEventListener('submit', ev => {
  ev.preventDefault();
  const parsed = parseEquation(eqInput.value);
  if (parsed.error) {
    setStatus(eqError, parsed.error);
    eqInput.classList.add('invalid');
    eqInput.focus();
    return;
  }
  eqInput.classList.remove('invalid');
  const line = createLineFromEquation(parsed);

  if (isOffGrid(line)) {
    setStatus(eqError, `${line.name} (${formatEquation(line)}) is graphed, but it never crosses this window — check the table.`);
  } else {
    setStatus(eqError, `Graphed ${line.name}: ${formatEquation(line)}`, 'ok');
  }
  eqInput.value = '';
  eqInput.focus();
});

eqInput.addEventListener('input', () => {
  eqInput.classList.remove('invalid');
  setStatus(eqError, '');
});

/* ------------------------------------------------------------
   16b. Ordered-pair input + the "walk to the point" animation
   ------------------------------------------------------------ */

/** Accepts "(3, 4)", "3,4", "3 4", "-2, 5" — whole numbers only. */
function parsePair(raw) {
  const s = (raw || '').replace(/−/g, '-').replace(/[()[\]{}]/g, '').trim();
  if (!s) return { error: 'Type an ordered pair, like (3, 4).' };

  const parts = s.split(/[,;\s]+/).filter(Boolean);
  if (parts.length !== 2) {
    return { error: 'An ordered pair needs exactly two numbers — x first, then y, like (3, 4).' };
  }
  if (!parts.every(p => /^[+-]?\d+$/.test(p))) {
    return { error: 'This grid only takes whole numbers. Try something like (3, -4).' };
  }
  const x = parseInt(parts[0], 10), y = parseInt(parts[1], 10);
  if (x < MIN || x > MAX || y < MIN || y > MAX) {
    return { error: `Both numbers have to be between ${MIN} and ${MAX}.` };
  }
  return { x, y };
}

const easeInOut = p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const easeOut = p => 1 - Math.pow(1 - p, 3);
const reducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setPlotFormEnabled(on) {
  ptInput.disabled = !on;
  ptBtn.disabled = !on;
}

function cancelTravel() {
  if (!travel) return;
  cancelAnimationFrame(travel.frame);
  travel = null;
  if (animLayer) animLayer.innerHTML = '';
  setPlotFormEnabled(true);
}

/** Random spark particles thrown off when the point lands. */
function makeSparks() {
  const colors = ['#f59e0b', '#fbbf24', '#fde68a', '#7c3aed', '#ffffff'];
  const list = [];
  for (let i = 0; i < 18; i++) {
    const spread = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    list.push({
      angle: spread,
      reach: 32 + Math.random() * 46,
      size: 2.2 + Math.random() * 2.9,
      color: colors[i % colors.length],
      lag: Math.random() * 0.16
    });
  }
  return list;
}

/**
 * Walk a pulsing dot from the origin: first ALONG the x-axis to the x-value,
 * then straight up/down to the y-value, then let off sparks and settle in.
 */
function plotWithAnimation(tx, ty) {
  if (travel) return;

  if (reducedMotion()) {              // respect the OS "reduce motion" setting
    landPoint(tx, ty);
    return;
  }

  const legs = [
    { x1: 0, y1: 0, x2: tx, y2: 0, caption: `across to x = ${tx}` },
    { x1: tx, y1: 0, x2: tx, y2: ty, caption: `${ty >= 0 ? 'up' : 'down'} to y = ${ty}` }
  ].filter(l => l.x1 !== l.x2 || l.y1 !== l.y2);

  const PAUSE = 160;      // beat at the corner, so the turn is obvious
  const SPARK = 720;
  let clock = 0;
  legs.forEach(l => {
    const dist = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
    l.dur = 280 + dist * 95;          // ~10 units/sec: visible, not sluggish
    l.start = clock;
    l.end = clock + l.dur;
    clock = l.end + PAUSE;
  });

  const travelEnd = legs.length ? legs[legs.length - 1].end : 0;
  const sparkStart = travelEnd + 70;
  const total = sparkStart + SPARK;

  setPlotFormEnabled(false);
  setStatus(ptError, `Plotting (${tx}, ${ty})…`, 'busy');

  travel = { tx, ty, sparks: makeSparks(), t0: performance.now(), frame: 0 };
  travel.frame = requestAnimationFrame(step);

  function step(now) {
    if (!travel) return;
    const t = now - travel.t0;
    animLayer.innerHTML = '';

    // ---- where is the dot right now? ----
    let px = tx, py = ty, caption = '';
    const done = [];
    for (const l of legs) {
      if (t >= l.end) { done.push(l); continue; }
      if (t >= l.start) {                       // mid-leg
        const p = easeInOut((t - l.start) / l.dur);
        px = l.x1 + (l.x2 - l.x1) * p;
        py = l.y1 + (l.y2 - l.y1) * p;
      } else {                                  // resting at the corner
        px = l.x1; py = l.y1;
      }
      caption = l.caption;
      break;
    }

    const cx = toPx(px), cy = toPy(py);

    // ---- dashed trail showing the path walked so far ----
    const path = [[0, 0]];
    done.forEach(l => path.push([l.x2, l.y2]));
    const tail = path[path.length - 1];
    if (tail[0] !== px || tail[1] !== py) path.push([px, py]);
    if (path.length > 1) {
      svgEl('polyline', {
        class: 'travel-trail',
        points: path.map(p => `${toPx(p[0])},${toPy(p[1])}`).join(' ')
      }, animLayer);
    }

    // ---- the pulsing traveller ----
    const beat = 0.5 + 0.5 * Math.sin(t / 115);
    if (t < sparkStart) {
      svgEl('circle', {
        class: 'travel-ring', cx, cy,
        r: 12 + beat * 7, opacity: 0.5 - beat * 0.3
      }, animLayer);
    }
    svgEl('circle', { class: 'travel-dot', cx, cy, r: 7 + beat * 2.6 }, animLayer);

    if (caption) {
      const cap = svgEl('text', {
        class: 'travel-caption', x: cx, y: cy - 20 - beat * 3
      }, animLayer);
      cap.textContent = caption;
    }

    // ---- landing: sparks + shockwave ----
    if (t >= sparkStart) {
      const sp = Math.min(1, (t - sparkStart) / SPARK);

      if (sp < 0.2) {
        svgEl('circle', {
          class: 'flash', cx, cy, r: 10 + sp * 60, opacity: 0.75 * (1 - sp / 0.2)
        }, animLayer);
      }
      [0, 0.13].forEach((offset, i) => {
        const rp = (sp - offset) / (1 - offset);
        if (rp <= 0) return;
        svgEl('circle', {
          class: 'shock', cx, cy,
          r: 8 + easeOut(rp) * (46 - i * 12),
          stroke: i ? '#7c3aed' : '#f59e0b',
          'stroke-width': 3 * (1 - rp),
          opacity: 0.85 * (1 - rp)
        }, animLayer);
      });

      travel.sparks.forEach(s => {
        const sp2 = Math.min(1, Math.max(0, (sp - s.lag) / (1 - s.lag)));
        if (sp2 <= 0) return;
        const dist = easeOut(sp2) * s.reach;
        svgEl('circle', {
          class: 'spark',
          cx: cx + Math.cos(s.angle) * dist,
          cy: cy + Math.sin(s.angle) * dist + sp2 * sp2 * 14,   // a little gravity
          r: Math.max(0.2, s.size * (1 - sp2 * 0.85)),
          fill: s.color,
          opacity: 1 - sp2
        }, animLayer);
      });
    }

    if (t >= total) {
      animLayer.innerHTML = '';
      travel = null;
      setPlotFormEnabled(true);
      landPoint(tx, ty);
      ptInput.focus();
      return;
    }
    travel.frame = requestAnimationFrame(step);
  }
}

/** Add the point for real and give it a one-off bounce. */
function landPoint(x, y) {
  const created = addPoint(x, y);
  if (created) {
    justLandedId = created.id;
    renderPointsOnGraph();          // re-render so the bounce class is applied
    setTimeout(() => {
      if (justLandedId === created.id) { justLandedId = null; renderPointsOnGraph(); }
    }, 520);
    ptInput.value = '';
    setStatus(ptError, `Plotted (${x}, ${y}) — over ${x}, then ${y < 0 ? 'down' : 'up'} ${Math.abs(y)}.`, 'ok');
  } else {
    setStatus(ptError, `There is already a point at (${x}, ${y}).`);
  }
}

ptForm.addEventListener('submit', ev => {
  ev.preventDefault();
  if (travel) return;

  const parsed = parsePair(ptInput.value);
  if (parsed.error) {
    setStatus(ptError, parsed.error);
    ptInput.classList.add('invalid');
    ptInput.focus();
    return;
  }
  if (pointAt(parsed.x, parsed.y)) {
    setStatus(ptError, `There is already a point at (${parsed.x}, ${parsed.y}). Try another pair.`);
    ptInput.classList.add('invalid');
    return;
  }
  ptInput.classList.remove('invalid');
  plotWithAnimation(parsed.x, parsed.y);
});

ptInput.addEventListener('input', () => {
  ptInput.classList.remove('invalid');
  setStatus(ptError, '');
});

/* ------------------------------------------------------------
   17. Carousel + header buttons + resize
   ------------------------------------------------------------ */

prevPageBtn.addEventListener('click', () => setPage(page - 1));
nextPageBtn.addEventListener('click', () => setPage(page + 1));

document.getElementById('clearBtn').addEventListener('click', () => {
  if (!points.length && !lines.length) return;
  openModal({
    title: 'Clear the whole graph?',
    html: '<p>Every point, line, equation and table will be removed. This cannot be undone.</p>',
    actions: [
      { label: 'Cancel', cls: 'btn-quiet' },
      {
        label: 'Clear everything', cls: 'btn-solid-danger', onClick: () => {
          cancelTravel();
          points = []; lines = [];
          nextPointId = 1; nextLineId = 1; colorCursor = 0;
          selectedPointId = null; justLandedId = null; hover = null; page = 0;
          declinedPairs.clear();
          setStatus(eqError, '');
          setStatus(ptError, '');
          update();
        }
      }
    ]
  });
});

document.getElementById('helpBtn').addEventListener('click', () => {
  openModal({
    title: 'How to use this graph',
    html: `<ol class="help-list">
      <li><strong>Plot a point.</strong> Click any corner where two grid lines cross. The label shows its ordered pair <code>(x, y)</code> — x first (across), y second (up).</li>
      <li><strong>Make a line.</strong> As soon as two points are not yet used by a line, you'll be asked if you want to connect them. The line keeps going past both points forever.</li>
      <li><strong>Read the equation.</strong> The left panel shows the line in slope-intercept form <code>y = mx + b</code> plus a table of values, one x-value at a time.</li>
      <li><strong>Hover the line</strong> to see the ordered pair at each whole x-value; the matching table row lights up.</li>
      <li><strong>Move a point.</strong> Drag it — it snaps to the nearest corner and the equation and table update instantly.</li>
      <li><strong>Delete a point.</strong> Click it once, then press <em>Delete point</em>. (Dragging never triggers delete.) You can also click any pair in the list at the bottom left to edit or delete it.</li>
      <li><strong>Type an equation.</strong> Bottom right, enter something like <code>y = -3x + 2</code> and graph it directly.</li>
      <li><strong>Type an ordered pair.</strong> Under that, enter <code>(3, 4)</code> and watch a dot travel from the origin: first <em>across</em> to x = 3, then <em>up</em> to y = 4. That order — x, then y — is what an ordered pair means.</li>
    </ol>`,
    actions: [{ label: 'Got it', cls: 'btn-primary' }]
  });
});

let resizeTimer = null;
window.addEventListener('resize', () => {
  applyPageOffset();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderOverlay(true), 90);
});

/* ------------------------------------------------------------
   18. Start
   ------------------------------------------------------------ */

buildGraph();
initOverlay();
update();
