'use strict';

function multiply(x, y) {
  return x * y;
}

console.log(multiply(2, 5));

function getMultiplier() {
  /*return function(x, y) {
    return x * y;
  };*/

  return multiply;
}

const theMultiplier = getMultiplier();
console.log(theMultiplier(4, 3));

console.log(getMultiplier()(5, 3));

const originalMultiply = multiply;
console.log(originalMultiply(3, 3));

function getBetterMultiplier(factorA) {
  let z = 50;

  function foo() {
    console.log('foo');
  }

  const largeArray = [];
  for (let i = 0; i < 10000000; i++) {
    largeArray.push(i);
  }

  return function (factorB) {
    // console.log(largeArray[0]);
    foo();
    console.log('z is', z);
    return factorA * factorB;
  };
}

const tenTimesMultiplier = getBetterMultiplier(10);
const sevenTimesMultiplier = getBetterMultiplier(7);
console.log(tenTimesMultiplier(10));
console.log(sevenTimesMultiplier(10));

//foo();
