'use strict' 

// *********************** Closures *********************** //

function Multiplier(a, b) {
    return a * b;
}

console.log(Multiplier(2, 3));
console.log(Multiplier(5, 3));
console.log(Multiplier(2, 7));

function getMultiplier(b) {
    return function (a) {
        console.log(a * b);
    }
}

const multiplication = getMultiplier(3);
multiplication(6);
const multiplication2 = getMultiplier(7);
multiplication2(8);
const multiplication3 = getMultiplier(9);
multiplication3(9);

// *********************** CallBack *********************** //

const lessTen = function (a) {
    return a < 10;
}

const isUpper = function (a) {
    return a === a.toUpperCase();
}

const isLower = function (a) {
    return a === a.toLowerCase();
}
const numbers = [1, 2, 3, 4, 15, 6, 7, 8, 9];

const letters = ['A', 'B', 'C'];

function TesterAll(arr, func) {
let a = true;
    for (let i = 0; i < arr.length; i++) {
        if (!func(arr[i])) {
            a = false;
            break;
        }
    }
    return a;
}

function TesterSome(arr, func) {
    let a = false;
    for (let i = 0; i < arr.length; i++) {
        if (func(arr[i])) {
            a = true;
            break;
        }
    }
    return a;
}
console.log(TesterAll(numbers, lessTen));

console.log(TesterAll(letters, isUpper));

console.log(TesterAll(letters, isLower));

/////////////////////////////////////////

console.log(numbers.every(lessTen));

console.log(letters.every(isUpper));

console.log(letters.every(isLower));

/////////////////////////////////////////

console.log(TesterSome(numbers, lessTen));

console.log(TesterSome(letters, isUpper));

console.log(TesterSome(letters, isLower));

/////////////////////////////////////////

console.log(numbers.some(lessTen));

console.log(letters.some(isUpper));

console.log(letters.some(isLower));