/* ============================================================
   Number Line — shared behaviour for the vertical and horizontal pages.

   The running value is unlimited; only the drawing is clamped to the
   scale. The fill always spans from the low end (-20) to the current
   value, and is black at or above zero, red below it.
   ============================================================ */

'use strict';

var MIN_VALUE = -20;
var MAX_VALUE = 20;
var SPAN = MAX_VALUE - MIN_VALUE;

var currentValue = 0;

/* ---------- elements (each page has one of the two gauges) ---------- */
var valueText = document.getElementById('currentValue');
var rangeNote = document.getElementById('rangeNote');
var historyList = document.getElementById('historyList');
var clearButton = document.getElementById('clearHistory');

var addForm = document.getElementById('addForm');
var subtractForm = document.getElementById('subtractForm');
var addInput = document.getElementById('addInput');
var subtractInput = document.getElementById('subtractInput');

var verticalScale = document.getElementById('verticalScale');
var verticalFill = document.getElementById('verticalFill');
var horizontalScale = document.getElementById('horizontalScale');
var horizontalFill = document.getElementById('horizontalFill');

/* ============================================================
   Helpers
   ============================================================ */

/* Real minus sign for anything shown on screen. */
function pretty(number) {
  var rounded = Math.round(number * 100) / 100;
  return String(rounded).replace('-', '−');
}

/* ============================================================
   Building the scale: every whole number from -20 to +20
   ============================================================ */

function buildScale(container, isVertical) {
  if (!container) { return; }

  for (var value = MIN_VALUE; value <= MAX_VALUE; value++) {
    var tick = document.createElement('span');
    tick.className = 'tick' + (value % 5 === 0 ? ' is-major' : '');

    var number = document.createElement('span');
    number.className = 'tick-num';
    number.textContent = pretty(value);

    var line = document.createElement('span');
    line.className = 'tick-line';

    if (isVertical) {
      /* +20 at the top, -20 at the bottom; number sits left of the line */
      tick.style.top = ((MAX_VALUE - value) / SPAN) * 100 + '%';
      tick.appendChild(number);
      tick.appendChild(line);
    } else {
      /* -20 at the left, +20 at the right; line sits above the number */
      tick.style.left = ((value - MIN_VALUE) / SPAN) * 100 + '%';
      tick.appendChild(line);
      tick.appendChild(number);
    }

    container.appendChild(tick);
  }
}

/* ============================================================
   Drawing the current value
   ============================================================ */

function render() {
  var isNegative = currentValue < 0;

  /* the drawing stops at the ends of the scale, the value does not */
  var drawn = Math.max(MIN_VALUE, Math.min(MAX_VALUE, currentValue));
  var percent = ((drawn - MIN_VALUE) / SPAN) * 100;

  if (verticalFill) {
    verticalFill.style.height = percent + '%';
    verticalFill.classList.toggle('is-negative', isNegative);
  }
  if (horizontalFill) {
    horizontalFill.style.width = percent + '%';
    horizontalFill.classList.toggle('is-negative', isNegative);
  }

  valueText.textContent = pretty(currentValue);
  valueText.classList.toggle('is-negative', isNegative);

  if (currentValue > MAX_VALUE) {
    rangeNote.textContent = 'Past the top of the scale — fill held at +20.';
  } else if (currentValue < MIN_VALUE) {
    rangeNote.textContent = 'Past the bottom of the scale — fill held at −20.';
  } else {
    rangeNote.textContent = '';
  }
}

/* ============================================================
   History
   ============================================================ */

function addHistory(operation, entered, before, after) {
  var placeholder = historyList.querySelector('[data-placeholder]');
  if (placeholder) { placeholder.remove(); }

  var isAdd = operation === 'add';

  var item = document.createElement('li');
  item.className = 'history-item' + (isAdd ? ' is-add' : ' is-sub');

  var badge = document.createElement('span');
  badge.className = 'history-op';
  badge.textContent = isAdd ? '+' : '−';
  badge.setAttribute('aria-label', isAdd ? 'Add' : 'Subtract');

  var body = document.createElement('span');
  body.className = 'history-body';

  /* e.g.  0 + (−3) = −3   */
  body.appendChild(document.createTextNode(
    pretty(before) + ' ' + (isAdd ? '+' : '−') +
    ' (' + pretty(entered) + ') = '
  ));

  var result = document.createElement('strong');
  result.className = 'history-result' + (after < 0 ? ' is-negative' : '');
  result.textContent = pretty(after);
  body.appendChild(result);

  if (after > MAX_VALUE || after < MIN_VALUE) {
    var flag = document.createElement('span');
    flag.className = 'history-flag';
    flag.textContent = 'off the scale — fill held at ' +
      (after > MAX_VALUE ? '+20' : '−20');
    body.appendChild(flag);
  }

  item.appendChild(badge);
  item.appendChild(body);

  historyList.prepend(item);      /* newest first */
  historyList.scrollTop = 0;
}

/* ============================================================
   Operations
   ============================================================ */

function operate(operation, input) {
  var entered = Number(input.value);

  if (input.value.trim() === '' || !Number.isFinite(entered)) {
    input.focus();
    return;
  }

  var before = currentValue;

  /* subtracting a negative adds, adding a negative subtracts */
  currentValue = operation === 'add' ? before + entered : before - entered;

  addHistory(operation, entered, before, currentValue);
  render();

  input.value = '';
  input.focus();
}

addForm.addEventListener('submit', function (event) {
  event.preventDefault();
  operate('add', addInput);
});

subtractForm.addEventListener('submit', function (event) {
  event.preventDefault();
  operate('subtract', subtractInput);
});

if (clearButton) {
  clearButton.addEventListener('click', function () {
    historyList.innerHTML =
      '<li class="history-empty" data-placeholder>No operations yet.</li>';
  });
}

/* ---------- start ---------- */
buildScale(verticalScale, true);
buildScale(horizontalScale, false);
render();
