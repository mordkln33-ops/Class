'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const resultNumerator = document.querySelector('#resultNumerator');
  const resultDenominator = document.querySelector('#resultDenominator');
  const showFractionButton = document.querySelector('#showFraction');

  const num1 = document.querySelector('#num1');
  const den1 = document.querySelector('#den1');
  const num2 = document.querySelector('#num2');
  const den2 = document.querySelector('#den2');
  const operation = document.querySelector('#operation');
  const calculateButton = document.querySelector('#calculate');

  const directMessage = document.querySelector('#directMessage');
  const calcMessage = document.querySelector('#calcMessage');

  const fractionModel = document.querySelector('#fractionModel');
  const fractionDisplay = document.querySelector('#fractionDisplay');
  const decimalDisplay = document.querySelector('#decimalDisplay');
  const negativeBadge = document.querySelector('#negativeBadge');

  const MAX_DENOMINATOR = 60;

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);

    while (b !== 0) {
      const remainder = a % b;
      a = b;
      b = remainder;
    }

    return a || 1;
  }

  function reduceFraction(numerator, denominator) {
    if (denominator < 0) {
      numerator *= -1;
      denominator *= -1;
    }

    const divisor = gcd(numerator, denominator);

    return {
      numerator: numerator / divisor,
      denominator: denominator / divisor
    };
  }

  function validateFraction(numerator, denominator) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
      return 'Please enter numbers in both fields.';
    }

    if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
      return 'Please enter whole numbers.';
    }

    if (denominator === 0) {
      return 'The denominator cannot be 0.';
    }

    if (Math.abs(denominator) > MAX_DENOMINATOR) {
      return `Please use a denominator of ${MAX_DENOMINATOR} or less.`;
    }

    return '';
  }

  function formatDecimal(number) {
    if (Number.isInteger(number)) {
      return String(number);
    }

    return Number(number.toFixed(6)).toString();
  }

  function renderFraction(numerator, denominator, updateMainFields = false) {
    const error = validateFraction(numerator, denominator);

    if (error) {
      return error;
    }

    if (denominator < 0) {
      numerator *= -1;
      denominator *= -1;
    }

    const absoluteNumerator = Math.abs(numerator);

    fractionModel.innerHTML = '';
    fractionModel.style.gridTemplateColumns =
      `repeat(${denominator}, minmax(0, 1fr))`;

    for (let i = 0; i < denominator; i++) {
      const strip = document.createElement('div');
      strip.className = 'strip';

      if (i < Math.min(absoluteNumerator, denominator)) {
        strip.classList.add('filled');
      }

      fractionModel.appendChild(strip);
    }

    fractionDisplay.textContent = `${numerator}/${denominator}`;
    decimalDisplay.textContent = formatDecimal(numerator / denominator);
    negativeBadge.classList.toggle('show', numerator < 0);

    if (updateMainFields) {
      resultNumerator.value = numerator;
      resultDenominator.value = denominator;
    }

    return '';
  }

  function showFraction() {
    const numerator = Number(resultNumerator.value);
    const denominator = Number(resultDenominator.value);

    const error = renderFraction(numerator, denominator);

    if (error) {
      directMessage.textContent = error;
      directMessage.classList.add('error');
    } else {
      directMessage.textContent = 'Visual updated.';
      directMessage.classList.remove('error');
    }
  }

  function calculateFractions() {
    const n1 = Number(num1.value);
    const d1 = Number(den1.value);
    const n2 = Number(num2.value);
    const d2 = Number(den2.value);

    const firstError = validateFraction(n1, d1);
    const secondError = validateFraction(n2, d2);

    if (firstError || secondError) {
      calcMessage.textContent = firstError || secondError;
      calcMessage.classList.add('error');
      return;
    }

    let resultN;
    let resultD;

    if (operation.value === '+') {
      resultN = n1 * d2 + n2 * d1;
      resultD = d1 * d2;
    } else if (operation.value === '-') {
      resultN = n1 * d2 - n2 * d1;
      resultD = d1 * d2;
    } else if (operation.value === '*') {
      resultN = n1 * n2;
      resultD = d1 * d2;
    } else {
      if (n2 === 0) {
        calcMessage.textContent = 'You cannot divide by 0.';
        calcMessage.classList.add('error');
        return;
      }

      resultN = n1 * d2;
      resultD = d1 * n2;
    }

    const reduced = reduceFraction(resultN, resultD);

    const error = renderFraction(
      reduced.numerator,
      reduced.denominator,
      true
    );

    if (error) {
      calcMessage.textContent = error;
      calcMessage.classList.add('error');
      return;
    }

    const symbol =
      operation.options[operation.selectedIndex].textContent;

    calcMessage.textContent =
      `${n1}/${d1} ${symbol} ${n2}/${d2} = ` +
      `${reduced.numerator}/${reduced.denominator}`;

    calcMessage.classList.remove('error');

    directMessage.textContent =
      'The main fraction was updated with the calculator result.';
    directMessage.classList.remove('error');
  }

  showFractionButton.addEventListener('click', showFraction);
  calculateButton.addEventListener('click', calculateFractions);

  resultNumerator.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      showFraction();
    }
  });

  resultDenominator.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      showFraction();
    }
  });

  [num1, den1, num2, den2].forEach(input => {
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        calculateFractions();
      }
    });
  });

  renderFraction(3, 4);
});
