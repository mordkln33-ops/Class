'use strict';

// Exact fractions keep equations and tables accurate, even for slopes such as 1/3.
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; }
function rational(n, d = 1) {
  if (!d) throw new Error('A fraction cannot have a zero denominator.');
  if (d < 0) { n = -n; d = -d; }
  const factor = gcd(n, d); return { n: n / factor || 0, d: d / factor };
}
function fractionText(f) { return `${f.n < 0 ? '−' : ''}${Math.abs(f.n)}${f.d === 1 ? '' : '/' + f.d}`; }
function fractionHTML(f) { return f.d === 1 ? String(Math.abs(f.n)) : `<span class="fraction"><span>${Math.abs(f.n)}</span><span>${f.d}</span></span>`; }
function lineMath(a, b) {
  if (a.x === b.x && a.y === b.y) throw new Error('A line needs two different points.');
  if (a.x === b.x) return { vertical: true, x: a.x };
  const slope = rational(b.y - a.y, b.x - a.x);
  return { vertical: false, slope, intercept: rational(a.y * slope.d - slope.n * a.x, slope.d) };
}
function equationText(m) {
  if (m.vertical) return `x = ${m.x < 0 ? '−' : ''}${Math.abs(m.x)}`;
  const s = m.slope, b = m.intercept;
  if (!s.n) return `y = ${fractionText(b)}`;
  return `y = ${s.n < 0 ? '−' : ''}${Math.abs(s.n) === s.d ? '' : fractionText(rational(Math.abs(s.n), s.d))}x${b.n ? ` ${b.n < 0 ? '−' : '+'} ${fractionText(rational(Math.abs(b.n), b.d))}` : ''}`;
}
function equationHTML(m) {
  if (m.vertical || !m.slope.n) return equationText(m);
  const s = m.slope, b = m.intercept;
  return `y = ${s.n < 0 ? '−' : ''}${Math.abs(s.n) === s.d ? '' : fractionHTML(s)}x${b.n ? ` ${b.n < 0 ? '−' : '+'} ${fractionHTML(b)}` : ''}`;
}
function tablePairs(m) {
  return Array.from({ length: 21 }, (_, i) => {
    const key = i - 10;
    return m.vertical ? { key, x: rational(m.x), y: rational(key) } : { key, x: rational(key), y: rational(m.slope.n * key * m.intercept.d + m.intercept.n * m.slope.d, m.slope.d * m.intercept.d) };
  });
}
// Intersect the infinite line with all four edges of the visible coordinate plane.
function clipLine(m) {
  if (m.vertical) return [{ x: m.x, y: -10 }, { x: m.x, y: 10 }];
  const slope = m.slope.n / m.slope.d, b = m.intercept.n / m.intercept.d;
  const candidates = [{ x: -10, y: -10 * slope + b }, { x: 10, y: 10 * slope + b }];
  if (slope) candidates.push({ x: (-10 - b) / slope, y: -10 }, { x: (10 - b) / slope, y: 10 });
  const result = [];
  for (const p of candidates) if (p.x >= -10 - 1e-8 && p.x <= 10 + 1e-8 && p.y >= -10 - 1e-8 && p.y <= 10 + 1e-8 && !result.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 1e-8)) result.push(p);
  return result.slice(0, 2);
}

// This small export is only for local math checks; the page requires no modules or server.
if (typeof module !== 'undefined' && module.exports) module.exports = { rational, fractionText, lineMath, equationText, tablePairs, clipLine };

if (typeof document !== 'undefined') (() => {
  const $ = id => document.getElementById(id);
  const svg = $('graph');
  const NS = 'http://www.w3.org/2000/svg';
  const colors = ['#007fa7', '#9b4699', '#bc5a12', '#217e54', '#5355b1', '#ad3656'];
  const state = { points: [], lines: [], nextPoint: 1, nextLine: 1, page: 0, selected: null, latest: null, lastPrompt: '', drag: null, hover: null, cursor: null };
  let geometry = null;
  function element(tag, attrs = {}, text) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  const pointById = id => state.points.find(p => p.id === Number(id));
  const freePoints = () => state.points.filter(p => p.lineId === null);
  const mathFor = line => lineMath(pointById(line.a), pointById(line.b));
  const coord = p => `(${p.x < 0 ? '−' : ''}${Math.abs(p.x)}, ${p.y < 0 ? '−' : ''}${Math.abs(p.y)})`;
  const pointColor = p => state.lines.find(l => l.id === p.lineId)?.color || '#153c50';
  const say = message => { $('status').textContent = message; };
  const clamp = v => Math.max(-10, Math.min(10, Math.round(v))) || 0;
  const screen = p => ({ x: geometry.left + (p.x + 10) * geometry.step, y: geometry.top + (10 - p.y) * geometry.step });
  function localPosition(event) { const r = svg.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; }
  function graphPosition(pos) { return { x: clamp((pos.x - geometry.left) / geometry.step - 10), y: clamp(10 - (pos.y - geometry.top) / geometry.step) }; }
  function inside(pos) { return pos.x >= geometry.left - 5 && pos.x <= geometry.left + geometry.size + 5 && pos.y >= geometry.top - 5 && pos.y <= geometry.top + geometry.size + 5; }

  function drawGrid() {
    const box = svg.getBoundingClientRect();
    const width = box.width, height = box.height;
    const size = Math.max(40, Math.min(width - 80, height - 64));
    geometry = { width, height, size, step: size / 20, left: (width - size) / 2, top: (height - size) / 2 };
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const clip = $('clip-rect');
    for (const [k, v] of Object.entries({ x: geometry.left, y: geometry.top, width: size, height: size })) clip.setAttribute(k, v);
    const grid = $('grid-layer'); grid.replaceChildren();
    const zero = screen({ x: 0, y: 0 });
    for (let n = -10; n <= 10; n++) {
      const p = screen({ x: n, y: n });
      grid.append(element('line', { x1: p.x, x2: p.x, y1: geometry.top, y2: geometry.top + size, class: n === 0 ? 'axis' : `grid-line${n % 5 === 0 ? ' major' : ''}` }));
      grid.append(element('line', { x1: geometry.left, x2: geometry.left + size, y1: p.y, y2: p.y, class: n === 0 ? 'axis' : `grid-line${n % 5 === 0 ? ' major' : ''}` }));
      if (n !== 0) {
        const labelOffset = geometry.step < 19 && Math.abs(n) % 2 === 0 ? 30 : 17;
        grid.append(element('text', { x: p.x, y: zero.y + labelOffset, 'text-anchor': 'middle', class: 'tick-label' }, String(n).replace('-', '−')));
        grid.append(element('text', { x: zero.x - 10, y: p.y + 4, 'text-anchor': 'end', class: 'tick-label' }, String(n).replace('-', '−')));
      }
    }
    grid.append(element('text', { x: zero.x - 9, y: zero.y + 17, 'text-anchor': 'end', class: 'tick-label' }, '0'));
    grid.append(element('text', { x: geometry.left + size + 20, y: zero.y + 5, class: 'axis-label' }, 'x'));
    grid.append(element('text', { x: zero.x - 4, y: geometry.top - 15, class: 'axis-label' }, 'y'));
    drawGraph();
  }
  function drawLines() {
    const layer = $('line-layer'); layer.replaceChildren();
    for (const line of state.lines) {
      const ends = clipLine(mathFor(line)); if (ends.length !== 2) continue;
      const a = screen(ends[0]), b = screen(ends[1]);
      const group = element('g', { 'data-line': line.id });
      group.append(element('title', {}, `Line ${line.id}: ${equationText(mathFor(line))}`));
      group.append(element('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: line.color, 'stroke-width': 2.6, 'stroke-linecap': 'round' }));
      // Arrow tips at the graph boundary show continuation in both directions.
      for (const [tip, other] of [[a, b], [b, a]]) {
        const angle = Math.atan2(other.y - tip.y, other.x - tip.x), length = 9, wing = 4;
        const bx = tip.x + Math.cos(angle) * length, by = tip.y + Math.sin(angle) * length;
        group.append(element('path', { d: `M ${bx - Math.sin(angle) * wing} ${by + Math.cos(angle) * wing} L ${tip.x} ${tip.y} L ${bx + Math.sin(angle) * wing} ${by - Math.cos(angle) * wing}`, stroke: line.color, 'stroke-width': 2.4, fill: 'none', 'stroke-linejoin': 'round' }));
      }
      layer.append(group);
    }
  }
  function shownPoint(p) { return state.drag?.id === p.id && state.drag.preview ? { ...p, ...state.drag.preview } : p; }
  function overlap(a, b) { return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); }
  function drawPoints() {
    const layer = $('point-layer'), labels = $('label-layer'); layer.replaceChildren(); labels.replaceChildren();
    const used = [];
    const allPoints = state.points.map(p => ({ point: shownPoint(p), pixel: screen(shownPoint(p)) }));
    // Reserve axis labels, point centers, and previous labels before placing each pill.
    const origin = screen({ x: 0, y: 0 });
    const obstacles = [{ x: geometry.left - 13, y: origin.y + 4, w: geometry.size + 26, h: geometry.step < 19 ? 32 : 18 }, { x: origin.x - 31, y: geometry.top - 7, w: 25, h: geometry.size + 17 }];
    for (const { point: p, pixel: s } of allPoints) {
      if (p.id === state.selected) layer.append(element('circle', { cx: s.x, cy: s.y, r: 11, fill: 'none', stroke: pointColor(p), 'stroke-width': 2, opacity: .5 }));
      const dot = element('circle', { cx: s.x, cy: s.y, r: 7, fill: pointColor(p), class: 'point-dot', 'data-point': p.id, tabindex: 0, role: 'button', 'aria-label': `Point ${coord(p)}. Arrow keys move; Enter shows options; Delete removes.` });
      layer.append(dot);
      const text = coord(p), w = Math.max(53, text.length * 7.5 + 14), h = 23;
      let chosen = null, best = Infinity;
      for (const distance of [14, 34, 56, 82, 112]) {
        for (const [dx, dy] of [[distance, -h - 7], [-w - distance, -h - 7], [distance, 9], [-w - distance, 9], [-w / 2, -h - distance], [-w / 2, distance]]) {
          const rect = { x: Math.max(3, Math.min(geometry.width - w - 3, s.x + dx)), y: Math.max(3, Math.min(geometry.height - h - 3, s.y + dy)), w, h };
          let score = Math.hypot(rect.x + w / 2 - s.x, rect.y + h / 2 - s.y) * .1;
          for (const other of used) score += overlap(rect, other) * 50;
          for (const other of obstacles) score += overlap(rect, other) * 3;
          for (const other of allPoints) score += overlap(rect, { x: other.pixel.x - 9, y: other.pixel.y - 9, w: 18, h: 18 }) * 50;
          for (const line of state.lines) {
            const m = mathFor(line);
            // Avoid placing labels on top of the plotted line when space permits.
            for (const sampleX of [rect.x, rect.x + w / 2, rect.x + w]) {
              if (m.vertical) { const lx = screen({ x: m.x, y: 0 }).x; if (lx >= rect.x && lx <= rect.x + w) score += 160; break; }
              const gx = (sampleX - geometry.left) / geometry.step - 10;
              const ly = screen({ x: gx, y: gx * m.slope.n / m.slope.d + m.intercept.n / m.intercept.d }).y;
              if (ly > rect.y && ly < rect.y + h) score += 100;
            }
          }
          if (score < best) { best = score; chosen = rect; }
        }
      }
      used.push(chosen);
      const ex = Math.max(chosen.x, Math.min(chosen.x + w, s.x)), ey = Math.max(chosen.y, Math.min(chosen.y + h, s.y));
      labels.append(element('path', { d: `M ${s.x} ${s.y} L ${ex} ${ey}`, class: 'point-leader' }));
      labels.append(element('rect', { x: chosen.x, y: chosen.y, width: w, height: h, rx: 6, class: 'point-label-bg' }));
      labels.append(element('text', { x: chosen.x + w / 2, y: chosen.y + 16, 'text-anchor': 'middle', class: 'point-label', fill: pointColor(p) }, text));
    }
  }
  function drawCursor() {
    const layer = $('cursor-layer'); layer.replaceChildren();
    if (!state.cursor) return;
    const s = screen(state.cursor);
    layer.append(element('circle', { cx: s.x, cy: s.y, r: 10, fill: 'none', stroke: '#bd7912', 'stroke-width': 2, 'stroke-dasharray': '3 2' }));
  }
  function drawGraph() { if (!geometry) return; drawLines(); drawPoints(); drawCursor(); }

  function renderCards() {
    const cards = $('cards'); cards.replaceChildren();
    $('empty-state').hidden = state.lines.length > 0;
    $('line-count').textContent = `${state.lines.length} line${state.lines.length === 1 ? '' : 's'}`;
    cards.classList.toggle('single', state.lines.length === 1);
    const pages = Math.max(1, Math.ceil(state.lines.length / 2));
    state.page = Math.max(0, Math.min(pages - 1, state.page));
    for (const line of state.lines.slice(state.page * 2, state.page * 2 + 2)) {
      const m = mathFor(line), card = document.createElement('article');
      card.className = 'line-card'; card.dataset.line = line.id; card.style.setProperty('--line-color', line.color);
      const detail = m.vertical ? 'Vertical line · slope is undefined' : `Slope m = ${fractionText(m.slope)}<br>y-intercept b = ${fractionText(m.intercept)}`;
      card.innerHTML = `<div class="card-header"><p class="line-name">Line ${line.id}</p><p class="equation" aria-label="${equationText(m)}">${equationHTML(m)}</p><p class="line-details">${detail}</p></div><p class="table-caption">${m.vertical ? 'x stays fixed; y increases by 1.' : 'x increases by 1. Some y values may be outside the graph.'}</p><div class="table-scroll" tabindex="0" aria-label="Value table for line ${line.id}"><table aria-label="${equationText(m)} value table"><thead><tr><th scope="col">x</th><th scope="col">y</th></tr></thead><tbody>${tablePairs(m).map(row => `<tr data-key="${row.key}"><td>${fractionText(row.x)}</td><td>${fractionText(row.y)}</td></tr>`).join('')}</tbody></table></div>`;
      cards.append(card);
    }
    $('carousel').hidden = pages < 2;
    $('page-indicator').textContent = `Page ${state.page + 1} of ${pages}`;
    $('previous-page').disabled = state.page === 0;
    $('next-page').disabled = state.page >= pages - 1;
  }
  function updateLatest() {
    const p = pointById(state.latest);
    if (!p) { $('latest-point').textContent = '( —, — )'; $('latest-description').textContent = 'Click a grid intersection to begin.'; return; }
    $('latest-point').innerHTML = `(<span class="x-value">${String(p.x).replace('-', '−')}</span>, <span class="y-value">${String(p.y).replace('-', '−')}</span>)`;
    const horizontal = p.x === 0 ? 'No horizontal movement' : `${Math.abs(p.x)} ${p.x < 0 ? 'left' : 'right'}`;
    const vertical = p.y === 0 ? 'no vertical movement' : `${Math.abs(p.y)} ${p.y < 0 ? 'down' : 'up'}`;
    $('latest-description').textContent = `${horizontal}, ${vertical} from the origin (0, 0).`;
  }
  function refresh() {
    clearHover(); renderCards(); drawGraph(); updateLatest();
    const availableCount = freePoints().length;
    $('connect-points').disabled = availableCount < 2;
    // A declined pair is offered again if availability later returns to two.
    if (availableCount !== 2) state.lastPrompt = '';
  }
  function hideActions() { state.selected = null; $('point-actions').hidden = true; }
  function showActions(id) {
    clearHover(); state.selected = id; drawPoints();
    const p = pointById(id), box = svg.getBoundingClientRect(), pos = screen(p), actions = $('point-actions');
    $('selected-point').textContent = `Point ${coord(p)}`;
    $('delete-note').textContent = p.lineId === null ? 'Remove this point from the graph.' : `Deleting this point also removes Line ${p.lineId}. Its other point stays.`;
    actions.hidden = false;
    actions.style.left = `${Math.max(8, Math.min(window.innerWidth - 233, box.left + pos.x + 16))}px`;
    actions.style.top = `${Math.max(8, Math.min(window.innerHeight - actions.offsetHeight - 8, box.top + pos.y + 16))}px`;
  }
  function maybePrompt() {
    const available = freePoints(), signature = available.map(p => p.id).join(',');
    if (available.length === 2 && signature !== state.lastPrompt && !$('line-dialog').open) { state.lastPrompt = signature; openLineDialog(); }
  }
  function addPoint(p) {
    const existing = state.points.find(q => q.x === p.x && q.y === p.y);
    if (existing) { say('There is already a point at that intersection.'); showActions(existing.id); return; }
    hideActions(); const point = { ...p, id: state.nextPoint++, lineId: null }; state.points.push(point); state.latest = point.id;
    refresh(); say(`Point ${coord(point)} added. ${freePoints().length} point(s) available for a line.`); maybePrompt();
  }
  function deletePoint(id) {
    const p = pointById(id); if (!p) return;
    if (p.lineId !== null) { state.lines = state.lines.filter(l => l.id !== p.lineId); state.points.forEach(q => { if (q.lineId === p.lineId && q.id !== p.id) q.lineId = null; }); }
    state.points = state.points.filter(q => q.id !== id);
    if (state.latest === id) state.latest = state.points.at(-1)?.id ?? null;
    hideActions(); refresh(); say(`Point ${coord(p)} deleted.`); maybePrompt();
  }
  function movePoint(id, position) {
    const p = pointById(id); if (!p) return;
    if (state.points.some(q => q.id !== id && q.x === position.x && q.y === position.y)) { say('That intersection is occupied. The point stayed in its previous position.'); refresh(); return; }
    p.x = position.x; p.y = position.y;
    refresh(); say(`Point moved to ${coord(p)}.${p.lineId !== null ? ` Line ${p.lineId} and its table updated.` : ''}`);
  }
  function openLineDialog() {
    const available = freePoints(); if (available.length < 2) return;
    hideActions(); clearHover(); drawPoints();
    for (const id of ['first-point', 'second-point']) { const select = $(id); select.replaceChildren(); for (const p of available) { const option = document.createElement('option'); option.value = p.id; option.textContent = coord(p); select.append(option); } }
    $('first-point').value = available[available.length - 2].id;
    $('second-point').value = available[available.length - 1].id;
    $('dialog-error').textContent = ''; updatePairPreview(); $('line-dialog').showModal();
  }
  function updatePairPreview() {
    const a = pointById($('first-point').value), b = pointById($('second-point').value);
    $('pair-preview').textContent = a && b ? `${coord(a)} and ${coord(b)}` : '';
  }
  $('line-form').addEventListener('submit', event => {
    if (event.submitter?.value !== 'create') { say('Points kept. Use “Connect points” whenever you are ready.'); return; }
    event.preventDefault();
    const a = pointById($('first-point').value), b = pointById($('second-point').value);
    if (!a || !b || a.id === b.id) { $('dialog-error').textContent = 'Choose two different points.'; return; }
    if (a.lineId !== null || b.lineId !== null) { $('dialog-error').textContent = 'Choose two points that are not already in a line.'; return; }
    const id = state.nextLine++, line = { id, a: a.id, b: b.id, color: colors[(id - 1) % colors.length] };
    a.lineId = id; b.lineId = id; state.lines.push(line); state.page = Math.floor((state.lines.length - 1) / 2);
    $('line-dialog').close(); refresh(); say(`Line ${id} created: ${equationText(mathFor(line))}. Add two more points for another line.`);
    maybePrompt();
  });
  $('first-point').addEventListener('change', updatePairPreview); $('second-point').addEventListener('change', updatePairPreview);
  $('connect-points').addEventListener('click', openLineDialog);
  $('delete-point').addEventListener('click', () => deletePoint(state.selected));
  $('close-actions').addEventListener('click', () => { hideActions(); drawPoints(); svg.focus({ preventScroll: true }); });
  $('previous-page').addEventListener('click', () => { state.page--; clearHover(); renderCards(); });
  $('next-page').addEventListener('click', () => { state.page++; clearHover(); renderCards(); });

  function clearHover() {
    state.hover = null; $('hover-tooltip').hidden = true; $('hover-layer').replaceChildren();
    document.querySelectorAll('tr.highlight').forEach(row => row.classList.remove('highlight'));
  }
  function hoverAt(event) {
    if (state.selected !== null || $('line-dialog').open || !geometry) return;
    const pos = localPosition(event); if (!inside(pos)) { clearHover(); return; }
    let nearest = null, distance = 11;
    for (const line of state.lines) {
      const m = mathFor(line), ends = clipLine(m); if (ends.length !== 2) continue;
      const a = screen(ends[0]), b = screen(ends[1]), vx = b.x - a.x, vy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((pos.x - a.x) * vx + (pos.y - a.y) * vy) / (vx * vx + vy * vy)));
      const d = Math.hypot(pos.x - a.x - t * vx, pos.y - a.y - t * vy);
      if (d < distance) { distance = d; nearest = { line, m }; }
    }
    if (!nearest) { clearHover(); return; }
    const { line, m } = nearest, snapped = graphPosition(pos);
    const key = m.vertical ? snapped.y : snapped.x, pair = tablePairs(m)[key + 10];
    const point = { x: pair.x.n / pair.x.d, y: pair.y.n / pair.y.d };
    if (point.y < -10 - 1e-8 || point.y > 10 + 1e-8) { clearHover(); return; }
    const hoverKey = `${line.id}:${key}`;
    if (state.hover !== hoverKey) {
      clearHover();
      const targetPage = Math.floor(state.lines.indexOf(line) / 2);
      if (state.page !== targetPage) { state.page = targetPage; renderCards(); }
      const row = document.querySelector(`.line-card[data-line="${line.id}"] tr[data-key="${key}"]`);
      if (row) { row.classList.add('highlight'); const scroller = row.closest('.table-scroll'), y = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop; if (y < scroller.scrollTop + 34 || y + row.offsetHeight > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = y - scroller.clientHeight / 2 + row.offsetHeight / 2; }
      const s = screen(point);
      $('hover-layer').append(element('circle', { cx: s.x, cy: s.y, r: 5, fill: '#fff', stroke: line.color, 'stroke-width': 3 }));
      state.hover = hoverKey;
    }
    const tooltip = $('hover-tooltip'); tooltip.textContent = `Line ${line.id} · (${fractionText(pair.x)}, ${fractionText(pair.y)})`; tooltip.hidden = false;
    tooltip.style.left = `${Math.max(8, Math.min(window.innerWidth - tooltip.offsetWidth - 8, event.clientX + 17))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(window.innerHeight - tooltip.offsetHeight - 8, event.clientY + 18))}px`;
  }
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0 || state.drag) return;
    const dot = event.target.closest('[data-point]');
    const id = dot ? Number(dot.dataset.point) : null;
    const pos = localPosition(event); if (id === null && !inside(pos)) { hideActions(); drawPoints(); return; }
    clearHover(); state.cursor = null; hideActions();
    state.drag = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, preview: null };
    svg.setPointerCapture(event.pointerId); drawPoints(); drawCursor(); event.preventDefault();
  });
  svg.addEventListener('pointermove', event => {
    const drag = state.drag;
    if (!drag) { hoverAt(event); return; }
    if (event.pointerId !== drag.pointerId) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) drag.moved = true;
    if (drag.moved && drag.id !== null) { const p = graphPosition(localPosition(event)); if (!drag.preview || drag.preview.x !== p.x || drag.preview.y !== p.y) { drag.preview = p; drawPoints(); } }
  });
  svg.addEventListener('pointerup', event => {
    const drag = state.drag; if (!drag || event.pointerId !== drag.pointerId) return;
    state.drag = null; if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    if (drag.id !== null) {
      if (drag.moved) { hideActions(); movePoint(drag.id, drag.preview || graphPosition(localPosition(event))); }
      else showActions(drag.id);
    } else if (!drag.moved && inside(localPosition(event))) addPoint(graphPosition(localPosition(event)));
  });
  function cancelDrag() { if (state.drag) { state.drag = null; hideActions(); drawGraph(); } }
  svg.addEventListener('pointercancel', cancelDrag); svg.addEventListener('lostpointercapture', cancelDrag);
  svg.addEventListener('pointerleave', () => { if (!state.drag) clearHover(); });
  svg.addEventListener('keydown', event => {
    const dot = event.target.closest('[data-point]'), p = dot ? pointById(dot.dataset.point) : null;
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
    if (delta) {
      event.preventDefault(); hideActions(); clearHover();
      if (p) { movePoint(p.id, { x: clamp(p.x + delta[0]), y: clamp(p.y + delta[1]) }); svg.querySelector(`[data-point="${p.id}"]`)?.focus({ preventScroll: true }); }
      else { const old = state.cursor || { x: 0, y: 0 }; state.cursor = { x: clamp(old.x + delta[0]), y: clamp(old.y + delta[1]) }; drawCursor(); say(`Grid cursor ${coord(state.cursor)}. Press Enter to add a point.`); }
    } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (p) { showActions(p.id); $('delete-point').focus(); } else addPoint(state.cursor || { x: 0, y: 0 }); }
    else if (p && (event.key === 'Delete' || event.key === 'Backspace')) { event.preventDefault(); deletePoint(p.id); svg.focus({ preventScroll: true }); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { hideActions(); clearHover(); state.cursor = null; cancelDrag(); drawGraph(); } });
  document.addEventListener('pointerdown', event => { if (!event.target.closest('#point-actions') && !event.target.closest('#graph')) { hideActions(); drawPoints(); } });
  window.addEventListener('scroll', () => { if (state.selected !== null) { hideActions(); drawPoints(); } clearHover(); }, { passive: true });
  new ResizeObserver(() => { hideActions(); clearHover(); drawGrid(); }).observe(svg);
  refresh();
})();
