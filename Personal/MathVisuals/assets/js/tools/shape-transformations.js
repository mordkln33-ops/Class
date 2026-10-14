/* ============================================================
   Shape Transformations — Geometry
   Draw a circle, triangle, quadrilateral or polygon on a
   four-quadrant plane; read its coordinates, side lengths and
   area; then translate, reflect, rotate and dilate it.

   One rule holds everywhere: every point of every shape sits on
   whole-number coordinates. Dragging, turning, resizing and the
   four transformations only ever offer results that keep it.
   ============================================================ */
'use strict';

/* ------------------------------------------------------------
   1. Constants
   ------------------------------------------------------------ */

const LIM = 10;                     // the plane runs from -LIM to LIM on both axes
const NS = 'http://www.w3.org/2000/svg';
const MINUS = '−';

/* What each zoom button shows. Quadrants are numbered counterclockwise from the top right. */
const VIEWS = {
  all: { x0: -LIM, x1: LIM, y0: -LIM, y1: LIM, name: '' },
  q1: { x0: 0, x1: LIM, y0: 0, y1: LIM, name: 'Quadrant I (x > 0, y > 0)' },
  q2: { x0: -LIM, x1: 0, y0: 0, y1: LIM, name: 'Quadrant II (x < 0, y > 0)' },
  q3: { x0: -LIM, x1: 0, y0: -LIM, y1: 0, name: 'Quadrant III (x < 0, y < 0)' },
  q4: { x0: 0, x1: LIM, y0: -LIM, y1: 0, name: 'Quadrant IV (x > 0, y < 0)' }
};

/* Shape colors are site tokens, so dark mode needs no script. */
const COLORS = ['--data-1', '--data-2', '--data-4', '--data-5', '--data-3', '--data-7', '--data-8', '--data-6'];
const colorOf = idx => `var(${COLORS[idx % COLORS.length]})`;

const LETTERS = 'ABCDEFGHIJ';
const POLY_NAMES = { 3: 'Triangle', 4: 'Quadrilateral', 5: 'Pentagon', 6: 'Hexagon', 7: 'Heptagon', 8: 'Octagon', 9: 'Nonagon', 10: 'Decagon' };
const TYPE_WORDS = { circle: 'circle', triangle: 'triangle', quad: 'quadrilateral', custom: 'polygon' };
const PRIMES = ['', '′', '″', '‴', '⁗'];
const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
const MIN_SIDES = 3;
const MAX_SIDES = 10;
const VULGAR = {
  '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾', '1/5': '⅕', '2/5': '⅖', '3/5': '⅗', '4/5': '⅘',
  '1/6': '⅙', '5/6': '⅚', '1/8': '⅛', '3/8': '⅜', '5/8': '⅝', '7/8': '⅞'
};
const MOVE_WORDS = { translate: 'translation', reflect: 'reflection', rotate: 'rotation', dilate: 'dilation' };

/* ------------------------------------------------------------
   2. State
   ------------------------------------------------------------ */

const state = {
  mode: 'triangle',   // 'circle' | 'triangle' | 'quad' | 'custom'
  sides: 5,           // number of points for 'custom'
  pts: [],            // the base shape; a circle is [center, point on the circle]
  complete: false,    // every point placed
  chain: [],          // transformations; each maps the previous shape to the next
  view: 'all',
  hl: null,           // highlighted item, e.g. 's0:p1' = shape 0, point B
  preview: null       // transformation being set up in a pop-up
};

let shapes = [];      // derived on every render: the base shape, then each image
let drag = null;      // active drag on the plane
let newIdx = -1;      // image that just appeared (fades in once)
let geo = null;       // pixel geometry of the plane
let statusFlash = null;
let selected = -1;    // shape showing its Delete button

const maxPts = () => ({ circle: 2, triangle: 3, quad: 4 })[state.mode] || state.sides;

/* ------------------------------------------------------------
   3. DOM references
   ------------------------------------------------------------ */

const svg = document.getElementById('plane');
const stage = document.getElementById('stage');
const tipEl = document.getElementById('graphTip');
const statusEl = document.getElementById('graphStatus');
const infoBody = document.getElementById('infoBody');
const coordsList = document.getElementById('coordsList');
const lengthsList = document.getElementById('lengthsList');
const areaList = document.getElementById('areaList');
const movesNote = document.getElementById('movesNote');
const undoBtn = document.getElementById('undoBtn');
const sidesBox = document.getElementById('sidesBox');
const sidesOut = document.getElementById('sidesOut');
const sidesDown = document.getElementById('sidesDown');
const sidesUp = document.getElementById('sidesUp');
const modalRoot = document.getElementById('modalRoot');
const moveBtns = document.querySelectorAll('[data-move]');
const shapeRadios = document.querySelectorAll('input[name="shapeType"]');
const zoomBtns = document.querySelectorAll('[data-view]');
const shapeAction = document.getElementById('shapeAction');
const layoutEl = document.querySelector('.layout');
const infoPanel = document.querySelector('.panel-info');
const popBtn = document.getElementById('popBtn');

let planeLayer, contentLayer, pairLayer;

/* ------------------------------------------------------------
   4. Numbers: fractions, radicals and formatting
   ------------------------------------------------------------ */

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; }

function frac(n, d = 1) {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}

/** A float that is really a small fraction (scale factors, rule coefficients). */
function toFrac(v) {
  for (let d = 1; d <= 360; d++) {
    const n = Math.round(v * d);
    if (Math.abs(n / d - v) < 1e-9) return frac(n, d);
  }
  return null;
}

const isInt = v => Math.abs(v - Math.round(v)) < 1e-9;
const fmtInt = n => (n < 0 ? MINUS + (-n) : String(n));
const fmtFrac = f => (f.d === 1 ? fmtInt(f.n) : fmtInt(f.n) + '/' + f.d);

/** 2 decimal places at most, with a real minus sign. */
function dec(v) {
  const r = Math.round(v * 100) / 100;
  return (r < 0 ? MINUS : '') + String(Math.abs(r));
}

function fmtNum(v) {
  const f = toFrac(v);
  return f ? fmtFrac(f) : dec(v);
}

const pair = P => `(${fmtNum(P.x)}, ${fmtNum(P.y)})`;
const areaFmt = S2 => (S2 % 2 ? (S2 / 2).toFixed(1) : String(S2 / 2));   // S2 = twice the area
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/*
  Lengths are kept exact as c·√m (c a fraction, m square-free). Every distance
  between grid points is √N for a whole N, and every height and diagonal the
  tool needs turns out to share the radical of its base, so this one form is
  enough to show answers like 2√5 or 12/5 exactly.
*/
function lenSq(N) {
  let s = 1, m = N;
  for (let f = 2; f * f <= m; f++) {
    while (m % (f * f) === 0) { m /= f * f; s *= f; }
  }
  return { c: frac(s), m };
}

const lenVal = L => (L.c.n / L.c.d) * Math.sqrt(L.m);

function fmtLen(L) {
  if (L.m === 1) return fmtFrac(L.c);
  const head = L.c.n === 1 ? '' : fmtInt(L.c.n);
  return head + '√' + L.m + (L.c.d === 1 ? '' : '/' + L.c.d);
}

/** Exact form, plus a decimal when the exact form isn't a whole number. */
function fmtLenFull(L) {
  const s = fmtLen(L);
  if (L.m === 1 && L.c.d === 1) return s;
  const v = lenVal(L);
  return s + (isInt(v * 100) ? ' = ' : ' ≈ ') + dec(v);
}

/** Distance between grid points, worked out: √(3² + 4²) = 5. */
function distText(dx, dy) {
  dx = Math.abs(dx); dy = Math.abs(dy);
  if (dx === 0 || dy === 0) return String(dx + dy);
  const N = dx * dx + dy * dy, L = lenSq(N);
  let s = `√(${dx}² + ${dy}²)`;
  if (L.m === 1) return s + ' = ' + L.c.n;
  if (L.c.n > 1) s += ' = √' + N;
  return s + ' = ' + fmtLenFull(L);
}

/**
 * How to substitute lengths into a formula: exact when they are all whole
 * multiples of a radical (6, 2√2), otherwise rounded decimals.
 */
function showLens(lens) {
  if (lens.every(L => L.c.d === 1)) return { vals: lens.map(fmtLen), sign: '=' };
  const exact = lens.every(L => L.m === 1 && isInt(lenVal(L) * 100));
  return { vals: lens.map(L => dec(lenVal(L))), sign: exact ? '=' : '≈' };
}

/* ------------------------------------------------------------
   5. Geometry helpers
   ------------------------------------------------------------ */

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const same = (a, b) => a.x === b.x && a.y === b.y;
const near = (a, b) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
const onBoard = P => Math.abs(P.x) <= LIM && Math.abs(P.y) <= LIM;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function shoelace2(P) {
  let s = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s;
}

function centroid(P) {
  const c = P.reduce((acc, q) => ({ x: acc.x + q.x, y: acc.y + q.y }), { x: 0, y: 0 });
  return { x: c.x / P.length, y: c.y / P.length };
}

/** Closest grid point to a shape's middle: rotations and dilations turn about it. */
const latticeCenter = P => { const c = centroid(P); return { x: Math.round(c.x), y: Math.round(c.y) }; };

function segsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign(cross(sub(q, p), sub(r, p)));
  const onSeg = (p, q, r) => Math.min(p.x, q.x) <= r.x && r.x <= Math.max(p.x, q.x) &&
    Math.min(p.y, q.y) <= r.y && r.y <= Math.max(p.y, q.y);
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSeg(a, b, c)) || (o2 === 0 && onSeg(a, b, d)) ||
    (o3 === 0 && onSeg(c, d, a)) || (o4 === 0 && onSeg(c, d, b));
}

function selfIntersects(P) {
  const n = P.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;   // these two sides share point 0
      if (segsCross(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Corners in order around their middle, which uncrosses a "bow-tie". */
function untangle(P) {
  const c = centroid(P);
  return P.slice().sort((a, b) => Math.atan2(b.y - c.y, b.x - c.x) - Math.atan2(a.y - c.y, a.x - c.x));
}

function insidePoly(w, P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a.y > w.y) !== (b.y > w.y) && w.x < (b.x - a.x) * (w.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Foot of the perpendicular from Pt to line AB; t = 0 at A, 1 at B. */
function footOf(Pt, A, B) {
  const d = sub(B, A), t = dot(sub(Pt, A), d) / dot(d, d);
  return { x: A.x + t * d.x, y: A.y + t * d.y, t };
}

/** Prefer a horizontal side as the base, then a vertical one, so heights can be counted on the grid. */
function pickBase(P, edges) {
  let best = edges[0], bestScore = Infinity;
  edges.forEach(e => {
    const A = P[e], B = P[(e + 1) % P.length];
    const score = (A.y === B.y ? 0 : A.x === B.x ? 1 : 2) * 1e5 - d2(A, B);
    if (score < bestScore) { bestScore = score; best = e; }
  });
  return best;
}

/** Of several corners, the one whose height lands on the base itself (not its extension). */
function bestFoot(froms, A, B) {
  let best = null, bestOut = Infinity;
  froms.forEach(P => {
    const F = footOf(P, A, B), out = Math.max(0, -F.t, F.t - 1);
    if (out < bestOut - 1e-9) { bestOut = out; best = P; }
  });
  return best;
}

/* ------------------------------------------------------------
   6. Transformations
   Every one is an affine map  x' = a·x + b·y + e,  y' = c·x + d·y + f
   so one function applies them and one writes their rule.
   ------------------------------------------------------------ */

function centerText(cx, cy) { return cx === 0 && cy === 0 ? 'the origin' : `(${fmtInt(cx)}, ${fmtInt(cy)})`; }

function makeT(type, p) {
  let a = 1, b = 0, c = 0, d = 1, e = 0, f = 0, title = '';
  if (type === 'translate') {
    e = p.dx; f = p.dy;
    const parts = [];
    if (p.dx) parts.push(`${Math.abs(p.dx)} ${Math.abs(p.dx) === 1 ? 'unit' : 'units'} ${p.dx > 0 ? 'right' : 'left'}`);
    if (p.dy) parts.push(`${Math.abs(p.dy)} ${Math.abs(p.dy) === 1 ? 'unit' : 'units'} ${p.dy > 0 ? 'up' : 'down'}`);
    title = 'Translation ' + parts.join(' and ');
  } else if (type === 'reflect') {
    const L = p.line;
    if (L === 'x-axis') { d = -1; title = 'Reflection over the x-axis'; }
    else if (L === 'y-axis') { a = -1; title = 'Reflection over the y-axis'; }
    else if (L === 'y=x') { a = 0; d = 0; b = 1; c = 1; title = 'Reflection over the line y = x'; }
    else if (L === 'y=-x') { a = 0; d = 0; b = -1; c = -1; title = `Reflection over the line y = ${MINUS}x`; }
    else if (L === 'x=k') { a = -1; e = 2 * p.k; title = `Reflection over the line x = ${fmtInt(p.k)}`; }
    else if (L === 'mx+b') {
      // Slope 1: (x, y) → (y − b, x + b).  Slope −1: (x, y) → (−y + b, −x + b).  Slope 0: (x, y) → (x, 2b − y).
      if (p.m === 1) { a = 0; d = 0; b = 1; c = 1; e = -p.b; f = p.b; }
      else if (p.m === -1) { a = 0; d = 0; b = -1; c = -1; e = p.b; f = p.b; }
      else { d = -1; f = 2 * p.b; }
      title = `Reflection over the line ${lineText(p.m, p.b)}`;
    }
    else { d = -1; f = 2 * p.k; title = `Reflection over the line y = ${fmtInt(p.k)}`; }
  } else if (type === 'rotate') {
    const ccw = p.deg === 180 ? 180 : p.dir === 'cw' ? 360 - p.deg : p.deg;
    const { cx, cy } = p;
    if (ccw === 90) { a = 0; b = -1; c = 1; d = 0; e = cx + cy; f = cy - cx; }
    else if (ccw === 180) { a = -1; d = -1; e = 2 * cx; f = 2 * cy; }
    else { a = 0; b = 1; c = -1; d = 0; e = cx - cy; f = cx + cy; }
    title = `Rotation ${p.deg}°${p.deg === 180 ? '' : p.dir === 'cw' ? ' clockwise' : ' counterclockwise'} about ${centerText(cx, cy)}`;
  } else if (type === 'dilate') {
    const k = p.k.n / p.k.d;
    a = k; d = k; e = p.cx * (1 - k); f = p.cy * (1 - k);
    title = `Dilation by a scale factor of ${fmtFrac(p.k)}, centered at ${centerText(p.cx, p.cy)}`;
  }
  const T = { type, p, a, b, c, d, e, f, title };
  T.rule = ruleText(T);
  return T;
}

/** "y = x + 2", "y = −x − 1", "y = 3" */
function lineText(m, bb) {
  if (m === 0) return `y = ${fmtInt(bb)}`;
  const head = `y = ${m === 1 ? '' : m === -1 ? MINUS : fmtInt(m)}x`;
  return bb === 0 ? head : head + (bb > 0 ? ` + ${bb}` : ` ${MINUS} ${-bb}`);
}

/**
 * Read a typed slope-intercept equation. Only slopes 1, −1 and 0 with a whole
 * b keep reflected grid points on grid points, so anything else is explained.
 */
function readLine(raw) {
  const t = (raw || '').toLowerCase().replace(/[−–]/g, '-').replace(/\s+/g, '');
  if (!t) return { hint: 'Type a line such as y = x + 2 or y = -x - 1.' };
  const m = t.match(/^y=([+-]?(?:\d+(?:\.\d+)?(?:\/\d+)?)?)(x)?([+-]\d+(?:\.\d+)?(?:\/\d+)?)?$/);
  if (!m || (!m[2] && m[3])) return { error: 'Write the line in slope-intercept form, like y = x + 2.' };
  const num = str => { const [p, q] = str.split('/'); return q ? parseFloat(p) / parseFloat(q) : parseFloat(p); };
  let slope, b0;
  if (m[2]) {
    slope = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : num(m[1]);
    b0 = m[3] ? num(m[3]) : 0;
  } else {
    if (m[1] === '' || m[1] === '+' || m[1] === '-') return { error: 'Write the line in slope-intercept form, like y = x + 2.' };
    slope = 0; b0 = num(m[1]);
  }
  if (![1, -1, 0].includes(slope)) {
    return { error: 'Only slopes of 1, −1 or 0 keep every reflected point on whole coordinates. Try y = x + 2 or y = −x.' };
  }
  if (!isInt(b0)) return { error: 'Use a whole number for b, so every reflected point lands on the grid.' };
  if (Math.abs(b0) > 20) return { error: `Keep b between ${MINUS}20 and 20.` };
  return { m: slope, b: Math.round(b0) };
}

const mapPt = (T, P) => ({ x: T.a * P.x + T.b * P.y + T.e, y: T.c * P.x + T.d * P.y + T.f });
const applyT = (T, pts) => pts.map(P => mapPt(T, P));

/** The points rounded to the grid, or null if any of them misses it. */
function snapPts(pts) {
  if (!pts.every(P => isInt(P.x) && isInt(P.y))) return null;
  return pts.map(P => ({ x: Math.round(P.x) || 0, y: Math.round(P.y) || 0 }));
}

function coefText(v) {
  if (isInt(v)) return String(Math.round(v));
  const f = toFrac(v);
  if (!f) return dec(v);
  return VULGAR[f.n + '/' + f.d] || `(${f.n}/${f.d})`;
}

/** One side of a rule: "−y + 5", "½x + 3/2". */
function linearText(cx, cy, k) {
  const parts = [];
  if (Math.abs(cx) > 1e-12) parts.push({ co: cx, v: 'x' });
  if (Math.abs(cy) > 1e-12) parts.push({ co: cy, v: 'y' });
  if (Math.abs(k) > 1e-12) parts.push({ co: k, v: '' });
  if (!parts.length) return '0';
  return parts.map((t, i) => {
    const neg = t.co < 0, mag = Math.abs(t.co);
    const body = t.v ? (Math.abs(mag - 1) < 1e-12 ? t.v : coefText(mag) + t.v) : fmtNum(mag);
    if (i === 0) return (neg ? MINUS : '') + body;
    return (neg ? ` ${MINUS} ` : ' + ') + body;
  }).join('');
}

const ruleText = T => `(x, y) → (${linearText(T.a, T.b, T.e)}, ${linearText(T.c, T.d, T.f)})`;

/** Every shape the chain produces from these base points, or null if one leaves the grid points. */
function chainFrom(basePts, chain = state.chain) {
  const out = [basePts];
  let cur = basePts;
  for (const T of chain) {
    cur = snapPts(applyT(T, cur));
    if (!cur) return null;
    out.push(cur);
  }
  return out;
}

/** Can the base shape take these points? */
function baseOK(pts, final) {
  if (!pts.every(onBoard)) return false;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) if (same(pts[i], pts[j])) return false;
  }
  if ((state.complete || final) && state.mode !== 'circle' &&
    shoelace2(selfIntersects(pts) ? untangle(pts) : pts) === 0) return false;
  return !state.chain.length || !!chainFrom(pts);
}

/* ------------------------------------------------------------
   7. Describing a shape: names, lengths, helper lines, area
   ------------------------------------------------------------ */

function mark(idx) {
  if (idx < PRIMES.length) return PRIMES[idx];
  return String(idx).split('').map(c => SUBSCRIPTS[c]).join('');
}

function labelsFor(n, idx) {
  const base = state.mode === 'circle' ? ['O', 'A'] : LETTERS.slice(0, n).split('');
  return base.map(l => l + mark(idx));
}

function sideRec(sh, i, j) {
  const P = sh.pts[i], Q = sh.pts[j];
  const dx = Q.x - P.x, dy = Q.y - P.y;
  const label = sh.labels[i] + sh.labels[j];
  return { key: 'e' + i, i, j, label, L: lenSq(dx * dx + dy * dy), text: `${label} = ${distText(dx, dy)}` };
}

/** A dashed height from `from` to line AB, with a right-angle mark at its foot. */
function heightAux(label, from, A, B, L, note) {
  const F = footOf(from, A, B);
  const along = near(F, B) ? A : B;
  return {
    key: 'h', label, a: from, b: F, L, note,
    ext: F.t < -1e-9 ? [A, F] : F.t > 1 + 1e-9 ? [B, F] : null,
    mark: { at: F, u: along, w: from },
    text: `${label} = ${fmtLenFull(L)}`
  };
}

function describe(pts, idx) {
  const kind = state.mode === 'circle' ? 'circle' : 'poly';
  const complete = idx > 0 || state.complete;
  const sh = {
    idx, pts, kind, complete, color: colorOf(idx), T: state.chain[idx - 1] || null,
    labels: labelsFor(pts.length, idx),
    sides: [], aux: [], extras: [], marks: [], area: null, tag: '', S2: 0
  };
  if (!complete) {
    const word = TYPE_WORDS[state.mode];
    sh.name = `${cap(word)} in progress`;
    sh.tag = `${pts.length} of ${maxPts()} points`;
    if (kind === 'poly') for (let i = 0; i + 1 < pts.length; i++) sh.sides.push(sideRec(sh, i, i + 1));
    return sh;
  }
  if (kind === 'circle') analyzeCircle(sh);
  else if (pts.length === 3) analyzeTriangle(sh);
  else if (pts.length === 4) analyzeQuad(sh);
  else analyzePolygon(sh);
  return sh;
}

function analyzeCircle(sh) {
  const [O, A] = sh.pts, Lb = sh.labels;
  const dx = A.x - O.x, dy = A.y - O.y, R2 = dx * dx + dy * dy, r = lenSq(R2);
  const d = { c: frac(r.c.n * 2), m: r.m };
  sh.name = 'Circle ' + Lb[0];
  sh.tag = 'center ' + Lb[0];
  sh.aux = [{ key: 'r', label: 'r', a: O, b: A, L: r, note: 'radius', text: `r = ${Lb[0]}${Lb[1]} = ${distText(dx, dy)}` }];
  const dStr = fmtLen(d);
  sh.extras = [
    { key: 'd', text: `d = 2r = ${fmtLenFull(d)}`, note: 'diameter' },
    { key: 'c', text: `C = 2πr = ${dStr}π ≈ ${dec(lenVal(d) * Math.PI)}`, note: 'circumference', graph: true }
  ];
  const rSq = r.m === 1 && r.c.d === 1 ? `${r.c.n}²` : `(${fmtLen(r)})²`;
  sh.areaStr = `${R2}π`;
  sh.areaVal = R2 * Math.PI;
  sh.area = {
    formula: 'A = πr²',
    lines: [`= π × ${rSq}`],
    result: `${R2}π ≈ ${dec(R2 * Math.PI)}`
  };
}

function analyzeTriangle(sh) {
  const P = sh.pts, Lb = sh.labels;
  sh.sides = [0, 1, 2].map(i => sideRec(sh, i, (i + 1) % 3));
  const S2 = Math.abs(shoelace2(P));
  sh.S2 = S2;
  const sq = [d2(P[0], P[1]), d2(P[1], P[2]), d2(P[2], P[0])].sort((x, y) => x - y);
  const angle = sq[0] + sq[1] === sq[2] ? 'right' : sq[0] + sq[1] < sq[2] ? 'obtuse' : 'acute';
  const iso = sq[0] === sq[1] || sq[1] === sq[2];
  sh.name = '△' + Lb.join('');
  sh.tag = `${angle}, ${iso ? 'isosceles' : 'scalene'}`;
  sh.areaStr = areaFmt(S2);
  sh.areaVal = S2 / 2;

  const e = pickBase(P, [0, 1, 2]);
  const i = e, j = (e + 1) % 3, k = (e + 2) % 3;
  const b = sh.sides[e].L, bName = sh.sides[e].label;
  const h = { c: frac(S2, b.c.n * b.m), m: b.m };     // h = 2A / b
  const F = footOf(P[k], P[i], P[j]);
  let hName = 'h';
  if (near(F, P[i]) || near(F, P[j])) {
    // A right angle on the base: the height is a side.
    const at = near(F, P[i]) ? i : j;
    hName = at === i ? Lb[k] + Lb[i] : Lb[j] + Lb[k];
    sh.marks.push({ at: P[at], u: P[at === i ? j : i], w: P[k] });
    sh.extras.push({ key: 'hs', text: `h = ${hName} = ${fmtLenFull(h)}`, note: `height: ${hName} ⊥ ${bName}` });
  } else {
    sh.aux.push(heightAux('h', P[k], P[i], P[j], h, `height, ${Lb[k]} to ${bName}`));
  }
  const { vals, sign } = showLens([b, h]);
  sh.area = {
    formula: 'A = ½ × b × h',
    lines: [`= ½ × ${bName} × ${hName}`, `${sign} ½ × ${vals[0]} × ${vals[1]}`],
    result: sh.areaStr,
    note: sign === '≈' ? 'The lengths are rounded; the area is exact.' : ''
  };
}

function analyzeQuad(sh) {
  const P = sh.pts, Lb = sh.labels;
  sh.sides = [0, 1, 2, 3].map(i => sideRec(sh, i, (i + 1) % 4));
  const S2 = Math.abs(shoelace2(P));
  sh.S2 = S2;
  sh.areaStr = areaFmt(S2);
  sh.areaVal = S2 / 2;
  const v = i => sub(P[(i + 1) % 4], P[i]);
  const par = (i, j) => cross(v(i), v(j)) === 0;
  const len2 = i => dot(v(i), v(i));

  let type = 'quadrilateral';
  if (selfIntersects(P)) type = 'crossed';
  else if (par(0, 2) && par(1, 3)) {
    type = dot(v(0), v(1)) === 0 ? (len2(0) === len2(1) ? 'square' : 'rectangle')
      : (len2(0) === len2(1) ? 'rhombus' : 'parallelogram');
  } else if (par(0, 2) || par(1, 3)) type = 'trapezoid';
  else if ((len2(0) === len2(1) && len2(2) === len2(3)) || (len2(1) === len2(2) && len2(3) === len2(0))) type = 'kite';

  sh.name = (type === 'crossed' ? 'Quadrilateral' : cap(type)) + ' ' + Lb.join('');
  sh.tag = type === 'crossed' ? 'sides cross' : type;
  const side = i => sh.sides[i];
  const result = sh.areaStr;

  if (type === 'square') {
    const s = side(0);
    const shown = s.L.m === 1 ? `${s.L.c.n}²` : `(${fmtLen(s.L)})²`;
    sh.area = { formula: 'A = s²', lines: [`= ${s.label}²`, `= ${shown}`], result };
  } else if (type === 'rectangle') {
    const l = side(0), w = side(1);
    const { vals, sign } = showLens([l.L, w.L]);
    sh.area = { formula: 'A = l × w', lines: [`= ${l.label} × ${w.label}`, `${sign} ${vals[0]} × ${vals[1]}`], result };
  } else if (type === 'parallelogram') {
    const e = pickBase(P, [0, 1, 2, 3]);
    const A = P[e], B = P[(e + 1) % 4], b = side(e);
    const h = { c: frac(S2, 2 * b.L.c.n * b.L.m), m: b.L.m };      // h = A / b
    const from = bestFoot([P[(e + 2) % 4], P[(e + 3) % 4]], A, B);
    sh.aux.push(heightAux('h', from, A, B, h, `height to ${b.label}`));
    const { vals, sign } = showLens([b.L, h]);
    sh.area = {
      formula: 'A = b × h', lines: [`= ${b.label} × h`, `${sign} ${vals[0]} × ${vals[1]}`], result,
      note: sign === '≈' ? 'The lengths are rounded; the area is exact.' : ''
    };
  } else if (type === 'trapezoid') {
    const e = par(0, 2) ? 0 : 1;
    const b1 = side(e), b2 = side(e + 2);
    // Parallel grid segments share a radical, so b₁ + b₂ = (s₁ + s₂)√m.
    const m = b1.L.m, h = { c: frac(S2, (b1.L.c.n + b2.L.c.n) * m), m };
    const long = b1.L.c.n >= b2.L.c.n ? b1 : b2, short = long === b1 ? b2 : b1;
    const from = bestFoot([P[short.i], P[short.j]], P[long.i], P[long.j]);
    sh.aux.push(heightAux('h', from, P[long.i], P[long.j], h, `height between ${b1.label} and ${b2.label}`));
    const { vals, sign } = showLens([b1.L, b2.L, h]);
    sh.area = {
      formula: 'A = ½ × (b₁ + b₂) × h',
      lines: [`= ½ × (${b1.label} + ${b2.label}) × h`, `${sign} ½ × (${vals[0]} + ${vals[1]}) × ${vals[2]}`],
      result, note: sign === '≈' ? 'The lengths are rounded; the area is exact.' : ''
    };
  } else if (type === 'rhombus' || type === 'kite') {
    const diag = (i, j, key) => {
      const dx = P[j].x - P[i].x, dy = P[j].y - P[i].y;
      const label = Lb[i] + Lb[j];
      return { key, label, a: P[i], b: P[j], L: lenSq(dx * dx + dy * dy), note: 'diagonal', text: `${label} = ${distText(dx, dy)}` };
    };
    const d1 = diag(0, 2, 'd1'), d2_ = diag(1, 3, 'd2');
    sh.aux.push(d1, d2_);
    const { vals, sign } = showLens([d1.L, d2_.L]);
    sh.area = {
      formula: 'A = ½ × d₁ × d₂',
      lines: [`= ½ × ${d1.label} × ${d2_.label}`, `${sign} ½ × ${vals[0]} × ${vals[1]}`],
      result, note: sign === '≈' ? 'The lengths are rounded; the area is exact.' : ''
    };
  } else if (type === 'crossed') {
    sh.area = { formula: 'No area', lines: [], result: '', warn: 'Two sides cross, so this is not a simple quadrilateral.' };
  } else {
    shoelaceArea(sh);
  }
}

function analyzePolygon(sh) {
  sh.sides = sh.pts.map((_, i) => sideRec(sh, i, (i + 1) % sh.pts.length));
  sh.S2 = Math.abs(shoelace2(sh.pts));
  sh.areaStr = areaFmt(sh.S2);
  sh.areaVal = sh.S2 / 2;
  sh.name = POLY_NAMES[sh.pts.length] + ' ' + sh.labels.join('');
  sh.tag = selfIntersects(sh.pts) ? 'sides cross' : `${sh.pts.length} sides`;
  shoelaceArea(sh);
}

/** Area from coordinates alone, every product shown. */
function shoelaceArea(sh) {
  const P = sh.pts, n = P.length;
  const par = v => (v < 0 ? `(${fmtInt(v)})` : String(v));
  const prods = P.map((a, i) => { const b = P[(i + 1) % n]; return `${par(a.x)}·${par(b.y)} ${MINUS} ${par(b.x)}·${par(a.y)}`; });
  const terms = P.map((a, i) => { const b = P[(i + 1) % n]; return a.x * b.y - b.x * a.y; });
  const sum = terms.reduce((s, t) => s + t, 0);
  const termStr = terms.map((t, i) => (i === 0 ? fmtInt(t) : t < 0 ? ` ${MINUS} ${-t}` : ` + ${t}`)).join('');
  sh.area = {
    method: 'Shoelace formula: multiply across the coordinates in order around the shape',
    formula: `A = ½ × |x₁y₂ ${MINUS} x₂y₁ + x₂y₃ ${MINUS} x₃y₂ + … + xₙy₁ ${MINUS} x₁yₙ|`,
    lines: [`= ½ × |(${prods.join(') + (')})|`, `= ½ × |${termStr}|`, `= ½ × |${fmtInt(sum)}|`],
    result: sh.areaStr,
    warn: selfIntersects(P) ? 'Two sides cross, so this area is not the space inside the shape.' : ''
  };
}

/** Notes that tie an image back to the shape it came from. */
function relate(sh, prev) {
  const T = sh.T;
  if (T.type === 'dilate') {
    const k = fmtFrac(T.p.k);
    sh.lenNote = `Every length is ${k} times the length in ${prev.name}.`;
    sh.areaNote = `Check: k² × area of ${prev.name} = (${k})² × ${prev.areaStr} = ${sh.areaStr}`;
  } else {
    const word = MOVE_WORDS[T.type];
    sh.lenNote = `Same lengths as ${prev.name}: a ${word} doesn't change size.`;
    sh.areaNote = `Same area as ${prev.name}: a ${word} doesn't change size.`;
  }
}

function buildShapes() {
  if (!state.pts.length) return [];
  const lists = chainFrom(state.pts) || [state.pts];
  const out = lists.map((pts, idx) => describe(pts, idx));
  out.forEach((sh, i) => { if (i > 0) relate(sh, out[i - 1]); });
  return out;
}

/* ------------------------------------------------------------
   8. Sizing the plane
   The <svg> viewBox is the stage's size in css pixels, so every
   size below is simply pixels, derived from the root font size
   (which grows on a projector).
   ------------------------------------------------------------ */

function measure() {
  const W = Math.max(stage.clientWidth, 50), H = Math.max(stage.clientHeight, 50);
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 18;
  const ui = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')) || 1;
  const fs = clamp(root * ui, 12, 30) * clamp(Math.min(W, H) / 560, .9, 1.1);
  const v = VIEWS[state.view];
  const pad = Math.round(fs * (state.view === 'all' ? 1.1 : 1.9));
  const size = Math.max(40, Math.min(W, H) - pad * 2);
  const unit = size / (v.x1 - v.x0);
  geo = {
    W, H, fs, unit, size,
    left: (W - size) / 2, top: (H - size) / 2,
    dot: clamp(fs * .36, 5.5, 13),
    tol: Math.max(10, fs * .55)
  };
  geo.hitR = Math.min(geo.dot * 2, unit * .45);
  geo.numFs = Math.max(11, Math.round(fs * .72));

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const set = (name, px) => svg.style.setProperty(name, px + 'px');
  set('--fs-num', geo.numFs);
  set('--fs-name', Math.round(fs * .95));
  set('--fs-label', Math.round(fs * .92));
  set('--fs-small', Math.round(fs * .74));
  set('--sw-grid', Math.max(1, fs * .06));
  set('--sw-grid-five', Math.max(1.6, fs * .095));
  set('--sw-axis', Math.max(2.5, fs * .15));
  set('--sw-side', Math.max(3, fs * .17));
  set('--sw-aux', Math.max(2.2, fs * .12));
  set('--sw-halo', Math.max(2.4, fs * .13));
}

const view = () => VIEWS[state.view];
const X = x => geo.left + (x - view().x0) * geo.unit;
const Y = y => geo.top + (view().y1 - y) * geo.unit;
const toPx = P => ({ x: X(P.x), y: Y(P.y) });

function eventPx(ev) {
  const r = svg.getBoundingClientRect();
  return { x: (ev.clientX - r.left) * (geo.W / r.width), y: (ev.clientY - r.top) * (geo.H / r.height) };
}

const toWorld = p => ({ x: view().x0 + (p.x - geo.left) / geo.unit, y: view().y1 - (p.y - geo.top) / geo.unit });

function inView(P) {
  const v = view();
  return P.x >= v.x0 && P.x <= v.x1 && P.y >= v.y0 && P.y <= v.y1;
}

/* ------------------------------------------------------------
   9. Drawing
   ------------------------------------------------------------ */

function el(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  for (const k in attrs) {
    if (attrs[k] === undefined || attrs[k] === null) continue;
    if (k === 'text') node.textContent = attrs[k];
    else if (k === 'c') node.style.setProperty('--c', attrs[k]);
    else node.setAttribute(k, attrs[k]);
  }
  if (parent) parent.appendChild(node);
  return node;
}

function initSvg() {
  svg.textContent = '';
  const defs = el('defs', {}, svg);
  // Shapes are clipped exactly to the grid; points and labels get a margin so edge points stay whole.
  el('rect', { id: 'plotClipRect' }, el('clipPath', { id: 'plotClip' }, defs));
  el('rect', { id: 'pointClipRect' }, el('clipPath', { id: 'pointClip' }, defs));
  planeLayer = el('g', { class: 'plane-layer' }, svg);
  contentLayer = el('g', { class: 'content-layer' }, svg);
}

function drawPlane() {
  planeLayer.textContent = '';
  const v = view(), g = planeLayer, fs = geo.fs;
  const L = geo.left, T = geo.top, S = geo.size;
  const clipTo = (id, m) => {
    const r = document.getElementById(id);
    r.setAttribute('x', L - m); r.setAttribute('y', T - m);
    r.setAttribute('width', S + 2 * m); r.setAttribute('height', S + 2 * m);
  };
  clipTo('plotClipRect', 0);
  clipTo('pointClipRect', geo.fs * 1.2);

  el('rect', { class: 'plot-bg', x: L, y: T, width: S, height: S }, g);

  for (let x = v.x0; x <= v.x1; x++) {
    if (x === 0) continue;
    el('line', { class: 'grid-line' + (x % 5 === 0 ? ' five' : ''), x1: X(x), y1: T, x2: X(x), y2: T + S }, g);
  }
  for (let y = v.y0; y <= v.y1; y++) {
    if (y === 0) continue;
    el('line', { class: 'grid-line' + (y % 5 === 0 ? ' five' : ''), x1: L, y1: Y(y), x2: L + S, y2: Y(y) }, g);
  }
  el('rect', { class: 'plot-frame', x: L, y: T, width: S, height: S }, g);
  el('line', { class: 'axis', x1: L, y1: Y(0), x2: L + S, y2: Y(0) }, g);
  el('line', { class: 'axis', x1: X(0), y1: T, x2: X(0), y2: T + S }, g);

  // Numbers: thinned out when the squares get too small to hold them.
  const step = geo.unit >= geo.numFs * 1.9 ? 1 : geo.unit >= geo.numFs * .95 ? 2 : 5;
  const xAbove = v.y1 === 0;            // x-axis on the top edge (quadrants III, IV)
  const yRight = v.x1 === 0;            // y-axis on the right edge (quadrants II, III)
  const xRow = Y(0) + (xAbove ? -fs * .62 : fs * .62);
  const yCol = X(0) + (yRight ? fs * .32 : -fs * .32);
  for (let x = v.x0; x <= v.x1; x++) {
    if (x === 0 || x % step) continue;
    el('text', { class: 'axis-num', x: X(x), y: xRow, 'text-anchor': 'middle', text: fmtInt(x) }, g);
  }
  for (let y = v.y0; y <= v.y1; y++) {
    if (y === 0 || y % step) continue;
    el('text', { class: 'axis-num', x: yCol, y: Y(y), 'text-anchor': yRight ? 'start' : 'end', text: fmtInt(y) }, g);
  }
  el('text', { class: 'axis-num', x: yCol, y: xRow, 'text-anchor': yRight ? 'start' : 'end', text: '0' }, g);

  // Axis names at the positive ends (or the far end in a zoomed quadrant).
  const xEnd = v.x1 > 0 ? L + S : L, yEnd = v.y1 > 0 ? T : T + S;
  el('text', {
    class: 'axis-name', x: xEnd + (v.x1 > 0 ? fs * .45 : -fs * .45), y: Y(0) + (xAbove ? fs * .1 : -fs * .1) - (v.y0 === 0 ? fs * .55 : 0),
    'text-anchor': v.x1 > 0 ? 'start' : 'end', text: 'x'
  }, g);
  el('text', {
    class: 'axis-name', x: X(0) + (yRight ? -fs * .55 : fs * .55), y: yEnd + (v.y1 > 0 ? -fs * .1 : fs * .1),
    'text-anchor': 'middle', text: 'y'
  }, g);
}

function polyPoints(pts) { return pts.map(P => `${X(P.x)},${Y(P.y)}`).join(' '); }

function arrowHead(g, from, to, c) {
  const a = toPx(from), b = toPx(to);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len, uy = dy / len, s = geo.fs * .5;
  el('polygon', {
    class: 'guide-head', c,
    points: `${b.x},${b.y} ${b.x - ux * s - uy * s * .55},${b.y - uy * s + ux * s * .55} ${b.x - ux * s + uy * s * .55},${b.y - uy * s - ux * s * .55}`
  }, g);
}

function centerMarker(g, C, label) {
  const p = toPx(C), r = geo.dot * 1.15;
  el('circle', { class: 'center-ring', cx: p.x, cy: p.y, r }, g);
  el('circle', { class: 'center-dot', cx: p.x, cy: p.y, r: r * .38 }, g);
  if (label) el('text', { class: 'guide-label', x: p.x + r * 1.5, y: p.y + r * 1.6, style: 'fill: var(--color-ink)', text: label }, g);
}

/** Where to put a label on a line through the view: the visible point nearest the top right. */
function labelSpot(A, D) {
  const v = view();
  let best = null, bestScore = -Infinity;
  for (let s = -40; s <= 40; s += .25) {
    const P = { x: A.x + s * D.x, y: A.y + s * D.y };
    if (P.x < v.x0 + .6 || P.x > v.x1 - .6 || P.y < v.y0 + .6 || P.y > v.y1 - .6) continue;
    const score = P.y * 2 + P.x;
    if (score > bestScore) { bestScore = score; best = P; }
  }
  return best;
}

/** An arrow from a point to its image, stopping short of the image's dot so the head shows. */
function arrowLine(g, from, to, c, cls) {
  if (same(from, to)) return;
  const p = toPx(from), q = toPx(to), len = Math.hypot(q.x - p.x, q.y - p.y);
  const cut = Math.min(geo.dot * 1.5, len / 2);
  const end = toWorld({ x: q.x - (q.x - p.x) / len * cut, y: q.y - (q.y - p.y) / len * cut });
  el('line', { class: cls, c, x1: p.x, y1: p.y, x2: X(end.x), y2: Y(end.y) }, g);
  arrowHead(g, from, end, c);
}

/**
 * The picture that explains a transformation, for the given point pairs:
 *   translation  an arrow from each point to its image
 *   reflection   the mirror line, plus a connector that meets it at a right angle
 *   rotation     the center, the two arms and the arc of the turn
 *   dilation     the center and the ray through each point and its image
 * After a transformation this is drawn for one hovered point at a time; a
 * pop-up's preview draws it for the whole shape.
 */
function drawGuide(g, T, from, to, c) {
  if (T.type === 'translate') {
    from.forEach((P, i) => arrowLine(g, P, to[i], c, 'pair-line'));
  } else if (T.type === 'reflect') {
    const L = T.p.line;
    const A = L === 'x=k' ? { x: T.p.k, y: 0 } : L === 'y=k' ? { x: 0, y: T.p.k } : L === 'mx+b' ? { x: 0, y: T.p.b } : { x: 0, y: 0 };
    const D = L === 'x-axis' || L === 'y=k' ? { x: 1, y: 0 } : L === 'y-axis' || L === 'x=k' ? { x: 0, y: 1 }
      : L === 'y=x' ? { x: 1, y: 1 } : L === 'mx+b' ? { x: 1, y: T.p.m } : { x: 1, y: -1 };
    el('line', { class: 'guide-mirror', c, x1: X(A.x - 40 * D.x), y1: Y(A.y - 40 * D.y), x2: X(A.x + 40 * D.x), y2: Y(A.y + 40 * D.y) }, g);
    from.forEach((P, i) => {
      if (same(P, to[i])) return;   // a point on the mirror is its own image
      arrowLine(g, P, to[i], c, 'guide-line');
      const mid = { x: (P.x + to[i].x) / 2, y: (P.y + to[i].y) / 2 };
      drawRightMark(g, { at: mid, u: { x: mid.x + D.x, y: mid.y + D.y }, w: to[i] });
    });
    const spot = labelSpot(A, D);
    if (spot) {
      const name = { 'x-axis': 'x-axis', 'y-axis': 'y-axis', 'y=x': 'y = x', 'y=-x': `y = ${MINUS}x` }[L] ||
        (L === 'x=k' ? `x = ${fmtInt(T.p.k)}` : L === 'mx+b' ? lineText(T.p.m, T.p.b) : `y = ${fmtInt(T.p.k)}`);
      el('text', { class: 'guide-label', c, x: X(spot.x) + geo.fs * .35, y: Y(spot.y) - geo.fs * .55, text: name }, g);
    }
  } else if (T.type === 'rotate') {
    const C = { x: T.p.cx, y: T.p.cy };
    let i = from.findIndex(P => !same(P, C));
    if (i < 0) i = 0;
    el('line', { class: 'guide-line', c, x1: X(C.x), y1: Y(C.y), x2: X(from[i].x), y2: Y(from[i].y) }, g);
    el('line', { class: 'guide-line', c, x1: X(C.x), y1: Y(C.y), x2: X(to[i].x), y2: Y(to[i].y) }, g);
    // Arc showing the turn, drawn in the direction of the rotation.
    const pc = toPx(C), pa = toPx(from[i]), pb = toPx(to[i]);
    const r = Math.min(geo.fs * 1.6, Math.hypot(pa.x - pc.x, pa.y - pc.y) * .6);
    const a0 = Math.atan2(pa.y - pc.y, pa.x - pc.x), a1 = Math.atan2(pb.y - pc.y, pb.x - pc.x);
    const ccw = T.p.deg === 180 || T.p.dir !== 'cw';   // counterclockwise on screen = negative svg angle
    const sweep = ccw ? 0 : 1, large = T.p.deg === 270 ? 1 : 0;
    if (r > 4) {
      const s = { x: pc.x + r * Math.cos(a0), y: pc.y + r * Math.sin(a0) }, e = { x: pc.x + r * Math.cos(a1), y: pc.y + r * Math.sin(a1) };
      el('path', { class: 'guide-arrow', c, d: `M${s.x},${s.y} A${r},${r} 0 ${large} ${sweep} ${e.x},${e.y}` }, g);
      // arrowhead at the end of the arc, pointing the way it turns
      const back = ccw ? a1 + .2 : a1 - .2;
      arrowHead(g, toWorld({ x: pc.x + r * Math.cos(back), y: pc.y + r * Math.sin(back) }), toWorld(e), c);
      let mid = (a0 + a1) / 2;
      let span = ccw ? a0 - a1 : a1 - a0;
      while (span < 0) span += Math.PI * 2;
      mid = ccw ? a0 - span / 2 : a0 + span / 2;
      el('text', {
        class: 'guide-label', c, x: pc.x + (r + geo.fs * .8) * Math.cos(mid), y: pc.y + (r + geo.fs * .8) * Math.sin(mid),
        'text-anchor': 'middle', text: T.p.deg + '°'
      }, g);
    }
    centerMarker(g, C);
  } else if (T.type === 'dilate') {
    const C = { x: T.p.cx, y: T.p.cy };
    from.forEach((P, i) => {
      const far = d2(C, to[i]) >= d2(C, P) ? to[i] : P;
      el('line', { class: 'guide-line', c, x1: X(C.x), y1: Y(C.y), x2: X(far.x), y2: Y(far.y) }, g);
      arrowLine(g, P, to[i], c, 'guide-arrow');
    });
    centerMarker(g, C);
    const p = toPx(C);
    el('text', { class: 'guide-label', c, x: p.x - geo.dot * 1.8, y: p.y - geo.dot * 1.9, 'text-anchor': 'end', text: '× ' + fmtFrac(T.p.k) }, g);
  }
}

function drawRightMark(g, mk) {
  const at = toPx(mk.at), u = toPx(mk.u), w = toPx(mk.w);
  const unit = (p) => { const dx = p.x - at.x, dy = p.y - at.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; };
  const a = unit(u), b = unit(w), s = Math.min(geo.fs * .55, geo.unit * .45);
  el('path', {
    class: 'right-mark',
    d: `M${at.x + a.x * s},${at.y + a.y * s} L${at.x + (a.x + b.x) * s},${at.y + (a.y + b.y) * s} L${at.x + b.x * s},${at.y + b.y * s}`
  }, g);
}

function drawShapeBody(g, sh) {
  const c = sh.color, k = 's' + sh.idx, P = sh.pts;
  const cls = (sh.idx === newIdx ? ' is-new' : '') + (sh.idx === selected ? ' is-selected' : '');
  if (sh.kind === 'circle') {
    if (P.length === 2) {
      const r = Math.sqrt(d2(P[0], P[1])) * geo.unit;
      el('circle', { class: 'shape-fill' + cls, c, 'data-key': k, cx: X(P[0].x), cy: Y(P[0].y), r }, g);
      el('circle', { class: 'side-glow', 'data-key': k + ':c', cx: X(P[0].x), cy: Y(P[0].y), r }, g);
      el('circle', { class: 'side' + cls, c, 'data-key': k + ':c', cx: X(P[0].x), cy: Y(P[0].y), r }, g);
    }
    return;
  }
  if (sh.complete) el('polygon', { class: 'shape-fill' + cls, c, 'data-key': k, points: polyPoints(P) }, g);
  sh.sides.forEach(s => {
    const a = P[s.i], b = P[s.j];
    el('line', { class: 'side-glow', 'data-key': `${k}:${s.key}`, x1: X(a.x), y1: Y(a.y), x2: X(b.x), y2: Y(b.y) }, g);
  });
  sh.sides.forEach(s => {
    const a = P[s.i], b = P[s.j];
    el('line', { class: 'side' + cls, c, 'data-key': `${k}:${s.key}`, x1: X(a.x), y1: Y(a.y), x2: X(b.x), y2: Y(b.y) }, g);
  });
}

function drawAux(g, sh) {
  const c = sh.color, k = 's' + sh.idx;
  sh.aux.forEach(ax => {
    const key = `${k}:x${ax.key}`;
    if (ax.ext) el('line', { class: 'aux is-ext', c, 'data-key': key, x1: X(ax.ext[0].x), y1: Y(ax.ext[0].y), x2: X(ax.ext[1].x), y2: Y(ax.ext[1].y) }, g);
    el('line', { class: 'aux-halo', x1: X(ax.a.x), y1: Y(ax.a.y), x2: X(ax.b.x), y2: Y(ax.b.y) }, g);
    el('line', { class: 'aux', c, 'data-key': key, x1: X(ax.a.x), y1: Y(ax.a.y), x2: X(ax.b.x), y2: Y(ax.b.y) }, g);
    if (ax.mark) drawRightMark(g, ax.mark);
    if (ax.key === 'h' || ax.key === 'r') {
      // label beside the middle of the line, on its outer side
      const a = toPx(ax.a), b = toPx(ax.b), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      let nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l;
      const cen = toPx(centroid(sh.pts));
      if ((mx + nx - cen.x) * nx + (my + ny - cen.y) * ny < 0 && ax.key === 'r') { nx = -nx; ny = -ny; }
      el('text', { class: 'aux-label', x: mx + nx * geo.fs * .6, y: my + ny * geo.fs * .6, text: ax.label }, g);
    }
  });
  sh.marks.forEach(mk => drawRightMark(g, mk));
}

function labelPos(sh, i) {
  const P = toPx(sh.pts[i]), off = geo.fs * .95;
  let dx, dy;
  if (sh.kind === 'circle' && sh.pts.length === 2) {
    const o = toPx(sh.pts[0]), a = toPx(sh.pts[1]);
    dx = a.x - o.x; dy = a.y - o.y;
    if (i === 0) { dx = -dx; dy = -dy; }
  } else if (sh.pts.length >= 2) {
    const c = toPx(centroid(sh.pts));
    dx = P.x - c.x; dy = P.y - c.y;
  }
  const l = Math.hypot(dx || 0, dy || 0);
  if (!l) { dx = .7; dy = -.7; } else { dx /= l; dy /= l; }
  return { x: P.x + dx * off, y: P.y + dy * off };
}

function drawPoints(g, sh, ghost) {
  const c = sh.color, k = 's' + sh.idx;
  sh.pts.forEach((P, i) => {
    const key = `${k}:p${i}`, p = toPx(P), lp = labelPos(sh, i);
    if (!ghost) {
      el('circle', { class: 'pt-ring', c, 'data-key': key, cx: p.x, cy: p.y, r: geo.dot * 1.9 }, g);
      el('circle', { class: 'pt-dot' + (sh.idx === newIdx ? ' is-new' : ''), c, 'data-key': key, cx: p.x, cy: p.y, r: geo.dot }, g);
    }
    el('text', { class: 'pt-label' + (ghost ? ' ghost-label' : ''), c, 'data-key': ghost ? null : key, x: lp.x, y: lp.y, text: sh.labels[i] }, g);
  });
}

function drawGhost(g, pts, sh, labels) {
  const c = sh.color;
  if (sh.kind === 'circle') {
    el('circle', { class: 'ghost', c, cx: X(pts[0].x), cy: Y(pts[0].y), r: Math.sqrt(d2(pts[0], pts[1])) * geo.unit }, g);
  } else {
    el('polygon', { class: 'ghost', c, points: polyPoints(pts) }, g);
  }
  if (labels) drawPoints(g, Object.assign({}, sh, { pts }), true);
}

function drawContent() {
  contentLayer.textContent = '';
  const g = el('g', { 'clip-path': 'url(#plotClip)' }, contentLayer);
  const top = el('g', { 'clip-path': 'url(#pointClip)' }, contentLayer);
  pairLayer = el('g', { class: 'pair-layer', 'clip-path': 'url(#plotClip)' });
  contentLayer.insertBefore(pairLayer, top);
  const last = shapes.length - 1;

  // Images under the base shape, so the base is always on top to drag.
  for (let i = shapes.length - 1; i >= 0; i--) drawShapeBody(g, shapes[i]);
  shapes.forEach(sh => { if (sh.complete) drawAux(g, sh); });

  // A transformation being set up in a pop-up.
  if (state.preview && shapes.length) {
    const src = shapes[last], img = applyT(state.preview, src.pts);
    const gg = el('g', {}, g);
    const fake = { idx: last + 1, kind: src.kind, color: colorOf(last + 1), labels: labelsFor(img.length, last + 1) };
    drawGuide(gg, state.preview, src.pts, img, fake.color);
    drawGhost(g, img, fake, false);
    drawPoints(top, Object.assign({}, fake, { pts: img }), true);
  }

  // Live feedback while turning or resizing.
  if (drag && drag.type === 'rotate') {
    drawGhost(g, drag.free, shapes[0], false);
    centerMarker(g, drag.C);
  } else if (drag && drag.type === 'dilate') {
    const gg = el('g', {}, g);
    state.pts.forEach(P => el('line', { class: 'guide-line', c: shapes[0].color, x1: X(drag.C.x), y1: Y(drag.C.y), x2: X(P.x), y2: Y(P.y) }, gg));
    centerMarker(g, drag.C);
  }

  for (let i = shapes.length - 1; i >= 0; i--) drawPoints(top, shapes[i], false);
  paintHighlight(false);
}

/* ------------------------------------------------------------
   10. Highlighting (graph ⇄ measurements)
   ------------------------------------------------------------ */

function setHL(key, fromGraph) {
  if (state.hl === key) return;
  state.hl = key;
  paintHighlight(fromGraph);
}

function paintHighlight(reveal) {
  document.querySelectorAll('#tool .is-hl').forEach(n => n.classList.remove('is-hl'));
  const key = state.hl;
  if (pairLayer) pairLayer.textContent = '';
  if (!key) return;
  const sel = `[data-key="${key}"]`;
  svg.querySelectorAll(sel).forEach(n => n.classList.add('is-hl'));
  const rows = infoBody.querySelectorAll(sel);
  rows.forEach(n => n.classList.add('is-hl'));
  if (reveal && rows[0]) revealRow(rows[0]);
  showPairs(key);
}

/**
 * A hovered point is joined to its pair in the shape it came from and in the
 * shape made from it (A to A′, A′ to A″), drawn in the style of the
 * transformation that links them. The paired points and their coordinates
 * light up too.
 */
function showPairs(key) {
  const m = /^s(\d+):p(\d+)$/.exec(key);
  if (!m || shapes.length < 2 || !pairLayer) return;
  const k = +m[1], i = +m[2];
  [k - 1, k + 1].forEach(j => {
    if (j < 0 || j >= shapes.length || !shapes[j].pts[i]) return;
    const from = shapes[Math.min(j, k)].pts[i], to = shapes[Math.max(j, k)].pts[i];
    const img = shapes[Math.max(j, k)];
    drawGuide(pairLayer, img.T, [from], [to], img.color);
    document.querySelectorAll(`#tool [data-key="s${j}:p${i}"]`).forEach(n => n.classList.add('is-hl'));
  });
}

/** Scroll only the measurements panel (never the page) to show a row. */
function revealRow(row) {
  const box = infoBody.getBoundingClientRect(), r = row.getBoundingClientRect();
  const k = box.height / (infoBody.clientHeight || box.height || 1);   // 2 when popped out
  if (r.top < box.top + 6) infoBody.scrollTop -= (box.top + 6 - r.top) / k;
  else if (r.bottom > box.bottom - 6) infoBody.scrollTop += (r.bottom - box.bottom + 6) / k;
}

/* ------------------------------------------------------------
   11. The measurements panel
   ------------------------------------------------------------ */

function esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]); }

function groupHead(sh, withDesc) {
  const k = 's' + sh.idx;
  const tag = sh.idx === 0 ? (sh.complete ? 'original' : sh.tag) : 'image ' + sh.idx;
  let html = `<div class="group-head" data-key="${k}"><span class="group-name">${esc(sh.name)}</span><span class="group-tag">${esc(tag)}</span></div>`;
  if (withDesc && sh.T) html += `<p class="group-desc">${esc(sh.T.title)} <span class="rule">${esc(sh.T.rule)}</span></p>`;
  return html;
}

function renderInfo() {
  if (!shapes.length) {
    const word = TYPE_WORDS[state.mode];
    coordsList.innerHTML = `<p class="field-empty">Click grid points on the plane to place the ${state.mode === 'circle' ? 'center of the circle, then a point on it' : 'corners of the ' + word}.</p>`;
    lengthsList.innerHTML = '<p class="field-empty">Side lengths appear as soon as two points are placed.</p>';
    areaList.innerHTML = '<p class="field-empty">The area and its formula appear when the shape is finished.</p>';
    return;
  }
  let coords = '', lens = '', areas = '';
  shapes.forEach(sh => {
    const k = 's' + sh.idx, style = `style="--c: ${sh.color}"`;
    coords += `<div class="group" ${style}>${groupHead(sh, true)}<ul class="coord-list">` +
      sh.pts.map((P, i) => `<li class="coord" data-key="${k}:p${i}"><b>${sh.labels[i]}</b> ${pair(P)}</li>`).join('') + '</ul></div>';

    const rows = [];
    sh.sides.forEach(s => rows.push(`<li class="len" data-key="${k}:${s.key}"><span class="len-swatch" aria-hidden="true"></span><span class="len-text">${esc(s.text)}</span></li>`));
    sh.aux.forEach(ax => rows.push(`<li class="len is-aux" data-key="${k}:x${ax.key}"><span class="len-swatch" aria-hidden="true"></span><span class="len-text">${esc(ax.text)}</span><span class="len-tag">${esc(ax.note)}</span></li>`));
    sh.extras.forEach(x => rows.push(`<li class="len is-derived"${x.graph ? ` data-key="${k}:${x.key}"` : ''}><span class="len-swatch" aria-hidden="true"></span><span class="len-text">${esc(x.text)}</span><span class="len-tag">${esc(x.note)}</span></li>`));
    if (rows.length) {
      lens += `<div class="group" ${style}>${groupHead(sh, false)}<ul class="len-list">${rows.join('')}</ul>` +
        (sh.lenNote ? `<p class="group-note">${esc(sh.lenNote)}</p>` : '') + '</div>';
    }

    if (sh.area) {
      const a = sh.area;
      let eq = a.method ? `<div class="eq-method">${esc(a.method)}</div>` : '';
      eq += `<div class="eq-line eq-formula">${esc(a.formula)}</div>`;
      a.lines.forEach(line => { eq += `<div class="eq-line">${esc(line)}</div>`; });
      if (a.result) eq += `<div class="eq-line eq-result">= ${esc(a.result)} square units</div>`;
      areas += `<div class="group" ${style}>${groupHead(sh, false)}<div class="area-eq">${eq}</div>` +
        (a.warn ? `<p class="group-note warn-note">${esc(a.warn)}</p>` : '') +
        (a.note ? `<p class="group-note">${esc(a.note)}</p>` : '') +
        (sh.areaNote ? `<p class="group-note">${esc(sh.areaNote)}</p>` : '') + '</div>';
    }
  });
  coordsList.innerHTML = coords;
  lengthsList.innerHTML = lens || '<p class="field-empty">Side lengths appear as soon as two points are placed.</p>';
  areaList.innerHTML = areas || '<p class="field-empty">The area and its formula appear when the shape is finished.</p>';
}

infoBody.addEventListener('mouseover', ev => {
  const row = ev.target.closest('[data-key]');
  setHL(row ? row.dataset.key : null, false);
});
infoBody.addEventListener('mouseleave', () => setHL(null, false));

/* ------------------------------------------------------------
   12. Controls and the status line
   ------------------------------------------------------------ */

function renderControls() {
  const base = shapes[0], last = shapes[shapes.length - 1];
  moveBtns.forEach(b => { b.disabled = !state.complete; });
  if (!state.complete) {
    movesNote.innerHTML = 'Finish a shape first.';
  } else {
    movesNote.innerHTML = `Applies to <b style="color:${last.color}">${esc(last.name)}</b>`;
  }
  const removePoint = !state.complete && state.pts.length > 0;
  undoBtn.textContent = removePoint ? 'Undo point' : 'Undo';
  undoBtn.title = removePoint ? 'Remove the last point' : 'Undo the last transformation';
  undoBtn.disabled = !removePoint && !state.chain.length;
  shapeRadios.forEach(r => { r.checked = r.value === state.mode; });
  sidesBox.hidden = state.mode !== 'custom';
  sidesOut.textContent = state.sides;
  sidesDown.disabled = state.sides <= MIN_SIDES;
  sidesUp.disabled = state.sides >= MAX_SIDES;
  zoomBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));

  let msg;
  if (statusFlash) msg = statusFlash;
  else if (!base) {
    msg = state.mode === 'circle' ? 'Click a grid point for the <b>center</b> of the circle.'
      : `Click <b>${maxPts()}</b> grid points to make a ${TYPE_WORDS[state.mode]}.`;
  } else if (!state.complete) {
    const left = maxPts() - state.pts.length;
    msg = state.mode === 'circle' ? 'Now click a grid point <b>on the circle</b>. Drag the center to move it.'
      : `<b>${left}</b> more ${left === 1 ? 'point' : 'points'} to go. Drag a point to move it.`;
  } else if (state.mode === 'circle') {
    msg = '<b>Drag inside</b> to move the circle · <b>drag point A</b> to change its size';
  } else {
    msg = '<b>Drag inside</b> to move · <b>drag a side</b> to rotate · <b>drag a corner</b> to grow or shrink';
  }
  if (state.view !== 'all' && !statusFlash) msg += ` <span class="status-view">· Zoomed in on ${VIEWS[state.view].name}</span>`;
  statusEl.innerHTML = msg;
  statusEl.classList.toggle('is-warn', !!statusFlash);
}

let flashTimer = 0;
function flash(msg) {
  statusFlash = msg;
  renderControls();
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { statusFlash = null; renderControls(); }, 3200);
}

function render() {
  shapes = buildShapes();
  if (selected >= shapes.length || !state.complete) { selected = -1; shapeAction.hidden = true; }
  drawContent();
  renderInfo();
  renderControls();
  paintHighlight(false);
}

/* ------------------------------------------------------------
   13. Pointer: placing, dragging, moving, turning, resizing
   ------------------------------------------------------------ */

/** What is under a pixel position. Points beat sides, sides beat helper lines, lines beat insides. */
function hitTest(p, baseOnly) {
  if (!shapes.length) return null;
  const order = baseOnly ? [shapes[0]] : [shapes[0], ...shapes.slice(1).reverse()];
  for (const sh of order) {
    for (let i = 0; i < sh.pts.length; i++) {
      const q = toPx(sh.pts[i]);
      if (Math.hypot(q.x - p.x, q.y - p.y) <= geo.hitR) return { sh, kind: 'p', i };
    }
  }
  const segDist = (a, b) => {
    const A = toPx(a), B = toPx(b), dx = B.x - A.x, dy = B.y - A.y, l2 = dx * dx + dy * dy || 1;
    const t = clamp(((p.x - A.x) * dx + (p.y - A.y) * dy) / l2, 0, 1);
    return Math.hypot(A.x + t * dx - p.x, A.y + t * dy - p.y);
  };
  for (const sh of order) {
    if (sh.kind === 'circle' && sh.pts.length === 2) {
      const o = toPx(sh.pts[0]), r = Math.sqrt(d2(sh.pts[0], sh.pts[1])) * geo.unit;
      if (Math.abs(Math.hypot(o.x - p.x, o.y - p.y) - r) <= geo.tol) return { sh, kind: 'c' };
    }
    for (const s of sh.sides) if (segDist(sh.pts[s.i], sh.pts[s.j]) <= geo.tol) return { sh, kind: 'e', s };
  }
  if (!baseOnly) {
    for (const sh of order) for (const ax of sh.aux) if (segDist(ax.a, ax.b) <= geo.tol * .8) return { sh, kind: 'x', ax };
  }
  const w = toWorld(p);
  for (const sh of order) {
    if (!sh.complete) continue;
    const inside = sh.kind === 'circle' ? d2(w, sh.pts[0]) <= d2(sh.pts[0], sh.pts[1]) : insidePoly(w, sh.pts);
    if (inside) return { sh, kind: 'in' };
  }
  return null;
}

function keyOf(h) {
  const k = 's' + h.sh.idx;
  if (h.kind === 'p') return `${k}:p${h.i}`;
  if (h.kind === 'e') return `${k}:${h.s.key}`;
  if (h.kind === 'c') return `${k}:c`;
  if (h.kind === 'x') return `${k}:x${h.ax.key}`;
  return k;
}

/** Grid points near a position, nearest first. */
function latticeNear(w, radius = 3) {
  const out = [], cx = Math.round(w.x), cy = Math.round(w.y);
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) out.push({ x: cx + dx, y: cy + dy });
  }
  return out.sort((a, b) => d2(a, w) - d2(b, w));
}

function setCursor(name) {
  svg.classList.remove('cur-add', 'cur-grab', 'cur-move', 'cur-resize', 'cur-rotate', 'cur-pick', 'is-dragging');
  if (name) svg.classList.add(name);
}

function showTip(p, html) {
  if (!html) { tipEl.hidden = true; return; }
  tipEl.innerHTML = html;
  tipEl.hidden = false;
  tipEl.style.left = p.x + 'px';
  tipEl.style.top = p.y + 'px';
  tipEl.classList.toggle('flip', p.x > geo.W * .6);
}

function onHover(p) {
  const h = hitTest(p, false);
  let cursor = !state.complete && inView(toWorld(p)) ? 'cur-add' : '', tip = '';
  if (h) {
    const sh = h.sh, isBase = sh.idx === 0;
    if (h.kind === 'p') {
      tip = `<span class="tip-math">${esc(sh.labels[h.i])} ${pair(sh.pts[h.i])}</span>`;
      if (isBase && !state.complete) { cursor = 'cur-grab'; tip += ' · drag to move'; }
      else if (isBase && sh.kind === 'circle') {
        cursor = h.i === 1 ? 'cur-resize' : 'cur-move';
        tip += h.i === 1 ? ' · drag to change the size' : ' · drag to move';
      } else if (isBase) { cursor = 'cur-resize'; tip += ' · drag to grow or shrink'; }
    } else if (h.kind === 'e') {
      tip = `<span class="tip-math">${esc(h.s.label)} = ${esc(fmtLenFull(h.s.L))}</span>`;
      if (isBase && state.complete) { cursor = 'cur-rotate'; tip += ' · drag to rotate'; }
    } else if (h.kind === 'c') {
      tip = `<span class="tip-math">${esc(sh.extras[1].text)}</span>`;
      if (isBase) { cursor = 'cur-move'; tip += ' · drag to move'; }
    } else if (h.kind === 'x') {
      tip = `<span class="tip-math">${esc(h.ax.label)} = ${esc(fmtLenFull(h.ax.L))}</span> (${esc(h.ax.note)})`;
      if (isBase && state.complete) cursor = 'cur-move';
    } else {
      tip = esc(sh.name);
      if (isBase) { cursor = 'cur-move'; tip += ' · drag to move, click to delete'; }
      else { cursor = 'cur-pick'; tip += ' · click to delete'; }
    }
  }
  setCursor(cursor);
  showTip(p, tip);
  setHL(h ? keyOf(h) : null, true);
}

function onDown(ev) {
  if (ev.button !== 0 || !geo) return;
  const p = eventPx(ev), w = toWorld(p);
  let d = null;
  if (selected >= 0) select(-1);
  if (!state.complete) {
    const h = shapes.length ? hitTest(p, true) : null;
    if (h && h.kind === 'p') d = { type: 'point', i: h.i };
    else {
      const L = { x: Math.round(w.x), y: Math.round(w.y) };
      if (!onBoard(L) || !inView(L)) return;
      const at = state.pts.findIndex(P => same(P, L));
      if (at >= 0) d = { type: 'point', i: at };
      else {
        const next = state.pts.concat([L]);
        if (next.length === maxPts() && !baseOK(next, true)) {
          flash(state.mode === 'triangle' ? 'Those three points are on one line. Pick a point off the line.'
            : 'All of those points are on one line. Pick a point off the line.');
          return;
        }
        state.pts.push(L);
        d = { type: 'point', i: state.pts.length - 1 };
      }
    }
  } else {
    const h = hitTest(p, true);
    // Not the original: maybe an image, which a click selects for deleting.
    const img = h ? null : hitTest(p, false);
    if (!h && !(img && img.sh.idx > 0)) {
      if (inView(w)) flash('One shape at a time: click it to delete it, or press <b>Clear all</b>, to start a new one.');
      return;
    }
    const P0 = state.pts.map(q => ({ x: q.x, y: q.y }));
    if (!h) d = { type: 'pick', idx: img.sh.idx };
    else
    if (state.mode === 'circle') {
      d = h.kind === 'p' && h.i === 1 ? { type: 'point', i: 1 } : { type: 'move', P0, start: w };
    } else if (h.kind === 'p') d = startDilate(h.i, P0);
    else if (h.kind === 'e') d = startRotate(P0, w);
    else d = { type: 'move', P0, start: w };
  }
  if (!d) return;
  drag = d;
  drag.id = ev.pointerId;
  drag.down = p;
  drag.moved = false;
  try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* pointer already gone */ }
  ev.preventDefault();
  setCursor('is-dragging');
  newIdx = -1;
  render();
  dragFeedback(p);
}

function startRotate(P0, w) {
  const C = latticeCenter(P0);
  return { type: 'rotate', P0, C, a0: Math.atan2(w.y - C.y, w.x - C.x), q: 0, free: P0 };
}

function startDilate(i, P0) {
  // Grow from the grid point nearest the middle; if that is the corner being dragged, the next nearest.
  const mid = centroid(P0);
  const C = latticeNear(mid, 2).find(c => !same(c, P0[i]));
  const v = sub(P0[i], C);
  // Every scale factor (as n/d) that keeps all the corners on grid points.
  const ks = [];
  const seen = new Set();
  for (let den = 1; den <= 12; den++) {
    for (let num = 1; num <= den * 6; num++) {
      const f = frac(num, den), key = f.n + '/' + f.d;
      if (seen.has(key)) continue;
      seen.add(key);
      const pts = P0.map(P => ({ x: C.x + (P.x - C.x) * num / den, y: C.y + (P.y - C.y) * num / den }));
      const snapped = snapPts(pts);
      if (snapped && snapped.every(onBoard)) ks.push({ f, pts: snapped, v: num / den });
    }
  }
  return { type: 'dilate', i, P0, C, v, ks, k: { n: 1, d: 1 } };
}

function onMove(ev) {
  if (!geo) return;
  const p = eventPx(ev);
  if (!drag) { if (ev.pointerType === 'mouse') onHover(p); return; }
  if (ev.pointerId !== drag.id) return;
  if (Math.hypot(p.x - drag.down.x, p.y - drag.down.y) > 5) drag.moved = true;
  if (drag.type === 'pick' || !drag.moved) return;
  const w = toWorld(p);
  let changed = false;
  const tryPts = pts => {
    if (!baseOK(pts, drag.type === 'point' && state.pts.length === maxPts())) return false;
    if (!pts.every((P, i) => same(P, state.pts[i]))) { state.pts = pts; changed = true; }
    return true;
  };

  if (drag.type === 'point') {
    for (const L of latticeNear(w)) {
      const pts = state.pts.map((P, i) => (i === drag.i ? L : P));
      if (tryPts(pts)) break;
    }
  } else if (drag.type === 'move') {
    const raw = sub(w, drag.start);
    for (const D of latticeNear(raw)) {
      if (tryPts(drag.P0.map(P => ({ x: P.x + D.x, y: P.y + D.y })))) { drag.D = D; break; }
    }
  } else if (drag.type === 'rotate') {
    const C = drag.C;
    let delta = Math.atan2(w.y - C.y, w.x - C.x) - drag.a0;
    while (delta <= -Math.PI) delta += Math.PI * 2;
    while (delta > Math.PI) delta -= Math.PI * 2;
    drag.free = drag.P0.map(P => ({
      x: C.x + (P.x - C.x) * Math.cos(delta) - (P.y - C.y) * Math.sin(delta),
      y: C.y + (P.x - C.x) * Math.sin(delta) + (P.y - C.y) * Math.cos(delta)
    }));
    const dist = q => { let a = Math.abs(delta - q * Math.PI / 2) % (Math.PI * 2); return Math.min(a, Math.PI * 2 - a); };
    const turns = [0, 1, 2, 3].sort((a, b) => dist(a) - dist(b));
    for (const q of turns) {
      const T = makeT('rotate', { deg: q === 0 ? 0 : q === 3 ? 90 : q * 90, dir: q === 3 ? 'cw' : 'ccw', cx: C.x, cy: C.y });
      const pts = q === 0 ? drag.P0 : snapPts(applyT(T, drag.P0));
      if (pts && tryPts(pts)) { drag.q = q; break; }
    }
    changed = true;   // the free ghost moves on every event
  } else if (drag.type === 'dilate') {
    const rawK = Math.max(.05, dot(sub(w, drag.C), drag.v) / dot(drag.v, drag.v));
    const ranked = drag.ks.slice().sort((a, b) => Math.abs(a.v - rawK) - Math.abs(b.v - rawK));
    for (const cand of ranked) if (tryPts(cand.pts)) { drag.k = cand.f; break; }
  }
  if (changed) render();
  dragFeedback(p);
}

/** The read-out next to the pointer while dragging. */
function dragFeedback(p) {
  if (!drag) return;
  let tip = '';
  if (drag.type === 'point') {
    const P = state.pts[drag.i];
    tip = `<span class="tip-math">${esc(labelsFor(state.pts.length, 0)[drag.i])} ${pair(P)}</span>`;
    if (state.mode === 'circle' && state.complete) tip += ` · r = ${esc(fmtLenFull(lenSq(d2(state.pts[0], state.pts[1]))))}`;
    setHL(`s0:p${drag.i}`, true);
  } else if (drag.type === 'move') {
    const D = drag.D || { x: 0, y: 0 };
    const parts = [];
    if (D.x) parts.push(`${Math.abs(D.x)} ${D.x > 0 ? 'right' : 'left'}`);
    if (D.y) parts.push(`${Math.abs(D.y)} ${D.y > 0 ? 'up' : 'down'}`);
    tip = parts.length ? 'Moved ' + parts.join(', ') : 'Drag to move';
  } else if (drag.type === 'rotate') {
    tip = drag.q === 0 ? 'Turn to a quarter turn' : drag.q === 2 ? 'Turned 180°' : `Turned 90° ${drag.q === 1 ? 'counterclockwise' : 'clockwise'}`;
    tip += ` about <span class="tip-math">${pair(drag.C)}</span>`;
  } else if (drag.type === 'dilate') {
    tip = `Scale factor <span class="tip-math">${fmtFrac(drag.k)}</span> from <span class="tip-math">${pair(drag.C)}</span>`;
  }
  showTip(p, tip);
}

function onUp(ev) {
  if (!drag || (ev.pointerId !== undefined && ev.pointerId !== drag.id)) return;
  try { svg.releasePointerCapture(drag.id); } catch (e) { /* already released */ }
  const done = drag;
  drag = null;
  // A click (no drag) on a finished shape selects it for deleting.
  const click = !done.moved && state.complete;
  if (click) {
    render();
    select(done.type === 'pick' ? done.idx : 0, done.down);
    return;
  }
  if (!state.complete && state.pts.length === maxPts()) completeBase();
  render();
  setCursor('');
  if (ev.pointerType === 'mouse' && ev.type === 'pointerup') onHover(eventPx(ev));
  else { showTip(null, ''); setHL(null, false); }
}

/** The last point is in: close the shape (untangling it if the sides cross). */
function completeBase() {
  if (state.mode !== 'circle' && selfIntersects(state.pts)) {
    state.pts = untangle(state.pts);
    flash('The sides crossed, so the corners were put in order around the shape.');
  }
  state.complete = true;
}

svg.addEventListener('pointerdown', onDown);
svg.addEventListener('pointermove', onMove);
svg.addEventListener('pointerup', onUp);
svg.addEventListener('pointercancel', onUp);
svg.addEventListener('pointerleave', () => {
  if (drag) return;
  showTip(null, '');
  setHL(null, false);
});

/* ------------------------------------------------------------
   13b. Selecting and deleting a shape
   Deleting an image also deletes every image made from it; deleting
   the original clears the graph.
   ------------------------------------------------------------ */

function select(idx, p) {
  selected = idx;
  if (idx < 0 || !shapes[idx]) {
    selected = -1;
    shapeAction.hidden = true;
  } else {
    const sh = shapes[idx], later = shapes.length - 1 - idx;
    shapeAction.innerHTML = `Delete ${esc(sh.name)}` +
      (later ? `<small>and ${later === 1 ? 'the image' : 'the ' + later + ' images'} made from it</small>` : '');
    shapeAction.style.left = p.x + 'px';
    shapeAction.style.top = p.y + 'px';
    shapeAction.hidden = false;
    showTip(null, '');
    setCursor('');
  }
  drawContent();
}

function deleteShape(idx) {
  if (idx === 0) resetShape();
  else state.chain.length = idx - 1;
  selected = -1;
  shapeAction.hidden = true;
  newIdx = -1;
  render();
}

shapeAction.addEventListener('click', () => { if (selected >= 0) deleteShape(selected); });
document.addEventListener('keydown', ev => {
  if (selected < 0 || isModalOpen()) return;
  if (ev.key === 'Escape') select(-1);
  else if ((ev.key === 'Delete' || ev.key === 'Backspace') && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
    ev.preventDefault();
    deleteShape(selected);
  }
});

/* ------------------------------------------------------------
   13c. Measurements as a floating ×2 window
   ------------------------------------------------------------ */

let pop = null;   // { x, y, w, h } while popped out

function placePop() {
  const w2 = pop.w * 2;
  pop.x = clamp(pop.x, 80 - w2, innerWidth - 80);
  pop.y = clamp(pop.y, 0, Math.max(0, innerHeight - 48));
  infoPanel.style.left = pop.x + 'px';
  infoPanel.style.top = pop.y + 'px';
  infoPanel.style.width = pop.w + 'px';
  infoPanel.style.height = pop.h + 'px';
}

function openPop() {
  const r = infoPanel.getBoundingClientRect();
  // Narrow enough that, doubled, it still leaves part of the plane uncovered; fully on screen.
  const w = Math.max(240, Math.min(r.width, innerWidth * .22, (innerWidth - 24) / 2));
  const h = Math.min(r.height, (innerHeight - 24) / 2);
  pop = { w, h, x: innerWidth - w * 2 - 12, y: clamp(r.top, 12, innerHeight - h * 2 - 12) };
  infoPanel.classList.add('is-floating');
  layoutEl.classList.add('info-out');
  placePop();
  popBtn.setAttribute('aria-pressed', 'true');
  popBtn.setAttribute('aria-label', 'Put the measurements back beside the graph');
  popBtn.title = 'Put back';
}

function closePop() {
  pop = null;
  infoPanel.classList.remove('is-floating', 'is-dragging');
  layoutEl.classList.remove('info-out');
  ['left', 'top', 'width', 'height'].forEach(k => { infoPanel.style[k] = ''; });
  popBtn.setAttribute('aria-pressed', 'false');
  popBtn.setAttribute('aria-label', 'Pop out the measurements at double size');
  popBtn.title = 'Pop out at double size';
}

popBtn.addEventListener('click', () => (pop ? closePop() : openPop()));

infoPanel.addEventListener('pointerdown', ev => {
  if (!pop || ev.button !== 0 || !ev.target.closest('.panel-head') || ev.target.closest('button')) return;
  const start = { x: ev.clientX, y: ev.clientY, px: pop.x, py: pop.y };
  infoPanel.classList.add('is-dragging');
  const move = e => { pop.x = start.px + e.clientX - start.x; pop.y = start.py + e.clientY - start.y; placePop(); };
  const end = () => {
    infoPanel.classList.remove('is-dragging');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  ev.preventDefault();
});

window.addEventListener('resize', () => {
  if (!pop) return;
  if (innerWidth <= 760) closePop();
  else placePop();
});

/* ------------------------------------------------------------
   14. Shape type, zoom, undo and clear
   ------------------------------------------------------------ */

function resetShape() {
  state.pts = [];
  state.complete = false;
  state.chain = [];
  state.preview = null;
  state.hl = null;
  newIdx = -1;
}

function describeWork() {
  const base = shapes[0], n = state.chain.length;
  if (!base) return '';
  return `This removes ${base.complete ? base.name : 'the points you placed'}` +
    (n ? ` and its ${n === 1 ? 'image' : n + ' images'}` : '') + ' from the graph.';
}

/** Switch shape type / point count. Unfinished points carry over; a finished shape asks first. */
function changeShape(mode, sides) {
  const apply = () => {
    if (state.complete || state.chain.length) resetShape();
    state.mode = mode;
    state.sides = sides;
    const max = maxPts();
    if (state.pts.length > max) state.pts.length = max;
    if (state.pts.length === max) {
      if (baseOK(state.pts, true)) completeBase();
      else state.pts.pop();
    }
    render();
  };
  if (state.complete && state.pts.length) {
    openModal({
      title: 'Start a new shape?',
      html: `<p>Only one shape can be drawn at a time. ${esc(describeWork())}</p>`,
      actions: [
        { label: 'Keep it', cls: 'btn-ghost', onClick: () => renderControls() },
        { label: 'Start a new shape', cls: 'btn-solid-danger', onClick: apply }
      ],
      onClose: renderControls
    });
  } else apply();
}

shapeRadios.forEach(r => r.addEventListener('change', () => { if (r.checked) changeShape(r.value, state.sides); }));
sidesDown.addEventListener('click', () => changeShape('custom', Math.max(MIN_SIDES, state.sides - 1)));
sidesUp.addEventListener('click', () => changeShape('custom', Math.min(MAX_SIDES, state.sides + 1)));

zoomBtns.forEach(b => b.addEventListener('click', () => {
  state.view = b.dataset.view;
  refreshPlane();
}));

undoBtn.addEventListener('click', () => {
  if (!state.complete && state.pts.length) state.pts.pop();
  else if (state.chain.length) state.chain.pop();
  newIdx = -1;
  render();
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (!state.pts.length) return;
  openModal({
    title: 'Clear the graph?',
    html: `<p>${esc(describeWork())}</p>`,
    actions: [
      { label: 'Cancel', cls: 'btn-ghost' },
      { label: 'Clear all', cls: 'btn-solid-danger', onClick: () => { resetShape(); render(); } }
    ]
  });
});

document.getElementById('helpBtn').addEventListener('click', () => {
  openModal({
    title: 'How it works',
    html: `<ol class="help-list">
      <li><strong>Pick a shape</strong> beside the graph, then click grid points: 2 for a circle (center, then a point on it), 3 for a triangle, 4 for a quadrilateral, or set your own number with <strong>Custom</strong>.</li>
      <li>Until the last point is in, <strong>drag any point</strong> to move it. Points always snap to whole coordinates.</li>
      <li>When the shape is done: <strong>drag inside</strong> to move it, <strong>drag a side</strong> to rotate it in quarter turns, and <strong>drag a corner</strong> to grow or shrink it. For a circle, drag point A to change the radius.</li>
      <li>Use <strong>Translate, Reflect, Rotate or Dilate</strong> on the left to make an image of the newest shape. Press one again to transform that image.</li>
      <li><strong>Hover</strong> a point, side or dashed helper line to light up its row in Measurements, and the other way round.</li>
      <li><strong>Click a shape</strong> without dragging it to delete it. Deleting an image also deletes the images made from it.</li>
      <li>Use <strong>All · I · II · III · IV</strong> to zoom into one quadrant, and the magnifier on Measurements to pop it out at double size.</li>
    </ol>`,
    actions: [{ label: 'Got it', cls: 'btn-primary' }]
  });
});

/* ------------------------------------------------------------
   15. Pop-ups
   ------------------------------------------------------------ */

let modalCleanup = null;
let modalOpener = null;

const isModalOpen = () => modalRoot.classList.contains('open');

function closeModal() {
  if (!isModalOpen()) return;
  modalRoot.classList.remove('open');
  modalRoot.setAttribute('aria-hidden', 'true');
  modalRoot.innerHTML = '';
  const done = modalCleanup;
  modalCleanup = null;
  if (done) done();
  if (modalOpener && document.contains(modalOpener) && !modalOpener.disabled) modalOpener.focus();
  modalOpener = null;
}

/**
 * openModal({ title, html, actions: [{ label, cls, submit, onClick }], side, onOpen, onClose })
 * An action whose onClick returns false keeps the pop-up open.
 */
function openModal(cfg) {
  if (isModalOpen()) closeModal();
  modalOpener = document.activeElement;
  modalRoot.innerHTML = '';
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop' + (cfg.side ? ' is-side' : '');
  const box = document.createElement('form');
  box.className = 'modal';
  box.noValidate = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'modalTitle');
  box.innerHTML = `<h2 class="modal-title" id="modalTitle">${esc(cfg.title)}</h2><div class="modal-body">${cfg.html || ''}</div>`;
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  let submitAction = null;
  (cfg.actions || []).forEach(a => {
    const b = document.createElement('button');
    b.type = a.submit ? 'submit' : 'button';
    b.className = 'btn ' + (a.cls || 'btn-ghost');
    b.textContent = a.label;
    if (a.submit) { submitAction = a; b.dataset.submit = ''; }
    else {
      b.addEventListener('click', () => {
        if (a.onClick && a.onClick(box) === false) return;
        closeModal();
      });
    }
    actions.appendChild(b);
  });
  box.appendChild(actions);
  box.addEventListener('submit', ev => {
    ev.preventDefault();
    if (submitAction && submitAction.onClick && submitAction.onClick(box) === false) return;
    closeModal();
  });
  backdrop.appendChild(box);
  backdrop.addEventListener('mousedown', ev => { if (ev.target === backdrop) closeModal(); });
  modalRoot.appendChild(backdrop);
  modalRoot.classList.add('open');
  modalRoot.setAttribute('aria-hidden', 'false');
  modalCleanup = cfg.onClose || null;
  if (cfg.onOpen) cfg.onOpen(box);
  const focusTarget = box.querySelector('input:checked, input:not([type="radio"])') || actions.querySelector('.btn');
  if (focusTarget) focusTarget.focus();
}

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && isModalOpen()) closeModal();
});

/* --- shared pieces of the transformation forms --- */

function stepperHtml(id, label, value, hintId) {
  return `<div><label class="form-label" for="${id}">${label}</label>
    <div class="stepper">
      <button class="step-btn" type="button" data-step="-1" data-for="${id}" aria-label="Decrease">−</button>
      <input class="num-input" id="${id}" type="text" inputmode="numeric" value="${value}" autocomplete="off"${hintId ? ` aria-describedby="${hintId}"` : ''}>
      <button class="step-btn" type="button" data-step="1" data-for="${id}" aria-label="Increase">+</button>
    </div>${hintId ? `<p class="field-hint" id="${hintId}"></p>` : ''}</div>`;
}

function centerHtml(name) {
  return `<fieldset class="form-block"><legend>Center</legend>
    <div class="choice-grid">
      <label class="choice is-wide"><input type="radio" name="${name}" value="origin" checked> The origin <span class="math">(0, 0)</span></label>
      <label class="choice is-wide"><input type="radio" name="${name}" value="point"> Point
        (<input class="num-input is-small" id="${name}X" type="text" inputmode="numeric" value="0" aria-label="Center x">,
        <input class="num-input is-small" id="${name}Y" type="text" inputmode="numeric" value="0" aria-label="Center y">)</label>
    </div></fieldset>`;
}

/** A whole number from a text box, or null. Accepts a typed "−". */
function readInt(box, id) {
  const raw = (box.querySelector('#' + id).value || '').trim().replace(/[−–]/g, '-');
  return /^-?\d{1,3}$/.test(raw) ? parseInt(raw, 10) : null;
}

function readCenter(box, name) {
  const pick = box.querySelector(`input[name="${name}"]:checked`).value;
  if (pick === 'origin') return { cx: 0, cy: 0 };
  const cx = readInt(box, name + 'X'), cy = readInt(box, name + 'Y');
  if (cx === null || cy === null) return { error: 'Type whole numbers for the center.' };
  if (!onBoard({ x: cx, y: cy })) return { error: `Keep the center between ${MINUS}10 and 10.` };
  return { cx, cy };
}

/** A scale factor typed as 2, 1/2, 0.5 or 1.5. */
function readK(raw) {
  const s = (raw || '').trim().replace(/[−–]/g, '-').replace(/\s+/g, '');
  let v = null;
  const m = s.match(/^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/);
  if (m) v = m[2] ? parseFloat(m[1]) / parseFloat(m[2]) : parseFloat(m[1]);
  if (v === null || !isFinite(v)) return { error: 'Type a positive number such as 2, 1/2 or 1.5.' };
  if (v <= 0) return { error: 'The scale factor has to be greater than 0.' };
  if (v > 10) return { error: 'Keep the scale factor at 10 or less.' };
  const f = toFrac(v);
  if (!f) return { error: 'Use a fraction with a small denominator, such as 1/3.' };
  if (f.n === f.d) return { hint: 'A scale factor of 1 leaves the shape the same size.' };
  return { k: f };
}

const FORMS = {
  translate: {
    title: 'Translate',
    submit: 'Translate',
    html: () => `<div class="num-grid">${stepperHtml('tx', 'Left / right (x)', 0, 'txHint')}${stepperHtml('ty', 'Down / up (y)', 0, 'tyHint')}</div>`,
    read(box) {
      const dx = readInt(box, 'tx'), dy = readInt(box, 'ty');
      const hint = (n, pos, neg) => (n === null ? '' : n === 0 ? 'no change' : `${Math.abs(n)} ${n > 0 ? pos : neg}`);
      box.querySelector('#txHint').textContent = hint(dx, 'right', 'left');
      box.querySelector('#tyHint').textContent = hint(dy, 'up', 'down');
      if (dx === null || dy === null) return { error: 'Type whole numbers, like 3 or −2.' };
      if (Math.abs(dx) > 20 || Math.abs(dy) > 20) return { error: `Keep each move between ${MINUS}20 and 20.` };
      if (!dx && !dy) return { hint: 'Choose how far to slide: positive is right or up, negative is left or down.' };
      return { T: makeT('translate', { dx, dy }) };
    }
  },
  reflect: {
    title: 'Reflect',
    submit: 'Reflect',
    html: () => `<fieldset class="form-block"><legend>Reflect over</legend><div class="choice-grid">
      <label class="choice"><input type="radio" name="line" value="x-axis" checked> the x-axis</label>
      <label class="choice"><input type="radio" name="line" value="y-axis"> the y-axis</label>
      <label class="choice"><input type="radio" name="line" value="y=x"> the line <span class="math">y = x</span></label>
      <label class="choice"><input type="radio" name="line" value="y=-x"> the line <span class="math">y = ${MINUS}x</span></label>
      <label class="choice is-wide"><input type="radio" name="line" value="x=k"> the line <span class="math">x =</span> <input class="num-input is-small" id="lineX" type="text" inputmode="numeric" value="1" aria-label="x value of the vertical line"></label>
      <label class="choice is-wide"><input type="radio" name="line" value="y=k"> the line <span class="math">y =</span> <input class="num-input is-small" id="lineY" type="text" inputmode="numeric" value="1" aria-label="y value of the horizontal line"></label>
      <label class="choice is-wide"><input type="radio" name="line" value="mx+b"> the line <input class="num-input is-eq" id="lineEq" type="text" value="y = x + 2" autocomplete="off" spellcheck="false" aria-label="Line in slope-intercept form, y = mx + b"></label>
    </div></fieldset>`,
    read(box) {
      const line = box.querySelector('input[name="line"]:checked').value;
      const p = { line };
      if (line === 'mx+b') {
        const r = readLine(box.querySelector('#lineEq').value);
        if (r.error || r.hint) return r;
        p.m = r.m; p.b = r.b;
      } else if (line === 'x=k' || line === 'y=k') {
        const k = readInt(box, line === 'x=k' ? 'lineX' : 'lineY');
        if (k === null) return { error: 'Type a whole number for the line.' };
        if (Math.abs(k) > LIM) return { error: `Keep the line between ${MINUS}10 and 10.` };
        p.k = k;
      }
      return { T: makeT('reflect', p) };
    }
  },
  rotate: {
    title: 'Rotate',
    submit: 'Rotate',
    html: () => `<fieldset class="form-block"><legend>Angle</legend><div class="choice-grid is-row">
        <label class="choice"><input type="radio" name="deg" value="90" checked> 90°</label>
        <label class="choice"><input type="radio" name="deg" value="180"> 180°</label>
        <label class="choice"><input type="radio" name="deg" value="270"> 270°</label>
      </div></fieldset>
      <fieldset class="form-block"><legend>Direction</legend><div class="choice-grid">
        <label class="choice"><input type="radio" name="dir" value="ccw" checked> ⟲ Counterclockwise</label>
        <label class="choice"><input type="radio" name="dir" value="cw"> ⟳ Clockwise</label>
      </div></fieldset>${centerHtml('rc')}`,
    read(box) {
      const deg = +box.querySelector('input[name="deg"]:checked').value;
      box.querySelectorAll('input[name="dir"]').forEach(r => { r.disabled = deg === 180; });
      const dir = box.querySelector('input[name="dir"]:checked').value;
      const c = readCenter(box, 'rc');
      if (c.error) return c;
      return { T: makeT('rotate', { deg, dir, cx: c.cx, cy: c.cy }) };
    }
  },
  dilate: {
    title: 'Dilate',
    submit: 'Dilate',
    html: () => `<label class="form-label" for="kIn">Scale factor <span class="math">k</span></label>
      <input class="num-input" id="kIn" type="text" inputmode="decimal" value="2" autocomplete="off" aria-describedby="kHint">
      <p class="field-hint" id="kHint">k &gt; 1 enlarges · 0 &lt; k &lt; 1 shrinks</p>
      <div class="chips" id="kChips" aria-label="Scale factors that keep every point on the grid"></div>
      ${centerHtml('dc')}`,
    read(box, src) {
      const c = readCenter(box, 'dc');
      // Offer only the scale factors that keep every corner on a grid point.
      const chips = box.querySelector('#kChips');
      const key = c.error ? '' : c.cx + ',' + c.cy;
      if (chips.dataset.key !== key) {
        chips.dataset.key = key;
        chips.innerHTML = '';
        if (!c.error) {
          const opts = [[1, 4], [1, 3], [1, 2], [2, 3], [3, 4], [3, 2], [2, 1], [5, 2], [3, 1], [4, 1]].filter(([n, d]) =>
            snapPts(applyT(makeT('dilate', { k: frac(n, d), cx: c.cx, cy: c.cy }), src.pts)));
          opts.forEach(([n, d]) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'chip';
            b.textContent = fmtFrac(frac(n, d));
            b.addEventListener('click', () => { box.querySelector('#kIn').value = b.textContent; box.dispatchEvent(new Event('input')); });
            chips.appendChild(b);
          });
          if (!opts.length) chips.innerHTML = '<span class="field-hint">No simple scale factor keeps every point on the grid from this center. Try another center.</span>';
        }
      }
      if (c.error) return c;
      const k = readK(box.querySelector('#kIn').value);
      if (!k.k) return k;
      return { T: makeT('dilate', { k: k.k, cx: c.cx, cy: c.cy }) };
    }
  }
};

function openTransform(type) {
  if (!state.complete) return;
  if (selected >= 0) select(-1);
  const form = FORMS[type];
  const src = shapes[shapes.length - 1];
  const next = describe(src.pts, src.idx + 1);
  const html = `<p class="modal-lead">Transforms <b style="--c:${src.color}">${esc(src.name)}</b> into a new shape,
      <b style="--c:${colorOf(src.idx + 1)}">${esc(next.name)}</b>.</p>
    ${form.html()}
    <div class="rule-box"><span class="form-label">Rule</span><output class="rule-out" id="ruleOut">—</output></div>
    <p class="modal-msg" id="modalMsg" role="status"></p>`;

  let current = null;
  const update = box => {
    const r = form.read(box, src);
    const msg = box.querySelector('#modalMsg'), submitBtn = box.querySelector('[data-submit]');
    let text = r.error || r.hint || '', cls = r.error ? 'is-error' : '';
    current = null;
    if (r.T) {
      const img = snapPts(applyT(r.T, src.pts));
      if (!img) {
        const bad = applyT(r.T, src.pts).findIndex(P => !isInt(P.x) || !isInt(P.y));
        text = `${next.labels[bad]} would land at ${pair(applyT(r.T, src.pts)[bad])}, between grid points. Pick one of the scale factors shown.`;
        cls = 'is-error';
      } else {
        current = r.T;
        if (!img.every(onBoard)) { text = 'Part of the new shape is off the grid. It will still be measured.'; cls = 'is-warn'; }
      }
    }
    box.querySelector('#ruleOut').textContent = r.T ? r.T.rule : '—';
    msg.textContent = text;
    msg.className = 'modal-msg ' + cls;
    submitBtn.disabled = !current;
    state.preview = current;
    drawContent();
  };

  openModal({
    title: form.title + ' ' + src.name,
    html,
    side: true,
    actions: [
      { label: 'Cancel', cls: 'btn-ghost' },
      {
        label: form.submit, cls: 'btn-primary', submit: true,
        onClick: () => {
          if (!current) return false;
          state.chain.push(current);
          state.preview = null;
          newIdx = state.chain.length;
          render();
          revealNewest();
          return true;
        }
      }
    ],
    onOpen(box) {
      box.addEventListener('input', () => update(box));
      box.addEventListener('change', () => update(box));
      box.addEventListener('click', ev => {
        const step = ev.target.closest('[data-step]');
        if (!step) return;
        const input = box.querySelector('#' + step.dataset.for);
        const v = parseInt((input.value || '0').replace(/[−–]/g, '-'), 10) || 0;
        input.value = String(v + +step.dataset.step).replace('-', MINUS);
        update(box);
      });
      // Typing into a "the line x = _" or center box picks its option.
      box.querySelectorAll('.choice .num-input').forEach(inp => inp.addEventListener('focus', () => {
        const radio = inp.closest('.choice').querySelector('input[type="radio"]');
        if (!radio.checked) { radio.checked = true; update(box); }
      }));
      update(box);
    },
    onClose() { state.preview = null; drawContent(); }
  });
}

moveBtns.forEach(b => b.addEventListener('click', () => openTransform(b.dataset.move)));

/** Bring the new image's coordinates into view in the measurements panel. */
function revealNewest() {
  const head = coordsList.querySelector(`[data-key="s${shapes.length - 1}"]`);
  if (head) revealRow(head.parentElement);
}

/* ------------------------------------------------------------
   16. Start
   ------------------------------------------------------------ */

function refreshPlane() {
  if (selected >= 0) { selected = -1; shapeAction.hidden = true; }
  measure();
  drawPlane();
  render();
}

initSvg();
refreshPlane();
new ResizeObserver(() => {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (geo && Math.abs(w - geo.W) < 1 && Math.abs(h - geo.H) < 1) return;
  refreshPlane();
}).observe(stage);
