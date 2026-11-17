/* ============================================================
   Line Constructions — Geometry
   Build line segments: a whole number of units long, joining two
   points (a line's midpoint counts as a point), as a perpendicular
   from a point to a line, or parallel to another line. Any line can
   be given a midpoint, which stays at its middle. Drag a line's middle to move
   it and an end to turn it. Ends that meet join into one point,
   so lines build into shapes, and a turning line snaps to
   perpendicular and to parallel. Measure any length or angle,
   named in geometry notation.

   Units: world coordinates are grid units, with the origin in the
   middle of the canvas and y pointing up. The size of a unit
   follows the canvas, so a figure keeps its shape on every screen.

   Joined lines behave like one rigid shape. Moving a line moves
   its whole shape; turning an end swings everything beyond that
   end about the other end. Nothing changes length unless the
   teacher changes it (or a perpendicular snap does, as asked).
   ============================================================ */
'use strict';

/* ------------------------------------------------------------
   1. Constants
   ------------------------------------------------------------ */

const NS = 'http://www.w3.org/2000/svg';
const DEG = Math.PI / 180;

/* Line colors are site tokens, so dark mode needs no script. */
const COLORS = ['--data-1', '--data-2', '--data-4', '--data-5', '--data-3', '--data-7', '--data-8', '--data-6'];
const COLOR_NAMES = ['Blue', 'Rose', 'Teal', 'Violet', 'Orange', 'Magenta', 'Cyan', 'Green'];
const colorOf = i => `var(${COLORS[i % COLORS.length]})`;

/* Point names: A to Z, then A′ to Z′, then A″ to Z″. */
const LETTERS = ['', '′', '″'].flatMap(mark => [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(c => c + mark));
const byLetter = (a, b) => LETTERS.indexOf(a) - LETTERS.indexOf(b);

const UNITS_TALL = 16;        // grid squares from the top of the canvas to the bottom
const UNITS_WIDE = 22;        // ...and at least this many across
const MAX_LEN = 20;           // the longest whole-unit line the pop-ups offer

const PERP_TOL = 7 * DEG;     // how near a right angle a turning line has to be to snap to one
const PAR_TOL = 5 * DEG;      // ...and how near parallel
const PAR_NEAR = 2.5;         // a line only snaps parallel to a line this close to it (units)
const ON_EPS = 1e-3;          // a point this close to a line is on it (units)
const SAME_EPS = 5e-3;        // two points this close are the same point (units)
const RIGHT_EPS = 0.02 * DEG; // angles this close to 90° get a right-angle mark
const LONG_PRESS = 550;       // ms a finger is held still to open the options

/* ------------------------------------------------------------
   2. State
   ------------------------------------------------------------ */

/*
  The model is everything Undo restores.
    dots      { id, x, y, letter, on, mid }   on: a line the point sits on (a perpendicular's foot,
                                              or a midpoint); mid: it is that line's midpoint
    lines     { id, a, b, color, ext }   a, b: point ids; ext: { a, b } continue as a dotted line
    measures  { id, kind: 'len', line } or { id, kind: 'ang', v, r: [ray, ray] }
    cross     { 'lineId_lineId': letter }  names given to crossings that hold a measured angle
    par       [[lineId, ...], ...]        lines made or snapped parallel (drawn with arrow marks)
*/
function emptyModel() { return { dots: [], lines: [], measures: [], cross: {}, par: [], seq: 1 }; }
let model = emptyModel();

const ui = {
  mode: null,       // the open pop-up: 'length' | 'connect' | 'parallel' | 'mlen' | 'mang'
  len: 5,           // length in the By length and Parallel pop-ups
  color: 0,         // color in the pop-ups that make a line
  sel: [],          // Connect: the picked dots, midpoints and line, [{ t: 'd' | 'mp' | 'l', id }]
  ref: null,        // Parallel: the line to copy
  grid: false,      // the grid starts hidden; the Grid button shows it
  hover: null,      // what the pointer is over on the canvas
  hoverOpt: null,   // an option or measure hovered in a panel: { t: 'l' | 'd' | 'mp' | 'a' | 'm', id }
  bubble: null,     // the Delete bubble: { line, dot, p }
  menu: null,       // a point's or line's options: { line, dot, end, p }
  preview: null     // the dotted line a pop-up is about to make
};

let fig = null;           // the derived figure (section 5)
let geo = null;           // pixel geometry of the canvas (section 6)
let drag = null;          // a line being moved or turned
let press = null;         // a pointer that is down but hasn't moved yet
let lastLong = 0;         // when a long press last opened the options
let history = [];         // earlier models, for Undo
const fresh = new Map();  // lines that just appeared → when (they fade in once)
let statusFlash = '';
let flashTimer = 0;

/* ------------------------------------------------------------
   3. DOM references
   ------------------------------------------------------------ */

const svg = document.getElementById('canvas');
const stage = document.getElementById('stage');
const tagsEl = document.getElementById('tags');
const tipEl = document.getElementById('canvasTip');
const snapEl = document.getElementById('snapMsg');
const emptyEl = document.getElementById('emptyMsg');
const bubbleEl = document.getElementById('lineAction');
const menuEl = document.getElementById('ctxMenu');
const statusEl = document.getElementById('canvasStatus');
const sidePanel = document.querySelector('.panel-side');
const sideTitle = document.getElementById('sideTitle');
const sideBody = document.getElementById('sideBody');
const sideClose = document.getElementById('sideClose');
const toolBtns = document.querySelectorAll('[data-tool]');
const undoBtn = document.getElementById('undoBtn');
const gridBtn = document.getElementById('gridBtn');
const modalRoot = document.getElementById('modalRoot');

let gridLayer, mainLayer;

/* ------------------------------------------------------------
   4. Numbers, names and vectors
   ------------------------------------------------------------ */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round2 = v => Math.round(v * 100) / 100;
const isWhole = v => Math.abs(v - Math.round(v)) < 0.005;

/** "= 5" or "= 4.8" when the value shown is exact, "≈ 3.61" when it is rounded. */
function lenStr(v) {
  if (isWhole(v)) return '= ' + Math.round(v);
  return (Math.abs(v - round2(v)) < 1e-6 ? '= ' : '≈ ') + round2(v);
}

/** "= 90°" or "= 22.5°" when exact, "≈ 36.9°" when rounded. */
function angStr(th) {
  const d = th / DEG;
  if (Math.abs(d - Math.round(d)) < 0.05) return `= ${Math.round(d)}°`;
  return `${Math.abs(d - Math.round(d * 10) / 10) < 1e-6 ? '=' : '≈'} ${d.toFixed(1)}°`;
}

function esc(s) { return String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]); }

const dotById = id => model.dots.find(d => d.id === id) || null;
const lineById = id => model.lines.find(L => L.id === id) || null;
const letterOf = id => { const d = dotById(id); return d ? d.letter : '?'; };
const otherEnd = (L, id) => (L.a === id ? L.b : L.a);
const linesAt = id => model.lines.filter(L => L.a === id || L.b === id);

/** A point with no lines of its own: a midpoint added to a line. */
const isLone = id => !model.lines.some(L => L.a === id || L.b === id);

/** The middle of a line, from the model (so it is right even mid-change). */
function midOf(L) {
  const A = dotById(L.a), B = dotById(L.b);
  return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
}

/** The point at a line's middle, if there is one. */
const dotAtMid = L => { const P = midOf(L); return model.dots.find(d => dist(d, P) < SAME_EPS) || null; };

/** Lines whose middle has no point yet: Connect offers those midpoints. */
const freeMids = () => model.lines.filter(L => !dotAtMid(L));

/** A segment's name, its letters in alphabetical order: "AB". */
const lineLetters = L => [letterOf(L.a), letterOf(L.b)].sort(byLetter).join('');

/** Segment notation: the name with a bar over it. */
const segHtml = L => `<span class="seg"><span class="sr-only">segment </span>${esc(lineLetters(L))}</span>`;

function usedLetters() {
  const used = new Set(model.dots.map(d => d.letter));
  Object.values(model.cross).forEach(l => used.add(l));
  return used;
}

/** The first n letters no point is using. */
function freeLetters(n) {
  const used = usedLetters(), out = [];
  for (const l of LETTERS) { if (!used.has(l)) out.push(l); if (out.length === n) break; }
  while (out.length < n) out.push('?');
  return out;
}

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unitV = a => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; };
const angOf = v => Math.atan2(v.y, v.x);

function normAng(a) {
  while (a <= -Math.PI) a += 2 * Math.PI;
  while (a > Math.PI) a -= 2 * Math.PI;
  return a;
}

/** The angle between two directions, 0 to π. */
const angGap = (a, b) => Math.abs(normAng(a - b));

/** P turned by th about C. */
function rot(P, C, th) {
  const c = Math.cos(th), s = Math.sin(th), dx = P.x - C.x, dy = P.y - C.y;
  return { x: C.x + dx * c - dy * s, y: C.y + dx * s + dy * c };
}

/** Foot of the perpendicular from P to line AB; t = 0 at A, 1 at B. */
function proj(P, A, B) {
  const d = sub(B, A), L2 = dot(d, d) || 1, t = dot(sub(P, A), d) / L2;
  return { x: A.x + t * d.x, y: A.y + t * d.y, t };
}

function segDist(P, A, B) {
  const t = clamp(proj(P, A, B).t, 0, 1);
  return dist(P, { x: A.x + t * (B.x - A.x), y: A.y + t * (B.y - A.y) });
}

function segsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign(cross(sub(q, p), sub(r, p)));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}

function segSegDist(A, B, C, D) {
  if (segsCross(A, B, C, D)) return 0;
  return Math.min(segDist(A, C, D), segDist(B, C, D), segDist(C, A, B), segDist(D, A, B));
}

/** Where the line A + t·d enters and leaves a box: [t0, t1]. */
function edgeParams(A, d, bx) {
  let t0 = -Infinity, t1 = Infinity;
  for (const [a, dd, lo, hi] of [[A.x, d.x, bx.x0, bx.x1], [A.y, d.y, bx.y0, bx.y1]]) {
    if (Math.abs(dd) < 1e-12) { if (a < lo || a > hi) return [0, 1]; continue; }
    const s = (lo - a) / dd, e = (hi - a) / dd;
    t0 = Math.max(t0, Math.min(s, e));
    t1 = Math.min(t1, Math.max(s, e));
  }
  return t0 < t1 ? [t0, t1] : [0, 1];
}

/* ------------------------------------------------------------
   5. The derived figure
   Worked out from the model on every render: each line's ends,
   direction and dotted parts; the points where lines cross; and,
   for every corner, the rays that leave it, which is what angles
   are made of.
   ------------------------------------------------------------ */

const paramOn = (P, I) => (I.len > 1e-12 ? dot(sub(P, I.A), I.d) / (I.len * I.len) : 0);
const pointAt = (I, t) => ({ x: I.A.x + t * I.d.x, y: I.A.y + t * I.d.y });
const crossKey = (a, b) => (a < b ? a + '_' + b : b + '_' + a);

/** The point that names a ray along a line: its end in that direction, or the nearest point on the dotted part. */
function rayName(I, t, s) {
  const ahead = c => (c.t - t) * s > 1e-6;
  const ends = [{ id: I.L.a, t: 0 }, { id: I.L.b, t: 1 }].filter(ahead);
  const pool = ends.length ? ends : I.att.filter(ahead);
  if (!pool.length) return null;
  pool.sort((p, q) => Math.abs(p.t - t) - Math.abs(q.t - t));
  return pool[0].id;
}

/** A ray from the point at t along line I, toward B (s = 1) or toward A (s = −1). */
function addRay(list, I, t, s) {
  const room = s > 0 ? I.t1 - t : t - I.t0;
  if (room * I.len < 1e-6) return;
  const dir = s > 0 ? I.u : mul(I.u, -1);
  list.push({ key: I.L.id + (s > 0 ? '+' : '-'), line: I.L.id, ang: angOf(dir), dir, reach: room * I.len, name: rayName(I, t, s) });
}

function derive() {
  const dots = new Map(model.dots.map(d => [d.id, d]));
  const info = new Map();
  model.lines.forEach(L => {
    const A = dots.get(L.a), B = dots.get(L.b), d = sub(B, A), len = Math.hypot(d.x, d.y);
    info.set(L.id, { L, A, B, d, len, u: len > 1e-12 ? mul(d, 1 / len) : { x: 1, y: 0 }, att: [], t0: 0, t1: 1 });
  });
  model.dots.forEach(dt => {
    const I = dt.on && info.get(dt.on);
    if (I) I.att.push({ id: dt.id, t: paramOn(dt, I) });
  });

  // Dotted parts: out to a foot that is past an end, or to the edge when the line is continued.
  const bx = bounds(0.4);
  info.forEach(I => {
    I.att.forEach(a => { I.t0 = Math.min(I.t0, a.t); I.t1 = Math.max(I.t1, a.t); });
    if ((I.L.ext.a || I.L.ext.b) && I.len > 1e-9) {
      const [e0, e1] = edgeParams(I.A, I.d, bx);
      if (I.L.ext.a) I.t0 = Math.min(I.t0, e0);
      if (I.L.ext.b) I.t1 = Math.max(I.t1, e1);
    }
  });

  const vertices = [], vmap = new Map();
  const ends = new Map();
  model.lines.forEach(L => {
    (ends.get(L.a) || ends.set(L.a, []).get(L.a)).push(L.id);
    (ends.get(L.b) || ends.set(L.b, []).get(L.b)).push(L.id);
  });
  model.dots.forEach(dt => {
    const rays = [];
    (ends.get(dt.id) || []).forEach(lid => {
      const I = info.get(lid), t = I.L.a === dt.id ? 0 : 1;
      addRay(rays, I, t, 1);
      addRay(rays, I, t, -1);
    });
    const I = dt.on && info.get(dt.on);
    if (I) { const t = paramOn(dt, I); addRay(rays, I, t, 1); addRay(rays, I, t, -1); }
    const v = { key: 'd' + dt.id, kind: 'dot', id: dt.id, x: dt.x, y: dt.y, rays, letter: dt.letter, named: true };
    vertices.push(v);
    vmap.set(v.key, v);
  });

  // Crossings: where two lines (or their dotted parts) cross away from any point.
  const crossings = [];
  const used = usedLetters();
  const spare = LETTERS.filter(l => !used.has(l));
  let next = 0;
  const lines = model.lines;
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const I = info.get(lines[i].id), J = info.get(lines[j].id);
      const den = cross(I.d, J.d);
      if (Math.abs(den) < 1e-9 * (I.len * J.len || 1)) continue;
      const w = sub(J.A, I.A), t = cross(w, J.d) / den, s = cross(w, I.d) / den;
      if (t < I.t0 - 1e-9 || t > I.t1 + 1e-9 || s < J.t0 - 1e-9 || s > J.t1 + 1e-9) continue;
      const P = pointAt(I, t);
      if (model.dots.some(dt => dist(dt, P) < SAME_EPS * 4)) continue;
      const key = crossKey(lines[i].id, lines[j].id);
      const named = !!model.cross[key];
      const rays = [];
      addRay(rays, I, t, 1); addRay(rays, I, t, -1);
      addRay(rays, J, s, 1); addRay(rays, J, s, -1);
      const v = { key: 'x' + key, kind: 'cross', ck: key, l1: lines[i].id, l2: lines[j].id, x: P.x, y: P.y, rays, named, letter: named ? model.cross[key] : (spare[next++] || '?') };
      crossings.push(v);
      vertices.push(v);
      vmap.set(v.key, v);
    }
  }
  return { info, vertices, vmap, crossings };
}

/** Every angle at a corner (between two named rays, less than a straight angle). */
function anglesAt(v) {
  const rays = [];
  v.rays.forEach(r => { if (r.name !== null && !rays.some(q => angGap(q.ang, r.ang) < 1e-6)) rays.push(r); });
  const out = [];
  for (let i = 0; i < rays.length; i++) {
    for (let j = i + 1; j < rays.length; j++) {
      const th = angGap(rays[i].ang, rays[j].ang);
      if (th < 0.5 * DEG || th > 179.5 * DEG) continue;
      let r1 = rays[i], r2 = rays[j];
      if (byLetter(letterOf(r2.name), letterOf(r1.name)) < 0) [r1, r2] = [r2, r1];
      out.push({ key: v.key + '|' + [r1.key, r2.key].sort().join(','), v, r1, r2, th, name: '∠' + letterOf(r1.name) + v.letter + letterOf(r2.name) });
    }
  }
  return out;
}

const allAngles = () => fig.vertices.flatMap(anglesAt);

/** What a measure shows, or null when what it measured is gone. */
function measureInfo(m) {
  if (m.kind === 'len') {
    const I = fig.info.get(m.line);
    if (!I) return null;
    const name = lineLetters(I.L);
    return { kind: 'len', I, name, text: `${name} ${lenStr(I.len)}`, label: `Segment ${name} measures ${round2(I.len)} units` };
  }
  const v = fig.vmap.get(m.v);
  if (!v || !v.named) return null;
  const r1 = v.rays.find(r => r.key === m.r[0]), r2 = v.rays.find(r => r.key === m.r[1]);
  if (!r1 || !r2 || r1.name === null || r2.name === null) return null;
  const th = angGap(r1.ang, r2.ang);
  if (th < 0.5 * DEG || th > 179.5 * DEG) return null;
  let n1 = letterOf(r1.name), n2 = letterOf(r2.name);
  if (byLetter(n2, n1) < 0) [n1, n2] = [n2, n1];
  const name = '∠' + n1 + v.letter + n2;
  return { kind: 'ang', v, r1, r2, th, name, text: `m${name} ${angStr(th)}`, label: `Angle ${n1} ${v.letter} ${n2} measures ${round2(th / DEG)} degrees` };
}

/* ------------------------------------------------------------
   6. Sizing the canvas
   The <svg> viewBox is the stage's size in css pixels, so every
   size below is simply pixels, taken from the root font size
   (which grows on a projector).
   ------------------------------------------------------------ */

function measure() {
  const W = Math.max(stage.clientWidth, 60), H = Math.max(stage.clientHeight, 60);
  const cs = getComputedStyle(document.documentElement);
  const root = parseFloat(cs.fontSize) || 18;
  const scale = parseFloat(cs.getPropertyValue('--ui-scale')) || 1;
  const fs = clamp(root * scale, 12, 64);
  const unit = Math.max(14, Math.min(H / UNITS_TALL, W / UNITS_WIDE));
  geo = {
    W, H, fs, unit,
    dot: clamp(fs * 0.34, 5, 18),
    hitR: Math.max(fs * 0.85, 14),
    tol: Math.max(fs * 0.55, 10),
    snap: Math.max(fs * 0.95, 16)
  };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const set = (name, v) => svg.style.setProperty(name, v + 'px');
  set('--fs-label', Math.round(fs * 1.02));
  set('--fs-small', Math.round(fs * 0.78));
  set('--sw-grid', Math.max(1, fs * 0.055));
  set('--sw-grid-five', Math.max(1.5, fs * 0.09));
  set('--sw-line', Math.max(3, fs * 0.19));
  set('--sw-mark', Math.max(2, fs * 0.1));
  set('--sw-halo', Math.max(2.4, fs * 0.13));
}

const X = x => geo.W / 2 + x * geo.unit;
const Y = y => geo.H / 2 - y * geo.unit;
const px = P => ({ x: X(P.x), y: Y(P.y) });
const toWorld = p => ({ x: (p.x - geo.W / 2) / geo.unit, y: (geo.H / 2 - p.y) / geo.unit });

/** The canvas in world units, grown by a margin. */
function bounds(m = 0) {
  const hw = geo.W / 2 / geo.unit, hh = geo.H / 2 / geo.unit;
  return { x0: -hw - m, x1: hw + m, y0: -hh - m, y1: hh + m };
}

/** The longest whole-unit line that fits across the canvas. */
const maxLen = () => clamp(Math.floor(geo.W / geo.unit - 2), 1, MAX_LEN);

function eventPx(ev) {
  const r = svg.getBoundingClientRect();
  return { x: (ev.clientX - r.left) * (geo.W / r.width), y: (ev.clientY - r.top) * (geo.H / r.height) };
}

/** Pixel distance from p to the segment ab (all in pixels). */
function pxSegDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1);
  return Math.hypot(a.x + t * dx - p.x, a.y + t * dy - p.y);
}

/* ------------------------------------------------------------
   7. How the figure hangs together
   Points are joined by lines, and a perpendicular's foot is held
   by the line it sits on. Moving a line moves everything joined to
   it; turning an end moves everything beyond that end.
   ------------------------------------------------------------ */

function adjacency(skipLine) {
  const adj = new Map(model.dots.map(d => [d.id, []]));
  const link = (a, b) => {
    if (a === b || !adj.has(a) || !adj.has(b)) return;
    adj.get(a).push(b);
    adj.get(b).push(a);
  };
  model.lines.forEach(L => { if (L.id !== skipLine) link(L.a, L.b); });
  model.dots.forEach(d => {
    if (!d.on || d.on === skipLine) return;
    const L = lineById(d.on);
    if (L) { link(d.id, L.a); link(d.id, L.b); }
  });
  return adj;
}

/** Every point reachable from start without passing through blocked. */
function reach(start, blocked, adj) {
  const seen = new Set([start]), queue = [start];
  while (queue.length) {
    const id = queue.shift();
    (adj.get(id) || []).forEach(n => {
      if (n === blocked || seen.has(n)) return;
      seen.add(n);
      queue.push(n);
    });
  }
  return [...seen];
}

/** Is the line joined to other lines (a point of its own, like a midpoint, doesn't count)? */
const isShape = L => reach(L.a, null, adjacency()).some(id => id !== L.a && id !== L.b && !(isLone(id) && dotById(id).on === L.id));

/** The line a point belongs to under the pointer: one of its own, or (a midpoint) the line it sits on. */
const lineFor = (dt, p) => pickLine(dt, p) || lineById(dt.on);

/** Of the lines that end at a point, the one the pointer is on: the nearest in direction, or the newest. */
function pickLine(dt, p) {
  const ls = linesAt(dt.id);
  if (ls.length <= 1) return ls[0] || null;
  const q = px(dt), off = { x: p.x - q.x, y: p.y - q.y };
  if (Math.hypot(off.x, off.y) < geo.dot * 0.6) return ls.reduce((a, b) => (b.id > a.id ? b : a));
  const want = Math.atan2(off.y, off.x);
  let best = ls[0], bestGap = Infinity;
  ls.forEach(L => {
    const o = px(dotById(otherEnd(L, dt.id))), gap = angGap(Math.atan2(o.y - q.y, o.x - q.x), want);
    if (gap < bestGap) { bestGap = gap; best = L; }
  });
  return best;
}

/** Is the point on the line (an end of it, held by it, or simply lying on it)? */
function onLine(dotId, lineId) {
  const L = lineById(lineId), dt = dotById(dotId);
  if (!L || !dt) return false;
  if (L.a === dotId || L.b === dotId || dt.on === lineId) return true;
  const A = dotById(L.a), B = dotById(L.b);
  return Math.abs(cross(sub(B, A), sub(dt, A))) / (dist(A, B) || 1) < ON_EPS;
}

const joined = (a, b) => model.lines.some(L => (L.a === a && L.b === b) || (L.a === b && L.b === a));

/* ------------------------------------------------------------
   8. Changing the model
   ------------------------------------------------------------ */

function newDot(x, y, letter) {
  const d = { id: model.seq++, x, y, letter, on: null, mid: false };
  model.dots.push(d);
  return d;
}

function newLine(a, b, color) {
  const L = { id: model.seq++, a, b, color, ext: { a: false, b: false } };
  model.lines.push(L);
  return L;
}

function pushHistory() {
  history.push(JSON.stringify(model));
  if (history.length > 150) history.shift();
}

/** The color used least, so each new line stands out from the others. */
function leastUsedColor() {
  const n = COLORS.map(() => 0);
  model.lines.forEach(L => { n[L.color % COLORS.length]++; });
  return n.indexOf(Math.min(...n));
}

/**
 * Two points become one. The point named second goes (its letter is
 * freed), and its lines and measures move to the one that stays.
 */
function mergeDots(aId, bId) {
  if (aId === bId) return null;
  const keep = dotById(Math.min(aId, bId)), drop = dotById(Math.max(aId, bId));
  if (!keep || !drop) return null;
  model.lines.forEach(L => {
    if (L.a === drop.id) L.a = keep.id;
    if (L.b === drop.id) L.b = keep.id;
  });
  if (!keep.on && drop.on) { keep.on = drop.on; keep.mid = !!drop.mid; }
  model.measures.forEach(m => { if (m.kind === 'ang' && m.v === 'd' + drop.id) m.v = 'd' + keep.id; });
  model.dots = model.dots.filter(d => d.id !== drop.id);
  return { kept: keep.letter, gone: drop.letter };
}

function addParallel(a, b) {
  const ga = model.par.find(g => g.includes(a)), gb = model.par.find(g => g.includes(b));
  if (ga && gb && ga === gb) return;
  if (ga && gb) { ga.push(...gb); model.par = model.par.filter(g => g !== gb); }
  else if (ga) ga.push(b);
  else if (gb) gb.push(a);
  else model.par.push([a, b]);
}

/** Tidy up after any change, then drop measures and marks that no longer apply. */
function cleanup() {
  // Two lines joining the same two points become one; what was on the second moves to the first.
  const seen = new Map(), alias = new Map();
  model.lines = model.lines.filter(L => {
    if (L.a === L.b) return false;
    const k = Math.min(L.a, L.b) + '-' + Math.max(L.a, L.b);
    if (seen.has(k)) { alias.set(L.id, seen.get(k)); return false; }
    seen.set(k, L.id);
    return true;
  });
  if (alias.size) {
    model.dots.forEach(d => { if (alias.has(d.on)) d.on = alias.get(d.on); });
    model.measures.forEach(m => { if (m.kind === 'len' && alias.has(m.line)) m.line = alias.get(m.line); });
    const measured = new Set();
    model.measures = model.measures.filter(m => m.kind !== 'len' || (!measured.has(m.line) && !!measured.add(m.line)));
  }
  model.dots.forEach(d => {
    if (!d.on) { d.mid = false; return; }
    const L = lineById(d.on);
    if (!L || L.a === d.id || L.b === d.id) { d.on = null; d.mid = false; return; }
    const A = dotById(L.a), B = dotById(L.b);
    if (Math.abs(cross(sub(B, A), sub(d, A))) / (dist(A, B) || 1) > ON_EPS) { d.on = null; d.mid = false; return; }
    // A midpoint that is no longer at the middle is just a point on the line.
    if (d.mid && dist(d, midOf(L)) > SAME_EPS) d.mid = false;
  });
  // A point goes with its last line, except a midpoint, which stays as long as its line does.
  const used = new Set();
  model.lines.forEach(L => { used.add(L.a); used.add(L.b); });
  model.dots = model.dots.filter(d => used.has(d.id) || (d.mid && d.on));
  // Parallel groups keep only the lines that are still parallel to the first.
  model.par = model.par.map(g => {
    const ls = g.map(lineById).filter(Boolean);
    if (!ls.length) return [];
    const u0 = unitV(sub(dotById(ls[0].b), dotById(ls[0].a)));
    return ls.filter(L => Math.abs(cross(u0, unitV(sub(dotById(L.b), dotById(L.a))))) < 1e-6).map(L => L.id);
  }).filter(g => g.length > 1);
  fig = derive();
  model.measures = model.measures.filter(m => measureInfo(m));
  Object.keys(model.cross).forEach(k => {
    if (!model.measures.some(m => m.v === 'x' + k)) delete model.cross[k];
  });
  fig = derive();
}

function deleteLine(id) {
  if (!lineById(id)) return;
  pushHistory();
  model.lines = model.lines.filter(L => L.id !== id);
  cleanup();
  hideBubble();
  closeMenu();
  renderAll();
}

function setColor(lineId, c) {
  const L = lineById(lineId);
  if (!L || L.color === c) return;
  pushHistory();
  L.color = c;
  renderAll();
}

function renameDot(id, letter) {
  const d = dotById(id);
  if (!d || d.letter === letter || usedLetters().has(letter)) return;
  pushHistory();
  d.letter = letter;
  renderAll();
}

function setExt(lineId, side, on) {
  const L = lineById(lineId);
  if (!L) return;
  pushHistory();
  if (side === 'both') { L.ext.a = on; L.ext.b = on; } else L.ext[side] = on;
  cleanup();
  renderAll();
}

/**
 * How a line can change length: the points on one end's side slide
 * along the line. That works when they don't also connect back to
 * the other end (a closed shape); otherwise try the other end.
 */
function lengthPlan(L, endId) {
  const adj = adjacency(L.id);
  const tryEnd = (mover, fixed) => {
    const S = reach(mover, fixed, adj);
    if (S.some(id => (adj.get(id) || []).includes(fixed))) return null;
    return { S, mover, fixed };
  };
  return tryEnd(endId, otherEnd(L, endId)) || tryEnd(otherEnd(L, endId), endId);
}

function setLength(lineId, endId, n) {
  const L = lineById(lineId);
  if (!L) return false;
  n = clamp(Math.round(n), 1, MAX_LEN);
  const plan = lengthPlan(L, endId);
  if (!plan) return false;
  const M = dotById(plan.mover), F = dotById(plan.fixed), cur = dist(M, F);
  if (Math.abs(cur - n) < 1e-9) return true;
  const delta = mul(unitV(sub(M, F)), n - cur);
  pushHistory();
  plan.S.forEach(id => { const d = dotById(id); d.x += delta.x; d.y += delta.y; });
  // A midpoint stays at the middle: it slides half as far, with whatever is joined to it,
  // unless that is also joined to the line's ends (then it stays put, and is no longer the midpoint).
  const adj = adjacency(L.id), moved = new Set(plan.S);
  model.dots.filter(d => d.mid && d.on === L.id && !moved.has(d.id)).forEach(d => {
    const part = reach(d.id, null, adj);
    if (part.some(id => moved.has(id) || id === plan.fixed)) return;
    part.forEach(id => { const q = dotById(id); q.x += delta.x / 2; q.y += delta.y / 2; moved.add(id); });
  });
  cleanup();
  renderAll();
  return true;
}

/** Give a line its midpoint: a new point (or the point already there) that stays at its middle. */
function addMidpoint(lineId) {
  const L = lineById(lineId);
  if (!L || !canAddMid(L)) return;
  pushHistory();
  let M = dotAtMid(L);
  if (M) M.mid = true;
  else {
    const P = midOf(L);
    M = newDot(P.x, P.y, freeLetters(1)[0]);
    M.on = L.id;
    M.mid = true;
  }
  cleanup();
  closeMenu();
  renderAll();
  flash(`<b>${esc(M.letter)}</b> is the midpoint of ${segHtml(L)}.`, false);
}

/** A line can be given a midpoint unless a point not on it already sits at its middle. */
function canAddMid(L) {
  const M = dotAtMid(L);
  return !M || (M.on === L.id && !M.mid);
}

/** Remove a point that has no lines of its own (a midpoint). */
function removeDot(id) {
  const d = dotById(id);
  if (!d || !isLone(id)) return;
  pushHistory();
  model.dots = model.dots.filter(x => x.id !== id);
  cleanup();
  hideBubble();
  closeMenu();
  renderAll();
  flash(`Removed <b>${esc(d.letter)}</b>.`, false);
}

/**
 * Open a shape at a point: the line's end becomes a point of its own
 * (with a new letter), turned a little so the two points are apart.
 */
function openShape(dotId, lineId) {
  const dt = dotById(dotId), L = lineById(lineId);
  if (!dt || !L) return;
  pushHistory();
  let end = dt;
  const rest = linesAt(dt.id).filter(M => M.id !== L.id);
  const heldBy = dt.on;
  if (rest.length) {
    end = newDot(dt.x, dt.y, freeLetters(1)[0]);
    if (L.a === dt.id) L.a = end.id; else L.b = end.id;
  } else dt.on = null;
  // Which way to turn: away from the lines it was joined to.
  const piv = dotById(otherEnd(L, end.id));
  const S = reach(end.id, piv.id, adjacency());
  const start = new Map(S.map(id => { const d = dotById(id); return [id, { x: d.x, y: d.y }]; }));
  const away = rest.slice();
  if (heldBy && lineById(heldBy)) away.push(lineById(heldBy));
  const r = dist(end, piv), th0 = Math.min(0.45, 0.9 / Math.max(r, 0.1));
  const score = th => {
    const q = rot(start.get(end.id), piv, th);
    return Math.min(Infinity, ...away.map(M => segDist(q, dotById(M.a), dotById(M.b))));
  };
  const th = score(th0) >= score(-th0) ? th0 : -th0;
  S.forEach(id => { const q = rot(start.get(id), piv, th), d = dotById(id); d.x = q.x; d.y = q.y; });
  cleanup();
  closeMenu();
  renderAll();
  flash(end === dt
    ? `<b>${esc(dt.letter)}</b> is no longer held on ${segHtml(lineById(heldBy) || L)}.`
    : `Opened at <b>${esc(dt.letter)}</b>: ${segHtml(L)} now ends at <b>${esc(end.letter)}</b>.`, false);
}

/* ------------------------------------------------------------
   9. Where a new line goes
   In the middle of the canvas, unless something is already there;
   then as close as it can be, higher up. Crossing a line is fine;
   lying on top of one, or on a point, is not.
   ------------------------------------------------------------ */

function isFree(A, B) {
  const clear = Math.max(0.75, 1.5 * geo.fs / geo.unit);
  const u = unitV(sub(B, A));
  if (model.dots.some(d => segDist(d, A, B) < clear)) return false;
  for (const I of fig.info.values()) {
    if (segDist(A, I.A, I.B) < clear || segDist(B, I.A, I.B) < clear) return false;
    if (Math.abs(cross(u, I.u)) < Math.sin(20 * DEG) && segSegDist(A, B, I.A, I.B) < clear) return false;
  }
  return true;
}

function placeLine(len, dir) {
  const bx = bounds(-0.6);
  let n = { x: -dir.y, y: dir.x };
  if (n.y < -1e-9 || (Math.abs(n.y) <= 1e-9 && n.x < 0)) n = mul(n, -1);
  const flat = Math.abs(dir.y) < 1e-9;
  const make = k => {
    if (flat) {
      // Level lines sit on grid lines with their ends on grid points, so the units can be counted.
      const x0 = -Math.floor(len / 2);
      return [{ x: x0, y: k }, { x: x0 + len, y: k }];
    }
    const C = mul(n, k);
    return [sub(C, mul(dir, len / 2)), add(C, mul(dir, len / 2))];
  };
  const fits = ([A, B]) => [A, B].every(Q => Q.x > bx.x0 && Q.x < bx.x1 && Q.y > bx.y0 && Q.y < bx.y1);
  const kMax = Math.ceil(Math.max(bx.x1, bx.y1) * 2) + 2;
  for (let k = 0; k <= kMax; k++) {
    const c = make(k);
    if (!fits(c)) break;
    if (isFree(c[0], c[1])) return c;
  }
  for (let k = -1; k >= -kMax; k--) {
    const c = make(k);
    if (!fits(c)) break;
    if (isFree(c[0], c[1])) return c;
  }
  return make(0);
}

/* ------------------------------------------------------------
   10. The pop-ups' previews
   ------------------------------------------------------------ */

function computePreview() {
  if (ui.mode === 'length') {
    const [A, B] = placeLine(ui.len, { x: 1, y: 0 });
    return { kind: 'new', A, B };
  }
  if (ui.mode === 'parallel') {
    const I = ui.ref !== null && fig.info.get(ui.ref);
    if (!I) return null;
    const [A, B] = placeLine(ui.len, I.u);
    return { kind: 'new', A, B };
  }
  if (ui.mode === 'connect') return connectPreview();
  return null;
}

/** The letters Connect will give new points: each picked midpoint in turn, then a perpendicular's foot. */
function pickLetters() {
  const mids = ui.sel.filter(s => s.t === 'mp');
  const ls = freeLetters(mids.length + 1);
  return { mid: new Map(mids.map((s, i) => [s.id, ls[i]])), foot: ls[mids.length] };
}

/** A pick as a point: a dot, or a line's midpoint that doesn't exist yet (id null). */
function pickPoint(s, letters) {
  if (s.t === 'd') { const d = dotById(s.id); return d && { x: d.x, y: d.y, id: d.id, letter: d.letter, mid: null }; }
  const L = lineById(s.id);
  return L && { ...midOf(L), id: null, letter: letters.mid.get(s.id), mid: L.id };
}

/** "C", or "G (the midpoint of AB)" for a midpoint that is still to be made. */
const ptDesc = P => (P.id ? esc(P.letter) : `${esc(P.letter)} (the midpoint of ${segHtml(lineById(P.mid))})`);

/** Is the point on the line, or on the dotted line through it? */
function ptOnLine(P, L) {
  const A = dotById(L.a), B = dotById(L.b);
  return Math.abs(cross(sub(B, A), sub(P, A))) / (dist(A, B) || 1) < ON_EPS;
}

function connectPreview() {
  const letters = pickLetters();
  const pts = ui.sel.filter(s => s.t !== 'l').map(s => pickPoint(s, letters)).filter(Boolean);
  const lines = ui.sel.filter(s => s.t === 'l').map(s => fig.info.get(s.id)).filter(Boolean);
  if (pts.length === 2) {
    const [A, B] = pts;
    if (A.id && B.id && joined(A.id, B.id)) {
      const L = model.lines.find(M => (M.a === A.id && M.b === B.id) || (M.a === B.id && M.b === A.id));
      return { error: `${esc(A.letter)} and ${esc(B.letter)} are already joined by ${segHtml(L)}.` };
    }
    if (dist(A, B) < SAME_EPS) return { error: 'Those two points are in the same place.' };
    const under = model.lines.find(L => ptOnLine(A, L) && ptOnLine(B, L));
    if (under) return { error: `${ptDesc(A)} and ${ptDesc(B)} are both on ${segHtml(under)}, so a line joining them would lie on top of it.` };
    return { kind: 'join', A, B };
  }
  if (pts.length === 1 && lines.length === 1) {
    const Q = pts[0], I = lines[0];
    const F = proj(Q, I.A, I.B);
    if (dist(Q, F) < 0.05) return { error: `${ptDesc(Q)} is on ${segHtml(I.L)}, so there is no perpendicular to draw.` };
    const existing = [I.L.a, I.L.b, ...I.att.map(a => a.id)].find(id => dist(dotById(id), F) < SAME_EPS) || null;
    if (existing && Q.id && joined(existing, Q.id)) {
      const L = model.lines.find(M => (M.a === Q.id && M.b === existing) || (M.b === Q.id && M.a === existing));
      return { error: `${segHtml(L)} is already the perpendicular from ${esc(Q.letter)}.` };
    }
    return { kind: 'perp', line: I.L.id, A: Q, B: { x: F.x, y: F.y }, t: F.t, existing, foot: existing ? letterOf(existing) : letters.foot };
  }
  return null;
}

/** What a pick is called in a message: "C", "the midpoint of AB", "AB". */
function pickName(s) {
  if (s.t === 'd') return esc(letterOf(s.id));
  const L = lineById(s.id);
  return s.t === 'mp' ? `the midpoint of ${segHtml(L)}` : segHtml(L);
}

const capFirst = html => html.replace(/^the /, 'The ');

/** Is the picked dot or midpoint on the line? */
function pickOnLine(s, lineId) {
  if (s.t === 'd') return onLine(s.id, lineId);
  return s.id === lineId || ptOnLine(midOf(lineById(s.id)), lineById(lineId));
}

/** Why a dot, midpoint or line can't be picked in Connect right now ('' when it can). */
function whyNotPick(item) {
  if (ui.sel.some(s => s.t === item.t && s.id === item.id)) return '';
  if (ui.sel.length >= 2) return 'Two are picked already. Click one of them to unpick it.';
  const other = ui.sel[0];
  if (!other) return '';
  if (item.t === 'l' && other.t === 'l') return 'A perpendicular runs from a dot to one line. Pick a dot to go with it.';
  if (item.t === 'l' && pickOnLine(other, item.id)) return `${capFirst(pickName(other))} is on ${segHtml(lineById(item.id))}, so it can't have a perpendicular to it.`;
  if (other.t === 'l' && item.t !== 'l' && pickOnLine(item, other.id)) return `${capFirst(pickName(item))} is on ${segHtml(lineById(other.id))}. Pick a dot that isn't on the line.`;
  // A line's midpoint and a point on that line: the new line would lie on top of it.
  const [mp, pt] = item.t === 'mp' ? [item, other] : other.t === 'mp' ? [other, item] : [null, null];
  if (mp && pt.t !== 'l' && pickOnLine(pt, mp.id)) {
    return `${capFirst(pickName(pt))} is on ${segHtml(lineById(mp.id))}, so a line to its midpoint would lie on top of it.`;
  }
  return '';
}

const isPicked = (t, id) => ui.sel.some(s => s.t === t && s.id === id);

/* ------------------------------------------------------------
   11. Drawing
   ------------------------------------------------------------ */

function el(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  for (const k in attrs) {
    if (attrs[k] === undefined || attrs[k] === null) continue;
    if (k === 'text') node.textContent = attrs[k];
    else if (k === 'c') node.style.setProperty('--c', attrs[k]);
    else if (k === 'style') node.style.cssText += ';' + attrs[k];   // keeps --c
    else node.setAttribute(k, attrs[k]);
  }
  if (parent) parent.appendChild(node);
  return node;
}

function initSvg() {
  svg.textContent = '';
  gridLayer = el('g', { class: 'grid-layer' }, svg);
  mainLayer = el('g', { class: 'main-layer' }, svg);
}

function drawGrid() {
  gridLayer.textContent = '';
  el('rect', { class: 'canvas-bg', x: 0, y: 0, width: geo.W, height: geo.H }, gridLayer);
  if (!ui.grid) return;
  const b = bounds();
  for (let x = Math.ceil(b.x0); x <= b.x1; x++) {
    el('line', { class: 'grid-line' + (x % 5 === 0 ? ' five' : ''), x1: X(x), y1: 0, x2: X(x), y2: geo.H }, gridLayer);
  }
  for (let y = Math.ceil(b.y0); y <= b.y1; y++) {
    el('line', { class: 'grid-line' + (y % 5 === 0 ? ' five' : ''), x1: 0, y1: Y(y), x2: geo.W, y2: Y(y) }, gridLayer);
  }
}

/** Where a point's letter goes: in the widest gap between the rays leaving it. */
function labelSpot(q, rays) {
  const off = geo.fs * 0.95;
  let dir = -Math.PI / 4;
  if (rays.length) {
    const a = rays.map(r => normAng(-r.ang)).sort((p, r) => p - r);
    let bestGap = -1;
    for (let i = 0; i < a.length; i++) {
      const nextA = i + 1 < a.length ? a[i + 1] : a[0] + 2 * Math.PI;
      const gap = nextA - a[i], mid = a[i] + gap / 2;
      // Equal gaps (a point in the middle of a straight line): prefer above.
      if (gap > bestGap + 1e-6 || (Math.abs(gap - bestGap) <= 1e-6 && Math.sin(mid) < Math.sin(dir))) { bestGap = gap; dir = mid; }
    }
  }
  return { x: q.x + Math.cos(dir) * off, y: q.y + Math.sin(dir) * off };
}

/** Is this line lit up (hovered, picked, selected)? */
function lineLit(L) {
  const h = ui.hover, o = ui.hoverOpt;
  if (drag) return drag.line === L.id || (drag.snap && drag.snap.line === L.id);
  if (h && (h.kind === 'line' || h.kind === 'mid') && h.id === L.id) return true;
  if (h && h.kind === 'dot' && h.line === L.id && (!ui.mode || ui.mode === 'length')) return true;
  if (o && (o.t === 'l' || o.t === 'mp') && o.id === L.id) return true;
  if (o && o.t === 'm') { const m = model.measures.find(x => x.id === o.id); if (m && m.kind === 'len' && m.line === L.id) return true; }
  if (ui.bubble && ui.bubble.line === L.id) return true;
  if (ui.menu && ui.menu.line === L.id) return true;
  if (ui.mode === 'connect' && isPicked('l', L.id)) return true;
  if (ui.mode === 'parallel' && ui.ref === L.id) return true;
  return false;
}

/** In Connect, the dots and lines that can't be picked are greyed out. */
function dimmed(t, id) {
  return ui.mode === 'connect' && !isPicked(t, id) && !!whyNotPick({ t, id });
}

function renderCanvas() {
  if (!geo) return;
  fig = derive();
  ui.preview = computePreview();
  mainLayer.textContent = '';
  const gExt = el('g', {}, mainLayer), gGlow = el('g', {}, mainLayer), gMarks = el('g', {}, mainLayer);
  const gLines = el('g', {}, mainLayer), gPrev = el('g', {}, mainLayer), gTop = el('g', {}, mainLayer);

  model.lines.forEach(L => {
    const I = fig.info.get(L.id), c = colorOf(L.color), a = px(I.A), b = px(I.B);
    const dim = dimmed('l', L.id) ? ' is-dim' : '';
    if (I.t0 < -1e-9) { const e = px(pointAt(I, I.t0)); el('line', { class: 'ln-ext' + dim, c, x1: e.x, y1: e.y, x2: a.x, y2: a.y }, gExt); }
    if (I.t1 > 1 + 1e-9) { const e = px(pointAt(I, I.t1)); el('line', { class: 'ln-ext' + dim, c, x1: b.x, y1: b.y, x2: e.x, y2: e.y }, gExt); }
    if (lineLit(L)) el('line', { class: 'ln-glow', c, x1: a.x, y1: a.y, x2: b.x, y2: b.y }, gGlow);
    // A new line fades in; redraws during that time pick the animation up where it is.
    const born = fresh.get(L.id);
    el('line', {
      class: 'ln' + dim + (born ? ' is-new' : ''), c, x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      style: born ? `animation-delay:-${Date.now() - born}ms` : null
    }, gLines);
  });

  drawRightMarks(gMarks);
  drawParMarks(gMarks);
  drawMidMarks(gMarks);
  drawAngleMeasures(gMarks);
  drawAngleHover(gMarks);
  drawPreview(gPrev, gTop);
  if (drag && drag.type === 'rotate') drawPivot(gPrev);
  // A held perpendicular snap shows its right angle before the foot is joined to the line.
  if (drag && drag.snap && drag.snap.kind === 'perpFoot') {
    const I = fig.info.get(drag.snap.line), P = dotById(drag.piv), F = drag.snap.F, up = unitV(sub(P, F));
    const along = paramOn(F, I) <= 0.5 ? I.u : mul(I.u, -1);
    squareMark(gMarks, F, { dir: up, reach: dist(P, F) }, { dir: along, reach: 1 }, 'ra-mark');
  }
  drawDots(gTop);
  placeTags(el('g', {}, gMarks));
  emptyEl.hidden = model.lines.length > 0 || !!(ui.preview && !ui.preview.error);
}

function drawDots(g) {
  fig.labels = [];    // where the letters went, so measure labels can keep clear of them
  drawMidChoices(g);
  model.dots.forEach(dt => {
    const q = px(dt), v = fig.vmap.get('d' + dt.id);
    const dim = dimmed('d', dt.id) ? ' is-dim' : '';
    const h = ui.hover, o = ui.hoverOpt;
    const picked = ui.mode === 'connect' && isPicked('d', dt.id);
    const lit = (h && h.kind === 'dot' && h.id === dt.id) || (o && o.t === 'd' && o.id === dt.id) ||
      (ui.menu && ui.menu.dot === dt.id) || (drag && drag.snap && drag.snap.t === dt.id) ||
      (ui.mode === 'connect' && !dim);
    const hovered = h && h.kind === 'dot' && h.id === dt.id;
    if (picked) el('circle', { class: 'dot-ring is-picked', cx: q.x, cy: q.y, r: geo.dot * 2.1 }, g);
    else if (lit) el('circle', { class: 'dot-ring' + (ui.mode === 'connect' && !hovered ? ' is-faint' : ''), cx: q.x, cy: q.y, r: geo.dot * 2.1 }, g);
    el('circle', { class: 'dot' + dim + (picked ? ' is-picked' : ''), cx: q.x, cy: q.y, r: geo.dot }, g);
    const lp = labelSpot(q, v ? v.rays : []);
    el('text', { class: 'dot-label' + dim, x: lp.x, y: lp.y, text: dt.letter }, g);
    fig.labels.push(lp);
  });
  // Crossings that hold a measured angle are named; while measuring angles, the others show their names faintly.
  fig.crossings.forEach(v => {
    if (!v.named && ui.mode !== 'mang') return;
    const q = px(v), cls = v.named ? '' : ' is-faint';
    el('circle', { class: 'cross-pt' + cls, cx: q.x, cy: q.y, r: geo.dot * 0.75 }, g);
    const lp = labelSpot(q, v.rays);
    el('text', { class: 'dot-label' + cls, x: lp.x, y: lp.y, text: v.letter }, g);
    fig.labels.push(lp);
  });
}

/** Connect: each line's midpoint that isn't a point yet, as a hollow dot that can be picked. */
function drawMidChoices(g) {
  if (ui.mode !== 'connect') return;
  const letters = pickLetters();
  freeMids().forEach(L => {
    const I = fig.info.get(L.id), q = px(midOf(L));
    const picked = isPicked('mp', L.id), dim = dimmed('mp', L.id);
    const hov = (ui.hover && ui.hover.kind === 'mid' && ui.hover.id === L.id) || (ui.hoverOpt && ui.hoverOpt.t === 'mp' && ui.hoverOpt.id === L.id);
    if (picked) el('circle', { class: 'dot-ring is-picked', cx: q.x, cy: q.y, r: geo.dot * 2.1 }, g);
    else if (!dim) el('circle', { class: 'dot-ring' + (hov ? '' : ' is-faint'), cx: q.x, cy: q.y, r: geo.dot * 2.1 }, g);
    el('circle', { class: 'dot is-ghost' + (dim ? ' is-dim' : ''), cx: q.x, cy: q.y, r: geo.dot }, g);
    if (picked) {
      const lp = labelSpot(q, [{ ang: angOf(I.u) }, { ang: angOf(mul(I.u, -1)) }]);
      el('text', { class: 'dot-label is-ghost', x: lp.x, y: lp.y, text: letters.mid.get(L.id) }, g);
      fig.labels.push(lp);
    }
  });
}

/**
 * Tick marks on the two halves of a line that has a midpoint: | on the
 * first such line, || on the second, ||| after that. While Connect is
 * open, a midpoint that is picked or pointed at shows them faintly.
 */
function drawMidMarks(g) {
  const list = [];
  model.dots.forEach(d => { if (d.mid && d.on && !list.some(x => x.id === d.on)) list.push({ id: d.on, pv: false }); });
  list.sort((a, b) => a.id - b.id);
  if (ui.mode === 'connect') {
    const show = ui.sel.filter(s => s.t === 'mp').map(s => s.id);
    if (ui.hover && ui.hover.kind === 'mid') show.push(ui.hover.id);
    if (ui.hoverOpt && ui.hoverOpt.t === 'mp') show.push(ui.hoverOpt.id);
    show.forEach(id => { if (!list.some(x => x.id === id)) list.push({ id, pv: true }); });
  }
  list.forEach((x, i) => {
    const I = fig.info.get(x.id);
    if (!I || I.len * geo.unit * 0.5 < geo.fs * 1.6) return;
    const n = Math.min(i + 1, 3), hl = geo.fs * 0.42, gap = geo.fs * 0.3;
    const e = { x: I.u.x, y: -I.u.y }, nrm = { x: -e.y, y: e.x };
    [0.25, 0.75].forEach(t => {
      const c = px(pointAt(I, t));
      let d = '';
      for (let k = 0; k < n; k++) {
        const o = (k - (n - 1) / 2) * gap, cx = c.x + e.x * o, cy = c.y + e.y * o;
        d += `M${cx + nrm.x * hl},${cy + nrm.y * hl} L${cx - nrm.x * hl},${cy - nrm.y * hl}`;
      }
      el('path', { class: 'mid-mark' + (x.pv ? ' is-preview' : ''), c: colorOf(I.L.color), d }, g);
    });
  });
}

/** A right-angle mark wherever two lines meet at 90°. */
function drawRightMarks(g) {
  fig.vertices.forEach(v => {
    if (!v.named) return;
    const done = new Set();
    for (let i = 0; i < v.rays.length; i++) {
      for (let j = i + 1; j < v.rays.length; j++) {
        const r1 = v.rays[i], r2 = v.rays[j];
        if (r1.line === r2.line) continue;
        const pairKey = Math.min(r1.line, r2.line) + '-' + Math.max(r1.line, r2.line);
        if (done.has(pairKey) || Math.abs(angGap(r1.ang, r2.ang) - Math.PI / 2) > RIGHT_EPS) continue;
        done.add(pairKey);
        squareMark(g, v, r1, r2, 'ra-mark');
      }
    }
  });
}

function squareMark(g, v, r1, r2, cls) {
  // Bigger than a point's hover ring, so the mark still shows around a picked point.
  const q = px(v), s = Math.min(geo.fs * 0.95, Math.min(r1.reach, r2.reach) * geo.unit * 0.42);
  const e1 = { x: r1.dir.x, y: -r1.dir.y }, e2 = { x: r2.dir.x, y: -r2.dir.y };
  el('path', {
    class: cls,
    d: `M${q.x + e1.x * s},${q.y + e1.y * s} L${q.x + (e1.x + e2.x) * s},${q.y + (e1.y + e2.y) * s} L${q.x + e2.x * s},${q.y + e2.y * s}`
  }, g);
}

/** Arrow marks on parallel lines: > on the first set, >> on the second, and so on. */
function drawParMarks(g) {
  model.par.forEach((grp, gi) => {
    const I0 = fig.info.get(grp[0]);
    if (!I0) return;
    const n = Math.min(gi + 1, 3), s = geo.fs * 0.34, gap = geo.fs * 0.42;
    grp.forEach(id => {
      const I = fig.info.get(id);
      if (!I || I.len * geo.unit < geo.fs * 2.4) return;
      const u = dot(I.u, I0.u) >= 0 ? I.u : mul(I.u, -1);
      const e = { x: u.x, y: -u.y }, nrm = { x: -e.y, y: e.x };
      // Beside a point at the middle (a midpoint), rather than under it.
      const m = px(pointAt(I, I.att.some(a => Math.abs(a.t - 0.5) < 0.1) ? 0.625 : 0.5));
      for (let k = 0; k < n; k++) {
        const o = (k - (n - 1) / 2) * gap, tip = { x: m.x + e.x * (o + s / 2), y: m.y + e.y * (o + s / 2) };
        el('path', {
          class: 'par-mark', c: colorOf(I.L.color),
          d: `M${tip.x - e.x * s + nrm.x * s},${tip.y - e.y * s + nrm.y * s} L${tip.x},${tip.y} L${tip.x - e.x * s - nrm.x * s},${tip.y - e.y * s - nrm.y * s}`
        }, g);
      }
    });
  });
}

/** How big an angle's arc is: in proportion to its arms, within limits. */
const arcRadius = (r1, r2) => clamp(Math.min(r1.reach, r2.reach) * geo.unit * 0.42, geo.fs * 1.1, geo.fs * 1.8);

/** The arc (or square) of an angle at a corner. */
function angleArc(g, v, r1, r2, cls) {
  const q = px(v), th = angGap(r1.ang, r2.ang), R = arcRadius(r1, r2);
  if (Math.abs(th - Math.PI / 2) < 0.05 * DEG) {
    const s = R * 0.62;
    const e1 = { x: r1.dir.x, y: -r1.dir.y }, e2 = { x: r2.dir.x, y: -r2.dir.y };
    el('path', { class: cls + ' is-square', d: `M${q.x},${q.y} L${q.x + e1.x * s},${q.y + e1.y * s} L${q.x + (e1.x + e2.x) * s},${q.y + (e1.y + e2.y) * s} L${q.x + e2.x * s},${q.y + e2.y * s} Z` }, g);
    return R;
  }
  const a1 = r1.ang, sweepCcw = normAng(r2.ang - a1) > 0;
  const s = { x: q.x + R * Math.cos(a1), y: q.y - R * Math.sin(a1) };
  const e = { x: q.x + R * Math.cos(r2.ang), y: q.y - R * Math.sin(r2.ang) };
  el('path', { class: cls, d: `M${q.x},${q.y} L${s.x},${s.y} A${R},${R} 0 0 ${sweepCcw ? 0 : 1} ${e.x},${e.y} Z` }, g);
  return R;
}

function drawAngleMeasures(g) {
  const o = ui.hoverOpt;
  model.measures.forEach(m => {
    if (m.kind !== 'ang') return;
    const mi = measureInfo(m);
    if (mi) angleArc(g, mi.v, mi.r1, mi.r2, 'ang-arc' + (o && o.t === 'm' && o.id === m.id ? ' is-hl' : ''));
  });
}

/** While measuring angles: the angle under the pointer, or the option being hovered. */
function drawAngleHover(g) {
  if (ui.mode !== 'mang') return;
  let a = ui.hover && ui.hover.kind === 'ang' ? ui.hover.a : null;
  if (ui.hoverOpt && ui.hoverOpt.t === 'a') a = allAngles().find(x => x.key === ui.hoverOpt.id) || a;
  if (a) angleArc(g, a.v, a.r1, a.r2, 'ang-arc is-preview');
}

function drawPivot(g) {
  const P = dotById(drag.piv), D0 = dotById(drag.d);
  if (!P || !D0) return;
  const q = px(P), r = dist(P, D0) * geo.unit;
  el('circle', { class: 'turn-path', cx: q.x, cy: q.y, r }, g);
  el('circle', { class: 'pivot-ring', cx: q.x, cy: q.y, r: geo.dot * 2.1 }, g);
}

function drawPreview(g, top) {
  const pv = ui.preview;
  if (!pv || pv.error) return;
  const c = colorOf(ui.color), a = px(pv.A), b = px(pv.B);
  el('line', { class: 'ln is-preview', c, x1: a.x, y1: a.y, x2: b.x, y2: b.y }, g);
  const ghost = (P, letter, rays) => {
    const q = px(P);
    el('circle', { class: 'dot is-ghost', cx: q.x, cy: q.y, r: geo.dot }, top);
    const lp = labelSpot(q, rays);
    el('text', { class: 'dot-label is-ghost', x: lp.x, y: lp.y, text: letter }, top);
  };
  const ray = (from, to) => ({ ang: angOf(sub(to, from)) });
  if (pv.kind === 'new') {
    const [la, lb] = freeLetters(2);
    ghost(pv.A, la, [ray(pv.A, pv.B)]);
    ghost(pv.B, lb, [ray(pv.B, pv.A)]);
  } else if (pv.kind === 'perp') {
    const I = fig.info.get(pv.line);
    // The foot can land past an end: the line is shown continuing to it.
    if (pv.t < I.t0 - 1e-9 || pv.t > I.t1 + 1e-9) {
      const from = px(pv.t < 0 ? (I.t0 < 0 ? pointAt(I, I.t0) : I.A) : (I.t1 > 1 ? pointAt(I, I.t1) : I.B));
      el('line', { class: 'ln-ext', c: colorOf(I.L.color), x1: from.x, y1: from.y, x2: b.x, y2: b.y }, g);
    }
    const toQ = unitV(sub(pv.A, pv.B));
    const rays = [{ ang: angOf(toQ), dir: toQ, reach: dist(pv.A, pv.B) }, { ang: angOf(I.u), dir: I.u, reach: 1 }, { ang: angOf(mul(I.u, -1)), dir: mul(I.u, -1), reach: 1 }];
    // The right-angle mark goes on the side where the line is (toward its middle).
    squareMark(g, { x: pv.B.x, y: pv.B.y }, rays[0], pv.t <= 0.5 ? rays[1] : rays[2], 'ra-mark');
    if (!pv.existing) ghost(pv.B, pv.foot, rays);
  }
}

/* ------------------------------------------------------------
   12. Measure labels (buttons over the canvas: click to remove)
   ------------------------------------------------------------ */

const tagEls = new Map();

/* Each label goes in the first nearby spot that is clear of every line,
   point, letter and other label, so it never hides what it measures
   (or sits where a click on a line would land on it instead). */

/** Does the segment ab (pixels) pass through the box? (Liang–Barsky) */
function segHitsBox(a, b, x0, y0, x1, y1) {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy], q = [a.x - x0, x1 - a.x, a.y - y0, y1 - a.y];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-12) { if (q[i] < 0) return false; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

function obstacles() {
  const segs = [];
  fig.info.forEach(I => segs.push([px(pointAt(I, I.t0)), px(pointAt(I, I.t1))]));
  const pts = model.dots.map(d => ({ ...px(d), r: geo.dot * 2.2 }));
  (fig.labels || []).forEach(l => pts.push({ x: l.x, y: l.y, r: geo.fs * 0.62 }));
  return { segs, pts };
}

function boxClear(c, w, h, obs, placed) {
  const m = geo.fs * 0.2, x0 = c.x - w / 2 - m, x1 = c.x + w / 2 + m, y0 = c.y - h / 2 - m, y1 = c.y + h / 2 + m;
  if (x0 < 2 || y0 < 2 || x1 > geo.W - 2 || y1 > geo.H - 2) return false;
  if (obs.segs.some(s => segHitsBox(s[0], s[1], x0, y0, x1, y1))) return false;
  if (obs.pts.some(p => { const dx = Math.max(x0 - p.x, 0, p.x - x1), dy = Math.max(y0 - p.y, 0, p.y - y1); return dx * dx + dy * dy < p.r * p.r; })) return false;
  return !placed.some(r => !(x1 < r.x0 || x0 > r.x1 || y1 < r.y0 || y0 > r.y1));
}

/** Beside a line: at its middle on the outside of its shape, then further along, then further out. */
function lengthSpots(I, w, h) {
  let n = { x: -I.u.y, y: I.u.x };
  const comp = reach(I.L.a, null, adjacency()).filter(id => id !== I.L.a && id !== I.L.b).map(dotById).filter(d => d && d.on !== I.L.id);
  if (comp.length) {
    const c = comp.reduce((s, d) => ({ x: s.x + d.x / comp.length, y: s.y + d.y / comp.length }), { x: 0, y: 0 });
    if (dot(n, sub(c, pointAt(I, 0.5))) > 0) n = mul(n, -1);
  } else if (n.y < -1e-9 || (Math.abs(n.y) <= 1e-9 && n.x > 0)) n = mul(n, -1);
  const sn = { x: n.x, y: -n.y };     // on screen
  const off = (w / 2) * Math.abs(sn.x) + (h / 2) * Math.abs(sn.y) + geo.fs * 0.45;
  const out = [];
  [0, 1, 2].forEach(k => [0.5, 0.36, 0.64, 0.22, 0.78].forEach(t => {
    const q = px(pointAt(I, t));
    [1, -1].forEach(s => out.push({ x: q.x + sn.x * s * (off + k * geo.fs), y: q.y + sn.y * s * (off + k * geo.fs) }));
  }));
  return out;
}

/** Around a corner, nearest the arc first: inside the angle if it fits, otherwise just beside it. */
function angleSpots(mi, w, h) {
  const q = px(mi.v), R = arcRadius(mi.r1, mi.r2);
  const bis = mi.r1.ang + normAng(mi.r2.ang - mi.r1.ang) / 2, half = mi.th / 2;
  const arcMid = { x: q.x + R * Math.cos(bis), y: q.y - R * Math.sin(bis) };
  const out = [];
  // Inside the angle, far enough out that the label clears both arms.
  const sb = { x: Math.cos(bis), y: -Math.sin(bis) };
  const need = ((w / 2) * Math.abs(Math.sin(bis)) + (h / 2) * Math.abs(Math.cos(bis))) / Math.max(Math.sin(half), 0.05);
  const ext = (w / 2) * Math.abs(sb.x) + (h / 2) * Math.abs(sb.y);
  const d0 = Math.max(R + ext + geo.fs * 0.3, Math.min(need, R + geo.fs * 7));
  for (let k = 0; k < 4; k++) out.push({ x: q.x + sb.x * (d0 + k * geo.fs * 0.8), y: q.y + sb.y * (d0 + k * geo.fs * 0.8), inside: true });
  for (let i = 1; i <= 12; i++) {
    [1, -1].forEach(s => {
      const a = bis + s * i * 15 * DEG, sd = { x: Math.cos(a), y: -Math.sin(a) };
      const e = (w / 2) * Math.abs(sd.x) + (h / 2) * Math.abs(sd.y);
      for (let k = 0; k < 4; k++) out.push({ x: q.x + sd.x * (R + e + geo.fs * (0.5 + k * 0.8)), y: q.y + sd.y * (R + e + geo.fs * (0.5 + k * 0.8)) });
    });
  }
  // Nearest to the arc wins, with a head start for spots inside the angle.
  const cost = c => Math.hypot(c.x - arcMid.x, c.y - arcMid.y) - (c.inside ? geo.fs * 1.5 : 0);
  return out.sort((a, b) => cost(a) - cost(b));
}

function placeTags(gLead) {
  const keep = new Set(), obs = obstacles(), placed = [];
  model.measures.forEach(m => {
    const mi = measureInfo(m);
    if (!mi) return;
    keep.add(m.id);
    let b = tagEls.get(m.id);
    if (!b) {
      b = document.createElement('button');
      b.type = 'button';
      b.dataset.mid = m.id;
      b.title = 'Click to remove this measure';
      tagsEl.appendChild(b);
      tagEls.set(m.id, b);
    }
    b.className = 'm-tag' + (mi.kind === 'ang' ? ' is-ang' : '') + (ui.hoverOpt && ui.hoverOpt.t === 'm' && ui.hoverOpt.id === m.id ? ' is-hl' : '');
    if (mi.kind === 'len') b.style.setProperty('--c', colorOf(mi.I.L.color));
    if (b.dataset.text !== mi.text) { b.textContent = mi.text; b.dataset.text = mi.text; }
    b.setAttribute('aria-label', mi.label + '. Remove this measure.');
    const w = b.offsetWidth, h = b.offsetHeight;
    const spots = mi.kind === 'len' ? lengthSpots(mi.I, w, h) : angleSpots(mi, w, h);
    const at = spots.find(c => boxClear(c, w, h, obs, placed)) || spots[0];
    placed.push({ x0: at.x - w / 2, x1: at.x + w / 2, y0: at.y - h / 2, y1: at.y + h / 2 });
    b.style.left = at.x + 'px';
    b.style.top = at.y + 'px';
    // An angle's label that had to move away from its corner gets a thin line back to the arc.
    if (mi.kind === 'ang' && gLead) {
      const q = px(mi.v), R = arcRadius(mi.r1, mi.r2), mid = mi.r1.ang + normAng(mi.r2.ang - mi.r1.ang) / 2;
      const from = { x: q.x + R * Math.cos(mid), y: q.y - R * Math.sin(mid) };
      const dx = at.x - from.x, dy = at.y - from.y, len = Math.hypot(dx, dy);
      const reachBox = Math.min(w / 2 / (Math.abs(dx / len) || 1e-9), h / 2 / (Math.abs(dy / len) || 1e-9));
      if (len - reachBox > geo.fs * 1.1) {
        el('line', { class: 'tag-lead', x1: from.x, y1: from.y, x2: at.x - dx / len * reachBox, y2: at.y - dy / len * reachBox }, gLead);
      }
    }
  });
  tagEls.forEach((b, id) => { if (!keep.has(id)) { b.remove(); tagEls.delete(id); } });
}

function removeMeasure(id) {
  if (!model.measures.some(m => m.id === id)) return;
  pushHistory();
  model.measures = model.measures.filter(m => m.id !== id);
  if (ui.hoverOpt && ui.hoverOpt.t === 'm' && ui.hoverOpt.id === id) ui.hoverOpt = null;
  cleanup();
  renderAll();
}

tagsEl.addEventListener('click', ev => {
  const b = ev.target.closest('[data-mid]');
  if (b) removeMeasure(+b.dataset.mid);
});
tagsEl.addEventListener('mouseover', ev => {
  const b = ev.target.closest('[data-mid]');
  setHoverOpt(b ? { t: 'm', id: +b.dataset.mid } : null);
});
tagsEl.addEventListener('mouseleave', () => setHoverOpt(null));

function toggleLen(lineId) {
  pushHistory();
  const i = model.measures.findIndex(m => m.kind === 'len' && m.line === lineId);
  if (i >= 0) model.measures.splice(i, 1);
  else model.measures.push({ id: model.seq++, kind: 'len', line: lineId });
  cleanup();
  renderAll();
}

function toggleAng(a) {
  pushHistory();
  const i = model.measures.findIndex(m => m.kind === 'ang' && m.v === a.v.key && [a.r1.key, a.r2.key].every(k => m.r.includes(k)));
  if (i >= 0) model.measures.splice(i, 1);
  else {
    if (a.v.kind === 'cross' && !model.cross[a.v.ck]) model.cross[a.v.ck] = a.v.letter;
    model.measures.push({ id: model.seq++, kind: 'ang', v: a.v.key, r: [a.r1.key, a.r2.key] });
  }
  cleanup();
  renderAll();
}

const isMeasuredLen = id => model.measures.some(m => m.kind === 'len' && m.line === id);
const isMeasuredAng = a => model.measures.some(m => m.kind === 'ang' && m.v === a.v.key && [a.r1.key, a.r2.key].every(k => m.r.includes(k)));

/** The angle whose opening holds a click near its corner (the smallest, when several do). */
function angleAtPoint(p) {
  const R = Math.max(geo.fs * 3.4, geo.unit * 1.6);
  let best = null, bestD = Infinity;
  fig.vertices.forEach(v => {
    const q = px(v), d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d > R || d >= bestD || d < 2) return;
    const phi = Math.atan2(q.y - p.y, p.x - q.x);
    let pick = null;
    anglesAt(v).forEach(a => {
      const span = normAng(a.r2.ang - a.r1.ang), at = normAng(phi - a.r1.ang);
      const inside = span > 0 ? at >= 0 && at <= span : at <= 0 && at >= span;
      if (inside && (!pick || a.th < pick.th)) pick = a;
    });
    if (pick) { best = pick; bestD = d; }
  });
  return best;
}

/* ------------------------------------------------------------
   13. Pointer: hover, click, move, turn, snap
   ------------------------------------------------------------ */

function hitTest(p, type) {
  if (!fig) return null;
  const big = type && type !== 'mouse' ? 1.35 : 1;
  let best = null, bd = geo.hitR * big;
  model.dots.forEach(dt => {
    const q = px(dt), d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d <= bd) { bd = d; best = dt; }
  });
  if (best) return { kind: 'dot', dot: best };
  // Connect: a line's midpoint (one that can't be picked lets the click go to the line).
  if (ui.mode === 'connect') {
    let bm = null;
    bd = geo.hitR * 0.8 * big;
    freeMids().forEach(L => {
      if (dimmed('mp', L.id)) return;
      const q = px(midOf(L)), d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d <= bd) { bd = d; bm = L; }
    });
    if (bm) return { kind: 'mid', line: bm };
  }
  let bl = null;
  bd = geo.tol * big;
  model.lines.forEach(L => {
    const I = fig.info.get(L.id), d = pxSegDist(p, px(I.A), px(I.B));
    if (d <= bd) { bd = d; bl = L; }
  });
  return bl ? { kind: 'line', line: bl } : null;
}

function setCursor(name) {
  svg.classList.remove('cur-move', 'cur-rotate', 'cur-pick', 'cur-no', 'is-dragging');
  if (name) svg.classList.add(name);
}

function showTip(p, html) {
  if (!html || !p) { tipEl.hidden = true; return; }
  tipEl.innerHTML = html;
  tipEl.hidden = false;
  tipEl.style.left = p.x + 'px';
  tipEl.style.top = p.y + 'px';
  tipEl.classList.toggle('flip', p.x > geo.W * 0.6);
}

function sameHover(a, b) {
  if (!a || !b) return a === b;
  return a.kind === b.kind && a.id === b.id && a.line === b.line && a.key === b.key;
}

function setHover(h) {
  if (sameHover(ui.hover, h)) return;
  ui.hover = h;
  renderCanvas();
}

function setHoverOpt(o) {
  const a = ui.hoverOpt;
  if ((!a && !o) || (a && o && a.t === o.t && a.id === o.id)) return;
  ui.hoverOpt = o;
  renderCanvas();
}

function onHover(p, type) {
  let h = null, tip = '', cursor = '';
  const mode = ui.mode;
  if (mode === 'mang') {
    const a = angleAtPoint(p);
    if (a) { h = { kind: 'ang', key: a.key, a }; cursor = 'cur-pick'; tip = `<b>${esc(a.name)}</b> · click to ${isMeasuredAng(a) ? 'remove its measure' : 'measure it'}`; }
  } else {
    const hit = hitTest(p, type);
    if (hit) {
      const L = hit.kind === 'dot' ? lineFor(hit.dot, p) : hit.line;
      const isEnd = hit.kind === 'dot' && (L.a === hit.dot.id || L.b === hit.dot.id);
      h = hit.kind === 'dot' ? { kind: 'dot', id: hit.dot.id, line: L.id } : { kind: hit.kind, id: L.id };
      if (mode === 'connect') {
        const item = hit.kind === 'dot' ? { t: 'd', id: hit.dot.id } : { t: hit.kind === 'mid' ? 'mp' : 'l', id: L.id };
        const why = whyNotPick(item), act = isPicked(item.t, item.id) ? 'unpick' : 'pick';
        cursor = why ? 'cur-no' : 'cur-pick';
        tip = why || (item.t === 'mp' ? `The midpoint of ${segHtml(L)} · click to ${act} it` : `Click to ${act}`);
      } else if (mode === 'parallel' || mode === 'mlen') {
        h = { kind: 'line', id: L.id };
        cursor = 'cur-pick';
        tip = mode === 'parallel' ? `Copy ${segHtml(L)}` : `${segHtml(L)} · click to ${isMeasuredLen(L.id) ? 'remove its measure' : 'measure it'}`;
      } else if (isEnd) {
        cursor = 'cur-rotate';
        const piv = otherEnd(L, hit.dot.id);
        const more = reach(hit.dot.id, piv, adjacency()).some(id => id !== hit.dot.id && dotById(id).on !== L.id);
        tip = `<b>${esc(hit.dot.letter)}</b> · drag to turn ${segHtml(L)}${more ? ', and what is joined to it,' : ''} about ${esc(letterOf(piv))}`;
      } else {
        cursor = 'cur-move';
        const what = isShape(L) ? 'the shape' : hit.kind === 'dot' ? segHtml(L) : 'it';
        tip = hit.kind === 'dot'
          ? `<b>${esc(hit.dot.letter)}</b>, ${hit.dot.mid ? 'the midpoint of' : 'on'} ${segHtml(L)} · drag to move ${what}`
          : `${segHtml(L)} · drag to move ${what}`;
      }
    }
  }
  setCursor(cursor);
  showTip(p, tip);
  setHover(h);
}

svg.addEventListener('pointerdown', ev => {
  if (!geo || ev.button !== 0) return;
  if (menuJustClosed) { menuJustClosed = false; return; }
  hideBubble();
  const p = eventPx(ev), hit = hitTest(p, ev.pointerType);
  press = { id: ev.pointerId, p, hit, type: ev.pointerType, line: hit && hit.kind === 'dot' ? lineFor(hit.dot, p) : null };
  try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* pointer already gone */ }
  if (hit && ev.pointerType !== 'mouse') {
    press.timer = setTimeout(() => {
      if (!press || drag) return;
      const pr = press;
      press = null;
      lastLong = Date.now();
      openMenuFor(pr.hit, pr.p, pr.line);
    }, LONG_PRESS);
  }
  ev.preventDefault();
});

svg.addEventListener('pointermove', ev => {
  if (!geo) return;
  const p = eventPx(ev);
  if (drag) { if (ev.pointerId === drag.id) dragTo(p); return; }
  if (press && ev.pointerId === press.id) {
    if (Math.hypot(p.x - press.p.x, p.y - press.p.y) > 6) {
      clearTimeout(press.timer);
      const pr = press;
      press = null;
      if (pr.hit) { startDrag(pr); dragTo(p); }
    }
    return;
  }
  if (ev.pointerType === 'mouse') onHover(p, 'mouse');
});

function endPress(ev) {
  if (drag && ev.pointerId === drag.id) {
    endDrag();
    if (ev.pointerType === 'mouse' && ev.type === 'pointerup') onHover(eventPx(ev), 'mouse');
    return;
  }
  if (press && ev.pointerId === press.id) {
    clearTimeout(press.timer);
    const pr = press;
    press = null;
    if (ev.type === 'pointerup') onClick(pr);
  }
}

svg.addEventListener('pointerup', endPress);
svg.addEventListener('pointercancel', endPress);
svg.addEventListener('pointerleave', () => {
  if (drag || press) return;
  showTip(null);
  setCursor('');
  setHover(null);
});

svg.addEventListener('contextmenu', ev => {
  ev.preventDefault();
  menuJustClosed = false;
  if (press) { clearTimeout(press.timer); press = null; }
  if (drag || Date.now() - lastLong < 900) return;
  const p = eventPx(ev), hit = hitTest(p, ev.pointerType || 'mouse');
  if (hit) openMenuFor(hit, p, hit.kind === 'dot' ? lineFor(hit.dot, p) : null);
  else closeMenu();
});

function onClick(pr) {
  const hit = pr.hit, line = hit ? (hit.kind === 'dot' ? pr.line : hit.line) : null;
  switch (ui.mode) {
    case 'connect':
      if (hit) connectPick(hit.kind === 'dot' ? { t: 'd', id: hit.dot.id } : { t: hit.kind === 'mid' ? 'mp' : 'l', id: line.id });
      return;
    case 'parallel':
      if (line) { ui.ref = line.id; ui.len = clamp(Math.round(fig.info.get(line.id).len) || 1, 1, maxLen()); renderAll(); }
      return;
    case 'mlen':
      if (line) toggleLen(line.id);
      return;
    case 'mang': {
      const a = angleAtPoint(pr.p);
      if (a) toggleAng(a);
      else flash('Click <b>inside an angle</b>, close to its corner.');
      return;
    }
    case 'length':
      return;
    default:
      if (line) showBubble(line, hit.kind === 'dot' ? hit.dot.id : null, pr.p);
  }
}

/* --- moving and turning --- */

function startDrag(pr) {
  pushHistory();
  showTip(null);
  closeMenu();
  const adj = adjacency();
  const save = ids => new Map(ids.map(id => { const d = dotById(id); return [id, { x: d.x, y: d.y }]; }));
  const D0 = pr.hit.kind === 'dot' ? pr.hit.dot : null;
  if (D0 && (pr.line.a === D0.id || pr.line.b === D0.id)) {
    const L = pr.line, P = dotById(otherEnd(L, D0.id));
    const S = reach(D0.id, P.id, adj);
    const links = S.reduce((n, id) => n + (adj.get(id) || []).filter(x => x === P.id).length, 0);
    drag = { type: 'rotate', line: L.id, d: D0.id, piv: P.id, S, start: save(S), links };
  } else {
    // The middle of a line, or a midpoint on it: move the line and what is joined to it.
    const L = D0 ? pr.line : pr.hit.line, S = reach(L.a, null, adj);
    drag = { type: 'move', line: L.id, S, start: save(S), w0: toWorld(pr.p) };
  }
  drag.id = pr.id;
  drag.snap = null;
  setCursor('is-dragging');
  ui.hover = null;
}

function dragTo(p) {
  const w = toWorld(p);
  if (drag.type === 'move') moveTo(w); else turnTo(w);
  renderCanvas();
  showSnap();
}

/** Every pair of a moving point and a still point that are now in the same place. */
function meetingPairs(inS) {
  const out = [];
  drag.S.forEach(id => {
    const m = dotById(id);
    model.dots.forEach(t => { if (!inS.has(t.id) && dist(m, t) < SAME_EPS) out.push([id, t.id]); });
  });
  return out;
}

function moveTo(w) {
  let delta = sub(w, drag.w0);
  const inS = new Set(drag.S);
  drag.snap = null;
  // Snap: the moving point that comes nearest to a still point lands on it. A slide never changes a length.
  let best = null, bd = geo.snap;
  drag.S.forEach(id => {
    const q = px(add(drag.start.get(id), delta));
    model.dots.forEach(t => {
      if (inS.has(t.id)) return;
      const tq = px(t), d = Math.hypot(tq.x - q.x, tq.y - q.y);
      if (d < bd) { bd = d; best = { m: id, t: t.id }; }
    });
  });
  if (best) delta = sub(dotById(best.t), drag.start.get(best.m));
  drag.S.forEach(id => { const s = drag.start.get(id), d = dotById(id); d.x = s.x + delta.x; d.y = s.y + delta.y; });
  if (best) drag.snap = { kind: 'dot', t: best.t, pairs: meetingPairs(inS) };
}

function turnTo(w) {
  const P = dotById(drag.piv), D0 = drag.start.get(drag.d);
  const base = angOf(sub(D0, P));
  let th = angOf(sub(w, P)) - base;
  const cand = turnSnap(th, P, D0, base);
  drag.snap = cand;
  if (cand) th = cand.th;
  let shift = null;
  if (cand && cand.kind === 'perpFoot') shift = sub(cand.F, rot(D0, P, th));
  drag.S.forEach(id => {
    let q = rot(drag.start.get(id), P, th);
    if (shift) q = add(q, shift);
    const d = dotById(id);
    d.x = q.x;
    d.y = q.y;
  });
}

/**
 * Snaps while turning, strongest first:
 *   dot       a moving point lands on a point just as far from the pivot (no length changes)
 *   perpAt    the line makes a right angle with a line through the pivot
 *   perpFoot  the end comes to a line nearly at a right angle: it lands on it (the length changes)
 *   par       the line comes close to a nearly parallel line: it turns parallel
 *   straight  the line nearly continues a line that ends at the pivot: it makes a straight line
 */
function turnSnap(th, P, D0, base) {
  const inS = new Set(drag.S);
  let best = null, bd = geo.snap;
  drag.S.forEach(id => {
    const s0 = drag.start.get(id), r = dist(s0, P);
    if (r < 1e-9) return;
    const q = px(rot(s0, P, th));
    model.dots.forEach(t => {
      if (inS.has(t.id) || t.id === drag.piv || Math.abs(dist(t, P) - r) > SAME_EPS) return;
      const tq = px(t), d = Math.hypot(tq.x - q.x, tq.y - q.y);
      if (d < bd) { bd = d; best = { kind: 'dot', m: id, t: t.id, th: normAng(angOf(sub(t, P)) - angOf(sub(s0, P))) }; }
    });
  });
  if (best) return best;

  const u = { x: Math.cos(base + th), y: Math.sin(base + th) };
  const Dq = rot(D0, P, th);
  const others = model.lines.filter(L => L.id !== drag.line && !inS.has(L.a) && !inS.has(L.b));
  const pivotOn = L => L.a === drag.piv || L.b === drag.piv || P.on === L.id;
  const fit = target => normAng(angOf(target) - base);

  let perp = null, dev = PERP_TOL;
  others.forEach(L => {
    const I = fig.info.get(L.id), off = Math.PI / 2 - Math.acos(Math.min(1, Math.abs(dot(u, I.u))));
    if (off >= dev) return;
    if (pivotOn(L)) {
      const n = { x: -I.u.y, y: I.u.x };
      perp = { kind: 'perpAt', line: L.id, th: fit(dot(n, u) >= 0 ? n : mul(n, -1)) };
      dev = off;
      return;
    }
    if (drag.links !== 1) return;     // the turning part is a closed shape: its lengths can't change
    // The turning line points at L; its end has to be near L: just short of it, or a little past it.
    const den = cross(u, I.u);
    if (Math.abs(den) < 1e-9) return;
    const s = cross(sub(I.A, P), I.u) / den, r = dist(D0, P);
    if (s < 0.25 || Math.abs(s - r) > Math.max(geo.snap / geo.unit, Math.min(1.5, 0.4 * r))) return;
    const F = proj(P, I.A, I.B);
    if (F.t < I.t0 - 1e-9 || F.t > I.t1 + 1e-9 || dist(F, P) < 0.25) return;
    perp = { kind: 'perpFoot', line: L.id, F: { x: F.x, y: F.y }, th: fit(sub(F, P)) };
    dev = off;
  });
  if (perp) return perp;

  let par = null, pdev = PAR_TOL;
  others.forEach(L => {
    const I = fig.info.get(L.id), off = Math.acos(Math.min(1, Math.abs(dot(u, I.u))));
    if (off >= pdev) return;
    if (pivotOn(L)) {
      if (P.on === L.id) return;   // along the line it sits on: it would lie on top of it
      const away = unitV(sub(P, dotById(otherEnd(L, drag.piv))));
      if (dot(away, u) <= 0) return;
      par = { kind: 'straight', line: L.id, th: fit(away) };
    } else {
      if (segSegDist(P, Dq, I.A, I.B) > PAR_NEAR) return;
      par = { kind: 'par', line: L.id, th: fit(dot(u, I.u) >= 0 ? I.u : mul(I.u, -1)) };
    }
    pdev = off;
  });
  return par;
}

/** The message that shows while a snap is held. */
function showSnap() {
  const s = drag && drag.snap;
  if (!s) { snapEl.hidden = true; return; }
  const L = lineById(drag.line), T = s.line && lineById(s.line);
  let html = '';
  if (s.kind === 'dot') {
    const pairs = drag.type === 'move' ? s.pairs : [[s.m, s.t]];
    html = pairs.map(([a, b]) => {
      const keep = Math.min(a, b), gone = Math.max(a, b);
      return `<b>${esc(letterOf(gone))}</b> joins <b>${esc(letterOf(keep))}</b>`;
    }).join(' · ') + ' · let go to make them one point';
  } else if (s.kind === 'perpFoot') {
    const v = fig.info.get(L.id).len, exact = isWhole(v) || Math.abs(v - round2(v)) < 1e-6;
    html = `${segHtml(L)} ⊥ ${segHtml(T)} · ${segHtml(L)} becomes ${exact ? '' : 'about '}${isWhole(v) ? Math.round(v) : round2(v)} units long`;
  } else if (s.kind === 'perpAt') {
    html = `${segHtml(L)} ⊥ ${segHtml(T)} · a right angle at <b>${esc(letterOf(drag.piv))}</b>`;
  } else if (s.kind === 'par') {
    html = `${segHtml(L)} ∥ ${segHtml(T)} · parallel`;
  } else if (s.kind === 'straight') {
    html = `${segHtml(L)} and ${segHtml(T)} make a straight line through <b>${esc(letterOf(drag.piv))}</b>`;
  }
  snapEl.innerHTML = `<span class="snap-ico" aria-hidden="true">${{ dot: '●', perpFoot: '⊥', perpAt: '⊥', par: '∥', straight: '—' }[s.kind]}</span><span>${html}</span>`;
  snapEl.hidden = false;
}

function endDrag() {
  const dr = drag;
  drag = null;
  snapEl.hidden = true;
  setCursor('');
  const s = dr.snap;
  let msg = '';
  if (s && s.kind === 'dot') {
    const pairs = dr.type === 'move' ? s.pairs : [[s.m, s.t]];
    const merged = pairs.map(([a, b]) => mergeDots(a, b)).filter(Boolean);
    if (merged.length) msg = merged.map(r => `<b>${esc(r.gone)}</b> joined <b>${esc(r.kept)}</b>`).join(', ') + '.';
  } else if (s && s.kind === 'perpFoot') {
    const dt = dotById(dr.d), L = lineById(s.line);
    const there = [L.a, L.b, ...model.dots.filter(d => d.on === L.id).map(d => d.id)].find(id => id !== dt.id && dist(dotById(id), dt) < SAME_EPS);
    if (there) { const r = mergeDots(dt.id, there); if (r) msg = `<b>${esc(r.gone)}</b> joined <b>${esc(r.kept)}</b>.`; }
    else { dt.on = L.id; msg = `${segHtml(lineById(dr.line))} ⊥ ${segHtml(L)}.`; }
  } else if (s && s.kind === 'par') {
    addParallel(dr.line, s.line);
    msg = `${segHtml(lineById(dr.line))} ∥ ${segHtml(lineById(s.line))}.`;
  }
  cleanup();
  renderAll();
  if (msg) flash(msg, false);
}

/* --- Connect: picking dots and a line --- */

function connectPick(item) {
  const i = ui.sel.findIndex(s => s.t === item.t && s.id === item.id);
  if (i >= 0) ui.sel.splice(i, 1);
  else {
    const why = whyNotPick(item);
    if (why) { toolMsg(why, true); return; }
    ui.sel.push(item);
  }
  renderAll();
}

/* ------------------------------------------------------------
   14. The Delete bubble and the options menu
   ------------------------------------------------------------ */

function showBubble(L, dotId, p) {
  // A midpoint's bubble removes the point; the line's own bubble deletes the line.
  const lone = dotId !== null && isLone(dotId);
  ui.bubble = { line: L.id, dot: dotId, p, lone };
  bubbleEl.innerHTML = (lone
    ? `<button type="button" class="bub-del" data-act="remove">Remove ${esc(letterOf(dotId))}</button>`
    : `<button type="button" class="bub-del" data-act="delete">Delete ${segHtml(L)}</button>`) +
    `<button type="button" class="bub-more" data-act="more" aria-label="More options for segment ${esc(lineLetters(L))}" title="Length, color, letter, midpoint">⋯</button>`;
  bubbleEl.style.left = p.x + 'px';
  bubbleEl.style.top = p.y + 'px';
  bubbleEl.classList.toggle('is-below', p.y < geo.fs * 3.4);
  bubbleEl.hidden = false;
  showTip(null);
  setCursor('');
  renderCanvas();
}

function hideBubble() {
  if (!ui.bubble) return;
  ui.bubble = null;
  bubbleEl.hidden = true;
  renderCanvas();
}

bubbleEl.addEventListener('click', ev => {
  const b = ev.target.closest('[data-act]');
  if (!b || !ui.bubble) return;
  const { line, dot: d, p } = ui.bubble;
  if (b.dataset.act === 'delete') deleteLine(line);
  else if (b.dataset.act === 'remove') removeDot(d);
  else { hideBubble(); openMenu({ line, dot: d }, p); }
});

function openMenuFor(hit, p, line) {
  if (!hit) return;
  if (hit.kind === 'dot') openMenu({ line: (line || lineFor(hit.dot, p)).id, dot: hit.dot.id }, p);
  else openMenu({ line: hit.line.id, dot: null }, p);
}

function openMenu(spec, p) {
  const L = lineById(spec.line);
  if (!L) return;
  hideBubble();
  showTip(null);
  const dotId = spec.dot === undefined ? null : spec.dot;
  // The end that moves when the length changes: the point clicked, or (the middle, a midpoint) the nearer end.
  let end = dotId !== null && (L.a === dotId || L.b === dotId) ? dotId : null;
  if (end === null) {
    const w = toWorld(p);
    end = dist(dotById(L.a), w) <= dist(dotById(L.b), w) ? L.a : L.b;
  }
  ui.menu = { line: L.id, dot: dotId, end, p };
  buildMenu();
  renderCanvas();
  const first = menuEl.querySelector('select, input, .swatch');
  if (first) first.focus({ preventScroll: true });
}

function closeMenu() {
  if (!ui.menu) return;
  ui.menu = null;
  menuEl.hidden = true;
  menuEl.innerHTML = '';
  if (geo) renderCanvas();
}

function swatchesHtml(current) {
  return '<div class="swatches" role="radiogroup" aria-label="Color">' + COLORS.map((_, i) =>
    `<button type="button" class="swatch" role="radio" data-color="${i}" data-key="c${i}" style="--c:${colorOf(i)}" aria-checked="${i === current}" aria-label="${COLOR_NAMES[i]}" title="${COLOR_NAMES[i]}"></button>`).join('') + '</div>';
}

function buildMenu() {
  const m = ui.menu, L = m && lineById(m.line);
  if (!L || (m.dot !== null && !dotById(m.dot)) || !dotById(m.end)) { closeMenu(); return; }
  const focusId = menuEl.contains(document.activeElement) ? document.activeElement.id || document.activeElement.dataset.color : null;
  const dt = m.dot !== null ? dotById(m.dot) : null;
  const isEnd = !!dt && (L.a === dt.id || L.b === dt.id);
  const I = fig.info.get(L.id), plan = lengthPlan(L, m.end);
  const side = L.a === m.end ? 'a' : 'b';
  const shared = isEnd && (linesAt(dt.id).length > 1 || !!dt.on);
  let html = `<div class="ctx-head"><div><p class="ctx-title" id="ctxTitle">${dt ? 'Point ' + esc(dt.letter) : 'Line ' + segHtml(L)}</p>` +
    (dt ? `<p class="ctx-sub">${isEnd ? 'end of' : dt.mid ? 'midpoint of' : 'on'} ${segHtml(L)}</p>` : '') +
    '</div><button type="button" class="close-btn" data-act="close" aria-label="Close">×</button></div>';
  if (dt) {
    const free = new Set(freeLetters(LETTERS.length));
    const opts = LETTERS.filter(l => l === dt.letter || free.has(l));
    html += `<div class="ctx-row"><label class="form-label" for="ctxLetter">Letter</label><select class="ctx-select" id="ctxLetter">` +
      opts.map(l => `<option${l === dt.letter ? ' selected' : ''}>${esc(l)}</option>`).join('') + '</select></div>';
  }
  const cur = I.len;
  html += `<div class="ctx-row"><label class="form-label" for="ctxLen">Length of ${segHtml(L)}</label>
    <div class="stepper">
      <button class="step-btn" type="button" data-step="-1" aria-label="Shorter"${plan ? '' : ' disabled'}>−</button>
      <input class="num-input" id="ctxLen" type="text" inputmode="numeric" autocomplete="off" value="${Math.max(1, Math.round(cur))}" aria-describedby="ctxLenHint"${plan ? '' : ' disabled'}>
      <button class="step-btn" type="button" data-step="1" aria-label="Longer"${plan ? '' : ' disabled'}>+</button>
    </div>
    <p class="field-hint" id="ctxLenHint">${plan
      ? `Now ${isWhole(cur) ? '' : 'about '}${round2(cur)} ${round2(cur) === 1 ? 'unit' : 'units'} · <b>${esc(letterOf(plan.mover))}</b> moves`
      : 'Both ends are in a closed shape. Open the shape to change this length.'}</p></div>`;
  html += `<div class="ctx-row"><span class="form-label">Color</span>${swatchesHtml(L.color)}</div>`;
  html += isEnd
    ? `<label class="ctx-check"><input type="checkbox" id="ctxExt" data-side="${side}"${L.ext[side] ? ' checked' : ''}> Continue past ${esc(dt.letter)} as a dotted line</label>`
    : `<label class="ctx-check"><input type="checkbox" id="ctxExt" data-side="both"${L.ext.a && L.ext.b ? ' checked' : ''}> Continue both ways as a dotted line</label>`;
  html += '<div class="ctx-actions">';
  if (canAddMid(L)) html += `<button type="button" class="btn btn-ghost btn-sm" data-act="mid" id="ctxMid">Add midpoint of ${segHtml(L)}</button>`;
  if (shared) html += `<button type="button" class="btn btn-ghost btn-sm" data-act="open" id="ctxOpen">Open the shape at ${esc(dt.letter)}</button>`;
  if (dt && !isEnd && isLone(dt.id)) html += `<button type="button" class="btn btn-danger btn-sm" data-act="remove" id="ctxRemove">Remove ${esc(dt.letter)}</button>`;
  html += `<button type="button" class="btn btn-danger btn-sm" data-act="delete" id="ctxDelete">Delete ${segHtml(L)}</button></div>`;
  menuEl.innerHTML = html;
  menuEl.setAttribute('aria-labelledby', 'ctxTitle');
  menuEl.hidden = false;
  positionMenu();
  if (focusId) {
    const f = document.getElementById(focusId) || menuEl.querySelector(`[data-color="${focusId}"]`);
    if (f) f.focus({ preventScroll: true });
  }
}

function positionMenu() {
  const r = svg.getBoundingClientRect(), p = ui.menu.p;
  const cx = r.left + p.x * r.width / geo.W, cy = r.top + p.y * r.height / geo.H;
  const w = menuEl.offsetWidth, h = menuEl.offsetHeight, gap = 16;
  let x = cx + gap, y = cy - h / 3;
  if (x + w > innerWidth - 8) x = cx - gap - w;
  x = clamp(x, 8, Math.max(8, innerWidth - w - 8));
  y = clamp(y, 8, Math.max(8, innerHeight - h - 8));
  menuEl.style.left = x + 'px';
  menuEl.style.top = y + 'px';
}

function menuLength(n) {
  const m = ui.menu;
  if (!m) return;
  if (!setLength(m.line, m.end, n)) buildMenu();
}

menuEl.addEventListener('click', ev => {
  const m = ui.menu;
  if (!m) return;
  const t = ev.target;
  const act = t.closest('[data-act]'), step = t.closest('[data-step]'), sw = t.closest('[data-color]');
  if (act && act.dataset.act === 'close') closeMenu();
  else if (act && act.dataset.act === 'delete') deleteLine(m.line);
  else if (act && act.dataset.act === 'open') openShape(m.dot, m.line);
  else if (act && act.dataset.act === 'mid') addMidpoint(m.line);
  else if (act && act.dataset.act === 'remove') removeDot(m.dot);
  else if (step) {
    const cur = parseInt(menuEl.querySelector('#ctxLen').value, 10) || Math.round(fig.info.get(m.line).len);
    menuLength(cur + +step.dataset.step);
  } else if (sw) setColor(m.line, +sw.dataset.color);
});

menuEl.addEventListener('change', ev => {
  const m = ui.menu;
  if (!m) return;
  if (ev.target.id === 'ctxLetter') renameDot(m.dot, ev.target.value);
  else if (ev.target.id === 'ctxExt') setExt(m.line, ev.target.dataset.side, ev.target.checked);
  else if (ev.target.id === 'ctxLen') menuLength(parseInt(ev.target.value, 10) || 1);
});

menuEl.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.id === 'ctxLen') { ev.preventDefault(); menuLength(parseInt(ev.target.value, 10) || 1); }
});

/* A click anywhere else closes the menu (and only closes it). */
let menuJustClosed = false;
document.addEventListener('pointerdown', ev => {
  if (ui.menu && !menuEl.contains(ev.target)) {
    menuJustClosed = ev.button === 0 && svg.contains(ev.target);
    closeMenu();
  }
  if (ui.bubble && !bubbleEl.contains(ev.target) && !svg.contains(ev.target)) hideBubble();
}, true);

/* ------------------------------------------------------------
   15. The side panel: a guide, or the open pop-up
   Pop-ups open here, beside the canvas, never on top of it.
   ------------------------------------------------------------ */

const TOOL_TITLES = {
  length: 'New line by length',
  connect: 'Connect',
  parallel: 'Parallel line',
  mlen: 'Measure a length',
  mang: 'Measure an angle'
};

function lengthField(hint) {
  return `<div class="field">
      <label class="form-label" for="lenIn">Length</label>
      <div class="stepper">
        <button class="step-btn" type="button" data-step="-1" aria-label="Shorter">−</button>
        <input class="num-input" id="lenIn" type="text" inputmode="numeric" autocomplete="off" aria-describedby="lenHint">
        <button class="step-btn" type="button" data-step="1" aria-label="Longer">+</button>
      </div>
      <p class="field-hint" id="lenHint">${hint}</p>
    </div>`;
}

const colorField = () => `<div class="field"><span class="form-label">Color</span><div id="colorBox"></div></div>`;
const makeActions = label => `<p class="sheet-msg" id="toolMsg" role="status"></p>
  <div class="sheet-actions"><button class="btn btn-ghost" type="button" data-act="cancel">Cancel</button><button class="btn btn-primary" type="button" data-act="create">${label}</button></div>`;
const doneActions = () => `<p class="sheet-msg" id="toolMsg" role="status"></p>
  <div class="sheet-actions"><button class="btn btn-primary" type="button" data-act="cancel">Done</button></div>`;

const TOOL_HTML = {
  length: () => `<p class="sheet-lead">The dotted line shows where the new line will go. Once it's made, you can drag it anywhere.</p>
    ${lengthField('whole units')}${colorField()}${makeActions('Create line')}`,
  connect: () => `<p class="sheet-lead">Click <b>two dots</b> to join them, or <b>a dot and a line</b> to draw a perpendicular from the dot to the line. The hollow dot in the middle of each line is its <b>midpoint</b>: pick it like any other dot.</p>
    <div class="slots" id="slots" aria-live="polite"></div>
    <div class="field"><span class="form-label">Dots</span><div class="opts" id="optDots"></div></div>
    <div class="field"><span class="form-label">Midpoint of</span><div class="opts" id="optMids"></div></div>
    <div class="field"><span class="form-label">Lines</span><div class="opts" id="optLines"></div></div>
    ${colorField()}${makeActions('Create line')}`,
  parallel: () => `<p class="sheet-lead">Click the line to copy on the canvas, or pick it here.</p>
    <div class="field"><span class="form-label">Parallel to</span><div class="opts" id="optLines"></div></div>
    ${lengthField('whole units')}${colorField()}${makeActions('Create line')}`,
  mlen: () => `<p class="sheet-lead">Click a line on the canvas, or pick one here.</p>
    <div class="opts" id="optLines"></div>
    <p class="sheet-note">A measure stays on the canvas until you click it.</p>${doneActions()}`,
  mang: () => `<p class="sheet-lead">Click inside an angle, close to its corner, or pick one here.</p>
    <div class="opt-groups" id="optAngles"></div>
    <p class="sheet-note">A measure stays on the canvas until you click it.</p>${doneActions()}`
};

const GUIDE_HTML = `
  <section class="side-sec" aria-labelledby="gMove">
    <h3 class="side-h" id="gMove">Move and change</h3>
    <ul class="guide">
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg><span><b>Drag the middle</b> of a line to move it</span></li>
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M18.5 2.8v4.4h-4.4"/></svg><span><b>Drag an end</b> to turn the line about its other end</span></li>
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg><span><b>Right-click a line or an end</b> (or press and hold it) for the length, color, letter and <b>midpoint</b></span></li>
      <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg><span><b>Click</b> a line or an end to delete it</span></li>
    </ul>
  </section>
  <section class="side-sec" aria-labelledby="gSnap">
    <h3 class="side-h" id="gSnap">Snaps</h3>
    <ul class="guide">
      <li><span class="g-ico" aria-hidden="true">●</span><span>Ends that touch <b>join</b> into one point, if no length changes</span></li>
      <li><span class="g-ico" aria-hidden="true">⊥</span><span>An end turned onto a line, near a right angle, snaps <b>perpendicular</b></span></li>
      <li><span class="g-ico" aria-hidden="true">∥</span><span>A line turned close to another, nearly parallel, snaps <b>parallel</b></span></li>
    </ul>
  </section>
  <section class="side-sec" aria-labelledby="gMeasures">
    <h3 class="side-h" id="gMeasures">Measures</h3>
    <div id="mList"></div>
  </section>`;

function renderSide() {
  const mode = ui.mode || 'guide';
  sidePanel.classList.toggle('is-tool', !!ui.mode);
  sideClose.hidden = !ui.mode;
  if (sideBody.dataset.mode !== mode) {
    sideBody.dataset.mode = mode;
    sideTitle.textContent = ui.mode ? TOOL_TITLES[mode] : 'Guide';
    sideBody.innerHTML = ui.mode ? TOOL_HTML[mode]() : GUIDE_HTML;
    sideBody.scrollTop = 0;
  }
  if (ui.mode) updateTool(); else updateGuide();
}

/** Rebuild a list of options, keeping keyboard focus on the same option. */
function fillOpts(box, html) {
  if (!box) return;
  const f = box.contains(document.activeElement) ? document.activeElement.dataset.key : null;
  if (box._html === html) return;
  box._html = html;
  box.innerHTML = html;
  if (f) { const again = box.querySelector(`[data-key="${f}"]`); if (again) again.focus({ preventScroll: true }); }
}

function midOpt(L) {
  const key = `mp${L.id}`;
  return `<button type="button" class="opt" data-kind="mp" data-key="${key}" data-id="${L.id}" aria-pressed="${isPicked('mp', L.id)}"${dimmed('mp', L.id) ? ' aria-disabled="true"' : ''}>` +
    `<svg class="opt-mid" style="--c:${colorOf(L.color)}" viewBox="0 0 22 10" aria-hidden="true"><path d="M1 5h20"/><circle cx="11" cy="5" r="3.2"/></svg>` +
    `<span class="sr-only">Midpoint of </span>${segHtml(L)}</button>`;
}

function lineOpt(L, pressed, disabled) {
  return `<button type="button" class="opt" data-kind="l" data-key="l${L.id}" data-id="${L.id}" aria-pressed="${pressed}"${disabled ? ' aria-disabled="true"' : ''}>` +
    `<span class="opt-sw" style="--c:${colorOf(L.color)}" aria-hidden="true"></span>${segHtml(L)}</button>`;
}

const linesSorted = () => model.lines.slice().sort((a, b) => byLetter(lineLetters(a)[0], lineLetters(b)[0]) || lineLetters(a).localeCompare(lineLetters(b)));
const dotsSorted = () => model.dots.slice().sort((a, b) => byLetter(a.letter, b.letter));

function updateGuide() {
  const box = document.getElementById('mList');
  if (!box) return;
  const items = model.measures.map(m => ({ m, mi: measureInfo(m) })).filter(x => x.mi);
  fillOpts(box, items.length
    ? '<ul class="m-list">' + items.map(({ m, mi }) => `<li><button type="button" class="m-item" data-key="m${m.id}" data-mid="${m.id}" aria-label="${esc(mi.label)}. Remove this measure."><span>${esc(mi.text)}</span><span class="m-x" aria-hidden="true">×</span></button></li>`).join('') + '</ul><p class="sheet-note">Click a measure to remove it.</p>'
    : '<p class="side-empty">Use <b>Length</b> or <b>Angle</b> under Measure on the left.</p>');
}

function updateTool() {
  const mode = ui.mode, pv = ui.preview;
  const lenIn = document.getElementById('lenIn');
  if (lenIn && document.activeElement !== lenIn) lenIn.value = ui.len;
  const lenHint = document.getElementById('lenHint');
  if (lenHint) lenHint.textContent = `whole units, 1 to ${maxLen()}`;
  const colorBox = document.getElementById('colorBox');
  if (colorBox) fillOpts(colorBox, swatchesHtml(ui.color));

  let msg = '', isErr = false;
  if (mode === 'connect') {
    const slot = s => {
      if (!s) return '<span class="slot">?</span>';
      if (s.t === 'd') return `<span class="slot is-on">${esc(letterOf(s.id))}</span>`;
      if (s.t === 'mp') return `<span class="slot is-on is-mid"><span class="slot-sub">midpoint of</span>${segHtml(lineById(s.id))}</span>`;
      return `<span class="slot is-on">${segHtml(lineById(s.id))}</span>`;
    };
    document.getElementById('slots').innerHTML = slot(ui.sel[0]) + '<span class="slot-and">and</span>' + slot(ui.sel[1]);
    fillOpts(document.getElementById('optDots'), dotsSorted().map(d =>
      `<button type="button" class="opt is-dot" data-kind="d" data-key="d${d.id}" data-id="${d.id}" aria-pressed="${isPicked('d', d.id)}"${dimmed('d', d.id) ? ' aria-disabled="true"' : ''}>${esc(d.letter)}</button>`).join('') || '<p class="side-empty">No dots yet.</p>');
    const mids = linesSorted().filter(L => !dotAtMid(L));
    fillOpts(document.getElementById('optMids'), mids.map(midOpt).join('') ||
      `<p class="side-empty">${model.lines.length ? 'Every midpoint is already a dot, listed above.' : 'No lines yet.'}</p>`);
    fillOpts(document.getElementById('optLines'), linesSorted().map(L => lineOpt(L, isPicked('l', L.id), dimmed('l', L.id))).join('') || '<p class="side-empty">No lines yet.</p>');
    if (pv && pv.error) { msg = pv.error; isErr = true; }
    else if (pv && pv.kind === 'join') msg = `Makes ${segName(pv.A, pv.B)}, joining ${ptDesc(pv.A)} and ${ptDesc(pv.B)}.`;
    else if (pv && pv.kind === 'perp') {
      const I = fig.info.get(pv.line), past = pv.t < -1e-9 || pv.t > 1 + 1e-9;
      msg = `Makes ${segName(pv.A, { letter: pv.foot })} ⊥ ${segHtml(I.L)}, from ${ptDesc(pv.A)} to ${pv.existing ? '' : 'a new point '}${esc(pv.foot)}` +
        (past ? `, where ${segHtml(I.L)} continues as a dotted line.` : '.');
    } else msg = ui.sel.length ? 'Now pick the second one.' : '';
  } else if (mode === 'parallel') {
    fillOpts(document.getElementById('optLines'), linesSorted().map(L => lineOpt(L, ui.ref === L.id, false)).join('') || '<p class="side-empty">No lines yet.</p>');
    if (ui.ref === null) msg = 'Pick a line to copy.';
    else msg = `The new line is parallel to ${segHtml(lineById(ui.ref))} and ${ui.len} ${ui.len === 1 ? 'unit' : 'units'} long.`;
  } else if (mode === 'length') {
    msg = `A line ${ui.len} ${ui.len === 1 ? 'unit' : 'units'} long.`;
  } else if (mode === 'mlen') {
    fillOpts(document.getElementById('optLines'), linesSorted().map(L => lineOpt(L, isMeasuredLen(L.id), false)).join('') || '<p class="side-empty">No lines yet.</p>');
  } else if (mode === 'mang') {
    fillOpts(document.getElementById('optAngles'), angleOptsHtml());
  }
  const out = document.getElementById('toolMsg');
  if (out && !out.dataset.hold) { out.innerHTML = msg; out.classList.toggle('is-error', isErr); }
  const create = sideBody.querySelector('[data-act="create"]');
  if (create) create.disabled = !pv || !!pv.error;
}

/** A new segment's name from two points (one may not exist yet). */
const segName = (A, B) => `<span class="seg">${esc([A.letter, B.letter].sort(byLetter).join(''))}</span>`;

function angleOptsHtml() {
  const groups = [];
  fig.vertices.forEach(v => {
    const angs = anglesAt(v);
    if (!angs.length) return;
    let head;
    if (v.kind === 'dot') head = `At <b>${esc(v.letter)}</b>`;
    else head = `Where ${segHtml(lineById(v.l1))} crosses ${segHtml(lineById(v.l2))}, at <b>${esc(v.letter)}</b>`;
    groups.push({ v, html: `<div class="opt-group"><p class="opt-head">${head}</p><div class="opts">` +
      angs.sort((a, b) => a.name.localeCompare(b.name)).map(a => `<button type="button" class="opt" data-kind="a" data-key="${esc(a.key)}" aria-pressed="${isMeasuredAng(a)}">${esc(a.name)}</button>`).join('') + '</div></div>' });
  });
  groups.sort((a, b) => (a.v.kind === b.v.kind ? byLetter(a.v.letter, b.v.letter) : a.v.kind === 'dot' ? -1 : 1));
  return groups.map(g => g.html).join('') || '<p class="side-empty">No angles yet. Join two lines at a point, or let one line cross another.</p>';
}

function toolMsg(html, isErr) {
  const out = document.getElementById('toolMsg');
  if (!out) { flash(html); return; }
  out.innerHTML = html;
  out.classList.toggle('is-error', !!isErr);
  out.dataset.hold = '1';
  clearTimeout(out._t);
  out._t = setTimeout(() => { delete out.dataset.hold; updateTool(); }, 3200);
}

function openTool(mode) {
  if (ui.mode === mode) { closeTool(); return; }
  hideBubble();
  closeMenu();
  ui.mode = mode;
  ui.sel = [];
  ui.hover = null;
  ui.hoverOpt = null;
  if (mode === 'length' || mode === 'connect' || mode === 'parallel') ui.color = leastUsedColor();
  if (mode === 'length') ui.len = clamp(ui.len, 1, maxLen());
  if (mode === 'parallel') {
    const last = model.lines.reduce((a, b) => (!a || b.id > a.id ? b : a), null);
    ui.ref = last ? last.id : null;
    ui.len = last ? clamp(Math.round(fig.info.get(last.id).len) || 1, 1, maxLen()) : 5;
  }
  sideBody.dataset.mode = '';
  renderAll();
  // Keyboard users land in the pop-up (on a button, so no on-screen keyboard pops up on a tablet).
  const first = sideBody.querySelector('.opt:not([aria-disabled="true"]), .step-btn, .btn-primary');
  if (first && document.activeElement && document.activeElement.closest('[data-tool]')) first.focus({ preventScroll: true });
}

function closeTool() {
  if (!ui.mode) return;
  const was = ui.mode;
  ui.mode = null;
  ui.sel = [];
  ui.hoverOpt = null;
  ui.preview = null;
  renderAll();
  const btn = document.querySelector(`[data-tool="${was}"]`);
  if (btn && sidePanel.contains(document.activeElement)) btn.focus({ preventScroll: true });
}

function createLine() {
  const pv = ui.preview;
  if (!pv || pv.error) return;
  pushHistory();
  let L;
  if (pv.kind === 'new') {
    const [la, lb] = freeLetters(2);
    const A = newDot(pv.A.x, pv.A.y, la), B = newDot(pv.B.x, pv.B.y, lb);
    L = newLine(A.id, B.id, ui.color);
    if (ui.mode === 'parallel' && ui.ref !== null) addParallel(ui.ref, L.id);
  } else {
    // A picked midpoint becomes a point now, held at the middle of its line.
    const realize = P => {
      if (P.id) return P.id;
      const M = newDot(P.x, P.y, P.letter);
      M.on = P.mid;
      M.mid = true;
      return M.id;
    };
    if (pv.kind === 'join') L = newLine(realize(pv.A), realize(pv.B), ui.color);
    else {
      const from = realize(pv.A);
      let end = pv.existing;
      if (!end) { const F = newDot(pv.B.x, pv.B.y, pv.foot); F.on = pv.line; end = F.id; }
      L = newLine(from, end, ui.color);
    }
  }
  fresh.set(L.id, Date.now());
  setTimeout(() => { fresh.delete(L.id); }, 900);
  cleanup();
  ui.mode = null;
  ui.sel = [];
  ui.preview = null;
  renderAll();
  flash(`Made ${segHtml(L)}.`, false);
}

sideClose.addEventListener('click', closeTool);

sideBody.addEventListener('click', ev => {
  const t = ev.target;
  const act = t.closest('[data-act]'), step = t.closest('[data-step]'), sw = t.closest('[data-color]');
  const opt = t.closest('.opt'), mItem = t.closest('.m-item');
  if (act) { if (act.dataset.act === 'create') createLine(); else closeTool(); return; }
  if (step) { setLen(ui.len + +step.dataset.step); return; }
  if (sw) { ui.color = +sw.dataset.color; renderCanvas(); updateTool(); return; }
  if (mItem) { removeMeasure(+mItem.dataset.mid); return; }
  if (!opt) return;
  const id = +opt.dataset.id;
  if (opt.dataset.kind === 'a') {
    const a = allAngles().find(x => x.key === opt.dataset.key);
    if (a) toggleAng(a);
  } else if (ui.mode === 'connect') connectPick({ t: opt.dataset.kind, id });
  else if (ui.mode === 'parallel') { ui.ref = id; ui.len = clamp(Math.round(fig.info.get(id).len) || 1, 1, maxLen()); renderAll(); }
  else if (ui.mode === 'mlen') toggleLen(id);
});

function setLen(n) {
  ui.len = clamp(Math.round(n) || 1, 1, maxLen());
  renderCanvas();
  updateTool();
}

sideBody.addEventListener('change', ev => { if (ev.target.id === 'lenIn') setLen(parseInt(ev.target.value, 10)); });
sideBody.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.id === 'lenIn') { ev.preventDefault(); setLen(parseInt(ev.target.value, 10)); }
});
sideBody.addEventListener('mouseover', ev => {
  const o = ev.target.closest('.opt, .m-item');
  if (!o) { setHoverOpt(null); return; }
  if (o.classList.contains('m-item')) setHoverOpt({ t: 'm', id: +o.dataset.mid });
  else if (o.dataset.kind === 'a') setHoverOpt({ t: 'a', id: o.dataset.key });
  else setHoverOpt({ t: o.dataset.kind, id: +o.dataset.id });
});
sideBody.addEventListener('mouseleave', () => setHoverOpt(null));

toolBtns.forEach(b => b.addEventListener('click', () => openTool(b.dataset.tool)));

/* ------------------------------------------------------------
   16. Controls, the status line, undo, grid, clear, help
   ------------------------------------------------------------ */

function statusText() {
  if (statusFlash) return statusFlash;
  switch (ui.mode) {
    case 'length': return 'Set the <b>length</b> and <b>color</b>, then press <b>Create line</b>.';
    case 'connect': return ui.sel.length < 2 ? 'Click <b>two dots</b> (a hollow <b>midpoint</b> counts), or <b>a dot and a line</b>.' : 'Press <b>Create line</b>, or click a picked one to unpick it.';
    case 'parallel': return 'Click the <b>line to copy</b>, set the <b>length</b>, then press <b>Create line</b>.';
    case 'mlen': return 'Click a <b>line</b> to measure it. Click a measure to remove it.';
    case 'mang': return 'Click <b>inside an angle</b>, near its corner, to measure it.';
  }
  if (!model.lines.length) return 'Start with <b>By length</b> on the left.';
  return '<b>Drag the middle</b> to move · <b>drag an end</b> to turn · <b>right-click</b> for more · <b>click</b> to delete';
}

function renderControls() {
  const nLines = model.lines.length, nAngles = fig ? allAngles().length : 0;
  const need = {
    connect: nLines >= 2 ? '' : 'Make at least two lines first',
    parallel: nLines ? '' : 'Make a line first',
    mlen: nLines ? '' : 'Make a line first',
    mang: nAngles ? '' : 'Join two lines at a point, or cross one line over another, to make an angle'
  };
  toolBtns.forEach(b => {
    const t = b.dataset.tool, why = need[t] || '';
    b.setAttribute('aria-pressed', String(ui.mode === t));
    b.disabled = !!why && ui.mode !== t;
    b.title = why;
  });
  undoBtn.disabled = !history.length;
  gridBtn.setAttribute('aria-pressed', String(ui.grid));
  statusEl.innerHTML = statusText();
  statusEl.classList.toggle('is-warn', !!statusFlash && flashWarn);
}

let flashWarn = true;
function flash(msg, warn = true) {
  statusFlash = msg;
  flashWarn = warn;
  renderControls();
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { statusFlash = ''; renderControls(); }, 3400);
}

/** Drop picks and selections that point at things that are gone. */
function validateUi() {
  // A picked midpoint goes when its line does, or when a point now sits at the middle.
  ui.sel = ui.sel.filter(s => (s.t === 'd' ? dotById(s.id) : s.t === 'mp' ? lineById(s.id) && !dotAtMid(lineById(s.id)) : lineById(s.id)));
  if (ui.ref !== null && !lineById(ui.ref)) ui.ref = null;
  if (ui.bubble && (!lineById(ui.bubble.line) || (ui.bubble.dot !== null && !dotById(ui.bubble.dot)))) { ui.bubble = null; bubbleEl.hidden = true; }
  if (ui.hover && ((ui.hover.kind === 'dot' && !dotById(ui.hover.id)) || (ui.hover.kind !== 'dot' && ui.hover.kind !== 'ang' && !lineById(ui.hover.id)))) ui.hover = null;
}

function renderAll() {
  validateUi();
  if (!drag) showTip(null);    // a hover tip from before the change may no longer be true
  renderCanvas();
  renderSide();
  renderControls();
  if (ui.menu) buildMenu();
}

function undo() {
  if (!history.length) return;
  model = JSON.parse(history.pop());
  hideBubble();
  closeMenu();
  fig = derive();
  renderAll();
}

undoBtn.addEventListener('click', undo);

gridBtn.addEventListener('click', () => {
  ui.grid = !ui.grid;
  drawGrid();
  renderControls();
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (!model.lines.length) return;
  const n = model.lines.length;
  openModal({
    title: 'Clear the canvas?',
    html: `<p>This removes ${n === 1 ? 'the line' : `all ${n} lines`}${model.measures.length ? ' and every measure' : ''}. You can still press Undo afterwards.</p>`,
    actions: [
      { label: 'Cancel', cls: 'btn-ghost' },
      { label: 'Clear all', cls: 'btn-solid-danger', onClick: () => { pushHistory(); model = emptyModel(); closeTool(); hideBubble(); closeMenu(); renderAll(); } }
    ]
  });
});

document.getElementById('helpBtn').addEventListener('click', () => {
  openModal({
    title: 'How it works',
    html: `<ol class="help-list">
      <li><strong>Make a line</strong> with the buttons on the left: <strong>By length</strong> (a whole number of units), <strong>Connect</strong> (two dots, or a dot and a line for a perpendicular; a line's midpoint counts as a dot) or <strong>Parallel</strong>. A dotted line shows where it will go. Press <strong>Create line</strong> to make it solid.</li>
      <li><strong>Drag the middle</strong> of a line to move it. <strong>Drag an end</strong> to turn it about its other end. Joined lines move together, like one shape.</li>
      <li><strong>Snaps:</strong> an end that touches another point joins it, as long as no length changes. An end turned onto a line near a right angle snaps perpendicular (that line's length can change). A line turned close to a nearly parallel line snaps parallel. A message shows while you hold it there.</li>
      <li><strong>Right-click a line or an end</strong>, or press and hold it, to change the line's length or color or the point's letter, to <strong>add the line's midpoint</strong>, to continue the line as a dotted line, or to open a shape at that point. A midpoint stays at the middle, with tick marks showing the two equal halves.</li>
      <li><strong>Click a line</strong> or an end, without dragging, to delete it.</li>
      <li><strong>Grid:</strong> the grid starts hidden. Press <strong>Grid</strong> at the top to show it.</li>
      <li><strong>Measure</strong> a length or an angle: click it on the canvas or pick it from the list. A measure stays until you click it.</li>
    </ol>`,
    actions: [{ label: 'Got it', cls: 'btn-primary' }]
  });
});

function isTyping() {
  const a = document.activeElement;
  return a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable);
}

document.addEventListener('keydown', ev => {
  if (isModalOpen()) return;
  if (ev.key === 'Escape') {
    if (ui.menu) closeMenu();
    else if (ui.bubble) hideBubble();
    else if (ui.mode) closeTool();
    return;
  }
  if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === 'z' && !isTyping()) {
    ev.preventDefault();
    undo();
    return;
  }
  if (ui.bubble && !isTyping()) {
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      ev.preventDefault();
      if (ui.bubble.lone) removeDot(ui.bubble.dot); else deleteLine(ui.bubble.line);
      return;
    }
    // Arrow keys slide the selected line (and its shape) one unit.
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[ev.key];
    if (step) {
      ev.preventDefault();
      const L = lineById(ui.bubble.line), k = ev.shiftKey ? 0.25 : 1;
      pushHistory();
      reach(L.a, null, adjacency()).forEach(id => { const d = dotById(id); d.x += step[0] * k; d.y += step[1] * k; });
      const b = ui.bubble;
      b.p = { x: b.p.x + step[0] * k * geo.unit, y: b.p.y - step[1] * k * geo.unit };
      cleanup();
      renderAll();
      showBubble(L, b.dot, b.p);
    }
  }
});

/* ------------------------------------------------------------
   17. Pop-ups for help and clearing (the only ones that block)
   ------------------------------------------------------------ */

let modalOpener = null;
const isModalOpen = () => modalRoot.classList.contains('open');

function closeModal() {
  if (!isModalOpen()) return;
  modalRoot.classList.remove('open');
  modalRoot.setAttribute('aria-hidden', 'true');
  modalRoot.innerHTML = '';
  if (modalOpener && document.contains(modalOpener)) modalOpener.focus();
  modalOpener = null;
}

function openModal(cfg) {
  closeModal();
  modalOpener = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const box = document.createElement('div');
  box.className = 'modal';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'modalTitle');
  box.innerHTML = `<h2 class="modal-title" id="modalTitle">${esc(cfg.title)}</h2><div class="modal-body">${cfg.html || ''}</div>`;
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  (cfg.actions || []).forEach(a => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + (a.cls || 'btn-ghost');
    b.textContent = a.label;
    b.addEventListener('click', () => { closeModal(); if (a.onClick) a.onClick(); });
    actions.appendChild(b);
  });
  box.appendChild(actions);
  backdrop.appendChild(box);
  backdrop.addEventListener('mousedown', ev => { if (ev.target === backdrop) closeModal(); });
  modalRoot.appendChild(backdrop);
  modalRoot.classList.add('open');
  modalRoot.setAttribute('aria-hidden', 'false');
  const last = actions.querySelector('.btn:last-child');
  if (last) last.focus();
}

document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && isModalOpen()) closeModal(); });

/* ------------------------------------------------------------
   18. Start
   ------------------------------------------------------------ */

function refresh() {
  measure();
  drawGrid();
  hideBubble();
  if (ui.menu) closeMenu();
  renderAll();
}

initSvg();
refresh();
new ResizeObserver(() => {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (geo && Math.abs(w - geo.W) < 1 && Math.abs(h - geo.H) < 1) return;
  refresh();
}).observe(stage);
