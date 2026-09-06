'use strict';

// var myFunction;


foo();
console.log(add(1, 2));
// var x;

function add(x, y) {
  console.log(arguments);
  return x + y;
}

console.log(add(2, 4));
console.log(add());
console.log(add(2, 4, 2));


console.log(add('Donald', 'Trump'));

//console.log(x);
//console.log(z);
let x = 100;
// x = 100;
console.log(x);

//console.log(qq, i);
for (let i = 0; i < 10; i++) {
  let qq = 45;
  console.log(i + qq);
}
//console.log(qq, i);

function foo() {
  var s = 'foo';
  console.log(s);
}
foo();
//console.log(s);

// myFunction();

var myFunction = function () {
  console.log('function was called');
};

myFunction();


const multiply = (x, y) => x * y;
console.log(multiply(2, 5));

const a = 5;
const b = '5';
console.log(a - b);

console.log(a == b);
console.log(a != b);

console.log(a === b);
console.log(a !== b);

const r = 5 * 'foo';
const p = 5 * 'foo';
console.log(r);
console.log(r == p);
console.log(isNaN(r));

console.log('b' + 'a' + +'b' + 'a');
console.log(+'15');
