'use strict';

const MIN_VALUE = -20;
const MAX_VALUE = 20;
let currentValue = 0;

const currentValueText = document.querySelector('#currentValue');
const historyList = document.querySelector('#historyList');
const addForm = document.querySelector('#addForm');
const subtractForm = document.querySelector('#subtractForm');
const addInput = document.querySelector('#addInput');
const subtractInput = document.querySelector('#subtractInput');

const verticalFill = document.querySelector('#verticalFill');
const verticalScale = document.querySelector('#verticalScale');
const horizontalFill = document.querySelector('#horizontalFill');
const horizontalLabels = document.querySelector('#horizontalLabels');

function makeVerticalLabels() {
  if (!verticalScale) return;

  for (let value = MIN_VALUE; value <= MAX_VALUE; value++) {
    const label = document.createElement('span');
    label.className = 'tick-label';
    label.textContent = value;

    // +20 at the top, -20 at the bottom.
    const percentFromTop = ((MAX_VALUE - value) / (MAX_VALUE - MIN_VALUE)) * 100;
    label.style.top = `${percentFromTop}%`;
    label.style.transform = 'translateY(-50%)';
    verticalScale.appendChild(label);
  }
}

function makeHorizontalLabels() {
  if (!horizontalLabels) return;

  for (let value = MIN_VALUE; value <= MAX_VALUE; value++) {
    const label = document.createElement('span');
    label.className = 'tick-label';
    label.textContent = value;

    const percentFromLeft = ((value - MIN_VALUE) / (MAX_VALUE - MIN_VALUE)) * 100;
    label.style.left = `${percentFromLeft}%`;
    horizontalLabels.appendChild(label);
  }
}

function updateGauge() {
  currentValueText.textContent = currentValue;

  // The math value can go beyond the displayed number line.
  // Only the visual fill is limited to the visible range of -20 through +20.
  const displayedValue = Math.max(MIN_VALUE, Math.min(MAX_VALUE, currentValue));

  // The fill always starts at the lowest displayed value (-20)
  // and extends up to the current displayed value.
  // -20 = 0% filled, 0 = 50% filled, +20 = 100% filled.
  const fillPercent = ((displayedValue - MIN_VALUE) / (MAX_VALUE - MIN_VALUE)) * 100;
  const fillColor = currentValue < 0 ? 'var(--negative)' : 'var(--positive)';

  if (verticalFill) {
    verticalFill.style.height = `${fillPercent}%`;
    verticalFill.style.top = `${100 - fillPercent}%`;
    verticalFill.style.backgroundColor = fillColor;
  }

  if (horizontalFill) {
    horizontalFill.style.width = `${fillPercent}%`;
    horizontalFill.style.left = '0';
    horizontalFill.style.backgroundColor = fillColor;
  }
}

function addHistory(operation, enteredValue, oldValue, newValue, note = '') {
  const placeholder = historyList.querySelector('[data-placeholder]');
  if (placeholder) placeholder.remove();

  const item = document.createElement('li');
  const symbol = operation === 'Add' ? '+' : '−';

  item.textContent = `${oldValue} ${symbol} (${enteredValue}) = ${newValue}${note}`;
  historyList.prepend(item);
}

function processOperation(operation, enteredValue) {
  if (!Number.isFinite(enteredValue)) return;

  const oldValue = currentValue;
  currentValue = operation === 'Add'
    ? oldValue + enteredValue
    : oldValue - enteredValue;

  let note = '';
  if (currentValue > MAX_VALUE) {
    note = ' — graph capped at +20';
  } else if (currentValue < MIN_VALUE) {
    note = ' — graph capped at −20';
  }

  addHistory(operation, enteredValue, oldValue, currentValue, note);
  updateGauge();
}

addForm.addEventListener('submit', event => {
  event.preventDefault();
  processOperation('Add', Number(addInput.value));
  addInput.value = '';
  addInput.focus();
});

subtractForm.addEventListener('submit', event => {
  event.preventDefault();
  processOperation('Subtract', Number(subtractInput.value));
  subtractInput.value = '';
  subtractInput.focus();
});

makeVerticalLabels();
makeHorizontalLabels();
updateGauge();
