'use strict';

function ourEvery(array, testCallback) {
  /*for(let i = 0; i < array.length; i++) {
    if (!testCallback(array[i])) {
      return false;
    }
  }*/

  let allPassed = true;

  array.forEach(function (element) {
    if (!testCallback(element)) {
      // return false;
      allPassed = false;
    }
  });

  return allPassed; // true;
}

const uppercaseLetters = ['A', 'B', 'C'];
const lowercaseLetters = ['a', 'b', 'c'];
const mixedLetters = ['A', 'b', 'C', 'd'];

function isUppercase(l) {
  return l.toUpperCase() === l;
}

//console.log(ourEvery(uppercaseLetters, isUppercase));
console.log(ourEvery(uppercaseLetters, function isUppercase(l) {
  return l.toUpperCase() === l;
}));
console.log(ourEvery(lowercaseLetters, isUppercase));
console.log(ourEvery(mixedLetters, isUppercase));


function ourSome(array, testCallback) {
  for(let i = 0; i < array.length; i++) {
    if (testCallback(array[i])) {
      return true;
    }
  }

  return false;
}

console.log('ourSome(uppercaseLetters, isUppercase)', ourSome(uppercaseLetters, isUppercase));
console.log(ourSome(uppercaseLetters, function isUppercase(l) {
  return l.toUpperCase() === l;
}));
console.log('ourSome(lowercaseLetters, isUppercase)', ourSome(lowercaseLetters, isUppercase));
console.log('ourSome(mixedLetters, isUppercase)', ourSome(mixedLetters, isUppercase));



mixedLetters
  .filter(isUppercase)
  .forEach(console.log);

function onlyIf(array, testCallback, actionCallback) {
  array.forEach(function (element) {
    if (testCallback(element)) {
      console.log('calling action callback');
      actionCallback(element);
    }
  });
}

onlyIf(mixedLetters, isUppercase, console.log);

//////////////////////////

const noVarFunctionA = function () { console.log('no var functionA called'); };
const noVarFunctionB = () => console.log('no var functionB called');

noVarFunctionA();
noVarFunctionB();

const oneVarFunction = a => console.log('dont need parens', a);
oneVarFunction();

// const multiply = (a,b) => { return a * b; };
const multiply = (a, b) => a * b;
console.log(multiply(2,3));
