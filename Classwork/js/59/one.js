'use strict';

// x = 5;
// console.log('hello world');

const x = '10'; // a';
const y = 10;
console.log(x + y);
console.log(x - 1);

console.log(Number(x) - 1);

console.log(+x + y);
console.log(Number(x) + y);
console.log(parseInt(x, 10) + y);

console.log(x == y);
console.log(x === y);

let z;
console.log(z);

let q = null;
console.log(q);

if (z === null || z === undefined) {
  console.log('z is null or undefined');
}

if (z == null) {
  console.log('z is null or undefined');
}

console.log(typeof(undefined), typeof(null));

let a = NaN; // undefined; // null; // ''; // 0; // false
//  'hello'; //true;
let b = false;

if (!a) {
  console.log('a is !true');
} else {
  console.log('a is !false');
}
