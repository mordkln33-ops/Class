'use strict';

const numbers = [1, 2, 3, 4];

numbers.forEach(function (n) {
  console.log(n);
});

function ourForEach(array, callback) {
  for (let i = 0; i < array.length; i++) {
    callback(array[i]); //, i, array);
  }
}

ourForEach(numbers, function (n) {
  console.log(n);
});

ourForEach(numbers, function (n) {
  console.log(n + 1);
});

function printIt(n) {
  console.log(n);
}

ourForEach(numbers, printIt);
ourForEach(numbers, console.log);

numbers.forEach(printIt);
numbers.forEach(console.log);

console.log('x', 5, null);

//////////////////////////


function ourFilter(array, testCallback) {
  const result = [];

  /*for (let i = 0; i < array.length; i++) {
    if (testCallback(array[i])) {
      result.push(array[i]);
    }
  }*/
  array.forEach(function (n) {
    if (testCallback(n)) {
      result.push(n);
    }
  });

  return result;
}

console.log(ourFilter(numbers, function (n) {
  return n % 2;
}));

function isOdd(n) {
  return n % 2;
}

console.log(ourFilter(numbers, isOdd));
console.log(ourFilter(numbers, function (n) {
  return !isOdd(n);
}));

// console.log(ourFilter(numbers, n => n%2));
